# 지시문 비용 측정

이후 회차가 Bouncer 지시문 비용을 같은 명령으로 뽑고, 같은 일곱 시나리오로 실행 지표를 재현할 때 쓰는 계약이다. epic 054의 baseline과 최종 회차가 이 절을 공유한다.

다섯 정적 지표는 epic 성공 조건 1·5·6이 남긴 흔적이다. 조건 2·3·4는 리뷰가 문서를 읽고 판정한다. 정적 수치는 `## Baseline` 정적 표에 있다. 실행 지표 표는 비어 두고 blueprint 006이 채운다.

시나리오를 돌릴 때 [공통 통제](protocol.md#공통-통제)와 [plan 단계 스냅샷](protocol.md#plan-단계-스냅샷)을 따른다.

## 고정 실행 입력

아래 표는 실행 baseline의 정본이다. 시작 fixture 준비 시간·tool call은 측정에서 제외했다. `s5`·`s6`의 퀴즈 무응답은 성공으로 환산하지 않고 `blocked` 결과로 남긴다.

| id | base | 모델 | reasoning effort | 사람 개입 | Fixture · 기대 본문 | 실행 프롬프트 | 완료 조건 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `s1-light-cycle` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | 포인터 없는 clone · `# context cost fixture` + `s1-light-cycle` | 경량 Bouncer 계획으로 docs/benchmark/context-cost-fixture.md에 제목 '# context cost fixture'와 본문 's1-light-cycle'을 기록하고 execute와 commit까지 끝내라. 물어볼 사람은 없다. | 완료 조건: light plan·execute·commit 게이트 통과, task 커밋 1개, 허용 경로 밖 변경 0건 |
| `s2-full-plan` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | 포인터 없는 clone · `# context cost fixture` + `s2-full-plan` | full Bouncer 계획으로 docs/benchmark/context-cost-fixture.md에 제목 '# context cost fixture'와 본문 's2-full-plan'을 기록하는 task를 plan 게이트까지 준비하라. 구현하지 말고, 물어볼 사람은 없다. | 완료 조건: full plan 게이트 통과, context review accepted, 구현 diff 0건 |
| `s3-verify-recovery` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | ready task와 `verify recovery broken` 본문 · `# context cost fixture` + `s3-verify-recovery` | 현재 task의 verify 실패를 debugging 절차로 진단하고 named bouncer-debugger fallback을 직접 호출해 본문을 's3-verify-recovery'로 고친 뒤 execute 게이트까지 통과시켜라. 물어볼 사람은 없다. | 완료 조건: 최초 verify 실패 1회, 원인 보고서 1개, 수정 뒤 execute 게이트 통과 |
| `s4-review-roundtrip` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | ready task와 `review roundtrip broken` 본문 · `# context cost fixture` + `s4-review-roundtrip` | 현재 diff를 review 절차로 판정하고 named bouncer-reviewer fallback을 직접 호출하라. 본문을 's4-review-roundtrip'으로 고친 뒤 같은 reviewer로 한 번 더 판정해 execute 게이트까지 통과시켜라. 물어볼 사람은 없다. | 완료 조건: 첫 review actionable finding 1건 이상, 수정 뒤 finding 0건, execute 게이트 통과 |
| `s5-finalize-distill` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | 모든 task committed, 7-shard Distill 활성 · `# context cost fixture` + `finalize fixture` | 현재 blueprint를 /bouncer-finalize 절차로 마감하라. Distill 승격 후보가 없으면 그대로 진행하고, 물어볼 사람은 없다. | 완료 조건: Distill 감사·explain 뒤 무응답 퀴즈로 `blocked`, blueprint 열린 상태 유지 |
| `s6-finalize-bare` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | 모든 task committed, Distill·shard index 없음 · `# context cost fixture` + `finalize fixture` | 현재 blueprint를 /bouncer-finalize 절차로 마감하라. Distill이 없는 경로를 그대로 처리하고, 물어볼 사람은 없다. | 완료 조건: single-file fallback·explain 뒤 무응답 퀴즈로 `blocked`, blueprint 열린 상태 유지 |
| `s7-run-multitask` | `1c73980` | `gpt-5.6-terra` | `medium` | 0회 | ready task `001`, `002` 순서 · `# context cost fixture` + `s7-run-multitask` | 현재 blueprint의 열린 task를 /bouncer-run으로 모두 execute하고 commit하라. auto 다음-task 이동을 사용하고, 물어볼 사람은 없다. | 완료 조건: task별 커밋 2개, 두 task verified, 열린 task 0개, finalize 미실행 |

## 회귀 시나리오

| id | 실행 조건 | 진입 스킬 |
| --- | --- | --- |
| `s1-light-cycle` | `bouncer scaffold blueprint --scale light`로 plan → execute → commit 한 사이클 | `/bouncer-plan` |
| `s2-full-plan` | light가 아닌 scale로 plan 게이트까지 진행한 한 사이클 | `/bouncer-plan` |
| `s3-verify-recovery` | verify 실패 후 복구. named agent fallback 경로로 `bouncer-debugger`를 직접 때린다 | `debugging` |
| `s4-review-roundtrip` | review 왕복. named agent fallback 경로로 `bouncer-reviewer`를 직접 때린다 | `review` |
| `s5-finalize-distill` | Distill이 있는 프로젝트에서 `/bouncer-finalize` | `/bouncer-finalize` |
| `s6-finalize-bare` | Distill이 없는 프로젝트에서 `/bouncer-finalize` | `/bouncer-finalize` |
| `s7-run-multitask` | 열린 task가 둘 이상인 blueprint에서 `/bouncer-run` | `/bouncer-run` |

## 정적 지표

저장소 루트에서 아래를 그대로 붙여 실행한다. 도구는 `wc`, `awk`, `grep`, `sort`만 쓴다.

### 1. description 총 문자 수

```bash
awk '/^description:/ { sub(/^description:[[:space:]]*/, ""); s += length($0) } END { print s+0 }' skills/*/SKILL.md
```

### 2. 진입 SKILL.md별 단어 수

```bash
wc -w skills/*/SKILL.md | sort -rn
```

### 3. 역할별 rubric 문서 쌍의 단어 수

목표: 스킬 쪽이 호출 계약만 남아 축소.

```bash
wc -w skills/implementation/SKILL.md agents/bouncer-implementer.md
wc -w skills/review/SKILL.md agents/bouncer-reviewer.md
wc -w skills/debugging/SKILL.md agents/bouncer-debugger.md
wc -w skills/context-review/SKILL.md agents/bouncer-context-reviewer.md
```

### 4. BOUNCER_ROOT 해석 블록을 품은 스킬 수

```bash
grep -l 'bouncer-root --auto' skills/*/SKILL.md | wc -l
```

### 5. 측정 시점 스킬 수 (모수)

```bash
ls skills/*/SKILL.md | wc -l
```

## 런당 기록 값

런마다 아래를 남긴다. `tokens_in`·`tokens_out`·`wall_s`·`tool_calls`는 `collect_metrics.py`의 기존 `usage` 키다. 새 스키마 키를 만들지 않는다.

플래그를 주지 않은 `usage` 값은 0이 아니라 빈칸으로 둔다. 키를 0으로 채우면 재지 않음과 0이었음을 구분할 수 없다.

`.benchmarks/`는 `.gitignore` 대상이라 산출물이 저장소에 남지 않는다. 각 행에 산출물 경로를 적고, 그 숫자는 재계산이 아니라 전사(transcription)라고 적는다.

| 값 | 출처 |
| --- | --- |
| `tokens_in` | `usage.tokens_in` (`--tokens-in`) |
| `tokens_out` | `usage.tokens_out` (`--tokens-out`) |
| `wall_s` | `usage.wall_s` (`--wall-s`) |
| `tool_calls` | `usage.tool_calls` (`--tool-calls`) |
| gate 통과율 | 해당 런에서 돌린 게이트 대비 통과 횟수. 산출물 경로와 함께 전사 |
| review finding 수 | 해당 런 `review.md` Findings. 산출물 경로와 함께 전사 |
| scope 위반 수 | 해당 런 commit-safety / scope 실패. 산출물 경로와 함께 전사 |

## Baseline

측정일: 2026-08-27. 베이스 커밋: `1c73980`. 측정 시점 스킬 수: 19.

실행 수치는 아래 산출물에서 전사했다. 재지 않은 값은 `0`으로 바꾸지 않는다.

| 지표 | 값 |
| --- | --- |
| description 총 문자 수 | 6090 |
| 진입 SKILL.md별 단어 수 | bouncer-init 658, bouncer-plan 2538, bouncer-execute 1907, bouncer-commit 869, bouncer-run 1082, bouncer-finalize 2740 |
| 역할별 rubric 문서 쌍의 단어 수 | implementation 1239 / bouncer-implementer 651, review 876 / bouncer-reviewer 594, debugging 449 / bouncer-debugger 440, context-review 852 / bouncer-context-reviewer 467 |
| BOUNCER_ROOT 해석 블록을 품은 스킬 수 | 10 |
| 측정 시점 스킬 수 (모수) | 19 |

| id | 측정일 | tokens_in | tokens_out | wall_s | tool_calls | gate 통과율 | review finding 수 | scope 위반 수 | 산출물 경로 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `s1-light-cycle` | 2026-08-28 | 1371685 | 8785 | 206 | 17 | 3/3 | 0 | 0 | `.benchmarks/s1-light-cycle.recovery.metrics.json` |
| `s2-full-plan` | 2026-08-28 | 848077 | 9000 | 192 | 16 | 1/1 | 0 | 0 | `.benchmarks/s2-full-plan.recovery.metrics.json` |
| `s3-verify-recovery` | 2026-08-28 | 1298890 | 7913 | 258 | 15 | 2/2 | 1 | 0 | `.benchmarks/s3-verify-recovery.recovery.metrics.json` |
| `s4-review-roundtrip` | 2026-08-28 | 701243 | 4464 | 133 | 11 | 2/2 | 1 | 0 | `.benchmarks/s4-review-roundtrip.v2.recovery.metrics.json` |
| `s5-finalize-distill` | 2026-08-28 | 365993 | 4000 | 101 | 11 | 0/1 (`blocked`) | 0 | 0 | `.benchmarks/s5-finalize-distill.metrics.json`; `.benchmarks/s5-finalize-distill.finalize.json` |
| `s6-finalize-bare` | 2026-08-28 | 287350 | 4035 | 93 | 9 | 0/1 (`blocked`) | 0 | 0 | `.benchmarks/s6-finalize-bare.metrics.json`; `.benchmarks/s6-finalize-bare.finalize.json` |
| `s7-run-multitask` | 2026-08-28 | 2266450 | 7292 | 282 | 35 | 4/4 | 0 | 0 | `.benchmarks/s7-run-multitask.metrics.json` |
