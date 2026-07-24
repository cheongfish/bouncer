'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-init-'));
}
const read = (repo, rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = (repo, rel) => fs.existsSync(path.join(repo, rel));

test('init scaffolds the full .bouncer tree and context index', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.skipped, false);
  for (const rel of [
    '.bouncer/config.json', '.bouncer/current', '.bouncer/governance.md', '.bouncer/workflow.md',
    '.bouncer/okf.md', '.bouncer/templates/epic.md', '.bouncer/templates/blueprint.md',
    '.bouncer/templates/tasks.md', '.bouncer/templates/verification.md', '.bouncer/templates/review.md',
    '.bouncer/templates/distill.md', '.bouncer/templates/pr.md', 'context/index.md',
  ]) {
    assert.ok(exists(repo, rel), `missing ${rel}`);
  }
  assert.ok(exists(repo, '.bouncer/config.json'));
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

test('init appends gitignore entries once and current is empty', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const gi = read(repo, '.gitignore');
  assert.ok(gi.includes('.bouncer/worktrees/'));
  assert.ok(gi.includes('graphify-out/'));
  assert.ok(gi.includes('.bouncer/current'));
  assert.strictEqual(read(repo, '.bouncer/current').trim(), '');
});

test('init is idempotent (second call skips, no duplicate gitignore lines)', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const res2 = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res2.skipped, true);
  assert.deepStrictEqual(res2.created, []);
  const occurrences = read(repo, '.gitignore').split('graphify-out/').length - 1;
  assert.strictEqual(occurrences, 1);
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
  assert.ok(!/sdd-harness|\/sdd-|superpowers|profile-aware|methodology/i.test(workflow));
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
