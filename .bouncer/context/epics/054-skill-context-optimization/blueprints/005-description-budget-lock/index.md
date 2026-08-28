---
type: bouncer.blueprint
title: description 축약과 예산 고정, 최종 회차
description: 19개 description을 3,000자 이하로 줄이고 정본 개수와 예산을 테스트로 고정한 뒤 최종 회차를 기록한다
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/005-description-budget-lock/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-26T14:53:09.245+09:00'
bouncer:
  id: '005'
  epic_id: '054'
  blueprint_id: '005'
  status: approved
  commit_type: docs
  scale: full
  supersedes: []
---
# 005 description-budget-lock

Epic: [054](../../index.md)

## Intent
- 문제: description 합계 6,090자에는 `This skill should be used ...`와 `It is used only while working inside an active Bouncer blueprint, unless the user explicitly asks for this skill by name.`가 거의 모든 내부 스킬에 반복된다. 회수량은 plan 실행 비용의 5% 미만이라 마감 작업이지만, 1~4단계로 줄인 정본 개수와 예산이 다음 변경에서 조용히 되돌아가는 것을 막을 장치가 없다.
- 완료 조건: description이 예산 안으로 들어오고, 정본 개수와 description 예산이 테스트로 고정되며, 최종 회차 수치가 baseline과 나란히 기록된다.

```mermaid
flowchart LR
  S[진입 스킬 절차 뼈대] --> C[CLI gate 최종 판정]
```

## Contract
- 인터페이스: `skills/*/SKILL.md`의 `description`을 핵심 트리거가 앞에 오는 100~180자 한 문장으로 다시 쓴다. 길이는 baseline `awk`와 같이 `description:` 접두어만 제거한 YAML 원문 scalar(인용부호 포함)로 잰다. workflow 여섯 개는 명시적 호출 전용임을, 내부 스킬은 Bouncer 흐름 또는 사용자 직접 요청에서 쓴다는 점을 한 번만 표현한다. 새 테스트가 (a) 정본 19개, (b) description 총합 3,000자 상한, (c) 개별 100~180자, (d) 네 역할 스킬에 blueprint 002가 agent로 옮긴 rubric 문구가 되돌아오지 않음을 단정한다. 최종 회차는 `docs/benchmark/history.md`의 `## 지시문 비용 회차` 절(blueprint 006이 만든다)에 baseline 행 다음 행으로 더한다.
- 데이터·상태: `description`은 OKF 필수값이고 암묵 매칭의 유일한 근거다. 비우거나 삭제하지 않는다.
- 수용 기준: epic 054 성공 조건 6·7.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 축약은 이 epic에서 유일하게 품질을 떨어뜨릴 수 있는 항목이다. 토큰이 줄어도 잘못된 스킬이 선택되면 실패로 본다. 축약 후 회귀 시나리오로 암묵 매칭을 확인한다.
  - `CLAUDE.md`의 「When to invoke」 표와 각 description의 명시적 호출 계약은 유지한다. 보조 스킬을 비공개로 돌리는 것은 이 epic 밖이다.
  - 예산을 테스트로 고정하면 스킬이 하나 늘 때마다 총합 상한에 걸린다. 상한은 스킬 수에 대한 함수가 아니라 고정값이므로, 걸릴 때 예산을 올리는 판단은 사람이 한다는 점을 테스트 메시지에 적는다.
  - 최종 회차가 baseline과 다른 문서 세트에서 측정되면 뺄셈이 성립하지 않는다. `docs/benchmark/context-cost.md`의 `## 고정 실행 입력` 표와 같은 base·모델·프롬프트·fixture·완료 조건을 쓴다.
  - blueprint 006이 닫히지 않았거나, 실행 워크트리 `docs/benchmark/history.md`의 `## 지시문 비용 회차`에 baseline 7행이 없거나, 아래 최종 산출물이 하나라도 없으면 task 003은 기록을 시작하지 않는다. baseline `.recovery.*`와 s5–s7 무접미사 파일을 최종 행 출처로 쓰지 않는다. 빈칸을 0으로 바꾸거나 값을 추정하지 않는다.
  - 실행 워크트리(`.worktrees/054/005`)가 `develop`의 006 전사 커밋보다 뒤처져 history 절이 없으면, 컨트롤러가 그 워크트리에 `develop`을 merge 또는 rebase한 뒤에 task 003을 시작한다. implementer는 git merge/rebase를 하지 않는다.

## 착수 순서
- task 001과 002는 순서대로 실행한다. task 003은 다음이 모두 참일 때만 시작한다: blueprint 006 `closed`, 실행 워크트리 history에 baseline 7행, 시나리오마다 `.benchmarks/<id>.final.metrics.json`과 `.benchmarks/<id>.final.manifest.json` (`s5`·`s6`은 `.benchmarks/<id>.final.finalize.json`도).

## Out of scope
- 보조 스킬의 비공개 전환. 계약 변경이므로 이 epic의 측정 결과를 보고 따로 결정한다.
- `agentic-code-benchmark`의 루브릭·점수 계산.
- 1–3회차와 DeepSWE 기존 수치.

## One-commit justification
- description 축약 한 묶음, 예산·정본 테스트 한 묶음, 최종 회차 기록 한 묶음이 각각 독립적으로 리뷰 가능한 커밋이고, blueprint 전체가 "마감과 고정" 하나의 PR 단위다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - description 축약과 호출 계약 테스트 보정
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - description 예산과 정본 개수 회귀 잠금
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - 최종 지시문 비용 회차 기록
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
