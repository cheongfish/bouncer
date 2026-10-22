'use strict';

const { isDeepStrictEqual } = require('node:util');
import type { Finding, Fail, State, Ref, Dispatch, ReportInput } from './context-review-contracts';
import guards = require('./guards');
const { isRecord } = guards;
import validateSections = require('./validate-sections');
const { normalizeFinding, normalizeRoundFindings, CONTEXT_REVIEW_STATUS } = validateSections;

function fail(reason: string, cause: unknown, next: string): Fail {
  return { ok: false, reason, cause, next };
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
  // 사람이 손으로 붙인 값은 배제하고 CLI projection에서만 부여해 기록 판정에 넘긴다.
  return findings.map((f) => {
    if (f.status === 'accepted' && f.actionability === 'must_fix' && risky.has(f.id as string)) {
      return { ...f, accepted_risk: true };
    }
    return { ...f };
  });
}

/**
 * 검증된 payload에서 본문 비교에 필요한 값만 취한다. 불완전한 입력은 해결 증거로 쓰지 않는다.
 * @param {Record<string, unknown>} payload - 호출자가 이미 읽은 dispatch
 * @returns {Record<string, { body: string }> | undefined} 경로별 본문 또는 문서 정보 없음; I/O 없음
 */
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
 * @param {string} text - 비교할 heading 또는 symbol
 * @returns {string} 구두점을 제거한 비교 키; 부작용 없음
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

/**
 * close가 본문 수정만 인증하도록 구조와 계약을 함께 대조한다.
 * @param {Record<string, unknown>} a - 기존 payload
 * @param {Record<string, unknown>} b - 새 payload 또는 이미 계산한 parts
 * @returns {boolean} 두 경계가 모두 같으면 true; 입력 변경과 I/O 없음
 */
function sameStructureAndScope(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const shape = compareShape(a, b);
  return shape.structure && shape.scope;
}

/**
 * 읽어 둔 처분을 finding 사본에 적용한다. 거절 시 입력과 기존 상태를 바꾸지 않는다.
 * @param {Finding[]} findings - 정규화된 기존 findings
 * @param {unknown[]} parsed - 파싱한 처분 배열
 * @returns {Finding[] | Fail} 처분 사본 또는 기존 reason의 거절
 */
function applyDispositions(findings: Finding[], parsed: unknown[]): Finding[] | Fail {
  const seenIds = new Set<string>();
  const merged = findings.map((f) => ({ ...f }));
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

  return merged;
}

/**
 * 뒤 보고가 같은 ID의 finding 전체를 대체하게 사본을 병합한다.
 * @param {Finding[]} prior - 이전 정규화 findings
 * @param {Finding[]} incoming - 이번 정규화 findings
 * @returns {Finding[]} 입력 배열을 변경하지 않은 최신 ID별 목록
 */
function mergeFindings(prior: Finding[], incoming: Finding[]): Finding[] {
  const merged = [...prior];
  for (const f of incoming) {
    const at = merged.findIndex((x) => x.id === f.id);
    if (at >= 0) merged[at] = f;
    else merged.push(f);
  }
  return merged;
}

/**
 * 새 round를 정규화·병합하고 중복 fingerprint를 쓰기 전에 거절한다.
 * @param {Finding[]} findings - 이번 입력 findings
 * @param {Finding[]} prior - 이전 보고를 합친 findings
 * @returns {object | Fail} 정규화 IDs와 병합 결과 또는 거절; 입력 변경과 I/O 없음
 */
function prepareFindings(findings: Finding[], prior: Finding[]) {
  const normalized = normalizeRoundFindings(findings, prior, 'context');
  if (!normalized.ok) {
    return fail('context-review-input-invalid', normalized.messages,
      'give each finding a non-empty string id or omit the id key; resolve id collisions, then retry');
  }
  const incoming = normalized.findings as Finding[];
  const merged = mergeFindings(prior, incoming);
  // 중복 fingerprint는 status와 무관하게 쓰기 전에 거부한다. accepted 때만 막으면 중복이 requested/addressed
  // record를 통과한 뒤 close에서야 막혀, 같은 round를 다시 기록할 수 없고 restart만 남기 때문이다.
  const duplicates = duplicateFingerprints(merged);
  if (duplicates.length > 0) {
    return fail('context-review-input-invalid',
      duplicates.map((fp) => `context-review duplicate fingerprint ${fp}`),
      'merge the findings sharing a fingerprint into one and record the same round again');
  }
  return { normalized, incoming, merged };
}

/**
 * 검증을 마친 전이의 새 상태를 계산한다. 기존 상태와 입력은 변경하지 않는다.
 * @param {State} state - 기존 상태
 * @param {ReportInput} report - 검증된 보고
 * @param {string} status - 요청 상태
 * @param {string[]} acceptRisk - 명시 동의 IDs
 * @param {Dispatch} dispatch - 검증된 dispatch
 * @param {Ref} dispatchRef - 저장 참조
 * @param {string} reportRel - 저장 보고 경로
 * @param {string} reportSha - 보고 digest
 * @param {string} key - 전이 키
 * @param {State['projection']} projection - 검증된 투영
 * @returns {State} 저장할 새 상태; I/O와 추가 검증은 호출부가 기존 시점에 수행한다
 */
function recordState(
  state: State, report: ReportInput, status: string, acceptRisk: string[],
  dispatch: Dispatch, dispatchRef: Ref, reportRel: string, reportSha: string, key: string,
  projection: State['projection'],
): State {
  const cycle = state.cycle;
  const round = report.round.round;
  return {
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
}

/**
 * 검증을 마친 전이의 새 상태를 계산한다. 기존 상태와 입력은 변경하지 않는다.
 * @param {State} state - 기존 상태
 * @param {string} key - 전이 키
 * @param {Ref} dispRef - 처분 저장 참조
 * @param {string[]} acceptRisk - 명시 동의 IDs
 * @param {string} digest - 인증 digest
 * @param {State['projection']} projection - 검증된 투영
 * @returns {State} 저장할 새 상태; I/O와 추가 검증은 호출부가 기존 시점에 수행한다
 */
function closeState(
  state: State, key: string, dispRef: Ref, acceptRisk: string[], digest: string,
  projection: State['projection'],
): State {
  return {
    ...state,
    transitions: [...state.transitions, key],
    closed: true,
    closure: { dispositions: dispRef, accept_risk: acceptRisk, closure_target_digest: digest },
    projection,
  };
}

/**
 * 검증을 마친 전이의 새 상태를 계산한다. 기존 상태와 입력은 변경하지 않는다.
 * @param {State} base - 기존 상태 또는 legacy 틀
 * @param {Record<string, unknown>} archive - 이전 증거
 * @param {Ref} dispatchRef - 새 dispatch 저장 참조
 * @param {string} key - 전이 키
 * @returns {State} 저장할 새 상태; I/O와 추가 검증은 호출부가 기존 시점에 수행한다
 */
function restartState(
  base: State, archive: Record<string, unknown>, dispatchRef: Ref, key: string,
): State {
  return {
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
}

/**
 * 읽어 둔 증거로 restart 가능 여부와 archive를 계산한다. 미해결 finding을 snapshot 동일성보다 먼저 거절한다.
 * @param {State} state - 기존 상태
 * @param {object} folded - 저장 보고 합성 결과
 * @param {Record<string, unknown>} latest - 마지막 저장 dispatch
 * @param {Record<string, unknown>} current - 검증된 새 dispatch
 * @param {string} digest - 새 snapshot digest
 * @param {string} reason - 보관할 재시작 사유
 * @returns {Record<string, unknown> | Fail} archive 또는 기존 reason의 거절; 입력 변경과 I/O 없음
 */
function restartArchive(
  state: State, folded: { findings: Finding[]; rounds: unknown[] },
  latest: Record<string, unknown>, current: Record<string, unknown>, digest: string, reason: string,
): Record<string, unknown> | Fail {
  // 닫힌 cycle은 미해결 검사를 projection 기준으로 판정한다.
  // 열려 있는 cycle은 fold된 active 보고의 open must_fix를 검사한다.
  const findingsToCheck = (state.closed && state.projection)
    ? state.projection.findings
    : folded.findings;
  // delta 뒤 열린 must_fix는 대상 섹션이 실제로 고쳐졌을 때만 restart를 받아들인다.
  // 기준은 이미 읽은 latest 저장본이고 새 내용은 loadDispatch가 재계산 대조한 payload다.
  if (state.cycle.active_reports.length >= 2
    && findingsToCheck.some((f) => f.status === 'open' && f.actionability === 'must_fix')
    && !openMustFixesFixed(findingsToCheck, contentOf(latest),
      contentOf(current))) {
    return fail('context-review-unresolved-findings', 'must_fix remains open after the delta round',
      'record explicit user-approved accepted-risk with context-review close, or fix the target section '
      + 'of every open must_fix: route then guides close or restart');
  }
  // 닫힌 cycle은 close가 인증한 digest가 마지막 certified target이다(본문 재close가 latest_dispatch를
  // 바꾸지 않으므로 round digest만 보면 이미 인증된 snapshot으로 restart할 수 있다).
  const previousDigest = state.closure?.closure_target_digest
    ?? (latest as { target: { digest: string } }).target.digest;
  if (previousDigest === digest) {
    return fail('context-review-state-conflict', 'plan snapshot is unchanged since the last certified target',
      'restart only after the plan documents changed');
  }
  const dispatches = [...state.cycle.active_reports.map((r) => r.dispatch), state.cycle.latest_dispatch];
  return {
    restart_index: 1,
    reason,
    rounds: folded.rounds,
    findings: findingsToCheck,
    reports: state.cycle.active_reports,
    dispatches: dispatches.filter((d, i) => dispatches.findIndex((x) => x.sha256 === d.sha256) === i),
    ...(state.closure ? { closure: state.closure } : {}),
  };
}

export = {
  inputFindingIds, normalizeProjection, projectClosure, contentOf, openMustFixesFixed,
  compareShape, sameStructureAndScope, applyDispositions, prepareFindings,
  recordState, closeState, restartState, restartArchive,
};
