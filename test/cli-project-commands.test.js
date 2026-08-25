'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');

const { runCli } = require('../scripts/lib/cli');

function capture(argv) {
  const buf = { out: '', err: '' };
  const code = runCli(argv, {
    out: (value) => { buf.out += value; },
    err: (value) => { buf.err += value; },
  });
  return { code, ...buf };
}

function tmpRoot() {
  return fs.realpathSync(os.tmpdir());
}

function seedDistill(repo) {
  fs.mkdirSync(path.join(repo, '.bouncer', 'distill'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'scripts', 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
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
}

function fixture() {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-distill-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  seedDistill(repo);
  return repo;
}

test('distill --all --json reports the linked checkout as repoRoot', () => {
  const primary = fs.realpathSync(fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-distill-primary-')));
  execFileSync('git', ['init'], { cwd: primary, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: primary, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: primary, stdio: 'ignore' });
  fs.writeFileSync(path.join(primary, 'README'), 'base\n');
  execFileSync('git', ['add', 'README'], { cwd: primary, stdio: 'ignore' });
  execFileSync('git', ['commit', '-m', 'base'], { cwd: primary, stdio: 'ignore' });

  const linked = path.join(tmpRoot(), `bouncer-cli-distill-linked-${crypto.randomBytes(6).toString('hex')}`);
  execFileSync('git', ['worktree', 'add', '--detach', linked, 'HEAD'], {
    cwd: primary,
    stdio: 'ignore',
  });
  const linkedRoot = fs.realpathSync(linked);
  seedDistill(linkedRoot);

  const payload = JSON.parse(capture(['distill', '--all', '--json', '--repo', linkedRoot]).out);
  assert.strictEqual(payload.repoRoot, linkedRoot);
});

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

test('distill --all reports shard byte sizes on stderr without touching stdout', () => {
  const repo = fixture();
  const expectedOut = '# core\n\n\n# source\n\n\n# docs\n';
  const r = capture(['distill', '--all', '--repo', repo]);

  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.out, expectedOut);
  assert.match(r.err, /distill: total \d+ bytes across \d+ shards/);
  assert.doesNotMatch(r.out, /distill: total/);
  assert.match(r.err, /distill: core \d+/);
  assert.match(r.err, /distill: source \d+/);
  assert.match(r.err, /distill: docs \d+/);

  // --for / --audit 는 선택·감사 출력에 총량을 붙이지 않는다.
  const forResult = capture(['distill', '--repo', repo, '--for', 'docs/index.md']);
  assert.doesNotMatch(forResult.err, /distill: total/);
  const audit = capture(['distill', '--repo', repo, '--audit', '--json']);
  assert.strictEqual(audit.err, '');
});

test('distill --all marks shards that exceed max_bytes on the same stderr line', () => {
  const repo = fixture();
  // fixture config에는 max_bytes가 없어 DEFAULT(6144)를 탄다.
  fs.writeFileSync(path.join(repo, '.bouncer', 'distill', 'docs.md'), [
    '---',
    'distill:',
    '  id: docs',
    '  paths:',
    '    - docs/**',
    '  pulls: []',
    '---',
    'x'.repeat(7000),
    '',
  ].join('\n'));
  const r = capture(['distill', '--all', '--repo', repo]);

  assert.strictEqual(r.code, 0);
  assert.match(r.err, /distill: docs \d+ \(exceeds 6144\)/);
  assert.doesNotMatch(r.out, /exceeds/);
});

test('distill --all single-file fallback reports total without a zero shard count', () => {
  const repo = fixture();
  fs.unlinkSync(path.join(repo, '.bouncer', 'Distill.md'));
  const r = capture(['distill', '--all', '--repo', repo]);

  assert.strictEqual(r.code, 0);
  assert.match(r.err, /distill: total \d+ bytes \(single-file\)/);
  assert.doesNotMatch(r.err, /across 0 shards/);
  assert.doesNotMatch(r.out, /distill: total/);
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

function expandToSevenShards(repo) {
  fs.writeFileSync(path.join(repo, '.bouncer', 'Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  routing_enabled: false',
    '  shards:',
    '    - core',
    '    - source',
    '    - docs',
    '    - extra-a',
    '    - extra-b',
    '    - extra-c',
    '    - extra-d',
    '---',
    '# summary',
    '',
  ].join('\n'));
  for (const id of ['extra-a', 'extra-b', 'extra-c', 'extra-d']) {
    fs.writeFileSync(path.join(repo, '.bouncer', 'distill', `${id}.md`), [
      '---',
      'distill:',
      `  id: ${id}`,
      '  paths: []',
      '  pulls: []',
      '---',
      `# ${id}`,
      '',
    ].join('\n'));
  }
}

test('distill --preflight selects only always core and keeps a 7-shard inventory', () => {
  const repo = fixture();
  expandToSevenShards(repo);
  const preflight = capture(['distill', '--repo', repo, '--preflight', '--json']);
  const all = capture(['distill', '--repo', repo, '--all', '--json']);

  assert.strictEqual(preflight.code, 0);
  const payload = JSON.parse(preflight.out);
  const allPayload = JSON.parse(all.out);
  assert.strictEqual(payload.mode, 'preflight');
  assert.deepStrictEqual(payload.ids, ['core']);
  assert.strictEqual(payload.reason, 'preflight-always');
  assert.strictEqual(payload.audit.shards.length, 7);
  assert.ok(payload.content.length < allPayload.content.length);
  assert.doesNotMatch(preflight.err, /distill: total/);
});

test('distill without a mode requires --preflight in the usage error', () => {
  const repo = fixture();
  const result = capture(['distill', '--repo', repo]);
  assert.strictEqual(result.code, 2);
  assert.strictEqual(result.out, '');
  assert.strictEqual(
    result.err,
    'distill: one of --for, --all, --preflight, --route, or --audit is required\n',
  );
});

test('distill --preflight rejects a path argument', () => {
  const repo = fixture();
  const result = capture(['distill', '--repo', repo, '--preflight', 'scripts/src/lib/cli.ts']);
  assert.strictEqual(result.code, 2);
  assert.strictEqual(result.out, '');
  assert.strictEqual(result.err, 'distill: preflight does not accept a path\n');
});

test('distill --preflight falls back to the full body when Distill is not sharded', () => {
  const repo = fixture();
  fs.unlinkSync(path.join(repo, '.bouncer', 'Distill.md'));
  const result = capture(['distill', '--repo', repo, '--preflight', '--json']);
  const payload = JSON.parse(result.out);

  assert.strictEqual(result.code, 0);
  assert.strictEqual(payload.reason, 'not-sharded');
  assert.strictEqual(payload.full, true);
  assert.strictEqual(payload.audit.sharded, false);
});

test('distill --preflight warns on stderr when no always shard exists', () => {
  const repo = fixture();
  fs.writeFileSync(path.join(repo, '.bouncer', 'distill', 'core.md'), [
    '---',
    'distill:',
    '  id: core',
    '  always: false',
    '  paths: []',
    '  pulls: []',
    '---',
    '# core',
    '',
  ].join('\n'));
  const result = capture(['distill', '--repo', repo, '--preflight', '--json']);
  const payload = JSON.parse(result.out);

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(payload.ids, []);
  assert.strictEqual(payload.audit.shards.length, 3);
  assert.strictEqual(result.err, 'distill: preflight selected no always shard\n');
});
