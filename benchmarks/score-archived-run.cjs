#!/usr/bin/env node
'use strict';
// finalize.remainder에서 멈춘 bouncer-full 실행을 작업 공간 아카이브에서 채점한다.
//
// 1.5.4 finalize는 remainder 단계에서 worktree 유지 선택지를 없앴다(f79ea8e2). evaluator policy v3
// 이전의 승인 정책은 `commit_and_keep_worktree`라 응답기가 멈추고, 실행기는 finalize 이후의
// patch 수집·verifier에 닿지 못한다. 이 스크립트는 policy v3 이전 run 채점용이다. remainder는 컨텍스트 문서만 커밋하므로 제품 변경은 이미 integration HEAD에 있다.
// 이 스크립트는 아카이브를 풀어 base..integration HEAD diff를 만들고, 실행기와 같은 verifier
// 컨테이너로 채점해 run.json에 `scored_from_archive`로 기록한다.
//
// 사용: node benchmarks/score-archived-run.cjs <run-id> [--work <dir>]

const { execFileSync, spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { loadRunnableCard, runHostVerifier, setupExcludes, verdictFields } = require('./task-card.cjs');
const { submissionDiff } = require('./submission-diff.cjs');

const projectRoot = path.resolve(__dirname, '..');
const containerWorkspace = '/workspace';

function main() {
  const [runId, ...rest] = process.argv.slice(2);
  if (!runId) throw new Error('usage: node benchmarks/score-archived-run.cjs <run-id> [--work <dir>]');
  const workRoot = rest[0] === '--work' && rest[1]
    ? path.resolve(rest[1])
    : path.join(projectRoot, '.benchmarks', 'score-work', runId);
  const runDir = path.join(projectRoot, 'benchmarks', 'runs', runId);
  const record = JSON.parse(readFileSync(path.join(runDir, 'run.json'), 'utf8'));
  const archive = record.workspace_archive?.path;
  if (!archive || !existsSync(archive)) throw new Error(`no workspace archive for ${runId}`);
  const task = loadRunnableCard(record.task_id);
  const base = task.card.base_commit;

  mkdirSync(workRoot, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', workRoot]);
  const workspace = path.join(workRoot, path.basename(archive).replace(/\.tar\.gz$/, ''));
  const integration = path.join(workspace, '.worktrees', '001', '001', 'integration');
  const link = readFileSync(path.join(integration, '.git'), 'utf8').match(/^gitdir:\s*(.+)$/m)?.[1]?.trim();
  if (!link?.startsWith(`${containerWorkspace}/`)) throw new Error('integration worktree has no container gitdir link');
  const env = { ...process.env, GIT_DIR: path.join(workspace, link.slice(containerWorkspace.length + 1)),
    GIT_WORK_TREE: integration };
  const head = execFileSync('git', ['rev-parse', 'HEAD'],
    { cwd: integration, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
  // Rescoring replaces the earlier verdict; the verifier refuses an existing work directory.
  for (const stale of ['verify-work', 'verifier.json']) rmSync(path.join(runDir, stale), { recursive: true, force: true });
  writeFileSync(path.join(runDir, 'diff.patch'), submissionDiff({ mode: 'ref', cwd: integration, base, ref: 'HEAD',
    excludes: setupExcludes(record.workspace_setup?.steps ?? null), env: { GIT_DIR: env.GIT_DIR, GIT_WORK_TREE: env.GIT_WORK_TREE } }));

  const compose = path.join(projectRoot, 'benchmarks', 'docker', 'compose.cursor.yaml');
  const composeEnv = { ...process.env, BENCH_WORKSPACE: workspace,
    BENCH_PROMPT: path.join(runDir, '01-init', 'prompt.txt'),
    BENCH_RESULT_DIR: runDir, BENCH_MODEL: record.model, BENCH_UID: String(process.getuid()),
    BENCH_GID: String(process.getgid()), CURSOR_API_KEY_FILE: '/dev/null',
    BENCH_CURSOR_DATA: path.join(runDir, '04-finalize', 'cursor-projects'),
    BENCH_CURSOR_LOGS: path.join(runDir, '04-finalize', 'cursor-logs') };
  let result;
  if (task.verifier.runtime === 'host') {
    result = runHostVerifier(task.verifier, { runDir, workDir: workspace });
  } else {
    execFileSync('docker', ['compose', '-f', compose, 'build', 'verifier'],
      { cwd: projectRoot, env: composeEnv, stdio: 'ignore' });
    result = spawnSync('docker', ['compose', '-f', compose, 'run', '--rm', '--no-deps',
      ...task.verifier.composeArgs], {
      cwd: projectRoot, env: composeEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: task.verifier.timeoutMs,
    });
    writeFileSync(path.join(runDir, 'verifier.stdout.json'), result.stdout ?? '');
    writeFileSync(path.join(runDir, 'verifier.stderr.log'), result.stderr ?? '');
  }
  // 종료 코드가 0이 아니어도 verifier.json이 있으면 그 판정(unjudgeable 포함)을 기록한다.
  if (!existsSync(path.join(runDir, 'verifier.json')) && (result.error || result.status !== 0)) {
    throw new Error(`external verifier failed: ${result.error?.message ?? result.stderr}`);
  }
  if (!existsSync(path.join(runDir, 'verifier.json'))) throw new Error('external verifier failed: verifier.json missing');
  const verdict = JSON.parse(readFileSync(path.join(runDir, 'verifier.json'), 'utf8'));
  Object.assign(record, {
    ...verdictFields(verdict),
    integration_head: head,
    scored_from_archive: {
      at: new Date().toISOString(), head, base,
      reason: '1.5.4 finalize.remainder has no keep-worktree option; '
        + 'product changes scored from integration HEAD before the remainder commit',
    },
  });
  writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`${runId} score=${verdict.score} success=${verdict.outcome_success} head=${head.slice(0, 8)}\n`);
}

main();
