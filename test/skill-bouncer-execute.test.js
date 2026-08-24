'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');

const root = path.join(__dirname, '..');
const md = fs.readFileSync(path.join(root, 'skills', 'bouncer-execute', 'SKILL.md'), 'utf8');

test('bouncer-execute wires worktree, skills, scope, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assert.ok(data.description.length > 0);
  assert.match(body, /scripts\/bouncer"\s+current\b/);
  assert.match(body, /worktree/i);
  assert.match(body, /<type>\/<BP-id>-<slug>/);
  assert.match(body, /commit_type/);
  assert.match(body, /\.gitmessage|feat.*fix.*docs|refactor.*test.*chore/);
  assert.match(body, /runtime-state/);
  assert.match(body, /worktreePathFor/);
  assert.doesNotMatch(body, /ensureWorktreeRoot/);
  assert.match(body, /\.worktrees\/<epic-id>\/<bp-id>/);
  assert.doesNotMatch(body, /\.bouncer\/worktrees/);
  assert.doesNotMatch(body, /already gitignored|ignored in-repo worktree/i);
  assert.match(body, /implementation/);
  assert.match(body, /verification/);
  assert.match(body, /review/);
  assert.match(body, /minimality/);
  assert.match(body, /debugging/);
  assert.match(body, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
  assert.match(body, /commit-safety|affected_paths/);
  assert.match(body, /scripts\/bouncer"\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+execute\b/);
  assert.match(body, /harness.*record|validate.*configured verify command/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|verification-adapter|review-adapter/i);
});

test('bouncer-execute step 2 seeds the worktree with the plan documents', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /seed-worktree/);
  assert.match(body, /--to\s+"\$\{WORKTREE_PATH\}"/);
  // The command reads the base checkout, so it must run before the cwd switch.
  assert.ok(
    body.indexOf('seed-worktree') > body.indexOf('git worktree add'),
    'seed-worktree must be documented after git worktree add',
  );
  assert.match(body, /tasks\.md/);
});

test('bouncer-execute step 3 routes implementation through bouncer-implementer', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer-implementer/);
  assert.match(body, /resolveSubagentModel/);
  assert.match(body, /inherit/);
  assert.match(body, /controller/i);
  assert.match(body, /commit-safety|git commit/i);
});

test('bouncer-execute step 4 dispatches bouncer-debugger on verify failure', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer-debugger/);
  assert.match(body, /resolveSubagentModel/);
  assert.match(body, /inherit/);
  // Named-unsupported hosts (e.g. Codex) must keep an inline/generic fallback.
  assert.match(body, /named agents are unavailable|fall back|inline/i);
  assert.match(body, /debugging/);
});

test('bouncer-execute re-dispatches implementer with the debugger report after verify failure', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Then dispatch \*\*`bouncer-implementer`\*\*|then re-dispatches `bouncer-implementer`/);
  assert.match(body, /Minimum fix proposal/);
  assert.match(body, /Required regression test/);
  assert.match(body, /evidence/);
  // Sequential after debugger, not a parallel second implementer.
  assert.match(body, /sequential/);
});

test('bouncer-execute step 5 dispatches reviewer-prompt via bouncer-reviewer', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /skills\/review\/assets\/reviewer-prompt\.md/);
  assert.match(body, /bouncer-reviewer/);
  assert.match(body, /resolveSubagentModel/);
  assert.match(body, /inherit/);
  assert.match(body, /fresh generic|generic.*subagent/i);
  assert.match(body, /controller/i);
  assert.match(body, /## Findings/);
  assert.match(body, /bouncer\.review\.findings/);
  assert.match(body, /review\s*→\s*accepted|set\s*`?review\s*→\s*accepted/i);
  assert.match(body, /required\s*===\s*false|required === false/i);
  assert.match(body, /inline|no subagent/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|verification-adapter|review-adapter/i);
});

test('bouncer-execute caps review round-trips at 2 and escalates', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /at most \*\*2\*\* review round-trips/);
  assert.match(body, /round-trips[\s\S]{0,200}\/bouncer-plan/);
  // 상한을 accepted 전환으로 빠져나가면 G8이 헛통과함.
  assert.match(body, /never flip[\s\S]{0,80}accepted/);
});

test('bouncer-execute preflight reads project Distill', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /\.bouncer\/Distill\.md/);
  assert.match(body, /Read/i);
});

test('bouncer-execute uses the pointer task document as the brief', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /current\.task\.path/);
  assert.match(body, /Task brief|task brief|포인터.*task|pointer task brief/i);
  assert.match(body, /null/);
  assert.match(body, /pointer task directory.*verification\.md|verification\.md.*pointer task directory/i);
  assert.match(body, /pointer task directory.*review\.md|review\.md.*pointer task directory/i);
});

test('bouncer-execute hands off to /bouncer-commit and reuses an existing worktree', () => {
  const { body } = parseFrontmatter(md);
  // 커밋 지시는 /bouncer-commit으로 옮김 — execute에 남은 긍정 안내로 고정.
  assert.match(body, /\/bouncer-commit/);
  assert.match(body, /re-?use|이미 있으면|already exists|공유/i);
});

test('bouncer-execute inlines implementer and reviewer on the light path', () => {
  const { body } = parseFrontmatter(md);
  // 경량 판정은 포인터 응답의 scale — blueprint index.md 를 다시 열지 않는다.
  assert.match(body, /포인터\(`bouncer current`\)의 `scale`이 `light`면/);
  assert.match(body, /인라인/);
  // fallback 문구는 남아야 한다 — 경량 분기가 그것을 대체하면 G8이 막힌다.
  assert.match(body, /named agents are unavailable|미지원/i);
  // debugger는 축소 대상이 아니다.
  assert.match(body, /bouncer-debugger/);
});

test('bouncer-execute step 3 and step 5 light branches cite pointer scale', () => {
  const { body } = parseFrontmatter(md);
  const matches = body.match(/포인터\(`bouncer current`\)의 `scale`이 `light`면/g);
  assert.strictEqual(matches && matches.length, 2);
  assert.doesNotMatch(body, /blueprint `index\.md`의 `bouncer\.scale`/);
});
