'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { toPosix } = require('./paths');
const { computeDiffSha, EXPLAIN_SECTION_DEFS, resolveComprehensionEntry } = require('./comprehension');
// finalize가 validate를 require하므로 scope 헬퍼는 finalize를 거치지 않는다.
const { makeAllowed, isRuntimeArtifact } = require('./scope');
const { defaultStagedFiles, resolveTaskUnit, unitLeafRel, statusOf, } = require('./validate-docs');
const { isValidGraphBasis } = require('./validate-structural');
const { VERIFY_SECTION_DEFS, EXPLAIN_SECTION_HEADINGS, TODO_RE, parseSections, parseTasksSections, extractPathCandidates, pathsOverlap, pathJustifiedByTouch, collectFindingFailures, } = require('./validate-sections');
// 게이트별 G 코드 층. 문서 로드(docs)·문서 하나 구조(S)·본문 파싱은 여기 두지
// 않는다. graph.basis는 structural.isValidGraphBasis를 그대로 쓴다 — 여기 다시
// 구현하면 S9와 G4가 갈라진다. validate.ts를 require하지 않는다
// (validate → gates → structural, 순환 금지).
function checkGate(gate, docs, rels, failures, ctx) {
    const add = (code, message, fileKey) => failures.push({ code, message, file: rels[fileKey] });
    const repoRoot = ctx && ctx.repoRoot;
    const blueprintDir = ctx && ctx.blueprintDir;
    const deps = ctx && ctx.deps;
    if (gate === 'plan') {
        if (statusOf(docs.epicIndex) !== 'approved')
            add('G1', 'epic.status != approved', 'epicIndex');
        // closed는 finalize --yes가 마감한 blueprint의 잠금 signal(hard rule/schema 참고).
        // 미승인 draft와 같은 코드(G2)로 걸지만, 사용자가 "왜 막혔는지" draft와
        // 헷갈리지 않도록 문구를 분기한다 — 재승인 경로가 없다는 점도 여기서 안내.
        const bpStatus = statusOf(docs.blueprintIndex);
        if (bpStatus === 'closed') {
            add('G2', 'blueprint is closed (finalized) — open a new blueprint instead of resuming this one', 'blueprintIndex');
        }
        else if (bpStatus !== 'approved') {
            add('G2', 'blueprint.status != approved', 'blueprintIndex');
        }
        // G18은 blueprint 단위 — task 묶음 순회(G3–G5·G10–G12) 밖에 둔다.
        // light 면제를 두지 않는 이유: bouncer.scale: light는 named-agent 디스패치
        // (implementer/reviewer)만 인라인으로 줄이는 경로이고, 계획 문서 계약은
        // 그대로다. scripts/는 scale을 읽지 않는다(Distill). 면제 분기를 넣으면
        // LLM 판정이 게이트를 우회하게 되어 하드룰 4와 어긋난다. 게이트는 status와
        // 세 필드·## Findings 절만 보고 판정 문장 자체는 읽지 않는다.
        if (!docs.contextReview) {
            add('G18', `context-review.md missing (${rels.contextReview}); run bouncer scaffold context-review`, 'contextReview');
        }
        else {
            if (statusOf(docs.contextReview) !== 'accepted') {
                add('G18', 'context-review.status != accepted', 'contextReview');
            }
            const crBouncer = docs.contextReview.data && docs.contextReview.data.bouncer
                ? docs.contextReview.data.bouncer
                : {};
            const crMeta = crBouncer.context_review;
            for (const message of collectFindingFailures({
                body: docs.contextReview.body,
                findings: crMeta && crMeta.findings,
                sectionLabel: 'context-review',
                findingLabel: 'context-review',
            })) {
                add('G18', message, 'contextReview');
            }
        }
        // plan 게이트의 task 검사는 문서마다 돌린다. file은 해당 task 경로여야
        // 어느 문서가 미달인지 알 수 있다. tasksDocs가 없으면 단위 테스트용
        // 단일 docs.tasks로 폴백.
        const tasksList = Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
            ? docs.tasksDocs
            : (docs.tasks ? [docs.tasks] : []);
        if (tasksList.length === 0) {
            add('G3', 'tasks.status != ready', 'tasks');
            add('G4', 'tasks.graph.suggested_paths missing', 'tasks');
            add('G5', 'tasks.affected_paths missing or empty', 'tasks');
            add('G10', 'tasks missing implementation-ready sections: goal, interface, touch, doNotTouch, checklist', 'tasks');
            return;
        }
        for (const tasksDoc of tasksList) {
            const file = tasksDoc.rel || rels.tasks;
            const addTask = (code, message) => failures.push({ code, message, file });
            // ready = plan 직후. in_progress = execute 중. verified = 같은 BP의
            // 앞 task를 이미 끝낸 뒤 next-task --set. draft만 G3.
            const taskStatus = statusOf(tasksDoc);
            if (!['ready', 'in_progress', 'verified'].includes(taskStatus)) {
                addTask('G3', 'tasks.status != ready');
            }
            const graph = tasksDoc && tasksDoc.data.bouncer ? tasksDoc.data.bouncer.graph : undefined;
            const suggested = graph ? graph.suggested_paths : undefined;
            if (!Array.isArray(suggested))
                addTask('G4', 'tasks.graph.suggested_paths missing');
            if (graph && !isValidGraphBasis(graph.basis)) {
                addTask('G4', 'tasks.graph.basis missing or empty');
            }
            const ap = tasksDoc && tasksDoc.data.bouncer ? tasksDoc.data.bouncer.affected_paths : undefined;
            if (!Array.isArray(ap) || ap.length === 0)
                addTask('G5', 'tasks.affected_paths missing or empty');
            const tasksBody = tasksDoc && typeof tasksDoc.body === 'string' ? tasksDoc.body : '';
            const sections = parseTasksSections(tasksBody);
            const sectionKeys = ['goal', 'interface', 'touch', 'doNotTouch', 'checklist'];
            const missing = sectionKeys.filter((k) => !sections[k]);
            const unfilled = sectionKeys.filter((k) => sections[k] && TODO_RE.test(sections[k]));
            if (missing.length) {
                addTask('G10', `tasks missing implementation-ready sections: ${missing.join(', ')}`);
            }
            else if (unfilled.length) {
                // 아래 path 검사 대신 보고: 치환되지 않은 placeholder는 G11/G12 finding이
                // scope가 아니라 template 텍스트에 대한 잡음이 되게 함.
                addTask('G10', `tasks sections still contain <TODO: …> placeholders: ${unfilled.join(', ')}`);
            }
            else {
                const apList = Array.isArray(ap)
                    ? ap.map((p) => toPosix(String(p)).replace(/^\.\//, ''))
                    : [];
                const unjustified = apList.filter((p) => !pathJustifiedByTouch(p, sections.touch));
                if (unjustified.length) {
                    addTask('G11', `affected_paths not justified by Touch: ${unjustified.join(', ')}`);
                }
                const forbidden = extractPathCandidates(sections.doNotTouch);
                const overlap = apList.filter((p) => forbidden.some((f) => pathsOverlap(p, f)));
                if (overlap.length) {
                    addTask('G12', `do-not-touch intersects affected_paths: ${overlap.join(', ')}`);
                }
            }
        }
        return;
    }
    if (gate === 'execute') {
        // docs.tasks(첫 문서 호환 필드)는 쓰지 않는다 — 포인터 대상 묶음만 판정.
        // ctx.taskUnit이 없으면 단위 테스트용으로 평탄 docs에서 합성.
        const taskUnit = (ctx && ctx.taskUnit) || resolveTaskUnit(docs, {});
        const tasksDoc = taskUnit && taskUnit.tasks;
        const verificationDoc = taskUnit && taskUnit.verification;
        const reviewDoc = taskUnit && taskUnit.review;
        const addUnit = (code, message, leaf) => failures.push({
            code,
            message,
            file: unitLeafRel(taskUnit, leaf, rels[leaf]),
        });
        if (statusOf(tasksDoc) !== 'verified') {
            addUnit('G6', 'tasks.status != verified', 'tasks');
        }
        if (statusOf(verificationDoc) !== 'passed') {
            addUnit('G7', 'verification.status != passed', 'verification');
        }
        const review = reviewDoc && reviewDoc.data.bouncer ? reviewDoc.data.bouncer.review : undefined;
        const reviewOk = statusOf(reviewDoc) === 'accepted' || (review && review.required === false);
        if (!reviewOk) {
            addUnit('G8', 'review not accepted and review.required != false', 'review');
        }
        if (verificationDoc) {
            const vbody = typeof verificationDoc.body === 'string' ? verificationDoc.body : '';
            const vs = parseSections(vbody, VERIFY_SECTION_DEFS);
            const missingV = ['command', 'evidence'].filter((k) => !vs[k]);
            if (missingV.length) {
                addUnit('G13', `verification.md missing body sections: ${missingV.join(', ')}`, 'verification');
            }
            const evidence = verificationDoc.data.bouncer && verificationDoc.data.bouncer.verification;
            const validEvidence = evidence
                && typeof evidence.command === 'string'
                && evidence.command.trim()
                && typeof evidence.ran_at === 'string'
                && evidence.ran_at.trim()
                && evidence.exit_code === 0
                && typeof evidence.output_tail === 'string';
            if (!validEvidence) {
                addUnit('G13', 'verification.md missing successful harness verification metadata', 'verification');
            }
            else if (!vs.command.includes(`\`${evidence.command}\``)
                || !vs.evidence.includes('Exit code: 0')) {
                addUnit('G13', 'verification.md body does not match harness verification metadata', 'verification');
            }
        }
        const reviewMeta = reviewDoc && reviewDoc.data.bouncer ? reviewDoc.data.bouncer.review : undefined;
        const reviewSkipped = reviewMeta && reviewMeta.required === false;
        if (reviewDoc && !reviewSkipped) {
            for (const message of collectFindingFailures({
                body: reviewDoc.body,
                findings: reviewMeta && reviewMeta.findings,
                sectionLabel: 'review.md',
                findingLabel: 'review',
            })) {
                addUnit('G14', message, 'review');
            }
        }
        return;
    }
    // G16: blueprint 마감. 모든 task verified + explain 본문·comprehension(BP 단일
    // 엔트리)의 diff_sha를 range_from..HEAD와 대조. G15는 폐기(결번)됐고, commit은
    // 아래에서 G6/G7/G8 + G17로 재판정한다.
    if (gate === 'finalize') {
        const tasksList = Array.isArray(docs.tasksDocs) && docs.tasksDocs.length > 0
            ? docs.tasksDocs
            : (docs.tasks ? [docs.tasks] : []);
        const openIds = [];
        for (const tasksDoc of tasksList) {
            if (statusOf(tasksDoc) !== 'verified') {
                const id = tasksDoc && tasksDoc.data && tasksDoc.data.bouncer
                    ? tasksDoc.data.bouncer.id
                    : undefined;
                openIds.push(typeof id === 'string' && id ? id : '(unknown)');
            }
        }
        if (openIds.length) {
            // 열린 task id를 메시지에 담아 어느 묶음이 남았는지 바로 보이게 한다.
            // 경고가 아니라 hard fail — 사용자가 넘길 수 없다.
            failures.push({
                code: 'G16',
                message: `open tasks remain (not verified): ${openIds.join(', ')}`,
                file: (tasksList.find((t) => statusOf(t) !== 'verified') || {}).rel || rels.tasks,
            });
            return;
        }
        if (!docs.explain) {
            add('G16', 'explain.md missing', 'explain');
            return;
        }
        if (statusOf(docs.explain) !== 'published') {
            add('G16', 'explain.status != published', 'explain');
        }
        const explainBody = typeof docs.explain.body === 'string' ? docs.explain.body : '';
        const sections = parseSections(explainBody, EXPLAIN_SECTION_HEADINGS);
        const missing = EXPLAIN_SECTION_DEFS.filter((k) => !sections[k]);
        if (missing.length) {
            add('G16', `explain missing written sections: ${missing.join(', ')}`, 'explain');
            return;
        }
        const bouncer = docs.explain.data && docs.explain.data.bouncer
            ? docs.explain.data.bouncer
            : {};
        const comp = bouncer.comprehension;
        // BP당 엔트리 하나(배열 마지막). task 번호 루프는 쓰지 않는다 —
        // 0.7 다중 엔트리는 마지막만 보면 읽기 호환이 된다.
        const found = resolveComprehensionEntry(comp);
        if (!found.ok) {
            add('G16', found.reason === 'not-a-list'
                ? 'explain comprehension must be a list of task entries'
                : 'explain comprehension record missing', 'explain');
            return;
        }
        // 계산 실패와 해시 불일치는 서로 다른 문자열 — 원인 분류가 메시지에 드러나야 한다.
        const shaFn = (deps && deps.computeDiffSha) || computeDiffSha;
        const computed = shaFn({
            repoRoot,
            base: found.entry.range_from,
            exec: deps && deps.exec,
        });
        if (!computed || computed.ok !== true) {
            const reason = computed && computed.reason ? computed.reason : 'exec-failed';
            add('G16', `explain diff_sha could not be computed (${reason})`, 'explain');
            return;
        }
        if (computed.sha !== String(found.entry.diff_sha).trim()) {
            // 메시지에 range_from을 쓰지 않는다 — 실패 사유는 불일치뿐; 범위는 엔트리에 있다.
            add('G16', 'explain diff_sha does not match range_from..HEAD', 'explain');
        }
        return;
    }
    // commit: explain을 보지 않는다. 포인터 task 상태(G6/G7/G8)와 스테이징
    // 스코프(G17)만 본다. G9·G15는 폐기 — 번호만 비워 둔다.
    if (gate === 'commit') {
        // G9 (distill.status == published)는 폐기됨 — 번호만 비워 둠.
        // G15 (explain comprehension / diff_sha)는 폐기됨 — 번호만 비워 둠.
        const taskUnit = (ctx && ctx.taskUnit) || resolveTaskUnit(docs, {
            repoRoot, blueprintDir,
        });
        const tasksDoc = taskUnit && taskUnit.tasks;
        const verificationDoc = taskUnit && taskUnit.verification;
        const reviewDoc = taskUnit && taskUnit.review;
        const addUnit = (code, message, leaf) => failures.push({
            code,
            message,
            file: unitLeafRel(taskUnit, leaf, rels[leaf]),
        });
        if (statusOf(tasksDoc) !== 'verified') {
            addUnit('G6', 'tasks.status != verified', 'tasks');
        }
        if (statusOf(verificationDoc) !== 'passed') {
            addUnit('G7', 'verification.status != passed', 'verification');
        }
        const review = reviewDoc && reviewDoc.data.bouncer ? reviewDoc.data.bouncer.review : undefined;
        const reviewOk = statusOf(reviewDoc) === 'accepted' || (review && review.required === false);
        if (!reviewOk) {
            addUnit('G8', 'review not accepted and review.required != false', 'review');
        }
        // G17은 이미 스테이징된 경로만 본다. working-tree 변경의 out-of-scope는
        // bouncer commit이 따로 막으며, 빈 스테이징은 통과(빈 커밋 방지는 명령 몫).
        const stagedFn = (deps && deps.stagedFiles) || defaultStagedFiles;
        const staged = stagedFn({ repoRoot });
        if (!staged || staged.ok !== true) {
            const reason = staged && staged.reason ? staged.reason : 'git-failed';
            failures.push({
                code: 'G17',
                message: `could not read staged files (${reason})`,
                file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
            });
            return;
        }
        const affectedPaths = tasksDoc && tasksDoc.data && tasksDoc.data.bouncer
            ? tasksDoc.data.bouncer.affected_paths
            : [];
        const allowed = makeAllowed({ affectedPaths, blueprintDir });
        const files = Array.isArray(staged.files) ? staged.files : [];
        const violations = files
            .filter((f) => !isRuntimeArtifact(f))
            .filter((f) => !allowed(f));
        if (violations.length) {
            failures.push({
                code: 'G17',
                message: `staged path outside affected_paths: ${violations.join(', ')}`,
                file: unitLeafRel(taskUnit, 'tasks', rels.tasks),
            });
        }
        return;
    }
    throw new Error(`unknown gate: ${gate}`);
}
module.exports = { checkGate };
