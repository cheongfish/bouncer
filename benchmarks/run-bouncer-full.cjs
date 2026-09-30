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
  out.taskId = out['--task'] ?? 'ledger-001';
  out.runId = out['--run-id'] ?? `${Date.now()}-bouncer-full`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$/.test(out.runId)) throw new Error('invalid run id');
  out.keyFile = path.resolve(out['--key-file']);
  if (!existsSync(out.keyFile) || statSync(out.keyFile).size === 0) throw new Error('API key file missing');
  out.timeoutMinutes = Number(out['--timeout-minutes'] ?? '60');
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

function stage(config, policyFile, name, workspace, runDir, sessionCwd = workspace) {
  const stageDir = path.join(runDir, name);
  const args = [path.join(root, 'run-print-stage.cjs'), '--stage', `bouncer-${name.split('-')[1]}`,
    '--work-dir', workspace, '--session-cwd', sessionCwd, '--run-dir', stageDir,
    '--task', config.taskId, '--model', config['--model'], '--key-file', config.keyFile, '--policy', policyFile,
    '--timeout-minutes', String(config.timeoutMinutes)];
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
  return command('git', ['status', '--porcelain', '--untracked-files=all'], workspace).split('\n').filter(Boolean);
}

// `before` is the status after workspace_setup, so a task's pre-staged user work is neither judged as
// init output nor swept into the bootstrap commit.
function bootstrapCommit(workspace, policy, before) {
  const changed = statusLines(workspace).filter((line) => !before.includes(line)).map((line) => line.slice(3));
  if (!changed.length || changed.some((file) => !file.startsWith('.bouncer/') && file !== '.gitignore')) {
    throw new Error(`unexpected bootstrap files: ${changed.join(', ')}`);
  }
  if (!existsSync(path.join(workspace, '.bouncer', 'config.json'))) throw new Error('Bouncer init config missing');
  const config = JSON.parse(readFileSync(path.join(workspace, '.bouncer', 'config.json'), 'utf8'));
  // Cursor keeps no usage for Task subagents; the print-dispatch opt-in makes every agent a logged session.
  if (config.subagents?.provider !== 'cursor' || config.subagents?.dispatch !== 'print'
    || config.base_branch !== 'main') {
    throw new Error('Bouncer bootstrap configuration differs from policy');
  }
  if (existsSync(path.join(workspace, '.gitignore'))) {
    const entries = readFileSync(path.join(workspace, '.gitignore'), 'utf8')
      .split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    const expected = policy.task_facts.expected_gitignore_suggestions;
    if (entries.length !== expected.length || entries.some((entry) => !expected.includes(entry))) {
      throw new Error('gitignore entries differ from approved policy');
    }
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

function checkIntegration(workspace, integration) {
  const blueprint = blueprintRelative(integration);
  const output = command(process.execPath, [path.join(projectRoot, 'scripts', 'bouncer'),
    'finalize', 'prepare', '--blueprint', blueprint], integration, integrationGitEnv(workspace, integration));
  // `finalize prepare` is the read-only digest; its coordinator section carries the drive ledger state.
  const result = JSON.parse(output);
  const coordinator = result.coordinator;
  const tasks = Array.isArray(coordinator?.tasks) ? coordinator.tasks : [];
  const open = tasks.filter((task) => task.status !== 'integrated').map((task) => `${task.id}:${task.status}`);
  if (!result.ok || coordinator?.status !== 'ok' || !tasks.length || open.length) {
    throw new Error(`integration incomplete: ${open.length ? `open tasks ${open.join(', ')}` : output}`);
  }
  return { head: coordinator.integrationHead, branch: coordinator.integrationBranch,
    tasks: tasks.map((task) => ({ id: task.id, status: task.status, sha: task.sha })) };
}

function closedBlueprint(integration) {
  const file = blueprintFile(integration);
  const body = readFileSync(file, 'utf8');
  if (!/^\s*status:\s*closed\s*$/m.test(body)) throw new Error('blueprint is not closed');
  return file;
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

function main() {
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
  const { runDir, workspace } = runPaths(config);
  const detachedChild = process.env.BENCH_DRIVER_DETACHED === '1'
    && existsSync(runDir) && readdirSync(runDir).every((file) => driverFiles.includes(file));
  if (existsSync(workspace) || (existsSync(runDir) && !detachedChild)) throw new Error('run id already exists');
  mkdirSync(runDir, { recursive: true });
  const record = { run_id: config.runId, ...taskRecord(task), condition: 'bouncer-full', model: config['--model'],
    ...sourceProvenance(projectRoot), workspace, status: 'running', stages: [],
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
    for (const name of ['01-init', '02-plan', '03-run', '04-finalize']) {
      const cwd = name === '04-finalize' ? integrationWorktree(workspace) : workspace;
      progress(`${name} started`);
      const stageRecord = stage(config, policyFile, name, workspace, runDir, cwd);
      progress(`${name} returned`);
      record.stages.push(name);
      record.stage_usage[name] = stageRecord.usage;
      // Task subagent attempts the guard refused: rule violations of rules/cursor-print-dispatch.md.
      record.subagent_denied = { ...record.subagent_denied, [name]: stageRecord.subagent_denied ?? 0 };
      record.usage_total = sumUsage(Object.values(record.stage_usage));
      record.usage_total_status = usageTotalStatus(record.stage_usage);
      if (name === '01-init') bootstrapCommit(workspace, policy, setupStatus);
      if (name === '02-plan') record.blueprint = checkPlanGate(workspace);
      if (name === '03-run') record.integration = checkIntegration(workspace, integrationWorktree(workspace));
      save(path.join(runDir, 'run.json'), record);
    }
    const integration = integrationWorktree(workspace);
    const gitEnv = integrationGitEnv(workspace, integration);
    record.blueprint = closedBlueprint(integration);
    if (command('git', ['status', '--porcelain'], integration, gitEnv)) throw new Error('integration worktree is dirty');
    record.integration_head = command('git', ['rev-parse', 'HEAD'], integration, gitEnv);
    const patch = spawnSync('git', ['diff', '--binary', '--no-ext-diff', baseCommit, 'HEAD', '--'], {
      cwd: integration, env: gitEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    if (patch.status !== 0 || patch.error) throw new Error(`could not collect integration patch: ${patch.stderr}`);
    writeFileSync(path.join(runDir, 'diff.patch'), patch.stdout);
    verifyPatch(config, task, workspace, runDir, record);
    record.status = 'finalized';
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
  if (record.status !== 'finalized') process.exitCode = 1;
}

main();
