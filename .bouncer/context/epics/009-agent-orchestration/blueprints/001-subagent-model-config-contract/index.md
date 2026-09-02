---
type: bouncer.blueprint
title: 서브에이전트 모델 설정 계약 도입
description: config subagents 기본값과 프로바이더별 모델 해석 헬퍼
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/001-subagent-model-config-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-03T07:48:50.273Z'
bouncer:
  id: '001'
  epic_id: '009'
  blueprint_id: '001'
  status: approved
---
# 001 subagent-model-config-contract

Epic: [009](../../index.md)

## Intent
- 문제: 서브에이전트 모델을 고를 계약이 없다. 스킬이 읽을 config 필드도, 그
  값을 호스트별로 해석할 지점도 존재하지 않는다.
- 완료 조건: `subagents` 기본값이 `bouncer init` 산출물에 들어가고,
  `resolveSubagentModel`이 provider·agentName을 받아 모델 slug 또는 상속
  신호를 돌려주며, 두 동작이 테스트와 `docs/configuration.md`로 고정된다.

## Contract
- 인터페이스: `scripts/lib/subagents.js`가 `resolveSubagentModel`을 내보낸다.

  ```js
  resolveSubagentModel({ repoRoot, agentName, provider }) 
  // → { model: null,  provider: 'codex'  }   // inherit
  // → { model: 'composer-2.5-fast', provider: 'cursor' }
  ```

  `provider`를 넘기지 않으면 `subagents.provider` 고정값 → 환경변수 휴리스틱
  순으로 판별하고, 실패하면 `provider: null` + `model: null`을 돌려준다.
- 데이터·상태: `.bouncer/config.json`에 선택적 `subagents` 객체가 생긴다.
  형태는 `{ provider?: string, <provider>: { <agentName>: <slug|'inherit'> } }`.
  문서 frontmatter 스키마(`scripts/src/lib/schema.ts`)는 바뀌지 않는다 —
  이것은 프로젝트 설정이지 OKF 문서 필드가 아니다.
- 수용 기준: 009 Success criteria 1·2·3.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `.bouncer/config.json`이 없거나 JSON 파싱에 실패 → 던지지 않고 inherit.
  - `subagents`가 없거나 provider 블록이 없거나 agentName이 없음 → inherit.
  - 값이 `'inherit'` 센티널 또는 문자열이 아닌 값 → inherit.
  - 판별 불가 호스트 → inherit. 호스트가 slug를 거부하는 경우의 폴백은
    런타임 동작이라 002 스킬 본문이 담당한다.

## Out of scope
- named agent 문서(`agents/*.md`)와 스킬 라우팅 변경 — 002.
- `resolveSubagentModel`을 노출하는 새 CLI 서브커맨드. 스킬은 plan step 8의
  `.bouncer/current` 기록과 동일하게 `node -e`로 lib을 직접 부른다.
- 이 저장소 자신의 `.bouncer/config.json`에 `subagents` 블록을 추가하는 것.

## One-commit justification
- 새 헬퍼 1개 + init 기본값 1줄 + 그 둘의 테스트 + 설정 문서 1행. 소비자가
  없는 순수 추가라 기존 동작이 바뀌지 않고, 한 diff로 계약 전체가 읽힌다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
