'use strict';

const fs = require('node:fs');
const path = require('node:path');
const nodeBuffer = require('node:buffer');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');

import canonicalJsonMod = require('./canonical-json');
const { canonicalJson, sha256Canonical } = canonicalJsonMod;
import pathsMod = require('./paths');
const { toPosix } = pathsMod;

// 실행 리뷰가 보는 "최종 파일 상태"를 한 번 동결해 보존하는 공유 모듈이다.
// 규모 분류(review-dispatch)와 이후의 라운드 바인딩·acceptance 검사가 같은
// 수집 규칙·같은 해시를 써야 두 경로가 서로 다른 대상을 가리키지 않으므로,
// 수집과 일치 검사를 이 파일 한 곳에만 둔다.

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_ID_RE = /^[0-9a-f]{64}$/;
const SNAPSHOT_DIR = '.bouncer/runtime/review-snapshots';
const RUNTIME_PREFIX = '.bouncer/runtime/';
const CONTEXT_PREFIX = '.bouncer/context/';
// 리뷰·검증 CLI가 스스로 쓰는 증거 문서. 이것이 id에 들어가면 증거를 쓰는 순간
// 자기 자신을 stale로 만들어 acceptance가 영원히 통과하지 못한다.
const EVIDENCE_FILES = ['review.md', 'context-review.md', 'verification.md'];
// git은 텍스트 diff 하나가 기본 execFileSync 버퍼(1MB)를 쉽게 넘는다. 넘치면 ENOBUFS로
// 실패해 큰 변경일수록 분류가 안 되는 역전이 생기므로 넉넉히 잡는다.
const GIT_MAX_BUFFER = 512 * 1024 * 1024;
// 잠금·pathspec 해석을 고정하는 git 전역 옵션. --no-optional-locks는 diff/ls-files가
// index stat 캐시를 갱신하며 index 파일을 다시 쓰는 일을 막아 "수집은 index를 바꾸지
// 않는다"를 지키고, --literal-pathspecs는 특수 파일명이 glob으로 해석되는 것을 막는다.
const GIT_PREFIX = ['--no-optional-locks', '--literal-pathspecs'];

type FileMeta = {
  mode: number;
  size: number;
  mtimeMs: number;
  ino: number;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
  isDirectory: () => boolean;
};

type SnapshotDeps = {
  runGit: (args: string[]) => Buffer;
  readFile: (absPath: string) => Buffer;
  lstat: (absPath: string) => FileMeta;
  readlink: (absPath: string) => Buffer;
  persistArtifact: (absPath: string, content: Buffer) => void;
};

type SnapshotFile = {
  path: string;
  mode: string | null;
  kind: 'text' | 'binary' | 'symlink' | 'deleted';
  content: string;
};

type IndexEntry = { path: string; mode: string | null; blob: string | null };

type ReviewSnapshot = {
  version: 1;
  scope: { blueprint: string; task: string | null };
  target: { base: string; head: string };
  diff: string;
  files: SnapshotFile[];
  index_entries: IndexEntry[];
  changed_files: number;
  changed_lines: number;
  // 파일별 변경 줄 수(files와 같은 순서). 이 필드가 생기기 전에 저장된 snapshot에는 없으므로 선택 필드다.
  file_lines?: Array<{ path: string; lines: number }>;
};

type SnapshotFail = { ok: false; reason: string; cause: string; next: string };
type SnapshotOk = {
  ok: true;
  snapshot_id: string;
  snapshot_path: string;
  snapshot: ReviewSnapshot;
};
type SnapshotResult = SnapshotOk | SnapshotFail;

type ScopeArgs = {
  repoRoot: string;
  blueprintDir: string;
  taskId?: string | null;
  base: string;
  head: string;
  deps?: Partial<SnapshotDeps>;
};

/** 내부 흐름을 끊고 공개 경계에서 `{ok:false}`로 바꾸기 위한 typed 실패. */
class SnapshotError extends Error {
  reason: string;

  cause_: string;

  next: string;

  constructor(reason: string, cause: string, next: string) {
    super(`${reason}: ${cause}`);
    this.reason = reason;
    this.cause_ = cause;
    this.next = next;
  }
}

const NEXT_RETRY = 'fix the reported cause, then run review-dispatch execute again';
const NEXT_REDISPATCH = 'run review-dispatch execute again on the current worktree and re-review';

/**
 * 실제 Git·파일 시스템에 묶인 기본 I/O 경계를 만든다.
 * 테스트는 이 중 일부를 덮어써 읽기 실패·수집 중 변경·저장 실패를 주입한다.
 *
 * @param {string} repoRoot - git 명령의 cwd
 * @returns {SnapshotDeps} 기본 주입 경계
 */
function defaultDeps(repoRoot: string): SnapshotDeps {
  return {
    runGit: (args) => execFileSync('git', args, {
      cwd: repoRoot, maxBuffer: GIT_MAX_BUFFER, stdio: ['ignore', 'pipe', 'pipe'],
    }) as Buffer,
    // O_NOFOLLOW: lstat 뒤 읽기 전에 일반 파일이 symlink로 바뀌어도 외부 내용을
    // 따라 읽지 않는다. 열기 실패는 읽기 실패로 올라간다.
    readFile: (absPath) => {
      const fd = fs.openSync(absPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        return fs.readFileSync(fd) as Buffer;
      } finally {
        fs.closeSync(fd);
      }
    },
    lstat: (absPath) => fs.lstatSync(absPath) as FileMeta,
    readlink: (absPath) => Buffer.from(fs.readlinkSync(absPath, { encoding: 'buffer' })),
    persistArtifact,
  };
}

/**
 * artifact를 같은 디렉터리 임시 파일에 쓴 뒤 rename으로 게시한다.
 * 중간에 죽어도 읽는 쪽은 완전한 파일이나 부재만 본다. 실패하면 throw한다.
 *
 * @param {string} absPath - 최종 artifact 절대 경로
 * @param {Buffer} content - 쓸 바이트
 * @returns {void}
 */
function persistArtifact(absPath: string, content: Buffer): void {
  const dir = path.dirname(absPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(absPath)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
  // 열기 실패(EEXIST 등)는 우리가 만든 파일이 없으므로 정리 없이 올린다.
  const fd = fs.openSync(tmp, 'wx', 0o644);
  try {
    try {
      fs.writeFileSync(fd, content);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, absPath);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch (unlinkError) {
      // ENOENT만 흡수: rename이 이미 tmp를 옮긴 경우라 지울 것이 없다. 그 외는 원인을 가리지 않는다.
      if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') throw unlinkError;
    }
    throw error;
  }
}

/**
 * 자동 증거 경로인지 판정한다. 수집과 일치 검사가 같은 함수를 써야 한다.
 * `.bouncer/runtime/**`와 `.bouncer/context` 아래 review.md·context-review.md·
 * verification.md 및 그 원자 쓰기 임시 파일(`.<name>.…tmp`)만 제외한다.
 * 계획 문서·설정·일반 소스는 리뷰 대상이므로 제외하지 않는다.
 *
 * @param {string} rel - 저장소 상대 POSIX 경로
 * @returns {boolean} 자동 증거면 true
 */
function isAutoEvidence(rel: string): boolean {
  if (rel === RUNTIME_PREFIX.slice(0, -1) || rel.startsWith(RUNTIME_PREFIX)) return true;
  if (!rel.startsWith(CONTEXT_PREFIX)) return false;
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  return EVIDENCE_FILES.some((name) => (
    base === name || (base.startsWith(`.${name}.`) && base.endsWith('.tmp'))
  ));
}

/**
 * git이 돌려준 경로가 저장소 안의 정규 상대 경로인지 확인한다.
 * 절대경로·`..`·빈 세그먼트는 저장소 밖 파일을 읽게 만들 수 있어 거절한다.
 *
 * @param {string} rel - git이 보고한 경로
 * @returns {string} 같은 경로(검증 통과)
 */
function assertSafeRel(rel: string): string {
  const segments = rel.split('/');
  if (!rel || rel.startsWith('/') || segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new SnapshotError(
      'unsafe-path',
      `path is not a normalized repo-relative path: ${JSON.stringify(rel)}`,
      NEXT_RETRY,
    );
  }
  return rel;
}

/**
 * lstat을 감싸 부재(ENOENT/ENOTDIR)만 null로 접는다.
 * 권한 오류 등 나머지는 "없음"으로 오인하지 않고 읽기 실패로 올린다.
 *
 * @param {SnapshotDeps} deps - 주입 경계
 * @param {string} abs - 절대 경로
 * @returns {FileMeta | null} 메타데이터, 없으면 null
 */
function statOrNull(deps: SnapshotDeps, abs: string): FileMeta | null {
  try {
    return deps.lstat(abs);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw new SnapshotError('read-failed', `lstat ${abs}: ${(error as Error).message}`, NEXT_RETRY);
  }
}

/**
 * 외부 I/O 한 호출의 어떤 실패든 같은 reason의 typed 실패로 바꾼다.
 * 한 호출만 감싸므로 서로 다른 단계의 실패가 하나로 뭉개지지 않고, 원문 메시지는 cause에 남는다.
 *
 * @param {string} reason - 실패 reason
 * @param {() => T} fn - 감쌀 I/O 호출 하나
 * @returns {T} fn의 반환값
 */
function guard<T>(reason: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new SnapshotError(reason, message, NEXT_RETRY);
  }
}

/**
 * `rel`의 조상 디렉터리 중 symlink가 있으면 거절한다. symlink 조상을 통과하면
 * 저장소 밖 내용을 읽거나 runtime 밖에 쓸 수 있다. 아직 없는 조상에서 멈춘다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} rel - 저장소 상대 경로
 * @param {SnapshotDeps} deps - 주입 경계
 * @param {Set<string>} verified - 이미 확인한 조상 캐시
 * @returns {void}
 */
function assertPlainAncestors(
  repoRoot: string,
  rel: string,
  deps: SnapshotDeps,
  verified: Set<string>,
): void {
  const parts = rel.split('/').slice(0, -1);
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (verified.has(current)) continue;
    const meta = statOrNull(deps, path.join(repoRoot, current));
    if (!meta) return;
    if (meta.isSymbolicLink()) {
      throw new SnapshotError('unsafe-path', `ancestor directory is a symlink: ${current}`, NEXT_RETRY);
    }
    verified.add(current);
  }
}

/**
 * snapshot id로 artifact의 저장소 상대 경로를 유도한다. 수집과 로더가 같은 규칙을 쓴다.
 *
 * @param {string} snapshotId - 64자 hex id
 * @returns {string} 저장소 상대 POSIX 경로
 */
function snapshotPathOf(snapshotId: string): string {
  return `${SNAPSHOT_DIR}/${snapshotId}/snapshot.json`;
}

/**
 * 파일 메타데이터 서명. 읽는 동안 바뀌었는지 비교하는 용도다.
 *
 * @param {FileMeta | null} meta - lstat 결과, 부재면 null
 * @returns {string} 비교용 문자열
 */
function metaSig(meta: FileMeta | null): string {
  return meta ? `${meta.mode}:${meta.size}:${meta.mtimeMs}:${meta.ino}` : 'absent';
}

/**
 * git 명령 한 번을 typed 실패로 감싸 실행한다.
 *
 * @param {SnapshotDeps} deps - 주입 경계
 * @param {string[]} args - git 하위 명령과 인자(전역 옵션은 여기서 붙인다)
 * @returns {Buffer} stdout
 */
function git(deps: SnapshotDeps, args: string[]): Buffer {
  return guard('git-failed', () => Buffer.from(deps.runGit([...GIT_PREFIX, ...args])));
}

/**
 * ref를 커밋 SHA로 해석한다.
 *
 * @param {SnapshotDeps} deps - 주입 경계
 * @param {string} ref - ref 또는 SHA
 * @returns {string} 해석된 커밋 SHA
 */
function resolveCommit(deps: SnapshotDeps, ref: string): string {
  return git(deps, ['rev-parse', '--verify', `${ref}^{commit}`]).toString('utf8').trim();
}

/**
 * NUL로 끝나는 git -z 출력을 항목 배열로 자른다.
 *
 * @param {Buffer} out - git -z stdout
 * @returns {string[]} 빈 항목 없는 항목들
 */
function splitZ(out: Buffer): string[] {
  return out.toString('utf8').split('\0').filter((s) => s !== '');
}

type RawDiffEntry = { status: string; path: string };

/**
 * `git diff --raw -z --no-renames`를 파싱한다. 병합 안 된 항목과 gitlink(submodule)는
 * 표현할 수 없어 거절한다.
 *
 * @param {Buffer} out - git diff --raw -z stdout
 * @returns {RawDiffEntry[]} 상태·경로 목록(증거 필터 전)
 */
function parseRawDiff(out: Buffer): RawDiffEntry[] {
  const tokens = splitZ(out);
  const entries: RawDiffEntry[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const meta = /^:(\d+) (\d+) [0-9a-f]+ [0-9a-f]+ ([A-Z])\d*$/.exec(tokens[i]);
    if (!meta) {
      throw new SnapshotError('git-failed', `unparseable diff --raw row: ${tokens[i]}`, NEXT_RETRY);
    }
    const [, oldMode, newMode, status] = meta;
    if (status === 'U') {
      throw new SnapshotError(
        'unsupported-state',
        `unmerged path cannot be represented: ${tokens[i + 1]}`,
        'resolve the merge conflict, then run review-dispatch execute again',
      );
    }
    if (oldMode === '160000' || newMode === '160000') {
      throw new SnapshotError(
        'unsupported-state',
        `submodule (gitlink) change cannot be frozen: ${tokens[i + 1]}`,
        'keep submodule pointer changes out of the reviewed range',
      );
    }
    entries.push({ status, path: tokens[i + 1] });
  }
  return entries;
}

/**
 * `git ls-files -s -z`와 `git ls-tree -r -z`로 index가 base tree와 다른 항목만 모은다.
 * 같은 최종 파일 내용이라도 staged 여부가 다르면 id가 달라져야 하므로 index 쪽 정보를 담는다.
 * 전체 index를 담지 않는 이유: 변경과 무관한 수천 항목이 artifact를 부풀리고,
 * base와 같은 항목은 id에 정보를 더하지 못한다.
 *
 * @param {Buffer} indexOut - ls-files -s -z stdout
 * @param {Buffer} treeOut - ls-tree -r -z stdout (base)
 * @returns {IndexEntry[]} 경로순 정렬된 차이 항목(자동 증거 제외)
 */
function diffIndexAgainstBase(indexOut: Buffer, treeOut: Buffer): IndexEntry[] {
  const index = new Map<string, { mode: string; blob: string }>();
  for (const row of splitZ(indexOut)) {
    const m = /^(\d+) ([0-9a-f]+) (\d)\t([\s\S]*)$/.exec(row);
    if (!m) throw new SnapshotError('git-failed', `unparseable ls-files row: ${row}`, NEXT_RETRY);
    if (m[3] !== '0') {
      throw new SnapshotError(
        'unsupported-state',
        `conflicted index entry (stage ${m[3]}): ${m[4]}`,
        'resolve the merge conflict, then run review-dispatch execute again',
      );
    }
    if (m[1] === '160000') {
      throw new SnapshotError(
        'unsupported-state',
        `submodule (gitlink) in index cannot be frozen: ${m[4]}`,
        'keep submodule pointer changes out of the reviewed range',
      );
    }
    index.set(m[4], { mode: m[1], blob: m[2] });
  }
  const tree = new Map<string, { mode: string; blob: string }>();
  for (const row of splitZ(treeOut)) {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t([\s\S]*)$/.exec(row);
    if (!m) throw new SnapshotError('git-failed', `unparseable ls-tree row: ${row}`, NEXT_RETRY);
    tree.set(m[4], { mode: m[1], blob: m[3] });
  }
  const entries: IndexEntry[] = [];
  for (const p of new Set([...index.keys(), ...tree.keys()])) {
    if (isAutoEvidence(p)) continue;
    const a = index.get(p);
    const b = tree.get(p);
    if (a && b && a.mode === b.mode && a.blob === b.blob) continue;
    entries.push({ path: p, mode: a ? a.mode : null, blob: a ? a.blob : null });
  }
  return entries.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
}

/**
 * `git diff --numstat -z`의 경로별 추가·삭제 줄을 읽는다. binary(`-`)는 null.
 *
 * @param {Buffer} out - numstat -z stdout
 * @returns {Map<string, number | null>} 경로 → 줄 수 합(binary는 null)
 */
function parseNumstat(out: Buffer): Map<string, number | null> {
  const lines = new Map<string, number | null>();
  for (const row of splitZ(out)) {
    const m = /^(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(row);
    if (!m) throw new SnapshotError('git-failed', `unparseable numstat row: ${row}`, NEXT_RETRY);
    lines.set(m[3], m[1] === '-' || m[2] === '-' ? null : Number(m[1]) + Number(m[2]));
  }
  return lines;
}

/**
 * 텍스트 파일의 줄 수. 마지막 줄에 개행이 없어도 한 줄로 센다.
 *
 * @param {string} text - 파일 내용
 * @returns {number} 줄 수
 */
function countLines(text: string): number {
  if (text === '') return 0;
  const newlines = text.split('\n').length - 1;
  return text.endsWith('\n') ? newlines : newlines + 1;
}

/**
 * 변경 감지용 git 상태 지문. 수집 전후로 두 번 읽어 같은지 비교한다.
 *
 * @param {SnapshotDeps} deps - 주입 경계
 * @param {string} base - 해석된 base SHA
 * @returns {{ head: string, index: Buffer, untracked: Buffer, raw: Buffer }} 원 출력들
 */
function readGitState(deps: SnapshotDeps, base: string): {
  head: string; index: Buffer; untracked: Buffer; raw: Buffer;
} {
  return {
    head: resolveCommit(deps, 'HEAD'),
    index: git(deps, ['ls-files', '-s', '-z', '--full-name']),
    untracked: git(deps, ['ls-files', '--others', '--exclude-standard', '-z', '--full-name']),
    raw: git(deps, ['diff', '--raw', '-z', '--no-renames', '--no-abbrev', '--no-ext-diff', base]),
  };
}

/**
 * 두 git 상태가 같은지 비교한다.
 *
 * @param {ReturnType<typeof readGitState>} a - 이전 상태
 * @param {ReturnType<typeof readGitState>} b - 이후 상태
 * @returns {boolean} 같으면 true
 */
function sameGitState(a: ReturnType<typeof readGitState>, b: ReturnType<typeof readGitState>): boolean {
  return a.head === b.head && a.index.equals(b.index)
    && a.untracked.equals(b.untracked) && a.raw.equals(b.raw);
}

/**
 * base 이후의 최종 작업 트리 상태를 메모리에 수집한다(저장하지 않는다).
 * 수집과 일치 검사가 이 함수를 공유해, 같은 입력이 항상 같은 id가 되게 한다.
 *
 * 수집 중 파일·index가 바뀌면 changed-during-capture로 거절한다. 일관되지 않은
 * 스냅샷을 성공으로 돌려주면 리뷰어가 본 내용과 acceptance 대상이 갈라진다.
 *
 * @param {ScopeArgs} args - 저장소·범위·base/head·주입 경계
 * @param {SnapshotDeps} deps - 기본값과 병합된 주입 경계
 * @returns {ReviewSnapshot} 수집된 snapshot
 */
function collectSnapshot(args: ScopeArgs, deps: SnapshotDeps): ReviewSnapshot {
  const { repoRoot } = args;
  // 1. head는 현재 HEAD와 같아야 한다. 과거 HEAD는 작업 트리 상태와 짝이 안 맞아
  //    "그 커밋 시점의 리뷰"로 오해될 수 있어 지원하지 않는다.
  const base = resolveCommit(deps, args.base);
  const head = resolveCommit(deps, args.head);
  const before = readGitState(deps, base);
  if (head !== before.head) {
    throw new SnapshotError(
      'head-mismatch',
      `head ${head} is not the current HEAD ${before.head}`,
      'review the current HEAD: pass --head HEAD (resolved) and run review-dispatch execute again',
    );
  }

  // 2. 변경 경로 집합: 추적 파일의 base 대비 최종 차이 + git ignore를 따르는 untracked.
  const verifiedDirs = new Set<string>();
  const tracked = parseRawDiff(before.raw)
    .map((e) => ({ ...e, path: assertSafeRel(e.path) }))
    .filter((e) => !isAutoEvidence(e.path));
  const untracked = splitZ(before.untracked)
    // 내용이 추적되지 않는 중첩 git 저장소(예: 별도 worktree)는 `dir/` 한 항목으로 보고된다.
    // 부모 저장소의 최종 상태가 아니므로 ignored와 같이 제외한다. 추적 중인 submodule의 변경은
    // 위의 gitlink 검사(parseRawDiff)가 따로 거절한다.
    .filter((p) => !p.endsWith('/'))
    .map(assertSafeRel)
    .filter((p) => !isAutoEvidence(p));
  const untrackedSet = new Set(untracked);
  for (const e of tracked) {
    if (untrackedSet.has(e.path)) {
      // index에서 지웠지만 같은 경로 파일이 남은 상태는 삭제+추가가 겹쳐 한 번만 세는 규칙을 깬다.
      throw new SnapshotError(
        'unsupported-state',
        `path is removed from the index but present untracked: ${e.path}`,
        'stage or restore the path, then run review-dispatch execute again',
      );
    }
  }

  // 3. 파일 내용 동결. 읽기 전후 lstat이 같아야 하고, 마지막에 한 번 더 확인한다.
  const sigs = new Map<string, string>();
  const files: SnapshotFile[] = [];
  const untrackedLines = new Map<string, number>();
  const readOne = (rel: string, expectGone: boolean): void => {
    assertPlainAncestors(repoRoot, rel, deps, verifiedDirs);
    const abs = path.join(repoRoot, rel);
    const meta = statOrNull(deps, abs);
    if (!meta) {
      if (!expectGone) {
        throw new SnapshotError('changed-during-capture', `file disappeared while capturing: ${rel}`, NEXT_REDISPATCH);
      }
      sigs.set(rel, 'absent');
      files.push({ path: rel, mode: null, kind: 'deleted', content: '' });
      return;
    }
    if (expectGone) {
      throw new SnapshotError('changed-during-capture', `file reappeared while capturing: ${rel}`, NEXT_REDISPATCH);
    }
    let file: SnapshotFile;
    if (meta.isSymbolicLink()) {
      // 링크 target 문자열만 담는다. 가리키는 외부 내용은 따라 읽지 않는다.
      const target = guard('read-failed', () => deps.readlink(abs)).toString('utf8');
      file = { path: rel, mode: '120000', kind: 'symlink', content: target };
    } else if (meta.isFile()) {
      const bytes = guard('read-failed', () => deps.readFile(abs));
      const mode = (meta.mode & 0o111) !== 0 ? '100755' : '100644';
      file = nodeBuffer.isUtf8(bytes) && !bytes.includes(0)
        ? { path: rel, mode, kind: 'text', content: bytes.toString('utf8') }
        : { path: rel, mode, kind: 'binary', content: bytes.toString('base64') };
    } else {
      throw new SnapshotError('unsupported-state', `special file cannot be frozen: ${rel}`, NEXT_RETRY);
    }
    if (metaSig(statOrNull(deps, abs)) !== metaSig(meta)) {
      throw new SnapshotError('changed-during-capture', `file changed while it was read: ${rel}`, NEXT_REDISPATCH);
    }
    sigs.set(rel, metaSig(meta));
    files.push(file);
    if (untrackedSet.has(rel) && file.kind === 'text') untrackedLines.set(rel, countLines(file.content));
  };
  for (const e of tracked) readOne(e.path, e.status === 'D');
  for (const p of untracked) readOne(p, false);

  // 4. 추적 파일의 동결 diff·줄 수. 변경이 없으면 pathspec이 비어 전체 diff가 되므로 건너뛴다.
  let diff = '';
  let trackedLines = new Map<string, number | null>();
  if (tracked.length > 0) {
    const paths = tracked.map((e) => e.path);
    const diffArgs = ['diff', '--no-ext-diff', '--no-textconv', '--no-color', '--no-renames'];
    diff = git(deps, [...diffArgs, base, '--', ...paths]).toString('utf8');
    trackedLines = parseNumstat(git(deps, [...diffArgs, '--numstat', '-z', base, '--', ...paths]));
  }
  let changedLines = 0;
  for (const e of tracked) changedLines += trackedLines.get(e.path) ?? 0;
  for (const n of untrackedLines.values()) changedLines += n;

  const indexEntries = diffIndexAgainstBase(
    before.index,
    git(deps, ['ls-tree', '-r', '-z', '--full-tree', base]),
  );

  // 5. 수집 중 변경 검사: git 상태와 모든 파일 서명이 처음과 같아야 한다.
  if (!sameGitState(before, readGitState(deps, base))) {
    throw new SnapshotError(
      'changed-during-capture',
      'HEAD, index, or the changed-path set moved while capturing',
      NEXT_REDISPATCH,
    );
  }
  for (const [rel, sig] of sigs) {
    if (metaSig(statOrNull(deps, path.join(repoRoot, rel))) !== sig) {
      throw new SnapshotError('changed-during-capture', `file changed during capture: ${rel}`, NEXT_REDISPATCH);
    }
  }

  files.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  // files와 같은 순서·같은 값 원천(trackedLines, untrackedLines)에서 만든다. 그 밖(untracked binary·symlink)과
  // binary 추적 파일(numstat null)은 0줄이다. 정렬이 다르면 snapshot 해시가 호출마다 갈린다.
  const fileLines = files.map((f) => ({
    path: f.path,
    lines: untrackedLines.get(f.path) ?? trackedLines.get(f.path) ?? 0,
  }));
  return {
    version: SNAPSHOT_VERSION,
    scope: { blueprint: toPosix(args.blueprintDir), task: args.taskId ? args.taskId : null },
    target: { base, head },
    diff,
    files,
    index_entries: indexEntries,
    changed_files: files.length,
    changed_lines: changedLines,
    file_lines: fileLines,
  };
}

/**
 * 공개 경계: 내부 SnapshotError만 `{ok:false}`로 바꾸고 나머지(프로그래밍 오류)는 다시 던진다.
 *
 * @param {() => SnapshotOk} fn - 실행할 본문
 * @returns {SnapshotResult} 성공 또는 typed 실패
 */
function toResult(fn: () => SnapshotOk): SnapshotResult {
  try {
    return fn();
  } catch (error) {
    if (error instanceof SnapshotError) {
      return { ok: false, reason: error.reason, cause: error.cause_, next: error.next };
    }
    throw error;
  }
}

/**
 * 최종 작업 트리 상태를 한 번 동결해 runtime artifact로 보존한다.
 * 같은 입력은 같은 id를 낸다. 같은 id 파일이 이미 있으면 내용 해시를 검증해 재사용하고,
 * 검증에 실패하면 덮어쓰지 않고 거절한다. 소스·index·브랜치는 바꾸지 않는다.
 *
 * @param {ScopeArgs} args - repoRoot, blueprintDir, taskId, 해석된 base/head, deps
 * @returns {SnapshotResult} 성공 시 id·상대 경로·snapshot, 실패 시 reason·cause·next
 */
function captureReviewSnapshot(args: ScopeArgs): SnapshotResult {
  const deps = { ...defaultDeps(args.repoRoot), ...(args.deps || {}) };
  return toResult(() => {
    const snapshot = collectSnapshot(args, deps);
    const snapshotId = sha256Canonical(snapshot);
    const rel = snapshotPathOf(snapshotId);
    const abs = path.join(args.repoRoot, rel);
    assertPlainAncestors(args.repoRoot, rel, deps, new Set());
    if (statOrNull(deps, abs)) {
      // 검증 없이 덮어쓰면 손상된 파일이 정상 id 뒤에 숨는다. 같은 내용일 때만 재사용한다.
      const loaded = readVerified(deps, abs, snapshotId);
      if (!loaded) {
        throw new SnapshotError(
          'snapshot-corrupt',
          `existing artifact does not match its id: ${rel}`,
          'remove the corrupt dir under .bouncer/runtime/review-snapshots, then run review-dispatch execute again',
        );
      }
    } else {
      guard('persist-failed', () => deps.persistArtifact(abs, Buffer.from(`${canonicalJson(snapshot)}\n`)));
    }
    return { ok: true, snapshot_id: snapshotId, snapshot_path: rel, snapshot };
  });
}

/**
 * artifact 파일을 읽어 내용 해시가 id와 같을 때만 snapshot을 돌려준다.
 *
 * @param {SnapshotDeps} deps - 주입 경계
 * @param {string} abs - artifact 절대 경로
 * @param {string} snapshotId - 기대 id
 * @returns {ReviewSnapshot | null} 검증된 snapshot, 손상·형식 위반이면 null
 */
function readVerified(deps: SnapshotDeps, abs: string, snapshotId: string): ReviewSnapshot | null {
  const bytes = guard('read-failed', () => deps.readFile(abs));
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    // SyntaxError만 손상으로 흡수한다: 잘린 파일은 "손상"이고 호출자가 같은 reason으로 처리한다.
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!isSnapshotShape(parsed) || sha256Canonical(parsed) !== snapshotId) return null;
  return parsed;
}

/**
 * snapshot 최소 형태 검사. 해시가 맞아도 손으로 만든 다른 모양을 소비자에게 넘기지 않는다.
 *
 * @param {unknown} value - 파싱된 JSON
 * @returns {boolean} 계약 형태이면 true
 */
function isSnapshotShape(value: unknown): value is ReviewSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  const scope = s.scope as Record<string, unknown> | undefined;
  const target = s.target as Record<string, unknown> | undefined;
  return s.version === SNAPSHOT_VERSION
    && !!scope && typeof scope.blueprint === 'string'
    && (scope.task === null || typeof scope.task === 'string')
    && !!target && typeof target.base === 'string' && typeof target.head === 'string'
    && typeof s.diff === 'string'
    && Array.isArray(s.files) && Array.isArray(s.index_entries)
    && Number.isInteger(s.changed_files) && Number.isInteger(s.changed_lines);
}

/**
 * 저장된 snapshot artifact를 id로 읽어 내용 해시·형태를 검증한다.
 *
 * @param {{ repoRoot: string, snapshotId: string, deps?: Partial<SnapshotDeps> }} args - 저장소·id·주입 경계
 * @returns {SnapshotResult} 성공 시 snapshot, 실패 시 reason은
 *   invalid-snapshot-id|snapshot-missing|snapshot-corrupt|read-failed|unsafe-path
 */
function loadReviewSnapshot(args: {
  repoRoot: string;
  snapshotId: string;
  deps?: Partial<SnapshotDeps>;
}): SnapshotResult {
  const deps = { ...defaultDeps(args.repoRoot), ...(args.deps || {}) };
  return toResult(() => loadOrThrow(args.repoRoot, args.snapshotId, deps));
}

/**
 * loadReviewSnapshot의 본문. 일치 검사가 typed 실패를 그대로 올리도록 throw 형태로 둔다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} snapshotId - 64자 hex id
 * @param {SnapshotDeps} deps - 주입 경계
 * @returns {SnapshotOk} 검증된 snapshot
 */
function loadOrThrow(repoRoot: string, snapshotId: string, deps: SnapshotDeps): SnapshotOk {
  // id를 경로에 쓰기 전에 형식을 고정한다. `../` 같은 값이 runtime 밖 파일을 읽게 하지 않는다.
  if (typeof snapshotId !== 'string' || !SNAPSHOT_ID_RE.test(snapshotId)) {
    throw new SnapshotError(
      'invalid-snapshot-id',
      'snapshot id must be 64 lowercase hex characters',
      'pass the snapshot_id printed by review-dispatch execute',
    );
  }
  const rel = snapshotPathOf(snapshotId);
  const abs = path.join(repoRoot, rel);
  assertPlainAncestors(repoRoot, rel, deps, new Set());
  const meta = statOrNull(deps, abs);
  if (!meta) {
    throw new SnapshotError('snapshot-missing', `no artifact at ${rel}`, NEXT_REDISPATCH);
  }
  if (!meta.isFile()) {
    throw new SnapshotError('snapshot-corrupt', `artifact is not a regular file: ${rel}`, NEXT_REDISPATCH);
  }
  const snapshot = readVerified(deps, abs, snapshotId);
  if (!snapshot) {
    throw new SnapshotError('snapshot-corrupt', `artifact content does not hash to its id: ${rel}`, NEXT_REDISPATCH);
  }
  return { ok: true, snapshot_id: snapshotId, snapshot_path: rel, snapshot };
}

/**
 * 저장된 snapshot이 현재 작업 트리 상태와 아직 같은지 검사한다(저장하지 않는다).
 * 범위(blueprint·task)와 base/head가 다르거나, 현재 상태를 같은 규칙으로 다시 수집한 id가
 * 저장 id와 다르면 stale로 거절한다. 리뷰 중에 바뀐 대상을 accepted로 기록하지 않기 위함이다.
 *
 * @param {ScopeArgs & { snapshotId: string }} args - 저장소·id·범위·base/head·주입 경계
 * @returns {SnapshotResult} 일치하면 로드된 snapshot, 아니면 reason은
 *   scope-mismatch|target-mismatch|head-mismatch|snapshot-stale 등
 */
function checkReviewSnapshotCurrent(args: ScopeArgs & { snapshotId: string }): SnapshotResult {
  const deps = { ...defaultDeps(args.repoRoot), ...(args.deps || {}) };
  return toResult(() => {
    const loaded = loadOrThrow(args.repoRoot, args.snapshotId, deps);
    const stored = loaded.snapshot;
    const scope = { blueprint: toPosix(args.blueprintDir), task: args.taskId ? args.taskId : null };
    if (stored.scope.blueprint !== scope.blueprint || stored.scope.task !== scope.task) {
      throw new SnapshotError(
        'scope-mismatch',
        `snapshot is for ${JSON.stringify(stored.scope)}, not ${JSON.stringify(scope)}`,
        NEXT_REDISPATCH,
      );
    }
    const current = collectSnapshot(args, deps);
    if (stored.target.base !== current.target.base || stored.target.head !== current.target.head) {
      throw new SnapshotError(
        'target-mismatch',
        'snapshot base/head differ from the requested base/head',
        NEXT_REDISPATCH,
      );
    }
    if (sha256Canonical(current) !== args.snapshotId) {
      throw new SnapshotError('snapshot-stale', 'the worktree changed after the snapshot was frozen', NEXT_REDISPATCH);
    }
    return loaded;
  });
}

export = {
  SNAPSHOT_VERSION,
  isAutoEvidence,
  captureReviewSnapshot,
  loadReviewSnapshot,
  checkReviewSnapshotCurrent,
};
