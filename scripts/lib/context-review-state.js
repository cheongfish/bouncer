'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const guards = require("./guards");
const { isRecord } = guards;
const frontmatter = require("./frontmatter");
const { readDoc, parseFrontmatter } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const planSnapshot = require("./plan-snapshot");
const { SNAPSHOT_VERSION, computePlanSnapshot, computePlanParts } = planSnapshot;
const scaffold = require("./scaffold");
const { scaffoldContextReview } = scaffold;
const paths = require("./paths");
const { toPosix } = paths;
const layout = require("./layout");
const { isCanonicalBlueprintDir } = layout;
const validateSections = require("./validate-sections");
const { REVIEW_SEVERITY, CONTEXT_REVIEW_STATUS, FINDING_ACTIONABILITY, REPORT_FINDING_STATUS: FINDING_STATUS, CONTEXT_ROUND_MODES: ROUND_MODES, CONTEXT_REPORT_STATUS: REPORT_STATUS, collectFindingFailures, normalizeFinding, normalizeRoundFindings, } = validateSections;
// 계획 리뷰 cycle의 단일 writer. 전체 재시작을 누적 1회로 제한하고, 재시작이
// 이전 finding을 지우지 못하게 archive로 보관한다. cycle을 닫는 전이(close, record --status accepted)만
// context-review.md에 투영을 기록하고 execute review.md는 쓰지 않는다. 기록 성공이 곧 plan gate(G18)
// 전체 통과는 아니다(다른 문서와 신선도는 게이트가 본다).
const RESTART_LIMIT = 1;
// cycle id는 newCycleId가 만드는 형식 하나뿐이다. 경로 구성요소로 쓰이므로 그 밖은 손상이다.
const CYCLE_ID_RE = /^cr-[0-9a-f]{16}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
function fail(reason, cause, next) {
    return { ok: false, reason, cause, next };
}
function sha256(data) {
    return createHash('sha256').update(data).digest('hex');
}
/** 쓰기 대상 경로에 symlink나 비정상 구성요소가 있을 때 던진다. 호출부가 Fail로 바꾼다. */
class UnsafePathError extends Error {
}
/**
 * root 아래 dir까지 구성요소를 lstat로 훑는다. symlink이거나 디렉터리가 아니면 거부하고,
 * create면 없는 구성요소를 만든다. realpath 검사는 namespace 루트에서 끝나므로 그 아래
 * (cycles/<id>/dispatch 등)의 symlink 바꿔치기는 여기서 막는다.
 *
 * @param {string} root - 이미 repo 안으로 확인된 namespace 절대 경로
 * @param {string} dir - root 아래 디렉터리 절대 경로
 * @param {boolean} create - true면 없는 구성요소를 만든다
 * @returns {boolean} 끝까지 존재하면 true, create가 false이고 중간에 없으면 false
 */
function walkSafeDir(root, dir, create) {
    const rel = path.relative(root, dir);
    if (rel.startsWith('..') || path.isAbsolute(rel))
        throw new UnsafePathError(`path escapes namespace: ${dir}`);
    let cur = root;
    for (const seg of rel === '' ? [] : rel.split(path.sep)) {
        cur = path.join(cur, seg);
        let st;
        try {
            st = fs.lstatSync(cur);
        }
        catch (error) {
            // ENOENT만 흡수: 아직 없는 구성요소다. create면 만들고 아니면 "없음"으로 돌려준다.
            if (!isRecord(error) || error.code !== 'ENOENT')
                throw error;
            if (!create)
                return false;
            fs.mkdirSync(cur);
            continue;
        }
        if (st.isSymbolicLink() || !st.isDirectory())
            throw new UnsafePathError(`not a plain directory (symlink?): ${cur}`);
    }
    return true;
}
/** abs가 있으면 symlink가 아닌 일반 파일인지 확인한다. 없으면 false. */
function isPlainFile(abs) {
    let st;
    try {
        st = fs.lstatSync(abs);
    }
    catch (error) {
        // ENOENT만 흡수: 아직 없는 파일이다.
        if (!isRecord(error) || error.code !== 'ENOENT')
            throw error;
        return false;
    }
    if (st.isSymbolicLink() || !st.isFile())
        throw new UnsafePathError(`refusing symlink or non-file target: ${abs}`);
    return true;
}
/**
 * 같은 디렉터리의 고유 임시 파일에 쓴 뒤 rename으로 교체한다. tmp는 'wx'로 열어
 * 미리 심어 둔 symlink·파일을 따라가지 않고 실패한다(닫힌 실패). 대상이 symlink여도
 * 거부한다. rename 전에 죽어도 기존 파일은 그대로이고, 우리가 만든 tmp만 지운다.
 *
 * @param {string} abs - 최종 파일 절대 경로
 * @param {string} text - 쓸 본문
 * @returns {void}
 */
function writeAtomic(abs, text) {
    const existed = isPlainFile(abs);
    const mode = existed ? fs.statSync(abs).mode & 0o777 : 0o644;
    const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`);
    // 열기 실패(EEXIST 등)는 우리가 만든 파일이 없으므로 정리 없이 그대로 올린다.
    const fd = fs.openSync(tmp, 'wx', mode);
    try {
        try {
            fs.writeFileSync(fd, text);
        }
        finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmp, abs);
    }
    catch (error) {
        try {
            fs.unlinkSync(tmp);
        }
        catch (unlinkError) {
            // ENOENT만 흡수: rename이 이미 옮겼다.
            if (!isRecord(unlinkError) || unlinkError.code !== 'ENOENT')
                throw unlinkError;
        }
        throw error;
    }
}
/**
 * 내용 주소(sha256) 파일명으로 immutable 자료를 쓴다. 상위 구성요소와 대상이 symlink이면
 * 거부하고, 이미 있는 파일은 같은 바이트일 때만 건너뛴다(다르면 변조·손상이다). 먼저 쓰고
 * state가 나중에 참조하므로, 이후 단계가 실패해도 남는 것은 참조되지 않는 파일뿐이다.
 *
 * @param {string} root - namespace 절대 경로(symlink 검사 시작점)
 * @param {string} abs - 저장 절대 경로
 * @param {string} text - 저장할 본문
 * @returns {void}
 */
function writeImmutable(root, abs, text) {
    walkSafeDir(root, path.dirname(abs), true);
    try {
        fs.writeFileSync(abs, text, { flag: 'wx' });
    }
    catch (error) {
        // EEXIST만 흡수: 파일명이 내용 해시라 같은 바이트면 건너뛴다. 다르면 아래에서 거부한다.
        if (!isRecord(error) || error.code !== 'EEXIST')
            throw error;
        isPlainFile(abs);
        if (fs.readFileSync(abs, 'utf8') !== text) {
            throw new UnsafePathError(`existing immutable file differs from new content: ${abs}`);
        }
    }
}
/** 쓰기 구간의 UnsafePathError만 target-invalid Fail로 바꾼다. 다른 오류는 올린다. */
function guardWrites(fn) {
    try {
        return fn();
    }
    catch (error) {
        if (!(error instanceof UnsafePathError))
            throw error;
        return targetInvalid(error.message, 'remove the symlink or altered file under .bouncer/runtime');
    }
}
/**
 * namespace 디렉터리를 repo 안에서만 해석한다. 구성요소마다 realpath를 보고
 * repo 밖을 가리키는 symlink를 만나면 아무것도 만들기 전에 null을 돌려준다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} relDir - repo 상대 POSIX 경로
 * @param {boolean} create - true면 없는 구성요소를 만든다
 * @returns {string | null} 절대 경로, repo 밖으로 나가면 null
 */
function resolveInsideRepo(repoRoot, relDir, create) {
    const realRoot = fs.realpathSync(path.resolve(repoRoot));
    let cur = path.resolve(repoRoot);
    for (const seg of relDir.split('/')) {
        cur = path.join(cur, seg);
        let real;
        try {
            real = fs.realpathSync(cur);
        }
        catch (error) {
            // ENOENT만 흡수: 아직 없는 구성요소다. 읽기 호출은 없는 상태로 두고,
            // 쓰기 호출만 만든다. 그 외(EACCES 등)는 위장하지 않고 올린다.
            if (!isRecord(error) || error.code !== 'ENOENT')
                throw error;
            if (!create)
                return path.join(path.resolve(repoRoot), relDir);
            fs.mkdirSync(cur);
            real = fs.realpathSync(cur);
        }
        if (real !== realRoot && !real.startsWith(realRoot + path.sep))
            return null;
    }
    return cur;
}
function targetInvalid(cause, next) {
    return fail('context-review-target-invalid', cause, next);
}
/**
 * dispatch 파일을 읽어 blueprint·현재 snapshot·문서 집합과 대조한다.
 * skip·light·closed·다른 blueprint·stale digest는 모두 거절한다 — 오래된 payload로
 * 기록하면 이후 G18 신선도와 어긋난 보고가 cycle에 쌓인다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 POSIX 경로
 * @param {string} dispatchFile - review-dispatch plan 출력 JSON 파일
 * @returns {Dispatch | Fail} 검증된 payload 정보 또는 거절
 */
function loadDispatch(repoRoot, bp, dispatchFile) {
    let bytes;
    try {
        bytes = fs.readFileSync(dispatchFile);
    }
    catch (error) {
        return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error), 'pass --dispatch <review-dispatch plan JSON file>');
    }
    let payload;
    try {
        payload = JSON.parse(bytes.toString('utf8'));
    }
    catch (error) {
        // SyntaxError만 흡수. 그 외 throw는 호출부 버그다.
        if (!(error instanceof SyntaxError))
            throw error;
        return fail('context-review-input-invalid', error.message, 'pass --dispatch <review-dispatch plan JSON file>');
    }
    const next = 'rerun review-dispatch plan --blueprint <dir> and pass its JSON';
    if (!isRecord(payload) || payload.ok !== true || payload.phase !== 'plan'
        || !isRecord(payload.target) || typeof payload.target.digest !== 'string'
        || !Array.isArray(payload.target.documents)) {
        return targetInvalid('dispatch is not a successful plan payload', next);
    }
    if (payload.strategy !== 'single' && payload.strategy !== 'clustered') {
        return targetInvalid(`strategy ${String(payload.strategy)} has no context review`, next);
    }
    if (payload.blueprint !== undefined && payload.blueprint !== bp) {
        return targetInvalid('dispatch belongs to another blueprint', next);
    }
    let indexData;
    try {
        indexData = readDoc(path.join(repoRoot, bp, 'index.md')).data;
    }
    catch (error) {
        // 문서 부재·파싱 실패는 같은 target-invalid로 묶되 원인 문구를 보존한다.
        return targetInvalid(error instanceof Error ? error.message : String(error), next);
    }
    const meta = isRecord(indexData) && isRecord(indexData.bouncer) ? indexData.bouncer : {};
    if (meta.status === 'closed')
        return targetInvalid('blueprint is closed', 'open a new blueprint');
    if (meta.scale === 'light')
        return targetInvalid('light blueprint skips context review', 'no review is needed');
    const snap = computePlanSnapshot({ repoRoot, blueprintDir: bp });
    if (!snap.ok)
        return targetInvalid(snap.error, next);
    if (snap.digest !== payload.target.digest
        || JSON.stringify(snap.documents) !== JSON.stringify(payload.target.documents)) {
        return targetInvalid(`dispatch is stale: ${payload.target.digest} != ${snap.digest}`, next);
    }
    // 새로 기록하는 dispatch는 v2여야 한다. snapshot_version이 없는 digest-only payload는
    // 새 digest 알고리즘과 맞지 않아 위 digest 대조에서 이미 stale로 걸리지만, 우연히 맞는
    // 경우에도 내용 없는 payload를 cycle 증거로 저장하지 않도록 형식을 따로 거절한다.
    if (payload.snapshot_version !== SNAPSHOT_VERSION) {
        return targetInvalid(`dispatch snapshot_version ${String(payload.snapshot_version)} is not ${SNAPSHOT_VERSION}`, next);
    }
    // payload가 실어 온 parts·scope_parts·structure_parts·documents_content는 믿지 않는다:
    // 현재 blueprint에서 다시 계산해 같아야 한다. 위조된 문서별 digest나 before/after 내용으로
    // follow_up 판정과 reviewer 입력이 흔들리지 못하게 한다.
    const partSnap = computePlanParts({ repoRoot, blueprintDir: bp });
    if (!partSnap.ok)
        return targetInvalid(partSnap.error, next);
    if (!isDeepStrictEqual(payload.parts, partSnap.parts)
        || !isDeepStrictEqual(payload.scope_parts, partSnap.scope_parts)
        || !isDeepStrictEqual(payload.structure_parts, partSnap.structure_parts)
        || !isDeepStrictEqual(payload.documents_content, partSnap.documents_content)) {
        return targetInvalid('dispatch parts/content differ from the current blueprint', next);
    }
    return { sha256: sha256(bytes), digest: snap.digest, text: bytes.toString('utf8') };
}
function isFail(value) {
    return isRecord(value) && value.ok === false;
}
/**
 * 같은 namespace의 배타 잠금 아래에서 fn을 실행한다. 잠금은 mkdir(원자적)이며
 * 이미 있으면 대기 없이 거절한다. 프로세스가 잠금 보유 중 죽으면 lock 디렉터리가
 * 남는다 — 자동 회수는 하지 않고(소유 확인 없는 회수는 동시 쓰기를 허용한다)
 * next 안내로 사람이 확인 후 지우게 한다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {() => T} fn - 잠금 안에서 실행할 전이
 * @returns {T | Fail} fn 결과 또는 잠금 거절
 */
function withLock(ctx, fn) {
    const lock = path.join(ctx.nsAbs, 'lock');
    try {
        fs.mkdirSync(lock);
    }
    catch (error) {
        if (isRecord(error) && error.code === 'EEXIST') {
            return fail('context-review-state-conflict', 'another transition holds the lock', `retry later; if no other process runs, remove ${ctx.nsRel}/lock`);
        }
        throw error;
    }
    try {
        return fn();
    }
    finally {
        fs.rmdirSync(lock);
    }
}
/**
 * namespace 경로를 정한다. blueprint 경로가 canonical이 아니거나 namespace가 repo 밖을
 * 가리키면 어떤 디렉터리도 만들기 전에 거절한다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - 입력 blueprint 경로
 * @param {boolean} create - 없는 디렉터리를 만들지 여부
 * @returns {Ctx | Fail} namespace 컨텍스트 또는 거절
 */
function openContext(repoRoot, blueprintDir, create) {
    const bp = toPosix(blueprintDir);
    if (bp.split('/').includes('..') || !isCanonicalBlueprintDir(bp)) {
        return targetInvalid(`not a canonical blueprint dir: ${blueprintDir}`, 'pass --blueprint .bouncer/context/epics/<id>/blueprints/<id>');
    }
    const nsRel = `.bouncer/runtime/context-review/${bp.split('/').join('__')}`;
    const nsAbs = resolveInsideRepo(repoRoot, nsRel, create);
    if (nsAbs === null) {
        return targetInvalid('runtime namespace escapes the repository', 'remove the symlink under .bouncer/runtime');
    }
    return { nsAbs, nsRel, bp };
}
function corrupt(cause) {
    return fail('context-review-state-conflict', `corrupt state: ${cause}`, 'restore state.json from backup; counters must not be reset by hand');
}
/**
 * state.json을 읽고 모양·한도·namespace 결속을 검사한다. restart_count와 history
 * 길이가 어긋나거나 참조 경로가 이 cycle 밖이면 손상으로 보고 모든 전이를 거절한다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @returns {State | null | Fail} 정상 state, 파일 없음이면 null, 손상이면 거절
 */
function loadState(ctx) {
    const statePath = path.join(ctx.nsAbs, 'state.json');
    let raw;
    try {
        if (!isPlainFile(statePath))
            return null;
        raw = fs.readFileSync(statePath, 'utf8');
    }
    catch (error) {
        if (error instanceof UnsafePathError)
            return corrupt(error.message);
        // 권한 오류 등을 "없음"으로 위장하지 않고 코드를 보존한 손상으로 알린다.
        if (isRecord(error) && typeof error.code === 'string')
            return corrupt(`state unreadable: ${error.code}`);
        throw error;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return corrupt(error.message);
    }
    if (!isRecord(parsed) || parsed.version !== 1 || parsed.blueprint !== ctx.bp
        || !isRecord(parsed.cycle) || !Array.isArray(parsed.transitions)
        || typeof parsed.closed !== 'boolean') {
        return corrupt('shape');
    }
    // closure는 선택 필드다. 존재하면 형상과 dispositions 참조를 검증한다.
    if (parsed.closure !== undefined) {
        if (!isRecord(parsed.closure)
            || (parsed.closure.dispositions !== undefined && !isRecord(parsed.closure.dispositions))
            || !Array.isArray(parsed.closure.accept_risk)
            || !parsed.closure.accept_risk.every((x) => typeof x === 'string')) {
            return corrupt('closure shape');
        }
        // 손상된 digest를 현재 내용으로 대체 인증하지 않는다: 형식이 틀리면 state 손상이다.
        const digest = parsed.closure.closure_target_digest;
        if (digest !== undefined && (typeof digest !== 'string' || !SHA256_RE.test(digest))) {
            return corrupt('closure digest shape');
        }
    }
    const c = parsed.cycle;
    if (typeof c.id !== 'string' || !CYCLE_ID_RE.test(c.id)
        || (c.restart_count !== 0 && c.restart_count !== 1)
        || !Array.isArray(c.history) || c.history.length !== c.restart_count
        || !Array.isArray(c.active_reports) || !isRecord(c.latest_dispatch)) {
        return corrupt('cycle');
    }
    const prefix = `${ctx.nsRel}/cycles/${c.id}/`;
    const reportDispatches = c.active_reports.map((r) => (isRecord(r) ? r.dispatch : null));
    const refs = [c.latest_dispatch, ...c.active_reports, ...reportDispatches];
    if (parsed.closure && isRecord(parsed.closure) && isRecord(parsed.closure.dispositions)) {
        refs.push(parsed.closure.dispositions);
    }
    for (const ref of refs) {
        // 정규화된 POSIX 상대 경로만 인정한다: `..`·`.`·빈 구간·절대 경로는 prefix 검사를 우회한다.
        const ok = isRecord(ref) && typeof ref.path === 'string' && ref.path.startsWith(prefix)
            && ref.path.length > prefix.length && path.posix.normalize(ref.path) === ref.path
            && !ref.path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
            && typeof ref.sha256 === 'string' && SHA256_RE.test(ref.sha256);
        if (!ok)
            return corrupt('reference outside cycle namespace');
    }
    return parsed;
}
function saveState(ctx, state) {
    writeAtomic(path.join(ctx.nsAbs, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
}
function cyclePrefix(ctx, id) {
    return `${ctx.nsRel}/cycles/${id}`;
}
/** dispatch를 cycle namespace 아래에 immutable로 저장하고 참조를 돌려준다. */
function storeDispatch(repoRoot, ctx, id, d) {
    const rel = `${cyclePrefix(ctx, id)}/dispatch/${d.sha256}.json`;
    writeImmutable(ctx.nsAbs, path.join(repoRoot, rel), d.text);
    return { path: rel, sha256: d.sha256 };
}
/**
 * 저장된 자료를 읽고 sha256이 참조와 같은지 확인한다. 같은 cycle의 보고를 다시
 * 합칠 때 변조·유실을 조용히 넘기지 않기 위함.
 */
function readRef(ctx, repoRoot, ref) {
    let text;
    const abs = path.join(repoRoot, ref.path);
    try {
        // 읽기도 symlink를 따라가지 않는다: 구성요소가 바뀌었으면 내용이 같아도 손상으로 본다.
        if (!walkSafeDir(ctx.nsAbs, path.dirname(abs), false) || !isPlainFile(abs))
            return corrupt(`missing ${ref.path}`);
        text = fs.readFileSync(abs, 'utf8');
    }
    catch (error) {
        if (error instanceof UnsafePathError)
            return corrupt(error.message);
        if (isRecord(error) && error.code === 'ENOENT')
            return corrupt(`missing ${ref.path}`);
        throw error;
    }
    if (sha256(text) !== ref.sha256)
        return corrupt(`digest mismatch ${ref.path}`);
    return text;
}
/**
 * active 보고들을 읽어 round 객체와 ID별 최신 finding을 합친다. 같은 id는 뒤 보고가
 * 통째로 대체한다(처분 갱신). 입력 객체는 변형하지 않아 archive가 원본을 보존한다.
 * 각 finding은 합치기 전에 정규화한다(fingerprint 공식 덮어쓰기, 생략 id는 `CR-<8hex>`).
 * immutable 보고 원문·sha는 그대로 두고 파생 결과에서만 고쳐, 과거에 틀린 fingerprint로
 * 기록된 보고도 close·projection에서 복구된다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {string} repoRoot - 저장소 루트
 * @param {ReportRef[]} reports - active 보고 참조
 * @returns {{ rounds: unknown[], findings: Finding[] } | Fail} 합성 결과 또는 손상 거절
 */
function foldReports(ctx, repoRoot, reports) {
    const rounds = [];
    const findings = [];
    for (const ref of reports) {
        const text = readRef(ctx, repoRoot, ref);
        if (isFail(text))
            return text;
        const body = JSON.parse(text);
        rounds.push(body.round);
        for (const raw of body.findings) {
            const f = normalizeFinding(raw, 'context');
            const at = findings.findIndex((x) => x.id === f.id);
            if (at >= 0)
                findings[at] = f;
            else
                findings.push(f);
        }
    }
    return { rounds, findings };
}
function transitionKey(parts) {
    return sha256(parts.join('\u0000'));
}
/**
 * context-review.md에 남은 기존(cycle 도입 전) 증거를 읽는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 경로
 * @returns {{ present: boolean, rounds: unknown[], findings: Finding[], digest: string | null } | Fail}
 *   rounds·findings가 비어 있으면 present false. digest는 마지막 round의 target.digest
 */
function readLegacy(repoRoot, bp) {
    const abs = path.join(repoRoot, bp, 'context-review.md');
    if (!fs.existsSync(abs))
        return { present: false, rounds: [], findings: [], digest: null, marker: 0 };
    let data;
    try {
        ({ data } = readDoc(abs));
    }
    catch (error) {
        return fail('context-review-legacy-evidence', error instanceof Error ? error.message : String(error), 'fix context-review.md frontmatter, then retry');
    }
    const bouncer = isRecord(data) && isRecord(data.bouncer) ? data.bouncer : {};
    const cr = isRecord(bouncer.context_review) ? bouncer.context_review : {};
    const rounds = Array.isArray(cr.rounds) ? cr.rounds : [];
    const findings = (Array.isArray(cr.findings) ? cr.findings : []);
    let digest = null;
    for (const r of rounds) {
        if (isRecord(r) && isRecord(r.target) && typeof r.target.digest === 'string')
            digest = r.target.digest;
    }
    const rawMarker = cr.restart_count;
    if (rawMarker !== undefined && rawMarker !== 0 && rawMarker !== RESTART_LIMIT) {
        return fail('context-review-legacy-evidence', `restart_count marker ${JSON.stringify(rawMarker)} is invalid`, 'restart_count must be 0 or 1; restore context-review.md from version control');
    }
    return {
        present: rounds.length > 0 || findings.length > 0, rounds, findings, digest,
        marker: typeof rawMarker === 'number' ? rawMarker : 0,
    };
}
/**
 * restart_count 표식을 반영한 context-review.md 새 본문을 만든다(쓰지는 않는다). 파일이 없으면
 * 표준 scaffold로 먼저 만든다. frontmatter의 `context_review:` 아래 한 키만 최소 패치하고,
 * 파싱한 결과가 "원본 + 표식 하나"와 정확히 같을 때만 통과해 다른 바이트·키를 건드리지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 경로
 * @param {number} count - 기록할 restart_count
 * @returns {{ abs: string, text: string } | Fail} 쓸 파일과 본문, 패치 불가면 거절
 */
function prepareMarker(repoRoot, bp, count) {
    const abs = path.join(repoRoot, bp, 'context-review.md');
    const unsupported = (cause) => fail('context-review-legacy-evidence', cause, 'keep context-review.md frontmatter in the standard two-space YAML layout, then retry');
    if (!fs.existsSync(abs)) {
        try {
            scaffoldContextReview({ repoRoot, blueprintDir: bp, timestamp: new Date().toISOString() });
        }
        catch (error) {
            // scaffold가 던지는 Error(닫힌 blueprint·id 도출 실패)만 거절로 바꾼다.
            if (!(error instanceof Error))
                throw error;
            return unsupported(`cannot create context-review.md: ${error.message}`);
        }
    }
    const original = fs.readFileSync(abs, 'utf8');
    const match = /^---\n([\s\S]*?)\n---(\n|$)/.exec(original);
    if (!match)
        return unsupported('context-review.md has no frontmatter block');
    const lines = match[1].split('\n');
    const at = lines.findIndex((l) => /^ {2}context_review:\s*$/.test(l));
    if (at < 0)
        return unsupported('bouncer.context_review block not found in block style');
    let end = at + 1;
    while (end < lines.length && /^ {3,}\S|^\s*$/.test(lines[end]))
        end += 1;
    const keyAt = lines.slice(at + 1, end).findIndex((l) => /^ {4}restart_count:/.test(l));
    if (keyAt >= 0)
        lines[at + 1 + keyAt] = `    restart_count: ${count}`;
    else
        lines.splice(at + 1, 0, `    restart_count: ${count}`);
    const text = `---\n${lines.join('\n')}\n---${original.slice(match[0].length - match[2].length)}`;
    let before;
    let after;
    try {
        before = readDoc(abs).data;
        after = frontmatter.parseFrontmatter(text).data;
    }
    catch (error) {
        return unsupported(error instanceof Error ? error.message : String(error));
    }
    const expected = JSON.parse(JSON.stringify(before));
    if (!isRecord(expected) || !isRecord(expected.bouncer) || !isRecord(expected.bouncer.context_review)) {
        return unsupported('bouncer.context_review is not a mapping');
    }
    expected.bouncer.context_review.restart_count = count;
    if (!isDeepStrictEqual(after, expected))
        return unsupported('marker patch would change other frontmatter content');
    return { abs, text };
}
// context-review.md `## Findings` 절 제목. validate-sections의 REVIEW_SECTION_DEFS(G18이 읽는 정의)와
// 같은 별칭을 받아야 재작성한 절을 게이트가 같은 절로 인식한다.
const FINDINGS_HEADING_RE = /^##\s+(Findings|발견사항|리뷰\s*결과)\s*$/i;
// plan 스킬이 print dispatch 실패 증거로 `## Findings`에 적는 줄의 접두. 재작성 때 보존한다.
const INLINE_EVIDENCE_PREFIX = '- inline context review:';
/**
 * 목록 한 줄에 들어갈 값의 줄바꿈을 공백으로 접는다. 줄바꿈이 남으면 한 finding이 여러 줄로 갈라진다.
 * LF뿐 아니라 CR·CRLF도 줄 경계로 읽히므로 함께 접는다(`\r`만 있는 값도 마찬가지).
 */
function oneLine(value) {
    return String(value).replace(/\s*[\r\n]+\s*/g, ' ').trim();
}
/**
 * 투영 finding 목록을 `## Findings` 본문 줄로 만든다. 없으면 `- none` 한 줄이다.
 * G18은 목록 내용을 보지 않지만 사람이 읽는 증적이라 finding마다 한 줄씩 남긴다.
 *
 * @param {Finding[]} findings - 닫힌 cycle의 projection.findings
 * @returns {string[]} 목록 줄들
 */
function findingLines(findings) {
    if (findings.length === 0)
        return ['- none'];
    return findings.map((f) => {
        const note = f.note === undefined || f.note === null ? '' : oneLine(f.note);
        return `- ${oneLine(f.id)} (${oneLine(f.severity)}, ${oneLine(f.actionability)}, ${oneLine(f.status)}): `
            + `${oneLine(f.brief_clause)}${note === '' ? '' : ` — ${note}`}`;
    });
}
/**
 * 본문의 `## Findings` 절만 생성 목록으로 바꾼다. 절 안의 `- inline context review:` 줄은
 * 원래 순서로 목록 앞에 남기고, 절 밖 바이트와 절 끝의 빈 줄은 그대로 둔다. 절이 없으면
 * 본문 끝에 새로 붙인다(G18이 제목 존재를 요구하므로 문서가 이 절 없이 닫히면 안 된다).
 * 이미 생성된 절에 다시 적용해도 결과가 같아 재실행이 멱등이다.
 *
 * @param {string} body - frontmatter 뒤 본문
 * @param {string[]} generated - findingLines 결과
 * @returns {string} 새 본문
 */
function rewriteFindingsSection(body, generated) {
    const lines = body.split('\n');
    const heading = lines.findIndex((l) => FINDINGS_HEADING_RE.test(l.trim()));
    if (heading < 0) {
        const sep = body === '' || body.endsWith('\n\n') ? '' : (body.endsWith('\n') ? '\n' : '\n\n');
        return `${body}${sep}## Findings\n${generated.join('\n')}\n`;
    }
    let end = lines.findIndex((l, i) => i > heading && /^##\s/.test(l));
    if (end < 0)
        end = lines.length;
    const section = lines.slice(heading + 1, end);
    // 절 끝의 빈 줄(다음 절과의 간격, 파일 끝 개행)은 원문 그대로 되돌려 절 밖 바이트를 지킨다.
    let keep = section.length;
    while (keep > 0 && section[keep - 1].trim() === '')
        keep -= 1;
    const trailing = section.slice(keep);
    const inline = section.slice(0, keep).filter((l) => l.startsWith(INLINE_EVIDENCE_PREFIX));
    return [...lines.slice(0, heading + 1), ...inline, ...generated, ...trailing, ...lines.slice(end)].join('\n');
}
/**
 * 닫힌 cycle의 projection을 반영한 context-review.md 새 본문을 만든다(쓰지는 않는다).
 * 호출부는 state를 바꾸기 전에 이 함수를 먼저 불러, 문서 부재·깨진 frontmatter·렌더 검증
 * 실패를 쓰기 전에 거절한다. bouncer.status와 context_review.{rounds,findings}만 바꾸고
 * restart_count 등 다른 키는 파싱 값 그대로 두며, 직렬화는 renderDoc을 쓴다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} bp - blueprint 상대 POSIX 경로
 * @param {{ findings: Finding[]; rounds: unknown[] }} projection - 닫힌 cycle의 투영
 * @param {string} [closureTargetDigest] - 인증한 snapshot digest. 있으면 frontmatter에 기록한다
 * @returns {{ abs: string, text: string, rel: string } | Fail} 쓸 파일·본문·저장소 상대 경로, 또는 거절
 */
function prepareClosureDoc(repoRoot, bp, projection, closureTargetDigest) {
    const rel = `${bp}/context-review.md`;
    const abs = path.join(repoRoot, bp, 'context-review.md');
    if (!fs.existsSync(abs)) {
        return targetInvalid(`${rel} not found`, `bouncer scaffold context-review --blueprint ${bp}`);
    }
    let parsed;
    try {
        parsed = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
    }
    catch (error) {
        // 파싱 오류(Error)만 legacy-evidence로 바꾼다. readLegacy와 같은 거절이다.
        if (!(error instanceof Error))
            throw error;
        return fail('context-review-legacy-evidence', error.message, 'fix context-review.md frontmatter, then retry');
    }
    const data = isRecord(parsed.data)
        ? JSON.parse(JSON.stringify(parsed.data)) : {};
    if (!isRecord(data.bouncer))
        data.bouncer = {};
    const bouncer = data.bouncer;
    const cr = isRecord(bouncer.context_review) ? bouncer.context_review : {};
    bouncer.status = 'accepted';
    cr.rounds = JSON.parse(JSON.stringify(projection.rounds));
    cr.findings = JSON.parse(JSON.stringify(projection.findings));
    // runtime closure와 같은 값을 frontmatter에 투영한다. 과거 closed state는 digest가 없으므로
    // 그 경우 기존 값을 건드리지 않아 G18이 round digest 폴백으로 판정하게 둔다.
    if (closureTargetDigest !== undefined)
        cr.closure_target_digest = closureTargetDigest;
    bouncer.context_review = cr;
    const body = rewriteFindingsSection(parsed.body, findingLines(projection.findings));
    const messages = collectFindingFailures({
        body, findings: cr.findings, rounds: cr.rounds, sectionLabel: 'context-review',
        findingLabel: 'context-review', allowedStatuses: CONTEXT_REVIEW_STATUS, namespace: 'context',
    });
    if (messages.length > 0) {
        return fail('context-review-input-invalid', messages, 'fix the recorded round and finding fields so they pass the context-review format, then retry');
    }
    return { abs, text: renderDoc(data, body), rel };
}
/**
 * 병합된 finding 목록에서 둘 이상이 공유하는 fingerprint를 처음 나온 순서로 돌려준다.
 * collectFindingFailures를 통째로 부르면 round·본문 검사 메시지가 섞이므로 중복만 센다.
 * fingerprint가 문자열이 아닌 finding은 건너뛴다(형식 오류는 close 시점 검사가 맡는다).
 *
 * @param {Array<{fingerprint?: unknown}>} findings 이전 round와 합친 finding
 * @returns {string[]} 중복된 fingerprint
 */
function duplicateFingerprints(findings) {
    const seen = new Set();
    const dup = new Set();
    for (const f of findings) {
        if (typeof f.fingerprint !== 'string')
            continue;
        if (seen.has(f.fingerprint))
            dup.add(f.fingerprint);
        seen.add(f.fingerprint);
    }
    return [...dup];
}
/**
 * 이번 입력 finding의 정규화 id를 입력 순서로 중복 없이 돌려준다. noop 응답도 첫 적용과
 * 같은 값을 내야 하므로 fold 없이 finding 하나씩 정규화해 계산한다(id는 결정적이다).
 *
 * @param {Finding[]} findings - 이번 round 입력 findings(readReportInput 통과분)
 * @returns {string[]} 정규화 id 목록
 */
function inputFindingIds(findings) {
    const ids = [];
    for (const f of findings) {
        const id = normalizeFinding(f, 'context').id;
        if (!ids.includes(id))
            ids.push(id);
    }
    return ids;
}
/**
 * 저장된 projection의 finding을 정규화한 사본을 만든다. 정규화 도입 전에 닫힌 state는
 * 틀린 fingerprint를 projection에 담고 있을 수 있어, noop 재실행이 문서를 다시 쓸 때
 * 그대로 쓰면 형식 검증에서 막힌다. state.json 자체는 고치지 않는다(파생 값만 복구).
 *
 * @param {{ findings: Finding[]; rounds: unknown[] }} projection - state에 저장된 projection
 * @returns {{ findings: Finding[]; rounds: unknown[] }} findings만 정규화한 사본
 */
function normalizeProjection(projection) {
    return { ...projection, findings: projection.findings.map((f) => normalizeFinding(f, 'context')) };
}
/**
 * 표식과 state를 대조한다(잠금 안에서 호출). 표식이 state보다 크면 state가 지워졌거나 낮춰진
 * 것이라 거절하고, state가 표식보다 크면 직전 restart가 표식 쓰기 전에 죽은 것이므로 여기서
 * 표식을 채운다. 표식을 낮추는 경로는 없다.
 *
 * @param {Ctx} ctx - namespace 경로
 * @param {string} repoRoot - 저장소 루트
 * @param {State} state - 검증된 state
 * @param {Legacy} legacy - 같은 시점에 읽은 context-review.md 증거
 * @returns {Fail | null} 불일치 거절, 정상이면 null
 */
function reconcileMarker(ctx, repoRoot, state, legacy) {
    if (legacy.marker > state.cycle.restart_count) {
        return corrupt(`restart_count marker ${legacy.marker} exceeds state ${state.cycle.restart_count}`);
    }
    if (legacy.marker < state.cycle.restart_count) {
        const prepared = prepareMarker(repoRoot, ctx.bp, state.cycle.restart_count);
        if (isFail(prepared))
            return prepared;
        const written = guardWrites(() => writeAtomic(prepared.abs, prepared.text));
        if (isFail(written))
            return written;
    }
    return null;
}
/** state.json이 없는데 표식이 남아 있을 때의 거절. 새 cycle로 횟수를 되돌리지 못하게 한다. */
function markerWithoutState(marker) {
    return fail('context-review-state-conflict', `restart_count marker ${marker} exists in context-review.md but state.json is missing`, 'restore state.json from backup; counters must not be reset by hand');
}
function newCycleId(bp, dispatchSha) {
    return `cr-${sha256(`${bp}\u0000${dispatchSha}`).slice(0, 16)}`;
}
/**
 * 새 cycle을 시작한다. 이미 state가 있으면 id와 횟수를 그대로 돌려주는 no-op이라
 * start를 반복해도 누적 재시작 횟수를 0으로 되돌릴 수 없다. 기존 context-review
 * 증거만 있고 state가 없으면 거절하고 restart로 가져오게 한다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - review-dispatch plan JSON 파일
 * @returns {object} 성공 `{ok:true,cycle,noop}`, 실패 `{ok:false,reason,cause,next}`
 */
function startCycle(input) {
    const { repoRoot } = input;
    const probe = openContext(repoRoot, input.blueprintDir, false);
    if (isFail(probe))
        return probe;
    // 쓰기 전에 payload를 먼저 검증한다: 거절된 start가 디렉터리를 남기지 않는다.
    const dispatch = loadDispatch(repoRoot, probe.bp, input.dispatchFile);
    if (isFail(dispatch))
        return dispatch;
    const ctx = openContext(repoRoot, input.blueprintDir, true);
    return withLock(ctx, () => {
        const state = loadState(ctx);
        if (isFail(state))
            return state;
        const legacy = readLegacy(repoRoot, ctx.bp);
        if (isFail(legacy))
            return legacy;
        if (state) {
            const mismatch = reconcileMarker(ctx, repoRoot, state, legacy);
            if (mismatch)
                return mismatch;
            return { ok: true, noop: true, cycle: state.cycle };
        }
        // 표식이 있는데 state가 없으면 runtime을 지워 새 cycle로 한도를 되돌리려는 경로다.
        if (legacy.marker >= 1)
            return markerWithoutState(legacy.marker);
        if (legacy.present) {
            return fail('context-review-legacy-evidence', 'context-review.md already holds review evidence', 'run context-review restart with the previous payload to archive it; start cannot import');
        }
        const id = newCycleId(ctx.bp, dispatch.sha256);
        const created = {
            version: 1,
            blueprint: ctx.bp,
            cycle: {
                id,
                restart_count: 0,
                history: [],
                active_reports: [],
                latest_dispatch: { path: '', sha256: '' },
            },
            transitions: [],
            closed: false,
            projection: null,
        };
        const stored = guardWrites(() => {
            created.cycle.latest_dispatch = storeDispatch(repoRoot, ctx, id, dispatch);
            saveState(ctx, created);
        });
        if (isFail(stored))
            return stored;
        return { ok: true, noop: false, cycle: created.cycle };
    });
}
/**
 * 보고 입력(`{round,findings}`)을 읽고 finding 모양을 검사한다. 미해결 처분(open)은
 * 진행 중 보고에만 허용되며 canonical 처분 enum은 여기서 늘리지 않는다.
 * `id` 키 생략은 자동 id 대상이라 통과하지만, 명시한 id는 비어 있지 않은 문자열이어야 한다
 * (null·빈 문자열·공백·비문자열은 작성 실수로 보고 거절한다).
 */
function readReportInput(roundFile) {
    const next = 'fix --round JSON: object with round and findings array';
    let text;
    try {
        text = fs.readFileSync(roundFile, 'utf8');
    }
    catch (error) {
        return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error), next);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return fail('context-review-input-invalid', error.message, next);
    }
    if (!isRecord(parsed) || !isRecord(parsed.round) || !Array.isArray(parsed.findings)) {
        return fail('context-review-input-invalid', 'expected { round: object, findings: array }', next);
    }
    for (const f of parsed.findings) {
        const ok = isRecord(f)
            && (!Object.prototype.hasOwnProperty.call(f, 'id') || (typeof f.id === 'string' && f.id.trim() !== ''))
            && REVIEW_SEVERITY.includes(f.severity)
            && FINDING_STATUS.includes(f.status)
            && FINDING_ACTIONABILITY.includes(f.actionability);
        if (!ok)
            return fail('context-review-input-invalid', `malformed finding ${JSON.stringify(f)}`, next);
    }
    return { text, round: parsed.round, findings: parsed.findings };
}
/**
 * closure 투영을 만든다. resolved 또는 note 있는 accepted만 통과하고, must_fix
 * accepted는 사용자가 명시한 --accept-risk ID와 정확히 일치해야 한다.
 *
 * @param {Finding[]} findings - ID별 최신 처분
 * @param {string[]} acceptRisk - 명시 동의된 finding ID
 * @returns {Finding[] | Fail} 투영된 findings 또는 unresolved 거절
 */
function projectClosure(findings, acceptRisk) {
    const bad = [];
    const risky = new Set();
    for (const f of findings) {
        const noted = typeof f.note === 'string' && f.note.trim() !== '';
        if (f.status === 'open')
            bad.push(`${String(f.id)} open`);
        else if (f.status === 'accepted' && !noted)
            bad.push(`${String(f.id)} accepted without note`);
        else if (f.status === 'accepted' && f.actionability === 'must_fix') {
            if (acceptRisk.includes(f.id))
                risky.add(f.id);
            else
                bad.push(`${String(f.id)} must_fix accepted without --accept-risk`);
        }
    }
    for (const id of acceptRisk) {
        if (!risky.has(id))
            bad.push(`--accept-risk ${id} is not an accepted must_fix finding`);
    }
    if (bad.length > 0) {
        return fail('context-review-unresolved-findings', bad, 'resolve open findings or record explicit user-approved accepted-risk with note');
    }
    // 통과한 finding 중 사용자 동의가 명시된 accepted must_fix에만 accepted_risk: true 표식을 붙인다.
    // 사람이 손으로 붙인 값은 배제하고 CLI projection에서만 부여해 G18 판정에 넘긴다.
    return findings.map((f) => {
        if (f.status === 'accepted' && f.actionability === 'must_fix' && risky.has(f.id)) {
            return { ...f, accepted_risk: true };
        }
        return { ...f };
    });
}
/**
 * 리뷰어 보고 한 건과 dispatch를 cycle에 기록한다. 보고는 immutable 파일로 먼저 저장하고
 * state 교체(sibling tmp + rename)가 마지막이라, 어느 단계에서 실패해도 기존 state는
 * 유지된다. 같은 전이 키의 재요청은 no-op, 같은 round의 다른 입력은 충돌이다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - review-dispatch plan JSON 파일
 * @param {string} input.roundFile - `{round,findings}` JSON 파일
 * @param {string} [input.status] - requested|addressed|accepted(기본 requested). accepted는 closure
 * @param {string[]} [input.acceptRisk] - 사용자 동의가 있는 must_fix accepted ID
 * @returns {object} 성공 `{ok:true,noop,cycle,status,closed,projection?}`, 실패 `{ok:false,...}`
 */
function recordReport(input) {
    const { repoRoot } = input;
    const status = input.status || 'requested';
    if (!REPORT_STATUS.includes(status)) {
        return fail('context-review-input-invalid', `status ${status}`, 'use requested, addressed or accepted');
    }
    const acceptRisk = [...(input.acceptRisk || [])].sort();
    const ctx = openContext(repoRoot, input.blueprintDir, false);
    if (isFail(ctx))
        return ctx;
    const report = readReportInput(input.roundFile);
    if (isFail(report))
        return report;
    let dispatchBytes;
    try {
        dispatchBytes = fs.readFileSync(input.dispatchFile);
    }
    catch (error) {
        return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error), 'pass --dispatch <review-dispatch plan JSON file>');
    }
    if (!fs.existsSync(path.join(ctx.nsAbs, 'state.json'))) {
        const evidence = readLegacy(repoRoot, ctx.bp);
        if (isFail(evidence))
            return evidence;
        if (evidence.marker >= 1)
            return markerWithoutState(evidence.marker);
        return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    }
    return withLock(ctx, () => {
        const state = loadState(ctx);
        if (isFail(state))
            return state;
        if (!state)
            return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
        const evidence = readLegacy(repoRoot, ctx.bp);
        if (isFail(evidence))
            return evidence;
        const mismatch = reconcileMarker(ctx, repoRoot, state, evidence);
        if (mismatch)
            return mismatch;
        const cycle = state.cycle;
        const round = report.round.round;
        // 1. 전이 키: cycle·restart·round·dispatch·입력 digest(+처분 인자)를 묶는다.
        //    같은 키는 이미 적용된 전이라 no-op이며 dispatch가 그사이 stale이 되어도 거절하지 않는다.
        const key = transitionKey([cycle.id, cycle.restart_count, String(round), sha256(dispatchBytes),
            sha256(report.text), status, acceptRisk.join(',')]);
        if (state.transitions.includes(key)) {
            // 닫는 전이의 재실행은 문서를 투영 상태로 되돌려 쓴다: 첫 성공 뒤 문서가 바뀌었거나
            // state 저장 뒤 문서 쓰기가 실패했어도 같은 입력의 재실행이 복구한다.
            let written;
            const projection = state.projection ? normalizeProjection(state.projection) : null;
            if (status === 'accepted' && projection) {
                const doc = prepareClosureDoc(repoRoot, ctx.bp, projection, state.closure?.closure_target_digest);
                if (isFail(doc))
                    return doc;
                const wrote = guardWrites(() => writeAtomic(doc.abs, doc.text));
                if (isFail(wrote))
                    return wrote;
                written = doc.rel;
            }
            return {
                ok: true, noop: true, cycle, status, closed: state.closed,
                finding_ids: inputFindingIds(report.findings),
                ...(projection ? { projection } : {}),
                ...(written ? { written } : {}),
            };
        }
        const dispatch = loadDispatch(repoRoot, ctx.bp, input.dispatchFile);
        if (isFail(dispatch))
            return dispatch;
        if (state.closed) {
            return fail('context-review-state-conflict', 'cycle is already closed', 'restart only when the plan changed');
        }
        // 2. round 순서: discovery 또는 discovery→delta. 이미 있는 번호를 다른 입력이 노리면 충돌.
        const n = cycle.active_reports.length;
        if (Number.isInteger(round) && round >= 1 && round <= n) {
            return fail('context-review-state-conflict', `round ${String(round)} already recorded with different input`, 'a transition is applied once; record the next round');
        }
        if (n >= ROUND_MODES.length || round !== n + 1 || report.round.mode !== ROUND_MODES[n]) {
            const want = ROUND_MODES[n] ?? 'none';
            return fail('context-review-round-order', `expected round ${n + 1} mode ${want}, got round ${String(round)} mode ${String(report.round.mode)}`, n >= ROUND_MODES.length
                ? 'close with the recorded rounds or restart'
                : `record round ${n + 1} (${want})`);
        }
        const reportTarget = report.round.target;
        if (isRecord(reportTarget) && reportTarget.digest !== undefined && reportTarget.digest !== dispatch.digest) {
            return targetInvalid(`round target.digest ${String(reportTarget.digest)} != dispatch ${dispatch.digest}`, 'set round.target.digest to the dispatch target.digest');
        }
        // 3. 이전 보고와 합쳐 ID별 최신 처분을 만든다. closure면 projection 검사까지.
        const folded = foldReports(ctx, repoRoot, cycle.active_reports);
        if (isFail(folded))
            return folded;
        // 3-1. 입력도 같은 공식으로 정규화한다(fingerprint 덮어쓰기·생략 id 생성). 명시 id 오류와
        //      자동 id 충돌은 merge 전에 거절해 다른 finding을 덮어쓰지 않게 한다. 보고 원문(report.text)과
        //      그 sha·전이 키는 입력 바이트 그대로 두고, 정규화는 fold가 읽을 때마다 다시 적용된다.
        const normalized = normalizeRoundFindings(report.findings, folded.findings, 'context');
        if (!normalized.ok) {
            return fail('context-review-input-invalid', normalized.messages, 'give each finding a non-empty string id or omit the id key; resolve id collisions, then retry');
        }
        const incoming = normalized.findings;
        const merged = [...folded.findings];
        for (const f of incoming) {
            const at = merged.findIndex((x) => x.id === f.id);
            if (at >= 0)
                merged[at] = f;
            else
                merged.push(f);
        }
        // 중복 fingerprint는 status와 무관하게 쓰기 전에 거부한다. accepted 때만 막으면 중복이 requested/addressed
        // record를 통과한 뒤 close에서야 막혀, 같은 round를 다시 기록할 수 없고 restart만 남기 때문이다.
        const duplicates = duplicateFingerprints(merged);
        if (duplicates.length > 0) {
            return fail('context-review-input-invalid', duplicates.map((fp) => `context-review duplicate fingerprint ${fp}`), 'merge the findings sharing a fingerprint into one and record the same round again');
        }
        let projection = null;
        let closureDoc = null;
        if (status === 'accepted') {
            const projected = projectClosure(merged, acceptRisk);
            if (isFail(projected))
                return projected;
            projection = { findings: projected, rounds: [...folded.rounds, report.round] };
            // state를 바꾸기 전에 문서를 렌더·검증한다: 부재·검증 실패 거절이 아무것도 남기지 않는다.
            // accepted record는 round target과 같다고 검증된 dispatch.digest를 인증 대상으로 쓴다.
            closureDoc = prepareClosureDoc(repoRoot, ctx.bp, projection, dispatch.digest);
            if (isFail(closureDoc))
                return closureDoc;
        }
        // 4. 쓰기: immutable 자료 → state 교체 순.
        const reportSha = sha256(report.text);
        const reportRel = `${cyclePrefix(ctx, cycle.id)}/r${cycle.restart_count}`
            + `/reports/${String(round)}-${reportSha.slice(0, 16)}.json`;
        let dispatchRef = { path: '', sha256: '' };
        const stored = guardWrites(() => {
            dispatchRef = storeDispatch(repoRoot, ctx, cycle.id, dispatch);
            writeImmutable(ctx.nsAbs, path.join(repoRoot, reportRel), report.text);
        });
        if (isFail(stored))
            return stored;
        const next = {
            ...state,
            cycle: {
                ...cycle,
                active_reports: [...cycle.active_reports, {
                        round: round, mode: report.round.mode, status, path: reportRel,
                        sha256: reportSha, dispatch: dispatchRef, key,
                    }],
                latest_dispatch: dispatchRef,
            },
            transitions: [...state.transitions, key],
            closed: status === 'accepted',
            ...(status === 'accepted'
                ? { closure: { accept_risk: acceptRisk, closure_target_digest: dispatch.digest } }
                : {}),
            projection,
        };
        const saved = guardWrites(() => saveState(ctx, next));
        if (isFail(saved))
            return saved;
        // 문서는 state 저장 뒤에 쓴다. 쓰기가 실패해도 같은 입력의 재실행(noop 경로)이 복구한다.
        if (closureDoc && !isFail(closureDoc)) {
            const doc = closureDoc;
            const wrote = guardWrites(() => writeAtomic(doc.abs, doc.text));
            if (isFail(wrote))
                return wrote;
        }
        // 병합 후보 경고는 noop이 아닌 이번 기록의 round 입력만 대상으로 한다(추가 I/O 없음).
        const warnings = validateSections.findingMergeCandidates(incoming);
        return {
            ok: true, noop: false, cycle: next.cycle, status, closed: next.closed, finding_ids: normalized.ids,
            ...(warnings.length > 0 ? { warnings } : {}),
            ...(projection ? { projection } : {}),
            ...(closureDoc && !isFail(closureDoc) ? { written: closureDoc.rel } : {}),
        };
    });
}
/**
 * 마지막 round 뒤 남은 finding 처분을 사용자 동의(--accept-risk·note)와 함께 기록해 cycle을 닫는다.
 * 닫힌 cycle은 restart할 수 있고, accepted-risk must_fix는 G18에서 미해결로 세지 않는다.
 * dispositions를 immutable 파일로 먼저 저장하고 state 교체가 마지막이라, 어느 단계에서
 * 실패해도 기존 state는 유지된다. 같은 전이 키의 재요청은 no-op이다.
 *
 * @param {object} input - 입력 객체
 * @param {string} input.repoRoot - 저장소 루트 절대 경로
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispositionsFile - [{ id, status, note }] JSON 파일 경로
 * @param {string[]} [input.acceptRisk] - 사용자 동의가 있는 must_fix accepted ID 목록
 * @returns {Record<string, unknown>} 성공 {ok:true,noop,cycle,status,closed,projection}, 실패 {ok:false,...}
 */
function closeCycle(input) {
    const { repoRoot } = input;
    // 중복을 제거하고 정렬해 전이 키와 closure 원장의 결정론적 형식을 보장한다.
    const acceptRisk = Array.from(new Set(input.acceptRisk || [])).sort();
    const ctx = openContext(repoRoot, input.blueprintDir, false);
    if (isFail(ctx))
        return ctx;
    let dispBytes;
    let rawText;
    try {
        dispBytes = fs.readFileSync(input.dispositionsFile);
        rawText = dispBytes.toString('utf8');
    }
    catch (error) {
        return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error), 'pass --dispositions <json-file>');
    }
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return fail('context-review-input-invalid', error.message, 'pass valid dispositions JSON array');
    }
    if (!Array.isArray(parsed)) {
        return fail('context-review-input-invalid', 'dispositions must be a JSON array', 'pass an array of { id, status, note }');
    }
    if (!fs.existsSync(path.join(ctx.nsAbs, 'state.json'))) {
        const evidence = readLegacy(repoRoot, ctx.bp);
        if (isFail(evidence))
            return evidence;
        if (evidence.marker >= 1)
            return markerWithoutState(evidence.marker);
        return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    }
    return withLock(ctx, () => {
        const state = loadState(ctx);
        if (isFail(state))
            return state;
        if (!state)
            return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
        const evidence = readLegacy(repoRoot, ctx.bp);
        if (isFail(evidence))
            return evidence;
        const mismatch = reconcileMarker(ctx, repoRoot, state, evidence);
        if (mismatch)
            return mismatch;
        const cycle = state.cycle;
        // 0. 인증 대상: 지금 디스크의 계획 snapshot. close는 dispatch를 받지 않으므로 현재 내용이 곧 대상이다.
        const snap = computePlanSnapshot({ repoRoot, blueprintDir: ctx.bp });
        if (!snap.ok)
            return targetInvalid(snap.error, 'fix the plan documents, then retry close');
        // 1. 전이 키: cycle id, restart count, 'close', dispositions 원본 바이트 sha256, 정렬된 accept-risk,
        //    인증 대상 digest. digest를 넣어야 닫힌 뒤 본문을 고친 재close가 같은 처분 파일로도
        //    no-op으로 삼켜지지 않는다.
        const key = transitionKey([cycle.id, cycle.restart_count, 'close', sha256(dispBytes), acceptRisk.join(','),
            snap.digest]);
        if (state.transitions.includes(key)) {
            // 이미 반영된 close 전이이므로 closure 결과(status: 'accepted')를 돌려주되, 문서는
            // 투영 상태로 다시 쓴다(첫 성공 뒤 변경·쓰기 실패 복구).
            // 저장 projection은 정규화 전 기록일 수 있어 파생 사본을 정규화해 쓴다.
            let written;
            const projection = state.projection ? normalizeProjection(state.projection) : null;
            if (projection) {
                const doc = prepareClosureDoc(repoRoot, ctx.bp, projection, snap.digest);
                if (isFail(doc))
                    return doc;
                const wrote = guardWrites(() => writeAtomic(doc.abs, doc.text));
                if (isFail(wrote))
                    return wrote;
                written = doc.rel;
            }
            return {
                ok: true, noop: true, cycle, status: 'accepted', closed: state.closed,
                ...(projection ? { projection } : {}),
                ...(written ? { written } : {}),
            };
        }
        // 2. 상태 충돌 검사: 아직 기록된 round가 없으면 거절. 이미 닫힌 cycle은 인증한 digest와
        //    현재 snapshot이 같을 때만 거절한다 — 다르면 본문 수정 뒤 재close 후보다(3-1에서 계약 대조).
        const latestText = readRef(ctx, repoRoot, cycle.latest_dispatch);
        if (isFail(latestText))
            return latestText;
        const baseline = JSON.parse(latestText);
        const baselineTarget = isRecord(baseline.target) ? baseline.target : {};
        const certified = state.closure?.closure_target_digest ?? baselineTarget.digest;
        if (state.closed && certified === snap.digest) {
            return fail('context-review-state-conflict', 'cycle is already closed', 'restart only when the plan changed');
        }
        if (cycle.active_reports.length === 0) {
            return fail('context-review-state-conflict', 'no round has been recorded in this cycle', 'record at least one round before close');
        }
        // 2-1. 구조·계약 대조: 리뷰한 baseline과 digest가 다르면 문서 집합·structure_parts·scope_parts가
        //      모두 같은 본문 수정만 인증한다. 다른 변경은 route의 delta/restart 몫이다.
        if (baselineTarget.digest !== snap.digest) {
            const parts = computePlanParts({ repoRoot, blueprintDir: ctx.bp });
            if (!parts.ok)
                return targetInvalid(parts.error, 'fix the plan documents, then retry close');
            if (!sameStructureAndScope(baseline, { documents: snap.documents, ...parts })) {
                return fail('context-review-state-conflict', 'plan structure or contract differs from the reviewed baseline; close cannot certify it', 'run context-review route with a fresh review-dispatch plan: delta for an Interface/Touch change, '
                    + 'restart for a structure change');
            }
        }
        // 3. active 보고들을 fold하여 기존 finding 목록을 취합한다
        const folded = foldReports(ctx, repoRoot, cycle.active_reports);
        if (isFail(folded))
            return folded;
        // 4. dispositions 항목 유효성 검사 및 합성. folded는 이미 정규화돼 있어 처분은 정규화 후 id에
        //    적용된다(생략 id로 기록한 finding도 `CR-<8hex>`로 지정한다).
        const seenIds = new Set();
        const merged = folded.findings.map((f) => ({ ...f }));
        for (const item of parsed) {
            if (!isRecord(item) || typeof item.id !== 'string') {
                return fail('context-review-input-invalid', 'disposition item missing valid id', 'each disposition must be an object with string id');
            }
            if (seenIds.has(item.id)) {
                return fail('context-review-input-invalid', `duplicate disposition id ${item.id}`, 'each finding id must appear at most once in dispositions');
            }
            seenIds.add(item.id);
            const targetIndex = merged.findIndex((f) => f.id === item.id);
            if (targetIndex < 0) {
                return fail('context-review-input-invalid', `finding id ${item.id} not found in recorded findings`, 'only dispose recorded findings');
            }
            if (!CONTEXT_REVIEW_STATUS.includes(item.status)) {
                return fail('context-review-input-invalid', `disposition status ${String(item.status)} invalid`, 'disposition status must be resolved or accepted');
            }
            merged[targetIndex] = {
                ...merged[targetIndex],
                status: item.status,
                ...(item.note !== undefined ? { note: item.note } : {}),
            };
        }
        // 5. projectClosure 검증: open finding 잔존 여부, note 없는 accepted, --accept-risk 매칭을 확인
        const projected = projectClosure(merged, acceptRisk);
        if (isFail(projected))
            return projected;
        const projection = { findings: projected, rounds: folded.rounds };
        // 5-1. state를 바꾸기 전에 문서를 렌더·검증한다(부재·검증 실패는 무변경 거절).
        const closureDoc = prepareClosureDoc(repoRoot, ctx.bp, projection, snap.digest);
        if (isFail(closureDoc))
            return closureDoc;
        // 6. 쓰기: immutable dispositions 저장 후 state.json 원자적 교체
        const dispSha = sha256(rawText);
        const dispRel = `${cyclePrefix(ctx, cycle.id)}/r${cycle.restart_count}/dispositions/${dispSha.slice(0, 16)}.json`;
        const dispRef = { path: dispRel, sha256: dispSha };
        const stored = guardWrites(() => {
            writeImmutable(ctx.nsAbs, path.join(repoRoot, dispRel), rawText);
        });
        if (isFail(stored))
            return stored;
        const next = {
            ...state,
            transitions: [...state.transitions, key],
            closed: true,
            closure: { dispositions: dispRef, accept_risk: acceptRisk, closure_target_digest: snap.digest },
            projection,
        };
        const saved = guardWrites(() => saveState(ctx, next));
        if (isFail(saved))
            return saved;
        // 문서는 state 저장 뒤에 쓴다. 쓰기가 실패해도 같은 입력의 재실행(noop 경로)이 복구한다.
        const wrote = guardWrites(() => writeAtomic(closureDoc.abs, closureDoc.text));
        if (isFail(wrote))
            return wrote;
        // 정상적으로 cycle이 closed/accepted 되었음을 알리는 반환 객체
        return {
            ok: true, noop: false, cycle: next.cycle, status: 'accepted', closed: next.closed,
            projection: next.projection, written: closureDoc.rel,
        };
    });
}
/**
 * cycle을 전체 재시작한다. 누적 1회만 허용하며 active 증거(rounds·findings·보고·dispatch)는
 * history로 보관한다. 직전 certified target과 현재 snapshot이 같으면 거절하고, delta 뒤
 * 미해결 must_fix가 있으면 restart로 해결을 우회하지 못하게 거절한다. state가 없고
 * context-review.md에 기존 증거가 있으면 그 증거를 archive로 가져오며 재시작 1회를 소비한다.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - 새 snapshot의 review-dispatch plan JSON 파일
 * @param {string} input.reason - 재시작 사유(archive에 보관)
 * @returns {object} 성공 `{ok:true,noop,cycle}`, 실패 `{ok:false,...}`
 */
function restartCycle(input) {
    const { repoRoot, reason } = input;
    const probe = openContext(repoRoot, input.blueprintDir, false);
    if (isFail(probe))
        return probe;
    let dispatchBytes;
    try {
        dispatchBytes = fs.readFileSync(input.dispatchFile);
    }
    catch (error) {
        return fail('context-review-input-invalid', isRecord(error) ? error.code : String(error), 'pass --dispatch <review-dispatch plan JSON file>');
    }
    const legacy = readLegacy(repoRoot, probe.bp);
    if (isFail(legacy))
        return legacy;
    const hasState = fs.existsSync(path.join(probe.nsAbs, 'state.json'));
    // 표식이 있는데 state가 없으면 한도 소진 기록이 남은 것이다: 증거 import로 우회하지 못하게 거절한다.
    if (!hasState && legacy.marker >= RESTART_LIMIT) {
        return fail('context-review-restart-limit', `restart_count marker ${legacy.marker} of ${RESTART_LIMIT} used and state.json is missing`, 'continue the current cycle: restore state.json from backup; no further automatic restart');
    }
    if (!hasState && !legacy.present) {
        return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    }
    const ctx = openContext(repoRoot, input.blueprintDir, true);
    return withLock(ctx, () => {
        const state = loadState(ctx);
        if (isFail(state))
            return state;
        if (state) {
            const evidence = readLegacy(repoRoot, ctx.bp);
            if (isFail(evidence))
                return evidence;
            const mismatch = reconcileMarker(ctx, repoRoot, state, evidence);
            if (mismatch)
                return mismatch;
        }
        const dispatchSha = sha256(dispatchBytes);
        const priorId = state ? state.cycle.id : newCycleId(ctx.bp, dispatchSha);
        const key = transitionKey([priorId, 'restart', dispatchSha, reason]);
        if (state && state.transitions.includes(key))
            return { ok: true, noop: true, cycle: state.cycle };
        if (state && state.cycle.restart_count >= RESTART_LIMIT) {
            return fail('context-review-restart-limit', `restart_count ${state.cycle.restart_count} of ${RESTART_LIMIT} used`, 'continue the current cycle: record findings, resolve them, or ask the user; no further automatic restart');
        }
        const dispatch = loadDispatch(repoRoot, ctx.bp, input.dispatchFile);
        if (isFail(dispatch))
            return dispatch;
        let archive;
        let base;
        if (state) {
            const folded = foldReports(ctx, repoRoot, state.cycle.active_reports);
            if (isFail(folded))
                return folded;
            // 닫힌 cycle은 미해결 검사를 projection 기준으로 판정한다.
            // 열려 있는 cycle은 fold된 active 보고의 open must_fix를 검사한다.
            const findingsToCheck = (state.closed && state.projection)
                ? state.projection.findings
                : folded.findings;
            if (state.cycle.active_reports.length >= 2
                && findingsToCheck.some((f) => f.status === 'open' && f.actionability === 'must_fix')) {
                return fail('context-review-unresolved-findings', 'must_fix remains open after the delta round', 'record explicit user-approved accepted-risk with context-review close, or fix open findings; '
                    + 'restart cannot resolve findings');
            }
            const latest = readRef(ctx, repoRoot, state.cycle.latest_dispatch);
            if (isFail(latest))
                return latest;
            // 닫힌 cycle은 close가 인증한 digest가 마지막 certified target이다(본문 재close가 latest_dispatch를
            // 바꾸지 않으므로 round digest만 보면 이미 인증된 snapshot으로 restart할 수 있다).
            const previousDigest = state.closure?.closure_target_digest
                ?? JSON.parse(latest).target.digest;
            if (previousDigest === dispatch.digest) {
                return fail('context-review-state-conflict', 'plan snapshot is unchanged since the last certified target', 'restart only after the plan documents changed');
            }
            const dispatches = [...state.cycle.active_reports.map((r) => r.dispatch), state.cycle.latest_dispatch];
            archive = {
                restart_index: 1,
                reason,
                rounds: folded.rounds,
                findings: findingsToCheck,
                reports: state.cycle.active_reports,
                dispatches: dispatches.filter((d, i) => dispatches.findIndex((x) => x.sha256 === d.sha256) === i),
                ...(state.closure ? { closure: state.closure } : {}),
            };
            base = state;
        }
        else {
            // 기존 증거 import: 직전 certified digest가 없으면 stale 판정 근거가 없어 거절한다.
            if (legacy.digest === null) {
                return fail('context-review-legacy-evidence', 'context-review.md has no previous target.digest', 'provide the previous review-dispatch payload digest (missing previous target); '
                    + 'restart cannot prove the plan changed');
            }
            if (legacy.digest === dispatch.digest) {
                return fail('context-review-state-conflict', 'plan snapshot is unchanged since the last certified target', 'restart only after the plan documents changed');
            }
            archive = {
                restart_index: 1,
                reason,
                legacy: true,
                rounds: legacy.rounds,
                findings: legacy.findings,
                reports: [],
                dispatches: [],
            };
            base = {
                version: 1, blueprint: ctx.bp, transitions: [], closed: false, projection: null,
                // 아직 저장되지 않는 임시 틀: 아래 next가 restart_count·latest_dispatch를 모두 덮어쓴다.
                cycle: {
                    id: priorId, restart_count: 0, history: [], active_reports: [], latest_dispatch: { path: '', sha256: '' },
                },
            };
        }
        // 표식 본문을 쓰기 전에 먼저 만들어 패치 불가를 state 변경 전에 거절한다.
        const marked = prepareMarker(repoRoot, ctx.bp, 1);
        if (isFail(marked))
            return marked;
        let dispatchRef = { path: '', sha256: '' };
        const stored = guardWrites(() => {
            dispatchRef = storeDispatch(repoRoot, ctx, base.cycle.id, dispatch);
        });
        if (isFail(stored))
            return stored;
        const next = {
            ...base,
            cycle: {
                id: base.cycle.id,
                restart_count: 1,
                history: [...base.cycle.history, archive],
                active_reports: [],
                latest_dispatch: dispatchRef,
            },
            transitions: [...base.transitions, key],
            closed: false,
            closure: undefined,
            projection: null,
        };
        // state가 먼저, 표식이 나중이다. 사이에 죽으면 다음 전이의 reconcileMarker가 표식을 채운다.
        const saved = guardWrites(() => {
            saveState(ctx, next);
            writeAtomic(marked.abs, marked.text);
        });
        if (isFail(saved))
            return saved;
        return { ok: true, noop: false, cycle: next.cycle };
    });
}
/**
 * 두 plan payload의 문서 집합·structure_parts(구조)와 scope_parts(Interface·Touch 계약)가 같은지 본다.
 * scope_parts의 해시 공식은 plan-snapshot 소유라 여기서는 값만 비교한다.
 *
 * @param {Record<string, unknown>} a - 기준 payload(저장된 latest dispatch)
 * @param {Record<string, unknown>} b - 비교 payload 또는 현재 계산값
 * @returns {{ structure: boolean, scope: boolean }} 구조 동일 여부와 계약 동일 여부
 */
function compareShape(a, b) {
    const docs = (x) => (Array.isArray(x.documents) ? x.documents
        : (isRecord(x.target) ? x.target.documents : undefined));
    return {
        structure: isDeepStrictEqual(docs(a), docs(b)) && isDeepStrictEqual(a.structure_parts, b.structure_parts),
        scope: isDeepStrictEqual(a.scope_parts, b.scope_parts),
    };
}
/** 구조와 계약이 모두 같은지(본문만 달라진 수정인지). */
function sameStructureAndScope(a, b) {
    const shape = compareShape(a, b);
    return shape.structure && shape.scope;
}
function route(next_action, reason, cause, next, cycle) {
    return { ok: true, next_action, reason, cause, next, cycle };
}
/**
 * 새 review-dispatch payload가 기존 cycle에서 어떤 후속 조치를 요구하는지 정한다.
 * 읽기 전용이라 state.json·보고·dispatch 저장본을 쓰지 않는다 — 호출이 round 수나 restart
 * 횟수를 바꾸지 못하므로 "delta 뒤 새 stale"가 세 번째 round나 두 번째 restart로 새지 않는다.
 * 판정 순서: 같은 target(reuse) → round 없음·미해결 must_fix(user) → 구조·계약 동일(close)
 * → 구조 동일 + 계약 변경, discovery 뒤 partial(delta)
 * → 그 밖의 stale(구조 변경): restart_count<1이면 restart, 한도 소진이면 user.
 *
 * @param {object} input - 입력
 * @param {string} input.repoRoot - 저장소 루트
 * @param {string} input.blueprintDir - blueprint 상대 경로
 * @param {string} input.dispatchFile - 새 snapshot의 review-dispatch plan JSON 파일
 * @param {string} [input.followUp] - 선택. 주어지면 payload의 follow_up과 같아야 한다 — 호출자가
 *   payload와 다른 판정을 주입해 routing을 바꾸지 못한다. 생략하면 payload에서 파생한다.
 * @returns {object} 성공 `{ok:true,next_action,reason,cause,next,cycle}`
 *   (next_action은 reuse|close|delta|restart|user), 실패 `{ok:false,reason,cause,next}`
 */
function routeFollowUp(input) {
    const { repoRoot } = input;
    const ctx = openContext(repoRoot, input.blueprintDir, false);
    if (isFail(ctx))
        return ctx;
    const state = loadState(ctx);
    if (isFail(state))
        return state;
    if (!state)
        return fail('context-review-state-conflict', 'no cycle started', 'run context-review start first');
    const dispatch = loadDispatch(repoRoot, ctx.bp, input.dispatchFile);
    if (isFail(dispatch))
        return dispatch;
    // follow_up은 검증을 통과한 payload 자체에서 읽는다(loadDispatch가 text를 JSON으로 확인했다).
    const followUp = JSON.parse(dispatch.text).follow_up;
    if (followUp !== 'partial' && followUp !== 'full') {
        return fail('context-review-input-invalid', `payload follow_up ${String(followUp)}`, 'pass the review-dispatch plan JSON produced with --previous');
    }
    if (input.followUp !== undefined && input.followUp !== followUp) {
        return fail('context-review-input-invalid', `follow_up ${String(input.followUp)} differs from payload follow_up ${followUp}`, 'omit followUp or pass the payload value');
    }
    const { cycle } = state;
    const rounds = cycle.active_reports.length;
    // 1. 아직 기록된 round가 없으면 reviewer 보고를 기다리는 중이다: 자동 전이를 만들지 않는다.
    if (rounds === 0) {
        return route('user', 'context-review-round-pending', 'no round has been recorded in this cycle', 'record the pending discovery round before routing a new target', cycle);
    }
    // 2. 마지막 reviewed target과 같으면 재사용한다: round도 restart도 늘리지 않는다.
    const latest = readRef(ctx, repoRoot, cycle.latest_dispatch);
    if (isFail(latest))
        return latest;
    const baseline = JSON.parse(latest);
    const newPayload = JSON.parse(dispatch.text);
    // close로 재인증한 digest도 이미 검토·인증된 target이다: latest_dispatch는 그대로라 따로 본다.
    if (baseline.target.digest === dispatch.digest
        || state.closure?.closure_target_digest === dispatch.digest) {
        return route('reuse', 'context-review-target-unchanged', 'plan snapshot equals the last reviewed target', 'reuse the recorded review result; do not add a round', cycle);
    }
    // 3. delta 뒤 미해결 must_fix는 restart·재-delta로 해결을 우회할 수 없다: 사용자 판단으로 멈춘다.
    if (!state.closed && rounds >= ROUND_MODES.length) {
        const folded = foldReports(ctx, repoRoot, cycle.active_reports);
        if (isFail(folded))
            return folded;
        if (folded.findings.some((f) => f.status === 'open' && f.actionability === 'must_fix')) {
            return route('user', 'context-review-unresolved-findings', 'must_fix remains open after the delta round', 'record explicit user-approved accepted-risk with context-review close, or fix open findings; '
                + 'restart cannot resolve findings', cycle);
        }
    }
    // 4. 구조·계약이 baseline과 같은 본문 수정은 새 round 없이 close로 현재 digest를 인증한다.
    //    닫힌 cycle의 본문 수정도 같은 경로다(닫힌 뒤 stale이 되면 재close).
    const shape = compareShape(baseline, newPayload);
    if (shape.structure && shape.scope) {
        return route('close', 'context-review-close-available', 'body-only change: structure and contract equal the reviewed baseline', 'run context-review close with dispositions; it certifies the current snapshot digest', cycle);
    }
    // 5. 구조가 같고 Interface·Touch만 바뀐 discovery 뒤 닫히지 않은 cycle의 partial만 delta다.
    //    닫힌 cycle은 round 기록이 거절되므로 제외한다.
    if (followUp === 'partial' && shape.structure && !state.closed && rounds === 1) {
        return route('delta', 'context-review-delta-available', 'partial change after discovery with no delta used', 'dispatch one delta round with revision_diff and related_documents', cycle);
    }
    // 6. delta를 이미 썼거나 structural full: 남은 restart가 있을 때만 전체 재시작이다.
    if (cycle.restart_count < RESTART_LIMIT) {
        return route('restart', 'context-review-restart-available', 'delta is used or the change is structural', 'run context-review restart, then dispatch discovery', cycle);
    }
    return route('user', 'context-review-restart-limit', `restart_count ${cycle.restart_count} of ${RESTART_LIMIT} used`, 'continue the current cycle: record findings, resolve them, or ask the user; no further automatic restart', cycle);
}
/**
 * review-dispatch가 쓰는 읽기 전용 조회. state.json과 latest_dispatch 저장본을 loadState와 같은
 * 검증(id 형식·정규화 경로·sha256·symlink 거부)으로 읽는다. 아무것도 만들거나 쓰지 않는다.
 *
 * @param {string} repoRoot - 저장소 루트
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {object} state가 없으면 `{ok:true,state:null}`, 있으면 `{ok:true,state,payload}`
 *   (payload는 저장된 latest_dispatch JSON), 검증 실패는 `{ok:false,cause}`
 */
function readStoredLatest(repoRoot, blueprintDir) {
    const ctx = openContext(repoRoot, blueprintDir, false);
    if (isFail(ctx))
        return { ok: false, cause: String(ctx.cause) };
    const state = loadState(ctx);
    if (isFail(state))
        return { ok: false, cause: String(state.cause) };
    if (state === null)
        return { ok: true, state: null };
    const text = readRef(ctx, repoRoot, state.cycle.latest_dispatch);
    if (isFail(text))
        return { ok: false, cause: String(text.cause) };
    try {
        return { ok: true, state, payload: JSON.parse(text) };
    }
    catch (error) {
        if (!(error instanceof SyntaxError))
            throw error;
        return { ok: false, cause: 'stored latest_dispatch is not JSON' };
    }
}
/** context-review.md 증거(rounds·findings·restart_count 표식)를 읽는 읽기 전용 조회. */
function readLegacyEvidence(repoRoot, bp) {
    const legacy = readLegacy(repoRoot, bp);
    if (isFail(legacy))
        return { ok: false, cause: String(legacy.cause) };
    return { ok: true, present: legacy.present, digest: legacy.digest, marker: legacy.marker };
}
module.exports = {
    startCycle, recordReport, closeCycle, restartCycle, routeFollowUp, readStoredLatest, readLegacyEvidence,
    // 단위 테스트가 symlink·덮어쓰기 거부를 직접 확인하도록 노출한다.
    writeAtomic, writeImmutable,
};
