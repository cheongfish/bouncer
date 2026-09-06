---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/063-maintenance/blueprints/002-pending-task-comment-lint/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-05T23:01:52.610+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '063'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 5d8fb688df464f34470d6d1d5053f5ea73b8843d
      diff_sha: a9641bb9937ae9fdcf824fdf08fdf4ee4aafeda4c9cdc12c08caecfa7c07c0b4
      quiz_score: 1/1
      disposition: 활성 task unit만 검사한다는 경계를 이해함.
      recorded_at: '2026-09-05T23:02:33+09:00'
  task_commits:
    - id: '001'
      sha: 5d8fb688
---
# Explain

## Background

실행 worktree에는 아직 처리하지 않은 sibling task의 스캐폴드 문서도 함께 들어온다. 기존 lint는 이 문서를 현재 변경으로 판단해, 활성 task의 코드와 무관하게 CI를 실패시켰다.

## Intuition

현재 작업 묶음만 검사하고, 대기 중인 묶음은 실행 차례가 올 때 검사한다.

## Code

`scripts/check-context-comments.js`는 active pointer가 가리키는 task unit을 읽어 sibling task 문서를 걸러낸다. `test/context-comments.test.js`는 활성 문서의 주석은 실패하고 pending sibling 문서는 보고하지 않는지 확인한다.

## Quiz

1. active pointer가 있을 때 context-comment lint가 스캐폴드 주석을 검사해야 하는 대상은 무엇인가?
   - A) 모든 pending task 문서
   - B) active task unit 문서
   - C) 어떤 task 문서도 검사하지 않음

## 이해 상태

정답: B) active task unit 문서

응답: B

결과: 정답, 1/1. 활성 task unit만 검사하고 pending sibling은 실행 차례에 검사한다는 경계를 이해함.

## Tasks

### Task 001

#### Goal & intent

context-comment lint가 활성 task 문서는 계속 검사하고, 아직 실행하지 않은 pending sibling task의 스캐폴드 주석은 제외한다.