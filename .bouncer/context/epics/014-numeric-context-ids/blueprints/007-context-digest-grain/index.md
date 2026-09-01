---
type: bouncer.blueprint
title: 컨텍스트 다이제스트에 blueprint·task 층위 추가
description: Widen the digest whitelist to five kinds so contract and brief vocabulary enter the context graph.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/007-context-digest-grain/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-25T08:54:49.021+09:00'
bouncer:
  id: '007'
  epic_id: '014'
  blueprint_id: '007'
  status: closed
  commit_type: feat
  scale: full
---
# 001 context-digest-grain

Epic: [014](../../index.md)

## Intent
- 문제: `digestRulesFor`가 화이트리스트로 삼는 문서는 epic `index.md`, BP
  `explain.md`, Distill 샤드 셋뿐이다. blueprint `index.md` 68개와 task
  `tasks.md` 136개가 통째로 빠져 있어, 「실패 모드·엣지 케이스」가 들어 있는
  `## Contract` 66건과 구현 어휘가 들어 있는 `## Goal & intent` / `## Interface`
  136건이 context 그래프에 존재하지 않는다.
- 완료 조건: 두 층위가 화이트리스트에 들어가 재빌드한 그래프에서 조회되고, 026이
  세운 원본 경로 remap·미매핑 노드 드롭·freshness 계약이 그대로 유지된다.

## Contract
- 인터페이스: `digestRulesFor(rel)`이 두 경로 형태에 대해 헤딩 배열을 새로
  돌려준다.
  ```
  .bouncer/context/epics/<epic>/blueprints/<bp>/index.md
    → ['## Intent', '## Contract']
  .bouncer/context/epics/<epic>/blueprints/<bp>/tasks/<NNN>/tasks.md
    → ['## Goal & intent', '## Interface']
  ```
  나머지 반환값(epic `index.md`, `explain.md`, Distill, `null`)은 그대로다.
- 데이터·상태: `graphify-out/context-src/` 파생 트리와 `map.json`에 항목이 늘
  뿐, 파일 형식과 `map.json`의 `파생이름 → 원본경로` 방향은 바뀌지 않는다.
  프론트매터 스키마·게이트·설정 키는 하나도 바뀌지 않는다.
- 수용 기준: epic 049 성공 조건 1·2·3. 049 이전 기준선은 102 문서 / 156,659
  바이트이고, 그때 잰 예상 증가는 blueprint 층 +68 문서 / +179,329 바이트,
  task 층 +136 문서 / +213,133 바이트다. 049 자신의 문서가 더해져 실측은 이보다
  조금 크게 나온다. 재빌드·질의·실측은 task Checklist가 수행하고, 숫자는
  `/bouncer-finalize`의 `explain.md`가 받는다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 요청한 헤딩이 없거나 본문이 비면 그 섹션을 빼고, 전부 비면 파생 파일을
    만들지 않는다. `extractSections`의 기존 계약이며 새로 분기하지 않는다.
  - `tasks/<NNN>` 세 자리 규칙을 만족하지 않는 경로는 화이트리스트에 걸리지
    않는다. `tasks-1.md` 같은 이름은 task 문서가 아니다.
  - 구형 루트 `tasks.md` / `tasks-<NNN>.md`는 화이트리스트 대상이 아니다.
    `migrate task-layout` 입력일 뿐이므로 정규식이 이를 잡으면 안 된다.
  - `map.json`에 없는 노드는 드롭하고, 그 노드를 참조하는 link·hyperedge도 함께
    사라진다. 026 계약이므로 이번 변경으로 파생 이름이 `source_file`에 새어
    나가면 안 된다.
  - 다이제스트가 3.5배가 되어 graphify 빌드 시간과 메모리가 늘어난다. 거절하지
    않고 실측을 `explain.md`에 남긴다.
  - freshness는 이미 `context_dirs` 전체 mtime이라 새 입력이 추가돼도 판정 입력이
    바뀌지 않는다. `graph-scope.ts`를 건드릴 이유가 없다.

## Out of scope
- `tasks.md`의 `## Touch` / `## Do not touch` / `## Constraints` / `## Checklist`.
  경로 열거와 절차라 문장 검색 신호가 아니고, 넣으면 본문 통짜에 가까워진다.
- blueprint `## Documents` / `## One-commit justification`. 링크 목록과 분할
  근거라 같은 이유로 제외한다.
- `graph-scope.ts`의 freshness 입력, `graph-exec.ts`의 remap 경로,
  `graphify-runner`의 롤업 규칙.
- `config.json`의 `context_dirs` 스키마와 사용자별 화이트리스트 설정.

## One-commit justification
- `digestRulesFor` 한 함수에 정규식 두 갈래를 더하는 변경이고, 그 계약을 검증하는
  테스트와 같은 화이트리스트를 서술한 사람용 문서 두 곳이 함께 움직인다. 나누면
  코드와 문서가 어긋난 중간 커밋이 생긴다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
