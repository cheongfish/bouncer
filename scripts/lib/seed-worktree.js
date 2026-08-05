// scripts/lib/seed-worktree.js
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { epicDirOf, toPosix } = require('./paths');
const { CONTEXT_ROOT } = require('./layout');
const { isUnder } = require('./finalize');
// plan 워크플로에는 commit 단계가 없으므로 epic/blueprint 문서는 base working tree에만
// 존재합니다. `git worktree add`는 커밋된 HEAD를 checkout하므로 execute worktree는
// 구현에 필요한 brief 없이 시작합니다. 이 모듈은 plan context 문서만 정확히 옮기고
// base를 git이 기록한 상태로 되돌립니다.
//
// 이동 집합은 finalize.makeAllowed가 context 문서에 기본으로 허용하는 경계와
// 의도적으로 같습니다 — blueprint 트리, epic index, context index — project Distill은
// 제외합니다. worktree가 가져가면 안 되는 base 전역 파일입니다. affected_paths 아래
// 코드와 관련 없는 로컬 변경(config, graph output)은 그대로 둡니다.
function makeIsTarget({ blueprintDir }) {
    const bp = toPosix(blueprintDir);
    const epicIndex = `${epicDirOf(bp)}/index.md`;
    const contextIndex = `${CONTEXT_ROOT}/index.md`;
    return function isTarget(file) {
        const f = toPosix(file);
        if (isUnder(f, `${bp}/`))
            return true;
        return f === epicIndex || f === contextIndex;
    };
}
function realGit(repoRoot) {
    const run = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    const lines = (s) => s.split('\n').filter(Boolean);
    return {
        // `diff HEAD`는 staged 변경도 보고하므로, agent가 `git add`한 문서는
        // untracked가 아니라 여기서 분류됩니다.
        changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
        untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
        existsInHead: (file) => {
            try {
                // 경로가 없는 것은 모든 새 plan 문서에서 예상되는 답이므로,
                // git의 "디스크에는 있지만 HEAD에는 없음" 메시지는 여기서 오류가 아닙니다.
                execFileSync('git', ['cat-file', '-e', `HEAD:${file}`], {
                    cwd: repoRoot,
                    stdio: 'ignore',
                });
                return true;
            }
            catch {
                return false;
            }
        },
        readHead: (file) => {
            try {
                // `--filters`는 working-tree filter(autocrlf, .gitattributes text=auto)를
                // 적용하므로 checkout이 쓴 바이트와 동일하게 비교됩니다. raw `git show`는
                // CRLF worktree를 모두 충돌로 읽습니다.
                return execFileSync('git', ['cat-file', '--filters', `HEAD:${file}`], {
                    cwd: repoRoot,
                    stdio: ['ignore', 'pipe', 'ignore'],
                });
            }
            catch {
                return null;
            }
        },
        // `git checkout -- <path>`는 index에서 복원하는데, agent가 staged하면
        // index에 dirty blob이 남습니다. HEAD를 지정하면 index와 working tree를
        // 함께 되돌려 staged ghost가 남지 않습니다.
        restore: (file) => { run(['checkout', 'HEAD', '--', file]); },
        unstage: (file) => { run(['rm', '--cached', '--quiet', '--', file]); },
    };
}
// 파일을 제거하면 scaffold가 만든 디렉터리 트리가 비울 수 있습니다. Git은
// 디렉터리를 추적하지 않으므로 빈 잔여물은 `git status`에는 보이지 않지만
// 다음 planning 세션에는 보입니다. 무언가 남을 때까지 위로 prune합니다.
function pruneEmptyDirs(repoRoot, rel) {
    let dir = path.dirname(path.join(repoRoot, rel));
    const stop = path.resolve(repoRoot);
    while (path.resolve(dir) !== stop && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
    }
}
function seedWorktree({ repoRoot, blueprintDir, worktreePath, git, }) {
    const gitApi = git || realGit(repoRoot);
    const isTarget = makeIsTarget({ blueprintDir });
    const changed = gitApi.changedFiles();
    const untracked = gitApi.untrackedFiles();
    const changedSet = new Set(changed);
    const targets = [...new Set([...changed, ...untracked])].filter(isTarget).sort();
    if (!targets.length)
        return { ok: true, moved: [], restored: [] };
    if (!fs.existsSync(worktreePath) || !fs.statSync(worktreePath).isDirectory()) {
        return { ok: false, reason: 'missing-worktree', worktreePath };
    }
    // Phase 1 — 복사 후 확인. `git checkout --`와 `git rm --cached`는 되돌릴 수
    // 없으므로, 모든 target이 worktree에 동일한 바이트로 존재하는 것이 확인될 때까지
    // base는 건드리지 않습니다. 거기서 다른 파일이면 이전 실행이 중단됐거나
    // 수동 편집입니다. 덮어쓰지 말고 중단합니다.
    const conflicts = [];
    const pending = [];
    for (const rel of targets) {
        const src = path.join(repoRoot, rel);
        // `git diff HEAD`는 삭제도 나열합니다. 옮길 것은 없지만 base는 git에
        // restore를 빚므로 복사 없이 phase 2용으로 표시합니다.
        if (!fs.existsSync(src)) {
            pending.push({ rel, write: false, absent: true });
            continue;
        }
        const content = fs.readFileSync(src);
        const dst = path.join(worktreePath, rel);
        if (!fs.existsSync(dst)) {
            pending.push({ rel, write: true, dst, content });
        }
        else if (fs.readFileSync(dst).equals(content)) {
            pending.push({ rel, write: false });
        }
        else {
            // worktree는 HEAD에서 checkout됐으므로 추적된 target은 모두 HEAD blob으로
            // 이미 존재합니다. 그것이 pristine checkout이지 다른 사람의 작업이 아닙니다.
            // 덮어쓰는 것이 "dirty 버전을 옮긴다"는 뜻입니다. base도 HEAD도 아닌
            // 내용만 진짜 충돌입니다 — 중단된 이전 실행이나 수동 편집.
            const head = gitApi.readHead(rel);
            if (head && fs.readFileSync(dst).equals(head))
                pending.push({ rel, write: true, dst, content });
            else
                conflicts.push(rel);
        }
    }
    if (conflicts.length)
        return { ok: false, reason: 'conflict', conflicts };
    try {
        for (const item of pending) {
            if (!item.write)
                continue;
            fs.mkdirSync(path.dirname(item.dst), { recursive: true });
            fs.writeFileSync(item.dst, item.content);
        }
    }
    catch (error) {
        return { ok: false, reason: 'copy-failed', message: error.message };
    }
    // Phase 2 — base를 git이 기록한 상태로 되돌립니다. HEAD 소속 여부가 동사를
    // 고릅니다 — staged/unstaged 구분만으로는 부족합니다: `git checkout --`는 HEAD가
    // 아는 경로에만 동작하고, staged 새 파일에는 HEAD blob이 없습니다.
    // `moved`는 worktree가 이제 보유하는 모든 target을 나열합니다 — 이미 바이트
    // 동일하게 있던 것도 포함 — 호출자가 brief를 읽을 수 있는지 확인하는 용도이지
    // 파일 쓰기 횟수를 세는 용도가 아닙니다.
    const moved = [];
    const restored = [];
    for (const { rel, absent } of pending) {
        if (gitApi.existsInHead(rel)) {
            gitApi.restore(rel);
            restored.push(rel);
        }
        else {
            if (changedSet.has(rel))
                gitApi.unstage(rel);
            fs.rmSync(path.join(repoRoot, rel), { force: true });
            pruneEmptyDirs(repoRoot, rel);
        }
        // base에서 삭제된 경로는 복사되지 않았으므로 moved가 아니라 restored입니다.
        if (!absent)
            moved.push(rel);
    }
    return { ok: true, moved, restored };
}
module.exports = { makeIsTarget, realGit, seedWorktree };
