'use strict';
const fs = require('node:fs');
const path = require('node:path');
const frontmatter = require("./frontmatter");
const { parseFrontmatter } = frontmatter;
const render = require("./render");
const { renderDoc } = render;
const templates = require("./templates");
const { templateBody } = templates;
const paths = require("./paths");
const { parsePathIds } = paths;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
const retentionMigration = require("./retention-migration");
const { resolveBlueprintDir } = retentionMigration;
const time = require("./time");
const { nowIsoKst } = time;
/**
 * 레거시 blueprint(`review_scope` 없음)를 blueprint 단일 최종 리뷰 범위로 명시 전환한다.
 * `index.md`에 `review_scope: blueprint`를 쓰고, scaffold와 같은 metadata의 root pending
 * `review.md`를 만든다. 이미 전환됐고 root review가 있으면 아무것도 쓰지 않는 noop이다.
 * task 증적·기존 task 리뷰·pointer는 읽지도 옮기지도 않는다.
 *
 * 쓰기 전에 모든 거절 조건(경로 이탈, 문서 부재, flat layout, root review 충돌)을 먼저
 * 검증하고, 쓰기 도중 실패하면 이미 쓴 파일을 되돌려 부분 변경을 남기지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 저장소 루트 절대 경로
 * @param {string} opts.blueprintDir - 저장소 상대 blueprint 경로
 * @param {string} [opts.timestamp] - 새 review.md의 timestamp(테스트 주입용, 기본 현재 KST)
 * @returns {MigrateReviewScopeResult} 성공 시 migrated/noop 요약, 거절 시 ok:false와 code
 */
function migrateReviewScope({ repoRoot, blueprintDir, timestamp }) {
    // 1. 경로 봉쇄: 절대·`..`·symlink 탈출은 어떤 파일도 읽기 전에 거절한다.
    const resolved = resolveBlueprintDir(repoRoot, blueprintDir);
    if (!resolved.ok) {
        return { ok: false, blueprint: null, reason: resolved.reason, code: resolved.code };
    }
    const bp = resolved.blueprint;
    const fail = (reason, code, next) => (next ? { ok: false, blueprint: bp, reason, code, next } : { ok: false, blueprint: bp, reason, code });
    // 2. index.md를 읽는다. 읽지 못하면 어떤 blueprint인지 증명할 수 없어 거절한다.
    const indexRel = `${bp}/index.md`;
    const indexAbs = path.join(repoRoot, indexRel);
    let original;
    let data;
    let body;
    try {
        original = fs.readFileSync(indexAbs, 'utf8');
    }
    catch (error) {
        // ENOENT 등 읽기 실패만 문서 부재로 접는다. 그 밖의 예외는 버그이므로 그대로 던진다.
        if (error.code === undefined)
            throw error;
        return fail(`${indexRel} is not readable`, 'INVALID_DOC');
    }
    try {
        const parsed = parseFrontmatter(original);
        data = parsed.data;
        body = parsed.body;
    }
    catch (_error) {
        // YAML 파싱 실패는 문서 충돌로 보고하고 파일은 건드리지 않는다.
        return fail(`${indexRel} frontmatter is not parseable`, 'INVALID_DOC');
    }
    const bouncer = data && typeof data === 'object' ? data.bouncer : undefined;
    if (!bouncer || typeof bouncer !== 'object' || Array.isArray(bouncer)) {
        return fail(`${indexRel} has no bouncer block`, 'INVALID_DOC');
    }
    const meta = bouncer;
    // 3. flat layout(루트 tasks-NNN.md / tasks.md)은 root review를 task 쪽으로 옮기는
    // task-layout migration과 계약이 겹친다. 먼저 그쪽을 하도록 안내하고 아무것도 쓰지 않는다.
    if (listTasksDocs({ repoRoot, blueprintDir: bp }).legacy) {
        return fail('flat task layout: run task-layout migration first', 'FLAT_LAYOUT', 'bouncer migrate task-layout');
    }
    const reviewRel = `${bp}/review.md`;
    const reviewAbs = path.join(repoRoot, reviewRel);
    const reviewExists = fs.existsSync(reviewAbs);
    const scoped = meta.review_scope === 'blueprint';
    if (meta.review_scope !== undefined && !scoped) {
        return fail('review_scope must be blueprint', 'INVALID_DOC');
    }
    // 4. 이미 전환됨 + root review 존재 → noop(원문 보존).
    if (scoped && reviewExists) {
        return { ok: true, blueprint: bp, status: 'noop', created: [], updated: [] };
    }
    // review_scope가 없는데 root review가 있으면 사람이 쓴 finding일 수 있어 덮어쓰지 않는다.
    if (!scoped && reviewExists) {
        return fail(`${reviewRel} already exists without review_scope`, 'REVIEW_CONFLICT');
    }
    // 5. 쓰기. review.md를 먼저 만들고 index를 갱신한다. 둘째 쓰기가 실패하면 첫째를 되돌린다.
    const ids = parsePathIds(bp);
    const epicId = typeof meta.epic_id === 'string' ? meta.epic_id : ids.epicId;
    const blueprintId = typeof meta.blueprint_id === 'string' ? meta.blueprint_id : ids.blueprintId;
    const reviewDoc = {
        type: 'bouncer.review',
        title: `${blueprintId} review`,
        description: `Review for ${blueprintId}`,
        resource: reviewRel,
        tags: ['bouncer', 'review'],
        timestamp: timestamp || nowIsoKst(),
        bouncer: {
            id: `REVIEW-${blueprintId}`,
            epic_id: epicId,
            blueprint_id: blueprintId,
            status: 'pending',
            review: { required: true },
        },
    };
    const created = [];
    const updated = [];
    try {
        fs.writeFileSync(reviewAbs, renderDoc(reviewDoc, templateBody('review.md', {
            epicId, blueprintId, name: '',
        })));
        created.push(reviewRel);
        if (!scoped) {
            // scaffold와 키 순서를 맞추려고 scale 바로 뒤에 넣고, scale이 없으면 끝에 붙인다.
            const next = {};
            for (const [key, value] of Object.entries(meta)) {
                next[key] = value;
                if (key === 'scale')
                    next.review_scope = 'blueprint';
            }
            if (!('review_scope' in next))
                next.review_scope = 'blueprint';
            fs.writeFileSync(indexAbs, renderDoc({ ...data, bouncer: next }, body));
            updated.push(indexRel);
        }
    }
    catch (error) {
        // 부분 변경을 남기지 않는다. 되돌리기 자체가 실패해도 원래 오류를 가리지 않게 삼킨다.
        try {
            fs.writeFileSync(indexAbs, original);
            if (created.length)
                fs.rmSync(reviewAbs, { force: true });
        }
        catch (_rollbackError) {
            // 롤백 실패는 원래 쓰기 오류를 다시 던지는 것으로 충분히 드러난다.
        }
        throw error;
    }
    return { ok: true, blueprint: bp, status: 'migrated', created, updated };
}
module.exports = { migrateReviewScope };
