---
type: bouncer.explain
title: public-cli-boundary explain
description: Explain for public-cli-boundary
resource: .bouncer/context/epics/host-distribution/blueprints/public-cli-boundary/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T17:00:53.342+09:00'
bouncer:
  id: EXPLAIN-public-cli-boundary
  epic_id: host-distribution
  blueprint_id: public-cli-boundary
  status: draft
  comprehension: []
---
# Explain

## Background

- 훅·스킬·규칙이 `scripts/lib` 내부 모듈과 `scripts/bouncer` 경로를 직접 실행하고 있었다. 런타임을 npm 패키지로 분리하면 이 호출이 모두 깨진다.
- 그래서 플러그인 쪽은 공개 `bouncer` CLI만 부르고, 런타임은 플러그인 자산을 검증된 plugin-root resolver로만 찾도록 경계를 고정한다.
- 훅은 런타임이 없거나 실패해도 사용자 작업을 막지 않아야 하는 쪽(SessionStart)과, 막아야 하는 쪽(commit 훅)이 갈린다. 이 구분이 새 경계에서도 유지된다.

## Code

- `hooks/runtime-cli.js`: 훅이 공개 CLI를 찾고 부르는 공용 모듈. `BOUNCER_BIN` → PATH의 절대 경로 `bouncer` 순으로 찾고, 고정 argv·`shell:false`·20초 timeout으로 실행하며 플러그인 루트를 `BOUNCER_HOME`으로 넘긴다. Windows는 `.cmd`를 cmd.exe로 실행하되 경로에 셸 메타문자가 있으면 실행하지 않는다.
- `hooks/commit-safety.js`, `hooks/cursor-commit-safety.js`: 먼저 commit 가능성이 없는 명령을 런타임 없이 통과시킨다. 가능성이 있으면 `bouncer commit-guard --command-stdin`으로 판정한다. 런타임 부재·실패는 차단(Claude exit 2, Cursor `deny`)이고, 파싱할 수 없는 payload는 통과한다. 리뷰 수리로 예기치 않은 예외도 차단 쪽으로 닫았다.
- `hooks/session-graph.js`: `bouncer graph-sync`를 부르고 JSON의 `warnings`만 stderr에 낸다. 런타임 부재·실패에도 exit 0이다. 리뷰 수리로 `runRuntime`과 parse 예외를 모두 잡는다.
- `scripts/src/lib/cli-commit-guard-command.ts`: `commit-guard --command-stdin [--repo]` 추가(exit 0/1/2). 기존 `--staged`는 그대로다.
- `scripts/src/lib/cli-git-commands.ts`: `finalize worktree-path`, `finalize diff-sha` 조회 명령. 문서가 내부 모듈 대신 이 명령을 부른다.
- `scripts/bouncer`, `scripts/src/lib/plugin-root.ts`: 순수 명령(`commit-guard`, `current`, `project-root`, `validate`, `verify`, `graph-sync`)은 plugin root 탐색 없이 자기 `lib/cli.js`를 실행한다. 자산 resolver는 `BOUNCER_HOME` → 런타임 트리 → 호스트 후보 순이고, 후보 검증에 필수 자산(`agents/`, `skills/`, `rules/`, `references/`, `hooks/`, `AGENTS.md`) 검사가 들어갔다.
- `codex-agents.ts`, `print-dispatch.ts`, `coordinate-next.ts`: `__dirname/../..` 대신 resolver가 준 루트에서 자산을 읽는다.
- 문서(`docs/*`, `rules/*`, `skills/.../cleanup-handoff.md`, `references/explain-diff`)는 내부 경로 실행을 공개 명령으로 바꿨다. `test/public-name-regression.test.js`가 내부 경로 실행 0건을 고정한다.
- 알려진 한계: win32에서 `ComSpec`이 없으면 bare `cmd.exe`로 폴백한다(Interface가 지정한 값, 후속 하드닝 대상). 이 BP는 종단 `npm run ci`의 lint 오류 2건(`hooks/session-graph.js`의 쓰지 않는 catch 바인딩과 중복 대입)이 남은 채 닫혔다.

## Quiz

퀴즈는 실시하지 않았다.

## Tasks
