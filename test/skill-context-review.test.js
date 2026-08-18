'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

test('context-review has valid frontmatter identity', () => {
  const md = readSkill('context-review');
  const { data } = parseFrontmatter(md);
  assert.strictEqual(data.name, 'context-review');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
  assert.match(String(data.description), /This skill should be used/i);
  assert.doesNotMatch(String(data.description), /##/);
});

test('context-review covers the four judgment scopes', () => {
  const md = readSkill('context-review');
  assert.match(md, /contradiction|inconsistenc/i);
  assert.match(md, /epic/i);
  assert.match(md, /blueprint/i);
  assert.match(md, /tasks/i);
  assert.match(md, /affected_paths/);
  assert.match(md, /scope_evidence\.suggested_paths/);
  assert.match(md, /Checklist/);
  assert.match(md, /suggested_paths/);
  assert.match(md, /stop-slop/);
  assert.match(md, /success criteria/i);
  assert.match(md, /true\s*[/·.]?\s*false|verifiable|cannot be judged|cannot tell/i);
});

test('context-review forbids document edits and status flips', () => {
  const md = readSkill('context-review');
  assert.match(md, /must not edit|do not edit|never edit/i);
  assert.match(md, /status/i);
  assert.match(md, /controller/i);
});

test('context-review findings require id, severity, status, and a note on accepted', () => {
  const md = readSkill('context-review');
  assert.match(md, /## Findings/);
  assert.match(md, /`id`|\bid\b/);
  assert.match(md, /severity/i);
  assert.match(md, /blocker|major|minor|nit/i);
  assert.match(md, /resolved|accepted/i);
  assert.match(md, /accepted[^\n]*note|note[^\n]*accepted/i);
});

test('context-review excludes OKF fields and status that gates already check', () => {
  const md = readSkill('context-review');
  assert.match(md, /OKF/i);
  assert.match(md, /exclud|out of (scope|judgment)|gates already/i);
});

test('context-review judges Mermaid zoom conflicts without requiring a chart', () => {
  const md = readSkill('context-review');
  assert.match(md, /mermaid/i);
  assert.match(md, /줌|zoom/i);
  assert.match(md, /Chart absence is optional and not a finding/i);
});
