'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { advance } = require('../packages/cli/dist/coordinate-advance');

// 통합 tier: 실제 git, 자식 프로세스(launcher)를 쓰므로 unit tier의 spawn guard 밖에 둔다.
// --- 실제 launcher 경로: 설치 출력이 자식 stdout JSON을 오염시키지 않는다 -----------
// 위 (g)는 stub runArgv라 defaultRunArgv의 pipe를 거치지 않는다. 여기서는 deps 없이
// advance를 돌려 prepare가 손자 npm을 띄울 때 stdout 잡음이 JSON 앞에 섞이는지 본다.

test('prepare run through the real launcher with npm writing to stdout → advance is not unclear-result', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const { coordinate } = require('../packages/cli/dist/coordinator');

  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-advance-npm-')));
  const savedPath = process.env.PATH;
  const savedHome = process.env.BOUNCER_HOME;
  const savedCwd = process.cwd();
  try {
    const repo = path.join(root, 'repo');
    fs.mkdirSync(repo);
    const git = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
    git(['init', '-q', '-b', 'work']);
    git(['config', 'user.email', 't@example.com']);
    git(['config', 'user.name', 't']);
    const bp = '.bouncer/context/epics/001-auth/blueprints/001-login';
    fs.mkdirSync(path.join(repo, bp, 'tasks/001'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'package-lock.json'), '{}\n');
    fs.writeFileSync(path.join(repo, bp, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
    fs.writeFileSync(
      path.join(repo, bp, 'tasks/001/tasks.md'),
      '---\nbouncer:\n  status: ready\n  depends_on: []\n  affected_paths:\n    - src/\n---\n',
    );
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'plan']);
    const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: bp });
    assert.strictEqual(boot.ok, true, JSON.stringify(boot));

    // fake npm: stdout에 잡음을 쓰고, 설치 성공 marker만 만든다. 네트워크는 쓰지 않는다.
    const binDir = path.join(root, 'bin');
    fs.mkdirSync(binDir);
    const fakeNpm = path.join(binDir, 'npm');
    fs.writeFileSync(fakeNpm, `#!${process.execPath}
process.stdout.write('npm noise\\n');
require('node:fs').mkdirSync('node_modules', { recursive: true });
require('node:fs').writeFileSync('node_modules/.package-lock.json', '{}');
`);
    fs.chmodSync(fakeNpm, 0o755);
    // launcher가 호스트에 설치된 다른 Bouncer로 위임하면 이 checkout의 수정이 검증되지
    // 않는다. BOUNCER_HOME을 이 checkout으로 고정해 실제 launcher가 자기 lib를 쓰게 한다.
    process.env.BOUNCER_HOME = path.join(__dirname, '..');
    process.env.PATH = `${binDir}${path.delimiter}${savedPath}`;

    // next는 process.cwd()가 integration worktree여야 통과한다. CLI와 같은 조건을 맞춘다.
    process.chdir(boot.integrationPath);
    const result = advance({ repoRoot: repo, blueprint: bp });
    assert.notStrictEqual(result.reason, 'unclear-result', JSON.stringify(result));
    assert.ok(result.executed.some((step) => step.action === 'prepare'), JSON.stringify(result));
  } finally {
    process.chdir(savedCwd);
    process.env.PATH = savedPath;
    if (savedHome === undefined) delete process.env.BOUNCER_HOME;
    else process.env.BOUNCER_HOME = savedHome;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
