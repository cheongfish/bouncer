---
type: bouncer.epic
title: 045 스킬 문서 규칙 정비
description: 스킬 본문 골격과 구현 주석 지침을 문서로 못박는다
resource: .bouncer/context/epics/045-skill-shape/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-24T10:16:15.761+09:00'
bouncer:
  id: '045'
  epic_id: '045'
  status: approved
---
# 045 스킬 문서 규칙 정비

## Intent
- 문제: 스킬 문서가 따라야 할 형태가 어느 문서에도 적혀 있지 않다. 본문 절 이름은
  스킬마다 갈라져 있고(같은 역할이 `Flow`·`Stages`·`Steps`), 산출을 보고하는 절은
  19개 중 2개에만 있다. 029/001은 anatomy를 frontmatter 어조와 보조 파일 배치
  수준에서만 정렬했고 본문 H2의 이름과 순서는 규정하지 않았다. 규칙이 계약 테스트에만
  암묵적으로 살아 있어서, 나중에 들어온 `bouncer-run`과 `context-review`는 정렬
  대상이었던 적이 없다.
- 목표: 플러그인 문서가 지켜야 할 두 가지를 규칙 문서로 올린다 — 스킬과 에이전트의
  본문 골격, 그리고 구현 산출물의 주석·docstring 형태. 둘 다 계약 테스트가 강제한다.

## Success criteria
1. `rules/skill-shape.md`가 워크플로·서브스킬·에이전트 세 계열의 필수 절과 그 순서,
   `assets/`와 `references/`의 구분, `## Steps` 면제 스킬 두 개를 이름으로 적는다.
2. 워크플로 스킬 6개 전부가 번호 절차 뒤에 `## ACQ (AskUserQuestion) gates` 절을
   갖는다. 사용자에게 묻지 않는 스킬은 그 사실을 그 절에 적는다.
3. 서브스킬 12개 전부가 `## When this applies` → (도메인 절) → `## Guardrails` →
   `## Return` 순서를 갖고, `minimality`와 `stop-slop`을 뺀 10개가 `## Steps`를 갖는다.
4. `agents/` 문서 4개가 `## Authority` → `## Hard guards` → (도메인 절) →
   `## Procedure`(절차가 있는 경우) → `## Output contract` 순서를 갖고,
   `## Output contract`가 마지막 절이다.
5. 워크플로 6개·서브스킬 12개·에이전트 4개의 본문에 한국어 H2와 H3가 남지 않는다.
6. `skills/implementation/SKILL.md`가 함수·메서드 단위 docstring을 요구하고, 그
   docstring이 구현 언어와 무관하게 한국어이며 인자와 반환값을 각각 항목으로 적어야
   한다고 규정한다.
7. `npm test`가 통과하고, 위 1–6을 계약 테스트가 단정한다.

## Out of scope
- `agentic-code-benchmark` 정렬 — 워크플로 밖 개발자 도구이고 `docs/ARCHITECTURE.md`
  §4 표 밖에 있다. 계열이 다르므로 이 에픽에서 함께 판정하지 않는다.
- `assets/`와 `references/`의 재배치 — 029/001이 정한 배치이고, Distill이
  `skills/review/assets/reviewer-prompt.md`를 못박고 있다. 이 에픽은 그 배치를
  글로 옮겨 적을 뿐 바꾸지 않는다.
- `NOTICE.md`와 `LICENSE`의 통일 — 라이선스 종류가 달라서 갈린 것이지 편차가 아니다.
  Apache-2.0 반입물은 `NOTICE.md`, LICENSE 사본이 있는 MIT 반입물은 `LICENSE`다.
- `docs/ARCHITECTURE.md` §4 표 — 책임 표지 형태 표가 아니다. 표를 건드리면
  `test/public-name-regression.test.js`의 `APPROVED_GENERIC_SKILLS`가 딸려온다.
- 스킬 절차의 지시 내용 변경. 절 이름과 순서만 바꾼다. 어떤 스킬이 하는 일 자체가
  달라져야 한다면 그것은 그 스킬의 blueprint가 할 일이다.
- 기존 코드에 소급해 docstring을 다는 일 — 지침은 앞으로의 구현에 걸린다.

## Blueprints
* [001 skill-body-shape](blueprints/001-skill-body-shape/index.md) - 본문 골격을 `rules/skill-shape.md`로 못박고 워크플로 6개·서브스킬 12개·에이전트 4개를 그 골격에 맞춘다 (`rules/`, `skills/`, `agents/`, `docs/ARCHITECTURE.md`, `test/`)
* [002 implementation-doc-comments](blueprints/002-implementation-doc-comments/index.md) - `skills/implementation`에 한국어 docstring 계약(요약·Args·Returns)과 단계 주석 지침을 넣어 구현 산출물의 주석 밀도를 규정한다 — 같은 파일의 절 이름을 바꾸는 001 뒤에 실행한다 (`skills/implementation/SKILL.md`, `test/skill-implementation.test.js`)
