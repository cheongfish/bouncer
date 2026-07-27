// test/distribution.test.js
// Bouncer ships as a Claude Code plugin installed from a git marketplace
// source. Claude Code clones the plugin and never runs `npm install`, so
// everything reachable from the CLI and the hooks must resolve without a
// node_modules directory.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

function jsFilesUnder(rel) {
  const dir = path.join(root, rel);
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFilesUnder(path.join(rel, entry.name)));
    else if (entry.name.endsWith('.js') || !path.extname(entry.name)) out.push(abs);
  }
  return out;
}

function bareRequires(file) {
  const src = fs.readFileSync(file, 'utf8');
  const found = [];
  for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('/')) continue;
    if (spec.startsWith('node:')) continue;
    found.push(spec);
  }
  return found;
}

test('shipped code requires nothing from node_modules', () => {
  const offenders = [];
  for (const dir of ['scripts', 'hooks']) {
    for (const file of jsFilesUnder(dir)) {
      if (file.includes(`${path.sep}vendor${path.sep}`)) continue;
      for (const spec of bareRequires(file)) {
        offenders.push(`${path.relative(root, file)} -> ${spec}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [], `bare requires break marketplace installs:\n${offenders.join('\n')}`);
});

test('package.json declares no runtime dependencies', () => {
  const pkg = readJson('package.json');
  const deps = Object.keys(pkg.dependencies || {});
  assert.deepStrictEqual(deps, [], `runtime deps are not installed by Claude Code: ${deps.join(', ')}`);
});

test('the vendored yaml module provides load and dump', () => {
  // eslint-disable-next-line global-require
  const yaml = require('../scripts/vendor/js-yaml');
  assert.strictEqual(typeof yaml.load, 'function');
  assert.strictEqual(typeof yaml.dump, 'function');
  const roundTripped = yaml.load(yaml.dump({ a: [1, 2], b: 'x' }));
  assert.deepStrictEqual(roundTripped, { a: [1, 2], b: 'x' });
});

test('marketplace.json lists bouncer from the repository root', () => {
  const mkt = readJson('.claude-plugin/marketplace.json');
  assert.strictEqual(mkt.name, 'chunjae-tools');
  assert.ok(mkt.owner && typeof mkt.owner.name === 'string' && mkt.owner.name);
  assert.ok(Array.isArray(mkt.plugins));
  const entry = mkt.plugins.find((p) => p.name === 'bouncer');
  assert.ok(entry, 'no bouncer plugin entry');
  assert.strictEqual(entry.source, './');
  assert.ok(typeof entry.description === 'string' && entry.description);
});

test('marketplace and plugin manifests agree on name and version', () => {
  const mkt = readJson('.claude-plugin/marketplace.json');
  const plugin = readJson('.claude-plugin/plugin.json');
  const pkg = readJson('package.json');
  const entry = mkt.plugins.find((p) => p.name === 'bouncer');
  assert.strictEqual(entry.version, plugin.version);
  assert.strictEqual(plugin.version, pkg.version);
});

test('plugin.json carries author attribution for release tagging', () => {
  const plugin = readJson('.claude-plugin/plugin.json');
  assert.ok(plugin.author && typeof plugin.author.name === 'string' && plugin.author.name);
});
