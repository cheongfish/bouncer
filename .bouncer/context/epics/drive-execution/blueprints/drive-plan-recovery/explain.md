---
type: bouncer.explain
title: drive-plan-recovery explain
description: Explain for drive-plan-recovery
resource: .bouncer/context/epics/drive-execution/blueprints/drive-plan-recovery/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-11-01T23:41:49.464+09:00'
bouncer:
  id: EXPLAIN-drive-plan-recovery
  epic_id: drive-execution
  blueprint_id: drive-plan-recovery
  status: published
  comprehension:
    - range_from: 1394ab4d3d69d0900f8c9025e957d8380e4b5758
      range_to: a32b22a7b3f1fb9f88ad04d3170856f3c075add0
      diff_sha: 3eb6e938d90f8da67e458cb7c63fdc794c3d60f66893baf86bce4fd216343126
      recorded_at: '2026-11-01T23:42:27.789+09:00'
  task_commits:
    - task: drive-execution/drive-plan-recovery/001
      sha: '24302203'
      intent_anchor: task-001
    - task: drive-execution/drive-plan-recovery/002
      sha: fe02cac1
      intent_anchor: task-002
    - task: drive-execution/drive-plan-recovery/003
      sha: a3464816
      intent_anchor: task-003
    - task: drive-execution/drive-plan-recovery/004
      sha: 03b22656
      intent_anchor: task-004
    - task: drive-execution/drive-plan-recovery/006
      sha: a5093f19
      intent_anchor: task-006
    - task: drive-execution/drive-plan-recovery/007
      sha: a32b22a7
      intent_anchor: task-007
---
# Explain

## Background

실행(drive)이 `blocked`로 멈추거나 계획 세션이 수정 상한에 닿으면, 지금까지는 보존된 근거가 있어도 이어 갈 방법이 없었다. 이번 변경은 세 가지를 고친다.

- worker가 `blocked`를 보고하면 원인(승인 필요, 환경 장애, gate 실패·상한, 미분류)에 따라 다른 행동을 안내한다. 원인을 모르는 채 같은 명령을 반복하지 않게 한다.
- 계획 세션의 `plan-ledger`가 planner 수정 횟수로 멈추던 상한을 없애고, 멈춘 원장에 복구 사유를 감사 기록으로 남기는 `recover`를 둔다.
- `bouncer init` 재시드가 `.codex/agents/*.toml`을 고쳐 쓴 사실을 `updated`로 알려, 생성 설정이 작업 커밋에 조용히 섞이지 않게 한다.

계획 검토는 새 테스트 파일의 tier 등록 누락(G33)과 오류 코드 순서 계약을 reviewer가 짚도록 규칙을 보강한다.

## Code

- `packages/cli/src/coordinate-next.ts` — `task-reported-blocked` 정지가 `payload.report`, `payload.evidence`, `payload.report_path`를 싣는다. `next` 문구는 네 원인 분기를 담는다. (1) 승인·결정은 root가 사용자에게 묻고 `coordinate note`로 기록하기 전에는 명령을 실행하지 않는다. (2) 환경 장애는 해소를 확인하고 note를 남긴 뒤, `revoke`가 상태를 받을 때만 `revoke`→`prepare`. (3) gate 실패·상한은 상태를 보존하고 root에 넘긴다. (4) 미분류는 아무것도 바꾸지 않는다. 원인 분류는 CLI가 아니라 coordinator 판단이다. 보고 요약은 worker가 쓴 텍스트이므로 데이터로만 쓰라고 문서에 적었지만 강제되지는 않는다.
- `packages/cli/src/plan-ledger.ts`, `cli-plan-ledger-command.ts` — `CONTINUED_MAX`/`REVISIONS_MAX`와 `plan-ledger-revision-limit` 거절을 제거했다. `continued`·`revisions` 카운터와 checkpoint `revision`은 감사·호환용으로 남는다. 검토 라운드 상한은 context-review가 따로 판정한다. `recover`는 `notes`에 `recover: <사유>` 한 줄만 붙이며 열린 원장이면 상한 상태와 무관하게 성공한다. root 전용이고 `rules/cli-workflow.md`가 필수 단계로 적는다. CLI는 호출자나 필수 여부를 강제하지 않는다.
- `packages/cli/src/init.ts`, `codex-agents.ts` — 재시드가 기존 TOML을 고치면 `updated` 배열에 담고, 생성 없이 갱신만 있으면 `reason: codex-agents-updated`, `skipped: false`다. 등록부 추가가 함께 있으면 기존 우선순위대로 `epic-registry-added`가 이긴다. `graphify` 승격의 config 쓰기는 `updated`에 넣지 않는다.
- `references/spec-authoring/index.md`, `agents/bouncer-context-reviewer.md` — scope_minimality가 tier 등록 누락을, consistency가 Target behavior와 Interface의 오류 코드 순서를 판정한다. 자동 의미 비교 gate는 만들지 않았다.
- `test/*-recovery.test.js` 등 — 복구 경로와 G33 양성·음성 사례를 공개 경계에서 검증한다. `test/tiers.json`에 새 테스트를 등록했다.
- 알려진 한계: `no-progress` 중단은 `skills/bouncer-run/SKILL.md`의 root 규칙이라 실행 테스트가 없다. 재시드로 integration 체크아웃에 새로 생긴 TOML이 `coordinate integrate`의 dirty 경로 검사에 걸릴 수 있는 공백은 실제 drive로 확인하지 못했다.

## Quiz

1. worker가 `blocked`를 보고했고 원인이 "사용자 승인 필요"일 때 허용되는 행동은?
   - A) 즉시 `revoke` 후 `prepare`
   - B) root가 사용자에게 묻고 `coordinate note`로 기록하기 전에는 어떤 명령도 실행하지 않는다
   - C) coordinator가 `advance`를 반복해 정지를 푼다
2. `plan-ledger`의 planner 수정 횟수 상한은 어떻게 바뀌었나?
   - A) 상한이 2회에서 5회로 완화됐다
   - B) `continued`·`revisions` 카운터 자체가 삭제됐다
   - C) 상한 거절이 없어졌고 카운터는 감사·호환용으로 기록만 남는다
3. `bouncer init` 재시드가 기존 Codex 역할 TOML만 고쳐 쓰고 새로 만든 파일은 없을 때 응답은?
   - A) `updated`에 경로가 담기고 `reason: codex-agents-updated`, `skipped: false`
   - B) `reason: already-initialized`, `skipped: true`
   - C) `created`에 경로가 담기고 `codex-agents-seeded`
4. `plan-ledger recover`가 원장에 하는 일은?
   - A) planner 카운터를 0으로 되돌린다
   - B) `notes`에 `recover: <사유>` 항목 하나만 추가하고 나머지는 바꾸지 않는다
   - C) 답변과 phase를 초기화해 계획을 처음부터 다시 시작한다
5. 새 테스트 파일이 `test/tiers.json`에 등록되지 않았을 때 plan 단계에서 이를 판정하도록 명시된 곳은?
   - A) consistency 판정
   - B) 의미를 자동 비교하는 새 gate
   - C) scope_minimality 판정(누락 path)

## Tasks

### drive-execution/drive-plan-recovery/001 · `24302203`

#### Goal & intent

A의 설정 생성·갱신과 task 커밋 범위를 분리한다.

#### Current behavior

`packages/cli/src/init.ts:578`은 created가 비면 갱신 여부와 관계없이 already-initialized를 반환한다. `test/cli-commit.test.js:322`는 범위 밖 변경 거절을 다룬다. `packages/cli/src/coordinate-advance.ts:176`은 commit 결과를 처리한다. 기준 재현: `npm run build && node --test test/cli-commit.test.js test/coordinate-advance.test.js`.

#### Target behavior

성공: 재시드는 작업 커밋과 분리된 위치에서 실행하고 명시적으로 범위에 든 생성 설정은 허용한다. 실패: 범위 밖 파일은 커밋 전 파일·이유·다음 행동과 함께 거절한다. 보존: 기존 커밋 범위 검사와 gate를 유지한다.

#### Interface

기존 초기화 저장소에서 seed 결과는 `created`에 새 파일, `updated`에 기존 내용이 실제 변경된 파일을 각각 저장소 상대 경로 배열로 반환한다. seed만 수행한 경우 생성만은 `skipped: false`, `reason: codex-agents-seeded`; 갱신만은 `skipped: false`, `reason: codex-agents-updated`; 혼합은 `skipped: false`, `reason: codex-agents-seeded`이며 두 배열을 모두 채운다. 변경 없음은 두 배열이 비고 `skipped: true`, `reason: already-initialized`다. `created`의 기존 의미와 기존 reason을 보존하고 `updated`는 추가 필드다. registry 추가와 신규 bootstrap의 기존 reason 우선순위는 유지하되 실제 갱신 배열을 함께 반환한다. 실패 응답의 기존 계약은 유지한다. 자동 commit도 같은 승인 범위에 없는 생성 파일을 거부한다.

#### Touch

사용자가 확인한 task별 변경 범위다.

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/init.ts` | `init` | Modify | 초기화 결과 | 생성·갱신·무변경 구분 | 578행의 reason |
| `packages/cli/src/codex-agents.ts` | `신규 추출 지점: seed 결과` | Modify | role TOML 생성 | 생성 및 갱신 결과 전달 | seed 구현 |
| `packages/cli/src/coordinate-advance.ts` | `advance` | Modify | 자동 실행 | 범위 밖 커밋 방지 | commit 실행 경로 |
| `agents/bouncer-coordinator.md` | `codex-agents check` | Modify | 재시드 절차 | task 외 위치에서 보정 | 179행 |
| `rules/subagent-model.md` | `codex-agents check` | Modify | 호스트 보정 | 동일 분리 절차 | 36행 |
| `skills/bouncer-run/references/agent-dispatch.md` | `codex-agents check` | Modify | dispatch 검사 | 동일 분리 절차 | 42행 |
| `skills/bouncer-init/references/init-result.md` | `init result` | Modify | 결과 표시 | 갱신 표시 | 6행 |
| `test/cli-commit.test.js` | `out-of-scope` | Modify | 범위 검사 테스트 | 생성 파일 허용 및 거절 사례 | 322행 |
| `test/coordinate-advance.test.js` | `advance` | Modify | 자동 실행 테스트 | 자동 커밋 범위 사례 | 기존 advance 테스트 |
| `test/agents.test.js` | `codex-agents check` | Modify | 역할 문서 검사 | 보정 절차 소비자 확인 | 531행 |
| `test/init-seed-recovery.test.js` | `신규 추출 지점: init 회귀` | Create | 없음 | 재시드 응답 검증 | 기존 생성·갱신 응답 테스트 미발견 |
| `test/tiers.json` | `tiers` | Modify | 테스트 등록 | 신규 테스트 등록 | 신규 테스트 G33 |

| `.codex/agents/bouncer-coordinator.toml` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | codex-agent-toml: agents/bouncer-coordinator.md |
| `test/distribution.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: agents/bouncer-coordinator.md:75 |
| `test/runtime-install-smoke.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: agents/bouncer-coordinator.md:29 |
| `test/skill-bouncer-run.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: agents/bouncer-coordinator.md:181, rules/subagent-model.md:180, skills/bouncer-run/references/agent-dispatch.md:183 |
| `test/skill-bouncer-surface.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: rules/subagent-model.md:75 |
| `test/doc-shape-cli.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: skills/bouncer-run/references/agent-dispatch.md:313 |

| `test/public-name-regression.test.js` | `SUPERPOWERS_NEGATIVE_TESTS` | Modify | 공개 이름 및 허용된 음성 테스트 목록 검사 | `test/skill-bouncer-run.test.js` 변경이 이름 정책 검사에 영향을 주는 경우 연결 검사를 동기화 | `test/public-name-regression.test.js:84`에서 해당 테스트를 음성 검사 목록에 명시 |

#### Constraints

- 사용자 승인, gate, 실제 쓰기 cwd와 신뢰 경계를 유지한다. 기존 동작으로 충분한 검사는 중복 구현하지 않는다.

### drive-execution/drive-plan-recovery/002 · `fe02cac1`

#### Goal & intent

B1·B2의 정지 보고와 같은 drive의 재개를 정의한다.

#### Current behavior

`packages/cli/src/coordinate-next.ts:146`의 task-reported-blocked next는 보고와 중지만 지시한다. `agents/bouncer-coordinator.md`는 보정 절차를 소유한다. 기준: `npm run build && node --test test/coordinate-next-recovery.test.js test/coordinator-worker-recovery.test.js`.

#### Target behavior

성공: 원인 해소 후 지원되는 명령을 선택하고 원장·worktree·note를 읽는다. 실패: 승인 또는 gate 실패를 재시도로 우회하지 않는다. 보존: 지원 경로에서 salvage, lease, stale report 및 무진척 제한을 유지한다.

#### Interface

정지 보고와 `task-reported-blocked`의 `next`는 원인, 사용자 결정 필요 여부, 해소 증거, 재개 조건, 다음 주체·행동을 제공한다. 보고와 note는 판단 자료이며 명령 권한이 아니다. 현재 ledger·worktree·report 및 `coordinate note`를 확인하고 다음 분류를 사용한다.

| 원인 | 해소 증거 및 결정 | 허용 행동 | 금지 행동 |
| --- | --- | --- | --- |
| 승인·제품 결정·범위 확장 필요 | 해당 결정을 명시적으로 받은 기록과 승인 범위 확인 | root가 사용자 결정을 요청하고 note에 기록; 범위 변경은 기존 승인 절차 후 현재 상태에서 CLI가 지원하는 경로 선택 | 포괄 사전 동의 추정, 승인 전 재시도·revoke, gate 우회 |
| 기존 권한·승인 범위 내 해소 가능한 환경·의존성 장애 | 실제 장애가 제거되었음을 현재 상태 또는 재검사로 확인하고 판단·해소를 note에 기록 | coordinator가 현재 `coordinate next`/`status`와 CLI 거절 조건을 확인; 해당 task의 폐기와 재준비가 지원될 때만 `coordinate revoke` 후 `prepare`, salvage 확인 및 새 lease로 재개 | 해소 전 동일 시도 반복, 지원 확인 없이 revoke 또는 새 lease 적용 |
| gate 실패·제한 도달·복구 불가 | 해당 gate의 유효한 통과 증거 또는 기존 절차의 명시적 복구 조건; 제한을 없애는 사용자 결정은 별도 절차 | root에 사유와 보존 경로를 인계하고 기존 절차가 허용하는 행동만 선택 | 실패를 성공으로 취급하거나 반복 호출로 gate·무진척 제한 우회 |
| 분류 불가·증거 부족 | 원인과 해소를 식별할 충분한 증거 또는 필요한 사용자 결정 | 변경 없이 중지, note 및 root 인계; 상태 확인만 수행 | 추측해 revoke, prepare 또는 advance 반복 |

`revoke`/`prepare`가 허용된 경우에만 기존 salvage의 변경·보고 보존, 새 lease와 이전 lease 보고 거절을 유지한다. root는 같은 drive의 ledger·worktree·note를 읽고 현재 상태의 지원 명령만 선택한다.

#### Touch

사용자가 확인한 task별 변경 범위다.

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinate-next.ts` | `task-reported-blocked` | Modify | 정지 next | 조건부 재개 안내 | 146행 |
| `rules/cli-coordinate.md` | `coordinate revoke` | Modify | 명령 계약 | 원인별 지원·금지 조건 | `rules/cli-coordinate.md:232` salvage 계약, `packages/cli/src/coordinate-next.ts:103` revoke·prepare 안내 |
| `agents/bouncer-coordinator.md` | `stop reporting` | Modify | coordinator 절차 | 사용자 결정·자율 복구·재개 불가 표 및 root handoff | `agents/bouncer-coordinator.md:245` 보고 없는 worker 중단, `agents/bouncer-coordinator.md:259` blocked 판단 |
| `skills/bouncer-run/SKILL.md` | `root handoff` | Modify | root drive 절차 | status와 note 확인 | `skills/bouncer-run/SKILL.md:214` 무진척 중단 |
| `test/coordinate-next-recovery.test.js` | `blocked` | Modify | next 회귀 | 조건과 명령 확인 | next 테스트 |
| `test/coordinator-worker-recovery.test.js` | `lease salvage` | Modify | worker 복구 검증 | 필요한 보존 사례 보완 | 기존 복구 테스트 |
| `test/agents.test.js` | `coordinator` | Modify | 역할 문서 검증 | 인계 구조 확인 | 역할 문서 소비자 |

| `.codex/agents/bouncer-coordinator.toml` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | codex-agent-toml: agents/bouncer-coordinator.md |
| `test/doc-shape-cli.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: rules/cli-coordinate.md:260 |
| `test/skill-bouncer-run.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: rules/cli-coordinate.md:34, agents/bouncer-coordinator.md:181, skills/bouncer-run/SKILL.md:17 |
| `test/distribution.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: agents/bouncer-coordinator.md:75, skills/bouncer-run/SKILL.md:79 |
| `test/runtime-install-smoke.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: agents/bouncer-coordinator.md:29 |

| `test/public-name-regression.test.js` | `SUPERPOWERS_NEGATIVE_TESTS` | Modify | 공개 이름 및 허용된 음성 테스트 목록 검사 | `test/skill-bouncer-run.test.js` 변경이 이름 정책 검사에 영향을 주는 경우 연결 검사를 동기화 | `test/public-name-regression.test.js:84`에서 해당 테스트를 음성 검사 목록에 명시 |

#### Constraints

- 사용자 승인, gate, 실제 쓰기 cwd와 신뢰 경계를 유지한다. 기존 동작으로 충분한 검사는 중복 구현하지 않는다.

### drive-execution/drive-plan-recovery/003 · `a3464816`

#### Goal & intent

C의 planner revision 및 continued 횟수 gate를 제거하고 기존 열린 원장을 감사 가능한 별도 명령으로 복구한다.

#### Current behavior

`packages/cli/src/plan-ledger.ts:284`의 `applyPlanner`는 `continued` 1회 또는 전체 revisions 2회 이후 `plan-ledger-revision-limit`을 반환한다. 같은 모듈 257–278행의 mutation은 잠금과 checkpoint hash를 검사하고 성공 때 원장을 저장한다. `rules/cli-workflow.md:148`에 제한이 공개되어 있다. 별도 revision gate 모듈이나 전용 테스트는 검색에서 발견되지 않았으며 ledger 전체는 다른 계약도 소유한다. 기준 재현은 `npm run build` 후 새 전용 테스트에서 세 번째 revision과 두 번째 continued를 호출한다.

#### Target behavior

성공: 기존 원장에서도 `continued`와 `fresh`가 횟수와 무관하게 성공하며 mode의 세션 유무 규칙과 기록은 유지한다. 과거 상한에서 중단된 열린 원장은 별도 복구 명령으로 감사 기록을 남긴 후 같은 원장에서 계속한다. 실패: stale checkpoint, 닫힌 원장, 잘못된 입력은 기존 오류와 함께 거절하고 상태를 보존한다. 보존: 답변, 리뷰 증거, blueprint binding, revision 외 gate 및 checkpoint 보호를 유지한다. 추가 한정 예산이나 횟수 기반 차단은 없다.

#### Interface

`plan-ledger recover --id <id> --ledger-path <path> --ledger-hash <sha256> --note <text>`는 비어 있지 않은 복구 사유를 요구한다. 기존 열린 원장을 잠금과 hash로 확인하고 `notes`에 복구 사유를 기록하며 새 checkpoint를 반환한다. 이 명령은 답변, blueprint, planner 카운터 및 검토 문서를 수정하지 않고 승인이나 검토를 대신하지 않는다. 잘못된 사유·stale hash·닫힌 원장은 기존 검증 규칙과 오류를 사용해 거절한다. 횟수 gate와 `plan-ledger-revision-limit` 오류를 제거하되 checkpoint `revision`은 동시성 보호용으로 유지한다.

#### Touch

사용자가 확인한 task별 변경 범위다.

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/plan-ledger.ts` | `applyPlanner`, `mutateLedger` | Modify | mode gate와 원장 잠금·저장 | 횟수 gate 삭제 및 감사 복구 mutation | 23–24, 257–304행 |
| `packages/cli/src/cli-plan-ledger-command.ts` | `run` | Modify | plan-ledger CLI 전달 | recover 인자 검증 및 실행 | 16–23, 59–96행 |
| `packages/cli/src/cli-usage.ts` | `plan-ledger` | Modify | CLI 도움말 | recover 사용법 | 34행 |
| `rules/cli-workflow.md` | `plan-ledger` | Modify | 공개 mode 문서 | 횟수 제한과 오류 제거, 복구 계약 명시 | 137–155행 |
| `agents/bouncer-plan-coordinator.md` | `planner-mode` | Modify | dispatch mode | 횟수 상한 없는 mode와 복구 명령 사용 | 45–48행 |
| `skills/bouncer-plan/SKILL.md` | `planner-mode` | Modify | 계획 절차 | 기존 열린 원장 복구 절차 정렬 | 322행 |
| `skills/bouncer-plan/references/context-review.md` | `planner-mode` | Modify | 리뷰 수정 절차 | 횟수 gate 제거와 기존 리뷰 절차 구분 | 98–104행 |
| `test/plan-ledger-recovery.test.js` | `plan-ledger recover` | Create | 없음 | gate 제거와 복구 회귀 | 전용 테스트 검색 결과 없음 |
| `test/tiers.json` | `tiers` | Modify | 테스트 등록 | 신규 테스트 등록 | 신규 테스트 G33 |

| `.codex/agents/bouncer-plan-coordinator.toml` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | codex-agent-toml: agents/bouncer-plan-coordinator.md |
| `test/skill-bouncer-surface.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: agents/bouncer-plan-coordinator.md:296, skills/bouncer-plan/SKILL.md:287, skills/bouncer-plan/references/context-review.md:288 |
| `test/doc-shape-cli.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: skills/bouncer-plan/SKILL.md:353 |
| `test/skill-bouncer-run.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: skills/bouncer-plan/SKILL.md:105 |
| `test/skill-context-review.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: skills/bouncer-plan/references/context-review.md:54 |

| `test/public-name-regression.test.js` | `SUPERPOWERS_NEGATIVE_TESTS` | Modify | 공개 이름 및 허용된 음성 테스트 목록 검사 | `test/skill-bouncer-run.test.js` 변경이 이름 정책 검사에 영향을 주는 경우 연결 검사를 동기화 | `test/public-name-regression.test.js:84`에서 해당 테스트를 음성 검사 목록에 명시 |

#### Constraints

- 기존 ledger의 `planner` 카운터와 checkpoint `revision`을 호환성 및 감사 목적으로 유지한다. `revision`은 planner revision 횟수와 다른 동시성 버전이다.
- 횟수 gate 외의 검토·승인 및 checkpoint 검사를 제거하지 않는다. 별도 gate 전용 모듈이나 전용 기존 테스트가 발견되지 않았으므로 공용 ledger 모듈 전체를 삭제하지 않는다.

### drive-execution/drive-plan-recovery/004 · `03b22656`

#### Goal & intent

D·G의 계획 및 리뷰 점검을 추가한다.

#### Current behavior

`references/spec-authoring/index.md`는 Touch 경로 근거를 요구한다. `agents/bouncer-context-reviewer.md`는 계획 리뷰를 맡고, 기존 G33은 tier 누락을 감지한다. 기준: `node --test test/skill-spec-authoring.test.js test/agents.test.js`.

#### Target behavior

성공: 신규 테스트별 tier 등록 필요성과 근거를 최초 경로 확인에 기재한다. 동일 입력의 오류 코드와 검사 순서를 Target behavior와 Interface에서 대조한다. 보존: G33을 그대로 사용한다.

#### Interface

계획 지침과 리뷰 체크리스트가 위 두 점검을 제공한다. 자연어 의미 비교 자동 gate는 추가하지 않는다.

#### Touch

사용자가 확인한 task별 변경 범위다.

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/index.md` | `Touch` | Modify | 계획 작성 지침 | tier 필요성과 근거 확인 | `references/spec-authoring/index.md:144` 경로별 근거, `references/spec-authoring/index.md:161` affected_paths 정당화 |
| `agents/bouncer-context-reviewer.md` | `review checklist` | Modify | 계획 리뷰 | 공개 오류 코드와 순서 대조 | `agents/bouncer-context-reviewer.md:180` Interface 일관성 리뷰 |
| `skills/bouncer-plan/SKILL.md` | `affected_paths` | Modify | 최초 범위 확인 | test tier 근거 포함 | `skills/bouncer-plan/SKILL.md:297` 범위 확인 |
| `test/skill-spec-authoring.test.js` | `spec authoring` | Modify | 작성 지침 확인 | tier 확인 구조 | 기존 테스트 |
| `test/agents.test.js` | `context reviewer` | Modify | 리뷰 지침 확인 | 코드·순서 대조 | 역할 문서 검증 |

| `.codex/agents/bouncer-context-reviewer.toml` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | codex-agent-toml: agents/bouncer-context-reviewer.md |
| `test/skill-bouncer-surface.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: references/spec-authoring/index.md:291, agents/bouncer-context-reviewer.md:295, skills/bouncer-plan/SKILL.md:287 |
| `test/doc-shape-cli.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: skills/bouncer-plan/SKILL.md:353 |
| `test/skill-bouncer-run.test.js` | `연결 소비자` | Modify | 관련 역할 또는 문서의 연결 소비자 | 관련 계약 변경에 맞춰 필요할 때 동기화 | path-literal: skills/bouncer-plan/SKILL.md:105 |

| `test/public-name-regression.test.js` | `SUPERPOWERS_NEGATIVE_TESTS` | Modify | 공개 이름 및 허용된 음성 테스트 목록 검사 | `test/skill-bouncer-run.test.js` 변경이 이름 정책 검사에 영향을 주는 경우 연결 검사를 동기화 | `test/public-name-regression.test.js:84`에서 해당 테스트를 음성 검사 목록에 명시 |

#### Constraints

- 사용자 승인, gate, 실제 쓰기 cwd와 신뢰 경계를 유지한다. 기존 동작으로 충분한 검사는 중복 구현하지 않는다.

### drive-execution/drive-plan-recovery/005

#### Goal & intent

모든 구현 task 통합 후 전체 CI 결과를 기록한다.

#### Interface

- 제공: `npm run ci` 결과와 execute gate 증적.
- 거부: source 변경과 commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/drive-plan-recovery/006 · `a5093f19`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/tiers.json` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.

### drive-execution/drive-plan-recovery/007 · `a32b22a7`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- F-SS-1 (major, spec_scope, must_fix) — test/coordinate-next-recovery.test.js#blocked report classed as — tasks/002 checklist
- F-SS-2 (minor, spec_scope, must_fix) — packages/cli/src/coordinate-next.ts#task-reported-blocked — tasks/002 interface
- F-SS-3 (minor, spec_scope, must_fix) — rules/cli-workflow.md#plan-ledger — tasks/003 target behavior
- CT-002-3 (minor, correctness_tests, must_fix) — test/coordinate-next-recovery.test.js#no-progress — tasks/002 checklist
- CT-004-1 (minor, correctness_tests, must_fix) — test/skill-spec-authoring.test.js#spec-authoring tier rule — tasks/004 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/coordinate-next-recovery.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `packages/cli/src/coordinate-next.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `rules/cli-workflow.md` — 기록된 리뷰 finding을 수정한다.
- Modify `test/skill-spec-authoring.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.