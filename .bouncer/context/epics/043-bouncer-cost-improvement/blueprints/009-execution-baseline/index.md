---
type: bouncer.blueprint
title: 실행 지표 baseline 회차 기록
description: 고정 입력으로 실행한 회귀 시나리오 7종의 산출물에서 실행 지표를 옮겨 변경 전 회차로 남긴다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/009-execution-baseline/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-27T08:29:39.832+09:00'
bouncer:
  id: '009'
  epic_id: '043'
  blueprint_id: '009'
  status: closed
  commit_type: docs
  scale: full
  supersedes: []
---
# 009 execution-baseline

Epic: [043](../../index.md)

## Intent
- 문제: blueprint 001은 측정 계약과 정적 수치까지만 닫는다. 실행 지표는 사람이 7개 시나리오를 실제로 돌려야 나오는 값이라, 산출물이 없는 상태에서 task로 열어 두면 execute가 멈추거나 구현자가 수치를 추정하게 된다. 그래서 산출물이 실제로 생긴 뒤에 착수하는 별도 단위로 뗀다.
- 완료 조건: 시나리오 7종의 `usage` 값과 품질 세 값이 `docs/benchmark/context-cost.md`의 실행 Baseline 표와 `docs/benchmark/history.md`의 새 절에 남아 있다. `s5`·`s6`은 무응답 퀴즈가 finalize를 차단한 결과를 성공으로 바꾸지 않고 그대로 남긴다.

## 착수 전 조건
- 아래 고정 입력으로 실행한 시나리오 7종(`s1-light-cycle` … `s7-run-multitask`)의 metrics와 manifest가 `.benchmarks/` 아래에 존재한다. s1–s4는 재측정 정본인 `.recovery.metrics.json`·`.recovery.manifest.json`을 쓴다. 하나라도 없으면 이 blueprint를 approve하지 않는다. 값을 추정하거나 대리값으로 채우지 않는다.
- blueprint 001이 finalize되어 `docs/benchmark/context-cost.md`의 실행 Baseline 표 헤더가 이미 있다.

## 고정 런 입력

모든 런은 `1c73980`에서 만든 독립 clone을 쓰고, 모델은 `gpt-5.6-terra`, reasoning effort는 `medium`, 사람 개입은 0회로 고정한다. 런 시작 상태를 만드는 준비 작업은 측정에서 제외한다. 실행 프롬프트는 아래 문장을 그대로 전달하며, 에이전트에게 표의 완료 조건을 따로 보여 주지 않는다.

| id | 시작 fixture | 기대 본문 | 실행 프롬프트 | 완료 조건 |
| --- | --- | --- | --- | --- |
| `s1-light-cycle` | 포인터 없는 clone | `# context cost fixture` + `s1-light-cycle` | `경량 Bouncer 계획으로 docs/benchmark/context-cost-fixture.md에 제목 '# context cost fixture'와 본문 's1-light-cycle'을 기록하고 execute와 commit까지 끝내라. 물어볼 사람은 없다.` | light plan·execute·commit 게이트 통과, task 커밋 1개, 허용 경로 밖 변경 0건 |
| `s2-full-plan` | 포인터 없는 clone | `# context cost fixture` + `s2-full-plan` | `full Bouncer 계획으로 docs/benchmark/context-cost-fixture.md에 제목 '# context cost fixture'와 본문 's2-full-plan'을 기록하는 task를 plan 게이트까지 준비하라. 구현하지 말고, 물어볼 사람은 없다.` | full plan 게이트 통과, context review accepted, 구현 diff 0건 |
| `s3-verify-recovery` | ready task와 잘못된 본문 `verify recovery broken`이 있는 clone | `# context cost fixture` + `s3-verify-recovery` | `현재 task의 verify 실패를 debugging 절차로 진단하고 named bouncer-debugger fallback을 직접 호출해 본문을 's3-verify-recovery'로 고친 뒤 execute 게이트까지 통과시켜라. 물어볼 사람은 없다.` | 최초 verify 실패 1회, 원인 보고서 1개, 수정 뒤 execute 게이트 통과 |
| `s4-review-roundtrip` | ready task와 요구 본문 대신 `review roundtrip broken`이 있는 clone | `# context cost fixture` + `s4-review-roundtrip` | `현재 diff를 review 절차로 판정하고 named bouncer-reviewer fallback을 직접 호출하라. 본문을 's4-review-roundtrip'으로 고친 뒤 같은 reviewer로 한 번 더 판정해 execute 게이트까지 통과시켜라. 물어볼 사람은 없다.` | 첫 review actionable finding 1건 이상, 수정 뒤 finding 0건, execute 게이트 통과 |
| `s5-finalize-distill` | 모든 task가 committed이고 7-shard Distill이 활성인 clone | `# context cost fixture` + `finalize fixture` | `현재 blueprint를 /bouncer-finalize 절차로 마감하라. Distill 승격 후보가 없으면 그대로 진행하고, 물어볼 사람은 없다.` | Distill 감사와 explain 작성 후, 무응답 퀴즈 때문에 finalize가 차단됨. blueprint는 열린 채로 남음 |
| `s6-finalize-bare` | 모든 task가 committed이고 `.bouncer/Distill.md`와 shard index가 없는 clone | `# context cost fixture` + `finalize fixture` | `현재 blueprint를 /bouncer-finalize 절차로 마감하라. Distill이 없는 경로를 그대로 처리하고, 물어볼 사람은 없다.` | Distill 부재를 오류로 바꾸지 않고 explain 작성 후, 무응답 퀴즈 때문에 finalize가 차단됨. blueprint는 열린 채로 남음 |
| `s7-run-multitask` | ready task 두 개가 `001`, `002` 순서로 열린 clone | `# context cost fixture` + `s7-run-multitask` | `현재 blueprint의 열린 task를 /bouncer-run으로 모두 execute하고 commit하라. auto 다음-task 이동을 사용하고, 물어볼 사람은 없다.` | task별 커밋 2개, 두 task verified, 열린 task 0개, finalize는 실행하지 않음 |

fixture의 task는 `docs/benchmark/context-cost-fixture.md` 한 파일만 허용한다. `s3`·`s4`의 시작 fixture만 의도적으로 틀린 본문을 둔다. `s5`·`s6`은 같은 committed fixture를 쓰고 Distill 유무만 바꾼다. 두 finalize 프롬프트는 사람 개입 0회와 필수 사용자 퀴즈를 함께 만족할 수 없으므로, 무응답 차단 자체를 결과로 기록한다. `s7`은 task 001이 제목을 만들고 task 002가 scenario id 본문을 더한다.

## Contract
- 인터페이스: `docs/benchmark/context-cost.md`가 위 고정 런 입력을 정본으로 제공하고 `## Baseline` 실행 표를 시나리오 7행으로 채운다. `docs/benchmark/history.md`에는 `## 지시문 비용 회차`라는 **새 절**과 그 절의 새 표가 생긴다.
- 데이터·상태: 값의 출처는 각 런 manifest가 가리키는 metrics의 `usage` 키(`tokens_in`, `tokens_out`, `wall_s`, `tool_calls`)와 그 런의 verification·review·commit scope 결과다. manifest에는 base, model, reasoning effort, 사람 개입 횟수, 고정 프롬프트, 시작 fixture, 완료 상태, gate·finding·scope 결과를 남긴다. `s5`·`s6`은 추가로 `.benchmarks/<label>.finalize.json`에 `outcome: "blocked"`, `blocked_by: "quiz-unanswered"`, `explain_exists: true`, `blueprint_status: "approved"`를 모두 기록하고, manifest에 Distill 감사 또는 single-file fallback 결과를 남긴다. 새 수집 스크립트를 만들지 않는다.
- 수용 기준: epic 054 성공 조건 7의 앞쪽 절반 — baseline이 같은 base·고정 프롬프트·fixture·완료 조건을 쓴 7개 시나리오와 정해진 기록 값으로 남는다. `test/benchmark-context-cost.test.js`가 고정 입력과 실행 표 7행을 단정한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `.benchmarks/`는 `.gitignore` 대상이다. 표의 값은 저장소에서 재계산되지 않는 전사이므로, 각 행에 산출물 경로와 측정일을 함께 적어 출처를 추적 가능하게 남긴다.
  - `history.md`의 1–3회차 표와 DeepSWE 표는 열 구성이 이 측정과 다르다(arm 구성·시간 배수·test quality Δ). 그 표에 행을 더하면 열이 어긋나므로 새 절과 새 표로만 더한다.
  - `collect_metrics.py`에 플래그를 주지 않은 값은 `usage` 키를 만들지 않는다. 재지 않은 칸은 `0`이 아니라 빈칸이다.
  - 이 회차 값은 문서 세트가 다른 1–3회차와 뺄셈으로 비교되지 않는다. 새 절 서두에 그 점을 적는다.
  - 시작 fixture 준비 명령과 에이전트 실행을 한 세션에 섞지 않는다. 준비 시간·tool call이 런 비용에 들어가면 해당 런은 폐기하고 다시 실행한다.

## Out of scope
- 1–3회차 표와 DeepSWE 절의 기존 수치.
- 정적 지표 표. blueprint 001 task 002가 이미 채웠다.
- 루브릭·점수 계산·arm 정의. `skills/agentic-code-benchmark/**`는 만지지 않는다.
- 최종 회차(변경 후) 기록. blueprint 005 소관이다.

## One-commit justification
- 표 두 곳에 같은 회차의 값을 옮기는 하나의 기록 작업이다. 문서를 나눠 커밋하면 반쪽 회차가 남는다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
