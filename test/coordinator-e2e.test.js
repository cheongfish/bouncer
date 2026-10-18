// test/coordinator-e2e.test.js
// coordinator의 수명주기를 실제 Git 저장소에서 끝까지 돌린다. 단위 테스트가
// 거절 경계를 보는 것과 달리 여기서는 worker worktree 커밋, integration
// worktree fan-in, 그리고 main worktree가 read-only provenance로 남는지를
// 한 번의 drive로 확인한다. 네트워크·PR 생성·외부 credential은 쓰지 않는다.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const __coordinatorMod = require('../scripts/lib/coordinator');
const { loadLedger, COORDINATE_FAILURE_HINTS } = __coordinatorMod;
const { coordinatorPathsFor: __coordinatorPathsFor } = require('../scripts/lib/runtime-state');
const __crypto = require('node:crypto');
const __LEDGER_REL = '.bouncer/runtime/coordinator.json';
const __FENCED = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke',
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

const { readDoc } = require('../scripts/lib/frontmatter');
const { renderDoc } = require('../scripts/lib/render');
const { validateBlueprint } = require('../scripts/lib/validate');
const { finalize } = require('../scripts/lib/finalize');
const { readCoordinatorLedger, reviseTaskScope } = require('../scripts/lib/scope');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');
const { writeCurrent, resolveEffectiveTask } = require('../scripts/lib/current');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * DAG frontmatter를 넣거나 통째로 빼고 task 문서를 만든다. `dag`가 null이면
 * 세 필드를 아예 쓰지 않아, 이 기능 이전에 계획된 문서를 그대로 재현한다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} id - 세 자리 task id
 * @param {object|null} dag - depends_on/parallel_safe/dependency_gate/
 *   affected_paths/exclusive_resources 또는 null
 */
function writeTask(repo, blueprint, id, dag) {
  const dir = path.join(repo, blueprint, 'tasks', id);
  fs.mkdirSync(dir, { recursive: true });
  const fields = dag === null ? '' : [
    `  depends_on: ${JSON.stringify(dag.depends_on || [])}`,
    `  parallel_safe: ${dag.parallel_safe === true}`,
    `  dependency_gate: ${dag.dependency_gate || 'integrated'}`,
    // 경로·자원은 병렬 wave 한도 회귀용 — 없으면 원장이 []로 읽는다.
    ...(Array.isArray(dag.affected_paths)
      ? [`  affected_paths: ${JSON.stringify(dag.affected_paths)}`] : []),
    ...(Array.isArray(dag.exclusive_resources)
      ? [`  exclusive_resources: ${JSON.stringify(dag.exclusive_resources)}`] : []),
    '',
  ].join('\n');
  fs.writeFileSync(
    path.join(dir, 'tasks.md'),
    `---\nbouncer:\n  id: TASKS-${id}\n${fields}---\n# Tasks\n\nbrief ${id}\n`,
  );
}

/**
 * integration worktree의 `.bouncer/config.json`에 coordinator 정책을 쓴다.
 * prepare가 읽는 한도는 이 경로다.
 *
 * @param {string} repoRoot - config를 쓸 루트(대개 integrationPath)
 * @param {object} coordinator - coordinator 블록(예: `{ max_parallel: 1 }`)
 */
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
 * 커밋된 fixture 저장소를 만든다. user.name/user.email은 common directory의
 * config에 들어가므로 뒤에 붙는 linked worktree도 같은 설정으로 커밋한다.
 *
 * @param {Record<string, string>} sources - 상대 경로 → 본문
 * @returns {string} 저장소 루트 실제 경로
 */
function makeRepo(sources) {
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-coordinator-e2e-')));
  git(repo, ['init', '--quiet', '-b', 'work']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'test']);
  for (const [rel, body] of Object.entries(sources)) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return repo;
}

/**
 * main worktree의 tracked source를 바이트 단위로 고정한다. index 목록만 비교하면
 * 작업 트리를 덮어쓴 변경이 드러나지 않으므로 파일 바이트를 직접 해시한다.
 *
 * @param {string} repo - 저장소 루트
 * @returns {Record<string, string>} 경로 → 내용 sha256
 */
function trackedSourceSnapshot(repo) {
  const snapshot = {};
  for (const rel of git(repo, ['ls-files']).split('\n').filter(Boolean)) {
    snapshot[rel] = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(repo, rel))).digest('hex');
  }
  return snapshot;
}

/**
 * `.worktrees/` 등록만 남은 상태를 깨끗한 것으로 본다 — coordinator가 등록하는
 * checkout은 source 변경이 아니고, fixture에는 프로젝트 .gitignore가 없다.
 *
 * @param {string} repo - 저장소 루트
 * @returns {string} worktree 등록 줄을 뺀 porcelain 출력
 */
function sourceStatus(repo) {
  return git(repo, ['status', '--porcelain']).split('\n')
    .filter((line) => line && !line.slice(3).startsWith('.worktrees/')).join('\n');
}

function commitInWorker(worker, rel, body, message) {
  fs.writeFileSync(path.join(worker, rel), body);
  git(worker, ['add', rel]);
  git(worker, ['commit', '-m', message]);
  return git(worker, ['rev-parse', 'HEAD']);
}

/**
 * worker의 task bundle을 execute·commit이 끝난 terminal 증적으로 쓴다. 실제
 * 흐름에서는 execute gate와 `bouncer commit`이 쓰는 값이다 — tasks `verified`와
 * 8자리 `commit_sha`, verification `passed`, review `accepted`. 이미 있는 문서는
 * frontmatter와 본문을 보존하고 상태만 바꾼다.
 *
 * @param {string} worker - worker worktree 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} id - 세 자리 task id
 * @param {string | null} sha - worker 커밋 전체 SHA. null이면 stamp를 쓰지 않는다
 */
function writeTerminalEvidence(worker, blueprint, id, sha) {
  const dir = path.join(worker, blueprint, 'tasks', id);
  for (const [name, prefix, status] of [
    ['tasks.md', 'TASKS', 'verified'], ['verification.md', 'VERIFY', 'passed'], ['review.md', 'REVIEW', 'accepted'],
  ]) {
    const file = path.join(dir, name);
    const doc = fs.existsSync(file)
      ? readDoc(file)
      : { data: { bouncer: { id: `${prefix}-${id}` } }, body: `# ${prefix}\n` };
    doc.data.bouncer.status = status;
    // sha가 null이면 stamp 없는 "커밋 전" 상태를 만든다(`bouncer commit`이 나중에 찍는다).
    if (name === 'tasks.md' && sha) doc.data.bouncer.commit_sha = sha.slice(0, 8);
    fs.writeFileSync(file, renderDoc(doc.data, doc.body));
  }
}


/**
 * `coordinate report`가 읽는 worker 보고 파일을 쓴다. full 모드 report 호출 전에 필요하다.
 * `revision`·`open`·`weak`로 줄이나 섹션을 바꾸거나 null로 빼서 거절 경로를 만든다.
 */
function writeWorkerReport(worker, task, attempt, hash, {
  revision = `attempt: ${attempt}\ntask_brief_hash: ${hash}`,
  open = '- none', weak = '- none', tests = null,
} = {}) {
  const dir = path.join(worker, '.bouncer', 'runtime', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const parts = ['## Changed files\n- `src/a.js` — fixture', `## Brief revision\n${revision}`];
  // scoped_terminal fan-in은 지정 명령·결과가 적힌 Tests 절을 요구한다. null이면 절 자체를 뺀다.
  if (tests !== null) parts.push(`## Tests\n${tests}`);
  if (open !== null) parts.push(`## Open choices\n${open}`);
  if (weak !== null) parts.push(`## Known weaknesses\n${weak}`);
  fs.writeFileSync(path.join(dir, `${task}-${attempt}.md`), `${parts.join('\n\n')}\n`);
}

/**
 * dispatch → accepted report → record. TASKS-001 이후 record는 활성 attempt의
 * accepted 보고와 brief hash 일치가 있어야만 worker HEAD를 올린다.
 */
function acceptDispatchAndRecord(repo, blueprint, worker, task, reportOptions = {}) {
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task,
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  writeWorkerReport(
    worker, task, dispatched.metadata.attempt, dispatched.metadata.task_brief_hash, reportOptions,
  );
  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task,
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: `accepted ${task}`,
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  return coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task });
}

test('parallel ready wave를 drive함 → worker worktrees에 commit하고 하나의 integration branch로 fan-in함', () => {
  const blueprint = '.bouncer/context/epics/010-parallel/blueprints/001-drive';
  const repo = makeRepo({
    'README.md': 'fixture\n',
    'src/alpha.js': 'alpha base\n',
    'src/beta.js': 'beta base\n',
  });
  writeTask(repo, blueprint, '001', { depends_on: [], parallel_safe: true });
  writeTask(repo, blueprint, '002', { depends_on: [], parallel_safe: true });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const before = trackedSourceSnapshot(repo);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.integrationBranch, 'feat/010-001-drive');
  // 두 task 모두 parallel_safe라 하나의 ready wave로 열린다.
  assert.deepStrictEqual(boot.ready, ['001', '002']);

  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks.map((task) => [task.id, task.workerPath]));
  assert.notStrictEqual(workers['001'], workers['002']);
  for (const id of ['001', '002']) {
    // 각 worker는 자기 brief를 받고, 그 brief는 base 계획에서 사라지지 않는다.
    assert.match(
      fs.readFileSync(path.join(workers[id], blueprint, 'tasks', id, 'tasks.md'), 'utf8'),
      new RegExp(`brief ${id}`),
    );
  }

  const edits = { '001': 'src/alpha.js', '002': 'src/beta.js' };
  const shas = {};
  for (const id of ['001', '002']) {
    shas[id] = commitInWorker(workers[id], edits[id], `changed by ${id}\n`, `feat: task ${id}`);
    writeTerminalEvidence(workers[id], blueprint, id, shas[id]);
    const recorded = acceptDispatchAndRecord(repo, blueprint, workers[id], id);
    assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
    assert.strictEqual(recorded.task.sha, shas[id]);
  }

  for (const id of ['001', '002']) {
    const integrated = coordinate({
      command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: id,
      deps: {
        runVerification: () => ({
          ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
        }),
      },
    });
    // 첫 wave의 evidence가 dirty로 남은 두 번째 wave도 허용 경로라 거절되지 않는다.
    assert.notStrictEqual(integrated.reason, 'integration-source-mutated', JSON.stringify(integrated));
    assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
    assert.deepStrictEqual(integrated.integrated, [id]);
  }

  // 두 worker의 결과가 하나의 integration branch로 모인다.
  assert.strictEqual(
    git(boot.integrationPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
    'feat/010-001-drive',
  );
  assert.deepStrictEqual(
    git(boot.integrationPath, ['log', '--format=%s', '-3']).split('\n'),
    ['feat: task 002', 'feat: task 001', 'plan'],
  );
  assert.strictEqual(fs.readFileSync(path.join(boot.integrationPath, 'src/alpha.js'), 'utf8'), 'changed by 001\n');
  assert.strictEqual(fs.readFileSync(path.join(boot.integrationPath, 'src/beta.js'), 'utf8'), 'changed by 002\n');

  const status = coordinate({
    command: 'status', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.deepStrictEqual(status.checkpoint.ready, []);
  assert.deepStrictEqual(
    status.checkpoint.completed_tasks.map((task) => task.status),
    ['integrated', 'integrated'],
  );

  // main worktree는 provenance를 읽히는 자리일 뿐이다: 시작과 끝의 tracked
  // source가 바이트 단위로 같고, 브랜치도 옮겨가지 않는다.
  assert.deepStrictEqual(trackedSourceSnapshot(repo), before);
  assert.strictEqual(sourceStatus(repo), '');
  assert.strictEqual(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']), 'work');
});

test('worker commits를 cherry-pick함 → provenance trailers가 안정적으로 유지됨', () => {
  const blueprint = '.bouncer/context/epics/010-parallel/blueprints/001-drive';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  writeTask(repo, blueprint, '001', { depends_on: [], parallel_safe: true });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const message = [
    'feat: task 001',
    '',
    'Bouncer-Task: EPIC-010/BP-001/TASK-001',
    'Bouncer-Intent: EPIC-010/BP-001',
  ].join('\n');
  const workerSha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', message);
  writeTerminalEvidence(worker, blueprint, '001', workerSha);
  assert.strictEqual(
    acceptDispatchAndRecord(repo, blueprint, worker, '001').ok,
    true,
  );
  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  const body = git(boot.integrationPath, ['log', '--format=%B', '-1']);
  assert.match(body, /^Bouncer-Task: EPIC-010\/BP-001\/TASK-001$/m);
  assert.match(body, /^Bouncer-Intent: EPIC-010\/BP-001$/m);
  assert.strictEqual((body.match(/^Bouncer-Task:/gm) || []).length, 1);
  assert.strictEqual((body.match(/^Bouncer-Intent:/gm) || []).length, 1);
  // worker 출처 trailer는 ledger에 기록된 worker 전체 SHA와 같고 한 줄만 있어야 한다.
  const ledger = JSON.parse(fs.readFileSync(
    path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'), 'utf8',
  ));
  const recorded = ledger.tasks.find((t) => t.id === '001').sha;
  assert.strictEqual(recorded, workerSha);
  const workerTrailer = body.match(/^Bouncer-Worker-Commit: ([0-9a-f]{40})$/m);
  assert.notStrictEqual(workerTrailer, null);
  assert.strictEqual(workerTrailer[1], recorded);
  assert.strictEqual((body.match(/^Bouncer-Worker-Commit:/gm) || []).length, 1);
});

/**
 * 한 blueprint에 task 001(+선택 002)을 준비하고 worker 경로를 돌려준다.
 */
function prepareFanin(blueprint, ids, sources) {
  const repo = makeRepo({ 'README.md': 'fixture\n', ...sources });
  for (const id of ids) writeTask(repo, blueprint, id, { depends_on: [], parallel_safe: true });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks.map((task) => [task.id, task.workerPath]));
  return { repo, boot, workers };
}

const passVerification = () => ({
  ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
});

test('worker에 커밋 2개가 쌓임 → fan-in이 두 변경을 통합 커밋 1개와 trailer 1줄로 반영함', () => {
  const blueprint = '.bouncer/context/epics/103-range/blueprints/001-drive';
  const { repo, boot, workers } = prepareFanin(blueprint, ['001'], {});
  const integration = boot.integrationPath;
  const base = git(integration, ['rev-parse', 'HEAD']);
  const worker = workers['001'];
  commitInWorker(worker, 'a.txt', 'a\n', 'feat: attempt 1');
  const recordedSha = commitInWorker(worker, 'b.txt', 'b\n', [
    'feat: attempt 2', '', 'Bouncer-Task: EPIC-103/BP-001/TASK-001', 'Bouncer-Intent: EPIC-103/BP-001',
  ].join('\n'));
  writeTerminalEvidence(worker, blueprint, '001', recordedSha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, worker, '001').ok, true);

  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integration, task: '001',
    deps: { runVerification: passVerification },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));

  assert.ok(fs.existsSync(path.join(integration, 'a.txt')));
  assert.ok(fs.existsSync(path.join(integration, 'b.txt')));
  assert.strictEqual(git(integration, ['rev-list', '--count', `${base}..HEAD`]), '1');
  const body = git(integration, ['log', '--format=%B', '-1']);
  assert.deepStrictEqual(body.match(/^Bouncer-Worker-Commit: .*$/gm), [`Bouncer-Worker-Commit: ${recordedSha}`]);
  assert.strictEqual((body.match(/^Bouncer-Task:/gm) || []).length, 1);
  assert.strictEqual(git(integration, ['log', '--format=%s', '-1']), 'feat: attempt 2');
});

test('범위 첫 커밋이 통합 HEAD와 충돌함 → fanin-conflict로 그 task만 revoke하고 HEAD를 보존함', () => {
  const blueprint = '.bouncer/context/epics/103-range/blueprints/002-conflict';
  const { repo, boot, workers } = prepareFanin(blueprint, ['001', '002'], { 'shared.txt': 'base\n' });
  const integration = boot.integrationPath;
  const sha1 = commitInWorker(workers['001'], 'shared.txt', 'from 001\n', 'feat: task 001');
  writeTerminalEvidence(workers['001'], blueprint, '001', sha1);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, workers['001'], '001').ok, true);
  // 002의 범위 첫 커밋(shared.txt)이 001 통합 결과와 충돌하고, 둘째 커밋은 충돌하지 않는다.
  commitInWorker(workers['002'], 'shared.txt', 'from 002\n', 'feat: attempt 1');
  const sha2 = commitInWorker(workers['002'], 'c.txt', 'c\n', 'feat: attempt 2');
  writeTerminalEvidence(workers['002'], blueprint, '002', sha2);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, workers['002'], '002').ok, true);
  const before = git(integration, ['rev-parse', 'HEAD']);

  const result = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integration,
    deps: { runVerification: passVerification },
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'fanin-conflict', JSON.stringify(result));
  assert.strictEqual(result.task, '002');
  assert.strictEqual(git(integration, ['rev-parse', 'HEAD']), before);
  const tasks = loadLedger(path.join(integration, '.bouncer/runtime/coordinator.json')).tasks;
  assert.strictEqual(tasks.find((t) => t.id === '002').status, 'pending');
  assert.strictEqual(tasks.find((t) => t.id === '001').status, 'recorded');
});

test('fan-in이 거절됨 → ledger를 보존하고 중복 cherry-pick 없이 재개함', () => {
  const blueprint = '.bouncer/context/epics/011-resume/blueprints/002-drive';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  writeTask(repo, blueprint, '001', { depends_on: [], parallel_safe: true });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const before = trackedSourceSnapshot(repo);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const workerSha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', workerSha);
  assert.strictEqual(
    acceptDispatchAndRecord(repo, blueprint, worker, '001').ok,
    true,
  );
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const knownHead = loadLedger(ledgerFile).integrationHead;

  // integration worktree가 원장이 모르는 커밋을 얻으면 fan-in은 거절이다.
  fs.writeFileSync(path.join(boot.integrationPath, 'README.md'), 'out of band\n');
  git(boot.integrationPath, ['commit', '-am', 'out of band']);
  const rejected = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.deepStrictEqual(rejected, {
    ok: false, reason: 'stale-integration-head',
    cause: COORDINATE_FAILURE_HINTS['stale-integration-head'].cause,
    next: COORDINATE_FAILURE_HINTS['stale-integration-head'].next,
  });

  // 거절이 원장을 갈아엎지 않아야 재개 지점이 남는다.
  const preserved = loadLedger(ledgerFile);
  assert.strictEqual(preserved.tasks[0].status, 'recorded');
  assert.strictEqual(preserved.tasks[0].sha, workerSha);
  assert.strictEqual(preserved.integrationHead, knownHead);

  // 재개: integration을 원장이 아는 head로 되돌리면 같은 명령이 그대로 통과한다.
  git(boot.integrationPath, ['reset', '--hard', knownHead]);
  const resumed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));

  // 중복 cherry-pick 방지: 이미 integrated인 task는 다시 fan-in되지 않는다.
  const again = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.deepStrictEqual(again, {
    ok: false, reason: 'nothing-to-integrate',
    cause: COORDINATE_FAILURE_HINTS['nothing-to-integrate'].cause,
    next: COORDINATE_FAILURE_HINTS['nothing-to-integrate'].next,
  });
  const subjects = git(boot.integrationPath, ['log', '--format=%s']).split('\n');
  assert.strictEqual(subjects.filter((subject) => subject === 'feat: task 001').length, 1);

  assert.deepStrictEqual(trackedSourceSnapshot(repo), before);
  assert.strictEqual(sourceStatus(repo), '');
});

test('DAG frontmatter 없는 단일 task → 하나의 sequential wave로 drive됨', () => {
  const blueprint = '.bouncer/context/epics/012-legacy/blueprints/003-drive';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  // depends_on·parallel_safe·dependency_gate가 아예 없는 기존 계획 문서.
  writeTask(repo, blueprint, '001', null);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const before = trackedSourceSnapshot(repo);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.deepStrictEqual(boot.ready, ['001']);
  // 필드 부재는 의존 없음·순차·integrated·빈 경로/자원으로 읽힌다 — 소급 migration이 없다.
  assert.deepStrictEqual(boot.tasks, [{
    id: '001', depends_on: [], execution_kind: 'commit', dependency_gate: 'integrated',
    parallel_safe: false, affected_paths: [], exclusive_resources: [], status: 'pending',
  }]);

  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
  assert.strictEqual(prepared.tasks.length, 1);

  const worker = prepared.tasks[0].workerPath;
  const workerSha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', workerSha);
  assert.strictEqual(
    acceptDispatchAndRecord(repo, blueprint, worker, '001').ok,
    true,
  );
  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.deepStrictEqual(integrated.ready, []);
  assert.strictEqual(
    fs.readFileSync(path.join(boot.integrationPath, 'src/alpha.js'), 'utf8'),
    'changed by 001\n',
  );

  assert.deepStrictEqual(trackedSourceSnapshot(repo), before);
  assert.strictEqual(sourceStatus(repo), '');
});

/**
 * 계획 문서 한 벌을 schema에 맞춰 쓴다. 이 fixture는 계획을 커밋하지 않으므로
 * bootstrap이 integration에 seed한 사본만 drive의 정본이 된다.
 *
 * @param {string} repo - 저장소 루트
 * @param {string} rel - 문서 상대 경로
 * @param {string} type - 문서 type (예: `bouncer.tasks`)
 * @param {object} bouncer - bouncer 블록
 * @param {string} body - 본문
 */
function writePlanDoc(repo, rel, type, bouncer, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderDoc({
    type, title: `${bouncer.id} doc`, description: 'd', resource: rel, tags: ['bouncer'],
    timestamp: '2026-09-12T00:00:00+09:00', bouncer,
  }, body));
}

test('uncommitted-plan을 drive함 → integrate 뒤 open task 없이 finalize gate에 도달함', () => {
  const epic = '.bouncer/context/epics/013-evidence';
  const blueprint = `${epic}/blueprints/004-drive`;
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'source']);
  const ids = { epic_id: '013', blueprint_id: '004' };
  writePlanDoc(repo, `${epic}/index.md`, 'bouncer.epic', { id: '013', epic_id: '013', status: 'approved' }, '# Epic\n');
  ensureEpicIndexEntry({ repoRoot: repo, epicId: '013', name: 'evidence', description: 'd' });
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint',
    { id: '004', ...ids, status: 'approved', commit_type: 'feat' },
    '# Blueprint\n\n## Intent\n- 통합된 task는 열린 task로 남지 않는다\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', ...ids, status: 'ready', depends_on: [], parallel_safe: false,
    dependency_gate: 'integrated', affected_paths: ['src/alpha.js'],
  }, '# Tasks\n\n## Goal & intent\nalpha를 바꾼다.\n\n## Interface\n- 제공: alpha\n\n'
    + '## Touch\n- Modify `src/alpha.js`\n\n## Do not touch\n- `README.md`\n\n'
    + '## Constraints\n- 없음\n\n## Checklist\n- [ ] alpha를 바꾼다\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/verification.md`, 'bouncer.verification',
    { id: 'VERIFY-001', ...ids, status: 'pending' }, '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/review.md`, 'bouncer.review',
    { id: 'REVIEW-001', ...ids, status: 'pending', review: { required: true } }, '# Review\n\n## Findings\n- <finding>\n');
  assert.strictEqual(git(repo, ['ls-files', '--', '.bouncer']), '');

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integrationPath = boot.integrationPath;
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const sha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', sha);
  const recorded = acceptDispatchAndRecord(repo, blueprint, worker, '001');
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));

  const openTasks = () => validateBlueprint({ repoRoot: integrationPath, blueprintDir: blueprint, gate: 'finalize' })
    .failures.filter((f) => f.code === 'G16' && /open tasks remain/.test(f.message));
  // 대조군: integrate 전에는 integration 사본이 scaffold라 열린 task가 보인다.
  assert.strictEqual(openTasks().length, 1);

  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.strictEqual(loadLedger(path.join(integrationPath, '.bouncer/runtime/coordinator.json')).tasks[0].status,
    'integrated');

  const after = validateBlueprint({ repoRoot: integrationPath, blueprintDir: blueprint, gate: 'finalize' });
  assert.ok(!after.failures.some((f) => /^S/.test(f.code)), JSON.stringify(after.failures));
  assert.strictEqual(openTasks().length, 0);
  assert.match(fs.readFileSync(path.join(integrationPath, blueprint, 'tasks/001/tasks.md'), 'utf8'), /status: verified/);

  // 원장과 integration 문서가 맞으므로 drive finalize는 증적 불일치로 멈추지 않는다.
  const noGit = { changedFiles: () => [], untrackedFiles: () => [], stage: () => {}, commit: () => {} };
  const dry = finalize({ repoRoot: integrationPath, blueprintDir: blueprint, git: noGit });
  assert.notStrictEqual(dry.reason, 'coordinator-evidence-mismatch', JSON.stringify(dry));
  // 양성 판독: 대조는 원장을 읽은 drive에서만 돈다. 원장이 `ok`로 읽혀야 위 부정 단언이
  // "대조를 건너뛰어서"가 아니라 "대조가 맞아서" 통과했다는 뜻이 된다.
  assert.strictEqual(readCoordinatorLedger({ repoRoot: integrationPath, blueprint }).ok, true);
  // 대조를 지난 dry-run은 이 fixture에서 다음 단계인 validate 게이트에서 멈춘다.
  assert.strictEqual(dry.reason, 'validate', JSON.stringify(dry));
});

test('repair task를 integrate함 → 증적 문서가 허용되어 integrated·verified가 되고 finalize 대조가 맞음', () => {
  const epic = '.bouncer/context/epics/015-repair';
  const blueprint = `${epic}/blueprints/005-drive`;
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'source']);
  const ids = { epic_id: '015', blueprint_id: '005' };
  writePlanDoc(repo, `${epic}/index.md`, 'bouncer.epic', { id: '015', epic_id: '015', status: 'approved' }, '# Epic\n');
  ensureEpicIndexEntry({ repoRoot: repo, epicId: '015', name: 'repair', description: 'd' });
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint',
    { id: '005', ...ids, status: 'approved', commit_type: 'feat' },
    '# Blueprint\n\n## Intent\n- repair task도 같은 경로로 integrate된다\n');
  const body = '# Tasks\n\n## Goal & intent\nalpha를 바꾼다.\n\n## Interface\n- 제공: alpha\n\n'
    + '## Touch\n- Modify `src/alpha.js`\n\n## Do not touch\n- `README.md`\n\n'
    + '## Constraints\n- 없음\n\n## Checklist\n- [ ] alpha를 바꾼다\n';
  writePlanDoc(repo, `${blueprint}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', ...ids, status: 'ready', depends_on: [], parallel_safe: false,
    dependency_gate: 'integrated', affected_paths: ['src/alpha.js'],
  }, body);
  writePlanDoc(repo, `${blueprint}/tasks/002/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-002', ...ids, status: 'ready', execution_kind: 'verification', depends_on: ['TASKS-001'],
    parallel_safe: false, dependency_gate: 'integrated', affected_paths: [], verify: 'node --test',
  }, body);
  for (const id of ['001', '002']) {
    writePlanDoc(repo, `${blueprint}/tasks/${id}/verification.md`, 'bouncer.verification',
      { id: `VERIFY-${id}`, ...ids, status: 'pending' }, '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n');
    writePlanDoc(repo, `${blueprint}/tasks/${id}/review.md`, 'bouncer.review',
      { id: `REVIEW-${id}`, ...ids, status: 'pending', review: { required: true } }, '# Review\n\n## Findings\n- <finding>\n');
  }

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integrationPath = boot.integrationPath;
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const sha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', sha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, worker, '001').ok, true);
  const verifyOk = () => ({ ok: true, command: 'node --test', exitCode: 0, evidenceId: 'e'.repeat(64) });
  const integrate = (task, runVerification) => coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task, deps: { runVerification },
  });
  assert.strictEqual(integrate('001', verifyOk).ok, true);

  // terminal CI가 실패하면 repair task 003이 동적으로 생기고 문서가 integration에 untracked로 남는다.
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const failed = integrate('002', () => ({ ok: false, command: 'node --test', exitCode: 1 }));
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));
  const repair = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: integrationPath, task: '002',
    failureCommand: 'node --test', summary: 'one failed', paths: ['src/alpha.js'], decision: 'repair alpha',
  });
  assert.strictEqual(repair.ok, true, JSON.stringify(repair));
  const repairId = repair.repairTask.id;

  const repairPrepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(repairPrepared.ok, true, JSON.stringify(repairPrepared));
  const repairWorker = repairPrepared.tasks.find((entry) => entry.id === repairId).workerPath;
  const repairSha = commitInWorker(repairWorker, 'src/alpha.js', 'repaired by 003\n', 'fix: repair 003');
  writeTerminalEvidence(repairWorker, blueprint, repairId, repairSha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, repairWorker, repairId).ok, true);

  const integrated = integrate(repairId, verifyOk);
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.match(fs.readFileSync(path.join(integrationPath, blueprint, `tasks/${repairId}/tasks.md`), 'utf8'), /status: verified/);

  // terminal까지 통과시켜 원장과 integration 증적이 모두 맞는 drive 상태로 만든다.
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const terminal = integrate('002', verifyOk);
  assert.strictEqual(terminal.ok, true, JSON.stringify(terminal));
  const noGit = { changedFiles: () => [], untrackedFiles: () => [], stage: () => {}, commit: () => {} };
  const dry = finalize({ repoRoot: integrationPath, blueprintDir: blueprint, git: noGit });
  assert.notStrictEqual(dry.reason, 'coordinator-evidence-mismatch', JSON.stringify(dry));
});

test('drive finalize 뒤 finalize release-main → main이 plan conflict 없이 integration branch를 merge함', () => {
  const { releaseMain } = require('../scripts/lib/finalize-release-main');
  const epic = '.bouncer/context/epics/014-release';
  const blueprint = `${epic}/blueprints/004-drive`;
  const epicIndex = `${epic}/index.md`;
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  const ids = { epic_id: '014', blueprint_id: '004' };
  writePlanDoc(repo, epicIndex, 'bouncer.epic', { id: '014', epic_id: '014', status: 'approved' },
    '# Epic\n\n## Blueprints\n');
  ensureEpicIndexEntry({ repoRoot: repo, epicId: '014', name: 'release', description: 'd' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'source and epic']);
  fs.appendFileSync(path.join(repo, epicIndex), '- [004-drive](blueprints/004-drive/index.md)\n');
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint',
    { id: '004', ...ids, status: 'approved', commit_type: 'feat' }, '# Blueprint\n\n## Intent\n- release-main으로 닫힌 사본을 올린다\n');
  writePlanDoc(repo, `${blueprint}/context-review.md`, 'bouncer.context-review',
    { id: 'CR-004', ...ids, status: 'accepted' }, '# Context review\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', ...ids, status: 'ready', depends_on: [], parallel_safe: false,
    dependency_gate: 'integrated', affected_paths: ['src/alpha.js'],
  }, '# Tasks\n\nalpha를 바꾼다.\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/verification.md`, 'bouncer.verification',
    { id: 'VERIFY-001', ...ids, status: 'pending' }, '# Verification\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/review.md`, 'bouncer.review',
    { id: 'REVIEW-001', ...ids, status: 'pending' }, '# Review\n');

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const { integrationPath, integrationBranch } = boot;
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const sha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', sha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, worker, '001').ok, true);
  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));

  fs.rmSync(path.join(integrationPath, blueprint, 'tasks'), { recursive: true, force: true });
  fs.rmSync(path.join(integrationPath, blueprint, 'context-review.md'), { force: true });
  const indexFile = path.join(integrationPath, blueprint, 'index.md');
  const indexDoc = readDoc(indexFile);
  indexDoc.data.bouncer.status = 'closed';
  fs.writeFileSync(indexFile, renderDoc(indexDoc.data, indexDoc.body));
  writePlanDoc(integrationPath, `${blueprint}/explain.md`, 'bouncer.explain',
    { id: 'EXPLAIN-004', ...ids, comprehension: [] }, '# Explain\n');
  git(integrationPath, ['add', '--', `${blueprint}/index.md`, `${blueprint}/explain.md`, epicIndex]);
  git(integrationPath, ['commit', '-m', 'chore: close blueprint']);

  assert.throws(() => git(repo, ['merge', '--no-edit', integrationBranch]));
  const released = releaseMain({ repoRoot: repo, cwd: repo, blueprintDir: blueprint });
  assert.equal(released.ok, true, JSON.stringify(released));
  git(repo, ['merge', '--no-edit', integrationBranch]);
  assert.match(fs.readFileSync(path.join(repo, epicIndex), 'utf8'), /blueprints\/004-/);
  assert.match(fs.readFileSync(path.join(repo, blueprint, 'index.md'), 'utf8'), /status: closed/);
  assert.strictEqual(fs.existsSync(path.join(repo, blueprint, 'tasks')), false);
  assert.strictEqual(sourceStatus(repo), '');
});

test('dispatch 또는 accepted report 없이 record함 → worker HEAD를 저장하지 않고 거절함', () => {
  const blueprint = '.bouncer/context/epics/010-parallel/blueprints/001-drive';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  writeTask(repo, blueprint, '001', { depends_on: [], parallel_safe: true });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const sha = commitInWorker(worker, 'src/alpha.js', 'changed\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', sha);
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const before = fs.readFileSync(ledgerFile, 'utf8');
  const skipped = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001',
  });
  assert.strictEqual(skipped.ok, false);
  assert.match(skipped.reason, /accepted-report-required|no-accepted-report/);
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), before);
  const recorded = acceptDispatchAndRecord(repo, blueprint, worker, '001');
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  assert.strictEqual(recorded.task.sha, sha);
});

const passVerify = () => ({
  ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
});

/**
 * 세 disjoint parallel_safe task를 심고 bootstrap까지 끝낸 fixture.
 * 기본 max_parallel(2)과 충돌 분리 회귀의 공통 출발점이다.
 *
 * @param {string} prefix - tmpdir 접두
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {{ repo: string, blueprint: string, boot: object }}
 */
function threeDisjointReady(prefix, blueprint) {
  const repo = makeRepo({
    'README.md': 'fixture\n',
    'a/x.js': 'a\n', 'b/x.js': 'b\n', 'c/x.js': 'c\n',
  });
  for (const [id, leaf] of [['001', 'a/'], ['002', 'b/'], ['003', 'c/']]) {
    writeTask(repo, blueprint, id, {
      depends_on: [], parallel_safe: true, affected_paths: [leaf],
    });
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  return { repo, blueprint, boot };
}

test('parallel drive에서 default max_parallel → ready task 셋 중 둘을 lease함', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/001-cap';
  const { repo, boot } = threeDisjointReady('bouncer-e2e-cap-', blueprint);
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  // 기본 한도 2 — 세 ready 중 두 lease만.
  assert.deepStrictEqual(prepared.ready, ['001', '002']);
  assert.strictEqual(prepared.tasks.filter((t) => t.lease?.status === 'active').length, 2);
});

test('parallel drive에서 max_parallel 1 → task 하나만 lease함', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/002-one';
  const { repo, boot } = threeDisjointReady('bouncer-e2e-one-', blueprint);
  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 1 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
  assert.strictEqual(prepared.tasks.filter((t) => t.lease?.status === 'active').length, 1);
});

test('parallel drive에서 path ancestor와 shared exclusive_resources → 한 wave에 들어가지 않음', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/003-conflict';
  const repo = makeRepo({
    'README.md': 'fixture\n',
    'src/a.ts': 'a\n', 'other/x.js': 'o\n', 'y/x.js': 'y\n',
  });
  writeTask(repo, blueprint, '001', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/'],
  });
  writeTask(repo, blueprint, '002', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/a.ts'],
  });
  writeTask(repo, blueprint, '003', {
    depends_on: [], parallel_safe: true,
    affected_paths: ['other/'], exclusive_resources: ['database-schema'],
  });
  writeTask(repo, blueprint, '004', {
    depends_on: [], parallel_safe: true,
    affected_paths: ['y/'], exclusive_resources: ['database-schema'],
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 4 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  // 조상 충돌로 001만, 자원 충돌로 003만 — 002·004는 같은 wave에 못 든다.
  assert.deepStrictEqual(prepared.ready, ['001', '003']);
});

test('parallel drive에서 revoke 뒤 → prior-generation report와 record가 거절됨', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/004-stale';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha\n' });
  writeTask(repo, blueprint, '001', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/alpha.js'],
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => 'lease-a' },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const lease = prepared.tasks[0].lease;
  const revoked = coordinate({
    command: 'revoke', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    task: '001', reason: 'requeue-for-e2e',
  });
  assert.strictEqual(revoked.ok, true, JSON.stringify(revoked));
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const before = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');

  const lateReport = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: lease.id, generation: lease.generation,
    attempt: 1, taskBriefHash: 'a'.repeat(64), outcome: 'accepted', summary: 'late',
  });
  assert.strictEqual(lateReport.reason, 'stale-lease');
  const lateRecord = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001',
    leaseId: lease.id, generation: lease.generation,
  });
  assert.strictEqual(lateRecord.reason, 'stale-lease');
  const after = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')).tasks.find((t) => t.id === '001');
  assert.strictEqual(after.status, before.status);
  assert.deepStrictEqual(after.lease, before.lease);
});

test('parallel drive에서 scope conflict → 뒤 lease만 revoke됨', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/005-revise';
  const repo = makeRepo({
    'README.md': 'fixture\n', 'src/a/x.js': 'a\n', 'src/b/x.js': 'b\n',
  });
  writeTask(repo, blueprint, '001', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/a/'],
  });
  writeTask(repo, blueprint, '002', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/b/'],
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 2 });
  let n = 0;
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { makeLeaseId: () => `L${++n}` },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const first = prepared.tasks.find((t) => t.id === '001');
  const second = prepared.tasks.find((t) => t.id === '002');
  assert.ok(first.lease.seq < second.lease.seq);
  const revised = reviseTaskScope({
    repoRoot: second.workerPath,
    blueprint,
    task: '002',
    paths: ['src/a/'],
    reason: 'overlap with earlier lease',
  });
  assert.strictEqual(revised.ok, true, JSON.stringify(revised));
  assert.deepStrictEqual(revised.revoked, ['002']);
  const ledger = loadLedger(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'));
  assert.strictEqual(ledger.tasks.find((t) => t.id === '001').lease.status, 'active');
  assert.strictEqual(ledger.tasks.find((t) => t.id === '002').lease.status, 'revoked');
  assert.strictEqual(ledger.tasks.find((t) => t.id === '002').status, 'pending');
});

test('parallel drive에서 wave verification 실패 → canonical HEAD가 바뀌지 않음', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/006-verify';
  const repo = makeRepo({
    'README.md': 'fixture\n', 'src/alpha.js': 'alpha\n', 'src/beta.js': 'beta\n',
  });
  writeTask(repo, blueprint, '001', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/alpha.js'],
  });
  writeTask(repo, blueprint, '002', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/beta.js'],
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 2 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks.map((t) => [t.id, t.workerPath]));
  const edits = { '001': 'src/alpha.js', '002': 'src/beta.js' };
  for (const id of ['001', '002']) {
    const sha = commitInWorker(workers[id], edits[id], `changed by ${id}\n`, `feat: task ${id}`);
    writeTerminalEvidence(workers[id], blueprint, id, sha);
    assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, workers[id], id).ok, true);
  }
  const baseHead = git(boot.integrationPath, ['rev-parse', 'HEAD']);
  const failed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      runVerification: () => ({
        ok: false, command: 'npm test', exitCode: 1, evidenceId: 'f'.repeat(64),
      }),
    },
  });
  assert.strictEqual(failed.reason, 'wave-verification-failed');
  assert.strictEqual(git(boot.integrationPath, ['rev-parse', 'HEAD']), baseHead);
  const ledger = loadLedger(path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json'));
  assert.deepStrictEqual(ledger.tasks.map((t) => t.status), ['recorded', 'recorded']);
  assert.strictEqual(ledger.fanin, null);
});

test('parallel drive에서 fanin.status verified 뒤 resume → 중복 cherry-pick 없이 끝남', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/007-resume';
  const repo = makeRepo({
    'README.md': 'fixture\n', 'src/alpha.js': 'alpha\n', 'src/beta.js': 'beta\n',
  });
  writeTask(repo, blueprint, '001', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/alpha.js'],
  });
  writeTask(repo, blueprint, '002', {
    depends_on: [], parallel_safe: true, affected_paths: ['src/beta.js'],
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  writeCoordinatorConfig(boot.integrationPath, { max_parallel: 2 });
  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const workers = Object.fromEntries(prepared.tasks.map((t) => [t.id, t.workerPath]));
  const edits = { '001': 'src/alpha.js', '002': 'src/beta.js' };
  for (const id of ['001', '002']) {
    const sha = commitInWorker(workers[id], edits[id], `changed by ${id}\n`, `feat: task ${id}`);
    writeTerminalEvidence(workers[id], blueprint, id, sha);
    assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, workers[id], id).ok, true);
  }
  const first = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: { runVerification: passVerify },
  });
  assert.strictEqual(first.ok, true, JSON.stringify(first));
  const candidateHead = first.integrationHead;
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const ledger = loadLedger(ledgerFile);
  // ff는 끝났지만 원장 쓰기 전에 중단된 상태: HEAD는 candidate, fanin은 verified.
  const preFanin = git(boot.integrationPath, ['merge-base', candidateHead, `${candidateHead}~2`]);
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
  ledger.decisions = (ledger.decisions || []).filter((d) => d.kind !== 'fanin');
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);

  let cherryPickCalls = 0;
  const resumed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath,
    deps: {
      execFileSync: (file, args, options) => {
        if (args[0] === 'cherry-pick') cherryPickCalls += 1;
        return require('node:child_process').execFileSync(file, args, options);
      },
      runVerification: passVerify,
    },
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  assert.strictEqual(cherryPickCalls, 0);
  const after = loadLedger(ledgerFile);
  assert.strictEqual(after.integrationHead, candidateHead);
  assert.deepStrictEqual(after.tasks.map((t) => t.status), ['integrated', 'integrated']);
  assert.strictEqual(after.fanin, null);
  const subjects = git(boot.integrationPath, ['log', '--format=%s']).split('\n');
  assert.strictEqual(subjects.filter((s) => s === 'feat: task 001').length, 1);
  assert.strictEqual(subjects.filter((s) => s === 'feat: task 002').length, 1);
});

test('parallel drive에서 ledger 없는 standalone checkout → pointer effectiveTask를 유지함', () => {
  const blueprint = '.bouncer/context/epics/078-e2e/blueprints/008-standalone';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha\n' });
  writeTask(repo, blueprint, '001', {
    depends_on: [], parallel_safe: false, affected_paths: ['src/alpha.js'],
  });
  writeTask(repo, blueprint, '002', {
    depends_on: [], parallel_safe: false, affected_paths: ['src/alpha.js'],
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  // 원장 없는 standalone: pointer task가 effectiveTask다.
  writeCurrent({
    repoRoot: repo, blueprint, base: 'work', task: `${blueprint}/tasks/002/tasks.md`,
  });
  const eff = resolveEffectiveTask({ repoRoot: repo });
  assert.strictEqual(eff.source, 'pointer');
  assert.strictEqual(eff.id, 'TASKS-002');
});

/**
 * scoped_terminal 계획을 만든다: 구현 001·002(직렬, 각자 전용 명령)와 종단 verification 003.
 * 새 scaffold가 쓰는 표식과 같은 `verification_policy`를 blueprint index에 둔다.
 */
function makeScopedRepo(epicNo, { light = false } = {}) {
  const epic = `.bouncer/context/epics/${epicNo}-scoped`;
  const blueprint = `${epic}/blueprints/001-drive`;
  const repo = makeRepo({
    'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n', 'src/beta.js': 'beta base\n',
  });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'source']);
  const ids = { epic_id: epicNo, blueprint_id: '001' };
  writePlanDoc(repo, `${epic}/index.md`, 'bouncer.epic', { id: epicNo, epic_id: epicNo, status: 'approved' }, '# Epic\n');
  ensureEpicIndexEntry({ repoRoot: repo, epicId: epicNo, name: 'scoped', description: 'd' });
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint', {
    id: '001', ...ids, status: 'approved', commit_type: 'feat', review_scope: 'blueprint',
    verification_policy: 'scoped_terminal', ...(light ? { scale: 'light' } : {}),
  }, '# Blueprint\n\n## Intent\n- 구현은 전용 명령, 전체 검증은 종단에서 한 번\n');
  if (light) {
    writePlanDoc(repo, `${blueprint}/review.md`, 'bouncer.review', {
      id: 'REVIEW-001', ...ids, status: 'pending', review: { required: true },
    }, '# Review\n\n## Findings\n- <finding>\n');
  }
  const body = '# Tasks\n\n## Goal & intent\n바꾼다.\n\n## Touch\n- Modify `src/alpha.js`\n\n## Checklist\n- [ ] 바꾼다\n';
  const commits = light ? [['001', 'src/alpha.js', []]]
    : [['001', 'src/alpha.js', []], ['002', 'src/beta.js', ['TASKS-001']]];
  for (const [id, file, dependsOn] of commits) {
    writePlanDoc(repo, `${blueprint}/tasks/${id}/tasks.md`, 'bouncer.tasks', {
      id: `TASKS-${id}`, ...ids, status: 'ready', depends_on: dependsOn, parallel_safe: false,
      dependency_gate: 'integrated', affected_paths: [file], verify: `node --test test/${id}.test.js`,
    }, body);
  }
  const terminalId = light ? '002' : '003';
  writePlanDoc(repo, `${blueprint}/tasks/${terminalId}/tasks.md`, 'bouncer.tasks', {
    id: `TASKS-${terminalId}`, ...ids, status: 'ready', execution_kind: 'verification',
    depends_on: [`TASKS-${light ? '001' : '002'}`], parallel_safe: false, dependency_gate: 'integrated',
    affected_paths: [], verify: 'npm test',
  }, body);
  for (const id of [...commits.map((c) => c[0]), terminalId]) {
    writePlanDoc(repo, `${blueprint}/tasks/${id}/verification.md`, 'bouncer.verification',
      { id: `VERIFY-${id}`, ...ids, status: 'pending' }, '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n');
  }
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  return { repo, blueprint, terminalId };
}

test('scoped_terminal drive → 보고 Tests가 지정 명령·통과 결과가 아니면 fan-in 거부, 통과 뒤에도 runner는 종단에서만 1회', () => {
  const { repo, blueprint, terminalId } = makeScopedRepo('091');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integrationPath = boot.integrationPath;
  const calls = [];
  const runVerification = (opts) => {
    calls.push({ taskId: opts.taskId, kind: opts.scope && opts.scope.kind });
    return { ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) };
  };
  const integrate = (task) => coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task, deps: { runVerification },
  });
  const ledgerOf = () => loadLedger(path.join(integrationPath, '.bouncer/runtime/coordinator.json'));

  for (const [id, file] of [['001', 'src/alpha.js'], ['002', 'src/beta.js']]) {
    const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
    assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
    const worker = prepared.tasks.find((t) => t.id === id).workerPath;
    const sha = commitInWorker(worker, file, `changed by ${id}\n`, `feat: task ${id}`);
    writeTerminalEvidence(worker, blueprint, id, sha);
    const command = `node --test test/${id}.test.js`;
    // 결과가 빠진 Tests, 다른 명령, 실패 결과, Tests 절 부재는 모두 거부된다.
    const bad = {
      noSection: null,
      otherCommand: '- `npm test` — 12 pass, 0 fail',
      noResult: `- \`${command}\``,
      failed: `- \`${command}\` — 11 pass, 1 fail (exit 1)`,
    };
    const head = git(integrationPath, ['rev-parse', 'HEAD']);
    const dispatched = coordinate({ command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: id });
    assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
    const accept = (tests) => {
      writeWorkerReport(worker, id, dispatched.metadata.attempt, dispatched.metadata.task_brief_hash, { tests });
    };
    accept(bad.noSection);
    assert.strictEqual(coordinate({
      command: 'report', repoRoot: repo, blueprint, cwd: worker, task: id,
      attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
      outcome: 'accepted', summary: `accepted ${id}`,
    }).ok, true);
    assert.strictEqual(coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: id }).ok, true);
    for (const [label, tests] of Object.entries(bad)) {
      accept(tests);
      const rejected = integrate(id);
      assert.strictEqual(rejected.ok, false, `${label}: ${JSON.stringify(rejected)}`);
      assert.strictEqual(rejected.reason, 'worker-test-report-mismatch', `${label}: ${JSON.stringify(rejected)}`);
      assert.strictEqual(rejected.task, id);
      assert.strictEqual(git(integrationPath, ['rev-parse', 'HEAD']), head, label);
      assert.strictEqual(ledgerOf().tasks.find((t) => t.id === id).status, 'recorded', label);
    }
    accept(`- \`${command}\` — 12 pass, 0 fail (exit 0)`);
    const integrated = integrate(id);
    assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  }
  // 모든 구현 통합 뒤에도 wave fan-in은 전체 명령을 한 번도 돌리지 않았다.
  assert.deepStrictEqual(calls, []);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const terminal = integrate(terminalId);
  assert.strictEqual(terminal.ok, true, JSON.stringify(terminal));
  assert.deepStrictEqual(calls, [{ taskId: terminalId, kind: 'terminal' }]);
});

test('scoped_terminal terminal failure → repair needs its own --verify and tracked paths, then integrates and the terminal re-verifies', () => {
  const { repo, blueprint, terminalId } = makeScopedRepo('093');
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integrationPath = boot.integrationPath;
  const integrate = (task, runVerification) => coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task, deps: { runVerification },
  });
  const noRun = () => { throw new Error('wave fan-in must not run the full command'); };
  const workerFor = (id) => coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath })
    .tasks.find((t) => t.id === id).workerPath;
  for (const [id, file] of [['001', 'src/alpha.js'], ['002', 'src/beta.js']]) {
    const worker = workerFor(id);
    const sha = commitInWorker(worker, file, `changed by ${id}\n`, `feat: task ${id}`);
    writeTerminalEvidence(worker, blueprint, id, sha);
    assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, worker, id, {
      tests: `- \`node --test test/${id}.test.js\` — 1 pass, 0 fail (exit 0)`,
    }).ok, true);
    assert.strictEqual(integrate(id, noRun).ok, true);
  }
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const failed = integrate(terminalId, () => ({ ok: false, command: 'npm test', exitCode: 1 }));
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));

  const repairArgs = {
    command: 'repair', repoRoot: repo, blueprint, cwd: integrationPath, task: terminalId,
    failureCommand: 'npm test', summary: 'alpha broke', paths: ['src/alpha.js'], decision: 'repair alpha',
  };
  assert.strictEqual(coordinate(repairArgs).reason, 'repair-verify-required');
  assert.strictEqual(coordinate({ ...repairArgs, verify: 'npm test' }).reason, 'repair-verify-is-terminal');
  assert.strictEqual(coordinate({ ...repairArgs, verify: 'a && b' }).reason, 'repair-verify-not-single-argv');
  assert.strictEqual(coordinate({ ...repairArgs, verify: 'node --test test/alpha.test.js', paths: ['src/ghost.js'] }).reason,
    'scope-path-untracked');

  const verify = 'node --test test/alpha.test.js';
  const repair = coordinate({ ...repairArgs, verify });
  assert.strictEqual(repair.ok, true, JSON.stringify(repair));
  const repairId = repair.repairTask.id;
  const repairWorker = workerFor(repairId);
  const repairSha = commitInWorker(repairWorker, 'src/alpha.js', 'repaired\n', 'fix: repair alpha');
  writeTerminalEvidence(repairWorker, blueprint, repairId, repairSha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, repairWorker, repairId, {
    tests: `- \`${verify}\` — 1 pass, 0 fail (exit 0)`,
  }).ok, true);
  assert.strictEqual(integrate(repairId, noRun).ok, true);

  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const terminal = integrate(terminalId, () => ({ ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }));
  assert.strictEqual(terminal.ok, true, JSON.stringify(terminal));
});

test('legacy blueprint without the marker → fan-in still runs the wave verification and needs no Tests section', () => {
  const blueprint = '.bouncer/context/epics/092-legacy/blueprints/001-drive';
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha\n' });
  writeTask(repo, blueprint, '001', { depends_on: [], parallel_safe: false, affected_paths: ['src/alpha.js'] });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath });
  const worker = prepared.tasks[0].workerPath;
  const sha = commitInWorker(worker, 'src/alpha.js', 'changed\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', sha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, worker, '001').ok, true);
  let calls = 0;
  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
    deps: { runVerification: () => { calls += 1; return { ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) }; } },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.strictEqual(calls, 1);
});

test('scoped_terminal light drive → 구현 하나 통합까지 runner 0회, 종단 node에서 1회 뒤 done', () => {
  const { recordReview } = require('../scripts/lib/review-record');
  const { captureReviewSnapshot } = require('../scripts/lib/review-snapshot');
  const { coordinateNext } = require('../scripts/lib/coordinate-next');
  const { repo, blueprint, terminalId } = makeScopedRepo('093', { light: true });
  const calls = [];
  const runVerification = (opts) => {
    calls.push({ taskId: opts.taskId, kind: opts.scope && opts.scope.kind });
    return { ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64) };
  };

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.mode, 'light');
  const integrationPath = boot.integrationPath;
  // 종단 node는 구현 통합 전에는 열리지 않는다.
  assert.deepStrictEqual(boot.ready, ['001']);

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const sha = commitInWorker(integrationPath, 'src/alpha.js', 'changed by light\n', 'feat: light 001');
  writeTerminalEvidence(integrationPath, blueprint, '001', sha);
  // light inline 보고는 파일을 남기지 않을 수 있다 — 그래도 부재는 fan-in을 막지 않는다.
  const baseSha = git(integrationPath, ['rev-parse', `${sha}~1`]);
  const frozen = captureReviewSnapshot({
    repoRoot: integrationPath, blueprintDir: blueprint, taskId: null, base: baseSha, head: sha,
  });
  assert.strictEqual(frozen.ok, true, JSON.stringify(frozen));
  const roundFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-e2e-round-')), 'round.json');
  fs.writeFileSync(roundFile, `${JSON.stringify({
    round: {
      round: 1, mode: 'discovery',
      target: { base: baseSha, head: sha, snapshot_id: frozen.snapshot_id },
      perspectives: [{ name: 'combined', target_head: sha }],
      previous_finding_ids: [], new: 0, resolved: 0, regressed: 0,
    },
    findings: [],
  })}\n`);
  assert.strictEqual(recordReview({
    repoRoot: integrationPath, blueprintDir: blueprint, roundFile, status: 'accepted',
  }).ok, true);
  assert.strictEqual(coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'light accepted',
  }).ok, true);
  assert.strictEqual(coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
  }).ok, true);

  // 파일이 있는 보고가 지정 명령을 담지 않으면 light에서도 거부한다.
  writeWorkerReport(
    integrationPath, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash,
    { tests: '- `npm test` — 12 pass' },
  );
  const rejected = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    deps: { runVerification },
  });
  assert.strictEqual(rejected.reason, 'worker-test-report-mismatch', JSON.stringify(rejected));
  fs.rmSync(path.join(integrationPath, '.bouncer/runtime/reports'), { recursive: true, force: true });

  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    deps: { runVerification },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.deepStrictEqual(calls, []);
  assert.deepStrictEqual(integrated.ready, [terminalId]);

  // 구현이 통합된 뒤에야 next가 종단 node를 연다.
  const afterImpl = coordinateNext({ repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(afterImpl.action, 'prepare', JSON.stringify(afterImpl));
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const nodeStep = coordinateNext({ repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(nodeStep.action, 'verification_node', JSON.stringify(nodeStep));
  assert.strictEqual(nodeStep.task, terminalId);

  const terminal = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: terminalId,
    deps: { runVerification },
  });
  assert.strictEqual(terminal.ok, true, JSON.stringify(terminal));
  assert.deepStrictEqual(calls, [{ taskId: terminalId, kind: 'terminal' }]);
  const done = coordinateNext({ repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(done.action, 'done', JSON.stringify(done));
});

test('scoped_terminal light bootstrap → 구현 둘이거나 종단이 없으면 light-requires-single-task로 거절', () => {
  const { repo, blueprint } = makeScopedRepo('094', { light: true });
  // 종단 node를 지우면 구현 하나뿐인 scoped light가 되어 자격이 없다.
  fs.rmSync(path.join(repo, blueprint, 'tasks/002'), { recursive: true });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'drop terminal']);
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, false, JSON.stringify(boot));
  assert.strictEqual(boot.reason, 'light-requires-single-task');
});

test('light single-task drive → worker worktree 없이 integration에서 prepare부터 done까지 진행됨', () => {
  const { recordReview } = require('../scripts/lib/review-record');
  const { coordinateNext } = require('../scripts/lib/coordinate-next');
  const epic = '.bouncer/context/epics/089-e2e';
  const blueprint = `${epic}/blueprints/001-light`;
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  writePlanDoc(repo, `${epic}/index.md`, 'bouncer.epic', { id: '089', epic_id: '089', status: 'approved' }, '# Epic\n');
  ensureEpicIndexEntry({ repoRoot: repo, epicId: '089', name: 'e2e-light', description: 'd' });
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint', {
    id: '001', epic_id: '089', blueprint_id: '001', status: 'approved',
    commit_type: 'feat', scale: 'light', review_scope: 'blueprint',
  }, '# Blueprint\n\n## Intent\n- light inline drive를 돌린다\n');
  writePlanDoc(repo, `${blueprint}/review.md`, 'bouncer.review', {
    id: 'REVIEW-001', epic_id: '089', blueprint_id: '001', status: 'pending',
    review: { required: true },
  }, '# Review\n\n## Findings\n- <finding>\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', epic_id: '089', blueprint_id: '001', status: 'ready',
    depends_on: [], parallel_safe: false, dependency_gate: 'integrated',
    affected_paths: ['src/alpha.js'],
  }, '# Tasks\n\n## Goal & intent\nalpha\n\n## Touch\n- Modify `src/alpha.js`\n\n## Checklist\n- [ ] alpha\n');
  writePlanDoc(repo, `${blueprint}/tasks/001/verification.md`, 'bouncer.verification', {
    id: 'VERIFY-001', epic_id: '089', blueprint_id: '001', status: 'pending',
  }, '# Verification\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'plan']);
  const before = trackedSourceSnapshot(repo);

  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  assert.strictEqual(boot.mode, 'light');
  const integrationPath = boot.integrationPath;

  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.strictEqual(prepared.tasks[0].workerPath, integrationPath);
  assert.strictEqual(fs.existsSync(path.join(integrationPath, '..', 'workers')), false);

  const implement = coordinateNext({
    repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
  });
  assert.strictEqual(implement.ok, true, JSON.stringify(implement));
  // dispatch 전이면 dispatch가 먼저다 — dispatch 후 implement inline을 본다.
  const dispatched = coordinate({
    command: 'dispatch', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
  });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  const inline = coordinateNext({
    repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
  });
  assert.strictEqual(inline.action, 'implement');
  assert.strictEqual(inline.payload.inline, true);
  assert.strictEqual(inline.cwd, integrationPath);

  const sha = commitInWorker(integrationPath, 'src/alpha.js', 'changed by light\n', 'feat: light 001');
  writeTerminalEvidence(integrationPath, blueprint, '001', sha);
  // blueprint review_scope: task review.md는 fan-in에서 빠지지만 writeTerminalEvidence가 만든다.

  // 라운드는 실제로 동결한 상태에 묶여야 기록된다. 라운드 입력은 저장소 밖에 써서
  // 파일 자체가 작업 트리 변경(stale)이 되지 않게 한다.
  const { captureReviewSnapshot } = require('../scripts/lib/review-snapshot');
  const baseSha = git(integrationPath, ['rev-parse', `${sha}~1`]);
  const frozen = captureReviewSnapshot({
    repoRoot: integrationPath, blueprintDir: blueprint, taskId: null, base: baseSha, head: sha,
  });
  assert.strictEqual(frozen.ok, true, JSON.stringify(frozen));
  const roundFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-e2e-round-')), 'round.json');
  fs.writeFileSync(roundFile, `${JSON.stringify({
    round: {
      round: 1,
      mode: 'discovery',
      target: { base: baseSha, head: sha, snapshot_id: frozen.snapshot_id },
      perspectives: [{ name: 'combined', target_head: sha }],
      previous_finding_ids: [],
      new: 0,
      resolved: 0,
      regressed: 0,
    },
    findings: [],
  })}\n`);
  const recordedReview = recordReview({
    repoRoot: integrationPath,
    blueprintDir: blueprint,
    roundFile,
    status: 'accepted',
  });
  assert.strictEqual(recordedReview.ok, true, JSON.stringify(recordedReview));

  const reported = coordinate({
    command: 'report', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    attempt: dispatched.metadata.attempt,
    taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted',
    summary: 'light accepted',
  });
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const recorded = coordinate({
    command: 'record', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
  });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));

  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001',
    deps: {
      runVerification: () => ({
        ok: true, command: 'npm test', exitCode: 0, evidenceId: 'e'.repeat(64),
      }),
    },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.strictEqual(
    loadLedger(path.join(integrationPath, '.bouncer/runtime/coordinator.json')).tasks[0].status,
    'integrated',
  );
  assert.strictEqual(
    fs.readFileSync(path.join(integrationPath, 'src/alpha.js'), 'utf8'),
    'changed by light\n',
  );
  assert.strictEqual(fs.existsSync(path.join(integrationPath, '..', 'fanin')), false);

  const done = coordinateNext({ repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(done.ok, true, JSON.stringify(done));
  // CT-001: light 종료는 action===done 만 허용. none·빈 ready·final_review soft
  // 수락은 다른 터미널 상태로도 통과시켜 회귀를 숨긴다.
  assert.strictEqual(done.action, 'done', JSON.stringify(done));

  assert.deepStrictEqual(trackedSourceSnapshot(repo), before);
  assert.strictEqual(sourceStatus(repo), '');
});

/**
 * 001(src/alpha.js)이 integrate된 뒤 terminal 002의 CI가 실패한 실제 git drive를 만든다.
 * 실패 결과에 evidenceId를 실어 범위 밖 분류가 묶일 원본 identity를 갖게 한다.
 */
function terminalFailedE2eDrive(epicNo) {
  const epic = `.bouncer/context/epics/${epicNo}-resume`;
  const blueprint = `${epic}/blueprints/001-drive`;
  const repo = makeRepo({ 'README.md': 'fixture\n', 'src/alpha.js': 'alpha base\n' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-m', 'source']);
  const ids = { epic_id: epicNo, blueprint_id: '001' };
  writePlanDoc(repo, `${epic}/index.md`, 'bouncer.epic', { id: epicNo, epic_id: epicNo, status: 'approved' }, '# Epic\n');
  ensureEpicIndexEntry({ repoRoot: repo, epicId: epicNo, name: 'resume', description: 'd' });
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint',
    { id: '001', ...ids, status: 'approved', commit_type: 'feat' },
    '# Blueprint\n\n## Intent\n- 기존 task로 복구한다\n');
  const body = '# Tasks\n\n## Goal & intent\nalpha를 바꾼다.\n\n## Interface\n- 제공: alpha\n\n'
    + '## Touch\n- Modify `src/alpha.js`\n\n## Do not touch\n- `README.md`\n\n'
    + '## Constraints\n- 없음\n\n## Checklist\n- [ ] alpha를 바꾼다\n';
  writePlanDoc(repo, `${blueprint}/tasks/001/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-001', ...ids, status: 'ready', depends_on: [], parallel_safe: false,
    dependency_gate: 'integrated', affected_paths: ['src/alpha.js'],
  }, body);
  writePlanDoc(repo, `${blueprint}/tasks/002/tasks.md`, 'bouncer.tasks', {
    id: 'TASKS-002', ...ids, status: 'ready', execution_kind: 'verification', depends_on: ['TASKS-001'],
    parallel_safe: false, dependency_gate: 'integrated', affected_paths: [], verify: 'node --test',
  }, body);
  for (const id of ['001', '002']) {
    writePlanDoc(repo, `${blueprint}/tasks/${id}/verification.md`, 'bouncer.verification',
      { id: `VERIFY-${id}`, ...ids, status: 'pending' }, '# Verification\n\n## Command\n<command>\n\n## Evidence\n<result>\n');
    writePlanDoc(repo, `${blueprint}/tasks/${id}/review.md`, 'bouncer.review',
      { id: `REVIEW-${id}`, ...ids, status: 'pending', review: { required: true } }, '# Review\n\n## Findings\n- <finding>\n');
  }
  const boot = coordinate({ command: 'bootstrap', repoRoot: repo, blueprint });
  assert.strictEqual(boot.ok, true, JSON.stringify(boot));
  const integrationPath = boot.integrationPath;
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  const worker = prepared.tasks[0].workerPath;
  const sha = commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
  writeTerminalEvidence(worker, blueprint, '001', sha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, worker, '001').ok, true);
  const verifyOk = () => ({ ok: true, command: 'node --test', exitCode: 0, evidenceId: 'e'.repeat(64) });
  const integrate = (task, runVerification) => coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task, deps: { runVerification },
  });
  assert.strictEqual(integrate('001', verifyOk).ok, true);
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const failed = integrate('002', () => ({
    ok: false, command: 'node --test', exitCode: 1, evidenceId: 'f'.repeat(64),
  }));
  assert.strictEqual(failed.reason, 'verification-failed', JSON.stringify(failed));
  return { repo, blueprint, integrationPath, integrate, verifyOk };
}

test('terminal CI failure resumed on the existing task → rework, reintegration and terminal re-verification finish without any new task', () => {
  const drive = terminalFailedE2eDrive('016');
  const { repo, blueprint, integrationPath } = drive;
  const ledgerFile = path.join(integrationPath, '.bouncer/runtime/coordinator.json');
  const before = loadLedger(ledgerFile);
  const resumed = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: integrationPath, task: '002', resumeTask: '001',
    failureCommand: 'node --test', summary: 'alpha regression', paths: ['src/alpha.js'],
    decision: 'task 001 owns the failing alpha code',
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));
  assert.deepStrictEqual(loadLedger(ledgerFile).tasks.map((t) => t.id), ['001', '002']);

  // 재배정된 worker는 현재 integration HEAD에서 시작하고 이전 통합 내용을 그대로 가진다.
  const prepared = coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
  const task = prepared.tasks.find((t) => t.id === '001');
  assert.strictEqual(task.lease.generation, before.tasks[0].lease.generation + 1);
  assert.strictEqual(git(task.workerPath, ['rev-parse', 'HEAD']), git(integrationPath, ['rev-parse', 'HEAD']));
  assert.strictEqual(fs.readFileSync(path.join(task.workerPath, 'src/alpha.js'), 'utf8'), 'changed by 001\n');

  // 이전 attempt의 증적 상태는 재작업 시작 때 되돌려져 있어, 새 작업 없이는 integrate할 수 없다.
  const staleEvidence = readDoc(path.join(task.workerPath, blueprint, 'tasks/001/tasks.md')).data.bouncer.status;
  assert.strictEqual(staleEvidence, 'ready');

  const fixSha = commitInWorker(task.workerPath, 'src/alpha.js', 'repaired by 001\n', 'fix: rework 001');
  writeTerminalEvidence(task.workerPath, blueprint, '001', fixSha);
  assert.strictEqual(acceptDispatchAndRecord(repo, blueprint, task.workerPath, '001').ok, true);
  assert.strictEqual(drive.integrate('001', drive.verifyOk).ok, true);
  assert.strictEqual(fs.readFileSync(path.join(integrationPath, 'src/alpha.js'), 'utf8'), 'repaired by 001\n');

  // terminal은 재통합 뒤 다시 검증되고, 관계없는 task는 다시 돌지 않는다.
  assert.strictEqual(coordinate({ command: 'prepare', repoRoot: repo, blueprint, cwd: integrationPath }).ok, true);
  const terminal = drive.integrate('002', drive.verifyOk);
  assert.strictEqual(terminal.ok, true, JSON.stringify(terminal));
  const after = loadLedger(ledgerFile);
  assert.deepStrictEqual(after.tasks.map((t) => [t.id, t.status]), [['001', 'integrated'], ['002', 'integrated']]);
  assert.strictEqual(after.repairWaves.length, 1);
  const noGit = { changedFiles: () => [], untrackedFiles: () => [], stage: () => {}, commit: () => {} };
  const dry = finalize({ repoRoot: integrationPath, blueprintDir: blueprint, git: noGit });
  assert.notStrictEqual(dry.reason, 'coordinator-evidence-mismatch', JSON.stringify(dry));
});

test('terminal CI failure classified outside_scope → next proceeds to done and finalize reports the failure without calling it verified', () => {
  const drive = terminalFailedE2eDrive('017');
  const { repo, blueprint, integrationPath } = drive;
  const { coordinateNext } = require('../scripts/lib/coordinate-next');
  const nextOf = () => coordinateNext({ repoRoot: repo, blueprint, cwd: integrationPath });
  // 분류 전에는 막힌다.
  assert.strictEqual(nextOf().reason, 'terminal-verification-failed');
  const classified = coordinate({
    command: 'repair', repoRoot: repo, blueprint, cwd: integrationPath, task: '002',
    disposition: 'outside_scope', failureCommand: 'node --test',
    summary: 'cause: vendored lock drift; failing test: test/vendor.test.js; needs vendor/ change outside every scope',
    paths: ['vendor/lock.json'], decision: 'no approved task owns vendor/',
  });
  assert.strictEqual(classified.ok, true, JSON.stringify(classified));
  const next = nextOf();
  assert.strictEqual(next.action, 'done', JSON.stringify(next));
  assert.strictEqual(next.payload.outside_scope.evidence_id, 'f'.repeat(64));
  const ledger = loadLedger(path.join(integrationPath, '.bouncer/runtime/coordinator.json'));
  assert.strictEqual(ledger.tasks[1].status, 'verifying');
  assert.strictEqual(ledger.terminalFailure.exitCode, 1);

  // 소스가 바뀌면 분류는 더 이상 유효하지 않다.
  fs.writeFileSync(path.join(integrationPath, 'src/alpha.js'), 'drifted\n');
  git(integrationPath, ['add', 'src/alpha.js']);
  git(integrationPath, ['commit', '-m', 'drift']);
  const stale = loadLedger(path.join(integrationPath, '.bouncer/runtime/coordinator.json'));
  stale.integrationHead = git(integrationPath, ['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(integrationPath, '.bouncer/runtime/coordinator.json'), `${JSON.stringify(stale, null, 2)}\n`);
  assert.strictEqual(nextOf().reason, 'terminal-verification-failed');
});

test('커밋 전 accepted report가 거절됨 → coordinate advance가 task commit을 만든 뒤 report·record·integrate가 이어짐', () => {
  const blueprint = '.bouncer/context/epics/112-guards/blueprints/001-order';
  const { repo, boot, workers } = prepareFanin(blueprint, ['001'], { 'src/alpha.js': 'alpha base\n' });
  const integration = boot.integrationPath;
  const worker = workers['001'];
  const ledgerFile = path.join(integration, '.bouncer/runtime/coordinator.json');
  // 실제 프로젝트는 .bouncer/runtime/을 gitignore한다. fixture에는 .gitignore가 없어 보고 파일이
  // dirty로 보이므로 저장소 공용 exclude로 같은 조건을 만든다.
  fs.appendFileSync(path.join(repo, '.git/info/exclude'), '.bouncer/runtime/\n');

  const dispatched = coordinate({ command: 'dispatch', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(dispatched.ok, true, JSON.stringify(dispatched));
  // 소스는 고쳤고 증적 문서도 terminal이지만 아직 커밋·stamp는 없다.
  fs.writeFileSync(path.join(worker, 'src/alpha.js'), 'changed by 001\n');
  writeTerminalEvidence(worker, blueprint, '001', null);
  writeWorkerReport(worker, '001', dispatched.metadata.attempt, dispatched.metadata.task_brief_hash);
  const reportArgs = {
    command: 'report', repoRoot: repo, blueprint, cwd: worker, task: '001',
    attempt: dispatched.metadata.attempt, taskBriefHash: dispatched.metadata.task_brief_hash,
    outcome: 'accepted', summary: 'accepted 001',
  };

  const ledgerBefore = fs.readFileSync(ledgerFile, 'utf8');
  const early = coordinate(reportArgs);
  assert.strictEqual(early.ok, false, JSON.stringify(early));
  assert.strictEqual(early.reason, 'worker-commit-missing');
  assert.strictEqual(fs.readFileSync(ledgerFile, 'utf8'), ledgerBefore);

  // advance는 next가 권한 commit 행동(bouncer commit)만 실행하고 report 판단 앞에서 멈춘다.
  const previousCwd = process.cwd();
  process.chdir(integration);
  let advanced;
  try {
    advanced = require('../scripts/lib/coordinate-advance').advance({
      repoRoot: repo, blueprint, task: '001',
      deps: {
        // next·advance는 실제 코드다. 외부 프로세스인 `bouncer commit`만 대신한다 — 실제 명령은
        // 완전한 plan 문서 gate를 요구하고 그 동작은 commit 테스트가 맡는다. 같은 효과(소스 커밋 +
        // tasks.md의 8자리 commit_sha stamp, tasks.md는 dirty로 남김)만 재현한다.
        runArgv: (argv, cwd) => {
          assert.deepStrictEqual(argv.slice(0, 2), ['bouncer', 'commit']);
          assert.strictEqual(cwd, worker);
          // 실제 commit처럼 증적 문서까지 한 커밋에 담는다(tasks.md의 stamp만 커밋 뒤 잔여물).
          git(worker, ['add', 'src/alpha.js', `${blueprint}/tasks/001`]);
          git(worker, ['commit', '-m', 'feat: task 001']);
          const sha = git(worker, ['rev-parse', 'HEAD']);
          const file = path.join(worker, blueprint, 'tasks/001/tasks.md');
          const doc = readDoc(file);
          doc.data.bouncer.commit_sha = sha.slice(0, 8);
          fs.writeFileSync(file, renderDoc(doc.data, doc.body));
          return { stdout: JSON.stringify({ ok: true, committed: true }), status: 0 };
        },
      },
    });
  } finally {
    process.chdir(previousCwd);
  }
  assert.strictEqual(advanced.ok, true, JSON.stringify(advanced));
  assert.deepStrictEqual(advanced.executed.map((step) => step.action), ['commit']);
  assert.strictEqual(advanced.stop.next.action, 'report', JSON.stringify(advanced.stop.next));
  assert.notStrictEqual(git(worker, ['rev-parse', 'HEAD']), git(integration, ['rev-parse', 'HEAD']));

  const reported = coordinate(reportArgs);
  assert.strictEqual(reported.ok, true, JSON.stringify(reported));
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
  assert.strictEqual(recorded.task.sha, git(worker, ['rev-parse', 'HEAD']));

  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: integration, task: '001',
    deps: { runVerification: passVerification },
  });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
  assert.strictEqual(fs.readFileSync(path.join(integration, 'src/alpha.js'), 'utf8'), 'changed by 001\n');
});
