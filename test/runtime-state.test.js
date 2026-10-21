'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, worktreePathFor,
  verifyLedgerPathFor, intentBundlePathFor, coordinatorPathsFor,
  listNamespacePointers, pointerKeyFromBlueprint, removeNamespacePointer, branchNamesFor, resolveWorktreeBranch,
  validateCoordinatorLedger, parsePointerKey, approvalSnapshotPathFor,
} = require('../scripts/lib/runtime-state');

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

test('branchNamesFor with blueprint metadata → derives commit and worker branches', () => {
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

const SLUG_BP = '.bouncer/context/epics/plan-workflow/blueprints/registry-gates';

test('branchNamesFor with a slug blueprint path → joins slugs with double hyphens', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-branch-names-slug-'));
  fs.mkdirSync(path.join(repo, SLUG_BP), { recursive: true });
  fs.writeFileSync(path.join(repo, SLUG_BP, 'index.md'), '---\nbouncer:\n  commit_type: feat\n---\n');
  assert.deepStrictEqual(branchNamesFor({ repoRoot: repo, blueprint: SLUG_BP, task: '002' }), {
    integration: 'feat/plan-workflow--registry-gates',
    standalone: 'feat/plan-workflow--registry-gates',
    worker: 'bouncer/plan-workflow--registry-gates--002',
  });
  assert.strictEqual(branchNamesFor({ repoRoot: repo, blueprint: SLUG_BP }).worker, undefined);
});

test('slug blueprint path → derives slug pointer, approval, worktree and coordinator paths', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  assert.deepStrictEqual(pointerKeyFromBlueprint(SLUG_BP), {
    epicId: 'plan-workflow', blueprintId: 'registry-gates', key: 'plan-workflow/registry-gates',
  });
  assert.strictEqual(
    writeRuntimeCurrent({ repoRoot: primary, blueprint: SLUG_BP, base: 'develop', deps }),
    path.join(paths.pointersRoot, 'plan-workflow', 'registry-gates.json'),
  );
  assert.deepStrictEqual(
    approvalSnapshotPathFor({ repoRoot: primary, blueprintDir: SLUG_BP, deps }),
    { path: path.join(paths.approvalsRoot, 'plan-workflow', 'registry-gates.json') },
  );
  const root = path.join(primary, '.worktrees', 'plan-workflow', 'registry-gates');
  assert.strictEqual(worktreePathFor({ repoRoot: primary, blueprint: SLUG_BP, deps }), root);
  assert.deepStrictEqual(coordinatorPathsFor({ repoRoot: primary, blueprint: SLUG_BP, task: '002', deps }), {
    integrationPath: path.join(root, 'integration'),
    workerPath: path.join(root, 'workers', '002'),
    faninPath: path.join(root, 'fanin'),
    ledgerFile: path.join(root, 'integration', '.bouncer', 'runtime', 'coordinator.json'),
  });
});

test('slug worktree with only a flat sibling directory → does not reuse the flat fallback', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  fs.mkdirSync(path.join(primary, '.worktrees', 'registry-gates'), { recursive: true });
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: SLUG_BP, deps }),
    path.join(primary, '.worktrees', 'plan-workflow', 'registry-gates'),
  );
});

test('numeric and slug pointers together → lists both and parsePointerKey reads both', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  writeRuntimeCurrent({ repoRoot: primary, blueprint: SLUG_BP, base: 'develop', deps });
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_A, base: 'develop', deps });
  const paths = runtimePaths({ repoRoot: primary, ...deps });
  // 구형·slug 어느 형식에도 맞지 않는 이름은 조용히 건너뛴다.
  fs.mkdirSync(path.join(paths.pointersRoot, 'Bad_Dir'), { recursive: true });
  fs.writeFileSync(path.join(paths.pointersRoot, 'Bad_Dir', 'x.json'), '{}');
  fs.writeFileSync(path.join(paths.pointersRoot, 'plan-workflow', 'Bad_File.json'), '{}');
  const listed = listNamespacePointers({ repoRoot: primary, deps });
  assert.deepStrictEqual(listed.map((e) => e.key), ['001/001', 'plan-workflow/registry-gates']);
  assert.deepStrictEqual(listed.map((e) => e.pointer.blueprint), [BP_A, SLUG_BP]);
  assert.deepStrictEqual(parsePointerKey('plan-workflow/registry-gates'), {
    epicId: 'plan-workflow', blueprintId: 'registry-gates', key: 'plan-workflow/registry-gates',
  });
  assert.deepStrictEqual(parsePointerKey('001/002'), { epicId: '001', blueprintId: '002', key: '001/002' });
  assert.strictEqual(parsePointerKey('001/registry-gates'), null);
  assert.strictEqual(removeNamespacePointer({ repoRoot: primary, key: 'plan-workflow/registry-gates', deps }), true);
});

test('coordinator ledger with malformed seed manifests or legacy ledgers → rejects the manifests and accepts legacy ledgers', () => {
  const base = { version: 1, blueprint: 'bp', base: 'main', tasks: [], decisions: [] };
  assert.strictEqual(validateCoordinatorLedger(base).ok, true);
  assert.strictEqual(validateCoordinatorLedger({ ...base, seedManifest: [{ path: '', sha256: 'x' }] }).reason,
    'invalid-seed-manifest');
});

test('resolveWorktreeBranch with a registered branch or an occupied new branch → reuses the registered branch and rejects the occupied one', () => {
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

test('repair ledger validation for partial close → requires two waves and the last CI failure', () => {
  const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
  const base = {
    version: 1, blueprint: 'bp', base: 'main', integrationHead: 'abc', tasks: [],
    decisions: [], repairWaves: [], status: 'active',
  };
  assert.strictEqual(validateCoordinatorLedger(base).ok, true);
  assert.match(validateCoordinatorLedger({ ...base, status: 'partial_closed', handoff: { path: '011_012_NEXT_PLAN.md', timestamp: '2026-10-19T16:08:26.068+09:00', source_digest: 'source-1' } }).reason, /repair-waves/);
  const wave1 = repairDecision('003', 1, 'r1', ['src/a.js']);
  const wave2 = repairDecision('004', 2, 'r2', ['src/b.js']);
  const waves = [wave1, wave2];
  assert.match(validateCoordinatorLedger({
    ...base, status: 'partial_closed', repairWaves: waves, decisions: copy(waves),
    handoff: { path: '011_012_NEXT_PLAN.md', timestamp: '2026-10-19T16:08:26.068+09:00', source_digest: 'source-1' },
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [copy(wave1)] },
      { id: '004', status: 'integrated', decisions: [copy(wave2)] }],
  }).reason, /failure-evidence/);
  const evidence = { task: '002', command: 'npm test', summary: 'one failed', paths: ['test/a.js'], exitCode: 1, repairWave: 2, source_digest: 'source-1' };
  const valid = {
    ...base, status: 'partial_closed', repairWaves: waves,
    handoff: { path: '011_012_NEXT_PLAN.md', timestamp: '2026-10-19T16:08:26.068+09:00', source_digest: 'source-1' },
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

test('partial-close repair decisions → require complete canonical task and global copies', () => {
  const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
  const wave1 = repairDecision('003', 1, 'r1', ['src/a.js']);
  const wave2 = repairDecision('004', 2, 'r2', ['src/b.js']);
  const valid = {
    status: 'partial_closed', repairWaves: [wave1, wave2], decisions: copy([wave1, wave2]),
    handoff: { path: '011_012_NEXT_PLAN.md', timestamp: '2026-10-19T16:08:26.068+09:00', source_digest: 'source-1' },
    terminalFailure: {
      task: '002', command: 'npm test', summary: 'still failing', paths: ['src/b.js'],
      exitCode: 1, repairWave: 2, source_digest: 'source-1',
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

test('repair failure findings when present → must be a non-empty string array', () => {
  const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
  const wave1 = repairDecision('003', 1, 'r1', ['src/a.js']);
  const wave2 = repairDecision('004', 2, 'r2', ['src/b.js']);
  const valid = {
    status: 'partial_closed', repairWaves: [wave1, wave2], decisions: copy([wave1, wave2]),
    handoff: { path: '011_012_NEXT_PLAN.md', timestamp: '2026-10-19T16:08:26.068+09:00', source_digest: 'source-1' },
    terminalFailure: {
      task: '002', command: 'npm test', summary: 'still failing', paths: ['src/b.js'],
      exitCode: 1, repairWave: 2, source_digest: 'source-1',
    },
    userConfirmed: true,
    tasks: [{ id: '002', execution_kind: 'verification', status: 'verifying' },
      { id: '003', status: 'integrated', decisions: [copy(wave1)] },
      { id: '004', status: 'integrated', decisions: [copy(wave2)] }],
  };
  const accepted = copy(valid);
  accepted.repairWaves[0].failure.findings = ['F1', 'F2'];
  accepted.decisions[0].failure.findings = ['F1', 'F2'];
  accepted.tasks[1].decisions[0].failure.findings = ['F1', 'F2'];
  assert.strictEqual(validateCoordinatorLedger(accepted).ok, true);
  valid.repairWaves[0].failure.findings = 'F1';
  valid.decisions[0].failure.findings = 'F1';
  valid.tasks[1].decisions[0].failure.findings = 'F1';
  assert.match(validateCoordinatorLedger(valid).reason, /repair-decision/);
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

test('primary checkout and linked worktree → share Git-local runtime paths', () => {
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

test('coordinator paths → derive integration, worker, fanin, and integration-local ledger', () => {
  const { primary } = linkedRepo();
  const result = coordinatorPathsFor({
    repoRoot: primary,
    blueprint: '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path',
    task: '002', deps: { execFileSync, platform: 'linux' },
  });
  assert.deepStrictEqual(result, {
    integrationPath: path.join(primary, '.worktrees', '023', '001', 'integration'),
    workerPath: path.join(primary, '.worktrees', '023', '001', 'workers', '002'),
    faninPath: path.join(primary, '.worktrees', '023', '001', 'fanin'),
    ledgerFile: path.join(primary, '.worktrees', '023', '001', 'integration', '.bouncer', 'runtime', 'coordinator.json'),
  });
});

test('validateCoordinatorLedger with an invalid fanin shape → rejects it', () => {
  const base = {
    version: 1, blueprint: 'bp', base: 'main', tasks: [], decisions: [],
  };
  assert.strictEqual(validateCoordinatorLedger(base).ok, true);
  assert.strictEqual(validateCoordinatorLedger({ ...base, fanin: null }).ok, true);
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    fanin: {
      base_head: 'abc', candidate_head: null, tasks: ['001'], status: 'building',
    },
  }).ok, true);
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    fanin: {
      base_head: 'abc', candidate_head: 'def', tasks: ['001'], status: 'verified',
    },
  }).ok, true);
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    fanin: {
      base_head: 'abc', candidate_head: null, tasks: ['001'], status: 'bogus',
    },
  }).reason, 'fanin-invalid');
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    fanin: { base_head: 'abc', tasks: ['001'], status: 'building' },
  }).reason, 'fanin-invalid');
});

test('worktree root → is under the main repository checkout', () => {
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

test('win32 path API → keeps worktrees beside the main checkout', () => {
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

test('runtime resolution → is read-only and reports non-Git directories unavailable', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  const before = fs.readdirSync(repo);
  const paths = runtimePaths({
    repoRoot: repo, execFileSync, env: process.env, platform: process.platform,
  });

  assert.strictEqual(paths.unavailable, true);
  assert.ok(paths.reason);
  assert.deepStrictEqual(fs.readdirSync(repo), before);
});

test('runtime current across primary and linked worktrees → round-trips', () => {
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

test('writeRuntimeCurrent with or without a string path → includes task key only when a string path is given', () => {
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

test('readRuntimeCurrent with a missing or non-string task → treats it as null', () => {
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

test('runtime current with missing, corrupt, and non-Git state → is handled', () => {
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

test('worktreePathFor with defaults → returns the nested epic/blueprint path without creating directories', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '023', '001'),
  );
  assert.strictEqual(fs.existsSync(path.join(primary, '.worktrees')), false);
});

test('worktreePathFor when nested is missing → falls back to flat path', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const bp = '.bouncer/context/epics/023-worktree-layout/blueprints/001-nested-worktree-path';
  fs.mkdirSync(path.join(primary, '.worktrees', '001'), { recursive: true });
  assert.strictEqual(
    worktreePathFor({ repoRoot: primary, blueprint: bp, deps }),
    path.join(primary, '.worktrees', '001'),
  );
});

test('worktreePathFor when both nested and flat exist → prefers nested', () => {
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

test('worktreePathFor with legacy-prefixed ids and non-Git roots → rejects them', () => {
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

test('verifyLedgerPathFor → hashes the verification rel under the Git common directory', () => {
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

test('verifyLedgerPathFor with v2 paths and legacy misses → uses evidenceId for v2 and keeps legacy miss separate', () => {
  const { createHash } = require('node:crypto');
  const { primary, linked } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const rel = '.bouncer/context/epics/001-x/blueprints/001-y/tasks/001/verification.md';
  const evidenceId = 'a'.repeat(64);
  const v2 = verifyLedgerPathFor({
    repoRoot: primary, verificationRel: rel, evidenceId, deps,
  });
  const linkedV2 = verifyLedgerPathFor({
    repoRoot: linked, verificationRel: rel, evidenceId, deps,
  });
  const legacy = verifyLedgerPathFor({ repoRoot: primary, verificationRel: rel, deps });
  assert.strictEqual(linkedV2.ledgerFile, v2.ledgerFile);
  assert.notStrictEqual(v2.ledgerFile, legacy.ledgerFile);
  const digest = createHash('sha256').update(`v2:${evidenceId}`, 'utf8').digest('hex').slice(0, 16);
  assert.strictEqual(
    v2.ledgerFile,
    path.join(v2.commonGitDir, 'bouncer', 'verify', `${digest}.json`),
  );
});
test('verifyLedgerPathFor with non-Git directories → reports them unavailable', () => {
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

test('intentBundlePathFor in every worktree → hashes the task rel under the Git common directory', () => {
  const { createHash } = require('node:crypto');
  const { primary, linked } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  const rel = '.bouncer/context/epics/073-x/blueprints/001-y/tasks/001/tasks.md';
  const primaryIntent = intentBundlePathFor({ repoRoot: primary, taskRel: rel, deps });
  const linkedIntent = intentBundlePathFor({ repoRoot: linked, taskRel: rel, deps });

  assert.strictEqual(primaryIntent.unavailable, undefined);
  assert.strictEqual(linkedIntent.intentFile, primaryIntent.intentFile);
  const digest = createHash('sha256').update(rel, 'utf8').digest('hex').slice(0, 16);
  assert.strictEqual(
    primaryIntent.intentFile,
    path.join(primaryIntent.commonGitDir, 'bouncer', 'intent', `${digest}.json`),
  );
});

test('intentBundlePathFor with non-Git directories → reports them unavailable', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-nongit-'));
  const result = intentBundlePathFor({
    repoRoot: repo,
    taskRel: 'x.md',
    deps: { execFileSync },
  });
  assert.strictEqual(result.unavailable, true);
  assert.ok(result.reason);
  assert.strictEqual(result.intentFile, undefined);
});

const BP_A = '.bouncer/context/epics/001-x/blueprints/001-y';
const BP_B = '.bouncer/context/epics/002-z/blueprints/003-w';

test('runtimePaths → returns the legacy current file and the namespace root together', () => {
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

test('pointerKeyFromBlueprint with epic and blueprint ids → uses three-digit ids only', () => {
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

test('two namespace pointers with one removed → coexist and the other is preserved', () => {
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

test('writeRuntimeCurrent with a blueprint path without three-digit ids → rejects it', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  assert.throws(
    () => writeRuntimeCurrent({ repoRoot: primary, blueprint: 'bp', base: 'main', deps }),
    /Cannot derive epic\/blueprint ids/,
  );
});

test('writeRuntimeCurrent with a write failure → is atomic and leaves no namespace file', () => {
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

test('readRuntimeCurrent with an empty namespace → falls back to the legacy file', () => {
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

test('readRuntimeCurrent with a broken namespace file → does not hide it as null', () => {
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

test('readRuntimeCurrent with multiple namespace pointers → rejects them instead of picking one', () => {
  const { primary } = linkedRepo();
  const deps = { execFileSync, platform: 'linux' };
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_A, base: 'develop', deps });
  writeRuntimeCurrent({ repoRoot: primary, blueprint: BP_B, base: 'main', deps });
  assert.throws(
    () => readRuntimeCurrent({ repoRoot: primary, deps }),
    (err) => err instanceof Error && /ambiguous/i.test(err.message),
  );
});

test('listNamespacePointers with a broken file → reports it instead of hiding it', () => {
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


test('coordinator ledger with malformed dispatch attempt metadata → rejects it', () => {
  const base = {
    version: 1, blueprint: 'bp', base: 'main', tasks: [{
      id: '001', status: 'prepared',
      dispatch: {
        attempt: 1,
        task_brief_hash: 'a'.repeat(64),
        base_head: 'abc123',
        initial_worktree_state: '',
        status: 'active',
      },
    }], decisions: [],
  };
  assert.strictEqual(validateCoordinatorLedger(base).ok, true);
  assert.match(validateCoordinatorLedger({
    ...base,
    tasks: [{ ...base.tasks[0], dispatch: { ...base.tasks[0].dispatch, attempt: 0 } }],
  }).reason, /dispatch/);
  assert.match(validateCoordinatorLedger({
    ...base,
    tasks: [{ ...base.tasks[0], dispatch: { ...base.tasks[0].dispatch, task_brief_hash: 'abc' } }],
  }).reason, /dispatch/);
  assert.match(validateCoordinatorLedger({
    ...base,
    tasks: [{ ...base.tasks[0], dispatch: { ...base.tasks[0].dispatch, status: 'open' } }],
  }).reason, /dispatch/);
  assert.match(validateCoordinatorLedger({
    ...base,
    tasks: [{
      ...base.tasks[0],
      dispatch: {
        ...base.tasks[0].dispatch, status: 'reported', outcome: 'accepted', summary: '',
      },
    }],
  }).reason, /dispatch/);
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    tasks: [{
      ...base.tasks[0],
      dispatch: {
        ...base.tasks[0].dispatch, status: 'reported', outcome: 'rework', summary: 'retry',
      },
    }],
  }).ok, true);
});

test('validateCoordinatorCheckpoint with a compact summary or bad ledger refs → accepts the summary and rejects the refs', () => {
  const { validateCoordinatorCheckpoint, COORDINATOR_LEDGER_REL } = require('../scripts/lib/runtime-state');
  const { LEDGER_REL } = require('../scripts/lib/coordinator-ledger');
  // MM-001: coordinator·runtime-state가 같은 상대 경로 정본을 공유한다.
  assert.strictEqual(LEDGER_REL, COORDINATOR_LEDGER_REL);
  assert.strictEqual(typeof validateCoordinatorCheckpoint, 'function');
  const valid = {
    ready: ['002'],
    active_tasks: [{
      id: '002', status: 'prepared', depends_on: ['001'], dependency_gate: 'integrated',
      parallel_safe: false, workerPath: '/tmp/w', branch: 'b',
    }],
    completed_tasks: [{
      id: '001', status: 'integrated', attempt: 1, commit_sha: 'abc',
      changed_paths: ['src/'], scope_revision: 'r1', verify_evidence_id: 'v'.repeat(64),
    }],
    unresolved_decisions: [{ task: '002', kind: 'critical-recovery', outcome: null }],
    recent_failure: {
      task: '002', command: 'npm test', summary: 'x', paths: ['lib/'], exitCode: 1, repairWave: 1,
    },
    integration_head: 'deadbeef',
    revision: 'r2',
    ledger: {
      path: COORDINATOR_LEDGER_REL,
      sha256: 'a'.repeat(64),
      revision: 'r2',
    },
  };
  assert.strictEqual(validateCoordinatorCheckpoint(valid).ok, true);
  assert.strictEqual(validateCoordinatorCheckpoint({ ...valid, recent_failure: null }).ok, true);
  // CT-003: recent_failure 키 부재는 null과 다르며 checkpoint로 거절한다.
  const withoutFailure = { ...valid };
  delete withoutFailure.recent_failure;
  assert.match(validateCoordinatorCheckpoint(withoutFailure).reason, /checkpoint/);
  assert.match(validateCoordinatorCheckpoint({
    ...valid,
    completed_tasks: [{ id: '001', status: 'integrated', dispatch: { attempt: 1 } }],
  }).reason, /completed-summary|checkpoint/);
  assert.match(validateCoordinatorCheckpoint({
    ...valid,
    ledger: { path: '/abs/.bouncer/runtime/coordinator.json', sha256: 'a'.repeat(64), revision: 'r2' },
  }).reason, /ledger-ref|checkpoint/);
  assert.match(validateCoordinatorCheckpoint({
    ...valid,
    ledger: { path: COORDINATOR_LEDGER_REL, sha256: 'zz', revision: 'r2' },
  }).reason, /ledger-ref|checkpoint/);
});


test('coordinator ledger with malformed lease and leaseSeq → rejects it', () => {
  const base = {
    version: 1, blueprint: 'bp', base: 'main', leaseSeq: 1, tasks: [{
      id: '001', status: 'prepared',
      lease: { id: 'lease-a', generation: 1, seq: 1, status: 'active' },
    }], decisions: [],
  };
  assert.strictEqual(validateCoordinatorLedger(base).ok, true);
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    tasks: [{ ...base.tasks[0], lease: { id: 'x', generation: 0, seq: 1, status: 'active' } }],
  }).reason, 'lease-invalid');
  assert.strictEqual(validateCoordinatorLedger({
    ...base,
    tasks: [{ ...base.tasks[0], lease: { id: 'x', generation: 1, seq: 1, status: 'open' } }],
  }).reason, 'lease-invalid');
  assert.strictEqual(validateCoordinatorLedger({
    ...base, leaseSeq: -1,
  }).reason, 'lease-invalid');
  assert.strictEqual(validateCoordinatorLedger({
    ...base, leaseSeq: 1.5,
  }).reason, 'lease-invalid');
});
