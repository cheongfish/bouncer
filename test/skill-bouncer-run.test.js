'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const md = fs.readFileSync(path.join(__dirname, '..', 'skills/bouncer-run/SKILL.md'), 'utf8');

test('run requires start ACQ before execute then commit', () => {
  const start = md.indexOf('2. **Start ACQ.**');
  const loop = md.indexOf('3. **Loop unit.**');
  assert.ok(start >= 0 && start < loop);
  assert.ok(md.indexOf('/bouncer-execute', loop) < md.indexOf('/bouncer-commit', loop));
});
test('run preserves pointer, execute recovery ceilings, and scope boundaries', () => {
  assert.match(md, /current --set/);
  const ceilings = md.match(/4\. \*\*Verify · review ceilings\.\*\*([\s\S]*?)(?=\n5\. \*\*`interactive` boundary)/)?.[1] || '';
  assert.match(ceilings, /at most \*\*1\*\* debugger recovery/);
  assert.match(ceilings, /\/bouncer-execute/);
  assert.match(ceilings, /conditional/);
  assert.doesNotMatch(ceilings, /round <= 2/);
  assert.match(ceilings, /\/bouncer-plan/);
  assert.match(md, /Scope violations stop/);
  assert.match(md, /never flip findings/);
});
test('run stop preserves failure and gives actionable recovery', () => {
  const stop = md.match(/6\. \*\*Stop\.\*\*([\s\S]*?)(?=\n7\. \*\*Exit)/)?.[1] || '';
  assert.match(stop, /preserve the failing pointer and worktree/);
  assert.match(stop, /validator\s+code, cause, path, and recovery action/);
  assert.match(stop, /resume[\s\S]{0,100}\/bouncer-execute/);
  assert.doesNotMatch(md, /stop-recovery\.md/);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'skills/bouncer-run/references/stop-recovery.md')));
});
