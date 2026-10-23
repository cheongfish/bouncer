// test/cli-commit.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../packages/cli/dist/cli');
const { commitTask } = require('../packages/cli/dist/commit');
const { ensureEpicIndexEntry } = require('../packages/cli/dist/epic-index');
const { recordVerificationResult } = require('../packages/cli/dist/verification');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

const EXPLAIN_BODY = `# Explain

## Background
Auth validation moved to the edge.

## Intuition
Reject bad input early.

## Code
src/auth/login.ts

## Quiz
Where does validation live?

## 이해 상태
Recorded after review.
`;

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function initGitWithChange(repo) {
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '-m', 'base']);
  run(['branch', 'develop']);
  fs.mkdirSync(path.join(repo, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export {}\n');
  run(['add', 'src/auth/login.ts']);
  run(['commit', '-m', 'change']);
}

function recordHarnessVerify(repo) {
  recordVerificationResult({
    repoRoot: repo,
    verificationRel: `${BP_REL}/tasks/001/verification.md`,
    command: 'npm test',
    ranAt: '2026-07-27T00:00:00.000Z',
    exitCode: 0,
    output: 'ok',
  });
}

function fullBlueprint(repo, { tasksStatus = 'verified' } = {}) {
  initGitWithChange(repo);
  const epicDir = '.bouncer/context/epics/001-auth';
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'd',
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
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: tasksStatus,
      affected_paths: ['src/auth/'],
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed' },
  });
  // commit 게이트 G13은 status: passed 손기록을 믿지 않는다. 하네스가 문서를
  // YAML 왕복한 뒤 같은 command/ran_at/exit_code/output_sha로 원장에 남긴
  // 경로와 맞춰야 dry-run/--yes 픽스처가 열린다.
  recordHarnessVerify(repo);
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });

  // commit 게이트는 explain을 보지 않는다. finalize용 문서만 최소로 둔다.
  writeDoc(repo, `${BP_REL}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd',
    resource: `${BP_REL}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'draft',
      comprehension: [],
    },
  }, EXPLAIN_BODY);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('commit --yes after source edits following verify → rejects with G23', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'validate');
  assert.ok(parsed.failures.some((f) => f.code === 'G23' && /sources changed after verify/.test(f.message)));
});

test('commit without --blueprint → exits 2 and keeps stdout pipe-clean of ok:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['commit', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(buf.err.length > 0);
  assert.ok(!buf.out.includes('"ok": true'));
});

test('commit gate failure → exits non-zero with JSON { ok:false, reason:validate }', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  // commit 게이트는 explain이 아니라 포인터 task 상태(G6)를 본다.
  fullBlueprint(repo, { tasksStatus: 'ready' });
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL],
    io,
  );
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'validate');
  assert.ok(Array.isArray(parsed.failures));
  assert.ok(parsed.failures.some((f) => f.code === 'G6'));
});

test('commit dry-run → exits 0 with dryRun JSON', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  // Working tree clean relative to HEAD — dry-run still succeeds with empty staged.
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL],
    io,
  );
  assert.strictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.dryRun, true);
  assert.ok('commitMessage' in parsed);
  assert.ok('nextTask' in parsed);
  assert.ok(Array.isArray(parsed.staged));
});

test('commit --yes → writes stable provenance trailers to the real git message', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.strictEqual(code, 0, buf.out + buf.err);
  const parsed = JSON.parse(buf.out);
  const body = execFileSync('git', ['log', '--format=%B', '-1'], {
    cwd: repo, encoding: 'utf8',
  });
  assert.strictEqual(body.replace(/\n+$/u, ''), parsed.commitMessage);
  assert.match(body, /^Bouncer-Task: EPIC-001\/BP-001\/TASK-001$/m);
  assert.match(body, /^Bouncer-Intent: EPIC-001\/BP-001$/m);
  assert.strictEqual((body.match(/^Bouncer-Task:/gm) || []).length, 1);
  assert.strictEqual((body.match(/^Bouncer-Intent:/gm) || []).length, 1);
});

test('commit --yes with an in-scope change → stages it and returns committed:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  // HEAD 위에 범위 안 변경을 남겨 realGit 경로의 커밋을 검증한다.
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.strictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.committed, true);
  assert.ok(parsed.staged.includes('src/auth/login.ts'));
  assert.ok(typeof parsed.commitMessage === 'string' && parsed.commitMessage.length > 0);
  // 커밋 직후 commit_sha만 tasks.md에 남긴다 — 소스 변경은 HEAD에 있어야 한다.
  const dirty = execFileSync('git', ['status', '--porcelain'], {
    cwd: repo, encoding: 'utf8',
  }).trim();
  assert.match(dirty, /(?:tasks\/001\/tasks\.md|\.bouncer\/)/);
  assert.ok(!dirty.split('\n').some((line) => /src\/auth\/login\.ts/.test(line)));
  const tasksRaw = fs.readFileSync(
    path.join(repo, `${BP_REL}/tasks/001/tasks.md`),
    'utf8',
  );
  assert.match(tasksRaw, /commit_sha:/);
  assert.ok(typeof parsed.commitSha === 'string' && parsed.commitSha.length > 0);
});

test('commit --yes with an in-scope tracked deletion already staged by the task → commits it', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  // 실제 TASKS-005 삭제 경로처럼 작업자가 이미 `git add -A`한 deletion은
  // index에서 pathspec이 사라진다. commit이 같은 경로를 다시 add하지 않아야 한다.
  fs.rmSync(path.join(repo, 'src/auth/login.ts'));
  execFileSync('git', ['add', '-A', '--', 'src/auth/login.ts'], { cwd: repo });
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.strictEqual(code, 0, buf.out + buf.err);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.committed, true);
  assert.ok(parsed.staged.includes('src/auth/login.ts'));
  assert.ok(!fs.existsSync(path.join(repo, 'src/auth/login.ts')));
  const committed = execFileSync('git', ['show', '--format=', '--name-status', 'HEAD'], {
    cwd: repo, encoding: 'utf8',
  });
  assert.match(committed, /^D\s+src\/auth\/login\.ts$/m);
});

test('commit --yes with an in-scope tracked deletion from a clean index → stages it', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  fs.rmSync(path.join(repo, 'src/auth/login.ts'));
  recordHarnessVerify(repo);
  // 실패했던 경로는 이전 시도의 staged deletion을 물려받았다. 여기서는 index가
  // 비어 있음을 먼저 고정해, commit이 삭제 자체를 stage하는지 검증한다.
  assert.strictEqual(execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repo, encoding: 'utf8',
  }).trim(), '');

  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.strictEqual(code, 0, buf.out + buf.err);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.committed, true);
  assert.ok(parsed.staged.includes('src/auth/login.ts'));
  const committed = execFileSync('git', ['show', '--format=', '--name-status', 'HEAD'], {
    cwd: repo, encoding: 'utf8',
  });
  assert.match(committed, /^D\s+src\/auth\/login\.ts$/m);
});

test('commit --yes with both existing index and later worktree changes to one task file → stages both', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const login = path.join(repo, 'src/auth/login.ts');
  fs.writeFileSync(login, 'export const first = 1;\n');
  execFileSync('git', ['add', '--', 'src/auth/login.ts'], { cwd: repo });
  fs.writeFileSync(login, 'export const first = 1;\nexport const second = 2;\n');
  recordHarnessVerify(repo);

  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.strictEqual(code, 0, buf.out + buf.err);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.committed, true);
  assert.strictEqual(execFileSync('git', ['show', 'HEAD:src/auth/login.ts'], {
    cwd: repo, encoding: 'utf8',
  }), 'export const first = 1;\nexport const second = 2;\n');
  assert.strictEqual(execFileSync('git', ['diff', '--name-only'], {
    cwd: repo, encoding: 'utf8',
  }).trim(), '');
});

test('commit --yes with an out-of-scope change before staging and no host hook → rejects', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  // 훅 어댑터 없이 CLI만 호출해도 범위 밖 변경은 staging 전에 거절한다.
  fs.mkdirSync(path.join(repo, 'src/payments'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/payments/charge.ts'), 'export {}\n');
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'out-of-scope');
  assert.ok(parsed.violations.includes('src/payments/charge.ts'));
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repo, encoding: 'utf8',
  }).trim();
  assert.strictEqual(staged, '');
  const dirty = execFileSync('git', ['status', '--porcelain'], {
    cwd: repo, encoding: 'utf8',
  });
  assert.match(dirty, /src\/payments/);
  assert.match(dirty, /src\/auth\/login\.ts/);
});

test('commit --yes with a tracked finalization remainder → leaves it while committing task source', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const retainedIndex = '.bouncer/Dist' + 'ill.md';
  const retainedShard = '.bouncer/dist' + 'ill/core.md';
  const context = '.bouncer/context/index.md';
  for (const rel of [retainedIndex, retainedShard, context]) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (rel === context && fs.existsSync(abs)) {
      fs.appendFileSync(abs, '\n<!-- finalize remainder -->\n');
    } else {
      fs.writeFileSync(abs, '# finalize remainder\n');
    }
  }
  // 삭제 전 추적 상태를 고정한다. untracked 잔여 문서는 scope 예외가 아니어야 한다.
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture remainder'], { cwd: repo });
  fs.rmSync(path.join(repo, retainedIndex));
  fs.rmSync(path.join(repo, retainedShard));
  // 직전 finalize가 이미 index에 올린 삭제도 task commit이 소비하면 안 된다.
  execFileSync('git', ['add', '-A', '--', retainedIndex, retainedShard], { cwd: repo });
  fs.appendFileSync(path.join(repo, context), '<!-- changed finalize context -->\n');
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);

  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io,
  );
  assert.strictEqual(code, 0, buf.out + buf.err);
  const parsed = JSON.parse(buf.out);
  assert.deepStrictEqual(parsed.staged, ['src/auth/login.ts']);
  const committed = execFileSync('git', ['show', '--format=', '--name-only', 'HEAD'], {
    cwd: repo, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  assert.deepStrictEqual(committed, ['src/auth/login.ts']);
  const preserved = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repo, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean).sort();
  assert.deepStrictEqual(preserved, [retainedIndex, retainedShard].sort());
});

test('commit when the commit gate throws → restores the staged finalization remainder', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const retainedIndex = '.bouncer/Dist' + 'ill.md';
  fs.writeFileSync(path.join(repo, retainedIndex), '# tracked\n');
  execFileSync('git', ['add', retainedIndex], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture remainder'], { cwd: repo });
  fs.rmSync(path.join(repo, retainedIndex));
  execFileSync('git', ['add', '-A', '--', retainedIndex], { cwd: repo });

  assert.throws(() => commitTask({
    repoRoot: repo,
    blueprintDir: BP_REL,
    validateGate: () => { throw new Error('injected gate failure'); },
  }), /injected gate failure/);
  const preserved = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repo, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  assert.deepStrictEqual(preserved, [retainedIndex]);
});

test('commit with modified or untracked finalization remainder and other out-of-scope candidates → still rejects', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const retainedIndex = '.bouncer/Dist' + 'ill.md';
  const untrackedRemainder = '.bouncer/dist' + 'ill/untracked.md';
  fs.writeFileSync(path.join(repo, retainedIndex), '# tracked\n');
  execFileSync('git', ['add', retainedIndex], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture remainder'], { cwd: repo });
  fs.appendFileSync(path.join(repo, retainedIndex), 'changed\n');
  fs.mkdirSync(path.dirname(path.join(repo, untrackedRemainder)), { recursive: true });
  fs.writeFileSync(path.join(repo, untrackedRemainder), '# not remainder\n');
  fs.writeFileSync(path.join(repo, 'README.md'), 'out of scope\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io,
  );
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.reason, 'out-of-scope');
  assert.ok(parsed.violations.includes(retainedIndex));
  assert.ok(parsed.violations.includes(untrackedRemainder));
  assert.ok(parsed.violations.includes('README.md'));
});

// --- coordinator mode -------------------------------------------------------


const { coordinatorPathsFor: __coordinatorPathsFor } = require('../packages/cli/dist/runtime-state');
const { coordinate } = require('./helpers/coordinator-fence');


test('commit JSON → reports actual paths and coordinator provenance', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint: BP_REL, cwd: boot.integrationPath,
  });
  const worker = prepared.tasks[0].workerPath;
  // seed는 blueprint 문서만 옮긴다. epic 색인은 worker에서 다시 만든다.
  writeDoc(worker, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth', description: 'd',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  ensureEpicIndexEntry({
    repoRoot: worker, epicId: '001', name: 'auth', description: 'd',
  });
  fs.writeFileSync(path.join(worker, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(worker);

  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', worker, '--blueprint', BP_REL, '--yes'], io,
  );
  assert.strictEqual(code, 0, buf.out + buf.err);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.committed, true);
  assert.deepStrictEqual(parsed.actualPaths, ['src/auth/login.ts']);
  // prepare가 이미 001을 열었으므로 이 시점의 ready set은 비어 있다.
  assert.deepStrictEqual(parsed.readyWave, []);
  assert.strictEqual(typeof parsed.taskSha, 'string');
  assert.strictEqual(typeof parsed.integrationHeadBefore, 'string');
  // record 전이므로 ledger가 아직 worker SHA를 갖지 않는다.
  assert.strictEqual(parsed.ledgerWorkerSha, null);
  assert.deepStrictEqual(parsed.ledgerRecord, { ok: true });
});

test('commit from the main worktree while a coordinator ledger is live → is refused', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io,
  );
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'main-worktree-source-write');
  // 아직 integrated가 아닌 task가 있으므로 detach가 아니라 실행을 이어가라고 안내한다.
  assert.match(parsed.recovery.next, /\/bouncer-run/);
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: repo, encoding: 'utf8',
  }).trim();
  assert.strictEqual(staged, '');
});

test('commit from the main worktree after every task is integrated → next points to run detach', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  const { ledgerFile } = __coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  for (const item of ledger.tasks) item.status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io);
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.reason, 'main-worktree-source-write');
  assert.match(parsed.recovery.next, /bouncer run detach --blueprint \S+ --yes/);
});

test('commit from the main worktree on a detached ledger → is no longer refused by the ledger', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: BP_REL });
  const { ledgerFile } = __coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.status = 'detached';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  const { io, buf } = capture();
  const code = runCli(['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io);
  const parsed = JSON.parse(buf.out);
  assert.notStrictEqual(parsed.reason, 'main-worktree-source-write', buf.out);
  assert.strictEqual(code, 0, buf.out + buf.err);
});

test('commit --yes when a pre-commit hook rejects → exits 1 with one commit-exception JSON and no stack', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  recordHarnessVerify(repo);
  // 전역 git 설정이 아니라 이 저장소의 config에만 실패 hook을 건다.
  const hooks = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-hooks-'));
  fs.writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  execFileSync('git', ['-C', repo, 'config', 'core.hooksPath', hooks]);
  const { io, buf } = capture();
  const code = runCli(['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'], io);
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'commit-exception');
  assert.strictEqual(parsed.recovery.action, 'report-and-stop');
  assert.ok(!buf.out.includes('    at '));
  assert.ok(buf.err.startsWith('commit: '));
});
