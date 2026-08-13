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
  assert.match(claude, /rules\/governance\.md/);
  assert.match(claude, /rules\/okf\.md/);
  assert.match(claude, /one reviewable\s+commit/i);
  assert.match(claude, /tasks\/<NNN>\/?`?\{?tasks/);
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
    'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit', 'bouncer-finalize',
    'bouncer-run',
  ]) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /CLAUDE\.md/, `${name} must mention CLAUDE.md`);
    assert.match(md, /Master rules/i, `${name} must label master rules`);
  }
  const spec = read('skills/spec-authoring/SKILL.md');
  assert.match(spec, /CLAUDE\.md/);
});

test('hard rule 5 workflow order includes commit between execute and finalize', () => {
  const claude = read('CLAUDE.md');
  assert.match(
    claude,
    /\/bouncer-init`?\s*→\s*`?\/bouncer-plan`?\s*→\s*`?\/bouncer-execute`?\s*→\s*`?\/bouncer-commit`?\s*→\s*`?\/bouncer-finalize/,
  );
  assert.match(claude, /\/bouncer-commit/);
  assert.match(claude, /When to invoke/i);
  assert.match(claude, /\|\s*Run one blueprint to task exhaustion\s*\|\s*`\/bouncer-run`\s*\|/);
});


test('master rules point at project Distill path and require reading it', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /\.bouncer\/Distill\.md/);
  assert.match(claude, /plan|execute/i);
  assert.match(claude, /Read|읽/i);
  assert.doesNotMatch(claude, /## Invariants/);
  // Distill 경로는 소비 프로젝트 main worktree(project-root) 아래만 가리킨다.
  assert.match(claude, /project-root|PROJECT_ROOT/);
});

test('workflow skills resolve PROJECT_ROOT via project-root for Distill', () => {
  for (const name of [
    'bouncer-plan', 'bouncer-execute', 'bouncer-run', 'bouncer-finalize',
  ]) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /project-root/, `${name} must call bouncer project-root`);
    assert.match(md, /PROJECT_ROOT/, `${name} must bind PROJECT_ROOT`);
    assert.match(
      md,
      /\$\{PROJECT_ROOT\}\/\.bouncer\/Distill\.md/,
      `${name} must Read Distill under PROJECT_ROOT`,
    );
    // 상대 경로 operational Read와 plugin-root 기준 Distill은 금지.
    assert.doesNotMatch(
      md,
      /Read `\.bouncer\/Distill\.md`/,
      `${name} must not use cwd-relative Distill Read`,
    );
    assert.doesNotMatch(
      md,
      /\$\{BOUNCER_ROOT\}\/\.bouncer\/Distill\.md/,
      `${name} must not derive Distill from BOUNCER_ROOT`,
    );
  }
});

test('discovery and spec-authoring take caller-provided absolute Distill paths', () => {
  for (const name of ['discovery', 'spec-authoring']) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(
      md,
      /caller-provided|호출자가 넘긴|absolute Distill|절대 Distill|절대 경로/i,
      `${name} must require caller-provided absolute Distill path`,
    );
    assert.doesNotMatch(md, /BOUNCER_ROOT/, `${name} must not resolve BOUNCER_ROOT`);
    assert.doesNotMatch(md, /scripts\/bouncer/, `${name} must not invoke scripts/bouncer`);
  }
});

test('master rules require Korean context bodies and name stop-slop', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /Context language/i);
  assert.match(claude, /Korean/);
  assert.match(claude, /stop-slop/);
  assert.match(claude, /advisory/i);
  assert.match(claude, /Distill stays English|English agent runtime/i);
});

test('hard rule 9 requires Korean code comments and points at implementation skill', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /^9\.\s+\*\*Code comments\*\*/m);
  assert.match(claude, /non-obvious intent|비자명한 의도/i);
  assert.match(claude, /Korean comment/i);
  assert.match(claude, /skills\/implementation\/SKILL\.md/);
  // Distill pattern: obligation + pointer only — examples stay in the skill.
  const hardRules = claude.split(/^## Session conduct/m)[0];
  assert.doesNotMatch(hardRules, /```/);
});
