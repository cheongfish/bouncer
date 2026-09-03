'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readDoc } = require('./frontmatter');
const { epicDirOf, toPosix } = require('./paths');
const { entriesForVerify } = require('./verification');
const { listTasksDocs, TASK_UNIT_BASENAMES, } = require('./tasks-docs');
function errorMessage(error) {
    // catch 값은 unknown이다. 예전 e.message 접근을 유지해 primitive throw의
    // 메시지는 undefined, null throw는 TypeError가 나게 둔다.
    return error.message;
}
/**
 * commit 게이트 G17용 스테이징 목록. throw하지 않는다 —
 * git 실패·비저장소는 { ok:false }로 올려 게이트가 G17로 보고하게 한다.
 */
function defaultStagedFiles({ repoRoot }) {
    try {
        const out = execFileSync('git', ['diff', '--cached', '--name-only'], {
            cwd: repoRoot,
            encoding: 'utf8',
        });
        return { ok: true, files: String(out).split('\n').filter(Boolean) };
    }
    catch (e) {
        const reason = typeof e === 'object' && e !== null && 'message' in e && e.message
            ? String(e.message)
            : 'git-failed';
        return { ok: false, reason };
    }
}
// 묶음 leaf는 없어도 된다(S17이 따로 보고). 없으면 undefined를 돌려
// 호출자가 대체 묶음으로 채우지 못하게 한다. 파싱 실패만 S0으로 남긴다.
function readOptionalLeaf(repoRoot, rel, parseErrors) {
    if (!rel)
        return undefined;
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs))
        return undefined;
    try {
        const { data, body } = readDoc(abs);
        return { data, body, rel };
    }
    catch (e) {
        parseErrors.push({ code: 'S0', message: errorMessage(e), file: rel });
        return undefined;
    }
}
function loadBlueprintDocs({ repoRoot, blueprintDir }) {
    const bp = toPosix(blueprintDir);
    const tasksListing = listTasksDocs({ repoRoot, blueprintDir });
    const rels = {
        epicIndex: `${epicDirOf(bp)}/index.md`,
        blueprintIndex: `${bp}/index.md`,
        // finalize · execute G6 호환용 대표 경로(첫 task 문서).
        // 묶음이 없을 때도 정본 레이아웃을 가리킨다 — 레거시 루트 basename은
        // migrate task-layout 입력이고, validate는 S15로 거절한다(보고 경로로 쓰지 않음).
        tasks: tasksListing.entries[0]
            ? tasksListing.entries[0].rel
            : `${bp}/tasks/001/tasks.md`,
        verification: `${bp}/verification.md`,
        review: `${bp}/review.md`,
        explain: `${bp}/explain.md`,
        // BP 단위 슬롯. plan 게이트 G18이 이 문서를 판정한다. 슬롯이 없으면
        // 문서가 로드되지 않아 checkStructural/S19가 이 파일을 보지 못한다.
        contextReview: `${bp}/context-review.md`,
    };
    const docs = {};
    const parseErrors = [];
    const optionalKeys = [
        'epicIndex', 'blueprintIndex', 'verification', 'review', 'explain', 'contextReview',
    ];
    for (const key of optionalKeys) {
        const rel = rels[key];
        const abs = path.join(repoRoot, rel);
        if (fs.existsSync(abs)) {
            try {
                const { data, body } = readDoc(abs);
                docs[key] = { data, body, rel };
            }
            catch (e) {
                parseErrors.push({ code: 'S0', message: errorMessage(e), file: rel });
            }
        }
    }
    const tasksDocs = [];
    for (const entry of tasksListing.entries) {
        const abs = path.join(repoRoot, entry.rel);
        if (!fs.existsSync(abs))
            continue;
        try {
            const { data, body } = readDoc(abs);
            tasksDocs.push({ data, body, rel: entry.rel });
        }
        catch (e) {
            parseErrors.push({ code: 'S0', message: errorMessage(e), file: entry.rel });
        }
    }
    if (tasksDocs.length > 0) {
        // docs.tasks = 첫 문서 호환 필드. execute 게이트는 taskUnit만 본다.
        docs.tasks = tasksDocs[0];
        docs.tasksDocs = tasksDocs;
    }
    // 묶음별 파싱. 파일이 없으면 해당 leaf는 undefined — 대체 묶음으로 채우지 않는다.
    const taskUnits = tasksListing.entries.map((entry) => ({
        number: entry.number,
        dir: entry.dir,
        tasks: readOptionalLeaf(repoRoot, entry.tasks.rel, parseErrors),
        verification: readOptionalLeaf(repoRoot, entry.verification.rel, parseErrors),
        review: readOptionalLeaf(repoRoot, entry.review.rel, parseErrors),
    }));
    docs.taskUnits = taskUnits;
    return { docs, rels, parseErrors, tasksListing };
}
/**
 * execute / finalize 가 쓸 대상 묶음.
 * entriesForVerify(019)와 같은 포인터 해석: 매칭되면 그 엔트리만, 아니면 번호 순 첫 묶음.
 * 단위 테스트처럼 repoRoot가 없으면 docs.tasks·verification·review 평탄 필드로 합성.
 */
function resolveTaskUnit(docs, { repoRoot, blueprintDir } = {}) {
    if (repoRoot && blueprintDir) {
        const entries = entriesForVerify(repoRoot, blueprintDir);
        const entry = entries[0];
        if (entry) {
            const units = Array.isArray(docs.taskUnits) ? docs.taskUnits : [];
            const match = units.find((u) => ((entry.dir && u.dir === entry.dir)
                || (entry.number != null && u.number === entry.number)
                || (u.tasks && u.tasks.rel === entry.tasks.rel)));
            if (match)
                return match;
            // listing에는 있으나 파싱 누락 — 빈 leaf로라도 경로를 유지해 G6 file을 살린다.
            return {
                number: entry.number,
                dir: entry.dir,
                tasks: undefined,
                verification: undefined,
                review: undefined,
            };
        }
    }
    if (docs.tasks || docs.verification || docs.review) {
        return {
            number: null,
            dir: null,
            tasks: docs.tasks,
            verification: docs.verification,
            review: docs.review,
        };
    }
    return null;
}
/** 파일이 없을 때도 실패 file 경로를 묶음 안으로 고정한다. */
function unitLeafRel(unit, leaf, fallbackRel) {
    if (unit && leaf in unit) {
        const leafDoc = unit[leaf];
        if (leafDoc && leafDoc.rel)
            return leafDoc.rel;
    }
    if (unit && unit.dir) {
        const idx = ['tasks', 'verification', 'review'].indexOf(leaf);
        if (idx >= 0)
            return `${unit.dir}/${TASK_UNIT_BASENAMES[idx]}`;
    }
    return fallbackRel;
}
/**
 * blueprint 상태에 따라 task 묶음에서 필수인 leaf를 돌려준다.
 * closed만 축약 레이아웃(verification.md만)을 허용하고,
 * draft/approved 등 열린 상태는 세 장 모두 요구한다.
 *
 * @param {unknown} status - blueprint index의 bouncer.status
 * @returns {Array<'tasks'|'verification'|'review'>} 필수 leaf 이름
 */
function requiredTaskLeaves(status) {
    // closed는 finalize가 일회성 문서를 지운 뒤의 단말 상태다.
    // 재개·task 추가가 없으므로 tasks.md/review.md 부재를 구조 실패로 보지 않는다.
    if (status === 'closed')
        return ['verification'];
    return ['tasks', 'verification', 'review'];
}
// 존재 여부만 확인: 가볍고 파싱하지 않아야 함. execute gate가 verification을
// 다시 실행(verification.md를 다시 씀)하기 전에 호출되기 때문.
function blueprintDocsExist({ repoRoot, blueprintDir }) {
    const bp = toPosix(blueprintDir);
    const tasksListing = listTasksDocs({ repoRoot, blueprintDir });
    // tasks/<NNN>/가 있으면(축약으로 verification만 남아도) 존재로 본다.
    if (tasksListing.entries.length > 0)
        return true;
    // index.md만 있어도 존재로 본다 — imported exhibit처럼 task leaf가 없는
    // blueprint도 S11이 아니라 이후 상태 검사(S18 등)로 보내야 한다.
    // closed 축약은 index+explain+verification을 남기므로 여기에도 걸린다.
    // 루트 review.md는 존재 신호로 쓰지 않는다 — 정본 증적은 unit verification.
    return ['index.md', 'verification.md', 'explain.md']
        .some((name) => fs.existsSync(path.join(repoRoot, bp, name)));
}
// 문서·bouncer 부재는 throw가 아니라 undefined. 호출자가 enum 문자열과
// 비교하므로, 없는 문서는 자연히 status 검사에서 실패한다.
function statusOf(doc) {
    if (!doc)
        return undefined;
    const data = doc.data;
    const bouncer = data && data.bouncer;
    return bouncer ? bouncer.status : undefined;
}
module.exports = {
    defaultStagedFiles,
    readOptionalLeaf,
    loadBlueprintDocs,
    resolveTaskUnit,
    unitLeafRel,
    blueprintDocsExist,
    statusOf,
    requiredTaskLeaves,
};
