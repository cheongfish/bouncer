---
type: bouncer.blueprint
title: 등록부 plan gate 검사
description: Enforce the epic registry in the plan gate and add domain epic and area commands
resource: .bouncer/context/epics/context-search/blueprints/registry-gates/index.md
tags:
  - bouncer
  - blueprint
  - plan-gate
  - epic-registry
  - area
timestamp: '2026-10-20T11:27:39.273+09:00'
bouncer:
  id: registry-gates
  epic_id: context-search
  blueprint_id: registry-gates
  status: closed
  order: 42
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 003 registry-gates

Epic: [114](../../../consumer-epic-registry/index.md)

## Intent
- 문제: 등록부가 있어도 gate가 검사하지 않으면 미등록 epic, `legacy` epic의 새 blueprint, `area` 없는 `features` blueprint가 그대로 승인된다.
- 완료 조건: plan gate가 등록부 위반을 고유 G 코드로 차단하고, 도메인 epic과 `area`는 사용자 승인 명령으로만 등록부에 추가된다.

## Contract
- 인터페이스:
  - blueprint frontmatter 선택 키 `bouncer.area: string`, `bouncer.attribution: string`. `scaffold blueprint`는 `--area`, `--attribution`을 받는다.
  - plan gate 신규 코드: G26 등록부 없음, G27 미등록 epic 또는 slug/ID 불일치, G28 비활성 epic, G29 `legacy` epic의 `draft` blueprint, G30 `features` blueprint의 `area` 누락·미등록, G31 `attribution` 누락. 각 코드는 `GATE_FAILURE_HINTS`에 `next`를 갖는다.
  - `bouncer epic add-domain --slug <s> --reason <text> --yes [--timestamp <iso>]`, `bouncer epic add-area --name <a> --yes`. `--yes`가 없으면 파일을 읽기 전에 거절한다.
  - `bouncer plan inspect`는 `registry.promotions: { area: string; count: number }[]`를 낸다.
- 데이터·상태: `add-domain`은 `{ slug, id: <등록부 ID·epic 디렉터리 번호 최대값+1의 ddd>, kind: 'domain', active: true, approval: { reason, approvedAt } }`를 등록부에 추가한다. 디렉터리는 만들지 않으며, 다음 `/bouncer-plan`이 inspect `nextEpicId`로 scaffold한다.
- 수용 기준: Epic Success criteria 7–10이 참이다.
- 검증 명령: 종단 task `npm run ci`
- 실패 모드·엣지 케이스:
  - 공통 epic 판정은 slug로 한다. 같은 `features`가 프로젝트마다 다른 ID여도 같은 판정이다.
  - `features`가 아닌 epic의 blueprint에 `area`가 있으면 G30으로 실패한다.
  - 도메인 slug가 공통 slug이거나 목적형 이름(`performance`, `security`, `refactor`, `refactoring`, `followup`, `follow-up`, `cleanup`, `fix`, `bugfix`)이면 거절한다. `area` 이름도 같은 규칙을 따른다.
  - 승격 제안은 threshold 부재, 기준 미만, 상한 소진에서 빈 배열이다.
  - 이 저장소의 epic 114 blueprint는 BP001 실행 전 같은 계획 세션에서 승인되므로 G29(`draft`만)에 걸리지 않는다(epic `## 승인 순서`).
  - G27이 나면 그 blueprint의 G28~G31은 검사하지 않는다.

## Out of scope
- `legacy` epic의 물리적 이관과 trailer·runtime 참조 이관
- 이 저장소의 도메인 epic 실제 등록
- `area` 이름 자동 추천

## One-commit justification
- gate 검사, 그 검사가 읽는 frontmatter 키, 등록부를 바꾸는 승인 명령이 한 차단 계약을 이루므로 한 리뷰 단위다.
