'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('stop-slop has valid frontmatter identity', () => {
  const md = readSkill('stop-slop');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*stop-slop/);
  assert.strictEqual(data.name, 'stop-slop');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('stop-slop targets Korean context prose and stays advisory', () => {
  const md = readSkill('stop-slop');
  assert.match(md, /Korean|\.bouncer\/context/);
  assert.match(md, /advisory|not a gate/i);
  assert.match(md, /phrases\.md|structures\.md|examples\.md/);
  assert.match(md, /Hardik Pandya|MIT/i);
  assert.doesNotMatch(md, /\/bouncer-plan|superpowers/i);
});

test('stop-slop ships LICENSE and Korean-oriented references', () => {
  const root = path.join(__dirname, '..', 'references', 'stop-slop');
  assert.ok(fs.existsSync(path.join(root, 'LICENSE')));
  const phrases = fs.readFileSync(path.join(root, 'phrases.md'), 'utf8');
  assert.match(phrases, /다음과 같습니다|중요한 점은/);
  const examples = fs.readFileSync(path.join(root, 'examples.md'), 'utf8');
  assert.match(examples, /Before:|After:/);
});
