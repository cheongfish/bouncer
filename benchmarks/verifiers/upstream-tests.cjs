#!/usr/bin/env node
'use strict';

// Verifier for upstream-commit tasks (benchmarks/upstream/<task>.json).
//
//   upstream-tests.cjs --config upstream/<task>.json --patch <diff> --work-dir <dir> --output <json>
//   upstream-tests.cjs --config upstream/<task>.json --baseline --work-dir <dir> --output <json>
//
// The second form grades nothing: it records which regression files pass on the untouched snapshot.
// build-upstream-task.cjs runs it in this same container so the baseline and grading share one runtime.

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { checkoutWithPatch } = require('./lib.cjs');
const {
  computeBaseline, fixturePaths, grade, linkDependencies, loadUpstreamConfig, writeHiddenTests,
} = require('./upstream-lib.cjs');

const usage = 'usage: upstream-tests.cjs --config <json> (--patch <diff> | --baseline) --work-dir <dir> --output <json>';

function parseArgs(argv) {
  const options = { baseline: false };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--baseline') { options.baseline = true; continue; }
    const value = argv[++index];
    if (!['--config', '--patch', '--work-dir', '--output'].includes(flag) || !value || options[flag]) throw new Error(usage);
    options[flag] = path.resolve(value);
  }
  if (!options['--config'] || !options['--work-dir'] || !options['--output']) throw new Error(usage);
  if (options.baseline === Boolean(options['--patch'])) throw new Error(usage);
  return options;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const config = loadUpstreamConfig(options['--config']);
  const paths = fixturePaths(config.task_id);
  const workDir = options['--work-dir'];
  const result = {
    task_id: config.task_id,
    rubric_version: config.rubric_version,
    base_commit: config.snapshot.commit,
    upstream: { repo: config.repo, commit: config.upstream_commit },
    judge_status: 'unjudgeable',
    score: null,
    max_score: 100,
    outcome_success: null,
    criteria: [],
    commands: [],
    error: null,
  };
  try {
    if (options.baseline) {
      checkoutWithPatch(paths.bundle, config.snapshot.commit, workDir, '/dev/null');
      linkDependencies(paths, workDir);
      const baseline = await computeBaseline(config, workDir);
      write(options['--output'], baseline);
      process.stdout.write(`baseline: ${baseline.passing.length} passing, ${baseline.failing.length} failing\n`);
      return;
    }
    const baseline = JSON.parse(readFileSync(paths.baseline, 'utf8'));
    if (baseline.snapshot !== config.snapshot.commit) throw new Error('baseline was computed for another snapshot');
    result.submission_sha256 = checkoutWithPatch(paths.bundle, config.snapshot.commit, workDir, options['--patch']);
    writeHiddenTests(config, paths, workDir);
    linkDependencies(paths, workDir);
    const graded = await grade(config, workDir, baseline);
    Object.assign(result, graded, { judge_status: 'graded', outcome_success: graded.score === 100 });
  } catch (error) {
    result.error = error.message;
  }
  write(options['--output'], result);
  process.stdout.write(`${JSON.stringify({ score: result.score, judge_status: result.judge_status, error: result.error })}\n`);
  if (result.judge_status !== 'graded') process.exitCode = 1;
}

function write(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

main();
