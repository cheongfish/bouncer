'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
// 레거시 단일 문서와 번호 붙은 문서를 한 모듈에서만 판정한다.
// 다른 모듈이 tasks.md / tasks-\d{3} 문자열을 직접 매칭하지 않게 하기 위함.
const LEGACY_TASKS_BASENAME = 'tasks.md';
const INITIAL_NUMBERED_TASKS_BASENAME = 'tasks-001.md';
// tasks-1.md · tasks-01.md 는 정본이 아니다 — 세 자리 zero-pad만 인정.
const NUMBERED_TASKS_RE = /^tasks-(\d{3})\.md$/;
function isNumberedTasksBasename(name) {
    return typeof name === 'string' && NUMBERED_TASKS_RE.test(name);
}
function isLegacyTasksBasename(name) {
    return name === LEGACY_TASKS_BASENAME;
}
function isTasksBasename(name) {
    return isLegacyTasksBasename(name) || isNumberedTasksBasename(name);
}
/**
 * S5 기대 id.
 * - tasks.md → TASKS-{blueprintId} (레거시: 파일 이름에 번호가 없어 blueprint id를 씀)
 * - tasks-{NNN}.md → TASKS-{NNN} (파일 번호가 곧 task id)
 */
function expectedTasksId(basename, blueprintId) {
    if (typeof basename !== 'string')
        return null;
    const m = NUMBERED_TASKS_RE.exec(basename);
    if (m)
        return `TASKS-${m[1]}`;
    if (basename === LEGACY_TASKS_BASENAME && typeof blueprintId === 'string' && blueprintId) {
        return `TASKS-${blueprintId}`;
    }
    return null;
}
/**
 * blueprint 디렉터리에서 task 문서 목록을 번호 오름차순으로 돌려준다.
 * 문서 내용은 읽지 않는다 — 이름·id·레거시/혼재 판정만.
 */
function listTasksDocs({ repoRoot, blueprintDir }) {
    // paths ↔ tasks-docs 순환을 피하려고 함수 안에서 require.
    const { parsePathIds, toPosix } = require('./paths');
    const bp = toPosix(blueprintDir);
    const absDir = path.join(repoRoot, bp);
    let names;
    try {
        names = fs.readdirSync(absDir);
    }
    catch (_e) {
        return { entries: [], mixed: false, legacy: false };
    }
    const hasLegacy = names.some(isLegacyTasksBasename);
    const numbered = [];
    for (const name of names) {
        const m = NUMBERED_TASKS_RE.exec(name);
        if (m)
            numbered.push({ name, n: Number(m[1]), digits: m[1] });
    }
    numbered.sort((a, b) => a.n - b.n);
    const hasNumbered = numbered.length > 0;
    const mixed = hasLegacy && hasNumbered;
    const legacy = hasLegacy && !hasNumbered;
    const { blueprintId } = parsePathIds(bp);
    const entries = [];
    // 혼재여도 호출자가 양쪽을 볼 수 있게 모두 넣는다. 검증은 mixed로 거절한다.
    if (hasLegacy) {
        entries.push({
            rel: `${bp}/${LEGACY_TASKS_BASENAME}`,
            id: expectedTasksId(LEGACY_TASKS_BASENAME, blueprintId),
            basename: LEGACY_TASKS_BASENAME,
            number: null,
        });
    }
    for (const item of numbered) {
        entries.push({
            rel: `${bp}/${item.name}`,
            id: `TASKS-${item.digits}`,
            basename: item.name,
            number: item.n,
        });
    }
    return { entries, mixed, legacy };
}
module.exports = {
    LEGACY_TASKS_BASENAME,
    INITIAL_NUMBERED_TASKS_BASENAME,
    NUMBERED_TASKS_RE,
    isNumberedTasksBasename,
    isLegacyTasksBasename,
    isTasksBasename,
    expectedTasksId,
    listTasksDocs,
};
