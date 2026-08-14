'use strict';
const { toPosix } = require('./paths');

// 본문 파싱 층. 게이트(G)와 구조(S)가 같은 heading/경로 규칙을 보게 여기만 둔다.
// 상위 모듈이 각자 정규식을 가지면 G10과 G16의 "비어 있음"이 어긋난다.
// 이 파일은 형제 validate-*.ts를 require하지 않는다 — 의존 방향의 맨 아래층.

const SECTION_DEFS = [
  { key: 'goal', re: /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i },
  { key: 'interface', re: /^##\s+(Interface|인터페이스)\s*$/i },
  { key: 'touch', re: /^##\s+(Touch|수정할\s*부분)\s*$/i },
  { key: 'doNotTouch', re: /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i },
  // 경계로 파싱하지만 G10 필수 목록에는 없음: 여기에 def가 없으면 해당 본문이
  // Do not touch에 흡수되어 G12 path overlap을 잘못 만들어 냄.
  { key: 'constraints', re: /^##\s+(Constraints|제약)\s*$/i },
  { key: 'checklist', re: /^##\s+(Checklist|체크리스트)\s*$/i },
];

const VERIFY_SECTION_DEFS = [
  { key: 'command', re: /^##\s+(Command|명령(?:어)?)\s*$/i },
  { key: 'evidence', re: /^##\s+(Evidence|증적|증거)\s*$/i },
];

const REVIEW_SECTION_DEFS = [
  { key: 'findings', re: /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i },
];
const REVIEW_SEVERITY = ['blocker', 'major', 'minor', 'nit'];
const REVIEW_STATUS = ['resolved', 'accepted'];

// G10과 동일한 비어 있음 계약: 제목은 있고, comment-strip 후 본문이 있어야 함.
// comprehension module이 어떤 section이 있는지 SSOT가 되도록 key는
// EXPLAIN_SECTION_DEFS를 반영; regex는 parseSections 옆에 둠.
const EXPLAIN_SECTION_HEADINGS = [
  { key: 'background', re: /^##\s+Background\s*$/i },
  { key: 'intuition', re: /^##\s+Intuition\s*$/i },
  { key: 'code', re: /^##\s+Code\s*$/i },
  { key: 'quiz', re: /^##\s+Quiz\s*$/i },
  { key: 'understanding', re: /^##\s+이해\s*상태\s*$/i },
];

// 작성 가이드는 HTML comment로 제공되므로, 가이드만 있는 section은 미작성으로
// 본다. 비어 있음 검사 전에 comment를 제거하면 "section은 있으나 비어 있음"이
// template에 본문이 실리기 전과 같은 의미를 유지. tasks뿐 아니라 section을
// 파싱하는 모든 문서에 적용.
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

// template이 쓰는 유일한 placeholder 형식. 실제 본문과 구분되어 걸리지 않음 —
// Interface의 `<T>` generic은 그대로 허용.
const TODO_RE = /<TODO:[^>\n]*>/;

function parseSections(body, defs) {
  const text = typeof body === 'string' ? stripComments(body) : '';
  const lines = text.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    for (const def of defs) {
      if (def.re.test(lines[i].trim())) starts.push({ key: def.key, line: i });
    }
  }
  const out: Record<string, string | null> = {};
  for (const def of defs) out[def.key] = null;
  for (let s = 0; s < starts.length; s++) {
    const { key, line } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].line : lines.length;
    out[key] = lines.slice(line + 1, end).join('\n').trim() || null;
  }
  return out;
}

function parseTasksSections(body) {
  return parseSections(body, SECTION_DEFS);
}

// Touch/Do-not-touch는 백틱 경로와 민줄 경로를 섞어 쓴다. 한쪽만 모으면
// G11(Touch 근거) / G12(금지 교차)가 표기 차이로 빗나간다.
function extractPathCandidates(text) {
  const raw = typeof text === 'string' ? text : '';
  const found = new Set();
  for (const m of raw.matchAll(/`([^`]+)`/g)) {
    const p = toPosix(m[1].trim()).replace(/^\.\//, '');
    if (p) found.add(p);
  }
  for (const tok of raw.split(/[\s,;]+/)) {
    const p = toPosix(tok.trim()).replace(/^\.\//, '');
    if (!p || p.includes('`')) continue;
    if (!/^[A-Za-z0-9_./-]+$/.test(p)) continue;
    if (!p.includes('/') && !/\.[A-Za-z0-9]+$/.test(p)) continue;
    found.add(p);
  }
  return [...found];
}

// 디렉터리 prefix도 교차로 본다. `scripts/` 금지가 `scripts/lib/x.js`를
// 통과시키면 G12가 파일 단위 affected_paths를 놓친다.
function pathsOverlap(a, b) {
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function pathJustifiedByTouch(ap, touchText) {
  if (touchText.includes(ap)) return true;
  return extractPathCandidates(touchText).some(
    (c: string) => ap === c || ap.startsWith(c.endsWith('/') ? c : `${c}/`),
  );
}

// findings 필드 계약은 G14(execute review.md)와 G18(plan context-review.md)이
// 같다. 헬퍼를 공유하지 않으면 한쪽만 고친 순간 두 리뷰 문서가 다른 계약을
// 갖게 된다. 본문 판정 문장은 읽지 않는다 — heading 존재와 id/severity/status/note.
// findings가 있는데 배열이 아니면 []로 떨어뜨리지 않는다. 빈 배열과 같게 취급하면
// 형식 위반이 통과한다. 부재(undefined/null)만 빈 목록으로 본다.
function collectFindingFailures({ body, findings, sectionLabel, findingLabel }) {
  const messages = [];
  const rs = parseSections(typeof body === 'string' ? body : '', REVIEW_SECTION_DEFS);
  if (!rs.findings) {
    messages.push(`${sectionLabel} missing ## Findings body section`);
  }
  if (findings != null && !Array.isArray(findings)) {
    messages.push(`${findingLabel} findings must be an array`);
    return messages;
  }
  const list = Array.isArray(findings) ? findings : [];
  for (const fnd of list) {
    const id = fnd && fnd.id ? fnd.id : '(no id)';
    if (!REVIEW_SEVERITY.includes(fnd && fnd.severity)) {
      messages.push(`${findingLabel} finding ${id} severity invalid: ${fnd && fnd.severity}`);
    }
    if (!REVIEW_STATUS.includes(fnd && fnd.status)) {
      messages.push(`${findingLabel} finding ${id} status invalid: ${fnd && fnd.status}`);
    }
    if (fnd && fnd.status === 'accepted' && (!fnd.note || String(fnd.note).trim() === '')) {
      messages.push(`${findingLabel} finding ${id} accepted without note`);
    }
  }
  return messages;
}

module.exports = {
  SECTION_DEFS,
  VERIFY_SECTION_DEFS,
  REVIEW_SECTION_DEFS,
  REVIEW_SEVERITY,
  REVIEW_STATUS,
  EXPLAIN_SECTION_HEADINGS,
  TODO_RE,
  stripComments,
  parseSections,
  parseTasksSections,
  extractPathCandidates,
  pathsOverlap,
  pathJustifiedByTouch,
  collectFindingFailures,
};
