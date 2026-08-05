---
type: bouncer.blueprint
title: 승격·PR 본문을 explain에서 채우고 이해 상태를 제외함
description: Distill 승격과 draft PR 본문의 소스를 explain.md로 통일
resource: .bouncer/context/epics/013-comprehension-gate/blueprints/003-promotion-pr-body/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-05T10:28:55.939+09:00'
bouncer:
  id: '003'
  epic_id: '013'
  blueprint_id: '003'
  status: approved
  commit_type: feat
  commit_intent:
    - 승격과 PR이 아직 distill 시대 규칙·템플릿을 따라 이해 상태와 설명 본문이 섞일 수 있었음
    - explain.md를 단일 소스로 두고 이해 상태는 전역 Distill·PR에서 빼 인지 기록만 BP에 남김
---
# 003 promotion-pr-body

Epic: [013](../../index.md)

## Intent
- 문제: 001·002가 `explain.md`와 퀴즈 배선을 세웠지만, Distill 승격과 draft PR
  본문은 여전히 distill 시대 안내·템플릿에 기대 있다. 승격이 `## 이해 상태`를
  옮길 수 있고, PR은 blueprint/tasks에서 따로 채우라고 해 설명 문서와 이중
  저술이 생긴다. 에픽 성공 조건 8·9가 비어 있다.
- 완료 조건: 승격은 `explain.md`의 durable 항목만 Invariants/Gotchas/Decisions로
  옮기고 `## 이해 상태`는 제외한다. draft PR 본문은 같은 `explain.md`에서
  채워지며 별도 본문 저술 단계가 없다. 관련 스킬·템플릿·문서·계약 테스트와
  `npm test`가 통과한다.

## Contract
- 인터페이스 (`spec-authoring` Distill 승격): 소스 = 활성 BP `explain.md`.
  `## Background` / `## Intuition` / `## Code`(및 본문에 명시된 durable 주의)에서만
  고른다. `## Quiz`·`## 이해 상태`·`bouncer.comprehension` 필드는 승격하지
  않는다.
- 인터페이스 (`/bouncer-finalize` PR): `pr.md` 템플릿 섹션을 `explain.md`로
  채운다. 작업 개요·주요 변경은 Background / Intuition / Code를 요약·인용하고,
  `## 🚦 Bouncer`에는 Epic/Blueprint id와 **explain 경로**를 넣는다(전역 Distill
  경로를 PR 본문 링크로 쓰지 않는다). Quiz·이해 상태·점수는 PR에 넣지 않는다.
- 인터페이스 (`pr.md` / host PR 템플릿): Bouncer 메타 줄의 Distill 경로를
  Explain(BP `explain.md`) 경로로 바꾼다. explain 경로는 BP마다 다르므로
  `${PROJECT_DISTILL}` 보간이 아니라 `<epic-id>`/`<bp-id>`와 같은 결의
  플레이스홀더로 두고 finalize 스킬이 채운다.
- 데이터·상태: 프로젝트 Distill 섹션 구조(Invariants / Gotchas / Decisions)와
  `makeAllowed`의 Distill 예외는 유지한다. 소스 문서 종류만 `explain`이다.
- 수용 기준: finalize·spec-authoring 본문이 `## 이해 상태` 승격 금지를 **긍정
  문구**로 명시한다. 낱말 부재로 단언하지 않는다.
- 수용 기준: finalize PR 단계가 `explain.md`에서 본문을 채운다고 명시하고,
  blueprint/tasks만으로 PR 본문을 쓰라는 지시가 없다.
- 수용 기준: Distill init 본문(`PROJECT_DISTILL_BODY`)이 BP 후보를 `explain.md`로
  가리킨다(`distill.md` cycle candidate 문구 제거).
- 수용 기준: 계약 테스트가 위 규칙을 단언하고 `npm test`가 통과한다. 단언은
  스킬 본문에 **있어야 할 문구**를 겨냥한다. 없어져야 할 기존 문장을
  `doesNotMatch`로 노리지 않는다 — 문구가 바뀌면 조용히 무의미해진다.
- 수용 기준: `skills/bouncer-plan/SKILL.md`의 `scaffold distill` 잔재 제거는
  대응 계약 테스트가 없는 문서 전용 수정이다. 이 커밋에서 plan 스킬 테스트를
  새로 만들지 않는다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: durable 항목이 없으면 Distill은 변경 없이 진행한다
  (오류 아님). `## 이해 상태`만 채워져 있어도 그 섹션은 승격·PR에 넣지 않는다.
- 실패 모드·엣지 케이스: PR 생략 / remote·`gh` 없음은 현행 graceful skip.
  생성할 때만 explain 기반 본문을 쓴다.
- 실패 모드·엣지 케이스: `explain.md` 미작성은 G15가 막는다. 이 BP는 게이트
  판정을 바꾸지 않는다.

## Out of scope
- G15 / `computeDiffSha` / `bouncer.explain` 스키마 재설계 (001).
- `explain-diff` 저술·퀴즈·comprehension 기록 절차 재설계 (002).
- `finalize()` 커밋·`makeAllowed`·handoff 로직 변경 (012 / 기존 계약).
- 점수 임계 차단, 이해 게이트 옵트아웃, HTML 퀴즈.
- 기존 에픽에 남은 `distill.md` 소급 마이그레이션.
- 프로젝트 Distill 섹션 구조 교체.

## One-commit justification
- 승격 규칙(스킬), PR 채움 규칙(스킬), `pr.md`/Distill init 문구(템플릿),
  host PR 템플릿, 계약 테스트, 워크플로 문서가 한 이야기의 양끝이다. 스킬만
  바꾸면 테스트·템플릿이 어긋나고, 템플릿만 바꾸면 채움 지시가 남는다.
- `scripts/lib/templates.js`는 소스와 같은 커밋의 빌드 산출물이다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
