'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'cli.js');
const BP = '.bouncer/context/epics/e/blueprints/b';

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-ledger-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return fs.realpathSync(dir);
}

// 실제 CLI를 자식 프로세스로 실행한다. bin 진입점이 없어도 dist/cli의 runCli를 직접 호출한다.
function cli(dir, args) {
  const code = `
    const { runCli } = require(${JSON.stringify(BIN)});
    let out = ''; let err = '';
    const status = runCli(process.argv.slice(1), { out: (s) => { out += s; }, err: (s) => { err += s; } });
    process.stdout.write(JSON.stringify({ status, out, err }));`;
  const r = spawnSync(process.execPath, ['-e', code, ...args, '--repo', dir], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const { status, out, err } = JSON.parse(r.stdout);
  return { status, err, json: out ? JSON.parse(out) : null };
}

function fileOf(dir, id) {
  return path.join(dir, '.bouncer', 'runtime', 'plan-ledgers', `${id}.json`);
}

function open(dir) {
  const r = cli(dir, ['plan-ledger', 'open', '--request', 'r']);
  return { id: r.json.id, cp: r.json.checkpoint, file: fileOf(dir, r.json.id) };
}

// mutation을 현재 checkpoint로 실행하고 새 checkpoint를 상태에 이어 붙인다.
function session(dir) {
  const s = open(dir);
  const mut = (sub, extra) => {
    const r = cli(dir, ['plan-ledger', sub, '--id', s.id, '--ledger-path', s.cp.path, '--ledger-hash', s.cp.sha256, ...extra]);
    if (r.json && r.json.ok) s.cp = r.json.checkpoint;
    return r;
  };
  const read = () => JSON.parse(fs.readFileSync(s.file, 'utf8'));
  return { ...s, mut, read, get cp() { return s.cp; } };
}

// 거절은 { ok: false, reason }, exit 1, 파일 bytes 불변을 함께 단언한다.
function rejects(s, r, reason, before) {
  assert.strictEqual(r.status, 1);
  assert.deepStrictEqual(r.json, { ok: false, reason });
  assert.deepStrictEqual(fs.readFileSync(s.file), before);
}

function reject(s, sub, extra, reason) {
  const before = fs.readFileSync(s.file);
  rejects(s, s.mut(sub, extra), reason, before);
}

test('open → 초기 내용·id 형식·checkpoint sha256을 만든다', () => {
  const dir = repo();
  const r = cli(dir, ['plan-ledger', 'open', '--request', 'r']);
  assert.strictEqual(r.status, 0);
  assert.match(r.json.id, /^pl-[a-f0-9]{16}$/);
  const file = fileOf(dir, r.json.id);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    version: 1, id: r.json.id, request: 'r', status: 'open', phase: 'discovery', blueprint: null,
    questions: [], planner: { session: null, continued: 0, revisions: 0 }, notes: [], revision: 0,
  });
  assert.deepStrictEqual(r.json.checkpoint, {
    path: `.bouncer/runtime/plan-ledgers/${r.json.id}.json`,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    revision: 0,
  });
});

test('같은 randomId로 open을 두 번 → plan-ledger-exists로 거절하고 첫 파일은 그대로다', () => {
  const dir = repo();
  const mod = require('../packages/cli/dist/cli-plan-ledger-command');
  const run = () => {
    let out = '';
    const status = mod.run(['open', '--request', 'r', '--repo', dir], { out: (s) => { out += s; }, err() {} },
      { randomId: () => '0123456789abcdef' });
    return { status, json: JSON.parse(out) };
  };
  assert.strictEqual(run().status, 0);
  const file = fileOf(dir, 'pl-0123456789abcdef');
  const before = fs.readFileSync(file);
  const second = run();
  assert.strictEqual(second.status, 1);
  assert.deepStrictEqual(second.json, { ok: false, reason: 'plan-ledger-exists' });
  assert.deepStrictEqual(fs.readFileSync(file), before);
});

test('깨진 파일 → status는 plan-ledger-invalid로 거절한다', () => {
  const dir = repo();
  const s = session(dir);
  fs.writeFileSync(s.file, '{');
  const r = cli(dir, ['plan-ledger', 'status', '--id', s.id]);
  assert.strictEqual(r.status, 1);
  assert.deepStrictEqual(r.json, { ok: false, reason: 'plan-ledger-invalid' });
});

test('phase review 뒤 checkpoint → plan-ledger-phase-backward로 거절한다', () => {
  const s = session(repo());
  assert.strictEqual(s.mut('record', ['--phase', 'review']).status, 0);
  reject(s, 'record', ['--phase', 'checkpoint'], 'plan-ledger-phase-backward');
});

test('record 성공 → revision이 1 오르고, 이전 hash 재사용은 stale-ledger-checkpoint다', () => {
  const dir = repo();
  const s = session(dir);
  const old = s.cp;
  const r = s.mut('record', ['--phase', 'checkpoint']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(s.read().revision, 1);
  assert.strictEqual(r.json.checkpoint.revision, 1);
  const before = fs.readFileSync(s.file);
  const stale = cli(dir, ['plan-ledger', 'record', '--id', s.id, '--ledger-path', old.path,
    '--ledger-hash', old.sha256, '--phase', 'authoring']);
  rejects(s, stale, 'stale-ledger-checkpoint', before);
});

test('ask·answer → qid q1, open_questions 갱신, 재답변·없는 qid는 거절한다', () => {
  const dir = repo();
  const s = session(dir);
  const asked = s.mut('ask', ['--question', 'why']);
  assert.strictEqual(asked.json.qid, 'q1');
  const status = () => cli(dir, ['plan-ledger', 'status', '--id', s.id]).json;
  assert.deepStrictEqual(status().open_questions, ['q1']);
  assert.strictEqual(s.mut('answer', ['--question-id', 'q1', '--text', 'a']).status, 0);
  assert.deepStrictEqual(status().open_questions, []);
  assert.deepStrictEqual(s.read().questions[0].answer, { text: 'a' });
  reject(s, 'answer', ['--question-id', 'q1', '--text', 'b'], 'plan-ledger-question-answered');
  reject(s, 'answer', ['--question-id', 'q9', '--text', 'b'], 'plan-ledger-question-unknown');
});

test('blueprint → 정규화해 한 번만 저장하고, 위험한 경로는 invalid-plan-ledger-input이다', () => {
  const s = session(repo());
  const r = s.mut('record', ['--blueprint', '.bouncer\\context\\epics\\e\\blueprints\\b\\']);
  assert.strictEqual(r.status, 0);
  assert.strictEqual(s.read().blueprint, BP);
  reject(s, 'record', ['--blueprint', BP], 'plan-ledger-blueprint-bound');
  const fresh = session(repo());
  for (const bad of ['/abs', 'C:\\x', '.bouncer/context/epics/..\\x', 'src/x', '']) {
    reject(fresh, 'record', ['--blueprint', bad], 'invalid-plan-ledger-input');
  }
});

test('planner 순서 → initial·resume·continued·fresh가 세션과 횟수를 규칙대로 바꾼다', () => {
  const s = session(repo());
  const planner = (session, mode) => ['--planner-session', session, '--planner-mode', mode];
  reject(s, 'record', planner('h1', 'continued'), 'invalid-plan-ledger-input');
  assert.strictEqual(s.mut('record', planner('h1', 'initial')).status, 0);
  reject(s, 'record', planner('h1', 'initial'), 'invalid-plan-ledger-input');
  assert.strictEqual(s.mut('record', planner('h2', 'resume')).status, 0);
  assert.deepStrictEqual(s.read().planner, { session: 'h2', continued: 0, revisions: 0 });
  assert.strictEqual(s.mut('record', planner('h2', 'continued')).status, 0);
  assert.deepStrictEqual(s.read().planner, { session: 'h2', continued: 1, revisions: 1 });
  reject(s, 'record', planner('h2', 'continued'), 'plan-ledger-revision-limit');
  assert.strictEqual(s.mut('record', planner('h3', 'fresh')).status, 0);
  assert.deepStrictEqual(s.read().planner, { session: 'h3', continued: 1, revisions: 2 });
  reject(s, 'record', planner('h4', 'fresh'), 'plan-ledger-revision-limit');
});

test('잘못된 입력 → invalid-plan-ledger-input으로 거절한다', () => {
  const dir = repo();
  const s = session(dir);
  const cases = [
    ['record', ['--planner-session', 'h']],
    ['record', ['--planner-mode', 'resume']],
    ['record', ['--planner-session', 'a b', '--planner-mode', 'initial']],
    ['record', []],
    ['record', ['--phase', 'done']],
    ['record', ['--note', 'x'.repeat(2001)]],
    ['ask', ['--question', '']],
    ['answer', ['--question-id', 'q1', '--text', 'x'.repeat(2001)]],
  ];
  for (const [sub, extra] of cases) reject(s, sub, extra, 'invalid-plan-ledger-input');
  const r = cli(dir, ['plan-ledger', 'open', '--request', '']);
  assert.strictEqual(r.status, 1);
  assert.deepStrictEqual(r.json, { ok: false, reason: 'invalid-plan-ledger-input' });
});

test('close 뒤 record → plan-ledger-closed로 거절한다', () => {
  const s = session(repo());
  assert.strictEqual(s.mut('close', []).status, 0);
  assert.strictEqual(s.read().status, 'closed');
  reject(s, 'record', ['--note', 'x'], 'plan-ledger-closed');
});

test('status의 잘못된 id·없는 id·git 밖 repo → 각자의 reason으로 거절한다', () => {
  const dir = repo();
  const bad = cli(dir, ['plan-ledger', 'status', '--id', 'bad']);
  assert.deepStrictEqual(bad.json, { ok: false, reason: 'plan-ledger-id-invalid' });
  const missing = cli(dir, ['plan-ledger', 'status', '--id', 'pl-0123456789abcdef']);
  assert.deepStrictEqual(missing.json, { ok: false, reason: 'plan-ledger-not-found' });
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-plan-ledger-nogit-')));
  const none = cli(outside, ['plan-ledger', 'status', '--id', 'pl-0123456789abcdef']);
  assert.strictEqual(none.status, 1);
  assert.deepStrictEqual(none.json, { ok: false, reason: 'non-git-root' });
});

test('checkpoint 인자가 어긋남 → ledger-checkpoint-invalid로 거절한다', () => {
  const dir = repo();
  const s = session(dir);
  const base = ['plan-ledger', 'record', '--id', s.id, '--note', 'x'];
  const before = fs.readFileSync(s.file);
  const variants = [
    ['--ledger-path', '.bouncer/runtime/coordinator.json', '--ledger-hash', s.cp.sha256],
    ['--ledger-path', s.cp.path],
    ['--ledger-path', s.cp.path, '--ledger-hash', 'abc'],
  ];
  for (const extra of variants) rejects(s, cli(dir, [...base, ...extra]), 'ledger-checkpoint-invalid', before);
});

test('모르는 하위 명령·플래그 → usage와 exit 2다', () => {
  const dir = repo();
  assert.strictEqual(cli(dir, ['plan-ledger', 'nope']).status, 2);
  assert.strictEqual(cli(dir, ['plan-ledger', 'open', '--request', 'r', '--bogus', 'x']).status, 2);
});
