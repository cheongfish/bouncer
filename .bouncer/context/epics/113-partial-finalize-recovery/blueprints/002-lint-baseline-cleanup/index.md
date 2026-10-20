---
type: bouncer.blueprint
title: lint baseline 정리
description: Clears the eslint baseline errors that block the lint step of npm run ci.
resource: .bouncer/context/epics/113-partial-finalize-recovery/blueprints/002-lint-baseline-cleanup/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-20T09:55:53.696+09:00'
bouncer:
  id: '002'
  epic_id: '113'
  blueprint_id: '002'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# lint baseline 정리

Epic: [113](../../index.md)

## Intent
- 문제: `npm run lint`가 eslint 오류 35개로 실패해 `npm run ci`가 통과하지 못한다. 29개는 113-001 이전 base에 이미 있던 오류이고 6개는 113-001이 새로 만들었다.
- 완료 조건: 9개 파일의 eslint 오류가 0개이고, implementer 가이드에 120자 한도 규칙이 들어간다.

## Contract
- 인터페이스: 공개 인터페이스 변경 없음. 동작을 바꾸지 않는 포맷팅·미사용 변수 제거·`cause` 첨부만 한다.
- 데이터·상태: 변경 없음.
- 수용 기준: 9개 파일 eslint 오류 0개, `npm run build`와 관련 테스트 통과, `agents/bouncer-implementer.md` Guardrails에 120자 규칙 존재.
- 검증 명령: 구현 task는 task 전용 명령(`npx eslint <파일>`, `node --test test/agents.test.js`), 종단 검증은 `npm run ci`.
- 실패 모드·엣지 케이스: 문자열·정규식 때문에 `max-len` 옵션으로 처리되지 않는 긴 줄은 문자열 연결이나 줄바꿈으로 나눈다. `scripts/lib`는 gitignored 빌드 산출물이므로 TypeScript 원본만 고친다. 미사용 `prepareDependencies` 제거가 동작을 바꾸면 `_` 접두사로 바꾼다. `--fix`는 9개만 고치므로 나머지는 직접 고친다.

## Out of scope
- `.worktrees/*` tsconfig 때문에 생기는 604개 parsing error.
- 113 terminal verification(task 004) 재개. develop 머지 후 `npm run ci`로 따로 확인한다.
- eslint 규칙 완화와 `eslint-disable` 추가, 로직 변경과 리팩터링.

## One-commit justification
- 오류 정리(task 001)와 가이드 문구(task 002)는 서로 다른 경로이고 각각 독립 commit이다. 종단 검증(task 003)은 증적만 남긴다.
