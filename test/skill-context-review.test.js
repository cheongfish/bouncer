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

// 호출 계약: CLI 전략이 single이면 combined, clustered이면 local(+cluster)+global.
// legacy 네 관점 이름은 round·category 호환으로만 남기고 고정 호출 단위가 아니다.
test('context-review dispatches adaptive combined or local+global perspectives and records rounds', () => {
  const md = readSkill('context-review');
  assert.match(md, /review-dispatch/);
  for (const perspective of ['combined', 'local', 'global']) {
    assert.match(md, new RegExp(`\`${perspective}\``));
  }
  // 네 기존 rubric 판단 항목은 관점 매핑으로 보존한다 — 호출 단위 이름과 1:1이 아니다.
  for (const rubric of ['cross_document', 'scope', 'korean_quality', 'success_criteria']) {
    assert.match(md, new RegExp(rubric));
  }
  assert.match(md, /bouncer\.context_review\.rounds/);
  assert.match(md, /target_digest/);
  assert.match(md, /discovery/);
  assert.match(md, /delta/);
  assert.match(md, /context:/);
  // delta는 전략·cluster 수와 무관하게 한 번만 인증한다.
  assert.match(md, /delta[\s\S]{0,200}(?:once|한 번)|(?:once|한 번)[\s\S]{0,80}delta/i);
});

// controller 절차: snapshot 고정 → CLI 전략 → single|clustered discovery → 단일 수정 → delta 인증.
test('plan context-review controller freezes a digest, revises once, and certifies the delta', () => {
  const md = fs.readFileSync(planContextReviewPath, 'utf8');
  assert.match(md, /snapshot/i);
  assert.match(md, /sha256/);
  assert.match(md, /frontmatter/);
  // digest 입력 순서: epic → blueprint → tasks 번호 오름차순.
  assert.match(md, /epic `index\.md`[\s\S]{0,80}blueprint `index\.md`[\s\S]{0,80}tasks\/<NNN>\/tasks\.md/);
  assert.match(md, /ascending/i);
  assert.match(md, /review-dispatch plan/);
  assert.match(md, /`single`/);
  assert.match(md, /`clustered`/);
  assert.match(md, /`combined`/);
  assert.match(md, /`local`/);
  assert.match(md, /`global`/);
  assert.match(md, /target_digest/);
  assert.match(md, /once/i);
  assert.match(md, /\bdelta\b/);
  assert.match(md, /previous findings/i);
  assert.match(md, /introduced_by_revision/);
  assert.match(md, /missed_critical/);
  // CLI 실패·digest 불일치에서는 reviewer를 부르지 않는다.
  assert.match(md, /ok:\s*false|`ok`:\s*`false`/);
  assert.match(md, /(?:do not|never|stop|halt|abort)[\s\S]{0,120}reviewer|reviewer[\s\S]{0,80}(?:do not|never|stop|halt|abort)/i);
});

// named dispatch는 대화 이력을 싣지 않고, delta는 실제 수정 문서만 받는다.
test('plan context-review named dispatch excludes conversation history and limits delta docs', () => {
  const md = fs.readFileSync(planContextReviewPath, 'utf8');
  const discoveryAt = md.indexOf('2. **Discovery**');
  const mergeAt = md.indexOf('3. **Merge**');
  const deltaAt = md.indexOf('5. **Certify the delta**');
  const closeAt = md.indexOf('6. **Close**');
  assert.ok(discoveryAt >= 0 && mergeAt > discoveryAt);
  assert.ok(deltaAt >= 0 && closeAt > deltaAt);
  const discovery = md.slice(discoveryAt, mergeAt);
  const delta = md.slice(deltaAt, closeAt);

  assert.match(discovery, /fork_turns:\s*"none"/);
  assert.match(delta, /fork_turns:\s*"none"/);
  // 전체 대화 이력을 controller input에서 배제한다.
  assert.match(discovery, /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:full )?conversation|full conversation[\s\S]{0,80}(?:do not|never|exclude|배제)|대화 이력/i);
  assert.match(delta, /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:full )?conversation|full conversation[\s\S]{0,80}(?:do not|never|exclude|배제)|대화 이력/i);
  // discovery도 판단 집합 밖 문서를 거절한다.
  assert.match(
    discovery,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,100}(?:out of (?:scope|judgment)|outside (?:that |the )?(?:judged|revised)|documents? outside)|(?:out of (?:scope|judgment)|outside (?:that |the )?(?:judged|revised)|documents? outside)[\s\S]{0,80}(?:do not|never|exclude|배제)|판단 대상 밖/i,
  );
  // CT-001: "documents outside" 일반 거절만으로는 cluster 간 local 문서 격리가 고정되지 않는다.
  // allowlist 문구(each `local`: …)에 고정 — 앞쪽 "one `local` call"과 혼동하지 않는다.
  assert.match(
    discovery,
    /each\s+`local`:\s*only that cluster'?s\s+task documents\s*[—\-–]\s*never another cluster'?s docs/i,
  );
  // delta 입력은 previous findings + 실제 수정된 문서 목록으로 경계를 고정한다.
  assert.match(delta, /previous findings/i);
  assert.match(delta, /modified document|실제 수정|documents? (?:actually )?modified|revised documents? only/i);
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
