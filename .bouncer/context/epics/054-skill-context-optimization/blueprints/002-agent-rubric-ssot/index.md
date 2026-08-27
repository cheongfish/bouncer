---
type: bouncer.blueprint
title: 역할별 rubric의 named agent 정본화
description: 구현·리뷰·디버깅·컨텍스트 리뷰의 상세 rubric을 agents 문서 하나로 모으고 보조 스킬은 호출 계약만 남긴다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/002-agent-rubric-ssot/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-26T14:53:09.139+09:00'
bouncer:
  id: '002'
  epic_id: '054'
  blueprint_id: '002'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 002 agent-rubric-ssot

Epic: [054](../../index.md)

## Intent
- 문제: 네 역할이 절차·guardrail·출력 계약을 보조 스킬과 named agent 문서에 두 벌로 들고 있다. `implementation` 스킬의 절차(Understand, then climb → Focused change → Detailed comments → Tests first → Report deviations)는 `agents/bouncer-implementer.md`의 `## Procedure`와 사실상 같은 문장이다. named agent가 실제 작업을 하는 정상 경로에서도 컨트롤러가 상세 rubric을 먼저 읽고, 두 문서가 서로 달라질 여지가 상시로 열려 있다.
- 완료 조건: 역할별 상세 rubric이 `agents/*.md` 한 곳에만 있고, 대응 스킬은 호출 계약만 남으며, named agent가 없을 때의 인라인 fallback 경로는 그대로 살아 있다.

```mermaid
flowchart LR
  S[진입 스킬 절차 뼈대] --> A[역할별 named agent 정본]
  A --> C[CLI gate 최종 판정]
```

## Contract
- 인터페이스: 네 서브스킬은 컨트롤러가 아니라 진입 스킬(`/bouncer-execute`, `/bouncer-plan`)이 쓰는 **브리프**다. 그래서 호출 계약 항목을 균일하게 요구하지 않고, 각 스킬이 실제로 소유한 것만 남긴다. 상세 rubric·authority·read/write 제한·output contract는 네 경우 모두 `agents/*.md`가 소유한다.
  - `skills/review/SKILL.md` — 유일하게 디스패치 절차를 가진 스킬이다. `bouncer-reviewer` 호출 네 단계, `## Findings` 필드 계약, fallback 조건, 컨트롤러 소유권을 남긴다.
  - `skills/implementation/SKILL.md` — 브리프 권위(읽을 task 절)와 반환 계약만 남긴다. 디스패치는 `/bouncer-execute`가 가진다.
  - `skills/debugging/SKILL.md` — 4단계 이름, 재호출 상한 `**1**`, 컨트롤러가 implementer를 재호출한다는 규칙만 남긴다. 디스패치와 fallback은 `/bouncer-execute`가 가진다.
  - `skills/context-review/SKILL.md` — full-plan 게이트, `## Findings` 필드 계약, 판정 scope 이름, 컨트롤러 소유권만 남긴다. 디스패치와 fallback은 `/bouncer-plan`이 가진다.
- 고유 정본 절은 둘뿐이며 이 blueprint에서 옮기지 않는다.
  - `skills/implementation/SKILL.md`의 주석 루브릭(hard rule 9 상세, docstring 4부 계약, `scripts/lib/validate.js` Bad/Good 예시). Distill Decision이 이 위치를 정본으로 못박았고 `agents/bouncer-implementer.md`가 그 경로를 가리킨다.
  - `skills/context-review/SKILL.md`의 `## When this applies` full-plan 게이트(`scale: light`에는 이 루브릭도 G18도 없다는 규정). G18 판정에 직결되며, `test/skill-context-review.test.js`가 `Full plans only`·`bouncer.scale`·`G18`·`no light variant`를 이 스킬 대상으로 단정한다.
- 데이터·상태: 문서 재배치만 한다. `scripts/lib/subagents.ts`의 model 해석, `bouncer validate` 게이트 코드, `## Findings` 필드 계약은 그대로다.
- 수용 기준: epic 054 성공 조건 1. 판정은 둘 다여야 한다.
  1. 정적 지표 3번의 `wc -w`가 네 스킬 모두에서 baseline(1239 / 876 / 449 / 852)보다 작다.
  2. 옮김 대상 rubric 문단이 스킬과 agent **두 파일에 동시에 있는 경우가 0건**이다. 각 task의 Checklist에 그것을 확인하는 `grep`이 있다.
  본문에 남는 것: `rules/skill-shape.md`가 요구하는 구조 절(`## When this applies`·`## Steps`·`## Guardrails`·`## Return`), 위 인터페이스가 역할별로 열거한 항목, 그리고 고유 정본 절 둘. 이 셋은 잔여가 아니라 계약이다.
- epic 성공 조건 2(네 역할 인라인 fallback 생존)는 이 blueprint의 수용 기준이 **아니다**. implementation·debugging의 fallback 분기는 `skills/bouncer-execute/SKILL.md`에, context-review는 `skills/bouncer-plan/SKILL.md`에 있고 둘 다 blueprint 003 소관이다. 이 blueprint는 `skills/review/SKILL.md`의 fallback 문장만 보존한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - named agent 미가용 호스트에서 인라인 fallback이 rubric 없이 남으면 그 경로의 품질이 조용히 떨어진다. fallback 분기는 같은 `agents/*.md`를 읽으라고 지시한다.
  - `test/skill-{implementation,review,debugging,context-review}.test.js`와 `test/agents.test.js`가 옮겨진 문장을 리터럴로 단정하고 있다. 문장을 옮기는 커밋에서 그 단정도 함께 옮긴다. 그래서 `test/agents.test.js`가 네 task 모두의 `affected_paths`에 들어간다.
  - `test/agents.test.js`가 이미 implementer는 주석 규칙을 **재진술하지 않는다**고 단정한다(`known ceilings`·`Prefer thoroughness` 부재). 주석 루브릭을 agent로 옮기면 그 테스트가 깨진다 — 위 고유 정본 절 규정의 근거다.
  - `test/skill-debugging.test.js`의 상한 동기화 테스트가 `skills/bouncer-execute`·`skills/debugging`·`agents/bouncer-debugger`·`skills/bouncer-run` 네 문서 모두에 `**1**` 표기를 요구한다. `skills/debugging/SKILL.md`에서 그 문장을 빼면 깨진다. 재호출 상한은 호출 계약 (d)항목이므로 그대로 남는다.
  - `rules/skill-shape.md`가 서브스킬에 `## When this applies` → `## Steps` → 도메인 H2 → `## Guardrails` → `## Return` 순서를 요구한다. 호출 계약은 `## Steps` 안에 번호로 적어 절 이름과 순서를 유지한다.
  - `test/public-contract.test.js`는 `skills/bouncer-*` 디렉터리만 열거한다. 서브스킬 넷과 무관하므로 범위 밖이다(contract blast check로 확인).
  - `skills/review/assets/reviewer-prompt.md`는 Distill이 경로로 못박은 자산이다. 옮기지 않는다.

## Out of scope
- 각 역할이 하는 일의 변경. 문장이 어디 있는지만 바꾼다.
- `rules/skill-shape.md`의 절 이름과 순서 계약.
- `agents/` 문서의 model 해석과 `inherit` fallback 절차 — blueprint 004 소관이다.
- 진입 워크플로 스킬 6개의 본문 — blueprint 003 소관이다.

## One-commit justification
- 역할 하나가 스킬 문서 1개, agent 문서 1개, 테스트 1~2개의 한 묶음이다. 네 역할을 각각 하나의 task로 두면 커밋마다 정본 이동이 완결되고, blueprint 전체가 "역할별 정본화" 하나의 PR 단위다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - implementation 역할 정본화
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - review 역할 정본화
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - debugging 역할 정본화
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Tasks 004](tasks/004/tasks.md) - context-review 역할 정본화
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Review 004](tasks/004/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
