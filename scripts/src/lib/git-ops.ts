'use strict';
const { execFileSync } = require('node:child_process');
import preCommitHook = require('./pre-commit-hook');
const { internalCommitEnv } = preCommitHook;


// migrate-ids.ts와 같은 조합: 별도 YAML 직렬화 경로를 새로 만들지 않는다.
// validate↔finalize 순환을 피하려고 scope 헬퍼는 여기 두지 않는다(재수출도 안 함).

type GitApi = {
  changedFiles: () => string[];
  untrackedFiles: () => string[];
  /** All paths tracked by the index, including clean paths absent from diff. */
  trackedFiles?: () => string[];
  stage: (files: string[]) => void;
  commit: (msg: string) => void;
  /** HEAD의 전체 또는 abbrev 객체 이름. 없으면 commit_sha 기록을 건너뛴다. */
  headSha?: () => string;
};



function realGit(repoRoot: string): GitApi {
  const run = (args: string[]) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }) as string;
  const lines = (s: string) => s.split('\n').filter(Boolean);
  return {
    changedFiles: () => lines(run(['diff', '--name-only', 'HEAD'])),
    untrackedFiles: () => lines(run(['ls-files', '--others', '--exclude-standard'])),
    trackedFiles: () => lines(run(['ls-files', '--cached'])),
    stage: (files: string[]) => { if (files.length) run(['add', '--', ...files]); },
    commit: (msg: string) => {
      // remainder 커밋도 G17 이후라 hook이 인덱스를 다시 보면 순환 차단한다.
      execFileSync('git', ['commit', '-m', msg], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: internalCommitEnv(),
      });
    },
    headSha: () => run(['rev-parse', 'HEAD']).trim(),
  };
}



/**
 * checkout이 실제로 가리키는 local branch를 읽는다. detached HEAD·삭제된
 * worktree·Git 조회 실패는 null로 보존한다. finalize는 provenance를 못 읽었다고
 * 닫기를 거절하지 않으므로, 계산한 이름으로 빈 사실을 채우지 않는다.
 *
 * @param {string | null} worktreePath - branch를 확인할 checkout 경로
 * @returns {string | null} 실제 branch 또는 확인 불가를 뜻하는 null
 */
function resolveCheckoutBranch(worktreePath: string | null): string | null {
  if (!worktreePath) return null;
  try {
    const branch = String(execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      cwd: worktreePath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })).trim();
    return branch || null;
  } catch (_error) {
    // detached HEAD와 접근 불가 checkout은 provenance에서 구별할 branch가 없다.
    return null;
  }
}


export = { realGit, resolveCheckoutBranch };
