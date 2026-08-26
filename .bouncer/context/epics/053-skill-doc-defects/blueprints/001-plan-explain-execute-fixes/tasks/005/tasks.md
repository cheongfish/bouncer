---
type: bouncer.tasks
title: 스킬 코드펜스의 BOUNCER_ROOT 줄 정렬
description: 들여쓴 코드펜스 안에서 컬럼 0에 있는 BOUNCER_ROOT 줄을 주변 들여쓰기에 맞춘다
resource: .bouncer/context/epics/053-skill-doc-defects/blueprints/001-plan-explain-execute-fixes/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T13:09:35.860+09:00'
bouncer:
  id: TASKS-005
  epic_id: '053'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - '들여쓴 코드펜스 안에서 `BOUNCER_ROOT` 줄만 컬럼 0이라 블록 정렬이 어긋남'
    - '35곳을 주변 들여쓰기에 맞춰 복사해 붙일 때 혼동이 없게 함'
  affected_paths:
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/explain-diff/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/migrate-ids/SKILL.md
    - skills/review/SKILL.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T13:16:00+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: updated
        query: 'plan skill task bundle authoring graphify enable explain scaffold light review dispatch'
        result: '83 nodes; hits only under test/ (scaffold.test.js, skill-bouncer-surface.test.js, lightweight-cycle.test.js, helpers/read-skill.js). config.source_dirs is scripts/hooks/test, so skills/, rules/ and docs/ are not indexed and cannot appear.'
      - graph: context
        status: updated
        query: 'plan skill task bundle authoring graphify enable explain scaffold light review dispatch'
        result: '9 nodes; hits are the newly authored task docs under tasks/003-005. No prior context doc matched, so no reuse candidate surfaced.'
---

# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
스킬 10개의 셸 블록에서 `BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`가 컬럼 0에 있다. 같은 펜스의 다음 줄은 번호 목록 아래라 3–6칸 들여쓰여 있어, 한 블록 안에서 정렬이 어긋난다. CommonMark 파싱은 깨지지 않지만 복사해 붙일 때 블록 경계를 오해하기 쉽다.

37곳 중 어긋난 32곳을 주변 들여쓰기에 맞춘다. 명령 내용은 한 글자도 바꾸지 않는다.

## Interface
- 제공: 들여쓴 펜스 안의 런처 줄이 모두 같은 펜스의 다음 명령 줄과 같은 열에서 시작한다. epic 기준 6의 awk 명령이 32에서 0이 된다.
- 거부: 명령 문자열 변경을 받지 않는다. `bouncer-root --auto`, `|| exit $?`, 변수명은 그대로다. 펜스 언어 표기나 블록 구조도 바꾸지 않는다.

## Touch
- Modify `skills/bouncer-commit/SKILL.md` — 어긋난 4곳 정렬 (히트 5, 이미 맞음 1)
- Modify `skills/bouncer-execute/SKILL.md` — 어긋난 6곳 정렬 (히트 7, 이미 맞음 1)
- Modify `skills/bouncer-finalize/SKILL.md` — 어긋난 7곳 정렬 (히트 8, 이미 맞음 1)
- Modify `skills/bouncer-init/SKILL.md` — 어긋난 3곳 정렬
- Modify `skills/bouncer-plan/SKILL.md` — 어긋난 4곳 정렬 (히트 5, 이미 맞음 1)
- Modify `skills/bouncer-run/SKILL.md` — 어긋난 2곳 정렬 (히트 3, 이미 맞음 1)
- Modify `skills/explain-diff/SKILL.md` — 어긋난 1곳 정렬
- Modify `skills/graphify-runner/SKILL.md` — 어긋난 2곳 정렬
- Modify `skills/migrate-ids/SKILL.md` — 어긋난 2곳 정렬
- Modify `skills/review/SKILL.md` — 어긋난 1곳 정렬

## Do not touch
- `test/cursor-plugin.test.js` — 런처 줄을 `includes`로 검사하므로 들여쓰기가 붙어도 계속 통과한다. 테스트를 느슨하게 고칠 이유가 없다
- `scripts/lib/bouncer-root.js` — 런처 동작은 무관하다

## Constraints
- 줄의 내용은 바꾸지 않는다. 앞쪽 공백만 더한다.
- 셸 블록마다 자기 `BOUNCER_ROOT=` 대입이 있어야 한다(각 블록이 새 셸이다 — Distill `plugin-skills`). 정렬을 이유로 중복처럼 보이는 대입을 지우지 않는다.
- 이미 정렬이 맞는 **5곳**은 건드리지 않는다. 펜스 자체가 들여쓰이지 않은 최상위 블록이라 컬럼 0이 옳다 — `skills/bouncer-commit/SKILL.md:19`, `skills/bouncer-execute/SKILL.md:20`, `skills/bouncer-finalize/SKILL.md:27`, `skills/bouncer-plan/SKILL.md:24`, `skills/bouncer-run/SKILL.md:15`.
- 코드펜스 밖 산문은 한 글자도 손대지 않는다. 다른 스킬 테스트가 문장을 리터럴로 고정하고 있다.
- 이 task는 마지막에 수행한다. 001·002·004가 같은 파일의 문장을 먼저 바꾼다.

## Checklist
- [ ] `grep -rn '^BOUNCER_ROOT=' skills/*/SKILL.md`로 대상 37곳을 뽑고, 각 히트의 다음 줄 들여쓰기를 확인한다
- [ ] 각 히트를 바로 다음 명령 줄과 같은 열로 들여쓴다. 다음 줄이 들여쓰기 0이면 그대로 둔다
- [ ] 어긋난 수가 0인지 확인한다 (착수 시점 32):
  ```bash
  awk 'prev ~ /^BOUNCER_ROOT=/ && /^[[:space:]]/ {c++} {prev=$0} END{print c+0}' skills/*/SKILL.md   # 기대값 0
  ```
- [ ] 히트 총수가 그대로 37인지 확인한다 — 정렬이 런처 줄을 지우지 않았다는 뜻이다:
  ```bash
  grep -h '^\s*BOUNCER_ROOT=' skills/*/SKILL.md | wc -l   # 기대값 37
  ```
- [ ] `git diff --stat`으로 변경이 공백 추가뿐임을 확인한다:
  ```bash
  git diff --ignore-all-space --stat   # 기대: 변경 없음
  ```
- [ ] `npm test` 통과 확인
