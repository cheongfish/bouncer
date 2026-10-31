'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// 설치된 plugin 캐시가 없는 환경(CI)에서도 이 checkout을 plugin root로 쓴다. 불일치 시나리오는 각 테스트가 직접 덮어쓴다.
process.env.BOUNCER_HOME ??= path.join(__dirname, '..');
const { execFileSync } = require('node:child_process');
const { init, inspectBootstrap, SOURCE_DIR_CANDIDATES } = require('../packages/cli/dist/init');
const {
  setupGraphify,
  readGraphifyLock,
  GRAPHIFY_LOCK_REL,
} = require('../packages/cli/dist/graphify');
const { DEFAULT_VERIFY_ALLOWLIST, DEFAULT_COMPLEXITY_POLICY } = require('../packages/cli/dist/config');
const { TEMPLATES } = require('../packages/cli/dist/templates');
const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');

function withBouncerHome(fn) {
  const previous = process.env.BOUNCER_HOME;
  process.env.BOUNCER_HOME = path.join(__dirname, '..');
  try { return fn(); } finally {
    if (previous === undefined) delete process.env.BOUNCER_HOME;
    else process.env.BOUNCER_HOME = previous;
  }
}

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-init-'));
}

function git(repo, args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'bouncer-test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'bouncer-test',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  });
}
const read = (repo, rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = (repo, rel) => fs.existsSync(path.join(repo, rel));

test('init on a fresh repo → scaffolds the safe .bouncer tree', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.skipped, false);
  for (const rel of [
    '.bouncer/config.json', '.bouncer/context/index.md',
  ]) {
    assert.ok(exists(repo, rel), `missing ${rel}`);
  }
  assert.ok(!exists(repo, '.bouncer/templates'));
  assert.ok(!exists(repo, '.bouncer/governance.md'));
  assert.ok(!exists(repo, '.bouncer/workflow.md'));
  // plugin schema 정본은 프로젝트 .bouncer/에 설치되지 않는다(경로명만 이전).
  assert.ok(!exists(repo, '.bouncer/document-schema.md'));
  assert.ok(!exists(repo, '.bouncer/current'));
  assert.ok(!exists(repo, 'context/index.md'));
  assert.ok(!exists(repo, '.bouncer/superpowers.md'));
});

test('init → does not write a Superpowers preference document', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!exists(repo, '.bouncer/superpowers.md'));
});

test('init in a repo created with git init -b main → detects base_branch and pr.base', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.equal(config.base_branch, 'main');
  assert.equal(config.pr.base, 'main');
});

test('init with origin/HEAD and a different checkout branch → prefers origin/HEAD', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  git(repo, ['remote', 'add', 'origin', 'https://example.invalid/repo.git']);
  git(repo, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk']);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.equal(config.base_branch, 'trunk');
  assert.equal(config.pr.base, 'trunk');
});

test('init when origin/HEAD and HEAD cannot be resolved → omits base_branch', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  git(repo, ['commit', '--allow-empty', '-m', 'seed']);
  git(repo, ['checkout', '--detach']);
  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.ok(!Object.prototype.hasOwnProperty.call(config, 'base_branch'));
  assert.notEqual(config.base_branch, 'develop');
  assert.ok(!Object.prototype.hasOwnProperty.call(config.pr, 'base'));
  assert.notEqual(config.pr.base, 'develop');
  assert.equal(result.baseBranchUnresolved, true);
});

test('init with an existing base_branch → does not rewrite it', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'keep-me',
  }));
  git(repo, ['init', '-b', 'main']);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const existing = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.equal(existing.base_branch, 'keep-me');
});

test('config.example.json → carries the seven complexity keys equal to the default policy', () => {
  const example = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.example.json'), 'utf8'));
  const policy = DEFAULT_COMPLEXITY_POLICY;
  assert.deepStrictEqual(example.complexity, {
    single_max_source_files: policy.singleMaxSourceFiles,
    single_max_source_lines: policy.singleMaxSourceLines,
    strong_min_source_files: policy.strongMinSourceFiles,
    strong_min_modules: policy.strongMinModules,
    strong_min_total_files: policy.strongMinTotalFiles,
    risk_paths: policy.riskPaths,
    generated_paths: policy.generatedPaths,
  });
});

test('init → writes the exact config.json shape', () => {
  const repo = tmpRepo();
  // Empty tmp repo → no candidate dirs; source_dirs is detected, not hard-coded.
  // tmp 디렉터리는 git이 아니라 탐지가 실패한다. 키를 추측해 넣지 않는다.
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  // 신규 config와 공개 예제 모두 context graph 입력 키를 두지 않는다.
  assert.ok(!Object.hasOwn(cfg, 'context_dirs'));
  assert.ok(!Object.hasOwn(
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.example.json'), 'utf8')),
    'context_dirs',
  ));
  assert.deepStrictEqual(cfg, {
    source_dirs: [],
    graphify: { enabled: true },
    verify: 'npm test',
    verify_allowlist: [...DEFAULT_VERIFY_ALLOWLIST],
    autonomy: 'auto',
    // 신규 config의 pr는 draft만. base는 탐지 성공 시에만 붙는다.
    pr: { draft: true },
    subagents: {
      claude: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
        'bouncer-coordinator': 'inherit',
        'bouncer-planner': 'inherit',
        'bouncer-plan-coordinator': 'inherit',
      },
      cursor: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
        'bouncer-coordinator': 'inherit',
        'bouncer-planner': 'inherit',
        'bouncer-plan-coordinator': 'inherit',
      },
      codex: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
        'bouncer-coordinator': 'inherit',
        'bouncer-planner': 'inherit',
        'bouncer-plan-coordinator': 'inherit',
      },
      antigravity: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
        'bouncer-coordinator': 'inherit',
        'bouncer-planner': 'inherit',
        'bouncer-plan-coordinator': 'inherit',
      },
    },
    // 등급 예시는 전부 inherit(모델 고정 금지). planner만 strong/high, 나머지 여섯은 standard/medium.
    model_tiers: Object.fromEntries(['claude', 'cursor', 'codex', 'antigravity'].map((p) => [
      p, { strong: 'inherit', standard: 'inherit', light: 'inherit' },
    ])),
    roles: {
      ...Object.fromEntries([
        'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
        'bouncer-context-reviewer', 'bouncer-coordinator',
      ].map((a) => [a, { tier: 'standard', effort: 'medium' }])),
      'bouncer-planner': { tier: 'strong', effort: 'high' },
      'bouncer-plan-coordinator': { tier: 'standard', effort: 'medium' },
    },
  });
});

test('init → package.json에 scripts.build가 있으면 worktree.setup을 npm run build로 넣는다', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(config.worktree, { setup: 'npm run build' });
});

test('init → scripts.build가 없는 package.json이면 worktree 키를 만들지 않는다', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.ok(!Object.hasOwn(config, 'worktree'));
});

test('init → 깨진 package.json이면 실패하지 않고 worktree 키를 만들지 않는다', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'package.json'), '{ not json');
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.ok, true);
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.ok(!Object.hasOwn(config, 'worktree'));
});

test('init → 준비된 저장소의 config는 build 스크립트가 있어도 바이트가 바뀌지 않는다', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer'));
  const body = JSON.stringify({ source_dirs: ['src'], verify: 'npm test' });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), body);
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
  git(repo, ['init', '-b', 'main']);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(read(repo, '.bouncer/config.json'), body);
});

test('init → does not create Distill files or distill config', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.ok, true);
  assert.ok(exists(repo, '.bouncer/context/index.md'));
  assert.ok(exists(repo, '.bouncer/config.json'));
  assert.ok(!exists(repo, '.bouncer/Distill.md'));
  assert.ok(!exists(repo, '.bouncer/distill'));
  assert.ok(!res.created.includes('.bouncer/Distill.md'));
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.ok(!Object.prototype.hasOwnProperty.call(config, 'distill'));
});

test('ready init → does not seed Distill settings or rewrite distill keys', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const configPath = path.join(repo, '.bouncer/config.json');
  const missing = JSON.parse(read(repo, '.bouncer/config.json'));
  delete missing.distill;
  fs.writeFileSync(configPath, `${JSON.stringify(missing, null, 2)}\n`);

  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!Object.prototype.hasOwnProperty.call(
    JSON.parse(read(repo, '.bouncer/config.json')),
    'distill',
  ));

  const enabled = JSON.parse(read(repo, '.bouncer/config.json'));
  enabled.distill = { routing_enabled: true, max_bytes: 1024 };
  fs.writeFileSync(configPath, `${JSON.stringify(enabled, null, 2)}\n`);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.bouncer/config.json')).distill, {
    routing_enabled: true,
    max_bytes: 1024,
  });
});

test('init with existing candidate directories → source_dirs detects them in fixed order', () => {
  const repo = tmpRepo();
  // Only lib/ and app/ exist — result order follows SOURCE_DIR_CANDIDATES, not fs order.
  fs.mkdirSync(path.join(repo, 'app'));
  fs.mkdirSync(path.join(repo, 'lib'));
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  // test/tests는 source 후보가 아니라 graphify.test_dirs 후보로 분리한다.
  assert.deepStrictEqual(SOURCE_DIR_CANDIDATES, [
    'src', 'lib', 'app', 'packages', 'scripts',
  ]);
  assert.deepStrictEqual(cfg.source_dirs, ['lib', 'app']);
  assert.notStrictEqual(res.sourceDirsUnresolved, true);
});

test('init with no candidate directories → source_dirs is empty and flagged unresolved', () => {
  const repo = tmpRepo();
  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, []);
  assert.ok(result.sourceDirsUnresolved === true);
});

test('init with existing config source_dirs → does not overwrite them', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['custom'],
    verify: 'npm test',
    base_branch: 'develop',
  }));
  // Candidate dirs exist but must not replace the curated value.
  fs.mkdirSync(path.join(repo, 'src'));
  fs.mkdirSync(path.join(repo, 'lib'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const existing = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(existing.source_dirs, ['custom']);
});

test('init with same-named files instead of directories → ignores them when detecting source_dirs', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'src'), 'not a directory');
  fs.mkdirSync(path.join(repo, 'lib'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, ['lib']);
});

test('init with existing test/tests directories → puts them into graphify.test_dirs not source_dirs', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'src'));
  fs.mkdirSync(path.join(repo, 'test'));
  fs.mkdirSync(path.join(repo, 'tests'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, ['src']);
  assert.deepStrictEqual(cfg.graphify.test_dirs, ['test', 'tests']);
  assert.ok(!cfg.source_dirs.includes('test'));
  assert.ok(!cfg.source_dirs.includes('tests'));
});

test('init with no test directories → omits graphify.test_dirs', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'src'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, ['src']);
  assert.ok(!Object.prototype.hasOwnProperty.call(cfg.graphify, 'test_dirs'));
});

test('init with an existing two-scope config → does not add test_dirs', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src', 'test'],
    verify: 'npm test',
    base_branch: 'main',
    graphify: { enabled: true },
  }));
  fs.mkdirSync(path.join(repo, 'tests'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const existing = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(existing.source_dirs, ['src', 'test']);
  assert.ok(!Object.prototype.hasOwnProperty.call(existing.graphify, 'test_dirs'));
});

test('init config → omits methodology and Superpowers profile fields', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.strictEqual(cfg.methodology, undefined);
  assert.ok(!('methodology' in cfg));
});

test('built-in epic template → records numbered success criteria', () => {
  const epic = TEMPLATES['epic.md'];
  assert.ok(/## Success criteria/.test(epic));
  assert.ok(/^1\. <TODO:/m.test(epic));
});

test('built-in blueprint template → carries Contract-First authoring guardrails', () => {
  const blueprint = TEMPLATES['blueprint.md'];
  const open = '<' + '!--';
  assert.match(blueprint, /수용 기준:/);
  assert.match(blueprint, /검증 명령:/);
  assert.match(blueprint, /실패 모드·엣지 케이스:/);
  assert.ok(!blueprint.includes(open));
});

// OKF §11 permits frontmatter in the bundle-root index.md and nowhere else
// among index files; §6 fixes the body as `* [Title](url) - description` groups.
test('init → writes an OKF-shaped bundle root index', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const index = read(repo, '.bouncer/context/index.md');
  assert.match(index, /^---\nokf_version: "0\.1"\nbouncer_schema: "0\.1"\n---\n/);
  const { data } = parseFrontmatter(index);
  assert.strictEqual(data.okf_version, '0.1');
  assert.strictEqual(data.bouncer_schema, '0.1');
  assert.match(index, /^# Epics$/m);
  assert.match(index, /\* \[00x 제목\]\(epics\/00x-slug\/index\.md\) - /);
});

test('built-in epic and blueprint templates → link their neighbours with relative paths', () => {
  const epic = TEMPLATES['epic.md'];
  const blueprint = TEMPLATES['blueprint.md'];
  // OKF §5.2. A leading `/` (§5.1) would resolve against the repo root on web
  // git hosts and break every link.
  assert.ok(!/\]\(\//.test(epic), 'epic template must not use bundle-absolute links');
  assert.ok(!/\]\(\//.test(blueprint), 'blueprint template must not use bundle-absolute links');
  assert.match(epic, /\]\(blueprints\//);
  assert.match(blueprint, /Epic: \[<EPIC-id>\]\(\.\.\/\.\.\/index\.md\)/);
});

test('init with a pre-existing .gitignore → leaves it byte-for-byte unchanged', () => {
  const repo = tmpRepo();
  const original = Buffer.from('# user rules\n*.secret\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), original);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(fs.readFileSync(path.join(repo, '.gitignore')), original);
});

test('init without a .gitignore → does not create one', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!exists(repo, '.gitignore'));
});

test('init when bootstrap is ready → is idempotent', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const res2 = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res2.skipped, true);
  assert.strictEqual(res2.reason, 'already-initialized');
  assert.deepStrictEqual(res2.created, []);
});

test('inspectBootstrap on missing, ready, partial, and legacy states → distinguishes them without writes', () => {
  const repo = tmpRepo();
  assert.strictEqual(inspectBootstrap({ repoRoot: repo }), 'missing');

  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{}\n');
  assert.strictEqual(inspectBootstrap({ repoRoot: repo }), 'partial');

  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'develop',
  }));
  assert.strictEqual(inspectBootstrap({ repoRoot: repo }), 'ready');

  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{broken');
  assert.strictEqual(inspectBootstrap({ repoRoot: repo }), 'partial');

  fs.mkdirSync(path.join(repo, ['.', 's', 'd', 'd'].join('')));
  assert.strictEqual(inspectBootstrap({ repoRoot: repo }), 'legacy');
  assert.strictEqual(read(repo, '.bouncer/config.json'), '{broken');
});

test('init with partial user-authored Bouncer state → preserves it', () => {
  const repo = tmpRepo();
  const custom = '{"note":"do not replace"}\n';
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/notes.json'), custom);

  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });

  assert.deepStrictEqual(result, {
    ok: false,
    created: [],
    skipped: true,
    reason: 'partial-bouncer-state',
  });
  assert.strictEqual(read(repo, '.bouncer/notes.json'), custom);
  assert.ok(!exists(repo, '.bouncer/config.json'));
});

test('plugin governance materials → have no Superpowers profile language', () => {
  const root = path.join(__dirname, '..');
  const schema = fs.readFileSync(path.join(root, 'rules/document-schema.md'), 'utf8');
  assert.ok(!/superpowers|methodology\.profile|profile-aware/i.test(schema));
});

test('init in a repo without .gitignore → reports the gitignore entries it should add', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, [
    'node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/',
    '.bouncer/runtime/',
  ]);
  assert.ok(!exists(repo, '.gitignore'), 'init must not write .gitignore');
});

test('init with a partial .gitignore → suggests only the missing entries', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), '# deps\nnode_modules\n');
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, [
    'graphify-out/', '.worktrees/', '.bouncer/.venv/', '.bouncer/runtime/',
  ]);
  assert.strictEqual(read(repo, '.gitignore'), '# deps\nnode_modules\n');
});

test('init when the artifacts are already ignored → suggests nothing', () => {
  const repo = tmpRepo();
  fs.writeFileSync(
    path.join(repo, '.gitignore'),
    'node_modules/\ngraphify-out/\n.worktrees/\n.bouncer/.venv/\n.bouncer/runtime/\n',
  );
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, []);
});


test('init with an existing Distill file → leaves it untouched and does not create one', () => {
  const repo = tmpRepo();
  const first = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!first.created.includes('.bouncer/Distill.md'));
  const custom = '# Distill\n\n## Invariants\n\n- keep me\n';
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), custom);
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!again.created.includes('.bouncer/Distill.md'));
  assert.strictEqual(read(repo, '.bouncer/Distill.md'), custom);
});

test('init with legacy .bouncer/context/Distill.md → does not migrate it', () => {
  const repo = tmpRepo();
  const legacy = `---
title: Project Distill
resource: .bouncer/context/Distill.md
---
# Distill

## Invariants

- migrated note
`;
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/context/Distill.md'), legacy);
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!res.created.includes('.bouncer/Distill.md'));
  assert.ok(fs.existsSync(path.join(repo, '.bouncer/context/Distill.md')));
  assert.ok(!exists(repo, '.bouncer/Distill.md'));
});

test('init on an already-initialized repo → reports gitignore suggestions', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(again.reason, 'already-initialized');
  assert.deepStrictEqual(again.gitignoreSuggestions, [
    'node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/',
    '.bouncer/runtime/',
  ]);
});

test('init install on a git repo → does not create worktree .bouncer/.venv', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  const { setupGraphify } = require('../packages/cli/dist/graphify');
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    graphify: {
      install: true,
      setup: ({ repoRoot: root }) => setupGraphify({
        repoRoot: root,
        platform: 'linux',
        exec: () => {},
      }),
    },
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.graphifyInstall.status, 'installed');
  assert.ok(path.isAbsolute(res.graphifyInstall.bin));
  assert.ok(!res.graphifyInstall.bin.startsWith(path.join(repo, '.bouncer')));
  assert.ok(!exists(repo, '.bouncer/.venv'));
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.strictEqual(cfg.graphify.enabled, true);
  assert.strictEqual(cfg.graphify.bin, res.graphifyInstall.bin);
});

test('ready bootstrap with promote and a failed install → keeps graphify.enabled false', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const existing = {
    source_dirs: ['custom'],
    verify: 'make test',
    base_branch: 'main',
    graphify: { enabled: false },
  };
  fs.writeFileSync(cfgPath, `${JSON.stringify(existing, null, 2)}\n`);
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    promote: true,
    graphify: {
      install: true,
      setup: () => ({ status: 'failed', bin: null, reason: 'venv: no python' }),
    },
  });
  assert.strictEqual(res.graphifyPromotion, 'promoted');
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.strictEqual(cfg.graphify.enabled, false);
});

test('init with install:true → writes graphify bin from injected setup', () => {
  const repo = tmpRepo();
  const bin = '.bouncer/.venv/bin/graphify';
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    graphify: {
      install: true,
      setup: () => ({ status: 'installed', bin }),
    },
  });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.graphifyInstall, { status: 'installed', bin });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.graphify, { enabled: true, bin });
});

test('init with a failed setup → keeps ok and disables graphify', () => {
  const repo = tmpRepo();
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    graphify: {
      install: true,
      setup: () => ({ status: 'failed', bin: null, reason: 'venv: no python' }),
    },
  });
  assert.strictEqual(res.ok, true);
  assert.ok(res.graphifyInstall && res.graphifyInstall.reason);
  assert.match(res.graphifyInstall.reason, /venv/);
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.graphify, { enabled: false });
});

test('init without install → does not call setup', () => {
  const repo = tmpRepo();
  let called = 0;
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    graphify: {
      setup: () => {
        called += 1;
        return { status: 'installed', bin: '.bouncer/.venv/bin/graphify' };
      },
    },
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(called, 0);
  assert.strictEqual(res.graphifyInstall, undefined);
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.graphify, { enabled: true });
});

test('ready bootstrap without promote → reports candidate and leaves config bytes intact', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const disabled = {
    source_dirs: ['src'],
    graphify: { enabled: false },
    verify: 'npm test',
    base_branch: 'develop',
    pr: { draft: true, base: 'develop', labels: ['bouncer'] },
    subagents: { claude: { 'bouncer-reviewer': 'inherit' } },
  };
  const original = Buffer.from(`${JSON.stringify(disabled, null, 2)}\n`);
  fs.writeFileSync(cfgPath, original);
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.graphifyPromotion, 'candidate');
  assert.deepStrictEqual(fs.readFileSync(cfgPath), original);
});

test('ready bootstrap with promote:true → flips only graphify.enabled', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const existing = {
    source_dirs: ['custom'],
    graphify: { enabled: false },
    verify: 'make test',
    base_branch: 'main',
    pr: { draft: false, base: 'main', labels: [] },
    subagents: {
      cursor: { 'bouncer-reviewer': 'inherit' },
    },
  };
  fs.writeFileSync(cfgPath, `${JSON.stringify(existing, null, 2)}\n`);
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    promote: true,
  });
  assert.strictEqual(res.graphifyPromotion, 'promoted');
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.ok(!Object.hasOwn(cfg, 'context_dirs'));
  assert.strictEqual(cfg.graphify.enabled, true);
  assert.deepStrictEqual(cfg.verify, 'make test');
  assert.deepStrictEqual(cfg.base_branch, 'main');
  assert.deepStrictEqual(cfg.source_dirs, ['custom']);
  assert.deepStrictEqual(cfg.subagents, existing.subagents);
});

test('ready bootstrap with promote and install → records bin and preserves other keys', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const bin = '.bouncer/.venv/bin/graphify';
  const existing = {
    source_dirs: ['custom'],
    graphify: { enabled: false },
    verify: 'make test',
    base_branch: 'main',
    pr: { draft: false, base: 'main', labels: [] },
    subagents: {
      cursor: { 'bouncer-reviewer': 'inherit' },
    },
  };
  fs.writeFileSync(cfgPath, `${JSON.stringify(existing, null, 2)}\n`);
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    promote: true,
    graphify: {
      install: true,
      setup: () => ({ status: 'installed', bin }),
    },
  });
  assert.strictEqual(res.graphifyPromotion, 'promoted');
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.ok(!Object.hasOwn(cfg, 'context_dirs'));
  assert.strictEqual(cfg.graphify.enabled, true);
  assert.strictEqual(cfg.graphify.bin, bin);
  assert.deepStrictEqual(cfg.verify, 'make test');
  assert.deepStrictEqual(cfg.base_branch, 'main');
  assert.deepStrictEqual(cfg.source_dirs, ['custom']);
  assert.deepStrictEqual(cfg.subagents, existing.subagents);
});

test('writeGitignore:true → upserts a single # bouncer marker block with .venv', () => {
  const repo = tmpRepo();
  const giPath = path.join(repo, '.gitignore');
  fs.writeFileSync(giPath, '# keep me\n*.secret\n');
  const once = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    writeGitignore: true,
  });
  assert.strictEqual(once.gitignoreWritten, true);
  const twice = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    writeGitignore: true,
  });
  assert.strictEqual(twice.gitignoreWritten, true);
  const body = read(repo, '.gitignore');
  assert.strictEqual((body.match(/^# bouncer$/mg) || []).length, 1);
  assert.strictEqual((body.match(/^# \/bouncer$/mg) || []).length, 1);
  assert.match(body, /^# bouncer\n[\s\S]*\.bouncer\/\.venv\/\n[\s\S]*# \/bouncer/m);
  assert.match(body, /^# keep me$/m);
  assert.match(body, /^\*\.secret$/m);
});

test('writeGitignore with substring lookalikes outside the marker block → preserves them', () => {
  const repo = tmpRepo();
  const giPath = path.join(repo, '.gitignore');
  fs.writeFileSync(giPath, '# bouncer note\n*.secret\n');
  init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    writeGitignore: true,
  });
  const body = read(repo, '.gitignore');
  assert.match(body, /^# bouncer note$/m);
  assert.match(body, /^\*\.secret$/m);
  assert.strictEqual((body.match(/^# bouncer$/mg) || []).length, 1);
  assert.strictEqual((body.match(/^# \/bouncer$/mg) || []).length, 1);
  // lookalike는 마커가 아니므로 블록이 파일 끝에 붙고, 기존 줄은 그대로다.
  assert.match(body, /^# bouncer note\n\*\.secret\n# bouncer\n/);
});

test('writeGitignore without the flag → leaves .gitignore bytes unchanged and does not create it', () => {
  const repo = tmpRepo();
  const original = Buffer.from('# user rules\n*.secret\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), original);
  const withGi = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(withGi.gitignoreWritten, false);
  assert.deepStrictEqual(fs.readFileSync(path.join(repo, '.gitignore')), original);

  const empty = tmpRepo();
  const noGi = init({ repoRoot: empty, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(noGi.gitignoreWritten, false);
  assert.ok(!exists(empty, '.gitignore'));
});

test('init without a .codex/ signal → does not seed Codex agents', () => {
  const repo = tmpRepo();
  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.equal(result.created.filter((p) => p.startsWith('.codex/')).length, 0);
  assert.ok(!exists(repo, '.codex'));
  assert.notEqual(result.reason, 'codex-agents-seeded');
});

test('init when .codex/ already exists → seeds seven Codex tomls', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  const res = withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  const { GENERATED_MARKER } = require('../packages/cli/dist/codex-agents');
  for (const name of [
    'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
    'bouncer-context-reviewer', 'bouncer-coordinator',
    'bouncer-planner', 'bouncer-plan-coordinator',
  ]) {
    const rel = `.codex/agents/${name}.toml`;
    assert.ok(res.created.includes(rel), `missing ${rel} in created`);
    const toml = read(repo, rel);
    assert.ok(toml.startsWith(GENERATED_MARKER));
    assert.match(toml, new RegExp(`name = "${name}"`));
  }
});

test('init with an unmarked Codex toml → leaves it byte-for-byte unchanged', () => {
  const repo = tmpRepo();
  const rel = '.codex/agents/bouncer-implementer.toml';
  fs.mkdirSync(path.join(repo, '.codex/agents'), { recursive: true });
  const owned = 'name = "custom"\n';
  fs.writeFileSync(path.join(repo, rel), owned);
  withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  assert.strictEqual(read(repo, rel), owned);
});

test('init with plugin markdown agents → seeds Codex named-agent toml from them', () => {
  const repo = tmpRepo();
  const res = withBouncerHome(() => init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    seedCodexAgents: true,
  }));
  const { GENERATED_MARKER } = require('../packages/cli/dist/codex-agents');
  for (const name of [
    'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
    'bouncer-context-reviewer', 'bouncer-coordinator',
    'bouncer-planner', 'bouncer-plan-coordinator',
  ]) {
    const rel = `.codex/agents/${name}.toml`;
    assert.ok(res.created.includes(rel), `missing ${rel} in created`);
    const toml = read(repo, rel);
    assert.ok(toml.startsWith(GENERATED_MARKER));
    assert.match(toml, new RegExp(`name = "${name}"`));
  }
});

test('init with generated and user-owned Codex files → refreshes generated toml and leaves user-owned files', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  const generated = '.codex/agents/bouncer-reviewer.toml';
  const owned = '.codex/agents/bouncer-implementer.toml';
  fs.writeFileSync(path.join(repo, generated), '# bouncer-generated\nstale = true\n');
  fs.writeFileSync(path.join(repo, owned), 'name = "custom"\n');
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(again.reason, 'already-initialized');
  assert.deepStrictEqual(again.created, []);
  assert.match(read(repo, generated), /name = "bouncer-reviewer"/);
  assert.strictEqual(read(repo, owned), 'name = "custom"\n');
});

const effortOf = (toml) => toml.split('\n').filter((line) => line.startsWith('model_reasoning_effort'));

test('fresh init seeding Codex agents → writes each template role effort into its toml', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  // init 템플릿은 planner만 high, 나머지는 medium이다.
  assert.deepStrictEqual(effortOf(read(repo, '.codex/agents/bouncer-planner.toml')), [
    'model_reasoning_effort = "high"',
  ]);
  assert.deepStrictEqual(effortOf(read(repo, '.codex/agents/bouncer-reviewer.toml')), [
    'model_reasoning_effort = "medium"',
  ]);
});

test('ready init after a roles effort change → refreshes generated toml and keeps user-owned files', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  const owned = '.codex/agents/bouncer-implementer.toml';
  fs.writeFileSync(path.join(repo, owned), 'name = "custom"\n');
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.roles['bouncer-reviewer'] = { tier: 'standard', effort: 'low' };
  cfg.roles['bouncer-implementer'] = { tier: 'standard', effort: 'high' };
  cfg.roles['bouncer-debugger'] = { tier: 'standard', effort: null };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  const again = withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  assert.strictEqual(again.ok, true);
  assert.deepStrictEqual(effortOf(read(repo, '.codex/agents/bouncer-reviewer.toml')), [
    'model_reasoning_effort = "low"',
  ]);
  assert.deepStrictEqual(effortOf(read(repo, '.codex/agents/bouncer-debugger.toml')), [
    'model_reasoning_effort = "medium"',
  ]);
  assert.strictEqual(read(repo, owned), 'name = "custom"\n');
});

test('ready init with an invalid roles effort → rejects with the config key before writing any file', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  const generated = '.codex/agents/bouncer-reviewer.toml';
  fs.writeFileSync(path.join(repo, generated), '# bouncer-generated\nstale = true\n');
  fs.rmSync(path.join(repo, '.codex/agents/bouncer-debugger.toml'));
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.roles['bouncer-coordinator'] = { tier: 'standard', effort: 'maximum' };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  const cfgBefore = fs.readFileSync(cfgPath);

  const res = withBouncerHome(() => init({
    repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z', writeGitignore: true,
  }));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'role-config-invalid');
  assert.strictEqual(res.key, 'roles.bouncer-coordinator.effort');
  assert.match(res.next, /roles\.bouncer-coordinator\.effort/);
  assert.deepStrictEqual(res.created, []);
  assert.strictEqual(read(repo, generated), '# bouncer-generated\nstale = true\n');
  assert.ok(!exists(repo, '.codex/agents/bouncer-debugger.toml'));
  assert.ok(!exists(repo, '.gitignore'));
  assert.deepStrictEqual(fs.readFileSync(cfgPath), cfgBefore);
});

test('ready init with an invalid roles effort and no Codex signal → stays already-initialized', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.roles['bouncer-coordinator'] = { tier: 'standard', effort: 'maximum' };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.reason, 'already-initialized');
});

test('ready init with missing Codex toml → seeds it without touching Distill reason', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  fs.rmSync(path.join(repo, '.codex/agents'), { recursive: true, force: true });
  const again = withBouncerHome(() => init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' }));
  assert.strictEqual(again.reason, 'codex-agents-seeded');
  assert.ok(again.created.includes('.codex/agents/bouncer-reviewer.toml'));
  assert.ok(!again.created.includes('.bouncer/Distill.md'));
});

test('init first install → writes a graphify lock from the exact install spec', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    graphify: {
      install: true,
      setup: ({ repoRoot: root }) => setupGraphify({
        repoRoot: root,
        platform: 'linux',
        now: () => '2026-07-01T00:00:00.000+09:00',
        exec: (file, args = []) => {
          if (args[0] === '--version') return '0.9.56\n';
          if (args[0] === 'show') return 'Version: 0.9.56\n';
          return '';
        },
      }),
    },
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.graphifyInstall.status, 'installed');
  const lock = readGraphifyLock({ repoRoot: repo });
  assert.strictEqual(lock.ok, true);
  assert.strictEqual(lock.value.package, 'graphifyy');
  assert.strictEqual(lock.value.cli_version, '0.9.56');
  assert.strictEqual(lock.value.package_version, '0.9.56');
});

test('ready init with an existing lock → reuses it and reports upgrade available', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const lockPath = path.join(repo, GRAPHIFY_LOCK_REL);
  const stale = {
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  };
  fs.writeFileSync(lockPath, `${JSON.stringify(stale, null, 2)}\n`);
  const before = fs.readFileSync(lockPath);
  let upgraded = 0;
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    graphify: {
      upgrade: () => {
        upgraded += 1;
        return { status: 'upgraded', bin: null };
      },
    },
  });
  assert.strictEqual(res.reason, 'already-initialized');
  assert.strictEqual(res.graphifyUpgradeAvailable, true);
  assert.strictEqual(upgraded, 0);
  assert.deepStrictEqual(fs.readFileSync(lockPath), before);
});

test('ready init --upgrade-graphify → calls upgrade and does not keep a stale lock', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const lockPath = path.join(repo, GRAPHIFY_LOCK_REL);
  fs.writeFileSync(lockPath, `${JSON.stringify({
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  }, null, 2)}\n`);
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    upgradeGraphify: true,
    graphify: {
      upgrade: ({ repoRoot: root }) => {
        fs.writeFileSync(path.join(root, GRAPHIFY_LOCK_REL), `${JSON.stringify({
          schema_version: 1,
          package: 'graphifyy',
          package_version: '0.9.56',
          cli_version: '0.9.56',
          bouncer_version: '1.5.9',
          graph_schema_version: '1',
          installed_at: '2026-09-10T00:00:00.000+09:00',
        }, null, 2)}\n`);
        return { status: 'upgraded', bin: '/abs/graphify' };
      },
    },
  });
  assert.strictEqual(res.graphifyUpgrade.status, 'upgraded');
  const lock = JSON.parse(read(repo, GRAPHIFY_LOCK_REL));
  assert.strictEqual(lock.cli_version, '0.9.56');
});

test('ready init after .codex/ is removed → does not recreate it', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  fs.rmSync(path.join(repo, '.codex'), { recursive: true, force: true });
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.equal(again.created.filter((p) => p.startsWith('.codex/')).length, 0);
  assert.ok(!exists(repo, '.codex'));
  assert.notEqual(again.reason, 'codex-agents-seeded');
});

test('init without the preCommitHook option → omits preCommitHook', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.preCommitHook, undefined);
});

test('init with preCommitHook on a git repo → installs a marked hook', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z', preCommitHook: true });
  assert.strictEqual(res.preCommitHook, 'installed');
  const common = git(repo, ['rev-parse', '--git-common-dir']).trim();
  const hook = path.join(path.resolve(repo, common), 'hooks', 'pre-commit');
  assert.match(fs.readFileSync(hook, 'utf8'), /^#!\/bin\/sh\n# bouncer-pre-commit v1\n/);
});

// ---- epic 등록부 bootstrap ----
const TS = '2026-07-01T00:00:00.000Z';
const COMMON_SLUGS = [
  'foundation', 'core', 'data', 'integration', 'identity-access', 'interface', 'features', 'quality-ops',
];

// 등록부만 없는 ready 저장소: config를 직접 쓰고 기존 epic 디렉터리를 심는다.
function readyRepoWithEpics(dirs) {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'),
    `${JSON.stringify({ source_dirs: [], verify: 'true' })}\n`);
  for (const dir of dirs) {
    const abs = path.join(repo, '.bouncer/context/epics', dir);
    fs.mkdirSync(abs, { recursive: true });
    fs.writeFileSync(path.join(abs, 'index.md'), `existing ${dir}\n`);
  }
  return repo;
}

test('fresh repo init → writes registry and 8 common epics, rerun created is empty', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: TS });
  assert.ok(res.created.includes('.bouncer/epics.json'));
  COMMON_SLUGS.forEach((slug, i) => {
    const rel = `.bouncer/context/epics/${String(i + 1).padStart(3, '0')}-${slug}/index.md`;
    assert.ok(res.created.includes(rel), rel);
    assert.strictEqual(parseFrontmatter(read(repo, rel)).data.bouncer.status, 'draft');
  });
  const registry = JSON.parse(read(repo, '.bouncer/epics.json'));
  assert.strictEqual(registry.profile, 'standard');
  assert.strictEqual(registry.domainEpicLimit, 0);
  assert.deepStrictEqual(init({ repoRoot: repo, timestamp: TS }).created, []);
});

test('ready repo with 005-core and 010-misc → core keeps id 005, misc is legacy, new commons follow 010', () => {
  const repo = readyRepoWithEpics(['005-core', '010-misc']);
  const res = init({ repoRoot: repo, timestamp: TS });
  assert.strictEqual(res.ok, true);
  const { epics } = JSON.parse(read(repo, '.bouncer/epics.json'));
  const byId = Object.fromEntries(epics.map((e) => [e.slug, e]));
  assert.deepStrictEqual([byId.core.id, byId.core.kind], ['005', 'common']);
  assert.deepStrictEqual([byId.misc.id, byId.misc.kind], ['010', 'legacy']);
  const fresh = COMMON_SLUGS.filter((s) => s !== 'core').map((s) => byId[s].id);
  assert.deepStrictEqual(fresh, ['011', '012', '013', '014', '015', '016', '017']);
  assert.ok(exists(repo, '.bouncer/context/epics/011-foundation/index.md'));
});

test('ready repo with existing epic files → contents unchanged after init', () => {
  const repo = readyRepoWithEpics(['005-core', '010-misc']);
  const before = [read(repo, '.bouncer/context/epics/005-core/index.md'),
    read(repo, '.bouncer/context/epics/010-misc/index.md')];
  init({ repoRoot: repo, timestamp: TS });
  assert.deepStrictEqual([read(repo, '.bouncer/context/epics/005-core/index.md'),
    read(repo, '.bouncer/context/epics/010-misc/index.md')], before);
});

test('profile domain-only with limit 8 → every epic legacy and no common directories', () => {
  const repo = readyRepoWithEpics(['005-core', '010-misc']);
  const res = init({ repoRoot: repo, timestamp: TS, profile: 'domain-only', domainEpicLimit: 8 });
  assert.strictEqual(res.ok, true);
  const registry = JSON.parse(read(repo, '.bouncer/epics.json'));
  assert.strictEqual(registry.profile, 'domain-only');
  assert.strictEqual(registry.domainEpicLimit, 8);
  assert.deepStrictEqual(registry.epics.map((e) => e.kind), ['legacy', 'legacy']);
  assert.ok(!exists(repo, '.bouncer/context/epics/011-foundation'));
});

test('ready repo with two core directories → fails with duplicate reason and writes no registry', () => {
  const repo = readyRepoWithEpics(['002-core', '009-core']);
  const res = init({ repoRoot: repo, timestamp: TS });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.reason, 'epic-registry-duplicate-common-slug');
  assert.ok(!exists(repo, '.bouncer/epics.json'));
});
