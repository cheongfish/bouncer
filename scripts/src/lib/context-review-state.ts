'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

import guards = require('./guards');
const { isRecord } = guards;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import planSnapshot = require('./plan-snapshot');
const { computePlanSnapshot } = planSnapshot;
import paths = require('./paths');
const { toPosix } = paths;
import layout = require('./layout');
const { isCanonicalBlueprintDir } = layout;
import validateSections = require('./validate-sections');
const { REVIEW_SEVERITY } = validateSections;

// 계획 리뷰 cycle의 단일 writer. 전체 재시작을 누적 1회로 제한하고, 재시작이
// 이전 finding을 지우지 못하게 archive로 보관한다. 이 모듈은 context-review.md나
// execute review.md를 쓰지 않는다 — 기록 성공은 plan gate(G18) 통과가 아니다.

const RESTART_LIMIT = 1;
const REPORT_STATUS = ['requested', 'addressed', 'accepted'] as const;
// canonical context round 계약(discovery 또는 discovery→delta)과 같은 순서.
// validate-sections의 계약 상수는 비공개라 mode 순서만 여기 둔다.
const ROUND_MODES = ['discovery', 'delta'] as const;
const FINDING_STATUS = ['open', 'resolved', 'accepted'];
const FINDING_ACTIONABILITY = ['must_fix', 'advisory'];

type Fail = { ok: false; reason: string; cause: unknown; next: string };
type Ref = { path: string; sha256: string };
type ReportRef = {
  round: number;
  mode: string;
  status: string;
  path: string;
  sha256: string;
  dispatch: Ref;
  key: string;
};
type Finding = Record<string, unknown>;
type Cycle = {
  id: string;
  restart_count: 0 | 1;
  history: Array<Record<string, unknown>>;
  active_reports: ReportRef[];
  latest_dispatch: Ref;
};
type State = {
  version: 1;
  blueprint: string;
  cycle: Cycle;
  transitions: string[];
  closed: boolean;
  projection: { findings: Finding[]; rounds: unknown[] } | null;
};
type Dispatch = { sha256: string; digest: string; text: string };
type Legacy = { present: boolean; rounds: unknown[]; findings: Finding[]; digest: string | null };
type ReportInput = { text: string; round: Record<string, unknown>; findings: Finding[] };
type Ctx = { nsAbs: string; nsRel: string; bp: string };

function fail(reason: string, cause: unknown, next: string): Fail {
  return { ok: false, reason, cause, next };
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 같은 디렉터리 임시 파일에 쓴 뒤 rename으로 교체한다. rename 전에 죽어도
 * 기존 파일은 그대로이고, 실패하면 tmp를 지워 재시도가 깨진 바이트를 읽지 않게 한다.
 *
 * @param {string} abs - 최종 파일 절대 경로
 * @param {string} text - 쓸 본문
 * @returns {void}
 */
function writeAtomic(abs: string, text: string): void {
  const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, abs);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch (unlinkError) {
      // ENOENT만 흡수: write 단계에서 실패해 tmp가 없거나 rename이 이미 옮겼다.
      if (!isRecord(unlinkError) || unlinkError.code !== 'ENOENT') throw unlinkError;
    }
    throw error;
  }
}

/**
 * 내용 주소(sha256) 파일명으로 immutable 자료를 쓴다. 이미 있으면 같은 바이트이므로
 * 건너뛴다. 먼저 쓰고 state가 나중에 참조하므로, 이후 단계가 실패해도 남는 것은
 * 참조되지 않는 파일뿐이다.
 *
 * @param {string} abs - 저장 절대 경로
 * @param {string} text - 저장할 본문
 * @returns {void}
 */
function writeImmutable(abs: string, text: string): void {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  try {
    fs.writeFileSync(abs, text, { flag: 'wx' });
  } catch (error) {
    // EEXIST만 흡수: 파일명이 내용 해시라 이미 있는 파일은 같은 바이트다.
    if (!isRecord(error) || error.code !== 'EEXIST') throw error;
  }
}

/**
 * namespace 디렉터리를 repo 안에서만 해석한다. 구성요소마다 realpath를 보고
 * repo 밖을 가리키는 symlink를 만나면 아무것도 만들기 전에 null을 돌려준다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} relDir - repo 상대 POSIX 경로
 * @param {boolean} create - true면 없는 구성요소를 만든다
 * @returns {string | null} 절대 경로, repo 밖으로 나가면 null
 */
function resolveInsideRepo(repoRoot: string, relDir: string, create: boolean): string | null {
  const realRoot = fs.realpathSync(path.resolve(repoRoot));
  let cur = path.resolve(repoRoot);
  for (const seg of relDir.split('/')) {
    cur = path.join(cur, seg);
    let real: string;
    try {
      real = fs.realpathSync(cur);
    } catch (error) {
      // ENOENT만 흡수: 아직 없는 구성요소다. 읽기 호출은 없는 상태로 두고,
      // 쓰기 호출만 만든다. 그 외(EACCES 등)는 위장하지 않고 올린다.
      if (!isRecord(error) || error.code !== 'ENOENT') throw error;
      if (!create) return path.join(path.resolve(repoRoot), relDir);
      fs.mkdirSync(cur);
      real = fs.realpathSync(cur);
    }
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null;
  }
  return cur;
}

function targetInvalid(cause: unknown, next: string): Fail {
  return fail('context-review-target-invalid', cause, next);
}

/**
 * dispatch 파일을 읽어 blueprint·현재 snapshot·문서 집합과 대조한다.
 * skip·light·closed·다른 blueprint·stale digest는 모두 거절한다 — 오래된 payload로
 * 기록하면 이후 G18 신선도와 어긋난 보고가 cycle에 쌓인다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 POSIX 경로
 * @param {string} dispatchFile - review-dispatch plan 출력 JSON 파일
 * @returns {Dispatch | Fail} 검증된 payload 정보 또는 거절
 */
function loadDispatch(repoRoot: string, bp: string, dispatchFile: string): Dispatch | Fail {
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(dispatchFile);
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error),
      'pass --dispatch <review-dispatch plan JSON file>');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    // SyntaxError만 흡수. 그 외 throw는 호출부 버그다.
    if (!(error instanceof SyntaxError)) throw error;
    return fail('context-review-input-invalid', error.message, 'pass --dispatch <review-dispatch plan JSON file>');
  }
  const next = 'rerun review-dispatch plan --blueprint <dir> and pass its JSON';
  if (!isRecord(payload) || payload.ok !== true || payload.phase !== 'plan'
    || !isRecord(payload.target) || typeof payload.target.digest !== 'string'
    || !Array.isArray(payload.target.documents)) {
    return targetInvalid('dispatch is not a successful plan payload', next);
  }
  if (payload.strategy !== 'single' && payload.strategy !== 'clustered') {
    return targetInvalid(`strategy ${String(payload.strategy)} has no context review`, next);
  }
  if (payload.blueprint !== undefined && payload.blueprint !== bp) {
    return targetInvalid('dispatch belongs to another blueprint', next);
  }
  let indexData: unknown;
  try {
    indexData = readDoc(path.join(repoRoot, bp, 'index.md')).data;
  } catch (error) {
    // 문서 부재·파싱 실패는 같은 target-invalid로 묶되 원인 문구를 보존한다.
    return targetInvalid(error instanceof Error ? error.message : String(error), next);
  }
  const meta = isRecord(indexData) && isRecord(indexData.bouncer) ? indexData.bouncer : {};
  if (meta.status === 'closed') return targetInvalid('blueprint is closed', 'open a new blueprint');
  if (meta.scale === 'light') return targetInvalid('light blueprint skips context review', 'no review is needed');
  const snap = computePlanSnapshot({ repoRoot, blueprintDir: bp });
  if (!snap.ok) return targetInvalid(snap.error, next);
  if (snap.digest !== payload.target.digest
    || JSON.stringify(snap.documents) !== JSON.stringify(payload.target.documents)) {
    return targetInvalid(`dispatch is stale: ${payload.target.digest} != ${snap.digest}`, next);
  }
  return { sha256: sha256(bytes), digest: snap.digest, text: bytes.toString('utf8') };
}

function isFail(value: unknown): value is Fail {
  return isRecord(value) && value.ok === false;
}

/**
 * 같은 namespace의 배타 잠금 아래에서 fn을 실행한다. 잠금은 mkdir(원자적)이며
 * 이미 있으면 대기 없이 거절한다. 프로세스가 잠금 보유 중 죽으면 lock 디렉터리가
 * 남는다 — 자동 회수는 하지 않고(소유 확인 없는 회수는 동시 쓰기를 허용한다)
 * next 안내로 사람이 확인 후 지우게 한다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {() => T} fn - 잠금 안에서 실행할 전이
 * @returns {T | Fail} fn 결과 또는 잠금 거절
 */
function withLock<T>(ctx: Ctx, fn: () => T): T | Fail {
  const lock = path.join(ctx.nsAbs, 'lock');
  try {
    fs.mkdirSync(lock);
  } catch (error) {
    if (isRecord(error) && error.code === 'EEXIST') {
      return fail('context-review-state-conflict', 'another transition holds the lock',
        `retry later; if no other process runs, remove ${ctx.nsRel}/lock`);
    }
    throw error;
  }
  try {
    return fn();
  } finally {
    fs.rmdirSync(lock);
  }
}

/**
 * namespace 경로를 정한다. blueprint 경로가 canonical이 아니거나 namespace가 repo 밖을
 * 가리키면 어떤 디렉터리도 만들기 전에 거절한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - 입력 blueprint 경로
 * @param {boolean} create - 없는 디렉터리를 만들지 여부
 * @returns {Ctx | Fail} namespace 컨텍스트 또는 거절
 */
function openContext(repoRoot: string, blueprintDir: string, create: boolean): Ctx | Fail {
  const bp = toPosix(blueprintDir);
  if (bp.split('/').includes('..') || !isCanonicalBlueprintDir(bp)) {
    return targetInvalid(
      `not a canonical blueprint dir: ${blueprintDir}`,
      'pass --blueprint .bouncer/context/epics/<id>/blueprints/<id>',
    );
  }
  const nsRel = `.bouncer/runtime/context-review/${bp.split('/').join('__')}`;
  const nsAbs = resolveInsideRepo(repoRoot, nsRel, create);
  if (nsAbs === null) {
    return targetInvalid('runtime namespace escapes the repository', 'remove the symlink under .bouncer/runtime');
  }
  return { nsAbs, nsRel, bp };
}

function corrupt(cause: string): Fail {
  return fail('context-review-state-conflict', `corrupt state: ${cause}`,
    'restore state.json from backup; counters must not be reset by hand');
}

/**
 * state.json을 읽고 모양·한도·namespace 결속을 검사한다. restart_count와 history
 * 길이가 어긋나거나 참조 경로가 이 cycle 밖이면 손상으로 보고 모든 전이를 거절한다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @returns {State | null | Fail} 정상 state, 파일 없음이면 null, 손상이면 거절
 */
function loadState(ctx: Ctx): State | null | Fail {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(ctx.nsAbs, 'state.json'), 'utf8');
  } catch (error) {
    // ENOENT만 흡수: cycle이 아직 시작되지 않았다. 권한 오류를 "없음"으로 위장하지 않는다.
    if (isRecord(error) && error.code === 'ENOENT') return null;
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return corrupt(error.message);
  }
  if (!isRecord(parsed) || parsed.version !== 1 || parsed.blueprint !== ctx.bp
    || !isRecord(parsed.cycle) || !Array.isArray(parsed.transitions)
    || typeof parsed.closed !== 'boolean') {
    return corrupt('shape');
  }
  const c = parsed.cycle;
  if (typeof c.id !== 'string' || (c.restart_count !== 0 && c.restart_count !== 1)
    || !Array.isArray(c.history) || c.history.length !== c.restart_count
    || !Array.isArray(c.active_reports) || !isRecord(c.latest_dispatch)) {
    return corrupt('cycle');
  }
  const prefix = `${ctx.nsRel}/cycles/${c.id}/`;
  const reportDispatches = c.active_reports.map((r) => (isRecord(r) ? r.dispatch : null));
  const refs: unknown[] = [c.latest_dispatch, ...c.active_reports, ...reportDispatches];
  for (const ref of refs) {
    if (!isRecord(ref) || typeof ref.path !== 'string' || !ref.path.startsWith(prefix)
      || typeof ref.sha256 !== 'string') {
      return corrupt('reference outside cycle namespace');
    }
  }
  return parsed as State;
}

function saveState(ctx: Ctx, state: State): void {
  writeAtomic(path.join(ctx.nsAbs, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
}

function cyclePrefix(ctx: Ctx, id: string): string {
  return `${ctx.nsRel}/cycles/${id}`;
}

/** dispatch를 cycle namespace 아래에 immutable로 저장하고 참조를 돌려준다. */
function storeDispatch(repoRoot: string, ctx: Ctx, id: string, d: Dispatch): Ref {
  const rel = `${cyclePrefix(ctx, id)}/dispatch/${d.sha256}.json`;
  writeImmutable(path.join(repoRoot, rel), d.text);
  return { path: rel, sha256: d.sha256 };
}

/**
 * 저장된 자료를 읽고 sha256이 참조와 같은지 확인한다. 같은 cycle의 보고를 다시
 * 합칠 때 변조·유실을 조용히 넘기지 않기 위함.
 */
function readRef(repoRoot: string, ref: Ref): string | Fail {
  let text: string;
  try {
    text = fs.readFileSync(path.join(repoRoot, ref.path), 'utf8');
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return corrupt(`missing ${ref.path}`);
    throw error;
  }
  if (sha256(text) !== ref.sha256) return corrupt(`digest mismatch ${ref.path}`);
  return text;
}

/**
 * active 보고들을 읽어 round 객체와 ID별 최신 finding을 합친다. 같은 id는 뒤 보고가
 * 통째로 대체한다(처분 갱신). 입력 객체는 변형하지 않아 archive가 원본을 보존한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {ReportRef[]} reports - active 보고 참조
 * @returns {{ rounds: unknown[], findings: Finding[] } | Fail} 합성 결과 또는 손상 거절
 */
function foldReports(repoRoot: string, reports: ReportRef[]): { rounds: unknown[]; findings: Finding[] } | Fail {
  const rounds: unknown[] = [];
  const findings: Finding[] = [];
  for (const ref of reports) {
    const text = readRef(repoRoot, ref);
    if (isFail(text)) return text;
    const body = JSON.parse(text) as { round: unknown; findings: Finding[] };
    rounds.push(body.round);
    for (const f of body.findings) {
      const at = findings.findIndex((x) => x.id === f.id);
      if (at >= 0) findings[at] = f;
      else findings.push(f);
    }
  }
  return { rounds, findings };
}

function transitionKey(parts: Array<string | number>): string {
  return sha256(parts.join('\u0000'));
}

/**
 * context-review.md에 남은 기존(cycle 도입 전) 증거를 읽는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 경로
 * @returns {{ present: boolean, rounds: unknown[], findings: Finding[], digest: string | null } | Fail}
 *   rounds·findings가 비어 있으면 present false. digest는 마지막 round의 target.digest
 */
function readLegacy(repoRoot: string, bp: string): Legacy | Fail {
  const abs = path.join(repoRoot, bp, 'context-review.md');
  if (!fs.existsSync(abs)) return { present: false, rounds: [], findings: [], digest: null };
  let data: unknown;
  try {
    ({ data } = readDoc(abs));
  } catch (error) {
    return fail('context-review-legacy-evidence', error instanceof Error ? error.message : String(error),
      'fix context-review.md frontmatter, then retry');
  }
  const bouncer = isRecord(data) && isRecord(data.bouncer) ? data.bouncer : {};
  const cr = isRecord(bouncer.context_review) ? bouncer.context_review : {};
  const rounds = Array.isArray(cr.rounds) ? cr.rounds : [];
  const findings = (Array.isArray(cr.findings) ? cr.findings : []) as Finding[];
  let digest: string | null = null;
  for (const r of rounds) {
    if (isRecord(r) && isRecord(r.target) && typeof r.target.digest === 'string') digest = r.target.digest;
  }
  return { present: rounds.length > 0 || findings.length > 0, rounds, findings, digest };
}

function newCycleId(bp: string, dispatchSha: string): string {
  return `cr-${sha256(`${bp}\u0000${dispatchSha}`).slice(0, 16)}`;
}

/**
 * 새 cycle을 시작한다. 이미 state가 있으면 id와 횟수를 그대로 돌려주는 no-op이라
 * start를 반복해도 누적 재시작 횟수를 0으로 되돌릴 수 없다. 기존 context-review
 * 증거만 있고 state가 없으면 거절하고 restart로 가져오게 한다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - review-dispatch plan JSON 파일
 * @returns {object} 성공 `{ok:true,cycle,noop}`, 실패 `{ok:false,reason,cause,next}`
 */
function startCycle(input: { repoRoot: string; blueprintDir: string; dispatchFile: string }): Record<string, unknown> {
  const { repoRoot } = input;
  const probe = openContext(repoRoot, input.blueprintDir, false);
  if (isFail(probe)) return probe;
  // 쓰기 전에 payload를 먼저 검증한다: 거절된 start가 디렉터리를 남기지 않는다.
  const dispatch = loadDispatch(repoRoot, probe.bp, input.dispatchFile);
  if (isFail(dispatch)) return dispatch;
  const ctx = openContext(repoRoot, input.blueprintDir, true) as Ctx;
  return withLock(ctx, () => {
    const state = loadState(ctx);
    if (isFail(state)) return state;
    if (state) return { ok: true, noop: true, cycle: state.cycle };
    const legacy = readLegacy(repoRoot, ctx.bp);
    if (isFail(legacy)) return legacy;
    if (legacy.present) {
      return fail('context-review-legacy-evidence', 'context-review.md already holds review evidence',
        'run context-review restart with the previous payload to archive it; start cannot import');
    }
    const id = newCycleId(ctx.bp, dispatch.sha256);
    const created: State = {
      version: 1,
      blueprint: ctx.bp,
      cycle: {
        id,
        restart_count: 0,
        history: [],
        active_reports: [],
        latest_dispatch: storeDispatch(repoRoot, ctx, id, dispatch),
      },
      transitions: [],
      closed: false,
      projection: null,
    };
    saveState(ctx, created);
    return { ok: true, noop: false, cycle: created.cycle };
  }) as Record<string, unknown>;
}

/**
 * 보고 입력(`{round,findings}`)을 읽고 finding 모양을 검사한다. 미해결 처분(open)은
 * 진행 중 보고에만 허용되며 canonical 처분 enum은 여기서 늘리지 않는다.
 */
function readReportInput(roundFile: string): ReportInput | Fail {
  const next = 'fix --round JSON: object with round and findings array';
  let text: string;
  try {
    text = fs.readFileSync(roundFile, 'utf8');
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error), next);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return fail('context-review-input-invalid', error.message, next);
  }
  if (!isRecord(parsed) || !isRecord(parsed.round) || !Array.isArray(parsed.findings)) {
    return fail('context-review-input-invalid', 'expected { round: object, findings: array }', next);
  }
  for (const f of parsed.findings) {
    const ok = isRecord(f) && typeof f.id === 'string' && f.id !== ''
      && REVIEW_SEVERITY.includes(f.severity as string)
      && FINDING_STATUS.includes(f.status as string)
      && FINDING_ACTIONABILITY.includes(f.actionability as string);
    if (!ok) return fail('context-review-input-invalid', `malformed finding ${JSON.stringify(f)}`, next);
  }
  return { text, round: parsed.round, findings: parsed.findings as Finding[] };
}

/**
 * closure 투영을 만든다. resolved 또는 note 있는 accepted만 통과하고, must_fix
 * accepted는 사용자가 명시한 --accept-risk ID와 정확히 일치해야 한다.
 *
 * @param {Finding[]} findings - ID별 최신 처분
 * @param {string[]} acceptRisk - 명시 동의된 finding ID
 * @returns {Finding[] | Fail} 투영된 findings 또는 unresolved 거절
 */
function projectClosure(findings: Finding[], acceptRisk: string[]): Finding[] | Fail {
  const bad: string[] = [];
  const risky = new Set<string>();
  for (const f of findings) {
    const noted = typeof f.note === 'string' && f.note.trim() !== '';
    if (f.status === 'open') bad.push(`${String(f.id)} open`);
    else if (f.status === 'accepted' && !noted) bad.push(`${String(f.id)} accepted without note`);
    else if (f.status === 'accepted' && f.actionability === 'must_fix') {
      if (acceptRisk.includes(f.id as string)) risky.add(f.id as string);
      else bad.push(`${String(f.id)} must_fix accepted without --accept-risk`);
    }
  }
  for (const id of acceptRisk) {
    if (!risky.has(id)) bad.push(`--accept-risk ${id} is not an accepted must_fix finding`);
  }
  if (bad.length > 0) {
    return fail('context-review-unresolved-findings', bad,
      'resolve open findings or record explicit user-approved accepted-risk with note');
  }
  return findings;
}

/**
 * 리뷰어 보고 한 건과 dispatch를 cycle에 기록한다. 보고는 immutable 파일로 먼저 저장하고
 * state 교체(sibling tmp + rename)가 마지막이라, 어느 단계에서 실패해도 기존 state는
 * 유지된다. 같은 전이 키의 재요청은 no-op, 같은 round의 다른 입력은 충돌이다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - review-dispatch plan JSON 파일
 * @param {string} input.roundFile - `{round,findings}` JSON 파일
 * @param {string} [input.status] - requested|addressed|accepted(기본 requested). accepted는 closure
 * @param {string[]} [input.acceptRisk] - 사용자 동의가 있는 must_fix accepted ID
 * @returns {object} 성공 `{ok:true,noop,cycle,status,closed,projection?}`, 실패 `{ok:false,...}`
 */
function recordReport(input: {
  repoRoot: string; blueprintDir: string; dispatchFile: string; roundFile: string;
  status?: string | null; acceptRisk?: string[];
}): Record<string, unknown> {
  const { repoRoot } = input;
  const status = input.status || 'requested';
  if (!(REPORT_STATUS as readonly string[]).includes(status)) {
    return fail('context-review-input-invalid', `status ${status}`, 'use requested, addressed or accepted');
  }
  const acceptRisk = [...(input.acceptRisk || [])].sort();
  const ctx = openContext(repoRoot, input.blueprintDir, false);
  if (isFail(ctx)) return ctx;
  const report = readReportInput(input.roundFile);
  if (isFail(report)) return report;
  let dispatchBytes: Buffer;
  try {
    dispatchBytes = fs.readFileSync(input.dispatchFile);
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error),
      'pass --dispatch <review-dispatch plan JSON file>');
  }
  if (!fs.existsSync(path.join(ctx.nsAbs, 'state.json'))) {
    return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
  }
  return withLock(ctx, () => {
    const state = loadState(ctx);
    if (isFail(state)) return state;
    if (!state) return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    const cycle = state.cycle;
    const round = report.round.round;
    // 1. 전이 키: cycle·restart·round·dispatch·입력 digest(+처분 인자)를 묶는다.
    //    같은 키는 이미 적용된 전이라 no-op이며 dispatch가 그사이 stale이 되어도 거절하지 않는다.
    const key = transitionKey([cycle.id, cycle.restart_count, String(round), sha256(dispatchBytes),
      sha256(report.text), status, acceptRisk.join(',')]);
    if (state.transitions.includes(key)) {
      return {
        ok: true, noop: true, cycle, status, closed: state.closed,
        ...(state.projection ? { projection: state.projection } : {}),
      };
    }
    const dispatch = loadDispatch(repoRoot, ctx.bp, input.dispatchFile);
    if (isFail(dispatch)) return dispatch;
    if (state.closed) {
      return fail('context-review-state-conflict', 'cycle is already closed', 'restart only when the plan changed');
    }
    // 2. round 순서: discovery 또는 discovery→delta. 이미 있는 번호를 다른 입력이 노리면 충돌.
    const n = cycle.active_reports.length;
    if (Number.isInteger(round) && (round as number) >= 1 && (round as number) <= n) {
      return fail('context-review-state-conflict', `round ${String(round)} already recorded with different input`,
        'a transition is applied once; record the next round');
    }
    if (n >= ROUND_MODES.length || round !== n + 1 || report.round.mode !== ROUND_MODES[n]) {
      const want = ROUND_MODES[n] ?? 'none';
      return fail(
        'context-review-round-order',
        `expected round ${n + 1} mode ${want}, got round ${String(round)} mode ${String(report.round.mode)}`,
        n >= ROUND_MODES.length
          ? 'close with the recorded rounds or restart'
          : `record round ${n + 1} (${want})`,
      );
    }
    const reportTarget = report.round.target;
    if (isRecord(reportTarget) && reportTarget.digest !== undefined && reportTarget.digest !== dispatch.digest) {
      return targetInvalid(`round target.digest ${String(reportTarget.digest)} != dispatch ${dispatch.digest}`,
        'set round.target.digest to the dispatch target.digest');
    }
    // 3. 이전 보고와 합쳐 ID별 최신 처분을 만든다. closure면 projection 검사까지.
    const folded = foldReports(repoRoot, cycle.active_reports);
    if (isFail(folded)) return folded;
    const merged = [...folded.findings];
    for (const f of report.findings) {
      const at = merged.findIndex((x) => x.id === f.id);
      if (at >= 0) merged[at] = f;
      else merged.push(f);
    }
    let projection: State['projection'] = null;
    if (status === 'accepted') {
      const projected = projectClosure(merged, acceptRisk);
      if (isFail(projected)) return projected;
      projection = { findings: projected, rounds: [...folded.rounds, report.round] };
    }
    // 4. 쓰기: immutable 자료 → state 교체 순.
    const dispatchRef = storeDispatch(repoRoot, ctx, cycle.id, dispatch);
    const reportSha = sha256(report.text);
    const reportRel = `${cyclePrefix(ctx, cycle.id)}/r${cycle.restart_count}`
      + `/reports/${String(round)}-${reportSha.slice(0, 16)}.json`;
    writeImmutable(path.join(repoRoot, reportRel), report.text);
    const next: State = {
      ...state,
      cycle: {
        ...cycle,
        active_reports: [...cycle.active_reports, {
          round: round as number, mode: report.round.mode as string, status, path: reportRel,
          sha256: reportSha, dispatch: dispatchRef, key,
        }],
        latest_dispatch: dispatchRef,
      },
      transitions: [...state.transitions, key],
      closed: status === 'accepted',
      projection,
    };
    saveState(ctx, next);
    return {
      ok: true, noop: false, cycle: next.cycle, status, closed: next.closed,
      ...(projection ? { projection } : {}),
    };
  }) as Record<string, unknown>;
}

/**
 * cycle을 전체 재시작한다. 누적 1회만 허용하며 active 증거(rounds·findings·보고·dispatch)는
 * history로 보관한다. 직전 certified target과 현재 snapshot이 같으면 거절하고, delta 뒤
 * 미해결 must_fix가 있으면 restart로 해결을 우회하지 못하게 거절한다. state가 없고
 * context-review.md에 기존 증거가 있으면 그 증거를 archive로 가져오며 재시작 1회를 소비한다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - 새 snapshot의 review-dispatch plan JSON 파일
 * @param {string} input.reason - 재시작 사유(archive에 보관)
 * @returns {object} 성공 `{ok:true,noop,cycle}`, 실패 `{ok:false,...}`
 */
function restartCycle(input: {
  repoRoot: string; blueprintDir: string; dispatchFile: string; reason: string;
}): Record<string, unknown> {
  const { repoRoot, reason } = input;
  const probe = openContext(repoRoot, input.blueprintDir, false);
  if (isFail(probe)) return probe;
  let dispatchBytes: Buffer;
  try {
    dispatchBytes = fs.readFileSync(input.dispatchFile);
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error),
      'pass --dispatch <review-dispatch plan JSON file>');
  }
  const legacy = readLegacy(repoRoot, probe.bp);
  if (isFail(legacy)) return legacy;
  const hasState = fs.existsSync(path.join(probe.nsAbs, 'state.json'));
  if (!hasState && !legacy.present) {
    return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
  }
  const ctx = openContext(repoRoot, input.blueprintDir, true) as Ctx;
  return withLock(ctx, () => {
    const state = loadState(ctx);
    if (isFail(state)) return state;
    const dispatchSha = sha256(dispatchBytes);
    const priorId = state ? state.cycle.id : newCycleId(ctx.bp, dispatchSha);
    const key = transitionKey([priorId, 'restart', dispatchSha, reason]);
    if (state && state.transitions.includes(key)) return { ok: true, noop: true, cycle: state.cycle };
    if (state && state.cycle.restart_count >= RESTART_LIMIT) {
      return fail('context-review-restart-limit', `restart_count ${state.cycle.restart_count} of ${RESTART_LIMIT} used`,
        'continue the current cycle: record findings, resolve them, or ask the user; no further automatic restart');
    }
    const dispatch = loadDispatch(repoRoot, ctx.bp, input.dispatchFile);
    if (isFail(dispatch)) return dispatch;

    let archive: Record<string, unknown>;
    let base: State;
    if (state) {
      const folded = foldReports(repoRoot, state.cycle.active_reports);
      if (isFail(folded)) return folded;
      if (state.cycle.active_reports.length >= 2
        && folded.findings.some((f) => f.status === 'open' && f.actionability === 'must_fix')) {
        return fail('context-review-unresolved-findings', 'must_fix remains open after the delta round',
          'restart cannot resolve findings; fix them, accept with explicit user consent, or stop');
      }
      const latest = readRef(repoRoot, state.cycle.latest_dispatch);
      if (isFail(latest)) return latest;
      const previousDigest = (JSON.parse(latest) as { target: { digest: string } }).target.digest;
      if (previousDigest === dispatch.digest) {
        return fail('context-review-state-conflict', 'plan snapshot is unchanged since the last certified target',
          'restart only after the plan documents changed');
      }
      const dispatches = [...state.cycle.active_reports.map((r) => r.dispatch), state.cycle.latest_dispatch];
      archive = {
        restart_index: 1,
        reason,
        rounds: folded.rounds,
        findings: folded.findings,
        reports: state.cycle.active_reports,
        dispatches: dispatches.filter((d, i) => dispatches.findIndex((x) => x.sha256 === d.sha256) === i),
      };
      base = state;
    } else {
      // 기존 증거 import: 직전 certified digest가 없으면 stale 판정 근거가 없어 거절한다.
      if (legacy.digest === null) {
        return fail('context-review-legacy-evidence', 'context-review.md has no previous target.digest',
          'provide the previous review-dispatch payload digest (missing previous target); '
          + 'restart cannot prove the plan changed');
      }
      if (legacy.digest === dispatch.digest) {
        return fail('context-review-state-conflict', 'plan snapshot is unchanged since the last certified target',
          'restart only after the plan documents changed');
      }
      archive = {
        restart_index: 1,
        reason,
        legacy: true,
        rounds: legacy.rounds,
        findings: legacy.findings,
        reports: [],
        dispatches: [],
      };
      base = {
        version: 1, blueprint: ctx.bp, transitions: [], closed: false, projection: null,
        // 아직 저장되지 않는 임시 틀: 아래 next가 restart_count·latest_dispatch를 모두 덮어쓴다.
        cycle: {
          id: priorId, restart_count: 0, history: [], active_reports: [], latest_dispatch: { path: '', sha256: '' },
        },
      };
    }
    const dispatchRef = storeDispatch(repoRoot, ctx, base.cycle.id, dispatch);
    const next: State = {
      ...base,
      cycle: {
        id: base.cycle.id,
        restart_count: 1,
        history: [...base.cycle.history, archive],
        active_reports: [],
        latest_dispatch: dispatchRef,
      },
      transitions: [...base.transitions, key],
      closed: false,
      projection: null,
    };
    saveState(ctx, next);
    return { ok: true, noop: false, cycle: next.cycle };
  }) as Record<string, unknown>;
}

export = { startCycle, recordReport, restartCycle };
