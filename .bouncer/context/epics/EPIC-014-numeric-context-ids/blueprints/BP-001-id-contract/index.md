---
type: bouncer.blueprint
title: 숫자 context id 하네스 계약
description: path·schema·scaffold·validate가 001 정본을 쓰고 구형 접두 경로는 파생만 임시 허용
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-001-id-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-05T16:54:53.735+09:00'
bouncer:
  id: BP-001
  epic_id: EPIC-014
  blueprint_id: BP-001
  status: approved
  commit_type: refactor
  commit_intent:
    - epic·bp id에서 접두 중복을 제거함
    - scaffold와 구조 검사가 숫자 정본만 쓰게 맞춤
---
# BP-001 id-contract

Epic: [EPIC-014](../../index.md)

## Intent
- 문제: `parsePathIds`·layout·S4/S5·scaffold·epic-index가 `EPIC-`/`BP-` 접두를 계약으로 고정한다.
- 완료 조건: 정본 id는 `\d{3}`이고 scaffold는 접두 없는 경로만 만들며, 구형 접두는 경로·frontmatter 양쪽에서 읽기만 임시로 허용한다(허용 제거는 BP-003). EPIC-014 성공 조건 1·2가 참이 되고 관련 테스트가 신형 fixture로 통과한다.

## Contract
- 인터페이스: `parsePathIds`가 epic/bp 세그먼트에서 숫자를 파생해 `epicId`/`blueprintId`로 `\d{3}` 문자열을 반환한다. 경로에 `EPIC-`/`BP-` 접두가 있어도 동일하게 숫자만 낸다.
- 인터페이스: `isCanonicalEpicDir` / `isCanonicalBlueprintDir`가 `.bouncer/context/epics/<id>-<slug>` 및 `…/blueprints/<id>-<slug>`를 받고, 전이 기간에만 `EPIC-<id>-` / `BP-<id>-` 형태도 허용한다.
- 인터페이스: `ID_PREFIX`에서 epic·blueprint 접두 `EPIC-`/`BP-`를 제거하고, S4는 해당 종류에 대해 `\d{3}` id를 요구한다. 자식 종류는 `TASKS-`/`VERIFY-`/`REVIEW-`/`EXPLAIN-` + `\d{3}`(예: `TASKS-001`).
- 인터페이스: S5 expectedId는 epic/blueprint = path 파생 `\d{3}`, 자식 = `${prefix}${blueprintId}`(예: `TASKS-001`). 비교 전에 frontmatter 값에서 구형 접두(`EPIC-`/`BP-`, 자식의 `TASKS-BP-` 등)를 정규화해 떼고, 정규화 후 같으면 통과시킨다 — 전이 기간 동안 구형 메타를 S5로 실패시키지 않는다(허용 제거는 BP-003).
- 인터페이스: `scaffold epic|blueprint`와 epic-index 목록·템플릿·CLI help가 신형 경로·id만 생성·예시한다. `--id`는 `\d{3}`만 받는다.
- 데이터·상태: frontmatter `id`/`epic_id`/`blueprint_id` 정본은 숫자. 구형 frontmatter(`EPIC-014`)는 이 BP에서 일괄 이주하지 않고 정규화로 통과시킨다(이주는 BP-003 + migrate). 이 레포의 EPIC-001~014 문서가 그대로 게이트를 통과해야 BP-002·BP-003이 실행 가능하다.
- 수용 기준: EPIC-014 성공 조건 1, 2. 신형 fixture로 `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: `--id 1` / `01` / `EPIC-001`은 scaffold가 거절한다. 정규화는 접두만 떼므로 숫자가 어긋나면(`EPIC-013` in `epics/014-…`) 여전히 S5로 실패한다. epic-index(S13)도 같은 이유로 구형 디렉터리명을 전이 기간 동안 목록과 일치하는 것으로 인정해야 한다.

## Out of scope
- `bouncer migrate ids` CLI·마이그레이션 스킬·SessionStart 구형 경고 (BP-002)
- `.bouncer/context/` 실트리 rename·본문 rewrite (BP-003)
- 레거시 경로 허용의 최종 제거 (BP-003)

## One-commit justification
정본 id·경로 계약과 그것을 증명하는 테스트·예시 문자열이 한 리뷰 단위다. migrate·dogfood를 넣으면 커밋이 두 관심사를 섞는다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
