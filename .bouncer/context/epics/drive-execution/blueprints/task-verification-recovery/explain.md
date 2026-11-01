---
type: bouncer.explain
title: task-verification-recovery explain
description: Explain for task-verification-recovery
resource: .bouncer/context/epics/drive-execution/blueprints/task-verification-recovery/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-11-02T08:49:11.910+09:00'
bouncer:
  id: EXPLAIN-task-verification-recovery
  epic_id: drive-execution
  blueprint_id: task-verification-recovery
  status: published
  comprehension:
    - range_from: 81f5a49167b4a40d2ffa4623f95d2692113e6a87
      range_to: b40c5863b586361a2968a656039d9c7ed21f59ae
      diff_sha: 5e160cb04dbd12ef3ecdc72b537135527a9e55b09a2d2a41da2bcd492bac9ac7
      recorded_at: '2026-11-02T08:49:48.387+09:00'
  task_commits:
    - task: drive-execution/task-verification-recovery/001
      sha: 763ffa32
      intent_anchor: task-001
    - task: drive-execution/task-verification-recovery/002
      sha: 8e707804
      intent_anchor: task-002
    - task: drive-execution/task-verification-recovery/004
      sha: b40c5863
      intent_anchor: task-004
---
# Explain

## Background

새 테스트가 tier 등록에서 빠지면 전체 검증에서 누락될 수 있다. 테스트 작성 관례에 등록 검사를 포함하고, 원장 복구 감사 절차를 CLI 동작에 맞췄다. 진행 여부는 실제 호스트 관찰과 완료된 작업 ID를 기준으로 판정한다.

## Code

`references/spec-authoring/index.md`와 `scripts/check-task.js`는 새 테스트 파일을 추가하는 작업의 검증과 tier 등록 관례를 설명한다. `rules/cli-workflow.md`, `skills/bouncer-plan/SKILL.md`, `agents/bouncer-plan-coordinator.md`는 원장 복구 감사를 다룬다.

`packages/cli/src/coordinate-progress.ts`의 `progress`는 호스트 관찰, 완료 ID, 보고서 존재와 복구 사용 여부로 다음 행동을 결정한다. `packages/cli/src/cli-git-commands.ts`는 이 판정을 CLI에 연결하고 `skills/bouncer-run/SKILL.md`는 호출 절차를 설명한다. 실행 중 관찰은 대기를 우선하며, 같은 기준에서 복구는 한 번만 허용한다.

검증 근거는 `1a13ecf963ccf5fa7b5371d691862e920a300a75683cc54551e96fb6097cd7d8`, `607efffa504ace8d9a9b010319fb6fc50080cb9cda42fa42ff757b0e60018f5d`, `1fc04e90d46b13f4f34155659dbc90e26164b18e0bdd5d45b6672f71f7d0e8b8`, `a3efe0e1738c0d5f7b1161e50baa2ff9d39506520b53b9361db6eb77169add77`이다. 검토 기록은 해당 blueprint의 `review.md`에 있다.

## Quiz

1. 호스트 관찰이 `running`이면 새 완료 ID가 있어도 어떤 판정을 내리는가?
   - A. `continue`
   - B. `wait`
   - C. `recovery`
2. 완료 ID 집합에 기준에 없던 ID가 추가됐지만 전체 개수가 같다면 어떻게 판정하는가?
   - A. `continue`
   - B. `no-progress`
   - C. `worker-report-missing`
3. 같은 기준에서 새 완료 ID가 없고 보고서는 있으며 복구를 이미 사용했다면 어떻게 판정하는가?
   - A. `wait`
   - B. `recovery`
   - C. `no-progress`

## Tasks

### drive-execution/task-verification-recovery/001 · `763ffa32`

#### Goal & intent

신규 테스트가 있는 commit task의 검증 명령에 tier 등록 검사를 포함한다. 수용 기준은 blueprint Contract 1이며 검증은 `node scripts/check-task.js test/skill-spec-authoring.test.js`다.

#### Current behavior

`references/spec-authoring/index.md`의 Checklist 검증 규칙은 task 전용 명령을 요구하지만 `check-task.js`를 지정하지 않는다. `scripts/check-task.js:119`는 tier 누락을 거절하고 `:133`의 주석은 고정 검사가 프로세스를 띄운다고 잘못 기술한다. `test/skill-spec-authoring.test.js:76`은 tier 규칙을 확인한다.

#### Target behavior

신규 테스트 task에 `check-task.js` 관례, 단일 argv 제약과 tier 검사 이유를 문서화한다. 기존 테스트만 수정하는 task와 전체 CI fan-in에는 신규 테스트 전용 관례를 강제하지 않는다. 주석은 고정 검사 실행의 실제 guard 조건을 설명한다.

#### Interface

- 제공: plan 작성자가 읽는 검증 명령 관례와 현재 고정 검사 주석.
- 거부: G33이나 CLI 검증 규칙의 변경.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/index.md` | `Checklist` | Modify | 검증 명령 작성 규칙 | 신규 테스트의 단일 argv 명령과 이유 기록 | `references/spec-authoring/index.md:234`–249의 scoped verify와 테스트 계약 규칙 |
| `scripts/check-task.js` | `main` | Modify | tier와 고정 검사 실행 | 오래된 주석 수정 | 119–133행에서 등록과 고정 검사 실행 |
| `test/agents.test.js` | `agents tests` | Modify | 역할 문서 참조 | spec 문서 경로 참조 유지 | plan inspect 경로 참조 333행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/skill-bouncer-surface.test.js` | `surface tests` | Modify | skill 문서 표면 검사 | spec 문서 경로 참조 유지 | plan inspect 경로 참조 291행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/test-tiers.test.js` | `tier tests` | Modify | tier 검사 계약 | check-task 경로 참조 유지 | plan inspect 경로 참조 9행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |

#### Constraints

추가로 확인된 테스트는 기존 assertion을 보존한다. 승인된 동작 변경과 직접 충돌하는 assertion이 없는 한 수정하지 않는다.
실행 코드와 tier 판정은 바꾸지 않는다. 문서 확인은 구조와 링크 및 사례 검토로 하고 단순 문장 복제 테스트를 추가하지 않는다.

### drive-execution/task-verification-recovery/002 · `8e707804`

#### Goal & intent

과거 상한 원장 재개 시 `recover`를 권장 감사 단계로 안내한다. 수용 기준은 blueprint Contract 2이며 검증은 `node scripts/check-task.js test/plan-ledger-recovery.test.js test/distribution.test.js`다.

#### Current behavior

`rules/cli-workflow.md:153`과 `skills/bouncer-plan/SKILL.md:48`은 root가 재개 전에 recover를 필수로 실행하도록 적는다. `agents/bouncer-plan-coordinator.md:51` 및 생성 TOML에도 같은 표현이 있다. `test/plan-ledger-recovery.test.js:163`은 감사 기록과 상태 보존을 검증하고 CLI는 상한 표지가 없어 강제하지 않는다.

#### Target behavior

재개 전에 사유 기록을 권장하되 recover 없이 같은 원장이 계속될 수 있음을 문서에 명시한다. 명령을 선택하면 root만 실행하고 기존 note·checkpoint 및 변경하지 않는 상태 계약은 보존한다. CLI 동작은 바꾸지 않는다.

#### Interface

- 제공: root와 coordinator가 읽는 선택형 감사 절차.
- 거부: recover를 승인이나 리뷰로 취급하거나 필수 재개 조건으로 기술하는 문구.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli-workflow.md` | `recover` | Modify | CLI 감사 절차 | 필수 표현을 권장으로 수정 | 153–160행 |
| `skills/bouncer-plan/SKILL.md` | `recover` | Modify | root 절차 | 선택적 감사와 root 소유 반영 | 48행 |
| `agents/bouncer-plan-coordinator.md` | `recover` | Modify | coordinator 권한 | 선택 시 root 실행으로 표현 | 51행 |
| `.codex/agents/bouncer-plan-coordinator.toml` | `recover` | Modify | 생성된 역할 문서 | source와 동기화 | 동일 문구 51행 |
| `test/plan-ledger-recovery.test.js` | `recovery tests` | Modify | 원장 복구 계약 | 감사 계약과 문서 참조 유지 | plan inspect 경로 참조 4행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/doc-shape-cli.test.js` | `doc shape tests` | Modify | CLI 문서 분류 | plan skill 문서 분류 유지 | plan inspect 경로 참조 353행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/skill-bouncer-run.test.js` | `run skill tests` | Modify | 실행 문서 계약 | plan skill 참조 유지 | plan inspect 경로 참조 105행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/skill-bouncer-surface.test.js` | `surface tests` | Modify | 문서 표면 검사 | plan 및 역할 문서 참조 유지 | plan inspect 경로 참조 287, 296, 298행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/public-name-regression.test.js` | `public name tests` | Modify | 공개 이름 회귀 검사 | plan skill 테스트 경로 참조 유지 | plan inspect 경로 참조 83행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |

#### Constraints

추가로 확인된 테스트는 기존 assertion을 보존한다. 승인된 동작 변경과 직접 충돌하는 assertion이 없는 한 수정하지 않는다.
감사 명령의 입력 거절과 기록 의미는 바꾸지 않는다. 역할 생성본을 source와 동기화한다.

### drive-execution/task-verification-recovery/003

#### Goal & intent

모든 구현 task 통합 뒤 blueprint 계약이 전체 CI를 통과하는지 확인한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/task-verification-recovery/004 · `b40c5863`

#### Goal & intent

root가 coordinator 반환 이후 진행 여부를 재현 가능한 실제 명령으로 판단한다. Contract 3과 기존 worker 관찰 및 복구 규칙을 보존한다.

#### Current behavior

`skills/bouncer-run/SKILL.md:202`의 root 표와 completed_tasks 집합 비교는 모델이 직접 해석하며 실행 가능한 판정 함수가 없다. `coordinate status`는 checkpoint를 출력하고 executor 관찰은 host만 알 수 있다. `test/skill-bouncer-run.test.js:253`은 문서만 검사한다.

#### Target behavior

읽기 전용 `bouncer coordinate progress`가 baseline 및 현재 completed task ID 집합, host가 관찰한 worker 상태, 보고 유무와 단일 복구 사용 여부를 받아 표에 따른 wait, continue, recovery, worker-state-unknown, worker-report-missing, no-progress를 반환한다. 새로운 ID는 개수가 같아도 진행이며 hash만 바뀌면 진행이 아니다. 완료·차단·partial_closed는 별도 종결 경로로 남긴다. 잘못되거나 누락된 입력은 오류를 반환하고 원장과 worktree를 변경하지 않는다. root는 실제 host 관찰을 전달하고 반환된 판정을 사용하며 running은 같은 핸들을 기다린다.

#### Interface

- 제공: `coordinate progress` 읽기 전용 CLI 및 판정 함수; root가 status의 baseline과 새 checkpoint에서 ID를 전달하고 host 관찰 및 recovery 여부를 제공한다.
- 거부: 형식 오류, 불명확한 관찰이나 누락된 필수 필드는 실패시키고 진행으로 추정하지 않는다. CLI는 executor를 관찰하거나 보고 내용을 판단하지 않는다.

호출 형식은 `bouncer coordinate progress --baseline-ids <json> --current-ids <json> --observation <value> --report <value> --recovery-used <value>`다. 모든 옵션은 정확히 한 번 필수다.

- `--baseline-ids`, `--current-ids`: 각각 JSON 배열 문자열; 각 원소는 빈 문자열이 아닌 task ID 문자열이다. 빈 배열은 허용하며 중복 ID는 집합으로 처리한다. 비교는 정확한 문자열 일치로 한다.
- `--observation`: `running`, `unknown`, `terminated` 중 하나. `terminated`는 관찰 대상 전체가 종료되었음을 뜻한다.
- `--report`: `present` 또는 `absent`; host가 raw report 존재를 관찰한 결과다. `--recovery-used`: `true` 또는 `false`; 현재 baseline에 대해 단일 복구가 이미 사용되었는지 나타낸다.
- 성공 시 stdout JSON `{ "ok": true, "decision": "..." }`, 종료 코드 0. decision은 `wait`, `continue`, `recovery`, `worker-state-unknown`, `worker-report-missing`, `no-progress` 중 하나다.
- 누락·중복·미지정 옵션, 값 누락, 잘못된 JSON, 배열이 아닌 값, 빈 문자열이나 문자열이 아닌 ID, 허용되지 않은 enum은 stdout JSON `{ "ok": false, "code": "invalid-progress-input" }`과 종료 코드 2로 거절한다. 판단을 반환하거나 파일을 변경하지 않는다.

판정 우선순위: 먼저 입력 전체를 검증한다. 유효한 입력에서 `running`은 ID 변화나 recovery 여부와 무관하게 `wait`이다. 그 외에는 새 완료 ID가 있으면 `continue`다. 새 ID가 없고 `unknown`이면 report absent는 `worker-state-unknown`, present는 recovery 미사용 시 `recovery`, 사용 후 `no-progress`다. 새 ID가 없고 `terminated`이면 report absent는 `worker-report-missing`, present는 recovery 미사용 시 `recovery`, 사용 후 `no-progress`다. 따라서 실행 중인 worker가 있으면 hash-only 또는 복구 후 무진척보다 wait가 우선한다. terminal coordinator 결과에는 이 명령을 호출하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinate-progress.ts` | progress | Create | 없음 | 순수 판정 함수 | 현재 판정은 skill 표에만 있음 |
| `packages/cli/src/cli-git-commands.ts` | coordinate | Modify | coordinate 인자와 실행 라우팅 | progress 진입점 연결 | coordinate 명령 등록 및 검증 |
| `packages/cli/src/cli-usage.ts` | coordinate usage | Modify | CLI 도움말 | 진행 명령 입력과 결과 명시 | coordinate usage 표 |
| `skills/bouncer-run/SKILL.md` | coordinator loop | Modify | root 실행 절차 | 실제 명령 호출과 결과 처리 | 202–226행 표 |
| `test/coordinate-progress.test.js` | progress | Create | 없음 | 실제 명령의 행동 검증 | root에 쓰이는 계약 보호; integration tier로 `test/tiers.json`에 등록 |
| `test/skill-bouncer-run.test.js` | run skill | Modify | root 문서 계약 | 연결 및 기존 문서 계약 확인 | 기존 진행 문서 테스트 |
| `test/tiers.json` | tiers | Modify | 테스트 tier 등록 | 신규 테스트를 integration tier에 등록 | check-task 등록 검사 |
| `test/coordinate-next-recovery.test.js` | `recovery tests` | Modify | coordinate 복구 계약 | hash만 바뀐 사례 계약 유지 | plan inspect 경로 참조 330행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/distribution.test.js` | `distribution tests` | Modify | 배포 문서 검사 | run skill 경로 참조 유지 | plan inspect 경로 참조 79행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/public-name-regression.test.js` | `public name tests` | Modify | 공개 이름 회귀 검사 | run skill 테스트 경로 참조 유지 | plan inspect 경로 참조 84행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/agents.test.js` | `agents tests` | Modify | 역할 문서 검사 | tier 참조 유지 | plan inspect 경로 참조 344행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/skill-spec-authoring.test.js` | `spec tests` | Modify | spec 작성 규칙 검사 | tier 참조 유지 | plan inspect 경로 참조 74행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |
| `test/test-tiers.test.js` | `tier tests` | Modify | tier 등록 검사 | tier 참조 유지 | plan inspect 경로 참조 8행; 필요 시 기존 계약을 보존하는 범위에서만 수정 |

#### Constraints

추가로 확인된 테스트는 기존 assertion을 보존한다. 승인된 동작 변경과 직접 충돌하는 assertion이 없는 한 수정하지 않는다.
root가 real host handle만으로 observation을 제공하며 ledger hash나 active를 살아 있다는 증거로 사용하지 않는다. recovery 재시도는 동일 진행 기준에서 한 번만 허용한다. 기존 terminal 결과는 재발송하지 않는다.