'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const { toPosix } = require('./paths');
const GIT_REQUIRED = 'Bouncer requires a Git repository for an active blueprint';
function stateHome({ env, platform, pathApi }) {
    if (env.XDG_STATE_HOME)
        return pathApi.resolve(env.XDG_STATE_HOME);
    if (platform === 'win32') {
        return pathApi.resolve(env.LOCALAPPDATA
            || pathApi.join(env.USERPROFILE || env.HOME || os.homedir(), 'AppData', 'Local'));
    }
    const home = env.HOME || os.homedir();
    if (platform === 'darwin')
        return pathApi.join(home, 'Library', 'Application Support');
    return pathApi.join(home, '.local', 'state');
}
function runtimePaths({ repoRoot, execFileSync = realExecFileSync, env = process.env, platform = process.platform, }) {
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
    const repoId = crypto.createHash('sha256').update(commonGitDir).digest('hex').slice(0, 12);
    return {
        commonGitDir,
        currentFile: pathApi.join(commonGitDir, 'bouncer', 'current'),
        worktreeRoot: pathApi.join(stateHome({ env, platform, pathApi }), 'bouncer', 'worktrees', repoId),
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
// Returns true when a pointer was removed, false when there was none. Callers
// treat "already absent" as success, so this must not throw on a missing file.
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
