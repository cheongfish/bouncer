'use strict';
const fs = require('node:fs');
const path = require('node:path');
import configMod = require('./config');
import commandArgv = require('./command-argv');
import scopeMod = require('./scope');
import coordinatorGit = require('./coordinator-git');
import coordinatorLedger = require('./coordinator-ledger');
import coordinatorVerification = require('./coordinator-verification');
import type { Exec, Ledger } from './execution-contracts';

const { readConfig, readWorktreeBaseline, readWorktreeSetup, getVerifyAllowlist } = configMod;
const { parseVerifyArgv, isValidVerifyCommand } = commandArgv;
const { withLedgerLock } = scopeMod;
const { git } = coordinatorGit;
const { ledgerBytesHash, recheckLedgerCheckpoint, writeOwnedLedger } = coordinatorLedger;
const { prepareVerificationDependencies } = coordinatorVerification;

/** base CI 한 번의 결과 기록. 원장 `decisions` 끝에 append-only로 쌓이고 마지막 항목이 현재 상태다. */
export type BaselineDecision = {
  kind: 'baseline'; command: string; exit: number; head: string; accepted: boolean; written_at: string;
};

// 시간 초과 상한(30분). 이 안에 끝나지 않는 baseline은 CI가 아니라 hang이라 124로 접는다.
const BASELINE_TIMEOUT_MS = 1_800_000;
// 시간 초과·신호 종료와 실행 파일 부재의 exit 값. shell 관례(timeout 124, command not found 127)를 따른다.
const EXIT_TIMEOUT = 124;
const EXIT_SPAWN_FAILED = 127;

// Exec 타입은 timeout을 모르므로 baseline 호출에 한해서만 넓힌다(execution-contracts는 이 task 범위 밖).
type BaselineExec = (file: string, args: readonly string[], options: {
  cwd: string; encoding: string; stdio: unknown; timeout: number;
}) => string | Buffer | null;

/**
 * 이 원장에서 baseline을 아직 돌려야 하는지 판정한다. exit 0 결정이나 수락된(`accepted`) 결정이
 * 하나라도 있으면 끝난 것이다. 실패만 쌓여 있으면 다음 prepare가 다시 돌린다.
 *
 * @param {Ledger} ledger - 코디네이터 원장
 * @returns {boolean} baseline을 돌려야 하면 true
 */
export function baselineNeeded(ledger: Ledger): boolean {
  const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
  return !decisions.some((entry) => {
    const decision = entry as Partial<BaselineDecision> | null;
    return decision !== null && typeof decision === 'object' && decision.kind === 'baseline'
      && (decision.exit === 0 || decision.accepted === true);
  });
}

/**
 * 던져진 spawn 오류를 baseline exit 값으로 바꾼다. 정상 종료는 그 코드, 시간 초과·신호 종료는 124,
 * 그 밖의 spawn 실패(ENOENT 등)는 127이다.
 *
 * @param {unknown} error - execFileSync가 던진 오류
 * @returns {number} 기록할 exit 값
 */
function exitCodeOf(error: unknown): number {
  const failure = (error ?? {}) as { status?: unknown; code?: unknown; signal?: unknown };
  if (typeof failure.status === 'number') return failure.status;
  if (failure.code === 'ETIMEDOUT' || typeof failure.signal === 'string') return EXIT_TIMEOUT;
  return EXIT_SPAWN_FAILED;
}

/**
 * baseline argv를 integration cwd에서 실행하고 exit 값과 그때의 integration HEAD를 돌려준다.
 * 어떤 실패도 throw하지 않는다 — 실패는 exit 값(`exitCodeOf`)으로 기록되어 prepare가 판정한다.
 * 출력은 stderr로 보내 coordinate stdout JSON 계약을 오염시키지 않는다.
 *
 * @param {object} opts - 실행 입력
 * @param {string} opts.integrationPath - 실행 cwd이자 HEAD를 읽을 checkout
 * @param {string[]} opts.argv - 허용 목록 검사를 마친 argv(셸 문자열이 아니다)
 * @param {Exec} opts.exec - execFileSync 호환 주입 실행기
 * @returns {{ exit: number, head: string }} exit 값과 integration HEAD(읽지 못하면 빈 문자열)
 */
export function runBaseline(opts: { integrationPath: string; argv: string[]; exec: Exec }): {
  exit: number; head: string;
} {
  const { integrationPath, argv, exec } = opts;
  let exit = 0;
  try {
    (exec as unknown as BaselineExec)(argv[0], argv.slice(1), {
      cwd: integrationPath, encoding: 'utf8', stdio: ['ignore', 2, 2], timeout: BASELINE_TIMEOUT_MS,
    });
  } catch (error) {
    // 명령 실패·시간 초과·spawn 실패는 모두 exit 값으로 접는다. "baseline이 깨졌다"는 판정 입력이지
    // 프로그램 오류가 아니므로 던지면 prepare가 사용법 오류처럼 죽는다.
    exit = exitCodeOf(error);
  }
  let head = '';
  try {
    head = git(exec, integrationPath, ['rev-parse', 'HEAD']);
  } catch (_error) {
    // HEAD는 결정에 붙는 참고 기록이다. 읽지 못해도 baseline 판정(exit)은 유효하므로 빈 값으로 둔다.
  }
  return { exit, head };
}

/**
 * main checkout의 `.bouncer/config.json`을 읽는다. 출처는 `worktree.setup`과 같은 main checkout이다
 * (`git worktree list --porcelain`의 첫 항목). main checkout이나 config를 못 찾으면 null — 미설정과
 * 같이 취급해 설정 없는 저장소의 prepare를 막지 않는다.
 *
 * @param {string} integrationPath - integration checkout
 * @param {Exec} exec - Git 실행기
 * @returns {unknown} 파싱된 config. 찾지 못하면 null
 */
export function readMainConfig(integrationPath: string, exec: Exec): unknown {
  let listed: string;
  try {
    listed = git(exec, integrationPath, ['worktree', 'list', '--porcelain']);
  } catch (_error) {
    // git이 worktree 목록을 못 주는 경우는 main checkout을 알 수 없는 것이므로 미설정으로 접는다.
    return null;
  }
  const first = listed.split('\n').find((line) => line.startsWith('worktree '));
  return first ? readConfig(first.slice('worktree '.length)) : null;
}

/**
 * config의 `worktree.baseline`을 읽어 실행 가능한 argv로 바꾼다. 문자열이 아니거나 허용 목록 밖
 * 단일 명령이 아니면 invalid — 값을 조용히 무시하면 운영자가 base 검사가 돈다고 믿게 된다.
 *
 * @param {unknown} config - main checkout config(없으면 null)
 * @returns {{ ok: true, command: string, argv: string[] } | { ok: true, command: null, argv: null }
 *   | { ok: false }} 미설정은 command:null, 형태·허용 목록 위반은 ok:false
 */
export function readBaselineTarget(config: unknown):
  { ok: true; command: string; argv: string[] } | { ok: true; command: null; argv: null } | { ok: false } {
  const read = readWorktreeBaseline(config);
  if (!read.ok) return { ok: false };
  if (read.command === null) return { ok: true, command: null, argv: null };
  if (!isValidVerifyCommand(read.command, getVerifyAllowlist(config))) return { ok: false };
  return { ok: true, command: read.command, argv: parseVerifyArgv(read.command) as string[] };
}

/**
 * build 스크립트가 있는데 `worktree.setup`이 없을 때만 경고를 낸다. worktree는 `worktree.setup`으로만
 * 빌드하므로 이 조합이면 산출물 없는 worktree에서 검증하게 된다. package.json이 없거나 깨졌으면 build가
 * 없는 것으로 본다(경고는 안내일 뿐 prepare를 막지 않는다). setup 값이 있으면(형태가 틀려도) 운영자가
 * 이미 손댄 것이므로 경고하지 않는다.
 *
 * @param {object} opts - 판정 입력
 * @param {string} opts.integrationPath - `package.json`을 읽을 integration checkout
 * @param {unknown} opts.config - main checkout config(없으면 null)
 * @returns {Array<{ kind: 'worktree-setup-unset' }>} 조건이 맞으면 경고 하나, 아니면 빈 배열
 */
export function setupWarnings(opts: { integrationPath: string; config: unknown }):
  Array<{ kind: 'worktree-setup-unset' }> {
  let hasBuild = false;
  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(path.join(opts.integrationPath, 'package.json'), 'utf8'));
    const scripts = (pkg as { scripts?: unknown } | null)?.scripts;
    hasBuild = typeof scripts === 'object' && scripts !== null
      && typeof (scripts as { build?: unknown }).build === 'string';
  } catch (error) {
    // 파일 부재(ENOENT)와 깨진 JSON(SyntaxError)만 "build 없음"으로 흡수한다. 권한 오류 등은 숨기지 않는다.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  if (!hasBuild) return [];
  const setup = readWorktreeSetup(opts.config);
  const configured = !setup.ok || (setup.command !== null && setup.command.trim() !== '');
  return configured ? [] : [{ kind: 'worktree-setup-unset' }];
}

/**
 * 첫 prepare의 baseline 단계: integration 의존성 준비 → 잠금 밖 실행 → 잠금 재획득 뒤 결정 기록.
 * 결과 쓰기는 phase 1 이후 원장이 그대로일 때만 한다(실행이 길어 잠금 밖에서 돌기 때문). 실패 baseline은
 * `acceptBroken`이 있을 때만 수락(`accepted: true`)하며, 플래그 재실행도 baseline을 새로 돌려 그 실행의
 * exit·head를 기록한다. 통과해도 `accepted`는 false다(플래그는 효과 없음).
 *
 * @param {object} opts - 단계 입력
 * @param {string} opts.ledgerFile - 원장 경로
 * @param {string} opts.integrationPath - integration checkout
 * @param {Ledger} opts.ledger - phase 1 원장(성공 시 결정을 여기에도 더해 phase 3 쓰기가 잃지 않게 한다)
 * @param {string} opts.phase1Hash - phase 1 원장 bytes hash
 * @param {{ command: string, argv: string[] }} opts.baseline - 실행할 baseline
 * @param {boolean} opts.acceptBroken - `--accept-broken-baseline` 여부
 * @param {Exec} opts.exec - 주입 실행기
 * @param {(file: string, data: unknown) => void} opts.writeLedger - 원자적 원장 쓰기
 * @returns {{ ok: true, hash: string } | { ok: false, result: unknown }} 진행하면 쓰기 뒤 원장 hash,
 *   멈추면 prepare가 그대로 돌려줄 거절 결과(의존성 실패·baseline-ci-failed·재확인 거절)
 */
export function runBaselineStep(opts: {
  ledgerFile: string; integrationPath: string; ledger: Ledger; phase1Hash: string;
  baseline: { command: string; argv: string[] }; acceptBroken: boolean;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
}): { ok: true; hash: string } | { ok: false; result: unknown } {
  const { ledgerFile, integrationPath, ledger, baseline, exec } = opts;
  // 1. 의존성 실패는 결정을 남기지 않는다 — 환경 문제이지 base의 상태가 아니다.
  const prepared = prepareVerificationDependencies(integrationPath, exec);
  if (!prepared.ok) return { ok: false, result: prepared };
  // 2. 잠금 밖 실행. 원장 .lock이 없어야 다른 명령이 기다리지 않는다.
  const run = runBaseline({ integrationPath, argv: baseline.argv, exec });
  const decision: BaselineDecision = {
    kind: 'baseline', command: baseline.command, exit: run.exit, head: run.head,
    accepted: run.exit !== 0 && opts.acceptBroken, written_at: new Date().toISOString(),
  };
  // 3. 잠금 재획득: phase 1 이후 원장이 바뀌었으면 재확인 거절 reason을 그대로 돌려주고 쓰지 않는다.
  const written = withLedgerLock(ledgerFile, (owns) => {
    const rechecked = recheckLedgerCheckpoint({ ledgerFile, expectedHash: opts.phase1Hash });
    if (!rechecked.ok) return rechecked;
    rechecked.ledger.decisions.push(decision);
    const lost = writeOwnedLedger(owns, opts.writeLedger, ledgerFile, rechecked.ledger);
    if (lost) return lost;
    return { ok: true as const, hash: ledgerBytesHash(fs.readFileSync(ledgerFile)) };
  });
  if (!written || (written as { ok?: boolean }).ok !== true) return { ok: false, result: written };
  ledger.decisions.push(decision);
  if (decision.exit !== 0 && !decision.accepted) {
    return {
      ok: false,
      result: { ok: false, reason: 'baseline-ci-failed', command: baseline.command, exit: run.exit },
    };
  }
  return { ok: true, hash: (written as { hash: string }).hash };
}
