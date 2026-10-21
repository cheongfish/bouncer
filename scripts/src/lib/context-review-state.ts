'use strict';

const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

import guards = require('./guards');
const { isRecord } = guards;
import frontmatter = require('./frontmatter');
const { readDoc, parseFrontmatter } = frontmatter;
import render = require('./render');
const { renderDoc } = render;
import planSnapshot = require('./plan-snapshot');
const { computePlanSnapshot, computePlanParts } = planSnapshot;
import scaffold = require('./scaffold');
const { scaffoldContextReview } = scaffold;
import validateSections = require('./validate-sections');
const {
  REVIEW_SEVERITY, CONTEXT_REVIEW_STATUS, FINDING_ACTIONABILITY,
  REPORT_FINDING_STATUS: FINDING_STATUS, CONTEXT_ROUND_MODES: ROUND_MODES,
  CONTEXT_REPORT_STATUS: REPORT_STATUS, collectFindingFailures, normalizeFinding, normalizeRoundFindings,
} = validateSections;
import store = require('./context-review-store');
const {
  fail, sha256, targetInvalid, isFail, corrupt, transitionKey, oneLine,
  writeAtomic, writeImmutable, guardWrites,
  loadDispatch, withLock, openContext, loadState, saveState, cyclePrefix, storeDispatch,
  readRef, readLegacy, readStoredLatest, readLegacyEvidence,
  cycleStateExists, readInputFile, projectionDocExists, readProjectionText,
} = store;

// 계획 리뷰 cycle의 단일 writer. 전체 재시작을 누적 1회로 제한하고, 재시작이
// 이전 finding을 지우지 못하게 archive로 보관한다. cycle을 닫는 전이(close, record --status accepted)만
// context-review.md에 투영을 기록하고 execute review.md는 쓰지 않는다. 기록 성공이 곧 plan gate(G18)
// 전체 통과는 아니다(다른 문서와 신선도는 게이트가 본다).

const RESTART_LIMIT = 1;
// 아래 타입은 저장 계층과 같은 모양이다. 전이가 store 반환값을 그대로 받으므로
// 필드를 여기서만 바꾸면 loadState 결과와 어긋난다.

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
// closure_target_digest: close·accepted record가 인증한 계획 snapshot digest(64 lowercase hex).
// G18이 마지막 round digest보다 먼저 비교하는 값이다. 이 필드가 없는 과거 state는 round digest로 폴백한다.
// dispositions는 close 전이만 남긴다 — accepted record는 처분 파일 없이 round 보고로 닫기 때문이다.
type Closure = { dispositions?: Ref; accept_risk: string[]; closure_target_digest?: string };
type State = {
  version: 1;
  blueprint: string;
  cycle: Cycle;
  transitions: string[];
  closed: boolean;
  closure?: Closure;
  projection: { findings: Finding[]; rounds: unknown[] } | null;
};
type Dispatch = { sha256: string; digest: string; text: string };
type Legacy = {
  present: boolean; rounds: unknown[]; findings: Finding[]; digest: string | null;
  // context-review.md frontmatter의 restart_count 표식(없으면 0). runtime state가 지워져도
  // 누적 재시작 횟수가 되돌려지지 않게 하는 하한이다.
  marker: number;
};
type ReportInput = { text: string; round: Record<string, unknown>; findings: Finding[] };
type Ctx = { nsAbs: string; nsRel: string; bp: string };

/**
 * active 보고들을 읽어 round 객체와 ID별 최신 finding을 합친다. 같은 id는 뒤 보고가
 * 통째로 대체한다(처분 갱신). 입력 객체는 변형하지 않아 archive가 원본을 보존한다.
 * 각 finding은 합치기 전에 정규화한다(fingerprint 공식 덮어쓰기, 생략 id는 `CR-<8hex>`).
 * immutable 보고 원문·sha는 그대로 두고 파생 결과에서만 고쳐, 과거에 틀린 fingerprint로
 * 기록된 보고도 close·projection에서 복구된다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {string} repoRoot - 저장소 루트
 * @param {ReportRef[]} reports - active 보고 참조
 * @returns {{ rounds: unknown[], findings: Finding[] } | Fail} 합성 결과 또는 손상 거절
 */
function foldReports(
  ctx: Ctx, repoRoot: string, reports: ReportRef[],
): { rounds: unknown[]; findings: Finding[] } | Fail {
  const rounds: unknown[] = [];
  const findings: Finding[] = [];
  for (const ref of reports) {
    const text = readRef(ctx, repoRoot, ref);
    if (isFail(text)) return text;
    const body = JSON.parse(text) as { round: unknown; findings: Finding[] };
    rounds.push(body.round);
    for (const raw of body.findings) {
      const f = normalizeFinding(raw, 'context') as Finding;
      const at = findings.findIndex((x) => x.id === f.id);
      if (at >= 0) findings[at] = f;
      else findings.push(f);
    }
  }
  return { rounds, findings };
}

/**
 * restart_count 표식을 반영한 context-review.md 새 본문을 만든다(쓰지는 않는다). 파일이 없으면
 * 표준 scaffold로 먼저 만든다. frontmatter의 `context_review:` 아래 한 키만 최소 패치하고,
 * 파싱한 결과가 "원본 + 표식 하나"와 정확히 같을 때만 통과해 다른 바이트·키를 건드리지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 경로
 * @param {number} count - 기록할 restart_count
 * @returns {{ abs: string, text: string } | Fail} 쓸 파일과 본문, 패치 불가면 거절
 */
function prepareMarker(repoRoot: string, bp: string, count: number): { abs: string; text: string } | Fail {
  const abs = path.join(repoRoot, bp, 'context-review.md');
  const unsupported = (cause: string) => fail('context-review-legacy-evidence', cause,
    'keep context-review.md frontmatter in the standard two-space YAML layout, then retry');
  if (!projectionDocExists(abs)) {
    try {
      scaffoldContextReview({ repoRoot, blueprintDir: bp, timestamp: new Date().toISOString() });
    } catch (error) {
      // scaffold가 던지는 Error(닫힌 blueprint·id 도출 실패)만 거절로 바꾼다.
      if (!(error instanceof Error)) throw error;
      return unsupported(`cannot create context-review.md: ${error.message}`);
    }
  }
  const original = readProjectionText(abs);
  const match = /^---\n([\s\S]*?)\n---(\n|$)/.exec(original);
  if (!match) return unsupported('context-review.md has no frontmatter block');
  const lines = match[1].split('\n');
  const at = lines.findIndex((l) => /^ {2}context_review:\s*$/.test(l));
  if (at < 0) return unsupported('bouncer.context_review block not found in block style');
  let end = at + 1;
  while (end < lines.length && /^ {3,}\S|^\s*$/.test(lines[end])) end += 1;
  const keyAt = lines.slice(at + 1, end).findIndex((l) => /^ {4}restart_count:/.test(l));
  if (keyAt >= 0) lines[at + 1 + keyAt] = `    restart_count: ${count}`;
  else lines.splice(at + 1, 0, `    restart_count: ${count}`);
  const text = `---\n${lines.join('\n')}\n---${original.slice(match[0].length - match[2].length)}`;
  let before: unknown;
  let after: unknown;
  try {
    before = readDoc(abs).data;
    after = frontmatter.parseFrontmatter(text).data;
  } catch (error) {
    return unsupported(error instanceof Error ? error.message : String(error));
  }
  const expected: unknown = JSON.parse(JSON.stringify(before));
  if (!isRecord(expected) || !isRecord(expected.bouncer) || !isRecord(expected.bouncer.context_review)) {
    return unsupported('bouncer.context_review is not a mapping');
  }
  expected.bouncer.context_review.restart_count = count;
  if (!isDeepStrictEqual(after, expected)) return unsupported('marker patch would change other frontmatter content');
  return { abs, text };
}

// context-review.md `## Findings` 절 제목. validate-sections의 REVIEW_SECTION_DEFS(G18이 읽는 정의)와
// 같은 별칭을 받아야 재작성한 절을 게이트가 같은 절로 인식한다.
const FINDINGS_HEADING_RE = /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i;
// plan 스킬이 print dispatch 실패 증거로 `## Findings`에 적는 줄의 접두. 재작성 때 보존한다.
const INLINE_EVIDENCE_PREFIX = '- inline context review:';

/**
 * 투영 finding 목록을 `## Findings` 본문 줄로 만든다. 없으면 `- none` 한 줄이다.
 * G18은 목록 내용을 보지 않지만 사람이 읽는 증적이라 finding마다 한 줄씩 남긴다.
 *
 * @param {Finding[]} findings - 닫힌 cycle의 projection.findings
 * @returns {string[]} 목록 줄들
 */
function findingLines(findings: Finding[]): string[] {
  if (findings.length === 0) return ['- none'];
  return findings.map((f) => {
    const note = f.note === undefined || f.note === null ? '' : oneLine(f.note);
    return `- ${oneLine(f.id)} (${oneLine(f.severity)}, ${oneLine(f.actionability)}, ${oneLine(f.status)}): `
      + `${oneLine(f.brief_clause)}${note === '' ? '' : ` — ${note}`}`;
  });
}

/**
 * 본문의 `## Findings` 절만 생성 목록으로 바꾼다. 절 안의 `- inline context review:` 줄은
 * 원래 순서로 목록 앞에 남기고, 절 밖 바이트와 절 끝의 빈 줄은 그대로 둔다. 절이 없으면
 * 본문 끝에 새로 붙인다(G18이 제목 존재를 요구하므로 문서가 이 절 없이 닫히면 안 된다).
 * 이미 생성된 절에 다시 적용해도 결과가 같아 재실행이 멱등이다.
 *
 * @param {string} body - frontmatter 뒤 본문
 * @param {string[]} generated - findingLines 결과
 * @returns {string} 새 본문
 */
function rewriteFindingsSection(body: string, generated: string[]): string {
  const lines = body.split('\n');
  const heading = lines.findIndex((l) => FINDINGS_HEADING_RE.test(l.trim()));
  if (heading < 0) {
    const sep = body === '' || body.endsWith('\n\n') ? '' : (body.endsWith('\n') ? '\n' : '\n\n');
    return `${body}${sep}## Findings\n${generated.join('\n')}\n`;
  }
  let end = lines.findIndex((l, i) => i > heading && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const section = lines.slice(heading + 1, end);
  // 절 끝의 빈 줄(다음 절과의 간격, 파일 끝 개행)은 원문 그대로 되돌려 절 밖 바이트를 지킨다.
  let keep = section.length;
  while (keep > 0 && section[keep - 1].trim() === '') keep -= 1;
  const trailing = section.slice(keep);
  const inline = section.slice(0, keep).filter((l) => l.startsWith(INLINE_EVIDENCE_PREFIX));
  return [...lines.slice(0, heading + 1), ...inline, ...generated, ...trailing, ...lines.slice(end)].join('\n');
}

/**
 * 닫힌 cycle의 projection을 반영한 context-review.md 새 본문을 만든다(쓰지는 않는다).
 * 호출부는 state를 바꾸기 전에 이 함수를 먼저 불러, 문서 부재·깨진 frontmatter·렌더 검증
 * 실패를 쓰기 전에 거절한다. bouncer.status와 context_review.{rounds,findings}만 바꾸고
 * restart_count 등 다른 키는 파싱 값 그대로 두며, 직렬화는 renderDoc을 쓴다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 POSIX 경로
 * @param {{ findings: Finding[]; rounds: unknown[] }} projection - 닫힌 cycle의 투영
 * @param {string} [closureTargetDigest] - 인증한 snapshot digest. 있으면 frontmatter에 기록한다
 * @returns {{ abs: string, text: string, rel: string } | Fail} 쓸 파일·본문·저장소 상대 경로, 또는 거절
 */
function prepareClosureDoc(
  repoRoot: string, bp: string, projection: { findings: Finding[]; rounds: unknown[] },
  closureTargetDigest?: string,
): { abs: string; text: string; rel: string } | Fail {
  const rel = `${bp}/context-review.md`;
  const abs = path.join(repoRoot, bp, 'context-review.md');
  if (!projectionDocExists(abs)) {
    return targetInvalid(`${rel} not found`, `bouncer scaffold context-review --blueprint ${bp}`);
  }
  let parsed: { data: unknown; body: string };
  try {
    parsed = parseFrontmatter(readProjectionText(abs));
  } catch (error) {
    // 파싱 오류(Error)만 legacy-evidence로 바꾼다. readLegacy와 같은 거절이다.
    if (!(error instanceof Error)) throw error;
    return fail('context-review-legacy-evidence', error.message, 'fix context-review.md frontmatter, then retry');
  }
  const data: Record<string, unknown> = isRecord(parsed.data)
    ? JSON.parse(JSON.stringify(parsed.data)) : {};
  if (!isRecord(data.bouncer)) data.bouncer = {};
  const bouncer = data.bouncer as Record<string, unknown>;
  const cr: Record<string, unknown> = isRecord(bouncer.context_review) ? bouncer.context_review : {};
  bouncer.status = 'accepted';
  cr.rounds = JSON.parse(JSON.stringify(projection.rounds));
  cr.findings = JSON.parse(JSON.stringify(projection.findings));
  // runtime closure와 같은 값을 frontmatter에 투영한다. 과거 closed state는 digest가 없으므로
  // 그 경우 기존 값을 건드리지 않아 G18이 round digest 폴백으로 판정하게 둔다.
  if (closureTargetDigest !== undefined) cr.closure_target_digest = closureTargetDigest;
  bouncer.context_review = cr;
  const body = rewriteFindingsSection(parsed.body, findingLines(projection.findings));
  const messages = collectFindingFailures({
    body, findings: cr.findings, rounds: cr.rounds, sectionLabel: 'context-review',
    findingLabel: 'context-review', allowedStatuses: CONTEXT_REVIEW_STATUS, namespace: 'context',
  });
  if (messages.length > 0) {
    return fail('context-review-input-invalid', messages,
      'fix the recorded round and finding fields so they pass the context-review format, then retry');
  }
  return { abs, text: renderDoc(data, body), rel };
}

/**
 * 병합된 finding 목록에서 둘 이상이 공유하는 fingerprint를 처음 나온 순서로 돌려준다.
 * collectFindingFailures를 통째로 부르면 round·본문 검사 메시지가 섞이므로 중복만 센다.
 * fingerprint가 문자열이 아닌 finding은 건너뛴다(형식 오류는 close 시점 검사가 맡는다).
 *
 * @param {Array<{fingerprint?: unknown}>} findings 이전 round와 합친 finding
 * @returns {string[]} 중복된 fingerprint
 */
function duplicateFingerprints(findings: Array<{ fingerprint?: unknown }>): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const f of findings) {
    if (typeof f.fingerprint !== 'string') continue;
    if (seen.has(f.fingerprint)) dup.add(f.fingerprint);
    seen.add(f.fingerprint);
  }
  return [...dup];
}

/**
 * 이번 입력 finding의 정규화 id를 입력 순서로 중복 없이 돌려준다. noop 응답도 첫 적용과
 * 같은 값을 내야 하므로 fold 없이 finding 하나씩 정규화해 계산한다(id는 결정적이다).
 *
 * @param {Finding[]} findings - 이번 round 입력 findings(readReportInput 통과분)
 * @returns {string[]} 정규화 id 목록
 */
function inputFindingIds(findings: Finding[]): string[] {
  const ids: string[] = [];
  for (const f of findings) {
    const id = (normalizeFinding(f, 'context') as Finding).id as string;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * 저장된 projection의 finding을 정규화한 사본을 만든다. 정규화 도입 전에 닫힌 state는
 * 틀린 fingerprint를 projection에 담고 있을 수 있어, noop 재실행이 문서를 다시 쓸 때
 * 그대로 쓰면 형식 검증에서 막힌다. state.json 자체는 고치지 않는다(파생 값만 복구).
 *
 * @param {{ findings: Finding[]; rounds: unknown[] }} projection - state에 저장된 projection
 * @returns {{ findings: Finding[]; rounds: unknown[] }} findings만 정규화한 사본
 */
function normalizeProjection(
  projection: { findings: Finding[]; rounds: unknown[] },
): { findings: Finding[]; rounds: unknown[] } {
  return { ...projection, findings: projection.findings.map((f) => normalizeFinding(f, 'context') as Finding) };
}

/**
 * 표식과 state를 대조한다(잠금 안에서 호출). 표식이 state보다 크면 state가 지워졌거나 낮춰진
 * 것이라 거절하고, state가 표식보다 크면 직전 restart가 표식 쓰기 전에 죽은 것이므로 여기서
 * 표식을 채운다. 표식을 낮추는 경로는 없다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {string} repoRoot - 저장소 루트
 * @param {State} state - 검증된 state
 * @param {Legacy} legacy - 같은 시점에 읽은 context-review.md 증거
 * @returns {Fail | null} 불일치 거절, 정상이면 null
 */
function reconcileMarker(ctx: Ctx, repoRoot: string, state: State, legacy: Legacy): Fail | null {
  if (legacy.marker > state.cycle.restart_count) {
    return corrupt(`restart_count marker ${legacy.marker} exceeds state ${state.cycle.restart_count}`);
  }
  if (legacy.marker < state.cycle.restart_count) {
    const prepared = prepareMarker(repoRoot, ctx.bp, state.cycle.restart_count);
    if (isFail(prepared)) return prepared;
    const written = guardWrites(() => writeAtomic(prepared.abs, prepared.text));
    if (isFail(written)) return written;
  }
  return null;
}

/** state.json이 없는데 표식이 남아 있을 때의 거절. 새 cycle로 횟수를 되돌리지 못하게 한다. */
function markerWithoutState(marker: number): Fail {
  return fail('context-review-state-conflict',
    `restart_count marker ${marker} exists in context-review.md but state.json is missing`,
    'restore state.json from backup; counters must not be reset by hand');
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
    const legacy = readLegacy(repoRoot, ctx.bp);
    if (isFail(legacy)) return legacy;
    if (state) {
      const mismatch = reconcileMarker(ctx, repoRoot, state, legacy);
      if (mismatch) return mismatch;
      return { ok: true, noop: true, cycle: state.cycle };
    }
    // 표식이 있는데 state가 없으면 runtime을 지워 새 cycle로 한도를 되돌리려는 경로다.
    if (legacy.marker >= 1) return markerWithoutState(legacy.marker);
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
        latest_dispatch: { path: '', sha256: '' },
      },
      transitions: [],
      closed: false,
      projection: null,
    };
    const stored = guardWrites(() => {
      created.cycle.latest_dispatch = storeDispatch(repoRoot, ctx, id, dispatch);
      saveState(ctx, created);
    });
    if (isFail(stored)) return stored;
    return { ok: true, noop: false, cycle: created.cycle };
  }) as Record<string, unknown>;
}

/**
 * 보고 입력(`{round,findings}`)을 읽고 finding 모양을 검사한다. 미해결 처분(open)은
 * 진행 중 보고에만 허용되며 canonical 처분 enum은 여기서 늘리지 않는다.
 * `id` 키 생략은 자동 id 대상이라 통과하지만, 명시한 id는 비어 있지 않은 문자열이어야 한다
 * (null·빈 문자열·공백·비문자열은 작성 실수로 보고 거절한다).
 */
function readReportInput(roundFile: string): ReportInput | Fail {
  const next = 'fix --round JSON: object with round and findings array';
  let text: string;
  try {
    text = readInputFile(roundFile).toString('utf8');
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
    const ok = isRecord(f)
      && (!Object.prototype.hasOwnProperty.call(f, 'id') || (typeof f.id === 'string' && f.id.trim() !== ''))
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
  // 통과한 finding 중 사용자 동의가 명시된 accepted must_fix에만 accepted_risk: true 표식을 붙인다.
  // 사람이 손으로 붙인 값은 배제하고 CLI projection에서만 부여해 G18 판정에 넘긴다.
  return findings.map((f) => {
    if (f.status === 'accepted' && f.actionability === 'must_fix' && risky.has(f.id as string)) {
      return { ...f, accepted_risk: true };
    }
    return { ...f };
  });
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
  if (!REPORT_STATUS.includes(status)) {
    return fail('context-review-input-invalid', `status ${status}`, 'use requested, addressed or accepted');
  }
  const acceptRisk = [...(input.acceptRisk || [])].sort();
  const ctx = openContext(repoRoot, input.blueprintDir, false);
  if (isFail(ctx)) return ctx;
  const report = readReportInput(input.roundFile);
  if (isFail(report)) return report;
  let dispatchBytes: Buffer;
  try {
    dispatchBytes = readInputFile(input.dispatchFile);
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error),
      'pass --dispatch <review-dispatch plan JSON file>');
  }
  if (!cycleStateExists(ctx)) {
    const evidence = readLegacy(repoRoot, ctx.bp);
    if (isFail(evidence)) return evidence;
    if (evidence.marker >= 1) return markerWithoutState(evidence.marker);
    return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
  }
  return withLock(ctx, () => {
    const state = loadState(ctx);
    if (isFail(state)) return state;
    if (!state) return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    const evidence = readLegacy(repoRoot, ctx.bp);
    if (isFail(evidence)) return evidence;
    const mismatch = reconcileMarker(ctx, repoRoot, state, evidence);
    if (mismatch) return mismatch;
    const cycle = state.cycle;
    const round = report.round.round;
    // 1. 전이 키: cycle·restart·round·dispatch·입력 digest(+처분 인자)를 묶는다.
    //    같은 키는 이미 적용된 전이라 no-op이며 dispatch가 그사이 stale이 되어도 거절하지 않는다.
    const key = transitionKey([cycle.id, cycle.restart_count, String(round), sha256(dispatchBytes),
      sha256(report.text), status, acceptRisk.join(',')]);
    if (state.transitions.includes(key)) {
      // 닫는 전이의 재실행은 문서를 투영 상태로 되돌려 쓴다: 첫 성공 뒤 문서가 바뀌었거나
      // state 저장 뒤 문서 쓰기가 실패했어도 같은 입력의 재실행이 복구한다.
      let written: string | undefined;
      const projection = state.projection ? normalizeProjection(state.projection) : null;
      if (status === 'accepted' && projection) {
        const doc = prepareClosureDoc(repoRoot, ctx.bp, projection, state.closure?.closure_target_digest);
        if (isFail(doc)) return doc;
        const wrote = guardWrites(() => writeAtomic(doc.abs, doc.text));
        if (isFail(wrote)) return wrote;
        written = doc.rel;
      }
      return {
        ok: true, noop: true, cycle, status, closed: state.closed,
        finding_ids: inputFindingIds(report.findings),
        ...(projection ? { projection } : {}),
        ...(written ? { written } : {}),
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
    const folded = foldReports(ctx, repoRoot, cycle.active_reports);
    if (isFail(folded)) return folded;
    // 3-1. 입력도 같은 공식으로 정규화한다(fingerprint 덮어쓰기·생략 id 생성). 명시 id 오류와
    //      자동 id 충돌은 merge 전에 거절해 다른 finding을 덮어쓰지 않게 한다. 보고 원문(report.text)과
    //      그 sha·전이 키는 입력 바이트 그대로 두고, 정규화는 fold가 읽을 때마다 다시 적용된다.
    const normalized = normalizeRoundFindings(report.findings, folded.findings, 'context');
    if (!normalized.ok) {
      return fail('context-review-input-invalid', normalized.messages,
        'give each finding a non-empty string id or omit the id key; resolve id collisions, then retry');
    }
    const incoming = normalized.findings as Finding[];
    const merged = [...folded.findings];
    for (const f of incoming) {
      const at = merged.findIndex((x) => x.id === f.id);
      if (at >= 0) merged[at] = f;
      else merged.push(f);
    }
    // 중복 fingerprint는 status와 무관하게 쓰기 전에 거부한다. accepted 때만 막으면 중복이 requested/addressed
    // record를 통과한 뒤 close에서야 막혀, 같은 round를 다시 기록할 수 없고 restart만 남기 때문이다.
    const duplicates = duplicateFingerprints(merged);
    if (duplicates.length > 0) {
      return fail('context-review-input-invalid',
        duplicates.map((fp) => `context-review duplicate fingerprint ${fp}`),
        'merge the findings sharing a fingerprint into one and record the same round again');
    }
    let projection: State['projection'] = null;
    let closureDoc: ReturnType<typeof prepareClosureDoc> | null = null;
    if (status === 'accepted') {
      const projected = projectClosure(merged, acceptRisk);
      if (isFail(projected)) return projected;
      projection = { findings: projected, rounds: [...folded.rounds, report.round] };
      // state를 바꾸기 전에 문서를 렌더·검증한다: 부재·검증 실패 거절이 아무것도 남기지 않는다.
      // accepted record는 round target과 같다고 검증된 dispatch.digest를 인증 대상으로 쓴다.
      closureDoc = prepareClosureDoc(repoRoot, ctx.bp, projection, dispatch.digest);
      if (isFail(closureDoc)) return closureDoc;
    }
    // 4. 쓰기: immutable 자료 → state 교체 순.
    const reportSha = sha256(report.text);
    const reportRel = `${cyclePrefix(ctx, cycle.id)}/r${cycle.restart_count}`
      + `/reports/${String(round)}-${reportSha.slice(0, 16)}.json`;
    let dispatchRef: Ref = { path: '', sha256: '' };
    const stored = guardWrites(() => {
      dispatchRef = storeDispatch(repoRoot, ctx, cycle.id, dispatch);
      writeImmutable(ctx.nsAbs, path.join(repoRoot, reportRel), report.text);
    });
    if (isFail(stored)) return stored;
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
      ...(status === 'accepted'
        ? { closure: { accept_risk: acceptRisk, closure_target_digest: dispatch.digest } }
        : {}),
      projection,
    };
    const saved = guardWrites(() => saveState(ctx, next));
    if (isFail(saved)) return saved;
    // 문서는 state 저장 뒤에 쓴다. 쓰기가 실패해도 같은 입력의 재실행(noop 경로)이 복구한다.
    if (closureDoc && !isFail(closureDoc)) {
      const doc = closureDoc;
      const wrote = guardWrites(() => writeAtomic(doc.abs, doc.text));
      if (isFail(wrote)) return wrote;
    }
    // 병합 후보 경고는 noop이 아닌 이번 기록의 round 입력만 대상으로 한다(추가 I/O 없음).
    const warnings = validateSections.findingMergeCandidates(incoming);
    return {
      ok: true, noop: false, cycle: next.cycle, status, closed: next.closed, finding_ids: normalized.ids,
      ...(warnings.length > 0 ? { warnings } : {}),
      ...(projection ? { projection } : {}),
      ...(closureDoc && !isFail(closureDoc) ? { written: closureDoc.rel } : {}),
    };
  }) as Record<string, unknown>;
}

/**
 * 마지막 round 뒤 남은 finding 처분을 사용자 동의(--accept-risk·note)와 함께 기록해 cycle을 닫는다.
 * 닫힌 cycle은 restart할 수 있고, accepted-risk must_fix는 G18에서 미해결로 세지 않는다.
 * dispositions를 immutable 파일로 먼저 저장하고 state 교체가 마지막이라, 어느 단계에서
 * 실패해도 기존 state는 유지된다. 같은 전이 키의 재요청은 no-op이다.
 *
 * @param {object} input - 입력 객체
 * @param {string} input.repoRoot - 저장소 루트 절대 경로
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispositionsFile - [{ id, status, note }] JSON 파일 경로
 * @param {string[]} [input.acceptRisk] - 사용자 동의가 있는 must_fix accepted ID 목록
 * @returns {Record<string, unknown>} 성공 {ok:true,noop,cycle,status,closed,projection}, 실패 {ok:false,...}
 */
function closeCycle(input: {
  repoRoot: string; blueprintDir: string; dispositionsFile: string; acceptRisk?: string[];
}): Record<string, unknown> {
  const { repoRoot } = input;
  // 중복을 제거하고 정렬해 전이 키와 closure 원장의 결정론적 형식을 보장한다.
  const acceptRisk = Array.from(new Set(input.acceptRisk || [])).sort();
  const ctx = openContext(repoRoot, input.blueprintDir, false);
  if (isFail(ctx)) return ctx;

  let dispBytes: Buffer;
  let rawText: string;
  try {
    dispBytes = readInputFile(input.dispositionsFile);
    rawText = dispBytes.toString('utf8');
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error),
      'pass --dispositions <json-file>');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return fail('context-review-input-invalid', error.message, 'pass valid dispositions JSON array');
  }

  if (!Array.isArray(parsed)) {
    return fail('context-review-input-invalid', 'dispositions must be a JSON array',
      'pass an array of { id, status, note }');
  }

  if (!cycleStateExists(ctx)) {
    const evidence = readLegacy(repoRoot, ctx.bp);
    if (isFail(evidence)) return evidence;
    if (evidence.marker >= 1) return markerWithoutState(evidence.marker);
    return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
  }

  return withLock(ctx, () => {
    const state = loadState(ctx);
    if (isFail(state)) return state;
    if (!state) return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    const evidence = readLegacy(repoRoot, ctx.bp);
    if (isFail(evidence)) return evidence;
    const mismatch = reconcileMarker(ctx, repoRoot, state, evidence);
    if (mismatch) return mismatch;
    const cycle = state.cycle;

    // 0. 인증 대상: 지금 디스크의 계획 snapshot. close는 dispatch를 받지 않으므로 현재 내용이 곧 대상이다.
    const snap = computePlanSnapshot({ repoRoot, blueprintDir: ctx.bp });
    if (!snap.ok) return targetInvalid(snap.error, 'fix the plan documents, then retry close');

    // 1. 전이 키: cycle id, restart count, 'close', dispositions 원본 바이트 sha256, 정렬된 accept-risk,
    //    인증 대상 digest. digest를 넣어야 닫힌 뒤 본문을 고친 재close가 같은 처분 파일로도
    //    no-op으로 삼켜지지 않는다.
    const key = transitionKey([cycle.id, cycle.restart_count, 'close', sha256(dispBytes), acceptRisk.join(','),
      snap.digest]);
    if (state.transitions.includes(key)) {
      // 이미 반영된 close 전이이므로 closure 결과(status: 'accepted')를 돌려주되, 문서는
      // 투영 상태로 다시 쓴다(첫 성공 뒤 변경·쓰기 실패 복구).
      // 저장 projection은 정규화 전 기록일 수 있어 파생 사본을 정규화해 쓴다.
      let written: string | undefined;
      const projection = state.projection ? normalizeProjection(state.projection) : null;
      if (projection) {
        const doc = prepareClosureDoc(repoRoot, ctx.bp, projection, snap.digest);
        if (isFail(doc)) return doc;
        const wrote = guardWrites(() => writeAtomic(doc.abs, doc.text));
        if (isFail(wrote)) return wrote;
        written = doc.rel;
      }
      return {
        ok: true, noop: true, cycle, status: 'accepted', closed: state.closed,
        ...(projection ? { projection } : {}),
        ...(written ? { written } : {}),
      };
    }

    // 2. 상태 충돌 검사: 아직 기록된 round가 없으면 거절. 이미 닫힌 cycle은 인증한 digest와
    //    현재 snapshot이 같을 때만 거절한다 — 다르면 본문 수정 뒤 재close 후보다(3-1에서 계약 대조).
    const latestText = readRef(ctx, repoRoot, cycle.latest_dispatch);
    if (isFail(latestText)) return latestText;
    const baseline = JSON.parse(latestText) as Record<string, unknown>;
    const baselineTarget = isRecord(baseline.target) ? baseline.target : {};
    const certified = state.closure?.closure_target_digest ?? baselineTarget.digest;
    if (state.closed && certified === snap.digest) {
      return fail('context-review-state-conflict', 'cycle is already closed', 'restart only when the plan changed');
    }
    if (cycle.active_reports.length === 0) {
      return fail('context-review-state-conflict', 'no round has been recorded in this cycle',
        'record at least one round before close');
    }
    // 2-1. 구조·계약 대조: 리뷰한 baseline과 digest가 다르면 문서 집합·structure_parts·scope_parts가
    //      모두 같은 본문 수정만 인증한다. 다른 변경은 route의 delta/restart 몫이다.
    if (baselineTarget.digest !== snap.digest) {
      const parts = computePlanParts({ repoRoot, blueprintDir: ctx.bp });
      if (!parts.ok) return targetInvalid(parts.error, 'fix the plan documents, then retry close');
      if (!sameStructureAndScope(baseline, { documents: snap.documents, ...parts })) {
        return fail('context-review-state-conflict',
          'plan structure or contract differs from the reviewed baseline; close cannot certify it',
          'run context-review route with a fresh review-dispatch plan: delta for an Interface/Touch change, '
          + 'restart for a structure change');
      }
    }

    // 3. active 보고들을 fold하여 기존 finding 목록을 취합한다
    const folded = foldReports(ctx, repoRoot, cycle.active_reports);
    if (isFail(folded)) return folded;

    // 4. dispositions 항목 유효성 검사 및 합성. folded는 이미 정규화돼 있어 처분은 정규화 후 id에
    //    적용된다(생략 id로 기록한 finding도 `CR-<8hex>`로 지정한다).
    const seenIds = new Set<string>();
    const merged = folded.findings.map((f) => ({ ...f }));
    for (const item of parsed) {
      if (!isRecord(item) || typeof item.id !== 'string') {
        return fail('context-review-input-invalid', 'disposition item missing valid id',
          'each disposition must be an object with string id');
      }
      if (seenIds.has(item.id)) {
        return fail('context-review-input-invalid', `duplicate disposition id ${item.id}`,
          'each finding id must appear at most once in dispositions');
      }
      seenIds.add(item.id);
      const targetIndex = merged.findIndex((f) => f.id === item.id);
      if (targetIndex < 0) {
        return fail('context-review-input-invalid', `finding id ${item.id} not found in recorded findings`,
          'only dispose recorded findings');
      }
      if (!CONTEXT_REVIEW_STATUS.includes(item.status as string)) {
        return fail('context-review-input-invalid', `disposition status ${String(item.status)} invalid`,
          'disposition status must be resolved or accepted');
      }
      merged[targetIndex] = {
        ...merged[targetIndex],
        status: item.status,
        ...(item.note !== undefined ? { note: item.note } : {}),
      };
    }

    // 5. projectClosure 검증: open finding 잔존 여부, note 없는 accepted, --accept-risk 매칭을 확인
    const projected = projectClosure(merged, acceptRisk);
    if (isFail(projected)) return projected;
    const projection = { findings: projected, rounds: folded.rounds };
    // 5-1. state를 바꾸기 전에 문서를 렌더·검증한다(부재·검증 실패는 무변경 거절).
    const closureDoc = prepareClosureDoc(repoRoot, ctx.bp, projection, snap.digest);
    if (isFail(closureDoc)) return closureDoc;

    // 6. 쓰기: immutable dispositions 저장 후 state.json 원자적 교체
    const dispSha = sha256(rawText);
    const dispRel = `${cyclePrefix(ctx, cycle.id)}/r${cycle.restart_count}/dispositions/${dispSha.slice(0, 16)}.json`;
    const dispRef: Ref = { path: dispRel, sha256: dispSha };

    const stored = guardWrites(() => {
      writeImmutable(ctx.nsAbs, path.join(repoRoot, dispRel), rawText);
    });
    if (isFail(stored)) return stored;

    const next: State = {
      ...state,
      transitions: [...state.transitions, key],
      closed: true,
      closure: { dispositions: dispRef, accept_risk: acceptRisk, closure_target_digest: snap.digest },
      projection,
    };
    const saved = guardWrites(() => saveState(ctx, next));
    if (isFail(saved)) return saved;
    // 문서는 state 저장 뒤에 쓴다. 쓰기가 실패해도 같은 입력의 재실행(noop 경로)이 복구한다.
    const wrote = guardWrites(() => writeAtomic(closureDoc.abs, closureDoc.text));
    if (isFail(wrote)) return wrote;

    // 정상적으로 cycle이 closed/accepted 되었음을 알리는 반환 객체
    return {
      ok: true, noop: false, cycle: next.cycle, status: 'accepted', closed: next.closed,
      projection: next.projection, written: closureDoc.rel,
    };
  }) as Record<string, unknown>;
}

/** payload의 documents_content에서 경로별 본문만 꺼낸다. 없거나 모양이 다르면 undefined. */
function contentOf(payload: Record<string, unknown>): Record<string, { body: string }> | undefined {
  const raw = payload.documents_content;
  if (!isRecord(raw)) return undefined;
  const out: Record<string, { body: string }> = {};
  for (const [file, doc] of Object.entries(raw)) {
    if (isRecord(doc) && typeof doc.body === 'string') out[file] = { body: doc.body };
  }
  return out;
}

/**
 * finding symbol과 heading 텍스트를 같은 꼴로 줄인다: 소문자로 바꾸고 영숫자(한글 포함)가 아닌 문자를 지운다.
 * 예: `goal-intent`와 `Goal & intent`는 모두 `goalintent`.
 */
function sectionKey(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * 본문에서 symbol과 일치하는 첫 heading의 섹션 본문을 뽑는다. 섹션은 그 heading 줄부터 같은 단계 이상
 * (# 개수가 같거나 적은)의 다음 heading 직전까지다. 코드 펜스 안의 `#`은 heading이 아니다.
 *
 * @param {string} body - 문서 본문
 * @param {string} symbol - finding symbol(heading slug)
 * @returns {string | undefined} 섹션 본문, heading을 못 찾으면 undefined
 */
function extractSection(body: string, symbol: string): string | undefined {
  const want = sectionKey(symbol);
  if (want === '') return undefined;
  const lines = body.split('\n');
  let fenced = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (start >= 0) {
      if (m[1].length <= level) return lines.slice(start, i).join('\n');
    } else if (sectionKey(m[2]) === want) {
      start = i;
      level = m[1].length;
    }
  }
  return start >= 0 ? lines.slice(start).join('\n') : undefined;
}

/**
 * 열린 must_fix 모두의 대상이 기준 대비 고쳐졌는지 판정한다. payload의 changed_documents·revision_diff는
 * loadDispatch가 대조하지 않아 위조될 수 있으므로 입력으로 쓰지 않고, 재계산 대조를 통과한
 * documents_content 본문만 비교한다. 파일을 읽지 않는다.
 *
 * @param {Finding[]} findings - 판정할 finding. open must_fix만 본다
 * @param {Record<string, {body: string}> | undefined} baseline - 기준(latest 저장본) 문서 본문. 없으면 false
 * @param {Record<string, {body: string}> | undefined} current - 이번 dispatch의 문서 본문
 * @returns {boolean} 모든 대상이 고쳐졌으면 true. 하나라도 그대로이거나 file/섹션을 한쪽에서
 *   못 찾으면 false
 */
function openMustFixesFixed(
  findings: Finding[],
  baseline: Record<string, { body: string }> | undefined,
  current: Record<string, { body: string }> | undefined,
): boolean {
  if (!baseline || !current) return false;
  return findings
    .filter((f) => f.status === 'open' && f.actionability === 'must_fix')
    .every((f) => {
      const file = f.file;
      const symbol = f.symbol;
      if (typeof file !== 'string' || typeof symbol !== 'string') return false;
      if (!Object.hasOwn(baseline, file) || !Object.hasOwn(current, file)) return false;
      const before = baseline[file].body;
      const after = current[file].body;
      // symbol `-`는 섹션 지정이 없는 finding이라 file 본문 전체를 비교한다.
      if (symbol === '-') return before !== after;
      const a = extractSection(before, symbol);
      const b = extractSection(after, symbol);
      return a !== undefined && b !== undefined && a !== b;
    });
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
    dispatchBytes = readInputFile(input.dispatchFile);
  } catch (error) {
    return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error),
      'pass --dispatch <review-dispatch plan JSON file>');
  }
  const legacy = readLegacy(repoRoot, probe.bp);
  if (isFail(legacy)) return legacy;
  const hasState = cycleStateExists(probe);
  // 표식이 있는데 state가 없으면 한도 소진 기록이 남은 것이다: 증거 import로 우회하지 못하게 거절한다.
  if (!hasState && legacy.marker >= RESTART_LIMIT) {
    return fail('context-review-restart-limit',
      `restart_count marker ${legacy.marker} of ${RESTART_LIMIT} used and state.json is missing`,
      'continue the current cycle: restore state.json from backup; no further automatic restart');
  }
  if (!hasState && !legacy.present) {
    return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
  }
  const ctx = openContext(repoRoot, input.blueprintDir, true) as Ctx;
  return withLock(ctx, () => {
    const state = loadState(ctx);
    if (isFail(state)) return state;
    if (state) {
      const evidence = readLegacy(repoRoot, ctx.bp);
      if (isFail(evidence)) return evidence;
      const mismatch = reconcileMarker(ctx, repoRoot, state, evidence);
      if (mismatch) return mismatch;
    }
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
      const folded = foldReports(ctx, repoRoot, state.cycle.active_reports);
      if (isFail(folded)) return folded;
      // 닫힌 cycle은 미해결 검사를 projection 기준으로 판정한다.
      // 열려 있는 cycle은 fold된 active 보고의 open must_fix를 검사한다.
      const findingsToCheck = (state.closed && state.projection)
        ? state.projection.findings
        : folded.findings;
      const latest = readRef(ctx, repoRoot, state.cycle.latest_dispatch);
      if (isFail(latest)) return latest;
      // delta 뒤 열린 must_fix는 대상 섹션이 실제로 고쳐졌을 때만 restart를 받아들인다.
      // 기준은 이미 읽은 latest 저장본이고 새 내용은 loadDispatch가 재계산 대조한 payload다.
      if (state.cycle.active_reports.length >= 2
        && findingsToCheck.some((f) => f.status === 'open' && f.actionability === 'must_fix')
        && !openMustFixesFixed(findingsToCheck, contentOf(JSON.parse(latest)),
          contentOf(JSON.parse(dispatch.text)))) {
        return fail('context-review-unresolved-findings', 'must_fix remains open after the delta round',
          'record explicit user-approved accepted-risk with context-review close, or fix the target section '
          + 'of every open must_fix: route then guides close or restart');
      }
      // 닫힌 cycle은 close가 인증한 digest가 마지막 certified target이다(본문 재close가 latest_dispatch를
      // 바꾸지 않으므로 round digest만 보면 이미 인증된 snapshot으로 restart할 수 있다).
      const previousDigest = state.closure?.closure_target_digest
        ?? (JSON.parse(latest) as { target: { digest: string } }).target.digest;
      if (previousDigest === dispatch.digest) {
        return fail('context-review-state-conflict', 'plan snapshot is unchanged since the last certified target',
          'restart only after the plan documents changed');
      }
      const dispatches = [...state.cycle.active_reports.map((r) => r.dispatch), state.cycle.latest_dispatch];
      archive = {
        restart_index: 1,
        reason,
        rounds: folded.rounds,
        findings: findingsToCheck,
        reports: state.cycle.active_reports,
        dispatches: dispatches.filter((d, i) => dispatches.findIndex((x) => x.sha256 === d.sha256) === i),
        ...(state.closure ? { closure: state.closure } : {}),
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
    // 표식 본문을 쓰기 전에 먼저 만들어 패치 불가를 state 변경 전에 거절한다.
    const marked = prepareMarker(repoRoot, ctx.bp, 1);
    if (isFail(marked)) return marked;
    let dispatchRef: Ref = { path: '', sha256: '' };
    const stored = guardWrites(() => {
      dispatchRef = storeDispatch(repoRoot, ctx, base.cycle.id, dispatch);
    });
    if (isFail(stored)) return stored;
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
      closure: undefined,
      projection: null,
    };
    // state가 먼저, 표식이 나중이다. 사이에 죽으면 다음 전이의 reconcileMarker가 표식을 채운다.
    const saved = guardWrites(() => {
      saveState(ctx, next);
      writeAtomic(marked.abs, marked.text);
    });
    if (isFail(saved)) return saved;
    return { ok: true, noop: false, cycle: next.cycle };
  }) as Record<string, unknown>;
}

type NextAction = 'reuse' | 'close' | 'delta' | 'restart' | 'user';

/**
 * 두 plan payload의 문서 집합·structure_parts(구조)와 scope_parts(Interface·Touch 계약)가 같은지 본다.
 * scope_parts의 해시 공식은 plan-snapshot 소유라 여기서는 값만 비교한다.
 *
 * @param {Record<string, unknown>} a - 기준 payload(저장된 latest dispatch)
 * @param {Record<string, unknown>} b - 비교 payload 또는 현재 계산값
 * @returns {{ structure: boolean, scope: boolean }} 구조 동일 여부와 계약 동일 여부
 */
function compareShape(a: Record<string, unknown>, b: Record<string, unknown>): { structure: boolean; scope: boolean } {
  const docs = (x: Record<string, unknown>): unknown => (
    Array.isArray(x.documents) ? x.documents
      : (isRecord(x.target) ? x.target.documents : undefined)
  );
  return {
    structure: isDeepStrictEqual(docs(a), docs(b)) && isDeepStrictEqual(a.structure_parts, b.structure_parts),
    scope: isDeepStrictEqual(a.scope_parts, b.scope_parts),
  };
}

/** 구조와 계약이 모두 같은지(본문만 달라진 수정인지). */
function sameStructureAndScope(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const shape = compareShape(a, b);
  return shape.structure && shape.scope;
}

function route(next_action: NextAction, reason: string, cause: unknown, next: string, cycle: Cycle) {
  return { ok: true as const, next_action, reason, cause, next, cycle };
}

/**
 * 새 review-dispatch payload가 기존 cycle에서 어떤 후속 조치를 요구하는지 정한다.
 * 읽기 전용이라 state.json·보고·dispatch 저장본을 쓰지 않는다 — 호출이 round 수나 restart
 * 횟수를 바꾸지 못하므로 "delta 뒤 새 stale"가 세 번째 round나 두 번째 restart로 새지 않는다.
 * 판정 순서: 같은 target(reuse) → round 없음·미해결 must_fix(user) → 구조·계약 동일(close)
 * → 구조 동일 + 계약 변경, discovery 뒤 partial(delta)
 * → 그 밖의 stale(구조 변경): restart_count<1이면 restart, 한도 소진이면 user.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - 새 snapshot의 review-dispatch plan JSON 파일
 * @param {string} [input.followUp] - 선택. 주어지면 payload의 follow_up과 같아야 한다 — 호출자가
 *   payload와 다른 판정을 주입해 routing을 바꾸지 못한다. 생략하면 payload에서 파생한다.
 * @returns {object} 성공 `{ok:true,next_action,reason,cause,next,cycle}`
 *   (next_action은 reuse|close|delta|restart|user), 실패 `{ok:false,reason,cause,next}`
 */
function routeFollowUp(input: {
  repoRoot: string; blueprintDir: string; dispatchFile: string; followUp?: string;
}): Record<string, unknown> {
  const { repoRoot } = input;
  const ctx = openContext(repoRoot, input.blueprintDir, false);
  if (isFail(ctx)) return ctx;
  const state = loadState(ctx);
  if (isFail(state)) return state;
  if (!state) return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
  const dispatch = loadDispatch(repoRoot, ctx.bp, input.dispatchFile);
  if (isFail(dispatch)) return dispatch;
  // follow_up은 검증을 통과한 payload 자체에서 읽는다(loadDispatch가 text를 JSON으로 확인했다).
  const followUp = (JSON.parse(dispatch.text) as { follow_up?: unknown }).follow_up;
  if (followUp !== 'partial' && followUp !== 'full') {
    return fail('context-review-input-invalid', `payload follow_up ${String(followUp)}`,
      'pass the review-dispatch plan JSON produced with --previous');
  }
  if (input.followUp !== undefined && input.followUp !== followUp) {
    return fail('context-review-input-invalid',
      `follow_up ${String(input.followUp)} differs from payload follow_up ${followUp}`,
      'omit followUp or pass the payload value');
  }
  const { cycle } = state;
  const rounds = cycle.active_reports.length;

  // 1. 아직 기록된 round가 없으면 reviewer 보고를 기다리는 중이다: 자동 전이를 만들지 않는다.
  if (rounds === 0) {
    return route('user', 'context-review-round-pending', 'no round has been recorded in this cycle',
      'record the pending discovery round before routing a new target', cycle);
  }
  // 2. 마지막 reviewed target과 같으면 재사용한다: round도 restart도 늘리지 않는다.
  const latest = readRef(ctx, repoRoot, cycle.latest_dispatch);
  if (isFail(latest)) return latest;
  const baseline = JSON.parse(latest) as Record<string, unknown>;
  const newPayload = JSON.parse(dispatch.text) as Record<string, unknown>;
  // close로 재인증한 digest도 이미 검토·인증된 target이다: latest_dispatch는 그대로라 따로 본다.
  if ((baseline.target as { digest: string }).digest === dispatch.digest
    || state.closure?.closure_target_digest === dispatch.digest) {
    return route('reuse', 'context-review-target-unchanged', 'plan snapshot equals the last reviewed target',
      'reuse the recorded review result; do not add a round', cycle);
  }
  // 3. delta 뒤 미해결 must_fix는 restart·재-delta로 해결을 우회할 수 없다: 사용자 판단으로 멈춘다.
  if (!state.closed && rounds >= ROUND_MODES.length) {
    const folded = foldReports(ctx, repoRoot, cycle.active_reports);
    if (isFail(folded)) return folded;
    // 대상 섹션을 모두 고쳤다면 멈추지 않고 4(close) 또는 6(restart)으로 내려간다.
    if (folded.findings.some((f) => f.status === 'open' && f.actionability === 'must_fix')
      && !openMustFixesFixed(folded.findings, contentOf(baseline), contentOf(newPayload))) {
      return route('user', 'context-review-unresolved-findings', 'must_fix remains open after the delta round',
        'record explicit user-approved accepted-risk with context-review close, or fix the target section '
        + 'of every open must_fix: route then guides close or restart', cycle);
    }
  }
  // 4. 구조·계약이 baseline과 같은 본문 수정은 새 round 없이 close로 현재 digest를 인증한다.
  //    닫힌 cycle의 본문 수정도 같은 경로다(닫힌 뒤 stale이 되면 재close).
  const shape = compareShape(baseline, newPayload);
  if (shape.structure && shape.scope) {
    return route('close', 'context-review-close-available',
      'body-only change: structure and contract equal the reviewed baseline',
      'run context-review close with dispositions; it certifies the current snapshot digest', cycle);
  }
  // 5. 구조가 같고 Interface·Touch만 바뀐 discovery 뒤 닫히지 않은 cycle의 partial만 delta다.
  //    닫힌 cycle은 round 기록이 거절되므로 제외한다.
  if (followUp === 'partial' && shape.structure && !state.closed && rounds === 1) {
    return route('delta', 'context-review-delta-available', 'partial change after discovery with no delta used',
      'dispatch one delta round with revision_diff and related_documents', cycle);
  }
  // 6. delta를 이미 썼거나 structural full: 남은 restart가 있을 때만 전체 재시작이다.
  if (cycle.restart_count < RESTART_LIMIT) {
    return route('restart', 'context-review-restart-available', 'delta is used or the change is structural',
      'run context-review restart, then dispatch discovery', cycle);
  }
  return route('user', 'context-review-restart-limit',
    `restart_count ${cycle.restart_count} of ${RESTART_LIMIT} used`,
    'continue the current cycle: record findings, resolve them, or ask the user; no further automatic restart', cycle);
}

export = {
  startCycle, recordReport, closeCycle, restartCycle, routeFollowUp, readStoredLatest, readLegacyEvidence,
  // 단위 테스트가 symlink·덮어쓰기 거부를 직접 확인하도록 노출한다.
  writeAtomic, writeImmutable,
};
