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

test('tracked active sources contain no retired Distill public surface', () => {
  // 과거 context 기록은 계약 대상이 아니다. 추적된 실행·배포 source와 예제 설정만
  // 검사해, 역사 문서의 언급 때문에 재도입 방지 검사가 흔들리지 않게 한다.
  const retired = ['d', 'istill'].join('');
  const tracked = execFileSync('git', [
    'ls-files', '--',
    'scripts/src/lib/layout.ts',
    'scripts/lib/layout.js',
    'scripts/src/lib/config.ts',
    'scripts/lib/config.js',
    'scripts/src/lib/cli-project-commands.ts',
    'scripts/lib/cli-project-commands.js',
    'scripts/src/lib/cli.ts',
    'scripts/lib/cli.js',
    'scripts/src/lib/validate-structural.ts',
    'scripts/lib/validate-structural.js',
    'scripts/src/lib/validate.ts',
    'scripts/lib/validate.js',
    'config.example.json',
  ], { cwd: path.join(__dirname, '..'), encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
  const matches = tracked.filter((rel) => new RegExp(retired, 'i').test(
    fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'),
  ));

  assert.deepStrictEqual(matches, []);
});

test('retired distill command is rejected while context-search remains public', () => {
  const retired = capture([['d', 'istill'].join('')]);
  assert.strictEqual(retired.code, 2);
  assert.match(retired.err, /unknown command/);
  assert.match(retired.err, /context-search/);
  assert.match(capture([]).out, /^\s*context-search\b/m);
});

function tmpRoot() {
  return fs.realpathSync(os.tmpdir());
}

function fixture() {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-context-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugin.json'), 'utf8'));
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer', 'graphify.lock.json'), `${JSON.stringify({
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.9.56',
    cli_version: '0.9.56',
    bouncer_version: pkg.version,
    graph_schema_version: '1',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  }, null, 2)}\n`);
  return repo;
}

test('context-search rejects invalid structured input with exit 2 and empty stdout', () => {
  const repo = fixture();
  const { validateContextSearchInput } = require('../scripts/lib/graph-search');
  for (const args of [
    ['--query', 'epic-060'],
    ['--mode', 'decision'],
    ['--mode', 'nope', '--query', 'epic-060'],
    ['--mode', 'decision', '--query', 'epic-060', '--max-candidates', '0'],
    ['--mode', 'decision', '--query', 'epic-060', '--max-candidates', '9'],
  ]) {
    const result = capture(['context-search', '--repo', repo, ...args]);
    assert.strictEqual(result.code, 2, args.join(' '));
    assert.strictEqual(result.out, '');
    assert.match(result.err, /context-search:/);
  }
  // CLI 거절 문구는 graph-search JSON schema 검증기와 동일해야 한다.
  const modeErr = validateContextSearchInput({ mode: 'nope', query: 'epic-060' });
  const capErr = validateContextSearchInput({ mode: 'decision', query: 'epic-060', maxCandidates: 9 });
  const modeCli = capture(['context-search', '--repo', repo, '--mode', 'nope', '--query', 'epic-060']);
  const capCli = capture([
    'context-search', '--repo', repo, '--mode', 'decision', '--query', 'epic-060', '--max-candidates', '9',
  ]);
  assert.equal(modeCli.err, `context-search: ${modeErr}\n`);
  assert.equal(capCli.err, `context-search: ${capErr}\n`);
});

test('context-search returns JSON payload with query id, terms, seed, counts, candidates, status', () => {
  const repo = fixture();
  const result = capture([
    'context-search',
    '--repo', repo,
    '--mode', 'decision',
    '--query', 'zzzx-missing-anchor-999',
    '--seed', 'epic-999',
    '--max-candidates', '4',
  ]);
  assert.strictEqual(result.code, 0);
  assert.strictEqual(result.err, '');
  const payload = JSON.parse(result.out);
  assert.equal(typeof payload.query_id, 'string');
  assert.ok(payload.query_id.length > 0);
  assert.ok(Array.isArray(payload.terms));
  assert.ok('seed' in payload);
  assert.equal(typeof payload.raw_node_count, 'number');
  assert.equal(typeof payload.eligible_document_count, 'number');
  assert.ok(Array.isArray(payload.candidates));
  assert.ok(
    payload.status === 'ranked'
    || payload.status === 'low-confidence'
    || payload.status === 'low-confidence: broad-query'
    || payload.status === 'zero-hit',
  );
  if (payload.status !== 'ranked') {
    assert.deepEqual(payload.candidates, []);
  } else {
    for (const row of payload.candidates) {
      assert.equal(typeof row.path, 'string');
      assert.equal(typeof row.role, 'string');
      assert.ok(Array.isArray(row.tags));
      assert.ok(Array.isArray(row.anchors));
      assert.equal(typeof row.score, 'number');
      assert.ok(Array.isArray(row.basis));
    }
  }
});

test('context-search CLI JSON includes a ranked candidate object', () => {
  const repo = fixture();
  const epic = '.bouncer/context/epics/060-graphify-search-quality';
  fs.mkdirSync(path.join(repo, epic), { recursive: true });
  fs.writeFileSync(path.join(repo, `${epic}/index.md`), [
    '---',
    'type: bouncer.epic',
    'tags:',
    '  - bouncer',
    '  - epic',
    '  - graphify-search-quality',
    'bouncer:',
    "  epic_id: '060'",
    '  status: approved',
    '---',
    '',
    '## Success criteria',
    '',
    'ranked context retrieval for graphify-search-quality',
    '',
  ].join('\n'));
  const { buildContextDigest } = require('../scripts/lib/context-digest');
  buildContextDigest({ repoRoot: repo, contextDirs: ['.bouncer/context'] });
  const graphDir = path.join(repo, 'graphify-out', 'context');
  fs.mkdirSync(graphDir, { recursive: true });
  fs.writeFileSync(path.join(graphDir, 'graph.json'), JSON.stringify({
    nodes: [
      { id: 'e', label: 'epic-060', source_file: `${epic}/index.md` },
    ],
    links: [],
  }));
  const result = capture([
    'context-search', '--repo', repo, '--mode', 'decision', '--query', 'epic-060',
  ]);
  assert.strictEqual(result.code, 0);
  assert.strictEqual(result.err, '');
  const payload = JSON.parse(result.out);
  assert.equal(payload.status, 'ranked');
  assert.ok(payload.candidates.length >= 1);
  const row = payload.candidates[0];
  assert.equal(typeof row.path, 'string');
  assert.ok(row.path.length > 0);
  assert.equal(typeof row.role, 'string');
  assert.ok(Array.isArray(row.tags));
  assert.ok(Array.isArray(row.anchors));
  assert.equal(typeof row.score, 'number');
  assert.ok(Array.isArray(row.basis));
  assert.ok(row.basis.length > 0);
});

test('init --upgrade-graphify exposes the upgrade payload', () => {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-upgrade-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  const first = capture(['init', '--repo', repo, '--no-graphify']);
  assert.strictEqual(first.code, 0);
  const lockPath = path.join(repo, '.bouncer', 'graphify.lock.json');
  const stale = {
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  };
  fs.writeFileSync(lockPath, `${JSON.stringify(stale, null, 2)}\n`);
  const available = capture(['init', '--repo', repo, '--no-graphify']);
  assert.strictEqual(available.code, 0);
  assert.strictEqual(JSON.parse(available.out).graphifyUpgradeAvailable, true);

  const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const lockDir = path.join(path.resolve(repo, commonDir), 'bouncer');
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(path.join(lockDir, 'upgrade.lock'), 'held');
  const before = fs.readFileSync(lockPath);
  const upgrade = capture(['init', '--repo', repo, '--upgrade-graphify']);
  const payload = JSON.parse(upgrade.out);
  assert.ok(payload.graphifyUpgrade);
  assert.strictEqual(payload.graphifyUpgrade.status, 'failed');
  assert.deepStrictEqual(fs.readFileSync(lockPath), before);
});

test('init help names --upgrade-graphify', () => {
  const result = capture(['help']);
  assert.strictEqual(result.code, 0);
  assert.match(result.out, /upgrade-graphify/);
});

test('graph-sync records version-incompatible without installing', () => {
  const repo = fs.mkdtempSync(path.join(tmpRoot(), 'bouncer-cli-sync-incompat-'));
  execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
  assert.strictEqual(capture(['init', '--repo', repo, '--no-graphify']).code, 0);
  const binRel = 'tools/graphify';
  fs.mkdirSync(path.join(repo, 'tools'));
  fs.writeFileSync(path.join(repo, binRel), '');
  const cfgPath = path.join(repo, '.bouncer', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  cfg.graphify = { ...(cfg.graphify || {}), enabled: true, bin: binRel };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  fs.writeFileSync(path.join(repo, '.bouncer', 'graphify.lock.json'), `${JSON.stringify({
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  }, null, 2)}\n`);
  const result = capture(['graph-sync', '--repo', repo]);
  const payload = JSON.parse(result.out);
  assert.strictEqual(payload.status, 'version-incompatible');
  assert.strictEqual(payload.action, 'skip-version-incompatible');
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/.venv')));
});

test('context-search records version-incompatible without installing', () => {
  const repo = fixture();
  fs.writeFileSync(path.join(repo, '.bouncer', 'graphify.lock.json'), `${JSON.stringify({
    schema_version: 1,
    package: 'graphifyy',
    package_version: '0.8.0',
    cli_version: '0.8.0',
    bouncer_version: '1.0.0',
    graph_schema_version: '0',
    installed_at: '2026-01-01T00:00:00.000+09:00',
  }, null, 2)}\n`);
  const result = capture([
    'context-search', '--repo', repo, '--mode', 'decision', '--query', 'epic-060',
  ]);
  assert.strictEqual(result.code, 0);
  const payload = JSON.parse(result.out);
  assert.strictEqual(payload.status, 'version-incompatible');
  assert.deepStrictEqual(payload.candidates, []);
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/.venv')));
});
