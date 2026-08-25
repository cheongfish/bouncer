---
type: bouncer.epic
title: 컨텍스트 검색 가능성
description: 다이제스트에 blueprint·task 층위를 넣고 결정 계보를 supersedes로 남겨 과거 판단이 검색에 잡히게 한다
resource: .bouncer/context/epics/049-context-searchability/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-25T08:54:48.962+09:00'
bouncer:
  id: '049'
  epic_id: '049'
  status: approved
---
# 049 context-searchability

## Intent
- 문제: epic 047의 세 task가 전부 context 그래프에 `fail-skip`을 남기고
  `affected_paths`를 손으로 심었다. 재빌드로 풀리는 문제가 아니다. 다이제스트
  화이트리스트가 epic `## Success criteria`, BP `explain.md`, Distill
  `## Decisions` 셋뿐이라 blueprint 68개와 task 브리프 136개가 한 번도
  인덱싱된 적이 없고, 047의 질의어(`scope_evidence`, `pointer payload`)가 걸릴
  자리가 없었다. 결정끼리의 계보도 어디에도 남지 않아 하드룰 7의 "과거 explain
  결정과 충돌" 판정이 매번 전문 검색에 기댄다.
- 목표: 계획 단계에서 "이 경로를 건드린 과거 판단"이 검색으로 잡힌다. 다이제스트가
  blueprint 계약과 task 브리프를 담고, 새 문서는 대체한 결정을 프론트매터에 적는다.

## Success criteria
1. 재빌드한 `graphify-out/context/graph.json`에 blueprint `index.md`와 task
   `tasks.md`에서 파생된 노드가 있고, 모든 `source_file`이 저장소-상대 원본
   경로다. 파생 이름이나 `graphify-out/` 하위 경로를 가진 노드가 0건이다.
2. epic 047의 세 task가 `fail-skip`을 남긴 질의어로 context 그래프를 조회했을 때
   usable hit이 0이 아니고, 그 수치가 BP `explain.md`에 남는다.
3. 다이제스트 문서 수와 바이트 증가가 BP `explain.md`에 실측으로 남는다.
   기준선은 049 문서가 생기기 전 102 문서 / 156,659 바이트이고, 049 스캐폴드
   직후 재빌드에서 이미 103 문서 / 157,800 바이트다. 049 자신의 epic·blueprint·
   task 문서도 증가분에 포함되므로, 실측을 적을 때 어느 시점 스냅숏인지 함께
   적는다.
4. `bouncer scaffold epic`과 `bouncer scaffold blueprint`가 만든 문서
   프론트매터에 `bouncer.supersedes`가 있고, `schema.ts`가 그 허용 형태를
   export한다.
5. `bouncer.supersedes` 값이 허용 형태 밖이면 `bouncer validate`가 새 구조 검사
   코드로 거절하고, 그 필드가 없는 기존 문서 전부는 그대로 통과한다.
6. 각 task에서 `npm run ci`가 통과한다.

## Out of scope
- `tasks.md` 본문 통짜 인덱싱. 049 이전 기준 실측 1,020,791 바이트로 당시
  다이제스트의 6.5배이고, 이번에 넣는 좁은 투영은 213,133 바이트다.
- `verification.md` / `review.md`의 다이제스트 편입. 기계 생성 증적이라 026이
  제외한 판단을 뒤집지 않는다.
- Graphify 외 두 번째 `scope_evidence` producer 신설과 스크래치패드
  `okf-graph.mjs`의 CLI 승격. epic 040이 "Graphify 외 evidence producer"를
  명시적으로 미뤄 뒀고, 그 표면을 여는 것은 별개 판단이다.
- 과거 문서에 `supersedes`를 소급 저술하는 것. 유용성 판정 전에 저술 부채가 먼저
  생긴다.
- `supersedes` 참조 무결성·순환 검사. 소급 저술을 하지 않으므로 존재하지 않는
  문서를 가리키는 값이 정상 상태다. 형식만 본다.
- RDF/OWL, 클래스 계층, 도메인 태그 어휘 신설. OKF는 검색 가능성을 위한
  프론트매터 규약이고, 616개 문서에서 추론기의 회수가 나지 않는다.
- epic 024 번호 중복(`024-lightweight-cycle` / `024-light-path`)의 renumber.
  두 blueprint의 task가 전부 `verified`라 `listReadyBlueprints`가 제외하므로
  worktree 경로 충돌이 도달 불가능하고, 재발은 `f54daab`가 막았다.
- `graphify-out/` 루트의 구 레이아웃 잔재 삭제. gitignore 대상이라 커밋할 파일이
  없다.

## Blueprints
* [001 다이제스트 입도](blueprints/001-context-digest-grain/index.md) - context 다이제스트 화이트리스트에 blueprint `index.md`와 task `tasks.md` 층위를 더한다 (`scripts/src/lib/context-digest.ts`, `test/context-digest.test.js`, `docs/`)
* [002 결정 계보 필드](blueprints/002-supersedes-field/index.md) - `bouncer.supersedes`를 스키마·스캐폴드·구조 검사에 추가한다 (`scripts/src/lib/schema.ts`, `scaffold.ts`, `validate-structural.ts`)
