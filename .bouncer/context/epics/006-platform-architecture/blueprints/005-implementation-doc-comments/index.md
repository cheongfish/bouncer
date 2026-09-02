---
type: bouncer.blueprint
title: 구현 산출물 한국어 docstring 계약
description: Blueprint 002
resource: .bouncer/context/epics/006-platform-architecture/blueprints/005-implementation-doc-comments/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-24T10:18:28.110+09:00'
bouncer:
  id: '005'
  epic_id: '006'
  blueprint_id: '005'
  status: closed
  commit_type: docs
  scale: full

---
# 005 implementation-doc-comments

Epic: [006](../../index.md)

## Intent
- 문제: 하드룰 9와 `skills/implementation` 4단계는 「왜」를 적는 인라인 주석만 규정한다.
  함수·메서드 단위의 docstring은 어디에도 요구되지 않아서, 구현 산출물에 시그니처
  설명·인자·반환값이 남지 않는다. 구현 언어가 한국어 docstring을 쓰는지도 정해진 바가
  없다.
- 완료 조건: `skills/implementation/SKILL.md`가 docstring 계약을 규정한다 — 구현 언어와
  무관하게 한국어로, 요약과 인자와 반환값을 각각 적는다. 계약 테스트가 그 규정을 단정한다.

## Contract
- 인터페이스: `skills/implementation/SKILL.md`의 「Detailed comments」 단계가 두 갈래로
  나뉜다. 기존의 인라인 why-주석 규정은 그대로 두고, 함수·메서드 단위 docstring 계약을
  더한다. 계약의 형태:

  ```
  요약    무엇을 하는가. 실패·재시도·부작용처럼 호출자가 알아야 할 동작까지.
  Args    인자마다 한 줄: 이름 (타입): 설명
  Returns 반환 타입과 그 의미. 분기하면 분기별로.
  언어    구현 언어와 무관하게 한국어. 식별자·타입명·경로는 원문.
  ```

  주석 밀도의 기준선은 참조 구현으로 제시한다. 절차가 긴 함수는 본문에 번호 단계
  주석(`# 1.` `# 2.`)을 달고, 비자명한 결정에는 그 자리에서 근거를 남긴다.
- 데이터·상태: 문서와 그 문서를 읽는 테스트만 바뀐다. `scripts/`, 게이트, 스키마는
  건드리지 않는다.
- 수용 기준: 에픽 성공 조건 6과 7. `npm test` 통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `test/skill-implementation.test.js`가 이미 「Detailed comments」 라벨과
    `하드룰 9`·`파싱하지 않아야`·`같은 헬퍼를 써야`·`재승인 경로가 없` 조각을 찾는다.
    단계를 재구성하다 이 문자열이 사라지면 실패한다.
  - 참조 구현이 이 저장소 밖 파일이다. 경로를 그대로 인용하면 다른 사용자의 저장소에서
    깨진 링크가 된다 — 발췌한 형태만 문서에 남기고 외부 절대 경로는 적지 않는다.
  - 이 저장소는 TypeScript와 JavaScript다. 예시를 Python docstring 형태로만 적으면
    `scripts/src/**`에 적용할 때 형태가 모호해진다. 두 언어의 형태를 모두 보인다.
  - BP-001 TASKS-002가 같은 파일의 절 이름을 바꾼다. 특히 이 blueprint가 다시 쓰는
    「Detailed comments」 단계는 BP-001이 `## Flow`에서 `## Steps`로 바꾸는 절 **안에**
    있다. 두 blueprint가 같은 구역을 서로 다른 worktree 브랜치에서 만지는데 순서를
    강제하는 게이트는 없다 — 포인터도 게이트도 이 의존을 보지 못한다. 그래서 순서는
    task 브리프의 Constraints에도 적는다.

## Out of scope
- 기존 코드에 소급해 docstring을 다는 일. 지침은 앞으로의 구현에 걸린다.
- `CLAUDE.md` 하드룰 9의 본문 확장 — Distill 결정에 따라 상세 지침은
  `skills/implementation/SKILL.md`에 두고 하드룰은 포인터로 남긴다.
- lint 규칙이나 docstring 검사기 추가. 이 계약은 리뷰가 읽는 산문이지 게이트가 아니다.
- 본문 골격 정렬 — BP-001이 맡는다.

## One-commit justification
파일 두 개, 한 축이다. 지침 문장과 그 문장을 단정하는 계약 테스트는 함께 움직여야
의미가 있다. 나눌 실패 축이 없다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
