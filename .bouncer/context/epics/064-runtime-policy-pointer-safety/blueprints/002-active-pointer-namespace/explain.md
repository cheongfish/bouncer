---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/064-runtime-policy-pointer-safety/blueprints/002-active-pointer-namespace/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-07T12:29:24.554+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '064'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 3b3ca10e9419149e3ff3eaa22b0424827a5eff24
      diff_sha: ceab85c457e896720c41f78c553d465dada58c26b8a9e3076e2645ef6b68d984
      quiz_score: 2/4
      disposition: 기본 --set의 병렬 추가와 nested worktree 키 선택에서 오답. 점수는 기록만 하고 마감.
      recorded_at: '2026-09-07T12:31:39+09:00'
  task_commits:
    - id: '001'
      sha: 6d3011e0
    - id: '002'
      sha: 58b310b8
    - id: '003'
      sha: 3b3ca10e
---
# Explain

## Background

linked execute worktree가 Git common directory의 포인터 파일 하나를 공유했다. 한 워크플로가 `current --set`을 하면 다른 워크트리의 활성 blueprint가 바뀌었다. 이 블루프린트는 포인터를 `pointers/<epic-id>/<blueprint-id>.json`으로 나누고, cwd가 가리키는 키만 읽게 한다. 레거시 `<git-common-dir>/bouncer/current`는 첫 쓰기에서 같은 blueprint면 옮기고, 다른 blueprint면 손대지 않는다.

## Intuition

복도에 사물함 하나를 두고 방이 서로 덮어쓰는 대신, 방 번호마다 칸을 둔다. 기준 checkout에 칸이 여러 개면 고르지 않고 목록을 내놓고 멈춘다.

## Code

선택과 이관은 `scripts/src/lib/current.ts`의 `resolveCurrent` / `writeCurrent` / `readCurrent`다. 경로·원자적 쓰기는 `scripts/src/lib/runtime-state.ts`다. CLI 렌더와 `--replace`는 `scripts/src/lib/cli-current-command.ts`다. 워크플로는 `bouncer current`만 쓰라는 계약이 `rules/current-pointer.md`와 plan/execute 스킬에 있다. 위치별 동작은 `test/current.test.js`와 `test/cli-current.test.js`를 보면 된다.

## Quiz

1. namespace 전환 뒤 기준 checkout에서 기본 `current --set`이 다른 blueprint를 가리키면?

- A) `--replace`가 없으면 종료 코드 2로 거절하고 파일을 보존한다
- B) 대상 키만 추가·갱신하고 다른 키는 그대로 둔다
- C) 선택된 키를 지운 뒤 대상 키를 쓴다

2. 기준 checkout에 namespace 포인터가 둘 이상이면 `resolveCurrent`는?

- A) blueprint 경로 사전식 순으로 첫 포인터를 고른다
- B) 두 포인터를 하나로 합친다
- C) `CURRENT_AMBIGUOUS`와 정렬된 후보를 내고 상태를 바꾸지 않는다

3. cwd가 `.worktrees/<epic-id>/<blueprint-id>`인 execute worktree는?

- A) 그 epic·blueprint 키만 선택한다
- B) 기준 checkout처럼 모든 namespace 포인터를 본다
- C) 항상 레거시 `bouncer/current`만 읽는다

4. 레거시 파일만 있고 같은 blueprint로 첫 `writeCurrent`를 할 때 레거시 삭제가 실패하면?

- A) 레거시를 먼저 지운 뒤 namespace를 써서, 실패 시 namespace만 남는다
- B) 두 파일을 그대로 두고 다음 호출이 추측으로 하나를 고른다
- C) namespace를 쓴 뒤 레거시 삭제를 시도하고, 실패면 `CURRENT_MIGRATION_INCOMPLETE`로 둘 다 보존한다

## 이해 상태

퀴즈 4문항, 응답 4, 정답 2 → `quiz_score: 2/4`.

1. 정답 B (대상 키만 추가·갱신). 응답 A. 오답.
2. 정답 C (`CURRENT_AMBIGUOUS`). 응답 C. 정답.
3. 정답 A (해당 epic·blueprint 키만). 응답 B. 오답.
4. 정답 C (`CURRENT_MIGRATION_INCOMPLETE`로 둘 다 보존). 응답 C. 정답.

disposition: 기본 `--set`의 병렬 추가와 nested worktree 키 선택에서 오답. 점수는 기록만 하고 마감.

## Tasks

### Task 001

#### Goal & intent

namespace 전환 전에 `current --set`이 다른 활성 blueprint를 발견하면 기존 상태를 보존하고 거절한다. 사용자가 `--replace`를 명시한 경우에만 교체하며, 두 경로 모두 교체 전 포인터를 진단에 남긴다.

#### Interface

- 제공: `bouncer current --set <blueprint> [--replace]`를 제공한다. 대상이 현재 blueprint와 같으면 `--replace` 없이 task/base 갱신을 허용한다.
- 제공: 다른 활성 blueprint를 교체한 성공 payload와 stderr에는 교체 전 `previous` 포인터의 `{ blueprint, base, task }`를 싣는다.
- 거부: 다른 활성 blueprint가 있는데 `--replace`가 없으면 종료 코드 2로 끝내고, stdout JSON과 stderr에 기존 포인터를 표시하며 plan gate·task 해석·포인터 쓰기를 실행하지 않는다.
- 거부: `--replace`를 `--set` 없이 쓰거나 `--clear`와 함께 쓰면 사용법 오류로 종료한다.

#### Do not touch

- `scripts/src/lib/runtime-state.ts` — namespace 저장과 레거시 이관은 Task 002에서 구현한다.
- `scripts/src/lib/current.ts` — 포인터 선택 정책은 Task 002에서 변경한다.
- `skills/bouncer-plan/SKILL.md` — 시작 경고와 최종 namespace 안내는 Task 003에서 전환한다.
- `skills/bouncer-execute/SKILL.md` — 실행 위치별 포인터 안내는 Task 003에서 전환한다.

### Task 002

#### Goal & intent

포인터를 epic·blueprint id별 파일로 저장해 같은 Git common directory 안에서 여러 실행 주기를 유지한다. execute worktree는 자신에게 대응하는 포인터만 읽고, 기준 checkout의 다중 후보와 레거시 충돌은 명시적으로 중단한다.

#### Interface

- 제공: runtime state가 `<git-common-dir>/bouncer/pointers/<epic-id>/<blueprint-id>.json` 경로를 계산하고 이름공간 포인터를 열거·읽기·쓰기·삭제한다. 파일 본문은 `{ blueprint, base, task? }`를 유지한다.
- 제공: 이름공간 전환 뒤 기본 `current --set`은 대상 키만 추가·갱신하고 다른 키를 보존한다. `--replace`는 현재 위치에서 유일하게 선택된 키를 지운 뒤 대상 키를 쓰며, 지운 `previous`를 계속 보고한다.
- 제공: `resolveCurrent({ repoRoot, deps })`는 다음 union을 반환한다. `selected.current`와 `ambiguous.candidates[]`는 저장 구조 `{ blueprint, base, task: string | null }`이며 `scale`이나 CLI 표시용 task 객체를 넣지 않는다.
  ```ts
  type CurrentResolution =
    | { status: 'selected'; current: Pointer; source: 'namespace' | 'legacy'; key: string | null }
    | { status: 'empty' }
    | { status: 'ambiguous'; candidates: Pointer[] }
    | { status: 'invalid'; issues: Array<{ path: string; reason: string }>; candidates: Pointer[] };
  ```
- 제공: 호환 wrapper `readCurrent({ repoRoot, deps })`는 `selected`에서 `Pointer`, `empty`에서 `null`을 반환한다. `ambiguous`와 `invalid`에서는 각각 code `CURRENT_AMBIGUOUS`, `CURRENT_INVALID`인 `CurrentSelectionError`를 throw하며 `candidates`와 `issues`를 보존한다.
- 제공: `resolveCurrent`는 중첩 `.worktrees/<epic-id>/<blueprint-id>` cwd에서 같은 키만 선택한다. 레거시 평면 worktree는 `worktreePathFor`가 정확히 하나의 후보와 일치할 때만 그 포인터를 선택한다.
- 제공: 기준 checkout은 namespace 포인터가 하나면 기존처럼 반환한다. 둘 이상이면 정렬된 `{ blueprint, base, task }` 후보를 담은 구조화된 모호성 결과를 호출부에 제공한다.
- 제공: 레거시 `<git-common-dir>/bouncer/current`는 namespace가 없을 때 읽는다. 첫 `writeCurrent`는 같은 blueprint의 레거시 상태를 namespace 파일로 쓴 뒤 레거시 파일을 지운다.
- 거부: blueprint 경로에서 세 자리 epic·blueprint id를 얻지 못한 쓰기, 다중 포인터 base 읽기, 서로 다른 legacy·namespace 공존, 중복 id의 평면 worktree 선택, 부분 이관을 거부한다.

#### Do not touch

- `scripts/src/lib/verification.ts` — 포인터 선택 결과를 소비하는 검증 계약은 유지하고 통합 테스트로 격리만 확인한다.
- `scripts/src/lib/commit-hook.ts` — commit scope 판정은 유지하고 통합 테스트로 격리만 확인한다.
- `scripts/src/lib/paths.ts` — 기존 `parsePathIds`를 재사용하며 새 식별자 파서를 만들지 않는다.
- `scripts/src/lib/seed-worktree.ts` — worktree seed와 config 복사 계약은 변경하지 않는다.

### Task 003

#### Goal & intent

모든 워크플로와 사용자 문서가 namespace 포인터의 위치별 선택·모호성 실패·레거시 이관 계약을 같은 말로 설명한다. `/bouncer-plan`과 `/bouncer-execute`는 시작 시 선택된 활성 작업과 Git common directory 공유 범위를 알려 사용자가 병렬 상태를 식별하게 한다.

#### Interface

- 제공: `rules/current-pointer.md`가 CLI만을 포인터 선택 정본으로 유지하면서 worktree-local 선택, base 단일 선택, 다중 후보 중단, clear 범위와 레거시 이관을 규정한다.
- 제공: `/bouncer-plan` preflight와 `/bouncer-execute` 포인터 읽기는 현재 선택된 `{ blueprint, task, base }`와 “Git common directory에는 다른 namespace 포인터가 있을 수 있음”을 간결한 한 줄로 표시한다.
- 제공: CLI·상태 버전·진단 문서는 `pointers/<epic>/<blueprint>.json`, 후보 JSON, 레거시 전환과 B11 해소를 설명한다.
- 거부: 워크플로가 포인터 파일을 직접 열거나 후보 중 하나를 추측하는 안내, base의 다중 후보를 `null`로 취급하는 안내, linked worktree 전체가 한 포인터를 공유한다는 이전 문구를 남기지 않는다.

#### Do not touch

- `scripts/src/lib/runtime-state.ts` — 최종 runtime 동작은 Task 002에서 완료한다.
- `scripts/src/lib/current.ts` — 위치별 선택과 레거시 이관은 Task 002에서 완료한다.
- `skills/bouncer-run/SKILL.md` — 같은 execute worktree에서 다음 task로 이동하는 기존 계약은 공유 규칙만으로 유효하다.
- `skills/bouncer-commit/SKILL.md` — 같은 blueprint 안의 confirm-then-set 계약은 바뀌지 않는다.
- `skills/bouncer-finalize/SKILL.md` — finalize의 clear와 다음 blueprint ACQ 순서는 바뀌지 않는다.