---
type: bouncer.distill
title: 002 distill
description: Distill for 002
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/002-named-agent-routing/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T08:21:43.832Z'
bouncer:
  id: DISTILL-BP-002
  epic_id: '009'
  blueprint_id: '002'
  status: published
---
# Distill

## 승격 대상 (durable)

- Named agent 문서는 플러그인 루트 `agents/`에 둔다. 매니페스트에 `agents`
  경로를 재선언하지 않는다 — Claude는 관례 경로 중복을 플러그인 거부로 보고,
  Cursor는 미지정 시 `agents/`를 자동 탐색한다.
- Codex는 named agent 라우팅 대상이 아니다. 플러그인이 `agents/`를 배포하지
  않으므로 review·execute는 항상 generic/인라인 폴백을 탄다.
- 디스패치는 4단계다: `resolveSubagentModel` → named agent 호출 → slug 거부 시
  `inherit` 재시도(+사용자 고지) → named agent 미지원 시 generic/인라인 폴백.
  폴백 문구를 지우면 G8이 막힌다.
- `reviewer-prompt.md`는 에이전트 고정 본문이 아니라 호출 프롬프트 brief
  슬롯이다. 페르소나·가드·Findings 출력 계약은 `agents/bouncer-reviewer.md`가
  소유한다.
- Review Findings는 named agent(`bouncer-reviewer`) 또는 generic/인라인
  폴백이 만들고, `review → accepted`와 커밋은 컨트롤러만 한다.
  `bouncer-implementer`도 git 커밋·문서 상태 전이를 하지 않는다.

## 사이클 회고 (승격하지 않음)

- Cursor Task 도구 enum에는 플러그인 named agent가 없어, 이번 execute 리뷰는
  generic 폴백으로 돌렸다. 스킬 본문의 폴백 경로가 실제로 쓰였다.
- 루브릭 문장을 agent로 옮기고 prompt를 brief 슬롯으로 정리해도 Spec/Quality
  식별자 단정 테스트는 통과했다 — 판정 기준 내용은 그대로였다.

## 다음 후보

- discovery·spec-authoring 등 나머지 스킬의 named agent 전환은 에픽 범위 밖.
- Codex용 `.codex/agents/` TOML 배포는 별도 BP.
