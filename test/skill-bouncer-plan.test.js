'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('../scripts/lib/frontmatter');
const { checkDocShape } = require('../scripts/check-doc-shape');
const { readWorkflowBundle } = require('./helpers/read-skill');

const root = path.join(__dirname, '..');
const mainMd = fs.readFileSync(path.join(root, 'skills', 'bouncer-plan', 'SKILL.md'), 'utf8');
const md = readWorkflowBundle('bouncer-plan');

function assertShape(document, contract) {
  const result = checkDocShape(document, contract);
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
  return result.shape;
}

test('bouncer-plan rejects unrelated conditional routes', () => {
  const routes = [
    { href: './references/distill-preflight.md', triggers: ['distill', 'preflight'], source: 'When preparing the Distill baseline and preflight, read this reference:' },
    { href: './references/graphify-suggestions.md', triggers: ['graphify', 'suggestion'], source: 'When generating Graphify suggestions, read this reference:' },
    { href: './references/scope-confirm.md', triggers: ['confirm', 'affected_paths'], source: 'When confirming affected_paths, read this reference:' },
    { href: './references/context-review.md', triggers: ['context', 'review'], source: 'When deciding context review for a `scale: full` blueprint after `affected_paths` confirmation, read this reference:' },
  ];
  for (const route of routes) {
    const result = checkDocShape(`When publishing a release, read [Reference](${route.href}).`, {
      filePath: path.join(root, 'skills', 'bouncer-plan', 'SKILL.md'),
      links: [{ href: route.href, resolve: true, referencePreamble: true, conditionalLoad: { triggers: route.triggers } }],
    });
    assert.strictEqual(result.ok, false, route.href);
    assert.match(result.errors.join('; '), /semantic trigger/);
  }
});


test('bouncer-plan places discovery/ID/verify/scope/approval ACQ in numbered steps', () => {
  const { body } = parseFrontmatter(mainMd);
  assertShape(mainMd, {
    headings: { required: ['ACQ (AskUserQuestion) gates'] },
    steps: {
      required: [1, 2, 3, 4, 5, 6, 7, 8],
      order: true,
      acq: [1, 2, 3, 4, 6],
      links: {
        3: ['./references/graphify-suggestions.md'],
        4: ['./references/scope-confirm.md'],
        5: ['./references/context-review.md'],
      },
    },
    acqIndex: { heading: 'ACQ (AskUserQuestion) gates', steps: [1, 2, 3, 4, 6], only: true },
  });

  // 루트 보조는 ${BOUNCER_ROOT}/references/… 만.
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/discovery\/index\.md/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/minimality\/index\.md/);
  assert.doesNotMatch(
    body,
    /(?<!\$\{BOUNCER_ROOT\}\/|\.\/)references\/discovery\/index\.md/,
  );
});

test('bouncer-plan wires scaffold, skills, affected_paths, pointer, and plan gate', () => {
  const { body } = parseFrontmatter(md);
  const contract = {
    frontmatter: {
      required: ['name', 'description'],
      nonEmpty: ['description'],
      values: { name: 'bouncer-plan' },
    },
  };
  assertShape(md, contract);
  const emptyDescription = md.replace(/^description:.*$/m, 'description:');
  const result = checkDocShape(emptyDescription, contract);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('; '), /empty frontmatter field: description/);
  assert.match(body, /\bbouncer\s+scaffold\s+epic\b/);
  assert.match(body, /\bbouncer\s+scaffold\s+blueprint\b/);
  assert.match(body, /scaffold task --blueprint/);
  assert.match(body, /\bbouncer\s+plan\s+inspect\b/);
  assert.match(body, /\bbouncer\s+validate\s+--blueprint\s+<pointer\.blueprint>\s+--gate\s+plan\b/);
  assert.match(body, /\.bouncer\/context\/epics/);
  assert.match(body, /discovery/);
  assert.match(body, /spec-authoring/);
  assert.match(body, /stop-slop/);
  assert.match(body, /graphify-runner/);
  assert.match(body, /minimality/);
  assert.match(body, /affected_paths/);
  assert.match(body, /\bbouncer\s+current\s+--set\b/);
  assert.match(body, /approv/i);
  assert.doesNotMatch(md, /superpowers|profile-aware|--from-superpowers|import-superpowers|okf-authoring/i);
});

test('bouncer-plan requires implementation-ready tasks sections and mentions G10–G12', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Goal & intent|Interface|Touch|Do not touch|Checklist/i);
  assert.match(body, /G10|G11|G12/);
});

test('bouncer-plan gate list includes G18 context-review', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /G18/);
  assert.match(body, /context-review/);
});

test('bouncer-plan recommends minimality (advisory) and keeps graphify-runner', () => {
  assert.match(md, /minimality/);
  assert.match(md, /recommend|권장|advisory/i);
  assert.match(md, /graphify-runner/);
  assert.match(md, /unavailable|skip|fallback|manual/i);
});

test('bouncer-plan discovers code first and resolves function intent before scaffold', () => {
  const { body } = parseFrontmatter(mainMd);
  const discoverAt = body.indexOf('1. **Discover.**');
  const scaffoldAt = body.indexOf('2. **Scaffold.**');
  const intentAt = body.indexOf('bouncer intent --symbol', discoverAt);
  assert.ok(intentAt > discoverAt && intentAt < scaffoldAt);
  const discover = body.slice(discoverAt, scaffoldAt);
  assert.match(discover, /ambiguous[\s\S]{0,240}--candidate/);
  assert.match(discover, /unresolved[\s\S]{0,40}unlinked[\s\S]{0,240}(continue|proceed)/i);
  assert.match(discover, /historical/);
  assert.match(discover, /(intent|Explain)[\s\S]{0,160}(do not|never)[\s\S]{0,60}(set|widen|fill)[\s\S]{0,40}affected_paths/i);
});

// discovery는 광역 덤프를 반복하지 않고 후보 → 질문별 검색 → line window 순서를 고정한다.
test('bouncer-plan discovery narrows candidates before question-specific reads', () => {
  const { body } = parseFrontmatter(mainMd);
  const discover = body.slice(body.indexOf('1. **Discover.**'), body.indexOf('2. **Scaffold.**'));
  // 1) 후보 파일 목록을 먼저 만든다.
  assert.match(discover, /rg --files|`rg --files`/);
  assert.match(discover, /rg -l|`rg -l`/);
  // 2) 질문마다 path/glob으로 좁힌 뒤 관련 section·line window만 읽는다.
  assert.match(discover, /path\/glob|path or glob|question-specific/i);
  assert.match(discover, /line window|section or line/i);
  // 3) 잘린 광역 출력을 같은 형태로 다시 돌리지 않는다.
  assert.match(discover, /truncat|잘린/i);
  assert.match(discover, /do not (?:repeat|re-run)|never (?:repeat|re-run)|동일 형태 반복/i);
});

test('plan skill and references drop context search and scope evidence', () => {
  const { body } = parseFrontmatter(mainMd);
  const scope = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/scope-confirm.md'), 'utf8');
  assert.doesNotMatch(body, /distill/i);
  assert.doesNotMatch(scope, /distill/i);
  assert.equal(fs.existsSync(path.join(root, 'skills/bouncer-plan/references/distill-preflight.md')), false);
  assert.match(scope, /(intent|Explain|Graphify)[\s\S]{0,160}(do not|never)[\s\S]{0,60}(set|widen|fill)[\s\S]{0,40}affected_paths/i);
  for (const rel of [
    'skills/bouncer-plan/SKILL.md',
    'skills/bouncer-plan/references/scope-confirm.md',
    'skills/bouncer-plan/references/graphify-suggestions.md',
    'skills/bouncer-plan/references/context-review.md',
    'references/discovery/index.md',
    'references/spec-authoring/index.md',
  ]) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.doesNotMatch(text, /context-search|graphify-out\/context|scope_evidence/, rel);
  }
});

test('bouncer-plan shows role candidates and quality before affected_paths confirm', () => {
  const scope = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/scope-confirm.md'),
    'utf8',
  );
  assert.match(scope, /candidates|role/i);
  assert.match(scope, /quality|reasons|low-confidence|confidence/i);
  assert.match(scope, /affected_paths/);
  // 자동 승인을 금지하고 사용자 확인을 요구한다.
  assert.match(scope, /confirm|ask/i);
  assert.doesNotMatch(scope, /auto(?:matically)?\s+(?:copy|set|write)\s+affected_paths/i);
});

test('bouncer-plan reminds authors that titles feed the finalize commit message', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /title/i);
  assert.match(body, /commit_intent/);
  assert.match(body, /commit_summary/);
  assert.match(body, /blueprint[\s\S]{0,120}Intent/);
  assert.match(body, /\.gitmessage|commit_type|\/bouncer-finalize/);
  assert.doesNotMatch(body, /remainder scans every task|scans every task document/i);
  assert.match(body, /remainder[\s\S]{0,120}## Intent|## Intent[\s\S]{0,80}remainder/i);
});


test('bouncer-plan step 1 cites the named discovery handoff outputs', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Edge cases & failure modes/);
  assert.match(body, /Overlap/);
  assert.match(body, /실패 모드|failure mode/i);
});

test('bouncer-plan requires Korean bodies and stop-slop after authoring', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /Korean/);
  assert.match(body, /stop-slop/);
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/stop-slop\/index\.md/);
});

test('bouncer-plan delegates Mermaid zoom authoring to spec-authoring', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /mermaid|zoom/i);
  assert.match(body, /spec-authoring/);
});

test('bouncer-plan detects project build scripts and asks before writing tasks verify', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /docker-compose|compose\.ya?ml/);
  assert.match(body, /Makefile/);
  assert.match(body, /package\.json/);
  assert.match(body, /bouncer\.verify|tasks\.bouncer\.verify/);
  assert.match(body, /ask/i);
});

test('bouncer-plan dispatches context-review before approval with named-agent fallback', () => {
  const { body } = parseFrontmatter(md);
  const dispatch = fs.readFileSync(path.join(root, 'skills/bouncer-plan/references/context-review.md'), 'utf8');
  // 루트 보조(index)와 스킬 로컬(md)은 접두가 달라 같은 문자열이 아니다.
  assert.match(body, /\$\{BOUNCER_ROOT\}\/references\/context-review\/index\.md/);
  assert.match(body, /\.\/references\/context-review\.md/);
  assert.match(dispatch, /bouncer-context-reviewer/);
  assert.match(dispatch, /rules\/subagent-model\.md/);
  // named agent를 로드하지 못하면 단계를 건너뛰지 않고 인라인한다.
  assert.match(dispatch, /context-review.*inline|generic.*read-only/i);
  // fallback은 역할 이름이 아니라 역할 문서 본문 전체와 이번 call의 controller
  // 입력을 싣는다. "same brief"만 남으면 축약된 reviewer가 판정을 통과한다.
  const fallback = dispatch.slice(dispatch.indexOf('If named agents are unavailable'));
  const paragraph = fallback.slice(0, fallback.indexOf('\n\n'));
  assert.match(paragraph, /entire\s+body\s+of\s+`agents\/bouncer-context-reviewer\.md`/);
  assert.match(paragraph, /Authority\s+through\s+Output\s+contract/);
  assert.match(paragraph, /first\s+reads\s+`agents\/bouncer-context-reviewer\.md`/);
  for (const input of [/mode/, /frozen\s+target/, /digest/, /document\s+list/, /perspective/,
    /previous\s+findings/, /read-only\s+cwd/]) {
    assert.match(paragraph, input);
  }
  assert.doesNotMatch(paragraph, /same brief/i);
  const reviewAt = body.search(/context-review|bouncer-context-reviewer/);
  const approvalAt = body.search(/\*\*Approval/);
  assert.ok(reviewAt > -1 && approvalAt > reviewAt, 'context-review step must precede Approval');
});

// named discovery/delta는 대화 fork 없이 mode별 allowlist controller input만 받는다.
test('bouncer-plan named context-reviewer uses fork_turns none and mode input allowlists', () => {
  const dispatch = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/context-review.md'),
    'utf8',
  );
  const discoveryAt = dispatch.indexOf('2. **Discovery**');
  const mergeAt = dispatch.indexOf('3. **Merge**');
  const deltaAt = dispatch.indexOf('5. **Certify the delta**');
  const closeAt = dispatch.indexOf('6. **Close**');
  assert.ok(discoveryAt >= 0 && mergeAt > discoveryAt, 'Discovery section present');
  assert.ok(deltaAt >= 0 && closeAt > deltaAt, 'Certify the delta section present');
  const discovery = dispatch.slice(discoveryAt, mergeAt);
  const delta = dispatch.slice(deltaAt, closeAt);

  // 무이력 fork — discovery·delta 모두.
  assert.match(discovery, /fork_turns:\s*"none"/);
  assert.match(delta, /fork_turns:\s*"none"/);

  // discovery allowlist: mode, 단일 perspective, frozen digest, epic·blueprint·task 목록, read-only cwd.
  assert.match(discovery, /\bmode\b/);
  assert.match(discovery, /perspective/);
  assert.match(discovery, /digest/);
  assert.match(discovery, /epic[\s\S]{0,80}blueprint[\s\S]{0,80}task/i);
  assert.match(discovery, /read-only\s+cwd/i);
  // discovery 거절: 극성 결합 — "Pass the full conversation…"류 허용 문구는 실패해야 한다.
  assert.match(
    discovery,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:full )?conversation|full conversation[\s\S]{0,80}(?:do not|never|exclude|배제)|대화 이력/i,
  );
  assert.match(
    discovery,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:(?:other|another).{0,40}findings|findings.{0,40}(?:other|another)|다른.{0,20}findings)|(?:(?:other|another).{0,40}findings|findings.{0,40}(?:other|another))[\s\S]{0,80}(?:do not|never|exclude|배제)/i,
  );
  assert.match(
    discovery,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:full |entire |whole )?ledger|(?:full |entire |whole )?ledger[\s\S]{0,80}(?:do not|never|exclude|배제)|전체 ledger/i,
  );
  // discovery도 판단 집합 밖 문서를 거절한다 (delta-only 공백 메움).
  assert.match(
    discovery,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,100}(?:out of (?:scope|judgment)|outside (?:that |the )?(?:judged|revised)|documents? outside)|(?:out of (?:scope|judgment)|outside (?:that |the )?(?:judged|revised)|documents? outside)[\s\S]{0,80}(?:do not|never|exclude|배제)|판단 대상 밖/i,
  );

  // delta allowlist: 새 digest, previous findings, 실제 수정 문서 목록, read-only cwd.
  assert.match(delta, /digest/);
  assert.match(delta, /previous findings/i);
  assert.match(delta, /modified document|실제 수정|revised documents? only|documents? (?:actually )?modified/i);
  assert.match(delta, /read-only\s+cwd/i);
  // delta 거절: 극성 결합 — 허용(pass/include) 문구는 실패해야 한다.
  assert.match(
    delta,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:full )?conversation|full conversation[\s\S]{0,80}(?:do not|never|exclude|배제)|대화 이력/i,
  );
  assert.match(
    delta,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,80}(?:full |entire |whole )?ledger|(?:full |entire |whole )?ledger[\s\S]{0,80}(?:do not|never|exclude|배제)|전체 ledger/i,
  );
  assert.match(
    delta,
    /(?:do not|never|without|exclude|배제)[\s\S]{0,100}(?:out of (?:scope|judgment)|outside (?:that |the )?(?:judged|revised)|documents? outside)|(?:out of (?:scope|judgment)|outside (?:that |the )?(?:judged|revised)|documents? outside)[\s\S]{0,80}(?:do not|never|exclude|배제)|판단 대상 밖/i,
  );
});

// 경량 경로는 사용자 선언만 — 자동 판정·schema 등록 없이 산문에 고정한다.
test('bouncer-plan asks for the light path and reuses the shared maintenance epic', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /bouncer\.scale/);
  assert.match(body, /light/);
  assert.match(body, /maintenance/);
  // 사용자에게 묻는다 — 자동 판정 금지를 긍정 문구로 단언한다.
  assert.match(body, /ask/i);
  assert.match(body, /do not auto-judge|declar/i);
});

// light 분기: scaffold 플래그와 context-review 생략을 산문에 고정한다.
test('bouncer-plan scaffolds a light blueprint with --scale light', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /--scale light/);
  assert.match(body, /--scale full|light\|full|`light`\/`full`/);
  // 선언 없이 추측으로 붙이지 않는다.
  assert.match(body, /guess|no declaration|do not auto-judge/i);
});

test('bouncer-plan skips the context-review step on scale light', () => {
  const { body } = parseFrontmatter(md);
  const step = body.slice(body.indexOf('5. **Review.**'), body.indexOf('6. **Approval'));
  assert.match(step, /light/);
  assert.match(step, /[Ss]kip/);
  assert.match(step, /G18/);
  // 대체 판정을 세우지 말 것.
  assert.match(step, /do not substitute|not substitute/i);
  // skip을 빈 accepted context-review나 inline 리뷰로 대체하지 않는다.
  assert.match(step, /do not scaffold|not scaffold|inline/i);
});

// Step 5는 frozen snapshot 뒤 CLI 결과를 유일한 dispatch 선택으로 쓴다.
// controller가 cluster를 합치거나 single에 관점을 덧붙이면 분류기와 round가 갈라진다.
test('bouncer-plan step 5 uses review-dispatch plan strategy without override', () => {
  const { body } = parseFrontmatter(mainMd);
  const step = body.slice(body.indexOf('5. **Review.**'), body.indexOf('6. **Approval'));
  assert.match(step, /review-dispatch plan|review-dispatch/);
  const dispatch = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/context-review.md'),
    'utf8',
  );
  assert.match(dispatch, /bouncer review-dispatch plan/);
  assert.match(dispatch, /`single`/);
  assert.match(dispatch, /`clustered`/);
  assert.match(dispatch, /`combined`/);
  assert.match(dispatch, /`local`/);
  assert.match(dispatch, /`global`/);
  // ok:false 또는 digest/document set 불일치면 reviewer를 호출하지 않는다.
  assert.match(dispatch, /ok:\s*false|`ok`:\s*`false`/);
  assert.match(
    dispatch,
    /(?:do not|never|stop|halt|abort)[\s\S]{0,160}(?:reviewer|context-review)|(?:reviewer|context-review)[\s\S]{0,100}(?:do not|never|stop|halt|abort)/i,
  );
  // CLI cluster를 합치거나 나누지 않고, single에 임의 관점을 추가하지 않는다.
  assert.match(
    dispatch,
    /(?:do not|never|without)[\s\S]{0,120}(?:merge|split|combine|divide|합치|나누)|(?:merge|split|combine|divide|합치|나누)[\s\S]{0,80}(?:do not|never)/i,
  );
  assert.match(
    dispatch,
    /(?:do not|never)[\s\S]{0,100}(?:add|extra|additional|임의)[\s\S]{0,60}perspective|(?:perspective)[\s\S]{0,80}(?:do not|never)[\s\S]{0,60}(?:add|extra)/i,
  );
  // local끼리·local/global 사이 finding을 공유하지 않는다.
  assert.match(
    dispatch,
    /(?:do not|never|without)[\s\S]{0,100}(?:share|pass|교환|공유)[\s\S]{0,80}finding|finding[\s\S]{0,80}(?:do not|never|without)[\s\S]{0,60}(?:share|pass|다른)/i,
  );
  // CT-001: finding 비공유만으로는 다른 cluster 문서를 local에 넘기는 회귀가 안 잡힌다.
  // discovery allowlist가 each local → 해당 cluster task docs만 / 타 cluster docs 금지를 명시해야 한다.
  // 앞쪽 "one `local` call"에 걸리지 않도록 allowlist 문구(each `local`: …)에 고정한다.
  assert.match(
    dispatch,
    /each\s+`local`:\s*only that cluster'?s\s+task documents\s*[—\-–]\s*never another cluster'?s docs/i,
  );
});

test('bouncer-plan keeps light scope explicit while delegating gate details', () => {
  const { body } = parseFrontmatter(md);
  assert.match(body, /scale.*light|light.*scale/i);
  assert.match(body, /CLI owns plan-gate checks/);
});

// 프리플라이트 --all 직후 총량은 한 줄만 — 샤드별 표는 세션 주입이 된다.
test('bouncer-plan authors every task bundle, not only 001', () => {
  const { body } = parseFrontmatter(md);
  assert.doesNotMatch(body, /tasks\/001\/tasks\.md/);
  assert.match(body, /tasks\/<NNN>\/tasks\.md/);
});

// graphify 활성화는 config 손편집·pip 직접 안내가 아니라 CLI 경로만 가리킨다.
test('bouncer-plan points graphify enablement at the CLI only', () => {
  const { body } = parseFrontmatter(md);
  assert.doesNotMatch(body, /graphify\.enabled:\s*true/);
  assert.doesNotMatch(body, /pip install graphifyy/);
  assert.match(body, /init --promote-graphify/);
});

// query/seed/cap debug·retry 숫자·조건은 graphify-runner 정본만 소유한다.
// plan skill과 로컬 suggestion은 링크·handoff·사용자 확인만 남긴다.
test('bouncer-plan Graphify docs defer query/seed/debug/retry rules to graphify-runner', () => {
  const { body } = parseFrontmatter(mainMd);
  const suggestions = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/graphify-suggestions.md'),
    'utf8',
  );
  const authorAt = body.indexOf('3. **Author.**');
  const scopeAt = body.indexOf('4. **Scope confirm.**');
  assert.ok(authorAt >= 0 && scopeAt > authorAt, 'Author step owns Graphify paragraph');
  const author = body.slice(authorAt, scopeAt);

  // 진입 skill·로컬 suggestion 모두 runner 정본을 가리킨다.
  assert.match(author, /\$\{BOUNCER_ROOT\}\/references\/graphify-runner\/index\.md/);
  assert.match(suggestions, /graphify-runner|\$\{BOUNCER_ROOT\}\/references\/graphify-runner/);

  // 숫자·cap 사유·retry 조건 본문은 plan 문서에 복제하지 않는다.
  for (const [label, text] of [
    ['SKILL.md Author', author],
    ['graphify-suggestions.md', suggestions],
  ]) {
    assert.doesNotMatch(text, /seed\.fanout_cap/, `${label} must not own fanout_cap`);
    assert.doesNotMatch(text, /traversal\.frontier_cap/, `${label} must not own frontier_cap`);
    assert.doesNotMatch(
      text,
      /1\s*[–-]?\s*2\s+entry|one unique (?:function|path) seed|seed 1\s*[–-]?\s*2/i,
      `${label} must not own seed-count rule body`,
    );
    assert.doesNotMatch(
      text,
      /inspect `--debug` once|retry once with fewer|--debug` once and retry|cap-only\s+`--debug`|a single shrink retry/i,
      `${label} must not own debug/retry counts`,
    );
  }

  // suggestion은 query 조성 숫자 목록 대신 handoff·사용자 확인을 유지한다.
  assert.match(suggestions, /advisory|confirm|affected_paths/i);
  assert.doesNotMatch(suggestions, /No hubs \/ generic words|1–2 entry symbols|Deletion targets as seeds/i);
});

test('bouncer-plan loads context-review only after the light skip in step 5', () => {
  const { body } = parseFrontmatter(mainMd);
  const step5 = body.indexOf('5. **Review.**');
  const rootCite = body.indexOf('${BOUNCER_ROOT}/references/context-review/index.md');
  const localCite = body.indexOf('./references/context-review.md');
  assert.ok(step5 >= 0, 'step 5 owns context-review');
  assert.ok(rootCite >= step5, 'root context-review cite belongs after the light skip');
  assert.ok(localCite >= step5, 'skill-local context-review.md belongs after the light skip');
  const preamble = body.slice(0, body.search(/^1\. /m));
  assert.doesNotMatch(preamble, /minimality\/index\.md/);
  assert.doesNotMatch(preamble, /context-review\/index\.md/);
  assert.match(body, /\*\*ACQ — Discover/);
  assert.match(body, /\*\*ACQ — Approval/);
  assert.match(body, /\*\*ACQ — affected_paths/);
});

// 시작 경고는 preflight 한 줄이며 새 ACQ가 아니다. 선택은 CLI 응답만 쓰고
// namespace 파일·내부 helper 경로를 직접 열지 않는다. compact 한 줄은
// selected만 말하고, null은 선택이 없다고 한다. CURRENT_INVALID도 이
// 슬라이스에서 중단한다.
test('bouncer-plan preflight warns the selected pointer and shared namespace without a new ACQ', () => {
  const { body } = parseFrontmatter(mainMd);
  const preflightAt = body.indexOf('**Preflight.**');
  const projectRootAt = body.indexOf('**Project root.**');
  assert.ok(preflightAt >= 0 && projectRootAt > preflightAt, 'preflight precedes project root');
  const preflight = body.slice(preflightAt, projectRootAt);
  assert.match(preflight, /\bbouncer\s+plan\s+inspect\b/);
  assert.match(preflight, /blueprint/);
  assert.match(preflight, /\btask\b/);
  assert.match(preflight, /\bbase\b/);
  assert.match(preflight, /Git common directory/);
  assert.match(preflight, /CURRENT_AMBIGUOUS/);
  assert.match(preflight, /CURRENT_INVALID/);
  assert.match(preflight, /stop|중단/i);
  assert.doesNotMatch(preflight, /\*\*ACQ —/);
  assert.doesNotMatch(body, /scripts\/lib\/current|bouncer\/pointers/);
  assert.match(preflight, /debug/i);
  assert.match(preflight, /`selected`[\s\S]{0,200}\{ blueprint, task, base \}/);
  assert.match(preflight, /null[\s\S]{0,160}no selection|no selection[\s\S]{0,80}null/i);
});

test('bouncer-plan sets the approved blueprint through CLI-only namespace selection', () => {
  const { body } = parseFrontmatter(mainMd);
  const pointerAt = body.indexOf('7. **Activate.**');
  const pointer = body.slice(pointerAt, body.indexOf('8. **Gate.**'));
  assert.ok(pointerAt >= 0, 'step 7 owns the approved --set');
  assert.match(pointer, /\bbouncer\s+current\s+--set\b/);
  assert.doesNotMatch(pointer, /scripts\/lib\/current|bouncer\/pointers|read.*pointer file/i);
});


test('bouncer-plan authors and reviews task DAG before approval', () => {
  const { body } = parseFrontmatter(mainMd);
  assert.match(body, /depends_on/);
  assert.match(body, /parallel_safe/);
  assert.match(body, /dependency_gate/);
  assert.match(body, /dependency_gate[\s\S]{0,10}integrated/);
  // 계획 참조가 거절된 gate 값을 다시 제공하면 실패한다 — frontmatter 포함 파일 전문이 대상이다.
  assert.doesNotMatch(mainMd, /integration-verified/);
  // 승인 ACQ 전에 DAG·병렬 자격·공용 계약 충돌을 보여 준다.
  const dagReviewAt = body.search(/depends_on|DAG|dependency/i);
  const approvalAt = body.indexOf('6. **Approval');
  assert.ok(dagReviewAt >= 0, 'DAG authoring/review is present');
  assert.ok(approvalAt > 0, 'Approval step exists');
  assert.match(body, /parallel_safe|병렬/);
  assert.match(body, /충돌|overlap|conflict/i);
  assert.match(body, /G19|plan gate[\s\S]{0,120}DAG|DAG[\s\S]{0,120}plan gate|depends_on[\s\S]{0,200}validate/i);
});

test('bouncer-plan keeps contract blast, inventory, and verification-node rules in scope-confirm.md', () => {
  const { body } = parseFrontmatter(mainMd);
  const scope = fs.readFileSync(
    path.join(root, 'skills/bouncer-plan/references/scope-confirm.md'),
    'utf8',
  );
  const step4 = body.slice(body.indexOf('4. **Scope confirm.**'), body.indexOf('5. **Review.**'));
  assert.match(step4, /\.\/references\/scope-confirm\.md/);
  assert.match(scope, /Contract blast/);
  assert.match(scope, /Prose \/ inventory/);
  assert.match(scope, /execution_kind:\s*verification/);
  assert.doesNotMatch(body, /Contract blast check/);
  const result = checkDocShape(mainMd, {
    filePath: path.join(root, 'skills', 'bouncer-plan', 'SKILL.md'),
    links: [{
      href: './references/scope-confirm.md',
      resolve: true,
      referencePreamble: true,
      conditionalLoad: { triggers: ['confirm', 'affected_paths'] },
    }],
  });
  assert.deepStrictEqual(result.errors, [], result.errors.join('; '));
});

// Author 단계는 계획 정본을 planning으로 열고, 혼합 governance를 다시 계획 정본으로
// 쓰지 않는다. load graph의 plan step과 같은 경로를 잠근다.
test('bouncer-plan Author step loads rules/planning.md for product-detail decisions', () => {
  const { body } = parseFrontmatter(mainMd);
  const author = body.slice(body.indexOf('3. **Author.**'), body.indexOf('4. **Scope confirm.**'));
  assert.match(author, /rules\/planning\.md/);
  assert.match(author, /rules\/okf\.md/);
  assert.doesNotMatch(author, /rules\/governance\.md/);
});
