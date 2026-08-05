'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('CLAUDE.md is the master-rules SSOT', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /^# Bouncer\b/m);
  assert.match(claude, /docs\/governance\.md/);
  assert.match(claude, /docs\/workflow\.md/);
  assert.match(claude, /docs\/okf\.md/);
  assert.match(claude, /one reviewable\s+commit/i);
  assert.match(claude, /execute gate/i);
  // Split the literal so public-name-regression does not flag this negative check.
  assert.doesNotMatch(claude, new RegExp(['super', 'powers'].join(''), 'i'));
});

test('AGENTS.md imports CLAUDE.md as Codex/Cursor adapter', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /@CLAUDE\.md/);
  assert.doesNotMatch(agents, /^# Bouncer\b/m);
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


test('master rules point at project Distill path and require reading it', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /\.bouncer\/Distill\.md/);
  assert.match(claude, /plan|execute/i);
  assert.match(claude, /Read|읽/i);
  assert.doesNotMatch(claude, /## Invariants/);
});

test('master rules require Korean context bodies and name stop-slop', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /Context language/i);
  assert.match(claude, /Korean/);
  assert.match(claude, /stop-slop/);
  assert.match(claude, /advisory/i);
  assert.match(claude, /Distill stays English|English agent runtime/i);
});
