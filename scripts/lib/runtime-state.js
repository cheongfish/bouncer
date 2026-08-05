'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { toPosix } = require('./paths');
const GIT_REQUIRED = 'Bouncer requires a Git repository for an active blueprint';
function runtimePaths({ repoRoot, execFileSync = realExecFileSync, 
// env/platform은 호출부 호환용; worktree는 이제 repo 내부.
env: _env = process.env, platform = process.platform, }) {
    const pathApi = platform === 'win32' ? path.win32 : path;
    let commonDir;
    try {
        commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    }
    catch (error) {
        return { unavailable: true, reason: error.message || 'Git common directory unavailable' };
    }
    if (!commonDir) {
        return { unavailable: true, reason: 'Git common directory unavailable' };
    }
    const commonGitDir = pathApi.resolve(repoRoot, commonDir);
    // dirname(.git)은 일반 repo의 main worktree root이므로, linked checkout이
    // 자기 아래에 중첩되지 않고 같은 `.worktrees/`를 공유한다.
    const mainRoot = pathApi.dirname(commonGitDir);
    return {
        commonGitDir,
        currentFile: pathApi.join(commonGitDir, 'bouncer', 'current'),
        worktreeRoot: pathApi.join(mainRoot, '.worktrees'),
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
    if (paths.unavailable || !d.fs.existsSync(paths.currentFile))
        return null;
    try {
        const data = JSON.parse(d.fs.readFileSync(paths.currentFile, 'utf8').trim());
        if (!data || typeof data.blueprint !== 'string' || typeof data.base !== 'string')
            return null;
        return { blueprint: toPosix(data.blueprint), base: data.base };
    }
    catch (_error) {
        return null;
    }
}
// pointer가 제거되면 true, 없었으면 false. 호출자는 "이미 없음"을
// 성공으로 보므로, 파일이 없어도 throw하면 안 된다.
function clearRuntimeCurrent({ repoRoot, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable || !d.fs.existsSync(paths.currentFile))
        return false;
    d.fs.rmSync(paths.currentFile);
    return true;
}
function writeRuntimeCurrent({ repoRoot, blueprint, base, deps, }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable)
        throw new Error(GIT_REQUIRED);
    d.fs.mkdirSync(path.dirname(paths.currentFile), { recursive: true });
    const data = { blueprint: toPosix(blueprint), base };
    d.fs.writeFileSync(paths.currentFile, `${JSON.stringify(data, null, 2)}\n`);
    return paths.currentFile;
}
function ensureWorktreeRoot({ repoRoot, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable)
        throw new Error(GIT_REQUIRED);
    d.fs.mkdirSync(paths.worktreeRoot, { recursive: true });
    return paths.worktreeRoot;
}
module.exports = {
    runtimePaths, readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent, ensureWorktreeRoot,
};
