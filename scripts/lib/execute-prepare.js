'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const current = require("./current");
const { readCurrent, presentCurrent, CurrentSelectionError } = current;
const runtimeState = require("./runtime-state");
const { worktreePathFor, coordinatorPathsFor, branchNamesFor, resolveWorktreeBranch } = runtimeState;
const seedWorktreeMod = require("./seed-worktree");
const { seedWorktree } = seedWorktreeMod;
const scopeMod = require("./scope");
const { readCoordinatorLedger } = scopeMod;
const paths = require("./paths");
const { toPosix } = paths;
const TASK_DOC_RE = /(?:^|\/)tasks\/(\d{3})\/tasks\.md$/;
function isSelectionError(error) {
    return error instanceof CurrentSelectionError
        || (typeof error === 'object'
            && error !== null
            && 'code' in error
            && typeof error.code === 'string'
            && String(error.code).startsWith('CURRENT_'));
}
function sameBlueprint(left, right) {
    return toPosix(left).replace(/\/+$/, '') === toPosix(right).replace(/\/+$/, '');
}
function taskDigits(task) {
    if (typeof task !== 'string' || !task)
        return null;
    if (/^\d{3}$/.test(task))
        return task;
    const match = TASK_DOC_RE.exec(toPosix(task));
    return match ? match[1] : null;
}
function gitStderr(error) {
    const err = error;
    const raw = err.stderr != null ? String(err.stderr) : (err.message || '');
    const first = raw.trim().split('\n').find((line) => line.trim());
    // JSON stdout을 깨지 않으려고 hook·사용법 덤프 전체가 아니라 첫 줄만 싣는다.
    return first || 'git worktree add failed';
}
function listWorktrees(repoRoot) {
    const out = execFileSync('git', ['worktree', 'list', '--porcelain'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    const entries = [];
    let current = null;
    const flush = () => {
        if (current)
            entries.push(current);
        current = null;
    };
    for (const line of out.split('\n')) {
        if (line.startsWith('worktree ')) {
            flush();
            current = { path: line.slice('worktree '.length), branch: null };
        }
        else if (current && line.startsWith('branch ')) {
            current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
        }
    }
    flush();
    return entries;
}
function realOf(target) {
    try {
        return fs.realpathSync(target);
    }
    catch (_e) {
        return null;
    }
}
function isDirectory(target) {
    try {
        return fs.statSync(target).isDirectory();
    }
    catch (_e) {
        return false;
    }
}
/**
 * 예상 경로가 Git에 등록된 worktree면 그 항목, 없으면 null, 디렉터리만
 * 있으면 'unregistered'. 등록 여부는 브랜치 이름이 아니라 경로로만 본다 —
 * 기존 체크아웃을 rename·migrate 하지 않기 위함이다.
 *
 * @param {string} repoRoot - 기준 checkout
 * @param {string} expectedPath - worktreePathFor 결과
 * @returns {ListedWorktree | null | 'unregistered'} 재사용 / 신규 / 거절
 */
function matchWorktree(repoRoot, expectedPath) {
    const listed = listWorktrees(repoRoot);
    const expectedReal = isDirectory(expectedPath) ? realOf(expectedPath) : null;
    if (expectedReal) {
        const hit = listed.find((entry) => realOf(entry.path) === expectedReal);
        if (hit)
            return hit;
        return 'unregistered';
    }
    return null;
}
function pointerTask(pointer, repoRoot) {
    const presented = presentCurrent(pointer, { repoRoot });
    if (!presented)
        return { task: null, scale: null };
    return { task: presented.task, scale: presented.scale };
}
function assignedWorkerPath(repoRoot, blueprintDir, pointer, ledger) {
    const taskId = taskDigits(pointer.task);
    const computed = coordinatorPathsFor({
        repoRoot, blueprint: blueprintDir, task: taskId || undefined,
    });
    if (ledger && Array.isArray(ledger.tasks) && taskId) {
        const entry = ledger.tasks.find((item) => item && item.id === taskId);
        if (entry && typeof entry.workerPath === 'string' && entry.workerPath) {
            return entry.workerPath;
        }
    }
    return computed.workerPath || computed.integrationPath;
}
function seedOrConflict(repoRoot, blueprintDir, worktreePath) {
    const seeded = seedWorktree({
        repoRoot,
        blueprintDir,
        worktreePath,
    });
    if (seeded.ok) {
        return {
            ok: true,
            moved: seeded.moved,
            restored: seeded.restored,
            config: seeded.config,
        };
    }
    // conflict만 계약 코드로 바꾸고, 이미 만든 worktree는 호출자가 지우지 않는다.
    if (seeded.reason === 'conflict') {
        return { ok: false, reason: 'seed-conflict', conflicts: seeded.conflicts || [] };
    }
    return { ok: false, reason: seeded.reason };
}
/**
 * standalone execute의 worktree 경로·브랜치·재사용·seed를 한 명령으로 수행한다.
 * coordinator 원장이 있으면 drive로 보고 생성·seed를 하지 않는다 — 그 쓰기는
 * `coordinate prepare` 소유이고, 여기서 main checkout을 건드리면 경계가 깨진다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - plan 문서가 있는 base checkout
 * @param {string} opts.blueprintDir - `--blueprint` 값
 * @returns {PrepareResult} 성공 payload 또는 거절 reason
 */
function executePrepare({ repoRoot, blueprintDir }) {
    const blueprint = toPosix(blueprintDir);
    let pointer;
    try {
        pointer = readCurrent({ repoRoot });
    }
    catch (error) {
        if (isSelectionError(error)) {
            const fail = { ok: false, reason: error.code };
            if (error.candidates)
                fail.candidates = error.candidates;
            if (error.issues)
                fail.issues = error.issues;
            return fail;
        }
        throw error;
    }
    if (!pointer)
        return { ok: false, reason: 'no-current' };
    if (!sameBlueprint(pointer.blueprint, blueprint)) {
        return { ok: false, reason: 'blueprint-mismatch' };
    }
    const { task, scale } = pointerTask(pointer, repoRoot);
    const found = readCoordinatorLedger({ repoRoot, blueprint });
    // 원장 파일이 있으면(읽을 수 없어도) drive다. 부재만 standalone이다.
    if (found.ok || found.reason === 'unreadable-ledger') {
        const ledger = found.ok ? found.ledger : null;
        return {
            ok: true,
            drive: true,
            worktreePath: assignedWorkerPath(repoRoot, blueprint, pointer, ledger),
            created: false,
            task,
            scale,
        };
    }
    const worktreePath = worktreePathFor({ repoRoot, blueprint });
    const matched = matchWorktree(repoRoot, worktreePath);
    if (matched === 'unregistered') {
        return { ok: false, reason: 'unregistered-worktree' };
    }
    let branch;
    try {
        // standalone도 coordinator와 같은 이름·충돌 계약을 써야 한다. 그래야 새
        // checkout만 만들고, 예전 checkout은 실제 branch를 보존하는 경계가 한 곳에 남는다.
        const names = branchNamesFor({ repoRoot, blueprint });
        // porcelain의 detached checkout은 helper가 branch 없는 경로를 신규로 보고
        // 기존 ref 충돌을 돌린다. 이 경우에는 새 branch를 만들려는 요청 자체가 없으므로
        // 실제 null을 보존한다; branchNamesFor는 위에서 계속 검증된다.
        const resolved = matched && !matched.branch
            ? null
            : resolveWorktreeBranch({ repoRoot, worktreePath, branch: names.standalone });
        branch = resolved ? resolved.branch : null;
        if (!matched) {
            fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
            execFileSync('git', ['worktree', 'add', '-b', branch, worktreePath, pointer.base], {
                cwd: repoRoot,
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        }
    }
    catch (error) {
        const code = error && typeof error === 'object' && 'code' in error
            ? error.code : null;
        if (code === 'invalid-commit-type' || code === 'invalid-branch-name' || code === 'branch-conflict') {
            return { ok: false, reason: code };
        }
        return { ok: false, reason: 'worktree-add-failed', message: gitStderr(error) };
    }
    if (matched) {
        // 등록된 체크아웃의 실제 브랜치를 그대로 돌려준다. 계산된 이름과 달라도
        // 옮기거나 고치지 않는다. porcelain에 branch 줄이 없으면 detached HEAD이므로
        // null을 그대로 둔다 — `<commit_type>/<leaf>`를 합성하면 스킬이 그 이름으로
        // 커밋을 시도하지만 워킹 트리는 그 브랜치에 있지 않다.
        branch = matched.branch;
    }
    const created = !matched;
    const seeded = seedOrConflict(repoRoot, blueprint, worktreePath);
    if (!seeded.ok)
        return seeded;
    return {
        ok: true,
        drive: false,
        worktreePath,
        branch,
        created,
        base: pointer.base,
        task,
        scale,
        seed: { moved: seeded.moved, restored: seeded.restored, config: seeded.config },
    };
}
module.exports = { executePrepare };
