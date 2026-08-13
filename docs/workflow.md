# Workflow

1. `/bouncer-init`: bootstrap `.bouncer/` once per project.
2. `/bouncer-plan`: author epic → blueprint → task bundles
   (`tasks/<NNN>/{tasks,verification,review}.md`), scaffold docs, inject
   `graph.suggested_paths`, confirm `affected_paths`, judge plan documents
   into blueprint-root `context-review.md`, approve, write the active
   pointer (`bouncer current --set`, which records the selected task when one
   is open), pass gate `plan` (G1–G5, G10–G12). Add another bundle with
   `bouncer scaffold task --blueprint <dir> --id <NNN>`.
3. `/bouncer-execute`: preflight, reuse or create the blueprint worktree,
   `seed-worktree` (move plan documents from the base checkout into the
   worktree), implement from the pointer's `tasks/<NNN>/tasks.md`, then verify
   and review against that same bundle's `verification.md` and `review.md`,
   pass gate `execute` (G6–G8, G13–G14). Does **not** commit — hand off to
   `/bouncer-commit`. All tasks on one blueprint share one worktree.
4. `/bouncer-commit`: scope dry-run, pass gate `commit` (G6/G7/G8 re-check +
   G17 staged scope), **ACQ**-confirm `bouncer commit --yes`, then **ACQ**
   next-task `bouncer current --set`. No explain / quiz step.
5. `/bouncer-finalize`: promote durable notes from `explain.md` into
   `.bouncer/Distill.md` via `spec-authoring` (excluding
   `## 이해 상태` / Quiz / comprehension), then `explain-diff` (one blueprint
   comprehension entry for pointer-`base`..HEAD, `quiz_score` required), pass
   gate `finalize` (G16), then **ACQ**-confirm remainder `finalize --yes`
   (recommended: remove execute worktree), one **ACQ** to open a draft PR
   (show rendered title/body, then push + `gh pr create --draft` with no
   second confirm), filled from `explain.md` Background / Intuition / Code, and
   next-blueprint handoff. PR is skipped gracefully with no remote / no `gh`,
   or when declined. Draft PR titles use `[YYMMDD] (→ MergeTarget) [Type] 요약`.
   See [contributing.md](contributing.md). Plan/execute Read that project Distill
   before work.
   `finalize --yes`는 마감한 blueprint의 `index.md` `bouncer.status`를 `closed`로
   바꿔 그 변경도 마감 커밋에 함께 담는다(dry-run은 쓰지 않고 쓰게 될 경로만
   보고). 잠긴 blueprint는 이후 `bouncer current --set`·`listReadyBlueprints`
   후보에서 빠지고 plan 게이트 G2가 미승인 draft와 다른 문구로 이를 알린다.
   해제 경로는 없다 — 다시 열려면 `index.md`의 status를 손으로 `approved`로
   되돌려야 한다.

## How it works

```text
/bouncer-plan     → gate plan     (G1–G5, G10–G12)
/bouncer-execute  → worktree (reuse) + seed → implement · verify · review
                  → gate execute  (G6–G8, G13–G14)  ← verify 실제 실행
/bouncer-commit   → gate commit (G6/G7/G8 + G17)
                  → ACQ(commit --yes) → ACQ(next task --set)
/bouncer-run      → execute→commit 반복 (task 소진까지; 수동 경로의 대체)
/bouncer-finalize → Distill 승격(from explain)
                  → explain-diff (BP entry + quiz) → gate finalize (G16)
                  → ACQ(--yes + worktree)
                  → (ACQ) draft PR (render → push+create, no body confirm)
```

단계별 스킬(권장 순서):

| 단계 | 스킬 |
| --- | --- |
| `/bouncer-plan` | `discovery` → `spec-authoring` → `stop-slop` → `graphify-runner` → `minimality` → `context-review` |
| `/bouncer-execute` | `implementation` → `verification` → `review` → `minimality` (`debugging` / `bouncer-debugger` on verify failure) |
| `/bouncer-commit` | (게이트·ACQ만 — explain 없음) |
| `/bouncer-finalize` | `spec-authoring` (explain→Distill 승격) → `explain-diff` (explain에 `stop-slop`) |

Execute에서 구현·리뷰·디버그는 named 서브에이전트 `bouncer-implementer` /
`bouncer-reviewer` / `bouncer-debugger`로 분리할 수 있다. Plan 승인 직전
계획 문서 판정은 `bouncer-context-reviewer`다.

게이트 표와 실패 코드는 [gates.md](gates.md),
CLI는 [cli.md](cli.md), 설정은 [configuration.md](configuration.md)를
보세요. 커밋 가드의 한계는 [security.md](security.md)에 있습니다.

## 자동 주행

`/bouncer-run`은 위 다섯 단계의 정본을 바꾸지 않는다. plan과 finalize는
그대로 두고, execute→commit만 열린 task가 없어질 때까지 반복한다.
정본 상한·중단 규칙은 `/bouncer-run` SKILL.md에 있다.

시작 전에 ACQ 하나로 주행 여부를 묻는다. 열린 task를 소진하면 멈추고
`/bouncer-finalize`를 안내한다. finalize에는 들어가지 않는다.

중단은 셋이다. verify 재시도 1회 후 재실패, 리뷰 왕복 2회 상한, 범위
위반. 멈추면 포인터와 execute worktree를 그대로 둔다. 그 task는
`/bouncer-execute`로 수동으로 닫은 뒤 `/bouncer-run`을 다시 건다.

`config.autonomy`가 `auto`면 시작 ACQ만 묻고 commit·next-task ACQ는
건너뛴다. `interactive`는 각 task를 닫은 뒤 다음 task로 갈지 ACQ를
하나 더 묻는다.

## 경량 경로

좁은 범위 작업은 새 모드가 아니라 운용 지침이다. `/bouncer-plan`이
사용자에게 경량 여부를 묻고(자동 판정하지 않는다), 선언을 받으면
blueprint `index.md`의 `bouncer.scale`을 `light`로 바꾼다. scaffold가
이미 `scale: full`을 쓰므로 키를 새로 넣는 것이 아니라 값을 바꾼다.

줄이는 것:

- epic 신설 — slug `maintenance` epic을 재사용한다(없을 때만 한 번 만들고,
  `closed`로 두지 않는다)
- 서브에이전트 왕복 — execute가 named 디스패치 대신 인라인한다
- 퀴즈 규모 — explain-diff가 질문 수를 1로 고정한다

줄이지 않는 것:

- 문서 수 — `tasks` / `verification` / `review` / `explain`은 그대로다
- 게이트 — plan / execute / commit / finalize 게이트는 그대로다

scaffold가 `full`을 쓰므로 경량이면 그 값을 `light`로 바꾸고, 되돌릴
때는 `full`로 되돌린다. 부재·`full`은 일반 경로다.
