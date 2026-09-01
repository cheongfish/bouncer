'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { readConfig } = require('./config');
const { CONTEXT_DIGEST_OUT, DIGEST_WATCH_FILES, } = require('./context-digest');
const { DISTILL_SHARD_DIR } = require('./layout');
// 설정·디렉터리 존재·mtime 판정만. 프로세스를 띄우지 않고 graphify.ts 도
// require 하지 않는다 — 그 모듈의 PATH 탐색이 execFileSync 를 돌리기 때문.
// 신선도 계산이 graphify 설치 여부를 묻기 시작하면 테스트가 deps 없이
// 안전한 함수와 아닌 함수를 구분하지 못한다.
const DEFAULT_SOURCE_OUT = 'graphify-out/source';
const DEFAULT_TEST_OUT = 'graphify-out/test';
const DEFAULT_CONTEXT_OUT = 'graphify-out/context';
const DEFAULT_CONTEXT_DIRS = ['.bouncer/context'];
// freshness walk 전용 이름 기반 prune — config key 아님.
// graphify-out 을 건너뛰는 이유 둘:
// 1) 파생 트리는 freshness 입력이 아니다. 컨텍스트 그래프는
//    graphify-out/context-src 를 스캔하지만, 그 mtime 이 stale 을 만들면
//    매 sync 가 자기 산출물을 보고 재빌드한다.
// 2) 사용자가 source_dirs: ["."] 로 graphify-out 을 다시 넣으면
//    build 가 graphify-out 아래에 쓰기 → mtime 갱신 → rebuild 무한 루프.
const SCAN_EXCLUDED_DIRS = new Set(['graphify-out', 'node_modules', '.git', '.worktrees']);
function configField(cfg, key) {
    // cfg?.key 와 같다. `'key' in cfg`로 바꾸면 프로토타입 필드가 생기고
    // null에서 단락되지 않을 수 있다.
    return cfg && typeof cfg === 'object' ? cfg[key] : undefined;
}
function toPosix(p) {
    return p.split('\\').join('/');
}
/**
 * 저장소 상대 디렉터리만 허용한다. 절대 경로·`..` 탈출은 거부해
 * graphify 입력이 작업 트리 밖으로 새지 않게 한다.
 *
 * @param {unknown} value - 검사할 경로 후보
 * @returns {boolean} 상대·비탈출 문자열이면 true
 */
function isSafeRepoRelativeDir(value) {
    if (typeof value !== 'string' || value.length === 0)
        return false;
    const posix = toPosix(value);
    // path.isAbsolute는 플랫폼 절대만 본다. POSIX 절대·드라이브 문자는
    // Windows host에서도 명시적으로 막는다.
    if (path.isAbsolute(value) || path.isAbsolute(posix))
        return false;
    if (posix.startsWith('/') || /^[A-Za-z]:/.test(posix))
        return false;
    if (posix.split('/').includes('..'))
        return false;
    return true;
}
/**
 * graphify.test_dirs / exclude_dirs 공통 파서. 문자열 배열이 아니거나
 * 안전하지 않은 항목이 있으면 값을 적용하지 않고 진단 사유만 남긴다.
 *
 * @param {unknown} raw - config 필드 원본
 * @param {string} fieldName - 진단에 쓸 필드 이름
 * @returns {DirListParse} 성공 시 dirs, 실패 시 reason
 */
function parseDirList(raw, fieldName) {
    if (!Array.isArray(raw)) {
        return { ok: false, reason: `${fieldName} must be a string array of repo-relative paths` };
    }
    if (!raw.every(isSafeRepoRelativeDir)) {
        return {
            ok: false,
            reason: `${fieldName} entries must be repo-relative paths without '..' or absolute roots`,
        };
    }
    return { ok: true, dirs: raw };
}
function graphifyObject(cfg) {
    const graphify = configField(cfg, 'graphify');
    if (!graphify || typeof graphify !== 'object' || Array.isArray(graphify))
        return null;
    return graphify;
}
/**
 * 선택 필드 graphify.test_dirs를 읽는다. 키 부재는 present:false —
 * resolveGraphScopes가 test 항목을 skip-unconfigured로 실을 때 쓴다.
 * 잘못된 값은 적용하지 않고 skipReason만 돌려 호출자가 skips와
 * skip-unconfigured reason에 같은 사유를 싣게 한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @returns {OptionalDirList} 부재·유효 dirs·무효 skip
 */
function realTestDirs(repoRoot) {
    const graphify = graphifyObject(readConfig(repoRoot));
    if (!graphify || !Object.prototype.hasOwnProperty.call(graphify, 'test_dirs')) {
        return { present: false };
    }
    const parsed = parseDirList(graphify.test_dirs, 'graphify.test_dirs');
    if (!parsed.ok)
        return { present: true, dirs: null, skipReason: parsed.reason };
    return { present: true, dirs: parsed.dirs };
}
/**
 * 선택 필드 graphify.exclude_dirs를 읽는다. 키 부재·빈 배열은 제외
 * 없음을 뜻하며 JavaScript를 생성물로 추측해 지우지 않는다. 무효 값도
 * 빈 제외로 수렴하고 skipReason만 남긴다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @returns {{ dirs: string[], skipReason?: string }} 적용할 prefix와 선택적 사유
 */
function realExcludeDirs(repoRoot) {
    const graphify = graphifyObject(readConfig(repoRoot));
    if (!graphify || !Object.prototype.hasOwnProperty.call(graphify, 'exclude_dirs')) {
        return { dirs: [] };
    }
    const parsed = parseDirList(graphify.exclude_dirs, 'graphify.exclude_dirs');
    if (!parsed.ok)
        return { dirs: [], skipReason: parsed.reason };
    return { dirs: parsed.dirs };
}
function realGraphifyEnabled(repoRoot) {
    // ?? {}를 붙이지 않는다. 부재를 빈 객체와 같게 보면 enabled 판정이
    // "키 없음"과 "파일 없음"을 구분하지 못하게 되고, 둘 다 false로 떨어져
    // 겉보기엔 같아 보이지만 cfg?. 전제(null 유지)가 깨진다.
    const cfg = readConfig(repoRoot);
    const graphify = configField(cfg, 'graphify');
    const enabled = graphify && typeof graphify === 'object'
        ? graphify.enabled
        : undefined;
    return enabled === true;
}
function realSourceDirs(repoRoot) {
    const cfg = readConfig(repoRoot);
    const dirs = configField(cfg, 'source_dirs');
    return Array.isArray(dirs) ? dirs : [];
}
function realContextDirs(repoRoot) {
    const cfg = readConfig(repoRoot);
    const dirs = configField(cfg, 'context_dirs');
    if (Array.isArray(dirs))
        return dirs;
    return DEFAULT_CONTEXT_DIRS;
}
function realExistingDirs(repoRoot, dirs) {
    return dirs.filter((d) => fs.existsSync(path.join(repoRoot, d)));
}
function newestMtimeUnder(repoRoot, dir) {
    const root = path.join(repoRoot, dir);
    let newest = 0;
    const walk = (abs) => {
        let entries;
        try {
            entries = fs.readdirSync(abs, { withFileTypes: true });
        }
        catch (_e) {
            return;
        }
        for (const e of entries) {
            const child = path.join(abs, e.name);
            // exclude set 밖의 실제 디렉터리만 descend. symlink dir은
            // 따라가지 않음 — 링크가 ancestor를 가리킬 때 cycle 방지.
            if (e.isDirectory()) {
                if (!e.isSymbolicLink() && !SCAN_EXCLUDED_DIRS.has(e.name))
                    walk(child);
                continue;
            }
            const m = fs.statSync(child).mtimeMs;
            if (m > newest)
                newest = m;
        }
    };
    walk(root);
    return newest;
}
/**
 * dirs 는 보통 디렉터리 walk, watchFiles 는 Distill 같은 단일 파일 mtime.
 * 디렉터리가 아닌 경로는 walk 하지 않고 statSync 로 직접 잰다.
 */
function realNewestMtime(repoRoot, dirs, watchFiles) {
    let newest = 0;
    for (const d of dirs || []) {
        const abs = path.join(repoRoot, d);
        let st;
        try {
            st = fs.statSync(abs);
        }
        catch (_e) {
            continue;
        }
        if (st.isDirectory()) {
            newest = Math.max(newest, newestMtimeUnder(repoRoot, d));
        }
        else if (st.mtimeMs > newest) {
            newest = st.mtimeMs;
        }
    }
    const files = [...(watchFiles || [])];
    // 기존 scope 객체의 watchFiles 계약은 index 하나로 유지하되, Distill
    // 샤드는 그 인덱스와 별개로 추가·수정·삭제될 수 있다. 디렉터리를
    // freshness 입력으로 확장하면 파생 graphify-out은 계속 제외하면서
    // 정본 샤드의 lifecycle만 관찰할 수 있다.
    if (files.includes('.bouncer/Distill.md') && !files.includes(DISTILL_SHARD_DIR)) {
        files.push(DISTILL_SHARD_DIR);
    }
    for (const f of files) {
        const abs = path.join(repoRoot, f);
        let st;
        try {
            st = fs.statSync(abs);
        }
        catch (_e) {
            continue;
        }
        if (st.isDirectory()) {
            // 파일 삭제는 남은 파일의 mtime을 바꾸지 않고 부모 디렉터리만
            // 갱신한다. shard 디렉터리 자체를 포함해야 등록 파일의 삭제도
            // freshness 입력으로 남는다.
            newest = Math.max(newest, st.mtimeMs, newestMtimeUnder(repoRoot, f));
        }
        else if (st.mtimeMs > newest) {
            newest = st.mtimeMs;
        }
    }
    return newest;
}
function realGraphMtime(repoRoot, outDir) {
    const abs = path.join(repoRoot, outDir, 'graph.json');
    return fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : null;
}
/**
 * source·test·context 세 scope 계획을 항상 만든다. testDirs가 null/undefined면
 * 빌드 불가 test 항목을 남기고 unconfiguredReason을 싣는다(보고 길이 3 유지).
 * 빈 배열은 필드 존재 → skip-no-dirs. excludeDirs는 source에만 실어 merge 뒤
 * 필터가 소비한다 — 빈 목록이면 필터 no-op.
 *
 * @param {{
 *   sourceDirs: string[],
 *   contextDirs: string[],
 *   testDirs?: string[] | null,
 *   excludeDirs?: string[],
 *   testUnconfiguredReason?: string
 * }} args
 * @returns {GraphScopePlan[]} 빌드·freshness 계획 목록(길이 3)
 */
function resolveGraphScopes({ sourceDirs, contextDirs, testDirs, excludeDirs, testUnconfiguredReason }) {
    const source = {
        name: 'source',
        dirs: sourceDirs,
        outDir: DEFAULT_SOURCE_OUT,
        // exclude_dirs·test_dirs는 config에만 있다. source 입력 mtime만 보면
        // exclude를 바꾼 뒤에도 skip-fresh로 남아 필터가 한 번도 안 돈다.
        // config mtime을 freshness에 넣어 다음 sync가 rebuild·재필터하게 한다.
        watchFiles: ['.bouncer/config.json'],
    };
    // 빈 배열도 "명시적 제외 없음"이라 키를 붙여도 no-op이지만, 호출자가
    // 넘긴 목록만 실어 진단·테스트가 계획 객체를 읽을 수 있게 한다.
    if (excludeDirs && excludeDirs.length > 0) {
        source.excludeDirs = excludeDirs;
    }
    else if (excludeDirs) {
        source.excludeDirs = [];
    }
    const scopes = [source];
    // null/undefined = 미설정·무효 → skip-unconfigured 자리표시. 빈 배열은
    // 필드 존재 → planOneGraph가 skip-no-dirs로 수렴한다(skip-unconfigured 아님).
    if (testDirs != null) {
        scopes.push({ name: 'test', dirs: testDirs, outDir: DEFAULT_TEST_OUT });
    }
    else {
        scopes.push({
            name: 'test',
            dirs: [],
            outDir: DEFAULT_TEST_OUT,
            // 존재하지 않는 입력을 꾸며 싣지 않는다 — configured도 비운다.
            unconfiguredReason: testUnconfiguredReason
                || 'graphify.test_dirs is not configured',
        });
    }
    scopes.push({
        name: 'context',
        dirs: contextDirs,
        outDir: DEFAULT_CONTEXT_OUT,
        // 빌드는 파생 트리를 스캔하고, freshness 는 dirs+watchFiles(원본)만 본다.
        scanDirs: [CONTEXT_DIGEST_OUT],
        watchFiles: [...DIGEST_WATCH_FILES],
    });
    return scopes;
}
module.exports = {
    SCAN_EXCLUDED_DIRS,
    DEFAULT_SOURCE_OUT,
    DEFAULT_TEST_OUT,
    DEFAULT_CONTEXT_OUT,
    DEFAULT_CONTEXT_DIRS,
    realGraphifyEnabled,
    realSourceDirs,
    realContextDirs,
    realTestDirs,
    realExcludeDirs,
    parseDirList,
    isSafeRepoRelativeDir,
    realExistingDirs,
    newestMtimeUnder,
    realNewestMtime,
    realGraphMtime,
    resolveGraphScopes,
};
