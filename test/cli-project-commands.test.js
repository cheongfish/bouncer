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
    '  routing_enabled: false',
    '  shards:',
    '    - core',
    '    - source',
    '    - docs',
    '---',
    '# summary',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, '.bouncer', 'config.json'), `${JSON.stringify({
    distill: { routing_enabled: true },
  })}\n`);
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
  const payload = JSON.parse(audit.out);
  assert.deepStrictEqual(payload.ids, ['core', 'source', 'docs']);
  assert.strictEqual(payload.full, true);
  assert.deepStrictEqual(payload.audit.shards, [
    {
      id: 'core',
      path: '.bouncer/distill/core.md',
      always: true,
      pathsKnown: true,
      pullsKnown: true,
      paths: [],
      pulls: [],
    },
    {
      id: 'source',
      path: '.bouncer/distill/source.md',
      always: false,
      pathsKnown: true,
      pullsKnown: true,
      paths: ['scripts/**'],
      pulls: ['core'],
    },
    {
      id: 'docs',
      path: '.bouncer/distill/docs.md',
      always: false,
      pathsKnown: true,
      pullsKnown: true,
      paths: ['docs/**'],
      pulls: [],
    },
  ]);
  assert.strictEqual(Object.hasOwn(payload.audit.shards[0], 'raw'), false);
  assert.strictEqual(Object.hasOwn(payload.audit.shards[0], 'body'), false);
  assert.strictEqual(Object.hasOwn(payload.audit.shards[0], 'content'), false);
  assert.strictEqual(audit.err, '');
});

test('distill --route and --json expose deterministic routing metadata', () => {
  const repo = fixture();
  const route = capture(['distill', '--repo', repo, '--route', 'docs/index.md']);
  const body = capture(['distill', '--repo', repo, '--for', 'docs/index.md', '--json']);

  assert.strictEqual(route.code, 0);
  const routePayload = JSON.parse(route.out);
  const bodyPayload = JSON.parse(body.out);
  assert.deepStrictEqual(routePayload.ids, ['core', 'docs']);
  assert.deepStrictEqual(bodyPayload.ids, ['core', 'docs']);
  assert.strictEqual(bodyPayload.content, '# core\n\n\n# docs\n');
  assert.deepStrictEqual(routePayload.audit.shards.map((shard) => shard.id), ['core', 'source', 'docs']);
  assert.strictEqual(routePayload.audit.shards.length, routePayload.audit.shardCount);
});

test('distill audit reports no shards for the single-file fallback', () => {
  const repo = fixture();
  fs.unlinkSync(path.join(repo, '.bouncer', 'Distill.md'));
  const result = capture(['distill', '--repo', repo, '--all', '--json']);
  const payload = JSON.parse(result.out);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.audit.sharded, false);
  assert.deepStrictEqual(payload.audit.shards, []);
});

test('distill audit preserves undeclared shard fields and reader known flags', () => {
  const repo = fixture();
  fs.writeFileSync(path.join(repo, '.bouncer', 'distill', 'source.md'), [
    '---',
    'distill:',
    '  id: source',
    '  pulls: [core]',
    '---',
    '# source',
    '',
  ].join('\n'));
  const result = capture(['distill', '--repo', repo, '--all', '--json']);
  const source = JSON.parse(result.out).audit.shards.find((shard) => shard.id === 'source');

  assert.strictEqual(result.code, 0);
  assert.strictEqual(Object.hasOwn(source, 'paths'), false);
  assert.strictEqual(source.pathsKnown, true);
  assert.strictEqual(source.pullsKnown, true);
  assert.deepStrictEqual(source.pulls, ['core']);
});

test('distill routing uses config when index routing is disabled', () => {
  const repo = fixture();
  const result = capture(['distill', '--repo', repo, '--for', 'scripts/src/lib/cli.ts', '--json']);
  const payload = JSON.parse(result.out);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.routingEnabled, true);
  assert.deepStrictEqual(payload.ids, ['core', 'source']);
  assert.strictEqual(result.err, '');
});

test('distill routing disabled in config overrides enabled index and fails open', () => {
  const repo = fixture();
  const index = path.join(repo, '.bouncer', 'Distill.md');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(
    'routing_enabled: false',
    'routing_enabled: true',
  ));
  fs.writeFileSync(
    path.join(repo, '.bouncer', 'config.json'),
    `${JSON.stringify({ distill: { routing_enabled: false } })}\n`,
  );

  const result = capture(['distill', '--repo', repo, '--for', 'scripts/src/lib/cli.ts', '--json']);
  const payload = JSON.parse(result.out);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.routingEnabled, false);
  assert.strictEqual(payload.full, true);
  assert.strictEqual(payload.reason, 'routing-disabled');
  assert.deepStrictEqual(payload.ids, ['core', 'source', 'docs']);
  assert.strictEqual(result.err, 'distill: routing-disabled; using all shards\n');
});

test('distill routing falls back to enabled index when config is absent', () => {
  const repo = fixture();
  const index = path.join(repo, '.bouncer', 'Distill.md');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(
    'routing_enabled: false',
    'routing_enabled: true',
  ));
  fs.unlinkSync(path.join(repo, '.bouncer', 'config.json'));

  const result = capture(['distill', '--repo', repo, '--for', 'scripts/src/lib/cli.ts', '--json']);
  const payload = JSON.parse(result.out);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.routingEnabled, true);
  assert.strictEqual(payload.full, false);
  assert.strictEqual(payload.reason, 'matched');
  assert.deepStrictEqual(payload.ids, ['core', 'source']);
  assert.strictEqual(result.err, '');
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
