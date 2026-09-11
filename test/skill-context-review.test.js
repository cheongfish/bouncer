'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
// controller 기록 경로 — 리뷰어 스킬 본문(references/context-review)이 아니라
// plan이 findings를 쓸 때 읽는 절이다.
const planContextReviewPath = path.join(
  root,
  'skills',
  'bouncer-plan',
  'references',
  'context-review.md',
);

test('context-review has valid frontmatter identity', () => {
  const md = readSkill('context-review');
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'context-review');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  // plan 내부 사용과 사용자 직접 요청(이름 호출)을 한 문장에 둔다.
  assert.match(String(data.description), /^Use during \/bouncer-plan/);
  assert.match(String(data.description), /when named/);
  assert.match(String(data.description), /Findings/);
  assert.doesNotMatch(String(data.description), /##/);
});

test('context-review forbids document edits and status flips', () => {
  const md = readSkill('context-review');
  assert.match(md, /must not edit|do not edit|never edit/i);
  assert.match(md, /status/i);
  assert.match(md, /controller/i);
});

test('context-review findings require id, severity, status, and a note on accepted', () => {
  const md = readSkill('context-review');
  assert.match(md, /## Findings/);
  assert.match(md, /`id`|\bid\b/);
  assert.match(md, /severity/i);
  assert.match(md, /blocker|major|minor|nit/i);
  assert.match(md, /resolved|accepted/i);
  assert.match(md, /accepted[^\n]*note|note[^\n]*accepted/i);
});

// light blueprint에는 context-review 문서 자체가 없다 — 이 rubric은 full 전용이다.
test('context-review declares itself full-plan only', () => {
  const md = readSkill('context-review');
  assert.match(md, /[Ff]ull plans only|full-plan only/);
  assert.match(md, /bouncer\.scale/);
  assert.match(md, /light/);
  assert.match(md, /G18/);
  assert.match(md, /scaffold blueprint --scale light|does not create it/);
  // light용 축약 rubric을 따로 만들지 않는다.
  assert.match(md, /no light variant|set `scale` back to `full`/);
});

// 호출 계약: 네 관점을 병렬로 나눠 보내고, 결과를 context_review.rounds[]에 남긴다.
test('context-review dispatches four perspectives in parallel and records rounds', () => {
  const md = readSkill('context-review');
  assert.match(md, /parallel/i);
  for (const perspective of ['cross_document', 'scope', 'korean_quality', 'success_criteria']) {
    assert.match(md, new RegExp(`\`${perspective}\``));
  }
  assert.match(md, /bouncer\.context_review\.rounds/);
  assert.match(md, /target_digest/);
  assert.match(md, /discovery/);
  assert.match(md, /delta/);
  assert.match(md, /context:/);
});

// controller 절차: snapshot 고정 → digest → 관점별 병렬 dispatch → 단일 수정 → delta 인증.
test('plan context-review controller freezes a digest, revises once, and certifies the delta', () => {
  const md = fs.readFileSync(planContextReviewPath, 'utf8');
  assert.match(md, /snapshot/i);
  assert.match(md, /sha256/);
  assert.match(md, /frontmatter/);
  // digest 입력 순서: epic → blueprint → tasks 번호 오름차순.
  assert.match(md, /epic `index\.md`[\s\S]{0,80}blueprint `index\.md`[\s\S]{0,80}tasks\/<NNN>\/tasks\.md/);
  assert.match(md, /ascending/i);
  assert.match(md, /in parallel/i);
  assert.match(md, /target_digest/);
  assert.match(md, /once/i);
  assert.match(md, /\bdelta\b/);
  assert.match(md, /previous findings/i);
  assert.match(md, /introduced_by_revision/);
  assert.match(md, /missed_critical/);
});

// controller 기록 경로가 finding note에 같은 YAML 선두 인용 규칙을 갖는지 본다.
// 문구 고정이 아니라 위험 입력·안전 형식·정본 연결의 식별자만 본다.
test('plan context-review controller quotes YAML-leading reserved characters in finding notes', () => {
  const md = fs.readFileSync(planContextReviewPath, 'utf8');
  assert.match(md, /\bnote\b/i);
  assert.match(md, /예약 지시자|reserved (?:indicator|character)|백틱|backtick/i);
  assert.match(md, /작은따옴표|single[- ]quot|block scalar|>-/i);
  // 정본은 spec-authoring — 중복 본문이 아니라 연결
  assert.match(md, /spec-authoring/);
});
