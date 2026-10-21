'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
import runtime = require('./runtime-state');
const {
  coordinatorPathsFor, runtimePaths,
} = runtime;
import seed = require('./seed-worktree');
const { seedCoordinatorWorker } = seed;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import commitShaMod = require('./commit-sha');
const { normalizeCommitSha } = commitShaMod;
import validateSections = require('./validate-sections');
const { parseSections } = validateSections;
import executionDag = require('./execution-dag');
const { transition } = executionDag;
import configMod = require('./config');
const { readWavesPerSession } = configMod;
import scopeMod = require('./scope');
const { withLedgerLock } = scopeMod;
import leaseMod = require('./lease');
import reviewPolicy = require('./review-policy');
// worker-model 기록의 관점 소속 검사와 `next` 문구가 validate-sections와 같은 정본을 쓴다.
const { REVIEW_PERSPECTIVE } = reviewPolicy;
import type {
  ReportOutcome, PromoteStopReason, PromotionRecord, Task, Ledger,
  FailureEvidence, Exec, VerificationRunner,
} from './execution-contracts';
import type {
  CoordinateArgs, CoordinateResult, CoordinateCtx, LockedCtx, TaskCtx,
} from './coordinator-command-contracts';
import coordinatorLedger = require('./coordinator-ledger');
import coordinatorGit = require('./coordinator-git');
import coordinatorVerification = require('./coordinator-verification');
import driveMetrics = require('./drive-metrics');
const { issueLease, revokeLease, checkLease } = leaseMod;
const { randomUUID } = require('node:crypto');

// 경로 상수와 원장 I/O는 한 모듈에서 공유해 fence와 저장 동작이 갈라지지 않게 한다.
const {
  atomicWrite, loadLedgerBytes, loadLedger, ledgerBytesHash, assertLedgerFence, writeOwnedLedger,
  projectCheckpoint, assertLeaseShape, readyWaveGated, maxParallelForRead,
  withCheckpoint, openLedgerFenced, recheckLedgerCheckpoint, validateFaninLedger,
  ledgerModeOf,
} = coordinatorLedger;
import coordinatorRepair = require('./coordinator-repair');
import coordinatorWorker = require('./coordinator-worker');
const {
  reportPathFor, taskBriefHashOf, isBlueprintReviewModeAt, readBouncerBlock, workerCommitEvidence,
  ensureIntegrationCwd, currentScopePaths, intentIdFor, verificationPolicyAt,
  evidenceFiles, checkWorkerEvidence, copyEvidenceBundle,
} = coordinatorWorker;
// checkpoint 모양의 정본은 projectCheckpoint의 반환형이다.
type CoordinatorCheckpoint = ReturnType<typeof projectCheckpoint>;
const {
  git, initialWorktreeState, sourceStatus, workerOwnsSha, directParent, registeredWorker, registeredIntegration,
} = coordinatorGit;
const {
  withInstallStdioToStderr, prepareVerificationDependencies, selectVerificationRunner, runTargetVerification,
} = coordinatorVerification;
const LEDGER_REL = coordinatorLedger.LEDGER_REL;
import coordinatorPrepare = require('./coordinator-prepare');
const {
  blueprintScaleAt, worktreeDiffSha, prepareCoordinator,
  coordinateBootstrap, salvageRevokedWorker,
} = coordinatorPrepare;

/**
 * status/bootstrap을 제외한 원장 쓰기 명령. path/hash 쌍이 없거나 어긋나면
 * Git·파일 mutation보다 먼저 거절해야 stale checkpoint로 상태가 갈라지지 않는다.
 */
const LEDGER_FENCED_COMMANDS = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'revoke', 'promote-stop', 'session-open', 'worker-model', 'worker-tokens',
]);

/** report outcome 열거. CLI·ledger 검증과 같은 집합을 써야 stale/accepted 판정이 갈라지지 않는다. */
// 타입 합집합의 정본은 execution-contracts다. satisfies로 이 배열이 합집합을 벗어나지 않게 묶는다.
const REPORT_OUTCOMES = [
  'accepted', 'rework', 'scope_revision', 'task_change', 'blocked',
] as const satisfies readonly ReportOutcome[];

/** light 승격 정지 사유. CLI·원장·힌트가 같은 다섯 값만 쓴다. */
const PROMOTE_STOP_REASONS = [
  'security-risk', 'out-of-scope', 'task-split', 'interface-semantics', 'reviewer-wider-scope',
] as const satisfies readonly PromoteStopReason[];

type DispatchDecision = {
  task: string; kind: 'dispatch'; attempt: number; task_brief_hash: string;
  base_head: string; initial_worktree_state: string;
  model?: string;
};
// reviewer·debugger dispatch에 넘긴 모델 인자를 남기는 기록 전용 decision.
// dispatch·lease·status는 건드리지 않는다.
// worker 기록 role. implementer는 dispatch --model로도 모델이 남지만, 토큰 합산이 세 role을
// 같은 키 체계로 다루도록 worker-model에도 허용한다.
const WORKER_RECORD_ROLES: readonly string[] = ['implementer', 'reviewer', 'debugger'];
type WorkerRecordRole = 'implementer' | 'reviewer' | 'debugger';
// tokens는 호스트가 준 값일 때만 키를 쓴다. 키가 없으면 metrics summary가 누락으로 센다.
type WorkerModelDecision = {
  kind: 'worker-model'; role: WorkerRecordRole; model: string;
  task?: string; perspective?: string; tokens?: number;
};
// 완료 알림이 hand-back 뒤에 늦게 오는 경우, 토큰만 담아 덧붙이는 기록이다.
type WorkerTokensDecision = {
  kind: 'worker-tokens'; role: WorkerRecordRole; tokens: number;
  task?: string; perspective?: string;
};

/**
 * `--tokens` 값을 안전한 0 이상 정수로 검증한다. CLI는 문자열을, 직접 호출은 숫자를 줄 수 있어
 * 둘 다 받는다. 소수·음수·비숫자·안전 정수 밖의 값은 거절해 합산이 오염되지 않게 한다.
 *
 * @param {unknown} raw - 호스트가 준 토큰 값
 * @returns {number | null} 검증된 정수, 유효하지 않으면 null
 */

function parseWorkerTokens(raw: unknown): number | null {
  if (typeof raw === 'string') {
    if (!/^\d+$/.test(raw)) return null;
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
}
type ReportDecision = {
  task: string; kind: 'report'; attempt: number; task_brief_hash: string;
  outcome: ReportOutcome; summary: string;
  // full 모드 수락 기록에만 있다. light inline 보고는 보고 파일이 없어 생략한다.
  open_choices?: string[]; known_weaknesses?: string[];
};
type StaleReportDecision = {
  task: string; kind: 'stale-report';
  expected: { attempt: number; task_brief_hash: string };
  received: { attempt: number; task_brief_hash: string };
};
type StaleLeaseDecision = {
  task: string; kind: 'stale-lease';
  expected: { lease_id: string; generation: number } | null;
  received: { lease_id?: string; generation?: number };
};
type RerecordDecision = {
  task: string; kind: 'rerecord'; reason: string; previousSha: string;
  nextSha: string; integrationHead: string;
};
type FaninDecision = {
  kind: 'fanin'; tasks: string[]; base_head: string; candidate_head: string; evidence_id: string | null;
};
// root가 coordinator 세션을 열기 직전 `coordinate session-open`이 남기는 경계 표지다.
// `coordinate next`가 이 표지 뒤의 `fanin` 수로 세션 wave 수를 센다. 예외가 아니다.
type SessionDecision = {
  kind: 'session'; opened_at: string; integration_head: string; waves_cap: number;
};
type FaninVerificationFailedDecision = {
  kind: 'fanin-verification-failed'; tasks: string[];
  command: string; exitCode: number; evidence_id: string | null;
};
type ParsedReportFile = {
  revision: { attempt: number; task_brief_hash: string } | null;
  open_choices: string[] | null;
  known_weaknesses: string[] | null;
};

/**
 * worker 보고 파일 본문에서 Brief revision·Open choices·Known weaknesses를 읽는다.
 * 제목이 없거나 본문이 비면 해당 값은 null이다(빈 섹션도 누락으로 본다 — 값이
 * 없으면 `- none`을 쓰게 해 "작성 안 함"과 "없음"을 구분한다). revision은 두
 * 값 줄이 모두 형식에 맞을 때만 채우고, 하나라도 틀리면 null이다.
 *
 * @param {string} body - 보고 파일 원문
 * @returns {ParsedReportFile} 제목 부재는 null, 항목 목록은 `none` 한 줄이면 빈 배열
 */
function parseReportFile(body: string): ParsedReportFile {
  const sections = parseSections(body, [
    { key: 'revision', re: /^##\s+Brief revision\s*$/i },
    { key: 'open', re: /^##\s+Open choices\s*$/i },
    { key: 'weak', re: /^##\s+Known weaknesses\s*$/i },
    // 다른 ## 제목은 앞 섹션의 끝을 알리는 경계 구실만 한다.
    { key: 'other', re: /^##\s+(?!Brief revision\s*$|Open choices\s*$|Known weaknesses\s*$)\S/i },
  ] as Parameters<typeof parseSections>[1]);
  let revision: ParsedReportFile['revision'] = null;
  if (sections.revision) {
    const attemptMatch = /^attempt:\s*(\d+)\s*$/m.exec(sections.revision);
    const hashMatch = /^task_brief_hash:\s*([a-f0-9]{64})\s*$/m.exec(sections.revision);
    if (attemptMatch && hashMatch) {
      revision = { attempt: Number(attemptMatch[1]), task_brief_hash: hashMatch[1] };
    }
  }
  const items = (text: string | null): string[] | null => {
    if (text === null) return null;
    const list = text.split('\n').map((line) => line.replace(/^\s*[-*]\s+/, '').trim()).filter(Boolean);
    return list.length === 1 && list[0].toLowerCase() === 'none' ? [] : list;
  };
  return { revision, open_choices: items(sections.open), known_weaknesses: items(sections.weak) };
}

/**
 * 보고 파일 검사 결과.
 * `ok:false`는 원장을 쓰지 않는 거절이고, `ok:true`는 stale 비교로 넘어갈 값이다.
 */
type ReportFileCheck =
  | { ok: false; failure: Record<string, unknown> }
  | { ok: true; open_choices: string[]; known_weaknesses: string[] };

/**
 * full 모드 report가 활성 dispatch의 보고 파일을 읽어 revision 출처를 증명한다.
 * 파일 값으로 CLI 인자를 채우거나 누락을 통과시키지 않는다 — 출처 증명이 목적이다.
 * ENOENT만 report-revision-missing으로 흡수하고(아직 안 쓴 보고), 그 밖의 읽기
 * 오류(권한 등)는 다른 실패와 뭉개지 않도록 그대로 던진다.
 *
 * @param {string} reportPath - 활성 attempt의 보고 파일 절대 경로
 * @param {{attempt: number, task_brief_hash: string}} args - CLI로 받은 revision
 * @returns {ReportFileCheck} 거절 본문 또는 통과 시 저장할 항목 목록
 */
function checkReportFile(
  reportPath: string, args: { attempt: number; task_brief_hash: string },
): ReportFileCheck {
  let body: string;
  try {
    body = fs.readFileSync(reportPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, failure: { ok: false, reason: 'report-revision-missing', report_path: reportPath } };
    }
    throw error;
  }
  const parsed = parseReportFile(body);
  if (!parsed.revision) {
    return { ok: false, failure: { ok: false, reason: 'report-revision-missing', report_path: reportPath } };
  }
  if (parsed.revision.attempt !== args.attempt
    || parsed.revision.task_brief_hash !== args.task_brief_hash) {
    return { ok: false, failure: { ok: false, reason: 'report-revision-conflict', file: parsed.revision, args } };
  }
  const missing = [
    ...(parsed.open_choices === null ? ['Open choices'] : []),
    ...(parsed.known_weaknesses === null ? ['Known weaknesses'] : []),
  ];
  if (missing.length > 0) {
    return { ok: false, failure: { ok: false, reason: 'report-section-missing', missing, report_path: reportPath } };
  }
  return {
    ok: true, open_choices: parsed.open_choices as string[], known_weaknesses: parsed.known_weaknesses as string[],
  };
}

/**
 * 커밋 메시지 끝에 `Bouncer-Worker-Commit` trailer 한 줄을 붙인 새 메시지를 만든다.
 * 마지막 문단이 전부 `Key: value` 줄이고 제목 문단이 아니면 기존 trailer 블록의 마지막 줄
 * 바로 뒤에 붙이고, 아니면 빈 줄 하나를 두고 새 블록으로 붙인다. 제목만 있는 메시지의
 * `feat: x`가 trailer로 오인되지 않도록 문단이 둘 이상일 때만 블록으로 본다.
 *
 * @param {string} message - cherry-pick된 커밋의 원본 메시지(`%B`)
 * @param {string} workerSha - 원본 worker 커밋 전체 SHA
 * @returns {string} trailer가 추가된 메시지
 */
function appendWorkerCommitTrailer(message: string, workerSha: string): string {
  const trimmed = message.replace(/\s+$/, '');
  const paragraphs = trimmed.split(/\n\s*\n/);
  const last = paragraphs[paragraphs.length - 1];
  const isTrailerBlock = paragraphs.length > 1
    && last.split('\n').every((line) => /^[A-Za-z][A-Za-z0-9-]*\s*:\s*\S/.test(line));
  const line = `Bouncer-Worker-Commit: ${workerSha}`;
  return `${trimmed}${isTrailerBlock ? '\n' : '\n\n'}${line}\n`;
}


/**
 * verification task 문서 상태를 runner 증적과 같은 checkout에 기록한다.
 * 실패 실행은 verifying을 유지하고 성공만 integrated로 올린다.
 *
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {string} taskId - 세 자리 task 번호
 * @param {'verifying' | 'integrated'} status - 기록할 lifecycle 상태
 * @returns {void}
 */
function writeVerificationTaskStatus(
  integrationPath: string,
  blueprint: string,
  taskId: string,
  status: 'verifying' | 'integrated',
): void {
  // 실패한 실행은 integrated로 전이하지 않는다.
  const file = path.join(integrationPath, blueprint, 'tasks', taskId, 'tasks.md');
  const doc = readDoc(file);
  const data = doc.data as Record<string, unknown>;
  const bouncer = data.bouncer as Record<string, unknown>;
  bouncer.status = status;
  fs.writeFileSync(file, renderDoc(data, doc.body));
}


function openPromoteTask(tasks: Task[]): Task | null {
  const commits = tasks.filter((item) => (item.execution_kind || 'commit') !== 'verification');
  if (commits.length === 0) return null;
  return commits.find((item) => item.status !== 'integrated') || commits[0];
}

/**
 * light 원장에서 task cwd가 integration인지 본다. full의 registeredWorker와
 * 달리 integration 자체 배정만 허용하고 workers/ 경로는 거절한다.
 *
 * @param {Task} item - 원장 task
 * @param {string} integrationPath - integration checkout 절대 경로
 * @returns {boolean} workerPath가 integration과 같으면 true
 */
function lightWorkerAssigned(item: Task, integrationPath: string): boolean {
  if (typeof item.workerPath !== 'string' || item.workerPath === '') return false;
  try {
    return fs.realpathSync(item.workerPath) === fs.realpathSync(integrationPath);
  } catch (_error) {
    // 경로 부재·권한 오류는 배정 실패로만 접는다. throw하면 dispatch가 사용법 오류가 된다.
    return false;
  }
}

/**
 * light 원장의 `report accepted`가 요구하는 루트 review.md 라운드·status를 본다.
 * 라운드는 `bouncer review record`만 쓰므로 여기서는 존재와 status만 판정한다.
 *
 * @param {string} integrationPath - integration checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @returns {boolean} rounds가 비어 있지 않고 status가 accepted이면 true
 */
function lightReviewAccepted(integrationPath: string, blueprint: string): boolean {
  const bouncer = readBouncerBlock(path.join(integrationPath, blueprint, 'review.md'));
  if (!bouncer || bouncer.status !== 'accepted') return false;
  const review = bouncer.review;
  if (!review || typeof review !== 'object' || Array.isArray(review)) return false;
  const rounds = (review as Record<string, unknown>).rounds;
  return Array.isArray(rounds) && rounds.length > 0;
}

/**
 * 보고의 `## Tests` 절이 task에 지정된 명령과 통과 결과를 담았는지 판정한다.
 * 사람이 쓴 보고라 형식이 정확히 고정되어 있지 않으므로 의도적으로 관대한 휴리스틱이다:
 * (1) Tests 절이 있어야 하고, (2) 지정 명령이 인수 확장 없이 경계에 맞춰 등장해야
 * 하며(`cmd extra.test.js`는 다른 명령), (3) 통과 표지(pass·ok·exit 0·통과 등)가
 * 있어야 하고, (4) `0 fail`·`fail 0` 같은 무결과를 지운 뒤에도 실패 표지(fail·error·
 * 실패·exit 비0)가 남지 않아야 한다. 실제 실행 여부는 증명하지 못한다 — 그 증거는
 * execute gate가 쓴다. 이 검사는 worker가 엉뚱한 명령(전체 suite 포함)을 돌렸거나
 * 결과를 빠뜨린 보고를 fan-in 전에 걸러내는 용도다.
 *
 * @param {string} body - 보고 파일 원문
 * @param {string} command - task가 지정한 `bouncer.verify` 명령
 * @returns {string | null} 통과면 null, 아니면 사유
 *   (`tests-section-missing`·`command-missing`·`result-missing`·`result-failed`)
 */
function testsReportProblem(body: string, command: string): string | null {
  const sections = parseSections(body, [
    { key: 'tests', re: /^##\s+Tests\s*$/i },
    { key: 'other', re: /^##\s+(?!Tests\s*$)\S/i },
  ] as Parameters<typeof parseSections>[1]);
  if (sections.tests === null) return 'tests-section-missing';
  const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
  const text = collapse(sections.tests);
  const wanted = collapse(command);
  const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 명령 앞은 문장 시작·공백·열기 문자, 뒤는 끝·닫기/구두점·공백이어야 한다.
  const boundary = new RegExp(`(?:^|[\\s\`'"(])${escaped}(?=$|[\\s\`'")\\].,;:])`, 'g');
  let matched = false;
  for (const hit of text.matchAll(boundary)) {
    const rest = text.slice((hit.index as number) + hit[0].length)
      .replace(/^[`'")\].,;:]+/, '');
    // 공백 뒤에 옵션·경로·테스트 파일이 이어지면 인수가 더 붙은 다른 명령이다.
    const extended = /^\s+(?:--?[A-Za-z]|\S*\/\S*|\S+\.(?:js|ts|mjs|cjs|json)\b)/.test(rest);
    if (!extended) { matched = true; break; }
  }
  if (!matched) return 'command-missing';
  const passMark = /\b(?:pass(?:ed|es)?|ok|success(?:ful(?:ly)?)?)\b|통과|성공|exit(?:\s+code)?\s*[:=]?\s*0\b/i;
  if (!passMark.test(text)) return 'result-missing';
  const noZero = text
    .replace(/\b0\s+(?:fail\w*|errors?)\b/gi, ' ')
    .replace(/\b(?:fail\w*|errors?)\s*[:=]?\s*0\b/gi, ' ')
    .replace(/\bno\s+(?:fail\w*|errors?)\b/gi, ' ')
    .replace(/(?:실패|오류)\s*0|0\s*(?:실패|오류)/g, ' ');
  if (/\b(?:fail\w*|errors?)\b|실패|오류|exit(?:\s+code)?\s*[:=]?\s*[1-9]/i.test(noZero)) {
    return 'result-failed';
  }
  return null;
}

/**
 * scoped_terminal fan-in 전에 각 task의 worker 보고가 지정 명령·통과 결과를 담았는지
 * 확인한다. 명령은 integration의 tasks.md `bouncer.verify`가 정본이다(worker 사본은
 * worker가 바꿀 수 있어 믿지 않는다). 보고 파일이 없으면 full은 거절한다. light는
 * 세션이 같은 cwd에서 inline 보고를 하므로 파일이 없을 때만(ENOENT) 이 검사를 건너뛴다.
 * 그 밖의 읽기 오류는 삼키지 않고 던진다.
 *
 * @param {object} args - 검사 입력
 * @param {string} args.integrationPath - 계획 정본을 읽을 integration checkout
 * @param {string} args.blueprint - blueprint 상대 경로
 * @param {Task[]} args.items - fan-in 대상 task
 * @param {boolean} args.light - light 원장이면 true (보고 파일 부재 허용)
 * @returns {{ task: string; expected_command: string; problem: string } | null} 첫 위반. 없으면 null
 */
function scopedTestReportFailure({ integrationPath, blueprint, items, light }: {
  integrationPath: string; blueprint: string; items: Task[]; light: boolean;
}): { task: string; expected_command: string; problem: string } | null {
  for (const item of items) {
    const declared = readBouncerBlock(path.join(integrationPath, blueprint, 'tasks', item.id, 'tasks.md'));
    const expected = declared && typeof declared.verify === 'string' ? declared.verify.trim() : '';
    if (expected === '') {
      return { task: item.id, expected_command: '', problem: 'task-command-missing' };
    }
    if (!item.dispatch || typeof item.workerPath !== 'string') {
      if (light) continue;
      return { task: item.id, expected_command: expected, problem: 'report-missing' };
    }
    let body: string;
    try {
      body = fs.readFileSync(reportPathFor(item.workerPath, item.id, item.dispatch.attempt), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        if (light) continue;
        return { task: item.id, expected_command: expected, problem: 'report-missing' };
      }
      throw error;
    }
    const problem = testsReportProblem(body, expected);
    if (problem !== null) return { task: item.id, expected_command: expected, problem };
  }
  return null;
}


/**
 * lease 검사 실패를 decision으로만 남긴다. status·dispatch·sha는 바꾸지 않는다.
 *
 * @param {Ledger} ledger - 원장
 * @param {Task} item - 대상 task
 * @param {string} taskId - task id
 * @param {ReturnType<typeof checkLease> & {ok: false}} checked - 거절 결과
 * @returns {{ok: false, reason: string, expected: unknown, received: unknown}}
 */
function rejectLeaseMismatch(
  ledger: Ledger,
  item: Task,
  taskId: string,
  // 호출부 checkLease 거절 결과 — expected/received 유니온이 길어 줄 분리.
  checked: {
    ok: false;
    reason: 'lease-required' | 'stale-lease';
    expected: StaleLeaseDecision['expected'];
    received: StaleLeaseDecision['received'];
  },
) {
  if (checked.reason === 'stale-lease') {
    const stale: StaleLeaseDecision = {
      task: taskId, kind: 'stale-lease',
      expected: checked.expected, received: checked.received,
    };
    item.decisions = [...(item.decisions || []), stale];
    ledger.decisions.push(stale);
  }
  return {
    ok: false as const,
    reason: checked.reason,
    expected: checked.expected,
    received: checked.received,
  };
}



/**
 * integrate. verification node는 verifying 전이와 결과 기록을 잠금으로 나누고,
 * commit wave는 candidate worktree에서 cherry-pick·검증한 뒤 CAS ff만 canonical에
 * 반영한다. runVerification 동안 원장 잠금 파일이 없게 한다.
 */
function integrateTask({
  // sha는 CLI 호환으로 타입에만 남기고 구조분해하지 않는다 — fan-in은 원장·lease로 판정.
  repoRoot, blueprint, cwd, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; cwd: string; task?: string; sha?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  // wave 형태에 lease 플래그가 오면 어느 task의 lease인지 모호하므로 거절한다.
  if (!task && (leaseId !== undefined || generation !== undefined)) {
    return { ok: false, reason: 'lease-flags-require-task' };
  }
  if (task !== undefined && !/^\d{3}$/.test(task)) {
    return { ok: false, reason: 'task-required' };
  }
  ensureIntegrationCwd(repoRoot, blueprint, cwd);

  // fan-in·verification 경로보다 앞에서 막아 후보 worktree를 만들지 않는다.
  {
    const peekStopped = loadLedger(integration.ledgerFile);
    if (peekStopped?.status === 'promotion_stopped') {
      return { ok: false, reason: 'promotion-stopped' };
    }
  }

  // verification --task는 기존 두 단계 경로. commit/wave는 candidate fan-in.
  if (task) {
    const peek = loadLedger(integration.ledgerFile);
    const peekItem = peek?.tasks.find((x) => x.id === task);
    if (peekItem?.execution_kind === 'verification') {
      return integrateVerificationTask({
        repoRoot, blueprint, task, leaseId, generation,
        ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
      });
    }
  }

  return integrateCommitWave({
    repoRoot, blueprint, task, leaseId, generation,
    ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
  });
}

/**
 * verification node integrate. terminal scope·repair 한도 2를 보존하고, 명시
 * taskId로 pointer 없이도 그 task의 verify를 고른다. 잠금 해제 뒤·runVerification
 * 앞에서 integration checkout에 prepareDependencies를 돌려, fan-in candidate만
 * npm ci 된 채로 terminal CI가 도는 불일치를 막는다.
 *
 * @param {object} opts - integrateVerificationTask 인자
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} opts.task - verification task id
 * @param {string} [opts.leaseId] - 공개 시그니처 호환. 이 경로에서는 쓰지 않는다
 * @param {number} [opts.generation] - 공개 시그니처 호환. 이 경로에서는 쓰지 않는다
 * @param {string} [opts.ledgerPath] - fence 원장 상대 경로
 * @param {string} [opts.ledgerHash] - fence sha256
 * @param {Exec} opts.exec - git·npm 주입 execFileSync
 * @param {Function} opts.writeLedger - 원장 원자 쓰기
 * @param {{ runVerification?: VerificationRunner }} opts.deps - 검증 러너 주입
 * @param {object} opts.integration - coordinatorPathsFor 결과. integrationPath가 검증 cwd
 * @returns {unknown} 성공 시 ok:true와 task·verification. 실패 시 ok:false와 reason
 */
function integrateVerificationTask({
  // repoRoot는 공개 시그니처 호환용 — 검증 cwd는 integration.integrationPath만 쓴다.
  blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; task: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  let phase1CheckpointHash: string | null = null;
  let verificationRetry = false;
  const phase1 = withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({ ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash });
    if (!opened.ok) return opened;
    const { ledger } = opened;
    const item = ledger.tasks.find((x) => x.id === task);
    if (!item) return { ok: false, reason: 'task-outside-blueprint' };

    const status = item.status || 'pending';
    // terminalFailure가 있는 verifying는 repair만 받는다.
    if (status === 'verifying' && ledger.terminalFailure
      && ledger.terminalFailure.task === task) {
      return { ok: false, reason: 'not-ready' };
    }
    if (status === 'verifying' && !(ledger.terminalFailure && ledger.terminalFailure.task === task)) {
      // 전이 없이 검증만 재실행 — repair wave를 소모하지 않는다.
      verificationRetry = true;
      phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
      return { ok: true as const, mode: 'verification' as const, ledger };
    }
    if (status !== 'ready') return { ok: false, reason: 'not-ready' };
    item.status = transition('ready', 'verifying', 'verification');
    writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'verifying');
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
    return { ok: true as const, mode: 'verification' as const, ledger };
  });

  if (!phase1 || typeof phase1 !== 'object') return phase1;
  if ((phase1 as { ok?: boolean }).ok === false) return phase1;

  // --- 잠금 밖에서 의존성 준비 후 검증 실행 ---
  // seedCoordinatorWorker는 candidate에 npm ci를 하지만 integration worktree는
  // git이 추적한 파일만 받아 node_modules가 비어 있다. 잠금을 잡은 채 설치하면
  // 원장이 오래 막히므로, 이미 푼 검증 phase에서만 같은 계약을 적용한다.
  const prepared = prepareVerificationDependencies(integration.integrationPath, exec);
  if (!prepared.ok) {
    return { ok: false, reason: 'dependency-install-failed', message: prepared.message };
  }

  const runner = selectVerificationRunner(deps.runVerification);
  const intentId = intentIdFor(blueprint);
  const headForKey = (() => {
    const live = loadLedger(integration.ledgerFile);
    if (live && typeof live.integrationHead === 'string') return live.integrationHead;
    return git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
  })();
  const result = runTargetVerification(runner, {
    repoRoot: integration.integrationPath,
    blueprintDir: blueprint,
    // pointer를 옮기지 않으므로 자기 task id로 verify·문서를 고른다.
    taskId: task,
    scope: {
      kind: 'terminal',
      key: `${intentId}:${headForKey}`,
    },
  });

  return withLedgerLock(integration.ledgerFile, (owns) => {
    const rechecked = recheckLedgerCheckpoint({
      ledgerFile: integration.ledgerFile, expectedHash: phase1CheckpointHash,
    });
    if (!rechecked.ok) return rechecked;
    const { ledger } = rechecked;
    const item = ledger.tasks.find((x) => x.id === task);
    if (!item) return { ok: false, reason: 'task-outside-blueprint' };
    if (!result.ok) {
      const lastRepair = (ledger.repairWaves || []).at(-1);
      // nextScope는 repair 생성 시점(r1) 값이라 scope revision 뒤에는 낡는다.
      // 복구 task의 현재 scope가 정본이므로 그것을 우선하고, task를 못 찾을 때만 기록값으로 물러난다.
      const lastRepairTask = lastRepair ? ledger.tasks.find((x) => x.id === lastRepair.task) : undefined;
      const evidence: FailureEvidence = {
        task, command: result.command, summary: `exit code ${result.exitCode}`,
        paths: lastRepairTask ? currentScopePaths(lastRepairTask)
          : lastRepair ? [...lastRepair.nextScope] : [...(ledger.terminalFailure?.paths || [])],
        exitCode: result.exitCode, repairWave: (ledger.repairWaves || []).length,
        // 범위 밖 분류가 묶일 원본 identity. 증거 id는 러너가 줄 때만, 소스 identity는 이 검증이
        // 실행된 integration HEAD다. 둘 중 하나라도 없으면 분류를 받을 수 없어 blocked 의미가 유지된다.
        ...(typeof result.evidenceId === 'string' && result.evidenceId !== ''
          ? { evidence_id: result.evidenceId } : {}),
        source_digest: headForKey,
      };
      ledger.terminalFailure = evidence;
      const exhausted = (ledger.repairWaves || []).length >= 2;
      if (exhausted) {
        ledger.status = 'awaiting_confirmation';
      }
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return { ok: false, reason: 'verification-failed', task: item, verification: result,
        repairWaves: (ledger.repairWaves || []).length, stopped: exhausted };
    }
    item.status = transition('verifying', 'integrated', 'verification');
    if (typeof result.evidenceId === 'string' && result.evidenceId !== '') {
      item.verify_evidence_id = result.evidenceId;
    }
    writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'integrated');
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    void verificationRetry;
    void leaseId;
    void generation;
    void exec;
    return withCheckpoint({ ok: true as const, command: 'integrate', task: item, verification: result,
      ready: readyWaveGated(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }), decisions: ledger.decisions },
    ledger, integration.ledgerFile);
  });
}

/**
 * recorded commit task를 depends_on 우선·ID순으로 정렬한다. wave 안 의존만
 * 본다 — 이미 integrated인 선행은 edge가 없어 병렬 순서가 ID로만 정해진다.
 *
 * @param {Task[]} tasks - 원장 전체
 * @param {string[]} ids - wave 대상 id
 * @returns {string[]} cherry-pick 순서
 */
function sortFaninTasks(tasks: Task[], ids: string[]): string[] {
  const idSet = new Set(ids);
  const byId = new Map(tasks.filter((entry) => idSet.has(entry.id)).map((entry) => [entry.id, entry]));
  const indegree = new Map(ids.map((id) => [id, 0]));
  const children = new Map(ids.map((id) => [id, [] as string[]]));
  for (const id of ids) {
    const deps = (byId.get(id)?.depends_on || []).filter((dep) => idSet.has(dep));
    indegree.set(id, deps.length);
    for (const dep of deps) {
      (children.get(dep) as string[]).push(id);
    }
  }
  const ready = ids.filter((id) => indegree.get(id) === 0).sort((a, b) => a.localeCompare(b));
  const ordered: string[] = [];
  while (ready.length > 0) {
    const next = ready.shift() as string;
    ordered.push(next);
    for (const child of ((children.get(next) || []) as string[]).slice().sort((a, b) => a.localeCompare(b))) {
      const nextDegree = (indegree.get(child) as number) - 1;
      indegree.set(child, nextDegree);
      if (nextDegree === 0) {
        ready.push(child);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }
  // 순환이 남으면 ID순으로 붙여 cherry-pick이 멈추지 않게 한다.
  if (ordered.length < ids.length) {
    for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
      if (!ordered.includes(id)) ordered.push(id);
    }
  }
  return ordered;
}

/**
 * recorded + (active lease | lease 부재) commit만 wave 후보다. revoked는 빼고,
 * `--task`면 그 하나만 검사한다.
 *
 * @param {Ledger} ledger - 원장
 * @param {string | undefined} task - 선택적 단일 task
 * @returns {string[]} 정렬 전 후보 id
 */
function selectRecordedCommitIds(ledger: Ledger, task?: string): string[] {
  const candidates = ledger.tasks.filter((entry) => {
    if ((entry.execution_kind || 'commit') === 'verification') return false;
    if (entry.status !== 'recorded' || !entry.sha) return false;
    // revoked lease는 플래그 없는 wave에서 제외. legacy(lease 없음)는 포함한다.
    if (entry.lease && entry.lease.status !== 'active') return false;
    if (task) return entry.id === task;
    return true;
  });
  return candidates.map((entry) => entry.id);
}

/**
 * fanin candidate worktree를 지운다. 등록이 없거나 경로만 남은 잔해도 제거한다.
 *
 * @param {Exec} exec - git 실행기
 * @param {string} repoRoot - 저장소 루트
 * @param {string} faninPath - candidate 경로
 */
function removeFaninWorktree(exec: Exec, repoRoot: string, faninPath: string): void {
  try {
    git(exec, repoRoot, ['worktree', 'remove', '--force', faninPath]);
  } catch (_error) {
    // 등록이 이미 없으면 디렉터리만 남아 있을 수 있다 — 강제 삭제로 재시드를 연다.
  }
  fs.rmSync(faninPath, { recursive: true, force: true });
}

/**
 * cherry-pick 예외·stderr에서 사람이 읽을 수 있는 진단 문자열을 모은다.
 * status/signal은 분류에 쓰지 않는다 — CONFLICT 없는 exit 1도 흔하다.
 *
 * @param {unknown} error - execFileSync 또는 주입 예외
 * @returns {string} stdout·stderr·message를 이어 붙인 원문
 */
function cherryPickErrorText(error: unknown): string {
  if (error == null || typeof error !== 'object') return String(error ?? '');
  const err = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [err.stdout, err.stderr, err.message]
    .filter((part) => part != null && part !== '')
    .map((part) => String(part))
    .join('\n');
}

/**
 * cherry-pick 실패가 내용 충돌인지 판별한다. fanin-conflict+revoke는 충돌만
 * 해당하므로, bad object·empty commit 같은 다른 실패와 섞이면 안 된다.
 *
 * @param {unknown} error - cherry-pick이 던진 예외
 * @param {Exec} exec - candidate에서 인덱스 조사용
 * @param {string} faninPath - abort 전 candidate cwd
 * @returns {boolean} unmerged 경로 또는 CONFLICT 표식이 있으면 true
 */
function isCherryPickConflict(error: unknown, exec: Exec, faninPath: string): boolean {
  // 1. abort 전에 unmerged index가 있으면 실제 merge conflict다.
  try {
    if (git(exec, faninPath, ['ls-files', '-u']).length > 0) return true;
  } catch (_probeError) {
    // candidate가 이미 깨졌거나 ls-files가 실패하면 메시지 휴리스틱으로 간다.
  }
  // 2. git은 충돌 시 stderr에 `CONFLICT`를 찍는다. 테스트 seam 주입도 같은 표식을 쓴다.
  const text = cherryPickErrorText(error);
  return /\bCONFLICT\b/.test(text) || /Merge conflict/i.test(text);
}

/**
 * light commit wave: cherry-pick 없이 integration HEAD를 fanin verified로 기록한다.
 * 커밋은 이미 integration에서 이뤄졌으므로 HEAD≠integrationHead여도 stale로
 * 보지 않고, 기록된 sha 소유와 증적만 확인한 뒤 integrated로 올린다.
 *
 * @param {object} opts - integrateCommitWave와 동일 인자(deps.runVerification 미사용)
 * @returns {unknown} 성공 시 integrate checkpoint, 실패 시 ok:false
 */
function integrateLightCommitWave({
  // repoRoot는 공개 시그니처 호환용 — light commit wave는 integration 경로만 쓴다.
  blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, integration,
}: {
  repoRoot: string; blueprint: string; task?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  return withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({
      ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash, validate: validateFaninLedger,
    });
    if (!opened.ok) return opened;
    const { ledger } = opened;
    if (ledgerModeOf(ledger) !== 'light') {
      return { ok: false, reason: 'ledger-mode-mismatch' };
    }

    if (task) {
      const item = ledger.tasks.find((x) => x.id === task);
      if (!item) return { ok: false, reason: 'task-outside-blueprint' };
      if ((item.execution_kind || 'commit') === 'verification') {
        return { ok: false, reason: 'task-outside-blueprint' };
      }
      const leaseChecked = checkLease(item, {
        ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
        ...(generation !== undefined ? { generation } : {}),
      });
      if (!leaseChecked.ok) {
        const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
        if (leaseChecked.reason === 'stale-lease') {
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
        }
        return rejected;
      }
    }

    const selected = selectRecordedCommitIds(ledger, task);
    if (selected.length === 0) return { ok: false, reason: 'nothing-to-integrate' };
    const ordered = sortFaninTasks(ledger.tasks, selected);
    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    const baseHead = typeof ledger.integrationHead === 'string' ? ledger.integrationHead : head;

    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      if (!lightWorkerAssigned(item, integration.integrationPath)
        || !workerOwnsSha(exec, integration.integrationPath, item.sha as string)) {
        return { ok: false, reason: 'sha-not-owned-by-worker' };
      }
      const evidence = checkWorkerEvidence(
        integration.integrationPath, integration.integrationPath, blueprint, id, item.sha as string,
      );
      if (!evidence.ok) return evidence;
    }

    // light inline 보고는 파일이 없을 수 있어 부재만 허용하고, 파일이 있으면 full과 같은 검사를 한다.
    if (verificationPolicyAt(integration.integrationPath, blueprint) === 'scoped_terminal') {
      const mismatch = scopedTestReportFailure({
        integrationPath: integration.integrationPath, blueprint, light: true,
        items: ordered.map((id) => ledger.tasks.find((x) => x.id === id) as Task),
      });
      if (mismatch) return { ok: false, reason: 'worker-test-report-mismatch', ...mismatch };
    }

    // fanin verified를 남긴 뒤 바로 비운다. candidate worktree·ff는 없다 —
    // HEAD가 이미 기록된 커밋이다. copyEvidenceBundle는 동일 경로라 건너뛴다.
    ledger.fanin = {
      base_head: baseHead,
      candidate_head: head,
      tasks: ordered,
      status: 'verified',
    };
    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id);
      if (!item) continue;
      item.status = transition('recorded', 'integrated');
    }
    ledger.integrationHead = head;
    const decision: FaninDecision = {
      kind: 'fanin',
      tasks: [...ordered],
      base_head: baseHead,
      candidate_head: head,
      evidence_id: null,
    };
    ledger.decisions.push(decision);
    ledger.fanin = null;
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    return withCheckpoint({
      ok: true as const,
      command: 'integrate',
      integrated: [...ordered],
      integrationHead: head,
      verification: { ok: true, command: '', exitCode: 0 },
      ready: readyWaveGated(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }),
    }, ledger, integration.ledgerFile);
  });
}

/**
 * integration checkout에서 허용 경로 밖에 있는 미커밋 경로를 모은다.
 * 허용 경로는 seed manifest 경로, 이미 integrated된 task의 evidence 문서, 그리고
 * `coordinate repair`가 만든 dynamic task의 evidence 문서뿐이다.
 * dynamic task 문서는 repair 시점에 integration에 untracked로 쓰이고 integrate 때
 * 비로소 worker 증적으로 덮어써지므로, status가 integrated가 아니어도 허용해야 한다.
 * 넓은 prefix를 허용하면 coordinator가 직접 고친 소스가 섞여 들어와도 통과하므로
 * 파일 단위로만 비교한다. rename·copy(`-z`에서는 새 경로 토큰 뒤에 원래 경로 토큰)는 양쪽 경로를 모두 본다.
 * `git()`은 출력을 trim해 첫 줄의 선행 공백 상태 코드를 깨뜨리므로 exec 원문을 쓴다.
 *
 * @param {Exec} exec - git 호출 seam
 * @param {string} integrationPath - integration checkout 절대 경로
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Ledger} ledger - seedManifest와 task 상태를 읽을 원장
 * @returns {string[]} 허용되지 않은 dirty 경로(정렬, 중복 없음)
 */
function disallowedDirtyPaths(
  exec: Exec, integrationPath: string, blueprint: string, ledger: Ledger,
): string[] {
  const raw = String(exec('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: integrationPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const reviewMode = isBlueprintReviewModeAt(integrationPath, blueprint);
  const allowed = new Set<string>((ledger.seedManifest || []).map((entry) => entry.path));
  for (const task of ledger.tasks) {
    if (task.status !== 'integrated' && task.dynamic !== true) continue;
    for (const [name] of evidenceFiles(reviewMode)) {
      allowed.add(`${blueprint.replaceAll('\\', '/')}/tasks/${task.id}/${name}`);
    }
  }
  const dirty = new Set<string>();
  // -z 출력은 경로를 C-quote하지 않고 NUL로 끝맺는다. 한국어·따옴표·" -> " 이름도
  // 허용 목록과 같은 원래 문자열로 비교하려면 줄 단위 파싱을 쓸 수 없다.
  const tokens = raw.split('\0');
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.length < 4) continue;
    const entries = [token.slice(3)];
    // rename·copy는 다음 토큰이 원래 경로이고 그 토큰에는 상태 코드가 없다.
    if (/[RC]/.test(token.slice(0, 2)) && i + 1 < tokens.length) {
      i += 1;
      entries.push(tokens[i]);
    }
    for (const entry of entries) {
      // worktree 등록·CLI 런타임 파일(.bouncer/runtime, config.json)은 source가 아니다.
      // 실제 프로젝트에서는 gitignore라 안 보이지만, .gitignore가 없는 bootstrap fixture에서는
      // ledger 자체가 dirty로 보여 모든 integrate가 거절되므로 이 경로만 제외한다.
      if (entry.startsWith('.worktrees/') || entry.startsWith('.bouncer/runtime/')
        || entry === '.bouncer/config.json') continue;
      dirty.add(entry);
    }
  }
  return [...dirty].filter((entry) => !allowed.has(entry)).sort();
}

/** 보고 `## Changed files` 아래 `- ` 항목의 첫 backtick 구간을 경로로 읽는다. 제목이 없으면 null. */
function reportChangedFiles(body: string): string[] | null {
  const sections = parseSections(body, [
    { key: 'changed', re: /^##\s+Changed files\s*$/i },
    { key: 'other', re: /^##\s+(?!Changed files\s*$)\S/i },
  ] as Parameters<typeof parseSections>[1]);
  if (sections.changed === null) return null;
  const out: string[] = [];
  for (const line of sections.changed.split('\n')) {
    const m = /^\s*[-*]\s+[^`]*`([^`]+)`/.exec(line);
    if (m) out.push(m[1]);
  }
  return out;
}

type IntegrateWarning =
  | { task: string; code: 'report-paths-mismatch'; missing: string[]; extra: string[] }
  | { task: string; code: 'report-changed-files-unavailable' };

/**
 * worker 커밋의 변경 경로(task evidence 디렉터리 제외)와 보고 `## Changed files`를 대조한다.
 * 불일치는 실패가 아니라 경고다 — 보고 정확도를 드러낼 뿐 통합 판정에는 쓰지 않는다.
 * 보고 파일이 없는 경우(ENOENT)만 unavailable로 흡수하고 다른 읽기 오류는 던진다.
 *
 * @param {Exec} exec - git 호출 seam
 * @param {string} cwd - sha를 읽을 checkout
 * @param {string} blueprint - blueprint 상대 경로
 * @param {Task} item - 대조할 task(workerPath·dispatch·sha 사용)
 * @returns {IntegrateWarning | null} 일치하면 null
 */
function reportPathsWarning(
  exec: Exec, cwd: string, blueprint: string, item: Task,
): IntegrateWarning | null {
  const unavailable: IntegrateWarning = { task: item.id, code: 'report-changed-files-unavailable' };
  if (!item.workerPath || !item.dispatch) return unavailable;
  let body: string;
  try {
    body = fs.readFileSync(reportPathFor(item.workerPath, item.id, item.dispatch.attempt), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return unavailable;
    throw error;
  }
  const reported = reportChangedFiles(body);
  if (reported === null) return unavailable;
  const evidenceDir = `${blueprint.replaceAll('\\', '/')}/tasks/${item.id}/`;
  const committed = git(exec, cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', item.sha as string])
    .split('\n').filter((entry) => entry && !entry.startsWith(evidenceDir));
  const reportedSet = new Set(reported);
  const committedSet = new Set(committed);
  const missing = [...reportedSet].filter((entry) => !committedSet.has(entry)).sort();
  const extra = [...committedSet].filter((entry) => !reportedSet.has(entry)).sort();
  if (missing.length === 0 && extra.length === 0) return null;
  return { task: item.id, code: 'report-paths-mismatch', missing, extra };
}

/**
 * commit wave fan-in: candidate에서 cherry-pick·검증 후 CAS ff만 canonical에 쓴다.
 * task마다 `<baseHead>..<item.sha>` 범위의 worker 커밋을 모두 적용하고 통합 커밋 1개로
 * 합친다(rework로 쌓인 앞 attempt 커밋이 빠지지 않게). 범위 안 내용 충돌은 `fanin-conflict`
 * (그 task만 revoke), 그 밖의 git 실패는 `cherry-pick-failed`, 빈 범위는 `nothing-to-integrate`.
 * light 원장은 cherry-pick 없이 `integrateLightCommitWave`로 보낸다.
 */
function integrateCommitWave({
  repoRoot, blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration,
}: {
  repoRoot: string; blueprint: string; task?: string;
  leaseId?: string; generation?: number;
  ledgerPath?: string; ledgerHash?: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  deps: { runVerification?: VerificationRunner };
  integration: ReturnType<typeof coordinatorPathsFor>;
}): unknown {
  // light는 full fan-in 복구·candidate 경로와 섞지 않는다. 원장 mode만 본다.
  const peek = loadLedger(integration.ledgerFile);
  if (peek && ledgerModeOf(peek) === 'light') {
    return integrateLightCommitWave({
      repoRoot, blueprint, task, leaseId, generation,
      ledgerPath, ledgerHash, exec, writeLedger, integration,
    });
  }

  const faninPath = integration.faninPath;
  const runner = selectVerificationRunner(deps.runVerification);
  // scoped_terminal이면 구현 wave fan-in은 전체 검증을 돌리지 않는다. 검증은 task별
  // 지정 명령(worker, 보고로 확인)과 마지막 terminal node가 나눠 맡는다. 정책은
  // integration 사본에서 읽는다 — worker 사본은 worker가 바꿀 수 있다.
  const scopedTerminal = verificationPolicyAt(integration.integrationPath, blueprint) === 'scoped_terminal';

  // --- 재시작 복구: 이전 fanin 상태가 있으면 먼저 처리 ---
  const recovery = withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({
      ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash, validate: validateFaninLedger,
    });
    if (!opened.ok) return opened;
    const { ledger } = opened;
    if (!ledger.fanin) return { ok: true as const, resume: null as null };
    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    const fanin = ledger.fanin;
    // verified + HEAD가 candidate면 cherry-pick 없이 번들 복사부터 완결.
    if (fanin.status === 'verified' && fanin.candidate_head && head === fanin.candidate_head) {
      return {
        ok: true as const,
        resume: {
          mode: 'finish' as const,
          tasks: [...fanin.tasks],
          baseHead: fanin.base_head,
          candidateHead: fanin.candidate_head,
          evidenceId: null as string | null,
        },
      };
    }
    // HEAD가 base면 building이거나 ff 전 중단 — candidate만 지우고 원장은
    // phase 1이 덮어쓴다. 여기서 쓰면 fence hash가 깨져 같은 호출의 1단계가 거절된다.
    if (head === fanin.base_head) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: true as const, resume: null as null };
    }
    // base도 candidate도 아니면 원장·Git이 갈라진 상태.
    removeFaninWorktree(exec, repoRoot, faninPath);
    ledger.fanin = null;
    if (!owns()) return { ok: false as const, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    return { ok: false as const, reason: 'stale-integration-head' };
  });
  if (!recovery || typeof recovery !== 'object') return recovery;
  if ((recovery as { ok?: boolean }).ok === false) return recovery;

  const resume = (recovery as { resume: null | {
    mode: 'finish'; tasks: string[]; baseHead: string; candidateHead: string; evidenceId: string | null;
  } }).resume;

  if (resume && resume.mode === 'finish') {
    return finishFaninAfterFf({
      repoRoot, blueprint, exec, writeLedger, integration,
      ledgerPath, ledgerHash,
      tasks: resume.tasks,
      baseHead: resume.baseHead,
      candidateHead: resume.candidateHead,
      evidenceId: resume.evidenceId,
      alreadyFastForwarded: true,
      phase1CheckpointHash: null,
    });
  }

  // --- phase 1: 잠금 안에서 대상 확정·fanin building 기록 ---
  let phase1CheckpointHash: string | null = null;
  let waveTasks: string[] = [];
  let waveScopePaths: string[] = [];
  let waveWarnings: IntegrateWarning[] = [];
  let baseHead = '';
  const phase1 = withLedgerLock(integration.ledgerFile, (owns) => {
    const opened = openLedgerFenced({
      ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash, validate: validateFaninLedger,
    });
    if (!opened.ok) return opened;
    const { ledger } = opened;

    // --task + lease 플래그는 대상 확정 전에 checkLease.
    if (task) {
      const item = ledger.tasks.find((x) => x.id === task);
      if (!item) return { ok: false, reason: 'task-outside-blueprint' };
      if ((item.execution_kind || 'commit') === 'verification') {
        return { ok: false, reason: 'task-outside-blueprint' };
      }
      const leaseChecked = checkLease(item, {
        ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
        ...(generation !== undefined ? { generation } : {}),
      });
      if (!leaseChecked.ok) {
        const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
        if (leaseChecked.reason === 'stale-lease') {
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
        }
        return rejected;
      }
    }

    const selected = selectRecordedCommitIds(ledger, task);
    if (selected.length === 0) return { ok: false, reason: 'nothing-to-integrate' };
    const ordered = sortFaninTasks(ledger.tasks, selected);

    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (ledger.integrationHead !== head) {
      return { ok: false, reason: 'stale-integration-head' };
    }

    for (const id of ordered) {
      const item = ledger.tasks.find((x) => x.id === id) as Task;
      const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
      if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)
        || !workerOwnsSha(exec, worker, item.sha as string)) {
        return { ok: false, reason: 'sha-not-owned-by-worker' };
      }
      const evidence = checkWorkerEvidence(
        worker, integration.integrationPath, blueprint, id, item.sha as string,
      );
      if (!evidence.ok) return evidence;
    }

    // scoped_terminal은 worker가 자기 지정 명령만 돌렸다는 보고가 있어야 통합한다.
    // wave 전체 검증을 fan-in에서 다시 돌리지 않는 대신 거는 입구 검사다.
    if (scopedTerminal) {
      const mismatch = scopedTestReportFailure({
        integrationPath: integration.integrationPath, blueprint, light: false,
        items: ordered.map((id) => ledger.tasks.find((x) => x.id === id) as Task),
      });
      if (mismatch) return { ok: false, reason: 'worker-test-report-mismatch', ...mismatch };
    }

    // coordinator가 integration checkout을 직접 고치면 worker 보고 없이 통합된다.
    // fanin 기록 전에 끝내 거절 시 ledger 바이트가 호출 전과 같다.
    const mutated = disallowedDirtyPaths(exec, integration.integrationPath, blueprint, ledger);
    if (mutated.length > 0) return { ok: false, reason: 'integration-source-mutated', paths: mutated };
    // 경고는 결과 JSON에만 싣고 ledger에는 쓰지 않는다.
    waveWarnings = [];
    for (const id of ordered) {
      const warning = reportPathsWarning(
        exec, integration.integrationPath, blueprint, ledger.tasks.find((x) => x.id === id) as Task,
      );
      if (warning) waveWarnings.push(warning);
    }

    baseHead = head;
    waveTasks = ordered;
    ledger.fanin = {
      base_head: baseHead,
      candidate_head: null,
      tasks: ordered,
      status: 'building',
    };
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
    waveScopePaths = ordered.flatMap((id) => currentScopePaths(ledger.tasks.find((x) => x.id === id) as Task));
    return { ok: true as const, tasks: ordered, baseHead };
  });

  if (!phase1 || typeof phase1 !== 'object') return phase1;
  if ((phase1 as { ok?: boolean }).ok === false) return phase1;
  waveTasks = (phase1 as { tasks: string[] }).tasks;
  baseHead = (phase1 as { baseHead: string }).baseHead;

  // --- phase 2: 잠금 밖 — candidate 생성·cherry-pick·wave 검증 ---
  removeFaninWorktree(exec, repoRoot, faninPath);
  try {
    fs.mkdirSync(path.dirname(faninPath), { recursive: true });
    git(exec, repoRoot, ['worktree', 'add', '--detach', faninPath, baseHead]);
  } catch (error) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    throw error;
  }

  const seeded = seedCoordinatorWorker({
    repoRoot: integration.integrationPath, blueprintDir: blueprint, worktreePath: faninPath,
    // fan-in seed도 같은 stdio 고정 wrapper를 받아야 npm 출력이 CLI stdout을 오염시키지 않는다.
    deps: { execFileSync: withInstallStdioToStderr(exec) },
    // candidate는 wave 전체를 합치므로 어느 task든 manifest/lock을 바꿀 수 있으면 공유하지 않는다.
    affectedPaths: waveScopePaths,
  });
  if (!seeded.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return seeded;
    });
  }

  // 충돌이 아닌 fan-in 실패: candidate를 지우고 fanin 표식을 풀되 task는 revoke하지 않는다.
  const stopFaninFailed = (id: string) => {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return { ok: false, reason: 'cherry-pick-failed', task: id };
    });
  };
  const liveForSha = loadLedger(integration.ledgerFile);
  for (const id of waveTasks) {
    const item = liveForSha?.tasks.find((x) => x.id === id);
    const pickSha = item?.sha;
    if (!pickSha) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: false, reason: 'nothing-to-integrate' };
    }
    // 1. 범위 계산: rework로 worker 브랜치에 attempt별 커밋이 쌓이면 item.sha 하나만 pick할 때
    //    앞 커밋의 변경이 통합에서 빠진다. baseHead(phase 1이 고정한 값) 위의 전체 범위를 구한다.
    let range: string[];
    try {
      range = git(exec, faninPath, ['rev-list', '--reverse', `${baseHead}..${pickSha}`])
        .split('\n').filter(Boolean);
    } catch (_rangeError) {
      // rev-list 실패(bad object 등)는 충돌이 아니므로 revoke 없이 cherry-pick-failed로 멈춘다.
      return stopFaninFailed(id);
    }
    // 빈 범위: item.sha가 이미 baseHead의 조상이라 통합할 변경이 없다.
    if (range.length === 0) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      return { ok: false, reason: 'nothing-to-integrate' };
    }
    // squash 시 되돌아갈 지점. 단일 커밋 경로는 git 호출 순서를 보존하려고 읽지 않는다.
    let preHead: string | null = null;
    try {
      if (range.length > 1) preHead = git(exec, faninPath, ['rev-parse', 'HEAD']);
    } catch (_headError) {
      return stopFaninFailed(id);
    }
    try {
      for (const commit of range) git(exec, faninPath, ['cherry-pick', commit]);
    } catch (error) {
      // abort 전에 충돌 여부를 본다 — abort가 unmerged를 지우면 분류가 무너진다.
      const conflict = isCherryPickConflict(error, exec, faninPath);
      try {
        git(exec, faninPath, ['cherry-pick', '--abort']);
      } catch (_abortError) {
        // abort 실패도 candidate 삭제로 충분하다 — 진행 중 상태가 fanin에만 있다.
      }
      removeFaninWorktree(exec, repoRoot, faninPath);
      return withLedgerLock(integration.ledgerFile, (owns) => {
        const loaded = loadLedgerBytes(integration.ledgerFile);
        if (!loaded) return { ok: false, reason: 'missing-ledger' };
        const { ledger } = loaded;
        if (conflict) {
          // Target behavior: 충돌 task만 revoke. 나머지는 recorded로 남긴다.
          const conflicted = ledger.tasks.find((x) => x.id === id);
          if (conflicted) {
            revokeLease(ledger, conflicted, {
              reason: 'fanin-conflict',
              previousHead: typeof conflicted.sha === 'string' ? conflicted.sha : null,
            });
          }
          ledger.fanin = null;
          if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
          writeLedger(integration.ledgerFile, ledger);
          return { ok: false, reason: 'fanin-conflict', task: id };
        }
        // CONFLICT가 아니면 revoke하지 않는다 — 잘못된 fanin-conflict는 requeue를 속인다.
        ledger.fanin = null;
        if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
        writeLedger(integration.ledgerFile, ledger);
        return { ok: false, reason: 'cherry-pick-failed', task: id };
      });
    }
    // integration 커밋에 worker 출처를 남긴다. candidateHead를 읽기 전에 끝내야 ledger의
    // fanin.candidate_head가 amend 뒤 SHA를 가리킨다. hook이 fan-in worktree에서 lint를
    // 다시 돌리지 않도록 --no-verify, author/date는 cherry-pick 결과를 그대로 둔다.
    try {
      // 범위가 둘 이상이면 pick 결과를 한 커밋으로 합친다. -C item.sha가 마지막 worker
      // 커밋의 메시지·author·date를 그대로 가져와 아래 log/amend가 trailer만 덧붙이게 한다.
      if (preHead !== null) {
        git(exec, faninPath, ['reset', '--soft', preHead]);
        git(exec, faninPath, ['commit', '--no-verify', '-C', pickSha]);
      }
      const picked = git(exec, faninPath, ['log', '-1', '--format=%B']);
      git(exec, faninPath, [
        'commit', '--amend', '--no-verify', '-m', appendWorkerCommitTrailer(picked, pickSha),
      ]);
    } catch (_amendError) {
      // cherry-pick은 이미 끝나 진행 중 상태가 없으므로 --abort를 부르지 않는다.
      // 합치기·amend 어느 git 실패든 candidate를 지우고 cherry-pick 실패와 같은 reason으로
      // 멈춘다 — trailer 없는 integration 커밋이 verified fanin으로 남으면 출처 연결이 끊긴다.
      return stopFaninFailed(id);
    }
  }

  // gitignore 대상 빌드 산출물은 cherry-pick한 소스로 만들어야 한다. seed 시점의 setup은
  // baseHead 소스를 빌드하므로, 검증 직전에 한 번 더 돌려 wave 변경이 산출물에 반영되게 한다.
  const rebuilt = prepareVerificationDependencies(faninPath, exec);
  if (!rebuilt.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      loaded.ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, loaded.ledger);
      return rebuilt;
    });
  }

  const candidateHead = git(exec, faninPath, ['rev-parse', 'HEAD']);
  const intentId = intentIdFor(blueprint);
  const lastTask = waveTasks[waveTasks.length - 1];
  // scoped_terminal은 wave 전체 검증을 생략한다(null). 실패 복구 재검증과 finalize
  // remainder는 각자 별도 경로라 이 생략의 영향을 받지 않는다.
  const verification = scopedTerminal ? null : runTargetVerification(runner, {
    repoRoot: faninPath,
    blueprintDir: blueprint,
    taskId: lastTask,
    scope: {
      kind: 'wave',
      key: `${intentId}:wave:${candidateHead}`,
    },
  });

  if (verification && !verification.ok) {
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withLedgerLock(integration.ledgerFile, (owns) => {
      const loaded = loadLedgerBytes(integration.ledgerFile);
      if (!loaded) return { ok: false, reason: 'missing-ledger' };
      const { ledger } = loaded;
      const failed: FaninVerificationFailedDecision = {
        kind: 'fanin-verification-failed',
        tasks: [...waveTasks],
        command: verification.command,
        exitCode: verification.exitCode,
        evidence_id: typeof verification.evidenceId === 'string' ? verification.evidenceId : null,
      };
      ledger.decisions.push(failed);
      ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return {
        ok: false,
        reason: 'wave-verification-failed',
        tasks: [...waveTasks],
        verification,
      };
    });
  }

  // --- phase 3: 잠금 — checkpoint·CAS·verified 기록·ff·번들·integrated ---
  const finished = finishFaninAfterFf({
    repoRoot, blueprint, exec, writeLedger, integration,
    ledgerPath, ledgerHash,
    tasks: waveTasks,
    baseHead,
    candidateHead,
    evidenceId: verification && typeof verification.evidenceId === 'string'
      ? verification.evidenceId : null,
    alreadyFastForwarded: false,
    phase1CheckpointHash,
    ...(verification ? { verification } : {}),
  });
  // 경고가 없으면 키를 생략한다(다른 명령의 warnings 규칙과 같다).
  if (waveWarnings.length > 0 && (finished as { ok?: boolean }).ok === true) {
    return { ...(finished as object), warnings: waveWarnings };
  }
  return finished;
}

/**
 * CAS 확인 후 ff(또는 이미 ff된 복구)와 번들 복사·integrated 전이를 마친다.
 */
function finishFaninAfterFf({
  repoRoot, blueprint, exec, writeLedger, integration,
  ledgerPath, ledgerHash,
  tasks, baseHead, candidateHead, evidenceId,
  alreadyFastForwarded, phase1CheckpointHash, verification,
}: {
  repoRoot: string; blueprint: string;
  exec: Exec; writeLedger: (file: string, data: unknown) => void;
  integration: ReturnType<typeof coordinatorPathsFor>;
  ledgerPath?: string; ledgerHash?: string;
  tasks: string[];
  baseHead: string;
  candidateHead: string;
  evidenceId: string | null;
  alreadyFastForwarded: boolean;
  phase1CheckpointHash: string | null;
  verification?: { ok: boolean; command: string; exitCode: number; evidenceId?: string };
}): unknown {
  const faninPath = integration.faninPath;
  return withLedgerLock(integration.ledgerFile, (owns) => {
    // 정상 wave는 phase1CheckpointHash로만 끼어든 쓰기를 본다. 호출자 fence는
    // 1단계 쓰기 전 값이라 여기서 다시 검사하면 항상 stale가 된다.
    // 재시작 finish(이미 ff됨)만 호출자 fence를 다시 검사한다.
    const rechecked = recheckLedgerCheckpoint({
      ledgerFile: integration.ledgerFile, expectedHash: phase1CheckpointHash,
      fence: { ledgerPath, ledgerHash },
      onStale: () => removeFaninWorktree(exec, repoRoot, faninPath),
    });
    if (!rechecked.ok) return rechecked;
    const { ledger } = rechecked;

    const head = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
    if (!alreadyFastForwarded) {
      // CAS: canonical이 여전히 base일 때만 ff.
      if (head !== baseHead) {
        removeFaninWorktree(exec, repoRoot, faninPath);
        ledger.fanin = null;
        if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
        writeLedger(integration.ledgerFile, ledger);
        return { ok: false, reason: 'stale-integration-head' };
      }
      // ff 전 첫 쓰기: verified + candidate_head. 중단 시 재실행이 finish로 복구.
      ledger.fanin = {
        base_head: baseHead,
        candidate_head: candidateHead,
        tasks: [...tasks],
        status: 'verified',
      };
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);

      try {
        git(exec, integration.integrationPath, ['merge', '--ff-only', candidateHead]);
      } catch (error) {
        // ff 실패는 CAS를 다시 깨뜨린 것과 같다 — candidate만 지우고 원장을 비운다.
        removeFaninWorktree(exec, repoRoot, faninPath);
        const again = loadLedger(integration.ledgerFile);
        if (again) {
          again.fanin = null;
          writeLedger(integration.ledgerFile, again);
        }
        throw error;
      }
    } else if (head !== candidateHead) {
      removeFaninWorktree(exec, repoRoot, faninPath);
      ledger.fanin = null;
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      return { ok: false, reason: 'stale-integration-head' };
    }

    for (const id of tasks) {
      const item = ledger.tasks.find((x) => x.id === id);
      if (!item) continue;
      const worker = coordinatorPathsFor({ repoRoot, blueprint, task: id }).workerPath as string;
      copyEvidenceBundle(worker, integration.integrationPath, blueprint, id);
      item.status = transition('recorded', 'integrated');
    }
    ledger.integrationHead = candidateHead;
    const decision: FaninDecision = {
      kind: 'fanin',
      tasks: [...tasks],
      base_head: baseHead,
      candidate_head: candidateHead,
      evidence_id: evidenceId,
    };
    ledger.decisions.push(decision);
    ledger.fanin = null;
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    removeFaninWorktree(exec, repoRoot, faninPath);
    return withCheckpoint({
      ok: true as const,
      command: 'integrate',
      integrated: [...tasks],
      integrationHead: candidateHead,
      verification: verification || { ok: true, command: '', exitCode: 0 },
      ready: readyWaveGated(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }),
    }, ledger, integration.ledgerFile);
  });
}

/** `coordinate`가 받는 명령 인자. 공개 경계(`coordinateWithHints`)도 이 타입을 그대로 쓴다. */

/**
 * `status`: 잠금 없이 읽기 전용으로 checkpoint와 세션 지표를 돌려준다.
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateStatus(ctx: CoordinateCtx): CoordinateResult {
  const { cwd, main, integration } = ctx;
  const { command, repoRoot, blueprint } = ctx.args;
  const loaded = loadLedgerBytes(integration.ledgerFile);
  if (!loaded) return { ok: false, reason: 'missing-ledger' };
  const leaseShape = assertLeaseShape(loaded.ledger);
  if (!leaseShape.ok) return leaseShape;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  // drive-metrics.json은 main worktree에 있다(integration이 아니다). 읽기 전용 관측이라
  // 기록이 없거나 깨져도 status 판정에 영향을 주지 않는다.
  const sessions = driveMetrics.listCoordinatorSessions({
    file: driveMetrics.metricsFilePath(main.projectRoot as string), blueprint,
  });
  return {
    ok: true as const,
    command,
    checkpoint: {
      ...projectCheckpoint(loaded.ledger, integration.ledgerFile, loaded.bytes),
      sessions,
    },
  };
}

/**
 * `integrate`: 검증 실행을 잠금 밖에 두려고 `integrateTask`가 내부에서 두 단계 lock을 잡는다.
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} `integrateTask` 결과
 */
function coordinateIntegrate(ctx: CoordinateCtx): CoordinateResult {
  const { repoRoot, blueprint, task, sha, leaseId, generation, ledgerPath, ledgerHash } = ctx.args;
  const { cwd, exec, writeLedger, deps, integration } = ctx;
  return integrateTask({
    repoRoot, blueprint, cwd, task, sha, leaseId, generation,
    ledgerPath, ledgerHash, exec, writeLedger, deps,
    integration,
  });
}

/**
 * `prepare`: seed(npm ci)가 LOCK_STALE_MS를 넘길 수 있어 공통 fenced 잠금 앞에서 처리하고,
 * 잠금은 `prepareCoordinator`가 내부에서 잡는다.
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} `prepareCoordinator` 결과
 */
function coordinatePrepare(ctx: CoordinateCtx): CoordinateResult {
  const { repoRoot, blueprint, ledgerPath, ledgerHash } = ctx.args;
  const { cwd, exec, writeLedger, makeLeaseId, integration } = ctx;
  return prepareCoordinator({
    repoRoot, blueprint, cwd, ledgerPath, ledgerHash, exec, writeLedger, makeLeaseId, integration,
  });
}

/**
 * `repair --kind supplement --done`: 검증을 잠금 밖에서 돌려야 해서 공통 잠금 앞에서 갈라지며,
 * 두 단계 lock은 `supplementDone`이 잡는다.
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} `supplementDone` 결과
 */
function coordinateSupplementDone(ctx: CoordinateCtx): CoordinateResult {
  const { repoRoot, blueprint, ledgerPath, ledgerHash } = ctx.args;
  const { cwd, exec, writeLedger, deps, integration } = ctx;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  return coordinatorRepair.supplementDone({
    support: REPAIR_SUPPORT,
    blueprint, integrationPath: integration.integrationPath, ledgerFile: integration.ledgerFile,
    ledgerPath, ledgerHash, exec, writeLedger, deps,
  });
}

/**
 * `promote-stop`: light 원장을 promotion_stopped로 멈춘다. 멱등 재실행만 허용하는 유일한 fence mutation이라
 * promotion_stopped 거절보다 먼저 호출된다.
 *
 * @param {LockedCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinatePromoteStop(ctx: LockedCtx): CoordinateResult {
  const { cwd, exec, integration, ledger, commitWrite } = ctx;
  const { command, repoRoot, blueprint, summary, reason } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  if (ledgerModeOf(ledger) !== 'light') {
    return { ok: false, reason: 'promote-stop-requires-light' };
  }
  if (typeof reason !== 'string'
    || !(PROMOTE_STOP_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, reason: 'promote-reason-invalid' };
  }
  if (typeof summary !== 'string' || summary.trim() === '') {
    return { ok: false, reason: 'summary-required' };
  }
  const promoteReason = reason as PromoteStopReason;
  const promoteSummary = summary.trim();
  if (ledger.status === 'promotion_stopped') {
    const existing = ledger.promotion;
    if (existing
      && existing.reason === promoteReason
      && existing.summary === promoteSummary) {
      return withCheckpoint({
        ok: true as const, command, status: 'promotion_stopped' as const,
        promotion: existing,
      }, ledger, integration.ledgerFile);
    }
    return { ok: false, reason: 'promotion-already-stopped' };
  }
  const openTask = openPromoteTask(ledger.tasks);
  if (!openTask) return { ok: false, reason: 'task-outside-blueprint' };
  // fanin·terminalFailure는 건드리지 않는다. 정지는 promotion 필드만으로 기록한다.
  const promotion: PromotionRecord = {
    reason: promoteReason,
    summary: promoteSummary,
    task: openTask.id,
    diff_sha: worktreeDiffSha(exec, integration.integrationPath),
  };
  if (typeof openTask.verify_evidence_id === 'string' && openTask.verify_evidence_id !== '') {
    promotion.verify_evidence_id = openTask.verify_evidence_id;
  }
  if (typeof openTask.review_evidence_id === 'string' && openTask.review_evidence_id !== '') {
    promotion.review_evidence_id = openTask.review_evidence_id;
  }
  ledger.promotion = promotion;
  ledger.status = 'promotion_stopped';
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, status: 'promotion_stopped' as const, promotion,
  }, ledger, integration.ledgerFile);
}

/**
 * `session-open`: 세션 경계 표지를 원장에 덧붙인다. 다른 fenced mutation과 같이 fence·잠금 안에서 쓰고
 * 새 checkpoint를 돌려줘 root가 곧바로 `coordinate next`를 이어 부를 수 있게 한다.
 *
 * @param {LockedCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateSessionOpen(ctx: LockedCtx): CoordinateResult {
  const { cwd, exec, integration, ledger, commitWrite } = ctx;
  const { command, repoRoot, blueprint } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  // light 원장은 wave·fanin이 없어 세션 경계가 의미 없다. 거절 코드는 기존 것을 쓴다.
  if (ledgerModeOf(ledger) !== 'full') return { ok: false, reason: 'ledger-mode-mismatch' };
  // promotion_stopped는 위에서 이미 거절됐다. 남은 비활성 상태(부분 종료·사용자 확인 대기)에서
  // 새 세션을 열면 닫힌 drive를 되살리는 것처럼 보이므로 원장을 바꾸지 않고 막는다.
  if (ledger.status !== undefined && ledger.status !== 'active') {
    return { ok: false, reason: 'ledger-not-active' };
  }
  // 설정이 invalid여도 여기서 거절하지 않는다(거절은 prepare 몫). next가 같은 값을 1로
  // 접으므로 표지에도 1을 남겨 기록과 판정이 어긋나지 않게 한다.
  const wavesPolicy = readWavesPerSession(integration.integrationPath);
  const session: SessionDecision = {
    kind: 'session',
    opened_at: new Date().toISOString(),
    integration_head: git(exec, integration.integrationPath, ['rev-parse', 'HEAD']),
    waves_cap: wavesPolicy.ok ? wavesPolicy.cap : 1,
  };
  ledger.decisions.push(session);
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, decision: session,
  }, ledger, integration.ledgerFile);
}

/**
 * `worker-model`·`worker-tokens`: 기록 전용 명령. dispatch·lease·status·attempt를 바꾸지 않고
 * decision만 덧붙이므로 검증을 모두 통과한 뒤에만 commitWrite()를 부른다.
 *
 * @param {LockedCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateWorkerRecord(ctx: LockedCtx): CoordinateResult {
  const { cwd, integration, ledger, commitWrite } = ctx;
  const { command, repoRoot, blueprint, task, model, role, perspective, tokens } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  if (role === undefined || !WORKER_RECORD_ROLES.includes(role)) {
    return { ok: false, reason: 'worker-model-role-invalid' };
  }
  const recordRole = role as WorkerRecordRole;
  // 값 없는 플래그(true)와 공백 문자열은 모두 빈 값이다. 누락(undefined)은 CLI가 usage로 막는다.
  if (command === 'worker-model'
    && (typeof model !== 'string' || model.trim() === '')) {
    return { ok: false, reason: 'model-invalid' };
  }
  // 관점은 reviewer 전용이고 execute review 관점 열거 안이어야 한다.
  if (perspective !== undefined
    && (recordRole !== 'reviewer'
      || !REVIEW_PERSPECTIVE.includes(perspective))) {
    return { ok: false, reason: 'worker-model-perspective-invalid' };
  }
  // worker-model은 tokens가 선택이라 없으면 키를 쓰지 않고, worker-tokens는 필수다.
  const parsedTokens = tokens === undefined ? null : parseWorkerTokens(tokens);
  if ((tokens !== undefined || command === 'worker-tokens') && parsedTokens === null) {
    return { ok: false, reason: 'tokens-invalid' };
  }
  let owner: Task | undefined;
  if (task !== undefined) {
    owner = ledger.tasks.find((x) => x.id === task);
    if (!owner) return { ok: false, reason: 'task-outside-blueprint' };
  }
  const scope = {
    ...(task !== undefined ? { task } : {}),
    ...(perspective !== undefined ? { perspective } : {}),
  };
  const recorded: WorkerModelDecision | WorkerTokensDecision = command === 'worker-model'
    ? {
      kind: 'worker-model', role: recordRole, model: (model as string).trim(), ...scope,
      ...(parsedTokens !== null ? { tokens: parsedTokens } : {}),
    }
    : { kind: 'worker-tokens', role: recordRole, tokens: parsedTokens as number, ...scope };
  if (owner) owner.decisions = [...(owner.decisions || []), recorded];
  ledger.decisions.push(recorded);
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, decision: recorded,
  }, ledger, integration.ledgerFile);
}

/**
 * `critical-recovery` 1단계: task 조회 전에 ledger 전체 검증만 한다. 통과(null)하면 호출부가
 * task 조회와 2단계(`coordinateCriticalRecovery`)로 진행한다.
 *
 * @param {LockedCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult | null} 명령 결과. 거절은 `ok: false`와 reason
 */
function criticalRecoveryPrecheck(ctx: LockedCtx): CoordinateResult | null {
  const { cwd, ledger } = ctx;
  const { repoRoot, blueprint } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  const checked = runtime.validateCoordinatorLedger(ledger);
  if (!checked.ok) return { ok: false, reason: checked.reason };
  return null;
}

/**
 * `revoke`: prepared·recorded task의 lease를 회수한다.
 *
 * @param {LockedCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateRevoke(ctx: LockedCtx): CoordinateResult {
  const { cwd, integration, ledger, commitWrite } = ctx;
  const { command, repoRoot, blueprint, task, reason } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
  const revokeItem = ledger.tasks.find((x) => x.id === task);
  if (!revokeItem) return { ok: false, reason: 'task-outside-blueprint' };
  if (typeof reason !== 'string' || reason.trim() === '') {
    return { ok: false, reason: 'decision-reason-required' };
  }
  const status = revokeItem.status || 'pending';
  if (status !== 'prepared' && status !== 'recorded') {
    return { ok: false, reason: 'illegal-transition' };
  }
  const previousHead = typeof revokeItem.sha === 'string' ? revokeItem.sha : null;
  const revoked = revokeLease(ledger, revokeItem, {
    reason: reason.trim(), previousHead,
  });
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, task: revokeItem, decision: revoked,
  }, ledger, integration.ledgerFile);
}

/**
 * `dispatch`·`report`·`record`의 lease 검사. attempt·brief hash·상태 검사보다 앞에 둔다. revoke 뒤
 * 늦은 플래그 호출이 illegal-transition으로 가려지지 않게 한다. stale-lease 거절은 증적을 원장에 남긴다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult | null} 명령 결과. 거절은 `ok: false`와 reason
 */
function checkTaskLease(ctx: TaskCtx): CoordinateResult | null {
  const { task, ledger, commitWrite, item } = ctx;
  const { leaseId, generation } = ctx.args;
  const leaseChecked = checkLease(item, {
    ...(leaseId !== undefined ? { lease_id: leaseId } : {}),
    ...(generation !== undefined ? { generation } : {}),
  });
  if (!leaseChecked.ok) {
    const rejected = rejectLeaseMismatch(ledger, item, task, leaseChecked);
    if (leaseChecked.reason === 'stale-lease') {
      const lost = commitWrite();
      if (lost) return lost;
    }
    return rejected;
  }
  return null;
}

/**
 * `dispatch`·`report` 공통 가드. implementer 경계라 할당 worker에서만 열리며 task 상태(prepared)는
 * 유지하고 attempt 상태만 바꾼다. light는 workerPath===integration만 허용한다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult | null} 명령 결과. 거절은 `ok: false`와 reason
 */
function guardWorkerDispatch(ctx: TaskCtx): CoordinateResult | null {
  const { task, cwd, exec, integration, ledger, item } = ctx;
  const { repoRoot, blueprint } = ctx.args;
  if (ledgerModeOf(ledger) === 'light') {
    if (!lightWorkerAssigned(item, integration.integrationPath)) {
      return {
        ok: false, reason: 'unassigned-worker-worktree',
        workerPath: item.workerPath || integration.integrationPath,
      };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
  } else {
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
  }
  if (item.execution_kind === 'verification') {
    return { ok: false, reason: 'dispatch-commit-task-required' };
  }
  if ((item.status || 'pending') !== 'prepared') return { ok: false, reason: 'illegal-transition' };
  return null;
}

/**
 * `dispatch`: 새 attempt를 열고 brief hash·base HEAD를 원장에 고정한다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateDispatch(ctx: TaskCtx): CoordinateResult {
  const { task, cwd, exec, integration, ledger, commitWrite, item } = ctx;
  const { command, blueprint, model } = ctx.args;
  // --model은 선택이지만 줬다면 비어 있으면 안 된다. attempt를 열기 전에 거절해
  // 잘못된 값이 원장에 반쯤 남지 않게 한다.
  if (model !== undefined && (typeof model !== 'string' || model.trim() === '')) {
    return { ok: false, reason: 'model-invalid' };
  }
  if (item.dispatch?.status === 'active') {
    return { ok: false, reason: 'dispatch-already-active' };
  }
  // 직전 reported attempt가 있을 때만 previous_outcome을 싣는다. 최초 1회는 필드를
  // 생략해 "없음"과 빈 객체를 구분한다.
  const previousOutcome = item.dispatch?.status === 'reported'
  && item.dispatch.outcome && item.dispatch.summary
    ? { outcome: item.dispatch.outcome, summary: item.dispatch.summary }
    : undefined;
  let baseHead: string;
  let porcelain: string;
  try {
    baseHead = git(exec, cwd, ['rev-parse', 'HEAD']);
    porcelain = initialWorktreeState(exec, cwd);
  } catch (_error) {
  // HEAD·porcelain 조회 실패는 attempt를 열지 않는다. 부분 ledger를 남기면 재개가
  // 깨진 baseline을 정본으로 삼는다.
    return { ok: false, reason: 'dispatch-git-read-failed' };
  }
  const hash = taskBriefHashOf(cwd, blueprint, task);
  const nextAttempt = (item.dispatch?.attempt || 0) + 1;
  item.dispatch = {
    attempt: nextAttempt, task_brief_hash: hash, base_head: baseHead,
    initial_worktree_state: porcelain, status: 'active',
    ...(model !== undefined ? { model: model.trim() } : {}),
  };
  const dispatchDecision: DispatchDecision = {
    task, kind: 'dispatch', attempt: nextAttempt, task_brief_hash: hash,
    base_head: baseHead, initial_worktree_state: porcelain,
    ...(model !== undefined ? { model: model.trim() } : {}),
  };
  item.decisions = [...(item.decisions || []), dispatchDecision];
  ledger.decisions.push(dispatchDecision);
  { const lost = commitWrite(); if (lost) return lost; }
  const metadata: {
  attempt: number; task_brief_hash: string; base_head: string; initial_worktree_state: string;
  previous_outcome?: { outcome: string; summary: string };
} = {
  attempt: nextAttempt, task_brief_hash: hash, base_head: baseHead,
  initial_worktree_state: porcelain,
};
  if (previousOutcome) metadata.previous_outcome = previousOutcome;
  const report_path = reportPathFor(item.workerPath as string, task, nextAttempt);
  return withCheckpoint({
    ok: true as const, command, metadata, report_path, task: item, decisions: ledger.decisions,
  }, ledger, integration.ledgerFile);
}

/**
 * `report`: 활성 attempt의 worker 보고를 검증해 reported로 올린다. mismatch는 stale 증적만 남긴다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateReport(ctx: TaskCtx): CoordinateResult {
  const { task, exec, integration, ledger, commitWrite, item } = ctx;
  const { command, blueprint, summary, outcome, attempt, taskBriefHash } = ctx.args;
  if (!item.dispatch || item.dispatch.status !== 'active') {
    return { ok: false, reason: 'no-active-dispatch' };
  }
  if (!Number.isInteger(attempt) || (attempt as number) < 1) {
    return { ok: false, reason: 'invalid-attempt' };
  }
  if (typeof taskBriefHash !== 'string' || !/^[a-f0-9]{64}$/.test(taskBriefHash)) {
    return { ok: false, reason: 'invalid-task-brief-hash' };
  }
  if (!(REPORT_OUTCOMES as readonly string[]).includes(outcome || '')) {
    return { ok: false, reason: 'invalid-report-outcome' };
  }
  if (typeof summary !== 'string' || summary.trim() === '') {
    return { ok: false, reason: 'summary-required' };
  }
  // light는 루트 review.md에 review record 라운드와 accepted status가 있을 때만
  // accepted를 받는다. 독립 reviewer 여부는 CLI가 아니라 run 절차 몫이다.
  if (ledgerModeOf(ledger) === 'light' && outcome === 'accepted'
    && !lightReviewAccepted(integration.integrationPath, blueprint)) {
    return { ok: false, reason: 'light-review-required' };
  }
  // full 모드는 stale 비교보다 먼저 보고 파일로 revision 출처를 증명한다. 파일 값이
  // CLI 인자와 같을 때만 아래 stale 비교가 의미를 갖는다. 거절은 원장을 쓰지 않는다.
  let fileItems: { open_choices: string[]; known_weaknesses: string[] } | null = null;
  if (ledgerModeOf(ledger) !== 'light') {
    const checked = checkReportFile(
      reportPathFor(item.workerPath as string, task, item.dispatch.attempt),
      { attempt: attempt as number, task_brief_hash: taskBriefHash },
    );
    if (!checked.ok) return checked.failure;
    fileItems = checked;
  }
  const expected = {
    attempt: item.dispatch.attempt, task_brief_hash: item.dispatch.task_brief_hash,
  };
  const received = { attempt: attempt as number, task_brief_hash: taskBriefHash };
  // mismatch는 stale 증적만 남기고 활성 attempt를 유지한다. recorded로 올리면
  // 늦은 보고가 현재 dispatch를 닫아 재시도를 막는다.
  if (received.attempt !== expected.attempt
  || received.task_brief_hash !== expected.task_brief_hash) {
    const stale: StaleReportDecision = {
      task, kind: 'stale-report', expected, received,
    };
    item.decisions = [...(item.decisions || []), stale];
    ledger.decisions.push(stale);
    { const lost = commitWrite(); if (lost) return lost; }
    return { ok: false, reason: 'stale-report', expected, received };
  }
  // accepted만 커밋 확정을 요구한다. rework·blocked 등은 커밋 없이도 보고돼야 하므로
  // 건드리지 않는다. stale 판정 뒤·report decision 쓰기 전에 둬서 거절이 원장을 바꾸지 않는다.
  if (outcome === 'accepted' && (item.execution_kind || 'commit') !== 'verification') {
    const evidence = workerCommitEvidence(
      exec, item.workerPath || integration.integrationPath, blueprint, item, ledger,
    );
    if (!evidence.ok) return evidence;
  }
  item.dispatch.status = 'reported';
  item.dispatch.outcome = outcome as ReportOutcome;
  item.dispatch.summary = summary;
  const reportDecision: ReportDecision = {
    task, kind: 'report', attempt: attempt as number, task_brief_hash: taskBriefHash,
    outcome: outcome as ReportOutcome, summary,
    ...(fileItems
      ? { open_choices: fileItems.open_choices, known_weaknesses: fileItems.known_weaknesses } : {}),
  };
  item.decisions = [...(item.decisions || []), reportDecision];
  ledger.decisions.push(reportDecision);
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, attempt: attempt as number, decision: reportDecision,
    task: item, decisions: ledger.decisions,
  }, ledger, integration.ledgerFile);
}

/**
 * `record`: worker HEAD와 provenance를 ledger로 올린다. accepted report 뒤 상태를 다시 본다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateRecord(ctx: TaskCtx): CoordinateResult {
  const { task, cwd, exec, integration, ledger, commitWrite, item } = ctx;
  const { command, repoRoot, blueprint, sha, decision } = ctx.args;
  // record는 worker가 만든 SHA와 provenance를 ledger로 올리는 경계다. integration
  // checkout에서 다시 worker 경계를 요구하면 어떤 정상 worker도 기록할 수 없다.
  // light는 integration 자체가 workerPath이므로 등록 workers/ 검사가 아니라
  // integration 일치만 본다.
  if (ledgerModeOf(ledger) === 'light') {
    if (!lightWorkerAssigned(item, integration.integrationPath)) {
      return {
        ok: false, reason: 'unassigned-worker-worktree',
        workerPath: item.workerPath || integration.integrationPath,
      };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd);
  } else {
    const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
    // prepare 뒤에도 경로 치환은 가능하다. ledger에 저장한 문자열과 Git 등록을 둘 다
    // 다시 확인해야 symlink가 외부 checkout의 HEAD를 provenance로 기록할 수 없다.
    if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
      return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
    }
    ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
  }
  if ((item.status || 'pending') !== 'prepared') return { ok: false, reason: 'illegal-transition' };
  // accepted report가 없는 HEAD는 어느 brief·attempt의 결과인지 알 수 없다.
  // dispatch 없이 record하던 경로를 여기서 끊는다.
  if (!item.dispatch || item.dispatch.status !== 'reported'
  || item.dispatch.outcome !== 'accepted') {
    return { ok: false, reason: 'accepted-report-required' };
  }
  // report 이후 brief bytes가 바뀌면 수락한 보고와 다른 문서다. attempt를 닫지
  // 않은 채 stale-worker-report로만 거절해 재디스패치 여지를 남긴다.
  if (taskBriefHashOf(cwd, blueprint, task) !== item.dispatch.task_brief_hash) {
    return { ok: false, reason: 'stale-worker-report' };
  }
  // accepted report 뒤 worker HEAD·stamp·작업 트리가 바뀌었을 수 있어 record에서 다시 본다.
  // item.sha에 HEAD를 쓰기 전이어야 기준 HEAD가 worker 결과로 기록되지 않는다.
  if ((item.execution_kind || 'commit') !== 'verification') {
    const evidence = workerCommitEvidence(exec, cwd, blueprint, item, ledger);
    if (!evidence.ok) return evidence;
  }
  const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
  // record 시점의 HEAD만 허용한다. caller가 임의 SHA를 주장하거나 worker가
  // 다른 commit을 향한 뒤의 값을 기록하면 coordinator provenance가 무너진다.
  if (sha && sha !== workerHead) return { ok: false, reason: 'sha-not-worker-head' };
  item.status = transition('prepared', 'recorded'); item.sha = workerHead;
  if (decision !== undefined) {
    item.decisions = [...(item.decisions || []), decision];
    ledger.decisions.push({ task, decision });
  }
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({ ok: true as const, command, task: item, decisions: ledger.decisions },
    ledger, integration.ledgerFile);
}

/**
 * `rerecord`: integration HEAD가 바뀐 뒤 recorded task의 SHA를 새 직접 자식으로 교체한다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateRerecord(ctx: TaskCtx): CoordinateResult {
  const { task, cwd, exec, integration, ledger, commitWrite, item } = ctx;
  const { command, repoRoot, blueprint, sha, decision } = ctx.args;
  const worker = coordinatorPathsFor({ repoRoot, blueprint, task }).workerPath as string;
  if (item.workerPath !== worker || !registeredWorker(exec, integration.integrationPath, worker)) {
    return { ok: false, reason: 'unassigned-worker-worktree', workerPath: worker };
  }
  ensureIntegrationCwd(repoRoot, blueprint, cwd, task);
  if (item.status !== 'recorded' || !item.sha) return { ok: false, reason: 'not-recorded' };
  if (typeof decision !== 'string' || decision.trim() === '') {
    return { ok: false, reason: 'decision-reason-required' };
  }
  const integrationHead = git(exec, integration.integrationPath, ['rev-parse', 'HEAD']);
  if (ledger.integrationHead !== integrationHead) return { ok: false, reason: 'stale-integration-head' };
  const workerHead = git(exec, cwd, ['rev-parse', 'HEAD']);
  if (sha && sha !== workerHead) return { ok: false, reason: 'sha-not-worker-head' };
  if (workerHead === item.sha) return { ok: false, reason: 'sha-unchanged' };
  if (directParent(exec, cwd, workerHead) !== integrationHead) {
    return { ok: false, reason: 'sha-not-direct-integration-child' };
  }
  const rerecordDecision: RerecordDecision = {
    task, kind: 'rerecord', reason: decision.trim(), previousSha: item.sha,
    nextSha: workerHead, integrationHead,
  };
  item.sha = workerHead;
  item.decisions = [...(item.decisions || []), rerecordDecision];
  ledger.decisions.push(rerecordDecision);
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, task: item, decision: rerecordDecision, decisions: ledger.decisions,
  }, ledger, integration.ledgerFile);
}

/**
 * 복구 계열(coordinator-repair)이 정상 경로와 함께 쓰는 helper. 정의가 이 모듈에 남아 있어
 * coordinator-repair가 이 모듈을 가져오면 순환이 생기므로 handler 표 연결 지점에서 넘긴다.
 */
const REPAIR_SUPPORT = {
  openLedgerFenced, recheckLedgerCheckpoint, intentIdFor, verificationPolicyAt, salvageRevokedWorker, withCheckpoint,
};

/** lock 전, integration 등록 확인 뒤에 끝까지 처리하는 handler. 내부 lock은 각 기존 함수가 잡는다. */
const PRE_LOCK_HANDLERS = new Map<string, (ctx: CoordinateCtx) => CoordinateResult>([
  ['status', coordinateStatus],
  ['integrate', coordinateIntegrate],
  ['prepare', coordinatePrepare],
]);

/** lock 안·task 조회 전에 끝까지 처리하는 handler. `promote-stop`은 별도로 promotion_stopped 거절 앞에서 돈다. */
const LOCKED_HANDLERS = new Map<string, (ctx: LockedCtx) => CoordinateResult>([
  ['session-open', coordinateSessionOpen],
  ['worker-model', coordinateWorkerRecord],
  ['worker-tokens', coordinateWorkerRecord],
  ['partial-close', (ctx) => coordinatorRepair.coordinatePartialClose(ctx, REPAIR_SUPPORT)],
  ['revoke', coordinateRevoke],
  ['repair', (ctx) => coordinatorRepair.coordinateRepair(ctx, REPAIR_SUPPORT)],
]);

/** task 조회 뒤에 끝까지 처리하는 handler. */
const TASK_HANDLERS = new Map<string, (ctx: TaskCtx) => CoordinateResult>([
  ['critical-recovery', (ctx) => coordinatorRepair.coordinateCriticalRecovery(ctx, REPAIR_SUPPORT)],
  ['dispatch', coordinateDispatch],
  ['report', coordinateReport],
  ['record', coordinateRecord],
  ['rerecord', coordinateRerecord],
]);

/** lease 검사를 받는 명령. `rerecord`와 `critical-recovery`는 받지 않는다. */
const LEASE_CHECKED_COMMANDS = new Set(['dispatch', 'report', 'record']);

/**
 * coordinator 원장 명령을 실행한다. 실패는 `ok: false`와 reason만 내고,
 * 공개 경계(`coordinateWithHints`)가 cause·next를 붙인다.
 * `repair`는 `--failure-command`(CI)와 `reviewFindings`(최종 리뷰)를 한
 * 결정에 섞지 않는다 — 원장 `failure.command`가 원인을 하나만 갖게 하기 위해서다.
 *
 * @param {object} opts - coordinate 명령 인자
 * @param {string} opts.command - bootstrap·prepare·repair 등 서브커맨드
 * @param {string} opts.repoRoot - 저장소 루트
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} [opts.cwd] - 실제 write cwd. 기본은 repoRoot
 * @param {string} [opts.task] - 세 자리 task id. review repair는 생략 가능
 * @param {string} [opts.sha] - record/rerecord worker SHA
 * @param {unknown} [opts.decision] - repair·rerecord 결정 사유 또는 record 부가 결정
 * @param {string} [opts.failureCommand] - CI repair 실패 명령
 * @param {string} [opts.summary] - 실패·report 요약
 * @param {string[]} [opts.paths] - repair/revise 경로
 * @param {string[]} [opts.findings] - critical-recovery finding id
 * @param {string[]} [opts.reviewFindings] - 최종 리뷰 must_fix id. 없으면 CI 원인
 * @param {string} [opts.kind] - repair 종류. `supplement`는 범위 내 테스트 보완, 그 밖은 기존 경로
 * @param {boolean} [opts.done] - supplement 전용. 보완 완료를 알리고 검증을 돌린다
 * @param {string} [opts.outcome] - report 또는 critical-recovery 결과
 * @param {string} [opts.reason] - revoke·critical-recovery 사유
 * @param {string | true} [opts.model] - dispatch·worker-model 모델 인자. true는 값 없는 플래그
 * @param {string} [opts.role] - worker-model·worker-tokens 대상 role(implementer|reviewer|debugger)
 * @param {number | string} [opts.tokens] - worker-model 선택, worker-tokens 필수 토큰 수(0 이상 안전 정수)
 * @param {string} [opts.perspective] - worker-model reviewer 관점
 * @param {number} [opts.attempt] - dispatch report attempt
 * @param {string} [opts.taskBriefHash] - dispatch report brief hash
 * @param {string} [opts.leaseId] - task lease id
 * @param {number} [opts.generation] - task lease generation
 * @param {string} [opts.ledgerPath] - fence 원장 상대 경로
 * @param {string} [opts.ledgerHash] - fence sha256
 * @param {boolean} [opts.userConfirmed] - partial-close 사용자 확인
 * @param {boolean} [opts.promoteLight] - promotion_stopped light 원장을 full로 전환
 * @param {object} [opts.deps] - exec·verify·원장·handoff 쓰기 주입
 * @returns {object} 성공 시 ok:true와 명령별 필드, 실패 시 ok:false와 reason
 *   prepare는 worktree 생성·seed를 원장 잠금 밖에서 돌리고, 실패하면 이번 호출이
 *   만든 worker만 되돌린다.
 */
function coordinate(args: CoordinateArgs) {
  const { command, repoRoot, blueprint, cwd = repoRoot, task, kind, done, ledgerPath, ledgerHash, deps = {} } = args;
  const exec = deps.execFileSync || realExecFileSync as unknown as Exec;
  const main = runtimePaths({ repoRoot, execFileSync: exec });
  if (main.unavailable) return { ok: false, reason: 'non-git-root' };
  const ctx: CoordinateCtx = {
    args, cwd, deps, exec,
    writeLedger: deps.writeLedger || atomicWrite,
    makeLeaseId: deps.makeLeaseId || randomUUID,
    main,
    base: git(exec, repoRoot, ['rev-parse', 'HEAD']),
    paths: coordinatorPathsFor({ repoRoot, blueprint, task }),
    integration: coordinatorPathsFor({ repoRoot, blueprint }),
  };
  if (command === 'bootstrap') return coordinateBootstrap(ctx);
  const { integration } = ctx;
  if (!registeredIntegration(exec, repoRoot, integration.integrationPath)) {
    return { ok: false, reason: 'unassigned-integration-worktree', integrationPath: integration.integrationPath };
  }
  const preLock = PRE_LOCK_HANDLERS.get(command);
  if (preLock) return preLock(ctx);

  if (!LEDGER_FENCED_COMMANDS.has(command)) {
    return { ok: false, reason: 'unknown-coordinate-command' };
  }
  if (command === 'repair' && kind === 'supplement' && done === true) return coordinateSupplementDone(ctx);

  return withLedgerLock(integration.ledgerFile, (owns) => {
    // status는 읽기 전용, bootstrap은 위에서 이미 반환. 그 외 쓰기는 path/hash가
    // 방금 로드한 원장 bytes와 같을 때만 진행해 stale checkpoint로 Git·원장이 갈라지지 않게 한다.
    const opened = openLedgerFenced({ ledgerFile: integration.ledgerFile, ledgerPath, ledgerHash });
    if (!opened.ok) return opened;
    const { ledger, bytes: ledgerBytes } = opened;
    const commitWrite = (): { ok: false; reason: 'ledger-lock-lost' } | null => (
      writeOwnedLedger(owns, ctx.writeLedger, integration.ledgerFile, ledger)
    );
    const locked: LockedCtx = { ...ctx, ledger, ledgerBytes, commitWrite };

    // promote-stop만 멱등 재실행을 허용한다. 그 외 fence mutation은 정지 뒤 거절해
    // 스냅샷(reason·diff·증적)이 바뀌지 않게 한다. 해제는 없다 — full 재계획은
    // 새 bootstrap/current --set이다.
    if (command === 'promote-stop') return coordinatePromoteStop(locked);
    if (ledger.status === 'promotion_stopped') {
      return { ok: false, reason: 'promotion-stopped' };
    }
    const lockedHandler = LOCKED_HANDLERS.get(command);
    if (lockedHandler) return lockedHandler(locked);
    if (command === 'critical-recovery') {
      const rejected = criticalRecoveryPrecheck(locked);
      if (rejected) return rejected;
    }

    if (!task || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
    const item = ledger.tasks.find((x) => x.id === task);
    if (!item) return { ok: false, reason: 'task-outside-blueprint' };
    const taskCtx: TaskCtx = { ...locked, item, task };
    if (LEASE_CHECKED_COMMANDS.has(command)) {
      const leaseRejected = checkTaskLease(taskCtx);
      if (leaseRejected) return leaseRejected;
    }
    if (command === 'dispatch' || command === 'report') {
      const guardRejected = guardWorkerDispatch(taskCtx);
      if (guardRejected) return guardRejected;
    }
    const taskHandler = TASK_HANDLERS.get(command);
    return taskHandler ? taskHandler(taskCtx) : { ok: false, reason: 'unknown-coordinate-command' };
  });
}

const FALLBACK_COORDINATE_NEXT =
  'Run `bouncer coordinate status` and continue from its checkpoint.';

// 힌트는 여기 한 표만 본다. 개별 return { ok: false }에 cause/next를 흩어 쓰면
// 새 reason이 표 없이 새어 나가고 coordinator가 다시 coordinator.ts를 읽게 된다.
const COORDINATE_FAILURE_HINTS: Record<string, { cause: string; next: string }> = {
  'accepted-report-required': {
    cause: 'Record requires an accepted dispatch report for this task, and none is stored.',
    next: 'Call `bouncer coordinate report` with outcome accepted, then retry `bouncer coordinate record`.',
  },
  'bootstrap-requires-main-checkout': {
    cause: 'Bootstrap must run from the main checkout, not an integration or worker worktree.',
    next: 'Change cwd to the main checkout and rerun `bouncer coordinate bootstrap`.',
  },
  'cherry-pick-failed': {
    cause: 'Cherry-pick of the recorded worker commit into the fan-in candidate failed.',
    next: 'Inspect the named task, then `bouncer coordinate revoke` it or retry '
      + '`bouncer coordinate integrate` after fixing the commit.',
  },
  'coordinator-config-invalid': {
    cause: '`.bouncer/config.json` coordinator policy is missing or invalid.',
    next: 'Fix coordinator config in the integration worktree, then rerun `bouncer coordinate prepare`.',
  },
  'critical-recovery-closed': {
    cause: 'This task already has a closed critical-recovery outcome.',
    next: 'Do not retry `bouncer coordinate critical-recovery`; continue from `bouncer coordinate status`.',
  },
  'critical-recovery-exhausted': {
    cause: 'This task already used its one critical-recovery attempt.',
    next: 'Report the block to the user; do not retry `bouncer coordinate critical-recovery`.',
  },
  'critical-recovery-not-started': {
    cause: 'No open critical-recovery record exists on this task to close.',
    next: 'Start recovery with `bouncer coordinate critical-recovery` and findings before sending an outcome.',
  },
  'critical-recovery-outcome-invalid': {
    cause: 'Critical-recovery outcome must be resolved or blocked.',
    next: 'Retry `bouncer coordinate critical-recovery` with outcome resolved or blocked.',
  },
  'decision-reason-required': {
    cause: 'This mutation requires a non-empty decision reason.',
    next: 'Retry the same `bouncer coordinate` command with a reason that names why the change is required.',
  },
  'dependency-install-failed': {
    cause:
      'Locked development dependencies could not be installed in an integration '
      + 'or worker worktree.',
    next:
      'Inspect npm ci in that worktree, then retry `bouncer coordinate prepare` '
      + 'or `bouncer coordinate integrate` for the verification task.',
  },
  'dispatch-already-active': {
    cause: 'This task already has an active dispatch, so a second dispatch is refused.',
    next: 'Call `bouncer coordinate report` for the open attempt, or `bouncer coordinate status` to see it.',
  },
  'dispatch-commit-task-required': {
    cause: 'Dispatch applies only to commit tasks, not verification tasks.',
    next: 'Run `bouncer coordinate status` and dispatch a commit task id instead.',
  },
  'dispatch-git-read-failed': {
    cause: 'Git could not read the worker HEAD or worktree state needed to open dispatch.',
    next: 'Repair the assigned worker worktree, then retry `bouncer coordinate dispatch`.',
  },
  'failure-evidence-required': {
    cause: 'Repair needs terminal failure evidence (command, summary, and paths).',
    next: 'Pass failure evidence into `bouncer coordinate repair` from the failed verification.',
  },
  'fanin-conflict': {
    cause: 'Fan-in hit a conflict while applying a recorded worker commit.',
    next: 'Call `bouncer coordinate revoke` for the conflicting task, then retry `bouncer coordinate integrate`.',
  },
  'findings-required': {
    cause: 'Starting critical recovery requires a non-empty findings list.',
    next: 'Retry `bouncer coordinate critical-recovery` with at least one finding id.',
  },
  'illegal-transition': {
    cause: 'The task is not in a status that allows this coordinate command.',
    next: 'Run `bouncer coordinate status` and issue the command that matches the task status.',
  },
  'invalid-attempt': {
    cause: 'The report attempt number does not match the active dispatch.',
    next: 'Call `bouncer coordinate report` with the attempt from the last `bouncer coordinate dispatch`.',
  },
  'invalid-report-outcome': {
    cause: 'The report outcome is not one of the accepted dispatch outcomes.',
    next: 'Retry `bouncer coordinate report` with accepted, rework, scope_revision, task_change, or blocked.',
  },
  'invalid-task-brief-hash': {
    cause: 'The report task_brief_hash does not match the active dispatch.',
    next: 'Call `bouncer coordinate report` with the task_brief_hash from the last `bouncer coordinate dispatch`.',
  },
  'lease-flags-require-task': {
    cause: 'Lease flags were supplied without a task id to bind them to.',
    next: 'Retry the same `bouncer coordinate` command with `--task` plus the lease flags.',
  },
  'lease-invalid': {
    cause: 'The ledger lease shape or leaseSeq is invalid.',
    next: 'Run `bouncer coordinate status`; if the ledger is corrupt, report it to the user and do not invent a lease.',
  },
  'lease-required': {
    cause: 'This mutation requires the task lease id and generation.',
    next: 'Retry with `--lease-id` and `--generation` from the last `bouncer coordinate prepare` or status checkpoint.',
  },
  'ledger-checkpoint-invalid': {
    cause: 'The ledger path/hash fence is missing or not a valid integration-relative checkpoint.',
    next: 'Run `bouncer coordinate status` and pass its checkpoint.ledger path and sha256.',
  },
  'ledger-lock-lost': {
    cause: 'The process lost the ledger lock before it could write.',
    next: 'Run `bouncer coordinate status` and retry the same command from that '
      + 'checkpoint; do not write the ledger by hand.',
  },
  'ledger-mode-mismatch': {
    cause: 'The existing ledger mode does not match the blueprint scale for this bootstrap.',
    next: 'Use a matching scale (light ledger with scale light, full with non-light), or start a new blueprint drive.',
  },
  'ledger-not-active': {
    cause: 'The ledger is partial_closed or awaiting_confirmation, so a new coordinator session cannot open.',
    next: 'Report the ledger status to the user; do not retry `bouncer coordinate session-open` on this blueprint.',
  },
  'light-requires-single-task': {
    cause: 'Scale light requires one independent commit task; a blueprint with verification_policy scoped_terminal '
      + 'also requires exactly one terminal verification task that depends only on it. A legacy light blueprint '
      + 'allows no verification task.',
    next: 'Fix the blueprint to that shape, or set scale to full and bootstrap again.',
  },
  'verification-policy-invalid': {
    cause: 'The blueprint index declares a verification_policy value other than scoped_terminal.',
    next: 'Set verification_policy to scoped_terminal or remove the key (legacy), then bootstrap again.',
  },
  'worker-test-report-mismatch': {
    cause: 'A scoped_terminal worker report does not show the task-assigned command with a passing result '
      + 'in its Tests section (problem names which check failed).',
    next: 'Reject the fan-in: send the worker back to run exactly the assigned bouncer.verify command and '
      + 'report its command and result under Tests; never hand the worker the full-suite command.',
  },
  'light-review-required': {
    cause: 'Light-mode accepted report requires blueprint-root review.md rounds and status accepted.',
    next:
      'Record a review round with `bouncer review record` on the root review.md, '
      + 'set status accepted, then retry report.',
  },
  'main-source-mutated': {
    cause: 'Bootstrap changed tracked files in the main checkout, which is forbidden.',
    next: 'Restore the main checkout, then retry `bouncer coordinate bootstrap`.',
  },
  'missing-blueprint': {
    cause: 'The integration worktree has no blueprint directory for this drive.',
    next: 'Restore the blueprint on the integration worktree, then retry `bouncer coordinate prepare`.',
  },
  'missing-ledger': {
    cause: 'The coordinator ledger file is missing for this blueprint.',
    next: 'Run `bouncer coordinate bootstrap` from the main checkout, then continue from `bouncer coordinate status`.',
  },
  'missing-verification-bundle': {
    cause: 'The worker is missing the verification task bundle required for fan-in.',
    next: 'Restore the task bundle on the worker, then retry `bouncer coordinate integrate`.',
  },
  'main-checkout-root-required': {
    cause: 'Partial-close can write handoff only when repoRoot resolves to the canonical main checkout.',
    next: 'Run `bouncer coordinate partial-close` from the main checkout while keeping the assigned integration cwd.',
  },
  'next-plan-must-be-regular-file': {
    cause: 'NEXT_PLAN.md exists but is not a regular file.',
    next: 'Replace it with a regular NEXT_PLAN.md on the integration worktree, then '
      + 'retry `bouncer coordinate partial-close`.',
  },
  'next-plan-must-be-untracked': {
    cause: 'NEXT_PLAN.md is tracked, but partial-close requires it untracked.',
    next: 'Untrack NEXT_PLAN.md without deleting the plan, then retry `bouncer coordinate partial-close`.',
  },
  'next-plan-required': {
    cause: 'Partial-close in awaiting_confirmation requires NEXT_PLAN.md.',
    next: 'Write NEXT_PLAN.md on the integration worktree, then retry `bouncer coordinate partial-close`.',
  },
  'no-active-dispatch': {
    cause: 'Report was called with no active dispatch for this task.',
    next: 'Open `bouncer coordinate dispatch` first, then call `bouncer coordinate report`.',
  },
  'non-git-root': {
    cause: 'The repo root is not an available git checkout.',
    next: 'Run `bouncer coordinate` from a git repository root that Bouncer can resolve.',
  },
  'not-ready': {
    cause: 'The task is not in the ready wave for this command.',
    next: 'Run `bouncer coordinate status` and act on a task listed in checkpoint.ready.',
  },
  'not-recorded': {
    cause: 'Rerecord requires a recorded task with a stored SHA.',
    next: 'Call `bouncer coordinate record` first, or pick a recorded task from `bouncer coordinate status`.',
  },
  'nothing-to-integrate': {
    cause: 'No recorded commit tasks remain to fan in.',
    next: 'Run `bouncer coordinate status` and record remaining commit tasks before `bouncer coordinate integrate`.',
  },
  'partial-close-awaiting-confirmation-required': {
    cause: 'Partial-close is allowed only while the drive is awaiting confirmation.',
    next: 'Run `bouncer coordinate status` and wait for awaiting_confirmation before '
      + '`bouncer coordinate partial-close`.',
  },
  'partial-close-user-confirmation-required': {
    cause: 'Partial-close records a terminal failure and requires explicit user confirmation.',
    next: 'Review the main-checkout handoff, then retry `bouncer coordinate partial-close --user-confirmed`.',
  },
  'promote-reason-invalid': {
    cause: 'promote-stop reason must be one of the five light promotion enums.',
    next: 'Retry with --reason security-risk, out-of-scope, task-split, '
      + 'interface-semantics, or reviewer-wider-scope.',
  },
  'promote-stop-requires-light': {
    cause: 'promote-stop applies only to a light ledger (mode: light).',
    next: 'Do not call promote-stop on a full ledger; continue with the full coordinate path.',
  },
  'promote-light-requires-stopped': {
    cause: 'The existing coordinator ledger is not a promotion_stopped light ledger.',
    next: 'Stop the light drive with `bouncer coordinate promote-stop`, then rerun bootstrap with `--promote-light`.',
  },
  'promote-light-scale-light': {
    cause: 'The main checkout blueprint still has light scale.',
    next: 'Approve the full replan in the main checkout, then rerun `coordinate bootstrap --promote-light`.',
  },
  'promote-light-archive-exists': {
    cause: 'A light promotion archive or patch already exists for this integration worktree.',
    next: 'Inspect the existing promotion artifacts and recover them before retrying.',
  },
  'promotion-diff-drift': {
    cause: 'The integration worktree no longer matches the diff recorded by promote-stop.',
    next: 'Restore the stopped worktree to its recorded state or inspect it before retrying promotion.',
  },
  'promote-light-incomplete': {
    cause: 'Promotion failed partway through; the response reports whether rollback restored the original state.',
    next: 'Follow the returned recovery instructions before retrying bootstrap.',
  },
  'promotion-already-stopped': {
    cause: 'This light ledger is already promotion_stopped with a different reason or summary.',
    next: 'Keep the recorded promotion snapshot; replan as full with a new bootstrap and '
      + '`bouncer current --set` after the user approves.',
  },
  'run-detached': {
    cause: 'This run was detached with `bouncer run detach`; its ledger is preserved but no longer driven.',
    next: 'Finalize with `bouncer current --set <blueprint>` then /bouncer-finalize, or plan new work; '
      + 'do not retry coordinate mutations on this blueprint.',
  },
  'promotion-stopped': {
    cause: 'This light ledger was stopped for promotion; light mutations are refused.',
    next: 'After the full replan is approved in the main checkout, run `bouncer coordinate bootstrap --promote-light`.',
  },
  'reason-required': {
    cause: 'Critical recovery requires a non-empty reason string.',
    next: 'Retry `bouncer coordinate critical-recovery` with a reason.',
  },
  'repair-cause-ambiguous': {
    cause: 'Repair cannot take both a review finding and a verification failure command.',
    next: 'Retry `bouncer coordinate repair` with either `--review-finding` or `--failure-command`, not both.',
  },
  'repair-resolution-ambiguous': {
    cause: 'Repair cannot take both `--resume-task` and `--disposition`.',
    next: 'Retry `bouncer coordinate repair` with exactly one of `--resume-task <ddd>` or '
      + '`--disposition outside_scope`.',
  },
  'resume-task-invalid': {
    cause: 'The resume task must be a different, already integrated implementation task of this blueprint.',
    next: 'Pick the integrated implementation task that owns the failing code from `bouncer coordinate status`.',
  },
  'failure-evidence-mismatch': {
    cause: 'The given task or failure command is not the terminal failure currently recorded in the ledger.',
    next: 'Copy `--task` and `--failure-command` from the ledger `recent_failure` and retry.',
  },
  'disposition-invalid': {
    cause: 'The only supported failure disposition is `outside_scope`.',
    next: 'Retry with `--disposition outside_scope`, or use `--resume-task` to rework an approved task.',
  },
  'disposition-evidence-required': {
    cause: 'The recorded terminal failure carries no evidence id or source identity to classify against.',
    next: 'Rerun the terminal verification so the failure stores its evidence, or keep the failure blocked.',
  },
  'disposition-stale-source': {
    cause: 'The integration source changed after the terminal failure was recorded.',
    next: 'Rerun the terminal verification on the current source, then classify the new failure.',
  },
  'disposition-scope-mixed': {
    cause: 'A given path belongs to a task scope, so the failure cannot be classified as outside every approved scope.',
    next: 'Use `--resume-task` for the owning task, or pass only paths no task owns.',
  },
  'scope-path-untracked': {
    cause: 'A given scope path is not tracked at the integration HEAD, so no worker can edit it in place.',
    next: 'Take paths from tracked files named in the failure evidence or debugger report, '
      + 'or pass a file to create with `--new-path` when its parent directory is tracked.',
  },
  // 아래 10종은 `coordinate revise`(reviseTaskScope)만 내는 거절이다. 표에 없으면
  // fallback 힌트가 붙어 coordinator가 거절 원인과 다음 행동을 알 수 없다.
  'scope-paths-required': {
    cause: '`coordinate revise` was called without any `--paths` entry.',
    next: 'Pass the full replacement scope as `--paths <path>...` and rerun `bouncer coordinate revise`.',
  },
  'scope-path-glob': {
    cause: 'A given scope path contains a glob character, but scope paths must be literal files or directories.',
    next:
      'Replace each glob with literal tracked paths (or a directory ending in `/`) and rerun `bouncer ' +
      'coordinate revise`.',
  },
  'scope-path-out-of-bounds': {
    cause:
      'A given scope path points outside the repository or into a path scope may not cover (such as ' +
      '`.bouncer/context/`).',
    next: 'Use repo-relative source or test paths only, then rerun `bouncer coordinate revise`.',
  },
  'task-document-missing': {
    cause: 'The task document for the named task cannot be found or read in this worktree.',
    next:
      'Check `--task` and `--blueprint` against `bouncer coordinate status`, then rerun the same ' +
      '`bouncer coordinate` command.',
  },
  'no-coordinator-paths': {
    cause: 'No coordinator runtime paths could be derived for this blueprint.',
    next: 'Run from the worker or integration worktree of the driven blueprint and pass a valid `--blueprint`.',
  },
  'no-git': {
    cause: 'The current directory is not inside a git work tree, so scope cannot be judged.',
    next: 'Change cwd to the assigned worker worktree and rerun the same `bouncer coordinate` command.',
  },
  'main-worktree-source-write': {
    cause: 'The current directory is the main checkout, which a coordinator drive must not write.',
    next: 'Change cwd to the assigned worker worktree and rerun the same `bouncer coordinate` command.',
  },
  'unassigned-worktree': {
    cause: 'The current worktree is not a worker worktree registered in the coordinator ledger.',
    next: 'Change cwd to the worker worktree assigned to the task and rerun the same `bouncer coordinate` command.',
  },
  'unreadable-ledger': {
    cause: 'The coordinator ledger exists but cannot be read or parsed.',
    next:
      'Do not edit the ledger by hand; restore it from the integration worktree and rerun after `bouncer ' +
      'coordinate status` succeeds.',
  },
  'ledger-locked': {
    cause: 'Another coordinator command holds the ledger lock.',
    next: 'Wait for the other command to finish, then retry the same `bouncer coordinate` command.',
  },
  'scope-new-path-parent-missing': {
    cause: 'The parent directory of a `--new-path` entry holds no tracked file at the integration HEAD.',
    next: 'Create the file under an existing tracked directory, or revise the plan to add the directory first.',
  },
  'repair-verify-required': {
    cause: 'A scoped_terminal blueprint needs the repair task to carry its own verify command.',
    next: 'Retry `bouncer coordinate repair` with `--verify` set to one command that checks only the failing files.',
  },
  'repair-verify-not-single-argv': {
    cause: '`--verify` is empty or chains shell operators, so it is not one executable argv.',
    next: 'Pass a single command such as `node --test test/a.test.js` without `&&`, `|`, `;`, or redirection.',
  },
  'repair-verify-is-terminal': {
    cause: '`--verify` equals the terminal full-suite command, which scoped_terminal forbids on commit tasks (G20).',
    next: 'Pass a command that checks only the failing files; the terminal task re-runs the full suite.',
  },
  'repair-scope-out-of-bounds': {
    cause: 'Repair paths are outside the blueprint-scoped source bound.',
    next: 'Retry `bouncer coordinate repair` with paths inside the blueprint source scope.',
  },
  'final-review-single-round': {
    cause: 'The blueprint final review already recorded its one discovery round, so no review-caused '
      + 'repair, supplement, or delta round may open.',
    next: 'Defer the remaining must_fix findings with a note and accept the review, or stop with '
      + '`final-review-blocked` for the user decision.',
  },
  'supplement-delta-used': {
    cause: 'The blueprint root review already recorded its one delta round, so no in-place supplement may open.',
    next: 'Use the existing `bouncer coordinate repair --review-finding` path or report the open finding as blocked.',
  },
  'supplement-not-pending': {
    cause: 'There is no pending supplement decision to complete.',
    next: 'Open one with `bouncer coordinate repair --kind supplement --review-finding <id> ...` first, '
      + 'or use the existing repair path.',
  },
  'supplement-paths-exceeded': {
    cause: 'The integration worktree changed paths outside the accepted supplement paths.',
    next: 'Restore the extra changes; if product code must change, report it as blocked or use '
      + '`bouncer coordinate repair --review-finding` instead.',
  },
  'supplement-paths-not-tests': {
    cause: 'A supplement may change test paths only; a path is not a test path (or is under fixtures).',
    next: 'Retry with test paths only, or use the existing `bouncer coordinate repair --review-finding` path.',
  },
  'supplement-verify-failed': {
    cause: 'The relevant verify command failed after the supplement; the decision stays pending.',
    next: 'Fix the supplement and retry `--done`; if the failure shows a product defect, report it as blocked '
      + 'or use the existing repair path.',
  },
  'repair-wave-limit': {
    cause: 'This drive already used the maximum of two repair waves.',
    next: 'Report the terminal failure to the user; do not retry `bouncer coordinate repair`.',
  },
  'review-repair-requires-integrated': {
    cause: 'A final-review repair can open only after every task on the blueprint is integrated.',
    next: 'Finish remaining tasks, then retry `bouncer coordinate repair` with `--review-finding`.',
  },
  'scaffold-comment-remaining': {
    cause: '계획 문서에 옛 스캐폴드 안내 주석이 남음',
    next: '주석을 지우고 plan gate를 다시 통과한 뒤 bootstrap',
  },
  'sha-not-direct-integration-child': {
    cause: 'The new worker SHA is not a direct child of the recorded integration-base commit.',
    next: 'Reset the worker onto the recorded SHA, then retry `bouncer coordinate rerecord`.',
  },
  'sha-not-owned-by-worker': {
    cause: 'The recorded SHA is not owned by the assigned worker worktree.',
    next: 'Restore the assigned worker worktree, then retry `bouncer coordinate integrate`.',
  },
  'sha-not-worker-head': {
    cause: 'The supplied SHA is not the assigned worker HEAD.',
    next: 'Omit sha or pass the worker HEAD, then retry `bouncer coordinate record`.',
  },
  'sha-unchanged': {
    cause: 'Rerecord requires a worker HEAD that differs from the stored SHA.',
    next: 'Commit the new worker work, then retry `bouncer coordinate rerecord`.',
  },
  'integration-source-mutated': {
    cause: 'The integration checkout has uncommitted changes outside the seed manifest '
      + 'and integrated or repair task evidence, so the root or coordinator edited it directly.',
    next: 'Commit governance changes (an epic migration, `.bouncer/epics.json`) on main before the drive '
      + 'and prepare the drive again. During a drive, move source changes into a worker task or '
      + '`bouncer coordinate repair`. Revert the direct edits in the integration checkout, '
      + 'then call integrate again.',
  },
  'stale-integration-head': {
    cause: 'The integration worktree HEAD does not match the ledger integrationHead.',
    next: 'Reset the integration worktree to the ledger head from `bouncer coordinate status`, then retry.',
  },
  'stale-ledger-checkpoint': {
    cause: 'The supplied ledger hash does not match the bytes loaded for this mutation.',
    next: 'Run `bouncer coordinate status` and retry with the new checkpoint.ledger sha256.',
  },
  'stale-lease': {
    cause: 'The supplied lease id or generation does not match the task lease.',
    next: 'Run `bouncer coordinate status` and retry with the current `--lease-id` and `--generation`.',
  },
  'report-revision-missing': {
    cause: 'The worker report file is missing or has no valid `## Brief revision` (attempt and task_brief_hash).',
    next: 'Keep the attempt open; ask the worker to write the report file at `report_path`, '
      + 'or redispatch the same attempt, then retry `bouncer coordinate report`.',
  },
  'report-revision-conflict': {
    cause: 'The report file Brief revision differs from the `--attempt` / `--task-brief-hash` arguments.',
    next: 'Keep the attempt open; fix the report file or retry with the file values, do not edit the ledger.',
  },
  'report-section-missing': {
    cause: 'The worker report file lacks `## Open choices` or `## Known weaknesses`.',
    next: 'Keep the attempt open; ask the worker to add the missing sections (`- none` when empty), then retry.',
  },
  'stale-report': {
    cause: 'The report attempt or task_brief_hash does not match the active dispatch.',
    next: 'Keep the attempt open and call `bouncer coordinate report` with the received '
      + 'attempt and task_brief_hash; do not call record.',
  },
  'stale-worker-report': {
    cause: 'The task brief changed after the accepted report, so the report no longer matches the brief.',
    next: 'Open a new `bouncer coordinate dispatch` for this task and rerun the implementer; do not retry record.',
  },
  'model-invalid': {
    cause: 'The model argument is empty or was given without a value.',
    next: 'Retry with the one-line output of `bouncer subagent-model --agent <name>` as `--model <value>`.',
  },
  'worker-model-role-invalid': {
    cause: 'worker-model and worker-tokens record only the implementer, reviewer or debugger role.',
    next: 'Retry with `--role implementer`, `--role reviewer` or `--role debugger`.',
  },
  'tokens-invalid': {
    cause: 'The tokens value is negative, fractional, not a number, or missing for worker-tokens.',
    next: 'Retry with `--tokens <n>` set to the non-negative integer the host reported, or omit it for worker-model.',
  },
  'worker-model-perspective-invalid': {
    cause: 'The perspective is not a reviewer perspective, or it was given with a non-reviewer role.',
    // 열거를 하드코딩하면 REVIEW_PERSPECTIVE(review-policy 정본)와 어긋난다 — 상수에서 만든다.
    next: `Retry with a reviewer perspective (${REVIEW_PERSPECTIVE.join(', ')}), `
      + 'or drop `--perspective` for the debugger.',
  },
  'summary-required': {
    cause: 'Report requires a non-empty summary.',
    next: 'Retry `bouncer coordinate report` with a summary of the worker outcome.',
  },
  'task-outside-blueprint': {
    cause: 'The task id is not a commit task on this blueprint ledger.',
    next: 'Run `bouncer coordinate status` and use a task id listed on this blueprint.',
  },
  'task-required': {
    cause: 'This command requires a three-digit task id.',
    next: 'Retry the same `bouncer coordinate` command with `--task NNN`.',
  },
  'terminal-failure-required': {
    cause: 'Repair requires a stored terminal verification failure.',
    next: 'Run `bouncer coordinate status` and issue `bouncer coordinate repair` only '
      + 'after a terminal verification failure.',
  },
  'unassigned-integration-worktree': {
    cause: 'The integration path exists but is not a git worktree registered for this drive.',
    next: 'Remove or replace the stray path, then retry `bouncer coordinate bootstrap`.',
  },
  'unassigned-worker-worktree': {
    cause: 'The worker path is not the git worktree assigned to this task.',
    next: 'Do not seed into that path; run `bouncer coordinate prepare` from the '
      + 'integration worktree so it can assign workers.',
  },
  'unknown-coordinate-command': {
    cause: 'The coordinate command is not a supported subcommand.',
    next: 'Run `bouncer coordinate status` or a documented subcommand from `bouncer help`.',
  },
  'verification-failed': {
    cause: 'The verification task command failed on the integration worktree.',
    next: 'Inspect the verification payload, then `bouncer coordinate repair` or report the failure to the user.',
  },
  'wave-verification-failed': {
    cause: 'Wave verification failed after fan-in applied the recorded commits.',
    next: 'Call `bouncer coordinate revoke` or `bouncer coordinate repair` from the '
      + 'failure evidence, then retry integrate.',
  },
  'worker-salvage-failed': {
    cause: 'Preserving the revoked worker changes (patch or refs/bouncer/salvage ref) failed, so nothing was removed.',
    next: 'Check the reported salvage patch and ref manually and report; the worker is left as it was.',
  },
  'worker-evidence-not-terminal': {
    cause: 'Worker verification or review evidence files are still open, so fan-in is refused.',
    next: 'Close those evidence files on the worker, then retry `bouncer coordinate integrate`.',
  },
  'worker-evidence-sha-mismatch': {
    cause: 'The commit_sha stamp in the worker tasks.md differs from the SHA recorded in the ledger '
      + '(recorded before the commit, or the worker was recommitted after recording).',
    next: 'Confirm the commit and stamp on the worker, then call `bouncer coordinate rerecord`; '
      + 'if the worker has no commit, call `bouncer coordinate revoke` and `prepare` again. '
      + 'In light mode, report and stop.',
  },
  'worker-commit-missing': {
    cause: 'The worker HEAD is the integration head or one of its ancestors, so no task commit exists yet.',
    next: 'Run `bouncer coordinate advance` to create the task commit, then rerun report/record.',
  },
  'worker-commit-stamp-mismatch': {
    cause: 'The commit_sha stamp in the worker tasks.md is missing or differs from the first 8 chars of HEAD.',
    next: 'Run `bouncer coordinate advance` to create the task commit, then rerun report/record.',
  },
  'worker-scope-dirty': {
    cause: 'The worker has uncommitted changes inside the approved scope (dirty_paths).',
    next: 'Run `bouncer coordinate advance` to create the task commit, then rerun report/record.',
  },
};

/**
 * coordinate 본문이 돌려준 실패 객체에 cause/next를 붙인다.
 * 개별 return 지점을 고치지 않기 위해 공개 경계에서만 병합한다.
 *
 * @param {unknown} result - coordinate 본문 반환값
 * @returns {unknown} 실패면 cause·next가 붙은 사본, 아니면 원본
 */
function withCoordinateFailureHints(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result;
  const body = result as { ok?: boolean; reason?: unknown };
  if (body.ok === false && typeof body.reason === 'string') {
    const hint = COORDINATE_FAILURE_HINTS[body.reason] || {
      cause: body.reason,
      next: FALLBACK_COORDINATE_NEXT,
    };
    return { ...body, cause: hint.cause, next: hint.next };
  }
  return result;
}

/**
 * 공개 coordinate 진입점. 본문 실패에 힌트를 붙인 뒤에만 호출자에게 돌려준다.
 *
 * @param {Parameters<typeof coordinate>[0]} opts - `coordinate`와 동일한 인자 객체
 * @returns {ReturnType<typeof withCoordinateFailureHints>} 힌트가 병합된 coordinate 결과
 */
function coordinateWithHints(opts: Parameters<typeof coordinate>[0]) {
  return withCoordinateFailureHints(coordinate(opts));
}

export = { coordinate: coordinateWithHints, COORDINATE_FAILURE_HINTS, withCoordinateFailureHints };
