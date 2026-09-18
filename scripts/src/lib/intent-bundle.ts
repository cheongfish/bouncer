'use strict';

import fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync: realExecFileSync } = require('node:child_process');
import runtimeState = require('./runtime-state');
const { intentBundlePathFor } = runtimeState;
import frontmatter = require('./frontmatter');
const { readDoc } = frontmatter;
import commitSha = require('./commit-sha');
const { buildStableProvenance } = commitSha;
import paths = require('./paths');
const { toPosix, parsePathIds } = paths;
import symbolIndex = require('./symbol-index');
const { resolveSymbol } = symbolIndex;
import intentProvenance = require('./intent-provenance');
const {
  resolveIntentProvenance: defaultResolveIntentProvenance,
  projectExplainSectionHashes,
} = intentProvenance;

const CANONICAL_TASK_RE = /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/blueprints\/\d{3}-[^/]+\/tasks\/\d{3}\/tasks\.md$/;
// live resolve(loadExplainDocs)와 같은 canonical Explain만 cache가 읽기 경로로 쓸 수 있다.
const CANONICAL_EXPLAIN_RE = /^\.bouncer\/context\/epics\/\d{3}-[^/]+\/blueprints\/\d{3}-[^/]+\/explain\.md$/;
const HASH_RE = /^[a-f0-9]{64}$/;
const STABLE_TASK_RE = /^EPIC-\d{3}\/BP-\d{3}\/TASK-\d{3}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const FRESHNESS = new Set(['current', 'related', 'possibly-superseded', 'historical']);

type ExecFileSyncFn = (
  file: string,
  args?: readonly string[],
  options?: { cwd?: unknown; encoding?: unknown; stdio?: unknown },
) => string | Buffer;

type InjectedFs = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, encoding?: string) => string | Buffer;
  writeFileSync: (p: string, data: string) => void;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => unknown;
  rmSync: (p: string, opts?: { force?: boolean }) => void;
  renameSync: (src: string, dest: string) => void;
  realpathSync: (p: string) => string;
  lstatSync?: (p: string) => { isSymbolicLink: () => boolean };
};

type FunctionRequest = {
  symbol: string;
  candidateRef?: string | null;
};

type SectionHash = { name: string; hash: string };

type SymbolRef = {
  path: string;
  qualified_name: string;
  kind: string;
  start_line: number;
  end_line: number;
  blob_sha: string;
};

type ProvenanceFields = {
  task: string;
  commit: string;
  explain: string;
  freshness: string;
  relation: string;
  sections: SectionHash[];
};

type BundleFunctionEntry =
  | {
      symbol: string;
      status: 'resolved';
      function_ref: string;
      blob_sha: string;
      symbol_ref: SymbolRef;
      provenance: ProvenanceFields;
    }
  | {
      symbol: string;
      status: 'unlinked';
      function_ref: string;
      blob_sha: string;
      symbol_ref: SymbolRef;
    }
  | {
      symbol: string;
      status: 'unresolved';
    }
  | {
      symbol: string;
      status: 'ambiguous';
      candidates: unknown[];
    };

type BundleRecord = {
  version: 1;
  task: string;
  task_brief_hash: string;
  revision: number;
  bundle_id: string;
  functions: BundleFunctionEntry[];
};

type BundleResult = {
  status: 'created' | 'reused';
  bundle_id: string;
  revision: number;
  task: string;
  task_brief_hash: string;
  functions: BundleFunctionEntry[];
};

type BundleDeps = {
  execFileSync?: ExecFileSyncFn;
  fs?: InjectedFs;
  resolveIntentProvenance?: typeof defaultResolveIntentProvenance;
  resolveSymbol?: typeof resolveSymbol;
  platform?: string;
};

/**
 * 실행 Task와 함수 집합의 intent bundle을 내용 주소로 재사용하거나 새로 기록한다.
 * function ref·blob SHA·non-historical Explain 절 hash가 모두 같으면 Git provenance
 * resolver를 건너뛰고, 하나라도 다르거나 cache가 손상되면 원자적으로 다시 쓴다.
 * resolver가 중간에 실패하면 이전 record를 덮어쓰지 않는다.
 *
 * @param {object} input - 조회·기록 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.taskFile - repo-relative canonical tasks.md
 * @param {FunctionRequest[]} input.functions - 중복·빈 이름 없는 함수 요청
 * @param {BundleDeps} [input.deps] - fs·Git·resolver 주입(테스트용)
 * @returns {BundleResult} created | reused 와 bundle_id·revision·function entries
 */
function resolveTaskIntentBundle(input: {
  repoRoot: string;
  taskFile: string;
  functions: FunctionRequest[];
  deps?: BundleDeps | null;
}): BundleResult {
  const deps = input.deps || {};
  const io = { ...fs, ...(deps.fs || {}) } as InjectedFs;
  const execFileSync = deps.execFileSync || (realExecFileSync as ExecFileSyncFn);
  const runProvenance = deps.resolveIntentProvenance || defaultResolveIntentProvenance;
  const runSymbol = deps.resolveSymbol || resolveSymbol;

  // 1. 요청·경로·stable ID를 먼저 고정한다. 잘못된 입력이면 cache를 읽지도 않는다.
  const requests = normalizeFunctionRequests(input.functions);
  const { repoReal, taskRel, stableTask, taskBriefHash } = loadExecutionTask({
    repoRoot: input.repoRoot,
    taskFile: input.taskFile,
    fs: io,
  });

  const located = intentBundlePathFor({
    repoRoot: repoReal,
    taskRel,
    deps: { execFileSync, platform: deps.platform },
  });
  if (located.unavailable || !located.intentFile || !located.commonGitDir) {
    throw new Error(located.reason || 'Git common directory unavailable');
  }
  const intentFile = located.intentFile;
  // cache 경로가 common dir 밖 symlink로 새면 읽기·쓰기가 저장소 밖으로 나간다.
  assertIntentPathInCommonDir(intentFile, located.commonGitDir, io, { createDir: false });

  // 2. 현재 함수 좌표(Git 없이)를 먼저 모은다. hit 판정과 miss 기록이 같은 ref를 쓴다.
  const liveCoords = requests.map((req) => resolveLiveCoordinate({
    repoRoot: repoReal,
    request: req,
    resolveSymbol: runSymbol,
  }));

  const previous = readValidBundleRecord({
    intentFile,
    expectedTask: stableTask,
    fs: io,
  });
  if (previous && isCacheHit(previous, liveCoords, repoReal, io)) {
    return {
      status: 'reused',
      bundle_id: previous.bundle_id,
      revision: previous.revision,
      task: stableTask,
      task_brief_hash: taskBriefHash,
      functions: previous.functions,
    };
  }

  // 3. miss — 전체 함수를 resolver로 채운 뒤에만 쓴다. 부분 record를 남기지 않는다.
  const entries: BundleFunctionEntry[] = [];
  for (let i = 0; i < requests.length; i += 1) {
    entries.push(buildFunctionEntry({
      repoRoot: repoReal,
      request: requests[i],
      live: liveCoords[i],
      resolveIntentProvenance: runProvenance,
    }));
  }
  entries.sort(compareEntries);

  const bundleId = contentBundleId(entries);
  const revision = previous && Number.isInteger(previous.revision) && previous.revision > 0
    ? previous.revision + 1
    : 1;
  const record: BundleRecord = {
    version: 1,
    task: stableTask,
    task_brief_hash: taskBriefHash,
    revision,
    bundle_id: bundleId,
    functions: entries,
  };
  // write 직전에 부모를 만들고 실경로 경계를 다시 고정한다.
  assertIntentPathInCommonDir(intentFile, located.commonGitDir, io, { createDir: true });
  atomicWriteJson(intentFile, record, io);

  return {
    status: 'created',
    bundle_id: bundleId,
    revision,
    task: stableTask,
    task_brief_hash: taskBriefHash,
    functions: entries,
  };
}

/**
 * 빈·중복 symbol과 빈 candidateRef를 거절하고 요청 순서를 유지한 목록을 돌려준다.
 * 정렬은 기록 단계에서만 한다 — 호출 순서를 바꿔 중복 판정을 숨기지 않는다.
 *
 * @param {unknown} functions - 호출자 함수 요청
 * @returns {FunctionRequest[]} 정규화된 요청
 */
function normalizeFunctionRequests(functions: unknown): FunctionRequest[] {
  if (!Array.isArray(functions) || functions.length === 0) {
    throw new Error('functions must be a non-empty array');
  }
  const seen = new Set<string>();
  const out: FunctionRequest[] = [];
  for (const entry of functions) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('function request must be an object');
    }
    const rec = entry as Record<string, unknown>;
    if (typeof rec.symbol !== 'string' || rec.symbol.trim() === '') {
      throw new Error('function symbol must be a non-empty string');
    }
    const symbol = rec.symbol.trim();
    if (seen.has(symbol)) {
      throw new Error(`duplicate function symbol: ${symbol}`);
    }
    seen.add(symbol);
    let candidateRef: string | null | undefined;
    if (rec.candidateRef !== undefined && rec.candidateRef !== null) {
      if (typeof rec.candidateRef !== 'string' || rec.candidateRef.length === 0) {
        throw new Error('incomplete candidate ref');
      }
      candidateRef = rec.candidateRef;
    }
    out.push(candidateRef === undefined ? { symbol } : { symbol, candidateRef });
  }
  return out;
}

/**
 * canonical tasks.md만 받고 stable Task ID와 brief hash를 만든다.
 * symlink가 저장소 밖으로 나가면 거절한다 — cache 경로를 외부 파일에 묶지 않는다.
 *
 * @param {object} input - 경로와 fs
 * @returns {{ repoReal: string, taskRel: string, taskAbs: string, stableTask: string, taskBriefHash: string }}
 */
function loadExecutionTask(input: {
  repoRoot: string;
  taskFile: string;
  fs: InjectedFs;
}): {
  repoReal: string;
  taskRel: string;
  taskAbs: string;
  stableTask: string;
  taskBriefHash: string;
} {
  if (typeof input.taskFile !== 'string' || input.taskFile.trim() === '') {
    throw new Error('taskFile must be a non-empty path');
  }
  const taskRel = toPosix(input.taskFile);
  if (path.isAbsolute(taskRel) || taskRel.includes('..')) {
    throw new Error('taskFile must be a repo-relative canonical tasks.md path');
  }
  if (!CANONICAL_TASK_RE.test(taskRel)) {
    throw new Error('taskFile is not a canonical task layout path');
  }
  const repoReal = input.fs.realpathSync(input.repoRoot);
  const taskAbs = path.resolve(repoReal, taskRel);
  let taskReal: string;
  try {
    taskReal = input.fs.realpathSync(taskAbs);
  } catch (error) {
    throw new Error('taskFile is not readable inside the repository', { cause: error });
  }
  if (!isInsideRepo(taskReal, repoReal)) {
    throw new Error('taskFile escapes the repository boundary');
  }
  const doc = readDoc(taskAbs);
  const data = doc.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('task brief frontmatter is invalid');
  }
  const bouncer = (data as Record<string, unknown>).bouncer;
  if (!bouncer || typeof bouncer !== 'object' || Array.isArray(bouncer)) {
    throw new Error('task brief bouncer block is invalid');
  }
  const block = bouncer as Record<string, unknown>;
  const pathIds = parsePathIds(taskRel);
  if (!pathIds.epicId || !pathIds.blueprintId || pathIds.kind !== 'tasks') {
    throw new Error('taskFile is not a canonical task layout path');
  }
  // 경로 id와 frontmatter id가 어긋나면 다른 Task의 cache를 소유자로 삼는다.
  if (String(block.epic_id || '') !== pathIds.epicId
    || String(block.blueprint_id || '') !== pathIds.blueprintId) {
    throw new Error('task brief ids do not match the canonical path');
  }
  const stable = buildStableProvenance({
    epicId: block.epic_id,
    blueprintId: block.blueprint_id,
    taskId: block.id,
  });
  const raw = input.fs.readFileSync(taskAbs);
  const bytes = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
  return {
    repoReal,
    taskRel,
    taskAbs,
    stableTask: stable.task,
    taskBriefHash: createHash('sha256').update(bytes).digest('hex'),
  };
}

type LiveCoordinate =
  | { status: 'resolved'; symbol: string; function_ref: string; symbol_ref: SymbolRef }
  | { status: 'unlinked' | 'unresolved' | 'ambiguous'; symbol: string; payload: unknown };

/**
 * Git 없이 현재 checkout 정의만 고른다. hit 판정이 blame/log를 치면 안 되므로
 * symbol-index만 사용한다.
 *
 * @param {object} input - 저장소·요청·resolver
 * @returns {LiveCoordinate} 현재 함수 좌표 또는 비연결 상태
 */
function resolveLiveCoordinate(input: {
  repoRoot: string;
  request: FunctionRequest;
  resolveSymbol: typeof resolveSymbol;
}): LiveCoordinate {
  const selected = input.resolveSymbol({
    repoRoot: input.repoRoot,
    symbol: input.request.symbol,
    candidateRef: input.request.candidateRef,
  });
  if (selected.status === 'ambiguous') {
    // candidate 없는 동명은 incomplete selection이다. bundle에 부분 entry를 쓰지 않는다.
    throw new Error(`ambiguous symbol requires candidate ref: ${input.request.symbol}`);
  }
  if (selected.status === 'unresolved') {
    return { status: 'unresolved', symbol: input.request.symbol, payload: selected };
  }
  const symbolRef = selected.symbol_ref as SymbolRef;
  // function_ref는 symbol-index가 이미 만든 opaque candidate_ref와 같다.
  // 호출자가 candidateRef를 넘겼으면 그 값을 그대로 쓰고, 없으면 이미 고른
  // symbol_ref 좌표만 해시한 값으로 둔다 — makeCandidateRef 복제본을 따로
  // 유지하지 않아 양쪽 필드 목록이 어긋날 여지를 없앤다.
  const function_ref = typeof input.request.candidateRef === 'string'
    && input.request.candidateRef.length > 0
    ? input.request.candidateRef
    : hashSelectedSymbolRef(symbolRef);
  return {
    status: 'resolved',
    symbol: input.request.symbol,
    function_ref,
    symbol_ref: symbolRef,
  };
}

/**
 * resolveSymbol이 고른 symbol_ref 좌표만으로 opaque function ref를 만든다.
 * 호출자 candidateRef가 없을 때의 bundle 내부 identity이며, symbol-index
 * makeCandidateRef를 별도 복제해 동기화하지 않는다.
 *
 * @param {SymbolRef} symbolRef - resolveSymbol이 반환한 현재 정의 좌표
 * @returns {string} SHA-256 hex
 */
function hashSelectedSymbolRef(symbolRef: SymbolRef): string {
  const payload = [
    symbolRef.path,
    symbolRef.qualified_name,
    symbolRef.kind,
    String(symbolRef.start_line),
    String(symbolRef.end_line),
  ].join('\0');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * cache JSON을 읽고 shape·hash·stable ID를 검증한다. 하나라도 깨지면 null —
 * 손상 cache를 hit로 인정하지 않고 현재 입력으로 재생성한다.
 *
 * @param {object} input - 파일·기대 Task·fs
 * @returns {BundleRecord | null} 유효 record 또는 null
 */
function readValidBundleRecord(input: {
  intentFile: string;
  expectedTask: string;
  fs: InjectedFs;
}): BundleRecord | null {
  if (!input.fs.existsSync(input.intentFile)) return null;
  let raw: string;
  try {
    const bytes = input.fs.readFileSync(input.intentFile, 'utf8');
    raw = typeof bytes === 'string' ? bytes : bytes.toString('utf8');
  } catch (error) {
    // 읽기 실패는 miss로만 접는다. 권한 오류를 throw하면 재생성 경로가 막힌다.
    if (isFsCode(error, 'ENOENT') || isFsCode(error, 'EACCES') || isFsCode(error, 'EPERM')) {
      return null;
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return null;
  }
  if (!isValidBundleRecord(parsed, input.expectedTask)) return null;
  return parsed;
}

/**
 * record shape와 content hash 재계산이 맞는지 검사한다.
 * cache body는 data이므로 여기서 통과한 값만 hit 후보가 된다.
 *
 * @param {unknown} value - 파싱된 JSON
 * @param {string} expectedTask - 현재 실행 Task stable ID
 * @returns {boolean} 유효하면 true
 */
function isValidBundleRecord(value: unknown, expectedTask: string): value is BundleRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if (rec.version !== 1) return false;
  if (rec.task !== expectedTask || !STABLE_TASK_RE.test(String(rec.task || ''))) return false;
  if (typeof rec.task_brief_hash !== 'string' || !HASH_RE.test(rec.task_brief_hash)) return false;
  if (typeof rec.revision !== 'number' || !Number.isInteger(rec.revision) || rec.revision < 1) {
    return false;
  }
  if (typeof rec.bundle_id !== 'string' || !HASH_RE.test(rec.bundle_id)) return false;
  if (!Array.isArray(rec.functions)) return false;
  const entries: BundleFunctionEntry[] = [];
  for (const entry of rec.functions) {
    if (!isValidFunctionEntry(entry)) return false;
    entries.push(entry);
  }
  // 저장 id가 현재 정규화 content와 다르면 조작·부분 write다. hit로 보지 않는다.
  if (contentBundleId(entries) !== rec.bundle_id) return false;
  return true;
}

function isValidFunctionEntry(value: unknown): value is BundleFunctionEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.symbol !== 'string' || entry.symbol.trim() === '') return false;
  if (entry.status === 'unresolved') {
    return Object.keys(entry).every((key) => key === 'symbol' || key === 'status');
  }
  if (entry.status === 'ambiguous') {
    return Array.isArray(entry.candidates);
  }
  if (entry.status !== 'resolved' && entry.status !== 'unlinked') return false;
  if (typeof entry.function_ref !== 'string' || !HASH_RE.test(entry.function_ref)) return false;
  if (typeof entry.blob_sha !== 'string' || !/^[0-9a-f]{40}$/.test(entry.blob_sha)) return false;
  if (!isValidSymbolRef(entry.symbol_ref)) return false;
  // top-level blob과 symbol_ref.blob이 어긋나면 조작·부분 write다. hit로 보지 않는다.
  if (entry.blob_sha !== (entry.symbol_ref as SymbolRef).blob_sha) return false;
  if (entry.status === 'unlinked') {
    return entry.provenance === undefined;
  }
  return isValidProvenance(entry.provenance);
}

function isValidSymbolRef(value: unknown): value is SymbolRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as Record<string, unknown>;
  return typeof ref.path === 'string'
    && typeof ref.qualified_name === 'string'
    && typeof ref.kind === 'string'
    && typeof ref.start_line === 'number'
    && typeof ref.end_line === 'number'
    && typeof ref.blob_sha === 'string'
    && /^[0-9a-f]{40}$/.test(ref.blob_sha);
}

function isValidProvenance(value: unknown): value is ProvenanceFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prov = value as Record<string, unknown>;
  if (!STABLE_TASK_RE.test(String(prov.task || ''))) return false;
  if (!COMMIT_RE.test(String(prov.commit || ''))) return false;
  if (typeof prov.explain !== 'string' || prov.explain.length === 0) return false;
  // cache body는 data다. 임의 경로를 Explain 읽기로 승격하지 않도록 canonical만 받는다.
  if (!isCanonicalExplainRel(prov.explain)) return false;
  if (typeof prov.freshness !== 'string' || !FRESHNESS.has(prov.freshness)) return false;
  if (typeof prov.relation !== 'string' || (prov.relation !== 'blame' && prov.relation !== 'follow')) {
    return false;
  }
  if (!Array.isArray(prov.sections)) return false;
  // historical은 절 hash를 저장하지 않는다. 다른 freshness는 절마다 name·hash가 필요하다.
  if (prov.freshness === 'historical') {
    return prov.sections.length === 0;
  }
  for (const section of prov.sections) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return false;
    const row = section as Record<string, unknown>;
    if (typeof row.name !== 'string' || row.name.length === 0) return false;
    if (typeof row.hash !== 'string' || !HASH_RE.test(row.hash)) return false;
  }
  return true;
}

/**
 * 저장된 function ref·blob·절 hash가 현재 checkout과 같은지 검사한다.
 * 같으면 provenance Task·commit·freshness를 재사용하고 Git resolver를 건너뛴다.
 *
 * @param {BundleRecord} record - 검증된 cache
 * @param {LiveCoordinate[]} liveCoords - 현재 함수 좌표
 * @param {string} repoReal - realpath 루트
 * @param {InjectedFs} io - realpath·읽기에 쓸 fs (테스트 주입)
 * @returns {boolean} hit이면 true
 */
function isCacheHit(
  record: BundleRecord,
  liveCoords: LiveCoordinate[],
  repoReal: string,
  io: InjectedFs,
): boolean {
  if (record.functions.length !== liveCoords.length) return false;
  const bySymbol = new Map(record.functions.map((entry) => [entry.symbol, entry]));
  // 요청 집합이 다르면 miss. 정렬 전 live 순서와 기록 순서가 달라도 symbol로 맞춘다.
  for (const live of liveCoords) {
    const stored = bySymbol.get(live.symbol);
    if (!stored) return false;
    bySymbol.delete(live.symbol);
    if (live.status === 'unresolved') {
      if (stored.status !== 'unresolved') return false;
      continue;
    }
    if (live.status !== 'resolved') return false;
    if (stored.status !== 'resolved' && stored.status !== 'unlinked') return false;
    if (stored.function_ref !== live.function_ref) return false;
    if (stored.blob_sha !== live.symbol_ref.blob_sha) return false;
    if (stored.status === 'unlinked') continue;
    if (!sectionHashesMatch(stored.provenance, repoReal, io)) return false;
  }
  return bySymbol.size === 0;
}

/**
 * non-historical provenance의 Explain 절 hash를 지금 다시 계산해 비교한다.
 * historical은 절을 저장하지 않으므로 canonical 경로·repo 경계만 확인한다.
 *
 * @param {ProvenanceFields} provenance - 저장된 provenance
 * @param {string} repoReal - realpath 루트
 * @param {InjectedFs} io - Explain 경계 확인용 fs
 * @returns {boolean} 절 hash가 일치하면 true
 */
function sectionHashesMatch(
  provenance: ProvenanceFields,
  repoReal: string,
  io: InjectedFs,
): boolean {
  // cache가 지시하는 explain 경로는 live resolve와 같은 allowlist를 통과해야 한다.
  if (!isCanonicalExplainRel(provenance.explain)) return false;
  if (provenance.freshness === 'historical') {
    return provenance.sections.length === 0
      && explainInsideRepo(repoReal, provenance.explain, io);
  }
  const projected = projectExplainSectionHashes({
    repoRoot: repoReal,
    explainRel: provenance.explain,
    task: provenance.task,
  });
  if (!projected) return false;
  if (projected.length !== provenance.sections.length) return false;
  for (let i = 0; i < projected.length; i += 1) {
    if (projected[i].name !== provenance.sections[i].name) return false;
    if (projected[i].hash !== provenance.sections[i].hash) return false;
  }
  return true;
}

/**
 * Explain 실경로가 저장소 안에 있는지 주입 fs로만 본다.
 * module-level fs를 쓰면 테스트·대체 루트 주입이 historical 경계에서 깨진다.
 *
 * @param {string} repoReal - realpath 루트
 * @param {string} explainRel - repo-relative Explain
 * @param {InjectedFs} io - realpathSync 제공자
 * @returns {boolean} 저장소 안이면 true
 */
function explainInsideRepo(repoReal: string, explainRel: string, io: InjectedFs): boolean {
  try {
    const abs = path.resolve(repoReal, explainRel);
    const real = io.realpathSync(abs);
    return isInsideRepo(real, repoReal);
  } catch (error) {
    if (isSkippableFsError(error)) return false;
    throw error;
  }
}

/**
 * live 좌표와 provenance resolver 결과로 한 function entry를 만든다.
 * unresolved·unlinked에는 존재하지 않는 provenance 필드를 합성하지 않는다.
 *
 * @param {object} input - 요청·live·resolver
 * @returns {BundleFunctionEntry} 기록용 entry
 */
function buildFunctionEntry(input: {
  repoRoot: string;
  request: FunctionRequest;
  live: LiveCoordinate;
  resolveIntentProvenance: typeof defaultResolveIntentProvenance;
}): BundleFunctionEntry {
  if (input.live.status === 'unresolved') {
    return { symbol: input.request.symbol, status: 'unresolved' };
  }
  if (input.live.status !== 'resolved') {
    throw new Error(`unsupported live coordinate status for ${input.request.symbol}`);
  }

  const result = input.resolveIntentProvenance({
    repoRoot: input.repoRoot,
    symbol: input.request.symbol,
    candidateRef: input.request.candidateRef,
  });

  if (result.status === 'unresolved') {
    return { symbol: input.request.symbol, status: 'unresolved' };
  }
  if (result.status === 'ambiguous') {
    throw new Error(`ambiguous symbol requires candidate ref: ${input.request.symbol}`);
  }
  if (result.status === 'unlinked') {
    return {
      symbol: input.request.symbol,
      status: 'unlinked',
      function_ref: input.live.function_ref,
      blob_sha: input.live.symbol_ref.blob_sha,
      symbol_ref: input.live.symbol_ref,
    };
  }

  const top = result.candidates[0];
  if (!top) {
    // resolved인데 candidate가 비면 계약 위반이다. 부분 성공으로 쓰지 않는다.
    throw new Error(`resolved provenance returned no candidates for ${input.request.symbol}`);
  }
  // cache·live 모두 같은 allowlist. non-canonical Explain은 읽기 전에 거절한다.
  if (!isCanonicalExplainRel(top.explain)) {
    throw new Error(`Explain path is not canonical: ${top.explain}`);
  }
  let sections: SectionHash[];
  if (top.freshness === 'historical') {
    sections = [];
  } else {
    const projected = projectExplainSectionHashes({
      repoRoot: input.repoRoot,
      explainRel: top.explain,
      task: top.task,
    });
    // null 을 [] 로 바꾸면 없는 Explain이 빈 절 resolved로 저장된다 — 부분 성공 금지.
    if (!projected || projected.length === 0) {
      throw new Error(`unable to project Explain section hashes for ${top.explain}`);
    }
    sections = projected;
  }

  return {
    symbol: input.request.symbol,
    status: 'resolved',
    function_ref: input.live.function_ref,
    blob_sha: input.live.symbol_ref.blob_sha,
    symbol_ref: input.live.symbol_ref,
    provenance: {
      task: top.task,
      commit: top.commit,
      explain: top.explain,
      freshness: top.freshness,
      relation: top.relation,
      sections,
    },
  };
}

/**
 * function entry 배열의 결정적 SHA-256. object key와 entry 순서를 정규화해
 * 같은 내용이면 같은 bundle_id가 나오게 한다.
 *
 * @param {BundleFunctionEntry[]} entries - 정렬 전·후 모두 허용
 * @returns {string} lowercase 64자리 hex
 */
function contentBundleId(entries: BundleFunctionEntry[]): string {
  const normalized = [...entries].sort(compareEntries).map(canonicalizeEntry);
  return createHash('sha256').update(JSON.stringify(normalized), 'utf8').digest('hex');
}

function compareEntries(left: BundleFunctionEntry, right: BundleFunctionEntry): number {
  return left.symbol < right.symbol ? -1 : left.symbol > right.symbol ? 1 : 0;
}

function canonicalizeEntry(entry: BundleFunctionEntry): unknown {
  if (entry.status === 'unresolved') {
    return { status: 'unresolved', symbol: entry.symbol };
  }
  if (entry.status === 'ambiguous') {
    return { candidates: entry.candidates, status: 'ambiguous', symbol: entry.symbol };
  }
  const base = {
    blob_sha: entry.blob_sha,
    function_ref: entry.function_ref,
    status: entry.status,
    symbol: entry.symbol,
    symbol_ref: {
      blob_sha: entry.symbol_ref.blob_sha,
      end_line: entry.symbol_ref.end_line,
      kind: entry.symbol_ref.kind,
      path: entry.symbol_ref.path,
      qualified_name: entry.symbol_ref.qualified_name,
      start_line: entry.symbol_ref.start_line,
    },
  };
  if (entry.status === 'unlinked') return base;
  return {
    ...base,
    provenance: {
      commit: entry.provenance.commit,
      explain: entry.provenance.explain,
      freshness: entry.provenance.freshness,
      relation: entry.provenance.relation,
      sections: entry.provenance.sections.map((section) => ({
        hash: section.hash,
        name: section.name,
      })),
      task: entry.provenance.task,
    },
  };
}

/**
 * 같은 디렉터리 tmp + rename으로 JSON을 원자적으로 쓴다.
 * 다른 볼륨 tmp는 쓰지 않는다 — rename이 copy+unlink가 되면 부분 record가 보인다.
 *
 * @param {string} target - 최종 경로
 * @param {BundleRecord} record - 기록할 bundle
 * @param {InjectedFs} io - fs 주입
 */
function atomicWriteJson(target: string, record: BundleRecord, io: InjectedFs): void {
  const dir = path.dirname(target);
  io.mkdirSync(dir, { recursive: true });
  const payload = `${JSON.stringify(record, null, 2)}\n`;
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  io.writeFileSync(tmp, payload);
  try {
    io.renameSync(tmp, target);
  } catch (error) {
    try {
      io.rmSync(tmp, { force: true });
    } catch (_cleanup) {
      // tmp 정리는 best-effort. rename 실패 원인을 가리지 않는다.
    }
    throw error;
  }
}

function isInsideRepo(absPath: string, repoReal: string): boolean {
  if (absPath === repoReal) return true;
  const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
  return absPath.startsWith(prefix);
}

/**
 * live resolve가 읽는 canonical Explain 경로만 허용한다.
 * cache가 `src/secret.ts` 같은 임의 상대경로를 읽기 대상으로 지시하지 못하게 한다.
 *
 * @param {string} explainRel - provenance.explain 후보
 * @returns {boolean} allowlist에 맞으면 true
 */
function isCanonicalExplainRel(explainRel: string): boolean {
  if (typeof explainRel !== 'string' || explainRel.length === 0) return false;
  const rel = toPosix(explainRel);
  if (path.isAbsolute(rel) || rel.includes('..')) return false;
  if (!CANONICAL_EXPLAIN_RE.test(rel)) return false;
  const ids = parsePathIds(rel);
  return ids.kind === 'explain' && Boolean(ids.epicId) && Boolean(ids.blueprintId);
}

/**
 * intent cache 파일·부모 실경로가 Git common directory 안에 있는지 고정한다.
 * `bouncer`/`intent`/digest 파일 symlink가 common dir 밖으로 새면 읽기·쓰기를 거절한다.
 *
 * @param {string} intentFile - intentBundlePathFor가 준 경로
 * @param {string} commonGitDir - Git common directory
 * @param {InjectedFs} io - realpath·mkdir 주입
 * @param {{ createDir?: boolean }} [opts] - write 직전에만 부모 mkdir
 */
function assertIntentPathInCommonDir(
  intentFile: string,
  commonGitDir: string,
  io: InjectedFs,
  opts: { createDir?: boolean } = {},
): void {
  let commonReal: string;
  try {
    commonReal = io.realpathSync(commonGitDir);
  } catch (error) {
    throw new Error('Git common directory is not readable', { cause: error });
  }
  // 존재하는 조상부터 파일까지 실경로가 common 안에 있어야 한다.
  // 없는 구간은 write 시 mkdir 뒤에 다시 검사한다.
  let cursor = intentFile;
  for (;;) {
    if (io.existsSync(cursor)) {
      let real: string;
      try {
        real = io.realpathSync(cursor);
      } catch (error) {
        if (isSkippableFsError(error)) {
          throw new Error('intent cache path escapes the Git common directory', { cause: error });
        }
        throw error;
      }
      if (real !== commonReal && !isInsideRepo(real, commonReal)) {
        throw new Error('intent cache path escapes the Git common directory');
      }
    }
    if (cursor === commonGitDir || cursor === commonReal) break;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (!opts.createDir) return;
  const dir = path.dirname(intentFile);
  io.mkdirSync(dir, { recursive: true });
  let dirReal: string;
  try {
    dirReal = io.realpathSync(dir);
  } catch (error) {
    throw new Error('intent cache directory escapes the Git common directory', { cause: error });
  }
  if (!isInsideRepo(dirReal, commonReal)) {
    throw new Error('intent cache directory escapes the Git common directory');
  }
}

function isFsCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

function isSkippableFsError(error: unknown): boolean {
  return isFsCode(error, 'ENOENT')
    || isFsCode(error, 'EACCES')
    || isFsCode(error, 'EPERM')
    || isFsCode(error, 'ELOOP')
    || isFsCode(error, 'ENOTDIR');
}

export = { resolveTaskIntentBundle };
