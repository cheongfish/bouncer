---
type: bouncer.tasks
title: 모델 거절 중단과 리뷰 기록 순서의 지침 정합화
description: Stop rejected model dispatches and record plan reviews before document revision.
resource: .bouncer/context/epics/drive-execution/blueprints/model-dispatch-enforcement/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - subagent
  - model
  - dispatch
timestamp: '2026-10-26T14:14:48.012+09:00'
bouncer:
  id: TASKS-003
  epic_id: drive-execution
  blueprint_id: model-dispatch-enforcement
  status: verified
  execution_kind: commit
  depends_on:
    - TASKS-001
    - TASKS-002
  parallel_safe: false
  dependency_gate: integrated
  affected_paths:
    - rules/subagent-model.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-plan/references/context-review.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-run/references/agent-dispatch.md
    - rules/cli.md
    - docs/configuration.md
    - test/subagents.test.js
    - test/skill-bouncer-run.test.js
    - test/skill-bouncer-surface.test.js
  commit_intent:
    - 모델 해석과 사용자 알림을 디스패치 단계에 명시하고 리뷰 기록이 성공한 뒤 문서를 수정하도록 함.
  commit_summary: []
  exclusive_resources: []
  review_risk: []
  verify: node --test test/subagents.test.js test/skill-bouncer-run.test.js test/skill-bouncer-surface.test.js
  commit_sha: 005282cd
---
# 모델 거절 중단과 리뷰 기록 순서의 지침 정합화

Blueprint: [model-dispatch-enforcement](../../index.md)

## Goal & intent
모델 해석과 사용자 알림을 디스패치 단계에 명시하고 리뷰 기록이 성공한 뒤 문서를 수정하도록 함.
수용 기준은 blueprint Contract의 작업 003 항목이며 전용 검증은 아래 Checklist와 frontmatter에 둔다.

## Current behavior
rules/subagent-model.md item 3은 slug 거절 시 inherit 재시도를 지시한다. agent-dispatch의 모델 기록 절도 이 재시도를 전제한다. plan SKILL은 context-review 참조를 통해 모델 규칙을 간접 연결한다. context-review의 Merge 다음 Revise 사이에 record 성공 확인 단계가 분명하지 않아 수정 후 stale record 거절이 생길 수 있다.

관찰: rules/subagent-model.md:12와 :35, skills/bouncer-plan/SKILL.md:281. I/O: 해당 없음: 문서와 문서 검사만 변경하고 리뷰 state의 쓰기는 기존 CLI가 소유한다. 테스트: test/subagents.test.js:463, test/skill-bouncer-run.test.js:47, test/skill-bouncer-surface.test.js:74. 소비자 조사: skills/bouncer-run/references/agent-dispatch.md:323·334·339·342, rules/cli.md:445·453, docs/configuration.md:126. 조사 HEAD 9cab1962edb316460fc22b1f57660e645f460e2b 기준 관련 파일 diff가 없어 근거를 재사용한다.

## Target behavior
모든 named 역할에서 모델 거절 시 중단하고 provider·역할·설정 모델명·거절 사유·설정 수정 위치를 사용자에게 알린다. 호스트가 지원 모델명을 직접 반환한 경우만 그대로 안내한다. 확인되지 않은 대체 모델명·별칭을 생성하지 않는다. plan discovery·delta와 run coordinator·implementer·debugger·reviewer는 호출 전에 모델을 해석·전달한다. 새 리뷰 payload의 agent_dispatch를 사용하되 호출 직전 config와 불일치하면 최신 설정으로 다시 해석해 알린다. 리뷰 순서는 Freeze → start → reviewer 완료 → merge → record 성공 확인 → revise → route에 따른 후속 처리로 명시한다.

## Interface
기존 subagent-model 한 줄 출력과 provider 이름을 유지한다. plan·execute metadata는 설정의 관찰값이며 실제 모델 증거가 아님을 rules/cli.md와 docs/configuration.md에 명시한다. Claude 훅 additionalContext의 변경 사실을 컨트롤러가 사용자에게 전달한다. stale 검사·restart 한도·승인 조건·frontend model:inherit는 변경하지 않는다. 호스트의 named-agent 부재 fallback은 보존하되 모델 거절을 named-agent 부재로 재분류하지 않는다. record 실패 시 문서 수정과 새 digest로 기존 보고를 재라벨링하는 행동을 금지한다.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/subagent-model.md` | `item 1 · item 3` | Modify | 공통 모델·fallback 규칙 | 거절 중단·정확한 모델명·보정 알림 계약 | rules/subagent-model.md:12; rules/subagent-model.md:35 |
| `skills/bouncer-plan/SKILL.md` | `Review` | Modify | 계획 리뷰 진입 | 모델 조회와 record-before-edit 직접 명시 | skills/bouncer-plan/SKILL.md:281; test/skill-bouncer-surface.test.js:74 |
| `skills/bouncer-plan/references/context-review.md` | `Discovery · Merge · Revise · delta` | Modify | 리뷰 호출·기록 절차 | 호출 모델 전달과 독립 Record 단계 추가 | skills/bouncer-plan/references/context-review.md:17·54·67 |
| `skills/bouncer-run/SKILL.md` | `coordinator dispatch` | Modify | 드라이브 디스패치 진입 | 거절 중단과 보정 사실 보고 연결 | skills/bouncer-run/SKILL.md:156; test/skill-bouncer-run.test.js:47 |
| `skills/bouncer-run/references/agent-dispatch.md` | `Worker model and token records` | Modify | 작업자 모델 인자와 기록 | inherit 재시도 지시 제거·거절 중단 | skills/bouncer-run/references/agent-dispatch.md:314·323·334·339·342 |
| `rules/cli.md` | `review-dispatch · subagent-model` | Modify | CLI 출력 설명 | agent_dispatch 형식과 상속·출처 설명 | rules/cli.md:445; rules/cli.md:453 |
| `docs/configuration.md` | `subagents` | Modify | 설정 사용 안내 | 기존 슬롯·Claude 보정·거절 복구 설명 | docs/configuration.md:126; docs/configuration.md:148 |
| `test/subagents.test.js` | `coordinator dispatch → shares the model contract and keeps its full fallback brief` | Modify | 공통 모델 문서 계약 | 재시도 기대를 중단 기대와 사용자 보고 검사로 변경 | test/subagents.test.js:463·468·699·704 |
| `test/skill-bouncer-run.test.js` | `run skill model check` | Modify | run 지침 검사 | 거절 중단과 보정 알림 연결 검사 | test/skill-bouncer-run.test.js:47 |
| `test/skill-bouncer-surface.test.js` | `plan review 절차` | Modify | 스킬 표면과 참조 검사 | 모델 조회·독립 Record·성공 후 Revise 순서 검사 | test/skill-bouncer-surface.test.js:74·92 |

## Do not touch
- `.bouncer/config.json`
- `packages/cli/dist`
- `scripts/lib`
- `AGENT-TEST-GUIDELINES-PROPOSAL.md`
- `GRAPHIFY-WORKFLOW-PROPOSAL.md`

## Constraints
기존 test/subagents.test.js의 coordinator dispatch → shares the model contract and keeps its full fallback brief 및 subagent-model rule → points run workers at agent-dispatch without dropping its own boundaries 두 테스트에서 rejected model slug 뒤 inherit 기대를 모델 거절 중단·자동 재시도 금지 기대로 바꾼다. 다른 기존 기대값과 coordinator 전체 fallback brief 검사는 보존한다. 문서 단계 수·길이를 고정한 소비자를 조사해 기존 규칙 안에서 문장을 교체한다. 역할 본문과 생성 TOML은 수정하지 않는다. config 파일의 예제 주석은 실행 계약이 아니며 이 task 범위에 넣지 않는다.
영향 경로는 plan.affected_paths에서 사용자가 확인한 값이다. 검증 명령은 plan.verify_command에서 사용자가 확인했다.

## Checklist
- [ ] 기존 두 테스트의 재시도 assertion을 승인된 새 중단 계약으로 바꾸고, plan 리뷰의 모델 조회와 record 성공 확인이 Revise보다 앞선다는 문서 계약 검사를 추가한다. 전용 명령에서 이전 retry 문구와 Record 단계 부재가 Red가 되는지 확인한다.
- [ ] 공통 규칙과 모든 Touch 소비자를 함께 수정한다. 모델 거절을 부모 모델·별칭·generic fallback으로 자동 우회하지 않으며 설정 모델명과 호스트 원문 사유를 보고하도록 쓴다.
- [ ] 리뷰 round 1의 record 성공 전 문서 수정을 금지하고 record 실패 시 현재 문서·보고를 보존하도록 명시한다. 승인·stale·restart 정책은 유지한다.
- [ ] 전체 문서 검색에서 현행 경로의 inherit 재시도 지시가 남지 않았는지 확인한다. 역사 문서는 고치지 않는다. 아래 전용 검증 명령으로 완료 여부를 판단한다.

확인한 전용 검증:

```bash
node --test test/subagents.test.js test/skill-bouncer-run.test.js test/skill-bouncer-surface.test.js
```
