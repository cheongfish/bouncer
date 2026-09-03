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
  assert.match(String(data.description), /^Use only when the user explicitly asks \/bouncer-commit/);
  assert.match(body, /validate\s+--gate\s+commit/);
  assert.match(body, /bouncer"\s+commit[\s\S]*--yes|commit\s+--blueprint[\s\S]*--yes/);
  // commit 게이트 계약(존재) + explain-diff 호출 부재 — 부재만 두면 금지 문구가 매칭을 깨뜨림
  assert.match(body, /G6\/G7\/G8/);
  assert.match(body, /G17/);
  assert.doesNotMatch(body, /skills\/explain-diff\/SKILL\.md/);
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

test('bouncer-commit delegates pointer selection and confirm-then-set invariants', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /rules\/current-pointer\.md/);
  assert.match(body, /nextTask/);
  assert.match(body, /ACQ/);
});

test('bouncer-commit forbids discarding the post-commit tasks.md commit_sha stamp', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /commit_sha/);
  assert.match(body, /task_commits/);
  assert.match(body, /do not[\s\S]{0,80}(?:git checkout|git restore|discard)/i);
});

/**
 * @param {string} body
 * @param {number} n
 * @returns {string}
 */
function commitStepBody(body, n) {
  const start = body.search(new RegExp(`^${n}\\. \\*\\*`, 'm'));
  assert.ok(start > -1, `missing commit step ${n}`);
  const rest = body.slice(start);
  const next = rest.search(new RegExp(`\\n(?:${n + 1}\\. \\*\\*|## ACQ )`, 'm'));
  return next === -1 ? rest : rest.slice(0, next);
}

test('bouncer-commit keeps Commit and Next-task ACQ in steps 4 and 5 with an index', () => {
  const { body } = parseFrontmatter(md);
  const acqAt = body.indexOf('\n## ACQ (AskUserQuestion) gates\n');
  assert.ok(acqAt > -1);
  const index = body.slice(acqAt);
  assert.match(index, /[Ss]tep\s+4/);
  assert.match(index, /[Ss]tep\s+5/);
  assert.doesNotMatch(index, /\*\*AskUserQuestion/);
  assert.doesNotMatch(index, /\*\*Options\*\*:/);
  assert.match(commitStepBody(body, 4), /\*\*AskUserQuestion — Commit\*\*/);
  assert.match(commitStepBody(body, 4), /\*\*Options\*\*:/);
  assert.match(commitStepBody(body, 5), /\*\*AskUserQuestion — Next task\*\*/);
  assert.match(commitStepBody(body, 5), /\*\*Options\*\*:/);
});
