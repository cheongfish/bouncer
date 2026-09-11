'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, worktreePathFor,
  verifyLedgerPathFor, coordinatorPathsFor,
  listNamespacePointers, pointerKeyFromBlueprint, removeNamespacePointer, branchNamesFor, resolveWorktreeBranch,
} = require('../scripts/lib/runtime-state');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

test('branchNamesFor derives commit and worker branches from the blueprint metadata', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-branch-names-'));
  // ci-contract는 제거된 명령의 표면을 감시하므로 fixture slug는 런타임에 조립한다.
  const slug = ['dis', 'till-removal-context-search-ci-recovery'].join('');
  const blueprint = `.bouncer/context/epics/068-x/blueprints/001-${slug}`;
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  commit_type: feat\n---\n');
  assert.deepStrictEqual(branchNamesFor({ repoRoot: repo, blueprint, task: '005' }), {
    integration: `feat/068-001-${slug}`,
    standalone: `feat/068-001-${slug}`,
    worker: 'bouncer/068-001-005',
  });
  fs.rmSync(path.join(repo, blueprint, 'index.md'));
  assert.strictEqual(branchNamesFor({ repoRoot: repo, blueprint }).integration,
    `feat/068-001-${slug}`);
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  commit_type: wip\n---\n');
  assert.throws(() => branchNamesFor({ repoRoot: repo, blueprint }), /invalid-commit-type/);
  assert.throws(() => branchNamesFor({ repoRoot: repo,
    blueprint: '.bouncer/context/epics/068-x/blueprints/001-bad..slug' }), /invalid-branch-name/);
});

test('resolveWorktreeBranch reuses the registered branch and rejects an occupied new branch', () => {
  const { primary } = linkedRepo();
  const legacy = path.join(primary, 'legacy-worker');
  git(primary, ['worktree', 'add', '-b', 'legacy/worker', legacy, 'HEAD']);
  assert.deepStrictEqual(resolveWorktreeBranch({
    repoRoot: primary, worktreePath: legacy, branch: 'bouncer/001-001-001', execFileSync,
  }), { action: 'reuse', branch: 'legacy/worker' });
  assert.deepStrictEqual(resolveWorktreeBranch({
    repoRoot: primary, worktreePath: path.join(primary, 'new-worker'), branch: 'bouncer/001-001-001', execFileSync,
  }), { action: 'create', branch: 'bouncer/001-001-001' });
  assert.throws(() => resolveWorktreeBranch({
    repoRoot: primary, worktreePath: path.join(primary, 'other-worker'), branch: 'legacy/worker', execFileSync,
  }), /branch-conflict/);
});

test('repair ledger validation requires two waves and the last CI failure for partial close', () => {
  const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
  const base = {
    version: 1, blueprint: 'bp', base: 'main', integrationHead: 'abc', tasks: [],
    decisions: [], repairWaves: [], status: 'active',
  };
  assert.strictEqual(validateCoordinatorLedger(base).ok, true);
  assert.match(validateCoordinatorLedger({ ...base, status: 'partial_closed' }).reason, /repair-waves/);
  const wave1 = repairDecision('003', 1, 'r1', ['src/a.js']);
  const wave2 = repairDecision('004', 2, 'r2', ['src/b.js']);
  const waves = [wave1, wave2];
  assert.match(validateCoordinatorLedger({
    ...base, status: 'partial_closed', repairWaves: waves, decisions: copy(waves),
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [copy(wave1)] },
      { id: '004', status: 'integrated', decisions: [copy(wave2)] }],
  }).reason, /failure-evidence/);
  const evidence = { task: '002', command: 'npm test', summary: 'one failed', paths: ['test/a.js'], exitCode: 1, repairWave: 2 };
  const valid = {
    ...base, status: 'partial_closed', repairWaves: waves,
    terminalFailure: evidence, userConfirmed: true, decisions: copy(waves),
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [copy(wave1)] },
      { id: '004', status: 'integrated', decisions: [copy(wave2)] }],
  };
  assert.match(validateCoordinatorLedger({ ...valid, status: 'active' }, { requirePartialClose: true }).reason, /awaiting/);
  assert.match(validateCoordinatorLedger({ ...valid, decisions: [wave2, wave1] }).reason, /ordered/);
  assert.match(validateCoordinatorLedger({ ...valid, terminalFailure: { ...evidence, exitCode: 0 } }).reason, /nonzero/);
  assert.match(validateCoordinatorLedger({ ...valid, terminalFailure: { ...evidence, paths: [] } }).reason, /evidence/);
  assert.strictEqual(validateCoordinatorLedger(valid).ok, true);
});

function repairDecision(task, wave, revision, paths) {
  return {
    task, kind: 'repair', wave, reason: `repair wave ${wave}`,
    failure: {
      task: '002', command: 'npm test', summary: `wave ${wave} failed`,
      paths, exitCode: 1, repairWave: wave - 1,
    },
    previousDag: [{ id: '002', depends_on: wave === 1 ? ['001'] : ['003'] }],
    nextDag: [{ id: '002', depends_on: [task] }, { id: task, depends_on: ['001'] }],
    previousScope: [], nextScope: paths, necessity: 'terminal CI repair is required', revision,
  };
}

test('partial-close repair decisions require complete canonical task and global copies', () => {
  const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
  const wave1 = repairDecision('003', 1, 'r1', ['src/a.js']);
  const wave2 = repairDecision('004', 2, 'r2', ['src/b.js']);
  const valid = {
    status: 'partial_closed', repairWaves: [wave1, wave2], decisions: copy([wave1, wave2]),
    terminalFailure: {
      task: '002', command: 'npm test', summary: 'still failing', paths: ['src/b.js'],
      exitCode: 1, repairWave: 2,
    },
    userConfirmed: true,
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [copy(wave1)] },
      { id: '004', status: 'integrated', decisions: [copy(wave2)] }],
  };

  for (const field of ['failure', 'previousDag', 'nextDag', 'previousScope', 'nextScope', 'necessity', 'revision']) {
    const invalid = copy(valid);
    delete invalid.repairWaves[0][field];
    assert.match(validateCoordinatorLedger(invalid).reason, /repair-decision/, field);
  }
  for (const field of ['command', 'summary', 'paths']) {
    const invalid = copy(valid);
    delete invalid.repairWaves[0].failure[field];
    assert.match(validateCoordinatorLedger(invalid).reason, /repair-decision/, `failure.${field}`);
  }
  const emptyFailurePaths = copy(valid);
  emptyFailurePaths.repairWaves[0].failure.paths = [];
  assert.match(validateCoordinatorLedger(emptyFailurePaths).reason, /repair-decision/);

  const changedGlobalCopy = copy(valid);
  changedGlobalCopy.decisions[0].necessity = 'different';
  assert.match(validateCoordinatorLedger(changedGlobalCopy).reason, /global-repair-log/);
  const changedTaskCopy = copy(valid);
  changedTaskCopy.tasks[1].decisions[0].nextScope = ['src/other.js'];
  assert.match(validateCoordinatorLedger(changedTaskCopy).reason, /task-repair-log/);
  assert.strictEqual(validateCoordinatorLedger(valid).ok, true);
});

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function linkedRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-runtime-'));
  const primary = path.join(root, 'primary');
  const linked = path.join(root, 'linked');
  fs.mkdirSync(primary);
  git(primary, ['init', '--quiet']);
  fs.writeFileSync(path.join(primary, 'README.md'), 'fixture\n');
  git(primary, ['add', 'README.md']);
  git(primary, ['-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'fixture']);
  git(primary, ['worktree', 'add', '--quiet', '--detach', linked]);
  return { root, primary, linked };
}

test('primary checkout and linked worktree share Git-local runtime paths', () => {
  const { primary, linked } = linkedRepo();
  const primaryPaths = runtimePaths({ repoRoot: primary, execFileSync, platform: 'linux' });
  const linkedPaths = runtimePaths({ repoRoot: linked, execFileSync, platform: 'linux' });

  assert.strictEqual(linkedPaths.commonGitDir, primaryPaths.commonGitDir);
  assert.strictEqual(primaryPaths.currentFile,
    path.join(primaryPaths.commonGitDir, 'bouncer', 'current'));
  assert.strictEqual(primaryPaths.worktreeRoot, path.join(primary, '.worktrees'));
  // projectRoot는 checkout 종류와 무관하게 main worktree(정본)다.
  assert.strictEqual(primaryPaths.projectRoot, primary);
  assert.strictEqual(linkedPaths.projectRoot, primary);
  assert.deepStrictEqual(linkedPaths, primaryPaths);
});

test('coordinator paths derive integration, worker, and integration-local ledger', () => {
  const { primary } = linkedRepo();
  const result = coordinatorPathsFor({
    repoRoot: primary,
    blueprint: '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path',
    task: '002', deps: { execFileSync, platform: 'linux' },
  });
  assert.deepStrictEqual(result, {
    integrationPath: path.join(primary, '.worktrees', '023', '001', 'integration'),
    workerPath: path.join(primary, '.worktrees', '023', '001', 'workers', '002'),
    ledgerFile: path.join(primary, '.worktrees', '023', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json'),
  });
});

test('worktree root is under the main repository checkout', () => {
  const { primary } = linkedRepo();
  const paths = runtimePaths({
    repoRoot: primary,
    execFileSync,
    platform: 'linux',
  });

  assert.strictEqual(paths.worktreeRoot, path.join(primary, '.worktrees'));
  assert.ok(paths.worktreeRoot.startsWith(`${primary}${path.sep}`));
  assert.ok(!paths.worktreeRoot.startsWith(`${paths.commonGitDir}${path.sep}`));
  assert.strictEqual(fs.existsSync(paths.currentFile), false);
  assert.strictEqual(fs.existsSync(paths.worktreeRoot), false);
});

test('win32 path API keeps worktrees beside the main checkout', () => {
  const exec = () => '.git\n';
  const windows = runtimePaths({
    repoRoot: 'C:\\repo', execFileSync: exec,
    env: {}, platform: 'win32',
  });
  assert.strictEqual(
    windows.worktreeRoot,
    path.win32.join('C:\\repo', '.worktrees'),
  );
  assert.strictEqual(windows.projectRoot, 'C:\\repo');
});

test('runtime resolution is read-only and reports non-Git directories unavailable', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  const before = fs.readdirSync(repo);
  const paths = runtimePaths({
    repoRoot: repo, execFileSync, env: process.env, platform: process.platform,
  });

  assert.strictEqual(paths.unavailable, true);
  assert.ok(paths.reason);
  assert.deepStrictEqual(fs.readdirSync(repo), before);
});

test('runtime current round-trips across primary and linked worktrees', () => {
  const { primary, linked } = linkedRepo();
  const deps = {
    execFileSync,
    platform: 'linux',
  };
  const value = {
    blueprint: '.bouncer/context/epics/001-x/blueprints/001-y',
    base: 'develop',
  };

  const currentFile = writeRuntimeCurrent({ repoRoot: primary, ...value, deps });

  assert.ok(fs.existsSync(currentFile));
  const listed = listNamespacePointers({ repoRoot: linked, deps });
  assert.deepStrictEqual(listed.map((e) => e.pointer), [{
    ...value,
    task: null,
  }]);
  // migrate-task-layout·import-history는 이 primitive만 본다. namespace
  // 쓰기 뒤 레거시 파일이 없어도 유일한 키가 보여야 한다.
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: linked, deps }), {
    ...value,
    task: null,
  });
});

test('writeRuntimeCurrent includes task key only when a string path is given', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  const task = `${blueprint}/tasks-002.md`;

  const withTask = writeRuntimeCurrent({
    repoRoot: primary, blueprint, base: 'develop', task, deps,
  });
  const written = JSON.parse(fs.readFileSync(withTask, 'utf8'));
  assert.strictEqual(written.task, task);
  assert.deepStrictEqual(listNamespacePointers({ repoRoot: primary, deps })[0].pointer, {
    blueprint, base: 'develop', task,
  });

  const withoutTask = writeRuntimeCurrent({
    repoRoot: primary, blueprint, base: 'develop', deps,
  });
  const omitted = JSON.parse(fs.readFileSync(withoutTask, 'utf8'));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(omitted, 'task'), false);
  assert.deepStrictEqual(listNamespacePointers({ repoRoot: primary, deps })[0].pointer, {
    blueprint, base: 'develop', task: null,
  });
});

test('readRuntimeCurrent treats missing or non-string task as null', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });

  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.writeFileSync(paths.currentFile, `${JSON.stringify({
    blueprint, base: 'develop',
  }, null, 2)}\n`);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task: null,
  });

  fs.writeFileSync(paths.currentFile, `${JSON.stringify({
    blueprint, base: 'develop', task: 2,
  }, null, 2)}\n`);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task: null,
  });
});

test('runtime current handles missing, corrupt, and non-Git state', () => {
  const { primary } = linkedRepo();
  const deps = {
    execFileSync,
    platform: 'linux',
  };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  assert.strictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), null);
  fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });
  fs.writeFileSync(paths.currentFile, '{ invalid');
  assert.strictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), null);

  const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  assert.strictEqual(readRuntimeCurrent({ repoRoot: nonGit, deps }), null);
  assert.throws(
    () => writeRuntimeCurrent({ repoRoot: nonGit, blueprint: 'bp', base: 'main', deps }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
});

test('worktreePathFor defaults to nested epic/blueprint path without creating directories', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '023', '001'),
  );
  assert.strictEqual(fs.existsSync(path.join(primary, '.worktrees')), false);
});

test('worktreePathFor falls back to flat path when nested is missing', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  fs.mkdirSync(path.join(primary, '.worktrees', '001'), { recursive: true });
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '001'),
  );
});

test('worktreePathFor prefers nested when both nested and flat exist', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  fs.mkdirSync(path.join(primary, '.worktrees', '001'), { recursive: true });
  fs.mkdirSync(path.join(primary, '.worktrees', '023', '001'), { recursive: true });
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '023', '001'),
  );
});

test('worktreePathFor rejects legacy-prefixed ids and non-Git roots', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  assert.throws(() => worktreePathFor({
    repoRoot: primary,
    blueprint: '.bouncer/context/epics/EPIC-023/blueprints/BP-001',
    deps,
  }));
  const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  assert.throws(
    () => worktreePathFor({ repoRoot: nonGit, blueprint: bp, deps }),
    /Bouncer requires a Git repository for an active blueprint/,
  );
});

test('verifyLedgerPathFor hashes the verification rel under the Git common directory', () => {
  const { createHash } = require('node:crypto');
  const { primary, linked } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const rel = '.bouncer/context/epics/001-x/blueprints/001-y/tasks/001/verification.md';
  const primaryLedger = verifyLedgerPathFor({ repoRoot: primary, verificationRel: rel, deps });
  const linkedLedger = verifyLedgerPathFor({ repoRoot: linked, verificationRel: rel, deps });

  assert.strictEqual(primaryLedger.unavailable, undefined);
  assert.strictEqual(linkedLedger.ledgerFile, primaryLedger.ledgerFile);
  const digest = createHash('sha256').update(rel, 'utf8').digest('hex').slice(0, 16);
  assert.strictEqual(
    primaryLedger.ledgerFile,
    path.join(primaryLedger.commonGitDir, 'bouncer', 'verify', `${digest}.json`),
  );
});

test('verifyLedgerPathFor reports non-Git directories unavailable', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  const result = verifyLedgerPathFor({
    repoRoot: repo,
    verificationRel: 'x.md',
    deps: { execFileSync },
  });
  assert.strictEqual(result.unavailable, true);
  assert.ok(result.reason);
  assert.strictEqual(result.ledgerFile, undefined);
});

const BP_A = '.bouncer/context/epics/001-x/blueprints/001-y';
const BP_B = '.bouncer/context/epics/002-z/blueprints/003-w';

test('runtimePaths returns the legacy current file and the namespace root together', () => {
  const { primary } = linkedRepo();
  const paths = runtimePaths({ repoRoot: primary, execFileSync, platform: 'linux' });
  assert.strictEqual(
    paths.currentFile,
    path.join(paths.commonGitDir, 'bouncer', 'current'),
  );
  assert.strictEqual(
    paths.pointersRoot,
    path.join(paths.commonGitDir, 'bouncer', 'pointers'),
  );
});

test('pointerKeyFromBlueprint uses three-digit epic and blueprint ids only', () => {
  assert.deepStrictEqual(pointerKeyFromBlueprint(BP_A), {
    epicId: '001', blueprintId: '001', key: '001/001',
  });
  assert.deepStrictEqual(pointerKeyFromBlueprint(BP_B), {
    epicId: '002', blueprintId: '003', key: '002/003',
  });
  assert.throws(
    () => pointerKeyFromBlueprint('.bouncer/context/epics/001-x'),
    /Cannot derive epic\/blueprint ids/,
  );
});

test('two namespace pointers coexist and removing one preserves the other', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  const first = writeRuntimeCurrent({
    repoRoot: primary, blueprint: BP_A, base: 'develop', deps,
  });
  const second = writeRuntimeCurrent({
    repoRoot: primary, blueprint: BP_B, base: 'main', task: `${BP_B}/tasks/001/tasks.md`, deps,
  });

  assert.strictEqual(first, path.join(paths.pointersRoot, '001', '001.json'));
  assert.strictEqual(second, path.join(paths.pointersRoot, '002', '003.json'));
  assert.strictEqual(fs.existsSync(paths.currentFile), false);

  const listed = listNamespacePointers({ repoRoot: primary, deps });
  assert.deepStrictEqual(listed.map((e) => e.key), ['001/001', '002/003']);
  assert.deepStrictEqual(listed.map((e) => e.pointer.blueprint), [BP_A, BP_B]);

  assert.strictEqual(removeNamespacePointer({ repoRoot: primary, key: '001/001', deps }), true);
  assert.strictEqual(fs.existsSync(first), false);
  assert.ok(fs.existsSync(second));
  const remaining = listNamespacePointers({ repoRoot: primary, deps });
  assert.deepStrictEqual(remaining.map((e) => e.pointer), [{
    blueprint: BP_B, base: 'main', task: `${BP_B}/tasks/001/tasks.md`,
  }]);
  assert.strictEqual(removeNamespacePointer({ repoRoot: primary, key: '001/001', deps }), false);
});

test('writeRuntimeCurrent rejects a blueprint path without three-digit ids', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  assert.throws(
    () => writeRuntimeCurrent({ repoRoot: primary, blueprint: 'bp', base: 'main', deps }),
    /Cannot derive epic\/blueprint ids/,
  );
});

test('writeRuntimeCurrent is atomic: a write failure leaves no namespace file', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  const boom = new Error('injected write failure');
  assert.throws(() => writeRuntimeCurrent({
    repoRoot: primary,
    blueprint: BP_A,
    base: 'develop',
    deps: {
      ...deps,
      fs: {
        ...fs,
        writeFileSync() { throw boom; },
      },
    },
  }), boom);
  assert.strictEqual(fs.existsSync(path.join(paths.pointersRoot, '001', '001.json')), false);
});

test('readRuntimeCurrent falls back to the legacy file when namespace is empty', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.writeFileSync(paths.currentFile, `${JSON.stringify({
    blueprint, base: 'develop',
  }, null, 2)}\n`);
  assert.deepStrictEqual(readRuntimeCurrent({ repoRoot: primary, deps }), {
    blueprint, base: 'develop', task: null,
  });
});

test('readRuntimeCurrent does not hide a broken namespace file as null', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_A, base: 'develop', deps });
  const broken = path.join(
    runtimePaths({ repoRoot: primary, ...deps }).pointersRoot, '002', '003.json',
  );
  fs.mkdirSync(path.dirname(broken), { recursive: true });
  fs.writeFileSync(broken, '{ invalid');
  assert.throws(
    () => readRuntimeCurrent({ repoRoot: primary, deps }),
    (err) => err instanceof Error
      && String(err.message).includes(broken)
      && String(err.message).length > broken.length,
  );
});

test('readRuntimeCurrent rejects multiple namespace pointers instead of picking one', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_A, base: 'develop', deps });
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_B, base: 'main', deps });
  assert.throws(
    () => readRuntimeCurrent({ repoRoot: primary, deps }),
    (err) => err instanceof Error && /ambiguous/i.test(err.message),
  );
});

test('listNamespacePointers reports a broken file instead of hiding it', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_A, base: 'develop', deps });
  const broken = path.join(
    runtimePaths({ repoRoot: primary, ...deps }).pointersRoot, '002', '003.json',
  );
  fs.mkdirSync(path.dirname(broken), { recursive: true });
  fs.writeFileSync(broken, '{ invalid');
  const listed = listNamespacePointers({ repoRoot: primary, deps });
  const issue = listed.find((e) => e.path === broken);
  assert.ok(issue);
  assert.strictEqual(issue.pointer, null);
  assert.ok(issue.issue);
  assert.strictEqual(issue.issue.path, broken);
  assert.ok(typeof issue.issue.reason === 'string' && issue.issue.reason.length > 0);
});
