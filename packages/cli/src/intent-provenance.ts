'use strict';

import guards = require('./guards');
const { isSkippableFsError } = guards;
import fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
import symbolIndex = require('./symbol-index');
const { resolveSymbol } = symbolIndex;
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import commitSha = require('./commit-sha');
const { normalizeCommitSha, buildStableProvenance } = commitSha;
import validateSections = require('./validate-sections');
const { parseExplainSections } = validateSections;
import contextIds = require('./context-ids');
const {
  parseStableId, parsePointerKey, parseContextPath, formatStableIntentId, formatStableTaskId, normalizeStableId,
} = contextIds;
import epicRegistryMod = require('./epic-registry');
const { readEpicRegistry } = epicRegistryMod;
import paths = require('./paths');
const { toPosix } = paths;
import intentRevision = require('./intent-revision');
const { resolveHistoryRef, listExplainSourcesAt, readRegistryAt, listDefinitionsAtRevision } = intentRevision;
import canonicalJsonMod = require('./canonical-json');
const { sha256Canonical } = canonicalJsonMod;

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const BODY_BUDGET_BYTES = 2000;
const INTENT_ANCHOR_RE = /^task-(\d{3})$/;
const TASK_DIR_RE = /^(\d{3})$/;
const TRAILER_RE = /^(Bouncer-Task|Bouncer-Intent)\s*:\s*(.*?)\s*$/;
// loadExplainDocs가 걷는 경로와 같은 canonical Explain만 projection 입력이 된다.
// 번호(`NNN-slug`)와 slug 두 경로 형식을 모두 받되 세그먼트 해석은 parseContextPath에 맡긴다.
const EXPLAIN_SHAPE_RE = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+\/explain\.md$/;
// 고정 SHA 조회가 부르는 Git의 stdout 상한. intent-revision의 GIT_MAX_BUFFER와 같은 256 MiB다.
// 그 상수는 export되지 않아 같은 값을 여기 둔다. 넘으면 잘린 결과 대신 던진다.
const PINNED_GIT_MAX_BUFFER = 268435456;
// 고정 SHA 조회가 상위 프로세스에서 물려받으면 안 되는 객체 DB 지정. intent-revision의 목록과 같다.
const PINNED_CLEARED_ENV = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE',
];
const FULL_SHA_RE = /^[0-9a-f]{40}$/;
const SHORT_SHA_RE = /^[0-9a-f]{8}$/;
const INTENT_AT_REVISION_PROJECTION = 'intent-at-revision/1';

/** loadExplainDocs가 걷는 canonical Explain 경로(번호·slug 두 형식)인지 판정한다. */
function isCanonicalExplainPath(rel: string): boolean {
  if (!EXPLAIN_SHAPE_RE.test(rel)) return false;
  const ids = parseContextPath(rel);
  return ids !== null && ids.blueprintKey !== null;
}

// 등록부를 읽는 쪽은 진입점 한 곳이다. 없음·깨짐(S35)은 null — 정규화 없이 정확 일치로 비교해
// 이관 전 동작과 같다. 깨진 등록부의 거절은 검증 gate 소관이고 이 조회는 읽기 전용이다.
type Registry = Parameters<typeof normalizeStableId>[1];
function readRegistryOrNull(repoRoot: string): Registry {
  const read = readEpicRegistry(repoRoot);
  return read.status === 'ok' ? read.registry : null;
}
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.worktrees', 'graphify-out']);
const FRESHNESS_RANK: Record<Freshness, number> = {
  current: 0,
  related: 1,
  'possibly-superseded': 2,
  historical: 3,
};

type SymbolRef = {
  path: string;
  qualified_name: string;
  kind: string;
  start_line: number;
  end_line: number;
  blob_sha: string;
};

type Freshness = 'current' | 'related' | 'possibly-superseded' | 'historical';
type Relation = 'blame' | 'follow';

type ProvenanceCandidate = {
  relation: Relation;
  commit: string;
  task: string;
  explain: string;
  freshness: Freshness;
  sections: string[];
  body: string;
};

type ResolveIntentInput = {
  repoRoot: string;
  symbol: string;
  candidateRef?: string | null;
  limit?: number;
};

type IntentResult =
  | {
      status: 'resolved';
      symbol: string;
      symbol_ref: SymbolRef;
      candidates: ProvenanceCandidate[];
      truncated: boolean;
    }
  | {
      status: 'unlinked';
      symbol: string;
      symbol_ref: SymbolRef;
      candidates: ProvenanceCandidate[];
      truncated: boolean;
    }
  | {
      status: 'ambiguous';
      symbol: string;
      candidates: unknown[];
      truncated: boolean;
    }
  | {
      status: 'unresolved';
      symbol: string;
      candidates: unknown[];
      truncated: boolean;
      /** 구문 오류로 색인에서 빠진 source 파일. 비면 키를 생략한다. */
      unparsed_files?: string[];
    };

type GitResult = { status: number; stdout: string; stderr: string };

type TrailerParse =
  | { status: 'absent' }
  | { status: 'ok'; task: string }
  | { status: 'reject' };

type ExplainDoc = {
  rel: string;
  epicId: string;
  bpId: string;
  // 두 key를 형식별 intent stable ID로 만든 값. 별칭 정규화 비교의 한쪽이다.
  intentId: string;
  body: string;
  rows: ExplainRow[];
  sections: SelectedSection[];
  // 고정 SHA에서 읽은 blob SHA. 작업 트리에서 읽은 Explain은 null이다.
  blob_sha: string | null;
};

type ExplainRow = {
  task: string;
  sha8: string;
};

type SelectedSection = { name: string; body: string };

type SectionHash = { name: string; hash: string };

type ShaExpand =
  | { status: 'unique'; full: string }
  | { status: 'ambiguous' }
  | { status: 'missing' };

type LinkHit = { task: string; explain: string };

type CommitMeta = {
  sha: string;
  ct: number;
  relation: Relation;
  functionTouch: boolean;
};

type LinkedDraft = CommitMeta & {
  task: string;
  explain: string;
  sections: SelectedSection[];
  explain_blob_sha: string | null;
};

// Git 호출 하나의 실행기. 작업 트리 조회와 고정 SHA 조회가 각자의 env·revision을 닫아서 넘긴다.
type GitRun = (args: string[]) => GitResult;
// 고정 SHA 모드의 옵션. 있으면 env를 고정하고 stdout 상한을 건다.
type PinnedGit = { maxBuffer: number };

// 연결과 정렬이 끝난 후보. 본문 예산과 직렬화 전의 절 목록을 가진다.
type RankedLink = {
  relation: Relation;
  commit: string;
  task: string;
  explain: string;
  explain_blob_sha: string | null;
  freshness: Freshness;
  // historical 연결은 빈 배열이다. 과거 함수 커밋의 설계 절이 현재 동작의 근거처럼 보이지 않게 한다.
  parts: SelectedSection[];
  ct: number;
};

type IntentAtRevisionCandidate = {
  relation: Relation;
  commit: string;
  task: string;
  explain: string;
  explain_blob_sha: string;
  freshness: Freshness;
  sections: SelectedSection[];
};

type IntentAtRevisionResult = {
  schema_version: 1;
  projection_version: 'intent-at-revision/1';
  history_ref: string;
  symbol_ref: SymbolRef;
  status: 'resolved' | 'unlinked';
  explain_docs: number;
  registry_blob_sha: string | null;
  total_linked: number;
  candidates: IntentAtRevisionCandidate[];
  digest: string;
};

type IntentAtRevisionInput = {
  repoRoot: string;
  historyRef: string;
  symbolRef: SymbolRef;
  limit?: number;
};

/**
 * 현재 checkout의 함수 정의에 Git blame/log와 Explain을 연결한다.
 * trailer와 Explain 본문은 데이터일 뿐이라서 limit·status·workflow를 바꾸지 않는다.
 * Git이 없거나 명령이 실패하면 unlinked로 접지 않고 던진다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트. 이 경계 밖 Explain은 증거가 되지 않는다
 * @param {string} input.symbol - 함수명. TASKS-001과 같은 식별자
 * @param {string} [input.candidateRef] - TASKS-001이 발급한 opaque ref
 * @param {number} [input.limit] - 반환 candidate 수. 생략 시 3, 허용 1..5
 * @returns {IntentResult} resolved / unlinked / ambiguous / unresolved
 */
function resolveIntentProvenance(input: ResolveIntentInput): IntentResult {
  // 1. limit는 조회 전에 거절한다. 잘못된 예산을 들고 Git을 치지 않는다.
  const limit = requireLimit(input.limit);
  const symbol = typeof input.symbol === 'string' ? input.symbol : '';
  const selected = resolveSymbol({
    repoRoot: input.repoRoot,
    symbol: input.symbol,
    candidateRef: input.candidateRef,
  });

  // 2. 정의가 없거나 동명이면 provenance를 만들지 않는다. TASKS-001 상태를 보존한다.
  if (selected.status !== 'resolved') {
    const base = {
      status: selected.status,
      symbol,
      candidates: selected.candidates,
      truncated: false,
    };
    if (selected.status === 'unresolved' && selected.unparsed_files.length > 0) {
      return { ...base, status: 'unresolved', unparsed_files: selected.unparsed_files };
    }
    return base;
  }

  const repoReal = fs.realpathSync(input.repoRoot);
  requireGitRepo(repoReal);

  const symbolRef = selected.symbol_ref as SymbolRef;
  const tracked = runGit(repoReal, ['ls-files', '--', symbolRef.path]);
  if (tracked.status !== 0) {
    throw gitFailure('git ls-files failed', tracked);
  }
  // 추적되지 않은 파일은 이력이 없는 정상 비연결이다. 명령 실패로 취급하지 않는다.
  if (tracked.stdout.trim().length === 0) {
    return unlinkedResult(symbol, symbolRef);
  }

  // 1. 이력·trailer·Explain은 작업 트리에서 읽고, 짧은 SHA는 기존처럼 rev-parse로 펼친다.
  // 연결·정렬 규칙은 고정 SHA 조회와 같은 linkAndRank가 맡는다.
  const run: GitRun = (args) => runGit(repoReal, args);
  const metas = collectCommitMetas(run, symbolRef, symbol, null);
  const registry = readRegistryOrNull(repoReal);
  const explains = loadExplainDocs(repoReal);
  const ranked = linkAndRank({
    run,
    metas,
    registry,
    explains,
    expand: (sha8) => expandShortSha(repoReal, sha8),
  });
  if (ranked.length === 0) {
    return unlinkedResult(symbol, symbolRef);
  }

  // 2. 본문 예산은 limit 뒤에 적용한다. 예산은 이 조회의 출력 크기 계약이라 고정 SHA 조회에는 붙이지 않는다.
  const candidates: ProvenanceCandidate[] = ranked.slice(0, limit).map((item) => ({
    relation: item.relation,
    commit: item.commit,
    task: item.task,
    explain: item.explain,
    freshness: item.freshness,
    sections: item.parts.map((part) => part.name),
    body: serializeSections(item.parts),
  }));
  const truncated = applyBodyBudget(candidates);

  return {
    status: 'resolved',
    symbol,
    symbol_ref: symbolRef,
    candidates,
    truncated,
  };
}

/**
 * limit를 1..5 정수로만 받는다. 문자열 숫자나 기본값 보정은 하지 않는다 —
 * CLI가 이미 거절해야 할 값을 resolver가 조용히 3으로 바꾸면 계약이 갈라진다.
 *
 * @param {unknown} limit - 호출자가 넘긴 상한
 * @returns {number} 사용할 candidate 수
 */
function requireLimit(limit: unknown): number {
  if (limit === undefined || limit === null) return DEFAULT_LIMIT;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error('limit must be an integer between 1 and 5');
  }
  return limit;
}

function unlinkedResult(symbol: string, symbolRef: SymbolRef): IntentResult {
  return {
    status: 'unlinked',
    symbol,
    symbol_ref: symbolRef,
    candidates: [],
    truncated: false,
  };
}

/**
 * cwd를 저장소 루트로 두고 argv 배열만 넘긴다. 셸 문자열을 만들지 않아
 * path·SHA가 플래그로 해석되거나 보간되지 않게 한다.
 *
 * pinned를 주면 고정 SHA 조회용 Git이 된다. 상속된 GIT_DIR 같은 객체 DB 지정을 지우고 replace ref를 끈다.
 * 다른 저장소를 가리키는 env가 남으면 같은 SHA라도 다른 답이 나오기 때문이다. stdout은 상한으로 막는다.
 * pinned가 없으면 env와 인자가 기존과 같다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} args - `git` 다음 argv
 * @param {PinnedGit} [pinned] - 고정 SHA 모드의 출력 상한. 있으면 env를 고정한다
 * @returns {GitResult} status·stdout·stderr. 비0도 throw하지 않는다
 * @throws {Error} 고정 모드에서 출력이 상한을 넘으면 `git output exceeds <maxBuffer> bytes`
 */
function runGit(repoRoot: string, args: string[], pinned?: PinnedGit): GitResult {
  // 1. 고정 모드에서만 env를 바꾼다. 기존 호출의 env는 그대로 둔다.
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (pinned) {
    for (const key of PINNED_CLEARED_ENV) delete env[key];
    env.GIT_NO_REPLACE_OBJECTS = '1';
  }
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // 2. 상한도 고정 모드에서만 건다. 기존 호출은 spawnSync 기본값을 그대로 쓴다.
    ...(pinned ? { maxBuffer: pinned.maxBuffer } : {}),
  });
  if (result.error) {
    // 3. ENOBUFS는 고정 모드의 출력 상한 초과다. 잘린 출력을 쓰지 않도록 던진다.
    if (pinned && (result.error as NodeJS.ErrnoException).code === 'ENOBUFS') {
      throw new Error(`git output exceeds ${pinned.maxBuffer} bytes`);
    }
    // ENOENT는 git 바이너리 부재다. unlinked로 접으면 설치 문제가 연결 부재로 보인다.
    throw new Error('git command is not executable', { cause: result.error });
  }
  return {
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function gitFailure(message: string, result: GitResult): Error {
  const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
  return new Error(detail ? `${message}: ${detail}` : message);
}

/**
 * work tree가 아니면 명시적으로 거절한다. rev-parse 실패를 unlinked로 바꾸지 않는다.
 *
 * @param {string} repoRoot - realpath 저장소 루트
 */
function requireGitRepo(repoRoot: string): void {
  const inside = runGit(repoRoot, ['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    throw gitFailure('not a git repository', inside);
  }
}

/**
 * blame의 현재 line 소유 commit과 `--follow` 파일 이력을 모은다.
 * rename은 follow가 담당하고, 같은 함수를 만진 commit은 `-G`로 표시한다.
 * revision이 있으면 그 커밋을 시작점으로 읽는다. 없으면 작업 트리 HEAD 기준 기존 호출과 같다.
 *
 * @param {GitRun} run - 이 조회의 Git 실행기
 * @param {SymbolRef} symbolRef - 현재 함수 좌표
 * @param {string} symbol - `-G`에 쓸 함수명
 * @param {string | null} revision - 고정 SHA. null이면 revision 인자를 넣지 않는다
 * @returns {CommitMeta[]} 중복 없는 commit 목록
 */
function collectCommitMetas(
  run: GitRun,
  symbolRef: SymbolRef,
  symbol: string,
  revision: string | null,
): CommitMeta[] {
  // revision은 blame·log에서 경로 앞에 둔다. null이면 인자 배열이 기존 호출과 같아진다.
  const at = revision === null ? [] : [revision];
  const blame = run([
    'blame', '--line-porcelain', '-L', `${symbolRef.start_line},${symbolRef.end_line}`,
    ...at, '--', symbolRef.path,
  ]);
  if (blame.status !== 0) {
    throw gitFailure('git blame failed', blame);
  }
  const blameShas = parseBlameShas(blame.stdout);

  const follow = run([
    'log', '--follow', '--format=%H%x1f%ct', ...at, '--', symbolRef.path,
  ]);
  if (follow.status !== 0) {
    throw gitFailure('git log --follow failed', follow);
  }

  const functionLog = run([
    'log', '--follow', '-G', escapeRegExp(symbol), '--format=%H', ...at, '--', symbolRef.path,
  ]);
  if (functionLog.status !== 0) {
    throw gitFailure('git log -G failed', functionLog);
  }
  const functionShas = new Set(
    functionLog.stdout.split('\n').map((line) => line.trim()).filter((line) => /^[0-9a-f]{40}$/.test(line)),
  );

  const bySha = new Map<string, CommitMeta>();
  for (const line of follow.stdout.split('\n')) {
    if (!line.trim()) continue;
    const [sha, ctRaw] = line.split('\x1f');
    if (!/^[0-9a-f]{40}$/.test(sha)) continue;
    const ct = Number.parseInt(ctRaw, 10);
    bySha.set(sha, {
      sha,
      ct: Number.isFinite(ct) ? ct : 0,
      relation: blameShas.has(sha) ? 'blame' : 'follow',
      functionTouch: functionShas.has(sha) || blameShas.has(sha),
    });
  }
  for (const sha of blameShas) {
    if (bySha.has(sha)) continue;
    bySha.set(sha, {
      sha,
      ct: committerUnix(run, sha),
      relation: 'blame',
      functionTouch: true,
    });
  }
  return [...bySha.values()];
}

/**
 * blame porcelain에서 줄을 소유한 commit SHA를 모은다.
 *
 * 커밋되지 않은 줄은 git이 null SHA(`0` 40개)로 표시한다. 실제 commit이 아니므로
 * provenance 후보에서 빼야 `git log`가 bad object로 실패하지 않고, 수정 중이거나
 * 새로 만든 함수가 bundle 전체를 깨뜨리지 않는다.
 *
 * @param {string} stdout - `git blame --line-porcelain` 원문
 * @returns {Set<string>} 커밋된 줄의 SHA 집합
 */
function parseBlameShas(stdout: string): Set<string> {
  const shas = new Set<string>();
  for (const line of stdout.split('\n')) {
    const match = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
    if (match && !/^0{40}$/.test(match[1])) shas.add(match[1]);
  }
  return shas;
}

function committerUnix(run: GitRun, sha: string): number {
  const result = run(['log', '-1', '--format=%ct', sha]);
  if (result.status !== 0) {
    throw gitFailure('git log %ct failed', result);
  }
  const ct = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(ct) ? ct : 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pickCurrentSha(metas: CommitMeta[]): string | null {
  const blame = metas.filter((item) => item.relation === 'blame');
  if (blame.length === 0) return null;
  return [...blame].sort((left, right) => {
    if (right.ct !== left.ct) return right.ct - left.ct;
    return left.sha < right.sha ? -1 : 1;
  })[0].sha;
}

/**
 * 현재 line owner는 current. 같은 함수를 나중에 연결 커밋이 고치면 앞선 함수
 * 커밋은 possibly-superseded. 함수를 만지지 않은 과거 연결은 historical이라서
 * 현재 동작의 근거처럼 본문을 실지 않는다.
 *
 * @param {LinkedDraft} item - 연결이 끝난 candidate
 * @param {LinkedDraft[]} linked - 같은 조회에서 연결된 전체
 * @param {string | null} currentSha - blame 최신 SHA
 * @returns {Freshness} freshness 값
 */
function freshnessOf(item: LinkedDraft, linked: LinkedDraft[], currentSha: string | null): Freshness {
  if (currentSha && item.sha === currentSha) return 'current';
  const laterLinkedFn = linked.some((other) => (
    other.sha !== item.sha
    && other.ct > item.ct
    && other.functionTouch
  ));
  if (laterLinkedFn && item.functionTouch) return 'possibly-superseded';
  if (laterLinkedFn && !item.functionTouch) return 'historical';
  if (item.functionTouch || item.relation === 'follow') return 'related';
  return 'historical';
}

/**
 * trailer를 우선하고, trailer가 없을 때만 Explain SHA 역색인으로 연결한다.
 * 상충·malformed trailer는 SHA fallback의 입력이 아니며, 모호 SHA·저장소 밖
 * 경로와 같이 증거가 되지 않는다.
 *
 * @param {GitRun} run - 이 조회의 Git 실행기
 * @param {string} sha - 40자리 commit
 * @param {ExplainDoc[]} explains - 저장소 안 canonical Explain
 * @param {Map<string, LinkHit[]>} shaIndex - full SHA → task·explain
 * @param {object | null} registry - 등록부(구형 trailer 정규화용). null이면 정확 일치
 * @returns {LinkHit | null} 하나면 hit, 없거나 모호·거절이면 null
 */
function linkCommit(
  run: GitRun,
  sha: string,
  explains: ExplainDoc[],
  shaIndex: Map<string, LinkHit[]>,
  registry: Registry,
): LinkHit | null {
  const message = run(['log', '-1', '--format=%B', sha]);
  if (message.status !== 0) {
    throw gitFailure('git log %B failed', message);
  }
  const trailer = parseTrailers(message.stdout);
  if (trailer.status === 'ok') {
    return uniqueHit(explainsForTask(explains, trailer.task, registry));
  }
  // reject는 연결 증거가 아니다. SHA 역색인은 trailer가 전혀 없을 때만 쓴다 —
  // 상충 Task 값을 두고 Explain이 그 SHA를 유일하게 찍으면 잘못된 쪽을 승격한다.
  if (trailer.status === 'reject') {
    return null;
  }
  return uniqueHit(shaIndex.get(sha) || []);
}

/**
 * 줄 앞의 Bouncer-Task/Intent만 trailer로 본다. 본문 한가운데 언급은 키가 아니다.
 * 값이 둘 이상이거나 Task·Intent가 어긋나면 reject다. SHA fallback으로 넘기지 않는다.
 *
 * @param {string} message - `%B` 본문
 * @returns {TrailerParse} ok / absent / reject
 */
function parseTrailers(message: string): TrailerParse {
  const tasks = new Set<string>();
  const intents = new Set<string>();
  for (const raw of message.split('\n')) {
    const match = TRAILER_RE.exec(raw);
    if (!match) continue;
    if (match[1] === 'Bouncer-Task') tasks.add(match[2]);
    else intents.add(match[2]);
  }
  if (tasks.size === 0 && intents.size === 0) return { status: 'absent' };
  if (tasks.size !== 1) return { status: 'reject' };
  const task = [...tasks][0];
  const parsed = parseStableId(task);
  if (!parsed || parsed.task === null) return { status: 'reject' };
  if (intents.size > 1) return { status: 'reject' };
  if (intents.size === 1) {
    // intent는 task와 같은 형식·같은 key여야 한다. 형식이 다른 쌍은 한 커밋이 두 체계를 주장하므로 reject.
    const intent = parseStableId([...intents][0]);
    if (!intent || intent.task !== null || intent.format !== parsed.format
      || intent.epicKey !== parsed.epicKey || intent.blueprintKey !== parsed.blueprintKey) {
      return { status: 'reject' };
    }
  }
  return { status: 'ok', task };
}

/**
 * trailer의 task가 속한 blueprint의 Explain을 찾는다. trailer와 Explain 경로의 intent를 각각
 * 등록부 별칭으로 정규화해 비교하므로, 구형 trailer 커밋도 이관 뒤의 slug Explain에 연결된다.
 * 별칭이 없거나 등록부가 null이면 원래 문자열끼리 비교한다(이관 전 동작).
 *
 * @param {ExplainDoc[]} explains - 저장소 안 canonical Explain
 * @param {string} task - trailer의 stable Task ID(번호 또는 slug 형식)
 * @param {object | null} registry - 등록부 또는 null
 * @returns {LinkHit[]} 같은 blueprint의 Explain hit
 */
function explainsForTask(explains: ExplainDoc[], task: string, registry: Registry): LinkHit[] {
  const parsed = parseStableId(task);
  if (!parsed || parsed.task === null) return [];
  const intent = formatStableIntentId(parsed);
  const wanted = normalizeStableId(intent, registry) ?? intent;
  const hits: LinkHit[] = [];
  const seen = new Set<string>();
  for (const doc of explains) {
    if ((normalizeStableId(doc.intentId, registry) ?? doc.intentId) !== wanted) continue;
    const key = `${task}\0${doc.rel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ task, explain: doc.rel });
  }
  return hits;
}

function uniqueHit(hits: LinkHit[]): LinkHit | null {
  if (hits.length === 0) return null;
  const keys = new Set(hits.map((item) => `${item.task}\0${item.explain}`));
  if (keys.size !== 1) return null;
  return hits[0];
}

/**
 * 8자리 SHA를 Git 객체로 펼친다. 둘 이상의 객체에 매기면 하나를 고르지 않는다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string} shortSha - Explain에 적힌 짧은 hex
 * @returns {ShaExpand} unique / ambiguous / missing
 */
function expandShortSha(repoRoot: string, shortSha: string): ShaExpand {
  const parsed = runGit(repoRoot, ['rev-parse', '--verify', shortSha]);
  const text = `${parsed.stdout}\n${parsed.stderr}`;
  if (/ambiguous/i.test(text)) return { status: 'ambiguous' };
  if (parsed.status !== 0) return { status: 'missing' };
  const full = parsed.stdout.trim();
  if (!/^[0-9a-f]{40}$/.test(full)) return { status: 'missing' };
  const kind = runGit(repoRoot, ['cat-file', '-t', full]);
  if (kind.status !== 0 || kind.stdout.trim() !== 'commit') return { status: 'missing' };
  return { status: 'unique', full };
}

/**
 * Explain task_commits의 짧은 SHA를 full SHA 역색인으로 만든다. 펼치는 방법은 호출자가 고른다.
 * 작업 트리는 rev-parse, 고정 SHA는 historyRef 도달 집합이다. 같은 규칙을 두 조회가 쓰게 하려고 주입받는다.
 *
 * @param {ExplainDoc[]} explains - 파싱에 성공한 Explain
 * @param {(sha8: string) => ShaExpand} expand - 8자 접두사 펼침
 * @returns {Map<string, LinkHit[]>} full SHA → 연결 후보. 모호·부재 접두사는 넣지 않는다
 */
function buildShaIndex(explains: ExplainDoc[], expand: (sha8: string) => ShaExpand): Map<string, LinkHit[]> {
  const index = new Map<string, LinkHit[]>();
  for (const doc of explains) {
    for (const row of doc.rows) {
      const expanded = expand(row.sha8);
      // 모호한 짧은 SHA는 어느 task에도 붙이지 않는다. 한 쪽을 찍으면 다른 객체의
      // 의도가 현재 함수 근거로 승격된다.
      if (expanded.status !== 'unique') continue;
      const list = index.get(expanded.full) || [];
      list.push({ task: row.task, explain: doc.rel });
      index.set(expanded.full, list);
    }
  }
  return index;
}

/**
 * canonical Explain만 읽는다. context graph 역색인은 쓰지 않고, symlink가
 * 저장소 밖으로 나가면 그 파일만 버린다.
 *
 * @param {string} repoReal - realpath 루트
 * @returns {ExplainDoc[]} 파싱에 성공한 Explain
 */
function loadExplainDocs(repoReal: string): ExplainDoc[] {
  const root = path.join(repoReal, '.bouncer', 'context');
  const files: string[] = [];
  walkExplain(root, repoReal, files);
  files.sort();
  const docs: ExplainDoc[] = [];
  for (const abs of files) {
    const parsed = parseExplainDoc(abs, repoReal);
    if (parsed) docs.push(parsed);
  }
  return docs;
}

function walkExplain(absDir: string, repoReal: string, files: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (error) {
    // 한 디렉터리의 부재·권한·루프만 건너뛴다. 그 외는 색인 전체를 공집합으로 위장하지 않는다.
    if (isSkippableFsError(error)) return;
    throw error;
  }
  for (const ent of entries) {
    if (ent.name === '.' || ent.name === '..') continue;
    const abs = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      if (!isInsideRepo(abs, repoReal)) continue;
      walkExplain(abs, repoReal, files);
      continue;
    }
    if (ent.name !== 'explain.md') continue;
    let real: string;
    try {
      real = fs.realpathSync(abs);
    } catch (error) {
      if (isSkippableFsError(error)) continue;
      throw error;
    }
    if (!isInsideRepo(real, repoReal)) continue;
    files.push(abs);
  }
}

/**
 * 작업 트리의 Explain 파일 하나를 읽어 판정한다. 읽기 실패는 이 파일만 버린다.
 *
 * @param {string} abs - Explain 절대 경로
 * @param {string} repoReal - realpath 저장소 루트
 * @returns {ExplainDoc | null} 파싱에 성공한 Explain 또는 버린 파일이면 null
 */
function parseExplainDoc(abs: string, repoReal: string): ExplainDoc | null {
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (error) {
    if (isSkippableFsError(error)) return null;
    throw error;
  }
  return parseExplainText({ rel: toPosix(path.relative(repoReal, abs)), raw, blobSha: null });
}

/**
 * Explain 원문 하나를 판정한다. 파일 I/O가 없어서 작업 트리 파일과 고정 SHA blob이 같은 규칙을 쓴다.
 * 깨진 frontmatter, 형식 위반, key 불일치는 null이다. 이 판정이 explain_docs의 정의다.
 *
 * @param {{ rel: string, raw: string, blobSha: string | null }} input - 저장소 상대 경로, 원문, blob SHA
 * @returns {ExplainDoc | null} 파싱에 성공한 Explain 또는 버린 문서면 null
 */
function parseExplainText(input: { rel: string; raw: string; blobSha: string | null }): ExplainDoc | null {
  let parsed: { data: unknown; body: string };
  try {
    parsed = parseFrontmatter(input.raw);
  } catch (_e) {
    // 깨진 frontmatter는 이 파일만 증거가 아니다. 다른 Explain을 지우지 않는다.
    return null;
  }
  const data = parsed.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const bouncer = (data as Record<string, unknown>).bouncer;
  if (!bouncer || typeof bouncer !== 'object' || Array.isArray(bouncer)) return null;
  const rec = bouncer as Record<string, unknown>;
  const epicId = String(rec.epic_id || '');
  const bpId = String(rec.blueprint_id || '');
  // 번호 쌍이거나 slug 쌍일 때만 증거다. 형식이 섞이거나 어느 쪽도 아니면 이 파일은 버린다.
  const keys = parsePointerKey(`${epicId}/${bpId}`);
  if (!keys) return null;
  const rel = input.rel;
  const rows = parseTaskCommitRows(rec.task_commits, epicId, bpId, keys.format);
  const explainSections = parseExplainSections(parsed.body);
  const sections: SelectedSection[] = [];
  pushSection(sections, 'Background', stripExcludedHeadings(explainSections.background));
  pushSection(sections, 'Intuition', stripExcludedHeadings(explainSections.intuition));
  pushSection(sections, 'Code', stripExcludedHeadings(explainSections.code));
  return {
    rel,
    epicId,
    bpId,
    intentId: formatStableIntentId(keys),
    body: parsed.body,
    rows,
    sections,
    blob_sha: input.blobSha,
  };
}

/**
 * 새 `{ task, sha, intent_anchor }`를 먼저 읽고, 키가 없으면 legacy `{ id, sha }`만
 * 받는다. 깨진 새 행을 legacy id로 구하지 않는다.
 *
 * @param {unknown} value - task_commits
 * @param {string} epicId - Explain 부모 epic
 * @param {string} bpId - Explain 부모 blueprint
 * @param {'numeric' | 'slug'} format - 부모 key 형식(legacy `{id}` 행의 task ID 조립에 쓴다)
 * @returns {ExplainRow[]} 검증된 행
 */
function parseTaskCommitRows(
  value: unknown,
  epicId: string,
  bpId: string,
  format: 'numeric' | 'slug',
): ExplainRow[] {
  if (!Array.isArray(value)) return [];
  const rows: ExplainRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const looksNew = Object.prototype.hasOwnProperty.call(record, 'task')
      || Object.prototype.hasOwnProperty.call(record, 'intent_anchor');
    if (looksNew) {
      const parsed = parseNewRow(record, epicId, bpId);
      if (parsed) rows.push(parsed);
      continue;
    }
    const id = String(record.id || '');
    if (!TASK_DIR_RE.test(id)) continue;
    const sha8 = normalizeCommitSha(record.sha);
    if (!sha8) continue;
    rows.push({ task: formatStableTaskId({ format, epicKey: epicId, blueprintKey: bpId, task: id }), sha8 });
  }
  return rows;
}

function parseNewRow(
  row: Record<string, unknown>,
  epicId: string,
  bpId: string,
): ExplainRow | null {
  const sha8 = normalizeCommitSha(row.sha);
  if (!sha8) return null;
  const anchor = INTENT_ANCHOR_RE.exec(String(row.intent_anchor || ''));
  if (!anchor) return null;
  let expected: { task: string };
  try {
    expected = buildStableProvenance({
      epicId,
      blueprintId: bpId,
      taskId: `TASKS-${anchor[1]}`,
    });
  } catch (_e) {
    return null;
  }
  if (String(row.task || '') !== expected.task) return null;
  return { task: expected.task, sha8 };
}

function pushSection(sections: SelectedSection[], name: string, body: string | null | undefined): void {
  if (typeof body !== 'string') return;
  const trimmed = body.trim();
  if (!trimmed) return;
  sections.push({ name, body: trimmed });
}

/**
 * parseExplainSections가 모르는 `## Checklist` 같은 제목은 직전 절에 흡수된다.
 * 허용 절을 고른 뒤에도 verification·review·Quiz·Checklist가 본문에 남지 않게 자른다.
 *
 * @param {string | null | undefined} body - 한 절의 원문
 * @returns {string | null} 제외 제목 앞까지만
 */
function stripExcludedHeadings(body: string | null | undefined): string | null {
  if (typeof body !== 'string') return null;
  const lines = body.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    if (/^##\s+(Quiz|Checklist|이해\s*상태|verification|review)\b/i.test(line.trim())) break;
    kept.push(line);
  }
  return kept.join('\n');
}

function taskDigitsOf(task: string): string | null {
  return parseStableId(task)?.task ?? null;
}

/**
 * Background·Intuition·Code와 해당 Task의 장기 설계 절만 고른다.
 * Quiz·Checklist·Do not touch·verification·review는 입력 예산에 넣지 않는다.
 *
 * @param {ExplainDoc} doc - 이미 읽은 Explain
 * @param {string | null} taskDigits - TASK-NNN의 숫자
 * @returns {SelectedSection[]} 허용된 절
 */
function selectSections(doc: ExplainDoc, taskDigits: string | null): SelectedSection[] {
  const selected = [...doc.sections];
  if (!taskDigits) return selected;
  return selected.concat(parseTaskDesign(doc.body, taskDigits));
}

/**
 * selectSections와 같은 allowlist로 절을 고른 뒤 각 절 본문의 SHA-256을 만든다.
 * 공개 resolver JSON은 이름 목록과 예산 본문만 노출하므로, bundle fast path가
 * 같은 절을 재해시할 수 있게 별도 projection으로 둔다 — allowlist가 갈라지면
 * stale hit가 생긴다.
 *
 * @param {SelectedSection[]} sections - selectSections 결과
 * @returns {SectionHash[]} 이름 순서 유지, hash는 lowercase 64자리 hex
 */
function projectSectionHashes(sections: SelectedSection[]): SectionHash[] {
  return sections.map((part) => ({
    name: part.name,
    hash: createHash('sha256').update(part.body, 'utf8').digest('hex'),
  }));
}

/**
 * hash·본문 projection이 같은 canonical 경로·symlink 경계를 쓰게 한다.
 * 검사가 갈라지면 bundle drift 판정과 역할 본문이 다른 파일을 보게 된다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.explainRel - repo-relative Explain 경로
 * @returns {ExplainDoc | null} 검증된 Explain 또는 거절 시 null
 */
function loadCanonicalExplainDoc(input: {
  repoRoot: string;
  explainRel: string;
}): ExplainDoc | null {
  if (typeof input.explainRel !== 'string' || input.explainRel.length === 0) return null;
  const explainRel = toPosix(input.explainRel);
  // cache body가 지시하는 경로는 live walkExplain과 같은 canonical만 연다.
  if (path.isAbsolute(explainRel) || explainRel.includes('..')) return null;
  if (!isCanonicalExplainPath(explainRel)) return null;
  let repoReal: string;
  try {
    repoReal = fs.realpathSync(input.repoRoot);
  } catch (error) {
    if (isSkippableFsError(error)) return null;
    throw error;
  }
  const abs = path.resolve(repoReal, explainRel);
  let real: string;
  try {
    real = fs.realpathSync(abs);
  } catch (error) {
    // 부재·권한·루프는 hit 검증 실패로만 접는다. 다른 I/O는 위장하지 않는다.
    if (isSkippableFsError(error)) return null;
    throw error;
  }
  if (!isInsideRepo(real, repoReal)) return null;
  return parseExplainDoc(abs, repoReal);
}

/**
 * 저장소 안 canonical Explain 실경로만 읽어 selectSections → projectSectionHashes를 적용한다.
 * cache가 임의 상대경로를 읽기 대상으로 넘기면 allowlist에서 거절하고, symlink가
 * 루트 밖으로 나가거나 파일이 없으면 null — cache hit로 승격하지 않는다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.explainRel - repo-relative Explain 경로
 * @param {string} input.task - `EPIC-ddd/BP-ddd/TASK-ddd` stable Task ID
 * @returns {SectionHash[] | null} 절 hash 목록 또는 검증 실패 시 null
 */
function projectExplainSectionHashes(input: {
  repoRoot: string;
  explainRel: string;
  task: string;
}): SectionHash[] | null {
  const doc = loadCanonicalExplainDoc(input);
  if (!doc) return null;
  return projectSectionHashes(selectSections(doc, taskDigitsOf(input.task)));
}

/**
 * projectExplainSectionHashes와 같은 경로 검사·selectSections allowlist로 절 본문을 돌려준다.
 * hash와 본문이 다른 파일을 읽으면 drift 대조가 의미를 잃는다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.explainRel - repo-relative Explain 경로
 * @param {string} input.task - `EPIC-ddd/BP-ddd/TASK-ddd` stable Task ID
 * @returns {SelectedSection[] | null} 허용된 절 본문 또는 검증 실패 시 null
 */
function projectExplainSectionBodies(input: {
  repoRoot: string;
  explainRel: string;
  task: string;
}): SelectedSection[] | null {
  const doc = loadCanonicalExplainDoc(input);
  if (!doc) return null;
  return selectSections(doc, taskDigitsOf(input.task));
}

/**
 * Explain 본문에서 해당 Task의 장기 설계 절만 덧붙인다.
 * finalize `buildTaskContext`와 같은 allowlist·순서를 유지해 Plan 입력이
 * 보존 계약과 갈라지지 않게 한다. Do not touch·Checklist는 같은 ### 아래
 * 있어도 고르지 않는다.
 *
 * @param {string} body - frontmatter를 벗긴 Explain 본문
 * @param {string} taskDigits - `001`
 * @returns {SelectedSection[]} 값이 있는 장기 절만
 */
function parseTaskDesign(body: string, taskDigits: string): SelectedSection[] {
  const explainSections = parseExplainSections(body);
  const tasks = explainSections.tasks;
  if (typeof tasks !== 'string' || !tasks.trim()) return [];
  const chunks = splitTaskChunks(tasks);
  const chunk = chunks.get(taskDigits);
  if (!chunk) return [];
  const parts = splitSubheadings(chunk);
  const selected: SelectedSection[] = [];
  pushSection(selected, 'Goal & intent', parts.get('goal'));
  pushSection(selected, 'Current behavior', parts.get('currentBehavior'));
  pushSection(selected, 'Target behavior', parts.get('targetBehavior'));
  pushSection(selected, 'Interface', parts.get('interface'));
  pushSection(selected, 'Touch', parts.get('touch'));
  pushSection(selected, 'Constraints', parts.get('constraints'));
  return selected;
}

/**
 * Explain `## Tasks` 본문을 task 번호 → 절 본문 맵으로 나눈다.
 * 새 제목(`### EPIC-ddd/BP-ddd/TASK-ddd · \`sha8\`` 또는 `### <epic>/<bp>/ddd · \`sha8\``)과 기존 `### Task NNN`을
 * 같은 NNN 키로 묶는다. 세 자리가 아니거나 SHA가 대문자·비-8자리면 인식하지
 * 않는다 — 잘못된 제목을 추측해 올리면 다른 task 절이 섞인다.
 *
 * @param {string} tasksBody - `## Tasks` 아래 본문
 * @returns {Map<string, string>} 키는 `001` 형태
 */
function splitTaskChunks(tasksBody: string): Map<string, string> {
  const lines = tasksBody.split('\n');
  const starts: Array<{ id: string; line: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    const legacy = /^###\s+Task\s+(\d{3})\s*$/i.exec(trimmed);
    if (legacy) {
      starts.push({ id: legacy[1], line: i });
      continue;
    }
    // SHA는 소문자 8자리만. 대문자·짧은 hex는 Interface 거절 계약과 같다.
    // 번호(`EPIC-…/TASK-NNN`)와 slug(`<epic>/<bp>/NNN`) 제목을 같은 파서로 읽는다.
    const stable = /^###\s+(\S+)(?:\s+·\s+`[0-9a-f]{8}`)?\s*$/.exec(trimmed);
    const stableTask = stable ? parseStableId(stable[1])?.task : null;
    if (stableTask) starts.push({ id: stableTask, line: i });
  }
  const out = new Map<string, string>();
  for (let i = 0; i < starts.length; i += 1) {
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    out.set(starts[i].id, lines.slice(starts[i].line + 1, end).join('\n'));
  }
  return out;
}

function splitSubheadings(chunk: string): Map<string, string> {
  const lines = chunk.split('\n');
  const starts: Array<{ key: string; line: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    // Touch는 제목 전체 일치(`^####\s+Touch\s*$`)로만 맞춘다. Do not touch를
    // Touch로 승격하면 실행용 범위 통제가 Plan 입력에 장기 금지로 남는다.
    if (/^####\s+Goal\s*&\s*intent\s*$/i.test(line)) starts.push({ key: 'goal', line: i });
    else if (/^####\s+Current\s+behavior\s*$/i.test(line)) {
      starts.push({ key: 'currentBehavior', line: i });
    } else if (/^####\s+Target\s+behavior\s*$/i.test(line)) {
      starts.push({ key: 'targetBehavior', line: i });
    } else if (/^####\s+Interface\s*$/i.test(line)) starts.push({ key: 'interface', line: i });
    else if (/^####\s+Touch\s*$/i.test(line)) starts.push({ key: 'touch', line: i });
    else if (/^####\s+Constraints\s*$/i.test(line)) starts.push({ key: 'constraints', line: i });
    else if (/^####\s+/.test(line)) starts.push({ key: 'other', line: i });
  }
  const out = new Map<string, string>();
  for (let i = 0; i < starts.length; i += 1) {
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    const key = starts[i].key;
    if (key === 'other') continue;
    out.set(key, lines.slice(starts[i].line + 1, end).join('\n'));
  }
  return out;
}

function serializeSections(sections: SelectedSection[]): string {
  return sections
    .map((item) => `## ${item.name}\n\n${item.body}`)
    .join('\n\n');
}

/**
 * 허용된 절의 UTF-8 합계가 2,000 byte를 넘기기 전에 자른다.
 * historical 본문은 이미 비어 있어 예산에 넣지 않는다.
 *
 * @param {Array<{ body: string, freshness: Freshness, sections: string[] }>} candidates - 정렬·limit 이후
 * @returns {boolean} 잘렸으면 true
 */
function applyBodyBudget(
  candidates: Array<{ body: string; freshness: Freshness; sections: string[] }>,
): boolean {
  let used = 0;
  let truncated = false;
  for (const item of candidates) {
    if (item.freshness === 'historical' || item.body.length === 0) continue;
    const remaining = BODY_BUDGET_BYTES - used;
    if (remaining <= 0) {
      item.body = '';
      truncated = true;
      continue;
    }
    const bytes = Buffer.byteLength(item.body, 'utf8');
    if (bytes <= remaining) {
      used += bytes;
      continue;
    }
    item.body = clipUtf8(item.body, remaining);
    used = BODY_BUDGET_BYTES;
    truncated = true;
  }
  return truncated;
}

function clipUtf8(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, 'utf8');
  if (buf.length <= maxBytes) return text;
  let end = maxBytes;
  // 연속 바이트 한가운데를 자르면 깨진 한글이 본문으로 나간다.
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return buf.subarray(0, end).toString('utf8');
}

function isInsideRepo(absPath: string, repoReal: string): boolean {
  if (absPath === repoReal) return true;
  const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
  return absPath.startsWith(prefix);
}

/**
 * 두 조회가 공유하는 연결·정렬 핵심이다. 커밋마다 trailer를 먼저 보고, trailer가 없을 때만 Explain SHA 역색인으로
 * task를 찾는다. 연결된 커밋에 freshness를 매기고 기존 순서(freshness 순위, 커밋 시각 내림차순, 커밋 SHA,
 * Explain 경로)로 세운다. 본문 예산과 limit은 호출자가 맡는다. total_linked를 세야 해서 전부 돌려준다.
 *
 * @param {object} input - 연결 입력
 * @param {GitRun} input.run - 이 조회의 Git 실행기. 작업 트리 또는 고정 SHA
 * @param {CommitMeta[]} input.metas - 함수 이력 후보 커밋
 * @param {Registry} input.registry - 등록부. 없거나 깨졌으면 null이라 원래 문자열끼리 비교한다
 * @param {ExplainDoc[]} input.explains - 파싱에 성공한 Explain
 * @param {(sha8: string) => ShaExpand} input.expand - 짧은 SHA 펼침 방식
 * @returns {RankedLink[]} 정렬된 연결. 없으면 빈 배열이다
 */
function linkAndRank(input: {
  run: GitRun;
  metas: CommitMeta[];
  registry: Registry;
  explains: ExplainDoc[];
  expand: (sha8: string) => ShaExpand;
}): RankedLink[] {
  const shaIndex = buildShaIndex(input.explains, input.expand);
  const linked: LinkedDraft[] = [];
  for (const meta of input.metas) {
    const hit = linkCommit(input.run, meta.sha, input.explains, shaIndex, input.registry);
    if (!hit) continue;
    const doc = input.explains.find((item) => item.rel === hit.explain);
    const taskDigits = taskDigitsOf(hit.task);
    linked.push({
      ...meta,
      task: hit.task,
      explain: hit.explain,
      sections: doc ? selectSections(doc, taskDigits) : [],
      explain_blob_sha: doc ? doc.blob_sha : null,
    });
  }
  if (linked.length === 0) return [];

  const currentSha = pickCurrentSha(input.metas);
  const ranked: RankedLink[] = linked.map((item) => {
    const freshness = freshnessOf(item, linked, currentSha);
    return {
      relation: item.relation,
      commit: item.sha,
      task: item.task,
      explain: item.explain,
      explain_blob_sha: item.explain_blob_sha,
      freshness,
      // historical 연결은 현재 동작의 근거로 쓰지 않도록 절을 비운다.
      parts: freshness === 'historical' ? [] : item.sections,
      ct: item.ct,
    };
  });

  ranked.sort((left, right) => {
    const rank = FRESHNESS_RANK[left.freshness] - FRESHNESS_RANK[right.freshness];
    if (rank !== 0) return rank;
    if (right.ct !== left.ct) return right.ct - left.ct;
    if (left.commit !== right.commit) return left.commit < right.commit ? -1 : 1;
    return left.explain < right.explain ? -1 : 1;
  });
  return ranked;
}

/**
 * historyRef 하나의 Git 이력과 트리로 provenance를 만든다. 작업 트리·HEAD·인덱스는 읽지 않으므로 같은 입력은
 * 같은 canonical JSON과 digest를 낸다. 리뷰 중인 작업 트리 변경이 근거를 바꾸지 못하게 하는 것이 목적이다.
 *
 * symbolRef는 historyRef 트리의 정의와 정확히 맞아야 한다. 이름이 같은 다른 파일의 정의로 대체하지 않는다.
 * 연결 없음, Explain 없음, registry 없음은 throw가 아니라 상태 값으로 돌려준다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트. Git 객체 DB만 읽는다
 * @param {string} input.historyRef - 7~40자 hex 커밋 참조. 확정된 40자 SHA로 고정된다
 * @param {SymbolRef} input.symbolRef - historyRef 시점의 정의 좌표와 blob SHA
 * @param {number} [input.limit] - 반환 후보 수. 생략 시 3, 허용 1..5. total_linked는 limit 적용 전이다
 * @returns {IntentAtRevisionResult} 상태(resolved·unlinked), Explain 수, registry blob SHA, 후보, digest
 * @throws {Error} historyRef·limit·symbolRef 형태가 틀리거나, 정의 신원이 맞지 않거나, Git이 실패하거나
 *   출력이 상한을 넘으면 던진다. 메시지는 비어 있지 않다
 */
function resolveIntentAtRevision(input: IntentAtRevisionInput): IntentAtRevisionResult {
  // 1. limit와 symbolRef 형태는 Git을 띄우기 전에 거절한다. 잘못된 입력이 Git 호출을 만들지 않게 한다.
  const limit = requireLimit(input.limit);
  const symbolRef = requireSymbolRefShape(input.symbolRef);
  // 2. historyRef를 40자 SHA로 확정한다. 이 뒤의 모든 읽기는 확정된 SHA만 쓴다.
  const sha = resolveHistoryRef({ repoRoot: input.repoRoot, ref: input.historyRef });
  // 3. 정의 신원이 이 SHA에서 맞지 않으면 이력을 읽지 않는다. 같은 이름의 다른 정의로 대체하지 않는다.
  requireSymbolIdentityAt({ repoRoot: input.repoRoot, sha, symbolRef });

  const run: GitRun = (args) => runGit(input.repoRoot, args, { maxBuffer: PINNED_GIT_MAX_BUFFER });
  // 4. 이력·registry·Explain을 모두 같은 SHA에서 읽는다. 작업 트리와 HEAD는 여기서 읽지 않는다.
  const metas = collectCommitMetas(run, symbolRef, symbolRef.qualified_name, sha);
  const registryRead = readRegistryAt({ repoRoot: input.repoRoot, ref: sha });
  // 깨진 registry는 던지지 않고 invalid로 온다. 연결에는 registry가 없는 것처럼 null을 쓰되, registry_blob_sha는
  // 그 blob SHA를 그대로 보고한다. 그래야 "없음(null)"과 "있으나 깨짐(SHA)"이 구분된다.
  const registry = registryRead.status === 'ok' && registryRead.registry.ok ? registryRead.registry.registry : null;
  const explains: ExplainDoc[] = [];
  for (const source of listExplainSourcesAt({ repoRoot: input.repoRoot, ref: sha })) {
    // 작업 트리 walker와 같은 제외 규칙을 쓴다. 같은 트리라면 두 경로가 같은 Explain 집합을 본다.
    if (source.rel.split('/').some((segment) => SKIP_DIR_NAMES.has(segment))) continue;
    const doc = parseExplainText({ rel: source.rel, raw: source.text, blobSha: source.blob_sha });
    // 파싱에 실패해 버려진 문서는 explain_docs에도 세지 않는다. Explain 부재와 연결 부재를 구분하는 기준이다.
    if (doc) explains.push(doc);
  }

  // 5. 짧은 SHA는 historyRef에서 도달 가능한 커밋 안에서만 펼친다. 객체 DB 전체로 펼치면 historyRef 밖의 객체가
  // 모호성을 만들어 같은 입력의 결과가 저장소 상태에 따라 달라진다.
  const reachable = revListShas(run, sha);
  const ranked = linkAndRank({
    run,
    metas,
    registry,
    explains,
    expand: (sha8) => expandShaAmong(reachable, sha8),
  });

  // 6. limit은 출력 후보만 자른다. total_linked는 자르기 전 연결 수다.
  const candidates: IntentAtRevisionCandidate[] = ranked.slice(0, limit).map((item) => ({
    relation: item.relation,
    commit: item.commit,
    task: item.task,
    explain: item.explain,
    explain_blob_sha: requireBlobSha(item.explain_blob_sha),
    freshness: item.freshness,
    sections: item.parts.map((part) => ({ name: part.name, body: part.body })),
  }));
  const body: Omit<IntentAtRevisionResult, 'digest'> = {
    schema_version: 1,
    projection_version: INTENT_AT_REVISION_PROJECTION,
    history_ref: sha,
    symbol_ref: symbolRef,
    status: ranked.length > 0 ? 'resolved' : 'unlinked',
    explain_docs: explains.length,
    registry_blob_sha: registryRead.blob_sha,
    total_linked: ranked.length,
    candidates,
  };
  // 7. digest는 digest를 뺀 객체의 canonical JSON 해시다. 키 순서에 흔들리지 않는다.
  return { ...body, digest: sha256Canonical(body) };
}

/**
 * 고정 SHA 조회의 Explain은 항상 blob SHA를 가진다. null이 오면 구현 불변식이 깨진 것이므로 던진다.
 *
 * @param {string | null} value - Explain blob SHA
 * @returns {string} 확인된 blob SHA
 * @throws {Error} null이면 내부 불변식 위반이다
 */
function requireBlobSha(value: string | null): string {
  if (value === null) throw new Error('explain blob sha is missing for a pinned candidate');
  return value;
}

/**
 * 고정 SHA의 `task_commits` 짧은 SHA를 historyRef 도달 커밋 목록 안에서 펼친다. 파일 시스템을 읽지 않는 순수 함수다.
 * 접두사가 같은 커밋이 둘 이상이면 하나를 고르지 않고 ambiguous다. 목록 밖 객체는 모호성에 넣지 않는다.
 *
 * @param {string[]} commits - 40자 소문자 hex 커밋 목록
 * @param {string} sha8 - 8자 소문자 hex 접두사
 * @returns {ShaExpand} 하나면 unique(40자), 둘 이상이면 ambiguous, 없으면 missing.
 *   입력이 위 형식이 아니면 missing이다
 */
function expandShaAmong(commits: string[], sha8: string): ShaExpand {
  if (typeof sha8 !== 'string' || !SHORT_SHA_RE.test(sha8)) return { status: 'missing' };
  if (!Array.isArray(commits) || !commits.every((item) => typeof item === 'string' && FULL_SHA_RE.test(item))) {
    return { status: 'missing' };
  }
  const matches = commits.filter((item) => item.startsWith(sha8));
  if (matches.length === 0) return { status: 'missing' };
  if (matches.length > 1) return { status: 'ambiguous' };
  return { status: 'unique', full: matches[0] };
}

/**
 * historyRef에서 도달 가능한 커밋 SHA를 한 번 읽는다. 고정 SHA 조회에서 짧은 SHA를 펼치는 유일한 근거다.
 *
 * @param {GitRun} run - 고정 SHA Git 실행기
 * @param {string} sha - 확정된 40자 SHA
 * @returns {string[]} 도달 가능한 커밋 목록
 * @throws {Error} git rev-list가 실패하거나 출력이 상한을 넘으면
 */
function revListShas(run: GitRun, sha: string): string[] {
  const result = run(['rev-list', sha]);
  if (result.status !== 0) throw gitFailure('git rev-list failed', result);
  return result.stdout.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

/**
 * 호출 전에 symbolRef 형태를 검사하고 허용된 여섯 필드만 복사한다. 형태 오류는 `invalid symbolRef:`로 거절한다.
 * path 규칙은 intent-revision의 assertRepoPath와 같다. 그 함수는 export되지 않아 같은 규칙을 여기 둔다.
 * 두 벌이 갈라지면 형태 오류가 Git 단계까지 밀려 메시지 접두사가 달라진다.
 *
 * @param {unknown} value - 호출자가 넘긴 symbolRef
 * @returns {SymbolRef} 검증된 좌표의 복사본
 * @throws {Error} 형태가 틀리면 `invalid symbolRef: <사유>`
 */
function requireSymbolRefShape(value: unknown): SymbolRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidSymbolRef('must be an object');
  const record = value as Record<string, unknown>;
  if (!isRepoRelativePath(record.path)) invalidSymbolRef('path must be a repo-relative path');
  if (typeof record.qualified_name !== 'string' || record.qualified_name === '') {
    invalidSymbolRef('qualified_name must be a non-empty string');
  }
  if (typeof record.kind !== 'string' || record.kind === '') invalidSymbolRef('kind must be a non-empty string');
  if (typeof record.blob_sha !== 'string' || !FULL_SHA_RE.test(record.blob_sha)) {
    invalidSymbolRef('blob_sha must be 40 lowercase hex characters');
  }
  const start = record.start_line;
  const end = record.end_line;
  if (!isLineNumber(start) || !isLineNumber(end) || start > end) {
    invalidSymbolRef('start_line and end_line must be integers with 1 <= start_line <= end_line');
  }
  return {
    path: record.path,
    qualified_name: record.qualified_name,
    kind: record.kind,
    start_line: start,
    end_line: end,
    blob_sha: record.blob_sha,
  };
}

function invalidSymbolRef(reason: string): never {
  throw new Error(`invalid symbolRef: ${reason}`);
}

/**
 * 저장소 상대 경로 형태인지 본다. 절대 경로·역슬래시·빈 세그먼트·`.`·`..`는 같은 파일을 여러 이름으로 가리키므로 거절한다.
 *
 * @param {unknown} value - 검사할 값
 * @returns {boolean} 형태가 맞으면 true
 */
function isRepoRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  if (value.startsWith('/') || value.includes('\\')) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function isLineNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/**
 * historyRef 트리에서 symbolRef가 가리키는 정의가 정확히 같은지 확인한다. 경로가 파싱된 파일이고 blob SHA가 같으며
 * (qualified_name, kind, start_line, end_line)이 모두 같은 정의가 있어야 통과한다. 통과하기 전에는 이력을 읽지 않는다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.sha - 확정된 40자 SHA
 * @param {SymbolRef} input.symbolRef - 형태가 검증된 좌표
 * @returns {void}
 * @throws {Error} 경로가 파싱된 파일이 아니거나 blob SHA·정의가 다르면 `symbolRef does not match ...`
 */
function requireSymbolIdentityAt(input: { repoRoot: string; sha: string; symbolRef: SymbolRef }): void {
  const { symbolRef } = input;
  const mismatch = (): Error => new Error(
    `symbolRef does not match the definitions at ${input.sha}: ${symbolRef.path} ${symbolRef.qualified_name}`,
  );
  const file = listDefinitionsAtRevision({ repoRoot: input.repoRoot, ref: input.sha, path: symbolRef.path });
  // 1. 부재·symlink·submodule·파싱 실패는 정의가 없다는 뜻이다. 다른 상태로 나눠도 신원은 맞지 않는다.
  if (file.status !== 'parsed') throw mismatch();
  // 2. 같은 경로라도 blob이 다르면 다른 본문이다.
  if (file.blob_sha !== symbolRef.blob_sha) throw mismatch();
  // 3. 좌표 네 개가 모두 같은 정의만 인정한다. 같은 이름이 다른 줄에 있으면 그 줄은 다른 정의다.
  const found = file.definitions.some((item) => item.qualified_name === symbolRef.qualified_name
    && item.kind === symbolRef.kind
    && item.start_line === symbolRef.start_line
    && item.end_line === symbolRef.end_line);
  if (!found) throw mismatch();
}

export = {
  isCanonicalExplainPath,
  resolveIntentProvenance,
  resolveIntentAtRevision,
  expandShaAmong,
  projectSectionHashes,
  projectExplainSectionHashes,
  projectExplainSectionBodies,
  splitTaskChunks,
};
