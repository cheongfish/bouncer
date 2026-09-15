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

// 재디스패치 상한(**1**)은 execute/debugging/debugger 정본이 소유한다. run은
// 그 절차를 /bouncer-execute에 위임하므로 두 번째 상한 정본이 되지 않는다.
test('debugger redispatch cap is **1** in canonical execute and debugger sources', () => {
  // execute는 "at most"와 "**1**"을 줄바꿈으로 나눈다 — \s+로 줄바꿈도 허용.
  const CAP = /at most\s+\*\*1\*\*|allows\s+\*\*1\*\*/;
  const sources = [
    ['bouncer-execute workflow bundle', readWorkflowBundle('bouncer-execute')],
    ['references/debugging/index.md', read('references/debugging/index.md')],
    ['agents/bouncer-debugger.md', read('agents/bouncer-debugger.md')],
  ];
  for (const [rel, md] of sources) {
    assert.match(md, CAP, rel);
    assert.doesNotMatch(md, /at most \*\*3\*\*/, rel);
  }
});

test('run delegates debugger dispatch to execute without loading debugging/index.md', () => {
  const run = read('skills/bouncer-run/SKILL.md');
  assert.doesNotMatch(run, /references\/debugging\/index\.md/);
  assert.match(run, /\/bouncer-execute/ );
  assert.doesNotMatch(run, /at most\s+\*\*1\*\* debugger recovery/);
});
