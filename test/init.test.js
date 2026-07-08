'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { init } = require('../scripts/lib/init');

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-init-'));
}
const read = (repo, rel) => fs.readFileSync(path.join(repo, rel), 'utf8');
const exists = (repo, rel) => fs.existsSync(path.join(repo, rel));

test('init scaffolds the full .sdd tree and context index', () => {
  const repo = tmpRepo();
  const res = init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.strictEqual(res.skipped, false);
  for (const rel of [
    '.sdd/config.json', '.sdd/current', '.sdd/governance.md', '.sdd/workflow.md',
    '.sdd/okf.md', '.sdd/templates/epic.md', '.sdd/templates/blueprint.md',
    '.sdd/templates/tasks.md', '.sdd/templates/verification.md', '.sdd/templates/review.md',
    '.sdd/templates/distill.md', '.sdd/templates/pr.md', 'context/index.md',
    '.sdd/superpowers.md',
  ]) {
    assert.ok(exists(repo, rel), `missing ${rel}`);
  }
});

test('init writes a superpowers coexistence preference doc', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const doc = read(repo, '.sdd/superpowers.md');
  assert.ok(/context\/epics/.test(doc));
  assert.ok(/SDD gates/i.test(doc));
});

test('init writes the exact config.json shape', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  assert.deepStrictEqual(JSON.parse(read(repo, '.sdd/config.json')), {
    okf_version: '0.x',
    source_dirs: ['src', 'test'],
    verify: 'npm test',
    base_branch: 'develop',
    pr: { draft: true, base: 'develop', labels: ['sdd'] },
  });
});

test('init appends gitignore entries once and current is empty', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const gi = read(repo, '.gitignore');
  assert.ok(gi.includes('.sdd/worktrees/'));
  assert.ok(gi.includes('graphify-out/'));
  assert.ok(gi.includes('.sdd/current'));
  assert.strictEqual(read(repo, '.sdd/current').trim(), '');
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
