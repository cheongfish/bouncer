'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { checkDocShape } = require('../scripts/check-doc-shape');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-execute', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-execute');

function assertShape(document, contract) {
  const result = checkDocShape(document, contract);
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
  return result.shape;
}

test('bouncer-execute conditionally routes dispatch and verify recovery references', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    filePath: path.join(root, 'skills', 'bouncer-execute', 'SKILL.md'),
    links: [
      { href: './references/agent-dispatch.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['dispatch', 'fallback'] } },
      { href: './references/verification-recovery.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['verify', 'recover'] } },
    ],
  });
  const routes = ['agent-dispatch.md', 'verification-recovery.md'];
  for (const file of routes) {
    assert.match(
      body,
      new RegExp(`\\]\\(\\.\\/references\\/${file.replace(/\./g, '\\.')}\\)`),
      `${file} must be linked as ./references/${file}`,
    );
  }
  assert.match(body, /current\.task\.path/);
  assert.match(body, /CLI owns verification evidence and execute-gate checks/);
  assert.match(body, /validator code, cause,\n?\s*path, and recovery action/);
  assert.doesNotMatch(body, /agentName:'bouncer-implementer'|Minimum fix proposal/);
});

test('bouncer-execute rejects generic conditional loads for each routed reference', () => {
  const routes = [
    {
      href: './references/agent-dispatch.md',
      triggers: ['dispatch', 'fallback'],
      source: 'When dispatching a named agent or applying its fallback, apply',
    },
    {
      href: './references/verification-recovery.md',
      triggers: ['verify', 'recover'],
      source: '**On verify failure**, when recovering through debugger then implementer,',
    },
  ];
  for (const route of routes) {
    const releaseRoute = mainMd.replaceAll(route.source, 'When publishing a release,');
    const result = checkDocShape(releaseRoute, {
      filePath: path.join(root, 'skills', 'bouncer-execute', 'SKILL.md'),
      links: [{ href: route.href, resolve: true, referencePreamble: true, conditionalLoad: { triggers: route.triggers } }],
    });
    assert.strictEqual(result.ok, false, route.href);
    assert.match(result.errors.join('; '), /semantic trigger/);
  }
});

test('bouncer-execute uses root/local reference prefixes and states no-question in procedure', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: {
      required: [1, 2, 3, 4, 5, 6],
      order: true,
      noAcq: true,
      links: {
        3: ['./references/agent-dispatch.md'],
        4: ['./references/verification-recovery.md'],
        5: ['./references/agent-dispatch.md'],
      },
    },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [], only: true },
  });
  const acqAt = body.indexOf('\n## ACQ (AskUserQuestion) gates\n');
  assert.ok(acqAt > -1);
  const procedure = body.slice(0, acqAt);
  const index = body.slice(acqAt);
  assert.match(
    procedure,
    /no AskUserQuestion|does not ask[\s\S]{0,40}AskUserQuestion|never asks[\s\S]{0,40}AskUserQuestion/i,
  );
  assert.match(index, /no ACQ|does not ask|never asks|no AskUserQuestion/i);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/implementation\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/verification\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/review\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/minimality\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/debugging\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/review\/assets\/reviewer-prompt\.md/);
  assert.match(body, /\.\/references\/agent-dispatch\.md/);
  assert.match(body, /\.\/references\/verification-recovery\.md/);
  assert.doesNotMatch(
    body,
    /(?<!\$\{BOUNCER_ROOT\}\/|\.\/)references\/(?:implementation|verification|review|minimality|debugging)\//,
  );
});

test('bouncer-execute wires worktree, skills, scope, and execute gate', () => {
  const { data, body } = parseFrontmatter(md);
  assertShape(md, { frontmatter: { required: ['name', 'description'], values: { name: 'bouncer-execute' } } });
  assert.ok(data.description.length > 0);
  assert.match(body, /\bbouncer\s+current\b/);
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
  assert.match(body, /commit-safety|affected_paths/);
  assert.match(body, /\bbouncer\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+execute\b/);
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
});

test('bouncer-execute consumes seed config status and warns when missing', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /`copied`[\s\S]{0,80}`preserved`[\s\S]{0,80}`missing`/);
  assert.match(body, /config[\s\S]{0,120}missing[\s\S]{0,160}(default allowlist|기본 allowlist)/i);
  assert.match(body, /warn(?:ing)?|경고/i);
});

test('bouncer-execute step 3 routes implementation through bouncer-implementer', () => {
  const { body } = parseFrontmatter(md);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  assert.match(body, /bouncer-implementer/);
  assert.match(dispatch, /rules\/subagent-model\.md/);
  assert.match(body, /controller/i);
  assert.match(body, /commit-safety|git commit/i);
});

test('bouncer-execute compacts only a synchronized fresh named implementer payload', () => {
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const named = dispatch.match(/## Named implementer[\s\S]*?(?=\n## )/)?.[0] || '';

  assert.match(named, /mdToCodexToml\(\)/);
  assert.match(named, /# bouncer-generated/);
  assert.match(named, /byte-for-byte|exact match/i);
  assert.match(named, /new named dispatch|fresh named dispatch/i);
  assert.match(named, /cwd|worktree/i);
  assert.match(named, /Goal & intent[\s\S]*Interface[\s\S]*Touch[\s\S]*Do\s+not touch[\s\S]*Constraints[\s\S]*Checklist/);
  assert.doesNotMatch(named, /Prior commit subjects/i);
  assert.doesNotMatch(named, /Hard guards|tests-first|Output contract/i);
});

test('bouncer-execute keeps full implementer guards for every compact-payload fallback', () => {
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const fallback = dispatch.match(/## Implementer fallback[\s\S]*?(?=\n## |$)/)?.[0] || '';

  assert.match(fallback, /mismatch|user-owned|unavailable/i);
  assert.match(fallback, /Authority[\s\S]*Hard guards[\s\S]*tests-first[\s\S]*comments[\s\S]*Output contract/i);
  assert.match(fallback, /Goal & intent[\s\S]*Interface[\s\S]*Touch[\s\S]*Do\s+not touch[\s\S]*Constraints[\s\S]*Checklist/);
  assert.match(fallback, /status[\s\S]{0,80}commit|commit[\s\S]{0,80}status/i);
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
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/review\/assets\/reviewer-prompt\.md/);
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

test('bouncer-execute allows a conditional third review round then stops', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /round <= 2/);
  assert.match(body, /round == 3/);
  assert.match(body, /previous blocker\/major findings are resolved/);
  assert.match(body, /latest verify passed/);
  assert.match(body, /new actionable findings fit Goal, Interface, Constraints, affected_paths/);
  assert.match(body, /Never start a fourth|네 번째/);
  assert.match(body, /never flip[\s\S]{0,80}accepted/);
});

test('bouncer-execute replans instead of deferring accuracy findings', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Do not classify[\s\S]{0,80}deferred|deferred[\s\S]{0,80}accuracy/i);
  assert.match(body, /\/bouncer-plan/);
  assert.match(body, /regresses|재발/);
});

test('bouncer-execute records each review round ledger in review.md', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer\.review\.rounds/);
  assert.match(body, /previous finding IDs|previous_finding_ids/);
  assert.match(body, /new[\s\S]{0,40}resolved[\s\S]{0,40}regressed/);
  assert.match(body, /review\.md/);
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
});

test('bouncer-execute step 1 excludes scope_evidence from brief injection', () => {
  const { body } = parseFrontmatter(md);
  // 계획 근거 감사 전용 필드라 step 1 읽기에서만 뺀다. 문서 삭제는 G4가 막는다.
  assert.match(body, /exclude[\s\S]{0,60}scope_evidence[\s\S]{0,80}(read|inject)/i);
});

test('bouncer-execute hands off to /bouncer-commit and reuses an existing worktree', () => {
  const { body } = parseFrontmatter(md);
  // 커밋 지시는 /bouncer-commit으로 옮김 — execute에 남은 긍정 안내로 고정.
  assert.match(body, /\/bouncer-commit/);
  assert.match(body, /re-?use|already exists|share/i);
});

test('bouncer-execute inlines implementer only on the light path', () => {
  const { body } = parseFrontmatter(md);
  // 경량 판정은 포인터 응답의 scale — blueprint index.md 를 다시 열지 않는다.
  assert.match(body, /pointer \(`bouncer current`\) `scale` is `light`/);
  assert.match(body, /inline/i);
  // 리뷰는 경량에서도 named — step 5 경량 인라인 분기가 없어야 한다.
  assert.doesNotMatch(body, /`scale` is `light`[\s\S]{0,200}inline read-only/);
  // fallback 문구는 남아야 한다 — 경량 분기가 그것을 대체하면 G8이 막힌다.
  assert.match(body, /named agents are unavailable|unavailable/i);
  // debugger는 축소 대상이 아니다.
  assert.match(body, /bouncer-debugger/);
});

test('bouncer-execute step 3 light branch cites pointer scale', () => {
  const { body } = parseFrontmatter(md);
  const matches = body.match(/pointer \(`bouncer current`\) `scale` is `light`/g);
  assert.strictEqual(matches && matches.length, 1);
  assert.doesNotMatch(body, /blueprint `index\.md`의 `bouncer\.scale`/);
});

test('bouncer-execute loads debugging only on the verify-failure recovery path', () => {
  const { body } = parseFrontmatter(mainMd);
  const step4 = body.indexOf('4. **Verify.**');
  const debugCite = body.indexOf('${BOUNCER_ROOT}/references/debugging/index.md');
  assert.ok(step4 >= 0, 'step 4 owns verify-failure recovery');
  assert.ok(debugCite >= step4, 'debugging/index.md belongs on the verify-failure path');
  assert.match(body.slice(step4), /On verify failure/);
  const preamble = body.slice(0, body.search(/^1\. /m));
  assert.doesNotMatch(preamble, /debugging\/index\.md/);
  assert.doesNotMatch(preamble, /minimality\/index\.md/);
  assert.doesNotMatch(preamble, /Root cause → Pattern → Hypothesis → Implementation/);
});

// 실행 시작 경고와 모호성·레거시 충돌 중단은 step 1 계약이다. 다중 후보는
// null이 아니다. compact 한 줄은 selected만, debug JSON도 이 슬라이스만 본다.
// 본문 전체 /debug/i는 뒤쪽 debugger 토큰에 이미 통과한다.
test('bouncer-execute step 1 warns the selected pointer and stops on CURRENT_AMBIGUOUS', () => {
  const { body } = parseFrontmatter(mainMd);
  const step1At = body.indexOf('1. **Read the pointer.**');
  const step1 = body.slice(step1At, body.indexOf('2. **Worktree.**'));
  assert.ok(step1At >= 0, 'step 1 owns pointer read');
  assert.match(step1, /\bbouncer\s+current\b/);
  assert.match(step1, /blueprint/);
  assert.match(step1, /\btask\b/);
  assert.match(step1, /\bbase\b/);
  assert.match(step1, /Git common directory/);
  assert.match(step1, /CURRENT_AMBIGUOUS/);
  assert.match(step1, /CURRENT_INVALID/);
  assert.match(step1, /stop|중단/i);
  assert.doesNotMatch(step1, /CURRENT_AMBIGUOUS[\s\S]{0,120}current(?:`|\s+is)?\s*`?null/i);
  assert.doesNotMatch(step1, /scripts\/lib\/current|bouncer\/pointers/);
  assert.match(step1, /debug/i);
  assert.match(step1, /`selected`[\s\S]{0,200}\{ blueprint, task, base \}/);
  assert.match(step1, /null[\s\S]{0,160}no selection|no selection[\s\S]{0,80}null/i);
});

test('bouncer-execute uses the worktree-local CLI pointer and does not share one pointer across linked worktrees', () => {
  const { body } = parseFrontmatter(mainMd);
  assert.match(body, /worktree-local|corresponding namespace|cwd[\s\S]{0,80}bouncer current/i);
  assert.doesNotMatch(body, /observe the main worktree's\s+active pointer/);
  assert.doesNotMatch(body, /linked worktree[\s\S]{0,80}same CLI result|same CLI result[\s\S]{0,80}worktree/i);
  assert.doesNotMatch(body, /scripts\/lib\/current/);
});


// coordinator drive에서는 이 스킬이 한 task의 라운드다. 순서와 소유자가
// 문서에 없으면 위임받은 쪽이 스스로 구현자를 겸하고 리뷰가 자기 diff를 본다.
test('bouncer-execute runs the implement/debug/review round under the coordinator', () => {
  const { body } = parseFrontmatter(mainMd);
  const role = body.match(/\*\*Controller\.\*\*([\s\S]*?)(?=\n\*\*Project root)/)?.[1] || '';
  assert.ok(role.length > 0, 'execute must name who controls the round');
  assert.match(role, /bouncer-coordinator/);
  assert.match(
    role,
    /bouncer-implementer[\s\S]{0,60}verify[\s\S]{0,60}bouncer-debugger[\s\S]{0,80}bouncer-implementer[\s\S]{0,60}bouncer-reviewer/,
  );
  assert.match(role, /never plays those roles itself/);
  assert.match(role, /returned to the coordinator/);
  assert.match(role, /does not re-read the diff/);
});

// worktree는 coordinator가 배정한다. execute가 또 하나 만들면 커밋 안전
// 경계 밖에서 라운드가 돈다.
test('bouncer-execute does not create a worktree during a coordinator drive', () => {
  const { body } = parseFrontmatter(mainMd);
  const step2 = body.slice(body.indexOf('2. **Worktree.**'), body.indexOf('3. **Implement'));
  assert.match(step2, /Under a coordinator drive, skip this step/);
  assert.match(step2, /coordinate\s*\n?\s*prepare/);
});

// drift는 서술이 아니라 CLI 호출로 기록된다. 그리고 그 표면은 하나뿐이다.
test('bouncer-execute records scope drift with coordinate revise, not prose', () => {
  const exec = readWorkflowBundle('bouncer-execute');
  assert.match(exec, /bouncer coordinate revise --blueprint <dir> --task <NNN>/);
  assert.match(exec, /--paths <p> \[--paths <p>…\]/);
  assert.match(exec, /--reason <r>/);
  assert.match(exec, /one surface that revises scope/);
  assert.match(exec, /Scope impact/);
  // 라운드 상한을 넘긴 실패는 계획 후퇴가 아니라 coordinator 판정으로 간다.
  assert.match(exec, /not a return to `\/bouncer-plan`/);
  assert.match(exec, /hand the coordinator the open findings to\s*\n?\s*disposition/);
  assert.match(exec, /unresolved\s*\n?\s*finding is never recorded\s*\n?\s*as done/);
  assert.doesNotMatch(exec, /escalate to architecture/);
});

// worker payload는 배정된 worktree와 개정된 brief만 받는다.
test('bouncer-execute pins the worker payload to the assigned worktree and revised brief', () => {
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  assert.match(dispatch, /task worktree `bouncer coordinate\s*\n?\s*prepare` assigned/);
  assert.match(dispatch, /never the integration worktree and never the main checkout/);
  assert.match(dispatch, /not the approval snapshot/);
  assert.match(dispatch, /ledger, and other workers' reports stay out of the payload/);
});

test('bouncer-execute verify recovery hands a repeat failure to the coordinator', () => {
  const recovery = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/verification-recovery.md'), 'utf8');
  assert.match(recovery, /do not retreat to `\/bouncer-plan` mid-drive/);
  assert.match(recovery, /exactly one recorded decision/);
  assert.match(recovery, /terminal blocked/);
  assert.match(recovery, /bouncer coordinate revise/);
});
