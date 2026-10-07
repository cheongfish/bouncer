'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync: realExecFileSync } = require('node:child_process');
const MARKER = '# bouncer-pre-commit v1';
const INTERNAL_COMMIT_ENV = 'BOUNCER_INTERNAL_COMMIT';
/**
 * POSIX 단일 인용으로 경로를 hook 본문에 넣는다. 공백·글롭이 셸에서
 * 다시 해석되면 다른 바이너리를 실행하므로, 런처 절대 경로는 데이터로만 둔다.
 *
 * @param {string} value - 인용할 절대 경로
 * @returns {string} POSIX 단일 인용 문자열
 */
function shSingleQuote(value) {
    return `'${value.replace(/'/g, '\'\\\'\'')}'`;
}
/**
 * git hook 둘째 줄 마커인지 본다. 내용이 같아도 위치가 다르면 사용자 hook으로
 * 본다 — 덮어쓰면 기존 검사가 사라지고 chained 이전이 유실된다.
 *
 * @param {string} content - hook 파일 본문
 * @returns {boolean} 둘째 줄이 `# bouncer-pre-commit v1`이면 true
 */
function hasBouncerMarker(content) {
    const lines = content.split(/\r?\n/);
    return lines[1] === MARKER;
}
/**
 * PATH의 `bouncer`를 먼저 쓰고, 없을 때만 설치 시점 런처로 폴백하는 hook 본문.
 * 이전 hook은 내부 커밋 env와 무관하게 먼저 실행한다 — 표식은 Bouncer
 * 검사만 건너뛰라는 뜻이지 사용자 hook을 끄라는 뜻이 아니다.
 *
 * @param {string} launcherPath - 기록할 런처 절대 경로
 * @returns {string} POSIX sh hook 본문
 */
function renderHookScript(launcherPath) {
    const quoted = shSingleQuote(launcherPath);
    return `#!/bin/sh
${MARKER}
dir=$(dirname -- "$0")
prev="$dir/pre-commit.bouncer-prev"
if [ -f "$prev" ]; then
  if [ -x "$prev" ]; then
    "$prev" "$@"
  else
    sh "$prev" "$@"
  fi
  st=$?
  if [ "$st" -ne 0 ]; then
    exit "$st"
  fi
fi
if [ "\${${INTERNAL_COMMIT_ENV}-}" = "1" ]; then
  exit 0
fi
if command -v bouncer >/dev/null 2>&1; then
  bouncer_bin=bouncer
elif [ -x ${quoted} ]; then
  bouncer_bin=${quoted}
else
  echo "bouncer pre-commit: CLI not found; allowing commit" >&2
  exit 0
fi
"$bouncer_bin" commit-guard --staged
`;
}
/**
 * git spawn env에 내부 커밋 표식을 붙인다. hook이 이 값이면 commit-guard를
 * 건너뛴다 — G17을 이미 통과한 bouncer 커밋이 인덱스 잔여로 다시 막히지
 * 않게 하기 위함이다.
 *
 * @param {NodeJS.ProcessEnv} [base] - 복사할 env. 생략 시 process.env
 * @returns {NodeJS.ProcessEnv} BOUNCER_INTERNAL_COMMIT=1 이 설정된 사본
 */
function internalCommitEnv(base = process.env) {
    return { ...base, [INTERNAL_COMMIT_ENV]: '1' };
}
/**
 * Git common dir의 hooks/pre-commit에 Bouncer hook을 설치한다.
 * core.hooksPath가 있으면 git이 그 디렉터리만 보므로 기본 hooks/에 쓰면
 * 죽은 파일이 되고, 사용자 hook을 옮기지도 못한 채 검사가 빠진다.
 * 이미 `pre-commit.bouncer-prev`가 있고 현재 파일이 비-Bouncer면 throw한다.
 * Linux `renameSync`는 대상을 덮어쓰므로, 막지 않으면 첫 설치가 저장한
 * 사용자 hook이 사라진다. 공개 반환 상태를 늘리지 않기 위해 새 값을 두지 않는다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - 대상 저장소 루트
 * @param {string} opts.launcherPath - PATH에 bouncer가 없을 때 쓸 런처 절대 경로
 * @param {{ execFileSync?: Function, fs?: object }} [opts.deps] - git·fs 테스트 seam
 * @returns {{ preCommitHook: PreCommitHookState, warning?: string }}
 *   installed: 새 파일. chained: 기존 hook을 pre-commit.bouncer-prev로 옮김.
 *   already-installed: 마커가 있어 본문만 갱신. skipped-hooks-path: core.hooksPath.
 *   skipped-no-git: git common dir을 못 찾음.
 *   prev가 이미 있으면 throw하므로 이 객체는 반환되지 않는다.
 */
function installPreCommitHook({ repoRoot, launcherPath, deps, }) {
    const execFileSync = (cmd, args, opts) => String((deps && deps.execFileSync ? deps.execFileSync : realExecFileSync)(cmd, args, opts));
    const io = {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        writeFileSync: fs.writeFileSync,
        renameSync: fs.renameSync,
        chmodSync: fs.chmodSync,
        mkdirSync: fs.mkdirSync,
        ...(deps && deps.fs ? deps.fs : {}),
    };
    let commonDir;
    try {
        // 1. common dir이 있어야 worktree여도 같은 hooks/에 설치된다.
        commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    }
    catch (_error) {
        // git이 아니거나 common dir 조회 실패만 흡수. 그 외 I/O는 호출부에 둔다.
        return { preCommitHook: 'skipped-no-git' };
    }
    if (!commonDir)
        return { preCommitHook: 'skipped-no-git' };
    let hooksPath = '';
    try {
        hooksPath = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        }).trim();
    }
    catch (_error) {
        // git config --get 은 unset이면 exit 1. 설치를 진행한다.
    }
    if (hooksPath) {
        return {
            preCommitHook: 'skipped-hooks-path',
            warning: `core.hooksPath is set (${hooksPath}); skipping Bouncer pre-commit hook install`,
        };
    }
    const hookDir = path.join(path.resolve(repoRoot, commonDir), 'hooks');
    const hookFile = path.join(hookDir, 'pre-commit');
    const prevFile = path.join(hookDir, 'pre-commit.bouncer-prev');
    io.mkdirSync(hookDir, { recursive: true });
    let state = 'installed';
    if (io.existsSync(hookFile)) {
        const existing = io.readFileSync(hookFile, 'utf8');
        if (hasBouncerMarker(existing)) {
            state = 'already-installed';
        }
        else {
            // 사용자 hook을 지우지 않는다. 새 본문이 이 파일을 먼저 실행한다.
            // prev가 있으면 renameSync가 그 내용을 덮어쓴다(POSIX). 첫 설치가
            // 맡긴 원본을 지키기 위해 거부하고, 현재 hook도 쓰지 않는다.
            if (io.existsSync(prevFile)) {
                throw new Error(`pre-commit.bouncer-prev already exists at ${prevFile}; refusing to overwrite the saved user hook`);
            }
            io.renameSync(hookFile, prevFile);
            state = 'chained';
        }
    }
    io.writeFileSync(hookFile, renderHookScript(launcherPath));
    // git은 실행 비트가 없는 hook을 건너뛴다. 내용만 있으면 검사가 침묵한다.
    io.chmodSync(hookFile, 0o755);
    return { preCommitHook: state };
}
module.exports = {
    installPreCommitHook,
    internalCommitEnv,
    MARKER,
    INTERNAL_COMMIT_ENV,
};
