'use strict';

// Pins the adversarial-but-must-fix-only reviewer wording across the agent
// role document and its inline fallback prompt, while the plan-document
// context reviewer keeps its wider reporting bar (including `nit`).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('code reviewer docs → adversarial stance and must-fix-only reporting', () => {
  const reviewer = read('agents/bouncer-reviewer.md');
  const prompt = read('references/review/assets/reviewer-prompt.md');
  assert.match(reviewer, /Review adversarially/);
  assert.doesNotMatch(reviewer, /label, not a filter/);
  assert.doesNotMatch(reviewer, /must_fix \| advisory/);
  assert.doesNotMatch(prompt, /must_fix \| advisory/);
  assert.match(reviewer, /must be fixed/);
  assert.match(reviewer, /empty Findings list is a valid result/);
  assert.match(prompt, /Review adversarially/);
  assert.match(prompt, /must-fix/);
});

test('context reviewer docs → adversarial stance with unchanged reporting bar', () => {
  const contextReviewer = read('agents/bouncer-context-reviewer.md');
  assert.match(contextReviewer, /Review adversarially/);
  assert.match(contextReviewer, /label, not a filter/);
  assert.match(contextReviewer, /\bnit\b/);
  assert.match(contextReviewer, /must_fix \| advisory/);
});
