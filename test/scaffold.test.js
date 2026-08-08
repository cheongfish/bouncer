'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint, scaffoldTask } = require('../scripts/lib/scaffold');
const { readDoc } = require('../scripts/lib/frontmatter');
const { runCli } = require('../scripts/lib/cli');

const TS = '2026-07-01T00:00:00+09:00';

function captureScaffold(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('scaffoldEpic writes a valid epic index under numeric dirs', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const legacyIndex = path.join(repo, 'context/epics', 'EPIC-999-legacy/index.md');
  fs.mkdirSync(path.dirname(legacyIndex), { recursive: true });
  fs.writeFileSync(legacyIndex, 'legacy content\n');
  const created = scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  assert.strictEqual(CONTEXT_ROOT, '.bouncer/context');
  assert.deepStrictEqual(created, [
    '.bouncer/context/epics/001-auth/index.md',
    '.bouncer/context/index.md',
  ]);
  const { data } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'bouncer.epic');
  assert.strictEqual(data.bouncer.id, '001');
  assert.strictEqual(data.bouncer.epic_id, '001');
  assert.strictEqual(data.bouncer.status, 'draft');
  assert.strictEqual(data.resource, created[0]);
  assert.strictEqual(fs.readFileSync(legacyIndex, 'utf8'), 'legacy content\n');
  const bundle = fs.readFileSync(path.join(repo, '.bouncer/context/index.md'), 'utf8');
  assert.match(bundle, /\]\(epics\/001-auth\/index\.md\)/);
  assert.doesNotMatch(bundle, /EPIC-001/);
});

test('scaffoldEpic is idempotent on the bundle context index line', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  const again = scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  assert.deepStrictEqual(again, ['.bouncer/context/epics/001-auth/index.md']);
  const bundle = fs.readFileSync(path.join(repo, '.bouncer/context/index.md'), 'utf8');
  assert.strictEqual([...bundle.matchAll(/001-auth/g)].length, 1);
});

test('scaffoldBlueprint writes four plan docs (no explain) with numeric child ids', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 4);
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  assert.deepStrictEqual(created, [
    `${base}/index.md`,
    `${base}/tasks/001/tasks.md`,
    `${base}/tasks/001/verification.md`,
    `${base}/tasks/001/review.md`,
  ]);
  assert.ok(!fs.existsSync(path.join(repo, `${base}/explain.md`)));
  const tasks = readDoc(path.join(repo, `${base}/tasks/001/tasks.md`)).data;
  assert.strictEqual(tasks.resource, `${base}/tasks/001/tasks.md`);
  assert.strictEqual(tasks.bouncer.id, 'TASKS-001');
  assert.strictEqual(tasks.bouncer.epic_id, '001');
  assert.strictEqual(tasks.bouncer.blueprint_id, '001');
  assert.strictEqual(tasks.bouncer.status, 'draft');
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.deepStrictEqual(tasks.bouncer.graph.basis, []);
  const review = readDoc(path.join(repo, `${base}/tasks/001/review.md`)).data;
  assert.strictEqual(review.bouncer.id, 'REVIEW-001');
  assert.strictEqual(review.bouncer.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/tasks/001/verification.md`)).data;
  assert.strictEqual(verify.bouncer.id, 'VERIFY-001');
  assert.strictEqual(verify.bouncer.status, 'pending');
  const bp = readDoc(path.join(repo, `${base}/index.md`)).data;
  assert.strictEqual(bp.bouncer.id, '001');
});

test('scaffoldTask adds a numbered unit and refuses overwrite', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const created = scaffoldTask({
    repoRoot: repo, blueprintDir: base, taskId: '002', timestamp: TS,
  });
  assert.deepStrictEqual(created, [
    `${base}/tasks/002/tasks.md`,
    `${base}/tasks/002/verification.md`,
    `${base}/tasks/002/review.md`,
  ]);
  const tasksPath = path.join(repo, `${base}/tasks/002/tasks.md`);
  const before = fs.readFileSync(tasksPath);
  assert.throws(() => scaffoldTask({
    repoRoot: repo, blueprintDir: base, taskId: '002', timestamp: TS,
  }), /already exists/);
  assert.deepStrictEqual(fs.readFileSync(tasksPath), before);
});

// blueprint index.md의 bouncer.status를 덮어써서 잠금/비잠금 상태를 만든다.
// scaffold 자체는 draft만 쓰므로 finalize를 부르지 않고 상태만 갈아끼운다.
function setBlueprintStatus(repo, base, status) {
  const abs = path.join(repo, base, 'index.md');
  const raw = fs.readFileSync(abs, 'utf8');
  fs.writeFileSync(abs, raw.replace(/^(\s+)status: draft$/m, `$1status: ${status}`));
  assert.strictEqual(readDoc(abs).data.bouncer.status, status);
}

test('scaffoldTask refuses a closed blueprint without creating the task dir', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  setBlueprintStatus(repo, base, 'closed');
  assert.throws(() => scaffoldTask({
    repoRoot: repo, blueprintDir: base, taskId: '002', timestamp: TS,
  }), /closed/);
  // 부분 생성이 남으면 다음 scaffold가 "already exists"로 막힌다 — 디렉터리째 없어야 한다.
  assert.strictEqual(fs.existsSync(path.join(repo, base, 'tasks', '002')), false);
});

test('bouncer scaffold task exits 2 on a closed blueprint', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  setBlueprintStatus(repo, base, 'closed');
  const r = captureScaffold([
    'scaffold', 'task', '--repo', repo, '--blueprint', base, '--id', '002', '--timestamp', TS,
  ]);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /^scaffold: /m);
  assert.match(r.err, /closed/);
  // 새 blueprint를 만들라는 안내가 stderr에 함께 나와야 사용자가 다음 행동을 안다.
  assert.match(r.err, /new blueprint/);
  assert.strictEqual(fs.existsSync(path.join(repo, base, 'tasks', '002')), false);
});

test('scaffoldTask still succeeds on draft / approved / superseded blueprints', () => {
  for (const status of ['draft', 'approved', 'superseded']) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
    scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
    scaffoldBlueprint({
      repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
      blueprintId: '001', name: 'login', timestamp: TS,
    });
    const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
    setBlueprintStatus(repo, base, status);
    const created = scaffoldTask({
      repoRoot: repo, blueprintDir: base, taskId: '002', timestamp: TS,
    });
    assert.deepStrictEqual(created, [
      `${base}/tasks/002/tasks.md`,
      `${base}/tasks/002/verification.md`,
      `${base}/tasks/002/review.md`,
    ], `expected ${status} blueprint to accept a new task unit`);
  }
});

// 잠금 판정은 blueprint index.md를 읽는다. 그 파일이 없거나 깨졌을 때
// scaffold가 함께 죽으면 새 저장소 부트스트랩이 막히므로 통과시킨다.
test('scaffoldTask ignores a missing or unparsable blueprint index', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  fs.mkdirSync(path.join(repo, base), { recursive: true });
  assert.strictEqual(scaffoldTask({
    repoRoot: repo, blueprintDir: base, taskId: '002', timestamp: TS,
  }).length, 3);

  fs.writeFileSync(path.join(repo, base, 'index.md'), 'no frontmatter here\n');
  assert.strictEqual(scaffoldTask({
    repoRoot: repo, blueprintDir: base, taskId: '003', timestamp: TS,
  }).length, 3);
});

test('scaffold --id 001 succeeds; EPIC-001 / 1 / 01 fail', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const ok = captureScaffold([
    'scaffold', 'epic', '--repo', repo, '--id', '001', '--name', 'auth', '--timestamp', TS,
  ]);
  assert.strictEqual(ok.code, 0, ok.err);
  assert.ok(fs.existsSync(path.join(repo, '.bouncer/context/epics/001-auth/index.md')));

  for (const bad of ['EPIC-001', '1', '01']) {
    const r = captureScaffold([
      'scaffold', 'epic', '--repo', repo, '--id', bad, '--name', 'x', '--timestamp', TS,
    ]);
    assert.strictEqual(r.code, 2, `expected reject for --id ${bad}`);
    assert.match(r.err, /--id|three-digit|\\d\{3\}|numeric/i);
    assert.strictEqual(r.out, '');
  }
});

test('scaffoldExplain creates explain.md once for finalize with empty comprehension', () => {
  const { scaffoldExplain } = require('../scripts/lib/scaffold');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const bp = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const created = scaffoldExplain({ repoRoot: repo, blueprintDir: bp, timestamp: TS });
  assert.deepStrictEqual(created, [`${bp}/explain.md`]);
  const { data, body } = readDoc(path.join(repo, created[0]));
  assert.strictEqual(data.type, 'bouncer.explain');
  assert.strictEqual(data.bouncer.status, 'draft');
  assert.strictEqual(data.bouncer.id, 'EXPLAIN-001');
  // G15는 task 엔트리 배열을 본다. 빈 배열은 hash 불일치가 아니라 기록 없음.
  assert.deepStrictEqual(data.bouncer.comprehension, []);
  for (const heading of [
    '## Background', '## Intuition', '## Code', '## Quiz', '## 이해 상태',
  ]) {
    assert.ok(body.includes(heading), `explain.md missing ${heading}`);
  }
  assert.deepStrictEqual(
    scaffoldExplain({ repoRoot: repo, blueprintDir: bp, timestamp: TS }),
    [],
  );
});

// The headings are the skeleton the gates look for; they stay empty on purpose
// so G10/G13/G14 still require an author to fill them in.
test('scaffolded bodies carry the section skeleton the gates require', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const bodyOf = (rel) => readDoc(path.join(repo, rel)).body;

  const tasks = bodyOf(`${base}/tasks/001/tasks.md`);
  for (const heading of [
    '## Goal & intent', '## Interface', '## Touch', '## Do not touch', '## Checklist',
  ]) {
    assert.ok(tasks.includes(heading), `tasks/001/tasks.md missing ${heading}`);
  }
  const verification = bodyOf(`${base}/tasks/001/verification.md`);
  assert.ok(verification.includes('## Command'));
  assert.ok(verification.includes('## Evidence'));
  assert.ok(bodyOf(`${base}/tasks/001/review.md`).includes('## Findings'));
});

test('scaffoldBlueprint ignores a project .bouncer/templates override', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fs.mkdirSync(path.join(repo, '.bouncer/templates'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/templates/tasks.md'),
    '# <BP-id> <name> tasks\n\n## Goal & intent\nteam-specific prompt\n',
  );
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks/001/tasks.md`)).body;
  assert.ok(!tasks.includes('team-specific prompt'));
  assert.ok(tasks.includes('## Goal & intent'));
  assert.ok(tasks.includes('Blueprint: [001](../../index.md)'));
});

test('scaffoldEpic ignores a project .bouncer/templates override', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fs.mkdirSync(path.join(repo, '.bouncer/templates'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, '.bouncer/templates/epic.md'),
    '# <EPIC-id> <name>\n\nhouse epic template\n',
  );
  const created = scaffoldEpic({
    repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS,
  });
  const body = readDoc(path.join(repo, created[0])).body;
  assert.ok(!body.includes('house epic template'));
  assert.ok(body.includes('# 001 auth'));
  assert.ok(body.includes('## Intent'));
});

test('scaffoldBlueprint leaves graph.basis as empty list so G4 needs recorded evidence', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks/001/tasks.md`)).data;
  assert.deepStrictEqual(tasks.bouncer.graph.basis, []);
});

test('scaffoldBlueprint rejects a root context epic directory', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  assert.throws(() => scaffoldBlueprint({
    repoRoot: repo, epicDir: 'context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  }), /epicDir must be under \.bouncer\/context\/epics/);
  assert.ok(!fs.existsSync(path.join(repo, 'context')));
});

test('scaffoldBlueprint rejects backslash traversal outside the canonical epic', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  assert.throws(() => scaffoldBlueprint({
    repoRoot: repo,
    epicDir: '.bouncer/context/epics/001-auth\\..\\..\\escaped',
    blueprintId: '001', name: 'login', timestamp: TS,
  }), /epicDir must be under \.bouncer\/context\/epics/);
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer')));
});

test('scaffoldBlueprint rejects a legacy-prefixed epic dir', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const epicDir = '.bouncer/context/epics/' + 'EPIC-001-auth';
  fs.mkdirSync(path.join(repo, epicDir), { recursive: true });
  assert.throws(() => scaffoldBlueprint({
    repoRoot: repo, epicDir, blueprintId: '002', name: 'login', timestamp: TS,
  }), /epicDir must be under \.bouncer\/context\/epics/);
});
