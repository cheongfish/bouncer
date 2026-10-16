'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { loadPolicy, loadCatalog, readTextQuestions, turnQuestionState, answerAskQuestion,
  answerTextQuestion, answerQuizText, looksLikeQuizRequest, answerPermission, finalizeReady, gateIdOf,
  gitEnv, IMPLEMENTED_ANSWERS, isImplementedAnswer } = require('./responder.cjs');

// 응답기는 task_facts만 읽으므로 fastify-001 사실은 승인된 정책 파일에서 그대로 가져온다.
// bouncer_decisions는 일부러 싣지 않는다: 이 목록을 쓰는 테스트는 게이트 기본 동작만 본다.
const fastifyPolicy = require('../configs/fastify-001-evaluator-policy.json');
const policy = { benchmark_choices: { finalize_quiz: 'first_option_for_each_presented_question' },
  task_facts: fastifyPolicy.task_facts };


test('answers only the exact expected init ignore proposal', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  const question = {
    id: 'q1',
    title: 'init.gitignore',
    prompt: `Add ${policy.task_facts.expected_gitignore_suggestions.map((p) => `\`${p}\``).join(', ')} to .gitignore?`
      + ' Also ignore `node_modules/`.',
    options: [{ id: 'a', label: 'Write suggested .gitignore entries (Recommended)' }, { id: 'b', label: 'Leave unchanged' }],
  };
  assert.deepEqual(answerAskQuestion(policy, 'bouncer-init', { questions: [question] }, workDir).outcome,
    { outcome: 'answered', answers: [{ questionId: 'q1', selectedOptionIds: ['a'] }] });
  question.prompt = 'Add node_modules/ to .gitignore?';
  assert.equal(answerAskQuestion(policy, 'bouncer-init', { questions: [question] }, workDir), null);
  question.prompt = `Add ${policy.task_facts.expected_gitignore_suggestions
    .map((p) => `\`${p}\``).join(', ')}, \`other/\` to .gitignore?`;
  assert.equal(answerAskQuestion(policy, 'bouncer-init', { questions: [question] }, workDir), null);
  rmSync(workDir, { recursive: true });
});

test('does not partially answer a bundle', () => {
  const questions = [
    { id: 'q1', prompt: 'Quiz 1', options: [{ id: 'first', label: 'A' }] },
    { id: 'q2', prompt: 'Approve plan?', options: [{ id: 'yes', label: 'Approve plan' }] },
  ];
  assert.equal(answerAskQuestion(policy, 'bouncer-finalize', { questions }), null);
  assert.equal(answerAskQuestion(policy, 'bouncer-plan', { questions }), null);
});

test('accepts only the approved benchmark policy version and choices', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-policy-'));
  const policyFile = path.join(dir, 'policy.json');
  const approved = fastifyPolicy;
  writeFileSync(policyFile, JSON.stringify(approved));
  assert.equal(loadPolicy(policyFile).policy_version, 3);
  writeFileSync(policyFile, JSON.stringify({ ...approved, policy_version: 2 }));
  assert.throws(() => loadPolicy(policyFile), /unsupported evaluator policy/);
  writeFileSync(policyFile, JSON.stringify(approved));
  writeFileSync(policyFile, JSON.stringify({ ...approved, approval_state: 'proposed' }));
  assert.throws(() => loadPolicy(policyFile), /explicit user approval/);
  writeFileSync(policyFile, JSON.stringify({ ...approved, policy_version: 1 }));
  assert.throws(() => loadPolicy(policyFile), /unsupported evaluator policy/);
  writeFileSync(policyFile, JSON.stringify({ ...approved, task_id: undefined }));
  assert.throws(() => loadPolicy(policyFile), /unsupported evaluator policy/);
  rmSync(dir, { recursive: true });
});

test('plan_review_close 선언 → 구현된 값만 받고 그 밖의 값은 시작을 거절한다', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-policy-'));
  const policyFile = path.join(dir, 'policy.json');
  try {
    const choices = (extra) => ({ ...fastifyPolicy, benchmark_choices: { ...fastifyPolicy.benchmark_choices, ...extra } });
    writeFileSync(policyFile, JSON.stringify(choices({ plan_review_close: 'close_when_only_advisory_findings' })));
    assert.equal(loadPolicy(policyFile).benchmark_choices.plan_review_close, 'close_when_only_advisory_findings');
    writeFileSync(policyFile, JSON.stringify(choices({ plan_review_close: 'always_close' })));
    assert.throws(() => loadPolicy(policyFile), /unsupported benchmark decision policy/);
    writeFileSync(policyFile, JSON.stringify(choices({ plan_review_close: undefined })));
    assert.equal(loadPolicy(policyFile).policy_version, 3);
  } finally { rmSync(dir, { recursive: true }); }
});

test('approves the explicit plan question without quality preselection', () => {
  const questions = [{ id: 'approve', title: 'plan.approval', prompt: 'Plan approval?', options: [
    { id: 'a', label: 'Approve plan (Recommended)' },
    { id: 'b', label: 'Revise plan' },
    { id: 'c', label: 'Cancel' },
  ] }];
  const result = answerAskQuestion(policy, 'bouncer-plan', { questions }, '/nonexistent');
  assert.equal(result.decisions[0].gate, 'plan.approval');
  assert.deepEqual(result.outcome.answers[0].selectedOptionIds, ['a']);
  // 제목에 게이트 ID가 없으면 문구가 같아도 답하지 않는다.
  delete questions[0].title;
  assert.equal(answerAskQuestion(policy, 'bouncer-plan', { questions }, '/nonexistent'), null);
});

test('tool permission chooses allow once but refuses external push', () => {
  const options = [{ optionId: 'allow-once', kind: 'allow_once' }, { optionId: 'reject-once', kind: 'reject_once' }];
  assert.equal(answerPermission({ toolCall: { title: 'bouncer init' }, options }).outcome.optionId, 'allow-once');
  assert.equal(answerPermission({ toolCall: { title: 'git push origin main' }, options }), null);
});


test('selects explicit task verify command when another option mentions npm test', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  writeFileSync(path.join(workDir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const question = { id: 'verify', title: 'plan.verify_command', prompt: 'Verify command for bouncer.verify?', options: [
    { id: 'a', label: 'Set `bouncer.verify: npm test` on `TASKS-001` (Recommended)' },
    { id: 'c', label: 'Leave unset — execute uses global `config.verify` (`npm test`)' },
  ] };
  assert.equal(answerAskQuestion(policy, 'bouncer-plan', { questions: [question] }, workDir)
    .decisions[0].optionId, 'a');
  rmSync(workDir, { recursive: true });
});

test('answers a presented quiz batch with one synthetic first-option answer per question', () => {
  const quiz = [
    '## Quiz',
    'Q1. Which command lists entries?',
    '- A) list', '- B) total', '- C) summary',
    'Q2. Which flag selects a month?',
    '- A) --month', '- B) --file', '- C) --help',
    'Reply with all answers.',
  ].join('\n');
  assert.deepEqual(answerQuizText(policy, 'bouncer-finalize', quiz).choices, [
    { question_number: 1, option: 'A' }, { question_number: 2, option: 'A' },
  ]);
  assert.equal(answerQuizText(policy, 'bouncer-finalize', quiz).reply, '1: A\n2: A');
  assert.equal(answerQuizText(policy, 'bouncer-plan', quiz), null);
  assert.equal(answerQuizText(policy, 'bouncer-finalize', quiz.replace('- C) --help', '')), null);
  assert.equal(looksLikeQuizRequest(quiz.replace('- A) list', '')), true);
  assert.equal(answerQuizText(policy, 'bouncer-finalize', quiz.replace('- A) list', '')), null);
  const alternateRequest = quiz.replace('Reply with all answers.', 'Please answer all quiz questions.');
  assert.equal(looksLikeQuizRequest(alternateRequest), true);
  assert.equal(looksLikeQuizRequest('Quiz complete. Answers were recorded.'), false);
  // 1790663176593 finalize: 완료 요약의 "퀴즈 1/3"과 "B 선택 반영"을 퀴즈 요청으로 오인해 멈췄다.
  assert.equal(looksLikeQuizRequest('B 선택 반영 — remainder만 커밋합니다.\n| Explain/퀴즈 | published · `1/3` |'), false);
});

test('answers all ten presented quiz questions and stops at eleven', () => {
  const quiz = (count) => ['Quiz', ...Array.from({ length: count }, (_, index) => [
    `Q${index + 1}. Question ${index + 1}?`, '- A) one', '- B) two', '- C) three',
  ]).flat(), 'Reply with all answers.'].join('\n');
  assert.equal(answerQuizText(policy, 'bouncer-finalize', quiz(10)).choices.length, 10);
  assert.equal(answerQuizText(policy, 'bouncer-finalize', quiz(11)), null);
});

function workdirWith({ epics, ready, packageTest, gitignore } = {}) {
  const { mkdirSync } = require('node:fs');
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  if (epics) mkdirSync(path.join(workDir, '.bouncer', 'context', 'epics'), { recursive: true });
  for (const entry of epics ?? []) {
    const [epic, blueprint] = entry.split('/');
    const dir = path.join(workDir, '.bouncer', 'context', 'epics', epic, 'blueprints', blueprint);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.md'), '');
  }
  for (const entry of ready ?? []) {
    const [epic, blueprint] = entry.split('/');
    const dir = path.join(workDir, '.bouncer', 'context', 'epics', epic, 'blueprints', blueprint);
    mkdirSync(path.join(dir, 'tasks', '001'), { recursive: true });
    writeFileSync(path.join(dir, 'index.md'), '---\nbouncer:\n  status: approved\n---\n');
    writeFileSync(path.join(dir, 'tasks', '001', 'tasks.md'), '---\nbouncer:\n  id: TASKS-001\n  status: ready\n---\n');
  }
  if (packageTest) writeFileSync(path.join(workDir, 'package.json'), JSON.stringify({ scripts: { test: packageTest } }));
  if (gitignore) writeFileSync(path.join(workDir, '.gitignore'), gitignore);
  return workDir;
}


const fixtureDir = path.join(__dirname, 'fixtures', 'acq');
// 녹취는 fastify-001 실행 run id, 합성 원문은 rules/acq.md 형식을 따른 손 작성 파일이다.
const FIXTURE_SOURCE = /^(?:up1-fastify-001-bouncer-full-[123]r3\/0[1-3]-(?:init|plan|run)|synthetic:rules\/acq\.md)$/;

// cases.json의 expect: 엄격 제목(카탈로그 ID)과 선택지 둘 이상을 가진 원문은 answer, 나머지 옛 표시는 violation.
for (const fixture of require('./fixtures/acq/cases.json')) {
  test(`replays recorded ACQ ${fixture.file} → ${fixture.expect}`, () => {
    const workDir = workdirWith(fixture.workdir);
    const text = readFileSync(path.join(fixtureDir, fixture.file), 'utf8');
    // finalize·plan 게이트 증거 판정은 실제 git·drive·bouncer CLI가 필요하므로 case가 요구할 때만 참으로 주입한다.
    const deps = fixture.finalizeEvidence || fixture.planGateEvidence
      ? { finalizeEvidence: () => Boolean(fixture.finalizeEvidence), planGateEvidence: () => Boolean(fixture.planGateEvidence) }
      : undefined;
    const catalogIds = new Set(Object.values(loadCatalog()).flat());
    assert.match(fixture.source, FIXTURE_SOURCE);
    assert.ok(fixture.gates.every((gate) => catalogIds.has(gate)), `${fixture.file} has a gate outside the catalog`);
    try {
      if (fixture.expect === 'answer') {
        // 녹취는 실제 fastify-001 정책(bouncer_decisions 포함)으로 재생한다.
        const result = answerTextQuestion(fastifyPolicy, fixture.phase, text, workDir, deps);
        assert.ok(result, `${fixture.source} is unanswered`);
        assert.equal(result.reply, fixture.reply);
        assert.deepEqual(result.choices.map((choice) => choice.gate), fixture.gates);
      } else if (fixture.expect === 'violation') {
        assert.equal(turnQuestionState(fastifyPolicy, fixture.phase, text, workDir, deps).kind, 'violation');
      } else {
        assert.fail(`unknown expect: ${fixture.expect}`);
      }
    } finally {
      rmSync(workDir, { recursive: true });
    }
  });
}

test('finalize.remainder is left unanswered when there is no finalize evidence', () => {
  const text = readFileSync(path.join(fixtureDir, 'synthetic-finalize-remainder.md'), 'utf8');
  assert.equal(answerTextQuestion(fastifyPolicy, 'bouncer-finalize', text, '/nonexistent', { finalizeEvidence: () => false }), null);
});

// fastify-001 policy discovery_terms를 모두 담은 목표 문장.
const prdFacts = 'Goal: add handlerTimeout with request.signal; a timed-out request ends with FST_ERR_HANDLER_TIMEOUT '
  + 'and a 503 response; existing behavior is unchanged.';

const RECOMMENDED_MARK = /\((?:recommended|권장|추천)\)/i;

// 판독 블록이 붙은 표시. 권장 글자는 `(Recommended)` 표시가 달린 첫 선택지이거나 `recommended` 인자다.
function acq(gate, reground, labels, { recommended } = {}) {
  const letters = labels.map((_, index) => String.fromCharCode(65 + index));
  const marked = labels.findIndex((label) => RECOMMENDED_MARK.test(label));
  const rec = recommended !== undefined ? recommended : (marked < 0 ? null : letters[marked]);
  return [`**AskUserQuestion — ${gate}**`,
    `<!-- acq ${JSON.stringify({ gate, options: letters, recommended: rec })} -->`, '',
    `1. **Re-ground**: ${reground}`, '2. **Recommend-why**: fits the request', '3. **Options**:',
    ...labels.map((label, index) => `   - ${letters[index]}) ${label}`)].join('\n');
}

test('selects the recommended proceed option however it is worded', () => {
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const init = workdirWith();
  for (const label of ['권장 항목 추가 (Recommended)', 'Apply the ignore rules (권장)', '.gitignore 갱신 (추천)']) {
    const text = acq('init.gitignore', `.gitignore에 ${entries}를 추가할지`, [label, '그대로 두기', '취소']);
    const result = answerTextQuestion(policy, 'bouncer-init', text, init);
    assert.equal(result?.reply, 'A', label);
    assert.equal(result.choices[0].basis, 'recommended');
  }
  rmSync(init, { recursive: true });
  for (const label of ['이대로 진행 (Recommended)', 'Looks right — go to scaffold (Recommended)',
    '핸드오프 확정 후 Step 2로 (권장)']) {
    const text = `${prdFacts}\n${acq('plan.discovery', 'Discovery 핸드오프를 확정할지', [label, '수정 요청', '중단'])}`;
    assert.equal(answerTextQuestion(policy, 'bouncer-plan', text, '/nonexistent')?.reply, 'A', label);
  }
});

test('the block recommended letter decides the proceed option, not a label mark', () => {
  const init = workdirWith();
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const labels = ['항목 추가', '그대로 두기 (Recommended)', '취소'];
  const reground = `.gitignore에 ${entries}를 추가할지`;
  assert.equal(answerTextQuestion(policy, 'bouncer-init', acq('init.gitignore', reground, labels, { recommended: 'A' }), init)?.reply, 'A');
  assert.equal(answerTextQuestion(policy, 'bouncer-init', acq('init.gitignore', reground, labels, { recommended: null }), init), null);
  rmSync(init, { recursive: true });
});

test('answers bundled discovery, light scope, and first ID blocks in order', () => {
  const workDir = workdirWith({ epics: [] });
  const text = [prdFacts,
    acq('plan.discovery', '위 framing 승인', ['위 framing 승인 (Recommended)', '수정']),
    acq('plan.light_scope', 'scope', ['light (Recommended)', 'full']),
    acq('plan.id_allocation', 'nextEpicId: 001', ['Epic 001, Blueprint 001 (Recommended)', '다른 id 지정'])].join('\n\n');
  const result = answerTextQuestion(policy, 'bouncer-plan', text, workDir);
  assert.equal(result.reply, 'A / B / A');
  assert.deepEqual(result.choices.map((choice) => choice.gate), ['plan.discovery', 'plan.light_scope', 'plan.id_allocation']);
  assert.ok(result.choices.every((choice) => choice.identified_by === 'block'));
  rmSync(workDir, { recursive: true });
});

test('reads ignore entries only up to the rule that closes the question', () => {
  const init = workdirWith();
  const list = policy.task_facts.expected_gitignore_suggestions.map((entry) => `- \`${entry}\``).join('\n');
  const options = '3. **Options**:\n   - A) Write suggested entries via `bouncer init --write-gitignore` (Recommended)\n'
    + '   - B) Leave `.gitignore` untouched\n';
  const head = '**AskUserQuestion — init.gitignore**\n<!-- acq {"gate":"init.gitignore","options":["A","B"],"recommended":"A"} -->\n\n';
  const after = '\n---\n\nCommit the bootstrap yourself.`bouncer init` finished: `.bouncer/` is scaffolded.';
  const inReground = `${head}1. **Re-ground**: \`.gitignore\`가 없음.\n${list}\n2. **Recommend-why**: keep artifacts out.\n${options}${after}`;
  const afterOptions = `${head}1. **Re-ground**: Suggested ignore entries\n2. **Recommend-why**: keep artifacts out.\n`
    + `${options}\nSuggested entries:\n${list}\n\nReply **A** or **B**.${after}`;
  for (const text of [inReground, afterOptions]) {
    assert.equal(answerTextQuestion(policy, 'bouncer-init', text, init)?.reply, 'A');
  }
  const extraBeforeRule = afterOptions.replace('Reply **A**', '- `secrets/`\n\nReply **A**');
  assert.equal(answerTextQuestion(policy, 'bouncer-init', extraBeforeRule, init), null);
  rmSync(init, { recursive: true });
});

test('recommended option that is not an unambiguous proceed → unanswerable', () => {
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const init = workdirWith();
  const reground = `.gitignore에 ${entries}를 추가할지`;
  const stops = [
    ['Leave `.gitignore` untouched (Recommended)', 'Write entries', 'Cancel'],
    ['Write entries', 'Leave untouched (Recommended)', 'Cancel'],
    ['Write entries but revise the list (Recommended)', 'Leave untouched', 'Cancel'],
    ['Cancel for now (Recommended)', 'Write entries', 'Leave untouched'],
  ];
  for (const options of stops) {
    const state = turnQuestionState(policy, 'bouncer-init', acq('init.gitignore', reground, options), init);
    assert.equal(state.kind, 'unanswerable', options[0]);
  }
  // An existing .gitignore that already ignores some expected entry: proposing that entry again is not the
  // init proposal, so it stops (the append case is covered in its own test).
  const existing = workdirWith({ gitignore: 'node_modules/\n' });
  assert.equal(answerTextQuestion(policy, 'bouncer-init',
    acq('init.gitignore', reground, ['Write entries (Recommended)', 'Leave', 'Cancel']), existing), null);
  const extra = acq('init.gitignore', `.gitignore에 ${entries}, \`secrets/\`를 추가할지`, ['Write entries (Recommended)', 'Leave', 'Cancel']);
  assert.equal(answerTextQuestion(policy, 'bouncer-init', extra, init), null);
  rmSync(init, { recursive: true });
  rmSync(existing, { recursive: true });
  const missingFact = `${prdFacts.replace('503', '504')}\n${acq('plan.discovery', 'Discovery 핸드오프를 확정할지',
    ['이대로 진행 (Recommended)', '수정 요청', '중단'])}`;
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', missingFact, '/nonexistent'), null);
});

test('keeps policy answers that differ from the recommendation', () => {
  const workDir = workdirWith({ epics: [] });
  const light = acq('plan.light_scope', 'narrow-scope light로 갈지', ['경량(light) — maintenance epic (Recommended)',
    '일반 경로 — 신규 epic과 전체 문서', '취소']);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', light, workDir)?.reply, 'B');
  const otherId = acq('plan.id_allocation', 'epic/blueprint id를 정할지', ['epic `002` + blueprint `001` (Recommended)',
    '다른 id 지정', '취소']);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', otherId, workDir), null);
  rmSync(workDir, { recursive: true });
});

test('confirms affected_paths as proposed and records paths outside product scope', () => {
  const question = (paths) => [`### 제안 \`affected_paths\` (TASKS-001)`,
    ...paths.map((entry, index) => `${index + 1}. \`${entry}\``), '---',
    acq('plan.affected_paths', 'TASKS-001의 `bouncer.affected_paths`를 위 경로로 확정할지',
      ['위 경로로 확정 (Recommended)', '수정 후 확정', '취소 / 중단'])].join('\n');
  const answer = (paths) => answerTextQuestion(policy, 'bouncer-plan', question(paths), '/nonexistent');
  // product_paths와 글자가 같은 항목만 범위 안으로 본다(glob 해석은 없다).
  assert.equal(answer(['fastify.js', 'fastify.d.ts'])?.reply, 'A');
  assert.doesNotMatch(answer(['fastify.js', 'fastify.d.ts']).choices[0].reason, /outside/);
  const outside = answer(['fastify.js', '.bouncer/config.json']);
  assert.equal(outside?.reply, 'A');
  assert.match(outside.choices[0].reason, /outside product_paths: \.bouncer\/config\.json$/);
  assert.equal(answer([])?.reply, 'A');
});

test('reads affected_paths from the proposal list, not from prose that excludes paths', () => {
  const question = (lines) => ['docs/Guides/Recipes.md stay out.', '---',
    '**AskUserQuestion — plan.affected_paths**',
    '<!-- acq {"gate":"plan.affected_paths","options":["A","B","C"],"recommended":"A"} -->',
    '1. **Re-ground**: Confirm TASKS-001 `bouncer.affected_paths`',
    ...lines, '- **A)** 위 목록 그대로 확정 (Recommended)', '- **B)** 수정안 제시', '- **C)** 취소'].join('\n');
  const reason = (lines) => answerTextQuestion(policy, 'bouncer-plan', question(lines), '/nonexistent')
    ?.choices[0].reason;
  const expected = /without filtering: fastify\.js, fastify\.d\.ts$/;
  assert.match(reason(['```yaml', 'affected_paths:', '  - fastify.js', '  - fastify.d.ts', '```']), expected);
  assert.match(reason(['```', 'fastify.js', 'fastify.d.ts', '```']), expected);
});

test('affected_paths without a recommended proceed option → unanswerable', () => {
  const text = acq('plan.affected_paths', 'TASKS-001의 `bouncer.affected_paths`를 확정할지', ['수정안 제시', '취소']);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', text, '/nonexistent'), null);
});

test('sole ready blueprint pointer question → answered only for that blueprint', () => {
  const target = '.bouncer/context/epics/001-handler-timeout/blueprints/001-handler-timeout';
  const text = (label) => acq('plan.activate_pointer', '승인된 블루프린트를 current pointer로 설정할지',
    [label, '다른 blueprint로 설정', '취소']);
  // plan.activate_pointer는 카탈로그 밖이므로 카탈로그를 주입해 정책 판단만 본다.
  const deps = { catalog: { 'bouncer-plan': ['plan.activate_pointer'] } };
  const answer = (workdir, label = `\`bouncer current --set ${target}\` 실행 (Recommended)`) => {
    const workDir = workdirWith(workdir);
    const result = answerTextQuestion(policy, 'bouncer-plan', text(label), workDir, deps);
    rmSync(workDir, { recursive: true });
    return result;
  };
  const sole = { ready: ['001-handler-timeout/001-handler-timeout'] };
  assert.equal(answer(sole)?.choices[0].gate, 'plan.activate_pointer');
  assert.equal(answer(sole).reply, 'A');
  assert.equal(answer({ epics: [] }), null);
  assert.equal(answer({ ready: ['001-handler-timeout/001-handler-timeout', '002-other/001-other'] }), null);
  assert.equal(answer(sole, '`bouncer current --set .bouncer/context/epics/002-other/blueprints/001-other` 실행 (Recommended)'),
    null);
  assert.equal(answer({ ready: ['002-other/001-other'] }), null);
});

test('plan.approval block → approved by the recommended option', () => {
  const text = acq('plan.approval', 'blueprint `001-handler-timeout`를 승인할지', ['승인하고 /bouncer-run으로 (Recommended)',
    '수정 요청', '취소']);
  const result = answerTextQuestion(policy, 'bouncer-plan', text, '/nonexistent');
  assert.equal(result?.choices[0].gate, 'plan.approval');
  assert.equal(result.reply, 'A');
});

test('Start drive stops without plan gate evidence', () => {
  const text = acq('run.start_drive', 'Whether to hand the remaining tasks to one coordinator.',
    ['Start drive (Recommended)', 'Revise list/scope and reconfirm', 'Cancel']);
  assert.equal(answerTextQuestion(policy, 'bouncer-run', text, workdirWith()), null);
});

test('answers structured quiz only with three options for every question', () => {
  const questions = [1, 2, 3].map((number) => ({ id: `q${number}`, prompt: `Quiz Q${number}?`,
    options: ['a', 'b', 'c'].map((letter) => ({ id: `${number}${letter}`, label: letter })) }));
  const reply = answerAskQuestion(policy, 'bouncer-finalize', { questions }, '/nonexistent');
  assert.equal(reply.decisions.length, 3);
  assert.ok(reply.decisions.every((decision) => decision.synthetic));
  assert.deepEqual(reply.outcome.answers.map((answer) => answer.selectedOptionIds[0]), ['1a', '2a', '3a']);
  questions[2].options.pop();
  assert.equal(answerAskQuestion(policy, 'bouncer-finalize', { questions }, '/nonexistent'), null);
});

// 1790661115056 run: integration worktree에는 pointer가 없고 prepare에는 integration 필드가 없어 remainder에서 멈췄다.
test('drive.ready true와 dry-run 성공 → finalizeReady true', () => {
  const dryRun = { ok: true, dryRun: true };
  assert.equal(finalizeReady({ ok: true, drive: { ready: true, tasks: [] } }, dryRun), true);
  assert.equal(finalizeReady({ ok: true, drive: { ready: false, tasks: [] } }, dryRun), false);
  assert.equal(finalizeReady({ ok: false, drive: { ready: true, tasks: [] } }, dryRun), false);
  assert.equal(finalizeReady({ ok: true, drive: { ready: true, tasks: [] } }, { ok: false }), false);
});

test('drive null → false', () => {
  assert.equal(finalizeReady({ ok: true, drive: null }, { ok: true, dryRun: true }), false);
  assert.equal(finalizeReady({ ok: true }, { ok: true, dryRun: true }), false);
});

// A benchmark run from a checkout under `.worktrees/` made the workspace path itself hold `.worktrees`,
// and the first split pointed GIT_DIR at the outer repository.
test('host git calls map the gitdir link when the workspace sits under another .worktrees', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'responder-git-'));
  const workspace = path.join(root, '.worktrees', 'bench-fix', '.benchmarks', 'work', 'run');
  const integration = path.join(workspace, '.worktrees', '001', '001', 'integration');
  require('node:fs').mkdirSync(integration, { recursive: true });
  try {
    writeFileSync(path.join(integration, '.git'), 'gitdir: /workspace/.git/worktrees/integration\n');
    assert.equal(gitEnv(integration).GIT_DIR, path.join(workspace, '.git', 'worktrees', 'integration'));
  } finally {
    rmSync(root, { recursive: true });
  }
});

test('host git calls map a container gitdir link inside a stage worktree', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'responder-git-'));
  const integration = path.join(workspace, '.worktrees', '001', '001', 'integration');
  require('node:fs').mkdirSync(integration, { recursive: true });
  try {
    writeFileSync(path.join(integration, '.git'), 'gitdir: /workspace/.git/worktrees/integration\n');
    const env = gitEnv(integration);
    assert.equal(env.GIT_DIR, path.join(workspace, '.git', 'worktrees', 'integration'));
    assert.equal(env.GIT_WORK_TREE, integration);
    assert.equal(gitEnv(workspace).GIT_DIR, process.env.GIT_DIR);
  } finally {
    rmSync(workspace, { recursive: true });
  }
});

// rules/acq.md: 게이트는 카탈로그 ID로만 식별한다 — 문구가 같아도 ID가 다르면 다른 게이트다.
test('a block gate selects the gate without wording hints', () => {
  const workDir = workdirWith({ epics: [] });
  try {
    const text = acq('plan.light_scope', '위 내용을 이대로 확정할지', ['Full plan (Recommended)', 'Light plan', '중단']);
    const result = answerTextQuestion(policy, 'bouncer-plan', text, workDir);
    assert.equal(result.reply, 'A');
    assert.equal(result.choices[0].gate, 'plan.light_scope');
    assert.equal(result.choices[0].identified_by, 'block');
    // 다른 단계의 ID, 정책이 없는 ID는 멈춘다.
    assert.equal(answerTextQuestion(policy, 'bouncer-run', text, workDir), null);
    assert.equal(answerTextQuestion(policy, 'bouncer-plan',
      acq('plan.request', 'x', ['Full plan (Recommended)', 'Light plan']), workDir), null);
  } finally {
    rmSync(workDir, { recursive: true });
  }
});

test('gate IDs are read only from a heading or title position', () => {
  assert.equal(gateIdOf('**AskUserQuestion — plan.discovery**'), 'plan.discovery');
  assert.equal(gateIdOf('**AskUserQuestion — plan.id_allocation (1/2)**'), 'plan.id_allocation');
  assert.equal(gateIdOf('`finalize.remainder`'), 'finalize.remainder');
  assert.equal(gateIdOf('**AskUserQuestion:**'), null);
  assert.equal(gateIdOf('**AskUserQuestion — see plan.md**'), null);
  assert.equal(gateIdOf('**AskUserQuestion — Start drive**'), null);
});


test('checks discovery against the policy task terms instead of fastify-001 terms', () => {
  const budget = { ...policy, task_facts: { ...policy.task_facts,
    discovery_terms: ['budget', '--budgets', 'NO_BUDGET'], reusable_draft: null } };
  const question = (goal) => [goal,
    acq('plan.discovery', 'framing', ['Confirm framing as written (Recommended)', 'Confirm framing, but revise'])].join('\n');
  const budgetGoal = 'Goal: add budget with --budgets; categories without a budget print NO_BUDGET.';
  assert.equal(answerTextQuestion(budget, 'bouncer-plan', question(budgetGoal), '/nonexistent').reply, 'A');
  const timeoutGoal = 'Goal: add handlerTimeout with request.signal; FST_ERR_HANDLER_TIMEOUT answers 503.';
  assert.equal(answerTextQuestion(budget, 'bouncer-plan', question(timeoutGoal), '/nonexistent'), null);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', question(timeoutGoal), '/nonexistent').reply, 'A');
});

test('requires later task policies to state their discovery terms and reusable draft', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-policy-'));
  const policyFile = path.join(dir, 'policy.json');
  const approved = fastifyPolicy;
  const { discovery_terms: _terms, reusable_draft: _draft, ...bareFacts } = approved.task_facts;
  writeFileSync(policyFile, JSON.stringify({ ...approved, task_id: 'other-002', task_facts: bareFacts }));
  assert.throws(() => loadPolicy(policyFile), /discovery_terms and task_facts.reusable_draft/);
  writeFileSync(policyFile, JSON.stringify({ ...approved, task_id: 'other-002',
    task_facts: { ...approved.task_facts, discovery_terms: ['budget'], reusable_draft: null } }));
  assert.equal(loadPolicy(policyFile).task_id, 'other-002');
  rmSync(dir, { recursive: true });
});

test('answers pre-task state questions from the task policy and marks them synthetic', () => {
  const task = { ...policy, task_facts: { ...policy.task_facts,
    task_questions: { cue: 'format\\.js|staged', prefer: 'leave|keep|그대로', deny: 'commit|discard|stash' } } };
  const ask = (options) => ({ questions: [{ id: 'q1', prompt: 'src/format.js has staged changes. What should I do?',
    options: options.map((label, index) => ({ id: String(index), label })) }] });
  const keep = answerAskQuestion(task, 'bouncer-run', ask(['Commit them too', 'Leave them staged', 'Discard them']));
  assert.deepEqual(keep.outcome.answers, [{ questionId: 'q1', selectedOptionIds: ['1'] }]);
  assert.equal(keep.decisions[0].gate, 'task.pre_task_state');
  assert.equal(keep.decisions[0].synthetic, true);
  const first = answerAskQuestion(task, 'bouncer-run', ask(['Option one', 'Option two']));
  assert.equal(first.decisions[0].basis, 'first_option');
  assert.equal(answerAskQuestion(policy, 'bouncer-run', ask(['Leave them staged', 'Commit them'])), null);
  const unrelated = { questions: [{ id: 'q1', prompt: 'Which database?', options: [{ id: 'a', label: 'x' }, { id: 'b', label: 'y' }] }] };
  assert.equal(answerAskQuestion(task, 'bouncer-run', unrelated), null);
});


test('appends the missing ignore entries to an existing .gitignore', () => {
  const repo = workdirWith({ gitignore: 'coverage\nnode_modules/\n' });
  const missing = policy.task_facts.expected_gitignore_suggestions.filter((entry) => entry !== 'node_modules/');
  const ask = (entries) => acq('init.gitignore', `.gitignore에 ${entries.map((entry) => `\`${entry}\``).join(', ')}를 추가할지`,
    ['Write entries (Recommended)', 'Leave', 'Cancel']);
  assert.equal(answerTextQuestion(policy, 'bouncer-init', ask(missing), repo)?.reply, 'A');
  // Leaving out an expected entry the file lacks, or adding an unexpected one, still stops.
  assert.equal(answerTextQuestion(policy, 'bouncer-init', ask(missing.slice(1)), repo), null);
  assert.equal(answerTextQuestion(policy, 'bouncer-init', ask([...missing, 'secrets/']), repo), null);
  rmSync(repo, { recursive: true });
});

test('sets a verify command named by the project scripts when the test script is not node --test', () => {
  const repo = workdirWith({ packageTest: 'npm run lint && npm run unit' });
  writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'npm run lint && npm run unit', unit: 'borp' } }));
  const ask = (options) => acq('plan.verify_command', '`bouncer.verify` 검증 명령을 정할지', options);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `npm run unit` (Recommended)', 'Leave unset', 'Cancel']), repo)?.reply, 'A');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `npm test` (Recommended)', 'Leave unset', 'Cancel']), repo)?.reply, 'A');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `npm run e2e` (Recommended)', 'Leave unset', 'Cancel']), repo), null);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `make check` (Recommended)', 'Leave unset', 'Cancel']), repo), null);
  rmSync(repo, { recursive: true });
});

test('installs the pre-commit hook only when the policy states install', () => {
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const text = [acq('init.gitignore', `.gitignore에 ${entries}를 추가할지`, ['Write entries (Recommended)', 'Leave', 'Cancel']),
    acq('init.pre_commit_hook', 'pre-commit hook 설치', ['Install pre-commit hook (Recommended)', 'Skip'])].join('\n\n');
  const fresh = () => mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  assert.equal(answerTextQuestion(policy, 'bouncer-init', text, fresh()), null);
  const withHook = { ...policy, bouncer_decisions: [{ gate: 'init.pre_commit_hook', answer: 'install' }] };
  const answer = answerTextQuestion(withHook, 'bouncer-init', text, fresh());
  assert.equal(answer.gate, 'init.gitignore,init.pre_commit_hook');
  assert.equal(answer.reply, 'A / A');
  const declined = { ...policy, bouncer_decisions: [{ gate: 'init.pre_commit_hook', answer: 'do_not_install' }] };
  assert.equal(answerTextQuestion(declined, 'bouncer-init', text, fresh()), null);
});

const catalogOf = (...ids) => ({ 'bouncer-plan': ids, 'bouncer-init': ids, 'bouncer-finalize': ids });
const proceedFirst = (gate) => ({ gate, phase: 'bouncer-plan', decide: ({ options }) => ({ option: options[0], basis: 'recommended' }) });
const delegating = { ...policy, benchmark_choices: { ...policy.benchmark_choices,
  open_decisions: 'delegate_to_agent_recommendation' } };

test('block options matching the body → answer, replied by the block gate', () => {
  const text = ['**AskUserQuestion — plan.discovery**',
    '<!-- acq {"gate":"plan.discovery","options":["A","B"],"recommended":"A"} -->', '- A) Write (Recommended)', '- B) Skip'].join('\n');
  const read = readTextQuestions(text, ['plan.discovery']);
  assert.equal(read.questions[0].gate, 'plan.discovery');
  assert.equal(read.questions[0].recommended, 'A');
  assert.equal(read.openDecisions, false);
  const state = turnQuestionState(policy, 'bouncer-plan', text, null,
    { catalog: catalogOf('plan.discovery'), gates: [proceedFirst('plan.discovery')] });
  assert.equal(state.kind, 'answer');
  assert.equal(state.decision.choices[0].gate, 'plan.discovery');
  assert.equal(state.decision.reply, 'A');
});

test('block options in another order than the body → violation options-mismatch', () => {
  const text = '**AskUserQuestion — plan.discovery**\n<!-- acq {"gate":"plan.discovery","options":["B","A"],"recommended":"A"} -->\n- A) one\n- B) two';
  assert.deepEqual(readTextQuestions(text, ['plan.discovery']), { violation: { reason: 'options-mismatch' } });
});

test('block JSON that does not parse, or names neither gate nor kind → violation block-json', () => {
  assert.deepEqual(readTextQuestions('<!-- acq {"gate":"plan.discovery", -->\n- A) one\n- B) two', ['plan.discovery']),
    { violation: { reason: 'block-json' } });
  assert.deepEqual(readTextQuestions('<!-- acq {"options":["A","B"]} -->\n- A) one\n- B) two', ['plan.discovery']),
    { violation: { reason: 'block-json' } });
});

test('block gate outside the catalog → violation unknown-gate', () => {
  const text = '<!-- acq {"gate":"plan.nope","options":["A","B"],"recommended":"A"} -->\n- A) one\n- B) two';
  assert.deepEqual(readTextQuestions(text, ['plan.discovery']), { violation: { reason: 'unknown-gate' } });
});

test('block with options but at most one body option → violation too-few-options', () => {
  const text = '<!-- acq {"gate":"plan.discovery","options":["A","B"],"recommended":"A"} -->\n- A) only';
  assert.deepEqual(readTextQuestions(text, ['plan.discovery']), { violation: { reason: 'too-few-options' } });
});

test('strict title with an ID outside the catalog → violation unknown-gate', () => {
  assert.deepEqual(readTextQuestions('**AskUserQuestion — plan.nope**\n- A) one\n- B) two', ['plan.discovery']),
    { violation: { reason: 'unknown-gate' } });
  assert.deepEqual(readTextQuestions('**AskUserQuestion — Light scope**\n- A) one\n- B) two', ['plan.light_scope']),
    { violation: { reason: 'unknown-gate' } });
});

test('strict title with two options and no block → answer', () => {
  const text = '**AskUserQuestion — plan.discovery (1/2)**\n- A) one (Recommended)\n- B) two';
  const state = turnQuestionState(policy, 'bouncer-plan', text, null,
    { catalog: catalogOf('plan.discovery'), gates: [proceedFirst('plan.discovery')] });
  assert.equal(state.kind, 'answer');
  assert.equal(state.decision.reply, 'A');
});

test('strict title without options → violation too-few-options', () => {
  assert.deepEqual(readTextQuestions('**AskUserQuestion — plan.discovery**\n질문만 있음', ['plan.discovery']),
    { violation: { reason: 'too-few-options' } });
});

test('strict title followed by a sentence on the same line → none', () => {
  const text = '답을 받은 뒤 이어서\n**AskUserQuestion — plan.discovery** 로 확정하겠습니다.\n끝.';
  assert.deepEqual(readTextQuestions(text, ['plan.discovery']), { questions: [], openDecisions: false });
  assert.equal(turnQuestionState(policy, 'bouncer-plan', text, null, { catalog: catalogOf('plan.discovery') }).kind, 'none');
});

test('two option lines with no title and a reply request → violation unmarked-question', () => {
  const state = turnQuestionState(policy, 'bouncer-plan', '어느 쪽으로 할까요?\n- A) one\n- B) two\n답해 주세요', null,
    { catalog: catalogOf('plan.discovery') });
  assert.deepEqual(state, { kind: 'violation', reason: 'unmarked-question' });
  assert.equal(readTextQuestions('Please answer the AskUserQuestion above.', []).violation.reason, 'unmarked-question');
});

test('open_decisions block and a delegating policy → open_decisions', () => {
  const text = '**Open decisions**\n<!-- acq {"kind":"open_decisions"} -->\n- 1) a\n- 2) b\n';
  assert.deepEqual(readTextQuestions(text, ['plan.discovery']), { questions: [], openDecisions: true });
  const state = turnQuestionState(delegating, 'bouncer-plan', text, null, { catalog: catalogOf('plan.discovery') });
  assert.equal(state.kind, 'open_decisions');
  assert.equal(state.decision.gate, 'plan.open_decisions');
  assert.equal(state.decision.choices[0].synthetic, true);
  assert.match(state.decision.reply, /판단을 맡깁니다/);
  assert.doesNotMatch(state.decision.reply, /\b[A-C]\b/);
  // 위임 정책이 없거나 plan stage가 아니면 형식은 맞아도 답하지 않는다.
  assert.equal(turnQuestionState(policy, 'bouncer-plan', text, null, { catalog: catalogOf() }).kind, 'unanswerable');
  assert.equal(turnQuestionState(delegating, 'bouncer-run', text, null, { catalog: catalogOf() }).kind, 'unanswerable');
});

test('open decisions message without the open_decisions block → violation unmarked-question', () => {
  const text = readFileSync(path.join(__dirname, 'fixtures', 'synthetic-open-decisions-unmarked.txt'), 'utf8');
  assert.deepEqual(turnQuestionState(delegating, 'bouncer-plan', text, null), { kind: 'violation', reason: 'unmarked-question' });
});

test('free-input block and a gate decision with replyText → answer, reply is that text', () => {
  const text = '**AskUserQuestion — plan.request**\n<!-- acq {"gate":"plan.request","options":[],"recommended":null} -->\n무엇을 만들까요?';
  const gate = { gate: 'plan.request', phase: 'bouncer-plan', decide: () => ({ replyText: '요청' }) };
  const state = turnQuestionState(policy, 'bouncer-plan', text, null, { gates: [gate] });
  assert.equal(state.kind, 'answer');
  assert.equal(state.decision.reply, '요청');
  assert.equal(state.decision.choices[0].gate, 'plan.request');
});

test('free-input block and no gate decision → unanswerable', () => {
  const text = '**AskUserQuestion — plan.request**\n<!-- acq {"gate":"plan.request","options":[],"recommended":null} -->\n무엇을 만들까요?';
  assert.deepEqual(turnQuestionState(policy, 'bouncer-plan', text, null), { kind: 'unanswerable' });
});

test('finalize quiz turn without a block → quiz', () => {
  const quiz = ['## Quiz', 'Q1. Which command lists entries?', '- A) list', '- B) total', '- C) summary',
    'Reply with all answers.'].join('\n');
  assert.equal(turnQuestionState(policy, 'bouncer-finalize', quiz, null).kind, 'quiz');
  assert.equal(turnQuestionState(policy, 'bouncer-plan', quiz, null).kind, 'violation');
});

test('stage-final completion reports → none', () => {
  const finals = readdirSync(path.join(__dirname, 'fixtures', 'stage-final')).filter((file) => file.endsWith('.txt'));
  assert.equal(finals.length, 3);
  for (const file of finals) {
    const text = readFileSync(path.join(__dirname, 'fixtures', 'stage-final', file), 'utf8');
    for (const phase of ['bouncer-init', 'bouncer-plan', 'bouncer-run', 'bouncer-finalize']) {
      assert.equal(turnQuestionState(delegating, phase, text, null).kind, 'none', `${file} ${phase}`);
    }
  }
});

test('loadCatalog()[bouncer-plan] → the workflows entry of rules/acq-gates.json', () => {
  const file = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'rules', 'acq-gates.json'), 'utf8'));
  assert.deepEqual(loadCatalog()['bouncer-plan'], file.workflows['bouncer-plan']);
  assert.deepEqual(loadCatalog(), file.workflows);
});


// ---- 정책 커버리지와 네 게이트 ----
const POLICY_NAMES = ['fastify-001'];
// 사용자 승인 전의 DeepSWE 정책. 실행기는 거절하지만 구조는 loadPolicy 승인 검사 직전까지 맞아야 한다.
const PROPOSED_POLICY_NAMES = ['deepswe-quill-001', 'deepswe-expr-001', 'deepswe-statemachine-001', 'deepswe-oxvg-001'];
const policyPath = (name) => path.join(__dirname, '..', 'configs', `${name}-evaluator-policy.json`);
const realPolicy = (name) => {
  assert.ok(existsSync(policyPath(name)), `benchmarks/configs/${name}-evaluator-policy.json`);
  return JSON.parse(readFileSync(policyPath(name), 'utf8'));
};
const policyFile = (value) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-policy-'));
  const file = path.join(dir, 'policy.json');
  writeFileSync(file, JSON.stringify(value));
  return file;
};
const withAnswer = (gate, answer) => ({ ...policy,
  bouncer_decisions: [{ gate, answer }] });

test('init.pre_commit_hook 항목 없는 정책과 deps.catalog → loadPolicy throw missing gate', () => {
  const approved = realPolicy('fastify-001');
  const file = policyFile({ ...approved, bouncer_decisions: approved.bouncer_decisions
    .filter((decision) => decision.gate !== 'init.pre_commit_hook') });
  assert.throws(() => loadPolicy(file, { catalog: { 'bouncer-init': ['init.pre_commit_hook'] } }),
    /evaluator policy missing gate init\.pre_commit_hook/);
});

test('구현 안 된 answer → loadPolicy throw not implemented', () => {
  const approved = realPolicy('fastify-001');
  const file = policyFile({ ...approved, bouncer_decisions: approved.bouncer_decisions
    .map((decision) => (decision.gate === 'init.base_branch' ? { ...decision, answer: 'develop' } : decision)) });
  assert.throws(() => loadPolicy(file), /evaluator policy answer develop for init\.base_branch is not implemented/);
});

test('fastify-001 정책 → discovery_terms와 reusable_draft가 정책 값과 같음', () => {
  const facts = realPolicy('fastify-001').task_facts;
  assert.deepEqual(facts.discovery_terms, ['handlerTimeout', 'request.signal', 'FST_ERR_HANDLER_TIMEOUT', '503']);
  assert.equal(facts.reusable_draft, null);
});

test('discovery_terms나 reusable_draft 키가 없는 fastify-001 정책 → loadPolicy throw', () => {
  const approved = realPolicy('fastify-001');
  const { reusable_draft: _draft, ...facts } = approved.task_facts;
  assert.throws(() => loadPolicy(policyFile({ ...approved, task_facts: facts })), /reusable_draft/);
});

test('실제 정책의 카탈로그 게이트 항목 → answer가 stop이거나 IMPLEMENTED_ANSWERS[gate]에 있음', () => {
  const ids = Object.values(loadCatalog()).flat();
  for (const name of [...POLICY_NAMES, ...PROPOSED_POLICY_NAMES]) {
    const decisions = realPolicy(name).bouncer_decisions;
    for (const id of ids) {
      const decision = decisions.find((candidate) => candidate.gate === id);
      assert.ok(decision, `${name}: ${id}`);
      assert.ok(decision.answer === 'stop' || isImplementedAnswer(realPolicy(name), id, decision.answer), `${name}: ${id}`);
    }
  }
});

test('승인된 정책 → loadPolicy 통과', () => {
  for (const name of POLICY_NAMES) {
    assert.equal(loadPolicy(path.join(__dirname, '..', 'configs', `${name}-evaluator-policy.json`)).task_id, name);
  }
});

test('proposed 정책 → loadPolicy가 explicit user approval로 거부', () => {
  for (const name of PROPOSED_POLICY_NAMES) {
    assert.ok(existsSync(policyPath(name)), `benchmarks/configs/${name}-evaluator-policy.json`);
    assert.throws(() => loadPolicy(policyPath(name)), /explicit user approval/, name);
  }
});

test('IMPLEMENTED_ANSWERS 키 → 모두 loadCatalog 결과 합집합이나 legacy ID 안', () => {
  const known = new Set([...Object.values(loadCatalog()).flat(), 'plan.activate_pointer', 'finalize.quiz', 'commit.next_task']);
  for (const id of Object.keys(IMPLEMENTED_ANSWERS)) assert.ok(known.has(id), id);
});

const base = withAnswer('init.base_branch', 'main');

test('init.base_branch, 현재 브랜치 main, main 선택지 하나 → 그 선택지', () => {
  const text = acq('init.base_branch', '기준 브랜치', ['Use main as the base branch (Recommended)', 'Use develop']);
  const answer = answerTextQuestion(base, 'bouncer-init', text, '/nonexistent', { currentBranch: () => 'main' });
  assert.equal(answer.reply, 'A');
});

test('init.base_branch, 현재 브랜치 develop → null', () => {
  const text = acq('init.base_branch', '기준 브랜치', ['Use main as the base branch (Recommended)', 'Use develop']);
  assert.equal(answerTextQuestion(base, 'bouncer-init', text, '/nonexistent', { currentBranch: () => 'develop' }), null);
  assert.equal(answerTextQuestion(base, 'bouncer-init', text, '/nonexistent', { currentBranch: () => null }), null);
});

test('init.base_branch, main 선택지가 둘 → null', () => {
  const text = acq('init.base_branch', '기준 브랜치', ['Use main (Recommended)', 'Use main-2']);
  assert.equal(answerTextQuestion(base, 'bouncer-init', text, '/nonexistent', { currentBranch: () => 'main' }), null);
});

const withFacts = (decisions, facts) => ({ ...policy, task_facts: { ...policy.task_facts, ...facts },
  bouncer_decisions: decisions });
const rewrittenPolicyFile = (changes) => {
  const approved = realPolicy('fastify-001');
  return policyFile({ ...approved, ...changes,
    task_facts: { ...approved.task_facts, ...changes.task_facts },
    bouncer_decisions: approved.bouncer_decisions.map((decision) => ({
      ...decision, answer: changes.answers?.[decision.gate] ?? decision.answer })) });
};

test('정책 init.base_branch master와 task_facts.base_branch master → loadPolicy 통과', () => {
  const file = rewrittenPolicyFile({ task_facts: { base_branch: 'master' }, answers: { 'init.base_branch': 'master' } });
  assert.equal(loadPolicy(file).task_facts.base_branch, 'master');
});

test('정책 init.base_branch develop과 task_facts.base_branch main → loadPolicy throw not implemented', () => {
  const file = rewrittenPolicyFile({ answers: { 'init.base_branch': 'develop' } });
  assert.throws(() => loadPolicy(file), /evaluator policy answer develop for init\.base_branch is not implemented/);
});

test('정책 기준 브랜치 master, 현재 브랜치 master, master 선택지 하나 → 그 선택지', () => {
  const master = withFacts([{ gate: 'init.base_branch', answer: 'master' }], { base_branch: 'master' });
  const text = acq('init.base_branch', '기준 브랜치', ['Use master as the base branch (Recommended)', 'Use develop']);
  assert.equal(answerTextQuestion(master, 'bouncer-init', text, '/nonexistent', { currentBranch: () => 'master' }).reply, 'A');
});

test('정책 기준 브랜치 master, 현재 브랜치 main → null', () => {
  const master = withFacts([{ gate: 'init.base_branch', answer: 'master' }], { base_branch: 'master' });
  const text = acq('init.base_branch', '기준 브랜치', ['Use master as the base branch (Recommended)', 'Use develop']);
  assert.equal(answerTextQuestion(master, 'bouncer-init', text, '/nonexistent', { currentBranch: () => 'main' }), null);
});

test('정책 init.base_branch 답이 task_facts.base_branch와 다름 → isImplementedAnswer false', () => {
  assert.equal(isImplementedAnswer(withFacts([], { base_branch: 'master' }), 'init.base_branch', 'main'), false);
  assert.equal(isImplementedAnswer(withFacts([], { base_branch: 'master' }), 'init.base_branch', 'master'), true);
  assert.equal(isImplementedAnswer(policy, 'plan.verify_command', 'npm test'), true);
});

test('정책 plan.verify_command policy_verification_command → loadPolicy 통과', () => {
  const file = rewrittenPolicyFile({ task_facts: { verification_command: 'go test ./...' },
    answers: { 'plan.verify_command': 'policy_verification_command' } });
  assert.equal(loadPolicy(file).task_facts.verification_command, 'go test ./...');
});

test('정책 verify 명령 go test, package.json 없음, 권장 선택지가 그 명령 → 그 선택지', () => {
  const goPolicy = withFacts([{ gate: 'plan.verify_command', answer: 'policy_verification_command' }],
    { verification_command: 'go test ./...' });
  const repo = workdirWith();
  const ask = (options) => acq('plan.verify_command', '`bouncer.verify` 검증 명령을 정할지', options);
  assert.equal(answerTextQuestion(goPolicy, 'bouncer-plan',
    ask(['go test ./... (Recommended)', 'Leave unset']), repo)?.reply, 'A');
  assert.equal(answerTextQuestion(goPolicy, 'bouncer-plan',
    ask(['make test (Recommended)', 'Leave unset']), repo), null);
  rmSync(repo, { recursive: true });
});

test('init.graphify_promotion 권장 활성화 → 권장 선택지', () => {
  const text = acq('init.graphify_promotion', '그래프', ['Enable and install Graphify (Recommended)', 'Skip']);
  assert.equal(answerTextQuestion(withAnswer('init.graphify_promotion', 'enable_and_install'), 'bouncer-init', text, '/nonexistent').reply, 'A');
});

test('init.graphify_promotion 권장이 건너뛰기 → null', () => {
  const text = acq('init.graphify_promotion', '그래프', ['Skip Graphify (Recommended)', 'Enable and install']);
  assert.equal(answerTextQuestion(withAnswer('init.graphify_promotion', 'enable_and_install'), 'bouncer-init', text, '/nonexistent'), null);
});

// commit.next_task는 retire된 bouncer-commit 스킬의 legacy ID다. responder 규칙은 보존하므로
// 현재 카탈로그에 없는 ID를 주입 카탈로그로 되살려 그 규칙을 계속 검증한다.
const legacyCommitCatalog = { catalog: { 'bouncer-commit': ['commit.next_task'] } };

test('commit.next_task 권장 current --set → 권장 선택지', () => {
  const text = acq('commit.next_task', '다음 task', ['Run `bouncer current --set` for the next task (Recommended)', 'Finalize']);
  assert.equal(answerTextQuestion(withAnswer('commit.next_task', 'advance_to_next_task'), 'bouncer-commit', text, '/nonexistent', legacyCommitCatalog).reply, 'A');
});

test('commit.next_task 권장이 finalize·보고만 → null', () => {
  const text = acq('commit.next_task', '다음 task', ['Finalize and report only (Recommended)', 'Run `bouncer current --set`']);
  assert.equal(answerTextQuestion(withAnswer('commit.next_task', 'advance_to_next_task'), 'bouncer-commit', text, '/nonexistent', legacyCommitCatalog), null);
});

const freeInput = '**AskUserQuestion — plan.request**\n<!-- acq {"gate":"plan.request","options":[],"recommended":null} -->\n무엇을 만들까요?';

test('plan.request 자유 입력 블록 단독 질문 → reply가 요청 원문', () => {
  const request = withAnswer('plan.request', 'repeat_request_file');
  const answer = answerTextQuestion({ ...request, request_file: 'benchmarks/tasks/x.prd.md' }, 'bouncer-plan', freeInput, '/nonexistent',
    { readRequest: (file) => `원문:${file}` });
  assert.equal(answer.reply, '원문:benchmarks/tasks/x.prd.md');
});

test('plan.request와 다른 질문이 한 턴 → null', () => {
  const text = `${freeInput}\n\n${acq('plan.approval', '승인', ['Approve (Recommended)', 'Revise'])}`;
  assert.equal(answerTextQuestion({ ...withAnswer('plan.request', 'repeat_request_file'), request_file: 'x' }, 'bouncer-plan', text, '/nonexistent',
    { readRequest: () => '원문' }), null);
});

test('정책 answer stop → 구현된 게이트도 null', () => {
  const stop = { ...policy, bouncer_decisions: [{ gate: 'init.pre_commit_hook', answer: 'stop' }] };
  const text = acq('init.pre_commit_hook', 'hook', ['Install pre-commit hook (Recommended)', 'Skip']);
  assert.equal(answerTextQuestion(stop, 'bouncer-init', text, '/nonexistent'), null);
});
