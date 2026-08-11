---
type: bouncer.blueprint
title: 경량 사이클 운용 지침
description: 경량 선언 시 epic 신설·에이전트 왕복·퀴즈 규모를 줄이는 경로를 문서와 스킬 프로즈에 배선
resource: .bouncer/context/epics/024-lightweight-cycle/blueprints/001-lightweight-cycle-guidance/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-10T16:57:46.734+09:00'
bouncer:
  id: '001'
  epic_id: '024'
  blueprint_id: '001'
  status: approved
  commit_type: docs
  commit_intent:
    - 작은 수정에도 큰 사이클을 강요해 루프 밖으로 새는 작업이 있었음
    - 게이트와 문서는 그대로 두고 준비 비용만 낮추려 함
---
# 001 lightweight-cycle-guidance

Epic: [024](../../index.md)

## Intent
- 문제: 경량 경로가 어디에도 정의돼 있지 않아, 작은 작업도 새 epic부터 만들고
  네임드 에이전트를 왕복한다. `skills/bouncer-execute`의 인라인 실행은 지금
  「네임드 에이전트를 못 쓰는 호스트」 조건에만 걸려 있어 선택지가 아니다.
- 완료 조건: 경량 사이클의 정의와 세 가지 절감 항목이 `docs/governance.md`에
  있고, plan·execute·explain-diff 세 스킬이 그 정의를 각자의 단계에서 참조한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: 코드 인터페이스는 없다. 바뀌는 것은 세 스킬의 실행 계약과 공개
  문서 하나다.
  - `docs/governance.md`에 「경량 사이클」 절 — 발동 조건(사용자 선언), 줄어드는
    셋, 그대로인 것, 인라인 리뷰의 한계.
  - `skills/bouncer-plan` step 2 — 경량 선언이면 새 epic id를 뽑지 않고 공용
    유지보수 epic 아래 blueprint만 스캐폴드한다. 그 epic이 없으면 그때 만든다.
  - `skills/bouncer-execute` step 3·5 — 인라인 실행의 허용 조건이 「네임드
    에이전트 미지원」 하나에서 「미지원 **또는** 경량 선언」 둘로 늘어난다.
  - `skills/explain-diff` step 3 — 문항 수 판단 근거에 경량 사이클이면 1을
    고른다는 항목이 붙는다.
- 데이터·상태: 없다. 프론트매터 필드도 config 키도 늘리지 않는다. 경량 여부는
  세션 안에서 사용자가 말한 사실로만 유지되고 어느 문서에도 저장되지 않는다.
- 수용 기준: 에픽 성공 조건 1~7. 판정은 `npm test`의 스킬 계약 테스트와
  `docs/governance.md` 본문으로 한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 경량으로 선언했는데 실제 diff가 커진 경우 — 게이트가 그대로이므로 리뷰와
    explain이 그대로 걸린다. 되돌리는 장치는 만들지 않는다.
  - 공용 유지보수 epic이 아직 없는 저장소 — plan이 일반 순번으로 그 epic을
    한 번 만들고, 이후 blueprint만 쌓는다.
  - 네임드 에이전트가 있는 호스트에서 인라인을 고른 경우 — G8은 리뷰 결과와
    발견사항 처리만 보므로 막지 않는다. 이 사실을 지침에 적어 폴백 문구와
    선언 경로를 혼동하지 않게 한다.
  - 인라인 리뷰는 자기 diff를 자기가 판정한다 — 한계로 명시하고, 판단이 서지
    않으면 네임드 경로로 돌아가라고 적는다.
  - 경량 선언 없이 작은 작업을 돌리는 경우 — 기존 경로 그대로다. 기본값은
    바뀌지 않는다.

## Out of scope
- 신규 CLI·게이트 분기·프론트매터 필드.
- `.bouncer/Distill.md` 직접 수정. 인라인 허용 조건을 못 박은 Decisions 문장은
  `/bouncer-finalize`의 승격 단계에서 개정한다(하드룰 7).
- 이 저장소에 실제 공용 유지보수 epic 디렉터리를 만드는 일.
- `agents/*.md`의 페르소나·가드 문구.
- `docs/workflow.md`·`docs/ARCHITECTURE.md`에 같은 설명을 중복 게재하는 일.

## One-commit justification
<!-- docs/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 지침 본문과 그것을 참조하는 세 스킬 프로즈는 서로 없으면 성립하지 않는다.
  문서만 먼저 넣으면 아무 스킬도 가리키지 않는 절이 남고, 스킬만 먼저 고치면
  「경량 선언」이 정의되지 않은 채 분기가 생긴다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
