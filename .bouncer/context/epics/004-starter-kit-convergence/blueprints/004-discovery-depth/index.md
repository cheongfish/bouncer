---
type: bouncer.blueprint
title: 발견 단계 질문 범위와 계획 인계 계약 명시
description: Blueprint 004
resource: .bouncer/context/epics/004-starter-kit-convergence/blueprints/004-discovery-depth/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-04T09:46:18.557+09:00'
bouncer:
  id: '004'
  epic_id: '004'
  blueprint_id: '004'
  status: approved
  commit_type: docs
  commit_intent:
    - 발견 단계가 목표·범위·비목표·성공 조건 골격만 물어 엣지 케이스와 기존 작업 흐름과의 중복이 계획에 도달하지 못했음
    - 한 패스에서 물어야 할 항목과 계획으로 넘길 산출 이름을 문서에 고정해 인계 누락을 없앰
---
# 004 discovery-depth

Epic: [004](../../index.md)

## Intent
- 문제: `discovery`는 Request → Goal → Scope → Non-goals → Success → Confirmation
  골격만 유지한다. 무엇을 물어야 그 칸이 채워지는지, 채운 결과를 다음 스킬이
  어떤 이름으로 받는지가 없다. 그래서 엣지 케이스·실패 모드가 blueprint Contract의
  「실패 모드·엣지 케이스」 칸에 도달하지 못하고, 새 epic/blueprint를 열 때 기존
  스트림과 겹치는지도 점검되지 않는다. 겹침 판정의 유일한 단서인 epic `index.md`
  Blueprints 한 줄에도 무엇을 실어야 하는지 기준이 없다.
- 완료 조건: `discovery`가 질문 체크리스트·사전 읽기 의무·plan 인계 계약을 본문에
  담고, `/bouncer-plan` 1단계가 그 산출을 이름으로 인용하며, epic 템플릿 Blueprints
  주석이 겹침 판정 기준을 제시한다. 리뷰 루브릭에 「테스트 없는 동작 변경」이 후보로
  들어간다. `npm test` 통과.

## Contract
- 인터페이스 (`discovery` 산출 계약): 스킬 본문이 확인 단계에서 이름 붙여 내보내는
  항목을 고정한다 — Goal / Scope / Non-goals / Success criteria에 더해
  **Edge cases & failure modes**와 **Overlap**(기존 epic·blueprint·Distill과의 관계).
  `spec-authoring`은 이 이름들을 blueprint Contract의 「실패 모드·엣지 케이스」와
  epic Out of scope로 옮긴다. 산출은 대화 안에 머물며 새 파일로 영속화하지 않는다.
- 인터페이스 (사전 읽기 의무): `discovery`는 프레이밍 전에
  `.bouncer/context/epics/` 인덱스와 `.bouncer/context/Distill.md`를 읽는다.
  Distill은 하드룰 7이 이미 `/bouncer-plan`에 부과한 의무이므로 새 의무가 아니라
  discovery 시점으로 당기는 것이다.
- 인터페이스 (`/bouncer-plan` 1단계): 확인된 discovery 산출을 이름으로 인용해,
  Success criteria 외의 항목도 4단계 authoring에 전달되게 한다.
- 인터페이스 (epic 템플릿): `templates.ts`의 epic `## Blueprints` 주석이 한 줄에
  실어야 할 것(무엇을 바꾸는가 + 어디를 건드리는가)을 지시한다. 목록 형식·링크
  구조는 그대로다.
- 인터페이스 (리뷰 루브릭 거부 항목): Code quality가 「동작을 바꾸면서 테스트를
  더하거나 고치지 않은 diff」를 `minor`/`major` 후보로 받는다. 순수 문서·설정 변경은
  이 항목의 대상이 아니다. 루브릭은 `skills/review/SKILL.md`,
  `skills/review/reviewer-prompt.md`, `agents/bouncer-reviewer.md` 세 곳이 같은
  판정을 실어야 한다.
- 데이터·상태: 없음. `schema.ts`, 게이트 코드(G/S), `.bouncer/` 런타임 상태 파일,
  frontmatter 필드 집합 모두 불변. 산출물은 에이전트가 읽는 문서와 그 문서를 고정하는
  테스트뿐이다.
- 수용 기준: 004 Success criteria **5번**(discovery가 한 패스에서 중복까지
  점검하고 출력 계약을 명시)과 **6번**(새 게이트 코드·새 런타임 상태 파일 없이 달성).
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `.bouncer/context/epics/`가 비어 있거나 `Distill.md`가 없는 첫 사이클 —
    읽기 의무가 하드 실패가 되면 안 된다. 없으면 「겹침 없음」으로 기록하고 진행한다.
  - `discovery`를 스킬 이름으로 직접 부르는 blueprint 밖 사용 — frontmatter
    `description`의 예외 문구가 그대로 성립해야 하므로 읽기 의무를 절대 조건으로
    쓰지 않는다.
  - `templates.ts` 수정은 커밋되는 `scripts/lib/templates.js` 재생성을 동반한다.
    `npm test`의 `pretest`가 `tsc`를 돌리므로 emit이 diff에 함께 남아야 한다.
  - 리뷰 루브릭이 세 파일 중 일부에만 들어가면 명명 에이전트 경로와 폴백 경로의
    판정이 갈린다.

## Out of scope
- 새 스킬·새 게이트 코드(G/S)·새 훅·`schema.ts` 필드·`.bouncer/` 런타임 상태 파일.
- discovery 산출을 별도 문서로 영속화. `.bouncer/context/` 다섯 문서 체계를 유지한다.
- `bouncer validate` 판정 로직 변경. 이 blueprint는 판정이 아니라 안내를 바꾼다.
- 겹침 점검의 자동화(그래프 질의·인덱스 파싱 CLI). 사람이 읽고 판단하는 절차다.
- 「테스트 없는 동작 변경」의 게이트 강제. 리뷰 후보 항목일 뿐 자동 차단이 아니다.
- 기존 epic `index.md` Blueprints 줄의 소급 재작성. 템플릿과 안내만 바꾼다.
- 004 002의 처분과 저장소 루트 미추적 문서 처리. 별개 결정 항목이다.

## One-commit justification
- 변경의 실체는 에이전트가 읽는 지시문 텍스트 하나다 — discovery가 더 묻고, plan이
  그 산출을 받고, epic 템플릿이 겹침 판정 재료를 요구한다. 세 파일이 한 계약의
  발신·수신·재료이므로 나누면 어느 쪽이든 상대가 없는 중간 커밋이 남는다.
- 리뷰 루브릭 항목은 성격이 다르지만, 루브릭은 `SKILL.md`·`reviewer-prompt.md`·
  `agents/bouncer-reviewer.md`가 한 커밋 단위라는 기존 제약(프로젝트 Distill)에
  묶여 있어 그 자체로는 더 쪼갤 수 없다. 문서 한 줄 추가 + 테스트 한 개 규모라
  이 커밋에 얹는 편이 별도 커밋보다 리뷰 부담이 작다는 판단이다.
- 테스트가 같은 커밋에 들어가야 한다. 스킬 본문만 바꾸고 `test/skill-*.test.js`의
  어서션을 갱신하지 않으면 계약이 고정되지 않은 채 통과한다.
- 게이트·스키마·상태 파일을 건드리지 않으므로 회귀 범위는 스킬 문서와 스캐폴드
  템플릿 문자열로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- distill.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
