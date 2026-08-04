---
type: bouncer.blueprint
title: discovery 질문 깊이와 plan 핸드오프 계약 보강
description: Blueprint BP-004
resource: .bouncer/context/epics/EPIC-004-starter-kit-convergence/blueprints/BP-004-discovery-depth/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-04T08:34:43.498+09:00'
bouncer:
  id: BP-004
  epic_id: EPIC-004
  blueprint_id: BP-004
  status: approved
  commit_type: docs
  commit_intent:
    - discovery가 여섯 단계를 훑기만 해 엣지·실패 모드·기존 스트림과의 중복이 계획 단계에서 드러나지 않았음
    - 한 패스에서 그것을 묻고 확인된 framing을 빠짐없이 다음 단계로 넘기는 출력 계약을 명시함
---
# BP-004 discovery-depth

Epic: [EPIC-004](../../index.md)

## Intent
- 문제: `discovery`는 Request → Goal → Scope → Non-goals → Success → Confirmation
  여섯 단계를 나열할 뿐, 각 단계에서 **무엇을 물어야 하는지**를 말하지 않는다. 그래서
  엣지 케이스·실패 모드·"하지 않을 것"이 얕게 넘어가고, 이미 열려 있는 epic이나 프로젝트
  Distill이 같은 문제를 다루는지 확인하지 않은 채 새 스트림이 열린다. 확인된 framing이
  `spec-authoring`으로 넘어갈 때 무엇이 반드시 실려야 하는지도 적혀 있지 않아, 성공 조건이
  중간에 증발해도 아무도 모른다. 자매 프로젝트의 브레인스토밍 스킬은 같은 문제를 질문
  목록과 핸드오프 규율로 풀어 두었다.
- 완료 조건: `discovery`가 한 패스에서 엣지·실패 모드·비목표·기존 스트림 중복을 묻고,
  확인된 framing이 무엇을 담아야 하는지를 출력 계약으로 못 박는다. 계획 진입 문서가 그
  산출을 전제로 인용한다. 게이트 코드·문서 스키마·런타임 상태는 그대로.
  `npm test` 통과.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지. -->
- 인터페이스: `discovery` 스킬 본문이 (a) 단계별 질문 체크리스트, (b) 착수 전 선행
  Read 대상(`.bouncer/context/Distill.md`와 `.bouncer/context/epics/` 인덱스),
  (c) 다음 단계로 넘기는 출력 계약 — 목표·범위·비목표·성공 조건·기존 스트림과의 관계 —
  을 포함한다. 스킬은 계속 안내이며 게이트가 아니다.
- 인터페이스: `/bouncer-plan` 진입 문서가 discovery 산출을 전제로 인용한다. 새 단계를
  추가하지 않고, 기존 1단계 문장을 그 계약에 맞춘다.
- 데이터·상태: 없다. 새 파일·새 frontmatter 필드·새 런타임 상태를 만들지 않는다.
  epic 템플릿의 Blueprints 안내 주석 문구만 바뀐다.
- 수용 기준: 위 두 인터페이스가 반영되고, 스킬 표면 테스트가 새 문구를 검사하며,
  `npm test`가 통과한다. 새 게이트 코드·스키마 필드가 늘지 않는다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: Graphify가 없거나 `.bouncer/context/epics/`가 비어 있어도
  discovery가 막히지 않아야 한다 — 선행 Read는 의무이되 결과가 비어 있는 것은 정상이다.

## Out of scope
- `context/artifacts/` 같은 브레인스토밍 산출물 경로와 파일 도입. discovery는 계속
  파일을 만들지 않는다.
- 별도 discovery 런타임(CLI·주입기)과 `inventory.json` 계열 스키마·동기화.
- 외부 방법론 플러그인(`/brainstorming` 등) 연동이나 설치 의존.
- discovery 미확인을 plan 게이트 실패로 만드는 것. 강제는 기존 G10과 승인 흐름이
  담당하고, 이 blueprint는 안내만 늘린다.
- 새 epic 인덱스 포맷·인덱스 생성 CLI. 손대는 것은 템플릿 안내 문구 한 덩어리다.
- 리뷰 루브릭에 "테스트 없는 동작 변경" 항목 추가. 루브릭은 `skills/review/SKILL.md`,
  `skills/review/reviewer-prompt.md`, `agents/bouncer-reviewer.md` 세 곳에 중복돼 있고
  프로젝트 Distill이 그 셋과 execute 디스패치를 **한 커밋 단위**로 못 박는다. 한 곳만
  고치면 어긋나고, 셋을 함께 고치면 리뷰어 커밋 단위가 discovery 커밋에 섞인다.
  별도 blueprint에서 다룬다.
- BP-002 `init-rules-scaffold`의 상태 정리. 별개 결정이며 여기서 다루지 않는다.

## One-commit justification
- 변경의 실체는 하나다 — "discovery가 무엇을 묻고 무엇을 넘기는가"를 명시하는 것.
  plan 진입 문서 한 줄과 epic 템플릿 안내 문구는 모두 그 계약을 가리키는 참조라
  같은 커밋에서 함께 읽혀야 뜻이 통한다.
- 쪼갤 수 없다. 질문만 늘린 커밋은 넘길 곳이 없고, 핸드오프만 적은 커밋은 넘길 내용이
  없다.
- 코드 경로가 바뀌지 않으므로 회귀 범위가 스킬 표면 테스트로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- distill.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
