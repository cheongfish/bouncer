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
    methodology: {
      profile: 'native',
      verification: 'superpowers',
      review: 'superpowers',
    },
  });
});

test('init tasks template has five implementation-ready sections', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const tasks = read(repo, '.sdd/templates/tasks.md');
  assert.ok(/## Goal & intent/.test(tasks));
  assert.ok(/## Interface/.test(tasks));
  assert.ok(/## Touch/.test(tasks));
  assert.ok(/## Do not touch/.test(tasks));
  assert.ok(/## Checklist/.test(tasks));
});

test('init config includes methodology stub', () => {
  const repo = tmpRepo();
  init({ repoRoot: repo, timestamp: '2026-07-01T00:00:00.000Z' });
  const cfg = JSON.parse(read(repo, '.sdd/config.json'));
  assert.deepStrictEqual(cfg.methodology, {
    profile: 'native',
    verification: 'superpowers',
    review: 'superpowers',
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

test('init config sets methodology.profile to native and keeps legacy engines', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { init } = require('../scripts/lib/init');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-init-profile-'));
  init({ repoRoot: repo, timestamp: '2026-07-23T00:00:00+09:00' });
  const cfg = JSON.parse(fs.readFileSync(path.join(repo, '.sdd/config.json'), 'utf8'));
  assert.strictEqual(cfg.methodology.profile, 'native');
  assert.strictEqual(cfg.methodology.verification, 'superpowers');
  assert.strictEqual(cfg.methodology.review, 'superpowers');
});

test('init governance text frames superpowers as an optional profile', () => {
  const os = require('node:os');
  const fs = require('node:fs');
  const path = require('node:path');
  const { init } = require('../scripts/lib/init');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-init-gov-'));
  init({ repoRoot: repo, timestamp: '2026-07-23T00:00:00+09:00' });
  // SUPERPOWERS → .sdd/superpowers.md; WORKFLOW → .sdd/workflow.md; GOVERNANCE → .sdd/governance.md
  const govPath = path.join(repo, '.sdd', 'governance.md');
  const gov = fs.existsSync(govPath) ? fs.readFileSync(govPath, 'utf8') : '';
  const workflowPath = path.join(repo, '.sdd', 'workflow.md');
  const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, 'utf8') : '';
  const superpowersPath = path.join(repo, '.sdd', 'superpowers.md');
  const superpowers = fs.existsSync(superpowersPath)
    ? fs.readFileSync(superpowersPath, 'utf8')
    : '';
  const all = gov + workflow + superpowers;
  assert.ok(/profile/i.test(all), 'mentions profile');
  assert.ok(
    !/requires the superpowers plugin|execute fails closed \(do not proceed\)/i.test(all),
    'no unconditional superpowers-required language',
  );
});
