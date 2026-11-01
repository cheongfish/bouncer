'use strict';

// 동결된 review snapshot 하나에서 "어떤 함수가 바뀌었는지"를 줄 단위로 뽑고, collectDiffIntent로 그 후보에
// 기준 SHA의 intent 근거를 붙여 리뷰 입력용 슬롯을 만든다.
// 입력은 snapshot의 diff·files와 base 커밋, 그리고 고정 SHA 조회뿐이다. base 쪽 정의와 blob은 intent-revision이
// 고정 SHA에서 읽고, snapshot 쪽 정의는 files[].content에서만 얻는다. 작업 트리는 다시 읽지 않으므로 같은 입력은 같은 답을 낸다.
// 쓰기는 하지 않는다(소스·index·branch·snapshot artifact 모두). CLI 출력 연결은 다음 task가 맡는다.

import intentRevision = require('./intent-revision');
import symbolIndex = require('./symbol-index');
import canonicalJson = require('./canonical-json');
import intentProvenance = require('./intent-provenance');
const { createHash } = require('node:crypto');
const { sha256Canonical } = canonicalJson;

type FileDefinitions = ReturnType<typeof symbolIndex.listDefinitionsInText>;
type ParsedFile = Extract<FileDefinitions, { status: 'parsed' }>;
type SymbolRef = ParsedFile['definitions'][number];
// base 쪽은 고정 SHA 트리에서 읽은 결과다. 파싱 결과에 더해 symlink·submodule·absent 상태가 붙는다.
type BaseFile = ReturnType<typeof intentRevision.listDefinitionsAtRevision>;
type Role = 'source' | 'generated' | 'test' | 'vendor';
type SnapshotKind = 'text' | 'binary' | 'symlink' | 'deleted';
type SnapshotFile = { path: string; kind: SnapshotKind; content: string };
type DiffSnapshot = { target: { base: string; head: string }; diff: string; files: SnapshotFile[] };
type CoverageStatus = 'covered' | 'excluded' | 'unsupported' | 'parse_failed';
type CoverageReason = 'role:test' | 'role:generated' | 'role:vendor' | 'binary' | 'symlink' | 'submodule'
  | 'extension' | 'declaration-file' | 'base' | 'snapshot';
type FileCoverage = {
  path: string;
  role: Role | null;
  status: CoverageStatus;
  reason?: CoverageReason;
  added_lines: number;
  deleted_lines: number;
  non_function_lines: number;
};
type Mapping = 'paired' | 'deleted' | 'added' | 'moved' | 'ambiguous_mapping';
type Candidate = {
  mapping: Mapping;
  base_ref: SymbolRef | null;
  snapshot_ref: SymbolRef | null;
  added_lines: number;
  deleted_lines: number;
  touched_by_nested: boolean;
};
type ExtractResult = {
  snapshot_id: string;
  base: string;
  history_ref: string;
  files: FileCoverage[];
  candidates: Candidate[];
};

// diff 한 섹션. 같은 경로의 typechange 쌍은 두 섹션이 index 순서대로 붙어 있어야 하나로 합친다.
type DiffSection = {
  index: number;
  path: string;
  type: 'modify' | 'new' | 'deleted';
  // deleted는 base 좌표, added는 snapshot 좌표의 줄 번호다.
  deleted: number[];
  added: number[];
};

// 파일 하나의 변경 재료. 파싱 전이라 아직 coverage를 모른다.
type FileWork = {
  path: string;
  kind: SnapshotKind;
  content: string;
  deleted: number[];
  added: number[];
  base: BaseFile;
  snap: FileDefinitions | null;
};

// 정의 하나가 자기 쪽 변경 줄을 얼마나 가졌는지. 한 정의는 같은 쪽 후보에 정확히 한 번만 들어간다.
type DefState = { ref: SymbolRef; touched: boolean; nested: boolean; own: number };

// 이동·삭제·추가 후보를 본문 묶음으로 맞추기 전까지 들고 있는 대기열 항목.
type Pending = { state: DefState; body: string };

const DIFF_HEADER = 'diff --git ';
// `@@ -a[,b] +c[,d] @@`. 줄 수가 생략되면 1이다. 뒤의 함수명 문맥은 무시한다.
const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
// hunk 바로 앞뒤에 오지 않는 줄을 헤더 메타로 허용하는 접두어 목록이다. `--- `·`+++ `는 hunk 바깥에서만 나온다.
const META_PREFIXES = [
  'index ', 'old mode ', 'new mode ', 'new file mode ', 'deleted file mode ', 'similarity index ',
  'dissimilarity index ', 'rename from ', 'rename to ', 'copy from ', 'copy to ', '--- ', '+++ ',
  'Binary files ', 'GIT binary patch',
];
const SNAPSHOT_KINDS: ReadonlySet<unknown> = new Set<unknown>(['text', 'binary', 'symlink', 'deleted']);
const C_ESCAPES: Readonly<Record<string, number>> = {
  a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92,
};

// 근거 조회 결과는 resolveIntentAtRevision의 반환 형태를 그대로 빌린다. 이 모듈이 필드를 따로 정의하면 두 벌이 갈라진다.
type LookupResult = ReturnType<typeof intentProvenance.resolveIntentAtRevision>;
type LookupCandidate = LookupResult['candidates'][number];
type Lookup = (input: { repoRoot: string; historyRef: string; symbolRef: SymbolRef; limit?: number }) => LookupResult;
// base_ref가 있어 근거를 조회할 수 있는 후보다. 짝 없는 added와 snapshot 쪽 ambiguous는 base_ref가 없어 여기 들지 않는다.
type Queryable = Candidate & { base_ref: SymbolRef };
type Evidence = 'linked' | 'unlinked' | 'added_no_history' | 'not_queried';
type Delivery = 'selected' | 'omitted_by_count' | 'omitted_by_bytes' | 'manifest_only';
// 조회 대상 중 슬롯 시험을 통과했는지만 정한다. 나머지 전달 상태는 순위 밖이나 base_ref 없음으로 정해진다.
type PackDelivery = 'selected' | 'omitted_by_bytes';
type Section = { name: string; body: string };
type EntryCandidate = Omit<LookupCandidate, 'sections'> & { sections: Section[]; sections_omitted: number };
type Entry = {
  rank: number;
  mapping: Mapping;
  base_ref: SymbolRef | null;
  snapshot_ref: SymbolRef | null;
  added_lines: number;
  deleted_lines: number;
  touched_by_nested: boolean;
  evidence: 'linked' | 'unlinked';
  explain_docs: number;
  total_linked: number;
  candidates: EntryCandidate[];
};
type ManifestCandidate = Candidate & { rank: number | null; evidence: Evidence; delivery: Delivery };
type Summary = {
  changed_files: number;
  files_not_covered: number;
  candidates_total: number;
  queryable: number;
  selected: number;
  omitted_by_count: number;
  omitted_by_bytes: number;
  added_no_history: number;
  ambiguous_mapping: number;
  unlinked: number;
};
// 조회 전에도 정해지는 요약 값이다. selected와 omitted_by_bytes만 슬롯 시험 중에 달라진다.
type SummaryBase = Omit<Summary, 'selected' | 'omitted_by_bytes'>;
type Slot = { summary: Summary; entries: Entry[]; manifest_digest: string; bundle_dedupe: 'not_applied' };
// 순위 순서의 조회 행 하나. rank는 1부터 센 queryable 순위다.
type Row = { rank: number; candidate: Queryable; result: LookupResult };

// 조회 대상 상한과 전달 예산. budget_policy 'intent-diff-budget/1'의 값이며 외부에 노출하지 않는다.
const MAX_ENTRIES = 8;
const BODY_BYTES = 3072;
const SLOT_BYTES = 12288;
const BUDGET_POLICY = 'intent-diff-budget/1';
const PROJECTION_VERSION = 'intent-diff/1';
// 슬롯 시험 직렬화에서 manifest_digest 자리에 넣는 값이다. sha256 hex는 항상 64자라 길이만 맞으면 크기가 정확하다.
const DIGEST_PLACEHOLDER = '0'.repeat(64);

/**
 * 동결된 snapshot에서 base 대비 바뀐 함수 후보와 파일별 coverage를 뽑는다.
 * base 정의는 historyRef의 고정 SHA에서, snapshot 정의는 files[].content에서 얻는다. 쓰기와 작업 트리 읽기는 없다.
 * 입력 형태·diff·files 일관성 위반과 Git 실패는 throw한다. 변경이 없는 파일이나 지원 불가 파일은 throw하지 않고
 * coverage 상태로 돌려준다.
 *
 * @param {object} input - 추출 입력
 * @param {string} input.repoRoot - 저장소 루트. Git 읽기의 cwd다
 * @param {DiffSnapshot} input.snapshot - 동결된 review snapshot의 target·diff·files
 * @param {string} input.historyRef - base 커밋을 가리키는 7~40자 소문자 hex. snapshot.target.base와 같아야 한다
 * @returns {ExtractResult} snapshot_id(sha256Canonical(snapshot)), base, history_ref(확정 SHA), files(path 오름차순),
 *   candidates(path·qualified_name·kind·base 시작 줄 오름차순). 변경 함수가 없으면 candidates는 빈 배열이다
 * @throws {Error} historyRef가 거절되거나 base와 다르면, snapshot 형태가 틀리면, diff와 files가 일관되지 않으면,
 *   Git 호출이 실패하면 던진다. 메시지는 비어 있지 않다
 */
function extractChangedFunctions(input: { repoRoot: string; snapshot: DiffSnapshot; historyRef: string }):
  ExtractResult {
  // 1. 형태를 먼저 본다. 형태가 틀린 입력은 Git을 띄우기 전에 거절해 엉뚱한 경로를 읽지 않게 한다.
  const snapshot = requireSnapshotShape(input.snapshot);
  // 2. historyRef를 40자 SHA로 확정하고 snapshot의 base와 같은지 본다. 다르면 다른 커밋의 정의와 섞인다.
  const base = intentRevision.resolveHistoryRef({ repoRoot: input.repoRoot, ref: input.historyRef });
  if (base !== snapshot.target.base) {
    throw new Error(`history ref ${base} does not match snapshot base ${snapshot.target.base}`);
  }
  const snapshotId = canonicalJson.sha256Canonical(snapshot);
  // 3. files를 path로 정렬·검증하고 diff 섹션을 같은 path에 묶는다. 섹션이 files에 없는 경로면 여기서 거절한다.
  const entries = indexSnapshotFiles(snapshot.files);
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  const sectionsByPath = groupSections(parseDiff(snapshot.diff), byPath);
  // 4. 파일마다 변경 줄을 모으고 base·snapshot 정의를 얻는다. 변경이 없는 파일은 null이라 건너뛴다.
  const analyzed: Analyzed[] = [];
  for (const entry of entries) {
    const work = collectFileWork(input.repoRoot, base, entry, sectionsByPath.get(entry.path) ?? []);
    if (work !== null) analyzed.push(analyze(work));
  }
  // 5. 함수 후보는 파일 안에서 짝짓고, 짝이 안 맞는 정의만 전역 본문 묶음으로 이동을 찾는다.
  const candidates = buildCandidates(input.repoRoot, base, analyzed);
  // 6. 파일 coverage 행은 분석 순서가 이미 path 오름차순이다.
  const files = analyzed.map(toCoverageRow);
  return {
    snapshot_id: snapshotId,
    base: snapshot.target.base,
    history_ref: base,
    files,
    candidates,
  };
}

/**
 * 파일 하나의 분석 결과. coverage 행과 후보 재료를 함께 들고 다닌다.
 *
 * @typedef {object} Analyzed
 * @property {FileWork} work - 변경 줄과 base·snapshot 정의 원자료
 * @property {object} coverage - role·status·reason
 * @property {DefState[]} baseStates - base 정의별 변경 상태. coverage가 covered가 아니면 빈 배열이다
 * @property {DefState[]} snapStates - snapshot 정의별 변경 상태. 같은 규칙
 * @property {number} nonFunction - 어떤 정의에도 속하지 않은 변경 줄 수
 */
type Analyzed = {
  work: FileWork;
  coverage: Coverage;
  baseStates: DefState[];
  snapStates: DefState[];
  nonFunction: number;
};

type Coverage = { status: CoverageStatus; reason?: CoverageReason; role: Role | null };

/**
 * snapshot files를 검증하고 path 오름차순으로 돌려준다. 같은 path가 두 번 나오면 어느 쪽이 맞는지 알 수 없으므로 거절한다.
 *
 * @param {SnapshotFile[]} files - snapshot.files
 * @returns {SnapshotFile[]} path 오름차순 복사본
 * @throws {Error} path 형식이 틀리거나 같은 path가 두 번 나오면
 */
function indexSnapshotFiles(files: SnapshotFile[]): SnapshotFile[] {
  const seen = new Set<string>();
  for (const file of files) {
    assertSnapshotPath(file.path);
    if (seen.has(file.path)) throw new Error(`snapshot files list the same path twice: ${file.path}`);
    seen.add(file.path);
  }
  return [...files].sort((left, right) => compareStrings(left.path, right.path));
}

/**
 * diff 섹션을 path별로 묶고, files에 없는 경로가 있으면 거절한다. 섹션 index를 보존해 typechange의
 * 인접 조건을 나중에 확인할 수 있게 한다.
 *
 * @param {DiffSection[]} sections - parseDiff 결과(diff 순서)
 * @param {Map<string, SnapshotFile>} byPath - files의 path 색인
 * @returns {Map<string, DiffSection[]>} path마다 diff 순서대로 묶은 섹션 목록
 * @throws {Error} 섹션의 path가 files에 없으면 `diff section names a path not in files`로 던진다
 */
function groupSections(sections: DiffSection[], byPath: Map<string, SnapshotFile>): Map<string, DiffSection[]> {
  const grouped = new Map<string, DiffSection[]>();
  for (const section of sections) {
    // diff가 files에 없는 파일을 가리키면 추측으로 보정하지 않고 거절한다. 그 파일의 내용을 snapshot이 담지 않았기 때문이다.
    if (!byPath.has(section.path)) throw new Error(`diff section names a path not in files: ${section.path}`);
    const list = grouped.get(section.path) ?? [];
    list.push(section);
    grouped.set(section.path, list);
  }
  return grouped;
}

/**
 * unified diff 전문을 섹션 목록으로 바꾼다. hunk의 `-`·`+` 줄만 변경 줄로 센다. 문맥 줄은 세지 않는다.
 * 줄 번호는 hunk 헤더의 시작 번호에서 센다. 헤더의 줄 수와 본문이 맞지 않으면 추측하지 않고 던진다.
 *
 * @param {string} diff - snapshot.diff. 빈 문자열이면 섹션이 없다
 * @returns {DiffSection[]} diff 순서대로 된 섹션 목록
 * @throws {Error} 섹션 헤더·메타 줄·hunk 줄 수가 형식과 맞지 않으면 던진다. 메시지는 `diff`로 시작한다
 */
function parseDiff(diff: string): DiffSection[] {
  if (diff === '') return [];
  const lines = diff.split('\n');
  // 마지막 줄바꿈 뒤의 빈 조각은 줄이 아니다. 중간의 빈 줄은 hunk 검사에서 거절된다.
  if (lines[lines.length - 1] === '') lines.pop();
  const sections: DiffSection[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    if (!header.startsWith(DIFF_HEADER)) {
      throw new Error(`diff must begin each section with "diff --git": ${header}`);
    }
    const section: DiffSection = {
      index: sections.length,
      path: parseHeaderPath(header.slice(DIFF_HEADER.length)),
      type: 'modify',
      deleted: [],
      added: [],
    };
    i += 1;
    // 1. 메타 줄. new/deleted file mode가 섹션 종류를 정한다. 모르는 메타는 조용히 넘기지 않는다.
    while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith(DIFF_HEADER)) {
      const line = lines[i];
      if (line.startsWith('new file mode ')) section.type = 'new';
      else if (line.startsWith('deleted file mode ')) section.type = 'deleted';
      else if (!META_PREFIXES.some((prefix) => line.startsWith(prefix))) {
        throw new Error(`diff header line is not recognized: ${line}`);
      }
      i += 1;
    }
    // 2. hunk. 섹션마다 0개 이상이다. 바이너리·mode-only·빈 파일 추가는 hunk가 없다.
    while (i < lines.length && lines[i].startsWith('@@')) i = parseHunk(lines, i, section);
    // 3. hunk가 끝난 뒤 남는 줄은 다음 섹션 헤더여야 한다. 아니면 헤더의 줄 수가 본문과 다른 것이다.
    if (i < lines.length && !lines[i].startsWith(DIFF_HEADER)) {
      throw new Error(`diff hunk line count does not match its header: ${lines[i]}`);
    }
    sections.push(section);
  }
  return sections;
}

/**
 * hunk 하나를 헤더 줄 수만큼 읽어 섹션에 변경 줄을 더한다. 줄 수는 헤더 값만 믿고, 본문이 모자라거나 넘치면 던진다.
 * `\ No newline at end of file` 표식은 줄 수에 세지 않는다. 마지막 줄의 개행 유무만 알려 주기 때문이다.
 *
 * @param {string[]} lines - diff 줄 배열(줄바꿈 제외)
 * @param {number} start - `@@` 헤더 줄의 인덱스
 * @param {DiffSection} section - 변경 줄을 더할 섹션(in place)
 * @returns {number} 이 hunk 다음 줄의 인덱스
 * @throws {Error} 헤더 형식이 틀리거나 본문 줄 수가 헤더와 맞지 않으면 `diff ...`로 시작하는 메시지로 던진다
 */
function parseHunk(lines: string[], start: number, section: DiffSection): number {
  const match = HUNK_RE.exec(lines[start]);
  if (match === null) throw new Error(`diff hunk header is malformed: ${lines[start]}`);
  // 줄 수가 생략되면 1이다. `@@ -1 +1 @@`가 그 예다.
  let oldLeft = match[2] === undefined ? 1 : Number(match[2]);
  let newLeft = match[4] === undefined ? 1 : Number(match[4]);
  let oldLine = Number(match[1]);
  let newLine = Number(match[3]);
  let i = start + 1;
  while (oldLeft > 0 || newLeft > 0) {
    if (i >= lines.length) throw new Error(`diff hunk ends before its header counts are met: ${lines[start]}`);
    const line = lines[i];
    i += 1;
    if (line.startsWith('\\')) continue;
    const tag = line.charAt(0);
    if (tag === ' ') {
      if (oldLeft <= 0 || newLeft <= 0) throw new Error(`diff hunk line count does not match its header: ${line}`);
      oldLeft -= 1;
      newLeft -= 1;
      oldLine += 1;
      newLine += 1;
    } else if (tag === '-') {
      if (oldLeft <= 0) throw new Error(`diff hunk line count does not match its header: ${line}`);
      oldLeft -= 1;
      section.deleted.push(oldLine);
      oldLine += 1;
    } else if (tag === '+') {
      if (newLeft <= 0) throw new Error(`diff hunk line count does not match its header: ${line}`);
      newLeft -= 1;
      section.added.push(newLine);
      newLine += 1;
    } else {
      throw new Error(`diff hunk has an invalid line: ${line}`);
    }
  }
  // 줄 수를 다 채운 뒤의 `\` 표식도 세지 않고 넘긴다.
  while (i < lines.length && lines[i].startsWith('\\')) i += 1;
  return i;
}

/**
 * `diff --git` 뒤의 경로 부분에서 저장소 상대 경로를 꺼낸다. git은 비ASCII·제어 문자가 있는 이름만 큰따옴표로
 * 인용하고, 공백만 있는 이름은 인용하지 않는다. 인용되지 않은 경우 `a/P b/P`에서 P는 길이의 절반이다.
 *
 * @param {string} rest - `diff --git ` 다음 문자열
 * @returns {string} `a/` 접두를 뗀 저장소 상대 경로
 * @throws {Error} 두 쪽 경로가 같지 않거나 인용이 깨졌으면 던진다. rename·copy는 --no-renames라 나오지 않는다
 */
function parseHeaderPath(rest: string): string {
  // 1. 인용형. 두 쪽이 같은 이름이라 인용 여부도 같지만, 형식 차이를 허용하도록 쪽마다 읽는다.
  if (rest.startsWith('"')) {
    const left = readCQuoted(rest, 0);
    if (rest.charAt(left.end) !== ' ') throw new Error(`diff header is malformed: ${rest}`);
    const rightText = rest.slice(left.end + 1);
    const right = rightText.startsWith('"')
      ? readCQuoted(rightText, 0)
      : { value: rightText, end: rightText.length };
    if (right.end !== rightText.length || !left.value.startsWith('a/') || right.value !== `b/${left.value.slice(2)}`) {
      throw new Error(`diff header paths differ: ${rest}`);
    }
    return left.value.slice(2);
  }
  // 2. 비인용형. 두 쪽 모두 `P`이므로 전체 길이는 `a/` + P + ` b/` + P = 2P + 5다.
  const length = rest.length;
  if (length < 5 || (length - 5) % 2 !== 0) throw new Error(`diff header is malformed: ${rest}`);
  const p = rest.slice(2, 2 + (length - 5) / 2);
  if (!rest.startsWith('a/') || rest !== `a/${p} b/${p}`) throw new Error(`diff header paths differ: ${rest}`);
  return p;
}

/**
 * git의 C 스타일 인용 문자열 하나를 읽는다. 8진수 이스케이프는 바이트로 보고 UTF-8로 디코딩한다.
 * git은 비ASCII 글자를 바이트 단위 8진수로 인용하므로, 글자 단위로 읽으면 한글 경로가 깨진다.
 *
 * @param {string} text - 여는 따옴표가 `start`에 있는 문자열
 * @param {number} start - 여는 따옴표 인덱스
 * @returns {{ value: string, end: number }} 디코딩한 값과 닫는 따옴표 다음 인덱스
 * @throws {Error} 닫히지 않았거나 알 수 없는 이스케이프가 있으면 던진다
 */
function readCQuoted(text: string, start: number): { value: string; end: number } {
  const bytes: number[] = [];
  let i = start + 1;
  while (i < text.length) {
    const ch = text.charAt(i);
    if (ch === '"') return { value: Buffer.from(bytes).toString('utf8'), end: i + 1 };
    if (ch === '\\') {
      const octal = text.slice(i + 1, i + 4);
      if (/^[0-7]{3}$/.test(octal)) {
        bytes.push(parseInt(octal, 8));
        i += 4;
        continue;
      }
      const escaped = C_ESCAPES[text.charAt(i + 1)];
      if (escaped === undefined) throw new Error(`diff header has an unknown escape: ${text}`);
      bytes.push(escaped);
      i += 2;
      continue;
    }
    // 인용 안의 평문은 코드 포인트 단위로 옮긴다. 보조 평면 글자가 surrogate 쌍으로 쪼개지지 않게 한다.
    const codePoint = String.fromCodePoint(text.codePointAt(i) as number);
    bytes.push(...Buffer.from(codePoint, 'utf8'));
    i += codePoint.length;
  }
  throw new Error(`diff header has an unterminated quoted path: ${text}`);
}

/**
 * 파일 하나의 변경 줄과 원자료를 모은다. diff 섹션이 없으면 base와 내용을 비교해 "추가 파일"과
 * "변경 없음"을 가른다. 변경 없음이면 null이라 coverage 행을 만들지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} base - 확정된 base SHA
 * @param {SnapshotFile} file - snapshot.files의 한 항목
 * @param {DiffSection[]} sections - 이 path의 diff 섹션(diff 순서)
 * @returns {FileWork | null} 변경이 있으면 원자료, 변경이 없으면 null
 * @throws {Error} deleted인데 diff 섹션이 없거나, 섹션 없이 base와 내용이 다르면, 섹션 조합이 맞지 않으면 던진다
 */
function collectFileWork(repoRoot: string, base: string, file: SnapshotFile, sections: DiffSection[]): FileWork | null {
  const { path: rel, kind, content } = file;
  let deleted: number[];
  let added: number[];
  if (sections.length === 0) {
    // 1. diff 섹션이 없으면 base에 그 경로가 있는지로 갈린다. 있으면 같은 text 내용일 때만 변경 없음이다.
    if (kind === 'deleted') throw new Error(`snapshot file is marked deleted but its diff has no section: ${rel}`);
    const blob = intentRevision.readBlobAt({ repoRoot, ref: base, path: rel });
    if (blob.status === 'present') {
      if (kind === 'text' && gitBlobSha(Buffer.from(content, 'utf8')) === blob.blob_sha) return null;
      throw new Error(`snapshot file differs from base but its diff has no section: ${rel}`);
    }
    // 2. base에 없으면 untracked 새 파일이다. 내용 전체가 추가다. binary는 base64라 줄을 세지 않는다.
    deleted = [];
    added = kind === 'binary' ? [] : rangeLines(countLines(content));
  } else {
    // 3. diff 섹션이 있으면 hunk가 준 줄 번호를 그대로 쓴다.
    ({ deleted, added } = sectionChanges(rel, kind, sections));
  }
  const baseFile = intentRevision.listDefinitionsAtRevision({ repoRoot, ref: base, path: rel });
  // binary 본문은 base64 문자열이라 텍스트로 파싱하지 않는다. symlink와 deleted도 snapshot 쪽 정의가 없다.
  const snap = kind === 'text'
    ? symbolIndex.listDefinitionsInText({ path: rel, bytes: Buffer.from(content, 'utf8') })
    : null;
  return { path: rel, kind, content, deleted, added, base: baseFile, snap };
}

/**
 * 한 path의 diff 섹션 목록이 허용된 조합인지 확인하고 변경 줄을 합친다. 허용 조합은 세 가지다.
 * 단일 섹션(삭제는 kind deleted와만, 추가·수정은 deleted가 아닌 kind와만)과, deleted 섹션 뒤에 new 섹션이
 * 바로 이어지는 typechange 쌍이다. 쌍은 symlink와 일반 파일 사이 형식 변경이 --no-renames에서 나뉜 것이다.
 *
 * @param {string} rel - 저장소 상대 경로
 * @param {SnapshotKind} kind - files 항목의 kind
 * @param {DiffSection[]} sections - 같은 path의 섹션 목록(diff 순서)
 * @returns {{ deleted: number[], added: number[] }} 쌍이면 두 섹션의 합
 * @throws {Error} 허용되지 않은 조합이면 던진다. 역순·중복·세 개 이상이 여기에 든다
 */
function sectionChanges(rel: string, kind: SnapshotKind, sections: DiffSection[]): {
  deleted: number[];
  added: number[];
} {
  if (sections.length === 1) {
    const [only] = sections;
    if (only.type === 'deleted') {
      // kind가 deleted인 파일에 + 줄이 있으면 본문이 남아 있다는 뜻이라 모순이다.
      if (kind !== 'deleted' || only.added.length > 0) {
        throw new Error(`snapshot kind does not match its deleted diff section: ${rel}`);
      }
    } else if (kind === 'deleted') {
      throw new Error(`snapshot kind is deleted but its diff section is not a deletion: ${rel}`);
    }
    return { deleted: only.deleted, added: only.added };
  }
  if (sections.length === 2) {
    const [first, second] = sections;
    // typechange 쌍은 deleted 다음 new가 diff에서 바로 이어질 때만 한 변경이다. 떨어져 있으면 다른 변경이다.
    const isPair = first.type === 'deleted' && second.type === 'new' && second.index === first.index + 1;
    if (isPair && kind !== 'deleted') {
      return { deleted: [...first.deleted, ...second.deleted], added: [...first.added, ...second.added] };
    }
  }
  throw new Error(`diff has an unsupported section combination for path: ${rel}`);
}

/**
 * 파일 하나를 coverage 판정에 넣고 정의별 변경 상태를 만든다. coverage가 covered가 아니면 후보 재료를 만들지 않는다.
 *
 * @param {FileWork} work - 파일 원자료
 * @returns {Analyzed} coverage와 정의별 상태, 정의에 속하지 않은 변경 줄 수
 */
function analyze(work: FileWork): Analyzed {
  const coverage = decideCoverage(work.kind, work.base, work.snap);
  // 판정이 excluded·unsupported·parse_failed면 정의를 쓰지 않으므로 모든 변경 줄을 non_function으로 센다.
  if (coverage.status !== 'covered') {
    return {
      work,
      coverage,
      baseStates: [],
      snapStates: [],
      nonFunction: work.deleted.length + work.added.length,
    };
  }
  const baseDefs = work.base.status === 'parsed' ? work.base.definitions : [];
  const snapDefs = work.snap !== null && work.snap.status === 'parsed' ? work.snap.definitions : [];
  const baseRes = attribute(baseDefs, work.deleted);
  const snapRes = attribute(snapDefs, work.added);
  return {
    work,
    coverage,
    baseStates: baseRes.states,
    snapStates: snapRes.states,
    nonFunction: baseRes.nonFunction + snapRes.nonFunction,
  };
}

/**
 * 변경 줄을 정의 범위에 대어 touched·nested·own을 채운다. 줄이 여러 정의에 들면 가장 안쪽 정의가 그 줄을 센다.
 * 바깥 정의는 줄 수를 중복해 세지 않고 touched로만 남는다. 어느 정의에도 안 들면 non_function이다.
 *
 * @param {SymbolRef[]} defs - 한 쪽의 정의 목록
 * @param {number[]} lines - 그 쪽의 변경 줄 번호(base면 base 좌표, snapshot이면 snapshot 좌표)
 * @returns {{ states: DefState[], nonFunction: number }} 정의별 상태(defs와 같은 순서)와 정의 밖 줄 수
 */
function attribute(defs: SymbolRef[], lines: number[]): { states: DefState[]; nonFunction: number } {
  const states: DefState[] = defs.map((ref) => ({ ref, touched: false, nested: false, own: 0 }));
  let nonFunction = 0;
  for (const line of lines) {
    const containing: number[] = [];
    for (let i = 0; i < defs.length; i += 1) {
      if (defs[i].start_line <= line && line <= defs[i].end_line) containing.push(i);
    }
    if (containing.length === 0) {
      nonFunction += 1;
      continue;
    }
    // 가장 좁은 범위가 가장 안쪽이다. 범위가 같으면 뒤의 정의를 고른다. 이 경우는 정렬 순서로 고정돼 결과가 같다.
    const inner = containing.reduce((best, i) => (span(defs[i]) <= span(defs[best]) ? i : best));
    for (const i of containing) {
      states[i].touched = true;
      if (i !== inner) states[i].nested = true;
    }
    states[inner].own += 1;
  }
  return { states, nonFunction };
}

/**
 * 파일 하나의 coverage를 판정한다. 규칙 순서는 고정이고 먼저 맞는 규칙이 이긴다. role은 symbol-index가
 * 준 parsed·parse_failed 결과에서만 얻는다. 그 밖의 결과(unsupported·binary·symlink·submodule)는 role이 null이다.
 *
 * @param {SnapshotKind} kind - snapshot 쪽 kind. deleted면 snapshot 쪽이 없다
 * @param {BaseFile} base - base 쪽 판정 결과
 * @param {FileDefinitions | null} snap - snapshot 쪽 판정 결과. text가 아니면 null
 * @returns {Coverage} status, 이유, role
 */
function decideCoverage(kind: SnapshotKind, base: BaseFile, snap: FileDefinitions | null): Coverage {
  // 1. 본문이 아닌 파일은 어떤 파싱도 하지 않는다. 어느 쪽이든 symlink면 링크 target 문자열만 있다.
  if (kind === 'symlink' || (base.status === 'unsupported' && base.reason === 'symlink')) {
    return { status: 'excluded', reason: 'symlink', role: null };
  }
  if (base.status === 'unsupported' && base.reason === 'submodule') {
    return { status: 'excluded', reason: 'submodule', role: null };
  }
  if (kind === 'binary') return { status: 'excluded', reason: 'binary', role: null };
  // 2. 지원 불가 확장자·선언 파일·바이너리. snapshot 쪽 이유가 있으면 그 이유를 먼저 쓴다.
  const unsupportedReason = snap !== null && snap.status === 'unsupported'
    ? snap.reason
    : (base.status === 'unsupported' ? base.reason : null);
  if (unsupportedReason === 'extension' || unsupportedReason === 'declaration-file'
    || unsupportedReason === 'binary') {
    return { status: 'unsupported', reason: unsupportedReason, role: null };
  }
  // 3. 지원 스크립트의 test·generated·vendor는 구문이 깨졌어도 이 규칙에서 제외한다. 제외 사유가 파싱 실패보다 앞선다.
  const role = parsedRole(snap) ?? parsedRole(base);
  if (role !== null && role !== 'source') {
    return { status: 'excluded', reason: `role:${role}` as CoverageReason, role };
  }
  // 4. 파싱 실패. 둘 다 실패하면 snapshot 쪽을 보고한다.
  if (snap !== null && snap.status === 'parse_failed') return { status: 'parse_failed', reason: 'snapshot', role };
  if (base.status === 'parse_failed') return { status: 'parse_failed', reason: 'base', role };
  // 5. 나머지는 함수 후보를 만들 수 있다.
  return { status: 'covered', role };
}

/**
 * parsed·parse_failed 결과의 role만 꺼낸다. 다른 결과는 role이 없으므로 null이다.
 *
 * @param {FileDefinitions | BaseFile | null} file - 한 쪽의 판정 결과
 * @returns {Role | null} role. 없으면 null
 */
function parsedRole(file: FileDefinitions | BaseFile | null): Role | null {
  if (file === null) return null;
  if (file.status === 'parsed' || file.status === 'parse_failed') return file.role;
  return null;
}

/**
 * 파일들의 정의를 짝지어 후보를 만든다. 같은 (qualified_name, kind)가 양쪽에 정확히 하나씩이면 paired다.
 * 한쪽에만 있거나 양쪽에 중복이 있으면 touched 정의를 각각 deleted·added·ambiguous로 둔다.
 * 이동·이름 변경은 짝이 없는 deleted와 added를 본문 묶음으로 맞춘다. 이 묶음은 파일을 가로지른다.
 *
 * @param {string} repoRoot - 저장소 루트. 본문을 만들 base 블롭을 읽는다
 * @param {string} base - 확정된 base SHA
 * @param {Analyzed[]} analyzed - covered 파일만 정의 상태가 있다
 * @returns {Candidate[]} 정렬하지 않은 후보 목록
 */
function buildCandidates(repoRoot: string, base: string, analyzed: Analyzed[]): Candidate[] {
  const candidates: Candidate[] = [];
  const pending: { side: 'base' | 'snap'; item: Pending }[] = [];
  for (const file of analyzed) {
    if (file.coverage.status !== 'covered') continue;
    const baseByKey = groupByKey(file.baseStates);
    const snapByKey = groupByKey(file.snapStates);
    const keys = new Set([...baseByKey.keys(), ...snapByKey.keys()]);
    // 1. 키마다 양쪽 개수로 mapping을 정한다.
    for (const key of keys) {
      const bases = baseByKey.get(key) ?? [];
      const snaps = snapByKey.get(key) ?? [];
      if (bases.length === 1 && snaps.length === 1) {
        if (bases[0].touched || snaps[0].touched) candidates.push(toCandidate('paired', bases[0], snaps[0]));
      } else if (bases.length > 0 && snaps.length > 0) {
        // 양쪽에 있는데 1:1이 아니면 어느 쪽이 이전 정의인지 정할 수 없다. touched 정의는 모두 모호로 둔다.
        for (const state of bases) if (state.touched) candidates.push(toCandidate('ambiguous_mapping', state, null));
        for (const state of snaps) if (state.touched) candidates.push(toCandidate('ambiguous_mapping', null, state));
      } else if (bases.length > 0) {
        for (const state of bases) {
          if (state.touched) pending.push({ side: 'base', item: { state, body: '' } });
        }
      } else {
        for (const state of snaps) {
          if (state.touched) pending.push({ side: 'snap', item: { state, body: '' } });
        }
      }
    }
  }
  // 2. 대기열 항목의 본문을 만든 뒤 전역으로 묶는다. 같은 본문의 deleted·added가 짝이면 이동이다.
  const groups = new Map<string, { deleted: Pending[]; added: Pending[] }>();
  const textCache = new Map<string, string>();
  for (const entry of pending) {
    const path = entry.item.state.ref.path;
    const text = entry.side === 'base'
      ? readBaseText(repoRoot, base, path, textCache)
      : analyzedSnapText(analyzed, path);
    const body = normalizedBody(text, entry.item.state.ref);
    const group = groups.get(body) ?? { deleted: [], added: [] };
    if (entry.side === 'base') group.deleted.push({ state: entry.item.state, body });
    else group.added.push({ state: entry.item.state, body });
    groups.set(body, group);
  }
  for (const group of groups.values()) {
    if (group.deleted.length === 1 && group.added.length === 1) {
      candidates.push(toCandidate('moved', group.deleted[0].state, group.added[0].state));
    } else if (group.deleted.length > 0 && group.added.length > 0) {
      // 같은 본문이 여러 개면 어느 것이 이동인지 알 수 없다. 그 묶음 전원을 모호로 둔다.
      for (const item of group.deleted) candidates.push(toCandidate('ambiguous_mapping', item.state, null));
      for (const item of group.added) candidates.push(toCandidate('ambiguous_mapping', null, item.state));
    } else {
      for (const item of group.deleted) candidates.push(toCandidate('deleted', item.state, null));
      for (const item of group.added) candidates.push(toCandidate('added', null, item.state));
    }
  }
  return candidates.sort(compareCandidates);
}

/**
 * 정의 상태를 (qualified_name, kind) 키로 묶는다. 같은 키의 정의가 여러 개인지 보려고 목록으로 둔다.
 *
 * @param {DefState[]} states - 한 쪽의 정의 상태
 * @returns {Map<string, DefState[]>} 키 → 상태 목록
 */
function groupByKey(states: DefState[]): Map<string, DefState[]> {
  const grouped = new Map<string, DefState[]>();
  for (const state of states) {
    // NUL은 식별자에 나오지 않으므로 키 구분자로 안전하다.
    const key = `${state.ref.qualified_name}\0${state.ref.kind}`;
    const list = grouped.get(key) ?? [];
    list.push(state);
    grouped.set(key, list);
  }
  return grouped;
}

/**
 * 한 쪽 또는 양쪽 상태로 후보 하나를 만든다. 줄 수는 각 쪽이 자기 정의에 센 값이다.
 *
 * @param {Mapping} mapping - 후보 mapping
 * @param {DefState | null} base - base 쪽 상태. 없으면 null
 * @param {DefState | null} snap - snapshot 쪽 상태. 없으면 null
 * @returns {Candidate} 후보
 */
function toCandidate(mapping: Mapping, base: DefState | null, snap: DefState | null): Candidate {
  return {
    mapping,
    base_ref: base === null ? null : base.ref,
    snapshot_ref: snap === null ? null : snap.ref,
    added_lines: snap === null ? 0 : snap.own,
    deleted_lines: base === null ? 0 : base.own,
    touched_by_nested: (base !== null && base.nested) || (snap !== null && snap.nested),
  };
}

/**
 * 정의 하나의 본문을 함수 이름이 가린 문자열로 만든다. 이름이 바뀐 함수끼리 같은 문자열이 되게 하려는 것이다.
 * 마지막 이름 토큰은 식별자 경계(앞뒤가 식별자 문자가 아님)에서 모두 `\0`으로 바꾼다. 재귀 호출도 같이 가려야
 * 이름 변경 뒤에도 같은 본문이 된다. `$`를 식별자 문자로 보는 것은 symbol-index의 토큰 규칙과 같다.
 *
 * @param {string} text - 정의가 든 파일의 전체 텍스트(UTF-8)
 * @param {SymbolRef} ref - 본문 범위의 정의
 * @returns {string} 줄 범위 텍스트에서 이름을 `\0`으로 바꾼 문자열
 */
function normalizedBody(text: string, ref: SymbolRef): string {
  const lines = text.split('\n');
  const body = lines.slice(ref.start_line - 1, ref.end_line).join('\n');
  const name = ref.qualified_name.slice(ref.qualified_name.lastIndexOf('.') + 1);
  const pattern = new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(name)}(?![A-Za-z0-9_$])`, 'g');
  return body.replace(pattern, '\0');
}

/**
 * base 커밋의 한 파일 본문을 읽는다. 같은 path를 여러 정의가 쓰므로 호출마다 다시 읽지 않도록 캐시한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} base - 확정된 base SHA
 * @param {string} path - 저장소 상대 경로
 * @param {Map<string, string>} cache - path → 본문 캐시(in place)
 * @returns {string} UTF-8 본문
 * @throws {Error} 그 SHA에 blob이 없으면 던진다. 파싱된 base 정의가 있는 파일이라 생기면 안 되는 상태다
 */
function readBaseText(repoRoot: string, base: string, path: string, cache: Map<string, string>): string {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;
  const blob = intentRevision.readBlobAt({ repoRoot, ref: base, path });
  if (blob.status !== 'present') throw new Error(`base blob is missing for a parsed definition: ${path}`);
  const text = blob.bytes.toString('utf8');
  cache.set(path, text);
  return text;
}

/**
 * snapshot 쪽 대기열 항목의 본문 원천인 파일 텍스트를 찾는다. 대기열 항목은 covered 파일에서만 나온다.
 *
 * @param {Analyzed[]} analyzed - 분석된 파일들
 * @param {string} path - 저장소 상대 경로
 * @returns {string} snapshot 쪽 UTF-8 본문
 * @throws {Error} 그 path를 가진 분석 항목이 없으면 던진다. 호출 경로상 생기지 않는 내부 불변식 위반이다
 */
function analyzedSnapText(analyzed: Analyzed[], path: string): string {
  const file = analyzed.find((entry) => entry.work.path === path);
  if (file === undefined) throw new Error(`snapshot file for a definition is missing: ${path}`);
  return file.work.content;
}

/**
 * 파일 분석 결과 하나를 coverage 행으로 바꾼다. reason 키는 값이 있을 때만 넣어 빈 사유가 섞이지 않게 한다.
 *
 * @param {Analyzed} file - 분석된 파일
 * @returns {FileCoverage} coverage 행
 */
function toCoverageRow(file: Analyzed): FileCoverage {
  const row: FileCoverage = {
    path: file.work.path,
    role: file.coverage.role,
    status: file.coverage.status,
    added_lines: file.work.added.length,
    deleted_lines: file.work.deleted.length,
    non_function_lines: file.nonFunction,
  };
  if (file.coverage.reason !== undefined) row.reason = file.coverage.reason;
  return row;
}

/**
 * 후보 정렬 키는 (path, qualified_name, kind, base 시작 줄, snapshot 시작 줄, mapping)이다. 한쪽만 있는 후보는
 * 없는 쪽 시작 줄을 0으로 본다. 모든 비교는 `<` 문자열 비교라 로케일이 순서를 바꾸지 못한다.
 *
 * @param {Candidate} left - 왼쪽 후보
 * @param {Candidate} right - 오른쪽 후보
 * @returns {number} 음수·0·양수
 */
function compareCandidates(left: Candidate, right: Candidate): number {
  const a = left.base_ref ?? left.snapshot_ref;
  const b = right.base_ref ?? right.snapshot_ref;
  if (a === null || b === null) throw new Error('candidate has no symbol reference');
  return compareStrings(a.path, b.path)
    || compareStrings(a.qualified_name, b.qualified_name)
    || compareStrings(a.kind, b.kind)
    || (left.base_ref?.start_line ?? 0) - (right.base_ref?.start_line ?? 0)
    || (left.snapshot_ref?.start_line ?? 0) - (right.snapshot_ref?.start_line ?? 0)
    || compareStrings(left.mapping, right.mapping);
}

/**
 * 입력 snapshot의 형태를 확인한다. 타입 선언만 믿으면 런타임 입력이 다른 모양이어도 엉뚱한 결과가 나온다.
 *
 * @param {unknown} value - 호출자가 넘긴 snapshot
 * @returns {DiffSnapshot} 형태가 맞는 snapshot(같은 객체)
 * @throws {Error} target·diff·files 누락, kind 밖의 값, path 형식 위반이면 던진다
 */
function requireSnapshotShape(value: unknown): DiffSnapshot {
  if (!isRecord(value)) throw new Error('snapshot must be an object');
  const target = value.target;
  if (!isRecord(target) || typeof target.base !== 'string' || typeof target.head !== 'string') {
    throw new Error('snapshot.target must carry string base and head');
  }
  if (typeof value.diff !== 'string') throw new Error('snapshot.diff must be a string');
  if (!Array.isArray(value.files)) throw new Error('snapshot.files must be an array');
  for (const file of value.files as unknown[]) {
    if (!isRecord(file) || typeof file.content !== 'string') {
      throw new Error('snapshot file must carry string content');
    }
    if (!SNAPSHOT_KINDS.has(file.kind)) throw new Error(`snapshot file kind is not recognized: ${String(file.kind)}`);
    assertSnapshotPath(file.path);
  }
  return value as DiffSnapshot;
}

/**
 * snapshot 경로가 저장소 상대 경로인지 확인한다. 절대 경로·역슬래시·빈 세그먼트·`.`·`..`는 같은 파일을 여러
 * 이름으로 가리키거나 저장소 밖을 가리키므로 읽기 전에 거절한다.
 *
 * @param {unknown} p - 검사할 경로
 * @returns {void}
 * @throws {Error} 형식이 맞지 않으면 사유를 담은 Error
 */
function assertSnapshotPath(p: unknown): void {
  if (typeof p !== 'string' || p === '') throw new Error('snapshot file path must be a non-empty repo-relative path');
  if (p.startsWith('/')) throw new Error(`snapshot file path must be repo-relative, not absolute: ${p}`);
  if (p.includes('\\')) throw new Error(`snapshot file path must use "/" separators: ${p}`);
  for (const segment of p.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error(`snapshot file path has an invalid segment: ${p}`);
    }
  }
}

/**
 * Git blob SHA-1을 계산한다. symbol-index의 gitBlobSha는 export되지 않으므로 같은 식을 여기 둔다.
 * snapshot 쪽 ref의 blob_sha가 `git hash-object`와 맞아야 하므로 헤더 `blob <len>\0`을 그대로 쓴다.
 *
 * @param {Buffer} bytes - 파일 본문 바이트
 * @returns {string} 40자 hex SHA-1
 */
function gitBlobSha(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

/**
 * 텍스트의 줄 수를 센다. 마지막 줄바꿈 뒤에 내용이 없으면 줄을 더하지 않는다. 빈 문자열은 0줄이다.
 *
 * @param {string} text - 파일 본문
 * @returns {number} 줄 수
 */
function countLines(text: string): number {
  if (text === '') return 0;
  const parts = text.split('\n');
  return text.endsWith('\n') ? parts.length - 1 : parts.length;
}

/**
 * 1부터 n까지의 줄 번호 배열이다.
 *
 * @param {number} n - 줄 수
 * @returns {number[]} [1..n]
 */
function rangeLines(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k + 1);
}

/**
 * 정의 범위의 줄 수(끝 - 시작)다. 안쪽 판정에 쓴다.
 *
 * @param {SymbolRef} ref - 정의
 * @returns {number} end_line - start_line
 */
function span(ref: SymbolRef): number {
  return ref.end_line - ref.start_line;
}

/**
 * 정규식 메타문자를 이스케이프한다. 함수명에 `$`가 들어갈 수 있어 필요하다.
 *
 * @param {string} text - 원문
 * @returns {string} 정규식 리터럴로 쓸 수 있는 문자열
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 객체인지 확인한다. 배열과 null은 제외한다.
 *
 * @param {unknown} value - 검사할 값
 * @returns {boolean} 평범한 객체면 true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 문자열을 `<`로 비교한다. 로케일을 쓰지 않아 어느 환경에서나 같은 순서가 나온다.
 *
 * @param {string} left - 왼쪽
 * @param {string} right - 오른쪽
 * @returns {number} 음수·0·양수
 */
function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * 변경 함수 후보에 기준 SHA의 intent 근거를 붙이고, 순위와 바이트 예산을 적용한 전달 슬롯을 만든다.
 * 추출은 한 번만 하고, 근거 조회는 queryable 후보 중 상위 8개에만 후보마다 한 번 부른다. 전체 후보는 manifest에
 * 순위·근거 상태·전달 상태와 함께 남아 생략된 후보도 확인할 수 있다. 조회가 던진 오류는 unlinked로 접지 않고 그대로 올린다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트. Git 읽기의 cwd다
 * @param {DiffSnapshot} input.snapshot - 동결된 review snapshot의 target·diff·files
 * @param {string} input.historyRef - base 커밋을 가리키는 ref. snapshot.target.base와 같아야 한다
 * @param {{ resolveIntentAtRevision?: Lookup }} [input.deps] - 조회 주입. 호출 횟수와 실패를 테스트가 보려고 쓴다.
 *   운영 호출자는 넘기지 않으면 intent-provenance의 resolveIntentAtRevision을 쓴다
 * @returns {object} schema_version·projection_version·budget_policy, snapshot_id, base, history_ref, slot
 *   (summary·entries·manifest_digest·bundle_dedupe), manifest(files·candidates), digest(digest 키를 뺀 객체의 해시).
 *   후보가 없으면 entries는 빈 배열이다
 * @throws {Error} extractChangedFunctions의 거절 조건, 조회 함수가 던진 오류, 헤더만으로 슬롯 상한을 넘는 경우에 던진다
 */
function collectDiffIntent(input: {
  repoRoot: string;
  snapshot: DiffSnapshot;
  historyRef: string;
  deps?: { resolveIntentAtRevision?: Lookup };
}) {
  // 1. 추출은 한 번만 한다. 형태·historyRef·diff 거절이 조회보다 먼저 일어나 잘못된 입력이 Git 조회를 만들지 않는다.
  const extracted = extractChangedFunctions({
    repoRoot: input.repoRoot,
    snapshot: input.snapshot,
    historyRef: input.historyRef,
  });
  // 2. queryable 후보를 순위로 정렬한다. 순위가 manifest rank와 조회 대상을 함께 정하므로 정렬 키를 모두 고정한다.
  const queryable = extracted.candidates.filter(hasBaseRef).sort(compareRank);
  const rankOf = new Map<Candidate, number>(queryable.map((candidate, index) => [candidate, index + 1]));
  // 3. 상위 8개만 근거를 조회한다. 9위 이하는 부르지 않아 조회 호출 수가 후보 수와 무관하게 최대 8이다.
  // 조회 범위는 historyRef가 확정한 SHA로 넘긴다. 같은 ref 문자열이 다른 커밋을 가리키게 두지 않는다.
  const lookup = input.deps?.resolveIntentAtRevision ?? intentProvenance.resolveIntentAtRevision;
  const rows: Row[] = queryable.slice(0, MAX_ENTRIES).map((candidate, index) => ({
    rank: index + 1,
    candidate,
    result: lookup({ repoRoot: input.repoRoot, historyRef: extracted.history_ref, symbolRef: candidate.base_ref }),
  }));
  // 4. 조회 전에도 정해지는 요약 값을 모은다. 슬롯 크기 시험에도 이 값을 쓴다.
  const counts: SummaryBase = {
    changed_files: extracted.files.length,
    files_not_covered: extracted.files.filter((file) => file.status !== 'covered').length,
    candidates_total: extracted.candidates.length,
    queryable: queryable.length,
    omitted_by_count: Math.max(0, queryable.length - MAX_ENTRIES),
    added_no_history: extracted.candidates.filter((candidate) => candidate.mapping === 'added').length,
    ambiguous_mapping: extracted.candidates.filter((candidate) => candidate.mapping === 'ambiguous_mapping').length,
    unlinked: rows.filter((row) => row.result.status !== 'resolved').length,
  };
  // 5. 상위 후보부터 슬롯에 하나씩 넣는다. 넘치면 그 항목의 절을 마지막부터 줄여 본다.
  const { entries, deliveries } = packEntries(rows, counts);
  // 6. 최종 요약과 manifest, digest를 확정한다. manifest는 슬롯에 들어가지 않고 digest로만 가리킨다.
  const summary: Summary = {
    ...counts,
    selected: entries.length,
    omitted_by_bytes: deliveries.filter((delivery) => delivery === 'omitted_by_bytes').length,
  };
  const manifest = {
    files: extracted.files,
    candidates: manifestCandidates(extracted.candidates, rankOf, rows, deliveries),
  };
  const slot: Slot = {
    summary,
    entries,
    manifest_digest: sha256Canonical(manifest),
    bundle_dedupe: 'not_applied',
  };
  // 7. 시험 직렬화는 manifest_digest 자리에 같은 길이의 값을 넣었으므로 최종 크기와 같아야 한다. 어긋나면 계산이 틀린 것이라
  // 조용히 넘기지 않고 던진다.
  if (Buffer.byteLength(canonicalJson.canonicalJson(slot), 'utf8') > SLOT_BYTES) {
    throw new Error('intent diff slot exceeds its byte budget after packing');
  }
  const body = {
    schema_version: 1 as const,
    projection_version: PROJECTION_VERSION,
    budget_policy: BUDGET_POLICY,
    snapshot_id: extracted.snapshot_id,
    base: extracted.base,
    history_ref: extracted.history_ref,
    slot,
    manifest,
  };
  // 8. digest는 digest 키를 뺀 객체의 canonical JSON 해시다. 같은 입력이면 같은 바이트를 낸다.
  return { ...body, digest: sha256Canonical(body) };
}

/**
 * base_ref가 있는 후보인지 본다. 이 조건이 근거 조회 대상이다.
 *
 * @param {Candidate} candidate - 추출 후보
 * @returns {boolean} base_ref가 있으면 true이며, 타입 가드로 Queryable을 좁힌다
 */
function hasBaseRef(candidate: Candidate): candidate is Queryable {
  return candidate.base_ref !== null;
}

/**
 * 두 queryable 후보의 순위를 정한다. 줄 수 내림차순, 같으면 base 쪽 path·qualified_name·kind 오름차순,
 * 그래도 같으면 base 시작 줄 오름차순이다. 모든 비교는 `<` 문자열 비교라 로케일이 순서를 바꾸지 못한다.
 *
 * @param {Queryable} left - 왼쪽 후보
 * @param {Queryable} right - 오른쪽 후보
 * @returns {number} 음수·0·양수
 */
function compareRank(left: Queryable, right: Queryable): number {
  const lines = (right.added_lines + right.deleted_lines) - (left.added_lines + left.deleted_lines);
  return lines
    || compareStrings(left.base_ref.path, right.base_ref.path)
    || compareStrings(left.base_ref.qualified_name, right.base_ref.qualified_name)
    || compareStrings(left.base_ref.kind, right.base_ref.kind)
    || left.base_ref.start_line - right.base_ref.start_line;
}

/**
 * 조회한 상위 행을 순위대로 슬롯에 넣는다. 한 항목은 본문 상한을 통과한 절 수에서 시작해, 넘치면 마지막 절을 하나씩
 * 빼 본다. 절이 하나도 없어도 넘으면 그 항목은 바이트 상한으로 생략하고 다음 순위를 계속 시험한다. 생략이 9위 이하를
 * 끌어올리지는 않는다. 헤더만으로 상한을 넘으면 어떤 항목도 들어갈 수 없으므로 던진다.
 *
 * @param {Row[]} rows - 순위 순서의 조회 행(최대 8개)
 * @param {SummaryBase} counts - 조회 전에도 정해지는 요약 값
 * @returns {{ entries: Entry[], deliveries: PackDelivery[] }} 선택 항목(순위 순서)과 rows와 같은 순서의 전달 상태
 * @throws {Error} 항목이 하나도 없는 슬롯이 SLOT_BYTES를 넘으면 던진다
 */
function packEntries(rows: Row[], counts: SummaryBase): { entries: Entry[]; deliveries: PackDelivery[] } {
  // 1. 헤더 검사. 요약과 빈 항목만으로 상한을 넘으면 어떤 항목을 빼도 맞지 않으므로 조용히 생략하지 않는다.
  if (slotBytes(counts, 0, 0, []) > SLOT_BYTES) {
    throw new Error('intent diff slot header exceeds its byte budget');
  }
  const entries: Entry[] = [];
  const deliveries: PackDelivery[] = [];
  let omitted = 0;
  for (const row of rows) {
    // 2. 가장 많은 절을 가진 형태부터 시험한다. 실패하면 마지막 절을 하나 줄이고 다시 잰다. 0개까지 가도 안 들어가면 생략이다.
    let placed: Entry | null = null;
    for (let kept = bodyPrefixLength(row.result); kept >= 0 && placed === null; kept -= 1) {
      const trial = makeEntry(row, kept);
      if (slotBytes(counts, entries.length + 1, omitted, [...entries, trial]) <= SLOT_BYTES) placed = trial;
    }
    if (placed === null) {
      deliveries.push('omitted_by_bytes');
      omitted += 1;
    } else {
      entries.push(placed);
      deliveries.push('selected');
    }
  }
  return { entries, deliveries };
}

/**
 * 슬롯 하나의 canonical JSON 바이트 수를 잰다. manifest_digest 자리에는 길이가 같은 placeholder를 둔다.
 * selected와 omitted_by_bytes는 조회 개수 상한 8 이하의 한 자리 수라, 시험 중 값과 최종 값의 길이가 같다.
 *
 * @param {SummaryBase} counts - 조회 전에도 정해지는 요약 값
 * @param {number} selected - 시험 중 선택 항목 수
 * @param {number} omitted - 시험 중 바이트 상한 생략 수
 * @param {Entry[]} entries - 시험할 항목 목록
 * @returns {number} UTF-8 바이트 수
 */
function slotBytes(counts: SummaryBase, selected: number, omitted: number, entries: Entry[]): number {
  const slot: Slot = {
    summary: { ...counts, selected, omitted_by_bytes: omitted },
    entries,
    manifest_digest: DIGEST_PLACEHOLDER,
    bundle_dedupe: 'not_applied',
  };
  return Buffer.byteLength(canonicalJson.canonicalJson(slot), 'utf8');
}

/**
 * 조회 행 하나를 슬롯 항목으로 바꾼다. 절은 앞에서부터 kept개만 남기고 나머지는 sections_omitted로 센다.
 *
 * @param {Row} row - 순위와 후보, 조회 결과
 * @param {number} kept - 남길 절 수(후보 순서·절 순서로 센 앞쪽)
 * @returns {Entry} 슬롯 항목
 */
function makeEntry(row: Row, kept: number): Entry {
  const { candidate, result } = row;
  return {
    rank: row.rank,
    mapping: candidate.mapping,
    base_ref: candidate.base_ref,
    snapshot_ref: candidate.snapshot_ref,
    added_lines: candidate.added_lines,
    deleted_lines: candidate.deleted_lines,
    touched_by_nested: candidate.touched_by_nested,
    // 조회 상태가 resolved가 아니면 근거가 없다는 뜻이다. 조회 실패는 여기 오지 않고 호출 단계에서 이미 던져졌다.
    evidence: result.status === 'resolved' ? 'linked' : 'unlinked',
    explain_docs: result.explain_docs,
    total_linked: result.total_linked,
    candidates: keepSections(result.candidates, kept),
  };
}

/**
 * 근거 후보들의 절을 후보 순서·절 순서의 앞에서부터 kept개만 남긴다. 남은 개수가 0이 되면 그 뒤 절은 모두 생략한다.
 * 절 하나를 잘라 쓰지 않는다. 절이 모두 빠진 후보도 commit·task 같은 식별 필드는 남겨 출처를 알 수 있게 한다.
 *
 * @param {LookupCandidate[]} candidates - 조회가 준 근거 후보
 * @param {number} kept - 남길 절 수
 * @returns {EntryCandidate[]} 절이 줄어든 후보 목록
 */
function keepSections(candidates: LookupCandidate[], kept: number): EntryCandidate[] {
  let remaining = kept;
  return candidates.map((item) => {
    const sections: Section[] = [];
    for (const section of item.sections) {
      if (remaining === 0) break;
      sections.push({ name: section.name, body: section.body });
      remaining -= 1;
    }
    return {
      relation: item.relation,
      commit: item.commit,
      task: item.task,
      explain: item.explain,
      explain_blob_sha: item.explain_blob_sha,
      freshness: item.freshness,
      sections,
      sections_omitted: item.sections.length - sections.length,
    };
  });
}

/**
 * 한 항목의 본문 상한 안에 들어가는 절 수를 센다. 후보 순서·절 순서로 본문 UTF-8 바이트를 더해 BODY_BYTES를 넘기 전까지
 * 세고, 넘는 절이 나오면 그 절과 뒤 절을 모두 뺀다. 절 중간을 자르지 않으므로 Buffer.byteLength로 잰다.
 *
 * @param {LookupResult} result - 한 queryable 후보의 조회 결과
 * @returns {number} 본문 상한 안에서 남길 절 수(앞쪽부터)
 */
function bodyPrefixLength(result: LookupResult): number {
  let used = 0;
  let count = 0;
  for (const item of result.candidates) {
    for (const section of item.sections) {
      const bytes = Buffer.byteLength(section.body, 'utf8');
      if (used + bytes > BODY_BYTES) return count;
      used += bytes;
      count += 1;
    }
  }
  return count;
}

/**
 * 추출 순서의 모든 후보에 rank·evidence·delivery를 더한다. rank는 queryable만 가지고, 나머지는 null이다.
 * 조회하지 않은 이유는 셋이다. 기준 SHA에 이력이 없는 added, 조회 대상이 아닌 snapshot 쪽 ambiguous,
 * 그리고 상위 8개 밖의 queryable(omitted_by_count)이다.
 *
 * @param {Candidate[]} candidates - 추출 순서의 모든 후보
 * @param {Map<Candidate, number>} rankOf - queryable 후보와 그 rank
 * @param {Row[]} rows - 조회한 상위 행(rank 순서)
 * @param {PackDelivery[]} deliveries - rows와 같은 순서의 전달 상태
 * @returns {ManifestCandidate[]} manifest 후보 목록(추출 순서)
 */
function manifestCandidates(
  candidates: Candidate[],
  rankOf: Map<Candidate, number>,
  rows: Row[],
  deliveries: PackDelivery[],
): ManifestCandidate[] {
  return candidates.map((candidate): ManifestCandidate => {
    const rank = rankOf.get(candidate);
    if (rank === undefined) {
      const evidence: Evidence = candidate.mapping === 'added' ? 'added_no_history' : 'not_queried';
      return { ...candidate, rank: null, evidence, delivery: 'manifest_only' };
    }
    if (rank > MAX_ENTRIES) {
      return { ...candidate, rank, evidence: 'not_queried', delivery: 'omitted_by_count' };
    }
    const row = rows[rank - 1];
    const evidence: Evidence = row.result.status === 'resolved' ? 'linked' : 'unlinked';
    return { ...candidate, rank, evidence, delivery: deliveries[rank - 1] };
  });
}

export = { extractChangedFunctions, collectDiffIntent };
