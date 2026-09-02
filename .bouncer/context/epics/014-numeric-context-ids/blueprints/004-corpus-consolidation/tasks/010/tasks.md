---
type: bouncer.tasks
title: 공개 릴리스 계층 정합성 확인
description: Verifies the existing canonical open-source release hierarchy and removes the phantom release-security mapping.
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/004-corpus-consolidation/tasks/010/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-09-01T21:18:40.416+09:00'
bouncer:
  id: TASKS-010
  epic_id: '014'
  blueprint_id: '004'
  status: verified
  affected_paths:
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/context-review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/explain.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/index.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/001/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/001/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/001/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/004/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/004/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/004/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/context-review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/explain.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/index.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/003/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/003/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/003/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/context-review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/explain.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/index.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/002/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/002/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/002/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/003/review.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/003/tasks.md
    - .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/003/verification.md
    - .bouncer/context/epics/039-open-source-one-zero/index.md
    - .bouncer/context/index.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-01T21:18:40.416+09:00'
    suggested_paths: []
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | test | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    # quality/candidates는 graph-suggest 뒤에만 채운다 — scaffold가 제조하지 않는다
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - context graph query produced no safe file ranking for corpus migration
        - migration scope is confirmed from the explicit canonical mapping
    candidates:
      implementation: []
      test: []
      context: []
    basis:
      - graph: source
        status: reused
        query: canonical corpus migration task 010
        result: source graph does not determine document moves
      - graph: test
        status: reused
        query: canonical corpus migration task 010
        result: test graph does not determine document moves
      - graph: context
        status: updated
        query: canonical corpus migration task 010
        result: low-confidence; user-confirmed migration map supplies scope
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
039 문서가 이미 존재하는 canonical epic `039-open-source-one-zero`에만 속하는지 확인하고, 존재하지 않는 `039-release-security` source mapping을 계획에서 제거한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: release/security history가 `039-open-source-one-zero` 하나에 보존된다.
- 거부: 존재하지 않는 `039-release-security` hierarchy를 생성하거나 release artifact와 보안 정책을 변경하지 않는다.

## Touch
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/004/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/004/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/004/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/005/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/006/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/007/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/tasks/008/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/context-review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/explain.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/001/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/002/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/002/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/002/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/003/review.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/003/tasks.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/tasks/003/verification.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/epics/039-open-source-one-zero/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.
- Modify `.bouncer/context/index.md` — canonical epic migration의 source, destination, index 또는 regression artifact를 갱신한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `CHANGELOG.md` — release content는 변경하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 실제 inventory에 없는 source 파일은 이동 대상으로 취급하지 않는다.
- canonical 039 문서의 `resource`, 부모 경로, 내부 링크와 context index만 검증·정합화한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 실제 039 inventory를 고정하고 canonical epic에 속한 BP가 `001`~`003`인지 확인한다.
- [ ] destination 문서의 `resource`, 부모 epic/blueprint ID, 내부 링크를 대조하고 phantom `039-release-security` 경로를 생성하지 않는다.
- [ ] `.bouncer/context/index.md`에 canonical 039 epic 행이 하나인지 확인한다.
- [ ] `npm test`로 fixed query 회귀의 필수 hit와 후보 상한(각 query top-N 10건)을 확인한다.
- [ ] `rg -n '039-release-security' .bouncer/context --glob '!**/tasks/010/tasks.md'`가 0건인지 확인한다.
