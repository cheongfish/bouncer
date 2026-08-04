'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-plan', 'SKILL.md'), 'utf8');

test('bouncer-plan wires scaffold, skills, affected_paths, pointer, and plan gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /scripts\/bouncer"\s+scaffold\s+epic\b/);
  assert.match(body, /scripts\/bouncer"\s+scaffold\s+blueprint\b/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+plan\b/);
  assert.match(body, /\.bouncer\/context\/epics/);
  assert.match(body, /discovery/);
  assert.match(body, /spec-authoring/);
  assert.match(body, /graphify-runner/);
  assert.match(body, /minimality/);
  assert.match(body, /affected_paths/);
  assert.match(body, /scripts\/bouncer"\s+current\s+--set\b/);
  assert.match(body, /approv/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|--from-superpowers|import-superpowers|okf-authoring/i);
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

test('bouncer-plan states that G4 requires a recorded graph basis', () => {
  assert.match(md, /G4[^\n]*basis|basis[^\n]*G4/);
  assert.match(md, /scaffold[^\n]*empt|empt[^\n]*basis/i);
});

test('bouncer-plan reminds authors that titles feed the finalize commit message', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /title/i);
  assert.match(body, /commit_intent/);
  assert.match(body, /\.gitmessage|commit_type|\/bouncer-finalize/);
});


test('bouncer-plan preflight reads project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/context\/Distill\.md/);
  assert.match(body, /Read/i);
});
