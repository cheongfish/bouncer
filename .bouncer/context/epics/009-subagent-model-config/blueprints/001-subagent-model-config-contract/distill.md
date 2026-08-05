---
type: bouncer.distill
title: 001 distill
description: Distill for 001
resource: .bouncer/context/epics/009-subagent-model-config/blueprints/001-subagent-model-config-contract/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-03T07:48:50.273Z'
bouncer:
  id: DISTILL-BP-001
  epic_id: '009'
  blueprint_id: '001'
  status: published
---
# Distill

## 승격 대상 (durable)

- `BOUNCER_HOME`은 프로바이더 신호가 아니다. 수동 플러그인 루트 오버라이드라
  어떤 호스트에서도 설정될 수 있다. Cursor는 `subagents.provider: "cursor"`를
  명시해야 한다.
- named-agent 모델 오버라이드는 `.bouncer/config.json`의 `subagents`에 둔다.
  호스트마다 모델 ID 네임스페이스가 달라 프로바이더별 블록이 필요하고,
  `resolveSubagentModel`은 miss/`inherit`/비문자열에서 던지지 않고
  `{ model: null }`로 부모 세션 상속을 뜻한다.
- `subagents`는 프로젝트 설정이지 OKF/문서 frontmatter 스키마가 아니다 —
  `schema.ts`에 등록하지 않는다.

## 사이클 회고 (승격하지 않음)

- 이번 커밋에는 호출자가 없다. 헬퍼·init 기본값·테스트·문서만으로 계약을
  고정했고, 첫 소비자는 002 스킬 라우팅이다.
- 리뷰에서 발견사항 없음 — 브리프 Interface의 거부 목록을 테스트가 그대로
  고정해 두어 스펙 누락이 나지 않았다.

## 다음 후보

- 002: named agent 문서 + 스킬에서 `resolveSubagentModel` 호출·모델 전달.
- 호스트가 slug를 거부할 때의 런타임 폴백은 스킬 본문 책임으로 남긴다.
