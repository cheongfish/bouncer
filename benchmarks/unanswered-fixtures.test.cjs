'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { writeUnansweredFixtures } = require('./unanswered-fixtures.cjs');

function withDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'unanswered-'));
  try { fn(dir); } finally { rmSync(dir, { recursive: true }); }
}

test('텍스트 항목 둘 → 01.md·02.md와 cases.json 두 항목(reply null, gates [])', () => {
  withDir((dir) => {
    const written = writeUnansweredFixtures(dir, { source: 'runs/x/02-plan', phase: 'bouncer-plan', unanswered: [
      { at: 't1', method: 'text/AskUserQuestion', text: 'first question' },
      { at: 't2', method: 'text/Quiz', text: 'second question' },
    ] });
    assert.equal(written.length, 3);
    assert.equal(readFileSync(path.join(dir, 'unanswered', '01.md'), 'utf8'), 'first question');
    assert.equal(readFileSync(path.join(dir, 'unanswered', '02.md'), 'utf8'), 'second question');
    const cases = JSON.parse(readFileSync(path.join(dir, 'unanswered', 'cases.json'), 'utf8'));
    assert.deepEqual(cases, [
      { file: '01.md', source: 'runs/x/02-plan', phase: 'bouncer-plan', workdir: {}, reply: null, gates: [], expect: null,
        method: 'text/AskUserQuestion' },
      { file: '02.md', source: 'runs/x/02-plan', phase: 'bouncer-plan', workdir: {}, reply: null, gates: [], expect: null,
        method: 'text/Quiz' },
    ]);
  });
});

test('host params 항목만 → 파일 없음', () => {
  withDir((dir) => {
    const written = writeUnansweredFixtures(dir, { source: 's', phase: 'p', unanswered: [
      { at: 't', method: 'cursor/ask_question', params: { questions: [] } },
    ] });
    assert.deepEqual(written, []);
    assert.equal(existsSync(path.join(dir, 'unanswered')), false);
  });
});

test('빈 unanswered → 파일 없음', () => {
  withDir((dir) => {
    assert.deepEqual(writeUnansweredFixtures(dir, { source: 's', phase: 'p', unanswered: [] }), []);
    assert.equal(existsSync(path.join(dir, 'unanswered')), false);
  });
});

test('host 항목이 섞임 → 번호는 unanswered 배열 순서를 따른다', () => {
  withDir((dir) => {
    writeUnansweredFixtures(dir, { source: 's', phase: 'p', unanswered: [
      { method: 'cursor/ask_question', params: {} }, { method: 'text/Quiz', text: 'q' },
    ] });
    assert.ok(existsSync(path.join(dir, 'unanswered', '02.md')));
    assert.equal(existsSync(path.join(dir, 'unanswered', '01.md')), false);
  });
});
