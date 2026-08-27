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

/**
 * `## Baseline` 아래 정적 표(`| 지표 | 값 |`)에서 구분선 다음 데이터 행을 모은다.
 *
 * @param {string} body - `docs/benchmark/context-cost.md` 전체 본문
 * @returns {string[]} `|`로 시작하는 데이터 행. 표를 못 찾으면 빈 배열
 */
function staticBaselineDataRows(body) {
  // 같은 절에 실행 표가 바로 이어진다. 그 표의 헤더도 `|`로 시작하므로
  // 정적 표 헤더로 구간을 자르지 않으면 빈 본문이 실행 표 헤더로 통과한다.
  const start = body.indexOf('| 지표 | 값 |');
  if (start === -1) {
    return [];
  }

  const afterHeader = body.slice(start).split('\n');
  const rows = [];
  let pastSeparator = false;
  for (const line of afterHeader) {
    if (!pastSeparator) {
      if (/^\|\s*---/.test(line)) {
        pastSeparator = true;
      }
      continue;
    }
    // 빈 줄은 정적 표 끝. 다음 표(실행 지표)로 넘어가기 전에 끊는다.
    if (line.trim() === '') {
      break;
    }
    if (line.startsWith('|')) {
      rows.push(line);
    }
  }
  return rows;
}

test('context-cost.md static Baseline table has at least one data row', () => {
  const body = fs.readFileSync(DOC, 'utf8');
  const rows = staticBaselineDataRows(body);
  assert.ok(
    rows.length >= 1,
    'static Baseline table (| 지표 | 값 |) must have a data row after | ---',
  );
});
