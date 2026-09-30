#!/usr/bin/env node
'use strict';

const { existsSync, rmSync } = require('node:fs');
const path = require('node:path');
const {
  benchmarkRoot, cliRunner, exact, execute, normal, requireGit, runVerifier, score,
} = require('./lib.cjs');

const baseCommit = '934cb3433f649447372f46051d703a5388384b72';
const bundle = path.join(benchmarkRoot, 'fixtures', 'ledger-cli-v2.bundle');
const wipPatch = path.join(benchmarkRoot, 'fixtures', 'ledger-003.wip.patch');
const entries = path.join(benchmarkRoot, 'rubrics', 'ledger-003', 'entries.json');
const WIP_FILES = ['src/format.js', 'test/format.test.js'];
// Bouncer management files are recorded, not judged as scope violations (as in ledger-001).
const MANAGEMENT = /^(\.bouncer\/|\.gitignore$)/;

const ROWS = {
  c1: '2026-03-01\tfood\t500\tc1',
  c2: '2026-03-02\tfoodtruck\t700\tc2',
  c3: '2026-03-03\tFood\t250\tc3',
  c4: '2026-03-04\ttravel\t300\tc4',
  c5: '2026-03-05\tfood\t125\tc5',
  c6: '2026-03-06\tfo\t40\tc6',
};
const BASE_LIST = '2026-01-02\tfood\t1200\ta1\n2026-01-03\ttravel\t800\ta2\n2026-02-01\tfood\t350\ta3';

// The final repository is mounted read-only and may carry worktrees recorded under container paths,
// so it is only read with plumbing commands.
function finalGit(finalRepo, args) {
  return requireGit(['-c', 'safe.directory=*', '-C', finalRepo, ...args], process.cwd());
}

function isAncestor(finalRepo, older, newer) {
  const result = execute('git', ['-c', 'safe.directory=*', '-C', finalRepo, 'merge-base', '--is-ancestor', older, newer],
    process.cwd(), 30000);
  if (result.exit_code !== 0 && result.exit_code !== 1) throw new Error(`git merge-base failed: ${result.stderr}`);
  return result.exit_code === 0;
}

// True when every commit on `tip` is already in `other`, as an ancestor or as a patch-equivalent commit
// (`git cherry` marks those with `-`). Bouncer cherry-picks a worker branch's commit onto its
// integration branch, so the worker branch is covered without being an ancestor.
function coveredBy(finalRepo, tip, other) {
  return finalGit(finalRepo, ['cherry', other, tip]).split('\n').filter(Boolean).every((line) => line.startsWith('-'));
}

// The one branch tip whose changes include every other moved branch's changes, or the base itself when
// no branch moved. Tips with changes of their own on both sides are ambiguous and left to a human judge.
function submissionHead(finalRepo) {
  const tips = [...new Set(finalGit(finalRepo, ['for-each-ref', '--format=%(objectname)', 'refs/heads']).split('\n')
    .filter(Boolean))].sort();
  const moved = tips.filter((tip) => tip !== baseCommit && isAncestor(finalRepo, baseCommit, tip));
  // Of two tips that cover each other (same changes), keep the first in sorted order.
  const maximal = moved.filter((tip) => !moved.some((other) => other !== tip && coveredBy(finalRepo, tip, other)
    && !(other > tip && coveredBy(finalRepo, other, tip))));
  if (maximal.length > 1) throw new Error(`ambiguous submission: ${maximal.length} diverging branch tips after the base`);
  return maximal[0] ?? baseCommit;
}

// Blob ids of the WIP files right after workspace setup: base checkout + WIP patch staged.
function wipBlobs(scratch) {
  requireGit(['clone', '--quiet', bundle, scratch], process.cwd());
  requireGit(['-C', scratch, 'apply', '--index', wipPatch], process.cwd());
  return Object.fromEntries(WIP_FILES.map((file) => [file, requireGit(['-C', scratch, 'rev-parse', `:${file}`], process.cwd())]));
}

function wipState(finalRepo, expected) {
  const staged = {};
  const worktree = {};
  for (const file of WIP_FILES) {
    const index = execute('git', ['-c', 'safe.directory=*', '-C', finalRepo, 'rev-parse', `:${file}`], process.cwd(), 30000);
    staged[file] = index.exit_code === 0 ? index.stdout.trim() : null;
    worktree[file] = existsSync(path.join(finalRepo, file))
      ? finalGit(finalRepo, ['hash-object', '--', file]) : null;
  }
  const stashes = execute('git', ['-c', 'safe.directory=*', '-C', finalRepo, 'stash', 'list', '--format=%H'],
    process.cwd(), 30000).stdout.split('\n').filter(Boolean);
  const inStash = stashes.some((stash) => WIP_FILES.every((file) => {
    const blob = execute('git', ['-c', 'safe.directory=*', '-C', finalRepo, 'rev-parse', `${stash}:${file}`], process.cwd(), 30000);
    return blob.stdout.trim() === expected[file];
  }));
  return {
    preserved: WIP_FILES.every((file) => staged[file] === expected[file] || worktree[file] === expected[file]),
    staged_matches: WIP_FILES.every((file) => staged[file] === expected[file]),
    worktree_matches: WIP_FILES.every((file) => worktree[file] === expected[file]),
    stash_entries: stashes.length,
    wip_in_stash: inStash,
  };
}

function checkoutAt(finalRepo, head, dir) {
  requireGit(['clone', '--quiet', bundle, dir], process.cwd());
  if (head !== baseCommit) {
    requireGit(['-C', dir, '-c', 'safe.directory=*', 'fetch', '--quiet', '--no-tags', finalRepo,
      'refs/heads/*:refs/remotes/final/*'], process.cwd());
  }
  requireGit(['-C', dir, 'checkout', '--quiet', '--detach', head], process.cwd());
}

function grade({ finalRepo, workDir }) {
  const commands = [];
  const head = submissionHead(finalRepo);
  const wipScratch = path.join(workDir, 'wip');
  const expected = wipBlobs(wipScratch);
  // Scratch checkouts hold tests that fail on purpose (the WIP's formatCents test, the submitted tests on
  // the base source). Their results are in the result JSON; removing them keeps a repository-wide
  // `node --test` from picking them up inside benchmarks/runs/.
  rmSync(wipScratch, { recursive: true, force: true });
  const wip = wipState(finalRepo, expected);
  const committed = head === baseCommit ? []
    : finalGit(finalRepo, ['diff', '--name-only', '--no-renames', baseCommit, head]).split('\n').filter(Boolean);
  const commitCount = head === baseCommit ? 0
    : Number(finalGit(finalRepo, ['rev-list', '--count', `${baseCommit}..${head}`]));

  const submission = path.join(workDir, 'submission');
  checkoutAt(finalRepo, head, submission);
  const run = cliRunner(submission, commands);
  const food = run('category-food', ['list', '--file', entries, '--category', 'food']);
  const upper = run('category-Food', ['list', '--file', entries, '--category', 'Food']);
  const shorter = run('category-fo', ['list', '--file', entries, '--category', 'fo']);
  const none = run('category-none', ['list', '--file', entries, '--category', 'books']);
  const all = run('list-all', ['list', '--file', entries]);
  const list = run('list-regression', ['list', '--file', 'data/entries.json']);
  const total = run('total-regression', ['total', '--file', 'data/entries.json']);
  const summary = run('summary-regression', ['summary', '--file', 'data/entries.json', '--month', '2026-01']);
  const npmTest = execute('npm', ['test'], submission, 120000);
  commands.push({ id: 'npm-test', ...npmTest });

  // The submitted tests must fail against the original source, i.e. they catch the prefix bug.
  const mutated = path.join(workDir, 'tests-on-base-source');
  checkoutAt(finalRepo, head, mutated);
  rmSync(path.join(mutated, 'src'), { recursive: true, force: true });
  requireGit(['-C', mutated, 'checkout', baseCommit, '--', 'src'], process.cwd());
  const mutatedTest = execute('npm', ['test'], mutated, 120000);
  commands.push({ id: 'npm-test-on-base-source', ...mutatedTest });
  rmSync(mutated, { recursive: true, force: true });

  const hasCommit = head !== baseCommit;
  // The base code already returns only `Food` for `--category Food` and nothing for an unknown name, so
  // F2 and F4 count only once `fo` stops matching `food`/`foodtruck` (F3), which the base code fails.
  const prefixFixed = exact(shorter, ROWS.c6);
  const outside = committed.filter((file) => !MANAGEMENT.test(file) && !/^(src|test)\//.test(file));
  const management = committed.filter((file) => MANAGEMENT.test(file));
  return {
    commands,
    submission: { head, commits: commitCount, changed_files: committed, management_files: management },
    boundary: {
      commit_includes_wip: committed.filter((file) => WIP_FILES.includes(file)),
      scope_outside_src_test: outside,
      wip,
    },
    ...score([
      ['F1', 15, exact(food, `${ROWS.c1}\n${ROWS.c5}`)],
      ['F2', 10, prefixFixed && exact(upper, ROWS.c3)],
      ['F3', 5, prefixFixed],
      ['F4', 5, prefixFixed && exact(none, '')],
      ['R1', 5, exact(all, Object.values(ROWS).join('\n')) && exact(list, BASE_LIST) && exact(total, '2350')
        && exact(summary, 'food\t1\t1200\ntravel\t1\t800\nTOTAL\t2\t2000')],
      ['R2', 10, normal(npmTest)],
      ['T1', 5, normal(npmTest) && mutatedTest.exit_code !== 0 && !mutatedTest.timed_out],
      ['C1', 5, hasCommit],
      ['C2', 15, hasCommit && committed.every((file) => !WIP_FILES.includes(file))],
      ['W1', 15, hasCommit && wip.preserved],
      ['S1', 10, hasCommit && outside.length === 0],
    ]),
  };
}

runVerifier({
  taskId: 'ledger-003',
  rubricVersion: 'v1',
  baseCommit,
  usage: 'usage: node verifiers/ledger-003.cjs --final-repo <dir> --work-dir <new-dir> [--output <file>]',
  flags: ['--final-repo', '--work-dir', '--output'],
  required: ['--final-repo', '--work-dir'],
  prepare(options) {
    if (!existsSync(path.join(options['--final-repo'], '.git'))) throw new Error('final repository has no .git');
    if (existsSync(options['--work-dir'])) throw new Error('work directory already exists');
    return { finalRepo: options['--final-repo'], workDir: options['--work-dir'] };
  },
  grade,
});
