---
type: bouncer.blueprint
title: 역할 모델 등급 계층과 effort 해석
description: 역할이 provider 공통 등급과 effort를 가리키고 provider 블록이 등급을 실제 모델로 매핑한다.
resource: .bouncer/context/epics/runtime-architecture/blueprints/model-tiers-effort/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-27T09:58:30.488+09:00'
bouncer:
  id: model-tiers-effort
  epic_id: runtime-architecture
  blueprint_id: model-tiers-effort
  status: closed
  order: 42
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 수락 기준이 CLI 설정 해석과 subagent-model 출력 계약에 모여 runtime-architecture domain에 귀속
  supersedes: []
---
# model-tiers-effort 역할 모델 등급 계층과 effort 해석

Epic: [runtime-architecture](../../index.md)

## Intent
역할 모델을 provider마다 slug로만 지정하던 설정 위에 `strong`·`standard`·`light` 등급과 effort를 두어, 역할은 등급을 가리키고 provider 블록이 등급을 실제 모델로 매핑하게 한다. 등급 매핑이 비어 있으면 다른 모델로 대체하지 않고 거절해 사용자가 설정을 고치게 한다.

## Contract
- 인터페이스:
  - `.bouncer/config.json` 선택 키 두 개.
    ```jsonc
    "model_tiers": { "<provider>": { "strong" | "standard" | "light": "<slug>" | "inherit" } },
    "roles": { "<agent>": { "tier"?: "strong" | "standard" | "light", "effort"?: "low" | "medium" | "high" } }
    ```
  - `bouncer subagent-model --agent <name> [--provider <name>] [--json]`. 플래그 없이는 지금처럼 slug 또는 `inherit` 한 줄. `--json`은 한 줄 JSON `{provider, role, tier, model, effort, source}`.
  - 라이브러리 `resolveSubagentRole()`(오류 변형을 반환, throw 없음). 기존 `resolveSubagentModel()`·`resolveSubagentDispatch()`는 시그니처와 반환 모양을 유지한다.
  - `bouncer dispatch print` 성공 결과에 `effort` 필드를 더하고, 실패 `reason`에 `tier-unmapped`·`role-config-invalid`를 더한다. print dispatch는 `resolveSubagentModel()` 대신 `resolveSubagentRole()`을 써서 오류면 prompt를 쓰기 전에 실패한다.
- 데이터·상태: 해석 우선순위는 `subagents.<provider>.<agent>` slug(값이 `inherit`·빈 문자열·비문자열·부재면 미설정) → `roles.<agent>.tier`를 `model_tiers.<provider>`로 매핑 → `inherit`. effort는 `roles.<agent>.effort`(부재·`null`은 `null`)이며 모델 출처와 무관하게 실린다. 조회한 역할의 `roles.<agent>`는 slot slug가 이기거나 provider가 없을 때도 검증한다. 이 저장소의 `.bouncer/config.json`은 바꾸지 않는다.
- 수용 기준: epic Success criteria 15가 참이다. 기존 slug 설정의 한 줄 출력·`agent_dispatch` payload·hook 보정이 지금과 같다.
- 검증 명령: `npm run ci` (terminal `TASKS-004`)
- 실패 모드·엣지 케이스:
  - 역할이 등급을 가리키는데 `model_tiers.<provider>.<tier>`가 없거나 빈 문자열·비문자열이거나 `model_tiers` 블록 자체가 없으면 `tier-unmapped` 오류다. 다른 등급·부모 모델로 대체하지 않는다. 매핑 값 `inherit`은 오류가 아니라 부모 모델 상속이다.
  - `roles`가 객체가 아니거나, `roles.<agent>`가 객체가 아니거나, `tier`가 세 값 밖이거나, `effort`가 `low|medium|high`·`null` 밖이면 `role-config-invalid` 오류다. `model_tiers`·`model_tiers.<provider>`가 객체가 아니면 등급 매핑이 필요한 때 `tier-unmapped`다.
  - CLI는 두 오류에서 exit 1과 stderr 안내(코드·provider·역할·등급·고칠 config 키)를 낸다. hook은 nonzero를 받아 Agent 호출을 막는다(exit 2).
  - 새 hook이 `--json`을 모르는 옛 runtime을 만나 한 줄 slug를 받으면, 호출을 막지 않고 model만 보정한다. 등급 해석·빈 등급 거절·effort 보정을 적용하지 못했다는 사실과 runtime 갱신 방법을 `additionalContext`로 알린다.
  - `review-dispatch`의 `agent_dispatch`는 계속 `resolveSubagentModel()`을 써서 오류 때 `model: null`을 받는다. 실제 디스패치는 CLI 조회에서 멈춘다. print dispatch만 `resolveSubagentRole()`로 바꿔 실패를 낸다.
  - Cursor는 effort가 slug 안에 있으므로 역할 effort를 넘기지 않는다. `dispatch print` 결과의 `effort` 필드로 미적용 값을 돌려주고, controller가 사용자에게 알린다.

## Out of scope
- `bouncer-planner` 역할 추가, metrics의 tier·model·effort 기록, plan coordinator (`plan-workflow` BP 3)
- 리뷰어 문서와 `reviewer_tier` 계산 (`gates-review` BP 2)
- 코드에 내장 기본 등급표 두기, 이 저장소 `.bouncer/config.json` 수정, 이미 init된 소비자 config 재작성
- `.codex/agents/*.toml` 생성본에 effort 넣기

## One-commit justification
- 설정 스키마·해석기·CLI 출력·hook 소비·init 예시·규칙 문서가 한 해석 계약(등급→모델, effort)을 가리키므로 한 리뷰 단위다. task는 해석·CLI(001) 뒤에 hook(002)과 init·문서(003)가 병렬로 붙는다.
