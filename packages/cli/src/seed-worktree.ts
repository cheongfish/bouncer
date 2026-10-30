// scripts/lib/seed-worktree.js
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
import paths = require('./paths');
const { epicDirOf, toPosix } = paths;
import layout = require('./layout');
const { CONTEXT_ROOT } = layout;
import scope = require('./scope');
const { isUnder } = scope;
import configMod = require('./config');
const { readConfig, readWorktreeSetup, getVerifyAllowlist } = configMod;
import windowsNpm = require('./windows-npm');
const { resolveSpawn } = windowsNpm;
import commandArgv = require('./command-argv');
const { parseVerifyArgv, isValidVerifyCommand } = commandArgv;

type SeedGit = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  existsInHead: (file: string) => boolean;
  readHead: (file: string) => Buffer | null;
  restore: (file: string) => void;
  unstage: (file: string) => void;
};

type PendingWrite = { rel: string; write: true; dst: string; content: Buffer; absent?: boolean };
type PendingSkip = { rel: string; write: false; absent?: boolean };
type Pending = PendingWrite | PendingSkip;
type SeedDeps = { execFileSync?: typeof execFileSync; mainCheckout?: string };
// 공유 설치 판단 입력. affectedPaths는 승인된 task의 affected_paths이며, 이 값이 없으면
// 해당 호출은 공유를 시도하지 않고 독립 설치 경로만 탄다.
type DependencyShare = { affectedPaths: readonly string[] };
type ConfigSeedStatus = 'copied' | 'preserved' | 'missing';

// plan target이 아니라 별도 복사 단계의 경로. makeIsTarget에 넣으면
// phase 2가 base config를 restore하거나 지운다.
const CONFIG_REL = '.bouncer/config.json';

// npm이 남기는 marker(`.package-lock.json`)는 lockfile이 바뀌어도 그대로 남으므로
// "어떤 lockfile로 설치했는지"를 알려주지 못한다. 설치 성공 뒤 lockfile 해시를
// 이 stamp에 남겨 두 값을 비교한다.
const LOCK_STAMP_REL = path.join('node_modules', '.bouncer-lock-sha256');

// git worktree는 ignored 로컬 환경을 가져오지 않는다. Python 가상환경과 `.env`는
// npm처럼 lockfile로 다시 만들 수 없으므로, main checkout의 것을 symlink로 공유한다.
const LOCAL_ENV_LINKS = ['.venv', '.env'];

/**
 * worktreePath가 속한 저장소의 main checkout 경로를 찾는다.
 * `git worktree list --porcelain`의 첫 항목이 main worktree다.
 *
 * @param {string} worktreePath - 조회 cwd
 * @returns {string | null} main checkout 절대 경로. git 저장소가 아니면 null
 */
function mainCheckoutOf(worktreePath: string): string | null {
  try {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: worktreePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }) as string;
    const first = out.split('\n').find((line) => line.startsWith('worktree '));
    return first ? first.slice('worktree '.length) : null;
  } catch {
    return null;
  }
}

/**
 * worktree에서 `git check-ignore -q`가 pathspec을 무시하면 true.
 * check-ignore는 ignored면 0, 아니면 1(throw)로 끝난다.
 *
 * @param {string} worktreePath - 조회 cwd
 * @param {string} pathspec - check-ignore에 넘길 경로(또는 `rel/`)
 * @returns {boolean} ignored 여부
 */
function checkIgnoreQuiet(worktreePath: string, pathspec: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', pathspec], {
      cwd: worktreePath, stdio: 'ignore',
    });
    return true;
  } catch (error) {
    // exit 1만 "ignored 아님". 128 같은 git 치명 오류를 not-ignored로 접으면
    // 건너뜀 사유가 틀리므로 호출자가 구분하도록 다시 던진다.
    if ((error as { status?: number }).status === 1) return false;
    throw error;
  }
}

/**
 * 링크한 로컬 환경 경로를 공통 `info/exclude`에 `/<rel>`로 한 줄 추가한다.
 * symlink는 디렉터리가 아니라서 `.venv/` 같은 패턴에 걸리지 않고 `??`로 새므로,
 * 저장소 공유 exclude에 루트 고정 항목을 넣어 status를 깨끗이 유지한다.
 * 이미 같은 줄이 있으면 쓰지 않는다.
 *
 * @param {string} worktreePath - `git rev-parse --git-path` cwd
 * @param {string} rel - LOCAL_ENV_LINKS 항목(예: `.venv`)
 */
function ensureLocalEnvExclude(worktreePath: string, rel: string): void {
  let excludeRel: string;
  try {
    excludeRel = (execFileSync('git', ['rev-parse', '--git-path', 'info/exclude'], {
      cwd: worktreePath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }) as string).trim();
  } catch {
    // exclude 경로를 못 얻으면 status 오염만 감수한다. 링크 자체는 이미 성공했다.
    return;
  }
  const excludePath = path.isAbsolute(excludeRel)
    ? excludeRel
    : path.join(worktreePath, excludeRel);
  const entry = `/${rel}`;
  let body = '';
  try {
    body = fs.readFileSync(excludePath, 'utf8');
  } catch (error) {
    // 없는 파일만 새로 만든다. 권한 오류는 숨기지 않는다.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    fs.mkdirSync(path.dirname(excludePath), { recursive: true });
  }
  if (body.split(/\r?\n/).includes(entry)) return;
  const prefix = body.length > 0 && !body.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(excludePath, `${prefix}${entry}\n`);
}

/**
 * main checkout의 ignored 로컬 환경(LOCAL_ENV_LINKS)을 worktree에 symlink한다.
 * 상대경로 `.venv/bin/pytest` 같은 검증 명령과 `.env`를 읽는 설정 로딩이
 * worker·fan-in candidate·integration checkout에서도 main과 같게 돌게 한다.
 * main에 없거나, worktree에 이미 있거나(깨진 symlink 포함), worktree에서 ignored가
 * 아닌 경로는 건너뛴다 — 추적 파일을 가리지 않기 위해서다. main checkout 자신이면
 * 아무것도 하지 않는다. `.gitignore`의 `.venv/`처럼 디렉터리 전용 패턴은 아직 없는
 * `rel`에 check-ignore가 실패하므로, main 원본이 디렉터리면 `rel/`로도 확인한다.
 * 링크 뒤에는 symlink가 status에 새지 않도록 `info/exclude`에 `/<rel>`을 한 번만 넣고,
 * ignored가 아니거나 링크에 실패한 건너뜀은 stderr에 한 줄로 남긴다(조용한 검증 실패 방지).
 *
 * @param {string} worktreePath - 링크를 만들 worktree 절대 경로
 * @returns {string[]} 새로 만든 링크의 저장소 상대 경로
 */
function linkLocalEnv(worktreePath: string): string[] {
  const main = mainCheckoutOf(worktreePath);
  if (!main) return [];
  try {
    if (fs.realpathSync(main) === fs.realpathSync(worktreePath)) return [];
  } catch {
    return [];
  }
  const linked: string[] = [];
  for (const rel of LOCAL_ENV_LINKS) {
    const src = path.join(main, rel);
    const dst = path.join(worktreePath, rel);
    if (!fs.existsSync(src)) continue;
    try {
      fs.lstatSync(dst);
      continue;
    } catch {
      // ENOENT면 아직 없는 경로라 링크 대상이다.
    }
    // 초기값은 try/catch에서 항상 덮이거나 continue로 버려지므로 선언만 한다(no-useless-assignment).
    let srcIsDir: boolean;
    try {
      srcIsDir = fs.statSync(src).isDirectory();
    } catch {
      continue;
    }
    // 1. 일반 pathspec. 2. 디렉터리 원본이면 trailing-slash 패턴용 `rel/` 재시도.
    let ignored: boolean;
    try {
      ignored = checkIgnoreQuiet(worktreePath, rel)
        || (srcIsDir && checkIgnoreQuiet(worktreePath, `${rel}/`));
    } catch (error) {
      process.stderr.write(
        `linkLocalEnv: skip ${rel} (check-ignore failed: ${(error as { message?: string }).message || error})\n`,
      );
      continue;
    }
    if (!ignored) {
      process.stderr.write(`linkLocalEnv: skip ${rel} (not ignored in worktree)\n`);
      continue;
    }
    try {
      fs.symlinkSync(src, dst);
    } catch (error) {
      // 링크는 편의 장치라 실패를 흡수하되, 사유를 남겨 검증 exit 1이 묻히지 않게 한다.
      process.stderr.write(
        `linkLocalEnv: skip ${rel} (symlink failed: ${(error as { message?: string }).message || error})\n`,
      );
      continue;
    }
    // exclude는 status 정리용이다. 링크는 이미 성공했으므로 쓰기가 실패해도
    // 반환에 넣고, 사유만 exclude 실패로 구분해 symlink 실패와 섞지 않는다.
    try {
      ensureLocalEnvExclude(worktreePath, rel);
    } catch (error) {
      process.stderr.write(
        `linkLocalEnv: exclude ${rel} failed: ${(error as { message?: string }).message || error}\n`,
      );
    }
    linked.push(rel);
  }
  return linked;
}

/**
 * root package.json의 직접 패키지(dependencies·devDependencies) 중 설치 metadata
 * (`node_modules/<name>/package.json`)가 없는 이름을 돌려준다. optionalDependencies는
 * 플랫폼에 따라 정상적으로 빠질 수 있어 요구하지 않는다. transitive 완전성은 보장하지 않는다.
 * package.json이 없거나 읽을 수 없거나 JSON이 아니거나 workspaces를 선언하면 이 검사를
 * 적용할 수 없으므로 null을 돌려준다 — 호출자는 현행 경로를 유지한다(추측으로 막지 않는다).
 *
 * @param {string} root - package.json과 node_modules가 있는 디렉터리
 * @returns {string[] | null} 누락 패키지 이름들(없으면 []). 적용 불가는 null
 */
function missingDirectDependencies(root: string): string[] | null {
  let manifest: { dependencies?: unknown; devDependencies?: unknown; workspaces?: unknown };
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    // 파일 없음·읽기 실패·깨진 JSON은 모두 "검사 불가"다. 여기서 막으면 npm을 쓰지
    // 않거나 manifest가 없는 저장소의 검증까지 멈추므로 적용 대상에서 뺀다.
    return null;
  }
  if (typeof manifest !== 'object' || manifest === null || manifest.workspaces !== undefined) return null;
  const names = new Set<string>();
  for (const table of [manifest.dependencies, manifest.devDependencies]) {
    if (typeof table === 'object' && table !== null) for (const name of Object.keys(table)) names.add(name);
  }
  return [...names].filter((name) => !fs.existsSync(path.join(root, 'node_modules', name, 'package.json')));
}

/** root package-lock.json bytes의 sha256. 읽을 수 없으면 null이다. */
function lockHashOf(root: string): string | null {
  try {
    return createHash('sha256').update(fs.readFileSync(path.join(root, 'package-lock.json'))).digest('hex');
  } catch {
    // lockfile 없음·읽기 실패는 "비교 불가"이며 공유 불가로 이어질 뿐 오류가 아니다.
    return null;
  }
}

/** 승인 scope가 의존성 manifest/lock을 바꿀 수 있으면 true. 루트 전체를 가리키는 경로도 포함한다. */
function scopeChangesDependencies(affectedPaths: readonly string[]): boolean {
  return affectedPaths.some((entry) => {
    const rel = toPosix(entry).replace(/^\.\//, '').replace(/\/+$/, '');
    if (rel === '' || rel === '.') return true;
    return ['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].includes(path.posix.basename(rel));
  });
}

/**
 * main checkout의 node_modules를 이 worktree가 안전하게 공유할 수 있는지 판단한다.
 * 모두 만족해야 true다: worktree가 main 자신이 아님, 승인 scope가 manifest/lock을 바꾸지
 * 않음, root lockfile bytes hash가 main과 같음, main에 npm marker와 같은 hash의 stamp가
 * 있음, main에 직접 패키지 metadata가 모두 있음. 하나라도 어긋나면 false이며 그 경우
 * 호출자는 worktree에 독립 설치한다. 읽기만 하고 아무것도 쓰지 않는다.
 *
 * @param {string} worktreePath - 공유 대상 worktree
 * @param {string} mainRoot - main checkout
 * @param {DependencyShare} share - 승인 task scope
 * @returns {boolean} 공유 가능 여부
 */
function canShareMainDependencies(worktreePath: string, mainRoot: string, share: DependencyShare): boolean {
  if (scopeChangesDependencies(share.affectedPaths)) return false;
  try {
    if (fs.realpathSync(mainRoot) === fs.realpathSync(worktreePath)) return false;
  } catch {
    // 경로를 해석할 수 없으면 main과의 관계를 알 수 없으므로 공유하지 않는다.
    return false;
  }
  const lockHash = lockHashOf(worktreePath);
  if (lockHash === null || lockHash !== lockHashOf(mainRoot)) return false;
  if (!fs.existsSync(path.join(mainRoot, 'node_modules', '.package-lock.json'))) return false;
  let mainStamp: string;
  try {
    mainStamp = fs.readFileSync(path.join(mainRoot, LOCK_STAMP_REL), 'utf8').trim();
  } catch {
    // stamp를 읽을 수 없으면 main이 이 lock으로 설치됐다는 증거가 없으므로 공유하지 않는다.
    return false;
  }
  if (mainStamp !== lockHash) return false;
  const missing = missingDirectDependencies(mainRoot);
  return missing !== null && missing.length === 0;
}

/**
 * lockfile이 있고 npm marker와 현재 lockfile에 맞는 stamp가 모두 있을 때만 설치를 건너뛰고,
 * 그 밖에는 `npm ci --include=dev`로 의존성을 채운 뒤 lockfile sha256 stamp를 남긴다.
 * stamp를 읽을 수 없으면(errno 무관) stamp 없음으로 보고 재설치한다.
 * git worktree는 ignored `node_modules`를 가져오지 않고, 브랜치가 lockfile을 바꾸면 남은
 * marker만으로는 오래된 node_modules를 알아채지 못한다. fan-in candidate와 integration
 * checkout, finalize가 같은 계약을 타게 한다. 설치 성공 뒤 stamp 쓰기가 실패해도
 * 결과는 ok:true다(다음 호출이 stamp 부재로 재설치하므로 안전하다).
 * lockfile 확인 전에 linkLocalEnv로 main checkout의 `.venv`·`.env`를 먼저 연결한다.
 * 설치(또는 건너뜀) 뒤에는 main checkout config의 `worktree.setup` 명령을 실행한다.
 *
 * @param {string} worktreePath - 설치 cwd. package-lock.json을 이 경로에서 본다
 * @param {SeedDeps} deps - execFileSync·mainCheckout 주입. 테스트가 호출을 가로채는 용도
 * @param {DependencyShare} [share] - 생략하면 main node_modules 공유를 만들지 않는다
 * @returns {{ ok: true } | { ok: false, reason: string, message: unknown }}
 *   설치 경로와 setup 모두 성공이면 ok:true. npm ci 실패(stamp 미기록)와 setup 거절·실패는
 *   ok:false와 dependency-install-failed이며 setup 실패 message는 `worktree.setup`으로 시작한다
 */
function prepareDependencies(
  worktreePath: string,
  deps: SeedDeps,
  share?: DependencyShare,
): { ok: true } | { ok: false; reason: string; message: unknown } {
  const installed = installDependencies(worktreePath, deps, share);
  if (!installed.ok) return installed;
  // 설치 실패는 위에서 먼저 반환한다. 설치·건너뜀·lockfile 없음 어느 경로든
  // gitignore 대상 빌드 산출물은 따로 만들어야 하므로 setup은 항상 마지막에 돈다.
  return runWorktreeSetup(worktreePath, deps);
}

/**
 * config의 `worktree.setup` 명령을 worktree에서 셸 없이 한 번 실행한다.
 * config는 새 worktree가 아니라 main checkout에서 읽는다 — 이 시점에 worktree에는
 * 아직 config가 복사되지 않았다(seedConfig가 준비 뒤에 돈다). main checkout을
 * 못 찾거나 config가 없거나 키가 없으면 설정 없음으로 보고 아무것도 하지 않는다.
 * 설정이 있는데 형태·argv·허용 목록이 어긋나면 실행하지 않고 실패로 알린다.
 *
 * @param {string} worktreePath - 명령 실행 cwd
 * @param {SeedDeps} deps - execFileSync·mainCheckout 주입(테스트 seam)
 * @returns {{ ok: true } | { ok: false, reason: string, message: unknown }}
 *   미설정·실행 성공은 ok:true. 검사 거절과 실행 실패는 dependency-install-failed이며
 *   message는 `worktree.setup`으로 시작한다
 */
function runWorktreeSetup(
  worktreePath: string,
  deps: SeedDeps,
): { ok: true } | { ok: false; reason: string; message: unknown } {
  const mainRoot = deps.mainCheckout ?? mainCheckoutOf(worktreePath);
  if (!mainRoot) return { ok: true };
  // 파일 없음·깨진 JSON은 모두 null이다. 깨진 config를 여기서 막으면 setup을
  // 쓰지 않는 저장소의 준비까지 멈추므로 설정 없음과 같게 둔다.
  const config = readConfig(mainRoot);
  if (config === null) return { ok: true };
  const setup = readWorktreeSetup(config);
  if (!setup.ok) {
    return { ok: false, reason: 'dependency-install-failed', message: 'worktree.setup must be a string' };
  }
  if (setup.command === null) return { ok: true };
  if (!isValidVerifyCommand(setup.command, getVerifyAllowlist(config))) {
    return {
      ok: false,
      reason: 'dependency-install-failed',
      message: `worktree.setup is not an allowed single command: ${JSON.stringify(setup.command)}`,
    };
  }
  // isValidVerifyCommand가 통과했으므로 argv는 null이 아니다.
  const argv = parseVerifyArgv(setup.command) as string[];
  try {
    (deps.execFileSync || execFileSync)(argv[0], argv.slice(1), { cwd: worktreePath, stdio: 'inherit' });
  } catch (error) {
    return {
      ok: false,
      reason: 'dependency-install-failed',
      message: `worktree.setup failed: ${(error as { message: unknown }).message}`,
    };
  }
  return { ok: true };
}

/**
 * 의존성 설치 단계(`.venv`·`.env` 연결, npm ci, stamp). 계약은 prepareDependencies의
 * 설치 부분과 같다.
 *
 * @param {string} worktreePath - 설치 cwd
 * 공유 계약: `share`가 있고 canShareMainDependencies가 참일 때만 node_modules가 없는 worktree에
 * main의 node_modules symlink를 만든다(실제 node_modules 디렉터리는 덮어쓰지 않는다).
 * node_modules가 symlink이면 npm이 링크 너머 main을 쓰지 못하도록 링크가 여전히 공유
 * 조건을 만족하고 main의 node_modules를 가리킬 때만 그대로 두고, lock 변경·깨진 링크·
 * 알 수 없는 target이면 링크 자체만 unlink한 뒤 worktree에 독립 설치한다(target은 건드리지
 * 않는다). 링크를 풀지 못하면 npm을 실행하지 않고 dependency-install-failed를 돌려준다.
 *
 * @param {string} worktreePath - 설치 cwd
 * @param {SeedDeps} deps - execFileSync·mainCheckout 주입
 * @param {DependencyShare} [share] - 승인 task scope. 없으면 공유를 만들지 않는다
 * @returns {{ ok: true } | { ok: false, reason: string, message: unknown }}
 *   lockfile 없음·공유 유지/생성·stamp 일치·설치 성공은 ok:true, 링크 해제·npm ci 실패는 ok:false
 */
function installDependencies(
  worktreePath: string,
  deps: SeedDeps,
  share?: DependencyShare,
): { ok: true } | { ok: false; reason: string; message: unknown } {
  linkLocalEnv(worktreePath);
  const lockFile = path.join(worktreePath, 'package-lock.json');
  if (!fs.existsSync(lockFile)) return { ok: true };
  const modulesDir = path.join(worktreePath, 'node_modules');
  let modulesStat: ReturnType<typeof fs.lstatSync> | null = null;
  try {
    modulesStat = fs.lstatSync(modulesDir);
  } catch (error) {
    // 없는 경로(ENOENT)만 "아직 없음"으로 흡수한다. 권한 같은 다른 오류는 숨기지 않는다.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (modulesStat?.isSymbolicLink() || (modulesStat === null && share)) {
    const mainRoot = deps.mainCheckout ?? mainCheckoutOf(worktreePath);
    const shareable = Boolean(share && mainRoot && canShareMainDependencies(worktreePath, mainRoot, share));
    if (modulesStat === null) {
      if (shareable) {
        try {
          fs.symlinkSync(path.join(mainRoot as string, 'node_modules'), modulesDir, 'dir');
          return { ok: true };
        } catch {
          // 링크를 못 만들면 공유를 포기하고 독립 설치로 간다. 링크는 최적화일 뿐이다.
        }
      }
    } else {
      let intact = false;
      try {
        intact = shareable
          && fs.realpathSync(modulesDir) === fs.realpathSync(path.join(mainRoot as string, 'node_modules'));
      } catch {
        // 깨진 링크(ENOENT/ELOOP)는 intact=false로 흡수해 아래에서 링크를 푼다.
      }
      if (intact) return { ok: true };
      try {
        // symlink 자체만 지운다. unlink는 target을 따라가지 않아 main bytes가 보존된다.
        fs.unlinkSync(modulesDir);
      } catch (error) {
        return { ok: false, reason: 'dependency-install-failed', message: (error as { message: unknown }).message };
      }
    }
  }
  const lockHash = createHash('sha256').update(fs.readFileSync(lockFile)).digest('hex');
  const stampFile = path.join(worktreePath, LOCK_STAMP_REL);
  if (fs.existsSync(path.join(worktreePath, 'node_modules', '.package-lock.json'))) {
    let stamp: string | null = null;
    try {
      stamp = fs.readFileSync(stampFile, 'utf8').trim();
    } catch {
      // 읽기 실패(ENOENT·EISDIR·ENOTDIR·EACCES·EIO 등 모든 errno)는 "stamp 알 수 없음"으로
      // 취급한다. stamp는 설치 최적화 장치일 뿐이라 읽지 못해도 재설치하면 안전하고,
      // 여기서 던지면 의존성 준비 전체가 중단되므로 사유를 구분하지 않고 흡수한다.
    }
    if (stamp === lockHash) return { ok: true };
  }
  try {
    // 실행 host가 NODE_ENV=production 또는 omit=dev를 설정해도, execute의
    // 검증에는 devDependencies가 필요하다. 명시적으로 포함해 host 설정이
    // 새 worktree의 검증 가능 여부를 바꾸지 못하게 한다.
    const npmArgs = ['ci', '--include=dev', '--ignore-scripts', '--no-audit', '--no-fund'];
    if (deps.execFileSync) {
      deps.execFileSync('npm', npmArgs, { cwd: worktreePath, stdio: 'inherit' });
    } else {
      // Windows에서는 npm.cmd를 shell 없이 spawn할 수 없어 node로 npm CLI를 직접 실행한다.
      const call = resolveSpawn('npm', npmArgs);
      execFileSync(call.command, call.args, {
        cwd: worktreePath,
        stdio: 'inherit',
        ...(call.shell ? { shell: true } : {}),
      });
    }
  } catch (error) {
    return { ok: false, reason: 'dependency-install-failed', message: (error as { message: unknown }).message };
  }
  try {
    fs.mkdirSync(path.dirname(stampFile), { recursive: true });
    fs.writeFileSync(stampFile, `${lockHash}\n`);
  } catch {
    // stamp 쓰기 실패(권한·경로가 디렉터리 등)만 흡수한다. 설치 자체는 성공했고,
    // stamp가 없으면 다음 호출이 재설치하므로 오래된 node_modules로 검증하지 않는다.
  }
  return { ok: true };
}

// plan 워크플로에는 commit 단계가 없으므로 epic/blueprint 문서는 base working tree에만
// 존재합니다. `git worktree add`는 커밋된 HEAD를 checkout하므로 execute worktree는
// 구현에 필요한 brief 없이 시작합니다. 이 모듈은 plan context 문서만 정확히 옮기고
// base를 git이 기록한 상태로 되돌립니다.
//
// 이동 집합은 scope.makeAllowed가 context 문서에 기본으로 허용하는 경계와
// 의도적으로 같습니다 — blueprint 트리, epic index, context index.
// 파생 memory는 필수 입력이 아니며 복사하지 않습니다. affected_paths 아래
// 코드와 관련 없는 로컬 변경(graph output)은 그대로 둡니다. config는 이
// 이동 집합 밖이며, dest 보존 복사로만 전달합니다.
function makeIsTarget({ blueprintDir }: { blueprintDir: unknown }) {
  const bp = toPosix(blueprintDir);
  const epicIndex = `${epicDirOf(bp)}/index.md`;
  const contextIndex = `${CONTEXT_ROOT}/index.md`;
  return function isTarget(file: unknown): boolean {
    const f = toPosix(file);
    if (isUnder(f, `${bp}/`)) return true;
    return f === epicIndex || f === contextIndex;
  };
}

function realGit(repoRoot: string): SeedGit {
  const run = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }) as string;
  const lines = (s: string) => s.split('\n').filter(Boolean);
  return {
    // `diff HEAD`는 staged 변경도 보고하므로, agent가 `git add`한 문서는
    // untracked가 아니라 여기서 분류됩니다.
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    existsInHead: (file: string) => {
      try {
        // 경로가 없는 것은 모든 새 plan 문서에서 예상되는 답이므로,
        // git의 "디스크에는 있지만 HEAD에는 없음" 메시지는 여기서 오류가 아닙니다.
        execFileSync('git', ['cat-file', '-e', `HEAD:${file}`], {
          cwd: repoRoot,
          stdio: 'ignore',
        });
        return true;
      } catch {
        return false;
      }
    },
    readHead: (file: string) => {
      try {
        // `--filters`는 working-tree filter(autocrlf, .gitattributes text=auto)를
        // 적용하므로 checkout이 쓴 바이트와 동일하게 비교됩니다. raw `git show`는
        // CRLF worktree를 모두 충돌로 읽습니다.
        return execFileSync('git', ['cat-file', '--filters', `HEAD:${file}`], {
          cwd: repoRoot,
          stdio: ['ignore', 'pipe', 'ignore'],
        }) as Buffer;
      } catch {
        return null;
      }
    },
    // `git checkout -- <path>`는 index에서 복원하는데, agent가 staged하면
    // index에 dirty blob이 남습니다. HEAD를 지정하면 index와 working tree를
    // 함께 되돌려 staged ghost가 남지 않습니다.
    restore: (file: string) => { run(['checkout', 'HEAD', '--', file]); },
    unstage: (file: string) => { run(['rm', '--cached', '--quiet', '--', file]); },
  };
}

// 파일을 제거하면 scaffold가 만든 디렉터리 트리가 비울 수 있습니다. Git은
// 디렉터리를 추적하지 않으므로 빈 잔여물은 `git status`에는 보이지 않지만
// 다음 planning 세션에는 보입니다. 무언가 남을 때까지 위로 prune합니다.
/**
 * execute worktree에 `.bouncer/config.json`만 보존 복사한다.
 * dest가 있으면 바이트를 비교하지 않는다 — 재사용 worktree의 로컬 정책이
 * 덮이면 이미 통과한 verify와 다른 명령이 돈다. 추적 파일은 HEAD가
 * 정본이다. dirty base를 쓰면 아직 합의되지 않은 수정이 execute 정책이 된다.
 *
 * @param {string} repoRoot - plan 문서가 있는 base checkout
 * @param {string} worktreePath - execute worktree 절대 경로
 * @param {SeedGit} gitApi - HEAD 존재·바이트 조회
 * @returns {'copied' | 'preserved' | 'missing'} dest 유지, HEAD/base 복사, 또는 양쪽 부재
 */
function seedConfig(repoRoot: string, worktreePath: string, gitApi: SeedGit): ConfigSeedStatus {
  const dest = path.join(worktreePath, CONFIG_REL);
  if (fs.existsSync(dest)) return 'preserved';

  const src = path.join(repoRoot, CONFIG_REL);
  if (gitApi.existsInHead(CONFIG_REL)) {
    const head = gitApi.readHead(CONFIG_REL);
    // existsInHead가 참이면 dirty working tree는 정책이 아니다.
    // null을 untracked 분기로 넘기면 로컬 수정본이 execute 검증 명령이 된다.
    if (!head) {
      throw new Error(`failed to read HEAD:${CONFIG_REL}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, head);
    return 'copied';
  }
  // ignored·untracked는 HEAD에 없다. dest가 비어 있을 때만 base 바이트를
  // 복사하고, base 파일은 그대로 둔다 — 이 경로는 phase 2 대상이 아니다.
  if (!fs.existsSync(src)) return 'missing';
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, fs.readFileSync(src));
  return 'copied';
}

// stopRel은 지우지 않을 상한 디렉터리(저장소 상대)다. 생략하면 저장소 루트에서 멈춘다.
// release는 blueprint의 부모 `blueprints/`를 넘겨, 다른 blueprint와 공유하는 epic 트리를
// 비었다는 이유로 지우지 않는다.
function pruneEmptyDirs(repoRoot: string, rel: string, stopRel = ''): void {
  let dir = path.dirname(path.join(repoRoot, rel));
  const stop = path.resolve(repoRoot, stopRel);
  while (path.resolve(dir) !== stop && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

function seedWorktree({
  repoRoot, blueprintDir, worktreePath, git, deps,
}: {
  repoRoot: string;
  blueprintDir: unknown;
  worktreePath: string;
  git?: SeedGit;
  deps?: SeedDeps;
}) {
  const gitApi = git || realGit(repoRoot);
  const isTarget = makeIsTarget({ blueprintDir });

  const changed = gitApi.changedFiles();
  const untracked = gitApi.untrackedFiles();
  const changedSet = new Set(changed);
  const targets = [...new Set([...changed, ...untracked])].filter(isTarget).sort();

  if (!fs.existsSync(worktreePath) || !fs.statSync(worktreePath).isDirectory()) {
    return { ok: false, reason: 'missing-worktree', worktreePath };
  }
  const prepared = prepareDependencies(worktreePath, deps || {});
  if (!prepared.ok) return prepared;

  // dependency 준비 다음, plan 이동 전. 충돌로 phase 1이 중단돼도
  // 대상 worktree는 검증 정책을 이미 갖고, 다음 재시도는 preserved가 된다.
  let config: ConfigSeedStatus;
  try {
    config = seedConfig(repoRoot, worktreePath, gitApi);
  } catch (error) {
    return { ok: false, reason: 'copy-failed', message: (error as { message: unknown }).message };
  }
  if (!targets.length) return { ok: true, moved: [], restored: [], config };

  // Phase 1 — 복사 후 확인. `git checkout --`와 `git rm --cached`는 되돌릴 수
  // 없으므로, 모든 target이 worktree에 동일한 바이트로 존재하는 것이 확인될 때까지
  // base는 건드리지 않습니다. 거기서 다른 파일이면 이전 실행이 중단됐거나
  // 수동 편집입니다. 덮어쓰지 말고 중단합니다.
  const conflicts: string[] = [];
  const pending: Pending[] = [];
  for (const rel of targets) {
    const src = path.join(repoRoot, rel);
    // `git diff HEAD`는 삭제도 나열합니다. 옮길 것은 없지만 base는 git에
    // restore를 빚므로 복사 없이 phase 2용으로 표시합니다.
    if (!fs.existsSync(src)) {
      pending.push({ rel, write: false, absent: true });
      continue;
    }
    const content = fs.readFileSync(src);
    const dst = path.join(worktreePath, rel);
    if (!fs.existsSync(dst)) {
      pending.push({ rel, write: true, dst, content });
    } else if (fs.readFileSync(dst).equals(content)) {
      pending.push({ rel, write: false });
    } else {
      // worktree는 HEAD에서 checkout됐으므로 추적된 target은 모두 HEAD blob으로
      // 이미 존재합니다. 그것이 pristine checkout이지 다른 사람의 작업이 아닙니다.
      // 덮어쓰는 것이 "dirty 버전을 옮긴다"는 뜻입니다. base도 HEAD도 아닌
      // 내용만 진짜 충돌입니다 — 중단된 이전 실행이나 수동 편집.
      const head = gitApi.readHead(rel);
      if (head && fs.readFileSync(dst).equals(head)) pending.push({ rel, write: true, dst, content });
      else conflicts.push(rel);
    }
  }
  if (conflicts.length) return { ok: false, reason: 'conflict', conflicts, config };

  try {
    for (const item of pending) {
      if (!item.write) continue;
      fs.mkdirSync(path.dirname(item.dst), { recursive: true });
      fs.writeFileSync(item.dst, item.content);
    }
  } catch (error) {
    return { ok: false, reason: 'copy-failed', message: (error as { message: unknown }).message };
  }

  // Phase 2 — base를 git이 기록한 상태로 되돌립니다. HEAD 소속 여부가 동사를
  // 고릅니다 — staged/unstaged 구분만으로는 부족합니다: `git checkout --`는 HEAD가
  // 아는 경로에만 동작하고, staged 새 파일에는 HEAD blob이 없습니다.
  // `moved`는 worktree가 이제 보유하는 모든 target을 나열합니다 — 이미 바이트
  // 동일하게 있던 것도 포함 — 호출자가 brief를 읽을 수 있는지 확인하는 용도이지
  // 파일 쓰기 횟수를 세는 용도가 아닙니다.
  const moved: string[] = [];
  const restored: string[] = [];
  for (const { rel, absent } of pending) {
    if (gitApi.existsInHead(rel)) {
      gitApi.restore(rel);
      restored.push(rel);
    } else {
      if (changedSet.has(rel)) gitApi.unstage(rel);
      fs.rmSync(path.join(repoRoot, rel), { force: true });
      pruneEmptyDirs(repoRoot, rel);
    }
    // base에서 삭제된 경로는 복사되지 않았으므로 moved가 아니라 restored입니다.
    if (!absent) moved.push(rel);
  }
  return { ok: true, moved, restored, config };
}

/**
 * coordinator worker·fan-in candidate에 계획 문서와 검증용 의존성을 심는다.
 * execute용 seedWorktree와 달리 base를 복원·삭제하지 않는다. blueprint 트리
 * 다음에 epic·context index를 base에 있을 때만 덮어 복사해, untracked epic이
 * worker execute 게이트에서 S8·S13으로 막히지 않게 한다.
 *
 * @param {object} opts - seed 대상
 * @param {string} opts.repoRoot - 계획 문서가 있는 base(integration) checkout. 읽기만 한다
 * @param {unknown} opts.blueprintDir - 저장소 상대 blueprint 디렉터리
 * @param {string} opts.worktreePath - worker·fan-in worktree 절대 경로
 * @param {SeedDeps} [opts.deps] - execFileSync 주입. 테스트가 npm 호출을 가로채는 용도
 * @param {readonly string[]} [opts.affectedPaths] - 승인 task의 affected_paths. 있을 때만
 *   main node_modules 공유를 시도하고, manifest/lock 경로를 포함하면 처음부터 독립 설치한다
 * @returns {{ ok: true, config: ConfigSeedStatus, seeded: string[] }
 *   | { ok: false, reason: string, [k: string]: unknown }}
 *   성공 시 seeded는 [blueprintDir, 복사한 index 경로들] 순서. 없는 index는 넣지 않는다.
 *   복사 예외는 copy-failed.
 */
function seedCoordinatorWorker({ repoRoot, blueprintDir, worktreePath, deps, affectedPaths }: {
  repoRoot: string; blueprintDir: unknown; worktreePath: string; deps?: SeedDeps;
  affectedPaths?: readonly string[];
}) {
  if (!fs.existsSync(worktreePath) || !fs.statSync(worktreePath).isDirectory()) {
    return { ok: false, reason: 'missing-worktree', worktreePath };
  }
  const bp = toPosix(blueprintDir);
  const source = path.join(repoRoot, bp);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    return { ok: false, reason: 'missing-blueprint', blueprintDir };
  }
  // affectedPaths가 없으면 승인 scope를 알 수 없으므로 공유하지 않고 독립 설치한다.
  const prepared = prepareDependencies(worktreePath, deps || {}, affectedPaths ? { affectedPaths } : undefined);
  if (!prepared.ok) return prepared;
  try {
    const config = seedConfig(repoRoot, worktreePath, realGit(repoRoot));
    // cpSync는 target tree만 쓰며, base plan은 읽기만 한다. 여러 worker가 같은
    // blueprint seed를 받아도 서로의 brief를 빼앗지 않는 이유다.
    fs.cpSync(source, path.join(worktreePath, bp), { recursive: true, force: true });
    const seeded = [bp];
    // seedIntegration과 같은 경로 계산. worker는 HEAD checkout이라 untracked
    // epic index와 dirty context index가 빠져 execute 구조 게이트가 실패한다.
    for (const rel of [`${epicDirOf(bp)}/index.md`, `${CONTEXT_ROOT}/index.md`]) {
      const src = path.join(repoRoot, rel);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(worktreePath, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      seeded.push(rel);
    }
    return { ok: true, config, seeded };
  } catch (error) {
    return { ok: false, reason: 'copy-failed', message: (error as { message: unknown }).message };
  }
}

/**
 * integration checkout에 main의 계획 문서를 seed하고 manifest를 반환한다.
 * 기본 동작은 충돌을 막는다. 이미 있는 계획 파일을 덮어쓰지 않는다.
 *
 * @param {object} opts - source·destination
 * @param {string} opts.repoRoot - 승인된 계획 문서가 있는 main checkout
 * @param {unknown} opts.blueprintDir - blueprint 상대 경로
 * @param {string} opts.integrationPath - 계획 문서를 받을 integration checkout
 * @returns {object} 성공 시 seeded 경로·manifest·config, 실패 시 reason과 대상
 */
function seedIntegration({ repoRoot, blueprintDir, integrationPath }: {
  repoRoot: string; blueprintDir: unknown; integrationPath: string;
}) {
  const bp = toPosix(blueprintDir);
  const source = path.join(repoRoot, bp);
  const targets: string[] = [];
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    return { ok: false, reason: 'missing-blueprint', targets: [bp] };
  }
  const visit = (dir: string, rel: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const child = path.join(dir, name);
      const childRel = `${rel}/${name}`;
      if (fs.statSync(child).isDirectory()) visit(child, childRel);
      else targets.push(childRel);
    }
  };
  visit(source, bp);
  for (const rel of [`${epicDirOf(bp)}/index.md`, `${CONTEXT_ROOT}/index.md`]) {
    if (fs.existsSync(path.join(repoRoot, rel))) targets.push(rel);
  }
  targets.sort();
  const gitApi = realGit(repoRoot);
  const conflicts: string[] = [];
  const realIntegration = fs.realpathSync(integrationPath);
  const contained = (candidate: string) => {
    const rel = path.relative(realIntegration, candidate);
    return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
  };
  // 승격은 충돌 검사를 우회하므로, 쓰기 전에 실제 대상 경로도 integration 안인지 확인한다.
  // symlink가 main이나 외부 파일을 가리키면 승인 문서 복사가 그 파일을 덮어쓸 수 있다.
  for (const rel of targets) {
    const dst = path.resolve(integrationPath, rel);
    if (!contained(dst)) return { ok: false, reason: 'seed-path-escape', targets: [rel] };
    let probe = dst;
    const suffix: string[] = [];
    while (true) {
      try {
        fs.lstatSync(probe);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        const parent = path.dirname(probe);
        if (parent === probe) return { ok: false, reason: 'seed-path-escape', targets: [rel] };
        suffix.unshift(path.basename(probe));
        probe = parent;
      }
    }
    let resolved: string;
    try {
      resolved = fs.realpathSync(probe);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // 경로 해석 중 dangling·순환 symlink 또는 비디렉터리 상위 경로는 안전하게 거절한다.
      if (code === 'ENOENT' || code === 'ELOOP' || code === 'ENOTDIR') {
        return { ok: false, reason: 'seed-path-escape', targets: [rel] };
      }
      throw error;
    }
    if (!contained(path.resolve(resolved, ...suffix))) {
      return { ok: false, reason: 'seed-path-escape', targets: [rel] };
    }
  }
  for (const rel of targets) {
    const dst = path.join(integrationPath, rel);
    if (!fs.existsSync(dst)) continue;
    const current = fs.readFileSync(dst);
    const main = fs.readFileSync(path.join(repoRoot, rel));
    const head = gitApi.readHead(rel);
    if (!current.equals(main) && !(head && current.equals(head))) conflicts.push(rel);
  }
  if (conflicts.length) return { ok: false, reason: 'seed-conflict', conflicts, targets };
  try {
    for (const rel of targets) {
      const dst = path.resolve(integrationPath, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(repoRoot, rel), dst);
    }
    const config = seedConfig(repoRoot, integrationPath, gitApi);
    const manifest = targets.map((rel) => ({ path: rel,
      sha256: createHash('sha256').update(fs.readFileSync(path.join(integrationPath, rel))).digest('hex') }));
    return { ok: true, seeded: targets, manifest, config };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'ELOOP' || code === 'ENOTDIR') {
      return { ok: false, reason: 'seed-path-escape', targets };
    }
    return { ok: false, reason: 'seed-failed', message: (error as { message: unknown }).message, targets };
  }
}

type ReleaseResult = { released: string[]; restored: string[]; preserved: string[]; absent: string[] };

// 원장 manifest 경로가 저장소 상대 POSIX 정규형인지. makeIsTarget은 접두어만 보므로
// `<bp>/../../x` 같은 경로도 통과시킨다. 정규화 결과가 그대로인 경로만 판정에 넣는다.
function isCanonicalRel(rel: string): boolean {
  return rel !== '' && !path.posix.isAbsolute(rel) && !/^[A-Za-z]:/.test(rel)
    && path.posix.normalize(rel) === rel && !rel.split('/').includes('..');
}

/**
 * drive가 끝난 뒤 main에 남은 계획 사본을 bootstrap manifest와 대조해 git이 기록한
 * 상태로 돌려놓는다. 해시가 맞는 사본만 되돌리므로 drive 도중 main에서 고친 문서는
 * 남는다. seed 집합(makeIsTarget) 밖이거나 정규형이 아닌 manifest 항목은 원장이 손으로
 * 바뀐 경우이므로 판정하지 않고 preserved로만 보고한다. 객체가 아니거나 `path`가 문자열이
 * 아닌 항목도 같다 — 경로 대신 항목의 JSON 텍스트로 보고한다. 되돌린 뒤 다시 부르면 모든
 * 처리 경로가 absent가 되어 같은 상태로 수렴한다. 빈 디렉터리 정리는 blueprint 트리
 * 안에서만 한다.
 *
 * @param {object} opts - main checkout, blueprint 경로, 원장의 seedManifest, 주입용 git
 * @returns {ReleaseResult} 경로별 판정. 순서는 manifest 순서다.
 * @example
 * releaseSeedManifest({ repoRoot: '/repo', blueprintDir: bp, manifest: ledger.seedManifest });
 * // { released: [`${bp}/index.md`], restored: ['.bouncer/context/index.md'], preserved: [], absent: [] }
 * releaseSeedManifest({ repoRoot: '/repo', blueprintDir: bp, manifest: [null] });
 * // { released: [], restored: [], preserved: ['null'], absent: [] }
 */
function releaseSeedManifest({ repoRoot, blueprintDir, manifest, git }: {
  repoRoot: string; blueprintDir: unknown; manifest: unknown[]; git?: SeedGit;
}): ReleaseResult {
  const gitApi = git || realGit(repoRoot);
  const isTarget = makeIsTarget({ blueprintDir });
  const bp = toPosix(blueprintDir);
  // 쓰기 전에 모든 항목을 먼저 판정 가능한 것과 아닌 것으로 나눈다. 반복 도중에 `null.path`
  // 같은 항목을 만나 throw하면, 앞 항목만 되돌려진 main이 남고 보고도 없다.
  const entries = manifest.map((entry) => {
    const record = entry && typeof entry === 'object' ? entry as { path?: unknown; sha256?: unknown } : null;
    if (!record || typeof record.path !== 'string') {
      // JSON.stringify(undefined)는 문자열이 아니므로 String으로 채운다.
      return { rel: JSON.stringify(entry) ?? String(entry), sha256: undefined, judged: false };
    }
    const rel = toPosix(record.path);
    return { rel, sha256: record.sha256, judged: isCanonicalRel(rel) && isTarget(rel) };
  });
  // `diff HEAD`는 staged 추가도 나열한다. HEAD에 없는 경로가 여기 있으면 index에만
  // 올라간 새 파일이므로 지우기 전에 unstage해야 index에 유령이 남지 않는다.
  const changed = new Set(gitApi.changedFiles());
  const result: ReleaseResult = { released: [], restored: [], preserved: [], absent: [] };
  for (const { rel, sha256, judged } of entries) {
    if (!judged) {
      result.preserved.push(rel);
      continue;
    }
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      result.absent.push(rel);
      continue;
    }
    const current = fs.readFileSync(abs);
    const inHead = gitApi.existsInHead(rel);
    const head = inHead ? gitApi.readHead(rel) : null;
    if (head && current.equals(head)) {
      result.absent.push(rel);
      continue;
    }
    if (createHash('sha256').update(current).digest('hex') !== sha256) {
      result.preserved.push(rel);
      continue;
    }
    if (inHead) {
      gitApi.restore(rel);
      result.restored.push(rel);
    } else {
      if (changed.has(rel)) gitApi.unstage(rel);
      fs.rmSync(abs, { force: true });
      // blueprint 트리 안의 파일만 정리한다. 상한은 부모 `blueprints/`라 비워진 blueprint
      // 디렉터리까지만 지워진다. epic·context index는 공유 트리의 파일이므로 정리하지 않는다.
      if (isUnder(rel, `${bp}/`)) pruneEmptyDirs(repoRoot, rel, path.posix.dirname(bp));
      result.released.push(rel);
    }
  }
  return result;
}

export = {
  makeIsTarget, realGit, seedWorktree, seedCoordinatorWorker, seedIntegration,
  releaseSeedManifest, prepareDependencies, linkLocalEnv, missingDirectDependencies,
};
