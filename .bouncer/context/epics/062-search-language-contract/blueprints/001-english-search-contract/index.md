---
type: bouncer.blueprint
title: 영어 검색 계약 고정
description: 컨텍스트 본문 언어와 검색 어휘 언어를 분리하고, 앵커 문법과 runner 질의 언어를 계약으로 고정한다.
resource: .bouncer/context/epics/062-search-language-contract/blueprints/001-english-search-contract/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-31T16:19:11.008+09:00'
bouncer:
  id: '001'
  epic_id: '062'
  blueprint_id: '001'
  status: approved
  commit_type: docs
  scale: full
  supersedes: []
---
# 001 english-search-contract

Epic: [062](../../index.md)

## Intent
- 문제: 검색 어휘 규칙이 어느 문서에도 없다. 하드룰 8은 본문 한국어만 말하고, `rules/okf.md`의 `title`·`description`·`tags` 지침은 언어를 정하지 않으며, `graphify-runner`는 query 언어를 지시하지 않는다. 규칙이 없으니 Wave 2가 생성할 앵커의 문법도 정해진 바가 없다.
- 완료 조건: 언어 분리·앵커 문법·질의 언어가 하드룰과 `rules/okf.md`, `references/spec-authoring/index.md`, `references/graphify-runner/index.md`에 적히고, 계약 테스트가 그 진술과 앵커의 토큰 동작을 고정한다.

이 blueprint는 규칙 문서 계약이라 흐름 변경이 아니며, Mermaid 차트를 넣지 않는다.

## Contract
- 인터페이스: 세 가지 서면 계약을 새로 정의한다. ① 언어 분리 — 컨텍스트 본문은 한국어, `description`·`tags`·파생 앵커·`graph-suggest` 질의는 영어 ASCII, `title`은 한국어 커밋 제목 원천으로 남는 명시적 예외. ② 앵커 문법 — `epic-<ddd>`, `bp-<ddd>-<ddd>`, `task-<ddd>-<ddd>-<ddd>`. ③ 질의 언어 — `graphify-runner`가 영어 query와 영어 seed를 만든다.
- 데이터·상태: 실행 코드와 스키마는 바뀌지 않는다. `scripts/` 아래 산출물, 게이트 코드, `tokenize()`는 그대로다. 바뀌는 것은 규칙·지침 문서와 그 문서를 고정하는 테스트뿐이다.
- 수용 기준: epic Success criteria 1–5가 참이다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `title`을 영어로 돌리면 `.gitmessage` 한국어 명사형 제목 규약이 깨진다. 규칙은 `title`을 예외로 못 박아 이 회귀를 막는다.
  - `description`은 `.bouncer/context/index.md` 요약 행의 원천이다. 신규 문서부터 영어로 쓰면 색인이 한·영 혼재가 된다. 이 wave는 그 혼재를 허용 상태로 명시하고, 일괄 정리는 Wave 4로 넘긴다.
  - 콜론 앵커(`epic:054`)는 일반 query에서 `epic`과 `054`로 쪼개져 완전 일치가 실패한다. 문법 계약이 콜론을 금지한다.
  - `stop-slop`의 "English overview + Korean body" 금지와 충돌할 수 있다. 앵커·검색 메타데이터는 사람이 읽는 산문이 아니므로 그 규칙 대상이 아님을 명시한다.
  - 하이픈은 토크나이저가 보존하지만 공백·콜론·한국어는 보존하지 않는다. 문법에 공백이 들어가면 앵커가 여러 토큰으로 쪼개져 계약이 무효가 된다.

## Out of scope
- `scripts/src/lib/context-digest.ts`의 앵커 생성과 `## Touch` 경로 승격
- `scripts/src/lib/graph-search.ts`의 `tokenize()` 및 매칭 로직
- 기존 컨텍스트 문서의 frontmatter 일괄 번역
- `.gitmessage`와 커밋 제목 조립 경로

## One-commit justification
- 이 blueprint는 한 계약을 세 문서 계층에 나눠 적는다. 언어 분리는 하드룰과 authoring 규칙이, 앵커 문법은 `rules/okf.md`가, 질의 언어는 runner 지침이 각각 독립적으로 리뷰 가능한 단위라 task 세 개로 나누고, blueprint 전체가 하나의 PR이 된다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 언어 분리 규칙 확정
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 앵커 문법 고정과 토큰 동작 테스트
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - graphify-runner 영어 질의 지침
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
