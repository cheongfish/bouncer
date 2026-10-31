'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../packages/cli/dist/cli');
const { writeCurrent } = require('../packages/cli/dist/current');
const { COMMON_EPICS } = require('../packages/cli/dist/epic-registry');
const { writeEpicRegistry } = require('./helpers/epic-registry');

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

test('plan inspect with epic dirs → allocates the next epic id from \\d{3}-slug dirs only', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.nextEpicId, null);
  assert.strictEqual(payload.registry.status, 'missing');
  assert.strictEqual(payload.epic, null);
  assert.strictEqual('maintenanceEpic' in payload, false);
  assert.deepStrictEqual(payload.verifySignals, ['Makefile', 'package.json#scripts']);
  assert.strictEqual(payload.current.status, 'empty');
  assert.strictEqual(payload.current.blueprint, null);
  assert.strictEqual(payload.current.task, null);
  assert.strictEqual(payload.current.base, null);
});

test('plan inspect with a single namespace pointer → maps it to selected blueprint/task/base', () => {
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

test('plan inspect with multiple namespace pointers → maps them to ambiguous with empty fields', () => {
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

test('plan inspect with --epic-dir → fills epic.nextBlueprintId and ignores BP- prefixes', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  const epicDir = `${EPICS}/003-b`;

  const result = inspect(repo, ['--epic-dir', epicDir]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.nextEpicId, null);
  assert.strictEqual(payload.epic.dir, epicDir);
  assert.strictEqual(payload.epic.status, 'approved');
  assert.strictEqual(payload.epic.nextBlueprintId, '003');
});

test('plan inspect with a maintenance dir and no registry → has no maintenanceEpic key', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  mkdirp(repo, `${EPICS}/063-maintenance/blueprints/003-z`);

  const payload = parsePayload(inspect(repo));

  assert.strictEqual(payload.ok, true);
  assert.strictEqual('maintenanceEpic' in payload, false);
});

test('plan inspect with a standard registry and only 001-foundation → lists 8 active epics', () => {
  const repo = makeRepo();
  writeEpicRegistry(repo);
  mkdirp(repo, `${EPICS}/001-foundation`);

  const payload = parsePayload(inspect(repo));

  assert.strictEqual(payload.registry.status, 'ok');
  assert.strictEqual(payload.registry.profile, 'standard');
  assert.strictEqual(payload.registry.epics.length, 8);
  assert.strictEqual(payload.registry.epics[0].slug, 'foundation');
  assert.strictEqual(payload.registry.epics[0].dir, `${EPICS}/001-foundation`);
  assert.strictEqual(payload.registry.epics[1].dir, null);
  assert.strictEqual(payload.registry.epics[1].description, COMMON_EPICS[1].description);
  assert.strictEqual(payload.registry.epics[1].include, COMMON_EPICS[1].include);
  assert.strictEqual(payload.registry.epics[1].exclude, COMMON_EPICS[1].exclude);
  assert.deepStrictEqual(payload.registry.areas, []);
  assert.strictEqual(payload.nextEpicId, null);
  assert.strictEqual('maintenanceEpic' in payload, false);
});

test('plan inspect with an approved domain epic lacking a dir → nextEpicId is the smallest such id', () => {
  const repo = makeRepo();
  const base = writeEpicRegistry(repo).epics;
  const domain = (slug, id) => ({
    slug, id, kind: 'domain', active: true, approval: { reason: `${slug} reason`, approvedAt: '2026-10-20' },
  });
  writeEpicRegistry(repo, { domainEpicLimit: 3, epics: [...base, domain('shipping', '021'), domain('billing', '020')] });
  mkdirp(repo, `${EPICS}/021-shipping`);

  const payload = parsePayload(inspect(repo));
  const billing = payload.registry.epics.find((e) => e.slug === 'billing');

  assert.strictEqual(payload.nextEpicId, '020');
  assert.strictEqual(billing.dir, null);
  assert.strictEqual(billing.description, null);
  assert.strictEqual(billing.include, 'billing reason');
  assert.strictEqual(billing.exclude, '');
});

test('plan inspect with a legacy epic and an inactive common epic → legacy listed, inactive hidden', () => {
  const repo = makeRepo();
  const base = writeEpicRegistry(repo).epics.map((e) => (e.slug === 'data' ? { ...e, active: false } : e));
  writeEpicRegistry(repo, { epics: [...base, { slug: 'maintenance', id: '063', kind: 'legacy', active: true }] });
  mkdirp(repo, `${EPICS}/063-maintenance`);

  const payload = parsePayload(inspect(repo));

  assert.deepStrictEqual(payload.registry.legacy, [
    { slug: 'maintenance', id: '063', dir: `${EPICS}/063-maintenance` },
  ]);
  assert.strictEqual(payload.registry.epics.length, 7);
  assert.strictEqual(payload.registry.epics.some((e) => e.slug === 'maintenance' || e.slug === 'data'), false);
});

test('plan inspect with a v2 registry → slug dirs, legacy list, null ids and nextEpicId', () => {
  const repo = makeRepo();
  const approval = { reason: 'domain reason', approvedAt: '2026-10-20' };
  writeEpicRegistry(repo, {
    version: 2,
    profile: 'domain-only',
    domainEpicLimit: 8,
    epics: [
      { slug: 'plan-workflow', kind: 'domain', active: true, approval },
      { slug: 'drive-execution', kind: 'domain', active: true, approval },
      { slug: 'old-work', legacy_id: '012', kind: 'legacy', active: true },
    ],
  });
  mkdirp(repo, `${EPICS}/plan-workflow`);
  mkdirp(repo, `${EPICS}/old-work`);

  const payload = parsePayload(inspect(repo));
  const byslug = (slug) => payload.registry.epics.find((e) => e.slug === slug);

  assert.strictEqual(byslug('plan-workflow').dir, `${EPICS}/plan-workflow`);
  assert.strictEqual(byslug('plan-workflow').id, null);
  assert.strictEqual(byslug('drive-execution').dir, null);
  assert.deepStrictEqual(payload.registry.legacy, [{ slug: 'old-work', id: '012', dir: `${EPICS}/old-work` }]);
  assert.strictEqual(payload.nextEpicId, null);
});

test('plan inspect without a registry → registry missing and nextEpicId null', () => {
  const repo = makeRepo();
  mkdirp(repo, '.bouncer');

  const payload = parsePayload(inspect(repo));

  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.registry.status, 'missing');
  assert.strictEqual(typeof payload.registry.next, 'string');
  assert.strictEqual(payload.nextEpicId, null);
});

test('plan inspect with a broken registry JSON → ok true with registry invalid S35', () => {
  const repo = makeRepo();
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'epics.json'), '{ not json');

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.registry.status, 'invalid');
  assert.strictEqual(payload.registry.code, 'S35');
  assert.strictEqual(typeof payload.registry.message, 'string');
  assert.strictEqual(payload.nextEpicId, null);
});

test('plan inspect run → is read-only: git status is unchanged', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  const before = git(repo, ['status', '--porcelain']);

  const result = inspect(repo, ['--epic-dir', `${EPICS}/003-b`]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(git(repo, ['status', '--porcelain']), before);
});

test('plan inspect with a missing .bouncer → rejects with not-initialized', () => {
  const repo = makeRepo();
  const result = inspect(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'not-initialized');
});

test('plan inspect with a malformed or missing --epic-dir → rejects with invalid-epic-dir', () => {
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

test('plan without a subcommand → exits 2', () => {
  const result = capture(['plan']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /inspect or approve/);
});

// --- routing signals (plan inspect --blueprint) ---
// classifyRoutingPaths / summarizeRouting 는 I/O 없이 경로 규칙·추천 근거만
// 고정한다. CLI 케이스는 초안 task fixture 위에서 routing 필드를 본다.

const {
  classifyRoutingPaths,
  summarizeRouting,
} = require('../packages/cli/dist/plan-inspect');

test('classifyRoutingPaths with security/manifest/build/migration paths and near-misses → tags the matches and skips near-misses', () => {
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

test('summarizeRouting with test/docs/root files and empty paths → excludes the files from modules and flags empty paths', () => {
  const light = summarizeRouting([{
    // scripts/lib/는 생성물 접두라 모듈에서 빠지므로 입력은 소스 경로 scripts/a.ts로 둔다.
    paths: ['scripts/a.ts', 'test/a.test.js', 'docs/x.md', 'CHANGELOG.md'],
    dependsOn: [],
  }]);
  assert.strictEqual(light.advisory, true);
  assert.strictEqual(light.tasks, 1);
  assert.strictEqual(light.dependencies, 0);
  assert.deepStrictEqual(light.modules, ['scripts']);
  assert.deepStrictEqual(light.riskPaths, []);
  assert.strictEqual(light.recommendation, 'low-candidate');
  assert.deepStrictEqual(light.reasons, []);

  const empty = summarizeRouting([{ paths: [], dependsOn: [] }]);
  assert.deepStrictEqual(empty.modules, []);
  assert.ok(empty.reasons.includes('affected-paths-empty'));
  assert.strictEqual(empty.recommendation, 'low-candidate');

  const full = summarizeRouting([
    { paths: ['a/x.ts', 'b/y.ts'], dependsOn: ['TASKS-001'] },
    { paths: ['c/z.ts', 'package.json'], dependsOn: [] },
  ]);
  assert.strictEqual(full.tasks, 2);
  assert.strictEqual(full.dependencies, 1);
  assert.deepStrictEqual(full.modules, ['a', 'b', 'c']);
  assert.strictEqual(full.recommendation, 'standard-candidate');
  // 작업 수·의존 수는 더 이상 추천 근거가 아니고, 모듈 3개는 문턱 4 미만이라 modules도 없다.
  assert.ok(!full.reasons.includes('tasks'));
  assert.ok(!full.reasons.includes('dependencies'));
  assert.ok(!full.reasons.includes('modules'));
  assert.ok(full.reasons.includes('riskPaths'));
});

test('summarizeRouting with a serial pair in three modules or fewer and no risk → recommends low-candidate with empty reasons', () => {
  const routing = summarizeRouting([
    { paths: ['a/x.ts'], dependsOn: [] },
    { paths: ['b/y.ts'], dependsOn: ['TASKS-001'] },
  ]);
  assert.strictEqual(routing.tasks, 2);
  assert.strictEqual(routing.dependencies, 1);
  assert.deepStrictEqual(routing.modules, ['a', 'b']);
  assert.strictEqual(routing.recommendation, 'low-candidate');
  assert.deepStrictEqual(routing.reasons, []);
  // 순수 호출은 drive shape를 받지 않으므로 serial은 알 수 없음(null)이다.
  assert.strictEqual(routing.serial, null);
});

test('summarizeRouting with four source modules → adds the modules reason and recommends standard-candidate', () => {
  const routing = summarizeRouting([{
    paths: ['packages/cli/src/a.ts', 'packages/web/x.ts', 'skills/x.md', 'rules/x.md'],
    dependsOn: [],
  }]);
  assert.deepStrictEqual(routing.modules, ['packages/cli', 'packages/web', 'rules', 'skills']);
  assert.strictEqual(routing.recommendation, 'standard-candidate');
  assert.deepStrictEqual(routing.reasons, ['modules']);
});

test('summarizeRouting with AGENTS.md only → tags it as a repo risk and recommends standard-candidate', () => {
  const routing = summarizeRouting([{ paths: ['AGENTS.md'], dependsOn: [] }]);
  assert.deepStrictEqual(routing.riskPaths, [{ path: 'AGENTS.md', kind: 'repo' }]);
  assert.strictEqual(routing.recommendation, 'standard-candidate');
  assert.deepStrictEqual(routing.reasons, ['riskPaths']);
});

test('summarizeRouting with generated paths only → leaves them out of modules and keeps low-candidate', () => {
  const routing = summarizeRouting([{
    paths: ['.codex/agents/a.toml', 'scripts/lib/a.ts'],
    dependsOn: [],
  }]);
  assert.deepStrictEqual(routing.modules, []);
  assert.deepStrictEqual(routing.riskPaths, []);
  assert.strictEqual(routing.recommendation, 'low-candidate');
  assert.deepStrictEqual(routing.reasons, []);
});

test('summarizeRouting with a generated commit-guard file → keeps its repo risk even though it is generated', () => {
  // 생성물은 크기·모듈에서만 빠지고 위험 평가에는 남는다(computeComplexitySignals 계약).
  const routing = summarizeRouting([{ paths: ['scripts/lib/commit-guard.js'], dependsOn: [] }]);
  assert.deepStrictEqual(routing.riskPaths, [{ path: 'scripts/lib/commit-guard.js', kind: 'repo' }]);
  assert.strictEqual(routing.recommendation, 'standard-candidate');
});

test('summarizeRouting with configInvalid → adds complexity-config-invalid without changing a low recommendation', () => {
  const routing = summarizeRouting([{ paths: ['a/x.ts'], dependsOn: [] }], { configInvalid: true });
  assert.deepStrictEqual(routing.reasons, ['complexity-config-invalid']);
  assert.strictEqual(routing.recommendation, 'low-candidate');
});

test('summarizeRouting with an injected policy and drive shape → applies the policy threshold and maps serial', () => {
  const { DEFAULT_COMPLEXITY_POLICY } = require('../packages/cli/dist/config');
  const pair = [{ paths: ['a/x.ts'], dependsOn: [] }, { paths: ['b/y.ts'], dependsOn: [] }];
  const strict = summarizeRouting(pair, {
    policy: { ...DEFAULT_COMPLEXITY_POLICY, strongMinModules: 2 },
    driveShape: 'serial',
  });
  assert.strictEqual(strict.recommendation, 'standard-candidate');
  assert.deepStrictEqual(strict.reasons, ['modules']);
  assert.strictEqual(strict.serial, true);
  assert.strictEqual(summarizeRouting(pair, { driveShape: 'parallel' }).serial, false);
  assert.strictEqual(summarizeRouting(pair, { driveShape: 'unknown' }).serial, null);
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

test('plan inspect --blueprint with drafted tasks → reports standard-candidate routing', () => {
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
  assert.strictEqual(payload.routing.recommendation, 'standard-candidate');
  assert.ok(payload.routing.riskPaths.some((entry) => entry.kind === 'security'));
});

test('plan inspect without --blueprint → keeps prior fields and sets routing null', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const result = inspect(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.nextEpicId, null);
  assert.strictEqual(payload.registry.status, 'missing');
  assert.strictEqual(payload.epic, null);
  assert.strictEqual('maintenanceEpic' in payload, false);
  assert.deepStrictEqual(payload.verifySignals, ['Makefile', 'package.json#scripts']);
  assert.strictEqual(payload.current.status, 'empty');
  assert.strictEqual(payload.routing, null);
  assert.strictEqual(payload.coupledPaths, null);
});

// 직렬·병렬·설정 케이스용 commit task 문서. parallel_safe는 명시한 경우만 true로 쓴다.
function writeShapeTask(repo, blueprintDir, task) {
  writeDoc(repo, `${blueprintDir}/tasks/${task.id}/tasks.md`, {
    type: 'bouncer.tasks', title: `T${task.id}`, description: 'd',
    resource: `${blueprintDir}/tasks/${task.id}/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: `TASKS-${task.id}`,
      epic_id: '010',
      blueprint_id: '001',
      status: 'draft',
      execution_kind: 'commit',
      depends_on: task.dependsOn || [],
      parallel_safe: task.parallelSafe === true,
      affected_paths: task.paths,
    },
  });
}

test('plan inspect --blueprint with a serial dependency chain → reports serial true and low-candidate', () => {
  const repo = makeRepo();
  const blueprintDir = writeRoutingBlueprint(repo, { tasks: [] });
  writeShapeTask(repo, blueprintDir, { id: '001', paths: ['a/x.ts'] });
  writeShapeTask(repo, blueprintDir, { id: '002', paths: ['b/y.ts'], dependsOn: ['TASKS-001'] });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.strictEqual(payload.routing.serial, true);
  assert.strictEqual(payload.routing.recommendation, 'low-candidate');
  assert.deepStrictEqual(payload.routing.reasons, []);
});

test('plan inspect --blueprint with two parallel-safe disjoint tasks → reports serial false', () => {
  const repo = makeRepo();
  const blueprintDir = writeRoutingBlueprint(repo, { tasks: [] });
  writeShapeTask(repo, blueprintDir, { id: '001', paths: ['a/x.ts'], parallelSafe: true });
  writeShapeTask(repo, blueprintDir, { id: '002', paths: ['b/y.ts'], parallelSafe: true });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.strictEqual(payload.routing.serial, false);
  assert.strictEqual(payload.routing.recommendation, 'low-candidate');
});

test('plan inspect --blueprint with no commit task → reports serial null', () => {
  const repo = makeRepo();
  const blueprintDir = writeRoutingBlueprint(repo, { tasks: [] });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.strictEqual(payload.routing.tasks, 0);
  assert.strictEqual(payload.routing.serial, null);
  assert.strictEqual(payload.routing.recommendation, 'low-candidate');
  assert.deepStrictEqual(payload.routing.reasons, ['affected-paths-empty']);
});

test('plan inspect --blueprint with complexity.strong_min_modules 2 → recommends standard-candidate for two modules', () => {
  const repo = makeRepo();
  const blueprintDir = writeRoutingBlueprint(repo, { tasks: [] });
  writeShapeTask(repo, blueprintDir, { id: '001', paths: ['a/x.ts', 'b/y.ts'] });
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    `${JSON.stringify({ complexity: { strong_min_modules: 2 } })}\n`,
  );

  const result = inspect(repo, ['--blueprint', blueprintDir]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.routing.recommendation, 'standard-candidate');
  assert.ok(payload.routing.reasons.includes('modules'));
});

test('plan inspect --blueprint with an invalid complexity block → stays ok with complexity-config-invalid and default policy', () => {
  const repo = makeRepo();
  const blueprintDir = writeRoutingBlueprint(repo, { tasks: [] });
  writeShapeTask(repo, blueprintDir, { id: '001', paths: ['a/x.ts'] });
  writeShapeTask(repo, blueprintDir, { id: '002', paths: ['b/y.ts'], dependsOn: ['TASKS-001'] });
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    `${JSON.stringify({ complexity: 'x' })}\n`,
  );

  const result = inspect(repo, ['--blueprint', blueprintDir]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.deepStrictEqual(payload.routing.reasons, ['complexity-config-invalid']);
  assert.strictEqual(payload.routing.recommendation, 'low-candidate');
});

test('plan inspect --blueprint with generated_paths cleared → counts the generated agent as a module', () => {
  const repo = makeRepo();
  const blueprintDir = writeRoutingBlueprint(repo, { tasks: [] });
  writeShapeTask(repo, blueprintDir, {
    id: '001',
    paths: ['.codex/agents/a.toml', 'b/y.ts', 'c/z.ts', 'd/w.ts'],
  });

  // 기본 생성물 목록에서는 .codex가 빠져 모듈이 셋(b·c·d)이라 low다.
  const defaults = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));
  assert.deepStrictEqual(defaults.routing.modules, ['b', 'c', 'd']);
  assert.strictEqual(defaults.routing.recommendation, 'low-candidate');

  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    `${JSON.stringify({ complexity: { generated_paths: [] } })}\n`,
  );
  const cleared = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));
  assert.deepStrictEqual(cleared.routing.modules, ['.codex', 'b', 'c', 'd']);
  assert.strictEqual(cleared.routing.recommendation, 'standard-candidate');
});

test('plan inspect with a malformed or missing --blueprint → rejects with invalid-blueprint-dir', () => {
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

test('plan inspect with valueless --blueprint → rejects with exit 2', () => {
  const repo = makeRepo();
  writeIdTree(repo);
  const result = inspect(repo, ['--blueprint']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /blueprint/);
});

// 승격 후보 fixture: 007-features 아래 blueprint index.md에 bouncer.area를 쓴다.
function writeAreaBlueprints(repo, areas) {
  areas.forEach((area, i) => {
    const id = String(i + 1).padStart(3, '0');
    writeDoc(repo, `${EPICS}/007-features/blueprints/${id}-bp/index.md`, {
      type: 'bouncer.blueprint', title: 'T', description: 'd', tags: ['bouncer'],
      timestamp: '2026-10-20T00:00:00+09:00', bouncer: { id, status: 'draft', area },
    });
  });
}

test('plan inspect with an area at the promotion threshold → promotions lists that area', () => {
  const repo = makeRepo();
  writeEpicRegistry(repo, { domainEpicLimit: 1, areaPromotionThreshold: 2, areas: ['ordering', 'catalog'] });
  writeAreaBlueprints(repo, ['ordering', 'ordering', 'catalog']);

  const payload = parsePayload(inspect(repo));

  assert.deepStrictEqual(payload.registry.promotions, [{ area: 'ordering', count: 2 }]);
});

test('plan inspect without areaPromotionThreshold → promotions is empty', () => {
  const repo = makeRepo();
  writeEpicRegistry(repo, { domainEpicLimit: 1, areas: ['ordering'] });
  writeAreaBlueprints(repo, ['ordering', 'ordering']);

  assert.deepStrictEqual(parsePayload(inspect(repo)).registry.promotions, []);
});

test('plan inspect with the domain epic limit exhausted → promotions is empty', () => {
  const repo = makeRepo();
  const base = writeEpicRegistry(repo).epics;
  const domain = {
    slug: 'billing', id: '020', kind: 'domain', active: true, approval: { reason: 'r', approvedAt: '2026-10-20' },
  };
  writeEpicRegistry(repo, {
    domainEpicLimit: 1, areaPromotionThreshold: 2, areas: ['ordering'], epics: [...base, domain],
  });
  writeAreaBlueprints(repo, ['ordering', 'ordering']);

  assert.deepStrictEqual(parsePayload(inspect(repo)).registry.promotions, []);
});

test('plan inspect with an area below the threshold → promotions is empty', () => {
  const repo = makeRepo();
  writeEpicRegistry(repo, { domainEpicLimit: 1, areaPromotionThreshold: 2, areas: ['ordering'] });
  writeAreaBlueprints(repo, ['ordering']);

  assert.deepStrictEqual(parsePayload(inspect(repo)).registry.promotions, []);
});

// --- slug epic: 다음 blueprint 번호는 디렉터리 이름이 아니라 frontmatter order의 최대값 + 1 ---
function writeSlugBlueprint(repo, epicSlug, bpSlug, bouncer) {
  const rel = `${EPICS}/${epicSlug}/blueprints/${bpSlug}/index.md`;
  writeDoc(repo, rel, {
    type: 'bouncer.blueprint', title: bpSlug, description: 'd', resource: rel,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: bpSlug, epic_id: epicSlug, blueprint_id: bpSlug, status: 'draft', ...bouncer },
  });
}

test('plan inspect on a slug epic with orders 1, 2 and 5 → nextBlueprintOrder is 6', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/plan-workflow`);
  writeSlugBlueprint(repo, 'plan-workflow', 'alpha', { order: 1 });
  writeSlugBlueprint(repo, 'plan-workflow', 'beta', { order: 2 });
  writeSlugBlueprint(repo, 'plan-workflow', 'gamma', { order: 5 });

  const payload = parsePayload(inspect(repo, ['--epic-dir', `${EPICS}/plan-workflow`]));

  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.epic.nextBlueprintOrder, 6);
});

test('plan inspect on a slug epic without blueprints → nextBlueprintOrder is 1', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/plan-workflow`);

  const payload = parsePayload(inspect(repo, ['--epic-dir', `${EPICS}/plan-workflow`]));

  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.epic.nextBlueprintOrder, 1);
});

test('plan inspect on a slug epic with unreadable or invalid orders → ignores them for the maximum', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/plan-workflow/blueprints/no-index`);
  writeSlugBlueprint(repo, 'plan-workflow', 'alpha', { order: 3 });
  writeSlugBlueprint(repo, 'plan-workflow', 'beta', { order: 'x' });
  writeSlugBlueprint(repo, 'plan-workflow', 'gamma', { order: 2.5 });
  writeSlugBlueprint(repo, 'plan-workflow', 'delta', {});

  const payload = parsePayload(inspect(repo, ['--epic-dir', `${EPICS}/plan-workflow`]));

  assert.strictEqual(payload.epic.nextBlueprintOrder, 4);
});

test('plan inspect on a numeric epic → keeps nextBlueprintId and adds the same value as an integer order', () => {
  const repo = makeRepo();
  writeIdTree(repo);

  const payload = parsePayload(inspect(repo, ['--epic-dir', `${EPICS}/003-b`]));

  assert.strictEqual(payload.epic.nextBlueprintId, '003');
  assert.strictEqual(payload.epic.nextBlueprintOrder, 3);
});

// 결합 경로 탐지 fixture. 생성 짝(agents/<name>.md ↔ .codex/agents/<name>.toml, .gitignore 예외)과
// 경로 문자열 후보를 한 저장소에 함께 깐다. 각 단언은 coupledPaths 계약의 한 조각을 본다.
function writeCoupledFixture(repo, { gitignore = '!.codex/agents/bouncer-reviewer.toml\n' } = {}) {
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [
      {
        id: '001',
        paths: ['agents/bouncer-planner.md', 'docs/guide.md', 'test/covered.test.js', 'docs', '.'],
        dependsOn: [],
        executionKind: 'commit',
      },
      {
        id: '002',
        paths: ['agents/bouncer-reviewer.md', '.codex/agents/'],
        dependsOn: [],
        executionKind: 'commit',
      },
      { id: '003', paths: ['agents/'], dependsOn: [], executionKind: 'commit' },
      { id: '004', paths: [], dependsOn: [], executionKind: 'commit' },
      { id: '005', paths: ['docs/guide.md'], dependsOn: [], executionKind: 'verification' },
    ],
  });
  if (gitignore !== null) fs.writeFileSync(path.join(repo, '.gitignore'), gitignore);
  mkdirp(repo, 'docs');
  writeFile(repo, 'test/guide.test.js', "read('docs/guide.md');\n");
  writeFile(repo, 'test/covered.test.js', "read('docs/guide.md');\n");
  writeFile(repo, 'test/node_modules/x.test.js', "read('docs/guide.md');\n");
  writeFile(repo, 'test/long.test.js', `    'docs/guide.md'${'x'.repeat(300)}\n`);
  return blueprintDir;
}

function writeFile(repo, rel, text) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

test('plan inspect --blueprint with generated pairs and test references → reports coupledPaths', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeCoupledFixture(repo);
  const { NAMED_AGENTS } = require('../packages/cli/dist/codex-agents');

  const result = inspect(repo, ['--blueprint', blueprintDir]);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.coupledPaths.advisory, true);
  assert.deepStrictEqual(payload.coupledPaths.pairs.filter((e) => e.task !== 'TASKS-003'), [
    {
      task: 'TASKS-001',
      source: 'agents/bouncer-planner.md',
      path: '.codex/agents/bouncer-planner.toml',
      kind: 'codex-agent-toml',
      covered: false,
    },
    {
      task: 'TASKS-001',
      source: 'agents/bouncer-planner.md',
      path: '.gitignore',
      kind: 'gitignore-exception',
      covered: false,
    },
    {
      task: 'TASKS-002',
      source: 'agents/bouncer-reviewer.md',
      path: '.codex/agents/bouncer-reviewer.toml',
      kind: 'codex-agent-toml',
      covered: true,
    },
  ]);
  assert.deepStrictEqual(
    payload.coupledPaths.pairs.filter((e) => e.task === 'TASKS-003' && e.kind === 'codex-agent-toml')
      .map((e) => e.path),
    NAMED_AGENTS.map((n) => `.codex/agents/${n}.toml`),
  );
  assert.deepStrictEqual(payload.coupledPaths.candidates.map((e) => [e.task, e.source, e.path]), [
    ['TASKS-001', 'docs/guide.md', 'test/guide.test.js'],
    ['TASKS-001', 'docs/guide.md', 'test/long.test.js'],
  ]);
  assert.deepStrictEqual(payload.coupledPaths.candidates.map((e) => e.kind), ['path-literal', 'path-literal']);
  assert.deepStrictEqual(payload.coupledPaths.candidates[0].evidence, { line: 1, text: "read('docs/guide.md');" });
  const long = payload.coupledPaths.candidates[1].evidence.text;
  assert.strictEqual(long.length, 200);
  assert.ok(long.startsWith("'docs/guide.md'"));
});

// 경로 경계 fixture: 다른 경로의 끝이나 식별자 일부로 든 일치는 후보가 되면 안 되고, 경계 일치는 후보다.
test('plan inspect --blueprint with boundary-noise path matches → keeps only files with a boundary match', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [{ id: '001', paths: ['docs/guide.md'], dependsOn: [], executionKind: 'commit' }],
  });
  writeFile(repo, 'test/prefix.test.js', "read('packages/cli/docs/guide.md');\n");
  writeFile(repo, 'test/suffix.test.js', "read('docs/guide.md.bak');\nconst x = docs_guide;\n");
  writeFile(repo, 'test/dot.test.js', "read('./docs/guide.md');\n");
  writeFile(repo, 'test/sentence.test.js', '// see docs/guide.md.\n');
  writeFile(repo, 'test/mixed.test.js', "copy('packages/cli/docs/guide.md', 'docs/guide.md');\n");

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.deepStrictEqual(payload.coupledPaths.candidates.map((e) => e.path), [
    'test/dot.test.js',
    'test/mixed.test.js',
    'test/sentence.test.js',
  ]);
});

// 서로게이트 fixture: 이모지(상위·하위 단위 두 개)가 200 단위 절단 경계에 걸리는 두 경우를 함께 본다.
test('plan inspect --blueprint with a surrogate pair at the cut → evidence never ends on a lone surrogate', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [{ id: '001', paths: ['docs/guide.md'], dependsOn: [], executionKind: 'commit' }],
  });
  // 상위 단위가 index 199에 와서 200 절단이 상위 서로게이트에서 끊기는 줄.
  writeFile(repo, 'test/emoji.test.js', `'docs/guide.md'${'x'.repeat(184)}\u{1F600}tail\n`);
  // 쌍이 index 198·199에 다 들어 200 절단이 쌍을 온전히 담는 줄.
  writeFile(repo, 'test/fit.test.js', `'docs/guide.md'${'x'.repeat(183)}\u{1F600}tail\n`);

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));
  const text = Object.fromEntries(payload.coupledPaths.candidates.map((e) => [e.path, e.evidence.text]));

  assert.strictEqual(text['test/emoji.test.js'].length, 199);
  assert.doesNotMatch(text['test/emoji.test.js'], /[\uD800-\uDBFF]$/);
  assert.strictEqual(text['test/fit.test.js'].length, 200);
  assert.ok(text['test/fit.test.js'].endsWith('\u{1F600}'));
});

test('plan inspect --blueprint with a generated TOML on disk → drops the gitignore-exception pair', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeCoupledFixture(repo);
  writeFile(repo, '.codex/agents/bouncer-planner.toml', 'x\n');

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));
  const planner = payload.coupledPaths.pairs.filter(
    (e) => e.task === 'TASKS-001' && e.source === 'agents/bouncer-planner.md',
  );

  assert.deepStrictEqual(planner.map((e) => e.kind), ['codex-agent-toml']);
});

test('plan inspect --blueprint with .gitignore lacking the directory rule → emits no gitignore pair', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  // 디렉터리 재포함(`!.codex/agents/`로 시작하는 줄)이 하나도 없는 .gitignore다.
  const blueprintDir = writeCoupledFixture(repo, { gitignore: 'docs/\n' });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.strictEqual(payload.coupledPaths.pairs.some((e) => e.kind === 'gitignore-exception'), false);
});

test('plan inspect --blueprint without a .gitignore file → emits no gitignore pair', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeCoupledFixture(repo, { gitignore: null });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.strictEqual(payload.coupledPaths.pairs.some((e) => e.kind === 'gitignore-exception'), false);
});

test('plan inspect --blueprint with references only under tests/ → reports the tests/ path as candidate', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [{ id: '001', paths: ['docs/guide.md'], dependsOn: [], executionKind: 'commit' }],
  });
  writeFile(repo, 'tests/guide.test.js', "read('docs/guide.md');\n");

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.deepStrictEqual(payload.coupledPaths.candidates.map((e) => e.path), ['tests/guide.test.js']);
});

test('plan inspect --blueprint without test or tests directories → reports no candidates', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [{ id: '001', paths: ['docs/guide.md'], dependsOn: [], executionKind: 'commit' }],
  });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.deepStrictEqual(payload.coupledPaths.candidates, []);
});

test('plan inspect --blueprint with a verification task referencing a generated agent → omits it', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [
      { id: '001', paths: ['docs/x.md'], dependsOn: [], executionKind: 'commit' },
      { id: '005', paths: ['agents/bouncer-debugger.md'], dependsOn: ['TASKS-001'], executionKind: 'verification' },
    ],
  });

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));
  const ids = [...payload.coupledPaths.pairs, ...payload.coupledPaths.candidates].map((e) => e.task);

  assert.strictEqual(ids.includes('TASKS-005'), false);
});

test('plan inspect --blueprint with a repeated match in one test file → reports only the first line', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [{ id: '001', paths: ['docs/guide.md'], dependsOn: [], executionKind: 'commit' }],
  });
  writeFile(repo, 'test/twice.test.js', "a();\nread('docs/guide.md');\nread('docs/guide.md');\n");

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));
  const twice = payload.coupledPaths.candidates.filter((e) => e.path === 'test/twice.test.js');

  assert.strictEqual(twice.length, 1);
  assert.strictEqual(twice[0].evidence.line, 2);
});

test('plan inspect --blueprint with absolute, parent, or glob items → makes no pair or candidate for them', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeRoutingBlueprint(repo, {
    tasks: [{
      id: '001',
      paths: ['/abs/x.md', '../up.md', 'docs/*.md'],
      dependsOn: [],
      executionKind: 'commit',
    }],
  });
  writeFile(repo, 'test/abs.test.js', "read('/abs/x.md');\nread('../up.md');\nread('docs/*.md');\n");

  const payload = parsePayload(inspect(repo, ['--blueprint', blueprintDir]));

  assert.deepStrictEqual(payload.coupledPaths.pairs, []);
  assert.deepStrictEqual(payload.coupledPaths.candidates, []);
});

test('plan inspect --blueprint → leaves the working tree unchanged', () => {
  const repo = makeRepo();
  mkdirp(repo, `${EPICS}/001-a`);
  const blueprintDir = writeCoupledFixture(repo);
  const before = git(repo, ['status', '--porcelain', '--untracked-files=all']);

  const result = inspect(repo, ['--blueprint', blueprintDir]);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(git(repo, ['status', '--porcelain', '--untracked-files=all']), before);
});

test('plan usage text → mentions coupledPaths in the plan inspect description', () => {
  const { COMMAND_USAGE } = require('../packages/cli/dist/cli-usage');

  assert.ok(COMMAND_USAGE.plan.includes('coupledPaths'));
});
