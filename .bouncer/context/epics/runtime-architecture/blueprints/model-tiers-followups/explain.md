---
type: bouncer.explain
title: model-tiers-followups explain
description: Explain for model-tiers-followups
resource: .bouncer/context/epics/runtime-architecture/blueprints/model-tiers-followups/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T10:01:30.690+09:00'
bouncer:
  id: EXPLAIN-model-tiers-followups
  epic_id: runtime-architecture
  blueprint_id: model-tiers-followups
  status: published
  comprehension:
    - range_from: 31d226c6d753fa138236a958c82ea682d582761e
      range_to: 061850a534561c946c3062db263715a1d0dbe901
      diff_sha: 9275f4df32efc1e544630fd196bdf792d6c3e769465c05650bc7631eb6d97c86
      recorded_at: '2026-10-29T10:02:20.915+09:00'
  task_commits:
    - task: runtime-architecture/model-tiers-followups/001
      sha: 897f4a70
      intent_anchor: task-001
    - task: runtime-architecture/model-tiers-followups/002
      sha: 0f56aeb7
      intent_anchor: task-002
    - task: runtime-architecture/model-tiers-followups/003
      sha: bbd27467
      intent_anchor: task-003
    - task: runtime-architecture/model-tiers-followups/004
      sha: 061850a5
      intent_anchor: task-004
---
# Explain

## Background

역할별 모델·effort 설정에는 세 군데 어긋남이 남아 있었다. Codex용 `.codex/agents/*.toml`에 effort가 반영되지 않았고, 잘못된 provider 값이 오류 메시지에 그대로 실려 한 줄 출력 계약을 깼으며, hook 안내문이 실제로는 모델이 바뀌지 않았는데도 "모델이 보정됐다"고 말했다. 여기에 `metrics start`가 `/` 같은 구분자뿐인 blueprint 값을 받아 어떤 blueprint에도 묶이지 않는 세션을 남기는 문제, `bouncer-plan` 스킬의 graphify 단계 순서가 task 문서 작성 뒤로 읽히는 문제가 겹쳐 있었다. 이 변경은 이들을 입력 검증과 안내 문구 수준에서 바로잡는다.

## Code

- `packages/cli/src/codex-agents.ts`, `init.ts`, `cli-project-commands.ts`: Codex TOML 시드에 `model_reasoning_effort` 줄을 `sandbox_mode` 뒤, `developer_instructions` 앞에 쓴다. 설정에 effort가 없으면 `medium`이다. 검증은 effort만 보고(tier 오류는 `subagent-model`이 맡는다) `bouncer init`은 Codex 시드 대상일 때만 effort를 검사하므로, Codex를 쓰지 않는 저장소는 effort 오류로 막히지 않는다. 오류가 나면 `role-config-invalid`와 함께 고칠 키를 `next`로 알린다.
- `scripts/check-emit.js`: 체크인된 `.codex/agents`와 생성물의 parity를 워킹트리가 아니라 index(`git show :<path>`)로 비교한다. 커밋될 바이트를 막기 위해서이며, `agents/`가 없는 저장소는 건너뛴다.
- `packages/cli/src/subagents.ts`: 선택된 provider가 허용 목록 밖이면 원문을 싣지 않고 provider를 `null`로 비운 채 오류를 낸다. 고칠 키는 값이 `--provider` 인자에서 왔으면 `--provider`, config에서 왔으면 `subagents.provider`다. 유효한 명시 인자는 config를 이기는 기존 우선순위를 그대로 유지한다.
- `hooks/subagent-model.js`: 안내문을 세 가지로 나눴다. 모델이 실제로 바뀐 경우에만 "모델 설정이 보정되었습니다", effort만 바뀐 경우는 "호출 설정이 보정되었습니다", 옛 runtime 안내만 있으면 안내만 낸다.
- `packages/cli/src/drive-metrics.ts`: `startSession`이 blueprint를 정규화한 결과가 빈 문자열이면 쓰기 전에 거절한다. `end`의 바인딩 검사와 같은 기준이다.
- `skills/bouncer-plan/SKILL.md`: graphify 후보 작성 시점을 "After authoring"에서 "Before authoring task documents"로 바꿨다.
- `scripts/verify-model-tiers-followups.js`: `codex`, `provider`, `metrics`, `plan` 네 인자를 받는 검증 래퍼다.
- 한계: `init`의 ensure 이후 실패 분기는 선검증 때문에 사실상 도달하지 않는다. `test/subagents.test.js`의 NUL 부재 단언은 `JSON.stringify`가 escape하므로 항상 참이며, 실제 검증은 `provider === null` 단언과 CLI의 `provider=-` 단언이 맡는다. `check-emit`의 stale Codex 에이전트 거절 분기에는 테스트가 없다.

## Quiz

1. `config`의 `subagents.provider`가 허용 목록 밖의 값일 때 `subagent-model`은 무엇을 하는가?
   - A) 값을 `claude`로 바꿔 계속 진행한다.
   - B) 원문을 오류에 싣지 않고 provider를 비운 채 `subagents.provider`를 고치라고 알린다.
   - C) 잘못된 값을 오류 메시지에 그대로 인용한다.
2. Codex 시드 TOML에서 역할 설정에 effort가 없으면 `model_reasoning_effort`는 무엇이 되는가?
   - A) `high`
   - B) 줄을 쓰지 않는다.
   - C) `medium`
3. hook이 "모델 설정이 보정되었습니다"라고 안내하는 경우는 언제인가?
   - A) 모델이 실제로 바뀐 경우만
   - B) effort가 바뀌기만 해도
   - C) strong 통과로 모델을 유지한 경우에도
4. `bouncer metrics start --blueprint /`를 실행하면 어떻게 되는가?
   - A) 빈 blueprint에 묶인 세션이 저장된다.
   - B) 정규화 결과가 비어 쓰기 전에 거절된다.
   - C) 현재 포인터의 blueprint로 대체된다.

## Tasks

### runtime-architecture/model-tiers-followups/001 · `897f4a70`

#### Goal & intent

Codex 역할 TOML의 `model_reasoning_effort`를 소비 저장소 설정과 일치시킨다. 생성·검사와 사용자 소유 파일 보존을 검증한다.

#### Current behavior

`mdToCodexToml`은 역할 본문만 변환하고 `ensureCodexAgents`는 생성 마커가 있는 파일만 쓴다 (`packages/cli/src/codex-agents.ts:46,123,194`). 검사도 같은 변환 결과와 파일 바이트를 비교한다 (`:106,132`). 신규 init은 설정을 쓴 뒤 시드하지만 기존 저장소 경로는 시드가 먼저다 (`packages/cli/src/init.ts:515,658`). 재현은 `npm run build` 후 `node --test test/agents.test.js test/init.test.js test/cli-project-commands.test.js`이다.

#### Target behavior

- 성공: 설정의 `roles.<agent>.effort`가 `low`, `medium`, `high`면 생성과 check가 동일한 값으로 `model_reasoning_effort`를 산출한다. 부재 또는 null이면 `medium`이다. 기존 생성본은 config 변경 후 check mismatch, 재동기화 후 일치한다.
- 실패: 잘못된 effort를 파일 쓰기 전에 거절하고 설정 키와 수정·사용자 확인 안내를 제공한다. 부분 갱신을 남기지 않는다.
- 보존: 생성 마커 없는 사용자 소유 파일은 변경하지 않고, 모델 slug·tier 해석과 기존 JSON 필드를 유지한다.

#### Interface

- 제공: init 시드와 `codex-agents check`는 같은 config 기준 TOML을 사용한다. 읽기 전용 check는 파일을 변경하지 않는다.
- 거부: 역할 effort가 세 허용 문자열 외의 값이면 오류를 내고 호출자가 설정 수정 여부를 사용자에게 확인한다. 누락과 null은 medium 기본값이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/codex-agents.ts` | `mdToCodexToml, checkCodexAgent, ensureCodexAgents` | Modify | Codex 역할 TOML 생성 및 비교 | 설정 effort 반영 및 검증 | packages/cli/src/codex-agents.ts:46,106,166 |
| `packages/cli/src/init.ts` | `ensureCodexAgents` | Modify | 설정 생성과 시드 호출 | 설정 생성·검증 순서 보장 | packages/cli/src/init.ts:515,658 |
| `packages/cli/src/cli-project-commands.ts` | `codex-agents check` | Modify | 검사 명령 결과 출력 | 설정 오류 안내 | packages/cli/src/cli-project-commands.ts:227 |
| `test/agents.test.js` | `mdToCodexToml` | Modify | 생성물 동등성과 소유권 검증 | 기본 및 설정 effort 검사 | test/agents.test.js:53,91 |
| `test/init.test.js` | `init` | Modify | 초기화 시드 검증 | 기존 설정 변경·잘못된 설정 확인 | test/init.test.js:802 |
| `test/cli-init.test.js` | `init` | Modify | CLI 시드 확인 | 오류 경로 확인 | test/cli-init.test.js:56 |
| `test/cli-project-commands.test.js` | `codex-agents check` | Modify | 검사 명령 확인 | 설정 변경 시 불일치와 오류 확인 | test/cli-project-commands.test.js:1518 |
| `test/distribution.test.js` | `mdToCodexToml` | Modify | 배포 역할 변환 확인 | 기본 effort parity 확인 | test/distribution.test.js:245 |
| `scripts/check-emit.js` | `build check` | Modify | 생성물 일치 검증 | 설정 독립 재현성 반영 | scripts/check-emit.js:94 |
| `rules/subagent-model.md` | `Codex effort` | Modify | 호스트 전달 설명 | 시드와 spawn 우선 관계 설명 | rules/subagent-model.md:32 |
| `rules/cli.md` | `codex-agents check` | Modify | 검사 명령 설명 | 설정 오류와 동기화 설명 | rules/cli.md:506 |
| `docs/configuration.md` | `roles effort` | Modify | effort 설정 설명 | TOML 기본값 및 사용자 설정 반영 | docs/configuration.md:31,180 |
| `scripts/verify-model-tiers-followups.js` | `신규 추출 지점: task 검증` | Create | 없음 | 영역별 build, 테스트 및 정적 검사 래퍼 | package.json scripts: ci와 build |
| `.codex/agents/bouncer-reviewer.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |
| `.codex/agents/bouncer-implementer.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |
| `.codex/agents/bouncer-debugger.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |
| `.codex/agents/bouncer-context-reviewer.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |
| `.codex/agents/bouncer-coordinator.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |
| `.codex/agents/bouncer-planner.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |
| `.codex/agents/bouncer-plan-coordinator.toml` | `model_reasoning_effort` | Modify | 생성된 역할 정의 | 생성 정본과 값 동기화 | test/agents.test.js:53 |

#### Constraints

- 저장소 `.bouncer/config.json`은 수정하지 않는다. 체크인 생성물과 parity 검사는 저장소 개인 설정에 의존하지 않는 명시적 fixture 설정을 사용한다.
- 변경된 테스트의 기존 생성 마커와 사용자 파일 보존 단언은 그대로 유지한다. effort 기본값은 Codex TOML에 한정하며 기존 `subagent-model --json` null 의미를 바꾸지 않는다.
- 검증 래퍼는 `codex`, `provider`, `metrics`, `plan` 네 argv를 지원하고 각각 `npm run build`, 해당 테스트, 해당 파일에 적용되는 CI 정적 검사 및 생성물 parity 검사를 수행한다. 이후 작업은 래퍼를 수정하지 않는다.

### runtime-architecture/model-tiers-followups/002 · `0f56aeb7`

#### Goal & intent

hook이 실제로 변경한 항목만 안내하고 지원하지 않는 provider를 안전한 한 줄 오류로 거절한다.

#### Current behavior

hook은 effort만 변경하거나 legacy 안내만 있어도 모델 변경 문구를 출력한다 (`hooks/subagent-model.js:123,157`). `resolveProvider`는 비어 있지 않은 임의 문자열을 반환하며 CLI는 해석 결과를 stderr로 출력한다 (`packages/cli/src/subagents.ts:37`, `packages/cli/src/cli-project-commands.ts:171`). `npm run build` 후 `node --test test/subagent-model-hook.test.js test/subagents.test.js test/cli-project-commands.test.js`로 기존 분기를 재현한다.

#### Target behavior

- 성공: 선택된 provider는 `claude`, `cursor`, `codex`, `antigravity` 중 하나이며 유효한 명시 override가 config보다 우선한다. hook은 모델 변경, effort만 변경, legacy 안내만 있는 경우를 구별한다.
- 실패: 선택된 값이 허용 목록 밖이면 `role-config-invalid`, exit 1, stderr 한 줄과 수정 키를 낸다. 원시 제어문자나 provider를 오류에 복사하지 않는다.
- 보존: strong 유지 분기, 기존 한 줄 출력 및 JSON 필드 집합은 유지한다.

#### Interface

- 제공: 기존 `subagent-model` 호출과 hook JSON 형식은 유지한다.
- 거부: 선택된 provider는 네 문자열만 허용한다. `subagents.provider`가 선택된 잘못된 설정이면 수정 키를 안내하고, 유효한 `--provider`가 있으면 기존 우선순위대로 설정을 덮는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `hooks/subagent-model.js` | `additionalContext` | Modify | 호출 보정 안내 | 실제 모델 변경일 때만 모델 보정 안내 | hooks/subagent-model.js:123,157 |
| `packages/cli/src/subagents.ts` | `resolveProvider` | Modify | provider 해석 | 선택된 provider 목록 검증 | packages/cli/src/subagents.ts:7,37 |
| `packages/cli/src/cli-project-commands.ts` | `subagent-model` | Modify | 한 줄 오류 출력 | 안전한 provider 오류 표시 | packages/cli/src/cli-project-commands.ts:171 |
| `test/subagent-model-hook.test.js` | `hook` | Modify | hook 출력 검사 | 세 변경 상황 단언 | test/subagent-model-hook.test.js:97,232 |
| `test/subagents.test.js` | `resolveProvider` | Modify | provider 우선순위 검사 | 허용 및 거절 사례 확인 | test/subagents.test.js:66 |
| `test/cli-project-commands.test.js` | `subagent-model` | Modify | CLI 출력 검사 | 제어문자 오류 한 줄 단언 | test/cli-project-commands.test.js:1422,1503 |
| `rules/cli.md` | `subagent-model` | Modify | CLI 계약 설명 | 목록과 오류 안내 | rules/cli.md:496 |
| `docs/configuration.md` | `subagents.provider` | Modify | 설정 설명 | 목록 제한과 override 명시 | docs/configuration.md:27 |

#### Constraints

- 기존 `subagent-model with a control-character tier`의 한 줄 오류 계약과 strong 유지 assertion을 완화하지 않는다.
- 새로운 테스트 파일을 만들지 않는다. 직접 프로세스와 hook 출력은 기존 fixture 경계에서 검사한다.

### runtime-architecture/model-tiers-followups/003 · `bbd27467`

#### Goal & intent

metrics 시작 시 정규화된 blueprint가 비면 저장 전에 거절한다.

#### Current behavior

`startSession`은 원문 빈 문자열만 검사하고 저장할 때 정규화한다 (`packages/cli/src/drive-metrics.ts:225,240`). `end`는 정규화 후 빈 값을 `invalid-metrics-input`으로 거절한다 (`:313`). 세션은 파일을 읽고 갱신해 저장한다 (`:234,254`). `npm run build` 후 `node --test test/cli-metrics.test.js`로 기존 테스트를 재현한다.

#### Target behavior

- 성공: plan kind는 blueprint 생략을 계속 허용하고 정상 경로는 기존과 같이 정규화한다.
- 실패: `/`, `\`, `//`는 `invalid-metrics-input`, exit 1이며 metrics 파일을 변경하지 않는다.
- 보존: end 바인딩 및 summary 계약을 바꾸지 않는다.

#### Interface

- 제공: `metrics start --kind <plan-kind>`의 생략된 blueprint는 null이다.
- 거부: 명시된 blueprint를 구분자 정규화한 결과가 빈 문자열이면 쓰기 전 거절한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/drive-metrics.ts` | `startSession, normalizeBlueprint` | Modify | metrics 세션 생성 | 정규화 후 빈 blueprint 거절 | packages/cli/src/drive-metrics.ts:82,225,240 |
| `test/cli-metrics.test.js` | `metrics start` | Modify | 시작과 바인딩 검증 | 빈 정규화 값과 파일 불변 확인 | test/cli-metrics.test.js:1020 |
| `rules/cli.md` | `metrics start` | Modify | 시작 명령 계약 | 빈 정규화 값 거절 명시 | rules/cli.md:170 |
| `docs/configuration.md` | `metrics` | Modify | 설정 및 동작 안내 | 관련 설명을 동기화 | docs/configuration.md:180 |

#### Constraints

- 기존 정규화 함수와 end 오류 코드의 정본을 재사용한다. 정상 입력과 파일 손상 처리 우선순위를 불필요하게 바꾸지 않는다.

### runtime-architecture/model-tiers-followups/004 · `061850a5`

#### Goal & intent

계획 스킬이 확인된 경로 집합을 작성 전에 사용하고 집합 밖 경로가 필요하면 재확인한다고 명확히 설명한다.

#### Current behavior

스킬은 작성 후 Graphify 후보를 만든다는 문장과 확인된 집합만 작성한다는 규칙을 함께 둔다 (`skills/bouncer-plan/SKILL.md:294,297`). 스킬 표면 테스트는 집합 밖 경로의 재확인 문구를 검사한다 (`test/skill-bouncer-surface.test.js:249`). `npm run build` 후 `node --test test/skill-bouncer-surface.test.js`가 기존 기준선이다. 역할 문서 `agents/bouncer-plan-coordinator.md:59`와 생성본 `.codex/agents/bouncer-plan-coordinator.toml:59`는 후보 경로 checkpoint 뒤 authoring을 기술한다. 두 파일에서 `After authoring, build candidates`, `graphify-runner`, `affected_paths`를 검색한 결과 옛 순서 문구와 동일한 문구는 없다. 따라서 두 파일의 변경은 필요하지 않다.

#### Target behavior

- 성공: 작성 전에 후보를 확인하고 planner가 확인된 집합만 쓰며 집합 밖 경로는 `needs_user`와 재확인을 요구한다.
- 거부: Graphify 후보, intent, Explain 결과만으로 frontmatter를 채우지 않는다.
- 보존: 기존 승인과 게이트 절차는 변하지 않는다.

#### Interface

- 제공: 스킬 설명은 실제 확인 → 작성 흐름을 전달한다.
- 거부: 작성 후 후보 생성이라는 옛 순서 문구와 미확인 경로의 자동 적용은 없다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | `plan.affected_paths` | Modify | 계획 단계 설명 | 후보 확인과 작성의 순서 모순 제거 | skills/bouncer-plan/SKILL.md:294,297 |
| `test/skill-bouncer-surface.test.js` | `plan skill surface` | Modify | 스킬 문구 검사 | 옛 문구 부재와 새 순서 단언 | test/skill-bouncer-surface.test.js:249 |

#### Constraints

- 기존 `test/skill-bouncer-surface.test.js`의 재확인 계약은 유지한다. 후보는 advisory이며 frontmatter 입력이 아니라는 규칙을 유지한다.
- 역할 문서와 생성본의 조사 결과를 유지하며 두 파일은 수정 범위에 넣지 않는다.

### runtime-architecture/model-tiers-followups/005

#### Goal & intent

모든 구현 task 통합 후 저장소의 전체 CI가 통과하는지 확인한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.