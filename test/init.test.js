'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { init, inspectBootstrap, SOURCE_DIR_CANDIDATES } = require('../scripts/lib/init');
const { TEMPLATES } = require('../scripts/lib/templates');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

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

test('init scaffolds the safe .bouncer tree', () => {
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
  assert.ok(!exists(repo, '.bouncer/okf.md'));
  assert.ok(!exists(repo, '.bouncer/current'));
  assert.ok(!exists(repo, 'context/index.md'));
  assert.ok(!exists(repo, '.bouncer/superpowers.md'));
});

test('init does not write a Superpowers preference document', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!exists(repo, '.bouncer/superpowers.md'));
});

test('init detects base_branch and pr.base from git init -b main', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.equal(config.base_branch, 'main');
  assert.equal(config.pr.base, 'main');
});

test('init prefers origin/HEAD over the current checkout branch', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  git(repo, ['remote', 'add', 'origin', 'https://example.invalid/repo.git']);
  git(repo, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/trunk']);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.equal(config.base_branch, 'trunk');
  assert.equal(config.pr.base, 'trunk');
});

test('init omits base_branch when origin/HEAD and HEAD cannot be resolved', () => {
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

test('init does not rewrite an existing base_branch', () => {
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

test('init writes the exact config.json shape', () => {
  const repo = tmpRepo();
  // Empty tmp repo → no candidate dirs; source_dirs is detected, not hard-coded.
  // tmp 디렉터리는 git이 아니라 탐지가 실패한다. 키를 추측해 넣지 않는다.
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.bouncer/config.json')), {
    source_dirs: [],
    context_dirs: ['.bouncer/context'],
    graphify: { enabled: true },
    distill: { routing_enabled: false, max_bytes: 6144 },
    verify: 'npm test',
    autonomy: 'auto',
    // 신규 config의 pr는 draft만. base는 탐지 성공 시에만 붙는다.
    pr: { draft: true },
    subagents: {
      claude: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
      cursor: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
      codex: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
      antigravity: {
        'bouncer-reviewer': 'inherit',
        'bouncer-implementer': 'inherit',
        'bouncer-debugger': 'inherit',
        'bouncer-context-reviewer': 'inherit',
      },
    },
  });
});

test('init seeds disabled Distill routing defaults without creating shards', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const legacy = '# Project Distill\n\n## Decisions\n\nkeep this single file\n';
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), legacy);

  const first = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const configPath = path.join(repo, '.bouncer/config.json');
  const firstConfig = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.strictEqual(first.ok, true);
  assert.deepStrictEqual(firstConfig.distill, {
    routing_enabled: false,
    max_bytes: 6144,
  });
  assert.strictEqual(read(repo, '.bouncer/Distill.md'), legacy);
  assert.ok(!exists(repo, '.bouncer/distill'));

  const before = fs.readFileSync(configPath);
  const second = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(second.reason, 'already-initialized');
  assert.deepStrictEqual(fs.readFileSync(configPath), before);
  assert.strictEqual(read(repo, '.bouncer/Distill.md'), legacy);
});

test('ready init seeds missing disabled Distill settings but preserves enabled routing', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const configPath = path.join(repo, '.bouncer/config.json');
  const config = JSON.parse(read(repo, '.bouncer/config.json'));
  delete config.distill;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.bouncer/config.json')).distill, {
    routing_enabled: false,
    max_bytes: 6144,
  });

  const enabled = JSON.parse(read(repo, '.bouncer/config.json'));
  enabled.distill.routing_enabled = true;
  fs.writeFileSync(configPath, `${JSON.stringify(enabled, null, 2)}\n`);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(JSON.parse(read(repo, '.bouncer/config.json')).distill.routing_enabled, true);
});

test('init source_dirs detects existing candidate directories in fixed order', () => {
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

test('init source_dirs is empty and flags unresolved when no candidates exist', () => {
  const repo = tmpRepo();
  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, []);
  assert.ok(result.sourceDirsUnresolved === true);
});

test('init does not overwrite existing config source_dirs', () => {
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

test('init ignores same-named files when detecting source_dirs', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, 'src'), 'not a directory');
  fs.mkdirSync(path.join(repo, 'lib'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, ['lib']);
});

test('init puts existing test/tests into graphify.test_dirs not source_dirs', () => {
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

test('init omits graphify.test_dirs when no test directories exist', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, 'src'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, ['src']);
  assert.ok(!Object.prototype.hasOwnProperty.call(cfg.graphify, 'test_dirs'));
});

test('init does not add test_dirs to an existing two-scope config', () => {
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

test('init config omits methodology and Superpowers profile fields', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.strictEqual(cfg.methodology, undefined);
  assert.ok(!('methodology' in cfg));
});

test('built-in tasks template has five implementation-ready sections', () => {
  const tasks = TEMPLATES['tasks.md'];
  assert.ok(/## Goal & intent/.test(tasks));
  assert.ok(/## Interface/.test(tasks));
  assert.ok(/## Touch/.test(tasks));
  assert.ok(/## Do not touch/.test(tasks));
  assert.ok(/## Checklist/.test(tasks));
});

test('built-in tasks template carries a Constraints section for non-path rules', () => {
  const tasks = TEMPLATES['tasks.md'];
  assert.ok(/## Constraints/.test(tasks));
  // Between Do not touch and Checklist so the section parser bounds it.
  assert.ok(tasks.indexOf('## Constraints') > tasks.indexOf('## Do not touch'));
  assert.ok(tasks.indexOf('## Constraints') < tasks.indexOf('## Checklist'));
});

test('built-in epic template records numbered success criteria', () => {
  const epic = TEMPLATES['epic.md'];
  assert.ok(/## Success criteria/.test(epic));
  assert.ok(/^1\. <TODO:/m.test(epic));
});

test('built-in blueprint/tasks templates carry Contract-First authoring guardrails', () => {
  const blueprint = TEMPLATES['blueprint.md'];
  const tasks = TEMPLATES['tasks.md'];
  assert.match(blueprint, /Contract-First/);
  assert.match(blueprint, /금지:/);
  assert.match(blueprint, /~250줄/);
  assert.match(blueprint, /수용 기준:/);
  assert.match(blueprint, /검증 명령:/);
  assert.match(blueprint, /실패 모드·엣지 케이스:/);
  assert.match(tasks, /수용 기준/);
  assert.match(tasks, /검증 명령/);
  // Plain-text guidance must not fill sections — placeholders remain.
  assert.match(tasks, /<TODO:/);
});

// OKF §11 permits frontmatter in the bundle-root index.md and nowhere else
// among index files; §6 fixes the body as `* [Title](url) - description` groups.
test('init writes an OKF-shaped bundle root index', () => {
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

test('built-in epic and blueprint templates link their neighbours with relative paths', () => {
  const epic = TEMPLATES['epic.md'];
  const blueprint = TEMPLATES['blueprint.md'];
  // OKF §5.2. A leading `/` (§5.1) would resolve against the repo root on web
  // git hosts and break every link.
  assert.ok(!/\]\(\//.test(epic), 'epic template must not use bundle-absolute links');
  assert.ok(!/\]\(\//.test(blueprint), 'blueprint template must not use bundle-absolute links');
  assert.match(epic, /\]\(blueprints\//);
  assert.match(blueprint, /Epic: \[<EPIC-id>\]\(\.\.\/\.\.\/index\.md\)/);
  assert.match(blueprint, /\* \[Tasks\]\(tasks\/001\/tasks\.md\) - /);
  assert.match(blueprint, /\* \[Verification\]\(tasks\/001\/verification\.md\) - /);
  assert.match(blueprint, /\* \[Review\]\(tasks\/001\/review\.md\) - /);
});

test('init leaves a pre-existing .gitignore byte-for-byte unchanged', () => {
  const repo = tmpRepo();
  const original = Buffer.from('# user rules\n*.secret\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), original);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(fs.readFileSync(path.join(repo, '.gitignore')), original);
});

test('init does not create .gitignore', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(!exists(repo, '.gitignore'));
});

test('init is idempotent when bootstrap is ready', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const res2 = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res2.skipped, true);
  assert.strictEqual(res2.reason, 'already-initialized');
  assert.deepStrictEqual(res2.created, []);
});

test('inspectBootstrap distinguishes missing, ready, partial, and legacy without writes', () => {
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

test('init preserves partial user-authored Bouncer state', () => {
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

test('init workflow materials live in plugin docs, not the project tree', () => {
  const root = path.join(__dirname, '..');
  const workflow = fs.readFileSync(path.join(root, 'docs/workflow.md'), 'utf8');
  assert.ok(/\/bouncer-init/.test(workflow));
  assert.ok(/\/bouncer-plan/.test(workflow));
  assert.ok(/\/bouncer-execute/.test(workflow));
  assert.ok(/\/bouncer-finalize/.test(workflow));
  assert.ok(!/superpowers|profile-aware|methodology/i.test(workflow));
});

test('plugin governance materials have no Superpowers profile language', () => {
  const root = path.join(__dirname, '..');
  const gov = fs.readFileSync(path.join(root, 'rules/governance.md'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, 'docs/workflow.md'), 'utf8');
  const okf = fs.readFileSync(path.join(root, 'rules/okf.md'), 'utf8');
  const all = gov + workflow + okf;
  assert.ok(!/superpowers|methodology\.profile|profile-aware/i.test(all));
});

test('init reports the gitignore entries a repo without .gitignore should add', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, [
    'node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/',
  ]);
  assert.ok(!exists(repo, '.gitignore'), 'init must not write .gitignore');
});

test('init suggests only the entries .gitignore is missing', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), '# deps\nnode_modules\n');
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, [
    'graphify-out/', '.worktrees/', '.bouncer/.venv/',
  ]);
  assert.strictEqual(read(repo, '.gitignore'), '# deps\nnode_modules\n');
});

test('init suggests nothing when the artifacts are already ignored', () => {
  const repo = tmpRepo();
  fs.writeFileSync(
    path.join(repo, '.gitignore'),
    'node_modules/\ngraphify-out/\n.worktrees/\n.bouncer/.venv/\n',
  );
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, []);
});


test('init creates .bouncer/Distill.md with Invariants Gotchas Decisions', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(res.created.includes('.bouncer/Distill.md'));
  const body = read(repo, '.bouncer/Distill.md');
  assert.match(body, /## Invariants/);
  assert.match(body, /## Gotchas/);
  assert.match(body, /## Decisions/);
  assert.match(body, /resource: \.bouncer\/Distill\.md/);
});

test('init does not overwrite an existing project Distill', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const custom = '# Distill\n\n## Invariants\n\n- keep me\n';
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), custom);
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(again.reason, 'already-initialized');
  assert.strictEqual(read(repo, '.bouncer/Distill.md'), custom);
});

test('init seeds Distill when bootstrap is ready but Distill is missing', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  fs.unlinkSync(path.join(repo, '.bouncer/Distill.md'));
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(again.created.includes('.bouncer/Distill.md'));
  assert.match(read(repo, '.bouncer/Distill.md'), /## Invariants/);
});

test('init migrates legacy .bouncer/context/Distill.md to .bouncer/Distill.md', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  fs.unlinkSync(path.join(repo, '.bouncer/Distill.md'));
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
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.ok(again.created.includes('.bouncer/Distill.md'));
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/context/Distill.md')));
  const body = read(repo, '.bouncer/Distill.md');
  assert.match(body, /resource: \.bouncer\/Distill\.md/);
  assert.match(body, /migrated note/);
});

test('init reports gitignore suggestions on an already-initialized repo', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(again.reason, 'already-initialized');
  assert.deepStrictEqual(again.gitignoreSuggestions, [
    'node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/',
  ]);
});

test('init install on a git repo does not create worktree .bouncer/.venv', () => {
  const repo = tmpRepo();
  git(repo, ['init', '-b', 'main']);
  const { setupGraphify } = require('../scripts/lib/graphify');
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

test('ready bootstrap promote+failed install keeps graphify.enabled false', () => {
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

test('init with install:true writes graphify bin from injected setup', () => {
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

test('init with failed setup keeps ok and disables graphify', () => {
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

test('init without install does not call setup', () => {
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

test('ready bootstrap without promote reports candidate and leaves config bytes intact', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const disabled = {
    source_dirs: ['src'],
    context_dirs: ['.bouncer/context'],
    graphify: { enabled: false },
    distill: { routing_enabled: false, max_bytes: 65536 },
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

test('ready bootstrap with promote:true flips only graphify.enabled', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const existing = {
    source_dirs: ['custom'],
    context_dirs: ['.bouncer/context'],
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
  assert.strictEqual(cfg.graphify.enabled, true);
  assert.deepStrictEqual(cfg.verify, 'make test');
  assert.deepStrictEqual(cfg.base_branch, 'main');
  assert.deepStrictEqual(cfg.source_dirs, ['custom']);
  assert.deepStrictEqual(cfg.subagents, existing.subagents);
});

test('ready bootstrap promote+install records bin and preserves other keys', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfgPath = path.join(repo, '.bouncer/config.json');
  const bin = '.bouncer/.venv/bin/graphify';
  const existing = {
    source_dirs: ['custom'],
    context_dirs: ['.bouncer/context'],
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
  assert.strictEqual(cfg.graphify.enabled, true);
  assert.strictEqual(cfg.graphify.bin, bin);
  assert.deepStrictEqual(cfg.verify, 'make test');
  assert.deepStrictEqual(cfg.base_branch, 'main');
  assert.deepStrictEqual(cfg.source_dirs, ['custom']);
  assert.deepStrictEqual(cfg.subagents, existing.subagents);
});

test('writeGitignore:true upserts a single # bouncer marker block with .venv', () => {
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

test('writeGitignore preserves substring lookalikes outside the marker block', () => {
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

test('writeGitignore without flag leaves .gitignore bytes unchanged and does not create it', () => {
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

test('init does not seed Codex agents without a .codex/ signal', () => {
  const repo = tmpRepo();
  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.equal(result.created.filter((p) => p.startsWith('.codex/')).length, 0);
  assert.ok(!exists(repo, '.codex'));
  assert.notEqual(result.reason, 'codex-agents-seeded');
});

test('init seeds four Codex tomls when .codex/ already exists', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const { GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  for (const name of [
    'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
    'bouncer-context-reviewer',
  ]) {
    const rel = `.codex/agents/${name}.toml`;
    assert.ok(res.created.includes(rel), `missing ${rel} in created`);
    const toml = read(repo, rel);
    assert.ok(toml.startsWith(GENERATED_MARKER));
    assert.match(toml, new RegExp(`name = "${name}"`));
  }
});

test('init leaves unmarked Codex toml byte-for-byte unchanged', () => {
  const repo = tmpRepo();
  const rel = '.codex/agents/bouncer-implementer.toml';
  fs.mkdirSync(path.join(repo, '.codex/agents'), { recursive: true });
  const owned = 'name = "custom"\n';
  fs.writeFileSync(path.join(repo, rel), owned);
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(read(repo, rel), owned);
});

test('init seeds Codex named-agent toml from plugin markdown', () => {
  const repo = tmpRepo();
  const res = init({
    repoRoot: repo,
    timestamp: '2026-07-01T00:00:00.000Z',
    seedCodexAgents: true,
  });
  const { GENERATED_MARKER } = require('../scripts/lib/codex-agents');
  for (const name of [
    'bouncer-reviewer', 'bouncer-implementer', 'bouncer-debugger',
    'bouncer-context-reviewer',
  ]) {
    const rel = `.codex/agents/${name}.toml`;
    assert.ok(res.created.includes(rel), `missing ${rel} in created`);
    const toml = read(repo, rel);
    assert.ok(toml.startsWith(GENERATED_MARKER));
    assert.match(toml, new RegExp(`name = "${name}"`));
  }
});

test('init refreshes generated Codex toml and leaves user-owned files', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
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

test('ready init seeds missing Codex toml without touching Distill reason', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  fs.rmSync(path.join(repo, '.codex/agents'), { recursive: true, force: true });
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(again.reason, 'codex-agents-seeded');
  assert.ok(again.created.includes('.codex/agents/bouncer-reviewer.toml'));
  assert.ok(!again.created.includes('.bouncer/Distill.md'));
});

test('ready init does not recreate .codex/ after it is removed', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.codex'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  fs.rmSync(path.join(repo, '.codex'), { recursive: true, force: true });
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.equal(again.created.filter((p) => p.startsWith('.codex/')).length, 0);
  assert.ok(!exists(repo, '.codex'));
  assert.notEqual(again.reason, 'codex-agents-seeded');
});
