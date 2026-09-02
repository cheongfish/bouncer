---
type: bouncer.tasks
title: 문서와 검증 모듈 strict 타입
description: Task specification for the 039 release security work
resource: .bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T15:42:17.323+09:00'
bouncer:
  id: TASKS-004
  epic_id: '039'
  blueprint_id: '001'
  status: verified
  verify: npm run verify:strict
  commit_intent:
    - 문서 로딩과 게이트 판정 값이 any라 잘못된 frontmatter와 finding 형태가 타입 경계를 통과하고 있음
    - 구조 검사와 게이트 입력을 명시적 타입으로 좁히되 기존 G·S 코드와 메시지를 유지함
  affected_paths:
    - tsconfig.strict.json
    - eslint.config.js
    - scripts/src/lib/epic-index.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/verification.ts
    - scripts/src/lib/validate-sections.ts
    - scripts/src/lib/validate-docs.ts
    - scripts/src/lib/validate-structural.ts
    - scripts/src/lib/validate-gates.ts
    - scripts/src/lib/validate.ts
    - scripts/lib/epic-index.js
    - scripts/lib/scaffold.js
    - scripts/lib/verification.js
    - scripts/lib/validate-sections.js
    - scripts/lib/validate-docs.js
    - scripts/lib/validate-structural.js
    - scripts/lib/validate-gates.js
    - scripts/lib/validate.js
  graph:
    generated_at: '2026-08-15T15:55:18+09:00'
    command: 'graphify query "TypeScript strict validation scaffold verification epic index validate structural gates docs sections" --graph graphify-out/{source,context}/graph.json'
    suggested_paths:
      - test
      - .bouncer/distill
      - .bouncer/context/epics/006-scripts-typescript
      - .bouncer/context/epics/039-release-security
    basis:
      - graph: source
        status: reused
        query: TypeScript strict validation scaffold verification epic index validate structural gates docs sections
        result: '96 nodes; top paths: test/distill.test.js, test/migrate-ids.test.js, test/verification-runner.test.js'
      - graph: context
        status: reused
        query: TypeScript strict validation scaffold verification epic index validate structural gates docs sections
        result: '6 nodes; top paths: epic 006, epic 039, and .bouncer/distill/validate-gates.md'
---
# 작업

Blueprint: [001](../../index.md)

## 목표와 의도
scaffold, epic index, verification, validate 계층을 strict 검사 범위에 추가한다.
문서가 디스크에서 들어오는 경계는 `unknown`으로 받고 구조 확인 뒤 좁힌다. 기존
G1~G18·S1~S20 판정, 실패 메시지, `validateBlueprint` 반환 형태는 그대로다.

## 인터페이스
- 제공: 문서 leaf·task unit·finding·gate context·실패 엔트리의 타입과 narrowing을
  추가하고 `tsconfig.strict.json` include를 이 모듈군까지 넓힌다.
- 거부: 게이트/구조 코드, status enum, 실패 문구, scaffold 산출물, verification
  증적 형태 변경과 타입 오류 은폐를 허용하지 않는다.

## 변경 범위
- Modify `tsconfig.strict.json` — 문서·검증 모듈을 누적 include한다.
- Modify `eslint.config.js` — 같은 모듈군을 TypeScript lint 대상에 누적한다.
- Modify `scripts/src/lib/epic-index.ts` — epic 목록과 OKF 행 파싱 타입을 고정한다.
- Modify `scripts/src/lib/scaffold.ts` — scaffold 입력·문서 데이터·쓰기 결과 타입을 고정한다.
- Modify `scripts/src/lib/verification.ts` — 설정 오류·명령 결과·증적 데이터 타입을 고정한다.
- Modify `scripts/src/lib/validate-sections.ts` — section·path·finding 파서 타입을 고정한다.
- Modify `scripts/src/lib/validate-docs.ts` — 문서 leaf와 task unit 타입을 고정한다.
- Modify `scripts/src/lib/validate-structural.ts` — Distill·graph·OKF 구조 입력을 좁힌다.
- Modify `scripts/src/lib/validate-gates.ts` — gate context와 실패 엔트리 타입을 고정한다.
- Modify `scripts/src/lib/validate.ts` — validate 오케스트레이션 입력·출력을 고정한다.
- Modify `scripts/lib/epic-index.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/scaffold.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/verification.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-sections.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-docs.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-structural.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate-gates.js` — TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/lib/validate.js` — TypeScript 변경의 CJS emit을 동기화한다.

## 변경 금지
- `test` — 기존 판정 단언을 타입 작업에 맞춰 약화하지 않는다.
- `skills` — 워크플로 의미는 BP002까지 유지한다.
- `tsconfig.json` — 전체 strict 전환은 TASKS-007이 맡는다.

## 제약 조건
- `module.exports` 키 집합과 require 경로를 유지한다.
- 잘못된 문서가 지금 실패하는 코드와 메시지를 유지한다.
- optional 문서와 손상된 JSON의 기존 fail-open/fail-closed 경계를 바꾸지 않는다.
- 타입 전용 helper는 한 파일에서만 쓰면 그 파일 안에 둔다.

## 체크리스트
- [ ] strict include와 ESLint 대상 목록을 넓혀 새 오류를 확인한다.
- [ ] 디스크/YAML/JSON 입력을 `unknown`에서 좁히고 내부 문서·게이트 타입을 연결한다.
- [ ] 타입 우회 토큰이 새로 생기지 않았는지 검색한다.
- [ ] `npm run build`로 여덟 CJS emit을 동기화한다.
- [ ] `npm run verify:strict`를 실행한다.
