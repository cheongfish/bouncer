'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'skills/bouncer-init/SKILL.md'), 'utf8');
const result = fs.readFileSync(path.join(root, 'skills/bouncer-init/references/init-result.md'), 'utf8');

test('init bootstraps before conditionally loading result handling', () => {
  assert.ok(skill.indexOf('bouncer init') < skill.indexOf('./references/init-result.md'));
  assert.match(skill, /Promotion, Gitignore, or Branch/);
});
test('init result choices preserve consent-only writes', () => {
  assert.match(result, /graphifyPromotion/);
  assert.match(result, /--promote-graphify/);
  assert.match(result, /--write-gitignore/);
  assert.match(result, /write nothing|untouched/);
});
test('init result keeps Graphify disabled after installation failure and names recovery', () => {
  assert.match(result, /failure, Graphify remains disabled/);
  assert.match(result, /install it manually/);
  assert.match(result, /bouncer init --promote-graphify/);
});
test('init keeps bootstrap commit before planning', () => {
  assert.ok(skill.indexOf('git add') < skill.indexOf('/bouncer-plan', skill.indexOf('git add')));
});

test('init loads result handling after bootstrap and keeps ACQ consent', () => {
  const preamble = skill.slice(0, skill.search(/^1\. /m));
  assert.doesNotMatch(preamble, /\.\/references\/init-result\.md/);
  assert.ok(skill.indexOf('bouncer init') < skill.indexOf('./references/init-result.md'));
  assert.match(skill, /rules\/acq\.md/);
  assert.match(skill, /Step 3 — Promotion ACQ · Gitignore ACQ · Branch ACQ/);
});
