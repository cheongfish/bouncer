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

// 브리프(098-003/004)가 rubric 문구를 계약으로 고정했으므로 제목·키워드만 단언한다.
// 두 판단 밖의 일(경로 존재 G25, 문장 품질 stop-slop)이 다시 finding으로 새지 않게 막는 회귀 장치다.
test('context reviewer rubric → judges two scopes with storage ownership and review_risk checks', () => {
  const md = fs.readFileSync(path.join(root, 'agents', 'bouncer-context-reviewer.md'), 'utf8');
  // `### <title>` 절 본문을 다음 `##`/`###` 제목 직전까지 잘라낸다.
  const section = (src, title) => {
    const start = src.indexOf(`### ${title}`);
    assert.ok(start >= 0, `section ${title} exists`);
    const rest = src.slice(start + 4);
    const end = rest.search(/\n##+ /);
    return end < 0 ? rest : rest.slice(0, end);
  };
  assert.ok(!md.includes('### Scope review'), 'no Scope review heading');
  assert.ok(!md.includes('### Korean quality'), 'no Korean quality heading');
  assert.ok(md.includes('## Rubric — two scopes'));
  const cross = section(md, 'Cross-document consistency and scope');
  for (const phrase of ['storage location', 'state ownership', 'review_risk']) {
    assert.ok(cross.includes(phrase), `cross-document mentions ${phrase}`);
  }
  const out = section(md, 'Out of judgment');
  for (const phrase of ['G25', 'stop-slop']) {
    assert.ok(out.includes(phrase), `out of judgment mentions ${phrase}`);
  }
  const index = fs.readFileSync(path.join(root, 'references', 'context-review', 'index.md'), 'utf8');
  assert.ok(!index.includes('four rubrics'));
});

// route 도움말의 next_action 목록은 controller가 읽는 계약이다: close가 빠지면 본문 수정 경로를 못 찾는다.
test('context-review help → lists close among the route next_action values', () => {
  const { runCli } = require('../scripts/lib/cli');
  let out = '';
  const code = runCli(['context-review', '--help'], { out: (s) => { out += s; }, err: () => {} });
  assert.strictEqual(code, 0);
  assert.ok(out.includes('reuse | close | delta | restart | user'));
});
