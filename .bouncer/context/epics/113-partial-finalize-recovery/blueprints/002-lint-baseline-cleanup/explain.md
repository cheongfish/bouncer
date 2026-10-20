---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/113-partial-finalize-recovery/blueprints/002-lint-baseline-cleanup/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-20T10:28:19.645+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '113'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: f82d64ead725ab967410d57d21e5a49b9bf9846d
      range_to: d1e5437e6a4812a8b0cabbec74e0f0e607f19cf0
      diff_sha: 30cebe916e1b427dd8ed097bd8d09a9d27d35cb182c2731d977752cc5360e023
      recorded_at: '2026-10-20T10:35:00+09:00'
  task_commits:
    - task: EPIC-113/BP-002/TASK-001
      sha: 3c19ab4a
      intent_anchor: task-001
    - task: EPIC-113/BP-002/TASK-002
      sha: d1e5437e
      intent_anchor: task-002
---
# Explain

## Background

`npm run lint`가 eslint 오류 35개로 실패해 `npm run ci`가 통과하지 못했다. 29개는 이전부터 있던 오류이고 6개는 부분 마감 복구 작업이 새로 만들었다. 같은 오류가 반복되지 않도록 implementer 가이드에도 줄 길이 규칙을 넣었다.

## Code

- `scripts/measure-source-boundaries.js`, `test/source-boundary-measurement.test.js`, `scripts/src/lib/*.ts` 7개: 120자 초과 줄 분리, 따옴표 통일, 쓰지 않는 `os`·`spawnSync`·`prepareDependencies` 제거, `throw` 시 `{ cause: error }` 첨부. 문자열 값과 에러 메시지는 그대로다. `probeModule`의 긴 코드 문자열은 배열 `join`으로 나눴으나 결과 값은 같다.
- `agents/bouncer-implementer.md`: Guardrails에 "ts·js 파일은 한 줄 120자 이내, `eslint-disable`로 우회 금지" 규칙을 추가했다. 한도는 `eslint.config.js`의 `max-len`과 같다.
- `.codex/agents/bouncer-implementer.toml`: 위 md에서 생성되는 파일이라 3줄을 다시 생성했다. 원본이 바뀌면 이 파일도 함께 갱신해야 `test/agents.test.js`가 통과한다.
- 한계: `runProbe`의 invalid JSON 경로와 `error.cause` 첨부를 검증하는 테스트는 없다.

## Quiz

1. implementer 가이드에 추가된 줄 길이 한도는 얼마이며 어디서 온 값인가?
   - a) 100자, `.editorconfig` / b) 120자, `eslint.config.js` / c) 120자, Prettier 기본값
2. 가이드 문서를 고친 뒤 함께 갱신해야 하는 생성 파일은 무엇이며 왜인가?
   - a) `README.md` / b) `eslint.config.js` / c) `.codex/agents/bouncer-implementer.toml`
3. 긴 줄을 만났을 때 가이드가 금지하는 우회 방법은 무엇인가?
   - a) 줄 나누기 / b) `eslint-disable` / c) 배열 `join` 분리

## Tasks

### EPIC-113/BP-002/TASK-001 · `3c19ab4a`

#### Goal & intent

`npm run lint`를 막는 eslint 오류를 없애, 이후 blueprint의 terminal verification이 lint 때문에 실패하지 않게 한다.

#### Current behavior

9개 파일에서 오류 35개가 난다(113-001 integration 기준).
- `scripts/measure-source-boundaries.js`: `os` 미사용(5), `max-len` 12곳(68,100,111,114,174,202,226,227,272,289,293,304), `preserve-caught-error`(89).
- `test/source-boundary-measurement.test.js`: `spawnSync` 미사용(8), `quotes` 8곳(78,107–113).
- `cli-usage.ts:12` quotes. `coordinator-commands.ts`: 11행 `prepareDependencies` 미사용, 53·54행 `max-len`.
- `coordinator-git.ts` 6·115행, `coordinator-ledger.ts` 57행, `execution-contracts.ts` 92행, `finalize-release-main.ts` 365·382행, `finalize.ts` 370·390행: `max-len`.

#### Target behavior

같은 9개 파일에서 eslint 오류가 0개다. 런타임 동작, 에러 메시지 문구, export는 그대로다. `measure-source-boundaries.js:89`의 던지는 `Error`에는 원래 오류를 `{ cause: error }`로 붙인다.

#### Interface

- 제공: 공개 시그니처 변경 없음.
- 거부: 규칙 완화, `eslint-disable` 주석, 로직 변경.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/measure-source-boundaries.js` | 파일 전체 | Modify | 소스 경계 측정 CLI | 긴 줄 분리, 미사용 `os` 제거, `cause` 첨부 | base부터 있던 오류 14개 |
| `test/source-boundary-measurement.test.js` | 파일 전체 | Modify | 측정 도구 테스트 | 미사용 `spawnSync` 제거, 작은따옴표 통일 | base부터 있던 오류 9개 |
| `scripts/src/lib/coordinator-commands.ts` | 상단 import, 53–54행 | Modify | coordinator 명령 | 미사용 `prepareDependencies` 제거(불가하면 `_` 접두사), 줄 분리 | base부터 있던 오류 3개 |
| `scripts/src/lib/coordinator-git.ts` | 6·115행 | Modify | coordinator git 보조 | 줄 분리 | base부터 있던 오류 2개 |
| `scripts/src/lib/coordinator-ledger.ts` | 57행 | Modify | ledger 읽기·쓰기 | 줄 분리 | base부터 있던 오류 1개 |
| `scripts/src/lib/cli-usage.ts` | 12행 | Modify | CLI usage 문구 | 작은따옴표로 통일 | 113-001이 만든 오류 |
| `scripts/src/lib/execution-contracts.ts` | 92행 | Modify | 실행 계약 | 줄 분리 | 113-001이 만든 오류 |
| `scripts/src/lib/finalize-release-main.ts` | 365·382행 | Modify | main 병합 마감 | 줄 분리 | 113-001이 만든 오류 |
| `scripts/src/lib/finalize.ts` | 370·390행 | Modify | finalize 흐름 | 줄 분리 | 113-001이 만든 오류 |

#### Constraints

- 줄 바꿈이나 따옴표 변경이 문자열 값·에러 메시지·템플릿 리터럴 결과를 바꾸지 않는다.
- 새 줄은 120자 이하로 쓴다.
- `eslint-disable`을 추가하지 않는다.

### EPIC-113/BP-002/TASK-002 · `d1e5437e`

#### Goal & intent

implementer가 새로 쓰는 ts·js 코드에서 `max-len` 오류를 만들지 않게 해, 이번 같은 lint 회귀를 막는다.

#### Current behavior

`agents/bouncer-implementer.md` Guardrails에는 줄 길이 규칙이 없다. 한도는 `eslint.config.js`의 `max-len` 120뿐이라 implementer가 verify 실패 뒤에야 알게 된다.

#### Target behavior

Guardrails에 항목이 하나 생긴다. ts·js 파일에서 한 줄은 120자를 넘기지 않으며, 넘기면 줄바꿈으로 나눈다. 규칙을 `eslint-disable`로 우회하지 않는다. 기존 문구와 역할 문서 구조는 그대로다.

#### Interface

- 제공: Guardrails 항목 1개.
- 거부: 다른 역할 문서·`AGENTS.md` 변경.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-implementer.md` | `## Guardrails` | Modify | implementer 행동 규칙 | 120자 한도 항목 추가 | `eslint.config.js` `max-len` 120과 일치 |

#### Constraints

- 한도 값은 eslint 설정과 같은 120이다.
- 문서 본문은 기존 Guardrails처럼 영어로 쓴다.

### EPIC-113/BP-002/TASK-003

#### Goal & intent

구현 task 001·002가 통합된 상태에서 `npm run ci`를 한 번 실행해, lint를 포함한 전체 검증이 통과함을 증적으로 남긴다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.