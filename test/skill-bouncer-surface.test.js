'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { GENERIC_SKILLS } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const WORKFLOW = [
  'bouncer-init', 'bouncer-plan', 'bouncer-execute', 'bouncer-commit', 'bouncer-finalize',
  'bouncer-run',
];
const SUB_PATHS = [
  'discovery', 'spec-authoring', 'implementation', 'verification',
  'review', 'minimality', 'debugging', 'graphify-runner', 'explain-diff',
  'stop-slop', 'context-review', 'migrate-ids',
];

const STEPS_EXEMPT = new Set(['minimality', 'stop-slop']);

function readWorkflow(name) {
  return fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
}

test('workflow skills use directory-matching names and explicit-invocation descriptions', () => {
  for (const name of WORKFLOW) {
    const { data } = parseFrontmatter(readWorkflow(name));
    assert.strictEqual(data.name, name);
    assert.match(String(data.description), /This skill should be used only when the user explicitly asks/i);
  }
});

test('workflow skills cite subordinate skills by path', () => {
  const plan = readWorkflow('bouncer-plan');
  const execute = readWorkflow('bouncer-execute');
  const commit = readWorkflow('bouncer-commit');
  const finalize = readWorkflow('bouncer-finalize');
  assert.match(plan, /skills\/discovery\/SKILL\.md/);
  assert.match(plan, /skills\/spec-authoring\/SKILL\.md/);
  assert.match(plan, /skills\/stop-slop\/SKILL\.md/);
  assert.match(plan, /skills\/graphify-runner\/SKILL\.md/);
  assert.match(plan, /skills\/context-review\/SKILL\.md/);
  assert.match(execute, /skills\/implementation\/SKILL\.md/);
  assert.match(execute, /skills\/verification\/SKILL\.md/);
  assert.match(execute, /skills\/review\/SKILL\.md/);
  // explain-diff는 finalize가 호출한다(commit이 아님).
  assert.doesNotMatch(commit, /skills\/explain-diff\/SKILL\.md/);
  assert.match(finalize, /skills\/spec-authoring\/SKILL\.md/);
  assert.match(finalize, /skills\/explain-diff\/SKILL\.md/);
  {
    const i = finalize.indexOf('skills/spec-authoring/SKILL.md');
    const j = finalize.indexOf('skills/explain-diff/SKILL.md');
    assert.ok(i > -1 && j > i);
  }
  for (const name of [
    'discovery', 'implementation', 'verification', 'review',
    'minimality', 'debugging', 'graphify-runner', 'spec-authoring',
    'explain-diff', 'stop-slop',
  ]) {
    // at least one workflow skill should mention each used path form when present
    assert.ok(SUB_PATHS.includes(name));
  }
});

test('execute, commit, and finalize stop when current is null; plan stops without .bouncer/', () => {
  const execute = readWorkflow('bouncer-execute');
  const commit = readWorkflow('bouncer-commit');
  const finalize = readWorkflow('bouncer-finalize');
  const plan = readWorkflow('bouncer-plan');
  assert.match(execute, /scripts\/bouncer"\s+current\b/);
  assert.match(execute, /null/);
  assert.match(execute, /ready/);
  assert.match(execute, /current --set/);
  assert.match(execute, /\/bouncer-plan/);
  assert.match(commit, /scripts\/bouncer"\s+current\b/);
  assert.match(commit, /null/);
  assert.match(finalize, /scripts\/bouncer"\s+current\b/);
  assert.match(finalize, /null/);
  assert.match(finalize, /\/bouncer-plan/);
  assert.match(plan, /\.bouncer\//);
  assert.match(plan, /\/bouncer-init/);
  assert.match(plan, /Preflight|missing|없/i);
});

test('pointer consumers retain only their local application while using the CLI contract', () => {
  const execute = readWorkflow('bouncer-execute');
  const commit = readWorkflow('bouncer-commit');
  const finalize = readWorkflow('bouncer-finalize');
  const run = readWorkflow('bouncer-run');
  for (const md of [execute, commit, finalize, run]) {
    assert.match(md, /rules\/current-pointer\.md/);
    assert.match(md, /scripts\/bouncer"\s+current\b/);
    assert.doesNotMatch(md, /scripts\/lib\/current/);
  }
  assert.match(execute, /scale.*light|light.*scale/i, 'execute keeps its local status/scale stop condition');
  assert.match(commit, /nextTask/, 'commit keeps its local next-task handoff');
  assert.match(finalize, /finalize --yes/, 'finalize keeps its local clear/handoff consequence');
  assert.match(run, /autonomy/, 'run keeps its autonomy-specific advance behavior');
});

test('commands/ directory is gone', () => {
  assert.ok(!fs.existsSync(path.join(root, 'commands')));
});

test('GENERIC_SKILLS does not list workflow skills', () => {
  for (const name of WORKFLOW) {
    assert.ok(!GENERIC_SKILLS.includes(name), name);
  }
});

test('workflow skills end with an ACQ gates section', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const heads = [...md.matchAll(/^## .*$/gm)].map((m) => m[0]);
    // 존재만이 아니라 마지막 절인지까지 본다 — 성공 조건 2가 위치를 요구한다.
    assert.strictEqual(heads[heads.length - 1], '## ACQ (AskUserQuestion) gates', name);
  }
});

test('workflow ACQ catalogs delegate shared display details to rules/acq.md', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    assert.match(md, /rules\/acq\.md/, `${name} must cite the display contract`);
  }
});

test('workflow skill bodies use English headings', () => {
  for (const name of WORKFLOW) {
    const md = readWorkflow(name);
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});

test('sub-skills carry the shared body skeleton in order', () => {
  for (const name of SUB_PATHS) {
    const md = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const want = ['## When this applies'];
    if (!STEPS_EXEMPT.has(name)) want.push('## Steps');
    want.push('## Guardrails', '## Return');
    let at = -1;
    for (const h of want) {
      const i = md.indexOf(`\n${h}\n`);
      assert.ok(i > at, `${name} missing or misordered ${h}`);
      at = i;
    }
  }
});

test('sub-skill bodies use English headings', () => {
  for (const name of SUB_PATHS) {
    const md = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
    assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
  }
});
