'use strict';

const { spawnSync } = require('node:child_process');

// Stage images build from the working tree, so a run measures whatever the checkout held at launch. Record
// the commit and whether uncommitted changes rode along; only clean-source runs can be reproduced.
function sourceProvenance(repoRoot) {
  const git = (args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const head = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain', '--untracked-files=all']);
  if (head.status !== 0 || status.status !== 0) {
    return { bouncer_commit: null, bouncer_dirty: null, bouncer_dirty_paths: [] };
  }
  const paths = status.stdout.split('\n').filter(Boolean).map((line) => line.slice(3));
  return { bouncer_commit: head.stdout.trim(), bouncer_dirty: paths.length > 0,
    bouncer_dirty_paths: paths.slice(0, 50) };
}

// A sample counts toward aggregates only when its measurement is valid: clean source, every agent's tokens
// reported, and an external grade. The task outcome itself does not matter — a failed task is still data.
function sampleEligibility(record) {
  const reasons = [];
  if (record.bouncer_dirty !== false) reasons.push(record.bouncer_dirty ? 'dirty_source' : 'unknown_source');
  const usage = record.usage_total_status ?? record.usage?.status;
  if (usage !== 'reported') reasons.push('usage_incomplete');
  if (record.judge_status !== 'graded') reasons.push('not_graded');
  return { eligible: reasons.length === 0, reasons };
}

module.exports = { sampleEligibility, sourceProvenance };
