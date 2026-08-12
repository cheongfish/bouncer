---
type: bouncer.tasks
title: 워크플로 스킬 5개 구조 정렬
description: Tasks for 001
resource: .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T09:53:14.670+09:00'
bouncer:
  id: TASKS-001
  epic_id: '029'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 워크플로 스킬마다 플러그인 루트 해석 설명이 복제돼 설치 문서와 내용이 겹쳐 있음
    - 설명은 기존 문서 참조로 줄이되 블록마다 실행에 필요한 셸 대입은 그대로 남김
  affected_paths:
    - skills/bouncer-init/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - test/skill-bouncer-surface.test.js
    - test/skill-bouncer-commit.test.js
  graph:
    generated_at: '2026-08-12T09:53:14.670+09:00'
    command: mcp:graphify
    suggested_paths:
      - skills/bouncer-init/SKILL.md
      - skills/bouncer-plan/SKILL.md
      - skills/bouncer-execute/SKILL.md
      - skills/bouncer-commit/SKILL.md
      - skills/bouncer-finalize/SKILL.md
      - test/skill-bouncer-surface.test.js
      - test/skill-bouncer-commit.test.js
    basis:
      - graph: source
        status: reused
        query: skill contract test SKILL.md description assertion
        result: >-
          graph-sync reported skip-fresh but the returned nodes name deleted
          paths (commands/sdd-plan.md, skills/okf-authoring, .superpowers/);
          results discarded and paths seeded manually
      - graph: context
        status: updated
        query: 스킬 구조 anatomy 주석 규칙 마스터 규칙
        result: >-
          rebuilt this run, but the query returned the same stale node set as
          the source graph; no usable context hits
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
워크플로 스킬 5개(`bouncer-init` / `bouncer-plan` / `bouncer-execute` /
`bouncer-commit` / `bouncer-finalize`)에서 플러그인 루트 해석을 설명하는 산문
문단을 걷어내고 `docs/install.md` 「플러그인 루트」 참조 한 줄로 대체한다.
같은 내용이 이미 `docs/install.md:121-135`에 있으므로 새 참조 파일은 만들지
않는다.

셸 블록의 `BOUNCER_ROOT=` 대입 줄은 **그대로 둔다**. 블록마다 새 셸이 뜨므로
대입은 중복이 아니라 실행 조건이고, `test/cursor-plugin.test.js`의
「every shell block that reads BOUNCER_ROOT also assigns it」가 이미 이를 강제한다.

frontmatter `description`은 skill anatomy에 맞춰 3인칭 서술로 바꾼다.

## Interface
- 제공: 워크플로 스킬 5개의 `SKILL.md`. 본문 앞머리는 「Master rules」 라벨과
  `CLAUDE.md` 언급을 유지한 채 플러그인 루트 설명을 `docs/install.md` 링크로
  대체한 형태. `description`은 `This skill should be used ...` 형태의 3인칭.
- 거부: 스킬 `name`, 파일 경로, 셸 블록의 `BOUNCER_ROOT=` 대입, 번호가 붙은 절차
  단계의 순서와 내용은 바꾸지 않는다. 절차 의미가 달라져야 한다고 판단되면
  구현하지 말고 `/bouncer-plan`으로 되돌린다.

## Touch
- Modify `skills/bouncer-init/SKILL.md` — 플러그인 루트 산문 → 참조 한 줄, description 3인칭화
- Modify `skills/bouncer-plan/SKILL.md` — 위와 동일
- Modify `skills/bouncer-execute/SKILL.md` — 위와 동일
- Modify `skills/bouncer-commit/SKILL.md` — 위와 동일
- Modify `skills/bouncer-finalize/SKILL.md` — 위와 동일
- Modify `test/skill-bouncer-surface.test.js` — description 단정을 3인칭 표현에 맞게 갱신
- Modify `test/skill-bouncer-commit.test.js` — 같은 이유로 description 단정 갱신

## Do not touch
- `hooks/` — 훅의 `${CLAUDE_PLUGIN_ROOT}` 치환 규칙은 이 작업과 무관하고
  `test/cursor-plugin.test.js`가 별도로 고정한다.
- `docs/install.md` — 참조 대상이므로 내용을 바꾸면 순환이 된다. 앵커가 실제로
  깨져 있으면 구현하지 말고 보고한다.
- `scripts/`, `.bouncer/context/` — 이 blueprint는 문서 배치만 바꾼다.
- `CLAUDE.md` — TASKS-003이 맡는다.

## Constraints
- 「Master rules」 라벨 문자열과 `CLAUDE.md` 언급을 각 스킬 본문에 남긴다.
  `test/master-rules.test.js`가 워크플로 스킬 5개 전부에서 두 토큰을 찾는다.
- 스킬 YAML `description`에 따옴표 없는 `##`를 넣지 않는다(주석으로 잘린다).
- `skills/` 아래에 `SKILL.md` 없는 새 디렉터리를 만들지 않는다.
- 절차 단계의 문장을 줄이더라도 각 스킬 계약 테스트가 찾는 명령 문자열
  (`scaffold epic`, `validate --gate plan` 등)은 그대로 남긴다.
- 공개 문자열의 한국어/영어 구분은 현행을 유지한다.

## Checklist
- [ ] `docs/install.md`의 「플러그인 루트」 섹션이 각 스킬 산문이 설명하던 내용
      (해석 순서, 미설정 시 대처)을 모두 담고 있는지 확인한다. 빠진 항목이 있으면
      구현을 멈추고 보고한다 — `docs/install.md`는 Do not touch다.
- [ ] `npm test`를 먼저 돌려 기준선이 green인지 확인한다.
- [ ] 워크플로 스킬 5개에서 플러그인 루트 설명 문단을 참조 한 줄로 교체한다.
      셸 블록은 손대지 않는다.
- [ ] 5개 스킬의 `description`을 3인칭으로 고친다.
- [ ] `test/skill-bouncer-surface.test.js`와 `test/skill-bouncer-commit.test.js`의
      description 단정을 새 문구에 맞게 갱신한다.
- [ ] `npm test` 통과를 확인한다. 특히 다음 셋이 green이어야 한다:
      ```
      test/cursor-plugin.test.js
      test/master-rules.test.js
      test/skill-bouncer-surface.test.js
      ```
