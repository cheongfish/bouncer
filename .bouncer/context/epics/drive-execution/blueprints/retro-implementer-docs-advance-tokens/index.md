---
type: bouncer.blueprint
title: 구현자 보고·모델 기록 문서 보강과 advance의 구현자 토큰 검사 확대
description: Add implementer Tests word rule, worker-model record wording and drive-metrics intermediate-token note to docs, and make coordinate advance check implementer worker-tokens for every task
resource: .bouncer/context/epics/drive-execution/blueprints/retro-implementer-docs-advance-tokens/index.md
tags:
  - bouncer
  - blueprint
  - implementer
  - worker-tokens
  - drive-metrics
  - advance
timestamp: '2026-10-31T18:00:38.632+09:00'
bouncer:
  id: retro-implementer-docs-advance-tokens
  epic_id: drive-execution
  blueprint_id: retro-implementer-docs-advance-tokens
  status: closed
  order: 78
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# 구현자 보고·모델 기록 문서 보강과 advance의 구현자 토큰 검사 확대

Epic: [drive-execution](../../index.md)

## Intent
- PR #305 drive 회고에서 나온 네 건 중, 구현자 `## Tests` 낱말 제약, 구현자 worker-model 기록 값, coordinator 세션 종료 시 중간 알림 토큰 금지는 문서 한 줄씩으로 막고, 구현자 토큰이 빠진 채 `coordinate advance`가 넘어가는 구멍은 CLI 검사 범위를 넓혀 막는다.
- 구현자 worker-model 기록은 완료 뒤에 남으므로, task 없이 부른 `advance`도 끝난 구현자 키는 task와 상관없이 검사한다.

## Contract
- 인터페이스:
  - `bouncer coordinate advance [--task <T>]`: 기존 검사 범위(task 없는 키, `--task`가 있으면 그 task의 키)에 더해, role이 `implementer`인 모든 task의 키도 검사한다. 미충족이 있으면 기존 그대로 `worker-tokens-missing`(exit 1, `executed` 없음, `pending`에 키 목록)으로 거절하고 원장을 바꾸지 않는다. `coordinate record --task <T>`의 검사 범위는 그대로다.
  - 문서: `agents/bouncer-implementer.md`(와 Codex 생성본)에 `## Tests` 낱말 제약 한 줄, `skills/bouncer-run/references/agent-dispatch.md`에 구현자 `worker-model` 기록 값 문장 하나, `skills/bouncer-run/references/drive-metrics.md`에 Claude Code 최종 알림 문장 하나, `rules/cli.md`에 새 검사 범위 문장을 둔다.
- 데이터·상태: 원장 decision 모양, `pendingWorkerTokenKeys`·`workerKeyState`의 `runs`/`filled` 정의, `metrics summary` 집계는 바뀌지 않는다. 바뀌는 것은 `workerTokensGuard`가 어느 키를 이 집계에 넣는가뿐이다.
- 수용 기준: epic Success criteria 8·13이 참이다. 작업별 수용 기준은 각 task의 Goal & intent에 둔다.
  - 001: implementer 문서 Guardrails에 `## Tests`에 fail/error 계열 낱말이 있으면 `report-tests-invalid`로 거절된다는 한 줄과 대체 표기가 있고, Codex 생성본이 새 문서와 일치하며 테스트가 그 문장 전체를 고정한다.
  - 002(문서 한 문장씩 범위: Claude Code 행의 "and intermediate notifications" 구절 수정은 drive-metrics 문장의 일부다): agent-dispatch 구현자 항목이 `worker-model --model`의 값을 `bouncer subagent-model --agent bouncer-implementer` 출력 한 줄로 못박고, drive-metrics가 중간 알림 토큰으로 `metrics end`를 부르지 않는다고 적으며 테스트가 두 문장 전체를 고정한다.
  - 003: task 없는 `advance`가 토큰 기록 없는 끝난 구현자 키(task 범위)를 `worker-tokens-missing`으로 거절하고, 같은 입력의 reviewer·debugger task 키는 계속 무시한다.
- 검증 명령: 작업별 래퍼(빌드 → task 테스트 → 정적 검사)는 001 `node scripts/verify-implementer-tests-word-doc.js`, 002 `node scripts/verify-run-docs-model-usage.js`, 003 `node scripts/verify-advance-implementer-tokens.js`이고, 종단 검증 004는 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - 구현자 `worker-model` 기록이 아예 없는 task는 `runs`가 0이라 이 검사에 걸리지 않는다. 이 변경은 "기록은 했으나 토큰이 없는" 키만 잡는다.
  - 병렬 wave에서 다른 task의 reviewer·debugger는 dispatch 직전에 `worker-model`이 남아 실행 중일 수 있으므로 task 범위 검사에 넣지 않는다. 구현자만 완료 뒤에 기록하므로 넓혀도 실행 중 worker 때문에 거절되지 않는다.
  - 구현자 `worker-model` 기록을 worker가 끝나기 전에 토큰 없이 남기면 다음 `advance`가 그 키로 거절된다. coordinator는 worker 보고를 기다린 뒤 기록하고, 실행 중 worker의 키를 `unreported`로 미리 채우지 않는다.
  - 이 변경 전에 시작된 drive에서 구현자 토큰 없는 기록이 남아 있으면 다음 `advance`가 거절한다. `--tokens unreported`(알면 숫자)로 기록해 복구한다.

## Out of scope
- `metrics summary`·`sumWorkerDecisions`·`pendingWorkerTokenKeys`의 집계 규칙 변경
- worker-model 기록의 모델 값 거절·경고 코드 추가(문서 문구만 고친다)
- 구현자 `worker-model` 기록이 없는 키의 탐지, `dispatch` 결정을 run으로 세는 변경
- `coordinate record`의 검사 범위 변경, `bouncer metrics end` 코드 변경
- `skills/bouncer-run/SKILL.md`의 판정표, `references/coordinator-cards/**`, 계획 작성 규칙 문서 변경
- CHANGELOG·버전 문서 수정

## One-commit justification
- 네 건은 모두 PR #305 drive가 드러낸 같은 마찰(구현자 보고·모델·토큰 기록 누락)을 막는 좁은 보강이고, 한 PR에서 같은 요청 근거로 리뷰된다. 경로가 서로 겹치지 않아 구현 task 셋은 병렬로 돌고 종단 검증 하나로 합쳐진다.
