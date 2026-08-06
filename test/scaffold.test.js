'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint } = require('../scripts/lib/scaffold');
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
    `${base}/tasks-001.md`,
    `${base}/verification.md`,
    `${base}/review.md`,
  ]);
  assert.ok(!fs.existsSync(path.join(repo, `${base}/explain.md`)));
  const tasks = readDoc(path.join(repo, `${base}/tasks-001.md`)).data;
  assert.strictEqual(tasks.resource, `${base}/tasks-001.md`);
  assert.strictEqual(tasks.bouncer.id, 'TASKS-001');
  assert.strictEqual(tasks.bouncer.epic_id, '001');
  assert.strictEqual(tasks.bouncer.blueprint_id, '001');
  assert.strictEqual(tasks.bouncer.status, 'draft');
  assert.deepStrictEqual(tasks.bouncer.affected_paths, []);
  assert.deepStrictEqual(tasks.bouncer.graph.basis, []);
  const review = readDoc(path.join(repo, `${base}/review.md`)).data;
  assert.strictEqual(review.bouncer.id, 'REVIEW-001');
  assert.strictEqual(review.bouncer.review.required, true);
  const verify = readDoc(path.join(repo, `${base}/verification.md`)).data;
  assert.strictEqual(verify.bouncer.id, 'VERIFY-001');
  assert.strictEqual(verify.bouncer.status, 'pending');
  const bp = readDoc(path.join(repo, `${base}/index.md`)).data;
  assert.strictEqual(bp.bouncer.id, '001');
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
  assert.deepStrictEqual(data.bouncer.comprehension, {
    diff_sha: '',
    quiz_score: '',
    disposition: '',
    recorded_at: '',
  });
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

  const tasks = bodyOf(`${base}/tasks-001.md`);
  for (const heading of [
    '## Goal & intent', '## Interface', '## Touch', '## Do not touch', '## Checklist',
  ]) {
    assert.ok(tasks.includes(heading), `tasks-001.md missing ${heading}`);
  }
  const verification = bodyOf(`${base}/verification.md`);
  assert.ok(verification.includes('## Command'));
  assert.ok(verification.includes('## Evidence'));
  assert.ok(bodyOf(`${base}/review.md`).includes('## Findings'));
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
  const tasks = readDoc(path.join(repo, `${base}/tasks-001.md`)).body;
  assert.ok(!tasks.includes('team-specific prompt'));
  assert.ok(tasks.includes('## Goal & intent'));
  assert.ok(tasks.includes('Blueprint: [001](index.md)'));
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
  const tasks = readDoc(path.join(repo, `${base}/tasks-001.md`)).data;
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
