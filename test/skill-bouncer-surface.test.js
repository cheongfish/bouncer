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
  'stop-slop',
];

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

test('commands/ directory is gone', () => {
  assert.ok(!fs.existsSync(path.join(root, 'commands')));
});

test('GENERIC_SKILLS does not list workflow skills', () => {
  for (const name of WORKFLOW) {
    assert.ok(!GENERIC_SKILLS.includes(name), name);
  }
});
