---
type: bouncer.tasks
title: 002 tasks
description: Tasks for 002
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/003-commands-to-skills/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-07-28T01:53:11.404Z'
bouncer:
  id: TASKS-001
  epic_id: '001'
  blueprint_id: '003'
  status: verified
  affected_paths:
    - skills
    - commands
    - test
    - README.md
    - GOVERNANCE-ARCHITECTURE-DECISIONS.md
  graph:
    generated_at: '2026-07-28T11:01:55+09:00'
    command: graphify query
    suggested_paths:
      - test
    basis: 'query: "command markdown surface skills SKILL.md workflow entry point plan execute finalize init tests" — BFS depth=2, 120 nodes. Only `test` survived rollup as an actionable suggestion; the dominant hits were scripts/lib (validate.js, cli.js, finalize.js, scaffold.js) and are deliberately excluded — this blueprint moves a markdown surface and must not touch gate logic. Two coverage caveats, both material: (1) config.source_dirs is scripts/hooks/test, so `commands/` and `skills/` — the actual subject of this change — are outside the indexed set entirely and were added to affected_paths by hand; (2) the graph snapshot is stale (dated 2026-07-23, still returns deleted nodes such as import-superpowers.js and cli-import.test.js) because config.graphify.enabled is false, so no SessionStart rebuild runs. README.md and GOVERNANCE-ARCHITECTURE-DECISIONS.md were also added by hand from a reference scan.'
---
# Tasks

Blueprint: [003](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게. -->
지금 Bouncer의 워크플로 진입점은 `commands/bouncer-{init,plan,execute,finalize}.md`
네 개다. `commands/`는 Claude Code·Cursor의 표면이고 Codex는 이 디렉터리를 워크플로
진입점으로 읽지 않는다. 세 에이전트가 공통으로 읽는 표면은 `skills/*/SKILL.md`뿐이다.

완료 후에는 `commands/`가 없고, 같은 네 워크플로가
`skills/bouncer-{init,plan,execute,finalize}/SKILL.md`로 존재한다. 슬래시 이름은
그대로라 Claude Code 사용자에게는 `/bouncer-plan` UX가 동일하다.

이관하면서 반드시 같이 해결해야 할 것이 두 가지 있다. 커맨드는 사용자가 부를 때만
실행되지만 **스킬은 모델이 `description`을 보고 자동 선택**하므로,

1. `description`에 명시 호출 조건이 없으면 `/bouncer-plan` 없이 execute로 진입하는
   순서 위반이 가능해진다. 게이트 기반 거버넌스에서는 이게 회귀다.
2. 하위 스킬을 이름으로만 가리키면(`` `discovery` 스킬 ``) Skill 호출 도구가 있는
   에이전트에만 통한다. 파일 경로를 병기해 폴백 경로를 남겨야 한다.

단, 최종 강제력은 문구가 아니라 `.bouncer/current` 상태 파일에서 나온다. 순서 가드는
"모델이 잘 판단하기를 기대"가 아니라 각 스킬 첫 단계의 상태 확인으로 성립한다.

판정 로직(`scripts/lib/`)과 훅 배선은 이미 에이전트 중립이므로 손대지 않는다.
`.claude-plugin/plugin.json`은 `commands`/`skills`를 선언하지 않고 관례 탐색에
의존하므로 매니페스트 변경도 없다.

## Interface

**신규 워크플로 스킬 4개**

- `skills/bouncer-init/SKILL.md`, `skills/bouncer-plan/SKILL.md`,
  `skills/bouncer-execute/SKILL.md`, `skills/bouncer-finalize/SKILL.md`.
- frontmatter: `name`은 디렉터리명과 동일(`bouncer-plan` 등), `description`은 대응
  커맨드의 설명을 승계하되 **명시 호출 조건**을 앞에 둔다. 예:
  `"Use only when the user explicitly asks to plan a Bouncer blueprint. Author an
  epic/blueprint/tasks, ..."`.
- 본문: 대응 `commands/*.md`의 절차를 **의미 변경 없이** 승계한다. 단계 번호, 실행
  명령, 게이트 코드(G1–G14), `.bouncer/current` 취급, 승인 요구를 그대로 유지한다.
- `commands/bouncer-plan.md`의 `argument-hint: [epic or blueprint description]`은
  스킬 frontmatter에 대응 필드가 없다. 본문 1단계에 "호출 시 사용자가 준 설명이
  있으면 그것을 요청으로 삼고, 없으면 물어본다"로 흡수한다.

**하위 스킬 참조 표기 (워크플로 스킬 본문에 적용)**

- 이름과 파일 경로를 함께 적는다: ``discovery` 스킬 (`skills/discovery/SKILL.md`)`.
  Skill 호출 도구가 없는 에이전트는 경로를 읽어 폴백한다.
- 하위 스킬의 `name`은 이 blueprint에서 바꾸지 않는다(접두어 리네임은 후속 건).

**진입 가드 (계약으로 명문화)**

- `bouncer-execute`, `bouncer-finalize`: 첫 단계에서 `.bouncer/current`를 읽고 `null`
  이면 중단하고 `/bouncer-plan`을 안내한다. 기존 `commands/bouncer-execute.md`
  1단계가 이미 하는 일이며, `bouncer-finalize`에도 같은 수준으로 명시한다.
- `bouncer-plan`: `.bouncer/`가 없으면 중단하고 `/bouncer-init`을 안내한다.

**하위 스킬 description 한정 (본문 불변)**

- `skills/{discovery,spec-authoring,implementation,verification,review,minimality,
  debugging,graphify-runner}/SKILL.md`의 `description`에 Bouncer 컨텍스트 조건을
  한 구절 추가한다 (예: "... while working inside an active Bouncer blueprint").
  `review`, `implementation`, `discovery` 같은 일반 명사 스킬이 Bouncer 밖 작업에서
  자동 발동하는 것을 막는다. `name`과 본문은 건드리지 않는다.

**테스트 표면**

- `test/command-bouncer-{init,plan,execute,finalize}.test.js` →
  `test/skill-bouncer-{init,plan,execute,finalize}.test.js`.
  읽는 대상이 `commands/<name>.md`에서 `skills/<name>/SKILL.md`로 바뀌고,
  `test/helpers/read-skill.js`의 `readSkill(name)`을 재사용한다.
  `GENERIC_SKILLS` 배열에는 **워크플로 스킬을 넣지 않는다** — 그 배열은 거버넌스 §4가
  승인한 일반 스킬 7개의 목록이고 `public-name-regression`이 대조한다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     경로는 백틱으로 감쌉니다. -->
- `skills` — 워크플로 스킬 4개 디렉터리 신설(이관 본문), 기존 8개 스킬의
  `description`에 오발동 방지 조건 추가.
- `commands` — 디렉터리 삭제. 이관의 본체이며, 삭제가 같은 커밋에 들어가야 두 표면이
  갈라지지 않는다. 커밋 가드가 삭제도 범위 검사 대상으로 보므로 경로를 명시한다.
- `test` — 커맨드 문서 테스트 4개를 스킬 문서 테스트로 이관하고, 새 계약(명시 호출
  조건, 하위 스킬 경로 병기, 진입 가드)에 대한 어서션을 추가한다.
- `README.md` — 워크플로 표면을 "명령"에서 "스킬"로 갱신한다. 슬래시 이름은 바뀌지
  않으므로 `/bouncer-*` 표기는 그대로 두고, 표면을 설명하는 문장만 고친다.
- `GOVERNANCE-ARCHITECTURE-DECISIONS.md` — §G의 "명령 문서 테스트"가 가리키는 대상이
  스킬 문서 테스트로 바뀌므로 그 문장만 갱신한다. §4 일반 스킬 표는 건드리지 않는다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts` — 게이트 판정과 커밋 가드. 이미 에이전트 중립이고 이 변경은 마크다운 표면
  이동일 뿐이다. 여기를 고쳐야 할 것 같으면 설계가 틀린 것이니 멈추고 보고할 것.
- `hooks` — 훅 배선과 이벤트명. 플러그인 배선 테스트가 이 구조를 그대로 검사한다.
- `.claude-plugin` — Claude Code 설치 경로. 관례 탐색에 의존하므로 표면 이동으로
  바뀔 것이 없다. Claude Code 회귀 방지를 위해 그대로 둔다.
- `.bouncer/config.json`, `.bouncer/governance.md`, `.bouncer/workflow.md`,
  `.bouncer/okf.md`, `.bouncer/templates` — 프로젝트 거버넌스 문서이며 blueprint가
  커밋할 수 있는 범위 밖이다. `workflow.md`는 슬래시 이름만 나열하므로 갱신도 불필요.
- `CHANGELOG.md`, `IMPLEMENTATION-STATUS.md`, `DISTRIBUTION-READINESS.md`,
  `docs/` — 시점 기록물이다. 과거 서술을 소급 수정하지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다. -->
- [x] **선행 확인.** 001이 먼저 반영되어 있는지 확인한다. 반영되어 있으면
      `commands/*.md`의 플러그인 루트 토큰은 이미 에이전트 중립 표현이므로 **그대로**
      옮긴다. 아직이면 현재 토큰을 그대로 옮기고, 치환은 001 소관으로 남긴다.
      어느 쪽이든 이 blueprint에서 토큰 표현을 새로 발명하지 않는다.
- [x] `skills/bouncer-{init,plan,execute,finalize}/SKILL.md`를 만들고 대응
      `commands/*.md` 본문을 의미 변경 없이 옮긴다. 단계 번호·실행 명령·게이트 코드·
      승인 요구를 보존한다. `bouncer-plan`은 `argument-hint`를 본문 1단계로 흡수한다.
- [x] 네 스킬의 `description`에 명시 호출 조건을 넣고, `name`을 디렉터리명과 맞춘다.
- [x] 워크플로 스킬 본문의 하위 스킬 참조를 이름 + 파일 경로 병기로 바꾼다
      (`skills/<name>/SKILL.md`).
- [x] 진입 가드를 명문화한다: `bouncer-execute`·`bouncer-finalize`는 `.bouncer/current`
      가 `null`이면 중단하고 `/bouncer-plan` 안내, `bouncer-plan`은 `.bouncer/` 부재 시
      중단하고 `/bouncer-init` 안내.
- [x] 기존 하위 스킬 8개의 `description`에 Bouncer 컨텍스트 조건을 추가한다.
      `name`과 본문은 건드리지 않는다.
- [x] `commands/` 디렉터리를 삭제한다 (`git rm`).
- [x] `test/command-bouncer-*.test.js` 4개를 `test/skill-bouncer-*.test.js`로 옮기고
      `skills/<name>/SKILL.md`를 읽도록 고친다. 기존 어서션(scaffold/validate 명령,
      게이트 코드, `.bouncer/current`, 승인, 레거시 명칭 부재)은 모두 유지한다.
- [x] 테스트에 새 계약 검증을 추가한다: (1) 네 스킬의 `name`이 디렉터리명과 일치하고
      `description`에 명시 호출 조건이 있다, (2) 워크플로 스킬 본문에 하위 스킬의
      `skills/<name>/SKILL.md` 경로가 병기되어 있다, (3) `bouncer-execute`·
      `bouncer-finalize` 본문에 `.bouncer/current` 부재 시 중단 지시가 있다,
      (4) 저장소에 `commands/` 디렉터리가 존재하지 않는다.
- [x] `test/helpers/read-skill.js`의 `GENERIC_SKILLS`에 워크플로 스킬을 추가하지
      않았는지 확인한다. 추가하면 `public-name-regression`의 §4 표 대조가 깨진다.
- [x] `README.md`의 워크플로 표면 설명을 명령에서 스킬로 갱신한다. `/bouncer-*` 슬래시
      표기와 게이트 표는 그대로 둔다.
- [x] `GOVERNANCE-ARCHITECTURE-DECISIONS.md` §G의 "명령 문서 테스트" 문장을 스킬 문서
      테스트로 갱신한다. §4 일반 스킬 표는 손대지 않는다.
- [x] `npm test` 전체 통과. 특히 `test/public-name-regression.test.js`,
      `test/plugin-wiring.test.js`, `test/distribution.test.js`가 그대로 통과하는지
      확인한다 (Claude Code 회귀).
