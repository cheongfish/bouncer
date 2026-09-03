'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
import config = require('./config');
const { readConfig } = config;
import runtimeState = require('./runtime-state');
const { runtimePaths } = runtimeState;

/**
 * 레거시·비-git 폴백용 저장소-상대 경로.
 * Windows만 Scripts/ + .exe; 그 외는 bin/. 구분자는 항상 POSIX(/)로 고정해
 * config·테스트·로그가 OS cwd 구분자에 흔들리지 않게 한다.
 * 신규 설치 위치는 preferredVenvDirAbs — 이 값은 기존 소비자 config와
 * `.bouncer/.venv` 재사용 후보에만 쓴다.
 */
function venvBinRel(platform: string) {
  if (platform === 'win32') return '.bouncer/.venv/Scripts/graphify.exe';
  return '.bouncer/.venv/bin/graphify';
}

// venv 루트 기준 실행 파일. 신규 위치·레거시 위치가 같은 Scripts/ vs bin/ 규칙을 공유한다.
function venvExecRel(platform: string, kind: 'graphify' | 'pip') {
  if (platform === 'win32') {
    return kind === 'pip' ? 'Scripts/pip.exe' : 'Scripts/graphify.exe';
  }
  return kind === 'pip' ? 'bin/pip' : 'bin/graphify';
}

function preferredVenvDirAbs(repoRoot: string) {
  // runtime-state와 같은 rev-parse --git-common-dir. 새 경로 개념을 만들지 않는다.
  // common dir 아래면 worktree git add 대상이 아니므로 B1 재현이 끊긴다.
  const paths = runtimePaths({ repoRoot });
  if (!paths.unavailable && typeof paths.commonGitDir === 'string' && paths.commonGitDir) {
    return path.join(paths.commonGitDir, 'bouncer', 'venv');
  }
  // 비-git 디렉터리(init 픽스처 포함)는 common dir이 없다. 기존 위치로 폴백.
  return path.join(repoRoot, '.bouncer', '.venv');
}

function venvBinAbsAt(venvDir: string, platform: string) {
  return path.join(venvDir, venvExecRel(platform, 'graphify'));
}

function removeCreatedVenvDir(venvDir: string, createdThisRun: boolean) {
  // 이번 실행이 mkdir/venv 한 디렉터리만 지운다. 이미 있던 잔해·공유 bouncer/ 는 건드리지 않는다.
  if (!createdThisRun) return;
  try {
    fs.rmSync(venvDir, { recursive: true, force: true });
  } catch (_e) {
    // 정리 실패는 원래 설치 실패 reason을 덮지 않는다.
  }
}

function defaultHasOnPath() {
  // session-graph의 구 realHasGraphify와 동일 순서: 직접 실행 → command -v.
  // PATH 탐색만 담당; config/venv 후보는 호출 쪽에서 이미 걸러진다.
  try {
    execFileSync('graphify', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (_e) {
    try {
      execFileSync('command', ['-v', 'graphify'], { stdio: 'ignore', shell: true });
      return true;
    } catch (_e2) {
      return false;
    }
  }
}

/**
 * graphify 실행 파일 단일 해석기.
 * 후보 순서: config.graphify.bin → venv(신규 common-dir, 그다음 레거시) → PATH의 `graphify`.
 * 어떤 입력에도 throw하지 않으며, 후보가 없으면 { bin: null, source: null }.
 *
 * @param {{
 *   repoRoot: string,
 *   config?: any,
 *   platform?: string,
 *   exists?: (abs: string) => boolean,
 *   hasOnPath?: () => boolean,
 * }} opts
 * @returns {{ bin: string | null, source: 'config' | 'venv' | 'path' | null }}
 */
function resolveGraphifyBin({
  repoRoot,
  config,
  platform,
  exists,
  hasOnPath,
}: {
  repoRoot?: string;
  config?: unknown;
  platform?: string;
  exists?: (abs: string) => boolean;
  hasOnPath?: () => boolean;
} = {}) {
  try {
    const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
    const plat = typeof platform === 'string' ? platform : process.platform;
    const fileExists = typeof exists === 'function'
      ? exists
      : (p: string) => fs.existsSync(p);
    const onPath = typeof hasOnPath === 'function' ? hasOnPath : defaultHasOnPath;

    // 주입이 없으면 디스크에서 읽되, 실패는 null — ?? {}를 붙이면
    // 아래 cfg && typeof cfg === 'object' 가 빈 객체를 설정 있음으로 본다.
    const cfg = config === undefined ? readConfig(root) : config;

    const rawBin = cfg && typeof cfg === 'object' && !Array.isArray(cfg)
      && (cfg as Record<string, unknown>).graphify
      && typeof (cfg as Record<string, unknown>).graphify === 'object'
      ? ((cfg as Record<string, unknown>).graphify as Record<string, unknown>).bin
      : undefined;
    // 비문자열·빈 문자열은 "설정 없음" — 다음 후보로 내려간다.
    if (typeof rawBin === 'string' && rawBin.length > 0) {
      const abs = path.isAbsolute(rawBin) ? rawBin : path.join(root, rawBin);
      if (fileExists(abs)) {
        return { bin: abs, source: 'config' };
      }
    }

    const preferredBin = venvBinAbsAt(preferredVenvDirAbs(root), plat);
    if (fileExists(preferredBin)) {
      return { bin: preferredBin, source: 'venv' };
    }

    const legacyBin = path.join(root, venvBinRel(plat));
    if (legacyBin !== preferredBin && fileExists(legacyBin)) {
      return { bin: legacyBin, source: 'venv' };
    }

    if (onPath()) {
      // PATH 폴백은 이름만 반환 — 절대 경로로 which하지 않는다(소비자가 execFile에 넘김).
      return { bin: 'graphify', source: 'path' };
    }

    return { bin: null, source: null };
  } catch (_e) {
    // 계약: 어떤 입력·주입 실패에도 throw하지 않는다.
    return { bin: null, source: null };
  }
}

/**
 * graphify venv 설치(또는 재사용).
 * 기본 위치는 git common directory 아래 `bouncer/venv`. 이미 `.bouncer/.venv`
 * bin이 있으면 이전하지 않고 그대로 재사용한다. 네트워크·python 부재는
 * soft-fail — throw하지 않고 status/reason만 돌려 init 부트스트랩 exit 0을
 * 지킨다. 이미 bin이 있으면 upgrade하지 않는다.
 *
 * @param {{
 *   repoRoot: string,
 *   exec?: typeof execFileSync,
 *   platform?: string,
 * }} opts
 * @returns {{
 *   status: 'reused' | 'installed' | 'failed',
 *   bin: string | null,
 *   reason?: string,
 * }}
 */
function catchMessageOrString(error: unknown): string {
  // 예전 `e && e.message ? e.message : String(e)` 와 같다. extra null 가드를
  // 넣으면 throw null이 TypeError 대신 'null' 문자열이 된다.
  const message = error && (error as { message?: unknown }).message;
  return message ? String(message) : String(error);
}

function setupGraphify({
  repoRoot,
  exec,
  platform,
}: {
  repoRoot?: string;
  exec?: typeof execFileSync;
  platform?: string;
} = {}) {
  try {
    const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
    const plat = typeof platform === 'string' ? platform : process.platform;
    const run = typeof exec === 'function' ? exec : execFileSync;
    const binRel = venvBinRel(plat);
    const legacyBinAbs = path.join(root, binRel);
    const venvDir = preferredVenvDirAbs(root);
    const binAbs = venvBinAbsAt(venvDir, plat);

    // 레거시를 먼저 본다. 있으면 이전·삭제 없이 상대 경로를 그대로 돌려
    // 기존 config 기록 형태를 유지한다.
    if (fs.existsSync(legacyBinAbs)) {
      return { status: 'reused', bin: binRel };
    }
    if (fs.existsSync(binAbs)) {
      return { status: 'reused', bin: binAbs };
    }

    const createdThisRun = !fs.existsSync(venvDir);

    // 1) venv 생성 — 절대 경로라 cwd와 무관하게 common dir / 폴백 위치를 가리킨다.
    try {
      run('python3', ['-m', 'venv', venvDir], { cwd: root, stdio: 'pipe' });
    } catch (e) {
      removeCreatedVenvDir(venvDir, createdThisRun);
      return {
        status: 'failed',
        bin: null,
        reason: `venv: ${catchMessageOrString(e)}`,
      };
    }

    // 2) pip으로 graphifyy 설치 — PyPI 패키지명이 graphify가 아님에 주의.
    const pipAbs = path.join(venvDir, venvExecRel(plat, 'pip'));
    try {
      run(pipAbs, ['install', 'graphifyy'], { cwd: root, stdio: 'pipe' });
    } catch (e) {
      removeCreatedVenvDir(venvDir, createdThisRun);
      return {
        status: 'failed',
        bin: null,
        reason: `pip: ${catchMessageOrString(e)}`,
      };
    }

    // 3) graphify 자체의 install(에이전트 훅 등) — activate 없이 bin 경로 직접 실행.
    try {
      run(binAbs, ['install'], { cwd: root, stdio: 'pipe' });
    } catch (e) {
      removeCreatedVenvDir(venvDir, createdThisRun);
      return {
        status: 'failed',
        bin: null,
        reason: `graphify install: ${catchMessageOrString(e)}`,
      };
    }

    return { status: 'installed', bin: binAbs };
  } catch (e) {
    // 계약: setupGraphify 자신은 어떤 실패에도 throw하지 않는다.
    return {
      status: 'failed',
      bin: null,
      reason: catchMessageOrString(e),
    };
  }
}

export = {
  venvBinRel,
  resolveGraphifyBin,
  setupGraphify,
};
