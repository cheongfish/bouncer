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
  assert.match(preflight, /\bbouncer\s+run\s+preflight\b/);
  assert.match(preflight, /affected_paths/);
  const acq = md.slice(start, md.indexOf('3. **Integration bootstrap.**'));
  assert.match(acq, /depends_on/);
  assert.match(acq, /DAG/);
  assert.match(acq, /Start drive \(Recommended\)/);
  assert.match(acq, /Stop unless A/);
});

// 한 세션에 coordinator 하나. continue면 진전을 확인한 뒤 새 세션을 띄운다.
test('run dispatches one coordinator at a time after start approval', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'), md.indexOf('5. **Report.**'));
  assert.match(delegation, /named `bouncer-coordinator`/);
  assert.match(delegation, /rules\/subagent-model\.md/);
  // named 디스패치가 역할 문서를 이미 로드한다. step 4가 다시 Read하라고
  // 시키면 coordinator가 같은 본문을 세션에 한 번 더 넣는다.
  assert.doesNotMatch(md, /read `agents\/bouncer-coordinator\.md`/i);
  // named agent가 없는 host의 generic fallback도 같은 brief와 worktree guard를 받는다.
  assert.match(delegation, /named agents are unavailable/i);
  assert.match(delegation, /same[\s\S]{0,80}(?:role brief|coordinator brief)/i);
  assert.doesNotMatch(md, /repeat `\/bouncer-execute` then `\/bouncer-commit` until/);
  assert.match(delegation, /one (?:coordinator )?at a time/i);
  assert.match(delegation, /`continue`[\s\S]{0,300}coordinate status/);
  assert.match(delegation, /completed_tasks[\s\S]{0,200}(?:grew|increased|did not grow|unchanged)/i);
  assert.match(delegation, /(?:did not grow|unchanged)[\s\S]{0,200}no-progress|no-progress[\s\S]{0,200}(?:did not grow|unchanged)/i);
  assert.match(delegation, /`completed`[\s\S]{0,80}`blocked`[\s\S]{0,80}`partial_closed`[\s\S]{0,200}stop/i);
  assert.doesNotMatch(md, /exactly once|happens once|in one flow/);
  // F1: continue 재디스패치도 새 coordinator를 foreground에서 기다리고,
  // 같은 continue / no-progress / terminal-stop 규칙을 한 번에 하나 루프로 적용한다.
  assert.match(delegation, /dispatch a new coordinator[\s\S]{0,400}[Ww]ait in the foreground/);
  assert.match(
    delegation,
    /same continue \/ no-progress \/ terminal-stop rules again \(a\s+loop, one at a time\)/,
  );
  assert.match(delegation, /Do not go to step 5 while a coordinator runs/);
  // F2: 비교 기준은 첫 payload snapshot이 아니라 이번 디스패치 직전 값이다.
  assert.match(delegation, /immediately before this dispatch/);
  assert.match(delegation, /baseline each session/i);
  assert.match(delegation, /Do not compare later continues only against the first payload snapshot/);
  // F3: no-progress 중단은 5단계가 아니라 4단계에서 output.md blueprint 줄을 낸다.
  assert.match(delegation, /not step 5/);
  assert.match(delegation, /중단: <blueprint> · no-progress/);
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
  assert.match(role, /agents\/bouncer-coordinator\.md/);
  assert.doesNotMatch(role, /at most \*\*1\*\* debugger recovery/);
  assert.doesNotMatch(role, /discovery wave 1회[\s\S]{0,100}delta certification 1회/);
  assert.match(role, /\/bouncer-execute/);
  // scope drift의 기록 절차는 coordinator 정본이 소유한다.
  assert.doesNotMatch(role, /bouncer coordinate\s*\n?\s*revise/);
  assert.doesNotMatch(role, /stop that task/);
  assert.doesNotMatch(md, /do not widen\s*\n?\s*`affected_paths`/);
  assert.doesNotMatch(role, /bouncer current --set/);
  // 최종 리뷰 시점은 coordinator가 연다. verification node 예외와 같은 Role 절에 둔다.
  assert.match(role, /review_scope/);
  assert.match(role, /final review|최종 리뷰/i);
});

test('run defers coordinator procedure to the canonical agent doc and output contract', () => {
  const coordinator = fs.readFileSync(
    path.join(__dirname, '..', 'agents/bouncer-coordinator.md'),
    'utf8',
  );
  assert.match(md, /agents\/bouncer-coordinator\.md/);
  assert.doesNotMatch(md, /rules\/governance\.md/);
  assert.match(coordinator, /bouncer-implementer|worker/i);
  assert.match(md, /rules\/cli\.md/);
  assert.match(md, /rules\/current-pointer\.md/);
  assert.match(md, /rules\/subagent-model\.md/);
  assert.match(md, /rules\/output\.md/);
});

// finalize의 동의는 어느 경로에서도 사용자 것이다. run과 coordinator가
// finalize를 실행하면 사용자가 integration worktree에서 다시 도는 중복이 생긴다.
test('run keeps finalize consent with the user on both paths', () => {
  const preflight = md.slice(md.indexOf('1. **Preflight.**'), md.indexOf('2. **Start ACQ.**'));
  assert.match(preflight, /nothing to delegate/);
  assert.match(preflight, /run `\/bouncer-finalize` themselves/);
  assert.doesNotMatch(md, /closing action/);
  const report = md.slice(md.indexOf('5. **Report.**'));
  assert.match(report, /tell the user to run `\/bouncer-finalize`/);
  assert.match(report, /`\/bouncer-finalize`[^.]*`integrationPath`/);
});

test('run payload names the autonomy effect', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(delegation, /reporting cadence/);
  assert.match(delegation, /`interactive` returns a progress line/);
  // start ACQ는 interactive가 이제 무엇을 뜻하는지 사용자에게 말해야 한다.
  const acq = md.slice(md.indexOf('2. **Start ACQ.**'), md.indexOf('3. **Integration bootstrap.**'));
  assert.match(acq, /`interactive`[\s\S]{0,120}progress is reported/);
});

// 완료 줄의 다음은 멈춘 동의 단계가 아니라 사용자가 실행할 finalize다.
test('run completion line points at /bouncer-finalize in the integration worktree', () => {
  assert.match(
    fs.readFileSync(path.join(__dirname, '..', 'rules/output.md'), 'utf8'),
    /다음: \/bouncer-finalize \(<integrationPath>\)/,
  );
});

// coordinator 진입 payload는 compact checkpoint·ledger ref만 싣는다. 완료 task
// 원문이나 전체 원장을 다시 넣으면 runtime compaction 절감이 성립하지 않는다.
test('run hands the coordinator a status checkpoint and ledger hash without completed details', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(delegation, /coordinate status|checkpoint/i);
  assert.match(delegation, /checkpoint\.ledger\.(?:path|sha256)|ledger:\s*\{\s*path\s*,\s*sha256/i);
  assert.match(
    delegation,
    /(?:do not|never|without)[\s\S]{0,160}(?:full ledger|entire ledger|completed task|prior[\s\S]{0,20}report|past conversation)/i,
  );
  // 옛 계약: ledger 경로만 넘기고 hash/checkpoint 소비를 말하지 않던 문구는 제거한다.
  assert.doesNotMatch(
    delegation,
    /integration-local ledger path\s*\n?\s*`\.bouncer\/runtime\/coordinator\.json`(?![\s\S]{0,200}sha256)/,
  );
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

test('run caps repair at two waves and renders partial-close handoff without success', () => {
  assert.match(md, /최대 두 repair wave/);
  assert.match(md, /세 번째 wave를 만들지 않고/);
  assert.match(md, /coordinate partial-close --user-confirmed/);
  assert.match(md, /NEXT_PLAN\.md를 확인하고 후속 계획 진행 여부를 승인해 주세요\./);
  assert.match(md, /성공이나 `closed`로 표시하지 않는다/);
});

// attempt metadata는 delegated coordinator 소유다. root run이 자체 생성하면
// controller 경계가 중복된다.
test('run leaves dispatch attempt metadata ownership with the delegated coordinator', () => {
  const coordinator = fs.readFileSync(
    path.join(__dirname, '..', 'agents/bouncer-coordinator.md'),
    'utf8',
  );
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(coordinator, /coordinate dispatch/);
  assert.match(coordinator, /\battempt\b/);
  assert.match(coordinator, /previous_outcome/);
  // root run skill은 attempt/previous_outcome을 자체 만들지 않는다.
  assert.doesNotMatch(delegation, /coordinate dispatch/);
  assert.doesNotMatch(md, /previous_outcome/);
  assert.doesNotMatch(md, /initial_worktree_state/);
  assert.doesNotMatch(md, /base_head/);
});

// Cursor fallback Task가 background로 떠서 root가 "drive started"만 남기고 끝난 벤치마크 회귀.
test('run waits in the foreground for the coordinator outcome', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'), md.indexOf('5. **Report.**'));
  assert.match(delegation, /foreground[\s\S]{0,40}rules\/subagent-model\.md` item 6/);
  assert.match(delegation, /background handle[\s\S]{0,80}is not that outcome/);
  assert.match(delegation, /never end the turn[\s\S]{0,40}while the coordinator still runs/);
});

// Cursor에서 coordinator를 Task로 띄우면 토큰이 남지 않는다 — opt-in 시 print 프로세스로 띄운다.
test('run dispatches the coordinator as a print process under the Cursor opt-in', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'), md.indexOf('5. **Report.**'));
  assert.match(delegation, /item 7 opt-in \(Cursor `subagents\.dispatch:\s+"print"`\), the coordinator is a `bouncer dispatch print --role coordinator`\s+process per `\$\{BOUNCER_ROOT\}\/rules\/cursor-print-dispatch\.md`/);
});

test('run step 4 builds the coordinator payload file with coordinate status --write-input', () => {
  const delegation = md.slice(md.indexOf('4. **Coordinator dispatch.**'));
  assert.match(delegation, /coordinate status --blueprint .* --write-input/);
});
