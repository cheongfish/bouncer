---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/003-correctness-contracts/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-03T16:04:44.423+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '061'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: 7e588ad431a4c802f56154dc4ceae872ec7f103e
      diff_sha: 85ea04c8d4917e254a503845156af7012c1a974a9b6067b0bc9755b055228b93
      quiz_score: 4/4
      disposition: recorded
  task_commits:
    - id: '001'
      sha: d8795a43
    - id: '002'
      sha: 7e588ad4
---
# Explain

## Background
스킬 문서의 `references/`가 플러그인 루트인지 스킬 로컬인지 한눈에 안 보였고, ACQ 설명은 절차 끝 `## ACQ`에만 몰려 있었다. 같은 문자열로 서로 다른 파일을 가리키는 실수를 막기 어려웠다. 그와 별도로 `scripts/src/lib` CommonJS 모듈은 소비자가 `require(...) as { ... }`로 공급자 시그니처를 손으로 복제해 TypeScript가 모듈 경계를 검사하지 못했다. 이 블루프린트는 참조 표기와 ACQ 시점 계약을 문서에 고정하고, `export =` / `import = require()`로 타입 검사를 되돌리되 공개 `require()` 런타임은 유지한다.

## Intuition
주소에 우편번호와 동·호수를 함께 쓰듯 참조 경로에 기준을 붙이고, 타입은 공급자가 선언한 계약만 소비자가 그대로 받게 한다.

## Code
- `rules/skill-shape.md` — `${BOUNCER_ROOT}/references/...` vs `./references/...`, 마지막 `## ACQ`는 단계 색인만
- `skills/bouncer-*/SKILL.md` — 루트·로컬 참조와 단계별 ACQ / execute 무질문 계약
- `test/skill-bouncer-*.test.js`, `test/master-rules.test.js` — H2·경로·단계 연결 단언
- `scripts/src/lib/*.ts` ↔ `scripts/lib/*.js` — `export =` / `import = require()`, emit 동기화
- `test/typescript-module-contract.test.js` + `test/fixtures/typescript-module-contract-mismatch.ts` — 의도적 시그니처 불일치가 `tsc --noEmit`에서 거절되는지

## Quiz
1. 스킬 로컬 보조 문서를 인용할 때 올바른 표기는?
   - A) `references/foo.md`
   - B) `./references/foo.md`
   - C) `${BOUNCER_ROOT}/references/foo.md`
2. workflow skill 마지막 `## ACQ` 절의 역할은?
   - A) AskUserQuestion 본문과 Options를 여기에만 둔다
   - B) 단계 번호만 남기고, 질문 본문은 해당 numbered step에 둔다
   - C) `bouncer validate`가 읽는 게이트 입력이다
3. CommonJS 모듈 경계에서 공급자·소비자 타입이 검사되려면?
   - A) 소비자가 `require(...) as { fn: (...) => ... }`로 시그니처를 복제한다
   - B) 공급자는 `export =`, 소비자는 `import = require()`로 선언을 공유한다
   - C) ESM `export default`로 바꾼 뒤 `__importDefault`를 방출한다
4. `test/fixtures/typescript-module-contract-mismatch.ts`의 검증 목적은?
   - A) `npm test`에서 fixture가 통과하는지 확인한다
   - B) 별도 `tsc --noEmit`에서 공급자·소비자 시그니처 불일치가 실패하는지 확인한다
   - C) `check:emit`이 fixture를 `scripts/lib`에 복사하는지 확인한다

## 이해 상태
- 정답: 1B, 2B, 3B, 4B
- 응답: 1B, 2B, 3B, 4B
- 채점: 4/4 (전부 정답)
- disposition: recorded — 낮은 점수도 마감을 막지 않음; 이번은 만점
