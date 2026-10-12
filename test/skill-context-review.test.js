'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// frontmatter 정체성과 문서 구조는 PATH_CONTRACTS가 lint:docs로 검사한다.
// 여기에는 reviewer가 findings에 그대로 옮겨 적는 fingerprint 예시의 "형식"만 남긴다 —
// G18이 받는 값이 아니면 예시를 따라 쓴 plan review가 게이트에서 거절된다.
test('context review docs → carry a G18-valid fingerprint example', () => {
  const docs = [
    path.join(root, 'skills', 'bouncer-plan', 'references', 'context-review.md'),
    path.join(root, 'references', 'context-review', 'index.md'),
    path.join(root, 'agents', 'bouncer-context-reviewer.md'),
  ];
  for (const file of docs) {
    const md = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    const line = md.split('\n').find((l) => /^\s*`?fingerprint: /.test(l));
    assert.ok(line, `${rel} has a fingerprint example`);
    assert.match(
      line,
      /^\s*`?fingerprint: context:(combined|local|global|cross_document|scope|korean_quality|success_criteria):/,
      `${rel} example`,
    );
  }
});
