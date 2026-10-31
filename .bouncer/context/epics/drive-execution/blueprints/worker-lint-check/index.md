---
type: bouncer.blueprint
title: 구현 worker 변경 파일 lint 점검 절차 추가
description: 구현 worker가 report 전에 자기 변경 ts·js 파일에 eslint를 실행하게 해 종단 검증 전에 lint 위반을 잡는다.
resource: .bouncer/context/epics/drive-execution/blueprints/worker-lint-check/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-27T11:04:47.520+09:00'
bouncer:
  id: worker-lint-check
  epic_id: drive-execution
  blueprint_id: worker-lint-check
  status: closed
  order: 68
  commit_type: feat
  scale: light
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: '구현 worker lint 점검 절차: bouncer-run 단계 동작'
  supersedes: []
---
# worker-lint-check
Epic: [drive-execution](../../index.md) · Tasks: [001](tasks/001/tasks.md)
## Intent
- 문제: 120자 규칙이 문서에 있어도 worker가 task 전용 테스트만 돌려 종단 `npm run ci`의 eslint 오류가 repair wave를 낳았다(약 7분, 12만 토큰). 완료 조건: implementer 절차가 변경 파일 eslint 실행을 명시하고 `bouncer.verify`·증거 형식·gate는 그대로다. `CHANGELOG.md`·버전 파일은 바꾸지 않는다.
