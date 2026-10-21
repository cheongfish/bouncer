---
type: bouncer.blueprint
title: 공통 코딩 표준과 테스트 신뢰성 리뷰
description: Move shared coding, test, and Korean comment standards into one canonical reference and carry red-run evidence from the implementer report to the reviewer.
resource: .bouncer/context/epics/gates-review/blueprints/coding-standards/index.md
tags:
  - bouncer
  - blueprint
  - coding-standards
  - review
  - implementer
timestamp: '2026-10-12T10:47:02.804+09:00'
bouncer:
  id: coding-standards
  epic_id: gates-review
  blueprint_id: coding-standards
  status: closed
  order: 9
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 공통 코딩 표준과 테스트 신뢰성 리뷰

Epic: [095](../../../coding-standards-pr-retro/index.md)

## Intent
공통 코딩·테스트·주석 기준을 `references/coding-standards/index.md` 하나로 모으고 implementer·reviewer·계획 작성 문서는 그 정본을 읽게 함.
implementer의 red 실행 근거를 reviewer slot까지 전달해 reviewer가 테스트가 요구사항과 결함을 실제로 잡는지 판정하게 함.

## Diagram

```mermaid
flowchart LR
  S[공통 표준] --> I[구현 · Red run]
  I --> R[리뷰 · 테스트 신뢰성]
```

## Contract
- 인터페이스:
  - 새 reference `references/coding-standards/index.md`(frontmatter `name: coding-standards`)는 subskill 공통 제목(`When this applies`·`Core rules`·`Guardrails`·`Return`) 사이에 내용 절 `Tests`, `Test trust`, `Error handling`, `Reuse and abstraction`, `Comments and docstrings`를 갖는다.
  - `references/implementation/index.md`는 구현 호출 계약(When this applies·Steps·Guardrails·Return)만 남긴다. `Language and detailed comments` 절은 제목째 지우고, Steps에 정본 링크 한 줄을 둔다.
  - implementer 출력 계약에 `Red run` 칸이 생긴다. 값은 `<명령> — <관측한 실패 단언·이유>` 또는 `해당 없음: <이유>`이다.
  - reviewer 호출 slot에 `{{RED_RUN}}`이 생기며, 위치는 `Constraints` 다음이다. 값은 리뷰 범위의 commit task마다 `TASKS-NNN: <값>` 한 줄이다. task 범위 리뷰, blueprint 범위 최종 리뷰, discovery, delta 모두 같다.
- 데이터·상태: TS 런타임·digest·ledger 스키마는 바뀌지 않는다. `.codex/agents/bouncer-{implementer,reviewer,coordinator}.toml`은 바뀐 md의 `mdToCodexToml` 결과로 다시 쓴다.
- 수용 기준: epic Success criteria 1·2·3·9와 BP 범위의 10이 참이다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - inline·fallback reviewer는 reviewer.md 본문만 받으므로, 정본 Read 지시가 그 본문 안에 있어야 한다.
  - `Red run`이 없거나 형식이 틀린 보고는 reviewer가 `correctness_tests` finding으로 지적한다. 판정 근거로 쓰지 않는다.
  - 문서만 바꾸는 task는 `해당 없음: <이유>`로 통과한다.
  - 공통 표준이 승인된 brief·`affected_paths`와 충돌하면, implementer는 brief를 줄이거나 넓히지 않고 `Needs planning`으로 보고한다.

## Out of scope
- 테스트 이름 기계 검사(BP 002)
- PR 본문 규칙(BP 003)
- TS 런타임이 implementer 보고 필드를 파싱하게 바꾸는 것
- minimality의 계획 단계 YAGNI 사다리 재작성(참조 연결만)

## One-commit justification
- 정본 생성과 중복 제거는 같은 기준을 옮기는 한 작업이라 한 리뷰 단위다. Red run 전달은 그 정본의 `Test trust` 절을 소비하므로 같은 PR에서 두 task로 순서대로 커밋한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 공통 표준 정본과 중복 제거
* [Tasks 002](tasks/002/tasks.md) - Red run 전달과 테스트 신뢰성 판정
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
