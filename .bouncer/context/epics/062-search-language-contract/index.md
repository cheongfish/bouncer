---
type: bouncer.epic
title: 검색 언어 계약
description: graph-suggest 검색의 생산자와 소비자가 같은 영어 ASCII 어휘와 토큰 규칙을 쓰도록 언어 계약을 고정한다.
resource: .bouncer/context/epics/062-search-language-contract/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-31T16:19:10.963+09:00'
bouncer:
  id: '062'
  epic_id: '062'
  status: approved
  supersedes: []
---
# 062 search-language-contract

## Intent
- 문제: `graph-suggest`의 토크나이저는 `[A-Za-z0-9_./-]`만 남기고 라벨을 완전 일치로 비교한다. 컨텍스트 문서 라벨과 질의가 한국어면 seed가 0개라서 검색이 성립하지 않는다.
- 목표: 검색 라벨을 만드는 쪽과 질의하는 쪽이 같은 영어 ASCII 어휘·앵커 문법을 쓰도록 규칙과 지침을 고정한다. 생성 구현은 후속 wave가 맡는다.

## Success criteria
1. `rules/okf.md`가 앵커 문법을 `epic-<ddd>` / `bp-<ddd>-<ddd>` / `task-<ddd>-<ddd>-<ddd>`로 명시하고, 콜론 형식이 왜 금지인지 근거를 적는다.
2. `CLAUDE.md` 하드룰 8, `rules/okf.md`, `references/spec-authoring/index.md` 세 문서가 각각 같은 필드 목록(`description`·`tags`·파생 앵커·검색 질의 = 영어 ASCII)과 같은 예외(`title` = 한국어, 커밋 제목 원천)를 진술하고, 문서별 단언이 세 진술을 각각 고정한다.
3. `references/graphify-runner/index.md`가 영어 query·seed 생성을 지시하고, 그 문서의 query 예시 문자열에 한글이 없다.
4. 고정한 앵커 세 종이 `tokenize()`에서 각각 길이 1의 토큰 배열로 남고 콜론 형식은 두 토큰으로 쪼개진다는 테스트가 있으며, `rules/okf.md`의 문법 진술 자체도 단언으로 고정된다.
5. `npm test`가 통과한다.

## Out of scope
- `context-digest.ts`의 앵커 헤딩 생성과 `## Touch` 경로 승격 — Wave 2가 맡는다.
- `tokenize()` 확장이나 한국어 토큰 지원 — 확정 방침은 토크나이저를 건드리지 않는 것이다.
- 기존 컨텍스트 문서 435개의 frontmatter 일괄 정리 — Wave 4가 맡는다.
- cross-file 엣지 주입, 구조 순회, `path A B`, community 재계산 — 보류 lane이다.
- `.gitmessage` 커밋 제목 규약과 `title` → commit subject 경로 변경.

## Blueprints
* [영어 검색 계약 고정](blueprints/001-english-search-contract/index.md) - 언어 분리·앵커 문법·runner 질의 지침을 하드룰과 rules·references 문서에 확정하고 계약 테스트로 고정한다
