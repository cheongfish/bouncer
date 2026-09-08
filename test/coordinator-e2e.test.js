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
    'bouncer/010-001-integration',
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
    id: '001', depends_on: [], dependency_gate: 'integrated', parallel_safe: false, status: 'pending',
  }]);

  const prepared = coordinate({
    command: 'prepare', repoRoot: repo, blueprint, cwd: boot.integrationPath,
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  assert.deepStrictEqual(prepared.ready, ['001']);
  assert.strictEqual(prepared.tasks.length, 1);

  const worker = prepared.tasks[0].workerPath;
  commitInWorker(worker, 'src/alpha.js', 'changed by 001\n', 'feat: task 001');
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
