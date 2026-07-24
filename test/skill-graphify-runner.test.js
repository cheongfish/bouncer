'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('graphify-runner has valid frontmatter', () => {
  const md = readSkill('graphify-runner');
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'graphify-runner');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('graphify-runner references graphify query, suggested_paths, and graceful fallback', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /graphify query/i);
  assert.match(md, /suggested_paths/);
  assert.match(md, /not available|unavailable|absent|not on PATH|skip/i);
  assert.match(md, /bouncer\.graph|\/bouncer-plan/);
  assert.doesNotMatch(md, /\bsdd\b|superpowers/i);
});

test('graphify-runner records basis and documents freshness policy', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /bouncer\.graph\.basis|graph\.basis|basis/i);
  assert.match(md, /SessionStart|freshness|mtime/i);
});

test('graphify-runner treats graphify-out as user-managed local output', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /user-managed local output/i);
  assert.doesNotMatch(md, /local cache|gitignored cache/i);
});

test('graphify-runner handles disabled auto-build with user-confirmed affected paths', () => {
  const md = readSkill('graphify-runner');
  assert.match(md, /auto-build is disabled|automatic graph build is disabled/i);
  assert.match(md, /require the user to confirm\s+`affected_paths`/i);
});
