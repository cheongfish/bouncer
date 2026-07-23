'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const md = fs.readFileSync(
  path.join(__dirname, '..', 'skills', 'verification-adapter', 'SKILL.md'), 'utf8',
);

test('verification-adapter has valid frontmatter', () => {
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'verification-adapter');
  assert.ok(data.description.length > 0);
});

test('verification-adapter is profile-aware: native self-contained, superpowers delegated', () => {
  assert.ok(/profile/i.test(md), 'mentions profile selection');
  assert.ok(/sdd-harness profile|methodology\.profile/.test(md), 'resolves profile');
  // native path: runs verify command itself and records evidence
  assert.ok(/native/i.test(md));
  assert.ok(/config\.verify|\.sdd\/config\.json/.test(md));
  assert.ok(/##\s*Command/.test(md) && /##\s*Evidence/.test(md), 'names body sections');
  // superpowers path: still delegates when that profile is selected
  assert.ok(/superpowers:verification-before-completion/.test(md));
  // contract: statuses only on real pass, and superpowers-only fail-closed
  assert.ok(/verification[\s\S]*passed/i.test(md));
  assert.ok(/tasks[\s\S]*verified/i.test(md));
  assert.ok(/fail closed|do not.*transition|no success/i.test(md));
});
