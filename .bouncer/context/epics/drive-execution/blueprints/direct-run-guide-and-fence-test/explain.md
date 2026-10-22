---
type: bouncer.explain
title: direct-run-guide-and-fence-test explain
description: Explain for direct-run-guide-and-fence-test
resource: .bouncer/context/epics/drive-execution/blueprints/direct-run-guide-and-fence-test/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T22:57:21.812+09:00'
bouncer:
  id: EXPLAIN-direct-run-guide-and-fence-test
  epic_id: drive-execution
  blueprint_id: direct-run-guide-and-fence-test
  status: published
  comprehension:
    - range_from: 3a0af6d5a68aea45ab103082663b54b598df794e
      range_to: 7942eac0b367d22713b6b73cb837d0d4e73a4e6a
      diff_sha: a7749a3efc6f455ad2ee09d8d0a4e6fd2b4c34e2c28f24c9b62e6d6dc6f50988
      recorded_at: '2026-10-22T23:20:00+09:00'
  task_commits:
    - task: drive-execution/direct-run-guide-and-fence-test/001
      sha: 7942eac0
      intent_anchor: task-001
---
# Explain

## Background

coordinator 원장을 바꾸는 명령은 `ledgerPath`와 `ledgerHash`로 fence를 확인하고, 어긋나면 reason을 돌려주며 원장을 쓰지 않는다. 형식이 틀리면 `ledger-checkpoint-invalid`, 형식은 맞는데 해시가 현재 원장과 다르면 `stale-ledger-checkpoint`다. 그런데 기존 테스트는 두 reason을 정규식 하나로 받아서 어느 쪽이 나와도 통과했다. direct 실행 문서에는 `metrics end` 시점과 `coordinate` 명령을 실행할 cwd 안내도 빠져 있었다. 이번 변경은 동작 없이 단언과 문서만 고친다.

## Code

- `test/coordinator.test.js` — fence 거절 루프의 케이스마다 기대 reason을 정하고 `assert.strictEqual`로 비교한다. `stale hash`만 `stale-ledger-checkpoint`이고 나머지 7개는 `ledger-checkpoint-invalid`다. `note` 테스트의 `'0'.repeat(64)`는 형식이 맞고 해시만 달라 `stale-ledger-checkpoint`로 고정했다.
- `skills/bouncer-run/references/direct-run.md` — `coordinate next`·`advance`는 integration cwd에서 `--task <ddd>`와 함께, `report`·`record`는 `next`가 돌려준 worker `cwd`에서 실행한다는 문단을 추가했다.
- `skills/bouncer-run/references/drive-metrics.md` — `metrics end`는 `done` 또는 handoff 때 단독으로 한 번만 실행한다. 닫힌 세션에 다시 부르면 `metrics-session-ended`가 나온다.

## Quiz

1. 형식은 맞지만 현재 원장과 다른 해시(`'0'.repeat(64)`)로 `coordinate note`를 부르면 어떤 reason으로 거절되는가? (A) `ledger-checkpoint-invalid` (B) `stale-ledger-checkpoint` (C) `lease-invalid`

## Tasks

### drive-execution/direct-run-guide-and-fence-test/001 · `7942eac0`

#### Goal & intent

session-handoff-note 회고 후보 1~3을 반영한다. 동작은 바꾸지 않고 테스트 단언과 문서 문장만 고친다. 완료 명령은 `bouncer.verify`다.

#### Touch

- Modify `test/coordinator.test.js` — (a) fence 거절 루프(`:2636`)는 케이스별 기대 reason을 갖게 한다. `stale hash`만 `stale-ledger-checkpoint`이고 나머지(`missing both`, `missing hash`, `missing path`, `absolute`, `escaping`, `wrong path`, `bad hash shape`)는 `ledger-checkpoint-invalid`다(`assertLedgerFence`, `coordinator-ledger.ts:55-70`). `assert.match`를 `assert.strictEqual(rejected.reason, entry.reason, entry.label)`로 바꾼다. (b) `note` 테스트(`:5545`)는 `'0'.repeat(64)`가 형식은 맞고 해시만 다르므로 `assert.strictEqual(r.reason, 'stale-ledger-checkpoint')`로 바꾼다.
- Modify `skills/bouncer-run/references/direct-run.md` — Procedure 표 아래에 한 문단을 추가한다: `coordinate next`·`advance`는 `--task <ddd>`를 붙여 integration cwd에서 실행하고, `report`·`record`는 `next`가 돌려준 worker `cwd`에서 실행한다. 표와 Handoff 절의 판독 블록은 바꾸지 않는다.
- Modify `skills/bouncer-run/references/drive-metrics.md` — "Per root-direct session" 절에 한 문장을 추가한다: `metrics end`는 `done` 또는 handoff 때 한 번만, 다른 명령과 한 줄로 묶지 않고 단독으로 실행한다(닫힌 세션에 다시 부르면 `metrics-session-ended`).

### drive-execution/direct-run-guide-and-fence-test/002

#### Goal & intent

구현 task가 통합된 head에서 전체 검증 `npm run ci`가 통과함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.