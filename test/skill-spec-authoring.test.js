'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const refsRoot = path.join(__dirname, '..', 'skills', 'spec-authoring', 'references');
function refPath(name) {
  return path.join(refsRoot, name);
}

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

test('spec-authoring ships completed reference examples and points SKILL.md at them', () => {
  for (const k of ['epic', 'blueprint', 'tasks', 'review']) {
    assert.ok(fs.existsSync(refPath(`${k}.md`)), k);
  }
  assert.match(readSkill('spec-authoring'), /references\//);
});

test('spec-authoring derives a shard-targeted proposal and writes only after consent', () => {
  const md = readSkill('spec-authoring');
  assert.match(md, /drop[\s\S]{0,80}replace[\s\S]{0,80}add/i);
  assert.match(md, /bullet|불릿/);
  assert.match(md, /source|출처.*explain|explain.*절/i);
  assert.match(md, /target shard|대상 샤드|shard id/i);
  assert.match(md, /audit\.shards/);
  assert.match(md, /consent|동의|승인/);
  assert.match(md, /only after|after.*consent|동의.*(?:이후|뒤).*쓴|동의.*쓰기/i);
  assert.match(md, /current body|현재 본문|body content/);
  assert.match(md, /registered relative path|등재.*상대 경로/i);
  assert.match(md, /separate[\s\S]{0,10}read|read each.*separately|각.*따로.*읽/i);
  assert.match(md, /single-file/);
  assert.match(md, /never invoke.*route|never invokes route|route.*자체/);
  assert.match(md, /caller-supplied|caller-provided|호출자.*(?:제공|넘긴)/i);
  assert.match(md, /aggregate|selection|합산|선택 결과/i);
  assert.match(md, /never[^\n]{0,120}(?:attach|associate|individual shard|개별 샤드)/i);
  assert.doesNotMatch(md, /scripts\/bouncer|BOUNCER_ROOT/);
});
