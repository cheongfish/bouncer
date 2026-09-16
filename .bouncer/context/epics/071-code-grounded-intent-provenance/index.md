---
type: bouncer.epic
title: 코드 기반 의도 provenance
description: Connects code changes to durable task intent through stable task identifiers and commit provenance.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/index.md
tags:
  - bouncer
  - epic
  - commit-provenance
  - stable-task-id
  - intent
timestamp: '2026-09-14T10:15:00.281+09:00'
bouncer:
  id: '071'
  epic_id: '071'
  status: approved
  supersedes: []
---
# 코드 기반 의도 provenance

## Intent

현재 코드가 왜 그 형태가 되었는지 알려면 변경 커밋과 당시 승인한 Task·Explain을 연결해야 한다. stable Task ID를 Git trailer와 Explain에 보존하고, 현재 함수 정의에서 그 연결을 역추적하는 조회 경로를 제공한다.

## Success criteria

1. 새 commit message에 `Bouncer-Task`와 `Bouncer-Intent` trailer가 각각 한 번 기록된다.
2. dry-run이 표시한 commit message와 실제 Git commit message가 같다.
3. Explain의 새 `task_commits` 행이 stable Task ID와 소문자 8자리 SHA를 보존한다.
4. 기존 `{ id, sha }` Explain 행과 기존 8자리 `commit_sha`를 계속 읽을 수 있다.
5. standalone과 coordinator worker commit이 같은 trailer 규칙을 사용한다.
6. `execution_kind: verification` Task는 commit provenance를 만들지 않는다.
7. coordinator가 worker commit을 cherry-pick한 뒤에도 Task trailer가 유지된다.
8. 고유한 TypeScript 또는 JavaScript 함수명은 현재 source 정의의 경로·qualified name·line range·blob SHA로 해석된다.
9. 동명 source 정의가 둘 이상이면 하나를 추측하지 않고 opaque candidate 목록을 반환한다.
10. TypeScript source와 생성 JavaScript가 겹치면 source를 정본으로 선택하고 generated 후보를 구분한다.
11. 함수 line의 Git commit을 stable Task trailer 또는 Explain SHA 역색인으로 Task·Explain에 연결한다.
12. 후속 변경이 있는 과거 의도는 `possibly-superseded` 또는 `historical`로 구분한다.
13. `unresolved`와 `unlinked`는 계획을 중단시키는 예외가 아니라 exit 0의 상태 payload다.
14. resolver는 candidate를 기본 3개·최대 5개로 제한하고, 반환하는 Explain 선택 본문을 합계 2,000 UTF-8 byte 이하로 자른다.
15. `npm run ci`가 통과한다.
16. 공개 command 목록과 help에 `context-search`가 없고, `bouncer context-search` 호출은 `unknown command`와 종료 코드 2로 끝난다.
17. SessionStart hook과 `graph-sync`가 `graphify-out/context/`와 `graphify-out/context-src/`에 digest나 graph를 만들지 않는다.
18. `graph-sync`의 `graphs[]`는 `source`, `test` 두 행만 반환한다.
19. `graph-suggest`는 context graph 파일을 열지 않고, `candidates`에 `implementation`, `test` 두 키만 반환한다.
20. config에 `context_dirs`가 남아 있어도 source·test build가 성공하고, 새 init config와 `config.example.json`에는 `context_dirs`가 없다.
21. BP 004 closed 뒤 `scripts/src`, `scripts/lib`, `hooks`, `skills`, `rules`, `references`, `agents`, `.codex`, `docs`, `config.example.json`, `README.md`에서 `context-search`, `context-digest`, `context_dirs` 참조가 0건이다. `docs/distill-decommission-audit.md`는 제외한다. `test/`는 부재 단언에 이 문자열을 써야 하므로 대상이 아니다.
22. `skills/bouncer-plan/SKILL.md`, `skills/bouncer-plan/references/*.md`, `references/discovery/index.md`, `references/spec-authoring/index.md`에서 `context-search`, `graphify-out/context`, `scope_evidence` 문자열이 0건이다.
23. `/bouncer-plan` Discover 단계가 scaffold 전에 `bouncer intent --symbol`을 호출하고, `ambiguous`면 `--candidate`로 다시 호출하며, `unresolved`·`unlinked`에서도 다음 단계로 진행한다고 기술한다.
24. `bouncer scaffold blueprint`와 `bouncer scaffold task`가 만든 commit task frontmatter에 `scope_evidence`가 없고, 필수 절과 `affected_paths`·Touch를 채운 task가 `scope_evidence` 없이 plan gate를 통과한다.
25. `bouncer validate`는 G4와 S9를 발행하지 않고, 형식이 깨진 `scope_evidence`나 `graph` 필드가 남은 task 문서도 그 필드 때문에 실패하지 않는다.
26. 빈 `affected_paths`(G5), Touch가 정당화하지 않는 경로(G11), Do not touch와 겹치는 경로(G12)는 계속 plan gate에서 거절된다.
27. `/bouncer-plan`과 scope-confirm reference는 intent·Explain·Graphify 후보로 `affected_paths`를 채우거나 넓히지 않고 사용자가 확정한 값만 기록한다고 기술한다.
28. 반환 타입에 `x is T`·`asserts x is T`를 쓴 TypeScript 파일의 함수도 `bouncer intent`가 source 정의로 찾는다. 이 저장소에서 `node scripts/bouncer intent --symbol isNumericContextId`가 `status: resolved`를 반환하고 `symbol_ref.path`가 `scripts/src/lib/paths.ts`다.
29. 임시 Git 저장소에서 Bouncer 초기화부터 intent 조회, Task commit, Explain provenance, 후속 함수 변경까지 이어지는 종단 회귀가 통과한다.
30. 같은 이름의 source 함수가 둘이면 `bouncer intent`가 `ambiguous`와 opaque candidate 목록을 반환하고, 명시한 candidate만 다시 선택한다.
31. 종단 회귀의 Task commit에는 `Bouncer-Task`와 `Bouncer-Intent` trailer가 각각 한 번 있으며 Explain 행의 stable Task ID와 일치한다.
32. 종단 회귀의 Explain SHA는 소문자 8자리이고 resolver candidate의 commit 좌표는 소문자 40자리다.
33. 같은 함수를 후속 Task commit이 바꾸면 앞선 intent candidate가 `possibly-superseded`로 분류된다.
34. Plan 전제 점검과 SessionStart 경로가 `graphify-out/context/` 또는 `graphify-out/context-src/`를 생성하거나 읽지 않는다.
35. 종단 회귀의 Graphify 결과는 source·test scope만 포함한다.
36. 종단 회귀를 포함한 `npm run ci`가 통과한다.

## Out of scope

- 기존 계획 문서에 남은 `scope_evidence`·`graph` 필드의 일괄 삭제
- 과거 Explain과 commit의 일괄 변환
- 8자리 SHA 계약을 full SHA로 바꾸는 작업
- TypeScript와 JavaScript 밖의 언어, 익명 callback, 계산된 property, runtime 생성 함수 지원

## Blueprints

* [001 Task commit provenance](blueprints/001-task-commit-provenance/index.md) - commit message와 Explain에 stable Task ID 기반 provenance를 기록한다.
* [002 Function intent resolver](blueprints/002-function-intent-resolver/index.md) - 현재 함수 정의에서 Git commit과 연결된 Task·Explain 의도를 역추적한다.
* [003 코드 우선 Plan 전환](blueprints/003-code-first-plan-cutover/index.md) - Plan이 현재 코드와 함수 의도 조회로 근거를 읽고 G4·S9 범위 근거 검사를 없앤다.
* [004 Context graph 제거](blueprints/004-context-graph-removal/index.md) - context graph의 CLI·build·질의·설정·문서 표면을 없애고 Graphify를 source·test 두 scope로 줄인다.
* [005 터미널 의도 provenance 종단 검증](blueprints/005-terminal-verification/index.md) - 임시 Git 저장소에서 함수 선택부터 commit·Explain·후속 intent와 source/test Graphify까지 하나의 종단 회귀로 검증한다.
