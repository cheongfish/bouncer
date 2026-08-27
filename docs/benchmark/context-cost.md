# 지시문 비용 측정

이후 회차가 Bouncer 지시문 비용을 같은 명령으로 뽑고, 같은 일곱 시나리오로 실행 지표를 재현할 때 쓰는 계약이다. epic 054의 baseline과 최종 회차가 이 절을 공유한다.

다섯 정적 지표는 epic 성공 조건 1·5·6이 남긴 흔적이다. 조건 2·3·4는 리뷰가 문서를 읽고 판정한다. 정적 수치는 `## Baseline` 정적 표에 있다. 실행 지표 표는 비어 두고 blueprint 006이 채운다.

시나리오를 돌릴 때 [공통 통제](protocol.md#공통-통제)와 [plan 단계 스냅샷](protocol.md#plan-단계-스냅샷)을 따른다.

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

실행 표는 blueprint 006이 채운다.

| 지표 | 값 |
| --- | --- |
| description 총 문자 수 | 6090 |
| 진입 SKILL.md별 단어 수 | bouncer-init 658, bouncer-plan 2538, bouncer-execute 1907, bouncer-commit 869, bouncer-run 1082, bouncer-finalize 2740 |
| 역할별 rubric 문서 쌍의 단어 수 | implementation 1239 / bouncer-implementer 651, review 876 / bouncer-reviewer 594, debugging 449 / bouncer-debugger 440, context-review 852 / bouncer-context-reviewer 467 |
| BOUNCER_ROOT 해석 블록을 품은 스킬 수 | 10 |
| 측정 시점 스킬 수 (모수) | 19 |

| id | tokens_in | tokens_out | wall_s | tool_calls | gate 통과율 | review finding 수 | scope 위반 수 | 산출물 경로 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
