---
type: bouncer.explain
title: hook-exec-bit explain
description: Explain for hook-exec-bit
resource: .bouncer/context/epics/host-distribution/blueprints/hook-exec-bit/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-27T12:51:47.506+09:00'
bouncer:
  id: EXPLAIN-hook-exec-bit
  epic_id: host-distribution
  blueprint_id: hook-exec-bit
  status: published
  comprehension:
    - range_from: 42bd048b62163cba9dd81a91b9619a92cdd48848
      range_to: 07e584c785b676a694126ac4a5f9b2b09dc8598e
      diff_sha: dc87240d48543901f86a39a4fc8e2f5f5a653430f27d12827b8f4d167bba2e5b
      recorded_at: '2026-10-27T12:52:34.955+09:00'
  task_commits:
    - task: host-distribution/hook-exec-bit/001
      sha: 7893e808
      intent_anchor: task-001
    - task: host-distribution/hook-exec-bit/002
      sha: 07e584c7
      intent_anchor: task-002
    - task: host-distribution/hook-exec-bit/004
      sha: d46e8b2f
      intent_anchor: task-004
---
# Explain

## Background

플러그인을 캐시로 복사하는 설치 경로는 파일의 실행 비트를 잃을 수 있다. 훅 명령을 `${CLAUDE_PLUGIN_ROOT}/hooks/x.js`처럼 셸이 직접 실행하면 이때 `Permission denied`로 훅이 실패한다. `hooks/subagent-model.js`는 저장소에서부터 644라, 비트가 보존돼도 같은 실패가 난다.

그래서 훅 명령이 실행 비트에 기대지 않게 바꾸고, 이를 어기는 변경을 테스트가 막는다. 같은 변경에서 plan 단계가 CHANGELOG·버전 파일을 계획에 넣지 못하게 하는 지침도 추가했다. 버전 올림은 릴리스 시점의 일이기 때문이다.

## Code

- `hooks/hooks.json`, `hooks/cursor-hooks.json`: 모든 훅 명령을 `node "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.js"` 형태로 바꿨다. `node`가 파일을 읽으므로 실행 비트가 필요 없다. `hooks/subagent-model.js`는 추가로 755로 올렸다.
- `test/plugin-wiring.test.js`: `hookCommandViolations(hooksJson, rootDir)`가 모든 훅 명령을 검사한다. `node `로 시작하면 대상 파일 존재만, 그 외 bare 명령은 소유자 실행 비트까지 본다. 대상 경로를 확실히 뽑지 못하면 추측하지 않고 위반으로 보고한다. 모드 관련 테스트는 Windows에서 건너뛰는데, 의도는 모드 검사만 건너뛰는 것이지만 지금은 훅 테스트 전체가 건너뛰어진다(알려진 한계, deferred).
- `rules/planning.md`의 `Release-time documents` 절: CHANGELOG와 버전 파일 8개를 Touch, `affected_paths`, Checklist, `bouncer.verify`에 넣지 못하게 한다. 요청이 오면 계획에서 빼고 사용자에게 한국어로 알린다. 문서 규칙일 뿐 plan gate는 검사하지 않고, 별도 릴리스 task는 이 파일들을 고칠 수 있다. `scope-confirm.md`가 이 절을 가리킨다.
- `test/build-release.test.js`의 예시 문서 allowlist에 `rules/planning.md`가 들어갔다. 이 문서가 `packages/cli/package.json` 경로를 예시로 적기 때문인데, 파일 전체가 예외라 런타임 소스 경로 가드가 약해졌다(deferred).

## Quiz

1. 훅 명령을 `node "${CLAUDE_PLUGIN_ROOT}/hooks/x.js"`로 바꾼 이유는?
2. `hookCommandViolations`가 bare 명령(`node ` 없음)의 대상 파일이 644일 때 내리는 판정은?
3. plan 단계에서 사용자가 버전 올림과 CHANGELOG 기록을 요청하면?
4. `Release-time documents` 규칙을 plan gate가 강제하는가?

## Tasks

### host-distribution/hook-exec-bit/001 · `7893e808`

#### Goal & intent

훅 명령이 파일 실행 비트에 의존하지 않게 한다. 완료 조건은 `hooks/hooks.json`의 세 명령과 `hooks/cursor-hooks.json`의 한 명령이 `node "…"` 형태이고, `hooks/subagent-model.js`가 755이며, 회귀 테스트가 "`node`로 시작하지 않는 명령의 대상 파일은 실행 비트를 가진다"를 검사하는 것이다. 검증 명령은 `node --test test/plugin-wiring.test.js test/subagent-model-hook.test.js test/cursor-plugin.test.js`.

#### Current behavior

- 입력/상태: `hooks/hooks.json`의 세 명령이 `${CLAUDE_PLUGIN_ROOT}/hooks/<name>.js`이고(commit-safety, subagent-model, session-graph), `hooks/cursor-hooks.json`의 명령은 `./hooks/cursor-commit-safety.js`다. 모두 셸이 파일을 직접 실행하므로 +x가 필요하다.
- 출력: git 모드는 `commit-safety.js`·`session-graph.js`·`cursor-commit-safety.js`가 100755, `subagent-model.js`가 100644다(`git ls-files -s hooks`). 플러그인 캐시 복사가 모드를 잃으면 SessionStart의 session-graph가 `Permission denied`를 낸다. `subagent-model.js`는 모드가 보존돼도 `Agent` 호출의 PreToolUse에서 같은 오류가 난다.
- 재현: `git ls-files -s hooks`로 모드를 보고, `ls -l hooks/subagent-model.js`에 `x`가 없음을 본다. 기존 단언은 `test/plugin-wiring.test.js:33~38`(`command.includes('commit-safety.js')`), `:42~`(`includes('session-graph.js')`), `test/subagent-model-hook.test.js:21`(명령이 정확히 `${CLAUDE_PLUGIN_ROOT}/hooks/subagent-model.js`와 같다), `test/cursor-plugin.test.js:63~68`(`includes('cursor-commit-safety.js')`), `:110~113`(cursor-hooks에 `CLAUDE_PLUGIN_ROOT` 이름이 없다)이다.
- I/O 관찰 지점: 테스트는 `fs.readFileSync`로 JSON을 읽고 `fs.statSync`로 모드를 본다(`test/subagent-model-hook.test.js:23`).

#### Target behavior

- 성공: 세 Claude 훅 명령이 각각 `node "${CLAUDE_PLUGIN_ROOT}/hooks/commit-safety.js"`, `node "${CLAUDE_PLUGIN_ROOT}/hooks/subagent-model.js"`, `node "${CLAUDE_PLUGIN_ROOT}/hooks/session-graph.js"`이고, Cursor 명령이 `node ./hooks/cursor-commit-safety.js`다. `hooks/subagent-model.js`는 755다.
- 실패 경로(회귀 방지): 훅 명령이 `node `로 시작하지 않으면 그 명령이 가리키는 파일이 실행 비트를 가져야 하고, 아니면 테스트가 파일 경로를 담은 메시지로 실패한다. 명령에서 파일 경로를 뽑을 수 없으면(따옴표 없는 공백 포함 경로 등) 추측하지 않고 실패한다.
- 보존: 훅 스크립트 내용과 훅 등록 구조(matcher, SessionStart 단일 등록)는 바뀌지 않는다. Cursor 명령은 `CLAUDE_PLUGIN_ROOT`를 쓰지 않는다.

#### Interface

- 제공: 위 네 명령 문자열, `hooks/subagent-model.js`의 755 모드, 그리고 테스트 헬퍼 `hookCommandViolations(hooksJson, rootDir)` → `string[]`(위반 설명 목록, 비어 있으면 통과). 헬퍼는 테스트 파일 안에만 두며 공개 API가 아니다. 위반은 (a) bare 명령의 대상 파일이 `mode & 0o100`(소유자 실행 비트) 없음, (b) `node ` 명령의 대상 파일이 없음, (c) 명령에서 대상 경로를 뽑을 수 없음(따옴표 없는 공백 경로, 추가 인자)이다. `${CLAUDE_PLUGIN_ROOT}`와 `./`로 시작하는 상대 경로는 모두 `rootDir` 기준으로 푼다.
- 거부(throw): 없음. 헬퍼는 위반을 목록으로 돌려주고 테스트가 단언한다.
- 도메인 용어: "bare 명령"은 `node `로 시작하지 않는 훅 명령이다. 예: `${CLAUDE_PLUGIN_ROOT}/hooks/x.js` (`${CLAUDE_PLUGIN_ROOT}`는 `rootDir`로 치환해 모드를 본다).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `hooks/hooks.json` | `hooks.PreToolUse[].hooks[].command`, `hooks.SessionStart[].hooks[].command` | Modify | 세 훅을 셸 직접 실행으로 등록 | 세 명령을 `node "…"`로 교체 | 실행 비트 의존의 진입점 (`hooks/hooks.json:7`, `:13`, `:20`) |
| `hooks/cursor-hooks.json` | `hooks.beforeShellExecution[].command` | Modify | Cursor 훅을 셸 직접 실행으로 등록 | `node ./hooks/cursor-commit-safety.js`로 교체 | 같은 의존 (`hooks/cursor-hooks.json:5`) |
| `hooks/subagent-model.js` | 파일 모드 | Modify | 644라 직접 실행 불가 | 모드만 755로 변경(내용 불변) | `git ls-files -s hooks`가 100644 |
| `test/plugin-wiring.test.js` | `hookCommandViolations`, 훅 등록 테스트 | Modify | 명령에 파일명이 들어 있는지만 확인 | bare 명령 규칙 검사 테스트 추가, 기존 `includes` 단언은 유지 | 회귀 방지 (`test/plugin-wiring.test.js:33~49`) |
| `test/subagent-model-hook.test.js` | 등록 단언 | Modify | 명령 문자열이 `${CLAUDE_PLUGIN_ROOT}/hooks/subagent-model.js`와 정확히 같아야 함 | 새 `node "…"` 문자열과 같도록 갱신 | 소비자 survey: `test/subagent-model-hook.test.js:21` |
| `test/cursor-plugin.test.js` | cursor 훅 단언 | Modify | `includes('cursor-commit-safety.js')`와 `CLAUDE_PLUGIN_ROOT` 부재 확인 | 새 명령 형태를 단언(기존 단언은 통과 유지) | 소비자 survey: `test/cursor-plugin.test.js:63~68`, `:110~113` |

#### Constraints

- 기존 `includes` 단언(`test/plugin-wiring.test.js:33~49`, `test/cursor-plugin.test.js:68`)은 그대로 통과해야 한다.
- 바꿀 수 있는 기존 단언은 `test/subagent-model-hook.test.js:21`의 정확 비교 하나뿐이며 새 기대값은 `node "${CLAUDE_PLUGIN_ROOT}/hooks/subagent-model.js"`다.
- Windows(`process.platform === 'win32'`)에서는 파일 모드 검사를 건너뛴다.
- 파일 모드 변경은 `chmod +x`로 하고 `git update-index`나 commit은 실행하지 않는다(commit은 controller 몫).

### host-distribution/hook-exec-bit/002 · `07e584c7`

#### Goal & intent

plan 단계에서 버전 관련 문서를 절대 갱신하지 않도록 지침을 둔다. 완료 조건은 `rules/planning.md`가 금지 대상 파일을 열거한 `## Release-time documents` 절을 갖고, `affected_paths` 확인 참조(`skills/bouncer-plan/references/scope-confirm.md`)가 그 절을 가리키며, 테스트가 (1) 절 본문에 각 대상 파일이 백틱 토큰으로 있고 안내 문구가 있음과 (2) `scope-confirm.md`가 `Release-time documents`를 언급함을 검사하는 것이다. 검증 명령은 `node --test test/plan-release-docs-rule.test.js test/skill-bouncer-surface.test.js`.

#### Current behavior

- 입력/상태: `rules/planning.md`(197줄)에는 `## Blueprint sizing rule`, `## Verification responsibilities`, `## Lightweight cycle`, `## Task DAG and approved scope`, `## Epic naming`, `## Epic attribution` 절만 있고 버전·CHANGELOG 언급이 없다(`rg -n "CHANGELOG|plugin.json" rules/planning.md skills/bouncer-plan`이 비어 있다).
- 출력: plan 작성자는 Touch·`affected_paths`·Checklist에 `CHANGELOG.md`나 `.claude-plugin/plugin.json`을 넣어도 막는 문서가 없다.
- 재현: 위 `rg` 명령. 확인한 기존 테스트는 `node --test test/skill-bouncer-surface.test.js`이며 `rules/planning.md` 존재만 본다(`test/skill-bouncer-surface.test.js:70`).
- 버전 파일의 정본 목록은 `scripts/sync-versions.js`의 `TARGETS`(`packages/cli/package.json`, `package-lock.json`)와 `PLUGIN_TARGETS`(`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`)다. 루트 `package.json`의 `version`도 같은 정본이다(`CHANGELOG.md`는 `## [Unreleased]`가 있는 별도 문서).

#### Target behavior

- 성공: `rules/planning.md`에 `## Release-time documents` 절이 생긴다. 내용은 (1) plan 단계 문서(epic, blueprint, tasks)가 아래 파일을 Touch·`affected_paths`·Checklist·`bouncer.verify`에 넣거나 변경하도록 계획하지 않는다, (2) 요청이 버전 올림이나 CHANGELOG 기록을 요구하면 계획에 넣지 않고 "릴리스 시점에 따로 작성한다"고 사용자에게 알린다, (3) 금지 파일은 `CHANGELOG.md`, `package.json`, `packages/cli/package.json`, `package-lock.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`이다.
- 확인 참조: `scope-confirm.md`에 위 절을 따르라는 한 문단이 생긴다(목록은 반복하지 않고 절을 가리킨다).
- 실패 경로: 테스트는 절 본문에서 대상 파일 토큰이나 안내 문구("릴리스 시점에 따로 작성")가 빠지거나 `scope-confirm.md`에 절 참조가 없으면 빠진 항목 이름을 담아 실패한다. 이 규칙은 문서로만 강제되며 plan gate는 검사하지 않는다.
- 보존: 기존 절과 `skills/bouncer-plan/SKILL.md` 번호 단계 구조는 바뀌지 않는다. plan gate에 새 검사 코드는 추가하지 않는다.

#### Interface

- 제공: `rules/planning.md`의 `## Release-time documents` 절(금지 파일 8개 + 사용자 안내 규칙). `scope-confirm.md`의 참조 문단. 테스트는 `rules/planning.md` 절 본문에서 파일명이 각자 백틱 토큰으로 있는지, `scope-confirm.md`에 `Release-time documents` 언급이 있는지 본다.
- 거부: 이 지침은 plan 단계 문서에만 적용된다. 릴리스 담당이 별도 작업으로 이 파일들을 고치는 것은 막지 않는다.
- 도메인 용어: "버전 관련 문서"는 `scripts/sync-versions.js`가 관리하는 파일, 그 정본인 루트 `package.json`, `CHANGELOG.md`다. 예: `.cursor-plugin/plugin.json`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/planning.md` | `## Release-time documents` | Modify | plan 단계 제품 규칙 | 새 절 추가 | 작성자가 `spec-authoring`에서 가장 먼저 읽는 규칙 (`references/spec-authoring/index.md` Steps 1) |
| `skills/bouncer-plan/references/scope-confirm.md` | `affected_paths` 확인 단락 | Modify | affected_paths 확정 직전 절차 | 금지 절을 가리키는 문단 추가 | 경로가 확정되는 지점 (`scope-confirm.md:1~11`) |
| `test/plan-release-docs-rule.test.js` | 문서 존재 단언 | Create | 해당 없음 | 절 본문의 파일 8개 토큰·안내 문구와 참조 문단 단언 | 회귀 방지 |

#### Constraints

- 새 절은 `rules/planning.md` 끝에 붙이거나 기존 절 사이에 넣되, 필수 heading `Lightweight cycle`(`scripts/lib/doc-shape-contracts.js:119`)을 지우지 않는다.
- 사용자에게 보이는 안내 문구 규칙은 한국어 AGENTS.md hard rule 5를 따르므로 지침 안에서 사용자 안내 문장은 한국어로 쓴다.
- `lint:docs`(`node scripts/check-doc-shape.js`) 계약을 어기지 않는다.

### host-distribution/hook-exec-bit/003

#### Goal & intent

TASKS-001과 TASKS-002가 통합된 상태에서 전체 검증 명령 `npm run ci`가 통과함을 증명한다. 훅 명령 변경과 plan 규칙 문서가 합쳐진 뒤에도 `check:emit`, `lint`, `lint:docs`, 단위 테스트가 모두 통과해야 한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### host-distribution/hook-exec-bit/004 · `d46e8b2f`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/build-release.test.js` — 기록된 CI 실패를 복구한다.
- Modify `test/tiers.json` — 기록된 CI 실패를 복구한다.
- Modify `skills/bouncer-plan/references/scope-confirm.md` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.