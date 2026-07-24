'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'commands', 'bouncer-plan.md'), 'utf8');

test('bouncer-plan wires scaffold, skills, affected_paths, pointer, and plan gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /scripts\/bouncer/);
  assert.match(body, /scaffold/);
  assert.match(body, /discovery/);
  assert.match(body, /spec-authoring/);
  assert.match(body, /graphify-runner/);
  assert.match(body, /minimality/);
  assert.match(body, /affected_paths/);
  assert.match(body, /\.bouncer\/current/);
  assert.match(body, /validate --gate plan/);
  assert.match(body, /approv/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|sdd-harness|--from-superpowers|import-superpowers|okf-authoring|sdd-minimality/i);
});

test('bouncer-plan requires implementation-ready tasks sections and mentions G10–G12', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
  assert.match(body, /G10|G11|G12/);
});

test('bouncer-plan recommends minimality (advisory) and keeps graphify-runner', () => {
  assert.match(md, /minimality/);
  assert.match(md, /recommend|권장|advisory/i);
  assert.match(md, /graphify-runner/);
  assert.match(md, /unavailable|skip|fallback|manual/i);
});
