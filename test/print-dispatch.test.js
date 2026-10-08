'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runCli } = require('../scripts/lib/cli');

const WORKER_IDENTITY =
  "You are the dispatched bouncer-reviewer itself. Do this role's work directly and never dispatch any Bouncer agent.";
const COORDINATOR_IDENTITY =
  'You are the dispatched bouncer-coordinator itself. Dispatch only your workers, each under rules/cursor-print-dispatch.md.';

/**
 * print 디스패치 테스트용 임시 트리: repo 설정, 역할 문서, 가짜 agent, cwd/out.
 *
 * @returns {{ root: string, cwd: string, outDir: string, inputFile: string, agentsDir: string, agentBin: string }}
 */
function makeTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-print-dispatch-'));
  const cwd = path.join(root, 'cwd');
  const outDir = path.join(root, 'out');
  const agentsDir = path.join(root, 'agents');
  fs.mkdirSync(cwd);
  fs.mkdirSync(outDir);
  fs.mkdirSync(agentsDir);
  fs.mkdirSync(path.join(root, '.bouncer'));
  fs.writeFileSync(
    path.join(root, '.bouncer', 'config.json'),
    JSON.stringify({
      subagents: {
        provider: 'cursor',
        dispatch: 'print',
        cursor: { 'bouncer-reviewer': 'slug-x' },
      },
    }),
  );
  writeRole(agentsDir, 'reviewer', '# Bouncer reviewer\nrole body\n');
  writeRole(agentsDir, 'coordinator', '# Bouncer coordinator\ncoord body\n');
  const inputFile = path.join(root, 'controller-input.md');
  const inputText = 'controller input text';
  fs.writeFileSync(inputFile, inputText);
  const agentBin = path.join(root, 'agent');
  writeFakeAgent(agentBin, {});
  return { root, cwd, outDir, inputFile, inputText, agentsDir, agentBin };
}

/**
 * 역할 문서 픽스처. frontmatter는 제품 문서와 같은 블록 형태만 맞춘다.
 *
 * @param {string} agentsDir
 * @param {string} role
 * @param {string} body
 */
function writeRole(agentsDir, role, body) {
  fs.writeFileSync(
    path.join(agentsDir, `bouncer-${role}.md`),
    `---\nname: bouncer-${role}\ndescription: fixture\n---\n\n${body}`,
  );
}

/**
 * PATH의 진짜 `agent`를 타지 않게, 받은 argv와 stream-json 줄을 기록하는 실행 파일.
 *
 * @param {string} agentPath
 * @param {{ statusExit?: number, statusText?: string, printExit?: number, stdoutLines?: string[] }} opts
 */
function writeFakeAgent(agentPath, opts) {
  const statusExit = opts.statusExit ?? 0;
  const statusText = opts.statusText ?? '';
  const printExit = opts.printExit ?? 0;
  const stdoutLines = opts.stdoutLines ?? [
    '{"type":"assistant"}',
    '{"type":"result","result":"REPORT","is_error":false}',
  ];
  const script = `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'status') {
  process.stdout.write(${JSON.stringify(statusText)});
  process.exit(${statusExit});
}
fs.writeFileSync(path.join(process.cwd(), 'argv.json'), JSON.stringify(args));
for (const line of ${JSON.stringify(stdoutLines)}) {
  process.stdout.write(line + '\\n');
}
process.exit(${printExit});
`;
  fs.writeFileSync(agentPath, script);
  fs.chmodSync(agentPath, 0o755);
}

function runPrint(tree, extra = {}) {
  const printDispatch = require('../scripts/lib/print-dispatch');
  return printDispatch.runPrintDispatch({
    repoRoot: tree.root,
    role: extra.role || 'reviewer',
    cwd: extra.cwd || tree.cwd,
    inputFile: extra.inputFile || tree.inputFile,
    outDir: extra.outDir || tree.outDir,
    deps: {
      agentBin: extra.agentBin || tree.agentBin,
      agentsDir: extra.agentsDir || tree.agentsDir,
    },
  });
}

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('happy path assembles prompt, argv, and final result report', () => {
  const tree = makeTree();
  try {
    const result = runPrint(tree);
    assert.equal(result.ok, true);
    assert.equal(result.report, 'REPORT');
    const promptPath = path.join(tree.outDir, 'bouncer-reviewer.prompt.md');
    const prompt = fs.readFileSync(promptPath, 'utf8');
    assert.ok(prompt.startsWith(`${WORKER_IDENTITY}\n\n# `));
    assert.ok(prompt.endsWith(tree.inputText));
    const argv = JSON.parse(fs.readFileSync(path.join(tree.cwd, 'argv.json'), 'utf8'));
    assert.deepEqual(argv.slice(0, 9), [
      '--print', '--force', '--trust', '--output-format', 'stream-json',
      '--workspace', tree.cwd, '--model', 'slug-x',
    ]);
    assert.equal(argv[9], '--');
    assert.equal(argv[10], prompt);
    assert.equal(result.model, 'slug-x');
    assert.equal(result.exit_code, 0);
    assert.equal(result.prompt, promptPath);
    assert.equal(result.stdout, path.join(tree.outDir, 'bouncer-reviewer.jsonl'));
    assert.equal(result.stderr, path.join(tree.outDir, 'bouncer-reviewer.log'));
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('omits --model when the role slug is inherit/null', () => {
  const tree = makeTree();
  try {
    fs.writeFileSync(
      path.join(tree.root, '.bouncer', 'config.json'),
      JSON.stringify({
        subagents: { provider: 'cursor', dispatch: 'print', cursor: {} },
      }),
    );
    const result = runPrint(tree);
    assert.equal(result.ok, true);
    assert.equal(result.model, null);
    const argv = JSON.parse(fs.readFileSync(path.join(tree.cwd, 'argv.json'), 'utf8'));
    assert.equal(argv.includes('--model'), false);
    assert.deepEqual(argv.slice(0, 7), [
      '--print', '--force', '--trust', '--output-format', 'stream-json',
      '--workspace', tree.cwd,
    ]);
    assert.equal(argv[7], '--');
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('coordinator prompt starts with the coordinator identity line', () => {
  const tree = makeTree();
  try {
    const result = runPrint(tree, { role: 'coordinator' });
    assert.equal(result.ok, true);
    const prompt = fs.readFileSync(
      path.join(tree.outDir, 'bouncer-coordinator.prompt.md'),
      'utf8',
    );
    assert.ok(prompt.startsWith(`${COORDINATOR_IDENTITY}\n\n# `));
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('missing dispatch setting is print-dispatch-disabled and writes no prompt', () => {
  const tree = makeTree();
  try {
    fs.writeFileSync(
      path.join(tree.root, '.bouncer', 'config.json'),
      JSON.stringify({ subagents: { provider: 'cursor' } }),
    );
    const result = runPrint(tree);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'print-dispatch-disabled');
    assert.equal(fs.existsSync(path.join(tree.outDir, 'bouncer-reviewer.prompt.md')), false);
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('agent status exit 1 is agent-unavailable', () => {
  const tree = makeTree();
  try {
    writeFakeAgent(tree.agentBin, { statusExit: 1 });
    const result = runPrint(tree);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'agent-unavailable');
    assert.equal(fs.existsSync(path.join(tree.outDir, 'bouncer-reviewer.prompt.md')), false);
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('agent status Not logged in is agent-unavailable', () => {
  const tree = makeTree();
  try {
    writeFakeAgent(tree.agentBin, { statusExit: 0, statusText: 'Not logged in\n' });
    const result = runPrint(tree);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'agent-unavailable');
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('print process exit 3 is agent-exit-nonzero', () => {
  const tree = makeTree();
  try {
    writeFakeAgent(tree.agentBin, { printExit: 3 });
    const result = runPrint(tree);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'agent-exit-nonzero');
    assert.equal(result.exit_code, 3);
    assert.ok(result.stdout);
    assert.ok(result.stderr);
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('stdout without a result event is result-missing', () => {
  const tree = makeTree();
  try {
    writeFakeAgent(tree.agentBin, { stdoutLines: ['{"type":"assistant"}'] });
    const result = runPrint(tree);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'result-missing');
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('last result is_error true is result-error', () => {
  const tree = makeTree();
  try {
    writeFakeAgent(tree.agentBin, {
      stdoutLines: [
        '{"type":"assistant"}',
        '{"type":"result","result":"FAILED","is_error":true}',
      ],
    });
    const result = runPrint(tree);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'result-error');
    assert.equal(result.report, 'FAILED');
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('input that starts with a dash is passed after --', () => {
  const tree = makeTree();
  try {
    const inputFile = path.join(tree.root, '-dashed-input.md');
    const inputText = '-looks-like-a-flag';
    fs.writeFileSync(inputFile, inputText);
    const result = runPrint(tree, { inputFile });
    assert.equal(result.ok, true);
    const argv = JSON.parse(fs.readFileSync(path.join(tree.cwd, 'argv.json'), 'utf8'));
    const dash = argv.indexOf('--');
    assert.ok(dash >= 0);
    assert.ok(argv[dash + 1].endsWith(inputText));
    assert.ok(!argv.slice(0, dash).includes(inputText));
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('dispatch rejects non-print verbs and missing flags with exit 2', () => {
  const missing = capture(['dispatch', 'print']);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /dispatch/);
  assert.equal(missing.out, '');

  const other = capture(['dispatch', 'plan']);
  assert.equal(other.code, 2);
  assert.equal(other.out, '');

  const badRole = capture([
    'dispatch', 'print',
    '--role', 'implementer-typo',
    '--cwd', '/tmp',
    '--input', '/tmp/x',
    '--out', '/tmp/y',
  ]);
  assert.equal(badRole.code, 2);

  const dup = capture([
    'dispatch', 'print',
    '--role', 'reviewer', '--role', 'debugger',
    '--cwd', '/tmp',
    '--input', '/tmp/x',
    '--out', '/tmp/y',
  ]);
  assert.equal(dup.code, 2);
});

test('CLI accepts --role context-reviewer and reaches the opt-in check', () => {
  const tree = makeTree();
  try {
    // opt-in이 없는 설정이면 role 검증을 통과한 뒤 print-dispatch-disabled로 끝나야 한다.
    fs.writeFileSync(
      path.join(tree.root, '.bouncer', 'config.json'),
      JSON.stringify({ subagents: { provider: 'cursor' } }),
    );
    const { code, out } = capture([
      'dispatch', 'print',
      '--role', 'context-reviewer',
      '--cwd', tree.cwd,
      '--input', tree.inputFile,
      '--out', tree.outDir,
      '--repo', tree.root,
    ]);
    assert.notEqual(code, 2);
    assert.equal(JSON.parse(out).reason, 'print-dispatch-disabled');
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});

test('CLI rejects misspelled context-reviewer roles and lists five roles', () => {
  for (const role of ['context_reviewer', 'bouncer-context-reviewer']) {
    const r = capture([
      'dispatch', 'print', '--role', role,
      '--cwd', '/tmp', '--input', '/tmp/x', '--out', '/tmp/y',
    ]);
    assert.equal(r.code, 2);
    assert.match(r.err, /context-reviewer/);
  }
});

test('context-reviewer prompt uses the worker identity line, role body, and model slug', () => {
  const tree = makeTree();
  try {
    writeRole(tree.agentsDir, 'context-reviewer', '# Bouncer context-reviewer\n<context-reviewer role body marker>\n');
    fs.writeFileSync(
      path.join(tree.root, '.bouncer', 'config.json'),
      JSON.stringify({
        subagents: {
          provider: 'cursor',
          dispatch: 'print',
          cursor: { 'bouncer-context-reviewer': 'slug-cr' },
        },
      }),
    );
    const result = runPrint(tree, { role: 'context-reviewer' });
    assert.equal(result.ok, true);
    const prompt = fs.readFileSync(path.join(tree.outDir, 'bouncer-context-reviewer.prompt.md'), 'utf8');
    assert.ok(prompt.startsWith("You are the dispatched bouncer-context-reviewer itself. Do this role's work directly and never dispatch any Bouncer agent.\n\n"));
    assert.match(prompt, /<context-reviewer role body marker>/);
    const argv = JSON.parse(fs.readFileSync(path.join(tree.cwd, 'argv.json'), 'utf8'));
    assert.deepEqual(argv.slice(argv.indexOf('--model'), argv.indexOf('--model') + 2), ['--model', 'slug-cr']);
  } finally {
    fs.rmSync(tree.root, { recursive: true, force: true });
  }
});
