'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const layout = require("./layout");
const { isCanonicalBlueprintDir } = layout;
const paths = require("./paths");
const { toPosix, epicDirOf } = paths;
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
function fail(reason, cause, next) {
    return { ok: false, reason, cause, next };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * 같은 디렉터리 임시 파일에 쓴 뒤 rename한다. 쓰기 도중 죽어도 대상 파일은
 * 옛 바이트 또는 새 바이트 중 하나로만 남는다. 실패하면 임시 파일을 지우고 재던진다.
 *
 * @param {string} abs - 대상 파일 절대 경로
 * @param {string} text - 새 파일 내용
 * @returns {void}
 */
function atomicWriteFile(abs, text) {
    // 임시 이름은 무작위 접미사 + 배타 생성('wx')이라 예측해 미리 심어 둔 파일이나
    // 심볼릭 링크를 따라가 엉뚱한 곳에 쓰는 일이 없다(이미 있으면 EEXIST로 실패).
    const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${crypto.randomBytes(8).toString('hex')}.tmp`);
    // 대상의 기존 권한을 보존한다. 임시 파일은 umask 기본 모드로 생기므로 rename 전에 맞춘다.
    // stat 실패(대상 부재 등)는 호출자가 이미 readDoc으로 걸러 이쪽이 던지면 그대로 실패시킨다.
    const mode = fs.statSync(abs).mode & 0o7777;
    try {
        fs.writeFileSync(tmp, text, { flag: 'wx', mode });
        // writeFileSync의 mode는 umask에 깎이므로 chmod로 정확한 값을 되돌린다.
        fs.chmodSync(tmp, mode);
        fs.renameSync(tmp, abs);
    }
    catch (error) {
        try {
            fs.unlinkSync(tmp);
        }
        catch (unlinkError) {
            // ENOENT만 흡수: write가 실패했거나 rename이 이미 옮겨 임시 파일이 없다.
            if (!isRecord(unlinkError) || unlinkError.code !== 'ENOENT')
                throw unlinkError;
        }
        throw error;
    }
}
/**
 * 한 문서를 읽어 `bouncer.status` 전이 계획을 만든다. 파일은 쓰지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} rel - 저장소 상대 POSIX 경로
 * @param {string} target - 목표 상태(`approved`/`ready`)
 * @returns {Plan | ApproveFail} 계획, 읽기·형태 실패면 `plan-approve-target`, 전이 불가 상태면 `plan-approve-status`
 */
function planDoc(repoRoot, rel, target) {
    const abs = path.join(repoRoot, rel);
    let doc;
    try {
        doc = readDoc(abs);
    }
    catch (error) {
        // 부재·권한·YAML 오류를 모두 "대상을 읽을 수 없음"으로 보고하되 원인 문구는 남긴다.
        const detail = error instanceof Error ? error.message : String(error);
        return fail('plan-approve-target', `${rel}: ${detail}`, 'create or repair the document, then retry');
    }
    const data = doc.data;
    const bouncer = isRecord(data) ? data.bouncer : undefined;
    if (!isRecord(data) || !isRecord(bouncer)) {
        return fail('plan-approve-target', `${rel}: missing bouncer frontmatter`, 'repair the frontmatter, then retry');
    }
    const status = bouncer.status;
    if (status !== 'draft' && status !== target) {
        return fail('plan-approve-status', `${rel}: status is ${String(status)}, expected draft or ${target}`, 'only draft documents can be approved; resolve the status manually');
    }
    return { rel, abs, data, body: doc.body, target, needsWrite: status === 'draft' };
}
/**
 * plan 승인 뒤 epic·blueprint·task의 `bouncer.status`를 한 번에 전이한다.
 * 모든 대상을 먼저 읽고 판정한 뒤에만 쓰므로, 판정 거절에서는 파일이 바뀌지 않는다.
 * 이미 목표 상태인 문서는 건드리지 않아 재실행이 멱등이다.
 * 판정 뒤 쓰기 도중 I/O 실패는 `plan-approve-write`로 끝나며 이미 쓴 `changed`를 싣는다.
 * 사용자 승인은 추론하지 않는다 — 호출 시점이 곧 plan 스킬의 승인 뒤라는 약속이다.
 *
 * @param {object} args - 인자 묶음
 * @param {string} args.repoRoot - 저장소 루트 절대 경로
 * @param {string} args.blueprintDir - 저장소 상대 blueprint 디렉터리
 * @param {ApproveDeps} [args.deps] - 테스트 seam. `writeFile(abs, text)`는 한 파일의 원자 쓰기를 대신한다
 * @returns {ApproveOk | ApproveFail} 성공이면 정렬된 changed·unchanged, 아니면 reason·cause·next
 */
function approvePlan({ repoRoot, blueprintDir, deps = {} }) {
    const writeFile = deps.writeFile || atomicWriteFile;
    // 1. 경로 검증: 저장소 안 정본 blueprint 경로만 받는다. `..`/절대 경로는
    //    정본 정규식이 이미 걸러내지만, 의도를 분명히 하려고 먼저 거절한다.
    const bp = toPosix(blueprintDir).replace(/\/+$/, '');
    if (bp === '' || path.isAbsolute(bp) || bp.split('/').includes('..') || !isCanonicalBlueprintDir(bp)) {
        return fail('plan-approve-target', `${blueprintDir}: not a canonical blueprint directory inside the repository`, 'pass --blueprint .bouncer/context/epics/<ddd-name>/blueprints/<ddd-name>');
    }
    // 2. task 열거: 레거시·잘못된 디렉터리·깨진 frontmatter는 승인 대상을 확정할 수 없다.
    const listing = listTasksDocs({ repoRoot, blueprintDir: bp });
    const listingProblems = [];
    if (listing.legacy)
        listingProblems.push(`${bp}: legacy root task files present`);
    for (const dir of listing.invalidDirs)
        listingProblems.push(`${bp}/tasks/${dir}: invalid task directory`);
    for (const entry of listing.entries) {
        if (entry.executionKind === null)
            listingProblems.push(`${entry.tasks.rel}: unreadable tasks.md frontmatter`);
    }
    if (listingProblems.length > 0) {
        return fail('plan-approve-target', listingProblems, 'repair the task layout, then retry');
    }
    if (listing.entries.length === 0) {
        return fail('plan-approve-target', `${bp}: no tasks/<NNN>/tasks.md documents`, 'scaffold tasks before approving');
    }
    // 3. 문서별 계획. blueprint를 먼저 읽어야 scale을 알고 context-review 검사를 가른다.
    const bpPlan = planDoc(repoRoot, `${bp}/index.md`, 'approved');
    if ('ok' in bpPlan)
        return bpPlan;
    const epicPlan = planDoc(repoRoot, `${epicDirOf(bp)}/index.md`, 'approved');
    if ('ok' in epicPlan)
        return epicPlan;
    const taskPlans = [];
    for (const entry of listing.entries) {
        const plan = planDoc(repoRoot, entry.tasks.rel, 'ready');
        if ('ok' in plan)
            return plan;
        taskPlans.push(plan);
    }
    // 4. full blueprint는 context review가 accepted여야 한다. light만 건너뛴다(부재는 full).
    const bpBouncer = bpPlan.data.bouncer;
    if (bpBouncer.scale !== 'light') {
        const crRel = `${bp}/context-review.md`;
        let crStatus;
        try {
            const crBouncer = readDoc(path.join(repoRoot, crRel)).data.bouncer;
            crStatus = isRecord(crBouncer) ? crBouncer.status : undefined;
        }
        catch (_error) {
            // 부재·파싱 실패는 "accepted 아님"으로만 접는다. 복구는 context-review 명령 소관이라
            // 여기서는 거절 사유와 다음 행동만 알려준다.
            crStatus = undefined;
        }
        if (crStatus !== 'accepted') {
            return fail('plan-approve-context-review', `${crRel}: status is ${crStatus === undefined ? 'missing' : String(crStatus)}, expected accepted`, 'run bouncer context-review close until the review is accepted, then retry');
        }
    }
    // 5. 판정 통과 — 이제부터만 쓴다. 순서는 epic → blueprint → tasks.
    const all = [epicPlan, bpPlan, ...taskPlans];
    const unchanged = all.filter((p) => !p.needsWrite).map((p) => p.rel).sort();
    const changed = [];
    for (const plan of all) {
        if (!plan.needsWrite)
            continue;
        // 키 순서와 본문을 보존하려고 status 값만 제자리에서 바꾼다.
        plan.data.bouncer.status = plan.target;
        try {
            writeFile(plan.abs, renderDoc(plan.data, plan.body));
        }
        catch (error) {
            // 모든 쓰기 실패를 plan-approve-write로 접는 것은 안전하다: 판정이 이미 끝났고
            // 재실행이 이미 쓴 문서를 unchanged로 넘기며 이어 끝내기 때문이다.
            const detail = error instanceof Error ? error.message : String(error);
            return {
                ...fail('plan-approve-write', `${plan.rel}: ${detail}`, 'fix the I/O problem and rerun the same command'),
                changed: [...changed].sort(),
            };
        }
        changed.push(plan.rel);
    }
    return { ok: true, changed: changed.sort(), unchanged };
}
module.exports = { approvePlan };
