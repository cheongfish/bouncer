---
type: bouncer.epic
title: 구현자 함수 탐색 지원
description: Delivers task scoped source locations to implementers from the shared intent bundle.
resource: .bouncer/context/epics/implementer-navigation/index.md
tags:
  - bouncer
  - epic
  - intent
  - implementer
  - navigation
timestamp: '2026-10-17T22:54:54.283+09:00'
bouncer:
  id: implementer-navigation
  epic_id: implementer-navigation
  status: approved
  supersedes: []
---
# 구현자 함수 탐색 지원

## Intent
공유 intent bundle에 함수 좌표가 있어도 구현자에게 전달되지 않아 소스 위치를 다시 찾아야 함.
현재 task가 요청한 함수 좌표를 구현자에게 전달하고 실제 정의를 확인하는 탐색 기준으로 사용함.

## Success criteria
1. implementer용 `intent sections` 성공 응답은 최상위 `symbol_locations` 배열을 가진다. 각 항목의 `symbol`, `function_ref`, `symbol_ref`는 같은 bundle의 원본 값과 일치한다.
2. `resolved`는 freshness에 관계없이, `unlinked`는 Explain 없이 위치를 전달한다. `unresolved`와 미선택 `ambiguous`는 제외하고 빈 bundle에는 `[]`를 반환한다. 순서는 bundle 순서이고 항목당 위치 하나다.
3. 기존 `functions` 필드와 역할별 Explain 절 선택은 유지한다. reviewer와 debugger 응답은 확장하지 않는다.
4. named·generic fallback·inline implementer 경로는 동일 task와 bundle revision의 `intent_sections.symbol_locations`를 제거하거나 재조립하지 않고 사용한다.
5. 기존 missing·stale·drift·invalid-task 오류와 `next`를 유지한다. projection 때문에 bundle revision, Graphify 실행, provenance 재조회 또는 소스 검증 gate가 추가되지 않는다.
6. 구현자 지침은 위치를 bundle 생성 당시의 탐색 포인터로 정의한다. 구현자는 실제 정의를 확인하고 좌표가 어긋나면 심볼로 재검색하며 task 권한을 유지한다.
7. TypeScript는 `npm run build`로 생성하고 `scripts/lib`를 Git에 추가하지 않는다. 구현자 Markdown과 `.codex/agents/bouncer-implementer.toml`의 바이트 일치를 유지한다.
8. 상태별 projection·CLI 출력·역할 호환성 회귀 테스트와 문서 형상 검사가 통과한다. 종단 검증은 사용자 확인 명령 또는 기존 `config.verify`를 따른다.

## Out of scope
- reviewer·debugger 위치 전달, 새 파서, Graphify 좌표 복사, 저장소 전체 함수 자동 수집
- bundle 생성·캐시 재사용·freshness 의미 변경과 토큰 절감 측정
- task 권한, `affected_paths`, 승인·검증 gate 변경
- epic 073의 bundle 재사용 체계 재설계 및 epic 108의 검증 경계 변경

## Blueprints
* [구현자 함수 위치 전달](blueprints/implementer-symbol-locations/index.md) - intent projection의 위치 목록과 implementer 전달·사용 지침 및 회귀 테스트 변경
