'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { acqMarkers: acqMarkersOf, delegateOpenDecisions, driveState, loadPolicy, classifyGate, answerAskQuestion, answerTextQuestion, answerQuizText, looksLikeQuizRequest,
  answerPermission, finalizeReady, gateIdOf, gitEnv } = require('./responder.cjs');

const policy = { benchmark_choices: { finalize_quiz: 'first_option_for_each_presented_question' },
  task_facts: { expected_gitignore_suggestions: [
    'node_modules/', 'graphify-out/', '.worktrees/', '.bouncer/.venv/', '.bouncer/runtime/',
  ], product_paths: ['src/cli.js', 'src/ledger.js', 'test/ledger.test.js', 'test/cli.test.js', 'README.md'] } };

test('answers only the exact expected init ignore proposal', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  const question = {
    id: 'q1',
    prompt: `Add ${policy.task_facts.expected_gitignore_suggestions.map((p) => `\`${p}\``).join(', ')} to .gitignore?`
      + ' Also ignore `node_modules/`.',
    options: [{ id: 'a', label: 'Write suggested .gitignore entries' }, { id: 'b', label: 'Leave unchanged' }],
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
  const approved = require('../configs/ledger-001-evaluator-policy.json');
  writeFileSync(policyFile, JSON.stringify(approved));
  assert.equal(loadPolicy(policyFile).policy_version, 2);
  writeFileSync(policyFile, JSON.stringify({ ...approved, approval_state: 'proposed' }));
  assert.throws(() => loadPolicy(policyFile), /explicit user approval/);
  writeFileSync(policyFile, JSON.stringify({ ...approved, policy_version: 1 }));
  assert.throws(() => loadPolicy(policyFile), /unsupported evaluator policy/);
  writeFileSync(policyFile, JSON.stringify({ ...approved, task_id: undefined }));
  assert.throws(() => loadPolicy(policyFile), /unsupported evaluator policy/);
  rmSync(dir, { recursive: true });
});

test('approves the explicit plan question without quality preselection', () => {
  const questions = [{ id: 'approve', prompt: 'Plan approval?', options: [
    { id: 'a', label: 'Approve plan (Recommended)' },
    { id: 'b', label: 'Revise plan' },
    { id: 'c', label: 'Cancel' },
  ] }];
  const result = answerAskQuestion(policy, 'bouncer-plan', { questions }, '/nonexistent');
  assert.equal(result.decisions[0].gate, 'plan.approval');
  assert.deepEqual(result.outcome.answers[0].selectedOptionIds, ['a']);
});

test('answers Markdown fallback with bold option letters', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const message = `**AskUserQuestion:**\nAdd ${entries} to .gitignore?\n`
    + '- **A)** Write suggested ignores via `bouncer init --write-gitignore`\n'
    + '- **B)** Leave unchanged\n';
  assert.equal(answerTextQuestion(policy, 'bouncer-init', message, workDir).reply, 'A');
  rmSync(workDir, { recursive: true });
});

test('tool permission chooses allow once but refuses external push', () => {
  const options = [{ optionId: 'allow-once', kind: 'allow_once' }, { optionId: 'reject-once', kind: 'reject_once' }];
  assert.equal(answerPermission({ toolCall: { title: 'bouncer init' }, options }).outcome.optionId, 'allow-once');
  assert.equal(answerPermission({ toolCall: { title: 'git push origin main' }, options }), null);
});

test('answers bundled discovery, full scope, and first ID questions in order', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  const { mkdirSync } = require('node:fs');
  mkdirSync(path.join(workDir, '.bouncer', 'context', 'epics'), { recursive: true });
  const prompt = [
    'Goal: summary --file --month YYYY-MM TOTAL stderr exit 1 list total cli.js',
    '**AskUserQuestion (ACQ — Discover):**',
    '- A) 위 framing 승인 (Recommended)',
    '- B) 수정',
    '**AskUserQuestion (ACQ — Light scope):**',
    '- A) full (Recommended)',
    '- B) light',
    '**AskUserQuestion (ACQ — ID allocation):**',
    'nextEpicId: 001',
    '- A) Epic 001, Blueprint 001 (Recommended)',
    '- B) 다른 id 지정',
  ].join('\n');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', prompt, workDir).reply, 'A / A / A');
  rmSync(workDir, { recursive: true });
});

test('confirms discovery framing from the plan agent Markdown question', () => {
  const prompt = [
    'Goal: add summary to cli.js with --file and --month YYYY-MM; print TOTAL.',
    'Errors go to stderr with exit 1; preserve list and total.',
    '**AskUserQuestion:**',
    '1. **Re-ground**: Confirm discovery framing before scaffolding.',
    '   - **A)** Confirm framing as written (Recommended)',
    '   - **B)** Confirm framing, but revise',
    '   - **C)** Cancel / stop planning',
  ].join('\n');
  const result = answerTextQuestion(policy, 'bouncer-plan', prompt, '/nonexistent');
  assert.equal(result.reply, 'A');
  assert.equal(result.choices[0].gate, 'plan.discovery');
});

test('answers the plan bundle that says proceed with framing and puts 001 in the other-id example', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  const { mkdirSync } = require('node:fs');
  mkdirSync(path.join(workDir, '.bouncer', 'context', 'epics'), { recursive: true });
  const prompt = [
    'Goal: summary --file --month YYYY-MM TOTAL stderr exit 1 list total cli.js',
    '**AskUserQuestion — Discover confirm**',
    '- **A)** 위 프레이밍으로 진행 (Recommended)',
    '- **B)** 수정 후 재확인 (어떤 항목을 바꿀지 적어 주세요)',
    '- **C)** 취소',
    '**AskUserQuestion — Light scope**',
    '- **A)** Light (Recommended) — `maintenance` epic + `--scale light`',
    '- **B)** Full — 신규 epic + 전체 blueprint/context-review',
    '- **C)** 취소',
    '**AskUserQuestion — ID allocation**',
    '- **A)** Suggested ids 사용 — epic `001`(+ slug), blueprint `001` (Recommended)',
    '- **B)** 다른 id/slug 지정 (예: epic `001-monthly-summary`, bp `001-summary-command`)',
    '- **C)** 취소',
    '이후 게이트: **Verify command** (`npm test` 후보)',
  ].join('\n');
  const result = answerTextQuestion(policy, 'bouncer-plan', prompt, workDir);
  assert.equal(result.reply, 'A / B / A');
  assert.deepEqual(result.choices.map((choice) => choice.gate),
    ['plan.discovery', 'plan.light_scope', 'plan.id_allocation']);
  rmSync(workDir, { recursive: true });
});

test('confirms the Korean discovery framing option', () => {
  const prompt = [
    'Goal: summary in cli.js with --file and --month YYYY-MM, ending in TOTAL.',
    'Invalid options write stderr and exit 1; preserve list and total.',
    '**AskUserQuestion:**',
    '1. **Re-ground**: Discovery 핸드오프를 이대로 확정할지',
    '   - A) 위 프레이밍 승인하고 Step 2로 진행 (Recommended)',
    '   - B) 수정 후 재확인',
    '   - C) 중단',
  ].join('\n');
  const result = answerTextQuestion(policy, 'bouncer-plan', prompt, '/nonexistent');
  assert.equal(result.reply, 'A');
  assert.equal(result.choices[0].gate, 'plan.discovery');
});

test('selects explicit task verify command when another option mentions npm test', () => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'acp-responder-'));
  const { writeFileSync } = require('node:fs');
  writeFileSync(path.join(workDir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  const question = { id: 'verify', prompt: 'Verify command for bouncer.verify?', options: [
    { id: 'a', label: 'Set `bouncer.verify: npm test` on `TASKS-001`' },
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

for (const fixture of require('./fixtures/acq/cases.json')) {
  test(`replays recorded ACQ ${fixture.file}`, () => {
    const workDir = workdirWith(fixture.workdir);
    const text = readFileSync(path.join(fixtureDir, fixture.file), 'utf8');
    const result = answerTextQuestion(policy, fixture.phase, text, workDir);
    rmSync(workDir, { recursive: true });
    assert.ok(result, `${fixture.source} is unanswered`);
    assert.equal(result.reply, fixture.reply);
    assert.deepEqual(result.choices.map((choice) => choice.gate), fixture.gates);
  });
}

const prdFacts = 'Goal: summary in cli.js with --file and --month YYYY-MM, ending in TOTAL. '
  + 'Invalid options write stderr and exit 1; preserve list and total.';

function acq(reground, options, header = '**AskUserQuestion:**') {
  return [header, `1. **Re-ground**: ${reground}`, '2. **Recommend-why**: fits the request',
    '3. **Options** (recommended-first):', ...options.map((label, index) =>
      `   - ${String.fromCharCode(65 + index)}) ${label}`)].join('\n');
}

test('selects the recommended proceed option however it is worded', () => {
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const init = workdirWith();
  for (const label of ['권장 항목 추가 (Recommended)', 'Apply the ignore rules (권장)', '.gitignore 갱신 (추천)']) {
    const text = acq(`.gitignore에 ${entries}를 추가할지`, [label, '그대로 두기', '취소']);
    const result = answerTextQuestion(policy, 'bouncer-init', text, init);
    assert.equal(result?.reply, 'A', label);
    assert.equal(result.choices[0].basis, 'recommended');
  }
  rmSync(init, { recursive: true });
  for (const label of ['이대로 진행 (Recommended)', 'Looks right — go to scaffold (Recommended)',
    '핸드오프 확정 후 Step 2로 (권장)']) {
    const text = `${prdFacts}\n${acq('Discovery 핸드오프를 확정할지', [label, '수정 요청', '중단'])}`;
    assert.equal(answerTextQuestion(policy, 'bouncer-plan', text, '/nonexistent')?.reply, 'A', label);
  }
});

test('reads ignore entries only up to the rule that closes the question', () => {
  const init = workdirWith();
  const list = policy.task_facts.expected_gitignore_suggestions.map((entry) => `- \`${entry}\``).join('\n');
  const options = '3. **Options** (recommended-first):\n'
    + '   - A) Write suggested entries via `bouncer init --write-gitignore` (Recommended)\n'
    + '   - B) Leave `.gitignore` untouched\n';
  const after = '\n---\n\nCommit the bootstrap yourself.`bouncer init` finished: `.bouncer/` is scaffolded.';
  const inReground = `**AskUserQuestion — init.gitignore**\n\n1. **Re-ground**: \`.gitignore\`가 없음.\n${list}\n`
    + `2. **Recommend-why**: keep artifacts out.\n${options}${after}`;
  const afterOptions = `**AskUserQuestion — init.gitignore**\n\n1. **Re-ground**: Suggested ignore entries\n`
    + `2. **Recommend-why**: keep artifacts out.\n${options}\nSuggested entries:\n${list}\n\nReply **A** or **B**.${after}`;
  for (const text of [inReground, afterOptions]) {
    assert.equal(answerTextQuestion(policy, 'bouncer-init', text, init)?.reply, 'A');
  }
  const extraBeforeRule = afterOptions.replace('Reply **A**', '- `secrets/`\n\nReply **A**');
  assert.equal(answerTextQuestion(policy, 'bouncer-init', extraBeforeRule, init), null);
  rmSync(init, { recursive: true });
});

test('stops when the recommended option is not an unambiguous proceed', () => {
  const entries = policy.task_facts.expected_gitignore_suggestions.map((entry) => `\`${entry}\``).join(', ');
  const init = workdirWith();
  const reground = `.gitignore에 ${entries}를 추가할지`;
  const stops = [
    ['Leave `.gitignore` untouched (Recommended)', 'Write entries', 'Cancel'],
    ['Write entries', 'Leave untouched (Recommended)', 'Cancel'],
    ['Write entries (Recommended)', 'Write only some (Recommended)', 'Cancel'],
    ['Write entries but revise the list (Recommended)', 'Leave untouched', 'Cancel'],
    ['Cancel for now (Recommended)', 'Write entries', 'Leave untouched'],
  ];
  for (const options of stops) {
    assert.equal(answerTextQuestion(policy, 'bouncer-init', acq(reground, options), init), null, options[0]);
  }
  // An existing .gitignore that already ignores some expected entry: proposing that entry again is not the
  // init proposal, so it stops (the append case is covered in its own test).
  const existing = workdirWith({ gitignore: 'node_modules/\n' });
  assert.equal(answerTextQuestion(policy, 'bouncer-init',
    acq(reground, ['Write entries (Recommended)', 'Leave', 'Cancel']), existing), null);
  const extra = acq(`.gitignore에 ${entries}, \`secrets/\`를 추가할지`, ['Write entries (Recommended)', 'Leave', 'Cancel']);
  assert.equal(answerTextQuestion(policy, 'bouncer-init', extra, init), null);
  rmSync(init, { recursive: true });
  rmSync(existing, { recursive: true });
  const missingFact = `${prdFacts.replace('exit 1', 'exit 2')}\n${acq('Discovery 핸드오프를 확정할지',
    ['이대로 진행 (Recommended)', '수정 요청', '중단'])}`;
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', missingFact, '/nonexistent'), null);
});

test('keeps policy answers that differ from the recommendation', () => {
  const workDir = workdirWith({ epics: [] });
  const light = acq('narrow-scope light로 갈지', ['경량(light) — maintenance epic (Recommended)',
    '일반 경로 — 신규 epic과 전체 문서', '취소'], '**AskUserQuestion — Light scope**');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', light, workDir)?.reply, 'B');
  const otherId = acq('epic/blueprint id를 정할지', ['epic `002` + blueprint `001` (Recommended)',
    '다른 id 지정', '취소'], '**AskUserQuestion — ID allocation**');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', otherId, workDir), null);
  rmSync(workDir, { recursive: true });
});

test('confirms affected_paths as proposed and records paths outside product scope', () => {
  const question = (paths) => [`### 제안 \`affected_paths\` (TASKS-001)`,
    ...paths.map((entry, index) => `${index + 1}. \`${entry}\``), '---',
    acq('TASKS-001의 `bouncer.affected_paths`를 위 경로로 확정할지',
      ['위 경로로 확정 (Recommended)', '수정 후 확정', '취소 / 중단'], '**AskUserQuestion — ACQ affected_paths**')].join('\n');
  const answer = (paths) => answerTextQuestion(policy, 'bouncer-plan', question(paths), '/nonexistent');
  assert.equal(answer(['src/cli.js', 'test/ledger.test.js'])?.reply, 'A');
  assert.doesNotMatch(answer(['src/cli.js', 'test/ledger.test.js']).choices[0].reason, /outside/);
  const outside = answer(['src/cli.js', '.bouncer/config.json']);
  assert.equal(outside?.reply, 'A');
  assert.match(outside.choices[0].reason, /outside product_paths: \.bouncer\/config\.json$/);
  assert.equal(answer([])?.reply, 'A');
});

test('reads affected_paths from the proposal list, not from prose that excludes paths', () => {
  const question = (lines) => ['README/`data/entries.json` stay out.', '---',
    '**AskUserQuestion (ACQ — affected_paths):**', '1. **Re-ground**: Confirm TASKS-001 `bouncer.affected_paths`',
    ...lines, '- **A)** 위 목록 그대로 확정 (Recommended)', '- **B)** 수정안 제시', '- **C)** 취소'].join('\n');
  const reason = (lines) => answerTextQuestion(policy, 'bouncer-plan', question(lines), '/nonexistent')
    ?.choices[0].reason;
  const expected = /without filtering: src\/cli\.js, src\/ledger\.js$/;
  assert.match(reason(['```yaml', 'affected_paths:', '  - src/cli.js', '  - src/ledger.js', '```']), expected);
  assert.match(reason(['```', 'src/cli.js', 'src/ledger.js', '```']), expected);
});

test('stops affected_paths when no recommended proceed option is offered', () => {
  const text = acq('TASKS-001의 `bouncer.affected_paths`를 확정할지', ['수정안 제시', '취소'],
    '**AskUserQuestion — affected_paths**');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', text, '/nonexistent'), null);
});

test('sets the initial pointer only to the sole ready blueprint', () => {
  const target = '.bouncer/context/epics/001-monthly-summary/blueprints/001-summary-command';
  const text = (label) => acq('승인된 블루프린트를 current pointer로 설정할지', [label, '다른 blueprint로 설정', '취소'],
    '**AskUserQuestion (ACQ — Activate pointer):**');
  const answer = (workdir, label = `\`bouncer current --set ${target}\` 실행 (Recommended)`) => {
    const workDir = workdirWith(workdir);
    const result = answerTextQuestion(policy, 'bouncer-plan', text(label), workDir);
    rmSync(workDir, { recursive: true });
    return result;
  };
  const sole = { ready: ['001-monthly-summary/001-summary-command'] };
  assert.equal(answer(sole)?.choices[0].gate, 'plan.activate_pointer');
  assert.equal(answer(sole).reply, 'A');
  assert.equal(answer({ epics: [] }), null);
  assert.equal(answer({ ready: ['001-monthly-summary/001-summary-command', '002-other/001-other'] }), null);
  assert.equal(answer(sole, '`bouncer current --set .bouncer/context/epics/002-other/blueprints/001-other` 실행 (Recommended)'),
    null);
  assert.equal(answer({ ready: ['002-other/001-other'] }), null);
});

test('recognizes the plan Approval ACQ header', () => {
  const text = acq('blueprint `001-summary-command`를 승인할지', ['승인하고 /bouncer-run으로 (Recommended)',
    '수정 요청', '취소'], '**AskUserQuestion — ACQ Approval**');
  const result = answerTextQuestion(policy, 'bouncer-plan', text, '/nonexistent');
  assert.equal(result?.choices[0].gate, 'plan.approval');
  assert.equal(result.reply, 'A');
});

test('classifies Start drive wordings and leaves finalize consent in the run stage unclassified', () => {
  for (const cue of ['**AskUserQuestion — Start drive** Whether to hand the remaining tasks to one coordinator.',
    '**AskUserQuestion:** 남은 task를 coordinator 하나에 맡겨 드라이브를 시작할지',
    '**AskUserQuestion:** 남은 작업을 coordinator에게 위임할지',
    '**AskUserQuestion:** Delegate the remaining tasks to the coordinator?']) {
    assert.equal(classifyGate('bouncer-run', cue)?.gate, 'run.start_drive', cue);
  }
  for (const cue of ['**AskUserQuestion — Explain quiz** Q1~Q3에 답할지',
    '**AskUserQuestion:** 남은 변경을 커밋하고 worktree를 유지할지',
    '**AskUserQuestion — PR** draft PR을 만들지']) {
    assert.equal(classifyGate('bouncer-run', cue), null, cue);
  }
});

test('Start drive stops without plan gate evidence', () => {
  const text = acq('Whether to hand the remaining tasks to one coordinator.',
    ['Start drive (Recommended)', 'Revise list/scope and reconfirm', 'Cancel'], '**AskUserQuestion — Start drive**');
  assert.equal(answerTextQuestion(policy, 'bouncer-run', text, workdirWith()), null);
});

test('a classified gate that cannot decide does not fall through to a later gate', () => {
  const workDir = workdirWith({ epics: [] });
  const text = acq('Discovery 핸드오프와 light scope를 확정할지', ['Light로 진행 (Recommended)', 'Full', '취소']);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', text, workDir), null);
  rmSync(workDir, { recursive: true });
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
test('finalize readiness comes from the prepare coordinator section and a dry run', () => {
  const prepare = { ok: true, coordinator: { status: 'ok', tasks: [{ id: '001', status: 'integrated' }] } };
  const dryRun = { ok: true, dryRun: true };
  assert.equal(finalizeReady(prepare, dryRun), true);
  assert.equal(finalizeReady({ ...prepare, coordinator: { status: 'ok', tasks: [] } }, dryRun), false);
  assert.equal(finalizeReady({ ...prepare, coordinator: { status: 'ok',
    tasks: [{ id: '001', status: 'integrated' }, { id: '002', status: 'ready' }] } }, dryRun), false);
  assert.equal(finalizeReady(prepare, { ok: false }), false);
  assert.equal(finalizeReady({ ok: true, integration: { complete: true } }, dryRun), false);
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

test('classifies the Korean remainder question as the remainder gate', () => {
  const gate = classifyGate('bouncer-finalize', 'context remainder를 `finalize --yes`로 커밋할지');
  assert.equal(gate?.gate, 'finalize.remainder');
});

// rules/acq.md: 표시 제목의 gate ID가 질문을 결정한다 — 문구 추측(cue)은 ID 없는 과거 표시에만 쓴다.
test('a gate ID heading selects the gate without cue words', () => {
  const workDir = workdirWith({ epics: [] });
  try {
    const text = acq('위 내용을 이대로 확정할지', ['이대로 진행 (Recommended)', '수정 후 재확인', '중단'],
      '**AskUserQuestion — plan.light_scope**').replace('이대로 진행 (Recommended)', 'Full plan (Recommended)')
      .replace('수정 후 재확인', 'Light plan');
    const result = answerTextQuestion(policy, 'bouncer-plan', text, workDir);
    assert.equal(result.reply, 'A');
    assert.equal(result.choices[0].gate, 'plan.light_scope');
    assert.equal(result.choices[0].identified_by, 'gate_id');
    // 다른 단계의 ID, 정책이 없는 ID는 cue로 넘어가지 않고 멈춘다.
    assert.equal(answerTextQuestion(policy, 'bouncer-run', text, workDir), null);
    assert.equal(answerTextQuestion(policy, 'bouncer-plan',
      text.replace('plan.light_scope', 'plan.request'), workDir), null);
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

test('checks discovery against the policy task terms instead of ledger-001 terms', () => {
  const budget = { ...policy, task_facts: { ...policy.task_facts,
    discovery_terms: ['budget', '--budgets', 'NO_BUDGET'], reusable_draft: null } };
  const question = (goal) => [
    goal,
    '**AskUserQuestion — plan.discovery**',
    '- A) Confirm framing as written (Recommended)',
    '- B) Confirm framing, but revise',
  ].join('\n');
  const budgetGoal = 'Goal: add budget with --budgets; categories without a budget print NO_BUDGET.';
  assert.equal(answerTextQuestion(budget, 'bouncer-plan', question(budgetGoal), '/nonexistent').reply, 'A');
  const summaryGoal = 'Goal: add summary to cli.js with --file and --month YYYY-MM; print TOTAL. stderr exit 1; list total.';
  assert.equal(answerTextQuestion(budget, 'bouncer-plan', question(summaryGoal), '/nonexistent'), null);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', question(summaryGoal), '/nonexistent').reply, 'A');
});

test('requires later task policies to state their discovery terms and reusable draft', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'acp-policy-'));
  const policyFile = path.join(dir, 'policy.json');
  const approved = require('../configs/ledger-001-evaluator-policy.json');
  writeFileSync(policyFile, JSON.stringify({ ...approved, task_id: 'ledger-002' }));
  assert.throws(() => loadPolicy(policyFile), /discovery_terms and task_facts.reusable_draft/);
  writeFileSync(policyFile, JSON.stringify({ ...approved, task_id: 'ledger-002',
    task_facts: { ...approved.task_facts, discovery_terms: ['budget'], reusable_draft: null } }));
  assert.equal(loadPolicy(policyFile).task_id, 'ledger-002');
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

test('reads a heading-form AskUserQuestion and flags one it cannot read', () => {
  const { acqMarkers, unreadQuestion } = require('./responder.cjs');
  const heading = [
    '퀴즈 **0/3** 기록·publish 완료. Finalize dry-run은 통과했습니다.',
    '### AskUserQuestion — `finalize.remainder`',
    '- **A)** `finalize --yes` 커밋 + worktree 제거 (Recommended)',
    '- **B)** `finalize --yes` 커밋만 — worktree 유지',
    '- **C)** 메시지/스테이징 수정 후 재확인',
    '- **D)** 취소 — `--yes` 실행 안 함',
  ].join('\n');
  assert.equal(acqMarkers(heading).length, 1);
  assert.equal(gateIdOf(acqMarkers(heading)[0][0]), 'finalize.remainder');
  assert.equal(unreadQuestion(heading), false);
  assert.equal(acqMarkers('**AskUserQuestion — plan.approval**\n- A) Approve').length, 1);
  assert.equal(unreadQuestion('Please answer the AskUserQuestion above: A or B?'), true);
  assert.equal(unreadQuestion('Done. No questions.'), false);
});

test('reads a trailing lettered choice without an AskUserQuestion marker as one question', () => {
  const { acqMarkers } = require('./responder.cjs');
  const text = [
    '**Remainder dry-run** — clean. Integration complete (`openTasks: []`).',
    '---',
    '**Decision — remainder commit + worktree**',
    '',
    'Task commits are done; after close the execute/integration checkouts are usually unnecessary.',
    '',
    '- **A)** `finalize --yes` commit + remove worktrees *(Recommended)*',
    '- **B)** `finalize --yes` commit only — keep worktrees',
    '- **C)** Fix message/staging and re-check',
    '- **D)** Cancel — do not run `--yes`',
    '',
    'Reply with **A**, **B**, **C**, or **D**.',
  ].join('\n');
  const markers = acqMarkers(text);
  assert.equal(markers.length, 1);
  assert.equal(markers[0][0], '**Decision — remainder commit + worktree**');
  assert.equal(classifyGate('bouncer-finalize', markers[0][0]).gate, 'finalize.remainder');
  // Options in the middle of a report, or with no reply instruction, are not a question.
  assert.equal(acqMarkers(`${text}\n\nDone; nothing else to decide.`).length, 0);
  assert.equal(acqMarkers('Plan:\n- A) parse\n- B) print').length, 0);
  // A quiz keeps its own path.
  const quiz = '**Quiz:** 2 questions.\n**Q1.** Why?\nA) x\nB) y\nC) z\n**Q2.** What?\nA) x\nB) y\nC) z\nReply with both answers (Q1: A, Q2: B).';
  assert.equal(acqMarkers(quiz).length, 0);
});


const delegating = { ...policy, benchmark_choices: { ...policy.benchmark_choices,
  open_decisions: 'delegate_to_agent_recommendation' } };

// 1.5.4 discovery open decisions recorded in v154-ledger-00{1,4}-bouncer-full-{2,3}: four formats, two of them
// with no recommendation marker. Each is handed back to the agent with one neutral line.
for (const file of ['plan-open-decisions-ko-numbered.md', 'plan-open-decisions-gate-id.md',
  'plan-open-decisions-en-reply-hint.md', 'plan-open-decisions-bold-options.md',
  // v154-ledger-004-bouncer-full-5: `- **1A)**` options and a preview marker ending the sentence with `.`.
  'plan-open-decisions-numbered-options.md']) {
  test(`delegates recorded open decisions ${file}`, () => {
    const text = readFileSync(path.join(fixtureDir, file), 'utf8');
    const result = delegateOpenDecisions(delegating, 'bouncer-plan', text);
    assert.equal(result?.gate, 'plan.open_decisions');
    assert.equal(result.choices[0].synthetic, true);
    assert.match(result.reply, /판단을 맡깁니다/);
    assert.doesNotMatch(result.reply, /\b[A-C]\b/);
    assert.equal(delegateOpenDecisions(policy, 'bouncer-plan', text), null);
    assert.equal(delegateOpenDecisions(delegating, 'bouncer-run', text), null);
  });
}

test('does not delegate a gate question that only mentions open decisions', () => {
  const discovery = '**Open decisions**: none (request settles every behavior)\n\n---\n\n'
    + '**AskUserQuestion — plan.approval**\n1. **Re-ground**: approve the plan\n'
    + '- A) Approve (Recommended)\n- B) Revise\n- C) Cancel';
  assert.equal(delegateOpenDecisions(delegating, 'bouncer-plan', discovery), null);
  // v154-ledger-004-bouncer-full-4: the Discover confirm lists the answered open decisions; delegating it
  // made the agent take every later gate, plan approval included, as delegated.
  const confirm = '---\n\n**AskUserQuestion — plan.discovery**\n\n1. **Re-ground**: Goal / Scope 확인\n'
    + '3. **Options** (recommended-first):\n   - A) Confirm this discovery framing (Recommended)\n'
    + '   - B) Revise (reply with what to change)\n   - C) Cancel planning\n\n### Open decisions\n'
    + '1. Unknown shorts → **A**\n\nReply **A**, **B** (+ revisions), or **C**.';
  assert.equal(delegateOpenDecisions(delegating, 'bouncer-plan', confirm), null);
});

test('ignores an AskUserQuestion marker that only previews the next question inside a sentence', () => {
  assert.deepEqual(acqMarkersOf('**AskUserQuestion — plan.open_decisions**\n- A) one\n- B) two\n\n'
    + '답 받은 뒤 **AskUserQuestion — plan.discovery**로 확정하겠습니다.').map((m) => m[0]),
  ['**AskUserQuestion — plan.open_decisions**']);
  // A streamed turn may glue a real marker to the previous sentence; it still opens a question.
  assert.equal(acqMarkersOf('Next are the Step 2 decisions.**AskUserQuestion (1/2) — ID allocation**\n').length, 1);
});

test('reads the drive state from the integration ledger once finalize prepare stops mirroring it', () => {
  const { mkdirSync } = require('node:fs');
  const checkout = mkdtempSync(path.join(tmpdir(), 'acp-ledger-'));
  const prepare = { ok: true, blueprint: {}, tasks: [] };
  const dryRun = { ok: true, dryRun: true };
  assert.equal(driveState(prepare, checkout), null);
  assert.equal(finalizeReady(prepare, dryRun, driveState(prepare, checkout)), false);
  mkdirSync(path.join(checkout, '.bouncer', 'runtime'), { recursive: true });
  const ledger = { version: 1, integrationHead: 'abc', integrationBranch: 'feat/x',
    tasks: [{ id: 'TASKS-001', status: 'integrated', sha: 'abc' }] };
  writeFileSync(path.join(checkout, '.bouncer', 'runtime', 'coordinator.json'), JSON.stringify(ledger));
  assert.equal(driveState(prepare, checkout).integrationHead, 'abc');
  assert.equal(finalizeReady(prepare, dryRun, driveState(prepare, checkout)), true);
  ledger.tasks.push({ id: 'TASKS-002', status: 'verified' });
  writeFileSync(path.join(checkout, '.bouncer', 'runtime', 'coordinator.json'), JSON.stringify(ledger));
  assert.equal(finalizeReady(prepare, dryRun, driveState(prepare, checkout)), false);
  // A digest that still mirrors the ledger wins over the file.
  assert.equal(driveState({ ok: true, coordinator: { status: 'ok', tasks: [] } }, checkout).tasks.length, 0);
  rmSync(checkout, { recursive: true });
});

test('appends the missing ignore entries to an existing .gitignore', () => {
  const repo = workdirWith({ gitignore: 'coverage\nnode_modules/\n' });
  const missing = policy.task_facts.expected_gitignore_suggestions.filter((entry) => entry !== 'node_modules/');
  const ask = (entries) => acq(`.gitignore에 ${entries.map((entry) => `\`${entry}\``).join(', ')}를 추가할지`,
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
  const ask = (options) => acq('`bouncer.verify` 검증 명령을 정할지', options, '**AskUserQuestion — plan.verify_command**');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `npm run unit` (Recommended)', 'Leave unset', 'Cancel']), repo)?.reply, 'A');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `npm test` (Recommended)', 'Leave unset', 'Cancel']), repo)?.reply, 'A');
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `npm run e2e` (Recommended)', 'Leave unset', 'Cancel']), repo), null);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', ask(['Set `make check` (Recommended)', 'Leave unset', 'Cancel']), repo), null);
  rmSync(repo, { recursive: true });
});

test('installs the pre-commit hook only when the policy states install', () => {
  const text = readFileSync(path.join(__dirname, 'fixtures', 'v088-init-reply.txt'), 'utf8');
  assert.equal(answerTextQuestion(policy, 'bouncer-init', text, mkdtempSync(path.join(tmpdir(), 'acp-responder-'))), null);
  const withHook = { ...policy, bouncer_decisions: [{ gate: 'init.pre_commit_hook', answer: 'install' }] };
  const answer = answerTextQuestion(withHook, 'bouncer-init', text, mkdtempSync(path.join(tmpdir(), 'acp-responder-')));
  assert.equal(answer.gate, 'init.gitignore,init.pre_commit_hook');
  assert.equal(answer.reply, 'A / A');
  const declined = { ...policy, bouncer_decisions: [{ gate: 'init.pre_commit_hook', answer: 'do_not_install' }] };
  assert.equal(answerTextQuestion(declined, 'bouncer-init', text, mkdtempSync(path.join(tmpdir(), 'acp-responder-'))), null);
});

test('delegates a single open decision with numbered options', () => {
  const text = readFileSync(path.join(__dirname, 'fixtures', 'v088-plan-open-decision.txt'), 'utf8');
  const delegating = { ...policy, benchmark_choices: { ...policy.benchmark_choices,
    open_decisions: 'delegate_to_agent_recommendation' } };
  assert.equal(delegateOpenDecisions(delegating, 'bouncer-plan', text).gate, 'plan.open_decisions');
  // Without the delegation the numbered question still stops for a human instead of ending the stage.
  assert.equal(acqMarkersOf(text).length, 1);
  assert.equal(answerTextQuestion(policy, 'bouncer-plan', text, null), null);
});
