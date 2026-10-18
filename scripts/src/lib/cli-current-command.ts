'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
const { execFileSync } = require('node:child_process');
import validate = require('./validate');
const { validateBlueprint } = validate;
import current = require('./current');
const {
  writeCurrent, clearCurrent, listReadyBlueprints, baseNamespaceKeys,
  resolvePointerTask, presentCurrent, resolveCurrent, CurrentSelectionError,
} = current;
import config = require('./config');
const { readConfig } = config;
import runtimeState = require('./runtime-state');
const {
  listNamespacePointers, pointerKeyFromBlueprint, writeApprovalSnapshot,
} = runtimeState;
import approvalSnapshot = require('./approval-snapshot');
const { computeApprovalDigest } = approvalSnapshot;

type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

type PreviousPointer = {
  blueprint: string;
  base: string;
  task: string | null;
};

/**
 * 교체 전 포인터를 파일 본문과 같은 `{ blueprint, base, task }`로 고정한다.
 * presentCurrent의 path+id·scale은 넣지 않는다. 진단 payload를 파일과
 * 1:1로 맞춰 복사·바이트 비교가 가능하게 한다.
 *
 * @param {{ blueprint: string, base: string, task: string | null }} stored - readCurrent 결과
 * @returns {{ blueprint: string, base: string, task: string | null }} stdout/stderr 공용 previous
 */
function previousPayload(stored: PreviousPointer): PreviousPointer {
  return {
    blueprint: stored.blueprint,
    base: stored.base,
    task: stored.task == null ? null : stored.task,
  };
}

/**
 * 기존 포인터를 stderr에 JSON 한 줄로 남겨 셸에서 복사할 수 있게 한다.
 * pretty stdout과 키는 같고 개행만 다르다.
 *
 * @param {CliIo} io - stderr 싱크
 * @param {PreviousPointer} previous - previousPayload 결과
 * @returns {void}
 */
function emitPrevious(io: CliIo, previous: PreviousPointer) {
  io.err(`previous: ${JSON.stringify(previous)}\n`);
}

function storedCandidate(pointer: PreviousPointer): PreviousPointer {
  return previousPayload(pointer);
}

function isSelectionError(error: unknown): error is InstanceType<typeof CurrentSelectionError> {
  return error instanceof CurrentSelectionError
    || (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && typeof (error as { code: unknown }).code === 'string'
      && String((error as { code: string }).code).startsWith('CURRENT_')
    );
}

/**
 * 모호성·충돌·이관 미완료를 종료 코드 1로 내고 상태는 그대로 둔다.
 * candidates는 저장 구조(task 문자열|null)이며 presentCurrent의 path+id·scale을 넣지 않는다.
 *
 * @param {CliIo} io - stdout 싱크
 * @param {InstanceType<typeof CurrentSelectionError>} error - 선택/이관 오류
 * @returns {number} 항상 1
 */
function emitSelectionFailure(io: CliIo, error: InstanceType<typeof CurrentSelectionError>): number {
  const payload: {
    ok: false;
    reason: string;
    candidates?: PreviousPointer[];
    issues?: Array<{ path: string; reason: string }>;
    next?: string[];
  } = { ok: false, reason: error.code };
  if (error.candidates) {
    payload.candidates = error.candidates.map(storedCandidate);
  }
  if (error.issues) payload.issues = error.issues;
  // 모호성은 사용자가 풀어야 하는 상태라 다음 행동을 같이 낸다. INVALID는 파일 수리가
  // 필요해 일반 안내가 맞지 않으므로 next 없이 둔다.
  if (error.code === 'CURRENT_AMBIGUOUS') {
    payload.next = [
      'run `bouncer current` from the candidate worktree (.worktrees/<epic>/<bp>)',
      'or pick one candidate blueprint and run `bouncer current --set <blueprint dir> --replace`',
    ];
  }
  io.out(`${JSON.stringify(payload, null, 2)}\n`);
  return 1;
}

function emitResolutionFailure(
  io: CliIo,
  resolution: Extract<ReturnType<typeof resolveCurrent>, { status: 'ambiguous' | 'invalid' }>,
): number {
  const err = resolution.status === 'ambiguous'
    ? new CurrentSelectionError({ code: 'CURRENT_AMBIGUOUS', candidates: resolution.candidates })
    : new CurrentSelectionError({
      code: 'CURRENT_INVALID',
      issues: resolution.issues,
      candidates: resolution.candidates,
    });
  return emitSelectionFailure(io, err);
}

/**
 * base checkout에서 새 key를 더하면 선택이 모호해지는 `--set`을 쓰기 전에 거절한다.
 * 포인터 파일은 건드리지 않는다. `--replace`는 기존 key가 정확히 하나일 때만 next에
 * 싣는다 — 둘 이상이면 어느 key를 지울지 추측할 수 없어 cmdCurrent도 거절하기 때문.
 *
 * @param {CliIo} io - stdout 싱크
 * @param {string} blueprintDir - `--set` 대상
 * @param {string | undefined} taskArg - 사용자가 준 `--task` 값(있으면 명령 문자열에 보존)
 * @param {PreviousPointer[]} existing - 이미 저장된 base key들의 저장 형태(blueprint 순)
 * @returns {number} 항상 1
 */
function emitWouldBeAmbiguous(
  io: CliIo,
  blueprintDir: string,
  taskArg: string | undefined,
  existing: PreviousPointer[],
): number {
  const base = `bouncer current --set ${blueprintDir}${taskArg ? ` --task ${taskArg}` : ''}`;
  const next = [
    ...(existing.length === 1 ? [`${base} --replace`] : []),
    `${base} --keep-others`,
  ];
  const payload = {
    ok: false,
    reason: 'CURRENT_WOULD_BE_AMBIGUOUS',
    candidates: existing,
    next,
  };
  io.out(`${JSON.stringify(payload, null, 2)}\n`);
  return 1;
}

/**
 * 활성 포인터를 읽거나 `--set`/`--clear`로 바꾼다.
 * namespace 전환 뒤 기본 `--set`은 대상 키만 추가·갱신하고 다른 키를 보존한다.
 * `--replace`는 현재 위치에서 유일하게 선택된 키를 지운 뒤 대상을 쓰며,
 * 다중 후보에서는 대상을 추측하지 않고 종료 코드 1이다.
 * base checkout에서 새 key가 더해져 선택이 모호해질 `--set`은 plan gate 전에 거절하며
 * (`CURRENT_WOULD_BE_AMBIGUOUS`), `--replace` 또는 `--keep-others`로 의도를 밝혀야 한다.
 * 대상 namespace 포인터가 없을 때와 `--reapprove`일 때만 승인 파일을 기록한다.
 * 이미 있는 포인터에 task만 전진하면 승인 파일을 건드리지 않아 `/bouncer-commit`의
 * `--set --task`가 매번 재승인되지 않게 한다.
 *
 * @param {string[]} rest - `current` 다음 CLI 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, plan/base/모호성 실패 1, 사용법 거절 2
 */
function cmdCurrent(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  // hasOwnProperty: --set/--task/--replace 가 boolean true(값 없음)여도 "요청함"으로 본다.
  // truthy 문자열만 보면 `--set` 단독이 아래 분기를 건너뛴다.
  const wantsSet = Object.prototype.hasOwnProperty.call(f, 'set');
  const wantsClear = f.clear === true;
  const wantsTask = Object.prototype.hasOwnProperty.call(f, 'task');
  const wantsReplace = Object.prototype.hasOwnProperty.call(f, 'replace');
  const wantsKeepOthers = Object.prototype.hasOwnProperty.call(f, 'keep-others');
  const wantsReapprove = Object.prototype.hasOwnProperty.call(f, 'reapprove');

  // 모순을 값 검증보다 먼저: 어느 값을 고쳐야 하는지 알 수 없는 채
  // "--set requires a blueprint directory"로 떨어지지 않게 한다.
  if (wantsSet && wantsClear) {
    io.err('current: --set and --clear are mutually exclusive\n');
    return 2;
  }
  if (wantsClear && wantsTask) {
    io.err('current: --clear and --task are mutually exclusive\n');
    return 2;
  }
  if (wantsClear && wantsReplace) {
    io.err('current: --clear and --replace are mutually exclusive\n');
    return 2;
  }
  if (wantsKeepOthers && wantsClear) {
    io.err('current: --clear and --keep-others are mutually exclusive\n');
    return 2;
  }
  if (wantsKeepOthers && wantsReplace) {
    io.err('current: --replace and --keep-others are mutually exclusive\n');
    return 2;
  }
  if (wantsKeepOthers && !wantsSet) {
    io.err('current: --keep-others requires --set\n');
    return 2;
  }
  if (wantsTask && !wantsSet) {
    io.err('current: --task requires --set\n');
    return 2;
  }
  if (wantsReplace && !wantsSet) {
    io.err('current: --replace requires --set\n');
    return 2;
  }
  if (wantsReapprove && !wantsSet) {
    io.err('current: --reapprove requires --set\n');
    return 2;
  }
  if (wantsSet && (typeof f.set !== 'string' || f.set === '')) {
    io.err('current: --set requires a blueprint directory\n');
    return 2;
  }

  const repoRoot = (f.repo || process.cwd()) as string;

  if (wantsClear) {
    // set보다 먼저 return. 모순은 위에서 이미 거절했으므로 여기선 선택된 키만 지운다.
    try {
      clearCurrent({ repoRoot });
    } catch (error) {
      if (isSelectionError(error)) return emitSelectionFailure(io, error);
      throw error;
    }
    io.out(`${JSON.stringify({ ok: true, current: null }, null, 2)}\n`);
    return 0;
  }

  if (wantsSet) {
    const blueprintDir = f.set as string;
    let previous: PreviousPointer | null = null;
    let replaceKey: string | null | undefined;
    const selection = resolveCurrent({ repoRoot });
    if (selection.status === 'invalid') {
      return emitResolutionFailure(io, selection);
    }
    if (wantsReplace) {
      // 기준 checkout의 다중 후보는 어느 키를 지울지 추측하지 않는다.
      if (selection.status === 'ambiguous') {
        return emitResolutionFailure(io, selection);
      }
      if (selection.status === 'selected' && selection.current.blueprint !== blueprintDir) {
        previous = previousPayload(selection.current);
        replaceKey = selection.key;
      }
    }
    // plan gate보다 먼저: 거절될 요청에 gate 비용·부수효과를 쓰지 않는다. key는
    // writeCurrent와 같은 pointerKeyFromBlueprint로 계산해 판정이 쓰기와 어긋나지 않는다.
    // 같은 key 갱신·nested/flat worktree·--replace는 새 모호성을 만들지 않으므로 통과한다.
    const targetKey = pointerKeyFromBlueprint(blueprintDir).key;
    const baseKeys = wantsReplace ? null : baseNamespaceKeys({ repoRoot });
    const existingEntries = baseKeys
      ? listNamespacePointers({ repoRoot })
        .filter((e) => e.pointer != null && e.key !== targetKey)
      : [];
    // 쓰기 뒤 key가 2개 이상이 되는 경우(= 기존 key가 있고 대상이 새 key)만 거절한다.
    if (baseKeys && !wantsKeepOthers && !baseKeys.includes(targetKey) && baseKeys.length >= 1) {
      const existing = existingEntries
        .map((e) => previousPayload(e.pointer as PreviousPointer))
        .sort((x, y) => (x.blueprint < y.blueprint ? -1 : x.blueprint > y.blueprint ? 1 : 0));
      return emitWouldBeAmbiguous(
        io,
        blueprintDir,
        typeof f.task === 'string' ? f.task : undefined,
        existing,
      );
    }
    const result = validateBlueprint({
      repoRoot,
      blueprintDir,
      gate: 'plan',
    });
    if (!result.ok) {
      // failures를 그대로 전달 — plan gate가 권위; 실패한 brief에는 pointer를
      // 쓰지 않음.
      io.out(`${JSON.stringify({ ok: false, failures: result.failures }, null, 2)}\n`);
      return 1;
    }
    // plan 통과 뒤에만 task 해석·포인터 기록. 해석 실패는 사용법 오류(2).
    const taskSpec = wantsTask ? f.task : undefined;
    if (wantsTask && (typeof taskSpec !== 'string' || taskSpec === '')) {
      io.err('current: --task requires a task id (NNN or TASKS-NNN)\n');
      return 2;
    }
    const resolved = resolvePointerTask({
      repoRoot,
      blueprintDir,
      task: typeof taskSpec === 'string' ? taskSpec : undefined,
    });
    if (!resolved.ok) {
      const ids = (resolved.available || [])
        .map((t: { id: string }) => t.id)
        .filter(Boolean)
        .join(', ');
      io.err(
        `current: cannot resolve --task ${JSON.stringify(taskSpec)}`
        + (ids ? ` (available: ${ids})` : '')
        + '\n',
      );
      return 2;
    }
    let base = typeof f.base === 'string' ? f.base : undefined;
    if (!base) {
      // 부재·깨진 JSON을 {}로 삼킨다. --set은 base_branch만 읽고, 없으면
      // 현재 체크아웃 브랜치. init이 탐지 실패 시 키를 비우므로 이 폴백이
      // 기본 경로다. develop/main을 추측하지 않는다.
      const config = (readConfig(repoRoot) ?? {}) as Record<string, unknown>;
      if (config && typeof config.base_branch === 'string' && config.base_branch) {
        base = config.base_branch;
      } else {
        try {
          const out = execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          base = String(out).trim();
        } catch (_e) {
          base = '';
        }
      }
    }
    // init과 같이 실패한 HEAD를 빈 문자열·develop으로 바꾸지 않는다.
    // 포인터에 빈 base를 쓰면 finalize PR이 없는 브랜치를 향한다.
    if (!base) {
      io.err('current: cannot resolve base (no config.base_branch and HEAD is not a branch)\n');
      return 1;
    }
    const pointerKey = pointerKeyFromBlueprint(blueprintDir).key;
    const pointerExisted = listNamespacePointers({ repoRoot })
      .some((entry) => entry.key === pointerKey);
    // 포인터가 이미 있으면 task 전진만으로 승인 파일을 덮지 않는다.
    // `--reapprove`만 사용자가 명시한 재승인이다 (AGENTS.md hard rule 3).
    const recordApproval = wantsReapprove || !pointerExisted;
    const computed = recordApproval
      ? computeApprovalDigest({ repoRoot, blueprintDir })
      : null;
    try {
      writeCurrent({
        repoRoot,
        blueprint: blueprintDir,
        base,
        task: resolved.task || undefined,
        replace: wantsReplace,
        replaceKey,
      });
    } catch (error) {
      if (isSelectionError(error)) return emitSelectionFailure(io, error);
      throw error;
    }
    let approval: 'recorded' | 'unchanged' = 'unchanged';
    if (computed) {
      writeApprovalSnapshot({
        repoRoot,
        blueprintDir,
        digest: computed.digest,
        parts: computed.parts,
      });
      approval = 'recorded';
    }
    // 방금 쓴 키를 보여 준다. 위치 기반 재해석은 병렬 추가 뒤 base에서
    // CURRENT_AMBIGUOUS가 되어 성공한 --set을 실패로 뒤집는다.
    const stored = {
      blueprint: blueprintDir,
      base,
      task: typeof resolved.task === 'string' ? resolved.task : null,
    };
    const current = presentCurrent(stored, { repoRoot });
    // --keep-others로 병렬 key를 남겼다는 사실을 호출자가 볼 수 있게 한다.
    const others = wantsKeepOthers && existingEntries.length > 0
      ? existingEntries.map((e) => ({ blueprint: (e.pointer as PreviousPointer).blueprint }))
      : undefined;
    if (previous) {
      emitPrevious(io, previous);
      io.out(`${JSON.stringify({ ok: true, current, previous, approval }, null, 2)}\n`);
    } else {
      io.out(`${JSON.stringify({ ok: true, current, ...(others ? { others } : {}), approval }, null, 2)}\n`);
    }
    return 0;
  }

  // 없음도 오류가 아닌 상태: unset이면 ready list를 붙여 execute가
  // "planned but unset"과 "nothing planned"를 구분하게 함.
  // 다중 후보·충돌은 상태를 바꾸지 않고 종료 코드 1.
  const shown = resolveCurrent({ repoRoot });
  if (shown.status === 'selected') {
    const current = presentCurrent(shown.current, { repoRoot });
    io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
    return 0;
  }
  if (shown.status === 'empty') {
    const ready = listReadyBlueprints({ repoRoot });
    io.out(`${JSON.stringify({ ok: true, current: null, ready }, null, 2)}\n`);
    return 0;
  }
  return emitResolutionFailure(io, shown);
}

export = {
  current: {
    run: cmdCurrent,
    usage: `  current    [--set <blueprint dir> [--base <branch>] [--task <NNN|TASKS-NNN>] [--replace] [--keep-others] [--reapprove]]
             [--clear]
             Show the active blueprint pointer, or set / clear it.
             --task picks a task doc; without it, first ready/in_progress wins.
             --replace deletes the uniquely selected key then writes the target; omitted,
             --set adds a parallel key. --replace at a multi-pointer base exits 1 with CURRENT_AMBIGUOUS.
             At a base checkout, --set that would add a second key exits 1 with CURRENT_WOULD_BE_AMBIGUOUS
             unless --replace or --keep-others (keep the other keys) is given.
             --reapprove rewrites the approval snapshot after the user explicitly approves a scope change.
`,
  },
};
