---
type: bouncer.blueprint
title: 'fix: 모델 설정과 리뷰 후속 계약 정리'
description: 역할 effort, 입력 검증과 계획 문구의 후속 계약을 정리한다
resource: .bouncer/context/epics/runtime-architecture/blueprints/model-tiers-followups/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-29T09:29:52.278+09:00'
bouncer:
  id: model-tiers-followups
  epic_id: runtime-architecture
  blueprint_id: model-tiers-followups
  status: closed
  order: 43
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 역할 모델 설정과 CLI 런타임 후속 정리
  supersedes: []
---
# 모델 설정과 리뷰 후속 계약 정리

Epic: [runtime-architecture](../../index.md)

## Intent
역할 모델 설정과 리뷰 후속 항목의 입력 검증 및 안내 불일치를 바로잡는다.

## Contract
- Codex 역할 TOML은 설정 effort를 반영하고 부재·null이면 medium을 사용한다. 잘못된 effort는 파일 쓰기 전에 거절하고 사용자에게 확인을 요청한다.
- 선택된 provider는 claude, cursor, codex, antigravity만 허용한다. 유효한 명시 override는 설정값보다 우선한다.
- hook은 실제 변경된 모델과 effort만 안내한다. strong 유지와 기존 출력 필드 계약을 보존한다.
- metrics 시작 시 `/`, `\`, `//`처럼 정규화 후 빈 blueprint는 쓰기 전에 `invalid-metrics-input`으로 거절한다.
- plan 문서는 확인된 경로 집합으로 작성하며 집합 밖 경로가 필요하면 재확인한다. Graphify 결과는 frontmatter의 직접 입력이 아니다.
- 최종 검증은 빌드 후 `npm run ci`다.

### 실패 모드·엣지 케이스
- 제어문자 provider는 원시 입력을 반사하지 않는 한 줄 오류를 낸다.
- 사용자 소유 TOML을 덮지 않고 잘못된 effort에서 부분 생성하지 않는다.
- 기존 plan kind의 생략 blueprint와 metrics end 바인딩은 유지한다.

## Out of scope
- `review-risk-missing`에 따른 리뷰어 등급 상향은 plan coordinator 실측 이후로 연기한다. 기존 근거는 계획 두 개와 fixture 하나다.
- 버전·CHANGELOG, 저장소 config 수정, Codex standard 모델 ID 결정, plan coordinator 실측, 요청 파일의 커밋은 제외한다.

## One-commit justification
- 구현은 각 독립 행동을 검토 가능한 commit task로 나누고 최종 전체 CI를 별도 검증 task로 수행한다.

