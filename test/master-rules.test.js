'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('CLAUDE.md and AGENTS.md are byte-identical master rules', () => {
  const claude = read('CLAUDE.md');
  const agents = read('AGENTS.md');
  assert.strictEqual(agents, claude);
  assert.match(claude, /^# Bouncer\b/m);
  assert.match(claude, /docs\/governance\.md/);
  assert.match(claude, /docs\/workflow\.md/);
  assert.match(claude, /docs\/okf\.md/);
  assert.match(claude, /one reviewable\s+commit/i);
  assert.match(claude, /execute gate/i);
  // Split the literal so public-name-regression does not flag this negative check.
  assert.doesNotMatch(claude, new RegExp(['super', 'powers'].join(''), 'i'));
});

test('master rules are not installed by init', () => {
  const init = read('scripts/lib/init.js');
  assert.doesNotMatch(init, /CLAUDE\.md|AGENTS\.md/);
  const skill = read('skills/bouncer-init/SKILL.md');
  assert.match(skill, /does not install/i);
  assert.match(skill, /CLAUDE\.md/);
});

test('workflow skills instruct reading CLAUDE.md before steps', () => {
  for (const name of [
    'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-finalize',
  ]) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /CLAUDE\.md/, `${name} must mention CLAUDE.md`);
    assert.match(md, /Master rules/i, `${name} must label master rules`);
  }
  const spec = read('skills/spec-authoring/SKILL.md');
  assert.match(spec, /CLAUDE\.md/);
});
