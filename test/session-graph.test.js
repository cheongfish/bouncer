'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  planSessionGraph, syncSessionGraphs, graphSyncWarnings,
  newestMtimeUnder, runGraphifyUpdate, partOutDir,
  SCAN_EXCLUDED_DIRS, DEFAULT_SOURCE_OUT, DEFAULT_CONTEXT_OUT,
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
  assert.strictEqual(result.graphs.length, 2);
  assert.deepStrictEqual(result.graphs.map((g) => g.name), ['source', 'context']);
  assert.ok(result.graphs.every((g) => g.action === 'build'));
  assert.strictEqual(result.graphs[0].outDir, DEFAULT_SOURCE_OUT);
  assert.strictEqual(result.graphs[1].outDir, DEFAULT_CONTEXT_OUT);
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
