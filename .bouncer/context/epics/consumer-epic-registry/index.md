---
type: bouncer.epic
title: 소비 프로젝트 epic 등록부
description: Fix consumer project epics to a registry of common epics with area tags and plan gate checks
resource: .bouncer/context/epics/consumer-epic-registry/index.md
tags:
  - bouncer
  - epic
  - epic-registry
  - plan-gate
  - init
timestamp: '2026-10-20T11:27:38.992+09:00'
bouncer:
  id: consumer-epic-registry
  epic_id: consumer-epic-registry
  status: approved
  supersedes: []
---
# 114 consumer-epic-registry

## Intent
- 문제: 소비 프로젝트는 계획마다 새 epic을 만들기 쉽고, 경량 계획은 경계 없는 공유 `maintenance` epic에 쌓여 epic이 기능 분류 단위로 남지 않는다.
- 목표: `.bouncer/epics.json` 등록부가 epic 구성을 정하고, 계획은 등록부 epic에 blueprint를 추가하며, plan gate가 등록부 위반을 고유 코드로 차단한다.

## Success criteria
1. 빈 프로젝트에서 `bouncer init`을 실행하면 `standard` 프로필 등록부와 공통 epic 8개(`foundation`, `core`, `data`, `integration`, `identity-access`, `interface`, `features`, `quality-ops`)의 `index.md`가 생기고, 재실행해도 파일이 바뀌지 않는다.
2. 기존 epic이 있고 bootstrap이 `ready`인 프로젝트에서 init은 공통 slug와 같은 epic의 ID를 그 공통 epic으로 등록하고, 나머지 epic을 `legacy`로 등록하며, 기존 파일을 덮어쓰지 않고 ID 충돌을 만들지 않는다. `legacy`·`partial` bootstrap은 지금처럼 건너뛰고 등록부를 쓰지 않는다.
3. 등록부 형식 위반(필수 키 누락, slug↔ID 중복, `area` 중복·slug 형식 위반, 1 미만 `areaPromotionThreshold`)은 validate에서 실패하고 `next`가 수정 방법을 가리킨다.
4. `legacy` epic 아래에서는 `scaffold blueprint`와 `draft` blueprint의 `plan approve`가 거절되고, 진행 중 blueprint의 run·finalize는 계속 동작한다.
5. 등록부가 있으면 `bouncer plan inspect`는 `maintenanceEpic`을 출력하지 않고, 승인된 미생성 도메인 epic이 없으면 `nextEpicId`를 `null`로 내며, 활성 epic·포함/제외 규칙·`area` 목록을 출력한다.
6. `bouncer-plan` 스킬과 `rules/planning.md`는 기존 등록부 epic에 blueprint를 추가하는 경로를 기본으로 안내하고, 공유 `maintenance` epic 경로와 epic 잠금 문구를 담지 않는다.
7. `bouncer validate --gate plan`은 등록부 없음, 미등록 epic·slug/ID 불일치, 비활성 epic, `legacy` epic의 `draft` blueprint, `area` 누락·미등록 `features` blueprint, `bouncer.attribution` 누락을 서로 다른 G 코드로 실패시키고, 공통 epic 숫자 ID가 프로젝트마다 달라도 같은 판정을 낸다.
8. 도메인 epic 추가 명령은 `--yes` 없음, 상한 초과, 사유 없음, 공통 slug, 목적형 이름을 거절하고, 통과하면 사유·승인 시각·배정 ID를 등록부에 기록한다.
9. `areaPromotionThreshold` 이상이고 도메인 epic 상한에 여유가 있을 때만 inspect가 `area` 승격을 제안한다.
10. 공용 fixture 헬퍼는 기본으로 `standard` 등록부를 만들고, 플러그인 저장소의 `.bouncer/epics.json`을 바꿔도 단위·통합 테스트 결과가 같다.
11. 각 blueprint는 `CHANGELOG.md` `[Unreleased]` 항목을 추가하고, 종단 검증 `npm run ci`가 통과한다.

## 승인 순서
- BP001~003은 BP001 실행 전 같은 계획 세션에서 모두 승인한다. 승인된 blueprint는 `legacy` 차단(`draft`만 거절)에 걸리지 않는다. 이후 epic 114에는 blueprint를 추가하지 않는다.

## Out of scope
- `legacy` epic의 물리적 이관 도구와 trailer·runtime 참조 이관 (REQ-13~15). BP001 뒤 이 저장소에서 epic 114도 `legacy`가 되므로, 필요하면 `bouncer epic add-domain`으로 등록한 도메인 epic 아래에 계획한다.
- 플러그인 저장소의 기능 영역 재배치와 도메인 epic 실제 등록 (`EPIC-CONSOLIDATION-FOLLOWUP.md`)
- 소스코드 책임 분해 (`SOURCE-RESTRUCTURING-PROPOSAL.md`)
- 도메인 epic 이름과 `area` 이름의 자동 추천, CLI 휴리스틱 귀속 판단

## Blueprints
* [001 등록부 기반](blueprints/registry-foundation/index.md) - `.bouncer/epics.json` 형식·프로필·구조 검증, init의 공통 epic scaffold와 `legacy` 등록, `legacy` scaffold·approve 차단, 공용 fixture 헬퍼
* [002 계획 경로 전환](blueprints/plan-path/index.md) - `plan inspect` 등록부 후보 출력과 `maintenanceEpic` 제거, `bouncer-plan` 스킬·`rules/planning.md` 기본 경로 전환
* [003 등록부 gate](blueprints/registry-gates/index.md) - plan gate 등록부 검사(G 코드), `area`·`attribution` frontmatter, 도메인 epic·`area` 추가 명령, 승격 제안, 기존 테스트 fixture 등록부 추가

## Flow

```mermaid
flowchart LR
  A[init 등록부] --> B[inspect 후보]
  B --> C[귀속·area 기록]
  C --> D[plan gate 검사]
  D --> E[approve]
```
