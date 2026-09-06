# 워크플로 계약 현황과 후속 정비

이 문서는 Bouncer의 여섯 진입 workflow, 구현 에이전트 dispatch, 사용자 출력의
책임 경계와 구현 현황을 기록한다. 수치는 방향을 판단하는 참고값이며 축약
목표로 쓰지 않는다.

## 책임 경계

| 소유자 | 소유하는 내용 | workflow skill이 맡는 내용 |
| --- | --- | --- |
| `CLAUDE.md`, `rules/*.md` | 신뢰 경계, 문서 구조, pointer와 출력의 공통 계약 | 규칙을 읽는 시점과 workflow별 예외 |
| CLI와 validator 테스트 | staging 필터, 삭제 대상, JSON 필드, G/S code | CLI 입력과 결과에 따른 다음 행동 |
| `SKILL.md` | 단계 순서, ACQ, 승인 시점, workflow별 분기 | 조건부 reference를 읽는 시점 |
| `agents/*.md` | named agent 역할의 작성 정본 | 현재 task의 authority 입력 |
| generated TOML | Codex가 읽는 역할 지시 사본 | Markdown 정본과 일치할 때 named dispatch에 사용 |
| fallback payload | TOML을 적용할 수 없는 경로의 안전 지시 | generic agent와 inline 구현의 전체 역할 guard |

CLI 내부 동작과 전체 gate code를 skill에 반복하지 않는다. skill에는 사용자가
확인할 정보, 호출 순서, 실패 후 복구 행동을 남긴다. 조건부로만 필요한 worktree,
Graphify fallback, Distill promotion, PR 작성 절차는 reference가 소유한다.

## 측정 정의

여섯 `skills/bouncer-*/SKILL.md`에 같은 산식을 적용한다.

| 열 | 산식 |
| --- | --- |
| 줄 수 | 끝 개행을 제외한 줄 수 |
| 단어 수 | `text.trim().split(/\s+/).length` |
| 공유 계약 재서술 | `CLAUDE.md`·`rules/*.md` 또는 기존 조건부 reference가 소유하는 절차를 경로 cite 없이 다시 쓴 덩어리 수. 워크플로 고유 예외(로컬 trust boundary, ACQ 시점)는 세지 않는다. |
| 동시 수정 필요 지점 | 다른 파일이 소유하는 절차를 본문에 복제해, 소유 파일이 바뀌면 skill도 같이 고쳐야 하는 위치 수. 경로 cite만 있는 연결은 세지 않는다. |
| 기본 경로의 조건부 절차 로드 | numbered step `1.` 이전 본문에 있는, 기본 성공 경로가 아닌 helper cite 수 |

조건부 helper 소유:

| Skill | 조건부 helper | 책임 정본 |
| --- | --- | --- |
| `bouncer-init` | `./references/init-result.md` | bootstrap 이후 step 2 |
| `bouncer-plan` | `minimality/index.md`, `context-review/index.md`, `./references/graphify-suggestions.md`, `./references/context-review.md` | step 6 advisory, step 7 full-only |
| `bouncer-execute` | `minimality/index.md`, `debugging/index.md`, `./references/agent-dispatch.md`, `./references/verification-recovery.md` | step 5 advisory, step 4 verify-failure, dispatch/fallback |
| `bouncer-commit` | 없음 | — |
| `bouncer-run` | 없음 (debugger 상한은 execute 소유를 가리킴) | — |
| `bouncer-finalize` | `distill-promotion.md`, `explain-quiz.md`, `draft-pr.md`, `cleanup-handoff.md` | steps 1, 2, 4, 5–6 |

## Task 002 측정 — 변경 전

| Skill | 줄 수 | 단어 수 | 재서술 | 동시 수정 | 조건부 기본 로드 | 기본 경로 조건부 cite |
| --- | --- | --- | --- | --- | --- | --- |
| `bouncer-init` | 64 | 413 | 0 | 0 | 0 | — |
| `bouncer-plan` | 258 | 2178 | 0 | 0 | 2 | `minimality/index.md`, `context-review/index.md` |
| `bouncer-execute` | 237 | 1847 | 1 | 1 | 2 | `minimality/index.md`, `debugging/index.md` |
| `bouncer-commit` | 117 | 772 | 0 | 0 | 0 | — |
| `bouncer-run` | 154 | 1076 | 0 | 0 | 0 | — |
| `bouncer-finalize` | 110 | 901 | 0 | 0 | 0 | — |
| 합계 | 940 | 7187 | 1 | 1 | 4 | — |

execute의 재서술·동시 수정 1은 numbered step 앞 문단이 `debugging`의 네 단계
루브릭과 `verification-recovery.md`의 debugger 재디스패치 절차를 다시 쓴
항목이다.

## 정비 후보와 재현

구조 테스트 `entry skills do not load conditional helpers before numbered steps`와
skill별 소유 테스트를 기존 문서에 먼저 돌렸다.

| 후보 | 예상 실패 | 실제 | 조치 |
| --- | --- | --- | --- |
| plan skill-flow가 `minimality`·`context-review`를 step 1 앞에 적재 | 실패 | 실패 (`minimality/index.md` / step 7 앞 root cite) | 입증됨 — 최소 정비 |
| execute skill-flow가 `minimality`·`debugging`을 step 1 앞에 적재하고 recovery를 재서술 | 실패 | 실패 (`debugging/index.md`가 step 4 앞) | 입증됨 — 최소 정비 |
| init `init-result.md`가 bootstrap 앞 | 통과 | 통과 | 수정하지 않음 |
| commit 조건부 helper·두 번째 commit gate | 통과 | 통과 | 수정하지 않음 |
| run이 `debugging/index.md`를 기본 경로에 적재하거나 round-3 조건을 복사 | 통과 | 통과 | 수정하지 않음 |
| finalize 로컬 reference가 step 1 앞 | 통과 | 통과 | 수정하지 않음 |

## 변경 후 측정과 무변경 이유

| Skill | 줄 수 | 단어 수 | 재서술 | 동시 수정 | 조건부 기본 로드 | 결과 |
| --- | --- | --- | --- | --- | --- | --- |
| `bouncer-init` | 64 | 413 | 0 | 0 | 0 | 무변경. 결과 처리는 이미 bootstrap 이후 `init-result.md`가 소유한다. ACQ 시점·선택지는 유지한다. |
| `bouncer-plan` | 258 | 2191 | 0 | 0 | 0 | 정비. `minimality`는 step 6, root `context-review`는 light skip 뒤 step 7로 옮겼다. discovery·승인·`affected_paths` ACQ와 plan gate는 그대로다. 단어 수는 cite 이동으로 늘었고, 줄 수 감소가 정비 근거가 아니다. |
| `bouncer-execute` | 236 | 1829 | 0 | 0 | 0 | 정비. `debugging` cite와 re-dispatch 문구를 verify-failure 절(step 4)로 옮기고, 네 단계 루브릭 재서술을 제거했다. compact named dispatch와 full fallback은 `agent-dispatch.md`가 계속 소유한다. |
| `bouncer-commit` | 117 | 772 | 0 | 0 | 0 | 무변경. dry-run이 commit gate를 한 번 실행하고, next-task는 confirm-then-set이다. |
| `bouncer-run` | 154 | 1076 | 0 | 0 | 0 | 무변경. 시작 ACQ·autonomy·execute 소유 상한 위임만 있고, 기본 경로에 조건부 helper cite가 없다. |
| `bouncer-finalize` | 110 | 901 | 0 | 0 | 0 | 무변경. Distill·quiz·PR·handoff 승인은 이미 해당 numbered step의 로컬 reference가 소유한다. |
| 합계 | 939 | 7182 | 0 | 0 | 0 | — |

## Task 001 실행 확인

Task 001 이후 이 task의 구현은 새 named `bouncer-implementer`로 시작했다.
`.codex/agents/bouncer-implementer.toml` 첫 줄이 `# bouncer-generated`이고
`mdToCodexToml(agents/bouncer-implementer.md)`와 byte-for-byte로 일치해 compact
payload 조건이 충족됐다. compact payload에는 이 worktree cwd와 현재 task의
Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist만 실렸다.
