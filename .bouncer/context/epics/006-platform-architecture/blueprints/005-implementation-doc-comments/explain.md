---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/006-platform-architecture/blueprints/005-implementation-doc-comments/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T12:15:38.419+09:00'
bouncer:
  id: 'EXPLAIN-005'
  epic_id: '006'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: 1621975b8be6c9d9c4dc5b63c80674ce525dde8c
      diff_sha: 6b8e911f24ba1cc68d45428512a66682373cd225249f29df018ce767290f4c93
      quiz_score: '2/2'
      disposition: >-
        두 문항 모두 맞았다. docstring 본문은 구현 언어와 무관하게 한국어이고,
        JSDoc과 Python 표기는 섞지 않는다.
      recorded_at: '2026-08-24T12:17:20+09:00'

---
# Explain

## Background
하드룰 9와 `skills/implementation` 4단계는 비자명한 「왜」를 인라인 주석으로
남기라고만 했다. 함수·메서드 단위로 무엇을 적는지, 그 글을 어느 언어로 쓰는지가
비어 있어서 구현 산출물에 요약·인자·반환값이 남지 않았다.

이 변경은 「Detailed comments」 단계에 docstring 계약을 얹는다. 요약, Args,
Returns, 언어(구현 언어와 무관하게 한국어). 표기는 언어 관용을 따른다.
긴 절차에는 `# 1.` `# 2.` 단계 주석과 그 자리의 근거를 요구한다. 기존 why-주석과
Bad/Good 대조는 그대로 둔다. lint나 검사기는 추가하지 않는다.

## Intuition
시그니처 설명의 껍질은 그 언어의 관용이고, 안에 적는 말은 한국어다.

## Code
- `skills/implementation/SKILL.md` — 「Detailed comments」 단계. 인라인 why-주석
  아래에 계약 넷, TypeScript JSDoc 예시(`@param {타입} 이름 - 설명`), Python
  `Args:` / `Returns:` 예시(`이름 (타입): 설명`), 번호 단계 주석 문단.
- `test/skill-implementation.test.js` —
  `implementation requires Korean docstrings with args and returns`.
  `\*\*Detailed comments\*\*` 구간만 잘라 `docstring`, Args/인자, Returns/반환,
  언어 무관 한국어, `@param {…}`, `Args:`를 단정한다.

## Quiz
1. 구현 언어가 TypeScript일 때 docstring 본문의 언어는?
   - (a) TypeScript 주석이므로 영어
   - (b) 구현 언어와 무관하게 한국어. 식별자·타입명·경로는 원문
   - (c) JSDoc 태그만 영어, 요약은 한글·영어 중 자유

2. JSDoc과 Python docstring의 표기를 섞으면?
   - (a) 계약이 허용한다. 필요한 것은 항목의 존재뿐이다
   - (b) JSDoc에도 `이름 (타입): 설명`을 써야 한다
   - (c) 섞지 않는다. JSDoc은 `@param {타입} 이름 - 설명`, Python은
     `Args:` 아래 `이름 (타입): 설명`

## 이해 상태
점수 `2/2`. 정답은 1-b, 2-c. 응답은 1-b, 2-c. 두 문항 모두 맞음.
docstring 본문은 구현 언어와 무관하게 한국어이고, 식별자·타입명·경로는 원문이다.
JSDoc은 `@param {타입} 이름 - 설명`, Python은 `Args:` 아래 `이름 (타입): 설명`이며
두 표기를 섞지 않는다.
