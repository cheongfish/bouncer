---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/context-search/blueprints/registry-foundation/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-20T14:05:27.244+09:00'
bouncer:
  id: EXPLAIN-registry-foundation
  epic_id: context-search
  blueprint_id: registry-foundation
  status: draft
  comprehension: []
  task_commits:
    - task: context-search/registry-foundation/001
      sha: 895fcb44
      intent_anchor: task-001
    - task: context-search/registry-foundation/002
      sha: 3bb51c3f
      intent_anchor: task-002
    - task: context-search/registry-foundation/003
      sha: 56aae64f
      intent_anchor: task-003
---
# Explain

## Background

프로젝트가 어떤 epic을 쓰는지 정하는 정본이 없어, 계획마다 새 epic이 생기고 기존 epic과 공통 영역을 구분할 수 없었다. 이 blueprint는 `.bouncer/epics.json` 등록부와 `bouncer init` 프로필, 그리고 `legacy` epic이 새 blueprint를 받지 못하게 하는 차단을 넣는다.

## Code

- `scripts/src/lib/epic-registry.ts`: 등록부 형식(`version`, `profile`, `domainEpicLimit`, `areas`, `epics`)을 읽고 검증한다. JSON 파싱 실패, `version` 불일치, 필수 키 누락, 같은 `(slug, id)` 행 중복, slug나 id 중복은 S35로 거절한다. `COMMON_EPICS`는 공통 epic 8개의 포함·제외 문구를 요구사항 표 그대로 담는다. 파일은 `repoRoot` 아래에서만 읽는다.
- `scripts/src/lib/validate.ts`: 모든 `bouncer validate`가 등록부 검사를 돌리고 S35 hint를 붙인다.
- `scripts/src/lib/init.ts`, `cli-project-commands.ts`, `cli-usage.ts`: `bouncer init --profile <standard|domain-only> --domain-epic-limit <n>`이 프로필 구성을 등록부에 모두 펼쳐 쓴다. 등록부가 이미 있으면 다시 쓰지 않고, 공통 epic 디렉터리가 이미 있으면 그 ID를 재사용한다. `standard`는 공통 epic 8개 활성, `domain-only`는 0개다.
- `scripts/src/lib/scaffold.ts`, `plan-approve.ts`: 등록부에 `legacy`로 올라간 epic에 새 blueprint를 scaffold하거나 draft를 approve하면 쓰기 전에 거절한다(`plan-approve-legacy-epic`). 등록부가 없거나 invalid이거나 목록에 없는 epic은 기존 동작을 유지한다.
- `.bouncer/epics.json`: 이 저장소는 `domain-only`, `domainEpicLimit: 8`, 기존 epic 전부 `legacy`로 등록한다. epic 114도 `legacy`가 되므로 114에 새 blueprint를 만들거나 approve하는 일은 막힌다.
- 테스트: `test/epic-registry.test.js`와 `test/helpers/epic-registry.js`가 형식 검증을, `init`·`scaffold`·`plan-approve` 테스트가 각 경로를 다룬다. `test/validate-hints.test.js`는 hint 코드 목록에 `S35`를 추가했다.
- 한계: 등록부가 없는 프로젝트의 차단과 plan gate의 등록부 검사는 이 blueprint에 없다(다음 blueprint). `legacy` epic의 물리적 이관도 하지 않는다.

## Quiz

퀴즈는 아직 진행하지 않았다. `comprehension` 기록은 비어 있다.

## Tasks

### context-search/registry-foundation/001 · `895fcb44`

#### Goal & intent

등록부 형식과 구조를 검증하는 모듈을 만들어 `validate`가 항상 검사하게 한다.

### context-search/registry-foundation/002 · `3bb51c3f`

#### Goal & intent

`init`이 등록부와 공통 epic을 만들게 하고, 이 저장소의 기존 epic을 `legacy`로 등록한다.

### context-search/registry-foundation/003 · `56aae64f`

#### Goal & intent

`legacy` epic에는 새 blueprint가 생기거나 approve되지 않게 막는다.
