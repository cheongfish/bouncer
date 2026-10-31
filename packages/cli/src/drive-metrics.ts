'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
import guards = require('./guards');
const { isRecord, isEnoentError } = guards;
import driveRecord = require('./drive-record');
import type { DriveRecord, DriveRecordReview } from './drive-record';
const { summarizeDriveRecord, isDriveRecord } = driveRecord;

/**
 * drive 계측 기록(`.bouncer/runtime/drive-metrics.json`)의 읽기·쓰기·요약.
 *
 * 원칙: 호스트가 준 값만 기록한다. 토큰·시간·비용을 추정해 채우지 않고, 얻지 못한 값은
 * `null`과 사유 문자열로 남겨 합계가 누락을 0으로 세지 않게 한다. 원장은 읽기만 하며
 * 기록 파일 쓰기는 임시 파일 뒤 rename이다.
 */

const SESSION_KINDS = [
  'coordinator-session', 'context-review', 'root-direct-session',
  'plan-coordinator-session', 'planner-session',
] as const;
type SessionKind = typeof SESSION_KINDS[number];

// plan kind는 blueprint가 아직 없는 시점에 시작하므로 `blueprint: null`로 열리고, 끝날 때 한 번 묶인다.
const PLAN_KINDS: readonly string[] = ['plan-coordinator-session', 'planner-session'];
const TIERS = ['strong', 'standard', 'light'] as const;
const EFFORTS = ['low', 'medium', 'high'] as const;

// 이 kind의 decision, 또는 outcome이 accepted가 아닌 report는 "예외 판단"이다.
const EXCEPTION_KINDS = new Set([
  'stale-report', 'stale-lease', 'repair', 'supplement', 'rerecord',
  'critical-recovery', 'fanin-verification-failed', 'revoke', 'uncommit',
]);

type LedgerSnapshot = { decisions: number; completed_tasks: string[]; ledger_sha256: string };
type MetricsSession = {
  id: string;
  kind: SessionKind;
  // plan kind만 null일 수 있다(end에서 묶이기 전).
  blueprint: string | null;
  label: string | null;
  // 끝날 때 기록한다. 필드가 생기기 전 기록은 키가 없고 집계에서 unknown이다.
  tier?: typeof TIERS[number] | null;
  effort?: typeof EFFORTS[number] | null;
  started_at: string;
  ended_at: string | null;
  // coordinator-session만 가진다. 원장이 없던 시점이면 null.
  start?: LedgerSnapshot | null;
  end?: LedgerSnapshot | null;
  tasks_completed?: string[] | null;
  exception_decisions?: number | null;
  // context-review만 가진다.
  target_digest?: string;
  wall_ms?: number;
  host_duration_ms?: number | null;
  model?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  tokens?: number | null;
  tokens_unavailable_reason?: string;
  // cache 토큰은 tokens·input/output과 독립이다. 총합·비용 계산에 들어가지 않는다.
  cache_read_tokens?: number | null;
  cache_write_tokens?: number | null;
  cache_unavailable_reason?: string;
  cost?: number | null;
  cost_unavailable_reason?: string;
};
type PricingTable = Record<string, { input_per_mtok: number; output_per_mtok: number }>;
type MetricsFile = { version: 1; sessions: MetricsSession[] };
type Failure = { ok: false; reason: string };
type Clock = () => Date;

/**
 * 기록 파일의 절대 경로. runtime 디렉터리는 gitignore라 기록이 커밋에 섞이지 않는다.
 *
 * @param {string} mainRoot - main worktree 루트(`runtimePaths().projectRoot`)
 * @returns {string} drive-metrics.json 절대 경로
 */
function metricsFilePath(mainRoot: string): string {
  return path.join(mainRoot, '.bouncer', 'runtime', 'drive-metrics.json');
}

// blueprint 비교용 정규화. 호출자마다 끝 슬래시·역슬래시가 달라도 같은 blueprint로 묶는다.
function normalizeBlueprint(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * 기록 파일을 읽는다. 파일 없음(ENOENT)만 빈 기록이고, 깨진 JSON·모양 불일치는
 * `metrics-file-invalid`다 — 거절해야 이후 쓰기가 깨진 파일을 덮어쓰지 않는다.
 *
 * @param {string} file - drive-metrics.json 경로
 * @returns {{ok: true, data: MetricsFile} | Failure} 읽은 기록 또는 거절
 */
function readMetrics(file: string): { ok: true; data: MetricsFile } | Failure {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    // ENOENT만 "아직 기록 없음". 권한 오류 등은 삼키지 않고 그대로 던진다.
    if (isEnoentError(error)) return { ok: true, data: { version: 1, sessions: [] } };
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    // SyntaxError만 여기로 온다(입력이 문자열). 깨진 파일은 invalid로 접는다.
    return { ok: false, reason: 'metrics-file-invalid' };
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.sessions)
    || !parsed.sessions.every((s) => isRecord(s) && typeof s.id === 'string'
      && typeof s.kind === 'string'
      // blueprint null은 plan kind에만 허용한다. 다른 kind의 null은 손상된 기록이다.
      && (typeof s.blueprint === 'string' || (s.blueprint === null && PLAN_KINDS.includes(s.kind))))) {
    return { ok: false, reason: 'metrics-file-invalid' };
  }
  return { ok: true, data: parsed as unknown as MetricsFile };
}

// 임시 파일 뒤 rename: 쓰는 도중 중단돼도 기존 기록이 반쯤 쓰인 채 남지 않는다.
function writeMetrics(file: string, data: MetricsFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

type LedgerRead =
  // ledger는 파싱된 원장 전체다. drive_record 계산이 tasks·decisions를 함께 읽는다. 원장이 없으면 생략한다.
  | { ok: true; snapshot: LedgerSnapshot | null; decisions: unknown[]; ledger?: unknown }
  | Failure;
// 작업자 집계 snapshot 저장·읽기가 쓰는 파일 I/O. 테스트가 저장 실패를 주입하는 seam이다.
type SnapshotFs = {
  readFileSync: {
    (file: string): Buffer;
    (file: string, encoding: BufferEncoding): string;
  };
  // options는 temp를 배타 생성('wx')하려는 저장 경로만 넘긴다. 기존 2-인자 주입도 그대로 허용된다.
  writeFileSync: (file: string, data: string, options?: { flag: string }) => void;
  renameSync: (from: string, to: string) => void;
  // 아래 넷은 경계 검사·mkdir·temp 정리용 optional seam이다. 없으면 node:fs로 fallback한다.
  realpathSync?: (file: string) => string;
  lstatSync?: (file: string) => { isSymbolicLink: () => boolean };
  mkdirSync?: (dir: string, options: { recursive: true }) => string | undefined;
  unlinkSync?: (file: string) => void;
};

/**
 * 원장의 진행 snapshot을 읽는다. 원장은 읽기만 한다. 원장이 아직 없으면 snapshot은 null이고,
 * 깨진 원장은 진행 차이를 추정하지 않고 `metrics-ledger-invalid`로 거절한다.
 *
 * @param {string} ledgerFile - integration worktree의 coordinator.json 경로
 * @param {SnapshotFs} [fsx] - 읽기 seam. 기본은 node:fs
 * @returns {LedgerRead} snapshot과 decision 배열, 또는 거절
 */
function readLedgerSnapshot(ledgerFile: string, fsx: SnapshotFs = fs): LedgerRead {
  let bytes: Buffer;
  try {
    bytes = fsx.readFileSync(ledgerFile);
  } catch (error) {
    if (isEnoentError(error)) return { ok: true, snapshot: null, decisions: [] };
    throw error;
  }
  let ledger: unknown;
  try {
    ledger = JSON.parse(bytes.toString('utf8'));
  } catch (_error) {
    return { ok: false, reason: 'metrics-ledger-invalid' };
  }
  if (!isRecord(ledger)) return { ok: false, reason: 'metrics-ledger-invalid' };
  const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
  const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
  const completed = tasks
    .filter((t) => isRecord(t) && t.status === 'integrated' && typeof t.id === 'string')
    .map((t) => (t as { id: string }).id);
  return {
    ok: true,
    snapshot: {
      decisions: decisions.length,
      completed_tasks: completed,
      ledger_sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    decisions,
    ledger,
  };
}

/**
 * 원장 항목이 "예외 판단"인지 가른다. 세션 경계 판정(`coordinate next`)과 metrics의
 * 예외 수 계산이 같은 정의를 쓰도록 export한다.
 *
 * @param {unknown} entry - 원장 decision 항목
 * @returns {boolean} 예외 kind이거나 accepted가 아닌 report면 true
 */
function isException(entry: unknown): boolean {
  if (!isRecord(entry)) return false;
  if (typeof entry.kind === 'string' && EXCEPTION_KINDS.has(entry.kind)) return true;
  return entry.kind === 'report' && entry.outcome !== 'accepted';
}

/**
 * 세션 시작을 기록한다. coordinator-session은 그 시점의 원장 snapshot을, context-review는
 * `target_digest`를 남기고 원장 진행 필드를 만들지 않는다.
 *
 * @param {object} opts - 시작 입력
 * @param {string} opts.file - drive-metrics.json 경로
 * @param {string} opts.ledgerFile - 해당 blueprint의 integration 원장 경로
 * @param {string} opts.kind - `coordinator-session` | `context-review` | `root-direct-session`
 *   | `plan-coordinator-session` | `planner-session`
 * @param {string} [opts.blueprint] - blueprint 디렉터리. plan kind만 생략할 수 있고 생략하면 null로 저장해
 *   end에서 묶는다. plan kind는 원장 snapshot을 읽지 않는다
 * @param {string} [opts.label] - 세션 라벨(context-review는 perspective)
 * @param {string} [opts.targetDigest] - context-review 필수 64 hex
 * @param {Clock} [opts.now] - 테스트 seam. 기본 현재 시각
 * @param {() => string} [opts.randomId] - 테스트 seam. 16 hex를 돌려준다
 * @returns {{ok: true, id: string} | Failure} 새 세션 id 또는 거절 사유
 */
function startSession(opts: {
  file: string; ledgerFile: string; kind: string; blueprint?: string;
  label?: string; targetDigest?: string; now?: Clock; randomId?: () => string;
}): { ok: true; id: string } | Failure {
  const now = opts.now ?? (() => new Date());
  const randomId = opts.randomId ?? (() => randomBytes(8).toString('hex'));
  const invalid: Failure = { ok: false, reason: 'invalid-metrics-input' };
  if (!(SESSION_KINDS as readonly string[]).includes(opts.kind)) return invalid;
  const kind = opts.kind as SessionKind;
  const isPlan = PLAN_KINDS.includes(kind);
  // blueprint 생략은 plan kind에만 허용한다. 주어진 값은 plan kind라도 빈 문자열이면 거절한다.
  if (opts.blueprint === undefined ? !isPlan : (typeof opts.blueprint !== 'string' || opts.blueprint === '')) {
    return invalid;
  }
  // `/`, `\`, `//`처럼 구분자만 있는 값은 정규화하면 빈 문자열이 된다. 저장 뒤에는 어떤 blueprint에도
  // 묶이지 않는 세션이 남으므로 end의 바인딩 검사와 같은 기준(정규화 뒤 빈 값)으로 쓰기 전에 거절한다.
  if (opts.blueprint !== undefined && normalizeBlueprint(opts.blueprint) === '') return invalid;
  const isReview = kind === 'context-review';
  // target-digest는 context-review의 호출 식별자다. 다른 kind에 주면 오타 가능성이 커서 거절한다.
  if (isReview !== (opts.targetDigest !== undefined)) return invalid;
  if (isReview && !/^[a-f0-9]{64}$/.test(opts.targetDigest as string)) return invalid;

  // 깨진 기록 파일은 어떤 쓰기보다 먼저 거절한다.
  const current = readMetrics(opts.file);
  if (current.ok === false) return current;
  const session: MetricsSession = {
    id: `m-${randomId()}`,
    kind,
    blueprint: opts.blueprint === undefined ? null : normalizeBlueprint(opts.blueprint),
    label: opts.label ?? null,
    started_at: now().toISOString(),
    ended_at: null,
  };
  if (isReview) {
    session.target_digest = opts.targetDigest;
  } else if (!isPlan) {
    const ledger = readLedgerSnapshot(opts.ledgerFile);
    if (ledger.ok === false) return ledger;
    session.start = ledger.snapshot;
  }
  current.data.sessions.push(session);
  writeMetrics(opts.file, current.data);
  return { ok: true, id: session.id };
}

type CostResult = { cost: number; reason?: undefined } | { cost: null; reason: string };

// 비용은 호스트가 준 모델·입출력 토큰과 설정 단가가 모두 있을 때만 계산한다.
function computeCost(
  model: string | null, input: number | null, output: number | null, pricing: PricingTable | null,
): CostResult {
  if (model === null) return { cost: null, reason: 'no-model' };
  if (input === null || output === null) return { cost: null, reason: 'no-token-split' };
  if (pricing === null) return { cost: null, reason: 'invalid-pricing' };
  if (!Object.hasOwn(pricing, model)) return { cost: null, reason: 'no-pricing' };
  const price = pricing[model];
  return { cost: (input / 1e6) * price.input_per_mtok + (output / 1e6) * price.output_per_mtok };
}

/**
 * 세션 종료를 기록한다. 호스트가 준 토큰·시간만 쓰고, 없으면 `null`과 사유를 남긴다.
 *
 * @param {object} opts - 종료 입력
 * @param {string} opts.file - drive-metrics.json 경로
 * @param {(blueprint: string) => string | null} opts.resolveLedger - 세션 blueprint의 integration 원장 경로.
 *   null이면 기록된 blueprint를 경로로 풀 수 없다는 뜻이라 기록 파일 손상으로 거절한다
 * @param {string} opts.id - start가 돌려준 세션 id
 * @param {number} [opts.tokens] - 호스트가 준 총 토큰
 * @param {number} [opts.inputTokens] - 호스트가 준 입력 토큰
 * @param {number} [opts.outputTokens] - 호스트가 준 출력 토큰
 * @param {number} [opts.cacheReadTokens] - 호스트가 준 cache read 토큰(독립 필드, 총합·비용에 안 더함)
 * @param {number} [opts.cacheWriteTokens] - 호스트가 준 cache write 토큰(독립 필드, 총합·비용에 안 더함)
 * @param {string} [opts.model] - 모델 slug
 * @param {number} [opts.hostDurationMs] - 호스트가 준 소요 시간
 * @param {string} [opts.tier] - 세션 등급 `strong|standard|light`(대소문자 구분). 생략하면 null
 * @param {string} [opts.effort] - 세션 effort `low|medium|high`. 생략하면 null
 * @param {string} [opts.blueprint] - blueprint가 null인 plan 세션에만, 그리고 그때는 반드시 줘야 한다.
 *   `start`와 같은 정규화로 저장하며 경로 존재·원장 해석은 검사하지 않는다
 * @param {PricingTable | null} opts.pricing - 단가 표. 깨진 설정이면 null
 * @param {Clock} [opts.now] - 테스트 seam
 * @returns {{ok: true} | Failure} 성공 또는 거절 사유. tier·effort·blueprint 입력 오류는
 *   `invalid-metrics-input`이며 어떤 쓰기보다 먼저 거절해 파일을 바꾸지 않는다
 */
function endSession(opts: {
  file: string; resolveLedger: (blueprint: string) => string | null; id: string; tokens?: number;
  inputTokens?: number;
  outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number;
  model?: string; hostDurationMs?: number; tier?: string; effort?: string; blueprint?: string;
  pricing: PricingTable | null; now?: Clock;
}): { ok: true; id: string } | Failure {
  const now = opts.now ?? (() => new Date());
  const current = readMetrics(opts.file);
  if (current.ok === false) return current;
  const session = current.data.sessions.find((s) => s.id === opts.id);
  if (!session) return { ok: false, reason: 'metrics-session-not-found' };
  if (session.ended_at !== null) return { ok: false, reason: 'metrics-session-ended' };

  // 입력 검증은 session 변경 전에 모두 끝낸다. 거절 뒤에는 파일을 쓰지 않아 bytes가 그대로다.
  const invalid: Failure = { ok: false, reason: 'invalid-metrics-input' };
  if (opts.tier !== undefined && !(TIERS as readonly string[]).includes(opts.tier)) return invalid;
  if (opts.effort !== undefined && !(EFFORTS as readonly string[]).includes(opts.effort)) return invalid;
  // 묶기는 blueprint가 null인 plan 세션에서 정확히 한 번만 가능하다. 이미 묶인 세션이나 다른 kind에 주면
  // 잘못 묶인 값을 고칠 길이 없으므로 거절하고, null인 plan 세션은 묶지 않고 끝낼 수도 없다.
  let boundBlueprint: string | null = null;
  if (session.blueprint === null) {
    if (opts.blueprint === undefined) return invalid;
    boundBlueprint = normalizeBlueprint(opts.blueprint);
    if (boundBlueprint === '') return invalid;
  } else if (opts.blueprint !== undefined) {
    return invalid;
  }
  if (boundBlueprint !== null) session.blueprint = boundBlueprint;
  session.tier = opts.tier === undefined ? null : opts.tier as typeof TIERS[number];
  session.effort = opts.effort === undefined ? null : opts.effort as typeof EFFORTS[number];

  const endedAt = now();
  session.ended_at = endedAt.toISOString();
  session.wall_ms = Math.max(0, endedAt.getTime() - Date.parse(session.started_at));
  session.host_duration_ms = opts.hostDurationMs ?? null;
  session.model = opts.model ?? null;
  session.input_tokens = opts.inputTokens ?? null;
  session.output_tokens = opts.outputTokens ?? null;
  // 총합은 호스트가 준 --tokens를 우선하고, 없을 때만 입출력이 둘 다 있으면 그 합이다(추정 아님).
  session.tokens = opts.tokens
    ?? (opts.inputTokens !== undefined && opts.outputTokens !== undefined
      ? opts.inputTokens + opts.outputTokens : null);
  if (session.tokens === null) session.tokens_unavailable_reason = 'not-reported';
  // cache는 호스트가 준 값만 쓴다. 둘 다 없을 때만 사유를 남기고, 하나라도 있으면 사유 키를 쓰지 않는다.
  session.cache_read_tokens = opts.cacheReadTokens ?? null;
  session.cache_write_tokens = opts.cacheWriteTokens ?? null;
  if (session.cache_read_tokens === null && session.cache_write_tokens === null) {
    session.cache_unavailable_reason = 'not-reported';
  }
  const cost = computeCost(session.model, session.input_tokens, session.output_tokens, opts.pricing);
  session.cost = cost.cost;
  if (cost.reason !== undefined) session.cost_unavailable_reason = cost.reason;

  if (session.kind === 'coordinator-session') {
    // coordinator-session은 null blueprint를 readMetrics가 이미 거절하므로 string이다.
    const ledgerFile = opts.resolveLedger(session.blueprint as string);
    if (ledgerFile === null) return { ok: false, reason: 'metrics-file-invalid' };
    const ledger = readLedgerSnapshot(ledgerFile);
    if (ledger.ok === false) return ledger;
    session.end = ledger.snapshot;
    if (ledger.snapshot === null) {
      session.tasks_completed = null;
      session.exception_decisions = null;
    } else {
      const before = new Set(session.start?.completed_tasks ?? []);
      session.tasks_completed = ledger.snapshot.completed_tasks.filter((id) => !before.has(id));
      session.exception_decisions = ledger.decisions
        .slice(session.start?.decisions ?? 0).filter(isException).length;
    }
  }
  writeMetrics(opts.file, current.data);
  return { ok: true, id: session.id };
}

type CacheSummary = {
  read: { total: number; missing: number };
  write: { total: number; missing: number };
};
type WorkerTokensSource = 'ledger' | 'snapshot' | 'unavailable';
type WorkerTokensTotal = { total: number; missing: number };
type WorkerTokensSummary = WorkerTokensTotal & {
  by_role: Record<'implementer' | 'reviewer' | 'debugger', WorkerTokensTotal>;
};
// *_total은 관측값이 하나도 없으면 null이다(명시적 0은 관측값). 일부만 관측되면 알려진 합이며
// 완전한 총량이 아니므로 *_missing을 함께 읽어야 한다.
type KindSummary = {
  sessions: number; open: number;
  tokens_total: number | null; tokens_missing: number;
  input_tokens_total: number | null; input_tokens_missing: number;
  output_tokens_total: number | null; output_tokens_missing: number;
  host_duration_ms_total: number | null; host_duration_ms_missing: number;
  wall_ms_total: number | null; wall_ms_missing: number;
  cost_total: number; cost_missing: number; tasks_completed?: number;
  by_tier: Record<TierKey, TierSummary>;
};
type TierKey = typeof TIERS[number] | 'unknown';
type TierSummary = { sessions: number; tokens_total: number; cost_total: number };
type TotalKey = 'tokens_total' | 'input_tokens_total' | 'output_tokens_total'
  | 'host_duration_ms_total' | 'wall_ms_total';
type MissingKey = 'tokens_missing' | 'input_tokens_missing' | 'output_tokens_missing'
  | 'host_duration_ms_missing' | 'wall_ms_missing';

function emptyTier(): TierSummary {
  return { sessions: 0, tokens_total: 0, cost_total: 0 };
}

/**
 * 관측값 하나를 kind 합계에 반영한다. 숫자(명시적 0 포함)만 더하고, `null`·필드 부재(legacy 기록)는
 * 합에 넣지 않고 missing으로 센다. 누락을 0으로 접으면 측정 못 한 세션이 값 0처럼 읽히기 때문이다.
 * 첫 관측값이 들어올 때 total이 null에서 숫자로 바뀐다.
 *
 * @param {KindSummary} sum - 갱신할 kind 합계
 * @param {TotalKey} totalKey - 합계 필드
 * @param {MissingKey} missingKey - 누락 수 필드
 * @param {unknown} value - 세션에 기록된 값
 * @returns {void}
 */
function observe(sum: KindSummary, totalKey: TotalKey, missingKey: MissingKey, value: unknown): void {
  if (typeof value === 'number') sum[totalKey] = (sum[totalKey] ?? 0) + value;
  else sum[missingKey] += 1;
}

/**
 * blueprint의 kind별 합계. 끝난 세션만 토큰·시간·비용에 합산하고, `null`은 합에서 빼
 * 누락 수로 따로 센다. 0으로 세면 측정하지 못한 세션이 값이 0인 세션처럼 읽힌다.
 *
 * @param {{file: string, blueprint: string, resolveLedger?: Function}} opts - 기록 파일, blueprint,
 *   원장 경로 해석기 `(blueprint) => string | null`(주입)
 * 토큰(total·input·output)·host 소요 시간·wall 시간은 관측값이 하나도 없으면 total이 `null`이고,
 * 일부만 있으면 알려진 합과 `*_missing`을 함께 낸다. cost_total은 기존 입력 호환으로 0 시작을 유지한다.
 * worker_tokens는 원장의 `worker-model`·`worker-tokens` decision에서 따로 합산한다. coordinator
 * 총량에 이미 포함됐는지 알 수 없으므로 `kinds`에 더하지 않는다. 원장이 없거나 resolveLedger가
 * 없으면 0이고, 깨진 원장은 `metrics-ledger-invalid`로 거절한다. 원장 파일이 없으면 정리 전에 저장한
 * snapshot(`commonGitDir` 아래)으로 복원하고, 그것도 없을 때만 0이다. 출처는 `worker_tokens_source`
 * (`ledger`|`snapshot`|`unavailable`)로 구별해 복원값과 실제 0이 섞이지 않게 한다.
 * cache read·write는 kind와 무관하게 blueprint 전체 합을 최상위 `cache`에 낸다. 숫자만 합산하고
 * `null`·필드 부재(필드가 생기기 전 기록)는 `missing`으로 센다. `0`은 값이다.
 *
 * @returns {{ok: true, blueprint: string, kinds: Record<string, KindSummary>, cache: CacheSummary} | Failure} 합계 또는 거절
 */
function summarize(opts: {
  file: string; blueprint: string; resolveLedger?: (blueprint: string) => string | null;
  commonGitDir?: string | null;
}): {
  ok: true; blueprint: string; kinds: Record<string, KindSummary>; cache: CacheSummary;
  worker_tokens: WorkerTokensSummary; worker_tokens_source: WorkerTokensSource;
} | Failure {
  const current = readMetrics(opts.file);
  if (current.ok === false) return current;
  const blueprint = normalizeBlueprint(opts.blueprint);
  const kinds: Record<string, KindSummary> = {};
  for (const kind of SESSION_KINDS) {
    kinds[kind] = {
      sessions: 0, open: 0, tokens_total: null, tokens_missing: 0,
      input_tokens_total: null, input_tokens_missing: 0,
      output_tokens_total: null, output_tokens_missing: 0,
      host_duration_ms_total: null, host_duration_ms_missing: 0,
      wall_ms_total: null, wall_ms_missing: 0, cost_total: 0, cost_missing: 0,
      by_tier: {
        strong: emptyTier(), standard: emptyTier(), light: emptyTier(), unknown: emptyTier(),
      },
    };
    if (kind === 'coordinator-session') kinds[kind].tasks_completed = 0;
  }
  const cache: CacheSummary = { read: { total: 0, missing: 0 }, write: { total: 0, missing: 0 } };
  for (const s of current.data.sessions) {
    if (s.blueprint !== blueprint || !Object.hasOwn(kinds, s.kind)) continue;
    const sum = kinds[s.kind];
    sum.sessions += 1;
    if (s.ended_at === null) {
      sum.open += 1;
      continue;
    }
    observe(sum, 'tokens_total', 'tokens_missing', s.tokens);
    observe(sum, 'input_tokens_total', 'input_tokens_missing', s.input_tokens);
    observe(sum, 'output_tokens_total', 'output_tokens_missing', s.output_tokens);
    // 호스트가 준 소요 시간과 직접 잰 wall time은 출처가 달라 서로 대신 채우지 않는다.
    observe(sum, 'host_duration_ms_total', 'host_duration_ms_missing', s.host_duration_ms);
    observe(sum, 'wall_ms_total', 'wall_ms_missing', s.wall_ms);
    if (typeof s.cache_read_tokens === 'number') cache.read.total += s.cache_read_tokens;
    else cache.read.missing += 1;
    if (typeof s.cache_write_tokens === 'number') cache.write.total += s.cache_write_tokens;
    else cache.write.missing += 1;
    if (typeof s.cost === 'number') sum.cost_total += s.cost; else sum.cost_missing += 1;
    // 등급 분포: tier가 null이거나 키가 없는(필드 이전) 세션은 unknown이다. 이미 계산된 값만 더하고
    // 숫자가 아닌 tokens·cost는 건너뛴다(시작값 0).
    const tierKey: TierKey = (TIERS as readonly unknown[]).includes(s.tier) ? s.tier as TierKey : 'unknown';
    const bucket = sum.by_tier[tierKey];
    bucket.sessions += 1;
    if (typeof s.tokens === 'number') bucket.tokens_total += s.tokens;
    if (typeof s.cost === 'number') bucket.cost_total += s.cost;
    if (sum.tasks_completed !== undefined && Array.isArray(s.tasks_completed)) {
      sum.tasks_completed += s.tasks_completed.length;
    }
  }
  const workerTokens = summarizeWorkerTokens(
    opts.resolveLedger?.(blueprint) ?? null, opts.commonGitDir ?? null, blueprint,
  );
  if (workerTokens.ok === false) return workerTokens;
  return {
    ok: true, blueprint, kinds, cache,
    worker_tokens: workerTokens.summary, worker_tokens_source: workerTokens.source,
  };
}

const WORKER_ROLES = ['implementer', 'reviewer', 'debugger'] as const;

function emptyWorkerSummary(): WorkerTokensSummary {
  return {
    total: 0, missing: 0,
    by_role: {
      implementer: { total: 0, missing: 0 }, reviewer: { total: 0, missing: 0 },
      debugger: { total: 0, missing: 0 },
    },
  };
}

/**
 * 원장 decision 배열에서 하위 에이전트 토큰을 합산한다. 키 `(task, role, perspective)`마다
 * `runs`(worker-model 수)와 `reported`(숫자 tokens가 달린 worker-model + worker-tokens 수)를
 * 세어, 누락은 `max(0, runs - reported)`다. 늦게 온 worker-tokens가 같은 키의 토큰 없는
 * worker-model을 메우므로 한 호출이 두 번 세이지 않는다. 호스트가 주지 않은 값은 만들지 않는다.
 *
 * @param {unknown[]} decisions - 원장 decisions
 * @returns {WorkerTokensSummary} 합계와 역할별 합계
 */
function sumWorkerDecisions(decisions: unknown[]): WorkerTokensSummary {
  const summary = emptyWorkerSummary();
  const counts = new Map<string, { role: typeof WORKER_ROLES[number]; runs: number; reported: number }>();
  for (const d of decisions) {
    if (!isRecord(d) || (d.kind !== 'worker-model' && d.kind !== 'worker-tokens')) continue;
    const role = WORKER_ROLES.find((r) => r === d.role);
    if (role === undefined) continue;
    const key = JSON.stringify([d.task ?? '', role, d.perspective ?? '']);
    const entry = counts.get(key) ?? { role, runs: 0, reported: 0 };
    if (d.kind === 'worker-model') entry.runs += 1;
    if (typeof d.tokens === 'number') {
      entry.reported += 1;
      summary.by_role[role].total += d.tokens;
      summary.total += d.tokens;
    }
    counts.set(key, entry);
  }
  for (const { role, runs, reported } of counts.values()) {
    const missing = Math.max(0, runs - reported);
    summary.by_role[role].missing += missing;
    summary.missing += missing;
  }
  return summary;
}

// 미충족 worker 키 한 개. pendingWorkerTokenKeys가 내고 TASKS-005 거절이 읽는다.
type PendingWorkerTokenKey = {
  task: string | null; role: typeof WORKER_ROLES[number]; perspective: string | null; pending: number;
};

/**
 * 토큰 기록이 아직 채워지지 않은 worker 키를 찾는다. 키는 sumWorkerDecisions와 같은
 * `(task, role, perspective)`다. 키마다 `runs`(worker-model 수)와 `filled`(숫자 tokens가 달린
 * 기록 + worker-tokens의 숫자 또는 `unreported` 기록 수)를 세고, `runs > filled`인 키만 낸다.
 * `unreported`도 채움으로 세는 이유는 호스트가 답하지 않았다는 사실 자체가 기록됐기 때문이다.
 * 기록이 있는데 미충족으로 남기면 같은 누락을 두 번 재촉하게 된다. 대응 worker-model이 없는
 * worker-tokens 단독 키는 runs가 0이라 나오지 않는다. 입력은 바꾸지 않는다.
 *
 * @param {unknown[]} decisions - 원장 decisions
 * @returns {PendingWorkerTokenKey[]} 미충족 키만 입력의 첫 등장 순으로. 모두 채워졌거나 없으면 빈 배열
 */
function pendingWorkerTokenKeys(decisions: unknown[]): PendingWorkerTokenKey[] {
  const counts = new Map<string, Omit<PendingWorkerTokenKey, 'pending'> & { runs: number; filled: number }>();
  for (const d of decisions) {
    if (!isRecord(d) || (d.kind !== 'worker-model' && d.kind !== 'worker-tokens')) continue;
    const role = WORKER_ROLES.find((r) => r === d.role);
    if (role === undefined) continue;
    // task·perspective가 없으면 null로 낸다. 호출자가 "없음"을 빈 문자열과 섞지 않도록 모양을 고정한다.
    const task = typeof d.task === 'string' ? d.task : null;
    const perspective = typeof d.perspective === 'string' ? d.perspective : null;
    const key = JSON.stringify([task ?? '', role, perspective ?? '']);
    const entry = counts.get(key) ?? { task, role, perspective, runs: 0, filled: 0 };
    if (d.kind === 'worker-model') entry.runs += 1;
    if (typeof d.tokens === 'number' || d.unreported === true) entry.filled += 1;
    counts.set(key, entry);
  }
  const pending: PendingWorkerTokenKey[] = [];
  for (const { task, role, perspective, runs, filled } of counts.values()) {
    if (runs > filled) pending.push({ task, role, perspective, pending: runs - filled });
  }
  return pending;
}

/**
 * 한 worker 키 `(task, role, perspective)`의 기록 상태를 한 번에 센다. 키 규칙은
 * `sumWorkerDecisions`·`pendingWorkerTokenKeys`와 같다(task·perspective 부재는 빈 문자열).
 * worker-tokens 중복 거절이 pending 판정과 갈라지지 않도록 `runs`·`filled` 정의를 그대로 따른다:
 * `runs`는 worker-model 수, `filled`는 숫자 `tokens`가 달린 기록(worker-model 포함)과 `unreported`
 * 기록 수다. 입력은 바꾸지 않는다.
 *
 * @param {unknown[]} decisions - 원장 decisions
 * @param {string | undefined} task - 키의 task. 없으면 blueprint 범위 키
 * @param {string} role - 키의 role
 * @param {string | undefined} perspective - 키의 perspective. 없으면 관점 없는 키
 * @returns {{ runs: number; filled: number; tokensRecords: number; latest: Record<string, unknown> | null }}
 *   `tokensRecords`는 키의 worker-tokens 기록 수, `latest`는 그중 배열상 가장 나중 기록(없으면 null)
 */
function workerKeyState(
  decisions: unknown[], task: string | undefined, role: string, perspective: string | undefined,
): { runs: number; filled: number; tokensRecords: number; latest: Record<string, unknown> | null } {
  const state = { runs: 0, filled: 0, tokensRecords: 0, latest: null as Record<string, unknown> | null };
  const wanted = JSON.stringify([task ?? '', role, perspective ?? '']);
  for (const d of decisions) {
    if (!isRecord(d) || (d.kind !== 'worker-model' && d.kind !== 'worker-tokens')) continue;
    if (JSON.stringify([d.task ?? '', d.role, d.perspective ?? '']) !== wanted) continue;
    if (d.kind === 'worker-model') state.runs += 1;
    if (typeof d.tokens === 'number' || d.unreported === true) state.filled += 1;
    if (d.kind === 'worker-tokens') {
      state.tokensRecords += 1;
      state.latest = d;
    }
  }
  return state;
}

/**
 * worker 집계의 출처를 정해 합산한다. 우선순위는 live 원장 → 저장 snapshot → unavailable이다.
 * 원장 파일이 있으면(깨졌으면 거절) 언제나 원장이 이기므로 오래된 snapshot이 live 자료를
 * 대신하지 않는다. 원장이 없을 때만 snapshot을 읽고, 깨진 snapshot은 0으로 접지 않고 거절한다.
 *
 * @param {string | null} ledgerFile - 원장 경로. null이면 원장 없음으로 본다
 * @param {string | null} commonGitDir - snapshot 저장소가 있는 Git common dir. null이면 snapshot 없음
 * @param {string} blueprint - 정규화된 blueprint 경로
 * @returns {{ok: true, summary: WorkerTokensSummary, source: WorkerTokensSource} | Failure}
 *   합계와 출처, 또는 깨진 원장·snapshot 거절
 */
function summarizeWorkerTokens(ledgerFile: string | null, commonGitDir: string | null, blueprint: string):
  { ok: true; summary: WorkerTokensSummary; source: WorkerTokensSource } | Failure {
  const ledger: LedgerRead = ledgerFile === null
    ? { ok: true, snapshot: null, decisions: [] } : readLedgerSnapshot(ledgerFile);
  if (ledger.ok === false) return ledger;
  if (ledger.snapshot !== null) {
    return { ok: true, summary: sumWorkerDecisions(ledger.decisions), source: 'ledger' };
  }
  if (commonGitDir !== null) {
    const saved = loadWorkerSnapshot({ commonGitDir, blueprint });
    if (saved.ok === false) return saved;
    if (saved.snapshot !== null) {
      return { ok: true, summary: saved.snapshot.worker_tokens, source: 'snapshot' };
    }
  }
  return { ok: true, summary: emptyWorkerSummary(), source: 'unavailable' };
}

type WorkerSnapshotFile = {
  version: 1; blueprint: string; recorded_at: string; ledger_sha256: string;
  worker_tokens: WorkerTokensSummary;
  // 새 snapshot에만 있다. 키가 없는 기존 snapshot은 그대로 유효하다(읽기 호환).
  drive_record?: DriveRecord;
};

/**
 * snapshot 파일 경로. 파일명은 blueprint 경로(UTF-8)의 SHA-256이라 blueprint 문자열이
 * 경로 조각으로 새지 않는다. 프로젝트 경로가 아니라 Git common dir 아래다 — worktree
 * 정리와 `git clean`이 지우지 못하는 자리여야 정리 뒤에도 살아남는다.
 *
 * @param {string} commonGitDir - `git rev-parse --git-common-dir`의 절대 경로
 * @param {string} blueprint - blueprint 경로(정규화 전이어도 된다)
 * @returns {string} snapshot 파일 절대 경로
 */
function workerSnapshotPath(commonGitDir: string, blueprint: string): string {
  const name = createHash('sha256').update(normalizeBlueprint(blueprint), 'utf8').digest('hex');
  return path.join(commonGitDir, 'bouncer', 'metrics-snapshots', `${name}.json`);
}

// realpath가 상위가 아닌 곳으로 새는지 본다(심볼릭 링크로 common dir 밖을 가리키는 경우).
function isInsideReal(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

// 파일 시스템 오류(code가 문자열인 Error)인지 가른다. 프로그래밍 오류(TypeError 등)는 I/O 실패로 삼키지 않는다.
function isFsError(error: unknown): error is Error {
  return error instanceof Error && typeof (error as { code?: unknown }).code === 'string';
}

/**
 * snapshot 파일 자리가 Git common dir 안쪽이고 파일 자체가 symlink가 아닌지 검사한다.
 * mkdir 전에도 호출되므로 아직 없는 하위 경로는 "가장 가까운 기존 조상"까지 거슬러 올라가
 * 그 realpath가 경계 안인지 본다 — 미존재 디렉터리를 이유로 바로 통과시키면 조상이 외부를
 * 가리키는 symlink일 때 recursive mkdir이 외부에 디렉터리를 만든다. realpath가 ENOENT인데
 * lstat은 성공하는 조상은 가리키는 곳이 없는(dangling) symlink이므로 안전하지 않다고 본다.
 * 경계 검사 중의 ENOENT 외 I/O 오류(EACCES 등)는 안전을 확인할 수 없으므로 false이고,
 * 프로그래밍 오류는 그대로 던진다.
 *
 * @param {string} commonGitDir - Git common dir
 * @param {string} file - workerSnapshotPath 결과
 * @param {SnapshotFs} [fsx] - 검사 seam. 없는 메서드는 node:fs로 fallback한다
 * @returns {boolean} 경계 안쪽이고 symlink가 아니면 true
 */
function snapshotLocationSafe(commonGitDir: string, file: string, fsx: SnapshotFs = fs): boolean {
  const realpath = fsx.realpathSync ?? fs.realpathSync;
  const lstat = fsx.lstatSync ?? fs.lstatSync;
  try {
    const base = realpath(commonGitDir);
    let dir = path.dirname(file);
    for (;;) {
      try {
        return isInsideReal(realpath(dir), base) && !lstatIsSymlink(lstat, file);
      } catch (error) {
        if (!isEnoentError(error)) throw error;
      }
      // realpath ENOENT: 진짜 없는 조상이면 한 칸 위로, lstat이 성공하면 dangling symlink라 거절.
      try {
        lstat(dir);
        return false;
      } catch (error) {
        if (!isEnoentError(error)) throw error;
      }
      const parent = path.dirname(dir);
      if (parent === dir) return false;
      dir = parent;
    }
  } catch (error) {
    if (isFsError(error)) return false;
    throw error;
  }
}

// 파일이 아직 없는 것(ENOENT)만 "첫 저장"으로 보아 symlink가 아니라고 답한다.
function lstatIsSymlink(lstat: (file: string) => { isSymbolicLink: () => boolean }, file: string): boolean {
  try {
    return lstat(file).isSymbolicLink();
  } catch (error) {
    if (isEnoentError(error)) return false;
    throw error;
  }
}

function isWorkerTotal(value: unknown): boolean {
  return isRecord(value) && Number.isSafeInteger(value.total) && Number.isSafeInteger(value.missing);
}

function isWorkerSnapshotFile(value: unknown, blueprint: string): value is WorkerSnapshotFile {
  if (!isRecord(value) || value.version !== 1 || value.blueprint !== blueprint
    || typeof value.recorded_at !== 'string'
    || typeof value.ledger_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.ledger_sha256)) return false;
  const tokens = value.worker_tokens;
  return isWorkerTotal(tokens) && isRecord((tokens as Record<string, unknown>).by_role)
    && WORKER_ROLES.every((r) => isWorkerTotal(((tokens as Record<string, unknown>).by_role as
      Record<string, unknown>)[r]))
    // 키가 있으면 모양이 맞아야 한다 — 틀린 drive_record는 복원값을 오염시키므로 거절한다.
    && (!Object.prototype.hasOwnProperty.call(value, 'drive_record') || isDriveRecord(value.drive_record));
}

/**
 * 저장된 worker 집계 snapshot을 읽는다. 파일 없음만 "snapshot 없음"이고, 경계 밖·symlink·
 * 깨진 JSON·다른 blueprint·모양 불일치는 `metrics-snapshot-invalid`다 — 복원값으로
 * 잘못된 숫자를 내느니 거절해야 한다.
 *
 * @param {object} opts - 읽기 입력
 * @param {string} opts.commonGitDir - Git common dir
 * @param {string} opts.blueprint - blueprint 경로
 * @param {SnapshotFs} [opts.fs] - 읽기 seam
 * @returns {{ok: true, snapshot: WorkerSnapshotFile | null} | Failure} snapshot 또는 거절
 */
function loadWorkerSnapshot(opts: { commonGitDir: string; blueprint: string; fs?: SnapshotFs }):
  { ok: true; snapshot: WorkerSnapshotFile | null } | Failure {
  const invalid: Failure = { ok: false, reason: 'metrics-snapshot-invalid' };
  const file = workerSnapshotPath(opts.commonGitDir, opts.blueprint);
  if (!snapshotLocationSafe(opts.commonGitDir, file, opts.fs)) return invalid;
  let raw: string;
  try {
    raw = (opts.fs ?? fs).readFileSync(file, 'utf8');
  } catch (error) {
    if (isEnoentError(error)) return { ok: true, snapshot: null };
    // EACCES·EISDIR 같은 읽기 오류는 값을 신뢰할 수 없으므로 던지지 않고 invalid로 접는다.
    if (isFsError(error)) return invalid;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    // SyntaxError만 온다. 깨진 파일은 invalid로 접는다.
    return invalid;
  }
  return isWorkerSnapshotFile(parsed, normalizeBlueprint(opts.blueprint))
    ? { ok: true, snapshot: parsed } : invalid;
}

// 이 호출이 방금 만든 temp를 지운다. 정리 실패(fs 오류)는 원래의 저장 실패 보고를 가리지 않도록
// 삼킨다: 남는 것은 우리 pid가 붙은 .tmp뿐이고 최종 snapshot은 건드리지 않는다.
function removeOwnTemporary(fsx: SnapshotFs, temporary: string): void {
  try {
    (fsx.unlinkSync ?? fs.unlinkSync)(temporary);
  } catch (error) {
    if (!isFsError(error)) throw error;
  }
}

/**
 * 실제 원장에서 worker 집계와 원장 SHA-256을 읽어 snapshot으로 atomic 저장한다.
 * 같은 원장 hash의 snapshot은 다시 쓰지 않고(`reused: true`), 새 원장이면 갱신한다.
 * 원장이 없으면 새 값을 만들지 않는다: 유효한 기존 snapshot은 그대로 보존해 돌려주고,
 * 둘 다 없으면 `metrics-ledger-unavailable`이다. 기존 snapshot이 깨졌으면 덮어쓰지 않고
 * `metrics-snapshot-invalid`로 거절한다. 경계 검사·snapshot 읽기의 I/O 오류도 invalid이고,
 * mkdir·temp 생성·쓰기·rename 실패는 `metrics-snapshot-write-failed`다.
 *
 * @param {object} opts - 저장 입력
 * @param {string} opts.commonGitDir - Git common dir
 * @param {string | null} opts.ledgerFile - integration 원장 경로. null이면 원장 없음
 * @param {string} opts.blueprint - blueprint 경로
 * @param {SnapshotFs} [opts.fs] - I/O seam(optional 메서드는 node:fs fallback)
 * @param {Clock} [opts.now] - 시계 seam
 * @param {DriveRecordReview | null} [opts.review] - blueprint 리뷰 요약. 새 snapshot의 drive_record.review에
 *   싣는다. 생략하면 null(예: `bouncer metrics snapshot`)
 * @returns {{ok: true, blueprint: string, path: string, ledger_sha256: string, reused: boolean} | Failure}
 *   저장(또는 재사용)된 snapshot 정보 또는 거절 사유
 */
function saveWorkerSnapshot(opts: {
  commonGitDir: string; ledgerFile: string | null; blueprint: string; fs?: SnapshotFs; now?: Clock;
  review?: DriveRecordReview | null;
}): { ok: true; blueprint: string; path: string; ledger_sha256: string; reused: boolean } | Failure {
  const fsx = opts.fs ?? fs;
  const blueprint = normalizeBlueprint(opts.blueprint);
  const file = workerSnapshotPath(opts.commonGitDir, blueprint);
  const existing = loadWorkerSnapshot({ commonGitDir: opts.commonGitDir, blueprint, fs: fsx });
  if (existing.ok === false) return existing;
  const ledger: LedgerRead = opts.ledgerFile === null
    ? { ok: true, snapshot: null, decisions: [] } : readLedgerSnapshot(opts.ledgerFile, fsx);
  if (ledger.ok === false) return ledger;
  if (ledger.snapshot === null) {
    if (existing.snapshot === null) return { ok: false, reason: 'metrics-ledger-unavailable' };
    return { ok: true, blueprint, path: file, ledger_sha256: existing.snapshot.ledger_sha256, reused: true };
  }
  const hash = ledger.snapshot.ledger_sha256;
  if (existing.snapshot !== null && existing.snapshot.ledger_sha256 === hash) {
    return { ok: true, blueprint, path: file, ledger_sha256: hash, reused: true };
  }
  const data: WorkerSnapshotFile = {
    version: 1, blueprint, recorded_at: (opts.now ?? (() => new Date()))().toISOString(),
    ledger_sha256: hash, worker_tokens: sumWorkerDecisions(ledger.decisions),
    // 정리 전에 실행 기록을 같은 원장에서 계산해 보존한다. 같은 hash의 기존 snapshot은 위에서
    // 다시 쓰지 않고 반환했으므로 drive_record 없는 오래된 snapshot은 갱신되지 않는다.
    drive_record: summarizeDriveRecord(ledger.ledger, opts.review ?? null),
  };
  const temporary = `${file}.${process.pid}.tmp`;
  const invalid: Failure = { ok: false, reason: 'metrics-snapshot-invalid' };
  const writeFailed: Failure = { ok: false, reason: 'metrics-snapshot-write-failed' };
  // 위 loadWorkerSnapshot이 mkdir 전에 기존 조상까지 경계를 검사했다. 여기서는 만들기만 한다.
  try {
    (fsx.mkdirSync ?? fs.mkdirSync)(path.dirname(file), { recursive: true });
  } catch (error) {
    // 디렉터리 생성 실패(EACCES·ENOSPC 등 fs 오류)만 저장 실패로 접는다. 프로그래밍 오류는 던진다.
    if (!isFsError(error)) throw error;
    return writeFailed;
  }
  // mkdir 뒤에 다시 검사한다: 검사와 mkdir 사이에 조상이 바뀌었다면 이제야 드러난다.
  if (!snapshotLocationSafe(opts.commonGitDir, file, fsx)) return invalid;
  try {
    // 'wx' 배타 생성: 예측 가능한 temp 자리에 누가 symlink·파일을 심어 두었더라도 따라 쓰지 않고
    // EEXIST로 실패한다. 이 경우 temp는 우리 것이 아니므로 지우지 않는다.
    fsx.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    if (!isFsError(error)) throw error;
    // 파일이 만들어진 뒤에만 생기는 오류(공간 부족 등)일 때만 자신의 부분 temp를 정리한다.
    if (['ENOSPC', 'EDQUOT', 'EIO', 'EFBIG'].includes((error as unknown as { code: string }).code)) {
      removeOwnTemporary(fsx, temporary);
    }
    return writeFailed;
  }
  try {
    fsx.renameSync(temporary, file);
  } catch (error) {
    if (!isFsError(error)) throw error;
    removeOwnTemporary(fsx, temporary);
    return writeFailed;
  }
  return { ok: true, blueprint, path: file, ledger_sha256: hash, reused: false };
}

/**
 * `coordinate status` checkpoint에 실을 같은 blueprint의 coordinator-session 요약.
 * status는 읽기 전용 관측이라 기록 파일이 없거나 깨져도 실패시키지 않고 빈 배열을 낸다.
 * 깨진 파일의 거절은 `metrics` 명령이 맡는다.
 *
 * @param {{file: string, blueprint: string}} opts - 기록 파일과 blueprint
 * @returns {object[]} `{id,label,started_at,ended_at,tasks_completed,exception_decisions,tokens}` 목록
 */
function listCoordinatorSessions(opts: { file: string; blueprint: string }): Array<{
  id: string; label: string | null; started_at: string; ended_at: string | null;
  tasks_completed: string[] | null; exception_decisions: number | null; tokens: number | null;
}> {
  const current = readMetrics(opts.file);
  if (current.ok === false) return [];
  const blueprint = normalizeBlueprint(opts.blueprint);
  return current.data.sessions
    .filter((s) => s.kind === 'coordinator-session' && s.blueprint === blueprint)
    .map((s) => ({
      id: s.id,
      label: s.label ?? null,
      started_at: s.started_at,
      ended_at: s.ended_at ?? null,
      tasks_completed: s.tasks_completed ?? null,
      exception_decisions: s.exception_decisions ?? null,
      tokens: s.tokens ?? null,
    }));
}

export = {
  EXCEPTION_KINDS, isException, metricsFilePath, startSession, endSession, summarize,
  listCoordinatorSessions, saveWorkerSnapshot, loadWorkerSnapshot, pendingWorkerTokenKeys,
  workerKeyState,
};
