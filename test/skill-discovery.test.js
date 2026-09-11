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

test('generic skills omit legacy protocol and methodology assumptions', () => {
  assert.doesNotMatch(readAllGenericSkills(), /superpowers/i);
});

// 프레이밍 사전 읽기는 preflight 출력 + baseline 경로. 전량 --all stdout 주입이 아니다.

test('discovery uses context-search status and canonical overlap evidence', () => {
  const md = readSkill('discovery');
  assert.doesNotMatch(md, /distill/i);
  assert.match(md, /query id, mode, status, graph/);
  assert.match(md, /Edge cases & failure modes/);
  assert.match(md, /canonical context decisions/);
  assert.match(md, /broad\/zero-hit diagnosis/);
});
