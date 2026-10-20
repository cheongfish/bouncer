# 인계 문서: 119/001-slug-identifiers 드라이브 중단

- 작성일: 2026-10-20
- 블루프린트: `.bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers`
- 브랜치: `feat/119-001-slug-identifiers` (base `develop`)
- integration worktree: `.worktrees/119/001/integration`
- integration HEAD: `80a13168` (태스크 001~006 통합 내용 포함)
- 중단 사유 요약: terminal 검증(007, `npm run ci`) 1건 실패 → repair wave 1 소진 → cascade로 001~006이 ledger상 `pending`으로 리셋 → `no-progress` 규칙으로 사용자 결정에 따라 중단
- 상태: **미완료.** 사용자가 강제로 PR을 올리는 전제이며, `/bouncer-finalize`는 실행되지 않았다. `validate --gate finalize`는 현재 상태에서 통과하지 않는다.

## 1. 한 줄 결론

구현 001~006은 HEAD에 들어 있고 태스크별 verify는 모두 통과했다. 전체 CI는 2732개 중 1개가 실패한다. 그 1개의 원인 수정이 아직 적용되지 않았고, 블루프린트 단위 final review도 하지 않았다.

## 2. 실패한 1건과 예상 원인 파일

- 실패 명령: `npm run ci` (exit 1, 2731 pass / 1 fail)
- 실패 테스트: `test/execute-prepare.test.js:193` — "execute prepare with an invalid branch name → returns invalid-branch-name without creating a worktree"
- 오류: `pointerKeyFromBlueprint`가 `Cannot derive epic/blueprint ids from blueprint path: .bouncer/context/epics/001-auth/blueprints/001-invalid branch`를 던진다.
- 원인(코디네이터 진단, 코드 수정으로 확인하지는 않음):
  - `scripts/src/lib/context-ids.ts:26`의 `NUMERIC_SEG_RE = /^(\d{3})-([a-z0-9-]+)$/`(사용처 `:55`)가 구형 번호 경로의 나머지 부분을 slug 문자(`[a-z0-9-]`)로 제한한다.
  - base의 `scripts/src/lib/paths.ts` 구형 세그먼트 패턴은 `(\d{3})-[^/]+`로 공백 등도 받았다. 001이 이 관용도를 좁혀 "구형 경로 동작 보존" 요구를 어겼다.
  - 이 때문에 공백이 든 블루프린트 이름(`001-invalid branch`)이 `pointerKeyFromBlueprint`에서 먼저 거절되어, 테스트가 기대한 `invalid-branch-name` 경로까지 가지 못한다.
- 수정 방향(미적용):
  1. `scripts/src/lib/context-ids.ts`의 번호 세그먼트 판정을 base와 같은 관용도(`(\d{3})-[^/]+`)로 되돌린다. slug 형식 판정은 번호 형식과 분리해 유지한다.
  2. `test/context-ids.test.js`에 공백이 든 구형 번호 경로 회귀 케이스를 추가한다.
  3. `npm run ci`를 다시 돌려 통과를 확인한다.
- repair 범위(코디네이터가 기록한 값): `scripts/src/lib/context-ids.ts`, `test/context-ids.test.js`

## 3. 드라이브가 멈춘 경위

1. 001~003 통합(1~2차 세션). 002는 1차 시도에서 `scope_revision` — S37 힌트 추가로 소유 태스크가 없는 `test/validate-hints.test.js`가 깨져 TASKS-002 scope에 추가(revision r1), 2차 시도에서 통합.
2. 004, 005, 006 통합(3차 세션). 006은 1차 시도에서 `scope_revision` — 새 정적 가드가 `scripts/src`에서 실제 위반 6건을 찾았고(`context-ontology.ts:145,158`, `epic-registry.ts:270,372`, `finalize-digest.ts:798`, `migrate-context-slugs.ts:84`), 소유 태스크가 이미 통합된 상태라 006 scope를 확장(r2)해 2차 시도에서 통합.
3. terminal 007 실패 → `coordinate repair --resume-task 001`(repair wave 1/2 소진).
4. 이 repair가 decision에 `reset_downstream: [002,003,004,005,006,007]`을 기록했다. 모든 태스크가 001에 의존하므로 001 이후 전부가 재실행 대상이 되었고, `completed_tasks`가 3개에서 0개로 줄었다.
5. 재디스패치 전 기준값(3)보다 늘지 않아 루트가 `no-progress`로 중단했다. 사용자가 재개(A) 대신 중단(B)을 선택했다.

멈춘 직접 원인은 2절의 CI 실패이고, 재개 비용이 커진 원인은 4절의 cascade다.

## 4. 보존된 상태

- ledger: `.bouncer/runtime/coordinator.json` (revision `r3`, sha256 `3e99db5e…7653`)
- 포인터: `bouncer current` 기준 blueprint 그대로
- 터미널 실패 증적: `.bouncer/context/epics/119-context-search/blueprints/001-slug-identifiers/tasks/007/verification.md` (evidence id `656283670eb0…`, source digest `80a131686126…`)
- salvage patch: `.bouncer/runtime/salvage/{001..006}-g1-*.patch`
- salvage ref: `refs/bouncer/salvage/<task>/g1-*`
- worker 브랜치: `bouncer/119-001-001` ~ `bouncer/119-001-006`
- worker 보고서: `.worktrees/119/001/workers/<task>/.bouncer/runtime/reports/`
- repair wave는 1/2 소진, 남은 wave는 0회다(코디네이터 기록 기준). 재개 후 terminal이 다시 실패하면 `NEXT_PLAN.md`와 `partial-close --user-confirmed` 경로로 가야 한다.

## 5. 통합 커밋 대응표

| 태스크 | worker 커밋 | integration 커밋 | 비고 |
| --- | --- | --- | --- |
| 001 | `5d970933` | `e0465b43` | 식별자 resolver, 등록부 v2 |
| 002 | `d06c2726` | `7175a76f` | slug 경로 쓰기·order 정렬, 2회 시도 |
| 003 | `09781434` | `61c62fb5` | slug 실행 키, 1회 시도 |
| 004 | `cb2c9dbc` | `1b5b4ae8` | 두 형식 trailer·추적 키 |
| 005 | `579e82a2` | `21c40a8c` | 이관 명령 |
| 006 | `850641fa` | `80a13168` | 정적 가드·규칙 문서, 2회 시도 |

## 6. PR 전에 알아 둘 알려진 약점 / 후속 후보

코디네이터가 판정 중 기록한 것으로, 코드로 재검증하지는 않았다.

- `scripts/src/lib/finalize.ts:731`: `resolveTaskCommits` 호출이 `registry`를 넘기지 않는다(004 범위 밖이라 후속).
- `scripts/src/lib/plan-inspect.ts` `summarizeRegistry`: id가 없는 v2 등록부 항목을 처리하지 않는다. `RegistryEpic.id` 타입도 필수 `string`으로 남아 있다.
- `scripts/src/lib/migrate-context-slugs.ts`(005): 자동 롤백이 없다. git common dir의 verify 원장은 이관하지 않아 끝나지 않은 태스크의 `verification.md`가 이관 뒤 G13에서 실패할 수 있다. 브리프에 없는 거절 코드 `migrate-registry-missing`을 추가했다.
- `scripts/src/lib/coordinator-commands.ts`(003): `intentIdFor` 헬퍼가 `parseWorkerTokens`의 JSDoc과 함수 본문 사이에 끼어 있다(동작 문제는 아님). wave/supplement 키에는 slug 전용 테스트가 없다.
- `scripts/src/lib/epic-index.ts`(002): 구형 `EPIC-` 접두 판정을 `isLegacyEpicDirName`으로 남겼다. `epic add-domain`은 손대지 않았다. slug epic의 `nextBlueprintId`는 `null`이다.
- `rules/cli.md`, `rules/document-schema.md`의 S37 표는 006에서 갱신됐으나 final review로 확인하지 않았다.
- 블루프린트 단위 final review(`review_scope: blueprint`)는 실행되지 않았다. 위 항목들이 거기서 지적될 수 있다.

## 7. 재개하려면

- 정석: `/bouncer-run`을 다시 실행해 코디네이터 드라이브를 이어간다. `ready: [001]`부터 시작하며, 001의 repair 범위는 2절의 두 파일이다. 이후 002~006이 현재 HEAD에서 다시 돌고(내용은 이미 들어 있음) 007이 재검증된다. 재실행 비용은 implementer 토큰 기준 이전 라운드 약 1.27M 규모를 참고한다.
- 강제 PR 경로: 2절의 수정만 별도 커밋으로 올리면 CI는 통과할 가능성이 높지만, 이 경로는 Bouncer 증적(검증 성공 기록, final review)을 남기지 않는다. PR 본문에 위 사실을 명시할 것을 권한다.
- 병합 뒤 ledger가 남아 `main-worktree-source-write`로 막히면 사용자 승인 후 `bouncer run detach --blueprint <dir> --yes`를 쓴다.

## 8. 토큰 소모 조사 (subagent transcript 기준)

호스트 보고 토큰은 마지막 턴의 컨텍스트 크기에 가깝다. 호출마다 앞선 컨텍스트를 다시 읽는 누적 비용(`cache_read_input_tokens` 합)은 계산하지 않았으므로, 실제 사용량은 보고값보다 클 수 있다. 아래는 tool 호출 명령과 결과 문자 수로 비교한 값이다.

### 8.1 코디네이터

| 세션 | 대상 | 토큰 | 비고 |
| --- | --- | --- | --- |
| 1 | 001 | 92,258 | 시작 시점 컨텍스트가 이미 약 45.9K, 마지막 약 89K |
| 2 | 002, 003 | 137,757 | 002 scope_revision과 2차 시도 포함 |
| 3 | 004, 005, 006, 007 repair | 175,075 | 006 scope_revision, terminal 실패, repair |

- 시작 컨텍스트 약 46K는 세션마다 새로 지불한다(시스템 프롬프트, 역할 문서, 도구 정의, 디스패치 프롬프트로 추정, 구성 비율은 미확인).
- 태스크 문서는 lazy하게 읽었다. 본문(`cat`)은 이번 wave의 태스크만, 나머지는 `affected_paths`와 `verify:` 줄만 `sed`/`grep`으로 읽었다. 시작 시점에 7개를 전부 읽지 않았다.
- 큰 증가분은 `coordinate advance`/`dispatch` 출력을 `head -c 20000~30000`으로 통째로 받은 호출이다. 세션 3의 첫 `advance` 출력은 tool-results 파일로 저장되어 `Read`로 다시 읽었다.
- 개선 후보: `advance` 출력의 `next.card`를 기본 접기, 코디네이터 문서에 "필요 필드만 파싱" 명시, `waves_per_session` 상한(현재 4) 조정으로 재디스패치 횟수 감소.

### 8.2 구현자(implementer)

| 태스크 | 시작 | 끝 | 호출 수 | 비고 |
| --- | --- | --- | --- | --- |
| 001 | 약 42K | 약 112K | 23 | |
| 002 (1차) | 약 43K | 약 347K | 108~111 | 소스 15개, 테스트 11개 대상 |
| 002 (2차) | 약 43K | 약 49K | 5 | `'S37'` 한 줄 추가 |
| 003 | 약 43K | 약 107K | 30 | |
| 004 | 약 48K | 약 192K | 62 | |
| 005 | 약 43K | 약 291K | 65 | |
| 006 | (두 시도, 에이전트 매핑 불확실하여 표에서 제외) | | | |

- 합계는 약 1.27M 토큰이고 002(1차)와 005가 절반 이상이다.
- 002(1차)는 컨텍스트가 호출 1~15에서 43K→118K, 16~40에서 124K→207K, 41~70에서 208K→281K, 71~108에서 287K→347K로 직선에 가깝게 늘었다. 큰 한 번의 증가는 `cat scripts/src/lib/scaffold.ts`(약 18.5K) 정도다. 범위가 넓어 읽고 고치는 호출이 많았던 것이 원인이다. 테스트/CI 실행은 6번뿐이었다.
- 005는 `epic-registry.ts` 전체 `cat`(약 20K자)과 `sed -n 75,400p`(약 19K자)가 컸다.
- `coding-standards/index.md`(약 8.9K자)를 implementer마다 읽는다. 001, 003 transcript에는 같은 결과가 두 번 기록되어 있으나 실제 이중 호출인지 기록 방식인지는 미확인이다.
- 개선 후보: 경로가 많은 태스크(002는 26개)를 plan 단계에서 분리, 큰 모듈은 `symbol_locations`로 필요 구간만 읽기, `coding-standards` 필요 구간만 읽기.
- 004~006 중 일부 에이전트 ID와 태스크 매핑이 확실하지 않아 해당 행은 넣지 않았다.

## 9. 메트릭 (`bouncer metrics`)

- 코디네이터 3개 세션: 92,258 + 137,757 + 175,075 = 405,090 토큰 (wall 합계는 `metrics summary` 참고)
- implementer: 1,265,699 토큰, reviewer·debugger: 0
- 코디네이터와 worker 합계는 서로 더하지 않았다.
