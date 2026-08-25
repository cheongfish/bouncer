'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { readDoc } = require('./frontmatter');
const { epicDirOf, toPosix } = require('./paths');
const { readRuntimeCurrent, writeRuntimeCurrent, clearRuntimeCurrent } = require('./runtime-state');
const { listTasksDocs } = require('./tasks-docs');
const READY_TASK_STATUS = ['ready', 'in_progress'];
// epic `## Blueprints` 링크 대상(예: `blueprints/BP-001-slug/index.md`)과 매칭.
// blueprint directory 이름만 캡처; title 텍스트와 한 줄 purpose는 무시.
const BLUEPRINT_LINK_RE = /\]\(blueprints\/([^/)]+)\/index\.md\)/g;
// --task 는 세 자리 숫자 또는 TASKS-NNN 만 받는다. 그 외 형식은 해석 실패.
const TASK_DIGITS_RE = /^(\d{3})$/;
const TASK_ID_RE = /^TASKS-(\d{3})$/;
function bouncerOf(data) {
    // `data && data.bouncer`와 같다. `'bouncer' in data`로 바꾸면 프로토타입
    // 필드가 생기고, data가 null일 때 예전처럼 단락되지 않을 수 있다.
    return data ? data.bouncer : data;
}
function bouncerStatus(data) {
    const bouncer = bouncerOf(data);
    return bouncer ? bouncer.status : undefined;
}
function readCurrent({ repoRoot, deps }) {
    return readRuntimeCurrent({ repoRoot, deps });
}
function writeCurrent({ repoRoot, blueprint, base, task, deps, }) {
    return writeRuntimeCurrent({
        repoRoot, blueprint, base, task, deps,
    });
}
function clearCurrent({ repoRoot, deps }) {
    return clearRuntimeCurrent({ repoRoot, deps });
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
    const taskPath = typeof current.task === 'string' && current.task ? current.task : null;
    if (!taskPath) {
        return { blueprint: current.blueprint, base: current.base, task: null, scale };
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
            if (typeof bpStatus !== 'string' || bpStatus === 'closed')
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
    resolvePointerTask, presentCurrent,
};
