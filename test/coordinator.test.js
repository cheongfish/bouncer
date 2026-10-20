'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readyWave, transition } = require('../scripts/lib/coordinator');
const { createGitTemplate } = require('./helpers/git-fixture');
const { loadModuleGraph, reachable } = require('./helpers/module-graph');

const __coordinatorMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const __crypto = require('node:crypto');
const __LEDGER_REL = '.bouncer/runtime/coordinator.json';
const __FENCED = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke', 'promote-stop', 'worker-model', 'worker-tokens',
]);
function __fence(repoRoot, blueprint) {
  const { ledgerFile } = __coordinatorPathsFor({ repoRoot, blueprint });
  return {
    ledgerPath: __LEDGER_REL,
    ledgerHash: __crypto.createHash('sha256').update(fs.readFileSync(ledgerFile)).digest('hex'),
  };
}
function coordinate(opts) {
  if (__FENCED.has(opts.command)
    && opts.ledgerPath === undefined && opts.ledgerHash === undefined) {
    try {
      opts = { ...opts, ...__fence(opts.repoRoot, opts.blueprint) };
    } catch (_error) { /* missing ledger → core rejects */ }
  }
  return __coordinatorMod.coordinate(opts);
}
const coordinateRaw = __coordinatorMod.coordinate;
const { COORDINATE_FAILURE_HINTS, withCoordinateFailureHints } = __coordinatorMod;

// revise 거절 중 힌트 표에 없던 reason 10종. revise 응답이 이 reason들에 fallback
// `cause`(= reason 문자열)를 받으면 coordinator가 다음 행동을 알 수 없게 된다.
const REVISE_HINTLESS_REASONS = [
  'scope-paths-required', 'scope-path-glob', 'scope-path-out-of-bounds', 'task-document-missing',
  'no-coordinator-paths', 'no-git', 'main-worktree-source-write', 'unassigned-worktree',
  'unreadable-ledger', 'ledger-locked',
];

const { validateCoordinatorLedger } = require('../scripts/lib/runtime-state');
const { writeCurrent } = require('../scripts/lib/current');
const { readDoc } = require('../scripts/lib/frontmatter');
const { renderDoc } = require('../scripts/lib/render');
const { taskBriefHash } = require('../scripts/lib/task-brief-hash');

// 기본 저장소(init·로컬 identity·README 커밋)를 파일당 한 번만 만들고 테스트마다 복사한다.
// identity는 저장소 로컬 config로 두어 호스트 전역 설정이 없어도 fan-in cherry-pick이 돈다.
// bootstrap·prepare가 만드는 worktree는 절대 경로를 담으므로 복사 뒤에 실행한다.
const repoTemplate = createGitTemplate((repo) => {
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  // repair/revise의 --paths는 integration HEAD에서 추적되는 파일만 받는다.
  // repair 테스트가 쓰는 경로를 미리 추적 파일로 둬 새 추적 검사를 통과시킨다.
  for (const rel of ['src/fix.js', 'src/third.js', 'test/fix.test.js']) {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), 'fixture\n');
  }
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
});
// light-scale 테스트는 기본 커밋에 src/a.js가 더 있어야 하므로 별도 템플릿을 쓴다.
const lightTemplate = createGitTemplate((repo) => {
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.js'), 'a\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'fixture'], { cwd: repo });
});
test.after(() => {
  repoTemplate.dispose();
  lightTemplate.dispose();
});

function writeCoordinatorConfig(repoRoot, coordinator) {
  const dir = path.join(repoRoot, '.bouncer');
  fs.mkdirSync(dir, { recursive: true });
  const existing = fs.existsSync(path.join(dir, 'config.json'))
    ? JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'))
    : {};
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    `${JSON.stringify({ ...existing, coordinator }, null, 2)}\n`,
  );
}

/**
 * `coordinate report`가 읽는 worker 보고 파일을 쓴다. full 모드 report 호출 전에 필요하다.
 * `revision`·`open`·`weak`로 줄이나 섹션을 바꾸거나 null로 빼서 거절 경로를 만든다.
 */
function writeWorkerReport(worker, task, attempt, hash, {
  revision = `attempt: ${attempt}\ntask_brief_hash: ${hash}`,
  open = '- none', weak = '- none', pathAttempt = attempt,
} = {}) {
  const dir = path.join(worker, '.bouncer', 'runtime', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const parts = ['## Changed files\n- `src/a.js` — fixture', `## Brief revision\n${revision}`];
  if (open !== null) parts.push(`## Open choices\n${open}`);
  if (weak !== null) parts.push(`## Known weaknesses\n${weak}`);
  fs.writeFileSync(path.join(dir, `${task}-${pathAttempt}.md`), `${parts.join('\n\n')}\n`);
}

/**
 * worker가 integration에 없는 커밋을 갖게 하고 `bouncer commit`이 찍는 stamp(HEAD 앞 8자)를
 * tasks.md에 쓴다. 이미 worker 커밋이 있으면 새로 만들지 않는다.
 * report(accepted)·record가 커밋 확정을 요구하므로 정상 순서(commit → report → record)를
 * 만드는 fixture 단계다. stamp는 task brief hash가 무시하는 `commit_sha`만 바꾼다.
 */
function commitAndStampWorker(repo, blueprint, worker, task = '001', { stamp = true } = {}) {
  const integrationPath = __coordinatorPathsFor({ repoRoot: repo, blueprint }).integrationPath;
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integrationPath, encoding: 'utf8' }).trim();
  let hasCommit = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'HEAD', integrationHead], { cwd: worker, stdio: 'ignore' });
    hasCommit = false;
  } catch (_error) { /* 종료 코드 1 = HEAD가 integration 조상이 아님 = 이미 worker 커밋이 있음 */ }
  if (!hasCommit) {
    fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
    fs.writeFileSync(path.join(worker, `src/task-${task}.js`), `changed by ${task}\n`);
    execFileSync('git', ['add', `src/task-${task}.js`], { cwd: worker });
    execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', `feat: ${task}`],
      { cwd: worker });
  }
  if (!stamp) return;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  const file = path.join(worker, blueprint, 'tasks', task, 'tasks.md');
  const doc = readDoc(file);
  doc.data.bouncer.commit_sha = head.slice(0, 8);
  fs.writeFileSync(file, renderDoc(doc.data, doc.body));
}

/**
 * dispatch → (commit·stamp) → accepted report. record 사전조건을 채운 뒤 호출부가 record를 이어서 부른다.
 */
function acceptDispatchReport(repo, blueprint, worker, task = '001') {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task,
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  commitAndStampWorker(repo, blueprint, worker, task);
  writeWorkerReport(worker, task, dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task,
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: `accepted ${task}`,
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  return dispatched;
}

const COORDINATOR_SRC_DIR = path.join(__dirname, '..', 'scripts', 'src', 'lib');

/**
 * reason 완전성 검사가 훑을 소스 파일 집합. `coordinator.ts`와 그 파일이 정적으로 도달하는
 * `coordinator-*` 모듈이다. 코드를 하위 모듈로 옮겨도 집합이 함께 늘어나므로, 단일 파일만
 * 읽어 검사 범위가 조용히 줄어드는 문제를 막는다.
 *
 * @returns {string[]} 절대 경로 목록(첫 항목은 coordinator.ts)
 */
function coordinatorReasonFiles() {
  const graph = loadModuleGraph(COORDINATOR_SRC_DIR);
  const modules = ['coordinator', ...[...reachable(graph, 'coordinator')]
    .filter((name) => name.startsWith('coordinator-')).sort()];
  return modules.map((name) => path.join(COORDINATOR_SRC_DIR, `${name}.ts`));
}

/**
 * 파일 목록에서 `reason: '...'` 리터럴을 모은다.
 *
 * @param {string[]} files - 읽을 소스 파일 절대 경로
 * @returns {string[]} 중복 없는 reason 문자열(정렬)
 */
function reasonLiteralsOf(files) {
  const reasons = new Set();
  for (const file of files) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/reason: '([a-z-]+)'/g)) reasons.add(match[1]);
  }
  return [...reasons].sort();
}

/**
 * 힌트 표에 키가 없는 reason을 고른다. 힌트가 없으면 공개 응답이 일반 폴백 힌트로 떨어진다.
 *
 * @param {string[]} reasons - 검사할 reason 목록
 * @param {Record<string, unknown>} hints - COORDINATE_FAILURE_HINTS
 * @returns {string[]} 힌트가 없는 reason 목록(입력 순서). 모두 있으면 빈 배열
 */
function missingHints(reasons, hints) {
  return reasons.filter((reason) => !Object.hasOwn(hints, reason));
}

/**
 * 실제 거절 응답이 전용 힌트를 받았는지 단언한다. 폴백이면 `cause`가 `reason` 문자열과
 * 같아지므로 `cause !== reason`으로 폴백을 구분한다.
 *
 * @param {{ reason: string, cause: string }} result - coordinate 실패 응답
 * @returns {void}
 */
function assertHinted(result) {
  assert.ok(Object.hasOwn(COORDINATE_FAILURE_HINTS, result.reason), JSON.stringify(result));
  assert.notStrictEqual(result.cause, result.reason, JSON.stringify(result));
}

test('coordinator reason file set → includes coordinator.ts first', () => {
  assert.strictEqual(coordinatorReasonFiles()[0], path.join(COORDINATOR_SRC_DIR, 'coordinator.ts'));
});

test('every coordinator reason literal exists → COORDINATE_FAILURE_HINTS covers each of them', () => {
  const reasons = reasonLiteralsOf(coordinatorReasonFiles());
  assert.ok(reasons.length > 0);
  assert.deepStrictEqual(missingHints(reasons, COORDINATE_FAILURE_HINTS), []);
});

test('an injected reason with no hint → missingHints reports it', () => {
  assert.deepStrictEqual(missingHints(['fake-x'], COORDINATE_FAILURE_HINTS), ['fake-x']);
});

test('revise rejection reason missing from the hint table before this change → gets its own cause and next, not the fallback', () => {
  for (const reason of REVISE_HINTLESS_REASONS) {
    const hinted = withCoordinateFailureHints({ ok: false, reason });
    assertHinted(hinted);
    assert.strictEqual(typeof hinted.next, 'string', reason);
    assert.notStrictEqual(hinted.next, '', reason);
  }
});

test('shared hint reasons other subcommands also emit → next does not point at coordinate revise only', () => {
  const shared = [
    'ledger-locked', 'no-git', 'unassigned-worktree', 'main-worktree-source-write', 'task-document-missing',
  ];
  for (const reason of shared) {
    const hinted = withCoordinateFailureHints({ ok: false, reason });
    assert.ok(!hinted.next.includes('coordinate revise'), `${reason}: ${hinted.next}`);
    assert.ok(hinted.next.includes('`bouncer coordinate`'), `${reason}: ${hinted.next}`);
  }
});

test('readyWave with pending, blocked and done tasks → returns only pending tasks with completed dependencies', () => {
  const tasks = [
    { id: '001', depends_on: [], status: 'integrated' },
    { id: '002', depends_on: ['001'], status: 'pending' },
    { id: '003', depends_on: ['002'], status: 'pending' },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['002']);
});

test('readyWave with a sequential task in the wave → keeps it alone and waits for the integrated gate', () => {
  const tasks = [
    { id: '001', status: 'integrated', affected_paths: ['a/'] },
    { id: '002', depends_on: ['001'], parallel_safe: true, status: 'pending', affected_paths: ['b/'] },
    { id: '003', depends_on: ['001'], parallel_safe: false, status: 'pending', affected_paths: ['c/'] },
    // 005는 아직 종단 상태에 닿지 않았다. gate 값이 integrated 하나뿐이어도
    // 004는 선행이 그 상태가 되기 전까지 열리지 않는다. 초기 status는 pending —
    // recorded로 두면 in-flight가 비지 않아 순차 후보(003)를 열 수 없다.
    { id: '004', depends_on: ['005'], dependency_gate: 'integrated', parallel_safe: true, status: 'pending', affected_paths: ['d/'] },
    { id: '005', depends_on: [], parallel_safe: true, status: 'pending', affected_paths: ['e/'] },
  ];
  assert.deepStrictEqual(readyWave(tasks), ['003']);
  // sequential in-flight가 있으면 후보를 열지 않는다 — 예전처럼 prepared 옆의
  // parallel 후보를 바로 열면 한도·충돌 정책과 어긋난다.
  tasks[2].status = 'prepared';
  assert.deepStrictEqual(readyWave(tasks), []);
  tasks[2].status = 'integrated';
  tasks[4].status = 'recorded';
  assert.deepStrictEqual(readyWave(tasks), ['002']);
  tasks[4].status = 'integrated';
  assert.deepStrictEqual(readyWave(tasks), ['002', '004']);
});

test('readyWave with parallel_safe tasks, maxParallel and path/resource conflicts → caps the wave by all of them', () => {
  const threeDisjoint = [
    { id: '001', status: 'pending', parallel_safe: true, affected_paths: ['a/'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['b/'] },
    { id: '003', status: 'pending', parallel_safe: true, affected_paths: ['c/'] },
  ];
  // 세 task 모두 parallel_safe·경로 분리 → 기본 한도 2
  assert.deepStrictEqual(readyWave(threeDisjoint), ['001', '002']);
  // in-flight 001(src/) + pending 002(src/a.ts) → 조상 충돌로 제외.
  // Checklist/Goal은 trailing-slash 디렉터리 표기를 쓰므로, pathsOverlap 호출 전에
  // 정규화하지 않으면 충돌을 놓친다(RD-001).
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'prepared', parallel_safe: true, affected_paths: ['src/'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['src/a.ts'] },
  ]), []);
  // `./` prefix도 같은 경로로 취급해야 한다 — raw pathsOverlap('./src/a.ts','src/a.ts')===false.
  assert.deepStrictEqual(readyWave([
    { id: '001', status: 'prepared', parallel_safe: true, affected_paths: ['./src/a.ts'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['src/a.ts'] },
  ]), []);
  // 같은 exclusive_resources
  const sameResourcePair = [
    { id: '001', status: 'pending', parallel_safe: true, affected_paths: ['a/'], exclusive_resources: ['database-schema'] },
    { id: '002', status: 'pending', parallel_safe: true, affected_paths: ['b/'], exclusive_resources: ['database-schema'] },
  ];
  assert.deepStrictEqual(readyWave(sameResourcePair), ['001']);
  assert.deepStrictEqual(readyWave(threeDisjoint, { maxParallel: 1 }), ['001']);
  // 경로 필드가 모두 없는 legacy task는 단독
  const legacyPair = [
    { id: '001', status: 'pending', parallel_safe: true },
    { id: '002', status: 'pending', parallel_safe: true },
  ];
  assert.deepStrictEqual(readyWave(legacyPair), ['001']);
});

test('readCoordinatorPolicy with integers >= 1 and invalid max_parallel → accepts the integers and rejects the invalid value', () => {
  const { readCoordinatorPolicy, DEFAULT_MAX_PARALLEL } = require('../scripts/lib/config');
  assert.strictEqual(DEFAULT_MAX_PARALLEL, 2);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coord-policy-'));
  assert.deepStrictEqual(readCoordinatorPolicy(repo), { ok: true, maxParallel: 2 });
  writeCoordinatorConfig(repo, {});
  assert.deepStrictEqual(readCoordinatorPolicy(repo), { ok: true, maxParallel: 2 });
  writeCoordinatorConfig(repo, { max_parallel: 3 });
  assert.deepStrictEqual(readCoordinatorPolicy(repo), { ok: true, maxParallel: 3 });
  for (const bad of [0, -1, 1.5, '2', null]) {
    writeCoordinatorConfig(repo, { max_parallel: bad });
    assert.deepStrictEqual(
      readCoordinatorPolicy(repo),
      { ok: false, reason: 'invalid' },
      `max_parallel=${JSON.stringify(bad)}`,
    );
  }
});

test('readWavesPerSession with absent, auto, integer and invalid values → resolves the cap or rejects', () => {
  const { readWavesPerSession } = require('../scripts/lib/config');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coord-wps-'));
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: true, cap: 4 });
  writeCoordinatorConfig(repo, {});
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: true, cap: 4 });
  writeCoordinatorConfig(repo, { waves_per_session: 'auto' });
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: true, cap: 4 });
  writeCoordinatorConfig(repo, { waves_per_session: 3 });
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: true, cap: 3 });
  writeCoordinatorConfig(repo, { waves_per_session: 1 });
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: true, cap: 1 });
  writeCoordinatorConfig(repo, { waves_per_session: 8 });
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: true, cap: 8 });
  for (const bad of [0, 9, 1.5, -1, 'fast', null, '3']) {
    writeCoordinatorConfig(repo, { waves_per_session: bad });
    assert.deepStrictEqual(
      readWavesPerSession(repo),
      { ok: false, reason: 'invalid' },
      `waves_per_session=${JSON.stringify(bad)}`,
    );
  }
  // 깨진 config는 상한을 넓히지 않도록 invalid다.
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{ not json');
  assert.deepStrictEqual(readWavesPerSession(repo), { ok: false, reason: 'invalid' });
});

test('prepare with an invalid waves_per_session → rejects before creating workers', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/098-x/blueprints/002-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(
    path.join(repo, blueprint, 'tasks', '001', 'tasks.md'),
    '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - a/\n---\n',
  );
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  writeCoordinatorConfig(boot.integrationPath, { waves_per_session: 9 });
  const rejected = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'coordinator-config-invalid');
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, '..', 'workers')), false);
  writeCoordinatorConfig(boot.integrationPath, { waves_per_session: 2 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
});

test('prepare with invalid max_parallel or max_parallel 1 → rejects before creating workers and honors 1', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/078-x/blueprints/001-y';
  for (const [id, leaf] of [['001', 'a'], ['002', 'b'], ['003', 'c']]) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(
      path.join(repo, blueprint, 'tasks', id, 'tasks.md'),
      `---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - ${leaf}/\n---\n`,
    );
  }
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));

  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 0 });
  const workersRoot = path.join(boot.integrationPath, '..', 'workers');
  const rejected = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'coordinator-config-invalid');
  assert.strictEqual(fs.existsSync(workersRoot), false);

  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 1 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
  const preparedCount = prepared.tasks.filter((task) => task.status === 'prepared').length;
  assert.strictEqual(preparedCount, 1);
});

test('transition with an illegal coordinator state change → rejects it', () => {
  assert.throws(() => transition('pending', 'integrated'), /illegal state transition/);
  assert.strictEqual(transition('ready', 'prepared'), 'prepared');
});

test('verification tasks in a plan → use the ready-verifying-integrated state path', () => {
  assert.strictEqual(transition('ready', 'verifying', 'verification'), 'verifying');
  assert.strictEqual(transition('verifying', 'integrated', 'verification'), 'integrated');
  assert.throws(() => transition('ready', 'prepared', 'verification'), /illegal state transition/);
});

test('critical recovery with a prepared task and a repeated call → records one recovery and rejects invalid repeats', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, `${blueprint}/index.md`), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/tasks/001/tasks.md`), '---\nbouncer:\n  status: ready\n---\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const started = coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', findings: ['R-1', 'R-2'], reason: 'false acceptance risk' });
  assert.strictEqual(started.ok, true, JSON.stringify(started));
  assert.deepStrictEqual(started.task.criticalRecovery, {
    used: 1, findings: ['R-1', 'R-2'], reason: 'false acceptance risk', outcome: null,
  });
  assert.deepStrictEqual(started.decision, {
    task: '001', kind: 'critical-recovery', used: 1, findings: ['R-1', 'R-2'],
    reason: 'false acceptance risk', outcome: null,
  });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const beforeRepeat = fs.readFileSync(ledgerFile, 'utf8');
  const exhausted = coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', findings: ['R-3'], reason: 'again' });
  assert.strictEqual(exhausted.reason, 'critical-recovery-exhausted');
  assertHinted(exhausted);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), beforeRepeat);
  assert.strictEqual(coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', outcome: 'blocked', reason: 'unresolved' }).task.criticalRecovery.outcome, 'blocked');
  assert.strictEqual(coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', outcome: 'resolved', reason: 'again' }).reason, 'critical-recovery-closed');
  const withoutStart = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  withoutStart.tasks[0].criticalRecovery = undefined;
  withoutStart.tasks[0].status = 'prepared';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(withoutStart, null, 2)}\n`);
  const noStart = coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', outcome: 'blocked', reason: 'x' });
  assert.strictEqual(noStart.reason, 'critical-recovery-not-started');
  withoutStart.tasks[0].status = 'recorded';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(withoutStart, null, 2)}\n`);
  const illegal = coordinate({ command: 'critical-recovery', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, task: '001', findings: ['R-1'], reason: 'x' });
  assert.strictEqual(illegal.reason, 'illegal-transition');
  assertHinted(illegal);
  const malformed = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  malformed.status = 'active'; malformed.tasks[0].status = 'prepared';
  malformed.tasks[0].criticalRecovery = { used: 2, findings: ['R-1'], reason: 'x', outcome: null };
  assert.strictEqual(validateCoordinatorLedger(malformed).reason, 'critical-recovery-invalid');
});

test('verification integrate with a passing and a failing CI → runs CI without a worker or commit and advances only on success', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/011-x/blueprints/012-y';
  for (const [id, metadata] of [
    ['001', 'depends_on: []\n'],
    ['002', 'execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n  ${metadata}---\n`);
  }
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.tasks[1].status, 'ready');
  assert.strictEqual(prepared.tasks[1].workerPath, undefined);
  let calls = 0;
  let seenScope = null;
  const integrationHead = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).integrationHead
    || execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: boot.integrationPath, encoding: 'utf8',
    }).trim();
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: (opts) => {
        calls += 1;
        seenScope = opts.scope;
        return { ok: true, command: 'node --test', exitCode: 0 };
      },
    },
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(passed.task.status, 'integrated');
  // CT-001: terminal CI evidence key는 blueprint 안정 ID + integration HEAD다.
  assert.deepStrictEqual(seenScope, {
    kind: 'terminal',
    key: `EPIC-011/BP-012:${integrationHead}`,
  });

  const afterPass = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  afterPass.tasks[1].status = 'ready';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(afterPass, null, 2)}\n`);
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1 }) },
  });
  assert.strictEqual(failed.reason, 'verification-failed');
  assert.strictEqual(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks[1].status, 'verifying');

  const missing = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    paths: ['src/fix.js'], decision: 'CI failure requires repair',
  });
  assert.strictEqual(missing.reason, 'failure-evidence-required');
  const escaped = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['.bouncer/context/'],
    decision: 'invalid scope',
  });
  assert.strictEqual(escaped.reason, 'repair-scope-out-of-bounds');
  for (const badPath of ['src/../.git/config', 'src/..', './', '../outside', '~/.cache', 'src/**', 'src/file?.js',
    'C:\\outside\\file.ts']) {
    const rejected = coordinate({
      command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
      failureCommand: 'node --test', summary: 'one failed', paths: [badPath], decision: 'invalid scope',
    });
    assert.strictEqual(rejected.reason, 'repair-scope-out-of-bounds', badPath);
  }

  const terminalFile = path.join(boot.integrationPath, blueprint, 'tasks/002/tasks.md');
  const terminalBeforeWriteFailure = fs.readFileSync(terminalFile, 'utf8');
  const ledgerBeforeWriteFailure = fs.readFileSync(ledgerFile, 'utf8');
  assert.throws(() => coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'],
    decision: 'injected failure', deps: { writeLedger: () => { throw new Error('ledger write failed'); } },
  }), /ledger write failed/);
  assert.strictEqual(fs.readFileSync(terminalFile, 'utf8'), terminalBeforeWriteFailure);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBeforeWriteFailure);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, blueprint, 'tasks/003')), false);

  const firstRepair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'],
    decision: 'repair the failing source path',
  });
  assert.strictEqual(firstRepair.ok, true, JSON.stringify(firstRepair));
  assert.strictEqual(firstRepair.wave, 1);
  assert.deepStrictEqual(firstRepair.terminalTask.depends_on, ['003']);
  assert.deepStrictEqual(firstRepair.decision.previousScope, []);
  assert.deepStrictEqual(firstRepair.decision.nextScope, ['src/fix.js']);
  assert.strictEqual(firstRepair.decision.revision, 'r1');
  assert.strictEqual(firstRepair.repairTask.scope.revision, 'r1');
  assert.match(fs.readFileSync(path.join(
    boot.integrationPath, blueprint, 'tasks/003/tasks.md',
  ), 'utf8'), /scope_revision: r1/);

  let repairedLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  repairedLedger.tasks.find((entry) => entry.id === '003').status = 'integrated';
  repairedLedger.tasks.find((entry) => entry.id === '002').status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(repairedLedger, null, 2)}\n`);
  const secondRepair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'still failing', paths: ['test/fix.test.js'],
    decision: 'add the missing regression coverage',
  });
  assert.strictEqual(secondRepair.wave, 2);
  assert.deepStrictEqual(secondRepair.terminalTask.depends_on, ['004']);
  const thirdRepair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'still failing', paths: ['src/third.js'], decision: 'third',
  });
  assert.strictEqual(thirdRepair.reason, 'repair-wave-limit');

  repairedLedger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  repairedLedger.tasks.find((entry) => entry.id === '004').status = 'integrated';
  repairedLedger.tasks.find((entry) => entry.id === '002').status = 'ready';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(repairedLedger, null, 2)}\n`);
  const thirdFailure = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1 }) },
  });
  assert.strictEqual(thirdFailure.stopped, true);
  const handoffPath = path.join(repo, '011_012_NEXT_PLAN.md');
  assert.strictEqual(fs.existsSync(handoffPath), false);
  assert.strictEqual(coordinate({
    command: 'partial-close', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  }).reason, 'partial-close-user-confirmation-required');
  const partial = coordinate({
    command: 'partial-close', repoRoot: repo, blueprint, cwd: boot.integrationPath, userConfirmed: true,
  });
  assert.strictEqual(partial.ok, true, JSON.stringify(partial));
  assert.strictEqual(partial.status, 'partial_closed');
  assert.strictEqual(partial.handoff.path, '011_012_NEXT_PLAN.md');
  assert.strictEqual(fs.existsSync(handoffPath), true);
  assert.match(fs.readFileSync(handoffPath, 'utf8'), /Source identity:/);
  assert.strictEqual(partial.message, 'NEXT_PLAN.md를 확인하고 후속 계획 진행 여부를 승인해 주세요.');
});

test('verification integrate on a slug blueprint → keys evidence by slug id and repair keeps slug ids', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/plan-workflow/blueprints/registry-gates';
  for (const [id, metadata] of [
    ['001', 'depends_on: []\n'],
    ['002', 'execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n  ${metadata}---\n`);
  }
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.integrationPath,
    path.join(repo, '.worktrees', 'plan-workflow', 'registry-gates', 'integration'));
  const ledgerFile = __coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const integrationHead = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).integrationHead
    || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: boot.integrationPath, encoding: 'utf8' }).trim();
  let seenScope = null;
  coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: (opts) => { seenScope = opts.scope; return { ok: false, command: 'node --test', exitCode: 1 }; } },
  });
  assert.deepStrictEqual(seenScope, { kind: 'terminal', key: `plan-workflow/registry-gates:${integrationHead}` });

  const repaired = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'], decision: 'repair the failing source path',
  });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  const repairDoc = fs.readFileSync(path.join(boot.integrationPath, blueprint, 'tasks/003/tasks.md'), 'utf8');
  assert.strictEqual(readDoc(path.join(boot.integrationPath, blueprint, 'tasks/003/tasks.md')).data.bouncer.epic_id,
    'plan-workflow', repairDoc);
  assert.strictEqual(readDoc(path.join(boot.integrationPath, blueprint, 'tasks/003/tasks.md')).data.bouncer.blueprint_id,
    'registry-gates');
});

test('verification integrate with a seeded terminal bundle → uses the real runner', () => {
  const repo = repoTemplate.copy();
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: 'node --test' }));
  const blueprint = '.bouncer/context/epics/013-x/blueprints/014-y';
  const task = (id, metadata) => {
    const dir = path.join(repo, blueprint, 'tasks', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tasks.md'), `---\nbouncer:\n  id: TASKS-${id}\n  status: ready\n${metadata}---\n`);
  };
  task('001', '  depends_on: []\n');
  task('002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node -e "process.stdout.write(\'ci-ok\')"\n  affected_paths: []\n');
  const verificationRel = `${blueprint}/tasks/002/verification.md`;
  fs.writeFileSync(path.join(repo, verificationRel), `---\ntype: bouncer.verification\ntitle: CI\ndescription: d\nresource: ${verificationRel}\ntags: [bouncer, verification]\ntimestamp: 2026-09-10T00:00:00+09:00\nbouncer:\n  id: VERIFY-002\n  epic_id: '013'\n  blueprint_id: '014'\n  status: pending\n---\n# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n`);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, verificationRel)), true);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, '.bouncer/config.json')), true);
  writeCurrent({
    repoRoot: boot.integrationPath, blueprint, base: 'master',
    task: `${blueprint}/tasks/002/tasks.md`,
  });

  const result = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.verification.exitCode, 0);
  assert.strictEqual(prepared.tasks[1].workerPath, undefined);
  const taskText = fs.readFileSync(path.join(boot.integrationPath, blueprint, 'tasks/002/tasks.md'), 'utf8');
  assert.match(taskText, /status: integrated/);
  assert.match(fs.readFileSync(path.join(boot.integrationPath, verificationRel), 'utf8'), /exit_code: 0/);
});

test('bootstrap on a fresh repo and again on resume → creates only an integration worktree and resumes its ledger', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/001-x/blueprints/001-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const first = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(first.ok, true);
  assert.deepStrictEqual(first.ready, ['001']);
  const second = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(second.ok, true);
  assert.deepStrictEqual(second.ready, ['001']);
  assert.strictEqual(fs.existsSync(path.join(repo, 'README.md')), true);
});

test('bootstrap with an untracked blueprint → seeds it once and preserves the integration copy on resume', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/030-x/blueprints/031-y';
  const task = `${blueprint}/tasks/001/tasks.md`;
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, task), '---\nbouncer:\n  depends_on: []\n---\n');
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"node --test"}\n');
  const before = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, task)), true);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, '.bouncer/config.json')), true);
  const ledger = JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.ok(ledger.seedManifest.some((entry) => entry.path === task && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.ok(!ledger.seedManifest.some((entry) => entry.path === '.bouncer/config.json'));
  const after = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' })
    .split('\n').filter((line) => !line.slice(3).startsWith('.worktrees/')).join('\n');
  assert.strictEqual(after.trim(), before.trim());
  fs.writeFileSync(path.join(boot.integrationPath, task), 'integration canonical\n');
  const resumed = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  assert.strictEqual(fs.readFileSync(path.join(boot.integrationPath, task), 'utf8'), 'integration canonical\n');
});

test('bootstrap with a third integration plan version → rejects without creating its ledger', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/032-x/blueprints/033-y';
  const task = `${blueprint}/tasks/001/tasks.md`;
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, task), 'main plan bytes\n');
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint });
  fs.mkdirSync(path.dirname(paths.integrationPath), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'feat/032-033-y', paths.integrationPath, 'HEAD'], { cwd: repo });
  fs.mkdirSync(path.join(paths.integrationPath, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(paths.integrationPath, task), 'third plan bytes\n');
  const mainBefore = fs.readFileSync(path.join(repo, task));
  const result = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(result.ok, false, JSON.stringify(result));
  assert.strictEqual(result.reason, 'seed-conflict');
  assert.deepStrictEqual(result.conflicts, [task]);
  assert.strictEqual(fs.existsSync(paths.ledgerFile), false);
  assert.deepStrictEqual(fs.readFileSync(path.join(repo, task)), mainBefore);
});

test('prepare with a legacy prepared worker branch → backfills it without renaming its checkout', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/015-x/blueprints/016-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'), '---\nbouncer:\n  depends_on: []\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' });
  execFileSync('git', ['worktree', 'add', '-b', 'legacy/015-016-001', paths.workerPath, 'HEAD'], { cwd: boot.integrationPath });
  const ledger = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  delete ledger.integrationBranch;
  ledger.tasks[0].status = 'prepared';
  ledger.tasks[0].workerPath = paths.workerPath;
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.integrationBranch, undefined);
  assert.strictEqual(result.tasks[0].branch, 'legacy/015-016-001');
  assert.strictEqual(JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8')).integrationBranch, 'feat/015-016-y');
  assert.strictEqual(execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: paths.workerPath, encoding: 'utf8' }).trim(),
    'legacy/015-016-001');
});

test('prepare with a verification-only ready wave → still validates the integration commit type', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/021-x/blueprints/022-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
    '---\nbouncer:\n  execution_kind: verification\n  depends_on: []\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  // prepare는 commit_type을 integration 사본에서 읽는다. main에 쓰면 판정에 닿지 않는다.
  fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'index.md'), '---\nbouncer:\n  commit_type: wip\n---\n');
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'invalid-commit-type');
  // verification-only wave는 worker branch를 만들지 않지만 commit_type 검증은 그대로 받는다.
  // 거절은 node를 ready로 옮기기 전이라 원장의 task 상태가 bootstrap 그대로 남는다.
  const ledger = JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.strictEqual(ledger.tasks[0].status || 'pending', 'pending');
});

test('standalone branch and a later ready-wave conflict → create no coordinator worktree', () => {
  const repo = repoTemplate.copy();
  const standaloneBlueprint = '.bouncer/context/epics/017-x/blueprints/018-y';
  fs.mkdirSync(path.join(repo, standaloneBlueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, standaloneBlueprint, 'tasks/001/tasks.md'), '---\nbouncer: {}\n---\n');
  const { worktreePathFor, coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const standalone = worktreePathFor({ repoRoot: repo, blueprint: standaloneBlueprint });
  fs.mkdirSync(path.dirname(standalone), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'feat/017-018-y', standalone, 'HEAD'], { cwd: repo });
  const conflict = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: standaloneBlueprint });
  assert.strictEqual(conflict.reason, 'branch-conflict');
  assert.strictEqual(fs.existsSync(coordinatorPathsFor({ repoRoot: repo, blueprint: standaloneBlueprint }).integrationPath), false);

  const blueprint = '.bouncer/context/epics/019-x/blueprints/020-y';
  for (const id of ['001', '002']) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), '---\nbouncer:\n  parallel_safe: true\n---\n');
  }
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  execFileSync('git', ['branch', 'bouncer/019-020-002'], { cwd: repo });
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'branch-conflict');
  assert.strictEqual(fs.existsSync(coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath), false);
});

test('bootstrap with a symlink substituted for its registered integration checkout → rejects it', () => {
  const repo = repoTemplate.copy();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-integration-target-'));
  const blueprint = '.bouncer/context/epics/009-x/blueprints/010-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  fs.rmSync(boot.integrationPath, { recursive: true, force: true });
  fs.symlinkSync(outside, boot.integrationPath, 'dir');

  const result = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });

  assert.deepStrictEqual(result, {
    ok: false, reason: 'unassigned-integration-worktree', integrationPath: boot.integrationPath,
    cause: COORDINATE_FAILURE_HINTS['unassigned-integration-worktree'].cause,
    next: COORDINATE_FAILURE_HINTS['unassigned-integration-worktree'].next,
  });
  assertHinted(result);
  assert.strictEqual(fs.existsSync(path.join(outside, '.bouncer', 'runtime', 'coordinator.json')), false);
});

test('prepare with assigned workers and a record call → seeds each worker and record accepts the worker boundary', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/002-x/blueprints/003-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\nbrief\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.integrationBranch, 'feat/002-003-y');
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true);
  const worker = prepared.tasks[0].workerPath;
  assert.strictEqual(prepared.tasks[0].branch, 'bouncer/002-003-001');
  const ledger = JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8'));
  assert.strictEqual(ledger.integrationBranch, boot.integrationBranch);
  assert.strictEqual(fs.readFileSync(path.join(worker, blueprint, 'tasks', '001', 'tasks.md'), 'utf8').includes('brief'), true);
  acceptDispatchReport(repo, blueprint, worker, '001');
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true);
});

// 계획 문서를 커밋하지 않은 fixture. bootstrap이 integration에 seed한 뒤로는
// integration 사본만 정본이므로, main 사본을 지워도 drive가 이어져야 한다.
function uncommittedPlanRepo(prefix, blueprint, tasks) {
  // identity는 템플릿의 저장소 config에 있어, fan-in cherry-pick이 전역 identity 없이 돈다.
  const repo = repoTemplate.copy();
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{"verify":"node --test"}\n');
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  for (const [id, metadata] of tasks) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n${metadata}---\nbrief ${id}\n`);
  }
  return repo;
}

test('plan fixture repos with identity-less cherry-pick → set local git identity', () => {
  const repo = uncommittedPlanRepo(
    'bouncer-coord-identity-',
    '.bouncer/context/epics/080-id/blueprints/001-x',
    [],
  );
  const email = execFileSync('git', ['config', '--local', 'user.email'], { cwd: repo, encoding: 'utf8' }).trim();
  const name = execFileSync('git', ['config', '--local', 'user.name'], { cwd: repo, encoding: 'utf8' }).trim();
  assert.strictEqual(email, 'test@example.com');
  assert.strictEqual(name, 'test');
});

test('prepare after the main plan is removed → seeds workers from the integration plan', () => {
  const blueprint = '.bouncer/context/epics/040-x/blueprints/041-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-seed-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.rmSync(path.join(repo, blueprint), { recursive: true, force: true });
  fs.rmSync(path.join(repo, '.bouncer/config.json'), { force: true });
  const edited = Buffer.from('---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n---\nintegration edit\n');
  fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'tasks/001/tasks.md'), edited);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker1 = prepared.tasks.find((t) => t.id === '001').workerPath;
  const worker2 = prepared.tasks.find((t) => t.id === '002').workerPath;
  assert.ok(fs.existsSync(path.join(worker1, blueprint, 'tasks/001/tasks.md')));
  assert.deepStrictEqual(fs.readFileSync(path.join(worker1, blueprint, 'tasks/001/tasks.md')), edited);
  assert.deepStrictEqual(fs.readFileSync(path.join(worker2, blueprint, 'tasks/001/tasks.md')), edited);
  assert.strictEqual(fs.readFileSync(path.join(worker1, '.bouncer/config.json'), 'utf8'), '{"verify":"node --test"}\n');
  // prepare는 main을 다시 채우지 않는다.
  assert.strictEqual(fs.existsSync(path.join(repo, blueprint)), false);

  // 병렬 worker는 각자 독립 사본을 받는다. 한 worker의 수정은 다른 worker와
  // integration 정본에 번지지 않는다.
  const shared = path.join(blueprint, 'tasks/002/tasks.md');
  const before = fs.readFileSync(path.join(boot.integrationPath, shared));
  fs.writeFileSync(path.join(worker1, shared), 'worker 001 local edit\n');
  assert.deepStrictEqual(fs.readFileSync(path.join(worker2, shared)), before);
  assert.deepStrictEqual(fs.readFileSync(path.join(boot.integrationPath, shared)), before);
});

test('prepare with a missing integration blueprint → rejects before creating any worker', () => {
  const blueprint = '.bouncer/context/epics/042-x/blueprints/043-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-missing-', blueprint, [['001', '  depends_on: []\n']]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.rmSync(path.join(boot.integrationPath, blueprint), { recursive: true, force: true });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.deepStrictEqual(result, {
    ok: false, reason: 'missing-blueprint', blueprintDir: blueprint, integrationPath: boot.integrationPath,
    cause: COORDINATE_FAILURE_HINTS['missing-blueprint'].cause,
    next: COORDINATE_FAILURE_HINTS['missing-blueprint'].next,
  });
  assertHinted(result);
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.doesNotMatch(listed, /workers/);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

test('prepare with a repaired integration terminal bundle → keeps it without reading main', () => {
  const blueprint = '.bouncer/context/epics/044-x/blueprints/045-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-verify-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.rmSync(path.join(repo, blueprint), { recursive: true, force: true });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[1].status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const repaired = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'], decision: 'repair source',
  });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  const terminalFile = path.join(boot.integrationPath, blueprint, 'tasks/002/tasks.md');
  const terminalAfterRepair = fs.readFileSync(terminalFile);
  const afterRepair = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  afterRepair.tasks.find((entry) => entry.id === '003').status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(afterRepair, null, 2)}\n`);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['002']);
  assert.strictEqual(prepared.tasks.find((entry) => entry.id === '002').status, 'ready');
  assert.deepStrictEqual(fs.readFileSync(terminalFile), terminalAfterRepair);

  // integration에 bundle이 없으면 main에서 되살리지 않고 원장도 그대로 둔다.
  // main에는 tasks/002를 되돌려 두고 integration에서만 지운다. main을 읽는 구현이면
  // 여기서 bundle을 되살려 통과하므로, 이 배치가 main 비의존을 가른다.
  const reset = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  reset.tasks.find((entry) => entry.id === '002').status = 'pending';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(reset, null, 2)}\n`);
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/002'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/002/tasks.md'), terminalAfterRepair);
  const integrationBundle = path.join(boot.integrationPath, blueprint, 'tasks/002');
  fs.rmSync(integrationBundle, { recursive: true, force: true });
  const missing = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(missing.reason, 'missing-verification-bundle');
  assert.strictEqual(fs.existsSync(integrationBundle), false);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

// 디렉터리 아래 모든 파일의 상대 경로와 바이트. 실패 전후 사본을 바이트 단위로 대조한다.
function snapshotTree(root) {
  const files = {};
  const visit = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const child = path.join(dir, name);
      if (fs.statSync(child).isDirectory()) visit(child);
      else files[path.relative(root, child)] = fs.readFileSync(child);
    }
  };
  visit(root);
  return files;
}

test('prepare with copy-failed on a second worker → removes the created first worker and keeps a reused second', () => {
  const blueprint = '.bouncer/context/epics/046-x/blueprints/047-y';
  const repo = uncommittedPlanRepo('bouncer-coordinator-seedfail-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  // 002 worker를 미리 등록해 prepare가 재사용하게 하고, blueprint가 들어갈 자리의 조상을
  // 일반 파일로 막는다. 001 seed가 끝난 뒤 002의 cpSync만 결정적으로 실패한다.
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const worker1 = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath;
  const worker2 = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '002' }).workerPath;
  fs.mkdirSync(path.dirname(worker2), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'bouncer/046-047-002', worker2, 'HEAD'], { cwd: boot.integrationPath });
  fs.mkdirSync(path.join(worker2, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(worker2, '.bouncer/context'), 'blocks the blueprint copy\n');
  const mainBefore = snapshotTree(path.join(repo, '.bouncer'));
  const integrationPlan = snapshotTree(path.join(boot.integrationPath, blueprint));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'copy-failed', JSON.stringify(result));
  assert.deepStrictEqual(snapshotTree(path.join(repo, '.bouncer')), mainBefore);
  assert.deepStrictEqual(snapshotTree(path.join(boot.integrationPath, blueprint)), integrationPlan);
  assert.strictEqual(fs.existsSync(worker1), false);
  assert.strictEqual(
    execFileSync('git', ['branch', '--list', 'bouncer/046-047-001'], { cwd: repo, encoding: 'utf8' }).trim(),
    '',
  );
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.match(listed, new RegExp(`^worktree ${worker2.replace(/\\/g, '\\\\')}$`, 'm'));
  assert.doesNotMatch(listed, new RegExp(`^worktree ${worker1.replace(/\\/g, '\\\\')}$`, 'm'));
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

/**
 * worker worktree가 `npm ci`를 타려면 lockfile이 HEAD에 있어야 한다. 작업 트리에만
 * 두면 `git worktree add`가 가져오지 않아 mock이 npm을 보지 못한다.
 *
 * @param {string} integrationPath - integration checkout
 */
function commitIntegrationPackageLock(integrationPath) {
  fs.writeFileSync(path.join(integrationPath, 'package-lock.json'), '{}\n');
  execFileSync('git', ['add', 'package-lock.json'], { cwd: integrationPath });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'lock'], {
    cwd: integrationPath,
  });
}

function gitBranchList(repo, branch) {
  return execFileSync('git', ['branch', '--list', branch], { cwd: repo, encoding: 'utf8' }).trim();
}

test('prepare with an approved scope → shares main node_modules only for tasks that leave package files alone', () => {
  const blueprint = '.bouncer/context/epics/108-share/blueprints/001-scope';
  const repo = uncommittedPlanRepo('bouncer-prepare-share-scope-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - src/\n'],
    ['002', '  depends_on: []\n  parallel_safe: true\n  affected_paths:\n    - package.json\n'],
  ]);
  // main이 이 lock으로 설치를 끝낸 상태: lock, marker, 같은 hash의 stamp, 직접 패키지 metadata.
  const lock = '{"v":1}\n';
  fs.writeFileSync(path.join(repo, 'package-lock.json'), lock);
  fs.writeFileSync(path.join(repo, 'package.json'), '{"devDependencies":{"left-pad":"1.0.0"}}\n');
  execFileSync('git', ['add', 'package-lock.json', 'package.json'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'lock'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  fs.mkdirSync(path.join(repo, 'node_modules/left-pad'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'node_modules/left-pad/package.json'), '{}\n');
  fs.writeFileSync(path.join(repo, 'node_modules/.package-lock.json'), '{}\n');
  fs.writeFileSync(
    path.join(repo, 'node_modules/.bouncer-lock-sha256'),
    `${crypto.createHash('sha256').update(lock).digest('hex')}\n`,
  );
  const npmCwds = [];
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          npmCwds.push(options.cwd);
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workerOf = (id) => prepared.tasks.find((t) => t.id === id || t.task === id).workerPath;
  const isLink = (worker) => fs.lstatSync(path.join(worker, 'node_modules'), { throwIfNoEntry: false })?.isSymbolicLink() === true;
  assert.strictEqual(isLink(workerOf('001')), true);
  assert.strictEqual(isLink(workerOf('002')), false);
  assert.deepStrictEqual(npmCwds, [workerOf('002')]);
});

test('prepare during worktree add and npm → holds no ledger lock', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/001-absent';
  const repo = uncommittedPlanRepo('bouncer-prepare-lock-absent-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const lockFile = `${ledgerFile}.lock`;
  let worktreeAdds = 0;
  let npmCalls = 0;
  const result = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'git' && Array.isArray(args) && args[0] === 'worktree' && args[1] === 'add') {
          assert.strictEqual(fs.existsSync(lockFile), false);
          worktreeAdds += 1;
        }
        if (command === 'npm') {
          assert.strictEqual(fs.existsSync(lockFile), false);
          npmCalls += 1;
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(worktreeAdds >= 1, `worktree add count ${worktreeAdds}`);
  assert.ok(npmCalls >= 1, `npm count ${npmCalls}`);
});

test('prepare with the ledger changing during seed → returns stale-ledger-checkpoint and removes the created worker', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/002-stale';
  const repo = uncommittedPlanRepo('bouncer-prepare-ledger-stale-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const worker = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  let mutated;
  const result = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          fs.appendFileSync(ledgerFile, '\n');
          mutated = fs.readFileSync(ledgerFile);
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(result.reason, 'stale-ledger-checkpoint', JSON.stringify(result));
  assert.deepStrictEqual(fs.readFileSync(ledgerFile), mutated);
  assert.strictEqual(fs.existsSync(worker), false);
  assert.strictEqual(gitBranchList(repo, 'bouncer/087-002-001'), '');
});

test('prepare with an npm failure → returns dependency-install-failed and removes the created worker', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/003-npm';
  const repo = uncommittedPlanRepo('bouncer-prepare-npm-fail-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const worker = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile);
  const result = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') throw new Error('npm ci failed');
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(result.reason, 'dependency-install-failed', JSON.stringify(result));
  assert.deepStrictEqual(fs.readFileSync(ledgerFile), ledgerBefore);
  assert.strictEqual(fs.existsSync(worker), false);
  assert.strictEqual(gitBranchList(repo, 'bouncer/087-003-001'), '');
});

test('prepare with a stale ledger lock appearing during seed → succeeds', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/004-stale-lock';
  const repo = uncommittedPlanRepo('bouncer-prepare-stale-lock-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const result = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          fs.writeFileSync(`${ledgerFile}.lock`, JSON.stringify({
            pid: 1, token: 'stale', at: Date.now() - 60000,
          }));
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const workerPath = result.tasks[0].workerPath;
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.match(listed, new RegExp(`^worktree ${workerPath.replace(/\\/g, '\\\\')}$`, 'm'));
});

test('prepare with the created worker vanishing during seed → returns unassigned-worker-worktree', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/005-lost';
  const repo = uncommittedPlanRepo('bouncer-prepare-worker-lost-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const worker = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile);
  const result = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          execFileSync('git', ['worktree', 'remove', '--force', worker], { cwd: boot.integrationPath });
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(result.reason, 'unassigned-worker-worktree', JSON.stringify(result));
  assert.deepStrictEqual(fs.readFileSync(ledgerFile), ledgerBefore);
});

test('prepare after an interrupted create with a registered worker → reuses it and records a single worktree', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/006-reuse';
  const repo = uncommittedPlanRepo('bouncer-prepare-reuse-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const worker = coordinatorPathsFor({ repoRoot: repo, blueprint, task: '001' }).workerPath;
  fs.mkdirSync(path.dirname(worker), { recursive: true });
  execFileSync('git', ['worktree', 'add', '-b', 'bouncer/087-006-001', worker, 'HEAD'], {
    cwd: boot.integrationPath,
  });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  assert.strictEqual(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks[0].status, 'pending');
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.tasks[0].status, 'prepared');
  assert.strictEqual(result.tasks[0].workerPath, worker);
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  const workerLines = listed.split('\n').filter((line) => line.startsWith('worktree ') && line.includes(`${path.sep}workers${path.sep}`));
  assert.strictEqual(workerLines.length, 1);
  assert.strictEqual(workerLines[0], `worktree ${worker}`);
});

test('prepare calls overlapping the same fence → the nested call wins and the outer sees stale-ledger-checkpoint', () => {
  const blueprint = '.bouncer/context/epics/087-lock/blueprints/007-overlap';
  const repo = uncommittedPlanRepo('bouncer-prepare-overlap-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  let nested = null;
  let reentered = false;
  const first = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          if (reentered) return Buffer.from('');
          reentered = true;
          nested = coordinate({
            command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
            deps: {
              execFileSync(innerCommand, innerArgs, innerOptions) {
                if (innerCommand === 'npm') return Buffer.from('');
                return execFileSync(innerCommand, innerArgs, innerOptions);
              },
            },
          });
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
    },
  });
  assert.strictEqual(nested.ok, true, JSON.stringify(nested));
  assert.strictEqual(first.reason, 'stale-ledger-checkpoint', JSON.stringify(first));
  assertHinted(first);
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.ok(fs.existsSync(after.tasks[0].workerPath));
});

test('a missing verification bundle in a mixed wave → is rejected before any worker worktree exists', () => {
  const blueprint = '.bouncer/context/epics/048-x/blueprints/049-y';
  // 기본 maxParallel 2 안에서 verification이 wave에 들어가도록 commit 하나와
  // 묶는다. 세 개를 넣으면 한도 때문에 verification이 빠져 거절 경로를 못 탄다.
  const repo = uncommittedPlanRepo('bouncer-coordinator-mixed-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
    ['002', '  execution_kind: verification\n  depends_on: []\n  parallel_safe: true\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.deepStrictEqual(boot.ready, ['001', '002']);
  fs.rmSync(path.join(boot.integrationPath, blueprint, 'tasks/002'), { recursive: true, force: true });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');

  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(result.reason, 'missing-verification-bundle');
  const listed = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repo, encoding: 'utf8' });
  assert.doesNotMatch(listed, /workers/);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);
});

// task bundle 세 문서를 지정한 상태로 쓴다. commit_sha는 `bouncer commit`이 찍는
// 8자리 short SHA 자리이고, 따옴표로 감싸 숫자뿐인 SHA도 문자열로 남긴다.
function writeBundle(root, blueprint, id, { tasks, verification, review, commitSha }) {
  const dir = path.join(root, blueprint, 'tasks', id);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = commitSha ? `  commit_sha: '${commitSha}'\n` : '';
  fs.writeFileSync(path.join(dir, 'tasks.md'),
    `---\nbouncer:\n  id: TASKS-${id}\n  status: ${tasks}\n  depends_on: []\n  parallel_safe: true\n${stamp}---\nbrief ${id}\n`);
  fs.writeFileSync(path.join(dir, 'verification.md'),
    `---\nbouncer:\n  id: VERIFY-${id}\n  status: ${verification}\n---\n# Verification\n`);
  fs.writeFileSync(path.join(dir, 'review.md'),
    `---\nbouncer:\n  id: REVIEW-${id}\n  status: ${review}\n---\n# Review\n`);
}

const SCAFFOLD = { tasks: 'ready', verification: 'pending', review: 'pending' };
const TERMINAL = { tasks: 'verified', verification: 'passed', review: 'accepted' };

// 계획을 커밋하지 않은 두 task drive를 001 record까지 진행한다. worker와 integration의
// bundle은 모두 scaffold 상태이고, 001 worker만 source 커밋 하나를 가진다.
function recordedDrive(prefix, blueprint) {
  const repo = uncommittedPlanRepo(prefix, blueprint, []);
  for (const id of ['001', '002']) writeBundle(repo, blueprint, id, SCAFFOLD);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((entry) => entry.id === '001').workerPath;
  fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
  fs.writeFileSync(path.join(worker, 'src/task.js'), 'changed by 001\n');
  execFileSync('git', ['add', 'src/task.js'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'feat: 001'],
    { cwd: worker });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  acceptDispatchReport(repo, blueprint, worker, '001');
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  return {
    repo, worker, sha, integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
    head: () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: boot.integrationPath, encoding: 'utf8' }).trim(),
  };
}

test('commit integrate with worker evidence that is not terminal or stamps another SHA → refuses it', () => {
  const blueprint = '.bouncer/context/epics/050-x/blueprints/051-y';
  const drive = recordedDrive('bouncer-coordinator-evidence-', blueprint);
  const bundle = `${blueprint}/tasks/001`;
  const integrationBundle = snapshotTree(path.join(drive.integrationPath, bundle));
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const headBefore = drive.head();

  // scaffold 상태 그대로 record한 worker는 증적이 없다.
  const scaffold = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
  });
  assert.strictEqual(scaffold.reason, 'worker-evidence-not-terminal', JSON.stringify(scaffold));
  assert.deepStrictEqual(scaffold.files,
    ['tasks.md', 'verification.md', 'review.md'].map((name) => `${bundle}/${name}`));
  assert.strictEqual(drive.head(), headBefore);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.deepStrictEqual(snapshotTree(path.join(drive.integrationPath, bundle)), integrationBundle);

  // 상태가 terminal이어도 다른 커밋의 SHA가 찍힌 증적은 이 fan-in의 증적이 아니다.
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: 'deadbeef' });
  const mismatch = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
  });
  assert.strictEqual(mismatch.reason, 'worker-evidence-sha-mismatch', JSON.stringify(mismatch));
  // 안내는 brief 복원이 아니라 커밋·stamp 확인 뒤 rerecord를 가리킨다.
  assert.ok(mismatch.next.includes('rerecord'), mismatch.next);
  assert.ok(!/brief/i.test(mismatch.next), mismatch.next);
  assert.deepStrictEqual(mismatch.files, [`${bundle}/tasks.md`]);
  assert.strictEqual(drive.head(), headBefore);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.deepStrictEqual(snapshotTree(path.join(drive.integrationPath, bundle)), integrationBundle);
});

// 001 worker를 terminal 증적까지 갖춘 integrate 가능 상태로 만든다.
function integrableDrive(prefix, blueprint) {
  const drive = recordedDrive(prefix, blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  return drive;
}
const integrateOne = (drive, blueprint) => coordinate({
  command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
  deps: { runVerification: passVerify },
});

test('integration checkout with an uncommitted file outside the allowed paths → integrate refuses with integration-source-mutated and keeps the ledger bytes', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/001-mutated';
  const drive = integrableDrive('bouncer-integrate-mutated-', blueprint);
  fs.mkdirSync(path.join(drive.integrationPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(drive.integrationPath, 'src/extra.js'), 'direct edit\n');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const headBefore = drive.head();

  const refused = integrateOne(drive, blueprint);
  assert.strictEqual(refused.ok, false, JSON.stringify(refused));
  assert.strictEqual(refused.reason, 'integration-source-mutated');
  assert.ok(refused.paths.includes('src/extra.js'), JSON.stringify(refused.paths));
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.strictEqual(drive.head(), headBefore);

  // 직접 수정분을 되돌리면 같은 호출이 통과한다.
  fs.rmSync(path.join(drive.integrationPath, 'src/extra.js'));
  const retried = integrateOne(drive, blueprint);
  assert.strictEqual(retried.ok, true, JSON.stringify(retried));
});

test('integration checkout with Korean and " -> " named uncommitted files → integrate refuses with the unescaped paths sorted', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/001-quoted';
  const drive = integrableDrive('bouncer-integrate-quoted-', blueprint);
  fs.mkdirSync(path.join(drive.integrationPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(drive.integrationPath, 'src/한글 파일.js'), 'x\n');
  fs.writeFileSync(path.join(drive.integrationPath, 'src/a -> b.js'), 'x\n');

  const refused = integrateOne(drive, blueprint);
  assert.strictEqual(refused.reason, 'integration-source-mutated', JSON.stringify(refused));
  assert.deepStrictEqual(refused.paths, ['src/a -> b.js', 'src/한글 파일.js']);

  fs.rmSync(path.join(drive.integrationPath, 'src/한글 파일.js'));
  fs.rmSync(path.join(drive.integrationPath, 'src/a -> b.js'));
  const retried = integrateOne(drive, blueprint);
  assert.strictEqual(retried.ok, true, JSON.stringify(retried));
});

test('integration checkout with a staged rename to a Korean path → integrate reports both the old and the new unescaped path', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/001-renamed';
  const drive = integrableDrive('bouncer-integrate-renamed-', blueprint);
  const cwd = drive.integrationPath;
  // 허용 목록 밖이고 추적 중인 소스 파일 하나를 고른다.
  const old = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' })
    .split('\0').find((f) => f && !f.startsWith('.bouncer/') && !f.startsWith('.worktrees/') && /^[\x20-\x7e]+$/.test(f));
  assert.ok(old, 'tracked ASCII file outside .bouncer');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  execFileSync('git', ['mv', old, 'src/옮긴 파일.js'], { cwd });

  const refused = integrateOne(drive, blueprint);
  assert.strictEqual(refused.reason, 'integration-source-mutated', JSON.stringify(refused));
  assert.deepStrictEqual(refused.paths, [old, 'src/옮긴 파일.js'].sort());
});

test('dynamic task directory with a non-evidence file → integrate refuses with integration-source-mutated for that file only and keeps the ledger bytes', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/001-dynamic';
  const drive = integrableDrive('bouncer-integrate-dynamic-', blueprint);
  // repair가 남긴 dynamic task 009: 증적 문서는 허용되고 같은 디렉터리의 증적 외 파일만 거절되어야 한다.
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  ledger.tasks.push({
    id: '009', depends_on: [], dependency_gate: 'integrated', parallel_safe: false,
    execution_kind: 'commit', status: 'pending', dynamic: true,
  });
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const dir = path.join(drive.integrationPath, blueprint, 'tasks/009');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tasks.md'), 'repair doc\n');
  fs.writeFileSync(path.join(dir, 'notes.md'), 'stray\n');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');

  const refused = integrateOne(drive, blueprint);
  assert.strictEqual(refused.reason, 'integration-source-mutated', JSON.stringify(refused));
  assert.deepStrictEqual(refused.paths, [`${blueprint}/tasks/009/notes.md`]);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('integration checkout dirty only at seeded plan paths and earlier wave evidence → integrate succeeds', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/002-allowed';
  const drive = integrableDrive('bouncer-integrate-allowed-', blueprint);
  // 계획이 미커밋이라 seed 경로는 이미 dirty이다. 이전 wave evidence도 dirty로 남긴다.
  const first = integrateOne(drive, blueprint);
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  });
  assert.ok(status.includes(`${blueprint}/tasks/001/tasks.md`), status);
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks.find((t) => t.id === '001').status, 'integrated');
  // 두 번째 integrate가 필요한 task는 없으므로 nothing-to-integrate이지 mutated가 아니다.
  const second = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(second.reason, 'nothing-to-integrate', JSON.stringify(second));
});

test('dirty extra file with a verification node integrate or a light ledger → dirty check does not apply', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/003-skip';
  const repo = uncommittedPlanRepo('bouncer-integrate-skip-ver-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  fs.writeFileSync(path.join(boot.integrationPath, 'extra.js'), 'direct edit\n');
  const verified = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: passVerify },
  });
  assert.notStrictEqual(verified.reason, 'integration-source-mutated', JSON.stringify(verified));
  assert.strictEqual(verified.ok, true, JSON.stringify(verified));

  const lightBp = '.bouncer/context/epics/098-x/blueprints/004-skip-light';
  const light = lightScaleRepo('bouncer-integrate-skip-light-', lightBp);
  const lightBoot = coordinate({ command: 'bootstrap', repoRoot: light.repo, blueprint: lightBp });
  fs.writeFileSync(path.join(lightBoot.integrationPath, 'extra.js'), 'direct edit\n');
  const lightResult = coordinate({
    command: 'integrate', repoRoot: light.repo, blueprint: lightBp, cwd: lightBoot.integrationPath,
  });
  assert.strictEqual(lightResult.reason, 'nothing-to-integrate', JSON.stringify(lightResult));
});

test('report Changed files one path short of the commit → integrate succeeds with a report-paths-mismatch warning', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/005-warn';
  const drive = integrableDrive('bouncer-integrate-warn-', blueprint);
  // 기본 보고는 src/a.js를 적지만 커밋은 src/task.js만 바꾼다. backtick이 없는 항목은
  // 경로 집합에서 빠지므로 src/task.js를 backtick 없이 적으면 커밋 경로가 extra로 남는다.
  const reportFile = path.join(drive.worker, '.bouncer/runtime/reports/001-1.md');
  const body = fs.readFileSync(reportFile, 'utf8');
  fs.writeFileSync(reportFile, body.replace(/## Changed files\n[^\n]*\n/, '## Changed files\n- src/task.js without backticks\n'));
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');

  const result = integrateOne(drive, blueprint);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.warnings[0],
    { task: '001', code: 'report-paths-mismatch', missing: [], extra: ['src/task.js'] });
  // 경고는 결과 JSON에만 있고 ledger에는 쓰이지 않는다.
  assert.ok(!fs.readFileSync(drive.ledgerFile, 'utf8').includes('report-paths-mismatch'));
  void ledgerBefore;
});

test('report Changed files naming exactly the commit paths → integrate result has no warnings key', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/006-nowarn';
  const drive = integrableDrive('bouncer-integrate-nowarn-', blueprint);
  const reportFile = path.join(drive.worker, '.bouncer/runtime/reports/001-1.md');
  const body = fs.readFileSync(reportFile, 'utf8');
  fs.writeFileSync(reportFile, body.replace('`src/a.js`', '`src/task.js`'));
  const result = integrateOne(drive, blueprint);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual('warnings' in result, false);
});

test('missing report file or Changed files heading → integrate warns report-changed-files-unavailable', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/007-unavail';
  const drive = integrableDrive('bouncer-integrate-unavail-', blueprint);
  fs.rmSync(path.join(drive.worker, '.bouncer/runtime/reports/001-1.md'));
  const result = integrateOne(drive, blueprint);
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.warnings, [{ task: '001', code: 'report-changed-files-unavailable' }]);

  const headingBp = '.bouncer/context/epics/098-x/blueprints/008-unavail-heading';
  const second = integrableDrive('bouncer-integrate-unavail-h-', headingBp);
  const reportFile = path.join(second.worker, '.bouncer/runtime/reports/001-1.md');
  fs.writeFileSync(reportFile, fs.readFileSync(reportFile, 'utf8').replace('## Changed files', '## Files'));
  const headingResult = integrateOne(second, headingBp);
  assert.strictEqual(headingResult.ok, true, JSON.stringify(headingResult));
  assert.deepStrictEqual(headingResult.warnings, [{ task: '001', code: 'report-changed-files-unavailable' }]);
});

test('a cherry-pick CONFLICT → returns fanin-conflict without touching canonical HEAD', () => {
  const blueprint = '.bouncer/context/epics/054-x/blueprints/055-y';
  const drive = recordedDrive('bouncer-coordinator-restore-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  const bundle = path.join(drive.integrationPath, blueprint, 'tasks/001');
  const bundleBefore = snapshotTree(bundle);
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const headBefore = drive.head();
  // RD-001: fanin-conflict는 git CONFLICT만. stderr에 CONFLICT가 있어야 revoke 경로다.
  const failingCherryPick = (file, args, options) => {
    if (args[0] === 'cherry-pick' && args[1] !== '--abort') {
      const err = new Error('CONFLICT (content): Merge conflict in README.md');
      err.stderr = 'error: could not apply abc\nCONFLICT (content): Merge conflict in README.md\n';
      err.status = 1;
      throw err;
    }
    return execFileSync(file, args, options);
  };

  const conflicted = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      execFileSync: failingCherryPick,
      runVerification: () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }),
    },
  });
  assert.strictEqual(conflicted.reason, 'fanin-conflict');
  assert.strictEqual(conflicted.task, '001');
  assert.deepStrictEqual(snapshotTree(bundle), bundleBefore);
  assert.strictEqual(drive.head(), headBefore);
  const after = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(after.fanin, null);
  assert.strictEqual(after.tasks.find((t) => t.id === '001').status, 'pending');
  const { faninPath } = __coordinatorPathsFor({ repoRoot: drive.repo, blueprint });
  assert.strictEqual(fs.existsSync(faninPath), false);
  // 거절 경로가 원장 decision을 쓰므로 bytes는 달라도 canonical HEAD는 그대로다.
  void ledgerBefore;
});

test('a non-conflict cherry-pick failure → aborts the candidate without a fanin-conflict revoke', () => {
  // RD-001: bad object 등 CONFLICT가 아닌 실패는 revoke하지 않고 candidate만 정리한다.
  const blueprint = '.bouncer/context/epics/054-x/blueprints/056-y';
  const drive = recordedDrive('bouncer-coordinator-pick-fail-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  const headBefore = drive.head();
  const failingCherryPick = (file, args, options) => {
    if (args[0] === 'cherry-pick' && args[1] !== '--abort') {
      const err = new Error('bad object deadbeef');
      err.stderr = 'fatal: bad object deadbeef\n';
      err.status = 128;
      throw err;
    }
    return execFileSync(file, args, options);
  };

  const failed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      execFileSync: failingCherryPick,
      runVerification: () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }),
    },
  });
  assert.strictEqual(failed.reason, 'cherry-pick-failed');
  assert.strictEqual(failed.task, '001');
  assert.notStrictEqual(failed.reason, 'fanin-conflict');
  assert.strictEqual(drive.head(), headBefore);
  const after = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(after.fanin, null);
  assert.strictEqual(after.tasks.find((t) => t.id === '001').status, 'recorded');
  const { faninPath } = __coordinatorPathsFor({ repoRoot: drive.repo, blueprint });
  assert.strictEqual(fs.existsSync(faninPath), false);
});

test('the worker-trailer amend fails after a clean cherry-pick → stops as cherry-pick-failed without abort or verified fanin', () => {
  const blueprint = '.bouncer/context/epics/054-x/blueprints/057-y';
  const drive = recordedDrive('bouncer-coordinator-amend-fail-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  const calls = [];
  const failingAmend = (file, args, options) => {
    calls.push(args[0] === 'cherry-pick' ? `cherry-pick ${args[1]}` : args.join(' '));
    if (args[0] === 'commit' && args.includes('--amend')) {
      const err = new Error('amend failed');
      err.stderr = 'fatal: unable to write commit\n';
      err.status = 128;
      throw err;
    }
    return execFileSync(file, args, options);
  };

  const failed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      execFileSync: failingAmend,
      runVerification: () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }),
    },
  });
  assert.strictEqual(failed.reason, 'cherry-pick-failed', JSON.stringify(failed));
  assert.strictEqual(failed.task, '001');
  // cherry-pick은 이미 끝나 진행 중 상태가 없으므로 abort를 부르지 않는다.
  assert.strictEqual(calls.includes('cherry-pick --abort'), false);
  const after = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(after.fanin, null);
  assert.strictEqual(after.tasks.find((t) => t.id === '001').status, 'recorded');
  const { faninPath } = __coordinatorPathsFor({ repoRoot: drive.repo, blueprint });
  assert.strictEqual(fs.existsSync(faninPath), false);
});

test('a single-commit worker range → fan-in keeps cherry-pick, log, amend order without a squash', () => {
  const blueprint = '.bouncer/context/epics/054-x/blueprints/058-z';
  const drive = recordedDrive('bouncer-coordinator-single-order-', blueprint);
  writeBundle(drive.worker, blueprint, '001', { ...TERMINAL, commitSha: drive.sha.slice(0, 8) });
  const calls = [];
  const recording = (file, args, options) => {
    calls.push(args[0]);
    return execFileSync(file, args, options);
  };
  const done = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      execFileSync: recording,
      runVerification: () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }),
    },
  });
  assert.strictEqual(done.ok, true, JSON.stringify(done));
  const pick = calls.indexOf('cherry-pick');
  const log = calls.indexOf('log', pick);
  const amend = calls.indexOf('commit', log);
  assert.ok(pick >= 0 && log === pick + 1 && amend === log + 1, calls.join(','));
  assert.strictEqual(calls.filter((c) => c === 'cherry-pick').length, 1);
  assert.strictEqual(calls.includes('reset'), false);
});

test('record with a SHA that is not the assigned worker HEAD → refuses it', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/004-x/blueprints/005-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  acceptDispatchReport(repo, blueprint, prepared.tasks[0].workerPath, '001');
  const result = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: prepared.tasks[0].workerPath, task: '001', sha: 'deadbeef' });
  assert.deepStrictEqual(result, {
    ok: false, reason: 'sha-not-worker-head',
    cause: COORDINATE_FAILURE_HINTS['sha-not-worker-head'].cause,
    next: COORDINATE_FAILURE_HINTS['sha-not-worker-head'].next,
  });
});

test('record with a prepared worker path replaced by an external symlink → rejects it', () => {
  const repo = repoTemplate.copy();
  const outside = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/005-x/blueprints/006-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const worker = prepared.tasks[0].workerPath;
  fs.rmSync(worker, { recursive: true, force: true });
  fs.symlinkSync(outside, worker, 'dir');

  const result = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });

  assert.deepStrictEqual(result, {
    ok: false, reason: 'unassigned-worker-worktree', workerPath: worker,
    cause: COORDINATE_FAILURE_HINTS['unassigned-worker-worktree'].cause,
    next: COORDINATE_FAILURE_HINTS['unassigned-worker-worktree'].next,
  });
});

test('integrate with a recorded worker path replaced by a symlink to main → rejects it', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/007-x/blueprints/008-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const worker = prepared.tasks[0].workerPath;
  acceptDispatchReport(repo, blueprint, worker, '001');
  assert.strictEqual(coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' }).ok, true);
  fs.rmSync(worker, { recursive: true, force: true });
  fs.symlinkSync(repo, worker, 'dir');

  const result = coordinate({ command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001' });

  assert.deepStrictEqual(result, {
    ok: false, reason: 'sha-not-owned-by-worker',
    cause: COORDINATE_FAILURE_HINTS['sha-not-owned-by-worker'].cause,
    next: COORDINATE_FAILURE_HINTS['sha-not-owned-by-worker'].next,
  });
});

test('prepare with an ordinary directory at an assigned worker path → refuses it', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/006-x/blueprints/007-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const worker = path.join(repo, '.worktrees', '006', '007', 'workers', '001');
  fs.mkdirSync(worker, { recursive: true });
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.deepStrictEqual(result, {
    ok: false, reason: 'unassigned-worker-worktree', workerPath: worker,
    cause: COORDINATE_FAILURE_HINTS['unassigned-worker-worktree'].cause,
    next: COORDINATE_FAILURE_HINTS['unassigned-worker-worktree'].next,
  });
  assert.strictEqual(fs.existsSync(path.join(worker, blueprint)), false);
});

test('prepare with a symlink at an assigned worker path → refuses before seeding', () => {
  const repo = repoTemplate.copy();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-worker-target-'));
  const blueprint = '.bouncer/context/epics/008-x/blueprints/009-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n---\n');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const worker = path.join(repo, '.worktrees', '008', '009', 'workers', '001');
  fs.mkdirSync(path.dirname(worker), { recursive: true });
  fs.symlinkSync(outside, worker, 'dir');
  const result = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.deepStrictEqual(result, {
    ok: false, reason: 'unassigned-worker-worktree', workerPath: worker,
    cause: COORDINATE_FAILURE_HINTS['unassigned-worker-worktree'].cause,
    next: COORDINATE_FAILURE_HINTS['unassigned-worker-worktree'].next,
  });
  assert.strictEqual(fs.existsSync(path.join(outside, blueprint)), false);
});


/**
 * prepared commit task fixture. bootstrap·prepare만 끝내 worker를 돌려준다.
 */
function preparedCommitDrive(prefix, blueprint, { affectedPaths = null } = {}) {
  const repo = repoTemplate.copy();
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, blueprint, 'tasks/001/tasks.md'),
    `---\nbouncer:\n  status: ready\n  depends_on: []\n  parallel_safe: true\n  dependency_gate: integrated\n${affectedPaths ? `  affected_paths:\n${affectedPaths.map((entry) => `    - ${entry}\n`).join('')}` : ''}---\nbrief\n`);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  return { repo, blueprint, worker, integrationPath: boot.integrationPath, ledgerFile };
}

function briefHash(worker, blueprint, task) {
  return taskBriefHash(fs.readFileSync(path.join(worker, blueprint, 'tasks', task, 'tasks.md'), 'utf8'));
}

// drive false acceptance 방지: CLI 전략 실패·frozen target 불일치에서는
// review round를 열거나 accepted로 기록하지 않는다. coordinator.ts 전이가 아니라
// Worker dispatch 계약이 막는다 — ledger에 새 상태를 추가하지 않는다.
// 중단 조건은 review·final_review 카드가 단계 입력으로 갖고, CLI 결과를 덮어쓰지 않는
// fan-out 규칙은 agent-dispatch 정본 하나가 갖는다. 둘을 이어 붙이면 어느 쪽이 빠져도
// 다른 쪽이 통과시키므로 문서별로 따로 본다.
test('coordinator agent with a strategy failure or target mismatch → refuses review recording', () => {
  const root = path.join(__dirname, '..');
  const cardsDir = path.join(root, 'references/coordinator-cards');
  for (const card of ['review.md', 'final_review.md']) {
    const md = fs.readFileSync(path.join(cardsDir, card), 'utf8');
    assert.match(md, /bouncer review-dispatch execute|review-dispatch execute/, card);
    assert.match(md, /ok:\s*false|`ok`:\s*`false`/, card);
    assert.match(md, /target[\s\S]{0,100}mismatch|mismatch[\s\S]{0,100}target|frozen[\s\S]{0,80}(?:base|head)/i, card);
    assert.match(
      md,
      /(?:do not|never|stop|halt|abort)[\s\S]{0,160}(?:accepted|review round|record)|(?:accepted|review round)[\s\S]{0,100}(?:do not|never|stop|halt|abort)/i,
      card,
    );
    assert.match(md, /risk_flags/, card);
    assert.ok(md.includes('](../../skills/bouncer-run/references/agent-dispatch.md)'), `${card} must link agent-dispatch`);
  }
  // risk_flags·perspectives는 CLI 그대로; file/line 재계산으로 전략을 바꾸지 않는다.
  const canon = fs.readFileSync(path.join(root, 'skills/bouncer-run/references/agent-dispatch.md'), 'utf8');
  assert.match(canon, /`ok: false`[\s\S]{0,200}stop/);
  assert.match(
    canon,
    /(?:do not|never|without)[\s\S]{0,140}(?:override|recompute|guess)|(?:override|recompute|guess)[\s\S]{0,80}(?:do not|never)/i,
  );
});

test('first dispatch → returns attempt 1 metadata without previous_outcome', () => {
  const blueprint = '.bouncer/context/epics/060-x/blueprints/061-y';
  const drive = preparedCommitDrive('bouncer-dispatch-first-', blueprint);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: drive.worker, encoding: 'utf8' }).trim();
  const clean = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(clean.ok, true, JSON.stringify(clean));
  assert.deepStrictEqual(clean.metadata, {
    attempt: 1,
    task_brief_hash: briefHash(drive.worker, blueprint, '001'),
    base_head: head,
    initial_worktree_state: '',
  });
  assert.strictEqual('previous_outcome' in clean.metadata, false);

  // dirty porcelain은 원문 그대로 저장된다. 활성 attempt를 닫고 다시 연다.
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  ledger.tasks[0].dispatch.status = 'reported';
  ledger.tasks[0].dispatch.outcome = 'rework';
  ledger.tasks[0].dispatch.summary = 'retry dirty';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  fs.writeFileSync(path.join(drive.worker, 'dirty.txt'), 'dirty\n');
  const porcelain = execFileSync('git', ['status', '--porcelain=v1'], {
    cwd: drive.worker, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const dirty = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dirty.ok, true, JSON.stringify(dirty));
  assert.strictEqual(dirty.metadata.attempt, 2);
  assert.strictEqual(dirty.metadata.initial_worktree_state, porcelain);
});

test('duplicate dispatch and an accepted report → rejects the duplicate and enables redispatch with previous_outcome', () => {
  const blueprint = '.bouncer/context/epics/062-x/blueprints/063-y';
  const drive = preparedCommitDrive('bouncer-dispatch-dup-', blueprint);
  const first = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const dup = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dup.ok, false);
  assert.strictEqual(dup.reason, 'dispatch-already-active');

  const hash = first.metadata.task_brief_hash;
  commitAndStampWorker(drive.repo, blueprint, drive.worker);
  writeWorkerReport(drive.worker, '001', 1, hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: hash, outcome: 'accepted', summary: 'implementer done',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  assert.strictEqual(reported.attempt, 1);
  assert.strictEqual(reported.decision.kind, 'report');
  assert.strictEqual(reported.decision.outcome, 'accepted');
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'reported');
  assert.strictEqual(ledger.tasks[0].status, 'prepared');

  // accepted 뒤에도 재디스패치는 가능하지만 previous_outcome을 싣는다.
  const again = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(again.metadata.attempt, 2);
  assert.deepStrictEqual(again.metadata.previous_outcome, {
    outcome: 'accepted', summary: 'implementer done',
  });
});

test('stale report → appends expected/received and keeps the active attempt open', () => {
  const blueprint = '.bouncer/context/epics/064-x/blueprints/065-y';
  const drive = preparedCommitDrive('bouncer-dispatch-stale-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const expected = {
    attempt: dispatched.metadata.attempt,
    task_brief_hash: dispatched.metadata.task_brief_hash,
  };
  const received = {
    attempt: 9,
    task_brief_hash: 'a'.repeat(64),
  };
  const before = fs.readFileSync(drive.ledgerFile, 'utf8');
  // 파일 경로는 활성 dispatch attempt(1) 기준이고, 내용만 늦은 보고 값이다.
  writeWorkerReport(drive.worker, '001', received.attempt, received.task_brief_hash, { pathAttempt: 1 });
  const stale = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: received.attempt, taskBriefHash: received.task_brief_hash,
    outcome: 'accepted', summary: 'late report',
  });
  assert.strictEqual(stale.ok, false);
  assert.strictEqual(stale.reason, 'stale-report');
  assert.deepStrictEqual(stale.expected, expected);
  assert.deepStrictEqual(stale.received, received);
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'active');
  assert.strictEqual(ledger.tasks[0].status, 'prepared');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
  const decision = ledger.decisions.at(-1);
  assert.strictEqual(decision.kind, 'stale-report');
  assert.deepStrictEqual(decision.expected, expected);
  assert.deepStrictEqual(decision.received, received);
  assert.notStrictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), before);
});

/**
 * 새 full 드라이브에서 dispatch만 열고 report 호출 인자와 거절 전 ledger 바이트를 돌려준다.
 */
function openReportAttempt(prefix, blueprint, { commit = true, ...driveOptions } = {}) {
  const drive = preparedCommitDrive(prefix, blueprint, driveOptions);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const { attempt, task_brief_hash: hash } = dispatched.metadata;
  if (commit) commitAndStampWorker(drive.repo, blueprint, drive.worker);
  const report = () => coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt, taskBriefHash: hash, outcome: 'accepted', summary: 'worker done',
  });
  return { drive, attempt, hash, report };
}

function assertRefusedWithoutWrite(drive, run, reason) {
  const before = fs.readFileSync(drive.ledgerFile, 'utf8');
  const refused = run();
  assert.strictEqual(refused.ok, false, JSON.stringify(refused));
  assert.strictEqual(refused.reason, reason);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), before);
  const ledger = JSON.parse(before);
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'active');
  return refused;
}

test('full report whose report file is absent → report-revision-missing without a ledger write', () => {
  const { drive, report } = openReportAttempt('bouncer-report-nofile-', '.bouncer/context/epics/098-x/blueprints/001-y');
  const refused = assertRefusedWithoutWrite(drive, report, 'report-revision-missing');
  assert.ok(refused.report_path.endsWith('.bouncer/runtime/reports/001-1.md'));
});

test('full report whose file lacks the task_brief_hash line → report-revision-missing without a ledger write', () => {
  const { drive, attempt, hash, report } = openReportAttempt(
    'bouncer-report-nohash-', '.bouncer/context/epics/098-x/blueprints/002-y',
  );
  writeWorkerReport(drive.worker, '001', attempt, hash, { revision: `attempt: ${attempt}` });
  assertRefusedWithoutWrite(drive, report, 'report-revision-missing');
});

test('full report whose file attempt differs from the argument → report-revision-conflict without a ledger write', () => {
  const { drive, attempt, hash, report } = openReportAttempt(
    'bouncer-report-conflict-', '.bouncer/context/epics/098-x/blueprints/003-y',
  );
  writeWorkerReport(drive.worker, '001', attempt + 1, hash, { pathAttempt: attempt });
  const refused = assertRefusedWithoutWrite(drive, report, 'report-revision-conflict');
  assert.deepStrictEqual(refused.file, { attempt: attempt + 1, task_brief_hash: hash });
  assert.deepStrictEqual(refused.args, { attempt, task_brief_hash: hash });
});

test('full report whose file lacks Known weaknesses → report-section-missing without a ledger write', () => {
  const { drive, attempt, hash, report } = openReportAttempt(
    'bouncer-report-nosection-', '.bouncer/context/epics/098-x/blueprints/004-y',
  );
  writeWorkerReport(drive.worker, '001', attempt, hash, { weak: null });
  const refused = assertRefusedWithoutWrite(drive, report, 'report-section-missing');
  assert.deepStrictEqual(refused.missing, ['Known weaknesses']);
});

test('full report with a valid file → stores open_choices and known_weaknesses on the ReportDecision', () => {
  const { drive, attempt, hash, report } = openReportAttempt(
    'bouncer-report-items-', '.bouncer/context/epics/098-x/blueprints/005-y',
  );
  writeWorkerReport(drive.worker, '001', attempt, hash, {
    open: '- 환경변수 값의 앞뒤 공백을 제거한다.', weak: '- none',
  });
  const reported = report();
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  assert.deepStrictEqual(reported.decision.open_choices, ['환경변수 값의 앞뒤 공백을 제거한다.']);
  assert.deepStrictEqual(reported.decision.known_weaknesses, []);
});

/**
 * implementer 역할 문서의 파일 보고 template을 실제 attempt·hash로 채운 본문을 만든다.
 * 문서 template을 그대로 쓰므로, 문서가 선택 절(Deviations·Scope impact·Needs planning)을
 * 빼도 parser가 받아 준다는 계약이 문서와 parser 사이에서 함께 고정된다.
 *
 * @param {number} attempt - dispatch가 준 attempt
 * @param {string} hash - dispatch가 준 task_brief_hash
 * @returns {string} 빈 Open choices를 `- none`으로 채운 보고 본문
 */
function filledImplementerReport(attempt, hash) {
  const md = fs.readFileSync(path.join(__dirname, '..', 'agents', 'bouncer-implementer.md'), 'utf8');
  const block = md.match(/## Output contract[\s\S]*?```markdown\n([\s\S]*?)\n```/);
  assert.ok(block, 'implementer Output contract must carry a markdown template');
  return block[1]
    .replace('<attempt you received>', String(attempt))
    .replace('<64 hex you received>', hash)
    .replace('- <interpretation of the spec you had to pick yourself>', '- none');
}

/**
 * 보고 본문에서 한 H2 절을 통째로 뺀다. 필수 절 거절 경로 fixture용이다.
 *
 * @param {string} body - 보고 본문
 * @param {string} heading - 뺄 절 제목
 * @returns {string} 절이 빠진 본문
 */
function dropSection(body, heading) {
  return body.replace(new RegExp(`## ${heading}\\n[\\s\\S]*?(?=\\n## |$)`), '').replace(/\n{3,}/g, '\n\n');
}

test('implementer report without the three optional sections → accepted with empty stored lists, required gaps still refused', () => {
  const { drive, attempt, hash, report } = openReportAttempt(
    'bouncer-report-optional-', '.bouncer/context/epics/098-x/blueprints/006-y',
  );
  const filled = filledImplementerReport(attempt, hash);
  // 전제: 문서 template 자체가 선택 세 절을 담지 않아야 이 회귀가 의미를 가진다.
  for (const optional of ['Deviations', 'Scope impact', 'Needs planning']) {
    assert.ok(!filled.includes(`## ${optional}\n`), `${optional} must be omitted`);
  }
  const reportFile = path.join(drive.worker, '.bouncer/runtime/reports', `001-${attempt}.md`);
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  const write = (body) => fs.writeFileSync(reportFile, `${body}\n`);

  // 필수 revision·heading 누락은 parser 완화 없이 기존 reason으로, ledger를 쓰지 않고 거절된다.
  write(dropSection(filled, 'Brief revision'));
  assertRefusedWithoutWrite(drive, report, 'report-revision-missing');
  write(dropSection(filled, 'Open choices'));
  assert.deepStrictEqual(assertRefusedWithoutWrite(drive, report, 'report-section-missing').missing, ['Open choices']);

  write(filled);
  const accepted = report();
  assert.strictEqual(accepted.ok, true, JSON.stringify(accepted));
  assert.deepStrictEqual(accepted.decision.open_choices, []);
  assert.deepStrictEqual(accepted.decision.known_weaknesses, []);
});

test('record after brief bytes change following an accepted report → rejects', () => {
  const blueprint = '.bouncer/context/epics/066-x/blueprints/067-y';
  const drive = preparedCommitDrive('bouncer-dispatch-stale-record-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  commitAndStampWorker(drive.repo, blueprint, drive.worker);
  writeWorkerReport(drive.worker, '001', 1, dispatched.metadata.task_brief_hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'ready to record',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  fs.appendFileSync(path.join(drive.worker, blueprint, 'tasks/001/tasks.md'), '\nchanged after accept\n');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'stale-worker-report');
  assert.strictEqual(typeof rejected.cause, 'string');
  assert.notStrictEqual(rejected.cause, '');
  assert.strictEqual(typeof rejected.next, 'string');
  assert.notStrictEqual(rejected.next, '');
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].status, 'prepared');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('record after commit stamps commit_sha and status following an accepted report → accepts', () => {
  const blueprint = '.bouncer/context/epics/088-a/blueprints/001-y';
  const drive = preparedCommitDrive('bouncer-record-commit-sha-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker);
  const file = path.join(drive.worker, blueprint, 'tasks/001/tasks.md');
  const doc = readDoc(file);
  doc.data.bouncer.status = 'verified';
  fs.writeFileSync(file, renderDoc(doc.data, doc.body));
  const recorded = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
});

test('accepted report from a worker with only uncommitted source edits → rejects with worker-commit-missing and keeps the ledger bytes', () => {
  const { drive, report } = openReportAttempt(
    'bouncer-report-nocommit-', '.bouncer/context/epics/112-x/blueprints/001-a', { commit: false },
  );
  fs.mkdirSync(path.join(drive.worker, 'src'), { recursive: true });
  fs.writeFileSync(path.join(drive.worker, 'src/task.js'), 'edited, never committed\n');
  writeWorkerReport(drive.worker, '001', 1, briefHash(drive.worker, drive.blueprint, '001'));
  const refused = assertRefusedWithoutWrite(drive, report, 'worker-commit-missing');
  assert.strictEqual(refused.head, refused.integration_head);
  assert.strictEqual(typeof refused.next, 'string');
});

test('accepted report from a worker that committed without a commit_sha stamp → rejects with worker-commit-stamp-mismatch and keeps the ledger bytes', () => {
  const blueprint = '.bouncer/context/epics/112-x/blueprints/002-a';
  const { drive, report } = openReportAttempt('bouncer-report-nostamp-', blueprint, { commit: false });
  commitAndStampWorker(drive.repo, blueprint, drive.worker, '001', { stamp: false });
  writeWorkerReport(drive.worker, '001', 1, briefHash(drive.worker, blueprint, '001'));
  const refused = assertRefusedWithoutWrite(drive, report, 'worker-commit-stamp-mismatch');
  assert.strictEqual(refused.stamp, null);
});

test('non-accepted report from a worker without a commit → still records the rework outcome', () => {
  const blueprint = '.bouncer/context/epics/112-x/blueprints/003-a';
  const { drive, attempt, hash } = openReportAttempt('bouncer-report-rework-nocommit-', blueprint, { commit: false });
  writeWorkerReport(drive.worker, '001', attempt, hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt, taskBriefHash: hash, outcome: 'rework', summary: 'needs another pass',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
});

test('record after the worker recommitted past the stamped HEAD → rejects with worker-commit-stamp-mismatch and keeps the ledger bytes', () => {
  const blueprint = '.bouncer/context/epics/112-x/blueprints/004-a';
  const drive = preparedCommitDrive('bouncer-record-recommit-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker);
  fs.writeFileSync(path.join(drive.worker, 'src/later.js'), 'second commit\n');
  execFileSync('git', ['add', 'src/later.js'], { cwd: drive.worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'feat: later'],
    { cwd: drive.worker });
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false, JSON.stringify(rejected));
  assert.strictEqual(rejected.reason, 'worker-commit-stamp-mismatch');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
  assert.strictEqual(JSON.parse(ledgerBefore).tasks[0].sha, undefined);
});

test('record after the worker edited a file inside the approved scope post-report → rejects with worker-scope-dirty and keeps the ledger bytes', () => {
  const blueprint = '.bouncer/context/epics/112-x/blueprints/005-a';
  const drive = preparedCommitDrive('bouncer-record-scope-dirty-', blueprint, { affectedPaths: ['src/'] });
  acceptDispatchReport(drive.repo, blueprint, drive.worker);
  fs.writeFileSync(path.join(drive.worker, 'src/task-001.js'), 'edited after the commit\n');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false, JSON.stringify(rejected));
  assert.strictEqual(rejected.reason, 'worker-scope-dirty');
  assert.deepStrictEqual(rejected.dirty_paths, ['src/task-001.js']);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('redispatch whose baseline already held a dirty scope file → accepted report rejects with worker-scope-dirty', () => {
  const blueprint = '.bouncer/context/epics/112-x/blueprints/006-a';
  const drive = preparedCommitDrive('bouncer-report-baseline-dirty-', blueprint, { affectedPaths: ['src/'] });
  const first = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  // 앞 attempt가 커밋하지 못한 source 수정이 남은 채 rework로 닫힌다.
  fs.mkdirSync(path.join(drive.worker, 'src'), { recursive: true });
  fs.writeFileSync(path.join(drive.worker, 'src/leftover.js'), 'uncommitted from attempt 1\n');
  writeWorkerReport(drive.worker, '001', 1, first.metadata.task_brief_hash);
  const reworked = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: first.metadata.task_brief_hash, outcome: 'rework', summary: 'again',
  });
  assert.strictEqual(reworked.ok, true, JSON.stringify(reworked));
  const second = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(second.ok, true, JSON.stringify(second));
  assert.match(second.metadata.initial_worktree_state, /src\/leftover\.js/);
  // attempt 2는 다른 파일만 커밋하므로 leftover.js는 기준선에 있는 채로 남는다.
  commitAndStampWorker(drive.repo, blueprint, drive.worker);
  writeWorkerReport(drive.worker, '001', 2, second.metadata.task_brief_hash);
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const refused = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 2, taskBriefHash: second.metadata.task_brief_hash, outcome: 'accepted', summary: 'done',
  });
  assert.strictEqual(refused.ok, false, JSON.stringify(refused));
  assert.strictEqual(refused.reason, 'worker-scope-dirty');
  assert.deepStrictEqual(refused.dirty_paths, ['src/leftover.js']);
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('record with a commit_sha stamp that differs from the worker HEAD → rejects with worker-commit-stamp-mismatch and keeps the ledger bytes', () => {
  const blueprint = '.bouncer/context/epics/088-a/blueprints/011-y';
  const drive = preparedCommitDrive('bouncer-record-fake-stamp-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker);
  const file = path.join(drive.worker, blueprint, 'tasks/001/tasks.md');
  const doc = readDoc(file);
  doc.data.bouncer.commit_sha = 'abcd1234';
  fs.writeFileSync(file, renderDoc(doc.data, doc.body));
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false, JSON.stringify(rejected));
  assert.strictEqual(rejected.reason, 'worker-commit-stamp-mismatch');
  assert.strictEqual(rejected.stamp, 'abcd1234');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('record after affected_paths change following an accepted report → rejects', () => {
  const blueprint = '.bouncer/context/epics/088-b/blueprints/001-y';
  const drive = preparedCommitDrive('bouncer-record-affected-paths-', blueprint);
  acceptDispatchReport(drive.repo, blueprint, drive.worker);
  const file = path.join(drive.worker, blueprint, 'tasks/001/tasks.md');
  const doc = readDoc(file);
  doc.data.bouncer.affected_paths = ['other.ts'];
  fs.writeFileSync(file, renderDoc(doc.data, doc.body));
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'stale-worker-report');
});

test('dispatch on a brief without frontmatter → throws and leaves the ledger bytes unchanged', () => {
  const blueprint = '.bouncer/context/epics/088-c/blueprints/001-y';
  const drive = preparedCommitDrive('bouncer-dispatch-no-frontmatter-', blueprint);
  fs.writeFileSync(path.join(drive.worker, blueprint, 'tasks/001/tasks.md'), 'brief only\n');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  assert.throws(
    () => coordinate({
      command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    }),
    /missing frontmatter block/,
  );
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), ledgerBefore);
});

test('record with a non-accepted report → rejects without storing the worker SHA', () => {
  const blueprint = '.bouncer/context/epics/068-x/blueprints/069-y';
  const drive = preparedCommitDrive('bouncer-dispatch-non-accepted-record-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  writeWorkerReport(drive.worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  const reported = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'rework', summary: 'needs another pass',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  assert.strictEqual(reported.decision.outcome, 'rework');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile, 'utf8');
  const rejected = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(rejected.reason, 'accepted-report-required');
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].status, 'prepared');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'reported');
  assert.strictEqual(ledger.tasks[0].dispatch.outcome, 'rework');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), ledgerBefore);
});

test('report without an active dispatch attempt → is rejected', () => {
  const blueprint = '.bouncer/context/epics/070-x/blueprints/071-y';
  const drive = preparedCommitDrive('bouncer-dispatch-no-active-', blueprint);
  const hash = briefHash(drive.worker, blueprint, '001');
  const beforeDispatch = fs.readFileSync(drive.ledgerFile, 'utf8');
  const neverDispatched = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 1, taskBriefHash: hash, outcome: 'accepted', summary: 'too early',
  });
  assert.strictEqual(neverDispatched.ok, false);
  assert.strictEqual(neverDispatched.reason, 'no-active-dispatch');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), beforeDispatch);

  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  writeWorkerReport(drive.worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  const closed = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'blocked', summary: 'stop here',
  });
  assert.strictEqual(closed.ok, true, JSON.stringify(closed));
  const afterClosed = fs.readFileSync(drive.ledgerFile, 'utf8');
  const again = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'after closed',
  });
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.reason, 'no-active-dispatch');
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), afterClosed);
  const ledger = JSON.parse(afterClosed);
  assert.strictEqual(ledger.tasks[0].dispatch.status, 'reported');
  assert.strictEqual(ledger.tasks[0].dispatch.outcome, 'blocked');
  assert.strictEqual(ledger.tasks[0].sha, undefined);
});

const LEDGER_REL = '.bouncer/runtime/coordinator.json';

/**
 * status checkpoint·hash fence 전용 픽스처. 001을 통합한 뒤 002를 pending ready로 두고
 * unresolved decision·terminalFailure를 원장에만 남겨 projection을 검증한다.
 */
function checkpointFixture() {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/076-x/blueprints/001-y';
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/001'), { recursive: true });
  fs.mkdirSync(path.join(repo, blueprint, 'tasks/002'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/a.js'), 'base\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/index.md`),
    '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/tasks/001/tasks.md`),
    '---\nbouncer:\n  status: ready\n  affected_paths:\n    - src/\n---\n');
  fs.writeFileSync(path.join(repo, `${blueprint}/tasks/002/tasks.md`),
    '---\nbouncer:\n  status: ready\n  depends_on: ["001"]\n  affected_paths:\n    - lib/\n---\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  // setup은 구현 전·후에도 통하도록, 있을 때만 fence를 붙인다.
  const prepareOpts = {
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  };
  if (boot.checkpoint && boot.checkpoint.ledger) {
    prepareOpts.ledgerPath = boot.checkpoint.ledger.path;
    prepareOpts.ledgerHash = boot.checkpoint.ledger.sha256;
  }
  const prepared = coordinate(prepareOpts);
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  fs.writeFileSync(path.join(worker, 'src/a.js'), 'ok\n');
  execFileSync('git', ['add', 'src/a.js'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'wip'], { cwd: worker });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
  const ledgerFile = path.join(boot.integrationPath, LEDGER_REL);
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const openDecision = {
    task: '002', kind: 'critical-recovery', used: 1, findings: ['R-1'],
    reason: 'needs follow-up', outcome: null,
  };
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[0].sha = sha;
  ledger.tasks[0].dispatch = {
    attempt: 1, task_brief_hash: 'a'.repeat(64), base_head: 'abc',
    initial_worktree_state: '', status: 'reported', outcome: 'accepted', summary: 'done',
  };
  ledger.tasks[0].scope = { revision: 'r1', paths: ['src/'] };
  ledger.tasks[0].verify_evidence_id = 'v'.repeat(64);
  ledger.tasks[0].decisions = [{ task: '001', kind: 'dispatch', attempt: 1, task_brief_hash: 'a'.repeat(64),
    base_head: 'abc', initial_worktree_state: '' }];
  ledger.tasks[1].status = 'pending';
  ledger.tasks[1].criticalRecovery = {
    used: 1, findings: ['R-1'], reason: 'needs follow-up', outcome: null,
  };
  ledger.decisions = [openDecision, { task: '001', kind: 'report', attempt: 1,
    task_brief_hash: 'a'.repeat(64), outcome: 'accepted', summary: 'done' }];
  ledger.terminalFailure = {
    task: '002', command: 'npm test', summary: 'wave failed',
    paths: ['lib/'], exitCode: 1, repairWave: 1,
  };
  ledger.revision = 'r2';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repo, blueprint, integration: boot.integrationPath, ledgerFile, sha };
}

test('status checkpoint → drive-metrics.json의 같은 blueprint coordinator 세션만 sessions로 노출한다', () => {
  const drive = checkpointFixture();
  const status = () => coordinate({
    command: 'status', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
  }).checkpoint.sessions;
  // 파일이 없으면 빈 배열이다.
  assert.deepStrictEqual(status(), []);
  const session = (id, blueprint, kind) => ({
    id, kind, blueprint, label: null, started_at: '2026-01-01T00:00:00.000Z', ended_at: null,
    start: null, tasks_completed: ['001'], exception_decisions: 0, tokens: 10,
  });
  const file = path.join(drive.repo, '.bouncer', 'runtime', 'drive-metrics.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    sessions: [
      session('m-1111111111111111', drive.blueprint, 'coordinator-session'),
      session('m-2222222222222222', drive.blueprint, 'coordinator-session'),
      session('m-3333333333333333', '.bouncer/context/epics/098-z/blueprints/009-z', 'coordinator-session'),
      session('m-4444444444444444', drive.blueprint, 'context-review'),
    ],
  }));
  const sessions = status();
  assert.strictEqual(sessions.length, 2);
  assert.deepStrictEqual(sessions.map((s) => s.id), ['m-1111111111111111', 'm-2222222222222222']);
});

test('status checkpoint with completed tasks → summarizes them without dispatch or decision bodies', () => {
  const drive = checkpointFixture();
  const status = coordinate({
    command: 'status', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
  });
  assert.strictEqual(status.ok, true, JSON.stringify(status));
  assert.strictEqual(status.tasks, undefined);
  assert.strictEqual(status.decisions, undefined);
  const completed = status.checkpoint.completed_tasks;
  assert.strictEqual(completed.length, 1);
  assert.deepStrictEqual(completed[0], {
    id: '001',
    status: 'integrated',
    attempt: 1,
    commit_sha: drive.sha,
    changed_paths: ['src/'],
    scope_revision: 'r1',
    verify_evidence_id: 'v'.repeat(64),
  });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'advisory'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'review_evidence_id'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'dispatch'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(completed[0], 'decisions'), false);
});

test('status checkpoint with ready wave, active tasks, unresolved decisions and a recent failure → keeps all of them', () => {
  const drive = checkpointFixture();
  const status = coordinate({
    command: 'status', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
  });
  assert.strictEqual(status.ok, true, JSON.stringify(status));
  const cp = status.checkpoint;
  assert.deepStrictEqual(cp.ready, ['002']);
  assert.strictEqual(cp.active_tasks.length, 1);
  assert.strictEqual(cp.active_tasks[0].id, '002');
  assert.strictEqual(cp.active_tasks[0].status, 'pending');
  assert.ok(cp.active_tasks[0].dispatch === undefined || cp.active_tasks[0].dispatch);
  // SS-002: Interface allowlist 밖 필드는 active projection에 실리면 안 된다.
  for (const forbidden of ['execution_kind', 'sha', 'criticalRecovery', 'dynamic']) {
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(cp.active_tasks[0], forbidden),
      false,
      forbidden,
    );
  }
  assert.deepStrictEqual(cp.unresolved_decisions, [{
    task: '002', kind: 'critical-recovery', used: 1, findings: ['R-1'],
    reason: 'needs follow-up', outcome: null,
  }]);
  assert.deepStrictEqual(cp.recent_failure, {
    task: '002', command: 'npm test', summary: 'wave failed',
    paths: ['lib/'], exitCode: 1, repairWave: 1,
  });
  assert.strictEqual(cp.revision, 'r2');
  assert.strictEqual(typeof cp.integration_head, 'string');
  assert.strictEqual(cp.ledger.path, LEDGER_REL);
  assert.match(cp.ledger.sha256, /^[a-f0-9]{64}$/);
  assert.strictEqual(cp.ledger.revision, 'r2');
  const expectedHash = crypto.createHash('sha256')
    .update(fs.readFileSync(drive.ledgerFile)).digest('hex');
  assert.strictEqual(cp.ledger.sha256, expectedHash);
});

const UNKNOWN_EXECUTOR = {
  state: 'unknown', source: 'unavailable', reason: 'executor-state-not-tracked',
};

test('status checkpoint with executor_observation unknown → reports it without touching the ledger', () => {
  const drive = checkpointFixture();
  const before = fs.readFileSync(drive.ledgerFile);
  const status = coordinate({
    command: 'status', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
  });
  assert.strictEqual(status.ok, true, JSON.stringify(status));
  assert.deepStrictEqual(status.checkpoint.executor_observation, UNKNOWN_EXECUTOR);
  assert.ok(before.equals(fs.readFileSync(drive.ledgerFile)));
});

// active는 호스트 launch 이전에 기록되고 stale report도 해시를 바꾼다 —
// 둘 다 생존 증거가 아니므로 관측 상태는 계속 unknown이어야 한다.
test('pre-launch active and hash-only changes → executor_observation stays unknown', () => {
  const blueprint = '.bouncer/context/epics/064-x/blueprints/065-y';
  const drive = preparedCommitDrive('bouncer-executor-observation-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  assert.deepStrictEqual(dispatched.checkpoint.executor_observation, UNKNOWN_EXECUTOR);
  const first = coordinate({ command: 'status', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath });
  assert.strictEqual(first.checkpoint.active_tasks[0].dispatch.status, 'active');
  assert.deepStrictEqual(first.checkpoint.executor_observation, UNKNOWN_EXECUTOR);
  writeWorkerReport(drive.worker, '001', 9, 'a'.repeat(64), { pathAttempt: 1 });
  const stale = coordinate({
    command: 'report', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
    attempt: 9, taskBriefHash: 'a'.repeat(64), outcome: 'accepted', summary: 'late report',
  });
  assert.strictEqual(stale.reason, 'stale-report');
  const second = coordinate({ command: 'status', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath });
  assert.notStrictEqual(second.checkpoint.ledger.sha256, first.checkpoint.ledger.sha256);
  assert.deepStrictEqual(second.checkpoint.executor_observation, UNKNOWN_EXECUTOR);
});

test('mutation with missing, absolute, escaping, wrong path or stale hash ledger fence → rejects without writes', () => {
  const drive = checkpointFixture();
  const before = fs.readFileSync(drive.ledgerFile);
  const beforeMain = execFileSync('git', ['status', '--porcelain'], {
    cwd: drive.repo, encoding: 'utf8',
  });
  const hash = crypto.createHash('sha256').update(before).digest('hex');
  const cases = [
    { label: 'missing both', opts: {} },
    { label: 'missing hash', opts: { ledgerPath: LEDGER_REL } },
    { label: 'missing path', opts: { ledgerHash: hash } },
    { label: 'absolute', opts: { ledgerPath: path.join(drive.integration, LEDGER_REL), ledgerHash: hash } },
    { label: 'escaping', opts: { ledgerPath: '../runtime/coordinator.json', ledgerHash: hash } },
    { label: 'wrong path', opts: { ledgerPath: '.bouncer/runtime/other.json', ledgerHash: hash } },
    { label: 'bad hash shape', opts: { ledgerPath: LEDGER_REL, ledgerHash: 'zzzz' } },
    { label: 'stale hash', opts: { ledgerPath: LEDGER_REL, ledgerHash: 'b'.repeat(64) } },
  ];
  for (const entry of cases) {
    const rejected = coordinateRaw({
      command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint,
      cwd: drive.integration, ...entry.opts,
    });
    assert.strictEqual(rejected.ok, false, entry.label);
    assert.match(rejected.reason, /ledger-checkpoint-invalid|stale-ledger-checkpoint/, entry.label);
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before, entry.label);
  }
  assert.strictEqual(execFileSync('git', ['status', '--porcelain'], {
    cwd: drive.repo, encoding: 'utf8',
  }), beforeMain);
  // stale이 아니면 다음 hash로 prepare가 이어진다.
  const next = coordinateRaw({
    command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint,
    cwd: drive.integration, ledgerPath: LEDGER_REL, ledgerHash: hash,
  });
  assert.strictEqual(next.ok, true, JSON.stringify(next));
  assert.ok(next.checkpoint);
  assert.match(next.checkpoint.ledger.sha256, /^[a-f0-9]{64}$/);
  assert.notStrictEqual(next.checkpoint.ledger.sha256, hash);
});

test('prepare issues a lease and revoke → late report/record/dispatch become stale-lease', () => {
  const blueprint = '.bouncer/context/epics/080-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-stale-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const fence = __fence(repo, blueprint);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath, ...fence,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.tasks.find((t) => t.id === '001').lease,
    { id: 'lease-a', generation: 1, seq: 1, status: 'active' });

  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const fence2 = __fence(repo, blueprint);
  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'scope-conflict', ...fence2,
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));
  assert.strictEqual(revoked.task.status, 'pending');

  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const taskBefore = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');

  const fence3 = __fence(repo, blueprint);
  const late = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', generation: 1,
    attempt: 1, taskBriefHash: 'a'.repeat(64), outcome: 'accepted', summary: 'late',
    ...fence3,
  });
  assert.strictEqual(late.reason, 'stale-lease');
  const afterReport = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.deepStrictEqual(
    { ...afterReport, decisions: taskBefore.decisions },
    { ...taskBefore, decisions: taskBefore.decisions },
  );
  assert.strictEqual(afterReport.status, taskBefore.status);
  assert.deepStrictEqual(afterReport.dispatch, taskBefore.dispatch);
  assert.deepStrictEqual(afterReport.lease, taskBefore.lease);

  const fence4 = __fence(repo, blueprint);
  const lateRecord = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', generation: 1, ...fence4,
  });
  assert.strictEqual(lateRecord.reason, 'stale-lease');

  const fence5 = __fence(repo, blueprint);
  const lateDispatch = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', generation: 1, ...fence5,
  });
  assert.strictEqual(lateDispatch.reason, 'stale-lease');
  const afterAll = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.strictEqual(afterAll.status, taskBefore.status);
  assert.deepStrictEqual(afterAll.dispatch, taskBefore.dispatch);
  assert.deepStrictEqual(afterAll.lease, taskBefore.lease);
});

test('prepare with a revoked task → requeues it with generation 2 and a fresh integration HEAD', () => {
  const blueprint = '.bouncer/context/epics/081-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-requeue-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const branch = prepared.tasks.find((t) => t.id === '001').branch;
  fs.writeFileSync(path.join(worker, 'README.md'), 'worker commit\n');
  execFileSync('git', ['add', 'README.md'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'worker'], { cwd: worker });
  const oldWorkerHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: worker, encoding: 'utf8',
  }).trim();
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim();
  assert.notStrictEqual(oldWorkerHead, integrationHead);

  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'requeue',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));

  let leaseN = 0;
  const preparedAgain = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => `lease-${++leaseN}` },
  });
  assert.strictEqual(preparedAgain.ok, true, JSON.stringify(preparedAgain));
  const again = preparedAgain.tasks.find((t) => t.id === '001');
  assert.strictEqual(again.lease.generation, 2);
  assert.strictEqual(again.lease.status, 'active');
  const newHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: again.workerPath, encoding: 'utf8',
  }).trim();
  const integrationNow = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim();
  assert.strictEqual(newHead, integrationNow);
  // 이전 worker commit이 새 branch ancestry에 없어야 한다.
  let hasOld = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', oldWorkerHead, 'HEAD'], {
      cwd: again.workerPath, stdio: 'ignore',
    });
  } catch (_error) {
    hasOld = false;
  }
  assert.strictEqual(hasOld, false);
  // 폐기가 아니라 보존이다: 이전 커밋은 salvage ref로 남는다.
  assert.strictEqual(execFileSync('git', ['rev-parse', `refs/bouncer/salvage/001/g1-${oldWorkerHead.slice(0, 8)}`], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim(), oldWorkerHead);
  assert.notStrictEqual(again.branch, undefined);
  void branch;
});

test('legacy task revoke → leaves lease_id and generation null', () => {
  const blueprint = '.bouncer/context/epics/082-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-legacy-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  // lease 필드 없는 legacy 원장으로 되돌린다.
  delete ledger.tasks[0].lease;
  delete ledger.leaseSeq;
  ledger.tasks[0].status = 'prepared';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'legacy-revoke',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));
  assert.strictEqual(revoked.task.status, 'pending');
  assert.strictEqual(revoked.decision.lease_id, null);
  assert.strictEqual(revoked.decision.generation, null);
  assert.strictEqual(revoked.task.lease, undefined);
});

// RD-001: legacy(lease 없음) revoke 뒤 prepare도 dirty worker를 버리고
// integration HEAD에서 다시 만든다. lease.status === 'revoked'만 보면 놓친다.
test('prepare with a legacy revoked task → requeues it from integration HEAD', () => {
  const blueprint = '.bouncer/context/epics/082-lease-requeue/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-legacy-requeue-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  delete ledger.tasks[0].lease;
  delete ledger.leaseSeq;
  ledger.tasks[0].status = 'prepared';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const worker = ledger.tasks[0].workerPath;
  fs.writeFileSync(path.join(worker, 'README.md'), 'legacy dirty\n');
  execFileSync('git', ['add', 'README.md'], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'legacy-dirty'], { cwd: worker });
  const oldWorkerHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: worker, encoding: 'utf8',
  }).trim();

  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'legacy-requeue',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));

  const preparedAgain = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-legacy-2' },
  });
  assert.strictEqual(preparedAgain.ok, true, JSON.stringify(preparedAgain));
  const again = preparedAgain.tasks.find((t) => t.id === '001');
  const newHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: again.workerPath, encoding: 'utf8',
  }).trim();
  const integrationNow = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim();
  assert.strictEqual(newHead, integrationNow);
  let hasOld = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', oldWorkerHead, 'HEAD'], {
      cwd: again.workerPath, stdio: 'ignore',
    });
  } catch (_error) {
    hasOld = false;
  }
  assert.strictEqual(hasOld, false);
  // legacy는 generation이 없어 0으로 보존한다.
  assert.strictEqual(execFileSync('git', ['rev-parse', `refs/bouncer/salvage/001/g0-${oldWorkerHead.slice(0, 8)}`], {
    cwd: boot.integrationPath, encoding: 'utf8',
  }).trim(), oldWorkerHead);
});

// 보존 테스트 공통 준비: worker 1개를 prepare한 뒤 caller가 worker를 더럽히고 revoke한다.
function salvageFixture(tag, mutate) {
  const blueprint = `.bouncer/context/epics/083-${tag}/blueprints/001-y`;
  const repo = uncommittedPlanRepo(`bouncer-salvage-${tag}-`, blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const branch = prepared.tasks.find((t) => t.id === '001').branch;
  mutate(worker);
  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'requeue',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  return { repo, blueprint, boot, worker, branch, ledgerFile };
}
const gitOut = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function commitInWorker(worker, file, text) {
  fs.writeFileSync(path.join(worker, file), text);
  execFileSync('git', ['add', file], { cwd: worker });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'worker'], { cwd: worker });
  return gitOut(worker, 'rev-parse', 'HEAD');
}

test('prepare with a dirty revoked worker → writes a patch that reproduces the changes and one worker-salvage decision', () => {
  const fx = salvageFixture('dirty', (worker) => {
    fs.writeFileSync(path.join(worker, 'README.md'), 'modified\n');
    fs.writeFileSync(path.join(worker, 'notes.txt'), 'untracked\n');
  });
  const again = coordinate({
    command: 'prepare', repoRoot: fx.repo, blueprint: fx.blueprint, cwd: fx.boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(again.salvage.length, 1);
  assert.strictEqual(again.salvage[0].task, '001');
  assert.strictEqual(fs.existsSync(again.salvage[0].patch), true);
  const fresh = again.tasks.find((t) => t.id === '001').workerPath;
  assert.strictEqual(fs.existsSync(path.join(fresh, 'notes.txt')), false);
  execFileSync('git', ['apply', '--binary', again.salvage[0].patch], { cwd: fresh });
  assert.strictEqual(fs.readFileSync(path.join(fresh, 'README.md'), 'utf8'), 'modified\n');
  assert.strictEqual(fs.readFileSync(path.join(fresh, 'notes.txt'), 'utf8'), 'untracked\n');
  const decisions = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8')).decisions
    .filter((d) => d.kind === 'worker-salvage');
  assert.strictEqual(decisions.length, 1);
  assert.strictEqual(decisions[0].task, '001');
  assert.strictEqual(decisions[0].generation, 1);
  assert.deepStrictEqual(decisions[0].dirty_paths.sort(), ['README.md', 'notes.txt']);
});

test('prepare with a revoked worker holding an unintegrated commit → keeps it under refs/bouncer/salvage', () => {
  let head;
  const fx = salvageFixture('commit', (worker) => { head = commitInWorker(worker, 'README.md', 'committed\n'); });
  const again = coordinate({
    command: 'prepare', repoRoot: fx.repo, blueprint: fx.blueprint, cwd: fx.boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  const ref = `refs/bouncer/salvage/001/g1-${head.slice(0, 8)}`;
  assert.strictEqual(gitOut(fx.boot.integrationPath, 'rev-parse', ref), head);
  assert.strictEqual(again.salvage[0].ref, ref);
  assert.strictEqual(again.salvage[0].patch, undefined);
  const decision = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8')).decisions
    .find((d) => d.kind === 'worker-salvage');
  assert.strictEqual(decision.head, head);
  assert.strictEqual(decision.ref, ref);
});

test('prepare with a clean revoked worker → no salvage key and no worker-salvage decision', () => {
  const fx = salvageFixture('clean', () => {});
  const again = coordinate({
    command: 'prepare', repoRoot: fx.repo, blueprint: fx.blueprint, cwd: fx.boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(again, 'salvage'), false);
  const ledger = JSON.parse(fs.readFileSync(fx.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.decisions.some((d) => d.kind === 'worker-salvage'), false);
  assert.strictEqual(fs.existsSync(path.join(fx.boot.integrationPath, '.bouncer/runtime/salvage')), false);
});

test('prepare when ref creation fails → worker-salvage-failed and worker, branch, ledger stay unchanged', () => {
  const fx = salvageFixture('refail', (worker) => {
    commitInWorker(worker, 'README.md', 'committed\n');
    fs.writeFileSync(path.join(worker, 'notes.txt'), 'untracked\n');
  });
  const ledgerBefore = fs.readFileSync(fx.ledgerFile);
  const branchHead = gitOut(fx.boot.integrationPath, 'rev-parse', fx.branch);
  const failing = (file, args, options) => {
    if (file === 'git' && args[0] === 'update-ref') throw new Error('injected update-ref failure');
    return execFileSync(file, args, options);
  };
  const failed = coordinate({
    command: 'prepare', repoRoot: fx.repo, blueprint: fx.blueprint, cwd: fx.boot.integrationPath,
    deps: { execFileSync: failing, makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.reason, 'worker-salvage-failed');
  assert.strictEqual(fs.existsSync(failed.salvage[0].patch), true);
  assert.strictEqual(failed.salvage[0].ref, undefined);
  assert.strictEqual(fs.existsSync(fx.worker), true);
  assert.strictEqual(fs.existsSync(path.join(fx.worker, 'notes.txt')), true);
  assert.strictEqual(gitOut(fx.boot.integrationPath, 'rev-parse', fx.branch), branchHead);
  assert.deepStrictEqual(fs.readFileSync(fx.ledgerFile), ledgerBefore);
});

test('prepare when the salvage ref already points at the same commit → succeeds without changing the ref', () => {
  let head;
  const fx = salvageFixture('same', (worker) => { head = commitInWorker(worker, 'README.md', 'committed\n'); });
  const ref = `refs/bouncer/salvage/001/g1-${head.slice(0, 8)}`;
  execFileSync('git', ['update-ref', ref, head], { cwd: fx.boot.integrationPath });
  const again = coordinate({
    command: 'prepare', repoRoot: fx.repo, blueprint: fx.blueprint, cwd: fx.boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(gitOut(fx.boot.integrationPath, 'rev-parse', ref), head);
});

test('prepare when the salvage ref points at a different commit → worker-salvage-failed and nothing is removed', () => {
  let head;
  const fx = salvageFixture('conflict', (worker) => { head = commitInWorker(worker, 'README.md', 'committed\n'); });
  const ref = `refs/bouncer/salvage/001/g1-${head.slice(0, 8)}`;
  const other = gitOut(fx.boot.integrationPath, 'rev-parse', 'HEAD');
  execFileSync('git', ['update-ref', ref, other], { cwd: fx.boot.integrationPath });
  const ledgerBefore = fs.readFileSync(fx.ledgerFile);
  const failed = coordinate({
    command: 'prepare', repoRoot: fx.repo, blueprint: fx.blueprint, cwd: fx.boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(failed.reason, 'worker-salvage-failed');
  assert.strictEqual(gitOut(fx.boot.integrationPath, 'rev-parse', ref), other);
  assert.strictEqual(gitOut(fx.boot.integrationPath, 'rev-parse', fx.branch), head);
  assert.strictEqual(fs.existsSync(fx.worker), true);
  assert.deepStrictEqual(fs.readFileSync(fx.ledgerFile), ledgerBefore);
});

// RD-003: --lease-id/--generation 중 하나만 주면 lease-required.
test('dispatch/report/record with only one of lease-id or generation set → reject', () => {
  const blueprint = '.bouncer/context/epics/086-lease-required/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-required-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks.find((t) => t.id === '001').workerPath;
  const briefHash = 'a'.repeat(64);

  const onlyId = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', attempt: 1, taskBriefHash: briefHash,
  });
  assert.strictEqual(onlyId.reason, 'lease-required');

  const onlyGen = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001',
    generation: 1, attempt: 1, taskBriefHash: briefHash,
  });
  assert.strictEqual(onlyGen.reason, 'lease-required');

  const reportOnlyId = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: 'lease-a', attempt: 1, taskBriefHash: briefHash,
    outcome: 'accepted', summary: 'x',
  });
  assert.strictEqual(reportOnlyId.reason, 'lease-required');

  const recordOnlyGen = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001',
    generation: 1,
  });
  assert.strictEqual(recordOnlyGen.reason, 'lease-required');
});

// RD-004: revoke 뒤 이전 lease로 integrate --task → stale-lease.
test('integrate --task with a stale lease after revoke → returns stale-lease', () => {
  const blueprint = '.bouncer/context/epics/087-lease-integrate/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-integrate-stale-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'stale-integrate',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));

  const late = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', leaseId: 'lease-a', generation: 1,
  });
  assert.strictEqual(late.reason, 'stale-lease');
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.strictEqual(after.status, 'pending');
  assert.strictEqual(after.lease.status, 'revoked');
});

// RD-002: 손상 lease 원장은 bootstrap도 lease-invalid로 거절한다.
test('bootstrap with a ledger holding a malformed lease → refuses', () => {
  const blueprint = '.bouncer/context/epics/088-lease-bootstrap/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-bootstrap-invalid-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.leaseSeq = 1;
  ledger.tasks[0].lease = { id: 'bad', generation: 0, seq: 1, status: 'active' };
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const again = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(again.ok, false);
  assert.strictEqual(again.reason, 'lease-invalid');
});

test('verification integrate while runVerification runs → releases the ledger lock', () => {
  const blueprint = '.bouncer/context/epics/083-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-verify-lock-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const lockFile = `${ledgerFile}.lock`;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });

  let sawLockDuringVerify = true;
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        sawLockDuringVerify = fs.existsSync(lockFile);
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-1' };
      },
    },
  });
  assert.strictEqual(passed.ok, true, JSON.stringify(passed));
  assert.strictEqual(sawLockDuringVerify, false);
});

test('verification integrate after stale-ledger-checkpoint → retries without consuming repairWaves', () => {
  const blueprint = '.bouncer/context/epics/084-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-verify-retry-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });

  let calls = 0;
  const stale = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        calls += 1;
        // 검증 중 원장을 바꿔 두 번째 잠금의 checkpoint가 어긋나게 한다.
        const live = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
        live.decisions = [...(live.decisions || []), { kind: 'noise', task: '002' }];
        fs.writeFileSync(ledgerFile, `${JSON.stringify(live, null, 2)}\n`);
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-stale' };
      },
    },
  });
  assert.strictEqual(stale.reason, 'stale-ledger-checkpoint');
  assert.strictEqual(JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks[1].status, 'verifying');
  assert.strictEqual((JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).repairWaves || []).length, 0);

  const again = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        calls += 1;
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-ok' };
      },
    },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.strictEqual(again.task.status, 'integrated');
  assert.strictEqual((JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).repairWaves || []).length, 0);
  assert.ok(calls >= 2);
});

test('overlapping fenced coordinate calls → refuse with ledger-locked', () => {
  const blueprint = '.bouncer/context/epics/085-lease/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-lease-locked-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const lockFile = `${ledgerFile}.lock`;
  const before = fs.readFileSync(ledgerFile);
  fs.writeFileSync(lockFile, JSON.stringify({ pid: 1, token: 'held', at: Date.now() }));
  const blocked = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(blocked.reason, 'ledger-locked');
  assert.deepStrictEqual(fs.readFileSync(ledgerFile), before);
});

/**
 * 두 recorded commit task가 있는 wave fixture. 각 worker에 서로 다른 파일을 커밋하고
 * terminal 증적을 남긴다. fan-in 후보·검증 주입 테스트의 공통 바탕이다.
 */
function twoRecordedWave(prefix, blueprint, { deferRecord = [] } = {}) {
  const repo = uncommittedPlanRepo(prefix, blueprint, []);
  // fan-in은 coordinator가 identity 인자 없이 cherry-pick한다. 전역 git identity가
  // 없는 CI runner에서도 같은 결과가 나오도록 worktree가 공유하는 저장소 config에 둔다.
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  for (const id of ['001', '002']) writeBundle(repo, blueprint, id, SCAFFOLD);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks
    .filter((entry) => entry.workerPath)
    .map((entry) => [entry.id, entry.workerPath]));
  const shas = {};
  for (const id of ['001', '002']) {
    const worker = workers[id];
    fs.mkdirSync(path.join(worker, 'src'), { recursive: true });
    fs.writeFileSync(path.join(worker, `src/task-${id}.js`), `changed by ${id}\n`);
    execFileSync('git', ['add', `src/task-${id}.js`], { cwd: worker });
    execFileSync('git', [
      '-c', 'user.name=test', '-c', 'user.email=test@example.com',
      'commit', '-m', `feat: ${id}`,
    ], { cwd: worker });
    shas[id] = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: worker, encoding: 'utf8' }).trim();
    writeBundle(worker, blueprint, id, { ...TERMINAL, commitSha: shas[id].slice(0, 8) });
    // 지연한 task는 커밋만 해 두고 report·record는 호출부가 나중에 한다.
    if (deferRecord.includes(id)) continue;
    acceptDispatchReport(repo, blueprint, worker, id);
    const recorded = coordinate({
      command: 'record', repoRoot: repo, blueprint, cwd: worker, task: id,
    });
    assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  }
  const { faninPath } = __coordinatorPathsFor({ repoRoot: repo, blueprint });
  return {
    repo,
    blueprint,
    workers,
    shas,
    integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
    faninPath,
    head: () => execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: boot.integrationPath, encoding: 'utf8',
    }).trim(),
    ledger: () => JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8')),
    ledgerTasks: () => JSON.parse(fs.readFileSync(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8')).tasks,
  };
}

const passVerify = () => ({
  ok: true, command: 'npm test', exitCode: 0, evidenceId: 'a'.repeat(64),
});

test('wave record after another worker integrated first → still accepts because the check compares against the ledger integrationHead', () => {
  const blueprint = '.bouncer/context/epics/112-x/blueprints/007-wave';
  const drive = twoRecordedWave('bouncer-record-wave-moved-', blueprint, { deferRecord: ['002'] });
  const integrated = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  const worker = drive.workers['002'];
  acceptDispatchReport(drive.repo, blueprint, worker, '002');
  const recorded = coordinate({
    command: 'record', repoRoot: drive.repo, blueprint, cwd: worker, task: '002',
  });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  assert.strictEqual(recorded.task.sha, drive.shas['002']);
});


test('wave integrate with failing verification → does not advance canonical HEAD or task status', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/001-wave';
  const drive = twoRecordedWave('bouncer-fanin-verify-fail-', blueprint);
  const baseHead = drive.head();
  const failed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      runVerification: () => ({ ok: false, command: 'npm test', exitCode: 1, evidenceId: 'b'.repeat(64) }),
    },
  });
  assert.strictEqual(failed.reason, 'wave-verification-failed');
  assert.strictEqual(drive.head(), baseHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);
  assert.strictEqual(drive.ledger().fanin, null);
  assert.strictEqual(fs.existsSync(drive.faninPath), false);
});

test('wave integrate with a conflict → revokes only the conflicting task and keeps canonical HEAD', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/002-conflict';
  const drive = twoRecordedWave('bouncer-fanin-conflict-', blueprint);
  const baseHead = drive.head();
  let picks = 0;
  const conflicted = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      execFileSync: (file, args, options) => {
        if (args[0] === 'cherry-pick' && args[1] !== '--abort') {
          picks += 1;
          if (picks === 2) {
            // RD-001: CONFLICT 표식이 있어야 fanin-conflict+revoke다.
            const err = new Error('CONFLICT (content): Merge conflict in shared.txt');
            err.stderr = 'CONFLICT (content): Merge conflict in shared.txt\n';
            err.status = 1;
            throw err;
          }
        }
        return execFileSync(file, args, options);
      },
      runVerification: passVerify,
    },
  });
  assert.strictEqual(conflicted.reason, 'fanin-conflict');
  assert.strictEqual(drive.head(), baseHead);
  assert.strictEqual(fs.existsSync(drive.faninPath), false);
  const tasks = drive.ledgerTasks();
  assert.strictEqual(tasks.find((t) => t.id === '002').status, 'pending');
  assert.strictEqual(tasks.find((t) => t.id === '001').status, 'recorded');
});

test('resume after a verified fanin → finishes without cherry-pick', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/003-resume';
  const drive = twoRecordedWave('bouncer-fanin-resume-', blueprint);
  const first = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const candidateHead = first.integrationHead;
  const baseHead = first.checkpoint && drive.ledger().base
    ? execFileSync('git', ['rev-parse', `${candidateHead}^`], {
      cwd: drive.integrationPath, encoding: 'utf8',
    }).trim()
    : null;
  // 복구 fixture: HEAD는 이미 candidate, 원장만 verified+recorded로 되감는다.
  // (ff는 끝났지만 둘째 원장 쓰기 전에 중단된 상태)
  void baseHead;
  const ledger = drive.ledger();
  const preFanin = execFileSync('git', ['merge-base', candidateHead, `${candidateHead}~2`], {
    cwd: drive.integrationPath, encoding: 'utf8',
  }).trim();
  for (const task of ledger.tasks) {
    if (task.id === '001' || task.id === '002') task.status = 'recorded';
  }
  ledger.integrationHead = preFanin;
  ledger.fanin = {
    base_head: preFanin,
    candidate_head: candidateHead,
    tasks: ['001', '002'],
    status: 'verified',
  };
  // 결정 로그의 성공 fanin을 제거해 재실행 decision만 남긴다.
  ledger.decisions = (ledger.decisions || []).filter((d) => d.kind !== 'fanin');
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  let cherryPickCalls = 0;
  const resumed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      execFileSync: (file, args, options) => {
        if (args[0] === 'cherry-pick') cherryPickCalls += 1;
        return execFileSync(file, args, options);
      },
      runVerification: passVerify,
    },
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  assert.strictEqual(cherryPickCalls, 0);
  assert.strictEqual(drive.ledger().integrationHead, candidateHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['integrated', 'integrated']);
  assert.strictEqual(drive.ledger().fanin, null);
});


test('legacy recorded task without lease in a wave → integrates', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/004-legacy';
  const drive = twoRecordedWave('bouncer-fanin-legacy-', blueprint);
  const ledger = drive.ledger();
  for (const task of ledger.tasks) {
    delete task.lease;
  }
  delete ledger.leaseSeq;
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const result = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.deepStrictEqual(result.integrated, ['001', '002']);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['integrated', 'integrated']);
});

test('integrate --task with a stale generation → returns stale-lease and keeps HEAD', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/005-stale-lease';
  const drive = twoRecordedWave('bouncer-fanin-stale-lease-', blueprint);
  const baseHead = drive.head();
  const lease = drive.ledgerTasks().find((t) => t.id === '001').lease;
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    task: '001', leaseId: lease.id, generation: lease.generation + 1,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'stale-lease');
  assert.strictEqual(drive.head(), baseHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);
});

test('CAS mismatch during fan-in → returns stale-integration-head and clears fanin', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/006-cas';
  const drive = twoRecordedWave('bouncer-fanin-cas-', blueprint);
  const baseHead = drive.head();
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      runVerification: () => {
        // 검증 구간(잠금 밖)에서 integration HEAD를 옮겨 CAS를 깨뜨린다.
        fs.writeFileSync(path.join(drive.integrationPath, 'CAS.md'), 'moved\n');
        execFileSync('git', ['add', 'CAS.md'], { cwd: drive.integrationPath });
        execFileSync('git', [
          '-c', 'user.name=test', '-c', 'user.email=test@example.com',
          'commit', '-m', 'cas move',
        ], { cwd: drive.integrationPath });
        return passVerify();
      },
    },
  });
  assert.strictEqual(rejected.reason, 'stale-integration-head');
  assert.strictEqual(drive.ledger().fanin, null);
  assert.notStrictEqual(drive.head(), baseHead);
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);
});

test('stale ledger checkpoint during verify → leaves fanin building and retry integrates', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/007-checkpoint';
  const drive = twoRecordedWave('bouncer-fanin-checkpoint-', blueprint);
  const stale = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: {
      runVerification: () => {
        const ledger = drive.ledger();
        ledger.revision = 'mutated-during-verify';
        fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
        return passVerify();
      },
    },
  });
  assert.strictEqual(stale.reason, 'stale-ledger-checkpoint');
  assert.strictEqual(drive.ledger().fanin.status, 'building');
  assert.deepStrictEqual(drive.ledgerTasks().map((t) => t.status), ['recorded', 'recorded']);

  const again = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(again.ok, true, JSON.stringify(again));
  assert.deepStrictEqual(again.integrated, ['001', '002']);
});

test('fanin whose HEAD matches neither base nor candidate → returns stale-integration-head', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/008-orphan';
  const drive = twoRecordedWave('bouncer-fanin-orphan-', blueprint);
  const ledger = drive.ledger();
  ledger.fanin = {
    base_head: 'a'.repeat(40),
    candidate_head: 'b'.repeat(40),
    tasks: ['001'],
    status: 'building',
  };
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'stale-integration-head');
  assert.strictEqual(drive.ledger().fanin, null);
});

test('integrate with no recorded tasks → returns nothing-to-integrate', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/009-empty';
  const repo = uncommittedPlanRepo('bouncer-fanin-empty-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const empty = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(empty.reason, 'nothing-to-integrate');
});

test('ledger with bogus fanin status → returns fanin-invalid', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/010-bogus';
  const drive = twoRecordedWave('bouncer-fanin-bogus-', blueprint);
  const ledger = drive.ledger();
  ledger.fanin = {
    base_head: drive.head(),
    candidate_head: null,
    tasks: ['001'],
    status: 'bogus',
  };
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'fanin-invalid');
});

test('wave integrate with lease flags → returns lease-flags-require-task', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/011-lease-flags';
  const drive = twoRecordedWave('bouncer-fanin-lease-flags-', blueprint);
  const rejected = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    leaseId: 'lease-x', generation: 1,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(rejected.reason, 'lease-flags-require-task');
});

test('verification integrate before runVerification → prepares integration dependencies', () => {
  const blueprint = '.bouncer/context/epics/091-prepare/blueprints/001-order';
  const repo = uncommittedPlanRepo('bouncer-verify-prepare-order-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  // integration worktree는 git이 추적한 파일만 받으므로 node_modules marker가 없다.
  // lockfile만 있으면 prepareDependencies가 npm ci --include=dev를 돌려야 한다.
  fs.writeFileSync(path.join(boot.integrationPath, 'package-lock.json'), '{}\n');
  const order = [];
  const npmCalls = [];
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          order.push('prepare');
          npmCalls.push({ command, args, options });
          return Buffer.from('');
        }
        return execFileSync(command, args, options);
      },
      runVerification: () => {
        order.push('verify');
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'd'.repeat(64) };
      },
    },
  });
  assert.strictEqual(passed.ok, true, JSON.stringify(passed));
  assert.deepStrictEqual(order, ['prepare', 'verify']);
  assert.deepStrictEqual(npmCalls, [{
    command: 'npm',
    args: ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
    // coordinator는 npm 출력을 stderr로 보낸다(CLI stdout JSON 보호).
    options: { cwd: boot.integrationPath, stdio: ['ignore', 2, 2] },
  }]);
  // 설치 성공 뒤 lockfile sha256 stamp가 남아야 다음 호출이 재설치를 건너뛴다.
  assert.strictEqual(
    fs.readFileSync(path.join(boot.integrationPath, 'node_modules/.bouncer-lock-sha256'), 'utf8'),
    `${crypto.createHash('sha256').update('{}\n').digest('hex')}\n`,
  );
});

test('verification integrate when dependency install fails → does not run verification', () => {
  const blueprint = '.bouncer/context/epics/091-prepare/blueprints/002-fail';
  const repo = uncommittedPlanRepo('bouncer-verify-prepare-fail-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  fs.writeFileSync(path.join(boot.integrationPath, 'package-lock.json'), '{}\n');
  let verified = false;
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      execFileSync(command, args, options) {
        if (command === 'npm') {
          throw new Error('npm ci failed');
        }
        return execFileSync(command, args, options);
      },
      runVerification: () => {
        verified = true;
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'e'.repeat(64) };
      },
    },
  });
  assert.strictEqual(failed.ok, false, JSON.stringify(failed));
  assert.strictEqual(failed.reason, 'dependency-install-failed');
  assert.strictEqual(verified, false);
  assert.strictEqual(fs.existsSync(path.join(boot.integrationPath, 'node_modules/.bouncer-lock-sha256')), false);
});

test('verification integrate → passes its own taskId to runVerification', () => {
  const blueprint = '.bouncer/context/epics/090-fanin/blueprints/012-taskid';
  const repo = uncommittedPlanRepo('bouncer-fanin-taskid-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  let seenTaskId = null;
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: (opts) => {
        seenTaskId = opts.taskId;
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'c'.repeat(64) };
      },
    },
  });
  assert.strictEqual(passed.ok, true, JSON.stringify(passed));
  assert.strictEqual(seenTaskId, '002');
});

function writeReviewScope(root, blueprint) {
  fs.writeFileSync(
    path.join(root, blueprint, 'index.md'),
    '---\nbouncer:\n  status: approved\n  review_scope: blueprint\n---\n# Blueprint\n',
  );
}

test('blueprint review mode integrate and repair → integrate succeeds without task review.md and repair omits it', () => {
  const blueprint = '.bouncer/context/epics/080-review/blueprints/001-mode';
  const drive = recordedDrive('bouncer-bp-review-mode-', blueprint);
  writeReviewScope(drive.repo, blueprint);
  writeReviewScope(drive.integrationPath, blueprint);
  writeReviewScope(drive.worker, blueprint);
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
    commitSha: drive.sha.slice(0, 8),
  });
  fs.rmSync(path.join(drive.worker, blueprint, 'tasks/001/review.md'), { force: true });
  const integrated = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'a'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));

  const repairBlueprint = '.bouncer/context/epics/080-review/blueprints/002-repair';
  const repo = uncommittedPlanRepo('bouncer-bp-review-repair-', repairBlueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  writeReviewScope(repo, repairBlueprint);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: repairBlueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint: repairBlueprint, cwd: boot.integrationPath });
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint: repairBlueprint, cwd: boot.integrationPath, task: '002',
    deps: { runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1 }) },
  });
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));
  const repaired = coordinate({
    command: 'repair', repoRoot: repo, blueprint: repairBlueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'],
    decision: 'repair the failing source path',
  });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  assert.strictEqual(
    fs.existsSync(path.join(boot.integrationPath, repairBlueprint, 'tasks', repaired.repairTask.id, 'review.md')),
    false,
  );
});

test('blueprint review mode → is judged from integration index not worker index', () => {
  const blueprint = '.bouncer/context/epics/080-review/blueprints/003-scope-source';
  const drive = recordedDrive('bouncer-bp-review-scope-src-', blueprint);

  writeReviewScope(drive.integrationPath, blueprint);
  writeBundle(drive.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
    commitSha: drive.sha.slice(0, 8),
  });
  fs.rmSync(path.join(drive.worker, blueprint, 'tasks/001/review.md'), { force: true });
  const fromIntegration = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'a'.repeat(64),
      }),
    },
  });
  assert.strictEqual(fromIntegration.ok, true, JSON.stringify(fromIntegration));

  const forged = recordedDrive('bouncer-bp-review-scope-forge-', blueprint);
  writeReviewScope(forged.worker, blueprint);
  writeBundle(forged.worker, blueprint, '001', {
    tasks: 'verified', verification: 'passed', review: 'accepted',
    commitSha: forged.sha.slice(0, 8),
  });
  fs.rmSync(path.join(forged.worker, blueprint, 'tasks/001/review.md'), { force: true });
  const fromWorker = coordinate({
    command: 'integrate', repoRoot: forged.repo, blueprint, cwd: forged.integrationPath, task: '001',
  });
  assert.strictEqual(fromWorker.ok, false, JSON.stringify(fromWorker));
  assert.strictEqual(fromWorker.reason, 'worker-evidence-not-terminal', JSON.stringify(fromWorker));
  assert.deepStrictEqual(fromWorker.files, [`${blueprint}/tasks/001/review.md`]);
});

test('coordinate repair from review findings on an integrated terminal verification → reopens it', () => {
  const repo = repoTemplate.copy();
  const blueprint = '.bouncer/context/epics/081-x/blueprints/001-y';
  for (const [id, metadata] of [
    ['001', 'depends_on: []\n'],
    ['002', 'execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]) {
    fs.mkdirSync(path.join(repo, blueprint, 'tasks', id), { recursive: true });
    fs.writeFileSync(path.join(repo, blueprint, 'tasks', id, 'tasks.md'), `---\nbouncer:\n  ${metadata}---\n`);
  }
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const seeded = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  for (const entry of seeded.tasks) entry.status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(seeded, null, 2)}\n`);

  const result = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    reviewFindings: ['F1'], summary: 'must_fix from final review', paths: ['src/fix.js'],
    decision: 'repair the reviewed source',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.decision.failure.command, 'review');
  assert.deepStrictEqual(result.decision.failure.findings, ['F1']);
  assert.strictEqual(result.decision.failure.task, '002');
  assert.strictEqual(result.decision.necessity, 'final review finding requires a Blueprint-scoped source repair');
  assert.strictEqual(result.terminalTask.status, 'pending');
  assert.deepStrictEqual(result.terminalTask.depends_on, [result.repairTask.id]);
});

test('coordinate repair from review findings without a terminal → uses the repair task id', () => {
  const blueprint = '.bouncer/context/epics/082-x/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-review-repair-leaf-', blueprint, [
    ['001', '  depends_on: []\n'],
  ]);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const seeded = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  for (const entry of seeded.tasks) entry.status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(seeded, null, 2)}\n`);

  const result = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    reviewFindings: ['F9'], summary: 'must_fix without terminal', paths: ['src/fix.js'],
    decision: 'repair from final review',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.strictEqual(result.decision.failure.task, result.repairTask.id);
  assert.deepStrictEqual(result.repairTask.depends_on, ['001']);
});

// repair 문서 테스트 공용 준비: 모든 task가 integrated인 integration worktree와 ledger 경로.
function integratedRepairDrive(prefix, blueprint) {
  const repo = uncommittedPlanRepo(prefix, blueprint, [['001', '  depends_on: []\n']]);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const seeded = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  for (const entry of seeded.tasks) entry.status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(seeded, null, 2)}\n`);
  return { repo, boot };
}

test('coordinate repair from review findings with root review.md → writes finding lines into the repair brief', () => {
  const blueprint = '.bouncer/context/epics/103-x/blueprints/001-y';
  const { repo, boot } = integratedRepairDrive('bouncer-review-repair-brief-', blueprint);
  fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'review.md'), [
    '---', 'bouncer:', '  review:', '    findings:',
    '      - id: F1', '        severity: major', '        status: open', '        category: correctness',
    '        brief_clause: tasks/001 Interface', '        file: scripts/lib/x.js', '        symbol: f',
    '        fingerprint: abc', '        actionability: must_fix', '        origin: discovery',
    '        note: "first line\\nsecond line"',
    '---', '# Review', '',
  ].join('\n'));

  const result = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    reviewFindings: ['F1', 'F9'], summary: 'must_fix from final review', paths: ['src/fix.js'],
    decision: 'repair from final review',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const repairDoc = readDoc(path.join(boot.integrationPath, blueprint, 'tasks', result.repairTask.id, 'tasks.md'));
  assert.strictEqual(repairDoc.data.title, `Review repair wave ${result.repairTask.id}`);
  assert.match(repairDoc.body, /- F1 \(major, correctness, must_fix\) — scripts\/lib\/x\.js#f — tasks\/001 Interface — note: first line second line/);
  assert.match(repairDoc.body, /- F9 — review\.md에서 찾지 못함/);
  // finding file은 backtick 경로로 쓰지 않는다 — Touch 외 절의 경로 선언 오인 방지.
  assert.doesNotMatch(repairDoc.body, /`scripts\/lib\/x\.js`/);
});

test('coordinate repair from review findings without root review.md → marks every id as not found and proceeds', () => {
  const blueprint = '.bouncer/context/epics/103-x/blueprints/002-y';
  const { repo, boot } = integratedRepairDrive('bouncer-review-repair-noreview-', blueprint);
  const result = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    reviewFindings: ['F1'], summary: 'must_fix', paths: ['src/fix.js'], decision: 'repair',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const repairDoc = readDoc(path.join(boot.integrationPath, blueprint, 'tasks', result.repairTask.id, 'tasks.md'));
  assert.match(repairDoc.body, /- F1 — review\.md에서 찾지 못함/);
});

test('coordinate repair from CI failure → keeps the CI repair brief wording', () => {
  const blueprint = '.bouncer/context/epics/103-x/blueprints/003-y';
  const repo = uncommittedPlanRepo('bouncer-ci-repair-brief-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[1].status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const result = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/fix.js'], decision: 'repair ci',
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const repairDoc = readDoc(path.join(boot.integrationPath, blueprint, 'tasks', result.repairTask.id, 'tasks.md'));
  assert.strictEqual(repairDoc.data.title, `CI repair wave ${result.repairTask.id}`);
  assert.match(repairDoc.body, /## Goal & intent\n\n기록된 terminal CI 실패를 복구한다\./);
});

test('repair stamping bouncer.verify without config.json → takes it from the terminal', () => {
  // G13: repair tasks.md에 verify가 없으면 readVerifyCommand가 config.json으로
  // 폴백한다. 없는 저장소에서는 VERIFY_CONFIG_MISSING — terminal 선언을 그대로
  // 심어야 config 없이도 통과한다.
  const blueprint = '.bouncer/context/epics/084-x/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-repair-verify-', blueprint, [
    ['001', '  depends_on: []\n  verify: npm run verify:strict\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: npm run verify:strict\n'],
  ]);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  fs.rmSync(path.join(repo, '.bouncer/config.json'), { force: true });
  fs.rmSync(path.join(boot.integrationPath, '.bouncer/config.json'), { force: true });
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks.find((entry) => entry.id === '001').status = 'integrated';
  ledger.tasks.find((entry) => entry.id === '002').status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const repaired = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    failureCommand: 'npm run verify:strict', summary: 'terminal CI failed', paths: ['src/fix.js'],
    decision: 'repair the failing source path',
  });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  const repairId = repaired.repairTask.id;
  const repairDoc = readDoc(path.join(
    boot.integrationPath, blueprint, 'tasks', repairId, 'tasks.md',
  ));
  assert.strictEqual(repairDoc.data.bouncer.verify, 'npm run verify:strict');
  const { readVerifyCommand } = require('../scripts/lib/verification-target');
  assert.strictEqual(
    readVerifyCommand(boot.integrationPath, blueprint, repairId),
    'npm run verify:strict',
  );
});

test('coordinate repair with mixed causes or non-integrated review repairs → rejects them', () => {
  const blueprint = '.bouncer/context/epics/083-x/blueprints/001-y';
  const repo = uncommittedPlanRepo('bouncer-review-repair-reject-', blueprint, [
    ['001', '  depends_on: []\n'],
  ]);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const mixed = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    reviewFindings: ['F1'], failureCommand: 'npm test', summary: 'both', paths: ['src/fix.js'],
    decision: 'ambiguous',
  });
  assert.strictEqual(mixed.reason, 'repair-cause-ambiguous');

  const leftover = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    reviewFindings: ['F1'], summary: 'not integrated', paths: ['src/fix.js'],
    decision: 'too early',
  });
  assert.strictEqual(leftover.reason, 'review-repair-requires-integrated');
});

/**
 * 종단 task가 verifying인 repair 드라이브를 만든다. scoped_terminal이면 구현 task가
 * 자기 verify를, 종단 task가 전체 명령 `npm run ci`를 가진다. legacy는 정책 표식이 없다.
 */
function repairIntakeDrive(prefix, blueprint, { scoped }) {
  const repo = uncommittedPlanRepo(prefix, blueprint, [
    ['001', `  id: TASKS-001\n  depends_on: []\n  verify: ${scoped ? 'node --test test/fix.test.js' : 'npm run ci'}\n`],
    ['002', '  id: TASKS-002\n  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: npm run ci\n'],
  ]);
  fs.writeFileSync(
    path.join(repo, blueprint, 'index.md'),
    `---\nbouncer:\n  status: approved\n${scoped ? '  verification_policy: scoped_terminal\n' : ''}---\n# Blueprint\n`,
  );
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks.find((entry) => entry.id === '001').status = 'integrated';
  ledger.tasks.find((entry) => entry.id === '002').status = 'verifying';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repo, blueprint, integrationPath: boot.integrationPath, ledgerFile };
}

/** ledger와 tasks/ 아래 모든 파일의 바이트를 한 문자열로 모아 거절 전후를 비교한다. */
function repairIntakeSnapshot(drive) {
  const tasksDir = path.join(drive.integrationPath, drive.blueprint, 'tasks');
  const files = fs.readdirSync(tasksDir, { recursive: true }).sort()
    .filter((rel) => fs.statSync(path.join(tasksDir, rel)).isFile())
    .map((rel) => `${rel}\n${fs.readFileSync(path.join(tasksDir, rel), 'utf8')}`);
  return [fs.readFileSync(drive.ledgerFile, 'utf8'), ...files].join('\n--\n');
}

function repairIntake(drive, overrides) {
  return coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integrationPath, task: '002',
    failureCommand: 'npm run ci', summary: 'one failed', paths: ['src/fix.js'], decision: 'repair ci',
    ...overrides,
  });
}

test('scoped_terminal repair with a missing, terminal or chained --verify → rejects before any write', () => {
  const drive = repairIntakeDrive('bouncer-repair-verify-gate-', '.bouncer/context/epics/112-x/blueprints/001-y', { scoped: true });
  const before = repairIntakeSnapshot(drive);
  for (const [label, verify, reason] of [
    ['no --verify', undefined, 'repair-verify-required'],
    ['terminal full-suite command', 'npm run ci', 'repair-verify-is-terminal'],
    ['terminal command with extra spaces', '  npm   run ci ', 'repair-verify-is-terminal'],
    ['shell operator', 'node --test a && node --test b', 'repair-verify-not-single-argv'],
  ]) {
    const out = repairIntake(drive, { verify });
    assert.strictEqual(out.ok, false, label);
    assert.strictEqual(out.reason, reason, `${label}: ${JSON.stringify(out)}`);
    assert.ok(out.cause && out.next, `${label} carries cause and next`);
    assert.strictEqual(repairIntakeSnapshot(drive), before, `${label} keeps ledger and tasks bytes`);
  }
});

test('repair with an untracked --paths entry or a --new-path without a tracked parent → rejects before any write', () => {
  const drive = repairIntakeDrive('bouncer-repair-path-gate-', '.bouncer/context/epics/112-x/blueprints/002-y', { scoped: true });
  const before = repairIntakeSnapshot(drive);
  const verify = 'node --test test/fix.test.js';
  const untracked = repairIntake(drive, { verify, paths: ['src/fix.js', 'scripts/src/commands/ontology.ts'] });
  assert.strictEqual(untracked.reason, 'scope-path-untracked', JSON.stringify(untracked));
  assert.deepStrictEqual(untracked.paths, ['scripts/src/commands/ontology.ts']);
  assert.strictEqual(repairIntakeSnapshot(drive), before);

  const orphan = repairIntake(drive, { verify, newPaths: ['nope/dir/x.ts'] });
  assert.strictEqual(orphan.reason, 'scope-new-path-parent-missing', JSON.stringify(orphan));
  assert.deepStrictEqual(orphan.paths, ['nope/dir/x.ts']);
  assert.strictEqual(repairIntakeSnapshot(drive), before);
});

test('repair with a pathspec-magic --paths entry that names no tracked file → rejects with scope-path-untracked before any write', () => {
  const drive = repairIntakeDrive('bouncer-repair-magic-path-', '.bouncer/context/epics/112-x/blueprints/007-y', { scoped: true });
  const before = repairIntakeSnapshot(drive);
  const out = repairIntake(drive, { verify: 'node --test test/fix.test.js', paths: [':!README.md'] });
  assert.strictEqual(out.reason, 'scope-path-untracked', JSON.stringify(out));
  assert.deepStrictEqual(out.paths, [':!README.md']);
  assert.strictEqual(repairIntakeSnapshot(drive), before);
});

test('scoped_terminal repair with --verify and tracked paths plus a --new-path → writes them into the repair document and passes G20', () => {
  const drive = repairIntakeDrive('bouncer-repair-ok-', '.bouncer/context/epics/112-x/blueprints/003-y', { scoped: true });
  const verify = 'node --test test/fix.test.js';
  const out = repairIntake(drive, { verify, newPaths: ['src/new-guard.js'] });
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  const repairDoc = readDoc(path.join(drive.integrationPath, drive.blueprint, 'tasks', out.repairTask.id, 'tasks.md'));
  assert.strictEqual(repairDoc.data.bouncer.verify, verify);
  assert.deepStrictEqual(repairDoc.data.bouncer.affected_paths, ['src/fix.js', 'src/new-guard.js']);
  assert.deepStrictEqual(out.repairTask.scope.paths, ['src/fix.js', 'src/new-guard.js']);

  // 만든 repair 문서가 plan gate의 G20(scoped_terminal 규칙)을 통과하는지 같은 문서로 확인한다.
  const { checkPlanDraft } = require('../scripts/lib/validate-gates');
  const leaf = (rel) => {
    const doc = readDoc(path.join(drive.integrationPath, rel));
    return { rel, data: doc.data, body: doc.body };
  };
  const taskRels = ['001', '002', out.repairTask.id].map((id) => `${drive.blueprint}/tasks/${id}/tasks.md`);
  const docs = { blueprintIndex: leaf(`${drive.blueprint}/index.md`), tasksDocs: taskRels.map(leaf) };
  const failures = [];
  checkPlanDraft(docs, { tasks: taskRels[0], blueprintIndex: docs.blueprintIndex.rel }, failures);
  assert.deepStrictEqual(failures.filter((f) => f.code === 'G20'), []);
});

test('legacy repair → keeps the terminal verify without --verify and applies only the single-argv check to --verify', () => {
  const drive = repairIntakeDrive('bouncer-repair-legacy-verify-', '.bouncer/context/epics/112-x/blueprints/004-y', { scoped: false });
  const before = repairIntakeSnapshot(drive);
  const chained = repairIntake(drive, { verify: 'node --test a && node --test b' });
  assert.strictEqual(chained.reason, 'repair-verify-not-single-argv', JSON.stringify(chained));
  assert.strictEqual(repairIntakeSnapshot(drive), before);

  const kept = repairIntake(drive, {});
  assert.strictEqual(kept.ok, true, JSON.stringify(kept));
  const keptDoc = readDoc(path.join(drive.integrationPath, drive.blueprint, 'tasks', kept.repairTask.id, 'tasks.md'));
  assert.strictEqual(keptDoc.data.bouncer.verify, 'npm run ci');

  const own = repairIntakeDrive('bouncer-repair-legacy-own-', '.bouncer/context/epics/112-x/blueprints/005-y', { scoped: false });
  // legacy는 종단 비교 없이 단일 argv만 본다 — 종단과 같은 명령도 거절하지 않는다.
  const same = repairIntake(own, { verify: 'npm run ci' });
  assert.strictEqual(same.ok, true, JSON.stringify(same));
});

test('review-caused repair with an untracked --paths entry → rejects before any write', () => {
  const drive = repairIntakeDrive('bouncer-repair-review-path-', '.bouncer/context/epics/112-x/blueprints/006-y', { scoped: true });
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  for (const entry of ledger.tasks) entry.status = 'integrated';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const before = repairIntakeSnapshot(drive);
  const out = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integrationPath, task: '002',
    reviewFindings: ['F1'], summary: 'must_fix', paths: ['src/ghost.js'], decision: 'repair review',
    verify: 'node --test test/fix.test.js',
  });
  assert.strictEqual(out.reason, 'scope-path-untracked', JSON.stringify(out));
  assert.deepStrictEqual(out.paths, ['src/ghost.js']);
  assert.strictEqual(repairIntakeSnapshot(drive), before);
});

test('terminal verification failing after the repair scope was revised → failure evidence carries the current scope', () => {
  const drive = repairIntakeDrive('bouncer-repair-r2-evidence-', '.bouncer/context/epics/112-x/blueprints/007-y', { scoped: true });
  const repaired = repairIntake(drive, { verify: 'node --test test/fix.test.js' });
  assert.strictEqual(repaired.ok, true, JSON.stringify(repaired));
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  const repairEntry = ledger.tasks.find((entry) => entry.id === repaired.repairTask.id);
  repairEntry.status = 'integrated';
  repairEntry.scope = { revision: 'r9', paths: ['src/third.js'] };
  ledger.tasks.find((entry) => entry.id === '002').status = 'ready';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const failed = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integrationPath, task: '002',
    deps: { runVerification: () => ({ ok: false, command: 'npm run ci', exitCode: 1 }) },
  });
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8')).terminalFailure.paths, ['src/third.js']);
});

test('bootstrap with leftover scaffold comments → refuses before creating a worktree', () => {
  const { coordinatorPathsFor, branchNamesFor } = require('../scripts/lib/runtime-state');
  const git = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const blueprint = '.bouncer/context/epics/084-x/blueprints/002-y';
  const bp = blueprint;
  const repo = repoTemplate.copy();
  fs.mkdirSync(path.join(repo, bp, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, bp, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(path.join(repo, bp, 'review.md'), '<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->\n');
  fs.writeFileSync(
    path.join(repo, bp, 'tasks', '001', 'tasks.md'),
    '---\nbouncer:\n  depends_on: []\n---\n<!-- 저자 메모 -->\n',
  );
  const paths = coordinatorPathsFor({ repoRoot: repo, blueprint });
  const integrationPath = paths.integrationPath;
  const integrationBranch = branchNamesFor({ repoRoot: repo, blueprint }).integration;
  const statusBefore = git(repo, ['status', '--porcelain']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.reason, 'scaffold-comment-remaining');
  assert.deepStrictEqual(boot.paths, [`${bp}/review.md`]);
  assert.strictEqual(fs.existsSync(integrationPath), false);
  assert.strictEqual(git(repo, ['branch', '--list', integrationBranch]).trim(), '');   // branch 없음
  assert.strictEqual(git(repo, ['status', '--porcelain']), statusBefore);              // 메인 상태 그대로

  fs.mkdirSync(integrationPath, { recursive: true });
  fs.writeFileSync(path.join(integrationPath, 'stray'), 'not a worktree\n');
  const unassigned = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(unassigned.reason, 'unassigned-integration-worktree');            // 미등록 디렉터리가 먼저 판정됨
});

test('resumed bootstrap when the ledger exists → skips the scaffold comment scan', () => {
  const blueprint = '.bouncer/context/epics/084-x/blueprints/003-z';
  const repo = repoTemplate.copy();
  fs.mkdirSync(path.join(repo, blueprint, 'tasks', '001'), { recursive: true });
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), '---\nbouncer:\n  status: approved\n---\n# Blueprint\n');
  fs.writeFileSync(
    path.join(repo, blueprint, 'tasks', '001', 'tasks.md'),
    '---\nbouncer:\n  depends_on: []\n---\nbrief\n',
  );
  const first = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  fs.writeFileSync(
    path.join(repo, blueprint, 'review.md'),
    '<!-- 왜 지금 이 에픽인가. 두 문장 이내. -->\n',
  );
  const resumed = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(resumed.ok, true);                                 // 원장 있는 재개 bootstrap은 검사 안 함
});

// --- light ledger mode (TASKS-001 / epic 089 blueprint 003) ---

/**
 * light/full bootstrap 픽스처. scale·task 수·depends_on·execution_kind를 고른다.
 *
 * @param {string} prefix - tmpdir prefix
 * @param {string} blueprint - blueprint 상대 경로
 * @param {{ scale?: string, tasks?: Array<{ id: string, depends_on?: string[], execution_kind?: string }>, review_scope?: string }} [opts]
 * @returns {{ repo: string, blueprint: string }}
 */
function lightScaleRepo(prefix, blueprint, opts = {}) {
  const scale = opts.scale === undefined ? 'light' : opts.scale;
  const tasks = opts.tasks || [{ id: '001', depends_on: [] }];
  const reviewScope = opts.review_scope === undefined ? 'blueprint' : opts.review_scope;
  const repo = lightTemplate.copy();
  fs.mkdirSync(path.join(repo, blueprint), { recursive: true });
  const scopeLine = reviewScope ? `  review_scope: ${reviewScope}\n` : '';
  const scaleLine = scale ? `  scale: ${scale}\n` : '';
  const policyLine = opts.policy ? `  verification_policy: ${opts.policy}\n` : '';
  fs.writeFileSync(
    path.join(repo, blueprint, 'index.md'),
    `---\nbouncer:\n  status: approved\n${scaleLine}${scopeLine}${policyLine}---\n# Blueprint\n`,
  );
  if (reviewScope === 'blueprint') {
    fs.writeFileSync(
      path.join(repo, blueprint, 'review.md'),
      '---\nbouncer:\n  id: REVIEW-BP\n  status: pending\n  review:\n    required: true\n---\n# Review\n',
    );
  }
  for (const t of tasks) {
    const dir = path.join(repo, blueprint, 'tasks', t.id);
    fs.mkdirSync(dir, { recursive: true });
    const deps = Array.isArray(t.depends_on) ? t.depends_on : [];
    const kind = t.execution_kind ? `  execution_kind: ${t.execution_kind}\n` : '';
    fs.writeFileSync(
      path.join(dir, 'tasks.md'),
      `---\nbouncer:\n  status: ready\n  depends_on: ${JSON.stringify(deps)}\n${kind}`
        + '  parallel_safe: false\n  dependency_gate: integrated\n  affected_paths:\n    - src/a.js\n---\nbrief\n',
    );
    fs.writeFileSync(
      path.join(dir, 'verification.md'),
      `---\nbouncer:\n  id: VERIFY-${t.id}\n  status: pending\n---\n# Verification\n`,
    );
  }
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'plan'], { cwd: repo });
  return { repo, blueprint };
}

/**
 * blueprint 루트 review.md에 라운드 하나와 status를 심는다.
 *
 * @param {string} root - checkout 루트
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} status - bouncer.status
 * @param {boolean} withRound - rounds에 discovery 1개를 넣을지
 */
function writeBlueprintReview(root, blueprint, status, withRound) {
  const rounds = withRound
    ? '    rounds:\n      - round: 1\n        mode: discovery\n        target:\n          base: aaa\n          head: bbb\n'
          + '        perspectives:\n          - name: combined\n            target_head: bbb\n'
          + '        previous_finding_ids: []\n        new: 0\n        resolved: 0\n        regressed: 0\n'
    : '    rounds: []\n';
  fs.writeFileSync(
    path.join(root, blueprint, 'review.md'),
    `---\nbouncer:\n  id: REVIEW-BP\n  status: ${status}\n  review:\n    required: true\n${rounds}---\n# Review\n`,
  );
}

test('light bootstrap prepare integrate → no worker worktree, workerPath is integration, fanin verified', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/001-ok';
  const { repo } = lightScaleRepo('bouncer-light-ok-', blueprint);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.mode, 'light');
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.strictEqual(ledger.mode, 'light');

  const workersRoot = path.join(boot.integrationPath, '..', 'workers');
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.strictEqual(prepared.tasks[0].workerPath, boot.integrationPath);
  assert.strictEqual(fs.existsSync(workersRoot), false);

  const cwd = boot.integrationPath;
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  fs.writeFileSync(path.join(cwd, 'src/a.js'), 'changed\n');
  execFileSync('git', ['add', 'src/a.js'], { cwd });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'feat: a'], { cwd });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  // review_scope blueprint이면 task review.md는 fan-in 증적에서 빠진다.
  const taskDir = path.join(cwd, blueprint, 'tasks/001');
  for (const [name, status, extra] of [
    ['tasks.md', 'verified', `  commit_sha: '${sha.slice(0, 8)}'\n`],
    ['verification.md', 'passed', ''],
  ]) {
    const file = path.join(taskDir, name);
    const doc = readDoc(file);
    doc.data.bouncer.status = status;
    if (extra.includes('commit_sha')) doc.data.bouncer.commit_sha = sha.slice(0, 8);
    fs.writeFileSync(file, renderDoc(doc.data, doc.body));
  }
  writeBlueprintReview(cwd, blueprint, 'accepted', true);
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: 'done',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd, task: '001' });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));

  const faninPath = path.join(boot.integrationPath, '..', 'fanin');
  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.strictEqual(fs.existsSync(faninPath), false);
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.strictEqual(after.tasks[0].status, 'integrated');
  assert.strictEqual(after.fanin, null);
  const faninDecision = after.decisions.find((d) => d.kind === 'fanin');
  assert.ok(faninDecision, JSON.stringify(after.decisions));
  assert.strictEqual(faninDecision.candidate_head, sha);
});

test('light ledger with scale full, eligibility misshape or verification → rejects with light-requires-single-task', () => {
  // scale full → mode full (light 거부가 아님). light + 잘못된 형태만 거부.
  const fullBp = '.bouncer/context/epics/089-light/blueprints/002-full';
  const full = lightScaleRepo('bouncer-light-full-', fullBp, { scale: 'full' });
  const fullBoot = coordinate({ command: 'bootstrap', repoRoot: full.repo, blueprint: fullBp });
  assert.strictEqual(fullBoot.ok, true, JSON.stringify(fullBoot));
  assert.strictEqual(fullBoot.mode, 'full');
  assert.strictEqual(
    JSON.parse(fs.readFileSync(path.join(fullBoot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8')).mode,
    undefined,
  );

  const twoBp = '.bouncer/context/epics/089-light/blueprints/003-two';
  const two = lightScaleRepo('bouncer-light-two-', twoBp, {
    scale: 'light',
    tasks: [{ id: '001', depends_on: [] }, { id: '002', depends_on: [] }],
  });
  const twoBoot = coordinate({ command: 'bootstrap', repoRoot: two.repo, blueprint: twoBp });
  assert.strictEqual(twoBoot.ok, false, JSON.stringify(twoBoot));
  assert.strictEqual(twoBoot.reason, 'light-requires-single-task');

  const depBp = '.bouncer/context/epics/089-light/blueprints/004-dep';
  // depends_on이 비어 있지 않으려면 선행 task가 있어야 listTasks가 읽는다.
  // 단일 task에 depends_on: ['002']만 있어도 거절 조건이다.
  const dep = lightScaleRepo('bouncer-light-dep-', depBp, {
    scale: 'light',
    tasks: [{ id: '001', depends_on: ['002'] }],
  });
  const depBoot = coordinate({ command: 'bootstrap', repoRoot: dep.repo, blueprint: depBp });
  assert.strictEqual(depBoot.ok, false, JSON.stringify(depBoot));
  assert.strictEqual(depBoot.reason, 'light-requires-single-task');

  const verBp = '.bouncer/context/epics/089-light/blueprints/005-ver';
  const ver = lightScaleRepo('bouncer-light-ver-', verBp, {
    scale: 'light',
    tasks: [{ id: '001', depends_on: [], execution_kind: 'verification' }],
  });
  const verBoot = coordinate({ command: 'bootstrap', repoRoot: ver.repo, blueprint: verBp });
  assert.strictEqual(verBoot.ok, false, JSON.stringify(verBoot));
  assert.strictEqual(verBoot.reason, 'light-requires-single-task');
});

test('scoped_terminal light bootstrap → accepts one independent commit plus its terminal only', () => {
  const ok = lightScaleRepo('bouncer-light-scoped-ok-', '.bouncer/context/epics/089-light/blueprints/007-scoped', {
    policy: 'scoped_terminal',
    tasks: [
      { id: '001', depends_on: [] },
      { id: '002', depends_on: ['TASKS-001'], execution_kind: 'verification' },
    ],
  });
  const boot = coordinate({ command: 'bootstrap', repoRoot: ok.repo, blueprint: ok.blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.mode, 'light');
  assert.deepStrictEqual(boot.ready, ['001']);

  // 같은 두 node라도 표식이 없으면(legacy light) 현행 의미대로 거절한다.
  const legacy = lightScaleRepo('bouncer-light-scoped-legacy-', '.bouncer/context/epics/089-light/blueprints/008-legacy', {
    tasks: [
      { id: '001', depends_on: [] },
      { id: '002', depends_on: ['TASKS-001'], execution_kind: 'verification' },
    ],
  });
  const legacyBoot = coordinate({ command: 'bootstrap', repoRoot: legacy.repo, blueprint: legacy.blueprint });
  assert.strictEqual(legacyBoot.reason, 'light-requires-single-task');

  const shapes = {
    'two commits plus terminal': [
      { id: '001', depends_on: [] }, { id: '002', depends_on: [] },
      { id: '003', depends_on: ['TASKS-001', 'TASKS-002'], execution_kind: 'verification' },
    ],
    'commit only': [{ id: '001', depends_on: [] }],
    'dependent commit': [
      { id: '001', depends_on: ['TASKS-002'] },
      { id: '002', depends_on: ['TASKS-001'], execution_kind: 'verification' },
    ],
    'terminal not waiting for the commit': [
      { id: '001', depends_on: [] },
      { id: '002', depends_on: ['TASKS-009'], execution_kind: 'verification' },
    ],
  };
  let n = 20;
  for (const [label, tasks] of Object.entries(shapes)) {
    n += 1;
    const bp = `.bouncer/context/epics/089-light/blueprints/0${n}-shape`;
    const r = lightScaleRepo(`bouncer-light-scoped-${n}-`, bp, { policy: 'scoped_terminal', tasks });
    const rejected = coordinate({ command: 'bootstrap', repoRoot: r.repo, blueprint: bp });
    assert.strictEqual(rejected.reason, 'light-requires-single-task', `${label}: ${JSON.stringify(rejected)}`);
  }
});

test('bootstrap with an unknown verification_policy value → rejects with verification-policy-invalid', () => {
  const bp = '.bouncer/context/epics/089-light/blueprints/009-badpolicy';
  const r = lightScaleRepo('bouncer-light-badpolicy-', bp, { scale: 'full', policy: 'strict' });
  const boot = coordinate({ command: 'bootstrap', repoRoot: r.repo, blueprint: bp });
  assert.strictEqual(boot.ok, false, JSON.stringify(boot));
  assert.strictEqual(boot.reason, 'verification-policy-invalid');
});

test('opposite-mode bootstrap resume → rejects with ledger-mode-mismatch', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/006-mismatch';
  const { repo } = lightScaleRepo('bouncer-light-mismatch-', blueprint, { scale: 'light' });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.mode, 'light');
  // integration·메인 index를 full로 바꿔 재개 bootstrap이 반대 모드를 보게 한다.
  const indexBody = '---\nbouncer:\n  status: approved\n  scale: full\n  review_scope: blueprint\n---\n# Blueprint\n';
  fs.writeFileSync(path.join(repo, blueprint, 'index.md'), indexBody);
  fs.writeFileSync(path.join(boot.integrationPath, blueprint, 'index.md'), indexBody);
  const resumed = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(resumed.ok, false, JSON.stringify(resumed));
  assert.strictEqual(resumed.reason, 'ledger-mode-mismatch');
});

test('light report without a report file → accepts inline and stores no open_choices', () => {
  const blueprint = '.bouncer/context/epics/098-x/blueprints/006-light';
  const { repo } = lightScaleRepo('bouncer-light-nofile-', blueprint);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const cwd = boot.integrationPath;
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const dispatched = coordinate({ command: 'dispatch', repoRoot: repo, blueprint, cwd, task: '001' });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'rework', summary: 'inline light report',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  assert.strictEqual(reported.decision.open_choices, undefined);
  assert.strictEqual(reported.decision.known_weaknesses, undefined);
});

test('accepted report without accepted rounds on a light ledger → rejects with light-review-required', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/007-rev';
  const { repo } = lightScaleRepo('bouncer-light-rev-', blueprint);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const cwd = boot.integrationPath;
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));

  writeBlueprintReview(cwd, blueprint, 'pending', false);
  const emptyRounds = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: 'no rounds',
  });
  assert.strictEqual(emptyRounds.ok, false, JSON.stringify(emptyRounds));
  assert.strictEqual(emptyRounds.reason, 'light-review-required');

  writeBlueprintReview(cwd, blueprint, 'addressed', true);
  const badStatus = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: 'not accepted status',
  });
  assert.strictEqual(badStatus.ok, false, JSON.stringify(badStatus));
  assert.strictEqual(badStatus.reason, 'light-review-required');

  writeBlueprintReview(cwd, blueprint, 'accepted', true);
  commitAndStampWorker(repo, blueprint, cwd);
  const okReport = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: 'reviewed',
  });
  assert.strictEqual(okReport.ok, true, JSON.stringify(okReport));
});

test('light ledger with workerPath not integration → rejects dispatch and record', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/008-path';
  const { repo } = lightScaleRepo('bouncer-light-path-', blueprint);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  const fakeWorker = path.join(boot.integrationPath, '..', 'workers', '001');
  ledger.tasks[0].workerPath = fakeWorker;
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  const rejectedDispatch = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.strictEqual(rejectedDispatch.ok, false, JSON.stringify(rejectedDispatch));
  assert.strictEqual(rejectedDispatch.reason, 'unassigned-worker-worktree');

  // report 경로를 쓰기 위해 원장을 정상 light 배정으로 되돌린 뒤 dispatch·report까지 진행하고
  // record 직전에 다시 잘못된 workerPath를 심는다.
  const reset = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  reset.tasks[0].workerPath = boot.integrationPath;
  delete reset.tasks[0].dispatch;
  fs.writeFileSync(ledgerFile, `${JSON.stringify(reset, null, 2)}\n`);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  writeBlueprintReview(boot.integrationPath, blueprint, 'accepted', true);
  commitAndStampWorker(repo, blueprint, boot.integrationPath);
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: 'ok',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const beforeRecord = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  beforeRecord.tasks[0].workerPath = fakeWorker;
  fs.writeFileSync(ledgerFile, `${JSON.stringify(beforeRecord, null, 2)}\n`);
  const rejectedRecord = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.strictEqual(rejectedRecord.ok, false, JSON.stringify(rejectedRecord));
  assert.strictEqual(rejectedRecord.reason, 'unassigned-worker-worktree');
});

// --- promote-stop (TASKS-003 / epic 089 blueprint 003) ---

const PROMOTE_REASONS = [
  'security-risk', 'out-of-scope', 'task-split', 'interface-semantics', 'reviewer-wider-scope',
];

/**
 * light bootstrap 뒤 prepared 상태까지 만든다. promote-stop 단언용.
 *
 * @param {string} prefix - tmpdir prefix
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {{ repo: string, blueprint: string, integrationPath: string, ledgerFile: string }}
 */
function lightPreparedDrive(prefix, blueprint) {
  const { repo } = lightScaleRepo(prefix, blueprint);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  return {
    repo,
    blueprint,
    integrationPath: boot.integrationPath,
    ledgerFile: path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'),
  };
}

test('promote-stop with each of the five reasons on a light ledger → records each', () => {
  for (const reason of PROMOTE_REASONS) {
    const blueprint = `.bouncer/context/epics/089-light/blueprints/010-${reason}`;
    const drive = lightPreparedDrive(`bouncer-promote-${reason}-`, blueprint);
    fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), `changed-${reason}\n`);
    const ledgerBefore = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
    ledgerBefore.tasks[0].verify_evidence_id = 'v'.repeat(64);
    ledgerBefore.tasks[0].review_evidence_id = 'r'.repeat(64);
    const faninBefore = ledgerBefore.fanin;
    const terminalBefore = ledgerBefore.terminalFailure;
    fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledgerBefore, null, 2)}\n`);
    const porcelainBefore = execFileSync('git', ['status', '--porcelain'], {
      cwd: drive.integrationPath, encoding: 'utf8',
    });

    const out = coordinate({
      command: 'promote-stop', repoRoot: drive.repo, blueprint,
      cwd: drive.integrationPath, reason, summary: `stop for ${reason}`,
    });
    assert.strictEqual(out.ok, true, JSON.stringify(out));
    assert.strictEqual(out.status, 'promotion_stopped');
    assert.strictEqual(out.promotion.reason, reason);
    assert.strictEqual(out.promotion.summary, `stop for ${reason}`);
    assert.strictEqual(out.promotion.task, '001');
    assert.match(out.promotion.diff_sha, /^[a-f0-9]{64}$/);
    assert.strictEqual(out.promotion.verify_evidence_id, 'v'.repeat(64));
    assert.strictEqual(out.promotion.review_evidence_id, 'r'.repeat(64));

    const after = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
    assert.strictEqual(after.status, 'promotion_stopped');
    assert.deepStrictEqual(after.promotion, out.promotion);
    assert.strictEqual(after.fanin, faninBefore);
    assert.strictEqual(after.terminalFailure, terminalBefore);
    assert.strictEqual(
      execFileSync('git', ['status', '--porcelain'], {
        cwd: drive.integrationPath, encoding: 'utf8',
      }),
      porcelainBefore,
      'promote-stop must preserve worktree dirty state',
    );
  }
});

test('promote-stop on a full ledger → rejects with promote-stop-requires-light', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/011-full-stop';
  const { repo } = lightScaleRepo('bouncer-promote-full-', blueprint, { scale: 'full' });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const out = coordinate({
    command: 'promote-stop', repoRoot: repo, blueprint,
    cwd: boot.integrationPath, reason: 'task-split', summary: 'need full',
  });
  assert.strictEqual(out.ok, false, JSON.stringify(out));
  assert.strictEqual(out.reason, 'promote-stop-requires-light');
});

test('promote-stop with a reason outside the five enums → rejects with promote-reason-invalid', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/012-bad-reason';
  const drive = lightPreparedDrive('bouncer-promote-bad-', blueprint);
  const out = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'maybe-later', summary: 'nope',
  });
  assert.strictEqual(out.ok, false, JSON.stringify(out));
  assert.strictEqual(out.reason, 'promote-reason-invalid');
});

test('promote-stop with the same reason and summary → is idempotent', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/013-idem';
  const drive = lightPreparedDrive('bouncer-promote-idem-', blueprint);
  const first = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'out-of-scope', summary: 'same',
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  assert.strictEqual(first.status, 'promotion_stopped');
  const second = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'out-of-scope', summary: 'same',
  });
  assert.strictEqual(second.ok, true, JSON.stringify(second));
  assert.strictEqual(second.status, 'promotion_stopped');
  assert.deepStrictEqual(second.promotion, first.promotion);
});

test('promote-stop with a different reason or summary → rejects with promotion-already-stopped', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/014-already';
  const drive = lightPreparedDrive('bouncer-promote-already-', blueprint);
  const first = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'security-risk', summary: 'first',
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const differentSummary = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'security-risk', summary: 'second',
  });
  assert.strictEqual(differentSummary.ok, false, JSON.stringify(differentSummary));
  assert.strictEqual(differentSummary.reason, 'promotion-already-stopped');
  const differentReason = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'task-split', summary: 'first',
  });
  assert.strictEqual(differentReason.ok, false, JSON.stringify(differentReason));
  assert.strictEqual(differentReason.reason, 'promotion-already-stopped');
});

test('promotion_stopped ledger → refuses prepare dispatch report record integrate', () => {
  const blueprint = '.bouncer/context/epics/089-light/blueprints/015-refuse';
  const drive = lightPreparedDrive('bouncer-promote-refuse-', blueprint);
  const cwd = drive.integrationPath;
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const stopped = coordinate({
    command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd, reason: 'interface-semantics', summary: 'freeze',
  });
  assert.strictEqual(stopped.ok, true, JSON.stringify(stopped));
  assert.strictEqual(stopped.status, 'promotion_stopped');

  for (const command of ['prepare', 'dispatch', 'report', 'record', 'integrate']) {
    const after = coordinate({
      command, repoRoot: drive.repo, blueprint, cwd, task: '001',
      attempt: dispatched.metadata.attempt,
      taskBriefHash: dispatched.metadata.task_brief_hash,
      outcome: 'accepted',
      summary: 'should not land',
    });
    assert.strictEqual(after.ok, false, `${command}: ${JSON.stringify(after)}`);
    assert.strictEqual(after.reason, 'promotion-stopped', command);
  }
});

test('promotion_stopped light ledger with full scale and --promote-light → archives, writes the patch, and seeds a full ledger', () => {
  const blueprint = '.bouncer/context/epics/107-workflow-cost-reduction/blueprints/003-plan-run-call-reduction-replacement';
  const drive = lightPreparedDrive('bouncer-promote-light-success-', blueprint);
  fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), 'light work\n');
  const lightPlanPath = path.join(drive.integrationPath, blueprint, 'index.md');
  fs.writeFileSync(lightPlanPath, `${fs.readFileSync(lightPlanPath, 'utf8')}\nlight-only note\n`);
  fs.writeFileSync(path.join(drive.integrationPath, 'src/new.bin'), Buffer.from([0, 255, 1, 2]));
  const stopped = coordinate({ command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'task-split', summary: 'needs full' });
  assert.strictEqual(stopped.ok, true, JSON.stringify(stopped));
  const mainIndex = path.join(drive.repo, blueprint, 'index.md');
  fs.writeFileSync(mainIndex, fs.readFileSync(mainIndex, 'utf8').replace('scale: light', 'scale: full'));
  const out = coordinate({ command: 'bootstrap', repoRoot: drive.repo, blueprint, promoteLight: true });
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  const archive = path.join(drive.integrationPath, '.bouncer/runtime/coordinator.light-promoted.json');
  const patch = path.join(drive.integrationPath, '.bouncer/runtime/light-promoted.patch');
  assert.ok(fs.existsSync(archive));
  assert.ok(fs.existsSync(patch));
  execFileSync('git', ['apply', '--check', patch], { cwd: drive.integrationPath });
  assert.match(fs.readFileSync(patch, 'utf8'), /GIT binary patch/);
  assert.match(fs.readFileSync(patch, 'utf8'), /src\/new\.bin/);
  assert.doesNotMatch(fs.readFileSync(patch, 'utf8'), /light-only note|blueprints\/003-plan-run-call-reduction-replacement\/index\.md/);
  assert.strictEqual(fs.readFileSync(lightPlanPath, 'utf8'), fs.readFileSync(path.join(drive.repo, blueprint, 'index.md'), 'utf8'));
  assert.strictEqual(fs.existsSync(path.join(drive.integrationPath, 'src/new.bin')), false);
  assert.strictEqual(fs.readFileSync(path.join(drive.integrationPath, 'src/a.js'), 'utf8'),
    execFileSync('git', ['show', 'HEAD:src/a.js'], { cwd: drive.integrationPath, encoding: 'utf8' }));
  const archived = JSON.parse(fs.readFileSync(archive, 'utf8'));
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.mode, undefined);
  assert.strictEqual(ledger.base, archived.base);
  assert.strictEqual(ledger.promoted_from.diff_sha, archived.promotion.diff_sha);
  assert.strictEqual(out.mode, 'full');
});

for (const [condition, mutate, expected] of [
  ['missing ledger', 'missing', 'promote-light-requires-stopped'],
  ['full ledger', 'full', 'promote-light-requires-stopped'],
  ['not stopped', 'active', 'promote-light-requires-stopped'],
  ['light scale', 'stopped', 'promote-light-scale-light'],
  ['archive exists', 'archive', 'promote-light-archive-exists'],
  ['diff drift', 'drift', 'promotion-diff-drift'],
]) {
  test(`--promote-light with ${condition} → rejects with ${expected}`, () => {
    const slug = condition.replaceAll(' ', '-');
    const blueprint = `.bouncer/context/epics/107-promote-reject/blueprints/007-${slug}`;
    const drive = lightPreparedDrive('bouncer-promote-light-reject-', blueprint);
    const ledgerBytes = fs.readFileSync(drive.ledgerFile);
    if (['stopped', 'archive', 'drift'].includes(mutate)) {
      const stopped = coordinate({ command: 'promote-stop', repoRoot: drive.repo, blueprint,
        cwd: drive.integrationPath, reason: 'task-split', summary: 'needs full' });
      assert.strictEqual(stopped.ok, true, JSON.stringify(stopped));
    }
    if (mutate === 'missing') {
      fs.rmSync(drive.ledgerFile);
    } else if (mutate === 'full') {
      const ledger = JSON.parse(ledgerBytes); delete ledger.mode;
      fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
    } else if (mutate === 'active') {
      const ledger = JSON.parse(ledgerBytes); ledger.status = 'active'; delete ledger.promotion;
      fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
    } else if (mutate === 'stopped') {
      // stopped 상태는 유지하되 main scale을 light로 둬 scale 검사에 도달한다.
    } else if (mutate === 'archive') {
      const index = path.join(drive.repo, blueprint, 'index.md');
      fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('scale: light', 'scale: full'));
      fs.writeFileSync(path.join(drive.integrationPath, '.bouncer/runtime/coordinator.light-promoted.json'), 'occupied');
    } else if (mutate === 'drift') {
      const index = path.join(drive.repo, blueprint, 'index.md');
      fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('scale: light', 'scale: full'));
      fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), 'changed after stop\n');
    }
    const beforeBytes = fs.existsSync(drive.ledgerFile) ? fs.readFileSync(drive.ledgerFile) : null;
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: drive.integrationPath, encoding: 'utf8' });
    const out = coordinate({ command: 'bootstrap', repoRoot: drive.repo, blueprint, promoteLight: true });
    assert.strictEqual(out.ok, false);
    assert.strictEqual(out.reason, expected);
    assert.deepStrictEqual(fs.existsSync(drive.ledgerFile) ? fs.readFileSync(drive.ledgerFile) : null, beforeBytes);
    assert.strictEqual(execFileSync('git', ['status', '--porcelain'], { cwd: drive.integrationPath, encoding: 'utf8' }), status);
  });
}

test('promote-light with writeLedger failing on the new ledger → rolls back and returns restored true', () => {
  const blueprint = '.bouncer/context/epics/107-promote-rollback/blueprints/001-plan';
  const drive = lightPreparedDrive('bouncer-promote-light-rollback-', blueprint);
  fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), 'light work\n');
  fs.chmodSync(path.join(drive.integrationPath, 'src/a.js'), 0o755);
  execFileSync('git', ['add', 'src/a.js'], { cwd: drive.integrationPath });
  fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), 'partially staged work\n');
  const dirtyPlanPath = path.join(drive.integrationPath, blueprint, 'index.md');
  fs.writeFileSync(dirtyPlanPath, `${fs.readFileSync(dirtyPlanPath, 'utf8')}\nlight-only note\n`);
  const stopped = coordinate({ command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'task-split', summary: 'needs full' });
  assert.strictEqual(stopped.ok, true);
  const index = path.join(drive.repo, blueprint, 'index.md');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('scale: light', 'scale: full'));
  const bytes = fs.readFileSync(drive.ledgerFile);
  const originalStaged = execFileSync('git', ['diff', '--cached', '--binary'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  });
  const originalMode = fs.statSync(path.join(drive.integrationPath, 'src/a.js')).mode & 0o777;
  const originalDocs = [
    `${blueprint}/index.md`, `${blueprint}/tasks/001/tasks.md`, `${blueprint}/verification.md`,
    '.bouncer/context/index.md',
  ].map((rel) => [rel, fs.existsSync(path.join(drive.integrationPath, rel))
    ? fs.readFileSync(path.join(drive.integrationPath, rel)) : null]);
  const originalStatus = execFileSync('git', ['status', '--porcelain'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  });
  const originalDiff = execFileSync('git', ['diff', 'HEAD'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  });
  const originalDiffSha = crypto.createHash('sha256')
    .update(originalStatus, 'utf8').update('\0').update(originalDiff, 'utf8').digest('hex');
  const beforeDiff = stopped.promotion.diff_sha;
  const out = coordinate({ command: 'bootstrap', repoRoot: drive.repo, blueprint, promoteLight: true,
    deps: { writeLedger: (file, ledger) => {
      if (file === drive.ledgerFile && ledger.promoted_from) throw new Error('injected full ledger write failure');
      __coordinatorMod.atomicWrite ? __coordinatorMod.atomicWrite(file, ledger) : fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`);
    } },
  });
  assert.strictEqual(out.reason, 'promote-light-incomplete');
  assert.strictEqual(out.restored, true);
  assert.strictEqual(fs.statSync(path.join(drive.integrationPath, 'src/a.js')).mode & 0o777, originalMode);
  for (const [rel, original] of originalDocs) {
    const abs = path.join(drive.integrationPath, rel);
    assert.deepStrictEqual(fs.existsSync(abs) ? fs.readFileSync(abs) : null, original);
  }
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), bytes);
  assert.strictEqual(execFileSync('git', ['diff', '--cached', '--binary'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  }), originalStaged);
  assert.strictEqual(fs.existsSync(path.join(drive.integrationPath, '.bouncer/runtime/coordinator.light-promoted.json')), false);
  assert.strictEqual(fs.existsSync(path.join(drive.integrationPath, '.bouncer/runtime/light-promoted.patch')), false);
  const afterStatus = execFileSync('git', ['status', '--porcelain'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  });
  const afterDiff = execFileSync('git', ['diff', 'HEAD'], {
    cwd: drive.integrationPath, encoding: 'utf8',
  });
  const afterDiffSha = crypto.createHash('sha256')
    .update(afterStatus, 'utf8').update('\0').update(afterDiff, 'utf8').digest('hex');
  assert.strictEqual(afterDiffSha, originalDiffSha);
  assert.strictEqual(beforeDiff, stopped.promotion.diff_sha);
  assert.match(beforeDiff, /^[a-f0-9]{64}$/);
});

test('promotion rollback fingerprint mismatch → preserves manual recovery artifacts', () => {
  const blueprint = '.bouncer/context/epics/107-promote-rollback-mismatch/blueprints/001-plan';
  const drive = lightPreparedDrive('bouncer-promote-light-mismatch-', blueprint);
  fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), 'light work\n');
  const stopped = coordinate({ command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'task-split', summary: 'needs full' });
  assert.strictEqual(stopped.ok, true);
  fs.writeFileSync(path.join(drive.repo, blueprint, 'index.md'),
    fs.readFileSync(path.join(drive.repo, blueprint, 'index.md'), 'utf8').replace('scale: light', 'scale: full'));
  let worktreeDiffCalls = 0;
  const out = coordinate({ command: 'bootstrap', repoRoot: drive.repo, blueprint, promoteLight: true,
    deps: {
      execFileSync: (file, args, options) => {
        const result = execFileSync(file, args, options);
        if (file === 'git' && args.join(' ') === 'diff HEAD' && ++worktreeDiffCalls === 2) {
          return `${result}injected mismatch`;
        }
        return result;
      },
      writeLedger: (_file, ledger) => {
        if (ledger.promoted_from) throw new Error('injected full ledger write failure');
        fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
      },
    },
  });
  assert.strictEqual(out.reason, 'promote-light-incomplete');
  assert.strictEqual(out.restored, false);
  assert.ok(fs.existsSync(path.join(drive.integrationPath, '.bouncer/runtime/coordinator.light-promoted.json')));
  assert.ok(fs.existsSync(path.join(drive.integrationPath, '.bouncer/runtime/light-promoted.patch')));
});

test('promotion seed destination symlink outside integration → rolls back without changing target bytes', () => {
  const blueprint = '.bouncer/context/epics/107-promote-symlink/blueprints/001-plan';
  const drive = lightPreparedDrive('bouncer-promote-symlink-', blueprint);
  const external = path.join(os.tmpdir(), `bouncer-promotion-outside-${process.pid}`);
  fs.writeFileSync(external, 'protected external bytes\n');
  const integrationPlan = path.join(drive.integrationPath, blueprint, 'index.md');
  fs.rmSync(integrationPlan);
  fs.symlinkSync(external, integrationPlan);
  execFileSync('git', ['add', path.relative(drive.integrationPath, integrationPlan)], { cwd: drive.integrationPath });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'tracked plan symlink'], { cwd: drive.integrationPath });
  const stopped = coordinate({ command: 'promote-stop', repoRoot: drive.repo, blueprint,
    cwd: drive.integrationPath, reason: 'task-split', summary: 'needs full' });
  assert.strictEqual(stopped.ok, true);
  fs.writeFileSync(path.join(drive.repo, blueprint, 'index.md'),
    fs.readFileSync(path.join(drive.repo, blueprint, 'index.md'), 'utf8').replace('scale: light', 'scale: full'));
  const out = coordinate({ command: 'bootstrap', repoRoot: drive.repo, blueprint, promoteLight: true });
  assert.strictEqual(out.reason, 'promote-light-incomplete');
  assert.strictEqual(out.restored, true);
  assert.strictEqual(fs.readFileSync(external, 'utf8'), 'protected external bytes\n');
  assert.strictEqual(fs.readFileSync(path.join(drive.repo, blueprint, 'index.md'), 'utf8').includes('scale: full'), true);
  fs.rmSync(external, { force: true });
  const dangling = coordinate({ command: 'bootstrap', repoRoot: drive.repo, blueprint, promoteLight: true });
  assert.strictEqual(dangling.reason, 'promote-light-incomplete');
  assert.strictEqual(dangling.restored, true);
  assert.strictEqual(fs.existsSync(external), false);
});

// --- coordinate repair --kind supplement -----------------------------------
// 범위 내 테스트 보완은 새 task·repair wave 없이 제자리에서 닫는다. 아래 fixture는
// 모든 task가 integrated이고 테스트 경로가 affected_paths 안에 있는 integration이다.
function supplementDrive(prefix, blueprint) {
  const repo = uncommittedPlanRepo(prefix, blueprint, [
    ['001', '  depends_on: []\n  affected_paths:\n    - test/a.test.js\n    - src/a.js\n  verify: node --test\n'],
    ['002', '  depends_on: [TASKS-001]\n  affected_paths:\n    - test/a.test.js\n  verify: node --test\n'],
  ]);
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'plan'], { cwd: repo });
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const { coordinatorPathsFor } = require('../scripts/lib/runtime-state');
  const ledgerFile = coordinatorPathsFor({ repoRoot: repo, blueprint }).ledgerFile;
  const seeded = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  for (const entry of seeded.tasks) entry.status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(seeded, null, 2)}\n`);
  return { repo, blueprint, integrationPath: boot.integrationPath, ledgerFile };
}

function supplementOpts(drive, extra = {}) {
  return {
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integrationPath,
    kind: 'supplement', reviewFindings: ['F1'], summary: 'missing test evidence',
    paths: ['test/a.test.js'], decision: 'add the missing test',
    ...extra,
  };
}

function writeRootReview(drive, modes) {
  const rounds = modes.map((mode, index) => `      - round: ${index + 1}\n        mode: ${mode}\n`).join('');
  fs.writeFileSync(
    path.join(drive.integrationPath, drive.blueprint, 'review.md'),
    `---\nbouncer:\n  status: requested\n  review:\n    rounds:\n${rounds}---\n# Review\n`,
  );
}

function readLedger(drive) {
  return JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
}

test('supplement repair without a new task, wave or terminalFailure → is accepted', () => {
  const drive = supplementDrive('bouncer-supp-ok-', '.bouncer/context/epics/090-x/blueprints/001-y');
  const before = readLedger(drive);
  const out = coordinate(supplementOpts(drive));
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  assert.strictEqual(out.kind, 'supplement');
  assert.deepStrictEqual(out.paths, ['test/a.test.js']);
  const ledger = readLedger(drive);
  assert.strictEqual(ledger.tasks.length, before.tasks.length);
  assert.strictEqual(ledger.repairWaves?.length ?? 0, before.repairWaves?.length ?? 0);
  assert.strictEqual(ledger.terminalFailure, undefined);
  assert.deepStrictEqual(ledger.decisions.at(-1), {
    kind: 'supplement', outcome: 'pending', paths: ['test/a.test.js'], findings: ['F1'],
  });
});

test('supplement repair after both repair waves are used → is accepted', () => {
  const drive = supplementDrive('bouncer-supp-waves-', '.bouncer/context/epics/090-x/blueprints/002-y');
  const ledger = readLedger(drive);
  ledger.repairWaves = [{ wave: 1 }, { wave: 2 }];
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const out = coordinate(supplementOpts(drive));
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  assert.strictEqual(readLedger(drive).repairWaves.length, 2);
  // 기존 경로는 여전히 wave 한도로 막힌다.
  const product = coordinate({ ...supplementOpts(drive), kind: undefined, paths: ['src/a.js'] });
  assert.strictEqual(product.reason, 'repair-wave-limit');
});

test('supplement repair rejections → name the reason and leave the ledger untouched', () => {
  const drive = supplementDrive('bouncer-supp-reject-', '.bouncer/context/epics/090-x/blueprints/003-y');
  const before = fs.readFileSync(drive.ledgerFile, 'utf8');
  const reasonOf = (extra) => coordinate(supplementOpts(drive, extra)).reason;
  assert.strictEqual(reasonOf({ paths: ['src/a.js'] }), 'supplement-paths-not-tests');
  assert.strictEqual(reasonOf({ paths: ['test/fixtures/x.js'] }), 'supplement-paths-not-tests');
  assert.strictEqual(reasonOf({ paths: ['test/other.test.js'] }), 'repair-scope-out-of-bounds');
  assert.strictEqual(reasonOf({ paths: ['../x.test.js'] }), 'repair-scope-out-of-bounds');
  assert.strictEqual(reasonOf({ failureCommand: 'npm test' }), 'repair-cause-ambiguous');
  assert.strictEqual(reasonOf({ reviewFindings: [] }), 'failure-evidence-required');
  assert.strictEqual(reasonOf({ done: true, reviewFindings: undefined, summary: 'x' }), 'supplement-not-pending');
  writeRootReview(drive, ['discovery', 'delta']);
  assert.strictEqual(reasonOf({}), 'supplement-delta-used');
  fs.rmSync(path.join(drive.integrationPath, drive.blueprint, 'review.md'));
  assert.strictEqual(fs.readFileSync(drive.ledgerFile, 'utf8'), before);

  const ledger = readLedger(drive);
  ledger.tasks[1].status = 'prepared';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.strictEqual(reasonOf({}), 'review-repair-requires-integrated');
});

// 최종 리뷰는 discovery 한 라운드로 끝난다. 아래는 리뷰 모드 blueprint에 discovery가 저장된 뒤의
// 리뷰 원인 쓰기가 모두 사전에 거절되고 원장·task·review 파일이 변하지 않는지 본다.
function finalReviewStoredDrive(prefix, blueprint) {
  const drive = supplementDrive(prefix, blueprint);
  const indexFile = path.join(drive.integrationPath, blueprint, 'index.md');
  fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf8').replace('bouncer:\n', 'bouncer:\n  review_scope: blueprint\n'));
  writeRootReview(drive, ['discovery']);
  return drive;
}

function snapshotOf(drive) {
  const reviewFile = path.join(drive.integrationPath, drive.blueprint, 'review.md');
  const tasksDir = path.join(drive.integrationPath, drive.blueprint, 'tasks');
  return {
    ledger: fs.readFileSync(drive.ledgerFile, 'utf8'),
    review: fs.readFileSync(reviewFile, 'utf8'),
    tasks: fs.readdirSync(tasksDir).sort(),
  };
}

test('final discovery stored then supplement intake or review-caused repair → final-review-single-round and nothing changes', () => {
  const drive = finalReviewStoredDrive('bouncer-final-single-', '.bouncer/context/epics/090-x/blueprints/010-y');
  const before = snapshotOf(drive);
  assert.strictEqual(coordinate(supplementOpts(drive)).reason, 'final-review-single-round');
  const repair = coordinate(supplementOpts(drive, {
    kind: undefined, paths: ['src/a.js'],
  }));
  assert.strictEqual(repair.reason, 'final-review-single-round');
  assert.deepStrictEqual(snapshotOf(drive), before);
});

test('final discovery stored then supplement --done with a pending decision → final-review-single-round and the decision stays pending', () => {
  const drive = supplementDrive('bouncer-final-done-', '.bouncer/context/epics/090-x/blueprints/011-y');
  assert.strictEqual(coordinate(supplementOpts(drive)).ok, true);
  const indexFile = path.join(drive.integrationPath, drive.blueprint, 'index.md');
  fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf8').replace('bouncer:\n', 'bouncer:\n  review_scope: blueprint\n'));
  writeRootReview(drive, ['discovery']);
  const before = snapshotOf(drive);
  const out = coordinate(supplementOpts(drive, { done: true, reviewFindings: undefined, summary: 'tests added' }));
  assert.strictEqual(out.reason, 'final-review-single-round');
  assert.deepStrictEqual(snapshotOf(drive), before);
  assert.strictEqual(readLedger(drive).decisions.at(-1).outcome, 'pending');
});

test('final discovery stored then CI failure-command repair → is not rejected as a review-caused repair', () => {
  const drive = finalReviewStoredDrive('bouncer-final-ci-', '.bouncer/context/epics/090-x/blueprints/012-y');
  const out = coordinate(supplementOpts(drive, {
    kind: undefined, reviewFindings: undefined, failureCommand: 'npm test', task: undefined,
  }));
  assert.notStrictEqual(out.reason, 'final-review-single-round');
});

test('supplement --done with several verify commands → verifies once per distinct command and marks the decision verified', () => {
  const drive = supplementDrive('bouncer-supp-done-', '.bouncer/context/epics/090-x/blueprints/004-y');
  assert.strictEqual(coordinate(supplementOpts(drive)).ok, true);
  fs.mkdirSync(path.join(drive.integrationPath, 'test'), { recursive: true });
  fs.writeFileSync(path.join(drive.integrationPath, 'test/a.test.js'), '// supplement\n');
  const calls = [];
  const out = coordinate(supplementOpts(drive, {
    done: true, reviewFindings: undefined, summary: 'tests added',
    deps: {
      runVerification: (args) => {
        calls.push(args.taskId);
        return { ok: true, command: 'node --test', exitCode: 0, evidenceId: 'b'.repeat(64) };
      },
    },
  }));
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  // 001·002가 같은 verify를 선언하므로 한 번만 돈다.
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(readLedger(drive).decisions.at(-1).outcome, 'verified');
});

test('supplement --done when verification fails or paths exceed → keeps the decision pending', () => {
  const drive = supplementDrive('bouncer-supp-fail-', '.bouncer/context/epics/090-x/blueprints/005-y');
  assert.strictEqual(coordinate(supplementOpts(drive)).ok, true);
  const doneOpts = (deps) => supplementOpts(drive, {
    done: true, reviewFindings: undefined, summary: 'tests added', deps,
  });
  fs.mkdirSync(path.join(drive.integrationPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(drive.integrationPath, 'src/a.js'), '// product edit\n');
  const exceeded = coordinate(doneOpts({
    runVerification: () => { throw new Error('must not run'); },
  }));
  assert.strictEqual(exceeded.reason, 'supplement-paths-exceeded');
  fs.rmSync(path.join(drive.integrationPath, 'src/a.js'));

  fs.mkdirSync(path.join(drive.integrationPath, 'test'), { recursive: true });
  fs.writeFileSync(path.join(drive.integrationPath, 'test/a.test.js'), '// supplement\n');
  const failed = coordinate(doneOpts({
    runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1 }),
  }));
  assert.strictEqual(failed.reason, 'supplement-verify-failed');
  assert.strictEqual(readLedger(drive).decisions.at(-1).outcome, 'pending');
});

test('repair without --kind or with kind product → keeps the wave-consuming path', () => {
  const drive = supplementDrive('bouncer-supp-product-', '.bouncer/context/epics/090-x/blueprints/006-y');
  const out = coordinate(supplementOpts(drive, { kind: 'product', paths: ['test/fix.test.js'] }));
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  assert.strictEqual(out.wave, 1);
  assert.ok(out.repairTask);
  assert.strictEqual(readLedger(drive).repairWaves.length, 1);
  assert.ok(readLedger(drive).terminalFailure);
});

// 보고 파일 관측: dispatch가 attempt별 report_path를 발급하고 checkpoint가 투영 시점에만
// present/absent를 계산한다. 원장 bytes는 관측으로 바뀌면 안 된다.
test('dispatch issuing report_path → status projects report present/absent without ledger writes', () => {
  const blueprint = '.bouncer/context/epics/066-x/blueprints/067-y';
  const drive = preparedCommitDrive('bouncer-report-observation-', blueprint);
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  assert.strictEqual(dispatched.report_path,
    path.join(drive.worker, '.bouncer/runtime/reports', '001-1.md'));
  assert.deepStrictEqual(Object.keys(dispatched.metadata).sort(),
    ['attempt', 'base_head', 'initial_worktree_state', 'task_brief_hash']);
  const statusOf = () => coordinate({
    command: 'status', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
  });
  const before = fs.readFileSync(drive.ledgerFile);
  const first = statusOf();
  assert.deepStrictEqual(first.checkpoint.active_tasks[0].report,
    { path: dispatched.report_path, attempt: 1, state: 'absent' });
  assert.deepStrictEqual(first.checkpoint.executor_observation, UNKNOWN_EXECUTOR);

  // 0바이트 파일은 absent
  fs.mkdirSync(path.dirname(dispatched.report_path), { recursive: true });
  fs.writeFileSync(dispatched.report_path, '');
  assert.strictEqual(statusOf().checkpoint.active_tasks[0].report.state, 'absent');
  fs.rmSync(dispatched.report_path);
  // 디렉터리는 absent
  fs.mkdirSync(dispatched.report_path);
  assert.strictEqual(statusOf().checkpoint.active_tasks[0].report.state, 'absent');
  fs.rmdirSync(dispatched.report_path);
  // 정상 본문은 present
  fs.writeFileSync(dispatched.report_path, 'report body\n');
  const present = statusOf();
  assert.strictEqual(present.checkpoint.active_tasks[0].report.state, 'present');
  assert.ok(before.equals(fs.readFileSync(drive.ledgerFile)));
  assert.strictEqual(present.checkpoint.ledger.sha256, first.checkpoint.ledger.sha256);
  assert.deepStrictEqual(present.checkpoint.executor_observation, UNKNOWN_EXECUTOR);

  // reported dispatch에는 report 키가 없다.
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  ledger.tasks[0].dispatch.status = 'reported';
  ledger.tasks[0].dispatch.outcome = 'rework';
  ledger.tasks[0].dispatch.summary = 'retry';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.strictEqual('report' in statusOf().checkpoint.active_tasks[0], false);

  // attempt 2는 001-1.md만 있으면 absent
  const second = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(second.ok, true, JSON.stringify(second));
  assert.strictEqual(path.basename(second.report_path), '001-2.md');
  assert.deepStrictEqual(statusOf().checkpoint.active_tasks[0].report,
    { path: second.report_path, attempt: 2, state: 'absent' });
});

// --- coordinator 의존성 설치 stdio (CLI stdout 오염 방지) -----------------------
// advance는 자식 CLI stdout 전체를 JSON 한 개로 파싱하므로 npm 출력이 stdout으로 새면
// unclear-result가 반복된다. 네 호출 지점 모두 npm을 stderr로 보내는지 고정한다.

/**
 * npm 호출만 가로채 options를 기록하고 나머지는 실제 execFileSync로 넘기는 fake를 만든다.
 *
 * @returns {{ exec: Function, npmCalls: Array<{ options: object }> }} 주입용 exec와 기록
 */
function npmRecordingExec() {
  const npmCalls = [];
  return {
    npmCalls,
    exec(command, args, options) {
      if (command === 'npm') {
        npmCalls.push({ options });
        return Buffer.from('');
      }
      return execFileSync(command, args, options);
    },
  };
}

test('prepare seeding a worker with a lockfile → runs npm with stdio sent to stderr', () => {
  const blueprint = '.bouncer/context/epics/098-stdio/blueprints/001-worker';
  const repo = uncommittedPlanRepo('bouncer-install-stdio-worker-', blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: true\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  commitIntegrationPackageLock(boot.integrationPath);
  const rec = npmRecordingExec();
  const result = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { execFileSync: rec.exec },
  });
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  assert.ok(rec.npmCalls.length >= 1);
  for (const call of rec.npmCalls) assert.deepStrictEqual(call.options.stdio, ['ignore', 2, 2]);
});

test('verification integrate with a lockfile → runs npm with stdio sent to stderr', () => {
  const blueprint = '.bouncer/context/epics/098-stdio/blueprints/002-verify';
  const repo = uncommittedPlanRepo('bouncer-install-stdio-verify-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  // integration 작업 트리의 lockfile만 있으면 prepareDependencies가 npm ci를 탄다.
  fs.writeFileSync(path.join(boot.integrationPath, 'package-lock.json'), '{}\n');
  const rec = npmRecordingExec();
  const passed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      execFileSync: rec.exec,
      runVerification: () => ({ ok: true, command: 'node --test', exitCode: 0, evidenceId: 'ev-1' }),
    },
  });
  assert.strictEqual(passed.ok, true, JSON.stringify(passed));
  assert.strictEqual(rec.npmCalls.length, 1);
  assert.deepStrictEqual(rec.npmCalls[0].options.stdio, ['ignore', 2, 2]);
});

test('wave integrate seeding the fan-in candidate with a lockfile → runs npm with stdio sent to stderr', () => {
  const blueprint = '.bouncer/context/epics/098-stdio/blueprints/003-fanin';
  const drive = twoRecordedWave('bouncer-install-stdio-fanin-', blueprint);
  commitIntegrationPackageLock(drive.integrationPath);
  // lockfile 커밋으로 integration HEAD가 움직였으므로 원장 head를 맞춰 stale 판정을 피한다.
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  ledger.integrationHead = drive.head();
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const rec = npmRecordingExec();
  const out = coordinate({
    command: 'integrate', repoRoot: drive.repo, blueprint, cwd: drive.integrationPath,
    deps: { execFileSync: rec.exec, runVerification: passVerify },
  });
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  // fan-in candidate seed가 npm을 부른다(integration은 prepare 단계에서 이미 stamp가 있을 수 있다).
  assert.ok(rec.npmCalls.length >= 1, `npm count ${rec.npmCalls.length}`);
  for (const call of rec.npmCalls) assert.deepStrictEqual(call.options.stdio, ['ignore', 2, 2]);
});

test('supplement repair with a lockfile → runs npm with stdio sent to stderr', () => {
  const drive = supplementDrive('bouncer-install-stdio-supp-', '.bouncer/context/epics/098-stdio/blueprints/004-supp');
  assert.strictEqual(coordinate(supplementOpts(drive)).ok, true);
  fs.mkdirSync(path.join(drive.integrationPath, 'test'), { recursive: true });
  fs.writeFileSync(path.join(drive.integrationPath, 'test/a.test.js'), '// supplement\n');
  // lockfile은 보완 범위 밖 변경으로 잡히지 않도록 저장소 공용 exclude에 둔다.
  fs.appendFileSync(path.join(drive.repo, '.git/info/exclude'), 'package-lock.json\n');
  fs.writeFileSync(path.join(drive.integrationPath, 'package-lock.json'), '{}\n');
  const rec = npmRecordingExec();
  const out = coordinate(supplementOpts(drive, {
    done: true, reviewFindings: undefined, summary: 'tests added',
    deps: {
      execFileSync: rec.exec,
      runVerification: () => ({ ok: true, command: 'node --test', exitCode: 0, evidenceId: 'b'.repeat(64) }),
    },
  }));
  assert.strictEqual(out.ok, true, JSON.stringify(out));
  assert.strictEqual(rec.npmCalls.length, 1);
  assert.deepStrictEqual(rec.npmCalls[0].options.stdio, ['ignore', 2, 2]);
});

// ---- dispatch --model 기록과 worker-model 원장 기록 ----

const MODEL_BP = '.bouncer/context/epics/099-x/blueprints/005-y';

function workerModelCall(drive, extra) {
  return coordinate({
    command: 'worker-model', repoRoot: drive.repo, blueprint: drive.blueprint,
    cwd: drive.integrationPath, ...extra,
  });
}

test('dispatch with model claude-sonnet-5-5 → records it on task.dispatch and the dispatch decision', () => {
  const drive = preparedCommitDrive('bouncer-dispatch-model-', MODEL_BP);
  const r = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.worker,
    task: '001', model: 'claude-sonnet-5-5',
  });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.tasks[0].dispatch.model, 'claude-sonnet-5-5');
  const decision = ledger.decisions.filter((d) => d.kind === 'dispatch').pop();
  assert.strictEqual(decision.model, 'claude-sonnet-5-5');
  assert.deepStrictEqual(Object.keys(r.metadata).sort(), [
    'attempt', 'base_head', 'initial_worktree_state', 'task_brief_hash',
  ]);
});

test('dispatch without model → leaves no model key on task.dispatch or the dispatch decision', () => {
  const drive = preparedCommitDrive('bouncer-dispatch-nomodel-', MODEL_BP);
  const r = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.worker, task: '001',
  });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.ok(!('model' in ledger.tasks[0].dispatch));
  assert.ok(!('model' in ledger.decisions.filter((d) => d.kind === 'dispatch').pop()));
});

test('dispatch with an empty or valueless model → model-invalid without opening an attempt', () => {
  for (const model of ['', '  ', true]) {
    const drive = preparedCommitDrive('bouncer-dispatch-badmodel-', MODEL_BP);
    const before = fs.readFileSync(drive.ledgerFile);
    const r = coordinate({
      command: 'dispatch', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.worker,
      task: '001', model,
    });
    assert.strictEqual(r.ok, false, JSON.stringify(r));
    assert.strictEqual(r.reason, 'model-invalid');
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before);
    assert.strictEqual(JSON.parse(before).tasks[0].dispatch, undefined);
  }
});

test('worker-model reviewer/security on task 001 → appends the decision to ledger and task without touching dispatch, lease or status', () => {
  const drive = preparedCommitDrive('bouncer-worker-model-', MODEL_BP);
  const beforeTask = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8')).tasks[0];
  const r = workerModelCall(drive, { role: 'reviewer', model: 'inherit', task: '001', perspective: 'security' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const expected = {
    kind: 'worker-model', role: 'reviewer', model: 'inherit', task: '001', perspective: 'security',
  };
  assert.deepStrictEqual(r.decision, expected);
  assert.ok(r.checkpoint);
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.deepStrictEqual(ledger.decisions.pop(), expected);
  const task = ledger.tasks[0];
  assert.deepStrictEqual(task.decisions.pop(), expected);
  assert.deepStrictEqual(task.dispatch, beforeTask.dispatch);
  assert.deepStrictEqual(task.lease, beforeTask.lease);
  assert.strictEqual(task.status, beforeTask.status);
  assert.ok(r.checkpoint.unresolved_decisions.some((d) => d.kind === 'worker-model'));
});

test('worker-model debugger without task → records only on the ledger and stays out of unresolved_decisions', () => {
  const drive = preparedCommitDrive('bouncer-worker-model-notask-', MODEL_BP);
  const r = workerModelCall(drive, { role: 'debugger', model: 'claude-opus-4-7' });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(r.decision, { kind: 'worker-model', role: 'debugger', model: 'claude-opus-4-7' });
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.strictEqual(ledger.decisions.pop().kind, 'worker-model');
  assert.ok(!(ledger.tasks[0].decisions || []).some((d) => d.kind === 'worker-model'));
  assert.ok(!r.checkpoint.unresolved_decisions.some((d) => d.kind === 'worker-model'));
});

test('worker-model with a bad role, perspective, model or task → refuses with the matching reason and keeps the ledger bytes', () => {
  const cases = [
    [{ role: 'planner', model: 'inherit' }, 'worker-model-role-invalid'],
    [{ role: 'debugger', model: 'inherit', task: '001', perspective: 'security' }, 'worker-model-perspective-invalid'],
    [{ role: 'implementer', model: 'inherit', perspective: 'security' }, 'worker-model-perspective-invalid'],
    [{ role: 'implementer', model: 'inherit', tokens: -1 }, 'tokens-invalid'],
    [{ role: 'reviewer', model: 'inherit', tokens: 1.5 }, 'tokens-invalid'],
    [{ role: 'reviewer', model: 'inherit', tokens: 'abc' }, 'tokens-invalid'],
    [{ role: 'reviewer', model: 'inherit', perspective: 'bogus' }, 'worker-model-perspective-invalid'],
    [{ role: 'reviewer', model: '  ' }, 'model-invalid'],
    [{ role: 'reviewer', model: true }, 'model-invalid'],
    [{ role: 'reviewer', model: 'inherit', task: '009' }, 'task-outside-blueprint'],
  ];
  for (const [extra, reason] of cases) {
    const drive = preparedCommitDrive('bouncer-worker-model-bad-', MODEL_BP);
    const before = fs.readFileSync(drive.ledgerFile);
    const r = workerModelCall(drive, extra);
    assert.strictEqual(r.ok, false, JSON.stringify(r));
    assert.strictEqual(r.reason, reason);
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before, reason);
  }
});

test('worker-model implementer with tokens 48200 → records tokens on the decision; without tokens → no tokens key', () => {
  const drive = preparedCommitDrive('bouncer-worker-model-impl-', MODEL_BP);
  const r = workerModelCall(drive, { role: 'implementer', model: 'inherit', task: '001', tokens: 48200 });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.deepStrictEqual(r.decision, {
    kind: 'worker-model', role: 'implementer', model: 'inherit', task: '001', tokens: 48200,
  });
  const bare = workerModelCall(drive, { role: 'implementer', model: 'inherit' });
  assert.strictEqual(bare.ok, true, JSON.stringify(bare));
  assert.ok(!('tokens' in bare.decision));
});

function workerTokensCall(drive, extra) {
  return coordinate({
    command: 'worker-tokens', repoRoot: drive.repo, blueprint: drive.blueprint,
    cwd: drive.integrationPath, ...extra,
  });
}

test('worker-tokens reviewer/security on task 001 → appends the decision to ledger and task without touching dispatch, lease or status', () => {
  const drive = preparedCommitDrive('bouncer-worker-tokens-', MODEL_BP);
  const beforeTask = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8')).tasks[0];
  const r = workerTokensCall(drive, { role: 'reviewer', task: '001', perspective: 'security', tokens: 1200 });
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const expected = { kind: 'worker-tokens', role: 'reviewer', tokens: 1200, task: '001', perspective: 'security' };
  assert.deepStrictEqual(r.decision, expected);
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  assert.deepStrictEqual(ledger.decisions.pop(), expected);
  const task = ledger.tasks[0];
  assert.deepStrictEqual(task.decisions.pop(), expected);
  assert.deepStrictEqual(task.dispatch, beforeTask.dispatch);
  assert.deepStrictEqual(task.lease, beforeTask.lease);
  assert.strictEqual(task.status, beforeTask.status);
});

test('worker-tokens with a bad role, perspective, tokens or task → refuses with the matching reason and keeps the ledger bytes', () => {
  const cases = [
    [{ role: 'planner', tokens: 5 }, 'worker-model-role-invalid'],
    [{ role: 'debugger', tokens: 5, perspective: 'security' }, 'worker-model-perspective-invalid'],
    [{ role: 'reviewer', tokens: 5, perspective: 'bogus' }, 'worker-model-perspective-invalid'],
    [{ role: 'reviewer', tokens: -3 }, 'tokens-invalid'],
    [{ role: 'reviewer', tokens: 2.5 }, 'tokens-invalid'],
    [{ role: 'reviewer' }, 'tokens-invalid'],
    [{ role: 'reviewer', tokens: 5, task: '009' }, 'task-outside-blueprint'],
  ];
  for (const [extra, reason] of cases) {
    const drive = preparedCommitDrive('bouncer-worker-tokens-bad-', MODEL_BP);
    const before = fs.readFileSync(drive.ledgerFile);
    const r = workerTokensCall(drive, extra);
    assert.strictEqual(r.ok, false, JSON.stringify(r));
    assert.strictEqual(r.reason, reason);
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before, reason);
  }
});

test('worker-model-perspective-invalid hint → names every perspective the core accepts', () => {
  const accepted = ['combined', 'spec_scope', 'correctness_tests', 'minimality_maintainability', 'security'];
  for (const perspective of accepted) {
    const drive = preparedCommitDrive('bouncer-worker-model-persp-', MODEL_BP);
    const r = workerModelCall(drive, { role: 'reviewer', model: 'inherit', perspective });
    assert.strictEqual(r.ok, true, perspective);
  }
  const { next } = COORDINATE_FAILURE_HINTS['worker-model-perspective-invalid'];
  for (const perspective of accepted) assert.ok(next.includes(perspective), perspective);
});

test('worker-model on a promotion_stopped ledger → refuses with promotion-stopped and keeps the ledger bytes', () => {
  const drive = preparedCommitDrive('bouncer-worker-model-stopped-', MODEL_BP);
  const ledger = JSON.parse(fs.readFileSync(drive.ledgerFile, 'utf8'));
  ledger.status = 'promotion_stopped';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const before = fs.readFileSync(drive.ledgerFile);
  const r = workerModelCall(drive, { role: 'reviewer', model: 'inherit' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'promotion-stopped');
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before);
});

test('verification integrate when the runner rejects missing dependencies → records no failure and keeps evidence', () => {
  const blueprint = '.bouncer/context/epics/091-prepare/blueprints/003-precondition';
  const repo = uncommittedPlanRepo('bouncer-verify-precondition-', blueprint, [
    ['001', '  depends_on: []\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const evidenceDoc = path.join(boot.integrationPath, blueprint, 'tasks/002/verification.md');
  fs.mkdirSync(path.dirname(evidenceDoc), { recursive: true });
  fs.writeFileSync(evidenceDoc, 'passed evidence\n');
  const evidenceBefore = fs.readFileSync(evidenceDoc);

  assert.throws(() => coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '002',
    deps: {
      runVerification: () => {
        const error = new Error('direct dependencies are not installed');
        error.code = 'VERIFY_DEPENDENCIES_MISSING';
        throw error;
      },
    },
  }), { code: 'VERIFY_DEPENDENCIES_MISSING' });

  assert.ok(fs.readFileSync(evidenceDoc).equals(evidenceBefore));
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  assert.strictEqual(after.terminalFailure, undefined);
  assert.strictEqual((after.repairWaves || []).length, 0);
});

// ---------------------------------------------------------------------------
// 기존 task 재배정(--resume-task)과 범위 밖 실패 분류(--disposition outside_scope)
// ---------------------------------------------------------------------------

const RESUME_EVIDENCE = 'f'.repeat(64);

/**
 * 001이 integrate된 뒤 terminal 002의 CI가 실패한 drive를 만든다.
 * 001의 통합 내용(src/a.js)은 integration worktree에 실제 커밋으로 남겨, 재배정된
 * worker가 그 이력을 이어받는지 git으로 관찰할 수 있게 한다.
 *
 * @param {string} prefix - 임시 저장소 접두
 * @param {{ failure?: object }} [opts] - terminal 실패 결과 덮어쓰기(기본은 evidenceId 포함 exit 1)
 * @returns {object} repo·blueprint·integration·ledgerFile·integrationHead
 */
function terminalFailedDrive(prefix, opts = {}) {
  const blueprint = '.bouncer/context/epics/108-resume/blueprints/001-y';
  const repo = uncommittedPlanRepo(prefix, blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: false\n  dependency_gate: integrated\n  affected_paths:\n    - src/\n'],
    ['002', '  execution_kind: verification\n  depends_on: [TASKS-001]\n  parallel_safe: false\n'
      + '  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integration = boot.integrationPath;
  fs.mkdirSync(path.join(integration, 'src'), { recursive: true });
  fs.writeFileSync(path.join(integration, 'src/a.js'), 'integrated by 001\n');
  execFileSync('git', ['add', 'src/a.js'], { cwd: integration });
  execFileSync('git', ['commit', '-m', 'feat: integrated 001'], { cwd: integration });
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integration, encoding: 'utf8' }).trim();
  const ledgerFile = path.join(integration, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks[0].status = 'integrated';
  ledger.tasks[0].lease = { id: 'lease-a', generation: 1, seq: 1, status: 'active' };
  ledger.leaseSeq = 1;
  ledger.integrationHead = integrationHead;
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integration }).ok, true);
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integration, task: '002',
    deps: {
      runVerification: () => ({
        ok: false, command: 'node --test', exitCode: 1, evidenceId: RESUME_EVIDENCE, ...(opts.failure || {}),
      }),
    },
  });
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));
  return { repo, blueprint, integration, ledgerFile, integrationHead };
}

/**
 * 001→002→003→004 DAG에서 마지막 verification이 실패한 drive를 만든다.
 * 각 중간 task가 이미 통합되어 있어 resume이 전체 downstream을 다시 여는지 검증한다.
 *
 * @param {string} prefix - 임시 저장소 접두
 * @returns {object} terminalFailedDrive와 같은 fixture 정보
 */
function multiLevelTerminalFailedDrive(prefix) {
  const blueprint = '.bouncer/context/epics/108-resume/blueprints/001-multi';
  const repo = uncommittedPlanRepo(prefix, blueprint, [
    ['001', '  depends_on: []\n  parallel_safe: false\n  dependency_gate: integrated\n  affected_paths:\n    - src/\n'],
    ['002', '  depends_on: [TASKS-001]\n  parallel_safe: false\n  dependency_gate: integrated\n  affected_paths:\n    - src/\n'],
    ['003', '  depends_on: [TASKS-002]\n  parallel_safe: false\n  dependency_gate: integrated\n  affected_paths:\n    - src/\n'],
    ['004', '  execution_kind: verification\n  depends_on: [TASKS-003]\n  parallel_safe: false\n'
      + '  dependency_gate: integrated\n  verify: node --test\n'],
  ]);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integration = boot.integrationPath;
  const integrationHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: integration, encoding: 'utf8' }).trim();
  const ledgerFile = path.join(integration, '.bouncer/runtime/coordinator.json');
  const ledger = readLedgerFile(ledgerFile);
  for (const [index, item] of ledger.tasks.entries()) {
    if (item.execution_kind === 'verification') continue;
    item.status = 'integrated';
    item.sha = integrationHead;
    item.lease = { id: `lease-${item.id}`, generation: 1, seq: index + 1, status: 'active' };
  }
  ledger.leaseSeq = 3;
  ledger.integrationHead = integrationHead;
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integration }).ok, true);
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integration, task: '004',
    deps: { runVerification: () => ({ ok: false, command: 'node --test', exitCode: 1, evidenceId: RESUME_EVIDENCE }) },
  });
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));
  return { repo, blueprint, integration, ledgerFile, integrationHead };
}

const readLedgerFile = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('resume owner in a multi-level DAG → keeps integrated downstream commit tasks and reopens only the verification', () => {
  const drive = multiLevelTerminalFailedDrive('bouncer-resume-multi-level-');
  const resumed = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '004',
    resumeTask: '001', failureCommand: 'node --test', summary: 'src/a.js regression',
    paths: ['src/a.js'], decision: 'the failing test is owned by task 001',
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  const after = readLedgerFile(drive.ledgerFile);
  // 하위 commit task(002, 003)는 integrated와 sha를 유지하고 terminal verification(004)만 다시 열린다.
  assert.deepStrictEqual(after.tasks.map((item) => item.status), ['pending', 'integrated', 'integrated', 'pending']);
  assert.deepStrictEqual(resumed.reset_downstream, ['004']);
  assert.deepStrictEqual(after.tasks.slice(1, 3).map((item) => item.depends_on), [['001'], ['002']]);
  const prepared = coordinate({ command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
});

test('terminal failure with --resume-task of an integrated task → reassigns it without adding a task or changing scope and DAG', () => {
  const drive = terminalFailedDrive('bouncer-resume-task-');
  const before = readLedgerFile(drive.ledgerFile);
  const resumed = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'src/a.js regression',
    paths: ['src/a.js'], decision: 'the failing test is owned by task 001',
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  const after = readLedgerFile(drive.ledgerFile);
  assert.deepStrictEqual(after.tasks.map((t) => t.id), ['001', '002']);
  assert.deepStrictEqual(after.tasks.map((t) => t.depends_on), before.tasks.map((t) => t.depends_on));
  assert.deepStrictEqual(after.tasks[0].affected_paths, before.tasks[0].affected_paths);
  assert.strictEqual(after.tasks[0].dynamic, undefined);
  assert.strictEqual(after.tasks[0].status, 'pending');
  assert.strictEqual(after.tasks[0].sha, undefined);
  assert.strictEqual(after.tasks[0].lease.status, 'revoked');
  assert.strictEqual(after.tasks[1].status, 'pending');
  assert.strictEqual(after.repairWaves.length, 1);
  assert.strictEqual(after.repairWaves[0].task, '001');
  assert.deepStrictEqual(after.repairWaves[0].nextScope, ['src/a.js']);
  assert.strictEqual(after.terminalFailure.task, '002');
  assert.strictEqual(fs.existsSync(path.join(drive.integration, drive.blueprint, 'tasks/003')), false);
});

test('resumed task is prepared → new lease generation on a worker cut from the current integration HEAD, terminal waits, old lease is stale', () => {
  const drive = terminalFailedDrive('bouncer-resume-prepare-');
  const resumed = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'src/a.js regression',
    paths: ['src/a.js'], decision: 'the failing test is owned by task 001',
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  const prepared = coordinate({
    command: 'prepare', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration,
    deps: { makeLeaseId: () => 'lease-b' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  // terminal은 재작업이 끝나기 전에 열리지 않는다 — 001만 배정된다.
  assert.deepStrictEqual(prepared.ready, ['001']);
  const task = prepared.tasks.find((t) => t.id === '001');
  assert.deepStrictEqual(task.lease, { id: 'lease-b', generation: 2, seq: 2, status: 'active' });
  assert.strictEqual(prepared.tasks.find((t) => t.id === '002').status, 'pending');
  const workerHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: task.workerPath, encoding: 'utf8' }).trim();
  assert.strictEqual(workerHead, drive.integrationHead);
  assert.strictEqual(fs.readFileSync(path.join(task.workerPath, 'src/a.js'), 'utf8'), 'integrated by 001\n');

  const late = coordinate({
    command: 'dispatch', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: task.workerPath, task: '001',
    leaseId: 'lease-a', generation: 1,
  });
  assert.strictEqual(late.reason, 'stale-lease');
});

test('--resume-task with an unsafe selection → rejects before any mutation and keeps the failure state', () => {
  const drive = terminalFailedDrive('bouncer-resume-reject-');
  const base = {
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    failureCommand: 'node --test', summary: 'regression', paths: ['src/a.js'], decision: 'owned by 001',
  };
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  const cases = [
    ['path outside the approved scope of the chosen task', { resumeTask: '001', paths: ['lib/other.js'] }, 'repair-scope-out-of-bounds'],
    ['task id that is not in this blueprint', { resumeTask: '009' }, 'task-outside-blueprint'],
    ['terminal task as its own resume target', { resumeTask: '002' }, 'resume-task-invalid'],
    ['malformed task id', { resumeTask: '1' }, 'resume-task-invalid'],
    ['failure command that differs from the recorded failure', { resumeTask: '001', failureCommand: 'node --test other' }, 'failure-evidence-mismatch'],
    ['both resume-task and disposition', { resumeTask: '001', disposition: 'outside_scope' }, 'repair-resolution-ambiguous'],
    ['missing decision reason', { resumeTask: '001', decision: '' }, 'decision-reason-required'],
  ];
  for (const [label, override, reason] of cases) {
    const rejected = coordinate({ ...base, ...override });
    assert.strictEqual(rejected.reason, reason, label);
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), ledgerBefore, label);
  }
});

test('--resume-task of a task that is not integrated yet → rejects as resume-task-invalid', () => {
  const drive = terminalFailedDrive('bouncer-resume-open-');
  const ledger = readLedgerFile(drive.ledgerFile);
  ledger.tasks[0].status = 'prepared';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const rejected = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'regression', paths: ['src/a.js'], decision: 'owned by 001',
  });
  assert.strictEqual(rejected.reason, 'resume-task-invalid');
});

test('resume ledger write fails → task documents and ledger keep their previous bytes', () => {
  const drive = terminalFailedDrive('bouncer-resume-rollback-');
  const taskDoc = path.join(drive.integration, drive.blueprint, 'tasks/001/tasks.md');
  const terminalDoc = path.join(drive.integration, drive.blueprint, 'tasks/002/tasks.md');
  const docsBefore = [fs.readFileSync(taskDoc), fs.readFileSync(terminalDoc)];
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  assert.throws(() => coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'regression', paths: ['src/a.js'],
    decision: 'owned by 001', deps: { writeLedger: () => { throw new Error('ledger write failed'); } },
  }), /ledger write failed/);
  assert.deepStrictEqual(fs.readFileSync(taskDoc), docsBefore[0]);
  assert.deepStrictEqual(fs.readFileSync(terminalDoc), docsBefore[1]);
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), ledgerBefore);
});

test('resume with a stale owner lease → rejects without changing ledger or task documents', () => {
  const drive = terminalFailedDrive('bouncer-resume-stale-lease-');
  const taskDoc = path.join(drive.integration, drive.blueprint, 'tasks/001/tasks.md');
  const terminalDoc = path.join(drive.integration, drive.blueprint, 'tasks/002/tasks.md');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  const docsBefore = [fs.readFileSync(taskDoc), fs.readFileSync(terminalDoc)];
  const rejected = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'regression', paths: ['src/a.js'],
    decision: 'owned by 001', leaseId: 'stale-owner-lease', generation: 1,
  });
  assert.strictEqual(rejected.reason, 'stale-lease');
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), ledgerBefore);
  assert.deepStrictEqual(fs.readFileSync(taskDoc), docsBefore[0]);
  assert.deepStrictEqual(fs.readFileSync(terminalDoc), docsBefore[1]);
});

test('resume with a stale ledger fence → rejects without changing ledger or task documents', () => {
  const drive = terminalFailedDrive('bouncer-resume-stale-fence-');
  const taskDoc = path.join(drive.integration, drive.blueprint, 'tasks/001/tasks.md');
  const terminalDoc = path.join(drive.integration, drive.blueprint, 'tasks/002/tasks.md');
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  const docsBefore = [fs.readFileSync(taskDoc), fs.readFileSync(terminalDoc)];
  const rejected = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'regression', paths: ['src/a.js'],
    decision: 'owned by 001', ledgerPath: '.bouncer/runtime/coordinator.json', ledgerHash: '0'.repeat(64),
  });
  assert.strictEqual(rejected.reason, 'stale-ledger-checkpoint');
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), ledgerBefore);
  assert.deepStrictEqual(fs.readFileSync(taskDoc), docsBefore[0]);
  assert.deepStrictEqual(fs.readFileSync(terminalDoc), docsBefore[1]);
});

test('resume salvage failure → preserves ledger, worktree, and task documents', () => {
  const drive = terminalFailedDrive('bouncer-resume-salvage-failure-');
  const worker = path.join(drive.repo, 'workers/resume-001');
  execFileSync('git', ['worktree', 'add', '--detach', worker, 'HEAD'], { cwd: drive.integration, stdio: 'ignore' });
  fs.writeFileSync(path.join(worker, 'src/a.js'), 'uncommitted owner change\n');
  const ledger = readLedgerFile(drive.ledgerFile);
  ledger.tasks[0].workerPath = worker;
  ledger.tasks[0].branch = 'resume-owner';
  fs.writeFileSync(drive.ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  const ledgerBefore = fs.readFileSync(drive.ledgerFile);
  const taskDoc = path.join(drive.integration, drive.blueprint, 'tasks/001/tasks.md');
  const terminalDoc = path.join(drive.integration, drive.blueprint, 'tasks/002/tasks.md');
  const docsBefore = [fs.readFileSync(taskDoc), fs.readFileSync(terminalDoc)];
  const workerBefore = execFileSync('git', ['status', '--porcelain'], { cwd: worker, encoding: 'utf8' });
  const realExec = execFileSync;
  const failedExec = (file, args, options) => {
    if (file === 'git' && args.includes('--porcelain') && options?.cwd === worker) {
      const error = new Error('salvage status failed');
      error.code = 'EIO';
      throw error;
    }
    return realExec(file, args, options);
  };
  const rejected = coordinate({
    command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
    resumeTask: '001', failureCommand: 'node --test', summary: 'regression', paths: ['src/a.js'],
    decision: 'owned by 001', deps: { execFileSync: failedExec },
  });
  assert.strictEqual(rejected.reason, 'worker-salvage-failed');
  assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), ledgerBefore);
  assert.deepStrictEqual(fs.readFileSync(taskDoc), docsBefore[0]);
  assert.deepStrictEqual(fs.readFileSync(terminalDoc), docsBefore[1]);
  assert.strictEqual(execFileSync('git', ['status', '--porcelain'], { cwd: worker, encoding: 'utf8' }), workerBefore);
  assert.ok(execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: drive.integration, encoding: 'utf8' }).includes(worker));
});

test('terminal failure records its evidence and source identity → disposition can bind to them', () => {
  const drive = terminalFailedDrive('bouncer-failure-identity-');
  const failure = readLedgerFile(drive.ledgerFile).terminalFailure;
  assert.strictEqual(failure.evidence_id, RESUME_EVIDENCE);
  assert.strictEqual(failure.source_digest, drive.integrationHead);
});

const outsideInput = (drive, override = {}) => ({
  command: 'repair', repoRoot: drive.repo, blueprint: drive.blueprint, cwd: drive.integration, task: '002',
  disposition: 'outside_scope', failureCommand: 'node --test',
  summary: 'cause: vendored lockfile drift; failing test: test/vendor.test.js; fix needs vendor/ outside every task scope',
  paths: ['vendor/lock.json'], decision: 'the cause and required change are outside every approved task scope',
  ...override,
});

test('--disposition outside_scope with the original evidence and an unowned path → records it and keeps failure and verifying', () => {
  const drive = terminalFailedDrive('bouncer-outside-ok-');
  const result = coordinate(outsideInput(drive));
  assert.strictEqual(result.ok, true, JSON.stringify(result));
  const after = readLedgerFile(drive.ledgerFile);
  assert.strictEqual(after.tasks[1].status, 'verifying');
  assert.strictEqual(after.tasks.length, 2);
  assert.strictEqual((after.repairWaves || []).length, 0);
  assert.strictEqual(after.terminalFailure.exitCode, 1);
  assert.strictEqual(after.terminalFailure.command, 'node --test');
  assert.deepStrictEqual(after.terminalFailure.disposition, {
    kind: 'outside_scope',
    reason: 'the cause and required change are outside every approved task scope',
    evidence_id: RESUME_EVIDENCE,
    source_digest: drive.integrationHead,
    paths: ['vendor/lock.json'],
  });
});

test('--disposition outside_scope with weak or mismatched grounds → rejects and leaves the ledger untouched', () => {
  const noEvidence = terminalFailedDrive('bouncer-outside-noev-', { failure: { evidenceId: undefined } });
  const moved = terminalFailedDrive('bouncer-outside-moved-');
  const movedLedger = readLedgerFile(moved.ledgerFile);
  movedLedger.integrationHead = 'a'.repeat(40);
  fs.writeFileSync(moved.ledgerFile, `${JSON.stringify(movedLedger, null, 2)}\n`);
  const plain = terminalFailedDrive('bouncer-outside-bad-');
  const cases = [
    ['failure without evidence id', noEvidence, {}, 'disposition-evidence-required'],
    ['source changed since the failure', moved, {}, 'disposition-stale-source'],
    ['path owned by a task scope (mixed)', plain, { paths: ['vendor/lock.json', 'src/a.js'] }, 'disposition-scope-mixed'],
    ['different failure command', plain, { failureCommand: 'node --test other' }, 'failure-evidence-mismatch'],
    ['missing cause summary', plain, { summary: '' }, 'failure-evidence-required'],
    ['missing decision reason', plain, { decision: '  ' }, 'decision-reason-required'],
    ['non-source path', plain, { paths: ['.bouncer/context/'] }, 'repair-scope-out-of-bounds'],
    ['unknown disposition kind', plain, { disposition: 'flaky' }, 'disposition-invalid'],
    ['non-terminal task', plain, { task: '001' }, 'terminal-failure-required'],
  ];
  for (const [label, drive, override, reason] of cases) {
    const before = fs.readFileSync(drive.ledgerFile);
    const rejected = coordinate(outsideInput(drive, override));
    assert.strictEqual(rejected.reason, reason, label);
    assert.deepStrictEqual(fs.readFileSync(drive.ledgerFile), before, label);
  }
});
