'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const scaffold = require('../packages/cli/dist/scaffold');
const state = require('../packages/cli/dist/context-review-state');
const snapshot = require('../packages/cli/dist/plan-snapshot');
const { readDoc } = require('../packages/cli/dist/frontmatter');
const { runCli } = require('../packages/cli/dist/cli');

const epic = '.bouncer/context/epics/001-Test';
const bp = `${epic}/blueprints/001-Test`;
const task = `${bp}/tasks/001/tasks.md`;
const id = 'CR-12345678';
const timestamp = '2026-01-01T00:00:00Z';

// 공개 전이를 이용해 실제 cycle을 만들고 각 테스트가 자기 작업 트리 안에서 독립적으로 실행된다.
function fixture(t, actionability = 'must_fix', findingId = id, findingStatus = 'open') {
  const parent = path.join(__dirname, '../.bouncer/runtime');
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'contract-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  scaffold.scaffoldEpic({ repoRoot: root, epicId: '001', name: 'Test', timestamp,
    description: 'This example plans a complete review workflow.' });
  scaffold.scaffoldBlueprint({ repoRoot: root, epicDir: epic, blueprintId: '001', name: 'Test', timestamp });
  scaffold.scaffoldTask({ repoRoot: root, blueprintDir: bp, taskId: '002', timestamp });
  const index = path.join(root, bp, 'index.md');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(/^ {2}review_contract:.*\n/m, ''));
  const snap = snapshot.computePlanSnapshot({ repoRoot: root, blueprintDir: bp });
  const parts = snapshot.computePlanParts({ repoRoot: root, blueprintDir: bp });
  const dispatch = path.join(root, 'dispatch.json');
  fs.writeFileSync(dispatch, JSON.stringify({ ok: true, phase: 'plan', strategy: 'single', blueprint: bp,
    target: snap, snapshot_version: snapshot.SNAPSHOT_VERSION, ...parts }));
  assert.equal(state.startCycle({ repoRoot: root, blueprintDir: bp, dispatchFile: dispatch }).ok, true);
  const finding = { id: findingId, severity: 'major', status: findingStatus, category: 'scope', brief_clause: 'touch', file: task,
    symbol: 'touch', ...(findingStatus === 'accepted' ? { note: 'Risk explicitly accepted.' } : {}), actionability, origin: 'discovery', first_seen_round: 1, last_seen_round: 1 };
  const report = path.join(root, 'round.json');
  fs.writeFileSync(report, JSON.stringify({ round: { round: 1, mode: 'discovery', target: { digest: snap.digest },
    perspectives: [{ name: 'combined', target_digest: snap.digest }], severity_changes: [] }, findings: [finding] }));
  assert.equal(state.recordReport({ repoRoot: root, blueprintDir: bp, dispatchFile: dispatch, roundFile: report }).ok,
    true);
  fs.writeFileSync(report, JSON.stringify({ round: { round: 2, mode: 'delta', target: { digest: snap.digest },
    perspectives: [{ name: 'combined', target_digest: snap.digest }], severity_changes: [] }, findings: [] }));
  assert.equal(state.recordReport({ repoRoot: root, blueprintDir: bp, dispatchFile: dispatch, roundFile: report }).ok,
    true);
  const doc = path.join(root, task);
  const review = path.join(root, bp, 'context-review.md');
  const ns = path.join(root, '.bouncer/runtime/context-review', bp.split('/').join('__'), 'state.json');
  const dispositions = path.join(root, 'dispositions.json');
  fs.writeFileSync(dispositions, JSON.stringify([{ id: findingId, status: 'accepted', note: 'Risk explicitly accepted.' }]));
  const links = path.join(root, 'links.json');
  fs.writeFileSync(links, JSON.stringify([{ finding_id: findingId, path: task, sections: ['Interface', 'Touch'] }]));
  return { root, doc, review, ns, dispositions, links, before: parts.scope_parts[task] };
}

function changeContract(f) {
  fs.writeFileSync(f.doc, fs.readFileSync(f.doc, 'utf8').replace('## Interface', '## Interface\nChanged contract.'));
}

function close(f, extra = {}) {
  return state.closeCycle({ repoRoot: f.root, blueprintDir: bp, dispositionsFile: f.dispositions,
    acceptRisk: [id], contractLinksFile: f.links, ...extra });
}

function unchanged(f, expected, extra) {
  const before = [fs.readFileSync(f.ns), fs.readFileSync(f.review)];
  const result = close(f, extra);
  assert.equal(result.reason, expected, JSON.stringify(result));
  assert.deepEqual([fs.readFileSync(f.ns), fs.readFileSync(f.review)], before);
}

test('accepted linked contract change → records both digests and acceptance without rereview', (t) => {
  const f = fixture(t);
  changeContract(f);
  const after = snapshot.computePlanParts({ repoRoot: f.root, blueprintDir: bp }).scope_parts[task];
  const result = close(f);
  assert.equal(result.ok, true, JSON.stringify(result));
  const saved = JSON.parse(fs.readFileSync(f.ns, 'utf8')).closure;
  const projected = readDoc(f.review).data.bouncer.context_review;
  const expected = [{ finding_id: id, path: task, sections: ['Interface', 'Touch'],
    before_digest: f.before, after_digest: after }];
  assert.deepEqual(saved.contract_acceptances, expected);
  assert.deepEqual(projected.contract_acceptances, expected);
  assert.equal(result.accepted_without_rereview, true);
  assert.equal(saved.accepted_without_rereview, true);
  assert.equal(projected.accepted_without_rereview, true);
});

test('previously accepted finding without current disposition → rejects and preserves evidence', (t) => {
  const f = fixture(t, 'must_fix', id, 'accepted');
  changeContract(f);
  fs.writeFileSync(f.dispositions, '[]');
  unchanged(f, 'context-review-state-conflict');
});

test('malformed contract links → reject without changing review evidence', async (t) => {
  const cases = [
    ['non JSON', '{'], ['non array', '{}'], ['wrong section', JSON.stringify([{ finding_id: id, path: task,
      sections: ['Goal'] }])], ['duplicate path', JSON.stringify([1, 2].map(() => ({ finding_id: id, path: task,
      sections: ['Touch'] })))], ['parent traversal', JSON.stringify([{ finding_id: id, path: `${bp}/../tasks/001/tasks.md`,
      sections: ['Touch'] }])], ['index path', JSON.stringify([{ finding_id: id, path: `${bp}/index.md`,
      sections: ['Touch'] }])], ['unknown finding', JSON.stringify([{ finding_id: 'CR-deadbeef', path: task,
      sections: ['Touch'] }])],
  ];
  for (const [name, body] of cases) await t.test(`${name} → input invalid`, (s) => {
    const f = fixture(s);
    changeContract(f);
    fs.writeFileSync(f.links, body);
    unchanged(f, 'context-review-input-invalid');
  });
  await t.test('unchanged contract → input invalid', (s) => {
    const f = fixture(s);
    unchanged(f, 'context-review-input-invalid');
  });
});

test('unapproved contract changes → reject without changing review evidence', async (t) => {
  for (const [name, configure] of [
    ['no links', () => ({ contractLinksFile: undefined })],
    ['empty links', (f) => { fs.writeFileSync(f.links, '[]'); return {}; }],
    ['not in accept risk', () => ({ acceptRisk: [] })],
    ['not accepted', (f) => { fs.writeFileSync(f.dispositions, JSON.stringify([{ id, status: 'resolved' }])); return {}; }],
    ['unlinked document', (f) => {
      const other = path.join(f.root, bp, 'tasks/002/tasks.md');
      fs.writeFileSync(other, fs.readFileSync(other, 'utf8').replace('## Interface', '## Interface\nChanged.'));
      return {}; }],
    ['finding file mismatch', (f) => {
      fs.writeFileSync(f.doc, fs.readFileSync(f.doc, 'utf8').replace('## Interface\nChanged contract.', '## Interface'));
      const other = path.join(f.root, bp, 'tasks/002/tasks.md');
      fs.writeFileSync(other, fs.readFileSync(other, 'utf8').replace('## Interface', '## Interface\nChanged.'));
      fs.writeFileSync(f.links, JSON.stringify([{ finding_id: id, path: `${bp}/tasks/002/tasks.md`,
        sections: ['Touch'] }]));
      return {}; }],
    ['structure changed', (f) => { fs.appendFileSync(path.join(f.root, bp, 'index.md'), '\n## Scope\nChanged.\n');
      fs.writeFileSync(f.doc, fs.readFileSync(f.doc, 'utf8').replace('depends_on: []', 'depends_on: [TASKS-002]'));
      return {}; }],
  ]) await t.test(`${name} → state conflict`, (s) => {
    const f = fixture(s);
    changeContract(f);
    unchanged(f, 'context-review-state-conflict', configure(f));
  });
});

test('advisory finding in accept risk → unresolved findings without changing review evidence', (t) => {
  const f = fixture(t, 'advisory');
  changeContract(f);
  unchanged(f, 'context-review-unresolved-findings');
});

test('close rejection with a lagging restart marker → preserves state and review document bytes', async (t) => {
  for (const invalidLinks of [false, true]) await t.test(`${invalidLinks ? 'invalid links' : 'missing links'} → unchanged`, (s) => {
    const f = fixture(s);
    // restart의 state 저장 직후 표식 쓰기 전에 중단된 상태를 재현한다.
    const saved = JSON.parse(fs.readFileSync(f.ns, 'utf8'));
    saved.cycle.restart_count = 1;
    saved.cycle.history = [{}];
    fs.writeFileSync(f.ns, JSON.stringify(saved));
    assert.notEqual(readDoc(f.review).data.bouncer.context_review.restart_count, 1);
    changeContract(f);
    if (invalidLinks) fs.writeFileSync(f.links, '{');
    unchanged(f, invalidLinks ? 'context-review-input-invalid' : 'context-review-state-conflict',
      invalidLinks ? {} : { contractLinksFile: undefined });
  });
});

test('record with contract links → rejects the close-only flag', () => {
  let error = '';
  const code = runCli(['context-review', 'record', '--blueprint', 'example', '--dispatch', 'dispatch.json',
    '--round', 'round.json', '--contract-links', 'links.json'], { out: () => {}, err: (s) => { error += s; } });
  assert.match(error, /--contract-links is only valid for close/);
  assert.equal(code, 2);
});

// 변경이 없거나 본문만 바뀐 경우는 기존 동작 보호이므로 red가 필요하지 않다.
test('close without links and unchanged or body-only plan → preserves existing behavior', async (t) => {
  for (const bodyOnly of [false, true]) await t.test(`${bodyOnly ? 'body only' : 'unchanged'} → accepted`, (s) => {
    const f = fixture(s);
    if (bodyOnly) fs.appendFileSync(f.doc, '\n## Notes\nBody edit.\n');
    const result = close(f, { contractLinksFile: undefined });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.accepted_without_rereview, undefined);
  });
});

test('linked cycle finding with noncanonical id → input invalid without changing evidence', (t) => {
  const f = fixture(t, 'must_fix', 'CR-1');
  changeContract(f);
  unchanged(f, 'context-review-input-invalid', { acceptRisk: ['CR-1'] });
});
