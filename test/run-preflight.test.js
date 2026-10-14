'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { writeCurrent } = require('../scripts/lib/current');

const EPIC_REL = '.bouncer/context/epics/001-auth';
const BP_REL = `${EPIC_REL}/blueprints/001-login`;
const TASK_001 = `${BP_REL}/tasks/001/tasks.md`;
const TASK_002 = `${BP_REL}/tasks/002/tasks.md`;

function gitEnv() {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  return env;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: gitEnv() });
}

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writePlanTree(repo, {
  bpStatus = 'approved',
  task001 = {},
  task002 = {},
} = {}) {
  writeDoc(repo, `${EPIC_REL}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${EPIC_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  }, '# Auth\n');
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '001', epic_id: '001', blueprint_id: '001', status: bpStatus, scale: 'full',
    },
  }, '# Login\n');
  writeDoc(repo, TASK_001, {
    type: 'bouncer.tasks', title: 'First', description: 'd', resource: TASK_001,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      execution_kind: 'commit', affected_paths: ['a.ts'],
      ...task001,
    },
  }, '# Tasks 001\n');
  writeDoc(repo, TASK_002, {
    type: 'bouncer.tasks', title: 'Second', description: 'd', resource: TASK_002,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-002', epic_id: '001', blueprint_id: '001', status: 'ready',
      execution_kind: 'commit', affected_paths: ['b.ts'], depends_on: ['TASKS-001'],
      ...task002,
    },
  }, '# Tasks 002\n');
}

function makeRepo() {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-run-preflight-')));
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  git(repo, ['add', 'README']);
  git(repo, ['commit', '-qm', 'baseline']);
  return repo;
}

function setPointer(repo, { blueprint = BP_REL, base = 'main', task = TASK_001 } = {}) {
  writeCurrent({ repoRoot: repo, blueprint, base, task });
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

function preflight(repo, extra = []) {
  return capture(['run', 'preflight', '--blueprint', BP_REL, '--repo', repo, ...extra]);
}

function parsePayload(result) {
  assert.ok(result.out.trim(), `expected stdout JSON, stderr=${result.err}`);
  return JSON.parse(result.out);
}

test('run preflight when 002 depends on 001 → reports readyWave 001 and TASKS-002', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const before = git(repo, ['status', '--porcelain']);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.deepStrictEqual(payload.readyWave, ['001']);
  assert.strictEqual(payload.openTasks[1].taskId, 'TASKS-002');
  assert.strictEqual(payload.openTasks[1].id, '002');
  assert.deepStrictEqual(payload.openTasks[1].depends_on, ['TASKS-001']);
  assert.strictEqual(payload.openTasks[0].id, '001');
  assert.deepStrictEqual(payload.openTasks[0].depends_on, []);
  assert.strictEqual(payload.openTasks[0].parallel_safe, false);
  assert.strictEqual(payload.openTasks[0].dependency_gate, 'integrated');
  assert.strictEqual(payload.blueprint.dir, BP_REL);
  assert.strictEqual(payload.blueprint.status, 'approved');
  assert.strictEqual(payload.blueprint.scale, 'full');
  assert.strictEqual(payload.base, 'main');
  assert.strictEqual(payload.delegable, true);
  assert.strictEqual(payload.reason, null);
  assert.strictEqual(git(repo, ['status', '--porcelain']), before, 'preflight must not write files');
});

test('run preflight with missing autonomy → treats it as auto with fallback missing', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(payload.autonomy, {
    value: 'auto', fallback: true, reason: 'missing',
  });
});

test('run preflight with autonomy always → treats it as invalid', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'config.json'), `${JSON.stringify({
    autonomy: 'always',
  })}\n`);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.autonomy.value, 'auto');
  assert.strictEqual(payload.autonomy.fallback, true);
  assert.strictEqual(payload.autonomy.reason, 'invalid');
});

test('run preflight with a closed blueprint → marks it as not delegable', () => {
  const repo = makeRepo();
  writePlanTree(repo, { bpStatus: 'closed' });
  setPointer(repo);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.reason, 'blueprint-closed');
});

test('run preflight with a promotion_stopped ledger → marks it as not delegable', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(
    paths.ledgerFile,
    `${JSON.stringify({
      version: 1,
      blueprint: BP_REL,
      base: 'main',
      mode: 'light',
      status: 'promotion_stopped',
      tasks: [],
      decisions: [],
      promotion: {
        reason: 'out-of-scope',
        summary: 'stop',
        task: '001',
        diff_sha: 'b'.repeat(64),
      },
    }, null, 2)}\n`,
  );

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.reason, 'promotion-stopped');
});

test('run preflight with declared auto autonomy → treats it as no fallback', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'config.json'), `${JSON.stringify({
    autonomy: 'auto',
  })}\n`);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(payload.autonomy, {
    value: 'auto', fallback: false, reason: null,
  });
});

test('run preflight with no open tasks → marks it as not delegable', () => {
  const repo = makeRepo();
  writePlanTree(repo, {
    task001: { status: 'integrated' },
    task002: { status: 'verified' },
  });
  setPointer(repo);

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.ok, true);
  assert.deepStrictEqual(payload.openTasks, []);
  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.reason, 'no-open-task');
});

test('run preflight with a colliding pointer set → maps CURRENT_AMBIGUOUS', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  setPointer(repo, {
    blueprint: '.bouncer/context/epics/002-billing/blueprints/001-invoices',
    task: null,
  });
  const result = preflight(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'CURRENT_AMBIGUOUS');
});

test('run preflight with a missing pointer → rejects with no-current', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  const result = preflight(repo);
  const payload = parsePayload(result);
  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'no-current');
});

test('run without a subcommand → exits 2', () => {
  const result = capture(['run']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /preflight/);
});

test('run preflight without --blueprint → exits 2', () => {
  const result = capture(['run', 'preflight']);
  assert.strictEqual(result.code, 2);
  assert.match(result.err, /blueprint/);
});

// 세 번째 task 문서를 추가한다. 기본값은 TASKS-002에 직렬로 매달린 commit task다.
function writeTask003(repo, over = {}) {
  const rel = `${BP_REL}/tasks/003/tasks.md`;
  writeDoc(repo, rel, {
    type: 'bouncer.tasks', title: 'Third', description: 'd', resource: rel,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-003', epic_id: '001', blueprint_id: '001', status: 'ready',
      execution_kind: 'commit', affected_paths: ['c.ts'], depends_on: ['TASKS-002'],
      ...over,
    },
  }, '# Tasks 003\n');
}

test('run preflight with three chained commit tasks → emits serial shape', () => {
  const repo = makeRepo();
  writePlanTree(repo, {
    task001: { review_risk: ['public_interface'] },
    task002: { review_risk: ['public_interface'] },
  });
  writeTask003(repo);
  setPointer(repo);

  const payload = parsePayload(preflight(repo));

  assert.deepEqual(payload.shape, {
    drive_shape: 'serial',
    max_wave_width: 1,
    commit_tasks: 3,
    review_risk: ['public_interface'],
    parallel_safe_tasks: 0,
  });
});

test('run preflight with a verification node → shape does not count the node', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  writeTask003(repo, { execution_kind: 'verification', depends_on: ['TASKS-001', 'TASKS-002'] });
  setPointer(repo);

  const payload = parsePayload(preflight(repo));

  assert.equal(payload.shape.commit_tasks, 2);
  assert.equal(payload.shape.drive_shape, 'serial');
});

test('run preflight with a failing pointer → omits shape', () => {
  const repo = makeRepo();
  writePlanTree(repo);

  const payload = parsePayload(preflight(repo));

  assert.equal(payload.ok, false);
  assert.equal(payload.shape, undefined);
});

// direct_eligible 경계: 설정(coordinator.direct_max_commit_tasks)과 shape·scale·delegable이
// 모두 맞을 때만 true여야 한다. 직렬 task 수는 TASKS-001/002 위에 003.. 을 이어 붙여 만든다.
function writeChain(repo, count) {
  writePlanTree(repo);
  for (let n = 3; n <= count; n += 1) {
    const id = String(n).padStart(3, '0');
    const prev = String(n - 1).padStart(3, '0');
    const rel = `${BP_REL}/tasks/${id}/tasks.md`;
    writeDoc(repo, rel, {
      type: 'bouncer.tasks', title: `T${id}`, description: 'd', resource: rel,
      tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${id}`, epic_id: '001', blueprint_id: '001', status: 'ready',
        execution_kind: 'commit', affected_paths: [`${id}.ts`], depends_on: [`TASKS-${prev}`],
      },
    }, `# Tasks ${id}\n`);
  }
  setPointer(repo);
}

function writeDirectConfig(repo, directMax) {
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'config.json'), `${JSON.stringify({
    coordinator: { direct_max_commit_tasks: directMax },
  })}\n`);
}

test('run preflight with three serial commit tasks and no config → direct_eligible is true', () => {
  const repo = makeRepo();
  writeChain(repo, 3);

  assert.strictEqual(parsePayload(preflight(repo)).direct_eligible, true);
});

test('run preflight with four serial commit tasks and no config → direct_eligible is false', () => {
  const repo = makeRepo();
  writeChain(repo, 4);

  assert.strictEqual(parsePayload(preflight(repo)).direct_eligible, false);
});

test('run preflight with four serial tasks and direct_max_commit_tasks 4 → direct_eligible is true', () => {
  const repo = makeRepo();
  writeChain(repo, 4);
  writeDirectConfig(repo, 4);

  assert.strictEqual(parsePayload(preflight(repo)).direct_eligible, true);
});

test('run preflight with direct_max_commit_tasks 0, "x" or -1 → direct_eligible is false', () => {
  for (const value of [0, 'x', -1, 1.5]) {
    const repo = makeRepo();
    writeChain(repo, 2);
    writeDirectConfig(repo, value);

    assert.strictEqual(parsePayload(preflight(repo)).direct_eligible, false, String(value));
  }
});

test('run preflight with two independent parallel_safe tasks → direct_eligible is false', () => {
  const repo = makeRepo();
  writePlanTree(repo, {
    task001: { parallel_safe: true },
    task002: { parallel_safe: true, depends_on: [] },
  });
  setPointer(repo);

  const payload = parsePayload(preflight(repo));

  assert.strictEqual(payload.shape.drive_shape, 'parallel');
  assert.strictEqual(payload.direct_eligible, false);
});

test('run preflight with a light blueprint → direct_eligible is false', () => {
  const repo = makeRepo();
  writeChain(repo, 2);
  const indexRel = `${BP_REL}/index.md`;
  const text = fs.readFileSync(path.join(repo, indexRel), 'utf8');
  fs.writeFileSync(path.join(repo, indexRel), text.replace('scale: full', 'scale: light'));

  assert.strictEqual(parsePayload(preflight(repo)).direct_eligible, false);
});

test('run preflight with a closed blueprint → direct_eligible is false', () => {
  const repo = makeRepo();
  writeChain(repo, 2);
  const indexRel = `${BP_REL}/index.md`;
  const text = fs.readFileSync(path.join(repo, indexRel), 'utf8');
  fs.writeFileSync(path.join(repo, indexRel), text.replace('status: approved', 'status: closed'));

  const payload = parsePayload(preflight(repo));

  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.direct_eligible, false);
});

// ---- 포인터 불일치·승인 전/종료 상태·원장 상태 거절 ----

function preflightFor(repo, blueprint) {
  return capture(['run', 'preflight', '--blueprint', blueprint, '--repo', repo]);
}

function setBpStatus(repo, from, to) {
  const indexRel = `${BP_REL}/index.md`;
  const text = fs.readFileSync(path.join(repo, indexRel), 'utf8');
  fs.writeFileSync(path.join(repo, indexRel), text.replace(from, to));
}

function writeLedger(repo, status) {
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify({
    version: 1, blueprint: BP_REL, base: 'main', mode: 'light', status, tasks: [], decisions: [],
  }, null, 2)}\n`);
}

test('run preflight with a pointer on another epic → rejects with pointer-mismatch', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  const other = '.bouncer/context/epics/002-billing/blueprints/001-invoices';
  setPointer(repo, { blueprint: other, task: null });

  const result = preflight(repo);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
  assert.strictEqual(payload.expected, other);
  assert.strictEqual(payload.actual, BP_REL);
});

test('run preflight with a pointer on another blueprint of the same epic → rejects with the requested string as actual', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  const other = `${EPIC_REL}/blueprints/002-other`;
  setPointer(repo, { blueprint: other, task: null });

  const requested = `./${BP_REL}/`;
  const result = preflightFor(repo, requested);
  const payload = parsePayload(result);

  assert.strictEqual(result.code, 1);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
  assert.strictEqual(payload.expected, other);
  assert.strictEqual(payload.actual, requested);
});

test('run preflight with a blueprint path carrying no ids → rejects with pointer-mismatch', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  const payload = parsePayload(preflightFor(repo, 'not/a/blueprint'));

  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
});

test('run preflight with non-approved blueprint status → refuses delegation per status', () => {
  const cases = [
    ['draft', 'blueprint-draft'],
    ['superseded', 'blueprint-superseded'],
    ['imported', 'blueprint-imported'],
    ['partial_closed', 'blueprint-partial-closed'],
  ];
  for (const [bpStatus, reason] of cases) {
    const repo = makeRepo();
    writePlanTree(repo, { bpStatus });
    setPointer(repo);

    const payload = parsePayload(preflight(repo));

    assert.strictEqual(payload.ok, true, bpStatus);
    assert.strictEqual(payload.delegable, false, bpStatus);
    assert.strictEqual(payload.reason, reason, bpStatus);
  }
});

test('run preflight with an index lacking a status key → reports blueprint-status-unknown', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setBpStatus(repo, 'status: approved\n', '');
  setPointer(repo);

  const payload = parsePayload(preflight(repo));

  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.reason, 'blueprint-status-unknown');
});

test('run preflight with an out-of-enum blueprint status → reports blueprint-status-unknown', () => {
  const repo = makeRepo();
  writePlanTree(repo, { bpStatus: 'bogus' });
  setPointer(repo);

  assert.strictEqual(parsePayload(preflight(repo)).reason, 'blueprint-status-unknown');
});

test('run preflight with an approved blueprint and non-active ledger → reports the ledger reason', () => {
  const cases = [
    ['awaiting_confirmation', 'awaiting-confirmation'],
    ['partial_closed', 'partial-closed'],
  ];
  for (const [ledgerStatus, reason] of cases) {
    const repo = makeRepo();
    writePlanTree(repo);
    setPointer(repo);
    writeLedger(repo, ledgerStatus);

    const payload = parsePayload(preflight(repo));

    assert.strictEqual(payload.delegable, false, ledgerStatus);
    assert.strictEqual(payload.reason, reason, ledgerStatus);
  }
});

test('run preflight with an active ledger and approved blueprint → stays delegable', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  writeLedger(repo, 'active');

  const payload = parsePayload(preflight(repo));

  assert.strictEqual(payload.delegable, true);
  assert.strictEqual(payload.reason, null);
});

test('run preflight with awaiting_confirmation ledger and draft blueprint → ledger reason wins', () => {
  const repo = makeRepo();
  writePlanTree(repo, { bpStatus: 'draft' });
  setPointer(repo);
  writeLedger(repo, 'awaiting_confirmation');

  assert.strictEqual(parsePayload(preflight(repo)).reason, 'awaiting-confirmation');
});

test('run preflight with a draft blueprint and no open task → document status reason wins over no-open-task', () => {
  const repo = makeRepo();
  writePlanTree(repo, {
    bpStatus: 'draft',
    task001: { status: 'integrated' },
    task002: { status: 'integrated' },
  });
  setPointer(repo);

  assert.strictEqual(parsePayload(preflight(repo)).reason, 'blueprint-draft');
});

test('run preflight with a refused blueprint status → direct_eligible is false', () => {
  const repo = makeRepo();
  writeChain(repo, 2);
  setBpStatus(repo, 'status: approved', 'status: draft');

  const payload = parsePayload(preflight(repo));

  assert.strictEqual(payload.delegable, false);
  assert.strictEqual(payload.direct_eligible, false);
});

test('run preflight with trailing slash, ./ prefix or absolute path → treats it as the same blueprint', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  for (const requested of [`${BP_REL}/`, `./${BP_REL}`, path.join(repo, BP_REL)]) {
    const payload = parsePayload(preflightFor(repo, requested));

    assert.strictEqual(payload.ok, true, requested);
    assert.strictEqual(payload.delegable, true, requested);
  }
});

test('run preflight with an absolute blueprint path outside the repo carrying the same ids → rejects with pointer-mismatch', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const elsewhere = path.join(makeRepo(), BP_REL);

  const payload = parsePayload(preflightFor(repo, elsewhere));

  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
  assert.strictEqual(payload.expected, BP_REL);
  assert.strictEqual(payload.actual, elsewhere);
});

test('run preflight with a ../ blueprint path escaping the repo → rejects with pointer-mismatch', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const escaping = `../${path.basename(repo)}-sibling/${BP_REL}`;

  const payload = parsePayload(preflightFor(repo, escaping));

  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
  assert.strictEqual(payload.actual, escaping);
});

test('run preflight with an absolute blueprint path inside the repo → stays accepted', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);

  const payload = parsePayload(preflightFor(repo, path.join(repo, BP_REL)));

  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.blueprint.dir, BP_REL);
});

test('run preflight with a ../ path resolving to another blueprint of the same epic → rejects with the raw request as actual', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  const otherRel = `${EPIC_REL}/blueprints/002-other`;
  const otherTask = `${otherRel}/tasks/001/tasks.md`;
  writeDoc(repo, `${otherRel}/index.md`, {
    type: 'bouncer.blueprint', title: 'Other', description: 'd', resource: `${otherRel}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: '002', epic_id: '001', blueprint_id: '002', status: 'approved', scale: 'full',
    },
  }, '# Other\n');
  writeDoc(repo, otherTask, {
    type: 'bouncer.tasks', title: 'Other task', description: 'd', resource: otherTask,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '002', status: 'ready',
      execution_kind: 'commit', affected_paths: ['c.ts'],
    },
  }, '# Other task\n');
  const requested = `${BP_REL}/../002-other`;

  const payload = parsePayload(preflightFor(repo, requested));

  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
  assert.strictEqual(payload.expected, BP_REL);
  assert.strictEqual(payload.actual, requested);
});

test('run preflight with a blueprint directory symlinked outside the repo → rejects with pointer-mismatch', () => {
  const repo = makeRepo();
  writePlanTree(repo);
  setPointer(repo);
  // 같은 id의 approved blueprint를 repo 밖에 만들고 repo 안 경로를 그쪽 symlink로 바꾼다.
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-run-preflight-out-')));
  writePlanTree(outside);
  fs.rmSync(path.join(repo, BP_REL), { recursive: true });
  fs.symlinkSync(path.join(outside, BP_REL), path.join(repo, BP_REL), 'dir');

  const payload = parsePayload(preflightFor(repo, BP_REL));

  assert.strictEqual(payload.ok, false);
  assert.strictEqual(payload.reason, 'pointer-mismatch');
  assert.strictEqual(payload.expected, BP_REL);
  assert.strictEqual(payload.actual, BP_REL);
});

test('run preflight with a corrupt ledger file → falls back to the document status', () => {
  const repo = makeRepo();
  writePlanTree(repo, { bpStatus: 'draft' });
  setPointer(repo);
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint: BP_REL });
  fs.mkdirSync(path.dirname(paths.ledgerFile), { recursive: true });
  fs.writeFileSync(paths.ledgerFile, '{not json');

  const draft = parsePayload(preflight(repo));
  setBpStatus(repo, 'status: draft', 'status: approved');
  const approved = parsePayload(preflight(repo));

  assert.strictEqual(draft.delegable, false);
  assert.strictEqual(draft.reason, 'blueprint-draft');
  assert.strictEqual(approved.delegable, true);
  assert.strictEqual(approved.reason, null);
});
