'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { toPosix, parsePathIds } = require('./paths');

const GIT_REQUIRED = 'Bouncer requires a Git repository for an active blueprint';

function runtimePaths({
  repoRoot,
  execFileSync = realExecFileSync,
  // env/platform은 호출부 호환용; worktree는 이제 repo 내부.
  env: _env = process.env,
  platform = process.platform,
}) {
  const pathApi = platform === 'win32' ? path.win32 : path;
  let commonDir;
  try {
    commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    return { unavailable: true, reason: error.message || 'Git common directory unavailable' };
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

function resolvedPaths({ repoRoot, deps }) {
  const d = deps || {};
  return runtimePaths({
    repoRoot,
    execFileSync: d.execFileSync,
    env: d.env,
    platform: d.platform,
  });
}

function readRuntimeCurrent({ repoRoot, deps }) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable || !d.fs.existsSync(paths.currentFile)) return null;
  try {
    const data = JSON.parse(d.fs.readFileSync(paths.currentFile, 'utf8').trim());
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
function clearRuntimeCurrent({ repoRoot, deps }) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable || !d.fs.existsSync(paths.currentFile)) return false;
  d.fs.rmSync(paths.currentFile);
  return true;
}

function writeRuntimeCurrent({
  repoRoot, blueprint, base, task, deps,
}) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable) throw new Error(GIT_REQUIRED);
  d.fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });
  // task는 문자열일 때만 파일에 쓴다 — 없으면 키 자체를 생략해 레거시 형태를 유지.
  const data: { blueprint: string; base: string; task?: string } = {
    blueprint: toPosix(blueprint),
    base,
  };
  if (typeof task === 'string') data.task = toPosix(task);
  d.fs.writeFileSync(paths.currentFile, `${JSON.stringify(data, null, 2)}\n`);
  return paths.currentFile;
}

// blueprint 경로만으로 execute worktree 절대 경로를 고른다.
// 기본은 `.worktrees/<epic>/<bp>`이고, 중첩이 없는데 평면 `.worktrees/<bp>`만
// 있으면 그 평면을 재사용한다(옮기지 않음). mkdir은 하지 않는다 —
// `git worktree add`가 부모 디렉터리까지 만든다.
function worktreePathFor({ repoRoot, blueprint, deps }) {
  const d = { fs, ...(deps || {}) };
  const paths = resolvedPaths({ repoRoot, deps: d });
  if (paths.unavailable) throw new Error(GIT_REQUIRED);

  const { epicId, blueprintId } = parsePathIds(blueprint);
  // 구형 EPIC-/BP- 접두는 parsePathIds가 흡수하지 않는다 — migrate ids 선행.
  if (!epicId || !blueprintId) {
    throw new Error(`Cannot derive epic/blueprint ids from blueprint path: ${blueprint}`);
  }

  const platform = d.platform || process.platform;
  const pathApi = platform === 'win32' ? path.win32 : path;
  const nested = pathApi.join(paths.worktreeRoot, epicId, blueprintId);
  const flat = pathApi.join(paths.worktreeRoot, blueprintId);

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

module.exports = {
  runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent, worktreePathFor,
};
