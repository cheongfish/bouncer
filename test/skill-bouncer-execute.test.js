'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-execute', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-execute');

test('bouncer-execute conditionally routes dispatch and verify recovery references', () => {
  const { body } = parseFrontmatter(mainMd);
  const routes = [
    [
      'agent-dispatch.md',
      'When dispatching a named agent or applying its fallback, read this reference.',
    ],
    [
      'verification-recovery.md',
      'On verify failure, when recovering through debugger then implementer, read this reference.',
    ],
  ];
  for (const [file, condition] of routes) {
    assert.match(body, new RegExp(`\\[${file.replace('.', '\\.') }\\]`));
    const reference = fs.readFileSync(path.join(root, 'skills', 'bouncer-execute', 'references', file), 'utf8');
    assert.ok(reference.startsWith(condition), `${file} must declare its exact loading condition first`);
  }
  assert.match(body, /current\.task\.path/);
  assert.match(body, /G6[\s\S]{0,300}G14/);
  assert.doesNotMatch(body, /agentName:'bouncer-implementer'|Minimum fix proposal/);
});

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
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  assert.match(body, /bouncer-implementer/);
  assert.match(dispatch, /rules\/subagent-model\.md/);
  assert.match(body, /controller/i);
  assert.match(body, /commit-safety|git commit/i);
});

test('bouncer-execute step 4 dispatches bouncer-debugger on verify failure', () => {
  const { body } = parseFrontmatter(md);
  const recovery = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/verification-recovery.md'), 'utf8');
  assert.match(body, /bouncer-debugger/);
  assert.match(recovery, /rules\/subagent-model\.md/);
  // Hosts that cannot load named agents must keep an inline/generic fallback.
  assert.match(recovery, /debugging.*inline|generic.*read-only/i);
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
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  assert.match(body, /references\/review\/assets\/reviewer-prompt\.md/);
  assert.match(body, /bouncer-reviewer/);
  assert.match(dispatch, /rules\/subagent-model\.md/);
  assert.match(dispatch, /fresh generic|generic.*subagent/i);
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

test('bouncer-execute step 1 excludes scope_evidence from brief injection', () => {
  const { body } = parseFrontmatter(md);
  // 계획 근거 감사 전용 필드라 step 1 읽기에서만 뺀다. 문서 삭제는 G4가 막는다.
  assert.match(body, /scope_evidence[\s\S]{0,200}(주입|읽기)[\s\S]{0,40}제외/);
});

test('bouncer-execute hands off to /bouncer-commit and reuses an existing worktree', () => {
  const { body } = parseFrontmatter(md);
  // 커밋 지시는 /bouncer-commit으로 옮김 — execute에 남은 긍정 안내로 고정.
  assert.match(body, /\/bouncer-commit/);
  assert.match(body, /re-?use|이미 있으면|already exists|공유/i);
});

test('bouncer-execute inlines implementer only on the light path', () => {
  const { body } = parseFrontmatter(md);
  // 경량 판정은 포인터 응답의 scale — blueprint index.md 를 다시 열지 않는다.
  assert.match(body, /포인터\(`bouncer current`\)의 `scale`이 `light`면/);
  assert.match(body, /인라인/);
  // 리뷰는 경량에서도 named — step 5 경량 인라인 분기가 없어야 한다.
  assert.doesNotMatch(body, /`scale`이 `light`면[\s\S]{0,200}인라인 read-only/);
  // fallback 문구는 남아야 한다 — 경량 분기가 그것을 대체하면 G8이 막힌다.
  assert.match(body, /named agents are unavailable|미지원/i);
  // debugger는 축소 대상이 아니다.
  assert.match(body, /bouncer-debugger/);
});

test('bouncer-execute step 3 light branch cites pointer scale', () => {
  const { body } = parseFrontmatter(md);
  const matches = body.match(/포인터\(`bouncer current`\)의 `scale`이 `light`면/g);
  assert.strictEqual(matches && matches.length, 1);
  assert.doesNotMatch(body, /blueprint `index\.md`의 `bouncer\.scale`/);
});
