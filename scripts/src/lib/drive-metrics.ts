'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
import guards = require('./guards');
const { isRecord, isEnoentError } = guards;

/**
 * drive 계측 기록(`.bouncer/runtime/drive-metrics.json`)의 읽기·쓰기·요약.
 *
 * 원칙: 호스트가 준 값만 기록한다. 토큰·시간·비용을 추정해 채우지 않고, 얻지 못한 값은
 * `null`과 사유 문자열로 남겨 합계가 누락을 0으로 세지 않게 한다. 원장은 읽기만 하며
 * 기록 파일 쓰기는 임시 파일 뒤 rename이다.
 */

const SESSION_KINDS = ['coordinator-session', 'context-review'] as const;
type SessionKind = typeof SESSION_KINDS[number];

// 이 kind의 decision, 또는 outcome이 accepted가 아닌 report는 "예외 판단"이다.
const EXCEPTION_KINDS = new Set([
  'stale-report', 'stale-lease', 'repair', 'supplement', 'rerecord',
  'critical-recovery', 'fanin-verification-failed', 'revoke',
]);

type LedgerSnapshot = { decisions: number; completed_tasks: string[]; ledger_sha256: string };
type MetricsSession = {
  id: string;
  kind: SessionKind;
  blueprint: string;
  label: string | null;
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
      && typeof s.kind === 'string' && typeof s.blueprint === 'string')) {
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
  | { ok: true; snapshot: LedgerSnapshot | null; decisions: unknown[] }
  | Failure;

/**
 * 원장의 진행 snapshot을 읽는다. 원장은 읽기만 한다. 원장이 아직 없으면 snapshot은 null이고,
 * 깨진 원장은 진행 차이를 추정하지 않고 `metrics-ledger-invalid`로 거절한다.
 *
 * @param {string} ledgerFile - integration worktree의 coordinator.json 경로
 * @returns {LedgerRead} snapshot과 decision 배열, 또는 거절
 */
function readLedgerSnapshot(ledgerFile: string): LedgerRead {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(ledgerFile);
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
 * @param {string} opts.kind - `coordinator-session` | `context-review`
 * @param {string} opts.blueprint - blueprint 디렉터리
 * @param {string} [opts.label] - 세션 라벨(context-review는 perspective)
 * @param {string} [opts.targetDigest] - context-review 필수 64 hex
 * @param {Clock} [opts.now] - 테스트 seam. 기본 현재 시각
 * @param {() => string} [opts.randomId] - 테스트 seam. 16 hex를 돌려준다
 * @returns {{ok: true, id: string} | Failure} 새 세션 id 또는 거절 사유
 */
function startSession(opts: {
  file: string; ledgerFile: string; kind: string; blueprint: string;
  label?: string; targetDigest?: string; now?: Clock; randomId?: () => string;
}): { ok: true; id: string } | Failure {
  const now = opts.now ?? (() => new Date());
  const randomId = opts.randomId ?? (() => randomBytes(8).toString('hex'));
  const invalid: Failure = { ok: false, reason: 'invalid-metrics-input' };
  if (!(SESSION_KINDS as readonly string[]).includes(opts.kind)
    || typeof opts.blueprint !== 'string' || opts.blueprint === '') return invalid;
  const kind = opts.kind as SessionKind;
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
    blueprint: normalizeBlueprint(opts.blueprint),
    label: opts.label ?? null,
    started_at: now().toISOString(),
    ended_at: null,
  };
  if (isReview) {
    session.target_digest = opts.targetDigest;
  } else {
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
 * @param {string} [opts.model] - 모델 slug
 * @param {number} [opts.hostDurationMs] - 호스트가 준 소요 시간
 * @param {PricingTable | null} opts.pricing - 단가 표. 깨진 설정이면 null
 * @param {Clock} [opts.now] - 테스트 seam
 * @returns {{ok: true} | Failure} 성공 또는 거절 사유
 */
function endSession(opts: {
  file: string; resolveLedger: (blueprint: string) => string | null; id: string; tokens?: number;
  inputTokens?: number;
  outputTokens?: number; model?: string; hostDurationMs?: number;
  pricing: PricingTable | null; now?: Clock;
}): { ok: true; id: string } | Failure {
  const now = opts.now ?? (() => new Date());
  const current = readMetrics(opts.file);
  if (current.ok === false) return current;
  const session = current.data.sessions.find((s) => s.id === opts.id);
  if (!session) return { ok: false, reason: 'metrics-session-not-found' };
  if (session.ended_at !== null) return { ok: false, reason: 'metrics-session-ended' };

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
  const cost = computeCost(session.model, session.input_tokens, session.output_tokens, opts.pricing);
  session.cost = cost.cost;
  if (cost.reason !== undefined) session.cost_unavailable_reason = cost.reason;

  if (session.kind === 'coordinator-session') {
    const ledgerFile = opts.resolveLedger(session.blueprint);
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

type KindSummary = {
  sessions: number; open: number; tokens_total: number; tokens_missing: number;
  wall_ms_total: number; cost_total: number; cost_missing: number; tasks_completed?: number;
};

/**
 * blueprint의 kind별 합계. 끝난 세션만 토큰·시간·비용에 합산하고, `null`은 합에서 빼
 * 누락 수로 따로 센다. 0으로 세면 측정하지 못한 세션이 값이 0인 세션처럼 읽힌다.
 *
 * @param {{file: string, blueprint: string}} opts - 기록 파일과 blueprint
 * @returns {{ok: true, blueprint: string, kinds: Record<string, KindSummary>} | Failure} 합계 또는 거절
 */
function summarize(opts: { file: string; blueprint: string }):
  { ok: true; blueprint: string; kinds: Record<string, KindSummary> } | Failure {
  const current = readMetrics(opts.file);
  if (current.ok === false) return current;
  const blueprint = normalizeBlueprint(opts.blueprint);
  const kinds: Record<string, KindSummary> = {};
  for (const kind of SESSION_KINDS) {
    kinds[kind] = {
      sessions: 0, open: 0, tokens_total: 0, tokens_missing: 0,
      wall_ms_total: 0, cost_total: 0, cost_missing: 0,
    };
    if (kind === 'coordinator-session') kinds[kind].tasks_completed = 0;
  }
  for (const s of current.data.sessions) {
    if (s.blueprint !== blueprint || !Object.hasOwn(kinds, s.kind)) continue;
    const sum = kinds[s.kind];
    sum.sessions += 1;
    if (s.ended_at === null) {
      sum.open += 1;
      continue;
    }
    if (typeof s.tokens === 'number') sum.tokens_total += s.tokens; else sum.tokens_missing += 1;
    if (typeof s.cost === 'number') sum.cost_total += s.cost; else sum.cost_missing += 1;
    sum.wall_ms_total += s.wall_ms ?? 0;
    if (sum.tasks_completed !== undefined && Array.isArray(s.tasks_completed)) {
      sum.tasks_completed += s.tasks_completed.length;
    }
  }
  return { ok: true, blueprint, kinds };
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
  listCoordinatorSessions,
};
