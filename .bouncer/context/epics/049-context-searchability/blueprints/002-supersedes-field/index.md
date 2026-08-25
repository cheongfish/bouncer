---
type: bouncer.blueprint
title: 결정 계보 필드 bouncer.supersedes 추가
description: 대체한 문서를 프론트매터에 남길 자리를 스키마·스캐폴드·구조 검사에 만든다
resource: .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T08:54:49.054+09:00'
bouncer:
  id: '002'
  epic_id: '049'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
---
# 002 supersedes-field

Epic: [049](../../index.md)

## Intent
- 문제: 프론트매터에서 저술 비용 없이 뽑을 수 있는 관계는 포함(epic→bp→task),
  문서→코드 경로, 문서→후보 경로 셋이고, 없는 축은 결정→결정 하나다. blueprint
  status에 `superseded`가 이미 있지만 무엇이 무엇을 대체했는지 적을 자리가 없어,
  하드룰 7의 "과거 explain 결정과 충돌하면 에스컬레이션" 판정이 매번 전문 검색에
  기댄다. 찾아낸 관계는 어디에도 남지 않는다.
- 완료 조건: epic과 blueprint 프론트매터에 `bouncer.supersedes`가 있고, 스캐폴드가
  그 자리를 만들며, 형식이 틀리면 구조 검사가 거절한다. 값을 채우는 것은 사람의
  판단이고, 비어 있는 것이 기본이다.

## Contract
- 인터페이스: `bouncer.supersedes`는 저장소-상대 문서 경로 문자열의 배열이다.
  `resource` 필드와 같은 어휘를 쓴다.
  ```yaml
  bouncer:
    supersedes:
      - .bouncer/context/epics/033-quality-security/index.md
  ```
  epic id와 blueprint id가 둘 다 `\d{3}`이라 `'032'` 같은 값은 어느 층위인지
  가릴 수 없다. 경로는 새 id 문법을 만들지 않고 두 층위를 한 어휘로 덮는다.
- 데이터·상태: `schema.ts`가 허용 형태 판정을 export하고, `scaffold epic` /
  `scaffold blueprint`가 빈 배열을 쓴다. task·verification·review·explain·
  context_review 문서에는 쓰지 않는다.
- 수용 기준: epic 049 성공 조건 4·5·6.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 필드 부재는 통과한다. 기존 문서 616개에 소급 저술하지 않으므로 부재가 정상
    상태다. `scale`이 S20에서 부재를 허용하는 것과 같은 판단이다.
  - 빈 배열도 통과한다. 스캐폴드 기본값이다.
  - 키만 남기고 값을 지운 `supersedes:`는 YAML이 `null`로 읽으므로 거절한다.
    배열이 아니라는 판정에 그대로 걸린다.
  - 배열이 아니거나 원소에 빈 문자열·비문자열이 섞이면 거절한다.
  - 존재하지 않는 문서를 가리키는 값(dangling)은 거절하지 않는다. 소급 저술을
    하지 않는 이상 과거 문서를 가리키는 값이 정상이고, 참조 무결성 검사는 문서
    이동·삭제 때마다 오탐을 낸다.
  - 자기 자신 참조와 순환도 거절하지 않는다. 같은 이유로 형식만 본다.
  - epic·blueprint 밖 문서 종류에 이 필드가 있으면 거절하지 않는다. 미등록 키를
    거절하는 규칙이 이 저장소에 없고, 이번에 만들지도 않는다.

## Out of scope
- `conflicts-with` 등 다른 관계 필드. 계보 하나가 실제로 쓰이는지 본 뒤에 정한다.
- 과거 문서 소급 저술과 마이그레이션 도구.
- 참조 무결성·순환·중복 검사와 그것을 위한 그래프 질의.
- `supersedes`를 읽는 소비자(스킬 분기, 게이트, CLI 조회). 자리를 먼저 만들고,
  읽는 쪽은 값이 쌓인 뒤에 판단한다.
- blueprint status `superseded`의 의미와 전이 규칙.
- RDF/OWL·클래스 계층·도메인 태그 어휘.

## One-commit justification
- 스키마 상수 하나, 그것을 쓰는 스캐폴드 두 곳, 그것을 검사하는 구조 검사 한
  갈래가 같은 계약의 세 면이다. 나누면 스캐폴드가 검사되지 않는 필드를 쓰거나
  검사기가 아직 생기지 않은 필드를 거절하는 중간 커밋이 생긴다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
