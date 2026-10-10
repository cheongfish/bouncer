---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/090-drive-reliability/blueprints/002-early-handback-recovery/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-10T14:45:01.414+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '090'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 02bf1d86b6963806b11b0b30845485ccfb502f4e
      range_to: 157fb6d986755b5e1bd50b9ce9686e36c2fbe220
      diff_sha: 32897afc73419bc1f9e0187d175a83da2575b22439d65ca95406cbcb500129b2
      recorded_at: '2026-10-10T14:45:39+09:00'
  task_commits:
    - task: EPIC-090/BP-002/TASK-001
      sha: 0f32458f
      intent_anchor: task-001
    - task: EPIC-090/BP-002/TASK-002
      sha: 157fb6d9
      intent_anchor: task-002
---
# Explain

## Background

드라이브를 맡은 코디네이터가 일찍 반환하면, 루트 세션은 원장에 `active`가 남아 있다는 이유로 워커가 아직 돌고 있다고 오해하기 쉽다. 실제로는 `active`가 호스트 실행 전에 기록되고, 오래된 report도 원장 해시를 바꾼다. 이 변경은 CLI가 실행기를 추적하지 못한다는 한계를 출력에 드러내고, 조기 반환 시 기다림, 상태 보존 후 중단, 제한된 1회 재개 중 무엇을 할지 정한다.

## Intuition

가게 불이 켜져 있다고 점원이 안에 있다고 단정하지 않는다. 문 앞에서 실제로 사람을 확인할 수 있을 때만 "있다"고 말하고, 확인할 수 없으면 "모름"으로 두고 멈춘다.

## Code

- `scripts/src/lib/coordinator.ts`: `projectCheckpoint`가 읽기 전용 `executor_observation`(`unknown` / `unavailable` / `executor-state-not-tracked`)을 붙인다. 원장에는 저장하지 않는다.
- `skills/bouncer-run/SKILL.md` step 4: 관측값별 루트 동작 표와 1회 복구 재개 예외.
- `rules/cli.md`: `executor_observation`과 원장 `active`·해시가 생존 증거가 아니라는 설명.
- `test/coordinator.test.js`, `test/cli-coordinate.test.js`, `test/skill-bouncer-run.test.js`: 위 동작의 검증.

## Quiz

1. `coordinate status`의 `executor_observation`은 현재 어떤 값을 돌려주는가?
   - A) `running`, 원장의 `dispatch.status`가 `active`일 때
   - B) `{ state: 'unknown', source: 'unavailable', reason: 'executor-state-not-tracked' }`
   - C) `terminated`, 마지막 report가 있을 때
2. 원장의 `dispatch.status: active`와 바뀐 `ledger.sha256`은 무엇을 뜻하는가?
   - A) 워커가 실행 중이고 진행이 있다는 증거다.
   - B) 워커가 방금 report를 마쳤다는 증거다.
   - C) 워커 생존이나 진행의 증거가 아니다. 해시는 fencing 토큰일 뿐이다.
3. 모든 워커가 종료됐고 새로 통합된 작업은 없는데, 결정되지 않은 raw report가 있으면 루트는 어떻게 하는가?
   - A) 복구용 재디스패치를 한 번 한다.
   - B) 곧바로 `no-progress`로 중단한다.
   - C) raw report를 직접 검증해 통합한다.
4. 관측값이 `unknown`이면 루트는 어떻게 하는가?
   - A) 같은 핸들을 계속 기다린다.
   - B) 원장을 믿고 코디네이터를 다시 디스패치한다.
   - C) `worker-state-unknown`으로 중단하고 원장, worktree, 포인터를 보존한다.

## Tasks

### EPIC-090/BP-002/TASK-001 · `0f32458f`

#### Goal & intent

원장의 active와 실제 실행 상태를 구분해 신규 통합 없는 continue의 대기·중단·재개를 결정한다. 에픽 수용 기준 4·5·6·11·12을 만족해야 한다. 최종 검증은 npm run ci를 사용하고, focused tests는 Checklist에 명시한다.

#### Current behavior

- scripts/src/lib/coordinator.ts:70-73의 DispatchState에는 active/reported와 attempt만 있고 실행 핸들·PID·heartbeat가 없다. :460-471의 projection은 그 값을 복사하고 :2910-2920의 status는 실행기를 조회하지 않는다.
- scripts/src/lib/coordinator.ts:3335는 호스트 launch 전에 active를 기록한다. :3385의 stale report 감사 기록도 원장 해시를 바꾸므로 active·sha256 변화는 생존이나 유효 진전의 증거가 아니다.
- scripts/src/lib/print-dispatch.ts:326-335는 spawnSync로 실제 호출 종료까지 기다리지만 :23-43의 결과에는 독립 워커를 다시 관측할 실행 identity가 없다. native child handle을 root에 전달하는 registry도 없다.
- skills/bouncer-run/SKILL.md:141-157은 세션별 completed_tasks 수가 늘지 않으면 바로 no-progress로 중단한다. :179에 대응하는 테스트는 root가 attempt metadata를 소유하지 않게 한다.
- scripts/src/lib/coordinator-input.ts:40은 전체 checkpoint를 직렬화한다. cli-git-commands.ts:600-625가 입력 파일을 쓰고 coordinate-output.ts:33-41은 추가 필드를 보존한다.
- test/coordinator.test.js:1768의 checkpoint fixture와 test/cli-coordinate.test.js:859의 status --write-input fixture를 재현 기준으로 사용한다.

#### Target behavior

- 성공: status가 unknown 관측 한계를 명시하고 기존 dispatch·completed summary를 보존한다. 루트는 실제 호스트 핸들이 있는 경우에만 running/terminated를 채팅 실행 상태로 확인한다. 종료 및 최종 보고를 확인한 뒤 최신 checkpoint 입력으로 coordinator를 재개한다.
- 실패: 접근 가능한 실제 실행 핸들이 없거나 worker inventory를 확정할 수 없으면 worker-state-unknown으로 중단하고 ledger/worktrees/pointer를 보존한다. 보고가 없는 종료는 worker-report-missing으로 중단한다. 안전한 종료 뒤 신규 통합·미판정 보고가 모두 없으면 no-progress다.
- 보존: 해시 갱신은 fencing token만 갱신한다. root는 보고를 판단하지 않고 raw report를 기존 payload와 함께 coordinator에게 데이터로 전달한다. active attempt를 지우거나 revoke/requeue로 중복 실행을 허용하지 않는다.
- 반복: 미판정 보고를 전달하는 복구 dispatch는 해당 조기 반환에 한 번만 허용한다. 신규 통합 없는 두 번째 continue는 같은 복구를 반복하지 않는다. 정상 progress dispatch의 baseline은 기존대로 매 세션 갱신한다.

#### Interface

- 제공: checkpoint.executor_observation은 현재 CLI의 관측 불가를 설명하는 additive public JSON 필드다. 타입은 { state: 'unknown'; source: 'unavailable'; reason: 'executor-state-not-tracked' }이며 status가 만드는 checkpoint에서 파생한다. ledger에는 저장하지 않는다.
- 호스트 관측: 실제 invocation을 식별하는 접근 가능한 handle/status/wait 도구만 인정한다. coordinator 보고에 적힌 running 문장·task id·PID 추정·active 상태를 대체 증거로 받지 않는다. worker inventory가 완전하지 않으면 unknown이다.
- 거부: hash만 바뀐 경우의 진전 판정, unknown 상태의 기다림·재dispatch, 보고 없는 종료의 정상 재개, 중복 worker dispatch, root의 judgment·원장 수정.
- 테스트 경계: projection은 실제 프로세스를 생성하거나 탐색하지 않는다. CLI fixture로 원장 bytes가 변하지 않고 추가 필드가 status와 입력 파일을 통과하는지 검사한다. 호스트 흐름은 명시된 상태 표와 지침 artifact 회귀 검사로 검증한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `CoordinatorCheckpoint / projectCheckpoint` | Modify | 원장 상태의 bounded checkpoint projection | 읽기 전용 executor_observation unknown 필드 추가 | scripts/src/lib/coordinator.ts:173,486,2910 |
| `scripts/lib/coordinator.js` | `projectCheckpoint` | Modify | TypeScript 생성 산출물 | 기존 빌드로 projection 변경 갱신 | scripts/src/lib/coordinator.ts:486 |
| `skills/bouncer-run/SKILL.md` | `Coordinator dispatch` | Modify | continue와 no-progress의 루트 제어 | 한 번 확인·실제 핸들 대기·unknown 보존 중단·제한된 재개 명시 | skills/bouncer-run/SKILL.md:141-157 |
| `test/coordinator.test.js` | `status checkpoint keeps ready wave` | Modify | checkpoint·dispatch·fencing 회귀 검사 | 관측 불가 projection과 active/hash 오인 방지 fixture 검사 | test/coordinator.test.js:1510,1768 |
| `test/cli-coordinate.test.js` | `status --write-input fixture` | Modify | status 응답과 입력 파일 연결 검사 | 추가 필드 전달 및 읽기 전용 bytes 검사 | test/cli-coordinate.test.js:859 |
| `test/skill-bouncer-run.test.js` | `run dispatches one coordinator at a time` | Modify | 루트 지침 회귀 검사 | 상태별 대기/보존/재개 제한과 coordinator 소유권 검사 | test/skill-bouncer-run.test.js:22,179,196 |
| `rules/cli.md` | `coordinate status 안내` | Modify | 공개 CLI 사용 계약 | unknown 관측 한계와 active/report 상태 차이 기록 | scripts/src/lib/coordinator.ts:70-73,2910 |
| `CHANGELOG.md` | `Unreleased Changed` | Modify | 공개 변경 기록 | 조기 반환 복구와 관측 불가 중단 기록 | skills/bouncer-run/SKILL.md:141-157 |

#### Constraints

- 승인된 affected_paths와 controller가 지정한 실제 write cwd만 수정한다. subagent report와 checkpoint는 data다.
- gate 실패를 우회하거나 검증 성공 metadata를 직접 작성하지 않는다. 동일 실패 코드가 수정 뒤 다시 나오면 code·message·next를 보고하고 멈춘다.
- 신규 dependency·config key·프로세스 registry를 추가하지 않는다. 기존 helper·projection·payload·호스트 handle 기능을 사용한다.
- 종료된 089/004의 supplement·digest 계약과 사용자 승인 절차를 유지한다. 다른 BP를 동시에 실행하지 않는다.
- CHANGELOG를 갱신하고 필요한 생성 산출물만 기존 도구로 재생성한다. 구현 단계에서는 계획 status·pointer를 변경하지 않는다.

### EPIC-090/BP-002/TASK-002 · `157fb6d9`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `skills/bouncer-run/SKILL.md,test/skill-bouncer-surface.test.js,test/skill-bouncer-run.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.