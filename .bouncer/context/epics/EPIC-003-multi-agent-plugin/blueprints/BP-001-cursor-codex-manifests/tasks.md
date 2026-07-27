---
type: bouncer.tasks
title: BP-001 tasks
description: Tasks for BP-001
resource: .bouncer/context/epics/EPIC-003-multi-agent-plugin/blueprints/BP-001-cursor-codex-manifests/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: TASKS-BP-001
  epic_id: EPIC-003
  blueprint_id: BP-001
  status: verified
  affected_paths:
    - .cursor-plugin
    - hooks
    - commands
    - test
    - README.md
  graph:
    generated_at: '2026-07-27T17:05:47.000+09:00'
    command: graphify query
    suggested_paths:
      - hooks
      - test
      - .claude-plugin
    basis: >-
      query: "plugin manifest commands hooks commit-safety CLAUDE_PLUGIN_ROOT
      marketplace distribution" — BFS depth=2, 19 nodes. Hits rolled up to
      hooks/hooks.json, .claude-plugin/plugin.json, test/plugin-wiring.test.js,
      i.e. the existing plugin wiring the new Cursor/Codex manifests must sit
      beside. Coverage caveat: config.source_dirs is scripts/hooks/test, so
      commands/*.md and the new manifest directories are outside the indexed
      set and were added to affected_paths by hand; the graph snapshot also
      predates the latest commits.
---
# Tasks

Blueprint: [BP-001](index.md)

## Goal & intent
지금 이 저장소는 Claude Code 플러그인으로만 설치된다. 완료 후에는 같은 저장소를
Cursor(`/add-plugin`)와 Codex(`/plugins`)에서도 네이티브 플러그인으로 설치할 수
있고, 세 에이전트 모두 동일한 `commands/`·`skills/`·`scripts/` 자산을 읽는다.

두 가지 배선이 핵심이다.

1. **매니페스트.** Cursor는 `.cursor-plugin/plugin.json`, Codex는
   `.codex-plugin/plugin.json`을 읽는다. Cursor는 매니페스트에 경로가 없으면
   `commands/`, `skills/*/SKILL.md`, `hooks/hooks.json`을 기본 탐색하는데, 이
   레이아웃이 이미 현 저장소와 일치한다. 따라서 명령·스킬은 선언 없이 자동으로
   잡히고, 훅만 Claude 전용 이벤트명(`PreToolUse`)이라 Cursor 전용 파일로 갈라야
   한다.
2. **플러그인 루트 토큰.** `commands/*.md` 4개와 `hooks/hooks.json`이
   `${CLAUDE_PLUGIN_ROOT}`를 쓴다. Cursor·Codex에는 이 변수가 없어 치환되지 않은
   문자열이 그대로 셸에 넘어가 실패한다. 세 에이전트에서 모두 해석되는 단일
   표현으로 통일한다.

Claude Code 쪽 설치·동작은 회귀 없이 그대로 유지되어야 한다. 판정 로직
(`scripts/lib/`)은 이미 에이전트 중립이므로 손대지 않는다.

## Interface

**신규 매니페스트**

- `.cursor-plugin/plugin.json` — 최소 필드는 `name`(kebab-case). `version`,
  `description`, `author`, `keywords`는 `.claude-plugin/plugin.json`과 값을
  맞춘다. 훅은 경로를 **명시 지정**해 `hooks/cursor-hooks.json`을 가리킨다
  (경로를 명시하면 기본 탐색을 대체하므로 Claude용 `hooks/hooks.json`은 읽히지
  않는다). `commands`/`skills`는 선언하지 않는다 — 기본 탐색이 맞다.
- `.cursor-plugin/marketplace.json` — 엔트리 하나, `name: "bouncer"`,
  `source: "./"`. `.claude-plugin/marketplace.json`과 대응.

**신규 훅 어댑터**

- `hooks/cursor-hooks.json` — Cursor 이벤트명 사용. 커밋 가드는
  `beforeShellExecution`에 건다.
- `hooks/cursor-commit-safety.js` — Cursor의 `beforeShellExecution` 페이로드를
  읽어 `evaluateCommit({ command, repoRoot })`를 호출하고, Cursor가 요구하는
  형식으로 허용/거부를 응답한다. **판정 로직을 다시 구현하지 말 것** — 기존
  `scripts/lib/commit-hook.js`의 `evaluateCommit`을 그대로 쓴다.
  `hooks/commit-safety.js`(34줄)가 그대로 참고 모델이다.

**변경되는 계약**

- `commands/bouncer-{init,plan,execute,finalize}.md`의 `${CLAUDE_PLUGIN_ROOT}`
  → 세 에이전트에서 모두 해석되는 단일 표현. 해석 순서:
  `BOUNCER_HOME` → 에이전트별 플러그인 루트 변수 → 미해결 시 사람이 읽을 수 있는
  오류 메시지. 정확한 변수명은 체크리스트 1번에서 확정한다.
  `BOUNCER_HOME`을 앞에 두는 이유는, 어느 에이전트가 어떤 변수를 주는지와
  무관하게 사용자가 직접 뚫을 수 있는 탈출구를 하나 보장하기 위해서다.
- `hooks/hooks.json` — 같은 토큰 규칙 적용. `PreToolUse`/`SessionStart` 구조와
  Claude 동작은 그대로. (`test/plugin-wiring.test.js`가 이 구조를 검사하므로
  이벤트명·매처를 바꾸면 안 된다.)

## Touch
- `.cursor-plugin/` — Cursor 플러그인/마켓플레이스 매니페스트 신규.
- `hooks/` — Cursor 훅 정의와 어댑터 신규, `hooks.json`의 루트 토큰 치환. 이
  디렉터리 안에서도 `session-graph.js`는 손대지 않는다 (SessionStart 훅 이식은
  이 blueprint의 out of scope).
- `commands/` — 네 개 명령 본문의 `${CLAUDE_PLUGIN_ROOT}` 토큰 치환.
- `test/` — 매니페스트 정합성과 Cursor 어댑터 차단 동작 테스트 추가.
- `README.md` — 에이전트별 설치 방법과 Codex 커밋 가드 한계를 문서화.

## Do not touch
- `scripts/lib/` — 게이트 판정과 커밋 가드 로직. 이미 에이전트 중립이고, 어댑터가
  `evaluateCommit`을 호출하는 것으로 충분하다. 여기를 고쳐야 할 것 같으면 설계가
  틀린 것이니 멈추고 보고할 것.
- `skills/` — 세 에이전트 모두 `SKILL.md`를 그대로 읽으므로 수정 불필요.
- `.claude-plugin/` — Claude Code 설치 경로. 회귀 방지를 위해 그대로 둔다.
- `.bouncer/config.json`, `.bouncer/templates/` — 이 변경과 무관하고 blueprint
  스코프 밖이다.

## Checklist
- [ ] **스파이크 (먼저).** Cursor와 Codex가 훅·명령 실행 시 노출하는 플러그인 루트
      환경변수명, Cursor `beforeShellExecution`의 입력 페이로드와 거부 응답 형식,
      Codex가 지원하는 훅 이벤트 목록을 확인한다. 확인 방법과 출처(문서 URL 또는
      실측)를 `verification.md`에 기록한다. 확정되지 않은 항목은 추측하지 말고
      `README.md`에 한계로 명시한다.
- [ ] 스파이크 결과로 플러그인 루트 해석 표현을 확정하고,
      `commands/bouncer-{init,plan,execute,finalize}.md`와 `hooks/hooks.json`의
      `${CLAUDE_PLUGIN_ROOT}`를 그 표현으로 치환한다.
- [ ] `.cursor-plugin/plugin.json`과 `.cursor-plugin/marketplace.json`을 만든다.
      훅 경로만 명시 지정하고 `commands`/`skills`는 기본 탐색에 맡긴다.
- [ ] `hooks/cursor-hooks.json`과 `hooks/cursor-commit-safety.js`를 만든다.
      어댑터는 `evaluateCommit`을 호출만 하고, 실패 시 fail-closed(차단) 한다 —
      `hooks/commit-safety.js`의 처리와 동일한 판단 기준을 유지한다.
- [ ] `README.md`에 Claude Code·Cursor 설치 절차와 `BOUNCER_HOME` 해석 규칙을 적고,
      Codex 지원은 매니페스트 제약(아래 Deviations) 때문에 BP-002로 미뤘음을 밝힌다.
- [ ] `test/` 에 검증을 추가한다: (1) Cursor 매니페스트가 존재하고 `name`이 `bouncer`로
      `.claude-plugin/plugin.json`과 일치하며 버전도 어긋나지 않는다,
      (2) `commands/*.md`가 `${CLAUDE_PLUGIN_ROOT}`를 직접 쓰지 않고 `BOUNCER_ROOT`
      해석을 거친다, (3) affected_paths 밖 파일이 staged인 상황에서 Cursor 어댑터가
      `permission: "deny"`를 stdout으로 낸다.
- [ ] `npm test` 전체 통과. 특히 `test/plugin-wiring.test.js`와
      `test/distribution.test.js`가 그대로 통과하는지 확인한다 (Claude Code 회귀).

## Deviations
실행 중 확인된 사실로 계획을 두 군데 정정했다. 둘 다 사용자 승인 아래 반영.

1. **Codex 분리 (BP-002).** Codex 0.145의 공식 검증기
   (`~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`)가 받는
   매니페스트 키는 `id, name, version, description, skills, apps, mcpServers,
   interface, author, homepage, repository, license, keywords`뿐이다 — `commands`도
   `hooks`도 거부된다. Codex 플러그인으로는 4개 명령도 커밋 가드도 노출할 수 없어,
   이번 blueprint를 Cursor 전용으로 줄이고 Codex는 별도 blueprint로 설계한다.
2. **`hooks/hooks.json`은 그대로 둔다.** 이 파일은 Claude Code만 읽고, 그 환경에서는
   `${CLAUDE_PLUGIN_ROOT}`가 정상 치환된다. Cursor는 매니페스트가 가리키는
   `hooks/cursor-hooks.json`만 읽으며 그쪽은 플러그인 루트 기준 상대 경로를 쓴다
   (설치된 Cursor 플러그인 실측으로 확인). 바꿀 이유가 없고 바꾸면 Claude 회귀
   위험만 생긴다.
