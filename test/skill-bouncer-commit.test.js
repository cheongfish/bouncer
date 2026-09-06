'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { checkDocShape } = require('../scripts/check-doc-shape');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-commit', 'SKILL.md'), 'utf8');

function assertShape(document, contract) {
  const result = checkDocShape(document, contract);
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
  return result.shape;
}

test('bouncer-commit is an explicit-ask workflow skill', () => {
  const { data, body } = parseFrontmatter(md);
  assertShape(md, { frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-commit' } } });
  assert.strictEqual(data.name, 'bouncer-commit');
  assert.match(String(data.description), /^Use only when the user explicitly asks \/bouncer-commit/);
  assert.match(body, /bouncer commit --blueprint <pointer\.blueprint>/);
  assert.doesNotMatch(body, /validate\s+--gate\s+commit/);
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
  assert.match(body, /\bbouncer\s+current\b/);
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


test('bouncer-commit runs its gate once before Commit ACQ and leaves statuses to execute', () => {
  const { body } = parseFrontmatter(md);
  const dryRun = body.indexOf('bouncer commit --blueprint <pointer.blueprint>');
  const commitAcq = body.indexOf('**AskUserQuestion — Commit**');
  const yes = body.indexOf('bouncer commit --blueprint <pointer.blueprint> --yes');

  assert.strictEqual((body.match(/^\s*bouncer commit --blueprint <pointer\.blueprint>$/gm) || []).length, 1);
  assert.ok(dryRun >= 0, 'scope dry-run is the single authoritative preflight');
  assert.ok(dryRun < commitAcq, 'Commit ACQ follows the successful preflight');
  assert.ok(commitAcq < yes, 'Commit ACQ precedes --yes');
  assert.doesNotMatch(body, /Status before commit|Set the pointer task documents|tasks → verified|verification → passed|review → accepted/);
});

test('bouncer-commit keeps Commit and Next-task ACQ in steps 2 and 3 with an index', () => {
  assertShape(md, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: { required: [1, 2, 3, 4], order: true, acq: [2, 3], acqOptions: [2, 3] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [2, 3], only: true },
  });
});

test('bouncer-commit keeps a single dry-run gate and pointer confirm-then-set', () => {
  const { body } = parseFrontmatter(md);
  const preamble = body.slice(0, body.search(/^1\. /m));
  assert.doesNotMatch(preamble, /\.\/references\//);
  assert.strictEqual((body.match(/^\s*bouncer commit --blueprint <pointer\.blueprint>$/gm) || []).length, 1);
  assert.match(body, /rules\/current-pointer\.md/);
  assert.match(body, /nextTask/);
  assert.match(body, /\*\*AskUserQuestion — Commit\*\*/);
  assert.match(body, /\*\*AskUserQuestion — Next task\*\*/);
});
