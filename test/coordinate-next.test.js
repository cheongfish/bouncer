'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../scripts/lib/cli');
const { createGitTemplate } = require('./helpers/git-fixture');
const {
  coordinateNext, NEXT_FAILURE_HINTS, attachJudgeContext,
} = require('../scripts/lib/coordinate-next');
const { readDoc } = require('../scripts/lib/frontmatter');
const { renderDoc } = require('../scripts/lib/render');

const __coordinatorMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const __LEDGER_REL = '.bouncer/runtime/coordinator.json';
const __FENCED = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke', 'promote-stop', 'session-open',
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

/**
 * `coordinate report`가 읽는 worker 보고 파일을 쓴다. full 모드 report 호출 전에 필요하다.
 * `revision`·`open`·`weak`로 줄이나 섹션을 바꾸거나 null로 빼서 거절 경로를 만든다.
 */
function writeWorkerReport(worker, task, attempt, hash, {
  revision = `attempt: ${attempt}\ntask_brief_hash: ${hash}`,
  open = '- none', weak = '- none',
} = {}) {
  const dir = path.join(worker, '.bouncer', 'runtime', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const parts = ['## Changed files\n- `src/a.js` — fixture', `## Brief revision\n${revision}`];
  if (open !== null) parts.push(`## Open choices\n${open}`);
  if (weak !== null) parts.push(`## Known weaknesses\n${weak}`);
  fs.writeFileSync(path.join(dir, `${task}-${attempt}.md`), `${parts.join('\n\n')}\n`);
}

function acceptDispatchReport(repo, blueprint, worker, task = '001') {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task,
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  writeWorkerReport(worker, task, dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
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

// init·로컬 config·README 커밋까지를 파일당 한 번만 만들고 테스트마다 복사한다.
// bootstrap·prepare가 만드는 worktree는 절대 경로를 담으므로 복사 뒤에 실행한다.
const fixtureTemplate = createGitTemplate((repo) => {
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
});
test.after(() => fixtureTemplate.dispose());

function uncommittedPlanRepo(prefix, blueprint, tasks) {
  const repo = fixtureTemplate.copy();
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
  const repo = fixtureTemplate.copy();
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

// 계약 카드를 싣는 action 10개. 판단·worker 행동만 카드를 받고, argv만 실행하는
// 기계적 action(prepare·drive_tasks·integrate·verification_node·commit·done·none)은
// 카드 키 자체가 없어야 응답이 불필요하게 커지지 않는다.
const CARD_ACTIONS = [
  'dispatch', 'implement', 'verify', 'review', 'report', 'revise', 'record', 'final_review', 'supplement',
  'blocked',
];
const CARD_DIR = path.join(__dirname, '..', 'references', 'coordinator-cards');

function assertCardFor(r) {
  if (r.ok === true && CARD_ACTIONS.includes(r.action)) {
    assert.ok(r.card, `${r.action} must carry card`);
    assert.strictEqual(r.card.id, r.action);
    assert.strictEqual(typeof r.card.body, 'string');
    assert.ok(r.card.body.trim().length > 0, `${r.action} card body is empty`);
    assert.strictEqual(r.card.body, fs.readFileSync(path.join(CARD_DIR, `${r.action}.md`), 'utf8'));
    return;
  }
  assert.ok(!('card' in r), `${r.action} must not carry card`);
}

function cardBodies() {
  return CARD_ACTIONS.map((id) => fs.readFileSync(path.join(CARD_DIR, `${id}.md`), 'utf8'));
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

test('new next reasons를 NEXT_FAILURE_HINTS와 대조함 → new next reasons만 덮음', () => {
  const keys = [
    'partial-closed', 'terminal-verification-failed', 'no-ready-task',
    'critical-recovery-open', 'task-reported-blocked', 'commit-evidence-mismatch',
    'verification-task-uses-blueprint-next', 'coordinator-card-missing',
  ];
  assert.deepStrictEqual(Object.keys(NEXT_FAILURE_HINTS).sort(), [...keys].sort());
  for (const key of keys) {
    assert.strictEqual(typeof NEXT_FAILURE_HINTS[key].cause, 'string');
    assert.strictEqual(typeof NEXT_FAILURE_HINTS[key].next, 'string');
  }
  assert.match(NEXT_FAILURE_HINTS['terminal-verification-failed'].next, /coordinate repair/);
});

test('blueprint next에서 partial_closed → blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/001-partial';
  const drive = preparedCommitDrive('bouncer-next-partial-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.status = 'partial_closed';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'partial-closed');
  assert.strictEqual(r.cause, NEXT_FAILURE_HINTS['partial-closed'].cause);
  assert.strictEqual(r.next, NEXT_FAILURE_HINTS['partial-closed'].next);
  assert.ok(!('tasks' in r) && !('decisions' in r));
});

test('blueprint next에서 promotion_stopped → blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/001-promote-stop';
  const drive = preparedCommitDrive('bouncer-next-promote-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.status = 'promotion_stopped';
  ledger.mode = 'light';
  ledger.promotion = {
    reason: 'task-split',
    summary: 'needs full',
    task: '001',
    diff_sha: 'a'.repeat(64),
  };
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'promotion-stopped');
  assert.strictEqual(
    r.cause,
    __coordinatorMod.COORDINATE_FAILURE_HINTS['promotion-stopped'].cause,
  );
  assert.strictEqual(
    r.next,
    __coordinatorMod.COORDINATE_FAILURE_HINTS['promotion-stopped'].next,
  );
});

test('blueprint next에서 awaiting_confirmation → repair-wave-limit를 씀', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/002-repair';
  const drive = preparedCommitDrive('bouncer-next-repair-lim-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.status = 'awaiting_confirmation';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'repair-wave-limit');
  assert.strictEqual(r.cause, __coordinatorMod.COORDINATE_FAILURE_HINTS['repair-wave-limit'].cause);
});

test('blueprint next에서 verifying 중 terminalFailure → blocked', () => {
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
  assertCardFor(r);
  assert.strictEqual(r.reason, 'terminal-verification-failed');
  assert.match(r.next, /coordinate repair/);
});

test('blueprint next에서 fanin이 null이 아님 → integrate', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/004-fanin';
  const drive = preparedCommitDrive('bouncer-next-fanin-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.fanin = {
    base_head: ledger.integrationHead, candidate_head: null, tasks: ['001'], status: 'building',
  };
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'integrate');
  assertCardFor(r);
  assert.ok(r.argv.includes('integrate'));
  assert.ok(r.argv.includes('--blueprint'));
  assert.ok(r.argv.includes('--ledger-path'));
  assert.ok(r.argv.includes('--ledger-hash'));
});

test('blueprint next에서 prepared commit tasks → drive_tasks', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/005-drive';
  const drive = preparedCommitDrive('bouncer-next-drive-', blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'drive_tasks');
  assertCardFor(r);
  assert.deepStrictEqual(r.task_ids, ['001']);
  assert.strictEqual(r.scope, 'blueprint');
});

test('blueprint next에서 prepared 없이 recorded → integrate', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/006-rec';
  const drive = preparedCommitDrive('bouncer-next-rec-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks[0].status = 'recorded';
  ledger.tasks[0].sha = 'a'.repeat(40);
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'integrate');
  assertCardFor(r);
});

test('blueprint next에서 pending tasks가 있는 bootstrap → prepare', () => {
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
  assertCardFor(r);
  assert.ok(r.argv.includes('prepare'));
});

test('blueprint next에서 ready verification task → verification_node', () => {
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
  assertCardFor(r);
  assert.ok(r.argv.includes('integrate'));
  assert.ok(r.argv.includes('001'));
  assert.strictEqual(r.cwd, boot.integrationPath);
});

test('blueprint next에서 review mode의 all integrated이고 accepted root review 없음 → final_review', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/009-fr';
  const drive = preparedCommitDrive('bouncer-next-fr-', blueprint);
  writeReviewScope(drive.integrationPath, blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks.forEach((t) => { t.status = 'integrated'; });
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assertCardFor(r);
  assert.ok(r.argv.includes('review-dispatch'));
  assert.strictEqual(r.judge.kind, 'review-round');
});

function supplementReviewDrive(prefix, blueprint, decisions) {
  const drive = preparedCommitDrive(prefix, blueprint);
  writeReviewScope(drive.integrationPath, blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks.forEach((t) => { t.status = 'integrated'; });
  ledger.decisions = decisions;
  writeLedger(drive.ledgerFile, ledger);
  return drive;
}

test('blueprint next에서 pending supplement decision → supplement action', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/020-supp';
  const drive = supplementReviewDrive('bouncer-next-supp-', blueprint, [
    { kind: 'supplement', outcome: 'pending', paths: ['test/a.test.js'], findings: ['F1'] },
  ]);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'supplement');
  assert.strictEqual(r.scope, 'blueprint');
  assert.strictEqual(r.cwd, drive.integrationPath);
  assert.deepStrictEqual(r.payload.paths, ['test/a.test.js']);
  assertCardFor(r);
});

test('blueprint next에서 verified supplement → delta mode의 final_review', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/021-supp';
  const drive = supplementReviewDrive('bouncer-next-supp-v-', blueprint, [
    { kind: 'supplement', outcome: 'verified', paths: ['test/a.test.js'], findings: ['F1'] },
  ]);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.strictEqual(r.payload.mode, 'delta');
  assert.deepStrictEqual(r.argv.slice(-2), ['--mode', 'delta']);
  assertCardFor(r);
});

test('blueprint next에서 supplement decision 없음 → final_review에 mode가 없음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/022-supp';
  const drive = supplementReviewDrive('bouncer-next-supp-n-', blueprint, []);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.strictEqual(r.payload, undefined);
  assert.ok(!r.argv.includes('--mode'));
});

test('root review에 discovery round → final_review argv 끝이 --mode delta이고 payload.mode delta', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/023-disc';
  const drive = supplementReviewDrive('bouncer-next-disc-', blueprint, []);
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'review.md'),
    '---\nbouncer:\n  status: requested\n  review:\n    rounds:\n      - round: 1\n        mode: discovery\n---\n# Review\n',
  );
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.strictEqual(r.payload.mode, 'delta');
  assert.deepStrictEqual(r.argv.slice(-2), ['--mode', 'delta']);
  assertCardFor(r);
});

test('root review.md YAML이 깨짐 → final_review argv에 --mode 없음, 예외 없음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/024-bad-yaml';
  const drive = supplementReviewDrive('bouncer-next-bad-yaml-', blueprint, []);
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'review.md'),
    '---\nbouncer: [\n---\n# Review\n',
  );
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.strictEqual(r.payload, undefined);
  assert.ok(!r.argv.includes('--mode'));
});

test('blueprint next에서 all integrated → done', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/010-done';
  const drive = preparedCommitDrive('bouncer-next-done-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks.forEach((t) => { t.status = 'integrated'; });
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'done');
  assertCardFor(r);
  assert.strictEqual(r.argv, undefined);
});

test('blueprint next에서 ready wave 없음 → no-ready-task', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/011-none';
  const drive = preparedCommitDrive('bouncer-next-nrt-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks[0].status = 'verifying';
  ledger.tasks[0].execution_kind = 'commit';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'no-ready-task');
});

test('task next에서 recorded/integrated/pending/ready → none', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/012-none-task';
  const drive = preparedCommitDrive('bouncer-next-tnone-', blueprint);
  for (const status of ['recorded', 'integrated', 'pending', 'ready']) {
    const ledger = loadLedger(drive.ledgerFile);
    ledger.tasks[0].status = status;
    writeLedger(drive.ledgerFile, ledger);
    const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
    assert.strictEqual(r.ok, true, status);
    assert.strictEqual(r.action, 'none', status);
    assertCardFor(r);
    assert.strictEqual(r.reason, status);
  }
});

test('task next에서 open critical recovery → blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/013-cr';
  const drive = preparedCommitDrive('bouncer-next-cr-', blueprint);
  const started = coordinate({
    command: 'critical-recovery', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    task: '001', findings: ['R-1'], reason: 'blocker',
  });
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'critical-recovery-open');
});

test('task next에서 dispatch 없음 → dispatch', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/014-disp';
  const drive = preparedCommitDrive('bouncer-next-disp-', blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'dispatch');
  assertCardFor(r);
  assert.strictEqual(r.cwd, drive.worker);
  assert.ok(r.argv.includes('dispatch'));
  assert.ok(r.argv.includes('--lease-id'));
  assert.strictEqual(r.judge.kind, 'intent-symbols');
});

test('task next에서 accepted report → record', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/015-rec';
  const drive = preparedCommitDrive('bouncer-next-trec-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker, '001');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'record');
  assertCardFor(r);
  assert.strictEqual(r.judge.kind, 'record-decision');
  assert.ok(r.judge.fields.includes('--decision'));
});

test('task next에서 brief가 그대로인 scope_revision → revise', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/016-rev';
  const drive = preparedCommitDrive('bouncer-next-rev-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  writeWorkerReport(drive.worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'scope_revision', summary: 'need paths',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'revise');
  assertCardFor(r);
  assert.strictEqual(r.judge.kind, 'scope-revision');
});

// F-SS-001: 보고 뒤 brief가 바뀌면 개정이 끝난 상태다. mismatch blocked가 아니라
// 표의 "reported, 그 밖" 재디스패치로 간다.
test('task next에서 brief가 바뀐 scope_revision → dispatch', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/016-rev2';
  const drive = preparedCommitDrive('bouncer-next-rev2-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  writeWorkerReport(drive.worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'scope_revision', summary: 'need paths',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const brief = path.join(drive.worker, blueprint, 'tasks/001/tasks.md');
  fs.appendFileSync(brief, 'revised paths\n');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'dispatch');
  assertCardFor(r);
  assert.strictEqual(r.reason, undefined);
  assert.notStrictEqual(r.action, 'blocked');
  assert.strictEqual(r.judge.kind, 'intent-symbols');
});

test('task next에서 reported blocked → blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/017-blk';
  const drive = preparedCommitDrive('bouncer-next-blk-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  writeWorkerReport(drive.worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'blocked', summary: 'stuck',
  });
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'task-reported-blocked');
});

test('task next에서 그 밖의 reported outcomes → re-dispatch', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/018-rew';
  const drive = preparedCommitDrive('bouncer-next-rew-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  writeWorkerReport(drive.worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'rework', summary: 'again',
  });
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'dispatch');
  assertCardFor(r);
  assert.strictEqual(r.judge.kind, 'intent-symbols');
});

test('task next에서 baseline의 active dispatch → implement', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/019-imp';
  const drive = preparedCommitDrive('bouncer-next-imp-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'implement');
  assertCardFor(r);
  assert.strictEqual(r.argv, undefined);
  assert.strictEqual(r.payload.attempt, 1);
  assert.strictEqual(r.payload.task_brief_hash, dispatched.metadata.task_brief_hash);
  assert.strictEqual(r.payload.base_head, dispatched.metadata.base_head);
  assert.strictEqual(typeof r.payload.report_path, 'string');
  assert.strictEqual(r.payload.report_path, dispatched.report_path);
  assert.strictEqual('previous_outcome' in r.payload, false);
  // 첫 implement는 직전 report 결정이 없어 payload.report 키 자체가 없다.
  assert.strictEqual('report' in r.payload, false);
});

test('task next에서 verified docs 없는 dirty worker → verify', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/020-ver';
  const drive = preparedCommitDrive('bouncer-next-ver-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'verify');
  assertCardFor(r);
  assert.deepStrictEqual(r.argv.slice(0, 2), ['bouncer', 'validate']);
  assert.ok(r.argv.includes('--gate'));
});

test('task next에서 verify evidence 뒤 per-task review → review', () => {
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
  assertCardFor(r);
  assert.ok(r.argv.includes('review-dispatch'));
  assert.strictEqual(r.judge.kind, 'review-round');
});

test('task next에서 commit_sha 없음 → commit', () => {
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
  assertCardFor(r);
  assert.ok(r.argv.includes('commit'));
  assert.ok(r.argv.includes('--yes'));
});

test('task next에서 commit_sha 일치하고 tasks.md만 dirty → report', () => {
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
  assertCardFor(r);
  assert.strictEqual(r.judge.kind, 'report-outcome');
  assert.ok(r.argv.includes('--attempt'));
  assert.ok(r.argv.includes('--task-brief-hash'));
});

test('task next에서 tasks.md 외 dirty files → commit-evidence-mismatch', () => {
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
  assertCardFor(r);
  assert.strictEqual(r.reason, 'commit-evidence-mismatch');
});

// /bouncer-plan leaves plan documents uncommitted until finalize, and seed copies them into the worker,
// so the worker is already dirty when the attempt opens. Benchmark runs of a full bouncer drive were blocked here.
test('task next에서 dispatch가 남긴 seeded plan documents가 dirty → report를 허용함', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/040-seed';
  const repo = uncommittedPlanRepo('bouncer-next-seed-', blueprint, [
    ['001', '  status: ready\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const drive = { repo, blueprint, worker: prepared.tasks[0].workerPath, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json') };
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.notStrictEqual(dispatched.metadata.initial_worktree_state, '');
  commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  const head = git(drive.worker, ['rev-parse', 'HEAD']);
  setDocStatus(drive.worker, blueprint, '001', 'tasks.md', 'verified', { commit_sha: head.slice(0, 8) });
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'report', JSON.stringify({ r, porcelain: porcelain(drive.worker) }));
});

test('verification에 --task를 줌 → 거절됨', () => {
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
  assert.ok(!('card' in r));
});

test('--task 형식이 잘못됨 → task-required', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/026-fmt';
  const drive = preparedCommitDrive('bouncer-next-fmt-', blueprint);
  const r = nextOf(drive, { task: '1' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'task-required');
});

test('알 수 없는 task → task-outside-blueprint', () => {
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
  if (result.action === 'report') {
    // report argv가 활성 dispatch 값을 미리 채워 두므로 그 값으로 worker 보고 파일을 쓴다.
    const flag = (name) => result.argv[result.argv.indexOf(name) + 1];
    writeWorkerReport(worker, task, Number(flag('--attempt')), flag('--task-brief-hash'));
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

test('fixture tour에서 commit task 둘과 verification node가 있는 per-task review → done에 도달함', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/028-tour-task';
  const drive = mixedPreparedDrive('bouncer-next-tour-t-', blueprint, { reviewMode: false });
  const done = runFixtureToDone(drive);
  assert.strictEqual(done.action, 'done');
});

test('fixture tour에서 blueprint review mode → done에 도달함', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/029-tour-bp';
  const drive = mixedPreparedDrive('bouncer-next-tour-b-', blueprint, { reviewMode: true });
  const done = runFixtureToDone(drive);
  assert.strictEqual(done.action, 'done');
});

function assertJudgePayloadShape(out, { requireEvidence = false } = {}) {
  assert.ok(out.ok === true, JSON.stringify(out));
  assert.ok(!('completed_tasks' in out) && !('decisions' in out) && !('tasks' in out));
  assert.ok(out.payload && typeof out.payload === 'object', 'payload required');
  assert.strictEqual('previous_outcome' in out.payload, false);
  assert.deepStrictEqual(Object.keys(out.payload.report).sort(), ['attempt', 'outcome', 'summary']);
  if (requireEvidence || 'evidence' in out.payload) {
    assert.ok(Array.isArray(out.payload.evidence));
    assert.ok(out.payload.evidence.length > 0);
    for (const item of out.payload.evidence) {
      assert.deepStrictEqual(Object.keys(item).sort(), ['kind', 'path', 'sha256']);
      assert.ok(['report', 'verification', 'review'].includes(item.kind));
      assert.match(item.sha256, /^[a-f0-9]{64}$/);
    }
  }
}

test('task next after dispatch → report evidence pointer targets .bouncer/runtime/reports/<task>-<attempt>.md', () => {
  const blueprint = '.bouncer/context/epics/098-n/blueprints/001-ptr';
  const drive = preparedCommitDrive('bouncer-next-ptr-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const attempt = dispatched.metadata.attempt;
  writeWorkerReport(drive.worker, '001', attempt, dispatched.metadata.task_brief_hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'done',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const r = nextOf(drive, { task: '001' });
  const pointer = r.payload.evidence.find((item) => item.kind === 'report');
  assert.ok(pointer, JSON.stringify(r.payload.evidence));
  assert.strictEqual(
    pointer.path,
    path.join(drive.worker, '.bouncer', 'runtime', 'reports', `001-${attempt}.md`),
  );
});

test('judge payload에서 accepted report 뒤 record → report keys와 evidence를 실음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/034-judge-rec';
  const drive = preparedCommitDrive('bouncer-next-judge-rec-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker, '001');
  const taskDir = path.join(drive.worker, blueprint, 'tasks', '001');
  const reportPath = path.join(drive.worker, '.bouncer/runtime/reports/001-1.md');
  const verifyPath = path.join(taskDir, 'verification.md');
  const reviewPath = path.join(taskDir, 'review.md');
  fs.appendFileSync(reportPath, 'worker report body\n');
  fs.writeFileSync(verifyPath, '---\nbouncer:\n  id: VERIFY-001\n  status: passed\n---\n# Verification\n');
  fs.writeFileSync(reviewPath, '---\nbouncer:\n  id: REVIEW-001\n  status: accepted\n---\n# Review\n');
  const hashes = {
    report: crypto.createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex'),
    verification: crypto.createHash('sha256').update(fs.readFileSync(verifyPath)).digest('hex'),
    review: crypto.createHash('sha256').update(fs.readFileSync(reviewPath)).digest('hex'),
  };
  const out = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(out.action, 'record');
  assertCardFor(out);
  assertJudgePayloadShape(out, { requireEvidence: true });
  assert.deepStrictEqual(out.payload.report, {
    outcome: 'accepted', summary: 'accepted 001', attempt: 1,
  });
  assert.deepStrictEqual(
    out.payload.evidence.map((e) => e.kind).sort(),
    ['report', 'review', 'verification'],
  );
  for (const item of out.payload.evidence) {
    assert.strictEqual(item.sha256, hashes[item.kind]);
    assert.ok(item.path.startsWith(drive.worker));
  }
});

test('judge payload에서 rework 뒤 implement → previous_outcome 없이 report를 실음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/035-judge-imp';
  const drive = preparedCommitDrive('bouncer-next-judge-imp-', blueprint);
  const first = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  writeWorkerReport(drive.worker, '001', first.metadata.attempt, first.metadata.task_brief_hash);
  coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: first.metadata.attempt, taskBriefHash: first.metadata.task_brief_hash,
    outcome: 'rework', summary: 'needs another pass',
  });
  const redisp = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(redisp.action, 'dispatch');
  assertJudgePayloadShape(redisp);
  assert.deepStrictEqual(redisp.payload.report, {
    outcome: 'rework', summary: 'needs another pass', attempt: 1,
  });
  const again = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(again.ok, true);
  const out = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(out.action, 'implement');
  assertCardFor(out);
  assertJudgePayloadShape(out);
  assert.deepStrictEqual(out.payload.report, {
    outcome: 'rework', summary: 'needs another pass', attempt: 1,
  });
  assert.strictEqual(out.payload.attempt, 2);
});

test('judge payload에서 first dispatch와 first implement → report key를 생략함', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/036-judge-first';
  const drive = preparedCommitDrive('bouncer-next-judge-first-', blueprint);
  const dispatch = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(dispatch.action, 'dispatch');
  assertCardFor(dispatch);
  assert.ok(!('completed_tasks' in dispatch) && !('decisions' in dispatch) && !('tasks' in dispatch));
  const dispatchPayload = dispatch.payload || {};
  assert.strictEqual('report' in dispatchPayload, false);
  assert.strictEqual('previous_outcome' in dispatchPayload, false);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  const implement = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(implement.action, 'implement');
  assert.strictEqual('report' in implement.payload, false);
  assert.strictEqual('previous_outcome' in implement.payload, false);
});

test('judge payload에서 readEvidence가 null → 해당 evidence item은 빠지고 ok는 유지됨', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/037-judge-miss';
  const drive = preparedCommitDrive('bouncer-next-judge-miss-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker, '001');
  const taskDir = path.join(drive.worker, blueprint, 'tasks', '001');
  fs.writeFileSync(path.join(taskDir, 'verification.md'), 'verify\n');
  fs.writeFileSync(path.join(taskDir, 'review.md'), 'review\n');
  const out = assertNoWrite(drive, () => nextOf(drive, {
    task: '001',
    deps: {
      readEvidence: (filePath) => {
        // verification만 의도적 miss. 나머지 부재(report.md)도 null로 흡수해
        // 기본 seam과 같이 throw하지 않는다.
        if (filePath.endsWith(`${path.sep}verification.md`) || filePath.endsWith('/verification.md')) {
          return null;
        }
        try {
          const bytes = fs.readFileSync(filePath);
          return { sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
        } catch (error) {
          if (error && error.code === 'ENOENT') return null;
          throw error;
        }
      },
    },
  }));
  assert.strictEqual(out.ok, true);
  assert.strictEqual(out.action, 'record');
  assertJudgePayloadShape(out);
  assert.ok(!out.payload.evidence.some((e) => e.kind === 'verification'));
  assert.ok(out.payload.evidence.some((e) => e.kind === 'review'));
});

test('attachJudgeContext에 workerPath 밖 candidates가 있음 → 제외됨', () => {
  const workerPath = path.join(os.tmpdir(), 'bouncer-judge-worker');
  const outside = path.join(os.tmpdir(), 'bouncer-judge-outside.md');
  fs.mkdirSync(workerPath, { recursive: true });
  const inside = path.join(workerPath, 'review.md');
  fs.writeFileSync(inside, 'inside\n');
  fs.writeFileSync(outside, 'outside\n');
  const sha = crypto.createHash('sha256').update('inside\n').digest('hex');
  const result = attachJudgeContext({
    ok: true,
    scope: 'task',
    action: 'record',
    cwd: workerPath,
    judge: { kind: 'record-decision', fields: ['--decision'] },
    checkpoint: { ledger: { path: '.bouncer/runtime/coordinator.json', sha256: 'a'.repeat(64), revision: null } },
  }, {
    lastReport: { outcome: 'accepted', summary: 'ok', attempt: 1 },
    workerPath,
    candidates: [
      { kind: 'review', path: inside },
      { kind: 'report', path: outside },
    ],
    readEvidence: (filePath) => ({
      sha256: crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
    }),
  });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.payload.evidence, [
    { kind: 'review', path: inside, sha256: sha },
  ]);
});

test('judge payload에서 prepare integrate commit done → report와 evidence를 생략함', () => {
  function assertNoJudgeKeys(result, label) {
    const payload = result.payload || {};
    assert.strictEqual('report' in payload, false, `${label} report`);
    assert.strictEqual('evidence' in payload, false, `${label} evidence`);
    assert.strictEqual('previous_outcome' in payload, false, `${label} previous_outcome`);
  }

  const prepareBlueprint = '.bouncer/context/epics/088-n/blueprints/038-judge-prep';
  const repo = uncommittedPlanRepo('bouncer-next-judge-prep-', prepareBlueprint, [
    ['001', '  status: ready\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: prepareBlueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepareDrive = {
    repo, blueprint: prepareBlueprint, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
  const prepare = assertNoWrite(prepareDrive, () => nextOf(prepareDrive));
  assert.strictEqual(prepare.action, 'prepare');
  assertNoJudgeKeys(prepare, 'prepare');

  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: prepareBlueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  acceptDispatchReport(repo, prepareBlueprint, worker, '001');
  const recorded = coordinate({
    command: 'record', repoRoot: repo, blueprint: prepareBlueprint, cwd: worker, task: '001',
    decision: 'fixture record',
  });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  const integrate = assertNoWrite(prepareDrive, () => nextOf(prepareDrive));
  assert.strictEqual(integrate.action, 'integrate');
  assertNoJudgeKeys(integrate, 'integrate');

  const commitBlueprint = '.bouncer/context/epics/088-n/blueprints/039-judge-cmt';
  const commitDrive = preparedCommitDrive('bouncer-next-judge-cmt-', commitBlueprint);
  coordinate({
    command: 'dispatch', repoRoot: commitDrive.repo, blueprint: commitBlueprint,
    cwd: commitDrive.worker, task: '001',
  });
  commitInWorker(commitDrive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(commitDrive.worker, commitBlueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  const commit = assertNoWrite(commitDrive, () => nextOf(commitDrive, { task: '001' }));
  assert.strictEqual(commit.action, 'commit');
  assertNoJudgeKeys(commit, 'commit');

  const doneBlueprint = '.bouncer/context/epics/088-n/blueprints/041-judge-done';
  const doneDrive = preparedCommitDrive('bouncer-next-judge-done-', doneBlueprint);
  const ledger = loadLedger(doneDrive.ledgerFile);
  ledger.tasks[0].status = 'integrated';
  writeLedger(doneDrive.ledgerFile, ledger);
  const done = assertNoWrite(doneDrive, () => nextOf(doneDrive));
  assert.strictEqual(done.action, 'done');
  assertNoJudgeKeys(done, 'done');
});

test('card에서 readCard 실패 → checkpoint와 action 없이 coordinator-card-missing', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/030-card-miss';
  const drive = preparedCommitDrive('bouncer-next-card-miss-', blueprint);
  const asked = [];
  const r = assertNoWrite(drive, () => nextOf(drive, {
    task: '001',
    deps: {
      readCard: (id) => {
        asked.push(id);
        const error = new Error(`ENOENT: ${id}`);
        error.code = 'ENOENT';
        throw error;
      },
    },
  }));
  assert.deepStrictEqual(asked, ['dispatch']);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'coordinator-card-missing');
  assert.strictEqual(r.cause, NEXT_FAILURE_HINTS['coordinator-card-missing'].cause);
  assert.strictEqual(r.next, NEXT_FAILURE_HINTS['coordinator-card-missing'].next);
  assert.ok(!('checkpoint' in r) && !('action' in r) && !('card' in r));
});

test('card에서 card 없는 action → readCard를 호출하지 않음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/031-card-skip';
  const drive = preparedCommitDrive('bouncer-next-card-skip-', blueprint);
  const r = nextOf(drive, {
    deps: { readCard: (id) => assert.fail(`readCard called for ${id}`) },
  });
  assert.strictEqual(r.action, 'drive_tasks');
  assert.ok(!('card' in r));
});

test('card에서 주입된 readCard body → 그대로 반환됨', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/032-card-seam';
  const drive = preparedCommitDrive('bouncer-next-card-seam-', blueprint);
  const r = nextOf(drive, { task: '001', deps: { readCard: (id) => `card ${id}\n` } });
  assert.strictEqual(r.action, 'dispatch');
  assert.deepStrictEqual(r.card, { id: 'dispatch', body: 'card dispatch\n' });
});

test('card에서 CLI가 card 없음을 만남 → card를 출력하고 exit 1', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/033-card-cli';
  const drive = preparedCommitDrive('bouncer-next-card-cli-', blueprint);
  const ran = runArgv(drive.integrationPath, [
    'bouncer', 'coordinate', 'next', '--blueprint', blueprint, '--task', '001',
  ]);
  assert.strictEqual(ran.code, 0, ran.buf.err);
  const out = JSON.parse(ran.buf.out);
  assert.strictEqual(out.card.id, 'dispatch');
  assert.ok(out.card.body.length > 0);
});

test('card에서 directory 확인 → 정확히 card 아홉 개이고 index.md 없음', () => {
  const files = fs.readdirSync(CARD_DIR).sort();
  assert.deepStrictEqual(files, CARD_ACTIONS.map((id) => `${id}.md`).sort());
});

// 공통 규칙은 카드와 execute reference가 같은 정규식으로 맞아야 한다. 한쪽만
// 바뀌면 coordinator drive와 standalone execute가 다른 상한을 따르게 된다.
const EXEC_REF = (name) => fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'bouncer-run', 'references', `${name}.md`), 'utf8',
);
const cardOf = (id) => fs.readFileSync(path.join(CARD_DIR, `${id}.md`), 'utf8');
const SHARED_RULES = [
  {
    label: 'review ceilings discovery/fix/delta once each',
    re: /discovery[\s\S]{0,20}1[\s\S]{0,30}fix[\s\S]{0,20}1[\s\S]{0,30}delta[\s\S]{0,30}1/i,
    cards: ['review'], refs: ['review-round'],
  },
  {
    label: 'debugger cycle runs once',
    re: /re-verify\s+fails\s+again,\s+the\s+cycle\s+is\s+over[\s\S]{0,120}do\s+not\s+start\s+a\s+third\s+round/,
    cards: ['verify'], refs: ['verification-recovery'],
  },
  {
    label: 'stale Brief revision reports but never records',
    re: /stale[\s\S]{0,40}call\s+`coordinate report`\s+with\s+the\s+received[\s\S]{0,120}`stale-report`[\s\S]{0,40}(?:do not|never)[\s\S]{0,60}`coordinate record`/,
    cards: ['report', 'implement'], refs: ['agent-dispatch'],
  },
  {
    label: 'CLI perspectives order is the only fan-out',
    re: /walk(?:ing)?\s+the\s+CLI\s+`perspectives`\s+array\s+in\s+order/i,
    cards: ['review', 'final_review'], refs: ['agent-dispatch', 'review-round'],
  },
];

test('card에서 shared rules 대조 → card와 execute reference 둘 다와 일치함', () => {
  for (const rule of SHARED_RULES) {
    for (const id of rule.cards) assert.match(cardOf(id), rule.re, `${rule.label} card ${id}`);
    for (const ref of rule.refs) assert.match(EXEC_REF(ref), rule.re, `${rule.label} ref ${ref}`);
  }
});

// 기존 coordinator 문서 규칙 정규식(test/agents.test.js, test/coordinator.test.js)을
// 그대로 복사했다. 카드가 그 문단의 문장을 옮겼다면 아홉 카드 합본에서도 모두 맞는다.
// 카드 앞부분에도 attempt·Brief 같은 키가 이미 있어, 템플릿 순서는
// Print dispatch 섹션만 잘라서 잰다. 전체를 재면 기존 문단 순서가 실패한다.
function printDispatchSection(id) {
  const md = cardOf(id);
  const start = md.indexOf('## Print dispatch input');
  assert.ok(start >= 0, `${id} missing ## Print dispatch input`);
  const rest = md.slice(start);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

function assertIndexOrder(haystack, labels, id) {
  let prev = -1;
  for (const label of labels) {
    const at = haystack.indexOf(label);
    assert.ok(at >= 0, `${id} Print dispatch input missing ${label}`);
    assert.ok(at > prev, `${id} expected ${label} after prior template key`);
    prev = at;
  }
}

test('card에서 implement, review, final_review 출력 → dispatch input templates를 출력함', () => {
  for (const id of ['implement', 'review', 'final_review']) {
    const section = printDispatchSection(id);
    assert.match(section, /bouncer dispatch print/);
    assert.match(section, /--input/);
    assert.match(section, /do not read[^\n]*agents\//i);
  }
  assertIndexOrder(printDispatchSection('implement'), [
    'attempt', 'intent_bundle_id', 'intent_sections', 'Goal & intent', 'Brief revision',
  ], 'implement');
  for (const id of ['review', 'final_review']) {
    assertIndexOrder(printDispatchSection(id), [
      'Mode', 'Perspective', 'Target', 'Brief', 'Intent sections',
    ], id);
  }
  assert.match(printDispatchSection('final_review'), /Contract/);
});

test('card에서 review와 final_review --input → Red run이 Constraints 뒤에 놓이는 순서가 유지됨', () => {
  for (const id of ['review', 'final_review']) {
    assertIndexOrder(printDispatchSection(id), [
      'Mode', 'Perspective', 'Target', 'Brief', 'Intent sections', 'Constraints', 'Red run',
    ], id);
  }
});

test('card에서 cards를 이어 붙임 → coordinator document rule regexes를 만족함', () => {
  const md = cardBodies().join('\n');
  // test/agents.test.js — review-dispatch execute result
  assert.match(md, /bouncer review-dispatch execute|review-dispatch execute/);
  assert.match(md, /perspectives/);
  assert.match(md, /`combined`|combined/);
  assert.match(md, /`security`|security/);
  assert.match(
    md,
    /(?:do not|never|without)[\s\S]{0,140}(?:override|recompute|guess|덮어|재계산|추측)|(?:override|recompute|guess)[\s\S]{0,80}(?:do not|never)/i,
  );
  assert.match(md, /ok:\s*false|`ok`:\s*`false`|target[\s\S]{0,80}mismatch/i);
  assert.match(md, /--review-finding/);
  assert.match(md, /review_scope/);
  assert.match(md, /repair-wave-limit/);
  assert.match(md, /task_brief_hashes/);
  assert.match(md, /intent_bundles/);
  assert.match(md, /bouncer review record/);
  assert.match(md, /risk_flags[\s\S]{0,280}union of commit-task[\s\S]{0,40}`review_risk`/i);
  // test/agents.test.js — provenance inside the recorded decision
  assert.match(md, /provenance[\s\S]{0,120}inside[\s\S]{0,20}the decision/i);
  assert.doesNotMatch(md, /`bouncer coordinate record` its result SHA, actual paths/);
  // test/agents.test.js — attempt metadata and stale Brief revision
  assert.match(md, /coordinate dispatch/);
  assert.match(md, /\battempt\b/);
  assert.match(md, /task_brief_hash/);
  assert.match(md, /base_head/);
  assert.match(md, /initial_worktree_state/);
  assert.match(md, /previous_outcome/);
  assert.match(md, /previous_outcome[\s\S]{0,80}\{\s*outcome\s*,\s*summary\s*\}/);
  assert.match(md, /payload\.report/);
  assert.match(md, /payload\.evidence/);
  assert.match(
    md,
    /(?:before|immediately before)[\s\S]{0,120}(?:implementer|bouncer-implementer)|(?:implementer|bouncer-implementer)[\s\S]{0,80}(?:before|after)[\s\S]{0,40}dispatch|dispatch[\s\S]{0,120}(?:before|then)[\s\S]{0,80}(?:implementer|bouncer-implementer)/i,
  );
  assert.match(
    md,
    /(?:do not|never|freeze|frozen)[\s\S]{0,120}(?:revise|brief)|(?:revise|brief)[\s\S]{0,120}(?:after|until)[\s\S]{0,80}(?:report|outcome)/i,
  );
  assert.match(md, /coordinate report/);
  assert.match(md, /Brief revision/);
  assert.match(
    md,
    /(?:stale|mismatch)[\s\S]{0,240}coordinate report[\s\S]{0,160}(?:received|attempt|task_brief_hash)|coordinate report[\s\S]{0,160}(?:received|stale|mismatch)[\s\S]{0,120}(?:attempt|task_brief_hash|stale-report)/i,
  );
  assert.match(
    md,
    /(?:stale|mismatch)[\s\S]{0,200}(?:accepted|coordinate record)|(?:do not|never)[\s\S]{0,80}(?:accepted|coordinate record)[\s\S]{0,120}(?:stale|mismatch|Brief revision)/i,
  );
  assert.match(
    md,
    /(?:rework|scope_revision|task_change)[\s\S]{0,200}(?:previous_outcome|payload\.report|redispatch|re-?dispatch)/i,
  );
  // test/agents.test.js — Task round (heading assertion excluded)
  assert.doesNotMatch(md, /skills\/bouncer-execute\/SKILL\.md/);
  assert.match(md, /bouncer intent bundle/);
  assert.match(md, /bouncer intent sections/);
  assert.match(md, /intent_bundle_revision/);
  assert.match(md, /--gate execute/);
  assert.match(md, /never hand-write|do not write `## Command`/i);
  assert.match(md, /coordinate revise[\s\S]{0,240}bouncer intent bundle/);
  // test/coordinator.test.js — refuse review recording on strategy failure or target mismatch
  assert.match(md, /target[\s\S]{0,100}mismatch|mismatch[\s\S]{0,100}target|frozen[\s\S]{0,80}(?:base|head)/i);
  assert.match(
    md,
    /(?:do not|never|stop|halt|abort)[\s\S]{0,160}(?:accepted|review round|record)|(?:accepted|review round)[\s\S]{0,100}(?:do not|never|stop|halt|abort)/i,
  );
  assert.match(md, /risk_flags|perspectives/);
});

test('light ledger의 implement → payload.inline을 싣고 cwd는 integration', () => {
  const blueprint = '.bouncer/context/epics/089-n/blueprints/001-inline';
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-next-inline-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', 'README.md'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, blueprint, 'index.md'),
    '---\nbouncer:\n  status: approved\n  scale: light\n  review_scope: blueprint\n---\n# Blueprint\n',
  );
  fs.writeFileSync(
    path.join(repo, blueprint, 'review.md'),
    '---\nbouncer:\n  id: REVIEW-BP\n  status: pending\n  review:\n    required: true\n---\n# Review\n',
  );
  fs.writeFileSync(
    path.join(repo, blueprint, 'tasks/001/tasks.md'),
    '---\nbouncer:\n  status: ready\n  depends_on: []\n  parallel_safe: false\n  dependency_gate: integrated\n---\nbrief\n',
  );
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.mode, 'light');
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.strictEqual(prepared.tasks[0].workerPath, boot.integrationPath);
  const drive = {
    repo, blueprint, worker: boot.integrationPath,
    integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'implement');
  assert.strictEqual(r.cwd, boot.integrationPath);
  assert.strictEqual(r.payload.inline, true);
  assert.strictEqual(r.payload.attempt, 1);
});

test('full ledger의 implement → payload.inline을 생략함', () => {
  const blueprint = '.bouncer/context/epics/089-n/blueprints/002-full-inline';
  const drive = preparedCommitDrive('bouncer-next-full-inline-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'implement');
  assert.strictEqual('inline' in (r.payload || {}), false);
});

// ---- 세션 yield 판정 (BP 098/002) ----------------------------------------------------

const YIELD_BP = '.bouncer/context/epics/098-n/blueprints/002-yield';
const PAR_META = (leaf) => `  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - ${leaf}/\n`;

/**
 * bootstrap까지 끝낸 저장소에 coordinator 설정과 원장 decisions를 직접 심는다.
 * 세션 판정은 원장 decisions와 checkpoint.ready만 읽으므로 실제 wave를 돌리지 않는다.
 *
 * @param {Array<[string, string]>} tasks - [id, tasks.md frontmatter 본문]
 * @param {object} opts - config(coordinator 블록), decisions, integrated(이미 통합된 task id)
 * @returns {object} nextOf가 쓰는 drive 핸들
 */
function yieldDrive(tasks, { config, decisions = [], integrated = [] } = {}) {
  const repo = uncommittedPlanRepo('bouncer-next-yield-', YIELD_BP, tasks);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: YIELD_BP });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const drive = {
    repo, blueprint: YIELD_BP, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
  if (config !== undefined) {
    fs.writeFileSync(
      path.join(boot.integrationPath, '.bouncer/config.json'),
      `${JSON.stringify({ verify: '/bin/true', coordinator: config })}\n`,
    );
  }
  const ledger = loadLedger(drive.ledgerFile);
  ledger.decisions = decisions;
  for (const task of ledger.tasks) {
    if (integrated.includes(task.id)) task.status = 'integrated';
  }
  writeLedger(drive.ledgerFile, ledger);
  return drive;
}

const SESSION = { kind: 'session', opened_at: '2026-10-13T00:00:00.000Z', integration_head: 'h', waves_cap: 4 };
const FANIN = { kind: 'fanin', tasks: ['001'], base_head: 'a', candidate_head: 'b', evidence_id: null };
const REVOKE = { task: '001', kind: 'revoke', reason: 'r' };

test('waves_per_session 1 and a session with one fanin → yields session-wave-cap', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 1 }, decisions: [SESSION, FANIN],
  });
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'session-wave-cap');
});

test('auto, one fanin and no exception with one ready commit task → prepare', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 'auto' }, decisions: [SESSION, FANIN],
  });
  assert.strictEqual(nextOf(drive).action, 'prepare');
});

test('no waves_per_session setting and one fanin → prepare (auto)', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], { decisions: [SESSION, FANIN] });
  assert.strictEqual(nextOf(drive).action, 'prepare');
});

test('auto, one fanin and a revoke decision in the session window → yields wave-exception', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 'auto' }, decisions: [SESSION, REVOKE, FANIN],
  });
  const r = nextOf(drive);
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'wave-exception');
});

test('auto and an exception that preceded the previous fanin → prepare (only the last wave window counts)', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 'auto' }, decisions: [SESSION, REVOKE, FANIN, FANIN],
  });
  assert.strictEqual(nextOf(drive).action, 'prepare');
});

test('auto, one fanin and two parallel ready commit tasks → yields parallel-wave', () => {
  const drive = yieldDrive([['001', PAR_META('a')], ['002', PAR_META('b')]], {
    config: { waves_per_session: 'auto' }, decisions: [SESSION, FANIN],
  });
  const r = nextOf(drive);
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'parallel-wave');
});

test('auto and four fanins in the session → yields session-wave-cap', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 'auto' }, decisions: [SESSION, FANIN, FANIN, FANIN, FANIN],
  });
  const r = nextOf(drive);
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'session-wave-cap');
});

test('four fanins and only a verification node ready → prepare regardless of the cap', () => {
  const drive = yieldDrive([
    ['001', PAR_META('a')],
    ['002', '  execution_kind: verification\n  depends_on:\n    - "001"\n  parallel_safe: true\n  verify: "/bin/true"\n'],
  ], {
    config: { waves_per_session: 'auto' }, decisions: [SESSION, FANIN, FANIN, FANIN, FANIN],
    integrated: ['001'],
  });
  assert.strictEqual(nextOf(drive).action, 'prepare');
});

test('a session without any fanin → prepare', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 1 }, decisions: [SESSION],
  });
  assert.strictEqual(nextOf(drive).action, 'prepare');
});

test('fanins without any session decision and waves_per_session 1 → yields (counted from ledger start)', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 1 }, decisions: [FANIN],
  });
  const r = nextOf(drive);
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'session-wave-cap');
});

test('a fanin before the last session decision → is not counted in the new session', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 1 }, decisions: [FANIN, SESSION],
  });
  assert.strictEqual(nextOf(drive).action, 'prepare');
});

test('an invalid waves_per_session → next caps at 1 and prepare rejects with coordinator-config-invalid', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 'fast' }, decisions: [SESSION, FANIN],
  });
  const r = nextOf(drive);
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'session-wave-cap');
  const prepared = coordinate({
    command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integrationPath,
  });
  assert.strictEqual(prepared.ok, false);
  assert.strictEqual(prepared.reason, 'coordinator-config-invalid');
});
