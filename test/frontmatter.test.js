'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../packages/cli/dist/frontmatter');

test('a document with a frontmatter block → parses frontmatter data and body', () => {
  const md = '---\ntype: bouncer.tasks\ntags: [bouncer, tasks]\n---\n# Body\n';
  const { data, body } = parseFrontmatter(md);
  assert.strictEqual(data.type, 'bouncer.tasks');
  assert.deepStrictEqual(data.tags, ['bouncer', 'tasks']);
  assert.strictEqual(body, '# Body\n');
});

test('a document without a frontmatter block → throws', () => {
  assert.throws(() => parseFrontmatter('# no frontmatter\n'), /missing frontmatter block/);
});
