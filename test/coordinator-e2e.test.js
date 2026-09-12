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
const { coordinate, loadLedger } = require('../scripts/lib/coordinator');
const { readDoc } = require('../scripts/lib/frontmatter');
const { renderDoc } = require('../scripts/lib/render');
const { validateBlueprint } = require('../scripts/lib/validate');
const { finalize } = require('../scripts/lib/finalize');
const { readCoordinatorLedger } = require('../scripts/lib/scope');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');

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
 * @param {object|null} dag - depends_on/parallel_safe/dependency_gate 또는 null
 */
function writeTask(repo, blueprint, id, dag) {
  const dir = path.join(repo, blueprint, 'tasks', id);
  fs.mkdirSync(dir, { recursive: true });
  const fields = dag === null ? '' : [
    `  depends_on: ${JSON.stringify(dag.depends_on || [])}`,
    `  parallel_safe: ${dag.parallel_safe === true}`,
    `  dependency_gate: ${dag.dependency_gate || 'integrated'}`,
    '',
  ].join('\n');
  fs.writeFileSync(
    path.join(dir, 'tasks.md'),
    `---\nbouncer:\n  id: TASKS-${id}\n${fields}---\n# Tasks\n\nbrief ${id}\n`,
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
 * @param {string} sha - worker 커밋 전체 SHA
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
    if (name === 'tasks.md') doc.data.bouncer.commit_sha = sha.slice(0, 8);
    fs.writeFileSync(file, renderDoc(doc.data, doc.body));
  }
}

test('a parallel ready wave commits in worker worktrees and fans in to one integration branch', () => {
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
    const recorded = coordinate({
      command: 'record', repoRoot: repo, blueprint, cwd: workers[id], task: id,
    });
    assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));
    assert.strictEqual(recorded.task.sha, shas[id]);
  }

  for (const id of ['001', '002']) {
    const integrated = coordinate({
      command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: id,
    });
    assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));
    assert.strictEqual(integrated.task.status, 'integrated');
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
  assert.deepStrictEqual(status.ready, []);
  assert.deepStrictEqual(status.tasks.map((task) => task.status), ['integrated', 'integrated']);

  // main worktree는 provenance를 읽히는 자리일 뿐이다: 시작과 끝의 tracked
  // source가 바이트 단위로 같고, 브랜치도 옮겨가지 않는다.
  assert.deepStrictEqual(trackedSourceSnapshot(repo), before);
  assert.strictEqual(sourceStatus(repo), '');
  assert.strictEqual(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']), 'work');
});

test('a rejected fan-in preserves the ledger and resumes without a duplicate cherry-pick', () => {
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
    coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' }).ok,
    true,
  );
  const ledgerFile = path.join(boot.integrationPath, '.bouncer/runtime/coordinator.json');
  const knownHead = loadLedger(ledgerFile).integrationHead;

  // integration worktree가 원장이 모르는 커밋을 얻으면 fan-in은 거절이다.
  fs.writeFileSync(path.join(boot.integrationPath, 'README.md'), 'out of band\n');
  git(boot.integrationPath, ['commit', '-am', 'out of band']);
  const rejected = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.deepStrictEqual(rejected, { ok: false, reason: 'stale-integration-head' });

  // 거절이 원장을 갈아엎지 않아야 재개 지점이 남는다.
  const preserved = loadLedger(ledgerFile);
  assert.strictEqual(preserved.tasks[0].status, 'recorded');
  assert.strictEqual(preserved.tasks[0].sha, workerSha);
  assert.strictEqual(preserved.integrationHead, knownHead);

  // 재개: integration을 원장이 아는 head로 되돌리면 같은 명령이 그대로 통과한다.
  git(boot.integrationPath, ['reset', '--hard', knownHead]);
  const resumed = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.strictEqual(resumed.ok, true, JSON.stringify(resumed));

  // 중복 cherry-pick 방지: 이미 integrated인 task는 다시 fan-in되지 않는다.
  const again = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
  });
  assert.deepStrictEqual(again, { ok: false, reason: 'not-recorded' });
  const subjects = git(boot.integrationPath, ['log', '--format=%s']).split('\n');
  assert.strictEqual(subjects.filter((subject) => subject === 'feat: task 001').length, 1);

  assert.deepStrictEqual(trackedSourceSnapshot(repo), before);
  assert.strictEqual(sourceStatus(repo), '');
});

test('a single task with no DAG frontmatter drives as one sequential wave', () => {
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
  // 필드 부재는 의존 없음·순차·integrated로 읽힌다 — 소급 migration이 없다.
  assert.deepStrictEqual(boot.tasks, [{
    id: '001', depends_on: [], execution_kind: 'commit', dependency_gate: 'integrated', parallel_safe: false, status: 'pending',
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
    coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' }).ok,
    true,
  );
  const integrated = coordinate({
    command: 'integrate', repoRoot: repo, blueprint, cwd: boot.integrationPath, task: '001',
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

test('an uncommitted-plan drive reaches the finalize gate with no open task after integrate', () => {
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
  const recorded = coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' });
  assert.strictEqual(recorded.ok, true, JSON.stringify(recorded));

  const openTasks = () => validateBlueprint({ repoRoot: integrationPath, blueprintDir: blueprint, gate: 'finalize' })
    .failures.filter((f) => f.code === 'G16' && /open tasks remain/.test(f.message));
  // 대조군: integrate 전에는 integration 사본이 scaffold라 열린 task가 보인다.
  assert.strictEqual(openTasks().length, 1);

  const integrated = coordinate({ command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001' });
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

test('release after a drive finalize lets main merge the integration branch without a plan conflict', () => {
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
  // plan 워크플로가 남기는 main 상태: 추적되는 epic index에 커밋하지 않은 새 줄,
  // blueprint 트리는 통째로 untracked.
  fs.appendFileSync(path.join(repo, epicIndex), '- [004-drive](blueprints/004-drive/index.md)\n');
  writePlanDoc(repo, `${blueprint}/index.md`, 'bouncer.blueprint',
    { id: '004', ...ids, status: 'approved', commit_type: 'feat' }, '# Blueprint\n\n## Intent\n- release\n');
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
  assert.strictEqual(coordinate({ command: 'record', repoRoot: repo, blueprint, cwd: worker, task: '001' }).ok, true);
  const integrated = coordinate({ command: 'integrate', repoRoot: repo, blueprint, cwd: integrationPath, task: '001' });
  assert.strictEqual(integrated.ok, true, JSON.stringify(integrated));

  // finalize remainder가 integration에 남기는 상태를 재현한다.
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

  assert.throws(() => git(repo, ['merge', '--no-edit', integrationBranch])); // 대조군: release 전에는 충돌
  const released = coordinate({ command: 'release', repoRoot: repo, blueprint, cwd: repo });
  assert.equal(released.ok, true, JSON.stringify(released));
  assert.ok(released.restored.includes(epicIndex), JSON.stringify(released));
  assert.deepStrictEqual(released.preserved, []);
  git(repo, ['merge', '--no-edit', integrationBranch]); // throw 없이 끝나야 함
  assert.match(fs.readFileSync(path.join(repo, epicIndex), 'utf8'), /blueprints\/004-/); // 새 줄이 병합으로 돌아옴
  assert.match(fs.readFileSync(path.join(repo, blueprint, 'index.md'), 'utf8'), /status: closed/);
  assert.strictEqual(fs.existsSync(path.join(repo, blueprint, 'tasks')), false);
  assert.strictEqual(sourceStatus(repo), '');
});
