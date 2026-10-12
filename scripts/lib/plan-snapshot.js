'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
const frontmatter = require("./frontmatter");
const { readDoc } = frontmatter;
const paths = require("./paths");
const { toPosix, epicDirOf } = paths;
const validateSections = require("./validate-sections");
const { parseTasksSections } = validateSections;
const schema = require("./schema");
const { executionKindOf, DEFAULT_DEPENDS_ON, DEFAULT_PARALLEL_SAFE, DEFAULT_DEPENDENCY_GATE, DEFAULT_EXCLUSIVE_RESOURCES, } = schema;
// snapshot 형식 버전. digest 입력이 본문 단독에서 경로·본문·판단 구조로 바뀌었으므로
// 옛 payload와는 digest가 호환되지 않는다 — payload가 이 값을 실어 읽는 쪽이 구분한다.
const SNAPSHOT_VERSION = 2;
/**
 * epic·blueprint·tasks.md 상대 경로를 집계 digest와 같은 순서로 모은다.
 * 문서 집합이 갈라지면 G18과 follow_up 판정이 서로 다른 대상을 본다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - blueprint 상대 경로(POSIX)
 * @returns {string[]} hash·parts에 넣을 저장소 상대 경로 목록
 */
function planDocumentRels(repoRoot, blueprintDir) {
    const bp = toPosix(blueprintDir);
    const documents = [
        `${epicDirOf(bp)}/index.md`,
        `${bp}/index.md`,
    ];
    const listing = listTasksDocs({ repoRoot, blueprintDir: bp });
    for (const entry of listing.entries) {
        documents.push(entry.tasks.rel);
    }
    return documents;
}
/**
 * 문서 경로가 판단 구조의 어느 종류인지 정한다. documents[0]은 epic, [1]은
 * blueprint index, 나머지는 tasks.md라는 문서 순서 계약과 같은 기준이다.
 *
 * @param {string} rel - 저장소 상대 문서 경로
 * @param {string} bp - blueprint 상대 경로(POSIX)
 * @returns {StructureKind} 구조 종류
 */
function structureKindOf(rel, bp) {
    if (rel === `${epicDirOf(bp)}/index.md`)
        return 'epic';
    if (rel === `${bp}/index.md`)
        return 'blueprint';
    return 'task';
}
// 문자열 배열만 남겨 정렬한다. 중복은 지우지 않는다: DAG 중복 판정은 draft gate
// 몫이고, 여기서 지우면 중복 추가가 같은 구조로 보여 gate 입력과 어긋난다.
function sortedStrings(value) {
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string').sort() : [];
}
/**
 * frontmatter `bouncer` 객체에서 실행 판단 구조만 뽑아 schema 기본값으로 정규화한다.
 * 이미 정규화한 구조를 다시 넣어도 같은 결과(멱등)여야 한다 — 이전 payload의
 * structure를 재검증할 때 같은 함수를 쓰기 때문이다. status/title/timestamp 같은
 * 승인·진행 필드는 의도적으로 제외한다(전이만으로 digest가 바뀌면 안 됨).
 *
 * @param {StructureKind} kind - epic | blueprint | task
 * @param {unknown} bouncer - 문서 frontmatter의 bouncer 객체(없거나 잘못되면 기본값으로 읽음)
 * @returns {PlanStructure} 키 순서가 고정된 정규화 구조(epic은 빈 객체)
 */
function normalizeStructure(kind, bouncer) {
    const b = (bouncer !== null && typeof bouncer === 'object' && !Array.isArray(bouncer)
        ? bouncer : {});
    if (kind === 'epic')
        return {};
    if (kind === 'blueprint') {
        return {
            scale: b.scale === 'light' ? 'light' : 'full',
            review_scope: b.review_scope === 'blueprint' ? 'blueprint' : null,
        };
    }
    return {
        affected_paths: sortedStrings(b.affected_paths),
        depends_on: b.depends_on === undefined ? [...DEFAULT_DEPENDS_ON] : sortedStrings(b.depends_on),
        parallel_safe: b.parallel_safe === undefined ? DEFAULT_PARALLEL_SAFE : b.parallel_safe === true,
        dependency_gate: typeof b.dependency_gate === 'string' ? b.dependency_gate : DEFAULT_DEPENDENCY_GATE,
        exclusive_resources: b.exclusive_resources === undefined
            ? [...DEFAULT_EXCLUSIVE_RESOURCES] : sortedStrings(b.exclusive_resources),
        // 잘못된 enum(null)은 draft gate가 거절한다. 여기서는 commit으로 읽어 digest 계산만 이어 간다.
        execution_kind: executionKindOf(b) ?? 'commit',
    };
}
/**
 * 본문 문자열의 sha256 hex.
 *
 * @param {string} body - 문서 본문(공백까지 byte 그대로)
 * @returns {string} hex digest
 */
function hashBody(body) {
    return createHash('sha256').update(body).digest('hex');
}
/**
 * 정규화 구조의 sha256 hex. 정규화가 키 순서를 고정하므로 JSON 직렬화가 결정적이다.
 *
 * @param {PlanStructure} structure - normalizeStructure 결과
 * @returns {string} hex digest
 */
function hashStructure(structure) {
    return createHash('sha256').update(JSON.stringify(structure)).digest('hex');
}
/**
 * 문서 경로·본문·구조를 ordered 배열로 직렬화해 집계 digest를 만든다.
 * 문자열을 단순히 이어 붙이면 문서 경계가 사라져 한 문서의 끝이 다음 문서의
 * 앞으로 옮겨가도 같은 digest가 나오므로, 문서마다 {file,body,structure} 객체로 감싼다.
 * dispatcher 생성과 payload 검증이 같은 함수를 써야 두 경로의 digest가 갈라지지 않는다.
 *
 * @param {string[]} documents - 문서 순서(epic, blueprint, tasks 번호 순)
 * @param {Record<string, PlanDocContent>} content - 경로별 본문과 구조
 * @returns {string} hex digest
 */
function digestPlanContent(documents, content) {
    const ordered = documents.map((file) => ({
        file, body: content[file].body, structure: content[file].structure,
    }));
    return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}
/**
 * plan 문서를 한 번 읽어 경로별 본문·정규화 구조와 관찰용 scope_parts를 만든다.
 * digest·parts·structure_parts가 모두 이 한 번의 읽기에서 나와야 읽기 사이에
 * 파일이 바뀌어도 서로 다른 내용을 가리키지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트 절대 경로
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {PlanContent} 성공 시 문서 순서·내용·scope_parts, 부재·파싱 실패 시 ok:false와 사유
 */
function readPlanContent(repoRoot, blueprintDir) {
    const bp = toPosix(blueprintDir);
    const documents = planDocumentRels(repoRoot, bp);
    const content = {};
    const scope_parts = {};
    for (const rel of documents) {
        const abs = path.join(repoRoot, rel);
        if (!fs.existsSync(abs)) {
            return { ok: false, error: `snapshot document missing: ${rel}` };
        }
        let body;
        let data;
        try {
            const doc = readDoc(abs);
            body = doc.body;
            data = doc.data;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { ok: false, error: `snapshot document unreadable: ${rel}: ${message}` };
        }
        const bouncer = data?.bouncer;
        const kind = structureKindOf(rel, bp);
        content[rel] = { body, structure: normalizeStructure(kind, bouncer) };
        // epic·blueprint index는 Interface/Touch가 없다. tasks.md만 관찰용 scope_parts에 넣는다.
        if (kind !== 'task')
            continue;
        const sections = parseTasksSections(body);
        const interfaceBody = typeof sections.interface === 'string' ? sections.interface : '';
        const touchBody = typeof sections.touch === 'string' ? sections.touch : '';
        const structure = content[rel].structure;
        // 계약 문자열: 정렬 JSON + Interface 본문 + Touch 본문. v1 payload와 같은 공개 관찰
        // 값이라 순서·구분자를 유지한다. v2에서는 full 판정에 쓰지 않고 보관만 한다.
        const scopeMaterial = [
            JSON.stringify(structure.affected_paths),
            JSON.stringify(structure.depends_on),
            interfaceBody,
            touchBody,
        ].join('\n');
        scope_parts[rel] = createHash('sha256').update(scopeMaterial).digest('hex');
    }
    return { ok: true, documents, content, scope_parts };
}
/**
 * epic·blueprint·tasks.md의 경로·본문·판단 구조로 v2 집계 digest를 만든다.
 * context-review frozen snapshot과 같은 문서 집합·순서를 유지한다.
 * frontmatter 중 status/title/timestamp와 commit evidence는 hash에 넣지 않는다 —
 * status flip만으로 digest가 바뀌면 승인 직후 snapshot이 곧바로 stale 판정을 받는다.
 * 반대로 affected_paths 등 실행 구조는 digest에 들어가므로 범위 변경은 stale이 된다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ ok: true, digest: string, documents: string[] } | { ok: false, error: string }}
 *   성공 시 hex digest와 hash에 넣은 문서 상대 경로 목록, 문서 부재·파싱 실패 시 ok:false와 사유
 */
function computePlanSnapshot({ repoRoot, blueprintDir }) {
    const read = readPlanContent(repoRoot, blueprintDir);
    if (!read.ok)
        return read;
    return { ok: true, digest: digestPlanContent(read.documents, read.content), documents: read.documents };
}
/**
 * 문서별 본문 digest(`parts`)·구조 digest(`structure_parts`)·관찰용 `scope_parts`와
 * 이전/이후 비교에 쓰는 `documents_content`를 만든다. 문서마다 별도 sha256을 내어
 * follow_up이 어느 문서가 어떻게 바뀌었는지 가리킬 수 있게 한다.
 *
 * @param {{ repoRoot: string, blueprintDir: string }} opts - 저장소 루트와 blueprint 상대 경로
 * @returns {{ ok: true, parts: Record<string, string>, scope_parts: Record<string, string>,
 *   structure_parts: Record<string, string>, documents_content: Record<string, PlanDocContent> }
 *   | { ok: false, error: string }}
 *   성공 시 경로→값 맵들, 문서 부재·파싱 실패 시 ok:false와 사유
 */
function computePlanParts({ repoRoot, blueprintDir }) {
    const read = readPlanContent(repoRoot, blueprintDir);
    if (!read.ok)
        return read;
    const parts = {};
    const structure_parts = {};
    for (const rel of read.documents) {
        parts[rel] = hashBody(read.content[rel].body);
        structure_parts[rel] = hashStructure(read.content[rel].structure);
    }
    return {
        ok: true, parts, scope_parts: read.scope_parts, structure_parts, documents_content: read.content,
    };
}
module.exports = {
    SNAPSHOT_VERSION,
    computePlanSnapshot,
    computePlanParts,
    digestPlanContent,
    normalizeStructure,
    structureKindOf,
    hashBody,
    hashStructure,
};
