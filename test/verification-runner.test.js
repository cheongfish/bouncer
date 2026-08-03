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
    ran_at: '2026-07-27T09:00:00.000+09:00',
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

// A passing run's value is the exit code and the summary; a failing run's value
// is the output. Recording the full tail twice — frontmatter and body — put a
// couple of hundred lines into every commit.
const noisyCommand = (lines, exitCode) => 'node -e "'
  + `for(let i=1;i<=${lines};i++)console.log('line '+i);process.exit(${exitCode})`
  + '"';

test('a passing verification keeps no output block in the body', () => {
  const repo = setupRepo(noisyCommand(300, 0));
  runVerification({ repoRoot: repo, blueprintDir: BP_REL });
  const { data, body } = readDoc(path.join(repo, BP_REL, 'verification.md'));

  assert.ok(!body.includes('```'), `body should carry no code block:\n${body}`);
  assert.match(body, /## Command/);
  assert.match(body, /Exit code: 0/);
  assert.ok(body.split('\n').length < 15, `body should stay short:\n${body}`);

  const tail = data.bouncer.verification.output_tail.split('\n');
  assert.ok(tail.length <= 20, `a passing run records a short tail, got ${tail.length}`);
  assert.strictEqual(tail[tail.length - 1], 'line 300', 'the tail ends at the last line printed');
});

test('a failing verification keeps the output where a reader will see it', () => {
  const repo = setupRepo(noisyCommand(300, 3));
  runVerification({ repoRoot: repo, blueprintDir: BP_REL });
  const { data, body } = readDoc(path.join(repo, BP_REL, 'verification.md'));

  assert.match(body, /Exit code: 3/);
  assert.ok(body.includes('```'), 'a failure keeps its output block');
  assert.ok(body.includes('line 300'), 'the body shows the end of the output');

  const tail = data.bouncer.verification.output_tail.split('\n');
  assert.ok(tail.length > 20, `a failing run records more than a passing one, got ${tail.length}`);
  assert.ok(tail.length <= 100, `bounded at the failure limit, got ${tail.length}`);
});
