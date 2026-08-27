'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readSkill } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const reviewerPrompt = fs.readFileSync(
  path.join(root, 'skills', 'review', 'assets', 'reviewer-prompt.md'),
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

test('review skill keeps the reviewer-prompt dispatch contract', () => {
  const md = readSkill('review');
  assert.match(md, /reviewer-prompt\.md/);
  assert.match(md, /dispatch/i);
  assert.match(md, /bouncer-reviewer/);
  assert.match(md, /rules\/subagent-model\.md/);
  assert.match(md, /fresh generic|generic.*subagent/i);
  assert.match(md, /controller/i);
  assert.doesNotMatch(md, /profile|superpowers/i);
  // 판정 기준의 정본은 agent 문서 하나다. 스킬은 그쪽을 가리키기만 한다.
  assert.match(md, /agents\/bouncer-reviewer\.md/);
  // 금지 대상은 rubric '섹션'을 스킬로 되옮기는 일이다. agents/bouncer-reviewer.md의
  // 네 rubric 헤딩(Spec compliance / Code quality / Over-engineering / Calibration)과
  // 맨 Rubric 헤딩을 헤딩 앵커로 막되, 본문 산문에서 이름을 언급하는 상호참조는 허용한다.
  assert.doesNotMatch(md, /^\s*#+\s*(Rubric|Spec compliance|Code quality|Over-engineering|Calibration)/mi);
});

test('reviewer-prompt carries Constraints and the rejection half of Interface', () => {
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

test('review reads and records the selected task bundle review document', () => {
  const md = readSkill('review');
  assert.match(md, /pointer task directory.*review\.md|review\.md.*pointer task directory/i);
  assert.match(reviewerPrompt, /tasks\/<NNN>\/tasks\.md/);
});

test('reviewer-prompt flags over-engineering without punishing why-comments', () => {
  assert.match(reviewerPrompt, /Over-engineering/i);
  assert.match(reviewerPrompt, /unrequested abstraction|stdlib|root-cause/i);
  assert.match(reviewerPrompt, /why-comments|thorough why|\bwhy\b/i);
});

test('review rubric flags behavior changes that ship without tests', () => {
  const agent = fs.readFileSync(
    path.join(root, 'agents', 'bouncer-reviewer.md'), 'utf8',
  );
  for (const doc of [reviewerPrompt, agent]) {
    assert.match(doc, /without (a )?test|테스트 없|untested/i);
    assert.match(doc, /minor|major/);
  }
  assert.match(agent, /docs-only|documentation-only|configuration-only|문서만/i);
});
