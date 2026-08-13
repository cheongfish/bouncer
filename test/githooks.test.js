'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

test('.githooks/pre-commit is executable and runs the local CI subset', () => {
  const hook = path.join(root, '.githooks', 'pre-commit');
  const st = fs.statSync(hook);
  assert.ok((st.mode & 0o111) !== 0, 'pre-commit must be executable');
  const body = fs.readFileSync(hook, 'utf8');
  assert.match(body, /npm run lint/);
  assert.match(body, /npm run build/);
  assert.match(body, /scripts\/lib/);
  assert.doesNotMatch(body, /^\s*npm test\b/m);
});

test('npm run setup enables the githooks path', () => {
  const pkg = readJson('package.json');
  assert.match(pkg.scripts.setup, /core\.hooksPath \.githooks/);
  assert.match(pkg.scripts.setup, /commit\.template \.gitmessage/);
});
