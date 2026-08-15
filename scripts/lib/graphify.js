'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readConfig } = require('./config');
/**
 * 플랫폼별 venv 안 graphify 실행 파일의 저장소-상대 경로.
 * Windows만 Scripts/ + .exe; 그 외는 bin/. 구분자는 항상 POSIX(/)로 고정해
 * config·테스트·로그가 OS cwd 구분자에 흔들리지 않게 한다.
 */
function venvBinRel(platform) {
    if (platform === 'win32')
        return '.bouncer/.venv/Scripts/graphify.exe';
    return '.bouncer/.venv/bin/graphify';
}
function defaultHasOnPath() {
    // session-graph의 구 realHasGraphify와 동일 순서: 직접 실행 → command -v.
    // PATH 탐색만 담당; config/venv 후보는 호출 쪽에서 이미 걸러진다.
    try {
        execFileSync('graphify', ['--version'], { stdio: 'ignore' });
        return true;
    }
    catch (_e) {
        try {
            execFileSync('command', ['-v', 'graphify'], { stdio: 'ignore', shell: true });
            return true;
        }
        catch (_e2) {
            return false;
        }
    }
}
/**
 * graphify 실행 파일 단일 해석기.
 * 후보 순서: config.graphify.bin → venvBinRel → PATH의 `graphify`.
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
function resolveGraphifyBin({ repoRoot, config, platform, exists, hasOnPath, } = {}) {
    try {
        const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
        const plat = typeof platform === 'string' ? platform : process.platform;
        const fileExists = typeof exists === 'function'
            ? exists
            : (p) => fs.existsSync(p);
        const onPath = typeof hasOnPath === 'function' ? hasOnPath : defaultHasOnPath;
        // 주입이 없으면 디스크에서 읽되, 실패는 null — ?? {}를 붙이면
        // 아래 cfg && typeof cfg === 'object' 가 빈 객체를 설정 있음으로 본다.
        const cfg = config === undefined ? readConfig(root) : config;
        const rawBin = cfg && typeof cfg === 'object' && !Array.isArray(cfg)
            && cfg.graphify
            && typeof cfg.graphify === 'object'
            ? cfg.graphify.bin
            : undefined;
        // 비문자열·빈 문자열은 "설정 없음" — 다음 후보로 내려간다.
        if (typeof rawBin === 'string' && rawBin.length > 0) {
            const abs = path.isAbsolute(rawBin) ? rawBin : path.join(root, rawBin);
            if (fileExists(abs)) {
                return { bin: abs, source: 'config' };
            }
        }
        const venvRel = venvBinRel(plat);
        const venvAbs = path.join(root, venvRel);
        if (fileExists(venvAbs)) {
            return { bin: venvAbs, source: 'venv' };
        }
        if (onPath()) {
            // PATH 폴백은 이름만 반환 — 절대 경로로 which하지 않는다(소비자가 execFile에 넘김).
            return { bin: 'graphify', source: 'path' };
        }
        return { bin: null, source: null };
    }
    catch (_e) {
        // 계약: 어떤 입력·주입 실패에도 throw하지 않는다.
        return { bin: null, source: null };
    }
}
/**
 * 플랫폼별 venv pip 실행 파일 상대 경로.
 * graphify와 같은 Scripts/ vs bin/ 규칙을 따르되, activate 없이 직접 호출한다.
 */
function venvPipRel(platform) {
    if (platform === 'win32')
        return '.bouncer/.venv/Scripts/pip.exe';
    return '.bouncer/.venv/bin/pip';
}
/**
 * `.bouncer/.venv`에 graphify를 설치(또는 재사용).
 * 네트워크·python 부재는 soft-fail — throw하지 않고 status/reason만 돌려
 * init 부트스트랩 exit 0을 지키게 한다. 이미 bin이 있으면 upgrade하지 않는다
 * (셸마다 activate가 끊기므로 경로로 직접 호출하는 계약과 맞춤).
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
function catchMessageOrString(error) {
    // 예전 `e && e.message ? e.message : String(e)` 와 같다. extra null 가드를
    // 넣으면 throw null이 TypeError 대신 'null' 문자열이 된다.
    const message = error && error.message;
    return message ? String(message) : String(error);
}
function setupGraphify({ repoRoot, exec, platform, } = {}) {
    try {
        const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
        const plat = typeof platform === 'string' ? platform : process.platform;
        const run = typeof exec === 'function' ? exec : execFileSync;
        const binRel = venvBinRel(plat);
        const binAbs = path.join(root, binRel);
        if (fs.existsSync(binAbs)) {
            return { status: 'reused', bin: binRel };
        }
        // 1) venv 생성 — cwd=repoRoot로 상대 경로 `.bouncer/.venv`를 고정.
        try {
            run('python3', ['-m', 'venv', '.bouncer/.venv'], { cwd: root, stdio: 'pipe' });
        }
        catch (e) {
            return {
                status: 'failed',
                bin: null,
                reason: `venv: ${catchMessageOrString(e)}`,
            };
        }
        // 2) pip으로 graphifyy 설치 — PyPI 패키지명이 graphify가 아님에 주의.
        const pipAbs = path.join(root, venvPipRel(plat));
        try {
            run(pipAbs, ['install', 'graphifyy'], { cwd: root, stdio: 'pipe' });
        }
        catch (e) {
            return {
                status: 'failed',
                bin: null,
                reason: `pip: ${catchMessageOrString(e)}`,
            };
        }
        // 3) graphify 자체의 install(에이전트 훅 등) — activate 없이 bin 경로 직접 실행.
        try {
            run(binAbs, ['install'], { cwd: root, stdio: 'pipe' });
        }
        catch (e) {
            return {
                status: 'failed',
                bin: null,
                reason: `graphify install: ${catchMessageOrString(e)}`,
            };
        }
        return { status: 'installed', bin: binRel };
    }
    catch (e) {
        // 계약: setupGraphify 자신은 어떤 실패에도 throw하지 않는다.
        return {
            status: 'failed',
            bin: null,
            reason: catchMessageOrString(e),
        };
    }
}
module.exports = {
    venvBinRel,
    resolveGraphifyBin,
    setupGraphify,
};
