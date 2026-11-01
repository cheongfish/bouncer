'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { advance } = require('../packages/cli/dist/coordinate-advance');

test('advance stop → includes the final status; status failure preserves executed steps', () => {
  const status = { ok: true, checkpoint: { revision: 3 } };
  let calls = 0;
  const opts = { repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => ++calls % 2 ? { ok: true, action: 'prepare', argv: ['bouncer', 'x'] } : { ok: true, action: 'done' },
    runArgv: () => ({ stdout: '{"ok":true}', status: 0 }),
    status: () => status,
  } };
  const success = advance(opts);
  assert.deepEqual(success.status, status);
  opts.deps.status = () => ({ ok: false, reason: 'missing-ledger' });
  const failed = advance(opts);
  assert.equal(failed.reason, 'advance-status-unavailable');
  assert.deepEqual(failed.executed, [{ action: 'prepare', exit: 0 }]);
  opts.deps.next = () => ({ ok: false, reason: 'next-failed' });
  assert.equal(Object.hasOwn(advance(opts), 'status'), false);
});

test('status throws after an executed step → unavailable result retains executed steps', () => {
  let calls = 0;
  const result = advance({ repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => ++calls === 1 ? { ok: true, action: 'prepare', argv: ['bouncer', 'x'] } : { ok: true, action: 'done' },
    runArgv: () => ({ stdout: '{"ok":true}', status: 0 }),
    status: () => { throw new Error('status unavailable'); },
  } });
  assert.equal(result.reason, 'advance-status-unavailable');
  assert.deepEqual(result.executed, [{ action: 'prepare', exit: 0 }]);
});

test('commit returns committed:false → advance stops with empty-commit and does not rerun commit', () => {
  // 변경 없는 commit은 ok:true에 committed:false로 끝난다. next는 여전히 commit을 고르므로 advance가
  // 다시 실행하면 max-steps까지 같은 빈 commit을 반복한다. 한 번 실행한 뒤 바로 멈춰야 한다.
  const commitArgv = ['bouncer', 'commit', '--blueprint', 'missing', '--yes'];
  let runs = 0;
  const result = advance({ repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => ({ ok: true, action: 'commit', cwd: process.cwd(), argv: commitArgv }),
    runArgv: () => {
      runs += 1;
      return { stdout: '{"ok":true,"committed":false,"staged":[]}', status: 0 };
    },
    status: () => ({ ok: true }),
  } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'empty-commit');
  assert.equal(runs, 1);
  // 실제로 실행한 commit은 executed에 남겨 호출자가 다시 돌리지 않도록 한다.
  assert.deepEqual(result.executed, [{ action: 'commit', exit: 0 }]);
});

// 자동 commit은 `bouncer commit --yes` 자식 프로세스의 JSON만 본다. 아래 stub은 commitTask가
// 범위 밖 생성 파일을 거절할 때 내는 실패 본문과 같은 모양이다. 실제 거절 본문은
// cli-commit.test.js가 실제 git으로 확인한다.
test('auto commit rejected for an out-of-scope generated file → advance stops with the file and runs no later step', () => {
  const commitArgv = ['bouncer', 'commit', '--blueprint', 'missing', '--yes'];
  let runs = 0;
  let nextCalls = 0;
  const result = advance({ repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => {
      nextCalls += 1;
      return nextCalls === 1
        ? { ok: true, action: 'commit', cwd: process.cwd(), argv: commitArgv }
        : { ok: true, action: 'done' };
    },
    runArgv: () => {
      runs += 1;
      return {
        stdout: JSON.stringify({
          ok: false,
          reason: 'out-of-scope',
          violations: ['.codex/agents/bouncer-reviewer.toml'],
          recovery: { action: 'return-to-plan', detail: 'Out-of-scope changes are a hard abort with nothing staged.' },
        }),
        status: 1,
      };
    },
    status: () => ({ ok: true }),
  } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'out-of-scope');
  assert.deepEqual(result.violations, ['.codex/agents/bouncer-reviewer.toml']);
  // 거절된 commit은 executed에 들어가지 않고, 다음 단계로 넘어가지 않아야 한다.
  assert.deepEqual(result.executed, []);
  assert.equal(runs, 1);
});

test('auto commit of an explicitly in-scope generated file → advance records the commit and continues', () => {
  const commitArgv = ['bouncer', 'commit', '--blueprint', 'missing', '--yes'];
  let nextCalls = 0;
  const result = advance({ repoRoot: process.cwd(), blueprint: 'missing', deps: {
    next: () => {
      nextCalls += 1;
      return nextCalls === 1
        ? { ok: true, action: 'commit', cwd: process.cwd(), argv: commitArgv }
        : { ok: true, action: 'done' };
    },
    runArgv: () => ({
      stdout: JSON.stringify({
        ok: true,
        committed: true,
        staged: ['.codex/agents/bouncer-reviewer.toml', 'src/auth/login.ts'],
      }),
      status: 0,
    }),
    status: () => ({ ok: true }),
  } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.executed, [{ action: 'commit', exit: 0 }]);
});
