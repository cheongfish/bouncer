'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill, readAllGenericSkills } = require('./helpers/read-skill');

test('discovery has valid frontmatter identity', () => {
  const md = readSkill('discovery');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*discovery/);
  assert.strictEqual(data.name, 'discovery');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('discovery clarifies goal, scope, non-goals, and success criteria', () => {
  const md = readSkill('discovery');
  assert.match(md, /goal/i);
  assert.match(md, /scope/i);
  assert.match(md, /non-?goals?/i);
  assert.match(md, /success criteria/i);
  assert.match(md, /confirm/i);
});

test('discovery names the handoff contract it passes to planning', () => {
  const md = readSkill('discovery');
  assert.match(md, /Return/);
  assert.match(md, /Edge cases & failure modes/);
  assert.match(md, /Overlap/);
  // missing path must be present in body
  assert.match(md, /missing|absent|없으면|does not exist/i);
});

// 요청이 비운 결정을 추정으로 메우거나 저장소 기여 규칙을 놓치면 계획이 틀린 전제 위에 선다.
test('discovery asks open decisions and hands off project rules', () => {
  const md = readSkill('discovery');
  assert.match(md, /\*\*Open decisions\*\*[\s\S]{0,700}ask the user/);
  assert.match(md, /Do not settle an open\s+decision/);
  assert.match(md, /\*\*Project rules\*\*/);
  assert.match(md, /CONTRIBUTING\.md/);
  const handoff = md.slice(md.indexOf('## Return'));
  assert.match(handoff, /`Open decisions`/);
  assert.match(handoff, /`Project rules`/);
});

test('generic skills omit legacy protocol and methodology assumptions', () => {
  assert.doesNotMatch(readAllGenericSkills(), /superpowers/i);
});

// 프레이밍 사전 읽기는 preflight 출력 + baseline 경로. 전량 --all stdout 주입이 아니다.

test('discovery uses bouncer intent and code-grounded overlap evidence', () => {
  const md = readSkill('discovery');
  assert.doesNotMatch(md, /distill/i);
  assert.match(md, /bouncer intent/);
  assert.match(md, /Edge cases & failure modes/);
  assert.doesNotMatch(md, /context-search|query id|graph version/);
});
