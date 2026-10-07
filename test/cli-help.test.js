// test/cli-help.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { runCli } = require('../scripts/lib/cli');

const SUBCOMMANDS = [
  'validate', 'scaffold', 'finalize', 'seed-worktree', 'verify', 'init', 'graph-sync',
  'graph-suggest',
  'intent',
  'graphify-bin',
  'project-root',
  'subagent-model',
  'codex-agents',
  'current',
  'migrate',
  'commit',
  'commit-guard',
  'coordinate',
  'execute',
  'plan',
  'run',
  'import',
  'review-dispatch',
  'review',
  'dispatch',
];

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (s) => { buf.out += s; },
    err: (s) => { buf.err += s; },
  });
  return { code, ...buf };
}

test('bouncer with no arguments prints usage and exits 0', () => {
  const r = capture([]);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /usage/i);
  assert.strictEqual(r.err, '');
});

test('usage lists task-layout migration', () => {
  assert.match(capture([]).out, /task-layout \[--dry-run\]/);
});

test('usage lists retention dry-run and apply forms', () => {
  const out = capture([]).out;
  assert.match(out, /migrate\s+retention\b/);
  assert.match(out, /Audit closed blueprints for retention \(dry-run/);
  assert.match(out, /retention --apply --blueprint <dir>/);
});

test('every subcommand is listed in the usage text', () => {
  const r = capture([]);
  for (const name of SUBCOMMANDS) {
    // 행 머리의 서브커맨드 이름만 본다. finalize 설명의 "commit" 단어에
    // 걸려 신설 명령이 빠진 채로 통과하지 않게 한다.
    assert.match(
      r.out,
      new RegExp(`(?:^|\\n)\\s*${name}\\b`, 'm'),
      `usage omits ${name}`,
    );
  }
});

test('usage omits the retired distill command', () => {
  const retired = ['d', 'istill'].join('');
  assert.doesNotMatch(capture([]).out, new RegExp(`^\\s*${retired}\\b`, 'm'));
});

test('--help, -h, and help all print the same usage on stdout', () => {
  const baseline = capture([]).out;
  for (const flag of [['--help'], ['-h'], ['help']]) {
    const r = capture(flag);
    assert.strictEqual(r.code, 0, `${flag} exit code`);
    assert.strictEqual(r.out, baseline, `${flag} output`);
  }
});

test('an unknown command still fails, but says what is available', () => {
  const r = capture(['validat']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /unknown command: validat/);
  assert.match(r.err, /usage/i);
  assert.strictEqual(r.out, '');
});

test('usage lists scaffold task --blueprint --id', () => {
  const r = capture([]);
  assert.match(r.out, /task --blueprint <dir> --id <ddd>/);
});

test('usage lists scaffold context-review --blueprint', () => {
  const r = capture([]);
  assert.match(r.out, /context-review --blueprint <dir>/);
});

test('usage lists scaffold blueprint --scale light|full', () => {
  const r = capture([]);
  assert.match(r.out, /blueprint --epic-dir <dir> --id <ddd> --name <slug> \[--scale light\|full\]/);
});

test('graph-sync help names source + test scopes', () => {
  const r = capture([]);
  assert.match(r.out, /graph-sync Rebuild stale graphify source \+ test graphs/);
});

test('usage lists graph-suggest --query <text> [--seed <value>]... [--debug]', () => {
  const r = capture([]);
  assert.match(
    r.out,
    /graph-suggest\s+--query <text> \[--seed <value>\]\.\.\. \[--debug\]/,
  );
  // --debug는 값 없는 boolean flag — usage에 <...> 값을 붙이지 않는다.
  assert.doesNotMatch(r.out, /graph-suggest[\s\S]{0,120}--debug\s+</);
});

test('graph-suggest without --query exits 2 on stderr', () => {
  const r = capture(['graph-suggest']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /query/i);
  assert.strictEqual(r.out, '');
});

test('graph-suggest with empty --query exits 2', () => {
  const r = capture(['graph-suggest', '--query', '']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /query/i);
  assert.strictEqual(r.out, '');
});

test('graph-suggest with valueless --seed exits 2', () => {
  const r = capture(['graph-suggest', '--query', 'x', '--seed']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /seed/i);
  assert.strictEqual(r.out, '');
});

test('help output does not list context-search', () => {
  const r = capture([]);
  assert.doesNotMatch(r.out, /context-search/);
});

test('context-search is unknown command exit 2', () => {
  let stdout = '';
  let stderr = '';
  const code = runCli(['context-search', '--mode', 'decision', '--query', 'x'], {
    out: (s) => { stdout += s; },
    err: (s) => { stderr += s; },
  });
  assert.strictEqual(code, 2);
  assert.strictEqual(stdout, '');
  assert.match(stderr, /unknown command: context-search/);
});

test('usage lists run preflight --blueprint', () => {
  const r = capture([]);
  assert.match(r.out, /run\s+preflight --blueprint <dir>/);
});

test('usage lists current --replace', () => {
  const r = capture([]);
  assert.match(r.out, /current\s+\[--set <blueprint dir>.*\[--replace\]/s);
});

test('usage lists intent --symbol [--candidate] [--limit]', () => {
  const r = capture([]);
  assert.match(r.out, /intent\s+--symbol <function-name>/);
  assert.match(r.out, /\[--candidate <qualified-ref>\]/);
  assert.match(r.out, /\[--limit <1\.\.5>\]/);
});

test('unknown command is still rejected after intent is public', () => {
  const r = capture(['intet']);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown command: intet/);
  assert.match(r.err, /intent/);
  assert.equal(r.out, '');
});

test('usage lists finalize prepare --blueprint', () => {
  const r = capture([]);
  assert.match(r.out, /finalize\s+prepare --blueprint <dir>/);
  assert.match(r.out, /finalize\s+links --blueprint <dir>/);
  assert.match(r.out, /finalize\s+release-main --blueprint <dir>/);
  assert.match(r.out, /finalize\s+--blueprint <dir> \[--yes\]/);
});

test('usage lists subagent-model and codex-agents check', () => {
  const out = capture([]).out;
  assert.match(out, /subagent-model --agent <name> \[--provider <name>\]/);
  assert.match(out, /codex-agents check --agent <name>/);
});

test('usage lists review-dispatch plan and execute forms', () => {
  const out = capture([]).out;
  assert.match(out, /review-dispatch\s+plan --blueprint <dir>/);
  assert.match(
    out,
    /review-dispatch\s+execute --blueprint <dir> \[--task <ddd>\] --base <sha> --head <sha>/,
  );
});

test('usage lists review record form', () => {
  const out = capture([]).out;
  assert.match(
    out,
    /review record --blueprint <dir> \[--task <ddd>\] --round <json-file> \[--status <requested\|addressed\|accepted>\]/,
  );
});

test('review record rejects --status pending, non-ddd --task, and missing --round', () => {
  const pending = capture([
    'review', 'record', '--blueprint', 'bp', '--round', 'x.json', '--status', 'pending',
  ]);
  assert.strictEqual(pending.code, 2);
  assert.match(pending.err, /status/i);
  assert.strictEqual(pending.out, '');

  const task = capture([
    'review', 'record', '--blueprint', 'bp', '--task', '1', '--round', 'x.json',
  ]);
  assert.strictEqual(task.code, 2);
  assert.match(task.err, /task/i);
  assert.strictEqual(task.out, '');

  const missingRound = capture(['review', 'record', '--blueprint', 'bp']);
  assert.strictEqual(missingRound.code, 2);
  assert.match(missingRound.err, /round/i);
  assert.strictEqual(missingRound.out, '');
});

test('review-dispatch without subcommand exits 2 on stderr', () => {
  const r = capture(['review-dispatch']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /review-dispatch/);
  assert.strictEqual(r.out, '');
});

test('usage lists dispatch print form', () => {
  const out = capture([]).out;
  assert.match(
    out,
    /dispatch print --role <implementer\|reviewer\|debugger\|coordinator> --cwd <dir> --input <file> --out <dir>/,
  );
});


test('usage lists coordinate revoke and lease flags', () => {
  const r = capture([]);
  assert.match(r.out, /coordinate revoke/);
  assert.match(r.out, /--lease-id/);
  assert.match(r.out, /--generation/);
  assert.match(r.out, /coordinate integrate/);
  assert.match(r.out, /omit --task for the wave/);
});

test('usage lists coordinate repair review-finding and required-task CI forms', () => {
  const out = capture([]).out;
  // CI 형태는 종단 verification이 필수. 선택 [--task]로 적으면 리뷰 형태와
  // 같은 생략 규칙을 암시해 coordinator의 task-required와 어긋난다.
  assert.match(
    out,
    /coordinate repair --blueprint <dir> --task <ddd> --failure-command <cmd>/,
  );
  assert.doesNotMatch(out, /\[--task <ddd>\] --failure-command/);
  assert.match(
    out,
    /coordinate repair --blueprint <dir> \[--task <ddd>\] --review-finding <id>/,
  );
  assert.match(out, /\[--review-finding <id>\]\.\.\./);
});

const COORDINATE_SUBCOMMANDS = [
  'bootstrap', 'prepare', 'ready', 'dispatch', 'report', 'record', 'rerecord', 'integrate',
  'status', 'revise', 'repair', 'partial-close', 'critical-recovery', 'revoke', 'next',
];

test('coordinate <sub> --help and -h print that subcommand usage on stdout', () => {
  for (const sub of COORDINATE_SUBCOMMANDS) {
    for (const flag of ['--help', '-h']) {
      const r = capture(['coordinate', sub, flag]);
      assert.strictEqual(r.code, 0, `${sub} ${flag} exit`);
      assert.strictEqual(r.err, '', `${sub} ${flag} stderr`);
      assert.ok(
        r.out.startsWith(`usage: bouncer coordinate ${sub}`),
        `${sub} ${flag} stdout prefix: ${r.out.slice(0, 80)}`,
      );
    }
  }
});

test('coordinate next --help lists flags, actions, and response fields', () => {
  const r = capture(['coordinate', 'next', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.match(r.out, /--blueprint <dir>/);
  assert.match(r.out, /\[--task <ddd>\]/);
  assert.match(r.out, /\[--repo <dir>\]/);
  assert.match(r.out, /prepare/);
  assert.match(r.out, /drive_tasks/);
  assert.match(r.out, /verification_node/);
  assert.match(r.out, /final_review/);
  assert.match(r.out, /dispatch/);
  assert.match(r.out, /implement/);
  assert.match(r.out, /action/);
  assert.match(r.out, /cwd/);
  assert.match(r.out, /argv/);
  assert.match(r.out, /judge/);
  assert.match(r.out, /task_ids/);
  assert.match(r.out, /payload/);
  assert.match(r.out, /checkpoint/);
});

test('coordinate report --help lists report outcome enum', () => {
  const r = capture(['coordinate', 'report', '--help']);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /accepted\|rework\|scope_revision\|task_change\|blocked/);
});

test('coordinate --help prints the coordinate registry usage on stdout', () => {
  const { coordinate } = require('../scripts/lib/cli-git-commands.js');
  const r = capture(['coordinate', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.strictEqual(r.out, coordinate.usage);
});

test('coordinate dispatch --help wins over a missing ledger fence', () => {
  const r = capture(['coordinate', 'dispatch', '--blueprint', 'x', '--task', '001', '--help']);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.err, '');
  assert.ok(r.out.startsWith('usage: bouncer coordinate dispatch'));
  assert.doesNotMatch(r.out, /ledger-checkpoint-invalid/);
  assert.doesNotMatch(r.err, /ledger-checkpoint-invalid/);
});

test('coordinate revoke --reason -h is a flag value, not help', () => {
  const r = capture([
    'coordinate', 'revoke', '--blueprint', 'x', '--task', '001', '--reason', '-h',
    '--ledger-path', 'p', '--ledger-hash', 'h',
  ]);
  assert.ok(!r.out.startsWith('usage:'));
});

test('coordinate report missing required flag appends that subcommand usage', () => {
  const r = capture([
    'coordinate', 'report', '--blueprint', 'x',
    '--ledger-path', 'p', '--ledger-hash', 'h', '--attempt', '1',
  ]);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /--task-brief-hash is required/);
  assert.match(r.err, /usage: bouncer coordinate report/);
  assert.strictEqual(r.out, '');
});

test('coordinate unknown subcommand appends the full coordinate usage', () => {
  const { coordinate } = require('../scripts/lib/cli-git-commands.js');
  const r = capture(['coordinate', 'nope', '--blueprint', 'x']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /command must be/);
  assert.ok(r.err.includes(coordinate.usage));
  assert.strictEqual(r.out, '');
});

test('review record and dispatch print --help/-h print on stdout', () => {
  for (const argv of [
    ['review', 'record', '--help'],
    ['review', 'record', '-h'],
    ['dispatch', 'print', '--help'],
    ['dispatch', 'print', '-h'],
  ]) {
    const r = capture(argv);
    assert.strictEqual(r.code, 0, `${argv.join(' ')} exit`);
    assert.strictEqual(r.err, '', `${argv.join(' ')} stderr`);
  }
  const dispatchHelp = capture(['dispatch', 'print', '--help']);
  assert.match(dispatchHelp.out, /not JSON/);
});

test('coordinator procedure points at subcommand --help instead of plugin sources', () => {
  const md = fs.readFileSync('agents/bouncer-coordinator.md', 'utf8');
  assert.match(md, /--help`; do not read plugin sources for them/);
});
