---
type: bouncer.blueprint
title: 퀴즈·explain·PR의 drive 기록 제거
description: Finalize quiz asks only about changed product behavior, and explain, comprehension, PR, and the finalize digest stop carrying drive execution records.
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/001-quiz-explain-pr-drive-record/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - explain
  - quiz
  - comprehension
timestamp: '2026-10-02T15:39:23.973+09:00'
bouncer:
  id: '001'
  epic_id: '085'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 퀴즈·explain·PR의 drive 기록 제거

Epic: [085](../../index.md)

## Intent
finalize 퀴즈가 바뀐 제품 동작만 묻고, explain·comprehension·PR·finalize digest에서 점수와 drive 실행 기록을 없앤다. 옛 형식 explain은 그대로 finalize gate를 통과한다.

## Contract
- 인터페이스
  - `EXPLAIN_SECTION_DEFS`(`scripts/src/lib/comprehension.ts`)가 `background`·`intuition`·`code`·`quiz` 네 키가 된다. G16은 이 네 절만 필수로 본다.
  - `resolveComprehensionEntry`는 `range_from`·`diff_sha`만 필수로 본다. 반환 `entry` 타입에서 `quiz_score`·`disposition`이 빠지고, 원본 엔트리 객체는 그대로 돌려준다.
  - `bouncer scaffold explain` 템플릿에 `## 이해 상태`가 없다.
  - `finalize --yes`는 explain frontmatter에 `bouncer.coordinator`를 쓰지 않는다(`writeExplainCoordinator` 삭제).
  - `bouncer finalize prepare` digest에서 최상위 `coordinator`와 `tasks[].actual_paths`가 빠진다. `git.branch`는 drive일 때 계속 원장의 integration branch다.
- 데이터·상태
  - 새 comprehension 엔트리: `{ range_from, range_to, diff_sha, recorded_at }`. 퀴즈 점수·정답·응답·처분은 어디에도 저장하지 않는다.
  - 옛 엔트리의 `quiz_score`·`disposition`, 옛 본문의 `## 이해 상태`, 옛 frontmatter의 `bouncer.coordinator`는 읽을 때 무시한다.
- 수용 기준: epic 085 성공 조건 1–6과 9.
- 검증 명령: commit task는 `npm test`, 종단 TASKS-004는 `npm run ci`.
- 실패 모드·엣지 케이스
  - 사용자가 퀴즈에 답하지 않으면 지금처럼 finalize를 멈춘다. 점수 없이 넘어가는 경로를 만들지 않는다.
  - `range_from`이나 `diff_sha`가 비면 계속 G16 `explain comprehension record missing`이다.
  - 옛 explain에서 `## 이해 상태` 절은 따로 파싱되어 `## Quiz` 본문에 섞이지 않는다.
  - drive가 아닌 finalize는 checkout branch를, drive finalize는 원장 integration branch를 그대로 쓴다.
  - review finding `disposition`과 `LEGACY_SCAFFOLD_COMMENT_BODIES`의 옛 주석 문자열은 바뀌지 않는다.

## Out of scope
- coordinator 회차 계약 이전(epic 085 blueprint 002), validate hint와 `rules/gates.md` 삭제(blueprint 003)
- `finalize --yes` 결과 payload의 `coordinator`·`worktrees` 필드
- 과거 published `explain.md` 마이그레이션
- PR 템플릿 섹션 구조, 퀴즈 질문 수 규칙

## One-commit justification
- 세 commit task가 같은 계약(퀴즈는 기록하지 않고, explain과 PR은 drive 기록을 담지 않는다)의 CLI 쪽과 지침 쪽을 나눠 맡는다. 한쪽만 들어가면 지침과 gate가 서로 다른 필드 집합을 요구하므로 한 PR로 리뷰한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - G16 comprehension 계약 축소
* [Tasks 002](tasks/002/tasks.md) - finalize CLI의 drive 기록 제거
* [Tasks 003](tasks/003/tasks.md) - 퀴즈·explain·PR 지침 변경
* [Tasks 004](tasks/004/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
