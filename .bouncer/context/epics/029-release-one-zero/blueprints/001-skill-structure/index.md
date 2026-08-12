---
type: bouncer.blueprint
title: 스킬 구조 정렬과 주석 규칙 승격
description: Blueprint 001
resource: .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-12T09:53:14.670+09:00'
bouncer:
  id: '001'
  epic_id: '029'
  blueprint_id: '001'
  status: approved
  commit_type: refactor
---
# 001 skill-structure

Epic: [029](../../index.md)

## Intent
- 문제: 워크플로 스킬 5개가 플러그인 루트 해석 산문을 각자 복제해 갖고 있고,
  그 내용은 `docs/install.md` 「플러그인 루트」와 이미 중복이다. 16개 스킬은
  서술 방식·길이·자료 배치가 제각각으로 자랐다.
- 완료 조건: 16개 `SKILL.md`가 같은 anatomy를 따르고, 중복 산문이 기존 문서 참조로
  대체되며, 코드 주석 규칙이 `CLAUDE.md` 하드룰로 올라간다.

## Contract
- 인터페이스: `SKILL.md` frontmatter는 `name` / `description` 두 필드를 유지한다.
  스킬 이름·경로·호출 방식은 바뀌지 않는다. `CLAUDE.md`에 코드 주석 하드룰이
  하나 추가된다.
- 데이터·상태: TASKS-001~003은 문서만 바꾼다. TASKS-004만 예외로 `finalize`의
  커밋 의도 해석 경로를 바꾼다 — 커밋 의도를 task 문서로 일원화하면 마감 커밋이
  읽을 출처가 사라지므로 지침만으로는 닫히지 않는다. 게이트 코드, 문서 스키마,
  `config.json` 형태는 이 blueprint에서 건드리지 않는다.
- 수용 기준: `npm test` 통과. 스킬 계약 테스트가 새 구조를 검증하도록 갱신되어
  있고, 워크플로 스킬 5개에서 플러그인 루트 해석 산문이 사라진 자리에
  `docs/install.md` 참조가 있다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `test/master-rules.test.js`는 워크플로 스킬 본문에서 `CLAUDE.md`와
    `Master rules` 토큰을 찾는다. 산문을 걷어내며 두 토큰까지 지우면 실패한다.
  - 셸 블록의 `BOUNCER_ROOT=` 대입은 **중복이 아니라 필연**이다. 블록마다 새 셸이
    떠서 변수가 넘어가지 않으므로 대입 자체를 참조로 대체하면 실행이 깨진다.
  - 스킬 YAML `description`에 따옴표 없는 `##`가 들어가면 주석으로 잘린다.
  - `skills/` 아래에 `SKILL.md` 없는 디렉터리를 만들면 호스트의 스킬 자동 탐색이
    이를 잘못된 스킬로 읽을 수 있다.

## Out of scope
- 게이트 코드 재편(G17 / G18 / G15 폐기) — BP-002가 맡는다.
- 문서 스키마와 legacy 레이아웃 컷오버 — BP-003이 맡는다.
- `/bouncer-run`과 자율성 설정 — BP-004가 맡는다.
- 스킬 **내용**의 의미 변경. 이 blueprint는 배치와 서술 방식만 바꾼다. 절차가
  달라지면 그것은 해당 BP의 일이다. 예외는 TASKS-004 하나 — 커밋 의도의 작성
  위치를 task 문서로 좁히는 변경이며, 커밋 단위가 task라는 기존 원칙을 문서와
  코드에 맞추는 일이라 다른 BP를 기다릴 이유가 없다.

## One-commit justification
task 단위로 네 커밋이며 리뷰·PR 단위는 이 blueprint다. 넷으로 나눈 근거는 실패
지점이 다르기 때문이다 — 워크플로 5개는 셸 블록과 `master-rules.test.js`가 걸리고,
나머지 11개는 각자의 계약 테스트만 걸리며, 주석 규칙은 `CLAUDE.md`와 에이전트
문서가, 커밋 의도 일원화는 `finalize` 동작과 그 테스트가 걸린다. 한 커밋으로
묶으면 어느 축이 깨졌는지 리뷰에서 분리되지 않는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 워크플로 스킬 5개 정렬
* [Tasks 002](tasks/002/tasks.md) - 나머지 스킬 11개 정렬
* [Tasks 003](tasks/003/tasks.md) - 코드 주석 규칙 승격
* [Tasks 004](tasks/004/tasks.md) - 커밋 의도 작성 위치 일원화
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
