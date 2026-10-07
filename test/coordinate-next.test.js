'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');
const { coordinateNext, NEXT_FAILURE_HINTS } = require('../scripts/lib/coordinate-next');
const { readDoc } = require('../scripts/lib/frontmatter');
const { renderDoc } = require('../scripts/lib/render');

const __coordinatorMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const __LEDGER_REL = '.bouncer/runtime/coordinator.json';
const __FENCED = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke',
]);
function __fence(repoRoot, blueprint) {
  const { ledgerFile } = __coordinatorPathsFor({ repoRoot, blueprint });
  return {
    ledgerPath: __LEDGER_REL,
    ledgerHash: crypto.createHash('sha256').update(fs.readFileSync(ledgerFile)).digest('hex'),
  };
}
function coordinate(opts) {
  if (__FENCED.has(opts.command)
    && opts.ledgerPath === undefined && opts.ledgerHash === undefined) {
    try {
      opts = { ...opts, ...__fence(opts.repoRoot, opts.blueprint) };
    } catch (_error) { /* missing ledger → core rejects */ }
  }
  return __coordinatorMod.coordinate(opts);
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function porcelain(cwd) {
  return String(execFileSync('git', ['status', '--porcelain=v1'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
}

function writeLedger(file, ledger) {
  fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`);
}

function loadLedger(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function acceptDispatchReport(repo, blueprint, worker, task = '001') {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task,
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task,
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: `accepted ${task}`,
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  return dispatched;
}

function writeBundle(root, blueprint, id, { tasks, verification, review, commitSha }) {
  const dir = path.join(root, blueprint, 'tasks', id);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = commitSha ? `  commit_sha: '${commitSha}'\n` : '';
  fs.writeFileSync(path.join(dir, 'tasks.md'),
    `---\nbouncer:\n  id: TASKS-${id}\n  status: ${tasks}\n  depends_on: []\n  parallel_safe: true\n${stamp}---\nbrief ${id}\n`);
  fs.writeFileSync(path.join(dir, 'verification.md'),
    `---\nbouncer:\n  id: VERIFY-${id}\n  status: ${verification}\n---\n# Verification\n`);
  fs.writeFileSync(path.join(dir, 'review.md'),
    `---\nbouncer:\n  id: REVIEW-${id}\n  status: ${review}\n---\n# Review\n`);
}

function writeReviewScope(root, blueprint) {
  fs.writeFileSync(
    path.join(root, blueprint, 'index.md'),
    '---\nbouncer:\n  status: approved\n  review_scope: blueprint\n---\n# Blueprint\n',
  );
}

function uncommittedPlanRepo(prefix, blueprint, tasks) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"/bin/true"}\n');
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  for (const [id, metadata] of tasks) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n${metadata}---\nbrief ${id}\n`);
  }
  return repo;
}

function preparedCommitDrive(prefix, blueprint) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
    '---\nbouncer:\n  status: ready\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\nbrief\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  return { repo, blueprint, worker, integrationPath: boot.integrationPath, ledgerFile };
}

function commitInWorker(worker, rel, body, message) {
  const abs = path.join(worker, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  git(worker, ['add', rel]);
  git(worker, ['commit', '-m', message]);
  return git(worker, ['rev-parse', 'HEAD']);
}

function setDocStatus(root, blueprint, id, name, status, extra = {}) {
  const file = path.join(root, blueprint, 'tasks', id, name);
  const prefix = name === 'tasks.md' ? 'TASKS' : name === 'verification.md' ? 'VERIFY' : 'REVIEW';
  const doc = fs.existsSync(file)
    ? readDoc(file)
    : { data: { bouncer: { id: `${prefix}-${id}` } }, body: `# ${prefix}\n` };
  doc.data.bouncer.status = status;
  Object.assign(doc.data.bouncer, extra);
  fs.writeFileSync(file, renderDoc(doc.data, doc.body));
}

function nextOf(drive, extra = {}) {
  return coordinateNext({
    repoRoot: drive.repo,
    blueprint: drive.blueprint,
    cwd: drive.integrationPath,
    ...extra,
  });
}

function assertNoWrite(drive, fn) {
  const before = fs.readFileSync(drive.ledgerFile);
  const porc = porcelain(drive.integrationPath);
  const result = fn();
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before);
  assert.strictEqual(porcelain(drive.integrationPath), porc);
  return result;
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

function runArgv(cwd, argv) {
  const rest = argv[0] === 'bouncer' ? argv.slice(1) : argv;
  const { io, buf } = capture();
  const before = process.cwd();
  process.chdir(cwd);
  let code;
  try {
    code = runCli(rest, io);
  } finally {
    process.chdir(before);
  }
  return { code, buf };
}

test('NEXT_FAILURE_HINTS covers the new next reasons only', () => {
  const keys = [
    'partial-closed', 'terminal-verification-failed', 'no-ready-task',
    'critical-recovery-open', 'task-reported-blocked', 'commit-evidence-mismatch',
    'verification-task-uses-blueprint-next',
  ];
  assert.deepStrictEqual(Object.keys(NEXT_FAILURE_HINTS).sort(), [...keys].sort());
  for (const key of keys) {
    assert.strictEqual(typeof NEXT_FAILURE_HINTS[key].cause, 'string');
    assert.strictEqual(typeof NEXT_FAILURE_HINTS[key].next, 'string');
  }
  assert.match(NEXT_FAILURE_HINTS['terminal-verification-failed'].next, /coordinate repair/);
});

test('blueprint next: partial_closed is blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/001-partial';
  const drive = preparedCommitDrive('bouncer-next-partial-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.status = 'partial_closed';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'partial-closed');
  assert.strictEqual(r.cause, NEXT_FAILURE_HINTS['partial-closed'].cause);
  assert.strictEqual(r.next, NEXT_FAILURE_HINTS['partial-closed'].next);
  assert.ok(!('tasks' in r) && !('decisions' in r));
});

test('blueprint next: awaiting_confirmation uses repair-wave-limit', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/002-repair';
  const drive = preparedCommitDrive('bouncer-next-repair-lim-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.status = 'awaiting_confirmation';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'repair-wave-limit');
  assert.strictEqual(r.cause, __coordinatorMod.COORDINATE_FAILURE_HINTS['repair-wave-limit'].cause);
});

test('blueprint next: terminalFailure while verifying is blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/003-term';
  const repo = uncommittedPlanRepo('bouncer-next-term-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  execution_kind: verification\n  depends_on: []\n  parallel_safe: true\n  verify: "/bin/true"\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = loadLedger(ledgerFile);
  const verify = ledger.tasks.find((t) => t.execution_kind === 'verification');
  verify.status = 'verifying';
  ledger.terminalFailure = {
    task: verify.id, command: 'true', summary: 'failed', paths: ['src/'], exitCode: 1, repairWave: 0,
  };
  writeLedger(ledgerFile, ledger);
  const drive = { repo, blueprint, integrationPath: boot.integrationPath, ledgerFile };
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'terminal-verification-failed');
  assert.match(r.next, /coordinate repair/);
});

test('blueprint next: non-null fanin is integrate', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/004-fanin';
  const drive = preparedCommitDrive('bouncer-next-fanin-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.fanin = {
    base_head: ledger.integrationHead, candidate_head: null, tasks: ['001'], status: 'building',
  };
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'integrate');
  assert.ok(r.argv.includes('integrate'));
  assert.ok(r.argv.includes('--blueprint'));
  assert.ok(r.argv.includes('--ledger-path'));
  assert.ok(r.argv.includes('--ledger-hash'));
});

test('blueprint next: prepared commit tasks are drive_tasks', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/005-drive';
  const drive = preparedCommitDrive('bouncer-next-drive-', blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'drive_tasks');
  assert.deepStrictEqual(r.task_ids, ['001']);
  assert.strictEqual(r.scope, 'blueprint');
});

test('blueprint next: recorded without prepared is integrate', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/006-rec';
  const drive = preparedCommitDrive('bouncer-next-rec-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks[0].status = 'recorded';
  ledger.tasks[0].sha = 'a'.repeat(40);
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'integrate');
});

test('blueprint next: bootstrap with pending tasks is prepare', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/007-prep';
  const repo = uncommittedPlanRepo('bouncer-next-prep-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const drive = {
    repo, blueprint, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'prepare');
  assert.ok(r.argv.includes('prepare'));
});

test('blueprint next: ready verification task is verification_node', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/008-vn';
  const repo = uncommittedPlanRepo('bouncer-next-vn-', blueprint, [
    ['001', '  execution_kind: verification\n  depends_on: []\n  parallel_safe: true\n  verify: "/bin/true"\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const drive = {
    repo, blueprint, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'verification_node');
  assert.ok(r.argv.includes('integrate'));
  assert.ok(r.argv.includes('001'));
  assert.strictEqual(r.cwd, boot.integrationPath);
});

test('blueprint next: all integrated in review mode without accepted root review is final_review', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/009-fr';
  const drive = preparedCommitDrive('bouncer-next-fr-', blueprint);
  writeReviewScope(drive.integrationPath, blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks.forEach((t) => { t.status = 'integrated'; });
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.ok(r.argv.includes('review-dispatch'));
  assert.strictEqual(r.judge.kind, 'review-round');
});

test('blueprint next: all integrated is done', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/010-done';
  const drive = preparedCommitDrive('bouncer-next-done-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks.forEach((t) => { t.status = 'integrated'; });
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'done');
  assert.strictEqual(r.argv, undefined);
});

test('blueprint next: no ready wave is no-ready-task', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/011-none';
  const drive = preparedCommitDrive('bouncer-next-nrt-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks[0].status = 'verifying';
  ledger.tasks[0].execution_kind = 'commit';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'no-ready-task');
});

test('task next: recorded/integrated/pending/ready return none', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/012-none-task';
  const drive = preparedCommitDrive('bouncer-next-tnone-', blueprint);
  for (const status of ['recorded', 'integrated', 'pending', 'ready']) {
    const ledger = loadLedger(drive.ledgerFile);
    ledger.tasks[0].status = status;
    writeLedger(drive.ledgerFile, ledger);
    const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
    assert.strictEqual(r.ok, true, status);
    assert.strictEqual(r.action, 'none', status);
    assert.strictEqual(r.reason, status);
  }
});

test('task next: open critical recovery is blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/013-cr';
  const drive = preparedCommitDrive('bouncer-next-cr-', blueprint);
  const started = coordinate({
    command: 'critical-recovery', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    task: '001', findings: ['R-1'], reason: 'blocker',
  });
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'critical-recovery-open');
});

test('task next: no dispatch is dispatch', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/014-disp';
  const drive = preparedCommitDrive('bouncer-next-disp-', blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'dispatch');
  assert.strictEqual(r.cwd, drive.worker);
  assert.ok(r.argv.includes('dispatch'));
  assert.ok(r.argv.includes('--lease-id'));
  assert.strictEqual(r.judge.kind, 'intent-symbols');
});

test('task next: accepted report is record', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/015-rec';
  const drive = preparedCommitDrive('bouncer-next-trec-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker, '001');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'record');
  assert.strictEqual(r.judge.kind, 'record-decision');
  assert.ok(r.judge.fields.includes('--decision'));
});

test('task next: scope_revision with unchanged brief is revise', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/016-rev';
  const drive = preparedCommitDrive('bouncer-next-rev-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'scope_revision', summary: 'need paths',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'revise');
  assert.strictEqual(r.judge.kind, 'scope-revision');
});

test('task next: reported blocked is blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/017-blk';
  const drive = preparedCommitDrive('bouncer-next-blk-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'blocked', summary: 'stuck',
  });
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'task-reported-blocked');
});

test('task next: other reported outcomes re-dispatch', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/018-rew';
  const drive = preparedCommitDrive('bouncer-next-rew-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'rework', summary: 'again',
  });
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'dispatch');
  assert.strictEqual(r.judge.kind, 'intent-symbols');
});

test('task next: active dispatch at baseline is implement', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/019-imp';
  const drive = preparedCommitDrive('bouncer-next-imp-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'implement');
  assert.strictEqual(r.argv, undefined);
  assert.strictEqual(r.payload.attempt, 1);
  assert.strictEqual(r.payload.task_brief_hash, dispatched.metadata.task_brief_hash);
  assert.strictEqual(r.payload.base_head, dispatched.metadata.base_head);
  assert.strictEqual('previous_outcome' in r.payload, false);
});

test('task next: dirty worker without verified docs is verify', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/020-ver';
  const drive = preparedCommitDrive('bouncer-next-ver-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'verify');
  assert.deepStrictEqual(r.argv.slice(0, 2), ['bouncer', 'validate']);
  assert.ok(r.argv.includes('--gate'));
});

test('task next: per-task review after verify evidence is review', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/021-revw';
  const drive = preparedCommitDrive('bouncer-next-revw-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const sha = commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'pending', commitSha: undefined,
  });
  void sha;
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'review');
  assert.ok(r.argv.includes('review-dispatch'));
  assert.strictEqual(r.judge.kind, 'review-round');
});

test('task next: missing commit_sha is commit', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/022-cmt';
  const drive = preparedCommitDrive('bouncer-next-cmt-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const sha = commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  void sha;
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'commit');
  assert.ok(r.argv.includes('commit'));
  assert.ok(r.argv.includes('--yes'));
});

test('task next: matching commit_sha with only tasks.md dirty is report', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/023-rep';
  const drive = preparedCommitDrive('bouncer-next-rep-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const sha = commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  git(drive.worker, ['add', '-A']);
  git(drive.worker, ['commit', '-m', 'evidence']);
  const head = git(drive.worker, ['rev-parse', 'HEAD']);
  setDocStatus(drive.worker, blueprint, '001', 'tasks.md', 'verified', {
    commit_sha: head.slice(0, 8),
  });
  void sha;
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'report');
  assert.strictEqual(r.judge.kind, 'report-outcome');
  assert.ok(r.argv.includes('--attempt'));
  assert.ok(r.argv.includes('--task-brief-hash'));
});

test('task next: dirty files besides tasks.md is commit-evidence-mismatch', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/024-mis';
  const drive = preparedCommitDrive('bouncer-next-mis-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const sha = commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  git(drive.worker, ['add', '-A']);
  git(drive.worker, ['commit', '-m', 'evidence']);
  const head = git(drive.worker, ['rev-parse', 'HEAD']);
  setDocStatus(drive.worker, blueprint, '001', 'tasks.md', 'verified', {
    commit_sha: head.slice(0, 8),
  });
  void sha;
  fs.writeFileSync(path.join(drive.worker, 'src/extra.js'), 'extra\n');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'commit-evidence-mismatch');
});

test('verification --task is refused', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/025-vtask';
  const repo = uncommittedPlanRepo('bouncer-next-vtask-', blueprint, [
    ['001', '  execution_kind: verification\n  depends_on: []\n  parallel_safe: true\n  verify: "/bin/true"\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const drive = {
    repo, blueprint, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'verification-task-uses-blueprint-next');
});

test('bad --task format is task-required', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/026-fmt';
  const drive = preparedCommitDrive('bouncer-next-fmt-', blueprint);
  const r = nextOf(drive, { task: '1' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'task-required');
});

test('unknown task is task-outside-blueprint', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/027-out';
  const drive = preparedCommitDrive('bouncer-next-out-', blueprint);
  const r = nextOf(drive, { task: '099' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'task-outside-blueprint');
});

function fillJudge(result) {
  if (!result.argv) return result.argv;
  const argv = [...result.argv];
  if (result.judge && result.judge.kind === 'report-outcome') {
    argv.push('--outcome', 'accepted', '--summary', 'fixture accepted');
  }
  if (result.judge && result.judge.kind === 'record-decision') {
    argv.push('--decision', 'fixture record');
  }
  return argv;
}

function simulateWorker(drive, result) {
  const task = result.task || '001';
  const worker = result.cwd;
  if (result.action === 'implement') {
    commitInWorker(worker, `src/task-${task}.js`, `changed by ${task}\n`, `feat: ${task}`);
    return;
  }
  if (result.action === 'verify') {
    setDocStatus(worker, drive.blueprint, task, 'tasks.md', 'verified');
    setDocStatus(worker, drive.blueprint, task, 'verification.md', 'passed');
    return;
  }
  if (result.action === 'review') {
    setDocStatus(worker, drive.blueprint, task, 'review.md', 'accepted');
    return;
  }
  if (result.action === 'final_review') {
    const file = path.join(drive.integrationPath, drive.blueprint, 'review.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\nbouncer:\n  status: accepted\n---\n# Review\n');
    return;
  }
  if (result.action === 'commit') {
    const brief = `${drive.blueprint}/tasks/${task}/tasks.md`;
    const listed = porcelain(worker).split('\n').filter(Boolean).map((line) => line.slice(3));
    const toAdd = listed.filter((rel) => rel.replaceAll('\\', '/') !== brief.replaceAll('\\', '/'));
    if (toAdd.length > 0) {
      git(worker, ['add', '--', ...toAdd]);
      git(worker, ['commit', '-m', `evidence ${task}`]);
    }
    const sha = git(worker, ['rev-parse', 'HEAD']);
    setDocStatus(worker, drive.blueprint, task, 'tasks.md', 'verified', { commit_sha: sha.slice(0, 8) });
  }
}

function shouldRunCli(result) {
  if (!result.argv) return false;
  const rest = result.argv[0] === 'bouncer' ? result.argv.slice(1) : result.argv;
  return rest[0] === 'coordinate';
}

function driveOneTask(drive, taskId) {
  for (let i = 0; i < 20; i += 1) {
    const r = nextOf(drive, { task: taskId });
    assert.notStrictEqual(r.action, 'blocked', JSON.stringify(r));
    if (r.action === 'none') return r;
    simulateWorker(drive, r);
    if (shouldRunCli(r)) {
      const ran = runArgv(r.cwd, fillJudge(r));
      assert.strictEqual(ran.code, 0, `${r.action} ${ran.buf.err}${ran.buf.out}`);
    }
  }
  assert.fail(`task ${taskId} did not reach none`);
}

function mixedPreparedDrive(prefix, blueprint, { reviewMode = false } = {}) {
  const repo = uncommittedPlanRepo(prefix, blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n  affected_paths: ["src/task-001.js"]\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n  affected_paths: ["src/task-002.js"]\n'],
    ['003', '  execution_kind: verification\n  depends_on: ["001", "002"]\n  parallel_safe: true\n  verify: "/bin/true"\n'],
  ]);
  if (reviewMode) writeReviewScope(repo, blueprint);
  fs.writeFileSync(
    path.join(repo, blueprint, 'tasks/003/verification.md'),
    '---\nbouncer:\n  id: VERIFY-003\n  status: pending\n---\n# Verification\n',
  );
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  if (reviewMode) writeReviewScope(boot.integrationPath, blueprint);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks
    .filter((t) => t.workerPath)
    .map((t) => [t.id, t.workerPath]));
  return {
    repo,
    blueprint,
    workers,
    integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
}

function runFixtureToDone(drive) {
  for (let i = 0; i < 40; i += 1) {
    const r = nextOf(drive);
    assert.notStrictEqual(r.action, 'blocked', JSON.stringify(r));
    if (r.action === 'done') return r;
    if (r.action === 'drive_tasks') {
      for (const id of r.task_ids) driveOneTask(drive, id);
      continue;
    }
    simulateWorker(drive, r);
    if (shouldRunCli(r)) {
      const ran = runArgv(r.cwd, fillJudge(r));
      assert.strictEqual(ran.code, 0, `${r.action} ${ran.buf.err}${ran.buf.out}`);
    }
  }
  assert.fail('did not reach done in 40 steps');
}

test('fixture tour: per-task review with two commit tasks and a verification node reaches done', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/028-tour-task';
  const drive = mixedPreparedDrive('bouncer-next-tour-t-', blueprint, { reviewMode: false });
  const done = runFixtureToDone(drive);
  assert.strictEqual(done.action, 'done');
});

test('fixture tour: blueprint review mode reaches done', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/029-tour-bp';
  const drive = mixedPreparedDrive('bouncer-next-tour-b-', blueprint, { reviewMode: true });
  const done = runFixtureToDone(drive);
  assert.strictEqual(done.action, 'done');
});
