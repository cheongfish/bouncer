'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const timers = require('node:timers');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const skillDir = path.join(root, 'skills', 'agentic-code-benchmark');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const TITLES = [
  'Correctness & spec fidelity',
  'Scope discipline',
  'Test quality',
  'Codebase fit',
  'Maintainability & clarity',
];

test('agentic-code-benchmark frontmatter and shipped files', () => {
  const { data } = parseFrontmatter(read('skills/agentic-code-benchmark/SKILL.md'));
  assert.strictEqual(data.name, 'agentic-code-benchmark');
  assert.doesNotMatch(String(data.description), /explicitly asks/i);
  for (const rel of [
    'NOTICE.md',
    'references/rubric.md',
    'references/task-suite.md',
    'scripts/collect_metrics.py',
    'scripts/run_deepswe.py',
    'scripts/scorecard.py',
  ]) {
    assert.ok(
      fs.existsSync(path.join(skillDir, rel)),
      `missing ${rel}`,
    );
  }
});

test('agentic-code-benchmark rubric titles match scorecard DIMENSIONS display strings', () => {
  const rubric = read('skills/agentic-code-benchmark/references/rubric.md');
  const headings = [...rubric.matchAll(/^## \d+\.\s*(.+)$/gm)].map((m) => m[1].trim());
  assert.deepStrictEqual(headings, TITLES);
  const card = read('skills/agentic-code-benchmark/scripts/scorecard.py');
  for (const t of TITLES) assert.ok(card.includes(t), t);
});

test('agentic-code-benchmark keeps no-evidence=0, blocking_findings, and 40/60', () => {
  const rubric = read('skills/agentic-code-benchmark/references/rubric.md');
  assert.match(rubric, /scored\s+without evidence is scored 0/i);
  assert.match(rubric, /blocking_findings/);
  const skill = read('skills/agentic-code-benchmark/SKILL.md');
  const card = read('skills/agentic-code-benchmark/scripts/scorecard.py');
  for (const src of [skill, card]) assert.match(src, /\b40\b[\s\S]{0,80}\b60\b/);
});

test('agentic-code-benchmark NOTICE provenance and no bouncer CLI wiring', () => {
  const skill = read('skills/agentic-code-benchmark/SKILL.md');
  assert.match(skill, /NOTICE\.md/);
  assert.doesNotMatch(skill, /BOUNCER_ROOT/);
  assert.doesNotMatch(skill, /scripts\/bouncer/);
  const notice = read('skills/agentic-code-benchmark/NOTICE.md');
  assert.match(notice, /Apache/);
  assert.match(notice, /awesome-claude-skills/);
});

test('agentic-code-benchmark sits outside ARCHITECTURE §4 table but in prose; README notes python3', () => {
  const gov = read('docs/ARCHITECTURE.md');
  assert.doesNotMatch(gov, /^\| `agentic-code-benchmark` \|/m);
  assert.match(gov, /`agentic-code-benchmark`/);
  assert.match(read('README.md'), /python3/);
});

const COLLECT_METRICS = path.join(skillDir, 'scripts', 'collect_metrics.py');

function collectMetrics(repo, extraArgs = []) {
  return spawnSync(
    'python3',
    [COLLECT_METRICS, '--repo', repo, '--base', 'HEAD', '--head', 'WORKTREE', ...extraArgs],
    { encoding: 'utf8' },
  );
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('collect_metrics.py treats .git file and directory as repos and rejects a missing .git', () => {
  const gitFileRepo = tmpDir('acb-git-file-');
  const gitDirRepo = tmpDir('acb-git-dir-');
  const noGit = tmpDir('acb-no-git-');
  try {
    fs.writeFileSync(path.join(gitFileRepo, '.git'), 'gitdir: /nonexistent\n');
    fs.mkdirSync(path.join(gitDirRepo, '.git'));

    const fileRun = collectMetrics(gitFileRepo);
    assert.strictEqual(fileRun.status, 0, fileRun.stderr);
    assert.doesNotMatch(fileRun.stderr, /is not a git repository/);
    const fileMetrics = JSON.parse(fileRun.stdout);
    assert.strictEqual(fileMetrics.schema, 'agentic-code-benchmark/metrics/1');
    assert.ok(Object.prototype.hasOwnProperty.call(fileMetrics, 'head_sha'));
    assert.ok(Object.prototype.hasOwnProperty.call(fileMetrics, 'rework'));

    const dirRun = collectMetrics(gitDirRepo);
    assert.strictEqual(dirRun.status, 0, dirRun.stderr);
    assert.doesNotMatch(dirRun.stderr, /is not a git repository/);
    assert.strictEqual(JSON.parse(dirRun.stdout).schema, 'agentic-code-benchmark/metrics/1');

    const missing = collectMetrics(noGit);
    assert.strictEqual(missing.status, 2);
    assert.match(missing.stderr, /is not a git repository/);
  } finally {
    fs.rmSync(gitFileRepo, { recursive: true, force: true });
    fs.rmSync(gitDirRepo, { recursive: true, force: true });
    fs.rmSync(noGit, { recursive: true, force: true });
  }
});

test('collect_metrics.py records only supplied usage flags and omits the key otherwise', () => {
  const repo = tmpDir('acb-usage-');
  try {
    fs.mkdirSync(path.join(repo, '.git'));

    const withFlags = collectMetrics(repo, ['--tokens-in', '1200', '--wall-s', '300']);
    assert.strictEqual(withFlags.status, 0, withFlags.stderr);
    const withUsage = JSON.parse(withFlags.stdout);
    assert.strictEqual(withUsage.schema, 'agentic-code-benchmark/metrics/1');
    assert.strictEqual(withUsage.usage.tokens_in, 1200);
    assert.strictEqual(withUsage.usage.wall_s, 300);
    assert.ok(!Object.prototype.hasOwnProperty.call(withUsage.usage, 'tool_calls'));
    assert.ok(!Object.prototype.hasOwnProperty.call(withUsage.usage, 'tokens_out'));

    const noFlags = collectMetrics(repo);
    assert.strictEqual(noFlags.status, 0, noFlags.stderr);
    const withoutUsage = JSON.parse(noFlags.stdout);
    assert.ok(!Object.prototype.hasOwnProperty.call(withoutUsage, 'usage'));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

const RUN_DEEPSWE = path.join(skillDir, 'scripts', 'run_deepswe.py');
const PYTHON = '/usr/bin/env';
const REAL_GIT = spawnSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();

function writeStub(dir, name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, { mode: 0o755 });
  fs.chmodSync(file, 0o755);
  return file;
}

// deep-swe 클론은 네트워크를 타므로, 테스트는 `git clone`만 가로채는 스텁을 PATH 앞에 둔다.
// clone 외 서브커맨드는 실제 git으로 넘겨 러너의 다른 git 사용을 막지 않는다.
// cloneFixtures: 스위트가 태스크 디렉터리에 함께 실어 보내는 산출물 모양 파일들.
// 러너가 이걸 자기 실행 결과로 오인하지 않는지 고정하는 데 쓴다.
function makeStubs({ pier, cloneFixtures = false }) {
  const dir = tmpDir('acb-stub-bin-');
  writeStub(dir, 'git', [
    '#!/bin/sh',
    'if [ "$1" = "clone" ]; then',
    '  for a in "$@"; do dest="$a"; done',
    '  mkdir -p "$dest/tasks/demo-task" || exit 1',
    ...(cloneFixtures ? [
      '  echo \'{"task_id": "demo-task", "reward": 1}\' > "$dest/tasks/demo-task/reward.json"',
      '  echo "gold diff" > "$dest/tasks/demo-task/gold.patch"',
    ] : []),
    '  exit 0',
    'fi',
    `exec ${REAL_GIT} "$@"`,
    '',
  ].join('\n'));
  writeStub(dir, 'docker', '#!/bin/sh\nexit 0\n');
  if (pier) writeStub(dir, 'pier', pier);
  return dir;
}

// 저장소 루트 판정은 `.git` 존재만 본다. 실제 저장소 안에 작업 경로를 만들지 않도록
// 임시 디렉터리를 가짜 루트로 세운다.
function fakeRepoRoot() {
  const root = tmpDir('acb-repo-');
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function runnerArgs(runId, extra = []) {
  return [RUN_DEEPSWE, '--run-id', runId, '--arm', 'vanilla', '--agent', 'claude', ...extra];
}

function runRunner(root, binDir, args) {
  return spawnSync(PYTHON, ['python3', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${binDir}:/usr/bin:/bin` },
  });
}

function workPath(root, runId) {
  return path.join(root, '.benchmarks', 'deepswe', runId);
}

test('run_deepswe.py refuses before cloning when pier is missing from PATH', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({ pier: null });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-nopier'));
    assert.notStrictEqual(run.status, 0);
    assert.match(run.stderr, /pier/i);
    assert.ok(!fs.existsSync(workPath(root, 'r-nopier')), 'work path must not be created');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py rejects --task together with --n-tasks', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({ pier: '#!/bin/sh\nexit 0\n' });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-conflict', ['--task', 'demo-task', '--n-tasks', '10']));
    assert.notStrictEqual(run.status, 0);
    assert.ok(!fs.existsSync(workPath(root, 'r-conflict')), 'work path must not be created');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py exits non-zero and removes the work path when pier fails', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({ pier: '#!/bin/sh\necho boom >&2\nexit 3\n' });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-pierfail'));
    assert.notStrictEqual(run.status, 0);
    assert.ok(!fs.existsSync(workPath(root, 'r-pierfail')), 'work path must be removed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py never mistakes suite fixtures inside the clone for its own artifacts', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({ pier: '#!/bin/sh\nexit 0\n', cloneFixtures: true });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-fixture'));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = path.join(root, 'docs', 'benchmark', 'deepswe', 'results', 'r-fixture');
    assert.ok(fs.existsSync(path.join(results, 'run.log')), 'run.log must land in the results path');
    // 클론이 실어 온 reward.json이 이 런의 보상으로 옮겨지면 거짓 수용이 된다.
    assert.ok(!fs.existsSync(path.join(results, 'reward.json')), 'clone fixture must not be moved into results');
    // 스위트 gold 패치가 잡히면 "패치 여러 개"로 metrics.json이 통째로 건너뛰어진다.
    assert.doesNotMatch(run.stderr, /patches found/);
    assert.match(run.stderr, /no patch left by pier/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

// 종료 코드를 128+signum으로 못박는다. 그래야 러너의 signal 핸들러가 실제로
// 걸렸는지 확인된다 — try/finally만으로도 SIGINT는 KeyboardInterrupt로 정리되지만,
// SIGTERM은 기본 처리로 프로세스가 즉사해 finally가 아예 돌지 않는다.
async function interruptRunner(runId, signalName) {
  const root = fakeRepoRoot();
  const started = path.join(root, 'pier-started');
  const binDir = makeStubs({
    pier: `#!/bin/sh\n: > ${started}\nsleep 30\n`,
  });
  const child = spawn(PYTHON, ['python3', ...runnerArgs(runId)], {
    cwd: root,
    env: { ...process.env, PATH: `${binDir}:/usr/bin:/bin` },
    stdio: 'ignore',
  });
  try {
    const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
    const deadline = Date.now() + 20000;
    while (!fs.existsSync(started) && Date.now() < deadline) {
      await new Promise((resolve) => timers.setTimeout(resolve, 50));
    }
    assert.ok(fs.existsSync(started), 'stub pier never started');
    child.kill(signalName);
    const end = await exited;
    assert.strictEqual(
      end.code,
      128 + os.constants.signals[signalName],
      `${signalName} must exit through the runner's handler (got code=${end.code} signal=${end.signal})`,
    );
    assert.ok(!fs.existsSync(workPath(root, runId)), `work path must be removed on ${signalName}`);
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
}

test('run_deepswe.py removes the work path when interrupted with SIGINT', async () => {
  await interruptRunner('r-sigint', 'SIGINT');
});

test('run_deepswe.py removes the work path when terminated with SIGTERM', async () => {
  await interruptRunner('r-sigterm', 'SIGTERM');
});
