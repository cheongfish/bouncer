---
type: bouncer.blueprint
title: 계획 경로 등록부 전환
description: Switch plan inspect and the bouncer-plan skill to registry epics and drop the shared maintenance epic path
resource: .bouncer/context/epics/consumer-epic-registry/blueprints/plan-path/index.md
tags:
  - bouncer
  - blueprint
  - plan-inspect
  - epic-registry
  - light-path
timestamp: '2026-10-20T11:27:39.176+09:00'
bouncer:
  id: plan-path
  epic_id: consumer-epic-registry
  blueprint_id: plan-path
  status: closed
  order: 2
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 002 plan-path

Epic: [114](../../index.md)

## Intent
- 문제: `plan inspect`와 `bouncer-plan` 스킬이 새 epic 생성과 공유 `maintenance` epic을 기본으로 제안해 epic이 작업 목적별로 늘어난다.
- 완료 조건: 등록부가 있으면 inspect는 등록부 epic과 `area` 후보를 출력하고, 스킬은 등록부 epic에 blueprint를 추가하는 경로를 기본으로 안내한다.

## Contract
- 인터페이스: `bouncer plan inspect` JSON에서 `maintenanceEpic`을 제거하고 `registry`를 추가한다.
  ```ts
  type InspectRegistry =
    | { status: 'missing'; next: string }
    | { status: 'invalid'; code: string; message: string; next: string }
    | { status: 'ok'; profile: string;
        epics: { slug: string; id: string; dir: string | null; kind: EpicKind;
                 description: string | null; include: string; exclude: string }[];   // active, non-legacy
        legacy: { slug: string; id: string; dir: string }[];
        areas: string[] };
  ```
  - `nextEpicId`는 등록부에 승인된 도메인 epic이 있고 그 디렉터리가 아직 없을 때만 그 ID를 낸다. 그 밖에는 `null`이다.
  - 등록부가 없으면 `nextEpicId`는 `null`이고 `registry.next`가 `bouncer init`을 가리킨다.
- 데이터·상태: 공통 epic 포함·제외 문구는 BP001 등록부 모듈의 공통 epic 목록에서 읽는다. 귀속 선택과 근거 작성은 스킬(모델)이 하며 CLI는 판단하지 않는다.
- 수용 기준: Epic Success criteria 5, 6이 참이다.
- 검증 명령: 종단 task `npm run ci`
- 실패 모드·엣지 케이스:
  - 등록부 형식이 틀리면 inspect는 `ok: true`를 유지하고 `registry.status: invalid`와 S 코드를 낸다.
  - 디렉터리가 없는 활성 공통 epic은 `dir: null`과 `COMMON_EPICS.description`을 낸다. 스킬은 그 epic을 고르면 `scaffold epic --id <id> --name <slug> --description <description>`으로 먼저 만든다. 도메인 epic의 `description`은 `null`이며 discovery에서 확정한 ASCII 문장을 쓴다.
  - 이 BP는 BP001 실행 전 같은 계획 세션에서 승인되므로 epic 114가 `legacy`가 되어도 막히지 않는다(epic `## 승인 순서`).
  - `legacy` epic은 후보에서 빠지고 `legacy` 목록에만 나온다.
  - 경량 선언도 귀속 규칙으로 대상 epic을 정하며, `maintenance` epic을 만들거나 고르지 않는다.

## Out of scope
- `area` 승격 제안과 도메인 epic 추가 명령 (BP003)
- plan gate 검사 (BP003)
- `063-maintenance` epic 문서 자체의 변경

## One-commit justification
- inspect 출력과 그 출력을 소비하는 스킬 문서가 한 계약을 가리키므로 한 리뷰 단위다.
