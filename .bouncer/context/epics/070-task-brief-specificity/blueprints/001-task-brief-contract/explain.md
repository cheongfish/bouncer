---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/070-task-brief-specificity/blueprints/001-task-brief-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-12T21:59:25.395+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '070'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: a28673ef75504c1aba6347c2f3f5c4cabd356c8b
      diff_sha: 7b286b8fea47f1a360b0dc3e52b2cd3462f8d4ad869eb02c215b6d3206ba5dd3
      quiz_score: 3/3
      disposition: all three correct; proceed to remainder
      recorded_at: '2026-09-12T22:03:42+09:00'
  task_commits:
    - id: '001'
      sha: b106afd5
    - id: '002'
      sha: cef0830a
  coordinator:
    base: 49bbfc16a2dc375cb0f9c000b93a57791fc818bb
    integration_head: a28673ef75504c1aba6347c2f3f5c4cabd356c8b
    integration_branch: feat/070-001-task-brief-contract
    revision: null
    worktrees:
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/070/001/integration
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/070/001/workers/001
      - /home/cheongwoon/workspace/chunjae/etc/bouncer/.worktrees/070/001/workers/002
    tasks:
      - id: '001'
        status: integrated
        sha: b106afd5b9c3d8af6601fce4d3cabe6be7ae3de8
        branch: bouncer/070-001-001
        scope_revision: null
        paths: []
        actual_paths:
          - scripts/lib/templates.js
          - scripts/lib/validate-gates.js
          - scripts/lib/validate-sections.js
          - scripts/src/lib/templates.ts
          - scripts/src/lib/validate-gates.ts
          - scripts/src/lib/validate-sections.ts
          - test/scaffold.test.js
          - test/validate-gates.test.js
      - id: '002'
        status: integrated
        sha: cef0830aa85a1a0af2296803ed4521f51743393c
        branch: bouncer/070-001-002
        scope_revision: null
        paths: []
        actual_paths:
          - .codex/agents/bouncer-implementer.toml
          - agents/bouncer-implementer.md
          - references/implementation/index.md
          - references/spec-authoring/index.md
          - references/spec-authoring/tasks.md
          - skills/bouncer-execute/SKILL.md
          - skills/bouncer-execute/references/agent-dispatch.md
          - skills/bouncer-plan/SKILL.md
          - test/agents.test.js
          - test/skill-bouncer-execute.test.js
          - test/skill-spec-authoring.test.js
    decisions:
      - task: '001'
        decision: 'accepted task 001 implementer result: Current/Target behavior sections + Touch symbol table; SECTION_DEFS keys; G10 optional placeholder scan; emit+tests. Paths: scripts/src/lib/templates.ts, validate-sections.ts, validate-gates.ts, scripts/lib/{templates,validate-sections,validate-gates}.js, test/validate-gates.test.js, test/scaffold.test.js. Controller stripped active review.md scaffold so lint:context-comments could pass (outside affected_paths).'
      - task: '002'
        decision: 'accepted task 002: authoring guidance + implementer eight-section dispatch; fixed SS-001 omit wording and MM-001 Touch cite; advisories CT-001/CT-002/MM-002 accepted. Paths: references/spec-authoring/{index,tasks}.md, skills/bouncer-plan/SKILL.md, agents/bouncer-implementer.md, .codex/agents/bouncer-implementer.toml, skills/bouncer-execute/{SKILL.md,references/agent-dispatch.md}, references/implementation/index.md, test/{skill-spec-authoring,agents,skill-bouncer-execute}.test.js'
---
# Explain

## Background
full task 브리프가 Goal·Interface·Touch만으로는 구현자가 현재 동작과 목표 동작을 추론해야 했다. 이 드라이브는 full 템플릿에 `Current behavior`·`Target behavior` 절과 심볼 단위 Touch 표를 넣고, G10이 선택 절의 TODO 자리표시를 거부하게 했으며, 작성 지침과 구현자 dispatch가 여덟 절을 같은 순서로 전달하게 맞춰 추론 공백을 줄인다.

## Intuition
브리프가 “지금 무엇이 도는지 / 끝나면 무엇이 달라지는지 / 어느 심볼을 만지는지”를 표로 고정하면, 게이트와 구현자가 같은 입력을 본다.

## Code
- `scripts/src/lib/templates.ts` — full `tasks.md` 템플릿에 두 동작 절과 Touch 표 자리표시
- `scripts/src/lib/validate-sections.ts` — `SECTION_DEFS`에 `currentBehavior`·`targetBehavior`
- `scripts/src/lib/validate-gates.ts` — plan G10이 존재할 때만 두 절의 TODO를 검사
- `references/spec-authoring/{index,tasks}.md` — 여덟 절 작성 규칙과 예시
- `agents/bouncer-implementer.md` + `.codex/agents/bouncer-implementer.toml` — Authority 여덟 절
- `skills/bouncer-execute/references/agent-dispatch.md` — named·coordinator·fallback payload

드라이브 기록: 워커 `bouncer/070-001-001` (`b106afd5…`) → 통합, 이어서 `bouncer/070-001-002` (`cef0830a…`) → 통합. 통합 HEAD `a28673ef…`.

## Quiz
1. plan gate G10이 `Current behavior`·`Target behavior`를 다루는 방식은?
   - A) 두 절을 필수 `sectionKeys`에 넣어 없으면 실패한다
   - B) 절이 있을 때만 TODO 자리표시를 검사하고, 없으면 기존과 같이 통과한다
   - C) Constraints와 함께 항상 placeholder를 검사한다

2. Touch 표에서 심볼 이름을 확정할 근거가 없을 때 작성 지침이 요구하는 처리는?
   - A) 구현자에게 심볼 이름을 맡긴다
   - B) `신규 추출 지점`과 책임을 적고, 완료 조건은 이름에 의존하지 않게 한다
   - C) Touch 행을 생략하고 Constraints에만 적는다

3. 구현자 Authority·dispatch가 여덟 절을 나열할 때, 브리프에 두 동작 절이 없으면?
   - A) reviewer Authority에도 여덟 절을 강제한다
   - B) light 템플릿에 두 절을 추가한다
   - C) 있는 절만 전달하고 없는 동작 절은 생략한다

## 이해 상태
- 정답: 1B, 2B, 3C
- 응답: 1B, 2B, 3C
- 채점: 3/3 전부 정답
- disposition: all three correct; proceed to remainder
- recorded_at: 2026-09-12T22:03:42+09:00
- range: develop..a28673ef75504c1aba6347c2f3f5c4cabd356c8b
- diff_sha: 7b286b8fea47f1a360b0dc3e52b2cd3462f8d4ad869eb02c215b6d3206ba5dd3

## Tasks

### Task 001

#### Goal & intent

full task 템플릿에 `## Current behavior`·`## Target behavior` 절과 심볼 열을 가진 Touch 표를 두고, 절 파서가 두 절을 독립 키로 읽으며, plan gate G10이 두 절에 남은 TODO 자리표시(`TODO_RE`)를 거부하게 한다. 두 절은 선택 절이라 없는 task의 판정은 바뀌지 않는다. 검증 명령은 `npm run ci`다.

## Current behavior
- `TEMPLATES['tasks.md']`는 Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist 여섯 절만 싣고, Touch 자리표시는 ``- Modify `경로` — 이유`` 목록이다.
- `SECTION_DEFS`에 없는 `## Current behavior` 제목은 `parseSections`가 경계로 보지 않는다. 재현: Goal & intent 뒤에 `## Current behavior` 절과 TODO 자리표시를 둔 full task는 G10에서 `placeholders: goal`로 실패한다. 새 절 본문이 goal에 흡수되기 때문이다.
- G10 placeholder 검사는 필수 절(`sectionKeys`)만 본다.

## Target behavior
- 성공: `bouncer scaffold task`로 만든 full task에 `## Current behavior`와 `## Target behavior` 절(각각 TODO 자리표시)이 Goal & intent와 Interface 사이에 있고, Touch는 `| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |` 헤더의 표다. `parseTasksSections` 결과에 `currentBehavior`·`targetBehavior` 키가 있다.
- 실패: TODO 자리표시를 담은 새 절이 있으면 plan gate가 기존 G10 placeholder 메시지 끝에 그 절의 키(`currentBehavior`, `targetBehavior` 또는 둘 다)를 붙여 거부한다.
- 보존: 두 절이 없는 full task, light task, 목록형 Touch는 이전과 같은 G10·G11·G12 판정을 받는다. light 템플릿 바이트, Constraints를 검사하지 않는 동작, 기존 G10 메시지 문구가 그대로다.

#### Interface

- 제공: `SECTION_DEFS` 키 `currentBehavior`(`^##\s+(Current\s+behavior|현재\s*동작)\s*$`)와 `targetBehavior`(`^##\s+(Target\s+behavior|목표\s*동작)\s*$`). 표 셀 안 백틱 경로는 `pathJustifiedByTouch`로 G11 정당화가 된다.
- 거부: 두 절에 남은 TODO 자리표시. 새 G 코드와 새 frontmatter 필드는 두지 않는다.

#### Do not touch

- `scripts/src/lib/finalize.ts` — explain `## Tasks` 복사 범위는 이번 blueprint 밖이다.
- `scripts/src/lib/graph-search.ts` — 심볼 반환은 BP002 소관이다.
- `agents/bouncer-reviewer.md` — reviewer 입력 변경은 BP004 소관이다.
- `scripts/src/lib/context-digest.ts` — `touchPathHeadings`가 Touch 표의 백틱 심볼 칸도 경로 제목으로 읽는 잡음은 알려진 한계로 두고, 심볼 handoff를 정하는 BP002에서 다룬다.

### Task 002

#### Goal & intent

spec-authoring 지침·완성 예시·plan 스킬이 `## Current behavior`·`## Target behavior` 절과 Touch 표의 작성 규칙, full 전환 조건을 싣게 한다. 구현자 Authority, execute named·fallback payload, implementation reference는 여덟 절을 전달한다. TASKS-001이 만든 템플릿 절이 작성자와 구현자에게 도달하는 것이 완료 조건이며 검증 명령은 `npm run ci`다.

## Current behavior
- `references/spec-authoring/index.md`의 tasks 항목은 여섯 절만 나열하고 Touch를 파일별 동사 목록으로만 설명한다. 심볼·신규 추출 지점, 모호한 표현, 조사로 확정하지 못한 결정의 처리 규칙이 없다.
- `references/spec-authoring/tasks.md` 예시는 여섯 절과 목록형 Touch다.
- `agents/bouncer-implementer.md` `## Authority`, 이를 변환한 `.codex/agents/bouncer-implementer.toml`, `skills/bouncer-execute/references/agent-dispatch.md`의 named·fallback payload, `skills/bouncer-execute/SKILL.md` 구현 단계, `references/implementation/index.md`는 여섯 절만 권한·전달 대상으로 본다. 템플릿에 두 절이 생겨도 구현자에게 전달되지 않는다.
- light 지침은 거부 계약과 보호 경로만 full 전환 신호로 든다.

## Target behavior
- 성공: spec-authoring tasks 항목이 여덟 절을 나열하고 다음 규칙을 싣는다. Current behavior는 입력·상태·출력과 재현 조건, 확인한 테스트·명령을 적는다. Target behavior는 성공·실패 경로와 보존 동작을 나눈다. Touch 표는 진입점·상태 변경·검증 지점과 관련된 심볼만 선택 근거와 함께 적고, 이름을 확정할 근거가 없으면 `신규 추출 지점`과 책임을 적는다. 내부 심볼은 탐색 단서라 완료 조건이 이름에 의존하지 않는다. `개선한다`·`적절히 처리한다` 같은 판정 불가 문장을 금지하는 예시를 싣고, 조사로 확정하지 못한 설계 결정은 구현자에게 넘기지 않고 조사 보완·선행 discovery task·승인 전 사용자 확인 중 하나로 처리한다. 동작 변화가 없는 task는 산출물 검사·schema·dry-run 명령을 판정 근거로 적는다.
- 성공: `references/spec-authoring/index.md`의 light 항목과 `skills/bouncer-plan/SKILL.md`의 Light authoring scope가 공개 인터페이스, 보호 경로, 오류 계약, 여러 모듈의 상태 변화를 full 전환 조건으로 든다.
- 성공: 구현자 Authority, named·fallback payload, execute 구현 단계, implementation reference가 여덟 절을 같은 순서로 나열하고, 두 절이 없는 task는 있는 절만 전달한다고 적는다. checked-in Codex TOML은 `mdToCodexToml(agents/bouncer-implementer.md)`와 byte 단위로 같다.
- 보존: reviewer·debugger·context-reviewer의 절 목록, light 세 절 문구(`Goal & intent, Touch, Checklist`), 여섯 진입 스킬 단어 합계가 7,795 미만이라는 판정이 그대로다.

#### Interface

- 제공: 구현자 decision authority와 dispatch payload의 여덟 절. 두 절이 없는 브리프는 여섯 절 전달과 같다.
- 거부: 두 절을 reviewer Authority나 reviewer prompt `{{BRIEF}}`에 넣는 변경, light 템플릿이나 light 필수 절에 두 절을 더하는 변경.

#### Do not touch

- `agents/bouncer-reviewer.md` — reviewer 입력 변경은 BP004 소관이다.
- `references/review/assets/reviewer-prompt.md` — `{{BRIEF}}` 구성은 BP004 소관이다.
- `agents/bouncer-debugger.md` — debugger 입력은 이번 범위 밖이다.
- `docs/workflow-contract.md` — 131행은 과거 실행 기록이라 현재 절 목록으로 고치지 않는다.
- `rules/governance.md` — light 세 절 계약은 그대로다.
- `scripts/src/lib/templates.ts` — 템플릿은 TASKS-001 소관이다.