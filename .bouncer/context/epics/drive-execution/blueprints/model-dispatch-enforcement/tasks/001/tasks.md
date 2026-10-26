---
type: bouncer.tasks
title: 리뷰 디스패치의 역할별 모델 메타데이터 추가
description: Expose configured role models in plan and execute review dispatch payloads.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - subagent
  - model
  - dispatch
timestamp: '2026-10-26T14:14:43.304+09:00'
bouncer:
  id: TASKS-001
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: verified
  execution_kind: commit
  depends_on: []
  parallel_safe: false
  dependency_gate: integrated
  affected_paths:
    - packages/cli/src/subagents.ts
    - packages/cli/src/review-dispatch.ts
    - test/subagents.test.js
    - test/review-dispatch.test.js
    - test/context-review-state.test.js
  commit_intent:
    - 역할별 모델 설정을 한 곳에서 해석해 리뷰 디스패치가 호출에 필요한 값을 제공하도록 함.
  commit_summary: []
  exclusive_resources: []
  review_risk:
    - public_interface
  verify: node --test test/subagents.test.js test/review-dispatch.test.js test/context-review-state.test.js
  commit_sha: 7ff0f0af
---
# 리뷰 디스패치의 역할별 모델 메타데이터 추가

Blueprint: [model-dispatch-enforcement](../../index.md)

## Goal & intent
역할별 모델 설정을 한 곳에서 해석해 리뷰 디스패치가 호출에 필요한 값을 제공하도록 함.
수용 기준은 blueprint Contract의 작업 001 항목이며 전용 검증은 아래 Checklist와 frontmatter에 둔다.

## Current behavior
`resolveSubagentModel`은 config를 읽어 `{model, provider}`를 반환하지만 리뷰 payload에는 모델이 없다. `bouncer subagent-model`은 slug 또는 inherit 한 줄을 출력한다. `review-dispatch`의 plan·execute 결과에서 설정 모델과 호출 모델을 대조할 자료가 없다.

관찰: packages/cli/src/subagents.ts:66, packages/cli/src/review-dispatch.ts:69. I/O: packages/cli/src/subagents.ts:78의 readConfig와 packages/cli/src/review-dispatch.ts:617의 validateBlueprint·snapshot 수집. 테스트: test/subagents.test.js:49, test/review-dispatch.test.js:1609, test/context-review-state.test.js:157. 조사 HEAD 9cab1962edb316460fc22b1f57660e645f460e2b 기준 관련 파일 diff가 없어 근거를 재사용한다.

## Target behavior
성공한 plan 리뷰와 execute discovery·delta payload에 `agent_dispatch: {agent, provider, model}`을 추가한다. plan은 bouncer-context-reviewer, execute는 bouncer-reviewer를 가리킨다. provider와 model은 기존 resolver의 결과이며 null은 판별 불가 provider 또는 모델 상속을 뜻한다. skip·실패에는 필드를 추가하지 않는다. 기존 payload를 읽는 경로와 문서 digest는 보존한다.

## Interface
기존 `resolveSubagentModel({repoRoot, agentName, provider?})`의 반환형과 한 줄 CLI를 유지한다. 공통 메타데이터 조립은 같은 모듈에 두고 실제 심볼명은 구현자가 정한다. 공개 출력 필드는 agent_dispatch 하나이며 agent는 canonical named-agent 이름이다. 모델은 호출 직전에 config로 다시 확인해야 하는 설정값이며 호스트 실행 모델의 증명이 아니다. 모델 변경만으로 target.digest·문서 parts·follow_up을 바꾸지 않는다. 이전 payload의 agent_dispatch 부재는 정상 legacy 입력이며 새 형식으로의 강제 마이그레이션을 거부한다. 기존 잘못된 previous·구조·경로 거절 순서는 유지한다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/subagents.ts` | `resolveSubagentModel` | Modify | provider별 모델 해석 | 기존 resolver를 이용한 공통 dispatch 메타데이터 조립 | packages/cli/src/subagents.ts:66; packages/cli/src/cli-project-commands.ts:171 |
| `packages/cli/src/review-dispatch.ts` | `classifyPlanReview · classifyExecuteReview` | Modify | 리뷰 전략과 snapshot 출력 | 리뷰 성공 결과에 agent_dispatch 추가 | packages/cli/src/review-dispatch.ts:597; packages/cli/src/review-dispatch.ts:782 |
| `test/subagents.test.js` | `resolveSubagentModel 사례` | Modify | 모델 해석 회귀 | provider별 메타데이터와 상속 검사 추가 | test/subagents.test.js:49; test/subagents.test.js:330 |
| `test/review-dispatch.test.js` | `CLI review-dispatch plan and execute → emit JSON exit contracts` | Modify | 리뷰 payload 생성·검사 | plan·execute·delta·skip·실패 필드와 digest 독립성 검사 | test/review-dispatch.test.js:1609; test/review-dispatch.test.js:388 |
| `test/context-review-state.test.js` | `dispatchFile · start/record 사례` | Modify | 리뷰 payload 소비 fixture | 새 메타데이터의 저장·record와 기존 payload 수용 검사 | test/context-review-state.test.js:157; test/context-review-state.test.js:1124 |

## Do not touch
- `.bouncer/config.json`
- `packages/cli/dist`
- `scripts/lib`
- `AGENT-TEST-GUIDELINES-PROPOSAL.md`
- `GRAPHIFY-WORKFLOW-PROPOSAL.md`

## Constraints
기존 assertions의 기대값은 바꾸지 않고 새 필드 검사를 추가한다. agent_dispatch가 없는 fixture도 계속 허용한다. 기존 모델 슬롯·provider 우선순위·null/inherit 해석은 유지한다. provider 값을 anthropic으로 바꾸지 않는다. scripts/lib와 packages/cli/dist는 직접 수정하거나 범위에 넣지 않는다.
영향 경로는 plan.affected_paths에서 사용자가 확인한 값이다. 검증 명령은 plan.verify_command에서 사용자가 확인했다.

## Checklist
- [ ] 유효한 full plan과 execute fixture에 Claude·Codex 역할 모델을 지정하고 각각의 agent_dispatch 전체 객체를 deepStrictEqual로 검사하는 사례를 추가한다. 빌드 후 전용 검증 명령을 실행하면 기존 payload의 필드 부재가 첫 실패여야 한다. 모듈 적재 실패나 잘못된 plan 구조를 Red로 주장하지 않는다.
- [ ] 기존 resolver를 재사용해 메타데이터를 조립하고 plan·execute discovery·execute delta 성공 분기에 연결한다. skip·실패에는 agent_dispatch가 없음을 검사한다.
- [ ] 동일 문서의 설정 모델만 변경한 두 payload가 다른 model과 같은 target.digest·parts·follow_up을 갖는지 검사한다. legacy payload와 새 payload의 start·record 성공을 검사하고 stale 문서 거절은 유지한다.
- [ ] npm run build 후 아래 전용 검증 명령으로 완료 여부를 판단하고 worker 보고의 Tests에 명령과 결과를 남긴다.

확인한 전용 검증:

```bash
node --test test/subagents.test.js test/review-dispatch.test.js test/context-review-state.test.js
```
