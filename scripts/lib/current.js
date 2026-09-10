'use strict';
const fs = require('node:fs');
const path = require('node:path');
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const paths = require("./paths");
const { epicDirOf, toPosix } = paths;
const runtimeState = require("./runtime-state");
const { readLegacyRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent, listNamespacePointers, removeNamespacePointer, pointerKeyFromBlueprint, worktreePathFor, runtimePaths, } = runtimeState;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
const scope = require("./scope");
const { readCoordinatorLedger } = scope;
const coordinatorCore = require("./coordinator");
const { readyWave } = coordinatorCore;
const READY_TASK_STATUS = ['ready', 'in_progress'];
// epic `## Blueprints` 링크 대상(예: `blueprints/BP-001-slug/index.md`)과 매칭.
// blueprint directory 이름만 캡처; title 텍스트와 한 줄 purpose는 무시.
const BLUEPRINT_LINK_RE = /\]\(blueprints\/([^/)]+)\/index\.md\)/g;
// --task 는 세 자리 숫자 또는 TASKS-NNN 만 받는다. 그 외 형식은 해석 실패.
const TASK_DIGITS_RE = /^(\d{3})$/;
const TASK_ID_RE = /^TASKS-(\d{3})$/;
class CurrentSelectionError extends Error {
    code;
    candidates;
    issues;
    constructor({ code, message, candidates, issues, }) {
        super(message || code);
        this.name = 'CurrentSelectionError';
        this.code = code;
        if (candidates)
            this.candidates = candidates;
        if (issues)
            this.issues = issues;
    }
}
function storedPointer(pointer) {
    return {
        blueprint: pointer.blueprint,
        base: pointer.base,
        task: pointer.task == null ? null : pointer.task,
    };
}
function sortPointers(pointers) {
    return [...pointers].sort((a, b) => a.blueprint.localeCompare(b.blueprint));
}
function tryPointerKey(blueprint) {
    try {
        return pointerKeyFromBlueprint(blueprint).key;
    }
    catch (_e) {
        return null;
    }
}
/**
 * cwd가 `.worktrees/<epic>/<bp>` 중첩인지, `.worktrees/<bp>` 평면인지,
 * 기준 checkout인지를 가른다. 키는 세 자리 id만 본다 — worktree 절대 경로를
 * 키로 쓰면 relocated checkout이 다른 슬롯으로 떨어진다.
 *
 * @param {string} repoRoot - 선택 기준이 되는 checkout 절대 경로
 * @param {ReturnType<typeof runtimePaths>} paths - 같은 호출의 runtimePaths
 * @param {string | undefined} platform - win32일 때만 win32 path API
 * @returns {SelectionLocation} nested / flat / base
 */
function selectionLocation(repoRoot, paths, platform) {
    const pathApi = platform === 'win32' ? path.win32 : path;
    if (paths.unavailable || !paths.worktreeRoot)
        return { kind: 'base' };
    const absRepo = pathApi.resolve(repoRoot);
    const rel = pathApi.relative(paths.worktreeRoot, absRepo);
    if (!rel || rel === '.' || rel.startsWith('..') || pathApi.isAbsolute(rel)) {
        return { kind: 'base' };
    }
    const parts = rel.split(/[\\/]/).filter(Boolean);
    if (parts.length >= 2 && /^\d{3}$/.test(parts[0]) && /^\d{3}$/.test(parts[1])) {
        return { kind: 'nested', key: `${parts[0]}/${parts[1]}` };
    }
    if (parts.length >= 1 && /^\d{3}$/.test(parts[0])) {
        return { kind: 'flat', worktreeAbs: pathApi.join(paths.worktreeRoot, parts[0]) };
    }
    return { kind: 'base' };
}
function namespaceConflict(legacy, ns, legacyPath) {
    if (!legacy || ns.length === 0)
        return null;
    const legacyKey = tryPointerKey(legacy.blueprint);
    const foreign = ns.filter((e) => e.key !== legacyKey);
    if (legacyKey && foreign.length === 0 && ns.length === 1 && ns[0].key === legacyKey) {
        // 같은 키의 레거시·namespace 사본은 이관 미완료일 뿐 충돌이 아니다.
        return null;
    }
    return {
        status: 'invalid',
        issues: [{
                path: legacyPath || 'bouncer/current',
                reason: 'legacy and namespace pointers disagree',
            }],
        candidates: sortPointers([legacy, ...ns.map((e) => e.pointer)]),
    };
}
/**
 * cwd와 저장 상태에서 활성 포인터를 고른다. 다중 후보·깨진 파일·레거시 충돌은
 * throw하지 않고 union으로 돌려 호출부가 JSON을 그릴 수 있게 한다.
 *
 * @param {{ repoRoot: string, deps?: RuntimeDeps }} opts - repoRoot는 선택 위치
 * @returns {CurrentResolution} selected / empty / ambiguous / invalid
 */
function resolveCurrent({ repoRoot, deps }) {
    const listed = listNamespacePointers({ repoRoot, deps });
    const issues = listed
        .filter((e) => e.issue)
        .map((e) => e.issue);
    const ns = listed
        .filter((e) => e.pointer != null)
        .map((e) => ({ key: e.key, pointer: storedPointer(e.pointer) }));
    const candidates = sortPointers(ns.map((e) => e.pointer));
    if (issues.length > 0) {
        return { status: 'invalid', issues, candidates };
    }
    const legacy = readLegacyRuntimeCurrent({ repoRoot, deps });
    const paths = runtimePaths({
        repoRoot,
        execFileSync: deps?.execFileSync,
        env: deps?.env,
        platform: deps?.platform,
    });
    const conflict = namespaceConflict(legacy, ns, paths.currentFile);
    if (conflict)
        return conflict;
    if (paths.currentFile) {
        const d = deps || {};
        const fsApi = d.fs || fs;
        // 레거시 파일이 있는데 파싱이 실패하고 namespace가 있으면 합의를 확인할
        // 수 없다. namespace만 보고 고르면 다른 주기의 레거시를 삼킨다.
        if (ns.length > 0 && !legacy && fsApi.existsSync(paths.currentFile)) {
            return {
                status: 'invalid',
                issues: [{ path: paths.currentFile, reason: 'unreadable legacy pointer' }],
                candidates,
            };
        }
    }
    if (ns.length === 0) {
        if (!legacy)
            return { status: 'empty' };
        return { status: 'selected', current: storedPointer(legacy), source: 'legacy', key: null };
    }
    const loc = selectionLocation(repoRoot, paths, deps?.platform);
    if (loc.kind === 'nested') {
        const match = ns.find((e) => e.key === loc.key);
        if (!match)
            return { status: 'empty' };
        return { status: 'selected', current: match.pointer, source: 'namespace', key: loc.key };
    }
    if (loc.kind === 'flat') {
        const matches = ns.filter((e) => {
            try {
                return worktreePathFor({ repoRoot, blueprint: e.pointer.blueprint, deps }) === loc.worktreeAbs;
            }
            catch (_e) {
                return false;
            }
        });
        if (matches.length === 1) {
            return {
                status: 'selected',
                current: matches[0].pointer,
                source: 'namespace',
                key: matches[0].key,
            };
        }
        if (matches.length === 0)
            return { status: 'empty' };
        return { status: 'ambiguous', candidates: sortPointers(matches.map((e) => e.pointer)) };
    }
    if (ns.length === 1) {
        return { status: 'selected', current: ns[0].pointer, source: 'namespace', key: ns[0].key };
    }
    return { status: 'ambiguous', candidates };
}
/**
 * resolveCurrent의 호환 wrapper. 호출부가 단일 포인터 또는 없음을 기대할 때 쓴다.
 *
 * @param {{ repoRoot: string, deps?: RuntimeDeps }} opts - resolveCurrent와 같다
 * @returns {Pointer | null} selected면 Pointer, empty면 null
 * @throws {CurrentSelectionError} ambiguous → CURRENT_AMBIGUOUS, invalid → CURRENT_INVALID
 */
function readCurrent({ repoRoot, deps }) {
    const resolved = resolveCurrent({ repoRoot, deps });
    if (resolved.status === 'selected')
        return resolved.current;
    if (resolved.status === 'empty')
        return null;
    if (resolved.status === 'ambiguous') {
        throw new CurrentSelectionError({
            code: 'CURRENT_AMBIGUOUS',
            candidates: resolved.candidates,
        });
    }
    throw new CurrentSelectionError({
        code: 'CURRENT_INVALID',
        issues: resolved.issues,
        candidates: resolved.candidates,
    });
}
/**
 * 대상 namespace 키를 추가·갱신하고, 같은 키의 레거시 파일이 있으면 이관한다.
 * `--replace`는 선택된 다른 키를 지운 뒤 대상을 쓴다. 서로 다른
 * legacy·namespace 공존은 쓰지 않고 CURRENT_INVALID다. 레거시 삭제 실패는
 * 이미 쓴 namespace를 남긴 채 CURRENT_MIGRATION_INCOMPLETE다.
 *
 * @param {object} opts - repoRoot, blueprint, base, 선택적 task·replace·replaceKey
 * @returns {string} 쓴 namespace 파일 절대 경로
 */
function writeCurrent({ repoRoot, blueprint, base, task, deps, replace, replaceKey, }) {
    const paths = runtimePaths({
        repoRoot,
        execFileSync: deps?.execFileSync,
        env: deps?.env,
        platform: deps?.platform,
    });
    // Git 부재는 id 검사보다 앞선다. 비저장소에서 경로 형식 오류로 바꾸면
    // 기존 writeCurrent 거절 메시지와 호출부 분기가 갈라진다.
    if (paths.unavailable) {
        throw new Error('Bouncer requires a Git repository for an active blueprint');
    }
    const ids = pointerKeyFromBlueprint(blueprint);
    const listed = listNamespacePointers({ repoRoot, deps });
    const issues = listed.filter((e) => e.issue).map((e) => e.issue);
    const ns = listed.filter((e) => e.pointer != null);
    if (issues.length > 0) {
        throw new CurrentSelectionError({
            code: 'CURRENT_INVALID',
            issues,
            candidates: sortPointers(ns.map((e) => storedPointer(e.pointer))),
        });
    }
    const legacy = readLegacyRuntimeCurrent({ repoRoot, deps });
    if (legacy) {
        const legacyKey = tryPointerKey(legacy.blueprint);
        const nsKeys = new Set(ns.map((e) => e.key));
        const sameKeyOnly = legacyKey != null
            && nsKeys.size <= 1
            && (nsKeys.size === 0 || nsKeys.has(legacyKey));
        const targetMatchesLegacy = legacyKey === ids.key;
        if (!targetMatchesLegacy && !replace) {
            throw new CurrentSelectionError({
                code: 'CURRENT_INVALID',
                issues: [{
                        path: paths.currentFile || 'bouncer/current',
                        reason: 'legacy and namespace pointers disagree',
                    }],
                candidates: sortPointers([storedPointer(legacy), ...ns.map((e) => storedPointer(e.pointer))]),
            });
        }
        if (nsKeys.size > 0 && !sameKeyOnly && !replace) {
            throw new CurrentSelectionError({
                code: 'CURRENT_INVALID',
                issues: [{
                        path: paths.currentFile || 'bouncer/current',
                        reason: 'legacy and namespace pointers disagree',
                    }],
                candidates: sortPointers([storedPointer(legacy), ...ns.map((e) => storedPointer(e.pointer))]),
            });
        }
    }
    // --replace는 선택된 키를 먼저 지운 뒤 대상을 쓴다. 새 파일을 먼저 쓰면
    // 삭제 실패 시 두 키가 공존하고 어느 쪽이 활성인지 진단이 안 된다.
    if (replace && replaceKey && replaceKey !== ids.key) {
        const pathApi = deps?.platform === 'win32' ? path.win32 : path;
        const keyParts = /^(\d{3})\/(\d{3})$/.exec(replaceKey);
        const replacePath = keyParts && paths.pointersRoot
            ? pathApi.join(paths.pointersRoot, keyParts[1], `${keyParts[2]}.json`)
            : replaceKey;
        try {
            removeNamespacePointer({ repoRoot, key: replaceKey, deps });
        }
        catch (error) {
            // rmSync 실패(EACCES 등)만 접는다. 두 키를 남긴 채 raw throw하면 CLI가
            // 모호성 JSON 없이 무너지고, 호출부는 어느 파일이 남았는지 모른다.
            throw new CurrentSelectionError({
                code: 'CURRENT_INVALID',
                issues: [{
                        path: replacePath,
                        reason: catchSelectionMessage(error),
                    }],
                candidates: sortPointers(ns.map((e) => storedPointer(e.pointer))),
            });
        }
    }
    const written = writeRuntimeCurrent({
        repoRoot, blueprint, base, task, deps,
    });
    if (legacy && paths.currentFile) {
        const d = { fs, ...(deps || {}) };
        try {
            if (d.fs.existsSync(paths.currentFile))
                d.fs.rmSync(paths.currentFile);
        }
        catch (error) {
            // 레거시 unlink 실패만 이관 미완료로 접는다. namespace 사본은 이미 같은
            // 본문이라 다음 동일 write가 삭제만 재시도하면 된다. 다른 오류를
            // 성공으로 삼키면 부분 이관이 조용히 남는다.
            throw new CurrentSelectionError({
                code: 'CURRENT_MIGRATION_INCOMPLETE',
                message: catchSelectionMessage(error),
                candidates: sortPointers([
                    storedPointer(legacy),
                    storedPointer({
                        blueprint: toPosix(blueprint),
                        base,
                        task: typeof task === 'string' ? toPosix(task) : null,
                    }),
                ]),
            });
        }
    }
    return written;
}
function catchSelectionMessage(error) {
    return error.message || 'CURRENT_MIGRATION_INCOMPLETE';
}
/**
 * 현재 위치에서 유일하게 선택된 포인터만 지운다. 다중 후보·깨진 파일은
 * 아무 키도 지우지 않고 throw한다 — 한쪽 clear가 다른 주기를 삼키지 않게.
 *
 * @param {{ repoRoot: string, deps?: RuntimeDeps }} opts - 선택 위치와 주입 의존성
 * @returns {boolean} 지웠으면 true, 선택된 포인터가 없었으면 false
 */
function clearCurrent({ repoRoot, deps }) {
    const resolved = resolveCurrent({ repoRoot, deps });
    if (resolved.status === 'empty')
        return false;
    if (resolved.status === 'ambiguous') {
        throw new CurrentSelectionError({
            code: 'CURRENT_AMBIGUOUS',
            candidates: resolved.candidates,
        });
    }
    if (resolved.status === 'invalid') {
        throw new CurrentSelectionError({
            code: 'CURRENT_INVALID',
            issues: resolved.issues,
            candidates: resolved.candidates,
        });
    }
    if (resolved.source === 'legacy') {
        return clearRuntimeCurrent({ repoRoot, deps });
    }
    if (!resolved.key)
        return false;
    return removeNamespacePointer({ repoRoot, key: resolved.key, deps });
}
function bouncerOf(data) {
    // `data && data.bouncer`와 같다. `'bouncer' in data`로 바꾸면 프로토타입
    // 필드가 생기고, data가 null일 때 예전처럼 단락되지 않을 수 있다.
    return data ? data.bouncer : data;
}
function bouncerStatus(data) {
    const bouncer = bouncerOf(data);
    return bouncer ? bouncer.status : undefined;
}
function availableTaskEntries(listing) {
    return listing.entries
        .filter((entry) => typeof entry.id === 'string' && !!entry.id)
        .map((entry) => ({ id: entry.id, path: entry.rel }));
}
/**
 * blueprint `index.md`의 `bouncer.scale`을 응답 전용으로 읽는다.
 * 포인터 파일에 넣지 않는 이유: 문서 수정 후 stale. 호출 시점마다 다시 계산한다.
 * enum 검사는 S20의 몫 — 알 수 없는 문자열도 그대로 노출하고, 읽기/파싱 실패는 null.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - 포인터의 blueprint 상대 경로
 * @returns {string | null} 문자열 scale, 없거나 문자열이 아니면 null
 */
function readBlueprintScale(repoRoot, blueprintDir) {
    try {
        const doc = readDoc(path.join(repoRoot, blueprintDir, 'index.md'));
        const bouncer = bouncerOf(doc.data);
        const scale = bouncer ? bouncer.scale : undefined;
        return typeof scale === 'string' ? scale : null;
    }
    catch (_e) {
        return null;
    }
}
/**
 * coordinator 실행 중이면 다음에 열 수 있는 task는 번호 순 하나가 아니라
 * ledger의 ready wave다. 원장이 아예 없으면 null을 돌려주고, 호출자는 응답에
 * `coordinator` 키 자체를 붙이지 않아 기존 sequential payload를 유지한다.
 *
 * 읽을 수는 있으나 깨진 원장은 null이 아니다. 그 상태가 바로 모든 checkout의
 * 커밋을 막는 원인이므로, 운영자가 어느 파일을 고쳐야 하는지 보이도록
 * `status: 'unreadable'`과 경로를 그대로 싣는다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprint - 포인터의 blueprint 상대 경로
 * @returns {object | null} 원장 스냅샷 또는 null
 */
function coordinatorSnapshot(repoRoot, blueprint) {
    const found = readCoordinatorLedger({ repoRoot, blueprint });
    if (!found.ok) {
        if (found.reason !== 'unreadable-ledger')
            return null;
        return {
            status: 'unreadable',
            ledgerFile: found.ledgerFile || null,
            integrationPath: found.integrationPath || null,
            revision: null,
            integrationHead: null,
            ready: [],
            tasks: [],
        };
    }
    const ledger = found.ledger;
    const tasks = Array.isArray(ledger.tasks) ? ledger.tasks : [];
    return {
        status: 'ok',
        ledgerFile: found.ledgerFile,
        integrationPath: found.integrationPath,
        revision: typeof ledger.revision === 'string' ? ledger.revision : null,
        integrationHead: typeof ledger.integrationHead === 'string' ? ledger.integrationHead : null,
        terminalStatus: ledger.status === 'partial_closed' || ledger.status === 'awaiting_confirmation'
            ? ledger.status : null,
        terminalFailure: ledger.terminalFailure || null,
        ready: readyWave(tasks),
        tasks: tasks.map((task) => ({
            id: task.id,
            executionKind: task.execution_kind || 'commit',
            status: task.status || 'pending',
            revision: task.scope ? task.scope.revision : null,
            scope: task.scope ? task.scope.paths : null,
        })),
    };
}
/**
 * CLI 출력용. 포인터 파일의 task 는 rel path 문자열만 보관하고,
 * `bouncer current` 응답에는 경로와 TASKS-NNN id, 그리고 호출 시점의 `scale`
 * 파생값을 함께 실어 Interface 계약을 맞춘다.
 * 문서가 사라져 id 를 못 찾으면 path 만 남기고 id 는 null — 포인터를 지우지 않는다.
 * scale 읽기 실패도 같다: null 로 흡수하고 포인터는 유지한다.
 *
 * @param {Pointer | null | undefined} current - 포인터 파일 내용. 없으면 null
 * @param {{ repoRoot: string }} opts - repoRoot 는 blueprint index 절대 경로 계산용
 * @returns {object | null} task 없음: `{ blueprint, base, task: null, scale }`.
 *   task 있음: `{ blueprint, base, task: { path, id }, scale }`. 포인터 없으면 null.
 */
function presentCurrent(current, { repoRoot }) {
    if (!current)
        return null;
    const scale = readBlueprintScale(repoRoot, current.blueprint);
    const coordinator = coordinatorSnapshot(repoRoot, current.blueprint);
    // 원장이 없으면 키를 붙이지 않는다 — 기존 4-키 payload 계약을 그대로 둔다.
    const coordinatorField = coordinator ? { coordinator } : {};
    const taskPath = typeof current.task === 'string' && current.task ? current.task : null;
    if (!taskPath) {
        return {
            blueprint: current.blueprint, base: current.base, task: null, scale, ...coordinatorField,
        };
    }
    let id = null;
    try {
        const listing = listTasksDocs({ repoRoot, blueprintDir: current.blueprint });
        const entry = listing.entries.find((e) => e.rel === taskPath);
        if (entry && typeof entry.id === 'string')
            id = entry.id;
    }
    catch (_e) {
        // listing 실패 시 id 없이 path 만 노출.
    }
    return {
        blueprint: current.blueprint,
        base: current.base,
        task: { path: taskPath, id },
        scale,
        ...coordinatorField,
    };
}
/**
 * --set 시 task 해석.
 * - taskSpec 없음: 번호 순 첫 ready/in_progress. 없으면 task 미지정(ok + null).
 * - NNN / TASKS-NNN: 해당 문서. 없거나 형식이 틀리면 ok:false + available 목록.
 * mixed / 문서 없음: 명시 요청이면 실패, 자동이면 선택 없음.
 */
function resolvePointerTask({ repoRoot, blueprintDir, task: taskSpec }) {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    const available = availableTaskEntries(listing);
    const requested = taskSpec !== undefined && taskSpec !== null && taskSpec !== '';
    if (listing.mixed || listing.entries.length === 0) {
        if (requested) {
            return { ok: false, available, reason: 'no matching task document' };
        }
        return { ok: true, task: null, id: null };
    }
    if (requested) {
        const raw = String(taskSpec);
        let wantId = null;
        const digits = TASK_DIGITS_RE.exec(raw);
        const idMatch = TASK_ID_RE.exec(raw);
        if (digits)
            wantId = `TASKS-${digits[1]}`;
        else if (idMatch)
            wantId = `TASKS-${idMatch[1]}`;
        else {
            return { ok: false, available, reason: 'invalid task id' };
        }
        const entry = listing.entries.find((e) => e.id === wantId);
        if (!entry) {
            return { ok: false, available, reason: 'no matching task document' };
        }
        return { ok: true, task: entry.rel, id: entry.id };
    }
    // 자동 선택: listTasksDocs 가 이미 번호 순이므로 첫 열린 문서를 고른다.
    for (const entry of listing.entries) {
        try {
            const doc = readDoc(path.join(repoRoot, entry.rel));
            const st = bouncerStatus(doc.data);
            if (READY_TASK_STATUS.includes(st)) {
                return { ok: true, task: entry.rel, id: entry.id };
            }
        }
        catch (_e) {
            // 깨진 문서는 건너뛰고 다음 후보를 본다.
        }
    }
    return { ok: true, task: null, id: null };
}
// approved blueprint 중 execute가 아직 열린 tasks만 side-effect 없이 스캔.
// 깨지거나 읽을 수 없는 doc은 항목별로 skip하여 corrupt blueprint 하나가
// ready list 전체를 지우지 않게 함 (pointer가 null일 때 execute가
// "planned but unset"과 "nothing planned"를 구분하는 데 사용).
function listReadyBlueprints({ repoRoot }) {
    const list = [];
    const epicsRoot = path.join(repoRoot, '.bouncer', 'context', 'epics');
    if (!fs.existsSync(epicsRoot))
        return list;
    let epicNames;
    try {
        epicNames = fs.readdirSync(epicsRoot);
    }
    catch (_e) {
        return list;
    }
    for (const epicName of epicNames) {
        const blueprintsRoot = path.join(epicsRoot, epicName, 'blueprints');
        if (!fs.existsSync(blueprintsRoot))
            continue;
        let bpNames;
        try {
            bpNames = fs.readdirSync(blueprintsRoot);
        }
        catch (_e) {
            continue;
        }
        for (const bpName of bpNames) {
            const bpAbs = path.join(blueprintsRoot, bpName);
            let st;
            try {
                st = fs.statSync(bpAbs);
            }
            catch (_e) {
                continue;
            }
            if (!st.isDirectory())
                continue;
            const rel = toPosix(path.relative(repoRoot, bpAbs));
            try {
                const indexDoc = readDoc(path.join(bpAbs, 'index.md'));
                const bpStatus = bouncerStatus(indexDoc.data);
                if (bpStatus !== 'approved')
                    continue;
                // ready = task 문서 중 하나라도 ready/in_progress.
                // 열린 task 목록은 --set 자동 선택·finalize 다음-task 확인이 같이 쓴다.
                const listing = listTasksDocs({ repoRoot, blueprintDir: rel });
                if (listing.mixed || listing.entries.length === 0)
                    continue;
                const openTasks = [];
                for (const entry of listing.entries) {
                    const tasksDoc = readDoc(path.join(repoRoot, entry.rel));
                    const taskStatus = bouncerStatus(tasksDoc.data);
                    if (READY_TASK_STATUS.includes(taskStatus) && entry.id) {
                        openTasks.push({ id: entry.id, path: entry.rel, status: taskStatus });
                    }
                }
                if (openTasks.length > 0) {
                    list.push({
                        blueprint: rel,
                        status: openTasks[0].status,
                        tasks: openTasks,
                    });
                }
            }
            catch (_e) {
                // 이 blueprint만 skip — 형제는 계속 스캔.
            }
        }
    }
    list.sort((a, b) => a.blueprint.localeCompare(b.blueprint));
    return list;
}
// epic index의 `## Blueprints` section만 읽어 blueprint directory 이름을
// 링크 등장 순으로 반환. section 없음/읽기 실패 → [] (throw 없음):
// caller는 path lexicographic order로 fallback.
function parseEpicBlueprintOrder(epicIndexAbs) {
    let text;
    try {
        text = fs.readFileSync(epicIndexAbs, 'utf8');
    }
    catch (_e) {
        return [];
    }
    // YAML frontmatter를 제거해 그 안의 `## Blueprints` 문자열이 이기지 않게 함.
    const fmEnd = text.indexOf('\n---\n');
    const body = fmEnd >= 0 ? text.slice(fmEnd + 5) : text;
    const sectionMatch = /^## Blueprints\s*$/m.exec(body);
    if (!sectionMatch)
        return [];
    const start = sectionMatch.index + sectionMatch[0].length;
    // 다음 ATX h2가 이 section을 끝냄; 더 깊은 heading은 무시.
    const rest = body.slice(start);
    const nextH2 = /^## /m.exec(rest);
    const section = nextH2 ? rest.slice(0, nextH2.index) : rest;
    const names = [];
    BLUEPRINT_LINK_RE.lastIndex = 0;
    let m;
    while ((m = BLUEPRINT_LINK_RE.exec(section)) !== null) {
        names.push(m[1]);
    }
    return names;
}
function readAffectedPaths(repoRoot, blueprintDir) {
    // nextBlueprint sharedPaths 용: blueprint 전체 경로 합집합.
    // 커밋 가드의 좁히기는 commit-hook.readAffectedPaths 가 포인터 task 를 본다.
    try {
        const listing = listTasksDocs({ repoRoot, blueprintDir });
        if (listing.mixed || listing.entries.length === 0)
            return [];
        const out = [];
        const seen = new Set();
        for (const entry of listing.entries) {
            try {
                const doc = readDoc(path.join(repoRoot, entry.rel));
                const bouncer = bouncerOf(doc.data);
                const paths = bouncer
                    ? bouncer.affected_paths
                    : undefined;
                if (!Array.isArray(paths))
                    continue;
                for (const p of paths) {
                    if (typeof p === 'string' && !seen.has(p)) {
                        seen.add(p);
                        out.push(p);
                    }
                }
            }
            catch (_e) {
                // 깨진 task 문서 하나는 건너뛰고 나머지 합집합을 유지.
            }
        }
        return out;
    }
    catch (_e) {
        return [];
    }
}
/**
 * finalize 대상과 같은 epic에 남은 미마감 형제를 보고용으로 스캔한다.
 * `--set` 후보 조건은 다시 구현하지 않는다 — `ready`는 같은 호출의
 * `listReadyBlueprints` 결과에 경로가 있는지로만 붙인다. draft처럼 후보가
 * 아닌 형제도 인계 확인에 떠야 하고, 후보 조건을 복제하면 `bouncer current`
 * 의 ready 목록과 어긋날 수 있기 때문.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {unknown} blueprintDir - finalize 대상 blueprint 상대 경로
 * @param {Array<{ blueprint: string }>} readyBlueprints - 같은 호출의 `listReadyBlueprints` 결과
 * @returns {SameEpicPendingEntry[]} `blueprint` 경로 사전순. 자신·`closed`·다른 epic·깨진 `index.md`는 제외하며 항상 배열
 */
function listSameEpicPending({ repoRoot, blueprintDir, readyBlueprints, }) {
    const selfRaw = String(blueprintDir);
    const selfPosix = toPosix(selfRaw);
    const selfEpic = epicDirOf(selfPosix);
    const pending = [];
    const blueprintsRoot = path.join(repoRoot, selfEpic, 'blueprints');
    if (!fs.existsSync(blueprintsRoot))
        return pending;
    let bpNames;
    try {
        bpNames = fs.readdirSync(blueprintsRoot);
    }
    catch (_e) {
        return pending;
    }
    // 경로 문자열 equality만 — listReadyBlueprints가 이미 POSIX rel을 씀.
    const readySet = new Set(readyBlueprints.map((entry) => entry.blueprint));
    for (const bpName of bpNames) {
        const bpAbs = path.join(blueprintsRoot, bpName);
        let st;
        try {
            st = fs.statSync(bpAbs);
        }
        catch (_e) {
            continue;
        }
        if (!st.isDirectory())
            continue;
        const rel = toPosix(path.relative(repoRoot, bpAbs));
        // nextBlueprint 자기 제외와 동일: 정규화 전 문자열과 POSIX 경로 모두.
        if (rel === selfRaw || rel === selfPosix)
            continue;
        try {
            const indexDoc = readDoc(path.join(bpAbs, 'index.md'));
            const bpStatus = bouncerStatus(indexDoc.data);
            // closed는 터미널 — 잔여 인계에 올리면 이미 끝난 계획을 다시 고르게 됨.
            // 문자열이 아니면 상태를 보고할 수 없으므로 이 항목만 건너뛴다.
            if (typeof bpStatus !== 'string' || bpStatus === 'closed' || bpStatus === 'partial_closed')
                continue;
            pending.push({
                blueprint: rel,
                blueprintStatus: bpStatus,
                ready: readySet.has(rel),
            });
        }
        catch (_e) {
            // 깨진 index 하나가 잔여 목록 전체를 지우면 안 됨.
        }
    }
    pending.sort((a, b) => a.blueprint.localeCompare(b.blueprint));
    return pending;
}
// finalize 대상 이후 다음 ready blueprint 계산 — 순수 계산, write/git/process
// 없음. 후보는 listReadyBlueprints에서만; 정렬은 finalized epic 우선, 다음
// ## Blueprints link order, epic 내 미등록은 path lexicographic, 그다음
// 다른 epic은 epic dir name 순. sameEpicPending은 같은 epic의 미마감 형제
// 보고용이며 후보 필터와 독립이다.
function nextBlueprint({ repoRoot, blueprintDir }) {
    const selfRaw = String(blueprintDir);
    const selfPosix = toPosix(selfRaw);
    const selfEpic = epicDirOf(selfPosix);
    const readyAll = listReadyBlueprints({ repoRoot });
    const sameEpicPending = listSameEpicPending({
        repoRoot, blueprintDir, readyBlueprints: readyAll,
    });
    const ready = readyAll.filter((entry) => {
        const bp = entry.blueprint;
        return bp !== selfRaw && bp !== selfPosix;
    });
    const ranked = ready.map((entry) => {
        const bp = entry.blueprint;
        const epic = epicDirOf(bp);
        return {
            blueprint: bp,
            epic,
            sameEpic: epic === selfEpic,
            bpName: bp.split('/').pop() || bp,
            epicName: epic.split('/').pop() || epic,
        };
    });
    // Epic ## Blueprints order는 epic별; distinct epic dir마다 한 번만 읽음.
    const orderCache = new Map();
    function orderOf(epicRel) {
        if (orderCache.has(epicRel))
            return orderCache.get(epicRel);
        const abs = path.join(repoRoot, epicRel, 'index.md');
        const names = parseEpicBlueprintOrder(abs);
        orderCache.set(epicRel, names);
        return names;
    }
    ranked.sort((a, b) => {
        // (1) finalize 대상과 같은 epic을 먼저
        if (a.sameEpic !== b.sameEpic)
            return a.sameEpic ? -1 : 1;
        if (a.sameEpic) {
            // (2)/(3) ## Blueprints 등록 순, 미등록은 path 순
            const order = orderOf(a.epic);
            const ai = order.indexOf(a.bpName);
            const bi = order.indexOf(b.bpName);
            const aListed = ai >= 0;
            const bListed = bi >= 0;
            if (aListed && bListed)
                return ai - bi;
            if (aListed !== bListed)
                return aListed ? -1 : 1;
            return a.blueprint.localeCompare(b.blueprint);
        }
        // (4) 다른 epic: epic directory name lexicographic, 다음 blueprint path
        const byEpic = a.epicName.localeCompare(b.epicName);
        if (byEpic !== 0)
            return byEpic;
        return a.blueprint.localeCompare(b.blueprint);
    });
    if (ranked.length === 0)
        return { next: null, remaining: [], sameEpicPending };
    const finalizedPaths = readAffectedPaths(repoRoot, selfPosix);
    const [head, ...rest] = ranked;
    const candidatePaths = readAffectedPaths(repoRoot, head.blueprint);
    // candidate order로 교집합; 문자열 equality만 — directory containment
    // 추론 없음 (tasks는 정확한 path entry를 선언).
    const sharedPaths = candidatePaths.filter((p) => finalizedPaths.includes(p));
    return {
        next: {
            blueprint: head.blueprint,
            epic: head.epic,
            sameEpic: head.sameEpic,
            sharedPaths,
        },
        remaining: rest.map(({ blueprint, epic, sameEpic }) => ({ blueprint, epic, sameEpic })),
        sameEpicPending,
    };
}
module.exports = {
    readCurrent, writeCurrent, clearCurrent, listReadyBlueprints, nextBlueprint,
    resolvePointerTask, presentCurrent, resolveCurrent, CurrentSelectionError,
};
