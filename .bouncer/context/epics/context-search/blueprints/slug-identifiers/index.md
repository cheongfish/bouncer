---
type: bouncer.blueprint
title: 문서 식별자의 slug·order 전환
description: Replace numeric epic and blueprint identifiers with slugs and frontmatter order while keeping old ids readable through aliases
resource: .bouncer/context/epics/context-search/blueprints/slug-identifiers/index.md
tags:
  - bouncer
  - blueprint
  - identifiers
  - slug
  - epic-registry
  - trailer
  - migration
timestamp: '2026-10-20T17:07:09.130+09:00'
bouncer:
  id: slug-identifiers
  epic_id: context-search
  blueprint_id: slug-identifiers
  status: closed
  order: 1
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 문서 식별자·스키마·등록부 모델 변경이 성공 기준의 중심이라 context-search 영역에 귀속
  supersedes: []
---
# 001 slug-identifiers

Epic: [119](../../index.md)

## Intent
epic·blueprint를 번호 대신 slug로 식별하고 blueprint 순서는 frontmatter `order`로 정하도록 식별자 해석·쓰기·실행 키·추적 경로를 한 resolver로 모은다. 구형 번호 ID와 trailer는 별칭 표로 계속 읽고, legacy 디렉터리를 새 형식으로 옮기는 이관 명령을 함께 제공한다.

## Contract
- 근거 요구사항: slug 식별자 결정 1~10과 plan 질의 답변 11~18.
- 인터페이스:
  - 새 모듈 `scripts/src/lib/context-ids.ts`가 경로·stable ID·trailer 값·pointer 키를 구형(`numeric`)과 새 형식(`slug`) 모두 해석한다. 다른 모듈은 epic·blueprint 번호 정규식을 직접 갖지 않는다.
  - 형식은 경로가 정한다. epic 디렉터리가 `^\d{3}-`로 시작하면 `numeric`, 아니면 `slug`다. 새 형식 쓰기 스위치는 따로 없다.
  - stable ID: `numeric` → `context-search/registry-gates/001`, `slug` → `context-search/registry-gates/001`. intent는 마지막 `/<NNN>`을 뺀 값이다.
  - 실행 키(`slug`): pointer `<epic-slug>/<bp-slug>`, 통합 브랜치 `<commit_type>/<epic-slug>--<bp-slug>`, worker 브랜치 `bouncer/<epic-slug>--<bp-slug>--<NNN>`, worktree `.worktrees/<epic-slug>/<bp-slug>/{integration,workers/<NNN>}`.
  - 새 epic(`scaffold epic`, `epic add-domain`)은 경로가 아직 없으므로 등록부 버전으로 형식을 정한다. v2면 slug, v1이면 번호다. 이관 명령이 등록부를 v2로 올리므로 전환 시점이 같다.
  - CLI: `scaffold blueprint --order <n>`(slug epic), `scaffold epic --name <slug>`(v2 등록부), `plan inspect`의 `epic.nextBlueprintOrder`, `bouncer migrate context-slugs [--yes]`.
- 데이터·상태:
  - `.bouncer/epics.json` `version: 2`: epic 항목은 `slug`(기본 키, 불변)·`kind`·`active`, legacy는 `legacy_id`와 `blueprint_aliases`(`{"003": "registry-gates", "old-slug": "new-slug"}`)를 갖는다. v1은 계속 읽는다. 루트 `epics.example.json`이 v2 예시다.
  - slug 규칙: 기존 `SLUG_RE`에 더해 40자 이하, 숫자만으로 된 값과 `^\d{3}-` 시작 금지(구형 형식과 구별되지 않음). epic·blueprint·area 공통.
  - blueprint frontmatter(`slug`): `bouncer.id`·`blueprint_id` = bp slug, `epic_id` = epic slug, `order` = epic 안에서 유일한 양의 정수(간격 허용). epic `bouncer.id` = epic slug. task `TASKS-NNN`·`tasks/<NNN>/`은 그대로다.
- 수용 기준:
  1. resolver가 두 형식의 경로·stable ID·trailer·pointer 키를 해석하고, 구형 ID를 별칭 표로 새 ID로 정규화한다. 별칭이 없으면 `null`을 돌려준다.
  2. 정적 테스트가 `scripts/src`에서 `context-ids.ts` 밖의 epic·blueprint 번호 정규식과 `EPIC-${` 조립을 찾으면 실패한다.
  3. slug epic fixture에서 scaffold → approve → current → drive 키 → commit trailer → finalize 수집까지 새 형식 경로·ID·trailer·브랜치로 동작한다. 단계 사이 연결은 TASKS-005 테스트가 이관한 fixture 위에서 한 흐름으로 확인한다.
  4. 구형 `ddd-slug` 경로의 기존 테스트가 기대값을 바꾸지 않고 통과한다(이관 전 동작 보존). 예외는 이 blueprint가 계약을 바꾼 출력(`nextBlueprintOrder`, 등록부 v2 읽기)뿐이다.
  5. `order`가 1·2·5인 slug epic fixture에서 `nextBlueprintOrder`는 6이고, `nextBlueprint`는 `order` 오름차순으로 고른다. slug epic 사이 순서는 `epics.json` 배열 순서다. 번호 epic은 기존 규칙(epic 본문 목록 순서, 이름순)을 그대로 쓴다.
  6. `migrate context-slugs --yes`를 legacy fixture에 실행하면 디렉터리·문서 안 ID·경로·파생 해시가 새 형식이 된다. 이관된 blueprint 전부 기본 `bouncer validate --blueprint`를 통과하고, 다시 계산한 해시마다 원래 함수 출력과 같으며, 구형 trailer 커밋의 provenance가 유지된다.
  7. 진행 중 상태(pointer, approvals, coordinator 원장, `.worktrees/` 아래 열린 worktree)나 dirty 작업 트리가 있으면 이관은 파일을 바꾸지 않고 거절 코드를 낸다.
  8. `npm run ci`가 통과한다.
- 검증 명령: task별 `node --test …`, 종단 `npm run ci`.
- 실패 모드·엣지 케이스:
  - slug 규칙 위반, 같은 epic 안 bp slug 중복, epic·blueprint 형식이 섞인 경로, `order` 중복·0 이하·비정수 → plan gate 거절(`S37`).
  - 승인 뒤 slug 불변(결정 6)은 운영 절차다. 바꿀 때는 새 slug를 만들고 예전 slug를 `blueprint_aliases`에 올린다. gate는 디렉터리 slug·frontmatter `id`/`blueprint_id`·`resource` 일치(S5)만 판정한다(답변 A).
  - 같은 task에 구형·새 형식 trailer가 함께 있으면 정규화 ID로 묶고 가장 최근 커밋을 쓴다.
  - 다른 epic에 같은 bp slug가 있어도 키는 epic slug를 포함하므로 충돌하지 않는다.
  - 별칭 표에 없는 구형 ID는 조회 실패로 보고하고 추측 매핑하지 않는다.
  - 일부 epic만 slug인 혼합 상태에서도 경로마다 형식을 따로 판정한다.
  - 진행 중인 구형 drive는 경로가 구형이므로 브랜치·worktree·pointer가 구형 이름으로 끝난다.
  - 이관이 중간에 실패하면 이미 옮긴 디렉터리는 건너뛰고 다시 실행해 이어 간다. 되돌리기는 `git restore`/`git clean` 안내로 한다.

## Out of scope
- 이 저장소에서 이관 명령을 실제로 실행하고 결과를 커밋하는 일. 병합 뒤 drive가 없을 때 별도로 한다.
- 과거 커밋 trailer 재작성, 과거 커밋 메시지에 남은 finding id 별칭.
- task 디렉터리·`TASKS-NNN`·task 번호 정규식 변경.
- `migrate task-layout`·`migrate review-scope`·retention 이관 등 기존 이관 도구의 삭제·기능 변경. 정적 검사에 걸리는 번호 정규식만 resolver 호출로 바꾼다.
- 진행 중인 drive의 브랜치·worktree 이름 변경.

## One-commit justification
- 형식을 경로로 판정하므로 resolver·쓰기·실행 키·추적·이관 도구가 한 PR에 들어가야 이관 명령을 실행하는 순간 모든 경로가 동시에 새 형식으로 바뀐다(결정 10). 나눠 병합하면 slug 경로를 만들 수 있지만 실행·추적이 읽지 못하는 중간 상태가 생긴다.
