'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync: realExecFileSync } = require('node:child_process');
import paths = require('./paths');
const { toPosix, parsePathIds } = paths;

const GIT_REQUIRED = 'Bouncer requires a Git repository for an active blueprint';

// 테스트 fake는 argv를 무시하고 문자열만 돌려주기도 한다. 최소 호출 형태만
// 고정하고, Node 오버로드 전체를 끌어오면 주입 객체가 할당되지 않는다.
type ExecFileSyncFn = (
  file: string,
  args?: readonly string[],
  options?: { cwd?: unknown; encoding?: unknown; stdio?: unknown },
) => string | Buffer;

type InjectedFs = {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string, encoding: string) => string;
  writeFileSync: (p: string, data: string) => void;
  mkdirSync: (p: string, opts?: { recursive?: boolean }) => unknown;
  rmSync: (p: string) => void;
  statSync: (p: string) => { isDirectory: () => boolean };
};

type RuntimeDeps = {
  execFileSync?: ExecFileSyncFn;
  fs?: InjectedFs;
  env?: NodeJS.ProcessEnv;
  platform?: string;
};

// 판별 유니온으로 두면 emit tsc(strict:false)도 currentFile 접근을 거절한다.
// unavailable이면 바로 return하므로 단언은 죽은 경로만 달래고 런타임은 같다.
type RuntimePaths = {
  unavailable?: boolean;
  reason?: string;
  commonGitDir?: string;
  currentFile?: string;
  worktreeRoot?: string;
  projectRoot?: string;
  ledgerFile?: string;
};

type RuntimePointer = {
  blueprint: string;
  base: string;
  task: string | null;
};

function catchMessage(error: unknown): unknown {
  // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
  // TypeError 대신 undefined가 되어 unavailable reason이 바뀐다.
  return (error as { message: unknown }).message;
}

function runtimePaths({
  repoRoot,
  execFileSync = realExecFileSync as ExecFileSyncFn,
  // env/platform은 호출부 호환용; worktree는 이제 repo 내부.
  platform = process.platform,
}: {
  repoRoot: string;
  execFileSync?: ExecFileSyncFn;
  env?: NodeJS.ProcessEnv;
  platform?: string;
}): RuntimePaths {
  const pathApi = platform === 'win32' ? path.win32 : path;
  let commonDir: string;
  try {
    // encoding utf8이라 런타임은 문자열이다. Node 오버로드 유니온이 trim을 막아
    // 단언만 한다 — String()으로 감싸면 Buffer 경로의 표현이 달라진다.
    commonDir = (execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }) as string).trim();
  } catch (error) {
    return { unavailable: true, reason: catchMessage(error) as string || 'Git common directory unavailable' };
  }
  if (!commonDir) {
    return { unavailable: true, reason: 'Git common directory unavailable' };
  }

  const commonGitDir = pathApi.resolve(repoRoot, commonDir);
  // dirname(.git)은 일반 repo의 main worktree root이므로, linked checkout이
  // 자기 아래에 중첩되지 않고 같은 `.worktrees/`를 공유한다.
  // projectRoot는 그 값을 Distill/스킬 소비용으로 노출한다 — Git 계산을
  // 스킬이나 별도 helper에서 복제하지 않기 위한 단일 정본.
  const mainRoot = pathApi.dirname(commonGitDir);
  return {
    commonGitDir,
    currentFile: pathApi.join(commonGitDir, 'bouncer', 'current'),
    worktreeRoot: pathApi.join(mainRoot, '.worktrees'),
    projectRoot: mainRoot,
  };
}

function resolvedPaths({ repoRoot, deps }: {
  repoRoot: string;
  deps?: RuntimeDeps | null;
}): RuntimePaths {
  const d = deps || {};
  return runtimePaths({
    repoRoot,
    execFileSync: d.execFileSync,
    env: d.env,
    platform: d.platform,
  });
}

function readRuntimeCurrent({ repoRoot, deps }: {
  repoRoot: string;
  deps?: RuntimeDeps | null;
}): RuntimePointer | null {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable || !d.fs.existsSync(paths.currentFile as string)) return null;
  try {
    const data = JSON.parse(d.fs.readFileSync(paths.currentFile as string, 'utf8').trim());
    if (!data || typeof data.blueprint !== 'string' || typeof data.base !== 'string') return null;
    // task 키 부재·비문자열은 미지정. 마이그레이션 없이 기존 파일을 그대로 읽는다.
    const task = typeof data.task === 'string' ? toPosix(data.task) : null;
    return { blueprint: toPosix(data.blueprint), base: data.base, task };
  } catch (_error) {
    return null;
  }
}

// pointer가 제거되면 true, 없었으면 false. 호출자는 "이미 없음"을
// 성공으로 보므로, 파일이 없어도 throw하면 안 된다.
function clearRuntimeCurrent({ repoRoot, deps }: {
  repoRoot: string;
  deps?: RuntimeDeps | null;
}): boolean {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable || !d.fs.existsSync(paths.currentFile as string)) return false;
  d.fs.rmSync(paths.currentFile as string);
  return true;
}

function writeRuntimeCurrent({
  repoRoot, blueprint, base, task, deps,
}: {
  repoRoot: string;
  blueprint: unknown;
  base: string;
  task?: unknown;
  deps?: RuntimeDeps | null;
}): string {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable) throw new Error(GIT_REQUIRED);
  d.fs.mkdirSync(path.dirname(paths.currentFile as string), { recursive: true });
  // task는 문자열일 때만 파일에 쓴다 — 없으면 키 자체를 생략해 레거시 형태를 유지.
  const data: { blueprint: string; base: string; task?: string } = {
    blueprint: toPosix(blueprint),
    base,
  };
  if (typeof task === 'string') data.task = toPosix(task);
  d.fs.writeFileSync(paths.currentFile as string, `${JSON.stringify(data, null, 2)}\n`);
  return paths.currentFile as string;
}

// blueprint 경로만으로 execute worktree 절대 경로를 고른다.
// 기본은 `.worktrees/<epic>/<bp>`이고, 중첩이 없는데 평면 `.worktrees/<bp>`만
// 있으면 그 평면을 재사용한다(옮기지 않음). mkdir은 하지 않는다 —
// `git worktree add`가 부모 디렉터리까지 만든다.
function worktreePathFor({ repoRoot, blueprint, deps }: {
  repoRoot: string;
  blueprint: unknown;
  deps?: RuntimeDeps | null;
}): string {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable) throw new Error(GIT_REQUIRED);

  const { epicId, blueprintId } = parsePathIds(blueprint);
  // 구형 EPIC-/BP- 접두는 parsePathIds가 흡수하지 않는다 — 숫자 id 경로만 유효.
  if (!epicId || !blueprintId) {
    throw new Error(`Cannot derive epic/blueprint ids from blueprint path: ${blueprint}`);
  }

  const platform = d.platform || process.platform;
  const pathApi = platform === 'win32' ? path.win32 : path;
  const nested = pathApi.join(paths.worktreeRoot as string, epicId, blueprintId);
  const flat = pathApi.join(paths.worktreeRoot as string, blueprintId);

  // 중첩이 디렉터리로 없고 평면만 디렉터리면 레거시 평면. 둘 다 있으면 중첩 우선.
  const nestedIsDir = (() => {
    try { return d.fs.statSync(nested).isDirectory(); } catch (_e) { return false; }
  })();
  const flatIsDir = (() => {
    try { return d.fs.statSync(flat).isDirectory(); } catch (_e) { return false; }
  })();
  if (!nestedIsDir && flatIsDir) return flat;
  return nested;
}

function verifyLedgerPathFor({ repoRoot, verificationRel, deps }: {
  repoRoot: string;
  verificationRel: unknown;
  deps?: RuntimeDeps | null;
}): RuntimePaths {
  const paths = resolvedPaths({ repoRoot, deps });
  if (paths.unavailable) {
    return { unavailable: true, reason: paths.reason };
  }
  const d = deps || {};
  const platform = d.platform || process.platform;
  const pathApi = platform === 'win32' ? path.win32 : path;
  // 원장은 current 포인터와 같이 common dir 아래에 둔다. linked worktree가
  // 같은 레코드를 보게 하고, `.git/` 안이라 커밋 스코프에 절대 안 실린다.
  // 파일명은 상대경로 sha256의 앞 16자면 충돌을 피하면서 경로 문자(슬래시)를
  // 파일 이름에 넣지 않는다.
  const digest = createHash('sha256').update(toPosix(verificationRel), 'utf8').digest('hex').slice(0, 16);
  return {
    ...paths,
    ledgerFile: pathApi.join(paths.commonGitDir as string, 'bouncer', 'verify', `${digest}.json`),
  };
}

/**
 * porcelain 출력이 비어 있지 않으면 dirty. git 실패도 dirty로 본다 —
 * migrate task-layout·import-history가 부분 쓰기를 남기지 않게 apply를 막기 위함.
 */
function isWorktreeDirty(
  repoRoot: string,
  execFileSync: ExecFileSyncFn = realExecFileSync as ExecFileSyncFn,
): boolean {
  try {
    const out = execFileSync('git', ['status', '--porcelain'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return String(out).trim().length > 0;
  } catch (_e) {
    return true;
  }
}

export = {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent, worktreePathFor,
  verifyLedgerPathFor, isWorktreeDirty,
};
