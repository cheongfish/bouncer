// test/cursor-plugin.test.js
// Bouncer ships from one repository as both a Claude Code plugin and a Cursor
// plugin. The two manifests describe the same artifact, so a version or name
// that drifts between them ships a plugin that claims to be something it is
// not. The hook adapters wear different protocols but must reach the same
// verdict, so the Cursor one is exercised against the same guard.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { writeCurrent } = require('../scripts/lib/current');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('the Cursor manifest agrees with the Claude Code manifest', () => {
  const cursor = readJson('.cursor-plugin/plugin.json');
  const claude = readJson('.claude-plugin/plugin.json');
  assert.strictEqual(cursor.name, 'bouncer');
  assert.strictEqual(cursor.name, claude.name);
  assert.strictEqual(cursor.version, claude.version);
});

// Cursor discovers hooks/hooks.json by convention, and that file speaks Claude
// Code's event names. Naming the Cursor file in the manifest replaces the
// discovery, so this declaration is what keeps Cursor from loading a hook
// definition it cannot understand.
test('the Cursor manifest points hooks at the Cursor hook file', () => {
  const cursor = readJson('.cursor-plugin/plugin.json');
  assert.strictEqual(cursor.hooks, './hooks/cursor-hooks.json');
  assert.ok(fs.existsSync(path.join(root, 'hooks/cursor-hooks.json')));
});

test('cursor-hooks.json registers commit safety on beforeShellExecution', () => {
  const hooks = readJson('hooks/cursor-hooks.json');
  assert.strictEqual(hooks.version, 1);
  const entries = hooks.hooks.beforeShellExecution;
  assert.ok(Array.isArray(entries), 'no beforeShellExecution entries');
  assert.ok(entries[0].command.includes('cursor-commit-safety.js'));
});

test('the Cursor marketplace lists bouncer at the repository root', () => {
  const market = readJson('.cursor-plugin/marketplace.json');
  const entry = (market.plugins || []).find((p) => p.name === 'bouncer');
  assert.ok(entry, 'no bouncer entry');
  assert.strictEqual(entry.source, './');
});

// ${CLAUDE_PLUGIN_ROOT} is substituted by Claude Code and by nothing else, so a
// command that interpolates it directly hands another agent a literal path
// segment that cannot resolve. Every use must go through the BOUNCER_ROOT
// resolution line, which names the variable exactly once as a fallback.
test('commands resolve the plugin root instead of naming a single agent', () => {
  const dir = path.join(root, 'commands');
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const src = fs.readFileSync(path.join(dir, name), 'utf8');
    assert.ok(
      !src.includes('${CLAUDE_PLUGIN_ROOT}/'),
      `${name} interpolates CLAUDE_PLUGIN_ROOT directly`,
    );
    assert.ok(
      src.includes('BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-}}"'),
      `${name} is missing the BOUNCER_ROOT resolution line`,
    );
    if (src.includes('bouncer" ') || src.includes('scripts/bouncer')) {
      assert.ok(src.includes('${BOUNCER_ROOT}/'), `${name} does not use BOUNCER_ROOT`);
    }
  }
});

function runCursorHook(payload, cwd) {
  const out = execFileSync(process.execPath, [path.join(root, 'hooks/cursor-commit-safety.js')], {
    input: JSON.stringify(payload), encoding: 'utf8', cwd,
  });
  return JSON.parse(out);
}

// The adapter's whole job is translation: Cursor decides from stdout JSON, not
// from an exit code. A non-commit command must not be denied, and a commit that
// the shared guard rejects must come back as a deny carrying the reason.
test('the Cursor adapter allows commands that are not commits', () => {
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'ls -la',
    workspace_roots: [root],
  }, root);
  assert.strictEqual(res.permission, 'allow');
});

const BP = '.bouncer/context/epics/EPIC-001-x/blueprints/BP-001-y';

// A repository with an active blueprint whose affected_paths cover src/feature
// only, and one staged file on each side of that boundary.
function fixtureRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-cursor-'));
  const git = (args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
  git(['init', '--quiet']);
  fs.mkdirSync(path.join(repo, BP), { recursive: true });
  fs.writeFileSync(path.join(repo, BP, 'tasks.md'), [
    '---', 'bouncer:', '  affected_paths:', '    - src/feature', '---', '',
  ].join('\n'));
  fs.mkdirSync(path.join(repo, 'src/feature'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'src/other'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/feature/a.js'), '// in scope\n');
  fs.writeFileSync(path.join(repo, 'src/other/b.js'), '// out of scope\n');
  writeCurrent({ repoRoot: repo, blueprint: BP, base: 'develop' });
  return { repo, git };
}

test('the Cursor adapter denies a commit that reaches outside affected_paths', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/feature/a.js', 'src/other/b.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, repo);
  assert.strictEqual(res.permission, 'deny');
  assert.match(res.userMessage, /src\/other\/b\.js/);
  // The agent needs the reason too, or it retries the same blocked commit.
  assert.match(res.agentMessage, /src\/other\/b\.js/);
  assert.ok(!res.userMessage.includes('src/feature/a.js'));
});

test('the Cursor adapter allows a commit that stays inside affected_paths', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/feature/a.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, repo);
  assert.strictEqual(res.permission, 'allow');
});

// Cursor names the workspace `workspace_roots`; reading process.cwd() instead
// would inspect whatever directory Cursor happened to launch the hook from.
test('the Cursor adapter judges the workspace root, not its own cwd', () => {
  const { repo, git } = fixtureRepo();
  git(['add', 'src/other/b.js']);
  const res = runCursorHook({
    hook_event_name: 'beforeShellExecution',
    command: 'git commit -m x',
    workspace_roots: [repo],
  }, os.tmpdir());
  assert.strictEqual(res.permission, 'deny');
});
