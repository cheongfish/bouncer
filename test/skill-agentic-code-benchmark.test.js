'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
