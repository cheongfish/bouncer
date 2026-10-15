'use strict';

const { existsSync, statSync } = require('node:fs');
const path = require('node:path');

// Stage prompts and CLI arguments shared by the ACP and print-mode stage runners.
const stages = new Map([
  ['bouncer-init', 'Invoke /bouncer-init for the supplied PRD. Set subagents.provider to cursor and '
    + 'subagents.dispatch to "print" in .bouncer/config.json. '
    + 'Ask for every required user decision.'],
  ['bouncer-plan', 'Invoke /bouncer-plan for the supplied PRD and complete its plan gate. '
    + 'Ask for every required user decision.'],
  ['bouncer-run', 'Invoke /bouncer-run on the approved blueprint. Ask for every required user decision.'],
  ['bouncer-finalize', 'Invoke /bouncer-finalize in the verified integration worktree. '
    + 'Ask for every required user decision. For the quiz, number every question Q1..QN, '
    + 'show A), B), C) options, and request all answers in one batch.'],
]);

// 평가자 정책이 `benchmark_choices.plan_review_close`를 선언하면 plan 단계 지시에 이 문장을 더한다.
// context review의 close는 사용자 동의 동작이라 응답기가 문구로 추측해 답하지 않고, 승인한 범위를 시작 지시에 적는다.
const PLAN_REVIEW_CLOSE_VALUE = 'close_when_only_advisory_findings';
const PLAN_REVIEW_CLOSE_SENTENCE = 'For the context review close decision: when the delta round leaves no open must_fix finding, '
  + 'you have the user\'s approval to run `bouncer context-review close` with the dispositions you proposed. '
  + 'Never close, and never accept a risk, while a must_fix finding is open; ask the user instead.';

/**
 * 단계 시작 지시를 만든다. 정책 선택이 없으면 `stages` 표의 문장 그대로다.
 *
 * @param {string} stage - 단계 이름(예: bouncer-plan)
 * @param {object} policy - loadPolicy가 돌려준 평가자 정책
 * @returns {string} 시작 지시
 */
function stagePrompt(stage, policy) {
  const base = stages.get(stage);
  if (stage === 'bouncer-plan' && policy?.benchmark_choices?.plan_review_close === PLAN_REVIEW_CLOSE_VALUE) {
    return `${base} ${PLAN_REVIEW_CLOSE_SENTENCE}`;
  }
  return base;
}

function argsOf(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const allowed = ['--task', '--stage', '--work-dir', '--session-cwd', '--run-dir', '--model', '--key-file', '--policy',
      '--timeout-minutes'];
    if (!allowed.includes(argv[i])
      || !argv[i + 1] || out[argv[i]]) throw new Error(`invalid option: ${argv[i]}`);
    out[argv[i]] = argv[i + 1];
  }
  for (const required of ['--stage', '--work-dir', '--run-dir', '--model', '--key-file', '--policy']) {
    if (!out[required]) throw new Error(`${required} is required`);
  }
  // 기본 과제가 없다: 단계·파일 검사보다 먼저 --task 명시를 요구한다.
  if (!out['--task']) throw new Error('--task is required');
  if (!stages.has(out['--stage'])) throw new Error('unknown stage');
  out.taskId = out['--task'];
  const minutes = Number(out['--timeout-minutes'] ?? 30);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) throw new Error('invalid timeout');
  out.timeoutMs = minutes * 60_000;
  for (const key of ['--work-dir', '--run-dir', '--key-file', '--policy']) out[key] = path.resolve(out[key]);
  if (!existsSync(out['--work-dir']) || !statSync(out['--work-dir']).isDirectory()) {
    throw new Error('work directory missing');
  }
  if (!existsSync(out['--key-file']) || statSync(out['--key-file']).size === 0) throw new Error('API key file missing');
  out.sessionCwd = out['--session-cwd'] ? path.resolve(out['--session-cwd']) : out['--work-dir'];
  const relative = path.relative(out['--work-dir'], out.sessionCwd);
  if (relative.startsWith('..') || path.isAbsolute(relative)
    || !existsSync(out.sessionCwd) || !statSync(out.sessionCwd).isDirectory()) {
    throw new Error('session cwd must be inside the work directory');
  }
  out.containerCwd = path.posix.join('/workspace', relative.split(path.sep).join('/'));
  if (existsSync(out['--run-dir'])) throw new Error('run directory already exists');
  return out;
}

module.exports = { argsOf, stages, stagePrompt, PLAN_REVIEW_CLOSE_VALUE };
