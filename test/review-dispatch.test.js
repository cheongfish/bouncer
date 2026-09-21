'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const {
  classifyPlanReview,
  classifyExecuteReview,
  PLAN_SMALL_MAX_TASKS,
  EXECUTE_SMALL_MAX_FILES,
  EXECUTE_SMALL_MAX_LINES,
} = require('../scripts/lib/review-dispatch');

const EPIC_REL = '.bouncer/context/epics/001-auth';
const BP_REL = `${EPIC_REL}/blueprints/001-login`;

function gitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeBundleIndex(repo, epicDirs = ['001-auth']) {
  const lines = epicDirs.map((d) => {
    const m = d.match(/^(\d{3})-(.+)$/);
    // S13는 index summary와 epic frontmatter description이 같아야 한다.
    // fixture description은 항상 'd'로 맞춘다.
    return `* [${m[1]} ${m[2]}](epics/${d}/index.md) - d`;
  });
  const abs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\nokf_version: "0.1"\n---\n# Epics\n\n${lines.join('\n')}\n`);
}

function taskBody({ interfaceText, touchText }) {
  return `# Tasks

## Goal & intent
Ship the change.

## Current behavior
None.

## Target behavior
Done.

## Interface
${interfaceText}

## Touch
${touchText}

## Do not touch
- \`other/keep.ts\`

## Constraints
Keep scope tight.

## Checklist
- [ ] red
`;
}

function writeCommitTask(repo, number, {
  interfaceText = '- `sharedFn`\n',
  touchText = '- `src/a.ts`\n',
  reviewRisk,
  status = 'ready',
  dependsOn = [],
  affectedPaths = [`src/t${number}.ts`],
} = {}) {
  const dir = `${BP_REL}/tasks/${number}`;
  const bouncer = {
    id: `TASKS-${number}`,
    epic_id: '001',
    blueprint_id: '001',
    status,
    execution_kind: 'commit',
    affected_paths: affectedPaths,
    depends_on: dependsOn,
    parallel_safe: false,
    dependency_gate: 'integrated',
  };
  if (reviewRisk !== undefined) bouncer.review_risk = reviewRisk;
  writeDoc(repo, `${dir}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Task ${number}`,
    description: 'd',
    resource: `${dir}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer,
  }, taskBody({ interfaceText, touchText }));
  writeDoc(repo, `${dir}/verification.md`, {
    type: 'bouncer.verification',
    title: 'v',
    description: 'd',
    resource: `${dir}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${number}`, epic_id: '001', blueprint_id: '001', status: 'pending',
    },
  });
  writeDoc(repo, `${dir}/review.md`, {
    type: 'bouncer.review',
    title: 'r',
    description: 'd',
    resource: `${dir}/review.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `REVIEW-${number}`, epic_id: '001', blueprint_id: '001', status: 'pending',
      review: { required: true },
    },
  });
}

function writeVerificationTask(repo, number, { dependsOn = ['TASKS-001'] } = {}) {
  const dir = `${BP_REL}/tasks/${number}`;
  writeDoc(repo, `${dir}/tasks.md`, {
    type: 'bouncer.tasks',
    title: `Verify ${number}`,
    description: 'd',
    resource: `${dir}/tasks.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${number}`,
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      execution_kind: 'verification',
      affected_paths: [],
      depends_on: dependsOn,
      parallel_safe: false,
      dependency_gate: 'integrated',
      verify: 'node --test',
    },
  }, '# Verification node\n');
  writeDoc(repo, `${dir}/verification.md`, {
    type: 'bouncer.verification',
    title: 'v',
    description: 'd',
    resource: `${dir}/verification.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `VERIFY-${number}`, epic_id: '001', blueprint_id: '001', status: 'pending',
    },
  });
}

function writePlanTree(repo, { scale = 'full', tasks = ['001'] } = {}) {
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic',
    title: 'Auth',
    description: 'd',
    resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth epic\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint',
    title: 'Login',
    description: 'd',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale,
    },
  }, '# Login blueprint\n');
  for (const number of tasks) {
    if (number === '003' && scale === 'full') {
      // optional verification slot filled by callers
    }
    writeCommitTask(repo, number, {
      dependsOn: number === '001' ? [] : ['TASKS-001'],
      interfaceText: number === '002'
        ? '- `sharedFn`\n- `classifyPlanReview`\n'
        : '- `sharedFn`\n',
      touchText: number === '002'
        ? '- `src/shared.ts`\n- `src/b.ts`\n'
        : '- `src/shared.ts`\n- `src/a.ts`\n',
      affectedPaths: [`src/t${number}.ts`],
    });
  }
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-review-dispatch-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', 'README']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function expectedDigest(repo) {
  const parts = [
    `${EPIC_REL}/index.md`,
    `${BP_REL}/index.md`,
  ];
  const tasksRoot = path.join(repo, BP_REL, 'tasks');
  if (fs.existsSync(tasksRoot)) {
    for (const name of fs.readdirSync(tasksRoot).sort()) {
      if (!/^\d{3}$/.test(name)) continue;
      parts.push(`${BP_REL}/tasks/${name}/tasks.md`);
    }
  }
  const hash = crypto.createHash('sha256');
  for (const rel of parts) {
    const raw = fs.readFileSync(path.join(repo, rel), 'utf8');
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
    hash.update(body);
  }
  return { digest: hash.digest('hex'), documents: parts };
}

test('size constants are exported from one module', () => {
  assert.strictEqual(PLAN_SMALL_MAX_TASKS, 1);
  assert.strictEqual(EXECUTE_SMALL_MAX_FILES, 3);
  assert.strictEqual(EXECUTE_SMALL_MAX_LINES, 200);
});

test('plan light scale returns skip without perspectives', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'light', tasks: ['001'] });
  const before = git(repo, ['status', '--porcelain']);
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.phase, 'plan');
  assert.strictEqual(result.strategy, 'skip');
  assert.deepStrictEqual(result.perspectives, []);
  assert.strictEqual(result.task_count, 1);
  assert.strictEqual(git(repo, ['status', '--porcelain']), before);
});

test('plan single commit task returns combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  writeVerificationTask(repo, '002', { dependsOn: ['TASKS-001'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.strictEqual(result.task_count, 1);
  assert.deepStrictEqual(result.perspectives, ['combined']);
  const expected = expectedDigest(repo);
  assert.strictEqual(result.target.digest, expected.digest);
  assert.deepStrictEqual(result.target.documents, expected.documents);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0);
});

test('plan two overlapping tasks returns clustered local+global', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001', '002'] });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'clustered');
  assert.strictEqual(result.task_count, 2);
  assert.strictEqual(result.clusters.length, 1);
  assert.deepStrictEqual(result.clusters[0].tasks, ['TASKS-001', 'TASKS-002']);
  assert.ok(result.clusters[0].interface_keys.includes('sharedFn'));
  assert.ok(result.clusters[0].touch_paths.some((p) => p.includes('shared')));
  assert.deepStrictEqual(result.perspectives, ['local', 'global']);
});

test('plan two non-overlapping tasks still get local clusters plus global', () => {
  const repo = makeRepo();
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale: 'full',
    },
  }, '# Login\n');
  writeCommitTask(repo, '001', {
    interfaceText: '- `alphaOnly`\n',
    touchText: '- `src/alpha.ts`\n',
  });
  writeCommitTask(repo, '002', {
    dependsOn: ['TASKS-001'],
    interfaceText: '- `betaOnly`\n',
    touchText: '- `src/beta.ts`\n',
  });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'clustered');
  assert.strictEqual(result.clusters.length, 2);
  assert.deepStrictEqual(result.perspectives, ['local', 'local', 'global']);
});

test('plan empty Interface rejects without perspectives', () => {
  const repo = makeRepo();
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale: 'full',
    },
  }, '# Login\n');
  writeCommitTask(repo, '001', { interfaceText: '\n', touchText: '- `src/a.ts`\n' });
  const result = classifyPlanReview({ repoRoot: repo, blueprintDir: BP_REL });
  assert.strictEqual(result.ok, false);
  assert.ok(!('perspectives' in result) || result.perspectives === undefined);
});

test('execute small diff returns single combined', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(repo, 'src/b.ts'), 'export const b = 1;\n');
  git(repo, ['add', 'src/a.ts', 'src/b.ts']);
  git(repo, ['commit', '-qm', 'change']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'single');
  assert.ok(result.changed_files <= EXECUTE_SMALL_MAX_FILES);
  assert.ok(result.changed_lines <= EXECUTE_SMALL_MAX_LINES);
  assert.deepStrictEqual(result.risk_flags, []);
  assert.deepStrictEqual(result.perspectives, ['combined']);
  assert.deepStrictEqual(result.target, { base, head, task: '001' });
});

test('execute over file threshold returns parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.strategy, 'parallel');
  assert.ok(result.changed_files > EXECUTE_SMALL_MAX_FILES);
  assert.deepStrictEqual(result.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability',
  ]);
});

test('execute risk flags append security on single and parallel', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  writeCommitTask(repo, '001', { reviewRisk: ['public_interface'] });
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src/a.ts']);
  git(repo, ['commit', '-qm', 'small risk']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const small = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(small.ok, true);
  assert.strictEqual(small.strategy, 'single');
  assert.deepStrictEqual(small.risk_flags, ['public_interface']);
  assert.deepStrictEqual(small.perspectives, ['combined', 'security']);

  // CT-003: 제목이 single·parallel 둘 다인데 parallel+security를 빠뜨리면
  // append 분기가 한쪽만 깨져도 통과한다.
  for (const name of ['a', 'b', 'c', 'd']) {
    fs.writeFileSync(path.join(repo, `src/${name}.ts`), `export const ${name} = 1;\n`);
  }
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-qm', 'many files risk']);
  const parallelHead = git(repo, ['rev-parse', 'HEAD']).trim();
  const parallel = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head: parallelHead,
  });
  assert.strictEqual(parallel.ok, true);
  assert.strictEqual(parallel.strategy, 'parallel');
  assert.deepStrictEqual(parallel.risk_flags, ['public_interface']);
  assert.deepStrictEqual(parallel.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability', 'security',
  ]);
});

test('execute rejects non-canonical blueprintDir escape without perspectives', () => {
  // SEC-001: Plan은 validateBlueprint/isCanonicalBlueprintDir로 ../ 를 막지만
  // Execute가 path.join만 하면 repo 밖 tasks.md의 review_risk로 security를 연다.
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const outsideRoot = path.join(path.dirname(repo), `${path.basename(repo)}-outside`);
  fs.mkdirSync(path.join(outsideRoot, 'tasks', '001'), { recursive: true });
  writeDoc(outsideRoot, 'tasks/001/tasks.md', {
    type: 'bouncer.tasks',
    title: 'Escaped',
    description: 'd',
    resource: 'tasks/001/tasks.md',
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      execution_kind: 'commit',
      affected_paths: ['src/a.ts'],
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
      review_risk: ['authentication'],
    },
  }, taskBody({ interfaceText: '- `x`\n', touchText: '- `src/a.ts`\n' }));
  const escaped = classifyExecuteReview({
    repoRoot: repo,
    blueprintDir: '../' + path.basename(outsideRoot),
    taskId: '001',
    base: 'HEAD',
    head: 'HEAD',
    exec: (file, args) => {
      assert.strictEqual(file, 'git');
      if (args[0] === 'rev-parse') return 'abc\n';
      if (args[0] === 'diff') return '1\t1\tsrc/a.ts\n';
      throw new Error(`unexpected git ${args.join(' ')}`);
    },
  });
  assert.strictEqual(escaped.ok, false);
  assert.ok(!('perspectives' in escaped) || escaped.perspectives === undefined);
  const planSame = classifyPlanReview({
    repoRoot: repo,
    blueprintDir: '../' + path.basename(outsideRoot),
  });
  assert.strictEqual(planSame.ok, false);
});

test('execute review_risk S30 rejects without perspectives', () => {
  // CT-001: Execute의 readReviewRisk S30 세 갈래는 Plan structural만으로는 회귀가 안 잡힌다.
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const cases = [
    { reviewRisk: 'public_interface', error: /S30 review_risk must be an array/ },
    { reviewRisk: ['mystery'], error: /S30 review_risk value invalid/ },
    { reviewRisk: ['public_interface', 'public_interface'], error: /S30 review_risk duplicate/ },
  ];
  for (const { reviewRisk, error } of cases) {
    writeCommitTask(repo, '001', { reviewRisk });
    const result = classifyExecuteReview({
      repoRoot: repo,
      blueprintDir: BP_REL,
      taskId: '001',
      base: 'HEAD',
      head: 'HEAD',
      exec: (file, args) => {
        assert.strictEqual(file, 'git');
        if (args[0] === 'rev-parse') return 'abc\n';
        if (args[0] === 'diff') return '1\t1\tsrc/a.ts\n';
        throw new Error(`unexpected git ${args.join(' ')}`);
      },
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.error, error);
    assert.ok(!('perspectives' in result) || result.perspectives === undefined);
  }
});

test('execute lines-only breach returns parallel', () => {
  // CT-002: 파일 ≤3이어도 줄 합계 >200이면 parallel. 파일 임계만 보면 분기 한쪽이 빠진다.
  const lines = Array.from({ length: EXECUTE_SMALL_MAX_LINES + 1 }, (_, i) => `// ${i}`).join('\n') + '\n';
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), lines);
  fs.writeFileSync(path.join(repo, 'src/b.ts'), 'export const b = 1;\n');
  git(repo, ['add', 'src/a.ts', 'src/b.ts']);
  git(repo, ['commit', '-qm', 'many lines']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const result = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001', base, head,
  });
  assert.strictEqual(result.ok, true);
  assert.ok(result.changed_files <= EXECUTE_SMALL_MAX_FILES);
  assert.ok(result.changed_lines > EXECUTE_SMALL_MAX_LINES);
  assert.strictEqual(result.strategy, 'parallel');
  assert.deepStrictEqual(result.perspectives, [
    'spec_scope', 'correctness_tests', 'minimality_maintainability',
  ]);
});

test('execute binary row counts as file but not lines and does not force parallel', () => {
  const numstat = '1\t1\tsrc/a.ts\n-\t-\tassets/logo.png\n';
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const result = classifyExecuteReview({
    repoRoot: repo,
    blueprintDir: BP_REL,
    taskId: '001',
    base: 'base',
    head: 'head',
    exec: (file, args) => {
      assert.strictEqual(file, 'git');
      if (args[0] === 'rev-parse') return `${args[2]}\n`;
      if (args[0] === 'diff' && args.includes('--numstat')) return numstat;
      throw new Error(`unexpected git ${args.join(' ')}`);
    },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.changed_files, 2);
  assert.strictEqual(result.changed_lines, 2);
  assert.strictEqual(result.strategy, 'single');
});

test('execute unknown task and bad ref fail without perspectives', () => {
  const repo = makeRepo();
  writePlanTree(repo, { tasks: ['001'] });
  const missing = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '099', base: 'HEAD', head: 'HEAD',
  });
  assert.strictEqual(missing.ok, false);
  assert.ok(!('perspectives' in missing) || missing.perspectives === undefined);

  writeVerificationTask(repo, '002');
  const nonCommit = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '002', base: 'HEAD', head: 'HEAD',
  });
  assert.strictEqual(nonCommit.ok, false);

  const badRef = classifyExecuteReview({
    repoRoot: repo, blueprintDir: BP_REL, taskId: '001',
    base: 'not-a-real-ref', head: 'also-missing',
  });
  assert.strictEqual(badRef.ok, false);
});

test('CLI review-dispatch plan and execute emit JSON exit contracts', () => {
  const repo = makeRepo();
  writePlanTree(repo, { scale: 'full', tasks: ['001'] });
  const plan = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(plan.code, 0);
  assert.strictEqual(plan.err, '');
  const planJson = JSON.parse(plan.out);
  assert.strictEqual(planJson.ok, true);
  assert.strictEqual(planJson.strategy, 'single');

  // CT-004: execute 성공(exit 0 + Execute JSON)과 분류 실패(exit 1 + ok:false)를
  // plan-only·argv exit 2만으로 대체하지 않는다.
  const base = git(repo, ['rev-parse', 'HEAD']).trim();
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  git(repo, ['add', 'src/a.ts']);
  git(repo, ['commit', '-qm', 'cli execute']);
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const executeOk = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '001', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  assert.strictEqual(executeOk.code, 0);
  assert.strictEqual(executeOk.err, '');
  const executeJson = JSON.parse(executeOk.out);
  assert.strictEqual(executeJson.ok, true);
  assert.strictEqual(executeJson.phase, 'execute');
  assert.strictEqual(executeJson.strategy, 'single');
  assert.deepStrictEqual(executeJson.perspectives, ['combined']);

  const executeFail = capture([
    'review-dispatch', 'execute',
    '--blueprint', BP_REL, '--task', '099', '--base', base, '--head', head,
    '--repo', repo,
  ]);
  assert.strictEqual(executeFail.code, 1);
  const failJson = JSON.parse(executeFail.out);
  assert.strictEqual(failJson.ok, false);
  assert.ok(!('perspectives' in failJson) || failJson.perspectives === undefined);

  const usage = capture(['review-dispatch']);
  assert.strictEqual(usage.code, 2);
  assert.match(usage.err, /review-dispatch/);
  assert.strictEqual(usage.out, '');

  const bad = capture([
    'review-dispatch', 'execute', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(bad.code, 2);
  assert.match(bad.err, /--task|--base|--head/);
});

test('CLI plan structural failure exits 1 without reviewer list', () => {
  const repo = makeRepo();
  writeBundleIndex(repo);
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: 'approved', scale: 'full',
    },
  }, '# Login\n');
  writeCommitTask(repo, '001', { reviewRisk: 'public_interface' });
  const result = capture([
    'review-dispatch', 'plan', '--blueprint', BP_REL, '--repo', repo,
  ]);
  assert.strictEqual(result.code, 1);
  const payload = JSON.parse(result.out);
  assert.strictEqual(payload.ok, false);
  assert.ok(!('perspectives' in payload) || payload.perspectives === undefined);
});
