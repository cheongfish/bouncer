// test/run-detach.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent, readCurrent } = require('../scripts/lib/current');
const coordinatorMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor, runtimePaths } = require('../scripts/lib/runtime-state');
const { evaluateStaged } = require('../scripts/lib/commit-hook');
const { coordinatorContext, reviseTaskScope } = require('../scripts/lib/scope');
const { detachRun } = require('../scripts/lib/run-detach');
const { createGitTemplate } = require('./helpers/git-fixture');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';
const LEDGER_REL = '.bouncer/runtime/coordinator.json';

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

// 계획 문서까지 커밋한 저장소를 한 번만 만들고 테스트마다 복사한다.
// worktree는 절대 경로를 담으므로 복사 뒤 각 테스트가 bootstrap으로 만든다.
const planTemplate = createGitTemplate((repo) => {
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  for (const rel of ['src/auth/login.ts', 'src/session/token.ts']) {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), 'x\n');
  }
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
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
});
test.after(() => planTemplate.dispose());

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fenceFor(repo) {
  const { ledgerFile } = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  return { ledgerPath: LEDGER_REL, ledgerHash: sha(ledgerFile) };
}

function readLedgerFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function patchLedger(file, patch) {
  const ledger = readLedgerFile(file);
  patch(ledger);
  fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`);
}

/**
 * bootstrap까지 끝난 drive. `integrated`가 true면 task를 모두 integrated로 바꿔 병합 뒤 상태를 만든다.
 * 포인터는 이 blueprint(001/001)와, 지워지면 안 되는 다른 blueprint(001/002) 두 개를 둔다.
 */
function drive({ integrated = true } = {}) {
  const repo = planTemplate.copy();
  const boot = coordinatorMod.coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const { ledgerFile } = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  if (integrated) {
    patchLedger(ledgerFile, (ledger) => {
      for (const item of ledger.tasks) item.status = 'integrated';
    });
  }
  writeCurrent({
    repoRoot: repo, blueprint: BP_REL, base: 'work', task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const { pointersRoot } = runtimePaths({ repoRoot: repo });
  const ownKey = path.join(pointersRoot, '001', '001.json');
  const otherKey = path.join(pointersRoot, '001', '002.json');
  return {
    repo, ledgerFile, otherKey, ownKey, integration: boot.integrationPath,
    // 두 key가 함께 있으면 readCurrent가 모호하다고 거절하므로, 필요한 테스트만 나중에 추가한다.
    addOtherKey: () => fs.writeFileSync(otherKey, `${JSON.stringify({
      blueprint: '.bouncer/context/epics/001-auth/blueprints/002-other', base: 'work',
    }, null, 2)}\n`),
  };
}

function stageDoc(repo, rel = 'docs/note.md') {
  fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
  fs.writeFileSync(path.join(repo, rel), 'note\n');
  execFileSync('git', ['add', rel], { cwd: repo });
}

function detachArgs(repo, extra = ['--yes']) {
  return ['run', 'detach', '--blueprint', BP_REL, '--repo', repo, ...extra];
}

test('merged drive with a live ledger → main commit is blocked, then allowed after run detach', () => {
  const { repo, ledgerFile, ownKey, otherKey, addOtherKey } = drive();
  stageDoc(repo);
  const before = evaluateStaged({ repoRoot: repo });
  assert.strictEqual(before.block, true);
  assert.match(before.reason, /main-worktree-source-write/);
  addOtherKey();
  const decisionsBefore = readLedgerFile(ledgerFile).decisions;

  const result = capture(detachArgs(repo, ['--yes', '--reason', 'merged to develop']));

  assert.strictEqual(result.code, 0, result.out + result.err);
  const payload = JSON.parse(result.out);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.pointer_removed, true);
  assert.strictEqual(typeof payload.next, 'string');
  // ledger는 남고 status만 detached, decision은 정확히 하나 늘며 기존 항목은 그대로다.
  const after = readLedgerFile(ledgerFile);
  assert.strictEqual(after.status, 'detached');
  assert.strictEqual(after.decisions.length, decisionsBefore.length + 1);
  assert.deepStrictEqual(after.decisions.slice(0, decisionsBefore.length), decisionsBefore);
  const decision = after.decisions[after.decisions.length - 1];
  assert.strictEqual(decision.kind, 'detached');
  assert.strictEqual(decision.reason, 'merged to develop');
  assert.strictEqual(decision.previous_status, 'active');
  assert.match(decision.main_head, /^[0-9a-f]{40}$/);
  assert.match(decision.integration_head, /^[0-9a-f]{40}$/);
  assert.ok(!Number.isNaN(Date.parse(decision.at)));
  // 이 blueprint의 key만 지워지고 다른 key는 남는다.
  assert.strictEqual(fs.existsSync(ownKey), false);
  assert.strictEqual(fs.existsSync(otherKey), true);
  // 같은 staged 판정이 이제 허용된다. 지우지 않은 다른 key는 이 판정과 무관하므로 치우고 본다.
  fs.rmSync(otherKey);
  assert.deepStrictEqual(evaluateStaged({ repoRoot: repo }), { block: false });
});

test('detached ledger with the pointer set again for finalize → main coordinator context stays inactive', () => {
  const { repo } = drive();
  assert.strictEqual(capture(detachArgs(repo)).code, 0);
  writeCurrent({
    repoRoot: repo, blueprint: BP_REL, base: 'work', task: `${BP_REL}/tasks/001/tasks.md`,
  });
  assert.ok(readCurrent({ repoRoot: repo }));
  // task 범위 안의 파일이면 포인터가 다시 서 있어도 원장 때문에 막히지 않아야 한다.
  stageDoc(repo, 'src/auth/new.ts');

  const context = coordinatorContext({ repoRoot: repo, blueprint: BP_REL });

  assert.strictEqual(context.active, false);
  assert.strictEqual(context.reason, 'run-detached');
  assert.deepStrictEqual(evaluateStaged({ repoRoot: repo }), { block: false });
});

test('main commit refusal with every commit task integrated → next points to run detach', () => {
  const { repo } = drive({ integrated: true });
  stageDoc(repo);
  const verdict = evaluateStaged({ repoRoot: repo });
  assert.strictEqual(verdict.block, true);
  assert.match(verdict.reason, /next: .*bouncer run detach --blueprint \S+ --yes/);
});

test('main commit refusal with an unfinished task → next points to the run, not detach', () => {
  const { repo } = drive({ integrated: false });
  stageDoc(repo);
  const verdict = evaluateStaged({ repoRoot: repo });
  assert.strictEqual(verdict.block, true);
  assert.match(verdict.reason, /main-worktree-source-write/);
  assert.match(verdict.reason, /next: .*\/bouncer-run/);
  assert.ok(!/run detach/.test(verdict.reason));
});

test('detach refusals → leave the ledger and every pointer file byte-identical', () => {
  const cases = [
    {
      name: 'missing --yes',
      args: (repo) => detachArgs(repo, []),
      setup: () => {},
      reason: 'detach-confirmation-required',
    },
    {
      name: 'prepared task',
      args: (repo) => detachArgs(repo),
      setup: (ledgerFile) => patchLedger(ledgerFile, (l) => { l.tasks[0].status = 'prepared'; }),
      reason: 'detach-worker-in-flight',
      tasks: ['001'],
    },
    {
      name: 'active dispatch',
      args: (repo) => detachArgs(repo),
      setup: (ledgerFile) => patchLedger(ledgerFile, (l) => {
        l.tasks[0].dispatch = { attempt: 1, status: 'active' };
      }),
      reason: 'detach-worker-in-flight',
      tasks: ['001'],
    },
    {
      name: 'awaiting confirmation',
      args: (repo) => detachArgs(repo),
      setup: (ledgerFile) => patchLedger(ledgerFile, (l) => { l.status = 'awaiting_confirmation'; }),
      reason: 'detach-awaiting-confirmation',
    },
  ];
  for (const item of cases) {
    const { repo, ledgerFile, ownKey, otherKey, addOtherKey } = drive();
    addOtherKey();
    item.setup(ledgerFile);
    const watched = [ledgerFile, ownKey, otherKey];
    const before = watched.map((file) => fs.readFileSync(file));

    const result = capture(item.args(repo));

    assert.strictEqual(result.code, 1, item.name);
    const payload = JSON.parse(result.out);
    assert.strictEqual(payload.ok, false, item.name);
    assert.strictEqual(payload.reason, item.reason, item.name);
    if (item.tasks) assert.deepStrictEqual(payload.tasks, item.tasks, item.name);
    watched.forEach((file, index) => {
      assert.ok(fs.readFileSync(file).equals(before[index]), `${item.name}: ${path.basename(file)} changed`);
    });
  }
});

test('detach without a ledger or with a corrupt ledger → refuses with the existing reasons', () => {
  const repo = planTemplate.copy();
  const missing = JSON.parse(capture(detachArgs(repo)).out);
  assert.strictEqual(missing.reason, 'no-ledger');

  const { repo: repo2, ledgerFile } = drive();
  fs.writeFileSync(ledgerFile, '{not json');
  const corrupt = JSON.parse(capture(detachArgs(repo2)).out);
  assert.strictEqual(corrupt.reason, 'unreadable-ledger');
});

test('second detach → succeeds as a no-op and keeps a pointer set again afterwards', () => {
  const { repo, ledgerFile, ownKey } = drive();
  assert.strictEqual(capture(detachArgs(repo)).code, 0);
  writeCurrent({
    repoRoot: repo, blueprint: BP_REL, base: 'work', task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const ledgerBytes = fs.readFileSync(ledgerFile);
  const pointerBytes = fs.readFileSync(ownKey);

  const again = capture(detachArgs(repo));

  assert.strictEqual(again.code, 0);
  const payload = JSON.parse(again.out);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.already, true);
  assert.strictEqual(payload.pointer_removed, false);
  assert.ok(fs.readFileSync(ledgerFile).equals(ledgerBytes));
  assert.ok(fs.readFileSync(ownKey).equals(pointerBytes));
});

test('detachRun with injected git and clock → records the observed heads and time', () => {
  const { repo, ledgerFile } = drive();
  const calls = [];
  const result = detachRun({
    repoRoot: repo,
    blueprint: BP_REL,
    yes: true,
    deps: {
      git: (cwd, args) => { calls.push([cwd, args.join(' ')]); return 'a'.repeat(40); },
      now: () => '2026-10-18T00:00:00.000Z',
    },
  });
  assert.strictEqual(result.ok, true);
  const decision = readLedgerFile(ledgerFile).decisions.pop();
  assert.deepStrictEqual(decision, {
    kind: 'detached',
    at: '2026-10-18T00:00:00.000Z',
    reason: null,
    integration_head: 'a'.repeat(40),
    main_head: 'a'.repeat(40),
    previous_status: 'active',
  });
  assert.strictEqual(calls.length, 2);
});

test('run with an unknown subcommand or without --blueprint → exits 2', () => {
  const unknown = capture(['run', 'bogus', '--blueprint', BP_REL]);
  assert.strictEqual(unknown.code, 2);
  assert.match(unknown.err, /preflight\|detach/);
  const noBlueprint = capture(['run', 'detach', '--yes']);
  assert.strictEqual(noBlueprint.code, 2);
});

test('detached ledger → coordinate next and every fenced mutation refuse with run-detached and keep the ledger bytes', () => {
  const { repo, ledgerFile, integration } = drive({ integrated: false });
  const prepared = coordinatorMod.coordinate({
    command: 'prepare', repoRoot: repo, blueprint: BP_REL, cwd: integration, ...fenceFor(repo),
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  // detach 자체는 진행 중 worker가 있으면 거절되므로, 분리 상태의 ledger는 status만 직접 적는다.
  patchLedger(ledgerFile, (l) => { l.status = 'detached'; });
  const before = fs.readFileSync(ledgerFile);
  const base = { repoRoot: repo, blueprint: BP_REL, cwd: integration, task: '001' };
  const calls = {
    prepare: { command: 'prepare' },
    dispatch: { command: 'dispatch', cwd: worker },
    report: {
      command: 'report', cwd: worker, attempt: 1, taskBriefHash: 'a'.repeat(64), outcome: 'accepted', summary: 's',
    },
    record: { command: 'record', cwd: worker },
    integrate: { command: 'integrate', task: undefined },
    repair: {
      command: 'repair', failureCommand: 'npm test', summary: 's', paths: ['src/auth/'], decision: 'd',
    },
    supplement: {
      command: 'repair', kind: 'supplement', done: true, summary: 's',
    },
    'session-open': { command: 'session-open', task: undefined },
  };
  for (const [name, extra] of Object.entries(calls)) {
    const result = coordinatorMod.coordinate({ ...base, ...extra, ...fenceFor(repo) });
    assert.strictEqual(result.ok, false, name);
    assert.strictEqual(result.reason, 'run-detached', name);
    assert.ok(fs.readFileSync(ledgerFile).equals(before), `${name} changed the ledger`);
  }

  // revise는 CLI가 서 있는 cwd(worker)와 같은 fence로 거절된다.
  const cwdBefore = process.cwd();
  process.chdir(worker);
  let revised;
  try {
    revised = capture([
      'coordinate', 'revise', '--ledger-path', LEDGER_REL, '--ledger-hash', fenceFor(repo).ledgerHash,
      '--blueprint', BP_REL, '--task', '001', '--paths', 'src/auth/', '--reason', 'r',
    ]);
  } finally {
    process.chdir(cwdBefore);
  }
  assert.strictEqual(revised.code, 1, revised.out + revised.err);
  assert.match(revised.out + revised.err, /run-detached/);
  assert.ok(fs.readFileSync(ledgerFile).equals(before), 'revise changed the ledger');

  // 직접 scope 경계도 같은 코드로 거절한다(fence를 거치지 않는 호출자).
  const direct = reviseTaskScope({
    repoRoot: worker, blueprint: BP_REL, task: '001', paths: ['src/auth/'], reason: 'r',
  });
  assert.strictEqual(direct.ok, false);
  assert.strictEqual(direct.reason, 'run-detached');
  assert.ok(fs.readFileSync(ledgerFile).equals(before));
});

test('detached ledger → coordinate next refuses with run-detached', () => {
  const { repo, ledgerFile, integration } = drive();
  patchLedger(ledgerFile, (l) => { l.status = 'detached'; });
  const before = fs.readFileSync(ledgerFile);
  const { coordinateNext } = require('../scripts/lib/coordinate-next');

  const result = coordinateNext({ repoRoot: repo, blueprint: BP_REL, cwd: integration });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'run-detached');
  assert.strictEqual(typeof result.next, 'string');
  assert.ok(fs.readFileSync(ledgerFile).equals(before));
});
