// scripts/lib/commit.js
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
const validate = require("./validate");
const { validateBlueprint, loadBlueprintDocs, resolveTaskUnit } = validate;
const finalize = require("./finalize");
const { realGit, buildCommitMessage } = finalize;
const scope = require("./scope");
const { filterTaskCommitCandidates, coordinatorContext, recordActualPaths } = scope;
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
function commitTask({ repoRoot, blueprintDir, yes = false, git, }) {
    // 게이트·범위 실패는 반환값. git I/O 예외는 finalize와 같이 그대로 올린다.
    const gitApi = git || realGit(repoRoot);
    const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'commit' });
    if (!v.ok)
        return { ok: false, reason: 'validate', failures: v.failures };
    const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
    // 포인터 → 번호 순 첫 묶음. 새 해석기를 두지 않는다 (019/020 폴백).
    const taskUnit = resolveTaskUnit(docs, { repoRoot, blueprintDir });
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
    const { allow, violations, code } = checkCommitSafety({
        files: candidates, affectedPaths, blueprintDir, coordinator,
    });
    if (!allow)
        return { ok: false, reason: code || 'out-of-scope', violations };
    // 범위 허용과 분리된 task 커밋 전용 필터로 workflow 문서를 남긴다.
    const all = filterTaskCommitCandidates({
        repoRoot, changedFiles: changed, untrackedFiles: untracked,
    });
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
    gitApi.stage(all);
    gitApi.commit(commitMessage);
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
