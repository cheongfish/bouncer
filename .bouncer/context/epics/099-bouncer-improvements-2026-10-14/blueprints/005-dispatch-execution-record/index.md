---
type: bouncer.blueprint
title: dispatch 완료 판정과 워커 모델 기록
description: Defines dispatch completion and final metrics rules, adds a pre-dispatch coordinator model check, and records worker dispatch models in the coordinator ledger.
resource: .bouncer/context/epics/099-bouncer-improvements-2026-10-14/blueprints/005-dispatch-execution-record/index.md
tags:
  - bouncer
  - blueprint
  - dispatch
  - metrics
  - coordinator
  - ledger
timestamp: '2026-10-14T15:32:01.114+09:00'
bouncer:
  id: '005'
  epic_id: '099'
  blueprint_id: '005'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# dispatch 완료 판정과 워커 모델 기록

Epic: [099](../../index.md)

## Intent
결과 본문 없는 완료 알림으로 metrics를 닫거나 디스패치 뒤에야 모델을 확인하던 절차를 바로잡고, coordinator가 워커에 넘긴 모델 인자를 원장에 남겨 설정과 대조할 수 있게 함.
문서 규칙과 CLI 기록은 서로 다른 경로를 고치므로 두 task로 나눠 병렬로 진행함.

## Contract
- 인터페이스:
  - `rules/subagent-model.md` item 6에 완료 판정과 최종 metrics 문장을 둔다. 새 item 8은 지연 로드 툴의 스키마를 먼저 로드한다는 규칙이다.
  - `/bouncer-run` step 4는 coordinator dispatch 직전에 `bouncer subagent-model --agent bouncer-coordinator`를 실행하고 그 출력을 사용자에게 보고한다.
  - `bouncer coordinate dispatch ... [--model <value>]`: 값이 있으면 task `dispatch.model`과 dispatch decision `model`에 기록한다. 값 없이 주거나 빈 값이면 `model-invalid`로 거절한다.
  - `bouncer coordinate worker-model --blueprint <dir> --role <reviewer|debugger> --model <value> --ledger-path <p> --ledger-hash <h> [--task <ddd>] [--perspective <name>]`: 원장에 `kind: 'worker-model'` decision을 추가한다. 거절 reason은 `worker-model-role-invalid`·`worker-model-perspective-invalid`·`model-invalid`와 기존 fence·cwd·task reason이다.
- 데이터·상태:
  - `DispatchState`와 dispatch decision에 선택 키 `model`이 생긴다.
  - 원장 decisions에 `worker-model` kind가 생긴다(`role`, `model`, 선택 `task`·`perspective`).
  - 기존 원장은 마이그레이션 없이 읽힌다. dispatch 응답 `metadata` shape는 바뀌지 않는다.
- 수용 기준: epic 성공 기준 23–28.
- 검증 명령: task별 focused 테스트는 Checklist에 두고, 최종 검증은 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - 결과 본문 없는 `completed` 알림만 오면 대기를 계속하고 `metrics end`를 호출하지 않는다. hand-back 보고가 왔는데 알림이 없으면 기존처럼 토큰 플래그 없이 닫는다.
  - `inherit`은 정상 모델 인자로 기록한다. slug 거절 뒤 `inherit` 재시도는 재시도 값을 다시 기록한다.
  - blueprint 최종 리뷰의 reviewer는 `--task` 없이 기록한다. `--perspective`는 reviewer에만, `REVIEW_PERSPECTIVE` 값만 허용한다.
  - worker-model은 dispatch·lease·status·attempt를 바꾸지 않는다. 실패한 호출은 원장을 쓰지 않는다.
  - 원장 기록은 coordinator가 넘긴 인자다. host가 실제로 그 모델로 실행했다는 증명은 아니다.

## Out of scope
- light-run·단독 `/bouncer-execute`·plan context-reviewer의 모델 기록, host 실행 모델 검증.
- `metrics` 스키마·pricing 계산, `config.json` 모델 설정, `coordinate next`의 dispatch argv 생성 변경.
- coordinator 역할 문서(`agents/bouncer-coordinator.md`)와 생성 TOML 변경.
- 백로그의 다른 항목(B-04 tier 등록, B-09 retro 근거 등).

## One-commit justification
- 네 항목은 모두 dispatch 실행 기록의 정확성을 다루는 백로그 8절 4번 묶음이라 한 PR로 리뷰받는다. 문서 규칙(TASKS-001)과 CLI·원장 기록(TASKS-002)은 경로가 겹치지 않아 두 task로 나눠 병렬로 진행한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - dispatch 완료 판정·최종 metrics·사전 모델 확인·지연 로드 툴 규칙
* [Tasks 002](tasks/002/tasks.md) - 워커 dispatch 모델의 원장 기록
* [Verification](tasks/001/verification.md) - task별 실행 검증 증적
* [Review](review.md) - blueprint 최종 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
