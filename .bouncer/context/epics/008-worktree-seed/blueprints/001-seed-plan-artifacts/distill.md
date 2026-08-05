---
type: bouncer.distill
title: 001 distill
description: Distill for 001
resource: .bouncer/context/epics/008-worktree-seed/blueprints/001-seed-plan-artifacts/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T05:30:59.813Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: '008'
  blueprint_id: '001'
  status: published
---
# Distill

## 승격 대상 (durable)

- `git worktree add`가 만든 체크아웃은 **빈 디렉터리가 아니다**. tracked 파일은
  전부 HEAD 내용으로 이미 존재하므로, "worktree에 파일이 있으면 남의 작업"이라는
  가정은 틀린다. 존재 여부가 아니라 HEAD 블롭과의 비교로 판정해야 한다.
- `git checkout -- <path>`는 **index에서** 복원한다. staged 변경은 그대로 남으면서
  명령은 성공하므로, HEAD를 명시한 `git checkout HEAD -- <path>`를 써야 index와
  working tree가 함께 돌아간다.
- `git show HEAD:<path>`는 필터를 적용하지 않은 원본 블롭이다. 체크아웃된 파일과
  바이트 비교를 하려면 `git cat-file --filters HEAD:<path>`를 써야 autocrlf /
  `text=auto` 환경에서 오탐이 나지 않는다.
- `git diff --name-only HEAD`는 staged 변경과 **삭제**를 모두 보고한다. 수집 결과를
  그대로 `readFileSync`에 넘기면 삭제된 경로에서 터진다.
- 되돌릴 수 없는 git 동사(`checkout`, `rm --cached`)를 쓰는 명령은 "복사 → 내용
  확인 → 정리" 순서를 지키고, 확인 실패 시 원본을 한 글자도 건드리지 않는다.

## 사이클 회고 (승격하지 않음)

- 첫 구현의 테스트가 `--to` 대상으로 빈 `mkdtemp` 디렉터리를 썼다. 그 결과 blocker
  두 건(pristine 체크아웃 오탐, staged 복원 실패)이 전부 초록불 뒤에 숨었다.
  **테스트 픽스처가 실제 대상과 다른 종류의 객체면, 통과는 아무것도 증명하지 않는다.**
  리뷰어가 실제 `git worktree add`로 재현해서야 드러났다.
- 이번 BP는 자기 자신이 없애려는 마찰을 그대로 겪었다 — plan 문서를 손으로
  worktree에 복사해야 했다. 다음 사이클부터는 step 2가 처리한다.

## 다음 후보

- worktree 정리(merge 후 `git worktree remove`) 자동화는 여전히 사용자 몫이다.
- `seed-worktree`의 역방향(worktree → base 회수)은 필요해진 적이 없으므로 만들지
  않았다. 필요해지면 그때 별도 BP로.
