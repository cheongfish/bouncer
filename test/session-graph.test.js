'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  planSessionGraph, syncSessionGraphs, DEFAULT_SOURCE_OUT, DEFAULT_CONTEXT_OUT,
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
  assert.strictEqual(result.action, 'skip-graph-disabled');
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(repo, '.bouncer/config.json'), 'utf8')).graphify,
    { enabled: false },
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
