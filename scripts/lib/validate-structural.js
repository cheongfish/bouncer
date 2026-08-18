'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { OKF_REQUIRED, TYPES, ID_PREFIX, STATUS_ENUM, detectLegacyFormat, KIND_TO_TYPE, SCALE_ENUM, } = require('./schema');
const { parsePathIds, toPosix, isNumericContextId, } = require('./paths');
const { isValidVerifyCommand } = require('./verification');
const { expectedTasksId, expectedTaskDocIds, TASK_UNIT_BASENAMES, unitDocKind, } = require('./tasks-docs');
const { parseFrontmatter } = require('./frontmatter');
const { PROJECT_DISTILL, DISTILL_ROOT } = require('./layout');
const { DEFAULT_DISTILL_CONFIG, getDistillConfig, readConfig, } = require('./config');
// graph.basis는 레거시 문자열과 그래프별 엔트리 배열을 모두 받는다.
// S9(구조)와 G4(plan)가 같은 헬퍼를 써야 두 경로가 다른 답을 내지 않는다.
const GRAPH_BASIS_STATUS = ['updated', 'reused', 'fail-skip', 'skip-disabled', 'missing'];
const GRAPH_BASIS_GRAPH = ['source', 'context'];
function isValidGraphBasis(basis) {
    if (typeof basis === 'string')
        return basis.trim().length > 0;
    if (!Array.isArray(basis) || basis.length === 0)
        return false;
    for (const entry of basis) {
        if (entry == null || typeof entry !== 'object' || Array.isArray(entry))
            return false;
        const rec = entry;
        if (!GRAPH_BASIS_GRAPH.includes(rec.graph))
            return false;
        if (!GRAPH_BASIS_STATUS.includes(rec.status))
            return false;
        if (typeof rec.query !== 'string' || !rec.query.trim())
            return false;
        if (typeof rec.result !== 'string' || !rec.result.trim())
            return false;
    }
    return true;
}
/**
 * tasks의 범위 근거를 새 정본과 구형 graph 형식에서 한 번만 읽는다. 새 문서는
 * scope_evidence만 쓰게 하지만, 이미 승인된 graph 문서를 여기서 같은 내부 모양으로
 * 바꿔야 S9와 G4가 migration 시점에 따라 다른 결론을 내리지 않는다. 이 함수는
 * affected_paths를 절대 만지지 않는다. suggested_paths는 graphify의 제안 근거이고,
 * 사람이 확정한 task 범위를 자동 교체하면 계획 승인 경계가 사라지기 때문이다.
 */
function normalizeScopeEvidence(bouncer) {
    if (!isRecord(bouncer))
        return { evidence: null, error: 'scope evidence missing' };
    const hasScopeEvidence = bouncer.scope_evidence !== undefined;
    const hasLegacyGraph = bouncer.graph !== undefined;
    if (hasScopeEvidence && hasLegacyGraph) {
        return { evidence: null, error: 'tasks must not contain both scope_evidence and graph' };
    }
    if (!hasScopeEvidence && !hasLegacyGraph)
        return { evidence: null, error: null };
    const source = hasScopeEvidence ? bouncer.scope_evidence : bouncer.graph;
    if (!isRecord(source))
        return { evidence: null, error: 'scope evidence must be an object' };
    // graph는 과거 write form이라 producer/generated_at을 강제하지 않았다. 그 문서는
    // 계속 읽되, 새 scope_evidence에는 graphify producer와 생성 시각을 명시적으로
    // 요구해 앞으로 만들어지는 근거의 출처·시점을 잃지 않게 한다.
    const evidence = {
        producer: hasScopeEvidence ? source.producer : 'graphify',
        generated_at: hasScopeEvidence ? source.generated_at : 'legacy graph',
        suggested_paths: source.suggested_paths,
        basis: source.basis,
    };
    if (evidence.producer !== 'graphify') {
        return { evidence: null, error: 'scope_evidence.producer must be graphify' };
    }
    if (typeof evidence.generated_at !== 'string' || !evidence.generated_at.trim()) {
        return { evidence: null, error: 'scope_evidence.generated_at missing or empty' };
    }
    if (!Array.isArray(evidence.suggested_paths)) {
        return { evidence: null, error: 'scope evidence suggested_paths missing' };
    }
    if (!isValidGraphBasis(evidence.basis)) {
        return { evidence: null, error: 'scope evidence basis missing or empty' };
    }
    return { evidence, error: null };
}
const DISTILL_VERSION = 1;
function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function distillMetadata(data) {
    if (!isRecord(data))
        return {};
    if (isRecord(data.distill))
        return data.distill;
    if (isRecord(data.shard))
        return data.shard;
    return data;
}
function distillDeclarations(meta) {
    if (Array.isArray(meta.shards)) {
        return meta.shards.map((entry) => {
            if (typeof entry === 'string')
                return { id: entry.trim() };
            if (!isRecord(entry))
                return null;
            const id = entry.id || entry.name || entry.shard;
            return { ...entry, id: typeof id === 'string' ? id.trim() : id };
        });
    }
    if (isRecord(meta.shards)) {
        return Object.entries(meta.shards).map(([id, entry]) => (isRecord(entry) ? { ...entry, id: entry.id || id } : { id }));
    }
    return null;
}
function normalizeDistillPath(value) {
    if (typeof value !== 'string')
        return null;
    const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
    if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized))
        return null;
    if (normalized.split('/').includes('..'))
        return null;
    return normalized;
}
function shardPath(id, declaration) {
    const candidate = declaration.file || declaration.path || declaration.resource;
    return normalizeDistillPath(candidate || `${DISTILL_ROOT}/${id}.md`);
}
function listDistillFiles(repoRoot) {
    const root = path.join(repoRoot, DISTILL_ROOT);
    try {
        return fs.readdirSync(root, { withFileTypes: true })
            .filter((entry) => (entry.isFile() && entry.name.endsWith('.md')))
            .map((entry) => `${DISTILL_ROOT}/${entry.name}`);
    }
    catch (_e) {
        return [];
    }
}
function readDistillShard(repoRoot, declaration) {
    const id = typeof declaration.id === 'string' ? declaration.id.trim() : '';
    if (!id || id.includes('/') || id.includes('\\'))
        return null;
    const rel = shardPath(id, declaration);
    if (!rel)
        return null;
    let raw;
    try {
        raw = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
    }
    catch (_e) {
        return null;
    }
    let fileMeta = {};
    try {
        fileMeta = distillMetadata(parseFrontmatter(raw).data);
    }
    catch (_e) {
        // distill.ts도 일반 Markdown shard를 허용한다. 선언에 충분한 메타데이터가
        // 있으면 frontmatter 부재만으로 기존 단일 파일 폴백을 오염시키지 않는다.
    }
    return {
        id,
        rel,
        raw,
        meta: { ...fileMeta, ...declaration },
    };
}
function routePatternCoversSource(patternValue, sourceValue) {
    const pattern = normalizeDistillPath(patternValue);
    const source = normalizeDistillPath(sourceValue);
    if (!pattern || !source)
        return false;
    if (pattern === '**' || pattern === source)
        return true;
    if (pattern === `${source}/**` || pattern === `${source}/*`)
        return true;
    return false;
}
function addDistillWarning(warnings, code, message, file) {
    warnings.push({ code, message, file });
}
/**
 * Project Distill 샤드의 안전성 진단. 문서 S 코드인 checkStructural과
 * 분리해 기존 S0~S20 호출 계약을 보존한다. 인덱스가 없거나 읽을 수 없으면
 * 샤드 모드가 아니므로 경고도 만들지 않는다 — 그 상태의 소비자는 기존
 * `.bouncer/Distill.md` 전문을 그대로 반환해야 한다.
 *
 * warnings는 routing_enabled와 무관하게 관찰용으로 반환한다. 활성화된
 * 저장소에서만 같은 항목을 failures로 승격해, 비활성 전환 중에는 경고를
 * 보여 주되 전량 소비를 계속하게 한다.
 */
function checkDistillStructural({ repoRoot, config } = {}) {
    const root = repoRoot || process.cwd();
    const warnings = [];
    const failures = [];
    let indexRaw;
    try {
        indexRaw = fs.readFileSync(path.join(root, PROJECT_DISTILL), 'utf8');
    }
    catch (_e) {
        return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
    }
    let indexMeta;
    try {
        indexMeta = distillMetadata(parseFrontmatter(indexRaw).data);
    }
    catch (_e) {
        return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
    }
    if (indexMeta.version !== DISTILL_VERSION) {
        return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
    }
    const declarations = distillDeclarations(indexMeta);
    if (!declarations || declarations.length === 0 || declarations.some((entry) => !entry)) {
        return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
    }
    const presentDeclarations = [];
    for (const entry of declarations) {
        if (!entry) {
            return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
        }
        presentDeclarations.push(entry);
    }
    const shards = presentDeclarations.map((entry) => readDistillShard(root, entry));
    // 읽을 수 없는 등록 shard는 distill.ts가 인덱스 요약만 반환하는 폴백
    // 조건이다. 여기서 별도 경고를 내면 같은 저장소를 소비하는 경로마다
    // "샤드 모드" 판정이 달라지므로 진단 대상에서도 제외한다.
    const loaded = [];
    for (const entry of shards) {
        if (!entry) {
            return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
        }
        loaded.push(entry);
    }
    if (new Set(loaded.map((entry) => entry.id)).size !== loaded.length) {
        return { ok: true, sharded: false, routingEnabled: false, warnings, failures };
    }
    const registered = new Set(loaded.map((entry) => entry.rel));
    for (const rel of listDistillFiles(root)) {
        if (!registered.has(rel)) {
            addDistillWarning(warnings, 'S21', `orphan Distill shard is not registered: ${rel}`, rel);
        }
    }
    const byId = new Map(loaded.map((entry) => [entry.id, entry]));
    const pullsById = new Map();
    for (const shard of loaded) {
        const meta = shard.meta;
        const paths = meta.paths;
        const pulls = meta.pulls;
        if (meta.always !== true && (!Array.isArray(paths) || paths.length === 0)) {
            addDistillWarning(warnings, 'S22', `non-always shard has no routing paths: ${shard.id}`, shard.rel);
        }
        if (!Array.isArray(pulls) || pulls.some((id) => typeof id !== 'string' || !id.trim())) {
            addDistillWarning(warnings, 'S23', `shard pulls are missing or invalid: ${shard.id}`, shard.rel);
            pullsById.set(shard.id, []);
        }
        else {
            const normalizedPulls = pulls.map((id) => id.trim());
            pullsById.set(shard.id, normalizedPulls);
            const missing = normalizedPulls.filter((id) => !byId.has(id));
            if (missing.length) {
                addDistillWarning(warnings, 'S23', `shard pulls reference missing shards: ${shard.id} -> ${missing.join(', ')}`, shard.rel);
            }
        }
        const threshold = getDistillConfig(config === undefined ? readConfig(root) : config).max_bytes;
        const maxBytes = Number.isSafeInteger(threshold) && threshold > 0
            ? threshold
            : DEFAULT_DISTILL_CONFIG.max_bytes;
        const bytes = Buffer.byteLength(shard.raw, 'utf8');
        if (bytes > maxBytes) {
            addDistillWarning(warnings, 'S26', `shard exceeds byte warning threshold: ${shard.id} (${bytes} > ${maxBytes})`, shard.rel);
        }
    }
    // DFS는 재귀 경로에 다시 들어온 지점만 보고한다. 정렬·중복 제거로 한
    // 순환을 한 번만 내보내야 동일한 cycle이 pulls 순서에 따라 여러 경고가
    // 되지 않는다.
    const visiting = new Set();
    const visited = new Set();
    const cycleKeys = new Set();
    const stack = [];
    function visit(id) {
        if (visiting.has(id)) {
            const start = stack.indexOf(id);
            const cycle = stack.slice(start).concat(id).sort();
            const key = cycle.join('>');
            if (!cycleKeys.has(key)) {
                cycleKeys.add(key);
                const shard = byId.get(id);
                if (shard) {
                    addDistillWarning(warnings, 'S24', `cyclic shard pulls: ${cycle.join(' -> ')}`, shard.rel);
                }
            }
            return;
        }
        if (visited.has(id))
            return;
        visiting.add(id);
        stack.push(id);
        for (const pull of pullsById.get(id) || [])
            if (byId.has(pull))
                visit(pull);
        stack.pop();
        visiting.delete(id);
        visited.add(id);
    }
    for (const shard of loaded)
        visit(shard.id);
    const loadedConfig = config === undefined ? readConfig(root) : config;
    getDistillConfig(loadedConfig);
    const sourceDirs = isRecord(loadedConfig) && Array.isArray(loadedConfig.source_dirs)
        ? loadedConfig.source_dirs
        : [];
    for (const sourceDir of sourceDirs) {
        const covered = loaded.some((shard) => {
            if (shard.meta.always === true)
                return true;
            return Array.isArray(shard.meta.paths)
                && shard.meta.paths.some((pattern) => routePatternCoversSource(pattern, sourceDir));
        });
        if (!covered) {
            addDistillWarning(warnings, 'S25', `source routing gap: no shard covers ${sourceDir}`, PROJECT_DISTILL);
        }
    }
    // 기본값을 합친 distillConfig만 보면 설정 없음과 명시적 false를 구별할 수
    // 없다. CLI와 같은 precedence를 유지하려면 raw config에 boolean이 선언된
    // 경우에는 false도 선택 신호로 존중하고, 그때만 index 메타데이터를 덮어쓴다.
    const configRoutingEnabled = isRecord(loadedConfig)
        && isRecord(loadedConfig.distill)
        && typeof loadedConfig.distill.routing_enabled === 'boolean'
        ? loadedConfig.distill.routing_enabled
        : null;
    const routingEnabled = configRoutingEnabled === null
        ? (indexMeta.routing_enabled === true || indexMeta.routingEnabled === true)
        : configRoutingEnabled;
    if (routingEnabled)
        failures.push(...warnings);
    return {
        ok: failures.length === 0,
        sharded: true,
        routingEnabled,
        warnings,
        failures,
    };
}
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
function checkStructural(doc, failures) {
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
    const prefix = ID_PREFIX[docType];
    // migration 이후에는 검증기가 구형 접두를 보정하지 않는다. 정본 형태가 아니면
    // S4/S5에서 그대로 거절해 일부만 migrate된 저장소가 통과하지 못하게 한다.
    const id = bouncer.id;
    if (docType === 'bouncer.epic' || docType === 'bouncer.blueprint') {
        if (!isNumericContextId(id)) {
            add('S4', `id "${bouncer.id}" must be a zero-padded three-digit id`);
        }
    }
    else if (typeof id !== 'string'
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
    if (!(STATUS_ENUM[docType] || []).includes(bouncer.status)) {
        add('S6', `status "${bouncer.status}" not in enum for ${docType}`);
    }
    // S20: blueprint만. 부재는 0.7 문서 통과용으로 허용; 잘못된 값만 거절.
    if (docType === 'bouncer.blueprint'
        && bouncer.scale !== undefined
        && !SCALE_ENUM.includes(bouncer.scale)) {
        add('S20', `scale "${bouncer.scale}" not in enum for ${docType}`);
    }
    if (docType === 'bouncer.tasks') {
        const ap = bouncer.affected_paths;
        if (!Array.isArray(ap) || ap.length === 0) {
            add('S7', 'tasks.affected_paths missing or empty');
        }
        const scopeEvidence = normalizeScopeEvidence(bouncer);
        if (scopeEvidence.error) {
            add('S9', scopeEvidence.error);
        }
        // 선택 필드: 없으면 기존 tasks.md가 모두 유효하게 유지됨. S12와
        // VERIFY_COMMAND_INVALID가 일치하도록 verification.isValidVerifyCommand를 재사용.
        if (bouncer.verify !== undefined && !isValidVerifyCommand(bouncer.verify)) {
            add('S12', 'tasks.verify must be a single executable command');
        }
    }
}
module.exports = {
    expectedTypeForPath,
    checkStructural,
    checkDistillStructural,
    GRAPH_BASIS_STATUS,
    GRAPH_BASIS_GRAPH,
    isValidGraphBasis,
    normalizeScopeEvidence,
};
