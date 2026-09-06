---
type: bouncer.epic
title: 워크플로 신뢰성
description: Hardens workflow contracts so validation and review remain reliable across task lifecycles.
resource: .bouncer/context/epics/065-workflow-reliability/index.md
tags:
  - bouncer
  - epic
  - workflow
  - validation
  - review
timestamp: '2026-09-06T11:13:53.922+09:00'
bouncer:
  id: '065'
  epic_id: '065'
  status: approved
  supersedes: []
---
# 065 workflow-reliability

## Intent
- 문제: task 실행 과정의 문서 상태와 리뷰 이력이 충분히 구분되지 않아 정상 스캐폴드가 CI를 막거나 finding 처리 근거가 사라질 수 있음.
- 목표: 검증과 리뷰가 task 상태 및 이전 round를 근거로 일관된 결정을 내리도록 수명주기 계약을 강화함.

## Success criteria
1. 자동 context 주석 검사는 active 문서와 pending이 아닌 sibling 문서의 금지 주석을 실패시키고 pending sibling 문서는 제외한다.
2. 명시적 파일 인자로 호출한 context 주석 검사는 문서 상태와 관계없이 전달된 파일을 모두 검사한다.
3. 리뷰는 두 번 안에 승인하거나 확정된 조건을 모두 충족할 때만 세 번째 round를 한 번 허용한다.
4. 세 번째 round 뒤 actionable finding이 남거나 새 설계와 scope 확대가 필요하면 `/bouncer-plan`으로 보낸다.
5. execute review는 위험 수용 `accepted`와 후속 작업 이연 `deferred`를 구분하고 context review는 `deferred`를 거부한다.
6. review 기록은 이전 finding ID와 round별 `new`·`resolved`·`regressed` 집계를 보존한다.
7. 두 task의 회귀 테스트와 `npm run ci`가 통과한다.

## Out of scope
- 무제한 재리뷰와 reviewer fan-out
- 승인된 review frontmatter 확장 밖의 새 dependency, 사용자·CLI 공개 API, 프로젝트 설정, 데이터 마이그레이션 추가
- 승인된 brief 밖 finding의 즉석 수정
- 기완료 blueprint 문서의 소급 변경

## Blueprints
* [Task 수명주기 안정화](blueprints/001-task-lifecycle-hardening/index.md) - context 주석 검사 범위와 리뷰 round·finding 계약을 상태 및 테스트와 함께 보강한다.
