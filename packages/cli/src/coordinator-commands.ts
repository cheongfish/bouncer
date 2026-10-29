'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
import runtime = require('./runtime-state');
import compositeGates = require('./composite-gates');
const {
  coordinatorPathsFor, runtimePaths,
} = runtime;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import validateSections = require('./validate-sections');
const { parseSections } = validateSections;
import executionDag = require('./execution-dag');
const { transition } = executionDag;
import configMod = require('./config');
const { readWavesPerSession } = configMod;
import scopeMod = require('./scope');
const { withLedgerLock, makeAllowed, isRuntimeArtifact, doNotTouchForTask, normalizeScopeEntry } = scopeMod;
import pathOverlapMod = require('./path-overlap');
const { pathsOverlap, normalizeOverlapPath } = pathOverlapMod;
import leaseMod = require('./lease');
import reviewPolicy = require('./review-policy');
// worker-model 기록의 관점 소속 검사와 `next` 문구가 validate-sections와 같은 정본을 쓴다.
const { REVIEW_PERSPECTIVE } = reviewPolicy;
import type {
  ReportOutcome, PromoteStopReason, PromotionRecord, Task,
  FailureEvidence, Exec, VerificationRunner, Ledger,
} from './execution-contracts';
import type {
  CoordinateArgs, CoordinateResult, CoordinateCtx, LockedCtx, TaskCtx,
} from './coordinator-command-contracts';
import coordinatorLedger = require('./coordinator-ledger');
import coordinatorGit = require('./coordinator-git');
import coordinatorVerification = require('./coordinator-verification');
import driveMetrics = require('./drive-metrics');
const { revokeLease, checkLease } = leaseMod;
const { randomUUID } = require('node:crypto');

// 경로 상수와 원장 I/O는 한 모듈에서 공유해 fence와 저장 동작이 갈라지지 않게 한다.
const {
  atomicWrite, loadLedgerBytes, loadLedger, ledgerBytesHash, writeOwnedLedger,
  projectCheckpoint, assertLeaseShape, readyWaveGated, maxParallelForRead,
  withCheckpoint, openLedgerFenced, recheckLedgerCheckpoint,
  ledgerModeOf,
} = coordinatorLedger;
import coordinatorRepair = require('./coordinator-repair');
import coordinatorWorker = require('./coordinator-worker');
import coordinatorFanin = require('./coordinator-fanin');
const { integrateCommitWave, lightWorkerAssigned, rejectLeaseMismatch, scopedTestReportFailure } = coordinatorFanin;
const {
  reportPathFor, taskBriefHashOf, readBouncerBlock, workerCommitEvidence,
  ensureIntegrationCwd, currentScopePaths, intentIdFor, verificationPolicyAt,
  expectedTaskRef, untraileredWorkerCommits,
} = coordinatorWorker;
const {
  git, initialWorktreeState, directParent, registeredWorker, registeredIntegration,
} = coordinatorGit;
const {
  prepareVerificationDependencies, selectVerificationRunner, runTargetVerification,
} = coordinatorVerification;
import coordinatorPrepare = require('./coordinator-prepare');
const {
  worktreeDiffSha, prepareCoordinator,
  coordinateBootstrap, salvageRevokedWorker,
} = coordinatorPrepare;

/**
 * status/bootstrap을 제외한 원장 쓰기 명령. path/hash 쌍이 없거나 어긋나면
 * Git·파일 mutation보다 먼저 거절해야 stale checkpoint로 상태가 갈라지지 않는다.
 */
const LEDGER_FENCED_COMMANDS = new Set([
  'prepare', 'dispatch', 'report', 'record', 'rerecord', 'critical-recovery',
  'repair', 'integrate', 'partial-close', 'revoke', 'promote-stop', 'session-open', 'worker-model', 'worker-tokens',
  'reverify', 'note', 'uncommit',
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
// unreported는 호스트가 토큰을 주지 않았다는 명시 기록이다. 값을 0이나 추정치로 채우지 않으려고
// tokens 키 자체를 쓰지 않는다. metrics는 이를 "답이 왔다"가 아니라 "빠졌다"로 세야 한다.
type WorkerTokensDecision = {
  kind: 'worker-tokens'; role: WorkerRecordRole; tokens?: number; unreported?: true;
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
  // full 모드 accepted 보고에서 ledger scope 밖이지만 금지선 밖이라 허용한 커밋 경로와 worker가 적은 이유(경로 사전순).
  unexpected_paths?: Array<{ path: string; reason: string }>;
  // 그 경로가 같은 drive의 미통합 다른 task scope와 겹칠 때 그 task id(사전순). 이탈 경로가 없으면 두 키가 없다.
  overlaps?: string[];
};
type StaleReportDecision = {
  task: string; kind: 'stale-report';
  expected: { attempt: number; task_brief_hash: string };
  received: { attempt: number; task_brief_hash: string };
};
type RerecordDecision = {
  task: string; kind: 'rerecord'; reason: string; previousSha: string;
  nextSha: string; integrationHead: string;
};
// worker가 트레일러 없이 만든 커밋을 soft reset으로 되돌린 기록이다. `isException`이 예외 판단으로 센다.
type UncommitDecision = {
  task: string; kind: 'uncommit'; attempt: number; fromHead: string; toHead: string; commits: string[];
};
// root가 coordinator 세션을 열기 직전 `coordinate session-open`이 남기는 경계 표지다.
// `coordinate next`가 이 표지 뒤의 `fanin` 수로 세션 wave 수를 센다. 예외가 아니다.
type SessionDecision = {
  kind: 'session'; opened_at: string; integration_head: string; waves_cap: number;
};
// `coordinate note`가 남기는 자유 형식 인계 메모다. 다음 coordinator 세션이 같은 조사를 반복하지 않도록
// checkpoint `notes`로 돌려준다. 예외·wave 계산에는 쓰이지 않는다.
type NoteDecision = { kind: 'note'; text: string; written_at: string; task?: string };
/** note 본문 길이 상한(trim 뒤). checkpoint가 매번 싣는 값이라 무한정 키우지 않는다. */
const NOTE_TEXT_MAX = 2000;
// review-handoff 본문 형식 판정. 형식 정본은 skills/bouncer-run/references/direct-run.md의 Handoff 절이다.
// 이 판정은 문서 형식을 코드로 옮긴 것이므로 정본을 바꾸면 여기도 같이 바꾼다.
const REVIEW_HANDOFF_PREFIX = 'review-handoff:';
// 전체 형식: 필드 순서와 `; ` 구분자는 고정이고 뒤에 다른 글자가 붙으면 안 된다(`$` 고정).
// base·head 길이 일치와 길이 값은 아래 함수에서 따로 본다(정규식 하나로 묶으면 원인이 흐려진다).
// 한 줄 120자 제한 때문에 두 조각으로 나눠 잇는다. 조각 경계는 공백이 아니라 `; ` 뒤다.
const REVIEW_HANDOFF_SHAPE_RE = new RegExp([
  '^review-handoff: mode=(discovery|delta); base=([0-9a-f]+); head=([0-9a-f]+); ',
  'snapshot_id=([0-9a-f]{64}); perspectives=([^;]*); files=(.*)$',
].join(''));
// 대체 형식. 요약은 1~200 UTF-16 단위이고 `.`이 줄바꿈을 막아 한 줄만 허용한다.
// 생산자 문구(direct-run.md)는 빈 요약과 줄바꿈을 허용하지만 여기서는 거절한다.
// 이 차이는 의도다: 거절된 본문은 인계를 멈추고 보고하게 되므로 손상된 증거가 기록되지 않는다.
const REVIEW_HANDOFF_UNAVAILABLE_RE = /^review-handoff: unavailable \((.{1,200})\); run discovery$/;
// 40자는 SHA-1, 64자는 SHA-256 저장소 해시다. 한 저장소는 한 형식만 쓰므로 base·head가 같은 길이여야 한다.
const GIT_HASH_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
// 파일 항목은 print 디렉터리의 review-handoff 원시 파일 하나와 그 sha256이다. 경로가 이 패턴이 아니면
// `../`나 다른 디렉터리를 가리킬 수 있으므로 거절한다.
const REVIEW_HANDOFF_FILE_RE =
  /^\.bouncer\/runtime\/print\/review-handoff-(discovery|delta)-([a-z_]+)\.md@([0-9a-f]{64})$/;

/**
 * note 본문이 review-handoff 형식이면 정본 형식과 맞는지 판정한다. 파일 시스템은 읽지 않는다
 * (`files=` 존재·sha256 확인은 coordinator 문서 규칙에 남긴다).
 *
 * 본문이 `review-handoff:`로 시작하지 않으면 일반 메모이므로 항상 통과한다. 시작하면 두 형식 중
 * 하나일 때만 통과한다: (1) handoff 형식 — mode·base·head·snapshot_id·perspectives·files 순서와
 * 구분자가 맞고, perspective는 REVIEW_PERSPECTIVE의 중복 없는 값이며, 파일 항목은 같은 mode의
 * print 원시 파일이고 perspective 집합이 `perspectives`와 정확히 같다. (2) unavailable 형식 —
 * 한 줄 요약 1~200자.
 *
 * @param {string} body - trim한 note 본문
 * @returns {boolean} 일반 메모이거나 두 형식 중 하나면 true, `review-handoff:`로 시작하는데 어느 형식도 아니면 false
 */
function isReviewHandoffShape(body: string): boolean {
  if (!body.startsWith(REVIEW_HANDOFF_PREFIX)) return true;
  if (REVIEW_HANDOFF_UNAVAILABLE_RE.test(body)) return true;
  const shape = REVIEW_HANDOFF_SHAPE_RE.exec(body);
  if (!shape) return false;
  const [, mode, base, head, , perspectivesText, filesText] = shape;
  if (!GIT_HASH_RE.test(base) || !GIT_HASH_RE.test(head) || base.length !== head.length) return false;
  // perspective 목록은 정본(review-policy)을 그대로 쓴다. 사본을 두면 리뷰 라운드 이름과 어긋난다.
  const perspectives = perspectivesText.split(',');
  if (perspectives.some((p) => !REVIEW_PERSPECTIVE.includes(p))) return false;
  if (new Set(perspectives).size !== perspectives.length) return false;
  // 파일 수가 perspective 수와 같고 파일의 perspective가 모두 목록 안이며 서로 다르면, 두 집합은 같다.
  // 이 조합으로 "perspective에 파일 없음"과 "파일이 목록에 없음"을 한 번에 거른다.
  const files = filesText.split(',');
  if (files.length !== perspectives.length) return false;
  const filePerspectives = new Set<string>();
  for (const entry of files) {
    const file = REVIEW_HANDOFF_FILE_RE.exec(entry);
    if (!file || file[1] !== mode) return false;
    if (!perspectives.includes(file[2]) || filePerspectives.has(file[2])) return false;
    filePerspectives.add(file[2]);
  }
  return true;
}
type ParsedReportFile = {
  revision: { attempt: number; task_brief_hash: string } | null;
  open_choices: string[] | null;
  known_weaknesses: string[] | null;
  // `## Unexpected paths` 절의 `- \`path\` — reason` 줄. 절이 없으면 빈 배열이다.
  unexpected: Array<{ path: string; reason: string }>;
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
    { key: 'unexpected', re: /^##\s+Unexpected paths\s*$/i },
    // 다른 ## 제목은 앞 섹션의 끝을 알리는 경계 구실만 한다.
    {
      key: 'other',
      re: /^##\s+(?!Brief revision\s*$|Open choices\s*$|Known weaknesses\s*$|Unexpected paths\s*$)\S/i,
    },
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
  // reason은 worker가 쓴 데이터로 저장만 한다. 판정·명령에 쓰지 않으므로 형식만 거른다.
  const unexpected: ParsedReportFile['unexpected'] = [];
  for (const line of (sections.unexpected || '').split('\n')) {
    const match = /^- `([^`]+)` — (.+)$/.exec(line.trim());
    if (match) unexpected.push({ path: normalizeOverlapPath(match[1]), reason: match[2] });
  }
  return { revision, open_choices: items(sections.open), known_weaknesses: items(sections.weak), unexpected };
}

/**
 * 보고 파일 검사 결과.
 * `ok:false`는 원장을 쓰지 않는 거절이고, `ok:true`는 stale 비교로 넘어갈 값이다.
 */
type ReportFileCheck =
  | { ok: false; failure: Record<string, unknown> }
  | {
    ok: true; open_choices: string[]; known_weaknesses: string[];
    unexpected: Array<{ path: string; reason: string }>;
  };

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
    unexpected: parsed.unexpected,
  };
}

/** 이탈 경로 이유 길이 상한(trim 뒤). 원장 결정에 그대로 저장되므로 키우지 않는다. */
const UNEXPECTED_REASON_MAX = 200;

/**
 * accepted report 시점에 worker 커밋의 scope 밖 경로를 골라 금지선을 확인하고 이유를 모은다.
 * 후보는 dispatch가 남긴 `base_head`부터 worker HEAD까지의 변경 경로이고, rename은 옛 경로까지
 * 후보로 잡아(`--no-renames`) scope 밖 파일을 scope 안으로 옮겨 숨길 수 없다. 금지선은 integration
 * 사본에서만 읽으며(worker 사본은 출처가 아니다) 후보가 있을 때만 읽는다. 읽기만 하고 원장은 쓰지 않는다.
 *
 * 판정 순서: 금지선 읽기 실패 → 금지선 겹침 → 이유 누락 → 기록(+overlaps). hook을 우회한 커밋도
 * 여기서 한 번 더 막는다.
 *
 * @param {object} opts - 판정 입력
 * @param {Exec} opts.exec - git 실행기
 * @param {Ledger} opts.ledger - 열린 원장(다른 task scope 비교용)
 * @param {Task} opts.item - 보고하는 task(workerPath·dispatch·scope 출처)
 * @param {string} opts.blueprint - blueprint 상대 경로
 * @param {string} opts.integrationPath - 금지선을 읽을 integration checkout
 * @param {Array<{path: string, reason: string}>} opts.reasons - 보고 파일의 Unexpected paths 줄
 * @returns {{ ok: false, failure: object } | { ok: true, unexpected_paths?: object[], overlaps?: string[] }}
 *   거절 본문, 또는 저장할 값(이탈 경로가 없으면 두 키가 없다)
 */
function checkUnexpectedPaths(opts: {
  exec: Exec; ledger: Ledger; item: Task; blueprint: string; integrationPath: string;
  reasons: Array<{ path: string; reason: string }>;
}): { ok: false; failure: Record<string, unknown> }
  | { ok: true; unexpected_paths?: Array<{ path: string; reason: string }>; overlaps?: string[] } {
  const { exec, ledger, item, blueprint, integrationPath, reasons } = opts;
  const base = item.dispatch && item.dispatch.base_head;
  if (!base || !item.workerPath) return { ok: true };
  const diff = String(exec('git', ['diff', '--name-only', '-z', '--no-renames', `${base}..HEAD`], {
    cwd: item.workerPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const scope = coordinatorWorker.currentScopePaths(item);
  const allowed = makeAllowed({ affectedPaths: scope, blueprintDir: blueprint });
  const outside = [...new Set(diff.split('\0').filter(Boolean).map(normalizeOverlapPath))]
    .filter((file) => !isRuntimeArtifact(file) && !allowed(file))
    .sort();
  if (outside.length === 0) return { ok: true };
  const locked = doNotTouchForTask(integrationPath, blueprint, item.id, ledger.tasks);
  // 금지선을 못 읽으면 허용으로 풀지 않는다(fail closed).
  if (!locked.ok) {
    return { ok: false, failure: { ok: false, reason: 'scope-do-not-touch-unreadable', paths: outside } };
  }
  const hit = outside.filter((file) => locked.paths.some(
    (token) => pathsOverlap(normalizeScopeEntry(token), normalizeScopeEntry(file)),
  ));
  if (hit.length > 0) {
    return { ok: false, failure: { ok: false, reason: 'scope-do-not-touch-violation', paths: hit } };
  }
  const stored: Array<{ path: string; reason: string }> = [];
  const missing: string[] = [];
  for (const file of outside) {
    const line = reasons.find((entry) => entry.path === file);
    const reason = line ? line.reason.trim() : '';
    if (reason === '' || reason.length > UNEXPECTED_REASON_MAX) missing.push(file);
    else stored.push({ path: file, reason });
  }
  if (missing.length > 0) {
    return { ok: false, failure: { ok: false, reason: 'unexpected-path-reason-missing', paths: missing } };
  }
  // 같은 drive의 미통합 다른 task scope와 겹치면 병렬 충돌 후보다. 막지 않고 기록으로만 남긴다.
  const overlaps = ledger.tasks
    .filter((other) => other.id !== item.id && (other.status || 'pending') !== 'integrated')
    .filter((other) => coordinatorWorker.currentScopePaths(other).some((entry) => outside.some(
      (file) => pathsOverlap(normalizeOverlapPath(entry), file),
    )))
    .map((other) => other.id)
    .sort();
  return { ok: true, unexpected_paths: stored, ...(overlaps.length > 0 ? { overlaps } : {}) };
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
 * @param {boolean} [opts.reverify] - true이면 `terminalFailure`가 기록된 verifying terminal을 같은
 *   HEAD에서 다시 돌리는 reverify 모드다. 조건을 어기면 상태를 바꾸지 않고 거절하고, 실패해도
 *   wave 한도 전이를 하지 않으며, 통과하면 `awaiting_confirmation`을 `active`로 되돌린다
 * @returns {unknown} 성공 시 ok:true와 task·verification. 실패 시 ok:false와 reason
 */
function integrateVerificationTask({
  // repoRoot는 공개 시그니처 호환용 — 검증 cwd는 integration.integrationPath만 쓴다.
  blueprint, task, leaseId, generation,
  ledgerPath, ledgerHash, exec, writeLedger, deps, integration, reverify = false,
}: {
  repoRoot: string; blueprint: string; task: string;
  leaseId?: string; generation?: number; reverify?: boolean;
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
    if (reverify) {
      // 재실행 조건을 전부 통과한 경우에만 아래 잠금 밖 단계로 넘어간다. 이 단계는 원장·문서를
      // 쓰지 않으므로 거절은 항상 상태 불변이다.
      const rejected = reverifyRejection({
        ledger, item, task, blueprint, exec, integrationPath: integration.integrationPath,
      });
      if (rejected) return rejected;
      phase1CheckpointHash = ledgerBytesHash(fs.readFileSync(integration.ledgerFile));
      return { ok: true as const, mode: 'verification' as const, ledger };
    }
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
      // reverify는 wave를 쓰지 않으므로 한도 상태 전이(awaiting_confirmation)를 건드리지 않는다.
      // 이미 awaiting_confirmation이면 그대로 두어 사용자 확인 대기가 풀리지 않게 한다.
      const exhausted = !reverify && (ledger.repairWaves || []).length >= 2;
      if (exhausted) {
        ledger.status = 'awaiting_confirmation';
      }
      if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
      writeLedger(integration.ledgerFile, ledger);
      if (reverify) {
        return { ok: false, reason: 'verification-failed', command: 'reverify', task: item,
          verification: result, repairWaves: (ledger.repairWaves || []).length, stopped: false };
      }
      return { ok: false, reason: 'verification-failed', task: item, verification: result,
        repairWaves: (ledger.repairWaves || []).length, stopped: exhausted };
    }
    item.status = transition('verifying', 'integrated', 'verification');
    if (typeof result.evidenceId === 'string' && result.evidenceId !== '') {
      item.verify_evidence_id = result.evidenceId;
    }
    writeVerificationTaskStatus(integration.integrationPath, blueprint, task, 'integrated');
    // wave 한도로 멈췄던 drive도 환경 수정으로 통과하면 다시 진행할 수 있어야 한다.
    const restored = reverify && ledger.status === 'awaiting_confirmation';
    if (restored) ledger.status = 'active';
    if (!owns()) return { ok: false, reason: 'ledger-lock-lost' };
    writeLedger(integration.ledgerFile, ledger);
    void verificationRetry;
    void leaseId;
    void generation;
    void exec;
    return withCheckpoint({ ok: true as const, command: reverify ? 'reverify' : 'integrate', task: item,
      verification: result,
      ready: readyWaveGated(ledger.tasks, {
        maxParallel: maxParallelForRead(integration.integrationPath),
      }), decisions: ledger.decisions, ...(restored ? { status_restored: 'active' as const } : {}) },
    ledger, integration.ledgerFile);
  });
}

/**
 * reverify 거절 조건을 순서대로 검사한다. 읽기 전용이라 거절해도 원장·문서·작업 트리가 그대로다.
 *
 * @param {object} opts - 검사 입력
 * @param {Ledger} opts.ledger - fence를 통과한 원장
 * @param {Task} opts.item - 대상 task 항목
 * @param {string} opts.task - task id
 * @param {string} opts.blueprint - blueprint 상대 경로(허용 증적 문서 경로 계산용)
 * @param {Exec} opts.exec - git 실행기
 * @param {string} opts.integrationPath - integration checkout
 * @returns {{ ok: false; reason: string } | null} 거절 응답, 통과하면 null
 */
function reverifyRejection({
  ledger, item, task, blueprint, exec, integrationPath,
}: {
  ledger: Ledger; item: Task; task: string; blueprint: string;
  exec: Exec; integrationPath: string;
}): { ok: false; reason: string } | null {
  const failure = ledger.terminalFailure;
  if (item.execution_kind !== 'verification' || (item.status || 'pending') !== 'verifying'
    || !failure || failure.task !== task) {
    return { ok: false, reason: 'terminal-failure-required' };
  }
  // 실패가 기록된 바로 그 소스에서만 재실행한다. HEAD가 움직였으면 환경 문제가 아니라 코드
  // 변경이므로 repair 경로로 보낸다(coordinator-repair의 source_digest 대조와 같은 기준).
  const digest = failure.source_digest;
  if (typeof digest !== 'string' || digest === ''
    || ledger.integrationHead !== digest || git(exec, integrationPath, ['rev-parse', 'HEAD']) !== digest) {
    return { ok: false, reason: 'reverify-source-moved' };
  }
  // 허용 목록은 coordinator-fanin의 disallowedDirtyPaths와 같은 규칙을 따른다(그 함수는 비공개라
  // 여기서 미러링한다): 원장 seedManifest 경로(bootstrap이 seed한 계획 문서; 추적 파일이면 수정으로,
  // 아니면 미추적으로 보인다) + 통합된 task의 증적 문서 + 이번 terminal이 스스로 쓰는 증적 문서.
  const base = blueprint.replaceAll('\\', '/');
  const allowed = new Set<string>((ledger.seedManifest || []).map((entry) => entry.path));
  allowed.add(`${base}/tasks/${task}/tasks.md`);
  allowed.add(`${base}/tasks/${task}/verification.md`);
  allowed.add(`${base}/verification.md`);
  const reviewMode = coordinatorWorker.isBlueprintReviewModeAt(integrationPath, blueprint);
  for (const other of ledger.tasks) {
    if (other.status !== 'integrated' && other.dynamic !== true) continue;
    for (const [name] of coordinatorWorker.evidenceFiles(reviewMode)) {
      allowed.add(`${base}/tasks/${other.id}/${name}`);
    }
  }
  const porcelain = String(exec('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    cwd: integrationPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  const dirty: string[] = [];
  // -z는 경로를 C-quote하지 않고 NUL로 끝맺으므로 비ASCII·따옴표 경로도 허용 목록과 원문 비교된다.
  const tokens = porcelain.split('\0');
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
      // worktree 등록·CLI 런타임 파일은 source가 아니다(fanin과 같은 제외).
      if (entry.startsWith('.worktrees/') || entry.startsWith('.bouncer/runtime/')
        || entry === '.bouncer/config.json') continue;
      if (!allowed.has(entry)) dirty.push(entry);
    }
  }
  if (dirty.length > 0) return { ok: false, reason: 'reverify-worktree-dirty' };
  return null;
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
 * `reverify`: 환경만 고치면 통과할 terminal 검증 실패를 repair wave 없이 같은 HEAD에서 다시 돌린다.
 * 조건 검사와 2단계 실행은 `integrateVerificationTask`의 reverify 모드가 맡는다.
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 통과·실패·거절 결과
 */
function coordinateReverify(ctx: CoordinateCtx): CoordinateResult {
  const { repoRoot, blueprint, task, ledgerPath, ledgerHash } = ctx.args;
  const { cwd, exec, writeLedger, deps, integration } = ctx;
  if (task === undefined || !/^\d{3}$/.test(task)) return { ok: false, reason: 'task-required' };
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  // integrate와 같이 승격이 멈춘 drive에서는 검증을 시작하지 않는다.
  if (loadLedger(integration.ledgerFile)?.status === 'promotion_stopped') {
    return { ok: false, reason: 'promotion-stopped' };
  }
  return integrateVerificationTask({
    repoRoot, blueprint, task, ledgerPath, ledgerHash, exec, writeLedger, deps, integration, reverify: true,
  }) as CoordinateResult;
}

/**
 * `prepare`: seed(npm ci)가 LOCK_STALE_MS를 넘길 수 있어 공통 fenced 잠금 앞에서 처리하고,
 * 잠금은 `prepareCoordinator`가 내부에서 잡는다.
 *
 * @param {CoordinateCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} `prepareCoordinator` 결과
 */
function coordinatePrepare(ctx: CoordinateCtx): CoordinateResult {
  const { repoRoot, blueprint, ledgerPath, ledgerHash, acceptBrokenBaseline } = ctx.args;
  const { cwd, exec, writeLedger, makeLeaseId, integration } = ctx;
  return prepareCoordinator({
    repoRoot, blueprint, cwd, ledgerPath, ledgerHash, exec, writeLedger, makeLeaseId, integration,
    acceptBrokenBaseline: acceptBrokenBaseline === true,
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
 * `note`: 다음 세션에 넘길 판단 메모를 원장 decisions 끝에 덧붙인다. task의 decisions·dispatch·lease·
 * status는 건드리지 않고(원장 전역 기록만), 검증을 모두 통과한 뒤에만 commitWrite()를 부른다.
 *
 * @param {LockedCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 */
function coordinateNote(ctx: LockedCtx): CoordinateResult {
  const { cwd, integration, ledger, commitWrite } = ctx;
  const { command, repoRoot, blueprint, task, text } = ctx.args;
  ensureIntegrationCwd(repoRoot, blueprint, cwd);
  // light 원장은 세션 경계가 없어 인계 대상이 아니다. 거절 reason은 session-open과 같다.
  if (ledgerModeOf(ledger) !== 'full') return { ok: false, reason: 'ledger-mode-mismatch' };
  if (ledger.status !== undefined && ledger.status !== 'active') {
    return { ok: false, reason: 'ledger-not-active' };
  }
  // 값 없는 플래그(true)나 비문자열은 빈 값과 같이 취급한다. 길이는 trim 뒤 기준이라 공백 패딩이 상한을 깎지 않는다.
  const body = typeof text === 'string' ? text.trim() : '';
  if (body === '') return { ok: false, reason: 'note-text-required' };
  if (body.length > NOTE_TEXT_MAX) return { ok: false, reason: 'note-too-long' };
  // 형식이 틀린 review-handoff는 다음 coordinator가 증거로 읽으므로 원장에 남기기 전에 막는다.
  // 거절은 commitWrite() 전이라 원장 bytes가 그대로다. 길이 검사 뒤에 두어 긴 본문은 항상 note-too-long이다.
  if (!isReviewHandoffShape(body)) return { ok: false, reason: 'note-review-handoff-invalid' };
  if (task !== undefined && !ledger.tasks.some((x) => x.id === task)) {
    return { ok: false, reason: 'task-outside-blueprint' };
  }
  const note: NoteDecision = {
    kind: 'note', text: body, written_at: new Date().toISOString(), ...(task !== undefined ? { task } : {}),
  };
  ledger.decisions.push(note);
  { const lost = commitWrite(); if (lost) return lost; }
  return withCheckpoint({
    ok: true as const, command, decision: note,
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
  // `unreported`는 worker-tokens 전용 값이다. worker-model에 오면 숫자 검사로 떨어져 tokens-invalid가 된다.
  // 대소문자를 바꾸지 않고 정확히 일치할 때만 받는다. 호스트 표기 흔들림을 조용히 수용하지 않으려는 것이다.
  const unreported = command === 'worker-tokens' && tokens === 'unreported';
  const parsedTokens = tokens === undefined || unreported ? null : parseWorkerTokens(tokens);
  if ((tokens !== undefined || command === 'worker-tokens') && !unreported && parsedTokens === null) {
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
    // unreported는 tokens 키를 쓰지 않는다. 숫자 기록과 모양이 섞이면 합산이 0을 답으로 오해한다.
    : unreported
      ? { kind: 'worker-tokens', role: recordRole, unreported: true, ...scope }
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
  // 보고 디렉터리는 원장을 쓰기 전에 만든다. 새 worker worktree에는 reports 디렉터리가 없어서
  // implementer가 보고 파일을 쓰지 못한 사례가 있었다. 만들 수 없으면 attempt를 열지 않는다.
  // 이 지점 전에는 item과 원장을 건드리지 않아 거절 시 원장 bytes가 그대로 남는다.
  const report_path = reportPathFor(item.workerPath as string, task, nextAttempt);
  try {
    fs.mkdirSync(path.dirname(report_path), { recursive: true });
  } catch (_error) {
    return { ok: false, reason: 'dispatch-report-dir-failed' };
  }
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
  let fileItems: {
    open_choices: string[]; known_weaknesses: string[]; unexpected: Array<{ path: string; reason: string }>;
  } | null = null;
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
  // full 모드 accepted 커밋 task의 scope 밖 경로: 금지선은 막고 나머지는 이유와 함께 기록한다.
  // 거절은 위쪽 검사와 같이 원장을 쓰기 전에 끝난다.
  let unexpectedRecord: { unexpected_paths?: Array<{ path: string; reason: string }>; overlaps?: string[] } = {};
  if (fileItems && outcome === 'accepted' && (item.execution_kind || 'commit') !== 'verification') {
    const checked = checkUnexpectedPaths({
      exec, ledger, item, blueprint, integrationPath: integration.integrationPath, reasons: fileItems.unexpected,
    });
    if (!checked.ok) return checked.failure;
    unexpectedRecord = checked;
  }
  // full·scoped_terminal·commit task의 accepted 보고는 지정 verify 명령과 통과 결과가 Tests에 있어야 받는다.
  // fan-in(worker-test-report-mismatch)에서야 걸리면 worker가 이미 끝난 뒤라 되돌리기 비싸므로, 같은
  // 판정(scopedTestReportFailure)을 보고 시점에 한 task로 앞당긴다. 휴리스틱을 복제하지 않아 두 입구가
  // 갈라지지 않고, 거절은 원장을 쓰기 전에 끝난다. light·verification·legacy 정책·accepted 아닌
  // outcome은 지금처럼 건너뛴다(light는 inline 보고라 보고 파일이 없을 수 있다).
  if (fileItems && outcome === 'accepted' && (item.execution_kind || 'commit') !== 'verification'
    && verificationPolicyAt(integration.integrationPath, blueprint) === 'scoped_terminal') {
    const mismatch = scopedTestReportFailure({
      integrationPath: integration.integrationPath, blueprint, items: [item], light: false,
    });
    if (mismatch) {
      return {
        ok: false, reason: 'report-tests-invalid',
        problem: mismatch.problem, expected_command: mismatch.expected_command,
      };
    }
  }
  item.dispatch.status = 'reported';
  item.dispatch.outcome = outcome as ReportOutcome;
  item.dispatch.summary = summary;
  const reportDecision: ReportDecision = {
    task, kind: 'report', attempt: attempt as number, task_brief_hash: taskBriefHash,
    outcome: outcome as ReportOutcome, summary,
    ...(fileItems
      ? { open_choices: fileItems.open_choices, known_weaknesses: fileItems.known_weaknesses } : {}),
    ...(unexpectedRecord.unexpected_paths ? { unexpected_paths: unexpectedRecord.unexpected_paths } : {}),
    ...(unexpectedRecord.overlaps ? { overlaps: unexpectedRecord.overlaps } : {}),
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
 * `uncommit`: `bouncer commit`이 stamp를 못 쓰게 만든 무트레일러 worker 커밋을 soft reset으로 되돌린다.
 * 변경은 index에 staged로 남아 다음 `commit`이 트레일러 커밋으로 다시 만든다. 사전 조건 거절은 Git과
 * 원장을 바꾸기 전에 끝나고, reset 뒤 실패(lock 상실·원장 쓰기 throw)는 `fromHead` 복원 하나로만 되돌린다.
 *
 * @param {TaskCtx} ctx - 공통 준비가 끝난 handler 문맥
 * @returns {CoordinateResult} 명령 결과. 거절은 `ok: false`와 reason
 * @throws 원장 쓰기가 throw하면 HEAD를 복원한 뒤 같은 오류를 다시 던진다
 */
function coordinateUncommit(ctx: TaskCtx): CoordinateResult {
  const { task, cwd, exec, integration, ledger, commitWrite, item } = ctx;
  const { command, blueprint } = ctx.args;
  // 1. 거절은 모두 mutation 전에 끝낸다. stamp된 커밋은 이미 정상 commit 산출물이라 reset 대상이 아니다.
  if (item.dispatch?.status !== 'active') return { ok: false, reason: 'illegal-transition' };
  const tasksBlock = readBouncerBlock(path.join(cwd, blueprint, 'tasks', task, 'tasks.md'));
  const stamped = tasksBlock ? tasksBlock.commit_sha : undefined;
  if (stamped !== undefined && stamped !== null && stamped !== '') {
    return { ok: false, reason: 'illegal-transition' };
  }
  // next와 같은 판별 함수를 써서 "blocked로 안내한 커밋"과 "되돌릴 커밋"이 갈라지지 않게 한다.
  const commits = untraileredWorkerCommits(exec, cwd, ledger, expectedTaskRef(tasksBlock));
  if (commits.length === 0) return { ok: false, reason: 'uncommit-not-needed' };

  // 2. 가장 오래된 무트레일러 커밋의 first parent까지 되돌리면 그 위에 쌓인 커밋도 함께 staged가 된다.
  const toHead = git(exec, cwd, ['rev-parse', `${commits[0]}^1`]);
  const fromHead = git(exec, cwd, ['rev-parse', 'HEAD']);
  git(exec, cwd, ['reset', '--soft', toHead]);

  // 3. reset 뒤 실패는 원장이 기록되지 않았으므로 HEAD를 fromHead로 되돌려 Git과 원장을 맞춘다.
  // 복원 reset마저 실패하면 HEAD가 toHead에 남는다는 사실을 reason으로 알려 사용자가 복구를 정하게 한다.
  const rollback = (): CoordinateResult | null => {
    try {
      git(exec, cwd, ['reset', '--soft', fromHead]);
      return null;
    } catch (_error) {
      // reset 실패의 세부 원인은 hint가 안내하는 수동 복구와 무관하다. fromHead·toHead만 돌려준다.
      return { ok: false, reason: 'uncommit-rollback-failed', fromHead, toHead };
    }
  };
  const uncommitDecision: UncommitDecision = {
    task, kind: 'uncommit', attempt: item.dispatch.attempt, fromHead, toHead, commits,
  };
  item.decisions = [...(item.decisions || []), uncommitDecision];
  ledger.decisions.push(uncommitDecision);
  let lost: ReturnType<typeof commitWrite>;
  try {
    lost = commitWrite();
  } catch (error) {
    const failed = rollback();
    if (failed) return failed;
    throw error;
  }
  if (lost) return rollback() || lost;
  return withCheckpoint({
    ok: true as const, command, task: item, decision: uncommitDecision,
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
  ['reverify', coordinateReverify],
  ['prepare', coordinatePrepare],
]);

/** lock 안·task 조회 전에 끝까지 처리하는 handler. `promote-stop`은 별도로 promotion_stopped 거절 앞에서 돈다. */
const LOCKED_HANDLERS = new Map<string, (ctx: LockedCtx) => CoordinateResult>([
  ['session-open', coordinateSessionOpen],
  ['note', coordinateNote],
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
  ['uncommit', coordinateUncommit],
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
 * @param {number | string} [opts.tokens] - worker-model 선택, worker-tokens 필수 토큰 수(0 이상 안전 정수).
 *   worker-tokens에서만 정확한 값 `unreported`를 받아 호스트가 토큰을 주지 않은 사실을 기록한다.
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
    if (command === 'dispatch' || command === 'report' || command === 'uncommit') {
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
  'cross-drive-conflict': {
    cause: 'A task in this wave overlaps a started task in another active coordinator drive.',
    next: 'Wait for the other drive to finish or detach, or revise the plan to remove the overlap.',
  },
  'cross-drive-ledger-unreadable': {
    cause: 'Another coordinator ledger could not be read, so its task scope cannot be checked.',
    next: 'Repair or detach the named drive ledger, then retry `bouncer coordinate prepare`.',
  },
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
  'report-tests-invalid': {
    cause: 'An accepted report of a scoped_terminal task lacks the task verify command with a passing result in Tests.',
    next: 'Have the worker rerun the task verify command, fix the report Tests section, then call '
      + '`bouncer coordinate report` again.',
  },
  'baseline-ci-failed': {
    cause: 'The configured worktree.baseline command failed on the integration base before any worker was created.',
    next: 'Report the failure to the user. Only after the user explicitly approves, rerun '
      + '`bouncer coordinate prepare --accept-broken-baseline`.',
  },
  'baseline-config-invalid': {
    cause: '`worktree.baseline` in the main checkout `.bouncer/config.json` is not a string '
      + 'or not an allowed single command.',
    next: 'Fix `worktree.baseline` in the main checkout config, then rerun `bouncer coordinate prepare`.',
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
  'dispatch-report-dir-failed': {
    cause:
      'The worker report directory under `.bouncer/runtime/reports` could not be created, so no attempt was opened.',
    next:
      'Remove or repair the path that blocks the report directory in the assigned worker worktree, '
      + 'then retry `bouncer coordinate dispatch`.',
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
  'uncommit-not-needed': {
    cause: 'The worker HEAD has no commit lacking this task\'s Bouncer-Task trailer; nothing to uncommit.',
    next: 'Run `bouncer coordinate next` again to re-judge the task.',
  },
  'uncommit-rollback-failed': {
    cause: 'The uncommit reset succeeded, but the ledger write failed and restoring the worker HEAD failed too.',
    next: 'HEAD stayed at toHead. Report to the user and ask whether to run `git reset --soft <fromHead>` to recover.',
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
  // 아래 12종은 `coordinate revise`(reviseTaskScope)만 내는 거절이다. 표에 없으면
  // fallback 힌트가 붙어 coordinator가 거절 원인과 다음 행동을 알 수 없다.
  'scope-paths-required': {
    cause: '`coordinate revise` was called without any `--paths` or `--new-path` entry.',
    next:
      'Pass the paths to add as `--paths <path>...` (or `--new-path <path>...`) and rerun `bouncer coordinate ' +
      'revise`; add `--replace` only to swap the whole scope.',
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
  'scope-do-not-touch-conflict': {
    cause:
      'A `Do not touch` entry in the task brief overlaps a path this revise adds to the scope, so a worker ' +
      'would hit a forbidden path.',
    next:
      'Pass each conflicting entry from `paths` as `--release-do-not-touch <path>` (repeat the flag) and ' +
      'rerun `bouncer coordinate revise`, or drop that path from the scope.',
  },
  'release-do-not-touch-unknown': {
    cause:
      'A `--release-do-not-touch` value is not a `Do not touch` entry that overlaps a newly added scope ' +
      'path.',
    next:
      'Pass `--release-do-not-touch` only for the conflicting entries listed in `paths` of a ' +
      '`scope-do-not-touch-conflict` rejection, spelled exactly as in the brief, then rerun ' +
      '`bouncer coordinate revise`.',
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
      + 'repair, supplement, or delta round may open. A `review_contract: brief` blueprint gets one '
      + 'review-caused repair after discovery; a second repair, any supplement, or a repair after the delta '
      + 'round is refused here.',
    // legacy와 brief의 이연 시점이 다르므로 한 문구에 둘 다 적는다. brief는 delta를 처음 기록할 때만
    // minor·nit must_fix를 이연할 수 있고, 저장된 뒤에는 accept-risk 또는 blocked로 닫는다.
    next: 'Legacy blueprint: defer the remaining must_fix findings with a note and accept the review. '
      + 'Brief blueprint: no repair wave remains; a remaining minor or nit must_fix is deferred with a note only '
      + 'when the delta round is first recorded, and after a stored delta any remaining finding is closed with '
      + '`review accept-risk` after user approval or stops with `final-review-blocked`.',
  },

  'review-contract-invalid': {
    cause: 'The blueprint index `review_contract` value is not an allowed marker, so no review-caused repair '
      + 'or supplement may open.',
    next: 'Report to the user and fix `review_contract` through `/bouncer-plan`.',
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
    next: 'If the failure was environmental, fix it and run `bouncer coordinate reverify --task <terminal>` first; '
      + 'otherwise report the terminal failure to the user. Do not retry `bouncer coordinate repair`.',
  },
  'reverify-source-moved': {
    cause: 'The integration HEAD is not the source the terminal failure was recorded on.',
    next: 'The code changed since the failure, so reverify cannot vouch for it; handle it with '
      + '`bouncer coordinate repair`.',
  },
  'reverify-worktree-dirty': {
    cause: 'The integration worktree has uncommitted changes beyond the terminal evidence documents.',
    next: 'Revert the uncommitted source changes and run `bouncer coordinate reverify` again; if the change is '
      + 'needed, handle it with `bouncer coordinate repair`.',
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
  'scope-do-not-touch-violation': {
    cause: 'A committed path outside the task scope falls under a Do not touch line of the integration '
      + 'copy of the task document.',
    next: 'Keep the attempt open; ask the worker to drop the change, or release the line after user approval '
      + 'with `bouncer coordinate revise --release-do-not-touch` from the integration checkout.',
  },
  'scope-do-not-touch-unreadable': {
    cause: 'The integration copy of the task document that holds the Do not touch lines could not be read.',
    next: 'Restore the task document in the integration checkout, then retry. The line is never read from '
      + 'the worker copy.',
  },
  'unexpected-path-reason-missing': {
    cause: 'A committed path outside the task scope has no usable reason line in `## Unexpected paths` '
      + '(missing, empty, or over 200 characters).',
    next: 'Keep the attempt open; ask the worker to add a ``- `path` — reason`` line for each listed path, '
      + 'then retry `bouncer coordinate report`.',
  },
  'final-review-repair-do-not-touch': {
    cause: 'A new path of the first final-review repair falls under a Do not touch line of a ledger task.',
    next: 'Drop the path from `--new-path`, or release the line after user approval, then retry.',
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
  'note-text-required': {
    cause: 'The note text is missing, not a string, or empty after trimming.',
    next: 'Retry `bouncer coordinate note --text "<handoff note>"` with a non-empty text.',
  },
  'note-too-long': {
    cause: 'The note text is longer than 2000 characters after trimming.',
    next: 'Shorten the note to 2000 characters or fewer and retry `bouncer coordinate note`.',
  },
  'note-review-handoff-invalid': {
    cause: 'The note text starts with `review-handoff:` but matches neither the handoff shape '
      + 'nor the unavailable shape.',
    next: 'Stop the handoff and report this refusal, as the direct-run.md Handoff table says for any other ok: false '
      + 'at the note step; do not retry with a different text.',
  },
  'worker-model-role-invalid': {
    cause: 'worker-model and worker-tokens record only the implementer, reviewer or debugger role.',
    next: 'Retry with `--role implementer`, `--role reviewer` or `--role debugger`.',
  },
  'tokens-invalid': {
    cause: 'The tokens value is negative, fractional, not a number, or missing for worker-tokens.',
    next: 'Retry with `--tokens <n>` set to the non-negative integer the host reported, '
      + '`--tokens unreported` on worker-tokens when the host gave none, or omit it for worker-model.',
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
    // 매핑된 경계 reason에만 gate를 붙인다. 나머지는 키 자체가 없다.
    const gate = compositeGates.compositeGateForReason(body.reason);
    return { ...body, cause: hint.cause, next: hint.next, ...(gate ? { gate } : {}) };
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
