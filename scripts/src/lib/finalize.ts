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
const { clearCurrent, nextBlueprint, readCurrent } = current;
import taskCommits = require('./task-commits');
const { resolveTaskCommits } = taskCommits;
import frontmatter = require('./frontmatter');
const { parseFrontmatter, readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import commitSha = require('./commit-sha');
const { normalizeCommitSha, buildStableProvenance } = commitSha;
import scope = require('./scope');
const { makeFinalizeAllowed, isRuntimeArtifact, readCoordinatorLedger } = scope;
import verification = require('./verification');
const { readVerifyCommand, executeVerify } = verification;

import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import validateSections = require('./validate-sections');
const { parseTasksSections } = validateSections;
import templates = require('./templates');
import preCommitHook = require('./pre-commit-hook');
const { internalCommitEnv } = preCommitHook;
// finalize → current → coordinator 경로가 이미 있으므로 직접 import해도 새 순환은
// 없다(coordinator의 import 닫힘에는 finalize가 없다).
import coordinatorLib = require('./coordinator');
// seed-worktree는 paths·layout·scope만 import하므로 finalize를 끌어와 순환을 만들지 않는다.
// 설치 판정(lockfile·marker)과 npm ci 인자를 seed/fan-in과 한 구현으로 공유하려는 import.
import seedWorktree = require('./seed-worktree');
const { prepareDependencies } = seedWorktree;
const { readBouncerBlock } = coordinatorLib;
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

type TaskCommitEntry = { task: string; sha: string; intent_anchor: string };
type TrailerCommit = { sha?: string; sha8: string };
const STABLE_TASK_RE = /^EPIC-(\d{3})\/BP-(\d{3})\/TASK-(\d{3})$/;

/**
 * tasks.md frontmatter에서 stable Task ID를 만든다.
 * epic_id·blueprint_id·id가 정본이 아니면 null — 잘못된 값을 패딩하지 않는다.
 *
 * @param {unknown} data - tasks.md frontmatter 루트
 * @returns {string | null} `EPIC-ddd/BP-ddd/TASK-ddd` 또는 불가 시 null
 */
function stableIdFromTaskData(data: unknown): string | null {
  // data·bouncer 부재는 legacy `### Task NNN` 폴백이다. asRecord만 쓰면
  // undefined.bouncer에서 throw해 retention·순수 테스트 fixture까지 깨진다.
  if (!data || typeof data !== 'object') return null;
  const bouncer = asRecord(asRecord(data).bouncer);
  if (!bouncer || typeof bouncer !== 'object') return null;
  try {
    return buildStableProvenance({
      epicId: bouncer.epic_id,
      blueprintId: bouncer.blueprint_id,
      taskId: bouncer.id,
    }).task;
  } catch (error) {
    // 세 자리·TASKS-NNN 계약 위반만 흡수한다. 그 외는 호출부에서 본다.
    if (
      error instanceof Error
      && /must be a three-digit id|must be TASKS-NNN/.test(error.message)
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * trailer 해석용 base를 고른다. 원장 base가 정본이고, 없으면 같은 blueprint pointer.
 * 해석 실패는 null — finalize를 막지 않고 commit_sha 폴백으로 간다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {string | null | undefined} opts.ledgerBase - 원장 base
 * @returns {string | null}
 */
function resolveFinalizeTrailerBase({
  repoRoot, blueprintDir, ledgerBase,
}: {
  repoRoot: string;
  blueprintDir: string;
  ledgerBase: string | null | undefined;
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
    // CURRENT_AMBIGUOUS 등은 trailer 생략과 같다 — finalize를 실패시키지 않는다.
  }
  return null;
}

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
// 구조만 Bouncer 소유. identifier와 path는 제목·본문에 넣지 않음 — blueprint
// 문서와 PR body에 있다. 기계가 읽는 식별자는 메시지 끝 Git trailer 두 줄로만
// 붙인다. 본문에 섞으면 제목 규약과 충돌하고, trailer가 아니면 cherry-pick·
// explain 소비자가 같은 키를 찾지 못한다.
// Subject: 대상 task title (없으면 blueprint title). Body: task 문서가 저작한
// 배경·의도와 변경 요약. verification title은 실행 증적이지 메시지 저작물이
// 아니므로 사용하지 않는다. 새 필드가 없는 기존 task는 제목만으로 읽는다.
// commit 경로(`bouncer commit`)가 이 빌더를 쓴다. finalize 마감 메시지는
// buildFinalizeCommitMessage — task 문서 필드를 넣지 않는다.
function authoredContainsBouncerTrailer(lines: string[]): boolean {
  // Git trailer는 줄 앞의 정확한 키다. 문장 한가운데 언급이 아니라 저작 필드가
  // 이미 trailer 한 줄을 들고 있으면, 생성기가 같은 키를 또 붙여 중복이 된다.
  return lines.some((line) => /^(?:Bouncer-Task|Bouncer-Intent)\s*:/.test(line));
}

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
  // 저작 필드가 이미 Bouncer trailer를 들고 있으면 한 줄을 더 붙여 키가 두 번
  // 나온다. Git trailer는 키당 한 줄이므로 중복을 지우지 않고 생성을 거절한다.
  if (authoredContainsBouncerTrailer(bodyLines)) {
    throw new Error(
      'commit message authored fields already contain a Bouncer-Task or Bouncer-Intent trailer',
    );
  }
  const provenance = buildStableProvenance({
    epicId: taskBouncer.epic_id,
    blueprintId: taskBouncer.blueprint_id,
    taskId: taskBouncer.id,
  });
  const body = bodyLines.map((t) => `- ${t}`);
  const lines = [`${type}: ${subjectTitle}`];
  if (body.length) lines.push('', ...body);
  // trailer는 본문과 빈 줄로 구분한다. subject만 있어도 같은 구분자를 써서
  // Git이 제목을 trailer 블록으로 붙이지 않게 한다.
  lines.push('', ...provenance.trailers);
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
/**
 * closed 전이에 지울 일회성 문서 경로를 모은다.
 * task leaf와 context-review는 항상 대상이다. 루트 review.md는
 * `review_scope: blueprint`일 때만 넣는다 — 구형 blueprint의 루트
 * 파일은 사람이 둔 증적이라 마감이 지우면 안 된다.
 *
 * @param {object} opts - 저장소와 blueprint 경로
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @returns {string[]} 존재하는 일회성 문서의 상대 경로
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
  const bp = toPosix(blueprintDir);
  const contextReviewRel = `${bp}/context-review.md`;
  if (fs.existsSync(path.join(repoRoot, contextReviewRel))) {
    rels.push(contextReviewRel);
  }
  if (isBlueprintReviewScopeAt(repoRoot, bp)) {
    const rootReviewRel = `${bp}/review.md`;
    if (fs.existsSync(path.join(repoRoot, rootReviewRel))) {
      rels.push(rootReviewRel);
    }
  }
  return rels;
}

/**
 * blueprint index의 `review_scope === 'blueprint'`만 모드로 본다.
 * 파일 부재·파싱 실패는 구형 계약(지우지 않음)으로 접는다 — 모드로
 * 오인하면 남겨야 할 루트 리뷰를 지운다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {boolean} 모드이면 true
 */
function isBlueprintReviewScopeAt(repoRoot: string, blueprintDir: string): boolean {
  const abs = path.join(repoRoot, `${toPosix(blueprintDir)}/index.md`);
  if (!fs.existsSync(abs)) return false;
  try {
    const { data } = readDoc(abs);
    const bouncer = asRecord(asRecord(data).bouncer);
    return bouncer.review_scope === 'blueprint';
  } catch (error) {
    // YAML/frontmatter 파싱 실패만 흡수한다. 권한 오류는 숨기지 않는다.
    if (error instanceof Error && (
      error.name === 'YAMLException' || /frontmatter|YAML/i.test(error.message)
    )) {
      return false;
    }
    throw error;
  }
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
    commit: (msg: string) => {
      // remainder 커밋도 G17 이후라 hook이 인덱스를 다시 보면 순환 차단한다.
      execFileSync('git', ['commit', '-m', msg], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: internalCommitEnv(),
      });
    },
    headSha: () => run(['rev-parse', 'HEAD']).trim(),
  };
}

/**
 * explain.md frontmatter의 Epic·Blueprint 번호를 읽는다.
 * task_commits 행의 stable ref가 이 부모와 같은 번호인지 대조하기 위해서다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @returns {{epicId: string, blueprintId: string} | null} 읽을 수 없으면 null
 */
function explainParentIds({ repoRoot, blueprintDir }: {
  repoRoot: string;
  blueprintDir: string;
}): { epicId: string; blueprintId: string } | null {
  const abs = path.join(repoRoot, `${toPosix(blueprintDir)}/explain.md`);
  if (!fs.existsSync(abs)) return null;
  let data: unknown;
  try {
    data = readDoc(abs).data;
  } catch (_e) {
    // 깨진 YAML·frontmatter만 흡수한다. 부모 ID를 경로에서 추측하면 다른
    // Blueprint의 커밋이 이 Explain에 실릴 수 있다. collectTaskCommits는
    // null이면 행을 만들지 않고, writeExplainTaskCommits도 같은 부모 대조로
    // 직렬화를 거절한다.
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const bouncer = asRecord(asRecord(data).bouncer);
  const epicId = bouncer.epic_id;
  const blueprintId = bouncer.blueprint_id;
  if (typeof epicId !== 'string' || typeof blueprintId !== 'string') return null;
  return { epicId, blueprintId };
}

/**
 * tasks.md의 commit_sha와 stable Task ID를 모아 explain 보존용 task_commits를 만든다.
 * 새 행은 `{ task, sha, intent_anchor }`만 쓴다. sha가 없거나 짧은 hex가 아니면 건너뛴다.
 * `commits`에 trailer로 찾은 SHA가 있으면 그 sha8을 쓰고, 없을 때만 commit_sha로 폴백한다.
 * stable ID가 정본이 아니거나 Explain 부모 ID를 못 읽거나 Epic·Blueprint가
 * 다르면 행을 만들지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {Map<string, TrailerCommit>} [opts.commits] - resolveTaskCommits 결과. 있으면 trailer 우선
 * @returns {TaskCommitEntry[]} 쓸 수 있는 provenance 행. 없으면 빈 배열
 */
function collectTaskCommits({ repoRoot, blueprintDir, commits }: {
  repoRoot: string;
  blueprintDir: string;
  commits?: Map<string, TrailerCommit>;
}): TaskCommitEntry[] {
  const parent = explainParentIds({ repoRoot, blueprintDir });
  // 부모 번호를 못 읽으면 행을 만들지 않는다. 경로에서 채우면 다른
  // Blueprint SHA가 이 Explain에 남는다.
  if (!parent) return [];
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
    const bouncer = asRecord(asRecord(data).bouncer);
    let provenance: ReturnType<typeof buildStableProvenance>;
    try {
      provenance = buildStableProvenance({
        epicId: bouncer.epic_id,
        blueprintId: bouncer.blueprint_id,
        taskId: bouncer.id,
      });
    } catch (error) {
      // epic_id·blueprint_id가 \d{3}이 아니거나 id가 TASKS-NNN이 아닌 경우만
      // 건너뛴다. 잘못된 값을 패딩하면 다른 Blueprint 커밋과 같은 ref가 된다.
      if (
        error instanceof Error
        && /must be a three-digit id|must be TASKS-NNN/.test(error.message)
      ) {
        continue;
      }
      throw error;
    }
    const parts = STABLE_TASK_RE.exec(provenance.task);
    // helper가 만든 문자열만 온다. 매칭 실패는 계약 파손이라 추측해서 채우지 않는다.
    if (!parts) continue;
    if (parts[1] !== parent.epicId || parts[2] !== parent.blueprintId) {
      continue;
    }
    // trailer SHA가 있으면 worker worktree의 commit_sha보다 우선한다 —
    // integration에 cherry-pick된 도달 가능 commit을 Explain이 가리키게 하기 위함.
    const trailer = commits && commits.get(provenance.task);
    const sha = trailer
      ? normalizeCommitSha(trailer.sha8 || trailer.sha)
      : normalizeCommitSha(bouncer.commit_sha);
    if (!sha) continue;
    out.push({
      task: provenance.task,
      sha,
      intent_anchor: `task-${parts[3]}`,
    });
  }
  return out;
}

/**
 * explain.md frontmatter에 task_commits를 쓴다. 파일이 없으면 false.
 * 기존 배열은 통째로 교체한다 — finalize가 삭제 직전 스냅샷의 정본이다.
 * 직렬화는 `{ task, sha, intent_anchor }`만 남긴다. legacy `{ id, sha }`는 쓰지 않는다.
 * 부모 Epic·Blueprint를 못 읽거나 행의 stable ref가 그 번호와 다르면 그 행은
 * 쓰지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {TaskCommitEntry[]} opts.taskCommits - collectTaskCommits 결과
 * @returns {boolean} 썼으면 true, explain 부재·파싱 실패면 false
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
  const epicId = bouncer.epic_id;
  const blueprintId = bouncer.blueprint_id;
  // collectTaskCommits가 걸러도 직접 호출이면 다른 Epic·Blueprint 행이
  // 들어온다. 부모 번호를 못 읽거나 다르면 새 행을 남기지 않는다.
  if (typeof epicId !== 'string' || typeof blueprintId !== 'string') {
    bouncer.task_commits = [];
  } else {
    bouncer.task_commits = taskCommits.flatMap((entry) => {
      const parts = STABLE_TASK_RE.exec(entry.task);
      if (!parts || parts[1] !== epicId || parts[2] !== blueprintId) return [];
      return [{
        task: entry.task,
        sha: entry.sha,
        intent_anchor: entry.intent_anchor,
      }];
    });
  }
  fs.writeFileSync(abs, renderDoc(data, body));
  return true;
}

/**
 * task 문서에서 장기 보존할 설계 절만 렌더링한다.
 * parseTasksSections가 반환한 본문을 그대로 사용해 작성자가 나눈 줄바꿈을
 * 보존한다. Do not touch·Checklist·verification·review는 실행 시점 범위
 * 통제·절차라서 여기 넣지 않는다 — Git history와 삭제된 task 원문이 정본이다.
 * Current/Target은 값이 있을 때만 넣어 legacy task에 두 절을 요구하지 않는다.
 * 제목은 frontmatter로 stable ID를 만들 수 있으면 `### EPIC-…/BP-…/TASK-…`이고,
 * `commits`에 그 ID의 sha8이 있으면 ` · \`sha8\``을 붙인다. 못 만들면 기존
 * `### Task NNN`으로 폴백한다.
 *
 * @param {TaskUnitLike[] | undefined} taskUnits - Blueprint의 task 묶음
 * @param {Map<string, TrailerCommit>} [commits] - resolveTaskCommits 결과. 선택
 * @returns {string} Explain `## Tasks` 본문. 장기 절이 없으면 빈 문자열
 */
function buildTaskContext(
  taskUnits: TaskUnitLike[] | undefined,
  commits?: Map<string, TrailerCommit>,
): string {
  const units = (Array.isArray(taskUnits) ? taskUnits : [])
    .filter((unit) => unit && unit.tasks && typeof unit.tasks.body === 'string')
    .slice()
    .sort((a, b) => (typeof a.number === 'number' ? a.number : Infinity)
      - (typeof b.number === 'number' ? b.number : Infinity));
  const rendered: string[] = [];
  for (const unit of units) {
    const sections = parseTasksSections(unit.tasks && unit.tasks.body);
    // 순서는 Plan/intent 소비자가 기대하는 장기 allowlist와 같다.
    // doNotTouch는 의도적으로 빠진다 — 후속 금지는 Interface·Constraints에 적는다.
    const selected = [
      ['Goal & intent', sections.goal],
      ['Current behavior', sections.currentBehavior],
      ['Target behavior', sections.targetBehavior],
      ['Interface', sections.interface],
      ['Touch', sections.touch],
      ['Constraints', sections.constraints],
    ].filter(([, body]) => typeof body === 'string' && body.trim()) as Array<[string, string]>;
    if (!selected.length) continue;
    const stableId = stableIdFromTaskData(unit.tasks && unit.tasks.data);
    let heading: string;
    if (stableId) {
      const hit = commits && commits.get(stableId);
      const sha8 = hit && normalizeCommitSha(hit.sha8 || hit.sha);
      // SHA가 있으면 통합 commit을 제목에 남긴다. 없으면 ID만 — trailer 해석
      // 실패·미존재 시에도 제목 형식을 깨지 않기 위함.
      heading = sha8 ? `### ${stableId} · \`${sha8}\`` : `### ${stableId}`;
    } else {
      const number = typeof unit.number === 'number'
        ? String(unit.number).padStart(3, '0')
        : 'unknown';
      heading = `### Task ${number}`;
    }
    rendered.push(
      [heading, ...selected.flatMap(([h, body]) => [
        `#### ${h}`,
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
  workerPath?: unknown;
};
type CoordinatorLedgerLike = {
  base?: unknown; integrationBranch?: unknown; tasks?: unknown;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * checkout이 실제로 가리키는 local branch를 읽는다. detached HEAD·삭제된
 * worktree·Git 조회 실패는 null로 보존한다. finalize는 provenance를 못 읽었다고
 * 닫기를 거절하지 않으므로, 계산한 이름으로 빈 사실을 채우지 않는다.
 *
 * @param {string | null} worktreePath - branch를 확인할 checkout 경로
 * @returns {string | null} 실제 branch 또는 확인 불가를 뜻하는 null
 */
function resolveCheckoutBranch(worktreePath: string | null): string | null {
  if (!worktreePath) return null;
  try {
    const branch = String(execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })).trim();
    return branch || null;
  } catch (_error) {
    // detached HEAD와 접근 불가 checkout은 provenance에서 구별할 branch가 없다.
    return null;
  }
}

/**
 * 원장에서 finalize·digest가 실제로 읽는 여섯 필드만 접는다.
 * task SHA·decisions·repair wave는 마감 JSON에 실리면 모델이 drive 실행
 * 기록을 재사용하므로 여기서 버린다. worker별 `git symbolic-ref`도 같은
 * 이유로 호출하지 않는다 — 소비처는 integration branch와 worktree 경로뿐이다.
 * 원장이 없으면 위임 실행이 아니므로 null. 빈 객체를 주면 호출부가
 * "drive인데 기록이 비었다"와 구분하지 못한다.
 *
 * @param {CoordinatorLedgerLike | null | undefined} ledger - coordinator 원장. 없으면 null
 * @param {object} [paths] - integration·원장 경로. 생략 시 둘 다 null
 * @param {string | null} [paths.integrationPath] - integration worktree 절대 경로
 * @param {string | null} [paths.ledgerFile] - 원장 파일 절대 경로
 * @returns {{
 *   status: 'ok', ledgerFile: string | null, base: string | null,
 *   integrationBranch: string | null, integrationPath: string | null,
 *   worktrees: string[]
 * } | null} 원장 없으면 null
 */
function buildCoordinatorProvenance(
  ledger: CoordinatorLedgerLike | null | undefined,
  { integrationPath = null, ledgerFile = null }:
    { integrationPath?: string | null; ledgerFile?: string | null } = {},
) {
  if (!ledger) return null;
  // 빈 workerPath는 정리 대상이 아니다. 순서는 원장 task 순서를 유지한다.
  const workerPaths = (Array.isArray(ledger.tasks) ? ledger.tasks : [])
    .filter((entry): entry is LedgerTaskLike => Boolean(entry) && typeof entry === 'object')
    .map((entry) => stringOrNull(entry.workerPath))
    .filter((p): p is string => Boolean(p));
  return {
    status: 'ok' as const,
    // 성공 경로도 원장 경로를 싣는다. unreadable 분기에만 채우면 소비자가
    // `ledgerFile: null`을 "원장이 없다"와 "원장은 있는데 알려주지 않았다"로
    // 구분하지 못한다.
    ledgerFile,
    base: stringOrNull(ledger.base),
    integrationBranch: stringOrNull(ledger.integrationBranch)
      || resolveCheckoutBranch(integrationPath),
    integrationPath,
    // cleanup 목록: integration이 먼저고, 할당된 worker worktree가 뒤따른다.
    // payload의 top-level `worktrees`는 정리 계약(SKILL step 5,
    // cleanup-handoff.md)이 읽는 안정된 자리이다.
    worktrees: [
      ...(integrationPath ? [integrationPath] : []),
      ...workerPaths,
    ],
  };
}

type CoordinatorProvenance = ReturnType<typeof buildCoordinatorProvenance>;
type UnreadableProvenance = {
  status: 'unreadable'; ledgerFile: string | null; integrationPath: string | null;
  base: null; integrationBranch: null; worktrees: never[];
};

/**
 * 원장 읽기 결과만으로 provenance를 접는다.
 * finalize는 같은 읽기로 `integration`도 만들어 두 필드가 서로 다른 원장을
 * 가리키지 않게 한다. 공개 API는 아래 `collectCoordinatorProvenance`다.
 *
 * @param {ReturnType<typeof readCoordinatorLedger>} read - `readCoordinatorLedger` 결과
 * @returns {CoordinatorProvenance | UnreadableProvenance | null} 원장 없음은 null, 깨진 원장은 unreadable
 */
function provenanceFromLedgerRead(read: ReturnType<typeof readCoordinatorLedger>):
  CoordinatorProvenance | UnreadableProvenance | null {
  if (!read.ok) {
    if (read.reason !== 'unreadable-ledger') return null;
    return {
      status: 'unreadable',
      ledgerFile: read.ledgerFile || null,
      integrationPath: read.integrationPath || null,
      base: null,
      integrationBranch: null,
      worktrees: [],
    };
  }
  return buildCoordinatorProvenance(read.ledger, {
    integrationPath: read.integrationPath,
    ledgerFile: read.ledgerFile,
  });
}

/**
 * 저장소에서 원장을 찾아 provenance로 접는다.
 *
 * 원장이 아예 없으면 위임 실행이 아니므로 null이다. 읽을 수는 있으나 깨진
 * 원장은 null이 아니다 — null로 접으면 top-level `worktrees: []`만 남아
 * 비-drive finalize와 구분되지 않고, 검증되지 않은 fan-in이 완료로
 * 기록된다. `status`와 고칠 파일 경로를 실어 호출부가 멈출 수 있게 한다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @returns {CoordinatorProvenance | UnreadableProvenance | null} 원장 없음은 null
 */
function collectCoordinatorProvenance({ repoRoot, blueprintDir }: {
  repoRoot: string; blueprintDir: string;
}): CoordinatorProvenance | UnreadableProvenance | null {
  return provenanceFromLedgerRead(readCoordinatorLedger({ repoRoot, blueprint: blueprintDir }));
}

type LedgerReadLike = ReturnType<typeof readCoordinatorLedger>;
type IntegrationReport = {
  ledger: 'absent' | 'ok' | 'unreadable';
  required: boolean;
  complete: boolean;
  openTasks: string[];
  headVerified: boolean | null;
};

/**
 * ledger task id를 세 자리 목록용으로 정규화한다.
 * 원장은 `001`과 `TASKS-001`을 섞어 쓸 수 있어, 보고 목록만 세 자리로 맞춘다.
 *
 * @param {unknown} id - 원장 task id
 * @returns {string | null} 세 자리 id. 숫자로 해석되지 않으면 null
 */
function threeDigitTaskId(id: unknown): string | null {
  if (typeof id === 'number' && Number.isInteger(id) && id >= 0 && id <= 999) {
    return String(id).padStart(3, '0');
  }
  if (typeof id !== 'string' || id === '') return null;
  const match = /^(?:TASKS-)?(\d{1,3})$/.exec(id);
  return match ? match[1].padStart(3, '0') : null;
}

/**
 * finalize payload의 보고 전용 `integration` 필드를 만든다.
 * 거절 reason은 바꾸지 않는다. 깨진 원장은 기존 `coordinator-ledger`만 쓰고,
 * 미통합 task는 `complete`/`openTasks`로만 알린다.
 *
 * @param {object} read - `readCoordinatorLedger` 결과
 * @returns {IntegrationReport} absent는 비-drive, unreadable은 기존 거절과 함께 실림
 */
function buildIntegration(read: LedgerReadLike): IntegrationReport {
  // 1. 원장이 없으면 위임 실행이 아니다. required를 켜면 스킬이 비-drive를
  //    미완료로 오인하고 `--yes`를 멈춘다.
  if (!read.ok) {
    if (read.reason !== 'unreadable-ledger') {
      return {
        ledger: 'absent',
        required: false,
        complete: true,
        openTasks: [],
        headVerified: null,
      };
    }
    return {
      ledger: 'unreadable',
      required: true,
      complete: false,
      openTasks: [],
      headVerified: null,
    };
  }
  const tasks = (Array.isArray(read.ledger.tasks) ? read.ledger.tasks : [])
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => asRecord(entry));
  const open = tasks.filter((entry) => entry.status !== 'integrated');
  const openTasks = open
    .map((entry) => threeDigitTaskId(entry.id))
    .filter((id): id is string => Boolean(id))
    .sort();
  const verification = tasks.filter((entry) => entry.execution_kind === 'verification');
  return {
    ledger: 'ok',
    required: true,
    // open.length: id를 못 읽은 미통합 task도 complete를 false로 남긴다.
    complete: open.length === 0,
    openTasks,
    // verification node가 없으면 head 판정 대상이 없다. null과 false를 구분해
    // 스킬이 "검증 실패"와 "검증 task 없음"을 같은 중지로 접지 않게 한다.
    headVerified: verification.length === 0
      ? null
      : verification.every((entry) => entry.status === 'integrated'),
  };
}

type EvidenceMismatch = { id: string | null; expected: string; actual: string | null };

/**
 * 원장에서 integrated인 task마다 integration 사본의 tasks.md 상태를 대조한다.
 * commit task는 `verified`, verification task는 `integrated`여야 한다. 원장만 앞서
 * 가고 문서가 따라오지 않으면 G16이 원인 모를 열린 task로 보고하므로, 그 앞에서
 * 어긋난 task를 이름으로 돌려준다. 읽기만 한다.
 *
 * @param {object} read - 읽기에 성공한 `readCoordinatorLedger` 결과
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {EvidenceMismatch[]} 어긋난 task. 비어 있으면 일치
 */
function coordinatorEvidenceMismatches(
  read: Extract<LedgerReadLike, { ok: true }>,
  blueprintDir: string,
): EvidenceMismatch[] {
  const tasks = (Array.isArray(read.ledger.tasks) ? read.ledger.tasks : [])
    .filter((entry) => Boolean(entry) && typeof entry === 'object')
    .map((entry) => asRecord(entry))
    .filter((entry) => entry.status === 'integrated');
  const mismatches: EvidenceMismatch[] = [];
  for (const entry of tasks) {
    const id = threeDigitTaskId(entry.id);
    const expected = entry.execution_kind === 'verification' ? 'integrated' : 'verified';
    let actual: string | null = null;
    if (id && read.integrationPath) {
      const file = path.join(read.integrationPath, toPosix(blueprintDir), 'tasks', id, 'tasks.md');
      actual = readTaskStatus(file);
    }
    if (actual !== expected) mismatches.push({ id, expected, actual });
  }
  return mismatches;
}

/**
 * tasks.md의 `bouncer.status`를 읽는다. 문서가 없거나 frontmatter를 읽을 수 없으면
 * null — 대조에서는 둘 다 기대 상태와 다른 값이다.
 *
 * @param {string} file - tasks.md 절대 경로
 * @returns {string | null} 상태 문자열 또는 null
 */
function readTaskStatus(file: string): string | null {
  // 부재·frontmatter 없음·깨진 YAML의 흡수 범위는 integrate 증적 판정과 같아야 하므로
  // coordinator의 한 구현을 쓴다. integrated인데 읽을 수 없는 문서도 불일치로 보고된다.
  const status = readBouncerBlock(file)?.status;
  return typeof status === 'string' ? status : null;
}

// prepareDependencies의 기본 stdio는 inherit이다. finalize 결과는 CLI가 stdout에
// JSON으로 그대로 쓰므로, npm 출력이 같은 stdout에 섞이면 소비자가 결과를 파싱하지
// 못한다. 그래서 finalize 경로만 capture로 고정하고 공유 helper는 바꾸지 않는다.
const FINALIZE_INSTALL_STDIO: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe'];
// 복구 안내에 쓰는 명령. helper가 실행하는 argv와 같은 문자열이어야 사용자가
// 손으로 같은 설치를 재현한다.
const FINALIZE_INSTALL_COMMAND = 'npm ci --include=dev --ignore-scripts --no-audit --no-fund';

type DependencyExec = typeof execFileSync;

/**
 * finalize 검증 직전에 repoRoot의 npm 의존성을 준비한다.
 * 설치 필요 판정(lockfile 존재·marker 부재)과 npm ci 인자는 seed-worktree의
 * prepareDependencies를 그대로 쓰고, 이 wrapper는 실행 seam만 바꿔 끼운다:
 * cwd는 항상 repoRoot, stdio는 capture로 고정해 npm 출력이 CLI JSON stdout에
 * 섞이지 않게 한다. 설치 실패(throw)는 helper가 ok:false로 변환한다.
 *
 * @param {string} repoRoot - 검증할 checkout 절대 경로. 설치 cwd이기도 하다
 * @param {DependencyExec} dependencyExec - execFileSync 호환 실행 함수
 * @returns {{ ok: true } | { ok: false, cause: string }} 설치 불필요·성공은 ok:true,
 *   npm ci 실패면 ok:false와 helper message를 문자열로 바꾼 cause
 */
function prepareFinalizeDependencies(
  repoRoot: string,
  dependencyExec: DependencyExec,
): { ok: true } | { ok: false; cause: string } {
  const capture = ((file: string, argv: readonly string[], options?: object) => dependencyExec(
    file,
    argv,
    // helper가 넘긴 옵션 위에 cwd·stdio를 덮어쓴다. helper 쪽 기본값(inherit)이
    // 바뀌거나 다른 cwd가 들어와도 finalize 계약은 흔들리지 않는다.
    { ...options, cwd: repoRoot, stdio: FINALIZE_INSTALL_STDIO },
  )) as DependencyExec;
  const prepared = prepareDependencies(repoRoot, { execFileSync: capture });
  if (prepared.ok) return { ok: true };
  // helper의 message는 Error.message(unknown)다. throw된 값이 Error가 아니면
  // undefined일 수 있어, 원인 불명이라는 사실을 문자열로 남긴다.
  const { message } = prepared;
  const cause = typeof message === 'string' && message !== ''
    ? message
    : `${prepared.reason}: ${String(message)}`;
  return { ok: false, cause };
}

/**
 * blueprint를 닫는다. dry-run은 계획만 보고, `--yes`는 검증·잠금·커밋까지 간다.
 * drive면 원장에서 읽은 정리 목록을 top-level `worktrees`에 싣고 cleanup이
 * 읽게 한다. explain frontmatter에는 쓰지 않는다 — drive 실행 기록은 원장이
 * 살아있는 동안에만 의미가 있고, 이미 있는 옛 `bouncer.coordinator`는
 * 마이그레이션하지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {boolean} [opts.yes=false] - true면 잠금·커밋을 수행한다
 * @param {GitApi} [opts.git] - git seam. 없으면 `realGit(repoRoot)`
 * @param {(opts: { repoRoot: string }) => boolean} [opts.clearPointer] - pointer 삭제 seam
 * @param {(opts: { repoRoot: string, blueprintDir: unknown }) => unknown} [opts.next] - next 후보 seam
 * @param {VerifyExec} [opts.verifyExec] - 검증 실행 seam
 * @param {DependencyExec} [opts.dependencyExec] - 검증 전 npm ci 실행 seam. 기본은 Node execFileSync.
 *   verifyExec 주입은 검증만 바꾸며 설치를 생략시키지 않는다
 * @returns {object} 성공이면 `ok: true`와 worktrees·branch, 실패면 reason.
 *   설치 실패는 `reason: 'dependency-install-failed'`·`code: 'DEPENDENCY_INSTALL_FAILED'`와
 *   cause·next·integration·branch로, 검증 실패(`VERIFY_FAILED`)와 구분된다
 */
function finalize({
  repoRoot, blueprintDir, yes = false, git, clearPointer = clearCurrent,
  next = nextBlueprint, verifyExec, dependencyExec = execFileSync,
}: {
  repoRoot: string;
  blueprintDir: string;
  yes?: boolean;
  git?: GitApi;
  clearPointer?: (opts: { repoRoot: string }) => boolean;
  next?: (opts: { repoRoot: string; blueprintDir: unknown }) => unknown;
  verifyExec?: VerifyExec;
  dependencyExec?: DependencyExec;
}) {
  const gitApi = git || realGit(repoRoot);

  const preflightTarget = resolveLockTarget({ repoRoot, blueprintDir });
  const preflightBouncer = preflightTarget.data && typeof preflightTarget.data === 'object'
    ? asRecord(asRecord(preflightTarget.data).bouncer) : {};
  if (preflightBouncer.status === 'partial_closed') {
    const collected = collectCoordinatorProvenance({ repoRoot, blueprintDir });
    const nextPlan = path.join(repoRoot, 'NEXT_PLAN.md');
    return {
      ok: false, reason: 'partial-closed', status: 'partial_closed',
      worktrees: collected ? collected.worktrees : [],
      nextPlan: fs.existsSync(nextPlan) ? nextPlan : null,
      preserved: true,
      message: 'NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.',
    };
  }

  // 원장은 G16보다 먼저 한 번만 읽는다. 증적 대조와 아래 provenance·integration이
  // 같은 읽기를 써야 dry-run과 --yes, 그리고 두 필드가 서로 다른 원장을 보지 않는다.
  const ledgerRead = readCoordinatorLedger({ repoRoot, blueprint: blueprintDir });
  // drive에서 원장만 integrated로 앞서고 integration 문서가 따라오지 않으면 G16은
  // 원인 없이 "open tasks remain"만 낸다. 그 판정 전에 어긋난 task를 이름으로 멈춘다.
  // 문서와 커밋은 쓰지 않으며 dry-run과 --yes가 같은 자리에서 멈춘다.
  if (ledgerRead.ok) {
    const mismatches = coordinatorEvidenceMismatches(ledgerRead, blueprintDir);
    if (mismatches.length > 0) {
      return { ok: false, reason: 'coordinator-evidence-mismatch', tasks: mismatches };
    }
  }

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
  // integration은 위에서 읽은 같은 원장에서 접는다 — 보고 전용이라 거절 reason을
  // 바꾸지 않고, 두 번 읽으면 그 사이 원장이 바뀌었을 때 두 필드가 어긋난다.
  const collected = provenanceFromLedgerRead(ledgerRead);
  const integration = buildIntegration(ledgerRead);
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
      integration,
    };
  }
  const branch = collected ? collected.integrationBranch : resolveCheckoutBranch(repoRoot);
  // top-level `worktrees`는 cleanup이 읽는 안정된 자리다(위 buildCoordinatorProvenance 주석).
  const worktrees = collected ? collected.worktrees : [];
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
      branch,
      worktrees,
      integration,
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
      branch,
      worktrees,
      integration,
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
      return { ok: false, reason: 'verify', code, command: null, exitCode: null, integration, branch };
    }
    throw error;
  }
  // 설치는 verify config 해석이 성공한 뒤에만 한다 — 설정 오류·gate 거부·dry-run·
  // 빈 종료는 위에서 이미 반환했으므로 npm을 부르지 않는다. integration checkout은
  // git worktree라 ignored node_modules가 없으므로, 여기서 채우지 않으면 검증이
  // 코드와 무관한 모듈 누락으로 실패한다. 설치 실패는 VERIFY_FAILED와 다른 원인이라
  // 별도 코드로 반환하고, 문서 snapshot·삭제·stage·commit·pointer 해제 전에 멈춘다.
  const deps = prepareFinalizeDependencies(repoRoot, dependencyExec);
  if (!deps.ok) {
    return {
      ok: false,
      reason: 'dependency-install-failed',
      code: 'DEPENDENCY_INSTALL_FAILED',
      cause: deps.cause,
      next: `${repoRoot}에서 \`${FINALIZE_INSTALL_COMMAND}\`로 의존성을 복구한 뒤 `
        + `같은 \`bouncer finalize --blueprint ${blueprintDir} --yes\` 명령을 다시 실행하세요.`,
      integration,
      branch,
    };
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
      integration,
      branch,
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
  // trailer 맵은 collectTaskCommits·buildTaskContext가 같은 출처를 쓰도록 한 번만 푼다.
  // base 부재·git 실패는 맵 없이 진행 — finalize를 막지 않고 commit_sha로 폴백한다.
  let trailerCommits: Map<string, TrailerCommit> | undefined;
  const trailerBase = resolveFinalizeTrailerBase({
    repoRoot,
    blueprintDir,
    ledgerBase: collected ? collected.base : null,
  });
  if (trailerBase) {
    try {
      const head = typeof gitApi.headSha === 'function'
        ? gitApi.headSha()
        : execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: repoRoot,
          encoding: 'utf8',
        }).trim();
      const stableIds = (Array.isArray(docs.taskUnits) ? docs.taskUnits : [])
        .map((unit) => stableIdFromTaskData(unit.tasks && unit.tasks.data))
        .filter((id): id is string => Boolean(id));
      if (head && stableIds.length > 0) {
        trailerCommits = resolveTaskCommits({
          repoRoot,
          base: trailerBase,
          head,
          stableIds,
        });
      }
    } catch (_error) {
      // rev-parse·log 실패는 trailer만 생략한다. commit_sha 경로로 계속한다.
      trailerCommits = undefined;
    }
  }
  const taskCommits = lockPath
    ? collectTaskCommits({ repoRoot, blueprintDir, commits: trailerCommits })
    : [];
  const taskContext = lockPath
    ? buildTaskContext(docs.taskUnits, trailerCommits)
    : '';

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
      // explain은 제품 동작 기록이다. drive 원장 색인을 싣으면 검색·PR 입력이
      // 실행 기록을 재사용한다.
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
    branch,
    worktrees,
    integration,
  };
}

export = {
  buildCommitMessage, buildFinalizeCommitMessage, realGit, finalize,
  // collectTransientRels는 retention 적용(일괄 정리)이 같은 삭제 목록을
  // 재사용하도록 공개한다. finalize 내부 스냅샷과 목록이 갈라지면 복구 경계가 깨진다.
  collectTransientRels,
  buildTaskContext, collectTaskCommits, writeExplainTaskCommits, writeExplainTaskContext,
  buildCoordinatorProvenance, collectCoordinatorProvenance,
  // digest가 finalize와 같은 branch 판정을 쓰도록 공개한다.
  resolveCheckoutBranch,
};
