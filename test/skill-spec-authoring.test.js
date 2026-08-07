'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('spec-authoring has valid frontmatter identity', () => {
  const md = readSkill('spec-authoring');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*spec-authoring/);
  assert.strictEqual(data.name, 'spec-authoring');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('spec-authoring documents frontmatter ownership and five task sections', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /frontmatter/i);
  assert.match(md, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
});

test('spec-authoring ties document titles to commit messages via .gitmessage', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /\.gitmessage/);
  assert.match(md, /title/i);
  assert.match(md, /commit_intent/);
  assert.match(md, /commit_type|\/bouncer-commit|\/bouncer-finalize|finalize/i);
  // task 커밋 subject는 task title; task commit_intent(2줄)도 표에 있다.
  assert.match(md, /tasks`?\s*`?bouncer\.commit_intent|task.*commit_intent/i);
  assert.match(md, /tasks`?\s*`?title|task `title`/i);
});


test('spec-authoring documents project Distill promotion and defers explain to explain-diff', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /\.bouncer\/Distill\.md/);
  assert.match(md, /Invariants|Gotchas|Decisions/);
  assert.match(md, /current|현재/i);
  assert.match(md, /explain-diff/);
  assert.doesNotMatch(md, /scaffold distill/);
  assert.doesNotMatch(md, /author.*explain\.md|Write.*explain\.md/i);
});

test('spec-authoring promotes from explain.md and excludes 이해 상태', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /explain\.md/);
  assert.match(md, /이해 상태/); // 제외 대상 언급
  assert.match(md, /승격하지 않|옮기지 않|제외/);
});

test('spec-authoring requires Korean plan bodies, English Distill, and stop-slop', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /Korean/);
  assert.match(md, /English/);
  assert.match(md, /\.bouncer\/Distill\.md/);
  assert.match(md, /stop-slop/);
  assert.match(md, /skills\/stop-slop\/SKILL\.md/);
});
