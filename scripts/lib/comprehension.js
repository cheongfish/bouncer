'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// finalize comprehension gate(G16)용 diff fingerprint 및 explain 섹션 키.
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
 * @param {{ repoRoot: string, base: string,
 *   exec?: (args: string[]) => { status: number, stdout: string, stderr: string } }} opts
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
 * explain.md `bouncer.comprehension`에서 BP 단일 엔트리(배열의 마지막).
 * 0.7의 task별 다중 엔트리는 마이그레이션하지 않고 마지막만 본다 — 읽기 호환
 * 규칙이 변환 함수를 대신한다. 구 단일 객체는 자동 변환하지 않는다.
 * 절대 throw하지 않는다.
 *
 * @returns {{ ok: true, entry: object }
 *   | { ok: false, reason: 'not-a-list' | 'missing' | 'incomplete' }}
 */
function resolveComprehensionEntry(comprehension) {
    try {
        // 배열이 아니면(구 단일 객체 포함) 조회 자체가 성립하지 않는다.
        if (!Array.isArray(comprehension)) {
            return { ok: false, reason: 'not-a-list' };
        }
        if (comprehension.length === 0) {
            return { ok: false, reason: 'missing' };
        }
        const entry = comprehension[comprehension.length - 1];
        if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
            return { ok: false, reason: 'incomplete' };
        }
        const rec = entry;
        const rangeFrom = typeof rec.range_from === 'string' ? rec.range_from : '';
        const diffSha = typeof rec.diff_sha === 'string' ? rec.diff_sha : '';
        const disposition = typeof rec.disposition === 'string' ? rec.disposition : '';
        const quizScore = typeof rec.quiz_score === 'string' ? rec.quiz_score : '';
        // 빈 필수 필드는 scaffold 잔여·퀴즈 스킵과 같다 — hash mismatch가 아니라 기록 없음.
        // quiz_score '0/0'은 값이 있으므로 통과; 막는 것은 빈 문자열뿐이다.
        if (!rangeFrom.trim() || !diffSha.trim() || !disposition.trim() || !quizScore.trim()) {
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
    resolveComprehensionEntry,
};
