---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/004-skill-body-shape/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T11:51:54.984+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '006'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: 0bef82a3e46b699a59be2d087a47d07c87c9af25
      diff_sha: 2975776ae1339a6c393a94f2152f14345548a05805c0ffa1ee46741b0b078d5e
      quiz_score: 5/5
      disposition: 세 계열 골격 위치·CLAUDE 비링크·Steps 면제·implementer Hard guards·ARCHITECTURE 표 밖 링크를 모두 맞춤
      recorded_at: '2026-08-24T11:57:28+09:00'
---
# Explain

## Background
스킬·에이전트 본문 H2가 계열마다 제각각이었다. 같은 역할이 `Flow`·`Stages`·`Steps`로
갈라지고, 산출을 보고하는 절은 소수에만 있었으며, `bouncer-run`만 한국어 H2를 썼다.
강제 수단은 개별 계약 테스트의 토큰뿐이라 “골격”이라는 문서가 없었다.

이 브랜치는 `rules/skill-shape.md`에 세 계열(워크플로 6 · 서브스킬 12 · 에이전트 4)의
필수 절과 순서를 적고, 22개 문서를 그 순서에 맞춘 뒤 surface/agents 테스트가 골격을
걷도록 했다. `CLAUDE.md`에는 링크하지 않았다 — 저술 규칙은 세션 하드룰이 아니라
플러그인 스킬 저자에게 걸린다. 발견 경로는 `docs/ARCHITECTURE.md` §4 표 밖 산문
한 줄이다.

## Intuition
도서관 서가 라벨을 먼저 붙인 뒤, 이미 꽂혀 있던 책을 그 라벨 순서로만 다시 꽂는다.
책 내용(절차·루브릭 문장)은 옮기지 않는다.

## Code
- `rules/skill-shape.md` — 세 계열 골격 SSOT (`assets/` vs `references/`, Steps 면제
  `minimality`·`stop-slop` 포함)
- `docs/ARCHITECTURE.md` — §4 **표 밖** 산문의 `rules/skill-shape.md` 링크 한 줄
- `skills/bouncer-*/SKILL.md` (6) — 번호 절차 뒤 마지막 H2가
  `## ACQ (AskUserQuestion) gates`; `bouncer-run` Role H2 영어화
- `skills/{discovery,spec-authoring,implementation,verification,review,minimality,debugging,stop-slop,graphify-runner,explain-diff,migrate-ids,context-review}/SKILL.md`
  — `When this applies` → `Steps`(면제 2) → … → `Guardrails` → `Return`
- `agents/bouncer-{implementer,reviewer,debugger,context-reviewer}.md` —
  `Authority` → `Hard guards` → … → `Output contract` 마지막 (implementer 재배치가
  핵심)
- `test/skill-bouncer-surface.test.js`, `test/skill-discovery.test.js`,
  `test/agents.test.js` — 계열별 골격 단정

## Quiz
1. 워크플로 스킬 여섯 개에서 `## ACQ (AskUserQuestion) gates`는 어디에 있어야 하는가?
   - A) frontmatter 직후, 제목 앞
   - B) 번호 절차 뒤 **마지막** H2
   - C) Plugin root 블록 안

2. `rules/skill-shape.md`를 `CLAUDE.md`에 링크하지 않은 이유는?
   - A) 파일이 영어라 하드룰에 못 넣는다
   - B) 세션 런타임 에이전트에게 걸리는 하드룰이 아니라 스킬 저술 규칙이라서
   - C) ARCHITECTURE 표에 이미 행이 있어서

3. 서브스킬 중 `## Steps` 면제인 둘은?
   - A) `minimality`, `stop-slop`
   - B) `discovery`, `review`
   - C) `graphify-runner`, `explain-diff`

4. `agents/bouncer-implementer.md`에 `## Hard guards (read-only)`를 붙이면 안 되는
   이유는?
   - A) Output contract 필드 이름이 바뀐다
   - B) 파일을 쓰는 에이전트인데 읽기 전용으로 읽히기 때문
   - C) test/agents.test.js가 Authority 헤딩을 금지하기 때문

5. ARCHITECTURE §4에서 이 브랜치가 연 것은?
   - A) 표에 skill-shape 행 추가
   - B) 표 **밖** 산문 링크 한 줄
   - C) APPROVED_GENERIC_SKILLS 배열 갱신

## 이해 상태
- quiz_score: 5/5
- 응답: 1B 2B 3A 4B 5B (전부 정답)
- 정답: 1B (ACQ는 번호 절차 뒤 마지막 H2) · 2B (CLAUDE 비링크 — 세션 하드룰이 아님) ·
  3A (Steps 면제 minimality·stop-slop) · 4B (implementer는 쓰기 에이전트) ·
  5B (표 밖 산문 링크만)
- disposition: 세 계열 골격 위치·CLAUDE 비링크·Steps 면제·implementer Hard guards·ARCHITECTURE 표 밖 링크를 모두 맞춤
- range: develop..0bef82a3e46b699a59be2d087a47d07c87c9af25
- diff_sha: 2975776ae1339a6c393a94f2152f14345548a05805c0ffa1ee46741b0b078d5e

## Tasks

### Task 001

#### Goal & intent

본문 골격을 `rules/skill-shape.md`에 적고, 워크플로 스킬 6개를 그 골격에 맞춘다.
규칙 문서는 세 계열(워크플로 · 서브스킬 · 에이전트)을 모두 담는다. 나머지 두 계열의
정렬은 TASKS-002와 TASKS-003이 그 문서를 읽고 수행한다.

골격이 지금 어디에도 없다. `rules/`에는 `governance.md`·`okf.md`·`plugin-root.md`가
있고 `CLAUDE.md`가 그 셋을 링크한다. 골격도 같은 자리에 둔다. 다만 `CLAUDE.md`에는
링크하지 않는다 — 이 규칙은 플러그인에 스킬을 쓰는 사람에게 걸리는 것이지 세션 런타임
에이전트에게 걸리는 것이 아니고, 하드룰에 얹으면 모든 세션 컨텍스트에 저술 규칙이
실린다. 발견 경로는 `docs/ARCHITECTURE.md` §4 산문의 링크 한 줄로 준다.

워크플로 6개에서 실제로 바뀌는 것은 하나다. `bouncer-commit`·`bouncer-finalize`·
`bouncer-run` 셋에만 있는 `## ACQ (AskUserQuestion) gates` 절을 6개 전부에 둔다.
`bouncer-init`·`bouncer-plan`·`bouncer-execute`는 ACQ를 번호 절차 안에 인라인으로
갖고 있으므로, 새 절에는 어느 단계에서 무엇을 묻는지를 모아 적는다. ACQ는 사용자에게
노출되는 계약이라 한 곳에 모여 있어야 읽힌다. 더불어 `bouncer-run`의 한국어 H2
`## 역할 — 오케스트레이션`을 영어로 바꾼다 — 스킬 지시문은 영어가 플러그인 관례다.

#### Interface

- 제공: `rules/skill-shape.md` 한 파일. 세 계열의 필수 절과 순서, `assets/`(채워 넣어
  출력으로 쓰는 템플릿)와 `references/`(참고 자료)의 구분, `## Steps` 면제 스킬
  `minimality`·`stop-slop`을 이름으로 적는다. 그리고 워크플로 스킬 6개의 `SKILL.md`가
  번호 절차 뒤에 `## ACQ (AskUserQuestion) gates`를 갖는 형태.
- 거부: 스킬 `name`, 파일 경로, frontmatter 필드와 `description` 문구, 셸 블록의
  `BOUNCER_ROOT=` 대입, 번호 절차 단계의 순서와 지시 내용은 바꾸지 않는다. 절차의
  의미가 달라져야 한다고 판단되면 구현하지 말고 `/bouncer-plan`으로 되돌린다.

#### Touch

- Create `rules/skill-shape.md` — 세 계열의 본문 골격, 보조 디렉터리 구분, `## Steps` 면제 목록
- Modify `docs/ARCHITECTURE.md` — §4 표 **밖** 산문에 `rules/skill-shape.md` 링크 한 줄
- Modify `skills/bouncer-init/SKILL.md` — `## ACQ (AskUserQuestion) gates` 절 추가
- Modify `skills/bouncer-plan/SKILL.md` — 같은 절 추가
- Modify `skills/bouncer-execute/SKILL.md` — 같은 절 추가
- Modify `skills/bouncer-commit/SKILL.md` — 기존 ACQ 절을 번호 절차 뒤 마지막 위치로 정렬
- Modify `skills/bouncer-finalize/SKILL.md` — 같은 이유로 위치 정렬
- Modify `skills/bouncer-run/SKILL.md` — 위치 정렬, `## 역할 — 오케스트레이션` 영어화
- Modify `test/skill-bouncer-surface.test.js` — 워크플로 6개의 골격 단정 추가

#### Constraints

- 각 스킬 본문에서 「Master rules」 라벨과 `CLAUDE.md` 언급을 지우지 않는다.
  `test/master-rules.test.js`가 워크플로 스킬 전부에서 두 토큰을 찾는다.
- 셸 블록의 `BOUNCER_ROOT=` 대입은 블록마다 그대로 둔다. 블록마다 새 셸이 뜨므로
  중복이 아니라 실행 조건이고, `test/cursor-plugin.test.js`가 이를 강제한다.
- 절을 옮기면서 계약 테스트가 찾는 토큰이 든 문장을 지우지 않는다. 최소한
  `distill --all`, `distill --for`, `current --set`, `scaffold epic`,
  `validate --gate plan`, `Recommend-why`, `단일 파일 폴백` 계열 문자열이 걸려 있다.
- `bouncer-commit`의 새 ACQ 절에 `skills/explain-diff/SKILL.md` 문자열을 넣지 않는다.
  `test/skill-bouncer-surface.test.js`가 그 부재를 단정한다.
- 이 task에서는 워크플로 6개만 단정한다. 서브스킬 12개를 함께 단정하면 아직 정렬되지
  않은 상태라 이 커밋의 `npm test`가 깨진다.
- 스킬 YAML `description`에 따옴표 없는 `##`를 넣지 않는다.
- `rules/skill-shape.md`는 영어로 쓴다 — `rules/` 아래 기존 문서와 스킬 지시문이 영어다.
- 아키텍처 문서에서 여는 것은 §4의 **표 밖 산문 한 줄**뿐이다. 표 행을 건드리면
  `test/public-name-regression.test.js`의 `APPROVED_GENERIC_SKILLS`가 딸려온다.
  표 행을 고쳐야 한다고 판단되면 구현하지 말고 보고한다.

### Task 002

#### Goal & intent

서브스킬 12개를 `rules/skill-shape.md`의 서브스킬 골격에 맞춘다. TASKS-001이 그 문서를
이미 만들어 두었으므로 이 task는 문서를 따르기만 한다.

골격 절은 넷이다 — `## When this applies`, `## Steps`, `## Guardrails`, `## Return`.
도메인 고유 H2는 그대로 둔다. 기존 절 중 역할이 같은 것은 새로 만들지 말고 이름만
바꾼다. `discovery`의 `## Handoff`가 곧 `## Return`이고, `graphify-runner`의
`## Notes`가 곧 `## Guardrails`이며, `spec-authoring`의
`## Ownership boundary (do not cross)`도 `## Guardrails`다. 없는 절만 새로 쓴다.

`minimality`와 `stop-slop`은 `## Steps` 면제다. 두 스킬은 절차 자체가 도메인 절
(`## Decision ladder`, `## Core rules`)로 되어 있고, `minimality`의 것은 계약 테스트가
헤딩째 잡고 있다.

#### Interface

- 제공: 서브스킬 12개의 `SKILL.md`. 각각 `## When this applies` → `## Steps`(면제 2개
  제외) → (도메인 H2 자유) → `## Guardrails` → `## Return` 순서를 갖는 형태.
- 거부: 스킬 `name`, frontmatter 필드와 `description` 문구, 절차 단계의 순서와 지시
  내용, 리뷰어 루브릭 문구, 보조 파일의 경로는 바꾸지 않는다. 절 안의 문장은 이동만
  하고 다시 쓰지 않는다. 어느 스킬이 하는 일이 달라져야 한다고 판단되면 구현하지 말고
  `/bouncer-plan`으로 되돌린다.

#### Touch

- Modify `skills/discovery/SKILL.md` — `## Flow`→`## Steps`, `## Handoff`→`## Return` 후 `## Guardrails` **뒤로 이동**, `## When this applies` 추가
- Modify `skills/spec-authoring/SKILL.md` — `## How to author`→`## Steps` 후 `## Ownership boundary (do not cross)`→`## Guardrails` **앞으로 이동**, `## When this applies` 추가 (`## Return`은 이미 마지막)
- Modify `skills/implementation/SKILL.md` — `## Flow`→`## Steps`, `## When this applies`·`## Return` 추가
- Modify `skills/verification/SKILL.md` — `## When this applies`·`## Return` 추가
- Modify `skills/review/SKILL.md` — `## When this applies`·`## Return` 추가
- Modify `skills/minimality/SKILL.md` — `## When to run`→`## When this applies` 후 상단 이동, `## Conflict handling`→`## Guardrails`, `## Return` 추가 (`## Steps` 면제)
- Modify `skills/debugging/SKILL.md` — `## Stages`→`## Steps`(하위 `###` 유지), `## When this applies`·`## Return` 추가
- Modify `skills/stop-slop/SKILL.md` — `## Scope`→`## When this applies`, `## Guardrails`를 마지막 절 `## Return` **바로 앞에** 추가 (`## Steps` 면제)
- Modify `skills/graphify-runner/SKILL.md` — `## Notes`→`## Guardrails`, `## When this applies`·`## Return` 추가
- Modify `skills/explain-diff/SKILL.md` — `## When this applies`·`## Return` 추가
- Modify `skills/migrate-ids/SKILL.md` — `## Steps`를 `## Guardrails` 앞으로 이동, `## When this applies`·`## Return` 추가
- Modify `skills/context-review/SKILL.md` — `## When this rubric applies`→`## When this applies`, `## Return` 추가
- Modify `test/skill-bouncer-surface.test.js` — `SUB_PATHS`를 12개로 늘리고 서브스킬 골격 단정 추가
- Modify `test/skill-discovery.test.js` — `Handoff` 단정을 `Return`으로 갱신

#### Constraints

- 절 안의 문장은 옮기기만 하고 다시 쓰지 않는다. 계약 테스트가 본문 토큰을 찾는다:
  `distill --all`(discovery), `scope_evidence`(graphify-runner), `## Findings`
  (review·context-review), `## Command`·`## Evidence`(verification),
  `이해 상태`·`Quiz`(explain-diff), `Hard rule 9`·`파싱하지 않아야`·`Prefer thoroughness`
  (implementation — 이 파일에 `하드룰 9`는 없다. 영어 형태로만 있으므로 한국어로
  「복원」하지 않는다).
- `## Decision ladder (in order)` 헤딩을 지우거나 `###`로 강등하지 않는다.
  `test/skill-minimality.test.js:40`의 정규식은 `## Decision ladder`로 시작해 다음
  `\n## `까지를 구간으로 잡는다. 그 lookahead 때문에 이 절 **뒤에 H2가 하나 이상
  더 있어야** 한다 — 마지막 절이 되면 구간을 못 잡고 실패한다. `minimality`는
  `## Return`이 마지막이므로 골격을 따르면 자연히 충족된다.
- `skills/explain-diff/SKILL.md`의 `description`에서 `/bouncer-commit` 문자열을
  유지한다 (`test/skill-explain-diff.test.js:16`).
- `## Return`에 적는 것은 이 스킬이 호출자에게 무엇을 보고하는가다. 게이트 결과나
  검증 성공을 지어내지 않는다.
- 스킬 본문 H2는 영어로 쓴다. 절 안의 한국어 예시와 인용문은 그대로 둔다.
- 새 절을 채울 내용이 없으면 그 스킬이 무엇을 반환하는지 다시 보라. 「없음」으로 채우는
  절이 생기면 구현을 멈추고 보고한다.

### Task 003

#### Goal & intent

`agents/` 문서 4개를 `rules/skill-shape.md`의 에이전트 골격에 맞춘다. TASKS-001이 그
문서를 이미 만들어 두었으므로 이 task는 문서를 따르기만 한다.

네 문서는 이미 절반쯤 같은 형태다 — 넷 다 권한 절로 시작하고 넷 다
`## Output contract`를 갖는다. 어긋난 곳은 `bouncer-implementer`에 몰려 있다. 그
파일의 현재 절 순서는 `## Authority (task brief only)` → `## Scope` →
`## What you must not do` → `## Flow` → `## Output contract` → `## Guardrails` →
`## Verify-failure re-dispatch`다. 골격과 어긋나는 것이 넷이다 — 권한 절에 괄호
부기가 붙어 있고, 도메인 절 `## Scope`가 가드 절보다 위에 있고, 절차 절 이름이
`## Flow`이며, 출력 계약이 마지막이 아니다.

`bouncer-debugger`는 절차 절이 `## Procedure (4 stages)`로 갈렸다. 읽기 전용 셋은
이미 `## Hard guards (read-only)`이고 순서도 맞다.

셋째 것은 이름만 `## Hard guards`로 맞추고 `(read-only)` 부기는 읽기 전용 셋에만
남긴다. `bouncer-implementer`는 파일을 쓰는 에이전트라 같은 부기를 붙이면 구현자가
자기를 읽기 전용으로 읽는다.

#### Interface

- 제공: `agents/` 문서 4개. 각각 `## Authority` → `## Hard guards` → (도메인 H2 자유)
  → `## Procedure`(절차가 있는 경우) → `## Output contract` 순서를 갖고,
  `## Output contract`가 마지막 절인 형태.
- 거부: 에이전트 `name`·`description`·`model`·`readonly` frontmatter, 루브릭 문구,
  심각도 보정 기준, 출력 계약의 항목 이름은 바꾸지 않는다. 절 안의 문장은 이동만 하고
  다시 쓰지 않는다. 어느 에이전트의 권한이나 판정 기준이 달라져야 한다고 판단되면
  구현하지 말고 `/bouncer-plan`으로 되돌린다.

#### Touch

- Modify `agents/bouncer-implementer.md` — `## Authority (task brief only)`→`## Authority`, `## Scope`를 가드 절 **뒤로 이동**, `## What you must not do`→`## Hard guards`, `## Flow`→`## Procedure`, `## Output contract`를 마지막으로 이동
- Modify `agents/bouncer-debugger.md` — `## Procedure (4 stages)`→`## Procedure`
- Modify `agents/bouncer-reviewer.md` — `## Hard guards (read-only)` 유지 확인, 절 순서 정렬
- Modify `agents/bouncer-context-reviewer.md` — 같은 이유로 절 순서 정렬
- Modify `test/agents.test.js` — 에이전트 골격 단정 추가

#### Constraints

- `test/agents.test.js`가 찾는 문자열을 유지한다: `Verify-failure re-dispatch`,
  `Minimum fix proposal`, `Required regression test`, `Needs planning`,
  `Detailed comments`, `하드룰 9` 또는 `Hard rule 9`, `context-review.md`,
  `tasks/<NNN>/tasks.md`.
- `agents/bouncer-implementer.md`에 `known ceilings`와 `Prefer thoroughness`를 넣지
  않는다. `test/agents.test.js:70-71`이 그 부재를 단정한다 — 상세 주석 지침은
  `skills/implementation/SKILL.md`에 살고 에이전트 문서는 포인터만 갖는다.
- `## Hard guards (read-only)`의 `(read-only)` 부기는 `readonly: true`인 셋
  (`bouncer-reviewer`, `bouncer-debugger`, `bouncer-context-reviewer`)에만 붙인다.
- `## Output contract`가 네 문서 모두에서 마지막 H2여야 한다.
- 에이전트 본문 H2는 영어로 쓴다.
- `bouncer-reviewer`·`bouncer-debugger`·`bouncer-context-reviewer` 셋은 이미
  `## Authority` → `## Hard guards (read-only)` 순서다. 확인만 하고 옮기지 않는다.
  실제로 절을 재배치하는 것은 `bouncer-implementer` 하나다.
- 루브릭 본문·심각도 보정 기준은 문장을 고치지 않는다. Distill이 리뷰어 루브릭과
  호출 브리프와 execute 디스패치를 한 커밋 단위로 묶는데, 이 task에서 함께 움직이는
  것은 절 이름과 순서뿐이고 판정 내용이 아니다.
- 절 안의 문장은 옮기기만 하고 다시 쓰지 않는다.
