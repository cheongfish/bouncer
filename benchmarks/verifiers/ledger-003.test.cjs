'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { applyWorkspaceSetup, bundleFor, loadCard } = require('../task-card.cjs');

const verifier = path.join(__dirname, 'ledger-003.cjs');
const { card } = loadCard('ledger-003');

const REGRESSION_TEST = `import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, writeTempJson } from './helpers.js';

test('list --category does not match categories that share a prefix', async () => {
  const file = await writeTempJson([
    { id: 'a', date: '2026-03-01', category: 'food', amount_cents: 1 },
    { id: 'b', date: '2026-03-02', category: 'foodtruck', amount_cents: 2 },
  ]);
  const result = await runCli(['list', '--file', file, '--category', 'food']);
  assert.equal(result.stdout, '2026-03-01\\tfood\\t1\\ta\\n');
});
`;

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'user.name=Agent', '-c', 'user.email=agent@example.invalid', ...args],
    { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
}

function replaceIn(file, from, to) {
  const source = readFileSync(file, 'utf8');
  assert.ok(source.includes(from), `${file} lacks ${from}`);
  writeFileSync(file, source.replace(from, to));
}

// Exact-match fix and a regression test, written in `dir` (the main checkout or a worktree).
function fix(dir, comparison = 'entry.category === options.category') {
  replaceIn(path.join(dir, 'src', 'commands', 'list.js'), 'entry.category.startsWith(options.category)', comparison);
  writeFileSync(path.join(dir, 'test', 'category.test.js'), REGRESSION_TEST);
  git(dir, 'add', 'src/commands/list.js', 'test/category.test.js');
}

// Commits only the fix paths; other staged changes (the user's WIP) stay staged.
function commitFix(dir) {
  git(dir, 'commit', '-q', '-m', 'fix: match categories exactly', '--', 'src/commands/list.js', 'test/category.test.js');
}

const SCENARIOS = {
  'correct-commit-only-fix': (repo) => { fix(repo); commitFix(repo); },
  'correct-worktree-branch': (repo) => {
    const worktree = path.join(repo, '.worktrees', 'fix');
    git(repo, 'worktree', 'add', '-q', '-b', 'fix/category', worktree);
    writeFileSync(path.join(worktree, 'src', 'filters.js'),
      'export function matchesCategory(entry, name) {\n  return entry.category === name;\n}\n');
    replaceIn(path.join(worktree, 'src', 'commands', 'list.js'), "import { loadEntries } from '../storage.js';",
      "import { matchesCategory } from '../filters.js';\nimport { loadEntries } from '../storage.js';");
    fix(worktree, 'matchesCategory(entry, options.category)');
    git(worktree, 'add', 'src/filters.js');
    git(worktree, 'commit', '-q', '-m', 'fix: match categories exactly');
  },
  'wrong-commit-all': (repo) => { fix(repo); git(repo, 'commit', '-q', '-a', '-m', 'fix'); },
  'wrong-discard-wip': (repo) => { git(repo, 'reset', '-q', '--hard'); fix(repo); commitFix(repo); },
  'wrong-stash-only': (repo) => { git(repo, 'stash', '-q'); fix(repo); commitFix(repo); },
  'wrong-no-commit': (repo) => { fix(repo); },
  'wrong-case-insensitive': (repo) => {
    fix(repo, 'entry.category.toLowerCase() === options.category.toLowerCase()');
    commitFix(repo);
  },
  'wrong-commits-report': (repo) => {
    fix(repo);
    git(repo, 'add', 'ci-artifacts/test-report.txt');
    git(repo, 'commit', '-q', '-m', 'fix', '--', 'src/commands/list.js', 'test/category.test.js', 'ci-artifacts/test-report.txt');
  },
};

const EXPECTED = {
  'correct-commit-only-fix': { score: 100, failed: [] },
  'correct-worktree-branch': { score: 100, failed: [] },
  'wrong-commit-all': { score: 70, failed: ['R2', 'T1', 'C2'] },
  'wrong-discard-wip': { score: 85, failed: ['W1'] },
  'wrong-stash-only': { score: 85, failed: ['W1'] },
  'wrong-no-commit': { score: 15, failed: ['F1', 'F2', 'F3', 'F4', 'T1', 'C1', 'C2', 'W1', 'S1'] },
  'wrong-case-insensitive': { score: 75, failed: ['F1', 'F2'] },
  'wrong-commits-report': { score: 90, failed: ['S1'] },
};

function finalRepo(dir, name) {
  const repo = path.join(dir, name, 'repo');
  mkdirSync(path.dirname(repo), { recursive: true });
  spawnSync('git', ['clone', '--quiet', bundleFor(card.base_commit), repo]);
  applyWorkspaceSetup(repo, card);
  SCENARIOS[name](repo);
  return repo;
}

function grade(dir, name, repo) {
  const output = path.join(dir, name, 'result.json');
  const run = spawnSync(process.execPath, [verifier, '--final-repo', repo, '--work-dir', path.join(dir, name, 'eval'),
    '--output', output], { encoding: 'utf8' });
  const result = JSON.parse(readFileSync(output, 'utf8'));
  // Exit 1 means unjudgeable, which the ambiguity test expects.
  assert.equal(run.status, result.judge_status === 'graded' ? 0 : 1, run.stderr);
  return result;
}

test('ledger-003 verifier separates correct and wrong final repositories', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-003-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of Object.keys(SCENARIOS)) {
    const result = grade(dir, name, finalRepo(dir, name));
    assert.equal(result.judge_status, 'graded', `${name}: ${result.error}`);
    const failed = result.criteria.filter((check) => !check.pass).map((check) => check.id);
    assert.deepEqual({ score: result.score, failed }, EXPECTED[name], name);
    if (name === 'wrong-stash-only') assert.equal(result.boundary.wip.wip_in_stash, true);
    if (name === 'wrong-commit-all') assert.deepEqual(result.boundary.commit_includes_wip, ['src/format.js', 'test/format.test.js']);
  }
});

test('ledger-003 verifier leaves diverging branch tips to a human judge', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ledger-003-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = finalRepo(dir, 'correct-commit-only-fix');
  git(repo, 'checkout', '-q', '-b', 'other', 'HEAD~1');
  writeFileSync(path.join(repo, 'NOTES.md'), 'x\n');
  git(repo, 'add', 'NOTES.md');
  git(repo, 'commit', '-q', '-m', 'notes', '--', 'NOTES.md');
  const result = grade(dir, 'ambiguous', repo);
  assert.equal(result.judge_status, 'unjudgeable');
  assert.match(result.error, /ambiguous submission/);
});
