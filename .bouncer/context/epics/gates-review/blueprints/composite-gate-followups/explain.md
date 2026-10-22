---
type: bouncer.explain
title: composite-gate-followups explain
description: Explain for composite-gate-followups
resource: .bouncer/context/epics/gates-review/blueprints/composite-gate-followups/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-22T22:46:26.061+09:00'
bouncer:
  id: EXPLAIN-composite-gate-followups
  epic_id: gates-review
  blueprint_id: composite-gate-followups
  status: published
  comprehension:
    - range_from: c423bc9552eb1f9d31107c2792110612c325a623
      range_to: 47cb219129f64bf89544c2caeabae3553e0eea6c
      diff_sha: 2e77fee8849c9f686fe51c82cc77c88575f1a5c7b139a944c89a67bce86398c3
      recorded_at: '2026-10-22T22:55:00+09:00'
  task_commits:
    - task: gates-review/composite-gate-followups/001
      sha: 47cb2191
      intent_anchor: task-001
---
# Explain

## Background

복합 gate 출력은 실패한 G 코드를 gate 단위로 묶어 사용자에게 복구 문장 하나를 보여 준다. 그런데 출력 계약 문서의 "복합 gate가 없는 실패" 예시가 실제 S10이 아니라 G7 문구를 가져와 있었고, gate 복구 문장(`next`)을 고르는 규칙과 commit hook의 `[커밋 범위]` 라벨 일부는 테스트가 없었다. 이번 변경은 동작을 바꾸지 않고 예시·문구·테스트만 실제 동작에 맞춘다.

## Code

- `rules/output.md` — S10 예시를 `blueprintDir must be under .bouncer/context/epics`로 교체했다. S10에는 `next`가 없어 복구 문구는 새로 쓴 것이다.
- `scripts/src/lib/composite-gates.ts` — `summarizeCompositeGates`의 `next`는 그 gate에서 비어 있지 않은 첫 실패의 값이고, 없으면 `COMPOSITE_GATES`의 gate 기본 문장이다. 코드는 그대로이고 docstring만 이 규칙에 맞췄다. `rules/cli.md`에도 같은 규칙을 한 문장 덧붙였다.
- `test/composite-gates.test.js` — 첫 실패에 `next`가 없을 때와 모든 실패에 `next`가 없을 때를 추가했다.
- `test/commit-hook.test.js` — 라벨이 줄 맨 앞에 오는지 고정하고, 라벨 매핑이 없는 reason(`unreadable-ledger`)은 `[` 없이 `commit blocked: …`로 시작함을 확인한다.

## Quiz

1. 같은 gate의 실패 둘 중 첫째에 `next`가 없고 둘째에 있으면 gate의 `next`는 무엇인가? (A) gate 기본 문장 (B) 둘째 실패의 `next` (C) 두 값을 이어 붙인 문장

## Tasks

### gates-review/composite-gate-followups/001 · `47cb2191`

#### Goal & intent

PR #257 후속 3건을 한 번에 정리한다. 동작은 바꾸지 않고 문서 예시, 테스트 단언, 문구만 고친다. 완료 명령은 `bouncer.verify`다.

#### Touch

- Modify `rules/output.md` — "복합 gate가 없는 실패" 예시(`:29-31`)가 G7의 원인·경로·복구를 가져와 있다. 실제 S10(`validate.ts:206-208`, `blueprintDir must be under .bouncer/context/epics`)으로 바꾼다: `실패 S10: blueprintDir must be under .bouncer/context/epics · 관련 경로: <blueprintDir> · 복구: blueprint를 .bouncer/context/epics 아래 정본 경로로 옮긴 뒤 gate를 다시 실행`. S10에는 `next`가 없어 복구 문구는 새로 쓴 것이다.
- Modify `scripts/src/lib/composite-gates.ts` — `summarizeCompositeGates` docstring만 고친다. "그 gate의 첫 실패 항목의 next"를 "그 gate에서 `next`가 비어 있지 않은 첫 실패의 값이고, 없으면 gate 기본 문장"으로 맞춘다. 코드는 그대로다.
- Modify `rules/cli.md` — `:561` 부근 "the gate's single `next`" 설명에 같은 선택 규칙(비어 있지 않은 첫 `next`, 없으면 gate 기본 문장)을 한 문장으로 덧붙인다.
- Modify `test/composite-gates.test.js` — `summarizeCompositeGates` 테스트에 두 경우를 추가한다: (a) 같은 gate의 첫 실패에 `next`가 없고 둘째에 있으면 둘째의 값을 쓴다, (b) 같은 gate의 모든 실패에 `next`가 없으면 `COMPOSITE_GATES`의 그 gate 기본 문장을 쓴다. 기존 테스트는 첫 항목에 `next`가 있는 경우만 본다.
- Modify `test/commit-hook.test.js` — (a) `cross-drive-ledger-unreadable` 테스트(`:637`)의 `/commit blocked: .../`를 `/^\[커밋 범위\] commit blocked: cross-drive-ledger-unreadable: \/other\/ledger/`로 줄 맨 앞을 고정한다. (b) 매핑 없는 reason `unreadable-ledger`(scope.ts가 읽을 수 없는 원장에서 내는 값)로 hook이 거절될 때 `reason`이 `[`로 시작하지 않고 `commit blocked: unreadable-ledger: `로 시작함을 단언하는 테스트를 추가한다(`coordinatorDeps`에 `coordinator: { active: true, reason: 'unreadable-ledger', scope: null }`).

### gates-review/composite-gate-followups/002

#### Goal & intent

구현 task가 통합된 head에서 전체 검증 `npm run ci`가 통과함을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.