'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'graphify-runner', 'SKILL.md'), 'utf8',
);

test('graphify-runner has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'graphify-runner');
  assert.ok(data.description.length > 0);
});

test('graphify-runner references graphify query, suggested_paths, and a graceful fallback', () => {
  assert.ok(/graphify query/i.test(md));
  assert.ok(/suggested_paths/.test(md));
  assert.ok(/not available|unavailable|absent|not on PATH|skip/i.test(md));
});

test('graphify-runner records basis and documents freshness policy', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const md = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'graphify-runner', 'SKILL.md'), 'utf8',
  );
  assert.ok(/sdd\.graph\.basis|graph\.basis|basis/i.test(md), 'records query basis');
  assert.ok(/SessionStart|freshness|최신성|mtime/i.test(md), 'documents freshness');
});

test('.gitignore excludes graphify-out cache', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const gi = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.ok(/graphify-out/.test(gi));
});
