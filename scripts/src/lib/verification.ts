'use strict';
import { verificationError, errorCode } from './verification-contracts';
import type { VerificationScope, VerificationDeps, VerifyExec, VerifyFinishResult } from './verification-contracts';
import execution = require('./verification-execution');
const { OUTPUT_TAIL_LINES, PASSING_OUTPUT_TAIL_LINES, MAX_VERIFY_OUTPUT_BYTES, executeVerify } = execution;
import identityModule = require('./verification-identity');
const {
  assertVerificationScope, resolveDefaultTaskScope, computeEvidenceIdentity, computeSourceDigest,
} = identityModule;
import evidence = require('./verification-evidence');
const { recordVerificationResult, findReusableEvidence } = evidence;
const fs = require('node:fs');
const path = require('node:path');
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import layout = require('./layout');
const { isCanonicalBlueprintDir } = layout;
import time = require('./time');
const { nowIsoKst } = time;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs } = tasksDocs;
type VerificationTaskEntry = {
  rel: string;
  dir?: string | null;
  number?: number | null;
  tasks?: { rel: string };
  verification?: { rel: string };
};
// current.ts는 이 모듈군 밖이라 strict include에 넣지 않는다. 상대 require를
// 그대로 두면 tsc가 그 파일을 편입해 다음 커밋 몫의 오류가 여기로 새어 온다.
import type { EffectiveTask } from './execution-contracts';
import paths = require('./paths');
const { toPosix } = paths;
import config = require('./config');
const {
  readConfigResult,
  readVerifyPolicy,
} = config;
import commandArgv = require('./command-argv');
const { parseVerifyArgv, isValidVerifyCommand } = commandArgv;
import schema = require('./schema');
const { executionKindOf } = schema;
import seedWorktree = require('./seed-worktree');

const TASK_DIR_RE = /(?:^|\/)tasks\/(\d{3})(?:\/|$)/;

/**
 * verify·verification.md 대상 task 문서 목록을 고른다. 명시 `taskId`가 있으면
 * effective task보다 우선하고, 세 자리가 아니거나 목록에 없으면
 * `VERIFY_IDENTITY_INVALID`로 거절한다(형식 오류를 조용히 무시하지 않음).
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - blueprint 상대 경로
 * @param {string} [taskId] - 세 자리 task id. 없으면 lease/pointer effective로 해석
 * @returns {Array<{rel: string, verification?: {rel: string}}>} 대상 문서 엔트리
 */
function selectVerificationEntries(
  repoRoot: string,
  blueprintDir: string,
  { taskId, effectiveTask }: { taskId?: string; effectiveTask: EffectiveTask | null },
): VerificationTaskEntry[] {
  const listing = listTasksDocs({ repoRoot, blueprintDir });
  if (listing.mixed) return [];
  // 명시 taskId는 pointer/lease effective보다 우선한다. wave·terminal integrate가
  // 포인터를 옮기지 않고도 그 task의 verify·verification.md만 고르게 한다.
  if (typeof taskId === 'string') {
    // Interface: 세 자리만 허용. 형식이 틀리면 effective로 폴백하지 않는다 —
    // 잘못된 id를 조용히 무시하면 다른 task verify가 돌아 identity를 속인다(RD-002).
    if (!/^\d{3}$/.test(taskId)) {
      throw verificationError(
        'VERIFY_IDENTITY_INVALID',
        `taskId ${taskId} is not a three-digit task id`,
      );
    }
    const match = listing.entries.find((entry) => {
      const digits = TASK_DIR_RE.exec(toPosix(entry.rel));
      return digits && digits[1] === taskId;
    });
    // 목록에 없으면 identity 오류 — config.verify로 폴백하면 잘못된 명령을 숨긴다.
    if (!match) {
      throw verificationError(
        'VERIFY_IDENTITY_INVALID',
        `taskId ${taskId} is not in the blueprint task listing`,
      );
    }
    return [match];
  }
  // effective task(lease 우선)가 이 blueprint를 가리키고 문서가 살아 있으면
  // 그 문서만. worker에서 lease를 못 확인하면 빈 목록 — pointer로 폴백하지
  // 않아 다른 task 선언을 끌어오지 않는다. 문서가 사라진 경우에만 미지정
  // (전체 walk)으로 폴백한다.
  const effective = effectiveTask;
  if (effective && effective.source === null) return [];
  const bp = toPosix(blueprintDir);
  if (effective && typeof effective.path === 'string' && toPosix(effective.blueprint) === bp) {
    const match = listing.entries.find((e) => e.rel === toPosix(effective.path));
    if (match) return [match];
  }
  return listing.entries;
}

/**
 * blueprint가 `verification_policy: scoped_terminal`을 선언했는지 읽는다.
 * index.md가 없으면(ENOENT) 정책 이전 계획과 같은 legacy로 본다 — 문서 없는
 * fixture·옛 저장소에서 기존 config.verify 경로가 바뀌지 않게 하기 위함이다.
 * 그 밖의 읽기·파싱 오류는 정책을 알 수 없다는 뜻이므로 삼키지 않고 던진다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {boolean} scoped_terminal이면 true, 부재·legacy·허용 밖 값이면 false
 */
function isScopedTerminal(repoRoot: string, blueprintDir: string): boolean {
  try {
    const { data } = readDoc(path.join(repoRoot, blueprintDir, 'index.md'));
    const bouncer = data ? (data as Record<string, unknown>).bouncer : undefined;
    return schema.verificationPolicyOf(bouncer) === 'scoped_terminal';
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

/**
 * 문서가 사라졌을 때만 구현 task로 취급하고 다른 읽기 실패는 전파한다.
 * @param {string} repoRoot - 저장소 루트
 * @param {string} rel - task 문서 상대 경로
 * @returns {boolean} verification node이면 true
 */
function isVerificationKindDoc(repoRoot: string, rel: string): boolean {
  try {
    const { data } = readDoc(path.join(repoRoot, rel));
    const bouncer = data ? (data as Record<string, unknown>).bouncer : undefined;
    return schema.executionKindOf(bouncer) === 'verification';
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

/**
 * 활성 task 선언 또는 `config.verify`에서 검증 명령을 고른다. task 필드는
 * 저장소 정책 allowlist로 검사한다. 파손된 config는 기본 목록으로 넘어가지
 * 않고 `VERIFY_CONFIG_INVALID`다. 셸 연산자·미종료 인용은 그보다 먼저
 * `VERIFY_COMMAND_INVALID`로 거절한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {Array<{rel: string}>} entries - 이미 선택된 task 문서 목록
 * @returns {string} 실행할 단일 argv 문자열
 */
function readVerifyCommandFor(
  repoRoot: string,
  entries: Array<{ rel: string }>,
  blueprintDir?: string,
): string {
  const configPath = path.join(repoRoot, '.bouncer', 'config.json');
  // blueprint 선언이 있으면 우선합니다. task 문서가 없거나 필드가 없으면
  // 기존 config.verify 경로를 유지합니다. 있지만 유효하지 않은 필드는
  // 조용히 넘어가면 안 됩니다 — plan-time S12 누락을 숨깁니다.
  const scoped = Boolean(blueprintDir) && isScopedTerminal(repoRoot, blueprintDir as string);
  let selectedEntries = entries;
  if (blueprintDir) {
    // scoped_terminal에서 task를 특정하지 못한 listing 폴백(finalize remainder 등)은
    // earliest 구현 task의 좁은 명령이 아니라 종단 verification의 전체 명령을 골라야
    // 한다. sort는 안정 정렬이라 같은 종류끼리는 기존 번호 순서를 유지한다.
    if (scoped && selectedEntries.length > 1) {
      const rank = (entry: { rel: string }) => (isVerificationKindDoc(repoRoot, entry.rel) ? 0 : 1);
      selectedEntries = [...selectedEntries].sort((a, b) => rank(a) - rank(b));
    }
    for (const entry of selectedEntries) {
      try {
        const { data } = readDoc(path.join(repoRoot, entry.rel));
        // `data && data.bouncer && data.bouncer.verify`와 같다. bouncer가 null이면
        // declared가 null로 남아 VERIFY_COMMAND_INVALID로 간다 — undefined로
        // 접으면 config.verify로 폴백되어 S12 누락을 숨긴다.
        const bouncer = data ? (data as Record<string, unknown>).bouncer : data;
        const declared = bouncer ? (bouncer as Record<string, unknown>).verify : bouncer;
        if (declared !== undefined) {
          // 셸 연산자·미종료 인용은 config가 깨져 있어도 명령 오류다.
          // 정책을 먼저 보면 VERIFY_CONFIG_INVALID가 그 거절을 가린다.
          if (!parseVerifyArgv(declared)) {
            throw verificationError(
              'VERIFY_COMMAND_INVALID',
              'verify command must be a single executable command',
            );
          }
          const policy = readVerifyPolicy(repoRoot);
          if (policy.ok === false) {
            throw verificationError(
              'VERIFY_CONFIG_INVALID',
              `verification config is invalid: ${configPath}`,
            );
          }
          if (!isValidVerifyCommand(declared, policy.allowlist)) {
            throw verificationError(
              'VERIFY_COMMAND_INVALID',
              'verify command must be a single executable command',
            );
          }
          // isValidVerifyCommand가 통과한 값만 문자열이다. 여기서 다시 접지 않는다.
          return declared as string;
        }
      } catch (error) {
        if (errorCode(error) === 'VERIFY_COMMAND_INVALID') throw error;
        if (errorCode(error) === 'VERIFY_CONFIG_INVALID') throw error;
        if (errorCode(error) === 'VERIFY_IDENTITY_INVALID') throw error;
        if (errorCode(error) !== 'ENOENT') throw error;
      }
    }
  }
  // scoped_terminal은 명령 누락을 config.verify(전체 명령)로 메우지 않는다. 구현
  // task가 전체 suite를 몰래 돌리면 책임 분리가 무너지기 때문이다. 문서가 사라졌거나
  // 선언이 없는 경우 모두 여기서 끊는다.
  if (scoped) {
    throw verificationError(
      'VERIFY_COMMAND_INVALID',
      'scoped_terminal requires a task-owned bouncer.verify; config.verify fallback is not allowed',
    );
  }
  // 파일 없음과 깨진 JSON을 한 오류로 합치면 VERIFY_CONFIG_MISSING이
  // 권한·구문 문제를 가린다. 메시지 문자열은 호출자가 경로를 그대로 보게 유지.
  const parsed = readConfigResult(repoRoot);
  // strict가 꺼진 기본 tsc는 `!parsed.ok`로 유니온을 좁히지 못한다.
  // missing/invalid 분기를 유지하려면 리터럴 false와 비교한다.
  if (parsed.ok === false) {
    if (parsed.reason === 'missing') {
      throw verificationError('VERIFY_CONFIG_MISSING', `verification config missing: ${configPath}`);
    }
    throw verificationError('VERIFY_CONFIG_INVALID', `verification config is invalid: ${configPath}`);
  }
  const config = parsed.value;
  // JSON.parse 결과는 unknown이다. 객체로 좁히면 null config의 TypeError가
  // VERIFY_CONFIG_INVALID로 바뀌므로, 예전처럼 .verify에 바로 접근한다.
  const verify = (config as Record<string, unknown>).verify;
  if (typeof verify !== 'string' || verify.trim() === '') {
    throw verificationError('VERIFY_CONFIG_INVALID', 'config.verify must be a non-empty string');
  }
  return verify;
}

/**
 * verify가 통과한 뒤 lease·pointer가 지목한 commit task만 `ready` → `verified`로 올린다.
 * listing fallback이거나 조건이 아니면 쓰지 않는다(오류가 아님). `tasks.md` 읽기·쓰기
 * 예외는 증적 기록 뒤에 그대로 던져, execute 게이트의 기존 catch가 G13으로 보고한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - 이번 실행 blueprint 상대 경로
 * @param {string} entryRel - 이번 실행이 고른 tasks.md 상대 경로
 * @param {EffectiveTask | null} effectiveTask - 호출자가 선택한 현재 task
 * @returns {void} 조건을 만족하면 상태를 쓰고, 아니면 파일을 바꾸지 않는다
 */
function maybeMarkCommitTaskVerified({
  repoRoot, blueprintDir, entryRel, effectiveTask,
}: {
  repoRoot: string;
  blueprintDir: string;
  entryRel: string;
  effectiveTask: EffectiveTask | null;
}): void {
  // listing fallback을 전환 대상으로 쓰지 않는다. 묶음이 하나여도 lease·pointer가
  // 없으면 이번 실행이 “정해진 task”가 아니다.
  const effective = effectiveTask;
  if (!effective || effective.source === null || typeof effective.path !== 'string') return;
  if (toPosix(effective.blueprint) !== toPosix(blueprintDir)) return;
  if (toPosix(effective.path) !== toPosix(entryRel)) return;

  const file = path.join(repoRoot, entryRel);
  const document = readDoc(file);
  const data = document.data as Record<string, unknown>;
  const bouncer = (data.bouncer || {}) as Record<string, unknown>;
  data.bouncer = bouncer;
  // 필드 부재는 commit. verification kind와 ready가 아닌 상태(이미 verified 포함)는 둔다.
  if (executionKindOf(bouncer) !== 'commit') return;
  if (bouncer.status !== 'ready') return;
  bouncer.status = 'verified';
  fs.writeFileSync(file, renderDoc(data, document.body));
}

/**
 * 선택된 task의 증적 경로를 우선하고 레거시 blueprint 문서로 폴백한다.
 * @param {string} repoRoot - 기존 호출 형태를 보존하는 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @param {Array} entries - 이미 선택된 task 목록
 * @returns {string} 기록할 증적 문서 상대 경로
 */
function resolveVerificationRel(
  repoRoot: string,
  blueprintDir: string,
  entries: Array<{ rel: string; verification?: { rel: string } }>,
): string {
  // 호출자가 이미 고른 목록을 따르며, 목록이 비면 레거시 루트 경로를 쓴다.
  if (entries[0] && entries[0].verification && entries[0].verification.rel) {
    return entries[0].verification.rel;
  }
  return `${toPosix(blueprintDir)}/verification.md`;
}

/**
 * 활성 task의 검증 명령을 실행하거나, 같은 identity·scope의 성공 원장이 있으면
 * process spawn 없이 재사용 증적을 기록한다. identity 계산 실패는 실행으로
 * 우회하지 않는다. `markTaskVerified`가 true이고 결과가 ok이면, 증적 기록 뒤에
 * lease·pointer commit task의 `ready` → `verified` 전환을 시도한다.
 *
 * @param {object} opts - 실행 옵션
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {VerificationScope} [opts.scope] - 생략 시 포인터/첫 task의 stable Task ID
 * @param {string} [opts.taskId] - 세 자리. 있으면 그 task의 verify·verification.md
 * @param {VerifyExec} [opts.exec] - 주입 실행기(테스트용)
 * @param {() => Date} [opts.now] - 시각 주입
 * @param {VerificationDeps} [opts.deps] - git/readFile/platform 주입
 * @param {boolean} [opts.markTaskVerified] - true면 통과 후 commit task 상태 전환. 기본 false
 * @returns {{
 *   ok: boolean, command: string, exitCode: number, evidenceId: string,
 *   reused: boolean, reusedFrom?: string
 * }}
 */
function runVerification({
  repoRoot, blueprintDir, scope: scopeInput, taskId, effectiveTask, exec, now = () => new Date(), deps,
  markTaskVerified = false,
}: {
  repoRoot: string;
  blueprintDir: string;
  scope?: VerificationScope;
  taskId?: string;
  effectiveTask?: EffectiveTask | null;
  exec?: VerifyExec;
  now?: () => Date;
  deps?: VerificationDeps;
  markTaskVerified?: boolean;
}): {
  ok: boolean;
  command: string;
  exitCode: number;
  evidenceId: string;
  reused: boolean;
  reusedFrom?: string;
} {
  // 1. blueprint·명령·문서 존재 — 기존 거절을 identity보다 먼저 유지한다.
  if (!isCanonicalBlueprintDir(blueprintDir)) {
    throw verificationError(
      'VERIFY_BLUEPRINT_INVALID',
      'blueprintDir must be under .bouncer/context/epics',
    );
  }
  if (taskId === undefined && effectiveTask === undefined) {
    throw verificationError('VERIFY_TARGET_REQUIRED', 'runVerification requires taskId or effectiveTask');
  }
  const selectedEntries = selectVerificationEntries(
    repoRoot,
    blueprintDir,
    { taskId, effectiveTask: effectiveTask ?? null },
  );
  const command = readVerifyCommandFor(repoRoot, selectedEntries, blueprintDir);
  const verificationRel = resolveVerificationRel(repoRoot, blueprintDir, selectedEntries);
  const verificationPath = path.join(repoRoot, verificationRel);
  if (!fs.existsSync(verificationPath)) {
    throw verificationError('VERIFY_DOCUMENT_MISSING', `verification document missing: ${verificationPath}`);
  }
  // 같은 정책 목록을 executeVerify에 명시한다. 생략하면 cwd를 다시 읽어
  // 두 표면이 어긋날 수 있고, invalid면 기본 목록으로 실행이 이어진다.
  const policy = readVerifyPolicy(repoRoot);
  if (policy.ok === false) {
    throw verificationError(
      'VERIFY_CONFIG_INVALID',
      `verification config is invalid: ${path.join(repoRoot, '.bouncer', 'config.json')}`,
    );
  }

  // 2. scope·identity는 spawn 전에 확정한다. 실패는 전용 오류.
  const scope = scopeInput
    ? assertVerificationScope(scopeInput)
    : resolveDefaultTaskScope(repoRoot, blueprintDir, effectiveTask ?? null, selectedEntries);
  const { identity, evidenceId } = computeEvidenceIdentity({
    repoRoot, command, scope, deps,
  });

  // 2b. npm terminal 검증은 직접 의존성 metadata가 빠진 integration에서 실행·재사용·증적
  // 쓰기 전에 거절한다. 일반 테스트 실패(failed 기록)와 구분되는 VERIFY_DEPENDENCIES_MISSING이며,
  // 기존 verification.md·원장 bytes를 건드리지 않는다. 비npm 명령과 검사 불가(workspaces 등)는
  // 현행 경로를 유지하고, 출력 문자열이나 비0 종료로 의존성 부족을 추측하지 않는다.
  if (scope.kind === 'terminal' && parseVerifyArgv(command)?.[0] === 'npm') {
    const missing = seedWorktree.missingDirectDependencies(repoRoot);
    if (missing !== null && missing.length > 0) {
      throw verificationError(
        'VERIFY_DEPENDENCIES_MISSING',
        `direct dependencies are not installed in ${repoRoot}: ${missing.join(', ')}`,
      );
    }
  }

  // 3. 성공 v2 원장 hit면 exec를 건너뛰고 원본 ran_at·output을 재기록한다.
  const selected = selectedEntries[0];
  /**
   * 증적 기록이 끝난 뒤에만 상태를 쓴다. 다음 dirty_digest는 달라져 재사용을 놓친다.
   *
   * @param {VerifyFinishResult} result - 이번 실행 또는 재사용 결과
   * @returns {VerifyFinishResult} 호출자에게 그대로 돌려줄 결과
   */
  const finish = (result: VerifyFinishResult) => {
    if (markTaskVerified && result.ok && selected && selected.rel) {
      maybeMarkCommitTaskVerified({
        repoRoot,
        blueprintDir,
        entryRel: selected.rel,
        effectiveTask: effectiveTask ?? null,
      });
    }
    return result;
  };

  const existing = findReusableEvidence(repoRoot, verificationRel, identity, evidenceId);
  if (existing) {
    recordVerificationResult({
      repoRoot, verificationRel, command, ranAt: existing.ran_at, exitCode: 0,
      output: typeof existing.output_tail === 'string' ? existing.output_tail : '',
      evidenceId, identity, scope, reused: true, reusedFrom: existing.evidence_id, deps,
    });
    return finish({
      ok: true, command, exitCode: 0, evidenceId, reused: true, reusedFrom: existing.evidence_id,
    });
  }

  // 4. cache miss — 실제 명령을 한 번 실행하고 v2 증적을 남긴다.
  const execution = executeVerify(command, {
    cwd: repoRoot,
    exec,
    allowlist: policy.allowlist,
  });
  const ranAt = nowIsoKst(now());
  recordVerificationResult({
    repoRoot,
    verificationRel,
    command,
    ranAt,
    exitCode: execution.exitCode,
    output: execution.output,
    evidenceId,
    identity,
    scope,
    reused: false,
    deps,
  });
  return finish({
    ok: execution.ok,
    command,
    exitCode: execution.exitCode,
    evidenceId,
    reused: false,
  });
}

export = {
  OUTPUT_TAIL_LINES,
  PASSING_OUTPUT_TAIL_LINES,
  MAX_VERIFY_OUTPUT_BYTES,
  parseVerifyArgv,
  isValidVerifyCommand,
  selectVerificationEntries,
  readVerifyCommandFor,
  executeVerify,
  recordVerificationResult,
  runVerification,
  computeSourceDigest,
};
