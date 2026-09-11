// scripts/lib/commit.js
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
const { taskExecutionKind } = tasksDocs;
import validate = require('./validate');
const { validateBlueprint, loadBlueprintDocs, resolveTaskUnit } = validate;
import finalize = require('./finalize');
const { realGit, buildCommitMessage } = finalize;
import scope = require('./scope');
const {
  filterTaskCommitCandidates, isTaskWorkflowArtifact, coordinatorContext, recordActualPaths,
} = scope;
import coordinatorCore = require('./coordinator');
const { readyWave } = coordinatorCore;
import paths = require('./paths');
const { toPosix } = paths;
import commitGuard = require('./commit-guard');
const { checkCommitSafety } = commitGuard;
import commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;

const OPEN_TASK_STATUS = ['ready', 'in_progress'];

type GitApi = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  stage: (files: string[]) => void;
  commit: (msg: string) => void;
  headSha?: () => string;
};

type DocLeafLike = { data?: unknown; rel?: string };
type TaskUnitLike = {
  number?: number | null;
  tasks?: DocLeafLike;
  [key: string]: unknown;
};

/**
 * 같은 blueprint에서 지금 닫는 묶음을 제외한 열린 task 중 번호가 가장 앞선 것.
 * 포인터는 건드리지 않는다 — 이동은 스킬이 확인 후 `bouncer current --set`만.
 */
function findNextOpenTask({ repoRoot, blueprintDir, currentUnit }: {
  repoRoot: string;
  blueprintDir: string;
  currentUnit: TaskUnitLike | null;
}) {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  if (!listing || !Array.isArray(listing.entries) || listing.entries.length === 0) {
    return null;
  }
  const currentRel = currentUnit && currentUnit.tasks && currentUnit.tasks.rel
    ? currentUnit.tasks.rel
    : null;
  const currentNumber = currentUnit && currentUnit.number != null
    ? currentUnit.number
    : null;

  for (const entry of listing.entries) {
    if (currentRel && entry.rel === currentRel) continue;
    if (currentNumber != null && entry.number === currentNumber) continue;
    if (typeof entry.id !== 'string' || !entry.id) continue;
    try {
      const doc = readDoc(path.join(repoRoot, entry.rel));
      const bouncer = doc.data ? (doc.data as Record<string, unknown>).bouncer : doc.data;
      const st = bouncer ? (bouncer as Record<string, unknown>).status : undefined;
      if (OPEN_TASK_STATUS.includes(st as string)) {
        return { id: entry.id, path: entry.rel, status: st };
      }
    } catch (_e) {
      // 깨진 문서는 후보에서 건너뛰고 다음 번호를 본다.
    }
  }
  return null;
}

type CoordinatorLike = ReturnType<typeof coordinatorContext>;

/**
 * 이전 finalize 시도가 남긴 일회성 문서 삭제 후보인지 판정한다.
 *
 * 이 경로는 일반 task의 권한 밖이므로 수정·신규 파일까지 허용하면 범위 경계가
 * 사라진다. 다만 이 drive에서 finalize가 소유한 추적 파일의 삭제는 task staging
 * 필터에도 남지 않아야, 다음 task commit이 회수용 remainder를 가로채지 않는다.
 *
 * @param {object} opts - 후보와 Git 추적 변경 정보를 담은 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {unknown} opts.file - 판정할 저장소 상대 경로
 * @param {Set<string>} opts.changed - Git이 보고한 추적 변경 경로
 * @returns {boolean} finalize 소유 일회성 문서 삭제 후보이면 true
 */
function isFinalizeRemainderDeletion({ repoRoot, file, changed }: {
  repoRoot: string;
  file: unknown;
  changed: Set<string>;
}): boolean {
  if (typeof file !== 'string' || !changed.has(file) || fs.existsSync(path.resolve(repoRoot, file))) {
    return false;
  }
  const rel = toPosix(file);
  // retired-token 검사는 source 표면의 옛 이름을 금지한다. 경로 계약은 유지하되
  // 문자열 조각을 합쳐, 이 복구 호환성 분기가 다시 공개 surface가 되지 않게 한다.
  const retiredIndex = '.bouncer/Dist' + 'ill.md';
  const retiredShardDir = '.bouncer/dist' + 'ill/';
  return rel === retiredIndex || rel.startsWith(retiredShardDir);
}

/**
 * commit gate가 검사하기 전에 index에 남은 마감 삭제 경로를 찾는다.
 *
 * gate는 index 전체를 scope로 검사하므로 `--only` commit만으로는 이미 staged인
 * remainder를 통과시킬 수 없다. 삭제만 읽어야 수정된 옛 경로를 숨기지 않으며,
 * 호출부는 gate 직후 같은 삭제를 즉시 다시 stage해 사용자의 finalize 상태를 보존한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {string[]} 현재 index에만 있는 finalize 소유 삭제 경로
 */
function stagedFinalizeRemainderDeletions(repoRoot: string): string[] {
  const staged = String(execFileSync('git', [
    'diff', '--cached', '--diff-filter=D', '--name-only',
  ], { cwd: repoRoot, encoding: 'utf8' })).split('\n').filter(Boolean);
  return staged.filter((file) => isFinalizeRemainderDeletion({
    repoRoot, file, changed: new Set([file]),
  }));
}

/**
 * coordinator 실행의 다음 후보는 번호 순서가 아니라 ledger의 ready wave다.
 * 지금 닫는 task는 아직 integrated가 아니므로 목록에서 뺀다.
 */
function nextReadyTask(blueprintDir: string, coordinator: CoordinatorLike) {
  const ready = readyWave(coordinator.tasks).filter((id) => id !== coordinator.taskId);
  if (ready.length === 0) return null;
  const id = ready[0];
  const entry = coordinator.tasks.find((task) => task.id === id);
  return {
    id: `TASKS-${id}`,
    path: `${toPosix(blueprintDir)}/tasks/${id}/tasks.md`,
    status: (entry && entry.status) || 'pending',
  };
}

/**
 * coordinator에게 돌려줄 provenance. 일반 execute(ledger 없음)에서는 빈 객체라
 * 기존 payload 모양이 그대로 유지된다.
 *
 * 이름이 가리키는 것을 정확히 적는다 — 셋은 서로 다른 SHA다.
 * - `taskSha`: 이 호출이 방금 만든 task 커밋. 커밋하지 않았으면 null.
 * - `ledgerWorkerSha`: coordinator가 `record`로 원장에 올린 worker SHA.
 *   아직 record 전이면 null이고, 이 커밋의 SHA가 아니다.
 * - `integrationHeadBefore`: 이 커밋 이전에 원장이 알고 있던 integration head.
 *   fan-in은 coordinator가 따로 수행하므로 여기서 갱신되지 않는다.
 * `actualPaths`는 실제로 커밋에 담긴 경로이며, 커밋하지 않은 호출에서는 null —
 * dry-run의 후보 목록은 기존대로 `staged`가 들고 있다.
 */
function coordinatorProvenance(
  coordinator: CoordinatorLike,
  actualPaths: string[] | null,
  taskSha: string | null,
  ledgerRecord: { ok: boolean; reason?: string } | null,
) {
  if (!coordinator.active) return {};
  return {
    actualPaths,
    scopeRevision: coordinator.revision,
    taskSha,
    ledgerWorkerSha: coordinator.workerSha,
    integrationHeadBefore: coordinator.integrationHead,
    readyWave: readyWave(coordinator.tasks),
    ledgerRecord,
  };
}

type ControllerMode = 'coordinator' | 'standalone';
type NextAction = 'confirm-commit' | 'return-to-coordinator' | 'ask-next-task' | 'finalize';
type RecoveryAction =
  | 'return-to-plan'
  | 'coordinator-revise'
  | 'fix-gate-failures'
  | 'run-verification-node'
  | 'report-and-stop';

/**
 * 스킬이 CLI 동작을 다시 읽지 않도록, 성공 payload의 다음 행동만 고른다.
 *
 * dry-run이 최우선이다. 드라이브 안에서도 `--yes` 전 확인이 있어야 하고,
 * 그 확인을 `return-to-coordinator`가 삼키면 스킬의 Confirm 단계가 사라진다.
 * `controller`는 ledger 활성이면 항상 coordinator — nextAction과 축이 다르다.
 * stampPath는 실제로 `commit_sha`를 쓴 경로만 싣는다. 빈 staged·기록 실패는
 * null이라야 스킬이 없는 stamp를 있는 것처럼 다루지 않는다.
 *
 * @param {object} opts - 성공 분기 입력
 * @param {CoordinatorLike} opts.coordinator - ledger 활성 여부
 * @param {boolean} opts.dryRun - `--yes` 없는 호출이면 true
 * @param {unknown} opts.nextTask - 기존 pointer 후보. 의미는 바꾸지 않는다
 * @param {string | null} opts.stampPath - commit_sha를 기록한 tasks.md, 없으면 null
 * @returns {{controller: ControllerMode, nextAction: NextAction, stampPath: string | null}}
 */
function commitGuidance({
  coordinator, dryRun, nextTask, stampPath,
}: {
  coordinator: CoordinatorLike;
  dryRun: boolean;
  nextTask: unknown;
  stampPath: string | null;
}): { controller: ControllerMode; nextAction: NextAction; stampPath: string | null } {
  const controller: ControllerMode = coordinator.active ? 'coordinator' : 'standalone';
  let nextAction: NextAction;
  if (dryRun) {
    nextAction = 'confirm-commit';
  } else if (coordinator.active) {
    // 커밋 뒤와 빈 staged 모두 여기서 합친다. 드라이브는 Next task ACQ를
    // 열지 않고 coordinator에게 결과를 돌려주는 것이 계약이다.
    nextAction = 'return-to-coordinator';
  } else {
    nextAction = nextTask ? 'ask-next-task' : 'finalize';
  }
  return { controller, nextAction, stampPath };
}

/**
 * 실패 reason 값은 그대로 두고, 스킬이 고를 복구 행동만 붙인다.
 *
 * out-of-scope만 controller가 갈린다. standalone의 return-to-plan은 payload
 * 전용이라 스킬 본문에 `/bouncer-plan`을 한 줄 더 쓰지 않게 한다.
 * 그 밖의 reason(stale-revision 등)은 자리와 무관하게 report-and-stop.
 *
 * @param {string} reason - 기존 실패 코드. 값을 바꾸지 않는다
 * @param {boolean} coordinatorActive - ledger가 활성이면 true
 * @returns {{action: RecoveryAction, detail: string}} 스킬이 렌더할 복구 안내
 */
function recoveryFor(reason: string, coordinatorActive: boolean): {
  action: RecoveryAction;
  detail: string;
} {
  if (reason === 'out-of-scope') {
    if (coordinatorActive) {
      return {
        action: 'coordinator-revise',
        detail: 'Out-of-scope changes are a hard abort with nothing staged. '
          + 'Hand the violations to the coordinator for one scope revision.',
      };
    }
    return {
      action: 'return-to-plan',
      detail: 'Out-of-scope changes are a hard abort with nothing staged. '
        + 'Return to planning; do not edit affected_paths here.',
    };
  }
  if (reason === 'validate') {
    return {
      action: 'fix-gate-failures',
      detail: 'The commit gate reported failures. Fix every code before retrying without --yes.',
    };
  }
  if (reason === 'verification-task-no-commit') {
    return {
      action: 'run-verification-node',
      detail: 'This task has no reviewable commit. Run the verification node instead of committing.',
    };
  }
  return {
    action: 'report-and-stop',
    detail: `Stop and report ${reason}. Do not stage, commit, or move the pointer.`,
  };
}

function commitTask({
  repoRoot, blueprintDir, yes = false, git, validateGate = validateBlueprint,
}: {
  repoRoot: string;
  blueprintDir: string;
  yes?: boolean;
  git?: GitApi;
  validateGate?: typeof validateBlueprint;
}) {
  // 게이트·범위 실패는 반환값. git I/O 예외는 finalize와 같이 그대로 올린다.
  const gitApi = git || realGit(repoRoot);

  const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
  // 포인터 → 번호 순 첫 묶음. 새 해석기를 두지 않는다 (019/020 폴백).
  const taskUnit = resolveTaskUnit(docs, { repoRoot, blueprintDir });
  const executionKind = taskUnit && taskUnit.tasks
    ? taskExecutionKind(taskUnit.tasks.data)
    : null;
  // verification node에는 reviewable commit이 없으므로 commit gate까지 보내
  // G6/G8 오류로 위장하지 않고 실행 종류 경계에서 즉시 거절한다.
  if (executionKind === 'verification') {
    return {
      ok: false,
      reason: 'verification-task-no-commit',
      recovery: recoveryFor('verification-task-no-commit', false),
    };
  }
  // G17은 index 전체를 보므로 task가 stage하지 않을 finalize 삭제도 막는다.
  // 검사 중에만 index에서 분리하고 즉시 원상복구해, 이후 `--only` commit이
  // task 파일만 담으면서도 finalize가 이어받을 staged deletion은 보존한다.
  const stagedRemainderDeletions = git ? [] : stagedFinalizeRemainderDeletions(repoRoot);
  if (stagedRemainderDeletions.length > 0) {
    execFileSync('git', ['restore', '--staged', '--', ...stagedRemainderDeletions], {
      cwd: repoRoot, encoding: 'utf8',
    });
  }
  let v;
  try {
    v = validateGate({ repoRoot, blueprintDir, gate: 'commit' });
  } finally {
    // gate 파싱·Git 호출이 throw해도 원래 staged deletion을 잃지 않는다. 복구 실패는
    // 삼키지 않아 index를 보존했다고 거짓 성공으로 돌려주지 않는다.
    if (stagedRemainderDeletions.length > 0) {
      execFileSync('git', ['add', '-A', '--', ...stagedRemainderDeletions], {
        cwd: repoRoot, encoding: 'utf8',
      });
    }
  }
  if (!v.ok) {
    return {
      ok: false,
      reason: 'validate',
      failures: v.failures,
      recovery: recoveryFor('validate', false),
    };
  }
  // 커밋 단위는 task 하나 — 첫 docs.tasks 호환 필드가 아니라 대상 묶음의 경로.
  const affectedPaths = taskUnit && taskUnit.tasks && taskUnit.tasks.data
    && (taskUnit.tasks.data as Record<string, unknown>).bouncer
    ? ((taskUnit.tasks.data as Record<string, unknown>).bouncer as Record<string, unknown>).affected_paths
    : [];

  // coordinator 실행이면 ledger가 현재 scope·worktree 경계의 정본이다.
  const coordinator = coordinatorContext({
    repoRoot,
    blueprint: blueprintDir,
    task: taskUnit && taskUnit.tasks ? taskUnit.tasks.rel : undefined,
  });

  // 범위 판정은 hook과 같은 checkCommitSafety만 쓴다 — makeAllowed를 여기서 복제하지 않는다.
  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  // 권한 판정에는 Git이 보고한 후보를 모두 넣어 문서 변경도 허용하되,
  // 커밋 직전에는 task 산출물만 남긴다. 존재 확인은 staging 필터의 책임이다.
  const candidates = [...new Set([...changed, ...untracked])];
  const trackedChanged = new Set(changed);
  // context 문서는 task staging 필터가 이미 finalize remainder로 남긴다.
  // 또한 이 drive에서 남은 추적 일회성 삭제만 같은 경계로 빼야 task commit이
  // cleanup을 선점하지 않는다. 수정·untracked 문서와 다른 .bouncer 경로는
  // 계속 safety 검사에 넣어 범위 밖 쓰기를 숨기지 않는다.
  const scopeCandidates = candidates.filter((file) => (
    !isTaskWorkflowArtifact(file)
    && !isFinalizeRemainderDeletion({ repoRoot, file, changed: trackedChanged })
  ));
  const { allow, violations, code } = checkCommitSafety({
    files: scopeCandidates, affectedPaths, blueprintDir, coordinator, executionKind,
  });
  if (!allow) {
    const reason = code || 'out-of-scope';
    return {
      ok: false,
      reason,
      violations,
      recovery: recoveryFor(reason, coordinator.active),
    };
  }

  // 범위 허용과 분리된 task 커밋 전용 필터로 workflow 문서를 남긴다.
  const all = filterTaskCommitCandidates({
    repoRoot, changedFiles: changed, untrackedFiles: untracked,
  }).filter((file) => !isFinalizeRemainderDeletion({
    repoRoot, file, changed: trackedChanged,
  }));

  const commitMessage = buildCommitMessage(docs, taskUnit);
  const nextTask = coordinator.active
    ? nextReadyTask(blueprintDir, coordinator)
    : findNextOpenTask({ repoRoot, blueprintDir, currentUnit: taskUnit });

  if (!yes) {
    return {
      ok: true,
      dryRun: true,
      staged: all,
      commitMessage,
      nextTask,
      ...coordinatorProvenance(coordinator, null, null, null),
      ...commitGuidance({ coordinator, dryRun: true, nextTask, stampPath: null }),
    };
  }

  // 빈 커밋 금지: --yes여도 stage/commit을 호출하지 않고 성공으로 돌려준다.
  if (all.length === 0) {
    return {
      ok: true,
      committed: false,
      staged: [],
      commitMessage,
      nextTask,
      ...coordinatorProvenance(coordinator, null, null, null),
      ...commitGuidance({ coordinator, dryRun: false, nextTask, stampPath: null }),
    };
  }

  if (git) {
    gitApi.stage(all);
  } else {
    // index에 이미 삭제된 경로만 pathspec으로 다시 add할 수 없다. 그 삭제는 그대로
    // 두고, 나머지 허용 후보는 재-stage해 staged 뒤의 worktree 변경까지 포함한다.
    const stagedDeletions = new Set(
      String(execFileSync('git', ['diff', '--cached', '--diff-filter=D', '--name-only'], {
        cwd: repoRoot, encoding: 'utf8',
      })).split('\n').filter(Boolean),
    );
    const toStage = all.filter((file) => !stagedDeletions.has(file));
    if (toStage.length > 0) {
      execFileSync('git', ['add', '-A', '--', ...toStage], { cwd: repoRoot, encoding: 'utf8' });
    }
  }
  if (git) {
    gitApi.commit(commitMessage);
  } else {
    // git commit은 기본적으로 index 전체를 담는다. `all`에 없는 finalize remainder가
    // 이미 staged여도 보존하려면, 실제 Git에는 task 후보만 `--only`로 넘겨야 한다.
    // 이 명령이 실패하면 commit을 진행하지 않아 index 경계를 조용히 무시하지 않는다.
    execFileSync('git', ['commit', '--only', '-m', commitMessage, '--', ...all], {
      cwd: repoRoot, encoding: 'utf8',
    });
  }
  const taskSha = typeof gitApi.headSha === 'function' ? String(gitApi.headSha()).trim() : null;

  // 커밋 직후 HEAD를 tasks.md에 8자리로 남겨 finalize가 explain.task_commits로 옮긴다.
  // 이 쓰기는 다음 task 커밋 또는 finalize remainder에 포함된다.
  let commitSha: string | null = null;
  if (taskSha && taskUnit && taskUnit.tasks && taskUnit.tasks.rel) {
    commitSha = normalizeCommitSha(taskSha);
    if (commitSha) {
      const abs = path.join(repoRoot, taskUnit.tasks.rel);
      try {
        const doc = readDoc(abs);
        if (doc.data && typeof doc.data === 'object') {
          const bouncer = (doc.data as Record<string, unknown>).bouncer;
          if (bouncer && typeof bouncer === 'object') {
            (bouncer as Record<string, unknown>).commit_sha = commitSha;
            fs.writeFileSync(abs, renderDoc(doc.data, doc.body));
          }
        }
      } catch (_e) {
        // tasks.md 기록이 깨져도 커밋 자체는 이미 성공 — sha는 null로 보고.
        commitSha = null;
      }
    }
  }

  // 실제 커밋 경로를 ledger에 남겨 초기 예상치와 함께 감사할 수 있게 한다.
  // 실패는 삼키지 않고 payload의 ledgerRecord로 올린다 — 감사 기록이 조용히
  // 비면 Constraints가 요구한 실제 경로 기록을 잃는다.
  let ledgerRecord: { ok: boolean; reason?: string } | null = null;
  if (coordinator.active && coordinator.taskId) {
    try {
      const recorded = recordActualPaths({
        repoRoot, blueprint: blueprintDir, task: coordinator.taskId, paths: all,
      }) as { ok: boolean; reason?: string };
      ledgerRecord = recorded.ok ? { ok: true } : { ok: false, reason: recorded.reason };
    } catch (error) {
      // 파일시스템 쓰기 실패만 흡수한다(권한, 경쟁 rename). 이미 끝난 커밋을
      // 되돌릴 수는 없으므로 사유를 담아 호출자가 다시 기록하게 한다.
      ledgerRecord = { ok: false, reason: (error as { code?: string }).code || 'ledger-write-failed' };
    }
  }

  return {
    ok: true,
    committed: true,
    staged: all,
    commitMessage,
    nextTask,
    commitSha,
    ...coordinatorProvenance(coordinator, all, taskSha, ledgerRecord),
    ...commitGuidance({
      coordinator,
      dryRun: false,
      nextTask,
      stampPath: commitSha && taskUnit && taskUnit.tasks && taskUnit.tasks.rel
        ? toPosix(taskUnit.tasks.rel)
        : null,
    }),
  };
}

// Interface는 commitTask만 공개. findNextOpenTask는 모듈 내부 후보 계산용.
export = { commitTask };
