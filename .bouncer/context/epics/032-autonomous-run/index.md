---
type: bouncer.epic
title: 자동 주행 루프
description: blueprint 하나를 task 소진까지 주행시키는 커맨드와 자율성 설정
resource: .bouncer/context/epics/032-autonomous-run/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-12T18:01:59.965+09:00'
bouncer:
  id: '032'
  epic_id: '032'
  status: approved
---
# 032 autonomous-run

## Intent
- 문제: task가 셋 있는 blueprint를 닫으려면 사람이 `/bouncer-execute`와
  `/bouncer-commit`을 여섯 번 번갈아 부르고, 매번 커밋 ACQ와 다음-task ACQ에
  답해야 한다. 게이트가 이미 판정을 맡고 있는데 진행 자체를 사람이 밀고 있다.
- 목표: blueprint 하나가 시작 확인 한 번으로 task 소진까지 주행하고, 실패는
  정의된 지점에서 멈춰 사람이 그 자리부터 손으로 잇는다.

## Success criteria
1. `/bouncer-run`이 여섯 번째 워크플로 스킬로 등록되고, 워크플로 스킬 표면
   테스트가 그 이름을 함께 본다.
2. `bouncer init`이 새로 만드는 `config.json`에 `autonomy: "auto"`가 있고,
   `schema.ts`가 허용 값과 기본값을 export한다. 이미 있는 `config.json`은
   `init`이 바꾸지 않는다.
3. `/bouncer-run` 본문에 세 중단 규칙이 적혀 있다 — verify 실패는 debugger
   한 번, review finding 잔존은 두 번, 중단 시 포인터와 worktree 유지.
   debugger 상한은 `/bouncer-execute` · `debugging` · `bouncer-debugger`
   문서에서도 같은 수이며, 그 일치를 테스트가 본다.
4. `autonomy: auto`에서 사람 확인 지점은 시작 ACQ 하나뿐이다.
5. `autonomy: interactive`는 task 경계 확인만 더한다. 문서 구조와 게이트는
   `auto`와 같다.
6. task를 소진하면 루프가 멈추고 `/bouncer-finalize`를 안내한다. finalize를
   스스로 부르지 않는다.
7. `npm test`가 통과한다.

## Out of scope
- 새 CLI 명령·플래그. 다음 task 후보는 `bouncer commit`의 `nextTask`가 이미
  주고, 포인터 전진은 `bouncer current --set`이 한다.
- finalize 자동 진입. 퀴즈와 PR은 사람 확인 지점이며 루프가 삼킬 자리가 아니다.
- blueprint frontmatter의 `autonomy` 오버라이드. BP마다 달라질 이유가 아직
  없고 해석 경로만 둘로 늘어난다.
- `config.json` 값 검사를 게이트나 CLI에 추가하는 일. 게이트 대상은 문서다.
- `bouncer.scale`과 루프 상한의 연동. `light`는 이미 execute 인라인화와 퀴즈
  분량으로 정의돼 있고, 루프가 그 execute를 그대로 부르므로 따로 잇지 않는다.
- blueprint 여러 개 연속 주행. 종료 경계가 PR 단위와 어긋난다.
- context reviewer(G18)·프롬프트 인젝션 방어·벤치마크. 각각 BP-5, BP-6이다.

## Blueprints
* [001 run-loop](blueprints/001-run-loop/index.md) - `/bouncer-run` 스킬 신설과 `autonomy` 설정 등록 — `skills/bouncer-run/`·`scripts/src/lib/{schema,init}.ts`·워크플로 서술 문서
