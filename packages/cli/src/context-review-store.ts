'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

import guards = require('./guards');
const { isRecord } = guards;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import planSnapshot = require('./plan-snapshot');
import snapshotContract = require('./plan-snapshot-contract');
const { SNAPSHOT_VERSION } = snapshotContract;
const { computePlanSnapshot, computePlanParts } = planSnapshot;
import paths = require('./paths');
const { toPosix } = paths;
import layout = require('./layout');
const { isCanonicalBlueprintDir } = layout;
import schema = require('./schema');
const { planReviewContractOf, complexityOf, planPerspectivesOf } = schema;
import tasksDocs = require('./tasks-docs');
const { listTasksDocs, taskExecutionKind } = tasksDocs;

// 컨텍스트 리뷰의 디스크 접근만 모은다. cycle 재시작 한도·finding 판정은 여기 두지 않고
// context-review-state가 맡긴다. 전이는 이 모듈의 함수로만 읽고 쓴다.

// cycle id는 newCycleId가 만드는 형식 하나뿐이다. 경로 구성요소로 쓰이므로 그 밖은 손상이다.
const CYCLE_ID_RE = /^cr-[0-9a-f]{16}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
// 디스크 표식 restart_count의 허용 스칼라(0 또는 1). 전이의 재시작 한도 정책이 아니라
// YAML에 적힌 값의 모양이다.
const MARKER_VALUES = new Set([0, 1]);

import type { Fail, Ref, Finding, State, Dispatch, Legacy, Ctx }
  from './context-review-contracts';

function fail(reason: string, cause: unknown, next: string): Fail {
  return { ok: false, reason, cause, next };
}

function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** 쓰기 대상 경로에 symlink나 비정상 구성요소가 있을 때 던진다. 호출부가 Fail로 바꾼다. */
class UnsafePathError extends Error {}

/**
 * root 아래 dir까지 구성요소를 lstat로 훑는다. symlink이거나 디렉터리가 아니면 거부하고,
 * create면 없는 구성요소를 만든다. realpath 검사는 namespace 루트에서 끝나므로 그 아래
 * (cycles/<id>/dispatch 등)의 symlink 바꿔치기는 여기서 막는다.
 *
 * @param {string} root - 이미 repo 안으로 확인된 namespace 절대 경로
 * @param {string} dir - root 아래 디렉터리 절대 경로
 * @param {boolean} create - true면 없는 구성요소를 만든다
 * @returns {boolean} 끝까지 존재하면 true, create가 false이고 중간에 없으면 false
 */
function walkSafeDir(root: string, dir: string, create: boolean): boolean {
  const rel = path.relative(root, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new UnsafePathError(`path escapes namespace: ${dir}`);
  let cur = root;
  for (const seg of rel === '' ? [] : rel.split(path.sep)) {
    cur = path.join(cur, seg);
    let st;
    try {
      st = fs.lstatSync(cur);
    } catch (error) {
      // ENOENT만 흡수: 아직 없는 구성요소다. create면 만들고 아니면 "없음"으로 돌려준다.
      if (!isRecord(error) || error.code !== 'ENOENT') throw error;
      if (!create) return false;
      fs.mkdirSync(cur);
      continue;
    }
    if (st.isSymbolicLink() || !st.isDirectory()) throw new UnsafePathError(`not a plain directory (symlink?): ${cur}`);
  }
  return true;
}

/** abs가 있으면 symlink가 아닌 일반 파일인지 확인한다. 없으면 false. */
function isPlainFile(abs: string): boolean {
  let st;
  try {
    st = fs.lstatSync(abs);
  } catch (error) {
    // ENOENT만 흡수: 아직 없는 파일이다.
    if (!isRecord(error) || error.code !== 'ENOENT') throw error;
    return false;
  }
  if (st.isSymbolicLink() || !st.isFile()) throw new UnsafePathError(`refusing symlink or non-file target: ${abs}`);
  return true;
}

/**
 * 같은 디렉터리의 고유 임시 파일에 쓴 뒤 rename으로 교체한다. tmp는 'wx'로 열어
 * 미리 심어 둔 symlink·파일을 따라가지 않고 실패한다(닫힌 실패). 대상이 symlink여도
 * 거부한다. rename 전에 죽어도 기존 파일은 그대로이고, 우리가 만든 tmp만 지운다.
 *
 * @param {string} abs - 최종 파일 절대 경로
 * @param {string} text - 쓸 본문
 * @returns {void}
 */
function writeAtomic(abs: string, text: string): void {
  const existed = isPlainFile(abs);
  const mode = existed ? fs.statSync(abs).mode & 0o777 : 0o644;
  const tmp = path.join(path.dirname(abs),
    `.${path.basename(abs)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  // 열기 실패(EEXIST 등)는 우리가 만든 파일이 없으므로 정리 없이 그대로 올린다.
  const fd = fs.openSync(tmp, 'wx', mode);
  try {
    try {
      fs.writeFileSync(fd, text);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, abs);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch (unlinkError) {
      // ENOENT만 흡수: rename이 이미 옮겼다.
      if (!isRecord(unlinkError) || unlinkError.code !== 'ENOENT') throw unlinkError;
    }
    throw error;
  }
}

/**
 * 내용 주소(sha256) 파일명으로 immutable 자료를 쓴다. 상위 구성요소와 대상이 symlink이면
 * 거부하고, 이미 있는 파일은 같은 바이트일 때만 건너뛴다(다르면 변조·손상이다). 먼저 쓰고
 * state가 나중에 참조하므로, 이후 단계가 실패해도 남는 것은 참조되지 않는 파일뿐이다.
 *
 * @param {string} root - namespace 절대 경로(symlink 검사 시작점)
 * @param {string} abs - 저장 절대 경로
 * @param {string} text - 저장할 본문
 * @returns {void}
 */
function writeImmutable(root: string, abs: string, text: string): void {
  walkSafeDir(root, path.dirname(abs), true);
  try {
    fs.writeFileSync(abs, text, { flag: 'wx' });
  } catch (error) {
    // EEXIST만 흡수: 파일명이 내용 해시라 같은 바이트면 건너뛴다. 다르면 아래에서 거부한다.
    if (!isRecord(error) || error.code !== 'EEXIST') throw error;
    isPlainFile(abs);
    if (fs.readFileSync(abs, 'utf8') !== text) {
      throw new UnsafePathError(`existing immutable file differs from new content: ${abs}`);
    }
  }
}

/** 쓰기 구간의 UnsafePathError만 target-invalid Fail로 바꾼다. 다른 오류는 올린다. */
function guardWrites<T>(fn: () => T): T | Fail {
  try {
    return fn();
  } catch (error) {
    if (!(error instanceof UnsafePathError)) throw error;
    return targetInvalid(error.message, 'remove the symlink or altered file under .bouncer/runtime');
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

// complexity는 loadDispatch가 index.md에서 읽어 검증한 내부 값이다. 저장 payload(text)와
// 공개 CLI 출력에는 들어가지 않는다 — recordReport가 delta 관점을 고를 때만 쓴다.
type LoadedDispatch = Dispatch & { complexity: 'low' | 'standard' };

/**
 * commit task의 review_risk가 하나라도 있는지 본다. review-dispatch를 가져오면
 * 순환이 생기므로 listTasksDocs로 직접 읽는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 경로
 * @returns {boolean} 비어 있지 않은 review_risk가 있으면 true
 */
function commitTasksHaveReviewRisk(repoRoot: string, bp: string): boolean {
  const listing = listTasksDocs({ repoRoot, blueprintDir: bp });
  for (const entry of listing.entries) {
    let data: unknown;
    try {
      data = readDoc(path.join(repoRoot, entry.rel)).data;
    } catch (_error) {
      // 깨진 task는 snapshot 대조가 나중에 거절한다. 여기서 위험을 있다고 치면
      // 관점 목록이 어긋나 다른 거절 문구가 된다.
      continue;
    }
    if (taskExecutionKind(data) !== 'commit') continue;
    const bouncer = isRecord(data) && isRecord((data as { bouncer?: unknown }).bouncer)
      ? (data as { bouncer: Record<string, unknown> }).bouncer : {};
    const risk = bouncer.review_risk;
    if (Array.isArray(risk) && risk.length > 0) return true;
  }
  return false;
}

/**
 * dispatch 파일을 읽어 blueprint·현재 snapshot·문서 집합과 대조한다.
 * skip·light·closed·다른 blueprint·stale digest는 모두 거절한다 — 오래된 payload로
 * 기록하면 이후 review 신선도와 어긋난 보고가 cycle에 쌓인다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 POSIX 경로
 * @param {string} dispatchFile - review-dispatch plan 출력 JSON 파일
 * @returns {LoadedDispatch | Fail} 검증된 payload 정보(+내부 scale) 또는 거절
 */
function loadDispatch(repoRoot: string, bp: string, dispatchFile: string): LoadedDispatch | Fail {
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
  if (payload.strategy !== 'single' && payload.strategy !== 'clustered' && payload.strategy !== 'perspectives') {
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
  // 표식(review_contract: brief) blueprint는 perspectives dispatch만, 표식 없는 blueprint는
  // single/clustered만 받는다. 어긋난 payload를 받으면 record가 관점 집합을 대조할 기준이
  // 사라지고, 옛 계약의 저장 payload가 새 계약 blueprint에 섞인다.
  const marked = planReviewContractOf(meta) === 'brief';
  if (marked && payload.strategy !== 'perspectives') {
    return targetInvalid('review_contract brief requires a perspectives dispatch', next);
  }
  if (!marked && payload.strategy === 'perspectives') {
    // 표식 없는 blueprint에는 perspectives 전략이 존재하지 않던 계약이라 구형 cause를 유지한다.
    return targetInvalid('strategy perspectives has no context review', next);
  }
  // record가 round 관점을 대조하는 기준이 payload의 perspectives라서, 손으로 바꾼 목록이
  // 기준이 되지 못하게 complexity·review_risk가 정하는 값과 같아야 한다.
  const parsedComplexity = complexityOf(meta);
  if (parsedComplexity === null) {
    return targetInvalid('blueprint complexity invalid: expected low or standard', next);
  }
  if (marked) {
    const expected = planPerspectivesOf(parsedComplexity, commitTasksHaveReviewRisk(repoRoot, bp));
    if (!isDeepStrictEqual(payload.perspectives, expected)) {
      return targetInvalid(`dispatch perspectives differ from ${expected.join(',')}`, next);
    }
  }
  const snap = computePlanSnapshot({ repoRoot, blueprintDir: bp });
  if (!snap.ok) return targetInvalid(snap.error, next);
  if (snap.digest !== payload.target.digest
    || JSON.stringify(snap.documents) !== JSON.stringify(payload.target.documents)) {
    return targetInvalid(`dispatch is stale: ${payload.target.digest} != ${snap.digest}`, next);
  }
  // 새로 기록하는 dispatch는 v2여야 한다. snapshot_version이 없는 digest-only payload는
  // 새 digest 알고리즘과 맞지 않아 위 digest 대조에서 이미 stale로 걸리지만, 우연히 맞는
  // 경우에도 내용 없는 payload를 cycle 증거로 저장하지 않도록 형식을 따로 거절한다.
  if (payload.snapshot_version !== SNAPSHOT_VERSION) {
    return targetInvalid(
      `dispatch snapshot_version ${String(payload.snapshot_version)} is not ${SNAPSHOT_VERSION}`, next);
  }
  // payload가 실어 온 parts·scope_parts·structure_parts·documents_content는 믿지 않는다:
  // 현재 blueprint에서 다시 계산해 같아야 한다. 위조된 문서별 digest나 before/after 내용으로
  // follow_up 판정과 reviewer 입력이 흔들리지 못하게 한다.
  const partSnap = computePlanParts({ repoRoot, blueprintDir: bp });
  if (!partSnap.ok) return targetInvalid(partSnap.error, next);
  if (!isDeepStrictEqual(payload.parts, partSnap.parts)
    || !isDeepStrictEqual(payload.scope_parts, partSnap.scope_parts)
    || !isDeepStrictEqual(payload.structure_parts, partSnap.structure_parts)
    || !isDeepStrictEqual(payload.documents_content, partSnap.documents_content)) {
    return targetInvalid('dispatch parts/content differ from the current blueprint', next);
  }
  return {
    sha256: sha256(bytes), digest: snap.digest, text: bytes.toString('utf8'),
    complexity: parsedComplexity,
  };
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
  const statePath = path.join(ctx.nsAbs, 'state.json');
  let raw: string;
  try {
    if (!isPlainFile(statePath)) return null;
    raw = fs.readFileSync(statePath, 'utf8');
  } catch (error) {
    if (error instanceof UnsafePathError) return corrupt(error.message);
    // 권한 오류 등을 "없음"으로 위장하지 않고 코드를 보존한 손상으로 알린다.
    if (isRecord(error) && typeof error.code === 'string') return corrupt(`state unreadable: ${error.code}`);
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
  // closure는 선택 필드다. 존재하면 형상과 dispositions 참조를 검증한다.
  if (parsed.closure !== undefined) {
    if (!isRecord(parsed.closure)
      || (parsed.closure.dispositions !== undefined && !isRecord(parsed.closure.dispositions))
      || !Array.isArray(parsed.closure.accept_risk)
      || !parsed.closure.accept_risk.every((x) => typeof x === 'string')) {
      return corrupt('closure shape');
    }
    // 손상된 digest를 현재 내용으로 대체 인증하지 않는다: 형식이 틀리면 state 손상이다.
    const digest = parsed.closure.closure_target_digest;
    if (digest !== undefined && (typeof digest !== 'string' || !SHA256_RE.test(digest))) {
      return corrupt('closure digest shape');
    }
  }
  const c = parsed.cycle;
  if (typeof c.id !== 'string' || !CYCLE_ID_RE.test(c.id)
    || (c.restart_count !== 0 && c.restart_count !== 1)
    || !Array.isArray(c.history) || c.history.length !== c.restart_count
    || !Array.isArray(c.active_reports) || !isRecord(c.latest_dispatch)) {
    return corrupt('cycle');
  }
  const prefix = `${ctx.nsRel}/cycles/${c.id}/`;
  const reportDispatches = c.active_reports.map((r) => (isRecord(r) ? r.dispatch : null));
  const refs: unknown[] = [c.latest_dispatch, ...c.active_reports, ...reportDispatches];
  if (parsed.closure && isRecord(parsed.closure) && isRecord(parsed.closure.dispositions)) {
    refs.push(parsed.closure.dispositions);
  }
  for (const ref of refs) {
    // 정규화된 POSIX 상대 경로만 인정한다: `..`·`.`·빈 구간·절대 경로는 prefix 검사를 우회한다.
    const ok = isRecord(ref) && typeof ref.path === 'string' && ref.path.startsWith(prefix)
      && ref.path.length > prefix.length && path.posix.normalize(ref.path) === ref.path
      && !ref.path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
      && typeof ref.sha256 === 'string' && SHA256_RE.test(ref.sha256);
    if (!ok) return corrupt('reference outside cycle namespace');
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
  writeImmutable(ctx.nsAbs, path.join(repoRoot, rel), d.text);
  return { path: rel, sha256: d.sha256 };
}

/**
 * 저장된 자료를 읽고 sha256이 참조와 같은지 확인한다. 같은 cycle의 보고를 다시
 * 합칠 때 변조·유실을 조용히 넘기지 않기 위함.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {string} repoRoot - 저장소 루트
 * @param {Ref} ref - 저장된 파일 참조
 * @returns {string | Fail} 파일 본문 또는 손상 거절
 */
function readRef(ctx: Ctx, repoRoot: string, ref: Ref): string | Fail {
  let text: string;
  const abs = path.join(repoRoot, ref.path);
  try {
    // 읽기도 symlink를 따라가지 않는다: 구성요소가 바뀌었으면 내용이 같아도 손상으로 본다.
    if (!walkSafeDir(ctx.nsAbs, path.dirname(abs), false) || !isPlainFile(abs)) return corrupt(`missing ${ref.path}`);
    text = fs.readFileSync(abs, 'utf8');
  } catch (error) {
    if (error instanceof UnsafePathError) return corrupt(error.message);
    if (isRecord(error) && error.code === 'ENOENT') return corrupt(`missing ${ref.path}`);
    throw error;
  }
  if (sha256(text) !== ref.sha256) return corrupt(`digest mismatch ${ref.path}`);
  return text;
}

function transitionKey(parts: Array<string | number>): string {
  return sha256(parts.join('\u0000'));
}

/**
 * context-review.md에 남은 기존(cycle 도입 전) 증거를 읽는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 경로
 * @returns {Legacy | Fail} rounds·findings가 비어 있으면 present false.
 *   digest는 마지막 round의 target.digest
 */
function readLegacy(repoRoot: string, bp: string): Legacy | Fail {
  const abs = path.join(repoRoot, bp, 'context-review.md');
  if (!fs.existsSync(abs)) return { present: false, rounds: [], findings: [], digest: null, marker: 0 };
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
  const rawMarker = cr.restart_count;
  if (rawMarker !== undefined && !MARKER_VALUES.has(rawMarker as number)) {
    return fail('context-review-legacy-evidence', `restart_count marker ${JSON.stringify(rawMarker)} is invalid`,
      'restart_count must be 0 or 1; restore context-review.md from version control');
  }
  return {
    present: rounds.length > 0 || findings.length > 0, rounds, findings, digest,
    marker: typeof rawMarker === 'number' ? rawMarker : 0,
  };
}

/**
 * 목록 한 줄에 들어갈 값의 줄바꿈을 공백으로 접는다. 줄바꿈이 남으면 한 finding이 여러 줄로 갈라진다.
 * LF뿐 아니라 CR·CRLF도 줄 경계로 읽히므로 함께 접는다(`\r`만 있는 값도 마찬가지).
 *
 * @param {unknown} value - 접을 값
 * @returns {string} 한 줄 문자열
 */
function oneLine(value: unknown): string {
  return String(value).replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

/**
 * namespace의 state.json 존재만 본다. loadState의 모양 검증·symlink 거부와 달리
 * existsSync를 그대로 써서, 깨졌거나 symlink여도 "있다"로 보고 호출부가 loadState·legacy
 * 분기를 타게 한다 — 전이 거절 순서를 바꾸지 않으려면 존재만 봐야 한다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @returns {boolean} state.json 경로가 존재하면 true
 */
function cycleStateExists(ctx: Ctx): boolean {
  return fs.existsSync(path.join(ctx.nsAbs, 'state.json'));
}

/**
 * 전이 입력 파일(dispatch·round·dispositions)을 바이트로 읽는다. 해석과 거절 reason은
 * 호출부가 맡는다 — 같은 읽기를 여러 전이가 공유하고 next 문구만 다르기 때문이다.
 *
 * @param {string} abs - 입력 파일 절대 경로
 * @returns {Buffer} 파일 바이트
 */
function readInputFile(abs: string): Buffer {
  return fs.readFileSync(abs);
}

/**
 * 투영 문서(context-review.md) 존재만 본다. 생성·패치 여부는 호출부가 정한다.
 *
 * @param {string} abs - 문서 절대 경로
 * @returns {boolean} 파일이 있으면 true
 */
function projectionDocExists(abs: string): boolean {
  return fs.existsSync(abs);
}

/**
 * 투영 문서 원문을 읽는다. YAML 패치·렌더는 전이 쪽이 맡는다.
 *
 * @param {string} abs - 문서 절대 경로
 * @returns {string} UTF-8 본문
 */
function readProjectionText(abs: string): string {
  return fs.readFileSync(abs, 'utf8');
}

/**
 * review-dispatch가 쓰는 읽기 전용 조회. state.json과 latest_dispatch 저장본을 loadState와 같은
 * 검증(id 형식·정규화 경로·sha256·symlink 거부)으로 읽는다. 아무것도 만들거나 쓰지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {object} state가 없으면 `{ok:true,state:null}`, 있으면 `{ok:true,state,payload}`
 *   (payload는 저장된 latest_dispatch JSON), 검증 실패는 `{ok:false,cause}`
 */
function readStoredLatest(repoRoot: string, blueprintDir: string):
  { ok: true; state: null } | { ok: true; state: State; payload: unknown } | { ok: false; cause: string } {
  const ctx = openContext(repoRoot, blueprintDir, false);
  if (isFail(ctx)) return { ok: false, cause: String(ctx.cause) };
  const state = loadState(ctx);
  if (isFail(state)) return { ok: false, cause: String(state.cause) };
  if (state === null) return { ok: true, state: null };
  const text = readRef(ctx, repoRoot, state.cycle.latest_dispatch);
  if (isFail(text)) return { ok: false, cause: String(text.cause) };
  try {
    return { ok: true, state, payload: JSON.parse(text) as unknown };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, cause: 'stored latest_dispatch is not JSON' };
  }
}

/** context-review.md 증거(rounds·findings·restart_count 표식)를 읽는 읽기 전용 조회. */
function readLegacyEvidence(repoRoot: string, bp: string):
  { ok: true; present: boolean; digest: string | null; marker: number } | { ok: false; cause: string } {
  const legacy = readLegacy(repoRoot, bp);
  if (isFail(legacy)) return { ok: false, cause: String(legacy.cause) };
  return { ok: true, present: legacy.present, digest: legacy.digest, marker: legacy.marker };
}

export = {
  fail, sha256, targetInvalid, isFail, corrupt, transitionKey, oneLine,
  writeAtomic, writeImmutable, guardWrites,
  loadDispatch, withLock, openContext, loadState, saveState, cyclePrefix, storeDispatch,
  readRef, readLegacy, readStoredLatest, readLegacyEvidence,
  cycleStateExists, readInputFile, projectionDocExists, readProjectionText,
};
