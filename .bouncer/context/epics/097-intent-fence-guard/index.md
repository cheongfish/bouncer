---
type: bouncer.epic
title: blueprint Intent 코드 펜스 방어
description: Make blueprint Intent parsing skip code fences and report malformed Intent as a structured failure before finalize reaches commit message generation.
resource: .bouncer/context/epics/097-intent-fence-guard/index.md
tags:
  - bouncer
  - epic
  - finalize
  - intent
  - validate
timestamp: '2026-10-12T17:16:17.805+09:00'
bouncer:
  id: '097'
  epic_id: '097'
  status: approved
  supersedes: []
---
# 097 blueprint Intent 코드 펜스 방어

## Intent
blueprint `## Intent` 아래에 mermaid 같은 코드 펜스가 있으면 파서가 펜스 줄을 문장으로 읽어, `finalize` 마지막 단계(커밋 메시지 생성)에서 스택 트레이스와 함께 중단됨. plan gate와 `finalize prepare`는 이 구조를 통과시켜 사용자가 finalize 직전까지 알 수 없음.
이 epic은 파서가 코드 펜스를 건너뛰게 하고, 같은 Intent 검사를 승인 뒤 plan gate와 `finalize prepare`에서 먼저 실행하며, finalize가 예외 대신 구조화된 실패를 돌려주게 함.

## Flow
```mermaid
flowchart LR
  A[Intent 작성] --> B[plan gate]
  B --> C[finalize prepare]
  C --> D[finalize 커밋 메시지]
```

## Success criteria
1. `## Intent` 섹션 안의 ```` ``` ````·`~~~` 코드 펜스(들여쓰기·불릿 안 포함) 줄은 문장 집계에서 제외되고, 펜스 밖 문장 1–2개가 한국어 종결형이면 `parseIntentBody`가 그 문장을 돌려준다.
2. 펜스 밖 문장이 0개이거나 3개 이상이거나 한국어 종결형이 아니면 `parseIntentBody`가 기존과 같은 오류를 던진다. 닫히지 않은 펜스 뒤의 줄은 펜스 안으로 보고 집계하지 않으며, 그 앞의 펜스 밖 문장만으로 위 규칙을 판정한다.
3. `bouncer validate --gate plan`과 `--gate finalize`가 blueprint `status`가 `draft`가 아닌 올바르지 않은 Intent에 `S33` 실패를 보고하고, 실패 항목에 `next`가 붙는다. `/bouncer-plan`의 plan gate는 승인(`draft → approved`) 뒤에 실행되므로 이 조건에서 정상 흐름이 막힌다. `## Intent` 헤딩 부재는 이 epic에서 `S33` 대상이 아니다.
4. `bouncer finalize prepare`가 올바르지 않은 Intent에 `{ ok: false, reason: 'validate', failures }`를 돌려주고 종료 코드 1로 끝난다.
5. `bouncer finalize`는 올바르지 않은 Intent에서 커밋 메시지 생성 전에 스택 트레이스 없이 `{ ok: false, reason: 'validate', failures }`를 돌려주고 `failures`에 `S33`이 포함된다(finalize gate).
6. 변경 전 `parseIntentBody`를 통과한 기존 blueprint index 중 `## Intent` 안에 코드 펜스가 없는 문서가 변경 후 같은 문장 배열을 돌려주고(펜스 안 줄을 세던 문서는 배열이 달라질 수 있다), `## Intent` 아래에 코드 펜스가 있던 043-005·060-001·006-006이 이제 통과한다.
7. Intent 안에 mermaid 블록이 있는 fixture 테스트가 1~5를 고정하고, 6은 구현 뒤 일회성 비회귀 확인 결과를 완료 보고에 남겨 입증하며, `rules/document-schema.md`와 `references/spec-authoring/index.md`에 `S33`과 펜스 처리 규칙이 적혀 있고 `rg -n S33`으로 두 파일에서 확인된다.
8. CHANGELOG `[Unreleased]`에 항목이 있고, 변경한 TypeScript는 `npm run check:emit`을 통과하며, `npm run ci`가 통과한다.

## Out of scope
- Mermaid 렌더링 검사 도구
- task 문서 `commit_intent`·`commit_summary`의 S32 규칙 변경
- 이미 finalize를 마친 blueprint 문서의 소급 수정
- `buildFinalizeCommitMessage` 자체가 던지지 않게 바꾸는 일(순수 함수 계약 유지)
- epic `## Intent` 파싱 규칙 변경
- `## Intent` 헤딩 부재의 조기 검출(현재처럼 finalize 커밋 메시지 생성에서 거절됨)

## Blueprints
* [001 Intent 코드 펜스 방어](blueprints/001-intent-fence-guard/index.md) - `parseIntentBody` 펜스 건너뛰기, plan·finalize gate의 S33, `finalize prepare`·`finalize`의 구조화 실패 (templates, validate, finalize-digest, 문서·테스트)
