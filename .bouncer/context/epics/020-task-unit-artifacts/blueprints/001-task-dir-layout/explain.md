---
type: bouncer.explain
title: task 문서 경로를 디렉터리 묶음으로 안내
description: Explain for TASKS-003
resource: .bouncer/context/epics/020-task-unit-artifacts/blueprints/001-task-dir-layout/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-07T11:14:36+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '020'
  blueprint_id: '001'
  status: published
  comprehension:
    diff_sha: 'dd77edcd31b091a665bba5ca5ffe874d2e33b0cd845267e1f85de5acd413e761'
    quiz_score: '1/1'
    disposition: '퀴즈 1문항 정답. task 묶음 추가와 포인터 증적 경로를 이해함.'
    recorded_at: '2026-08-07T12:41:55+09:00'
---
# Explain

## Background

task 묶음 리졸버와 execute 게이트가 먼저 새 배치를 처리하게 됐지만, 사용자를
안내하는 스킬·에이전트·문서는 아직 `tasks-001.md`와 blueprint 루트의 증적 경로를
섞어 썼다. 새 blueprint를 만든 뒤에도 다음 task를 어떻게 추가하고, 어느
`verification.md`와 `review.md`를 읽어야 하는지 문서마다 달라질 수 있었다.

이번 변경은 새 blueprint의 첫 묶음을
`tasks/001/{tasks,verification,review}.md`로 설명하고, 추가 묶음은
`bouncer scaffold task --blueprint <dir> --id <NNN>`으로 만들도록 통일한다.
execute·verification·review 안내는 포인터 task 디렉터리의 증적 문서를 가리킨다.
구 루트 레이아웃은 하드컷 전까지 마이그레이션 대상으로 남긴다.

## Intuition

task 하나를 열면 브리프·검증·리뷰 세 장이 같은 폴더에 들어 있는 서류철을 꺼내는
방식이다. 안내문도 그 서류철의 주소를 써야 다른 task의 증적을 찾지 않는다.

## Code

- `CLAUDE.md`, `docs/governance.md`, `docs/workflow.md`, `docs/gates.md` —
  task 묶음의 배치와 plan/execute 판정 단위를 설명한다.
- `skills/bouncer-plan/SKILL.md`와 하위 스킬 — 첫 묶음 스캐폴드, task 추가 명령,
  포인터 task 디렉터리의 verification/review 경로를 안내한다.
- `agents/bouncer-*.md`, `skills/review/reviewer-prompt.md` — implementer,
  reviewer, debugger가 같은 브리프·증적 경로를 받도록 맞춘다.
- `test/*skill*.test.js`, `test/agents.test.js`, `test/master-rules.test.js` —
  이 안내 계약이 다시 구 경로로 바뀌지 않도록 고정한다.

## Quiz

**Q1.** 새 blueprint의 두 번째 task를 추가하고 execute 증적을 확인할 때 맞는
설명은 무엇인가?

- A) `tasks-002.md`를 만들고 blueprint 루트의 `verification.md`를 확인한다
- B) `bouncer scaffold task --blueprint <dir> --id <NNN>`를 실행하고, 포인터 task
  디렉터리의 `verification.md`와 `review.md`를 확인한다
- C) `tasks.md` 하나에 다음 task를 덧붙이고 review는 blueprint 마지막에만 기록한다

## 이해 상태

- 정답: Q1=B
- 응답: Q1=B
- 채점: 1/1 — 정답. task 추가 명령과 포인터 task 디렉터리의 증적 경로를
  구분했다.
- disposition: 퀴즈 1문항 정답. task 묶음 추가와 포인터 증적 경로를 이해함.
- diff_sha: dd77edcd31b091a665bba5ca5ffe874d2e33b0cd845267e1f85de5acd413e761
- recorded_at: 2026-08-07T12:41:55+09:00
