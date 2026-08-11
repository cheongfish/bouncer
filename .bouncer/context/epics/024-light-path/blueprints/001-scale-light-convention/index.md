---
type: bouncer.blueprint
title: 경량 경로 선언 규약과 그것을 읽는 스킬 산문
description: Blueprint 001
resource: .bouncer/context/epics/024-light-path/blueprints/001-scale-light-convention/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-11T10:44:40.063+09:00'
bouncer:
  id: '001'
  epic_id: '024'
  blueprint_id: '001'
  status: approved
  commit_type: docs
  commit_intent:
    - 작은 작업도 epic 신설·서브에이전트 왕복·diff 규모 퀴즈라는 고정비를 그대로 치러서 사용자가 Bouncer 밖에서 고치게 됨
    - blueprint에 경량 선언 한 줄을 남기고 plan·execute·explain-diff가 그 선언을 읽어 세 가지만 줄이게 함
---
# 경량 경로 선언 규약과 그것을 읽는 스킬 산문

Epic: [024](../../index.md)

## Intent
- 문제: 경량 경로를 쓸지 말지는 사용자가 정하는데(자동 판정할 근거가 plan
  시점에는 없다 — diff가 아직 없다), 그 선언이 남을 자리가 없다. 대화 맥락은
  `/bouncer-plan` → `/bouncer-execute` → `/bouncer-commit` 사이에서 끊긴다.
  선언을 매 단계 다시 받으면 한 번 잊는 순간 조용히 일반 경로로 돌아간다.
- 완료 조건: blueprint `index.md`의 `bouncer.scale`이 그 선언을 담고, 세 스킬이
  각자 그 값을 읽어 자기 몫을 줄인다. 값이 없거나 `light`가 아니면 지금 동작
  그대로다.

## Contract
- 인터페이스
  - blueprint `index.md` frontmatter `bouncer.scale` — 선택 필드.
    `'light'` 하나만 의미를 갖고, 그 외 값과 키 부재는 모두 일반 경로다.
    `commit_type` / `commit_intent`와 같은 급의 미등록 필드로,
    `scripts/src/lib/schema.ts`에 넣지 않는다.
  - 읽는 쪽은 스킬 산문 셋뿐이다: `/bouncer-plan`(쓰기),
    `/bouncer-execute`(디스패치 형태), `explain-diff`(질문 수).
    `scripts/` 아래 어떤 모듈도 이 값을 읽지 않는다.
- 데이터·상태
  - 공용 epic 규약: 경량 선언 blueprint는 slug가 `maintenance`인 epic 아래
    붙는다. id는 그때 비어 있는 `\d{3}`이며 slug만 고정이다. 그 epic은
    닫지 않는다 — `bouncer.status`를 `closed`로 만들면 다음 경량 작업이
    붙을 자리가 사라진다.
  - 이탈 경로: 작업이 커지면 `scale` 줄을 지우는 것으로 일반 경로에 복귀한다.
    이미 진행 중인 worktree·브랜치·task 문서는 그대로 쓴다.
- 수용 기준: epic Success criteria 1–8 전부.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스
  - `scale`이 `light` 외 임의 문자열이거나 문자열이 아닌 값(숫자, 리스트)일 때
    거부하지 않고 일반 경로로 읽는다. 거부하려면 검증 지점이 필요하고, 그건
    "게이트를 분기하지 않는다"는 이 epic의 전제를 깬다.
  - 키가 아예 없는 기존 blueprint 23개 전부가 일반 경로다. 기존 문서를
    소급 수정하지 않는다.
  - Codex처럼 named agent를 배포할 수 없는 호스트에서는 이미 인라인이므로
    `scale: light`가 아무 차이도 만들지 않는다. 기존 fallback 문구를
    경량 분기로 대체하면 그 호스트가 G8에서 막히므로 두 문장은 공존해야 한다.
  - 퀴즈 1문항은 기존 `1–10, 최소 1` 규칙의 하한이라 G15의 판정 대상
    (`diff_sha` 일치와 엔트리 존재)을 바꾸지 않는다. `quiz_score`는 `N/1`이다.
  - `bouncer-debugger`를 인라인으로 내리지 않는다. verify가 실패했다는 것은
    작업이 예상보다 작지 않았다는 신호이고, 그 순간 조사 품질을 깎으면
    3회 재시도 한도를 소모하는 쪽으로만 움직인다.
  - 공용 `maintenance` epic이 없는 저장소에서 첫 경량 작업은 epic 하나를
    만든다. "epic을 만들지 않는다"가 아니라 "두 번째부터 만들지 않는다"이다.

## Out of scope
- `scripts/` 전체. 이 blueprint는 코드를 바꾸지 않는다 — `scale`은 스킬 산문만
  읽는 규약이고, 읽는 코드를 만드는 순간 게이트 분기로 번진다.
- `scripts/src/lib/schema.ts`의 필드 등록과 `scripts/src/lib/validate.ts`의
  구조 검사.
- `scripts/src/lib/templates.ts` 스캐폴드 템플릿 — 기본값은 "키 없음"이므로
  템플릿에 쓸 것이 없다.
- 공용 `maintenance` epic의 실제 생성과 dogfood 사이클.
- `.bouncer/Distill.md` 직접 편집. 퀴즈 규칙과 named-agent 디스패치 Decision의
  개정은 `/bouncer-finalize`가 `explain.md`에서 승격한다.

## One-commit justification
- 한 커밋이 아니다. 규약을 쓰는 쪽(plan)과 읽는 쪽(execute, explain-diff)은
  검사하는 계약 테스트 파일이 서로 겹치지 않고, 한 커밋으로 묶으면 성격이 다른
  세 스킬의 산문 변경이 한 diff에 섞여 리뷰가 흐려진다.
- task 2개로 나눈다. 001이 규약 정의와 쓰는 쪽(plan·docs), 002가 읽는 쪽
  (execute·explain-diff)이다. 001만 머지된 중간 상태에서도 `npm test`는 통과한다 —
  `scale`이 없는 blueprint에서 002의 두 스킬은 원래 동작이 정답이기 때문이다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `scale: light` 규약 정의와 plan·docs
* [Tasks 002](tasks/002/tasks.md) - execute 인라인과 explain-diff 1문항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
