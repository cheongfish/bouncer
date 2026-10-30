'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

import paths = require('./paths');
const { toPosix } = paths;
import scope = require('./scope');
const { readCoordinatorLedger } = scope;
import gitOps = require('./git-ops');
const { resolveCheckoutBranch } = gitOps;
import finalizeChecks = require('./finalize-checks');
const { collectMustFixWarnings, isDeferredMustFix } = finalizeChecks;

type GitExecResult = { status: number; stdout: string };
type GitExec = (args: string[]) => GitExecResult;

type PrDraft = {
  title_prefix: string | null;
  title_prefix_template: string;
  base: string | null;
  head: string | null;
  draft: boolean;
  sections: {
    related: string[];
    background: null;
    changes: null;
    flow: null;
    review_points: string[];
    verification: string[];
    // blueprint 루트 리뷰의 deferred must_fix. 없으면 빈 배열이다.
    unresolved_must_fix: string[];
  };
};

type ExplainLink = { kind: 'branch' | 'commit'; url: string };

type ExplainLinksResult = {
  ok: true;
  branch: string | null;
  links: ExplainLink[];
  reason: string | null;
};

const COMMIT_TYPE_RE = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?!?:/;

/**
 * 기본 git 실행기. 주입 exec와 같은 `{ status, stdout }`만 돌려
 * stderr 유무로 seam이 갈라지지 않게 한다.
 *
 * @param {string} cwd - git cwd
 * @param {string[]} args - `git` 뒤 argv
 * @returns {{ status: number, stdout: string }}
 */
function defaultExec(cwd: string, args: string[]): GitExecResult {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return {
    status: typeof r.status === 'number' ? r.status : 1,
    stdout: r.stdout || '',
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * 문자열 첫 글자만 대문자로 바꾼다. PR 제목의 MergeTarget·Type에 쓴다.
 *
 * @param {string} raw - 원문
 * @returns {string}
 */
function capitalizeFirst(raw: string): string {
  if (!raw) return raw;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * instant를 KST 달력의 YYMMDD로 접는다. 제목 접두 날짜는 UTC가 아니라
 * Asia/Seoul이어야 draft-pr 계약과 같다.
 *
 * @param {Date} now - 기준 시각
 * @returns {string} 여섯 자리 YYMMDD
 */
function yymmddKst(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    return part ? part.value : '00';
  };
  return `${get('year').slice(-2)}${get('month')}${get('day')}`;
}

/**
 * GitHub owner/repo 한 칸이 blob URL에 안전한 identity인지 본다.
 * 빈 값·`.`·`..`·`/`·`\`·기타 경호 문자는 경로 탈출·호스트 혼동에 쓰이므로 거절한다.
 *
 * @param {string} segment - owner 또는 repo 후보
 * @returns {boolean}
 */
function isGithubIdentitySegment(segment: string): boolean {
  if (!segment || segment === '.' || segment === '..') return false;
  if (segment.includes('/') || segment.includes('\\')) return false;
  // GitHub login/repo에 허용되는 문자만. `%2f` 같은 인코딩 우회도 여기서 막는다.
  return /^[A-Za-z0-9._-]+$/.test(segment);
}

/**
 * GitHub remote URL에서 owner/repo만 뽑는다. GitLab·repo 없는 SSH·빈 문자열·
 * `.`/`..`/비 identity 세그먼트는 null — links가 unsupported-host로 거절할 수
 * 있게 URL을 추측하지 않는다.
 *
 * @param {string} url - `git remote get-url origin` 결과
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  const raw = url.trim();
  const patterns = [
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  ];
  for (const re of patterns) {
    const m = re.exec(raw);
    if (!m) continue;
    const owner = m[1];
    const repo = m[2];
    if (!isGithubIdentitySegment(owner) || !isGithubIdentitySegment(repo)) {
      return null;
    }
    return { owner, repo };
  }
  return null;
}

/**
 * conventional commit subject에서 type만 고른다. scope·breaking 표기는 버리고
 * 제목 접두의 Feat/Fix 집합에 넣는다.
 *
 * @param {string} subject - 커밋 제목 한 줄
 * @returns {string | null} 소문자 type 또는 매칭 실패 null
 */
function commitTypeOf(subject: string): string | null {
  const m = COMMIT_TYPE_RE.exec(String(subject || '').trim());
  return m ? m[1].toLowerCase() : null;
}

/**
 * digest 커밋 제목에서 type을 첫 등장 순으로 모은다. 없으면 blueprint
 * commit_type 하나로 폴백 — 제목 접두의 `[Type]`이 비지 않게 한다.
 *
 * @param {Array<{ subject?: string }>} commits - digest.commits
 * @param {string} fallback - blueprint.commit_type
 * @returns {string[]} 소문자 type 목록(중복 제거, 등장 순)
 */
function collectCommitTypes(
  commits: Array<{ subject?: string }>,
  fallback: string,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const entry of Array.isArray(commits) ? commits : []) {
    const type = commitTypeOf(typeof entry.subject === 'string' ? entry.subject : '');
    if (!type || seen.has(type)) continue;
    seen.add(type);
    ordered.push(type);
  }
  if (ordered.length === 0) {
    const fb = typeof fallback === 'string' && fallback.trim()
      ? fallback.trim().toLowerCase()
      : 'feat';
    return [fb];
  }
  return ordered;
}

/**
 * task verification을 `command — passed|failed` 행으로 접는다.
 * 같은 문자열은 첫 등장만 남긴다 — 동일 명령·동일 결과가 task마다 반복되면
 * PR 확인 방법이 불필요하게 길어진다. 명령이 같아도 passed/failed가 다르면
 * 문자열이 달라 두 줄 모두 남는다.
 *
 * @param {unknown[]} tasks - digest.tasks
 * @returns {string[]}
 */
function buildVerificationLines(tasks: unknown[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(tasks) ? tasks : []) {
    const task = asRecord(entry);
    const verification = asRecord(task.verification);
    if (!task.verification || typeof verification.command !== 'string' || !verification.command) {
      continue;
    }
    const passed = verification.status === 'passed';
    // 범위 밖으로 분류된 terminal 실패는 failed 그대로 두고 원본 증거 id만 덧붙인다 — 분류가
    // 통과처럼 읽히지 않게 하고, 로컬 경로 대신 id로만 참조한다.
    const outside = asRecord(verification.outside_scope);
    const suffix = !passed && typeof outside.evidence_id === 'string' && outside.evidence_id
      ? ` (outside_scope, evidence ${outside.evidence_id})` : '';
    const line = `${verification.command} — ${passed ? 'passed' : 'failed'}${suffix}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
  }
  return lines;
}

const WORKER_NOTE_KINDS = ['open_choices', 'known_weaknesses'] as const;
const WORKER_NOTE_LABEL: Record<(typeof WORKER_NOTE_KINDS)[number], string> = {
  open_choices: '구현 선택',
  known_weaknesses: '알려진 약점',
};

/**
 * task.worker_notes를 리뷰 포인트로 접는다. 종류(구현 선택 / 알려진 약점)가 다르면
 * 원문이 같아도 두 줄을 남기고, 같은 종류·같은 원문만 id를 모아 한 줄로 쓴다.
 * 자동 번역하지 않는다 — 원문 보존이 계약이고 한국어 요약은 최종 작성자 몫이다.
 *
 * @param {string[]} points - 누적 배열
 * @param {unknown[]} tasks - digest.tasks
 * @returns {void}
 */
function pushWorkerNotePoints(points: string[], tasks: unknown[]): void {
  type NoteKind = (typeof WORKER_NOTE_KINDS)[number];
  const groups: Array<{ kind: NoteKind; text: string; ids: string[] }> = [];
  const indexByKey = new Map<string, number>();
  for (const entry of tasks) {
    const task = asRecord(entry);
    const notes = asRecord(task.worker_notes);
    const id = typeof task.id === 'string' ? task.id : '';
    for (const kind of WORKER_NOTE_KINDS) {
      for (const item of Array.isArray(notes[kind]) ? notes[kind] : []) {
        if (typeof item !== 'string' || !item) continue;
        // 종류와 원문을 같이 키로 쓴다. 종류만 묶으면 다른 문구가 사라지고,
        // 원문만 묶으면 구현 선택과 약점이 한 줄로 합쳐진다.
        const key = `${kind}\0${item}`;
        let idx = indexByKey.get(key);
        if (idx === undefined) {
          idx = groups.length;
          indexByKey.set(key, idx);
          groups.push({ kind, text: item, ids: [] });
        }
        if (!groups[idx].ids.includes(id)) groups[idx].ids.push(id);
      }
    }
  }
  for (const group of groups) {
    points.push(`${WORKER_NOTE_LABEL[group.kind]}(${group.ids.join(', ')}): ${group.text}`);
  }
}

/**
 * accepted/deferred finding만 리뷰 포인트로 접는다.
 * task.review와 blueprint_review가 같은 규칙을 쓰게 한 헬퍼 —
 * 한쪽만 note 폴백을 바꾸면 PR 본문이 갈라진다.
 * `seen`에 이미 있는 문자열은 건너뛴다 — finding 메모끼리만 첫 등장을 남기기 위함.
 * `exclude`가 참인 finding은 다른 절이 이미 싣는 항목이라 건너뛰고 `seen`에도
 * 넣지 않는다 — 같은 메모를 가진 다른 finding이 그 때문에 사라지지 않게 한다.
 *
 * @param {string[]} points - 누적 배열
 * @param {Set<string>} seen - finding 메모 중복 집합(out_of_scope와 공유하지 않음)
 * @param {unknown} rawFindings - findings 원본
 * @param {(raw: unknown) => boolean} [exclude] - 이 절에서 뺄 finding 판정. 없으면 모두 대상
 * @returns {void}
 */
function pushFindingPoints(
  points: string[],
  seen: Set<string>,
  rawFindings: unknown,
  exclude?: (raw: unknown) => boolean,
): void {
  const findings = Array.isArray(rawFindings) ? rawFindings : [];
  for (const raw of findings) {
    const finding = asRecord(raw);
    if (finding.status !== 'accepted' && finding.status !== 'deferred') continue;
    if (exclude && exclude(raw)) continue;
    let text: string | null = null;
    if (typeof finding.note === 'string' && finding.note) {
      text = finding.note;
    } else if (typeof finding.id === 'string' && finding.id) {
      // F3 accepted: note 없을 때 finding.id 폴백은 digest 진단값이라 유지한다.
      text = finding.id;
    }
    if (!text || seen.has(text)) continue;
    seen.add(text);
    points.push(text);
  }
}

/**
 * out_of_scope·accepted/deferred finding note·unverified를 리뷰 포인트 문자열로
 * 모은다. Epic/Quiz/원문 로그는 넣지 않는다 — Constraints의 PR 본문 금지 목록.
 * unverified.task는 digest stable_id(EPIC-…/BP-…/TASK-…)라 본문에 넣지 않는다.
 * blueprint_review.findings는 루트 리뷰 경로이며 task.review와 같은 규칙으로
 * accepted/deferred note를 싣는다.
 * finding 메모는 서로만 첫 등장 순서로 한 번 — out_of_scope와 같은 문자열이어도
 * 둘 다 남긴다. digest가 같은 finding을 unverified `finding-*`로도 내므로 그 행은
 * 재게시하지 않는다(path-outside-scope 등 다른 kind는 유지).
 * blueprint 루트의 deferred must_fix는 `unresolved_must_fix` 절이 싣으므로 여기서
 * 뺀다. task 범위 finding은 같은 id·메모여도 경고 대상이 아니라 그대로 남긴다.
 *
 * @param {object} digest
 * @param {string[]} digest.out_of_scope
 * @param {unknown[]} digest.tasks
 * @param {unknown[]} digest.unverified
 * @param {{ findings?: unknown } | null} [digest.blueprint_review]
 * @returns {string[]}
 */
function buildReviewPoints(digest: {
  out_of_scope?: unknown;
  tasks?: unknown;
  unverified?: unknown;
  blueprint_review?: unknown;
}): string[] {
  const points: string[] = [];
  const outOfScope = Array.isArray(digest.out_of_scope) ? digest.out_of_scope : [];
  for (const item of outOfScope) {
    if (typeof item === 'string' && item) points.push(item);
  }

  // finding 메모 중복 집합은 out_of_scope와 분리 — 같은 문자열도 출처가 다르면 둘 다.
  const seenFindings = new Set<string>();
  const tasks = Array.isArray(digest.tasks) ? digest.tasks : [];
  for (const entry of tasks) {
    const review = asRecord(asRecord(entry).review);
    pushFindingPoints(points, seenFindings, review.findings);
  }
  pushFindingPoints(
    points, seenFindings, asRecord(digest.blueprint_review).findings, isDeferredMustFix,
  );

  // worker note는 원장을 읽지 않고 digest task.worker_notes만 쓴다. 같은 종류·같은
  // 원문은 한 줄로 접되 출처 task id는 최초 등장 순으로 모두 남긴다 — 중복 출력으로
  // 근거를 지우는 것과, 한쪽 task만 남겨 출처를 잃는 것을 둘 다 막는다.
  pushWorkerNotePoints(points, tasks);

  const unverified = Array.isArray(digest.unverified) ? digest.unverified : [];
  for (const raw of unverified) {
    const row = asRecord(raw);
    const kind = typeof row.kind === 'string' ? row.kind : '';
    if (!kind) continue;
    // review.findings 경로와 같은 메모를 다시 쓰지 않는다 — digest unverified 보존은 그대로.
    if (kind === 'finding-accepted' || kind === 'finding-deferred') continue;
    if (typeof row.detail === 'string' && row.detail) {
      points.push(`${kind}: ${row.detail}`);
    } else if (typeof row.path === 'string' && row.path) {
      points.push(`${kind}: ${row.path}`);
    } else {
      // task stable_id는 고의로 생략 — EPIC-/BP- 형태가 review_points로 새지 않게.
      points.push(kind);
    }
  }
  return points;
}

/**
 * finalize digest에서 PR 제목 접두·base/head·결정적 본문 절을 만든다.
 * background/changes/flow는 Explain 작성 전이므로 null로 두고, related는
 * push 뒤 links가 채우도록 빈 배열로 둔다. git.pr_base가 비어 있으면 base와
 * title_prefix를 null로 두고 template만 채운다 — `main`으로 닫으면 origin/HEAD가
 * 없는 저장소에서 잘못된 draft PR이 열린다.
 *
 * @param {object} digest - prepareFinalizeDigest 성공 payload(또는 동형 fixture)
 * @param {object} opts
 * @param {Date} opts.now - 제목 날짜(KST). 테스트가 고정한다
 * @param {unknown} opts.config - `.bouncer/config.json`. `pr.draft`만 읽는다
 * @returns {PrDraft}
 */
function buildPrDraft(digest: unknown, opts: { now: Date; config: unknown }): PrDraft {
  const d = asRecord(digest);
  const git = asRecord(d.git);
  const blueprint = asRecord(d.blueprint);
  const config = asRecord(opts.config);
  const prCfg = asRecord(config.pr);

  const prBase = typeof git.pr_base === 'string' && git.pr_base.trim()
    ? git.pr_base.trim()
    : null;
  const head = typeof git.branch === 'string' ? git.branch : null;
  const commitType = typeof blueprint.commit_type === 'string' ? blueprint.commit_type : 'feat';
  const commits = Array.isArray(d.commits) ? d.commits as Array<{ subject?: string }> : [];
  const types = collectCommitTypes(commits, commitType)
    .map((t) => capitalizeFirst(t))
    .join('/');
  const titlePrefixTemplate = `[${yymmddKst(opts.now)}] (→ {base}) [${types}]`;

  // draft 기본 true — 키가 없거나 비불리언이면 skill이 실수로 공개 PR을 만들지 않게.
  const draft = typeof prCfg.draft === 'boolean' ? prCfg.draft : true;

  return {
    title_prefix: prBase
      ? titlePrefixTemplate.replace('{base}', capitalizeFirst(prBase))
      : null,
    title_prefix_template: titlePrefixTemplate,
    base: prBase,
    head,
    draft,
    sections: {
      related: [],
      background: null,
      changes: null,
      flow: null,
      review_points: buildReviewPoints({
        out_of_scope: d.out_of_scope,
        tasks: d.tasks,
        unverified: d.unverified,
        // 루트 리뷰 finding은 task.review에 없어서 같이 넘기지 않으면 PR에서 빠진다.
        blueprint_review: d.blueprint_review,
      }),
      verification: buildVerificationLines(Array.isArray(d.tasks) ? d.tasks : []),
      // digest warnings와 같은 함수로 만든다 — PR이 별도 입력 필드에 기대지 않고
      // blueprint_review(blueprint 모드에서만 non-null)에서 같은 id/note를 얻는다.
      unresolved_must_fix: collectMustFixWarnings(asRecord(d.blueprint_review).findings)
        .map((w) => (w.note ? `${w.id}: ${w.note}` : w.id)),
    },
  };
}

const SUMMARY_BACKGROUND = '배경 · 변경 의도';
const SUMMARY_CHANGES = '주요 변경 내용';
// pr-body는 근거를 발명하지 않으므로, flow·전후 관측이 없을 때 이 표식으로 자리를 남긴다.
const PR_BODY_NEEDS_WRITE = '<TODO: 작성 필요>';
const DRIVE_ISSUE_KEYS = [
  'rework_reports', 'debugger_calls', 'repair_waves',
  'fanin_verification_failures', 'blocked', 'deferred_must_fix',
] as const;

/**
 * 한국어 요약 Markdown에서 `## <heading>` 절의 본문을 꺼낸다. 다음 `## ` 헤딩 전까지가 본문이며
 * 앞뒤 공백은 잘라 결정적 출력을 보장한다. 헤딩이 없거나 본문이 비면 null이다.
 *
 * @param {string} summary - 요약 파일 전문
 * @param {string} heading - `## ` 뒤의 정확한 헤딩 문자열
 * @returns {string | null}
 */
function extractSummarySection(summary: string, heading: string): string | null {
  const lines = summary.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.trimEnd() === `## ${heading}`);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end < 0 ? rest : rest.slice(0, end)).join('\n').trim();
  return body || null;
}

/**
 * renderPrBody가 읽는 v2 digest의 최소 shape를 검사한다. 보존 digest는 파일에서 오므로
 * 손상된 JSON이 빈 초안으로 조용히 통과하지 않게 range와 task verification만 확인한다.
 *
 * @param {Record<string, unknown>} digest - 파싱된 digest
 * @returns {void} 위반하면 Error를 던진다
 */
function assertPrBodyDigest(digest: Record<string, unknown>): void {
  if (digest.ok !== true || digest.version !== 2) {
    throw new Error('digest must be a prepare digest with ok: true and version: 2');
  }
  const range = asRecord(digest.range);
  if (typeof range.base !== 'string' || !range.base || typeof range.head !== 'string' || !range.head) {
    throw new Error('digest.range.base and digest.range.head are required');
  }
  if (!Array.isArray(digest.tasks)) throw new Error('digest.tasks must be an array');
  for (const entry of digest.tasks) {
    const task = asRecord(entry);
    if (task.verification === null || task.verification === undefined) continue;
    const v = asRecord(task.verification);
    const commandOk = v.command === null || v.command === undefined || typeof v.command === 'string';
    if (typeof v.status !== 'string' || !commandOk) {
      throw new Error('digest task verification needs a string status and a string or null command');
    }
  }
}

/**
 * 보존한 finalize digest와 한국어 요약으로 PR 본문 Markdown 초안을 만든다. 순수 함수 —
 * 파일·Git·원장·현재 task를 읽지 않으므로 정리 뒤에도 같은 입력이 같은 바이트를 낸다.
 * 절 순서는 관련 이슈, 배경, 변경, 변경 그림, 변경 전후, 리뷰 포인트, 되돌리기 · 영향 범위,
 * 확인 방법이다. 근거 없는 선택 절은 생략하되 필수 세 절은 비어도 지우지 않고 작성 필요 표식을 둔다.
 * 실패한 검증은 `failed`로, 미해결 must_fix·실행 이슈는 리뷰 포인트에 그대로 남긴다.
 *
 * @param {object} input
 * @param {unknown} input.digest - 파싱된 v2 digest
 * @param {string} input.summary - `## 배경 · 변경 의도`, `## 주요 변경 내용` 절을 가진 요약 Markdown
 * @param {string} [input.flow] - Mermaid 소스. 있으면 `변경 그림` 아래 펜스, 없으면 작성 필요 표식
 * @returns {string} 끝에 개행 하나를 가진 Markdown
 * @throws 입력 shape 위반 또는 요약 절 누락 시 Error
 */
function renderPrBody(input: { digest: unknown; summary: string; flow?: string }): string {
  const d = asRecord(input.digest);
  assertPrBodyDigest(d);
  const background = extractSummarySection(String(input.summary ?? ''), SUMMARY_BACKGROUND);
  const changes = extractSummarySection(String(input.summary ?? ''), SUMMARY_CHANGES);
  if (!background) throw new Error(`summary needs a non-empty "## ${SUMMARY_BACKGROUND}" section`);
  if (!changes) throw new Error(`summary needs a non-empty "## ${SUMMARY_CHANGES}" section`);

  const blocks: string[] = [];
  const bullets = (items: string[]): string => items.map((item) => `- ${item}`).join('\n');

  // 링크는 digest가 가진 것만 쓴다 — 경로에서 URL을 만들지 않는다.
  const related = (Array.isArray(asRecord(asRecord(d.pr).sections).related)
    ? asRecord(asRecord(d.pr).sections).related as unknown[] : [])
    .filter((item): item is string => typeof item === 'string' && item !== '');
  if (related.length) blocks.push(`## 관련 이슈\n\n${bullets(related)}`);
  blocks.push(`## ${SUMMARY_BACKGROUND}\n\n${background}`);
  blocks.push(`## ${SUMMARY_CHANGES}\n\n${changes}`);

  const flow = typeof input.flow === 'string' ? input.flow.replace(/\r\n/g, '\n').trim() : '';
  // 변경 그림은 필수 절이다. flow가 있을 때만 Mermaid를 넣고, 없으면 빈 절을 지우는 대신
  // 표식을 둔다 — 최종 작성자가 자리를 확인할 수 있어야 한다.
  if (flow) {
    blocks.push(`## 변경 그림\n\n\`\`\`mermaid\n${flow}\n\`\`\``);
  } else {
    blocks.push(`## 변경 그림\n\n${PR_BODY_NEEDS_WRITE}`);
  }
  blocks.push(`## 변경 전후\n\n${PR_BODY_NEEDS_WRITE}`);

  // 리뷰 포인트: 저장된 warnings와 blueprint_review 재계산을 합쳐 deferred must_fix를 빠뜨리지 않고
  // (같은 문자열은 한 번), 나머지는 buildReviewPoints가 이미 must_fix 중복을 뺀 목록을 쓴다.
  const mustFix: string[] = [];
  const pushMustFix = (id: unknown, note: unknown): void => {
    if (typeof id !== 'string' || !id) return;
    const text = typeof note === 'string' && note ? `${id}: ${note}` : id;
    if (!mustFix.includes(text)) mustFix.push(text);
  };
  for (const w of Array.isArray(d.warnings) ? d.warnings : []) {
    pushMustFix(asRecord(w).id, asRecord(w).note);
  }
  for (const w of collectMustFixWarnings(asRecord(d.blueprint_review).findings)) pushMustFix(w.id, w.note);
  const points = [
    ...mustFix.map((text) => `미해결 must_fix: ${text}`),
    ...buildReviewPoints({
      out_of_scope: d.out_of_scope,
      tasks: d.tasks,
      unverified: d.unverified,
      blueprint_review: d.blueprint_review,
    }),
  ];
  const issues = asRecord(d.drive_issues);
  const issueParts = DRIVE_ISSUE_KEYS
    .filter((key) => typeof issues[key] === 'number' && (issues[key] as number) > 0)
    .map((key) => `${key} ${issues[key]}`);
  if (issueParts.length) points.push(`실행 이슈: ${issueParts.join(', ')}`);
  if (points.length) blocks.push(`## 리뷰 포인트\n\n${bullets(points)}`);

  blocks.push(`## 되돌리기 · 영향 범위\n\n${PR_BODY_NEEDS_WRITE}`);

  const verification = buildVerificationLines(d.tasks as unknown[]);
  if (verification.length) blocks.push(`## 확인 방법\n\n${bullets(verification)}`);

  return `${blocks.join('\n\n')}\n`;
}

/**
 * links가 쓸 branch를 고른다. 원장 integrationBranch가 있으면 그것이 정본이고,
 * 없으면 호출 checkout의 실제 branch다(brief: resolveCheckoutBranch(repoRoot)).
 *
 * @param {string} repoRoot - 호출 checkout
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {{ branch: string | null, checkoutRoot: string }}
 */
function resolveLinksBranch(repoRoot: string, blueprintDir: string): {
  branch: string | null;
  checkoutRoot: string;
} {
  const bp = toPosix(blueprintDir);
  const ledgerRead = readCoordinatorLedger({ repoRoot, blueprint: bp });
  // drive면 integration worktree의 HEAD·remote tracking이 finalize checkout이다.
  const checkoutRoot = ledgerRead.ok
    && typeof ledgerRead.integrationPath === 'string'
    && ledgerRead.integrationPath
    && fs.existsSync(ledgerRead.integrationPath)
    ? ledgerRead.integrationPath
    : repoRoot;

  if (ledgerRead.ok && ledgerRead.ledger) {
    const ledger = asRecord(ledgerRead.ledger);
    if (typeof ledger.integrationBranch === 'string' && ledger.integrationBranch.trim()) {
      return { branch: ledger.integrationBranch.trim(), checkoutRoot };
    }
  }
  return { branch: resolveCheckoutBranch(repoRoot), checkoutRoot };
}

/**
 * links용 blueprintDir이 저장소 상대이며 `..`로 탈출하지 않는지 본다.
 * absolute/`..`를 blob URL에 넣기 전에 막아 404·경로 혼동 URL을 만들지 않는다.
 *
 * @param {unknown} blueprintDir - 호출자 `--blueprint` 값
 * @returns {boolean} true면 거절 대상
 */
function blueprintDirEscapesRepo(blueprintDir: unknown): boolean {
  if (typeof blueprintDir !== 'string' || !blueprintDir.trim()) return true;
  const raw = blueprintDir.trim();
  const posix = toPosix(raw);
  // path.isAbsolute는 플랫폼만 본다. POSIX 절대·드라이브 문자도 저장소 밖으로 취급.
  if (path.isAbsolute(raw) || path.posix.isAbsolute(posix) || /^[A-Za-z]:\//.test(posix)) {
    return true;
  }
  if (posix.split('/').includes('..')) return true;
  return false;
}

/**
 * GitHub blob URL을 만든다. owner/repo/ref/파일 경로의 각 세그먼트를
 * percent-encode해 `#`·공백 등이 fragment·쿼리로 잘리지 않게 한다.
 *
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo
 * @param {string} ref - branch 이름 또는 commit SHA
 * @param {string} fileRel - repo-relative posix 경로
 * @returns {string}
 */
function githubBlobUrl(owner: string, repo: string, ref: string, fileRel: string): string {
  const encodeSegs = (value: string): string => value
    .split('/')
    .filter((seg) => seg.length > 0)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeSegs(ref)}/${encodeSegs(fileRel)}`;
}

/**
 * push된 GitHub head에서만 Explain URL 후보를 반환한다.
 * 네트워크(ls-remote/fetch)를 쓰지 않고 로컬 remote URL·tracking ref만 본다.
 * 실패해도 ok:true — skill이 reason만으로 링크를 생략한다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 checkout(보통 main)
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {(args: string[]) => { status: number, stdout: string }} [opts.exec] - git seam
 * @returns {ExplainLinksResult}
 */
function resolveExplainLinks({
  repoRoot, blueprintDir, exec,
}: {
  repoRoot: string;
  blueprintDir: string;
  exec?: GitExec;
}): ExplainLinksResult {
  const empty = (branch: string | null, reason: string): ExplainLinksResult => ({
    ok: true,
    branch,
    links: [],
    reason,
  });

  // 0. blueprintDir 탈출 거절 — explainRel을 만들기 전에 막아 URL에 `..`가 안 실리게.
  if (blueprintDirEscapesRepo(blueprintDir)) {
    return empty(null, 'invalid-blueprint');
  }

  // 1. branch — task 문서 유무와 무관. 원장 또는 checkout.
  const { branch, checkoutRoot } = resolveLinksBranch(repoRoot, blueprintDir);
  if (!branch) return empty(null, 'branch-unresolved');

  const run = typeof exec === 'function'
    ? exec
    : (args: string[]) => defaultExec(checkoutRoot, args);

  // 2. origin URL — 없으면 추측하지 않는다.
  const remote = run(['remote', 'get-url', 'origin']);
  if (remote.status !== 0 || !remote.stdout.trim()) {
    return empty(branch, 'no-remote');
  }

  // 3. GitHub만. 그 외 host는 URL을 만들지 않는다.
  const parsed = parseGithubRemote(remote.stdout.trim());
  if (!parsed) return empty(branch, 'unsupported-host');

  // 4. tracking ref가 있고 HEAD가 그 ref의 조상(또는 같음)이어야 push된 것으로 본다.
  const remoteRef = `refs/remotes/origin/${branch}`;
  const verified = run(['rev-parse', '--verify', remoteRef]);
  if (verified.status !== 0 || !verified.stdout.trim()) {
    return empty(branch, 'head-not-pushed');
  }
  const ancestor = run(['merge-base', '--is-ancestor', 'HEAD', remoteRef]);
  if (ancestor.status !== 0) {
    return empty(branch, 'head-not-pushed');
  }

  // 5. HEAD 트리에 explain.md가 추적돼 있어야 404 링크를 만들지 않는다.
  const explainRel = toPosix(path.posix.join(toPosix(blueprintDir), 'explain.md'));
  // join 후에도 `..`가 남으면(정규화 전 입력 우회) URL을 만들지 않는다.
  if (explainRel.split('/').includes('..') || path.posix.isAbsolute(explainRel)) {
    return empty(branch, 'invalid-blueprint');
  }
  const tracked = run(['cat-file', '-e', `HEAD:${explainRel}`]);
  if (tracked.status !== 0) {
    return empty(branch, 'explain-missing');
  }

  const headResult = run(['rev-parse', 'HEAD']);
  if (headResult.status !== 0 || !headResult.stdout.trim()) {
    return empty(branch, 'head-not-pushed');
  }
  const headSha = headResult.stdout.trim();

  return {
    ok: true,
    branch,
    links: [
      { kind: 'branch', url: githubBlobUrl(parsed.owner, parsed.repo, branch, explainRel) },
      { kind: 'commit', url: githubBlobUrl(parsed.owner, parsed.repo, headSha, explainRel) },
    ],
    reason: null,
  };
}

export = { buildPrDraft, renderPrBody, resolveExplainLinks, parseGithubRemote };
