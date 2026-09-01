'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  planSessionGraph, syncSessionGraphs, graphSyncWarnings,
  newestMtimeUnder, runGraphifyUpdate, partOutDir, resolveGraphScopes,
  normalizeGraphPaths,
  SCAN_EXCLUDED_DIRS, DEFAULT_SOURCE_OUT, DEFAULT_CONTEXT_OUT, DEFAULT_TEST_OUT,
} = require('../scripts/lib/session-graph');

function base(over) {
  return {
    inspectBootstrap: () => 'ready',
    init: () => ({ ok: true, created: [], skipped: true, reason: 'already-initialized' }),
    graphifyEnabled: () => true,
    hasGraphify: () => true,
    sourceDirs: () => ['src', 'test'],
    contextDirs: () => ['.bouncer/context'],
    existingDirs: (dirs) => dirs,
    newestMtime: () => 200,
    graphMtime: () => 100,
    ...over,
  };
}
const plan = (over) => planSessionGraph({ repoRoot: '/r', deps: base(over) });

test('bootstraps missing Bouncer state before graph planning', () => {
  let initialized = false;
  const result = plan({
    inspectBootstrap: () => 'missing',
    init: () => {
      initialized = true;
      return { ok: true, created: ['.bouncer/config.json'], skipped: false };
    },
    hasGraphify: () => false,
  });
  assert.strictEqual(initialized, true);
  assert.strictEqual(result.bootstrap, 'created');
  assert.strictEqual(result.action, 'skip-no-graphify');
  assert.deepStrictEqual(result.graphs, []);
});

test('real bootstrap creates only safe project-local state', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-session-'));
  const result = planSessionGraph({
    repoRoot: repo,
    deps: { hasGraphify: () => false },
  });
  assert.strictEqual(result.bootstrap, 'created');
  assert.strictEqual(result.action, 'skip-no-graphify');
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8')).graphify,
    { enabled: true },
  );
  assert.ok(fs.existsSync(path.join(repo, '.bouncer/config.json')));
  assert.ok(!fs.existsSync(path.join(repo, '.bouncer/current')));
  assert.ok(!fs.existsSync(path.join(repo, '.gitignore')));
  assert.ok(!fs.existsSync(path.join(repo, 'context')));
});

test('skips graph work for partial Bouncer state', () => {
  let checkedGraphify = false;
  const result = plan({
    inspectBootstrap: () => 'partial',
    hasGraphify: () => {
      checkedGraphify = true;
      return true;
    },
  });
  assert.deepStrictEqual(result, {
    bootstrap: 'partial',
    action: 'skip-partial-bootstrap',
    reason: 'partial-bouncer-state',
    graphs: [],
  });
  assert.strictEqual(checkedGraphify, false);
});

test('skips graph work for legacy bootstrap state', () => {
  const result = plan({ inspectBootstrap: () => 'legacy' });
  assert.strictEqual(result.bootstrap, 'legacy');
  assert.strictEqual(result.action, 'skip-legacy-bootstrap');
});

test('skips graph work when ready config does not opt in to graphify', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-session-'));
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    verify: 'npm test',
    base_branch: 'main',
  }));
  let checkedGraphify = false;

  const result = planSessionGraph({
    repoRoot: repo,
    deps: {
      hasGraphify: () => {
        checkedGraphify = true;
        return true;
      },
    },
  });

  assert.deepStrictEqual(result, {
    bootstrap: 'ready',
    action: 'skip-graph-disabled',
    reason: 'graphify auto-build disabled',
    graphs: [],
  });
  assert.strictEqual(checkedGraphify, false);
});

test('graphify opt-in retains missing graph build behavior for both scopes', () => {
  const result = plan({
    graphifyEnabled: () => true,
    graphMtime: () => null,
  });
  assert.strictEqual(result.action, 'build');
  assert.strictEqual(result.graphs.length, 3);
  assert.deepStrictEqual(result.graphs.map((g) => g.name), ['source', 'test', 'context']);
  const byName = Object.fromEntries(result.graphs.map((g) => [g.name, g]));
  assert.strictEqual(byName.source.action, 'build');
  assert.strictEqual(byName.context.action, 'build');
  assert.strictEqual(byName.test.action, 'skip-unconfigured');
  assert.strictEqual(byName.source.outDir, DEFAULT_SOURCE_OUT);
  assert.strictEqual(byName.test.outDir, DEFAULT_TEST_OUT);
  assert.strictEqual(byName.context.outDir, DEFAULT_CONTEXT_OUT);
});

test('skips when graphify is not on PATH', () => {
  const result = plan({ hasGraphify: () => false });
  assert.strictEqual(result.bootstrap, 'ready');
  assert.strictEqual(result.action, 'skip-no-graphify');
});

test('skips when both graphs are fresher than their source dirs', () => {
  assert.strictEqual(plan({ newestMtime: () => 100, graphMtime: () => 200 }).action, 'skip-fresh');
});

test('builds only the stale graph when the other is fresh', () => {
  const result = plan({
    graphMtime: (outDir) => (outDir === DEFAULT_SOURCE_OUT ? 100 : 300),
    newestMtime: () => 200,
  });
  assert.strictEqual(result.action, 'build');
  const byName = Object.fromEntries(result.graphs.map((g) => [g.name, g.action]));
  assert.strictEqual(byName.source, 'build');
  assert.strictEqual(byName.context, 'skip-fresh');
});

test('builds when a source dir is newer than the graph', () => {
  assert.strictEqual(plan({ newestMtime: () => 300, graphMtime: () => 200 }).action, 'build');
});

test('build dirs are limited to source dirs that exist', () => {
  const r = plan({
    graphMtime: () => null,
    existingDirs: (dirs) => dirs.filter((d) => d === 'src' || d === '.bouncer/context'),
  });
  assert.deepStrictEqual(r.graphs.find((g) => g.name === 'source').dirs, ['src']);
  assert.deepStrictEqual(r.graphs.find((g) => g.name === 'context').dirs, ['.bouncer/context']);
});

test('planOneGraph keeps configured dirs even when only some exist', () => {
  const r = plan({
    graphMtime: () => null,
    existingDirs: (dirs) => dirs.filter((d) => d === 'src' || d === '.bouncer/context'),
  });
  const src = r.graphs.find((g) => g.name === 'source');
  assert.deepStrictEqual(src.configured, ['src', 'test']);
  assert.deepStrictEqual(src.dirs, ['src']);
});

test('syncSessionGraphs reports missing source when opted in but source dirs absent', () => {
  const result = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({
      existingDirs: (dirs) => dirs.filter((d) => d === '.bouncer/context'),
      // Context graph present and fresh; source never built.
      graphMtime: (outDir) => (outDir === DEFAULT_CONTEXT_OUT ? 300 : null),
      newestMtime: () => 200,
    }),
  });
  assert.deepStrictEqual(result.missing, ['source']);
});

test('syncSessionGraphs reports empty missing when graphify is not opted in', () => {
  const disabled = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({ graphifyEnabled: () => false }),
  });
  assert.deepStrictEqual(disabled.missing, []);
});

test('syncSessionGraphs reports empty missing for other no-graph-work skips', () => {
  for (const over of [
    { inspectBootstrap: () => 'partial' },
    { inspectBootstrap: () => 'legacy' },
    { hasGraphify: () => false },
  ]) {
    const result = syncSessionGraphs({ repoRoot: '/r', deps: base(over) });
    assert.deepStrictEqual(result.missing, []);
  }
});

test('syncSessionGraphs omits scope from missing when leftover graph exists under skip-no-dirs', () => {
  const result = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({
      existingDirs: () => [],
      // Prior session left a source graph.json even though dirs are gone now.
      graphMtime: (outDir) => (outDir === DEFAULT_SOURCE_OUT ? 100 : null),
    }),
  });
  assert.ok(!result.missing.includes('source'));
  assert.deepStrictEqual(result.missing, ['context']);
});

test('graphSyncWarnings is silent when graphify is disabled', () => {
  assert.deepStrictEqual(
    graphSyncWarnings({ action: 'skip-graph-disabled', missing: [] }),
    [],
  );
});

test('graphSyncWarnings names configured source_dirs when source graph is missing', () => {
  const noDirs = {
    action: 'skip-no-dirs',
    missing: ['source'],
    graphs: [{
      name: 'source',
      configured: ['src', 'test'],
      dirs: [],
      outDir: DEFAULT_SOURCE_OUT,
      action: 'skip-no-dirs',
    }],
    failed: [],
  };
  const lines = graphSyncWarnings(noDirs);
  assert.ok(lines.length >= 1);
  assert.match(lines[0], /source_dirs/);
  assert.match(lines[0], /"src"/);
  assert.match(lines[0], /none of/);
  assert.match(lines[0], /\n$/);
});

test('graphSyncWarnings skips missing line when scope already failed', () => {
  const lines = graphSyncWarnings({
    action: 'build',
    missing: ['source'],
    graphs: [{
      name: 'source',
      configured: ['src', 'test'],
      dirs: ['src'],
      outDir: DEFAULT_SOURCE_OUT,
      action: 'build',
    }],
    failed: [{ name: 'source', message: 'boom' }],
  });
  assert.strictEqual(lines.length, 1);
  assert.match(lines[0], /graphify sync failed for source/);
  assert.doesNotMatch(lines.join(''), /none of/);
});

test('graphSyncWarnings does not claim dirs missing when they were present', () => {
  const lines = graphSyncWarnings({
    action: 'build',
    missing: ['source'],
    graphs: [{
      name: 'source',
      configured: ['src'],
      dirs: ['src'],
      outDir: DEFAULT_SOURCE_OUT,
      action: 'build',
    }],
    failed: [],
  });
  assert.ok(lines.length >= 1);
  assert.doesNotMatch(lines[0], /none of/);
  assert.match(lines[0], /no source graph was built/);
});

test('graphSyncWarnings is empty for a healthy sync', () => {
  const healthy = {
    action: 'skip-fresh',
    missing: [],
    graphs: [],
    failed: [],
  };
  assert.strictEqual(graphSyncWarnings(healthy).length, 0);
});

test('graphSyncWarnings covers partial, legacy, no-graphify, and failed in order', () => {
  assert.match(
    graphSyncWarnings({ bootstrap: 'partial', action: 'skip-partial-bootstrap', missing: [] })[0],
    /partial Bouncer state/,
  );
  assert.match(
    graphSyncWarnings({ bootstrap: 'legacy', action: 'skip-legacy-bootstrap', missing: [] })[0],
    /legacy state/,
  );
  const noCli = graphSyncWarnings({ action: 'skip-no-graphify', missing: [] });
  assert.match(noCli[0], /graphifyy/);
  assert.match(noCli[0], /docs\/install\.md/);
  const failed = graphSyncWarnings({
    action: 'build',
    missing: [],
    failed: [{ name: 'context', message: 'boom' }],
  });
  assert.match(failed[0], /graphify sync failed for context/);
});

test('syncSessionGraphs builds stale graphs via execGraphify', () => {
  const calls = [];
  const result = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({ graphMtime: () => null }),
    execGraphify: (graph) => { calls.push(graph.name); },
  });
  assert.strictEqual(result.action, 'build');
  assert.deepStrictEqual(calls, ['source', 'context']);
  assert.deepStrictEqual(result.built, ['source', 'context']);
  assert.deepStrictEqual(result.failed, []);
});

test('syncSessionGraphs records per-graph failures without throwing', () => {
  const result = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({ graphMtime: () => null }),
    execGraphify: (graph) => {
      if (graph.name === 'context') throw new Error('boom');
    },
  });
  assert.deepStrictEqual(result.built, ['source']);
  assert.strictEqual(result.failed.length, 1);
  assert.strictEqual(result.failed[0].name, 'context');
});

test('newestMtimeUnder skips SCAN_EXCLUDED_DIRS even when they are newer', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-mtime-'));
  const srcFile = path.join(repo, 'src.js');
  fs.writeFileSync(srcFile, 'old');
  const mtimeOfSourceFile = fs.statSync(srcFile).mtimeMs;
  // Excluded dir holds a newer file — must not win the walk.
  assert.ok(SCAN_EXCLUDED_DIRS.has('graphify-out'));
  assert.ok(SCAN_EXCLUDED_DIRS.has('node_modules'));
  assert.ok(SCAN_EXCLUDED_DIRS.has('.git'));
  assert.ok(SCAN_EXCLUDED_DIRS.has('.worktrees'));
  for (const name of SCAN_EXCLUDED_DIRS) {
    const dir = path.join(repo, name);
    fs.mkdirSync(dir);
    const hot = path.join(dir, 'hot.txt');
    fs.writeFileSync(hot, 'new');
    const future = mtimeOfSourceFile + 60_000;
    fs.utimesSync(hot, new Date(future), new Date(future));
  }
  assert.strictEqual(newestMtimeUnder(repo, '.'), mtimeOfSourceFile);
});

test('newestMtimeUnder does not follow directory symlinks', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-mtime-sym-'));
  // Target lives outside the scanned tree so only the symlink entry is visible.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-mtime-outside-'));
  const hot = path.join(outside, 'hot.txt');
  fs.writeFileSync(hot, 'via-symlink');
  const future = Date.now() + 60_000;
  fs.utimesSync(hot, new Date(future), new Date(future));
  const cold = path.join(repo, 'cold.txt');
  fs.writeFileSync(cold, 'direct');
  const coldMtime = fs.statSync(cold).mtimeMs;
  fs.symlinkSync(outside, path.join(repo, 'link'), 'dir');
  assert.strictEqual(newestMtimeUnder(repo, '.'), coldMtime);
});

test('runGraphifyUpdate uses part outDir as cwd and absolute scan path', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-part-cwd-'));
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'export default 1\n');
  const outDir = partOutDir(DEFAULT_SOURCE_OUT, 'src');
  const partAbs = path.join(repo, outDir);
  const calls = [];
  // 해석된 절대 경로를 주입 — session-graph는 리터럴 'graphify'를 실행 대상으로 쓰지 않는다.
  const resolvedBin = path.join(repo, '.bouncer/.venv/bin/graphify');
  runGraphifyUpdate(repo, 'src', outDir, {
    bin: resolvedBin,
    exec: (cmd, args, opts) => {
      calls.push({ cmd, args, opts });
    },
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].cmd, resolvedBin);
  assert.deepStrictEqual(calls[0].args, ['update', path.join(repo, 'src')]);
  assert.strictEqual(calls[0].opts.cwd, partAbs);
  assert.ok(path.isAbsolute(calls[0].args[1]));
  assert.ok(fs.existsSync(partAbs), 'part outDir must exist before the call');
  // Absolute GRAPHIFY_OUT derived from the cwd-relative contract (usually ".")
  // so graphify does not join "." onto the absolute scan target.
  assert.strictEqual(calls[0].opts.env.GRAPHIFY_OUT, partAbs);
});

test('runGraphifyUpdate exec first argument is the resolved bin path', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-resolved-bin-'));
  fs.mkdirSync(path.join(repo, 'src'));
  const outDir = partOutDir(DEFAULT_SOURCE_OUT, 'src');
  const resolvedBin = '/opt/custom/graphify';
  let seen = null;
  runGraphifyUpdate(repo, 'src', outDir, {
    bin: resolvedBin,
    exec: (cmd) => { seen = cmd; },
  });
  assert.strictEqual(seen, resolvedBin);
});

test('context scope scans derived tree; freshness watches originals', () => {
  // context scope는 파생 트리를 스캔하고, freshness는 원본을 본다
  const scopes = resolveGraphScopes({ sourceDirs: ['scripts'], contextDirs: ['.bouncer/context'] });
  const source = scopes.find((s) => s.name === 'source');
  const context = scopes.find((s) => s.name === 'context');
  assert.ok(source);
  assert.ok(context);
  assert.equal(source.scanDirs, undefined);
  // exclude_dirs 변경이 skip-fresh에 가리지 않도록 source는 config mtime을 본다.
  assert.deepEqual(source.watchFiles, ['.bouncer/config.json']);
  assert.deepEqual(context.dirs, ['.bouncer/context']);
  assert.deepEqual(context.scanDirs, ['graphify-out/context-src']);
  assert.deepEqual(context.watchFiles, ['.bouncer/Distill.md']);
});

test('source rebuilds when config exclude_dirs is newer than graph', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-exclude-fresh-'));
  fs.mkdirSync(path.join(repo, 'src'));
  fs.writeFileSync(path.join(repo, 'src/a.ts'), 'export const a = 1;\n');
  fs.mkdirSync(path.join(repo, '.bouncer'), { recursive: true });
  fs.mkdirSync(path.join(repo, DEFAULT_SOURCE_OUT), { recursive: true });
  fs.writeFileSync(path.join(repo, DEFAULT_SOURCE_OUT, 'graph.json'), JSON.stringify({
    nodes: [{ id: 'a', source_file: 'src/a.ts' }],
    links: [],
  }));
  const old = Date.now() - 120_000;
  const neu = Date.now() + 60_000;
  const touch = (rel, ms) => {
    const abs = path.join(repo, rel);
    fs.utimesSync(abs, new Date(ms), new Date(ms));
  };
  touch('src/a.ts', old);
  touch(path.join(DEFAULT_SOURCE_OUT, 'graph.json'), old);
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    context_dirs: ['.bouncer/context'],
    verify: 'npm test',
    graphify: { enabled: true, exclude_dirs: ['scripts/lib'] },
  }));
  touch('.bouncer/config.json', neu);

  const result = planSessionGraph({
    repoRoot: repo,
    deps: {
      inspectBootstrap: () => 'ready',
      graphifyEnabled: () => true,
      hasGraphify: () => true,
      sourceDirs: () => ['src'],
      contextDirs: () => [],
      testDirs: () => null,
      excludeDirs: () => ['scripts/lib'],
    },
  });
  const source = result.graphs.find((g) => g.name === 'source');
  assert.ok(source);
  assert.strictEqual(source.action, 'build');
  assert.match(source.reason, /sources changed/i);
});

test('graphSyncWarnings emits diagnostic lines for config skips', () => {
  const lines = graphSyncWarnings({
    action: 'skip-fresh',
    graphs: [],
    missing: [],
    skips: [
      'graphify.test_dirs must be a string array of repo-relative paths',
      "graphify.exclude_dirs entries must be repo-relative paths without '..' or absolute roots",
    ],
  });
  assert.strictEqual(lines.length, 2);
  assert.match(lines[0], /skipped graphify config/);
  assert.match(lines[0], /test_dirs/);
  assert.match(lines[1], /exclude_dirs/);
  assert.match(lines[0], /\n$/);
});

test('resolveGraphScopes always includes test when testDirs are absent', () => {
  const scopes = resolveGraphScopes({
    sourceDirs: ['src'],
    contextDirs: ['.bouncer/context'],
  });
  assert.deepStrictEqual(scopes.map((s) => s.name), ['source', 'test', 'context']);
  const testScope = scopes.find((s) => s.name === 'test');
  assert.ok(testScope.unconfiguredReason);
  assert.deepStrictEqual(testScope.dirs, []);
});

test('resolveGraphScopes adds test scope and source excludeDirs when provided', () => {
  const scopes = resolveGraphScopes({
    sourceDirs: ['src'],
    testDirs: ['test'],
    contextDirs: ['.bouncer/context'],
    excludeDirs: ['scripts/lib'],
  });
  assert.deepStrictEqual(scopes.map((s) => s.name), ['source', 'test', 'context']);
  const source = scopes.find((s) => s.name === 'source');
  const testScope = scopes.find((s) => s.name === 'test');
  assert.strictEqual(testScope.outDir, DEFAULT_TEST_OUT);
  assert.deepStrictEqual(testScope.dirs, ['test']);
  assert.deepStrictEqual(source.excludeDirs, ['scripts/lib']);
});

test('legacy config without test_dirs keeps three-scope plan with skip-unconfigured test', () => {
  const result = plan({
    graphifyEnabled: () => true,
    graphMtime: () => null,
    testDirs: () => null,
  });
  assert.strictEqual(result.graphs.length, 3);
  assert.deepStrictEqual(result.graphs.map((g) => g.name), ['source', 'test', 'context']);
  const testGraph = result.graphs.find((g) => g.name === 'test');
  assert.strictEqual(testGraph.action, 'skip-unconfigured');
  assert.ok(!Object.prototype.hasOwnProperty.call(result, 'skips')
    || !result.skips
    || result.skips.length === 0);
});

test('unset test_dirs yields skip-unconfigured test and stays out of build missing warnings', () => {
  const result = plan({
    graphifyEnabled: () => true,
    graphMtime: () => null,
    testDirs: () => null,
  });
  assert.strictEqual(result.graphs.length, 3);
  assert.deepStrictEqual(result.graphs.map((g) => g.name), ['source', 'test', 'context']);
  const testGraph = result.graphs.find((g) => g.name === 'test');
  assert.strictEqual(testGraph.action, 'skip-unconfigured');
  assert.strictEqual(testGraph.reason, 'graphify.test_dirs is not configured');
  assert.deepStrictEqual(testGraph.dirs, []);
  assert.deepStrictEqual(testGraph.configured, []);
  assert.strictEqual(testGraph.outDir, DEFAULT_TEST_OUT);

  const sync = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({
      graphMtime: () => null,
      testDirs: () => null,
    }),
    execGraphify: () => {},
  });
  assert.ok(!sync.built.includes('test'));
  assert.ok(!sync.missing.includes('test'));
  const lines = graphSyncWarnings(sync);
  assert.ok(!lines.some((line) => /no test graph was built|test_dirs/.test(line)
    && /none of|no test graph/.test(line)));
  // skips 진단(무효 값)이 아니면 SessionStart에 test 미설정 경고가 생기지 않는다.
  assert.ok(!lines.some((line) => /\btest\b/.test(line) && /graph was built/.test(line)));
});

test('empty test_dirs array stays skip-no-dirs not skip-unconfigured', () => {
  const result = plan({
    graphifyEnabled: () => true,
    graphMtime: () => null,
    testDirs: () => [],
  });
  const testGraph = result.graphs.find((g) => g.name === 'test');
  assert.strictEqual(testGraph.action, 'skip-no-dirs');
  assert.notStrictEqual(testGraph.action, 'skip-unconfigured');
});

test('NO_GRAPH_WORK exits keep graphs empty without inventing a test entry', () => {
  const disabled = plan({ graphifyEnabled: () => false });
  assert.strictEqual(disabled.action, 'skip-graph-disabled');
  assert.deepStrictEqual(disabled.graphs, []);

  const noCli = plan({ hasGraphify: () => false });
  assert.strictEqual(noCli.action, 'skip-no-graphify');
  assert.deepStrictEqual(noCli.graphs, []);
});

test('top-level action stays skip-no-dirs when only unconfigured test is present', () => {
  const result = plan({
    graphifyEnabled: () => true,
    sourceDirs: () => ['missing-src'],
    contextDirs: () => ['missing-context'],
    testDirs: () => null,
    existingDirs: () => [],
    graphMtime: () => null,
  });
  assert.strictEqual(result.action, 'skip-no-dirs');
  const testGraph = result.graphs.find((g) => g.name === 'test');
  assert.strictEqual(testGraph.action, 'skip-unconfigured');
});

test('leftover test graph.json does not become skip-fresh when test_dirs unset', () => {
  const result = plan({
    graphifyEnabled: () => true,
    testDirs: () => null,
    graphMtime: (outDir) => {
      if (outDir === DEFAULT_TEST_OUT) return 500;
      return null;
    },
    newestMtime: () => 100,
  });
  const testGraph = result.graphs.find((g) => g.name === 'test');
  assert.strictEqual(testGraph.action, 'skip-unconfigured');
  assert.notStrictEqual(testGraph.action, 'skip-fresh');
  assert.notStrictEqual(testGraph.action, 'build');
});

test('test scope builds freshness and missing like other scopes', () => {
  const result = plan({
    graphifyEnabled: () => true,
    testDirs: () => ['test'],
    sourceDirs: () => ['src'],
    graphMtime: (outDir) => {
      if (outDir === DEFAULT_SOURCE_OUT) return 300;
      if (outDir === DEFAULT_TEST_OUT) return null;
      return 300;
    },
    newestMtime: () => 200,
  });
  assert.strictEqual(result.action, 'build');
  const byName = Object.fromEntries(result.graphs.map((g) => [g.name, g]));
  assert.strictEqual(byName.source.action, 'skip-fresh');
  assert.strictEqual(byName.test.action, 'build');
  assert.strictEqual(byName.context.action, 'skip-fresh');
  assert.strictEqual(byName.test.outDir, DEFAULT_TEST_OUT);

  let testGraphPresent = false;
  const sync = syncSessionGraphs({
    repoRoot: '/r',
    deps: base({
      testDirs: () => ['test'],
      sourceDirs: () => ['src'],
      existingDirs: (dirs) => dirs,
      graphMtime: (outDir) => {
        if (outDir === DEFAULT_TEST_OUT) return testGraphPresent ? 400 : null;
        return 300;
      },
      newestMtime: () => 200,
    }),
    execGraphify: (graph) => {
      if (graph.name === 'test') testGraphPresent = true;
    },
  });
  assert.ok(sync.built.includes('test'));
  assert.ok(!sync.missing.includes('test'));
});

test('invalid graphify.test_dirs is skipped with a diagnostic reason', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-bad-test-dirs-'));
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    context_dirs: ['.bouncer/context'],
    verify: 'npm test',
    graphify: { enabled: true, test_dirs: ['/abs/test', '../escape'] },
  }));
  fs.mkdirSync(path.join(repo, 'src'));
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });

  const result = planSessionGraph({
    repoRoot: repo,
    deps: {
      inspectBootstrap: () => 'ready',
      graphifyEnabled: () => true,
      hasGraphify: () => true,
      graphMtime: () => 300,
      newestMtime: () => 100,
    },
  });
  assert.deepStrictEqual(result.graphs.map((g) => g.name), ['source', 'test', 'context']);
  assert.ok(Array.isArray(result.skips));
  assert.ok(result.skips.some((s) => /test_dirs/.test(s)));
  const testGraph = result.graphs.find((g) => g.name === 'test');
  assert.strictEqual(testGraph.action, 'skip-unconfigured');
  assert.match(testGraph.reason, /test_dirs/);
});

test('invalid graphify.exclude_dirs is not applied and reports a skip reason', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-bad-exclude-'));
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/config.json'), JSON.stringify({
    source_dirs: ['src'],
    context_dirs: ['.bouncer/context'],
    verify: 'npm test',
    graphify: { enabled: true, exclude_dirs: 'scripts/lib' },
  }));
  fs.mkdirSync(path.join(repo, 'src'));
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });

  const result = planSessionGraph({
    repoRoot: repo,
    deps: {
      inspectBootstrap: () => 'ready',
      graphifyEnabled: () => true,
      hasGraphify: () => true,
      graphMtime: () => 300,
      newestMtime: () => 100,
    },
  });
  const source = result.graphs.find((g) => g.name === 'source');
  assert.deepStrictEqual(source.excludeDirs || [], []);
  assert.ok(Array.isArray(result.skips));
  assert.ok(result.skips.some((s) => /exclude_dirs/.test(s)));
});

test('normalizeGraphPaths maps source_file via opts.map and drops unknowns', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-norm-map-'));
  const partOut = 'graphify-out/context/parts/digest';
  fs.mkdirSync(path.join(repo, partOut), { recursive: true });
  const graph = {
    nodes: [
      { id: 'keep', source_file: 'flat-a.md' },
      { id: 'drop', source_file: 'unknown.md' },
    ],
    links: [
      { source: 'keep', target: 'drop', source_file: 'flat-a.md' },
      { source: 'drop', target: 'keep', source_file: 'unknown.md' },
    ],
    hyperedges: [
      { nodes: ['keep', 'drop'], source_file: 'flat-a.md' },
    ],
  };
  fs.writeFileSync(path.join(repo, partOut, 'graph.json'), JSON.stringify(graph));
  const rel = normalizeGraphPaths(repo, partOut, 'graphify-out/context-src', {
    map: { 'flat-a.md': '.bouncer/Distill.md' },
  });
  const out = JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8'));
  assert.strictEqual(out.nodes.length, 1);
  assert.strictEqual(out.nodes[0].source_file, '.bouncer/Distill.md');
  assert.ok(out.nodes[0].id.includes('keep'));
  assert.strictEqual(out.links.length, 0);
  assert.strictEqual(out.hyperedges.length, 0);
});

test('normalizeGraphPaths without map keeps dir/file prefix behavior', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-norm-prefix-'));
  const partOut = 'graphify-out/source/parts/scripts';
  fs.mkdirSync(path.join(repo, partOut), { recursive: true });
  fs.writeFileSync(path.join(repo, partOut, 'graph.json'), JSON.stringify({
    nodes: [{ id: 'n1', source_file: 'lib/a.ts' }],
    links: [{ source: 'n1', target: 'n1', source_file: 'lib/a.ts' }],
    hyperedges: [],
  }));
  const rel = normalizeGraphPaths(repo, partOut, 'scripts');
  const out = JSON.parse(fs.readFileSync(path.join(repo, rel), 'utf8'));
  assert.strictEqual(out.nodes[0].source_file, 'scripts/lib/a.ts');
  assert.ok(out.nodes[0].id.startsWith('scripts_'));
});

test('Distill.md mtime alone marks context graph stale', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-distill-fresh-'));
  fs.mkdirSync(path.join(repo, '.bouncer/context/epics/001-x'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/context/epics/001-x/index.md'), '## Success criteria\n\nx\n');
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Decisions\n\nd\n');
  fs.mkdirSync(path.join(repo, DEFAULT_CONTEXT_OUT), { recursive: true });
  const graphPath = path.join(repo, DEFAULT_CONTEXT_OUT, 'graph.json');
  fs.writeFileSync(graphPath, JSON.stringify({ nodes: [], links: [] }));

  const old = Date.now() - 60_000;
  const neu = Date.now() + 60_000;
  const touch = (rel, ms) => {
    const abs = path.join(repo, rel);
    fs.utimesSync(abs, new Date(ms), new Date(ms));
  };
  // context dirs + graph are old; only Distill is newer → context must build.
  touch('.bouncer/context/epics/001-x/index.md', old);
  touch(path.join(DEFAULT_CONTEXT_OUT, 'graph.json'), old);
  touch('.bouncer/Distill.md', neu);

  const result = planSessionGraph({
    repoRoot: repo,
    deps: {
      inspectBootstrap: () => 'ready',
      graphifyEnabled: () => true,
      hasGraphify: () => true,
      sourceDirs: () => [],
      contextDirs: () => ['.bouncer/context'],
    },
  });
  const context = result.graphs.find((g) => g.name === 'context');
  assert.ok(context);
  assert.strictEqual(context.action, 'build');
});

test('empty context digest skips graphify, keeps prior graph, settles freshness', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-empty-digest-'));
  // digest count === 0 은 앵커와 절 본문이 모두 비었을 때만이다다.
  // 계층 경로 화이트리스트(task 브리프 등)는 앵커만으로도 emit 되므로 empty-skip 픽스처로 쓰지 않는다.
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/Distill.md'), '## Decisions\n\n');
  fs.mkdirSync(path.join(repo, DEFAULT_CONTEXT_OUT), { recursive: true });
  const graphPath = path.join(repo, DEFAULT_CONTEXT_OUT, 'graph.json');
  const prior = JSON.stringify({ nodes: [{ id: 'keep-me', source_file: '.bouncer/Distill.md' }], links: [] });
  fs.writeFileSync(graphPath, prior);
  const old = Date.now() - 120_000;
  fs.utimesSync(graphPath, new Date(old), new Date(old));
  // Distill은 context watchFiles 이라 mtime만으로 freshness를 stale로 만든다.
  const srcPath = path.join(repo, '.bouncer/Distill.md');
  fs.utimesSync(srcPath, new Date(old + 60_000), new Date(old + 60_000));

  const deps = {
    inspectBootstrap: () => 'ready',
    graphifyEnabled: () => true,
    hasGraphify: () => true,
    sourceDirs: () => [],
    contextDirs: () => ['.bouncer/context'],
  };
  const sync = syncSessionGraphs({ repoRoot: repo, deps });
  assert.ok(sync.built.includes('context'));
  assert.strictEqual(fs.readFileSync(graphPath, 'utf8'), prior);
  assert.ok(!fs.existsSync(path.join(repo, DEFAULT_CONTEXT_OUT, 'parts')));
  assert.ok(fs.statSync(graphPath).mtimeMs > old + 60_000);

  const after = planSessionGraph({ repoRoot: repo, deps });
  const context = after.graphs.find((g) => g.name === 'context');
  assert.strictEqual(context.action, 'skip-fresh');
});

test('empty context digest without prior graph is not reported as built', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-empty-digest-miss-'));
  fs.mkdirSync(path.join(repo, '.bouncer/context'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.bouncer/context/readme.md'), '# not whitelisted\n');

  const sync = syncSessionGraphs({
    repoRoot: repo,
    deps: {
      inspectBootstrap: () => 'ready',
      graphifyEnabled: () => true,
      hasGraphify: () => true,
      sourceDirs: () => [],
      contextDirs: () => ['.bouncer/context'],
    },
  });
  assert.ok(!sync.built.includes('context'));
  assert.ok(sync.missing.includes('context'));
  assert.ok(!fs.existsSync(path.join(repo, DEFAULT_CONTEXT_OUT, 'graph.json')));
  assert.ok(!fs.existsSync(path.join(repo, DEFAULT_CONTEXT_OUT, 'parts')));
});

test('SessionStart reports partial state on stderr and exits zero', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-session-'));
  fs.mkdirSync(path.join(repo, '.bouncer'));
  fs.writeFileSync(path.join(repo, '.bouncer/workflow.md'), '# custom\n');
  const hook = path.join(__dirname, '../hooks/session-graph.js');

  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 0);
  assert.match(result.stderr, /partial Bouncer state/i);
  assert.strictEqual(result.stdout, '');
});

test('SessionStart reports legacy state with corrective command and exits zero', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-session-'));
  fs.mkdirSync(path.join(repo, ['.', 's', 'd', 'd'].join('')));
  const hook = path.join(__dirname, '../hooks/session-graph.js');

  const result = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd: repo }),
    encoding: 'utf8',
  });

  assert.strictEqual(result.status, 0);
  assert.match(result.stderr, /legacy state/i);
  assert.match(result.stderr, /\/bouncer-init/);
  assert.strictEqual(result.stdout, '');
});
