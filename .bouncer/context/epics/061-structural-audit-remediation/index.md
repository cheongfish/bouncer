---
type: bouncer.epic
title: 구조 감사 개선
description: Addresses measured structural audit findings through staged security, efficiency, correctness, and distribution improvements.
resource: .bouncer/context/epics/061-structural-audit-remediation/index.md
tags:
  - bouncer
  - epic
  - security
  - efficiency
  - correctness
  - distribution
timestamp: '2026-09-03T12:07:40.104+09:00'
bouncer:
  id: '061'
  epic_id: '061'
  status: approved
  supersedes: []
---
# 구조 감사 개선

## Intent
- 문제: 구조 감사에서 확인한 검증 실행의 셸 경계, 호스트별 commit 가드 차이, 반복 규칙 적재, 모듈 경계 타입 부재, 배포물 과적재가 남아 있다.
- 목표: 보안부터 순서대로 고치고, 각 단계의 계약과 검증을 다음 단계가 재사용하도록 한다.

## Success criteria
1. 저장소 문서의 검증 명령은 셸을 거치지 않고, 설정된 허용 실행 파일과 파싱된 argv로만 실행된다.
2. `bouncer commit`은 지원 호스트의 훅 유무와 관계없이 동일한 범위 검사 로직을 통과해야 하며, 호스트별 집행 차이가 호환성 문서에 기록된다.
3. 보안 blueprint는 두 task를 독립 커밋으로 검토할 수 있고, 각 task의 범위·검증 증거가 plan gate를 통과한다.
4. 이 epic에 포함될 후속 개선은 보안 blueprint와 겹치지 않는 파일 범위를 가진 별도 blueprint로만 추가된다.

## Out of scope
- 감사 수치의 재측정만을 위한 변경
- 도그푸딩 컨텍스트 코퍼스의 삭제
- 컨테이너·프로세스 격리나 신뢰할 수 없는 저장소 스크립트의 안전성 보장

## Blueprints
* [001 검증 실행과 커밋 범위 경계 강화](blueprints/001-security-boundary-enforcement/index.md) - 검증 러너와 commit 범위 검사를 셸·호스트 훅 의존 없이 일관되게 집행한다.
