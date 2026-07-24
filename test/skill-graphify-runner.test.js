'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
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

test('.gitignore excludes graphify-out cache', () => {
  const gi = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(gi, /graphify-out/);
});
