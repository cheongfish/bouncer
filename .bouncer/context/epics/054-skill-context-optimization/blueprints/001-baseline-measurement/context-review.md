---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/001-baseline-measurement/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-26T14:53:09.105+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '054'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: F1
        severity: blocker
        status: resolved
      - id: F2
        severity: blocker
        status: resolved
      - id: F3
        severity: major
        status: resolved
      - id: F4
        severity: major
        status: resolved
      - id: F5
        severity: major
        status: resolved
      - id: F6
        severity: major
        status: resolved
      - id: F7
        severity: major
        status: resolved
      - id: F8
        severity: minor
        status: resolved
      - id: F9
        severity: minor
        status: resolved
      - id: F10
        severity: minor
        status: resolved
      - id: F11
        severity: minor
        status: resolved
      - id: F12
        severity: nit
        status: resolved
      - id: F13
        severity: nit
        status: resolved
---
# Context review

## Findings

- **F1** (blocker, resolved) — task 001의 정적 지표 3번 명령이 중복이 아니라 제목 리터럴을 세고 있었다. 실제 출력은 `2 / 1 / 2 / 1`이다: `skills/review/SKILL.md`에는 절차 절이 없고, `agents/bouncer-reviewer.md`·`agents/bouncer-context-reviewer.md`는 `## Procedure`가 아니라 `## Rubric — …`을 쓴다. 제목을 하나 바꾸면 수치가 바뀌므로 절감 판정에 쓸 수 없다. 조치: 명령을 네 역할 쌍의 `wc -w`로 교체하고, task 002에서 「기대값 2」 항목을 없앴다. epic 성공 조건 1과 blueprint 002·005의 수용 기준도 같은 기준으로 다시 썼다.
- **F2** (blocker, resolved) — task 003(실행 지표 baseline)은 사람이 돌린 7런 산출물이 입력인데 그 산출물을 만드는 주체가 계획 어디에도 없었다. 착수 시점에 없으면 에스컬레이션하도록 적어 두었으므로, 그대로 두면 blueprint 001이 G16(모든 task verified)에 걸려 finalize되지 못한다. 조치: 사용자 판단으로 task 003을 blueprint 006 `execution-baseline`으로 분리했다. blueprint 001은 task 001·002로 닫히고, 006은 「착수 전 조건」 절에 산출물 존재를 approve 조건으로 못박았다.
- **F3** (major, resolved) — `docs/benchmark/history.md`에 「회차 행 하나」를 더한다는 지시가 두 기존 표(1–3회차, DeepSWE) 어느 쪽 열 구성에도 맞지 않았고(`arm 구성`·`시간 배수`·`test quality Δ`), blueprint 001의 「새 절과 새 행만 더한다」와도 어긋났다. 조치: blueprint 006이 `## 지시문 비용 회차`라는 새 절과 새 표를 만드는 것으로 계약을 바꿨다. blueprint 005의 최종 회차도 그 절에 행을 더한다.
- **F4** (major, resolved) — task 002의 「측정 대상 커밋」이 정의되지 않은 채 `git rev-parse --short HEAD`(실행 워크트리 HEAD)와 나란히 있었다. 조치: 측정 대상 커밋을 실행 워크트리 `HEAD`로 명시하고, task 001이 `docs/`·`test/`만 만져 모수가 그 사이에 달라지지 않는다는 근거를 붙였다.
- **F5** (major, resolved) — task 003이 `test/benchmark-context-cost.test.js`를 Do not touch에 넣어, 그 task의 산출물을 검증할 수 있는 유일한 테스트가 잠겨 있었다. `npm run ci`는 표가 비어 있어도 통과한다. 조치: 분리된 blueprint 006의 수용 기준에 그 테스트가 실행 표의 데이터 행을 단정하는 항목을 넣었다.
- **F6** (major, resolved) — epic 성공 조건 1은 호출 계약을 네 항목으로 세는데 blueprint 002의 Contract는 여섯 항목이었다. 조치: epic 조건 1을 여섯 항목(a~f)으로 맞추고 판정 절차를 붙였다.
- **F7** (major, resolved) — 시나리오 id 단정이 맨 문자열이면 산문에 우연히 섞인 부분 문자열도 통과한다. 조치: task 001 Interface와 Checklist에서 백틱으로 감싼 형태를 단정하도록 명시했다.
- **F8** (minor, resolved) — task 001이 이 문서를 「유일한 측정 계약」이라 불렀지만 다섯 정적 지표는 epic 성공 조건 2·3·4와 개별 180자 상한을 재지 않는다. 조치: 「유일한」을 빼고 지표가 조건 1·5·6의 흔적만 재며 나머지는 리뷰가 읽고 본다고 적었다.
- **F9** (minor, resolved) — arm 이름 제약이 실제 스캔보다 넓었다. `test/public-name-regression.test.js`는 `SUPERPOWERS_RE`로 `superpowers` 리터럴 하나만 잡고 `vanilla`·`bouncer`는 무관하다. 조치: 제약을 그 리터럴 하나로 좁히고 나머지는 제약이 없다고 적었다.
- **F10** (minor, resolved) — `.benchmarks/<label>.metrics.json`은 `.gitignore` 대상이라 표의 실행 수치가 저장소에서 재계산되지 않는다. 조치: task 001에 그 값이 전사임을 명시하고 산출물 경로와 측정일을 함께 남기도록 했고, blueprint 006의 실패 모드에도 같은 내용을 넣었다.
- **F11** (minor, resolved) — epic 성공 조건 1과 3이 「직결」·「같은 문장」 같은 판단어에 기대 판정 절차가 없었다. 조치: 두 조건 모두에 무엇을 열거하고 무엇을 확인하는지의 절차를 붙였다.
- **F12** (nit, resolved) — epic Intent의 description 합계가 6,082자였으나 계약 명령의 실제 출력은 6,090자다. 조치: epic과 blueprint 005의 수치를 6,090자로 고쳤다.
- **F13** (nit, resolved) — task 001 Interface는 「id, 조건, 진입 스킬」, Checklist는 「id, 실행 조건 한 줄, 진입 스킬」로 열 이름이 달랐다. 조치: Interface를 「실행 조건」으로 맞췄다.

리뷰어가 통과로 확인한 항목: 각 task의 Goal이 Touch 집합 안에 있고, `affected_paths`의 모든 항목이 Touch에서 동사로 정당화되며, Do not touch가 `affected_paths`와 겹치지 않고, epic에서 blueprint 002~005 링크가 모두 해석되며, `scope_evidence`가 `config.source_dirs`(`scripts`/`hooks`/`test`) 때문에 `docs/`가 제안될 수 없는 이유를 설명한다.
