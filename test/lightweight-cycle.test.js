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
  assert.match(gov, /bouncer\.scale:\s*light|scale:\s*light/);
  assert.match(gov, /maintenance epic/i);
  assert.match(gov, /inline/i);
  assert.match(gov, /one question|single question/i);
  assert.match(gov, /explain\.md/);
  assert.match(gov, /Distill/);
  assert.match(gov, /\bG16\b/);
  assert.match(gov, /its own diff|self-review/i);
  assert.match(gov, /named agents are unavailable/);
});

test('bouncer-plan routes light-path work to maintenance epic', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  assert.match(plan, /maintenance/);
  assert.match(plan, /bouncer\.scale/);
  assert.match(plan, /light/);
  assert.match(plan, /묻|물어|ask/i);
});

test('bouncer-execute inlines on scale light and keeps host fallback wording', () => {
  const exec = read('skills/bouncer-execute/SKILL.md');
  assert.match(exec, /bouncer\.scale|scale:\s*light/);
  assert.match(exec, /인라인|inline/i);
  assert.match(exec, /named agents are unavailable/);
  assert.match(exec, /\bG8\b/);
  assert.match(exec, /bouncer-debugger/);
  // light branch must not OR onto the host-fallback sentence
  assert.doesNotMatch(
    exec,
    /named agents are unavailable[\s\S]{0,120}lightweight cycle/i,
  );
});

test('explain-diff fixes one quiz question on scale light', () => {
  const ed = read('skills/explain-diff/SKILL.md');
  assert.match(ed, /1[–~-]10/);
  assert.match(ed, /scale/);
  assert.match(ed, /light/);
});
