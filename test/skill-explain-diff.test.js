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
  assert.match(String(data.description), /finalize/i);

  // 다섯 섹션 — 교대(|)가 아니라 개별 단언. EXPLAIN_SECTION_DEFS와 1:1.
  for (const h of ['Background', 'Intuition', 'Code', 'Quiz', '이해 상태']) {
    assert.ok(md.includes(h), `missing section: ${h}`);
  }
  // comprehension 네 필드 — 개별 단언.
  for (const f of ['diff_sha', 'quiz_score', 'disposition', 'recorded_at']) {
    assert.ok(md.includes(f), `missing field: ${f}`);
  }
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

  // 적응형 퀴즈 — 문항 수·3지선다·정답 슬롯 분산을 개별 단언으로 고정.
  assert.match(md, /1[–~-]10/);
  assert.match(md, /three (answer )?options|3지선다/);
  assert.match(md, /vary the correct-answer position|한 위치에 몰지/);
  // ## Quiz는 문항+보기만, 정답·응답·정오는 ## 이해 상태 — 섹션 이름을 문장 단위로.
  assert.match(md, /`## Quiz`[^\n]*(questions?|options|문항|보기)/i);
  assert.match(
    md,
    /`## 이해 상태`[^\n]*(correct answers?|responses?|right\/wrong|정답|응답|정오)/i,
  );
  // 문항마다 ACQ를 돌리지 않고 한 번에 제시·한 번에 응답.
  assert.match(md, /all (questions? )?at once|한 번에 (제시|응답)/i);
});
