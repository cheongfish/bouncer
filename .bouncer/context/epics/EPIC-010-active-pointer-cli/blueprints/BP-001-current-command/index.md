---
type: bouncer.blueprint
title: 활성 포인터 CLI 명령 추가와 워크플로 스킬 배선
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-010-active-pointer-cli/blueprints/BP-001-current-command/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-04T08:59:20.769+09:00'
bouncer:
  id: BP-001
  epic_id: EPIC-010
  blueprint_id: BP-001
  status: approved
  commit_type: feat
  commit_intent:
    - 활성 포인터를 조회·기록·해제할 지원되는 표면이 없어 스킬마다 내부 모듈을 직접 부르고 문서가 실제 파일 위치와 어긋났음
    - 포인터가 비었을 때 무엇이 실행 가능한지 하네스가 답하게 해 끝난 계획을 다시 하라고 안내하지 않게 함
---
# BP-001 current-command

Epic: [EPIC-010](../../index.md)

## Intent
- 문제: 포인터를 다루는 코드는 `current.js`에 있지만 CLI에는 없다. 그래서 세 워크플로
  스킬이 `node -e "require('.../scripts/lib/current')..."` 형태로 내부 모듈을 직접 부르고,
  사용자가 포인터를 다시 지정하려면 그 한 줄을 손으로 짜야 한다. 지원되는 방법이 없으니
  execute는 포인터가 비었을 때 원인을 구분하지 못하고 일률적으로 "먼저 계획하라"고 말한다.
- 완료 조건: `bouncer current`가 읽기·`--set`·`--clear` 세 동작을 제공하고, 포인터가
  비었을 때 실행 가능한 후보를 같은 출력에 담는다. plan·execute·finalize가 그 명령만
  부르고, 포인터 파일 위치를 잘못 적은 문장이 사라진다. `npm test` 통과.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지. -->
- 인터페이스 (명령): `bouncer current`가 세 형태를 받는다. 출력은 기존 명령과 같이 stdout
  JSON이고, 종료 코드는 `0` 성공 / `1` 판정 실패 / `2` 사용법 오류로 기존 관례를 따른다.
  - 인자 없음 — 활성 포인터를 읽는다. 포인터가 있으면 그것만, 없으면 실행 가능한 후보
    목록을 함께 돌려준다. 후보는 포인터가 없을 때만 담는다 — 이 출력이 답해야 하는 질문이
    "지금 무엇을 할 수 있는가"이고, 사이클 진행 중에는 답이 이미 포인터이기 때문이다.
  - `--set <blueprint dir>` — 대상에 plan 게이트를 돌려 통과할 때만 기록한다. 실패하면
    포인터를 건드리지 않고 게이트 실패 목록을 그대로 보고한다. `--base <branch>`는 선택이며
    생략하면 프로젝트 설정의 `base_branch`를 쓴다.
  - `--clear` — 포인터를 제거한다. 포인터가 없어도 성공으로 끝난다 (멱등).
- 인터페이스 (후보 열거): 포인터 도메인 모듈이 후보 열거 함수를 내보낸다. 후보는
  blueprint가 `approved`이고 tasks가 `ready`(계획 완료, 미착수) 또는 `in_progress`
  (착수 후 중단, 재개 가능)인 블루프린트다. `verified`는 후보가 아니다. 정렬은 경로
  오름차순으로 고정해 출력이 파일시스템 순서에 흔들리지 않게 한다.
- 인터페이스 (스킬 배선): plan은 8단계 포인터 기록을 `--set`으로, execute와 finalize는
  프리플라이트 읽기를 인자 없는 형태로 바꾼다. execute의 `null` 처리 문구는 후보 유무로
  갈라진다 — 후보가 있으면 `--set`을 안내하고, 없을 때만 `/bouncer-plan`을 안내한다.
- 데이터·상태: 없다. 포인터 파일의 위치와 `{ blueprint, base }` 형식은 그대로이며 이
  blueprint는 그 파일을 읽고 쓰는 경로만 CLI로 끌어올린다. 새 설정 키·새 문서 필드 없음.
- 수용 기준: EPIC-010 성공 조건 1–7이 모두 참이 된다. `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: Git 저장소가 아니어서 포인터 경로를 못 구하는 경우(기존
  `runtimePaths`의 `unavailable` 계약을 그대로 노출), `--set` 대상이 정규 블루프린트 경로가
  아닌 경우, `.bouncer/context/epics`가 없거나 비어 후보가 0건인 경우, 문서가 깨져 파싱에
  실패하는 블루프린트가 섞여 있는 경우(그 항목만 건너뛰고 열거는 계속된다).

## Out of scope
- finalize가 커밋 후 다음 후보를 통지하는 것. 이 blueprint가 만드는 열거 함수의 첫
  후속 소비자이지만, finalize의 반환 계약과 그 테스트를 함께 건드려야 하므로 분리한다.
- 포인터 자동 전진. 커밋 가드 계약과 정면으로 충돌한다.
- 포인터 파일 위치·형식 변경. `runtime-state`는 손대지 않는다.
- 커밋 가드·게이트 판정 변경. `--set`은 기존 plan 게이트를 **호출**할 뿐 새 판정을 만들지
  않는다.
- 후보에 우선순위·추천을 매기는 것. 열거는 결정적 정렬만 하고 고르는 것은 사용자다.
- `bouncer advise`처럼 단계를 추론해 다음 명령을 제안하는 기능.

## One-commit justification
- 변경의 실체는 하나다 — 포인터 접근을 내부 모듈 직호출에서 CLI 한 곳으로 옮기는 것.
- 쪼갤 수 없다. 명령만 만든 커밋은 아무도 부르지 않는 표면을 남기고, 스킬만 고친 커밋은
  부를 명령이 없어 워크플로가 그 자리에서 깨진다. 문서의 잘못된 경로 문장도 같은 이유로
  같은 커밋에 있어야 한다 — 그 문장이 가리키던 대상이 이 커밋에서 바뀐다.
- 코드 변경은 `cli.ts`와 `current.ts` 두 파일이고 게이트 판정은 재사용하므로, 회귀 범위가
  포인터 읽기/쓰기 경로로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- distill.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
