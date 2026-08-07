---
type: bouncer.blueprint
title: 활성 포인터에 task 필드를 넣고 소비자를 그 task로 좁힘
description: Blueprint 001
resource: .bouncer/context/epics/019-task-pointer/blueprints/001-pointer-task-field/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-07T09:00:41.016+09:00'
bouncer:
  id: '001'
  epic_id: '019'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  commit_intent:
    - 포인터가 blueprint까지만 가리켜 task 문서가 여럿일 때 어느 것을 작업 중인지 아무도 모름
    - 검증 명령은 첫 선언, 커밋 허용 경로는 합집합이라 실제 작업 범위보다 넓게 열림
---
# 활성 포인터에 task 필드를 넣고 소비자를 그 task로 좁힘

Epic: [019](../../index.md)

## Intent
- 문제: `listTasksDocs`가 task 문서를 여러 개 돌려주지만 포인터는 blueprint까지만
  가리킨다. 그래서 `readVerifyCommand`는 번호가 앞선 선언을, `readAffectedPaths`는
  전 문서의 합집합을 쓴다 — 둘 다 "포인터가 생기면 좁힌다"는 임시 규칙으로 남아 있다.
- 완료 조건: 포인터가 `{blueprint, task, base}`를 담고, 그 task가 지정된 동안
  검증 명령과 커밋 허용 경로가 해당 문서 하나만 본다. task가 없는 포인터는
  기존 동작 그대로다.

## Contract
- 인터페이스
  - `bouncer current --set <blueprint dir> [--task <NNN>]`. `--task`는 세 자리
    숫자이거나 `TASKS-NNN` 형식을 받는다. 레거시 `tasks.md` 단독 blueprint에서는
    그 문서가 유일한 후보다.
  - `--task`를 주지 않으면 번호 오름차순 첫 `ready`/`in_progress` task 문서를
    고른다. 후보가 없으면 task 없이 포인터를 쓴다(기존 동작 유지).
  - `bouncer current` 출력에 선택된 task(문서 경로와 id)가 함께 나온다.
  - 포인터 읽기·쓰기 표면은 `bouncer current` 그대로다. 새 하위 명령을 만들지 않는다.
  - `/bouncer-execute`는 포인터의 task 문서를 브리프로 읽고, `/bouncer-finalize`는
    커밋이 끝난 뒤 같은 blueprint에 남은 열린 task가 있으면 그 task로 포인터를
    옮길지 먼저 확인한다(기존 다음 blueprint 확인보다 앞).
- 데이터·상태
  - 포인터 JSON은 `{ "blueprint": …, "task": …, "base": … }`. `task`는 문서의
    저장소 상대 경로 문자열이거나 없음(키 부재).
  - `task` 키가 없거나 문자열이 아닌 기존 포인터 파일은 task 미지정으로 읽는다 —
    포인터 파일 마이그레이션은 하지 않는다.
  - `--set`으로 blueprint를 바꾸면 이전 task는 남지 않는다.
- 수용 기준: 에픽 성공 기준 1~8.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - `--task`가 가리키는 문서가 없음 — 포인터를 쓰지 않고 종료 코드 2로 거절한다.
    사용 가능한 task 목록을 stderr로 알린다.
  - `tasks.md`와 `tasks-{ddd}.md` 혼재(S14) — 지금처럼 어느 쪽도 고르지 않는다.
    `--set`은 plan 게이트를 먼저 돌리므로 그 단계에서 걸린다.
  - task 문서가 하나도 없음 — plan 게이트가 먼저 막는다. 새 경로를 만들지 않는다.
  - 포인터가 가리키던 task 문서가 나중에 사라짐 — 검증 명령·허용 경로 조회는
    task 미지정과 같게 떨어진다(합집합/첫 선언). 커밋을 조용히 넓게 열지 않도록
    이 폴백은 문서 부재에만 적용한다.
  - `--task`로 이미 `verified`인 문서를 고름 — 허용한다. 재실행·수정 커밋 경로를
    막을 이유가 없다. 자동 선택만 열린 상태를 본다.

## Out of scope
- `verification.md` / `review.md`의 task 단위 분할(G6~G8).
- finalize 커밋 메시지·PR 단위 재정의(G15, `commit_intent`).
- 포인터 자동 전진. 전진은 확인 후 `--set`뿐이다.
- plan 게이트 번호·판정 변경. G3·G4·G5·G10~G12는 018에서 정한 문서별 적용 그대로다.
- 기존 포인터 파일이나 `tasks.md` 문서의 마이그레이션.

## One-commit justification
- 포인터 스키마와 그 포인터를 읽는 두 소비자(검증 명령 조회, 커밋 허용 경로)는
  서로를 전제한다. 스키마만 넣으면 아무도 읽지 않아 동작이 그대로고, 소비자만
  좁히면 읽을 필드가 없다. execute 스킬 문구도 같은 커밋에 있어야 새 필드를
  채우는 주체가 생긴다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
