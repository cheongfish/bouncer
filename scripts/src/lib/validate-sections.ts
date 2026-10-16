'use strict';
import guards = require('./guards');
const { isRecord } = guards;
import paths = require('./paths');
const { toPosix } = paths;

// 본문 파싱 층. 게이트(G)와 구조(S)가 같은 heading/경로 규칙을 보게 여기만 둔다.
// 상위 모듈이 각자 정규식을 가지면 G10과 G16의 "비어 있음"이 어긋난다.
// 이 파일은 형제 validate-*.ts를 require하지 않는다 — 의존 방향의 맨 아래층.

type SectionDef = { key: string; re: RegExp };

const SECTION_DEFS: SectionDef[] = [
  { key: 'goal', re: /^##\s+(Goal\s*&\s*intent|목적[·・.]?의도)\s*$/i },
  // 선택 절: G10 필수 목록에는 없지만 경계로 등록한다. def가 없으면
  // Goal & intent에 흡수되어 placeholder 검사가 goal로만 보고된다.
  { key: 'currentBehavior', re: /^##\s+(Current\s+behavior|현재\s*동작)\s*$/i },
  { key: 'targetBehavior', re: /^##\s+(Target\s+behavior|목표\s*동작)\s*$/i },
  { key: 'interface', re: /^##\s+(Interface|인터페이스)\s*$/i },
  { key: 'touch', re: /^##\s+(Touch|수정할\s*부분)\s*$/i },
  { key: 'doNotTouch', re: /^##\s+(Do\s+not\s+touch|절대\s*수정\s*금지)\s*$/i },
  // 경계로 파싱하지만 G10 필수 목록에는 없음: 여기에 def가 없으면 해당 본문이
  // Do not touch에 흡수되어 G12 path overlap을 잘못 만들어 냄.
  { key: 'constraints', re: /^##\s+(Constraints|제약)\s*$/i },
  { key: 'checklist', re: /^##\s+(Checklist|체크리스트)\s*$/i },
];

const VERIFY_SECTION_DEFS: SectionDef[] = [
  { key: 'command', re: /^##\s+(Command|명령(?:어)?)\s*$/i },
  { key: 'evidence', re: /^##\s+(Evidence|증적|증거)\s*$/i },
];

const REVIEW_SECTION_DEFS: SectionDef[] = [
  { key: 'findings', re: /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i },
];
const REVIEW_SEVERITY = ['blocker', 'major', 'minor', 'nit'];
// context review는 기존 두 값만 유지한다. execute만 deferred를 추가한다 —
// 한 배열을 공유하면 G18이 후속 이연을 계획 문서에 허용하게 된다.
// `open`(해결 전)도 execute 전용이다. repair wave에서 coordinator가 해결 전 must_fix를
// 기록할 값이며 note를 요구하지 않는다(NOTE_REQUIRED_STATUS에 넣지 않는다).
const CONTEXT_REVIEW_STATUS = ['resolved', 'accepted'];
const EXECUTE_REVIEW_STATUS = ['resolved', 'accepted', 'deferred', 'open'];
const REVIEW_STATUS = CONTEXT_REVIEW_STATUS;
const NOTE_REQUIRED_STATUS = ['accepted', 'deferred'];
const FINDING_ACTIONABILITY = ['must_fix', 'advisory'];
const FINDING_ORIGIN = ['discovery', 'introduced_by_revision', 'missed_critical'];
// `context-review record` 입력(--round)의 finding status. 진행 중 보고는 해결 전 `open`을
// 허용하지만 context-review.md에 남는 canonical 값(CONTEXT_REVIEW_STATUS)에는 `open`이 없다.
// 도움말과 record 검증이 같은 배열을 보게 해 두 곳이 어긋나는 일을 막는다.
const REPORT_FINDING_STATUS = ['open', ...CONTEXT_REVIEW_STATUS];
// canonical context round 계약(discovery 또는 discovery→delta)의 mode 순서.
// ROUND_MODE(critical_recovery 포함)와 달리 record가 받는 순서 있는 두 값만 담는다.
const CONTEXT_ROUND_MODES = ['discovery', 'delta'];
// `context-review record --status`의 허용 값.
const CONTEXT_REPORT_STATUS = ['requested', 'addressed', 'accepted'];
const ROUND_MODE = ['discovery', 'delta', 'critical_recovery'];
// adaptive Execute는 combined를 추가하고, legacy 네 이름은 기존 round를 계속
// 통과시킨다. security는 위험 flag가 있을 때만 별도 call로 붙는다.
const REVIEW_PERSPECTIVE = [
  'combined',
  'spec_scope',
  'correctness_tests',
  'minimality_maintainability',
  'security',
];
// adaptive Plan은 combined·local·global을 쓰되, legacy 네 관점 round도 읽는다.
// execute 관점과 이름을 섞지 않아야 G18이 diff 리뷰 원장을 계획 원장으로 오인하지 않는다.
const CONTEXT_REVIEW_PERSPECTIVE = [
  'combined',
  'local',
  'global',
  'cross_document',
  'scope',
  'korean_quality',
  'success_criteria',
];
// execute fingerprint는 접두가 없고 context fingerprint만 이 접두를 갖는다. 두 원장이
// 같은 문자열을 만들 수 없게 해 finding을 다른 리뷰로 옮겨 적는 실수를 게이트가 잡는다.
const CONTEXT_FINDING_NAMESPACE = 'context';
// review-snapshot의 id 형식과 같다(64자 소문자 hex). 모듈을 import하면 검증기가 git 수집 코드에 묶인다.
const SNAPSHOT_ID_RE = /^[0-9a-f]{64}$/;

/**
 * round 원장 검사에서 execute와 context가 달라지는 값만 모은다.
 * target: execute는 commit 쌍(base·head), context는 controller가 계산한 계획 snapshot digest.
 * counters: new/resolved/regressed·previous_finding_ids는 execute 원장 필드다 — context
 * round 계약에는 없으므로 요구하면 새 기록이 존재하지 않는 필드 때문에 막힌다.
 * context에는 critical recovery가 없어 허용 mode와 순서가 더 짧다.
 */
type RoundContract = {
  modes: readonly string[];
  sequences: readonly string[];
  perspectives: readonly string[];
  targetKeys: readonly string[];
  targetKey: string;
  perspectiveTargetKey: string;
  counters: boolean;
};

const EXECUTE_ROUND_CONTRACT: RoundContract = {
  modes: ROUND_MODE,
  sequences: ['discovery', 'discovery,delta', 'discovery,delta,critical_recovery,delta'],
  perspectives: REVIEW_PERSPECTIVE,
  targetKeys: ['base', 'head'],
  targetKey: 'head',
  perspectiveTargetKey: 'target_head',
  counters: true,
};

// repair wave 상한의 단일 출처. coordinator ledger 검사(runtime-state)와 blueprint
// 최종 리뷰 라운드 순서(BLUEPRINT_ROUND_CONTRACT)가 같은 값을 보게 해, 한쪽만 바뀌어
// "wave는 허용하는데 그 뒤 리뷰는 기록할 수 없는" 불일치가 재발하지 않게 한다.
const REPAIR_WAVE_LIMIT = 2;

// blueprint 최종 리뷰 전용 계약. repair wave마다 delta 라운드 하나를 기록해야 하므로
// task 계약의 순서에 `discovery` 뒤 delta를 wave 상한만큼 붙인 순서를 더한다.
// critical_recovery를 섞은 새 조합은 일부러 열지 않는다. task 범위(G14)는 계속
// EXECUTE_ROUND_CONTRACT를 써서 라운드 상한이 늘지 않는다.
const BLUEPRINT_ROUND_CONTRACT: RoundContract = {
  ...EXECUTE_ROUND_CONTRACT,
  sequences: [
    ...EXECUTE_ROUND_CONTRACT.sequences,
    ['discovery', ...Array<string>(REPAIR_WAVE_LIMIT).fill('delta')].join(','),
  ],
};

const CONTEXT_ROUND_CONTRACT: RoundContract = {
  modes: ['discovery', 'delta'],
  sequences: ['discovery', 'discovery,delta'],
  perspectives: CONTEXT_REVIEW_PERSPECTIVE,
  targetKeys: ['digest'],
  targetKey: 'digest',
  perspectiveTargetKey: 'target_digest',
  counters: false,
};

// G10과 동일한 비어 있음 계약: 제목은 있고, comment-strip 후 본문이 있어야 함.
// comprehension module이 어떤 section이 있는지 SSOT가 되도록 key는
// EXPLAIN_SECTION_DEFS를 반영; regex는 parseSections 옆에 둠.
const EXPLAIN_SECTION_HEADINGS: SectionDef[] = [
  { key: 'background', re: /^##\s+Background\s*$/i },
  { key: 'intuition', re: /^##\s+Intuition\s*$/i },
  { key: 'code', re: /^##\s+Code\s*$/i },
  { key: 'quiz', re: /^##\s+Quiz\s*$/i },
  // 옛 explain의 ## 이해 상태를 따로 떼는 비필수 키. 정규식을 지우면 본문이 quiz에 흡수된다.
  { key: 'understanding', re: /^##\s+이해\s*상태\s*$/i },
  // task 맥락은 finalize가 선택적으로 채우며 G16 필수 목록과 분리한다.
  { key: 'tasks', re: /^##\s+Tasks\s*$/i },
];

// 작성 가이드는 HTML comment로 제공되므로, 가이드만 있는 section은 미작성으로
// 본다. 비어 있음 검사 전에 comment를 제거하면 "section은 있으나 비어 있음"이
// template에 본문이 실리기 전과 같은 의미를 유지. tasks뿐 아니라 section을
// 파싱하는 모든 문서에 적용.
function stripComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '');
}

// template이 쓰는 유일한 placeholder 형식. 실제 본문과 구분되어 걸리지 않음 —
// Interface의 `<T>` generic은 그대로 허용.
const TODO_RE = /<TODO:[^>\n]*>/;

function parseSections(body: unknown, defs: SectionDef[]): Record<string, string | null> {
  const text = typeof body === 'string' ? stripComments(body) : '';
  const lines = text.split('\n');
  const starts: Array<{ key: string; line: number }> = [];
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

function parseTasksSections(body: unknown): Record<string, string | null> {
  return parseSections(body, SECTION_DEFS);
}

function parseExplainSections(body: unknown): Record<string, string | null> {
  return parseSections(body, EXPLAIN_SECTION_HEADINGS);
}

// Touch/Do-not-touch는 백틱 경로와 민줄 경로를 섞어 쓴다. 한쪽만 모으면
// G11(Touch 근거) / G12(금지 교차)가 표기 차이로 빗나간다.
function extractPathCandidates(text: unknown): string[] {
  const raw = typeof text === 'string' ? text : '';
  const found = new Set<string>();
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

type TouchRow = {
  change: 'Create' | 'Modify' | 'Delete' | 'Rename';
  path: string;
  renameTo: string | null;
};
const TOUCH_CHANGES: readonly string[] = ['Create', 'Modify', 'Delete', 'Rename'];

/**
 * Touch 절의 Markdown 표 행을 `변경` 열 기준으로 읽는다. G25가 "어느 경로를 수정·삭제·
 * 이름 변경하는가"를 판정하려면 경로 후보만 모으는 extractPathCandidates로는 부족하다.
 * 머리행·구분행, `변경` 값이 네 값 밖인 행, 표가 아닌 줄(bullet Touch)은 조용히 건너뛴다 —
 * 형식 판정은 G10·S 코드의 몫이고 여기서 실패로 만들면 기존 문서가 막힌다.
 *
 * @param {string} touchText - parseTasksSections(body).touch 본문
 * @returns {TouchRow[]} 행 순서대로의 `{ change, path, renameTo }`. Rename은 경로 칸을
 *   `→`로 나눠 path=old, renameTo=new로 두고, `→`가 없으면 renameTo는 null이다
 */
function parseTouchRows(touchText: unknown): TouchRow[] {
  const rows: TouchRow[] = [];
  const norm = (cell: string): string =>
    toPosix(cell.replace(/`/g, '').trim()).replace(/^\.\//, '');
  for (const line of (typeof touchText === 'string' ? touchText : '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    const change = cells[2];
    if (cells.length < 3 || !TOUCH_CHANGES.includes(change)) continue;
    const [first, second] = cells[0].split('→');
    const rowPath = norm(first);
    if (!rowPath) continue;
    const renameTo = change === 'Rename' && second !== undefined && norm(second) ? norm(second) : null;
    rows.push({ change: change as TouchRow['change'], path: rowPath, renameTo });
  }
  return rows;
}

// 디렉터리 prefix도 교차로 본다. `scripts/` 금지가 `scripts/lib/x.js`를
// 통과시키면 G12가 파일 단위 affected_paths를 놓친다.
function pathsOverlap(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function pathJustifiedByTouch(ap: string, touchText: string): boolean {
  if (touchText.includes(ap)) return true;
  return extractPathCandidates(touchText).some(
    (c) => ap === c || ap.startsWith(c.endsWith('/') ? c : `${c}/`),
  );
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * finding의 file 경로 정규화(posix·trim·앞 `./` 제거). fingerprint와 병합 후보 계산이
 * 같은 규칙을 써야 두 경로가 같은 파일을 다르게 판단하지 않는다. 대소문자는 접지 않는다.
 *
 * @param {unknown} file - finding.file 원본
 * @returns {string} 정규화한 경로
 */
function normalizeFindingFile(file: unknown): string {
  return toPosix(String(file ?? '').trim()).replace(/^\.\//, '');
}

/**
 * finding 식별자를 한 곳에서 정규화한다. review 작성자마다 `./`·대소문자가 달라
 * 같은 문제를 새 finding으로 기록하는 일을 막기 위해, namespace는 후속 계약이
 * 필요할 때만 정규형 앞에 붙인다.
 */
function findingFingerprint({
  category, brief_clause, file, symbol,
}: {
  category: unknown; brief_clause: unknown; file: unknown; symbol: unknown;
}, namespace?: string): string {
  const normalized = [
    String(category ?? '').trim().toLowerCase(),
    String(brief_clause ?? '').trim().toLowerCase(),
    normalizeFindingFile(file),
  ].join(':');
  const fingerprint = `${normalized}#${String(symbol ?? '').trim()}`;
  return namespace ? `${namespace}:${fingerprint}` : fingerprint;
}

/**
 * 한 round의 finding 중 정규화 file·trim symbol이 같고 category가 둘 이상인 묶음을
 * 병합 후보로 돌려준다. 관점이 다른 리뷰어가 같은 문제를 다른 fingerprint로 보고해도
 * controller가 병합 여부를 판단할 수 있게 알리는 용도이며, 기록을 막지 않는다.
 * 던지지 않는다: 배열이 아니거나, 객체가 아니거나, file·symbol이 비었거나 문자열이 아닌
 * 항목은 조용히 건너뛴다(형식 거절은 collectFindingFailures의 책임).
 *
 * @param {unknown[]} findings - 기록 중인 round의 finding 목록
 * @returns {Array<{code: 'finding-merge-candidate', file: string, symbol: string, ids: string[]}>}
 *   후보 묶음(첫 등장 순서). ids는 입력 순서이며 id가 없는 항목은 ids에서 빠진다.
 */
function findingMergeCandidates(findings: unknown[]): Array<{
  code: 'finding-merge-candidate'; file: string; symbol: string; ids: string[];
}> {
  if (!Array.isArray(findings)) return [];
  const groups = new Map<string, { file: string; symbol: string; ids: string[]; categories: Set<string> }>();
  for (const item of findings) {
    if (typeof item !== 'object' || item === null) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.file !== 'string' || typeof rec.symbol !== 'string') continue;
    const file = normalizeFindingFile(rec.file);
    const symbol = rec.symbol.trim();
    if (file === '' || symbol === '') continue;
    // 구분자 충돌을 피하려고 JSON 배열을 키로 쓴다.
    const key = JSON.stringify([file, symbol]);
    let group = groups.get(key);
    if (!group) {
      group = { file, symbol, ids: [], categories: new Set() };
      groups.set(key, group);
    }
    if (typeof rec.id === 'string') group.ids.push(rec.id);
    group.categories.add(String(rec.category ?? '').trim().toLowerCase());
  }
  return [...groups.values()]
    .filter((g) => g.categories.size >= 2)
    .map((g) => ({ code: 'finding-merge-candidate' as const, file: g.file, symbol: g.symbol, ids: g.ids }));
}

function missingFindingField(record: Record<string, unknown>, field: string): boolean {
  const value = record[field];
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/**
 * 리뷰 finding 형식 실패를 모은다. 본문 판정 문장은 읽지 않는다 —
 * heading 존재와 id/severity/status/note, 그리고 선택적 rounds[]만 본다.
 *
 * G14와 G18이 헬퍼를 공유하되 allowedStatuses로 계약을 가른다. 한 배열을
 * 쓰면 deferred가 계획 문서에 새거나, execute가 기존 resolved/accepted를
 * 잃는다. findings가 있는데 배열이 아니면 []로 떨어뜨리지 않는다. 빈 배열과
 * 같게 취급하면 형식 위반이 통과한다. 부재(undefined/null)만 빈 목록으로 본다.
 * rounds는 키가 없을 때만 건너뛴다 — 구문서는 원장 없이 읽고, 새 컨트롤러는
 * 실행한 round마다 적는다.
 *
 * @param {unknown} body - 리뷰 문서 본문
 * @param {unknown} findings - `bouncer.*.findings`
 * @param {string} sectionLabel - ## Findings 부재 메시지에 쓰는 문서 이름
 * @param {string} findingLabel - finding/round 메시지 접두
 * @param {readonly string[]} allowedStatuses - execute 또는 context 허용 status
 * @param {unknown} [rounds] - execute `bouncer.review.rounds` 또는 context
 *   `bouncer.context_review.rounds`. 부재면 검사 생략
 * @param {'context'} [namespace] - context review면 fingerprint 접두와 context round 계약.
 *   생략하면 execute 계약(접두 없음, commit target)
 * @param {'blueprint'} [roundScope] - blueprint 최종 리뷰면 execute namespace에서
 *   BLUEPRINT_ROUND_CONTRACT를 쓴다. context namespace에서는 무시한다
 * @returns {string[]} 게이트 메시지. 없으면 빈 배열
 */
function collectFindingFailures({
  body, findings, sectionLabel, findingLabel, allowedStatuses, rounds, reviewStatus, namespace, roundScope,
}: {
  body: unknown;
  findings: unknown;
  sectionLabel: string;
  findingLabel: string;
  allowedStatuses: readonly string[];
  rounds?: unknown;
  reviewStatus?: unknown;
  namespace?: typeof CONTEXT_FINDING_NAMESPACE;
  roundScope?: 'blueprint';
}): string[] {
  const messages: string[] = [];
  const rs = parseSections(typeof body === 'string' ? body : '', REVIEW_SECTION_DEFS);
  if (!rs.findings) {
    messages.push(`${sectionLabel} missing ## Findings body section`);
  }
  if (findings != null && !Array.isArray(findings)) {
    messages.push(`${findingLabel} findings must be an array`);
    return messages;
  }
  const list: unknown[] = Array.isArray(findings) ? findings : [];
  const modeContract = Array.isArray(rounds) && rounds.some((entry) => isRecord(entry) && entry.mode !== undefined);
  const fingerprints = new Set<string>();
  for (const fnd of list) {
    const rec = isRecord(fnd) ? fnd : fnd as Record<string, unknown>;
    const id = rec && rec.id ? rec.id : '(no id)';
    if (!(REVIEW_SEVERITY as readonly unknown[]).includes(rec && rec.severity)) {
      messages.push(`${findingLabel} finding ${id} severity invalid: ${rec && rec.severity}`);
    }
    if (!(allowedStatuses as readonly unknown[]).includes(rec && rec.status)) {
      messages.push(`${findingLabel} finding ${id} status invalid: ${rec && rec.status}`);
    } else if (
      (NOTE_REQUIRED_STATUS as readonly unknown[]).includes(rec && rec.status)
      && (!rec.note || String(rec.note).trim() === '')
    ) {
      messages.push(`${findingLabel} finding ${id} ${String(rec.status)} without note`);
    }
    // open은 accepted 문서에 남을 수 없다. actionability·mode 유무와 무관해야 하므로
    // modeContract 블록 밖에서 본다(mode 없는 구문서와 advisory도 같은 답을 낸다).
    // G18은 reviewStatus를 넘기지 않고 open을 status invalid로 먼저 거절한다.
    if (reviewStatus === 'accepted' && rec && rec.status === 'open') {
      messages.push(`${findingLabel} finding ${id} open in accepted review`);
    }
    if (modeContract && rec) {
      for (const field of [
        'category', 'brief_clause', 'file', 'symbol', 'fingerprint', 'actionability',
        'origin', 'first_seen_round', 'last_seen_round',
      ]) {
        if (missingFindingField(rec, field)) messages.push(`${findingLabel} finding ${id} ${field} missing`);
      }
      // context category는 finding이 나온 관점 이름이다. fingerprint 일치만 보면 execute
      // 관점(spec_scope 등)을 category와 fingerprint에 함께 적은 finding이 통과한다.
      // execute(G14) category는 자유 분류라 이 검사를 context namespace에만 건다.
      if (
        namespace === CONTEXT_FINDING_NAMESPACE && !missingFindingField(rec, 'category')
        && !CONTEXT_REVIEW_PERSPECTIVE.includes(rec.category as string)
      ) {
        messages.push(`${findingLabel} finding ${id} category invalid: ${String(rec.category)}`);
      }
      if (!missingFindingField(rec, 'fingerprint')) {
        const fingerprint = String(rec.fingerprint);
        const hasContextPrefix = fingerprint.startsWith(`${CONTEXT_FINDING_NAMESPACE}:`);
        // namespace 판정을 mismatch보다 먼저 한다. 접두만 틀린 경우를 mismatch로
        // 보고하면 작성자가 구성 요소를 고치려 들고, 원장 혼동이라는 원인이 가려진다.
        if (namespace ? !hasContextPrefix : hasContextPrefix) {
          messages.push(`${findingLabel} finding ${id} fingerprint namespace invalid`);
        } else if (fingerprint !== findingFingerprint({
          category: rec.category, brief_clause: rec.brief_clause, file: rec.file, symbol: rec.symbol,
        }, namespace)) {
          messages.push(`${findingLabel} finding ${id} fingerprint mismatch`);
        }
        if (fingerprints.has(fingerprint)) messages.push(`${findingLabel} duplicate fingerprint ${fingerprint}`);
        fingerprints.add(fingerprint);
      }
      if (!(FINDING_ACTIONABILITY as readonly unknown[]).includes(rec.actionability)) {
        messages.push(`${findingLabel} finding ${id} actionability invalid`);
      }
      if (!(FINDING_ORIGIN as readonly unknown[]).includes(rec.origin)) {
        messages.push(`${findingLabel} finding ${id} origin invalid`);
      }
      // context namespace(G18)는 reviewStatus 인자가 생략되더라도 게이트 진입 조건에서 이미 status=accepted를
      // 확인하므로 accepted 검사를 적용한다. execute(G14)는 reviewStatus === 'accepted'일 때 검사한다.
      // context namespace에서만 명시적 사용자 동의가 반영된 accepted_risk: true(비어 있지 않은 note 필수)를
      // 예외로 인정하며, execute namespace에서는 accepted_risk를 인정하지 않는다.
      const isReviewAccepted = reviewStatus === 'accepted' || namespace === CONTEXT_FINDING_NAMESPACE;
      const isContextAcceptedRisk = namespace === CONTEXT_FINDING_NAMESPACE
        && rec.status === 'accepted'
        && rec.accepted_risk === true
        && typeof rec.note === 'string'
        && rec.note.trim() !== '';
      if (isReviewAccepted && rec.actionability === 'must_fix' && rec.status !== 'resolved' && !isContextAcceptedRisk) {
        messages.push(`${findingLabel} accepted with open must_fix ${id}`);
      }
    }
  }
  messages.push(...collectRoundFailures(
    rounds, findingLabel, list, modeContract,
    namespace === CONTEXT_FINDING_NAMESPACE
      ? CONTEXT_ROUND_CONTRACT
      : (roundScope === 'blueprint' ? BLUEPRINT_ROUND_CONTRACT : EXECUTE_ROUND_CONTRACT),
  ));
  return messages;
}

/**
 * 선택적 round ledger 형식 실패를 모은다. 집계는 문자열·소수가 아니라
 * 정수여야 하고, round 번호는 중복·역순이면 이전 finding 관계를 믿을 수 없다.
 * execute 계약(`contract.counters`)의 delta round는 perspectives가 2개 이상이면
 * 거절한다 — review record·G14·G21이 같은 메시지를 공유하도록 여기서만 건다.
 *
 * @param {unknown} rounds - `bouncer.review.rounds` 또는 `bouncer.context_review.rounds`.
 *   undefined면 구문서 호환으로 통과
 * @param {string} findingLabel - 메시지 접두
 * @param {unknown[]} findings - finding 목록. delta origin 검사에만 쓴다
 * @param {boolean} modeContract - mode·target·perspective 검사를 켤지
 * @param {RoundContract} contract - execute 또는 context round 계약
 * @returns {string[]} 형식 실패 메시지
 */
function collectRoundFailures(
  rounds: unknown, findingLabel: string, findings: unknown[] = [], modeContract = false,
  contract: RoundContract = EXECUTE_ROUND_CONTRACT,
): string[] {
  if (rounds === undefined) return [];
  if (!Array.isArray(rounds)) {
    return [`${findingLabel} rounds must be an array`];
  }
  const messages: string[] = [];
  const seen = new Set<number>();
  let lastRound = 0;
  const modes: string[] = [];
  const modeByRound = new Map<number, unknown>();
  for (const entry of rounds) {
    if (!isRecord(entry)) {
      messages.push(`${findingLabel} rounds entry invalid`);
      continue;
    }
    if (!isPositiveInteger(entry.round)) {
      messages.push(`${findingLabel} rounds round invalid: ${entry.round}`);
      continue;
    }
    const round = entry.round as number;
    if (seen.has(round)) {
      messages.push(`${findingLabel} rounds duplicate round: ${round}`);
    } else if (lastRound !== 0 && round < lastRound) {
      messages.push(`${findingLabel} rounds out of order`);
    }
    seen.add(round);
    lastRound = round;
    if (modeContract) {
      if (!contract.modes.includes(entry.mode as string)) {
        messages.push(`${findingLabel} round ${round} mode invalid`);
      } else {
        modes.push(entry.mode as string);
        modeByRound.set(round, entry.mode);
      }
      const target = isRecord(entry.target) ? entry.target : undefined;
      if (!target || contract.targetKeys.some((key) => !target[key])) {
        messages.push(`${findingLabel} round ${round} target invalid`);
      }
      // snapshot_id는 새 라운드에만 있고 과거 저장 기록에는 없으므로 부재는 허용하고 있을 때만
      // 형식을 본다. counters로 execute 계약에만 적용해 context digest 계약을 건드리지 않는다.
      // 파일 존재·현재 freshness는 쓰기 시점의 recorder가 판정한다.
      if (
        contract.counters && target && target.snapshot_id !== undefined
        && !(typeof target.snapshot_id === 'string' && SNAPSHOT_ID_RE.test(target.snapshot_id))
      ) {
        messages.push(`${findingLabel} round ${round} target snapshot_id invalid`);
      }
      if (entry.perspectives !== undefined) {
        const perspectives = Array.isArray(entry.perspectives) ? entry.perspectives : [entry.perspectives];
        for (const perspective of perspectives) {
          const item = isRecord(perspective) ? perspective : {};
          const name = typeof item.name === 'string' ? item.name : String(item.name ?? '(no name)');
          if (!contract.perspectives.includes(item.name as string)) {
            messages.push(`${findingLabel} round ${round} perspective invalid ${name}`);
          } else if (target && item[contract.perspectiveTargetKey] !== target[contract.targetKey]) {
            messages.push(`${findingLabel} round ${round} target mismatch ${name}`);
          }
        }
        // execute 계약 delta만 reviewer 하나를 강제한다. mode 값만 보면 context
        // delta(counters:false)도 걸리므로 counters로 구분한다. 이름 검사와
        // 독립 — 잘못된 이름도 count에 넣어 개수 위반이 가려지지 않게 한다.
        if (contract.counters && entry.mode === 'delta' && perspectives.length >= 2) {
          messages.push(
            `${findingLabel} round ${round} delta perspectives invalid: ${perspectives.length}`,
          );
        }
      }
    }
    if (!contract.counters) continue;
    if (
      !Array.isArray(entry.previous_finding_ids)
      || entry.previous_finding_ids.some((id) => typeof id !== 'string')
    ) {
      messages.push(`${findingLabel} round ${round} previous_finding_ids invalid`);
    }
    for (const key of ['new', 'resolved', 'regressed'] as const) {
      if (!isNonNegativeInteger(entry[key])) {
        messages.push(`${findingLabel} round ${round} ${key} invalid: ${entry[key]}`);
      }
    }
  }
  if (modeContract) {
    if (!contract.sequences.includes(modes.join(','))) messages.push(`${findingLabel} rounds sequence invalid`);
    for (const entry of findings) {
      if (!isRecord(entry) || !isPositiveInteger(entry.first_seen_round)) continue;
      if (modeByRound.get(entry.first_seen_round as number) !== 'delta') continue;
      const allowed = entry.origin === 'introduced_by_revision'
        || (entry.origin === 'missed_critical' && (entry.severity === 'blocker' || entry.severity === 'major'));
      if (!allowed) {
        const id = entry.id ? entry.id : '(no id)';
        messages.push(`${findingLabel} finding ${id} delta origin not allowed`);
      }
    }
  }
  return messages;
}

export = {
  SECTION_DEFS,
  VERIFY_SECTION_DEFS,
  REVIEW_SECTION_DEFS,
  REVIEW_SEVERITY,
  REVIEW_STATUS,
  CONTEXT_REVIEW_STATUS,
  CONTEXT_REVIEW_PERSPECTIVE,
  FINDING_ACTIONABILITY,
  FINDING_ORIGIN,
  REPORT_FINDING_STATUS,
  CONTEXT_ROUND_MODES,
  CONTEXT_REPORT_STATUS,
  EXECUTE_REVIEW_STATUS,
  EXPLAIN_SECTION_HEADINGS,
  TODO_RE,
  stripComments,
  parseSections,
  parseTasksSections,
  parseExplainSections,
  extractPathCandidates,
  parseTouchRows,
  pathsOverlap,
  pathJustifiedByTouch,
  findingFingerprint,
  findingMergeCandidates,
  collectFindingFailures,
  EXECUTE_ROUND_CONTRACT,
  BLUEPRINT_ROUND_CONTRACT,
  REPAIR_WAVE_LIMIT,
};
