'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');

test('explain-diff skill identity, sections, comprehension fields, and non-blocking score', () => {
  const md = fs.readFileSync(path.join(root, 'references/explain-diff/index.md'), 'utf8');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*explain-diff/);
  assert.strictEqual(data.name, 'explain-diff');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  // 호출 주체는 /bouncer-finalize (commit이 아님).
  assert.match(String(data.description), /bouncer-finalize|\/bouncer-finalize/i);
  assert.doesNotMatch(String(data.description), /bouncer-commit|\/bouncer-commit/i);

  // 네 섹션 — 교대(|)가 아니라 개별 단언. EXPLAIN_SECTION_DEFS와 1:1.
  for (const h of ['Background', 'Intuition', 'Code', 'Quiz']) {
    assert.ok(md.includes(h), `missing section: ${h}`);
  }
  // 엔트리 필드 — range_from/range_to 포함. task 필드는 쓰지 않는다.
  for (const f of [
    'diff_sha', 'recorded_at',
    'range_from', 'range_to',
  ]) {
    assert.ok(md.includes(f), `missing field: ${f}`);
  }
  // BP 단일 엔트리 — append 체인/task 필드 금지와 함께 존재 단언.
  assert.match(md, /one (blueprint )?entr|단일 엔트리|exactly one/i);
  assert.match(md, /do \*\*not\*\* set a `task`|task` field|task 필드를 쓰지/i);
  // Quiz·diff 범위는 finalize prepare digest의 range.base..range.head다.
  assert.match(md, /range\.base/);
  assert.match(md, /range\.base\.\.range\.head|range_from\.\.range_to|range_from\.\.HEAD/);
  // 해시는 digest diff_sha를 우선하고, 없을 때만 computeDiffSha로 폴백한다.
  assert.match(md, /diff_sha/);
  assert.match(md, /scripts\/lib\/comprehension|digest/);
  // 오답 비차단은 긍정 문구로 단언한다. 낱말 부재(doesNotMatch)로 단언하면
  // 스킬이 "임계값을 두지 않는다"를 설명하는 순간 자기모순으로 깨진다.
  assert.match(md, /오답은 마감을 막지 않는다/);
  assert.match(md, /scaffold explain|대체하지/);
  assert.match(md, /Korean/);
  assert.match(md, /stop-slop/);
  assert.match(md, /references\/stop-slop\/index\.md/);

  // 퀴즈는 필수이되 점수·정답·응답은 파일에 쓰지 않는다. 스킵 경로는 없다.
  assert.match(md, /required|필수/);
  assert.match(md, /do not invent a skip|스킵|abort|중단/i);
  assert.match(md, /바뀐 제품 동작|changed product behavior/);
  assert.match(md, /repair wave/);
  assert.match(md, /scope revision/);
  assert.match(md, /integration head/);
  assert.match(md, /정답[\s\S]{0,80}(채팅|chat)/);
  assert.doesNotMatch(md, /quiz_score|disposition|## 이해 상태/);
  assert.doesNotMatch(md, /five (Korean )?sections/i);

  // 적응형 퀴즈 — 문항 수·3지선다·정답 슬롯 분산을 개별 단언으로 고정.
  assert.match(md, /1[–~-]10/);
  assert.match(md, /three (answer )?options|3지선다/);
  assert.match(md, /vary the correct-answer position|한 위치에 몰지/);
  // ## Quiz는 문항+보기만. 정답은 채팅에서만 공개한다.
  assert.match(md, /`## Quiz`[^\n]*(questions?|options|문항|보기)/i);
  // 문항마다 ACQ를 돌리지 않고 한 번에 제시·한 번에 응답.
  assert.match(md, /all (questions? )?at once|한 번에 (제시|응답)/i);

  // G15를 스킬 문구에 남기지 않는다(존재 단언: G16이 판정 주체).
  assert.match(md, /\bG16\b/);
  assert.doesNotMatch(md, /\bG15\b/);
  // 단일 bouncer.comprehension 엔트리 계약은 유지한다.
  assert.match(md, /bouncer\.comprehension/);
});

// Preserved task context는 실제 finalize 보존 절·stable ID 제목과 맞고,
// digest range·CLI(finalize prepare)를 허용한다. 옛 drift 문구는 제거한다.
test('explain-diff documents digest range, stable-id task headings, and preserved sections', () => {
  const md = fs.readFileSync(path.join(root, 'references/explain-diff/index.md'), 'utf8');
  assert.match(md, /range\.base/);
  assert.match(md, /EPIC-\d{3}\/BP-\d{3}\/TASK-\d{3}|stable (Task )?ID|`sha8`/i);
  assert.doesNotMatch(md, /No new CLI/);
  assert.doesNotMatch(
    md,
    /copies only the authored `Goal & intent`, `Interface`, and `Do not touch`/,
  );
  assert.match(md, /Goal & intent/);
  assert.match(md, /Current behavior/);
  assert.match(md, /Target behavior/);
  assert.match(md, /Interface/);
  assert.match(md, /Touch/);
  assert.match(md, /Constraints/);
  assert.match(md, /bouncer\.comprehension/);
  assert.match(md, /\bG16\b/);
});

test('explain-diff fixes the light path at one question', () => {
  const md = fs.readFileSync(path.join(root, 'references/explain-diff/index.md'), 'utf8');
  assert.match(md, /scale/);
  assert.match(md, /light/);
  assert.match(md, /1문항|질문 수(를)? 1/);
  // 일반 경로의 1–10 판단은 유지된다.
  assert.match(md, /1–10|1-10/);
});

test('explain-diff keeps its one-shot quiz response separate from ACQ', () => {
  const md = fs.readFileSync(path.join(root, 'references/explain-diff/index.md'), 'utf8');
  assert.match(md, /rules\/acq\.md/);
  assert.match(md, /not an ACQ|ACQ.*not/i);
});

test('explain-diff gives one behavior when explain.md is missing', () => {
  const md = fs.readFileSync(path.join(root, 'references', 'explain-diff', 'index.md'), 'utf8');
  assert.doesNotMatch(md, /create\s+the\s+file\s+if\s+missing/i);
  assert.match(md, /stop\s+and\s+tell\s+the\s+caller\s+to\s+scaffold\s+first/i);
});
