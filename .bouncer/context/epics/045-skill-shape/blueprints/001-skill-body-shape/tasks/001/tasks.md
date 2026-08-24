---
type: bouncer.tasks
title: 본문 골격 문서 신설과 워크플로 6개 정렬
description: Tasks for 001
resource: .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T10:16:15.813+09:00'
bouncer:
  id: TASKS-001
  epic_id: '045'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 스킬 본문이 따라야 할 절 이름과 순서를 규정한 문서가 없어 계열 안에서도 골격이 갈려 있음
    - 골격을 규칙 문서 하나로 못박고 워크플로 스킬 여섯 개를 그 골격에 맞춤
  affected_paths:
    - rules/skill-shape.md
    - docs/ARCHITECTURE.md
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-run/SKILL.md
    - test/skill-bouncer-surface.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T10:16:15.813+09:00'
    suggested_paths:
      - rules/skill-shape.md
      - docs/ARCHITECTURE.md
      - skills/bouncer-init/SKILL.md
      - skills/bouncer-plan/SKILL.md
      - skills/bouncer-execute/SKILL.md
      - skills/bouncer-commit/SKILL.md
      - skills/bouncer-finalize/SKILL.md
      - skills/bouncer-run/SKILL.md
      - test/skill-bouncer-surface.test.js
    basis:
      - graph: source
        status: reused
        query: workflow skill ACQ section contract test
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
      - graph: context
        status: reused
        query: 워크플로 스킬 ACQ 절 골격
        result: >-
          graph-sync reported skip-fresh; both graphs returned the same node set naming deleted paths (commands/sdd-plan.md, skills/okf-authoring, skills/sdd-minimality, .superpowers/); results discarded and paths seeded manually
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
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

## Interface
- 제공: `rules/skill-shape.md` 한 파일. 세 계열의 필수 절과 순서, `assets/`(채워 넣어
  출력으로 쓰는 템플릿)와 `references/`(참고 자료)의 구분, `## Steps` 면제 스킬
  `minimality`·`stop-slop`을 이름으로 적는다. 그리고 워크플로 스킬 6개의 `SKILL.md`가
  번호 절차 뒤에 `## ACQ (AskUserQuestion) gates`를 갖는 형태.
- 거부: 스킬 `name`, 파일 경로, frontmatter 필드와 `description` 문구, 셸 블록의
  `BOUNCER_ROOT=` 대입, 번호 절차 단계의 순서와 지시 내용은 바꾸지 않는다. 절차의
  의미가 달라져야 한다고 판단되면 구현하지 말고 `/bouncer-plan`으로 되돌린다.

## Touch
- Create `rules/skill-shape.md` — 세 계열의 본문 골격, 보조 디렉터리 구분, `## Steps` 면제 목록
- Modify `docs/ARCHITECTURE.md` — §4 표 **밖** 산문에 `rules/skill-shape.md` 링크 한 줄
- Modify `skills/bouncer-init/SKILL.md` — `## ACQ (AskUserQuestion) gates` 절 추가
- Modify `skills/bouncer-plan/SKILL.md` — 같은 절 추가
- Modify `skills/bouncer-execute/SKILL.md` — 같은 절 추가
- Modify `skills/bouncer-commit/SKILL.md` — 기존 ACQ 절을 번호 절차 뒤 마지막 위치로 정렬
- Modify `skills/bouncer-finalize/SKILL.md` — 같은 이유로 위치 정렬
- Modify `skills/bouncer-run/SKILL.md` — 위치 정렬, `## 역할 — 오케스트레이션` 영어화
- Modify `test/skill-bouncer-surface.test.js` — 워크플로 6개의 골격 단정 추가

## Do not touch
- `skills/discovery/`, `skills/spec-authoring/`, `skills/implementation/`,
  `skills/verification/`, `skills/review/`, `skills/minimality/`,
  `skills/debugging/`, `skills/stop-slop/`, `skills/graphify-runner/`,
  `skills/explain-diff/`, `skills/migrate-ids/`, `skills/context-review/` —
  TASKS-002가 맡는다.
- `skills/agentic-code-benchmark/` — 에픽 Out of scope.
- `agents/` — TASKS-003이 맡는다. 이 task는 그 계열의 골격을 규칙 문서에 적기만 한다.
- `CLAUDE.md` — 골격은 하드룰이 아니다. 링크를 얹으면 모든 세션이 저술 규칙을 싣는다.
- `rules/governance.md`, `rules/okf.md`, `rules/plugin-root.md` — 기존 규칙 문서는
  이 작업과 무관하다.
- `scripts/`, `hooks/` — 이 blueprint는 문서와 그 문서를 읽는 테스트만 바꾼다.

## Constraints
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

## Checklist
- [ ] `npm test`를 먼저 돌려 기준선이 green인지 확인한다.
- [ ] `rules/skill-shape.md`를 만든다. 다음을 모두 담는다:
      - 워크플로 계열: frontmatter 뒤 빈 줄 없음, `# /<name>`, Plugin root · Master
        rules 블록, 최상위 번호 절차, 마지막 `## ACQ (AskUserQuestion) gates`
      - 서브스킬 계열: frontmatter 뒤 빈 줄, `# Title Case`, 도입 문단,
        `## When this applies` → `## Steps` → (도메인 H2 자유) → `## Guardrails` →
        `## Return`
      - 에이전트 계열: `## Authority` → `## Hard guards` → (도메인 H2 자유) →
        `## Procedure`(절차가 있는 경우) → `## Output contract`(마지막).
        read-only 에이전트만 `## Hard guards (read-only)`로 부기한다
      - `## Steps` 면제: `minimality`(Decision ladder가 절차), `stop-slop`(Core rules가 절차)
      - 보조 디렉터리: `assets/`는 채워 넣어 출력으로 쓰는 템플릿, `references/`는 참고 자료
      - 스킬과 에이전트 본문 H2는 영어
- [ ] `docs/ARCHITECTURE.md` §4 산문에 링크 한 줄을 넣는다. 표 행은 건드리지 않는다.
- [ ] `bouncer-init`·`bouncer-plan`·`bouncer-execute`에 `## ACQ (AskUserQuestion) gates`
      절을 번호 절차 뒤에 만들고, 각 스킬이 어느 단계에서 무엇을 묻는지 적는다.
      묻지 않는 스킬이 있으면 그 사실을 그 절에 적는다.
- [ ] `bouncer-commit`·`bouncer-finalize`·`bouncer-run`의 기존 ACQ 절이 번호 절차 뒤
      마지막 위치인지 확인하고, 아니면 옮긴다.
- [ ] `bouncer-run`의 `## 역할 — 오케스트레이션`을 영어 H2로 바꾼다. 절 안의 문장은
      그대로 옮긴다 — `Recommend-why`, `affected_paths`, `autonomy` 토큰이 걸려 있다.
- [ ] `test/skill-bouncer-surface.test.js`에 워크플로 6개 단정을 추가한다:
      ```js
      test('workflow skills end with an ACQ gates section', () => {
        for (const name of WORKFLOW) {
          const md = readWorkflow(name);
          const heads = [...md.matchAll(/^## .*$/gm)].map((m) => m[0]);
          // 존재만이 아니라 마지막 절인지까지 본다 — 성공 조건 2가 위치를 요구한다.
          assert.strictEqual(heads[heads.length - 1], '## ACQ (AskUserQuestion) gates', name);
        }
      });

      test('workflow skill bodies use English headings', () => {
        for (const name of WORKFLOW) {
          const md = readWorkflow(name);
          const ko = [...md.matchAll(/^#{2,3} .*[가-힣].*$/gm)].map((m) => m[0]);
          assert.deepStrictEqual(ko, [], `${name}: ${ko.join(' | ')}`);
        }
      });
      ```
- [ ] 저장소에 남은 한국어 워크플로 H2가 없는지 확인한다:
      ```
      grep -rnE '^#{2,3} .*[가-힣]' skills/bouncer-*/SKILL.md
      ```
- [ ] `npm test` 통과를 확인한다. 특히 다음 넷이 green이어야 한다:
      ```
      test/master-rules.test.js
      test/cursor-plugin.test.js
      test/skill-bouncer-surface.test.js
      test/public-name-regression.test.js
      ```
