// test/graphify.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { venvBinRel, resolveGraphifyBin, setupGraphify } = require('../scripts/lib/graphify');
const {
  realNewestMtime,
  resolveGraphScopes,
} = require('../scripts/lib/graph-scope');
const {
  applyExcludeDirs,
  defaultExecGraphify,
  writeFilteredGraph,
} = require('../scripts/lib/graph-exec');
const { makeAllowed, makeFinalizeAllowed } = require('../scripts/lib/scope');

test('venvBinRel returns POSIX-relative platform paths', () => {
  assert.strictEqual(venvBinRel('win32'), '.bouncer/.venv/Scripts/graphify.exe');
  assert.strictEqual(venvBinRel('linux'), '.bouncer/.venv/bin/graphify');
  assert.strictEqual(venvBinRel('darwin'), '.bouncer/.venv/bin/graphify');
});

test('resolveGraphifyBin prefers an existing config.graphify.bin', () => {
  const repoRoot = '/repo';
  const rel = 'tools/graphify';
  const r = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { bin: rel } },
    platform: 'linux',
    exists: (p) => p === path.join(repoRoot, rel),
    hasOnPath: () => true,
  });
  assert.deepStrictEqual(r, { bin: path.join(repoRoot, rel), source: 'config' });
});

test('resolveGraphifyBin falls through to venv when config bin is missing or absent', () => {
  const repoRoot = '/repo';
  const venvRel = venvBinRel('linux');
  const venvAbs = path.join(repoRoot, venvRel);

  const noBin = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { enabled: true } },
    platform: 'linux',
    exists: (p) => p === venvAbs,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(noBin, { bin: venvAbs, source: 'venv' });

  const missingBin = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { bin: 'tools/missing' } },
    platform: 'linux',
    exists: (p) => p === venvAbs,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(missingBin, { bin: venvAbs, source: 'venv' });
});

test('resolveGraphifyBin uses PATH when venv dir exists but the executable does not', () => {
  const repoRoot = '/repo';
  const venvDir = path.join(repoRoot, '.bouncer/.venv/bin');
  const r = resolveGraphifyBin({
    repoRoot,
    config: null,
    platform: 'linux',
    // venv 디렉터리만 있고 실행 파일은 없음 — PATH 후보로 내려가야 한다.
    exists: (p) => p === venvDir,
    hasOnPath: () => true,
  });
  assert.deepStrictEqual(r, { bin: 'graphify', source: 'path' });
});

test('resolveGraphifyBin returns nulls when no candidate exists', () => {
  const r = resolveGraphifyBin({
    repoRoot: '/repo',
    config: { graphify: { bin: 'tools/nope' } },
    platform: 'linux',
    exists: () => false,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(r, { bin: null, source: null });
});

function initGitRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-graphify-git-'));
  execFileSync('git', ['init', '-b', 'main'], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return repo;
}

test('resolveGraphifyBin venv candidate in a git repo is outside .bouncer/', () => {
  const repoRoot = initGitRepo();
  const r = resolveGraphifyBin({
    repoRoot,
    config: {},
    platform: 'linux',
    exists: () => true,
    hasOnPath: () => false,
  });
  assert.strictEqual(r.source, 'venv');
  const venvAbs = r.bin;
  assert.ok(typeof venvAbs === 'string' && venvAbs.length > 0);
  assert.ok(!venvAbs.startsWith(path.join(repoRoot, '.bouncer')));
});

test('resolveGraphifyBin falls back to .bouncer/.venv in a non-git directory', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-graphify-nogit-'));
  const venvAbs = path.join(repoRoot, '.bouncer/.venv/bin/graphify');
  const r = resolveGraphifyBin({
    repoRoot,
    config: {},
    platform: 'linux',
    exists: (p) => p === venvAbs,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(r, { bin: venvAbs, source: 'venv' });
});

test('resolveGraphifyBin Windows venv candidate uses Scripts/ under the common-dir venv', () => {
  const repoRoot = initGitRepo();
  const r = resolveGraphifyBin({
    repoRoot,
    config: {},
    platform: 'win32',
    exists: () => true,
    hasOnPath: () => false,
  });
  assert.strictEqual(r.source, 'venv');
  assert.match(r.bin, /Scripts[/\\]graphify\.exe$/);
  assert.ok(!r.bin.startsWith(path.join(repoRoot, '.bouncer')));
});

test('setupGraphify removes the venv directory it created when a later step fails', () => {
  const repo = initGitRepo();
  const created = [];
  const r = setupGraphify({
    repoRoot: repo,
    platform: 'linux',
    exec: (file, args) => {
      if (file === 'python3') {
        const venvDir = path.isAbsolute(args[2]) ? args[2] : path.join(repo, args[2]);
        created.push(venvDir);
        fs.mkdirSync(venvDir, { recursive: true });
        return;
      }
      throw new Error('pip boom');
    },
  });
  assert.strictEqual(r.status, 'failed');
  assert.match(r.reason, /pip/);
  assert.strictEqual(created.length, 1);
  assert.ok(!fs.existsSync(created[0]));
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/.venv')));
});

test('setupGraphify does not remove a venv directory it did not create', () => {
  const repo = initGitRepo();
  const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const venvDir = path.join(path.resolve(repo, commonDir), 'bouncer', 'venv');
  fs.mkdirSync(venvDir, { recursive: true });
  fs.writeFileSync(path.join(venvDir, 'keep'), 'prior');
  const r = setupGraphify({
    repoRoot: repo,
    platform: 'linux',
    exec: () => {
      throw new Error('venv: no python');
    },
  });
  assert.strictEqual(r.status, 'failed');
  assert.ok(fs.existsSync(venvDir));
  assert.strictEqual(fs.readFileSync(path.join(venvDir, 'keep'), 'utf8'), 'prior');
});

test('resolveGraphifyBin still selects an existing .bouncer/.venv/bin/graphify', () => {
  const repoRoot = initGitRepo();
  const legacyAbs = path.join(repoRoot, '.bouncer/.venv/bin/graphify');
  const r = resolveGraphifyBin({
    repoRoot,
    config: {},
    platform: 'linux',
    exists: (p) => p === legacyAbs,
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(r, { bin: legacyAbs, source: 'venv' });
});

test('resolveGraphifyBin still resolves a repo-relative config.graphify.bin', () => {
  const repoRoot = initGitRepo();
  const rel = '.bouncer/.venv/bin/graphify';
  const r = resolveGraphifyBin({
    repoRoot,
    config: { graphify: { bin: rel } },
    platform: 'linux',
    exists: (p) => p === path.join(repoRoot, rel),
    hasOnPath: () => false,
  });
  assert.deepStrictEqual(r, { bin: path.join(repoRoot, rel), source: 'config' });
});

test('resolveGraphifyBin never throws on malformed config shapes', () => {
  const cases = [
    { config: null },
    { config: { graphify: 'yes' } },
    { config: { graphify: { bin: 42 } } },
    { config: { graphify: { bin: '' } } },
  ];
  for (const over of cases) {
    assert.doesNotThrow(() => {
      const r = resolveGraphifyBin({
        repoRoot: '/repo',
        platform: 'linux',
        exists: () => false,
        hasOnPath: () => false,
        ...over,
      });
      assert.deepStrictEqual(r, { bin: null, source: null });
    });
  }
});

test('setupGraphify reuses an existing venv bin without calling exec', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-'));
  const binRel = venvBinRel('linux');
  fs.mkdirSync(path.join(repo, path.dirname(binRel)), { recursive: true });
  fs.writeFileSync(path.join(repo, binRel), '');
  const calls = [];
  const r = setupGraphify({
    repoRoot: repo,
    platform: 'linux',
    exec: (...args) => { calls.push(args); },
  });
  assert.deepStrictEqual(r, { status: 'reused', bin: binRel });
  assert.strictEqual(calls.length, 0);
});

test('setupGraphify installs via venv → pip → graphify install in order', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-'));
  const venvDir = path.join(repo, '.bouncer/.venv');
  const pipAbs = path.join(venvDir, 'bin/pip');
  const graphifyAbs = path.join(venvDir, 'bin/graphify');
  const calls = [];
  const r = setupGraphify({
    repoRoot: repo,
    platform: 'linux',
    exec: (file, args, opts) => {
      calls.push({ file, args, cwd: opts && opts.cwd });
    },
  });
  assert.deepStrictEqual(r, { status: 'installed', bin: graphifyAbs });
  assert.strictEqual(calls.length, 3);
  assert.deepStrictEqual(calls[0], {
    file: 'python3',
    args: ['-m', 'venv', venvDir],
    cwd: repo,
  });
  assert.deepStrictEqual(calls[1], {
    file: pipAbs,
    args: ['install', 'graphifyy'],
    cwd: repo,
  });
  assert.deepStrictEqual(calls[2], {
    file: graphifyAbs,
    args: ['install'],
    cwd: repo,
  });
});

test('setupGraphify stops after the first failing step and never throws', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-setup-'));
  const calls = [];
  let r;
  assert.doesNotThrow(() => {
    r = setupGraphify({
      repoRoot: repo,
      platform: 'linux',
      exec: (file, args) => {
        calls.push({ file, args });
        throw new Error('no python');
      },
    });
  });
  assert.strictEqual(r.status, 'failed');
  assert.strictEqual(r.bin, null);
  assert.match(r.reason, /venv/);
  assert.match(r.reason, /no python/);
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0].args, ['-m', 'venv', path.join(repo, '.bouncer/.venv')]);
});

test('context freshness watches the Distill index and shard directory lifecycle', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-shard-fresh-'));
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), 'index');
  fs.writeFileSync(path.join(repo, '.bouncer/distill/core.md'), 'core');

  const context = resolveGraphScopes({ sourceDirs: [], contextDirs: ['.bouncer/context'] })
    .find((scope) => scope.name === 'context');
  // 기존 결정 객체 계약은 index만 노출한다. realNewestMtime이 이 입력을
  // 정본 shard 디렉터리까지 확장해 lifecycle을 계산한다.
  assert.deepEqual(context.watchFiles, ['.bouncer/Distill.md']);

  const graphMtime = Date.now() - 60_000;
  const touch = (rel, mtime) => {
    const abs = path.join(repo, rel);
    fs.utimesSync(abs, new Date(mtime), new Date(mtime));
  };
  touch('.bouncer/Distill.md', graphMtime);
  touch('.bouncer/distill/core.md', graphMtime);
  touch('.bouncer/distill', graphMtime);
  const old = realNewestMtime(repo, [], context.watchFiles);
  assert.ok(old <= graphMtime + 1);

  touch('.bouncer/distill/core.md', graphMtime + 1_000);
  assert.ok(realNewestMtime(repo, [], context.watchFiles) > old);

  const added = path.join(repo, '.bouncer/distill/added.md');
  fs.writeFileSync(added, 'added');
  assert.ok(realNewestMtime(repo, [], context.watchFiles) >= fs.statSync(added).mtimeMs);

  fs.unlinkSync(added);
  assert.ok(realNewestMtime(repo, [], context.watchFiles) >= fs.statSync(path.join(repo, '.bouncer/distill')).mtimeMs);
});

test('registered Distill shards are finalize-only scope allowances', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-shard-scope-'));
  fs.mkdirSync(path.join(repo, '.bouncer/distill'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), [
    '---',
    'distill:',
    '  version: 1',
    '  shards:',
    '    - core',
    '---',
    '## Decisions\n',
  ].join('\n'));
  fs.writeFileSync(path.join(repo, '.bouncer/distill/core.md'), '## Decisions\n\ncore\n');
  fs.writeFileSync(path.join(repo, '.bouncer/distill/unregistered.md'), '## Decisions\n\nunregistered\n');

  const execute = makeAllowed({
    affectedPaths: ['scripts/src/lib/feature.ts'],
    blueprintDir: '.bouncer/context/epics/001-auth/blueprints/001-login',
  });
  const finalize = makeFinalizeAllowed({
    repoRoot: repo,
    affectedPaths: ['scripts/src/lib/feature.ts'],
    blueprintDir: '.bouncer/context/epics/001-auth/blueprints/001-login',
  });

  assert.strictEqual(execute('.bouncer/distill/core.md'), false);
  assert.strictEqual(execute('.bouncer/distill/unregistered.md'), false);
  assert.strictEqual(finalize('.bouncer/distill/core.md'), true);
  assert.strictEqual(finalize('.bouncer/distill/unregistered.md'), false);
});

test('applyExcludeDirs drops nodes links and hyperedges under exclude prefixes', () => {
  const graph = {
    nodes: [
      { id: 'keep', source_file: 'scripts/src/lib/a.ts' },
      { id: 'drop', source_file: 'scripts/lib/a.js' },
      { id: 'also', source_file: 'scripts/lib/nested/b.js' },
    ],
    links: [
      { source: 'keep', target: 'drop', source_file: 'scripts/src/lib/a.ts' },
      { source: 'drop', target: 'also', source_file: 'scripts/lib/a.js' },
      { source: 'keep', target: 'keep', source_file: 'scripts/src/lib/a.ts' },
    ],
    hyperedges: [
      { nodes: ['keep', 'drop'], source_file: 'scripts/src/lib/a.ts' },
      { nodes: ['keep'], source_file: 'scripts/src/lib/a.ts' },
    ],
  };
  const out = applyExcludeDirs(graph, ['scripts/lib']);
  assert.deepStrictEqual(out.nodes.map((n) => n.id), ['keep']);
  assert.strictEqual(out.links.length, 1);
  assert.deepStrictEqual(out.links[0], {
    source: 'keep', target: 'keep', source_file: 'scripts/src/lib/a.ts',
  });
  assert.strictEqual(out.hyperedges.length, 1);
  assert.deepStrictEqual(out.hyperedges[0].nodes, ['keep']);
});

test('empty excludeDirs leaves JavaScript nodes untouched', () => {
  const graph = {
    nodes: [
      { id: 'js', source_file: 'scripts/lib/init.js' },
      { id: 'ts', source_file: 'scripts/src/lib/init.ts' },
    ],
    links: [{ source: 'js', target: 'ts', source_file: 'scripts/lib/init.js' }],
    hyperedges: [{ nodes: ['js', 'ts'], source_file: 'scripts/lib/init.js' }],
  };
  const before = JSON.stringify(graph);
  const out = applyExcludeDirs(graph, []);
  assert.strictEqual(JSON.stringify(out), before);
  assert.strictEqual(out.nodes.length, 2);
  assert.ok(out.nodes.some((n) => n.source_file.endsWith('.js')));
});

test('defaultExecGraphify writeFilteredGraph filters source graph.json', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-exec-exclude-'));
  fs.mkdirSync(path.join(repo, 'src'));
  defaultExecGraphify(repo, {
    name: 'source',
    dirs: ['src'],
    outDir: 'graphify-out/source',
    excludeDirs: ['src/gen'],
  }, {
    bin: '/fake/graphify',
    exec: (_file, _args, opts) => {
      // runGraphifyUpdate cwd = partAbs. normalize가 dir/ 접두를 붙인다.
      fs.writeFileSync(path.join(opts.cwd, 'graph.json'), JSON.stringify({
        nodes: [
          { id: 'keep', source_file: 'a.ts' },
          { id: 'drop', source_file: 'gen/b.js' },
        ],
        links: [
          { source: 'keep', target: 'drop', source_file: 'a.ts' },
          { source: 'keep', target: 'keep', source_file: 'a.ts' },
        ],
        hyperedges: [
          { nodes: ['keep', 'drop'], source_file: 'a.ts' },
          { nodes: ['keep'], source_file: 'a.ts' },
        ],
      }));
    },
  });
  const out = JSON.parse(fs.readFileSync(
    path.join(repo, 'graphify-out/source/graph.json'),
    'utf8',
  ));
  assert.strictEqual(out.nodes.length, 1);
  assert.strictEqual(out.nodes[0].source_file, 'src/a.ts');
  assert.strictEqual(out.links.length, 1);
  assert.deepStrictEqual(
    { source: out.links[0].source, target: out.links[0].target },
    { source: out.nodes[0].id, target: out.nodes[0].id },
  );
  assert.strictEqual(out.hyperedges.length, 1);
  assert.deepStrictEqual(out.hyperedges[0].nodes, [out.nodes[0].id]);
});

test('writeFilteredGraph no-ops when excludeDirs empty', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-write-exclude-'));
  const target = path.join(repo, 'graphify-out/source/graph.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const body = JSON.stringify({
    nodes: [{ id: 'js', source_file: 'scripts/lib/init.js' }],
    links: [],
    hyperedges: [],
  });
  fs.writeFileSync(target, body);
  writeFilteredGraph(target, []);
  assert.strictEqual(fs.readFileSync(target, 'utf8'), body);
});
