'use strict';

import cliFlags = require('./cli-flags');
const { parseFlags } = cliFlags;
const { execFileSync } = require('node:child_process');
import validate = require('./validate');
const { validateBlueprint } = validate;
import current = require('./current');
const {
  readCurrent, writeCurrent, clearCurrent, listReadyBlueprints,
  resolvePointerTask, presentCurrent,
} = current;
import config = require('./config');
const { readConfig } = config;

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

/**
 * 활성 포인터를 읽거나 `--set`/`--clear`로 바꾼다.
 * 다른 blueprint가 이미 활성인데 `--replace`가 없으면 plan gate·task 해석·쓰기
 * 전에 종료 코드 2로 거절하고 파일을 그대로 둔다. 같은 blueprint의 task/base
 * 갱신은 `--replace` 없이 통과한다.
 *
 * @param {string[]} rest - `current` 다음 CLI 인자
 * @param {CliIo} io - stdout/stderr 싱크
 * @returns {number} 성공 0, plan/base 실패 1, 사용법·충돌 거절 2
 */
function cmdCurrent(rest: string[], io: CliIo) {
  const f = parseFlags(rest);
  // hasOwnProperty: --set/--task/--replace 가 boolean true(값 없음)여도 "요청함"으로 본다.
  // truthy 문자열만 보면 `--set` 단독이 아래 분기를 건너뛴다.
  const wantsSet = Object.prototype.hasOwnProperty.call(f, 'set');
  const wantsClear = f.clear === true;
  const wantsTask = Object.prototype.hasOwnProperty.call(f, 'task');
  const wantsReplace = Object.prototype.hasOwnProperty.call(f, 'replace');

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
  if (wantsTask && !wantsSet) {
    io.err('current: --task requires --set\n');
    return 2;
  }
  if (wantsReplace && !wantsSet) {
    io.err('current: --replace requires --set\n');
    return 2;
  }
  if (wantsSet && (typeof f.set !== 'string' || f.set === '')) {
    io.err('current: --set requires a blueprint directory\n');
    return 2;
  }

  const repoRoot = (f.repo || process.cwd()) as string;

  if (wantsClear) {
    // set보다 먼저 return. 모순은 위에서 이미 거절했으므로 여기선 포인터만 지운다.
    clearCurrent({ repoRoot });
    io.out(`${JSON.stringify({ ok: true, current: null }, null, 2)}\n`);
    return 0;
  }

  if (wantsSet) {
    const blueprintDir = f.set as string;
    const stored = readCurrent({ repoRoot });
    // 같은 경로는 task/base 갱신으로 본다. 다른 경로만 덮어쓰기 사고다.
    // 비교는 저장 문자열 그대로 — 정규화하면 다른 문서가 같은 슬롯으로 보일 수 있다.
    let previous: PreviousPointer | null = null;
    if (stored != null && stored.blueprint !== blueprintDir) {
      previous = previousPayload(stored);
      if (!wantsReplace) {
        // plan gate보다 먼저 거절. 대상 brief를 읽거나 포인터를 쓰면 안 된다.
        io.err('current: another blueprint is already active; pass --replace to switch\n');
        emitPrevious(io, previous);
        io.out(`${JSON.stringify({ ok: false, previous }, null, 2)}\n`);
        return 2;
      }
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
    writeCurrent({
      repoRoot,
      blueprint: blueprintDir,
      base,
      task: resolved.task || undefined,
    });
    // 포인터 파일은 path 문자열; 응답 JSON 은 path+id (presentCurrent).
    const current = presentCurrent(readCurrent({ repoRoot }), { repoRoot });
    if (previous) {
      emitPrevious(io, previous);
      io.out(`${JSON.stringify({ ok: true, current, previous }, null, 2)}\n`);
    } else {
      io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
    }
    return 0;
  }

  // 없음도 오류가 아닌 상태: 항상 exit 0. unset이면 ready list를 붙여 execute가
  // "planned but unset"과 "nothing planned"를 구분하게 함.
  const stored = readCurrent({ repoRoot });
  if (stored) {
    const current = presentCurrent(stored, { repoRoot });
    io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
  } else {
    const ready = listReadyBlueprints({ repoRoot });
    io.out(`${JSON.stringify({ ok: true, current: null, ready }, null, 2)}\n`);
  }
  return 0;
}

export = {
  current: {
    run: cmdCurrent,
    usage: `  current    [--set <blueprint dir> [--base <branch>] [--task <NNN|TASKS-NNN>] [--replace]]
             [--clear]
             Show the active blueprint pointer, or set / clear it.
             --task picks a task doc; without it, first ready/in_progress wins.
             --replace overwrites a different active blueprint; omitted, a conflict exits 2.
`,
  },
};
