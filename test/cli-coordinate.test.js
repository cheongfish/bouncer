// test/cli-coordinate.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { coordinate } = require('../scripts/lib/coordinator');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

/**
 * bootstrap + prepare까지 끝난 coordinator 픽스처.
 * revise는 할당된 worker worktree에서만 통과하므로 세 경로를 모두 돌려준다.
 */
function preparedDrive() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '-m', 'base']);

  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      affected_paths: ['src/auth/'],
    },
  });
  run(['add', '-A']);
  run(['commit', '-m', 'plan']);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  assert.strictEqual(boot.ok, true);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: BP_REL, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true);
  return {
    repo,
    integration: boot.integrationPath,
    worker: prepared.tasks[0].workerPath,
  };
}

/**
 * revise의 write boundary는 CLI가 실제로 서 있는 cwd다. 테스트가 경계를
 * 플래그로 지정하면 거절 경로를 한 번도 밟지 않으므로, 진짜로 cwd를 옮겨서
 * 부른다.
 */
function revise(cwd, extra, flags = []) {
  const { io, buf } = capture();
  const before = process.cwd();
  process.chdir(cwd);
  let code;
  try {
    code = runCli(['coordinate', 'revise', ...flags, '--blueprint', BP_REL, ...extra], io);
  } finally {
    process.chdir(before);
  }
  return { code, buf };
}

test('coordinate revise records every repeated --paths value in one revision', () => {
  const { worker } = preparedDrive();
  const { code, buf } = revise(worker, [
    '--task', '001',
    '--paths', 'src/auth/',
    '--paths', 'src/session/token.ts',
    '--reason', 'session token shares the login guard',
  ]);
  assert.strictEqual(code, 0, buf.err);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.revision, 'r1');
  assert.deepStrictEqual(parsed.previous, ['src/auth/']);
  assert.deepStrictEqual(parsed.paths, ['src/auth/', 'src/session/token.ts']);

  // 같은 revision이 task 문서와 원장 양쪽에 남아야 stale 판정이 서지 않는다.
  const doc = yaml.load(
    fs.readFileSync(path.join(worker, BP_REL, 'tasks/001/tasks.md'), 'utf8').split('---\n')[1],
  );
  assert.deepStrictEqual(doc.bouncer.affected_paths, ['src/auth/', 'src/session/token.ts']);
  assert.strictEqual(doc.bouncer.scope_revision, 'r1');
  const ledger = JSON.parse(fs.readFileSync(
    path.join(worker, '..', '..', 'integration', '.bouncer/runtime/coordinator.json'), 'utf8',
  ));
  assert.strictEqual(ledger.revision, 'r1');
  assert.deepStrictEqual(ledger.decisions[0].next, ['src/auth/', 'src/session/token.ts']);
  assert.strictEqual(ledger.decisions[0].kind, 'scope');
});

test('coordinate revise carries every reviseTaskScope reason code to stderr with exit 1', () => {
  const drive = preparedDrive();
  const cases = [
    ['task-required', ['--paths', 'src/auth/', '--reason', 'r']],
    ['decision-reason-required', ['--task', '001', '--paths', 'src/auth/']],
    ['scope-paths-required', ['--task', '001', '--reason', 'r']],
    ['scope-path-glob', ['--task', '001', '--paths', 'src/**/*.ts', '--reason', 'r']],
    ['scope-path-out-of-bounds', ['--task', '001', '--paths', '.bouncer/context/', '--reason', 'r']],
  ];
  for (const [reason, extra] of cases) {
    const { code, buf } = revise(drive.worker, extra);
    assert.strictEqual(code, 1, `${reason}: ${buf.out}`);
    assert.match(buf.err, new RegExp(reason));
    assert.strictEqual(buf.out, '', `${reason} must not print a success payload`);
  }
});

// `--paths` 자체가 없는 호출과 값 없는 `--paths`는 같은 거절이어야 한다.
// 값 없는 플래그를 경로로 삼으면 빈 문자열이 scope에 들어간다.
test('coordinate revise refuses a valueless --paths as scope-paths-required', () => {
  const { worker } = preparedDrive();
  const { code, buf } = revise(worker, ['--task', '001', '--paths', '--reason', 'r']);
  assert.strictEqual(code, 1);
  assert.match(buf.err, /scope-paths-required/);
});

test('coordinate revise refuses the main worktree and an unassigned worktree', () => {
  const drive = preparedDrive();
  const args = ['--task', '001', '--paths', 'src/auth/', '--reason', 'r'];

  const main = revise(drive.repo, args);
  assert.strictEqual(main.code, 1);
  assert.match(main.buf.err, /main-worktree-source-write/);

  const integration = revise(drive.integration, args);
  assert.strictEqual(integration.code, 1);
  assert.match(integration.buf.err, /unassigned-worktree/);
});

// `--repo`는 caller가 주는 값이다. revise가 그것을 write boundary로 삼으면
// main checkout에 선 호출자가 남의 worker worktree를 자기 것으로 지정해
// main-worktree-source-write / unassigned-worktree 거절을 통째로 지나간다.
test('coordinate revise ignores --repo and judges the boundary by the real cwd', () => {
  const drive = preparedDrive();
  const args = ['--task', '001', '--paths', 'src/auth/', '--reason', 'r'];

  const spoofed = revise(drive.repo, args, ['--repo', drive.worker]);
  assert.strictEqual(spoofed.code, 1, spoofed.buf.out);
  assert.match(spoofed.buf.err, /main-worktree-source-write/);
  assert.strictEqual(spoofed.buf.out, '');

  // 반대 방향도 같다: 올바른 worktree에 서 있으면 잘못된 --repo가 막지 못한다.
  const honest = revise(drive.worker, args, ['--repo', drive.repo]);
  assert.strictEqual(honest.code, 0, honest.buf.err);
});

test('coordinate revise without --blueprint is a usage refusal', () => {
  const { io, buf } = capture();
  const code = runCli(['coordinate', 'revise', '--task', '001'], io);
  assert.strictEqual(code, 2);
  assert.match(buf.err, /--blueprint is required/);
});

test('coordinate usage advertises revise as the only reviseTaskScope surface', () => {
  const { io, buf } = capture();
  runCli(['help'], io);
  assert.match(buf.out, /coordinate/);
  assert.match(buf.out, /revise/);
  assert.match(buf.out, /--paths/);
  assert.match(buf.out, /--reason/);
});
