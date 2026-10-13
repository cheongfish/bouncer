'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const metrics = require('../scripts/lib/drive-metrics');
const { runCli } = require('../scripts/lib/cli');

const BLUEPRINT = '.bouncer/context/epics/098-a/blueprints/001-b';
const DIGEST = 'a'.repeat(64);

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-metrics-'));
}

function writeLedger(file, { decisions, integrated }) {
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    blueprint: BLUEPRINT,
    tasks: integrated.map((id) => ({ id, status: 'integrated' })).concat([{ id: '999', status: 'pending' }]),
    decisions,
  }));
}

// 시계와 id를 고정하는 seam. 호출마다 한 칸씩 앞으로 가는 시계를 돌려준다.
function clock(...isoTimes) {
  const queue = isoTimes.map((t) => new Date(t));
  return () => queue.shift();
}

function fixture() {
  const dir = tmp();
  return { dir, file: path.join(dir, 'drive-metrics.json'), ledgerFile: path.join(dir, 'coordinator.json') };
}

test('coordinator-session start then end → tasks_completed, exception_decisions, wall_ms를 계산한다', () => {
  const f = fixture();
  writeLedger(f.ledgerFile, { decisions: [{ kind: 'dispatch', task: '001' }], integrated: ['001'] });
  const started = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    label: 's1', now: clock('2026-01-01T00:00:00.000Z'), randomId: () => '0123456789abcdef',
  });
  assert.deepStrictEqual(started, { ok: true, id: 'm-0123456789abcdef' });
  writeLedger(f.ledgerFile, {
    decisions: [
      { kind: 'dispatch', task: '001' },
      { kind: 'report', task: '002', outcome: 'accepted' },
      { kind: 'report', task: '003', outcome: 'rework' },
      { kind: 'stale-report', task: '003' },
      { kind: 'fanin', task: '002' },
      { task: '002', decision: 'x' },
    ],
    integrated: ['001', '002'],
  });
  const ended = metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: started.id, pricing: {},
    now: clock('2026-01-01T00:00:05.250Z'),
  });
  assert.strictEqual(ended.ok, true);
  const session = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions[0];
  assert.deepStrictEqual(session.tasks_completed, ['002']);
  // start 이후 추가된 5건 중 예외는 rework report와 stale-report 둘이다.
  assert.strictEqual(session.exception_decisions, 2);
  assert.strictEqual(session.wall_ms, 5250);
  assert.strictEqual(session.start.decisions, 1);
  assert.match(session.start.ledger_sha256, /^[a-f0-9]{64}$/);
});

test('토큰 플래그가 없는 end → tokens null과 not-reported 사유를 남긴다', () => {
  const f = fixture();
  const s = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '1111111111111111',
  });
  metrics.endSession({ file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, now: clock('2026-01-01T00:00:01Z') });
  const session = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions[0];
  assert.strictEqual(session.tokens, null);
  assert.strictEqual(session.tokens_unavailable_reason, 'not-reported');
  // 원장이 없으면 snapshot도 null이고 진행 차이를 만들어 내지 않는다.
  assert.strictEqual(session.start, null);
});

test('모델·토큰 분할은 있고 pricing이 없는 end → no-pricing 사유로 cost null을 남긴다', () => {
  const f = fixture();
  const s = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '2222222222222222',
  });
  metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, model: 'm1',
    inputTokens: 1000, outputTokens: 500, now: clock('2026-01-01T00:00:01Z'),
  });
  const session = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions[0];
  assert.strictEqual(session.cost, null);
  assert.strictEqual(session.cost_unavailable_reason, 'no-pricing');
  assert.strictEqual(session.tokens, 1500);
});

test('pricing·모델·input·output이 모두 있는 end → 수식대로 cost를 계산한다', () => {
  const f = fixture();
  const s = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '3333333333333333',
  });
  metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, model: 'm1',
    pricing: { m1: { input_per_mtok: 3, output_per_mtok: 15 } },
    inputTokens: 2000000, outputTokens: 100000, now: clock('2026-01-01T00:00:01Z'),
  });
  const session = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions[0];
  // 2 Mtok * 3 + 0.1 Mtok * 15
  assert.ok(Math.abs(session.cost - 7.5) < 1e-9);
  assert.strictEqual(session.cost_unavailable_reason, undefined);
});

test('모델이 없거나 pricing이 깨진 end → no-model·invalid-pricing 사유를 남긴다', () => {
  const f = fixture();
  const a = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '4444444444444444',
  });
  metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: a.id, pricing: {}, inputTokens: 1, outputTokens: 1,
    now: clock('2026-01-01T00:00:01Z'),
  });
  const b = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '5555555555555555',
  });
  metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: b.id, pricing: null, model: 'm1',
    inputTokens: 1, outputTokens: 1, now: clock('2026-01-01T00:00:01Z'),
  });
  const [first, second] = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions;
  assert.strictEqual(first.cost_unavailable_reason, 'no-model');
  assert.strictEqual(second.cost_unavailable_reason, 'invalid-pricing');
});

test('context-review start → target_digest와 label을 남기고 원장 진행 필드를 만들지 않는다', () => {
  const f = fixture();
  writeLedger(f.ledgerFile, { decisions: [], integrated: ['001'] });
  const s = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'context-review', blueprint: BLUEPRINT,
    label: 'r1-local-c1', targetDigest: DIGEST,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '6666666666666666',
  });
  metrics.endSession({ file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, now: clock('2026-01-01T00:00:02Z') });
  const session = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions[0];
  assert.strictEqual(session.target_digest, DIGEST);
  assert.strictEqual(session.label, 'r1-local-c1');
  assert.strictEqual(Object.hasOwn(session, 'tasks_completed'), false);
  assert.strictEqual(Object.hasOwn(session, 'exception_decisions'), false);
});

test('context-review에 target-digest가 없거나 64 hex가 아니면 → invalid-metrics-input으로 거절한다', () => {
  const f = fixture();
  for (const targetDigest of [undefined, 'abc', 'g'.repeat(64)]) {
    const r = metrics.startSession({
      file: f.file, ledgerFile: f.ledgerFile, kind: 'context-review', blueprint: BLUEPRINT,
      targetDigest, now: clock('2026-01-01T00:00:00Z'), randomId: () => '7777777777777777',
    });
    assert.deepStrictEqual([r.ok, r.reason], [false, 'invalid-metrics-input']);
  }
  assert.strictEqual(fs.existsSync(f.file), false);
});

test('알 수 없는 kind → invalid-metrics-input, 없는 id → metrics-session-not-found를 낸다', () => {
  const f = fixture();
  const bad = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'nope', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '8888888888888888',
  });
  assert.strictEqual(bad.reason, 'invalid-metrics-input');
  const missing = metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: 'm-0000000000000000', pricing: {}, now: clock('2026-01-01T00:00:00Z'),
  });
  assert.deepStrictEqual([missing.ok, missing.reason], [false, 'metrics-session-not-found']);
});

test('이미 끝난 id에 end를 다시 부르면 → metrics-session-ended로 거절하고 기록을 바꾸지 않는다', () => {
  const f = fixture();
  const s = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => '9999999999999999',
  });
  metrics.endSession({ file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, tokens: 5, now: clock('2026-01-01T00:00:01Z') });
  const before = fs.readFileSync(f.file);
  const again = metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, tokens: 9, now: clock('2026-01-01T00:00:09Z'),
  });
  assert.deepStrictEqual([again.ok, again.reason], [false, 'metrics-session-ended']);
  assert.ok(before.equals(fs.readFileSync(f.file)));
});

test('깨진 drive-metrics.json → metrics-file-invalid로 거절하고 파일 바이트를 그대로 둔다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, '{"version":1,"sessions":');
  const before = fs.readFileSync(f.file);
  const started = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => 'aaaaaaaaaaaaaaaa',
  });
  const ended = metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: 'm-aaaaaaaaaaaaaaaa', pricing: {}, now: clock('2026-01-01T00:00:00Z'),
  });
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT });
  assert.deepStrictEqual([started.reason, ended.reason, summary.reason],
    ['metrics-file-invalid', 'metrics-file-invalid', 'metrics-file-invalid']);
  assert.ok(before.equals(fs.readFileSync(f.file)));
});

test('summary → null을 0으로 세지 않고 누락 수를 따로 센다', () => {
  const f = fixture();
  const ids = ['b1b1b1b1b1b1b1b1', 'b2b2b2b2b2b2b2b2', 'b3b3b3b3b3b3b3b3'];
  const tokens = [100, undefined, 50];
  ids.forEach((id, i) => {
    const s = metrics.startSession({
      file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
      now: clock('2026-01-01T00:00:00Z'), randomId: () => id,
    });
    metrics.endSession({
      file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, tokens: tokens[i],
      now: clock('2026-01-01T00:00:02Z'),
    });
  });
  const other = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: '.bouncer/context/epics/098-a/blueprints/002-c',
    now: clock('2026-01-01T00:00:00Z'), randomId: () => 'c1c1c1c1c1c1c1c1',
  });
  assert.strictEqual(other.ok, true);
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT });
  const cs = summary.kinds['coordinator-session'];
  assert.strictEqual(cs.sessions, 3);
  assert.strictEqual(cs.tokens_total, 150);
  assert.strictEqual(cs.tokens_missing, 1);
  assert.strictEqual(cs.wall_ms_total, 6000);
  assert.strictEqual(cs.cost_total, 0);
  assert.strictEqual(cs.cost_missing, 3);
  assert.strictEqual(summary.kinds['context-review'].sessions, 0);
});

test('listCoordinatorSessions → 같은 blueprint의 coordinator-session만 요약 필드로 돌려준다', () => {
  const f = fixture();
  assert.deepStrictEqual(metrics.listCoordinatorSessions({ file: f.file, blueprint: BLUEPRINT }), []);
  metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    label: 'x', now: clock('2026-01-01T00:00:00Z'), randomId: () => 'd1d1d1d1d1d1d1d1',
  });
  metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'context-review', blueprint: BLUEPRINT,
    targetDigest: DIGEST, now: clock('2026-01-01T00:00:00Z'), randomId: () => 'd2d2d2d2d2d2d2d2',
  });
  const list = metrics.listCoordinatorSessions({ file: f.file, blueprint: BLUEPRINT });
  assert.deepStrictEqual(list.map((s) => s.id), ['m-d1d1d1d1d1d1d1d1']);
  assert.deepStrictEqual(Object.keys(list[0]).sort(),
    ['ended_at', 'exception_decisions', 'id', 'label', 'started_at', 'tasks_completed', 'tokens']);
});

test('metrics CLI 알 수 없는 하위 명령·플래그 → usage와 exit 2를 낸다', () => {
  const buf = { out: '', err: '' };
  const io = { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } };
  assert.strictEqual(runCli(['metrics', 'bogus'], io), 2);
  assert.strictEqual(runCli(['metrics', 'start', '--bogus', 'x'], io), 2);
  assert.match(buf.err, /usage: bouncer metrics/);
});

test('metrics CLI end의 음수·비정수 숫자 플래그 → invalid-metrics-input과 exit 1을 낸다', () => {
  const repo = tmp();
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const buf = { out: '', err: '' };
  const io = { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } };
  const start = runCli(['metrics', 'start', '--kind', 'coordinator-session', '--blueprint', BLUEPRINT, '--repo', repo], io);
  assert.strictEqual(start, 0, buf.out + buf.err);
  const { id } = JSON.parse(buf.out);
  for (const bad of ['-1', '1.5', 'abc']) {
    buf.out = '';
    const code = runCli(['metrics', 'end', '--id', id, '--tokens', bad, '--repo', repo], io);
    assert.strictEqual(code, 1);
    assert.strictEqual(JSON.parse(buf.out).reason, 'invalid-metrics-input');
  }
  buf.out = '';
  assert.strictEqual(runCli(['metrics', 'end', '--id', id, '--tokens', '7', '--repo', repo], io), 0, buf.out);
  buf.out = '';
  assert.strictEqual(runCli(['metrics', 'summary', '--blueprint', BLUEPRINT, '--repo', repo], io), 0);
  assert.strictEqual(JSON.parse(buf.out).kinds['coordinator-session'].tokens_total, 7);
  assert.match(id, /^m-[0-9a-f]{16}$/);
});
