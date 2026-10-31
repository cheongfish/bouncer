---
type: bouncer.blueprint
title: worker-tokens 중복 기록 거절과 coordinator 종료·Checklist 작성 규칙 보강
description: Reject a duplicate worker-tokens record for the same key unless --replace swaps it, add the coordinator exit rule for an unawaitable worker report, and add two Checklist authoring rules.
resource: .bouncer/context/epics/drive-execution/blueprints/worker-tokens-duplicate-guard/index.md
tags:
  - bouncer
  - blueprint
  - worker-tokens
  - coordinator
  - spec-authoring
timestamp: '2026-10-31T16:54:52.914+09:00'
bouncer:
  id: worker-tokens-duplicate-guard
  epic_id: drive-execution
  blueprint_id: worker-tokens-duplicate-guard
  status: closed
  order: 77
  commit_type: feat
  scale: full
  complexity: standard
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# worker-tokens 중복 기록 거절과 coordinator 종료·Checklist 작성 규칙 보강

Epic: [drive-execution](../../index.md)

## Intent
- `bouncer coordinate worker-tokens`가 같은 키에 이미 채워진 기록이 있으면 새 기록을 거절하고, 정정은 `--replace`로 기존 기록을 교체하는 한 경로로만 받는다.
- coordinator 문서에 worker 보고를 기다릴 수 없을 때의 종료 규칙을, 계획 작성 규칙 문서에 Checklist 분기 matrix 행 규칙과 문서 문구 단언 규칙을 더한다.

## Contract
- 인터페이스:
  - `bouncer coordinate worker-tokens`: 키는 `(task, role, perspective)`이고 task·perspective 부재는 빈 값으로 본다(`sumWorkerDecisions`와 같다). 같은 키에 이미 `worker-tokens` 기록이 있고 그 키에 비어 있는 worker 호출 자리가 없으면 `ok: false`, `reason: 'worker-tokens-duplicate'`로 거절하고 원장을 바꾸지 않는다. 비어 있는 자리는 키의 `worker-model` 수(`runs`)가 숫자 토큰 또는 `unreported`로 채워진 기록 수(`filled`)보다 클 때다. 같은 키로 worker를 여러 번 부른 경우(rework 재dispatch)에는 호출 수만큼 기록이 허용된다. 키에 `worker-tokens`가 하나도 없으면 첫 기록은 지금처럼 받는다.
  - `--replace`(값 없는 boolean 플래그, `worker-tokens` 전용): 키의 가장 나중 `worker-tokens` 기록 하나를 원장 `decisions`와(`--task`가 있으면) 그 task의 `decisions`에서 빼고 새 기록을 뒤에 붙인다. 추가가 아니라 교체이므로 키의 `worker-tokens` 기록 수는 그대로다. 성공 응답은 `decision`(새 기록)과 `replaced`(뺀 기록)를 싣는다. 교체할 기록이 없으면 `reason: 'worker-tokens-replace-target-missing'`으로 거절한다. 기존 관행인 "0을 먼저 기록한 뒤 실값", "`unreported`를 먼저 기록한 뒤 숫자"는 모두 `--replace`로만 정정한다.
  - `--replace x`처럼 값이 붙으면 usage(2), `worker-model`에 `--replace`를 주면 usage(2)다.
  - 문서: `rules/cli.md`의 `worker-tokens` 서술, `cli-usage.ts`의 usage·registry 줄, `skills/bouncer-run/references/agent-dispatch.md`의 토큰 기록 문단에 한 줄 안내가 있다.
  - `agents/bouncer-coordinator.md`: worker 보고를 기다릴 수 없을 때(`worker-report-missing`, `worker-state-unknown`) coordinator가 기다리거나 추측하지 않고 `blocked`로 끝낸다는 문단 하나를 가진다.
  - `references/spec-authoring/index.md`: Checklist 작성 규칙 두 개(Interface 분기 matrix의 셀마다 한 행, 문서·help 문구 단언의 회피와 문장 전체 결합)를 가진다.
- 데이터·상태: 원장 decision 모양(`{kind: 'worker-tokens', role, tokens | unreported, task?, perspective?}`)과 `metrics summary` 집계 규칙은 바뀌지 않는다. `--replace`만 기존 기록을 지운다. 그 밖의 거절은 원장 bytes를 바꾸지 않는다.
- 수용 기준: epic Success criteria 8·13이 참이다. 작업별 수용 기준은 각 task의 Goal & intent에 둔다.
  - 001: 같은 키의 두 번째 `worker-tokens`는 `worker-tokens-duplicate`로 거절되고, `--replace`는 기존 기록을 교체해 키의 합계가 새 값 하나이며, 다른 키와 호출 수만큼의 기록은 거절되지 않는다.
  - 002: coordinator 문서에 종료 문단이 있고 `## Worker dispatch` 본문 20줄 상한이 유지되며 Codex TOML이 새 md와 바이트 일치한다.
  - 003: `references/spec-authoring/index.md`에 두 규칙 문장이 있고 테스트가 두 문장 전체를 고정한다.
- 검증 명령: 작업별 래퍼(빌드 → task 테스트 → 정적 검사)는 001 `node scripts/verify-worker-tokens-duplicate-guard.js`, 002 `node scripts/verify-coordinator-exit-doc.js`, 003 `node scripts/verify-checklist-authoring-rules.js`이고, 종단 검증 004는 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - 대응 `worker-model`이 없는 키(`runs` 0)의 첫 `worker-tokens`는 받고 두 번째부터 거절한다.
  - 키가 `worker-model --tokens`로 이미 채워져 있고 `worker-tokens`가 없으면 거절하지 않는다. 이 중복 합산은 이번 범위 밖이며, `--replace`는 `worker-model` 기록을 고치지 못한다.
  - 거절 검사는 role·perspective·tokens·task 형식 검사 뒤에 온다. 형식이 틀린 입력의 거절 사유는 그대로다.
  - 이미 원장에 있는 중복 기록은 바꾸지 않는다. 집계는 계속 합산한다.
  - `--tokens unreported --replace`는 허용되며 키의 가장 나중 기록(숫자든 `unreported`든)을 교체한다.
  - 중복 거절 힌트 `next`는 `--replace`가 같은 호출의 잘못 기록한 값을 고칠 때만 쓴다고 말하고, rework 호출의 `worker-model` 기록이 빠졌으면 worker-model을 먼저 기록하라고 말한다.

## Out of scope
- `metrics summary`·`sumWorkerDecisions`·`pendingWorkerTokenKeys`의 집계 규칙 변경과 기존 원장 중복 기록의 자동 정리
- `worker-model --tokens` 기록의 교체·정정 경로
- `skills/bouncer-run/SKILL.md`의 판정표와 stop 이름 변경, coordinator card 문서(`references/coordinator-cards/**`) 변경
- `references/spec-authoring/tasks.md` 완성 예시 변경
- CHANGELOG·버전 문서 수정

## One-commit justification
- 세 변경은 모두 drive 실행 계약(worker 토큰 기록, coordinator의 보고 대기, 계획 Checklist 작성)을 좁게 보강하는 작업이라 한 PR 리뷰에서 같은 요청 근거로 판정된다. 경로가 서로 겹치지 않아 세 구현 task는 병렬로 돌고, 종단 검증 하나로 합쳐진다.
