'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { runCli } = require('../scripts/lib/cli');

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (value) => { buf.out += value; },
    err: (value) => { buf.err += value; },
  });
  return { code, ...buf };
}

function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cli-distill-'));
  fs.mkdirSync(path.join(repo, '.bouncer', 'distill'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts', 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  fs.writeFileSync(path.join(repo, '.bouncer', 'Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  routing_enabled: true',
    '  shards:',
    '    - core',
    '    - source',
    '    - docs',
    '---',
    '# summary',
    '',
  ].join('\n'));
  const writeShard = (id, metadata, body) => {
    fs.writeFileSync(path.join(repo, '.bouncer', 'distill', `${id}.md`), [
      '---',
      'distill:',
      `  id: ${id}`,
      ...metadata,
      '---',
      body,
      '',
    ].join('\n'));
  };
  writeShard('core', ['  always: true', '  paths: []', '  pulls: []'], '# core');
  writeShard('source', ['  paths:', '    - scripts/**', '  pulls: [core]'], '# source');
  writeShard('docs', ['  paths:', '    - docs/**', '  pulls: []'], '# docs');
  return repo;
}

test('distill --for renders only the routed body and keeps stderr empty', () => {
  const repo = fixture();
  const result = capture(['distill', '--repo', repo, '--for', 'scripts/src/lib/cli.ts']);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(result.out, '# core\n\n\n# source\n');
  assert.strictEqual(result.err, '');
});

test('distill --all and --audit ignore routing and select every shard', () => {
  const repo = fixture();
  const all = capture(['distill', '--repo', repo, '--all']);
  const audit = capture(['distill', '--repo', repo, '--audit', '--json']);

  assert.strictEqual(all.code, 0);
  assert.strictEqual(all.out, '# core\n\n\n# source\n\n\n# docs\n');
  assert.deepStrictEqual(JSON.parse(audit.out).ids, ['core', 'source', 'docs']);
  assert.strictEqual(JSON.parse(audit.out).full, true);
  assert.strictEqual(audit.err, '');
});

test('distill --route and --json expose deterministic routing metadata', () => {
  const repo = fixture();
  const route = capture(['distill', '--repo', repo, '--route', 'docs/index.md']);
  const body = capture(['distill', '--repo', repo, '--for', 'docs/index.md', '--json']);

  assert.strictEqual(route.code, 0);
  assert.deepStrictEqual(JSON.parse(route.out).ids, ['core', 'docs']);
  assert.deepStrictEqual(JSON.parse(body.out).ids, ['core', 'docs']);
  assert.strictEqual(JSON.parse(body.out).content, '# core\n\n\n# docs\n');
});

test('distill rejects unknown and mixed modes on stderr without stdout', () => {
  const repo = fixture();
  for (const args of [
    ['--wat'],
    ['--all', '--for', 'docs/index.md'],
    ['--route'],
  ]) {
    const result = capture(['distill', '--repo', repo, ...args]);
    assert.strictEqual(result.code, 2);
    assert.strictEqual(result.out, '');
    assert.match(result.err, /distill:/);
  }
});
