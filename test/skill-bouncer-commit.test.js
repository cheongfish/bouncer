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
  assert.match(body, /intent_anchor/);
  assert.match(body, /EPIC-<ddd>\/BP-<ddd>\/TASK-<ddd>/);
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

// abort 규칙은 payload.recovery와 CLI 정본이 들고, commit 범위 경계는
// `rules/commit-scope.md`가 든다. 본문은 두 책임을 각각 가리키고 규칙을 다시 쓰지
// 않는다 — 한 인용으로 뭉치면 CLI 결과 처리와 scope 판정이 같은 정본처럼 읽힌다.
test('bouncer-commit splits the commit-scope boundary from the CLI result contract', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /recovery\.action/);
  assert.match(body, /rules\/commit-scope\.md/);
  assert.match(body, /rules\/cli\.md/);
  assert.doesNotMatch(body, /rules\/governance\.md/);

  // 범위 경계는 step 1, CLI 결과 계약은 step 5에서 읽는다.
  const step1 = body.slice(body.indexOf('1. **Current.**'), body.indexOf('2. **Dry-run.**'));
  assert.match(step1, /rules\/commit-scope\.md/);
  const step5 = body.slice(body.indexOf('5. **Handoff.**'));
  assert.match(step5, /rules\/cli\.md/);
});

test('bouncer-commit routes on commit payload fields instead of restating CLI behavior', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\bcontroller\b/);
  assert.match(body, /nextAction/);
  assert.match(body, /stampPath/);
});

test('bouncer-commit keeps five numbered steps and indexes only the pointer ACQ', () => {
  assertShape(md, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: { required: [1, 2, 3, 4, 5], order: true, acq: [5], acqOptions: [5] },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [5], only: true },
  });
  const { body } = parseFrontmatter(md);
  const index = body.slice(body.indexOf('\n## ACQ (AskUserQuestion) gates\n'));
  assert.match(index, /Step 5 — Next task/);
  assert.doesNotMatch(index, /Step 4 — Commit/);
  assert.match(body, /rules\/acq\.md/);
});
