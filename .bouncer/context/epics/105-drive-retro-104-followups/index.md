---
type: bouncer.epic
title: drive 회고 104 후속 보강
description: 'RETRO-104 follow-ups: verify failure output tail, ASCII epic description guard, and plan discovery and review guides'
resource: .bouncer/context/epics/105-drive-retro-104-followups/index.md
tags:
  - bouncer
  - epic
  - finalize
  - scaffold
  - graphify
  - context-review
timestamp: '2026-10-16T12:58:51.276+09:00'
bouncer:
  id: '105'
  epic_id: '105'
  status: approved
  supersedes: []
---
# drive 회고 104 후속 보강

## Intent
- 문제: `finalize --yes`가 verify에 실패하면 원인 출력 없이 종료 코드만 돌려줘 일시적 실패와 회귀를 가를 수 없다. 새 epic description의 영어 ASCII 규칙은 작성 단계 문서에만 있어 scaffold 뒤에야 드러나고, 그래프 후보 확인 순서와 구조 변경이 delta를 막는다는 사실은 문서에 없다.
- 목표: verify 실패 payload에 이미 수집한 출력 tail을 싣고, 새 epic의 비-ASCII description은 scaffold가 거부하며, 두 절차를 소유 문서에 적는다.

## Success criteria
1. `finalize --yes`가 verify 실패로 `VERIFY_FAILED`를 반환할 때 payload에 verify 출력 마지막 100줄 이하의 `output_tail` 문자열이 있다.
2. 기존 실패 payload 필드(`reason`, `code`, `command`, `exitCode`, `integration`, `branch`)와 문서·worktree 보존 동작, verify 설정 오류(`command: null`)·의존성 설치 실패 경로는 그대로다.
3. 새 epic을 만드는 `scaffold epic`은 description에 출력 가능한 ASCII(0x20–0x7E) 밖의 문자가 있으면 파일을 하나도 쓰지 않고 exit 2로 거부한다.
4. 이미 있는 epic의 재실행은 넘긴 description과 무관하게 지금처럼 동작한다.
5. `references/graphify-runner/index.md` Step 3, `skills/bouncer-plan/references/context-review.md` 4단계, `skills/bouncer-plan/SKILL.md` 2단계에 각 절차 문장이 들어간다.
6. 바뀐 CLI 동작이 `rules/cli.md`와 테스트에 반영되고 `npm test`, `npm run lint`, `npm run lint:docs`, `npm run lint:test-names`, `npm run typecheck`가 통과한다.

## Out of scope
- 일시적 verify 실패의 자동 재시도와 원인 판정.
- 기존 epic의 한국어 description을 다시 쓰거나 검증 규칙으로 소급 거부하는 일.
- blueprint·task description 검사(`scaffold blueprint`에는 `--description`이 없다).
- 그래프 질의를 필수 gate로 만드는 일과 그 정확도·토큰 측정.

## Blueprints
* [001 verify 출력 tail과 계획 안내 보강](blueprints/001-verify-tail-and-plan-guides/index.md) - `finalize.ts`의 실패 payload, `scaffold.ts`의 description 검사, graphify-runner·context-review·plan 스킬 문서 문단
