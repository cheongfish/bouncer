// test/cli-help-static.test.js
'use strict';
// 정적 help가 handler를 적재하지 않는지 자식 프로세스로 격리 관측한다.
// spawnSync를 쓰므로 unit 계층 no-spawn guard를 피해 integration 계층에 둔다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { COMMAND_USAGE } = require('../scripts/lib/cli-usage');

// 자식 프로세스에서 runCli를 실행해 결과와 적재된 scripts/lib 모듈 basename을 JSON으로 받는다.
// 같은 프로세스의 require.cache는 앞선 테스트가 오염시키므로 적재 범위는 격리해 관측한다.
const HELP_PROBE = `
  const { runCli } = require('./scripts/lib/cli');
  let out = '', err = '';
  const code = runCli(process.argv.slice(1), { out: (s) => { out += s; }, err: (s) => { err += s; } });
  const loaded = Object.keys(require.cache)
    .filter((k) => k.includes('scripts/lib/'))
    .map((k) => require('path').basename(k));
  process.stdout.write(JSON.stringify({ code, out, err, loaded }));
`;
const repoRoot = path.join(__dirname, '..');

function probeCli(argv, cwd = repoRoot) {
  const r = spawnSync(process.execPath, ['-e', HELP_PROBE, ...argv], {
    cwd,
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const OWN_HELP = ['coordinate', 'review-dispatch', 'review', 'context-review', 'dispatch', 'config', 'epic'];
const STATIC_HELP_COMMANDS = Object.keys(COMMAND_USAGE).filter((c) => !OWN_HELP.includes(c));

for (const cmd of STATIC_HELP_COMMANDS) {
  for (const flag of ['--help', '-h']) {
    test(`${cmd} ${flag} → 정적 usage와 exit 0, handler 미적재`, () => {
      const { code, out, err, loaded } = probeCli([cmd, flag]);
      assert.strictEqual(code, 0);
      assert.strictEqual(out, COMMAND_USAGE[cmd]);
      assert.strictEqual(err, '');
      assert.deepStrictEqual(loaded.sort(), ['cli-flags.js', 'cli-usage.js', 'cli.js']);
    });
  }
}

test('다른 플래그와 하위 명령이 함께 와도 → help가 이긴다', () => {
  const { code, out, loaded } = probeCli(['migrate', 'context-slugs', '--yes', '--help']);
  assert.strictEqual(code, 0);
  assert.strictEqual(out, COMMAND_USAGE.migrate);
  assert.ok(!loaded.includes('cli-project-commands.js'));
});

test('-h가 --플래그 바로 뒤 → help가 아니라 handler 오류로 간다', () => {
  const { code, err } = probeCli(['commit', '--message', '-h']);
  assert.strictEqual(code, 2);
  assert.strictEqual(err, 'commit: --blueprint is required\n');
});

test('빈 git 저장소에서 init --help → exit 0이고 .bouncer를 만들지 않는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-help-'));
  try {
    assert.strictEqual(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    const probe = spawnSync(process.execPath, ['-e',
      HELP_PROBE.replace("'./scripts/lib/cli'", JSON.stringify(path.join(repoRoot, 'scripts/lib/cli'))),
      'init', '--help'], { cwd: dir, encoding: 'utf8' });
    assert.strictEqual(probe.status, 0, probe.stderr);
    assert.strictEqual(JSON.parse(probe.stdout).code, 0);
    assert.strictEqual(fs.existsSync(path.join(dir, '.bouncer')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('finalize comprehension --help → 기록 명령을 나열하고 쓰기·handler 적재 없이 exit 0', () => {
  const { code, out, err, loaded } = probeCli(['finalize', 'comprehension', '--help']);
  assert.strictEqual(code, 0);
  assert.strictEqual(out, COMMAND_USAGE.finalize);
  assert.ok(out.includes('comprehension --blueprint <dir> --digest <json-file>'));
  assert.strictEqual(err, '');
  assert.ok(!loaded.includes('finalize-comprehension.js'));
});

test('finalize pr-body --help → 초안 명령을 나열하고 쓰기·handler 적재 없이 exit 0', () => {
  const { code, out, err, loaded } = probeCli(['finalize', 'pr-body', '--help']);
  assert.strictEqual(code, 0);
  assert.strictEqual(out, COMMAND_USAGE.finalize);
  assert.ok(out.includes('pr-body --digest <json-file> --summary <markdown-file>'));
  assert.strictEqual(err, '');
  assert.ok(!loaded.includes('finalize-pr.js'));
});
