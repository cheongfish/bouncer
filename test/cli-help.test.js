// test/cli-help.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { runCli } = require('../scripts/lib/cli');

const SUBCOMMANDS = [
  'validate', 'scaffold', 'finalize', 'seed-worktree', 'verify', 'init', 'graph-sync',
  'graph-suggest',
  'context-search',
  'graphify-bin',
  'project-root',
  'current',
  'migrate',
  'commit',
  'coordinate',
  'execute',
  'import',
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

test('graph-sync help names source + test + context scopes', () => {
  const r = capture([]);
  assert.match(r.out, /graph-sync Rebuild stale graphify source \+ test \+ context graphs/);
});

test('usage lists graph-suggest --query <text> [--seed <value>]...', () => {
  const r = capture([]);
  assert.match(
    r.out,
    /graph-suggest\s+--query <text> \[--seed <value>\]\.\.\./,
  );
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

test('usage lists context-search --mode --query [--seed] [--max-candidates]', () => {
  const r = capture([]);
  assert.match(
    r.out,
    /context-search\s+--mode <decision\|implementation\|history> --query <text>/,
  );
  assert.match(r.out, /\[--max-candidates <1\.\.8>\]/);
});

test('context-search without --mode exits 2 on stderr', () => {
  const r = capture(['context-search', '--query', 'epic-060']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /mode/i);
  assert.strictEqual(r.out, '');
});

test('context-search with invalid --mode exits 2', () => {
  const r = capture(['context-search', '--mode', 'other', '--query', 'epic-060']);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /mode/i);
  assert.strictEqual(r.out, '');
});

test('context-search with max-candidates out of range exits 2', () => {
  const r = capture([
    'context-search', '--mode', 'decision', '--query', 'epic-060', '--max-candidates', '9',
  ]);
  assert.strictEqual(r.code, 2);
  assert.match(r.err, /max-candidates/i);
  assert.strictEqual(r.out, '');
});

test('usage lists current --replace', () => {
  const r = capture([]);
  assert.match(r.out, /current\s+\[--set <blueprint dir>.*\[--replace\]/s);
});
