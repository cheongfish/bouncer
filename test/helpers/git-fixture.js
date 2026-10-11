'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/**
 * git 저장소 템플릿을 한 번 만들고, 요청마다 새 임시 디렉터리로 복사해 주는 fixture를 만든다.
 *
 * 느린 테스트 파일이 테스트마다 `git init`과 기본 커밋을 반복하던 비용을 파일당 1회로
 * 줄이기 위한 공용 준비 지점이다. `setup`은 worktree를 만들기 전 단계(init, config,
 * 테스트 사이에 같은 커밋)만 수행해야 한다. `.git/worktrees/*`와 worktree의 `.git` 파일은
 * 절대 경로를 담아 복사하면 깨지므로, worktree는 `copy()` 뒤 각 테스트가 만든다.
 * 이 helper는 node:test hook을 스스로 등록하지 않는다. 호출 파일이 `after()`에서
 * `dispose()`를 불러야 한다.
 *
 * @param {(dir: string) => void} setup - 빈 템플릿 디렉터리를 받아 저장소를 준비하는 함수
 * @returns {{ dir: string, copy: () => string, dispose: () => void }}
 *   `dir`은 템플릿 절대 경로, `copy()`는 새 복사본 절대 경로를 돌려준다.
 *   `copy()`는 템플릿에 `.git/worktrees`가 있으면 Error를 던진다.
 *   `dispose()`는 템플릿과 그때까지 만든 복사본을 모두 지운다.
 */
function createGitTemplate(setup) {
  // realpath: macOS 등에서 tmpdir이 심볼릭 링크여도 git이 보고하는 경로와 일치시키기 위함.
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-git-template-')));
  const copies = [];
  try {
    setup(dir);
  } catch (error) {
    // setup이 실패하면 호출자가 dispose할 handle을 받지 못하므로 여기서 치우고 그대로 다시 던진다.
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  return {
    dir,
    copy() {
      if (fs.existsSync(path.join(dir, '.git', 'worktrees'))) {
        throw new Error('git template must not contain .git/worktrees: create worktrees after copy()');
      }
      const target = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-git-copy-')));
      copies.push(target);
      fs.cpSync(dir, target, { recursive: true });
      return target;
    },
    dispose() {
      for (const target of [dir, ...copies]) fs.rmSync(target, { recursive: true, force: true });
      copies.length = 0;
    },
  };
}

module.exports = { createGitTemplate };
