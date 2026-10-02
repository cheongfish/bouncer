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
  } catch (error) {
    // 아직 없는 사본은 닫힘 근거가 아니다. 권한 오류는 그대로 올려 숨기지 않는다.
    if ((error as { code?: string }).code === 'ENOENT') return null;
    throw error;
  }
  try {
    const data = parseFrontmatter(source).data;
    const bouncer = data && typeof data === 'object'
      ? (data as Record<string, unknown>).bouncer : null;
    if (!bouncer || typeof bouncer !== 'object') return null;
    const status = (bouncer as Record<string, unknown>).status;
    return typeof status === 'string' ? status : null;
  } catch (error) {
    // 닫힘 판정은 status: closed만 인정한다. 깨진 문서를 throw하면 거절 JSON이
    // 아니라 프로세스 실패가 되어 CLI 계약을 깬다.
    if ((error as Error).message === 'missing frontmatter block') return null;
    if ((error as Error).name === 'YAMLException') return null;
    throw error;
  }
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
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} relDir - 시작 상대 경로
 * @returns {string[]} 정렬하지 않은 파일 경로
 */
function walkFiles(repoRoot: string, relDir: string): string[] {
  const abs = path.join(repoRoot, relDir);
  const out: string[] = [];
  if (!fs.existsSync(abs)) return out;
  const visit = (dirRel: string) => {
    const dirAbs = path.join(repoRoot, dirRel);
    for (const name of fs.readdirSync(dirAbs)) {
      const childRel = toPosix(path.posix.join(dirRel, name));
      const childAbs = path.join(repoRoot, childRel);
      if (fs.statSync(childAbs).isDirectory()) visit(childRel);
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
    } catch (_error) {
      // HEAD에 없는 경로는 새 계획 사본에서 흔하다. 그 밖의 git 실패도
      // "추적 파일 아님"으로 접으면 tracked를 지울 수 있어, cat-file -e만 본다.
      return false;
    }
  };

  const readHead = (rel: string): Buffer | null => {
    try {
      return Buffer.from(git(['cat-file', '--filters', `HEAD:${rel}`]), 'utf8');
    } catch (_error) {
      return null;
    }
  };

  const inIndex = (rel: string): boolean => {
    try {
      return git(['ls-files', '--', rel]).split('\n').filter(Boolean).length > 0;
    } catch (_error) {
      return false;
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
    let soloStatus: string | null = null;
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

  // 5. 이 지점부터만 메인 쓰기다. 위 거절은 파일·index·원장을 바꾸지 않는다.
  const removed: string[] = [];
  const restored: string[] = [];
  const preserved: string[] = [];
  const stopRel = path.posix.dirname(bp);
  for (const rel of walkFiles(root, bp)) {
    if (existsInHead(rel)) {
      const current = fs.readFileSync(path.join(root, rel));
      const head = readHead(rel);
      if (head && current.equals(head)) continue;
      git(['checkout', 'HEAD', '--', rel]);
      restored.push(rel);
    } else {
      if (inIndex(rel)) git(['rm', '--cached', '--quiet', '--', rel]);
      fs.rmSync(path.join(root, rel), { force: true });
      pruneEmptyDirs(root, rel, stopRel);
      removed.push(rel);
    }
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
