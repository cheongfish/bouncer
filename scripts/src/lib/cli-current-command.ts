'use strict';

const { parseFlags } = require('./cli-flags');
const { validateBlueprint } = require('./validate');
const {
  readCurrent, writeCurrent, clearCurrent, listReadyBlueprints,
  resolvePointerTask, presentCurrent,
} = require('./current');
const { readConfig } = require('./config');

function cmdCurrent(rest, io) {
  const f = parseFlags(rest);
  // hasOwnProperty: --set/--task 가 boolean true(값 없음)여도 "요청함"으로 본다.
  // truthy 문자열만 보면 `--set` 단독이 아래 분기를 건너뛴다.
  const wantsSet = Object.prototype.hasOwnProperty.call(f, 'set');
  const wantsClear = f.clear === true;
  const wantsTask = Object.prototype.hasOwnProperty.call(f, 'task');

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
  if (wantsTask && !wantsSet) {
    io.err('current: --task requires --set\n');
    return 2;
  }
  if (wantsSet && (typeof f.set !== 'string' || f.set === '')) {
    io.err('current: --set requires a blueprint directory\n');
    return 2;
  }

  const repoRoot = f.repo || process.cwd();

  if (wantsClear) {
    // set보다 먼저 return. 모순은 위에서 이미 거절했으므로 여기선 포인터만 지운다.
    clearCurrent({ repoRoot });
    io.out(`${JSON.stringify({ ok: true, current: null }, null, 2)}\n`);
    return 0;
  }

  if (wantsSet) {
    const blueprintDir = f.set;
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
        .map((t) => t.id)
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
      // 부재·깨진 JSON을 {}로 삼킨다. --set은 base_branch만 읽고 없으면
      // develop. session-graph는 null을 구분해 graphify.enabled를 끄지만,
      // 이쪽은 파일 부재와 빈 설정을 같게 보는 것이 기존 동작이다.
      const config = readConfig(repoRoot) ?? {};
      base = (config && typeof config.base_branch === 'string' && config.base_branch)
        ? config.base_branch
        : 'develop';
    }
    writeCurrent({
      repoRoot,
      blueprint: blueprintDir,
      base,
      task: resolved.task || undefined,
    });
    // 포인터 파일은 path 문자열; 응답 JSON 은 path+id (presentCurrent).
    const current = presentCurrent(readCurrent({ repoRoot }), { repoRoot });
    io.out(`${JSON.stringify({ ok: true, current }, null, 2)}\n`);
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

module.exports = {
  current: {
    run: cmdCurrent,
    usage: `  current    [--set <blueprint dir> [--base <branch>] [--task <NNN|TASKS-NNN>]]
             [--clear]
             Show the active blueprint pointer, or set / clear it.
             --task picks a task doc; without it, first ready/in_progress wins.
`,
  },
};
