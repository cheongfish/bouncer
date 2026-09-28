'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const validateMod = require("./validate");
const { validateBlueprint } = validateMod;
const planSnapshot = require("./plan-snapshot");
const { computePlanSnapshot } = planSnapshot;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs, taskExecutionKind } = tasksDocs;
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const validateSections = require("./validate-sections");
const { parseTasksSections, extractPathCandidates, pathsOverlap } = validateSections;
const paths = require("./paths");
const { toPosix } = paths;
const layout = require("./layout");
const { CONTEXT_ROOT, isCanonicalBlueprintDir } = layout;
const schema = require("./schema");
const { executionKindOf } = schema;
// Plan·Execute 경계값은 한 모듈에만 둔다. CLI와 workflow가 서로 다른 상수를
// 복제하면 single/clustered·parallel 판정이 갈라진다.
const PLAN_SMALL_MAX_TASKS = 1;
const EXECUTE_SMALL_MAX_FILES = 3;
const EXECUTE_SMALL_MAX_LINES = 200;
// S30과 같은 허용 목록. validate-structural이 먼저 거절하지만 Execute 경로는
// 구조 게이트 없이 이 필드를 읽으므로 여기서도 동일 enum으로 막는다.
const REVIEW_RISK_ENUM = [
    'public_interface',
    'authentication',
    'authorization',
    'credential',
];
/**
 * Plan 리뷰 전략을 문서의 구조 신호만으로 분류한다.
 * reviewer 호출 전에 structural 검사와 plan draft 검사(G5·G10–G12·G19·G20)를
 * 통과해야 한다 — gate가 나중에 거절할 문서로 context review snapshot을 얼리지 않기 위해서다.
 * working tree와 review 문서는 쓰지 않으며, 실패 시 perspectives를 만들지 않는다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소와 blueprint 상대 경로
 * @returns {PlanDispatchResult} 성공 시 strategy·cluster·근거. 실패 시 ok:false —
 *   S 코드가 있으면 'structural validation failed', draft 검사 실패면
 *   'plan draft validation failed'(failures는 plan gate와 같은 항목)
 */
function classifyPlanReview({ repoRoot, blueprintDir }) {
    // 1. 구조·draft 실패를 축소 판정으로 덮지 않는다 — malformed review_risk·문서 부재·
    //    G19/G20 위반은 그대로 돌려 controller가 reviewer를 호출하지 않게 한다.
    //    validateBlueprint는 S 실패가 있으면 draft 검사를 건너뛰므로 한 결과에
    //    S와 G가 섞이지 않는다. 그래서 S 하나만 있어도 structural로 분류해도 된다.
    const checked = validateBlueprint({ repoRoot, blueprintDir, planDraft: true });
    if (!checked.ok) {
        const structural = checked.failures.some((f) => f.code.startsWith('S'));
        return {
            ok: false,
            error: structural ? 'structural validation failed' : 'plan draft validation failed',
            failures: checked.failures,
        };
    }
    const bp = toPosix(blueprintDir);
    const bpAbs = path.join(repoRoot, bp, 'index.md');
    let scale = 'full';
    try {
        const bpDoc = readDoc(bpAbs);
        const bouncer = bpDoc.data?.bouncer;
        if (bouncer && typeof bouncer.scale === 'string')
            scale = bouncer.scale;
    }
    catch (error) {
        // index 파싱 실패는 validateBlueprint가 이미 잡았어야 한다. 여기까지 오면
        // 레이스나 직접 호출이므로 축소 skip으로 위장하지 않는다.
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `blueprint index unreadable: ${message}` };
    }
    const snapshot = computePlanSnapshot({ repoRoot, blueprintDir: bp });
    if (!snapshot.ok)
        return snapshot;
    // 2. light는 G18 면제와 같은 신호(선언된 scale)만 본다. task 수로 skip을
    //    추론하면 full 소규모 Plan이 context review를 건너뛴다.
    if (scale === 'light') {
        return {
            ok: true,
            phase: 'plan',
            target: { digest: snapshot.digest, documents: snapshot.documents },
            strategy: 'skip',
            task_count: countCommitTasks(repoRoot, bp),
            clusters: [],
            perspectives: [],
            reasons: ['blueprint scale is light — context review is skipped'],
        };
    }
    const commitTasks = loadCommitTaskSignals({ repoRoot, blueprintDir: bp });
    if (!commitTasks.ok)
        return commitTasks;
    const taskCount = commitTasks.tasks.length;
    if (taskCount <= PLAN_SMALL_MAX_TASKS) {
        const only = commitTasks.tasks[0];
        const clusters = only
            ? [{
                    id: 'c1',
                    tasks: [only.id],
                    interface_keys: [...only.interfaceKeys].sort(),
                    touch_paths: [...only.touchPaths].sort(),
                }]
            : [];
        return {
            ok: true,
            phase: 'plan',
            target: { digest: snapshot.digest, documents: snapshot.documents },
            strategy: 'single',
            task_count: taskCount,
            clusters,
            perspectives: ['combined'],
            reasons: [
                `commit task count ${taskCount} <= ${PLAN_SMALL_MAX_TASKS} — single combined reviewer`,
            ],
        };
    }
    const clusters = buildClusters(commitTasks.tasks);
    return {
        ok: true,
        phase: 'plan',
        target: { digest: snapshot.digest, documents: snapshot.documents },
        strategy: 'clustered',
        task_count: taskCount,
        clusters,
        perspectives: [...clusters.map(() => 'local'), 'global'],
        reasons: [
            `commit task count ${taskCount} > ${PLAN_SMALL_MAX_TASKS} — clustered local+global review`,
            `formed ${clusters.length} cluster(s) from Interface backtick keys and Touch path overlap`,
        ],
    };
}
/**
 * frozen base/head의 numstat과 승인된 review_risk로 Execute 리뷰 전략을 고른다.
 * 경로명·diff 본문 키워드로 위험을 추측하지 않는다.
 *
 * @param {{
 *   repoRoot: string, blueprintDir: string, taskId: string,
 *   base: string, head: string, exec?: ExecFileSyncFn
 * }} opts
 * @returns {ExecuteDispatchResult} 성공 시 strategy·통계·위험, 실패 시 ok:false
 */
function classifyExecuteReview({ repoRoot, blueprintDir, taskId, base, head, exec = realExecFileSync, }) {
    // 1. Plan과 같은 S10 경계: isCanonicalBlueprintDir을 거치지 않으면
    //    `../`·절대경로가 path.join으로 repo 밖 tasks.md를 읽어 review_risk로
    //    security 관점을 열 수 있다. 전체 validateBlueprint는 다른 task의
    //    structural 실패까지 Execute를 막으므로 여기선 canonical만 맞춘다.
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        return {
            ok: false,
            error: 'structural validation failed',
            failures: [{
                    code: 'S10',
                    message: `blueprintDir must be under ${CONTEXT_ROOT}/epics`,
                    file: toPosix(blueprintDir),
                }],
        };
    }
    const digits = normalizeTaskDigits(taskId);
    if (!digits) {
        return { ok: false, error: `invalid task id: ${taskId}` };
    }
    const bp = toPosix(blueprintDir);
    const tasksRel = `${bp}/tasks/${digits}/tasks.md`;
    const tasksAbs = path.join(repoRoot, tasksRel);
    if (!fs.existsSync(tasksAbs)) {
        return { ok: false, error: `unknown task: ${digits}` };
    }
    let taskData;
    try {
        taskData = readDoc(tasksAbs).data;
    }
    catch (error) {
        // YAML/IO 실패를 missing task로 접으면 controller가 존재하지 않는 id로
        // 재시도한다. 파싱 오류는 그대로 드러낸다.
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `task unreadable: ${message}` };
    }
    const kind = taskExecutionKind(taskData);
    if (kind !== 'commit') {
        return { ok: false, error: `task ${digits} is not a commit task` };
    }
    const risk = readReviewRisk(taskData.bouncer);
    if (!risk.ok)
        return risk;
    let resolvedBase;
    let resolvedHead;
    try {
        resolvedBase = gitRevParse(exec, repoRoot, base);
        resolvedHead = gitRevParse(exec, repoRoot, head);
    }
    catch (error) {
        // 잘못된 ref·Git 부재는 single로 가장하지 않는다. frozen target이 없으면
        // review round를 열 수 없다.
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `git ref resolve failed: ${message}` };
    }
    let stats;
    try {
        stats = readNumstat(exec, repoRoot, resolvedBase, resolvedHead);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: `git diff failed: ${message}` };
    }
    const small = stats.changed_files <= EXECUTE_SMALL_MAX_FILES
        && stats.changed_lines <= EXECUTE_SMALL_MAX_LINES;
    const strategy = small ? 'single' : 'parallel';
    const perspectives = small
        ? ['combined']
        : ['spec_scope', 'correctness_tests', 'minimality_maintainability'];
    if (risk.flags.length > 0)
        perspectives.push('security');
    const reasons = [
        small
            ? `changed_files ${stats.changed_files} <= ${EXECUTE_SMALL_MAX_FILES}`
                + ` and changed_lines ${stats.changed_lines} <= ${EXECUTE_SMALL_MAX_LINES}`
            : `diff exceeds small thresholds (files=${stats.changed_files}, lines=${stats.changed_lines})`,
    ];
    if (risk.flags.length > 0) {
        reasons.push(`review_risk ${risk.flags.join(',')} adds security reviewer`);
    }
    else {
        reasons.push('review_risk empty — no security reviewer');
    }
    return {
        ok: true,
        phase: 'execute',
        target: { base: resolvedBase, head: resolvedHead, task: digits },
        strategy,
        changed_files: stats.changed_files,
        changed_lines: stats.changed_lines,
        risk_flags: risk.flags,
        perspectives,
        reasons,
    };
}
/**
 * commit task만 Interface backtick·Touch 경로 신호를 모은다.
 * verification node는 task_count/cluster에서 제외한다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts
 * @returns {{ ok: true, tasks: CommitTaskSignals[] } | DispatchFail}
 */
function loadCommitTaskSignals({ repoRoot, blueprintDir }) {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    const tasks = [];
    for (const entry of listing.entries) {
        if (entry.executionKind === 'verification')
            continue;
        if (entry.executionKind !== 'commit' && entry.executionKind !== null) {
            return { ok: false, error: `task ${entry.id} has invalid execution_kind` };
        }
        // 부재=commit(executionKind null)은 schema 계약과 같다. listing이 null을
        // 주면 레거시 문서를 commit으로 읽고, 잘못된 enum은 위에서 거절했다.
        let body;
        let data;
        try {
            const doc = readDoc(path.join(repoRoot, entry.tasks.rel));
            body = doc.body;
            data = doc.data;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { ok: false, error: `task unreadable: ${entry.tasks.rel}: ${message}` };
        }
        if (executionKindOf(data.bouncer) === 'verification') {
            continue;
        }
        const sections = parseTasksSections(body);
        const interfaceText = typeof sections.interface === 'string' ? sections.interface.trim() : '';
        const touchText = typeof sections.touch === 'string' ? sections.touch.trim() : '';
        // 비어 있거나 절 자체가 없으면 cluster 입력을 꾸며내지 않는다. full Plan의
        // Interface/Touch는 authoring 계약이므로 축소 single로 폴백하지 않는다.
        if (!interfaceText || !touchText) {
            return {
                ok: false,
                error: `empty or unreadable Interface/Touch in ${entry.tasks.rel}`,
            };
        }
        const interfaceKeys = extractBacktickKeys(interfaceText);
        const touchPaths = extractPathCandidates(touchText);
        const number = entry.number != null
            ? String(entry.number).padStart(3, '0')
            : (entry.id || '').replace(/^TASKS-/, '');
        tasks.push({
            id: entry.id || `TASKS-${number}`,
            number,
            interfaceKeys,
            touchPaths,
        });
    }
    return { ok: true, tasks };
}
/**
 * Interface backtick 식별자를 모은다. 경로형·함수형 모두 cluster 키로 쓴다.
 *
 * @param {string} text - Interface 절 본문
 * @returns {string[]} 중복 없는 backtick 내용
 */
function extractBacktickKeys(text) {
    const found = new Set();
    for (const match of text.matchAll(/`([^`]+)`/g)) {
        const key = match[1].trim();
        if (key)
            found.add(key);
    }
    return [...found];
}
/**
 * Interface 키 공유 또는 Touch 경로 중첩의 연결 요소를 cluster로 만든다.
 * 중첩이 없어도 각 task가 단독 cluster가 되어 global과 짝을 이룬다.
 *
 * @param {CommitTaskSignals[]} tasks - 번호 순 commit task 신호
 * @returns {PlanCluster[]} id 순 cluster 목록
 */
function buildClusters(tasks) {
    const n = tasks.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i) => {
        let root = i;
        while (parent[root] !== root)
            root = parent[root];
        let cur = i;
        while (parent[cur] !== cur) {
            const next = parent[cur];
            parent[cur] = root;
            cur = next;
        }
        return root;
    };
    const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb)
            parent[rb] = ra;
    };
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const sharedKey = tasks[i].interfaceKeys.some((k) => tasks[j].interfaceKeys.includes(k));
            const sharedPath = tasks[i].touchPaths.some((a) => (tasks[j].touchPaths.some((b) => pathsOverlap(a, b))));
            if (sharedKey || sharedPath)
                union(i, j);
        }
    }
    const groups = new Map();
    for (let i = 0; i < n; i += 1) {
        const root = find(i);
        const list = groups.get(root) || [];
        list.push(tasks[i]);
        groups.set(root, list);
    }
    const ordered = [...groups.values()].sort((a, b) => {
        const an = Math.min(...a.map((t) => Number(t.number)));
        const bn = Math.min(...b.map((t) => Number(t.number)));
        return an - bn;
    });
    return ordered.map((group, index) => {
        const interfaceKeys = new Set();
        const touchPaths = new Set();
        for (const task of group) {
            for (const key of task.interfaceKeys)
                interfaceKeys.add(key);
            for (const p of task.touchPaths)
                touchPaths.add(p);
        }
        return {
            id: `c${index + 1}`,
            tasks: group.map((t) => t.id).sort(),
            interface_keys: [...interfaceKeys].sort(),
            touch_paths: [...touchPaths].sort(),
        };
    });
}
/**
 * commit task 개수만 센다. light skip 응답의 task_count용.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {number} verification을 제외한 commit task 수
 */
function countCommitTasks(repoRoot, blueprintDir) {
    const listing = listTasksDocs({ repoRoot, blueprintDir });
    let count = 0;
    for (const entry of listing.entries) {
        if (entry.executionKind === 'verification')
            continue;
        count += 1;
    }
    return count;
}
/**
 * `--task` 값을 세 자리 숫자로 정규화한다.
 *
 * @param {string} taskId - `001` 또는 `TASKS-001`
 * @returns {string | null} 세 자리 숫자, 형식이 아니면 null
 */
function normalizeTaskDigits(taskId) {
    if (/^\d{3}$/.test(taskId))
        return taskId;
    const match = /^TASKS-(\d{3})$/.exec(taskId);
    return match ? match[1] : null;
}
/**
 * bouncer.review_risk를 읽는다. 부재는 legacy []로 읽고, 형태 오류만 거절한다.
 *
 * @param {Record<string, unknown> | undefined} bouncer - tasks frontmatter bouncer
 * @returns {{ ok: true, flags: string[] } | DispatchFail}
 */
function readReviewRisk(bouncer) {
    if (!bouncer || bouncer.review_risk === undefined) {
        return { ok: true, flags: [] };
    }
    const value = bouncer.review_risk;
    if (!Array.isArray(value)) {
        return { ok: false, error: 'S30 review_risk must be an array' };
    }
    const flags = [];
    const seen = new Set();
    for (const entry of value) {
        if (typeof entry !== 'string' || !REVIEW_RISK_ENUM.includes(entry)) {
            return { ok: false, error: `S30 review_risk value invalid: ${String(entry)}` };
        }
        if (seen.has(entry)) {
            return { ok: false, error: `S30 review_risk duplicate: ${entry}` };
        }
        seen.add(entry);
        flags.push(entry);
    }
    return { ok: true, flags };
}
/**
 * Git 객체를 해석한다. 잘못된 ref는 throw한다.
 *
 * @param {ExecFileSyncFn} exec - 주입 가능한 execFileSync
 * @param {string} repoRoot - cwd
 * @param {string} ref - base/head 후보
 * @returns {string} 40자 또는 short SHA
 */
function gitRevParse(exec, repoRoot, ref) {
    const out = exec('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    return String(out).trim();
}
/**
 * `git diff --numstat`을 파싱한다. binary(`-`) 행은 파일만 세고 줄 합계에는
 * 넣지 않으며, binary만으로 parallel로 올리지 않는다.
 *
 * @param {ExecFileSyncFn} exec - 주입 가능한 execFileSync
 * @param {string} repoRoot - cwd
 * @param {string} base - resolved base SHA
 * @param {string} head - resolved head SHA
 * @returns {{ changed_files: number, changed_lines: number }}
 */
function readNumstat(exec, repoRoot, base, head) {
    const out = String(exec('git', ['diff', '--numstat', base, head], {
        cwd: repoRoot,
        encoding: 'utf8',
    }));
    let changedFiles = 0;
    let changedLines = 0;
    for (const line of out.split('\n')) {
        if (!line.trim())
            continue;
        const parts = line.split('\t');
        if (parts.length < 3)
            continue;
        changedFiles += 1;
        const add = parts[0];
        const del = parts[1];
        // binary는 `-`/`-`. 숫자로 합치면 NaN이 되어 임계값을 오염시킨다.
        if (add === '-' || del === '-')
            continue;
        const additions = Number(add);
        const deletions = Number(del);
        if (Number.isFinite(additions))
            changedLines += additions;
        if (Number.isFinite(deletions))
            changedLines += deletions;
    }
    return { changed_files: changedFiles, changed_lines: changedLines };
}
module.exports = {
    PLAN_SMALL_MAX_TASKS,
    EXECUTE_SMALL_MAX_FILES,
    EXECUTE_SMALL_MAX_LINES,
    REVIEW_RISK_ENUM,
    classifyPlanReview,
    classifyExecuteReview,
};
