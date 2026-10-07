'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { taskBriefHash } = require('../scripts/lib/task-brief-hash');

test('taskBriefHash ignores lifecycle keys and YAML quoting, not body or other keys', () => {
  const base = '---\nbouncer:\n  status: ready\n  affected_paths:\n    - a.ts\n---\nbrief\n';
  const later = '---\nbouncer:\n  affected_paths: [a.ts]\n  status: verified\n  commit_sha: abcd1234\n---\nbrief\n';
  assert.strictEqual(taskBriefHash(base), taskBriefHash(later));
  assert.notStrictEqual(taskBriefHash(base), taskBriefHash(base.replace('brief', 'brief2')));
  assert.notStrictEqual(taskBriefHash(base), taskBriefHash(base.replace('a.ts', 'b.ts')));
  const dated = (d) => `---\nreviewed: ${d}\nbouncer:\n  status: ready\n---\nbrief\n`;
  assert.notStrictEqual(taskBriefHash(dated('2026-10-06')), taskBriefHash(dated('2026-10-07')));
  assert.match(taskBriefHash(base), /^[a-f0-9]{64}$/);
  assert.throws(() => taskBriefHash('no frontmatter\n'), /missing frontmatter block/);
});
