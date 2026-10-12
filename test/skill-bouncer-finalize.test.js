'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// PR 본문 절 순서가 계약이다. 템플릿(lib·GitHub·GitLab)과 draft-pr 참조가 같은 절을 같은
// 순서로 가져야 PR 생성 결과가 일관된다. 문장 표현은 고정하지 않는다.
test('PR templates and draft-pr reference → share the review-flow section order', () => {
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

  const sectionOrder = [
    '관련 이슈',
    '배경 · 변경 의도',
    '주요 변경 내용',
    '로직 흐름',
    '리뷰 포인트',
    '확인 방법',
  ];
  for (const doc of [PR_TEMPLATE, githubTpl, gitlabTpl, draftPr]) {
    let prev = -1;
    for (const title of sectionOrder) {
      const idx = doc.indexOf(title);
      assert.ok(idx > -1, `missing section ${title}`);
      assert.ok(idx > prev, `section order broken at ${title}`);
      prev = idx;
    }
  }
});

// 사라진 reference는 부활하지 않는다.
test('bouncer-finalize → does not ship the retired distill promotion reference', () => {
  assert.strictEqual(
    fs.existsSync(path.join(root, 'skills', 'bouncer-finalize', 'references', 'distill-promotion.md')),
    false,
  );
});
