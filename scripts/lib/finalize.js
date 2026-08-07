// scripts/lib/finalize.js
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const { execFileSync } = require('node:child_process');
const { epicDirOf, toPosix } = require('./paths');
const { CONTEXT_ROOT } = require('./scaffold');
const { PROJECT_DISTILL } = require('./layout');
const { validateBlueprint, loadBlueprintDocs } = require('./validate');
const { clearCurrent, nextBlueprint } = require('./current');
function isUnder(file, entry) {
    const f = toPosix(file);
    const e = toPosix(entry);
    if (f === e)
        return true;
    const pref = e.endsWith('/') ? e : `${e}/`;
    return f.startsWith(pref);
}
// 빌드 산출물과 runtime state는 Bouncer 관리 scope가 아님: stage하지도
// 위반으로 보고하지도 않아 .gitignore가 없는 repo도 finalize를 막지 않음.
// `bouncer init`은 프로젝트가 무시해야 할 항목을 알려 주며, Bouncer는
// .gitignore를 직접 수정하지 않음.
// Execute checkout은 `<repo>/.worktrees/<BP-id>` 아래에 있음. 트리 전체를
// ignore하여 finalize가 중첩 worktree 파일을 scope 밖으로 보지 않게 함.
const RUNTIME_ARTIFACTS = ['node_modules/', 'graphify-out/', '.worktrees/'];
function isRuntimeArtifact(file) {
    const f = toPosix(file);
    return RUNTIME_ARTIFACTS.some((entry) => isUnder(f, entry));
}
function makeAllowed({ affectedPaths, blueprintDir }) {
    const bp = toPosix(blueprintDir);
    const epicDir = epicDirOf(bp);
    const paths = Array.isArray(affectedPaths) ? affectedPaths : [];
    return function allowed(file) {
        const f = toPosix(file);
        if (isUnder(f, `${bp}/`))
            return true;
        if (f === `${epicDir}/index.md`)
            return true;
        if (f === `${CONTEXT_ROOT}/index.md`)
            return true;
        // Finalize는 promotion으로 project Distill을 항상 갱신; 모든 blueprint의
        // affected_paths에 넣을 필요 없음.
        if (f === PROJECT_DISTILL)
            return true;
        return paths.some((p) => isUnder(f, p));
    };
}
// subject와 body는 프로젝트가 document field에 쓰는 commit convention을 따름;
// 구조만 Bouncer 소유. identifier와 path는 message에 넣지 않음 — blueprint
// 문서와 PR body에 있음.
// Subject: 대상 task title (없으면 blueprint title). Body: 배경·의도 2줄
// (`commit_intent`) 다음 수정 내용(verification title만 — tasks title은
// 이미 subject에 있음). taskUnit이 없으면 docs.verification 호환 필드.
// commit 경로(`bouncer commit`)가 이 빌더를 쓴다. finalize 마감 메시지는
// buildFinalizeCommitMessage — task title/verification bullet을 넣지 않는다.
function buildCommitMessage(docs, taskUnit) {
    const bp = docs.blueprintIndex.data;
    const bouncer = bp.bouncer || {};
    const type = bouncer.commit_type || 'feat';
    const taskTitle = taskUnit && taskUnit.tasks && taskUnit.tasks.data
        ? taskUnit.tasks.data.title
        : undefined;
    // 대상 묶음이 없거나 title이 비면 blueprint로 떨어뜨려 빈 subject를 만들지 않음.
    const subjectTitle = (typeof taskTitle === 'string' && taskTitle.trim())
        ? taskTitle.trim()
        : bp.title;
    const titleOf = (key) => {
        const fromUnit = taskUnit && taskUnit[key] && taskUnit[key].data
            ? taskUnit[key].data.title
            : undefined;
        if (typeof fromUnit === 'string' && fromUnit)
            return fromUnit;
        return docs[key] && docs[key].data.title ? docs[key].data.title : '';
    };
    // 정확히 2줄일 때만 유효. slice(0,2)로 앞만 남기면 3줄+ 작성 실수를 숨김.
    const normalizeIntent = (raw) => {
        if (!Array.isArray(raw))
            return null;
        const lines = raw
            .filter((s) => typeof s === 'string' && s.trim())
            .map((s) => String(s).trim());
        return lines.length === 2 ? lines : null;
    };
    const taskBouncer = taskUnit && taskUnit.tasks && taskUnit.tasks.data
        ? taskUnit.tasks.data.bouncer
        : undefined;
    // task → blueprint 순. 한 출처가 무효면 다음으로; 둘 다 무효면 intent 없음.
    const intent = normalizeIntent(taskBouncer && taskBouncer.commit_intent)
        || normalizeIntent(bouncer.commit_intent)
        || [];
    const what = [titleOf('verification')].filter(Boolean);
    const bodyLines = intent.length === 2
        ? [...intent, ...what]
        : what;
    const body = bodyLines.map((t) => `- ${t}`);
    const lines = [`${type}: ${subjectTitle}`];
    if (body.length)
        lines.push('', ...body);
    return lines.join('\n');
}
// finalize 마감 커밋: subject는 항상 blueprint title, body는 blueprint
// commit_intent 2줄뿐. task title·verification bullet을 넣으면 003이 이미
// 남긴 task 커밋과 메시지가 겹치고, Distill 승격분만 남는 마감 의미를 가린다.
function buildFinalizeCommitMessage(docs) {
    const bp = docs.blueprintIndex.data;
    const bouncer = bp.bouncer || {};
    const type = bouncer.commit_type || 'feat';
    const normalizeIntent = (raw) => {
        if (!Array.isArray(raw))
            return null;
        const lines = raw
            .filter((s) => typeof s === 'string' && s.trim())
            .map((s) => String(s).trim());
        return lines.length === 2 ? lines : null;
    };
    const intent = normalizeIntent(bouncer.commit_intent) || [];
    const body = intent.map((t) => `- ${t}`);
    const lines = [`${type}: ${bp.title}`];
    if (body.length)
        lines.push('', ...body);
    return lines.join('\n');
}
function realGit(repoRoot) {
    const run = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    const lines = (s) => s.split('\n').filter(Boolean);
    return {
        changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
        untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
        stage: (files) => { if (files.length)
            run(['add', '--', ...files]); },
        commit: (msg) => { run(['commit', '-m', msg]); },
    };
}
function finalize({ repoRoot, blueprintDir, yes = false, git, clearPointer = clearCurrent, next = nextBlueprint, }) {
    const gitApi = git || realGit(repoRoot);
    const v = validateBlueprint({ repoRoot, blueprintDir, gate: 'finalize' });
    if (!v.ok)
        return { ok: false, reason: 'validate', failures: v.failures };
    const { docs } = loadBlueprintDocs({ repoRoot, blueprintDir });
    const affectedPaths = docs.tasks && docs.tasks.data.bouncer
        ? docs.tasks.data.bouncer.affected_paths : [];
    const allowed = makeAllowed({ affectedPaths, blueprintDir });
    const changed = gitApi.changedFiles();
    const untracked = gitApi.untrackedFiles();
    const all = [...new Set([...changed, ...untracked])].filter((f) => !isRuntimeArtifact(f));
    const violations = all.filter((f) => !allowed(f));
    if (violations.length)
        return { ok: false, reason: 'out-of-scope', violations };
    // 마감 메시지는 blueprint 단위. resolveTaskUnit/task title은 쓰지 않는다.
    const commitMessage = buildFinalizeCommitMessage(docs);
    // next 후보 계산이 finalize를 깨면 안 됨: next()가 throw하면 빈 handoff
    // 형태로 뭉개 ok/exit는 commit 작업에만 묶임.
    const computeNext = () => {
        try {
            return next({ repoRoot, blueprintDir });
        }
        catch (_e) {
            return { next: null, remaining: [] };
        }
    };
    if (!yes) {
        return {
            ok: true, dryRun: true, staged: all, commitMessage, next: computeNext(),
        };
    }
    // 빈 커밋 금지: Distill 승격분이 없으면 stage/commit을 건너뛰고 포인터만 비운다.
    // task 커밋은 003 `bouncer commit`이 이미 끝냈다는 전제.
    if (all.length === 0) {
        const pointerCleared = clearPointer({ repoRoot });
        return {
            ok: true,
            committed: false,
            staged: [],
            commitMessage,
            pointerCleared,
            next: computeNext(),
        };
    }
    gitApi.stage(all);
    gitApi.commit(commitMessage);
    // blueprint는 끝남. pointer를 남기면 commit guard가 이후 모든 commit에
    // 이 blueprint의 affected_paths를 계속 강제함.
    const pointerCleared = clearPointer({ repoRoot });
    return {
        ok: true,
        committed: true,
        staged: all,
        commitMessage,
        pointerCleared,
        next: computeNext(),
    };
}
module.exports = {
    isUnder, isRuntimeArtifact, RUNTIME_ARTIFACTS, makeAllowed,
    buildCommitMessage, buildFinalizeCommitMessage, realGit, finalize,
};
