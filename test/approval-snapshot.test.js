'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { computeApprovalDigest } = require('../scripts/lib/approval-snapshot');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function writeDoc(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${yaml.dump(data)}---\n${body}`);
}

function writeTask(repo, {
  affected_paths = ['src/auth/login.js'],
  verify,
} = {}) {
  const bouncer = {
    id: 'TASKS-001',
    epic_id: '001',
    blueprint_id: '001',
    status: 'ready',
    affected_paths,
  };
  if (verify !== undefined) bouncer.verify = verify;
  writeDoc(repo, `${BP_REL}/tasks/001/tasks.md`, {
    type: 'bouncer.tasks',
    title: 'Login tasks',
    description: 'Tasks for 001',
    resource: `${BP_REL}/tasks/001/tasks.md`,
    tags: ['bouncer', 'tasks'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer,
  });
}

function writeAllowlist(repo, allowlist) {
  const abs = path.join(repo, '.bouncer', 'config.json');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify({ verify_allowlist: allowlist }, null, 2)}\n`);
}

function changedPartNames(before, after) {
  return Object.keys({ ...before.parts, ...after.parts })
    .filter((key) => before.parts[key] !== after.parts[key])
    .sort();
}

test('computeApprovalDigest changes only the matching part for path, verify, and allowlist', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-approval-digest-'));
  writeTask(repo, { affected_paths: ['src/auth/login.js'], verify: 'npm test' });
  writeAllowlist(repo, ['npm']);
  const a = computeApprovalDigest({ repoRoot: repo, blueprintDir: BP_REL });

  writeTask(repo, {
    affected_paths: ['src/auth/login.js', 'src/auth/session.js'],
    verify: 'npm test',
  });
  const afterPaths = computeApprovalDigest({ repoRoot: repo, blueprintDir: BP_REL });
  assert.notStrictEqual(afterPaths.digest, a.digest);
  assert.deepStrictEqual(changedPartNames(a, afterPaths), ['TASKS-001.affected_paths']);

  writeTask(repo, {
    affected_paths: ['src/auth/login.js', 'src/auth/session.js'],
    verify: 'node -e 0',
  });
  const afterVerify = computeApprovalDigest({ repoRoot: repo, blueprintDir: BP_REL });
  assert.notStrictEqual(afterVerify.digest, afterPaths.digest);
  assert.deepStrictEqual(changedPartNames(afterPaths, afterVerify), ['TASKS-001.verify']);

  writeAllowlist(repo, ['npm', 'node']);
  const afterAllowlist = computeApprovalDigest({ repoRoot: repo, blueprintDir: BP_REL });
  assert.notStrictEqual(afterAllowlist.digest, afterVerify.digest);
  assert.deepStrictEqual(changedPartNames(afterVerify, afterAllowlist), ['verify_allowlist']);
});
