'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const md = fs.readFileSync(path.join(__dirname, '..', 'skills/bouncer-run/SKILL.md'), 'utf8');

test('run shows the blueprint DAG before the start ACQ', () => {
  const start = md.indexOf('2. **Start ACQ.**');
  assert.ok(start > 0);
  const preflight = md.slice(md.indexOf('1. **Preflight.**'), start);
  assert.match(preflight, /\bbouncer\s+current\b/);
  assert.match(preflight, /affected_paths/);
  const acq = md.slice(start, md.indexOf('3. **Integration bootstrap.**'));
  assert.match(acq, /depends_on/);
  assert.match(acq, /DAG/);
  assert.match(acq, /Start drive \(Recommended\)/);
  assert.match(acq, /Stop unless A/);
});

// 위임은 정확히 한 번이다. 루프가 남아 있으면 root run이 다시 controller가 된다.
test('run dispatches exactly one coordinator after start approval', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(delegation, /named `bouncer-coordinator`/);
  assert.match(delegation, /exactly once/);
  assert.match(delegation, /rules\/subagent-model\.md/);
  // named agent가 없는 host의 generic fallback도 같은 brief와 worktree guard를 받는다.
  assert.match(delegation, /named agents are unavailable/i);
  assert.match(delegation, /same[\s\S]{0,80}(?:role brief|coordinator brief)/i);
  assert.doesNotMatch(md, /repeat `\/bouncer-execute` then `\/bouncer-commit` until/);
});

test('run bootstraps integration before delegating and never hands over the main worktree', () => {
  const bootstrap = md.match(/3\. \*\*Integration bootstrap\.\*\*([\s\S]*?)(?=\n4\. \*\*)/)?.[1] || '';
  assert.match(bootstrap, /coordinate bootstrap/);
  assert.match(bootstrap, /integrationPath/);
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(delegation, /write cwd/i);
  assert.match(delegation, /read-only provenance/i);
  assert.match(
    delegation,
    /(?:never|do not|refuse)[\s\S]{0,120}main worktree|main worktree[\s\S]{0,120}(?:never|refuse)/i,
  );
});

test('run stays non-editing and does not re-judge worker reports', () => {
  const role = md.match(/## Role — delegation([\s\S]*?)(?=\n## |\n1\. )/)?.[1] || '';
  assert.ok(role.length > 0, 'run must keep a delegation role section');
  assert.match(role, /does not read and fix code directly/);
  assert.match(role, /(?:does not|never)[\s\S]{0,80}reconstruct[\s\S]{0,60}worker/i);
  assert.match(role, /at most \*\*1\*\* debugger recovery/);
  assert.match(role, /\/bouncer-execute/);
  // scope drift는 정지가 아니라 기록이다. run은 그 기록을 렌더링만 한다.
  assert.match(role, /bouncer coordinate\s*\n?\s*revise/);
  assert.match(role, /one revision/);
  assert.match(role, /instead of re-judging it/);
  assert.doesNotMatch(role, /stop that task/);
  assert.doesNotMatch(md, /do not widen\s*\n?\s*`affected_paths`/);
  assert.match(role, /bouncer current --set/);
});

// finalize의 동의는 어느 경로에서도 사용자 것이다. 두 경로가 다른 주인을
// 말하면 위임받은 쪽이 사용자 대신 동의를 처리한다.
test('run keeps finalize consent with the user on both paths', () => {
  const preflight = md.slice(md.indexOf('1. **Preflight.**'), md.indexOf('2. **Start ACQ.**'));
  assert.match(preflight, /nothing to delegate/);
  assert.match(preflight, /run `\/bouncer-finalize` themselves/);
  assert.match(preflight, /consent\s*\n?\s*steps stay with the user on both paths/);
  const report = md.slice(md.indexOf('5. **Report.**'));
  assert.match(report, /consent step it\s*\n?\s*stopped at/);
  assert.match(report, /tell the user to run `\/bouncer-finalize`/);
});

test('run payload names the closing action and autonomy effect', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(delegation, /closing action[\s\S]{0,160}\/bouncer-finalize/);
  assert.match(delegation, /only as far as it\s*\n?\s*goes without user consent/);
  assert.match(delegation, /stops at the first one it reaches/);
  assert.match(delegation, /reporting cadence/);
  assert.match(delegation, /`interactive` returns a progress line/);
  // start ACQ는 interactive가 이제 무엇을 뜻하는지 사용자에게 말해야 한다.
  const acq = md.slice(md.indexOf('2. **Start ACQ.**'), md.indexOf('3. **Integration bootstrap.**'));
  assert.match(acq, /`interactive`[\s\S]{0,120}progress is reported/);
});

test('run renders progress, blocked, and completed outcomes through the shared contract', () => {
  const report = md.slice(md.indexOf('5. **Report.**'));
  assert.match(report, /rules\/output\.md/);
  assert.match(report, /progress/i);
  assert.match(report, /blocked/i);
  assert.match(report, /draft PR|PR/);
  assert.match(report, /preserve[\s\S]{0,80}(?:ledger|worktree)/i);
  assert.doesNotMatch(md, /stop-recovery\.md/);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'skills/bouncer-run/references/stop-recovery.md')));
});

test('run keeps start ACQ, autonomy, and no per-task ACQ without preamble helpers', () => {
  const preamble = md.slice(0, md.search(/^1\. /m));
  assert.doesNotMatch(preamble, /references\/debugging\/index\.md/);
  assert.doesNotMatch(preamble, /\.\/references\//);
  assert.match(md, /2\. \*\*Start ACQ\.\*\*/);
  assert.match(md, /autonomy/);
  // start 승인 뒤 task별 scope·계획 ACQ는 coordinator mode에서 요구하지 않는다.
  assert.match(md, /no further ACQ|does not ask again|no per-task ACQ/i);
});
