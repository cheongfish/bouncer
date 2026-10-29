---
type: bouncer.explain
title: retro-friction-and-revise-union explain
description: Explain for retro-friction-and-revise-union
resource: .bouncer/context/epics/drive-execution/blueprints/retro-friction-and-revise-union/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T12:13:01.795+09:00'
bouncer:
  id: EXPLAIN-retro-friction-and-revise-union
  epic_id: drive-execution
  blueprint_id: retro-friction-and-revise-union
  status: published
  comprehension:
    - range_from: 13c0dcb4027bfc290a47cdd7ee21e417eebeaee5
      range_to: 11e0c2f59db343bddc2c4cee3828829b7a5b7b89
      diff_sha: 904b9466a311d60e90a4b3a66758ad141f1ea046643be9f605d058aa85667c66
      recorded_at: '2026-10-29T12:13:47.210+09:00'
  task_commits:
    - task: drive-execution/retro-friction-and-revise-union/001
      sha: 7773a058
      intent_anchor: task-001
    - task: drive-execution/retro-friction-and-revise-union/002
      sha: 28ce0fcb
      intent_anchor: task-002
    - task: drive-execution/retro-friction-and-revise-union/004
      sha: 11e0c2f5
      intent_anchor: task-004
---
# Explain

## Background

범위를 한 경로만 바꾸려 해도 `coordinate revise --paths`가 직전 범위를 통째로 교체했다. 그래서 경로 하나를 더하려다 기존 범위가 줄었고, 줄어든 범위를 복원하는 작업이 이어졌다. 이 변경은 기본 동작을 "직전 범위에 더하기"로 바꾸고, 교체는 `--replace`를 명시할 때만 하게 한다.

같은 시기에 실행 문서 쪽 마찰 네 가지도 함께 정리했다. 구현 worker가 직접 커밋하는 사고, coordinator 보고의 커밋 내용 주장에 근거가 없는 문제, implementer 보고가 brief Constraints를 빠뜨리는 문제, Codex 전용 점검이 다른 호스트에서도 요구되는 것처럼 읽히는 문제다.

## Code

- `packages/cli/src/scope.ts`의 `reviseTaskScope`가 `replace` 인자를 받는다. 기본은 직전 범위, `--paths`, `--new-path` 순서의 합집합이고 `normalizeScopeEntry` 기준으로 중복을 한 번만 둔다(`uniqueByNormalizedScope`). `replace: true`이면 전달한 집합으로 교체한다.
- `scope-paths-dropped` 경고는 교체로 줄어든 경로가 있을 때만 나온다. 글롭·추적 검사는 플래그로 받은 값에만 걸리고, out-of-bounds·Do not touch·lease 충돌 검사는 그대로다.
- `packages/cli/src/cli-git-commands.ts`의 `coordinateRevise`가 `--replace`를 값 없는 boolean으로 받는다. 값이 붙으면 `coordinate revise: --replace takes no value`로 exit 2다. `--replace=x`는 알 수 없는 플래그라 무시된다.
- 문서: `direct-run.md`는 구현 worker에게 커밋하지 말라고 전하고 task 커밋은 `advance`가 만든다고 적는다. coordinator Output contract는 커밋 내용 주장에 `git show --stat` 같은 확인 명령과 발췌를 요구하고, 확인하지 못한 주장은 `미확인`으로 쓰게 한다. implementer Checklist coverage는 Constraints 항목마다 한 줄을 요구한다. `agent-dispatch.md`와 `rules/subagent-model.md`는 `codex-agents check`와 mismatch 재시드를 Codex 호스트의 named 디스패치로 한정한다.
- 알려진 한계: 정규화로만 합쳐지는 표기(`src/auth/`와 `./src/auth`)의 중복 제거를 직접 단언하는 테스트는 아직 없다.

## Quiz

1. 직전 범위가 `['src/auth/']`일 때 `coordinate revise --paths src/session/`(`--replace` 없음)의 결과 범위는?
   - A) `['src/session/']`
   - B) `['src/auth/', 'src/session/']`
   - C) `scope-paths-required` 오류
2. `coordinate revise --paths src/session/ --replace x`를 실행하면?
   - A) `x`가 무시되고 교체가 켜진다
   - B) `x`가 경로로 추가된다
   - C) usage 오류(exit 2)로 거절된다
3. `scope-paths-dropped` 경고는 언제 나오나?
   - A) `--replace`로 줄어든 경로가 있을 때만
   - B) 결과 범위가 직전보다 작아지면 항상
   - C) 합집합 기본 호출에서 중복이 제거될 때
4. `codex-agents check`와 `in_sync` 조건은 누구에게 적용되나?
   - A) Claude Code와 Cursor
   - B) Codex 호스트에서 named 디스패치할 때만
   - C) 모든 호스트의 named 디스패치

## Tasks

### drive-execution/retro-friction-and-revise-union/001 · `7773a058`

#### Goal & intent

retro 후보 1~4를 문서에서 막는다. (1) direct-run implement 디스패치가 커밋 금지와 advance 커밋을 말하고 accepted 점검 문구가 advance가 만든 task 커밋을 가리킨다. (2) coordinator Output contract가 커밋 내용 주장에 확인 명령과 결과 발췌를 요구한다. (3) implementer Checklist coverage가 brief Constraints 항목별 대응 한 줄을 요구한다. (4) `codex-agents check`와 mismatch 재시드가 Codex 호스트 named 디스패치 한정임을 밝힌다. 검증 명령은 frontmatter `verify`이며 Checklist 마지막 항목에 적는다.

#### Current behavior

- `skills/bouncer-run/references/direct-run.md:19` implement 행은 worker에게 커밋하지 말라는 말이 없다. `:31-36`은 accepted 전에 "the worker commit exists (HEAD past `integrationHead`, `commit_sha` equal to HEAD's first 8 characters, ...)"를 확인하라고 쓴다. 이 커밋은 worker가 만든 것이 아니라 `coordinate advance`가 `bouncer commit`으로 만든 `Bouncer-Task` trailer 커밋이다(`references/coordinator-cards/report.md:20`, `agents/bouncer-coordinator.md:259-266`). 반면 `agents/bouncer-implementer.md:3`(frontmatter description)과 본문은 "Do not commit"이라 문구가 어긋나 보인다. root가 프롬프트에 "commit 하세요"를 써서 trailer 없는 커밋이 생긴 사례가 있다(`coordinate uncommit`으로 복구).
- `agents/bouncer-coordinator.md:331` 이하 `## Output contract`에는 커밋에 어떤 경로가 들어갔는지에 대한 주장의 근거 규칙이 없다.
- `agents/bouncer-implementer.md:216` 근처 `Checklist coverage` bullet은 Checklist 항목별 done/not done과 위치만 요구한다. `해당 없음:`은 이미 같은 파일 `:227` Red run bullet에 있어, 파일 전체를 대상으로 한 단언은 지금도 통과한다. 보고 template(첫 ```markdown 블록)의 섹션 목록은 `test/agents.test.js:309`가 고정한다.
- `skills/bouncer-run/references/agent-dispatch.md:52-58` Named implementer 절은 호스트 구분 없이 "Before a new named dispatch, run `bouncer codex-agents check`"로 시작해 "Compact input is allowed only when the JSON reports `in_sync: true`"라고 쓴다. 그래서 모든 호스트가 점검 대상처럼 읽힌다. `rules/subagent-model.md:37`은 effort 변경 뒤 mismatch 재시드를 호스트 구분 없이 적는다.
- 재현·확인: `node --test test/agents.test.js test/subagents.test.js test/skill-bouncer-run.test.js`가 현재 통과한다. 새 문구 단언은 아직 없다.

#### Target behavior

- 성공: 위 목표 (1)~(4) 문구가 해당 문서에 들어가고, `.codex/agents/*.toml`이 `agents/*.md`의 생성본과 바이트 일치한다. 새 문구는 `test/skill-bouncer-run.test.js`(direct-run)와 `test/agents.test.js`(coordinator·implementer)가 단언한다.
- 실패 경로: 문구가 빠지거나 생성 TOML이 어긋나면 위 두 테스트가 실패한다.
- 보존: implementer 보고 template의 `##` 섹션 목록·순서, `rules/subagent-model.md` item 1의 고정 문장(`test/subagents.test.js:590-592`), agent-dispatch의 fallback 문장은 바뀌지 않는다. `agent-dispatch.md` Named implementer 절에는 커밋 금지 줄을 넣지 않는다. root 재확인 규칙은 만들지 않는다.

#### Interface

- 제공: 문서 계약 네 가지(런타임 코드 변경 없음).
  - direct-run implement 행: "구현 worker에게 커밋하지 말라고 전하고, 커밋은 `advance`가 만든다"는 취지의 문장. accepted 점검 항목: "worker commit"을 "`advance`가 만든 task 커밋(`Bouncer-Task` trailer 포함)"으로 바꾸고 기존 조건(HEAD가 `integrationHead`를 지남, `commit_sha`가 HEAD 앞 8자, scope 안 dirty 없음)은 유지한다.
  - coordinator Output contract: 어떤 경로가 어느 커밋에 들어갔다/안 들어갔다는 주장은 `git show --stat <sha>` 같은 확인 명령과 그 결과 발췌를 함께 쓰고, 확인하지 못한 주장은 `미확인`이라고 쓴다.
  - implementer Checklist coverage: brief Constraints 항목마다 한 줄. 그 항목을 단언하는 테스트 `file:line` 또는 `해당 없음: <이유>`.
  - agent-dispatch.md Named implementer(`:52-58`)와 subagent-model.md `codex-agents check`/mismatch 문장(`:37`): 점검과 `in_sync` 조건은 Codex 호스트에서 named 디스패치할 때만 적용한다. 읽는 법은 호스트별로 다음과 같다. Codex는 `in_sync: true`일 때만 compact input을 쓴다(지금 문장 그대로). Claude Code와 Cursor는 점검 없이 compact input으로 named 디스패치한다. Codex로 식별되지 않은 호스트도 점검 대상이 아니라 Claude Code·Cursor와 같다.
- 거부: implementer 보고에 새 `##` 섹션을 만들지 않는다. coordinator 규칙은 root 재확인을 요구하지 않는다. 용어 `Constraints 항목`은 brief `## Constraints`의 bullet 한 개다(예: "`timeout_ms` 부재 동작은 이전과 같아야 한다.").

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/direct-run.md` | implement 행, accepted 점검 문단 | Modify | direct 실행 절차 | 커밋 금지·advance 커밋 명시, 점검 문구 정정 | `direct-run.md:19`, `:31-36`. 같은 "worker commit" 표현이 `references/coordinator-cards/report.md:16,20`과 `agents/bouncer-coordinator.md:350`에도 있으나 고치지 않는다. report.md는 worker cwd에서 advance가 만든 task 커밋 상태를, coordinator.md:350은 worker 브랜치 SHA와 `Bouncer-Worker-Commit` trailer로 연결된 integration SHA의 구분을 뜻해 advance 커밋과 모순되지 않는다. report.md는 affected_paths 밖이다. |
| `agents/bouncer-coordinator.md` | `## Output contract` | Modify | coordinator 보고 필드 | 커밋 내용 주장 근거 규칙 한 줄 | `agents/bouncer-coordinator.md:331` 이하 |
| `agents/bouncer-implementer.md` | `Checklist coverage` bullet | Modify | Checklist 항목별 보고 규칙 | Constraints 항목별 한 줄 규칙 | `agents/bouncer-implementer.md:216`, `test/agents.test.js:309` |
| `skills/bouncer-run/references/agent-dispatch.md` | `## Named implementer` | Modify | named 디스패치 선행 점검 | Codex 호스트 한정 명시 | `agent-dispatch.md:52-58` |
| `rules/subagent-model.md` | effort/mismatch 재시드 문장 | Modify | 호스트별 effort 전달 규칙 | mismatch 재시드가 Codex 한정임을 명시 | `rules/subagent-model.md:37` |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | `agents/bouncer-coordinator.md` 생성본 | md 변경분 재생성 | `test/agents.test.js:57` parity, `scripts/check-emit.js:97` |
| `.codex/agents/bouncer-implementer.toml` | 생성본 | Modify | `agents/bouncer-implementer.md` 생성본 | md 변경분 재생성 | 같은 근거 |
| `test/agents.test.js` | 새 문구 단언 | Modify | 역할 문서 계약 테스트 | coordinator 근거 규칙·implementer Constraints 대응 문구 단언 추가 | `test/agents.test.js:290-309` |
| `test/skill-bouncer-run.test.js` | direct-run 문구 단언 | Modify | run 스킬 문서 계약 테스트 | implement 행 커밋 금지와 accepted 점검 문구 단언 추가 | `test/skill-bouncer-run.test.js:13` |

#### Constraints

- `agents/bouncer-implementer.md` 보고 template의 `##` 섹션 목록과 순서를 바꾸지 않는다(`test/agents.test.js:309` 단언 유지).
- `rules/subagent-model.md` item 1과 fallback 문장(`test/subagents.test.js:590-592`, `:700-730`)은 한 글자도 바꾸지 않는다.
- `references/coordinator-cards/report.md:16,20`과 `agents/bouncer-coordinator.md:350`의 "worker commit" 표현은 바꾸지 않는다(Touch 근거 참조). direct-run.md만 "advance가 만든 task 커밋"으로 정정한다.
- agent-dispatch.md Named implementer의 `in_sync` 조건은 Codex 호스트에만 걸린다고 읽혀야 한다. Claude Code·Cursor·그 밖의 호스트에 점검을 요구하는 문장이 남아서는 안 된다.
- agent-dispatch.md Named implementer에는 커밋 금지 줄을 추가하지 않는다. 그 근거는 생성된 역할 파일이 이미 "Do not commit"을 갖고, 사고 원인이 root의 direct-run 프롬프트였다는 점이다.
- 기존 단언은 바꾸지 않고 새 `test(...)`만 추가한다.
- `.codex/agents/*.toml`은 손으로 편집하지 않고 `mdToCodexToml`로 재생성한다.
- 역할 문서는 `Authority`, `Hard guards`, `Output contract` 순서와 Output contract로 끝나는 구조를 유지한다(`scripts/check-doc-shape.js`).

### drive-execution/retro-friction-and-revise-union/002 · `28ce0fcb`

#### Goal & intent

`bouncer coordinate revise`의 기본을 "직전 scope ∪ `--paths` ∪ `--new-path`"(넓히기만)로 바꾸고, 교체는 새 boolean 플래그 `--replace`로만 허용한다. `scope-paths-dropped` 경고는 `--replace`일 때만 낸다. 이미 전체 집합을 넘기던 호출은 결과가 같다. out-of-bounds, 추적, Do not touch 검사는 바뀌지 않는다. 검증 명령은 frontmatter `verify`이며 Checklist 마지막 항목에 적는다.

#### Current behavior

- `packages/cli/src/scope.ts:962-965`: `next = [...new Set([...existing, ...created])]`가 최종 scope이고 비면 `scope-paths-required`다. 직전 scope(`previous`, `:997`)는 잠금 안에서만 읽으며 합치지 않는다.
- `scope.ts:1102-1116`: `previous` 중 `next`가 덮지 못한 경로를 `dropped`로 모아 `warnings: [{ code: 'scope-paths-dropped', paths }]`를 항상 붙인다.
- `packages/cli/src/cli-git-commands.ts:671-683`: `--new-path`와 `--release-do-not-touch`의 값 없는 발생을 usage(2)로 거절한다. `coordinateRevise`(`:731` 이하)가 `reviseTaskScope`에 `paths`, `newPaths`, `releaseDoNotTouch`, `reason`을 넘긴다. `--replace`는 모른다.
- 도움말·문서가 "replaces the whole scope with exactly the given set"을 말한다: `cli-usage.ts:17`, `:58`, `references/coordinator-cards/revise.md:12`, `agents/bouncer-coordinator.md:83`(와 TOML `:84`). `coordinator-commands.ts:1731`의 `scope-paths-required` next는 "full replacement scope"를 안내한다. `rules/cli.md:270`은 사용법, `:422-440`은 거절·경고 규칙이다.
- 기존 단언: `test/cli-coordinate.test.js:427`은 축소 시 `scope-paths-dropped`를 기대한다. `test/commit-task.test.js:644,663`도 축소·축소 경고를 기대한다. `test/cli-validate.test.js:428`은 `paths: ['src/session/']` 호출 뒤 `src/auth/login.ts`에 G17을 기대한다(`:437-448`).
- 재현: `node --test test/cli-coordinate.test.js test/commit-task.test.js test/cli-help.test.js test/cli-validate.test.js`가 현재 통과한다(빌드된 `packages/cli/dist` 필요, 빌드는 drive 환경 몫).
- I/O 관찰 지점: `reviseTaskScope`는 `lockedTaskWrite` 안에서 task 문서(`fs.writeFileSync`, `scope.ts:1062` 근처)와 원장(`writeLedger`)을 쓴다.

#### Target behavior

- 성공: 기본 호출의 `paths`는 직전 scope, `--paths`, `--new-path` 순서의 합집합이며 `normalizeScopeEntry` 기준 중복은 한 번만 둔다. `--replace`를 주면 `--paths ∪ --new-path`로 교체한다. `warnings`는 `--replace`로 줄어든 경로가 있을 때만 `scope-paths-dropped`를 낸다.
- 실패:
  - `--replace=x`처럼 등호로 붙인 형태는 알 수 없는 플래그라 기존 플래그 처리 그대로 무시되고 교체가 켜지지 않는다. 값 검사는 `--replace` 토큰 바로 뒤가 `--`로 시작하지 않는 값일 때만 usage(2)다. `--replace`를 여러 번 줘도 교체 한 번과 같다. 값 없이 단독으로 쓴 `--replace` 토큰이 교체 의도다.
  - `--paths`와 `--new-path`가 모두 비면 `--replace` 여부와 무관하게 `scope-paths-required`다.
  - `--replace`에 값이 붙으면 usage 오류(exit 2)다.
  - 이미 있는 거절(glob, out-of-bounds, untracked, parent-missing, Do not touch 충돌, unknown 해제, lock 상실)은 기존 순서·코드 그대로다.
- 보존: 합집합은 `lockedTaskWrite` 잠금 안에서 `previous`를 읽은 같은 `entry`로 만든다(별도 읽기·잠금 밖 계산 없음). 직전 scope가 원장에 없으면 선언 `affected_paths`가 `previous`다. `entry.scope.paths`가 빈 배열이면 선언 경로로 되돌아가지 않고 빈 `previous`로 둔다(지금 `entry.scope ? entry.scope.paths : declared` 그대로). 합집합이 `previous`와 같으면(추가 없음) 기존처럼 revision이 오르고 `warnings` 키는 없다. 충돌 검사의 "새 경로"(직전 scope에 없던 경로) 기준과 lease 충돌 revoke 로직은 그대로다. `--replace`와 `--release-do-not-touch`는 함께 쓸 수 있다.

#### Interface

- 제공:
  - `reviseTaskScope({ ..., replace?: boolean })`. `replace === true`일 때만 교체한다.
  - CLI: `bouncer coordinate revise ... [--replace]`. 값 없는 boolean이다.
  - 성공 결과의 키는 그대로다. `warnings`는 `--replace`일 때만 나올 수 있다.
  ```text
  next = replace ? unique(paths ++ newPaths) : unique(previous ++ paths ++ newPaths)
  ```
- 거부 (throw·exit): `--replace <값>`은 usage 오류(exit 2, `coordinate revise: --replace takes no value`). 빈 입력은 `scope-paths-required`(exit 1, stdout JSON에 `cause`·`next`).
- fallback: 직전 scope 없음 → 선언 `affected_paths`를 `previous`로 쓴다. 별칭 플래그는 두지 않는다.
- 용어: `previous` = 직전 승인 scope(원장 `entry.scope.paths`, 없으면 선언 경로). 예: 직전 `['src/auth/']` + `--paths src/session/` → `['src/auth/', 'src/session/']`, 같은 호출에 `--replace`를 더하면 `['src/session/']`과 `scope-paths-dropped: ['src/auth/']`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/scope.ts` | `reviseTaskScope` | Modify | `--paths ∪ --new-path`로 교체, 줄면 항상 경고 | `replace` 인자, 합집합 기본값, 경고를 replace일 때만 | `scope.ts:948-1116`, 호출부 `test/*.js` 54건(commit-task) 등 |
| `packages/cli/src/cli-git-commands.ts` | `coordinateRevise`, revise 플래그 검사 | Modify | revise 인자 파싱 | `--replace` boolean 전달, 값 붙으면 usage(2) | `cli-git-commands.ts:671-683`, `:731-753` |
| `packages/cli/src/cli-usage.ts` | `coordinate` 요약, `revise` 사용법 | Modify | 교체 의미 안내 | 합집합 기본·`--replace` 안내 | `cli-usage.ts:17`, `:58`, `test/cli-help.test.js` |
| `packages/cli/src/coordinator-commands.ts` | `scope-paths-required` hint | Modify | "full replacement scope" 안내 | 합집합 의미의 안내 | `coordinator-commands.ts:1731` |
| `rules/cli.md` | revise 사용법·규칙 | Modify | 교체·경고 규칙 서술 | `--replace`, 합집합 기본, 경고 조건 서술 | `rules/cli.md:270`, `:422-440` |
| `references/coordinator-cards/revise.md` | 교체 의미 문구 | Modify | `--paths` 교체 안내 | 합집합 기본·`--replace` 안내 | `revise.md:12` |
| `agents/bouncer-coordinator.md` | scope drift revise 문구 | Modify | `--paths` 교체 안내 | 같은 문구로 정정 | `agents/bouncer-coordinator.md:83` |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | md 생성본 | md 변경분 재생성 | `test/agents.test.js:57` parity |
| `test/cli-coordinate.test.js` | 축소 경고 테스트 | Modify | 축소 시 경고 단언 | 기본 합집합·`--replace` 경고·`--replace <값>` usage 단언 | `test/cli-coordinate.test.js:427-470` |
| `test/commit-task.test.js` | `reviseTaskScope` 축소 단언 | Modify | 교체 의미 단언 | 합집합 기본·replace 교체·경고 조건 | `test/commit-task.test.js:644`, `:663` |
| `test/cli-help.test.js` | revise 사용법 단언 | Modify | 도움말 내용 단언 | `--replace` 문구 단언 | `test/cli-help.test.js` revise 사례 |
| `test/cli-validate.test.js` | commit 게이트 revised scope 테스트 | Modify | 교체 후 G17 단언 | `:428` 호출에 `replace: true`만 추가 | `test/cli-validate.test.js:374-448` |

#### Constraints

- out-of-bounds, 추적, Do not touch 충돌, lease 충돌 검사의 판정·순서·거절 코드는 바꾸지 않는다. out-of-bounds의 직전 scope 면제는 유지한다.
- glob·추적 검사는 플래그로 받은 값(`existing`, `created`)에만 건다. 직전 scope의 항목에는 새로 걸지 않는다.
- 기존 호출이 전체 집합을 넘기면 결과(`paths`, 원장 decision의 `next`)가 이전과 같아야 한다.
- 기존 단언 변경은 아래로 한정한다.
  - `test/commit-task.test.js:648-668` 한 테스트의 호출 네 개. `again`(`paths: ['src/auth/']`, 직전 `['src/auth/','src/session/']`)과 `child`(`paths: ['src/auth/']`, 직전 `['src/auth/','src/']`)에는 `replace: true`를 더하고, 기대값 `warnings`(`again`은 `paths: ['src/session/']`, `child`는 `paths: ['src/']`)와 `again.revision === 'r2'`는 그대로다. `same`(`['src/auth/']`)과 `parent`(`['src/']`)는 `replace`를 주지 않고 `ok === true`, `!('warnings' in ...)`가 그대로다. 첫 `reviseTaskScope`(`['src/auth/','src/session/']`, `revision r1`, 경고 키 없음)와 `:668` 빈 previous 테스트(`previous` `[]`, 경고 없음)도 그대로 통과해야 하며 고치지 않는다.
  - `test/cli-coordinate.test.js:427` 테스트는 이름 그대로 두고 두 번째 호출(`--paths src/auth/`)에 `--replace`를 더한다. 기대 `warnings`는 `[{ code: 'scope-paths-dropped', paths: ['src/session/'] }]` 그대로다. 합집합 기본 시나리오는 새 `test(...)`로 추가한다.
  - `test/cli-validate.test.js:428` 호출에는 `replace: true`만 더하며 테스트 이름과 G17 기대값(`src/auth/login.ts`)은 그대로다.
- 해제(`--release-do-not-touch`)의 정규화와 본문 편집 규칙은 바뀌지 않는다.
- `--replace` 문구는 `--paths`와 `--new-path`, `scope-paths-dropped`를 설명하는 네 문서(`cli-usage.ts`, `rules/cli.md`, `revise.md`, `agents/bouncer-coordinator.md`)에서 같은 의미로 쓴다.

### drive-execution/retro-friction-and-revise-union/003

#### Goal & intent

TASKS-001과 TASKS-002가 통합된 뒤 `npm run ci`가 통과함을 종단에서 한 번 증명한다. 성공 조건은 명령 exit 0이다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/retro-friction-and-revise-union/004 · `11e0c2f5`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-SS-001 (minor, spec, must_fix) — skills/bouncer-run/references/agent-dispatch.md#Named implementer — tasks/001 Constraints

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `skills/bouncer-run/references/agent-dispatch.md` — 기록된 리뷰 finding을 수정한다.
- Modify `test/skill-bouncer-run.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.