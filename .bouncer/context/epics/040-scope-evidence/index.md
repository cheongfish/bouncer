---
type: bouncer.epic
title: 040 scope-evidence
description: 범위 판단 근거를 bouncer.scope_evidence로 분리하고 Graphify를 그 근거의 생성자로 명확히 한다
resource: .bouncer/context/epics/040-scope-evidence/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-18T08:58:48.485+09:00'
bouncer:
  id: '040'
  epic_id: '040'
  status: approved
---
# 040 scope-evidence

## Intent
- 문제: `bouncer.graph`가 Graphify 구현과 영향 범위 판단 근거를 같은 이름 아래에 섞어 둔다.
- 목표: 범위 판단 근거를 `bouncer.scope_evidence`로 분리하고 Graphify를 그 근거의 생성자로 명확히 한다.

## Success criteria
1. 새 task 문서는 `scope_evidence`에 Graphify 실행 근거와 경로 후보를 기록하고 plan gate를 통과한다.
2. 기존 `graph` 문서는 정규화 경로를 통해 구조 검사와 plan gate를 통과한다.
3. `affected_paths`는 사용자 승인 값으로 남고 evidence의 `suggested_paths`와 구별된다.
4. 규칙·스킬·사람용 문서가 Graphify를 scope-evidence producer로 설명한다.

## Out of scope
- Graphify의 그래프 생성·검색 알고리즘과 설정 키는 바꾸지 않는다.
- Graphify 외 evidence producer와 자동 범위 승인은 이번 에픽에 넣지 않는다.

## Blueprints
* [Scope evidence 계약](blueprints/001-scope-evidence-contract/index.md) - Graphify 근거의 스키마·호환성·게이트와 관련 문서를 전환한다.
