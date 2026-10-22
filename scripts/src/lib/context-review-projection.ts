'use strict';

const { isDeepStrictEqual } = require('node:util');
import type { Finding, Fail } from './context-review-contracts';
import guards = require('./guards');
const { isRecord } = guards;
import render = require('./render');
const { renderDoc } = render;
import validateSections = require('./validate-sections');
const { collectFindingFailures, CONTEXT_REVIEW_STATUS } = validateSections;

function fail(reason: string, cause: unknown, next: string): Fail {
  return { ok: false, reason, cause, next };
}

function oneLine(value: unknown): string {
  return String(value).replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

/**
 * restart_count 한 키만 최소 패치한다. 파싱은 호출부가 원본을 읽은 뒤 실행해야
 * 기존 레이아웃 거절과 디스크 파싱 실패의 우선순위가 유지된다.
 *
 * @param {string} original - 호출자가 읽은 기존 문서 원문
 * @param {number} count - 기록할 restart_count
 * @returns {{ text: string } | Fail} 새 본문 또는 패치 거절; 디스크 부작용 없음
 */
function projectMarker(original: string, count: number): { text: string } | Fail {
  const unsupported = (cause: string) => fail('context-review-legacy-evidence', cause,
    'keep context-review.md frontmatter in the standard two-space YAML layout, then retry');
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
  return { text };
}

/**
 * 최소 패치가 표식 외의 frontmatter 값을 바꾸지 않았는지 인증한다.
 * @param {unknown} before - 호출자가 파싱한 원본
 * @param {unknown} after - 호출자가 파싱한 패치 결과
 * @param {number} count - 기록할 누적 횟수
 * @returns {Fail | null} 다른 키 변경 또는 mapping 거절, 정상이면 null; 입력 변경 없음
 */
function validateMarker(before: unknown, after: unknown, count: number): Fail | null {
  const unsupported = (cause: string) => fail('context-review-legacy-evidence', cause,
    'keep context-review.md frontmatter in the standard two-space YAML layout, then retry');
  const expected: unknown = JSON.parse(JSON.stringify(before));
  if (!isRecord(expected) || !isRecord(expected.bouncer) || !isRecord(expected.bouncer.context_review)) {
    return unsupported('bouncer.context_review is not a mapping');
  }
  expected.bouncer.context_review.restart_count = count;
  if (!isDeepStrictEqual(after, expected)) return unsupported('marker patch would change other frontmatter content');
  return null;
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
 * @param {{ data: unknown; body: string }} parsed - 호출자가 읽고 파싱한 기존 문서
 * @param {{ findings: Finding[]; rounds: unknown[] }} projection - 닫힌 cycle의 투영
 * @param {string} [closureTargetDigest] - 인증한 snapshot digest. 있으면 frontmatter에 기록한다
 * @returns {{ text: string } | Fail} 새 문서 본문 또는 형식 거절; 디스크 부작용 없음
 */
function projectClosureDoc(
  parsed: { data: unknown; body: string }, projection: { findings: Finding[]; rounds: unknown[] },
  closureTargetDigest?: string,
): { text: string } | Fail {
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
  return { text: renderDoc(data, body) };
}


export = { projectMarker, validateMarker, projectClosureDoc };
