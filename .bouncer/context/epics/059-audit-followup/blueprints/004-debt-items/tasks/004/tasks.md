---
type: bouncer.tasks
title: 감사 부채 처리 결정 기록
description: B7–B11의 수정 여부와 유지 근거 및 재검토 조건을 한 문서에 고정한다
resource: .bouncer/context/epics/059-audit-followup/blueprints/004-debt-items/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-31T10:42:21.291+09:00'
bouncer:
  id: TASKS-004
  epic_id: '059'
  blueprint_id: '004'
  status: verified
  verify: npm run ci
  commit_intent:
    - 감사 부채의 처리 결과가 코드와 여러 문서에 흩어지는 문제를 막음
    - 유지하는 제약도 재검토 조건과 함께 공개해 미완료와 결정을 구분함
  affected_paths:
    - docs/audit-debt-decisions.md
    - docs/README.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-31T10:55:16+09:00'
    suggested_paths:
      - scripts/src/lib
      - test
      - .bouncer/distill
    # 유효 엔트리 필드: graph, status, query, result — 예시는 주석이라 파싱되지 않는다
    # - graph: source | context
    #   status: updated | reused | fail-skip | skip-disabled | missing
    #   query: <graphify 조회>
    #   result: <한 줄 요약>
    basis:
      - graph: source
        status: reused
        query: audit debt decisions final quiz gaps markdown assertions pointer parallel limit
        result: 102 hits; top paths scripts/src/lib and test reflected existing contracts
      - graph: context
        status: reused
        query: audit debt B7 B8 B9 B10 B11 B16 decision record
        result: 6 hits; only .bouncer/distill decision summaries matched
---
# Tasks

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | context
     status: updated | reused | fail-skip | skip-disabled | missing
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
B7–B11 각각의 처분, 근거, 현재 완화책, 재검토 조건을 `docs/audit-debt-decisions.md` 한 문서에 기록한다. B8은 task 001의 수정으로 연결하고 B7·B9·B10·B11은 기존 계약을 유지하는 의식적 결정으로 남긴다.

## Interface
- 제공: docs 목차에서 접근 가능한 결정 문서가 B7–B11마다 상태, 결정, 근거, 완화책, 재검토 조건을 제공한다. B8은 따옴표 명령어 탐지 보강을 수정 상태로 기록한다.
- 거부: “나중에 검토”만 적거나 재검토 조건 없이 영구 제약으로 선언하지 않는다. 결정 문서에서 새 게이트·설정·병렬 상태를 약속하지 않는다.

## Touch
- Create `docs/audit-debt-decisions.md` — B7–B11 처리 표와 결정별 근거·완화책·재검토 조건을 담는다.
- Modify `docs/README.md` — 사람용 문서 목차에서 감사 부채 결정 문서를 연결한다.

## Do not touch
- `bouncer-audit.md` — 사용자 소유 감사 원문은 계획의 입력이며 이번 커밋의 수정 대상이 아니다.
- `docs/benchmark/` — B5 효과 입증 스트림은 epic 051·052 소관이다.
- `scripts/src/` — task 004는 구현 계약을 바꾸지 않는 문서 결정 커밋이다.
- `skills/` — 필수 퀴즈와 run autonomy 절차는 유지 결정의 근거이지 수정 대상이 아니다.

## Constraints
- B7은 `autonomy`가 `/bouncer-run`의 ACQ 빈도만 정하고 finalize 이해 확인은 생략하지 않는 현재 경계를 유지한다.
- B9는 G9·G15·S14를 호환성 기록용 결번으로 유지하고 재사용하지 않는다.
- B10은 식별자·계약 단언을 유지하되 문구 결합 테스트는 해당 문서를 수정하는 커밋에서 점진적으로 옮긴다는 ADR G 결정을 유지한다.
- B11은 저장소당 활성 blueprint 하나를 유지하고 병렬 작업은 독립 clone을 사용한다.
- 현재 사실과 미래 조건을 구분하고 완료되지 않은 구현을 완료로 표현하지 않는다.

## Checklist
- [ ] 결정 문서의 표에 B7·B8·B9·B10·B11 다섯 행과 상태·결정·근거·완화책·재검토 조건 열을 만든다.
- [ ] B7은 무인 finalize 요구가 생기고 G16 이해 증적을 대체할 기계 증거가 생길 때, B9는 major 호환성 버전에서만 재검토한다고 적는다.
- [ ] B10은 문구 테스트 비율을 새 수치로 완료 주장하지 않고 ADR G의 점진 이행을 유지한다. B11은 포인터·원장을 namespaced하는 별도 설계가 승인될 때만 재검토한다고 적는다.
- [ ] B8 행은 task 001의 회귀 테스트와 보안 문서 변경을 수정 근거로 연결한다.
- [ ] docs 목차에 새 문서를 한 줄로 연결한다.
- [ ] `npm run ci`가 통과한다.
