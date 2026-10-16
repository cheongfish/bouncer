---
type: bouncer.epic
title: drive 회고 103 후속 보강
description: 'RETRO-103-001 follow-ups: reject duplicate fingerprints at context-review record and record subagent token usage'
resource: .bouncer/context/epics/104-drive-retro-103-followups/index.md
tags:
  - bouncer
  - epic
  - context-review
  - metrics
  - coordinator
timestamp: '2026-10-16T11:40:12.131+09:00'
bouncer:
  id: '104'
  epic_id: '104'
  status: approved
  supersedes: []
---
# drive 회고 103 후속 보강

## Intent
- 문제: context-review `record`는 같은 fingerprint가 겹친 round를 받고 `close`에서야 거부해, 같은 round를 다시 기록할 수 없는 막다른 길이 생긴다. 서브에이전트의 cache 토큰과 coordinator가 띄운 하위 에이전트의 토큰은 기록할 곳이 없어 단계별 비용을 비교할 수 없다.
- 목표: 중복 fingerprint는 기록 단계에서 막고, 토큰은 호스트가 알려 준 값만 기록·합산하는 자리를 만든다. 호스트가 값을 주지 않으면 추정하지 않고 `null`로 남긴다.

## Success criteria
1. `bouncer context-review record`가 같은 fingerprint를 가진 finding이 둘 이상인 round를 어떤 status에서도 `context-review-input-invalid`로 거부하고, 사유 문구는 `close`의 `context-review duplicate fingerprint <fp>`와 같다.
2. 거부된 round는 state와 보고 파일을 바꾸지 않아, 합친 입력을 같은 round 번호로 다시 기록할 수 있다.
3. `bouncer metrics end`가 `--cache-read-tokens`·`--cache-write-tokens`를 받아 저장하고, 주지 않으면 `null`과 사유를 남긴다. `metrics summary`가 cache 합계와 누락 수를 낸다.
4. cache 필드가 없는 기존 `drive-metrics.json`이 오류 없이 읽히고 누락으로 센다. 파일 `version`은 1 그대로다.
5. `bouncer coordinate worker-model`이 `implementer` role과 선택 `--tokens`를 받고, 늦게 오는 값은 토큰만 담은 `worker-tokens` decision으로 덧붙일 수 있다.
6. `metrics summary`의 `worker_tokens`는 `coordinator-session` 토큰 총량과 따로 계산되고, 값이 없는 기록은 합이 아니라 누락으로 센다.
7. 바뀐 CLI 동작이 `--help`, `rules/cli.md`, coordinator 카드, 테스트에 반영된다.

## Out of scope
- 실행 리뷰 `recordReview`: 이미 record 시점에 중복 fingerprint를 거부한다.
- 호스트가 주지 않은 토큰·cache 값을 추정해 채우는 일. 호스트가 cache 값을 내주기 전까지 cache 필드는 비어 있다.
- `metrics.pricing`에 cache 단가를 더하는 일.
- 기록된 runtime 상태를 직접 고치는 우회 경로와 그 분류기 규칙.

## Blueprints
* [001 record 사전 거부와 토큰 계측](blueprints/001-record-guard-and-token-metrics/index.md) - `context-review-state.ts`의 record 검사, `drive-metrics.ts`·`coordinator.ts`의 토큰 필드와 합산, CLI help·coordinator 카드 갱신
