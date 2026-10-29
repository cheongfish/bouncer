'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'measure-drive-records.js');
const BP_A = '.bouncer/context/epics/e/blueprints/a';
const BP_B = '.bouncer/context/epics/e/blueprints/b';
const SHA = 'a'.repeat(64);

function record(over) {
  return {
    tasks: 0, decision_kinds: {}, scope_revisions: 0, unexpected_paths: 0, overlaps: 0,
    conflicts: { fanin: 0 }, repair_waves: { ci: 0, review: 0 },
    reviewer: { dispatches: 0, perspectives: [], models: [] }, baseline: null, review: null, ...over,
  };
}

function snapshot(blueprint, workerTotal, driveRecord) {
  const base = {
    version: 1, blueprint, recorded_at: '2026-10-29T00:00:00.000Z', ledger_sha256: SHA,
    worker_tokens: { total: workerTotal, missing: 0, by_role: {} },
  };
  return driveRecord === undefined ? base : { ...base, drive_record: driveRecord };
}

function tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-measure-')));
}

// 입력 디렉터리와 세션 파일을 갖춘 fixture. 무시되어야 하는 항목(notes.txt, sub/, symlink)도 함께 둔다.
function fixture() {
  const dir = tmp();
  const input = path.join(dir, 'snaps');
  fs.mkdirSync(path.join(input, 'sub'), { recursive: true });
  const write = (name, value) => fs.writeFileSync(path.join(input, name), typeof value === 'string'
    ? value : JSON.stringify(value));
  write('a.json', snapshot(BP_A, 10, record({ tasks: 1, repair_waves: { ci: 2, review: 0 } })));
  write('b.json', snapshot(BP_B, 5, record({ tasks: 4, unexpected_paths: 3 })));
  write('broken.json', '{');
  write('old.json', snapshot('.bouncer/context/epics/e/blueprints/c', 7));
  write('shape.json', { version: 2 });
  write('badrecord.json', snapshot('.bouncer/context/epics/e/blueprints/d', 1, { tasks: 'x' }));
  write('notes.txt', 'ignore me');
  fs.writeFileSync(path.join(input, 'sub', 'x.json'), JSON.stringify(snapshot(BP_A, 99, record({ tasks: 9 }))));
  fs.symlinkSync(path.join(input, 'a.json'), path.join(input, 'link.json'));
  const sessions = path.join(dir, 'sessions.json');
  fs.writeFileSync(sessions, JSON.stringify({ version: 1, sessions: [
    { id: 's1', kind: 'coordinator-session', blueprint: BP_A, input_tokens: 60, output_tokens: 30,
      cache_read_tokens: 10, cache_write_tokens: null, cost: 0.5 },
    { id: 's2', kind: 'coordinator-session', blueprint: '.bouncer/context/epics/e/blueprints/zzz',
      input_tokens: 999, cost: 9 },
  ] }));
  return { dir, input, sessions };
}

function run(args, cwd) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: cwd ?? tmp(), encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr, json: r.stdout ? tryParse(r.stdout) : null };
}

function tryParse(text) {
  try { return JSON.parse(text); } catch (_e) { return null; }
}

test('같은 입력과 문턱으로 두 번 실행 → stdout 바이트가 같다', () => {
  const f = fixture();
  const args = ['--input', f.input, '--sessions', f.sessions, '--sweep', 'max_parallel=1,2'];
  const first = run(args, f.dir);
  const second = run(args, f.dir);
  assert.strictEqual(first.code, 0, first.err);
  assert.strictEqual(first.out, second.out);
  assert.ok(first.out.endsWith('}\n'));
});

test('snapshot 둘과 세션 파일 → worker·세션 토큰과 비용을 합산한다', () => {
  const f = fixture();
  const r = run(['--input', f.input, '--sessions', f.sessions], f.dir);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.json.totals.worker_tokens, 15);
  assert.strictEqual(r.json.totals.session_tokens, 100);
  assert.strictEqual(r.json.totals.cost, 0.5);
  assert.strictEqual(r.json.totals.drives, 2);
  assert.strictEqual(r.json.totals.tasks, 5);
  assert.strictEqual(r.json.totals.ci_repair_waves, 2);
  assert.strictEqual(r.json.totals.unexpected_paths, 3);
});

test('깨진 파일·drive_record 없는 snapshot·모양이 틀린 파일 → skipped에 사유와 함께 담고 합계에서 뺀다', () => {
  const f = fixture();
  const r = run(['--input', f.input, '--sessions', f.sessions], f.dir);
  const reasons = Object.fromEntries(r.json.skipped.map((s) => [path.basename(s.path), s.reason]));
  assert.deepStrictEqual(reasons, {
    'badrecord.json': 'not-snapshot', 'broken.json': 'invalid-json', 'old.json': 'no-drive-record',
    'shape.json': 'not-snapshot',
  });
  assert.strictEqual(r.json.skipped.filter((s) => s.reason === 'not-snapshot').length, 2);
});

test('입력 디렉터리의 notes.txt·하위 디렉터리·symlink → inputs와 skipped 어디에도 없다', () => {
  const f = fixture();
  const r = run(['--input', f.input, '--sessions', f.sessions], f.dir);
  const names = [...r.json.inputs, ...r.json.skipped].map((x) => x.path);
  for (const banned of ['notes.txt', 'sub/x.json', 'link.json']) {
    assert.ok(!names.some((n) => n.endsWith(banned)), banned);
  }
  assert.deepStrictEqual(r.json.inputs.map((i) => path.basename(i.path)), ['a.json', 'b.json']);
  assert.match(r.json.inputs[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(!r.json.inputs[0].path.includes('\\'));
});

test('같은 파일을 --input으로 두 번 → 한 번만 읽는다', () => {
  const f = fixture();
  const file = path.join(f.input, 'a.json');
  const r = run(['--input', file, '--input', file, '--sessions', f.sessions], f.dir);
  assert.strictEqual(r.json.totals.drives, 1);
  assert.strictEqual(r.json.inputs.length, 1);
});

test('direct_max_commit_tasks를 1과 5로 sweep → direct_eligible_drives가 1과 2이다', () => {
  const f = fixture();
  const r = run(['--input', f.input, '--sessions', f.sessions, '--sweep', 'direct_max_commit_tasks=1,5'], f.dir);
  assert.deepStrictEqual(r.json.sweep.map((s) => s.threshold_effects.direct_eligible_drives), [1, 2]);
  assert.deepStrictEqual(r.json.sweep.map((s) => [s.key, s.value]),
    [['direct_max_commit_tasks', 1], ['direct_max_commit_tasks', 5]]);
});

test('기본 문턱 → wave_estimate 3, ci 경보 1, 경로 경보 1이다', () => {
  const f = fixture();
  const r = run(['--input', f.input, '--sessions', f.sessions], f.dir);
  assert.strictEqual(r.json.threshold_effects.wave_estimate, 3);
  assert.strictEqual(r.json.threshold_effects.ci_repair_alert_drives, 1);
  assert.strictEqual(r.json.threshold_effects.unexpected_path_alert_drives, 1);
  assert.deepStrictEqual(r.json.thresholds, {
    direct_max_commit_tasks: 3, max_parallel: 2, ci_repair_wave_alert: 1, unexpected_path_alert: 1,
  });
  assert.strictEqual('sweep' in r.json, false);
});

test('--threshold로 max_parallel을 1로 바꿈 → wave_estimate가 task 수의 합 5이다', () => {
  const f = fixture();
  const r = run(['--input', f.input, '--sessions', f.sessions, '--threshold', 'max_parallel=1'], f.dir);
  assert.strictEqual(r.json.threshold_effects.wave_estimate, 5);
});

test('알 수 없는 키·범위 밖 값·sweep 두 번 → exit 2이다', () => {
  const f = fixture();
  const base = ['--input', f.input, '--sessions', f.sessions];
  const cases = [
    ['--threshold', 'nope=1'], ['--threshold', 'max_parallel=0'],
    ['--threshold', 'direct_max_commit_tasks=1.5'], ['--threshold', 'unexpected_path_alert=-1'],
    ['--threshold', 'ci_repair_wave_alert=abc'], ['--sweep', 'nope=1,2'], ['--sweep', 'max_parallel=1,0'],
    ['--sweep', 'max_parallel=1', '--sweep', 'max_parallel=2'],
  ];
  for (const extra of cases) {
    assert.strictEqual(run([...base, ...extra], f.dir).code, 2, extra.join(' '));
  }
});

test('없는 --input 또는 깨진·없는 --sessions → exit 1이고 입력 오류를 stderr에 낸다', () => {
  const f = fixture();
  const missing = run(['--input', path.join(f.dir, 'nope')], f.dir);
  assert.strictEqual(missing.code, 1);
  assert.match(missing.err, /^input-not-found: /);
  const broken = path.join(f.dir, 'broken-sessions.json');
  fs.writeFileSync(broken, '{');
  assert.strictEqual(run(['--input', f.input, '--sessions', broken], f.dir).code, 1);
  assert.strictEqual(run(['--input', f.input, '--sessions', path.join(f.dir, 'none.json')], f.dir).code, 1);
});

test('--sessions 없이 기본 세션 파일이 없는 저장소 → exit 0이고 session_tokens가 0이다', () => {
  const f = fixture();
  execFileSync('git', ['init', '--quiet'], { cwd: f.dir });
  const r = run(['--input', f.input], f.dir);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.json.totals.session_tokens, 0);
  assert.strictEqual(r.json.totals.cost, 0);
});

test('기본 세션 파일이 깨진 JSON → exit 1이다', () => {
  const f = fixture();
  execFileSync('git', ['init', '--quiet'], { cwd: f.dir });
  fs.mkdirSync(path.join(f.dir, '.bouncer', 'runtime'), { recursive: true });
  fs.writeFileSync(path.join(f.dir, '.bouncer', 'runtime', 'drive-metrics.json'), '{');
  assert.strictEqual(run(['--input', f.input], f.dir).code, 1);
});

test('--input 없이 실행한 git 저장소 → Git common dir의 snapshot 디렉터리를 읽는다', () => {
  const f = fixture();
  execFileSync('git', ['init', '--quiet'], { cwd: f.dir });
  const dir = path.join(f.dir, '.git', 'bouncer', 'metrics-snapshots');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(f.input, 'a.json'), path.join(dir, 'a.json'));
  const r = run([], f.dir);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(r.json.totals.drives, 1);
});

test('git 저장소가 아닌 cwd에서 --input 없이 실행 → exit 1이다', () => {
  assert.strictEqual(run([], tmp()).code, 1);
});
