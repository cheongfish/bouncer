'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const reviewerPrompt = fs.readFileSync(
  path.join(root, 'skills', 'review', 'reviewer-prompt.md'),
  'utf8',
);

test('review has valid frontmatter identity', () => {
  const md = readSkill('review');
  const { data } = parseFrontmatter(md);
  assert.match(md, /name:\s*review/);
  assert.strictEqual(data.name, 'review');
  assert.ok(typeof data.description === 'string' && data.description.length > 0);
});

test('review requires Findings and actionable disposition', () => {
  const md = readSkill('review');
  assert.match(md, /## Findings/);
  assert.match(md, /severity/i);
  assert.match(md, /blocker|major|minor|nit/i);
  assert.match(md, /resolved|accepted/i);
  assert.match(md, /Do not touch|Checklist|Interface/i);
  assert.doesNotMatch(md, /profile|superpowers/i);
});

test('review skill includes Spec/Quality rubric and reviewer-prompt dispatch', () => {
  const md = readSkill('review');
  assert.match(md, /Spec compliance/i);
  assert.match(md, /Missing/);
  assert.match(md, /Extra/);
  assert.match(md, /Misunderstood/);
  assert.match(md, /Code quality/i);
  assert.match(md, /Calibration/i);
  assert.match(md, /reviewer-prompt\.md/);
  assert.match(md, /dispatch/i);
  assert.match(md, /bouncer-reviewer/);
  assert.match(md, /resolveSubagentModel/);
  assert.match(md, /inherit/);
  assert.match(md, /fresh generic|generic.*subagent/i);
  assert.match(md, /controller/i);
  assert.doesNotMatch(md, /profile|superpowers/i);
});

test('review judges the Constraints section and the rejection half of Interface', () => {
  const md = readSkill('review');
  assert.match(md, /Constraint breach/i);
  assert.match(md, /rejects/i);
  // Constraints must reach the dispatched reviewer, not just the controller.
  assert.match(reviewerPrompt, /Constraint breach/i);
  assert.match(reviewerPrompt, /rejects/i);
  assert.match(reviewerPrompt, /## Constraints|Constraints.*verbatim/i);
});

test('reviewer-prompt is read-only Findings template with placeholders', () => {
  assert.match(reviewerPrompt, /\{\{BRIEF\}\}/);
  assert.match(reviewerPrompt, /\{\{BASE\}\}/);
  assert.match(reviewerPrompt, /\{\{HEAD\}\}/);
  assert.match(reviewerPrompt, /\{\{CONSTRAINTS\}\}/);
  assert.match(reviewerPrompt, /Spec compliance|Missing|Extra|Misunderstood/i);
  assert.match(reviewerPrompt, /Code quality/i);
  assert.match(reviewerPrompt, /blocker|major|minor|nit/i);
  assert.match(reviewerPrompt, /Findings/i);
  assert.match(reviewerPrompt, /file:line|file：line/i);
  assert.match(reviewerPrompt, /read-only|must not.*edit|Do not modify/i);
  assert.match(reviewerPrompt, /status|accepted/i);
  assert.doesNotMatch(reviewerPrompt, /profile|superpowers/i);
});

test('review and reviewer-prompt flag over-engineering without punishing why-comments', () => {
  const md = readSkill('review');
  assert.match(md, /Over-engineering/i);
  assert.match(md, /unrequested abstraction|stdlib|root-cause/i);
  assert.match(md, /why-comments|explanatory comments|\bwhy\b/i);
  assert.match(reviewerPrompt, /Over-engineering/i);
  assert.match(reviewerPrompt, /unrequested abstraction|stdlib|root-cause/i);
  assert.match(reviewerPrompt, /why-comments|thorough why|\bwhy\b/i);
});
