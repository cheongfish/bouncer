'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readDoc } = require('../scripts/lib/frontmatter');
const { executeVerify, runVerification } = require('../scripts/lib/verification');

const BP_REL = '.bouncer/context/epics/EPIC-001-auth/blueprints/BP-001-login';

function setupRepo(verify = 'npm test') {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-verification-'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify }));
  const verification = path.join(repo, BP_REL, 'verification.md');
  fs.mkdirSync(path.dirname(verification), { recursive: true });
  fs.writeFileSync(verification, `---
type: bouncer.verification
title: Verify BP-001
description: Verification evidence
resource: ${BP_REL}/verification.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: VERIFY-BP-001
  epic_id: EPIC-001
  blueprint_id: BP-001
  status: pending
---
# Verification

Existing notes.
`);
  return repo;
}

test('runVerification records successful command evidence', () => {
  const repo = setupRepo();
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: (command, options) => {
      assert.strictEqual(command, 'npm test');
      assert.strictEqual(options.cwd, repo);
      return { stdout: 'line one\nline two\n', stderr: '' };
    },
  });

  assert.deepStrictEqual(result, { ok: true, command: 'npm test', exitCode: 0 });
  const verification = readDoc(path.join(repo, BP_REL, 'verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'passed');
  assert.deepStrictEqual(verification.data.bouncer.verification, {
    command: 'npm test',
    ran_at: '2026-07-27T00:00:00.000Z',
    exit_code: 0,
    output_tail: 'line one\nline two',
  });
  assert.match(verification.body, /## Command\n`npm test`/);
  assert.match(verification.body, /## Evidence[\s\S]*Exit code: 0/);
});

test('runVerification records failed command evidence', () => {
  const repo = setupRepo();
  const failure = new Error('command failed');
  failure.status = 7;
  failure.stdout = 'partial output\n';
  failure.stderr = 'failure output\n';

  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: () => { throw failure; },
  });

  assert.deepStrictEqual(result, { ok: false, command: 'npm test', exitCode: 7 });
  const verification = readDoc(path.join(repo, BP_REL, 'verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'failed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 7);
  assert.strictEqual(verification.data.bouncer.verification.output_tail, 'partial output\nfailure output');
  assert.match(verification.body, /Exit code: 7/);
});

test('runVerification rejects a missing configured command', () => {
  const repo = setupRepo('');
  assert.throws(
    () => runVerification({ repoRoot: repo, blueprintDir: BP_REL }),
    { code: 'VERIFY_CONFIG_INVALID' },
  );
});

test('runVerification rejects a missing verification document', () => {
  const repo = setupRepo();
  fs.rmSync(path.join(repo, BP_REL, 'verification.md'));
  assert.throws(
    () => runVerification({ repoRoot: repo, blueprintDir: BP_REL }),
    { code: 'VERIFY_DOCUMENT_MISSING' },
  );
});

test('runVerification rejects a non-canonical blueprint path before execution', () => {
  const repo = setupRepo();
  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: '../../outside',
      exec: () => { throw new Error('must not execute'); },
    }),
    { code: 'VERIFY_BLUEPRINT_INVALID' },
  );
});

test('executeVerify accepts successful commands with over one megabyte of output', () => {
  const result = executeVerify(
    'node -e "process.stdout.write(\'x\'.repeat(1048577))"',
    { cwd: process.cwd() },
  );
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.exitCode, 0);
});
