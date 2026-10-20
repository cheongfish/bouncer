'use strict';
const fs = require('node:fs');
const path = require('node:path');
import paths = require('./paths');
const { toPosix } = paths;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
import scope = require('./scope');
const { readCoordinatorLedger } = scope;
import commitSha = require('./commit-sha');
const { buildStableProvenance, normalizeCommitSha } = commitSha;
import contextIds = require('./context-ids');
const { parseStableId } = contextIds;
import gitOps = require('./git-ops');
const { resolveCheckoutBranch } = gitOps;
function asRecord(value: unknown): Record<string, unknown> { return value as Record<string, unknown>; }


type TaskCommitEntry = { task: string; sha: string; intent_anchor: string };


type TrailerCommit = { sha?: string; sha8: string };


// 번호·slug 두 형식의 task stable ID에서 epic·blueprint key와 task 번호를 꺼낸다. task가 없는 intent ID는 null이다.
// 부모(Explain frontmatter) 비교는 형식별 key 문자열 그대로 한다 — 형식 간 변환을 여기서 하지 않는다.
function taskStableParts(id: unknown): { epicKey: string; blueprintKey: string; task: string } | null {
  const parsed = parseStableId(id);
  return parsed && parsed.task !== null
    ? { epicKey: parsed.epicKey, blueprintKey: parsed.blueprintKey, task: parsed.task }
    : null;
}

// buildStableProvenance가 던지는 "입력 형식 위반" 메시지만 가린다(번호/slug key, TASKS-NNN).
const PROVENANCE_INPUT_ERROR_RE = /must be a three-digit id|must be a slug|must be TASKS-NNN/;



/**
 * tasks.md frontmatter에서 stable Task ID를 만든다.
 * epic_id·blueprint_id·id가 정본이 아니면 null — 잘못된 값을 패딩하지 않는다.
 *
 * @param {unknown} data - tasks.md frontmatter 루트
 * @returns {string | null} `EPIC-ddd/BP-ddd/TASK-ddd` 또는 `<epic>/<bp>/ddd`, 불가 시 null
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
    // 번호·slug key·TASKS-NNN 계약 위반만 흡수한다. 그 외는 호출부에서 본다.
    if (
      error instanceof Error
      && PROVENANCE_INPUT_ERROR_RE.test(error.message)
    ) {
      return null;
    }
    throw error;
  }
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
        && PROVENANCE_INPUT_ERROR_RE.test(error.message)
      ) {
        continue;
      }
      throw error;
    }
    const parts = taskStableParts(provenance.task);
    // helper가 만든 문자열만 온다. 매칭 실패는 계약 파손이라 추측해서 채우지 않는다.
    if (!parts) continue;
    if (parts.epicKey !== parent.epicId || parts.blueprintKey !== parent.blueprintId) {
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
      intent_anchor: `task-${parts.task}`,
    });
  }
  return out;
}


export = {
  taskStableParts,
  stableIdFromTaskData,
  buildCoordinatorProvenance,
  provenanceFromLedgerRead,
  collectCoordinatorProvenance,
  collectTransientRels,
  collectTaskCommits,
};
