'use strict';

// 고정 SHA 하나의 Git 트리만 읽는 경계다. 작업 트리·HEAD·인덱스는 읽지 않으므로 같은 SHA는
// 언제나 같은 답을 낸다. 리뷰 중인 작업 트리 변경이 정의나 Explain 근거를 바꾸지 못하게 하는 것이 목적이다.
// 이 모듈은 아직 어떤 모듈에도 연결되지 않는다. 다음 task에서 intent-provenance가 소비한다.

import symbolIndex = require('./symbol-index');
import epicRegistry = require('./epic-registry');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

type FileDefinitions = ReturnType<typeof symbolIndex.listDefinitionsInText>;
type ParseResult = ReturnType<typeof epicRegistry.parseEpicRegistry>;
type GitResult = { status: number; stdout: Buffer; stderr: string };
type LsTreeEntry = { mode: string; type: string; oid: string; name: string };
type RevisionInput = { repoRoot: string; ref: string; maxBuffer?: number };

// Git 한 호출의 stdout 상한(256 MiB). 생략 시의 기본값이다. 넘기면 잘린 결과 대신 throw한다.
const GIT_MAX_BUFFER = 268435456;
// 7~40자 소문자 hex만 SHA 후보로 본다. HEAD·브랜치명·`-`로 시작하는 값은 Git이 다른 뜻으로 풀 수 있다.
const HISTORY_REF_RE = /^[0-9a-f]{7,40}$/;
const FULL_SHA_RE = /^[0-9a-f]{40}$/;
// 상위 프로세스가 물려준 이 변수들이 다른 저장소나 객체 DB를 가리키면 결과가 엉뚱한 곳에서 나온다.
const CLEARED_GIT_ENV = [
  'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_NAMESPACE',
];
// Explain은 일반 파일만 본다. symlink(120000)와 gitlink(160000)는 본문이 아니므로 제외한다.
const EXPLAIN_MODES = new Set(['100644', '100755']);
const EXPLAIN_BASENAME = 'explain.md';
const EXPLAIN_ROOT = '.bouncer/context';

/**
 * 모든 Git 호출이 지나는 유일한 spawnSync 지점이다. 출력은 Buffer로 받아 blob 바이트가
 * 디코딩으로 바뀌지 않게 하고, 상한을 넘으면 잘린 출력 대신 오류를 낸다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} args - `git` 다음 argv. 항상 `--no-optional-locks --literal-pathspecs`를 앞에 붙인다
 * @param {number} maxBuffer - stdout 상한(바이트)
 * @param {Buffer} [input] - stdin 본문
 * @returns {GitResult} status(비0도 throw하지 않는다), stdout Buffer, stderr 문자열
 * @throws {Error} 출력이 maxBuffer를 넘으면 `git output exceeds <maxBuffer> bytes`,
 *   실행 자체가 안 되면 `git command is not executable`
 */
function spawnGit(repoRoot: string, args: string[], maxBuffer: number, input?: Buffer): GitResult {
  // 1. 환경을 고정한다. 필터·replace·대체 객체 DB가 읽기 결과에 새지 않도록 plumbing 명령과 함께 쓴다.
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of CLEARED_GIT_ENV) delete env[key];
  const result = spawnSync('git', ['--no-optional-locks', '--literal-pathspecs', ...args], {
    cwd: repoRoot,
    env: {
      ...env,
      GIT_NO_REPLACE_OBJECTS: '1',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
      LC_ALL: 'C',
    },
    input,
    maxBuffer,
  });
  // 2. 오류를 구분한다. ENOBUFS는 출력이 상한을 넘었다는 뜻이고, 그 밖의 오류는 git을 띄우지 못한 것이다.
  // 둘을 섞으면 설치 문제가 출력 크기 문제로 보이므로 메시지를 나눈다.
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOBUFS') {
      throw new Error(`git output exceeds ${maxBuffer} bytes`);
    }
    throw new Error('git command is not executable', { cause: result.error });
  }
  return {
    // 신호로 죽어 status가 null이면 성공으로 보지 않도록 1로 접는다.
    status: typeof result.status === 'number' ? result.status : 1,
    stdout: result.stdout,
    stderr: result.stderr.toString('utf8'),
  };
}

/**
 * 비0 종료를 오류로 바꾸는 Git 호출이다. 호출자가 종료 코드를 따로 다룰 필요가 없는 읽기 경로에 쓴다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} args - `git` 다음 argv
 * @param {number} maxBuffer - stdout 상한(바이트)
 * @param {Buffer} [input] - stdin 본문
 * @returns {Buffer} 성공 종료한 호출의 stdout
 * @throws {Error} 비0 종료면 `git <subcommand> failed (exit <n>): <stderr>`
 */
function gitOk(repoRoot: string, args: string[], maxBuffer: number, input?: Buffer): Buffer {
  const result = spawnGit(repoRoot, args, maxBuffer, input);
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed (exit ${result.status}): ${result.stderr.trim()}`);
  }
  return result.stdout;
}

/**
 * maxBuffer 입력을 정규화한다. 생략하면 기본 상한을 쓰고, 0 이하나 정수가 아니면 거절한다.
 * 잘못된 상한은 Git 호출 자체를 망가뜨리므로 호출 전에 막는다.
 *
 * @param {unknown} value - 호출자가 넘긴 maxBuffer
 * @returns {number} 검증된 바이트 상한
 * @throws {Error} 양의 안전 정수가 아니면
 */
function normalizeMaxBuffer(value: unknown): number {
  if (value === undefined) return GIT_MAX_BUFFER;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('maxBuffer must be a positive integer byte count');
  }
  return value;
}

/**
 * 저장소 상대 경로인지 확인한다. 절대 경로·역슬래시·빈 세그먼트·`.`·`..`는 같은 파일을 여러 이름으로
 * 가리키거나 저장소 밖을 가리키므로 Git에 넘기기 전에 거절한다.
 *
 * @param {string} p - 검사할 경로
 * @returns {void}
 * @throws {Error} 형식이 맞지 않으면 사유를 담은 Error
 */
function assertRepoPath(p: string): void {
  if (typeof p !== 'string' || p === '') throw new Error('path must be a non-empty repo-relative path');
  if (p.startsWith('/')) throw new Error(`path must be repo-relative, not absolute: ${p}`);
  if (p.includes('\\')) throw new Error(`path must use "/" separators: ${p}`);
  for (const segment of p.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') {
      throw new Error(`path has an invalid segment: ${p}`);
    }
  }
}

/**
 * 같은 문자열이 함께 존재할 때 Git이 SHA보다 먼저 풀 수 있는 ref 이름 후보 목록이다.
 * 하나라도 있으면 그 ref가 가리키는 커밋이 읽히므로, 이 목록은 거절 근거가 된다.
 *
 * @param {string} ref - 검사할 문자열
 * @returns {string[]} 존재 여부를 확인할 전체 ref 이름들
 */
function refNameCandidates(ref: string): string[] {
  return [`refs/${ref}`, `refs/tags/${ref}`, `refs/heads/${ref}`, `refs/remotes/${ref}`, `refs/remotes/${ref}/HEAD`];
}

/**
 * ref를 40자 커밋 SHA로 확정한다. 모든 읽기 함수가 이 확정을 먼저 거치므로, 같은 입력은 항상 같은
 * 커밋을 가리킨다. 짧은 SHA라도 같은 문자열의 ref 이름이 있으면 거절한다.
 *
 * @param {{ repoRoot: string, ref: string, maxBuffer?: number }} input - 저장소 루트, ref, 출력 상한
 * @returns {string} 40자 소문자 hex 커밋 SHA
 * @throws {Error} 형식이 틀리거나, 커밋으로 유일하게 풀리지 않거나, ref 이름과 겹치면 던진다
 */
function resolveHistoryRef(input: RevisionInput): string {
  const maxBuffer = normalizeMaxBuffer(input.maxBuffer);
  const ref = input.ref;
  // 1. 형식을 먼저 거른다. 통과하지 못한 값은 Git에 넘기지 않는다. `main~1` 같은 식이 다른 커밋을 가리키기 때문이다.
  if (typeof ref !== 'string' || !HISTORY_REF_RE.test(ref)) {
    throw new Error(`history ref must be 7-40 lowercase hex characters: ${String(ref)}`);
  }
  // 2. ^{commit}으로 태그·트리·블롭을 거절한다. 모호한 짧은 SHA는 실패로 본다. 하나를 고르면
  // 다른 객체의 기록을 읽게 되므로 고르지 않는다.
  const verified = spawnGit(input.repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], maxBuffer);
  const sha = verified.stdout.toString('utf8').trim();
  if (verified.status !== 0 || !FULL_SHA_RE.test(sha)) {
    throw new Error(`history ref does not resolve to a unique commit: ${ref}`);
  }
  // 3. 같은 문자열의 ref 이름이 있으면 거절한다. Git은 ref 이름을 SHA보다 먼저 풀기 때문에,
  // 그대로 두면 이 호출이 본 커밋과 호출자가 기대한 커밋이 달라진다.
  for (const name of refNameCandidates(ref)) {
    const probe = spawnGit(input.repoRoot, ['show-ref', '--verify', '--quiet', name], maxBuffer);
    // show-ref는 ref가 없으면 1로 끝난다. 그 밖의 비0은 저장소 문제이므로 부재로 접지 않고 던진다.
    if (probe.status === 0) throw new Error(`history ref collides with ref name ${name}: ${ref}`);
    if (probe.status !== 1) {
      throw new Error(`git show-ref failed for ${name} (exit ${probe.status}): ${probe.stderr.trim()}`);
    }
  }
  return sha;
}

/**
 * 트리에서 한 경로의 ls-tree 항목을 찾는다. `--full-tree`로 cwd와 무관하게 저장소 루트 기준으로 본다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string} sha - 확정된 40자 커밋 SHA
 * @param {string} rel - 저장소 상대 경로(이미 검증됨)
 * @param {number} maxBuffer - stdout 상한
 * @returns {LsTreeEntry | null} 정확히 같은 이름의 항목. 없으면 null
 */
function lsTreeEntry(repoRoot: string, sha: string, rel: string, maxBuffer: number): LsTreeEntry | null {
  // 디렉터리 경로는 그 항목 자체가 나온다. 접두 일치 항목을 섞지 않도록 이름을 정확히 비교한다.
  const hits = parseLsTree(gitOk(repoRoot, ['ls-tree', '-z', '--full-tree', sha, '--', rel], maxBuffer))
    .filter((entry) => entry.name === rel);
  return hits.length === 0 ? null : hits[0];
}

/**
 * `git ls-tree -z` 출력을 항목 목록으로 바꾼다. 레코드는 `<mode> SP <type> SP <oid> TAB <name> NUL`이다.
 *
 * @param {Buffer} out - ls-tree stdout
 * @returns {LsTreeEntry[]} 출력 순서대로 된 항목 목록
 * @throws {Error} 탭 구분자가 없는 레코드가 있으면
 */
function parseLsTree(out: Buffer): LsTreeEntry[] {
  const entries: LsTreeEntry[] = [];
  for (const record of out.toString('utf8').split('\0')) {
    if (record === '') continue;
    const tab = record.indexOf('\t');
    if (tab < 0) throw new Error('git ls-tree output has no tab separator');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    entries.push({ mode, type, oid, name: record.slice(tab + 1) });
  }
  return entries;
}

/**
 * 확정된 SHA 트리에서 파일 하나를 읽는다. 디렉터리와 gitlink는 읽을 blob이 없으므로 부재로 본다.
 * symlink는 blob이라 그대로 읽는다. 종류 판정은 호출자가 mode로 한다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string} sha - 확정된 40자 커밋 SHA
 * @param {string} rel - 저장소 상대 경로(이미 검증됨)
 * @param {number} maxBuffer - stdout 상한
 * @returns {{ status: 'absent' } | { status: 'present', mode: string, blob_sha: string, bytes: Buffer }}
 *   absent는 경로가 없거나 blob이 아닌 항목이다. present는 blob 바이트와 그 mode·oid다
 */
function readBlobInTree(repoRoot: string, sha: string, rel: string, maxBuffer: number): {
  status: 'absent';
} | { status: 'present'; mode: string; blob_sha: string; bytes: Buffer } {
  const entry = lsTreeEntry(repoRoot, sha, rel, maxBuffer);
  if (entry === null || entry.type !== 'blob') return { status: 'absent' };
  const bytes = gitOk(repoRoot, ['cat-file', 'blob', entry.oid], maxBuffer);
  return { status: 'present', mode: entry.mode, blob_sha: entry.oid, bytes };
}

/**
 * `git cat-file --batch`로 blob 여러 개를 한 프로세스에서 읽는다. 응답은 `<oid> blob <size>\n<bytes>\n`
 * 형식이다. 본문 경계는 헤더의 size로만 정한다. 개행으로 자르면 본문 안의 개행에서 틀어진다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} oids - 요청 순서대로 읽을 blob SHA
 * @param {number} maxBuffer - stdout 상한
 * @returns {Buffer[]} 요청 순서와 같은 본문 목록
 * @throws {Error} 헤더가 blob이 아니거나 응답 oid가 요청과 다르거나 길이가 맞지 않으면 던진다
 */
function readBlobsBatch(repoRoot: string, oids: string[], maxBuffer: number): Buffer[] {
  const stdin = Buffer.from(`${oids.join('\n')}\n`, 'utf8');
  const out = gitOk(repoRoot, ['cat-file', '--batch'], maxBuffer, stdin);
  const bodies: Buffer[] = [];
  let pos = 0;
  for (const oid of oids) {
    // 1. 헤더 한 줄을 읽는다. 누락된 객체는 `<oid> missing`이라 필드 수로 함께 거른다.
    const headerEnd = out.indexOf(0x0a, pos);
    if (headerEnd < 0) throw new Error('git cat-file --batch response is truncated');
    const header = out.toString('latin1', pos, headerEnd).split(' ');
    if (header.length !== 3 || header[0] !== oid || header[1] !== 'blob') {
      throw new Error(`git cat-file --batch returned an unexpected header for ${oid}: ${header.join(' ')}`);
    }
    // 2. 본문 길이는 헤더 값만 믿는다. 본문 끝 뒤에 개행이 와야 경계가 맞은 것이다.
    const size = Number(header[2]);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`git cat-file --batch returned an invalid size for ${oid}: ${header[2]}`);
    }
    const start = headerEnd + 1;
    const end = start + size;
    if (end >= out.length || out[end] !== 0x0a) {
      throw new Error(`git cat-file --batch body length mismatch for ${oid}`);
    }
    bodies.push(out.subarray(start, end));
    pos = end + 1;
  }
  if (pos !== out.length) throw new Error('git cat-file --batch returned extra output');
  return bodies;
}

/**
 * 확정된 SHA 트리에서 파일 하나를 읽는다. 경로를 먼저 검사해 Git에 잘못된 인자가 가지 않게 한다.
 *
 * @param {{ repoRoot: string, ref: string, path: string, maxBuffer?: number }} input - 저장소·ref·경로·상한
 * @returns {{ status: 'absent' } | { status: 'present', mode: string, blob_sha: string, bytes: Buffer }}
 *   absent는 그 SHA에 파일이 없거나 디렉터리·gitlink인 경우다. present는 blob 바이트다
 * @throws {Error} path·ref가 거절되거나 Git 호출이 실패하면 던진다
 */
function readBlobAt(input: { repoRoot: string; ref: string; path: string; maxBuffer?: number }): {
  status: 'absent';
} | { status: 'present'; mode: string; blob_sha: string; bytes: Buffer } {
  const maxBuffer = normalizeMaxBuffer(input.maxBuffer);
  assertRepoPath(input.path);
  const sha = resolveHistoryRef({ repoRoot: input.repoRoot, ref: input.ref, maxBuffer });
  return readBlobInTree(input.repoRoot, sha, input.path, maxBuffer);
}

/**
 * 확정된 SHA 트리의 `.bouncer/context` 아래 `explain.md` 일반 파일 본문을 모두 읽는다.
 * 파일 경로는 작업 트리 walker와 같은 basename 규칙으로 고른다.
 *
 * @param {{ repoRoot: string, ref: string, maxBuffer?: number }} input - 저장소·ref·상한
 * @returns {{ rel: string, blob_sha: string, text: string }[]} rel 오름차순. Explain이 없으면 빈 배열이다.
 *   text는 blob 바이트를 UTF-8로 디코딩한 값이고 잘못된 바이트는 U+FFFD가 된다. blob_sha가 원본 신원이다
 * @throws {Error} ref가 거절되거나 출력이 maxBuffer를 넘으면 던진다. 일부 결과를 돌려주지 않는다
 */
function listExplainSourcesAt(input: RevisionInput): { rel: string; blob_sha: string; text: string }[] {
  const maxBuffer = normalizeMaxBuffer(input.maxBuffer);
  const sha = resolveHistoryRef({ repoRoot: input.repoRoot, ref: input.ref, maxBuffer });
  // 1. 트리 아래 blob 항목만 추린다. -r은 디렉터리 항목을 빼고 파일만 주며, 모드로 심볼릭 링크와 gitlink를 뺀다.
  const found = parseLsTree(gitOk(
    input.repoRoot,
    ['ls-tree', '-r', '-z', '--full-tree', sha, '--', EXPLAIN_ROOT],
    maxBuffer,
  ))
    .filter((entry) => entry.type === 'blob'
      && EXPLAIN_MODES.has(entry.mode)
      && path.posix.basename(entry.name) === EXPLAIN_BASENAME)
    .sort((left, right) => {
      if (left.name === right.name) return 0;
      return left.name < right.name ? -1 : 1;
    });
  if (found.length === 0) return [];
  // 2. 본문은 cat-file --batch로 한 번에 읽는다. 문서마다 프로세스를 띄우지 않으려는 것이다.
  const bodies = readBlobsBatch(input.repoRoot, found.map((entry) => entry.oid), maxBuffer);
  return found.map((entry, i) => ({
    rel: entry.name,
    blob_sha: entry.oid,
    text: bodies[i].toString('utf8'),
  }));
}

/**
 * 확정된 SHA 트리의 `.bouncer/epics.json`을 읽고 registry 스키마로 판정한다. 파일 부재, 손상, 스키마 위반은
 * 서로 다른 상태로 돌려준다. 손상을 부재와 합치면 등록부가 없다는 잘못된 근거가 된다.
 *
 * @param {{ repoRoot: string, ref: string, maxBuffer?: number }} input - 저장소·ref·상한
 * @returns {{ status: 'missing', blob_sha: null }
 *   | { status: 'invalid', blob_sha: string, message: string }
 *   | { status: 'ok', blob_sha: string, registry: ParseResult }}
 *   missing은 파일 없음, invalid는 JSON 손상이나 스키마 위반(던지지 않는다), ok는 판정 통과다
 * @throws {Error} ref가 거절되거나 Git 호출이 실패하면 던진다
 */
function readRegistryAt(input: RevisionInput): {
  status: 'missing';
  blob_sha: null;
} | { status: 'invalid'; blob_sha: string; message: string }
  | { status: 'ok'; blob_sha: string; registry: ParseResult } {
  const maxBuffer = normalizeMaxBuffer(input.maxBuffer);
  const sha = resolveHistoryRef({ repoRoot: input.repoRoot, ref: input.ref, maxBuffer });
  const blob = readBlobInTree(input.repoRoot, sha, epicRegistry.REGISTRY_REL, maxBuffer);
  if (blob.status === 'absent') return { status: 'missing', blob_sha: null };
  // 1. JSON 파싱만 잡는다. SyntaxError는 손상된 파일이므로 invalid로 돌려주고, 그 밖의 예외는 원인을 숨기지 않게 던진다.
  let value: unknown;
  try {
    value = JSON.parse(blob.bytes.toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { status: 'invalid', blob_sha: blob.blob_sha, message: `registry is not valid JSON: ${error.message}` };
    }
    throw error;
  }
  // 2. 스키마 판정은 작업 트리 검사와 같은 parseEpicRegistry를 쓴다. 판정 규칙을 두 벌로 두지 않기 위해서다.
  const parsed = epicRegistry.parseEpicRegistry(value);
  if (!parsed.ok) return { status: 'invalid', blob_sha: blob.blob_sha, message: parsed.message };
  return { status: 'ok', blob_sha: blob.blob_sha, registry: parsed };
}

/**
 * 확정된 SHA 트리의 한 파일에서 함수 정의를 열거한다. symlink와 gitlink는 본문이 아니므로 먼저 가린다.
 * 확장자·선언 파일·파싱 판정은 symbol-index의 listDefinitionsInText가 그대로 맡는다.
 *
 * @param {{ repoRoot: string, ref: string, path: string, maxBuffer?: number }} input - 저장소·ref·경로·상한
 * @returns {{ history_ref: string } & (FileDefinitions
 *   | { status: 'unsupported', path: string, reason: 'symlink' | 'submodule' }
 *   | { status: 'absent', path: string })} history_ref는 확정된 40자 SHA다. 파일 판정 결과가 그 뒤에 붙는다
 * @throws {Error} path·ref가 거절되거나 Git 호출이 실패하면 던진다
 */
function listDefinitionsAtRevision(input: { repoRoot: string; ref: string; path: string; maxBuffer?: number }): {
  history_ref: string;
} & (FileDefinitions | { status: 'unsupported'; path: string; reason: 'symlink' | 'submodule' }
  | { status: 'absent'; path: string }) {
  const maxBuffer = normalizeMaxBuffer(input.maxBuffer);
  assertRepoPath(input.path);
  const sha = resolveHistoryRef({ repoRoot: input.repoRoot, ref: input.ref, maxBuffer });
  // 1. 종류를 mode로 먼저 가린다. symlink는 확장자가 .ts여도 링크이고, gitlink는 다른 저장소의 커밋이라
  // 이 저장소의 본문이 아니므로 파싱하면 안 된다.
  const entry = lsTreeEntry(input.repoRoot, sha, input.path, maxBuffer);
  if (entry === null) return { history_ref: sha, status: 'absent', path: input.path };
  if (entry.mode === '160000') {
    return { history_ref: sha, status: 'unsupported', path: input.path, reason: 'submodule' };
  }
  if (entry.mode === '120000') return { history_ref: sha, status: 'unsupported', path: input.path, reason: 'symlink' };
  if (entry.type !== 'blob') return { history_ref: sha, status: 'absent', path: input.path };
  // 2. 일반 파일만 본문을 읽고 정의 열거를 맡긴다.
  const bytes = gitOk(input.repoRoot, ['cat-file', 'blob', entry.oid], maxBuffer);
  return { history_ref: sha, ...symbolIndex.listDefinitionsInText({ path: input.path, bytes }) };
}

export = {
  resolveHistoryRef,
  readBlobAt,
  listExplainSourcesAt,
  readRegistryAt,
  listDefinitionsAtRevision,
};
