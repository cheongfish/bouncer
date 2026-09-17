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
  id: EXPLAIN-005
  epic_id: '006'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: 1621975b8be6c9d9c4dc5b63c80674ce525dde8c
      diff_sha: 6b8e911f24ba1cc68d45428512a66682373cd225249f29df018ce767290f4c93
      quiz_score: 2/2
      disposition: 두 문항 모두 맞았다. docstring 본문은 구현 언어와 무관하게 한국어이고, JSDoc과 Python 표기는 섞지 않는다.
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

## Tasks

### Task 001

#### Goal & intent

`skills/implementation/SKILL.md`의 「Detailed comments」 단계에 docstring 계약을 더한다.
지금 그 단계는 인라인 why-주석만 규정한다. 함수·메서드 단위로 무엇을 남겨야 하는지,
그리고 그것을 어느 언어로 쓰는지가 비어 있다.

계약은 넷이다. **요약** — 무엇을 하는가에 더해 실패·재시도·부작용처럼 호출자가 알아야
할 동작까지. **Args** — 인자마다 `이름 (타입): 설명` 한 줄. **Returns** — 반환 타입과
그 의미, 분기하면 분기별로. **언어** — 구현 언어와 무관하게 한국어. 식별자·타입명·
경로는 원문 그대로 둔다.

절차가 긴 함수는 본문에 번호 단계 주석을 달고, 비자명한 결정에는 그 자리에서 근거를
남긴다. 기존 4단계의 why-주석 규정은 그대로 두고 그 위에 얹는다.

이 task는 BP-001 TASKS-002 **뒤에** 실행한다. 그 task가 이 파일의 `## Flow`를
`## Steps`로 바꾸고 「Detailed comments」 단계는 그 절 안에 있다. 착수 시점에 절
이름이 아직 `## Flow`라면 BP-001이 끝나지 않은 것이므로 구현하지 말고 보고한다.

#### Interface

- 제공: `skills/implementation/SKILL.md`의 「Detailed comments」 단계. 인라인 why-주석
  규정과 docstring 계약 둘을 갖고, 계약에는 TypeScript(JSDoc)와 Python 두 언어의 형태
  예시가 각각 있다.
- 거부: 하드룰 9 언급, 기존 `scripts/lib/validate.js` Bad/Good 대조 예시 셋, 그 예시의
  한국어 조각(`파싱하지 않아야`, `같은 헬퍼를 써야`, `재승인 경로가 없`)은 지우지
  않는다. lint 규칙이나 검사기를 추가하지 않는다 — 이 계약은 리뷰가 읽는 산문이다.

#### Touch

- Modify `skills/implementation/SKILL.md` — 「Detailed comments」 단계에 docstring 계약과 두 언어 예시 추가
- Modify `test/skill-implementation.test.js` — docstring 계약 단정 추가

#### Constraints

- 기존 계약 테스트가 찾는 문자열을 유지한다. 아래는 망라가 아니므로 착수 전에
  `test/skill-implementation.test.js`를 직접 읽고 단정 다섯 개를 모두 확인한다:
  `Detailed comments`, `하드룰 9` 또는 `Hard rule 9`, `scripts/lib/validate.js`,
  `파싱하지 않아야`, `같은 헬퍼를 써야`, `재승인 경로가 없`, `why`,
  `invariant`/`trade-off`/`ceiling` 중 하나, `thorough` 또는 `Prefer thoroughness`
  또는 `상세`, 그리고 Bad/Good 대조 예시의 `**Bad**`·`**Good**` 굵은 표기.
  이 중 셋(`invariant`·`ceiling`·`Prefer thoroughness`)은 현재 파일에서 한 문장
  「Prefer thoroughness over brevity: intent, invariants, rejection paths,
  trade-offs, and known ceilings」이 혼자 떠받치고 있다. 단계를 두 갈래로 나누다
  그 문장을 지우면 예고 없이 `npm test`가 깨진다.
- 참조 구현의 외부 절대 경로를 문서에 적지 않는다. 다른 저장소의 파일이라 링크가
  깨진다. 형태만 발췌해 예시로 남긴다.
- 예시는 TypeScript(JSDoc)와 Python 둘 다 보인다. 이 저장소는 TS/JS이고 계약은 언어
  무관이므로 한쪽만 보이면 적용 형태가 모호해진다.
- 계약이 요구하는 것은 항목의 **존재**(요약·인자별 한 줄·반환)이지 표기법이 아니다.
  표기는 각 언어의 관용을 따른다 — JSDoc은 `@param {타입} 이름 - 설명`이고
  `이름 (타입): 설명`은 Python 쪽 관용이다. 두 형태를 섞어 쓰지 않는다.
- 스킬 지시문 산문은 영어를 유지한다. 예시 docstring의 내용은 한국어다 — 그것이 규정
  자체다.
- Touch에 적힌 두 파일 밖은 건드리지 않는다. 다른 스킬 문서와 다른 테스트 파일은
  이 작업과 무관하고, 기존 코드에 docstring을 소급해 다는 것도 범위가 아니다.
- 자명한 한 줄 함수까지 docstring을 요구하지 않는다. 기존 4단계가 이미 「Trivial
  one-liners that are self-evident need no comment」로 선을 그어 두었고, 그 선을 유지한다.
