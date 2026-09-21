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
      { href: './references/review-round.md', resolve: true, referencePreamble: true, conditionalLoad: { triggers: ['review', 'round'] } },
    ],
  });
  const routes = ['agent-dispatch.md', 'verification-recovery.md', 'review-round.md'];
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
    {
      href: './references/review-round.md',
      triggers: ['review', 'round'],
      source: 'When a review round may start or stop, read',
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
        5: ['./references/review-round.md'],
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
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/debugging\/index\.md/);
  assert.match(body, /\.\/references\/agent-dispatch\.md/);
  assert.match(body, /\.\/references\/verification-recovery\.md/);
  assert.match(body, /\.\/references\/review-round\.md/);
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
  assert.match(body, /\bbouncer execute prepare\b/);
  assert.match(body, /worktreePath/);
  assert.match(body, /git -C/);
  assert.doesNotMatch(body, /<type>\/<BP-id>-<slug>/);
  assert.doesNotMatch(body, /worktreePathFor/);
  assert.doesNotMatch(body, /ensureWorktreeRoot/);
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

test('bouncer-execute step 2 prepares the worktree with one CLI command', () => {
  const { body } = parseFrontmatter(mainMd);
  const step2 = body.slice(body.indexOf('2. **Prepare.**'), body.indexOf('3. **Implement'));
  assert.match(step2, /\bbouncer execute prepare --blueprint <pointer\.blueprint>/);
  assert.match(step2, /payload `worktreePath`/);
  assert.match(step2, /Do \*\*not\*\*\s*\n?\s*run `git -C/);
  assert.doesNotMatch(step2, /git worktree add/);
  assert.doesNotMatch(step2, /seed-worktree/);
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
  assert.match(
    named,
    /Goal & intent[\s\S]*Current behavior[\s\S]*Target behavior[\s\S]*Interface[\s\S]*Touch[\s\S]*Do\s+not touch[\s\S]*Constraints[\s\S]*Checklist/,
  );
  assert.doesNotMatch(named, /Prior commit subjects/i);
  assert.doesNotMatch(named, /Hard guards|tests-first|Output contract/i);
});

test('bouncer-execute keeps full implementer guards for every compact-payload fallback', () => {
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const fallback = dispatch.match(/## Implementer fallback[\s\S]*?(?=\n## |$)/)?.[0] || '';

  assert.match(fallback, /mismatch|user-owned|unavailable/i);
  assert.match(fallback, /Authority[\s\S]*Hard guards[\s\S]*tests-first[\s\S]*comments[\s\S]*Output contract/i);
  assert.match(
    fallback,
    /Goal & intent[\s\S]*Current behavior[\s\S]*Target behavior[\s\S]*Interface[\s\S]*Touch[\s\S]*Do\s+not touch[\s\S]*Constraints[\s\S]*Checklist/,
  );
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

// fallback 문장부터 문단 끝까지만 자른다. 앞의 named dispatch 문장이 같은 입력을
// 이미 나열하므로, 문단 전체를 보면 fallback이 입력을 빠뜨려도 통과한다.
const FALLBACK_START = /(?:When|If)\s+named\s+agents\s+are\s+unavailable/;
function fallbackOf(text) {
  const at = text.search(FALLBACK_START);
  assert.ok(at >= 0, 'missing fallback sentence');
  const rest = text.slice(at);
  const end = rest.indexOf('\n\n');
  return end === -1 ? rest : rest.slice(0, end);
}

// debugger fallback은 역할 문서 전체와 실패 증적, brief 여섯 절, read-only cwd를
// 싣는다. "inline or a fresh generic read-only subagent"만으로는 generic
// subagent가 Procedure gate와 Output contract를 받는다는 보장이 없다.
test('bouncer-execute debugger fallback carries the whole debugger role and its inputs', () => {
  const recovery = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/verification-recovery.md'), 'utf8');
  const fallback = fallbackOf(recovery);
  assert.match(fallback, /entire\s+body\s+of\s+`agents\/bouncer-debugger\.md`/);
  assert.match(fallback, /Authority\s+through\s+Output\s+contract/);
  assert.match(fallback, /first\s+reads\s+`agents\/bouncer-debugger\.md`/);
  assert.match(fallback, /failing\s+verify\s+evidence/);
  assert.match(fallback, /read-only\s+cwd/);
  // 절 이름은 대소문자를 구분하고 단어 경계를 건다 — `Touch`가 "Do not touch"에
  // 걸리면 Touch를 지워도 통과한다.
  for (const section of [/\bGoal & intent\b/, /\bInterface\b/, /(?<!not\s)\bTouch\b/,
    /\bDo\s+not\s+touch\b/, /\bConstraints\b/, /\bChecklist\b/]) {
    assert.match(fallback, section);
  }
});

// reviewer fallback은 두 dispatcher(review step 3, agent-dispatch review 문단)에서
// 모두 역할 문서 전체와 채운 reviewer-prompt를 싣는다. named는 call slot만 받는다.
test('bouncer-execute reviewer fallback carries the whole reviewer role and the filled call slot', () => {
  const review = fs.readFileSync(path.join(root, 'references/review/index.md'), 'utf8');
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const prompt = fs.readFileSync(path.join(root, 'references/review/assets/reviewer-prompt.md'), 'utf8');
  // 두 문단 모두 fallback 문장부터만 본다. step 3 앞머리 "Freeze base, HEAD,
  // task-brief revision, and latest verify"와 "resolved model"이 fallback의
  // base·HEAD·verify·mode를 대신 채우면 입력을 지워도 통과한다.
  const step3 = fallbackOf(review.slice(review.indexOf('3. **Review**')));
  const dispatchReview = fallbackOf(dispatch.slice(dispatch.indexOf('For review,')));
  for (const [label, text] of [['review step 3', step3], ['agent-dispatch review', dispatchReview]]) {
    assert.match(text, /entire\s+body\s+of\s+`agents\/bouncer-reviewer\.md`/, label);
    assert.match(text, /reviewer-prompt/, label);
    assert.match(text, /first\s+reads\s+`agents\/bouncer-reviewer\.md`/, label);
    for (const input of [/\bbase\b/, /\bHEAD\b/, /\btask\s+brief\s+revision\b/, /\bmode\b/,
      /\bperspective\b/, /\blatest\s+verify\b/, /\bprevious\s+findings\b/,
      /\brevision\s+diff\b/, /\bread-only\s+cwd\b/]) {
      assert.match(text, input, label);
    }
    assert.doesNotMatch(text, /same prompt/i, label);
  }
  // call slot 자체도 두 운반 경로의 차이를 적는다.
  assert.match(prompt, /named[\s\S]{0,200}only\s+this\s+(?:filled\s+)?call\s+slot/i);
  assert.match(prompt, /entire\s+body\s+of\s+`agents\/bouncer-reviewer\.md`/);
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

test('bouncer-execute step 5 keeps only review entry conditions and ceilings', () => {
  const { body } = parseFrontmatter(mainMd);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const step5 = body.slice(body.indexOf('5. **Review.**'), body.indexOf('6. **Gate.**'));
  assert.match(step5, /\$\{BOUNCER_ROOT\}\/references\/review\/index\.md/);
  assert.match(step5, /\.\/references\/review-round\.md/);
  assert.match(step5, /required\s*===\s*false|required === false/i);
  assert.match(step5, /one frozen parallel discovery wave[\s\S]*one fix batch[\s\S]*one delta\s*\n?\s*certification/i);
  assert.match(step5, /drive alone may add one\s*\n?\s*critical recovery/i);
  // SEC-001: stop conditions must name risk_flags ↔ task review_risk (fail closed).
  assert.match(
    step5,
    /risk_flags[\s\S]{0,120}review_risk|review_risk[\s\S]{0,120}risk_flags/i,
  );
  assert.match(step5, /fail closed|disagree|mismatch/i);
  assert.doesNotMatch(step5, /reviewer-prompt|bouncer-reviewer|fresh generic|## Findings|bouncer\.review\.findings|review\s*→\s*accepted/i);
  assert.match(dispatch, /rules\/subagent-model\.md/);
  assert.match(dispatch, /fresh generic|generic.*subagent/i);
  assert.match(dispatch, /bouncer-reviewer/);
  assert.doesNotMatch(md, /superpowers|profile-aware|verification-adapter|review-adapter/i);
});

test('bouncer-execute runs one frozen discovery wave and one delta certification', () => {
  const { body } = parseFrontmatter(mainMd);
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  assert.match(body, /\.\/references\/review-round\.md/);
  assert.match(round, /1 freeze[\s\S]*2 discover[\s\S]*3 aggregate[\s\S]*4 fix[\s\S]*5 verify[\s\S]*6 certify/);
  assert.match(round, /must_fix/);
  assert.match(round, /advisory/);
  assert.match(round, /critical recovery/);
  assert.match(round, /blocked/);
  assert.doesNotMatch(round, /round <= 2/);
});

test('bouncer-execute replans instead of deferring accuracy findings', () => {
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  assert.match(round, /Do not classify[\s\S]{0,80}deferred|deferred[\s\S]{0,80}accuracy/i);
  assert.match(round, /\/bouncer-plan/);
  assert.match(round, /blocked/);
});

test('bouncer-execute records each review round ledger in review.md', () => {
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  assert.match(round, /bouncer\.review\.rounds/);
  assert.match(round, /fingerprints/);
  assert.match(round, /severity_changes/);
  assert.match(round, /actionability/);
  assert.match(round, /origin/);
  assert.match(round, /review\.md/);
});

test('bouncer-execute records the drive-only critical recovery convergence sequence', () => {
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  assert.match(round, /discovery\s*→\s*delta\s*→\s*critical_recovery\s*→\s*delta/);
  assert.match(round, /mode:\s*`?critical_recovery`?/);
  assert.match(round, /introduced_by_revision/);
  assert.match(round, /missed_critical[\s\S]{0,160}(blocker|major)/i);
});

// frozen base/head 뒤 CLI가 discovery fan-out을 고른다. controller가 file/line을
// 다시 세거나 path·diff에서 위험을 추측하면 분류기와 round가 갈라진다.
test('bouncer-execute discovers via review-dispatch execute without override', () => {
  const { body } = parseFrontmatter(mainMd);
  const step5 = body.slice(body.indexOf('5. **Review.**'), body.indexOf('6. **Gate.**'));
  assert.match(step5, /review-dispatch execute|review-dispatch/);
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const review = fs.readFileSync(path.join(root, 'references/review/index.md'), 'utf8');
  for (const [label, text] of [
    ['review-round', round],
    ['agent-dispatch', dispatch],
    ['review skill', review],
  ]) {
    assert.match(text, /bouncer review-dispatch execute/, label);
    assert.match(text, /`single`/, label);
    assert.match(text, /`parallel`/, label);
    assert.match(text, /`combined`/, label);
    assert.match(text, /`security`/, label);
    assert.match(text, /ok:\s*false|`ok`:\s*`false`/, label);
    assert.match(
      text,
      /(?:do not|never|stop|halt|abort)[\s\S]{0,160}(?:reviewer|review round|accepted)|(?:reviewer|review round|accepted)[\s\S]{0,100}(?:do not|never|stop|halt|abort)/i,
      label,
    );
  }
  // CLI perspectives 순서를 그대로 쓰고, file/line 재계산·위험 추측으로 덮지 않는다.
  assert.match(
    round,
    /(?:do not|never|without)[\s\S]{0,140}(?:override|recompute|guess|덮어|재계산|추측)|(?:override|recompute|guess|덮어|재계산|추측)[\s\S]{0,80}(?:do not|never)/i,
  );
  assert.match(round, /perspectives/);
  assert.match(dispatch, /perspectives/);
  // 작은/큰/위험 결과 예시는 CLI perspectives에 이미 들어 있다. fan-out은
  // perspectives walk만 — strategy 분기 + risk_flags로 security를 또 붙이면 안 된다.
  assert.match(round, /`single`[\s\S]{0,200}`combined`|strategy:\s*`?single`?[\s\S]{0,200}`combined`/i);
  assert.match(
    round,
    /`parallel`[\s\S]{0,240}spec_scope[\s\S]{0,80}correctness_tests[\s\S]{0,80}minimality_maintainability/i,
  );
  assert.match(
    round,
    /risk[\s\S]{0,120}`security`|`security`[\s\S]{0,120}risk|risk_flags[\s\S]{0,120}`security`|small risk[\s\S]{0,80}`combined`[\s\S]{0,40}`security`/i,
  );
  // CT-002: 작은 위험 diff는 perspectives walk만으로 combined → security 두 호출.
  // strategy로 한 번, risk_flags로 security를 또 붙이는 dual fan-out 문구가 없어야 한다.
  for (const [label, text] of [
    ['review-round', round],
    ['agent-dispatch', dispatch],
    ['review skill', review],
  ]) {
    assert.match(
      text,
      /walk(?:ing)?[\s\S]{0,80}`perspectives`|`perspectives`[\s\S]{0,80}(?:only fan-out|array in order)/i,
      label,
    );
    assert.match(
      text,
      /(?:do not|never)[\s\S]{0,100}branch on[\s\S]{0,40}`strategy`|(?:do not|never)[\s\S]{0,120}append[\s\S]{0,40}`security`/i,
      label,
    );
    assert.match(
      text,
      /small risk[\s\S]{0,80}`combined`[\s\S]{0,40}`security`/i,
      label,
    );
  }
  // delta는 discovery perspective를 받지 않고 이전 finding·resolution·revision만 본다.
  assert.match(
    round,
    /delta[\s\S]{0,200}(?:(?:do not|never|without)[\s\S]{0,80}(?:discovery perspective|perspective)|previous findings[\s\S]{0,80}revision)/i,
  );
  // named·fallback·inline이 같은 CLI 순서를 쓴다.
  const reviewAt = dispatch.indexOf('For review,');
  assert.ok(reviewAt >= 0);
  const reviewDispatch = dispatch.slice(reviewAt);
  assert.match(reviewDispatch, /perspectives/);
  assert.match(reviewDispatch, /named/);
  assert.match(reviewDispatch, /fallback|generic|inline/i);
});

// CT-002: 작은 위험은 CLI perspectives [combined, security] 두 호출만.
// strategy로 세 관점을 열고 risk_flags로 security를 또 붙이는 dual fan-out 금지.
test('bouncer-execute small-risk discovery is combined then security via perspectives walk only', () => {
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  const review = fs.readFileSync(path.join(root, 'references/review/index.md'), 'utf8');
  for (const [label, text] of [
    ['agent-dispatch', dispatch],
    ['review-round', round],
    ['review skill', review],
  ]) {
    assert.match(
      text,
      /small risk[\s\S]{0,100}`combined`[\s\S]{0,60}`security`/i,
      label,
    );
    assert.match(
      text,
      /walk(?:ing)?[\s\S]{0,100}`perspectives`[\s\S]{0,120}only fan-out|`perspectives`[\s\S]{0,80}(?:only fan-out|array in order)/i,
      label,
    );
    assert.match(
      text,
      /(?:do not|never)[\s\S]{0,160}branch[\s\S]{0,40}on[\s\S]{0,40}`strategy`/i,
      label,
    );
    assert.match(
      text,
      /(?:do not|never)[\s\S]{0,160}append[\s\S]{0,80}`security`[\s\S]{0,80}`risk_flags`/i,
      label,
    );
  }
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
  const step4 = body.indexOf('4. **Verify/recover.**');
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
  const step1At = body.indexOf('1. **Preflight.**');
  const step1 = body.slice(step1At, body.indexOf('2. **Prepare.**'));
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
  const step2 = body.slice(body.indexOf('2. **Prepare.**'), body.indexOf('3. **Implement'));
  assert.match(step2, /`drive: true`/);
  assert.match(step2, /do not write to the main worktree/);
  assert.match(step2, /do not create another worktree/);
});

// drift는 서술이 아니라 CLI 호출로 기록된다. 그리고 그 표면은 하나뿐이다.
test('bouncer-execute records scope drift with coordinate revise, not prose', () => {
  const exec = readWorkflowBundle('bouncer-execute');
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  assert.match(exec, /bouncer coordinate revise --blueprint <dir> --task <NNN>/);
  assert.match(exec, /--paths <p> \[--paths <p>…\]/);
  assert.match(exec, /--reason <r>/);
  assert.match(exec, /one surface that revises scope/);
  assert.match(exec, /Scope impact/);
  // 라운드 상한을 넘긴 실패는 계획 후퇴가 아니라 coordinator 판정으로 간다.
  assert.match(exec, /not a return to `\/bouncer-plan`/);
  assert.match(exec, /hand the coordinator the open findings to\s*\n?\s*disposition/);
  assert.match(round, /unresolved finding is never recorded as\s*\n?\s*done/);
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

// intent bundle은 role dispatch 전에 한 번만 resolve한다. named/fallback이 같은
// brief hash·bundle ID/revision을 받지 않으면 역할마다 다른 의도를 재해석한다.
test('bouncer-execute resolves one intent bundle before role dispatch and shares identifiers', () => {
  const { body } = parseFrontmatter(mainMd);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const recovery = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/verification-recovery.md'), 'utf8');
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  const named = dispatch.match(/## Named implementer[\s\S]*?(?=\n## )/)?.[0] || '';
  const fallback = dispatch.match(/## Implementer fallback[\s\S]*?(?=\n## |$)/)?.[0] || '';
  const reviewFallback = fallbackOf(dispatch.slice(dispatch.indexOf('For review,')));

  assert.match(body, /\bbouncer intent bundle\b/);
  assert.match(body, /task_brief_hash/);
  assert.match(body, /intent_bundle_id/);
  assert.match(body, /intent_bundle_revision/);
  // resolve-once: 역할 dispatch 시작 전에 bundle을 고정한다.
  assert.match(body, /before[\s\S]{0,120}(?:role|implementer|named)[\s\S]{0,80}dispatch|resolve[\s\S]{0,80}(?:once|one)[\s\S]{0,80}(?:bundle|intent)/i);

  for (const [label, text] of [
    ['named implementer', named],
    ['implementer fallback', fallback],
    ['debugger recovery', recovery],
    ['reviewer fallback', reviewFallback],
    ['review round', round],
  ]) {
    assert.match(text, /task_brief_hash/, label);
    assert.match(text, /intent_bundle_id/, label);
    assert.match(text, /intent_bundle_revision/, label);
    assert.match(text, /intent_sections/, label);
  }
});

// 역할별 evidence는 유지하되 Explain 전체 body는 어느 payload에도 넣지 않는다.
test('bouncer-execute role payloads keep role evidence and omit full Explain body', () => {
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const recovery = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/verification-recovery.md'), 'utf8');
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  const review = fs.readFileSync(path.join(root, 'references/review/index.md'), 'utf8');
  const prompt = fs.readFileSync(path.join(root, 'references/review/assets/reviewer-prompt.md'), 'utf8');

  assert.match(recovery, /failing\s+verify\s+evidence/);
  assert.match(dispatch, /frozen/);
  assert.match(dispatch, /latest\s+verify/);
  assert.match(round, /task_brief_hash/);
  assert.match(round, /intent_bundle_id/);
  assert.match(round, /intent_bundle_revision/);
  assert.match(prompt, /task_brief_hash/);
  assert.match(prompt, /intent_bundle_id/);
  assert.match(prompt, /intent_bundle_revision/);
  assert.match(prompt, /intent_sections/);

  const forbidExplain = /(?:do not|never|omit|without)[\s\S]{0,80}(?:full|entire|whole)\s+Explain(?:\s+body)?|(?:full|entire|whole)\s+Explain(?:\s+body)?[\s\S]{0,80}(?:do not|never|omit|not)/i;
  for (const [label, text] of [
    ['agent-dispatch', dispatch],
    ['verification-recovery', recovery],
    ['review-round', round],
    ['review index', review],
    ['reviewer-prompt', prompt],
  ]) {
    assert.match(text, forbidExplain, label);
  }
});

// scope revision 뒤 bundle을 재검증하고, 실패 시 stale ID를 fallback에 숨기지 않는다.
test('bouncer-execute revalidates the intent bundle after scope revision and stops on failure', () => {
  const { body } = parseFrontmatter(mainMd);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  assert.match(body, /coordinate revise[\s\S]{0,500}(?:bouncer intent bundle|intent_bundle|re-?(?:validat|resolv|call)[\s\S]{0,40}bundle)/i);
  assert.match(
    body,
    /(?:bundle|intent_bundle)[\s\S]{0,160}(?:fail|error)[\s\S]{0,200}(?:do not|never|stop)[\s\S]{0,80}dispatch|(?:do not|never|stop)[\s\S]{0,80}dispatch[\s\S]{0,160}(?:bundle|intent_bundle)/i,
  );
  assert.match(
    body,
    /stale[\s\S]{0,80}(?:bundle|intent_bundle_id)|(?:never|do not)[\s\S]{0,80}stale[\s\S]{0,80}(?:bundle|intent_bundle)/i,
  );
  // named와 fallback이 같은 식별자 집합을 받는다는 문구가 dispatch 정본에 있어야 한다.
  assert.match(
    dispatch,
    /(?:named|fallback)[\s\S]{0,200}(?:same|identical)[\s\S]{0,120}(?:task_brief_hash|intent_bundle_id)|(?:same|identical)[\s\S]{0,80}task_brief_hash[\s\S]{0,80}intent_bundle_id/i,
  );
});

// named/fallback·review fix·verify recovery는 같은 다섯 dispatch metadata field를
// 받고, brief revise는 report 판정 뒤에만 연다.
test('bouncer-execute carries the five dispatch metadata fields on every implementer path', () => {
  const { body } = parseFrontmatter(mainMd);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/agent-dispatch.md'), 'utf8');
  const recovery = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/verification-recovery.md'), 'utf8');
  const round = fs.readFileSync(path.join(root, 'skills/bouncer-execute/references/review-round.md'), 'utf8');
  const named = dispatch.match(/## Named implementer[\s\S]*?(?=\n## )/)?.[0] || '';
  const fallback = dispatch.match(/## Implementer fallback[\s\S]*?(?=\n## |$)/)?.[0] || '';

  for (const [label, text] of [
    ['named implementer', named],
    ['implementer fallback', fallback],
  ]) {
    assert.match(text, /\battempt\b/, label);
    assert.match(text, /task_brief_hash/, label);
    assert.match(text, /base_head/, label);
    assert.match(text, /initial_worktree_state/, label);
    assert.match(text, /previous_outcome/, label);
    assert.match(text, /Brief revision/, label);
  }

  // review fix·verify recovery·execute body도 named/fallback과 같은 다섯 field를 요구한다.
  for (const [label, text] of [
    ['review-round fix', round],
    ['verification-recovery', recovery],
    ['execute skill body', body],
  ]) {
    assert.match(text, /\battempt\b/, label);
    assert.match(text, /task_brief_hash/, label);
    assert.match(text, /base_head/, label);
    assert.match(text, /initial_worktree_state/, label);
    assert.match(text, /previous_outcome/, label);
  }

  // previous_outcome shape는 TASKS-001 dispatch 출력 그대로다.
  assert.match(dispatch, /previous_outcome[\s\S]{0,80}\{\s*outcome\s*,\s*summary\s*\}/);
  // stale mismatch도 coordinate report(received)로 남겨 runtime이 stale-report를 append한다.
  assert.match(
    dispatch,
    /(?:stale|mismatch)[\s\S]{0,200}coordinate report|coordinate report[\s\S]{0,160}(?:received|stale|mismatch)/i,
  );

  // report 판정 → (필요 시) revise → 새 dispatch. 실행 중 brief 수정 금지.
  assert.match(
    body,
    /coordinate report[\s\S]{0,400}(?:coordinate revise|revise)[\s\S]{0,400}(?:coordinate dispatch|dispatch)|(?:report)[\s\S]{0,200}(?:revise)[\s\S]{0,200}(?:dispatch)/i,
  );
  assert.match(
    dispatch,
    /(?:do not|never|freeze|frozen)[\s\S]{0,120}(?:revise|brief)|(?:revise)[\s\S]{0,120}(?:after|until)[\s\S]{0,80}(?:report|outcome)/i,
  );
  assert.match(
    recovery,
    /(?:coordinate report|report)[\s\S]{0,200}(?:coordinate dispatch|dispatch|attempt)|(?:report|outcome)[\s\S]{0,160}(?:re-?dispatch|new attempt)/i,
  );
  assert.match(
    round,
    /(?:coordinate report|report)[\s\S]{0,200}(?:coordinate dispatch|dispatch|attempt|previous_outcome)|(?:fix|re-?dispatch)[\s\S]{0,160}(?:attempt|previous_outcome)/i,
  );
});
