---
type: bouncer.blueprint
title: 문서 스키마 확정과 레거시 레이아웃 서술 컷오버
description: 스키마 필드를 코드에 등록하고 구조 검사 두 개를 추가하며 루트 task 레이아웃 서술을 닫는다
resource: .bouncer/context/epics/031-document-schema/blueprints/001-schema-cutover/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-12T14:38:53.836+09:00'
bouncer:
  id: '001'
  epic_id: '031'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
---
# 001 schema-cutover

Epic: [031](../../index.md)

## Intent
- 문제: 조사해 보니 문서 표면의 구멍은 세 갈래다. 코드가 모르는 필드(`scale`),
  코드는 읽지만 scaffold가 안 쓰는 필드(`commit_type`), 아무도 안 보는 대조
  (`type` ↔ 문서 종류). 여기에 스키마 버전을 선언할 자리가 없어 1.0에서
  "이 표면을 깨지 않는다"고 가리킬 대상이 없다.
- 완료 조건: 네 필드가 코드·scaffold·검증기에서 같은 것을 뜻하고, 루트 task
  레이아웃이 살아있는 선택지로 서술된 문장이 남아 있지 않다.

## Contract
- 인터페이스:
  - `schema.ts`가 네 상수를 추가로 export한다.
    ```ts
    BOUNCER_SCHEMA_VERSION = '0.1'
    SCALE_ENUM = ['light', 'full']   // 부재 = 'full'
    DEFAULT_SCALE = 'full'
    DEFAULT_COMMIT_TYPE = 'feat'
    ```
  - `scaffoldBlueprint`가 `index.md` `bouncer:`에 `commit_type: feat`와
    `scale: full`을 쓴다. task·epic·explain 문서는 바뀌지 않는다.
  - 번들 루트 `index.md` frontmatter가 `okf_version` 아래 `bouncer_schema`를
    갖는다. `init`의 `CONTEXT_INDEX`와 `epic-index`의 `EMPTY_CONTEXT_INDEX`
    두 자리 모두.
  - 신규 구조 코드 **S19**(`type`이 파일 위치가 요구하는 종류와 불일치)와
    **S20**(`bouncer.scale`이 `SCALE_ENUM` 밖). 둘 다 게이트와 무관하게 항상
    검사한다.
- 데이터·상태: 문서 상태 어휘(`STATUS_ENUM`)는 그대로다. `scale`·
  `commit_type`·`bouncer_schema`는 전부 **선택** 필드로, 없는 0.7 문서가
  실패하지 않는다. `scale` 소비자(`explain-diff`, `/bouncer-execute`)는 지금처럼
  `light`인지만 비교한다 — `full`을 위한 새 분기를 만들지 않는다.
- 수용 기준: 에픽 성공 기준 1–7.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `bouncer_schema`가 없는 기존 저장소 — 통과다. 이 blueprint는 쓰기만 하고
    부재를 판정하지 않는다.
  - `scale` 필드가 없는 0.7 blueprint — S20을 내지 않고 `full`로 읽는다.
  - `scale: lite` 같은 오타 — S20으로 거절한다. 조용히 일반 경로로 흘러가면
    선언이 무의미해진다.
  - `imported` status 문서 — 구조 검사는 S18 조기 반환보다 먼저 돌므로 S19를
    받을 수 있다. 임포트 문서도 위치에 맞는 `type`을 가지므로 통과해야 하며,
    통과하지 않으면 임포트 경로가 잘못 쓴 것이다.
  - 종류를 판정할 수 없는 경로(`.bouncer/context/` 밖, 알 수 없는 basename)
    — S19를 내지 않고 건너뛴다. 위치 규칙이 없는 곳까지 강제하지 않는다.
  - `loadBlueprintDocs`의 대표 task 경로 폴백을 없앤 뒤 task 묶음이 하나도 없는
    blueprint — 없는 `tasks/001/tasks.md`를 가리키고 S17/S8 경로로 보고된다.
    레거시 basename을 가리켜서는 안 된다.

## Out of scope
- 에픽 Out of scope 전부(1.0 값 승격, `bouncer_schema` 게이트화, OKF 나머지
  필드 값 검사, BP-4·BP-5·BP-6 항목).
- `bouncer migrate task-layout` 명령과 `tasks-docs.ts`의 레거시 basename 탐지.
  S15가 그 탐지 위에 서 있다.
- `finalize.ts`의 `commit_type` `'feat'` 폴백 제거. scaffold가 쓰기 시작해도
  기존 문서에는 필드가 없다.
- 문서 종류 추가(`context-review.md`). BP-5가 가진다.

## One-commit justification
- 한 커밋이 아니라 넷이다. 필드를 쓰기 시작하는 일(scaffold·init), 그것을
  검사하는 일(validate), 죽은 레이아웃 서술을 걷는 일, 작성 예시를 새로 쓰는
  일은 각각 따로 되돌릴 수 있고 리뷰의 종류가 다르다. 특히 예시 문서는
  docs-only라 코드 변경과 섞으면 diff가 읽히지 않는다. blueprint는 그대로 PR
  하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 번들 루트 스키마 버전과 blueprint 기본 필드
* [Tasks 002](tasks/002/tasks.md) - S19 type 종류 대조와 S20 scale 값 검사
* [Tasks 003](tasks/003/tasks.md) - 루트 task 레이아웃 서술과 해석 폴백 제거
* [Tasks 004](tasks/004/tasks.md) - 문서 종류별 작성 예시
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
