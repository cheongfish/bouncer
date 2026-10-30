'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const metrics = require('../packages/cli/dist/drive-metrics');
const { runCli } = require('../packages/cli/dist/cli');

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

test('summarize worker_tokens → worker-model 둘(토큰 하나)과 늦은 worker-tokens 하나를 키별로 합산하고 누락은 0이다', () => {
  const f = fixture();
  writeLedger(f.ledgerFile, {
    integrated: [],
    decisions: [
      { kind: 'worker-model', role: 'implementer', model: 'inherit', task: '001', tokens: 100 },
      { kind: 'worker-model', role: 'reviewer', model: 'inherit', task: '001', perspective: 'security' },
      { kind: 'worker-tokens', role: 'reviewer', tokens: 40, task: '001', perspective: 'security' },
      { kind: 'worker-model', role: 'reviewer', model: 'inherit', task: '002', perspective: 'security', tokens: 0 },
    ],
  });
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT, resolveLedger: () => f.ledgerFile });
  assert.deepStrictEqual(summary.worker_tokens, {
    total: 140, missing: 0,
    by_role: {
      implementer: { total: 100, missing: 0 },
      reviewer: { total: 40, missing: 0 },
      debugger: { total: 0, missing: 0 },
    },
  });
  // coordinator 세션이 없으면 관측값이 없으므로 0이 아니라 null이다(worker 합계와 섞지 않는다).
  assert.strictEqual(summary.kinds['coordinator-session'].tokens_total, null);
});

test('summarize worker_tokens → 토큰 없는 worker-model만 있으면 그 수가 missing이고 초과 보고는 음수가 되지 않는다', () => {
  const f = fixture();
  writeLedger(f.ledgerFile, {
    integrated: [],
    decisions: [
      { kind: 'worker-model', role: 'debugger', model: 'inherit', task: '001' },
      { kind: 'worker-model', role: 'debugger', model: 'inherit', task: '001' },
      { kind: 'worker-model', role: 'implementer', model: 'inherit', task: '002' },
      { kind: 'worker-tokens', role: 'implementer', tokens: 7, task: '002' },
      { kind: 'worker-tokens', role: 'implementer', tokens: 3, task: '002' },
    ],
  });
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT, resolveLedger: () => f.ledgerFile });
  assert.deepStrictEqual(summary.worker_tokens.by_role.debugger, { total: 0, missing: 2 });
  assert.deepStrictEqual(summary.worker_tokens.by_role.implementer, { total: 10, missing: 0 });
  assert.deepStrictEqual(
    { total: summary.worker_tokens.total, missing: summary.worker_tokens.missing },
    { total: 10, missing: 2 },
  );
});

test('summarize worker_tokens → an unreported worker-tokens fills no total and stays missing', () => {
  const f = fixture();
  writeLedger(f.ledgerFile, {
    integrated: [],
    decisions: [
      { kind: 'worker-model', role: 'reviewer', model: 'inherit', task: '001', perspective: 'security' },
      { kind: 'worker-tokens', role: 'reviewer', unreported: true, task: '001', perspective: 'security' },
    ],
  });
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT, resolveLedger: () => f.ledgerFile });
  assert.deepStrictEqual(summary.worker_tokens.by_role.reviewer, { total: 0, missing: 1 });
  assert.deepStrictEqual(
    { total: summary.worker_tokens.total, missing: summary.worker_tokens.missing },
    { total: 0, missing: 1 },
  );
});

test('pendingWorkerTokenKeys → lists a worker-model key that has no token record', () => {
  const pending = metrics.pendingWorkerTokenKeys([
    { kind: 'worker-model', role: 'reviewer', model: 'm', perspective: 'combined' },
  ]);
  assert.deepStrictEqual(pending, [{ task: null, role: 'reviewer', perspective: 'combined', pending: 1 }]);
});

test('pendingWorkerTokenKeys → an unreported or numeric worker-tokens record fills its key', () => {
  const pending = metrics.pendingWorkerTokenKeys([
    { kind: 'worker-model', role: 'reviewer', model: 'm', perspective: 'combined' },
    { kind: 'worker-tokens', role: 'reviewer', unreported: true, perspective: 'combined' },
    { kind: 'worker-model', role: 'implementer', model: 'inherit', task: '002' },
    { kind: 'worker-tokens', role: 'implementer', tokens: 7, task: '002' },
  ]);
  assert.deepStrictEqual(pending, []);
});

test('pendingWorkerTokenKeys → a worker-tokens record with no worker-model yields no key', () => {
  const pending = metrics.pendingWorkerTokenKeys([
    { kind: 'worker-tokens', role: 'debugger', unreported: true, task: '003' },
  ]);
  assert.deepStrictEqual(pending, []);
});

test('summarize worker_tokens → 원장이 없거나 resolveLedger가 없으면 total 0 missing 0이다', () => {
  const f = fixture();
  const zero = {
    total: 0, missing: 0,
    by_role: {
      implementer: { total: 0, missing: 0 }, reviewer: { total: 0, missing: 0 }, debugger: { total: 0, missing: 0 },
    },
  };
  assert.deepStrictEqual(
    metrics.summarize({ file: f.file, blueprint: BLUEPRINT, resolveLedger: () => f.ledgerFile }).worker_tokens, zero,
  );
  assert.deepStrictEqual(metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).worker_tokens, zero);
  // 숫자 계약은 0 그대로이고, 저장 snapshot이 없다는 사실은 source로 구별한다.
  assert.strictEqual(
    metrics.summarize({ file: f.file, blueprint: BLUEPRINT, resolveLedger: () => f.ledgerFile }).worker_tokens_source,
    'unavailable',
  );
});

test('metrics CLI summary → 원장의 worker-tokens를 worker_tokens로 낸다', () => {
  const repo = tmp();
  const { execFileSync } = require('node:child_process');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const { coordinatorPathsFor } = require('../packages/cli/dist/runtime-state');
  const { ledgerFile } = coordinatorPathsFor({ repoRoot: repo, blueprint: BLUEPRINT });
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
  writeLedger(ledgerFile, {
    integrated: [], decisions: [{ kind: 'worker-tokens', role: 'implementer', tokens: 11 }],
  });
  const buf = { out: '', err: '' };
  const io = { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } };
  assert.strictEqual(runCli(['metrics', 'summary', '--blueprint', BLUEPRINT, '--repo', repo], io), 0, buf.err);
  assert.strictEqual(JSON.parse(buf.out).worker_tokens.by_role.implementer.total, 11);
});

// 끝난 세션 기록을 직접 만든다. 필드를 생략하면 legacy 기록(필드 부재)이 된다.
function endedSession(id, extra, kind = 'coordinator-session') {
  return {
    id, kind, blueprint: BLUEPRINT, label: null,
    started_at: '2026-01-01T00:00:00.000Z', ended_at: '2026-01-01T00:00:01.000Z', ...extra,
  };
}

test('summary → 토큰·시간이 전부 누락이면 total은 null이고 missing이 세션 수다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [endedSession('m-1', {}), endedSession('m-2', { tokens: null, wall_ms: null })],
  }));
  const cs = metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).kinds['coordinator-session'];
  assert.deepStrictEqual(
    [cs.tokens_total, cs.input_tokens_total, cs.output_tokens_total, cs.host_duration_ms_total, cs.wall_ms_total],
    [null, null, null, null, null],
  );
  assert.deepStrictEqual(
    [cs.tokens_missing, cs.input_tokens_missing, cs.output_tokens_missing, cs.host_duration_ms_missing, cs.wall_ms_missing],
    [2, 2, 2, 2, 2],
  );
});

test('summary → 명시적 0은 유효한 관측값이라 total 0이고 missing이 아니다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [endedSession('m-1', {
      tokens: 0, input_tokens: 0, output_tokens: 0, host_duration_ms: 0, wall_ms: 0,
    })],
  }));
  const cs = metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).kinds['coordinator-session'];
  assert.deepStrictEqual(
    [cs.tokens_total, cs.input_tokens_total, cs.output_tokens_total, cs.host_duration_ms_total, cs.wall_ms_total],
    [0, 0, 0, 0, 0],
  );
  assert.strictEqual(cs.tokens_missing + cs.input_tokens_missing + cs.wall_ms_missing, 0);
});

test('summary → input만 준 세션과 output만 준 세션은 알려진 합과 missing을 함께 낸다', () => {
  const f = fixture();
  const s1 = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => 'd1d1d1d1d1d1d1d1',
  });
  metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: s1.id, pricing: {}, inputTokens: 30,
    now: clock('2026-01-01T00:00:01Z'),
  });
  const s2 = metrics.startSession({
    file: f.file, ledgerFile: f.ledgerFile, kind: 'coordinator-session', blueprint: BLUEPRINT,
    now: clock('2026-01-01T00:00:00Z'), randomId: () => 'd2d2d2d2d2d2d2d2',
  });
  metrics.endSession({
    file: f.file, resolveLedger: () => f.ledgerFile, id: s2.id, pricing: {}, outputTokens: 5,
    now: clock('2026-01-01T00:00:01Z'),
  });
  const cs = metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).kinds['coordinator-session'];
  assert.deepStrictEqual(
    [cs.input_tokens_total, cs.input_tokens_missing, cs.output_tokens_total, cs.output_tokens_missing],
    [30, 1, 5, 1],
  );
  // 한쪽 split만 있는 세션은 총합을 추정하지 않으므로 tokens는 전부 누락이다.
  assert.deepStrictEqual([cs.tokens_total, cs.tokens_missing], [null, 2]);
});

test('summary → host_duration_ms 없이 wall_ms만 있으면 wall만 합산하고 host는 누락이다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [
      endedSession('m-1', { wall_ms: 4000 }),
      endedSession('m-2', { wall_ms: 1000, host_duration_ms: 9000 }),
    ],
  }));
  const cs = metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).kinds['coordinator-session'];
  assert.deepStrictEqual([cs.wall_ms_total, cs.wall_ms_missing], [5000, 0]);
  assert.deepStrictEqual([cs.host_duration_ms_total, cs.host_duration_ms_missing], [9000, 1]);
});

test('summary → wall_ms 필드가 없는 legacy 세션은 0으로 접지 않고 wall_ms_missing으로 센다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [endedSession('m-1', { tokens: 10 }), endedSession('m-2', { wall_ms: 2000 })],
  }));
  const cs = metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).kinds['coordinator-session'];
  assert.deepStrictEqual([cs.wall_ms_total, cs.wall_ms_missing], [2000, 1]);
});

test('summary → 열린 세션은 완료 합계와 missing에 넣지 않는다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [endedSession('m-1', { ended_at: null }), endedSession('m-2', { tokens: 5, wall_ms: 10 })],
  }));
  const cs = metrics.summarize({ file: f.file, blueprint: BLUEPRINT }).kinds['coordinator-session'];
  assert.deepStrictEqual([cs.sessions, cs.open], [2, 1]);
  assert.deepStrictEqual([cs.tokens_total, cs.tokens_missing, cs.wall_ms_missing], [5, 0, 0]);
});

test('summary → coordinator 토큰과 역할별 worker 토큰은 이중 합산 없이 따로 나오고 cache는 총합에 안 더한다', () => {
  const f = fixture();
  fs.writeFileSync(f.file, JSON.stringify({
    version: 1,
    sessions: [endedSession('m-1', { tokens: 1000, cache_read_tokens: 500, cache_write_tokens: 200, wall_ms: 1 })],
  }));
  writeLedger(f.ledgerFile, {
    integrated: [],
    decisions: [
      { kind: 'worker-model', role: 'implementer', model: 'inherit', task: '001', tokens: 100 },
      { kind: 'worker-model', role: 'reviewer', model: 'inherit', task: '001', perspective: 'security' },
      { kind: 'worker-tokens', role: 'reviewer', tokens: 40, task: '001', perspective: 'security' },
      { kind: 'worker-model', role: 'debugger', model: 'inherit', task: '001' },
    ],
  });
  const summary = metrics.summarize({ file: f.file, blueprint: BLUEPRINT, resolveLedger: () => f.ledgerFile });
  assert.strictEqual(summary.kinds['coordinator-session'].tokens_total, 1000);
  assert.deepStrictEqual(summary.worker_tokens, {
    total: 140, missing: 1,
    by_role: {
      implementer: { total: 100, missing: 0 },
      reviewer: { total: 40, missing: 0 },
      debugger: { total: 0, missing: 1 },
    },
  });
  assert.deepStrictEqual(summary.cache, { read: { total: 500, missing: 0 }, write: { total: 200, missing: 0 } });
});

// --- worker 집계 snapshot ---

function gitRepoWithLedger(decisions) {
  const repo = fs.realpathSync(tmp());
  require('node:child_process').execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const { ledgerFile } = require('../packages/cli/dist/runtime-state').coordinatorPathsFor({
    repoRoot: repo, blueprint: BLUEPRINT,
  });
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
  if (decisions) writeLedger(ledgerFile, { integrated: [], decisions });
  return { repo, ledgerFile };
}

function cli(repo, ...args) {
  const buf = { out: '', err: '' };
  const code = runCli([...args, '--repo', repo], {
    out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; },
  });
  return { code, json: buf.out ? JSON.parse(buf.out) : null, err: buf.err };
}

const worker = (tokens) => ({ kind: 'worker-model', role: 'implementer', model: 'inherit', task: '001', tokens });

test('worker 100 토큰 원장에서 snapshot 저장 뒤 원장을 지우면 → summary가 snapshot의 100을 복원하고 source를 snapshot으로 낸다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(saved.code, 0);
  assert.strictEqual(saved.json.ok, true);
  assert.strictEqual(saved.json.reused, false);
  assert.strictEqual(saved.json.blueprint, BLUEPRINT);
  assert.match(saved.json.ledger_sha256, /^[a-f0-9]{64}$/);
  assert.ok(saved.json.path.startsWith(path.join(repo, '.git')), saved.json.path);
  const live = cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT);
  assert.strictEqual(live.json.worker_tokens_source, 'ledger');
  fs.rmSync(ledgerFile);
  const restored = cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT);
  assert.strictEqual(restored.code, 0);
  assert.strictEqual(restored.json.worker_tokens_source, 'snapshot');
  assert.strictEqual(restored.json.worker_tokens.total, 100);
  assert.deepStrictEqual(restored.json.worker_tokens, live.json.worker_tokens);
});

test('원장도 snapshot도 없는 summary → 0과 source unavailable을 낸다', () => {
  const { repo } = gitRepoWithLedger(null);
  const r = cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT);
  assert.strictEqual(r.json.worker_tokens.total, 0);
  assert.strictEqual(r.json.worker_tokens_source, 'unavailable');
});

test('원장이 남아 있으면 → 오래된 snapshot 대신 live 원장 값과 source ledger를 낸다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  writeLedger(ledgerFile, { integrated: [], decisions: [worker(5)] });
  const r = cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT);
  assert.strictEqual(r.json.worker_tokens.total, 5);
  assert.strictEqual(r.json.worker_tokens_source, 'ledger');
});

test('같은 원장 hash로 snapshot을 다시 부르면 → reused true이고 파일 바이트가 그대로다', () => {
  const { repo } = gitRepoWithLedger([worker(100)]);
  const first = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const before = fs.readFileSync(first.json.path);
  const second = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(second.json.reused, true);
  assert.strictEqual(second.json.ledger_sha256, first.json.ledger_sha256);
  assert.deepStrictEqual(fs.readFileSync(second.json.path), before);
});

test('원장이 바뀐 뒤 snapshot을 부르면 → reused false로 새 hash와 새 합계를 저장한다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const first = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  writeLedger(ledgerFile, { integrated: [], decisions: [worker(100), worker(20)] });
  const second = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(second.json.reused, false);
  assert.notStrictEqual(second.json.ledger_sha256, first.json.ledger_sha256);
  assert.strictEqual(JSON.parse(fs.readFileSync(second.json.path, 'utf8')).worker_tokens.total, 120);
});

test('원장 없이 snapshot을 다시 부르면 → 기존 저장값을 보존하고 reused true를 낸다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const first = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const before = fs.readFileSync(first.json.path);
  fs.rmSync(ledgerFile);
  const again = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(again.code, 0);
  assert.strictEqual(again.json.reused, true);
  assert.strictEqual(again.json.ledger_sha256, first.json.ledger_sha256);
  assert.deepStrictEqual(fs.readFileSync(first.json.path), before);
});

test('snapshot도 원장도 없는 snapshot 요청 → metrics-ledger-unavailable로 거절하고 파일을 쓰지 않는다', () => {
  const { repo } = gitRepoWithLedger(null);
  const r = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(r.code, 1);
  assert.deepStrictEqual(r.json, { ok: false, reason: 'metrics-ledger-unavailable' });
  assert.ok(!fs.existsSync(path.join(repo, '.git', 'bouncer', 'metrics-snapshots')));
});

test('깨진 JSON snapshot → summary와 snapshot이 metrics-snapshot-invalid로 거절하고 파일을 덮지 않는다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  fs.writeFileSync(saved.json.path, '{');
  fs.rmSync(ledgerFile);
  const summary = cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT);
  assert.strictEqual(summary.code, 1);
  assert.deepStrictEqual(summary.json, { ok: false, reason: 'metrics-snapshot-invalid' });
  writeLedger(ledgerFile, { integrated: [], decisions: [worker(1)] });
  assert.deepStrictEqual(cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT).json,
    { ok: false, reason: 'metrics-snapshot-invalid' });
  assert.strictEqual(fs.readFileSync(saved.json.path, 'utf8'), '{');
});

test('다른 blueprint의 내용을 담은 snapshot → metrics-snapshot-invalid로 거절한다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const body = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  body.blueprint = '.bouncer/context/epics/098-a/blueprints/002-other';
  fs.writeFileSync(saved.json.path, JSON.stringify(body));
  fs.rmSync(ledgerFile);
  assert.deepStrictEqual(cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT).json,
    { ok: false, reason: 'metrics-snapshot-invalid' });
});

test('snapshot 파일이 범위 밖을 가리키는 symlink → metrics-snapshot-invalid로 거절한다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const outside = path.join(tmp(), 'outside.json');
  fs.copyFileSync(saved.json.path, outside);
  fs.rmSync(saved.json.path);
  fs.symlinkSync(outside, saved.json.path);
  fs.rmSync(ledgerFile);
  assert.deepStrictEqual(cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT).json,
    { ok: false, reason: 'metrics-snapshot-invalid' });
});

test('snapshot 디렉터리가 Git common dir 밖으로 향하는 symlink → snapshot이 metrics-snapshot-invalid로 거절하고 밖에 쓰지 않는다', () => {
  const { repo } = gitRepoWithLedger([worker(100)]);
  const outsideDir = tmp();
  fs.mkdirSync(path.join(repo, '.git', 'bouncer'), { recursive: true });
  fs.symlinkSync(outsideDir, path.join(repo, '.git', 'bouncer', 'metrics-snapshots'));
  assert.deepStrictEqual(cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT).json,
    { ok: false, reason: 'metrics-snapshot-invalid' });
  assert.deepStrictEqual(fs.readdirSync(outsideDir), []);
});

test('writeFileSync가 실패하는 저장 → metrics-snapshot-write-failed로 거절하고 기존 snapshot을 그대로 둔다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const first = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const before = fs.readFileSync(first.json.path);
  writeLedger(ledgerFile, { integrated: [], decisions: [worker(100), worker(9)] });
  const failing = {
    readFileSync: fs.readFileSync,
    renameSync: fs.renameSync,
    writeFileSync: () => { throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); },
  };
  const r = metrics.saveWorkerSnapshot({
    commonGitDir: path.join(repo, '.git'), ledgerFile, blueprint: BLUEPRINT, fs: failing,
  });
  assert.deepStrictEqual(r, { ok: false, reason: 'metrics-snapshot-write-failed' });
  assert.deepStrictEqual(fs.readFileSync(first.json.path), before);
});

test('.git/bouncer가 외부 디렉터리 symlink이고 metrics-snapshots가 없는 저장 → metrics-snapshot-invalid로 거절하고 외부에 아무것도 만들지 않는다', () => {
  const { repo } = gitRepoWithLedger([worker(100)]);
  const outsideDir = tmp();
  fs.symlinkSync(outsideDir, path.join(repo, '.git', 'bouncer'));
  assert.deepStrictEqual(cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT).json,
    { ok: false, reason: 'metrics-snapshot-invalid' });
  assert.deepStrictEqual(fs.readdirSync(outsideDir), []);
});

test('temp 경로에 외부 파일 symlink가 놓인 재저장 → metrics-snapshot-write-failed로 거절하고 외부·기존 snapshot 바이트를 보존한다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const first = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  // 정상 저장은 자신의 temp를 남기지 않는다.
  assert.deepStrictEqual(fs.readdirSync(path.dirname(first.json.path)), [path.basename(first.json.path)]);
  const before = fs.readFileSync(first.json.path);
  const outside = path.join(tmp(), 'outside.txt');
  fs.writeFileSync(outside, 'outside bytes');
  const planted = `${first.json.path}.${process.pid}.tmp`;
  fs.symlinkSync(outside, planted);
  writeLedger(ledgerFile, { integrated: [], decisions: [worker(100), worker(9)] });
  const r = metrics.saveWorkerSnapshot({
    commonGitDir: path.join(repo, '.git'), ledgerFile, blueprint: BLUEPRINT,
  });
  assert.deepStrictEqual(r, { ok: false, reason: 'metrics-snapshot-write-failed' });
  assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'outside bytes');
  assert.deepStrictEqual(fs.readFileSync(first.json.path), before);
  // 남이 심은 symlink는 우리 temp가 아니므로 지우지 않는다.
  assert.ok(fs.lstatSync(planted).isSymbolicLink());
});

// 실제 fs 메서드를 기본으로 두고 일부만 덮어쓰는 주입 객체. 기존 3-method 모양에 optional 메서드를 얹는다.
function seam(overrides) {
  return {
    readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, ...overrides,
  };
}

function savedThenChangedLedger() {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const first = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  writeLedger(ledgerFile, { integrated: [], decisions: [worker(100), worker(9)] });
  const commonGitDir = path.join(repo, '.git');
  return {
    first, before: fs.readFileSync(first.json.path), dir: path.dirname(first.json.path),
    save: (fsx) => metrics.saveWorkerSnapshot({ commonGitDir, ledgerFile, blueprint: BLUEPRINT, fs: fsx }),
    commonGitDir,
  };
}

const fsError = (code) => Object.assign(new Error(code), { code });

test('경계 검사·snapshot 읽기에서 EACCES·EISDIR가 나는 저장 → 던지지 않고 metrics-snapshot-invalid를 반환한다', () => {
  const f = savedThenChangedLedger();
  const cases = {
    'base realpath EACCES': { realpathSync: (p) => {
      if (p === f.commonGitDir) throw fsError('EACCES');
      return fs.realpathSync(p);
    } },
    'ancestor realpath EACCES': { realpathSync: (p) => {
      if (p === f.dir) throw fsError('EACCES');
      return fs.realpathSync(p);
    } },
    'ancestor lstat EACCES': { realpathSync: (p) => {
      if (p === f.dir) throw fsError('ENOENT');
      return fs.realpathSync(p);
    }, lstatSync: (p) => {
      if (p === f.dir) throw fsError('EACCES');
      return fs.lstatSync(p);
    } },
    'file lstat EACCES': { lstatSync: (p) => {
      if (p === f.first.json.path) throw fsError('EACCES');
      return fs.lstatSync(p);
    } },
    'snapshot read EISDIR': { readFileSync: (p, enc) => {
      if (p === f.first.json.path) throw fsError('EISDIR');
      return fs.readFileSync(p, enc);
    } },
    'snapshot read EACCES': { readFileSync: (p, enc) => {
      if (p === f.first.json.path) throw fsError('EACCES');
      return fs.readFileSync(p, enc);
    } },
  };
  for (const [name, overrides] of Object.entries(cases)) {
    assert.deepStrictEqual(f.save(seam(overrides)), { ok: false, reason: 'metrics-snapshot-invalid' }, name);
    assert.deepStrictEqual(fs.readFileSync(f.first.json.path), f.before, name);
  }
  assert.deepStrictEqual(fs.readdirSync(f.dir), [path.basename(f.first.json.path)]);
});

test('mkdir·temp 쓰기·rename이 실패하는 저장 → metrics-snapshot-write-failed이고 기존 snapshot과 temp 상태를 보존한다', () => {
  for (const code of ['EACCES', 'ENOSPC']) {
    const f = savedThenChangedLedger();
    let writes = 0;
    const r = f.save(seam({
      mkdirSync: () => { throw fsError(code); },
      writeFileSync: () => { writes += 1; },
    }));
    assert.deepStrictEqual(r, { ok: false, reason: 'metrics-snapshot-write-failed' }, code);
    assert.strictEqual(writes, 0, code);
    assert.deepStrictEqual(fs.readFileSync(f.first.json.path), f.before, code);
    assert.deepStrictEqual(fs.readdirSync(f.dir), [path.basename(f.first.json.path)], code);
  }
  const w = savedThenChangedLedger();
  assert.deepStrictEqual(w.save(seam({ writeFileSync: () => { throw fsError('EACCES'); } })),
    { ok: false, reason: 'metrics-snapshot-write-failed' });
  assert.deepStrictEqual(fs.readFileSync(w.first.json.path), w.before);
  const rn = savedThenChangedLedger();
  assert.deepStrictEqual(rn.save(seam({ renameSync: () => { throw fsError('EXDEV'); } })),
    { ok: false, reason: 'metrics-snapshot-write-failed' });
  assert.deepStrictEqual(fs.readFileSync(rn.first.json.path), rn.before);
  // rename 실패 때 자신이 만든 temp는 지워진다.
  assert.deepStrictEqual(fs.readdirSync(rn.dir), [path.basename(rn.first.json.path)]);
});

test('저장 중 프로그래밍 오류(TypeError) → I/O 실패로 삼키지 않고 그대로 던진다', () => {
  const f = savedThenChangedLedger();
  assert.throws(() => f.save(seam({ writeFileSync: () => { throw new TypeError('bug'); } })), TypeError);
});

test('deps.now 시계를 주입한 저장 → recorded_at이 그 시각이다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(1)]);
  const r = metrics.saveWorkerSnapshot({
    commonGitDir: path.join(repo, '.git'), ledgerFile, blueprint: BLUEPRINT,
    now: () => new Date('2026-02-03T04:05:06.000Z'),
  });
  assert.strictEqual(JSON.parse(fs.readFileSync(r.path, 'utf8')).recorded_at, '2026-02-03T04:05:06.000Z');
});

test('metrics snapshot의 --blueprint 누락·모르는 플래그 → 각각 exit 1 invalid와 exit 2 usage를 낸다', () => {
  const { repo } = gitRepoWithLedger(null);
  assert.deepStrictEqual(cli(repo, 'metrics', 'snapshot').json, { ok: false, reason: 'invalid-metrics-input' });
  assert.strictEqual(cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT, '--tokens', '1').code, 2);
});

test('metrics summary의 report → BOUNCER_METRICS_REPORT=1일 때만 true다', () => {
  const repo = tmp();
  require('node:child_process').execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const run = (env) => {
    const saved = process.env.BOUNCER_METRICS_REPORT;
    if (env === undefined) delete process.env.BOUNCER_METRICS_REPORT;
    else process.env.BOUNCER_METRICS_REPORT = env;
    try {
      const buf = { out: '' };
      const io = { out: (s) => { buf.out += s; }, err: () => {} };
      assert.strictEqual(runCli(['metrics', 'summary', '--blueprint', BLUEPRINT, '--repo', repo], io), 0);
      return JSON.parse(buf.out).report;
    } finally {
      if (saved === undefined) delete process.env.BOUNCER_METRICS_REPORT;
      else process.env.BOUNCER_METRICS_REPORT = saved;
    }
  };
  assert.deepStrictEqual([run(undefined), run('0'), run('1')], [false, false, true]);
});

// ---- tier·effort 저장과 plan kind 세션 바인딩 ----

const PLAN_KINDS = ['plan-coordinator-session', 'planner-session'];
const ALL_KINDS = ['coordinator-session', 'context-review', 'root-direct-session', ...PLAN_KINDS];

function startArgs(kind) {
  const args = ['metrics', 'start', '--kind', kind];
  if (PLAN_KINDS.includes(kind)) return args;
  args.push('--blueprint', BLUEPRINT);
  if (kind === 'context-review') args.push('--target-digest', DIGEST);
  return args;
}

function metricsFileOf(repo) {
  return path.join(repo, '.bouncer', 'runtime', 'drive-metrics.json');
}

function sessionsOf(repo) {
  return JSON.parse(fs.readFileSync(metricsFileOf(repo), 'utf8')).sessions;
}

for (const kind of ALL_KINDS) {
  test(`${kind} end에 --tier standard --effort high → 세션에 tier·effort가 저장되고 생략하면 null이다`, () => {
    const { repo } = gitRepoWithLedger([]);
    const withFlags = cli(repo, ...startArgs(kind));
    const without = cli(repo, ...startArgs(kind));
    const bind = PLAN_KINDS.includes(kind) ? ['--blueprint', BLUEPRINT] : [];
    assert.strictEqual(cli(repo, 'metrics', 'end', '--id', withFlags.json.id, '--tier', 'standard',
      '--effort', 'high', ...bind).code, 0);
    assert.strictEqual(cli(repo, 'metrics', 'end', '--id', without.json.id, ...bind).code, 0);
    const [a, b] = sessionsOf(repo);
    assert.deepStrictEqual([a.tier, a.effort, b.tier, b.effort], ['standard', 'high', null, null]);
  });
}

for (const [flag, value] of [['--tier', 'Strong'], ['--tier', ''], ['--effort', 'max'], ['--effort', '']]) {
  test(`end ${flag} "${value}" → invalid-metrics-input, exit 1, 파일 bytes 불변`, () => {
    const { repo } = gitRepoWithLedger([]);
    const started = cli(repo, ...startArgs('root-direct-session'));
    const before = fs.readFileSync(metricsFileOf(repo));
    const r = cli(repo, 'metrics', 'end', '--id', started.json.id, flag, value);
    assert.strictEqual(r.code, 1);
    assert.deepStrictEqual(r.json, { ok: false, reason: 'invalid-metrics-input' });
    assert.deepStrictEqual(fs.readFileSync(metricsFileOf(repo)), before);
  });
}

for (const kind of PLAN_KINDS) {
  test(`${kind} blueprint 없이 start 뒤 end --blueprint plans/x/ → blueprint가 한 번 묶이고 summary에 잡힌다`, () => {
    const { repo } = gitRepoWithLedger([]);
    const started = cli(repo, ...startArgs(kind));
    assert.strictEqual(started.code, 0);
    const open = sessionsOf(repo)[0];
    assert.strictEqual(open.blueprint, null);
    assert.strictEqual(Object.hasOwn(open, 'start'), false);
    assert.strictEqual(cli(repo, 'metrics', 'end', '--id', started.json.id, '--blueprint', 'plans/x/').code, 0);
    const done = sessionsOf(repo)[0];
    assert.strictEqual(done.blueprint, 'plans/x');
    assert.strictEqual(Object.hasOwn(done, 'end'), false);
    const summary = cli(repo, 'metrics', 'summary', '--blueprint', 'plans/x').json;
    assert.strictEqual(summary.kinds[kind].sessions, 1);
  });
}

test('planner-session을 ledger로 풀리지 않는 --blueprint plans/y/로 start → 성공하고 plans/y로 저장한다', () => {
  const { repo } = gitRepoWithLedger([]);
  const r = cli(repo, 'metrics', 'start', '--kind', 'planner-session', '--blueprint', 'plans/y/');
  assert.strictEqual(r.code, 0);
  assert.strictEqual(sessionsOf(repo)[0].blueprint, 'plans/y');
});

test('plan kind가 아닌 kind를 --blueprint 없이 start → invalid-metrics-input이다', () => {
  const { repo } = gitRepoWithLedger([]);
  const r = cli(repo, 'metrics', 'start', '--kind', 'root-direct-session');
  assert.deepStrictEqual([r.code, r.json], [1, { ok: false, reason: 'invalid-metrics-input' }]);
});

test('바인딩 end가 잘못된 경우 → 각각 invalid-metrics-input, exit 1, 파일 bytes 불변', () => {
  const { repo } = gitRepoWithLedger([]);
  const unbound = cli(repo, ...startArgs('planner-session')).json.id;
  const bound = cli(repo, 'metrics', 'start', '--kind', 'planner-session', '--blueprint', 'plans/z').json.id;
  const coordinator = cli(repo, ...startArgs('coordinator-session')).json.id;
  const attempts = [
    ['end', '--id', unbound],
    ['end', '--id', unbound, '--blueprint', ''],
    ['end', '--id', bound, '--blueprint', 'plans/other'],
    ['end', '--id', coordinator, '--blueprint', 'plans/x'],
  ];
  for (const args of attempts) {
    const before = fs.readFileSync(metricsFileOf(repo));
    const r = cli(repo, 'metrics', ...args);
    assert.deepStrictEqual([r.code, r.json], [1, { ok: false, reason: 'invalid-metrics-input' }], args.join(' '));
    assert.deepStrictEqual(fs.readFileSync(metricsFileOf(repo)), before, args.join(' '));
  }
});

test('coordinator-session의 blueprint null 파일 → summary·start·end 모두 metrics-file-invalid다', () => {
  const { repo } = gitRepoWithLedger([]);
  fs.mkdirSync(path.dirname(metricsFileOf(repo)), { recursive: true });
  fs.writeFileSync(metricsFileOf(repo), JSON.stringify({
    version: 1,
    sessions: [{ id: 'm-x', kind: 'coordinator-session', blueprint: null, started_at: 'x', ended_at: null }],
  }));
  const reasons = [
    cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT),
    cli(repo, ...startArgs('root-direct-session')),
    cli(repo, 'metrics', 'end', '--id', 'm-x'),
  ].map((r) => r.json.reason);
  assert.deepStrictEqual(reasons, ['metrics-file-invalid', 'metrics-file-invalid', 'metrics-file-invalid']);
});

test('옛 세션 2개와 strong 세션 1개와 열린 세션 → by_tier가 끝난 세션만 unknown·strong으로 센다', () => {
  const { repo } = gitRepoWithLedger([]);
  const file = metricsFileOf(repo);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const legacy = (id) => ({
    id, kind: 'root-direct-session', blueprint: BLUEPRINT, label: null,
    started_at: '2026-01-01T00:00:00.000Z', ended_at: '2026-01-01T00:00:01.000Z',
    tokens: 7, cost: 1.5,
  });
  const open = { ...legacy('m-open'), ended_at: null, tier: 'strong' };
  fs.writeFileSync(file, JSON.stringify({ version: 1, sessions: [legacy('m-a'), legacy('m-b'), open] }));
  const started = cli(repo, ...startArgs('root-direct-session'));
  const ended = metrics.endSession({
    file, resolveLedger: () => null, id: started.json.id, tokens: 100, inputTokens: 40, outputTokens: 60,
    model: 'm1', pricing: { m1: { input_per_mtok: 10, output_per_mtok: 20 } }, tier: 'strong',
  });
  assert.strictEqual(ended.ok, true);
  const strongCost = sessionsOf(repo).find((s) => s.id === started.json.id).cost;
  const by = cli(repo, 'metrics', 'summary', '--blueprint', BLUEPRINT).json.kinds['root-direct-session'].by_tier;
  assert.strictEqual(by.unknown.sessions, 2);
  assert.strictEqual(by.strong.sessions, 1);
  assert.strictEqual(by.strong.tokens_total, 100);
  assert.strictEqual(by.strong.cost_total, strongCost);
  assert.deepStrictEqual([by.standard.sessions, by.light.sessions], [0, 0]);
});

for (const kind of [...PLAN_KINDS, 'root-direct-session']) {
  for (const blueprint of ['/', '\\', '//']) {
    test(`${kind} start --blueprint ${JSON.stringify(blueprint)} → invalid-metrics-input, exit 1, 파일 bytes 불변`, () => {
      const { repo } = gitRepoWithLedger([]);
      assert.strictEqual(cli(repo, ...startArgs('root-direct-session')).code, 0);
      const before = fs.readFileSync(metricsFileOf(repo));
      const r = cli(repo, 'metrics', 'start', '--kind', kind, '--blueprint', blueprint);
      assert.strictEqual(r.code, 1);
      assert.deepStrictEqual(r.json, { ok: false, reason: 'invalid-metrics-input' });
      assert.deepStrictEqual(fs.readFileSync(metricsFileOf(repo)), before);
    });
  }
}

// --- snapshot의 drive_record ---

test('새 snapshot 저장 → drive_record가 summarizeDriveRecord(원장, null)과 같다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const { summarizeDriveRecord } = require('../packages/cli/dist/drive-record');
  const snapshot = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  assert.deepStrictEqual(snapshot.drive_record, summarizeDriveRecord(ledger, null));
  assert.strictEqual(snapshot.drive_record.tasks, 1);
});

test('drive_record 없는 기존 snapshot → loadWorkerSnapshot이 ok true로 읽는다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const old = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  delete old.drive_record;
  fs.writeFileSync(saved.json.path, JSON.stringify(old));
  fs.rmSync(ledgerFile);
  const loaded = metrics.loadWorkerSnapshot({ commonGitDir: path.join(repo, '.git'), blueprint: BLUEPRINT });
  assert.strictEqual(loaded.ok, true);
  assert.strictEqual(loaded.snapshot.drive_record, undefined);
});

test('모양이 틀린 drive_record가 든 snapshot → metrics-snapshot-invalid로 거절한다', () => {
  const { repo } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const bad = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  bad.drive_record = { tasks: 'x' };
  fs.writeFileSync(saved.json.path, JSON.stringify(bad));
  const loaded = metrics.loadWorkerSnapshot({ commonGitDir: path.join(repo, '.git'), blueprint: BLUEPRINT });
  assert.deepStrictEqual(loaded, { ok: false, reason: 'metrics-snapshot-invalid' });
});

test('review를 넘긴 snapshot 저장 → drive_record.review에 그 값이 실린다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const review = { contract: 'brief', must_fix: { total: 1, resolved: 0, accepted: 0, deferred: 1, open: 0 } };
  const saved = metrics.saveWorkerSnapshot({
    commonGitDir: path.join(repo, '.git'), ledgerFile, blueprint: BLUEPRINT, review,
  });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(saved.path, 'utf8')).drive_record.review, review);
});

test('promoted_from이 있는 원장으로 snapshot 저장 → drive_record.promotion.reason이 그 값이고 summarizeDriveRecord와 같다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.promoted_from = {
    archive: 'archive.json', patch: null, diff_sha: 'd'.repeat(64), reason: 'out-of-scope', task: '001',
  };
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(saved.code, 0, saved.err);
  const { summarizeDriveRecord } = require('../packages/cli/dist/drive-record');
  const snapshot = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  assert.strictEqual(snapshot.drive_record.promotion.reason, 'out-of-scope');
  assert.deepStrictEqual(snapshot.drive_record, summarizeDriveRecord(
    JSON.parse(fs.readFileSync(ledgerFile, 'utf8')), null,
  ));
});

test('mode light 원장으로 snapshot 저장 → drive_record.mode가 light다', () => {
  const { repo, ledgerFile } = gitRepoWithLedger([worker(100)]);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.mode = 'light';
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger));
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  assert.strictEqual(saved.code, 0, saved.err);
  const snapshot = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  assert.strictEqual(snapshot.drive_record.mode, 'light');
});

test('drive_record.promotion이 { reason: 1 }인 snapshot → metrics-snapshot-invalid다', () => {
  const { repo } = gitRepoWithLedger([worker(100)]);
  const saved = cli(repo, 'metrics', 'snapshot', '--blueprint', BLUEPRINT);
  const bad = JSON.parse(fs.readFileSync(saved.json.path, 'utf8'));
  bad.drive_record = { ...bad.drive_record, promotion: { reason: 1 } };
  fs.writeFileSync(saved.json.path, JSON.stringify(bad));
  const loaded = metrics.loadWorkerSnapshot({ commonGitDir: path.join(repo, '.git'), blueprint: BLUEPRINT });
  assert.deepStrictEqual(loaded, { ok: false, reason: 'metrics-snapshot-invalid' });
});
