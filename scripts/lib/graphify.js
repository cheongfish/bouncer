'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const config = require("./config");
const { readConfig } = config;
const runtimeState = require("./runtime-state");
const { runtimePaths } = runtimeState;
const time = require("./time");
const { nowIsoKst } = time;
/**
 * 레거시·비-git 폴백용 저장소-상대 경로.
 * Windows만 Scripts/ + .exe; 그 외는 bin/. 구분자는 항상 POSIX(/)로 고정해
 * config·테스트·로그가 OS cwd 구분자에 흔들리지 않게 한다.
 * 신규 설치 위치는 preferredVenvDirAbs — 이 값은 기존 소비자 config와
 * `.bouncer/.venv` 재사용 후보에만 쓴다.
 */
function venvBinRel(platform) {
    if (platform === 'win32')
        return '.bouncer/.venv/Scripts/graphify.exe';
    return '.bouncer/.venv/bin/graphify';
}
// venv 루트 기준 실행 파일. 신규 위치·레거시 위치가 같은 Scripts/ vs bin/ 규칙을 공유한다.
function venvExecRel(platform, kind) {
    if (platform === 'win32') {
        return kind === 'pip' ? 'Scripts/pip.exe' : 'Scripts/graphify.exe';
    }
    return kind === 'pip' ? 'bin/pip' : 'bin/graphify';
}
function preferredVenvDirAbs(repoRoot) {
    // runtime-state와 같은 rev-parse --git-common-dir. 새 경로 개념을 만들지 않는다.
    // common dir 아래면 worktree git add 대상이 아니므로 B1 재현이 끊긴다.
    const paths = runtimePaths({ repoRoot });
    if (!paths.unavailable && typeof paths.commonGitDir === 'string' && paths.commonGitDir) {
        return path.join(paths.commonGitDir, 'bouncer', 'venv');
    }
    // 비-git 디렉터리(init 픽스처 포함)는 common dir이 없다. 기존 위치로 폴백.
    return path.join(repoRoot, '.bouncer', '.venv');
}
function venvBinAbsAt(venvDir, platform) {
    return path.join(venvDir, venvExecRel(platform, 'graphify'));
}
function venvPythonAbsAt(venvDir, platform) {
    return path.join(venvDir, platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}
function uvBinFor(platform) {
    return platform === 'win32' ? 'uv.exe' : 'uv';
}
function removeCreatedVenvDir(venvDir, createdThisRun) {
    // 이번 실행이 mkdir/venv 한 디렉터리만 지운다. 이미 있던 잔해·공유 bouncer/ 는 건드리지 않는다.
    if (!createdThisRun)
        return;
    try {
        fs.rmSync(venvDir, { recursive: true, force: true });
    }
    catch (_e) {
        // 정리 실패는 원래 설치 실패 reason을 덮지 않는다.
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
    }
    catch (_e) {
        // 계약: 어떤 입력·주입 실패에도 throw하지 않는다.
        return { bin: null, source: null };
    }
}
const GRAPHIFY_LOCK_REL = '.bouncer/graphify.lock.json';
const GRAPH_OUT_DIRS = ['graphify-out/source', 'graphify-out/test', 'graphify-out/context'];
function pluginRootFromLib() {
    // 컴파일 산출물은 scripts/lib. 플러그인 루트의 resources/·plugin.json 을 가리킨다.
    return path.join(__dirname, '..', '..');
}
function defaultManifestPath() {
    return path.join(pluginRootFromLib(), 'resources', 'graphify-compat.json');
}
function catchMessageOrString(error) {
    // 예전 `e && e.message ? e.message : String(e)` 와 같다. extra null 가드를
    // 넣으면 throw null이 TypeError 대신 'null' 문자열이 된다.
    const message = error && error.message;
    return message ? String(message) : String(error);
}
function parseDottedVersion(text) {
    const match = String(text || '').match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
}
function packageVersionFromSpec(installSpec) {
    const match = String(installSpec || '').match(/==(.+)$/);
    return match ? match[1] : null;
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.length > 0;
}
function readPluginVersion() {
    for (const name of ['plugin.json', 'package.json']) {
        try {
            const body = JSON.parse(fs.readFileSync(path.join(pluginRootFromLib(), name), 'utf8'));
            if (body.name === 'bouncer' && isNonEmptyString(body.version))
                return body.version;
        }
        catch (_e) {
            // 다음 메타데이터 파일을 본다.
        }
    }
    return '0.0.0';
}
/**
 * 플러그인 소유 Graphify 호환 계약을 읽는다. 소비 저장소 config에 권장 버전을
 * 복제하지 않고, 이 파일만 정본으로 쓴다.
 *
 * @param {{ manifestPath?: string }} [opts] - 테스트 주입용 절대 경로
 * @returns {{ ok: true, value: CompatManifest } | { ok: false, reason: string }}
 */
function loadCompatManifest(opts = {}) {
    const abs = typeof opts.manifestPath === 'string' && opts.manifestPath
        ? opts.manifestPath
        : defaultManifestPath();
    try {
        const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
        if (raw.schema_version !== 1
            || !isNonEmptyString(raw.package)
            || !isNonEmptyString(raw.install_spec)
            || !isNonEmptyString(raw.cli_version)
            || !isNonEmptyString(raw.graph_schema_version)
            || !isNonEmptyString(raw.python_minimum)) {
            return { ok: false, reason: 'invalid' };
        }
        const value = {
            schema_version: 1,
            package: raw.package,
            install_spec: raw.install_spec,
            cli_version: raw.cli_version,
            graph_schema_version: raw.graph_schema_version,
            python_minimum: raw.python_minimum,
        };
        if (isNonEmptyString(raw.skill_version))
            value.skill_version = raw.skill_version;
        return { ok: true, value };
    }
    catch (error) {
        const err = error;
        return {
            ok: false,
            reason: err && err.code === 'ENOENT' ? 'missing' : 'corrupt',
        };
    }
}
function lockPathFor(repoRoot) {
    return path.join(repoRoot, GRAPHIFY_LOCK_REL);
}
function asGraphifyLock(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const rec = raw;
    if (rec.schema_version !== 1
        || !isNonEmptyString(rec.package)
        || !isNonEmptyString(rec.package_version)
        || !isNonEmptyString(rec.cli_version)
        || !isNonEmptyString(rec.bouncer_version)
        || !isNonEmptyString(rec.graph_schema_version)
        || !isNonEmptyString(rec.installed_at)) {
        return null;
    }
    const lock = {
        schema_version: 1,
        package: rec.package,
        package_version: rec.package_version,
        cli_version: rec.cli_version,
        bouncer_version: rec.bouncer_version,
        graph_schema_version: rec.graph_schema_version,
        installed_at: rec.installed_at,
    };
    if (isNonEmptyString(rec.executable))
        lock.executable = rec.executable;
    return lock;
}
/**
 * 소비 저장소 lock을 읽는다. 조회 경로에서는 파일 읽기만 하고 쓰지 않는다.
 *
 * @param {{ repoRoot: string }} opts - 소비 저장소 루트
 * @returns {{ ok: true, value: GraphifyLock } | { ok: false, reason: string }}
 */
function readGraphifyLock({ repoRoot } = {}) {
    const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
    const abs = lockPathFor(root);
    if (!fs.existsSync(abs))
        return { ok: false, reason: 'missing' };
    try {
        const lock = asGraphifyLock(JSON.parse(fs.readFileSync(abs, 'utf8')));
        if (!lock)
            return { ok: false, reason: 'invalid' };
        return { ok: true, value: lock };
    }
    catch (_e) {
        return { ok: false, reason: 'corrupt' };
    }
}
/**
 * lock을 같은 디렉터리 tmp + rename으로 원자 기록한다. 다른 볼륨 tmp는
 * 쓰지 않는다 — rename이 copy가 되면 중간 파일이 남는다.
 *
 * @param {{ repoRoot: string, lock: GraphifyLock }} opts - 기록 대상
 * @returns {{ ok: boolean, path: string, reason?: string }}
 */
function writeGraphifyLock({ repoRoot, lock }) {
    const parsed = asGraphifyLock(lock);
    const abs = lockPathFor(repoRoot);
    if (!parsed)
        return { ok: false, path: abs, reason: 'invalid' };
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const temporary = `${abs}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(parsed, null, 2)}\n`);
        fs.renameSync(temporary, abs);
        return { ok: true, path: abs };
    }
    catch (error) {
        try {
            fs.rmSync(temporary, { force: true });
        }
        catch (_cleanup) {
            // tmp 정리는 best-effort. rename 실패 원인을 가리지 않는다.
        }
        return { ok: false, path: abs, reason: catchMessageOrString(error) };
    }
}
function lockMatchesManifest(lock, manifest) {
    const reasons = [];
    const expectedPkg = packageVersionFromSpec(manifest.install_spec);
    if (lock.package !== manifest.package) {
        reasons.push(`package ${lock.package} != ${manifest.package}`);
    }
    if (expectedPkg && lock.package_version !== expectedPkg) {
        reasons.push(`package_version ${lock.package_version} != ${expectedPkg}`);
    }
    if (lock.cli_version !== manifest.cli_version) {
        reasons.push(`cli_version ${lock.cli_version} != ${manifest.cli_version}`);
    }
    if (lock.graph_schema_version !== manifest.graph_schema_version) {
        reasons.push(`graph_schema_version ${lock.graph_schema_version} != ${manifest.graph_schema_version}`);
    }
    return reasons;
}
function probeCliVersion(bin, run) {
    try {
        const out = run(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        return parseDottedVersion(String(out || ''));
    }
    catch (_e) {
        return null;
    }
}
function probePackageVersion(pipAbs, pkg, run) {
    try {
        const out = run(pipAbs, ['show', pkg], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const match = String(out || '').match(/^Version:\s*(\S+)/m);
        return match ? match[1] : parseDottedVersion(String(out || ''));
    }
    catch (_e) {
        return null;
    }
}
function pythonMeetsMinimum(minimum, run) {
    try {
        const out = run('python3', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const match = String(out || '').match(/(\d+)\.(\d+)/);
        if (!match)
            return null;
        const [minMaj, minMin] = String(minimum).split('.').map((n) => Number(n) || 0);
        const maj = Number(match[1]);
        const min = Number(match[2]);
        return maj > minMaj || (maj === minMaj && min >= minMin);
    }
    catch (_e) {
        return null;
    }
}
/**
 * 설치가 확인한 CLI·패키지 버전을 lock에 기록한다. write 실패를 삼키면
 * 승격이 upgraded로 끝나 새 venv와 옛 lock(또는 lock 없음)이 어긋난다.
 *
 * @param {{ repoRoot: string, bin: string, pipAbs: string, run: ExecFn,
 *   now: () => string, manifest: CompatManifest }} opts
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function recordLockFromInstall({ repoRoot, bin, pipAbs, run, now, manifest, }) {
    const cli = probeCliVersion(bin, run) || manifest.cli_version;
    const pkg = probePackageVersion(pipAbs, manifest.package, run)
        || packageVersionFromSpec(manifest.install_spec)
        || manifest.cli_version;
    const written = writeGraphifyLock({
        repoRoot,
        lock: {
            schema_version: 1,
            package: manifest.package,
            package_version: pkg,
            cli_version: cli,
            bouncer_version: readPluginVersion(),
            graph_schema_version: manifest.graph_schema_version,
            installed_at: now(),
            executable: bin,
        },
    });
    if (!written.ok) {
        return { ok: false, reason: written.reason || 'lock-write' };
    }
    return { ok: true };
}
/**
 * lock·manifest·실행 파일 버전을 비교한다. 조회 경로는 파일 읽기와 process
 * 실행만 허용하며 pip·venv·network 쓰기를 하지 않는다.
 *
 * @param {{ repoRoot?: string, exec?: typeof execFileSync, probeSkillVersion?: () => string | null }} opts
 * @returns {CompatResult} compatible | version-incompatible
 */
function checkGraphifyCompatibility({ repoRoot, exec, probeSkillVersion, } = {}) {
    const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
    const run = typeof exec === 'function' ? exec : execFileSync;
    const warnings = [];
    const manifestLoad = loadCompatManifest();
    if (!manifestLoad.ok) {
        return {
            status: 'version-incompatible',
            reasons: [`manifest ${manifestLoad.reason}`],
            warnings,
            lock: null,
            manifest: null,
        };
    }
    const manifest = manifestLoad.value;
    const lockLoad = readGraphifyLock({ repoRoot: root });
    if (!lockLoad.ok) {
        return {
            status: 'version-incompatible',
            reasons: [`lock ${lockLoad.reason}`],
            warnings,
            lock: null,
            manifest,
        };
    }
    const lock = lockLoad.value;
    const reasons = lockMatchesManifest(lock, manifest);
    const pythonOk = pythonMeetsMinimum(manifest.python_minimum, run);
    if (pythonOk === false) {
        reasons.push(`python < ${manifest.python_minimum}`);
    }
    const resolved = resolveGraphifyBin({ repoRoot: root });
    let probeBin = null;
    if (isNonEmptyString(lock.executable) && fs.existsSync(lock.executable)) {
        probeBin = lock.executable;
    }
    else if (resolved.source === 'config' || resolved.source === 'venv') {
        probeBin = resolved.bin;
    }
    // PATH 후보는 소비 저장소 lock이 가리키는 설치가 아니다. lock↔manifest만 본다.
    if (probeBin) {
        const probed = probeCliVersion(probeBin, run);
        if (probed && probed !== manifest.cli_version) {
            reasons.push(`probed cli ${probed} != ${manifest.cli_version}`);
        }
        if (probed && probed !== lock.cli_version) {
            reasons.push(`probed cli ${probed} != lock ${lock.cli_version}`);
        }
    }
    if (typeof probeSkillVersion === 'function' && isNonEmptyString(manifest.skill_version)) {
        const skill = probeSkillVersion();
        if (isNonEmptyString(skill) && skill !== manifest.skill_version) {
            warnings.push(`skill version ${skill} != ${manifest.skill_version}`);
        }
    }
    return {
        status: reasons.length ? 'version-incompatible' : 'compatible',
        reasons,
        warnings,
        lock,
        manifest,
    };
}
/**
 * outDir 아래 일반 파일만 모은다. 디렉터리 엔트리는 파일 경로 mkdir로
 * 되살리므로 따로 저장하지 않는다. 심볼릭 링크는 따라가지 않는다 —
 * graph 산출물에 링크가 있으면 승격 스냅샷이 저장소 밖을 읽지 않게 한다.
 *
 * @param {string} abs - graph 출력 디렉터리 절대 경로
 * @returns {Array<{ rel: string, body: Buffer }>}
 */
function listGraphTreeFiles(abs) {
    const files = [];
    const walk = (dir) => {
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch (_e) {
            // 순회 중 삭제된 하위 디렉터리는 빈 목록으로 둔다.
            return;
        }
        for (const entry of entries) {
            const child = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(child);
            }
            else if (entry.isFile()) {
                files.push({ rel: path.relative(abs, child), body: fs.readFileSync(child) });
            }
        }
    };
    walk(abs);
    return files;
}
/**
 * 세 graph 출력 트리 전체를 스냅샷한다. graph.json만 되돌리면 rebuild가
 * 만든 sidecar·하위 파일이 실패 후에도 남고, 원래 없던 트리는 삭제되지 않는다.
 *
 * @param {string} repoRoot - 소비 저장소 루트
 * @returns {GraphTreeSnap[]}
 */
function snapshotGraphs(repoRoot) {
    return GRAPH_OUT_DIRS.map((outDir) => {
        const abs = path.join(repoRoot, outDir);
        try {
            const st = fs.statSync(abs);
            if (!st.isDirectory()) {
                return { abs, existed: false, files: [] };
            }
            return { abs, existed: true, files: listGraphTreeFiles(abs) };
        }
        catch (_e) {
            return { abs, existed: false, files: [] };
        }
    });
}
/**
 * 스냅샷 트리를 통째로 되돌린다. graph.json만 덮으면 rebuild sidecar가 남고,
 * 원래 없던 출력 디렉터리는 삭제해야 승격 실패가 반쯤 새 graph를 남기지 않는다.
 *
 * @param {GraphTreeSnap[]} snapshot - snapshotGraphs 결과
 * @returns {void}
 */
function restoreGraphs(snapshot) {
    for (const entry of snapshot) {
        removeDirIfExists(entry.abs);
        if (!entry.existed)
            continue;
        fs.mkdirSync(entry.abs, { recursive: true });
        for (const file of entry.files) {
            const dest = path.join(entry.abs, file.rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, file.body);
        }
    }
}
/**
 * 세 graph.json에 플러그인이 검증한 schema 버전을 찍는다. Graphify 원본
 * 필드와 섞이지 않게 metadata 아래로만 넣는다.
 *
 * @param {string} repoRoot - 소비 저장소 루트
 * @param {string} schemaVersion - manifest.graph_schema_version
 * @returns {void}
 */
function stampGraphSchema(repoRoot, schemaVersion) {
    for (const outDir of GRAPH_OUT_DIRS) {
        const abs = path.join(repoRoot, outDir, 'graph.json');
        if (!fs.existsSync(abs))
            continue;
        try {
            const graph = JSON.parse(fs.readFileSync(abs, 'utf8'));
            if (!graph || typeof graph !== 'object' || Array.isArray(graph))
                continue;
            const prev = graph.metadata && typeof graph.metadata === 'object' && !Array.isArray(graph.metadata)
                ? graph.metadata
                : {};
            graph.metadata = { ...prev, graph_schema_version: schemaVersion };
            fs.writeFileSync(abs, JSON.stringify(graph));
        }
        catch (_e) {
            // 깨진 graph는 스탬프를 건너뛴다. upgrade 실패로 올리지 않는다.
        }
    }
}
// CLI syncSessionGraphs(force)가 빌드 없이 돌려주는 skip. failed[]가 비어도
// 승격 성공으로 치면 stampGraphSchema가 옛 graph.json만 새 schema로 찍는다.
const REBUILD_SKIP_WITHOUT_BUILD = new Set([
    'skip-version-incompatible',
    'skip-graph-disabled',
    'skip-partial-bootstrap',
    'skip-legacy-bootstrap',
    'skip-no-graphify',
    'skip-fresh',
]);
/**
 * force rebuild 결과가 승격을 커밋해도 되는지 본다. failed[]만 보면
 * skip-version-incompatible 등이 성공으로 위장되고 옛 graph가 stamp된다.
 * skip-no-dirs는 소스 디렉터리가 없는 순수 no-op이라 실패가 아니다.
 * 테스트 스텁({ ok: true } 등 action 없음)은 기존처럼 failed[]만 본다.
 *
 * @param {unknown} rebuilt - rebuild 콜백 반환값
 * @returns {string | null} 실패 reason. 커밋해도 되면 null
 */
function rebuildFailureReason(rebuilt) {
    if (!rebuilt || typeof rebuilt !== 'object')
        return null;
    const rec = rebuilt;
    if (Array.isArray(rec.failed) && rec.failed.length > 0) {
        const detail = rec.failed
            .map((entry) => {
            if (!entry || typeof entry !== 'object')
                return String(entry);
            const row = entry;
            const name = typeof row.name === 'string' ? row.name : 'unknown';
            const message = typeof row.message === 'string' ? row.message : 'failed';
            return `${name}: ${message}`;
        })
            .join('; ');
        return detail ? `rebuild-failed (${detail})` : 'rebuild-failed';
    }
    const action = rec.action;
    if (typeof action === 'string' && REBUILD_SKIP_WITHOUT_BUILD.has(action)) {
        return `rebuild-${action}`;
    }
    return null;
}
function upgradeLockPath(venvDir) {
    return path.join(path.dirname(venvDir), 'upgrade.lock');
}
function removeDirIfExists(abs) {
    try {
        fs.rmSync(abs, { recursive: true, force: true });
    }
    catch (_e) {
        // 스테이징 정리는 best-effort.
    }
}
/**
 * 표준 venv가 ensurepip 부재로 실패하는 최소 Linux 설치에서도 로컬 uv를
 * 폴백으로 쓴다. uv에는 pip 실행 파일이 필요하므로 --seed를, upgrade의
 * staging rename 뒤 console-script shebang이 깨지지 않도록 --relocatable을 붙인다.
 * 기존 디렉터리는 호출자가 이번 시도용으로 새로 만든 것이 확실할 때만 지운다.
 */
function createSeededVenv({ root, venvDir, plat, run, replaceOnFallback, }) {
    try {
        run('python3', ['-m', 'venv', venvDir], { cwd: root, stdio: 'pipe' });
        return { ok: true, provider: 'python' };
    }
    catch (pythonError) {
        if (!replaceOnFallback) {
            return { ok: false, reason: `venv: ${catchMessageOrString(pythonError)}` };
        }
        // 실패한 python venv가 남긴 부분 디렉터리만 정리한다. upgrade staging과
        // setup이 이번 실행에서 처음 만든 경로만 replaceOnFallback=true를 넘긴다.
        removeDirIfExists(venvDir);
        const uvBin = uvBinFor(plat);
        try {
            run(uvBin, ['venv', '--seed', '--relocatable', '--python', 'python3', venvDir], {
                cwd: root,
                stdio: 'pipe',
            });
            return { ok: true, provider: 'uv' };
        }
        catch (uvError) {
            return {
                ok: false,
                reason: `venv: ${catchMessageOrString(pythonError)}; uv fallback: ${catchMessageOrString(uvError)}`,
            };
        }
    }
}
function installExactSpec({ root, venvDir, plat, run, spec, }) {
    const venv = createSeededVenv({
        root,
        venvDir,
        plat,
        run,
        // upgrade의 stagingDir는 호출 직전 항상 제거한 전용 경로다.
        replaceOnFallback: true,
    });
    if (!venv.ok)
        return venv;
    if (!fs.existsSync(venvDir))
        fs.mkdirSync(venvDir, { recursive: true });
    const pipAbs = path.join(venvDir, venvExecRel(plat, 'pip'));
    const binAbs = venvBinAbsAt(venvDir, plat);
    try {
        if (venv.provider === 'uv') {
            run(uvBinFor(plat), [
                'pip',
                'install',
                '--python',
                venvPythonAbsAt(venvDir, plat),
                spec,
            ], { cwd: root, stdio: 'pipe' });
        }
        else {
            run(pipAbs, ['install', spec], { cwd: root, stdio: 'pipe' });
        }
    }
    catch (e) {
        return { ok: false, reason: `pip: ${catchMessageOrString(e)}` };
    }
    try {
        run(binAbs, ['install'], { cwd: root, stdio: 'pipe' });
    }
    catch (e) {
        return { ok: false, reason: `graphify install: ${catchMessageOrString(e)}` };
    }
    return { ok: true };
}
/**
 * graphify venv 최초 설치(또는 재사용). 이미 bin이 있으면 pip하지 않고
 * 기존 lock을 보존한다. 신규 설치만 manifest exact spec을 쓰고 lock을 기록한다.
 *
 * @param {{ repoRoot?: string, exec?: typeof execFileSync, platform?: string,
 *   now?: () => string, manifestPath?: string }} opts
 * @returns {{ status: 'reused' | 'installed' | 'failed', bin: string | null, reason?: string }}
 */
function setupGraphify({ repoRoot, exec, platform, now, manifestPath, } = {}) {
    try {
        const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
        const plat = typeof platform === 'string' ? platform : process.platform;
        const run = typeof exec === 'function' ? exec : execFileSync;
        const stamp = typeof now === 'function' ? now : () => nowIsoKst();
        const binRel = venvBinRel(plat);
        const legacyBinAbs = path.join(root, binRel);
        const venvDir = preferredVenvDirAbs(root);
        const binAbs = venvBinAbsAt(venvDir, plat);
        // 레거시를 먼저 본다. 있으면 이전·삭제 없이 상대 경로를 그대로 돌려
        // 기존 config 기록 형태를 유지한다. lock도 여기서 다시 쓰지 않는다.
        if (fs.existsSync(legacyBinAbs)) {
            return { status: 'reused', bin: binRel };
        }
        if (fs.existsSync(binAbs)) {
            return { status: 'reused', bin: binAbs };
        }
        const createdThisRun = !fs.existsSync(venvDir);
        // 하드코드 spec 폴백은 정본이 없을 때도 pip이 돌아가 lock 없이 venv만
        // 남긴다. manifest가 SSOT이므로 로드 실패는 설치를 시작하지 않는다.
        const manifestLoad = loadCompatManifest(typeof manifestPath === 'string' ? { manifestPath } : {});
        if (!manifestLoad.ok) {
            return {
                status: 'failed',
                bin: null,
                reason: `manifest ${manifestLoad.reason}`,
            };
        }
        const spec = manifestLoad.value.install_spec;
        // 1) venv 생성 — 절대 경로라 cwd와 무관하게 common dir / 폴백 위치를 가리킨다.
        const venv = createSeededVenv({
            root,
            venvDir,
            plat,
            run,
            replaceOnFallback: createdThisRun,
        });
        if (!venv.ok) {
            removeCreatedVenvDir(venvDir, createdThisRun);
            return {
                status: 'failed',
                bin: null,
                reason: venv.reason,
            };
        }
        // 2) pip은 exact spec만. 언핀 graphifyy는 조회마다 다른 환경을 만든다.
        const pipAbs = path.join(venvDir, venvExecRel(plat, 'pip'));
        try {
            if (venv.provider === 'uv') {
                run(uvBinFor(plat), [
                    'pip',
                    'install',
                    '--python',
                    venvPythonAbsAt(venvDir, plat),
                    spec,
                ], { cwd: root, stdio: 'pipe' });
            }
            else {
                run(pipAbs, ['install', spec], { cwd: root, stdio: 'pipe' });
            }
        }
        catch (e) {
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
        }
        catch (e) {
            removeCreatedVenvDir(venvDir, createdThisRun);
            return {
                status: 'failed',
                bin: null,
                reason: `graphify install: ${catchMessageOrString(e)}`,
            };
        }
        const recorded = recordLockFromInstall({
            repoRoot: root,
            bin: binAbs,
            pipAbs,
            run,
            now: stamp,
            manifest: manifestLoad.value,
        });
        if (!recorded.ok) {
            removeCreatedVenvDir(venvDir, createdThisRun);
            return {
                status: 'failed',
                bin: null,
                reason: `lock: ${recorded.reason}`,
            };
        }
        return { status: 'installed', bin: binAbs };
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
/**
 * 명시적 승격. 공유 common-dir venv를 staging에 설치한 뒤 성공할 때만 live와
 * 맞바꾸고 세 graph를 재생성한다. 실패 시 lock·venv·graph는 승격 전 상태로 남긴다.
 *
 * @param {{ repoRoot?: string, exec?: typeof execFileSync, platform?: string,
 *   now?: () => string, rebuild?: Function }} opts
 * @returns {{ status: 'upgraded' | 'failed', bin: string | null, reason?: string }}
 */
function upgradeGraphify({ repoRoot, exec, platform, now, rebuild, } = {}) {
    try {
        return runUpgradeGraphify({ repoRoot, exec, platform, now, rebuild });
    }
    catch (error) {
        return { status: 'failed', bin: null, reason: catchMessageOrString(error) };
    }
}
function runUpgradeGraphify({ repoRoot, exec, platform, now, rebuild, }) {
    const root = typeof repoRoot === 'string' ? repoRoot : process.cwd();
    const plat = typeof platform === 'string' ? platform : process.platform;
    const run = typeof exec === 'function' ? exec : execFileSync;
    const stamp = typeof now === 'function' ? now : () => nowIsoKst();
    const venvDir = preferredVenvDirAbs(root);
    const stagingDir = `${venvDir}.next`;
    const backupDir = `${venvDir}.prev`;
    const exclusivePath = upgradeLockPath(venvDir);
    const manifestLoad = loadCompatManifest();
    if (!manifestLoad.ok) {
        return { status: 'failed', bin: null, reason: `manifest ${manifestLoad.reason}` };
    }
    const manifest = manifestLoad.value;
    const lockAbs = lockPathFor(root);
    let priorLock = null;
    try {
        priorLock = fs.readFileSync(lockAbs);
    }
    catch (_e) {
        priorLock = null;
    }
    const graphSnap = snapshotGraphs(root);
    fs.mkdirSync(path.dirname(exclusivePath), { recursive: true });
    let lockFd;
    try {
        lockFd = fs.openSync(exclusivePath, 'wx');
    }
    catch (error) {
        const err = error;
        if (err && err.code === 'EEXIST') {
            return { status: 'failed', bin: null, reason: 'concurrent-upgrade' };
        }
        return { status: 'failed', bin: null, reason: catchMessageOrString(error) };
    }
    const restorePrior = (swapped) => {
        // graph·venv를 lock보다 먼저 되돌린다. lock 경로가 디렉터리이거나
        // writeFileSync가 throw하면 예전에는 이 두 복구가 통째로 건너뛰어
        // 스왑된 venv와 반쯤 새 graph가 남았다.
        restoreGraphs(graphSnap);
        if (swapped) {
            removeDirIfExists(venvDir);
            if (fs.existsSync(backupDir)) {
                try {
                    fs.renameSync(backupDir, venvDir);
                }
                catch (_e) {
                    // live 복구 실패는 아래 reason이 가리킨다.
                }
            }
        }
        if (priorLock) {
            try {
                fs.mkdirSync(path.dirname(lockAbs), { recursive: true });
                fs.writeFileSync(lockAbs, priorLock);
            }
            catch (_e) {
                // lock 경로가 디렉터리·권한 오류여도 graph·venv 복구는 이미 끝냈다.
                // 삭제는 목표(lock 없음)와 같고, 여기서는 옛 바이트를 못 쓴 것뿐이다.
            }
        }
        else {
            // 승격 전 lock이 없었으면 스왑 후 기록한 새 lock을 남기지 않는다.
            // 복원 바이트가 없는데 삭제를 빼면, 복구된 옛 venv와 새 lock이 짝이 안 맞는다.
            try {
                fs.rmSync(lockAbs, { force: true });
            }
            catch (_e) {
                // lock 부재는 목표 상태와 같다.
            }
        }
        removeDirIfExists(stagingDir);
    };
    let swapped = false;
    try {
        removeDirIfExists(stagingDir);
        const installed = installExactSpec({
            root,
            venvDir: stagingDir,
            plat,
            run,
            spec: manifest.install_spec,
        });
        if (!installed.ok) {
            restorePrior(false);
            return { status: 'failed', bin: null, reason: installed.reason };
        }
        if (fs.existsSync(venvDir)) {
            removeDirIfExists(backupDir);
            fs.renameSync(venvDir, backupDir);
        }
        fs.renameSync(stagingDir, venvDir);
        swapped = true;
        const binAbs = venvBinAbsAt(venvDir, plat);
        const pipAbs = path.join(venvDir, venvExecRel(plat, 'pip'));
        // rebuild가 호환성 검사에서 옛 lock을 보고 skip하지 않게, 스왑 직후 lock을 먼저 쓴다.
        // write 실패를 무시하면 swapped venv 위에 새 lock이 없거나 불완전해도 upgraded가 된다.
        const recorded = recordLockFromInstall({
            repoRoot: root,
            bin: binAbs,
            pipAbs,
            run,
            now: stamp,
            manifest,
        });
        if (!recorded.ok) {
            restorePrior(true);
            return { status: 'failed', bin: null, reason: `lock: ${recorded.reason}` };
        }
        if (typeof rebuild === 'function') {
            const rebuilt = rebuild({ repoRoot: root });
            const rebuildReason = rebuildFailureReason(rebuilt);
            if (rebuildReason) {
                restorePrior(true);
                return { status: 'failed', bin: null, reason: rebuildReason };
            }
        }
        stampGraphSchema(root, manifest.graph_schema_version);
        removeDirIfExists(backupDir);
        return { status: 'upgraded', bin: binAbs };
    }
    catch (error) {
        restorePrior(swapped);
        return { status: 'failed', bin: null, reason: catchMessageOrString(error) };
    }
    finally {
        try {
            fs.closeSync(lockFd);
        }
        catch (_e) {
            // fd 정리는 best-effort.
        }
        try {
            fs.unlinkSync(exclusivePath);
        }
        catch (_e) {
            // 락 파일 잔류는 다음 승격이 concurrent로 거절하게 한다.
        }
    }
}
module.exports = {
    venvBinRel,
    resolveGraphifyBin,
    setupGraphify,
    upgradeGraphify,
    loadCompatManifest,
    readGraphifyLock,
    writeGraphifyLock,
    checkGraphifyCompatibility,
    GRAPHIFY_LOCK_REL,
};
