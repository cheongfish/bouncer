'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { execFileSync: realExecFileSync } = require('node:child_process');
const paths = require("./paths");
const { toPosix, parsePathIds } = paths;
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const schema = require("./schema");
const { DEFAULT_COMMIT_TYPE, COMMIT_TYPE_ENUM } = schema;
const GIT_REQUIRED = 'Bouncer requires a Git repository for an active blueprint';
class BranchNameError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
function nonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}
/**
 * blueprint 메타데이터와 경로에서 coordinator가 공유할 branch 이름을 만든다.
 * index.md가 없거나 읽히지 않으면 기존 fixture와 이전 blueprint를 보존하기 위해
 * DEFAULT_COMMIT_TYPE으로 계속 진행하지만, 명시된 잘못된 commit_type은 새 worktree
 * 생성 전에 거절한다.
 *
 * @param {{ repoRoot: string, blueprint: string, task?: string }} opts - 저장소와 blueprint 식별자
 * @returns {BranchNames} integration·standalone 및 선택 worker branch 이름
 * @throws {BranchNameError} 명시 commit_type 또는 Git ref 형식이 유효하지 않을 때
 */
function branchNamesFor({ repoRoot, blueprint, task }) {
    const { epicId, blueprintId } = parsePathIds(blueprint);
    const slug = path.basename(blueprint).replace(new RegExp(`^${blueprintId}-`), '');
    let commitType = DEFAULT_COMMIT_TYPE;
    try {
        const doc = readDoc(path.join(repoRoot, blueprint, 'index.md'));
        const bouncer = doc.data.bouncer;
        if (bouncer && Object.prototype.hasOwnProperty.call(bouncer, 'commit_type'))
            commitType = bouncer.commit_type;
    }
    catch (_error) {
        // index.md 부재·frontmatter 오류는 기존 bootstrap fixture와 같은 폴백이다.
    }
    if (typeof commitType !== 'string' || !COMMIT_TYPE_ENUM.includes(commitType)) {
        throw new BranchNameError('invalid-commit-type');
    }
    const integration = `${commitType}/${epicId}-${blueprintId}-${slug}`;
    const result = { integration, standalone: integration };
    if (task !== undefined)
        result.worker = `bouncer/${epicId}-${blueprintId}-${task}`;
    for (const branch of Object.values(result)) {
        if (!branch || branch.includes('..') || /[ ~^:?*\\[\\]/.test(branch)) {
            throw new BranchNameError('invalid-branch-name');
        }
    }
    return result;
}
/**
 * 등록된 checkout은 실제 branch를 유지하고, 새 checkout만 예상 branch를 만든다.
 * 같은 branch를 다른 worktree가 잡고 있으면 suffix로 피해 provenance를 흐리지 않고
 * 명시적으로 충돌을 돌려준다.
 *
 * @param {{ repoRoot: string, worktreePath: string, branch: string, execFileSync?: ExecFileSyncFn }} opts
 *   - Git 저장소와 예상 checkout/branch
 * @returns {WorktreeBranch} 기존 branch 재사용 또는 새 branch 생성 지시
 * @throws {BranchNameError} ref 형식 오류나 다른 checkout의 branch 충돌일 때
 */
function resolveWorktreeBranch({ repoRoot, worktreePath, branch, execFileSync = realExecFileSync }) {
    let listed;
    try {
        listed = String(execFileSync('git', ['worktree', 'list', '--porcelain'], {
            cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        }));
    }
    catch (_error) {
        listed = '';
    }
    const entries = listed.trim().split(/\n\n+/).filter(Boolean).map((block) => {
        const lines = block.split('\n');
        return { path: lines.find((line) => line.startsWith('worktree '))?.slice(9),
            branch: lines.find((line) => line.startsWith('branch refs/heads/'))?.slice('branch refs/heads/'.length) };
    });
    const existing = entries.find((entry) => entry.path && path.resolve(entry.path) === path.resolve(worktreePath));
    if (existing?.branch)
        return { action: 'reuse', branch: existing.branch };
    try {
        execFileSync('git', ['check-ref-format', '--branch', branch], {
            cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        });
    }
    catch (_error) {
        throw new BranchNameError('invalid-branch-name');
    }
    try {
        execFileSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
            cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        });
        throw new BranchNameError('branch-conflict');
    }
    catch (error) {
        if (error instanceof BranchNameError)
            throw error;
    }
    return { action: 'create', branch };
}
function stringList(value, nonEmpty = false) {
    return Array.isArray(value) && (!nonEmpty || value.length > 0)
        && value.every((entry) => nonEmptyString(entry));
}
function dagDecision(value) {
    return Array.isArray(value) && value.every((entry) => Boolean(entry && typeof entry === 'object'
        && !Array.isArray(entry) && nonEmptyString(entry.id)
        && stringList(entry.depends_on)));
}
/** coordinator가 기록한 task별 critical recovery 한 번의 shape를 고정한다. */
function validCriticalRecovery(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const recovery = value;
    return recovery.used === 1 && stringList(recovery.findings, true)
        && nonEmptyString(recovery.reason)
        && (recovery.outcome === null || recovery.outcome === 'resolved' || recovery.outcome === 'blocked');
}
/**
 * partial close가 신뢰하는 canonical repair 항목의 전체 shape를 검사한다.
 * task/wave 식별자만 맞춘 복사본은 scope·DAG·실패 근거를 바꿔치기할 수 있으므로,
 * 원장 사본 비교 전에 각 필드와 실제 실패 경로를 먼저 고정한다.
 */
function validRepairDecision(value, expectedWave) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const decision = value;
    const failure = decision.failure;
    if (!failure || typeof failure !== 'object' || Array.isArray(failure))
        return false;
    const evidence = failure;
    return decision.kind === 'repair' && decision.wave === expectedWave
        && nonEmptyString(decision.task) && nonEmptyString(decision.reason)
        && nonEmptyString(evidence.task) && nonEmptyString(evidence.command)
        && nonEmptyString(evidence.summary) && stringList(evidence.paths, true)
        && typeof evidence.exitCode === 'number' && evidence.exitCode !== 0
        && evidence.repairWave === expectedWave - 1
        && dagDecision(decision.previousDag) && dagDecision(decision.nextDag)
        && stringList(decision.previousScope) && stringList(decision.nextScope, true)
        && nonEmptyString(decision.necessity)
        && nonEmptyString(decision.revision) && /^r[1-9]\d*$/.test(decision.revision);
}
/**
 * coordinator 원장의 repair/partial-close 불변조건을 검증한다.
 * 활성 원장은 레거시 필드 부재를 허용하지만 partial_closed는 두 wave, 마지막
 * 실패 증적, 명시적 사용자 확인이 모두 있어야만 유효하다.
 *
 * @param {unknown} value - 파싱된 coordinator 원장
 * @returns {{ok: true} | {ok: false, reason: string}} 검증 결과
 */
function validateCoordinatorLedger(value, options = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, reason: 'invalid-ledger' };
    }
    const ledger = value;
    if (ledger.seedManifest !== undefined && (!Array.isArray(ledger.seedManifest)
        || ledger.seedManifest.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry)
            || !nonEmptyString(entry.path)
            || !/^[a-f0-9]{64}$/.test(entry.sha256)))) {
        return { ok: false, reason: 'invalid-seed-manifest' };
    }
    // partial_closed 여부와 무관하게 먼저 검사한다. 조기 성공 반환 뒤에 두면 active
    // ledger가 used 2를 품은 채 다음 coordinator 명령의 기준점이 될 수 있다.
    const tasksForRecovery = Array.isArray(ledger.tasks) ? ledger.tasks : [];
    if (tasksForRecovery.some((task) => task.criticalRecovery !== undefined
        && !validCriticalRecovery(task.criticalRecovery))) {
        return { ok: false, reason: 'critical-recovery-invalid' };
    }
    // branch 필드는 이전 원장에는 없을 수 있지만, 있으면 이후 재개가 Git의 실제
    // checkout을 신뢰할 수 있도록 문자열이어야 한다. 여기서 느슨하게 받으면
    // prepare가 잘못된 값을 정상 branch 기록으로 덮어쓴 것처럼 보일 수 있다.
    if (ledger.integrationBranch !== undefined && !nonEmptyString(ledger.integrationBranch)) {
        return { ok: false, reason: 'invalid-ledger-branch' };
    }
    if (Array.isArray(ledger.tasks) && ledger.tasks.some((entry) => entry && typeof entry === 'object'
        && entry.branch !== undefined
        && !nonEmptyString(entry.branch))) {
        return { ok: false, reason: 'invalid-ledger-branch' };
    }
    if (options.requirePartialClose && ledger.status !== 'awaiting_confirmation') {
        return { ok: false, reason: 'partial-close-awaiting-confirmation-required' };
    }
    const waves = ledger.repairWaves === undefined ? [] : ledger.repairWaves;
    if (!Array.isArray(waves) || waves.length > 2)
        return { ok: false, reason: 'repair-wave-limit' };
    if (ledger.status !== 'partial_closed')
        return { ok: true };
    if (waves.length !== 2)
        return { ok: false, reason: 'partial-close-repair-waves-required' };
    const repairs = waves;
    if (repairs.some((entry, index) => !validRepairDecision(entry, index + 1))) {
        return { ok: false, reason: 'partial-close-repair-decision-required' };
    }
    const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
    const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
    let previousGlobalIndex = -1;
    for (const repair of repairs) {
        // repairWaves가 canonical이고 task/global 항목은 그 전체 deep copy여야 한다.
        // 부분 key 비교는 서로 다른 scope나 failure evidence를 같은 결정으로 오인한다.
        const matches = (entry) => isDeepStrictEqual(entry, repair);
        const globalIndex = decisions.findIndex(matches);
        if (globalIndex < 0)
            return { ok: false, reason: 'partial-close-global-repair-log-required' };
        if (globalIndex <= previousGlobalIndex) {
            return { ok: false, reason: 'partial-close-repair-waves-ordered-required' };
        }
        previousGlobalIndex = globalIndex;
        const task = tasks.find((entry) => entry && entry.id === repair.task);
        if (!task || !Array.isArray(task.decisions) || !task.decisions.some(matches)) {
            return { ok: false, reason: 'partial-close-task-repair-log-required' };
        }
        if (task.status !== 'integrated') {
            return { ok: false, reason: 'partial-close-repair-wave-not-integrated' };
        }
    }
    const failure = ledger.terminalFailure;
    if (!failure || typeof failure !== 'object' || Array.isArray(failure)) {
        return { ok: false, reason: 'partial-close-failure-evidence-required' };
    }
    const evidence = failure;
    if (!nonEmptyString(evidence.task) || !nonEmptyString(evidence.command)
        || !nonEmptyString(evidence.summary) || !stringList(evidence.paths, true)
        || typeof evidence.exitCode !== 'number') {
        return { ok: false, reason: 'partial-close-failure-evidence-required' };
    }
    if (evidence.exitCode === 0 || evidence.repairWave !== 2) {
        return { ok: false, reason: 'partial-close-post-wave2-nonzero-failure-required' };
    }
    const terminal = tasks.find((entry) => entry && entry.id === evidence.task);
    if (!terminal || terminal.execution_kind !== 'verification' || terminal.status !== 'verifying') {
        return { ok: false, reason: 'partial-close-terminal-failure-state-required' };
    }
    if (ledger.userConfirmed !== true)
        return { ok: false, reason: 'partial-close-user-confirmation-required' };
    return { ok: true };
}
function catchMessage(error) {
    // 예전 error.message 접근과 같다. extra null 가드를 두면 throw null이
    // TypeError 대신 undefined가 되어 unavailable reason이 바뀐다.
    return error.message;
}
function runtimePaths({ repoRoot, execFileSync = realExecFileSync, 
// env/platform은 호출부 호환용; worktree는 이제 repo 내부.
platform = process.platform, }) {
    const pathApi = platform === 'win32' ? path.win32 : path;
    let commonDir;
    try {
        // encoding utf8이라 런타임은 문자열이다. Node 오버로드 유니온이 trim을 막아
        // 단언만 한다 — String()으로 감싸면 Buffer 경로의 표현이 달라진다.
        commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    }
    catch (error) {
        return { unavailable: true, reason: catchMessage(error) || 'Git common directory unavailable' };
    }
    if (!commonDir) {
        return { unavailable: true, reason: 'Git common directory unavailable' };
    }
    const commonGitDir = pathApi.resolve(repoRoot, commonDir);
    // dirname(.git)은 일반 repo의 main worktree root이므로, linked checkout이
    // 자기 아래에 중첩되지 않고 같은 `.worktrees/`를 공유한다.
    // projectRoot는 그 값을 스킬·훅 소비용으로 노출한다 — Git 계산을
    // 스킬이나 별도 helper에서 복제하지 않기 위한 단일 정본.
    const mainRoot = pathApi.dirname(commonGitDir);
    const bouncerDir = pathApi.join(commonGitDir, 'bouncer');
    return {
        commonGitDir,
        currentFile: pathApi.join(bouncerDir, 'current'),
        // 레거시 단일 파일과 namespace 루트를 같이 노출한다. 이관은 current.ts가
        // 조합하고, 여기서는 경로만 계산한다 — 두 저장소를 한 경로로 합치면
        // 이관 실패 시 어느 쪽이 남았는지 호출부가 구분하지 못한다.
        pointersRoot: pathApi.join(bouncerDir, 'pointers'),
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
/**
 * 레거시 `<git-common-dir>/bouncer/current`만 읽는다. namespace 전환 뒤에는
 * 이 파일이 없을 수 있다. current.ts의 충돌·이관 판정은 실제 레거시 파일이
 * 필요한데, `readRuntimeCurrent`는 유일한 namespace 키를 돌려주므로 둘을
 * 섞으면 병렬 `--set`을 레거시 충돌로 오인한다.
 *
 * @param {{ repoRoot: string, deps?: RuntimeDeps | null }} opts - 저장소 루트와 주입 의존성
 * @returns {RuntimePointer | null} 파싱된 레거시 포인터. 없거나 깨지면 null
 */
function readLegacyRuntimeCurrent({ repoRoot, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable || !d.fs.existsSync(paths.currentFile))
        return null;
    try {
        const data = JSON.parse(d.fs.readFileSync(paths.currentFile, 'utf8').trim());
        if (!data || typeof data.blueprint !== 'string' || typeof data.base !== 'string')
            return null;
        // task 키 부재·비문자열은 미지정. 마이그레이션 없이 기존 파일을 그대로 읽는다.
        const task = typeof data.task === 'string' ? toPosix(data.task) : null;
        return { blueprint: toPosix(data.blueprint), base: data.base, task };
    }
    catch (_error) {
        return null;
    }
}
/**
 * 활성 포인터 primitive. migrate-task-layout·import-history는 namespace
 * 열거를 모르므로, 유일한 namespace 키가 있으면 그것을 돌려 첫 `--set`
 * 이후에도 포인터가 보이게 한다. 키가 없으면 레거시 파일로 폴백한다.
 * 깨진 namespace 파일은 null로 숨기지 않는다 — 다른 키를 고르거나 레거시로
 * 넘어가면 손상된 주기를 삼킨다. 경로와 실패 원인을 담아 throw한다.
 *
 * @param {{ repoRoot: string, deps?: RuntimeDeps | null }} opts - 저장소 루트와 주입 의존성
 * @returns {RuntimePointer | null} 유일한 namespace 포인터, 없으면 레거시, 둘 다 없으면 null
 * @throws {Error} 깨진 namespace 파일 또는 키가 둘 이상일 때. 메시지에 경로를 포함한다
 */
function readRuntimeCurrent({ repoRoot, deps }) {
    const listed = listNamespacePointers({ repoRoot, deps });
    const issues = listed.filter((e) => e.issue);
    if (issues.length > 0) {
        const detail = issues
            .map((e) => `${e.issue.path}: ${e.issue.reason}`)
            .join('; ');
        throw new Error(detail);
    }
    const valid = listed.filter((e) => e.pointer != null);
    if (valid.length > 1) {
        throw new Error(`ambiguous namespace pointers: ${valid.map((e) => e.path).join(', ')}`);
    }
    if (valid.length === 1)
        return valid[0].pointer;
    return readLegacyRuntimeCurrent({ repoRoot, deps });
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
/**
 * blueprint 경로에서 세 자리 epic·blueprint id로 namespace 키를 만든다.
 * 경로 문자열이나 worktree 위치를 키로 쓰지 않는다 — 같은 문서가 다른
 * checkout에서 다른 파일로 갈라지면 병렬 주기가 서로 덮어쓴다.
 *
 * @param {unknown} blueprint - blueprint 디렉터리 상대 경로
 * @returns {{ epicId: string, blueprintId: string, key: string }} `key`는 `epicId/blueprintId`
 */
function pointerKeyFromBlueprint(blueprint) {
    const { epicId, blueprintId } = parsePathIds(blueprint);
    if (!epicId || !blueprintId) {
        throw new Error(`Cannot derive epic/blueprint ids from blueprint path: ${blueprint}`);
    }
    return { epicId, blueprintId, key: `${epicId}/${blueprintId}` };
}
function pathApiFor(platform) {
    return platform === 'win32' ? path.win32 : path;
}
function namespacePointerPath(pointersRoot, epicId, blueprintId, pathApi) {
    return pathApi.join(pointersRoot, epicId, `${blueprintId}.json`);
}
function parsePointerKey(key) {
    if (typeof key !== 'string')
        return null;
    const match = /^(\d{3})\/(\d{3})$/.exec(key);
    if (!match)
        return null;
    return { epicId: match[1], blueprintId: match[2], key };
}
function parsePointerBody(raw) {
    try {
        const data = JSON.parse(raw.trim());
        if (!data || typeof data.blueprint !== 'string' || typeof data.base !== 'string') {
            return { reason: 'missing blueprint or base' };
        }
        const task = typeof data.task === 'string' ? toPosix(data.task) : null;
        return { pointer: { blueprint: toPosix(data.blueprint), base: data.base, task } };
    }
    catch (error) {
        return { reason: catchMessage(error) || 'invalid JSON' };
    }
}
function isDir(d, abs) {
    try {
        return d.fs.statSync(abs).isDirectory();
    }
    catch (_e) {
        return false;
    }
}
/**
 * namespace 포인터 파일을 열거한다. 깨진 파일은 건너뛰지 않고 issue로 남긴다 —
 * null로 숨기면 다른 키가 선택된 것처럼 보여 병렬 주기를 덮어쓴다.
 *
 * @param {{ repoRoot: string, deps?: RuntimeDeps | null }} opts - 저장소 루트와 주입 의존성
 * @returns {NamespaceEntry[]} 키(`epic/blueprint`) 사전순
 */
function listNamespacePointers({ repoRoot, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable || !paths.pointersRoot)
        return [];
    const pathApi = pathApiFor(d.platform);
    const root = paths.pointersRoot;
    if (!d.fs.existsSync(root) || !isDir(d, root))
        return [];
    const entries = [];
    let epicNames;
    try {
        epicNames = d.fs.readdirSync(root);
    }
    catch (_e) {
        return [];
    }
    for (const epicName of epicNames) {
        if (!/^\d{3}$/.test(epicName))
            continue;
        const epicDir = pathApi.join(root, epicName);
        if (!isDir(d, epicDir))
            continue;
        let files;
        try {
            files = d.fs.readdirSync(epicDir);
        }
        catch (_e) {
            continue;
        }
        for (const file of files) {
            const idMatch = /^(\d{3})\.json$/.exec(file);
            if (!idMatch)
                continue;
            const blueprintId = idMatch[1];
            const filePath = pathApi.join(epicDir, file);
            const key = `${epicName}/${blueprintId}`;
            try {
                const parsed = parsePointerBody(d.fs.readFileSync(filePath, 'utf8'));
                if ('pointer' in parsed) {
                    entries.push({ key, path: filePath, pointer: parsed.pointer });
                }
                else {
                    entries.push({
                        key, path: filePath, pointer: null,
                        issue: { path: filePath, reason: parsed.reason },
                    });
                }
            }
            catch (error) {
                entries.push({
                    key, path: filePath, pointer: null,
                    issue: { path: filePath, reason: catchMessage(error) || 'unreadable pointer file' },
                });
            }
        }
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));
    return entries;
}
/**
 * namespace 파일에 포인터를 원자적으로 쓴다. 레거시 파일은 건드리지 않는다 —
 * 이관 삭제는 쓰기가 성공한 뒤에야 current.ts가 수행한다.
 *
 * @param {{ repoRoot: string, blueprint: unknown, base: string, task?: unknown, deps?: RuntimeDeps | null }} opts
 * @returns {string} 쓴 namespace 파일 절대 경로
 */
function writeRuntimeCurrent({ repoRoot, blueprint, base, task, deps, }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable)
        throw new Error(GIT_REQUIRED);
    const { epicId, blueprintId } = pointerKeyFromBlueprint(blueprint);
    const pathApi = pathApiFor(d.platform);
    const target = namespacePointerPath(paths.pointersRoot, epicId, blueprintId, pathApi);
    d.fs.mkdirSync(pathApi.dirname(target), { recursive: true });
    // task는 문자열일 때만 파일에 쓴다 — 없으면 키 자체를 생략해 레거시 형태를 유지.
    const data = {
        blueprint: toPosix(blueprint),
        base,
    };
    if (typeof task === 'string')
        data.task = toPosix(task);
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    // 같은 디렉터리에 tmp를 만들고 rename으로 교체한다. 다른 볼륨의 tmp는
    // rename이 copy+unlink가 되어 이관 전에 레거시를 지운 것과 같은 구멍이 난다.
    const tmp = pathApi.join(pathApi.dirname(target), `.${blueprintId}.${process.pid}.${Date.now()}.tmp`);
    d.fs.writeFileSync(tmp, payload);
    try {
        d.fs.renameSync(tmp, target);
    }
    catch (error) {
        try {
            d.fs.rmSync(tmp);
        }
        catch (_cleanup) {
            // tmp 정리는 best-effort. rename 실패 원인을 가리면 호출부가 재시도 지점을 잃는다.
        }
        throw error;
    }
    return target;
}
/**
 * namespace 키 파일을 지운다. 파일이 없으면 false — 호출자는 이미 없음을 성공으로 본다.
 *
 * @param {{ repoRoot: string, key: string, deps?: RuntimeDeps | null }} opts - `key`는 `epicId/blueprintId`
 * @returns {boolean} 지웠으면 true, 없었으면 false
 */
function removeNamespacePointer({ repoRoot, key, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable || !paths.pointersRoot)
        return false;
    const parsed = parsePointerKey(key);
    if (!parsed)
        return false;
    const pathApi = pathApiFor(d.platform);
    const target = namespacePointerPath(paths.pointersRoot, parsed.epicId, parsed.blueprintId, pathApi);
    if (!d.fs.existsSync(target))
        return false;
    d.fs.rmSync(target);
    return true;
}
// blueprint 경로만으로 execute worktree 절대 경로를 고른다.
// 기본은 `.worktrees/<epic>/<bp>`이고, 중첩이 없는데 평면 `.worktrees/<bp>`만
// 있으면 그 평면을 재사용한다(옮기지 않음). mkdir은 하지 않는다 —
// `git worktree add`가 부모 디렉터리까지 만든다.
function worktreePathFor({ repoRoot, blueprint, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable)
        throw new Error(GIT_REQUIRED);
    const { epicId, blueprintId } = parsePathIds(blueprint);
    // 구형 EPIC-/BP- 접두는 parsePathIds가 흡수하지 않는다 — 숫자 id 경로만 유효.
    if (!epicId || !blueprintId) {
        throw new Error(`Cannot derive epic/blueprint ids from blueprint path: ${blueprint}`);
    }
    const platform = d.platform || process.platform;
    const pathApi = platform === 'win32' ? path.win32 : path;
    const nested = pathApi.join(paths.worktreeRoot, epicId, blueprintId);
    const flat = pathApi.join(paths.worktreeRoot, blueprintId);
    // 중첩이 디렉터리로 없고 평면만 디렉터리면 레거시 평면. 둘 다 있으면 중첩 우선.
    const nestedIsDir = (() => {
        try {
            return d.fs.statSync(nested).isDirectory();
        }
        catch (_e) {
            return false;
        }
    })();
    const flatIsDir = (() => {
        try {
            return d.fs.statSync(flat).isDirectory();
        }
        catch (_e) {
            return false;
        }
    })();
    if (!nestedIsDir && flatIsDir)
        return flat;
    return nested;
}
// coordinator mode는 기존 execute worktree와 구분해 fan-in의 기준 checkout을
// 하나로 고정한다. 기존 worktreePathFor의 평면 fallback은 건드리지 않는다.
function coordinatorPathsFor({ repoRoot, blueprint, task, deps }) {
    const d = { fs, ...(deps || {}) };
    const paths = resolvedPaths({ repoRoot, deps: d });
    if (paths.unavailable)
        throw new Error(GIT_REQUIRED);
    const { epicId, blueprintId } = parsePathIds(blueprint);
    if (!epicId || !blueprintId)
        throw new Error(`Cannot derive epic/blueprint ids from blueprint path: ${blueprint}`);
    const pathApi = (d.platform || process.platform) === 'win32' ? path.win32 : path;
    const root = pathApi.join(paths.worktreeRoot, epicId, blueprintId);
    const integrationPath = pathApi.join(root, 'integration');
    const result = {
        integrationPath,
        ledgerFile: pathApi.join(integrationPath, '.bouncer', 'runtime', 'coordinator.json'),
    };
    if (typeof task === 'string' && /^\d{3}$/.test(task))
        result.workerPath = pathApi.join(root, 'workers', task);
    return result;
}
function verifyLedgerPathFor({ repoRoot, verificationRel, deps }) {
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
        ledgerFile: pathApi.join(paths.commonGitDir, 'bouncer', 'verify', `${digest}.json`),
    };
}
/**
 * porcelain 출력이 비어 있지 않으면 dirty. git 실패도 dirty로 본다 —
 * migrate task-layout·import-history가 부분 쓰기를 남기지 않게 apply를 막기 위함.
 */
function isWorktreeDirty(repoRoot, execFileSync = realExecFileSync) {
    try {
        const out = execFileSync('git', ['status', '--porcelain'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return String(out).trim().length > 0;
    }
    catch (_e) {
        return true;
    }
}
module.exports = {
    runtimePaths, readRuntimeCurrent, readLegacyRuntimeCurrent, writeRuntimeCurrent,
    clearRuntimeCurrent, worktreePathFor, coordinatorPathsFor, verifyLedgerPathFor,
    isWorktreeDirty,
    pointerKeyFromBlueprint, listNamespacePointers, removeNamespacePointer,
    validateCoordinatorLedger,
    branchNamesFor, resolveWorktreeBranch,
};
