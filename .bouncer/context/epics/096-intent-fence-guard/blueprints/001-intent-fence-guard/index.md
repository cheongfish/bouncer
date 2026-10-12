---
type: bouncer.blueprint
title: blueprint Intent 코드 펜스 검사 보강
description: Skip code fences when parsing blueprint Intent and fail malformed Intent early with a structured result.
resource: .bouncer/context/epics/096-intent-fence-guard/blueprints/001-intent-fence-guard/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - intent
  - validate
timestamp: '2026-10-12T17:16:17.923+09:00'
bouncer:
  id: '001'
  epic_id: '096'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 blueprint Intent 코드 펜스 검사 보강

Epic: [096](../../index.md)

## Intent
`## Intent` 아래의 코드 펜스를 문장으로 읽어 finalize가 마지막 단계에서 스택 트레이스로 중단되던 문제를 고친다.
파서가 펜스를 건너뛰고, plan·finalize gate와 `finalize prepare`가 올바르지 않은 Intent를 먼저 구조화된 실패로 보고함.

## Flow
```mermaid
flowchart LR
  B[plan gate] --> C[finalize prepare]
  C --> D[finalize 커밋 메시지]
```

## Contract
- 인터페이스:
  - `parseIntentBody(body)`: 시그니처는 그대로다. 줄 분리 뒤 `` ``` ``/`~~~`로 시작하는 줄(불릿·들여쓰기 제거 후 판정)부터 불릿·공백을 벗긴 뒤 같은 문자만으로 여는 펜스 이상 길이인 닫는 펜스 줄(뒤에 다른 글자가 없는 줄)까지를 문장 집계에서 뺀다. 닫는 펜스가 없으면 섹션 끝까지 뺀다.
  - 검증 코드 `S33`: `validateBlueprint`가 `gate`가 `plan` 또는 `finalize`이고 blueprint `status`가 `draft`가 아닐 때 index 본문에 `parseIntentBody`를 돌려, 던지면 `{ code: 'S33', message, file }`을 `failures`에 넣는다. `## Intent` 헤딩이 없는 문서는 `S33` 대상이 아니다(기존 finalize 동작 유지, fixture 파급 차단). `GATE_FAILURE_HINTS`에 `S33` 행(`next`)을 둔다.
  - `prepareFinalizeDigest`: `## Intent` 헤딩이 있는 본문의 파싱 오류를 `intent = []`로 삼키지 않고 `{ ok: false, reason: 'validate', failures: [S33] }`(`next` 없음)로 돌려준다. 헤딩 부재는 기존처럼 `intent: []`로 통과한다.
  - `finalize()`: 코드 변경 없음. 기존 finalize gate 호출(`reason: 'validate'`)이 `S33`을 돌려주므로, 커밋 메시지 생성의 던지는 경로에 닿기 전에 구조화된 실패로 끝난다.
- 데이터·상태: 문서 스키마와 frontmatter 변경 없음. `DigestFail`에 `failures?: { code: string; message: string; file: string }[]`를 추가한다.
- 수용 기준: epic 096 Success criteria 1~8.
- 검증 명령: `npm run ci`.
- 실패 모드·엣지 케이스:
  - 불릿 안 펜스(`- ```mermaid`)와 들여쓰기된 펜스는 펜스로 본다.
  - 여는 펜스와 다른 종류(`~~~` 안의 ```` ``` ````)는 닫는 펜스가 아니다.
  - 펜스만 있고 문장이 없는 Intent는 기존 0문장 오류를 던진다.
  - HTML 주석 안의 펜스는 주석 제거 뒤에 보지 않는다(기존 순서 유지).
  - 닫히지 않은 펜스 뒤의 문장은 펜스 안으로 본다.
  - `## Intent` 헤딩이 없는 blueprint는 두 gate 모두 `S33`을 내지 않는다(범위 밖).
  - 섹션 끝은 기존처럼 펜스 추적 전에 첫 `^## ` 줄로 정한다. 펜스 안의 `## ` 줄도 섹션을 끝낸다.
  - `status: draft`인 blueprint는 scaffold 기본 Intent(`- 문제: <TODO…>`)여도 `S33`을 받지 않는다. 승인 뒤(`approved` 이상) 같은 상태면 plan gate가 `S33`으로 막는다.
  - 변경 전 파서를 통과한 기존 blueprint는 같은 결과를 유지하고, 변경 전 실패한 문서가 변경 후 통과하는 것은 허용한다.

## Out of scope
- Mermaid 렌더링 검사, task S32 변경, 완료된 blueprint 소급 수정
- `buildFinalizeCommitMessage`·`normalizeAuthoredLines`의 던지는 계약 변경
- `execute`·`commit` gate에 Intent 검사 추가

## One-commit justification
- 파서 규칙, 두 검사 지점, finalize 실패 형태가 같은 `parseIntentBody` 계약을 공유한다. 하나만 바꾸면 gate가 통과시킨 문서를 finalize가 거절하거나 그 반대가 되어 불일치가 남는다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
