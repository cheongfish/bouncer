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

test('debugging consumes all six debugger report fields', () => {
  const md = read('references/debugging/index.md');
  for (const field of [
    'Reproduction', 'Evidence', 'Single hypothesis', 'Minimum fix proposal',
    'Required regression test', 'Scope/task impact',
  ]) assert.match(md, new RegExp(field));
});

// 이전 blocker: fallback debugger가 "inline or generic read-only"라는 요약만 받아
// cwd·read-only 경계와 Procedure gate 없이 진단했다. fallback 문단이 역할 문서
// 전체와 할당된 read-only cwd를 직접 싣는지 본다.
// named dispatch 문장도 같은 cwd를 적으므로 fallback 문장부터만 본다.
test('debugger fallback keeps the assigned read-only cwd and the whole role document', () => {
  const recovery = read('skills/bouncer-execute/references/verification-recovery.md');
  const paragraph = recovery.slice(recovery.search(/When\s+named\s+agents\s+are\s+unavailable/));
  const fallback = paragraph.slice(0, paragraph.indexOf('\n\n'));
  assert.match(fallback, /failing\s+verify\s+evidence/);
  assert.match(fallback, /assigned\s+read-only\s+cwd/);
  assert.match(fallback, /entire\s+body\s+of\s+`agents\/bouncer-debugger\.md`/);
  assert.match(fallback, /generic\s+read-only\s+subagent/);
  assert.match(fallback, /`debugging`\s+inline[\s\S]{0,120}first\s+reads\s+`agents\/bouncer-debugger\.md`/);
});

test('debugging escalates after 1 unsuccessful cycle', () => {
  const md = readSkill('debugging');
  assert.match(md, /1(?:\*\*)?\s*(?:failures?|times?|attempts?)[\s\S]{0,120}escalat/i);
});

// verify 실패 재디스패치 상한(**1**)은 execute/debugging 정본이 소유한다. run은 그
// 절차를 /bouncer-execute에 위임하고, debugger 역할 문서는 controller가 소유한
// 상한을 다시 적지 않는다 — 두 곳에 있으면 어느 쪽이 이기는지 갈린다.
test('debugger recovery cap is owned by canonical execute and debugging sources', () => {
  // execute는 "at most"와 "**1**"을 줄바꿈으로 나눈다 — \s+로 줄바꿈도 허용.
  const CAP = /at most\s+\*\*1\*\*|allows\s+\*\*1\*\*/;
  const sources = [
    ['bouncer-execute workflow bundle', readWorkflowBundle('bouncer-execute')],
    ['references/debugging/index.md', read('references/debugging/index.md')],
  ];
  for (const [rel, md] of sources) {
    assert.match(md, CAP, rel);
    assert.doesNotMatch(md, /at most \*\*3\*\*/, rel);
  }
  assert.doesNotMatch(read('agents/bouncer-debugger.md'), CAP);
});

test('run delegates debugger dispatch to execute without loading debugging/index.md', () => {
  const run = read('skills/bouncer-run/SKILL.md');
  assert.doesNotMatch(run, /references\/debugging\/index\.md/);
  assert.match(run, /\/bouncer-execute/ );
  assert.doesNotMatch(run, /at most\s+\*\*1\*\* debugger recovery/);
});
