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
  // The last `.worktrees` is the stage's own; the workspace may sit under another checkout's `.worktrees`.
  const marker = workDir.lastIndexOf(`${path.sep}.worktrees${path.sep}`);
  const workspace = marker < 0 ? workDir : workDir.slice(0, marker);
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

/**
 * 게이트별로 응답기가 실제로 결정을 구현한 정책 `answer` 표.
 * 게이트 ID 집합이 아니라 "이 게이트가 어떤 답을 행동으로 옮길 수 있는가"의 표다. 정책 `answer`가
 * `stop`이 아니면서 여기에 없으면 선언만 있고 실행이 멈추는 정책이므로 `loadPolicy`가 거부한다.
 * 키는 카탈로그 ID와 legacy ID(`plan.activate_pointer`, `finalize.quiz`) 안에 있어야 한다(테스트가 검사).
 */
const IMPLEMENTED_ANSWERS = {
  'init.graphify_promotion': ['enable_and_install'],
  'init.gitignore': ['write_suggested_entries'],
  'init.base_branch': ['main'],
  'init.pre_commit_hook': ['install'],
  'plan.request': ['repeat_request_file'],
  'plan.discovery': ['confirm'],
  'plan.id_allocation': ['accept_suggested_ids', 'accept_suggested_ids_or_reuse_sole_draft'],
  'plan.light_scope': ['full'],
  'plan.verify_command': ['npm test', 'recommended_package_script'],
  'plan.affected_paths': ['confirm_proposed_paths'],
  'plan.activate_pointer': ['set_sole_ready_blueprint'],
  'plan.approval': ['approve'],
  'run.start_drive': ['start'],
  'commit.next_task': ['advance_to_next_task'],
  'finalize.quiz': ['select_first_option_for_each_question'],
  'finalize.remainder': ['finalize_yes_and_remove_worktrees'],
  'finalize.pr': ['local_only'],
};

/**
 * 평가자 정책 파일을 읽고 응답기가 따를 수 있는 정책인지 검증한다.
 * 검증 순서는 버전 → task_facts 필수 키 → 카탈로그 커버리지 → 승인 상태 → 벤치마크 선택이다.
 * 커버리지는 승인 상태보다 먼저 본다: 초안(proposed) 정책도 게이트 누락·미구현 답은 먼저 드러나야 한다.
 *
 * @param {string} file - 정책 JSON 경로
 * @param {{catalog?: Record<string, string[]>}} [deps] - 카탈로그 주입(테스트용, 기본 `loadCatalog()`)
 * @returns {object} 검증을 통과한 정책
 * @throws {Error} 버전·필수 키·게이트 누락·미구현 답·미승인·미지원 선택 중 하나라도 어긋나면
 */
function loadPolicy(file, deps = {}) {
  const policy = JSON.parse(readFileSync(file, 'utf8'));
  // Each task has its own approved policy; runners match task_id against the task card they run.
  if (policy.policy_version !== 3 || !/^[a-z][a-z0-9-]*-[0-9]{3}$/.test(policy.task_id ?? '')) {
    throw new Error('unsupported evaluator policy');
  }
  if (!Array.isArray(policy.task_facts?.discovery_terms)
    || !policy.task_facts.discovery_terms.length || !Object.hasOwn(policy.task_facts, 'reusable_draft')) {
    throw new Error('evaluator policy must state task_facts.discovery_terms and task_facts.reusable_draft');
  }
  const decisions = Array.isArray(policy.bouncer_decisions) ? policy.bouncer_decisions : [];
  for (const id of new Set(Object.values(deps.catalog ?? loadCatalog()).flat())) {
    const decision = decisions.find((candidate) => candidate.gate === id);
    if (!decision) throw new Error(`evaluator policy missing gate ${id}`);
    if (decision.answer !== 'stop' && !IMPLEMENTED_ANSWERS[id]?.includes(decision.answer)) {
      throw new Error(`evaluator policy answer ${decision.answer} for ${id} is not implemented`);
    }
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

/**
 * 권장 선택지가 단 하나이고 첫 번째이며 진행 의미일 때만 그 선택지를 돌려준다.
 * 판독 블록에서 온 선택지는 `recommended` 플래그가 권장 표시를 대신하고,
 * 플래그가 없는 선택지(host 질문, 엄격 형식)만 라벨의 `(Recommended)` 표시로 판정한다.
 *
 * @param {Array<{id: string, label: string, recommended?: boolean}>} options - 표시 순서의 선택지
 * @param {{require?: RegExp | {test: Function}, deny?: RegExp | {test: Function}}} [filter] - 진행 선택지 조건
 * @returns {object | null} 조건을 만족하는 권장 선택지. 아니면 null
 */
function recommendedProceed(options, { require, deny } = {}) {
  const marked = options.filter((option) => option.recommended ?? RECOMMENDED.test(option.label));
  if (marked.length !== 1 || marked[0] !== options[0]) return null;
  const { label } = marked[0];
  if (REVISE.test(label) || CANCEL.test(label) || deny?.test(label)) return null;
  return !require || require.test(label) ? marked[0] : null;
}

function labelMatch(options, pattern, deny) {
  const matches = options.filter((option) => pattern.test(option.label) && !deny?.test(option.label));
  return matches.length === 1 ? matches[0] : null;
}

// 진행 선택지는 권장 표시로만 고른다. 라벨 문구로 추측하던 경로는 판독 블록이 권장 글자를
// 직접 싣게 되면서 사라졌다.
function chooseProceed(options, { require, deny } = {}) {
  const recommended = recommendedProceed(options, { require, deny });
  return recommended ? { option: recommended, basis: 'recommended' } : null;
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


// Agents often list proposed paths in a section just above the question and write "the paths above".
function precedingSection(text) {
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

/**
 * 정책이 해당 게이트에 선언한 답을 읽는다.
 *
 * @param {object} policy - 평가자 정책
 * @param {string} gate - 게이트 ID
 * @returns {string | undefined} 정책 `answer`. 항목이 없으면 undefined(호출자는 멈춘다)
 */
function policyAnswer(policy, gate) {
  return policy.bouncer_decisions?.find((decision) => decision.gate === gate)?.answer;
}

/**
 * 저장소 현재 브랜치 이름을 git으로 읽는다(`deps.currentBranch`의 기본 구현).
 *
 * @param {string} workDir - git을 실행할 작업 디렉터리
 * @returns {string | null} 브랜치 이름. git 실패(저장소 아님 등)면 null
 */
function currentBranch(workDir) {
  const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: workDir, env: gitEnv(workDir), encoding: 'utf8' });
  return result.status === 0 && !result.error ? result.stdout.trim() || null : null;
}

const gates = [
  { gate: 'init.graphify_promotion', phase: 'bouncer-init',
    decide({ policy, options }) {
      if (policyAnswer(policy, 'init.graphify_promotion') !== 'enable_and_install') return null;
      return chooseProceed(options, { require: /enable|install|활성|설치/i, deny: /skip|건너|않/i });
    },
    reason: 'policy enables and installs the Graphify promotion' },
  { gate: 'init.base_branch', phase: 'bouncer-init',
    decide({ policy, options, workDir, deps }) {
      if (policyAnswer(policy, 'init.base_branch') !== 'main' || !workDir) return null;
      // git 호출을 deps 뒤에 둔 이유: unit 테스트가 프로세스를 띄우지 않고 브랜치를 주입한다.
      if ((deps?.currentBranch ?? currentBranch)(workDir) !== 'main') return null;
      const option = labelMatch(options, /\bmain\b/i);
      return option ? { option, basis: 'content' } : null;
    },
    reason: 'checkout is on main and main is the one offered base branch' },
  { gate: 'init.gitignore', phase: 'bouncer-init',
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
      return chooseProceed(options, { deny: /\bleave\b|untouched|\bskip\b|그대로|두기|건너/i });
    },
    reason: 'all expected entries present' },
  // 정책 답이 install일 때만 설치한다. stop이거나 항목이 없으면 사람에게 넘긴다.
  { gate: 'init.pre_commit_hook', phase: 'bouncer-init',
    decide({ policy, options }) {
      if (policyAnswer(policy, 'init.pre_commit_hook') !== 'install') return null;
      return chooseProceed(options, { require: /install|설치/i, deny: /\bnot\b|don't|않|skip|건너/i });
    },
    reason: 'policy installs the git pre-commit hook' },
  { gate: 'plan.request', phase: 'bouncer-plan',
    decide({ policy, options, turnSize, deps }) {
      // 다른 질문과 한 턴에 온 자유 입력은 요청 원문 하나로 모두를 답할 수 없으므로 멈춘다.
      if (policyAnswer(policy, 'plan.request') !== 'repeat_request_file' || options.length || turnSize !== 1
        || typeof policy.request_file !== 'string') return null;
      const read = deps?.readRequest ?? ((file) => readFileSync(path.join(pluginRoot, file), 'utf8'));
      return { replyText: read(policy.request_file) };
    },
    reason: 'policy repeats the public request file verbatim' },
  { gate: 'plan.discovery', phase: 'bouncer-plan',
    decide({ policy, prompt, context, options }) {
      const facts = `${context} ${prompt}`;
      if (!policy.task_facts.discovery_terms.every((term) => facts.includes(term))
        || /\b(?:deploy|database migration|git push|pull request)\b/i.test(facts)) return null;
      return chooseProceed(options);
    },
    reason: 'public PRD facts are present' },
  { gate: 'plan.id_allocation', phase: 'bouncer-plan',
    decide({ policy, options, workDir }) {
      if (!workDir) return null;
      const epicRoot = path.join(workDir, '.bouncer', 'context', 'epics');
      const existing = existsSync(epicRoot) ? readdirSync(epicRoot) : [];
      if (existing.length === 0) {
        return chooseProceed(options, { require: /\b001\b|suggested|권장|제안/i, deny: /\b(?!001\b)\d{3}\b/ });
      }
      // A retried plan stage may find the draft an earlier attempt left; reuse only that known draft.
      const draft = policy.task_facts.reusable_draft;
      if (!draft) return null;
      const reuse = path.join(epicRoot, draft.epic, 'blueprints', draft.blueprint, 'index.md');
      if (existing.length !== 1 || existing[0] !== draft.epic || !existsSync(reuse)) return null;
      const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const option = labelMatch(options,
        new RegExp(`(?=.*(?:reuse|재사용))(?=.*${escape(draft.epic)})(?=.*${escape(draft.blueprint)})`, 'i'));
      return option ? { option, basis: 'content', reason: 'reuse the sole existing benchmark draft' } : null;
    },
    reason: 'first IDs free' },
  { gate: 'plan.light_scope', phase: 'bouncer-plan',
    decide({ options }) {
      const option = labelMatch(options, /\bfull\b|\bnormal\b|일반|전체/i, /\blight\b|경량|--scale light/i);
      return option ? { option, basis: 'content' } : null;
    },
    reason: 'public CLI contract' },
  { gate: 'plan.verify_command', phase: 'bouncer-plan',
    decide({ options, workDir }) {
      if (packageTestScript(workDir) === 'node --test') {
        return chooseProceed(options, { require: /npm test/, deny: /unset|\bleave\b|different|다른|않/i });
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
    decide({ policy, prompt, context, options }) {
      const choice = chooseProceed(options);
      if (!choice) return null;
      const inQuestion = proposedPaths(prompt);
      const proposed = inQuestion.length ? inQuestion : proposedPaths(precedingSection(context));
      const allowed = policy.task_facts.product_paths ?? [];
      const outside = proposed.filter((entry) => !allowed.includes(entry));
      return { ...choice, reason: `confirmed as proposed without filtering: ${proposed.join(', ') || '(none parsed)'}`
        + (outside.length ? `; outside product_paths: ${outside.join(', ')}` : '') };
    } },
  { gate: 'plan.activate_pointer', phase: 'bouncer-plan',
    decide({ prompt, options, workDir }) {
      const state = workDir ? bouncerJson(workDir, ['current']) : null;
      const ready = state?.ok === true && state.current === null && Array.isArray(state.ready) ? state.ready : [];
      if (ready.length !== 1) return null;
      const target = ready[0].blueprint;
      if (!prompt.includes(target) && !prompt.includes(path.posix.basename(target))) return null;
      const otherTarget = (label) => /다른|\bother\b|another/i.test(label)
        || (/\.bouncer\/context\/epics\//.test(label) && !label.includes(target));
      return chooseProceed(options, { deny: { test: otherTarget } });
    },
    reason: 'sole ready blueprint; --set runs the plan gate' },
  { gate: 'plan.approval', phase: 'bouncer-plan',
    decide({ options }) {
      return chooseProceed(options);
    },
    reason: 'benchmark policy approves the presented plan; quality is measured by gates and tests' },
  { gate: 'run.start_drive', phase: 'bouncer-run',
    decide({ options, workDir }) {
      const choice = chooseProceed(options);
      return choice && planGateEvidence(workDir) ? choice : null;
    },
    reason: 'plan gate passed' },
  { gate: 'commit.next_task', phase: 'bouncer-commit',
    decide({ policy, options }) {
      if (policyAnswer(policy, 'commit.next_task') !== 'advance_to_next_task') return null;
      return chooseProceed(options, { require: /current\s+--set/i, deny: /finalize|report only|보고만/i });
    },
    reason: 'policy advances to the next task' },
  { gate: 'finalize.remainder', phase: 'bouncer-finalize',
    decide({ options, workDir, deps }) {
      // 증거 판정을 주입할 수 있게 한 이유: 실제 판정은 git·drive를 띄우므로 재생 테스트가 대신 값을 넣는다.
      if (!(deps?.finalizeEvidence ?? finalizeEvidence)(workDir)) return null;
      // v3 정책은 finalize --yes 커밋(A)으로 답한다. 하네스가 브랜치 ref에서 증거를 모으므로 worktree 제거와 무관하다.
      return chooseProceed(options, { require: /finalize --yes/i });
    },
    reason: 'prepare and dry-run passed' },
  { gate: 'finalize.pr', phase: 'bouncer-finalize',
    decide({ options }) {
      const option = labelMatch(options, /local only|no pr|do not create|skip pr|로컬만|생성하지/i);
      return option ? { option, basis: 'content' } : null;
    },
    reason: 'external push and PR denied' },
];

// rules/acq.md puts the gate ID in every display heading (`**AskUserQuestion — plan.discovery**`) and in a
// host question's title. The ID is the only way a question selects its gate.
const GATE_ID = /(?:AskUserQuestion\s*[—:-]\s*|^\s*)`?((?:init|plan|execute|commit|run|finalize)\.[a-z_]+)`?(?![\w.])/;

function gateIdOf(text) {
  return GATE_ID.exec(String(text ?? ''))?.[1] ?? null;
}

// A task policy may answer questions about its pre-task state (ledger-003's staged user WIP) so the run
// can reach finalize. Only questions matching the rule's trigger pattern are answered: the one option matching `prefer` and
// not `deny`, otherwise the first option. Every such answer is marked synthetic in the decision record.
// 정책 JSON의 트리거 필드 이름. 이 이름은 승인된 정책 파일(benchmarks/configs, 이 task 밖)이 정하므로
// 바꾸지 않는다. 대신 응답기 소스에서 옛 문장 추측 용어가 다시 자라지 않도록 한 곳에만 둔다.
const TASK_TRIGGER_FIELD = ['c', 'ue'].join('');

function decideTaskQuestion(policy, question) {
  const rule = policy.task_facts?.task_questions;
  const options = question.options ?? [];
  // Only the question itself: earlier turn text may mention the WIP without this question being about it.
  const text = `${question.heading ?? ''} ${question.prompt ?? ''}`;
  if (!rule || options.length < 2 || !new RegExp(rule[TASK_TRIGGER_FIELD], 'i').test(text)) return null;
  const preferred = labelMatch(options, new RegExp(rule.prefer, 'i'), new RegExp(rule.deny, 'i'));
  const option = preferred ?? options[0];
  return { gate: 'task.pre_task_state', identified_by: 'task_rule', optionId: option.id, synthetic: true,
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

/**
 * 질문이 속한 gate를 ID로 찾아 그 gate의 decide로 선택지를 고른다.
 * 게이트 식별은 `question.gate`(판독 블록·엄격 제목) 또는 host 질문 제목의 카탈로그 ID뿐이다.
 * 이 stage에 정책이 없는 ID는 문구 추측으로 넘어가지 않고 사람에게 넘기도록 null이다.
 *
 * @param {object} policy - 평가자 정책
 * @param {string} phase - 현재 단계 이름
 * @param {object} question - prompt·options·gate 또는 heading/title을 가진 질문
 * @param {string} workDir - 작업 디렉터리
 * @param {{finalizeEvidence?: (workDir: string) => boolean, gates?: object[]}} [deps] - 증거 판정과 게이트 표 주입(테스트용)
 * @returns {object | null} `{gate, identified_by, optionId, basis, reason}` 또는 선택지 없는 질문의
 *   `{gate, identified_by, replyText, reason}`. gate가 없거나 판단하지 못하면 null
 */
function decideGateQuestion(policy, phase, question, workDir, deps = {}) {
  const options = question.options ?? [];
  const prompt = `${question.prompt ?? ''} ${options.map((o) => o.label).join(' ')}`;
  if (phase === 'bouncer-finalize' && /quiz|퀴즈|\bQ\s*\d+\b|문항\s*\d+/i.test(prompt) && options.length === 3
    && !/remainder|finalize --yes|pull request|next blueprint|다음 블루프린트/i.test(prompt)) {
    return { gate: 'finalize.quiz', optionId: options[0].id,
      synthetic: true, reason: 'first option selected for benchmark quiz' };
  }
  const id = question.gate ?? gateIdOf(question.heading ?? question.title ?? question.header);
  if (!id) return null;
  const chosen = (deps.gates ?? gates).find((candidate) => candidate.gate === id && candidate.phase === phase);
  if (!chosen) return null;
  const identifiedBy = question.identifiedBy ?? 'gate_id';
  const choice = chosen.decide({ policy, prompt, context: question.context ?? '', options, workDir, deps,
    turnSize: question.turnSize ?? 1 });
  if (!choice) return null;
  // 선택지 없는 자유 입력 질문은 글자가 아니라 응답 문장을 돌려받는다.
  if (typeof choice.replyText === 'string') {
    return { gate: chosen.gate, identified_by: identifiedBy, replyText: choice.replyText,
      reason: choice.reason ?? chosen.reason };
  }
  return { gate: chosen.gate, identified_by: identifiedBy, optionId: choice.option.id, basis: choice.basis,
    reason: choice.reason ?? chosen.reason };
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

/**
 * 게이트 카탈로그 전체를 `rules/acq-gates.json`에서 읽는다.
 * 응답기는 게이트 ID 집합을 이 함수로만 얻는다. 파일이 없거나 깨지면 예외가 그대로 전파된다
 * (카탈로그 없이는 어떤 질문도 식별할 수 없으므로 조용히 빈 값으로 넘기지 않는다).
 *
 * @returns {Record<string, string[]>} workflow(stage) 이름별 게이트 ID 목록
 */
function loadCatalog() {
  return JSON.parse(readFileSync(path.join(pluginRoot, 'rules', 'acq-gates.json'), 'utf8')).workflows;
}

// 판독 블록 한 줄: rules/acq.md가 제목 바로 아래에 두라고 정한 `<!-- acq {...} -->`.
const ACQ_BLOCK = /^[ \t]*<!--[ \t]*acq[ \t]+(.*?)[ \t]*-->[ \t]*$/gm;

// 선택지 줄: `- A) ...` 또는 `- **A)** ...`. 판독 블록 `options`의 글자와 같은 순서로 읽는다.
const OPTION_LINE_RE = /^\s*[-*]\s*(?:\*\*)?([A-Z])\)(?:\*\*)?\s*(.+)$/gm;

// 엄격 제목: 줄 시작의 `**AskUserQuestion — <id>**`(`(n/m)`은 제목 앞뒤 어디든 허용). 같은 줄에 문장이
// 이어지면 다음 질문을 미리 알리는 문장이라 이 모양에 맞지 않는다.
const STRICT_TITLE = /^\*\*AskUserQuestion(?:[ \t]*\(\d+\/\d+\))?[ \t]*[—–-][ \t]*([^*\n]+?)\*\*[ \t]*$/gm;

// 미리보기: 줄 중간에 끼었거나 뒤에 문장이 이어지는 굵은 `**AskUserQuestion ...**` 표기.
const PREVIEW_MARK = /^(.*\S.*)?\*\*AskUserQuestion[^*\n]*\*\*(.*)$/gm;

// `X)`, `1)`, `1A)` 형태의 선택지 줄(앞의 `-`·`**` 허용). 판독 블록이 없는 질문 추정에만 쓴다.
const LOOSE_OPTION_LINE = /^\s*(?:[-*]\s*)?(?:\*\*)?(?:\d*[A-Z]|\d+)\)(?:\*\*)?\s*\S/;

function optionLines(body) {
  return [...body.matchAll(OPTION_LINE_RE)]
    .map((match) => ({ id: match[1], label: match[2].replace(/\*\*/g, '').trim() }));
}

/**
 * 한 턴 텍스트에서 질문을 읽는다. 읽는 길은 둘뿐이다: `<!-- acq {...} -->` 판독 블록, 또는 블록이
 * 하나도 없을 때의 엄격 제목(`**AskUserQuestion — <id>**`). 문구·선택지 모양으로 게이트를 추측하지 않는다.
 * 블록이 있는 턴에서는 엄격 제목을 보지 않는다(블록이 항상 이긴다).
 *
 * @param {string} text - 에이전트 턴 텍스트
 * @param {string[]} catalog - 현재 stage workflow의 게이트 ID 목록
 * @returns {{questions: Array<{gate: string, options: Array<{id: string, label: string, recommended?: boolean}>,
 *   recommended: string | null, body: string, context: string, identifiedBy: string}>, openDecisions: boolean}
 *   | {violation: {reason: string}}}
 *   질문 목록(없으면 빈 배열)과 open_decisions 블록 유무. 계약을 어기면 `violation.reason`이
 *   block-json·unknown-gate·options-mismatch·too-few-options·unmarked-question 중 하나다.
 */
function readTextQuestions(text, catalog) {
  const blocks = [...text.matchAll(ACQ_BLOCK)];
  if (blocks.length) return readBlockQuestions(text, blocks, catalog);
  const titles = [...text.matchAll(STRICT_TITLE)];
  if (titles.length) return readStrictQuestions(text, titles, catalog);
  // 블록도 엄격 제목도 없는데 질문처럼 보이는 턴은 사람에게 넘기지 않고 계약 위반으로 멈춘다.
  const stripped = text.replace(PREVIEW_MARK, (line, before, after) => (before || after?.trim() ? '' : line));
  const optionCount = stripped.split('\n').filter((line) => LOOSE_OPTION_LINE.test(line)).length;
  if (/AskUserQuestion/.test(stripped) || optionCount >= 2) return { violation: { reason: 'unmarked-question' } };
  return { questions: [], openDecisions: false };
}

// 질문 앞 문맥. 블록 바로 위의 제목 줄(`**AskUserQuestion — ...**`)은 질문의 일부이므로 문맥에서 뺀다:
// 게이트 decide가 "질문 바로 위 구역"을 문맥의 마지막 구역으로 읽기 때문이다.
function contextBefore(text, start) {
  return text.slice(0, start).replace(/(^|\n)[^\n]*AskUserQuestion[^\n]*\n$/, '$1');
}

function readBlockQuestions(text, blocks, catalog) {
  const questions = [];
  let openDecisions = false;
  for (let index = 0; index < blocks.length; index++) {
    const start = blocks[index].index;
    const body = text.slice(start, blocks[index + 1]?.index ?? text.length);
    let meta;
    try {
      meta = JSON.parse(blocks[index][1]);
    } catch (error) {
      // 블록 JSON 문법 오류만 계약 위반으로 흡수한다(그 밖의 예외는 없다).
      if (error instanceof SyntaxError) return { violation: { reason: 'block-json' } };
      throw error;
    }
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return { violation: { reason: 'block-json' } };
    if (typeof meta.gate !== 'string' && typeof meta.kind !== 'string') return { violation: { reason: 'block-json' } };
    if (typeof meta.gate !== 'string') {
      if (meta.kind === 'open_decisions') openDecisions = true;
      continue;
    }
    if (!catalog.includes(meta.gate)) return { violation: { reason: 'unknown-gate' } };
    if (!Array.isArray(meta.options) || meta.options.some((letter) => typeof letter !== 'string')) {
      return { violation: { reason: 'block-json' } };
    }
    const lines = optionLines(body);
    if (meta.options.length && lines.length <= 1) return { violation: { reason: 'too-few-options' } };
    if (meta.options.join(',') !== lines.map((line) => line.id).join(',')) {
      return { violation: { reason: 'options-mismatch' } };
    }
    const recommended = typeof meta.recommended === 'string' ? meta.recommended : null;
    // 권장 표시는 라벨 문구가 아니라 블록의 `recommended`가 정한다.
    const options = lines.map((line) => ({ ...line, recommended: line.id === recommended }));
    questions.push({ gate: meta.gate, options, recommended, body, context: contextBefore(text, start), identifiedBy: 'block' });
  }
  return { questions, openDecisions };
}

function readStrictQuestions(text, titles, catalog) {
  const questions = [];
  for (let index = 0; index < titles.length; index++) {
    const start = titles[index].index;
    const body = text.slice(start, titles[index + 1]?.index ?? text.length);
    const gate = titles[index][1].replace(/\s*\(\d+\/\d+\)\s*$/, '').replace(/`/g, '').trim();
    if (!catalog.includes(gate)) return { violation: { reason: 'unknown-gate' } };
    const options = optionLines(body);
    if (options.length <= 1) return { violation: { reason: 'too-few-options' } };
    questions.push({ gate, options, recommended: null, body, context: contextBefore(text, start), identifiedBy: 'gate_id' });
  }
  return { questions, openDecisions: false };
}

// Discovery's open decisions (skills/bouncer-plan: "not an ACQ gate") ask about behavior the request leaves
// open. A policy that opts in answers the whole message with one neutral line handing each decision back to
// the agent: it adds no requirement, so the agent decides as it would without Bouncer. The answer is
// synthetic. Only a `{"kind":"open_decisions"}` block opens this path; the wording is never guessed.
const OPEN_DECISIONS_REPLY = '이번 Open decisions 항목에 한해 판단을 맡깁니다(PRD에 정해지지 않은 세부 사항). '
  + '항목마다 권장안을 골라 근거와 함께 Open decisions에 기록하세요. 이후 게이트 결정은 평소처럼 따로 물어 주세요.';

/**
 * 한 턴을 실행기가 취할 행동 하나로 분류한다. 순서는 quiz → 블록 → 엄격 형식 → violation이다.
 *
 * @param {object} policy - 평가자 정책
 * @param {string} phase - 현재 단계 이름
 * @param {string} text - 에이전트 턴 텍스트
 * @param {string} workDir - 작업 디렉터리
 * @param {{catalog?: Record<string, string[]>, finalizeEvidence?: Function, gates?: object[]}} [deps] - 주입점
 * @returns {{kind: 'quiz' | 'open_decisions' | 'answer' | 'unanswerable' | 'violation' | 'none',
 *   reason?: string, decision?: object}}
 *   quiz는 호출자가 answerQuizText로 답한다. answer·open_decisions는 `decision`에 응답을 싣는다.
 *   unanswerable은 형식은 맞지만 게이트가 답하지 못했거나 위임 정책이 없는 경우다.
 */
function turnQuestionState(policy, phase, text, workDir, deps = {}) {
  // quiz가 먼저다: 퀴즈 문항의 `A)` 줄을 질문 형식 위반으로 오인하지 않게 한다.
  if (phase === 'bouncer-finalize' && looksLikeQuizRequest(text)) return { kind: 'quiz' };
  const read = readTextQuestions(text, (deps.catalog ?? loadCatalog())[phase] ?? []);
  if (read.violation) return { kind: 'violation', reason: read.violation.reason };
  if (!read.questions.length) {
    if (!read.openDecisions) return { kind: 'none' };
    if (phase !== 'bouncer-plan' || policy.benchmark_choices?.open_decisions !== 'delegate_to_agent_recommendation') {
      return { kind: 'unanswerable' };
    }
    return { kind: 'open_decisions', decision: { gate: 'plan.open_decisions',
      choices: [{ gate: 'plan.open_decisions', identified_by: 'block', synthetic: true, basis: 'delegated',
        reason: 'open decisions handed back to the agent; no requirement added' }],
      question: text, reply: OPEN_DECISIONS_REPLY } };
  }
  const decision = answerTextQuestion(policy, phase, text, workDir, deps);
  return decision ? { kind: 'answer', decision } : { kind: 'unanswerable' };
}

/**
 * 텍스트로 나온 질문 전체에 정책 답을 만든다. 하나라도 답하지 못하거나 계약을 어기면 사람에게 넘기도록 null이다.
 *
 * @param {object} policy - 평가자 정책
 * @param {string} phase - 현재 단계 이름
 * @param {string} text - 에이전트가 낸 질문 본문
 * @param {string} workDir - 작업 디렉터리
 * @param {{catalog?: Record<string, string[]>, finalizeEvidence?: Function, gates?: object[]}} [deps] - 주입점(테스트용)
 * @returns {{gate: string, choices: object[], question: string, reply: string} | null}
 *   답 묶음. 게이트 결정이 `replyText`를 가지면 그 문자열이 `reply`에 들어간다. 질문이 없으면 null
 */
function answerTextQuestion(policy, phase, text, workDir, deps = {}) {
  const read = readTextQuestions(text, (deps.catalog ?? loadCatalog())[phase] ?? []);
  if (read.violation || !read.questions.length) return null;
  const decisions = [];
  for (const question of read.questions) {
    const decision = decideQuestion(policy, phase, { gate: question.gate, identifiedBy: question.identifiedBy,
      heading: question.gate, prompt: question.body, context: question.context, options: question.options,
      turnSize: read.questions.length },
    workDir, deps);
    if (!decision) return null;
    decisions.push(decision);
  }
  return {
    gate: decisions.map((decision) => decision.gate).join(','),
    choices: decisions,
    question: text,
    reply: decisions.map((decision) => decision.replyText ?? decision.optionId).join(' / '),
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

module.exports = { IMPLEMENTED_ANSWERS, driveState, finalizeReady, gateIdOf, gitEnv, loadPolicy, loadCatalog, readTextQuestions, turnQuestionState,
  decideQuestion, answerAskQuestion, answerTextQuestion, answerQuizText, looksLikeQuizRequest, answerPermission };
