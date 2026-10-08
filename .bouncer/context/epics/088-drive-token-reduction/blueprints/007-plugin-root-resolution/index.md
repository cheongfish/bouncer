---
type: bouncer.blueprint
title: 플러그인 문서 경로를 루트 기준으로 열기
description: Lets print workers and workflow skills open plugin documents from a known plugin root instead of searching for them, and makes the benchmark harness stop on an unrecognized question.
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/007-plugin-root-resolution/index.md
tags:
  - bouncer
  - blueprint
  - plugin-root
  - print-dispatch
  - skills
  - benchmark
timestamp: '2026-10-08T14:28:58.266+09:00'
bouncer:
  id: '007'
  epic_id: '088'
  blueprint_id: '007'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 플러그인 문서 경로를 루트 기준으로 열기

Epic: [088](../../index.md)

## Intent
v088006 재측정에서 plan·finalize·context-reviewer·implementer 세션은 `rules/acq.md`, `references/context-review/index.md` 같은 플러그인 상대 경로의 루트를 몰라 glob과 `ls`로 파일을 찾았다. 이 blueprint는 print prompt와 스킬 첫 줄이 플러그인 루트를 알려 주고 문서 인용을 그 루트 기준으로 바꾸며, 하네스가 인식하지 못한 질문에서 단계를 조용히 끝내지 않게 한다.

## Contract
- 인터페이스
  - `bouncer dispatch print`가 쓰는 prompt는 식별 줄, 빈 줄, `Plugin root: <절대 경로>. Resolve plugin-relative paths (rules/..., references/..., agents/...) against it.` 한 줄, 빈 줄, 역할 본문, 빈 줄, 입력 순서다. 경로는 역할 문서를 읽은 `agents/` 디렉터리의 부모다. 식별 줄 바이트는 바뀌지 않는다.
  - 여섯 `skills/bouncer-*/SKILL.md`의 `**Plugin root.**` 문단은 `BOUNCER_ROOT="$(bouncer-root --auto)"`를 한 번 실행하라고 적고, `${BOUNCER_ROOT}/rules/plugin-root.md`를 인용한다. 새 CLI 명령은 없다.
  - `skills/**`, `rules/*.md`, `references/**`의 플러그인 문서 인용(`rules/…`, `references/…`, `agents/…`, 플러그인 `AGENTS.md`)은 `${BOUNCER_ROOT}/…` 표기다. 스킬 로컬 `./references/…`와 Markdown 링크 href(`../../rules/…`)는 그대로다. `rules/skill-shape.md` 표기 표가 이 범위를 적고 테스트가 판정한다.
  - 벤치마크 응답기는 `unrecognizedQuestion(text)`와 `unhandledQuestionMethod(text)`를 export한다. `run-print-stage.cjs`는 ACQ·quiz·위임이 처리하지 않은 턴에서 `unhandledQuestionMethod`가 돌려준 method(`text/unread-question` 우선, 그다음 `text/unrecognized-question`)를 `unanswered`에 남기고 멈춘다.
- 데이터·상태: CLI 출력 JSON, 원장, 문서 frontmatter 스키마, `run.json`·`decisions.json` 형태는 바뀌지 않는다. `unanswered` 항목에 새 `method` 값 하나가 생긴다.
- 수용 기준: epic Success criteria 6, 27~30.
- 검증 명령: 각 task `bouncer.verify`(`npm test`). lint·typecheck·coverage를 포함한 `npm run ci`는 PR CI가 실행한다.
- 실패 모드·엣지 케이스
  - 플러그인 루트 경로에 공백이나 비ASCII 문자가 있어도 prompt 줄에 그대로 들어간다. prompt는 argv 칸으로 넘어가므로 셸 인용이 없다.
  - 테스트 seam `deps.agentsDir`을 주면 루트 줄은 그 부모를 가리킨다.
  - `**Plugin root.**` 문단은 한 문단을 유지한다. `rule-ownership` 테스트가 빈 줄에서 startup 문단을 자른다.
  - 다음 인용은 바꾸지 않는다: coordinator 식별 줄 안의 `rules/cursor-print-dispatch.md`(코드가 바이트를 고정), `references/discovery/index.md`의 프로젝트 `AGENTS.md`·`CLAUDE.md`, `rules/output.md`의 출력 예시. 자리표시자·glob 형태(`agents/*.md`, `references/<name>/index.md`)도 접두를 붙인다.
  - 질문 판정은 선택지 줄 2개 이상인 마지막 `---` 구역부터 끝까지에서 요청 문구를 찾는다. 선택지 없는 완료 보고의 `선택됨`, `응답`은 질문이 아니다.

## Out of scope
- `agents/*.md` 역할 문서 내용과 생성 TOML, named agent(Task subagent) 동작. print worker는 prompt 루트 줄로 그 안의 경로를 해석한다.
- `bouncer-root --auto` 후보 검색 규칙과 새 `bouncer plugin-root` 명령.
- INV-1~3 조사(context review `combined` 축소, `coordinate next` 호출 수, finalize 문서 로드)와 ledger-004 재측정 실행.
- 벤치마크 과제 카드·rubric·verifier·평가자 정책, `dirty_source` 판정.

## One-commit justification
- PR 하나로 리뷰하는 088 후속 묶음이고 task마다 한 커밋이 된다. TASKS-001은 print prompt 루트 줄, TASKS-002는 스킬 첫 줄, TASKS-003은 인용 일괄 변경, TASKS-004는 하네스 질문 판정을 맡는다. 001~003은 CHANGELOG와 `rules/` 문서를 같이 고치므로 `depends_on`이 001 → 002 → 003을 고정하고, 004는 경로가 겹치지 않아 001과 병렬로 돈다.

## Documents
* [Tasks 001 — print prompt 루트 줄](tasks/001/tasks.md) - `print-dispatch.ts`, `rules/cursor-print-dispatch.md` 3항, 테스트
* [Tasks 002 — 스킬 Plugin root 줄](tasks/002/tasks.md) - 여섯 SKILL.md 첫 줄, `rules/plugin-root.md`, 테스트
* [Tasks 003 — 플러그인 문서 인용 표기](tasks/003/tasks.md) - `skills/**`·`rules/`·`references/**` 인용, `rules/skill-shape.md`, 표기 테스트
* [Tasks 004 — 하네스 질문 판정](tasks/004/tasks.md) - `responder.cjs`, `run-print-stage.cjs`, fixture
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
