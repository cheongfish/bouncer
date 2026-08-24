---
type: bouncer.context_review
title: 002 context review
description: Context review for 002
resource: .bouncer/context/epics/045-skill-shape/blueprints/002-implementation-doc-comments/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-24T10:18:28.110+09:00'
bouncer:
  id: CTXREVIEW-002
  epic_id: '045'
  blueprint_id: '002'
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
        severity: major
        status: resolved
      - id: CR-005
        severity: minor
        status: accepted
        note: >-
          producer와 suggested_paths는 scaffold가 소유하는 하네스 필드다. 수동 시딩
          사실은 basis 두 엔트리가 그대로 적고 있고, G4는 basis를 근거로 판정한다.
          필드 의미를 바꾸는 것은 이 blueprint가 아니라 scope_evidence 스키마의 일이다.
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: minor
        status: resolved
      - id: CR-008
        severity: nit
        status: accepted
        note: >-
          두 언어 예시 요구는 에픽 성공 조건 6(언어 무관 한국어 docstring)의 구현
          수단이지 별도 조건이 아니다. 근거는 blueprint 실패 모드에 있고, task
          Constraints에도 「표기는 각 언어의 관용을 따른다」로 다시 적었다.
---
# Context review

## Findings

- **CR-001** · major · `resolved` — blueprint 수용 기준이 에픽 성공 조건 5·6을
  가리켰다. 5는 한국어 H2 조건으로 BP-001이 이미 자기 수용 기준으로 주장하고 이
  blueprint의 Out of scope가 부인하는 항목이다. 실제로 만족시키는 것은 6과 7이며,
  6은 어느 blueprint도 수용 기준으로 걸지 않은 상태였다. `6과 7`로 고쳤다.
- **CR-002** · major · `resolved` — 보존 문자열 목록이 망라인 것처럼 적혀 있었지만
  `test/skill-implementation.test.js`의 `why` / `invariant|trade-off|ceiling` /
  `thorough|Prefer thoroughness` / Bad·Good 굵은 표기가 빠져 있었다. 그중 셋은
  현재 파일에서 한 문장이 혼자 떠받치고 있어, 단계를 두 갈래로 나누는 이 작업에서
  그 문장이 지워지면 예고 없이 깨진다. 목록을 채우고 비망라임을 명시했다.
- **CR-003** · major · `resolved` — BP-001과의 순서 의존이 blueprint 산문에만
  있었고 execute가 받는 task 브리프에는 없었다. 충돌 구역이 구체적이다 — 이
  blueprint가 다시 쓰는 「Detailed comments」는 BP-001 TASKS-002가 `## Flow`에서
  `## Steps`로 바꾸는 절 안에 있다. 브리프 Goal 뒤에 선행 조건과 중단 지시를 넣고,
  blueprint 실패 모드를 구체화하고, 에픽 Blueprints 줄에도 순서를 적었다.
- **CR-004** · major · `resolved` — 규정 예시로 제시한 JSDoc이 JSDoc이 아니었다.
  `@param repoRoot (string) …`는 Python 관용을 그대로 옮긴 것이고 JSDoc은
  `@param {string} repoRoot - …`다. 제안된 단정 `/@param/`이 잘못된 형태도
  통과시키므로 잡히지도 않았다. 예시를 고치고 단정을
  `/@param \{[^}]+\} \w+/`로 좁혔으며, 표기법은 언어 관용을 따른다는 문장을 넣었다.
- **CR-005** · minor · `accepted` — 위 note 참조.
- **CR-006** · minor · `resolved` — 누락 탐색 패턴이 외부 저장소 이름을 그대로
  담고 있었다. 그 이름을 문서에서 몰아내려는 제약 바로 아래에서 그 이름을 쓰는
  모순이고, `/Users/`와 `~/`도 놓쳤다. 일반 절대 경로 패턴으로 바꾸고 이름을 뺐다.
- **CR-007** · minor · `resolved` — 제안한 단정이 파일 전체를 대상으로 해서
  `Args|인자`가 무관한 산문에도 걸렸다. `skill-minimality.test.js`가
  `## Decision ladder` 구간을 자르는 방식대로 「Detailed comments」 단계만
  잘라내어 그 구간에 단정을 걸도록 바꿨다.
- **CR-008** · nit · `accepted` — 위 note 참조.
