---
type: bouncer.epic
title: 플러그인 표면 간소화
description: Streamline plugin surfaces and execution policies across independent blueprints.
resource: .bouncer/context/epics/plugin-surface-slimming/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-29T10:19:19.212+09:00'
bouncer:
  id: plugin-surface-slimming
  epic_id: plugin-surface-slimming
  status: approved
  supersedes: []
---
# 플러그인 표면 간소화

## Intent
플러그인의 진입점과 실행 정책이 겹쳐 사용과 유지에 드는 비용이 커졌다. 독립된 변경을 의존 순서에 따라 여러 blueprint로 정리한다.

## Success criteria
1. 독립 retro skill이 제거되고 finalize가 동등한 회고 절차를 reference로 사용하며 CLI 기반 대체 경로가 안내된다.
2. 후속 full blueprint들이 범위와 충돌, 조기 검증과 환경, light 실행 통합, 복잡도 판정, workflow 도구화, 측정과 평가, init 개선 검토를 각각 다루며, 각 blueprint에 확정된 범위·의존관계·판정 가능한 수용 기준이 기록된다. 범위·충돌 기반은 light 범위 시험보다, 리뷰 증거 보존은 리뷰 효과 측정보다 먼저 진행한다.

## Out of scope
- 과거 `.bouncer/context` 기록의 수정과 회고 품질 비교.

## Blueprints
* [회고 reference 이관](blueprints/retro-reference/index.md) - finalize reference와 진입점·배포·테스트 계약을 정비한다.
* [실행 기록 보존과 예상 경로 정책, 조기 검증과 호스트 표면 정비](blueprints/measure-scope-env-surface/index.md) - finalize snapshot·digest와 집계 스크립트, commit guard·coordinate report 범위 정책, prepare baseline, 호스트 표면 테스트를 바꾼다.
