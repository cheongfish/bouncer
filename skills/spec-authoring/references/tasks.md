---
type: bouncer.tasks
title: verify.timeout_ms 기본값과 실행 상한을 추가함
description: '`config.verify.timeout_ms`를 도입해 verify 실행에 선택적 상한을 둔다.'
resource: .bouncer/context/epics/077-verify-timeout/blueprints/001-verify-timeout-ms/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T12:00:00.000+09:00'
bouncer:
  id: TASKS-001
  epic_id: '077'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - verify가 멈추면 execute가 무한 대기하는 문제를 막음
    - timeout_ms로 상한을 두고 초과 시 실패 증적을 남김
  affected_paths:
    - config.example.json
    - scripts/src/lib/init.ts
    - scripts/src/lib/verification.ts
    - test/cli-verify.test.js
  scope_evidence:
    generated_at: '2026-08-12T12:00:00.000+09:00'
    producer: graphify
    suggested_paths:
      - scripts/src/lib
      - test
    basis:
      - graph: source
        status: reused
        query: verify timeout_ms config spawn
        result: verification.ts·init.ts·cli-verify 테스트가 반환됨
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`config.verify.timeout_ms`를 도입해 verify 실행에 선택적 상한을 둔다. 기본값은 10분(600000). 키 부재·`0`은 기존 무제한 대기와 같다. 검증 명령은 `npm test`.

이 예시는 설정 키 계약이라 흐름 변경이 아니며, Mermaid 차트를 넣지 않는다.

## Interface
- 제공: `verify.timeout_ms`가 양의 정수이면 해당 ms 후 자식 프로세스를 종료하고 timeout 실패를 증적에 남긴다. `init` 기본 config와 `config.example.json`에 `timeout_ms: 600000`이 있다.
- 거부: 음수·NaN·문자열 `timeout_ms`는 설정 로드에서 에러로 거절한다. 하위 호환 별칭(`timeout` 등)은 두지 않는다.

## Touch
- Modify `config.example.json` — `verify`에 `timeout_ms: 600000` 추가
- Modify `scripts/src/lib/init.ts` — `defaultConfig.verify`에 같은 기본값
- Modify `scripts/src/lib/verification.ts` — 양의 정수일 때만 spawn 상한 적용
- Modify `test/cli-verify.test.js` — timeout·무제한·잘못된 값 단언

## Do not touch
- `scripts/src/lib/validate.ts` — 게이트 계약 변경 아님
- `skills/` — 이번 변경은 런타임 config·실행기만

## Constraints
- `timeout_ms` 부재·`0` 동작은 이번 변경 전과 같아야 한다.
- 공개 에러 메시지는 한국어를 유지한다.

## Checklist
- [ ] `test/cli-verify.test.js`에 실패 테스트를 추가한다.
  ```js
  assert.rejects(() => loadVerifyConfig({ timeout_ms: -1 }), /timeout_ms/);
  // hang fixture + timeout_ms: 50 → exit non-zero, evidence matches /timeout/i
  ```
- [ ] `node --test test/cli-verify.test.js`로 실패를 확인한다.
- [ ] 양의 정수 `timeout_ms`일 때만 spawn 상한을 적용하고 기본값을 둔다.
- [ ] `npm test`가 통과한다.
