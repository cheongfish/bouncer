# 벤치마크 회차 기록

이후 회차가 옛 수치를 인용할 때는 이 표만 쓴다.

| 회차 | 측정일 | 베이스 커밋 | arm 구성 | 시간 배수 | test quality Δ | 계획 문서 줄 수 | on 실격 수 | G18/S9/G4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-21 (KST) | `3f52018` | off / on | 3.32× | +3.00 | 350 / 313 / 340 / 365 | 0 | — |
| 2 | 2026-08-21 (KST) | `6101b2b` | on (개선) | 2.80× | +1.75 | 266 / 278 / 252 / 256 | 0 | 0 |
| 3 | 2026-08-22 (KST) | `b0679f5` | on-light | 2.13× | +2.00 | 146~160 | 0 | 0 |

## 회차 요약

**1회차.** Bouncer on/off A/B. 토큰 합 off 202,268 / on 442,061 (2.19×), 벽시계 합 8.7분 / 28.8분 (3.32×). 런별 벽시계는 기록이 없어 그 칸은 비운다.

**2회차.** 강화 게이트·scaffold 힌트 이후 개선 on-arm을 1회차 off 벽시계와 겹치는 축만 재측정. 시간 배수 2.80×·test quality Δ +1.75는 목표 미달, on 실격과 G18/S9/G4는 0.

**3회차.** light 계획 계약 on-arm. 계획 문서 4종은 사이클 종료 146~160줄(목표 ≤100 미달). `wall_s` 합 1110, `tool_calls_est` 합 86. 문서 세트와 계약이 1·2회차와 달라 값을 빼 비교하지 않는다.

표에 없는 런 산출물·프로토콜·서술은 git 히스토리에 있다.

## 지시문 비용 회차

이 절은 `docs/benchmark/context-cost.md`의 고정 실행 입력을 따른 2026-08-28 baseline 전사본이다. 1–3회차와 문서 세트·계약이 다르므로 이 수치로 뺄셈 비교하지 않는다. `s5`·`s6`은 필수 퀴즈 무응답으로 finalize가 차단된 결과이며 성공 수치가 아니다.

| id | 측정일 | tokens_in | tokens_out | wall_s | tool_calls | gate 통과율 | review finding 수 | scope 위반 수 | 산출물 경로 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `s1-light-cycle` | 2026-08-28 | 1371685 | 8785 | 206 | 17 | 3/3 | 0 | 0 | `.benchmarks/s1-light-cycle.recovery.metrics.json` |
| `s2-full-plan` | 2026-08-28 | 848077 | 9000 | 192 | 16 | 1/1 | 0 | 0 | `.benchmarks/s2-full-plan.recovery.metrics.json` |
| `s3-verify-recovery` | 2026-08-28 | 1298890 | 7913 | 258 | 15 | 2/2 | 1 | 0 | `.benchmarks/s3-verify-recovery.recovery.metrics.json` |
| `s4-review-roundtrip` | 2026-08-28 | 701243 | 4464 | 133 | 11 | 2/2 | 1 | 0 | `.benchmarks/s4-review-roundtrip.v2.recovery.metrics.json` |
| `s5-finalize-distill` | 2026-08-28 | 365993 | 4000 | 101 | 11 | 0/1 (`blocked`) | 0 | 0 | `.benchmarks/s5-finalize-distill.metrics.json`; `.benchmarks/s5-finalize-distill.finalize.json` |
| `s6-finalize-bare` | 2026-08-28 | 287350 | 4035 | 93 | 9 | 0/1 (`blocked`) | 0 | 0 | `.benchmarks/s6-finalize-bare.metrics.json`; `.benchmarks/s6-finalize-bare.finalize.json` |
| `s7-run-multitask` | 2026-08-28 | 2266450 | 7292 | 282 | 35 | 4/4 | 0 | 0 | `.benchmarks/s7-run-multitask.metrics.json` |

## DeepSWE 원본

이 절은 DeepSWE 원본 스위트 3 arm 비교다. 위 1–3회차 표(이 저장소 자체
스위트)와 열이 다르다. 그 표의 숫자는 여기서 건드리지 않는다.

통과율은 Pier `reward.json`(`reward > 0`). `wall_s` / `tokens_in` / `tokens_out`
합은 `metrics.json`의 `usage` 키만 더한다. 키가 없으면 칸을 비운다.

| 회차 | 측정일 | 태스크 | vanilla 통과 | superpowers 통과 | bouncer 통과 | wall_s 합 | tokens_in 합 | tokens_out 합 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-26 (KST) | `abs-module-cache-flags`, `abs-stepped-slices`, `actionlint-action-pinning-lint` | 0/3 | | | | | |

비교표와 9런 명령줄은 `docs/benchmark/deepswe/comparison.md`,
`docs/benchmark/deepswe/protocol.md`에 있다. 베이스 커밋은 이 회차를 남긴
워크트리 `3339e0c`다.
