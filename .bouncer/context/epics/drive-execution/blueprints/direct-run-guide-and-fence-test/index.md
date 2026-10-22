---
type: bouncer.blueprint
title: direct 실행 안내와 fence 거절 테스트 보강
description: session-handoff-note 회고에서 나온 fence 거절 단언 조임과 direct 실행 절차 문서 두 줄 보강.
resource: .bouncer/context/epics/drive-execution/blueprints/direct-run-guide-and-fence-test/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T22:36:18.997+09:00'
bouncer:
  id: direct-run-guide-and-fence-test
  epic_id: drive-execution
  blueprint_id: direct-run-guide-and-fence-test
  status: closed
  order: 63
  commit_type: docs
  scale: light
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: direct 실행 절차 문서와 coordinator fence 테스트 보강이라 bouncer-run 단계 동작 epic에 귀속
  supersedes: []
---
# direct 실행 안내와 fence 거절 테스트 보강
Epic: [drive-execution](../../index.md) · Tasks: [001](tasks/001/tasks.md), [002](tasks/002/tasks.md)
## Intent
- fence 거절 테스트가 두 reason을 정규식 하나로 받아 어느 쪽이 나와도 통과하고, direct 실행 문서에는 `metrics end` 시점과 `coordinate` 명령의 실행 cwd 안내가 빠져 있어 session-handoff-note drive에서 실수와 시행착오가 났다.
- 단언을 케이스별 정확한 reason으로 조이고, 두 문서에 각각 한 문단을 보강한다. 명령 동작과 CLI는 바꾸지 않는다.
