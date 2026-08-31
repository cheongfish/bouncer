'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { CONTEXT_ROOT, normalizeRepoPath, isCanonicalEpicDir, isCanonicalBlueprintDir, } = require('./layout');
const { parsePathIds, isNumericContextId } = require('./paths');
const { renderDoc } = require('./render');
const { parseFrontmatter } = require('./frontmatter');
const { templateBody, TEMPLATES } = require('./templates');
const { ensureEpicIndexEntry, listEpicDirNames } = require('./epic-index');
const { TASK_UNIT_BASENAMES, expectedTaskDocIds, } = require('./tasks-docs');
const { DEFAULT_COMMIT_TYPE, DEFAULT_SCALE, SCALE_ENUM } = require('./schema');
function writeRel(repoRoot, rel, data, body) {
    const abs = path.join(repoRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, renderDoc(data, body));
    return rel;
}
function bouncerDoc(type, title, description, resource, tags, timestamp, bouncer) {
    return { type, title, description, resource, tags, timestamp, bouncer };
}
function requireNumericId(id, label) {
    if (!isNumericContextId(id)) {
        throw new Error(`${label} must be a zero-padded three-digit id (\\d{3}), got ${JSON.stringify(id)}`);
    }
}
/** 정본 epic 디렉터리의 zero-pad 세 자리 id를 꺼낸다. */
function epicIdFromDir(canonicalEpicDir) {
    const leaf = canonicalEpicDir.split('/').pop() || '';
    const m = /^(\d{3})-/.exec(leaf);
    if (!m) {
        throw new Error(`cannot derive numeric epic id from ${canonicalEpicDir}`);
    }
    return m[1];
}
/**
 * blueprint index.md의 bouncer 블록을 읽는다.
 * 판정을 못 하는 경우(파일 없음 / 프론트매터 파싱 실패 / 비객체)는 null —
 * "신호가 없다"이지 "그렇다"가 아니다. 여기서 같이 죽으면 index.md가 아직 없는
 * 저장소나 손상된 문서에서 scaffold 자체가 막힌다.
 */
function readBlueprintBouncer(repoRoot, blueprintDirRel) {
    const abs = path.join(repoRoot, blueprintDirRel, 'index.md');
    let data;
    try {
        ({ data } = parseFrontmatter(fs.readFileSync(abs, 'utf8')));
    }
    catch {
        return null;
    }
    // YAML은 unknown이다. falsy·비객체에서 멈추고, 객체일 때만 안을 읽는다.
    if (!data || typeof data !== 'object')
        return null;
    const bouncer = 'bouncer' in data ? data.bouncer : undefined;
    if (!bouncer || typeof bouncer !== 'object')
        return null;
    return bouncer;
}
/** blueprint index.md의 bouncer.status가 잠금(`closed`)인지 본다. */
function isClosedBlueprint(repoRoot, blueprintDirRel) {
    const bouncer = readBlueprintBouncer(repoRoot, blueprintDirRel);
    return Boolean(bouncer && bouncer.status === 'closed');
}
/**
 * blueprint가 선언한 scale을 돌려준다. 선언은 사람이 쓴 index.md의
 * `bouncer.scale`뿐이다 — 경로 수·diff 크기로 추론하지 않는다.
 * 알 수 없는 값이나 읽기 실패는 기본값(full)으로 떨어뜨린다: 문서 세트를
 * 줄이는 쪽이 아니라 늘리는 쪽이 안전한 실패다.
 */
function blueprintScale(repoRoot, blueprintDirRel) {
    const bouncer = readBlueprintBouncer(repoRoot, blueprintDirRel);
    const scale = bouncer ? bouncer.scale : undefined;
    return typeof scale === 'string' && SCALE_ENUM.includes(scale)
        ? scale
        : DEFAULT_SCALE;
}
/** 알 수 없는 scale은 파일을 하나도 쓰기 전에 거절한다. */
function requireScale(scale) {
    if (scale === undefined)
        return DEFAULT_SCALE;
    if (typeof scale !== 'string' || !SCALE_ENUM.includes(scale)) {
        throw new Error(`scale must be one of ${SCALE_ENUM.join(' | ')}, got ${JSON.stringify(scale)}`);
    }
    return scale;
}
/**
 * scale에 맞는 템플릿 이름. light는 `<base>-light.md`가 실제로 있을 때만
 * 그 이름을 쓰고, 없으면 공용 템플릿으로 떨어진다 — full 본문을 바이트
 * 단위로 유지하면서, light가 full과 같은 본문을 쓰는 문서(verification)는
 * 사본을 두지 않기 위함. 사본을 두면 공용 템플릿만 고칠 때 light가 조용히
 * 뒤처진다.
 */
function templateNameFor(base, scale) {
    if (scale !== 'light')
        return base;
    const lightName = base.replace(/\.md$/, '-light.md');
    return lightName in TEMPLATES ? lightName : base;
}
function scaffoldEpic({ repoRoot, epicId, name, timestamp }) {
    requireNumericId(epicId, 'epicId');
    const dir = `${CONTEXT_ROOT}/epics/${epicId}-${name}`;
    // 번호는 다른 slug로 다시 쓰면 새 디렉터리에 그대로 써지고, 경로에서 id를
    // 파생하는 S5도 통과한다. 그래서 같은 번호를 쓰는 epic이 둘 생겨도 아무
    // 단계에서 걸리지 않는다(024가 그랬다). 같은 이름의 재실행은 종전대로 두고,
    // 다른 slug가 번호를 재사용하는 경우만 쓰기 전에 거절한다.
    const conflicting = listEpicDirNames(repoRoot)
        .filter((entry) => entry.slice(0, 3) === epicId && entry !== `${epicId}-${name}`);
    if (conflicting.length > 0) {
        throw new Error(`epic id ${epicId} is already used by ${conflicting.join(', ')} — pick an unused id`);
    }
    const rel = `${dir}/index.md`;
    const description = `Epic ${epicId}`;
    const data = bouncerDoc('bouncer.epic', `${epicId} ${name}`, description, rel, ['bouncer', 'epic'], timestamp, 
    // supersedes는 epic·blueprint 전용. 빈 배열은 "자리만" — 값은 사람이 채운다.
    { id: epicId, epic_id: epicId, status: 'draft', supersedes: [] });
    const body = templateBody('epic.md', { epicId, name });
    const created = [writeRel(repoRoot, rel, data, body)];
    // OKF §6 번들 루트 목록 — scaffold가 소유. 이미 있으면 no-op.
    const indexRel = ensureEpicIndexEntry({
        repoRoot, epicId, name, description,
    });
    if (indexRel)
        created.push(indexRel);
    return created;
}
/**
 * 기존 blueprint 에 tasks/<NNN>/ 묶음 3종을 추가한다.
 * 거절 조건을 모두 검사한 뒤에만 파일을 쓴다 — 일부만 생성된 상태를 남기지 않기 위함.
 */
function scaffoldTask({ repoRoot, blueprintDir, taskId, timestamp, scale }) {
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        throw new Error(`blueprintDir must be under ${CONTEXT_ROOT}/epics`);
    }
    requireNumericId(taskId, 'taskId');
    const bp = normalizeRepoPath(blueprintDir);
    const { epicId, blueprintId } = parsePathIds(bp);
    if (!epicId || !blueprintId) {
        throw new Error(`cannot derive epic/blueprint ids from ${bp}`);
    }
    // finalize가 잠근 blueprint는 다시 열지 않는다. 파일을 쓰기 전에 거절해
    // tasks/<NNN>/ 가 남지 않게 한다. cli.ts의 기존 catch가 이 메시지를
    // `scaffold: <메시지>` + exit 2 로 옮긴다.
    if (isClosedBlueprint(repoRoot, bp)) {
        throw new Error(`blueprint is closed (finalized): ${bp} — scaffold a new blueprint instead of adding a task to this one`);
    }
    const taskDir = `${bp}/tasks/${taskId}`;
    const absTaskDir = path.join(repoRoot, taskDir);
    // 덮어쓰기 금지 — 존재하면 즉시 거절 (파일 쓰기 전).
    if (fs.existsSync(absTaskDir)) {
        throw new Error(`task directory already exists: ${taskDir}`);
    }
    const ids = expectedTaskDocIds(taskId);
    // 호출자가 scale을 주지 않으면 blueprint가 선언한 값을 따른다. 나중에 붙는
    // task도 같은 blueprint 계약을 쓰게 하려는 것 — 새 플래그를 만들지 않는다.
    const taskScale = requireScale(scale === undefined ? blueprintScale(repoRoot, bp) : scale);
    const isLight = taskScale === 'light';
    const body = (templateName) => templateBody(templateNameFor(templateName, taskScale), { epicId, blueprintId, name: taskId });
    const [tasksBase, verifyBase, reviewBase] = TASK_UNIT_BASENAMES;
    const tasksRel = `${taskDir}/${tasksBase}`;
    const verifyRel = `${taskDir}/${verifyBase}`;
    const reviewRel = `${taskDir}/${reviewBase}`;
    // mkdir 포함 쓰기는 검사 통과 후에만. writeRel 이 dirname 을 만든다.
    const created = [];
    created.push(writeRel(repoRoot, tasksRel, bouncerDoc('bouncer.tasks', `${taskId} tasks`, `Tasks for ${taskId}`, tasksRel, ['bouncer', 'tasks'], timestamp, {
        id: ids.tasks, epic_id: epicId, blueprint_id: blueprintId, status: 'draft',
        affected_paths: [],
        scope_evidence: {
            producer: 'graphify',
            generated_at: timestamp,
            suggested_paths: [],
            // 새 문서는 scope_evidence만 쓴다. 빈 리스트는 G4가 거절한다 —
            // graphify-runner가 실제 조회 근거를 채우기 전에는 계획을 승인하지 않기 위함.
            basis: [],
        },
    }), body(tasksBase)));
    // yaml.dump는 주석을 직렬화하지 못한다. basis를 예시 엔트리로 채우면
    // S9/G4가 통과해 미작성 계획이 승인되므로, dump 뒤에 YAML 주석만 끼워
    // 필드·허용값을 보여주고 파싱 값은 []로 둔다.
    // light는 이 5줄짜리 YAML 주석을 넣지 않는다 — 계획 문서 100줄 예산에서
    // 가장 큰 고정비다. basis 자체는 light에서도 G4가 그대로 요구하고,
    // 필드(graph/status/query/result)와 허용값은 skills/graphify-runner가 갖는다.
    if (!isLight) {
        const abs = path.join(repoRoot, tasksRel);
        const hinted = fs.readFileSync(abs, 'utf8').replace(/^([ \t]*)basis: \[\][ \t]*$/m, [
            '$1# 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다',
            '$1# - graph: source | test | context',
            '$1#   status: updated | reused | fail-skip | skip-disabled | missing',
            '$1#   query: <graphify 조회>',
            '$1#   result: <한 줄 요약>',
            '$1# quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다',
            '$1basis: []',
        ].join('\n'));
        fs.writeFileSync(abs, hinted);
    }
    created.push(writeRel(repoRoot, verifyRel, bouncerDoc('bouncer.verification', `${taskId} verification`, `Verification for ${taskId}`, verifyRel, ['bouncer', 'verification'], timestamp, { id: ids.verification, epic_id: epicId, blueprint_id: blueprintId, status: 'pending' }), body(verifyBase)));
    created.push(writeRel(repoRoot, reviewRel, bouncerDoc('bouncer.review', `${taskId} review`, `Review for ${taskId}`, reviewRel, ['bouncer', 'review'], timestamp, {
        id: ids.review, epic_id: epicId, blueprint_id: blueprintId, status: 'pending',
        review: { required: true },
    }), body(reviewBase)));
    return created;
}
function scaffoldBlueprint({ repoRoot, epicDir, blueprintId, name, timestamp, scale }) {
    if (!isCanonicalEpicDir(epicDir)) {
        throw new Error(`epicDir must be under ${CONTEXT_ROOT}/epics`);
    }
    requireNumericId(blueprintId, 'blueprintId');
    // 알 수 없는 scale은 첫 파일을 쓰기 전에 거절한다 — 반쯤 만들어진
    // blueprint 디렉터리를 남기지 않기 위함.
    const bpScale = requireScale(scale);
    const isLight = bpScale === 'light';
    const canonicalEpicDir = normalizeRepoPath(epicDir);
    const epicId = epicIdFromDir(canonicalEpicDir);
    const dir = `${canonicalEpicDir}/blueprints/${blueprintId}-${name}`;
    const created = [];
    const body = (templateName) => templateBody(templateNameFor(templateName, bpScale), { epicId, blueprintId, name });
    const idx = `${dir}/index.md`;
    // commit_type·scale은 blueprint 전용(epic/tasks 등에는 쓰지 않음).
    // supersedes는 epic·blueprint 공용 — 빈 배열로 자리만 잡고 값은 사람이 채운다.
    // status 뒤에 두어 frontmatter 키 순서를 고정한다. 경량 선언은 plan이
    // scale을 light로 바꾸고, 되돌릴 때는 full로 되돌린다(키 삭제 아님).
    created.push(writeRel(repoRoot, idx, bouncerDoc('bouncer.blueprint', `${blueprintId} ${name}`, `Blueprint ${blueprintId}`, idx, ['bouncer', 'blueprint'], timestamp, {
        id: blueprintId,
        epic_id: epicId,
        blueprint_id: blueprintId,
        status: 'draft',
        commit_type: DEFAULT_COMMIT_TYPE,
        scale: bpScale,
        supersedes: [],
    }), body('blueprint.md')));
    // index.md 다음, task 묶음보다 앞. explain은 finalize 시점이라 여기 넣지 않는다.
    // light는 context-review 문서 자체를 만들지 않는다 — plan gate G18도
    // light에서는 적용되지 않으므로 판정 대상이 없다(rules/governance.md).
    if (!isLight) {
        created.push(...scaffoldContextReview({
            repoRoot, blueprintDir: dir, timestamp,
        }));
    }
    // 새 blueprint 는 tasks/001/ 묶음부터 시작한다. 루트 tasks-001.md 는 더 이상 만들지 않는다.
    // (기존 문서 인식은 listTasksDocs 가 유지 — 거절은 004.)
    const taskCreated = scaffoldTask({
        repoRoot, blueprintDir: dir, taskId: '001', timestamp, scale: bpScale,
    });
    created.push(...taskCreated);
    // BP explain.md는 plan scaffold가 아니라 finalize 시점(scaffoldExplain)에 생성한다.
    return created;
}
/**
 * 기존 blueprint에 context-review.md를 붙인다.
 * 거절은 쓰기 전에 끝낸다 — 정본 디렉터리 → closed → 이미 존재.
 * scaffoldExplain은 finalize가 반복 호출하므로 이미 있으면 조용히 []를 돌리지만,
 * 이 명령은 plan이 직접 부르므로 덮어쓰기가 사람 손에 닿는다. 존재하면 throw.
 */
function scaffoldContextReview({ repoRoot, blueprintDir, timestamp }) {
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        throw new Error(`blueprintDir must be under ${CONTEXT_ROOT}/epics`);
    }
    const bp = normalizeRepoPath(blueprintDir);
    const { epicId, blueprintId } = parsePathIds(bp);
    if (!epicId || !blueprintId) {
        throw new Error(`cannot derive epic/blueprint ids from ${bp}`);
    }
    // finalize가 잠근 blueprint는 다시 열지 않는다. scaffoldTask와 같은 이유 —
    // 마감된 계획에 판정 문서를 붙이지 않고 새 blueprint를 연다.
    if (isClosedBlueprint(repoRoot, bp)) {
        throw new Error('blueprint is closed (finalized): '
            + `${bp} — scaffold a new blueprint instead of adding a context-review to this one`);
    }
    const rel = `${bp}/context-review.md`;
    if (fs.existsSync(path.join(repoRoot, rel))) {
        throw new Error(`context-review.md already exists: ${rel}`);
    }
    return [writeRel(repoRoot, rel, bouncerDoc('bouncer.context_review', `${blueprintId} context review`, `Context review for ${blueprintId}`, rel, ['bouncer', 'context_review'], timestamp, {
            id: `CTXREVIEW-${blueprintId}`,
            epic_id: epicId,
            blueprint_id: blueprintId,
            status: 'pending',
            context_review: { findings: [] },
        }), templateBody('context-review.md', { epicId, blueprintId, name: blueprintId }))];
}
/** BP explain.md가 없으면 생성한다. plan scaffold가 아니라 /bouncer-finalize에서 사용. */
function scaffoldExplain({ repoRoot, blueprintDir, timestamp }) {
    if (!isCanonicalBlueprintDir(blueprintDir)) {
        throw new Error(`blueprintDir must be under ${CONTEXT_ROOT}/epics`);
    }
    const bp = normalizeRepoPath(blueprintDir);
    const explain = `${bp}/explain.md`;
    if (fs.existsSync(path.join(repoRoot, explain)))
        return [];
    const { epicId, blueprintId } = parsePathIds(bp);
    if (!epicId || !blueprintId) {
        throw new Error(`cannot derive epic/blueprint ids from ${bp}`);
    }
    // split은 문자열에서 항상 한 칸 이상이라 pop()이 런타임에 비지 않는다.
    // 타입만 undefined를 허용하므로 마지막 칸을 직접 집어 동작을 유지한다.
    const segments = bp.split('/');
    const leaf = segments[segments.length - 1];
    const slug = leaf.replace(new RegExp(`^${blueprintId}-`), '') || 'blueprint';
    // 빈 배열: G15는 대상 task 엔트리가 없으면 hash 불일치가 아니라 "기록 없음".
    // 구 단일 객체 기본값은 형식 거절로 바뀌므로 더 이상 쓰지 않는다.
    return [writeRel(repoRoot, explain, bouncerDoc('bouncer.explain', `${blueprintId} explain`, `Explain for ${blueprintId}`, explain, ['bouncer', 'explain'], timestamp, {
            id: `EXPLAIN-${blueprintId}`,
            epic_id: epicId,
            blueprint_id: blueprintId,
            status: 'draft',
            comprehension: [],
        }), templateBody('explain.md', { epicId, blueprintId, name: slug }))];
}
module.exports = {
    CONTEXT_ROOT, scaffoldEpic, scaffoldBlueprint, scaffoldTask, scaffoldExplain,
    scaffoldContextReview,
};
