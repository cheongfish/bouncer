'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('implementation has valid frontmatter identity', () => {
  const md = readSkill('implementation');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*implementation/);
  assert.strictEqual(data.name, 'implementation');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('implementation follows approved tasks → focused change → tests → deviations', () => {
  const md = readSkill('implementation');
  assert.match(md, /approved tasks|tasks\.md|checklist/i);
  assert.match(md, /focused|scope|affected/i);
  assert.match(md, /test/i);
  assert.match(md, /deviation/i);
});

// 역할 rubric(사다리)의 정본은 agents/bouncer-implementer.md로 옮겼다.
// 이 스킬에는 호출 계약과 주석 루브릭만 남는다 — 사다리 사본이 다시 생기면 실패.
test('implementation keeps the call contract and defers the role rubric to the agent', () => {
  const md = readSkill('implementation');
  assert.match(md, /tasks\/<NNN>\/tasks\.md/);
  assert.match(md, /sole authority/i);
  assert.match(md, /agents\/bouncer-implementer\.md/);
  assert.match(md, /## Return/);
  assert.doesNotMatch(md, /Already in this codebase/);
  assert.doesNotMatch(md, /decision ladder/i);
  assert.doesNotMatch(md, /No unrequested abstractions/);
});

test('implementation requires detailed why-comments on non-trivial changes', () => {
  const md = readSkill('implementation');
  assert.match(md, /Detailed comments/i);
  assert.match(md, /[Hh]ard rule 9|하드룰 9/);
  assert.match(md, /\bwhy\b/i);
  assert.match(md, /invariant|trade-?off|ceiling/i);
  assert.match(md, /thorough|상세|Prefer thoroughness/i);
});

test('implementation shows good/bad comment contra examples from validate.js', () => {
  const md = readSkill('implementation');
  assert.match(md, /scripts\/lib\/validate\.js/);
  assert.match(md, /\*\*[Bb]ad\*\*|\bBad\b.*restat|나쁜/);
  assert.match(md, /\*\*[Gg]ood\*\*|\bGood\b.*why|좋은/);
  // Real why-fragments from validate.js (not invented samples).
  assert.match(md, /파싱하지 않아야/);
  assert.match(md, /같은 헬퍼를 써야/);
  assert.match(md, /재승인 경로가 없/);
});

test('implementation requires Korean docstrings with args and returns', () => {
  const md = readSkill('implementation');
  // 파일 전체가 아니라 Detailed comments 단계 구간에만 단정을 건다.
  // skill-minimality.test.js가 `## Decision ladder` 구간을 자르는 것과 같은 방식.
  const step = md.match(/^## Detailed comments$[\s\S]*?(?=\n## )/m);
  assert.ok(step, 'implementation must keep a Detailed comments section');
  const s = step[0];
  assert.match(s, /docstring/i);
  assert.match(s, /Args|인자/);
  assert.match(s, /Returns|반환/);
  // 언어 무관 규정: 구현 언어와 상관없이 한국어라는 문장이 있어야 한다.
  assert.match(s, /regardless of[^\n]{0,40}language|구현 언어와 (?:무관|상관)/i);
  // 두 언어의 형태 예시가 모두 있어야 한다. JSDoc은 중괄호 타입이어야 한다.
  assert.match(s, /@param \{[^}]+\} \w+/);
  assert.match(s, /Args:/);
});
