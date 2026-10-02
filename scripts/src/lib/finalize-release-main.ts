'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
import frontmatter = require('./frontmatter');
const { parseFrontmatter } = frontmatter;
import paths = require('./paths');
const { epicDirOf, toPosix } = paths;
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import runtimeState = require('./runtime-state');
const { runtimePaths, worktreePathFor } = runtimeState;
import scope = require('./scope');
const { readCoordinatorLedger } = scope;
import current = require('./current');
const { nextBlueprint } = current;
import seedWorktree = require('./seed-worktree');
const { releaseSeedManifest } = seedWorktree;

const BLUEPRINT_DIR_RE = /^\.bouncer\/context\/epics\/[^/]+\/blueprints\/[^/]+$/;

type ReleaseMainOk = {
  ok: true;
  blueprint: string;
  removed: string[];
  restored: string[];
  preserved: string[];
  next: { blueprint: string } | null;
};

type ReleaseMainErr = {
  ok: false;
  reason: string;
};

type ReleaseMainResult = ReleaseMainOk | ReleaseMainErr;

type LedgerRead =
  | { ok: true; ledger: { status?: string; tasks?: Array<{ status?: string }>; seedManifest?: unknown };
      integrationPath: string }
  | { ok: false; reason: string };

type NextList = {
  next: { blueprint: string; sameEpic?: boolean } | null;
  remaining: Array<{ blueprint: string; sameEpic?: boolean }>;
};

type ReleaseMainDeps = {
  runtimePaths: (opts: { repoRoot: string }) => { unavailable?: boolean; projectRoot?: string };
  readCoordinatorLedger: (opts: { repoRoot: string; blueprint: string }) => LedgerRead;
  nextBlueprint: (opts: { repoRoot: string; blueprintDir: string }) => NextList;
  worktreePathFor: (opts: { repoRoot: string; blueprint: string }) => string;
  git: (args: string[]) => string;
};

/**
 * 정규형 blueprint 상대 경로인지 본다. normalize가 입력을 바꾸면 `..` 탈출이
 * 이미 숨어 있는 것이므로, 정규식만 통과시켜도 형제를 지울 수 있다.
 *
 * @param {string} value - 호출자가 넘긴 blueprint 경로
 * @returns {boolean} 자기 자신으로 normalize되고 상대 POSIX 패턴에 맞으면 true
 */
function isCanonicalBlueprintPath(value: string): boolean {
  const normalized = path.posix.normalize(value);
  if (normalized !== value) return false;
  if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) return false;
  return BLUEPRINT_DIR_RE.test(normalized);
}

/**
 * 문서의 bouncer.status를 읽는다. 부재·깨진 YAML·frontmatter 없음은 모두
 * "닫힘 근거 없음"이지 권한 오류가 아니므로 null로 접는다.
 *
 * @param {string} abs - 문서 절대 경로
 * @returns {string | null} status 문자열. 파일을 못 읽거나 블록이 없으면 null
 */
function readBouncerStatus(abs: string): string | null {
  let source: string;
  try {
    source = fs.readFileSync(abs, 'utf8');
  } catch {
    // ENOENT뿐 아니라 EACCES·EISDIR도 닫힘 근거가 아니다. throw하면
    // releaseMain이 JSON reason 대신 프로세스를 죽인다.
    return null;
  }
  try {
    const data = parseFrontmatter(source).data;
    const bouncer = data && typeof data === 'object'
      ? (data as Record<string, unknown>).bouncer : null;
    if (!bouncer || typeof bouncer !== 'object') return null;
    const status = (bouncer as Record<string, unknown>).status;
    return typeof status === 'string' ? status : null;
  } catch {
    // YAML·frontmatter 부재·기타 파서 실패는 closed가 아니다. 같은 이유로
    // 프로세스 실패로 올리지 않고 거절 분기에 맡긴다.
    return null;
  }
}

/**
 * git cat-file이 "HEAD에 그 경로 없음"으로 실패한 경우만 가린다.
 * 권한·저장소 손상까지 같은 분기로 접으면 tracked를 지운다.
 *
 * @param {unknown} error - execFileSync가 던진 값
 * @returns {boolean} 경로가 HEAD에 없다는 메시지일 때만 true
 */
function isExpectedGitMiss(error: unknown): boolean {
  const err = error as { stderr?: Buffer | string; message?: string };
  const text = Buffer.isBuffer(err.stderr)
    ? err.stderr.toString('utf8')
    : typeof err.stderr === 'string' ? err.stderr : String(err.message || '');
  return /Not a valid object name|exists on disk, but not in/.test(text);
}

/**
 * child가 parent 디렉터리 트리 안에 있는지 본다. `..`로 올라가면 심볼릭
 * 링크가 blueprint 밖으로 나간 것이다.
 *
 * @param {string} childAbs - 검사할 절대 경로(가능하면 realpath)
 * @param {string} parentAbs - 상한 디렉터리 realpath
 * @returns {boolean} parent 자신이거나 그 아래이면 true
 */
function isInsideDir(childAbs: string, parentAbs: string): boolean {
  const rel = path.relative(parentAbs, childAbs);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

/**
 * 비어 있는 디렉터리를 `stopRel`(저장소 상대) 직전까지 지운다.
 * 상한을 `blueprints/`로 두면 형제 blueprint와 epic index를 같이 지울 수 없다.
 *
 * @param {string} repoRoot - 메인 checkout 절대 경로
 * @param {string} rel - 방금 지운 파일의 저장소 상대 경로
 * @param {string} stopRel - 지우지 않을 상한 디렉터리
 * @returns {void}
 */
function pruneEmptyDirs(repoRoot: string, rel: string, stopRel: string): void {
  let dir = path.dirname(path.join(repoRoot, rel));
  const stop = path.resolve(repoRoot, stopRel);
  while (path.resolve(dir) !== stop && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

/**
 * blueprint 트리 아래 남은 빈 디렉터리(파일 없이 껍데기만 있는 경우)를 지운다.
 * 파일 walk는 빈 폴더를 보지 못하므로, 정리 뒤에 한 번 더 쓸어야 상한 계약이 남는다.
 *
 * @param {string} repoRoot - 메인 checkout 절대 경로
 * @param {string} relDir - 쓸 디렉터리(보통 blueprint 경로)
 * @param {string} stopRel - 지우지 않을 상한 (`blueprints/`)
 * @returns {void}
 */
function sweepEmptyDirs(repoRoot: string, relDir: string, stopRel: string): void {
  const abs = path.join(repoRoot, relDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return;
  for (const name of fs.readdirSync(abs)) {
    const childRel = toPosix(path.posix.join(relDir, name));
    if (fs.statSync(path.join(repoRoot, childRel)).isDirectory()) {
      sweepEmptyDirs(repoRoot, childRel, stopRel);
    }
  }
  if (path.resolve(abs) !== path.resolve(repoRoot, stopRel)
      && fs.readdirSync(abs).length === 0) {
    fs.rmdirSync(abs);
  }
}

/**
 * 디렉터리 아래 파일의 저장소 상대 POSIX 경로를 모은다.
 * lstat으로만 내려가고, 실제 디렉터리의 realpath가 blueprint 밖이면 멈춘다.
 * 디렉터리 심볼릭 링크를 따라가면 sibling·소스를 지울 수 있다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} relDir - 시작 상대 경로
 * @returns {string[]} 정렬하지 않은 파일 경로
 */
function walkFiles(repoRoot: string, relDir: string): string[] {
  const abs = path.join(repoRoot, relDir);
  const out: string[] = [];
  if (!fs.existsSync(abs)) return out;
  let bpReal: string;
  try {
    bpReal = fs.realpathSync(abs);
  } catch (_error) {
    return out;
  }
  const visit = (dirRel: string) => {
    const dirAbs = path.join(repoRoot, dirRel);
    let dirLstat;
    try {
      dirLstat = fs.lstatSync(dirAbs);
    } catch (_error) {
      return;
    }
    if (dirLstat.isSymbolicLink() || !dirLstat.isDirectory()) return;
    let dirReal: string;
    try {
      dirReal = fs.realpathSync(dirAbs);
    } catch (_error) {
      return;
    }
    if (!isInsideDir(dirReal, bpReal)) return;
    for (const name of fs.readdirSync(dirAbs)) {
      const childRel = toPosix(path.posix.join(dirRel, name));
      const childAbs = path.join(repoRoot, childRel);
      let childLstat;
      try {
        childLstat = fs.lstatSync(childAbs);
      } catch (_error) {
        continue;
      }
      if (childLstat.isSymbolicLink()) {
        // 링크 노드만 목록에 넣고 대상 디렉터리로는 들어가지 않는다.
        out.push(childRel);
        continue;
      }
      if (childLstat.isDirectory()) visit(childRel);
      else out.push(childRel);
    }
  };
  visit(relDir);
  return out;
}

/**
 * 배열을 POSIX 경로 정렬·중복 제거한다. 세 갈래(bp 정리·manifest)가 같은
 * 경로를 두 번 넣어도 payload가 집합처럼 보이게 하려는 계약이다.
 *
 * @param {string[]} values - 경로 목록
 * @returns {string[]} 정렬된 고유 경로
 */
function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

/**
 * 메인 checkout에서 닫힌 blueprint 계획 사본을 정리한다.
 * 거절은 파일을 바꾸기 전에 JSON으로만 돌아간다. 원장은 읽기만 하고,
 * fence(`--ledger-path`/`--ledger-hash`)는 요구하지 않는다.
 *
 * @param {object} opts - 메인 checkout과 대상 blueprint
 * @param {string} opts.repoRoot - `--repo` 또는 cwd로 고른 저장소 루트
 * @param {string} opts.cwd - 실제 프로세스 cwd. repoRoot와 함께 메인 루트여야 한다
 * @param {string} opts.blueprintDir - 정규형 blueprint 상대 경로
 * @param {object} [opts.deps] - 테스트 seam. 생략하면 runtime/ledger/next/git 기본값
 * @returns {ReleaseMainResult} 성공 payload 또는 `{ ok: false, reason }`
 */
function releaseMain({ repoRoot, cwd, blueprintDir, deps }: {
  repoRoot: string;
  cwd: string;
  blueprintDir: string;
  deps?: Partial<ReleaseMainDeps>;
}): ReleaseMainResult {
  const gitDefault = (args: string[]): string => execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as string;
  const d: ReleaseMainDeps = {
    runtimePaths,
    readCoordinatorLedger,
    nextBlueprint,
    worktreePathFor,
    git: gitDefault,
    ...deps,
  };

  // 1. 메인 루트 판정 — 자리부터 틀리면 원장·파일을 읽지 않는다.
  const runtime = d.runtimePaths({ repoRoot });
  let mainRoot: string;
  try {
    if (runtime.unavailable || typeof runtime.projectRoot !== 'string' || !runtime.projectRoot) {
      return { ok: false, reason: 'release-main-requires-main-checkout' };
    }
    mainRoot = fs.realpathSync(runtime.projectRoot);
    if (fs.realpathSync(repoRoot) !== mainRoot || fs.realpathSync(cwd) !== mainRoot) {
      return { ok: false, reason: 'release-main-requires-main-checkout' };
    }
  } catch (_error) {
    // realpath 실패는 "이 cwd를 메인으로 쓸 수 없다"와 같다. 다른 reason으로
    // 접으면 호출자가 checkout을 고치기 전에 원장을 의심한다.
    return { ok: false, reason: 'release-main-requires-main-checkout' };
  }

  // 2. 경로 정규형. 통과한 값만 이후 파일 연산의 접두로 쓴다.
  const bp = toPosix(blueprintDir);
  if (!isCanonicalBlueprintPath(bp)) {
    return { ok: false, reason: 'invalid-blueprint-path' };
  }

  const root = fs.realpathSync(repoRoot);
  const git = (args: string[]): string => d.git === gitDefault
    ? execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }) as string
    : d.git(args);

  const existsInHead = (rel: string): boolean => {
    try {
      git(['cat-file', '-e', `HEAD:${rel}`]);
      return true;
    } catch (error) {
      // HEAD에 경로가 없는 경우만 false. 그 밖의 throw를 접으면 tracked를 지운다.
      if (isExpectedGitMiss(error)) return false;
      throw error;
    }
  };

  const readHead = (rel: string): Buffer | null => {
    try {
      // utf8로 디코드하면 비UTF-8 blob이 U+FFFD로 바뀌어 HEAD와 작업 트리
      // 바이트가 같아도 dirty로 오인한다. seed-worktree realGit.readHead와 같이
      // encoding 없이 Buffer를 받는다. deps.git seam은 문자열만 돌려주므로
      // 기본 git일 때만 이 경로를 쓴다.
      if (d.git !== gitDefault) {
        return Buffer.from(git(['cat-file', '--filters', `HEAD:${rel}`]), 'utf8');
      }
      return execFileSync('git', ['cat-file', '--filters', `HEAD:${rel}`], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      }) as Buffer;
    } catch (error) {
      if (isExpectedGitMiss(error)) return null;
      throw error;
    }
  };

  const inIndex = (rel: string): boolean => {
    try {
      return git(['ls-files', '--', rel]).split('\n').filter(Boolean).length > 0;
    } catch (error) {
      if (isExpectedGitMiss(error)) return false;
      throw error;
    }
  };

  const headTrackedUnderBp = (): string[] => {
    try {
      return git(['ls-tree', '-r', '--name-only', 'HEAD', '--', bp])
        .split('\n').filter(Boolean).map((line) => toPosix(line.trim()));
    } catch (error) {
      if (isExpectedGitMiss(error)) return [];
      throw error;
    }
  };

  // 3. 원장. unreadable만 거절이고, 나머지 부재 코드는 "원장 없음"으로 본다.
  const ledgerRead = d.readCoordinatorLedger({ repoRoot: root, blueprint: bp });
  if (!ledgerRead.ok && ledgerRead.reason === 'unreadable-ledger') {
    return { ok: false, reason: 'coordinator-ledger' };
  }
  const hasLedger = ledgerRead.ok === true;
  if (hasLedger) {
    const ledger = ledgerRead.ledger;
    const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
    if (ledger.status === 'awaiting_confirmation' || ledger.status === 'partial_closed'
        || tasks.some((entry) => entry.status !== 'integrated')) {
      return { ok: false, reason: 'drive-not-closed' };
    }
  }

  const bpAbs = path.join(root, bp);
  const bpPresent = fs.existsSync(bpAbs);
  // 4. 닫힘 근거. 원장·디렉터리 둘 다 없으면 worktree 제거 뒤 재실행이므로
  // 닫힘을 묻지 않고 빈 정리로 성공한다.
  if (!hasLedger && !bpPresent) {
    return successPayload({ repoRoot: root, bp, removed: [], restored: [], preserved: [], deps: d });
  }
  let closed = false;
  if (hasLedger) {
    closed = readBouncerStatus(path.join(ledgerRead.integrationPath, bp, 'index.md')) === 'closed';
  } else {
    // 초기 null은 항상 try/catch에서 덮이므로 선언만 한다(no-useless-assignment).
    let soloStatus: string | null;
    try {
      const solo = d.worktreePathFor({ repoRoot: root, blueprint: bp });
      soloStatus = readBouncerStatus(path.join(solo, bp, 'index.md'));
    } catch (_error) {
      // GIT_REQUIRED·id 파싱 실패는 단독 worktree가 없다는 뜻. HEAD 근거로 넘긴다.
      soloStatus = null;
    }
    if (soloStatus !== null) {
      closed = soloStatus === 'closed';
    } else {
      const headRaw = readHead(`${bp}/index.md`);
      if (headRaw) {
        try {
          const data = parseFrontmatter(headRaw.toString('utf8')).data;
          const bouncer = data && typeof data === 'object'
            ? (data as Record<string, unknown>).bouncer : null;
          const status = bouncer && typeof bouncer === 'object'
            ? (bouncer as Record<string, unknown>).status : null;
          closed = status === 'closed';
        } catch (_error) {
          closed = false;
        }
      }
    }
  }
  if (!closed) return { ok: false, reason: 'blueprint-not-closed' };

  // 5. 판정을 먼저 모은 뒤에만 메인 쓰기다. git 예외를 지우는 쪽으로
  // 접으면 tracked가 사라지고, 쓰던 중에 throw하면 반만 지워진다.
  const removed: string[] = [];
  const restored: string[] = [];
  const preserved: string[] = [];
  const stopRel = path.posix.dirname(bp);
  type FileAction =
    | { kind: 'skip' }
    | { kind: 'restore'; rel: string }
    | { kind: 'remove'; rel: string; unstage: boolean };
  let actions: FileAction[];
  try {
    const seen = new Set<string>();
    actions = [];
    for (const rel of walkFiles(root, bp)) {
      seen.add(rel);
      if (existsInHead(rel)) {
        const current = fs.readFileSync(path.join(root, rel));
        const head = readHead(rel);
        if (head && current.equals(head)) actions.push({ kind: 'skip' });
        else actions.push({ kind: 'restore', rel });
      } else {
        actions.push({ kind: 'remove', rel, unstage: inIndex(rel) });
      }
    }
    for (const rel of headTrackedUnderBp()) {
      if (seen.has(rel)) continue;
      // 작업 트리에서 지워진 tracked는 walkFiles에 없다. HEAD로 되돌린다.
      actions.push({ kind: 'restore', rel });
    }
  } catch (_error) {
    // 예상 miss가 아닌 git·읽기 실패. 파일을 바꾸지 않고 JSON으로만 거절한다.
    return { ok: false, reason: 'blueprint-not-closed' };
  }
  for (const action of actions) {
    if (action.kind === 'skip') continue;
    if (action.kind === 'restore') {
      git(['checkout', 'HEAD', '--', action.rel]);
      restored.push(action.rel);
      continue;
    }
    if (action.unstage) git(['rm', '--cached', '--quiet', '--', action.rel]);
    const abs = path.join(root, action.rel);
    let st;
    try {
      st = fs.lstatSync(abs);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        removed.push(action.rel);
        continue;
      }
      throw error;
    }
    // recursive rm은 디렉터리 심볼릭 링크 너머 sibling을 지운다. 링크면
    // unlink만 해서 노드만 없앤다.
    if (st.isSymbolicLink()) fs.unlinkSync(abs);
    else if (!st.isDirectory()) fs.rmSync(abs, { force: true });
    pruneEmptyDirs(root, action.rel, stopRel);
    removed.push(action.rel);
  }
  sweepEmptyDirs(root, bp, stopRel);

  const epicIndex = `${epicDirOf(bp)}/index.md`;
  const contextIndex = `${CONTEXT_ROOT}/index.md`;
  if (hasLedger) {
    const manifest = ledgerRead.ledger.seedManifest;
    if (!Array.isArray(manifest)) {
      // 항목을 고를 해시가 없으면 두 index를 손대지 않는다. 지우는 쪽이
      // 기본이면 epic 목록이 메인에서 사라진다.
      preserved.push(contextIndex, epicIndex);
    } else {
      const wanted = new Set([epicIndex, contextIndex]);
      const picked = manifest.filter((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const rel = toPosix((entry as { path?: unknown }).path);
        return wanted.has(rel);
      });
      const judged = releaseSeedManifest({
        repoRoot: root, blueprintDir: bp, manifest: picked as unknown[],
      });
      removed.push(...judged.released);
      restored.push(...judged.restored);
      preserved.push(...judged.preserved);
    }
  }

  return successPayload({
    repoRoot: root, bp,
    removed: sortedUnique(removed),
    restored: sortedUnique(restored),
    preserved: sortedUnique(preserved),
    deps: d,
  });
}

/**
 * 정리 뒤 메인 checkout을 기준으로 같은 epic의 다음 ready blueprint를 고른다.
 * nextBlueprint의 1순위가 다른 epic이면 remaining에서 같은 epic을 찾는다 —
 * finalize --yes가 integration만 보던 구멍을 메우기 위한 값이다.
 *
 * @param {object} opts - 정리 결과와 next 조회
 * @param {string} opts.repoRoot - 메인 루트
 * @param {string} opts.bp - 방금 정리한 blueprint
 * @param {string[]} opts.removed - 지운 경로
 * @param {string[]} opts.restored - HEAD로 되돌린 경로
 * @param {string[]} opts.preserved - 손대지 않은 index 경로
 * @param {ReleaseMainDeps} opts.deps - nextBlueprint seam
 * @returns {ReleaseMainOk} 정렬된 경로와 next
 */
function successPayload({ repoRoot, bp, removed, restored, preserved, deps }: {
  repoRoot: string;
  bp: string;
  removed: string[];
  restored: string[];
  preserved: string[];
  deps: ReleaseMainDeps;
}): ReleaseMainOk {
  const listed = deps.nextBlueprint({ repoRoot, blueprintDir: bp });
  const chain: Array<{ blueprint: string; sameEpic?: boolean }> = [];
  if (listed.next) chain.push(listed.next);
  if (Array.isArray(listed.remaining)) chain.push(...listed.remaining);
  const same = chain.find((entry) => entry.sameEpic);
  return {
    ok: true,
    blueprint: bp,
    removed,
    restored,
    preserved,
    next: same ? { blueprint: same.blueprint } : null,
  };
}

export = { releaseMain };
