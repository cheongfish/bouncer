'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-commit', 'SKILL.md'), 'utf8');

test('bouncer-commit is an explicit-ask workflow skill', () => {
  const { data, body } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'bouncer-commit');
  assert.match(String(data.description), /Use only when the user explicitly asks/i);
  assert.match(body, /validate\s+--gate\s+commit/);
  assert.match(body, /bouncer"\s+commit[\s\S]*--yes|commit\s+--blueprint[\s\S]*--yes/);
  assert.match(body, /skills\/explain-diff\/SKILL\.md/);
  assert.match(body, /current --set/);
});

test('bouncer-commit reuses finalize ACQ skeleton and does not invent CLI', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /AskUserQuestion|ACQ/);
  assert.match(body, /Re-ground/);
  assert.match(body, /Recommend-why/);
  assert.match(body, /Recommended/);
  assert.match(body, /scripts\/bouncer"\s+current\b/);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
});
