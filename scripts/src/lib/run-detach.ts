// scripts/lib/run-detach.js
'use strict';
const { execFileSync: realExecFileSync } = require('node:child_process');
import scope = require('./scope');
const { readCoordinatorLedger, withLedgerLock, writeLedgerFile } = scope;
import runtimeState = require('./runtime-state');
const { pointerKeyFromBlueprint, removeNamespacePointer } = runtimeState;

type GitFn = (cwd: string, args: string[]) => string;

type DetachDeps = {
  /** `git <args>`를 cwd에서 실행해 trim된 stdout을 돌려준다. 실패하면 던진다. */
  git?: GitFn;
  /** 결정 기록 시각(ISO 8601). */
  now?: () => string;
};

type DetachFail = {
  ok: false;
  reason: string;
  tasks?: string[];
  ledgerFile?: string;
};

type DetachOk = {
  ok: true;
  ledger: string;
  pointer_removed: boolean;
  already?: true;
  next: string;
};

const defaultGit: GitFn = (cwd, args) => String(realExecFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
})).trim();

/**
 * 관찰용 HEAD를 읽는다. detach의 성공 조건이 아니라 기록용 값이므로(병합 여부를
 * 증거로 쓰지 않는다) 읽지 못하면 null로 남긴다.
 *
 * @param {GitFn} git - git 실행 함수
 * @param {string | undefined} cwd - HEAD를 읽을 worktree
 * @returns {string | null} HEAD sha. cwd가 없거나 git이 실패하면 null
 */
function observedHead(git: GitFn, cwd: string | undefined): string | null {
  if (!cwd) return null;
  try {
    return git(cwd, ['rev-parse', 'HEAD']);
  } catch (_error) {
    // git 실행 실패(worktree가 이미 정리됨, git 부재 등)만 흡수한다. 이 값은 사람이
    // 읽는 관찰 기록일 뿐 분리 판정에 쓰이지 않으므로 null이 안전한 폴백이다.
    return null;
  }
}

/**
 * Git 병합이 끝난 뒤에도 남은 활성 실행 상태를 기록을 보존한 채 분리한다.
 *
 * 사용자가 승인(`yes`)한 경우에만 동작한다. ledger 파일·worktree·branch는 지우지 않고,
 * ledger `status`를 `detached`로 두면서 `detached` decision을 append하며, 해당 blueprint의
 * 포인터 key 하나만 지운다. 검증 성공이나 finalize로 기록하지 않는다.
 * 이미 분리된 ledger는 아무것도 바꾸지 않고 `already: true`로 성공한다(분리 뒤 사용자가
 * finalize를 위해 포인터를 다시 세웠을 수 있어, 재실행이 그것을 지우면 안 된다).
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 메인 checkout 루트
 * @param {string} opts.blueprint - blueprint 디렉터리 상대 경로
 * @param {string} [opts.reason] - 분리 사유(선택, decision에 기록)
 * @param {boolean} opts.yes - 사용자 승인. true가 아니면 어떤 것도 바꾸지 않는다
 * @param {DetachDeps} [opts.deps] - git·시계 주입
 * @returns {DetachOk | DetachFail} 성공 시 ledger 경로·포인터 삭제 여부·다음 안내,
 *   실패 시 reason(`detach-confirmation-required`, `no-ledger`, `unreadable-ledger`,
 *   `detach-awaiting-confirmation`, `detach-worker-in-flight`, `ledger-locked` 등).
 *   모든 실패에서 ledger와 포인터는 바뀌지 않는다.
 */
function detachRun({ repoRoot, blueprint, reason, yes, deps }: {
  repoRoot: string;
  blueprint: string;
  reason?: string;
  yes: boolean;
  deps?: DetachDeps;
}): DetachOk | DetachFail {
  const git = (deps && deps.git) || defaultGit;
  const now = (deps && deps.now) || (() => new Date().toISOString());

  // 1. 승인 없는 경로를 만들지 않는다: ledger를 읽기 전에 먼저 막는다.
  if (yes !== true) return { ok: false, reason: 'detach-confirmation-required' };

  // 2. 포인터 key는 쓰기 전에 계산한다. 경로에서 id를 못 뽑으면 throw하므로
  //    ledger를 건드리기 전에 실패시켜 부분 변경을 막는다.
  const { key } = pointerKeyFromBlueprint(blueprint);

  const first = readCoordinatorLedger({ repoRoot, blueprint });
  if (!first.ok) {
    return { ok: false, reason: first.reason, ledgerFile: first.ledgerFile };
  }
  const ledgerFile = first.ledgerFile as string;
  const nextHint = `To finalize, run \`bouncer current --set ${blueprint}\` and then /bouncer-finalize.`;

  return withLedgerLock(ledgerFile, () => {
    // 3. 잠금 안에서 다시 읽는다 — 위 읽기 뒤에 다른 writer가 상태를 바꿨을 수 있다.
    const read = readCoordinatorLedger({ repoRoot, blueprint });
    if (!read.ok) return { ok: false as const, reason: read.reason, ledgerFile };
    const ledger = read.ledger as {
      status?: string; tasks?: Array<{
        id: string; status?: string; dispatch?: { status?: string };
      }>; decisions?: unknown[]; integrationHead?: string;
    };
    const previous = ledger.status || 'active';
    if (previous === 'detached') {
      return { ok: true as const, ledger: ledgerFile, pointer_removed: false, already: true as const, next: nextHint };
    }
    // 사용자 확인 흐름(repair wave 한도 뒤 결정)을 detach로 우회하지 않는다.
    if (previous === 'awaiting_confirmation') {
      return { ok: false as const, reason: 'detach-awaiting-confirmation' };
    }
    const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
    const inFlight = tasks.filter((item) => item && (
      (item.dispatch && (item.dispatch.status === 'active' || item.dispatch.status === 'reported'))
      || item.status === 'prepared' || item.status === 'recorded'
    )).map((item) => item.id);
    if (inFlight.length > 0) {
      return { ok: false as const, reason: 'detach-worker-in-flight', tasks: inFlight };
    }

    // 4. 기존 decision은 그대로 두고 append만 한다. 관찰 HEAD는 기록용이다.
    const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
    decisions.push({
      kind: 'detached',
      at: now(),
      reason: typeof reason === 'string' && reason !== '' ? reason : null,
      integration_head: observedHead(git, read.integrationPath),
      main_head: observedHead(git, repoRoot),
      previous_status: previous,
    });
    ledger.decisions = decisions;
    ledger.status = 'detached';
    writeLedgerFile(ledgerFile, ledger);

    // 5. 이 blueprint의 key 하나만 지운다. 다른 key와 ledger·worktree·branch는 그대로다.
    const removed = removeNamespacePointer({ repoRoot, key });
    return { ok: true as const, ledger: ledgerFile, pointer_removed: removed, next: nextHint };
  }) as DetachOk | DetachFail;
}

export = { detachRun };
