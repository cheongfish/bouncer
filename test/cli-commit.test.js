// test/cli-commit.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { computeDiffSha } = require('../scripts/lib/comprehension');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

const EXPLAIN_BODY = `# Explain

## Background
Auth validation moved to the edge.

## Intuition
Reject bad input early.

## Code
src/auth/login.ts

## Quiz
Where does validation live?

## 이해 상태
Recorded after review.
`;

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function initGitWithChange(repo) {
  const run = (args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  run(['init', '-b', 'work']);
  run(['config', 'user.email', 't@example.com']);
  run(['config', 'user.name', 't']);
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  run(['add', 'README']);
  run(['commit', '-m', 'base']);
  run(['branch', 'develop']);
  fs.mkdirSync(path.join(repo, 'src/auth'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export {}\n');
  run(['add', 'src/auth/login.ts']);
  run(['commit', '-m', 'change']);
}

function fullBlueprint(repo, { comprehensionOk = true } = {}) {
  initGitWithChange(repo);
  const epicDir = '.bouncer/context/epics/001-auth';
  writeDoc(repo, `${epicDir}/index.md`, {
    type: 'bouncer.epic', title: 'Auth', description: 'd', resource: `${epicDir}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'd',
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login', description: 'd', resource: `${BP_REL}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 'Impl login', description: 'd',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'verified',
      affected_paths: ['src/auth/'],
    },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verified', description: 'd',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'passed' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review', description: 'd',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'accepted',
      review: { required: false, reason: 'fixture' },
    },
  });

  let comprehension = [];
  let body = EXPLAIN_BODY;
  if (comprehensionOk) {
    const hashed = computeDiffSha({ repoRoot: repo, base: 'develop' });
    assert.strictEqual(hashed.ok, true);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repo, encoding: 'utf8',
    }).trim();
    comprehension = [{
      task: '001',
      range_from: 'develop',
      range_to: head,
      diff_sha: hashed.sha,
      quiz_score: '1/5',
      disposition: 'accepted',
      recorded_at: '2026-07-01T00:00:00+09:00',
    }];
  } else {
    body = `# Explain

## Background
<!-- empty -->

## Intuition
<!-- empty -->

## Code
<!-- empty -->

## Quiz
<!-- empty -->

## 이해 상태
<!-- empty -->
`;
  }

  writeDoc(repo, `${BP_REL}/explain.md`, {
    type: 'bouncer.explain', title: 'Explain', description: 'd',
    resource: `${BP_REL}/explain.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'EXPLAIN-001', epic_id: '001', blueprint_id: '001', status: 'published',
      comprehension,
    },
  }, body);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('commit without --blueprint exits 2 and keeps stdout pipe-clean of ok:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['commit', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(buf.err.length > 0);
  assert.ok(!buf.out.includes('"ok": true'));
});

test('commit gate failure exits non-zero with JSON { ok:false, reason:validate }', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo, { comprehensionOk: false });
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL],
    io,
  );
  assert.notStrictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.strictEqual(parsed.reason, 'validate');
  assert.ok(Array.isArray(parsed.failures));
  assert.ok(parsed.failures.some((f) => f.code === 'G15'));
});

test('commit dry-run exits 0 with dryRun JSON', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  // Working tree clean relative to HEAD — dry-run still succeeds with empty staged.
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL],
    io,
  );
  assert.strictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.dryRun, true);
  assert.ok('commitMessage' in parsed);
  assert.ok('nextTask' in parsed);
  assert.ok(Array.isArray(parsed.staged));
});

test('commit --yes stages in-scope change and returns committed:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  fullBlueprint(repo);
  // HEAD 위에 범위 안 변경을 남겨 realGit 경로의 커밋을 검증한다.
  fs.writeFileSync(path.join(repo, 'src/auth/login.ts'), 'export const x = 1;\n');
  const { io, buf } = capture();
  const code = runCli(
    ['commit', '--repo', repo, '--blueprint', BP_REL, '--yes'],
    io,
  );
  assert.strictEqual(code, 0);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.committed, true);
  assert.ok(parsed.staged.includes('src/auth/login.ts'));
  assert.ok(typeof parsed.commitMessage === 'string' && parsed.commitMessage.length > 0);
  const dirty = execFileSync('git', ['status', '--porcelain'], {
    cwd: repo, encoding: 'utf8',
  }).trim();
  assert.strictEqual(dirty, '');
});
