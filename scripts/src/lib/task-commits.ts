'use strict';
const { spawnSync } = require('node:child_process');
const commitSha = require('./commit-sha');
const { normalizeCommitSha } = commitSha;

type GitExecResult = { status: number; stdout: string };
type GitExec = (args: string[]) => GitExecResult;

type ResolvedCommit = { sha: string; sha8: string };

const TRAILER_RE = /^Bouncer-Task\s*:\s*(.*?)\s*$/;
// `%H%x00%B`는 커밋 사이에 구분 NUL이 없어 다음 SHA가 본문 뒤에 붙는다.
// SHA\0 위치를 먼저 찾고, 본문은 다음 SHA 직전까지로 자른다.
const FULL_SHA_NUL_RE = /([0-9a-f]{40})\0/gi;

/**
 * 기본 git 실행기. 주입 가능 exec와 같은 `{ status, stdout }` 모양만 돌려
 * 테스트 seam이 stderr 유무로 갈라지지 않게 한다.
 *
 * @param {string} repoRoot - git cwd
 * @param {string[]} args - `git` 뒤 argv
 * @returns {{ status: number, stdout: string }}
 */
function defaultExec(repoRoot: string, args: string[]): GitExecResult {
  const r = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return {
    status: typeof r.status === 'number' ? r.status : 1,
    stdout: r.stdout || '',
  };
}

/**
 * `git log --format=%H%x00%B` 출력을 `{ sha, body }[]`로 쪼갠다.
 * format이 커밋 경계 NUL을 넣지 않으므로 `\0` split만으로는 다음 SHA가
 * 이전 본문에 붙는다 — SHA\0 앵커로만 경계를 잡는다.
 *
 * @param {string} stdout - git log 원문
 * @returns {Array<{ sha: string, body: string }>} 최신순 커밋
 */
function parseShaBodyLog(stdout: string): Array<{ sha: string; body: string }> {
  const starts: Array<{ sha: string; bodyStart: number; shaStart: number }> = [];
  FULL_SHA_NUL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FULL_SHA_NUL_RE.exec(stdout)) !== null) {
    starts.push({
      sha: match[1].toLowerCase(),
      bodyStart: match.index + match[0].length,
      shaStart: match.index,
    });
  }
  const out: Array<{ sha: string; body: string }> = [];
  for (let i = 0; i < starts.length; i += 1) {
    const end = i + 1 < starts.length ? starts[i + 1].shaStart : stdout.length;
    out.push({
      sha: starts[i].sha,
      body: stdout.slice(starts[i].bodyStart, end),
    });
  }
  return out;
}

/**
 * `base..head` 커밋 본문에서 `Bouncer-Task` trailer만 읽어 stable ID → SHA 맵을 만든다.
 * 문서를 읽지 않는다 — digest와 Explain 제목이 같은 trailer 출처를 쓰게 하기 위함이다.
 * 같은 ID가 여러 커밋에 있으면 최신(git log 기본 최신순)만 남긴다.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot - git cwd(finalize checkout)
 * @param {string} opts.base - 범위 시작(미포함)
 * @param {string} opts.head - 범위 끝(포함). 보통 HEAD
 * @param {string[]} opts.stableIds - 찾을 `EPIC-…/BP-…/TASK-…` 목록
 * @param {(args: string[]) => { status: number, stdout: string }} [opts.exec] - `git` 뒤 argv seam
 * @returns {Map<string, { sha: string, sha8: string }>} 매칭된 ID만 담은 맵
 */
function resolveTaskCommits({
  repoRoot, base, head, stableIds, exec,
}: {
  repoRoot: string;
  base: string;
  head: string;
  stableIds: string[];
  exec?: GitExec;
}): Map<string, ResolvedCommit> {
  const wanted = new Set(
    (Array.isArray(stableIds) ? stableIds : []).filter((id) => typeof id === 'string' && id !== ''),
  );
  const out = new Map<string, ResolvedCommit>();
  if (wanted.size === 0) return out;

  const run = typeof exec === 'function'
    ? exec
    : (args: string[]) => defaultExec(repoRoot, args);

  const logged = run(['log', '--format=%H%x00%B', `${base}..${head}`]);
  if (logged.status !== 0 || !logged.stdout) return out;

  for (const record of parseShaBodyLog(logged.stdout)) {
    let taskId: string | null = null;
    for (const line of record.body.split('\n')) {
      const trailer = TRAILER_RE.exec(line);
      if (!trailer) continue;
      // 같은 본문에 Task trailer가 둘이면 첫 줄만 본다. 상충 값을 고르지 않는다.
      taskId = trailer[1];
      break;
    }
    if (!taskId || !wanted.has(taskId) || out.has(taskId)) continue;
    const sha8 = normalizeCommitSha(record.sha);
    if (!sha8) continue;
    out.set(taskId, { sha: record.sha, sha8 });
  }
  return out;
}

export = { resolveTaskCommits };
