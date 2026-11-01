---
type: bouncer.blueprint
title: 드라이브 복구와 CLI 계약 정리
description: 드라이브 복구와 CLI 계약을 현재 동작에 맞게 정리한다.
resource: .bouncer/context/epics/drive-execution/blueprints/drive-recovery-contracts/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-11-01T19:21:41.742+09:00'
bouncer:
  id: drive-recovery-contracts
  epic_id: drive-execution
  blueprint_id: drive-recovery-contracts
  status: closed
  order: 79
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
---
# drive-recovery-contracts drive-recovery-contracts

Epic: [drive-execution](../../index.md)

## Intent
드라이브의 변경 없는 보고와 작업자 기록 불일치, Codex 역할 불일치에 대한 판정과 복구를 현재 코드에 맞게 정리한다. CLI 계약을 사용 단계별로 분리하고 현재 검증 실패 여부를 재현한다.

## Contract
- REQ-01: 현재 attempt의 보고가 있고 HEAD와 작업 내용이 dispatch 기준과 같을 때 `next`와 `advance`가 빈 commit을 반복하지 않는다. 보고의 의미·순서 판단은 coordinator가 맡고 CLI는 승인된 형식과 evidence 참조를 검사하며 reviewer가 사후 판정한다. 상황을 coordinator에게 알리고 coordinator의 판단 후 정상 commit을 진행한다.
- REQ-02: dispatch 두 번, 모델 한 건, 토큰 unreported 한 건 및 중복 거절을 재현하고 호출별 기록 대응을 확인한다. 기존 기록을 임의로 덮거나 원장을 수동 편집하는 복구를 제시하지 않는다. 귀속이 모호해도 기존 기록을 보존하고 coordinator에게 알린 뒤 차단 없이 재개할 수 있게 한다.
- REQ-03: `c5560b02` 이후 생성·검사와 effort 전달을 확인한다. 역할 불일치는 coordinator에게 알리고 fallback으로 배정하며, fallback은 전체 역할 본문과 controller 입력 및 동일 권한 경계를 유지한다. coordinator는 drive에 치명적이지 않은 결함을 자체 수정하고 재개한다. 사용자 전용 승인과 gate를 우회하지 않으며 모델 거절은 역할 불일치와 구분한다.
- REQ-04: `rules/cli.md`는 색인·공통 결과 처리, `rules/cli-coordinate.md`는 coordinator, `rules/cli-workflow.md`는 workflow, `rules/cli-discovery.md`는 조회, `rules/cli-migration.md`는 이관 계약을 소유한다. coordinator 표와 검사·참조를 먼저 옮긴 뒤 나머지를 이관한다. 명령별 계약과 거절 및 복구 안내는 유실하지 않는다.
- 과거 G13 기록은 현재 증거가 아니다. 현재 checkout에서 격리 fixture로 execute gate와 지정 verify를 재현하고, 실패 시 코드·메시지·next와 실제 원인을 보고한다. 범위 밖 수정이 필요하면 중단해 재승인을 요청한다.
- 각 commit task는 전용 검증을 실행하고 통합 후 `npm run verify:strict`를 실행한다. 이 blueprint의 사용자 확정 종단 명령은 epic 성공 기준 8의 `npm run ci`에 대한 명시적 예외이며, 그 기준의 나머지 항목은 유지한다. 성공 기준 13은 model-dispatch-enforcement 변경에 적용한다. 게이트 증적을 수동 작성하지 않는다.

## Out of scope
- 삭제된 당시 원장·worktree 복원이나 과거 성공의 소급 인정.
- 승인되지 않은 경로 수정, 사용자 승인 및 게이트 우회.

## One-commit justification
네 요구사항은 같은 드라이브 중단에서 이어지는 판정·기록·배정·계약 탐색 경로이며 함께 검토해야 복구 안내의 정합성을 판단할 수 있다. 개별 task로 검증·통합하되 하나의 사용자 인계로 묶는다.
