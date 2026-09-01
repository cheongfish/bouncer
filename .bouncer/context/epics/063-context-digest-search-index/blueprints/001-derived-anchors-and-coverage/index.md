---
type: bouncer.blueprint
title: 파생 앵커와 다이제스트 커버리지
description: Emit hierarchy anchors, Touch path headings, and domain tag labels from context-digest, and index all Distill shard sections so no target document vanishes.
resource: .bouncer/context/epics/063-context-digest-search-index/blueprints/001-derived-anchors-and-coverage/index.md
tags:
  - bouncer
  - blueprint
  - context-digest
  - search-anchor
  - graph-suggest
timestamp: '2026-08-31T17:00:02.751+09:00'
bouncer:
  id: '001'
  epic_id: '063'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 derived-anchors-and-coverage

Epic: [063](../../index.md)

## Intent
- 문제: `buildContextDigest`가 화이트리스트 절의 본문만 파생 파일에 쓰고 그 본문이 비면 파일 자체를 만들지 않는다. 문서 경로·frontmatter·`## Touch`에 이미 있는 검색 가능한 ASCII 값이 전부 버려지고, 살릴 절이 없는 대상 문서 7건은 그래프에서 통째로 사라진다.
- 완료 조건: 파생 파일이 본문 앞에 계층 앵커·Touch 경로·도메인 태그 헤딩을 담고, 앵커만 있어도 파일이 만들어지며, Distill shard 세 절과 master의 shard 목록이 모두 색인된다.
- 후속: `.bouncer/distill/graph.md`가 컨텍스트 트리를 "whitelist headings only"로 적고 있어 이 blueprint 이후 사실과 어긋난다. `/bouncer-finalize`의 Distill 승격 후보로 남긴다 — task가 고치지 않는다.

## Contract
- 인터페이스: `context-digest.ts`가 세 함수를 추가로 내보낸다.
  ```
  anchorsFor(rel: string): string[]        // ['task-063-001-002','bp-063-001','epic-063']
  touchPathHeadings(markdown: string): string[]   // ## Touch 의 백틱 경로
  tagLabels(markdown: string): string[]    // frontmatter tags 중 도메인 태그
  ```
  셋 다 순수 함수이며 중복을 제거한 배열을 돌려준다. 순서는 함수마다 다르다 — 앵커는 좁은 층부터 부모 순, 나머지 둘은 문서 등장 순이다. 정렬하지 않는다. 파생 파일 본문은
  `<!-- source: <rel> -->` 다음에 `## <label>` 줄을 앵커 → Touch 경로 → 태그
  순으로 배치하고, 그 뒤에 기존 `extractSections()` 결과를 이어 붙인다.
- 데이터·상태: `digestRulesFor`의 반환 계약은 유지하되 shard 규칙이
  `['## Invariants','## Gotchas','## Decisions']`, master `.bouncer/Distill.md`가
  `['## Shards']`로 바뀐다. 파생 파일 생성 조건이 `extracted` 비어있지 않음에서
  `헤딩 또는 extracted 가 비어있지 않음`으로 넓어진다. `map.json`의 키·값 형식은
  그대로다.
- 수용 기준: epic 063의 성공 조건 1~6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - epic id가 경로에 없는 문서(`.bouncer/Distill.md`, `.bouncer/distill/*.md`)는 앵커가 빈 배열이고, 앵커 부재를 이유로 파일을 버리지 않는다.
  - epic id `024`가 `024-lightweight-cycle`과 `024-light-path` 두 디렉터리에 중복 배정되어 있다. 두 문서 모두 `epic-024`를 얻고, 중복 해소는 Wave 4가 맡는다.
  - `## Touch` 줄이 `- Modify \`path\` — 이유` 형태라 동사·설명·한국어가 섞인다. 백틱 스팬 중 `[A-Za-z0-9_./-]`만으로 이뤄진 것만 헤딩이 되고 나머지는 버린다.
  - `<TODO: 수정할-파일>` 같은 스캐폴드 플레이스홀더는 백틱 안이라도 토크나이저 문자 밖이라 승격되지 않는다.
  - `tags`의 구조 태그는 문서마다 공통이라 god label이 된다. 제외 대상을 고정 목록으로 두지 않고 문서 자신의 `type: bouncer.<kind>`에서 역산한 태그와 `bouncer` 둘만 제외한다. `explain` 75건, `verification`·`review`·`tasks` 각 213건이 이 규칙으로 걸린다. 같은 이름을 도메인 개념으로 쓴 다른 종류의 문서에서는 라벨로 남는다.
  - 한국어나 공백이 섞인 `tags` 항목은 토크나이저를 통과하지 못하므로 승격하지 않는다.
  - `flattenSlug` 충돌 시 `uniqueFlatName`이 붙이는 `-2` 접미사는 그대로 두고 헤딩은 원본 경로 기준으로 만든다.
  - 헤딩도 절도 없는 문서는 지금처럼 파일을 만들지 않는다. 무성 유실이 아니라 대상 아님으로 남는다.

## Out of scope
- `graph-search.ts`의 tokenize·매칭·점수 규칙.
- 기존 컨텍스트 문서의 `tags`·`description` 값 일괄 정리 — 새 규칙은 신규·수정 문서에만 적용한다.
- `scaffold.ts`가 찍는 기본 tags 변경. 구조 태그는 소비 쪽에서 걸러낸다.
- `graphify-out` 산출물이나 `extract.py` 파이프라인 수정.
- cross-file 엣지 주입과 community 재계산.

## One-commit justification
- 태그 헤딩은 소비자와 생산자가 같은 PR에 있어야 성립한다. task 003이 `tags`를 라벨로 승격해도 도메인 태그를 쓰라는 규칙(task 005)이 없으면 62개 epic 중 6개에서만 동작하는 죽은 코드가 되고, 규칙만 먼저 넣으면 아무도 소비하지 않는 의무가 된다. 두 쪽을 갈라 머지하면 어느 쪽도 단독으로 검증되지 않으므로 한 PR에 둔다. 001~004는 그와 별개로 `context-digest.ts`의 같은 생성 경계를 순서대로 넓히므로 파생 본문 형식 전체를 한 번에 리뷰할 수 있다.

## Documents
* [Task 001](tasks/001/tasks.md) - 계층 앵커 파생과 파일 생성 조건 완화
* [Task 002](tasks/002/tasks.md) - Touch 경로 헤딩 승격
* [Task 003](tasks/003/tasks.md) - 도메인 태그 라벨 승격
* [Task 004](tasks/004/tasks.md) - Distill shard 세 절 색인과 그래프 재빌드 검산
* [Task 005](tasks/005/tasks.md) - 태그 검색 어휘 작성 규칙
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
