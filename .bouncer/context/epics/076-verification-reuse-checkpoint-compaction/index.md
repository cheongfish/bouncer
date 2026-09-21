---
type: bouncer.epic
title: 검증 증적 재사용과 실행 체크포인트 압축
description: Reuses successful verification evidence and compacts completed coordinator state without weakening auditability.
resource: .bouncer/context/epics/076-verification-reuse-checkpoint-compaction/index.md
tags:
  - bouncer
  - epic
  - verification
  - coordinator
  - checkpoint
timestamp: '2026-09-21T12:54:52.715+09:00'
bouncer:
  id: '076'
  epic_id: '076'
  status: approved
  supersedes: []
---
# 검증 증적 재사용과 실행 체크포인트 압축

## Intent

- 문제: 같은 저장소 상태를 같은 범위로 검증해도 명령을 반복 실행하고, coordinator는 완료 task의 상세 기록까지 활성 응답에 계속 실어 장기 drive의 비용이 커진다.
- 목표: 성공 검증은 입력 정체성이 완전히 같을 때만 재사용하고, 완료 task는 감사 가능한 원장을 가리키는 checkpoint로 접어 활성 context를 제한한다.

## Success criteria

1. Git HEAD, dirty digest, 명령, 논리 cwd, 환경 hash와 검증 범위가 모두 같은 성공 결과만 재사용한다.
2. 정체성 구성 요소 하나라도 다르거나 이전 결과가 실패·중단이면 검증 명령을 다시 실행한다.
3. 같은 identity를 task-local, wave, terminal scope로 각각 호출하면 서로 다른 evidence ID와 범위 레코드가 생기고 상호 재사용되지 않는다.
4. 검증 문서와 하네스 원장에 evidence ID, 신규 실행 또는 재사용 여부, 원본 evidence ID가 남아 G13이 둘을 대조한다.
5. 완료 task는 ID, 상태, attempt, commit SHA, changed paths, scope revision, verify/review evidence ID, advisory만 활성 checkpoint에 남는다.
6. coordinator는 checkpoint만으로 ready wave, 미해결 결정, 최근 실패와 다음 fan-in을 판단하고 완료 task 원문이나 과거 worker report 본문을 다시 받지 않는다.
7. checkpoint가 가리키는 ledger 경로·hash가 현재 상세 원장과 다르면 상태 변경 명령이 쓰기 전에 거절된다.
8. 기존 repair, partial-close, stale dispatch, G13과 전체 `npm run ci` 계약이 유지된다.

## Out of scope

- 실패 검증 결과 재사용과 원격·공유 cache
- 서로 다른 검증 범위 사이의 결과 승격
- 과거 verify 또는 coordinator ledger 일괄 migration
- 상세 원장 삭제와 audit history 축약
- pointer-independent 병렬 task 실행과 finalize digest 기반 마감

## Blueprints

* [검증 재사용과 coordinator checkpoint](blueprints/001-verification-reuse-checkpoint-compaction/index.md) - verify ledger에 내용 주소화된 성공 증적을 남기고 coordinator status를 hash-fenced checkpoint로 제한
