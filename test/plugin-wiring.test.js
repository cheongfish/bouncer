'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('plugin.json references hooks/hooks.json', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.strictEqual(plugin.name, 'sdd');
  assert.strictEqual(plugin.hooks, './hooks/hooks.json');
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
