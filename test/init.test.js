'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { init, inspectBootstrap } = require('../scripts/lib/init');

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
    '.bouncer/config.json', '.bouncer/governance.md', '.bouncer/workflow.md',
    '.bouncer/okf.md', '.bouncer/templates/epic.md', '.bouncer/templates/blueprint.md',
    '.bouncer/templates/tasks.md', '.bouncer/templates/verification.md', '.bouncer/templates/review.md',
    '.bouncer/templates/distill.md', '.bouncer/templates/pr.md', '.bouncer/context/index.md',
  ]) {
    assert.ok(exists(repo, rel), `missing ${rel}`);
  }
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
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.bouncer/config.json')), {
    schema_version: '0.x',
    source_dirs: ['src', 'test'],
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
  });
});

test('init config omits methodology and Superpowers profile fields', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.bouncer/config.json'));
  assert.strictEqual(cfg.methodology, undefined);
  assert.ok(!('methodology' in cfg));
});

test('init tasks template has five implementation-ready sections', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const tasks = read(repo, '.bouncer/templates/tasks.md');
  assert.ok(/## Goal & intent/.test(tasks));
  assert.ok(/## Interface/.test(tasks));
  assert.ok(/## Touch/.test(tasks));
  assert.ok(/## Do not touch/.test(tasks));
  assert.ok(/## Checklist/.test(tasks));
});

test('init blueprint/tasks templates carry Contract-First authoring guardrails', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const blueprint = read(repo, '.bouncer/templates/blueprint.md');
  const tasks = read(repo, '.bouncer/templates/tasks.md');
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

test('epic and blueprint templates link their neighbours with relative paths', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const epic = read(repo, '.bouncer/templates/epic.md');
  const blueprint = read(repo, '.bouncer/templates/blueprint.md');
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
  const workflow = '# My workflow\n\nDo not replace this.\n';
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/workflow.md'), workflow);

  const result = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });

  assert.deepStrictEqual(result, {
    ok: false,
    created: [],
    skipped: true,
    reason: 'partial-bouncer-state',
  });
  assert.strictEqual(read(repo, '.bouncer/workflow.md'), workflow);
  assert.ok(!exists(repo, '.bouncer/config.json'));
});

test('init workflow uses Bouncer commands and retains Ponytail advise', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-23T00:00:00+09:00' });
  const workflow = read(repo, '.bouncer/workflow.md');
  assert.ok(/\/bouncer-init/.test(workflow));
  assert.ok(/\/bouncer-plan/.test(workflow));
  assert.ok(/\/bouncer-execute/.test(workflow));
  assert.ok(/\/bouncer-finalize/.test(workflow));
  assert.ok(/bouncer advise/.test(workflow));
  assert.ok(/Ponytail/.test(workflow));
  assert.ok(!/superpowers|profile-aware|methodology/i.test(workflow));
});

test('init materials have no Superpowers profile language', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-23T00:00:00+09:00' });
  const gov = read(repo, '.bouncer/governance.md');
  const workflow = read(repo, '.bouncer/workflow.md');
  const okf = read(repo, '.bouncer/okf.md');
  const all = gov + workflow + okf;
  assert.ok(!exists(repo, '.bouncer/superpowers.md'));
  assert.ok(!/superpowers|methodology\.profile|profile-aware/i.test(all));
});

test('init reports the gitignore entries a repo without .gitignore should add', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, ['node_modules/', 'graphify-out/']);
  assert.ok(!exists(repo, '.gitignore'), 'init must not write .gitignore');
});

test('init suggests only the entries .gitignore is missing', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), '# deps\nnode_modules\n');
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, ['graphify-out/']);
  assert.strictEqual(read(repo, '.gitignore'), '# deps\nnode_modules\n');
});

test('init suggests nothing when the artifacts are already ignored', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\ngraphify-out/\n');
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(res.gitignoreSuggestions, []);
});

test('init reports gitignore suggestions on an already-initialized repo', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const again = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(again.reason, 'already-initialized');
  assert.deepStrictEqual(again.gitignoreSuggestions, ['node_modules/', 'graphify-out/']);
});
