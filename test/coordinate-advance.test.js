'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { advance } = require('../scripts/lib/coordinate-advance');

/**
 * deps.next / deps.runArgv 큐를 만든다. 호출 순서가 스크립트와 어긋나면 throw한다.
 *
 * @param {object[]} nextQueue - next()가 순서대로 돌려줄 응답
 * @param {Array<{ argv?: string[], cwd?: string, stdout: string, status: number }>} runQueue
 *   - runArgv가 순서대로 돌려줄 결과(기대 argv/cwd를 적어 두면 단언)
 * @returns {{ deps: object, runCalls: object[] }}
 */
function scriptedDeps(nextQueue, runQueue = []) {
  const nexts = [...nextQueue];
  const runs = [...runQueue];
  const runCalls = [];
  return {
    runCalls,
    deps: {
      next() {
        assert.ok(nexts.length > 0, 'unexpected next() call');
        return nexts.shift();
      },
      runArgv(argv, cwd) {
        assert.ok(runs.length > 0, `unexpected runArgv(${JSON.stringify(argv)})`);
        const expected = runs.shift();
        if (expected.argv !== undefined) {
          assert.deepStrictEqual(argv, expected.argv);
        }
        if (expected.cwd !== undefined) {
          assert.strictEqual(cwd, expected.cwd);
        }
        runCalls.push({ argv, cwd });
        return { stdout: expected.stdout, status: expected.status };
      },
    },
  };
}

function okNext(action, extra = {}) {
  return { ok: true, action, cwd: '/cwd', ...extra };
}

function argvFor(action) {
  return ['bouncer', 'coordinate', action, '--blueprint', 'bp'];
}

test('(a) prepare→integrate→judge stops with judge and two executed', () => {
  const judgeNext = okNext('dispatch', {
    judge: { kind: 'intent-symbols', fields: ['symbols'] },
    argv: argvFor('dispatch'),
  });
  const { deps } = scriptedDeps(
    [
      okNext('prepare', { argv: argvFor('prepare') }),
      okNext('integrate', { argv: argvFor('integrate') }),
      judgeNext,
    ],
    [
      { argv: argvFor('prepare'), cwd: '/cwd', stdout: '{"ok":true}\n', status: 0 },
      { argv: argvFor('integrate'), cwd: '/cwd', stdout: '{"ok":true}\n', status: 0 },
    ],
  );
  const out = advance({
    repoRoot: '/repo', blueprint: 'bp', deps,
  });
  assert.strictEqual(out.ok, true);
  assert.deepStrictEqual(out.executed.map((e) => e.action), ['prepare', 'integrate']);
  assert.strictEqual(out.stop.reason, 'judge');
  assert.deepStrictEqual(out.stop.next, judgeNext);
});

test('(b) drive_tasks and implement+inline stop with worker', () => {
  const drive = okNext('drive_tasks', { task_ids: ['001'] });
  const { deps: d1 } = scriptedDeps([drive]);
  const out1 = advance({ repoRoot: '/r', blueprint: 'bp', deps: d1 });
  assert.strictEqual(out1.ok, true);
  assert.strictEqual(out1.stop.reason, 'worker');
  assert.deepStrictEqual(out1.stop.next, drive);
  assert.deepStrictEqual(out1.executed, []);

  const impl = okNext('implement', { payload: { inline: true } });
  const { deps: d2 } = scriptedDeps([impl]);
  const out2 = advance({ repoRoot: '/r', blueprint: 'bp', deps: d2 });
  assert.strictEqual(out2.ok, true);
  assert.strictEqual(out2.stop.reason, 'worker');
  assert.deepStrictEqual(out2.stop.next, impl);
});

test('(c) blocked, done, and none stop with matching reason', () => {
  for (const reason of ['blocked', 'done', 'none']) {
    const step = okNext(reason, reason === 'blocked' ? { reason: 'no-ready-task' } : {});
    const { deps } = scriptedDeps([step]);
    const out = advance({ repoRoot: '/r', blueprint: 'bp', deps });
    assert.strictEqual(out.ok, true, reason);
    assert.strictEqual(out.stop.reason, reason);
    assert.deepStrictEqual(out.stop.next, step);
  }
});

test('(d) max-steps stops before another auto action', () => {
  const third = okNext('prepare', { argv: argvFor('prepare') });
  const { deps, runCalls } = scriptedDeps(
    [
      okNext('prepare', { argv: argvFor('prepare') }),
      okNext('integrate', { argv: argvFor('integrate') }),
      third,
    ],
    [
      { stdout: '{"ok":true}\n', status: 0 },
      { stdout: '{"ok":true}\n', status: 0 },
    ],
  );
  const out = advance({
    repoRoot: '/r', blueprint: 'bp', maxSteps: 2, deps,
  });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.stop.reason, 'max-steps');
  assert.deepStrictEqual(out.stop.next, third);
  assert.deepStrictEqual(out.executed.map((e) => e.action), ['prepare', 'integrate']);
  assert.strictEqual(runCalls.length, 2);
});

test('(e) verify failure returns ok:false without retry', () => {
  const failBody = {
    ok: false,
    reason: 'gate-failed',
    cause: 'execute gate failed',
    next: 'fix and re-validate',
    failures: [{ code: 'E1' }],
  };
  const { deps, runCalls } = scriptedDeps(
    [okNext('verify', { argv: ['bouncer', 'validate', '--gate', 'execute'], task: '001' })],
    [{ stdout: `${JSON.stringify(failBody)}\n`, status: 1 }],
  );
  const out = advance({ repoRoot: '/r', blueprint: 'bp', task: '001', deps });
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.reason, 'gate-failed');
  assert.deepStrictEqual(out.executed, []);
  assert.strictEqual(runCalls.length, 1);
});

test('(f) stale-ledger-checkpoint retries once; same reason → repeated-failure', () => {
  const stale = {
    ok: false,
    reason: 'stale-ledger-checkpoint',
    cause: 'fence stale',
    next: 're-read status',
  };
  const okBody = { ok: true };
  const { deps: okDeps, runCalls: okCalls } = scriptedDeps(
    [
      okNext('prepare', { argv: argvFor('prepare') }),
      okNext('prepare', { argv: ['bouncer', 'coordinate', 'prepare', '--blueprint', 'bp', '--fresh'] }),
      okNext('done'),
    ],
    [
      { stdout: `${JSON.stringify(stale)}\n`, status: 1 },
      {
        argv: ['bouncer', 'coordinate', 'prepare', '--blueprint', 'bp', '--fresh'],
        stdout: `${JSON.stringify(okBody)}\n`,
        status: 0,
      },
    ],
  );
  const recovered = advance({ repoRoot: '/r', blueprint: 'bp', deps: okDeps });
  assert.strictEqual(recovered.ok, true);
  assert.strictEqual(recovered.stop.reason, 'done');
  assert.deepStrictEqual(recovered.executed.map((e) => e.action), ['prepare']);
  assert.strictEqual(okCalls.length, 2);

  const staleAgain = {
    ok: false,
    reason: 'stale-ledger-checkpoint',
    cause: 'still stale',
    next: 'stop',
  };
  const { deps: failDeps } = scriptedDeps(
    [
      okNext('integrate', { argv: argvFor('integrate') }),
      okNext('integrate', { argv: argvFor('integrate') }),
    ],
    [
      { stdout: `${JSON.stringify(stale)}\n`, status: 1 },
      { stdout: `${JSON.stringify(staleAgain)}\n`, status: 1 },
    ],
  );
  const retried = advance({ repoRoot: '/r', blueprint: 'bp', deps: failDeps });
  assert.strictEqual(retried.ok, false);
  assert.strictEqual(retried.reason, 'repeated-failure');
  assert.strictEqual(retried.cause, 'stale-ledger-checkpoint');
  assert.strictEqual(retried.next, staleAgain.next);
  assert.deepStrictEqual(retried.executed, []);
});

test('(g) non-JSON stdout and exit 2 are unclear-result', () => {
  const { deps: d1 } = scriptedDeps(
    [okNext('prepare', { argv: argvFor('prepare') })],
    [{ stdout: 'not-json\n', status: 0 }],
  );
  const unclear = advance({ repoRoot: '/r', blueprint: 'bp', deps: d1 });
  assert.strictEqual(unclear.ok, false);
  assert.strictEqual(unclear.reason, 'unclear-result');

  const { deps: d2 } = scriptedDeps(
    [okNext('prepare', { argv: argvFor('prepare') })],
    [{ stdout: '{"ok":true}\n', status: 2 }],
  );
  const badExit = advance({ repoRoot: '/r', blueprint: 'bp', deps: d2 });
  assert.strictEqual(badExit.ok, false);
  assert.strictEqual(badExit.reason, 'unclear-result');
});

test('(h) argv[0] !== bouncer is advance-argv-invalid and skips runArgv', () => {
  const { deps, runCalls } = scriptedDeps(
    [okNext('prepare', { argv: ['not-bouncer', 'coordinate', 'prepare'] })],
    [],
  );
  const out = advance({ repoRoot: '/r', blueprint: 'bp', deps });
  assert.strictEqual(out.ok, false);
  assert.strictEqual(out.reason, 'advance-argv-invalid');
  assert.strictEqual(runCalls.length, 0);
});

test('(i) judge on review does not run a later commit argv', () => {
  const review = okNext('review', {
    judge: { kind: 'review-round', fields: ['findings'] },
    argv: ['bouncer', 'review-dispatch', 'execute'],
  });
  const { deps, runCalls } = scriptedDeps([review]);
  const out = advance({ repoRoot: '/r', blueprint: 'bp', task: '001', deps });
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.stop.reason, 'judge');
  assert.deepStrictEqual(out.stop.next, review);
  assert.strictEqual(runCalls.length, 0);
});
