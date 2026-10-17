'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runCli } = require('../scripts/lib/cli');
const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { computePlanSnapshot, computePlanParts } = require('../scripts/lib/plan-snapshot');
const { validateBlueprint } = require('../scripts/lib/validate');
const crState = require('../scripts/lib/context-review-state');
const { readDoc } = require('../scripts/lib/frontmatter');
const { findingFingerprint } = require('../scripts/lib/validate-sections');

const TS = '2026-07-01T00:00:00+09:00';
const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

// 닫는 명령은 기록 전에 G18과 같은 형식 검증을 하므로 finding은 fingerprint를 갖춰야 한다.
const withFingerprint = (f) => ({ ...f, fingerprint: findingFingerprint(f, 'context') });
const MUST_FIX = withFingerprint({
  id: 'CR-1',
  severity: 'major',
  status: 'open',
  category: 'combined',
  brief_clause: 'tasks/001 Interface',
  file: 'scripts/lib/x.js',
  symbol: 'f',
  actionability: 'must_fix',
  origin: 'discovery',
  first_seen_round: 1,
  last_seen_round: 1,
});
const ADVISORY = withFingerprint({
  ...MUST_FIX,
  id: 'CR-2',
  severity: 'minor',
  actionability: 'advisory',
  symbol: 'g',
});

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf, json: buf.out.trim().startsWith('{') ? JSON.parse(buf.out) : null };
}

/** 계획 문서가 있는 임시 repo를 만든다. */
function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cr-state-'));
  scaffoldEpic({
    repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS, description: 'Auth epic description',
  });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  return repo;
}

function writeJson(repo, name, value) {
  const file = path.join(repo, name);
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  return file;
}

/** 현재 snapshot과 일치하는 review-dispatch plan 형태의 payload 파일을 쓴다. */
function dispatchFile(repo, name = 'dispatch.json', overrides = {}) {
  const snap = computePlanSnapshot({ repoRoot: repo, blueprintDir: BP });
  // 실제 review-dispatch plan 출력처럼 parts·scope_parts를 싣는다(loadDispatch가 재계산 대조한다).
  const partSnap = computePlanParts({ repoRoot: repo, blueprintDir: BP });
  return writeJson(repo, name, {
    ok: true,
    phase: 'plan',
    target: { digest: snap.digest, documents: snap.documents },
    strategy: 'single',
    snapshot_version: 2,
    parts: partSnap.parts,
    scope_parts: partSnap.scope_parts,
    structure_parts: partSnap.structure_parts,
    documents_content: partSnap.documents_content,
    ...overrides,
  });
}

function roundFile(repo, name, round, mode, findings, repoDigest) {
  const snap = computePlanSnapshot({ repoRoot: repo, blueprintDir: BP });
  const digest = repoDigest || snap.digest;
  return writeJson(repo, name, {
    round: {
      round,
      mode,
      target: { digest },
      perspectives: [{ name: 'combined', target_digest: digest }],
      severity_changes: [],
    },
    findings,
  });
}

const base = (repo) => ['--repo', repo, '--blueprint', BP];
const start = (repo, dispatch) => capture(['context-review', 'start', ...base(repo), '--dispatch', dispatch]);
const record = (repo, dispatch, round, extra = []) => capture([
  'context-review', 'record', ...base(repo), '--dispatch', dispatch, '--round', round, ...extra,
]);
const restart = (repo, dispatch, reason = 'documents rewritten') => capture([
  'context-review', 'restart', ...base(repo), '--dispatch', dispatch, '--reason', reason,
]);
const close = (repo, dispositions, extra = []) => capture([
  'context-review', 'close', ...base(repo), '--dispositions', dispositions, ...extra,
]);

/** runtime 아래의 state.json 경로를 찾는다. 위치 자체는 계약이 아니다. */
function findState(repo) {
  const root = path.join(repo, '.bouncer', 'runtime', 'context-review');
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (ent.name === 'state.json') return abs;
    }
  }
  return null;
}

function changeDocs(repo) {
  fs.appendFileSync(path.join(repo, BP, 'index.md'), '\nchanged plan text\n');
}

// scope_parts는 task의 Interface·Touch를 담으므로 계약 변경 fixture에는 task 문서가 필요하다.
function writeTask(repo, interfaceText = '- `fnA`\n') {
  const yaml = require('js-yaml');
  const rel = `${BP}/tasks/001/tasks.md`;
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const data = {
    type: 'bouncer.tasks',
    title: 'Task 001',
    description: 'd',
    resource: rel,
    tags: ['bouncer'],
    timestamp: TS,
    bouncer: {
      id: 'TASKS-001',
      epic_id: '001',
      blueprint_id: '001',
      status: 'ready',
      execution_kind: 'commit',
      affected_paths: ['src/a.ts'],
      depends_on: [],
      parallel_safe: false,
      dependency_gate: 'integrated',
    },
  };
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n## Interface\n${interfaceText}\n## Touch\n- \`src/a.ts\`\n`);
}

// 구조 변경: blueprint index의 review_scope를 지워 structure_parts를 바꾼다.
function changeStructure(repo) {
  const abs = path.join(repo, BP, 'index.md');
  fs.writeFileSync(abs, fs.readFileSync(abs, 'utf8').replace('  review_scope: blueprint\n', ''));
}

const HEX64 = /^[0-9a-f]{64}$/;
const readClosureState = (repo) => JSON.parse(fs.readFileSync(findState(repo), 'utf8')).closure;
const readFrontDigest = (repo) => readDoc(path.join(repo, BP, 'context-review.md'))
  .data.bouncer.context_review.closure_target_digest;

test('정상 fixture에서 start → exit 0과 cycle id를 반환하고 같은 start 재호출은 id와 횟수를 유지한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  const first = start(repo, d);
  assert.equal(first.code, 0, first.out + first.err);
  assert.equal(typeof first.json.cycle.id, 'string');
  assert.equal(first.json.cycle.restart_count, 0);
  const again = start(repo, d);
  assert.equal(again.code, 0);
  assert.equal(again.json.cycle.id, first.json.cycle.id);
  assert.equal(again.json.cycle.restart_count, 0);
});

test('start → record → restart → 두 번째 restart는 한도 소진으로 거부되고 이전 finding을 보관한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const r1 = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX, ADVISORY]));
  assert.equal(r1.code, 0, r1.out + r1.err);
  changeDocs(repo);
  const d2 = dispatchFile(repo, 'dispatch2.json');
  const first = restart(repo, d2);
  assert.equal(first.code, 0, first.out + first.err);
  assert.equal(first.json.cycle.restart_count, 1);
  assert.deepEqual(first.json.cycle.active_reports, []);
  const archived = first.json.cycle.history[0];
  assert.deepEqual(archived.findings, [MUST_FIX, ADVISORY]);
  assert.equal(archived.reason, 'documents rewritten');
  assert.equal(archived.restart_index, 1);

  // 재시작 뒤 다른 snapshot으로 두 번째 restart를 시도한다.
  changeDocs(repo);
  const d3 = dispatchFile(repo, 'dispatch3.json');
  const beforeRejectedBytes = fs.readFileSync(findState(repo));
  const second = restart(repo, d3);
  assert.equal(second.code, 1);
  assert.equal(second.json.reason, 'context-review-restart-limit');
  assert.equal(second.json.ok, false);
  assert.equal(typeof second.json.next, 'string');
  const afterRejectedBytes = fs.readFileSync(findState(repo));
  assert.deepEqual(afterRejectedBytes, beforeRejectedBytes);
  // 프로세스 reload에 해당하는 새 start 호출도 횟수 1을 유지한다.
  const reloaded = start(repo, dispatchFile(repo, 'dispatch4.json'));
  assert.equal(reloaded.json.cycle.restart_count, 1);
});

test('snapshot이 바뀌지 않은 restart → 상태 충돌로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const r = restart(repo, d);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
});

test('delta 뒤 미해결 must_fix가 남은 상태의 restart → 해결 안 된 finding으로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]));
  record(repo, d, roundFile(repo, 'r2.json', 2, 'delta', [MUST_FIX]));
  changeDocs(repo);
  const r = restart(repo, dispatchFile(repo, 'dispatch2.json'));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-unresolved-findings');
});

test('discovery open must_fix 저장 후 resolved closure → accepted로 닫히고 projection에 resolved만 남는다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const r1 = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]), ['--status', 'requested']);
  assert.equal(r1.code, 0, r1.out + r1.err);
  assert.equal(r1.json.cycle.active_reports.length, 1);
  const resolved = { ...MUST_FIX, status: 'resolved', last_seen_round: 2 };
  const r2 = record(repo, d, roundFile(repo, 'r2.json', 2, 'delta', [resolved]), ['--status', 'accepted']);
  assert.equal(r2.code, 0, r2.out + r2.err);
  assert.deepEqual(r2.json.projection.findings.map((f) => [f.id, f.status]), [['CR-1', 'resolved']]);
});

test('closure에서 open finding이 남으면 → unresolved-findings로 거부하고 파일을 유지한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const before = fs.readFileSync(findState(repo));
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]), ['--status', 'accepted']);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-unresolved-findings');
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('advisory accepted에 note가 있으면 → closure가 통과하고 note 없으면 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const noNote = { ...ADVISORY, status: 'accepted' };
  const bad = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [noNote]), ['--status', 'accepted']);
  assert.equal(bad.code, 1);
  assert.equal(bad.json.reason, 'context-review-unresolved-findings');
  const withNote = { ...noNote, note: 'wording only' };
  const ok = record(repo, d, roundFile(repo, 'r1b.json', 1, 'discovery', [withNote]), ['--status', 'accepted']);
  assert.equal(ok.code, 0, ok.out + ok.err);
});

test('delta 뒤 open must_fix cycle에 close --dispositions와 --accept-risk → exit 0으로 닫히고 projection에 accepted_risk가 표시된다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  const disp = writeJson(repo, 'dispositions.json', [
    { id: 'CR-1', status: 'accepted', note: 'user approved risk' },
  ]);
  const r = close(repo, disp, ['--accept-risk', 'CR-1']);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.status, 'accepted');
  assert.equal(r.json.closed, true);
  assert.equal(r.json.noop, false);
  const cr1 = r.json.projection.findings.find((f) => f.id === 'CR-1');
  assert.equal(cr1.status, 'accepted');
  assert.equal(cr1.accepted_risk, true);

  // 동일 전이 재호출 → noop: true
  const r2 = close(repo, disp, ['--accept-risk', 'CR-1']);
  assert.equal(r2.code, 0);
  assert.equal(r2.json.ok, true);
  assert.equal(r2.json.status, 'accepted');
  assert.equal(r2.json.noop, true);
});

test('round가 없는 cycle에 close → state-conflict로 거부되고 state는 변하지 않는다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const before = fs.readFileSync(findState(repo));
  const disp = writeJson(repo, 'dispositions.json', []);
  const r = close(repo, disp);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('이미 닫힌 cycle에 다른 dispositions로 close → state-conflict로 거부된다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [{ ...MUST_FIX, status: 'resolved' }]);
  const disp1 = writeJson(repo, 'disp1.json', [
    { id: 'CR-1', status: 'resolved' },
  ]);
  const ok = close(repo, disp1);
  assert.equal(ok.code, 0);
  const disp2 = writeJson(repo, 'disp2.json', [
    { id: 'CR-1', status: 'accepted', note: 'new note' },
  ]);
  const r = close(repo, disp2, ['--accept-risk', 'CR-1']);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
});

test('dispositions에 open이 남거나 note 없는 accepted 또는 accept-risk 불일치 → unresolved-findings로 거부된다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  const before = fs.readFileSync(findState(repo));

  // 1. 처분되지 않아 open 남음
  const dispOpen = writeJson(repo, 'disp-open.json', []);
  const r1 = close(repo, dispOpen);
  assert.equal(r1.code, 1);
  assert.equal(r1.json.reason, 'context-review-unresolved-findings');

  // 2. note 없음
  const dispNoNote = writeJson(repo, 'disp-nonote.json', [{ id: 'CR-1', status: 'accepted' }]);
  const r2 = close(repo, dispNoNote, ['--accept-risk', 'CR-1']);
  assert.equal(r2.code, 1);
  assert.equal(r2.json.reason, 'context-review-unresolved-findings');

  // 3. accept-risk 누락
  const dispNoRisk = writeJson(repo, 'disp-norisk.json', [{ id: 'CR-1', status: 'accepted', note: 'approved' }]);
  const r3 = close(repo, dispNoRisk);
  assert.equal(r3.code, 1);
  assert.equal(r3.json.reason, 'context-review-unresolved-findings');

  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('dispositions에 모르는 id 또는 중복 id 또는 status invalid → input-invalid로 거부된다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  const before = fs.readFileSync(findState(repo));

  const unknownId = writeJson(repo, 'disp-unknown.json', [{ id: 'CR-99', status: 'resolved' }]);
  const r1 = close(repo, unknownId);
  assert.equal(r1.code, 1);
  assert.equal(r1.json.reason, 'context-review-input-invalid');

  const dupId = writeJson(repo, 'disp-dup.json', [
    { id: 'CR-1', status: 'resolved' },
    { id: 'CR-1', status: 'accepted', note: 'dup' },
  ]);
  const r2 = close(repo, dupId);
  assert.equal(r2.code, 1);
  assert.equal(r2.json.reason, 'context-review-input-invalid');

  const badStatus = writeJson(repo, 'disp-badstatus.json', [{ id: 'CR-1', status: 'deferred' }]);
  const r3 = close(repo, badStatus);
  assert.equal(r3.code, 1);
  assert.equal(r3.json.reason, 'context-review-input-invalid');

  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('close 뒤 restart → projection 기준으로 통과하고 history에 closure가 보관된다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  const disp = writeJson(repo, 'disp.json', [
    { id: 'CR-1', status: 'accepted', note: 'user agreed' },
  ]);
  const closed = close(repo, disp, ['--accept-risk', 'CR-1']);
  assert.equal(closed.code, 0);

  // 문서 변경 뒤 restart
  changeDocs(repo);
  const d2 = dispatchFile(repo, 'd2.json');
  const rest = restart(repo, d2, 'plan updated after close');
  assert.equal(rest.code, 0, rest.out + rest.err);
  assert.equal(rest.json.ok, true);
  assert.equal(rest.json.cycle.restart_count, 1);
  const archived = rest.json.cycle.history[0];
  assert.ok(archived.closure, 'history contains closure');
  assert.deepEqual(archived.closure.accept_risk, ['CR-1']);
  assert.ok(typeof archived.closure.dispositions.sha256 === 'string');
  assert.match(archived.closure.closure_target_digest, HEX64);
  // 새 cycle은 closure 없이 시작한다: 이전 인증이 새 cycle로 새지 않는다.
  assert.equal(readClosureState(repo), undefined);
});

test('구조·계약이 같은 본문 수정 뒤 close → 현재 digest를 runtime closure와 frontmatter에 인증하고 route는 reuse를 가리킨다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [{ ...MUST_FIX, status: 'resolved' }]);
  changeDocs(repo); // 마지막 round 뒤 본문만 바뀜
  const d2 = dispatchFile(repo, 'd2.json');
  const current = JSON.parse(fs.readFileSync(d2, 'utf8')).target.digest;
  assert.equal(route(repo, d2, 'partial').next_action, 'close');
  const closed = close(repo, writeJson(repo, 'disp.json', []));
  assert.equal(closed.code, 0, closed.out + closed.err);
  assert.equal(readClosureState(repo).closure_target_digest, current);
  assert.equal(readFrontDigest(repo), current);
  assert.equal(route(repo, d2, 'partial').next_action, 'reuse');
});

test('close 뒤 본문을 또 고치면 → route는 close이고 재close가 새 digest로 갱신하며 같은 입력의 재실행은 no-op이다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  const disp = writeJson(repo, 'disp.json', [
    { id: 'CR-1', status: 'accepted', note: 'user agreed' },
  ]);
  assert.equal(close(repo, disp, ['--accept-risk', 'CR-1']).code, 0);
  const first = readFrontDigest(repo);
  // 같은 digest에서 같은 처분을 다시 닫으면 이미 반영된 전이라 no-op이다.
  assert.equal(close(repo, disp, ['--accept-risk', 'CR-1']).json.noop, true);
  // 다른 처분이라면 이미 닫힌 cycle이다.
  const other = writeJson(repo, 'other.json', [{ id: 'CR-1', status: 'accepted', note: 'different note' }]);
  const denied = close(repo, other, ['--accept-risk', 'CR-1']);
  assert.equal(denied.code, 1);
  assert.equal(denied.json.reason, 'context-review-state-conflict');

  changeDocs(repo);
  const d2 = dispatchFile(repo, 'd2.json');
  assert.equal(route(repo, d2, 'partial').next_action, 'close');
  const again = close(repo, disp, ['--accept-risk', 'CR-1']);
  assert.equal(again.code, 0, again.out + again.err);
  assert.equal(again.json.noop, false);
  const second = readFrontDigest(repo);
  assert.notEqual(second, first);
  assert.equal(second, JSON.parse(fs.readFileSync(d2, 'utf8')).target.digest);
  assert.equal(readClosureState(repo).closure_target_digest, second);
});

test('accepted record → runtime closure와 frontmatter에 같은 closure_target_digest를 기록한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const rf = roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]);
  const ok = record(repo, d, rf, ['--status', 'accepted']);
  assert.equal(ok.code, 0, ok.out + ok.err);
  const digest = JSON.parse(fs.readFileSync(d, 'utf8')).target.digest;
  assert.equal(readClosureState(repo).closure_target_digest, digest);
  assert.equal(readFrontDigest(repo), digest);
});

test('Interface·Touch를 바꾼 뒤 close → 계약이 baseline과 달라 거절하고 state는 그대로다', () => {
  const repo = makeRepo();
  writeTask(repo);
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]));
  writeTask(repo, '- `fnB`\n');
  const before = fs.readFileSync(findState(repo));
  const disp = writeJson(repo, 'disp.json', []);
  const denied = close(repo, disp);
  assert.equal(denied.code, 1);
  assert.equal(denied.json.reason, 'context-review-state-conflict');
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('구조를 바꾼 뒤 close → baseline과 달라 거절한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]));
  changeStructure(repo);
  const denied = close(repo, writeJson(repo, 'disp.json', []));
  assert.equal(denied.code, 1);
  assert.equal(denied.json.reason, 'context-review-state-conflict');
});

test('close CLI에 필수 --dispositions 누락 또는 허용 밖 플래그 → exit 2 사용법 오류이다', () => {
  const repo = makeRepo();
  const disp = writeJson(repo, 'disp.json', []);
  // 1. --dispositions 누락
  const r1 = capture(['context-review', 'close', ...base(repo)]);
  assert.equal(r1.code, 2);

  // 2. close에 --round 금지
  const r2 = capture(['context-review', 'close', ...base(repo), '--dispositions', disp, '--round', 'r.json']);
  assert.equal(r2.code, 2);

  // 3. close에 --status 금지
  const r3 = capture(['context-review', 'close', ...base(repo), '--dispositions', disp, '--status', 'accepted']);
  assert.equal(r3.code, 2);

  // 4. close에 --dispatch 금지
  const r4 = capture(['context-review', 'close', ...base(repo), '--dispositions', disp, '--dispatch', 'd.json']);
  assert.equal(r4.code, 2);
});

test('must_fix accepted는 --accept-risk 없이 → 거부하고 ID와 note가 맞으면 통과한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const risk = { ...MUST_FIX, status: 'accepted', note: 'user accepted the risk' };
  const rf = roundFile(repo, 'r1.json', 1, 'discovery', [risk]);
  const denied = record(repo, d, rf, ['--status', 'accepted']);
  assert.equal(denied.code, 1);
  assert.equal(denied.json.reason, 'context-review-unresolved-findings');
  const wrongId = record(repo, d, rf, ['--status', 'accepted', '--accept-risk', 'CR-9']);
  assert.equal(wrongId.code, 1);
  const ok = record(repo, d, rf, ['--status', 'accepted', '--accept-risk', 'CR-1']);
  assert.equal(ok.code, 0, ok.out + ok.err);
  const cr1 = ok.json.projection.findings.find((f) => f.id === 'CR-1');
  assert.equal(cr1.accepted_risk, true);
});

test('round 3을 첫 보고로 기록하면 → 순서 오류로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const r = record(repo, d, roundFile(repo, 'r3.json', 3, 'delta', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-round-order');
});

test('discovery 뒤 delta 다음의 세 번째 round → 순서 오류로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  record(repo, d, roundFile(repo, 'r2.json', 2, 'delta', [ADVISORY]));
  const r = record(repo, d, roundFile(repo, 'r3.json', 3, 'delta', [ADVISORY]));
  assert.equal(r.json.reason, 'context-review-round-order');
});

test('같은 record 재요청 → no-op이고 다른 내용의 같은 round는 상태 충돌이다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const rf = roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]);
  record(repo, d, rf);
  const before = fs.readFileSync(findState(repo));
  const same = record(repo, d, rf);
  assert.equal(same.code, 0);
  assert.equal(same.json.noop, true);
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
  const other = record(repo, d, roundFile(repo, 'r1x.json', 1, 'discovery', [ADVISORY]));
  assert.equal(other.code, 1);
  assert.equal(other.json.reason, 'context-review-state-conflict');
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('digest가 현재 snapshot과 다른 stale dispatch → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  changeDocs(repo);
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
});

test('round의 target digest가 dispatch와 다르면 → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY], 'f'.repeat(64)));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
});

test('strategy가 skip인 dispatch → start를 거부한다', () => {
  const repo = makeRepo();
  const r = start(repo, dispatchFile(repo, 'd.json', { strategy: 'skip' }));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
  assert.equal(findState(repo), null);
});

test('다른 blueprint를 가리키는 dispatch → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const r = start(repo, dispatchFile(repo, 'd.json', { blueprint: '.bouncer/context/epics/002-x/blueprints/001-y' }));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
});

test('closed blueprint → start를 거부한다', () => {
  const repo = makeRepo();
  const idx = path.join(repo, BP, 'index.md');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace(/status: \w+/, 'status: closed'));
  const r = start(repo, dispatchFile(repo));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
});

test('canonical이 아닌 blueprint 경로 → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const r = capture(['context-review', 'start', '--repo', repo, '--blueprint', '../outside', '--dispatch', dispatchFile(repo)]);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
});

test('runtime 디렉터리가 repo 밖을 가리키는 symlink이면 → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cr-outside-'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.symlinkSync(outside, path.join(repo, '.bouncer', 'runtime'));
  const r = start(repo, dispatchFile(repo));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('기존 context-review 증거가 있는 legacy start → 거부하고 restart가 archive로 가져온다', () => {
  const repo = makeRepo();
  const crPath = path.join(repo, BP, 'context-review.md');
  const snap = computePlanSnapshot({ repoRoot: repo, blueprintDir: BP });
  const doc = fs.readFileSync(crPath, 'utf8').replace(
    'findings: []',
    `rounds:\n    - round: 1\n      mode: discovery\n      target: { digest: ${snap.digest} }\n    findings:\n    - id: CR-1\n      severity: minor\n      status: resolved`,
  );
  fs.writeFileSync(crPath, doc);
  const denied = start(repo, dispatchFile(repo));
  assert.equal(denied.code, 1);
  assert.equal(denied.json.reason, 'context-review-legacy-evidence');
  changeDocs(repo);
  const imported = restart(repo, dispatchFile(repo, 'dispatch2.json'), 'legacy import');
  assert.equal(imported.code, 0, imported.out + imported.err);
  assert.equal(imported.json.cycle.restart_count, 1);
  assert.equal(imported.json.cycle.history[0].findings[0].id, 'CR-1');
  const again = restart(repo, dispatchFile(repo, 'dispatch2.json'), 'again');
  assert.equal(again.json.reason, 'context-review-restart-limit');
});

test('legacy 증거에 이전 digest가 없으면 → restart가 legacy-evidence와 안내로 거부한다', () => {
  const repo = makeRepo();
  const crPath = path.join(repo, BP, 'context-review.md');
  fs.writeFileSync(crPath, fs.readFileSync(crPath, 'utf8').replace(
    'findings: []',
    'findings:\n    - id: CR-1\n      severity: minor\n      status: resolved',
  ));
  changeDocs(repo);
  const r = restart(repo, dispatchFile(repo));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-legacy-evidence');
  assert.match(r.json.next, /previous/);
});

test('같은 namespace의 배타 잠금이 잡혀 있으면 → 상태 충돌로 거부하고 상태를 바꾸지 않는다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const statePath = findState(repo);
  fs.mkdirSync(path.join(path.dirname(statePath), 'lock'));
  const before = fs.readFileSync(statePath);
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
  assert.deepEqual(fs.readFileSync(statePath), before);
});

test('손상된 history → 모든 전이를 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const statePath = findState(repo);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.cycle.restart_count = 1; // history가 비어 있어 한도 기록과 모순된다.
  fs.writeFileSync(statePath, JSON.stringify(state));
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
});

test('start 없이 record → 상태 충돌로 거부한다', () => {
  const repo = makeRepo();
  const r = record(repo, dispatchFile(repo), roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
});

test('round JSON이 깨졌으면 → malformed로 거부하고 상태 파일을 유지한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const before = fs.readFileSync(findState(repo));
  const bad = path.join(repo, 'bad.json');
  fs.writeFileSync(bad, '{not json');
  const r = record(repo, d, bad);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-input-invalid');
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('record 전체 경로 → execute review.md 바이트를 바꾸지 않는다', () => {
  const repo = makeRepo();
  const reviewPath = path.join(repo, BP, 'review.md');
  const before = fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath) : null;
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  const after = fs.existsSync(reviewPath) ? fs.readFileSync(reviewPath) : null;
  assert.deepEqual(after, before);
});

test('필수 플래그가 없으면 → usage와 exit 2를 낸다', () => {
  for (const argv of [
    ['context-review'],
    ['context-review', 'start'],
    ['context-review', 'start', '--blueprint', BP],
    ['context-review', 'record', '--blueprint', BP, '--dispatch', 'd.json'],
    ['context-review', 'restart', '--blueprint', BP, '--dispatch', 'd.json'],
    ['context-review', 'bogus', '--blueprint', BP],
    ['context-review', 'record', '--blueprint', BP, '--dispatch', 'd', '--round', 'r', '--status', 'open'],
  ]) {
    const r = capture(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.match(r.err, /usage/);
  }
});

test('--help와 -h → stdout usage와 exit 0을 낸다', () => {
  for (const flag of ['--help', '-h']) {
    const r = capture(['context-review', flag]);
    assert.equal(r.code, 0);
    assert.ok(r.out.startsWith('usage: bouncer context-review'));
    assert.equal(r.err, '');
  }
});

// --- repair TASKS-003: restart 앵커·경로 검증·symlink·parts 재계산 -------------------

const crDoc = (repo) => readDoc(path.join(repo, BP, 'context-review.md'));
const marker = (repo) => crDoc(repo).data.bouncer.context_review.restart_count;

/** 한 번 restart한 repo를 만든다. */
function restartedRepo() {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  changeDocs(repo);
  const r = restart(repo, dispatchFile(repo, 'dispatch2.json'));
  assert.equal(r.code, 0, r.out + r.err);
  return repo;
}

test('restart 성공 → context-review.md에 restart_count 표식이 쓰이고 다른 키와 본문은 그대로다', () => {
  const repo = makeRepo();
  const before = crDoc(repo);
  start(repo, dispatchFile(repo));
  assert.equal(marker(repo), undefined);
  changeDocs(repo);
  assert.equal(restart(repo, dispatchFile(repo, 'dispatch2.json')).code, 0);
  const after = crDoc(repo);
  assert.equal(marker(repo), 1);
  assert.deepEqual(after.data.bouncer.context_review.findings, []);
  assert.equal(after.data.bouncer.status, before.data.bouncer.status);
  assert.equal(after.body, before.body);
});

test('restart 뒤 runtime state를 지우고 start → 새 cycle을 만들지 않고 거부한다', () => {
  const repo = restartedRepo();
  fs.unlinkSync(findState(repo));
  const r = start(repo, dispatchFile(repo, 'dispatch3.json'));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
  assert.equal(fs.existsSync(findState(repo) || '/nonexistent'), false);
});

test('restart 뒤 runtime state를 지우고 restart → 한도 소진으로 거부한다', () => {
  const repo = restartedRepo();
  fs.unlinkSync(findState(repo));
  changeDocs(repo);
  const r = restart(repo, dispatchFile(repo, 'dispatch3.json'));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-restart-limit');
});

test('표식이 1인데 state의 restart_count가 더 낮으면 → 손상으로 모든 전이를 거부한다', () => {
  const repo = restartedRepo();
  const statePath = findState(repo);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.cycle.restart_count = 0;
  state.cycle.history = [];
  fs.writeFileSync(statePath, JSON.stringify(state));
  const d = dispatchFile(repo, 'dispatch3.json');
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
  assert.equal(restart(repo, d).code, 1);
});

test('legacy import restart → 표식을 남겨 state 삭제 뒤 restart가 한도 소진으로 거부된다', () => {
  const repo = makeRepo();
  const crPath = path.join(repo, BP, 'context-review.md');
  const snap = computePlanSnapshot({ repoRoot: repo, blueprintDir: BP });
  fs.writeFileSync(crPath, fs.readFileSync(crPath, 'utf8').replace(
    'findings: []',
    `rounds:\n    - round: 1\n      mode: discovery\n      target: { digest: ${snap.digest} }\n    findings: []`,
  ));
  changeDocs(repo);
  assert.equal(restart(repo, dispatchFile(repo, 'dispatch2.json')).code, 0);
  assert.equal(marker(repo), 1);
  fs.unlinkSync(findState(repo));
  assert.equal(restart(repo, dispatchFile(repo, 'dispatch2.json')).json.reason, 'context-review-restart-limit');
});

/** state.json을 읽어 수정한 뒤 다시 쓴다. */
function tamperState(repo, mutate) {
  const statePath = findState(repo);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  mutate(state);
  fs.writeFileSync(statePath, JSON.stringify(state));
  return statePath;
}

test('state의 cycle.id가 cr-<16hex> 형식이 아니면 → 참조가 일관돼도 손상으로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  tamperState(repo, (s) => {
    const old = s.cycle.id;
    s.cycle.id = 'evil';
    s.cycle.latest_dispatch.path = s.cycle.latest_dispatch.path.replace(old, 'evil');
  });
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
});

test('state의 참조 경로에 .. 구간이 있으면 → cycle prefix로 시작해도 손상으로 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  tamperState(repo, (s) => {
    s.cycle.latest_dispatch.path = `${path.posix.dirname(s.cycle.latest_dispatch.path)}/../../../../../../x.json`;
  });
  const r = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-state-conflict');
});

test('cycles 아래 dispatch 디렉터리가 symlink이면 → 쓰기를 거부하고 밖에 파일을 만들지 않는다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  const started = start(repo, d);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cr-outside-'));
  const dispatchDir = path.join(path.dirname(findState(repo)), 'cycles', started.json.cycle.id, 'dispatch');
  fs.rmSync(dispatchDir, { recursive: true });
  fs.symlinkSync(outside, dispatchDir);
  changeDocs(repo);
  const d2 = dispatchFile(repo, 'dispatch2.json');
  const r = record(repo, d2, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('writeImmutable → 대상 파일이 symlink이면 거부하고 내용이 다른 기존 파일도 거부한다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cr-wi-'));
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cr-out-')), 'victim');
  fs.writeFileSync(outside, 'keep');
  fs.symlinkSync(outside, path.join(root, 'link.json'));
  assert.throws(() => crState.writeImmutable(root, path.join(root, 'link.json'), 'x'), /symlink/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
  const file = path.join(root, 'sub', 'a.json');
  crState.writeImmutable(root, file, 'one');
  crState.writeImmutable(root, file, 'one');
  assert.throws(() => crState.writeImmutable(root, file, 'two'), /differs/);
  assert.equal(fs.readFileSync(file, 'utf8'), 'one');
});

test('writeAtomic → 대상이 symlink이면 거부하고 tmp 파일을 남기지 않는다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cr-wa-'));
  const outside = path.join(root, 'victim');
  fs.writeFileSync(outside, 'keep');
  fs.symlinkSync(outside, path.join(root, 'state.json'));
  assert.throws(() => crState.writeAtomic(path.join(root, 'state.json'), 'x'), /symlink/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
  assert.deepEqual(fs.readdirSync(root).sort(), ['state.json', 'victim']);
  crState.writeAtomic(path.join(root, 'ok.json'), 'a');
  crState.writeAtomic(path.join(root, 'ok.json'), 'b');
  assert.equal(fs.readFileSync(path.join(root, 'ok.json'), 'utf8'), 'b');
  assert.deepEqual(fs.readdirSync(root).sort(), ['ok.json', 'state.json', 'victim']);
});

test('dispatch의 parts가 현재 blueprint 재계산과 다르면 → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const real = computePlanParts({ repoRoot: repo, blueprintDir: BP });
  const [first] = Object.keys(real.parts);
  const forged = { ...real.parts, [first]: 'f'.repeat(64) };
  const r = start(repo, dispatchFile(repo, 'forged.json', { parts: forged }));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
  assert.equal(findState(repo), null);
  const forgedScope = start(repo, dispatchFile(repo, 'forged2.json', { scope_parts: { x: 'y' } }));
  assert.equal(forgedScope.json.reason, 'context-review-target-invalid');
});

test('dispatch에 parts·scope_parts가 없으면 → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const r = start(repo, dispatchFile(repo, 'noparts.json', { parts: undefined, scope_parts: undefined }));
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-target-invalid');
});

test('restart 표식이 있는 context-review.md → 구조·plan 검증에 표식 때문의 실패가 늘지 않는다', () => {
  const repo = makeRepo();
  start(repo, dispatchFile(repo));
  const failuresOf = () => validateBlueprint({ repoRoot: repo, blueprintDir: BP, planDraft: true })
    .failures.map((f) => `${f.code} ${f.message}`).filter((m) => /context|CTXREVIEW|restart_count/i.test(m));
  const before = failuresOf();
  changeDocs(repo);
  assert.equal(restart(repo, dispatchFile(repo, 'dispatch2.json')).code, 0);
  assert.equal(marker(repo), 1);
  assert.deepEqual(failuresOf(), before);
});

// --- v2 payload 영속·무결성(BP 096/002 task 001) -------------------------------------

test('v2 dispatch로 start → 저장된 latest_dispatch payload가 입력과 같다', () => {
  const repo = makeRepo();
  const file = dispatchFile(repo);
  assert.equal(start(repo, file).code, 0);
  const stored = crState.readStoredLatest(repo, BP);
  assert.equal(stored.ok, true);
  assert.deepEqual(stored.payload, JSON.parse(fs.readFileSync(file, 'utf8')));
});

test('snapshot_version이 없거나 지원하지 않는 dispatch → target-invalid로 거부하고 state를 남기지 않는다', () => {
  const repo = makeRepo();
  for (const version of [undefined, 1, 3]) {
    const r = start(repo, dispatchFile(repo, `v${version}.json`, { snapshot_version: version }));
    assert.equal(r.code, 1);
    assert.equal(r.json.reason, 'context-review-target-invalid');
  }
  assert.equal(findState(repo), null);
});

test('dispatch의 structure_parts·documents_content가 현재 문서와 다르면 → target-invalid로 거부한다', () => {
  const repo = makeRepo();
  const real = computePlanParts({ repoRoot: repo, blueprintDir: BP });
  const [first] = Object.keys(real.documents_content);
  const forgedContent = {
    ...real.documents_content,
    [first]: { ...real.documents_content[first], body: `${real.documents_content[first].body}forged` },
  };
  const a = start(repo, dispatchFile(repo, 'forged-content.json', { documents_content: forgedContent }));
  assert.equal(a.json.reason, 'context-review-target-invalid');
  const b = start(repo, dispatchFile(repo, 'forged-structure.json', {
    structure_parts: { ...real.structure_parts, [first]: 'f'.repeat(64) },
  }));
  assert.equal(b.json.reason, 'context-review-target-invalid');
  assert.equal(findState(repo), null);
});

test('구조가 같은 문서 보완 뒤 restart → 새 v2 payload가 기록되고 이전 payload는 archive에 남는다', () => {
  const repo = makeRepo();
  assert.equal(start(repo, dispatchFile(repo)).code, 0);
  changeDocs(repo);
  const r = restart(repo, dispatchFile(repo, 'dispatch2.json'));
  assert.equal(r.code, 0, r.out + r.err);
  const state = JSON.parse(fs.readFileSync(findState(repo), 'utf8'));
  assert.equal(state.cycle.restart_count, 1);
  assert.equal(state.cycle.history[0].dispatches.length, 1);
});

/** 실제 review-dispatch 출력처럼 payload에 follow_up을 싣는다(후속 판정은 payload에서 파생된다). */
function withFollowUp(dispatch, followUp) {
  const payload = JSON.parse(fs.readFileSync(dispatch, 'utf8'));
  fs.writeFileSync(dispatch, `${JSON.stringify({ ...payload, follow_up: followUp })}\n`);
  return dispatch;
}

/** 라우팅은 읽기 전용이어야 하므로 호출 전후의 state.json bytes를 함께 돌려준다. */
function route(repo, dispatch, followUp, explicit) {
  withFollowUp(dispatch, followUp);
  const stateFile = findState(repo);
  const before = fs.readFileSync(stateFile);
  const result = crState.routeFollowUp({
    repoRoot: repo, blueprintDir: BP, dispatchFile: dispatch, followUp: explicit,
  });
  assert.deepEqual(fs.readFileSync(stateFile), before, 'routing must not write state');
  return result;
}

/** round 1(discovery)과 round 2(delta)를 기록한 cycle을 만든다. */
function cycleAfterDelta(repo, findings = [ADVISORY]) {
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]));
  record(repo, d, roundFile(
    repo, 'r2.json', 2, 'delta',
    findings.length === 0 ? [] : findings,
  ));
  return d;
}

test('delta 완료 뒤 새 partial target → 세 번째 delta 대신 restart를 가리키고 state는 그대로다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [{ ...MUST_FIX, status: 'resolved' }]);
  changeStructure(repo);
  const out = route(repo, dispatchFile(repo, 'd2.json'), 'partial');
  assert.equal(out.ok, true);
  assert.equal(out.next_action, 'restart');
  assert.equal(typeof out.reason, 'string');
  assert.equal(typeof out.next, 'string');
});

test('discovery만 끝난 cycle의 새 target → 본문만 close, Interface·Touch 변경 delta, 구조 변경 restart를 가리킨다', () => {
  const repo = makeRepo();
  writeTask(repo);
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]));
  changeDocs(repo);
  assert.equal(route(repo, dispatchFile(repo, 'd2.json'), 'partial').next_action, 'close');
  writeTask(repo, '- `fnB`\n');
  assert.equal(route(repo, dispatchFile(repo, 'd3.json'), 'partial').next_action, 'delta');
  changeStructure(repo);
  assert.equal(route(repo, dispatchFile(repo, 'd4.json'), 'full').next_action, 'restart');
});

test('마지막 reviewed target과 같은 target → reuse이고 round 개수는 늘지 않는다', () => {
  const repo = makeRepo();
  const d = cycleAfterDelta(repo, [{ ...MUST_FIX, status: 'resolved' }]);
  const out = route(repo, d, 'partial');
  assert.equal(out.next_action, 'reuse');
  const state = JSON.parse(fs.readFileSync(findState(repo), 'utf8'));
  assert.equal(state.cycle.active_reports.length, 2);
});

test('restart를 이미 쓴 cycle의 새 stale target → user로 멈추고 cause와 next를 준다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]));
  changeDocs(repo);
  assert.equal(restart(repo, dispatchFile(repo, 'd2.json')).code, 0);
  record(repo, dispatchFile(repo, 'd2b.json'), roundFile(repo, 'r1b.json', 1, 'discovery', []));
  changeStructure(repo);
  const out = route(repo, dispatchFile(repo, 'd3.json'), 'full');
  assert.equal(out.next_action, 'user');
  assert.equal(typeof out.cause, 'string');
  assert.equal(typeof out.next, 'string');
});

test('delta 뒤 미해결 must_fix가 남은 cycle의 stale target → user로 멈춘다', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  changeDocs(repo);
  const out = route(repo, dispatchFile(repo, 'd2.json'), 'full');
  assert.equal(out.next_action, 'user');
  assert.equal(out.reason, 'context-review-unresolved-findings');
});

test('아직 round가 기록되지 않은 cycle → user로 멈춘다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  assert.equal(route(repo, d, 'partial').next_action, 'user');
});

test('delta 뒤 세 번째 round 기록 요청 → 거부되고 round는 2개로 유지된다', () => {
  const repo = makeRepo();
  const d = cycleAfterDelta(repo, [{ ...MUST_FIX, status: 'resolved' }]);
  const third = record(repo, d, roundFile(repo, 'r3.json', 3, 'delta', []));
  assert.equal(third.code, 1);
  assert.equal(third.json.reason, 'context-review-round-order');
  const state = JSON.parse(fs.readFileSync(findState(repo), 'utf8'));
  assert.equal(state.cycle.active_reports.length, 2);
});

test('caller followUp이 payload follow_up과 다름 → input-invalid로 거절된다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]));
  changeDocs(repo);
  const out = route(repo, dispatchFile(repo, 'd2.json'), 'full', 'partial');
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'context-review-input-invalid');
});

test('payload에 follow_up이 없음 → input-invalid로 거절된다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', []));
  const out = crState.routeFollowUp({ repoRoot: repo, blueprintDir: BP, dispatchFile: d });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'context-review-input-invalid');
});

test('route 동사에 discovery 뒤 partial payload → exit 0과 delta를 출력하고 state는 그대로다', () => {
  const repo = makeRepo();
  writeTask(repo);
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...MUST_FIX, status: 'resolved' }]));
  writeTask(repo, '- `fnB`\n');
  const d2 = withFollowUp(dispatchFile(repo, 'd2.json'), 'partial');
  const before = fs.readFileSync(findState(repo));
  const r = capture(['context-review', 'route', ...base(repo), '--dispatch', d2]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.json.next_action, 'delta');
  assert.deepEqual(fs.readFileSync(findState(repo)), before);
});

test('route 동사에 record 전용 플래그 → exit 2 사용법 거절이다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  const r = capture(['context-review', 'route', ...base(repo), '--dispatch', d, '--reason', 'x']);
  assert.equal(r.code, 2);
});

test('route 동사에 follow_up 없는 payload → exit 1과 input-invalid를 출력한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const r = capture(['context-review', 'route', ...base(repo), '--dispatch', d]);
  assert.equal(r.code, 1);
  assert.equal(r.json.reason, 'context-review-input-invalid');
});

test('도움말 round·dispositions 예시를 그대로 기록 → start·record·record·close 모두 ok', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  const digest = JSON.parse(fs.readFileSync(d, 'utf8')).target.digest;
  const help = capture(['context-review', '--help']).out;
  const blocks = [...help.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  assert.equal(blocks.length, 3);
  const files = blocks.map((b, i) => {
    const file = path.join(repo, `help-${i}.json`);
    fs.writeFileSync(file, b.split('<target.digest>').join(digest));
    return file;
  });
  const started = start(repo, d);
  assert.equal(started.code, 0, started.out + started.err);
  const r1 = record(repo, d, files[0]);
  assert.equal(r1.json.ok, true, r1.out + r1.err);
  const r2 = record(repo, d, files[1]);
  assert.equal(r2.json.ok, true, r2.out + r2.err);
  const closed = close(repo, files[2]);
  assert.equal(closed.json.ok, true, closed.out + closed.err);
});

// --- cycle을 닫는 명령이 context-review.md를 직접 기록한다 ---

const crDocPath = (repo) => path.join(repo, BP, 'context-review.md');
const RESOLVED = { ...MUST_FIX, status: 'resolved', last_seen_round: 2 };

/** delta까지 기록하고 열린 finding이 없는 상태에서 `[]` dispositions로 닫는다. */
function closeResolved(repo, extra = []) {
  const d = cycleAfterDelta(repo, [RESOLVED]);
  const disp = writeJson(repo, 'dispositions.json', []);
  return { d, disp, res: close(repo, disp, extra) };
}

test('close 성공 → context-review.md status accepted와 projection rounds·findings 기록', () => {
  const repo = makeRepo();
  const { res } = closeResolved(repo);
  assert.equal(res.code, 0, res.out + res.err);
  assert.equal(res.json.written, `${BP}/context-review.md`);
  const doc = readDoc(crDocPath(repo));
  assert.equal(doc.data.bouncer.status, 'accepted');
  assert.deepEqual(doc.data.bouncer.context_review.findings, res.json.projection.findings);
  assert.deepEqual(doc.data.bouncer.context_review.rounds, res.json.projection.rounds);
});

test('close 재실행 → context-review.md 바이트 동일', () => {
  const repo = makeRepo();
  const { disp, res } = closeResolved(repo);
  assert.equal(res.code, 0, res.out + res.err);
  const first = fs.readFileSync(crDocPath(repo));
  const again = close(repo, disp);
  assert.equal(again.code, 0, again.out + again.err);
  assert.equal(again.json.noop, true);
  assert.equal(again.json.written, `${BP}/context-review.md`);
  assert.deepEqual(fs.readFileSync(crDocPath(repo)), first);
});

test('open must_fix로 close 거절 → context-review.md 바이트 불변', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [MUST_FIX]);
  const before = fs.readFileSync(crDocPath(repo));
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 1);
  assert.equal(res.json.reason, 'context-review-unresolved-findings');
  assert.deepEqual(fs.readFileSync(crDocPath(repo)), before);
});

test('note에 CR·CRLF가 든 finding close → Findings 항목이 한 줄로 접힘', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [{ ...RESOLVED, note: 'first\r\nsecond\rthird' }]);
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 0, res.out + res.err);
  const body = readDoc(crDocPath(repo)).body;
  assert.equal(body.includes('\r'), false);
  assert.ok(body.split('\n').some((l) => l.startsWith('- CR-1 (') && l.endsWith('first second third')), body);
});

test('context-review.md 부재에서 close → context-review-target-invalid, state 불변', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [RESOLVED]);
  fs.rmSync(crDocPath(repo));
  const stateBefore = fs.readFileSync(findState(repo));
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 1);
  assert.equal(res.json.reason, 'context-review-target-invalid');
  assert.equal(res.json.next, `bouncer scaffold context-review --blueprint ${BP}`);
  assert.deepEqual(fs.readFileSync(findState(repo)), stateBefore);
  assert.equal(fs.existsSync(crDocPath(repo)), false);
});

test('## Findings 밖 본문 → close 뒤에도 바이트 동일', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [RESOLVED]);
  const parsed = readDoc(crDocPath(repo));
  const head = '# Context review\n\nIntro stays.\n\n';
  const tail = '\n## Notes\nkeep this exactly.\n';
  fs.writeFileSync(crDocPath(repo),
    fs.readFileSync(crDocPath(repo), 'utf8').replace(parsed.body, `${head}## Findings\n- <finding>\n${tail}`));
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 0, res.out + res.err);
  const body = readDoc(crDocPath(repo)).body;
  assert.ok(body.startsWith(head), body);
  assert.ok(body.endsWith(tail), body);
  assert.equal(body.includes('- <finding>'), false);
});

test('record --status accepted → context-review.md 기록, written 필드 반환', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const res = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [ADVISORY]), ['--status', 'accepted']);
  assert.equal(
    res.code, 1, 'advisory open은 accepted로 닫을 수 없다');
  const ok = record(repo, d, roundFile(repo, 'r1b.json', 1, 'discovery', [{ ...ADVISORY, status: 'resolved' }]),
    ['--status', 'accepted']);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.equal(ok.json.written, `${BP}/context-review.md`);
  const doc = readDoc(crDocPath(repo));
  assert.equal(doc.data.bouncer.status, 'accepted');
  assert.deepEqual(doc.data.bouncer.context_review.findings, ok.json.projection.findings);
  assert.deepEqual(doc.data.bouncer.context_review.rounds, ok.json.projection.rounds);
});

test('record --status requested → context-review.md 불변', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const before = fs.readFileSync(crDocPath(repo));
  const res = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]), ['--status', 'requested']);
  assert.equal(res.code, 0, res.out + res.err);
  assert.equal(res.json.written, undefined);
  assert.deepEqual(fs.readFileSync(crDocPath(repo)), before);
});

test('restart_count 표식이 있는 문서 close → restart_count 유지', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [MUST_FIX]));
  changeDocs(repo);
  const d2 = dispatchFile(repo, 'dispatch2.json');
  assert.equal(restart(repo, d2).code, 0);
  assert.equal(readDoc(crDocPath(repo)).data.bouncer.context_review.restart_count, 1);
  const res = record(repo, d2, roundFile(repo, 'r1c.json', 1, 'discovery', [{ ...RESOLVED, last_seen_round: 1 }]),
    ['--status', 'accepted']);
  assert.equal(res.code, 0, res.out + res.err);
  assert.equal(readDoc(crDocPath(repo)).data.bouncer.context_review.restart_count, 1);
});

test('close 뒤 status·context_review 밖 frontmatter → 파싱 값 동일', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [RESOLVED]);
  const before = readDoc(crDocPath(repo)).data;
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 0, res.out + res.err);
  const after = readDoc(crDocPath(repo)).data;
  const without = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));
  assert.deepEqual(
    without(after.bouncer, ['status', 'context_review']),
    without(before.bouncer, ['status', 'context_review']),
  );
  assert.deepEqual(without(after, ['bouncer']), without(before, ['bouncer']));
});

test('## Findings에 inline context review 줄이 있는 문서 close → 그 줄이 생성 목록 앞에 남음', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [RESOLVED]);
  const line = '- inline context review: print dispatch failed, reviewed in-session';
  fs.writeFileSync(crDocPath(repo),
    fs.readFileSync(crDocPath(repo), 'utf8').replace('- <finding>', `${line}\n- stale hand-written entry`));
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 0, res.out + res.err);
  const body = readDoc(crDocPath(repo)).body;
  const lines = body.split('\n');
  const at = lines.indexOf('## Findings');
  assert.equal(lines[at + 1], line);
  assert.ok(lines[at + 2].startsWith('- CR-1 (major, must_fix, resolved): tasks/001 Interface'), body);
  assert.equal(body.includes('stale hand-written entry'), false);
});

test('context-review.md 부재에서 record --status accepted → context-review-target-invalid, state 불변', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  fs.rmSync(crDocPath(repo));
  const stateBefore = fs.readFileSync(findState(repo));
  const res = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...ADVISORY, status: 'resolved' }]),
    ['--status', 'accepted']);
  assert.equal(res.code, 1);
  assert.equal(res.json.reason, 'context-review-target-invalid');
  assert.equal(res.json.next, `bouncer scaffold context-review --blueprint ${BP}`);
  assert.deepEqual(fs.readFileSync(findState(repo)), stateBefore);
});

test('frontmatter가 깨진 context-review.md에서 close → context-review-legacy-evidence, 파일 바이트 불변', () => {
  const repo = makeRepo();
  cycleAfterDelta(repo, [RESOLVED]);
  fs.writeFileSync(crDocPath(repo), 'no frontmatter here\n');
  const before = fs.readFileSync(crDocPath(repo));
  const res = close(repo, writeJson(repo, 'dispositions.json', []));
  assert.equal(res.code, 1);
  assert.equal(res.json.reason, 'context-review-legacy-evidence');
  assert.deepEqual(fs.readFileSync(crDocPath(repo)), before);
});

test('frontmatter가 깨진 context-review.md에서 record --status accepted → context-review-legacy-evidence, 파일 바이트 불변', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  fs.writeFileSync(crDocPath(repo), 'no frontmatter here\n');
  const before = fs.readFileSync(crDocPath(repo));
  const res = record(repo, d, roundFile(repo, 'r1.json', 1, 'discovery', [{ ...ADVISORY, status: 'resolved' }]),
    ['--status', 'accepted']);
  assert.equal(res.code, 1);
  assert.equal(res.json.reason, 'context-review-legacy-evidence');
  assert.deepEqual(fs.readFileSync(crDocPath(repo)), before);
});

test('close 뒤 문서를 scaffold 상태로 되돌리고 같은 close 재실행 → 문서가 첫 성공 바이트로 복구', () => {
  const repo = makeRepo();
  const scaffolded = fs.readFileSync(crDocPath(repo));
  const { disp, res } = closeResolved(repo);
  assert.equal(res.code, 0, res.out + res.err);
  const first = fs.readFileSync(crDocPath(repo));
  fs.writeFileSync(crDocPath(repo), scaffolded);
  const again = close(repo, disp);
  assert.equal(again.code, 0, again.out + again.err);
  assert.equal(again.json.noop, true);
  assert.deepEqual(fs.readFileSync(crDocPath(repo)), first);
});

test('close 뒤 계획 수정 후 restart → 성공, context-review.md에 restart_count 1 기록', () => {
  const repo = makeRepo();
  const { res } = closeResolved(repo);
  assert.equal(res.code, 0, res.out + res.err);
  changeDocs(repo);
  const rs = restart(repo, dispatchFile(repo, 'dispatch2.json'));
  assert.equal(rs.code, 0, rs.out + rs.err);
  const doc = readDoc(crDocPath(repo));
  assert.equal(doc.data.bouncer.context_review.restart_count, 1);
  assert.equal(doc.data.bouncer.context_review.rounds.length, 2);
});

// 병합 후보 경고: 같은 file·symbol을 다른 category가 가리키는 finding 묶음을 알린다.
const mergePair = (overrides = {}) => [
  withFingerprint({ ...MUST_FIX, id: 'CR-1', category: 'spec_scope', file: 'scripts/src/lib/a.ts', symbol: 'f', ...overrides }),
  withFingerprint({ ...MUST_FIX, id: 'CR-2', category: 'correctness_tests', file: 'scripts/src/lib/a.ts', symbol: 'f', ...overrides }),
];

test('같은 file·symbol에 category가 다른 finding 기록 → warnings에 병합 후보가 들어간다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const result = record(repo, d, roundFile(repo, 'w1.json', 1, 'discovery', mergePair()));
  assert.equal(result.code, 0);
  assert.deepStrictEqual(result.json.warnings, [
    { code: 'finding-merge-candidate', file: 'scripts/src/lib/a.ts', symbol: 'f', ids: ['CR-1', 'CR-2'] },
  ]);
});

test('후보가 없는 finding 기록 → warnings 키가 없다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const result = record(repo, d, roundFile(repo, 'w2.json', 1, 'discovery', [MUST_FIX, ADVISORY]));
  assert.equal(result.code, 0);
  assert.equal('warnings' in result.json, false);
});

test('symbol이 빈 finding 기록 → warnings 키가 없다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const result = record(repo, d, roundFile(repo, 'w3.json', 1, 'discovery', mergePair({ symbol: '' })));
  assert.equal(result.code, 0);
  assert.equal('warnings' in result.json, false);
});

test('후보가 있던 record를 같은 입력으로 반복 → noop 응답에 warnings 키가 없다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const rf = roundFile(repo, 'w4.json', 1, 'discovery', mergePair());
  record(repo, d, rf);
  const again = record(repo, d, rf);
  assert.equal(again.json.noop, true);
  assert.equal('warnings' in again.json, false);
});

// record 시점 중복 fingerprint 거부: status와 무관하게 쓰기 전에 막아 같은 round를 다시 기록할 수 있게 한다.
const dupPair = () => [MUST_FIX, { ...MUST_FIX, id: 'CR-9' }];

/** runtime 아래 모든 파일의 상대 경로와 내용을 모아 쓰기 여부를 비교한다. */
function runtimeSnapshot(repo) {
  const root = path.join(repo, '.bouncer', 'runtime', 'context-review');
  const out = {};
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else out[path.relative(root, abs)] = fs.readFileSync(abs, 'utf8');
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out;
}

for (const status of ['requested', 'addressed', 'accepted']) {
  test(`fingerprint가 같은 finding 둘을 status ${status}로 record → duplicate fingerprint로 거부한다`, () => {
    const repo = makeRepo();
    const d = dispatchFile(repo);
    start(repo, d);
    const result = record(repo, d, roundFile(repo, 'dup.json', 1, 'discovery', dupPair()), ['--status', status]);
    assert.equal(result.code, 1, result.out + result.err);
    assert.equal(result.json.reason, 'context-review-input-invalid');
    assert.match(JSON.stringify(result.json.cause), /context-review duplicate fingerprint context:combined:/);
  });
}

test('중복 fingerprint round가 거부된 뒤 → state와 보고 파일이 그대로이고 합친 입력은 같은 round로 기록된다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  const before = runtimeSnapshot(repo);
  const rejected = record(repo, d, roundFile(repo, 'dup.json', 1, 'discovery', dupPair()));
  assert.equal(rejected.code, 1);
  assert.deepStrictEqual(runtimeSnapshot(repo), before);
  const merged = record(repo, d, roundFile(repo, 'merged.json', 1, 'discovery', [MUST_FIX]));
  assert.equal(merged.code, 0, merged.out + merged.err);
  assert.equal(merged.json.cycle.active_reports.length, 1);
});

test('같은 id로 이전 round finding을 덮어쓰는 입력 → 중복이 아니어서 기록된다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  assert.equal(record(repo, d, roundFile(repo, 'o1.json', 1, 'discovery', [MUST_FIX])).code, 0);
  const overwrite = { ...MUST_FIX, last_seen_round: 2 };
  const r2 = record(repo, d, roundFile(repo, 'o2.json', 2, 'delta', [overwrite]));
  assert.equal(r2.code, 0, r2.out + r2.err);
});

test('이전 round와 fingerprint가 같고 id가 다른 finding을 다음 round에 record → 거부한다', () => {
  const repo = makeRepo();
  const d = dispatchFile(repo);
  start(repo, d);
  assert.equal(record(repo, d, roundFile(repo, 'p1.json', 1, 'discovery', [MUST_FIX])).code, 0);
  const r2 = record(repo, d, roundFile(repo, 'p2.json', 2, 'delta', [{ ...MUST_FIX, id: 'CR-9' }]));
  assert.equal(r2.code, 1);
  assert.match(JSON.stringify(r2.json.cause), /duplicate fingerprint/);
});
