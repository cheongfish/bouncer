#!/usr/bin/env node
'use strict';

// Builds the generated fixtures of an upstream-commit task (benchmarks/upstream/<task>.json):
//
//   fixtures/upstream/<task>.bundle        parentless snapshot of the upstream parent's tree
//   fixtures/upstream/<task>/hidden/       the upstream commit's hidden test files, as <path>.hidden
//   fixtures/upstream/<task>/deps/         node_modules installed with `npm ci` from the pinned lockfile
//   fixtures/upstream/<task>/baseline.json regression files that pass on the snapshot (computed in the
//                                          verifier container, the runtime that grades submissions)
//
// The snapshot commit is written with a fixed author, committer, and date, so the same upstream tree
// always yields the same SHA; the task card pins it as base_commit. Agents see neither upstream history
// nor the hidden tests. Needs network (Git, npm) and Docker.
//
//   node benchmarks/build-upstream-task.cjs <task> [--check-solution]
//
// --check-solution also grades the untouched snapshot and the upstream solution (the commit's non-test
// changes), so a task whose solution does not score 100 is caught before any paid run.

const { spawnSync } = require('node:child_process');
const { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { HIDDEN_SUFFIX, fixturePaths } = require('./verifiers/upstream-lib.cjs');

const benchmarkRoot = __dirname;
const projectRoot = path.resolve(benchmarkRoot, '..');
const compose = path.join(benchmarkRoot, 'docker', 'compose.cursor.yaml');

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} ${args.join(' ')} failed: ${result.stderr || result.error?.message || result.stdout}`);
  }
  return result.stdout.trim();
}

const git = (args, cwd, env) => run('git', args, { cwd, env: env ? { ...process.env, ...env } : process.env });

function progress(message) {
  process.stderr.write(`[build-upstream] ${message}\n`);
}

function upstreamCache(config) {
  const cache = path.join(projectRoot, '.benchmarks', 'upstream-cache', `${path.basename(config.repo, '.git')}.git`);
  if (!existsSync(cache)) {
    progress(`clone ${config.repo}`);
    mkdirSync(path.dirname(cache), { recursive: true });
    git(['clone', '--quiet', '--bare', config.repo, cache], projectRoot);
  }
  for (const sha of [config.upstream_parent, config.upstream_commit]) {
    if (spawnSync('git', ['-C', cache, 'cat-file', '-e', `${sha}^{commit}`]).status !== 0) {
      progress(`fetch ${sha}`);
      git(['fetch', '--quiet', 'origin', sha], cache);
    }
  }
  return cache;
}

// A parentless commit of the upstream parent's tree with fixed identity and date.
function snapshotCommit(config, cache) {
  const { author, date, message } = config.snapshot;
  const [, name, email] = author.match(/^(.*) <(.*)>$/);
  const identity = {
    GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_COMMITTER_DATE: date,
  };
  const tree = git(['rev-parse', `${config.upstream_parent}^{tree}`], cache);
  return git(['commit-tree', tree, '-m', message], cache, identity);
}

function writeBundle(config, cache, commit, bundle, scratch) {
  const ref = `refs/benchmark/${config.task_id}`;
  git(['update-ref', ref, commit], cache);
  const repo = path.join(scratch, 'bundle.git');
  git(['init', '--quiet', '--bare', repo], scratch);
  git(['fetch', '--quiet', cache, `${ref}:refs/heads/${config.snapshot.branch}`], repo);
  git(['symbolic-ref', 'HEAD', `refs/heads/${config.snapshot.branch}`], repo);
  mkdirSync(path.dirname(bundle), { recursive: true });
  git(['bundle', 'create', '--quiet', bundle, 'HEAD', `refs/heads/${config.snapshot.branch}`], repo);
}

function writeHidden(config, cache, hiddenDir) {
  for (const rel of config.hidden_tests) {
    const target = path.join(hiddenDir, `${rel}${HIDDEN_SUFFIX}`);
    mkdirSync(path.dirname(target), { recursive: true });
    const blob = spawnSync('git', ['-C', cache, 'show', `${config.upstream_commit}:${rel}`], { maxBuffer: 64 * 1024 * 1024 });
    if (blob.status !== 0) throw new Error(`hidden test missing upstream: ${rel}`);
    writeFileSync(target, blob.stdout);
  }
}

// The lockfile is committed so every build installs the same tree; the first build creates it.
function installDependencies(config, checkout, depsDir) {
  const lockfile = path.join(benchmarkRoot, config.dependencies.lockfile);
  mkdirSync(depsDir, { recursive: true });
  copyFileSync(path.join(checkout, 'package.json'), path.join(depsDir, 'package.json'));
  if (!existsSync(lockfile)) {
    progress(`resolve dependencies into ${path.relative(projectRoot, lockfile)}`);
    run('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: depsDir });
    copyFileSync(path.join(depsDir, 'package-lock.json'), lockfile);
  }
  copyFileSync(lockfile, path.join(depsDir, 'package-lock.json'));
  progress('npm ci');
  run('npm', ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: depsDir });
}

function verifierRun(config, resultDir, args) {
  const env = {
    ...process.env,
    BENCH_WORKSPACE: resultDir, BENCH_PROMPT: path.join(resultDir, 'unused-prompt.txt'), BENCH_RESULT_DIR: resultDir,
    BENCH_MODEL: 'none', BENCH_UID: String(process.getuid()), BENCH_GID: String(process.getgid()),
    CURSOR_API_KEY_FILE: '/dev/null', BENCH_CURSOR_DATA: resultDir, BENCH_CURSOR_LOGS: resultDir,
  };
  writeFileSync(env.BENCH_PROMPT, '');
  const result = spawnSync('docker', ['compose', '-f', compose, 'run', '--rm', '--no-deps', '--entrypoint', 'node',
    'verifier', '/benchmark/verifiers/upstream-tests.cjs', '--config', `/benchmark/upstream/${config.task_id}.json`, ...args], {
    cwd: projectRoot, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function main() {
  const [taskId, ...flags] = process.argv.slice(2);
  if (!/^[a-z][a-z0-9-]*-[0-9]{3}$/.test(taskId ?? '')) throw new Error('usage: build-upstream-task.cjs <task> [--check-solution]');
  const configFile = path.join(benchmarkRoot, 'upstream', `${taskId}.json`);
  const config = JSON.parse(readFileSync(configFile, 'utf8'));
  const paths = fixturePaths(taskId, benchmarkRoot);
  const scratch = path.join(projectRoot, '.benchmarks', 'upstream-build', taskId);
  rmSync(scratch, { recursive: true, force: true });
  mkdirSync(scratch, { recursive: true });
  rmSync(paths.dir, { recursive: true, force: true });
  rmSync(paths.bundle, { force: true });

  const cache = upstreamCache(config);
  const commit = snapshotCommit(config, cache);
  if (!config.snapshot.commit) {
    config.snapshot.commit = commit;
    writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    progress(`snapshot.commit recorded: ${commit}`);
  } else if (config.snapshot.commit !== commit) {
    throw new Error(`snapshot commit ${commit} differs from the pinned ${config.snapshot.commit}`);
  }
  writeBundle(config, cache, commit, paths.bundle, scratch);
  writeHidden(config, cache, paths.hidden);

  const checkout = path.join(scratch, 'snapshot');
  git(['clone', '--quiet', paths.bundle, checkout], scratch);
  if (git(['rev-parse', 'HEAD'], checkout) !== commit) throw new Error('bundle does not check out the snapshot commit');
  installDependencies(config, checkout, path.join(paths.dir, 'deps'));

  progress('compute baseline in the verifier container');
  run('docker', ['compose', '-f', compose, 'build', 'verifier'], {
    cwd: projectRoot, env: { ...process.env, BENCH_WORKSPACE: '/tmp', BENCH_PROMPT: '/dev/null', BENCH_RESULT_DIR: '/tmp',
      BENCH_MODEL: 'none', CURSOR_API_KEY_FILE: '/dev/null', BENCH_CURSOR_DATA: '/tmp', BENCH_CURSOR_LOGS: '/tmp' },
  });
  const baselineDir = path.join(scratch, 'baseline');
  mkdirSync(baselineDir, { recursive: true });
  const baselineRun = verifierRun(config, baselineDir,
    ['--baseline', '--work-dir', '/result/work', '--output', '/result/baseline.json']);
  if (baselineRun.status !== 0 || !existsSync(path.join(baselineDir, 'baseline.json'))) {
    throw new Error(`baseline failed: ${baselineRun.stderr || baselineRun.stdout}`);
  }
  copyFileSync(path.join(baselineDir, 'baseline.json'), paths.baseline);
  const baseline = JSON.parse(readFileSync(paths.baseline, 'utf8'));
  progress(`baseline: ${baseline.passing.length} passing, ${baseline.failing.length} failing (${baseline.failing.join(', ') || '-'})`);

  const summary = { task_id: taskId, snapshot: commit, bundle: path.relative(projectRoot, paths.bundle),
    baseline: { passing: baseline.passing.length, failing: baseline.failing } };
  if (flags.includes('--check-solution')) {
    const hidden = new Set(config.hidden_tests);
    const changed = git(['diff', '--name-only', config.upstream_parent, config.upstream_commit], cache).split('\n');
    const solutionPaths = changed.filter((file) => file && !hidden.has(file));
    for (const [name, files] of [['untouched', []], ['solution', solutionPaths]]) {
      const dir = path.join(scratch, name);
      mkdirSync(dir, { recursive: true });
      const patch = files.length
        ? spawnSync('git', ['-C', cache, 'diff', '--binary', config.upstream_parent, config.upstream_commit, '--', ...files],
          { maxBuffer: 64 * 1024 * 1024 }).stdout
        : Buffer.alloc(0);
      writeFileSync(path.join(dir, 'diff.patch'), patch);
      verifierRun(config, dir, ['--patch', '/result/diff.patch', '--work-dir', '/result/work', '--output', '/result/verifier.json']);
      const verdict = JSON.parse(readFileSync(path.join(dir, 'verifier.json'), 'utf8'));
      summary[name] = { score: verdict.score, error: verdict.error,
        criteria: verdict.criteria.map((row) => `${row.id}=${row.awarded}/${row.points}`).join(' ') };
      progress(`${name}: score ${verdict.score} ${summary[name].criteria}${verdict.error ? ` error: ${verdict.error}` : ''}`);
    }
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main();
