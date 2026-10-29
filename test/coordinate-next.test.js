'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 설치된 plugin 캐시가 없는 환경(CI)에서도 이 checkout을 plugin root로 쓴다. 불일치 시나리오는 각 테스트가 직접 덮어쓴다.
process.env.BOUNCER_HOME ??= path.join(__dirname, '..');
const { execFileSync } = require('node:child_process');
const { runCli } = require('../packages/cli/dist/cli');
const { createGitTemplate } = require('./helpers/git-fixture');
const {
  coordinateNext, NEXT_FAILURE_HINTS, attachJudgeContext,
} = require('../packages/cli/dist/coordinate-next');
const { readDoc } = require('../packages/cli/dist/frontmatter');
const { renderDoc } = require('../packages/cli/dist/render');

const __coordinatorMod = require('../packages/cli/dist/coordinator');
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../packages/cli/dist/runtime-state');
const { coordinate } = require('./helpers/coordinator-fence');

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
  // accepted 보고는 report 시점에 Tests 절을 확인받는다. 이 fixture task는 verify를 선언하지 않아 기본 명령을 쓴다.
  parts.push('## Tests\n- `node --test` — pass (exit 0)');
  // 이탈 기록 규칙: fixture가 scope 밖에 커밋하는 파일의 이유 줄. scope 안이거나 커밋하지 않은 경로의 줄은 무시된다.
  parts.push(`## Unexpected paths\n- \`src/task-${task}.js\` — fixture 커밋 파일\n- \`README\` — fixture 커밋 파일`);
  if (open !== null) parts.push(`## Open choices\n${open}`);
  if (weak !== null) parts.push(`## Known weaknesses\n${weak}`);
  fs.writeFileSync(path.join(dir, `${task}-${attempt}.md`), `${parts.join('\n\n')}\n`);
}

/**
 * worker가 integration에 없는 커밋을 갖게 하고 `bouncer commit`이 찍는 stamp(HEAD 앞 8자)를
 * tasks.md에 쓴다. 이미 worker 커밋이 있으면 새로 만들지 않는다.
 * report(accepted)·record가 커밋 확정을 요구하므로 정상 순서(commit → report → record)를
 * 만드는 fixture 단계다. stamp는 task brief hash가 무시하는 `commit_sha`만 바꾼다.
 */
function commitAndStampWorker(repo, blueprint, worker, task = '001', { stamp = true } = {}) {
  const integrationPath = __coordinatorPathsFor({ repoRoot: repo, blueprint }).integrationPath;
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integrationPath, encoding: 'utf8' }).trim();
  let hasCommit = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', integrationHead], { cwd: worker, stdio: 'ignore' });
    hasCommit = false;
  } catch (_error) { /* 종료 코드 1 = HEAD가 integration 조상이 아님 = 이미 worker 커밋이 있음 */ }
  if (!hasCommit) {
    fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
    fs.writeFileSync(path.join(worker, `src/task-${task}.js`), `changed by ${task}\n`);
    execFileSync('git', ['add', `src/task-${task}.js`], { cwd: worker });
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', `feat: ${task}`],
      { cwd: worker });
  }
  if (!stamp) return;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  const file = path.join(worker, blueprint, 'tasks', task, 'tasks.md');
  const doc = readDoc(file);
  doc.data.bouncer.commit_sha = head.slice(0, 8);
  fs.writeFileSync(file, renderDoc(doc.data, doc.body));
}

function acceptDispatchReport(repo, blueprint, worker, task = '001') {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task,
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  commitAndStampWorker(repo, blueprint, worker, task);
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
  git(worker, ['commit', '-m', message, '-m', 'Bouncer-Task: fixture']);
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
    'verification-task-uses-blueprint-next', 'coordinator-card-missing', 'final-review-blocked',
    'worker-commit-stamp-mismatch', 'review-contract-invalid', 'worker-commit-untrailered',
  ];
  assert.deepStrictEqual(Object.keys(NEXT_FAILURE_HINTS).sort(), [...keys].sort());
  for (const key of keys) {
    assert.strictEqual(typeof NEXT_FAILURE_HINTS[key].cause, 'string');
    assert.strictEqual(typeof NEXT_FAILURE_HINTS[key].next, 'string');
  }
  assert.match(NEXT_FAILURE_HINTS['terminal-verification-failed'].next, /coordinate repair/);
  assert.match(NEXT_FAILURE_HINTS['terminal-verification-failed'].next, /coordinate reverify/);
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

test('blueprint next에서 detached → run-detached로 거절하고 원장을 쓰지 않음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/001-detached';
  const drive = preparedCommitDrive('bouncer-next-detached-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.status = 'detached';
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'run-detached');
  assert.strictEqual(typeof r.next, 'string');
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
  assert.match(r.next, /coordinate reverify/);
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
  const verificationPath = path.join(
    boot.integrationPath, blueprint, 'tasks', verify.id, 'verification.md',
  );
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  fs.writeFileSync(verificationPath, '# Verification\n\nterminal failure\n');
  const verificationSha = crypto.createHash('sha256')
    .update(fs.readFileSync(verificationPath)).digest('hex');
  const drive = { repo, blueprint, integrationPath: boot.integrationPath, ledgerFile };
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assertCardFor(r);
  assert.strictEqual(r.reason, 'terminal-verification-failed');
  assert.match(r.next, /coordinate repair/);
  assert.match(r.next, /coordinate reverify/);
  assert.deepStrictEqual(r.payload.evidence, [{
    kind: 'verification', path: verificationPath, sha256: verificationSha,
  }]);
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

test('light ledger with a terminal verification node → integrate first, prepare then verification_node only after the implementation is integrated', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/010-light-terminal';
  const drive = preparedCommitDrive('bouncer-next-light-terminal-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.mode = 'light';
  ledger.tasks.push({
    id: '002', depends_on: ['001'], execution_kind: 'verification', dependency_gate: 'integrated',
    parallel_safe: false, affected_paths: [], exclusive_resources: [], status: 'pending',
  });
  // 1. 구현이 recorded인 동안은 종단이 선행 조건 때문에 열릴 수 없고 integrate가 먼저다.
  ledger.tasks[0].status = 'recorded';
  ledger.tasks[0].sha = 'a'.repeat(40);
  writeLedger(drive.ledgerFile, ledger);
  assert.strictEqual(assertNoWrite(drive, () => nextOf(drive)).action, 'integrate');
  // 2. 구현이 integrated가 되면 종단 node를 ready로 올리는 prepare가 다음이다.
  ledger.tasks[0].status = 'integrated';
  writeLedger(drive.ledgerFile, ledger);
  const afterImpl = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(afterImpl.action, 'prepare');
  // 3. prepare가 종단을 ready로 올린 뒤에야 verification_node가 선택된다.
  ledger.tasks[1].status = 'ready';
  writeLedger(drive.ledgerFile, ledger);
  const node = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(node.action, 'verification_node');
  assert.strictEqual(node.task, '002');
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

test('blueprint next에서 discovery 없는 verified supplement → mode 없는 final_review', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/021-supp';
  const drive = supplementReviewDrive('bouncer-next-supp-v-', blueprint, [
    { kind: 'supplement', outcome: 'verified', paths: ['test/a.test.js'], findings: ['F1'] },
  ]);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.strictEqual(r.payload, undefined);
  assert.ok(!r.argv.includes('--mode'));
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

test('root review에 discovery round가 있고 accepted가 아님 → final-review-blocked이며 delta를 내지 않음', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/023-disc';
  const drive = supplementReviewDrive('bouncer-next-disc-', blueprint, []);
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'review.md'),
    '---\nbouncer:\n  status: requested\n  review:\n    rounds:\n      - round: 1\n        mode: discovery\n---\n# Review\n',
  );
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'final-review-blocked');
  assert.ok(r.cause && r.next);
  assert.strictEqual(r.argv, undefined);
});

test('root review에 discovery round가 있고 pending supplement → final-review-blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/025-disc-supp';
  const drive = supplementReviewDrive('bouncer-next-disc-supp-', blueprint, [
    { kind: 'supplement', outcome: 'pending', paths: ['test/a.test.js'], findings: ['F1'] },
  ]);
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'review.md'),
    '---\nbouncer:\n  status: requested\n  review:\n    rounds:\n      - round: 1\n        mode: discovery\n---\n# Review\n',
  );
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'final-review-blocked');
});

function briefReviewDrive(prefix, blueprint, modes, decisions, contract = 'brief') {
  const drive = supplementReviewDrive(prefix, blueprint, decisions);
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'index.md'),
    `---\nbouncer:\n  status: approved\n  review_scope: blueprint\n  review_contract: ${contract}\n---\n# Blueprint\n`,
  );
  const rounds = modes.map((mode, i) => `      - round: ${i + 1}\n        mode: ${mode}\n`).join('');
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'review.md'),
    `---\nbouncer:\n  status: requested\n  review:\n    rounds:\n${rounds}---\n# Review\n`,
  );
  return drive;
}

const REVIEW_REPAIR = { kind: 'repair', wave: 1, failure: { command: 'review' } };

test('brief contract with discovery only and a review repair decision → final_review with --mode delta', () => {
  const drive = briefReviewDrive('bouncer-next-brief-delta-', '.bouncer/context/epics/088-n/blueprints/030-b', ['discovery'], [REVIEW_REPAIR]);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.deepStrictEqual(r.argv.slice(-2), ['--mode', 'delta']);
  assert.strictEqual(r.judge.kind, 'review-round');
});

test('brief contract after the delta round and not accepted → final-review-blocked with the used-up guidance', () => {
  const drive = briefReviewDrive('bouncer-next-brief-used-', '.bouncer/context/epics/088-n/blueprints/031-b', ['discovery', 'delta'], [REVIEW_REPAIR]);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'final-review-blocked');
  assert.ok(r.next.includes('the one review repair and delta are used'));
});

test('brief contract with a review repair but the terminal task still pending → not final_review', () => {
  const drive = briefReviewDrive('bouncer-next-brief-pend-', '.bouncer/context/epics/088-n/blueprints/032-b', ['discovery'], [REVIEW_REPAIR]);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks[ledger.tasks.length - 1].status = 'pending';
  writeLedger(drive.ledgerFile, ledger);
  assert.notStrictEqual(assertNoWrite(drive, () => nextOf(drive)).action, 'final_review');
});

test('brief contract with a review repair and a failed terminal re-verification → not final_review', () => {
  const drive = briefReviewDrive('bouncer-next-brief-tfail-', '.bouncer/context/epics/088-n/blueprints/033-b', ['discovery'], [REVIEW_REPAIR]);
  const ledger = loadLedger(drive.ledgerFile);
  const last = ledger.tasks[ledger.tasks.length - 1];
  last.status = 'verifying';
  ledger.terminalFailure = { task: last.id, command: 'npm test', summary: 'fail', paths: [], exitCode: 1 };
  writeLedger(drive.ledgerFile, ledger);
  assert.notStrictEqual(assertNoWrite(drive, () => nextOf(drive)).action, 'final_review');
});

test('brief contract with discovery only and no review repair → final-review-blocked pointing at the one repair', () => {
  const drive = briefReviewDrive('bouncer-next-brief-none-', '.bouncer/context/epics/088-n/blueprints/034-b', ['discovery'], []);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'final-review-blocked');
  assert.ok(r.next.includes('coordinate repair'));
  assert.ok(r.next.includes('--review-finding'));
});

test('unknown review_contract with all integrated → blocked review-contract-invalid', () => {
  const drive = briefReviewDrive('bouncer-next-brief-bad-', '.bouncer/context/epics/088-n/blueprints/035-b', [], [], 'other');
  fs.rmSync(path.join(drive.integrationPath, '.bouncer/context/epics/088-n/blueprints/035-b/review.md'));
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'review-contract-invalid');
});

test('root review가 discovery 뒤 accepted → done', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/026-disc-ok';
  const drive = supplementReviewDrive('bouncer-next-disc-ok-', blueprint, []);
  fs.writeFileSync(
    path.join(drive.integrationPath, blueprint, 'review.md'),
    '---\nbouncer:\n  status: accepted\n  review:\n    rounds:\n      - round: 1\n        mode: discovery\n---\n# Review\n',
  );
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'done');
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

test('resumed DAG owner→downstream→terminal → next exposes fresh fences and generations in order', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/014-resume-order';
  const drive = preparedCommitDrive('bouncer-next-resume-order-', blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.tasks[0].lease = { id: 'owner-new', generation: 2, seq: 2, status: 'active' };
  ledger.tasks.push(
    { id: '002', execution_kind: 'commit', status: 'prepared', depends_on: ['001'], dependency_gate: 'integrated',
      workerPath: drive.worker, lease: { id: 'downstream-new', generation: 2, seq: 3, status: 'active' } },
    { id: '003', execution_kind: 'commit', status: 'prepared', depends_on: ['002'], dependency_gate: 'integrated',
      workerPath: drive.worker, lease: { id: 'leaf-new', generation: 2, seq: 4, status: 'active' } },
    { id: '004', execution_kind: 'verification', status: 'pending', depends_on: ['003'], dependency_gate: 'integrated' },
  );
  writeLedger(drive.ledgerFile, ledger);

  for (const [id, leaseId, generation] of [
    ['001', 'owner-new', '2'], ['002', 'downstream-new', '2'], ['003', 'leaf-new', '2'],
  ]) {
    const result = assertNoWrite(drive, () => nextOf(drive, { task: id }));
    assert.strictEqual(result.action, 'dispatch');
    assert.strictEqual(result.checkpoint.ledger.sha256,
      crypto.createHash('sha256').update(fs.readFileSync(drive.ledgerFile)).digest('hex'));
    const leaseAt = result.argv.indexOf('--lease-id');
    const taskAt = result.argv.indexOf('--task');
    const ledgerAt = result.argv.indexOf('--ledger-path');
    assert.ok(ledgerAt < taskAt && taskAt < leaseAt);
    assert.deepStrictEqual(result.argv.slice(leaseAt), ['--lease-id', leaseId, '--generation', generation]);
  }
  const afterLeaf = loadLedger(drive.ledgerFile);
  afterLeaf.tasks.slice(0, 3).forEach((item) => { item.status = 'integrated'; });
  afterLeaf.tasks[3].status = 'ready';
  writeLedger(drive.ledgerFile, afterLeaf);
  const terminal = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(terminal.action, 'verification_node');
  const taskAt = terminal.argv.indexOf('--task');
  const ledgerAt = terminal.argv.indexOf('--ledger-path');
  assert.ok(ledgerAt < taskAt);
  assert.strictEqual(terminal.argv[taskAt + 1], '004');
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
  const pluginRoot = makeFixturePluginRoot(true);
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
  try {
    withBouncerHome(pluginRoot, () => {
      const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
      assert.strictEqual(r.action, 'revise');
      assertCardFor(r);
      assert.strictEqual(r.judge.kind, 'scope-revision');
    });
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
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

// 트레일러 판별 테스트 공통 fixture: dispatch 뒤 verified/passed/accepted 번들과 빈 stamp.
function untraileredDrive(prefix, blueprint) {
  const drive = preparedCommitDrive(prefix, blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  return drive;
}

function acceptBundle(drive, blueprint) {
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
}

function writeRawWorkerCommit(worker, rel) {
  fs.mkdirSync(path.dirname(path.join(worker, rel)), { recursive: true });
  fs.writeFileSync(path.join(worker, rel), 'raw\n');
  git(worker, ['add', rel]);
}

test('task next에서 stamp 없고 트레일러 없는 worker 커밋 → worker-commit-untrailered blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/023-untr';
  const drive = untraileredDrive('bouncer-next-untr-', blueprint);
  writeRawWorkerCommit(drive.worker, 'src/a.js');
  git(drive.worker, ['commit', '-m', 'feat: raw']);
  acceptBundle(drive, blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'worker-commit-untrailered');
  assert.match(r.next, /coordinate uncommit/);
});

test('task next에서 트레일러 없는 커밋과 scope dirty가 함께 있음 → worker-commit-untrailered blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/024-untr';
  const drive = untraileredDrive('bouncer-next-untr-dirty-', blueprint);
  writeRawWorkerCommit(drive.worker, 'src/a.js');
  git(drive.worker, ['commit', '-m', 'feat: raw']);
  acceptBundle(drive, blueprint);
  giveTaskScope(drive, ['src/']);
  fs.writeFileSync(path.join(drive.worker, 'src/c.js'), 'dirty\n');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'worker-commit-untrailered');
});

test('task next에서 stamp 없고 모든 worker 커밋에 트레일러 있음 → commit', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/025-untr';
  const drive = untraileredDrive('bouncer-next-untr-ok-', blueprint);
  commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  acceptBundle(drive, blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'commit');
});

test('task next에서 다른 task ref 트레일러만 있는 worker 커밋 → worker-commit-untrailered blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/026-untr';
  const drive = untraileredDrive('bouncer-next-untr-other-', blueprint);
  writeRawWorkerCommit(drive.worker, 'src/a.js');
  git(drive.worker, ['commit', '-m', 'feat: x', '-m', 'Bouncer-Task: n-epic/cmt-bp/999']);
  acceptBundle(drive, blueprint);
  setDocStatus(drive.worker, blueprint, '001', 'tasks.md', 'verified', {
    epic_id: 'n-epic', blueprint_id: 'cmt-bp', id: 'TASKS-001',
  });
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'worker-commit-untrailered');
});

test('task next에서 원장 integrationHead가 없음 → 무트레일러 커밋이 있어도 commit', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/027-untr';
  const drive = untraileredDrive('bouncer-next-untr-nohead-', blueprint);
  writeRawWorkerCommit(drive.worker, 'src/a.js');
  git(drive.worker, ['commit', '-m', 'feat: raw']);
  acceptBundle(drive, blueprint);
  const ledger = loadLedger(drive.ledgerFile);
  delete ledger.integrationHead;
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'commit');
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

// 낡은 stamp / scope dirty는 report·record가 worker-commit-stamp-mismatch·worker-scope-dirty로 거절하며
// advance의 commit을 안내한다. next도 커밋할 scope 변경이 있으면 같은 commit을 골라야 어긋나지 않는다.
// fixture task는 affected_paths가 없어 scope가 비므로, 원장 task에 src/를 scope로 준다.
function giveTaskScope(drive, scopePaths) {
  const ledger = loadLedger(drive.ledgerFile);
  for (const item of ledger.tasks) item.affected_paths = scopePaths;
  writeLedger(drive.ledgerFile, ledger);
}

function stampedDriveWithStaleStamp(prefix, blueprint) {
  const drive = preparedCommitDrive(prefix, blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  git(drive.worker, ['add', '-A']);
  git(drive.worker, ['commit', '-m', 'evidence']);
  const head = git(drive.worker, ['rev-parse', 'HEAD']);
  setDocStatus(drive.worker, blueprint, '001', 'tasks.md', 'verified', { commit_sha: head.slice(0, 8) });
  // stamp를 남긴 뒤 다시 commit하면 HEAD가 바뀌어 stamp가 낡는다.
  commitInWorker(drive.worker, 'src/b.js', 'b\n', 'feat: b');
  giveTaskScope(drive, ['src/']);
  return drive;
}

test('task next에서 낡은 stamp이고 scope 파일이 dirty → commit', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/041-stale-dirty';
  const drive = stampedDriveWithStaleStamp('bouncer-next-stale-dirty-', blueprint);
  fs.writeFileSync(path.join(drive.worker, 'src/c.js'), 'c\n');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'commit');
  assert.ok(r.argv.includes('commit'));
  assert.ok(r.argv.includes('--yes'));
});

test('task next에서 stamp 일치하고 scope 파일이 dirty → commit', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/042-match-dirty';
  const drive = preparedCommitDrive('bouncer-next-match-dirty-', blueprint);
  coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  commitInWorker(drive.worker, 'src/a.js', 'a\n', 'feat: a');
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
  });
  git(drive.worker, ['add', '-A']);
  git(drive.worker, ['commit', '-m', 'evidence']);
  const head = git(drive.worker, ['rev-parse', 'HEAD']);
  setDocStatus(drive.worker, blueprint, '001', 'tasks.md', 'verified', { commit_sha: head.slice(0, 8) });
  giveTaskScope(drive, ['src/']);
  fs.writeFileSync(path.join(drive.worker, 'src/a.js'), 'a changed\n');
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'commit');
});

test('task next에서 낡은 stamp이고 tree가 깨끗 → worker-commit-stamp-mismatch blocked', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/043-stale-clean';
  const drive = stampedDriveWithStaleStamp('bouncer-next-stale-clean-', blueprint);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'blocked');
  assert.strictEqual(r.reason, 'worker-commit-stamp-mismatch');
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
  commitAndStampWorker(drive.repo, blueprint, drive.worker);
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

/** rework 보고 뒤 attempt 2를 다시 dispatch한 drive를 만든다. 기준(HEAD·porcelain)은 dispatch 직후와 같다. */
function reworkRedispatchedDrive(prefix, blueprint) {
  const drive = preparedCommitDrive(prefix, blueprint);
  const first = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  writeWorkerReport(drive.worker, '001', first.metadata.attempt, first.metadata.task_brief_hash);
  coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: first.metadata.attempt, taskBriefHash: first.metadata.task_brief_hash,
    outcome: 'rework', summary: 'needs another pass',
  });
  const second = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  return { drive, second };
}

test('rework 뒤 재dispatch에서 현재 attempt 보고가 있고 기준이 같음 → implement가 아닌 verify', () => {
  const blueprint = '.bouncer/context/epics/114-n/blueprints/001-report-skip-imp';
  const { drive, second } = reworkRedispatchedDrive('bouncer-next-report-skip-', blueprint);
  assert.strictEqual(second.metadata.attempt, 2);
  writeWorkerReport(drive.worker, '001', 2, second.metadata.task_brief_hash);
  const out = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.notStrictEqual(out.action, 'implement');
  assert.strictEqual(out.action, 'verify');
});

test('rework 뒤 재dispatch에서 보고 파일이 attempt 1 번호임 → implement를 유지함', () => {
  const blueprint = '.bouncer/context/epics/114-n/blueprints/002-report-stale-imp';
  const { drive, second } = reworkRedispatchedDrive('bouncer-next-report-stale-', blueprint);
  // <task>-2.md 안의 attempt 줄이 1이면 이전 attempt의 잔재라서 건너뛰면 안 된다.
  writeWorkerReport(drive.worker, '001', 2, second.metadata.task_brief_hash, {
    revision: `attempt: 1\ntask_brief_hash: ${second.metadata.task_brief_hash}`,
  });
  const out = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(out.action, 'implement');
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

// dispatch 밖의 phase 규칙(review 상한·debugger 1회)은 카드가 실행 입력이라 카드와
// run-owned reference(skills/bouncer-run/references)가 같은 정규식으로 맞아야 한다.
const RUN_REF = (name) => fs.readFileSync(
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
];

test('card에서 shared rules 대조 → card와 run reference 둘 다와 일치함', () => {
  for (const rule of SHARED_RULES) {
    for (const id of rule.cards) assert.match(cardOf(id), rule.re, `${rule.label} card ${id}`);
    for (const ref of rule.refs) assert.match(RUN_REF(ref), rule.re, `${rule.label} ref ${ref}`);
  }
});

// payload·metadata·fallback·모델·토큰 기록은 agent-dispatch 한 곳만 소유한다. 카드에 같은
// 본문이 다시 생기면 두 정본이 어긋나도 테스트가 모르므로, 정본 본문과 카드 링크·부재를
// 따로 본다(카드와 정본을 이어 붙여 존재만 보면 어느 쪽이 소유하는지 잃는다).
const DISPATCH_CANON = [
  {
    label: 'stale Brief revision reports but never records',
    re: /stale[\s\S]{0,200}call\s+`coordinate report`\s+with\s+the\s+received[\s\S]{0,120}`stale-report`[\s\S]{0,40}(?:do not|never)[\s\S]{0,60}`coordinate record`/,
  },
  {
    label: 'CLI perspectives order is the only fan-out',
    re: /walk(?:ing)?\s+the\s+CLI\s+`perspectives`\s+array\s+in\s+order/i,
  },
  {
    label: 'implementer model rejection stops without retry and reports correction details',
    re: /host\s+rejects\s+it,\s+stop\s+without\s+retry\s+or\s+fallback\s+and\s+report\s+provider,\s+role,\s+configured\s+model,\s+exact\s+host\s+reason,\s+and\s+config\s+correction\s+location/i,
  },
  {
    label: 'report_path stays outside metadata',
    re: /`report_path`[\s\S]{0,260}not\s+one\s+of\s+the\s+`metadata`\s+keys/,
  },
  {
    label: 'brief frozen while the attempt is active',
    re: /attempt\s+is\s+active\s+the\s+brief\s+stays\s+frozen/,
  },
  {
    label: 'missing worker tokens are never estimated',
    re: /worker-tokens[\s\S]{0,300}counted\s+as\s+missing,\s+never\s+estimated/,
  },
  {
    label: 'unreported tokens are recorded, never left out',
    re: /record\s+`--tokens\s+unreported`\s+for\s+that\s+key\s+instead/,
  },
  {
    label: 'record and advance refuse missing worker tokens',
    re: /refuse\s+with\s+`worker-tokens-missing`\s+while\s+a\s+finished\s+worker\s+key/,
  },
  {
    label: 'records run from the integration cwd, worker keeps task or light cwd',
    re: /from\s+the\s+integration\s+cwd[\s\S]{0,200}task\s+worktree\s+on\s+a\s+full\s+ledger,\s+the\s+integration\s+path\s+on\s+a\s+light\s+ledger/,
  },
];
// 카드 본문에 다시 들어오면 안 되는 정본 고유 문장. 정본 정규식 일부를 재사용한다.
const DISPATCH_CANON_ONLY = [
  /`coordinate dispatch` also returns a top-level `report_path`/,
  /worker-tokens --blueprint/,
  /entire\s+body\s+of/,
  /counted\s+as\s+missing/,
  /call\s+`coordinate report`\s+with\s+the\s+received/,
  /walk(?:ing)?\s+the\s+CLI\s+`perspectives`\s+array/,
  /intent bundle --task <path> --symbol/,
];
const DISPATCH_LINK = '../../skills/bouncer-run/references/agent-dispatch.md';
const DISPATCH_CARDS = ['dispatch', 'implement', 'verify', 'review', 'final_review', 'report', 'record'];

test('agent-dispatch 정본 → payload·metadata·fallback·모델·토큰 규칙 본문을 모두 가짐', () => {
  const canon = RUN_REF('agent-dispatch');
  for (const rule of DISPATCH_CANON) assert.match(canon, rule.re, rule.label);
});

// rules/cli.md는 worker-tokens 명령 목록·synopsis·advance 정지 목록을 함께 소유한다. 세 곳이 같은
// 계약(unreported 기록, worker-tokens-missing 검사 범위)을 말해야 CLI 거절과 문서가 어긋나지 않는다.
// 줄바꿈이 있는 synopsis를 공백 하나로 접어서 비교한다.
test('cli rules → name worker-tokens-missing', () => {
  const cli = fs.readFileSync(path.join(__dirname, '..', 'rules', 'cli.md'), 'utf8').replace(/\s+/g, ' ');
  const sentences = [
    'Before running any action, `coordinate advance` refuses with `worker-tokens-missing` '
      + '(exit 1, no `executed`) while a checked worker key has no token record.',
    'A `worker-tokens --tokens unreported` record appends '
      + '`{kind: worker-tokens, role, unreported: true, task?, perspective?}`.',
    'The `worker-tokens-missing` check covers these keys: `coordinate record --task <T>` checks the keys of task T, '
      + '`coordinate advance --task <T>` checks the keys of task T and the keys with no task, '
      + 'and `coordinate advance` without `--task` checks only the keys with no task.',
    '`coordinate worker-tokens --blueprint <dir> --role <implementer|reviewer|debugger> --tokens <n|unreported> '
      + '--ledger-path <p> --ledger-hash <h> [--task <ddd>] [--perspective <name>]`',
  ];
  for (const sentence of sentences) assert.ok(cli.includes(sentence), sentence);
  assert.ok(cli.includes('|worker-model|worker-tokens|note|'), 'coordinate command list names worker-tokens');
});

test('dispatch 공통 규칙을 쓰는 카드 → 실재하는 agent-dispatch 링크만 두고 정본 본문을 복제하지 않음', () => {
  for (const id of DISPATCH_CARDS) {
    const md = cardOf(id);
    assert.ok(md.includes(`](${DISPATCH_LINK})`), `${id} card must link agent-dispatch`);
    assert.ok(fs.existsSync(path.resolve(CARD_DIR, DISPATCH_LINK)), `${id} link target must exist`);
    for (const re of DISPATCH_CANON_ONLY) assert.doesNotMatch(md, re, `${id} card restates canon ${re}`);
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
  assert.match(md, /review_scope/);
  assert.match(md, /ok:\s*false|`ok`:\s*`false`|target[\s\S]{0,80}mismatch/i);
  assert.match(md, /--review-finding/);
  assert.match(md, /repair-wave-limit/);
  assert.match(md, /task_brief_hashes/);
  assert.match(md, /intent_bundles/);
  assert.match(md, /bouncer review record/);
  assert.match(md, /risk_flags[\s\S]{0,280}union of commit-task[\s\S]{0,40}`review_risk`/i);
  // test/agents.test.js — provenance inside the recorded decision
  assert.match(md, /provenance[\s\S]{0,120}inside[\s\S]{0,20}the decision/i);
  assert.doesNotMatch(md, /`bouncer coordinate record` its result SHA, actual paths/);
  // 단계 입력: dispatch·report 단계가 넘기고 판단하는 값
  assert.match(md, /coordinate dispatch/);
  assert.match(md, /\battempt\b/);
  assert.match(md, /task_brief_hash/);
  assert.match(md, /base_head/);
  assert.match(md, /initial_worktree_state/);
  assert.match(md, /previous_outcome/);
  assert.match(md, /payload\.report/);
  assert.match(md, /payload\.evidence/);
  assert.match(md, /report_path/);
  assert.match(md, /coordinate report/);
  assert.match(md, /Brief revision/);
  assert.match(
    md,
    /(?:rework|scope_revision|task_change)[\s\S]{0,200}(?:previous_outcome|payload\.report|redispatch|re-?dispatch)/i,
  );
  // test/agents.test.js — Task round (heading assertion excluded)
  assert.doesNotMatch(md, /skills\/bouncer-execute\/SKILL\.md/);
  assert.match(md, /bouncer intent bundle/);
  assert.match(md, /--gate execute/);
  assert.match(md, /never hand-write|do not write `## Command`/i);
  // test/coordinator.test.js — refuse review recording on strategy failure or target mismatch
  assert.match(md, /target[\s\S]{0,100}mismatch|mismatch[\s\S]{0,100}target|frozen[\s\S]{0,80}(?:base|head)/i);
  assert.match(
    md,
    /(?:do not|never|stop|halt|abort)[\s\S]{0,160}(?:accepted|review round|record)|(?:accepted|review round)[\s\S]{0,100}(?:do not|never|stop|halt|abort)/i,
  );
  assert.match(md, /risk_flags|perspectives/);
});

// 카드에서 빠진 attempt metadata·stale·intent bundle 규칙은 agent-dispatch 정본에서 본다.
test('agent-dispatch 정본 → attempt metadata·stale Brief revision·intent bundle 규칙을 만족함', () => {
  const md = RUN_REF('agent-dispatch');
  assert.match(md, /`combined`|combined/);
  assert.match(md, /`security`|security/);
  assert.match(
    md,
    /(?:do not|never|without)[\s\S]{0,140}(?:override|recompute|guess)|(?:override|recompute|guess)[\s\S]{0,80}(?:do not|never)/i,
  );
  assert.match(md, /previous_outcome[\s\S]{0,80}\{\s*outcome\s*,\s*summary\s*\}/);
  assert.match(md, /initial_worktree_state/);
  assert.match(md, /base_head/);
  assert.match(
    md,
    /(?:before|immediately before)[\s\S]{0,120}(?:implementer|bouncer-implementer)/i,
  );
  assert.match(
    md,
    /(?:stale|mismatch)[\s\S]{0,240}coordinate report[\s\S]{0,160}(?:received|attempt|task_brief_hash)/i,
  );
  assert.match(md, /(?:stale|mismatch)[\s\S]{0,200}(?:accepted|coordinate record)/i);
  assert.match(md, /bouncer intent bundle/);
  assert.match(md, /bouncer intent sections/);
  assert.match(md, /intent_bundle_revision/);
  assert.match(md, /coordinate revise[\s\S]{0,240}bouncer intent bundle/);
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

test('implement payload with promoted_from.patch → carries promoted_patch', () => {
  const blueprint = '.bouncer/context/epics/107-promoted/blueprints/001-patch';
  const drive = preparedCommitDrive('bouncer-next-promoted-patch-', blueprint);
  const dispatched = coordinate({ command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001' });
  assert.strictEqual(dispatched.ok, true);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.promoted_from = { archive: '/archive', patch: '/saved.patch', diff_sha: 'a'.repeat(64), reason: 'task-split', task: '001' };
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'implement');
  assert.strictEqual(r.payload.promoted_patch, '/saved.patch');
});

test('implement payload with promoted_from.patch null → omits promoted_patch', () => {
  const blueprint = '.bouncer/context/epics/107-promoted/blueprints/002-no-patch';
  const drive = preparedCommitDrive('bouncer-next-promoted-no-patch-', blueprint);
  const dispatched = coordinate({ command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001' });
  assert.strictEqual(dispatched.ok, true);
  const ledger = loadLedger(drive.ledgerFile);
  ledger.promoted_from = { archive: '/archive', patch: null, diff_sha: 'a'.repeat(64), reason: 'task-split', task: '001' };
  writeLedger(drive.ledgerFile, ledger);
  const r = assertNoWrite(drive, () => nextOf(drive, { task: '001' }));
  assert.strictEqual(r.action, 'implement');
  assert.strictEqual('promoted_patch' in r.payload, false);
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

test('an invalid waves_per_session → next caps at 1 and yields session-wave-cap', () => {
  const drive = yieldDrive([['001', PAR_META('a')]], {
    config: { waves_per_session: 'fast' }, decisions: [SESSION, FANIN],
  });
  const r = nextOf(drive);
  assert.strictEqual(r.action, 'yield');
  assert.strictEqual(r.reason, 'session-wave-cap');
});

/**
 * 001이 integrated이고 terminal 002가 `verifying`인 상태에 terminalFailure를 시드한다.
 * `mutate`로 분류·identity를 바꿔 next가 어떤 조합에서 진행하는지 관찰한다.
 */
function classifiedTerminalDrive(prefix, mutate = () => {}, { review = false } = {}) {
  const blueprint = '.bouncer/context/epics/108-n/blueprints/001-outside';
  const repo = uncommittedPlanRepo(prefix, blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: false\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  verify: "/bin/true"\n'],
  ]);
  if (review) writeReviewScope(repo, blueprint);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = loadLedger(ledgerFile);
  const head = git(boot.integrationPath, ['rev-parse', 'HEAD']);
  ledger.integrationHead = head;
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[1].status = 'verifying';
  ledger.terminalFailure = {
    task: '002', command: '/bin/true', summary: 'exit code 1', paths: [], exitCode: 1, repairWave: 0,
    evidence_id: 'e'.repeat(64), source_digest: head,
    disposition: {
      kind: 'outside_scope', reason: 'cause is outside every task scope', evidence_id: 'e'.repeat(64),
      source_digest: head, paths: ['vendor/lock.json'],
    },
  };
  mutate(ledger);
  writeLedger(ledgerFile, ledger);
  return { repo, blueprint, integrationPath: boot.integrationPath, ledgerFile, head };
}

test('blueprint next with a proven outside_scope terminal failure → done carrying the failure, not blocked', () => {
  const drive = classifiedTerminalDrive('bouncer-next-outside-done-');
  const before = loadLedger(drive.ledgerFile);
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'done');
  assert.strictEqual(r.payload.outside_scope.kind, 'outside_scope');
  assert.strictEqual(r.payload.failed_task, '002');
  // 성공으로 바꾸지 않는다 — terminal은 verifying, 실패 사실은 그대로다.
  assert.strictEqual(before.tasks[1].status, 'verifying');
  assert.strictEqual(before.terminalFailure.exitCode, 1);
});

test('blueprint next with a proven outside_scope failure in blueprint review mode → final_review before done', () => {
  const drive = classifiedTerminalDrive('bouncer-next-outside-review-', () => {}, { review: true });
  const r = assertNoWrite(drive, () => nextOf(drive));
  assert.strictEqual(r.action, 'final_review');
  assert.strictEqual(r.payload.outside_scope.reason, 'cause is outside every task scope');
});

test('blueprint next with an unclassified, stale, mismatched or incomplete outside_scope failure → stays blocked', () => {
  const cases = [
    ['no classification (legacy failure)', (l) => { delete l.terminalFailure.disposition; }],
    ['source moved after the classification', (l) => { l.integrationHead = 'a'.repeat(40); }],
    ['classification bound to another evidence', (l) => { l.terminalFailure.disposition.evidence_id = 'd'.repeat(64); }],
    ['classification bound to another source', (l) => { l.terminalFailure.disposition.source_digest = 'b'.repeat(40); }],
    ['failure without recorded identity', (l) => {
      delete l.terminalFailure.evidence_id; delete l.terminalFailure.disposition.evidence_id;
    }],
    ['classification without paths', (l) => { l.terminalFailure.disposition.paths = []; }],
    ['classification without a reason', (l) => { l.terminalFailure.disposition.reason = ' '; }],
    // 다른 task의 실패 기록이면 002에는 실패 기록이 없는 verifying이라 검증 재실행이 맞다. 어느 쪽이든 완료가 아니다.
    ['failure of another task', (l) => { l.terminalFailure.task = '001'; }, 'verification_node'],
  ];
  for (const [label, mutate, expected = 'blocked'] of cases) {
    const drive = classifiedTerminalDrive('bouncer-next-outside-bad-', mutate);
    const r = assertNoWrite(drive, () => nextOf(drive));
    assert.strictEqual(r.action, expected, label);
    assert.notStrictEqual(r.action, 'done', label);
  }
});

/**
 * `readCandidate`를 통과하는 임시 플러그인 루트. `dispatch` 카드 본문은 FIXTURE-CARD다.
 *
 * @returns {string} 임시 플러그인 루트
 */
function makeFixturePluginRoot(copyCurrentCards = false) {
  const pluginRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-card-asset-root-')));
  for (const dir of ['agents', 'skills', 'rules', 'hooks', 'scripts']) {
    fs.mkdirSync(path.join(pluginRoot, dir));
  }
  fs.mkdirSync(path.join(pluginRoot, 'references', 'coordinator-cards'), { recursive: true });
  if (copyCurrentCards) {
    for (const id of CARD_ACTIONS) {
      fs.copyFileSync(
        path.join(CARD_DIR, `${id}.md`),
        path.join(pluginRoot, 'references', 'coordinator-cards', `${id}.md`),
      );
    }
  } else {
    fs.writeFileSync(path.join(pluginRoot, 'references', 'coordinator-cards', 'dispatch.md'), 'FIXTURE-CARD');
  }
  fs.writeFileSync(path.join(pluginRoot, 'AGENTS.md'), '# fixture\n');
  fs.writeFileSync(path.join(pluginRoot, 'scripts', 'bouncer'), '');
  fs.writeFileSync(path.join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: require('../packages/cli/package.json').version }));
  return pluginRoot;
}

/**
 * 테스트 동안만 BOUNCER_HOME을 바꾸고 끝나면 원래 값으로 되돌린다.
 *
 * @param {string} value - BOUNCER_HOME 값
 * @param {() => void} fn - 본문
 */
function withBouncerHome(value, fn) {
  const saved = process.env.BOUNCER_HOME;
  process.env.BOUNCER_HOME = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env.BOUNCER_HOME;
    else process.env.BOUNCER_HOME = saved;
  }
}

test('task next dispatch with a valid BOUNCER_HOME → default readCard serves that root card body', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/014-disp-fixture';
  const drive = preparedCommitDrive('bouncer-next-card-root-', blueprint);
  const pluginRoot = makeFixturePluginRoot();
  try {
    withBouncerHome(pluginRoot, () => {
      const r = nextOf(drive, { task: '001' });
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.action, 'dispatch');
      assert.strictEqual(r.card.body, 'FIXTURE-CARD');
    });
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});

test('task next dispatch with an invalid BOUNCER_HOME → is coordinator-card-missing', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/014-disp-invalid';
  const drive = preparedCommitDrive('bouncer-next-card-bad-', blueprint);
  withBouncerHome(path.join(drive.repo, 'does-not-exist'), () => {
    const r = nextOf(drive, { task: '001' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'coordinator-card-missing');
  });
});

test('task next dispatch with a plugin version mismatch → keeps card-missing reason and recovery details', () => {
  const blueprint = '.bouncer/context/epics/088-n/blueprints/014-disp-mismatch';
  const drive = preparedCommitDrive('bouncer-next-card-mismatch-', blueprint);
  const pluginRoot = makeFixturePluginRoot();
  fs.writeFileSync(path.join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'bouncer', version: '1.5.0' }));
  try {
    withBouncerHome(pluginRoot, () => {
      const result = nextOf(drive, { task: '001' });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.reason, 'coordinator-card-missing');
      assert.match(result.cause, /1\.5\.0/);
      assert.match(result.cause, new RegExp(require('../packages/cli/package.json').version.replaceAll('.', '\\.')));
      assert.match(result.next, /compatible npm runtime version/);
    });
  } finally {
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
});
