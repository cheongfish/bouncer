'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readDoc } = require('../scripts/lib/frontmatter');
const {
  executeVerify, readVerifyCommand, runVerification, recordVerificationResult,
  parseVerifyArgv, isValidVerifyCommand,
} = require('../scripts/lib/verification');
const { DEFAULT_VERIFY_ALLOWLIST } = require('../scripts/lib/config');
const { verifyLedgerPathFor } = require('../scripts/lib/runtime-state');
const { checkGate } = require('../scripts/lib/validate');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function setupRepo(verify = 'npm test') {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-verification-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  // identity는 rev-parse HEAD를 요구한다. unborn branch면 VERIFY_IDENTITY_INVALID.
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '--allow-empty', '-m', 'init',
  ], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify }));
  const verification = path.join(repo, BP_REL, 'tasks/001/verification.md');
  fs.mkdirSync(path.dirname(verification), { recursive: true });
  fs.writeFileSync(verification, `---
type: bouncer.verification
title: Verify 001
description: Verification evidence
resource: ${BP_REL}/tasks/001/verification.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: VERIFY-001
  epic_id: '001'
  blueprint_id: '001'
  status: pending
---
# Verification

Existing notes.
`);
  return repo;
}

function fixedDeps(overrides = {}) {
  return {
    git: (args) => {
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc123head\n';
      if (args[0] === 'status') return '';
      throw new Error(`unexpected git ${args.join(' ')}`);
    },
    platform: 'linux',
    arch: 'x64',
    nodeVersion: 'v24.0.0',
    ...overrides,
  };
}

function assertRunOk(result, { command, exitCode = 0, reused = false, reusedFrom }) {
  assert.strictEqual(result.ok, exitCode === 0);
  assert.strictEqual(result.command, command);
  assert.strictEqual(result.exitCode, exitCode);
  assert.strictEqual(result.reused, reused);
  assert.ok(typeof result.evidenceId === 'string' && /^[a-f0-9]{64}$/.test(result.evidenceId));
  if (reused) {
    assert.strictEqual(result.reusedFrom, reusedFrom || result.evidenceId);
  } else {
    assert.strictEqual(result.reusedFrom, undefined);
  }
}

function writeTasks(repo, verifyField) {
  const verifyYaml = verifyField === undefined
    ? ''
    : `  verify: ${JSON.stringify(verifyField)}\n`;
  const abs = path.join(repo, BP_REL, 'tasks/001/tasks.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---
type: bouncer.tasks
title: Login tasks
description: Tasks for 001
resource: ${BP_REL}/tasks/001/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - src/auth/
${verifyYaml}---
# Tasks
`);
}

test('runVerification records successful command evidence', () => {
  const repo = setupRepo();
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: (file, args, options) => {
      assert.strictEqual(file, 'npm');
      assert.deepStrictEqual(args, ['test']);
      assert.strictEqual(options.cwd, repo);
      assert.strictEqual(options.shell, false);
      return { status: 0, stdout: 'line one\nline two\n', stderr: '' };
    },
  });

  assertRunOk(result, { command: 'npm test' });
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'passed');
  assert.strictEqual(verification.data.bouncer.verification.command, 'npm test');
  assert.strictEqual(verification.data.bouncer.verification.ran_at, '2026-07-27T09:00:00.000+09:00');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 0);
  assert.strictEqual(verification.data.bouncer.verification.output_tail, 'line one\nline two');
  assert.strictEqual(verification.data.bouncer.verification.reused, false);
  assert.strictEqual(verification.data.bouncer.verification.evidence_id, result.evidenceId);
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

  assertRunOk(result, { command: 'npm test', exitCode: 7 });
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'failed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 7);
  assert.strictEqual(verification.data.bouncer.verification.output_tail, 'partial output\nfailure output');
  assert.match(verification.body, /Exit code: 7/);
});

test('runVerification writes a verify ledger record matching the re-read output_tail', () => {
  const repo = setupRepo();
  const rel = `${BP_REL}/tasks/001/verification.md`;
  runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: () => ({ status: 0, stdout: 'line one\nline two\n', stderr: '' }),
  });
  const verification = readDoc(path.join(repo, rel));
  const paths = verifyLedgerPathFor({
    repoRoot: repo, verificationRel: rel, evidenceId: verification.data.bouncer.verification.evidence_id,
  });
  const record = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  const outputSha = createHash('sha256')
    .update(verification.data.bouncer.verification.output_tail, 'utf8')
    .digest('hex');
  assert.strictEqual(record.rel, rel);
  assert.strictEqual(record.command, 'npm test');
  assert.strictEqual(record.ran_at, '2026-07-27T09:00:00.000+09:00');
  assert.strictEqual(record.exit_code, 0);
  assert.strictEqual(record.output_sha, outputSha);
  assert.strictEqual(record.evidence_id, verification.data.bouncer.verification.evidence_id);
  assert.strictEqual(record.reused, false);
});

test('failed verification still writes a ledger record that does not pass G13', () => {
  const repo = setupRepo();
  const rel = `${BP_REL}/tasks/001/verification.md`;
  const failure = new Error('command failed');
  failure.status = 7;
  failure.stdout = 'partial output\n';
  failure.stderr = 'failure output\n';
  runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: () => { throw failure; },
  });
  const verification = readDoc(path.join(repo, rel));
  const paths = verifyLedgerPathFor({
    repoRoot: repo, verificationRel: rel, evidenceId: verification.data.bouncer.verification.evidence_id,
  });
  const record = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  assert.strictEqual(record.exit_code, 7);

  verification.rel = rel;
  const result = checkGate({
    gate: 'execute',
    docs: {
      tasks: { data: { bouncer: { status: 'verified' } }, rel: `${BP_REL}/tasks/001/tasks.md` },
      verification,
      review: {
        data: { bouncer: { status: 'pending', review: { required: false } } },
        rel: `${BP_REL}/tasks/001/review.md`,
      },
    },
    rels: {
      tasks: `${BP_REL}/tasks/001/tasks.md`,
      verification: rel,
      review: `${BP_REL}/tasks/001/review.md`,
    },
    repoRoot: repo,
  });
  assert.ok(result.failures.some((f) => f.code === 'G13'));
  assert.ok(result.failures.some((f) => (
    f.code === 'G13' && /missing successful harness verification metadata/.test(f.message)
  )));
});

test('recordVerificationResult hashes output_tail after YAML round-trip of CRLF and trailing space', () => {
  const repo = setupRepo();
  const rel = `${BP_REL}/tasks/001/verification.md`;
  const output = 'ok  \r\nline two  ';
  recordVerificationResult({
    repoRoot: repo,
    verificationRel: rel,
    command: 'npm test',
    ranAt: '2026-07-27T00:00:00.000Z',
    exitCode: 0,
    output,
  });
  const reread = readDoc(path.join(repo, rel));
  const paths = verifyLedgerPathFor({
    repoRoot: repo, verificationRel: rel, evidenceId: reread.data.bouncer.verification.evidence_id,
  });
  const record = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  const outputSha = createHash('sha256')
    .update(reread.data.bouncer.verification.output_tail, 'utf8')
    .digest('hex');
  assert.strictEqual(record.output_sha, outputSha);
  reread.rel = rel;
  const result = checkGate({
    gate: 'execute',
    docs: {
      tasks: { data: { bouncer: { status: 'verified' } }, rel: `${BP_REL}/tasks/001/tasks.md` },
      verification: reread,
      review: {
        data: { bouncer: { status: 'pending', review: { required: false } } },
        rel: `${BP_REL}/tasks/001/review.md`,
      },
    },
    rels: {
      tasks: `${BP_REL}/tasks/001/tasks.md`,
      verification: rel,
      review: `${BP_REL}/tasks/001/review.md`,
    },
    repoRoot: repo,
  });
  assert.deepStrictEqual(result.failures.filter((f) => f.code === 'G13'), []);
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
  fs.rmSync(path.join(repo, BP_REL, 'tasks/001/verification.md'));
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
// process.exit() can truncate piped console.log stdout under load; write +
// exitCode lets the stream drain so output_tail assertions stay deterministic.
const noisyCommand = (lines, exitCode) => 'node -e "'
  + `for(let i=1;i<=${lines};i++)process.stdout.write('line '+i+'\\n');`
  + `process.exitCode=${exitCode}`
  + '"';

test('a passing verification keeps no output block in the body', () => {
  const repo = setupRepo(noisyCommand(300, 0));
  runVerification({ repoRoot: repo, blueprintDir: BP_REL });
  const { data, body } = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));

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
  const { data, body } = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));

  assert.match(body, /Exit code: 3/);
  assert.ok(body.includes('```'), 'a failure keeps its output block');
  assert.ok(body.includes('line 300'), 'the body shows the end of the output');

  const tail = data.bouncer.verification.output_tail.split('\n');
  assert.ok(tail.length > 20, `a failing run records more than a passing one, got ${tail.length}`);
  assert.ok(tail.length <= 100, `bounded at the failure limit, got ${tail.length}`);
});

test('runVerification prefers tasks.bouncer.verify over config.verify', () => {
  const declared = 'node -e "process.exit(0)"';
  const repo = setupRepo('npm test');
  writeTasks(repo, declared);
  let executed;
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    // 3인자(spawnSync) 형태 — length < 3이면 execSync 2인자로 분기한다.
    exec: (file, args, options) => {
      void options;
      executed = [file, ...args].join(' ');
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(executed, 'node -e process.exit(0)');
  assert.strictEqual(result.command, declared);
  assert.strictEqual(result.reused, false);
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.verification.command, declared);
});

test('runVerification falls back to config.verify when tasks has no verify', () => {
  const repo = setupRepo('npm test');
  writeTasks(repo);
  let executed;
  runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    exec: (file, args, options) => {
      void options;
      executed = [file, ...args];
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.deepStrictEqual(executed, ['npm', 'test']);
});

test('runVerification falls back to config.verify when the task document is absent', () => {
  const repo = setupRepo('npm test');
  let executed;
  runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    exec: (file, args, options) => {
      void options;
      executed = [file, ...args];
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.deepStrictEqual(executed, ['npm', 'test']);
});

test('readVerifyCommand rejects non-single executable commands', () => {
  for (const bad of ['cd sub && npm test', 'npm test | tee out.log', 'a; b', '  ']) {
    const repo = setupRepo('npm test');
    writeTasks(repo, bad);
    assert.throws(
      () => readVerifyCommand(repo, BP_REL),
      (e) => e.code === 'VERIFY_COMMAND_INVALID',
    );
  }
});

test('readVerifyCommand(repoRoot) still returns config.verify', () => {
  const repo = setupRepo('npm test');
  writeTasks(repo, 'node -e "process.exit(0)"');
  assert.strictEqual(readVerifyCommand(repo), 'npm test');
});

test('readVerifyCommand adopts the earliest-numbered verify declaration', () => {
  const repo = setupRepo('npm test');
  const writeNumbered = (nnn, verifyField) => {
    const abs = path.join(repo, BP_REL, `tasks/${nnn}/tasks.md`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---
type: bouncer.tasks
title: Login tasks
description: Tasks for 001
resource: ${BP_REL}/tasks/${nnn}/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-${nnn}
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - src/auth/
  verify: ${JSON.stringify(verifyField)}
---
# Tasks
`);
  };
  writeNumbered('001', 'node -e "process.exit(0)"');
  writeNumbered('002', 'node -e "process.exit(1)"');
  assert.strictEqual(
    readVerifyCommand(repo, BP_REL),
    'node -e "process.exit(0)"',
  );
});

test('readVerifyCommand rejects invalid first declaration even if later is valid', () => {
  const repo = setupRepo('npm test');
  const writeNumbered = (nnn, verifyField) => {
    const abs = path.join(repo, BP_REL, `tasks/${nnn}/tasks.md`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---
type: bouncer.tasks
title: Login tasks
description: Tasks for 001
resource: ${BP_REL}/tasks/${nnn}/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-${nnn}
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - src/auth/
  verify: ${JSON.stringify(verifyField)}
---
# Tasks
`);
  };
  writeNumbered('001', 'cd x && npm test');
  writeNumbered('002', 'node -e "process.exit(0)"');
  assert.throws(
    () => readVerifyCommand(repo, BP_REL),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
});

test('readVerifyCommand narrows to the pointer task document', () => {
  const { writeCurrent } = require('../scripts/lib/current');
  const { execFileSync } = require('node:child_process');
  const repo = setupRepo('npm test');
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  const writeNumbered = (nnn, verifyField) => {
    const verifyYaml = verifyField === undefined
      ? ''
      : `  verify: ${JSON.stringify(verifyField)}\n`;
    const abs = path.join(repo, BP_REL, `tasks/${nnn}/tasks.md`);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---
type: bouncer.tasks
title: Login tasks
description: Tasks for 001
resource: ${BP_REL}/tasks/${nnn}/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-${nnn}
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - src/auth/
${verifyYaml}---
# Tasks
`);
  };
  writeNumbered('001', 'node -e "process.exit(0)"');
  writeNumbered('002'); // no verify — pointer to 002 must fall to config.verify

  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/002/tasks.md`,
  });
  assert.strictEqual(readVerifyCommand(repo, BP_REL), 'npm test');

  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  assert.strictEqual(
    readVerifyCommand(repo, BP_REL),
    'node -e "process.exit(0)"',
  );

  // task 미지정 포인터는 기존처럼 첫 선언을 채택한다.
  writeCurrent({ repoRoot: repo, blueprint: BP_REL, base: 'develop' });
  assert.strictEqual(
    readVerifyCommand(repo, BP_REL),
    'node -e "process.exit(0)"',
  );
});

function writeUnitVerification(repo, nnn, bodyStatus = 'pending') {
  const rel = `${BP_REL}/tasks/${nnn}/verification.md`;
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---
type: bouncer.verification
title: Verify ${nnn}
description: Verification for ${nnn}
resource: ${rel}
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: VERIFY-${nnn}
  epic_id: '001'
  blueprint_id: '001'
  status: ${bodyStatus}
---
# Verification
`);
  return rel;
}

function writeUnitTasks(repo, nnn) {
  const rel = `${BP_REL}/tasks/${nnn}/tasks.md`;
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---
type: bouncer.tasks
title: Tasks ${nnn}
description: Tasks for ${nnn}
resource: ${rel}
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-${nnn}
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  affected_paths:
    - src/auth/
---
# Tasks
`);
  return rel;
}

test('runVerification records evidence into the pointer tasks/002 unit only', () => {
  const { writeCurrent } = require('../scripts/lib/current');
  const { execFileSync } = require('node:child_process');
  const repo = setupRepo('node -e "process.exit(0)"');
  // 루트 verification은 남겨 두고, 새 레이아웃 묶음도 만든다 — 포인터가
  // 002를 가리키면 루트·001은 건드리면 안 된다.
  writeUnitTasks(repo, '001');
  writeUnitVerification(repo, '001');
  writeUnitTasks(repo, '002');
  writeUnitVerification(repo, '002');
  const before001 = fs.readFileSync(path.join(repo, BP_REL, 'tasks/001/verification.md'), 'utf8');

  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/002/tasks.md`,
  });

  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: () => ({ status: 0, stdout: 'ok\n', stderr: '' }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.command, 'node -e "process.exit(0)"');
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(result.reused, false);

  const recorded = readDoc(path.join(repo, BP_REL, 'tasks/002/verification.md'));
  assert.strictEqual(recorded.data.bouncer.verification.exit_code, 0);
  assert.strictEqual(
    fs.readFileSync(path.join(repo, BP_REL, 'tasks/001/verification.md'), 'utf8'),
    before001,
  );
});

test('runVerification rejects missing unit verification.md without creating it', () => {
  const { writeCurrent } = require('../scripts/lib/current');
  const { execFileSync } = require('node:child_process');
  const repo = setupRepo('node -e "process.exit(0)"');
  writeUnitTasks(repo, '001');
  writeUnitVerification(repo, '001');
  writeUnitTasks(repo, '002');
  // tasks/002/verification.md 고의 생략
  const missingRel = `${BP_REL}/tasks/002/verification.md`;

  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/002/tasks.md`,
  });

  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      exec: () => { throw new Error('must not execute'); },
    }),
    { code: 'VERIFY_DOCUMENT_MISSING' },
  );
  assert.ok(!fs.existsSync(path.join(repo, missingRel)));
});

test('parseVerifyArgv preserves quoted arguments and spaces', () => {
  assert.deepStrictEqual(
    parseVerifyArgv('node -e "console.log(\'a b\')"'),
    ['node', '-e', "console.log('a b')"],
  );
  assert.deepStrictEqual(
    parseVerifyArgv("npm run test:e2e -- --grep 'one two'"),
    ['npm', 'run', 'test:e2e', '--', '--grep', 'one two'],
  );
});

test('runVerification executes via argv with shell:false and preserves quotes', () => {
  const declared = 'node -e "process.stdout.write(\'ok\')"';
  const repo = setupRepo('npm test');
  writeTasks(repo, declared);
  let captured;
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: (file, args, options) => {
      captured = { file, args, options };
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(captured.file, 'node');
  assert.deepStrictEqual(captured.args, ['-e', "process.stdout.write('ok')"]);
  assert.strictEqual(captured.options.shell, false);
  assert.strictEqual(result.command, declared);
  assert.strictEqual(result.ok, true);
});

test('runVerification rejects shell operators before starting a process', () => {
  const repo = setupRepo('npm test');
  writeTasks(repo, 'npm test && rm -rf /');
  let executed = false;
  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      exec: () => { executed = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.strictEqual(executed, false);
});

test('runVerification rejects parse failures before starting a process', () => {
  const repo = setupRepo('npm test');
  writeTasks(repo, 'node -e "unclosed');
  let executed = false;
  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      exec: () => { executed = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.strictEqual(executed, false);
});

test('runVerification rejects argv0 outside the allowlist before starting a process', () => {
  const repo = setupRepo('curl https://example.invalid');
  let executed = false;
  // config.verify는 readVerifyCommand가 형식 검사를 건너뛰므로 executeVerify가
  // 거절한다. throw가 아니라 ok:false + 실패 증적이어야 finalize JSON 경로와 맞다.
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec: () => { executed = true; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.strictEqual(executed, false);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.command, 'curl https://example.invalid');
  assert.strictEqual(result.exitCode, 1);
  assert.strictEqual(result.reused, false);
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.status, 'failed');
  assert.strictEqual(verification.data.bouncer.verification.exit_code, 1);
  assert.strictEqual(
    verification.data.bouncer.verification.output_tail,
    'verify command must be a single executable command',
  );
});

test('runVerification honors config.verify_allowlist for argv0 basename', () => {
  const repo = setupRepo('node -e "process.exit(0)"');
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    JSON.stringify({
      verify: 'node -e "process.exit(0)"',
      verify_allowlist: ['node'],
    }),
  );
  let captured;
  runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    exec: (file, args, options) => {
      captured = { file, args, shell: options.shell };
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.deepStrictEqual(captured, {
    file: 'node',
    args: ['-e', 'process.exit(0)'],
    shell: false,
  });
});

test('isValidVerifyCommand rejects argv0 outside the default allowlist', () => {
  assert.ok(isValidVerifyCommand('npm test'));
  assert.ok(DEFAULT_VERIFY_ALLOWLIST.includes('npm'));
  assert.ok(!isValidVerifyCommand('curl https://example.invalid'));
});

test('executeVerify adapts 2-arg injected exec (command, opts) without starting a process', () => {
  // finalize adaptInjectedVerifyExec·구 테스트는 execSync 형태다.
  let captured;
  const result = executeVerify('npm test', {
    cwd: '/tmp/verify-inject',
    exec: (command, opts) => {
      captured = { command, cwd: opts.cwd, shell: opts.shell, arity: 2 };
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.deepStrictEqual(captured, {
    command: 'npm test',
    cwd: '/tmp/verify-inject',
    shell: false,
    arity: 2,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.exitCode, 0);
});

test('executeVerify keeps 3-arg injected exec (file, args, opts)', () => {
  let captured;
  executeVerify('npm test', {
    cwd: '/tmp/verify-inject',
    exec: (file, args, opts) => {
      captured = { file, args, cwd: opts.cwd, shell: opts.shell };
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.deepStrictEqual(captured, {
    file: 'npm',
    args: ['test'],
    cwd: '/tmp/verify-inject',
    shell: false,
  });
});

test('executeVerify reads verify_allowlist from config at cwd when allowlist is omitted', () => {
  const repo = setupRepo('npm test');
  fs.writeFileSync(
    path.join(repo, '.bouncer/config.json'),
    JSON.stringify({
      verify: 'npm test',
      verify_allowlist: ['node'],
    }),
  );
  let executed = false;
  const result = executeVerify('npm test', {
    cwd: repo,
    exec: () => { executed = true; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.strictEqual(executed, false);
  assert.deepStrictEqual(result, {
    ok: false,
    exitCode: 1,
    output: 'verify command must be a single executable command',
  });
});

test('executeVerify rejects npm test when allowlist is narrowed to node', () => {
  let executed = false;
  const result = executeVerify('npm test', {
    cwd: process.cwd(),
    allowlist: ['node'],
    exec: () => { executed = true; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.strictEqual(executed, false);
  assert.deepStrictEqual(result, {
    ok: false,
    exitCode: 1,
    output: 'verify command must be a single executable command',
  });
});

function writeAllowlist(repo, allowlist, extra = {}) {
  const configPath = path.join(repo, '.bouncer/config.json');
  const current = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  fs.writeFileSync(configPath, JSON.stringify({ ...current, ...extra, verify_allowlist: allowlist }));
}

test('project allowlist bun accepts bun test and rejects npm test at runtime', () => {
  const repo = setupRepo('npm test');
  writeAllowlist(repo, ['bun']);

  writeTasks(repo, 'bun test');
  let bunExecuted = false;
  const bunResult = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    exec: (file, args, options) => {
      void options;
      bunExecuted = true;
      assert.strictEqual(file, 'bun');
      assert.deepStrictEqual(args, ['test']);
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.strictEqual(bunExecuted, true);
  assert.strictEqual(bunResult.ok, true);
  assert.strictEqual(bunResult.command, 'bun test');
  assert.strictEqual(bunResult.exitCode, 0);
  assert.strictEqual(bunResult.reused, false);
  assert.strictEqual(readVerifyCommand(repo, BP_REL), 'bun test');

  writeTasks(repo, 'npm test');
  let npmExecuted = false;
  assert.throws(
    () => readVerifyCommand(repo, BP_REL),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      exec: () => { npmExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.strictEqual(npmExecuted, false);
});

test('empty allowlist, shell operators, and unclosed quotes reject before starting a process', () => {
  const emptyRepo = setupRepo('npm test');
  writeAllowlist(emptyRepo, []);
  writeTasks(emptyRepo, 'npm test');
  let emptyExecuted = false;
  assert.throws(
    () => runVerification({
      repoRoot: emptyRepo,
      blueprintDir: BP_REL,
      exec: () => { emptyExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.strictEqual(emptyExecuted, false);

  const shellRepo = setupRepo('npm test');
  writeAllowlist(shellRepo, ['npm']);
  writeTasks(shellRepo, 'npm test && rm -rf /');
  let shellExecuted = false;
  assert.throws(
    () => runVerification({
      repoRoot: shellRepo,
      blueprintDir: BP_REL,
      exec: () => { shellExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.strictEqual(shellExecuted, false);

  const quoteRepo = setupRepo('npm test');
  writeAllowlist(quoteRepo, ['node']);
  writeTasks(quoteRepo, 'node -e "unclosed');
  let quoteExecuted = false;
  assert.throws(
    () => runVerification({
      repoRoot: quoteRepo,
      blueprintDir: BP_REL,
      exec: () => { quoteExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_COMMAND_INVALID',
  );
  assert.strictEqual(quoteExecuted, false);
});

test('missing config uses the default allowlist; broken JSON and read errors abort as VERIFY_CONFIG_INVALID', () => {
  const missingRepo = setupRepo('npm test');
  fs.rmSync(path.join(missingRepo, '.bouncer/config.json'));
  writeTasks(missingRepo, 'npm test');
  let missingExecuted = false;
  const missingResult = runVerification({
    repoRoot: missingRepo,
    blueprintDir: BP_REL,
    exec: (file, args, options) => {
      void options;
      missingExecuted = true;
      assert.deepStrictEqual([file, ...args], ['npm', 'test']);
      return { status: 0, stdout: '', stderr: '' };
    },
  });
  assert.strictEqual(missingExecuted, true);
  assert.strictEqual(missingResult.ok, true);
  assert.strictEqual(missingResult.command, 'npm test');
  assert.strictEqual(missingResult.exitCode, 0);
  assert.strictEqual(readVerifyCommand(missingRepo, BP_REL), 'npm test');

  const brokenRepo = setupRepo('npm test');
  writeTasks(brokenRepo, 'npm test');
  fs.writeFileSync(path.join(brokenRepo, '.bouncer/config.json'), '{not json');
  let brokenExecuted = false;
  assert.throws(
    () => readVerifyCommand(brokenRepo, BP_REL),
    (e) => e.code === 'VERIFY_CONFIG_INVALID',
  );
  assert.throws(
    () => runVerification({
      repoRoot: brokenRepo,
      blueprintDir: BP_REL,
      exec: () => { brokenExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_CONFIG_INVALID',
  );
  assert.strictEqual(brokenExecuted, false);

  const unreadableRepo = setupRepo('npm test');
  writeTasks(unreadableRepo, 'npm test');
  const unreadablePath = path.join(unreadableRepo, '.bouncer/config.json');
  fs.rmSync(unreadablePath);
  fs.mkdirSync(unreadablePath);
  let unreadableExecuted = false;
  assert.throws(
    () => readVerifyCommand(unreadableRepo, BP_REL),
    (e) => e.code === 'VERIFY_CONFIG_INVALID',
  );
  assert.throws(
    () => runVerification({
      repoRoot: unreadableRepo,
      blueprintDir: BP_REL,
      exec: () => { unreadableExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_CONFIG_INVALID',
  );
  assert.strictEqual(unreadableExecuted, false);
});

test('executeVerify returns ok:false and does not start a process when config is invalid', () => {
  const repo = setupRepo('npm test');
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), '{not json');
  let executed = false;
  const result = executeVerify('npm test', {
    cwd: repo,
    exec: () => { executed = true; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.strictEqual(executed, false);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.exitCode, 1);
  assert.ok(typeof result.output === 'string' && result.output.length > 0);
  assert.match(result.output, /invalid/i);

  const unreadable = setupRepo('npm test');
  const unreadablePath = path.join(unreadable, '.bouncer/config.json');
  fs.rmSync(unreadablePath);
  fs.mkdirSync(unreadablePath);
  let unreadableExecuted = false;
  const unreadableResult = executeVerify('npm test', {
    cwd: unreadable,
    exec: () => { unreadableExecuted = true; return { status: 0, stdout: '', stderr: '' }; },
  });
  assert.strictEqual(unreadableExecuted, false);
  assert.deepStrictEqual(
    { ok: unreadableResult.ok, exitCode: unreadableResult.exitCode },
    { ok: false, exitCode: 1 },
  );
  assert.match(unreadableResult.output, /invalid/i);
});

test('isValidVerifyCommand accepts win32 npm.cmd against the default allowlist', () => {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  try {
    assert.ok(isValidVerifyCommand('npm.cmd test'));
    assert.ok(isValidVerifyCommand('npx.cmd run lint'));
    assert.ok(isValidVerifyCommand('node.exe -e "process.exit(0)"'));
    assert.ok(!isValidVerifyCommand('curl.exe https://example.invalid'));
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
  }
});

test('two linked worktrees select distinct pointer task verification documents', () => {
  const { writeCurrent, readCurrent } = require('../scripts/lib/current');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-verify-ns-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: 'npm test' }));

  const bpA = '.bouncer/context/epics/001-auth/blueprints/001-login';
  const bpB = '.bouncer/context/epics/002-billing/blueprints/001-invoices';
  const writeTask = (bp, epicId, bpId, taskNum, verifyCmd) => {
    const rel = `${bp}/tasks/${taskNum}/tasks.md`;
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `---
type: bouncer.tasks
title: t
description: d
resource: ${rel}
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-${taskNum}
  epic_id: '${epicId}'
  blueprint_id: '${bpId}'
  status: ready
  affected_paths:
    - src/
  verify: ${JSON.stringify(verifyCmd)}
---
# Tasks
`);
  };
  // 001은 전체 walk 폴백이 고를 미끼. 포인터가 002를 가리킬 때만 기대 명령이 나온다.
  writeTask(bpA, '001', '001', '001', 'node -e "process.exit(1)"');
  writeTask(bpA, '001', '001', '002', 'node -e "process.exit(0)"');
  writeTask(bpB, '002', '001', '001', 'node -e "process.exit(1)"');
  writeTask(bpB, '002', '001', '002', 'node -e "process.exit(11)"');
  fs.writeFileSync(path.join(repo, 'README.md'), 'fixture\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '-m', 'fixture',
  ], { cwd: repo });

  const wtA = path.join(repo, '.worktrees', '001', '001');
  const wtB = path.join(repo, '.worktrees', '002', '001');
  fs.mkdirSync(path.dirname(wtA), { recursive: true });
  fs.mkdirSync(path.dirname(wtB), { recursive: true });
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', wtA], { cwd: repo });
  execFileSync('git', ['worktree', 'add', '--quiet', '--detach', wtB], { cwd: repo });

  writeCurrent({
    repoRoot: wtA, blueprint: bpA, base: 'develop', task: `${bpA}/tasks/002/tasks.md`,
  });
  writeCurrent({
    repoRoot: wtB, blueprint: bpB, base: 'main', task: `${bpB}/tasks/002/tasks.md`,
  });

  const currentA = readCurrent({ repoRoot: wtA });
  const currentB = readCurrent({ repoRoot: wtB });
  assert.deepStrictEqual(currentA, {
    blueprint: bpA, base: 'develop', task: `${bpA}/tasks/002/tasks.md`,
  });
  assert.deepStrictEqual(currentB, {
    blueprint: bpB, base: 'main', task: `${bpB}/tasks/002/tasks.md`,
  });
  assert.strictEqual(readVerifyCommand(wtA, currentA.blueprint), 'node -e "process.exit(0)"');
  assert.strictEqual(readVerifyCommand(wtB, currentB.blueprint), 'node -e "process.exit(11)"');
});

test('second runVerification with same identity/scope reuses evidence and skips exec', () => {
  const repo = setupRepo();
  const deps = fixedDeps();
  const scope = { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' };
  let calls = 0;
  const exec = () => {
    calls += 1;
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };
  const first = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    scope,
    deps,
    now: () => new Date('2026-07-27T00:00:00.000Z'),
    exec,
  });
  assertRunOk(first, { command: 'npm test', reused: false });
  assert.strictEqual(calls, 1);

  const second = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    scope,
    deps,
    now: () => new Date('2026-07-28T00:00:00.000Z'),
    exec,
  });
  assert.strictEqual(calls, 1);
  assertRunOk(second, {
    command: 'npm test',
    reused: true,
    reusedFrom: first.evidenceId,
  });
  assert.strictEqual(second.evidenceId, first.evidenceId);
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
  assert.strictEqual(verification.data.bouncer.verification.reused, true);
  assert.strictEqual(verification.data.bouncer.verification.reused_from, first.evidenceId);
  assert.strictEqual(
    verification.data.bouncer.verification.ran_at,
    '2026-07-27T09:00:00.000+09:00',
  );
});

test('scope kind/key isolation yields distinct evidence ids and three exec calls', () => {
  const repo = setupRepo();
  const deps = fixedDeps();
  const scopes = [
    { kind: 'task', key: 'EPIC-076/BP-001/TASK-001' },
    { kind: 'wave', key: 'r1:TASKS-001,TASKS-002' },
    { kind: 'terminal', key: 'EPIC-076/BP-001:<integration-head>' },
  ];
  let calls = 0;
  const exec = () => {
    calls += 1;
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };
  const ids = new Set();
  const ledgerFiles = new Set();
  for (const scope of scopes) {
    const result = runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      scope,
      deps,
      exec,
    });
    assert.strictEqual(result.reused, false);
    ids.add(result.evidenceId);
    const rel = `${BP_REL}/tasks/001/verification.md`;
    const paths = verifyLedgerPathFor({
      repoRoot: repo, verificationRel: rel, evidenceId: result.evidenceId,
    });
    ledgerFiles.add(paths.ledgerFile);
    assert.ok(fs.existsSync(paths.ledgerFile));
  }
  assert.strictEqual(calls, 3);
  assert.strictEqual(ids.size, 3);
  assert.strictEqual(ledgerFiles.size, 3);
});

test('identity field changes and corrupt/failed records miss the cache', () => {
  const repo = setupRepo();
  const baseScope = { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' };
  let calls = 0;
  const exec = () => {
    calls += 1;
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };
  const run = (deps, scope = baseScope) => runVerification({
    repoRoot: repo, blueprintDir: BP_REL, scope, deps, exec,
  });

  run(fixedDeps());
  assert.strictEqual(calls, 1);

  const cases = [
    fixedDeps({ git: (args) => {
      if (args[0] === 'rev-parse') return 'otherhead\n';
      if (args[0] === 'status') return '';
      throw new Error(`unexpected git ${args.join(' ')}`);
    } }),
    fixedDeps({ git: (args) => {
      if (args[0] === 'rev-parse') return 'abc123head\n';
      if (args[0] === 'status') return ' M dirty.txt\0';
      throw new Error(`unexpected git ${args.join(' ')}`);
    } }),
    fixedDeps({ platform: 'darwin' }),
    null,
  ];
  fs.writeFileSync(path.join(repo, 'dirty.txt'), 'changed\n');
  for (const deps of cases.slice(0, 3)) {
    run(deps);
  }
  // scope key change
  run(fixedDeps(), { kind: 'task', key: 'EPIC-001/BP-001/TASK-002' });
  // command change via tasks verify
  writeTasks(repo, 'node -e "process.exit(0)"');
  run(fixedDeps());
  assert.strictEqual(calls, 6);

  // failure record is not reusable
  const failRepo = setupRepo();
  let failCalls = 0;
  const failScope = { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' };
  const failDeps = fixedDeps();
  runVerification({
    repoRoot: failRepo,
    blueprintDir: BP_REL,
    scope: failScope,
    deps: failDeps,
    exec: () => {
      failCalls += 1;
      return { status: 3, stdout: 'no\n', stderr: '' };
    },
  });
  runVerification({
    repoRoot: failRepo,
    blueprintDir: BP_REL,
    scope: failScope,
    deps: failDeps,
    exec: () => {
      failCalls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(failCalls, 2);

  // corrupt v2 record → miss
  const corruptRepo = setupRepo();
  const corruptDeps = fixedDeps();
  const corruptScope = { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' };
  const first = runVerification({
    repoRoot: corruptRepo,
    blueprintDir: BP_REL,
    scope: corruptScope,
    deps: corruptDeps,
    exec: () => {
      failCalls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  const paths = verifyLedgerPathFor({
    repoRoot: corruptRepo,
    verificationRel: `${BP_REL}/tasks/001/verification.md`,
    evidenceId: first.evidenceId,
  });
  const broken = JSON.parse(fs.readFileSync(paths.ledgerFile, 'utf8'));
  delete broken.identity;
  fs.writeFileSync(paths.ledgerFile, `${JSON.stringify(broken, null, 2)}\n`);
  let corruptCalls = 0;
  runVerification({
    repoRoot: corruptRepo,
    blueprintDir: BP_REL,
    scope: corruptScope,
    deps: corruptDeps,
    exec: () => {
      corruptCalls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(corruptCalls, 1);

  // reused 누락·비 boolean은 손상 miss (CT-001)
  const reusedMissRepo = setupRepo();
  const reusedMissDeps = fixedDeps();
  const reusedMissScope = { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' };
  const reusedFirst = runVerification({
    repoRoot: reusedMissRepo,
    blueprintDir: BP_REL,
    scope: reusedMissScope,
    deps: reusedMissDeps,
    exec: () => ({ status: 0, stdout: 'ok\n', stderr: '' }),
  });
  const reusedPaths = verifyLedgerPathFor({
    repoRoot: reusedMissRepo,
    verificationRel: `${BP_REL}/tasks/001/verification.md`,
    evidenceId: reusedFirst.evidenceId,
  });
  const reusedBroken = JSON.parse(fs.readFileSync(reusedPaths.ledgerFile, 'utf8'));
  delete reusedBroken.reused;
  fs.writeFileSync(reusedPaths.ledgerFile, `${JSON.stringify(reusedBroken, null, 2)}\n`);
  let reusedMissCalls = 0;
  runVerification({
    repoRoot: reusedMissRepo,
    blueprintDir: BP_REL,
    scope: reusedMissScope,
    deps: reusedMissDeps,
    exec: () => {
      reusedMissCalls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(reusedMissCalls, 1);
  const reusedNonBool = JSON.parse(fs.readFileSync(reusedPaths.ledgerFile, 'utf8'));
  reusedNonBool.reused = 'yes';
  fs.writeFileSync(reusedPaths.ledgerFile, `${JSON.stringify(reusedNonBool, null, 2)}\n`);
  reusedMissCalls = 0;
  runVerification({
    repoRoot: reusedMissRepo,
    blueprintDir: BP_REL,
    scope: reusedMissScope,
    deps: reusedMissDeps,
    exec: () => {
      reusedMissCalls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(reusedMissCalls, 1);

  // v1 legacy record is never a hit
  const v1Repo = setupRepo();
  const v1Deps = fixedDeps();
  const v1Scope = { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' };
  const v1First = runVerification({
    repoRoot: v1Repo,
    blueprintDir: BP_REL,
    scope: v1Scope,
    deps: v1Deps,
    exec: () => ({ status: 0, stdout: 'ok\n', stderr: '' }),
  });
  const v1Paths = verifyLedgerPathFor({
    repoRoot: v1Repo,
    verificationRel: `${BP_REL}/tasks/001/verification.md`,
    evidenceId: v1First.evidenceId,
  });
  fs.writeFileSync(v1Paths.ledgerFile, `${JSON.stringify({
    rel: `${BP_REL}/tasks/001/verification.md`,
    command: 'npm test',
    ran_at: '2026-07-27T00:00:00.000Z',
    exit_code: 0,
    output_sha: createHash('sha256').update('ok', 'utf8').digest('hex'),
  }, null, 2)}\n`);
  let v1Calls = 0;
  runVerification({
    repoRoot: v1Repo,
    blueprintDir: BP_REL,
    scope: v1Scope,
    deps: v1Deps,
    exec: () => {
      v1Calls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(v1Calls, 1);
});

test('explicit and pointer-derived scopes, and identity errors reject before spawn', () => {
  const { writeCurrent } = require('../scripts/lib/current');
  const repo = setupRepo();
  writeTasks(repo, 'npm test');
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  const deps = fixedDeps();
  let calls = 0;
  const exec = () => {
    calls += 1;
    return { status: 0, stdout: 'ok\n', stderr: '' };
  };
  const explicit = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' },
    deps,
    exec,
  });
  const derived = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    deps,
    exec,
  });
  // 첫 실행 후 같은 identity면 재사용. pointer-derived와 명시 scope가 같으면 hit.
  assert.strictEqual(calls, 1);
  assert.strictEqual(derived.reused, true);
  assert.strictEqual(derived.evidenceId, explicit.evidenceId);
  assert.strictEqual(
    readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md')).data.bouncer.verification.scope.key,
    'EPIC-001/BP-001/TASK-001',
  );

  let spawned = false;
  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      scope: { kind: 'task', key: '' },
      deps,
      exec: () => { spawned = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_IDENTITY_INVALID',
  );
  assert.strictEqual(spawned, false);

  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      scope: { kind: 'nope', key: 'x' },
      deps,
      exec: () => { spawned = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_IDENTITY_INVALID',
  );
  assert.strictEqual(spawned, false);

  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' },
      deps: fixedDeps({
        git: () => { throw new Error('git unavailable'); },
      }),
      exec: () => { spawned = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_IDENTITY_INVALID',
  );
  assert.strictEqual(spawned, false);

  const dirtyRepo = setupRepo();
  assert.throws(
    () => runVerification({
      repoRoot: dirtyRepo,
      blueprintDir: BP_REL,
      scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' },
      deps: fixedDeps({
        git: (args) => {
          if (args[0] === 'rev-parse') return 'abc123head\n';
          if (args[0] === 'status') return '?? /tmp/outside\0';
          throw new Error(`unexpected git ${args.join(' ')}`);
        },
      }),
      exec: () => { spawned = true; return { status: 0, stdout: '', stderr: '' }; },
    }),
    (e) => e.code === 'VERIFY_IDENTITY_INVALID',
  );
  assert.strictEqual(spawned, false);

  // CT-004: in-repo `..foo`는 부모 탈출이 아니다 — escape 거절로 오탐하면 안 된다.
  const dotDotNameRepo = setupRepo();
  fs.writeFileSync(path.join(dotDotNameRepo, '..foo'), 'in-repo\n');
  let dotDotSpawned = 0;
  const dotDotOk = runVerification({
    repoRoot: dotDotNameRepo,
    blueprintDir: BP_REL,
    scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-001' },
    deps: fixedDeps({
      git: (args) => {
        if (args[0] === 'rev-parse') return 'abc123head\n';
        if (args[0] === 'status') return '?? ..foo\0';
        throw new Error(`unexpected git ${args.join(' ')}`);
      },
    }),
    exec: () => {
      dotDotSpawned += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(dotDotOk.ok, true);
  assert.strictEqual(dotDotSpawned, 1);
});

test('omitted scope with numbered unit missing epic_id falls back to path key and runs exec once', () => {
  const { writeCurrent } = require('../scripts/lib/current');
  const repo = setupRepo();
  // coordinator integrate fixture처럼 id만 있고 epic/blueprint frontmatter가 없다.
  // provenance digit 거절 뒤 경로 숫자로 scope를 만들어야 한다.
  const abs = path.join(repo, BP_REL, 'tasks/001/tasks.md');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---
type: bouncer.tasks
title: Login tasks
description: Tasks for 001
resource: ${BP_REL}/tasks/001/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-001
  status: ready
  verify: npm test
---
# Tasks
`);
  writeCurrent({
    repoRoot: repo,
    blueprint: BP_REL,
    base: 'develop',
    task: `${BP_REL}/tasks/001/tasks.md`,
  });
  let calls = 0;
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    deps: fixedDeps(),
    exec: () => {
      calls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(result.reused, false);
  assert.strictEqual(
    readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md')).data.bouncer.verification.scope.key,
    'EPIC-001/BP-001/TASK-001',
  );
});

test('omitted scope with legacy root tasks.md only resolves scope and runs exec', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-verification-legacy-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  execFileSync('git', [
    '-c', 'user.name=Bouncer Test', '-c', 'user.email=test@example.com',
    'commit', '--allow-empty', '-m', 'init',
  ], { cwd: repo });
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: 'npm test' }));
  // numbered entries가 비고 루트 tasks.md만 있을 때 resolveVerificationRel과 같이
  // 레거시 경로로 scope를 잡는다 — native-profile-e2e execute 경로.
  fs.mkdirSync(path.join(repo, BP_REL), { recursive: true });
  fs.writeFileSync(path.join(repo, BP_REL, 'tasks.md'), `---
type: bouncer.tasks
title: Login tasks
description: Tasks for 001
resource: ${BP_REL}/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '001'
  status: verified
---
# Tasks
`);
  fs.writeFileSync(path.join(repo, BP_REL, 'verification.md'), `---
type: bouncer.verification
title: Verify 001
description: Verification evidence
resource: ${BP_REL}/verification.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: VERIFY-001
  epic_id: '001'
  blueprint_id: '001'
  status: pending
---
# Verification
`);
  let calls = 0;
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    deps: fixedDeps(),
    exec: () => {
      calls += 1;
      return { status: 0, stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(calls, 1);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(
    readDoc(path.join(repo, BP_REL, 'verification.md')).data.bouncer.verification.scope.key,
    'EPIC-001/BP-001/TASK-001',
  );
});

// --- effective task (worker lease) ------------------------------------------

const {
  writeCurrent: __writeCurrent,
} = require('../scripts/lib/current');
const { entriesForVerify: __entriesForVerify } = require('../scripts/lib/verification');
const __coordMod = require('../scripts/lib/coordinator');
const { coordinatorPathsFor: __cpFor } = require('../scripts/lib/runtime-state');
const __crypto2 = require('node:crypto');
const __yaml = require('js-yaml');
const __FENCED2 = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'release', 'revoke',
]);
function __coordFence(repoRoot, blueprint) {
  const { ledgerFile } = __cpFor({ repoRoot, blueprint });
  return {
    ledgerPath: '.bouncer/runtime/coordinator.json',
    ledgerHash: __crypto2.createHash('sha256').update(fs.readFileSync(ledgerFile)).digest('hex'),
  };
}
function __coordinate(opts) {
  if (__FENCED2.has(opts.command)
    && opts.ledgerPath === undefined && opts.ledgerHash === undefined) {
    try { opts = { ...opts, ...__coordFence(opts.repoRoot, opts.blueprint) }; }
    catch (_e) { /* missing ledger */ }
  }
  return __coordMod.coordinate(opts);
}
function __writeFm(repo, rel, data, body = '# x\n') {
  const abs = path.join(repo, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `---\n${__yaml.dump(data)}---\n${body}`);
}

function leaseVerifyFixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-verify-lease-'));
  execFileSync('git', ['init', '-b', 'main', '--quiet'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: repo });
  const epic = '.bouncer/context/epics/093-eff/blueprints/001-y';
  __writeFm(repo, '.bouncer/context/epics/093-eff/index.md', {
    type: 'bouncer.epic', title: 'e', description: 'd',
    resource: '.bouncer/context/epics/093-eff/index.md', tags: ['bouncer'],
    timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '093', epic_id: '093', status: 'approved' },
  });
  __writeFm(repo, `${epic}/index.md`, {
    type: 'bouncer.blueprint', title: 'b', description: 'd', resource: `${epic}/index.md`,
    tags: ['bouncer'], timestamp: '2026-07-01T00:00:00+09:00',
    bouncer: { id: '001', epic_id: '093', blueprint_id: '001', status: 'approved' },
  });
  for (const [id, leaf, verify] of [
    ['001', 'a', 'node -e "process.exit(1)"'],
    ['002', 'b', 'node -e "process.exit(0)"'],
  ]) {
    __writeFm(repo, `${epic}/tasks/${id}/tasks.md`, {
      type: 'bouncer.tasks', title: `t${id}`, description: 'd',
      resource: `${epic}/tasks/${id}/tasks.md`, tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `TASKS-${id}`, epic_id: '093', blueprint_id: '001', status: 'ready',
        parallel_safe: true, affected_paths: [`src/${leaf}/`], verify,
      },
    });
    __writeFm(repo, `${epic}/tasks/${id}/verification.md`, {
      type: 'bouncer.verification', title: `v${id}`, description: 'd',
      resource: `${epic}/tasks/${id}/verification.md`, tags: ['bouncer'],
      timestamp: '2026-07-01T00:00:00+09:00',
      bouncer: {
        id: `VERIFY-${id}`, epic_id: '093', blueprint_id: '001', status: 'pending',
      },
    });
  }
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({ verify: 'npm test' }));
  fs.writeFileSync(path.join(repo, 'README'), 'base\n');
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '--quiet', '-m', 'plan'], { cwd: repo });
  const boot = __coordinate({ command: 'bootstrap', repoRoot: repo, blueprint: epic });
  const cfgDir = path.join(boot.integrationPath, '.bouncer');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, 'config.json'),
    `${JSON.stringify({ coordinator: { max_parallel: 2 } }, null, 2)}\n`);
  const prepared = __coordinate({
    command: 'prepare', repoRoot: repo, blueprint: epic, cwd: boot.integrationPath,
    deps: { makeLeaseId: (() => { let n = 0; return () => `v-lease-${++n}`; })() },
  });
  assert.strictEqual(prepared.ok, true, JSON.stringify(prepared));
  __writeCurrent({
    repoRoot: repo, blueprint: epic, base: 'main', task: `${epic}/tasks/001/tasks.md`,
  });
  return {
    repo, epic, integration: boot.integrationPath,
    worker002: prepared.tasks.find((t) => t.id === '002').workerPath,
  };
}

test('entriesForVerify and readVerifyCommand follow the worker lease over the pointer', () => {
  const { epic, worker002, integration } = leaseVerifyFixture();
  const fromWorker = __entriesForVerify(worker002, epic);
  assert.strictEqual(fromWorker.length, 1);
  assert.strictEqual(fromWorker[0].id, 'TASKS-002');
  assert.strictEqual(readVerifyCommand(worker002, epic), 'node -e "process.exit(0)"');
  assert.strictEqual(readVerifyCommand(integration, epic), 'node -e "process.exit(1)"');
});

test('runVerification refuses a worker cwd without an active lease', () => {
  const { epic, worker002, integration } = leaseVerifyFixture();
  // entriesForVerify가 비면 레거시 verification.md로 떨어진 뒤 scope에서 거절한다.
  const legacy = path.join(worker002, epic, 'verification.md');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.copyFileSync(path.join(worker002, epic, 'tasks/002/verification.md'), legacy);
  const ledgerFile = path.join(integration, '.bouncer/runtime/coordinator.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
  ledger.tasks.find((t) => t.id === '002').lease.status = 'revoked';
  fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
  assert.throws(
    () => runVerification({
      repoRoot: worker002, blueprintDir: epic, deps: fixedDeps(),
      exec: () => ({ status: 0, stdout: '', stderr: '' }),
    }),
    (e) => e.code === 'VERIFY_IDENTITY_INVALID'
      && /no active lease for worker worktree/.test(e.message),
  );
});

test('runVerification refuses a worker cwd with an unreadable ledger', () => {
  const { epic, worker002, integration } = leaseVerifyFixture();
  const legacy = path.join(worker002, epic, 'verification.md');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.copyFileSync(path.join(worker002, epic, 'tasks/002/verification.md'), legacy);
  fs.writeFileSync(path.join(integration, '.bouncer/runtime/coordinator.json'), '{ truncated');
  assert.throws(
    () => runVerification({
      repoRoot: worker002, blueprintDir: epic, deps: fixedDeps(),
      exec: () => ({ status: 0, stdout: '', stderr: '' }),
    }),
    (e) => e.code === 'VERIFY_IDENTITY_INVALID'
      && /no active lease for worker worktree/.test(e.message),
  );
});

test('runVerification with taskId uses that task verify command and rejects unknown ids', () => {
  const repo = setupRepo('npm test');
  writeTasks(repo, 'npm test');
  const dir006 = path.join(repo, BP_REL, 'tasks/006');
  fs.mkdirSync(dir006, { recursive: true });
  fs.writeFileSync(path.join(dir006, 'tasks.md'), `---
type: bouncer.tasks
title: Six
description: Tasks for 006
resource: ${BP_REL}/tasks/006/tasks.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: TASKS-006
  epic_id: '001'
  blueprint_id: '001'
  status: ready
  verify: npm run ci
---
# Tasks
`);
  fs.writeFileSync(path.join(dir006, 'verification.md'), `---
type: bouncer.verification
title: Verify 006
description: Verification evidence
resource: ${BP_REL}/tasks/006/verification.md
tags:
  - bouncer
timestamp: 2026-07-01T00:00:00.000Z
bouncer:
  id: VERIFY-006
  epic_id: '001'
  blueprint_id: '001'
  status: pending
---
# Verification
`);
  const result = runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    taskId: '006',
    scope: { kind: 'terminal', key: 'EPIC-001/BP-001:head' },
    deps: fixedDeps(),
    exec: () => ({ status: 0, stdout: 'ok\n', stderr: '' }),
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.command, 'npm run ci');

  assert.throws(
    () => runVerification({
      repoRoot: repo,
      blueprintDir: BP_REL,
      taskId: '099',
      scope: { kind: 'task', key: 'EPIC-001/BP-001/TASK-099' },
      deps: fixedDeps(),
      exec: () => ({ status: 0, stdout: '', stderr: '' }),
    }),
    (error) => error.code === 'VERIFY_IDENTITY_INVALID',
  );

  // RD-002: 세 자리가 아닌 taskId는 조용히 무시하지 않고 identity 거절.
  for (const badId of ['6', '06', '0001', 'TASKS-006', '00a', '']) {
    assert.throws(
      () => __entriesForVerify(repo, BP_REL, badId),
      (error) => error.code === 'VERIFY_IDENTITY_INVALID',
      `taskId=${JSON.stringify(badId)}`,
    );
    assert.throws(
      () => runVerification({
        repoRoot: repo,
        blueprintDir: BP_REL,
        taskId: badId,
        scope: { kind: 'terminal', key: 'EPIC-001/BP-001:head' },
        deps: fixedDeps(),
        exec: () => ({ status: 0, stdout: '', stderr: '' }),
      }),
      (error) => error.code === 'VERIFY_IDENTITY_INVALID',
      `runVerification taskId=${JSON.stringify(badId)}`,
    );
  }
});
