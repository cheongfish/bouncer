---
type: bouncer.epic
title: 문서 스키마 확정
description: 문서 표면을 코드와 일치시키고 1.0 호환 약속의 기준점을 번들 루트에 둔다
resource: .bouncer/context/epics/031-document-schema/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-12T14:38:53.657+09:00'
bouncer:
  id: '031'
  epic_id: '031'
  status: approved
---
# 031 document-schema

## Intent
- 문제: 문서 표면이 코드와 어긋나 있다. `bouncer.scale`은 스킬 산문에만 있고,
  `commit_type`은 읽히지만 scaffold가 쓰지 않으며, `type`이 파일 위치가 요구하는
  종류와 맞는지는 아무도 보지 않는다. 스키마 버전을 선언할 자리도 없다.
- 목표: 문서 필드가 코드에 등록되고 scaffold가 그것을 쓰며, 1.0에서 깨지 않겠다고
  약속할 표면이 `bouncer_schema` 한 줄로 지목된다.

## Success criteria
1. `bouncer init`이 만든 번들 루트 `.bouncer/context/index.md` frontmatter에
   `okf_version` 옆 `bouncer_schema`가 있고, 이 저장소의 기존 번들 루트에도
   같은 줄이 있다.
2. `bouncer scaffold blueprint`가 만든 `index.md`에 `bouncer.commit_type`과
   `bouncer.scale`이 들어 있고, `schema.ts`가 두 필드의 허용 값을 export한다.
3. `type`이 파일 위치가 요구하는 종류와 다르면 `bouncer validate`가 S19로
   거절한다. 종류를 판정할 수 없는 경로는 검사하지 않는다.
4. `bouncer.scale` 값이 허용 목록 밖이면 S20으로 거절하고, 필드가 없는 0.7
   문서는 그대로 통과한다.
5. 저장소 어디에도 루트 `tasks.md` / `tasks-<NNN>.md`를 현행 레이아웃의 대안으로
   서술한 문장이 없다. `bouncer migrate task-layout` 입력이라는 서술만 남는다.
6. `skills/spec-authoring/references/`에 epic·blueprint·tasks·review 완성 예시가
   있고 `SKILL.md`가 그 경로를 가리킨다.
7. `npm test`가 통과한다.

## Out of scope
- `bouncer_schema` 값을 `1.0`으로 올리는 일. 릴리스 시점 판단이므로
  [029 release-one-zero](../029-release-one-zero/index.md)가 가진다. 여기서는
  필드 자리를 만들고 `0.1`을 넣는다.
- `bouncer_schema` 부재를 게이트로 막는 일. 이 필드가 없는 0.7 저장소가 그대로
  통과해야 한다.
- `title`·`description`·`tags`·`timestamp` 값 검사. 1.0 이후 깨기 어려운 계약을
  필요 이상으로 늘리지 않는다.
- `scale`을 퀴즈 분량·에이전트 왕복 외의 새 동작에 연결하는 일. 자동 루프의
  검증 강도 조절은 BP-4가 가진다.
- `bouncer migrate task-layout` 명령과 `tasks-docs.ts`의 레거시 탐지 제거.
  S15 메시지를 내려면 탐지가 남아 있어야 한다.
- context reviewer(G18)·프롬프트 인젝션 방어·벤치마크. 각각 BP-5, BP-6이다.

## Blueprints
* [001 schema-cutover](blueprints/001-schema-cutover/index.md) - 스키마 필드 승격·구조 검사 추가·레거시 서술 컷오버 — `schema.ts`·`scaffold.ts`·`validate.ts`와 `skills/spec-authoring/references/`
