'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
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
function readConfigSafe(repoRoot) {
    try {
        return JSON.parse(fs.readFileSync(path.join(repoRoot, '.bouncer', 'config.json'), 'utf8'));
    }
    catch (_e) {
        // 파일 없음·깨진 JSON·권한 오류 모두 "config 없음"과 같게 — 해석기는 throw하지 않는다.
        return null;
    }
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
        // config를 넘기지 않으면 디스크에서 읽되, 실패는 null과 동일.
        const cfg = config === undefined ? readConfigSafe(root) : config;
        const rawBin = cfg && typeof cfg === 'object' && cfg.graphify && typeof cfg.graphify === 'object'
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
module.exports = {
    venvBinRel,
    resolveGraphifyBin,
};
