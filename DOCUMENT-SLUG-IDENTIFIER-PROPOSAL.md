# 문서 식별자를 slug와 order로 바꾸는 제안

2026년 10월 20일 기준 (요구사항 초안, 사용자 승인 전, 구현 계획 아님)

blueprint 식별자에서 번호를 빼고 slug로 식별하며, 정렬은 frontmatter `order`로 하고, task 커밋의 추적 값도 `epic slug`·`blueprint slug`·`task order`로 저장하도록 바꾸는 요구사항을 기록한다. 도메인 epic 8개를 등록한 뒤([EPIC-CLASSIFICATION-PROPOSAL.md](EPIC-CLASSIFICATION-PROPOSAL.md)) 나온 요청이며, 구현은 별도 계획으로 진행한다.

## 사용자가 정한 것

- blueprint 이름에서 번호를 뺀다.
- blueprint frontmatter에 `order`를 추가한다.
- 번호 제거 범위는 디렉터리 이름과 stable ID(`EPIC-ddd/BP-ddd/TASK-ddd`), trailer를 모두 포함한다.
- 적용 대상은 새 epic(115~122)과 기존 legacy epic 모두다.
- task 커밋은 `epic slug - bp slug - task order`로 저장한다.
- epic 링크 텍스트의 번호는 이미 뺐다(`2003c955`).

## 현재 구조

| 대상 | 현재 형식 | 예 |
| --- | --- | --- |
| epic 디렉터리 | `epics/<ddd>-<slug>/` | `epics/114-consumer-epic-registry/` |
| blueprint 디렉터리 | `blueprints/<ddd>-<slug>/` | `blueprints/003-registry-gates/` |
| task 디렉터리 | `tasks/<ddd>/` | `tasks/001/` |
| stable ID | `EPIC-ddd/BP-ddd/TASK-ddd` | `EPIC-114/BP-003/TASK-001` |
| 커밋 trailer | `Bouncer-Task`, `Bouncer-Intent` | `Bouncer-Task: EPIC-114/BP-003/TASK-001`, `Bouncer-Intent: EPIC-114/BP-003` |
| 통합 브랜치 | `feat/<epic>-<bp>-<slug>` | `feat/114-003-registry-gates` |
| worker 브랜치 | `bouncer/<epic>-<bp>-<task>` | `bouncer/114-003-001` |
| worktree | `.worktrees/<epic>/<bp>/{integration,workers/<task>}` | `.worktrees/114/003/integration` |
| 번호 정규식 | 코드 곳곳의 `\d{3}` 판정 | `STABLE_TASK_RE`, `commit-sha.ts` |

번호를 가정하는 파일은 `scripts/src` 38개, `test` 34개, `rules` 3개, `references` 2개, `skills` 1개다. 저장소 전체 이력에 `Bouncer-Task:` trailer가 있는 커밋이 355개 있다.

## 요구하는 형식 (초안)

| 대상 | 새 형식 | 예 |
| --- | --- | --- |
| blueprint 디렉터리 | `blueprints/<bp-slug>/` | `blueprints/registry-gates/` |
| blueprint 정렬 | frontmatter `bouncer.order` (epic 안에서 유일) | `order: 3` |
| task | `tasks/<order>/`, task order는 blueprint 안 순번 | `tasks/001/` 또는 `tasks/1/` |
| stable ID | `<epic-slug>/<bp-slug>/<task-order>` | `consumer-epic-registry/registry-gates/1` |
| 커밋 trailer | 같은 값으로 저장 | `Bouncer-Task: consumer-epic-registry/registry-gates/1`, `Bouncer-Intent: consumer-epic-registry/registry-gates` |

위 예의 구분자(`/` 대 `-`), task order 자릿수, epic 디렉터리의 번호 유지 여부는 아래 결정 사항이다.

## 결정이 필요한 사항

1. **구분자.** 요청에는 `epic slug - bp slug - task order`로 적혀 있다. 하이픈으로 이으면 slug 안의 하이픈과 구분되지 않아 역파싱이 모호하다(`plan-workflow-task-split-3`의 epic 경계를 알 수 없음). `/`를 권한다. 하이픈을 꼭 써야 하면 epic·bp slug에서 하이픈을 금지하거나, 이름을 구분자 앞에서 등록부와 대조해 해석해야 한다.
2. **epic 디렉터리의 번호.** 현재 `epics/115-host-distribution/`이다. blueprint만 번호를 빼면 경로가 `epics/115-host-distribution/blueprints/registry-gates/`가 된다. epic 디렉터리도 `epics/host-distribution/`으로 바꾸면 등록부 `id`(115)는 내부 키로만 남고 경로에서 사라진다. 등록부 `id`를 유지할지, 아예 없앨지 정해야 한다. 요청에서 번호를 뺀 범위는 blueprint와 stable ID, trailer이므로 epic 디렉터리는 확인이 필요하다.
3. **legacy 처리 방식.** legacy까지 포함하면 `blueprints/001-cli-help/` 같은 디렉터리 222개와 그 참조를 바꿔야 한다. 이는 앞서 "논리적 병합"으로 정한 범위를 넘고, 요구사항 REQ-13~15의 이관 도구가 필요해진다. 선택지는 둘이다.
   - **물리 이관:** 디렉터리를 새 이름으로 옮기고 문서 안 링크, pointer, 원장, 브랜치 이름을 맞춘다. 승인 스냅샷과 검증 증적이 경로·ID를 키로 쓰면 해시가 깨질 수 있어 먼저 확인이 필요하다.
   - **별칭 표:** 디렉터리는 그대로 두고 `이전 ID → 새 ID` 대응 표를 읽기 전용으로 둔다. 코드는 새 형식을 쓰고, 조회는 별칭 표로 이전 ID를 해석한다. 이전 이력은 바꾸지 않는다.
4. **과거 커밋 trailer 355개.** 커밋은 바꿀 수 없다. 그러므로 어느 쪽을 고르든 `EPIC-ddd/BP-ddd/TASK-ddd` 형식의 trailer를 계속 읽어야 한다. 읽기 호환 기간을 두는지, 영구히 두는지 정해야 한다. 같은 blueprint가 이전 형식과 새 형식 trailer를 모두 가지면 `finalize`의 task 커밋 조회(`trailerMap`)가 둘을 같은 task로 묶어야 한다.
5. **`order` 의미와 변경 규칙.**
   - epic 안에서 유일한가, 같은 값을 허용하는가(예: 병렬 blueprint)
   - 정수 순번인가, 사이에 끼워 넣을 수 있게 간격(10, 20, …)을 두는가
   - 닫힌 blueprint의 `order`를 바꿀 수 있는가. 바꿔도 stable ID에는 영향이 없어야 한다(ID는 slug 기반)
   - `order`가 `nextBlueprint`·sibling 선택·`plan inspect`의 정렬 기준이 되는가
6. **slug 규칙.** blueprint slug는 같은 epic 안에서 유일해야 하고 이름 바꾸기는 새 ID를 만든다는 뜻이다. 그러면 slug를 바꾸는 순간 trailer·링크·원장이 끊긴다. slug는 불변으로 하고 이름 변경은 별칭으로 처리하는지 정해야 한다. 길이와 문자 제한(소문자·숫자·하이픈)은 `epic add-area`의 slug 규칙을 재사용하면 된다.
7. **task order.** task는 slug가 없고 blueprint 안 순번이다. `tasks/001/`처럼 0을 채울지, `tasks/1/`로 할지 정해야 한다. 채우면 기존 task 디렉터리와 그대로 호환되고 정렬이 안정적이다. 채우지 않으면 문자열 정렬에서 `10`이 `2` 앞에 온다. 호환을 위해 채우기를 권한다.
8. **브랜치·worktree 이름.** 새 형식으로는 `feat/<epic-slug>--<bp-slug>`, worker는 `bouncer/<epic-slug>--<bp-slug>--<order>`처럼 구분자를 정해야 한다. git ref 제약과 경로 길이(Windows 포함)를 확인해야 한다. 같은 bp slug가 다른 epic에 있을 수 있어 epic slug를 이름에 넣어야 충돌하지 않는다. 진행 중인 drive가 옛 이름의 worktree를 가지고 있으면 그 drive는 옛 이름으로 끝내고 새 drive부터 새 이름을 쓴다.
9. **기존 실행 상태.** pointer 키, 코디네이터 원장, 승인 스냅샷, 검증 증적(`evidence_id`), 리뷰 라운드, intent bundle이 경로나 stable ID를 키로 쓰는지 조사가 필요하다. 이 값이 구형 ID를 키로 가지고 있으면 마이그레이션이나 이중 조회가 필요하다.
10. **적용 순서.** 새 epic 115~122는 아직 blueprint가 없으니 새 형식을 먼저 적용하기 쉽다. legacy는 별칭 표 또는 이관 도구가 준비된 뒤에 한다. 이 둘을 한 번에 할지 나눌지 정해야 한다.

## 영향 범위 요약

- **경로·scaffold:** `paths.ts`, `layout.ts`, `scaffold.ts`, `schema.ts`, `tasks-docs.ts`, `current.ts`, `runtime-state.ts`, `plan-approve.ts`, `plan-inspect.ts`
- **식별자·추적:** `commit-sha.ts`, `commit-message.ts`, `intent-provenance.ts`, `intent-bundle.ts`, `finalize-collect.ts`, `finalize-digest.ts`, `context-ontology.ts`, `verification.ts`
- **실행:** `coordinator-commands.ts`, `coordinate-next.ts`, `run-preflight.ts`, `review-dispatch.ts`, `approval-snapshot.ts`
- **검증:** `validate-structural.ts`, `epic-registry.ts` 등 `\d{3}`를 가정하는 모든 판정
- **규칙·스킬:** `rules/` 3개, `references/` 2개, `skills/` 1개
- **테스트:** 번호를 가정하는 테스트 34개

## 제안 계획

1. **식별자 조회 계층 (선행):** 이전·새 형식을 모두 해석하는 resolver를 만들고, 기존 코드가 `\d{3}` 대신 resolver를 쓰게 한다. 동작은 바꾸지 않는다.
2. **새 형식 쓰기:** scaffold, 경로, `order` 필드, trailer 쓰기를 새 형식으로 바꾼다. 새 epic에서만 켠다.
3. **legacy 이관:** 별칭 표 또는 이관 도구로 legacy를 바꾼다. 결정 3에 따라 크기가 달라진다.
4. **규칙·문서·테스트 정리.**

epic은 `119-context-search`(문서 식별자)가 맞다. 1단계만 먼저 해도 이후 단계를 막지 않는다.

## 선행 확인

- 승인 스냅샷·검증 증적·pointer가 경로나 stable ID를 키로 쓰는 위치를 조사한다(결정 9).
- 위 결정 1~10 중 1, 2, 3, 4를 먼저 정해야 계획을 세울 수 있다.
