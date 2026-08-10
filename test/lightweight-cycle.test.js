'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('governance defines Lightweight cycle contract', () => {
  const gov = read('docs/governance.md');
  assert.match(gov, /## Lightweight cycle/);
  assert.match(gov, /declare|declaration/i);
  assert.match(gov, /maintenance epic/i);
  assert.match(gov, /inline/i);
  assert.match(gov, /one question|single question/i);
  assert.match(gov, /explain\.md/);
  assert.match(gov, /Distill/);
  assert.match(gov, /\bG16\b/);
  assert.match(gov, /its own diff|self-review/i);
});

test('bouncer-plan routes lightweight work to maintenance epic', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  assert.match(plan, /maintenance epic/i);
  assert.match(plan, /docs\/governance\.md/);
});

test('bouncer-execute widens inline fallback with lightweight declaration', () => {
  const exec = read('skills/bouncer-execute/SKILL.md');
  assert.match(exec, /named agents are unavailable/);
  assert.match(exec, /lightweight/i);
  assert.match(exec, /docs\/governance\.md/);
  assert.match(exec, /\bG8\b/);
  assert.match(exec, /\bG14\b/);
});

test('explain-diff chooses one quiz question on lightweight cycle', () => {
  const ed = read('skills/explain-diff/SKILL.md');
  assert.match(ed, /1[–~-]10/);
  assert.match(ed, /lightweight/i);
  assert.match(ed, /docs\/governance\.md/);
});
