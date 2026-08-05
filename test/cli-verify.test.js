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

const BP_REL = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

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
    bouncer: { id, epic_id: 'EPIC-001', blueprint_id: 'BP-001', status, ...extra },
  };
}

function setupRepo(verify = 'node -e "process.exit(0)"') {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-verify-'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify }));
  writeDoc(repo, '.bouncer/context/epics/EPIC-001-auth/index.md',
    doc('bouncer.epic', 'EPIC-001', 'approved', '.bouncer/context/epics/EPIC-001-auth/index.md'),
    '# Epic\n');
  ensureEpicIndexEntry({
    repoRoot: repo, epicId: 'EPIC-001', name: 'auth', description: 'Epic EPIC-001',
  });
  writeDoc(repo, `${BP_REL}/index.md`,
    doc('bouncer.blueprint', 'BP-001', 'approved', `${BP_REL}/index.md`),
    '# Blueprint\n');
  writeDoc(repo, `${BP_REL}/tasks.md`,
    doc('bouncer.tasks', 'TASKS-BP-001', 'verified', `${BP_REL}/tasks.md`, {
      affected_paths: ['src/login.js'],
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
    }),
    '# Tasks\n\n## Goal & intent\nx\n\n## Interface\ny\n\n'
    + '## Touch\n`src/`\n\n## Do not touch\n`test/`\n\n## Checklist\n- [ ] z\n');
  writeDoc(repo, `${BP_REL}/verification.md`,
    doc('bouncer.verification', 'VERIFY-BP-001', 'pending', `${BP_REL}/verification.md`),
    '# Verification\n');
  writeDoc(repo, `${BP_REL}/review.md`,
    doc('bouncer.review', 'REVIEW-BP-001', 'pending', `${BP_REL}/review.md`, {
      review: { required: false },
    }),
    '# Review\n');
  writeDoc(repo, `${BP_REL}/explain.md`,
    doc('bouncer.explain', 'EXPLAIN-BP-001', 'draft', `${BP_REL}/explain.md`),
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
  const verification = readDoc(path.join(repo, BP_REL, 'verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'passed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 0);
});

test('execute gate reruns verification before evaluating gates', () => {
  const repo = setupRepo();
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'execute'], io);

  assert.strictEqual(code, 0);
  assert.strictEqual(JSON.parse(buf.out).ok, true);
  const verification = readDoc(path.join(repo, BP_REL, 'verification.md'));
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
  const verification = readDoc(path.join(repo, BP_REL, 'verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'failed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 7);
});
