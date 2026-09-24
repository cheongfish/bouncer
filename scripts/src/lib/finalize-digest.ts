'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import paths = require('./paths');
const { toPosix } = paths;
import templates = require('./templates');
const { parseIntentBody } = templates;
import validateSections = require('./validate-sections');
const { parseTasksSections, parseSections, pathsOverlap } = validateSections;
import schema = require('./schema');
const { executionKindOf } = schema;
import commitSha = require('./commit-sha');
const { normalizeCommitSha, buildStableProvenance } = commitSha;
import comprehension = require('./comprehension');
const { computeDiffSha } = comprehension;
import configMod = require('./config');
const { readConfig } = configMod;
import scope = require('./scope');
const { readCoordinatorLedger } = scope;
import finalizeMod = require('./finalize');
const { buildCoordinatorProvenance, resolveCheckoutBranch } = finalizeMod;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import currentMod = require('./current');
const { readCurrent } = currentMod;
import taskCommits = require('./task-commits');
const { resolveTaskCommits } = taskCommits;
import finalizePr = require('./finalize-pr');
const { buildPrDraft } = finalizePr;

type GitExecResult = { status: number; stdout: string };
type GitExec = (args: string[]) => GitExecResult;

type DigestFail = {
  ok: false;
  reason: string;
  code?: string;
  ledgerFile?: string | null;
  integrationPath?: string | null;
};

type Finding = { id: string; severity: string; status: string; note?: string };

type TaskDigest = {
  stable_id: string;
  id: string;
  title: string;
  execution_kind: string;
  status: string;
  commit: { sha: string; sha8: string; source: 'trailer' | 'commit_sha' } | null;
  affected_paths: string[];
  actual_paths: string[] | null;
  verification: {
    status: string;
    command: string | null;
    exit_code: number | null;
    evidence_id: string | null;
    reused: boolean | null;
  } | null;
  review: { required: boolean; findings: Finding[] } | null;
  constraints: string | null;
};

type Unverified = { kind: string; task?: string; path?: string; detail?: string };

type FinalizeDigest = {
  ok: true;
  version: 1;
  blueprint: {
    dir: string;
    stable_id: string;
    title: string;
    intent: string[];
    commit_type: string;
    scale: string | null;
  };
  range: { base: string; head: string; diff_sha: string | null };
  git: { branch: string | null; pr_base: string };
  tasks: TaskDigest[];
  changed_paths: string[];
  symbols: Array<{ path: string; names: string[] }>;
  commits: Array<{ sha8: string; subject: string }>;
  unverified: Unverified[];
  out_of_scope: string[];
  coordinator: ReturnType<typeof buildCoordinatorProvenance>;
  pr: ReturnType<typeof buildPrDraft>;
};

const OUT_OF_SCOPE_DEFS = [
  { key: 'outOfScope', re: /^##\s+Out\s+of\s+scope\s*$/i },
];

const SYMBOL_RE = /\b(?:function|class)\s+([A-Za-z_$][\w$]*)|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
const SHORT_SHA_NUL_RE = /([0-9a-f]{7,40})\0/gi;
const PER_FILE_SYMBOL_CAP = 10;
const TOTAL_SYMBOL_CAP = 60;
const COMMIT_LIST_CAP = 50;
const CONTEXT_EXCLUDED = '.bouncer/context/';

/**
 * 기본 git 실행기. 주입 exec와 같은 모양만 돌려 stderr 유무로 seam이
 * 갈라지지 않게 한다.
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

function stringList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((entry): entry is string => typeof entry === 'string' && entry !== '');
}

/**
 * config에서 PR 대상 브랜치를 고른다. `pr.base` → `base_branch` → `main`.
 * 키가 깨져 있어도 digest 전체를 실패시키지 않기 위해 마지막에 main으로 닫는다.
 *
 * @param {string} repoRoot - config를 읽을 checkout
 * @returns {string} PR base 브랜치 이름
 */
function resolvePrBase(repoRoot: string): string {
  const config = readConfig(repoRoot);
  const root = asRecord(config);
  const pr = asRecord(root.pr);
  if (typeof pr.base === 'string' && pr.base.trim()) return pr.base.trim();
  if (typeof root.base_branch === 'string' && root.base_branch.trim()) {
    return root.base_branch.trim();
  }
  return 'main';
}

/**
 * blueprint `## Out of scope` bullet만 뽑아 digest에 싣는다.
 * Intent와 달리 없어도 실패하지 않는다 — 비어 있으면 빈 배열이다.
 *
 * @param {string | null | undefined} body - blueprint index 본문
 * @returns {string[]} bullet 텍스트
 */
function parseOutOfScope(body: string | null | undefined): string[] {
  if (typeof body !== 'string' || !body) return [];
  const section = parseSections(body, OUT_OF_SCOPE_DEFS).outOfScope;
  if (typeof section !== 'string' || !section.trim()) return [];
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

/**
 * pointer·원장에서 digest 범위의 base를 고른다.
 * drive는 원장 `base`가 정본이고, standalone은 같은 blueprint pointer의 base다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 cwd(보통 main checkout)
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {string | null} opts.ledgerBase - 원장 base. 없으면 null
 * @returns {string | null} 해석된 base. 없으면 null → no-base
 */
function resolveDigestBase({
  repoRoot, blueprintDir, ledgerBase,
}: {
  repoRoot: string;
  blueprintDir: string;
  ledgerBase: string | null;
}): string | null {
  if (typeof ledgerBase === 'string' && ledgerBase.trim()) return ledgerBase.trim();
  try {
    const pointer = readCurrent({ repoRoot });
    if (
      pointer
      && typeof pointer.blueprint === 'string'
      && toPosix(pointer.blueprint) === toPosix(blueprintDir)
      && typeof pointer.base === 'string'
      && pointer.base.trim()
    ) {
      return pointer.base.trim();
    }
  } catch (_error) {
    // CURRENT_AMBIGUOUS 등은 base 부재와 같다 — digest는 pointer를 고치지 않는다.
  }
  return null;
}

/**
 * `git log --format=%h%x00%s` 출력을 최신순 목록으로 접는다.
 * `%H%x00%B`와 같이 커밋 경계 NUL이 없어 짧은 SHA\0 앵커로 자른다.
 *
 * @param {string} stdout - git log 원문
 * @returns {Array<{ sha8: string, subject: string }>}
 */
function parseCommitSubjects(stdout: string): Array<{ sha8: string; subject: string }> {
  const starts: Array<{ sha: string; bodyStart: number; shaStart: number }> = [];
  SHORT_SHA_NUL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SHORT_SHA_NUL_RE.exec(stdout)) !== null) {
    starts.push({
      sha: match[1].toLowerCase(),
      bodyStart: match.index + match[0].length,
      shaStart: match.index,
    });
  }
  const out: Array<{ sha8: string; subject: string }> = [];
  for (let i = 0; i < starts.length; i += 1) {
    const end = i + 1 < starts.length ? starts[i + 1].shaStart : stdout.length;
    const subject = stdout.slice(starts[i].bodyStart, end).replace(/^\n|\n$/g, '').trim();
    const sha8 = normalizeCommitSha(starts[i].sha) || starts[i].sha.slice(0, 8);
    out.push({ sha8, subject });
  }
  return out;
}

/**
 * unified diff에서 파일별 심볼 이름을 뽑는다.
 * hunk header 뒤 문맥과 `+` 줄을 함께 본다 — 새 파일 hunk는 header 문맥이
 * 비어 `function greet()`가 `+` 줄에만 나타나기 때문이다.
 *
 * @param {string} diffText - `git diff -U0` 원문
 * @returns {Array<{ path: string, names: string[] }>} 파일당 ≤10, 전체 ≤60
 */
function extractSymbols(diffText: string): Array<{ path: string; names: string[] }> {
  const byPath = new Map<string, string[]>();
  let currentPath: string | null = null;
  let total = 0;

  const pushName = (relPath: string, name: string) => {
    if (total >= TOTAL_SYMBOL_CAP) return;
    let list = byPath.get(relPath);
    if (!list) {
      list = [];
      byPath.set(relPath, list);
    }
    if (list.length >= PER_FILE_SYMBOL_CAP) return;
    if (list.includes(name)) return;
    list.push(name);
    total += 1;
  };

  const scan = (relPath: string, text: string) => {
    SYMBOL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SYMBOL_RE.exec(text)) !== null) {
      const name = m[1] || m[2];
      if (name) pushName(relPath, name);
      if (total >= TOTAL_SYMBOL_CAP) return;
    }
  };

  for (const rawLine of diffText.split('\n')) {
    const line = rawLine;
    const gitPath = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (gitPath) {
      currentPath = toPosix(gitPath[2]);
      continue;
    }
    if (!currentPath || currentPath.startsWith(CONTEXT_EXCLUDED)) continue;
    const hunk = /^@@[^@]*@@(.*)$/.exec(line);
    if (hunk) {
      scan(currentPath, hunk[1] || '');
      continue;
    }
    // 새 파일·순수 추가는 header 문맥이 비어 + 줄만 식별자를 담는다.
    if (line.startsWith('+') && !line.startsWith('+++')) {
      scan(currentPath, line.slice(1));
    }
  }

  return [...byPath.entries()].map(([p, names]) => ({ path: p, names }));
}

/**
 * verification.md frontmatter를 digest 요약으로 접는다.
 * 원문 로그는 싣지 않는다 — status·command·exit_code·evidence_id·reused만.
 *
 * @param {string} absPath - verification.md 절대 경로
 * @returns {TaskDigest['verification']}
 */
function readVerification(absPath: string): TaskDigest['verification'] {
  if (!fs.existsSync(absPath)) return null;
  try {
    const { data } = readDoc(absPath);
    const bouncer = asRecord(asRecord(data).bouncer);
    const meta = asRecord(bouncer.verification);
    return {
      status: typeof bouncer.status === 'string' ? bouncer.status : 'unknown',
      command: typeof meta.command === 'string' ? meta.command : null,
      exit_code: typeof meta.exit_code === 'number' ? meta.exit_code : null,
      evidence_id: typeof meta.evidence_id === 'string' ? meta.evidence_id : null,
      reused: typeof meta.reused === 'boolean' ? meta.reused : null,
    };
  } catch (_error) {
    // 파싱 실패는 증적 없슴과 같다 — digest가 문서 오류로 throw하지 않는다.
    return null;
  }
}

/**
 * review.md frontmatter의 required·findings만 남긴다.
 * verification task는 review leaf가 없어 null이다.
 *
 * @param {string | null} absPath - review.md 절대 경로. 없으면 null
 * @returns {TaskDigest['review']}
 */
function readReview(absPath: string | null): TaskDigest['review'] {
  if (!absPath || !fs.existsSync(absPath)) return null;
  try {
    const { data } = readDoc(absPath);
    const bouncer = asRecord(asRecord(data).bouncer);
    const review = asRecord(bouncer.review);
    const findingsRaw = Array.isArray(review.findings) ? review.findings : [];
    const findings: Finding[] = [];
    for (const entry of findingsRaw) {
      const row = asRecord(entry);
      if (typeof row.id !== 'string' || !row.id) continue;
      const finding: Finding = {
        id: row.id,
        severity: typeof row.severity === 'string' ? row.severity : 'nit',
        status: typeof row.status === 'string' ? row.status : 'resolved',
      };
      if (typeof row.note === 'string' && row.note) finding.note = row.note;
      findings.push(finding);
    }
    // 키 부재는 required=true로 본다. 명시 false만 review-skipped를 만든다.
    return {
      required: review.required === false ? false : true,
      findings,
    };
  } catch (_error) {
    // YAML/frontmatter 파싱 실패·깨진 findings 행만 흡수한다. required/findings를
    // 못 읽으면 review 부재와 같아 null — digest는 문서 오류로 throw하지 않고,
    // unverified도 review-skipped/finding-*를 만들지 않아 안전한 축소다.
    return null;
  }
}

/**
 * affected_paths·changed path 비교 전에 trailing slash를 벗긴다.
 * `src/`와 `src/greet.js`가 pathsOverlap에서 빗나가 path-outside-scope로
 * 오인되지 않게 한다(원장·문서 표기가 둘 다 쓰인다).
 *
 * @param {string} raw - 상대 경로
 * @returns {string} posix, trailing slash 제거
 */
function normalizeScopePath(raw: string): string {
  let p = toPosix(raw).replace(/^\.\//, '');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * changed path가 어떤 task의 affected_paths로도 정당화되지 않으면 true.
 *
 * @param {string} changedPath - governance 제외 변경 경로
 * @param {string[][]} scopes - task별 affected_paths
 * @returns {boolean}
 */
function pathOutsideScope(changedPath: string, scopes: string[][]): boolean {
  const p = normalizeScopePath(changedPath);
  for (const scopePaths of scopes) {
    for (const declared of scopePaths) {
      if (pathsOverlap(p, normalizeScopePath(declared))) return false;
    }
  }
  return true;
}

/**
 * Explain·Quiz·PR에 필요한 finalize 입력을 한 JSON으로 모은다.
 * 문서·Git·원장을 쓰지 않는다. drive면 integration worktree에서 git을 읽고,
 * 깨진 원장은 기존 finalize와 같은 coordinator-ledger로 거절한다.
 * 성공 시 `pr`는 buildPrDraft로 채운다 — agent가 제목·확인 방법을 손으로
 * 조립하지 않게 하기 위함이다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 checkout(보통 main). 원장 경로 해석 기준
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {(args: string[]) => { status: number, stdout: string }} [opts.exec] - `git` 뒤 argv seam
 * @param {Date} [opts.now] - PR 제목 날짜(KST). 기본 `new Date()`
 * @returns {FinalizeDigest | DigestFail} 성공 digest 또는 reason 코드
 */
function prepareFinalizeDigest({
  repoRoot, blueprintDir, exec, now,
}: {
  repoRoot: string;
  blueprintDir: string;
  exec?: GitExec;
  now?: Date;
}): FinalizeDigest | DigestFail {
  const bp = toPosix(blueprintDir);
  const blueprintAbs = path.join(repoRoot, bp);
  // 1. blueprint 경로 자체 — index 유무보다 디렉터리 부재를 먼저 거절한다.
  if (!fs.existsSync(blueprintAbs)) {
    return { ok: false, reason: 'blueprint-not-found' };
  }

  // 2. 원장을 한 번만 읽어 digest·거절이 서로 다른 파일을 보지 않게 한다.
  const ledgerRead = readCoordinatorLedger({ repoRoot, blueprint: bp });
  if (!ledgerRead.ok && ledgerRead.reason === 'unreadable-ledger') {
    return {
      ok: false,
      reason: 'coordinator-ledger',
      code: 'UNREADABLE_LEDGER',
      ledgerFile: ledgerRead.ledgerFile || null,
      integrationPath: ledgerRead.integrationPath || null,
    };
  }

  // drive면 integration worktree가 finalize checkout이다. 문서·git 모두 그쪽.
  const checkoutRoot = ledgerRead.ok && ledgerRead.integrationPath
    && fs.existsSync(ledgerRead.integrationPath)
    ? ledgerRead.integrationPath
    : repoRoot;

  const listing = listTasksDocs({ repoRoot: checkoutRoot, blueprintDir: bp });
  // 3. --yes 뒤 transient 삭제와 같다. task 문서가 하나도 없으면 거절.
  if (!listing.entries.some((entry) => fs.existsSync(path.join(checkoutRoot, entry.tasks.rel)))) {
    return { ok: false, reason: 'task-documents-missing' };
  }

  const ledger = ledgerRead.ok ? ledgerRead.ledger : null;
  const ledgerBase = ledger && typeof (ledger as { base?: unknown }).base === 'string'
    ? (ledger as { base: string }).base
    : null;
  const base = resolveDigestBase({ repoRoot, blueprintDir: bp, ledgerBase });
  if (!base) {
    return { ok: false, reason: 'no-base' };
  }

  const run = typeof exec === 'function'
    ? exec
    : (args: string[]) => defaultExec(checkoutRoot, args);

  const headResult = run(['rev-parse', 'HEAD']);
  if (headResult.status !== 0 || !headResult.stdout.trim()) {
    return { ok: false, reason: 'no-base' };
  }
  const head = headResult.stdout.trim();

  const verified = run(['rev-parse', '--verify', `${base}^{commit}`]);
  if (verified.status !== 0) {
    return { ok: false, reason: 'no-base' };
  }

  // blueprint index — Intent 파싱 실패는 digest 거절이 아니라 빈 intent로 두지 않는다.
  // Intent는 Interface 필수 필드이므로 읽기 실패 시 빈 배열만 허용(파일이 있을 때).
  const bpIndexRel = `${bp}/index.md`;
  const bpIndexAbs = path.join(checkoutRoot, bpIndexRel);
  let bpTitle = '';
  let bpCommitType = 'feat';
  let bpScale: string | null = null;
  let bpEpicId: string | null = null;
  let bpBlueprintId: string | null = null;
  let intent: string[] = [];
  let outOfScope: string[] = [];
  let bpBody = '';
  if (fs.existsSync(bpIndexAbs)) {
    try {
      const doc = readDoc(bpIndexAbs);
      const data = asRecord(doc.data);
      const bouncer = asRecord(data.bouncer);
      bpTitle = typeof data.title === 'string' ? data.title : '';
      bpCommitType = typeof bouncer.commit_type === 'string' ? bouncer.commit_type : 'feat';
      bpScale = typeof bouncer.scale === 'string' ? bouncer.scale : null;
      bpEpicId = typeof bouncer.epic_id === 'string' ? bouncer.epic_id : null;
      bpBlueprintId = typeof bouncer.blueprint_id === 'string'
        ? bouncer.blueprint_id
        : (typeof bouncer.id === 'string' ? bouncer.id : null);
      bpBody = typeof doc.body === 'string' ? doc.body : '';
      outOfScope = parseOutOfScope(bpBody);
      try {
        intent = parseIntentBody(bpBody);
      } catch (_error) {
        // Intent 절 형식 오류(파싱 throw)만 흡수한다. Intent는 digest 필수
        // 필드지만 절이 깨져도 blueprint 자체는 유효하므로 빈 배열로 두고
        // Explain이 원문을 다시 읽게 한다 — no-base/거절 경로로 승격하지 않는다.
        intent = [];
      }
    } catch (_error) {
      // index 파싱 실패는 blueprint-not-found가 아니다 — 디렉터리는 있다.
    }
  }

  let stableBlueprint = '';
  if (bpEpicId && bpBlueprintId) {
    stableBlueprint = `EPIC-${bpEpicId}/BP-${bpBlueprintId}`;
  }

  const coordinator = buildCoordinatorProvenance(ledger, {
    integrationPath: ledgerRead.ok ? ledgerRead.integrationPath : null,
    ledgerFile: ledgerRead.ok ? ledgerRead.ledgerFile : null,
  });

  const ledgerTaskRows: unknown[] = ledger && Array.isArray((ledger as { tasks?: unknown }).tasks)
    ? (ledger as { tasks: unknown[] }).tasks
    : [];
  const actualPathsById = new Map<string, string[] | null>();
  for (const entry of ledgerTaskRows) {
    const row = asRecord(entry);
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) continue;
    const digits = /^(?:TASKS-)?(\d{1,3})$/.exec(id);
    const key = digits ? digits[1].padStart(3, '0') : id;
    // standalone은 actual_paths null. 원장에 키가 있으면 배열(빈 배열 포함).
    actualPathsById.set(key, stringList(row.actualPaths));
  }

  type BuiltTask = {
    digest: TaskDigest;
    affected: string[];
    kind: 'commit' | 'verification' | null;
  };
  const built: BuiltTask[] = [];
  const stableIds: string[] = [];

  for (const entry of listing.entries) {
    const tasksAbs = path.join(checkoutRoot, entry.tasks.rel);
    if (!fs.existsSync(tasksAbs)) continue;
    let data: unknown;
    let body = '';
    try {
      const doc = readDoc(tasksAbs);
      data = doc.data;
      body = typeof doc.body === 'string' ? doc.body : '';
    } catch (_error) {
      // 해당 tasks.md YAML/frontmatter 파싱 실패만 흡수한다. 한 task가 깨져도
      // 나머지 digest는 유지하고, 이 entry는 tasks 목록에서 빠진다 — 전체
      // prepare를 throw로 실패시키지 않는 것이 읽기 전용 수집의 계약이다.
      continue;
    }
    const taskData = asRecord(data);
    const bouncer = asRecord(taskData.bouncer);
    const id = typeof bouncer.id === 'string' ? bouncer.id : `TASKS-${String(entry.number).padStart(3, '0')}`;
    const kind = executionKindOf(bouncer) || entry.executionKind || 'commit';
    let stableId = id;
    try {
      stableId = buildStableProvenance({
        epicId: bouncer.epic_id || bpEpicId,
        blueprintId: bouncer.blueprint_id || bpBlueprintId,
        taskId: id,
      }).task;
    } catch (_error) {
      // frontmatter가 불완전하면 id만 싣고 trailer 매칭은 건너뛴다.
    }
    stableIds.push(stableId);

    const affected = stringList(bouncer.affected_paths);
    const sections = parseTasksSections(body);
    const constraints = typeof sections.constraints === 'string' && sections.constraints.trim()
      ? sections.constraints
      : null;

    const digits = /^(?:TASKS-)?(\d{1,3})$/.exec(id);
    const three = digits ? digits[1].padStart(3, '0') : String(entry.number).padStart(3, '0');
    const hasLedger = actualPathsById.has(three) || actualPathsById.has(id);
    const actualPaths = hasLedger
      ? (actualPathsById.get(three) || actualPathsById.get(id) || [])
      : null;

    const verification = readVerification(path.join(checkoutRoot, entry.verification.rel));
    const reviewRel = entry.review ? entry.review.rel : null;
    const review = kind === 'verification'
      ? null
      : readReview(reviewRel ? path.join(checkoutRoot, reviewRel) : null);

    const commitShaField = normalizeCommitSha(bouncer.commit_sha);

    built.push({
      kind,
      affected,
      digest: {
        stable_id: stableId,
        id,
        title: typeof taskData.title === 'string' ? taskData.title : '',
        execution_kind: kind,
        status: typeof bouncer.status === 'string' ? bouncer.status : '',
        commit: commitShaField
          ? {
            sha: commitShaField,
            sha8: commitShaField,
            source: 'commit_sha',
          }
          : null,
        affected_paths: affected,
        actual_paths: actualPaths,
        verification,
        review,
        constraints,
      },
    });
  }

  const trailerMap = resolveTaskCommits({
    repoRoot: checkoutRoot,
    base,
    head,
    stableIds,
    exec: run,
  });

  for (const item of built) {
    const hit = trailerMap.get(item.digest.stable_id);
    if (hit) {
      item.digest.commit = { sha: hit.sha, sha8: hit.sha8, source: 'trailer' };
      continue;
    }
    // trailer가 없고 commit_sha만 있으면 짧은 hex를 유지한다. 전체 SHA는 없다.
    if (item.digest.commit && item.digest.commit.source === 'commit_sha') {
      const short = item.digest.commit.sha8;
      item.digest.commit = { sha: short, sha8: short, source: 'commit_sha' };
    }
  }

  const nameOnly = run(['diff', '--name-only', `${base}..${head}`]);
  const changedPaths = nameOnly.status === 0
    ? nameOnly.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((p) => toPosix(p))
      .filter((p) => p !== CONTEXT_EXCLUDED.slice(0, -1) && !p.startsWith(CONTEXT_EXCLUDED))
    : [];

  const unified = run(['diff', '-U0', `${base}..${head}`]);
  const symbols = unified.status === 0 ? extractSymbols(unified.stdout) : [];

  const subjectLog = run(['log', `--format=%h%x00%s`, `${base}..${head}`]);
  const commits = subjectLog.status === 0
    ? parseCommitSubjects(subjectLog.stdout).slice(0, COMMIT_LIST_CAP)
    : [];

  const diff = computeDiffSha({
    repoRoot: checkoutRoot,
    base,
    exec: (args) => {
      const r = run(args);
      return { status: r.status, stdout: r.stdout, stderr: '' };
    },
  });

  const unverified: Unverified[] = [];
  let terminalOk = false;
  for (const item of built) {
    const task = item.digest;
    if (item.kind === 'verification') {
      if (task.verification && task.verification.status === 'passed') terminalOk = true;
      continue;
    }
    if (item.kind === 'commit') {
      if (!task.verification || task.verification.status !== 'passed') {
        unverified.push({ kind: 'verification-not-passed', task: task.stable_id });
      }
    }
    if (task.review && task.review.required === false) {
      unverified.push({ kind: 'review-skipped', task: task.stable_id });
    }
    if (task.review) {
      for (const finding of task.review.findings) {
        if (finding.status === 'deferred') {
          unverified.push({
            kind: 'finding-deferred',
            task: task.stable_id,
            detail: finding.note || finding.id,
          });
        } else if (finding.status === 'accepted') {
          unverified.push({
            kind: 'finding-accepted',
            task: task.stable_id,
            detail: finding.note || finding.id,
          });
        }
      }
    }
  }
  if (!terminalOk) {
    unverified.push({ kind: 'terminal-missing' });
  }

  const scopes = built.map((item) => item.affected);
  for (const changed of changedPaths) {
    if (pathOutsideScope(changed, scopes)) {
      unverified.push({ kind: 'path-outside-scope', path: changed });
    }
  }

  const branch = coordinator && coordinator.integrationBranch
    ? coordinator.integrationBranch
    : resolveCheckoutBranch(checkoutRoot);

  // pr는 나머지 digest 필드를 입력으로 쓴다 — 순환 참조를 피하려고 본문을
  // 먼저 조립한 뒤 buildPrDraft에 넘긴다.
  const body = {
    ok: true as const,
    version: 1 as const,
    blueprint: {
      dir: bp,
      stable_id: stableBlueprint,
      title: bpTitle,
      intent,
      commit_type: bpCommitType,
      scale: bpScale,
    },
    range: {
      base,
      head,
      diff_sha: diff.ok ? diff.sha : null,
    },
    git: {
      branch,
      pr_base: resolvePrBase(checkoutRoot),
    },
    tasks: built.map((item) => item.digest),
    changed_paths: changedPaths,
    symbols,
    commits,
    unverified,
    out_of_scope: outOfScope,
    coordinator,
  };

  const config = readConfig(checkoutRoot) ?? {};
  return {
    ...body,
    pr: buildPrDraft(body, {
      now: now instanceof Date ? now : new Date(),
      config,
    }),
  };
}

export = { prepareFinalizeDigest };
