'use strict';

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { deniedShellReason } = require('../shell-policy.cjs');

const pluginRoot = path.resolve(__dirname, '..', '..');
const bouncerCli = path.join(pluginRoot, 'scripts', 'bouncer');

// Stage worktrees keep container gitdir links (/workspace/...); host-side calls map them through the
// environment, the way run-bouncer-full.cjs does, instead of rewriting the link the container still uses.
function gitEnv(workDir) {
  const link = (() => {
    try { return readFileSync(path.join(workDir, '.git'), 'utf8').match(/^gitdir:\s*(.+)$/m)?.[1]?.trim(); }
    catch { return null; }
  })();
  const workspace = workDir.split(`${path.sep}.worktrees${path.sep}`)[0];
  if (!link?.startsWith('/workspace/') || workspace === workDir) return process.env;
  return { ...process.env, GIT_DIR: path.join(workspace, link.slice('/workspace/'.length)), GIT_WORK_TREE: workDir };
}

// The CLI is this checkout's, so its plugin root is too; an installed plugin may be another version or absent (CI).
function bouncerJson(workDir, args) {
  const result = spawnSync(process.execPath, [bouncerCli, ...args], {
    cwd: workDir, env: { ...gitEnv(workDir), BOUNCER_HOME: pluginRoot }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0 || result.error) return null;
  try { return JSON.parse(result.stdout); } catch { return null; }
}

function currentBlueprint(workDir) {
  const blueprint = bouncerJson(workDir, ['current'])?.current?.blueprint;
  return typeof blueprint === 'string' && blueprint ? blueprint : null;
}

// An integration worktree carries no current pointer; there the sole blueprint on disk is the drive's.
function soleBlueprint(workDir) {
  const epics = path.join(workDir, '.bouncer', 'context', 'epics');
  if (!existsSync(epics)) return null;
  const found = readdirSync(epics).flatMap((epic) => {
    const dir = path.join(epics, epic, 'blueprints');
    return existsSync(dir) ? readdirSync(dir).filter((name) => existsSync(path.join(dir, name, 'index.md')))
      .map((name) => ['.bouncer', 'context', 'epics', epic, 'blueprints', name].join('/')) : [];
  });
  return found.length === 1 ? found[0] : null;
}

// Drive state: `finalize prepare` mirrored the coordinator ledger as `coordinator` until 1.5.4 (87cca19f)
// dropped it from the result; from then on the ledger file in the integration worktree is read directly.
function driveState(prepare, checkout) {
  if (prepare?.coordinator) return prepare.coordinator;
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(path.join(checkout, '.bouncer', 'runtime', 'coordinator.json'), 'utf8'));
  } catch {
    return null;
  }
  return { status: 'ok', integrationHead: ledger.integrationHead ?? null, integrationBranch: ledger.integrationBranch ?? null,
    tasks: (Array.isArray(ledger.tasks) ? ledger.tasks : []).map((task) => ({ id: task.id, status: task.status, sha: task.sha })) };
}

// `finalize prepare` is a read-only digest; the drive state says every task is integrated.
function finalizeReady(prepare, dryRun, drive = prepare?.coordinator) {
  const tasks = Array.isArray(drive?.tasks) ? drive.tasks : [];
  return prepare?.ok === true && drive?.status === 'ok' && tasks.length > 0
    && tasks.every((task) => task.status === 'integrated') && dryRun?.ok === true && dryRun.dryRun === true;
}

function finalizeEvidence(workDir) {
  if (!workDir) return false;
  const blueprint = currentBlueprint(workDir) ?? soleBlueprint(workDir);
  if (!blueprint) return false;
  const prepare = bouncerJson(workDir, ['finalize', 'prepare', '--blueprint', blueprint]);
  return finalizeReady(prepare, bouncerJson(workDir, ['finalize', '--blueprint', blueprint]), driveState(prepare, workDir));
}

function planGateEvidence(workDir) {
  if (!workDir) return false;
  const blueprint = currentBlueprint(workDir);
  if (!blueprint) return false;
  return bouncerJson(workDir, ['validate', '--blueprint', blueprint, '--gate', 'plan'])?.ok === true;
}

// ledger-001's approved policy predates `discovery_terms` and `reusable_draft`; these are its values.
// Every later task's policy must state its own (loadPolicy enforces it).
const LEDGER_001_FACTS = {
  discovery_terms: ['summary', '--file', '--month', 'YYYY-MM', 'TOTAL', 'stderr', 'exit 1', 'list', 'total', 'cli.js'],
  reusable_draft: { epic: '001-monthly-summary', blueprint: '001-summary-command' },
};

function taskFact(policy, name) {
  return Object.hasOwn(policy.task_facts ?? {}, name) ? policy.task_facts[name] : LEDGER_001_FACTS[name];
}

function loadPolicy(file) {
  const policy = JSON.parse(readFileSync(file, 'utf8'));
  // Each task has its own approved policy; runners match task_id against the task card they run.
  if (policy.policy_version !== 3 || !/^[a-z][a-z0-9-]*-[0-9]{3}$/.test(policy.task_id ?? '')) {
    throw new Error('unsupported evaluator policy');
  }
  if (policy.task_id !== 'ledger-001' && (!Array.isArray(policy.task_facts?.discovery_terms)
    || !policy.task_facts.discovery_terms.length || !Object.hasOwn(policy.task_facts, 'reusable_draft'))) {
    throw new Error('evaluator policy must state task_facts.discovery_terms and task_facts.reusable_draft');
  }
  if (policy.approval_state !== 'approved') {
    throw new Error('evaluator policy is proposed; explicit user approval is required before sending gate answers');
  }
  if (policy.benchmark_choices?.plan_approval !== 'select_recommended_approve_without_quality_preselection'
    || policy.benchmark_choices?.finalize_quiz !== 'first_option_for_each_presented_question') {
    throw new Error('unsupported benchmark decision policy');
  }
  return policy;
}

// rules/acq.md fixes the ACQ shape, not its wording: the single `(Recommended)` proceed option comes
// first, revise options follow, and cancel is last. Option roles are therefore read from that shape.
const RECOMMENDED = /\((?:recommended|권장|추천)\)/i;
const REVISE = /\b(?:revise|revision|override|edit)\b|\bbut\s+change|수정|재확인|다른\s*(?:id|값|명령|경로|slug)|직접\s*지정/i;
const CANCEL = /\b(?:cancel|abort|stop)\b|취소|중단|결정하지\s*않/i;

function recommendedProceed(options, { require, deny } = {}) {
  const marked = options.filter((option) => RECOMMENDED.test(option.label));
  if (marked.length !== 1 || marked[0] !== options[0]) return null;
  const { label } = marked[0];
  if (REVISE.test(label) || CANCEL.test(label) || deny?.test(label)) return null;
  return !require || require.test(label) ? marked[0] : null;
}

function labelMatch(options, pattern, deny) {
  const matches = options.filter((option) => pattern.test(option.label) && !deny?.test(option.label));
  return matches.length === 1 ? matches[0] : null;
}

function chooseProceed(options, { require, deny, legacy, legacyDeny }) {
  const recommended = recommendedProceed(options, { require, deny });
  if (recommended) return { option: recommended, basis: 'recommended' };
  const matched = legacy && labelMatch(options, legacy,
    { test: (label) => Boolean(deny?.test(label) || legacyDeny?.test(label)) });
  return matched ? { option: matched, basis: 'label' } : null;
}

function packageScripts(workDir) {
  try {
    return JSON.parse(readFileSync(path.join(workDir, 'package.json'), 'utf8')).scripts ?? null;
  } catch {
    return null;
  }
}

function packageTestScript(workDir) {
  try {
    return JSON.parse(readFileSync(path.join(workDir, 'package.json'), 'utf8')).scripts?.test;
  } catch {
    return null;
  }
}

const APPROVAL_CUE = /plan approval|계획.{0,3}승인|approve.*(?:plan|blueprint)|(?:ACQ|AskUserQuestion)\s*[—–-]?\s*approval/i;

// Agents often list proposed paths in a section just above the question and write "the paths above".
function lastSection(text) {
  const sections = text.split(/^(?:#{1,6}\s|-{3,}\s*$)/m).filter((section) => section.trim());
  return sections.at(-1) ?? '';
}

// A proposal is the list items (numbered, bulleted, or YAML) or the bare lines of a code block whose first
// token is a path; prose such as "README/`data/entries.json` stay out" is not part of it. Trailing text
// keeps the item, so "- `README.md` (docs)" is still read as a proposed path.
function proposedPaths(text) {
  const items = [...text.matchAll(/^\s*(?:\d+[.)]|[-*])\s+`?([^`\s]+)`?/gm)].map((match) => match[1]);
  const fenced = [...text.matchAll(/^\s*```[^\n]*\n([\s\S]*?)^\s*```/gm)]
    .flatMap((match) => [...match[1].matchAll(/^\s*`?([^`\s-][^`\s]*)`?/gm)].map((line) => line[1]));
  return [...new Set([...items, ...fenced]
    .filter((token) => /^[\w.@/*-]+$/.test(token) && (token.includes('/') || /\.[a-z]{1,5}$/i.test(token))))];
}

const gates = [
  { gate: 'init.gitignore', phase: 'bouncer-init', cue: /gitignore/i,
    decide({ policy, prompt, options, workDir }) {
      const expected = policy.task_facts.expected_gitignore_suggestions;
      // A text question block runs to the end of the reply; a `---` rule closes the question, so prose after
      // it (e.g. "`.bouncer/` is scaffolded") is not a proposed entry.
      const question = prompt.split(/^\s*-{3,}\s*$/m)[0];
      const proposed = [...new Set([...question.matchAll(/`([^`]+\/)`/g)].map((match) => match[1]))];
      if (!Array.isArray(expected) || !proposed.length || !proposed.every((entry) => expected.includes(entry))
        || !workDir) return null;
      // A repository that already has a .gitignore (upstream tasks) gets only the entries it lacks, written
      // as Bouncer's appended marker block. Every expected entry must be either proposed or already ignored,
      // and nothing proposed may already be there.
      const ignored = existsSync(path.join(workDir, '.gitignore'))
        ? readFileSync(path.join(workDir, '.gitignore'), 'utf8').split('\n').map((line) => line.trim().replace(/\/+$/, ''))
        : [];
      const present = (entry) => ignored.includes(entry.replace(/\/+$/, ''));
      if (proposed.some(present) || !expected.every((entry) => proposed.includes(entry) || present(entry))) return null;
      return chooseProceed(options, { deny: /\bleave\b|untouched|\bskip\b|그대로|두기|건너/i,
        legacy: /write suggested.*gitignore|add suggested.*gitignore|--write-gitignore/i });
    },
    reason: 'all expected entries present' },
  // Added by 087 after the 1.5.4 policies were approved, so only a policy that states an answer opts in.
  { gate: 'init.pre_commit_hook', phase: 'bouncer-init', cue: /pre-commit hook|pre_commit_hook|커밋 훅/i,
    decide({ policy, options }) {
      const answer = policy.bouncer_decisions?.find((decision) => decision.gate === 'init.pre_commit_hook')?.answer;
      if (answer !== 'install') return null;
      return chooseProceed(options, { require: /install|설치/i, deny: /\bnot\b|don't|않|skip|건너/i,
        legacy: /install.*pre-commit|--pre-commit-hook/i, legacyDeny: /\bnot\b|don't|않|skip|건너/i });
    },
    reason: 'policy installs the git pre-commit hook' },
  { gate: 'plan.discovery', phase: 'bouncer-plan', cue: /discover(?:y)?|핸드오프|handoff/i,
    decide({ policy, prompt, context, options }) {
      const facts = `${context} ${prompt}`;
      if (!taskFact(policy, 'discovery_terms').every((term) => facts.includes(term))
        || /\b(?:deploy|database migration|git push|pull request)\b/i.test(facts)) return null;
      return chooseProceed(options, {
        legacy: /confirm discovery|discovery.*confirm|confirm framing|초안.*확정|framing 승인|프레이밍.*승인|프레이밍으로 진행/i,
        legacyDeny: /revise|revision|but change|수정|변경|cancel|stop/i });
    },
    reason: 'public PRD facts are present' },
  { gate: 'plan.id_allocation', phase: 'bouncer-plan', cue: /\bID allocation\b|ID 할당|suggested.*epic|권장.*ID|^IDs?$/im,
    decide({ policy, options, workDir }) {
      if (!workDir) return null;
      const epicRoot = path.join(workDir, '.bouncer', 'context', 'epics');
      const existing = existsSync(epicRoot) ? readdirSync(epicRoot) : [];
      if (existing.length === 0) {
        return chooseProceed(options, { require: /\b001\b|suggested|권장|제안/i, deny: /\b(?!001\b)\d{3}\b/,
          legacy: /001|suggested|권장/i, legacyDeny: /revise|override|change|수정|다른\s*id/i });
      }
      // A retried plan stage may find the draft an earlier attempt left; reuse only that known draft.
      const draft = taskFact(policy, 'reusable_draft');
      if (!draft) return null;
      const reuse = path.join(epicRoot, draft.epic, 'blueprints', draft.blueprint, 'index.md');
      if (existing.length !== 1 || existing[0] !== draft.epic || !existsSync(reuse)) return null;
      const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const option = labelMatch(options,
        new RegExp(`(?=.*(?:reuse|재사용))(?=.*${escape(draft.epic)})(?=.*${escape(draft.blueprint)})`, 'i'));
      return option ? { option, basis: 'content', reason: 'reuse the sole existing benchmark draft' } : null;
    },
    reason: 'first IDs free' },
  { gate: 'plan.light_scope', phase: 'bouncer-plan', cue: /light scope|light path|경량|light.*full/i,
    decide({ options }) {
      const option = labelMatch(options, /\bfull\b|\bnormal\b|일반|전체/i, /\blight\b|경량|--scale light/i);
      return option ? { option, basis: 'content' } : null;
    },
    reason: 'public CLI contract' },
  { gate: 'plan.verify_command', phase: 'bouncer-plan', cue: /verify command|검증 명령|bouncer.verify/i,
    decide({ options, workDir }) {
      if (packageTestScript(workDir) === 'node --test') {
        return chooseProceed(options, { require: /npm test/, deny: /unset|\bleave\b|different|다른|않/i,
          legacy: /set\s+`?bouncer\.verify:\s*npm test`?/i, legacyDeny: /leave unset|different|다른/i });
      }
      // Other projects (upstream tasks): the recommended option must name one of the repository's own
      // package.json scripts, as `npm test` or `npm run <script>`.
      const scripts = packageScripts(workDir);
      if (!scripts) return null;
      const named = { test: (label) => {
        const match = label.match(/npm (?:run )?([\w:-]+)/);
        return Boolean(match && (match[1] === 'test' ? scripts.test : match[0].startsWith('npm run') && scripts[match[1]]));
      } };
      const choice = chooseProceed(options, { require: named, deny: /unset|\bleave\b|different|다른|않/i });
      return choice && choice.basis === 'recommended' ? choice : null;
    },
    reason: 'package test script' },
  { gate: 'plan.affected_paths', phase: 'bouncer-plan',
    cue: { test: (text) => /affected_paths|affected paths|영향 경로/i.test(text) && !APPROVAL_CUE.test(text) },
    decide({ policy, prompt, context, options }) {
      const choice = chooseProceed(options, { legacy: /confirm|approve|확정|승인/i, legacyDeny: /revise|edit|수정/i });
      if (!choice) return null;
      const inQuestion = proposedPaths(prompt);
      const proposed = inQuestion.length ? inQuestion : proposedPaths(lastSection(context));
      const allowed = policy.task_facts.product_paths ?? [];
      const outside = proposed.filter((entry) => !allowed.includes(entry));
      return { ...choice, reason: `confirmed as proposed without filtering: ${proposed.join(', ') || '(none parsed)'}`
        + (outside.length ? `; outside product_paths: ${outside.join(', ')}` : '') };
    } },
  { gate: 'plan.activate_pointer', phase: 'bouncer-plan',
    cue: /activate pointer|current pointer|포인터|pointer.{0,20}(?:\bset\b|설정|활성)|(?:\bset\b|설정).{0,20}pointer/i,
    decide({ prompt, options, workDir }) {
      const state = workDir ? bouncerJson(workDir, ['current']) : null;
      const ready = state?.ok === true && state.current === null && Array.isArray(state.ready) ? state.ready : [];
      if (ready.length !== 1) return null;
      const target = ready[0].blueprint;
      if (!prompt.includes(target) && !prompt.includes(path.posix.basename(target))) return null;
      const otherTarget = (label) => /다른|\bother\b|another/i.test(label)
        || (/\.bouncer\/context\/epics\//.test(label) && !label.includes(target));
      return chooseProceed(options, { deny: { test: otherTarget },
        legacy: /current --set|set.*pointer|포인터.*설정/i, legacyDeny: { test: otherTarget } });
    },
    reason: 'sole ready blueprint; --set runs the plan gate' },
  { gate: 'plan.approval', phase: 'bouncer-plan', cue: APPROVAL_CUE,
    decide({ options }) {
      return chooseProceed(options, { legacy: /approve|승인/i, legacyDeny: /revise|수정|cancel|취소/i });
    },
    reason: 'benchmark policy approves the presented plan; quality is measured by gates and tests' },
  { gate: 'run.start_drive', phase: 'bouncer-run',
    cue: /start drive|delegate.*(?:drive|coordinator)|hand.*coordinator|드라이브|coordinator.{0,20}(?:위임|맡)|(?:위임|맡).{0,20}coordinator/i,
    decide({ options, workDir }) {
      const choice = chooseProceed(options, { legacy: /start drive|start|시작/i, legacyDeny: /revise|수정/i });
      return choice && planGateEvidence(workDir) ? choice : null;
    },
    reason: 'plan gate passed' },
  { gate: 'finalize.remainder', phase: 'bouncer-finalize', cue: /remainder|남은.*커밋|commit.*worktree|finalize --yes/i,
    decide({ options, workDir, deps }) {
      // 증거 판정을 주입할 수 있게 한 이유: 실제 판정은 git·drive를 띄우므로 재생 테스트가 대신 값을 넣는다.
      if (!(deps?.finalizeEvidence ?? finalizeEvidence)(workDir)) return null;
      // v3 정책은 finalize --yes 커밋(A)으로 답한다. 하네스가 브랜치 ref에서 증거를 모으므로 worktree 제거와 무관하다.
      return chooseProceed(options, { require: /finalize --yes/i });
    },
    reason: 'prepare and dry-run passed' },
  { gate: 'finalize.pr', phase: 'bouncer-finalize', cue: /pull request|\bPR\b|푸시/i,
    decide({ options }) {
      const option = labelMatch(options, /local only|no pr|do not create|skip pr|로컬만|생성하지/i);
      return option ? { option, basis: 'content' } : null;
    },
    reason: 'external push and PR denied' },
];

// rules/acq.md puts the gate ID in every display heading (`**AskUserQuestion — plan.discovery**`) and in a
// host question's title. An ID is authoritative: it selects the gate without cue matching.
const GATE_ID = /(?:AskUserQuestion\s*[—:-]\s*|^\s*)`?((?:init|plan|execute|commit|run|finalize)\.[a-z_]+)`?(?![\w.])/;

function gateIdOf(text) {
  return GATE_ID.exec(String(text ?? ''))?.[1] ?? null;
}

function classifyGate(phase, cueText) {
  return gates.find((candidate) => candidate.phase === phase && candidate.cue.test(cueText)) ?? null;
}

// A task policy may answer questions about its pre-task state (ledger-003's staged user WIP) so the run
// can reach finalize. Only questions matching `cue` are answered: the one option matching `prefer` and
// not `deny`, otherwise the first option. Every such answer is marked synthetic in the decision record.
function decideTaskQuestion(policy, question) {
  const rule = policy.task_facts?.task_questions;
  const options = question.options ?? [];
  // Only the question itself: earlier turn text may mention the WIP without this question being about it.
  const text = `${question.heading ?? ''} ${question.prompt ?? ''}`;
  if (!rule || options.length < 2 || !new RegExp(rule.cue, 'i').test(text)) return null;
  const preferred = labelMatch(options, new RegExp(rule.prefer, 'i'), new RegExp(rule.deny, 'i'));
  const option = preferred ?? options[0];
  return { gate: 'task.pre_task_state', identified_by: 'task_cue', optionId: option.id, synthetic: true,
    basis: preferred ? 'prefer' : 'first_option',
    reason: `pre-task state question answered by policy (${preferred ? 'keeps the user work' : 'first option'})` };
}

/**
 * 질문 하나에 대해 gate 정책 답을 먼저, 없으면 task 질문 답을 고른다.
 *
 * @param {object} policy - loadPolicy가 돌려준 평가자 정책
 * @param {string} phase - 현재 단계 이름(예: bouncer-finalize)
 * @param {object} question - prompt·options·heading 등을 가진 질문
 * @param {string} workDir - 증거 판정이 읽는 작업 디렉터리
 * @param {{finalizeEvidence?: (workDir: string) => boolean}} [deps] - finalize 증거 판정 주입(없으면 실제 spawn 경로)
 * @returns {object | null} 선택 결과. 답할 수 없으면 null
 */
function decideQuestion(policy, phase, question, workDir, deps = {}) {
  return decideGateQuestion(policy, phase, question, workDir, deps) ?? decideTaskQuestion(policy, question);
}

// A question belongs to the first gate whose cue matches; a gate that cannot decide stops for a human
// instead of letting a later gate claim the question.
/**
 * 질문이 속한 gate를 찾아 그 gate의 decide로 선택지를 고른다.
 *
 * @param {object} policy - 평가자 정책
 * @param {string} phase - 현재 단계 이름
 * @param {object} question - 질문
 * @param {string} workDir - 작업 디렉터리
 * @param {{finalizeEvidence?: (workDir: string) => boolean}} [deps] - gate의 decide로 그대로 넘기는 주입점
 * @returns {object | null} 선택 결과. gate가 없거나 판단하지 못하면 null
 */
function decideGateQuestion(policy, phase, question, workDir, deps = {}) {
  const options = question.options ?? [];
  const prompt = `${question.prompt ?? ''} ${options.map((o) => o.label).join(' ')}`;
  if (phase === 'bouncer-finalize' && /quiz|퀴즈|\bQ\s*\d+\b|문항\s*\d+/i.test(prompt) && options.length === 3
    && !/remainder|finalize --yes|pull request|next blueprint|다음 블루프린트/i.test(prompt)) {
    return { gate: 'finalize.quiz', optionId: options[0].id,
      synthetic: true, reason: 'first option selected for benchmark quiz' };
  }
  const id = gateIdOf(question.heading ?? question.title ?? question.header);
  if (id) {
    // A named gate this stage has no policy for stops for a human; it never falls back to cue guessing.
    const named = gates.find((candidate) => candidate.gate === id && candidate.phase === phase);
    return named ? decideWith(named, 'gate_id') : null;
  }
  // Legacy displays without an ID: a heading that names a gate wins over a Re-ground line that previews the
  // next step, and a bare `**AskUserQuestion:**` falls back to the section it closes.
  const gate = (question.heading && classifyGate(phase, question.heading))
    ?? classifyGate(phase, question.cue ?? prompt)
    ?? (question.section ? classifyGate(phase, question.section) : null);
  return gate ? decideWith(gate, 'cue') : null;

  function decideWith(chosen, identifiedBy) {
    const choice = chosen.decide({ policy, prompt, context: question.context ?? '', options, workDir, deps });
    if (!choice) return null;
    return { gate: chosen.gate, identified_by: identifiedBy, optionId: choice.option.id, basis: choice.basis,
      reason: choice.reason ?? chosen.reason };
  }
}

function answerAskQuestion(policy, phase, params, workDir) {
  if (!Array.isArray(params?.questions) || params.questions.length === 0) return null;
  const quizCue = `${params.title ?? ''} ${params.prompt ?? ''} ${params.questions
    .map((question) => question.prompt ?? '').join(' ')}`;
  if (phase === 'bouncer-finalize'
    && policy.benchmark_choices?.finalize_quiz === 'first_option_for_each_presented_question'
    && /\bquiz\b|퀴즈|\bQ\s*\d+\b|문항\s*\d+/i.test(quizCue)) {
    if (params.questions.length > 10 || params.questions.some((question) => question.options?.length !== 3)) {
      return null;
    }
    return {
      outcome: { outcome: 'answered', answers: params.questions.map((question) => ({
        questionId: question.id, selectedOptionIds: [question.options[0].id],
      })) },
      decisions: params.questions.map((question, index) => ({ gate: 'finalize.quiz', synthetic: true,
        question_number: index + 1, question_count: params.questions.length,
        optionId: question.options[0].id, reason: 'first option selected for benchmark quiz' })),
    };
  }
  const decisions = params.questions.map((question) => ({
    question, decision: decideQuestion(policy, phase, question, workDir),
  }));
  if (decisions.some(({ decision }) => !decision)) return null;
  return {
    outcome: {
      outcome: 'answered',
      answers: decisions.map(({ question, decision }) => ({
        questionId: question.id, selectedOptionIds: [decision.optionId],
      })),
    },
    decisions: decisions.map(({ decision }) => decision),
  };
}

// A quiz request lists numbered questions; a closing summary that only mentions the quiz score does not.
function looksLikeQuizRequest(text) {
  return /\bquiz\b|퀴즈/i.test(text) && /^[\s#>*-]*(?:\*\*)?(?:Q\s*\d+|문항\s*\d+)\b/im.test(text)
    && /답(?:변|해|을)|응답|선택|answer(?:s)?\s*[:：]|answer\s+(?:all|the|these|each|every)\b|(?:please\s+)?(?:reply|respond|provide)\s+(?:with\s+)?(?:(?:your|all|both|the)\s+)?answers?/i.test(text);
}

function answerQuizText(policy, phase, text) {
  if (phase !== 'bouncer-finalize'
    || policy.benchmark_choices?.finalize_quiz !== 'first_option_for_each_presented_question'
    || !looksLikeQuizRequest(text)) return null;
  const questions = [];
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\*\*/g, '').trim();
    const question = line.match(/^(?:#{1,6}\s*)?(?:(?:Q(?:uestion)?|문항)\s*)?(\d{1,2})\s*[).:]\s*(.+)$/i);
    if (question) {
      if (current) questions.push(current);
      current = { number: Number(question[1]), options: [] };
      continue;
    }
    const option = line.match(/^(?:[-*]\s*)?([A-C])\s*[).:]\s*\S/i);
    if (option && current) current.options.push(option[1].toUpperCase());
  }
  if (current) questions.push(current);
  if (questions.length < 1 || questions.length > 10
    || questions.some((question, index) => question.number !== index + 1
      || question.options.join(',') !== 'A,B,C')) return null;
  return {
    gate: 'finalize.quiz', synthetic: true, question_count: questions.length,
    choices: questions.map((question) => ({ question_number: question.number, option: 'A' })),
    reply: questions.map((question) => `${question.number}: A`).join('\n'),
    reason: 'first option selected for each presented benchmark quiz question',
  };
}

function optionsOf(block) {
  return [...block.matchAll(/^\s*[-*]\s*(?:\*\*)?([A-Z])\)(?:\*\*)?\s*(.+)$/gm)]
    .map((match) => ({ id: match[1], label: match[2].replace(/\*\*/g, '').trim() }));
}

// Bold title lines (`**IDs**`) that each head their own A) B) C) list.
function optionGroups(block) {
  const titles = [...block.matchAll(/^\s*\*\*([^*\n]+)\*\*\s*$/gm)];
  const groups = titles.map((match, index) => {
    const body = block.slice(match.index, titles[index + 1]?.index ?? block.length);
    return { title: match[1].trim(), body, options: optionsOf(body) };
  });
  return groups.filter((group) => group.options.length >= 2);
}

// rules/acq.md asks for a bold `**AskUserQuestion — <gate-id>**` line; agents sometimes write it as a
// Markdown heading (`### AskUserQuestion — \`finalize.remainder\``) instead. Both open a question.
const ACQ_MARKER = /\*\*AskUserQuestion[^*\n]*\*\*|^#{1,6}[ \t]+AskUserQuestion\b[^\n]*$/gm;

// Option lines such as `- **A)** ...`, `A) ...`, or `- A) ...`.
// Numbered options (`1)`) are read too, so an unrecognised numbered question stops for a human.
const OPTION_LINE = /^\s*(?:[-*]\s*)?(?:\*\*)?(?:[A-Z]|\d+)\)(?:\*\*)?\s*\S/;
const REPLY_CUE = /reply with|answer with|choose|select|pick|답(?:해|변)|선택|골라/i;

const TITLE_LINE = /^\s*(?:#{1,6}\s+\S.*|\*\*[^*\n]+\*\*\s*)$/;

// Agents also end a turn with a lettered choice under some other title (`**Decision — remainder ...**`).
// Without an AskUserQuestion marker, the last run of two or more option lines followed only by a reply
// instruction counts as one question. Its marker is the nearest bold or heading title within the five
// non-empty lines above the options, else the nearest non-empty line. Quiz requests keep their own path.
function trailingQuestion(text) {
  if (looksLikeQuizRequest(text)) return null;
  const lines = text.split('\n');
  let last = lines.length - 1;
  while (last >= 0 && (!lines[last].trim() || (REPLY_CUE.test(lines[last]) && !OPTION_LINE.test(lines[last])))) last--;
  let first = last;
  while (first >= 0 && (OPTION_LINE.test(lines[first]) || !lines[first].trim())) first--;
  const options = lines.slice(first + 1, last + 1).filter((line) => OPTION_LINE.test(line));
  const after = lines.slice(last + 1).join('\n');
  if (options.length < 2 || !REPLY_CUE.test(after) || first < 0) return null;
  let marker = first;
  for (let line = first, seen = 0; line >= 0 && seen < 5; line--) {
    if (!lines[line].trim()) continue;
    seen++;
    if (TITLE_LINE.test(lines[line])) { marker = line; break; }
  }
  const index = lines.slice(0, marker).reduce((sum, line) => sum + line.length + 1, 0);
  return Object.assign([lines[marker]], { index });
}

function acqMarkers(text) {
  // A marker that a word or sentence end runs straight into ("... 뒤 **AskUserQuestion — plan.discovery**로
  // 확정하겠습니다", "... for **AskUserQuestion — plan.discovery**.") only previews a later question. Streamed turns can glue a real marker to the
  // previous sentence, so only what follows the marker decides.
  const markers = [...text.matchAll(ACQ_MARKER)]
    .filter((match) => !/^[\p{L}\p{N}]|^[.,;](?:\s|$)/u.test(text.slice(match.index + match[0].length)));
  if (markers.length) return markers;
  const trailing = trailingQuestion(text);
  return trailing ? [trailing] : [];
}

// Text that names AskUserQuestion but has no marker the responder can read must stop for a human
// rather than end the stage as if nothing was asked.
function unreadQuestion(text) {
  return /AskUserQuestion/.test(text) && acqMarkers(text).length === 0;
}

// Discovery's open decisions (skills/bouncer-plan: "not an ACQ gate") ask about behavior the request leaves
// open, in no fixed format and often without a recommendation. A policy that opts in answers the whole
// message with one neutral line handing each decision back to the agent: it adds no requirement, so the
// agent decides as it would without Bouncer. The answer is synthetic.
const OPEN_DECISIONS_CUE = /\bopen decisions?\b|plan\.open_decisions|열린\s*결정|미정\s*(?:동작|결정)/i;
// Scoped to these open decisions: v154-ledger-004-bouncer-full-4 read an unscoped "decide and proceed" as
// leave to settle every later gate, plan approval included.
const OPEN_DECISIONS_REPLY = '이번 Open decisions 항목에 한해 판단을 맡깁니다(PRD에 정해지지 않은 세부 사항). '
  + '항목마다 권장안을 골라 근거와 함께 Open decisions에 기록하세요. 이후 게이트 결정은 평소처럼 따로 물어 주세요.';

function delegateOpenDecisions(policy, phase, text) {
  if (phase !== 'bouncer-plan' || policy.benchmark_choices?.open_decisions !== 'delegate_to_agent_recommendation') {
    return null;
  }
  // The question is the last `---` section; earlier sections are discovery grounding.
  const rules = [...text.matchAll(/^\s*-{3,}\s*$/gm)];
  const question = rules.length ? text.slice(rules[rules.length - 1].index) : text;
  // Any real question header for another gate (the Discover confirm also lists `Open decisions`) is that
  // gate's question; only an inline preview of the next gate (acqMarkers drops it) may sit beside these.
  const otherGate = acqMarkers(question)
    .some((marker) => /AskUserQuestion/.test(marker[0]) && gateIdOf(marker[0]) !== 'plan.open_decisions');
  // Open-decision options may carry their question number (`- **1A)** ...`) or be numbered alone (`- **1)** ...`).
  const optionLines = question.split('\n')
    .filter((line) => /^\s*(?:[-*]\s*)?(?:\*\*)?(?:\d*[A-Z]|\d+)\)(?:\*\*)?\s*\S/.test(line));
  if (!OPEN_DECISIONS_CUE.test(question) || optionLines.length < 2
    || APPROVAL_CUE.test(question) || otherGate) return null;
  return { gate: 'plan.open_decisions', choices: [{ gate: 'plan.open_decisions', identified_by: 'cue', synthetic: true,
    basis: 'delegated', reason: 'open decisions handed back to the agent; no requirement added' }],
  question: text, reply: OPEN_DECISIONS_REPLY };
}

/**
 * 텍스트로 나온 ACQ 질문 전체에 정책 답을 만든다. 하나라도 답하지 못하면 사람에게 넘기도록 null이다.
 *
 * @param {object} policy - 평가자 정책
 * @param {string} phase - 현재 단계 이름
 * @param {string} text - 에이전트가 낸 질문 본문
 * @param {string} workDir - 작업 디렉터리
 * @param {{finalizeEvidence?: (workDir: string) => boolean}} [deps] - finalize 증거 판정 주입(테스트용)
 * @returns {{gate: string, choices: object[], question: string, reply: string} | null} 답 묶음 또는 null
 */
function answerTextQuestion(policy, phase, text, workDir, deps = {}) {
  const markers = acqMarkers(text);
  if (!markers.length) return null;
  const decisions = [];
  for (let index = 0; index < markers.length; index++) {
    const start = markers[index].index;
    const end = markers[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    const reground = block.match(/\*\*Re-ground\*\*\s*[:：]?\s*(.+)/i)?.[1];
    const context = text.slice(0, start);
    const section = [...context.matchAll(/^#{1,6}\s+(.+)$/gm)].pop()?.[1];
    const groups = optionGroups(block);
    if (groups.length > 1) {
      // One block may bundle several questions as bold-titled option groups; each title names its gate.
      for (const group of groups) {
        const decision = decideQuestion(policy, phase, { prompt: group.body, heading: group.title,
          cue: reground ? `${group.title} ${reground}` : group.title, context, options: group.options }, workDir, deps);
        if (!decision) return null;
        decisions.push(decision);
      }
      continue;
    }
    const options = optionsOf(block);
    if (options.length < 2) return null;
    const cue = reground ? `${markers[index][0]} ${reground}` : undefined;
    const decision = decideQuestion(policy, phase,
      { prompt: block, heading: markers[index][0], cue, section, context, options }, workDir, deps);
    if (!decision) return null;
    decisions.push(decision);
  }
  return {
    gate: decisions.map((decision) => decision.gate).join(','),
    choices: decisions,
    question: text,
    reply: decisions.map((decision) => decision.optionId).join(' / '),
  };
}

function answerPermission(params) {
  const call = params?.toolCall;
  const allow = params?.options?.filter((option) => option.kind === 'allow_once');
  if (!call || allow?.length !== 1) return null;
  const input = `${call.title ?? ''}\n${JSON.stringify(call.rawInput ?? {})}`;
  if (deniedShellReason(input)) return null;
  return { outcome: { outcome: 'selected', optionId: allow[0].optionId }, reason: 'local tool call' };
}

module.exports = { acqMarkers, unreadQuestion, delegateOpenDecisions, driveState, finalizeReady, gateIdOf, gitEnv, loadPolicy, classifyGate, decideQuestion, answerAskQuestion, answerTextQuestion, answerQuizText,
  looksLikeQuizRequest, answerPermission };
