'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readDoc } = require('../scripts/lib/frontmatter');
const { executeVerify, readVerifyCommand, runVerification } = require('../scripts/lib/verification');

const BP_REL = '.bouncer/context/epics/001-auth/blueprints/001-login';

function setupRepo(verify = 'npm test') {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-verification-'));
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
    exec: (command, options) => {
      assert.strictEqual(command, 'npm test');
      assert.strictEqual(options.cwd, repo);
      return { stdout: 'line one\nline two\n', stderr: '' };
    },
  });

  assert.deepStrictEqual(result, { ok: true, command: 'npm test', exitCode: 0 });
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
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
  const verification = readDoc(path.join(repo, BP_REL, 'tasks/001/verification.md'));
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
const noisyCommand = (lines, exitCode) => 'node -e "'
  + `for(let i=1;i<=${lines};i++)console.log('line '+i);process.exit(${exitCode})`
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
    exec: (command) => {
      executed = command;
      return { stdout: 'ok\n', stderr: '' };
    },
  });
  assert.strictEqual(executed, declared);
  assert.strictEqual(result.command, declared);
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
    exec: (command) => {
      executed = command;
      return { stdout: '', stderr: '' };
    },
  });
  assert.strictEqual(executed, 'npm test');
});

test('runVerification falls back to config.verify when the task document is absent', () => {
  const repo = setupRepo('npm test');
  let executed;
  runVerification({
    repoRoot: repo,
    blueprintDir: BP_REL,
    exec: (command) => {
      executed = command;
      return { stdout: '', stderr: '' };
    },
  });
  assert.strictEqual(executed, 'npm test');
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
    exec: () => ({ stdout: 'ok\n', stderr: '' }),
  });
  assert.deepStrictEqual(result, {
    ok: true, command: 'node -e "process.exit(0)"', exitCode: 0,
  });

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
