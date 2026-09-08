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

test('bouncer-commit does not invent CLI or a second consent step', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\bbouncer\s+current\b/);
  assert.doesNotMatch(md, /superpowers|okf-authoring/i);
  // commit ACQ는 없어졌다 — 남아 있으면 coordinator가 물을 수 없는 질문이 된다.
  assert.doesNotMatch(body, /\*\*AskUserQuestion — Commit\*\*/);
  assert.match(body, /asks\s*\n?\s*no AskUserQuestion/);
  assert.match(body, /start ACQ already covers every task it\s*\n?\s*drives/);
  // 포인터 전진은 drive 밖에서 여전히 confirm-then-set이다 —
  // rules/current-pointer.md가 그렇게 말하고 이 스킬이 그 규칙을 인용한다.
  assert.match(body, /\*\*AskUserQuestion — Next task\*\*/);
  assert.match(body, /\*\*Options\*\*:/);
  assert.match(body, /not consent for a pointer advance/);
});

test('bouncer-commit delegates pointer selection and confirm-then-set invariants', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /rules\/current-pointer\.md/);
  assert.match(body, /nextTask/);
});

test('bouncer-commit forbids discarding the post-commit tasks.md commit_sha stamp', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /commit_sha/);
  assert.match(body, /task_commits/);
  assert.match(body, /do not[\s\S]{0,80}(?:git checkout|git restore|discard)/i);
});

test('bouncer-commit runs its gate once before --yes and leaves statuses to execute', () => {
  const { body } = parseFrontmatter(md);
  const dryRun = body.indexOf('bouncer commit --blueprint <pointer.blueprint>');
  const yes = body.indexOf('bouncer commit --blueprint <pointer.blueprint> --yes');

  assert.strictEqual((body.match(/^\s*bouncer commit --blueprint <pointer\.blueprint>$/gm) || []).length, 1);
  assert.ok(dryRun >= 0, 'scope dry-run is the single authoritative preflight');
  assert.ok(dryRun < yes, 'the dry-run precedes --yes');
  assert.doesNotMatch(body, /Status before commit|Set the pointer task documents|tasks → verified|verification → passed|review → accepted/);
});

// worker는 자기 branch에 커밋만 하고 멈춘다. fan-in은 coordinator의 것이다.
test('bouncer-commit stops at the worker branch and leaves fan-in to the coordinator', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /worker worktree `coordinate prepare` assigned/);
  assert.match(body, /never\s*\n?\s*`git -C`, never the main checkout/);
  assert.match(body, /read-only provenance/);
  assert.match(body, /coordinate\s*\n?record` then `integrate`/);
  assert.match(body, /never this skill's, and never a worker's/);
  assert.match(body, /task SHA on the worker branch/);
  assert.match(body, /verifies the integration\s*\n?\s*head/);
  assert.match(body, /An unverified fan-in is not a completed task/);
  assert.match(body, /no worker moves it and no worker touches the\s*\n?\s*integration branch/);
});

// drift는 여기서 affected_paths를 고쳐 통과시키는 것이 아니라 coordinator 판정이다.
test('bouncer-commit routes an out-of-scope abort to coordinate revise', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /hard abort — nothing staged/);
  assert.match(body, /coordinator ledger's\s*\n?\s*scope for this revision/);
  assert.match(body, /not the approval snapshot/);
  assert.match(body, /one `bouncer coordinate revise`\s*\n?\s*decision/);
});

test('bouncer-commit keeps four numbered steps and indexes only the pointer ACQ', () => {
  assertShape(md, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: { required: [1, 2, 3, 4], order: true, acq: [3], acqOptions: [3] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [3], only: true },
  });
  const { body } = parseFrontmatter(md);
  const index = body.slice(body.indexOf('\n## ACQ (AskUserQuestion) gates\n'));
  assert.match(index, /Step 3 — Next task/);
  assert.doesNotMatch(index, /Step 2 — Commit/);
  assert.match(body, /rules\/acq\.md/);
});
