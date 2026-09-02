---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/005-scope-evidence-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-18T09:51:01.667+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: 34ebaf2ba1c5d564ada4d9d3d973e6c3447ee0ba
      diff_sha: 94b2927d3b591ae5fbdac5b7c6b85ccc8466cb5f44461f6428cb36ffc0cc6ad6
      quiz_score: '3/3'
      disposition: 범위 근거와 승인 범위의 경계, 새·구 형식의 충돌 처리, 공통 정규화의 목적을 정확히 설명함
      recorded_at: '2026-08-18T09:55:00.000+09:00'
---
# Explain

## Background
`bouncer.graph`라는 이름이 Graphify 구현과 범위 승인 근거를 한 덩어리로 보이게 했다. 이번 변경은 task frontmatter의 정본을 `bouncer.scope_evidence`로 바꾸고, Graphify 결과가 제안한 후보와 사람이 확정한 `affected_paths`를 분리한다.

기존 계획 문서가 바로 깨지지 않도록 읽을 때만 `graph`를 같은 내부 표현으로 정규화한다. 새 문서에 두 필드가 함께 있으면 모호하므로 S9와 G4가 거절한다.

## Intuition
`scope_evidence`는 지도에서 찾은 후보 표시이고, `affected_paths`는 검토자가 서명한 실제 공사 구간이다.

## Code
- `scripts/src/lib/validate-structural.ts`: `normalizeScopeEvidence`가 새 형식과 구 `graph`를 한 번만 읽고 producer·시각·후보·basis를 검사한다.
- `scripts/src/lib/validate-gates.ts`: G4가 위 정규화 결과를 소비하므로 구조 검사 S9와 계획 게이트가 다른 결론을 내지 않는다.
- `scripts/src/lib/scaffold.ts`: 새 task scaffold는 `scope_evidence` 빈 구조를 만든다.
- `skills/graphify-runner/SKILL.md`, `skills/bouncer-plan/SKILL.md`, `docs/ARCHITECTURE.md`: Graphify는 후보 근거를 기록하고, 사용자가 `affected_paths`를 확정한다는 경계를 같은 표현으로 설명한다.

## Quiz
1. 새 task 문서에 `scope_evidence`와 기존 `graph`가 함께 있으면 어떻게 처리해야 할까?
   - A) `scope_evidence`를 우선해 계속 진행한다.
   - B) 모호한 입력으로 보고 S9/G4에서 거절한다.
   - C) 두 객체의 후보 경로를 합친다.

2. `scope_evidence.suggested_paths`의 역할은 무엇일까?
   - A) Graphify가 제안한 후보이며, 사용자가 별도로 `affected_paths`를 확정한다.
   - B) 승인된 `affected_paths`를 자동으로 덮어쓴다.
   - C) 검증 실행 명령을 저장한다.

3. S9와 G4가 같은 `normalizeScopeEvidence` helper를 쓰는 이유는 무엇일까?
   - A) Graphify 질의를 한 번만 실행하기 위해서다.
   - B) 새 문서의 생성 시각을 자동 보정하기 위해서다.
   - C) 구조 검사와 계획 게이트가 새·구 형식에 대해 같은 판단을 하게 하기 위해서다.

## 이해 상태
정답은 1-B, 2-A, 3-C이며 응답도 모두 일치했다. `scope_evidence`와 `graph`의 동시 작성은 거절하고, 후보 경로는 승인 범위를 자동 변경하지 않으며, S9/G4는 공통 정규화 결과로 같은 계약을 판단한다. 결과: 3/3.
