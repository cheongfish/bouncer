'use strict';
const path = require('node:path');
const schema = require("./schema");
const { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat, KIND_TO_TYPE, SCALE_ENUM, isValidSupersedes, DEPENDENCY_GATE_ENUM, isValidDependsOn, executionKindOf, } = schema;
const paths = require("./paths");
const { parsePathIds, toPosix, isNumericContextId, } = paths;
const verification = require("./verification");
const { isValidVerifyCommand } = verification;
const tasksDocs = require("./tasks-docs");
const { expectedTasksId, expectedTaskDocIds, TASK_UNIT_BASENAMES, unitDocKind, } = tasksDocs;
const config = require("./config");
const { DEFAULT_VERIFY_ALLOWLIST } = config;
// review-dispatch Execute 경로와 같은 허용 목록. 여기 S30과 분류기 거절이
// 어긋나면 malformed 위험이 한쪽에만 통과한다.
const REVIEW_RISK_ENUM = [
    'public_interface',
    'authentication',
    'authorization',
    'credential',
];
/**
 * 경로가 요구하는 bouncer type. 위치 규칙이 없으면 null — S19를 내지 않는다.
 * task 묶음 basename은 TASK_UNIT_BASENAMES만 순회하고 문자열을 여기 두지 않는다.
 */
function expectedTypeForPath(rel) {
    const norm = toPosix(rel);
    const parsed = parsePathIds(norm);
    const base = path.posix.basename(norm);
    // epic/blueprint index는 basename이 같아 blueprintId 유무로만 가른다.
    if (base === 'index.md') {
        if (parsed.blueprintId)
            return KIND_TO_TYPE.blueprint;
        if (parsed.epicId)
            return KIND_TO_TYPE.epic;
        return null;
    }
    // 루트 tasks.md·알 수 없는 basename은 규칙 밖. 번호 묶음만 대조한다.
    const unitM = /\/tasks\/(\d{3})\//.exec(norm);
    if (unitM) {
        for (const name of TASK_UNIT_BASENAMES) {
            if (base === name) {
                const kind = unitDocKind(name);
                return kind ? KIND_TO_TYPE[kind] : null;
            }
        }
        return null;
    }
    // explain.md / context-review.md는 FILE_KIND(paths) → parsePathIds.kind.
    // blueprint 아래만 기대. 게이트 판정은 여기 두지 않는다(S19 매핑만).
    if (parsed.blueprintId && parsed.kind === 'explain') {
        return KIND_TO_TYPE.explain;
    }
    if (parsed.blueprintId && parsed.kind === 'context_review') {
        return KIND_TO_TYPE.context_review;
    }
    return null;
}
/**
 * 문서 하나(프론트매터)의 구조 코드를 기록한다. S12는 호출자가 넘긴
 * 프로젝트 allowlist로 `tasks.bouncer.verify`를 검사한다. 목록을 생략하면
 * 기본 목록을 쓰는데, 직접 호출 테스트와 정책 부재 폴백을 맞추기 위함이다.
 * 파손된 config의 기본 목록 폴백은 `validateBlueprint`가 막는다.
 *
 * @param {unknown} doc - `{ data, rel }` 문서
 * @param {FailureEntry[]} failures - 실패를 누적할 배열
 * @param {readonly string[]} [verifyAllowlist] - S12 argv0 허용 목록
 * @returns {void}
 */
function checkStructural(doc, failures, verifyAllowlist = DEFAULT_VERIFY_ALLOWLIST) {
    const { data, rel } = doc;
    const add = (code, message) => failures.push({ code, message, file: rel });
    const rec = data;
    const legacy = detectLegacyFormat({ data });
    if (legacy.legacy) {
        add('S2', legacy.reason);
        return;
    }
    for (const f of OKF_REQUIRED) {
        const v = rec[f];
        if (v === undefined || v === null || v === '')
            add('S1', `OKF field missing: ${f}`);
    }
    if (!TYPES.includes(rec.type)) {
        add('S2', `unknown type: ${rec.type}`);
        return; // type에 의존하는 검사는 진행할 수 없음
    }
    const docType = rec.type;
    // S19: 알려진 type만 위치와 대조. 기대값이 null이면 위치 규칙이 없는 경로.
    const expectedType = expectedTypeForPath(rel);
    if (expectedType && rec.type !== expectedType) {
        add('S19', `type ${rec.type} does not match expected ${expectedType} for path`);
    }
    if (rec.resource !== rel) {
        add('S3', `resource path mismatch: ${rec.resource} != ${rel}`);
    }
    const bouncer = (rec.bouncer || {});
    const prefix = Object.prototype.hasOwnProperty.call(ID_PREFIX, docType)
        ? ID_PREFIX[docType]
        : undefined;
    // migration 이후에는 검증기가 구형 접두를 보정하지 않는다. 정본 형태가 아니면
    // S4/S5에서 그대로 거절해 일부만 migrate된 저장소가 통과하지 못하게 한다.
    const id = bouncer.id;
    if (docType === 'bouncer.epic' || docType === 'bouncer.blueprint') {
        if (!isNumericContextId(id)) {
            add('S4', `id "${bouncer.id}" must be a zero-padded three-digit id`);
        }
    }
    else if (typeof prefix !== 'string'
        || typeof id !== 'string'
        || !id.startsWith(prefix)
        || !isNumericContextId(id.slice(prefix.length))) {
        add('S4', `id "${bouncer.id}" missing prefix ${prefix} or invalid digits`);
    }
    const parsed = parsePathIds(rel);
    if (parsed.epicId && bouncer.epic_id !== parsed.epicId) {
        add('S5', `epic_id ${bouncer.epic_id} != path ${parsed.epicId}`);
    }
    if (docType !== 'bouncer.epic'
        && parsed.blueprintId
        && bouncer.blueprint_id !== parsed.blueprintId) {
        add('S5', `blueprint_id ${bouncer.blueprint_id} != path ${parsed.blueprintId}`);
    }
    let expectedId = null;
    // tasks/<NNN>/… 새 레이아웃은 디렉터리 번호가 id 숫자. basename만 보면
    // 전부 tasks.md → TASKS-{blueprintId}로 잘못 접혀 002가 S5에 걸린다.
    const dirDigitsMatch = /\/tasks\/(\d{3})\//.exec(toPosix(rel));
    if (dirDigitsMatch) {
        const ids = expectedTaskDocIds(dirDigitsMatch[1]);
        if (docType === 'bouncer.tasks')
            expectedId = ids.tasks;
        else if (docType === 'bouncer.verification')
            expectedId = ids.verification;
        else if (docType === 'bouncer.review')
            expectedId = ids.review;
    }
    else if (docType === 'bouncer.epic')
        expectedId = parsed.epicId;
    else if (docType === 'bouncer.blueprint')
        expectedId = parsed.blueprintId;
    else if (docType === 'bouncer.tasks') {
        // task id는 파일 이름에서 유도 — 레거시는 blueprint id, 번호 문서는 NNN.
        expectedId = expectedTasksId(path.posix.basename(rel), parsed.blueprintId);
    }
    else if (parsed.blueprintId)
        expectedId = `${prefix}${parsed.blueprintId}`;
    if (expectedId && bouncer.id !== expectedId) {
        add('S5', `id ${bouncer.id} != expected ${expectedId} from path`);
    }
    if (!(Object.prototype.hasOwnProperty.call(STATUS_ENUM, docType)
        ? STATUS_ENUM[docType]
        : []).includes(bouncer.status)) {
        add('S6', `status "${bouncer.status}" not in enum for ${docType}`);
    }
    // S20: blueprint만. 부재는 0.7 문서 통과용으로 허용; 잘못된 값만 거절.
    if (docType === 'bouncer.blueprint'
        && bouncer.scale !== undefined
        && !SCALE_ENUM.includes(bouncer.scale)) {
        add('S20', `scale "${bouncer.scale}" not in enum for ${docType}`);
    }
    // S27: epic·blueprint만. 부재는 통과(소급 없음). 형식만 schema.isValidSupersedes —
    // 경로 존재·자기참조·순환·중복은 검사하지 않는다.
    if ((docType === 'bouncer.epic' || docType === 'bouncer.blueprint')
        && !isValidSupersedes(bouncer.supersedes)) {
        add('S27', 'supersedes must be an array of non-empty document paths');
    }
    if (docType === 'bouncer.tasks') {
        const ap = bouncer.affected_paths;
        const executionKind = executionKindOf(bouncer);
        if (executionKind !== 'verification' && (!Array.isArray(ap) || ap.length === 0)) {
            add('S7', 'tasks.affected_paths missing or empty');
        }
        // 선택 필드: 없으면 기존 tasks.md가 모두 유효하게 유지됨. S12와
        // VERIFY_COMMAND_INVALID가 같은 allowlist를 써야 두 경로가 어긋나지 않는다.
        if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify, verifyAllowlist)) {
            add('S12', 'tasks.verify must be a single executable command');
        }
        // S28: DAG 필드 shape·enum만. 부재는 빈 depends_on / false / integrated로
        // 읽히므로 통과. 참조 무결성·cycle은 G19.
        if (!isValidDependsOn(bouncer.depends_on)) {
            add('S28', 'depends_on must be an array of TASKS-NNN ids');
        }
        if (bouncer.parallel_safe !== undefined && typeof bouncer.parallel_safe !== 'boolean') {
            add('S28', 'parallel_safe must be a boolean');
        }
        if (bouncer.dependency_gate !== undefined
            && !DEPENDENCY_GATE_ENUM.includes(bouncer.dependency_gate)) {
            add('S28', `dependency_gate "${bouncer.dependency_gate}" not in enum`);
        }
        // verification node는 구현 범위를 갖지 않고 선행 fan-in 뒤 단일 argv만
        // 실행한다. 이 불변조건을 한 코드로 묶어 부분 선언이 commit task처럼
        // 흘러가는 것을 막는다. graph의 존재·terminal 관계는 plan G20의 몫이다.
        if (executionKind === null) {
            add('S29', 'execution_kind must be commit or verification');
        }
        else if (executionKind === 'verification') {
            if (!Array.isArray(ap) || ap.length !== 0) {
                add('S29', 'verification task affected_paths must be empty');
            }
            if (!Array.isArray(bouncer.depends_on) || bouncer.depends_on.length === 0) {
                add('S29', 'verification task depends_on must be non-empty');
            }
            if (bouncer.parallel_safe !== false) {
                add('S29', 'verification task parallel_safe must be false');
            }
            if (bouncer.dependency_gate !== 'integrated') {
                add('S29', 'verification task dependency_gate must be integrated');
            }
            if (!isValidVerifyCommand(bouncer.verify, verifyAllowlist)) {
                add('S29', 'verification task verify must be a single executable command');
            }
        }
        else if (bouncer.status === 'verifying' || bouncer.status === 'integrated') {
            add('S29', `commit task cannot use verification status ${bouncer.status}`);
        }
        // S30: review_risk는 승인 enum의 중복 없는 배열만 받는다. 부재는 legacy []
        // 로 읽히므로 통과 — 새 문서의 malformed 값만 dispatch 전에 막는다.
        if (bouncer.review_risk !== undefined) {
            if (!Array.isArray(bouncer.review_risk)) {
                add('S30', 'review_risk must be an array');
            }
            else {
                const seen = new Set();
                for (const entry of bouncer.review_risk) {
                    if (typeof entry !== 'string' || !REVIEW_RISK_ENUM.includes(entry)) {
                        add('S30', `review_risk value invalid: ${String(entry)}`);
                        continue;
                    }
                    if (seen.has(entry)) {
                        add('S30', `review_risk duplicate: ${entry}`);
                        continue;
                    }
                    seen.add(entry);
                }
            }
        }
    }
}
module.exports = {
    expectedTypeForPath,
    checkStructural,
};
