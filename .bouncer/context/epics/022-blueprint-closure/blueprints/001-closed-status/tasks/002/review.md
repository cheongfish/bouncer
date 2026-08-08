---
type: bouncer.review
title: 002 review
description: Review for 002
resource: .bouncer/context/epics/022-blueprint-closure/blueprints/001-closed-status/tasks/002/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-08T13:17:10.238+09:00'
bouncer:
  id: REVIEW-002
  epic_id: '022'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: R1
        severity: nit
        status: accepted
        summary: 'scaffold.ts:97 잠금 에러 메시지가 파일 내 다른 영어 메시지와 달리 em dash를 쓴다'
        note: 저장소 산문이 이미 em dash를 쓰고 UTF-8 출력을 전제한다. 문구 교정만을 위해 emit을 다시 굽지 않는다.
      - id: R2
        severity: nit
        status: resolved
        summary: draft blueprint가 거절되지 않는다는 보장이 기존 테스트에 간접적으로만 걸려 있었다
      - id: R3
        severity: nit
        status: accepted
        summary: setBlueprintStatus가 정규식으로 status를 갈아끼워 템플릿 변경에 취약하다
        note: 뒤따르는 readDoc 단언이 치환 실패를 즉시 드러내므로 조용한 no-op은 생기지 않는다.
---
# Review

## Findings

- `nit` — `scripts/src/lib/scaffold.ts:97`의 잠금 에러 메시지가 같은 파일의 다른
  영어 메시지와 달리 em dash를 포함한다. **accepted** — 저장소 산문이 이미 em dash를
  쓰고 CLI 출력은 UTF-8을 전제한다. 문구만 바꾸자고 `scripts/lib` emit을 다시 굽지 않는다.
- `nit` — Interface가 `draft` blueprint를 거절하지 않는다고 못박는데 회귀는
  `test/scaffold.test.js:158`의 `approved` / `superseded` 루프뿐이라 draft는 기존
  테스트를 통한 간접 보장이었다. **resolved** — 그 루프에 `draft`를 넣어 직접 단언한다.
- `nit` — `test/scaffold.test.js:112` `setBlueprintStatus`가 `status: draft`를
  정규식으로 치환해 템플릿 직렬화가 바뀌면 깨진다. **accepted** — 치환 직후의
  `readDoc(...).data.bouncer.status` 단언이 실패로 드러내므로 조용히 통과하는 경로가 없다.
