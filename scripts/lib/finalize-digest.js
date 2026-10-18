'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const frontmatter = require("./frontmatter");
const execution_contracts_1 = require("./execution-contracts");
const { readDoc } = frontmatter;
const paths = require("./paths");
const { toPosix } = paths;
const templates = require("./templates");
const { parseIntentBody } = templates;
const validateSections = require("./validate-sections");
const { parseTasksSections, parseSections, pathsOverlap } = validateSections;
const schema = require("./schema");
const { executionKindOf } = schema;
const commitSha = require("./commit-sha");
const { normalizeCommitSha, buildStableProvenance } = commitSha;
const comprehension = require("./comprehension");
const { computeDiffSha } = comprehension;
const configMod = require("./config");
const { readConfig } = configMod;
const scope = require("./scope");
const { readCoordinatorLedger } = scope;
const finalizeMod = require("./finalize");
const { buildCoordinatorProvenance, resolveCheckoutBranch, collectMustFixWarnings } = finalizeMod;
const tasksDocs = require("./tasks-docs");
const { listTasksDocs } = tasksDocs;
const currentMod = require("./current");
const { readCurrent } = currentMod;
const taskCommits = require("./task-commits");
const { resolveTaskCommits } = taskCommits;
const finalizePr = require("./finalize-pr");
const { buildPrDraft } = finalizePr;
const OUT_OF_SCOPE_DEFS = [
    { key: 'outOfScope', re: /^##\s+Out\s+of\s+scope\s*$/i },
];
// 줄 머리 고정 — 들여쓰기·탭·호출 자리의 function/const를 심볼로 쓰지 않는다.
// 접두(export/default/async)는 조합 가능하되 줄 시작에서만 허용한다.
const SYMBOL_FN_RE = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function(?:\s*\*\s*|\s+)|class\s+)([A-Za-z_$][\w$]*)/;
const SYMBOL_VAR_RE = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/;
const SHORT_SHA_NUL_RE = /([0-9a-f]{7,40})\0/gi;
const PER_FILE_SYMBOL_CAP = 10;
const TOTAL_SYMBOL_CAP = 60;
const COMMIT_LIST_CAP = 50;
const DIFF_PER_FILE_CAP = 30;
const CONTEXT_EXCLUDED = '.bouncer/context/';
/**
 * 기본 git 실행기. 주입 exec와 같은 모양만 돌려 stderr 유무로 seam이
 * 갈라지지 않게 한다.
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
function stringList(value) {
    return (Array.isArray(value) ? value : [])
        .filter((entry) => typeof entry === 'string' && entry !== '');
}
/**
 * PR 대상 브랜치를 config 다음 origin/HEAD에서 고른다.
 * `main`/`develop`/현재 HEAD로 추측하지 않는다 — 기본 브랜치가 다른 저장소에서
 * draft PR이 잘못된 base로 열리기 때문이다. 후보가 없으면 digest는 ok를 유지하고
 * null을 넘겨 draft-pr이 사용자에게 묻게 한다.
 *
 * @param {string} repoRoot - config를 읽을 checkout
 * @param {(args: string[]) => { status: number, stdout: string }} run - prepare가
 *   만든 git seam. 탐지 호출이 이 함수를 거쳐야 exec stub가 가로챌 수 있다
 * @returns {string | null} 비어 있지 않은 브랜치 이름, 없으면 null
 */
function resolvePrBase(repoRoot, run) {
    const config = readConfig(repoRoot);
    const root = asRecord(config);
    const pr = asRecord(root.pr);
    // 1. 명시 설정이 있으면 git을 보지 않는다. 빈 문자열·공백·비문자열은 다음 후보.
    if (typeof pr.base === 'string' && pr.base.trim())
        return pr.base.trim();
    if (typeof root.base_branch === 'string' && root.base_branch.trim()) {
        return root.base_branch.trim();
    }
    // 2. origin/HEAD는 worktree끼리 refs/remotes를 공유하므로 linked checkout에서도
    //    같은 답이 나온다. status·접두사 검사는 throw 없이 null로 접는다.
    const result = run(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
    if (result.status !== 0)
        return null;
    const ref = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!ref.startsWith('origin/'))
        return null;
    const name = ref.slice('origin/'.length);
    return name || null;
}
/**
 * blueprint `## Out of scope` bullet만 뽑아 digest에 싣는다.
 * Intent와 달리 없어도 실패하지 않는다 — 비어 있으면 빈 배열이다.
 * 공유 `parseSections`는 이 정의에 다음 제목이 없어 뒤 절까지 이어지므로,
 * 절 끝은 여기서 첫 `## ` 제목 앞에서 끊는다(공유 파서 의미는 그대로).
 *
 * @param {string | null | undefined} body - blueprint index 본문
 * @returns {string[]} bullet 텍스트
 */
function parseOutOfScope(body) {
    if (typeof body !== 'string' || !body)
        return [];
    const section = parseSections(body, OUT_OF_SCOPE_DEFS).outOfScope;
    if (typeof section !== 'string' || !section.trim())
        return [];
    // 1. 다음 ## 제목(또는 EOF)까지만 — One-commit justification·Documents가 섞이지 않게.
    const lines = section.split('\n');
    const nextHeading = lines.findIndex((line) => /^##\s/.test(line));
    const scoped = nextHeading === -1 ? lines : lines.slice(0, nextHeading);
    return scoped
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean);
}
/**
 * pointer·원장에서 digest 범위의 base를 고른다.
 * drive는 원장 `base`가 정본이고, standalone은 같은 blueprint pointer의 base다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 cwd(보통 main checkout)
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {string | null} opts.ledgerBase - 원장 base. 없으면 null
 * @returns {string | null} 해석된 base. 없으면 null → no-base
 */
function resolveDigestBase({ repoRoot, blueprintDir, ledgerBase, }) {
    if (typeof ledgerBase === 'string' && ledgerBase.trim())
        return ledgerBase.trim();
    try {
        const pointer = readCurrent({ repoRoot });
        if (pointer
            && typeof pointer.blueprint === 'string'
            && toPosix(pointer.blueprint) === toPosix(blueprintDir)
            && typeof pointer.base === 'string'
            && pointer.base.trim()) {
            return pointer.base.trim();
        }
    }
    catch (_error) {
        // CURRENT_AMBIGUOUS 등은 base 부재와 같다 — digest는 pointer를 고치지 않는다.
    }
    return null;
}
/**
 * `git log --format=%h%x00%s` 출력을 최신순 목록으로 접는다.
 * `%H%x00%B`와 같이 커밋 경계 NUL이 없어 짧은 SHA\0 앵커로 자른다.
 *
 * @param {string} stdout - git log 원문
 * @returns {Array<{ sha8: string, subject: string }>}
 */
function parseCommitSubjects(stdout) {
    const starts = [];
    SHORT_SHA_NUL_RE.lastIndex = 0;
    let match;
    while ((match = SHORT_SHA_NUL_RE.exec(stdout)) !== null) {
        starts.push({
            sha: match[1].toLowerCase(),
            bodyStart: match.index + match[0].length,
            shaStart: match.index,
        });
    }
    const out = [];
    for (let i = 0; i < starts.length; i += 1) {
        const end = i + 1 < starts.length ? starts[i + 1].shaStart : stdout.length;
        const subject = stdout.slice(starts[i].bodyStart, end).replace(/^\n|\n$/g, '').trim();
        const sha8 = normalizeCommitSha(starts[i].sha) || starts[i].sha.slice(0, 8);
        out.push({ sha8, subject });
    }
    return out;
}
/**
 * unified diff에서 파일별 최상위 선언 이름을 뽑는다.
 * hunk header 뒤 문맥과 `+` 줄을 함께 본다 — 새 파일 hunk는 header 문맥이
 * 비어 `function greet()`가 `+` 줄에만 나타나기 때문이다.
 * 검사 대상은 줄 머리 고정 규칙만: `+` 줄은 `+`를 뗀 나머지, hunk 문맥은
 * 앞 공백 한 칸을 뗀 나머지. 들여쓰기·탭 시작 줄은 매칭되지 않는다.
 *
 * @param {string} diffText - `git diff -U0` 원문
 * @returns {Array<{ path: string, names: string[] }>} 파일당 ≤10, 전체 ≤60
 */
function extractSymbols(diffText) {
    const byPath = new Map();
    let currentPath = null;
    let total = 0;
    const pushName = (relPath, name) => {
        if (total >= TOTAL_SYMBOL_CAP)
            return;
        let list = byPath.get(relPath);
        if (!list) {
            list = [];
            byPath.set(relPath, list);
        }
        if (list.length >= PER_FILE_SYMBOL_CAP)
            return;
        if (list.includes(name))
            return;
        list.push(name);
        total += 1;
    };
    // 줄 단위로만 적용 — 예전 전역 \b 스캔은 `  let i = 0`도 잡았다.
    const scanLine = (relPath, text) => {
        const fn = SYMBOL_FN_RE.exec(text);
        if (fn?.[1]) {
            pushName(relPath, fn[1]);
            return;
        }
        const v = SYMBOL_VAR_RE.exec(text);
        if (v?.[1])
            pushName(relPath, v[1]);
    };
    for (const rawLine of diffText.split('\n')) {
        const line = rawLine;
        const gitPath = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
        if (gitPath) {
            currentPath = toPosix(gitPath[2]);
            continue;
        }
        if (!currentPath || currentPath.startsWith(CONTEXT_EXCLUDED))
            continue;
        const hunk = /^@@[^@]*@@(.*)$/.exec(line);
        if (hunk) {
            // unified hunk 문맥은 앞 공백 한 칸 관례 — 줄 머리 고정이 들여쓰기로 오인하지 않게.
            const ctx = hunk[1] || '';
            scanLine(currentPath, ctx.startsWith(' ') ? ctx.slice(1) : ctx);
            continue;
        }
        // 새 파일·순수 추가는 header 문맥이 비어 + 줄만 식별자를 담는다.
        if (line.startsWith('+') && !line.startsWith('+++')) {
            scanLine(currentPath, line.slice(1));
        }
    }
    return [...byPath.entries()].map(([p, names]) => ({ path: p, names }));
}
/**
 * `git diff --numstat base..head`로 diff 통계 요약을 만든다.
 * explain-diff가 전체 diff 대신 이 요약으로 질문 대상 파일을 고르게 하는 입력이다.
 * 읽기 전용이며 실패해도 throw하지 않는다.
 *
 * @param {GitExec} exec - `git` 뒤 argv seam
 * @param {string} base - 범위 시작 ref
 * @param {string} head - 범위 끝 ref
 * @returns {DiffSummary | null} 합계는 전체 파일 기준, per_file은 변경 줄 수
 *   내림차순 최대 30개(바이너리는 `-`를 0/0으로 접는다). git 실패면 null
 */
function collectDiffSummary(exec, base, head) {
    // --no-renames: 이름 변경 행(`old => new`·3필드 NUL 레코드)을 없애 삭제+추가로 접는다.
    // -z: 경로를 C-quote(\\355...)하지 않고 NUL로 구분해 비ASCII 경로를 원문 그대로 받는다.
    const result = exec(['diff', '--numstat', '--no-renames', '-z', `${base}..${head}`]);
    if (result.status !== 0)
        return null;
    const rows = [];
    let insertions = 0;
    let deletions = 0;
    for (const record of result.stdout.split('\0')) {
        if (!record.trim())
            continue;
        const parts = record.split('\t');
        if (parts.length < 3)
            continue;
        // 계획 문서(.bouncer/context/)는 changed_paths·extractSymbols와 같은 규칙으로 제외해
        // diff.files가 changed_paths와 맞고 소스 파일이 per_file에서 밀리지 않게 한다.
        const rowPath = toPosix(parts.slice(2).join('\t'));
        if (rowPath.startsWith(CONTEXT_EXCLUDED))
            continue;
        // 바이너리 파일은 두 열이 '-'라 숫자가 아니다 — 0으로 접는다.
        const added = /^\d+$/.test(parts[0]) ? Number(parts[0]) : 0;
        const deleted = /^\d+$/.test(parts[1]) ? Number(parts[1]) : 0;
        insertions += added;
        deletions += deleted;
        rows.push({ path: rowPath, added, deleted });
    }
    // sort는 안정 정렬이라 동률은 git 출력(경로) 순서를 유지한다.
    const perFile = rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => (b.row.added + b.row.deleted) - (a.row.added + a.row.deleted) || a.index - b.index)
        .slice(0, DIFF_PER_FILE_CAP)
        .map((entry) => entry.row);
    return { files: rows.length, insertions, deletions, per_file: perFile };
}
/**
 * blueprint 루트 review.md에서 라운드 수와 마지막 라운드의 target digest를 읽는다.
 * 파일 부재·파싱 실패는 리뷰 기록 없음과 같아 null이다(digest는 throw하지 않는다).
 *
 * @param {string} absPath - 루트 review.md 절대 경로
 * @param {string} relPath - digest에 싣는 저장소 상대 경로
 * @returns {{ path: string, rounds: number, target_digest: string | null } | null}
 */
function readReviewEvidence(absPath, relPath) {
    if (!fs.existsSync(absPath))
        return null;
    try {
        const { data } = readDoc(absPath);
        const review = asRecord(asRecord(asRecord(data).bouncer).review);
        const rounds = Array.isArray(review.rounds) ? review.rounds : [];
        const last = asRecord(rounds[rounds.length - 1]);
        // 라운드 digest는 target.digest가 정본이고 perspectives[].target_digest는 같은 값이다.
        const perspective = asRecord(Array.isArray(last.perspectives) ? last.perspectives[0] : null);
        const candidates = [last.target_digest, asRecord(last.target).digest, perspective.target_digest];
        const digest = candidates.find((v) => typeof v === 'string' && v !== '');
        return { path: relPath, rounds: rounds.length, target_digest: digest ?? null };
    }
    catch (_error) {
        // YAML/frontmatter 파싱 실패만 흡수한다 — 읽을 수 없는 리뷰는 기록 없음과 같다.
        return null;
    }
}
/**
 * verification.md frontmatter를 digest 요약으로 접는다.
 * 원문 로그는 싣지 않는다 — status·command·exit_code·evidence_id·reused만.
 *
 * @param {string} absPath - verification.md 절대 경로
 * @returns {TaskDigest['verification']}
 */
function readVerification(absPath) {
    if (!fs.existsSync(absPath))
        return null;
    try {
        const { data } = readDoc(absPath);
        const bouncer = asRecord(asRecord(data).bouncer);
        const meta = asRecord(bouncer.verification);
        return {
            status: typeof bouncer.status === 'string' ? bouncer.status : 'unknown',
            command: typeof meta.command === 'string' ? meta.command : null,
            exit_code: typeof meta.exit_code === 'number' ? meta.exit_code : null,
            evidence_id: typeof meta.evidence_id === 'string' ? meta.evidence_id : null,
            reused: typeof meta.reused === 'boolean' ? meta.reused : null,
        };
    }
    catch (_error) {
        // 파싱 실패는 증적 없슴과 같다 — digest가 문서 오류로 throw하지 않는다.
        return null;
    }
}
/**
 * review.md frontmatter의 required·findings만 남긴다.
 * verification task는 review leaf가 없어 null이다.
 *
 * @param {string | null} absPath - review.md 절대 경로. 없으면 null
 * @returns {TaskDigest['review']}
 */
function readReview(absPath) {
    if (!absPath || !fs.existsSync(absPath))
        return null;
    try {
        const { data } = readDoc(absPath);
        const bouncer = asRecord(asRecord(data).bouncer);
        const review = asRecord(bouncer.review);
        const findingsRaw = Array.isArray(review.findings) ? review.findings : [];
        const findings = [];
        for (const entry of findingsRaw) {
            const row = asRecord(entry);
            if (typeof row.id !== 'string' || !row.id)
                continue;
            const finding = {
                id: row.id,
                severity: typeof row.severity === 'string' ? row.severity : 'nit',
                status: typeof row.status === 'string' ? row.status : 'resolved',
            };
            if (typeof row.note === 'string' && row.note)
                finding.note = row.note;
            // 미해결 must_fix 경고는 이 값으로만 판정한다. 없을 때 severity로 채우면 legacy
            // 리뷰의 blocker/major가 경고로 둔갑하므로 원문에 있을 때만 옮긴다.
            if (typeof row.actionability === 'string' && row.actionability) {
                finding.actionability = row.actionability;
            }
            findings.push(finding);
        }
        // 키 부재는 required=true로 본다. 명시 false만 review-skipped를 만든다.
        return {
            required: review.required === false ? false : true,
            findings,
        };
    }
    catch (_error) {
        // YAML/frontmatter 파싱 실패·깨진 findings 행만 흡수한다. required/findings를
        // 못 읽으면 review 부재와 같아 null — digest는 문서 오류로 throw하지 않고,
        // unverified도 review-skipped/finding-*를 만들지 않아 안전한 축소다.
        return null;
    }
}
/**
 * affected_paths·changed path 비교 전에 trailing slash를 벗긴다.
 * `src/`와 `src/greet.js`가 pathsOverlap에서 빗나가 path-outside-scope로
 * 오인되지 않게 한다(원장·문서 표기가 둘 다 쓰인다).
 *
 * @param {string} raw - 상대 경로
 * @returns {string} posix, trailing slash 제거
 */
function normalizeScopePath(raw) {
    let p = toPosix(raw).replace(/^\.\//, '');
    if (p.length > 1 && p.endsWith('/'))
        p = p.slice(0, -1);
    return p;
}
/**
 * changed path가 어떤 task의 affected_paths로도 정당화되지 않으면 true.
 *
 * @param {string} changedPath - governance 제외 변경 경로
 * @param {string[][]} scopes - task별 affected_paths
 * @returns {boolean}
 */
function pathOutsideScope(changedPath, scopes) {
    const p = normalizeScopePath(changedPath);
    for (const scopePaths of scopes) {
        for (const declared of scopePaths) {
            if (pathsOverlap(p, normalizeScopePath(declared)))
                return false;
        }
    }
    return true;
}
/**
 * 원장에서 task별 마지막 accepted 보고의 열린 선택·알려진 약점을 모은다. digest가
 * 원장 값을 싣는 유일한 경로이며 summary·dispatch 등 다른 필드는 읽지 않는다.
 * 순수 함수이며 throw하지 않는다 — 원장 모양이 틀리거나 light(보고 파일 없음)면
 * 빈 Map이다. 두 배열이 모두 비면 항목을 만들지 않는다. 문자열이 아닌 항목은 버린다.
 *
 * @param {unknown} ledger - 읽힌 원장 객체. 원장이 없으면 null
 * @returns {Map<string, WorkerNotes>} 키는 `TASKS-NNN`(TaskDigest.id 형식)
 */
function collectWorkerNotes(ledger) {
    const notes = new Map();
    const root = asRecord(ledger);
    if (root.mode === 'light' || !Array.isArray(root.decisions))
        return notes;
    // 원장 순서가 시간순이므로 같은 task의 뒤 보고가 앞 보고를 덮어쓴다.
    const latest = new Map();
    for (const raw of root.decisions) {
        const decision = asRecord(raw);
        if (decision.kind !== 'report' || decision.outcome !== 'accepted')
            continue;
        if (typeof decision.task !== 'string' || !decision.task)
            continue;
        latest.set(decision.task.startsWith('TASKS-') ? decision.task : `TASKS-${decision.task}`, decision);
    }
    for (const [id, decision] of latest) {
        const open_choices = stringList(decision.open_choices);
        const known_weaknesses = stringList(decision.known_weaknesses);
        if (open_choices.length || known_weaknesses.length) {
            notes.set(id, { open_choices, known_weaknesses });
        }
    }
    return notes;
}
/**
 * coordinator 원장을 외부 소비자가 원장 파일을 직접 읽지 않아도 되는 drive 요약으로
 * 줄인다. 순수 함수이며 throw하지 않는다 — 형식이 깨진 원장은 값으로 표현한다.
 * `ready`는 "task가 하나 이상이고 전부 integrated"일 때만 true다. id가 문자열이
 * 아닌 task는 식별할 수 없어 목록에서 빼되, 조용히 건너뛰면 준비 완료로 오인되므로
 * `ready`를 false로 만든다. 빈 목록도 같은 이유로 false다(아직 한 일이 없음).
 *
 * @param {unknown} ledger - 읽힌 원장 객체. 원장이 없으면 null
 * @returns {DriveSummary | null} 원장 null이면 null. tasks가 배열이 아니면
 *   `{ ready: false, tasks: [] }`. 그 외에는 원장 순서를 유지한 요약
 */
function summarizeDrive(ledger) {
    if (ledger === null || ledger === undefined)
        return null;
    const rawTasks = ledger.tasks;
    if (!Array.isArray(rawTasks))
        return { ready: false, tasks: [] };
    const tasks = [];
    let dropped = false;
    for (const raw of rawTasks) {
        if (!raw || typeof raw.id !== 'string') {
            dropped = true;
            continue;
        }
        tasks.push({
            id: raw.id,
            status: typeof raw.status === 'string' ? raw.status : null,
            sha: typeof raw.sha === 'string' ? raw.sha : null,
        });
    }
    // 입증된 범위 밖 terminal 실패는 성공이 아니라 별도 충족 사유다. ready만 열고 status는 원장 값
    // (verifying) 그대로 보여 줘 호출자가 integrated로 오해하지 않게 한다.
    const ready = !dropped && tasks.length > 0
        && tasks.every((task) => task.status === 'integrated' || (0, execution_contracts_1.validOutsideScope)(ledger, task.id) !== null);
    return { ready, tasks };
}
/**
 * 원장 decisions에서 Retro 판단용 drive 실행 통계를 센다. 원장 event만 세고 CLI 거절이나
 * 대화 기록은 추정하지 않는다. 순수 함수이며 입력을 바꾸지 않고 throw하지 않는다.
 * - rework_reports·blocked: `report` outcome rework/blocked. blocked는 `critical-recovery`
 *   outcome blocked도 더한다.
 * - debugger_calls: role debugger인 `worker-model`만. `worker-tokens`는 같은 호출의 늦은
 *   토큰 기록이라 세면 한 호출이 두 번 잡힌다.
 * - repair_waves: 같은 repair가 decisions와 `repairWaves`에 함께 남으므로 둘을 더하지 않는다.
 *   `repairWaves`의 고유 wave가 정본이고, 비어 있거나 없을 때만 decisions repair로 대신한다.
 * - fanin_verification_failures: `fanin-verification-failed` decision 수.
 *
 * @param {unknown} ledger - 읽힌 원장 객체. 원장이 없으면 null(모든 원장 counter 0)
 * @param {number} deferredMustFix - 루트 리뷰 deferred must_fix 고유 id 수(원장 밖 값)
 * @returns {DriveIssues} 여섯 counter
 */
function summarizeDriveIssues(ledger, deferredMustFix) {
    const root = asRecord(ledger);
    const decisions = (Array.isArray(root.decisions) ? root.decisions : []).map(asRecord);
    const count = (pred) => decisions.filter(pred).length;
    // wave가 정수인 행만 고유 집합에 넣는다 — 깨진 행이 별도 wave로 세지지 않게.
    const uniqueWaves = (rows) => new Set(rows.map(asRecord).map((r) => r.wave).filter((w) => Number.isInteger(w))).size;
    const fromRepairWaves = Array.isArray(root.repairWaves) ? uniqueWaves(root.repairWaves) : 0;
    return {
        rework_reports: count((d) => d.kind === 'report' && d.outcome === 'rework'),
        debugger_calls: count((d) => d.kind === 'worker-model' && d.role === 'debugger'),
        repair_waves: fromRepairWaves > 0
            ? fromRepairWaves
            : uniqueWaves(decisions.filter((d) => d.kind === 'repair')),
        fanin_verification_failures: count((d) => d.kind === 'fanin-verification-failed'),
        blocked: count((d) => (d.kind === 'report' || d.kind === 'critical-recovery')
            && d.outcome === 'blocked'),
        deferred_must_fix: deferredMustFix,
    };
}
/**
 * Explain·Quiz·PR에 필요한 finalize 입력을 한 JSON으로 모은다.
 * 문서·Git·원장을 쓰지 않는다. drive면 integration worktree에서 git을 읽고,
 * 깨진 원장은 기존 finalize와 같은 coordinator-ledger로 거절한다.
 * 성공 결과에는 최상위 `coordinator`와 `tasks[].actual_paths`를 싣지 않는다 —
 * 둘 다 drive 실행 기록이고 PR 초안은 읽지 않는다. 대신 최상위 `drive`
 * (`summarizeDrive`: 준비 여부와 task별 status·sha, 원장 없으면 null)를 `pr`과
 * 나란히 싣는다. `drive`는 PR 입력이 아니므로 buildPrDraft 뒤에 붙인다. `git.branch`만 원장
 * `integrationBranch`(없으면 checkout)로 정한다. 성공 시 `pr`는
 * buildPrDraft로 채운다 — agent가 제목·확인 방법을 손으로 조립하지 않게
 * 하기 위함이다. `review_scope: blueprint`이면 루트 리뷰 finding을
 * `blueprint_review`로 싣고, 아니면 그 필드는 null이다.
 * 루트 리뷰의 deferred must_fix는 최상위 `warnings`(blueprint 모드가 아니면 [])로,
 * 원장 event 통계는 최상위 `drive_issues`로 싣는다. 둘 다 buildPrDraft 뒤에 붙여
 * 실행 통계가 PR 입력에 섞이지 않게 한다 — PR의 미해결 절은 같은 판정 함수로
 * `blueprint_review`에서 직접 만든다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 호출 checkout(보통 main). 원장 경로 해석 기준
 * @param {string} opts.blueprintDir - blueprint 상대 경로
 * @param {(args: string[]) => { status: number, stdout: string }} [opts.exec] - `git` 뒤 argv seam
 * @param {Date} [opts.now] - PR 제목 날짜(KST). 기본 `new Date()`
 * @returns {FinalizeDigest | DigestFail} 성공 digest 또는 reason 코드
 */
function prepareFinalizeDigest({ repoRoot, blueprintDir, exec, now, }) {
    const bp = toPosix(blueprintDir);
    const blueprintAbs = path.join(repoRoot, bp);
    // 1. blueprint 경로 자체 — index 유무보다 디렉터리 부재를 먼저 거절한다.
    if (!fs.existsSync(blueprintAbs)) {
        return { ok: false, reason: 'blueprint-not-found' };
    }
    // 2. 원장을 한 번만 읽어 digest·거절이 서로 다른 파일을 보지 않게 한다.
    const ledgerRead = readCoordinatorLedger({ repoRoot, blueprint: bp });
    if (!ledgerRead.ok && ledgerRead.reason === 'unreadable-ledger') {
        return {
            ok: false,
            reason: 'coordinator-ledger',
            code: 'UNREADABLE_LEDGER',
            ledgerFile: ledgerRead.ledgerFile || null,
            integrationPath: ledgerRead.integrationPath || null,
        };
    }
    // drive면 integration worktree가 finalize checkout이다. 문서·git 모두 그쪽.
    const checkoutRoot = ledgerRead.ok && ledgerRead.integrationPath
        && fs.existsSync(ledgerRead.integrationPath)
        ? ledgerRead.integrationPath
        : repoRoot;
    const listing = listTasksDocs({ repoRoot: checkoutRoot, blueprintDir: bp });
    // 3. --yes 뒤 transient 삭제와 같다. task 문서가 하나도 없으면 거절.
    if (!listing.entries.some((entry) => fs.existsSync(path.join(checkoutRoot, entry.tasks.rel)))) {
        return { ok: false, reason: 'task-documents-missing' };
    }
    const ledger = ledgerRead.ok ? ledgerRead.ledger : null;
    const ledgerBase = ledger && typeof ledger.base === 'string'
        ? ledger.base
        : null;
    const base = resolveDigestBase({ repoRoot, blueprintDir: bp, ledgerBase });
    if (!base) {
        return { ok: false, reason: 'no-base' };
    }
    const run = typeof exec === 'function'
        ? exec
        : (args) => defaultExec(checkoutRoot, args);
    const headResult = run(['rev-parse', 'HEAD']);
    if (headResult.status !== 0 || !headResult.stdout.trim()) {
        return { ok: false, reason: 'no-base' };
    }
    const head = headResult.stdout.trim();
    const verified = run(['rev-parse', '--verify', `${base}^{commit}`]);
    if (verified.status !== 0) {
        return { ok: false, reason: 'no-base' };
    }
    // blueprint index — Intent 파싱 실패는 digest 거절이 아니라 빈 intent로 두지 않는다.
    // Intent는 Interface 필수 필드이므로 읽기 실패 시 빈 배열만 허용(파일이 있을 때).
    const bpIndexRel = `${bp}/index.md`;
    const bpIndexAbs = path.join(checkoutRoot, bpIndexRel);
    let bpTitle = '';
    let bpCommitType = 'feat';
    let bpScale = null;
    let bpEpicId = null;
    let bpBlueprintId = null;
    let intent = [];
    let outOfScope = [];
    let blueprintReviewMode = false;
    if (fs.existsSync(bpIndexAbs)) {
        try {
            const doc = readDoc(bpIndexAbs);
            const data = asRecord(doc.data);
            const bouncer = asRecord(data.bouncer);
            bpTitle = typeof data.title === 'string' ? data.title : '';
            bpCommitType = typeof bouncer.commit_type === 'string' ? bouncer.commit_type : 'feat';
            bpScale = typeof bouncer.scale === 'string' ? bouncer.scale : null;
            bpEpicId = typeof bouncer.epic_id === 'string' ? bouncer.epic_id : null;
            bpBlueprintId = typeof bouncer.blueprint_id === 'string'
                ? bouncer.blueprint_id
                : (typeof bouncer.id === 'string' ? bouncer.id : null);
            // 필드 부재는 구형 계약. 잘못된 값은 S31이 거절하므로 여기서는
            // 정확히 'blueprint'일 때만 루트 리뷰를 읽는다.
            blueprintReviewMode = bouncer.review_scope === 'blueprint';
            // 초기 '' 할당을 두지 않는다 — 이 블록에서만 읽고 바로 파싱한다.
            const bpBody = typeof doc.body === 'string' ? doc.body : '';
            outOfScope = parseOutOfScope(bpBody);
            try {
                intent = parseIntentBody(bpBody);
            }
            catch (error) {
                // 헤딩 부재만 예전처럼 intent:[]로 흡수한다(draft·구형 fixture 호환).
                // 헤딩이 있는데 내용이 깨진 경우는 prepare가 조용히 통과하면
                // finalize 커밋 직전에 스택으로 터지므로 S33 validate 실패로 승격한다.
                const message = error.message || String(error);
                if (/blueprint Intent is missing or malformed/.test(message)) {
                    intent = [];
                }
                else {
                    return {
                        ok: false,
                        reason: 'validate',
                        failures: [{
                                code: 'S33',
                                message: `blueprint Intent invalid: ${message}`,
                                file: bpIndexRel,
                            }],
                    };
                }
            }
        }
        catch (_error) {
            // index 파싱 실패는 blueprint-not-found가 아니다 — 디렉터리는 있다.
        }
    }
    let stableBlueprint = '';
    if (bpEpicId && bpBlueprintId) {
        stableBlueprint = `EPIC-${bpEpicId}/BP-${bpBlueprintId}`;
    }
    // provenance는 git.branch 결정에만 쓴다. 결과 JSON에 싣지 않는 이유:
    // 원장 색인은 cleanup·finalize payload 자리이고, digest는 PR 입력이다.
    const coordinator = buildCoordinatorProvenance(ledger, {
        integrationPath: ledgerRead.ok ? ledgerRead.integrationPath : null,
        ledgerFile: ledgerRead.ok ? ledgerRead.ledgerFile : null,
    });
    const built = [];
    const workerNotes = collectWorkerNotes(ledger);
    const stableIds = [];
    for (const entry of listing.entries) {
        const tasksAbs = path.join(checkoutRoot, entry.tasks.rel);
        if (!fs.existsSync(tasksAbs))
            continue;
        let data;
        let body;
        try {
            const doc = readDoc(tasksAbs);
            data = doc.data;
            // catch에서 continue하므로 초기 ''는 읽히지 않는다 — 성공 시에만 대입.
            body = typeof doc.body === 'string' ? doc.body : '';
        }
        catch (_error) {
            // 해당 tasks.md YAML/frontmatter 파싱 실패만 흡수한다. 한 task가 깨져도
            // 나머지 digest는 유지하고, 이 entry는 tasks 목록에서 빠진다 — 전체
            // prepare를 throw로 실패시키지 않는 것이 읽기 전용 수집의 계약이다.
            continue;
        }
        const taskData = asRecord(data);
        const bouncer = asRecord(taskData.bouncer);
        const id = typeof bouncer.id === 'string' ? bouncer.id : `TASKS-${String(entry.number).padStart(3, '0')}`;
        const kind = executionKindOf(bouncer) || entry.executionKind || 'commit';
        let stableId = id;
        try {
            stableId = buildStableProvenance({
                epicId: bouncer.epic_id || bpEpicId,
                blueprintId: bouncer.blueprint_id || bpBlueprintId,
                taskId: id,
            }).task;
        }
        catch (_error) {
            // frontmatter가 불완전하면 id만 싣고 trailer 매칭은 건너뛴다.
        }
        stableIds.push(stableId);
        const affected = stringList(bouncer.affected_paths);
        const sections = parseTasksSections(body);
        const constraints = typeof sections.constraints === 'string' && sections.constraints.trim()
            ? sections.constraints
            : null;
        const verification = readVerification(path.join(checkoutRoot, entry.verification.rel));
        const reviewRel = entry.review ? entry.review.rel : null;
        const review = kind === 'verification'
            ? null
            : readReview(reviewRel ? path.join(checkoutRoot, reviewRel) : null);
        const commitShaField = normalizeCommitSha(bouncer.commit_sha);
        built.push({
            kind,
            affected,
            digest: {
                stable_id: stableId,
                id,
                title: typeof taskData.title === 'string' ? taskData.title : '',
                execution_kind: kind,
                status: typeof bouncer.status === 'string' ? bouncer.status : '',
                commit: commitShaField
                    ? {
                        sha: commitShaField,
                        sha8: commitShaField,
                        source: 'commit_sha',
                        worker_sha: null,
                    }
                    : null,
                affected_paths: affected,
                verification,
                review,
                constraints,
                ...(workerNotes.has(id) ? { worker_notes: workerNotes.get(id) } : {}),
            },
        });
    }
    const trailerMap = resolveTaskCommits({
        repoRoot: checkoutRoot,
        base,
        head,
        stableIds,
        exec: run,
    });
    for (const item of built) {
        const hit = trailerMap.get(item.digest.stable_id);
        if (hit) {
            item.digest.commit = {
                sha: hit.sha, sha8: hit.sha8, source: 'trailer', worker_sha: hit.workerSha,
            };
            continue;
        }
        // trailer가 없고 commit_sha만 있으면 짧은 hex를 유지한다. 전체 SHA는 없다.
        if (item.digest.commit && item.digest.commit.source === 'commit_sha') {
            const short = item.digest.commit.sha8;
            item.digest.commit = {
                sha: short, sha8: short, source: 'commit_sha', worker_sha: null,
            };
        }
    }
    const nameOnly = run(['diff', '--name-only', `${base}..${head}`]);
    const changedPaths = nameOnly.status === 0
        ? nameOnly.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
            .map((p) => toPosix(p))
            .filter((p) => p !== CONTEXT_EXCLUDED.slice(0, -1) && !p.startsWith(CONTEXT_EXCLUDED))
        : [];
    const unified = run(['diff', '-U0', `${base}..${head}`]);
    const symbols = unified.status === 0 ? extractSymbols(unified.stdout) : [];
    const subjectLog = run(['log', '--format=%h%x00%s', `${base}..${head}`]);
    const commits = subjectLog.status === 0
        ? parseCommitSubjects(subjectLog.stdout).slice(0, COMMIT_LIST_CAP)
        : [];
    const diff = computeDiffSha({
        repoRoot: checkoutRoot,
        base,
        exec: (args) => {
            const r = run(args);
            return { status: r.status, stdout: r.stdout, stderr: '' };
        },
    });
    const diffSummary = collectDiffSummary(run, base, head);
    const unverified = [];
    if (!diffSummary)
        unverified.push({ kind: 'diff-summary-unavailable' });
    let terminalOk = false;
    let outsideScopeTerminal = null;
    for (const item of built) {
        const task = item.digest;
        if (item.kind === 'verification') {
            if (task.verification && task.verification.status === 'passed') {
                terminalOk = true;
                continue;
            }
            // 실패한 terminal이 입증된 범위 밖 분류를 가지면 passed로 바꾸지 않고 실패 증거에 분류와
            // 원본 evidence/source identity를 붙인다. 분류가 없거나 stale이면 아래 terminal-missing이 남는다.
            const accepted = (0, execution_contracts_1.validOutsideScope)(ledger, task.id);
            if (accepted) {
                const failure = asRecord(asRecord(ledger).terminalFailure);
                task.verification = {
                    status: task.verification ? task.verification.status : 'failed',
                    command: task.verification?.command ?? (typeof failure.command === 'string' ? failure.command : null),
                    exit_code: task.verification?.exit_code ?? (typeof failure.exitCode === 'number' ? failure.exitCode : null),
                    evidence_id: task.verification?.evidence_id ?? accepted.evidence_id,
                    reused: task.verification ? task.verification.reused : null,
                    outside_scope: accepted,
                };
                outsideScopeTerminal = { stableId: task.stable_id, accepted };
            }
            continue;
        }
        if (item.kind === 'commit') {
            if (!task.verification || task.verification.status !== 'passed') {
                unverified.push({ kind: 'verification-not-passed', task: task.stable_id });
            }
        }
        if (!blueprintReviewMode && task.review && task.review.required === false) {
            unverified.push({ kind: 'review-skipped', task: task.stable_id });
        }
        if (task.review) {
            for (const finding of task.review.findings) {
                if (finding.status === 'deferred') {
                    unverified.push({
                        kind: 'finding-deferred',
                        task: task.stable_id,
                        detail: finding.note || finding.id,
                    });
                }
                else if (finding.status === 'accepted') {
                    unverified.push({
                        kind: 'finding-accepted',
                        task: task.stable_id,
                        detail: finding.note || finding.id,
                    });
                }
            }
        }
    }
    let blueprintReview = null;
    if (blueprintReviewMode) {
        // 모드인데 루트 파일이 없으면 빈 findings다. null은 "모드가 아니다".
        const rootReview = readReview(path.join(checkoutRoot, `${bp}/review.md`));
        blueprintReview = { findings: rootReview ? rootReview.findings : [] };
        for (const finding of blueprintReview.findings) {
            if (finding.status === 'deferred') {
                unverified.push({
                    kind: 'finding-deferred',
                    task: null,
                    detail: finding.note || finding.id,
                });
            }
            else if (finding.status === 'accepted') {
                unverified.push({
                    kind: 'finding-accepted',
                    task: null,
                    detail: finding.note || finding.id,
                });
            }
        }
    }
    if (!terminalOk && outsideScopeTerminal) {
        // 별도 경고 항목: 원본 증거 id를 detail에 싣는다(경로가 아니라 id만 — 공유 PR에 로컬 경로가 새지 않게).
        unverified.push({
            kind: 'terminal-outside-scope',
            task: outsideScopeTerminal.stableId,
            detail: `${outsideScopeTerminal.accepted.reason} (evidence ${outsideScopeTerminal.accepted.evidence_id})`,
        });
    }
    else if (!terminalOk) {
        unverified.push({ kind: 'terminal-missing' });
    }
    const scopes = built.map((item) => item.affected);
    for (const changed of changedPaths) {
        if (pathOutsideScope(changed, scopes)) {
            unverified.push({ kind: 'path-outside-scope', path: changed });
        }
    }
    // drive면 원장 integrationBranch가 checkout 이름보다 우선한다.
    // 결과 JSON에 coordinator를 싣지 않으므로 여기서만 지역 변수를 읽는다.
    const branch = coordinator && coordinator.integrationBranch
        ? coordinator.integrationBranch
        : resolveCheckoutBranch(checkoutRoot);
    // pr는 나머지 digest 필드를 입력으로 쓴다 — 순환 참조를 피하려고 본문을
    // 먼저 조립한 뒤 buildPrDraft에 넘긴다.
    const body = {
        ok: true,
        version: 2,
        blueprint: {
            dir: bp,
            stable_id: stableBlueprint,
            title: bpTitle,
            intent,
            commit_type: bpCommitType,
            scale: bpScale,
        },
        range: {
            base,
            head,
            diff_sha: diff.ok ? diff.sha : null,
        },
        git: {
            branch,
            pr_base: resolvePrBase(checkoutRoot, run),
        },
        tasks: built.map((item) => item.digest),
        changed_paths: changedPaths,
        symbols,
        commits,
        diff: diffSummary,
        evidence: {
            verification: built.flatMap((item) => (item.digest.verification && item.digest.verification.evidence_id
                ? [{ task: item.digest.stable_id, evidence_id: item.digest.verification.evidence_id }]
                : [])),
            review: readReviewEvidence(path.join(checkoutRoot, `${bp}/review.md`), `${bp}/review.md`),
        },
        unverified,
        out_of_scope: outOfScope,
        blueprint_review: blueprintReview,
    };
    // task 범위는 경고를 만들지 않는다 — blueprintReview는 blueprint 모드에서만 non-null.
    const warnings = blueprintReview ? collectMustFixWarnings(blueprintReview.findings) : [];
    const config = readConfig(checkoutRoot) ?? {};
    return {
        ...body,
        pr: buildPrDraft(body, {
            now: now instanceof Date ? now : new Date(),
            config,
        }),
        // PR draft 입력(body)에 섞이지 않도록 buildPrDraft 호출 뒤 반환 객체에만 붙인다.
        drive: summarizeDrive(ledger),
        warnings,
        drive_issues: summarizeDriveIssues(ledger, warnings.length),
    };
}
module.exports = { prepareFinalizeDigest, summarizeDrive, summarizeDriveIssues };
