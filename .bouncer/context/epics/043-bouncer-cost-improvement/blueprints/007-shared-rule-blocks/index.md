---
type: bouncer.blueprint
title: 반복 규칙 블록의 정본 단일화
description: BOUNCER_ROOT·ACQ·bouncer current·model fallback은 rules로 모으고 trust boundary는 CLAUDE.md 정본을 참조하게 한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/007-shared-rule-blocks/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-26T14:53:09.210+09:00'
bouncer:
  id: '007'
  epic_id: '043'
  blueprint_id: '007'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 007 shared-rule-blocks

Epic: [043](../../index.md)

## Intent
- 문제: `BOUNCER_ROOT` 해석, ACQ 옵션 순서와 출력 형식, `bouncer current` 처리, named agent model 해석과 `inherit` fallback, 데이터·지시 trust boundary가 진입 스킬마다 복제되어 있다. 같은 규칙이 여러 곳에 있으면 주입량만 늘어나는 것이 아니라 한 곳만 고쳐질 때 규칙이 갈린다.
- 완료 조건: 네 운영 블록은 `rules/` 아래 각각 한 파일에만 정본으로 있고, trust boundary는 `CLAUDE.md` hard rule 11을 유지하며 진입 스킬에는 적용 지점과 그 스킬만의 예외가 남는다.

```mermaid
flowchart LR
  S[진입 스킬 절차 뼈대] --> G[게이트 절차 본문 유지]
  G --> C[CLI gate 최종 판정]
```

## Contract
- 인터페이스: `rules/plugin-root.md`는 plugin root·master rule 로딩, `rules/acq.md`는 사용자 확인 형식, `rules/current-pointer.md`는 pointer 읽기·이동, `rules/subagent-model.md`는 model 해석·fallback의 정본이다. trust boundary의 정본은 기존 `CLAUDE.md` hard rule 11을 유지한다. 각 스킬과 reference에는 적용 지점과 그 흐름의 예외만 남긴다.
- 데이터·상태: 문서 재배치만 한다. `scripts/src/lib/subagents.ts`와 런타임 산출물 `scripts/lib/subagents.js`의 model 해석, `bouncer current` CLI 계약은 그대로다.
- 수용 기준: epic 054 성공 조건 5를 적용하되, epic Out of scope에 따라 trust boundary는 `CLAUDE.md`의 기존 정본 위치를 유지한다. 정적 지표 4번 명령이 각 블록마다 정본 1개와 적용 지점 참조만 남았음을 보여야 한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 공통 규칙을 너무 잘게 나누면 파일 탐색과 도구 호출이 늘어 순이득이 사라진다. 함께 쓰이는 규칙은 한 파일에 둔다.
  - `rules/skill-shape.md`가 ACQ 절을 워크플로 스킬의 필수 절로 요구한다. 절 자체는 남기고 전체 템플릿 대신 공통 계약을 참조한다.
  - trust boundary는 `CLAUDE.md` hard rule 11이 이미 소유한다. 새 정본을 만드는 것이 아니라 스킬 쪽 복제본을 그 규칙 참조로 바꾼다.
  - `bouncer current` 처리에는 "`scripts/lib/current`를 `node -e`로 부르지 않는다"는 Distill invariant가 걸려 있다. 정본 문장이 그 제약을 담는다.

## Out of scope
- `CLAUDE.md` hard rule 본문의 축약. 정본 위치를 유지하고 참조 경로만 정리한다.
- CLI·게이트 구현. `scripts/` 는 만지지 않는다.
- 역할별 rubric과 조건부 절차 — blueprint 002·003이 끝낸 범위다.

## One-commit justification
- plugin root·master rules, ACQ, current pointer, subagent model, trust boundary를 각각 task 하나로 닫는다. 커밋마다 한 정본과 소비 지점, 계약 테스트가 함께 완결되고 blueprint 전체가 반복 규칙 공통화 한 PR이 된다.

## Documents
* [Task 001](tasks/001/tasks.md) - plugin root와 master rule 로딩 정본화
* [Task 002](tasks/002/tasks.md) - ACQ 표시 계약 정본화
* [Task 003](tasks/003/tasks.md) - current pointer 처리 정본화
* [Task 004](tasks/004/tasks.md) - named agent model fallback 정본화
* [Task 005](tasks/005/tasks.md) - trust boundary 적용 지점 정리
* [Context review](context-review.md) - 계획 문서 정합성 판정
