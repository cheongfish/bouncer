'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// PR 본문 절 순서와 필수 절이 계약이다. 템플릿(lib·GitHub·GitLab)과 draft-pr 참조가 같은 절을
// 같은 순서로 가져야 PR 생성 결과가 일관된다. 절 이름·필수 표시는 문서 형식 자체가 계약이다.
const sectionOrder = [
  '관련 이슈',
  '배경 · 변경 의도',
  '주요 변경 내용',
  '변경 그림',
  '변경 전후',
  '리뷰 포인트',
  '되돌리기 · 영향 범위',
  '확인 방법',
];
const skipRules =
  /docs\/config\/tests\s+only|문서·설정·테스트만|Omit\s+the\s+heading|rename\/move|denser\s+than\s+the\s+code|이름\s*변경·이동이면/;

function loadDocs() {
  const draftPr = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-finalize', 'references', 'draft-pr.md'),
    'utf8',
  );
  const { PR_TEMPLATE } = require('../scripts/lib/templates');
  const githubTpl = fs.readFileSync(path.join(root, '.github', 'pull_request_template.md'), 'utf8');
  const gitlabTpl = fs.readFileSync(
    path.join(root, '.gitlab', 'merge_request_templates', 'Default.md'),
    'utf8',
  );
  return { draftPr, templates: [PR_TEMPLATE, githubTpl, gitlabTpl] };
}

test('PR templates and draft-pr reference → share the eight-section order', () => {
  const { draftPr, templates } = loadDocs();
  const check = (doc, marker) => {
    let prev = -1;
    for (const name of sectionOrder) {
      const idx = doc.indexOf(marker(name));
      assert.ok(idx > -1, `missing section ${name}`);
      assert.ok(idx > prev, `section order broken at ${name}`);
      prev = idx;
    }
  };
  for (const doc of templates) check(doc, (n) => `## ${n}`);
  check(draftPr, (n) => `| \`${n}\``);
});

test('PR templates and draft-pr reference → carry no retired flow section or skip rule', () => {
  const { draftPr, templates } = loadDocs();
  for (const doc of [draftPr, ...templates]) {
    assert.ok(!doc.includes('로직 흐름'));
    assert.ok(!skipRules.test(doc));
  }
});

test('draft-pr reference → marks the three sections mandatory and keeps the unobserved-before rule', () => {
  const { draftPr } = loadDocs();
  assert.ok(draftPr.includes('`변경 그림` (필수)'));
  assert.ok(draftPr.includes('`변경 전후` (필수)'));
  assert.ok(draftPr.includes('`되돌리기 · 영향 범위` (필수)'));
  assert.ok(draftPr.includes('변경 전 결과 미관측'));
});

// 사라진 reference는 부활하지 않는다.
test('bouncer-finalize → does not ship the retired distill promotion reference', () => {
  assert.strictEqual(
    fs.existsSync(path.join(root, 'skills', 'bouncer-finalize', 'references', 'distill-promotion.md')),
    false,
  );
});

// Retro 생략 한 줄은 사용자에게 그대로 출력되는 계약 문자열이다. 조건은 prepare가
// 낸 drive_issues 필드명이 기계 판독 계약이므로 그 이름으로 고정한다.
test('bouncer-finalize SKILL → gates retro on preserved drive_issues and prints the skip line when all are 0', () => {
  const skill = fs.readFileSync(path.join(root, 'skills', 'bouncer-finalize', 'SKILL.md'), 'utf8');
  assert.ok(skill.includes('drive_issues'));
  assert.ok(skill.includes('retro 생략 — 수정 문제 없음'));
});

test('draft-pr reference → renders the digest unresolved_must_fix section', () => {
  const { draftPr } = loadDocs();
  assert.ok(draftPr.includes('pr.sections.unresolved_must_fix'));
});
