#!/usr/bin/env node
'use strict';

const { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } = require('node:fs');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { loadPolicy } = require('./acp/responder.cjs');
const { sumUsage, usageTotalStatus } = require('./usage.cjs');
const { sampleEligibility, sourceProvenance } = require('./provenance.cjs');
const { archiveWorkspace } = require('./archive.cjs');
const { applyWorkspaceSetup, loadRunnableCard, taskRecord } = require('./task-card.cjs');
const { loadPrepared } = require('./prepare-deepswe-task.cjs');
const { agentRuntime, runtimeRecordFields, withOwnershipRestore, runStagesWithBudget, budgetStopRecord,
  exitCodeFor } = require('./agent-runtime.cjs');

const root = __dirname;
const projectRoot = path.resolve(root, '..');
const driverFiles = ['driver.log', 'driver.pid'];
const containerWorkspace = '/workspace';

function command(binary, args, cwd, env = process.env) {
  const result = spawnSync(binary, args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} ${args.join(' ')}: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout.trim();
}

function configOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--detach' && !out.detach) {
      out.detach = true;
      i -= 1;
      continue;
    }
    if (argv[i] === '--keep-workspace' && !out.keepWorkspace) {
      out.keepWorkspace = true;
      i -= 1;
      continue;
    }
    if (!['--task', '--model', '--key-file', '--run-id', '--timeout-minutes'].includes(argv[i])
      || !argv[i + 1] || out[argv[i]]) throw new Error(`invalid option: ${argv[i]}`);
    out[argv[i]] = argv[i + 1];
  }
  if (!out['--model'] || !out['--key-file']) throw new Error('--model and --key-file are required');
  // 기본 과제가 없다: 파일 검사 전에 --task 명시를 요구한다.
  if (!out['--task']) throw new Error('--task is required');
  out.taskId = out['--task'];
  out.runId = out['--run-id'] ?? `${Date.now()}-bouncer-full`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/.test(out.runId)) throw new Error('invalid run id');
  out.keyFile = path.resolve(out['--key-file']);
  if (!existsSync(out.keyFile) || statSync(out.keyFile).size === 0) throw new Error('API key file missing');
  // 실행 전체 wall-clock 예산(분). 단계마다 남은 분을 계산해 넘기므로 단계당 값이 아니다.
  out.timeoutMinutes = Number(out['--timeout-minutes'] ?? '180');
  if (!Number.isInteger(out.timeoutMinutes) || out.timeoutMinutes < 1 || out.timeoutMinutes > 240) {
    throw new Error('invalid timeout');
  }
  return out;
}

function save(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function progress(message) {
  process.stderr.write(`[${new Date().toISOString()}] ${message}\n`);
}

function runPaths(config) {
  return {
    runDir: path.join(root, 'runs', config.runId),
    workspace: path.join(projectRoot, '.benchmarks', 'work', config.runId),
  };
}

// The stage containers speak ACP over stdio to this driver, so the driver itself is what runs in the
// background: a new session keeps it alive when the launching terminal closes.
function detach(argv, config) {
  const { runDir, workspace } = runPaths(config);
  if (existsSync(runDir) || existsSync(workspace)) throw new Error('run id already exists');
  mkdirSync(runDir, { recursive: true });
  const log = openSync(path.join(runDir, 'driver.log'), 'a');
  const args = argv.filter((arg) => arg !== '--detach');
  if (!config['--run-id']) args.push('--run-id', config.runId);
  const child = spawn(process.execPath, [__filename, ...args], {
    cwd: projectRoot, env: { ...process.env, BENCH_DRIVER_DETACHED: '1' },
    detached: true, stdio: ['ignore', log, log],
  });
  closeSync(log);
  writeFileSync(path.join(runDir, 'driver.pid'), `${child.pid}\n`);
  child.unref();
  process.stdout.write(`${runDir}\n`);
  process.stdout.write(`pid ${child.pid}; log ${path.join(runDir, 'driver.log')}\n`);
}

/**
 * 단계 하나를 `run-print-stage.cjs` 자식 프로세스로 돌린다.
 * 단계가 멈추면 사용량을 담아 throw한다(토큰은 이미 쓰였다).
 *
 * @param {object} config - `configOf` 결과
 * @param {string} policyFile - 평가자 정책 경로
 * @param {string} name - 단계 이름(`01-init` 등)
 * @param {string} workspace - 호스트 작업 공간
 * @param {string} runDir - 실행 디렉터리
 * @param {string} sessionCwd - 단계 에이전트의 작업 디렉터리
 * @param {number} minutes - 이 단계가 쓸 수 있는 남은 분(실행 전체 예산에서 계산)
 * @returns {object} 단계 `run.json` 레코드
 */
function stage(config, policyFile, name, workspace, runDir, sessionCwd, minutes) {
  const stageDir = path.join(runDir, name);
  const args = [path.join(root, 'run-print-stage.cjs'), '--stage', `bouncer-${name.split('-')[1]}`,
    '--work-dir', workspace, '--session-cwd', sessionCwd, '--run-dir', stageDir,
    '--task', config.taskId, '--model', config['--model'], '--key-file', config.keyFile, '--policy', policyFile,
    '--timeout-minutes', String(minutes)];
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot, env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  const record = existsSync(path.join(stageDir, 'run.json'))
    ? JSON.parse(readFileSync(path.join(stageDir, 'run.json'), 'utf8')) : null;
  if (result.error || result.status !== 0 || record?.status !== 'stage_returned') {
    // A stopped stage still spent tokens; hand its usage to the run record.
    throw Object.assign(new Error(`${name} stopped: ${record?.status ?? result.error?.message ?? result.stderr}`),
      { stage: name, usage: record?.usage });
  }
  return record;
}

function statusLines(workspace) {
  // command()가 stdout을 trim해 첫 줄의 선행 공백(` M .gitignore`)이 사라지므로 trim하지 않고 직접 읽는다.
  const result = spawnSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: workspace, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`git status: ${result.stderr || result.error?.message}`);
  return result.stdout.split('\n').filter(Boolean);
}

/**
 * init이 바꾼 .gitignore가 승인된 정책과 맞는지 판정한다.
 * 과제 저장소가 원래 갖고 있던 항목은 허용하되(상류 저장소는 자체 .gitignore가 있다), init이 새로 더한 항목은
 * 모두 정책의 제안 목록 안이어야 하고 기존 항목을 지우면 안 되며 제안 항목은 전부 무시 규칙으로 있어야 한다.
 *
 * @param {{ baseline: string[], current: string[], expected: string[] }} input - 기준 커밋, init 후, 정책 제안의 유효 항목
 * @returns {{ ok: boolean }} 정책과 맞으면 ok true
 */
function gitignoreAgainstPolicy({ baseline, current, expected }) {
  const added = current.filter((entry) => !baseline.includes(entry));
  const removed = baseline.filter((entry) => !current.includes(entry));
  const missing = expected.filter((entry) => !current.includes(entry));
  return { ok: !removed.length && !missing.length && added.every((entry) => expected.includes(entry)) };
}

/**
 * init 산출물(`.bouncer/`, `.gitignore`)을 검사하고 부트스트랩 커밋을 만든다.
 * `before`는 workspace_setup 뒤 상태라서 과제가 미리 둔 사용자 작업은 init 산출물로 판정되거나 커밋에 쓸려 들어가지 않는다.
 * 기준 브랜치는 과제마다 다르므로 `config.base_branch`를 정책 `task_facts.base_branch`와 대조한다.
 *
 * @param {string} workspace - 호스트 작업 공간(git 저장소)
 * @param {object} policy - 평가자 정책(`task_facts.base_branch`, `expected_gitignore_suggestions`를 읽는다)
 * @param {string[]} before - workspace_setup 뒤 `git status --porcelain` 줄
 * @returns {void}
 * @throws {Error} 정책 기준 브랜치 없음, 관리 경로 밖 변경, config 불일치, gitignore 불일치, 커밋 범위 이탈
 */
function bootstrapCommit(workspace, policy, before) {
  const baseBranch = policy.task_facts?.base_branch;
  if (typeof baseBranch !== 'string' || !baseBranch) throw new Error('evaluator policy task_facts.base_branch missing');
  const changed = statusLines(workspace).filter((line) => !before.includes(line)).map((line) => line.slice(3));
  if (!changed.length || changed.some((file) => !file.startsWith('.bouncer/') && file !== '.gitignore')) {
    throw new Error(`unexpected bootstrap files: ${changed.join(', ')}`);
  }
  if (!existsSync(path.join(workspace, '.bouncer', 'config.json'))) throw new Error('Bouncer init config missing');
  const config = JSON.parse(readFileSync(path.join(workspace, '.bouncer', 'config.json'), 'utf8'));
  // Cursor keeps no usage for Task subagents; the print-dispatch opt-in makes every agent a logged session.
  if (config.subagents?.provider !== 'cursor' || config.subagents?.dispatch !== 'print'
    || config.base_branch !== baseBranch) {
    throw new Error('Bouncer bootstrap configuration differs from policy');
  }
  if (existsSync(path.join(workspace, '.gitignore'))) {
    const read = (text) => text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    const baseline = spawnSync('git', ['show', 'HEAD:.gitignore'], { cwd: workspace, encoding: 'utf8' });
    const check = gitignoreAgainstPolicy({
      baseline: baseline.status === 0 ? read(baseline.stdout) : [],
      current: read(readFileSync(path.join(workspace, '.gitignore'), 'utf8')),
      expected: policy.task_facts.expected_gitignore_suggestions,
    });
    if (!check.ok) throw new Error('gitignore entries differ from approved policy');
  }
  const paths = ['.bouncer'];
  if (existsSync(path.join(workspace, '.gitignore'))) paths.push('.gitignore');
  command('git', ['add', '--', ...paths], workspace);
  // --only commits just these paths and leaves any other staged change staged.
  command('git', ['commit', '--only', '-m', 'chore: bootstrap bouncer', '--', ...paths], workspace);
  const committed = command('git', ['show', '--name-only', '--format=', 'HEAD'], workspace).split('\n').filter(Boolean);
  if (committed.some((file) => !file.startsWith('.bouncer/') && file !== '.gitignore')) {
    throw new Error('bootstrap commit escaped policy scope');
  }
}

// Stages run in a container that mounts the workspace at /workspace, so git records the worktrees they
// create under that path. Map those records back to the host workspace.
function hostPath(workspace, directory) {
  return directory.startsWith(`${containerWorkspace}/`)
    ? path.join(workspace, directory.slice(containerWorkspace.length + 1)) : directory;
}

function integrationWorktree(workspace) {
  const lines = command('git', ['worktree', 'list', '--porcelain'], workspace).split('\n');
  const candidates = lines.filter((line) => line.startsWith('worktree '))
    .map((line) => hostPath(workspace, line.slice('worktree '.length)))
    .filter((directory) => directory.startsWith(`${workspace}/.worktrees/`) && directory.endsWith('/integration'));
  if (candidates.length !== 1) throw new Error(`expected one integration worktree, found ${candidates.length}`);
  return candidates[0];
}

// The worktree's .git file still names the container gitdir, which the container stages need unchanged.
// Host-side git calls point at the mapped gitdir through the environment instead of repairing the link.
function integrationGitEnv(workspace, integration) {
  const link = readFileSync(path.join(integration, '.git'), 'utf8').match(/^gitdir:\s*(.+)$/m)?.[1]?.trim();
  if (!link) throw new Error('integration worktree has no gitdir link');
  return { ...process.env, GIT_DIR: hostPath(workspace, link), GIT_WORK_TREE: integration };
}

function blueprintFile(checkout) {
  const epics = path.join(checkout, '.bouncer', 'context', 'epics');
  if (!existsSync(epics)) throw new Error('expected one blueprint, found 0 (no .bouncer/context/epics)');
  const blueprints = readdirSync(epics).flatMap((epic) => {
    const dir = path.join(epics, epic, 'blueprints');
    return existsSync(dir) ? readdirSync(dir).map((blueprint) => path.join(dir, blueprint, 'index.md')) : [];
  }).filter((file) => existsSync(file));
  if (blueprints.length !== 1) throw new Error(`expected one blueprint, found ${blueprints.length}`);
  return blueprints[0];
}

function blueprintRelative(checkout) {
  return path.relative(checkout, path.dirname(blueprintFile(checkout))).split(path.sep).join('/');
}

function checkPlanGate(workspace) {
  const blueprint = blueprintRelative(workspace);
  const output = command(process.execPath, [path.join(projectRoot, 'scripts', 'bouncer'),
    'validate', '--blueprint', blueprint, '--gate', 'plan'], workspace);
  const result = JSON.parse(output);
  if (!result.ok) throw new Error(`plan gate failed: ${output}`);
  return blueprint;
}

/**
 * `finalize prepare` 결과에서 통합 기록(head, branch, tasks)을 만든다.
 * 원장 파일을 읽지 않고 CLI의 `drive` 요약과 `range.head`·`git.branch`만 쓴다.
 * 통합이 끝나지 않았으면 유료 finalize stage로 넘어가지 않도록 throw한다.
 *
 * @param {object} prepare - `finalize prepare` JSON
 * @returns {{ head: string, branch: string, tasks: object[] }} 통합 head·branch와 drive task 목록
 */
function integrationFromPrepare(prepare) {
  const drive = prepare?.drive;
  if (prepare?.ok !== true || !drive || drive.ready !== true) {
    const tasks = Array.isArray(drive?.tasks) ? drive.tasks : [];
    const open = tasks.filter((task) => task.status !== 'integrated').map((task) => `${task.id}:${task.status}`);
    throw new Error(`integration incomplete: ${open.length ? `open tasks ${open.join(', ')}` : JSON.stringify(prepare)}`);
  }
  return { head: prepare.range?.head, branch: prepare.git?.branch, tasks: drive.tasks };
}

/**
 * stage run.json 기록들에서 최상위 run.json에 옮길 플러그인 버전을 고른다.
 * 모든 stage가 같은 이미지 검사를 통과했으므로 첫 기록이 대표값이다.
 *
 * @param {object[]} stageRecords - stage run.json 객체 목록
 * @returns {string | null} 첫 기록의 `plugin_version`이 문자열이면 그 값, 아니면 null
 */
function pluginVersionFromStages(stageRecords) {
  const version = stageRecords[0]?.plugin_version;
  return typeof version === 'string' ? version : null;
}

function checkIntegration(workspace, integration) {
  const blueprint = blueprintRelative(integration);
  const output = command(process.execPath, [path.join(projectRoot, 'scripts', 'bouncer'),
    'finalize', 'prepare', '--blueprint', blueprint], integration, integrationGitEnv(workspace, integration));
  return integrationFromPrepare(JSON.parse(output));
}

/**
 * finalize가 integration worktree를 지운 뒤에도 채점 증거를 모은다.
 * cleanup은 브랜치를 지우지 않으므로 workspace 메인 저장소의 브랜치 ref만 읽는다(worktree 존재·dirty 검사 없음).
 *
 * @param {object} args - 수집 입력
 * @param {string} args.workspace - 메인 저장소 경로
 * @param {string} args.baseCommit - patch 기준 커밋
 * @param {string} args.branch - integration 브랜치 이름
 * @param {string} args.blueprint - workspace 기준 blueprint 상대 디렉터리
 * @param {{git?: (args: string[], cwd: string) => {status: number, stdout: Buffer|string}}} [args.deps] - git 실행 주입(없으면 spawnSync)
 * @returns {{blueprint: string, integration_head: string, patch: Buffer}} 상대 blueprint, 브랜치 HEAD, 바이너리 patch
 * @throws {Error} 브랜치 ref가 없거나(`integration branch missing`) blueprint가 closed가 아닐 때(`blueprint not closed`)
 */
function collectFinalEvidence({ workspace, baseCommit, branch, blueprint, deps = {} }) {
  const git = deps.git ?? ((args, cwd) => spawnSync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }));
  const run = (args) => git(args, workspace);
  // 1. ref가 없을 때 rev-parse 실패는 "브랜치 없음"으로만 해석한다. 다른 git 실패는 patch 단계에서 따로 드러난다.
  const head = run(['rev-parse', '--verify', `refs/heads/${branch}`]);
  if (head.status !== 0) throw new Error(`integration branch missing: ${branch}`);
  // 2. closed 여부는 ref에 커밋된 index.md로 본다. 파일이 없어도 닫히지 않은 것으로 취급한다.
  const index = run(['show', `${branch}:${blueprint}/index.md`]);
  if (index.status !== 0 || !/^\s*status:\s*closed\s*$/m.test(index.stdout.toString())) {
    throw new Error(`blueprint not closed on ${branch}`);
  }
  const patch = run(['diff', '--binary', '--no-ext-diff', baseCommit, branch, '--']);
  if (patch.status !== 0) throw new Error(`could not collect integration patch: ${patch.stderr ?? ''}`);
  return { blueprint, integration_head: head.stdout.toString().trim(), patch: Buffer.from(patch.stdout) };
}

function verifyPatch(config, task, workspace, runDir, record) {
  const env = { ...process.env,
    BENCH_WORKSPACE: workspace,
    BENCH_PROMPT: path.join(runDir, '01-init', 'prompt.txt'),
    BENCH_RESULT_DIR: runDir,
    BENCH_MODEL: config['--model'],
    BENCH_UID: String(process.getuid()),
    BENCH_GID: String(process.getgid()),
    CURSOR_API_KEY_FILE: config.keyFile,
    BENCH_CURSOR_DATA: path.join(runDir, '04-finalize', 'cursor-projects'),
    BENCH_CURSOR_LOGS: path.join(runDir, '04-finalize', 'cursor-logs'),
  };
  const compose = path.join(root, 'docker', 'compose.cursor.yaml');
  command('docker', ['compose', '-f', compose, 'build', 'verifier'], projectRoot, env);
  const result = spawnSync('docker', ['compose', '-f', compose, 'run', '--rm', '--no-deps', ...task.verifier.composeArgs], {
    cwd: projectRoot, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: task.verifier.timeoutMs,
  });
  writeFileSync(path.join(runDir, 'verifier.stdout.json'), result.stdout ?? '');
  writeFileSync(path.join(runDir, 'verifier.stderr.log'), result.stderr ?? '');
  if (result.error || result.status !== 0 || !existsSync(path.join(runDir, 'verifier.json'))) {
    throw new Error(`external verifier failed: ${result.error?.message ?? result.stderr}`);
  }
  const verdict = JSON.parse(readFileSync(path.join(runDir, 'verifier.json'), 'utf8'));
  record.judge_status = verdict.judge_status;
  record.score = verdict.score;
  record.outcome_success = verdict.outcome_success;
  if (verdict.judge_status !== 'graded') throw new Error('external verifier did not grade the patch');
}

/**
 * `run.json` 최상위에 쓸 런타임 필드(이미지 id, deviations)를 만든다.
 * 이미지는 각 단계 실행기가 빌드하므로 `01-init`이 끝난 뒤에 불러야 방금 빌드한 이미지의 id를 읽는다.
 *
 * @param {{ taskId: string }} config - `configOf` 결과
 * @param {object | null} prepared - `loadPrepared` 결과
 * @param {{ runDocker: (args: string[]) => string }} deps - docker 실행 주입
 * @returns {{ image_id: string, deviations: string[] }} 이미지 id와 deviations
 */
function runtimeFieldsFor(config, prepared, deps) {
  return runtimeRecordFields(agentRuntime({ taskId: config.taskId, condition: 'bouncer-full', prepared }), deps);
}

/**
 * 단계 뒤 소유권 복원용 compose env를 만든다. 복원은 `/workspace` 마운트만 쓰지만 compose는 파일 전체의
 * `:?` 변수를 요구하므로, 단계가 남긴 실제 경로를 채운다.
 *
 * @param {object} config - `configOf` 결과
 * @param {object} runtime - `agentRuntime` 결과
 * @param {string} workspace - 호스트 작업 공간
 * @param {string} stageDir - 단계 실행 디렉터리
 * @returns {NodeJS.ProcessEnv} compose 환경
 */
function composeEnvFor(config, runtime, workspace, stageDir) {
  return { ...process.env, ...runtime.env,
    BENCH_WORKSPACE: workspace,
    BENCH_PROMPT: path.join(stageDir, 'prompt.txt'),
    BENCH_RESULT_DIR: stageDir,
    BENCH_MODEL: config['--model'],
    BENCH_UID: String(process.getuid()),
    BENCH_GID: String(process.getgid()),
    CURSOR_API_KEY_FILE: config.keyFile,
    BENCH_CURSOR_DATA: path.join(stageDir, 'cursor-projects'),
    BENCH_CURSOR_LOGS: path.join(stageDir, 'cursor-logs'),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const config = configOf(argv);
  const task = loadRunnableCard(config.taskId);
  const baseCommit = task.card.base_commit;
  // Evaluator policies record the user's approved answers for one task; none is generated here.
  const policyFile = path.join(root, 'configs', `${task.card.id}-evaluator-policy.json`);
  if (!existsSync(policyFile)) throw new Error(`no approved evaluator policy for ${task.card.id}: ${path.relative(projectRoot, policyFile)}`);
  const policy = loadPolicy(policyFile);
  if (policy.task_id !== task.card.id) throw new Error('policy task id mismatch');
  if (policy.base_commit !== baseCommit) throw new Error('policy base commit mismatch');
  if (config.detach) {
    detach(argv, config);
    return;
  }
  // 과제 이미지가 잘못된 카드는 실행 디렉터리를 만들기 전에 멈춘다.
  const prepared = loadPrepared(config.taskId);
  const runtime = agentRuntime({ taskId: config.taskId, condition: 'bouncer-full', prepared });
  const { runDir, workspace } = runPaths(config);
  const detachedChild = process.env.BENCH_DRIVER_DETACHED === '1'
    && existsSync(runDir) && readdirSync(runDir).every((file) => driverFiles.includes(file));
  if (existsSync(workspace) || (existsSync(runDir) && !detachedChild)) throw new Error('run id already exists');
  mkdirSync(runDir, { recursive: true });
  const record = { run_id: config.runId, ...taskRecord(task), condition: 'bouncer-full', model: config['--model'],
    ...sourceProvenance(projectRoot), workspace, plugin_version: null,
    // 이미지는 단계 실행기가 빌드하므로 id는 01-init이 끝난 뒤에 채운다. 그 전에 멈추면 null로 남는다.
    image_id: null, deviations: runtime.deviations, status: 'running', stages: [],
    stage_usage: {},
    evaluator_policy_version: policy.policy_version,
    evaluator_policy_sha256: createHash('sha256').update(readFileSync(policyFile)).digest('hex'),
    started_at: new Date().toISOString() };
  save(path.join(runDir, 'run.json'), record);
  try {
    command('git', ['clone', '--quiet', task.bundle, workspace], projectRoot);
    if (command('git', ['rev-parse', 'HEAD'], workspace) !== baseCommit) throw new Error('baseline mismatch');
    command('git', ['config', 'user.name', 'Benchmark Agent'], workspace);
    command('git', ['config', 'user.email', 'benchmark@local.invalid'], workspace);
    record.workspace_setup = applyWorkspaceSetup(workspace, task.card);
    const setupStatus = statusLines(workspace);
    const startedAtMs = Date.now();
    const ids = { uid: process.getuid(), gid: process.getgid() };
    const runStage = async (name, minutes) => {
      // 앞 단계의 소유권 복원이 끝난 뒤이므로 호스트 git으로 integration worktree를 찾아도 된다.
      const cwd = name === '04-finalize' ? integrationWorktree(workspace) : workspace;
      const stageDir = path.join(runDir, name);
      progress(`${name} started (${minutes} min left)`);
      // 성공·실패·시간 초과와 상관없이 호스트 git 작업(아래) 전에 DeepSWE root 소유 파일을 되돌린다.
      const stageRecord = await withOwnershipRestore(runtime, ids,
        () => stage(config, policyFile, name, workspace, runDir, cwd, minutes),
        { runCompose: (args) => command('docker', ['compose', '-f', path.join(root, 'docker', 'compose.cursor.yaml'), ...args],
          projectRoot, composeEnvFor(config, runtime, workspace, stageDir)) });
      progress(`${name} returned`);
      record.stages.push(name);
      record.stage_usage[name] = stageRecord.usage;
      record.plugin_version ??= pluginVersionFromStages([stageRecord]);
      // Task subagent attempts the guard refused: rule violations of rules/cursor-print-dispatch.md.
      record.subagent_denied = { ...record.subagent_denied, [name]: stageRecord.subagent_denied ?? 0 };
      record.usage_total = sumUsage(Object.values(record.stage_usage));
      record.usage_total_status = usageTotalStatus(record.stage_usage);
      if (name === '01-init') {
        bootstrapCommit(workspace, policy, setupStatus);
        Object.assign(record, runtimeFieldsFor(config, prepared, { runDocker: (args) => command('docker', args, projectRoot) }));
      }
      if (name === '02-plan') record.blueprint = checkPlanGate(workspace);
      if (name === '03-run') record.integration = checkIntegration(workspace, integrationWorktree(workspace));
      save(path.join(runDir, 'run.json'), record);
    };
    const { skipped } = await runStagesWithBudget({ stages: ['01-init', '02-plan', '03-run', '04-finalize'],
      totalMinutes: config.timeoutMinutes, startedAt: startedAtMs, now: Date.now, runStage });
    if (skipped.length) {
      // 예산이 소진되면 채점할 증거가 없다: 오류가 아니라 채점 불가 기록으로 남기고 표본에서 뺀다.
      Object.assign(record, budgetStopRecord(skipped));
    } else {
      // finalize --yes cleanup이 worktree를 지우므로 브랜치 ref에서 증거를 모은다.
      const evidence = collectFinalEvidence({ workspace, baseCommit, branch: record.integration.branch, blueprint: record.blueprint });
      record.blueprint = evidence.blueprint;
      record.integration_head = evidence.integration_head;
      writeFileSync(path.join(runDir, 'diff.patch'), evidence.patch);
      verifyPatch(config, task, workspace, runDir, record);
      record.status = 'finalized';
    }
  } catch (error) {
    record.status = 'stopped';
    record.error = error.message;
    if (error.stage && error.usage) {
      record.stage_usage[error.stage] = error.usage;
      record.usage_total = sumUsage(Object.values(record.stage_usage));
      record.usage_total_status = usageTotalStatus(record.stage_usage);
    }
  }
  record.ended_at = new Date().toISOString();
  record.sample_eligibility = sampleEligibility(record);
  save(path.join(runDir, 'run.json'), record);
  // Each workspace carries a ~200 MB Graphify venv; keep only a verified archive unless asked otherwise.
  if (!config.keepWorkspace) {
    record.workspace_archive = archiveWorkspace(workspace, path.join(projectRoot, '.benchmarks', 'archive'));
    save(path.join(runDir, 'run.json'), record);
    progress(`workspace ${record.workspace_archive.status}${record.workspace_archive.error
      ? `: ${record.workspace_archive.error}` : ''}`);
  }
  progress(`run ${record.status}${record.error ? `: ${record.error}` : ''}`);
  process.stdout.write(`${runDir}\n`);
  process.exitCode = exitCodeFor(record);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { configOf, gitignoreAgainstPolicy, collectFinalEvidence, integrationFromPrepare, pluginVersionFromStages,
  bootstrapCommit, runtimeFieldsFor };
