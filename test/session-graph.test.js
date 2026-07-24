'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { planSessionGraph } = require('../scripts/lib/session-graph');

function base(over) {
  return {
    inspectBootstrap: () => 'ready',
    init: () => ({ ok: true, created: [], skipped: true, reason: 'already-initialized' }),
    graphifyEnabled: () => true,
    hasGraphify: () => true,
    sourceDirs: () => ['src', 'test'],
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
  });
  assert.strictEqual(checkedGraphify, false);
});

test('graphify opt-in retains missing graph build behavior', () => {
  const result = plan({
    graphifyEnabled: () => true,
    graphMtime: () => null,
  });
  assert.strictEqual(result.action, 'build');
  assert.deepStrictEqual(result.dirs, ['src', 'test']);
});

test('skips when graphify is not on PATH', () => {
  const result = plan({ hasGraphify: () => false });
  assert.strictEqual(result.bootstrap, 'ready');
  assert.strictEqual(result.action, 'skip-no-graphify');
});

test('skips when the graph is fresher than every source dir', () => {
  assert.strictEqual(plan({ newestMtime: () => 100, graphMtime: () => 200 }).action, 'skip-fresh');
});

test('builds when the graph is missing', () => {
  const r = plan({ graphMtime: () => null });
  assert.strictEqual(r.action, 'build');
  assert.deepStrictEqual(r.dirs, ['src', 'test']);
});

test('builds when a source dir is newer than the graph', () => {
  assert.strictEqual(plan({ newestMtime: () => 300, graphMtime: () => 200 }).action, 'build');
});

test('build dirs are limited to source dirs that exist', () => {
  const r = plan({ graphMtime: () => null, existingDirs: () => ['src'] });
  assert.deepStrictEqual(r.dirs, ['src']);
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
