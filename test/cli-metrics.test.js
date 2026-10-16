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

test('root-direct-session start·end → 세션이 끝나고 summary가 kind별로 합산한다', () => {
  const f = fixture();
  const started = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'root-direct-session', blueprint: BLUEPRINT,
    label: 'direct', now: clock('2026-01-01T00:00:00Z'), randomId: () => 'e1e1e1e1e1e1e1e1',
  });
  assert.strictEqual(started.ok, true);
  const ended = metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: started.id, pricing: {}, tokens: 40,
    now: clock('2026-01-01T00:00:03Z'),
  });
  assert.strictEqual(ended.ok, true);
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT });
  const direct = summary.kinds['root-direct-session'];
  assert.strictEqual(direct.sessions, 1);
  assert.strictEqual(direct.tokens_total, 40);
  assert.strictEqual(direct.wall_ms_total, 3000);
  assert.strictEqual(summary.kinds['coordinator-session'].sessions, 0);
});

test('root-direct-session에 target-digest를 주면 → invalid-metrics-input으로 거절한다', () => {
  const f = fixture();
  const result = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'root-direct-session', blueprint: BLUEPRINT,
    targetDigest: DIGEST,
  });
  assert.deepStrictEqual(result, { ok: false, reason: 'invalid-metrics-input' });
});

test('metrics CLI --kind root-direct-session → ok:true로 시작한다', () => {
  const repo = tmp();
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const buf = { out: '', err: '' };
  const io = { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } };
  const code = runCli(['metrics', 'start', '--kind', 'root-direct-session', '--blueprint', BLUEPRINT, '--repo', repo], io);
  assert.strictEqual(code, 0, buf.out + buf.err);
  assert.strictEqual(JSON.parse(buf.out).ok, true);
});

// cache 토큰 테스트가 공유하는 CLI 헬퍼: 실제 git 저장소에서 세션을 시작하고 id를 돌려준다.
function startCliSession() {
  const repo = tmp();
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const buf = { out: '', err: '' };
  const io = { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } };
  const start = runCli(['metrics', 'start', '--kind', 'coordinator-session', '--blueprint', BLUEPRINT, '--repo', repo], io);
  assert.strictEqual(start, 0, buf.out + buf.err);
  const { id } = JSON.parse(buf.out);
  buf.out = '';
  const session = () => JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/runtime/drive-metrics.json'), 'utf8')).sessions[0];
  return { repo, io, buf, id, session };
}

test('metrics CLI end의 cache 플래그 → cache read·write 토큰을 세션에 저장하고 사유 키를 쓰지 않는다', () => {
  const c = startCliSession();
  const code = runCli(['metrics', 'end', '--id', c.id, '--tokens', '500',
    '--cache-read-tokens', '120', '--cache-write-tokens', '30', '--repo', c.repo], c.io);
  assert.strictEqual(code, 0, c.buf.out + c.buf.err);
  const s = c.session();
  assert.strictEqual(s.cache_read_tokens, 120);
  assert.strictEqual(s.cache_write_tokens, 30);
  assert.strictEqual(Object.hasOwn(s, 'cache_unavailable_reason'), false);
  // cache는 총합과 독립이라 tokens에 더해지지 않는다.
  assert.strictEqual(s.tokens, 500);
});

test('metrics CLI end에 cache 플래그 하나만 → 준 쪽만 저장하고 다른 쪽은 null이다', () => {
  const c = startCliSession();
  assert.strictEqual(runCli(['metrics', 'end', '--id', c.id, '--cache-read-tokens', '0', '--repo', c.repo], c.io), 0);
  const s = c.session();
  assert.strictEqual(s.cache_read_tokens, 0);
  assert.strictEqual(s.cache_write_tokens, null);
  assert.strictEqual(Object.hasOwn(s, 'cache_unavailable_reason'), false);
});

test('cache 플래그가 없는 end → 두 cache 필드가 null이고 not-reported 사유를 남긴다', () => {
  const f = fixture();
  const s = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => 'f1f1f1f1f1f1f1f1',
  });
  metrics.endSession({ file: f.file, resolveLedger: () => f.ledgerFile, id: s.id, pricing: {}, now: clock('2026-01-01T00:00:01Z') });
  const session = JSON.parse(fs.readFileSync(f.file, 'utf8')).sessions[0];
  assert.strictEqual(session.cache_read_tokens, null);
  assert.strictEqual(session.cache_write_tokens, null);
  assert.strictEqual(session.cache_unavailable_reason, 'not-reported');
});

test('metrics CLI end의 음수·소수·비숫자·값 없는 cache 플래그 → invalid-metrics-input과 exit 1을 낸다', () => {
  const c = startCliSession();
  for (const flag of ['--cache-read-tokens', '--cache-write-tokens']) {
    for (const bad of ['-1', '1.5', 'abc']) {
      c.buf.out = '';
      const code = runCli(['metrics', 'end', '--id', c.id, flag, bad, '--repo', c.repo], c.io);
      assert.strictEqual(code, 1, `${flag} ${bad}`);
      assert.strictEqual(JSON.parse(c.buf.out).reason, 'invalid-metrics-input');
    }
    c.buf.out = '';
    assert.strictEqual(runCli(['metrics', 'end', '--id', c.id, flag, '--repo', c.repo], c.io), 1);
    assert.strictEqual(JSON.parse(c.buf.out).reason, 'invalid-metrics-input');
  }
  // 거절된 호출은 세션을 닫지 않는다.
  assert.strictEqual(c.session().ended_at, null);
});

test('metrics start·summary에 cache 플래그 → usage와 exit 2를 낸다', () => {
  const buf = { out: '', err: '' };
  const io = { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } };
  assert.strictEqual(runCli(['metrics', 'summary', '--blueprint', BLUEPRINT, '--cache-read-tokens', '1'], io), 2);
  assert.strictEqual(runCli(['metrics', 'start', '--kind', 'coordinator-session', '--blueprint', BLUEPRINT,
    '--cache-write-tokens', '1'], io), 2);
});

test('summary → cache 값은 합산하고 null·필드 없는 세션은 missing으로 세며 0은 값으로 더한다', () => {
  const f = fixture();
  const mk = (id) => metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => id,
  });
  const a = mk('a1a1a1a1a1a1a1a1');
  const b = mk('a2a2a2a2a2a2a2a2');
  const c = mk('a3a3a3a3a3a3a3a3');
  const open = mk('a4a4a4a4a4a4a4a4');
  assert.strictEqual(open.ok, true);
  const end = (id, extra) => metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id, pricing: {}, now: clock('2026-01-01T00:00:01Z'), ...extra,
  });
  end(a.id, { cacheReadTokens: 120, cacheWriteTokens: 0 });
  end(b.id, {});
  end(c.id, { cacheReadTokens: 0 });
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT });
  assert.deepStrictEqual(summary.cache, { read: { total: 120, missing: 1 }, write: { total: 0, missing: 2 } });
  // 기존 kinds 모양은 그대로다.
  assert.strictEqual(summary.kinds['coordinator-session'].sessions, 4);
  assert.strictEqual(Object.hasOwn(summary.kinds['coordinator-session'], 'cache'), false);
});

test('cache 필드가 없는 기존 형태의 기록 파일 → summary가 읽고 missing으로 센다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [{
      id: 'm-0000000000000000', kind: 'coordinator-session', blueprint: BLUEPRINT, label: null,
      started_at: '2026-01-01T00:00:00.000Z', ended_at: '2026-01-01T00:00:01.000Z', wall_ms: 1000, tokens: 10,
    }],
  }));
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT });
  assert.strictEqual(summary.ok, true);
  assert.deepStrictEqual(summary.cache, { read: { total: 0, missing: 1 }, write: { total: 0, missing: 1 } });
  assert.strictEqual(summary.kinds['coordinator-session'].tokens_total, 10);
});
