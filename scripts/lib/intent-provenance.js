'use strict';
const fs = require("node:fs");
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const symbolIndex = require("./symbol-index");
const { resolveSymbol } = symbolIndex;
const frontmatter = require("./frontmatter");
const { parseFrontmatter } = frontmatter;
const commitSha = require("./commit-sha");
const { normalizeCommitSha, buildStableProvenance } = commitSha;
const validateSections = require("./validate-sections");
const { parseExplainSections } = validateSections;
const paths = require("./paths");
const { toPosix } = paths;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const BODY_BUDGET_BYTES = 2000;
const STABLE_TASK_RE = /^EPIC-(\d{3})\/BP-(\d{3})\/TASK-(\d{3})$/;
const STABLE_INTENT_RE = /^EPIC-(\d{3})\/BP-(\d{3})$/;
const INTENT_ANCHOR_RE = /^task-(\d{3})$/;
const TASK_DIR_RE = /^(\d{3})$/;
const TRAILER_RE = /^(Bouncer-Task|Bouncer-Intent)\s*:\s*(.*?)\s*$/;
const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', '.worktrees', 'graphify-out']);
const FRESHNESS_RANK = {
    current: 0,
    related: 1,
    'possibly-superseded': 2,
    historical: 3,
};
/**
 * 현재 checkout의 함수 정의에 Git blame/log와 Explain을 연결한다.
 * trailer와 Explain 본문은 데이터일 뿐이라서 limit·status·workflow를 바꾸지 않는다.
 * Git이 없거나 명령이 실패하면 unlinked로 접지 않고 던진다.
 *
 * @param {object} input - 조회 입력
 * @param {string} input.repoRoot - 저장소 루트. 이 경계 밖 Explain은 증거가 되지 않는다
 * @param {string} input.symbol - 함수명. TASKS-001과 같은 식별자
 * @param {string} [input.candidateRef] - TASKS-001이 발급한 opaque ref
 * @param {number} [input.limit] - 반환 candidate 수. 생략 시 3, 허용 1..5
 * @returns {IntentResult} resolved / unlinked / ambiguous / unresolved
 */
function resolveIntentProvenance(input) {
    // 1. limit는 조회 전에 거절한다. 잘못된 예산을 들고 Git을 치지 않는다.
    const limit = requireLimit(input.limit);
    const symbol = typeof input.symbol === 'string' ? input.symbol : '';
    const selected = resolveSymbol({
        repoRoot: input.repoRoot,
        symbol: input.symbol,
        candidateRef: input.candidateRef,
    });
    // 2. 정의가 없거나 동명이면 provenance를 만들지 않는다. TASKS-001 상태를 보존한다.
    if (selected.status !== 'resolved') {
        return {
            status: selected.status,
            symbol,
            candidates: selected.candidates,
            truncated: false,
        };
    }
    const repoReal = fs.realpathSync(input.repoRoot);
    requireGitRepo(repoReal);
    const symbolRef = selected.symbol_ref;
    const tracked = runGit(repoReal, ['ls-files', '--', symbolRef.path]);
    if (tracked.status !== 0) {
        throw gitFailure('git ls-files failed', tracked);
    }
    // 추적되지 않은 파일은 이력이 없는 정상 비연결이다. 명령 실패로 취급하지 않는다.
    if (tracked.stdout.trim().length === 0) {
        return unlinkedResult(symbol, symbolRef);
    }
    const metas = collectCommitMetas(repoReal, symbolRef, symbol);
    const explains = loadExplainDocs(repoReal);
    const shaIndex = buildShaIndex(repoReal, explains);
    const linked = [];
    for (const meta of metas) {
        const hit = linkCommit(repoReal, meta.sha, explains, shaIndex);
        if (!hit)
            continue;
        const doc = explains.find((item) => item.rel === hit.explain);
        const taskDigits = taskDigitsOf(hit.task);
        linked.push({
            ...meta,
            task: hit.task,
            explain: hit.explain,
            sections: doc ? selectSections(doc, taskDigits) : [],
        });
    }
    if (linked.length === 0) {
        return unlinkedResult(symbol, symbolRef);
    }
    const currentSha = pickCurrentSha(metas);
    const drafts = linked.map((item) => {
        const freshness = freshnessOf(item, linked, currentSha);
        return {
            relation: item.relation,
            commit: item.sha,
            task: item.task,
            explain: item.explain,
            freshness,
            sections: freshness === 'historical' ? [] : item.sections.map((part) => part.name),
            body: freshness === 'historical' ? '' : serializeSections(item.sections),
            ct: item.ct,
        };
    });
    drafts.sort((left, right) => {
        const rank = FRESHNESS_RANK[left.freshness] - FRESHNESS_RANK[right.freshness];
        if (rank !== 0)
            return rank;
        if (right.ct !== left.ct)
            return right.ct - left.ct;
        if (left.commit !== right.commit)
            return left.commit < right.commit ? -1 : 1;
        return left.explain < right.explain ? -1 : 1;
    });
    const sliced = drafts.slice(0, limit);
    const truncated = applyBodyBudget(sliced);
    const candidates = sliced.map((item) => ({
        relation: item.relation,
        commit: item.commit,
        task: item.task,
        explain: item.explain,
        freshness: item.freshness,
        sections: item.sections,
        body: item.body,
    }));
    return {
        status: 'resolved',
        symbol,
        symbol_ref: symbolRef,
        candidates,
        truncated,
    };
}
/**
 * limit를 1..5 정수로만 받는다. 문자열 숫자나 기본값 보정은 하지 않는다 —
 * CLI가 이미 거절해야 할 값을 resolver가 조용히 3으로 바꾸면 계약이 갈라진다.
 *
 * @param {unknown} limit - 호출자가 넘긴 상한
 * @returns {number} 사용할 candidate 수
 */
function requireLimit(limit) {
    if (limit === undefined || limit === null)
        return DEFAULT_LIMIT;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new Error('limit must be an integer between 1 and 5');
    }
    return limit;
}
function unlinkedResult(symbol, symbolRef) {
    return {
        status: 'unlinked',
        symbol,
        symbol_ref: symbolRef,
        candidates: [],
        truncated: false,
    };
}
/**
 * cwd를 저장소 루트로 두고 argv 배열만 넘긴다. 셸 문자열을 만들지 않아
 * path·SHA가 플래그로 해석되거나 보간되지 않게 한다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} args - `git` 다음 argv
 * @returns {GitResult} status·stdout·stderr. 비0도 throw하지 않는다
 */
function runGit(repoRoot, args) {
    const result = spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.error) {
        // ENOENT는 git 바이너리 부재다. unlinked로 접으면 설치 문제가 연결 부재로 보인다.
        throw new Error('git command is not executable', { cause: result.error });
    }
    return {
        status: typeof result.status === 'number' ? result.status : 1,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
    };
}
function gitFailure(message, result) {
    const detail = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n');
    return new Error(detail ? `${message}: ${detail}` : message);
}
/**
 * work tree가 아니면 명시적으로 거절한다. rev-parse 실패를 unlinked로 바꾸지 않는다.
 *
 * @param {string} repoRoot - realpath 저장소 루트
 */
function requireGitRepo(repoRoot) {
    const inside = runGit(repoRoot, ['rev-parse', '--is-inside-work-tree']);
    if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
        throw gitFailure('not a git repository', inside);
    }
}
/**
 * blame의 현재 line 소유 commit과 `--follow` 파일 이력을 모은다.
 * rename은 follow가 담당하고, 같은 함수를 만진 commit은 `-G`로 표시한다.
 *
 * @param {string} repoRoot - git cwd
 * @param {SymbolRef} symbolRef - 현재 함수 좌표
 * @param {string} symbol - `-G`에 쓸 함수명
 * @returns {CommitMeta[]} 중복 없는 commit 목록
 */
function collectCommitMetas(repoRoot, symbolRef, symbol) {
    const blame = runGit(repoRoot, [
        'blame', '--line-porcelain', '-L', `${symbolRef.start_line},${symbolRef.end_line}`,
        '--', symbolRef.path,
    ]);
    if (blame.status !== 0) {
        throw gitFailure('git blame failed', blame);
    }
    const blameShas = parseBlameShas(blame.stdout);
    const follow = runGit(repoRoot, [
        'log', '--follow', '--format=%H%x1f%ct', '--', symbolRef.path,
    ]);
    if (follow.status !== 0) {
        throw gitFailure('git log --follow failed', follow);
    }
    const functionLog = runGit(repoRoot, [
        'log', '--follow', '-G', escapeRegExp(symbol), '--format=%H', '--', symbolRef.path,
    ]);
    if (functionLog.status !== 0) {
        throw gitFailure('git log -G failed', functionLog);
    }
    const functionShas = new Set(functionLog.stdout.split('\n').map((line) => line.trim()).filter((line) => /^[0-9a-f]{40}$/.test(line)));
    const bySha = new Map();
    for (const line of follow.stdout.split('\n')) {
        if (!line.trim())
            continue;
        const [sha, ctRaw] = line.split('\x1f');
        if (!/^[0-9a-f]{40}$/.test(sha))
            continue;
        const ct = Number.parseInt(ctRaw, 10);
        bySha.set(sha, {
            sha,
            ct: Number.isFinite(ct) ? ct : 0,
            relation: blameShas.has(sha) ? 'blame' : 'follow',
            functionTouch: functionShas.has(sha) || blameShas.has(sha),
        });
    }
    for (const sha of blameShas) {
        if (bySha.has(sha))
            continue;
        bySha.set(sha, {
            sha,
            ct: committerUnix(repoRoot, sha),
            relation: 'blame',
            functionTouch: true,
        });
    }
    return [...bySha.values()];
}
function parseBlameShas(stdout) {
    const shas = new Set();
    for (const line of stdout.split('\n')) {
        const match = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
        if (match)
            shas.add(match[1]);
    }
    return shas;
}
function committerUnix(repoRoot, sha) {
    const result = runGit(repoRoot, ['log', '-1', '--format=%ct', sha]);
    if (result.status !== 0) {
        throw gitFailure('git log %ct failed', result);
    }
    const ct = Number.parseInt(result.stdout.trim(), 10);
    return Number.isFinite(ct) ? ct : 0;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function pickCurrentSha(metas) {
    const blame = metas.filter((item) => item.relation === 'blame');
    if (blame.length === 0)
        return null;
    return [...blame].sort((left, right) => {
        if (right.ct !== left.ct)
            return right.ct - left.ct;
        return left.sha < right.sha ? -1 : 1;
    })[0].sha;
}
/**
 * 현재 line owner는 current. 같은 함수를 나중에 연결 커밋이 고치면 앞선 함수
 * 커밋은 possibly-superseded. 함수를 만지지 않은 과거 연결은 historical이라서
 * 현재 동작의 근거처럼 본문을 실지 않는다.
 *
 * @param {LinkedDraft} item - 연결이 끝난 candidate
 * @param {LinkedDraft[]} linked - 같은 조회에서 연결된 전체
 * @param {string | null} currentSha - blame 최신 SHA
 * @returns {Freshness} freshness 값
 */
function freshnessOf(item, linked, currentSha) {
    if (currentSha && item.sha === currentSha)
        return 'current';
    const laterLinkedFn = linked.some((other) => (other.sha !== item.sha
        && other.ct > item.ct
        && other.functionTouch));
    if (laterLinkedFn && item.functionTouch)
        return 'possibly-superseded';
    if (laterLinkedFn && !item.functionTouch)
        return 'historical';
    if (item.functionTouch || item.relation === 'follow')
        return 'related';
    return 'historical';
}
/**
 * trailer를 우선하고, trailer가 없을 때만 Explain SHA 역색인으로 연결한다.
 * 상충·malformed trailer는 SHA fallback의 입력이 아니며, 모호 SHA·저장소 밖
 * 경로와 같이 증거가 되지 않는다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string} sha - 40자리 commit
 * @param {ExplainDoc[]} explains - 저장소 안 canonical Explain
 * @param {Map<string, LinkHit[]>} shaIndex - full SHA → task·explain
 * @returns {LinkHit | null} 하나면 hit, 없거나 모호·거절이면 null
 */
function linkCommit(repoRoot, sha, explains, shaIndex) {
    const message = runGit(repoRoot, ['log', '-1', '--format=%B', sha]);
    if (message.status !== 0) {
        throw gitFailure('git log %B failed', message);
    }
    const trailer = parseTrailers(message.stdout);
    if (trailer.status === 'ok') {
        return uniqueHit(explainsForTask(explains, trailer.task));
    }
    // reject는 연결 증거가 아니다. SHA 역색인은 trailer가 전혀 없을 때만 쓴다 —
    // 상충 Task 값을 두고 Explain이 그 SHA를 유일하게 찍으면 잘못된 쪽을 승격한다.
    if (trailer.status === 'reject') {
        return null;
    }
    return uniqueHit(shaIndex.get(sha) || []);
}
/**
 * 줄 앞의 Bouncer-Task/Intent만 trailer로 본다. 본문 한가운데 언급은 키가 아니다.
 * 값이 둘 이상이거나 Task·Intent가 어긋나면 reject다. SHA fallback으로 넘기지 않는다.
 *
 * @param {string} message - `%B` 본문
 * @returns {TrailerParse} ok / absent / reject
 */
function parseTrailers(message) {
    const tasks = new Set();
    const intents = new Set();
    for (const raw of message.split('\n')) {
        const match = TRAILER_RE.exec(raw);
        if (!match)
            continue;
        if (match[1] === 'Bouncer-Task')
            tasks.add(match[2]);
        else
            intents.add(match[2]);
    }
    if (tasks.size === 0 && intents.size === 0)
        return { status: 'absent' };
    if (tasks.size !== 1)
        return { status: 'reject' };
    const task = [...tasks][0];
    const parsed = STABLE_TASK_RE.exec(task);
    if (!parsed)
        return { status: 'reject' };
    if (intents.size > 1)
        return { status: 'reject' };
    if (intents.size === 1) {
        const intent = [...intents][0];
        if (!STABLE_INTENT_RE.test(intent))
            return { status: 'reject' };
        if (intent !== `EPIC-${parsed[1]}/BP-${parsed[2]}`)
            return { status: 'reject' };
    }
    return { status: 'ok', task };
}
function explainsForTask(explains, task) {
    const parsed = STABLE_TASK_RE.exec(task);
    if (!parsed)
        return [];
    const hits = [];
    const seen = new Set();
    for (const doc of explains) {
        if (doc.epicId !== parsed[1] || doc.bpId !== parsed[2])
            continue;
        const key = `${task}\0${doc.rel}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        hits.push({ task, explain: doc.rel });
    }
    return hits;
}
function uniqueHit(hits) {
    if (hits.length === 0)
        return null;
    const keys = new Set(hits.map((item) => `${item.task}\0${item.explain}`));
    if (keys.size !== 1)
        return null;
    return hits[0];
}
/**
 * 8자리 SHA를 Git 객체로 펼친다. 둘 이상의 객체에 매기면 하나를 고르지 않는다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string} shortSha - Explain에 적힌 짧은 hex
 * @returns {ShaExpand} unique / ambiguous / missing
 */
function expandShortSha(repoRoot, shortSha) {
    const parsed = runGit(repoRoot, ['rev-parse', '--verify', shortSha]);
    const text = `${parsed.stdout}\n${parsed.stderr}`;
    if (/ambiguous/i.test(text))
        return { status: 'ambiguous' };
    if (parsed.status !== 0)
        return { status: 'missing' };
    const full = parsed.stdout.trim();
    if (!/^[0-9a-f]{40}$/.test(full))
        return { status: 'missing' };
    const kind = runGit(repoRoot, ['cat-file', '-t', full]);
    if (kind.status !== 0 || kind.stdout.trim() !== 'commit')
        return { status: 'missing' };
    return { status: 'unique', full };
}
function buildShaIndex(repoRoot, explains) {
    const index = new Map();
    for (const doc of explains) {
        for (const row of doc.rows) {
            const expanded = expandShortSha(repoRoot, row.sha8);
            // 모호한 짧은 SHA는 어느 task에도 붙이지 않는다. 한 쪽을 찍으면 다른 객체의
            // 의도가 현재 함수 근거로 승격된다.
            if (expanded.status !== 'unique')
                continue;
            const list = index.get(expanded.full) || [];
            list.push({ task: row.task, explain: doc.rel });
            index.set(expanded.full, list);
        }
    }
    return index;
}
/**
 * canonical Explain만 읽는다. context graph 역색인은 쓰지 않고, symlink가
 * 저장소 밖으로 나가면 그 파일만 버린다.
 *
 * @param {string} repoReal - realpath 루트
 * @returns {ExplainDoc[]} 파싱에 성공한 Explain
 */
function loadExplainDocs(repoReal) {
    const root = path.join(repoReal, '.bouncer', 'context');
    const files = [];
    walkExplain(root, repoReal, files);
    files.sort();
    const docs = [];
    for (const abs of files) {
        const parsed = parseExplainDoc(abs, repoReal);
        if (parsed)
            docs.push(parsed);
    }
    return docs;
}
function walkExplain(absDir, repoReal, files) {
    let entries;
    try {
        entries = fs.readdirSync(absDir, { withFileTypes: true });
    }
    catch (error) {
        // 한 디렉터리의 부재·권한·루프만 건너뛴다. 그 외는 색인 전체를 공집합으로 위장하지 않는다.
        if (isSkippableFsError(error))
            return;
        throw error;
    }
    for (const ent of entries) {
        if (ent.name === '.' || ent.name === '..')
            continue;
        const abs = path.join(absDir, ent.name);
        if (ent.isDirectory()) {
            if (SKIP_DIR_NAMES.has(ent.name))
                continue;
            if (!isInsideRepo(abs, repoReal))
                continue;
            walkExplain(abs, repoReal, files);
            continue;
        }
        if (ent.name !== 'explain.md')
            continue;
        let real;
        try {
            real = fs.realpathSync(abs);
        }
        catch (error) {
            if (isSkippableFsError(error))
                continue;
            throw error;
        }
        if (!isInsideRepo(real, repoReal))
            continue;
        files.push(abs);
    }
}
function parseExplainDoc(abs, repoReal) {
    let raw;
    try {
        raw = fs.readFileSync(abs, 'utf8');
    }
    catch (error) {
        if (isSkippableFsError(error))
            return null;
        throw error;
    }
    let parsed;
    try {
        parsed = parseFrontmatter(raw);
    }
    catch (_e) {
        // 깨진 frontmatter는 이 파일만 증거가 아니다. 다른 Explain을 지우지 않는다.
        return null;
    }
    const data = parsed.data;
    if (!data || typeof data !== 'object' || Array.isArray(data))
        return null;
    const bouncer = data.bouncer;
    if (!bouncer || typeof bouncer !== 'object' || Array.isArray(bouncer))
        return null;
    const rec = bouncer;
    const epicId = String(rec.epic_id || '');
    const bpId = String(rec.blueprint_id || '');
    if (!/^\d{3}$/.test(epicId) || !/^\d{3}$/.test(bpId))
        return null;
    const rel = toPosix(path.relative(repoReal, abs));
    const rows = parseTaskCommitRows(rec.task_commits, epicId, bpId);
    const explainSections = parseExplainSections(parsed.body);
    const sections = [];
    pushSection(sections, 'Background', stripExcludedHeadings(explainSections.background));
    pushSection(sections, 'Intuition', stripExcludedHeadings(explainSections.intuition));
    pushSection(sections, 'Code', stripExcludedHeadings(explainSections.code));
    return { rel, epicId, bpId, body: parsed.body, rows, sections };
}
/**
 * 새 `{ task, sha, intent_anchor }`를 먼저 읽고, 키가 없으면 legacy `{ id, sha }`만
 * 받는다. 깨진 새 행을 legacy id로 구하지 않는다.
 *
 * @param {unknown} value - task_commits
 * @param {string} epicId - Explain 부모 epic
 * @param {string} bpId - Explain 부모 blueprint
 * @returns {ExplainRow[]} 검증된 행
 */
function parseTaskCommitRows(value, epicId, bpId) {
    if (!Array.isArray(value))
        return [];
    const rows = [];
    for (const row of value) {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            continue;
        const record = row;
        const looksNew = Object.prototype.hasOwnProperty.call(record, 'task')
            || Object.prototype.hasOwnProperty.call(record, 'intent_anchor');
        if (looksNew) {
            const parsed = parseNewRow(record, epicId, bpId);
            if (parsed)
                rows.push(parsed);
            continue;
        }
        const id = String(record.id || '');
        if (!TASK_DIR_RE.test(id))
            continue;
        const sha8 = normalizeCommitSha(record.sha);
        if (!sha8)
            continue;
        rows.push({ task: `EPIC-${epicId}/BP-${bpId}/TASK-${id}`, sha8 });
    }
    return rows;
}
function parseNewRow(row, epicId, bpId) {
    const sha8 = normalizeCommitSha(row.sha);
    if (!sha8)
        return null;
    const anchor = INTENT_ANCHOR_RE.exec(String(row.intent_anchor || ''));
    if (!anchor)
        return null;
    let expected;
    try {
        expected = buildStableProvenance({
            epicId,
            blueprintId: bpId,
            taskId: `TASKS-${anchor[1]}`,
        });
    }
    catch (_e) {
        return null;
    }
    if (String(row.task || '') !== expected.task)
        return null;
    return { task: expected.task, sha8 };
}
function pushSection(sections, name, body) {
    if (typeof body !== 'string')
        return;
    const trimmed = body.trim();
    if (!trimmed)
        return;
    sections.push({ name, body: trimmed });
}
/**
 * parseExplainSections가 모르는 `## Checklist` 같은 제목은 직전 절에 흡수된다.
 * 허용 절을 고른 뒤에도 verification·review·Quiz·Checklist가 본문에 남지 않게 자른다.
 *
 * @param {string | null | undefined} body - 한 절의 원문
 * @returns {string | null} 제외 제목 앞까지만
 */
function stripExcludedHeadings(body) {
    if (typeof body !== 'string')
        return null;
    const lines = body.split('\n');
    const kept = [];
    for (const line of lines) {
        if (/^##\s+(Quiz|Checklist|이해\s*상태|verification|review)\b/i.test(line.trim()))
            break;
        kept.push(line);
    }
    return kept.join('\n');
}
function taskDigitsOf(task) {
    const match = STABLE_TASK_RE.exec(task);
    return match ? match[3] : null;
}
/**
 * Background·Intuition·Code와 해당 Task의 장기 설계 절만 고른다.
 * Quiz·Checklist·Do not touch·verification·review는 입력 예산에 넣지 않는다.
 *
 * @param {ExplainDoc} doc - 이미 읽은 Explain
 * @param {string | null} taskDigits - TASK-NNN의 숫자
 * @returns {SelectedSection[]} 허용된 절
 */
function selectSections(doc, taskDigits) {
    const selected = [...doc.sections];
    if (!taskDigits)
        return selected;
    return selected.concat(parseTaskDesign(doc.body, taskDigits));
}
/**
 * Explain 본문에서 해당 Task의 장기 설계 절만 덧붙인다.
 * finalize `buildTaskContext`와 같은 allowlist·순서를 유지해 Plan 입력이
 * 보존 계약과 갈라지지 않게 한다. Do not touch·Checklist는 같은 ### 아래
 * 있어도 고르지 않는다.
 *
 * @param {string} body - frontmatter를 벗긴 Explain 본문
 * @param {string} taskDigits - `001`
 * @returns {SelectedSection[]} 값이 있는 장기 절만
 */
function parseTaskDesign(body, taskDigits) {
    const explainSections = parseExplainSections(body);
    const tasks = explainSections.tasks;
    if (typeof tasks !== 'string' || !tasks.trim())
        return [];
    const chunks = splitTaskChunks(tasks);
    const chunk = chunks.get(taskDigits);
    if (!chunk)
        return [];
    const parts = splitSubheadings(chunk);
    const selected = [];
    pushSection(selected, 'Goal & intent', parts.get('goal'));
    pushSection(selected, 'Current behavior', parts.get('currentBehavior'));
    pushSection(selected, 'Target behavior', parts.get('targetBehavior'));
    pushSection(selected, 'Interface', parts.get('interface'));
    pushSection(selected, 'Touch', parts.get('touch'));
    pushSection(selected, 'Constraints', parts.get('constraints'));
    return selected;
}
function splitTaskChunks(tasksBody) {
    const lines = tasksBody.split('\n');
    const starts = [];
    for (let i = 0; i < lines.length; i += 1) {
        const match = /^###\s+Task\s+(\d{3})\s*$/i.exec(lines[i].trim());
        if (match)
            starts.push({ id: match[1], line: i });
    }
    const out = new Map();
    for (let i = 0; i < starts.length; i += 1) {
        const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
        out.set(starts[i].id, lines.slice(starts[i].line + 1, end).join('\n'));
    }
    return out;
}
function splitSubheadings(chunk) {
    const lines = chunk.split('\n');
    const starts = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        // Touch는 제목 전체 일치(`^####\s+Touch\s*$`)로만 맞춘다. Do not touch를
        // Touch로 승격하면 실행용 범위 통제가 Plan 입력에 장기 금지로 남는다.
        if (/^####\s+Goal\s*&\s*intent\s*$/i.test(line))
            starts.push({ key: 'goal', line: i });
        else if (/^####\s+Current\s+behavior\s*$/i.test(line)) {
            starts.push({ key: 'currentBehavior', line: i });
        }
        else if (/^####\s+Target\s+behavior\s*$/i.test(line)) {
            starts.push({ key: 'targetBehavior', line: i });
        }
        else if (/^####\s+Interface\s*$/i.test(line))
            starts.push({ key: 'interface', line: i });
        else if (/^####\s+Touch\s*$/i.test(line))
            starts.push({ key: 'touch', line: i });
        else if (/^####\s+Constraints\s*$/i.test(line))
            starts.push({ key: 'constraints', line: i });
        else if (/^####\s+/.test(line))
            starts.push({ key: 'other', line: i });
    }
    const out = new Map();
    for (let i = 0; i < starts.length; i += 1) {
        const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
        const key = starts[i].key;
        if (key === 'other')
            continue;
        out.set(key, lines.slice(starts[i].line + 1, end).join('\n'));
    }
    return out;
}
function serializeSections(sections) {
    return sections
        .map((item) => `## ${item.name}\n\n${item.body}`)
        .join('\n\n');
}
/**
 * 허용된 절의 UTF-8 합계가 2,000 byte를 넘기기 전에 자른다.
 * historical 본문은 이미 비어 있어 예산에 넣지 않는다.
 *
 * @param {Array<{ body: string, freshness: Freshness, sections: string[] }>} candidates - 정렬·limit 이후
 * @returns {boolean} 잘렸으면 true
 */
function applyBodyBudget(candidates) {
    let used = 0;
    let truncated = false;
    for (const item of candidates) {
        if (item.freshness === 'historical' || item.body.length === 0)
            continue;
        const remaining = BODY_BUDGET_BYTES - used;
        if (remaining <= 0) {
            item.body = '';
            truncated = true;
            continue;
        }
        const bytes = Buffer.byteLength(item.body, 'utf8');
        if (bytes <= remaining) {
            used += bytes;
            continue;
        }
        item.body = clipUtf8(item.body, remaining);
        used = BODY_BUDGET_BYTES;
        truncated = true;
    }
    return truncated;
}
function clipUtf8(text, maxBytes) {
    const buf = Buffer.from(text, 'utf8');
    if (buf.length <= maxBytes)
        return text;
    let end = maxBytes;
    // 연속 바이트 한가운데를 자르면 깨진 한글이 본문으로 나간다.
    while (end > 0 && (buf[end] & 0xc0) === 0x80)
        end -= 1;
    return buf.subarray(0, end).toString('utf8');
}
function isInsideRepo(absPath, repoReal) {
    if (absPath === repoReal)
        return true;
    const prefix = repoReal.endsWith(path.sep) ? repoReal : `${repoReal}${path.sep}`;
    return absPath.startsWith(prefix);
}
function isFsCode(error, code) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
function isSkippableFsError(error) {
    return isFsCode(error, 'ENOENT')
        || isFsCode(error, 'EACCES')
        || isFsCode(error, 'EPERM')
        || isFsCode(error, 'ELOOP')
        || isFsCode(error, 'ENOTDIR');
}
module.exports = { resolveIntentProvenance };
