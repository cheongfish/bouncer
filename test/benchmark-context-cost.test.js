'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');

const root = path.join(__dirname, '..');
const DOC = path.join(root, 'docs/benchmark/context-cost.md');
const HISTORY = path.join(root, 'docs/benchmark/history.md');

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

const FIXED_PROMPTS = {
  's1-light-cycle': "경량 Bouncer 계획으로 docs/benchmark/context-cost-fixture.md에 제목 '# context cost fixture'와 본문 's1-light-cycle'을 기록하고 execute와 commit까지 끝내라. 물어볼 사람은 없다.",
  's2-full-plan': "full Bouncer 계획으로 docs/benchmark/context-cost-fixture.md에 제목 '# context cost fixture'와 본문 's2-full-plan'을 기록하는 task를 plan 게이트까지 준비하라. 구현하지 말고, 물어볼 사람은 없다.",
  's3-verify-recovery': "현재 task의 verify 실패를 debugging 절차로 진단하고 named bouncer-debugger fallback을 직접 호출해 본문을 's3-verify-recovery'로 고친 뒤 execute 게이트까지 통과시켜라. 물어볼 사람은 없다.",
  's4-review-roundtrip': "현재 diff를 review 절차로 판정하고 named bouncer-reviewer fallback을 직접 호출하라. 본문을 's4-review-roundtrip'으로 고친 뒤 같은 reviewer로 한 번 더 판정해 execute 게이트까지 통과시켜라. 물어볼 사람은 없다.",
  's5-finalize-distill': '현재 blueprint를 /bouncer-finalize 절차로 마감하라. Distill 승격 후보가 없으면 그대로 진행하고, 물어볼 사람은 없다.',
  's6-finalize-bare': '현재 blueprint를 /bouncer-finalize 절차로 마감하라. Distill이 없는 경로를 그대로 처리하고, 물어볼 사람은 없다.',
  's7-run-multitask': '현재 blueprint의 열린 task를 /bouncer-run으로 모두 execute하고 commit하라. auto 다음-task 이동을 사용하고, 물어볼 사람은 없다.',
};

const BASELINE_COLUMNS = [
  'id', '측정일', 'tokens_in', 'tokens_out', 'wall_s', 'tool_calls',
  'gate 통과율', 'review finding 수', 'scope 위반 수', '산출물 경로',
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

/**
 * Markdown 표의 헤더와 데이터 행을 같은 위치에서 읽는다. 두 문서가 같은
 * baseline 열을 쓰는지만 검사하므로, 다른 회차 표와 섞일 여지가 없다.
 *
 * @param {string} body - Markdown 전체 본문
 * @param {string} heading - 표가 속한 절 제목
 * @param {string[]} headers - 기대하는 표 헤더
 * @returns {string[]} 구분선 다음의 데이터 행
 */
function tableRows(body, heading, headers) {
  const section = body.slice(body.indexOf(heading));
  const header = '| ' + headers.join(' | ') + ' |';
  const start = section.indexOf(header);
  if (start === -1) {
    return [];
  }

  const lines = section.slice(start).split('\n');
  const rows = [];
  let pastSeparator = false;
  for (const line of lines) {
    if (!pastSeparator) {
      if (/^\|\s*---/.test(line)) {
        pastSeparator = true;
      }
      continue;
    }
    if (line.trim() === '' || !line.startsWith('|')) {
      break;
    }
    rows.push(line);
  }
  return rows;
}

test('fixed run inputs preserve all seven scenario contracts', () => {
  const body = fs.readFileSync(DOC, 'utf8');
  assert.ok(body.includes('## 고정 실행 입력'), 'missing fixed-run input section');

  const fixedInputHeader = '| id | base | 모델 | reasoning effort | 사람 개입 | Fixture · 기대 본문 | 실행 프롬프트 | 완료 조건 |';
  assert.ok(body.includes(fixedInputHeader), 'fixed-input table must declare a Fixture header');

  for (const [id, prompt] of Object.entries(FIXED_PROMPTS)) {
    const row = body.split('\n').find((line) => line.includes('`' + id + '`'));
    assert.ok(row, `missing fixed-input row: ${id}`);
    assert.ok(row.includes('`1c73980`'), `${id}: missing base`);
    assert.ok(row.includes('`gpt-5.6-terra`'), `${id}: missing model`);
    assert.ok(row.includes('`medium`'), `${id}: missing reasoning effort`);
    assert.ok(row.includes('0회'), `${id}: missing human-intervention count`);
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.ok(cells[5], `${id}: missing fixture value`);
    assert.ok(row.includes(prompt), `${id}: fixed prompt changed`);
    assert.ok(row.includes('완료 조건:'), `${id}: missing completion condition`);
  }
});

test('both instruction-cost baseline tables are complete and traceable', () => {
  const contextCost = fs.readFileSync(DOC, 'utf8');
  const history = fs.readFileSync(HISTORY, 'utf8');
  const contextRows = tableRows(contextCost, '## Baseline', BASELINE_COLUMNS);
  const historyRows = tableRows(history, '## 지시문 비용 회차', BASELINE_COLUMNS);

  for (const [name, rows] of [['context-cost', contextRows], ['history', historyRows]]) {
    assert.strictEqual(rows.length, IDS.length, `${name}: expected seven baseline rows`);
    for (const id of IDS) {
      const row = rows.find((line) => line.includes('`' + id + '`'));
      assert.ok(row, `${name}: missing baseline row ${id}`);
      const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
      assert.ok(cells[1], `${name}: ${id} has no measurement date`);
      assert.ok(cells.at(-1), `${name}: ${id} has no artifact path`);
    }
  }
});
