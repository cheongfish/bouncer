'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

// frontmatter 정체성과 문서 구조는 PATH_CONTRACTS가 lint:docs로 검사한다.
// 여기에는 reviewer가 findings에 그대로 옮겨 적는 fingerprint 예시의 "형식"만 남긴다 —
// 기록 검증이 받는 값이 아니면 예시를 따라 쓴 plan review가 기록 시점에 거절된다.
test('context review docs → carry a record-valid fingerprint example', () => {
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
      /^\s*`?fingerprint: context:(combined|local|global|cross_document|scope|korean_quality|success_criteria|consistency|scope_minimality|verifiability|risk_security):/,
      `${rel} example`,
    );
  }
});

// 브리프(098-003/004)가 rubric 문구를 계약으로 고정했으므로 제목·키워드만 단언한다.
// 두 판단 밖의 일(경로 존재, 문장 품질 stop-slop)이 다시 finding으로 새지 않게 막는 회귀 장치다.
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
  for (const phrase of ['Path existence', 'stop-slop']) {
    assert.ok(out.includes(phrase), `out of judgment mentions ${phrase}`);
  }
  const index = fs.readFileSync(path.join(root, 'references', 'context-review', 'index.md'), 'utf8');
  assert.ok(!index.includes('four rubrics'));
});

// 표식 blueprint는 관점마다 reviewer를 따로 부른다. 관점 이름이 제목으로 한 번씩만 있어야
// reviewer가 자기 판정 범위 본문을 하나로 찾고, 같은 관점이 두 본문으로 갈라지지 않는다.
test('context reviewer doc → has exactly one heading per plan perspective', () => {
  const md = fs.readFileSync(path.join(root, 'agents', 'bouncer-context-reviewer.md'), 'utf8');
  const count = (re) => (md.match(re) ?? []).length;
  assert.strictEqual(count(/^### consistency\b/gm), 1, '### consistency');
  assert.strictEqual(count(/^### scope_minimality\b/gm), 1, '### scope_minimality');
  assert.strictEqual(count(/^### verifiability\b/gm), 1, '### verifiability');
  assert.strictEqual(count(/^### risk_security\b/gm), 1, '### risk_security');
});

// route 도움말의 next_action 목록은 controller가 읽는 계약이다: close가 빠지면 본문 수정 경로를 못 찾는다.
test('context-review help → lists close among the route next_action values', () => {
  const { runCli } = require('../scripts/lib/cli');
  let out = '';
  const code = runCli(['context-review', '--help'], { out: (s) => { out += s; }, err: () => {} });
  assert.strictEqual(code, 0);
  assert.ok(out.includes('reuse | close | delta | restart | user'));
});

// 교착 회귀: delta 뒤 열린 must_fix를 고친 경우 CLI가 받는 경로(close·restart·user)만 안내해야 한다.
// 6단계 Close 절과 route 목록의 must_fix 항목만 잘라 단언해 문서 다른 곳의 우연한 일치를 배제한다.
test('open must_fix after delta → guide names close, restart and accepted-risk user outcomes', () => {
  const md = fs.readFileSync(
    path.join(root, 'skills', 'bouncer-plan', 'references', 'context-review.md'),
    'utf8',
  );
  const close = md.slice(md.indexOf('6. **Close**'), md.indexOf('When the plan gate reports'));
  const at = md.indexOf('- no round is recorded yet');
  const routeItem = md.slice(at, md.indexOf('\n- ', at + 1));
  assert.ok(!md.includes('does not resolve findings'));
  assert.match(close, /body-only[\s\S]*`close`[\s\S]*resolved/);
  assert.match(close, /contract[\s\S]*`restart`/);
  assert.match(routeItem, /accepted-risk[\s\S]*stop/);
});

// 기존 단언을 바꾸는 task는 Constraints에 파일·테스트명·새 기대값을 적어야 한다. 이 책임이
// consistency 절에서 빠지면 단언 변경 범위가 비어 있는 브리프가 어느 관점에서도 걸리지 않는다.
test('consistency rubric → requires Constraints to name changed assertion file, test and expectation', () => {
  const md = fs.readFileSync(path.join(root, 'agents', 'bouncer-context-reviewer.md'), 'utf8');
  const start = md.indexOf('### consistency');
  assert.ok(start >= 0, 'consistency section exists');
  const rest = md.slice(start + 4);
  const end = rest.search(/\n##+ /);
  const body = end < 0 ? rest : rest.slice(0, end);
  for (const phrase of ['existing assertion', 'Constraints', 'test name', 'new expected value']) {
    assert.ok(body.includes(phrase), `consistency mentions ${phrase}`);
  }
});
