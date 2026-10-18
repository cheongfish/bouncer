---
type: bouncer.tasks
title: 포인터 설정 모호성 사전 거절 추가
description: Make current --set refuse a write that would leave the base checkout with an ambiguous selection.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
  - pointer
  - current
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: TASKS-004
  epic_id: '112'
  blueprint_id: '001'
  status: verified
  execution_kind: commit
  depends_on: []
  parallel_safe: true
  dependency_gate: integrated
  verify: node --test test/cli-current.test.js test/current.test.js test/cli-help.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/cli-current-command.ts
    - scripts/src/lib/current.ts
    - test/cli-current.test.js
    - test/current.test.js
    - test/cli-help.test.js
    - rules/current-pointer.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-finalize/references/cleanup-handoff.md
  commit_intent:
    - 새 blueprint 활성화 때 이전 포인터가 남아 base checkout이 CURRENT_AMBIGUOUS가 되던 문제를 설정 시점에 막음.
  commit_summary:
    - current --set이 base 선택을 모호하게 만들면 아무것도 바꾸지 않고 거절하며, --replace와 새 --keep-others 중 하나를 명시하게 함.
  commit_sha: 9f50a102
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
base checkout에서 `bouncer current --set`이 새 namespace key를 더해 선택을 모호하게 만들면 쓰기 전에 거절한다. 사용자는 `--replace`(교체)와 `--keep-others`(병렬 유지) 중 하나를 명시해야 한다. `CURRENT_AMBIGUOUS` 출력에는 `next`가 붙는다. 수용 기준은 epic Success criteria 7이고, 완료 명령은 frontmatter `verify`다.

## Current behavior
- `cmdCurrent`(`scripts/src/lib/cli-current-command.ts:126`)는 `:130-134`에서 플래그를 읽는다. `--keep-others`는 없다. 배타 검사는 `:138-157`(exit 2)이다.
- `resolveCurrent`(`:185`)가 ambiguous를 내면 `--replace`일 때만 exit 1로 멈춘다(`:189-193`). plain `--set`은 plan gate(`:199`)를 거쳐 `writeCurrent`(`scripts/src/lib/current.ts:358`, `replace:false`, `:270-277`)로 key를 더한다.
- 주석 `:292-293`은 쓰기 뒤 base가 모호해진다는 사실을 알면서 다시 판정하지 않는다고 적는다. 성공 출력은 `{ok, current, approval}`(`:304`)다.
- 위치 판정(`current.ts:290-319`):
  - nested worktree는 자기 key만 본다(`:291-295`).
  - flat worktree는 `worktreePathFor`로 고른다(`:296-313`).
  - base는 key가 정확히 하나일 때만 선택한다(`:316-319`).
- `emitSelectionFailure`(`cli-current-command.ts:84-97`)의 출력은 `{ok:false, reason, candidates?, issues?}`다. `next`가 없다.
- usage는 `:329-336`에 있다. `rules/cli.md:103`의 current 항목은 같은 파일을 고치는 TASKS-005가 반영한다.
- 문서:
  - `rules/current-pointer.md:43-50`: "Default `--set` adds or updates ... leaves other keys in place".
  - `:67-69`: finalize handoff.
  - `skills/bouncer-plan/SKILL.md:261-266`(step 7)은 plain `--set`이다.
  - `skills/bouncer-finalize/references/cleanup-handoff.md:25`, `skills/bouncer-finalize/SKILL.md:94-99`: handoff `--set`.
- 내부 production 호출부는 `writeCurrent` 한 곳뿐이다(`cli-current-command.ts:270`). 테스트·finalize fixture는 library `writeCurrent`를 직접 쓴다. 따라서 가드를 CLI에 두면 그 fixture는 영향받지 않는다.
- 관찰된 사례: 111/002 활성화 때 111/001 key가 남아 base가 `CURRENT_AMBIGUOUS`가 됐다. 사용자가 승인한 제거로 해소했다(`docs/reviews/2026-10-18-context-ontology-cli-integration.md:56`).
- 테스트: `test/cli-current.test.js:496`·`:613`은 base에서 병렬 `--set`이 exit 0이라고 단언한다. `:515`(`--replace`), `:543`(같은 key 갱신), `:571`(usage), `:652`·`:673`(ambiguous)이 있다. `test/cli-help.test.js:151`은 usage regex다.

## Target behavior
- 성공:
  - key가 없는 base에서 `--set` → 지금과 같다.
  - 대상 key가 이미 있으면(같은 key 갱신, `--task` 이동) 다른 key와 무관하게 지금과 같다.
  - nested·flat worktree의 `--set` → 지금과 같다.
  - `--keep-others` → 지금의 plain `--set`과 같이 key를 더하고, 성공 출력에 `others: [{ blueprint }]`를 싣는다.
  - `--replace` → 지금과 같다.
- 실패:
  - base 위치이고, 대상 key가 새로 생기고, 쓰기 뒤 namespace key가 2개 이상이 되며, `--replace`·`--keep-others`가 없음 → `CURRENT_WOULD_BE_AMBIGUOUS`(exit 1). 포인터 파일은 그대로다. 출력은 `{ ok:false, reason, candidates, next }`이고, `next`는 `--replace`(기존 key가 하나일 때만)와 `--keep-others` 명령 문자열 배열이다. 이 검사는 plan gate보다 먼저 실행한다.
  - `CURRENT_AMBIGUOUS` 출력에 `next` 배열을 추가한다. 내용은 "후보 worktree에서 실행하거나 사용자가 고른 key를 `--replace`로 교체"다. `CURRENT_INVALID`는 `next` 없이 지금과 같다.
- 사용법 exit 2: `--keep-others`를 `--replace`·`--clear`와 같이 쓰거나, `--set` 없이 쓰는 경우.
- 문서 계약:
  - plan step 7은 `CURRENT_WOULD_BE_AMBIGUOUS`를 받으면 기존 ACQ 흐름 안에서 `--replace`/`--keep-others`/중단을 사용자에게 묻는다. 묵시적으로 고르지 않는다.
  - finalize next-blueprint handoff는 이 거절을 받으면 묻지 않고 code를 보고하고 멈춘다. 포인터는 비운 채로 둔다.

## Interface
- 제공:
  - `bouncer current --set <bp> [--task <NNN>] [--keep-others]`.
  - reason `CURRENT_WOULD_BE_AMBIGUOUS`.
  - 실패 출력 필드 `next: string[]`(`CURRENT_AMBIGUOUS`, `CURRENT_WOULD_BE_AMBIGUOUS`).
  - 성공 출력의 선택 필드 `others`.
- 거부:
  - 위 실패·사용법 오류.
  - legacy `bouncer/current`와 namespace key가 다르면 지금처럼 `CURRENT_INVALID`다. 일치하는 legacy 파일은 대상 key로 이관되므로 개수에 더하지 않는다.
- 용어:
  - "base 위치"는 `resolveCurrent`의 location kind가 `base`인 경우다. 예: `/home/u/repo` 메인 checkout에서 실행.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-current-command.ts` | `cmdCurrent`, `emitSelectionFailure`, usage | Modify | 포인터 CLI | `--keep-others`, 사전 모호성 검사, `next` 출력, usage | `:126-304`, `:84-97`, `:329-336` |
| `scripts/src/lib/current.ts` | `resolveCurrent` 위치 판정 | Modify | 위치별 선택 | `신규 추출 지점: base 위치와 key 목록 판정 helper` export(동작 불변) | `:244-319` |
| `test/cli-current.test.js` | `--set` 테스트 | Modify | CLI 포인터 동작 | `:496`·`:613` 기대 반전, `--keep-others`·사용법·`next` 케이스 | `:496-697` |
| `test/current.test.js` | 위치 판정 테스트 | Modify | library 동작 | 추출 helper 단위 테스트 | `:728`, `:775` |
| `test/cli-help.test.js` | current usage regex | Modify | help 고정 | `--keep-others` 반영 | `:151` |
| `rules/current-pointer.md` | Moves and clears | Modify | 포인터 이동 규칙 | 기본 `--set` 모호성 거절, `--keep-others`, handoff 처리 | `:43-50`, `:67-69` |
| `skills/bouncer-plan/SKILL.md` | step 7 | Modify | 승인 뒤 활성화 | 거절 시 사용자 선택 절차 | `:261-266` |
| `skills/bouncer-finalize/references/cleanup-handoff.md` | handoff `--set` | Modify | 다음 blueprint 전환 | 거절 시 보고하고 멈춤 | `:25` |

## Do not touch
- `scripts/src/lib/finalize.ts` — `--clear` 소유와 동작은 그대로다.
- `scripts/src/lib/runtime-state.ts` — pointer 파일 형식은 그대로다.
- `scripts/src/lib/coordinator.ts` — TASKS-001~003 범위.
- `skills/bouncer-finalize/SKILL.md` — handoff 세부는 reference가 소유한다.
- `rules/cli.md` — TASKS-001·005와 병렬 충돌을 피하려고 TASKS-005가 current 항목을 반영한다.
- `.worktrees/` — blueprint 111 실행 증적.

## Constraints
- 거절 경로는 포인터 디렉터리의 파일 목록과 바이트를 바꾸지 않는다.
- plan gate 실행·승인 확인(`approval`)과 `--replace` 의미는 바뀌지 않는다.
- library `writeCurrent` 시그니처는 바꾸지 않는다(fixture 호환).
- 문서는 `scripts/check-doc-shape.js`의 `rules/current-pointer.md`·`skills/bouncer-plan/SKILL.md` heading 요구를 유지한다.

## Checklist
- [ ] `npm run build`.
- [ ] 실패 테스트 작성: base에 key A가 있을 때 `current --set B`가 exit 1, `reason: 'CURRENT_WOULD_BE_AMBIGUOUS'`, `next`에 `--replace`·`--keep-others`를 포함해야 한다. pointers 디렉터리 목록·바이트가 같아야 한다. 이어서 `--set B --keep-others`는 exit 0이고 key 두 개가 남는다.
- [ ] 위 테스트가 exit 0으로 실패하는지 확인한다.
- [ ] 위치 helper를 추출하고 CLI 사전 검사를 plan gate 앞에 둔다. 배타 사용법을 추가한다.
- [ ] `:496`·`:613` 기대를 바꾸고, nested worktree sibling 허용과 같은 key `--task` 갱신 허용 테스트를 확인한다.
- [ ] `CURRENT_AMBIGUOUS` 출력의 `next` 테스트(`:673`)를 추가한다.
- [ ] 문서 3개를 반영한 뒤 `npm run lint:docs`.
- [ ] 완료 명령: `node --test test/cli-current.test.js test/current.test.js test/cli-help.test.js`.
