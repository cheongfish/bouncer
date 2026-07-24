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
    okf_version: '0.x',
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
