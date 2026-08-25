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

test('scaffoldEpic refuses a number another epic slug already uses', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '024', name: 'lightweight-cycle', timestamp: TS });
  assert.throws(
    () => scaffoldEpic({ repoRoot: repo, epicId: '024', name: 'light-path', timestamp: TS }),
    /epic id 024 is already used by 024-lightweight-cycle/,
  );
  // 거절은 첫 쓰기 앞에 서야 한다. 뒤에 서면 epic 문서만 생기고 번들 목록은
  // 갱신되지 않은 반쪽 상태가 남는다.
  assert.strictEqual(
    fs.existsSync(path.join(repo, CONTEXT_ROOT, 'epics', '024-light-path')),
    false,
  );
  const bundle = fs.readFileSync(path.join(repo, '.bouncer/context/index.md'), 'utf8');
  assert.doesNotMatch(bundle, /024-light-path/);
});

test('scaffoldBlueprint writes five plan docs (no explain) with numeric child ids', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  const created = scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  assert.strictEqual(created.length, 5);
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  assert.deepStrictEqual(created, [
    `${base}/index.md`,
    `${base}/context-review.md`,
    `${base}/tasks/001/tasks.md`,
    `${base}/tasks/001/verification.md`,
    `${base}/tasks/001/review.md`,
  ]);
  assert.ok(!fs.existsSync(path.join(repo, `${base}/explain.md`)));
  const ctxReview = readDoc(path.join(repo, `${base}/context-review.md`)).data;
  assert.strictEqual(ctxReview.type, 'bouncer.context_review');
  assert.strictEqual(ctxReview.bouncer.id, 'CTXREVIEW-001');
  assert.strictEqual(ctxReview.bouncer.status, 'pending');
  assert.deepStrictEqual(ctxReview.bouncer.context_review, { findings: [] });
  const tasks = readDoc(path.join(repo, `${base}/tasks/001/tasks.md`)).data;
  assert.strictEqual(tasks.resource, `${base}/tasks/001/tasks.md`);
  assert.strictEqual(tasks.bouncer.id, 'TASKS-001');
  assert.strictEqual(tasks.bouncer.epic_id, '001');
  assert.strictEqual(tasks.bouncer.blueprint_id, '001');
  assert.strictEqual(tasks.bouncer.status, 'draft');
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.deepStrictEqual(tasks.bouncer.scope_evidence, {
    producer: 'graphify',
    generated_at: TS,
    suggested_paths: [],
    basis: [],
  });
  assert.strictEqual(tasks.bouncer.graph, undefined);
  const review = readDoc(path.join(repo, `${base}/tasks/001/review.md`)).data;
  assert.strictEqual(review.bouncer.id, 'REVIEW-001');
  assert.strictEqual(review.bouncer.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/tasks/001/verification.md`)).data;
  assert.strictEqual(verify.bouncer.id, 'VERIFY-001');
  assert.strictEqual(verify.bouncer.status, 'pending');
  const bp = readDoc(path.join(repo, `${base}/index.md`)).data;
  assert.strictEqual(bp.bouncer.id, '001');
  // commit_type·scale은 blueprint 전용 — scaffold 기본값이며 task·epic 문서에는 없다.
  assert.strictEqual(bp.bouncer.commit_type, 'feat');
  assert.strictEqual(bp.bouncer.scale, 'full');
  assert.strictEqual(tasks.bouncer.scale, undefined);
  assert.strictEqual(tasks.bouncer.commit_type, undefined);
  const epic = readDoc(path.join(repo, '.bouncer/context/epics/001-auth/index.md')).data;
  assert.strictEqual(epic.bouncer.scale, undefined);
  assert.strictEqual(epic.bouncer.commit_type, undefined);
  // supersedes는 epic·blueprint 전용 빈 배열. task·verification·review에는 두지 않는다.
  assert.deepStrictEqual(epic.bouncer.supersedes, []);
  assert.deepStrictEqual(bp.bouncer.supersedes, []);
  assert.strictEqual(tasks.bouncer.supersedes, undefined);
  assert.strictEqual(verify.bouncer.supersedes, undefined);
  assert.strictEqual(review.bouncer.supersedes, undefined);
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
  // G16은 BP 단일 엔트리 배열을 본다. 빈 배열은 hash 불일치가 아니라 기록 없음.
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

test('scaffoldContextReview refuses overwrite and leaves the file unchanged', () => {
  const { scaffoldContextReview } = require('../scripts/lib/scaffold');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const bp = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const abs = path.join(repo, bp, 'context-review.md');
  const before = fs.readFileSync(abs);
  assert.throws(() => scaffoldContextReview({
    repoRoot: repo, blueprintDir: bp, timestamp: TS,
  }), /already exists/);
  assert.deepStrictEqual(fs.readFileSync(abs), before);
});

test('scaffoldContextReview refuses a closed blueprint without writing the file', () => {
  const { scaffoldContextReview } = require('../scripts/lib/scaffold');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const bp = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const abs = path.join(repo, bp, 'context-review.md');
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
  setBlueprintStatus(repo, bp, 'closed');
  assert.throws(() => scaffoldContextReview({
    repoRoot: repo, blueprintDir: bp, timestamp: TS,
  }), /closed/);
  assert.strictEqual(fs.existsSync(path.join(repo, bp, 'context-review.md')), false);
});

test('bouncer scaffold context-review exits 2 without --blueprint', () => {
  const r = captureScaffold(['scaffold', 'context-review']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /scaffold context-review: --blueprint is required/);
  assert.strictEqual(r.out, '');
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
  assert.ok(bodyOf(`${base}/context-review.md`).includes('## Findings'));
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

test('scaffoldBlueprint leaves scope_evidence.basis empty so G4 needs recorded evidence', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const tasks = readDoc(path.join(repo, `${base}/tasks/001/tasks.md`)).data;
  assert.deepStrictEqual(tasks.bouncer.scope_evidence.basis, []);
  assert.strictEqual(tasks.bouncer.graph, undefined);
});

// 에이전트가 S9/G4·G18/G14 입력 모양을 빈 값과 함께 보게 한다.
// 주석 예시는 파싱되면 안 되고, 검증 값은 비워 빈 계획이 승인되지 않는다.
test('scaffold comments hint basis fields and severity without filling parsed values', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  scaffoldBlueprint({
    repoRoot: repo, epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001', name: 'login', timestamp: TS,
  });
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const tasksPath = path.join(repo, `${base}/tasks/001/tasks.md`);
  const reviewPath = path.join(repo, `${base}/tasks/001/review.md`);
  const ctxPath = path.join(repo, `${base}/context-review.md`);
  const tasksRaw = fs.readFileSync(tasksPath, 'utf8');
  const reviewRaw = fs.readFileSync(reviewPath, 'utf8');
  const ctxRaw = fs.readFileSync(ctxPath, 'utf8');

  // 본문 HTML 주석에도 같은 필드명이 있다. dump 후 YAML 치환을 빼도
  // includes('graph')는 통과하므로, 프론트매터에서 basis: [] 바로 위를 고정한다.
  const tasksFm = tasksRaw.split('---')[1] ?? '';
  assert.match(
    tasksFm,
    /^[ \t]*# - graph: source \| context[ \t]*$/m,
    'tasks.md frontmatter missing YAML graph example',
  );
  assert.match(
    tasksFm,
    /^[ \t]*#[^\n]*\n[ \t]*basis: \[\][ \t]*$/m,
    'tasks.md missing YAML comment immediately above basis: []',
  );
  assert.ok(
    tasksFm.includes('updated | reused | fail-skip | skip-disabled | missing'),
    'tasks.md frontmatter missing basis status allowed values',
  );

  for (const [label, raw] of [['review.md', reviewRaw], ['context-review.md', ctxRaw]]) {
    assert.ok(raw.includes('id'), `${label} missing finding id hint`);
    assert.ok(raw.includes('severity'), `${label} missing finding severity hint`);
    assert.ok(raw.includes('status'), `${label} missing finding status hint`);
    assert.ok(raw.includes('note'), `${label} missing accepted note hint`);
    assert.ok(
      raw.includes('blocker | major | minor | nit'),
      `${label} missing severity allowed values`,
    );
  }

  const tasks = readDoc(tasksPath).data;
  const ctxReview = readDoc(ctxPath).data;
  assert.deepStrictEqual(tasks.bouncer.scope_evidence.basis, []);
  assert.deepStrictEqual(ctxReview.bouncer.context_review.findings, []);
  assert.strictEqual(ctxReview.bouncer.status, 'pending');
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

// --- scale: light / full 분기 ---
// full은 회귀 방지가 목적이다: 파일 목록과 본문이 템플릿과 바이트 단위로 같아야
// light 분기가 기존 경로를 건드리지 않았음이 증명된다.
const { templateBody } = require('../scripts/lib/templates');

function scaffoldWith(repo, scale) {
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  return scaffoldBlueprint({
    repoRoot: repo,
    epicDir: '.bouncer/context/epics/001-auth',
    blueprintId: '001',
    name: 'login',
    timestamp: TS,
    ...(scale === undefined ? {} : { scale }),
  });
}

test('full scaffold bodies stay byte-identical to the shipped templates', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldWith(repo, undefined);
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const expected = {
    'index.md': templateBody('blueprint.md', { epicId: '001', blueprintId: '001', name: 'login' }),
    'context-review.md': templateBody('context-review.md', { epicId: '001', blueprintId: '001', name: '001' }),
    'tasks/001/tasks.md': templateBody('tasks.md', { epicId: '001', blueprintId: '001', name: '001' }),
    'tasks/001/verification.md': templateBody('verification.md', { epicId: '001', blueprintId: '001', name: '001' }),
    'tasks/001/review.md': templateBody('review.md', { epicId: '001', blueprintId: '001', name: '001' }),
  };
  for (const [rel, body] of Object.entries(expected)) {
    assert.strictEqual(readDoc(path.join(repo, base, rel)).body, body, rel);
  }
  // basis 힌트 주석은 full 계약의 일부 — light에서만 빠진다.
  const rawTasks = fs.readFileSync(path.join(repo, base, 'tasks/001/tasks.md'), 'utf8');
  assert.match(rawTasks, /# 유효 엔트리 필드: graph, status, query, result/);
});

test('--scale full and an omitted --scale produce identical trees', () => {
  const omitted = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const explicit = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const a = scaffoldWith(omitted, undefined);
  const b = scaffoldWith(explicit, 'full');
  assert.deepStrictEqual(b, a);
  for (const rel of a) {
    assert.strictEqual(
      fs.readFileSync(path.join(explicit, rel), 'utf8'),
      fs.readFileSync(path.join(omitted, rel), 'utf8'),
      rel,
    );
  }
});

test('scale light writes four plan docs and no context-review', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const created = scaffoldWith(repo, 'light');
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  assert.deepStrictEqual(created, [
    `${base}/index.md`,
    `${base}/tasks/001/tasks.md`,
    `${base}/tasks/001/verification.md`,
    `${base}/tasks/001/review.md`,
  ]);
  assert.strictEqual(fs.existsSync(path.join(repo, base, 'context-review.md')), false);
  assert.strictEqual(fs.existsSync(path.join(repo, base, 'explain.md')), false);
  const bp = readDoc(path.join(repo, base, 'index.md')).data;
  assert.strictEqual(bp.bouncer.scale, 'light');
  assert.strictEqual(bp.bouncer.commit_type, 'feat');
  // 승인 범위 증적은 light에서도 그대로 비어 있는 채로 시작한다 (G4/G5).
  const tasks = readDoc(path.join(repo, base, 'tasks/001/tasks.md')).data;
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.deepStrictEqual(tasks.bouncer.scope_evidence.basis, []);
});

test('the light plan document set stays within 100 lines total', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const created = scaffoldWith(repo, 'light');
  const total = created.reduce(
    (sum, rel) => sum + fs.readFileSync(path.join(repo, rel), 'utf8').split('\n').length - 1,
    0,
  );
  assert.ok(total <= 100, `light plan docs are ${total} lines`);
});

test('light task bodies carry only the three gated sections', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldWith(repo, 'light');
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const body = readDoc(path.join(repo, base, 'tasks/001/tasks.md')).body;
  assert.match(body, /^## Goal & intent$/m);
  assert.match(body, /^## Touch$/m);
  assert.match(body, /^## Checklist$/m);
  assert.doesNotMatch(body, /^## Interface$/m);
  assert.doesNotMatch(body, /^## Do not touch$/m);
  // 미작성 상태로는 G10을 통과할 수 없어야 한다.
  assert.match(body, /<TODO:/);
});

test('a later task on a light blueprint keeps the light template', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldWith(repo, 'light');
  const base = '.bouncer/context/epics/001-auth/blueprints/001-login';
  scaffoldTask({ repoRoot: repo, blueprintDir: base, taskId: '002', timestamp: TS });
  const body = readDoc(path.join(repo, base, 'tasks/002/tasks.md')).body;
  assert.doesNotMatch(body, /^## Interface$/m);
});

test('scaffold blueprint rejects an unknown --scale before writing anything', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  for (const bad of [['--scale', 'tiny'], ['--scale']]) {
    const r = captureScaffold([
      'scaffold', 'blueprint', '--repo', repo,
      '--epic-dir', '.bouncer/context/epics/001-auth',
      '--id', '001', '--name', 'login', '--timestamp', TS, ...bad,
    ]);
    assert.strictEqual(r.code, 2, bad.join(' '));
    assert.match(r.err, /--scale must be one of light\|full/);
    assert.strictEqual(r.out, '');
    assert.strictEqual(
      fs.existsSync(path.join(repo, '.bouncer/context/epics/001-auth/blueprints')),
      false,
    );
  }
});

test('scaffoldBlueprint throws on an unknown scale without creating the dir', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  assert.throws(() => scaffoldWith(repo, 'tiny'), /scale must be one of light \| full/);
  assert.strictEqual(
    fs.existsSync(path.join(repo, '.bouncer/context/epics/001-auth/blueprints')),
    false,
  );
});

test('bouncer scaffold blueprint --scale light exits 0 with four created paths', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  scaffoldEpic({ repoRoot: repo, epicId: '001', name: 'auth', timestamp: TS });
  const r = captureScaffold([
    'scaffold', 'blueprint', '--repo', repo,
    '--epic-dir', '.bouncer/context/epics/001-auth',
    '--id', '001', '--name', 'login', '--timestamp', TS, '--scale', 'light',
  ]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(JSON.parse(r.out).created.length, 4);
});
