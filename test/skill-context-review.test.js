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
  const { runCli } = require('../packages/cli/dist/cli');
  let out = '';
  const code = runCli(['context-review', '--help'], { out: (s) => { out += s; }, err: () => {} });
  assert.strictEqual(code, 0);
  assert.ok(out.includes('reuse | close | delta | restart | user'));
});
