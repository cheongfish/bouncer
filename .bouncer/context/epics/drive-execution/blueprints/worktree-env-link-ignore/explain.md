---
type: bouncer.explain
title: worktree-env-link-ignore explain
description: Explain for worktree-env-link-ignore
resource: .bouncer/context/epics/drive-execution/blueprints/worktree-env-link-ignore/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T17:29:22.541+09:00'
bouncer:
  id: EXPLAIN-worktree-env-link-ignore
  epic_id: drive-execution
  blueprint_id: worktree-env-link-ignore
  status: published
  comprehension:
    - range_from: 33f69a6f566a35abd5051e2323dd2695fd6ddfa4
      range_to: 99dcdf0ea909216b8b1366d7bf20d8290b6fe8d2
      diff_sha: ed359ff26591dd49684cfbf28ae6c2bb04abbd8f6e73d623b3d6782d5c992a5e
      recorded_at: '2026-10-22T17:30:00.000+09:00'
  task_commits:
    - task: drive-execution/worktree-env-link-ignore/001
      sha: 99dcdf0e
      intent_anchor: task-001
---
# Explain

## Background

git worktree는 ignored 로컬 환경(`.venv`, `.env`)을 가져오지 않는다. Bouncer는 main checkout의 것을 symlink로 공유해 검증 명령이 같은 경로로 돌게 한다. `.gitignore`가 `.venv/`처럼 디렉터리 전용 패턴이면, 아직 없는 `.venv`에 `git check-ignore`가 실패해 링크를 건너뛰고 `.venv/bin/python` 검증이 조용히 깨졌다. 이 변경은 그 패턴에서도 링크하고, symlink가 `git status`에 새지 않게 하며, 건너뛴 이유를 stderr에 남긴다.

## Code

핵심은 `scripts/src/lib/seed-worktree.ts`의 `linkLocalEnv`다.

1. main 원본이 디렉터리면 `rel`에 이어 `rel/`로도 `check-ignore`를 본다(`.venv/` 패턴 대응).
2. 링크 성공 뒤 `git rev-parse --git-path info/exclude`에 `/<rel>`을 한 줄만 추가한다. symlink는 디렉터리가 아니라서 `.venv/`에 걸리지 않고 `??`로 보이기 때문이다.
3. ignore가 아니거나 링크·check-ignore가 실패하면 stderr에 `linkLocalEnv: skip …` 한 줄을 쓰고, exclude 쓰기 실패는 링크 성공과 분리해 `exclude … failed`로 남긴다(반환에는 이미 만든 링크를 넣는다).

`checkIgnoreQuiet`는 exit 1만 “ignored 아님”으로 보고, 그 밖 git 오류는 다시 던진다. 회귀는 `test/seed-worktree.test.js`의 `.venv/` fixture·exclude 중복·stderr skip 테스트가 잡는다.

## Quiz

1. `.gitignore`에 `.venv/`만 있고 worktree에 아직 `.venv`가 없을 때, `linkLocalEnv`가 main의 `.venv` 디렉터리를 링크하려면 ignore 확인을 어떻게 하는가?
   - A) `.venv` pathspec 한 번만 `check-ignore`하고, 실패하면 링크를 건너뛴다
   - B) main 원본이 디렉터리면 `.venv`에 이어 `.venv/`로도 `check-ignore`를 본다
   - C) `.gitignore`를 직접 파싱해 trailing slash 패턴만 골라 매칭한다

## Tasks

### drive-execution/worktree-env-link-ignore/001 · `99dcdf0e`

#### Goal & intent

`linkLocalEnv`가 `.gitignore`의 `.venv/` 같은 디렉터리 전용 패턴을 만나도 main의 `.venv`를 worktree에 symlink한다. 지금은 아직 없는 경로를 `git check-ignore -q -- .venv`로 물어 exit 1이 나오고, 링크를 조용히 건너뛴다. 그 결과 `.venv/bin/python` 검증 명령이 exit 1로 끝난다. 링크를 만든 뒤에는 symlink가 디렉터리가 아니라서 `?? .venv`로 보이므로, 링크한 경로를 저장소 공유 `info/exclude`에 한 번만 추가해 `git status`에 새지 않게 한다. 건너뛴 경우는 사유를 stderr로 한 줄 알린다.

#### Touch

- Modify `scripts/src/lib/seed-worktree.ts` `linkLocalEnv` — main 쪽 원본이 디렉터리면 `rel/`로도 ignore를 확인하고, 링크 뒤 `git rev-parse --git-path info/exclude` 파일에 `/<rel>`을 중복 없이 추가하며, 건너뛴 사유를 stderr에 한 줄 쓴다. 반환값은 새로 만든 링크의 상대 경로 배열 그대로다.
- Modify `test/seed-worktree.test.js` — `.gitignore`가 `.venv/`인 fixture로 링크 생성과 `git status` 무출력을 검증하고, 건너뛴 사유 출력과 `info/exclude` 중복 방지를 검증한다.

### drive-execution/worktree-env-link-ignore/002

#### Goal & intent

슬래시 ignore 패턴 링크 보정이 저장소 전체 CI를 깨지 않는다는 것을 한 번에 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.