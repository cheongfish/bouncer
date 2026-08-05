---
type: bouncer.epic
title: 008 worktree-seed
description: Epic 008
resource: .bouncer/context/epics/008-worktree-seed/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T05:30:59.794Z'
bouncer:
  id: '008'
  epic_id: '008'
  status: approved
---
# 008 worktree-seed

## Intent
- 문제: `/bouncer-plan`에는 커밋 단계가 없어 plan 산출물이 base working tree에만
  남는다. `/bouncer-execute`는 base의 커밋된 HEAD에서 worktree를 만들므로
  worktree에 `tasks.md`가 없고, "tasks.md is the sole brief"라는 execute 전제가
  성립하지 않는다. 덤으로 plan 산출물이 base에 ghost `??`/`M`으로 남는다.
- 목표: worktree 생성 직후 하니스 명령이 plan 컨텍스트 산출물을 worktree로
  이전하고 base를 원상복구해, execute가 브리프를 읽을 수 있고 base는 깨끗하다.

## Success criteria
1. 이전 대상은 `finalize.makeAllowed`의 컨텍스트 기본 허용과 같은 닫힌 집합
   (blueprint dir 트리 · `<epicDir>/index.md` · `.bouncer/context/index.md`)
   중 base에서 untracked이거나 HEAD 대비 변경된 파일뿐이다. `affected_paths`
   코드와 무관한 dirty 파일은 옮기지 않는다.
2. 대상 파일이 worktree에 동일 상대경로로 복사되고, 없는 상위 디렉터리는 생성된다.
3. base 정리는 HEAD 존재 여부로 분기한다 — HEAD에 있으면 `git checkout --`로
   복원, HEAD에 없고 staged면 `git rm --cached` 후 삭제, 순수 untracked면 삭제.
4. base 정리는 복사본 내용 일치를 확인한 뒤에만 수행한다. worktree에 같은 경로가
   이미 있고 내용이 다르면 base를 건드리지 않고 실패하며, 내용이 같으면 건너뛴다.
5. 이전 대상이 없으면 no-op으로 성공한다 (`{ ok: true, moved: [], restored: [] }`).
6. 새 명령이 `bouncer --help` USAGE와 `docs/cli.md` 표에 노출되고,
   `/bouncer-execute` SKILL이 `git worktree add` 직후 base cwd에서 이 명령을
   호출하도록 문서화되며 표면 테스트가 이를 강제한다.
7. `npm run build` 후 `npm test` 통과.

## Out of scope
- `/bouncer-plan`을 처음부터 worktree 안에서 실행하도록 바꾸는 것.
- finalize 이후의 추가 base cleanup (seed가 정상 동작하면 불필요).
- worktree 삭제·merge 자동화.
- 로컬 전용 dirty 파일(`.bouncer/config.json`, graphify 산출물 등) 이전.

## Blueprints
* [001 seed-plan-artifacts](blueprints/001-seed-plan-artifacts/index.md) - plan 컨텍스트 산출물을 worktree로 옮기는 `seed-worktree` 명령과 execute 배선
