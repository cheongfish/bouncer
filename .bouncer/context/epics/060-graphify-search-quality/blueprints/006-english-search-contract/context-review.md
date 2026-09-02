---
type: bouncer.context_review
title: 영어 검색 계약 계획 정합성 판정
description: 062/001 계획 문서의 교차 모순, 범위, 한국어 품질, 성공 기준 검증 가능성을 판정한 결과.
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/006-english-search-contract/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-31T16:55:00.000+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '060'
  blueprint_id: '006'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: major
        status: resolved
      - id: CR-002
        severity: major
        status: resolved
      - id: CR-003
        severity: major
        status: resolved
      - id: CR-004
        severity: minor
        status: resolved
      - id: CR-005
        severity: minor
        status: resolved
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: nit
        status: resolved
      - id: CR-008
        severity: nit
        status: resolved
---
# Context review

## Findings
- CR-001 (major, resolved) — blueprint Contract가 `stop-slop` 충돌 해소를 약속했으나 어느 task도 이행하지 않았다. task 001 Constraints와 Checklist에 면제 문장을 `references/spec-authoring/index.md` 「Language and prose」에 적도록 추가했다. `references/stop-slop/`는 Do not touch로 남는다.
- CR-002 (major, resolved) — `CLAUDE.md`는 `test/master-rules.test.js`의 6135 UTF-8 바이트 상한에 묶이고 여유가 594바이트뿐인데, 그 테스트 파일이 task 001의 affected_paths에 있어 구현자가 상한을 올려 통과시킬 수 있었다. Constraints에 현재 바이트 수와 "상한을 올리지 않는다"를 명시하고 Checklist에 확인 항목을 넣었다.
- CR-003 (major, resolved) — epic 성공 기준 1(앵커 문법 진술)을 고정하는 단언이 없었다. task 002 Checklist에 `rules/okf.md`가 세 형식 문자열을 담는지 단언하는 케이스를 `test/graph-search.test.js`에 추가하도록 했다. affected_paths는 그대로다.
- CR-004 (minor, resolved) — source 그래프가 없으면 `graphSuggest`가 조기 반환하므로 컨텍스트 라벨 픽스처만으로는 단언이 성립하지 않았다. 검증 방식을 이미 export된 `tokenize()` 직접 호출로 바꿔 픽스처 자체를 제거했다.
- CR-005 (minor, resolved) — epic 성공 기준 3이 "문서 어디에도"로 저장소 전체를 주장했으나 보증은 runner 문서 한 곳뿐이었다. 기준을 그 문서로 좁혔다.
- CR-006 (minor, resolved) — epic 성공 기준 2의 "모순 없이"는 판정 불가였다. 세 문서가 같은 필드 이름 목록과 같은 예외를 담는지 문서별로 단언하도록 기준과 Checklist를 구체화했다.
- CR-007 (nit, resolved) — `tokenize`는 이미 `module.exports`에 있다. task 002의 "내부 함수를 새로 export하지 않는다" 서술을 사실에 맞게 고쳤다.
- CR-008 (nit, resolved) — 세 task의 `## Interface` bullet에 frontmatter 정규화 스크립트가 씌운 작은따옴표가 본문까지 남아 있었다. 제거했다.
