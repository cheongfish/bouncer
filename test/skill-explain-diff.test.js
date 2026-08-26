'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');

test('explain-diff skill identity, sections, comprehension fields, and non-blocking score', () => {
  const md = fs.readFileSync(path.join(root, 'skills/explain-diff/SKILL.md'), 'utf8');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*explain-diff/);
  assert.strictEqual(data.name, 'explain-diff');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  // 호출 주체는 /bouncer-finalize (commit이 아님).
  assert.match(String(data.description), /bouncer-finalize|\/bouncer-finalize/i);
  assert.doesNotMatch(String(data.description), /bouncer-commit|\/bouncer-commit/i);

  // 다섯 섹션 — 교대(|)가 아니라 개별 단언. EXPLAIN_SECTION_DEFS와 1:1.
  for (const h of ['Background', 'Intuition', 'Code', 'Quiz', '이해 상태']) {
    assert.ok(md.includes(h), `missing section: ${h}`);
  }
  // 엔트리 필드 — range_from/range_to 포함. task 필드는 쓰지 않는다.
  for (const f of [
    'diff_sha', 'quiz_score', 'disposition', 'recorded_at',
    'range_from', 'range_to',
  ]) {
    assert.ok(md.includes(f), `missing field: ${f}`);
  }
  // BP 단일 엔트리 — append 체인/task 필드 금지와 함께 존재 단언.
  assert.match(md, /one (blueprint )?entr|단일 엔트리|exactly one/i);
  assert.match(md, /do \*\*not\*\* set a `task`|task` field|task 필드를 쓰지/i);
  assert.match(md, /range_from\.\.HEAD/);
  // range_from은 포인터 base로 고정.
  assert.match(md, /pointer `base`|포인터 `base`/);
  // 해시는 스킬이 직접 부른다 — 모듈 경로와 함수명을 함께 고정.
  assert.match(md, /scripts\/lib\/comprehension/);
  assert.match(md, /computeDiffSha/);
  // 점수 비차단은 긍정 문구로 단언한다. 낱말 부재(doesNotMatch)로 단언하면
  // 스킬이 "임계값을 두지 않는다"를 설명하는 순간 자기모순으로 깨진다.
  assert.match(md, /기록만 하고 (마감을 )?막지 않는다/);
  assert.match(md, /scaffold explain|대체하지/);
  assert.match(md, /Korean/);
  assert.match(md, /stop-slop/);
  assert.match(md, /skills\/stop-slop\/SKILL\.md/);

  // quiz_score 필수 + 퀴즈 스킵 경로 없음(부재만으로 단언하지 않음).
  assert.match(md, /quiz_score` is \*\*required\*\*|quiz_score`는 \*\*required\*\*|quiz_score.*필수/i);
  assert.match(md, /required|필수/);
  assert.match(md, /do not invent a skip|스킵|abort|중단/i);

  // ## 이해 상태 단일 블록 (task별 소제목 없음).
  assert.match(md, /단일 블록|single block/i);
  assert.match(md, /no per-task|per-task subhead|task별 소제목/i);

  // 적응형 퀴즈 — 문항 수·3지선다·정답 슬롯 분산을 개별 단언으로 고정.
  assert.match(md, /1[–~-]10/);
  assert.match(md, /three (answer )?options|3지선다/);
  assert.match(md, /vary the correct-answer position|한 위치에 몰지/);
  // ## Quiz는 문항+보기만, 정답·응답·정오는 ## 이해 상태 — 섹션 이름을 문장 단위로.
  assert.match(md, /`## Quiz`[^\n]*(questions?|options|문항|보기)/i);
  assert.match(
    md,
    /`## 이해 상태`[^\n]*(correct answers?|responses?|right\/wrong|정답|응답|정오|one block|단일)/i,
  );
  // 문항마다 ACQ를 돌리지 않고 한 번에 제시·한 번에 응답.
  assert.match(md, /all (questions? )?at once|한 번에 (제시|응답)/i);

  // G15를 스킬 문구에 남기지 않는다(존재 단언: G16이 판정 주체).
  assert.match(md, /\bG16\b/);
  assert.doesNotMatch(md, /\bG15\b/);
});

test('explain-diff fixes the light path at one question', () => {
  const md = fs.readFileSync(path.join(root, 'skills/explain-diff/SKILL.md'), 'utf8');
  assert.match(md, /scale/);
  assert.match(md, /light/);
  assert.match(md, /1문항|질문 수(를)? 1/);
  // 일반 경로의 1–10 판단은 유지된다.
  assert.match(md, /1–10|1-10/);
});

test('explain-diff gives one behavior when explain.md is missing', () => {
  const md = fs.readFileSync(path.join(root, 'skills', 'explain-diff', 'SKILL.md'), 'utf8');
  assert.doesNotMatch(md, /create\s+the\s+file\s+if\s+missing/i);
  assert.match(md, /stop\s+and\s+tell\s+the\s+caller\s+to\s+scaffold\s+first/i);
});
