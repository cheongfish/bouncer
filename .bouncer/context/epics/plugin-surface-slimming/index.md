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
- 과거 `.bouncer/context` 기록의 수정과 회고 품질 비교. 예외는 하나다: `complexity-declaration` blueprint가 `drive-execution/worker-lint-check/index.md`의 `status`를 `approved`에서 `closed`로 바꾸는 한 줄(PR #284 병합 완료, 사용자 확인). 이 문서의 다른 줄과 `explain.md`는 바꾸지 않는다.

## Blueprints
* [회고 reference 이관](blueprints/retro-reference/index.md) - finalize reference와 진입점·배포·테스트 계약을 정비한다.
* [실행 기록 보존과 예상 경로 정책, 조기 검증과 호스트 표면 정비](blueprints/measure-scope-env-surface/index.md) - finalize snapshot·digest와 집계 스크립트, commit guard·coordinate report 범위 정책, prepare baseline, 호스트 표면 테스트를 바꾼다.
* [light 실행과 직접 실행 경로 통합](blueprints/light-direct-run-unification/index.md) - coordinator 원장·prepare·next·fan-in·promote와 preflight 직접 자격, drive_record와 집계 스크립트, `/bouncer-run` 문서를 바꾼다.
* [light 선언 제거와 복잡도 선언 통합](blueprints/complexity-declaration/index.md) - blueprint `complexity` 선언과 scaffold·구조 검사, plan gate·routing·approve, 리뷰 전략과 리뷰어 등급, coordinator 원장·preflight·promote 경로, plan·run 문서와 벤치마크 응답기를 바꾼다.
* [복잡도 신호 계산 통합과 리뷰 문턱 재조정](blueprints/complexity-signals/index.md) - 공용 신호 모듈과 `complexity.*` 설정, 리뷰 snapshot 파일별 줄 수, plan inspect routing과 review-dispatch의 리뷰 전략·리뷰어 등급 기준, worker-model 기록과 drive_record 집계, plan·규칙·설정 문서를 바꾼다.
