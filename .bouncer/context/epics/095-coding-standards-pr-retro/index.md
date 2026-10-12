---
type: bouncer.epic
title: 공통 코딩 표준·테스트 신뢰성·PR 판단 자료·자동 retro
description: Give implementers and reviewers one canonical coding and test standard, add test-trust review and a test-name lint, require change diagrams and decision data in every PR, and run an evidence-based retro after finalize.
resource: .bouncer/context/epics/095-coding-standards-pr-retro/index.md
tags:
  - bouncer
  - epic
  - coding-standards
  - review
  - pull-request
  - retro
timestamp: '2026-10-12T10:47:02.727+09:00'
bouncer:
  id: '095'
  epic_id: '095'
  status: approved
  supersedes: []
---
# 095 공통 코딩 표준·테스트 신뢰성·PR 판단 자료·자동 retro

## Intent
동작 중심 테스트 문단이 implementer·reviewer·reviewer prompt·spec-authoring 네 곳에 복사돼 있고, reviewer는 테스트가 요구사항을 입증하는지 판단할 실행 근거를 받지 못하며, PR은 문서·설정·테스트 변경이면 그림 없이 나가고, 세션에서 드러난 문제를 규칙·검사 개선으로 잇는 경로가 없음.
이 epic은 공통 기준을 정본 하나로 모으고, red 실행 근거를 reviewer까지 전달하고, 테스트 이름 형식을 기계로 검사하고, 모든 PR에 변경 그림과 판단 자료를 넣고, finalize 성공 뒤 세션 근거 기반 retro를 자동으로 돌림.

요구사항 정의서(`requirements-coding-standards-pr-retro.md`)의 RT-01·RT-05 "finalize에서 자동 실행하지 않는다"와 §8 "회고 자동 실행" 제외 조항은 2026-10-12 사용자 결정으로 대체한다. retro는 finalize 성공 뒤 자동 실행되며, 결과는 후보 제안까지이고 finalize 완료를 막지 않는다.

```mermaid
flowchart LR
  S[공통 표준] --> I[구현 · Red run]
  I --> R[리뷰 · 테스트 신뢰성]
  R --> L[테스트 이름 검사]
  L --> F[finalize · PR 그림·판단 자료]
  F --> T[자동 retro 후보]
```

## Success criteria
1. `references/coding-standards/index.md`가 공통 코딩·테스트 기준과 한국어 주석·docstring 기준(Summary/Args/Returns)의 유일한 정본이다. "Assert observable behavior" 문단과 Summary/Args/Returns 기준 본문은 `agents/`, `references/`, `skills/` 아래 다른 파일에 남아 있지 않다.
2. `agents/bouncer-implementer.md`, `agents/bouncer-reviewer.md`, `references/review/assets/reviewer-prompt.md`, `references/spec-authoring/index.md`, `references/coordinator-cards/implement.md`가 `${BOUNCER_ROOT}/references/coding-standards/index.md` Read 참조를 갖고, `.codex/agents/*.toml`은 `mdToCodexToml(md)` 결과와 일치한다.
3. implementer 출력 계약에 `Red run` 칸이 있고, coordinator와 `/bouncer-execute`가 그 값을 reviewer 호출 slot에 넣는다. reviewer `correctness_tests` 판정 기준은 기대값의 요구사항 근거, mock 대체 범위, red 실패 이유를 보고, 실행 근거 없는 결함 검출 단정을 금지한다.
4. `test/*.test.js`의 모든 `test(`·`it(` 이름이 `<조건> → <결과>` 형식이고, 형식을 어긴 이름이 하나라도 있으면 `npm run ci`가 실패한다.
5. `draft-pr.md`와 PR 템플릿(`PR_TEMPLATE`, GitHub, GitLab)에 `변경 그림`·`변경 전후`·`되돌리기 · 영향 범위` 절이 있고, 문서·설정·테스트 변경에도 그림 생략 예외가 없다. 변경 전 결과가 없으면 "변경 전 결과 미관측"으로 적는다.
6. `bouncer retro sources`가 Claude Code·Codex·Cursor transcript 후보를 JSON으로 나열하고, 없거나 읽을 수 없는 출처는 이유와 함께 `skipped`로 표시한다. `bouncer retro read`는 세 형식의 transcript 하나를 `{ role, text }` 목록으로 정규화하고, 지원하지 않는 형식은 `unsupported-schema`와 종료 코드 1로 거절한다.
7. `/bouncer-retro`를 단독 호출할 수 있고, 각 후보는 세션 근거·기존 검사/규칙 적용 여부·수정 대상·예상 효과와 비용을 갖는다. 근거가 없으면 후보를 만들지 않으며, 실행은 파일을 쓰지 않는다.
8. `/bouncer-finalize`가 성공하면 retro가 자동 실행된다. retro 실패는 finalize 결과(`closed`, 성공 출력)를 바꾸지 않고, finalize가 실패하면 retro는 실행되지 않는다.
9. BP 001 CHANGELOG 항목에 agent md·TOML·reference의 변경 전후 줄 수(제거한 중복 대비 추가한 참조)를 적는다.
10. 각 BP는 CHANGELOG `[Unreleased]` 항목을 갖고, 변경한 TypeScript는 `npm run check:emit`을 통과하며, `npm run ci`가 통과한다.

## Out of scope
- 외부 `code-review`·PR 스킬과 전체 개발 흐름 도입
- reviewer의 직접 수정·커밋
- Distill 부활, 상시 기억 주입, retro 결과의 파일 저장
- retro의 자동 규칙·파일 변경, 의무 retro 게이트
- 모든 게이트에 뮤테이션 테스트 의무화, 딥 모듈 원칙 전면 리팩터링
- 자동 병합·사용자 승인 생략
- finalize digest 스키마(`pr.sections` 필드) 변경
- Mermaid 렌더링 검사 도구 추가
- 도입 효과의 수치 목표·측정 표본(후속 벤치마크)
- Epic 092 문서 재개방

## Blueprints
* [001 공통 코딩 표준과 테스트 신뢰성 리뷰](blueprints/001-coding-standards/index.md) - `references/coding-standards/index.md` 정본을 만들고 agent·reference 중복을 참조로 바꾸며, Red run을 implementer 보고에서 reviewer slot까지 잇는다.
* [002 테스트 이름 형식 검사](blueprints/002-test-name-lint/index.md) - `test/*.test.js` 이름을 `<조건> → <결과>`로 바꾸고 `npm run ci`에 이름 검사를 넣는다.
* [003 PR 변경 그림과 판단 자료](blueprints/003-pr-visual-evidence/index.md) - finalize PR 규칙과 템플릿에 필수 `변경 그림`·`변경 전후`·`되돌리기 · 영향 범위` 절을 넣는다.
* [004 세션 근거 retro](blueprints/004-retro/index.md) - `bouncer retro sources`·`retro read` CLI와 `/bouncer-retro` 스킬을 추가하고 finalize 성공 뒤 자동 실행한다.

## Execution order
BP 001 → 002 → 003 → 004 순서로 실행한다. 001이 정한 테스트 이름 규칙을 002가 기계 검사로 고정하므로, 003·004가 추가하는 테스트는 그 검사를 통과해야 한다. 네 BP가 CHANGELOG를 공유하므로 동시에 실행하지 않는다. BP 사이 순서는 운영 순서이며 task `depends_on`에 다른 BP를 연결하지 않는다.
