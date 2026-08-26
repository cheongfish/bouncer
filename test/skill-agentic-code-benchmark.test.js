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
    'scripts/bridge_pier.py',
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

// 태스크 프로젝트 픽스처. 호스트 `.git`이 없을 때 러너가 task.toml의
// repository_url·base_commit_hash로 복원하는 경로를 단위 테스트에서 닫기 위해,
// GitHub를 치지 않는 로컬 저장소와 SHA를 만든다.
function makeTaskProject() {
  const dir = tmpDir('acb-task-project-');
  const git = (args) => spawnSync(REAL_GIT, args, { cwd: dir, encoding: 'utf8' });
  git(['init']);
  git(['config', 'user.email', 't@t']);
  git(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(dir, 'file.txt'), 'base\n');
  git(['add', 'file.txt']);
  git(['commit', '-m', 'init']);
  const sha = git(['rev-parse', 'HEAD']).stdout.trim();
  return { dir, sha };
}

// deep-swe 클론은 네트워크를 타므로, 테스트는 그 URL의 `git clone`만 가로채는
// 스텁을 PATH 앞에 둔다. 태스크 프로젝트 복원은 실제 git이 로컬
// repository_url을 clone/fetch해야 하므로, 그 호출은 가로채지 않는다.
// cloneFixtures: 스위트가 태스크 디렉터리에 함께 실어 보내는 산출물 모양 파일들.
// taskProject: 클론 안 demo-task/task.toml에 로컬 프로젝트 URL·SHA를 심는다.
function makeStubs({ pier, cloneFixtures = false, taskProject = null, extra = null }) {
  const dir = tmpDir('acb-stub-bin-');
  writeStub(dir, 'git', [
    '#!/bin/sh',
    'if [ "$1" = "clone" ]; then',
    '  case "$*" in',
    '  *datacurve-ai/deep-swe*)',
    '    for a in "$@"; do dest="$a"; done',
    '    mkdir -p "$dest/tasks/demo-task" || exit 1',
    ...(cloneFixtures ? [
      '    echo \'{"task_id": "demo-task", "reward": 1}\' > "$dest/tasks/demo-task/reward.json"',
      '    echo "gold diff" > "$dest/tasks/demo-task/gold.patch"',
    ] : []),
    ...(taskProject ? [
      '    cat > "$dest/tasks/demo-task/task.toml" << \'EOF\'',
      '[metadata]',
      `repository_url = "${taskProject.dir}"`,
      `base_commit_hash = "${taskProject.sha}"`,
      'EOF',
    ] : []),
    '    exit 0',
    '  ;;',
    '  esac',
    'fi',
    `exec ${REAL_GIT} "$@"`,
    '',
  ].join('\n'));
  writeStub(dir, 'docker', '#!/bin/sh\nexit 0\n');
  if (pier) writeStub(dir, 'pier', pier);
  // extra: arm 스텁(bouncer CLI, 비교 플러그인 바이너리). PATH 앞단에만 둔다.
  if (extra) {
    for (const [name, body] of Object.entries(extra)) {
      writeStub(dir, name, body);
    }
  }
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

// Pier가 작업 경로에 태스크 단위를 남기는 스텁. 한 벌은 reward.json + 패치 +
// git 커밋이 있는 워크스페이스다. 디렉터리 이름은 태스크 id가 아니다 — 러너가
// 산출물에서 id를 유도해야 한다.
function pierLeavesUnits(units) {
  const APPLYABLE_PATCH = [
    'diff --git a/added.txt b/added.txt',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/added.txt',
    '@@ -0,0 +1 @@',
    '+hello',
    '',
  ].join('\n');
  const lines = ['#!/bin/sh', 'set -e'];
  for (const unit of units) {
    lines.push(`mkdir -p "${unit.dir}/ws"`);
    if (unit.reward !== false) {
      const payload = unit.reward != null
        ? unit.reward
        : JSON.stringify({ task_id: unit.taskId, reward: 1 });
      lines.push(`cat > "${unit.dir}/reward.json" << 'EOF'\n${payload}\nEOF`);
    }
    if (unit.extraFiles) {
      for (const [name, body] of Object.entries(unit.extraFiles)) {
        lines.push(`cat > "${unit.dir}/${name}" << 'EOF'\n${body}\nEOF`);
      }
    }
    if (unit.patch !== false) {
      lines.push(`cat > "${unit.dir}/model_patch.diff" << 'EOF'\n${APPLYABLE_PATCH}EOF`);
    }
    // workspace: false 는 Pier가 패치만 남기고 호스트에 `.git` 체크아웃을
    // 안 남긴 2026-08-25 실패 형태. git init을 빼야 그 구멍을 재현한다.
    if (unit.workspace !== false) {
      lines.push(`git -C "${unit.dir}/ws" init`);
      lines.push(`git -C "${unit.dir}/ws" config user.email t@t`);
      lines.push(`git -C "${unit.dir}/ws" config user.name t`);
      lines.push(`echo base > "${unit.dir}/ws/file.txt"`);
      lines.push(`git -C "${unit.dir}/ws" add file.txt`);
      lines.push(`git -C "${unit.dir}/ws" commit -m init`);
    }
  }
  lines.push('exit 0', '');
  return lines.join('\n');
}

function resultsPath(root, runId) {
  return path.join(root, 'docs', 'benchmark', 'deepswe', 'results', runId);
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
    assert.match(run.stderr, /datacurve-pier/);
    assert.doesNotMatch(run.stderr, /pier-cli/);
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
    // 클론 픽스처가 태스크 단위로 잡히면 새 레이아웃에도 거짓 수용이 된다.
    assert.ok(!fs.existsSync(path.join(results, 'tasks')), 'clone fixture must not become a task unit');
    assert.match(run.stderr, /no patch left by pier/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py writes metrics.json from a restored task project when Pier left no workspace .git', () => {
  const root = fakeRepoRoot();
  const project = makeTaskProject();
  const binDir = makeStubs({
    pier: pierLeavesUnits([{ dir: 'unit-one', taskId: 'demo-task', workspace: false }]),
    taskProject: project,
  });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-no-host-git'));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = resultsPath(root, 'r-no-host-git');
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'metrics.json')));
    assert.doesNotMatch(run.stderr, /pier left no host-side workspace checkout/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
    fs.rmSync(project.dir, { recursive: true, force: true });
  }
});

test('run_deepswe.py still skips metrics.json when Pier left reward.json but no patch', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({
    pier: pierLeavesUnits([{ dir: 'unit-one', taskId: 'demo-task', patch: false }]),
  });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-no-patch'));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = resultsPath(root, 'r-no-patch');
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'reward.json')));
    assert.ok(!fs.existsSync(path.join(results, 'tasks', 'demo-task', 'metrics.json')));
    assert.match(run.stderr, /no patch left by pier/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py writes one measured bundle per task directory Pier left', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({
    pier: pierLeavesUnits([
      { dir: 'unit-a', taskId: 'demo-a' },
      { dir: 'unit-b', taskId: 'demo-b' },
    ]),
  });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-multi'));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = resultsPath(root, 'r-multi');
    assert.ok(fs.existsSync(path.join(results, 'run.log')));
    for (const id of ['demo-a', 'demo-b']) {
      assert.ok(fs.existsSync(path.join(results, 'tasks', id, 'reward.json')));
      assert.ok(fs.existsSync(path.join(results, 'tasks', id, 'metrics.json')));
    }
    assert.doesNotMatch(run.stderr, /covers one task only/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py uses the tasks/<task-id>/ layout for a single-task run', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({
    pier: pierLeavesUnits([{ dir: 'unit-one', taskId: 'demo-task' }]),
  });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-single', ['--task', 'demo-task']));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = resultsPath(root, 'r-single');
    assert.ok(fs.existsSync(path.join(results, 'run.log')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'reward.json')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'metrics.json')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py drops a unit with no task id and keeps the rest', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({
    pier: pierLeavesUnits([
      { dir: 'unit-keep', taskId: 'demo-task' },
      {
        dir: 'unit-drop',
        reward: JSON.stringify({ reward: 1 }),
        extraFiles: {
          'ctrf.json': '{"results":{}}',
          'test-stdout.txt': 'orphan stdout',
        },
      },
    ]),
  });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-orphan'));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = resultsPath(root, 'r-orphan');
    assert.ok(fs.existsSync(path.join(results, 'run.log')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'reward.json')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'metrics.json')));
    assert.ok(!fs.existsSync(path.join(results, 'tasks', 'unit-drop')));
    assert.ok(!fs.existsSync(path.join(results, 'reward.json')));
    assert.ok(!fs.existsSync(path.join(results, 'ctrf.json')));
    assert.ok(!fs.existsSync(path.join(results, 'test-stdout.txt')));
    assert.ok(!fs.existsSync(path.join(results, 'metrics.json')));
    const listed = fs.existsSync(path.join(results, 'tasks'))
      ? fs.readdirSync(path.join(results, 'tasks'))
      : [];
    assert.deepStrictEqual(listed, ['demo-task']);
    assert.match(run.stderr, /task id unresolved/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

test('run_deepswe.py treats a path-escaping task id as unresolved and writes nothing outside results', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({
    pier: pierLeavesUnits([
      { dir: 'unit-keep', taskId: 'demo-task' },
      { dir: 'unit-escape', taskId: '../escape' },
    ]),
  });
  try {
    const run = runRunner(root, binDir, runnerArgs('r-escape'));
    assert.strictEqual(run.status, 0, run.stderr);
    const results = resultsPath(root, 'r-escape');
    assert.ok(fs.existsSync(path.join(results, 'run.log')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'reward.json')));
    assert.ok(fs.existsSync(path.join(results, 'tasks', 'demo-task', 'metrics.json')));
    assert.ok(!fs.existsSync(path.join(results, 'tasks', '..', 'escape')));
    assert.ok(!fs.existsSync(path.join(root, 'docs', 'benchmark', 'deepswe', 'results', 'escape')));
    assert.ok(!fs.existsSync(path.join(root, 'docs', 'benchmark', 'deepswe', 'escape')));
    assert.ok(!fs.existsSync(path.join(root, 'escape')));
    const listed = fs.readdirSync(path.join(results, 'tasks'));
    assert.deepStrictEqual(listed, ['demo-task']);
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

// 비교 arm 이름은 제품 표면에 이어 붙이면 public-name-regression이 잡는다.
// 테스트 소스에는 조각을 나눠 두고, 러너에 넘길 때만 합친다.
const PLUGIN_ARM = ['super', 'powers'].join('');

function tracingPier(inner, traceDir) {
  const argvFile = path.join(traceDir, 'pier.argv');
  const markerFile = path.join(traceDir, 'pier.workspace');
  const body = String(inner).replace(/^#!\/bin\/sh\n/, '');
  return [
    '#!/bin/sh',
    'set -e',
    `printf '%s\\n' "$@" > '${argvFile}'`,
    `if [ -d .bouncer ]; then echo present > '${markerFile}'; else echo absent > '${markerFile}'; fi`,
    body,
  ].join('\n');
}

function bouncerCliStub(traceFile) {
  // argv만 기록하고 항상 0이던 스텁은 `current --set`의 plan 게이트를 숨긴다.
  // 실제 CLI를 이어서 돌려, scaffold-only 문서면 --set이 비영이 되게 한다.
  const cli = path.join(root, 'scripts', 'bouncer');
  return [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> '${traceFile}'`,
    `exec '${process.execPath}' '${cli}' "$@"`,
    '',
  ].join('\n');
}

test('run_deepswe.py --help does not describe --arm as a label only', () => {
  const run = spawnSync('python3', [RUN_DEEPSWE, '--help'], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  const text = `${run.stdout}\n${run.stderr}`;
  assert.doesNotMatch(text, /label only/i);
  assert.match(text, /--arm/);
});

function agentEnvValues(argv) {
  const values = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ae' || argv[i] === '--agent-env') {
      values.push(argv[i + 1] || '');
    }
  }
  return values;
}

test('run_deepswe.py --arm splits pier argv and workspace files per arm', () => {
  const pluginBin = PLUGIN_ARM;
  const cases = [
    { arm: 'vanilla', runId: 'r-arm-vanilla', wantBouncerDir: 'absent', wantPluginEnv: false, extra: {} },
    {
      arm: pluginBin,
      runId: 'r-arm-plugin',
      wantBouncerDir: 'absent',
      wantPluginEnv: true,
      extra: { [pluginBin]: '#!/bin/sh\nexit 0\n' },
    },
    {
      arm: 'bouncer',
      runId: 'r-arm-cycle',
      wantBouncerDir: 'present',
      wantPluginEnv: false,
      extra: {},
    },
  ];

  for (const scenario of cases) {
    const root = fakeRepoRoot();
    const bouncerTrace = path.join(root, 'bouncer.argv');
    const extra = { ...scenario.extra };
    if (scenario.arm === 'bouncer') {
      extra.bouncer = bouncerCliStub(bouncerTrace);
    }
    const binDir = makeStubs({
      pier: tracingPier(pierLeavesUnits([{ dir: 'unit-one', taskId: 'demo-task' }]), root),
      extra,
    });
    try {
      const args = [RUN_DEEPSWE, '--run-id', scenario.runId, '--arm', scenario.arm, '--agent', 'claude'];
      const run = runRunner(root, binDir, args);
      assert.strictEqual(run.status, 0, `${scenario.arm}: ${run.stderr}`);
      const marker = fs.readFileSync(path.join(root, 'pier.workspace'), 'utf8').trim();
      assert.strictEqual(marker, scenario.wantBouncerDir, `${scenario.arm} .bouncer at pier run`);
      const argv = fs.readFileSync(path.join(root, 'pier.argv'), 'utf8').split('\n').filter(Boolean);
      assert.strictEqual(argv[0], 'run');
      assert.ok(argv.includes('--agent'));
      assert.doesNotMatch(argv.join(' '), /--no-verify/);
      const pluginEnvs = agentEnvValues(argv).filter((v) => v.includes(pluginBin));
      if (scenario.wantPluginEnv) {
        assert.ok(pluginEnvs.length > 0, `${scenario.arm} must pass that plugin via pier --ae`);
      } else {
        assert.deepStrictEqual(pluginEnvs, [], `${scenario.arm} must not pass the comparison plugin via --ae`);
      }
      if (scenario.arm === 'bouncer') {
        const cli = fs.readFileSync(bouncerTrace, 'utf8');
        assert.match(cli, /\binit\b/);
        assert.match(cli, /scaffold/);
        assert.match(cli, /current --set/);
      } else {
        assert.ok(!fs.existsSync(bouncerTrace), `${scenario.arm} must not invoke bouncer CLI`);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  }
});

test('run_deepswe.py refuses the comparison plugin arm when it is missing from the host', () => {
  const root = fakeRepoRoot();
  const binDir = makeStubs({
    pier: tracingPier(pierLeavesUnits([{ dir: 'unit-one', taskId: 'demo-task' }]), root),
  });
  try {
    const args = runnerArgs('r-plugin-missing').map((arg) => (arg === 'vanilla' ? PLUGIN_ARM : arg));
    const run = runRunner(root, binDir, args);
    assert.notStrictEqual(run.status, 0);
    assert.match(run.stderr, /not found/i);
    assert.ok(!run.stdout.trim(), 'must not print a results path');
    assert.ok(!fs.existsSync(resultsPath(root, 'r-plugin-missing')));
    assert.ok(!fs.existsSync(workPath(root, 'r-plugin-missing')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});

const BRIDGE_PIER = path.join(skillDir, 'scripts', 'bridge_pier.py');
const SCORECARD = path.join(skillDir, 'scripts', 'scorecard.py');

function bridge(args) {
  return spawnSync('python3', [BRIDGE_PIER, ...args], { encoding: 'utf8' });
}

function writeJson(dir, name, payload) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
  return file;
}

// collect_metrics.py가 실제로 내는 모양 그대로. 병합이 최상위 키를 하나도
// 떨어뜨리지 않는지 보려면 선택 키(usage)까지 들어 있어야 한다.
function metricsFixture(overrides = {}) {
  return {
    schema: 'agentic-code-benchmark/metrics/1',
    label: 'r-bridge',
    task_id: 'demo-task',
    repo: '/tmp/demo',
    base: 'HEAD~1',
    head: 'WORKTREE',
    head_sha: 'abc1234',
    checks: {
      tests: { name: 'tests', ran: true, passed: true, cmd: 'npm test' },
      lint: { name: 'lint', ran: false, passed: null, cmd: null },
      typecheck: { name: 'typecheck', ran: false, passed: null, cmd: null },
      build: { name: 'build', ran: false, passed: null, cmd: null },
    },
    coverage: { before: null, after: null, delta: null },
    diff: {
      files_changed: 2,
      source_files: 1,
      test_files: 1,
      lines_added: 40,
      lines_deleted: 3,
      test_lines_added: 20,
      test_line_share: 0.5,
      paths: ['src/a.py', 'test/a_test.py'],
    },
    rework: { commits: 1, gross_lines: 43, net_lines: 43, churn_ratio: 1.0 },
    usage: { tokens_in: 1200 },
    ...overrides,
  };
}

test('bridge_pier.py merges the pier verdict without dropping any metrics key', () => {
  const dir = tmpDir('acb-bridge-ok-');
  try {
    const metrics = metricsFixture();
    const metricsPath = writeJson(dir, 'metrics.json', metrics);
    const rewardPath = writeJson(dir, 'reward.json', {
      task_id: 'demo-task',
      passed: true,
      reward: 1.0,
    });
    const out = path.join(dir, 'merged.json');

    const run = bridge(['--metrics', metricsPath, '--reward', rewardPath, '--arm', 'bouncer', '--out', out]);
    assert.strictEqual(run.status, 0, run.stderr);

    const merged = JSON.parse(fs.readFileSync(out, 'utf8'));
    for (const key of Object.keys(metrics)) {
      assert.deepStrictEqual(merged[key], metrics[key], `key ${key} must survive the merge`);
    }
    assert.strictEqual(merged.schema, 'agentic-code-benchmark/metrics/1');
    assert.deepStrictEqual(merged.verdict, {
      source: 'pier',
      task_id: 'demo-task',
      arm: 'bouncer',
      passed: true,
      reward: 1.0,
    });
    // --ctrf 없이 부른 호출은 pass_fraction을 지어내지 않는다.
    assert.ok(!Object.prototype.hasOwnProperty.call(merged.verdict, 'pass_fraction'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bridge_pier.py carries a failing reward through to verdict.passed', () => {
  const dir = tmpDir('acb-bridge-fail-');
  try {
    const metricsPath = writeJson(dir, 'metrics.json', metricsFixture());
    const rewardPath = writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: false, reward: 0 });
    const out = path.join(dir, 'merged.json');

    const run = bridge(['--metrics', metricsPath, '--reward', rewardPath, '--arm', 'vanilla', '--out', out]);
    assert.strictEqual(run.status, 0, run.stderr);

    const merged = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.strictEqual(merged.verdict.passed, false);
    assert.strictEqual(merged.verdict.reward, 0);
    assert.strictEqual(merged.verdict.arm, 'vanilla');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bridge_pier.py infers passed from the reward sign when no pass flag is present', () => {
  // 판정 다섯 필드 가운데 passed만 유일하게 유도된 값이다. 나머지는 그대로 옮겨
  // 적으므로 여기가 어긋나면 아무 테스트도 잡지 못한다.
  const cases = [
    { reward: 1, expected: true },
    { reward: 0, expected: false },
    { reward: -0.5, expected: false },
  ];
  for (const scenario of cases) {
    const dir = tmpDir('acb-bridge-infer-');
    try {
      const metricsPath = writeJson(dir, 'metrics.json', metricsFixture());
      const rewardPath = writeJson(dir, 'reward.json', { task_id: 'demo-task', reward: scenario.reward });
      const out = path.join(dir, 'merged.json');
      const run = bridge(['--metrics', metricsPath, '--reward', rewardPath, '--arm', 'vanilla', '--out', out]);
      assert.strictEqual(run.status, 0, run.stderr);
      const verdict = JSON.parse(fs.readFileSync(out, 'utf8')).verdict;
      assert.strictEqual(verdict.passed, scenario.expected, `reward ${scenario.reward}`);
      assert.strictEqual(verdict.reward, scenario.reward);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('bridge_pier.py never reads reward or pass flags out of a nested object', () => {
  // 태스크 id는 한 겹 아래까지 본다(잘못 집으면 불일치로 거부되니 안전하게 실패).
  // 판정 값은 잘못 집으면 그대로 기록되므로 최상위만 본다.
  const dir = tmpDir('acb-bridge-nested-');
  try {
    const metricsPath = writeJson(dir, 'metrics.json', metricsFixture());
    const rewardPath = writeJson(dir, 'reward.json', {
      report: { task_id: 'demo-task' },
      metadata: { score: 3 },
      tests: { success: true },
    });
    const out = path.join(dir, 'merged.json');
    const run = bridge(['--metrics', metricsPath, '--reward', rewardPath, '--arm', 'vanilla', '--out', out]);
    // 최상위에 숫자 보상이 없으므로 지어내지 않고 거부한다.
    assert.notStrictEqual(run.status, 0, run.stderr);
    assert.ok(!fs.existsSync(out));

    // 같은 문서에 최상위 보상만 더하면, 통과 플래그는 여전히 중첩에서 오지 않고
    // 보상 부호로 유도된다.
    const topLevel = writeJson(dir, 'reward-top.json', {
      report: { task_id: 'demo-task' },
      tests: { success: true },
      reward: 0,
    });
    const out2 = path.join(dir, 'merged2.json');
    const run2 = bridge(['--metrics', metricsPath, '--reward', topLevel, '--arm', 'vanilla', '--out', out2]);
    assert.strictEqual(run2.status, 0, run2.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(out2, 'utf8')).verdict.passed, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bridge_pier.py adds pass_fraction only when --ctrf carries a readable summary', () => {
  const dir = tmpDir('acb-bridge-ctrf-');
  try {
    const metricsPath = writeJson(dir, 'metrics.json', metricsFixture());
    const rewardPath = writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 });
    const ctrfPath = writeJson(dir, 'ctrf.json', {
      results: { summary: { tests: 8, passed: 6, failed: 2 } },
    });
    const readable = path.join(dir, 'with-ctrf.json');
    const withCtrf = bridge([
      '--metrics', metricsPath, '--reward', rewardPath, '--arm', 'vanilla',
      '--ctrf', ctrfPath, '--out', readable,
    ]);
    assert.strictEqual(withCtrf.status, 0, withCtrf.stderr);
    assert.strictEqual(JSON.parse(fs.readFileSync(readable, 'utf8')).verdict.pass_fraction, 0.75);

    // 읽지 못한 ctrf는 0이 아니라 키 부재로 남는다.
    const brokenCtrf = writeJson(dir, 'broken-ctrf.json', '{ not json');
    const unreadable = path.join(dir, 'broken-ctrf-out.json');
    const withBroken = bridge([
      '--metrics', metricsPath, '--reward', rewardPath, '--arm', 'vanilla',
      '--ctrf', brokenCtrf, '--out', unreadable,
    ]);
    assert.strictEqual(withBroken.status, 0, withBroken.stderr);
    const verdict = JSON.parse(fs.readFileSync(unreadable, 'utf8')).verdict;
    assert.ok(!Object.prototype.hasOwnProperty.call(verdict, 'pass_fraction'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('bridge_pier.py refuses bad inputs and never leaves a partial --out', () => {
  const cases = [
    {
      name: 'reward file missing',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', metricsFixture()),
        reward: path.join(dir, 'absent-reward.json'),
      }),
    },
    {
      name: 'reward file unparseable',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', metricsFixture()),
        reward: writeJson(dir, 'reward.json', '{ broken'),
      }),
    },
    {
      name: 'task id mismatch',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', metricsFixture()),
        reward: writeJson(dir, 'reward.json', { task_id: 'other-task', passed: true, reward: 1 }),
      }),
    },
    {
      name: 'metrics task_id is null',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', metricsFixture({ task_id: null })),
        reward: writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 }),
      }),
    },
    {
      name: 'metrics schema mismatch',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', metricsFixture({ schema: 'agentic-code-benchmark/metrics/2' })),
        reward: writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 }),
      }),
    },
    {
      name: 'metrics file missing',
      setup: (dir) => ({
        metrics: path.join(dir, 'absent-metrics.json'),
        reward: writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 }),
      }),
    },
    {
      name: 'metrics file unparseable',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', '{ broken'),
        reward: writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 }),
      }),
    },
    {
      name: 'reward carries no numeric reward',
      setup: (dir) => ({
        metrics: writeJson(dir, 'metrics.json', metricsFixture()),
        reward: writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true }),
      }),
    },
    {
      name: 'out path already taken',
      setup: (dir) => {
        fs.writeFileSync(path.join(dir, 'merged.json'), 'existing\n');
        return {
          metrics: writeJson(dir, 'metrics.json', metricsFixture()),
          reward: writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 }),
          keepOut: true,
        };
      },
    },
  ];

  for (const scenario of cases) {
    const dir = tmpDir('acb-bridge-reject-');
    try {
      const { metrics, reward, keepOut } = scenario.setup(dir);
      const out = path.join(dir, 'merged.json');
      const run = bridge(['--metrics', metrics, '--reward', reward, '--arm', 'vanilla', '--out', out]);
      assert.notStrictEqual(run.status, 0, `${scenario.name}: must exit non-zero`);
      if (keepOut) {
        assert.strictEqual(fs.readFileSync(out, 'utf8'), 'existing\n', `${scenario.name}: must not overwrite`);
      } else {
        assert.ok(!fs.existsSync(out), `${scenario.name}: --out must not be created`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('bridge_pier.py output scores through an unmodified scorecard.py', () => {
  const dir = tmpDir('acb-bridge-score-');
  try {
    const metricsPath = writeJson(dir, 'metrics.json', metricsFixture());
    const rewardPath = writeJson(dir, 'reward.json', { task_id: 'demo-task', passed: true, reward: 1 });
    const merged = path.join(dir, 'merged.json');
    const bridged = bridge(['--metrics', metricsPath, '--reward', rewardPath, '--arm', 'bouncer', '--out', merged]);
    assert.strictEqual(bridged.status, 0, bridged.stderr);

    const judgment = writeJson(dir, 'judgment.json', {
      label: 'r-bridge',
      task_id: 'demo-task',
      agent_config: 'test',
      dimensions: Object.fromEntries(
        ['correctness', 'scope', 'tests', 'fit', 'maintainability']
          .map((key) => [key, { score: 4, evidence: 'checked by hand' }]),
      ),
      blocking_findings: [],
      notes: '',
    });
    const card = path.join(dir, 'scorecard.json');
    const scored = spawnSync(
      'python3',
      [SCORECARD, 'score', '--metrics', merged, '--judgment', judgment, '--out', card],
      { encoding: 'utf8' },
    );
    assert.strictEqual(scored.status, 0, scored.stderr);
    const parsed = JSON.parse(fs.readFileSync(card, 'utf8'));
    assert.strictEqual(parsed.schema, 'agentic-code-benchmark/scorecard/1');
    assert.ok(parsed.composite > 0, 'merged metrics must still produce a composite');
    // verdict는 채점 입력이 아니다. scorecard.py가 그 값을 집어 들면 안 된다.
    assert.ok(!Object.prototype.hasOwnProperty.call(parsed, 'verdict'));

    // 출력 키가 없다는 것만으로는 약하다. verdict가 가중치에 새어 들어가면 키는
    // 그대로여도 점수가 움직인다. 병합 전 metrics를 같은 판단으로 한 번 더
    // 채점해 점수가 한 자리도 달라지지 않는 것으로 고정한다.
    const baseCard = path.join(dir, 'scorecard-base.json');
    const baseScored = spawnSync(
      'python3',
      [SCORECARD, 'score', '--metrics', metricsPath, '--judgment', judgment, '--out', baseCard],
      { encoding: 'utf8' },
    );
    assert.strictEqual(baseScored.status, 0, baseScored.stderr);
    const baseParsed = JSON.parse(fs.readFileSync(baseCard, 'utf8'));
    assert.strictEqual(parsed.composite, baseParsed.composite, 'verdict must not move the composite');
    assert.deepStrictEqual(parsed.objective, baseParsed.objective, 'verdict must not move the objective');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
