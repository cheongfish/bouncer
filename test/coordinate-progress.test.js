'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const cli = path.resolve(__dirname, '../packages/cli/dist/cli');

// 실제 CLI 경계의 종료 코드와 JSON 및 기존 파일 보존을 함께 관찰한다.
function invoke(args, cwd) {
  const script = `const {runCli}=require(${JSON.stringify(cli)}); process.exitCode=runCli(process.argv.slice(1));`;
  const result = spawnSync(process.execPath, ['-e', script, 'coordinate', 'progress', ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, body: result.stdout ? JSON.parse(result.stdout) : null };
}
function args(baseline = '[]', current = '[]', observation = 'terminated', report = 'present', recovery = 'false') {
  return ['--baseline-ids', baseline, '--current-ids', current, '--observation', observation,
    '--report', report, '--recovery-used', recovery];
}

test('host observation and completed ID set → choose the specified decision precedence', () => {
  const cases = [
    [args('["a"]', '["b"]', 'running', 'absent', 'true'), 'wait'],
    [args('["a"]', '["b"]', 'unknown', 'absent', 'true'), 'continue'],
    [args('["a"]', '["a","a"]', 'unknown', 'absent'), 'worker-state-unknown'],
    [args('[]', '[]', 'terminated', 'absent'), 'worker-report-missing'],
    [args('[]', '[]', 'unknown', 'present'), 'recovery'],
    [args('[]', '[]', 'terminated', 'present'), 'recovery'],
    [args('["a"]', '["a"]', 'terminated', 'present', 'true'), 'no-progress'],
    [args('[]', '[]', 'unknown', 'present', 'true'), 'no-progress'],
  ];
  for (const [input, decision] of cases) {
    assert.deepEqual(invoke(input, process.cwd()), { status: 0, body: { ok: true, decision } });
  }
});

test('invalid progress input → reject with JSON and preserve ledger and worktree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'progress-'));
  try {
    const ledger = path.join(dir, 'ledger');
    fs.writeFileSync(ledger, 'unchanged');
    const invalid = [args().slice(2), [...args(), '--report', 'present'], [...args(), '--extra', 'x'],
      args().slice(0, -1), args('{'), args('{}'), args('[""]'), args('[1]'),
      args('[]', '[]', 'active'), args('[]', '[]', 'running', 'maybe'),
      args('[]', '[]', 'running', 'present', 'yes')];
    for (const input of invalid) {
      assert.deepEqual(invoke(input, dir), { status: 2, body: { ok: false, code: 'invalid-progress-input' } });
      assert.equal(fs.readFileSync(ledger, 'utf8'), 'unchanged');
      assert.deepEqual(fs.readdirSync(dir), ['ledger']);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
