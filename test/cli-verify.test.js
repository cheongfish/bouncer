'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');
const { readDoc } = require('../scripts/lib/frontmatter');
const { ensureEpicIndexEntry } = require('../scripts/lib/epic-index');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data, body) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function doc(type, id, status, resource, extra = {}) {
  return {
    type,
    title: id,
    description: id,
    resource,
    tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00.000Z',
    bouncer: { id, epic_id: '001', blueprint_id: '001', status, ...extra },
  };
}

function setupRepo(verify = 'node -e "process.exit(0)"') {
  const { execFileSync } = require('node:child_process');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-verify-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify }));
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md',
    doc('bouncer.epic', '001', 'approved', '.bouncer/context/epics/001-auth/index.md'),
    '# Epic\n');
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: '001', name: 'auth', description: 'Epic 001',
  });
  writeDoc(repo, `${BP_REL}/index.md`,
    doc('bouncer.blueprint', '001', 'approved', `${BP_REL}/index.md`),
    '# Blueprint\n');
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`,
    doc('bouncer.tasks', 'TASKS-001', 'verified', `${BP_REL}/tasks/001/tasks.md`, {
      affected_paths: ['src/login.js'],
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
    }),
    '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n'
    + '## Touch\n`src/`\n\n## Do not touch\n`test/`\n\n## Checklist\n- [ ] z\n');
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`,
    doc('bouncer.verification', 'VERIFY-001', 'pending', `${BP_REL}/tasks/001/verification.md`),
    '# Verification\n');
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`,
    doc('bouncer.review', 'REVIEW-001', 'pending', `${BP_REL}/tasks/001/review.md`, {
      review: { required: false },
    }),
    '# Review\n');
  writeDoc(repo, `${BP_REL}/explain.md`,
    doc('bouncer.explain', 'EXPLAIN-001', 'draft', `${BP_REL}/explain.md`),
    '# Explain\n');
  return repo;
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('verify executes the configured command and records evidence', () => {
  const repo = setupRepo();
  const { io, buf } = capture();
  const code = runCli(['verify', '--repo', repo, '--blueprint', BP_REL], io);

  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(buf.out).ok, true);
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'passed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 0);
  const { verifyLedgerPathFor } = require('../scripts/lib/runtime-state');
  const rel = `${BP_REL}/tasks/001/verification.md`;
  const paths = verifyLedgerPathFor({ repoRoot: repo, verificationRel: rel });
  const record = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  assert.strictEqual(record.rel, rel);
  assert.strictEqual(record.exit_code, 0);
  assert.strictEqual(record.command, verification.data.bouncer.verification.command);
});

test('execute gate reruns verification before evaluating gates', () => {
  const repo = setupRepo();
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'execute'], io);

  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(buf.out).ok, true);
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.verification.command, 'node -e "process.exit(0)"');
});

test('execute gate records failure and returns a gate failure', () => {
  const repo = setupRepo('node -e "process.exit(7)"');
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'execute'], io);

  assert.strictEqual(code, 1);
  const result = JSON.parse(buf.out);
  assert.strictEqual(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.code === 'G13'));
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'failed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 7);
});

test('verify records evidence into the pointer task-dir unit', () => {
  const { writeCurrent } = require('../scripts/lib/current');
  const { execFileSync } = require('node:child_process');
  const repo = setupRepo('node -e "process.exit(0)"');
  // 묶음 001은 그대로 두고, 새 묶음 002만 포인터로 지목한다.
  const u2 = `${BP_REL}/tasks/002`;
  writeDoc(repo, `${u2}/tasks.md`,
    doc('bouncer.tasks', 'TASKS-002', 'verified', `${u2}/tasks.md`, {
      affected_paths: ['src/login.js'],
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
    }),
    '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n'
    + '## Touch\n`src/`\n\n## Do not touch\n`test/`\n\n## Checklist\n- [ ] z\n');
  writeDoc(repo, `${u2}/verification.md`,
    doc('bouncer.verification', 'VERIFY-002', 'pending', `${u2}/verification.md`),
    '# Verification\n');
  writeDoc(repo, `${u2}/review.md`,
    doc('bouncer.review', 'REVIEW-002', 'pending', `${u2}/review.md`, {
      review: { required: false },
    }),
    '# Review\n');

  const unit001Before = fs.readFileSync(path.join(repo, BP_REL, 'tasks/001/verification.md'), 'utf8');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${u2}/tasks.md`,
  });

  const { io, buf } = capture();
  const code = runCli(['verify', '--repo', repo, '--blueprint', BP_REL], io);
  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(buf.out).ok, true);

  const unit = readDoc(path.join(repo, `${u2}/verification.md`));
  assert.strictEqual(unit.data.bouncer.verification.exit_code, 0);
  assert.strictEqual(
    fs.readFileSync(path.join(repo, BP_REL, 'tasks/001/verification.md'), 'utf8'),
    unit001Before,
  );
});
