// scripts/lib/finalize.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
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
const { executeVerify } = verification;
import verificationTarget = require('./verification-target');
const { readVerifyCommand } = verificationTarget;
import gitOps = require('./git-ops');
const { realGit, resolveCheckoutBranch } = gitOps;
type GitApi = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  trackedFiles?: () => string[];
  stage: (files: string[]) => void;
  commit: (msg: string) => void;
  headSha?: () => string;
};
import commitMessage = require('./commit-message');
const { buildCommitMessage, buildFinalizeCommitMessage } = commitMessage;
import finalizeCollect = require('./finalize-collect');
const {
  collectTransientRels, collectTaskCommits, collectCoordinatorProvenance,
  buildCoordinatorProvenance, provenanceFromLedgerRead, stableIdFromTaskData,
} = finalizeCollect;
import finalizeChecks = require('./finalize-checks');
const {
  buildIntegration, coordinatorEvidenceMismatches, collectMustFixWarnings,
} = finalizeChecks;
import finalizeExplain = require('./finalize-explain');
const { writeExplainTaskCommits, buildTaskContext, writeExplainTaskContext } = finalizeExplain;

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
import { validOutsideScope } from './execution-contracts';
import type { OutsideScopeDisposition } from './execution-contracts';
// seed-worktree는 paths·layout·scope만 import하므로 finalize를 끌어와 순환을 만들지 않는다.
// 설치 판정(lockfile·marker)과 npm ci 인자를 seed/fan-in과 한 구현으로 공유하려는 import.
import seedWorktree = require('./seed-worktree');
const { prepareDependencies } = seedWorktree;
const { readBouncerBlock } = coordinatorLib;
const { normalizeAuthoredLines, parseIntentBody } = templates;

type TaskCommitEntry = { task: string; sha: string; intent_anchor: string };
type TrailerCommit = { sha?: string; sha8: string };

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

type LedgerTaskLike = {
  workerPath?: unknown;
};
type CoordinatorLedgerLike = {
  base?: unknown; integrationBranch?: unknown; tasks?: unknown;
};

type CoordinatorProvenance = ReturnType<typeof buildCoordinatorProvenance>;
type UnreadableProvenance = {
  status: 'unreadable'; ledgerFile: string | null; integrationPath: string | null;
  base: null; integrationBranch: null; worktrees: never[];
};

type LedgerReadLike = ReturnType<typeof readCoordinatorLedger>;
/**
 * 재실행 출력의 실패 경로가 모두 분류된 범위 밖 경로 안에 있는지 판정한다.
 * 출력에서 저장소 파일 경로(디렉터리 구분자가 있는 토큰, node_modules·node: 내부 제외)를 뽑아
 * 하나 이상 있어야 하고 전부 분류 경로(파일 또는 디렉터리)에 속해야 true다. 경로를 하나도 못
 * 찾거나 분류 밖 경로가 하나라도 있으면 false라 호출자가 VERIFY_FAILED로 막는다(보수적 판정).
 *
 * @param {string} output - 재실행 검증 출력
 * @param {string[]} classified - 분류 당시 기록한 범위 밖 경로
 * @param {string} repoRoot - 절대 경로 접두를 벗길 저장소 루트
 * @returns {boolean} 모든 실패 경로가 분류 안이면 true
 */
function failuresWithinClassifiedPaths(output: string, classified: string[], repoRoot: string): boolean {
  const root = toPosix(repoRoot).replace(/\/+$/, '');
  const norm = (value: string) => value.replace(/^\.\//, '').replace(/\/+$/, '');
  const allowed = classified.map((entry) => norm(toPosix(entry)));
  const found = new Set<string>();
  for (const match of output.matchAll(/[\w@.~:/\\-]*[\w@.-]+\/[\w@./\\-]*[\w-]\.[A-Za-z0-9]+/g)) {
    let token = toPosix(match[0]).replace(/^file:\/\//, '');
    if (token.includes('node_modules') || token.startsWith('node:') || /^[a-z]+:\/\//i.test(token)) continue;
    if (token.startsWith(`${root}/`)) token = token.slice(root.length + 1);
    found.add(norm(token));
  }
  if (found.size === 0) return false;
  return [...found].every((token) => allowed.some((entry) => token === entry || token.startsWith(`${entry}/`)));
}

type RemainderOutsideScope = {
  task: string; disposition: OutsideScopeDisposition;
  remainder: { command: string; exit_code: number; output_sha: string; evidence_id: string };
  note: string;
};

/**
 * finalize remainder 검증 실패가 원장에 입증된 범위 밖 terminal 실패와 같은 원인인지 판정한다.
 * 원장이 없거나(비-drive) 분류가 없거나 stale이면, 명령이나 종료 코드가 분류된 실패와 다르면 null이라
 * 호출자는 기존 VERIFY_FAILED로 막는다. 맞으면 이번 실행의 output digest를 원본 evidence id에
 * 연결한 새 identity를 돌려준다(원문 출력은 싣지 않는다).
 *
 * @param {LedgerReadLike} read - finalize가 한 번 읽은 원장 결과
 * @param {string} command - 이번 remainder 검증 명령
 * @param {{ exitCode: number, output: string }} execution - 실패한 검증 결과
 * @param {string} repoRoot - 출력의 절대 경로를 상대 경로로 바꾸는 기준
 * @returns {RemainderOutsideScope | null} 같은 범위 밖 원인이면 연결 정보, 아니면 null
 */
function remainderOutsideScope(
  read: LedgerReadLike,
  command: string,
  execution: { exitCode: number; output: string },
  repoRoot: string,
): RemainderOutsideScope | null {
  if (!read.ok) return null;
  const failure = asRecord(asRecord(read.ledger).terminalFailure);
  const taskId = typeof failure.task === 'string' ? failure.task : '';
  const disposition = validOutsideScope(read.ledger, taskId);
  if (!disposition) return null;
  if (failure.command !== command || failure.exitCode !== execution.exitCode) return null;
  // 같은 명령·종료 코드는 같은 원인의 증거가 못 된다(npm run ci는 새 범위 내 실패도 exit 1이다).
  // 재실행 출력이 가리키는 실패 경로가 분류 때 기록한 범위 밖 경로에만 한정될 때만 연결한다.
  if (!failuresWithinClassifiedPaths(String(execution.output), disposition.paths, repoRoot)) return null;
  return {
    task: taskId,
    disposition,
    remainder: {
      command,
      exit_code: execution.exitCode,
      output_sha: createHash('sha256').update(String(execution.output)).digest('hex'),
      evidence_id: disposition.evidence_id,
    },
    note: `범위 밖 실패 evidence ${disposition.evidence_id}는 id로만 PR에 싣고 로컬 경로는 공유 링크에 넣지 않는다.`,
  };
}

type EvidenceMismatch = { id: string | null; expected: string; actual: string | null };

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
 * 설치 필요 판정(lockfile 존재, marker 부재 또는 lockfile sha256 stamp 불일치)과 npm ci 인자는 seed-worktree의
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
 *   cause·next·integration·branch로, 검증 실패(`VERIFY_FAILED`)와 구분된다.
 *   `VERIFY_FAILED`는 verify 출력 마지막 100줄 이하인 `output_tail: string`을 함께 돌려준다
 *   (설정 오류·설치 실패 응답에는 이 키가 없다)
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
    // blueprint 루트 리뷰가 deferred로 넘긴 must_fix를 --yes 전에 보이게 한다.
    // 이미 읽은 docs만 쓰고(파일을 다시 읽지 않음), 실제 finalize cwd의 문서를 본다 —
    // prepare는 integration checkout을 보지만 drive의 finalize cwd도 그 checkout이라 같다.
    // task 범위(review_scope 부재)는 경고를 만들지 않는다.
    const bpBouncer = asRecord(asRecord(docs.blueprintIndex && docs.blueprintIndex.data).bouncer);
    const warnings = bpBouncer.review_scope === 'blueprint'
      ? collectMustFixWarnings(
        asRecord(asRecord(asRecord(docs.review && docs.review.data).bouncer).review).findings,
      )
      : [];
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
      warnings,
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
  // remainder 검증이 실패해도 이미 입증된 범위 밖 terminal 실패와 같은 원인이면 PR 인계를 막지 않는다.
  // 같은 원인의 근거는 명령·종료 코드 일치에 더해 출력의 실패 경로가 분류 경로에 한정되는 것이다.
  // 명령이나 종료 코드가 다르면 새 실패라 기존처럼 막는다. 새 실행의 output digest를 원본 evidence에
  // 묶어 새 identity로 남기며, 원본 evidence는 id로만 싣는다(로컬 경로를 공유 링크에 새기지 않는다).
  const sameCause = !execution.ok ? remainderOutsideScope(ledgerRead, command, execution, repoRoot) : null;
  if (!execution.ok && !sameCause) {
    return {
      ok: false,
      reason: 'verify',
      code: 'VERIFY_FAILED',
      command,
      exitCode: execution.exitCode,
      // 종료 코드만으로는 일시적 실패와 회귀를 가를 수 없어, executeVerify가 이미
      // 100줄로 자른 출력(stdout+stderr tail)을 그대로 싣는다. 새 상수를 두지 않아
      // task verify 증적의 output_tail과 같은 상한을 공유한다.
      output_tail: execution.output,
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
    ...(sameCause ? { outside_scope: sameCause } : {}),
  };
}

export = { finalize };
