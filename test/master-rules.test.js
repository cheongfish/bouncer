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

test('Distill consumers use full preflight, then path-routed CLI output', () => {
  const plan = read('skills/bouncer-plan/SKILL.md');
  const discovery = read('skills/discovery/SKILL.md');
  assert.match(plan, /distill\s+--all/);
  assert.match(discovery, /distill\s+--all/);
  assert.match(plan, /affected_paths[\s\S]{0,500}distill\s+--for|distill\s+--for[\s\S]{0,500}affected_paths/);

  for (const name of ['bouncer-plan', 'discovery', 'bouncer-finalize']) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /distill\s+--all/, `${name} must consume its CLI mode`);
    assert.match(md, /single-file fallback|단일 파일.*폴백/i, `${name} must preserve legacy fallback`);
  }

  for (const name of ['bouncer-execute', 'bouncer-run']) {
    const md = read(`skills/${name}/SKILL.md`);
    assert.match(md, /distill\s+--for/, `${name} must route after paths are fixed`);
    assert.match(md, /affected_paths/, `${name} must use task scope for routing`);
    assert.match(md, /single-file fallback|단일 파일.*폴백/i, `${name} must preserve legacy fallback`);
  }
});

test('bouncer-run gives implementer the current task Distill re-ground', () => {
  const run = read('skills/bouncer-run/SKILL.md');
  assert.match(run, /현재 포인터 task의 라우팅된\s+`distill --for` 출력\/brief/);
  assert.match(run, /이전 task의 대화 맥락 전체를 넘기지 않는다/);
  assert.doesNotMatch(run, /직전 task의\s+`distill --for` 출력/);
});

test('finalize promotion searches all Distill content and independently reads every shard', () => {
  const finalize = read('skills/bouncer-finalize/SKILL.md');
  const spec = read('skills/spec-authoring/SKILL.md');
  assert.match(finalize, /distill\s+--all\s+--json/, 'promotion must start with a full JSON audit');
  assert.match(finalize, /already-resolved[\s\S]{0,100}PROJECT_ROOT[\s\S]{0,100}(?:every|each|모든)/i);
  assert.match(finalize, /audit\.shards/);
  assert.match(finalize, /read[\s\S]{0,100}(?:every|each|모든)[\s\S]{0,100}shard/i);
  assert.match(finalize, /relative[^\n]{0,20}path|상대 경로/i);
  assert.match(finalize, /currentBody/);
  assert.match(finalize, /id[^\n]{0,80}(?:path|currentBody)/i);
  assert.doesNotMatch(finalize, /distill\s+--route/);
  assert.match(finalize, /aggregate|selection|합산|선택 결과/i);
  assert.match(finalize, /never[^\n]{0,100}(?:attach|associate|individual shard|개별 샤드)/i);
  for (const md of [finalize, spec]) {
    assert.match(md, /replace|교체/i, 'changed decisions must be replaceable');
    assert.match(md, /append|추가하지|덧붙이/i, 'promotion must reject append-only decisions');
  }
  assert.match(finalize, /full search|전량.*검색/i);
  assert.match(spec, /conflict|충돌|plan/i);
  assert.match(spec, /never invokes route|route.*자체/);
  assert.match(spec, /aggregate|selection|합산|선택 결과/i);
  assert.match(spec, /never[^\n]{0,100}(?:attach|associate|individual shard|개별 샤드)/i);
});

test('master rules preserve single-file Distill fallback and CLI trust boundary', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /distill\s+--all/);
  assert.match(claude, /distill\s+--for/);
  assert.match(claude, /distill\s+--route/);
  assert.match(claude, /single-file fallback|단일 파일.*폴백/i);
  assert.match(claude, /data.*not instructions|데이터.*지시가 아니/i);
  assert.match(claude, /affected_paths/);
  assert.match(claude, /audit\.shards/);
  assert.match(claude, /relative[^\n]{0,20}path|상대 경로/i);
  assert.match(claude, /aggregate|selection|합산|선택 결과/i);
  assert.match(claude, /never[^\n]{0,120}(?:attach|associate|individual shard|개별 샤드)/i);
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

test('hard rule 7 requires finalize promotion consent and caller-provided shard audit', () => {
  const claude = read('CLAUDE.md');
  assert.match(claude, /finalize[\s\S]{0,260}(?:consent|동의|승인)/i);
  assert.match(claude, /audit\.shards/);
  assert.match(claude, /data.*not instructions|데이터.*지시가 아니/i);
});
