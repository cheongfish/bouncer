'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill, readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('debugging has valid frontmatter identity', () => {
  const md = readSkill('debugging');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*debugging/);
  assert.strictEqual(data.name, 'debugging');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('debugging names the four stages Root cause → Pattern → Hypothesis → Implementation', () => {
  const md = readSkill('debugging');
  assert.match(md, /Root cause/i);
  assert.match(md, /Pattern/i);
  assert.match(md, /Hypothesis/i);
  assert.match(md, /Implementation/i);
});

test('debugging hands the report to implementer via controller re-dispatch', () => {
  const md = readSkill('debugging');
  assert.match(md, /re-dispatches `bouncer-implementer`/);
  assert.match(md, /evidence/);
});

test('debugging escalates after 1 unsuccessful cycle', () => {
  const md = readSkill('debugging');
  assert.match(md, /1(?:\*\*)?\s*(?:failures?|times?|attempts?)[\s\S]{0,120}escalat/i);
});

// execute / debugging / debugger / run이 같은 verify 실패 재디스패치 상한(**1**)을
// 공유해야 한다. 문서마다 숫자가 갈리면 수동 경로와 /bouncer-run 자동 주행이
// 다른 루프 비용을 갖게 된다. 에이전트 문서는 영어 — at most / allows **1**.
test('debugger redispatch cap is **1** across execute, debugging, agent, and run', () => {
  // execute는 "at most"와 "**1**"을 줄바꿈으로 나눈다 — \s+로 줄바꿈도 허용.
  // run은 "allows **1** fix retry" 형태.
  const CAP = /at most\s+\*\*1\*\*|allows\s+\*\*1\*\*/;
  const sources = [
    ['bouncer-execute workflow bundle', readWorkflowBundle('bouncer-execute')],
    ['references/debugging/index.md', read('references/debugging/index.md')],
    ['agents/bouncer-debugger.md', read('agents/bouncer-debugger.md')],
    ['skills/bouncer-run/SKILL.md', read('skills/bouncer-run/SKILL.md')],
  ];
  for (const [rel, md] of sources) {
    assert.match(md, CAP, rel);
    assert.doesNotMatch(md, /at most \*\*3\*\*/, rel);
  }
});
