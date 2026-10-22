'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { crossDriveConflicts, otherDriveTasks } = require('../scripts/lib/cross-drive');
const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const { coordinate } = require('./helpers/coordinator-fence');
const { createGitTemplate } = require('./helpers/git-fixture');

const repoTemplate = createGitTemplate((repo) => {
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
});
test.after(() => repoTemplate.dispose());

test('crossDriveConflicts with overlapping paths, resources, and legacy scopes → reports conflicts', () => {
  const drives = [{ blueprint: 'epic/other', ledgerFile: '/ledger', tasks: [
    { id: '101', affected_paths: ['src/'] },
    { id: '102', affected_paths: ['exact.ts'] },
    { id: '103', affected_paths: ['other/'], exclusive_resources: ['db'] },
    { id: '104' },
  ] }];
  const conflicts = crossDriveConflicts([
    { id: '001', affected_paths: ['src/file.ts'] },
    { id: '002', affected_paths: ['exact.ts'] },
    { id: '003', affected_paths: ['else/'], exclusive_resources: ['db'] },
    { id: '004', affected_paths: ['else/'] },
  ], drives);
  assert.deepStrictEqual(conflicts.map((item) => item.task),
    ['101', '104', '102', '104', '103', '104', '104']);
  assert.deepStrictEqual(crossDriveConflicts([{ id: '005', affected_paths: ['fresh/'] }], [
    { blueprint: 'epic/other', ledgerFile: '/ledger', tasks: [{ id: '105', affected_paths: ['else/'] }] },
  ]), []);
});

test('otherDriveTasks with own, detached, absent, pending, and unreadable ledgers → filters or rejects safely', () => {
  const repo = repoTemplate.copy();
  const own = '.bouncer/context/epics/e/blueprints/own';
  const other = '.bouncer/context/epics/e/blueprints/other';
  const detached = '.bouncer/context/epics/e/blueprints/detached';
  const pending = '.bouncer/context/epics/e/blueprints/pending';
  const write = (blueprint, ledger) => {
    const { ledgerFile } = coordinatorPathsFor({ repoRoot: repo, blueprint });
    fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
    return ledgerFile;
  };
  const ownFile = write(own, { blueprint: own, status: 'active', tasks: [] });
  write(other, { blueprint: other, status: 'active', tasks: [
    { id: '001', status: 'prepared', affected_paths: ['src/'] },
    { id: '002', status: 'pending', affected_paths: ['test/'] },
  ] });
  write(detached, { blueprint: detached, status: 'detached', tasks: [{ id: '003', status: 'prepared' }] });
  const result = otherDriveTasks({ repoRoot: repo, ownLedgerFile: ownFile });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.drives.map((drive) => drive.blueprint), [other]);
  assert.deepStrictEqual(result.drives[0].tasks.map((task) => task.id), ['001']);

  const broken = write(pending, '{');
  assert.deepStrictEqual(otherDriveTasks({ repoRoot: repo, ownLedgerFile: ownFile }), {
    ok: false, reason: 'cross-drive-ledger-unreadable', ledgerFile: broken,
  });
});

test('prepare with a started task in another blueprint → rejects overlapping scope before opening workers', () => {
  const repo = repoTemplate.copy();
  const blueprints = ['.bouncer/context/epics/001-e/blueprints/001-a',
    '.bouncer/context/epics/001-e/blueprints/002-b'];
  for (const [index, blueprint] of blueprints.entries()) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'index.md'),
      '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
    fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
      `---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - ${index === 0 ? 'src/' : 'src/file.ts'}\n---\n`);
  }
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'plan'], { cwd: repo });
  const first = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: blueprints[0] });
  const second = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: blueprints[1] });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  assert.strictEqual(second.ok, true, JSON.stringify(second));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo,
    blueprint: blueprints[0], cwd: first.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const rejected = coordinate({ command: 'prepare', repoRoot: repo,
    blueprint: blueprints[1], cwd: second.integrationPath });
  assert.strictEqual(rejected.reason, 'cross-drive-conflict');
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.conflicts[0].blueprint, blueprints[0]);
  assert.strictEqual(rejected.conflicts[0].task, '001');
  assert.deepStrictEqual(rejected.conflicts[0].paths, ['src/']);
  assert.strictEqual(fs.existsSync(path.join(second.integrationPath, '..', 'workers')), false);
  const firstRetry = coordinate({ command: 'prepare', repoRoot: repo,
    blueprint: blueprints[0], cwd: first.integrationPath });
  assert.strictEqual(firstRetry.ok, true, JSON.stringify(firstRetry));
});

test('prepare with disjoint paths and a shared exclusive resource → rejects the second drive', () => {
  const repo = repoTemplate.copy();
  const blueprints = ['.bouncer/context/epics/002-e/blueprints/001-a',
    '.bouncer/context/epics/002-e/blueprints/002-b'];
  for (const [index, blueprint] of blueprints.entries()) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'index.md'),
      '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
    fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
      `---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - ${index === 0 ? 'src/' : 'docs/'}\n  exclusive_resources:\n    - database-schema\n---\n`);
  }
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'plan'], { cwd: repo });
  const first = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: blueprints[0] });
  const second = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: blueprints[1] });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  assert.strictEqual(second.ok, true, JSON.stringify(second));
  const started = coordinate({ command: 'prepare', repoRoot: repo,
    blueprint: blueprints[0], cwd: first.integrationPath });
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  const rejected = coordinate({ command: 'prepare', repoRoot: repo,
    blueprint: blueprints[1], cwd: second.integrationPath });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'cross-drive-conflict');
  assert.deepStrictEqual(rejected.conflicts[0].paths, []);
  assert.deepStrictEqual(rejected.conflicts[0].resources, ['database-schema']);
});
