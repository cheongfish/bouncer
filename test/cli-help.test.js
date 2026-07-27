// test/cli-help.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { runCli } = require('../scripts/lib/cli');

const SUBCOMMANDS = ['validate', 'scaffold', 'finalize', 'verify', 'init', 'advise'];

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

test('every subcommand is listed in the usage text', () => {
  const r = capture([]);
  for (const name of SUBCOMMANDS) {
    assert.match(r.out, new RegExp(`\\b${name}\\b`), `usage omits ${name}`);
  }
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
