'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const DOC = path.join(root, 'docs/benchmark/context-cost.md');

const HEADINGS = ['## 회귀 시나리오', '## 정적 지표', '## 런당 기록 값', '## Baseline'];
const IDS = [
  's1-light-cycle',
  's2-full-plan',
  's3-verify-recovery',
  's4-review-roundtrip',
  's5-finalize-distill',
  's6-finalize-bare',
  's7-run-multitask',
];

test('context-cost.md declares the four sections and seven scenario ids', () => {
  const body = fs.readFileSync(DOC, 'utf8');

  for (const heading of HEADINGS) {
    assert.ok(body.includes(heading), `missing heading: ${heading}`);
  }

  // 산문에 부분 문자열로만 등장하면 표의 계약 id가 아니다.
  // 백틱으로 감싼 리터럴만 인정해 우연한 부분 일치를 통과시키지 않는다.
  for (const id of IDS) {
    assert.ok(body.includes('`' + id + '`'), `missing backtick-wrapped id: ${id}`);
  }
});
