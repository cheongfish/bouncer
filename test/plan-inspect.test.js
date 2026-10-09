'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent } = require('../scripts/lib/current');

const EPICS = '.bouncer/context/epics';

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

function mkdirp(repo, rel) {
  fs.mkdirSync(path.join(repo, rel), { recursive: true });
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-inspect-')));
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

function inspect(repo, extra = []) {
  return capture(['plan', 'inspect', '--repo', repo, ...extra]);
}

function parsePayload(result) {
  assert.ok(result.out.trim(), `expected stdout JSON, stderr=${result.err}`);
  return JSON.parse(result.out);
}

function writeIdTree(repo) {
  mkdirp(repo, `${EPICS}/001-a`);
  mkdirp(repo, `${EPICS}/003-b/blueprints/001-x`);
  mkdirp(repo, `${EPICS}/003-b/blueprints/002-y`);
  mkdirp(repo, `${EPICS}/003-b/blueprints/BP-009`);
  mkdirp(repo, `${EPICS}/EPIC-009`);
  writeDoc(repo, `${EPICS}/003-b/index.md`, {
    type: 'bouncer.epic', title: 'B', description: 'd', resource: `${EPICS}/003-b/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '003', epic_id: '003', status: 'approved' },
  });
  fs.writeFileSync(path.join(repo, 'Makefile'), 'test:\n\t@echo ok\n');
  fs.writeFileSync(path.join(repo, 'package.json'), `${JSON.stringify({ scripts: { test: 'node --test' } })}\n`);
}

test('plan inspect allocates the next epic id from \\d{3}-slug dirs only', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.nextEpicId, '004');
  assert.strictEqual(payload.epic, null);
  assert.strictEqual(payload.maintenanceEpic, null);
  assert.deepStrictEqual(payload.verifySignals, ['Makefile', 'package.json#scripts']);
  assert.strictEqual(payload.current.status, 'empty');
  assert.strictEqual(payload.current.blueprint, null);
  assert.strictEqual(payload.current.task, null);
  assert.strictEqual(payload.current.base, null);
});

test('plan inspect maps a single namespace pointer to selected blueprint/task/base', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  // inspect는 resolveCurrent를 deps 없이 부르므로, 픽스처도 같은 git-common-dir
  // namespace에 쓴다. `current --set`은 plan 게이트를 타서 JSON 매핑만 보려는
  // 이 테스트와 섞인다.
  const blueprint = `${EPICS}/003-b/blueprints/001-x`;
  const task = `${blueprint}/tasks/001/tasks.md`;
  const base = 'main';
  writeCurrent({ repoRoot: repo, blueprint, base, task });

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.current.status, 'selected');
  assert.strictEqual(payload.current.blueprint, blueprint);
  assert.strictEqual(payload.current.task, task);
  assert.strictEqual(payload.current.base, base);
});

test('plan inspect maps multiple namespace pointers to ambiguous with empty fields', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  // 기준 checkout에서 키가 둘이면 resolveCurrent는 ambiguous다. inspect는
  // 후보를 고르지 않으므로 blueprint/task/base를 비운다 — 스킬이 status만
  // 보고 멈추게 하려는 공개 JSON 계약.
  writeCurrent({
    repoRoot: repo,
    blueprint: `${EPICS}/003-b/blueprints/001-x`,
    base: 'develop',
  });
  writeCurrent({
    repoRoot: repo,
    blueprint: `${EPICS}/003-b/blueprints/002-y`,
    base: 'main',
  });

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.current.status, 'ambiguous');
  assert.strictEqual(payload.current.blueprint, null);
  assert.strictEqual(payload.current.task, null);
  assert.strictEqual(payload.current.base, null);
});

test('plan inspect fills epic.nextBlueprintId for --epic-dir and ignores BP- prefixes', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  const epicDir = `${EPICS}/003-b`;

  const result = inspect(repo, ['--epic-dir', epicDir]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.nextEpicId, '004');
  assert.strictEqual(payload.epic.dir, epicDir);
  assert.strictEqual(payload.epic.status, 'approved');
  assert.strictEqual(payload.epic.nextBlueprintId, '003');
});

test('plan inspect reports maintenanceEpic.id when a maintenance slug exists', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  mkdirp(repo, `${EPICS}/063-maintenance/blueprints/003-z`);
  writeDoc(repo, `${EPICS}/063-maintenance/index.md`, {
    type: 'bouncer.epic', title: 'Maintenance', description: 'd',
    resource: `${EPICS}/063-maintenance/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '063', epic_id: '063', status: 'approved' },
  });

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.maintenanceEpic.id, '063');
  assert.strictEqual(payload.maintenanceEpic.dir, `${EPICS}/063-maintenance`);
  assert.strictEqual(payload.maintenanceEpic.status, 'approved');
  assert.strictEqual(payload.maintenanceEpic.nextBlueprintId, '004');
});

test('plan inspect is read-only: git status is unchanged', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  const before = git(repo, ['status', '--porcelain']);

  const result = inspect(repo, ['--epic-dir', `${EPICS}/003-b`]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(git(repo, ['status', '--porcelain']), before);
});

test('plan inspect rejects a missing .bouncer with not-initialized', () => {
  const repo = makeRepo();
  const result = inspect(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'not-initialized');
});

test('plan inspect rejects a malformed or missing --epic-dir with invalid-epic-dir', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const badForm = inspect(repo, ['--epic-dir', '003-b']);
  const badFormPayload = parsePayload(badForm);
  assert.strictEqual(badForm.code, 1);
  assert.strictEqual(badFormPayload.ok, false);
  assert.strictEqual(badFormPayload.reason, 'invalid-epic-dir');

  const missing = inspect(repo, ['--epic-dir', `${EPICS}/999-missing`]);
  const missingPayload = parsePayload(missing);
  assert.strictEqual(missing.code, 1);
  assert.strictEqual(missingPayload.ok, false);
  assert.strictEqual(missingPayload.reason, 'invalid-epic-dir');
});

test('plan without a subcommand exits 2', () => {
  const result = capture(['plan']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /inspect/);
});

// --- routing signals (plan inspect --blueprint) ---
// classifyRoutingPaths / summarizeRouting 는 I/O 없이 경로 규칙·추천 근거만
// 고정한다. CLI 케이스는 초안 task fixture 위에서 routing 필드를 본다.

const {
  classifyRoutingPaths,
  summarizeRouting,
} = require('../scripts/lib/plan-inspect');

test('classifyRoutingPaths tags security/manifest/build/migration and skips near-misses', () => {
  assert.deepStrictEqual(
    classifyRoutingPaths(['src/auth/session.ts']),
    [{ path: 'src/auth/session.ts', kind: 'security' }],
  );
  assert.deepStrictEqual(classifyRoutingPaths(['src/tokenizer.ts']), []);
  assert.deepStrictEqual(classifyRoutingPaths(['docs/author.md']), []);
  assert.deepStrictEqual(
    classifyRoutingPaths(['package.json']),
    [{ path: 'package.json', kind: 'manifest' }],
  );
  assert.deepStrictEqual(
    classifyRoutingPaths(['requirements-dev.txt']),
    [{ path: 'requirements-dev.txt', kind: 'manifest' }],
  );
  assert.deepStrictEqual(
    classifyRoutingPaths(['Dockerfile.prod']),
    [{ path: 'Dockerfile.prod', kind: 'build' }],
  );
  assert.deepStrictEqual(
    classifyRoutingPaths(['.github/workflows/ci.yml']),
    [{ path: '.github/workflows/ci.yml', kind: 'build' }],
  );
  assert.deepStrictEqual(
    classifyRoutingPaths(['tsconfig.build.json']),
    [{ path: 'tsconfig.build.json', kind: 'build' }],
  );
  assert.deepStrictEqual(
    classifyRoutingPaths(['db/migrations/001_init.sql']),
    [{ path: 'db/migrations/001_init.sql', kind: 'migration' }],
  );
  assert.deepStrictEqual(
    classifyRoutingPaths(['src/schema/user.ts']),
    [{ path: 'src/schema/user.ts', kind: 'migration' }],
  );
});

test('summarizeRouting excludes test/docs/root files from modules and flags empty paths', () => {
  const light = summarizeRouting([{
    paths: ['scripts/lib/a.ts', 'test/a.test.js', 'docs/x.md', 'CHANGELOG.md'],
    dependsOn: [],
  }]);
  assert.strictEqual(light.advisory, true);
  assert.strictEqual(light.tasks, 1);
  assert.strictEqual(light.dependencies, 0);
  assert.deepStrictEqual(light.modules, ['scripts']);
  assert.deepStrictEqual(light.riskPaths, []);
  assert.strictEqual(light.recommendation, 'light-candidate');
  assert.deepStrictEqual(light.reasons, []);

  const empty = summarizeRouting([{ paths: [], dependsOn: [] }]);
  assert.deepStrictEqual(empty.modules, []);
  assert.ok(empty.reasons.includes('affected-paths-empty'));
  assert.strictEqual(empty.recommendation, 'light-candidate');

  const full = summarizeRouting([
    { paths: ['a/x.ts', 'b/y.ts'], dependsOn: ['TASKS-001'] },
    { paths: ['c/z.ts', 'package.json'], dependsOn: [] },
  ]);
  assert.strictEqual(full.tasks, 2);
  assert.strictEqual(full.dependencies, 1);
  assert.deepStrictEqual(full.modules, ['a', 'b', 'c']);
  assert.strictEqual(full.recommendation, 'full-candidate');
  assert.ok(full.reasons.includes('tasks'));
  assert.ok(full.reasons.includes('dependencies'));
  assert.ok(full.reasons.includes('modules'));
  assert.ok(full.reasons.includes('riskPaths'));
});

function writeRoutingBlueprint(repo, {
  tasks = [{
    id: '001',
    paths: ['scripts/src/lib/a.ts'],
    dependsOn: [],
    executionKind: 'commit',
  }],
} = {}) {
  const epicDir = `${EPICS}/010-routing`;
  const blueprintDir = `${epicDir}/blueprints/001-signals`;
  mkdirp(repo, blueprintDir);
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'R', description: 'd',
    resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '010', epic_id: '010', status: 'approved' },
  });
  writeDoc(repo, `${blueprintDir}/index.md`, {
    type: 'bouncer.blueprint', title: 'S', description: 'd',
    resource: `${blueprintDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '010', blueprint_id: '001', status: 'draft', scale: 'full',
    },
  });
  for (const task of tasks) {
    writeDoc(repo, `${blueprintDir}/tasks/${task.id}/tasks.md`, {
      type: 'bouncer.tasks', title: `T${task.id}`, description: 'd',
      resource: `${blueprintDir}/tasks/${task.id}/tasks.md`,
      tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${task.id}`,
        epic_id: '010',
        blueprint_id: '001',
        status: 'draft',
        execution_kind: task.executionKind || 'commit',
        depends_on: task.dependsOn || [],
        affected_paths: task.paths || [],
      },
    });
  }
  return blueprintDir;
}

test('plan inspect --blueprint reports full-candidate routing from drafted tasks', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [
      {
        id: '001',
        paths: ['src/auth/session.ts', 'a/mod.ts'],
        dependsOn: [],
        executionKind: 'commit',
      },
      {
        id: '002',
        paths: ['b/mod.ts', 'c/mod.ts'],
        dependsOn: ['TASKS-001'],
        executionKind: 'commit',
      },
      {
        id: '003',
        paths: ['scripts/x.ts'],
        dependsOn: ['TASKS-001', 'TASKS-002'],
        executionKind: 'verification',
      },
    ],
  });

  const result = inspect(repo, ['--blueprint', blueprintDir]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.routing.advisory, true);
  assert.strictEqual(payload.routing.tasks, 2);
  assert.strictEqual(payload.routing.dependencies, 1);
  assert.strictEqual(payload.routing.recommendation, 'full-candidate');
  assert.ok(payload.routing.riskPaths.some((entry) => entry.kind === 'security'));
});

test('plan inspect without --blueprint keeps prior fields and sets routing null', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.nextEpicId, '004');
  assert.strictEqual(payload.epic, null);
  assert.strictEqual(payload.maintenanceEpic, null);
  assert.deepStrictEqual(payload.verifySignals, ['Makefile', 'package.json#scripts']);
  assert.strictEqual(payload.current.status, 'empty');
  assert.strictEqual(payload.routing, null);
});

test('plan inspect rejects a malformed or missing --blueprint with invalid-blueprint-dir', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const badForm = inspect(repo, ['--blueprint', '001-x']);
  const badFormPayload = parsePayload(badForm);
  assert.strictEqual(badForm.code, 1);
  assert.strictEqual(badFormPayload.ok, false);
  assert.strictEqual(badFormPayload.reason, 'invalid-blueprint-dir');

  const missing = inspect(repo, [
    '--blueprint', `${EPICS}/003-b/blueprints/999-missing`,
  ]);
  const missingPayload = parsePayload(missing);
  assert.strictEqual(missing.code, 1);
  assert.strictEqual(missingPayload.ok, false);
  assert.strictEqual(missingPayload.reason, 'invalid-blueprint-dir');
});

test('plan inspect rejects valueless --blueprint with exit 2', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  const result = inspect(repo, ['--blueprint']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /blueprint/);
});
