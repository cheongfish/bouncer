// scripts/lib/finalize.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
import paths = require('./paths');
const { toPosix } = paths;
import validate = require('./validate');
const { validateBlueprint, loadBlueprintDocs } = validate;
import current = require('./current');
const { clearCurrent, nextBlueprint } = current;
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;
import scope = require('./scope');
const { makeFinalizeAllowed, isRuntimeArtifact, readCoordinatorLedger } = scope;
import verification = require('./verification');
const { readVerifyCommand, executeVerify } = verification;

import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import validateSections = require('./validate-sections');
const { parseTasksSections } = validateSections;
import templates = require('./templates');
const { normalizeAuthoredLines, parseIntentBody } = templates;

// migrate-ids.ts와 같은 조합: 별도 YAML 직렬화 경로를 새로 만들지 않는다.
// validate↔finalize 순환을 피하려고 scope 헬퍼는 여기 두지 않는다(재수출도 안 함).

type GitApi = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  /** All paths tracked by the index, including clean paths absent from diff. */
  trackedFiles?: () => string[];
  stage: (files: string[]) => void;
  commit: (msg: string) => void;
  /** HEAD의 전체 또는 abbrev 객체 이름. 없으면 commit_sha 기록을 건너뛴다. */
  headSha?: () => string;
};

type TaskCommitEntry = { id: string; sha: string };

// executeVerify의 exec 칸은 execSync 계약이다. 테스트는 종료 코드만
// { ok, exitCode, output }로 주입하므로, 그 형태를 여기서 throw로 바꾼다.
// 주입값을 그대로 exec에 넘기면 실패 객체가 throw되지 않아 성공(exit 0)으로
// 뒤집히고, remainder 커밋이 다시 미검증으로 들어간다.
type VerifyExec = (
  command: string,
  opts: {
    cwd?: string;
    encoding?: string;
    stdio?: unknown;
    maxBuffer?: number;
  },
) => unknown;

function adaptInjectedVerifyExec(verifyExec: VerifyExec): VerifyExec {
  return (command, opts) => {
    const result = verifyExec(command, opts);
    if (
      result
      && typeof result === 'object'
      && 'ok' in result
      && (result as { ok: unknown }).ok === false
    ) {
      const failure = result as { exitCode?: unknown; output?: unknown };
      const error = new Error(
        typeof failure.output === 'string' ? failure.output : 'verify failed',
      ) as Error & { status?: unknown; stdout?: unknown };
      error.status = failure.exitCode;
      error.stdout = failure.output;
      throw error;
    }
    if (result && typeof result === 'object' && 'output' in result) {
      return (result as { output: unknown }).output;
    }
    return result;
  };
}

function codedErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

type DocLeafLike = { data?: unknown; body?: string; rel?: string };
type TaskUnitLike = {
  number?: number | null;
  tasks?: DocLeafLike;
  verification?: DocLeafLike;
  review?: DocLeafLike;
  [key: string]: unknown;
};
type DocsLike = {
  // loadBlueprintDocs는 파싱 실패 시 blueprintIndex를 비울 수 있다. 필수 단언은
  // 소비자 캐스트가 가리던 불일치였고, 런타임은 asRecord(undefined)로 빈 subject 경로를 탄다.
  blueprintIndex?: { data: unknown; body?: string };
  tasks?: DocLeafLike;
  taskUnits?: TaskUnitLike[];
  [key: string]: unknown;
};
type LockTarget = { rel: string; data: unknown; body: string | null };

function asRecord(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

// subject와 body는 프로젝트가 document field에 쓰는 commit convention을 따름;
// 구조만 Bouncer 소유. identifier와 path는 message에 넣지 않음 — blueprint
// 문서와 PR body에 있음.
// Subject: 대상 task title (없으면 blueprint title). Body: task 문서가 저작한
// 배경·의도와 변경 요약. verification title은 실행 증적이지 메시지 저작물이
// 아니므로 사용하지 않는다. 새 필드가 없는 기존 task는 제목만으로 읽는다.
// commit 경로(`bouncer commit`)가 이 빌더를 쓴다. finalize 마감 메시지는
// buildFinalizeCommitMessage — task 문서 필드를 넣지 않는다.
function buildCommitMessage(docs: DocsLike, taskUnit: TaskUnitLike | null | undefined): string {
  const bp = asRecord(docs.blueprintIndex && docs.blueprintIndex.data);
  const bouncer = asRecord(bp.bouncer || {});
  const type = bouncer.commit_type || 'feat';
  const taskTitle = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    ? asRecord(taskUnit.tasks.data).title
    : undefined;
  // 대상 묶음이 없거나 title이 비면 blueprint로 떨어뜨려 빈 subject를 만들지 않음.
  const subjectTitle = (typeof taskTitle === 'string' && taskTitle.trim())
    ? taskTitle.trim()
    : bp.title;
  const taskData = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    ? asRecord(taskUnit.tasks.data)
    : (docs.tasks && docs.tasks.data ? asRecord(docs.tasks.data) : {});
  const taskBouncer = taskData && taskData.bouncer && typeof taskData.bouncer === 'object'
    ? asRecord(taskData.bouncer)
    : {};
  const intent = normalizeAuthoredLines(taskBouncer.commit_intent, 'commit_intent');
  const summary = normalizeAuthoredLines(taskBouncer.commit_summary, 'commit_summary');
  const bodyLines = [...intent, ...summary];
  const body = bodyLines.map((t) => `- ${t}`);
  const lines = [`${type}: ${subjectTitle}`];
  if (body.length) lines.push('', ...body);
  return lines.join('\n');
}

// finalize 마감 커밋: subject와 body 모두 blueprint에서 읽는다. Intent를
// 파싱할 수 없으면 task 일부를 주워 메시지를 만드는 대신 즉시 실패시킨다.
// task title·verification bullet을 넣으면 이미 남긴 task 커밋과 겹친다.
function buildFinalizeCommitMessage(docs: DocsLike): string {
  const bp = asRecord(docs.blueprintIndex && docs.blueprintIndex.data);
  const bouncer = asRecord(bp.bouncer || {});
  const type = bouncer.commit_type || 'feat';
  const intent = parseIntentBody(docs.blueprintIndex && docs.blueprintIndex.body);
  const body = intent.map((t) => `- ${t}`);
  const lines = [`${type}: ${bp.title}`];
  if (body.length) lines.push('', ...body);
  return lines.join('\n');
}

// blueprint index.md를 읽어 잠금 대상인지 판정한다. 파일이 없거나 프론트매터
// 파싱이 깨지면 target.data는 null — closedLockPath/writeClosedLock 양쪽이
// 이를 "잠글 것 없음"으로 취급해 finalize를 실패시키지 않는다.
function resolveLockTarget({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: unknown;
}): LockTarget {
  const rel = `${toPosix(blueprintDir)}/index.md`;
  const abs = path.join(repoRoot, rel);
  if (!fs.existsSync(abs)) return { rel, data: null, body: null };
  try {
    const { data, body } = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
    return { rel, data, body };
  } catch (_e) {
    return { rel, data: null, body: null };
  }
}

// dry-run과 --yes 양쪽에서 같은 판정을 쓴다: 이미 closed거나 대상이 없으면
// null. closed → approved 역전이는 제공하지 않으므로 이 함수는 오직
// "아직 closed가 아님" 방향으로만 경로를 반환한다.
function closedLockPath(target: LockTarget): string | null {
  const bouncer = target.data && typeof target.data === 'object' ? asRecord(target.data).bouncer : null;
  if (!bouncer || typeof bouncer !== 'object' || asRecord(bouncer).status === 'closed') return null;
  return target.rel;
}

// 실제로 파일을 closed로 재기록한다. 호출 전에 closedLockPath가 non-null임을
// 확인해야 함 — target.data가 없으면 여기서도 아무것도 쓰지 않는다.
function writeClosedLock(repoRoot: string, target: LockTarget): void {
  if (!target.data || typeof target.data !== 'object') return;
  asRecord(asRecord(target.data).bouncer).status = 'closed';
  fs.writeFileSync(path.join(repoRoot, target.rel), renderDoc(target.data, target.body as string));
}


/**
 * finalize가 closed 전이와 함께 지울 일회성 문서 경로를 모은다.
 * tasks.md·verification.md·review.md와 (있을 때만) context-review.md가 대상이다.
 * explain.md·index.md는 절대 넣지 않는다.
 * light blueprint는 context-review.md가 없으므로 목록에 나타나지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @returns {string[]} 존재하는 일회성 문서의 posix 상대 경로
 */
function collectTransientRels({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): string[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const rels: string[] = [];
  for (const entry of listing.entries) {
    // verification.md도 task 실행 증적이라 closed 뒤에는 남기지 않는다.
    for (const leaf of ['tasks', 'verification', 'review'] as const) {
      const ref = entry[leaf];
      // verification node는 review leaf를 만들지 않는다. 없는 leaf는 삭제
      // 대상으로 합성하지 않고, 실제 listing이 제공한 문서만 수집한다.
      if (!ref) continue;
      const rel = ref.rel;
      if (fs.existsSync(path.join(repoRoot, rel))) rels.push(rel);
    }
  }
  const contextReviewRel = `${toPosix(blueprintDir)}/context-review.md`;
  if (fs.existsSync(path.join(repoRoot, contextReviewRel))) {
    rels.push(contextReviewRel);
  }
  return rels;
}

/**
 * staged 목록에 경로를 중복 없이 덧붙인다. 삭제 대상이 git 변경에 이미
 * 있어도 한 번만 남긴다.
 *
 * @param {string[]} list - 기존 staged 후보
 * @param {string[]} extra - 합류할 경로
 * @returns {string[]} 합쳐진 목록
 */
function appendUnique(list: string[], extra: string[]): string[] {
  const out = [...list];
  for (const rel of extra) {
    if (!out.includes(rel)) out.push(rel);
  }
  return out;
}

// out-of-scope 판정 뒤에만 부르는 stage 목록 합류. lockPath는 항상
// `${blueprintDir}/index.md`이고 scope.makeAllowed가 blueprintDir 하위 전체를
// 허용하므로 이 경로를 다시 allowed()에 통과시키지 않는다.
function mergeLocked(list: string[], lockPath: string | null): string[] {
  if (!lockPath) return list;
  return list.includes(lockPath) ? list : [...list, lockPath];
}

function realGit(repoRoot: string): GitApi {
  const run = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }) as string;
  const lines = (s: string) => s.split('\n').filter(Boolean);
  return {
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    trackedFiles: () => lines(run(['ls-files', '--cached'])),
    stage: (files: string[]) => { if (files.length) run(['add', '--', ...files]); },
    commit: (msg: string) => { run(['commit', '-m', msg]); },
    headSha: () => run(['rev-parse', 'HEAD']).trim(),
  };
}

/**
 * tasks.md에 적힌 commit_sha를 모아 explain 보존용 task_commits 배열을 만든다.
 * id는 tasks/<NNN> 디렉터리 숫자(3자리). sha 없는·깨진 항목은 건너뛴다.
 */
function collectTaskCommits({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): TaskCommitEntry[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  const out: TaskCommitEntry[] = [];
  for (const entry of listing.entries) {
    if (entry.number == null) continue;
    const abs = path.join(repoRoot, entry.tasks.rel);
    if (!fs.existsSync(abs)) continue;
    let data: unknown;
    try {
      data = readDoc(abs).data;
    } catch (_e) {
      continue;
    }
    const sha = normalizeCommitSha(asRecord(asRecord(data).bouncer).commit_sha);
    if (!sha) continue;
    out.push({ id: String(entry.number).padStart(3, '0'), sha });
  }
  return out;
}

/**
 * explain.md frontmatter에 task_commits를 쓴다. 파일이 없으면 false.
 * 기존 배열은 통째로 교체한다 — finalize가 삭제 직전 스냅샷의 정본이다.
 */
function writeExplainTaskCommits({ repoRoot, blueprintDir, taskCommits }: {
  repoRoot: string;
  blueprintDir: string;
  taskCommits: TaskCommitEntry[];
}): boolean {
  const explainRel = `${toPosix(blueprintDir)}/explain.md`;
  const abs = path.join(repoRoot, explainRel);
  if (!fs.existsSync(abs)) return false;
  const { data, body } = readDoc(abs);
  if (!data || typeof data !== 'object') return false;
  const bouncer = asRecord(asRecord(data).bouncer);
  bouncer.task_commits = taskCommits.map((entry) => ({ id: entry.id, sha: entry.sha }));
  fs.writeFileSync(abs, renderDoc(data, body));
  return true;
}

/**
 * task 문서에서 장기 보존할 설계 절만 렌더링한다.
 * parseTasksSections가 반환한 본문을 그대로 사용해 작성자가 나눈 줄바꿈을
 * 보존하고, verification·review·checklist 같은 실행 문서는 이 경로에 넣지 않는다.
 */
function buildTaskContext(taskUnits: TaskUnitLike[] | undefined): string {
  const units = (Array.isArray(taskUnits) ? taskUnits : [])
    .filter((unit) => unit && unit.tasks && typeof unit.tasks.body === 'string')
    .slice()
    .sort((a, b) => (typeof a.number === 'number' ? a.number : Infinity)
      - (typeof b.number === 'number' ? b.number : Infinity));
  const rendered: string[] = [];
  for (const unit of units) {
    const sections = parseTasksSections(unit.tasks && unit.tasks.body);
    const selected = [
      ['Goal & intent', sections.goal],
      ['Interface', sections.interface],
      ['Do not touch', sections.doNotTouch],
    ].filter(([, body]) => typeof body === 'string' && body.trim()) as Array<[string, string]>;
    if (!selected.length) continue;
    const number = typeof unit.number === 'number'
      ? String(unit.number).padStart(3, '0')
      : 'unknown';
    rendered.push(
      [`### Task ${number}`, ...selected.flatMap(([heading, body]) => [
        `#### ${heading}`,
        body,
      ])].join('\n\n'),
    );
  }
  return rendered.length ? `## Tasks\n\n${rendered.join('\n\n')}\n` : '';
}

function replaceTaskContext(body: string, taskContext: string): string {
  if (!taskContext) return body;
  const lines = body.split('\n');
  const start = lines.findIndex((line) => /^##\s+Tasks\s*$/i.test(line.trim()));
  if (start < 0) return `${body.replace(/\s*$/, '')}\n\n${taskContext}`;
  let end = start + 1;
  while (end < lines.length && !/^##\s+\S/.test(lines[end].trim())) end += 1;
  return [...lines.slice(0, start), taskContext.trimEnd(), ...lines.slice(end)].join('\n');
}

function writeExplainTaskContext({ repoRoot, blueprintDir, taskContext }: {
  repoRoot: string;
  blueprintDir: string;
  taskContext: string;
}): boolean {
  if (!taskContext) return false;
  const explainRel = `${toPosix(blueprintDir)}/explain.md`;
  const abs = path.join(repoRoot, explainRel);
  if (!fs.existsSync(abs)) return false;
  const { data, body } = readDoc(abs);
  if (!data || typeof data !== 'object' || typeof body !== 'string') return false;
  fs.writeFileSync(abs, renderDoc(data, replaceTaskContext(body, taskContext)));
  return true;
}

type LedgerTaskLike = {
  id?: unknown; status?: unknown; sha?: unknown; workerPath?: unknown;
  scope?: { revision?: unknown; paths?: unknown } | null;
  actualPaths?: unknown; decisions?: unknown;
};
type CoordinatorLedgerLike = {
  base?: unknown; integrationHead?: unknown; revision?: unknown;
  tasks?: unknown; decisions?: unknown;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function stringList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((entry): entry is string => typeof entry === 'string' && entry !== '');
}

/**
 * coordinator 원장을 explain 기록과 cleanup 목록이 함께 쓰는 한 장으로 접는다.
 *
 * 원장은 삭제되는 integration worktree 안에 있어 blueprint가 닫히면 사라진다.
 * 그래서 finalize가 남길 값(어느 worker가 어떤 SHA로 무엇을 실제로 바꿨는지,
 * scope가 몇 번 개정됐는지)과 정리 대상 worktree 목록을 여기서 한 번에 뽑는다.
 * 원장이 없으면 위임 실행이 아니므로 null — 빈 객체를 돌려주면 호출부가
 * "coordinator 실행인데 기록이 비었다"와 구분하지 못한다.
 */
function buildCoordinatorProvenance(
  ledger: CoordinatorLedgerLike | null | undefined,
  { integrationPath = null, ledgerFile = null }:
    { integrationPath?: string | null; ledgerFile?: string | null } = {},
) {
  if (!ledger) return null;
  const tasks = (Array.isArray(ledger.tasks) ? ledger.tasks : [])
    .filter((entry): entry is LedgerTaskLike => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      // id도 이웃 필드와 같은 정규화를 거친다. String()으로 감싸면 id가 없는
      // 항목이 문자열 "undefined"가 되어 explain frontmatter에 그대로 박히고,
      // 원장이 사라진 뒤 draft-pr이 그것을 실재하는 task id로 읽는다.
      id: stringOrNull(entry.id),
      status: typeof entry.status === 'string' ? entry.status : 'pending',
      sha: stringOrNull(entry.sha),
      worktree: stringOrNull(entry.workerPath),
      scopeRevision: entry.scope ? stringOrNull(entry.scope.revision) : null,
      paths: entry.scope ? stringList(entry.scope.paths) : [],
      actualPaths: stringList(entry.actualPaths),
      decisions: Array.isArray(entry.decisions) ? entry.decisions : [],
    }));
  return {
    status: 'ok' as const,
    // 성공 경로도 원장 경로를 싣는다. unreadable 분기에만 채우면 소비자가
    // `ledgerFile: null`을 "원장이 없다"와 "원장은 있는데 알려주지 않았다"로
    // 구분하지 못한다.
    ledgerFile,
    base: stringOrNull(ledger.base),
    integrationHead: stringOrNull(ledger.integrationHead),
    revision: stringOrNull(ledger.revision),
    integrationPath,
    tasks,
    decisions: Array.isArray(ledger.decisions) ? ledger.decisions : [],
    // cleanup 목록: integration이 먼저고, 할당된 worker worktree가 뒤따른다.
    // payload의 top-level `worktrees`는 이 목록의 별칭이다 — 정리 계약(SKILL
    // step 5, cleanup-handoff.md)이 읽는 안정된 자리이고, 여기 중첩된 값은
    // explain frontmatter에 남는 기록이다. 한쪽을 옮기면 다른 쪽도 옮긴다.
    worktrees: [
      ...(integrationPath ? [integrationPath] : []),
      ...tasks.map((task) => task.worktree).filter((p): p is string => Boolean(p)),
    ],
  };
}

type CoordinatorProvenance = ReturnType<typeof buildCoordinatorProvenance>;
type UnreadableProvenance = {
  status: 'unreadable'; ledgerFile: string | null; integrationPath: string | null;
  base: null; integrationHead: null; revision: null;
  tasks: never[]; decisions: never[]; worktrees: never[];
};

/**
 * 저장소에서 원장을 찾아 provenance로 접는다.
 *
 * 원장이 아예 없으면 위임 실행이 아니므로 null이다. 읽을 수는 있으나 깨진
 * 원장은 null이 아니다 — null로 접으면 `coordinator: null`, `worktrees: []`가
 * 되어 비-drive finalize와 구분되지 않고, 검증되지 않은 fan-in이 완료로
 * 기록된다. current의 `coordinatorSnapshot`과 같은 모양으로 `status`와 고칠
 * 파일 경로를 실어 호출부가 멈출 수 있게 한다.
 */
function collectCoordinatorProvenance({ repoRoot, blueprintDir }: {
  repoRoot: string; blueprintDir: string;
}): CoordinatorProvenance | UnreadableProvenance {
  const read = readCoordinatorLedger({ repoRoot, blueprint: blueprintDir });
  if (!read.ok) {
    if (read.reason !== 'unreadable-ledger') return null;
    return {
      status: 'unreadable',
      ledgerFile: read.ledgerFile || null,
      integrationPath: read.integrationPath || null,
      base: null,
      integrationHead: null,
      revision: null,
      tasks: [],
      decisions: [],
      worktrees: [],
    };
  }
  return buildCoordinatorProvenance(read.ledger, {
    integrationPath: read.integrationPath,
    ledgerFile: read.ledgerFile,
  });
}

/**
 * explain.md frontmatter에 drive provenance를 남긴다. task_commits와 같은
 * 이유로 삭제 직전에 쓴다 — 원장이 사라진 뒤 PR과 리뷰가 읽을 유일한 출처다.
 */
function writeExplainCoordinator({ repoRoot, blueprintDir, provenance }: {
  repoRoot: string; blueprintDir: string; provenance: CoordinatorProvenance;
}): boolean {
  if (!provenance) return false;
  const abs = path.join(repoRoot, `${toPosix(blueprintDir)}/explain.md`);
  if (!fs.existsSync(abs)) return false;
  const { data, body } = readDoc(abs);
  if (!data || typeof data !== 'object') return false;
  const bouncer = asRecord(asRecord(data).bouncer);
  // frontmatter는 snake_case 정본이다. payload의 camelCase를 그대로 쓰면
  // 같은 문서 안에서 두 표기가 섞인다.
  bouncer.coordinator = {
    base: provenance.base,
    integration_head: provenance.integrationHead,
    revision: provenance.revision,
    worktrees: provenance.worktrees,
    tasks: provenance.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      sha: task.sha,
      scope_revision: task.scopeRevision,
      paths: task.paths,
      actual_paths: task.actualPaths,
    })),
    decisions: provenance.decisions,
  };
  fs.writeFileSync(abs, renderDoc(data, body));
  return true;
}

function finalize({
  repoRoot, blueprintDir, yes = false, git, clearPointer = clearCurrent,
  next = nextBlueprint, verifyExec,
}: {
  repoRoot: string;
  blueprintDir: string;
  yes?: boolean;
  git?: GitApi;
  clearPointer?: (opts: { repoRoot: string }) => boolean;
  next?: (opts: { repoRoot: string; blueprintDir: unknown }) => unknown;
  verifyExec?: VerifyExec;
}) {
  const gitApi = git || realGit(repoRoot);

  const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
  if (!v.ok) return { ok: false, reason: 'validate', failures: v.failures };

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  const affectedPaths = docs.tasks && asRecord(docs.tasks.data).bouncer
    ? asRecord(asRecord(docs.tasks.data).bouncer).affected_paths : [];
  const allowed = makeFinalizeAllowed({ repoRoot, affectedPaths, blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  // 범위 권한은 Git이 보고한 전체 후보로 판정한다. 존재 확인과 staging
  // 후보 축소는 아래에서 별도로 처리해 makeAllowed 권한을 완화하지 않는다.
  const allCandidates = [...new Set([...changed, ...untracked])]
    .filter((f) => !isRuntimeArtifact(f));
  const violations = allCandidates.filter((f) => !allowed(f));
  if (violations.length) return { ok: false, reason: 'out-of-scope', violations };

  // subject는 blueprint title이고 body는 blueprint 본문의 `## Intent` 정본이다.
  // task 스캔이나 verification title을 섞으면 finalize가 task authored 필드를
  // 재사용하게 되므로, 실행 경로도 buildFinalizeCommitMessage와 같은 출처를 쓴다.
  const commitMessage = buildFinalizeCommitMessage(docs);
  // 위임 실행이면 원장이 이 마감의 provenance 정본이다. dry-run과 --yes가 같은
  // 값을 보고해야 사용자가 미리 본 정리 대상과 실제 정리 대상이 갈라지지 않는다.
  const collected = collectCoordinatorProvenance({ repoRoot, blueprintDir });
  // 깨진 원장으로는 fan-in이 끝났는지 판정할 수 없다. 여기서 멈추지 않으면
  // 빈 provenance와 빈 정리 목록으로 blueprint가 닫혀, 통합되지 않은 task가
  // 완료로 기록되고 복구에 필요한 worktree가 목록에서 사라진다.
  if (collected && collected.status === 'unreadable') {
    return {
      ok: false,
      reason: 'coordinator-ledger',
      code: 'UNREADABLE_LEDGER',
      ledgerFile: collected.ledgerFile,
      integrationPath: collected.integrationPath,
      coordinator: collected,
    };
  }
  const coordinator = collected;
  // top-level `worktrees`는 cleanup이 읽는 안정된 자리다(위 buildCoordinatorProvenance 주석).
  const worktrees = coordinator ? coordinator.worktrees : [];
  // next 후보 계산이 finalize를 깨면 안 됨: next()가 throw하면 빈 handoff
  // 형태로 뭉개 ok/exit는 commit 작업에만 묶임.
  const computeNext = () => {
    try {
      return next({ repoRoot, blueprintDir });
    } catch (_e) {
      return { next: null, remaining: [], sameEpicPending: [] };
    }
  };

  // out-of-scope 검사(위)를 통과한 뒤에만 잠금 판정을 본다 — 위반이 있으면
  // 문서를 건드리지 않고 이미 return한 상태.
  const lockTarget = resolveLockTarget({ repoRoot, blueprintDir });
  const lockPath = closedLockPath(lockTarget);
  // 잠금 경로는 파일에 쓰기 전에 staged에 합류시킨다. 「커밋할 것이 있을
  // 때만 검증」과 「잠금 전에 검증」을 같이 지키려면, 예전처럼
  // writeClosedLock을 여기서 먼저 부르면 안 된다 — 실패해도 blueprint는
  // closed인데 커밋만 없는 상태가 남고, 재실행은 already-closed로 잠금만
  // 건너뛰어 remainder가 다시 미검증으로 들어간다.
  // 이번에 closed로 전이할 때만 일회성 문서를 지운다.
  // 이미 closed면 lockPath가 null — 보존 문서를 소급 삭제하지 않는다.
  const transientRels = lockPath
    ? collectTransientRels({ repoRoot, blueprintDir })
    : [];
  // `diff --name-only HEAD` omits an unchanged tracked transient document.
  // Keep the diff list for scope/staging candidates, but use the index inventory
  // to decide whether an unlinked transient path must be staged as a deletion.
  const tracked = new Set(gitApi.trackedFiles ? gitApi.trackedFiles() : changed);
  // 추적 파일의 삭제는 stage해야 하지만, untracked 파일은 삭제만 하면 된다.
  // 이미 존재하지 않는 untracked 경로는 git add가 실패하므로 후보에서 제외한다.
  const transientSet = new Set(transientRels);
  const existingUntracked = untracked.filter((f) => (
    typeof f === 'string' && fs.existsSync(path.resolve(repoRoot, f))
  ));
  const stageCandidates = [...new Set([...changed, ...existingUntracked])]
    .filter((f) => !isRuntimeArtifact(f));
  const all = stageCandidates.filter((f) => (
    !transientSet.has(f) || tracked.has(f)
  ));
  const trackedTransient = transientRels.filter((rel) => tracked.has(rel));
  // dry-run도 같은 목록을 보고해 "무엇이 지워질지"를 미리 보여 준다.
  const staged = mergeLocked(appendUnique(all, trackedTransient), lockPath);

  // dry-run: 쓰지 않고 "쓰게 될" 경로만 closed/staged에 반영해 보고한다.
  // explain.md는 task_commits 기록으로 remainder에 포함될 수 있다.
  const explainRel = `${toPosix(blueprintDir)}/explain.md`;
  const dryStaged = (lockPath && fs.existsSync(path.join(repoRoot, explainRel)))
    ? appendUnique(staged, [explainRel])
    : staged;

  if (!yes) {
    // 읽기 전용 보고가 config.verify 전체를 끌고 오면 안 되므로 검증도 생략.
    return {
      ok: true,
      dryRun: true,
      staged: dryStaged,
      commitMessage,
      next: computeNext(),
      closed: lockPath,
      coordinator,
      worktrees,
    };
  }

  // 빈 커밋 금지: remainder도 잠금도 없으면 stage/commit을 건너뛰고
  // 포인터만 비운다. task 커밋은 003 `bouncer commit`이 이미 끝냈다는 전제.
  // 스테이징 대상이 없으면 검증할 커밋도 없다.
  if (staged.length === 0) {
    const pointerCleared = clearPointer({ repoRoot });
    return {
      ok: true,
      committed: false,
      staged: [],
      commitMessage,
      pointerCleared,
      next: computeNext(),
      closed: lockPath,
      coordinator,
      worktrees,
    };
  }

  // remainder가 없어도 잠금만으로 커밋이 생기면 그 커밋도 저장소를 바꾼다.
  // 예외를 두면 「어떤 finalize 커밋은 검증되지 않는다」가 된다.
  // 해석 오류는 throw하지 않는다 — cmdFinalize/runCli에 최상위 처리기가
  // 없어 스택이 JSON 결과를 밀어내고 종료 코드 계약(0/1)이 깨진다.
  let command: string;
  try {
    command = readVerifyCommand(repoRoot, blueprintDir);
  } catch (error) {
    const code = codedErrorCode(error);
    if (code) {
      return { ok: false, reason: 'verify', code, command: null, exitCode: null };
    }
    throw error;
  }
  const execution = executeVerify(command, {
    cwd: repoRoot,
    ...(verifyExec ? { exec: adaptInjectedVerifyExec(verifyExec) } : {}),
  });
  if (!execution.ok) {
    return {
      ok: false,
      reason: 'verify',
      code: 'VERIFY_FAILED',
      command,
      exitCode: execution.exitCode,
    };
  }

  // 검증 성공 뒤에만 삭제·closed 전이·stage를 수행한다.
  // stage/commit이 throw하면 삭제 전 바이트와 approved 상태로 되돌린 뒤
  // 예외를 그대로 전파한다 — 반만 지워진 closed를 남기지 않기 위함.
  const snapshots = transientRels.map((rel) => {
    const abs = path.join(repoRoot, rel);
    return { rel, abs, content: fs.readFileSync(abs) };
  });
  const indexAbs = lockPath ? path.join(repoRoot, lockPath) : null;
  const indexBefore = indexAbs && fs.existsSync(indexAbs)
    ? fs.readFileSync(indexAbs)
    : null;
  // task_commits는 삭제 전에 tasks.md에서 읽어 explain에 옮긴다.
  // explain 스냅샷은 쓰기 실패 복구용 — 소급 편집이 아니라 이번 전이의 일부다.
  const explainAbs = path.join(repoRoot, explainRel);
  const explainBefore = fs.existsSync(explainAbs)
    ? fs.readFileSync(explainAbs)
    : null;
  const taskCommits = lockPath
    ? collectTaskCommits({ repoRoot, blueprintDir })
    : [];
  const taskContext = lockPath ? buildTaskContext(docs.taskUnits) : '';

  const restoreTransient = () => {
    for (const snap of snapshots) {
      fs.mkdirSync(path.dirname(snap.abs), { recursive: true });
      fs.writeFileSync(snap.abs, snap.content);
    }
    if (indexAbs && indexBefore) fs.writeFileSync(indexAbs, indexBefore);
    if (explainAbs && explainBefore) fs.writeFileSync(explainAbs, explainBefore);
  };

  const stageList = (lockPath && explainBefore)
    ? appendUnique(staged, [explainRel])
    : staged;

  try {
    if (lockPath && explainBefore) {
      writeExplainTaskCommits({ repoRoot, blueprintDir, taskCommits });
      writeExplainTaskContext({ repoRoot, blueprintDir, taskContext });
      writeExplainCoordinator({ repoRoot, blueprintDir, provenance: coordinator });
    }
    for (const snap of snapshots) fs.unlinkSync(snap.abs);
    // 이미 closed면 lockPath가 null이라 여기서 아무것도 쓰지 않는다.
    if (lockPath) writeClosedLock(repoRoot, lockTarget);
    gitApi.stage(stageList);
    gitApi.commit(commitMessage);
  } catch (error) {
    restoreTransient();
    throw error;
  }

  // blueprint는 끝남. pointer를 남기면 commit guard가 이후 모든 commit에
  // 이 blueprint의 affected_paths를 계속 강제함.
  const pointerCleared = clearPointer({ repoRoot });
  return {
    ok: true,
    committed: true,
    staged: stageList,
    commitMessage,
    pointerCleared,
    next: computeNext(),
    closed: lockPath,
    taskCommits,
    coordinator,
    worktrees,
  };
}

export = {
  buildCommitMessage, buildFinalizeCommitMessage, realGit, finalize,
  buildTaskContext, collectTaskCommits, writeExplainTaskCommits, writeExplainTaskContext,
  buildCoordinatorProvenance, collectCoordinatorProvenance, writeExplainCoordinator,
};
