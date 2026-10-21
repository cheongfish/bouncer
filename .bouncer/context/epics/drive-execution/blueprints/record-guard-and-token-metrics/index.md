---
type: bouncer.blueprint
title: record 중복 fingerprint 사전 거부와 서브에이전트 토큰 계측
description: Reject duplicate fingerprints at context-review record and add cache and worker token fields to drive metrics
resource: .bouncer/context/epics/drive-execution/blueprints/record-guard-and-token-metrics/index.md
tags:
  - bouncer
  - blueprint
  - context-review
  - metrics
  - coordinator
timestamp: '2026-10-16T11:40:12.237+09:00'
bouncer:
  id: record-guard-and-token-metrics
  epic_id: drive-execution
  blueprint_id: record-guard-and-token-metrics
  status: closed
  order: 57
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# record 중복 fingerprint 사전 거부와 서브에이전트 토큰 계측

Epic: [104](../../../drive-retro-103-followups/index.md)

## Intent
- 문제: `context-review record`가 중복 fingerprint round를 받아 `close`에서 거부하므로 같은 round를 다시 기록할 수 없고, cache 토큰과 coordinator가 띄운 하위 에이전트 토큰은 기록할 곳이 없다.
- 완료 조건: 중복 fingerprint는 기록 단계에서 상태 변경 없이 거부되고, 토큰은 호스트가 알려 준 값만 저장·합산된다.

## Contract
- 인터페이스:
  - `context-review record`: 새 플래그 없음. 중복 fingerprint 입력의 응답만 `{ ok: false, reason: 'context-review-input-invalid', cause: ['context-review duplicate fingerprint <fp>'] }`로 바뀐다.
  - `metrics end`: `--cache-read-tokens <n>`, `--cache-write-tokens <n>` 추가. `--tokens`와 같은 정수 규칙이다.
  - `coordinate worker-model`: `--role implementer` 허용, `--tokens <n>` 추가. 잘못된 `--tokens`는 `tokens-invalid`로 거부한다.
  - `coordinate worker-tokens --role <implementer|reviewer|debugger> --tokens <n> [--task <ddd>] [--perspective <name>]`: 토큰만 담은 decision을 덧붙이는 새 하위 명령. 거절은 `worker-model`과 같고 잘못된 `--tokens`는 `tokens-invalid`다.
- 데이터·상태:
  - 세션에 `cache_read_tokens`·`cache_write_tokens`(`number | null`)와 `cache_unavailable_reason`을 더한다. 파일 `version`은 1 그대로다.
  - 원장 decision에 `{ kind: 'worker-tokens', role, tokens, task?, perspective? }`를 더하고, `worker-model` decision에 선택 필드 `tokens`를 더한다.
  - `metrics summary`는 `kinds` 옆에 두 키를 더한다. `cache`는 `{ read: { total, missing }, write: { total, missing } }`이고, `worker_tokens`는 `{ total, missing, by_role }`이며 `by_role`의 각 항목은 `{ total, missing }`이다.
- 수용 기준: 에픽 성공 기준 1~7을 task마다 나누어 만족한다.
  - TASKS-001이 1·2, TASKS-002가 3·4, TASKS-003이 5·6을 맡는다. 7은 task마다 자기 CLI 변경을 맡고 TASKS-001이 `rules/cli.md`의 `context-review record` 문단, TASKS-002가 `metrics end` help, TASKS-003이 `rules/cli.md`의 `coordinate` 문단과 카드를 갱신한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 거부된 round가 보고 파일·state를 남기면 재기록이 막힌다. 거부 검사는 모든 쓰기 앞에 둔다.
  - 같은 transition key 재요청의 no-op 응답은 그대로다.
  - 음수·소수·비숫자 토큰 값은 `metrics end`에서 `invalid-metrics-input`(exit 1), `coordinate worker-model`·`worker-tokens`에서 `tokens-invalid`로 거부한다.
  - 같은 (task, role, perspective)로 worker-model이 여러 번 기록될 수 있다. 토큰은 기록마다 한 번 나오므로 합산하고, 누락은 `max(0, worker-model 기록 수 − 토큰이 달린 기록 수)`로 센다. slug 거절 뒤 다시 적은 기록은 누락으로 셀 수 있다.
  - task 없는 기록(debugger, 최종 리뷰)은 task 키를 빈 값으로 묶는다.
  - `null`과 `0`을 구분한다.
  - 호스트가 cache 값을 주지 않는 동안 cache 필드는 비어 있다.

## Out of scope
- 실행 리뷰 `recordReview`와 `collectFindingFailures` 자체의 변경.
- cache 단가와 `metrics.pricing` 변경.
- 호스트가 주지 않은 값의 추정.
- `runtime-state.ts`의 원장 검증 변경(새 decision kind는 기존 검증을 통과한다).

## One-commit justification
- 세 변경은 한 회고(RETRO-103-001)의 후보이고, 공통 작업 단위는 "기록 시점에 막거나 남기는 것"이다. task 3개가 서로 다른 경로를 고치고 TASKS-003만 TASKS-002의 `summarize`를 이어받아, 한 PR에서 순서대로 검토할 수 있다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
