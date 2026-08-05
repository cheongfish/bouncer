---
type: bouncer.epic
title: 007 project-distill
description: Epic 007
resource: .bouncer/context/epics/007-project-distill/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T04:59:09.977Z'
bouncer:
  id: '007'
  epic_id: '007'
  status: approved
---
# 007 project-distill

## Intent
- 문제: BP `distill.md`는 finalize 게이트 토큰으로만 쓰이고, 다음 plan/execute가
  읽지 않아 프로젝트 교훈·현재 결정이 런타임에 연결되지 않는다.
- 목표: `.bouncer/context/Distill.md`를 프로젝트 공용 Distill로 두고, 마스터 룰은
  경로만 가리키며, plan/execute는 읽고, finalize는 curated 승격으로 갱신한다.

## Success criteria
1. 새 저장소 `bouncer init` 후 `.bouncer/context/Distill.md`가 생기고, 이미 있으면
   덮어쓰지 않는다.
2. plan/execute 스킬이 전역 Distill을 preflight에서 읽도록 명시한다.
3. finalize 스킬이 BP distill → 전역 Distill 승격(추가·교체·폐기)을 명시한다.
4. `bouncer finalize`가 `.bouncer/context/Distill.md` 변경을 out-of-scope로
   거부하지 않는다.
5. 마스터 룰은 전역 Distill 경로와 읽기 의무만 담고 본문을 넣지 않는다.
6. `npm test` 통과.

## Out of scope
- BP `distill.md` / G9 `published` status 머신 제거 또는 교체.
- 전역 Distill 본문 품질·분량을 게이트가 깊게 검사하는 것.
- 별도 ADR 시스템·learnings 디렉터리·루트 `AGENTS.md` 자동 병합.
- 과거 BP distill 일괄 재작성(시드는 전역 파일 한 곳에만).

## Blueprints
* [001 global-distill-runtime](blueprints/001-global-distill-runtime/index.md) - 전역 Distill 파일·init/finalize 허용·스킬·마스터 룰을 한 커밋으로 연결한다
