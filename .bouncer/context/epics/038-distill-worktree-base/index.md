---
type: bouncer.epic
title: Distill 경로 해석을 현재 checkout 기준으로 정렬
description: Distill base 판단 규칙을 CLI 해석기 한 곳에 두고 승격을 쓰는 checkout과 대상 파일을 일치시킨다
resource: .bouncer/context/epics/038-distill-worktree-base/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-15T14:26:51.287+09:00'
bouncer:
  id: '038'
  epic_id: '038'
  status: approved
---
# 038 distill-worktree-base

## Intent
- 문제: Distill 승격은 `bouncer project-root`가 가리키는 main worktree에 쓰는데
  `bouncer finalize`는 실행된 checkout의 index로 커밋한다. 두 worktree가 다르면
  승격 내용이 remainder 커밋과 PR에서 조용히 빠지고 finalize는 성공으로 끝난다.
- 목표: Distill base 판단 규칙을 CLI 해석기 한 곳에 두고, 승격을 쓰는 checkout과
  finalize가 커밋하는 checkout을 같게 만든다.

`/bouncer-plan`·`/bouncer-execute`·`/bouncer-run`은 계속 `--repo
"${PROJECT_ROOT}"`로 main worktree의 Distill을 **읽는다**. 세 스킬은 stdout만
소비하고, 다른 blueprint가 base 브랜치에 먼저 병합했을 때 더 최신인 쪽을 읽는
편이 낫다. 승격 **쓰기**만 현재 checkout으로 간다. 읽기 base와 쓰기 base가
갈리는 것은 의도된 선택이며, 이 에픽은 그 경계를 없애지 않고 명시한다.

## Success criteria
1. linked checkout에 `.bouncer/Distill.md`가 있으면 `bouncer distill`이 그
   checkout을 base로 읽고, payload `repoRoot`로 그 절대 경로를 보고한다.
2. linked checkout에 Distill이 없으면 종전대로 main worktree를 base로 쓴다.
3. `/bouncer-finalize`의 승격 대상 경로가 payload `repoRoot`에서 나오고,
   `bouncer project-root`로 별도 조립하지 않는다. 승격 audit과 remainder 커밋이
   같은 checkout에서 실행된다는 cwd 계약이 스킬 본문에 남는다.
4. execute worktree에서 `finalize --yes`를 실행하면 `.bouncer/Distill.md`와
   등록된 shard 변경이 staged 목록에 들어간다.
5. `npm test`가 통과한다.

## Out of scope
- 이슈 방안 B — finalize가 main worktree 변경을 execute index로 복사하고 원본을
  HEAD로 원복하는 방식.
- 승격 누락을 별도로 탐지해 중단시키는 가드. 경로가 하나로 모이면 조건 자체가
  생기지 않는다.
- `commit-safety` / `commit-guard` / `runtime-state`의 worktree 계산.
- Distill 라우팅 정책(`distill.routing_enabled`)과 shard 구성 변경.
- `bouncer project-root` 명령의 반환값 의미 변경.

## Blueprints
* [001 checkout-relative-distill](blueprints/001-checkout-relative-distill/index.md) - Distill base 해석을 현재 checkout 우선으로 바꾸고(`scripts/src/lib/distill.ts`, `cli-project-commands.ts`) 승격 경로 계약을 CLI payload로 옮김(`CLAUDE.md`, finalize/spec-authoring 스킬)
