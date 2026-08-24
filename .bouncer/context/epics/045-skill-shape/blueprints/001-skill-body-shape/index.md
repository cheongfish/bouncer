---
type: bouncer.blueprint
title: 본문 골격 확정과 스킬·에이전트 22개 정렬
description: Blueprint 001
resource: .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-24T10:16:15.813+09:00'
bouncer:
  id: '001'
  epic_id: '045'
  blueprint_id: '001'
  status: closed
  commit_type: refactor
  scale: full
---
# 001 skill-body-shape

Epic: [045](../../index.md)

## Intent
- 문제: 스킬 본문의 절 이름과 순서를 규정한 문서가 없다. 그 결과 같은 역할의 절이
  `Flow`·`Stages`·`Steps`로 갈라지고, 산출 보고 절은 `spec-authoring`과 `stop-slop`
  둘에만 있으며, `bouncer-run`은 한국어 H2를 갖고 있다. 강제는 개별 계약 테스트가
  각자 다른 토큰으로 하고 있어서 골격이라는 것이 존재하지 않는다.
- 완료 조건: 골격이 `rules/skill-shape.md`에 적혀 있고, 워크플로 6개·서브스킬 12개·
  에이전트 4개가 그 골격을 따르며, 계약 테스트가 세 계열을 걷어 단정한다.

## Contract
- 인터페이스: 스킬 `name`, 디렉터리 경로, frontmatter 필드 집합, `description` 문구는
  바뀌지 않는다. 바뀌는 것은 `SKILL.md` 본문 H2의 이름·순서와 새로 추가되는 절이다.
  새 파일은 `rules/skill-shape.md` 하나다. 골격은 세 계열로 나뉜다.

  ```
  워크플로 (bouncer-*, 6개)
    frontmatter → (빈 줄 없이) # /<name>
    **Plugin root.** / **Master rules.**
    1. 2. 3. …            ← 최상위 번호 절차가 유일한 골격
    ## ACQ (AskUserQuestion) gates   ← 마지막, 묻지 않으면 그렇게 적는다

  서브스킬 (12개)
    frontmatter → (빈 줄) → # Title Case
    도입 1~2문단
    ## When this applies
    ## Steps              ← minimality·stop-slop 면제
    (도메인 고유 H2 자유)
    ## Guardrails
    ## Return             ← 마지막

  에이전트 (agents/, 4개)
    frontmatter (name·description·model[·readonly]) → # Bouncer <role>
    ## Authority
    ## Hard guards        ← read-only 에이전트는 (read-only) 부기
    (도메인 고유 H2 자유 — Rubric, Scope, Calibration 등)
    ## Procedure          ← 절차가 있는 에이전트만
    ## Output contract    ← 마지막
  ```
- 데이터·상태: 게이트 코드, 문서 스키마, `config.json` 형태, `scripts/`는 바뀌지 않는다.
  이 blueprint는 문서와 그 문서를 읽는 테스트만 바꾼다.
- 수용 기준: epic 성공 조건 1–5와 7. `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 스킬 계약 테스트는 본문의 **토큰**을 찾는다(`distill --all`, `current --set`,
    `Recommend-why`, 「Master rules」 등). 절을 옮기다 토큰이 든 문장을 함께 지우면
    실패한다. 절 이름만 바꾸고 문장은 옮긴다.
  - `test/skill-minimality.test.js:40`이 `## Decision ladder`를 정규식으로 잡고 그
    다음 `\n## `까지를 구간으로 쓴다. 이 헤딩을 지우거나 `###`로 강등하면 깨진다 —
    `minimality`가 `## Steps` 면제인 이유가 이것이다.
  - `test/skill-discovery.test.js:35`가 `Handoff`를 찾는다. `## Handoff`를
    `## Return`으로 바꾸면 그 단정도 함께 갱신해야 한다.
  - `test/skill-bouncer-surface.test.js`의 `SUB_PATHS`는 10개다. `context-review`와
    `migrate-ids`가 빠져 있어, 12개를 걷는 단정을 붙이려면 목록부터 늘려야 한다.
  - 두 task가 같은 테스트 파일을 늘린다. task 001에서 18개 전부를 단정하면 서브스킬
    12개가 아직 정렬되기 전이라 그 커밋의 `npm test`가 깨진다.
  - 새 절을 「없음」 한 줄로 채울 때 그 문장이 다른 테스트의 `doesNotMatch`에 걸릴 수
    있다. `bouncer-commit`은 `skills/explain-diff/SKILL.md` 언급이 금지되어 있고,
    `agents/bouncer-implementer.md`는 `known ceilings`와 `Prefer thoroughness`가
    금지되어 있다(`test/agents.test.js:70-71`).
  - `agents/bouncer-implementer.md`만 read-only가 아니라 `## Hard guards (read-only)`
    대신 `## What you must not do`를 갖는다. 네 문서에 같은 부기를 붙이면 구현자가
    읽기 전용이라고 잘못 읽는다.

## Out of scope
- `agentic-code-benchmark` 정렬 — 에픽 Out of scope를 그대로 이어받는다.
- `assets/`·`references/`·`NOTICE.md`의 배치 변경. 이 blueprint는 그 배치를 규칙
  문서에 옮겨 적을 뿐, 파일을 옮기지 않는다.
- `docs/ARCHITECTURE.md` §4 표. 표 밖 산문에 규칙 문서 링크 한 줄만 넣는다.
- `skills/implementation/SKILL.md`의 주석 지침 — BP-002가 맡는다. 이 blueprint는
  그 파일의 절 이름만 만진다.
- 스킬 절차의 지시 내용 변경.

## One-commit justification
task를 셋으로 나눈 근거는 실패 축이 다르기 때문이다. 워크플로 6개는
`test/master-rules.test.js`와 각 워크플로 계약 테스트가 걸리고, 서브스킬 12개는
`skill-minimality`·`skill-discovery`·`skill-review` 같은 개별 계약 테스트가 걸리며,
에이전트 4개는 `test/agents.test.js` 하나가 걸린다. 또 공유 테스트 파일을 단계마다
늘려야 각 커밋 시점에서 `npm test`가 green으로 남는다 — 한 커밋으로 묶으면 어느 축이
깨졌는지 리뷰에서 분리되지 않는다. 리뷰와 PR 단위는 이 blueprint다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 골격 문서 신설과 워크플로 6개 정렬
* [Tasks 002](tasks/002/tasks.md) - 서브스킬 12개 정렬
* [Tasks 003](tasks/003/tasks.md) - 에이전트 4개 정렬
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
