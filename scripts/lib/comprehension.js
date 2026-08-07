'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// finalize comprehension gate(G15)용 diff fingerprint 및 explain 섹션 키.
// gate 판정은 validate.ts에 두고, 이 모듈은 base..HEAD의 비-governance 슬라이스를
// 무엇을 측정하고 어떻게 해시할지만 정의한다.
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
// 이 prefix 아래 governance 문서는 hash를 바꾸면 안 된다 — 그렇지 않으면 explain.md
// 작성 자체가 그 문서가 담는 comprehension 기록을 무효화한다.
const DIFF_EXCLUDED_PREFIXES = ['.bouncer/context/'];
// 키만 정의. heading 정규식은 parseSections 옆 validate.ts에 두어
// 빈 섹션 규칙이 G10과 공유되게 한다.
const EXPLAIN_SECTION_DEFS = [
    'background',
    'intuition',
    'code',
    'quiz',
    'understanding',
];
function defaultExec(repoRoot, args) {
    const r = spawnSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        // 결정적 테스트/샌드박스에서 호스트 GIT_* 유출 방지.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return {
        status: typeof r.status === 'number' ? r.status : 1,
        stdout: r.stdout || '',
        stderr: r.stderr || '',
    };
}
function isExcluded(relPath) {
    const p = String(relPath).split('\\').join('/');
    return DIFF_EXCLUDED_PREFIXES.some((prefix) => p === prefix.slice(0, -1) || p.startsWith(prefix));
}
/**
 * governance 문서를 제외한 `base`와 HEAD 사이 변경 경로의 fingerprint.
 * 절대 throw하지 않으며, 모든 실패는 `{ ok: false, reason }`이다.
 *
 * @param {{ repoRoot: string, base: string, exec?: (args: string[]) => { status: number, stdout: string, stderr: string } }} opts
 * @returns {{ ok: true, sha: string } | { ok: false, reason: 'no-base' | 'not-a-repo' | 'exec-failed' }}
 */
function computeDiffSha({ repoRoot, base, exec }) {
    // 주입된 exec는 `git` 뒤 argv만 받는다; 기본값은 repoRoot에 바인딩.
    const run = typeof exec === 'function'
        ? exec
        : (args) => defaultExec(repoRoot, args);
    try {
        const inside = run(['rev-parse', '--is-inside-work-tree']);
        if (inside.status !== 0) {
            return { ok: false, reason: 'not-a-repo' };
        }
        // `--verify`로 "알 수 없는 base"를 이후 diff 실패와 구분한다.
        const verified = run(['rev-parse', '--verify', `${base}^{commit}`]);
        if (verified.status !== 0) {
            return { ok: false, reason: 'no-base' };
        }
        // two-dot 범위: base에는 없고 HEAD에 있는 것. name-only면 충분 —
        // 제외 경로 아래 content churn도 digest에 영향을 주면 안 된다.
        const diff = run(['diff', '--name-only', `${base}..HEAD`]);
        if (diff.status !== 0) {
            return { ok: false, reason: 'exec-failed' };
        }
        const files = diff.stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((f) => !isExcluded(f))
            // git argv/순서가 실행마다 digest를 흔들지 않도록 정렬.
            .sort();
        const sha = createHash('sha256').update(files.join('\n'), 'utf8').digest('hex');
        return { ok: true, sha };
    }
    catch (_e) {
        // spawnSync는 바이너리/cwd 누락 시 throw할 수 있음; 동일한 닫힌 집합으로 매핑.
        return { ok: false, reason: 'exec-failed' };
    }
}
/**
 * resolveTaskUnit.number(숫자)와 entry.task('\d{3}')를 같은 키로 맞춘다.
 * 정규화 불가면 null — 호출측은 missing으로 본다.
 */
function normalizeTaskKey(taskNumber) {
    if (taskNumber == null || taskNumber === '')
        return null;
    const digits = String(taskNumber).padStart(3, '0');
    return /^\d{3}$/.test(digits) ? digits : null;
}
/**
 * explain.md `bouncer.comprehension`에서 대상 task 엔트리 하나.
 * 구 객체 형식은 자동 변환하지 않는다 — G15가 형식 거절로 막는다.
 * 절대 throw하지 않는다.
 *
 * @returns {{ ok: true, entry: object }
 *   | { ok: false, reason: 'not-a-list' | 'missing' | 'duplicate' | 'incomplete' }}
 */
function findComprehensionEntry(comprehension, taskNumber) {
    try {
        // 배열이 아니면(구 단일 객체 포함) 조회 자체가 성립하지 않는다.
        if (!Array.isArray(comprehension)) {
            return { ok: false, reason: 'not-a-list' };
        }
        const want = normalizeTaskKey(taskNumber);
        if (want == null) {
            return { ok: false, reason: 'missing' };
        }
        const matches = [];
        for (const entry of comprehension) {
            if (entry == null || typeof entry !== 'object' || Array.isArray(entry))
                continue;
            const key = normalizeTaskKey(entry.task);
            if (key === want)
                matches.push(entry);
        }
        if (matches.length === 0) {
            return { ok: false, reason: 'missing' };
        }
        // 마지막을 고르면 덮어쓴 기록이 통과한다 — 중복은 거부.
        if (matches.length > 1) {
            return { ok: false, reason: 'duplicate' };
        }
        const entry = matches[0];
        const rangeFrom = typeof entry.range_from === 'string' ? entry.range_from : '';
        const diffSha = typeof entry.diff_sha === 'string' ? entry.diff_sha : '';
        const disposition = typeof entry.disposition === 'string' ? entry.disposition : '';
        // 빈 range_from·diff_sha·disposition은 scaffold 잔여와 같다 — hash mismatch가 아니라 기록 없음.
        if (!rangeFrom.trim() || !diffSha.trim() || !disposition.trim()) {
            return { ok: false, reason: 'incomplete' };
        }
        return { ok: true, entry };
    }
    catch (_e) {
        return { ok: false, reason: 'not-a-list' };
    }
}
module.exports = {
    DIFF_EXCLUDED_PREFIXES,
    EXPLAIN_SECTION_DEFS,
    computeDiffSha,
    findComprehensionEntry,
};
