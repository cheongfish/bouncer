'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { init, inspectBootstrap, SOURCE_DIR_CANDIDATES } = require('../scripts/lib/init');
const { TEMPLATES } = require('../scripts/lib/templates');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-init-'));
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

test('init writes the exact config.json shape', () => {
  const repo = tmpRepo();
  // Empty tmp repo → no candidate dirs; source_dirs is detected, not hard-coded.
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.bouncer/config.json')), {
    schema_version: '0.x',
    source_dirs: [],
    context_dirs: ['.bouncer/context'],
    graphify: { enabled: false },
    verify: 'npm test',
    base_branch: 'develop',
    pr: { draft: true, base: 'develop', labels: ['bouncer'] },
    plugin_advisors: {
      ponytail: {
        enabled: true,
        plan: 'lite',
        execute: 'full',
        verify: 'full',
        review: 'review',
        finalize: 'lite',
        auto_switch: false,
      },
    },
    subagents: {
      claude: { 'bouncer-reviewer': 'inherit', 'bouncer-implementer': 'inherit' },
      cursor: { 'bouncer-reviewer': 'inherit', 'bouncer-implementer': 'inherit' },
      codex: { 'bouncer-reviewer': 'inherit', 'bouncer-implementer': 'inherit' },
    },
  });
});

test('init source_dirs detects existing candidate directories in fixed order', () => {
  const repo = tmpRepo();
  // Only lib/ and app/ exist — result order follows SOURCE_DIR_CANDIDATES, not fs order.
  fs.mkdirSync(path.join(repo, 'app'));
  fs.mkdirSync(path.join(repo, 'lib'));
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(SOURCE_DIR_CANDIDATES, [
    'src', 'lib', 'app', 'packages', 'scripts', 'test', 'tests',
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
  fs.mkdirSync(path.join(repo, 'test'));
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.deepStrictEqual(cfg.source_dirs, ['test']);
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
  assert.match(index, /^---\nokf_version: "0\.1"\n---\n/);
  assert.match(index, /^# Epics$/m);
  assert.match(index, /\* \[EPIC-00x 제목\]\(epics\/EPIC-00x-slug\/index\.md\) - /);
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
  assert.match(blueprint, /\* \[Tasks\]\(tasks\.md\) - /);
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
  assert.ok(/bouncer advise/.test(workflow));
  assert.ok(/Ponytail/.test(workflow));
  assert.ok(!/superpowers|profile-aware|methodology/i.test(workflow));
});

test('plugin governance materials have no Superpowers profile language', () => {
  const root = path.join(__dirname, '..');
  const gov = fs.readFileSync(path.join(root, 'docs/governance.md'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, 'docs/workflow.md'), 'utf8');
  const okf = fs.readFileSync(path.join(root, 'docs/okf.md'), 'utf8');
  const all = gov + workflow + okf;
  assert.ok(!/superpowers|methodology\.profile|profile-aware/i.test(all));
});

test('init reports the gitignore entries a repo without .gitignore should add', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, ['node_modules/', 'graphify-out/', '.worktrees/']);
  assert.ok(!exists(repo, '.gitignore'), 'init must not write .gitignore');
});

test('init suggests only the entries .gitignore is missing', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), '# deps\nnode_modules\n');
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, ['graphify-out/', '.worktrees/']);
  assert.strictEqual(read(repo, '.gitignore'), '# deps\nnode_modules\n');
});

test('init suggests nothing when the artifacts are already ignored', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\ngraphify-out/\n.worktrees/\n');
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
  assert.deepStrictEqual(again.gitignoreSuggestions, ['node_modules/', 'graphify-out/', '.worktrees/']);
});
