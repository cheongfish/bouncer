'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runCli } = require('../scripts/lib/cli');
const { scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
const { computePlanSnapshot } = require('../scripts/lib/plan-snapshot');

const TS = '2026-07-01T00:00:00+09:00';
const BP = '.bouncer/context/epics/001-auth/blueprints/001-login';

const MUST_FIX = {
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
};
const ADVISORY = {
  ...MUST_FIX,
  id: 'CR-2',
  severity: 'minor',
  actionability: 'advisory',
  symbol: 'g',
};

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
  return writeJson(repo, name, {
    ok: true,
    phase: 'plan',
    target: { digest: snap.digest, documents: snap.documents },
    strategy: 'single',
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
