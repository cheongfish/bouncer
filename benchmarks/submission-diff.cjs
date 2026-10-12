'use strict';

const { execFileSync } = require('node:child_process');

/**
 * 제출 diff에서 뺄 경로를 git pathspec으로 만든다.
 * `.bouncer/`·`.worktrees/`는 에이전트 산출물이 아니라 Bouncer 관리 경로이고, `excludes`는 작업 공간 복원 파일이다.
 * 세 실행 경로(vanilla·bouncer-full·아카이브 재채점)가 같은 목록을 써야 채점 입력이 달라지지 않는다.
 *
 * @param {string[]} excludes - 추가로 뺄 저장소 상대 경로(`setupExcludes` 결과).
 * @returns {string[]} `git diff -- <pathspec>`에 그대로 넘길 인자.
 */
function submissionPathspec(excludes) {
  return ['.', ':(exclude).bouncer', ':(exclude).worktrees', ...excludes.map((p) => `:(exclude)${p}`)];
}

/**
 * 기본 git 실행기. `env`는 `process.env`에 덧씌운다(아카이브 재채점의 GIT_DIR·GIT_WORK_TREE).
 *
 * @param {string[]} args - git 인자.
 * @param {{cwd: string, env?: object}} options - 실행 디렉터리와 추가 환경 변수.
 * @returns {string} stdout.
 */
function defaultRunGit(args, { cwd, env }) {
  return execFileSync('git', args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

/**
 * 기준 커밋 대비 제출 diff를 만든다.
 * `worktree` 모드는 untracked 파일도 담도록 `git add -N --all` 뒤 작업 트리를 비교한다(vanilla).
 * `ref` 모드는 커밋된 ref를 비교한다(bouncer-full, 아카이브 재채점).
 *
 * @param {object} input - diff 입력.
 * @param {'worktree'|'ref'} input.mode - 비교 대상.
 * @param {string} input.cwd - git 실행 디렉터리.
 * @param {string} input.base - 기준 커밋.
 * @param {string} [input.ref] - `ref` 모드의 비교 ref.
 * @param {string[]} input.excludes - 추가 제외 경로.
 * @param {object} [input.env] - git에 덧씌울 환경 변수.
 * @param {{runGit?: (args: string[], options: {cwd: string, env?: object}) => string}} [deps] - git 실행 주입.
 * @returns {string} binary 포함 diff 본문. 모드가 잘못되면 throw한다.
 */
function submissionDiff({ mode, cwd, base, ref, excludes, env }, deps = {}) {
  if (mode !== 'worktree' && mode !== 'ref') throw new Error(`submissionDiff mode must be worktree or ref: ${mode}`);
  if (mode === 'ref' && !ref) throw new Error('submissionDiff ref mode needs ref');
  const runGit = deps.runGit ?? defaultRunGit;
  const options = { cwd, ...(env ? { env } : {}) };
  // 새 파일이 diff에 보이도록 intent-to-add로 올린다. 제외 경로도 올라가지만 diff pathspec이 거르므로 제출에는 없다.
  if (mode === 'worktree') runGit(['add', '-N', '--all'], options);
  const target = mode === 'worktree' ? [base] : [base, ref];
  return runGit(['diff', '--binary', '--no-ext-diff', ...target, '--', ...submissionPathspec(excludes)], options);
}

module.exports = { submissionDiff, submissionPathspec };
