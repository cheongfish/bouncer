'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('package.json exposes the bouncer name and bin', () => {
  const pkg = readJson('package.json');
  assert.strictEqual(pkg.name, 'bouncer');
  assert.deepStrictEqual(pkg.bin, { bouncer: 'scripts/bouncer' });
});

// hooks/hooks.json is loaded by convention. Naming it in the manifest as well
// makes the loader see the same file twice and reject the whole plugin with
// "Duplicate hooks file detected" — the plugin does not load at all, so this is
// a shipping blocker rather than a cosmetic manifest issue. `hooks` is only for
// *additional* hook files.
test('plugin.json does not re-declare the conventional hooks file', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.strictEqual(plugin.name, 'bouncer');
  assert.ok(!('hooks' in plugin), 'plugin.json must not declare hooks/hooks.json');
});

test('hooks.json registers commit-safety on PreToolUse Bash', () => {
  const hooks = readJson('hooks/hooks.json');
  const pre = hooks.hooks.PreToolUse;
  assert.ok(Array.isArray(pre));
  const entry = pre.find((h) => h.matcher === 'Bash');
  assert.ok(entry, 'no Bash PreToolUse matcher');
  assert.ok(entry.hooks[0].command.includes('commit-safety.js'));
});

test('hooks.json registers session-graph on SessionStart', () => {
  const hooks = readJson('hooks/hooks.json');
  const start = hooks.hooks.SessionStart;
  assert.ok(Array.isArray(start));
  assert.ok(start[0].hooks[0].command.includes('session-graph.js'));
});
