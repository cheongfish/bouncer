---
type: bouncer.blueprint
title: 회고 절차 이관
description: Move the retro procedure into the finalize reference.
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/retro-reference/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-29T10:19:19.255+09:00'
bouncer:
  id: retro-reference
  epic_id: plugin-surface-slimming
  blueprint_id: retro-reference
  status: closed
  order: 1
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# 회고 절차 이관

Epic: [플러그인 표면 간소화](../../index.md)

## Intent
독립 회고 진입점을 제거하고 회고 절차를 finalize reference로 이관함. 기존 회고 CLI를 통한 증거 탐색 경로를 안내함.

## Contract
- 독립 `/bouncer-retro` skill은 호스트에서 노출되지 않고 finalize는 배포된 `skills/bouncer-finalize/references/retro.md`를 읽는다.
- finalize는 close 및 `release-main` 성공 후 `drive_issues`가 모두 0이면 기존 생략 문구를 출력한다. 문제가 있으면 현재 대화만으로 채팅에 후보를 출력하며 ACQ를 추가하거나 응답을 기다리지 않는다. 회고 실패는 finalize 결과를 바꾸지 않는다.
- 별도 회고는 기존 `bouncer retro sources`와 `bouncer retro read` 사용 경로로 안내한다. CLI 동작은 유지한다.
- 수용 기준: epic 기준 1, 관련 호스트 발견·배포 및 문서·테스트 계약 일치, 구현 검증 및 `npm test` 통과.
- 실패 모드: 오래된 skill 참조 또는 배포 누락을 검증에서 거부한다.

## Out of scope
- 과거 `.bouncer/context` 기록, CLI 구현, 품질 비교 및 다른 제안 영역.

## One-commit justification
진입점 제거, 대체 reference 및 이를 소비하는 문서와 테스트는 같은 공개 계약의 원자적 변경이다.
