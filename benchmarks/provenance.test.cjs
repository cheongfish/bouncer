'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { sampleEligibility, sourceProvenance } = require('./provenance.cjs');

test('source provenance records the commit and any uncommitted path', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'bench-provenance-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env,
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@example.com', GIT_CONFIG_NOSYSTEM: '1' } });
  try {
    git('init', '-q');
    writeFileSync(path.join(repo, 'a.txt'), 'a\n');
    git('add', '.');
    git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'init');
    const head = git('rev-parse', 'HEAD').trim();
    assert.deepEqual(sourceProvenance(repo), { bouncer_commit: head, bouncer_dirty: false, bouncer_dirty_paths: [] });
    writeFileSync(path.join(repo, 'a.txt'), 'b\n');
    writeFileSync(path.join(repo, 'new.txt'), 'n\n');
    assert.deepEqual(sourceProvenance(repo).bouncer_dirty_paths, ['a.txt', 'new.txt']);
    assert.equal(sourceProvenance(repo).bouncer_dirty, true);
    assert.equal(sourceProvenance(path.join(repo, 'missing')).bouncer_commit, null);
  } finally {
    rmSync(repo, { recursive: true });
  }
});

test('only clean-source, fully metered, graded runs are eligible samples', () => {
  const valid = { bouncer_dirty: false, usage_total_status: 'reported', judge_status: 'graded', score: 0 };
  assert.deepEqual(sampleEligibility(valid), { eligible: true, reasons: [] });
  assert.deepEqual(sampleEligibility({ ...valid, bouncer_dirty: true }).reasons, ['dirty_source']);
  assert.deepEqual(sampleEligibility({ ...valid, bouncer_dirty: null }).reasons, ['unknown_source']);
  assert.deepEqual(sampleEligibility({ ...valid, usage_total_status: 'incomplete' }).reasons, ['usage_incomplete']);
  assert.deepEqual(sampleEligibility({ bouncer_dirty: false, usage: { status: 'reported' }, judge_status: 'graded' }),
    { eligible: true, reasons: [] });
  assert.deepEqual(sampleEligibility({ bouncer_dirty: false, usage: { status: 'incomplete' } }).reasons,
    ['usage_incomplete', 'not_graded']);
});
