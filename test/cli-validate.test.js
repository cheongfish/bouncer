'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { runCli } = require('../scripts/lib/cli');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data) {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n# x\n`);
}

function capture() {
  const buf = { out: '', err: '' };
  return {
    io: { out: (s) => { buf.out += s; }, err: (s) => { buf.err += s; } },
    buf,
  };
}

test('validate emits JSON and exit 1 on failure', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks', title: 't', description: 'd', resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready', affected_paths: [] },
  });
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo, '--blueprint', BP_REL], io);
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.failures.some((f) => f.code === 'S7'));
});

test('validate --gate plan includes G18 when context-review.md is missing', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const tasksBody = `# Tasks

## Goal & intent
Ship login validation.

## Interface
\`validateLogin(input) -> Result\`

## Touch
- \`src/auth/\`

## Do not touch
- \`src/payments/\`

## Checklist
- [ ] implement validateLogin
`;
  writeDoc(repo, '.bouncer/context/epics/001-auth/index.md', {
    type: 'bouncer.epic', title: 'Auth epic', description: 'auth epic',
    resource: '.bouncer/context/epics/001-auth/index.md',
    tags: ['bouncer', 'epic'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', status: 'approved' },
  });
  writeDoc(repo, `${BP_REL}/index.md`, {
    type: 'bouncer.blueprint', title: 'Login blueprint', description: '001',
    resource: `${BP_REL}/index.md`,
    tags: ['bouncer', 'blueprint'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '001', blueprint_id: '001', status: 'approved' },
  });
  const tasksRel = `${BP_REL}/tasks/001/tasks.md`;
  const abs = path.join(repo, tasksRel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump({
    type: 'bouncer.tasks', title: 'Login tasks', description: 'Tasks for 001',
    resource: tasksRel, tags: ['bouncer', 'tasks'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: {
      id: 'TASKS-001', epic_id: '001', blueprint_id: '001', status: 'ready',
      graph: { suggested_paths: ['src/'], basis: 'manual: src/' },
      affected_paths: ['src/auth/login.js'],
    },
  })}---\n${tasksBody}`);
  writeDoc(repo, `${BP_REL}/tasks/001/verification.md`, {
    type: 'bouncer.verification', title: 'Verify 001', description: 'v',
    resource: `${BP_REL}/tasks/001/verification.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'VERIFY-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  writeDoc(repo, `${BP_REL}/tasks/001/review.md`, {
    type: 'bouncer.review', title: 'Review 001', description: 'r',
    resource: `${BP_REL}/tasks/001/review.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: 'REVIEW-001', epic_id: '001', blueprint_id: '001', status: 'pending' },
  });
  const indexAbs = path.join(repo, '.bouncer/context/index.md');
  fs.mkdirSync(path.dirname(indexAbs), { recursive: true });
  fs.writeFileSync(
    indexAbs,
    '---\nokf_version: "0.1"\n---\n# Epics\n\n'
    + '* [001 auth](epics/001-auth/index.md) - Epic 001\n',
  );
  const { io, buf } = capture();
  const code = runCli(
    ['validate', '--repo', repo, '--blueprint', BP_REL, '--gate', 'plan'],
    io,
  );
  assert.strictEqual(code, 1);
  const parsed = JSON.parse(buf.out);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.failures.some((f) => f.code === 'G18'));
});

test('unknown command exits 2', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['frobnicate'], io), 2);
});

test('profile and import-superpowers commands are unsupported', () => {
  const { io } = capture();
  assert.strictEqual(runCli(['profile'], io), 2);
  assert.strictEqual(runCli(['import-superpowers'], io), 2);
});

test('validate without --blueprint exits 2 and does not report ok:true', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['validate', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(!buf.out.includes('"ok": true'));
  assert.ok(buf.err.length > 0);
});

test('finalize without --blueprint exits 2', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-'));
  const { io, buf } = capture();
  const code = runCli(['finalize', '--repo', repo], io);
  assert.strictEqual(code, 2);
  assert.ok(buf.err.length > 0);
});
