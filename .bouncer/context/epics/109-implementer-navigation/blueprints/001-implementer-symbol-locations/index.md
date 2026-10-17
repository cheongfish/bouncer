---
type: bouncer.blueprint
title: 구현자 함수 위치 전달
description: Projects cached source locations into implementer intent sections without changing Explain selection.
resource: .bouncer/context/epics/109-implementer-navigation/blueprints/001-implementer-symbol-locations/index.md
tags:
  - bouncer
  - blueprint
  - intent
  - implementer
  - symbol-location
timestamp: '2026-10-17T22:55:01.174+09:00'
bouncer:
  id: '001'
  epic_id: '109'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 구현자 함수 위치 전달

Epic: [109](../../index.md)

## Intent
구현자가 현재 task의 함수를 찾을 수 있도록 공유 intent bundle의 함수 위치를 역할 응답에 전달함.
Explain 절 선택과 실패 처리를 유지하면서 위치 목록과 전달·사용 지침을 추가함.

## Contract
### 인터페이스

`bouncer intent sections --task <tasks.md> --role implementer`의 성공 객체에 `symbol_locations`를 추가한다. reviewer·debugger 성공 객체에는 이 필드를 추가하지 않는다. 기존 `functions`의 필드와 절 선택은 유지한다.

```typescript
type SymbolLocation = {
  symbol: string;
  function_ref: string;
  symbol_ref: {
    path: string;
    qualified_name: string;
    kind: string;
    start_line: number;
    end_line: number;
    blob_sha: string;
  };
};
```

### 데이터·상태

같은 task에 대해 preflight가 resolve한 bundle의 항목 순서와 원본 값을 보존한다. `resolved`와 `unlinked` 항목마다 위치 하나를 포함한다. historical은 Explain provenance의 freshness이며 현재 bundle 좌표를 제외하는 조건이 아니다. `unresolved`·미선택 `ambiguous`에는 위치를 합성하지 않는다. 빈 bundle은 빈 목록이다.

`intent_sections` 안에 목록을 넣고 기존 `task_brief_hash`, `intent_bundle_id`, `intent_bundle_revision`과 동일 bundle을 가리킨다. 캐시 형식·ID·revision 계산은 바꾸지 않는다.

### 전달·사용

named·generic fallback·inline implementer 경로는 CLI 응답 객체를 통째로 전달하거나 사용한다. controller가 캐시를 직접 읽어 목록을 구성하지 않는다. 구현자는 제공된 범위를 먼저 읽어 정의를 확인하고 좌표가 어긋나면 함수명으로 다시 찾는다. 호출부 확인과 Touch / Constraints / `affected_paths`는 계속 적용한다.

### 수용 기준과 검증

Epic 성공 기준 1–8을 TASKS-001의 상태별 회귀, CLI JSON 검증, 역할 문서·생성본 일치 검사로 확인한다. 집중 검증은 task Checklist의 명령을 따른다. 종단 명령은 사용자 확인 전에는 task frontmatter에 설정하지 않는다.

### 실패 모드·엣지 케이스

- Explain이 없는 기존 함수와 미추적 새 함수도 `unlinked` 좌표를 전달한다. 가짜 Explain·freshness·절 본문은 생성하지 않는다.
- historical 위치는 현재 bundle의 좌표를 사용하고 과거 commit을 조회하지 않는다.
- bundle 누락·brief 불일치·Explain drift·invalid task는 기존 오류와 `next`를 반환한다. 위치가 있어도 부분 성공을 반환하지 않는다.
- projection은 읽기 전용이며 위치 전달 때문에 resolver·Graphify 실행이나 소스 검증 gate를 추가하지 않는다.

## Out of scope
- reviewer·debugger 확장, bundle 저장·캐시 정책과 symbol-index 변경
- Graphify 추가 실행, 새 파서, 수동 좌표로 자동 전달 대체, 토큰 절감 측정
- task 권한·승인·검증 gate와 현재 Drive의 작업 변경

## One-commit justification
공유 응답 필드 하나를 제공하는 projection, 이를 운반·사용하는 지침과 회귀 테스트가 하나의 기능을 이룬다. 별도 저장 형식이나 실행 상태 전이가 없어 TASKS-001 한 커밋으로 검토한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
