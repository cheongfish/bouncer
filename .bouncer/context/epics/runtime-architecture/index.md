---
type: bouncer.epic
title: 121 runtime-architecture
description: 'CLI and runtime base: modules, rule structure, pointer, state transition guards'
resource: .bouncer/context/epics/runtime-architecture/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.802+09:00'
bouncer:
  id: runtime-architecture
  epic_id: runtime-architecture
  status: approved
  supersedes: []
---
# 121 runtime-architecture

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `runtime-architecture` 영역의 새 blueprint를 받는다. 포함: CLI·런타임 기반: TypeScript 전환, 모듈 책임 분해, 규칙·스킬 구조, 현재 작업 포인터, 상태 전이 가드, 소스·테스트 위생

## Success criteria
1. `runtime-architecture` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.
3. 자체 상세 help가 없는 등록 명령의 `bouncer <cmd> --help`·`-h`는 handler 모듈을 적재하지 않고, 파일을 쓰거나 외부 명령을 실행하지 않으며, `COMMAND_USAGE[cmd]`를 stdout에 쓰고 exit 0으로 끝난다.
4. 테스트의 원장 fence helper, CLI 서브명령 help 판정 함수, tasks 문서 `TaskUnit` 타입, 경로 겹침·scope 정규화 함수, coordinator의 잠금 안 원장 열기·fence 확인 순서는 각각 정본이 하나이고, 나머지 사용처는 그 정본을 import하거나 파생한다.
5. `coordinator` facade는 명령 API(`coordinate`, `COORDINATE_FAILURE_HINTS`, `withCoordinateFailureHints`)만 내보낸다. `coordinate()`·`cmdCoordinate()`·`runCheckGate()` 본체는 서브명령·gate 단계를 고르고 handler에 위임하는 일만 하며, TypeScript AST로 잰 함수 선언 줄 수가 각각 150·150·60 이하다. 컨텍스트 리뷰 cycle 전이 모듈 `context-review-state.ts`는 `fs`를 직접 쓰지 않고 저장 계층 모듈로만 디스크를 읽고 쓴다.
6. 소스 경계 inventory 표는 Node 24 snapshot 비교 JSON과 함께 기록되고 `node scripts/measure-source-boundaries.js check-report`가 통과한다.
7. 각 blueprint 병합 뒤 `npm run ci`가 통과하고, `scripts/src/lib` 모듈 의존에 순환이 없다.
8. `scripts/lib`는 `npm run build`로만 갱신하는 생성본이며 어떤 task의 `affected_paths`에도 넣지 않는다.
9. 폐기한 이름 검사는 레거시 입력 감지기를 고정 소스 경로가 아니라 파일 안 표식으로 허용하고, 표식이 허용 위치 밖에 있거나 레거시 문자열 없이 쓰이면 실패한다.
10. 실행 조정의 prepare·bootstrap과 commit fan-in은 서로 다른 내부 모듈이 소유하고, commands/facade로 runtime 역참조하지 않는다. 공통 원장 fence·worker 증적 규칙은 기존 하위 정본을 쓰며 잠금 밖 작업과 재잠금 hash·HEAD 재확인 순서가 보존된다.
11. Finalize digest의 디스크·Git 수집과 순수 검사·조립을 구분할 수 있고, version 2 출력·PR 초안·실패 우선순위 및 integration checkout 선택이 보존된다.
12. Verification의 실행·identity 계산·증적 저장은 서로 다른 모듈이 소유하고 기존 대상 선택 경계를 유지한다. 재사용의 원본 timestamp·출력·evidence ID, throw와 cache miss 구분, 기록 뒤 task 승격 순서가 보존된다.
13. 컨텍스트 리뷰는 기존 저장 계층 위에서 순수 전이 판단과 문서 투영을 구분한다. State·Cycle 타입 정본이 하나이며 재시작 누적 한도·명시적 accepted-risk 동의·closure digest·동일 입력의 복구와 쓰기 순서가 보존된다.
14. 네 책임 분해의 금지 역참조·순수 모듈 I/O 경계를 회귀 검사하고, 동일 Node 24·npm·OS에서 잰 전후 snapshot과 inventory가 기존 check-report를 통과한다. 기존 CLI·승인·증적·동시성 계약과 coverage 임계값 94/82/96을 유지한다.
15. 역할 모델 해석은 기존 `subagents.<provider>.<agent>` slug → `roles` 등급의 `model_tiers` 매핑 → `inherit` 순이며, 기존 slug 설정의 `subagent-model` 한 줄 출력은 바뀌지 않는다. 비어 있는 등급 매핑은 exit 1로 거절되고 다른 모델로 대체되지 않으며, `--json`은 `provider, role, tier, model, effort, source`를 내고 Claude hook은 그 `model`·`effort`로 Agent 호출을 보정한다.

## Out of scope
- 특정 단계의 기능 → 해당 단계 영역
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.
- `workflow-responsibility-split`은 이미 닫힌 `coordinator-command-split`·`gate-review-split`의 결과 위에서 책임을 나눈다. 기존 blueprint·증적·상태·이력을 재작성하거나 소급 완료하지 않는다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [platform-architecture](../platform-architecture/index.md)
- [structural-audit-remediation](../structural-audit-remediation/index.md) △
- [maintenance](../maintenance/index.md) △
- [runtime-policy-pointer-safety](../runtime-policy-pointer-safety/index.md)
- [workflow-contract-followup](../workflow-contract-followup/index.md)
- [workflow-improvement](../workflow-improvement/index.md) △
- [rules-reorganization](../rules-reorganization/index.md)
- [cli-deterministic-procedures](../cli-deterministic-procedures/index.md)
- [v153-evaluation-remediation](../v153-evaluation-remediation/index.md) △
- [source-test-hygiene](../source-test-hygiene/index.md)
- [source-restructuring](../source-restructuring/index.md)
- [workflow-transition-guards](../workflow-transition-guards/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 001 | 008 instruction-layers, 009 debt-items | 지시문 층 경계와 감사 부채는 호스트 배포가 아님 |
| 043 | 005~008, 010 | 에이전트 rubric·reference 분리·규칙 블록 구조 |
| 113 | 002 lint-baseline-cleanup | CI lint 기준선 |

## Blueprints
- [cli-help-and-hygiene](blueprints/cli-help-and-hygiene/index.md) — 서브명령 `--help`를 `cli.ts`의 정적 usage로 끝내고, 테스트 fence fixture·`TaskUnit` 타입·경로 정규화를 정본 하나로 모으며, 이전 재구성 inventory의 전후 실측을 채운다.
- [coordinator-command-split](blueprints/coordinator-command-split/index.md) — `coordinator` facade를 명령 API로 줄이고, 원장 fence 열기를 공통 helper로 묶고, `coordinate()`·`cmdCoordinate()`를 서브명령 handler로 나눈다.
- [gate-review-split](blueprints/gate-review-split/index.md) — `runCheckGate()`를 gate 단계 모듈로, `context-review-state.ts`를 저장 계층과 cycle 전이로 나누고 이 시리즈의 전후 실측을 기록한다.
- [workflow-responsibility-split](blueprints/workflow-responsibility-split/index.md) — prepare·bootstrap·commit fan-in, digest 수집·조립, verification 실행·identity·증적, 리뷰 순수 전이·투영을 분리하고 경계 검사와 전후 실측을 기록한다.
- [model-tiers-effort](blueprints/model-tiers-effort/index.md) — `.bouncer/config.json`에 `model_tiers`·`roles`를 더하고 `subagent-model --json`·Claude hook·init 예시·`rules/subagent-model.md`가 등급과 effort를 해석·전달한다.
