'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const paths = require("./paths");
const { toPosix } = paths;
const scope = require("./scope");
const { readCoordinatorLedger } = scope;
const finalizeMod = require("./finalize");
const { resolveCheckoutBranch } = finalizeMod;
const COMMIT_TYPE_RE = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?!?:/;
/**
 * 기본 git 실행기. 주입 exec와 같은 `{ status, stdout }`만 돌려
 * stderr 유무로 seam이 갈라지지 않게 한다.
 *
 * @param {string} cwd - git cwd
 * @param {string[]} args - `git` 뒤 argv
 * @returns {{ status: number, stdout: string }}
 */
function defaultExec(cwd, args) {
    const r = spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return {
        status: typeof r.status === 'number' ? r.status : 1,
        stdout: r.stdout || '',
    };
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
/**
 * 문자열 첫 글자만 대문자로 바꾼다. PR 제목의 MergeTarget·Type에 쓴다.
 *
 * @param {string} raw - 원문
 * @returns {string}
 */
function capitalizeFirst(raw) {
    if (!raw)
        return raw;
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}
/**
 * instant를 KST 달력의 YYMMDD로 접는다. 제목 접두 날짜는 UTC가 아니라
 * Asia/Seoul이어야 draft-pr 계약과 같다.
 *
 * @param {Date} now - 기준 시각
 * @returns {string} 여섯 자리 YYMMDD
 */
function yymmddKst(now) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (type) => {
        const part = parts.find((p) => p.type === type);
        return part ? part.value : '00';
    };
    return `${get('year').slice(-2)}${get('month')}${get('day')}`;
}
/**
 * GitHub owner/repo 한 칸이 blob URL에 안전한 identity인지 본다.
 * 빈 값·`.`·`..`·`/`·`\`·기타 경호 문자는 경로 탈출·호스트 혼동에 쓰이므로 거절한다.
 *
 * @param {string} segment - owner 또는 repo 후보
 * @returns {boolean}
 */
function isGithubIdentitySegment(segment) {
    if (!segment || segment === '.' || segment === '..')
        return false;
    if (segment.includes('/') || segment.includes('\\'))
        return false;
    // GitHub login/repo에 허용되는 문자만. `%2f` 같은 인코딩 우회도 여기서 막는다.
    return /^[A-Za-z0-9._-]+$/.test(segment);
}
/**
 * GitHub remote URL에서 owner/repo만 뽑는다. GitLab·repo 없는 SSH·빈 문자열·
 * `.`/`..`/비 identity 세그먼트는 null — links가 unsupported-host로 거절할 수
 * 있게 URL을 추측하지 않는다.
 *
 * @param {string} url - `git remote get-url origin` 결과
 * @returns {{ owner: string, repo: string } | null}
 */
function parseGithubRemote(url) {
    if (typeof url !== 'string' || !url.trim())
        return null;
    const raw = url.trim();
    const patterns = [
        /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
        /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
        /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    ];
    for (const re of patterns) {
        const m = re.exec(raw);
        if (!m)
            continue;
        const owner = m[1];
        const repo = m[2];
        if (!isGithubIdentitySegment(owner) || !isGithubIdentitySegment(repo)) {
            return null;
        }
        return { owner, repo };
    }
    return null;
}
/**
 * conventional commit subject에서 type만 고른다. scope·breaking 표기는 버리고
 * 제목 접두의 Feat/Fix 집합에 넣는다.
 *
 * @param {string} subject - 커밋 제목 한 줄
 * @returns {string | null} 소문자 type 또는 매칭 실패 null
 */
function commitTypeOf(subject) {
    const m = COMMIT_TYPE_RE.exec(String(subject || '').trim());
    return m ? m[1].toLowerCase() : null;
}
/**
 * digest 커밋 제목에서 type을 첫 등장 순으로 모은다. 없으면 blueprint
 * commit_type 하나로 폴백 — 제목 접두의 `[Type]`이 비지 않게 한다.
 *
 * @param {Array<{ subject?: string }>} commits - digest.commits
 * @param {string} fallback - blueprint.commit_type
 * @returns {string[]} 소문자 type 목록(중복 제거, 등장 순)
 */
function collectCommitTypes(commits, fallback) {
    const seen = new Set();
    const ordered = [];
    for (const entry of Array.isArray(commits) ? commits : []) {
        const type = commitTypeOf(typeof entry.subject === 'string' ? entry.subject : '');
        if (!type || seen.has(type))
            continue;
        seen.add(type);
        ordered.push(type);
    }
    if (ordered.length === 0) {
        const fb = typeof fallback === 'string' && fallback.trim()
            ? fallback.trim().toLowerCase()
            : 'feat';
        return [fb];
    }
    return ordered;
}
/**
 * task verification을 `command — passed|failed` 행으로 접는다.
 * 같은 명령이어도 task별 결과를 한 줄씩 남겨 draft-pr의 확인 방법이
 * 어느 task에서 실패했는지 보이게 한다.
 *
 * @param {unknown[]} tasks - digest.tasks
 * @returns {string[]}
 */
function buildVerificationLines(tasks) {
    const lines = [];
    for (const entry of Array.isArray(tasks) ? tasks : []) {
        const task = asRecord(entry);
        const verification = asRecord(task.verification);
        if (!task.verification || typeof verification.command !== 'string' || !verification.command) {
            continue;
        }
        const passed = verification.status === 'passed';
        lines.push(`${verification.command} — ${passed ? 'passed' : 'failed'}`);
    }
    return lines;
}
/**
 * out_of_scope·accepted/deferred finding note·unverified를 리뷰 포인트 문자열로
 * 모은다. Epic/Quiz/원문 로그는 넣지 않는다 — Constraints의 PR 본문 금지 목록.
 * unverified.task는 digest stable_id(EPIC-…/BP-…/TASK-…)라 본문에 넣지 않는다.
 *
 * @param {object} digest
 * @param {string[]} digest.out_of_scope
 * @param {unknown[]} digest.tasks
 * @param {unknown[]} digest.unverified
 * @returns {string[]}
 */
function buildReviewPoints(digest) {
    const points = [];
    const outOfScope = Array.isArray(digest.out_of_scope) ? digest.out_of_scope : [];
    for (const item of outOfScope) {
        if (typeof item === 'string' && item)
            points.push(item);
    }
    const tasks = Array.isArray(digest.tasks) ? digest.tasks : [];
    for (const entry of tasks) {
        const review = asRecord(asRecord(entry).review);
        const findings = Array.isArray(review.findings) ? review.findings : [];
        for (const raw of findings) {
            const finding = asRecord(raw);
            if (finding.status !== 'accepted' && finding.status !== 'deferred')
                continue;
            if (typeof finding.note === 'string' && finding.note) {
                points.push(finding.note);
            }
            else if (typeof finding.id === 'string' && finding.id) {
                // F3 accepted: note 없을 때 finding.id 폴백은 digest 진단값이라 유지한다.
                points.push(finding.id);
            }
        }
    }
    const unverified = Array.isArray(digest.unverified) ? digest.unverified : [];
    for (const raw of unverified) {
        const row = asRecord(raw);
        const kind = typeof row.kind === 'string' ? row.kind : '';
        if (!kind)
            continue;
        if (typeof row.detail === 'string' && row.detail) {
            points.push(`${kind}: ${row.detail}`);
        }
        else if (typeof row.path === 'string' && row.path) {
            points.push(`${kind}: ${row.path}`);
        }
        else {
            // task stable_id는 고의로 생략 — EPIC-/BP- 형태가 review_points로 새지 않게.
            points.push(kind);
        }
    }
    return points;
}
/**
 * finalize digest에서 PR 제목 접두·base/head·결정적 본문 절을 만든다.
 * background/changes/flow는 Explain 작성 전이므로 null로 두고, related는
 * push 뒤 links가 채우도록 빈 배열로 둔다.
 *
 * @param {object} digest - prepareFinalizeDigest 성공 payload(또는 동형 fixture)
 * @param {object} opts
 * @param {Date} opts.now - 제목 날짜(KST). 테스트가 고정한다
 * @param {unknown} opts.config - `.bouncer/config.json`. `pr.draft`만 읽는다
 * @returns {PrDraft}
 */
function buildPrDraft(digest, opts) {
    const d = asRecord(digest);
    const git = asRecord(d.git);
    const blueprint = asRecord(d.blueprint);
    const config = asRecord(opts.config);
    const prCfg = asRecord(config.pr);
    const prBase = typeof git.pr_base === 'string' && git.pr_base ? git.pr_base : 'main';
    const head = typeof git.branch === 'string' ? git.branch : null;
    const commitType = typeof blueprint.commit_type === 'string' ? blueprint.commit_type : 'feat';
    const commits = Array.isArray(d.commits) ? d.commits : [];
    const types = collectCommitTypes(commits, commitType)
        .map((t) => capitalizeFirst(t))
        .join('/');
    // draft 기본 true — 키가 없거나 비불리언이면 skill이 실수로 공개 PR을 만들지 않게.
    const draft = typeof prCfg.draft === 'boolean' ? prCfg.draft : true;
    return {
        title_prefix: `[${yymmddKst(opts.now)}] (→ ${capitalizeFirst(prBase)}) [${types}]`,
        base: prBase,
        head,
        draft,
        sections: {
            related: [],
            background: null,
            changes: null,
            flow: null,
            review_points: buildReviewPoints({
                out_of_scope: d.out_of_scope,
                tasks: d.tasks,
                unverified: d.unverified,
            }),
            verification: buildVerificationLines(Array.isArray(d.tasks) ? d.tasks : []),
        },
    };
}
/**
 * links가 쓸 branch를 고른다. 원장 integrationBranch가 있으면 그것이 정본이고,
 * 없으면 호출 checkout의 실제 branch다(brief: resolveCheckoutBranch(repoRoot)).
 *
 * @param {string} repoRoot - 호출 checkout
 * @param {string} blueprintDir - blueprint 상대 경로
 * @returns {{ branch: string | null, checkoutRoot: string }}
 */
function resolveLinksBranch(repoRoot, blueprintDir) {
    const bp = toPosix(blueprintDir);
    const ledgerRead = readCoordinatorLedger({ repoRoot, blueprint: bp });
    // drive면 integration worktree의 HEAD·remote tracking이 finalize checkout이다.
    const checkoutRoot = ledgerRead.ok
        && typeof ledgerRead.integrationPath === 'string'
        && ledgerRead.integrationPath
        && fs.existsSync(ledgerRead.integrationPath)
        ? ledgerRead.integrationPath
        : repoRoot;
    if (ledgerRead.ok && ledgerRead.ledger) {
        const ledger = asRecord(ledgerRead.ledger);
        if (typeof ledger.integrationBranch === 'string' && ledger.integrationBranch.trim()) {
            return { branch: ledger.integrationBranch.trim(), checkoutRoot };
        }
    }
    return { branch: resolveCheckoutBranch(repoRoot), checkoutRoot };
}
/**
 * links용 blueprintDir이 저장소 상대이며 `..`로 탈출하지 않는지 본다.
 * absolute/`..`를 blob URL에 넣기 전에 막아 404·경로 혼동 URL을 만들지 않는다.
 *
 * @param {unknown} blueprintDir - 호출자 `--blueprint` 값
 * @returns {boolean} true면 거절 대상
 */
function blueprintDirEscapesRepo(blueprintDir) {
    if (typeof blueprintDir !== 'string' || !blueprintDir.trim())
        return true;
    const raw = blueprintDir.trim();
    const posix = toPosix(raw);
    // path.isAbsolute는 플랫폼만 본다. POSIX 절대·드라이브 문자도 저장소 밖으로 취급.
    if (path.isAbsolute(raw) || path.posix.isAbsolute(posix) || /^[A-Za-z]:\//.test(posix)) {
        return true;
    }
    if (posix.split('/').includes('..'))
        return true;
    return false;
}
/**
 * GitHub blob URL을 만든다. owner/repo/ref/파일 경로의 각 세그먼트를
 * percent-encode해 `#`·공백 등이 fragment·쿼리로 잘리지 않게 한다.
 *
 * @param {string} owner - GitHub owner
 * @param {string} repo - GitHub repo
 * @param {string} ref - branch 이름 또는 commit SHA
 * @param {string} fileRel - repo-relative posix 경로
 * @returns {string}
 */
function githubBlobUrl(owner, repo, ref, fileRel) {
    const encodeSegs = (value) => value
        .split('/')
        .filter((seg) => seg.length > 0)
        .map((seg) => encodeURIComponent(seg))
        .join('/');
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeSegs(ref)}/${encodeSegs(fileRel)}`;
}
/**
 * push된 GitHub head에서만 Explain URL 후보를 반환한다.
 * 네트워크(ls-remote/fetch)를 쓰지 않고 로컬 remote URL·tracking ref만 본다.
 * 실패해도 ok:true — skill이 reason만으로 링크를 생략한다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 checkout(보통 main)
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {(args: string[]) => { status: number, stdout: string }} [opts.exec] - git seam
 * @returns {ExplainLinksResult}
 */
function resolveExplainLinks({ repoRoot, blueprintDir, exec, }) {
    const empty = (branch, reason) => ({
        ok: true,
        branch,
        links: [],
        reason,
    });
    // 0. blueprintDir 탈출 거절 — explainRel을 만들기 전에 막아 URL에 `..`가 안 실리게.
    if (blueprintDirEscapesRepo(blueprintDir)) {
        return empty(null, 'invalid-blueprint');
    }
    // 1. branch — task 문서 유무와 무관. 원장 또는 checkout.
    const { branch, checkoutRoot } = resolveLinksBranch(repoRoot, blueprintDir);
    if (!branch)
        return empty(null, 'branch-unresolved');
    const run = typeof exec === 'function'
        ? exec
        : (args) => defaultExec(checkoutRoot, args);
    // 2. origin URL — 없으면 추측하지 않는다.
    const remote = run(['remote', 'get-url', 'origin']);
    if (remote.status !== 0 || !remote.stdout.trim()) {
        return empty(branch, 'no-remote');
    }
    // 3. GitHub만. 그 외 host는 URL을 만들지 않는다.
    const parsed = parseGithubRemote(remote.stdout.trim());
    if (!parsed)
        return empty(branch, 'unsupported-host');
    // 4. tracking ref가 있고 HEAD가 그 ref의 조상(또는 같음)이어야 push된 것으로 본다.
    const remoteRef = `refs/remotes/origin/${branch}`;
    const verified = run(['rev-parse', '--verify', remoteRef]);
    if (verified.status !== 0 || !verified.stdout.trim()) {
        return empty(branch, 'head-not-pushed');
    }
    const ancestor = run(['merge-base', '--is-ancestor', 'HEAD', remoteRef]);
    if (ancestor.status !== 0) {
        return empty(branch, 'head-not-pushed');
    }
    // 5. HEAD 트리에 explain.md가 추적돼 있어야 404 링크를 만들지 않는다.
    const explainRel = toPosix(path.posix.join(toPosix(blueprintDir), 'explain.md'));
    // join 후에도 `..`가 남으면(정규화 전 입력 우회) URL을 만들지 않는다.
    if (explainRel.split('/').includes('..') || path.posix.isAbsolute(explainRel)) {
        return empty(branch, 'invalid-blueprint');
    }
    const tracked = run(['cat-file', '-e', `HEAD:${explainRel}`]);
    if (tracked.status !== 0) {
        return empty(branch, 'explain-missing');
    }
    const headResult = run(['rev-parse', 'HEAD']);
    if (headResult.status !== 0 || !headResult.stdout.trim()) {
        return empty(branch, 'head-not-pushed');
    }
    const headSha = headResult.stdout.trim();
    return {
        ok: true,
        branch,
        links: [
            { kind: 'branch', url: githubBlobUrl(parsed.owner, parsed.repo, branch, explainRel) },
            { kind: 'commit', url: githubBlobUrl(parsed.owner, parsed.repo, headSha, explainRel) },
        ],
        reason: null,
    };
}
module.exports = { buildPrDraft, resolveExplainLinks, parseGithubRemote };
