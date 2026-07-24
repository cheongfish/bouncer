'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

test('parses frontmatter data and body', () => {
  const md = '---\ntype: bouncer.tasks\ntags: [bouncer, tasks]\n---\n# Body\n';
  const { data, body } = parseFrontmatter(md);
  assert.strictEqual(data.type, 'bouncer.tasks');
  assert.deepStrictEqual(data.tags, ['bouncer', 'tasks']);
  assert.strictEqual(body, '# Body\n');
});

test('throws when frontmatter block is missing', () => {
  assert.throws(() => parseFrontmatter('# no frontmatter\n'), /missing frontmatter block/);
});
