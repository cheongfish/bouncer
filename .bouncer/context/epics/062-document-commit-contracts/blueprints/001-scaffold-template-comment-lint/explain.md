---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/001-scaffold-template-comment-lint/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T12:17:36.408+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '062'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 55753d9de7437a684f0cdf31e71f79b0e4ca287c
      diff_sha: 1050ff8d7e019e66322e79664a72447dcdcf564eeaed029ef760060389185952
      quiz_score: 3/3
      disposition: 세 문항 모두 정답으로 변경 계약을 이해함
      recorded_at: '2026-09-04T12:20:00+09:00'
  task_commits:
    - id: '001'
      sha: 55753d9d
---
# Explain

## Background
스캐폴드가 남긴 안내 주석과 TODO 플레이스홀더는 문서 저작이 끝난 뒤에는 남아 있으면 안 된다. 변경된 컨텍스트 문서만 검사해 기존 코퍼스를 건드리지 않고 누락을 CI에서 막는다. execute worktree에 Git-ignored 설정 파일이 없다는 정상 상태도 Distill 테스트가 전제하지 않도록 정리했다.

## Intuition
새 lint는 새로 포장한 상자만 검사하는 출고 검수다.

## Code
`scripts/check-context-comments.js`가 명시 파일 또는 Git 변경·미추적 파일 중 `.bouncer/context/**/*.md`만 고른다. `scripts/src/lib/templates.ts`와 생성 산출물 `scripts/lib/templates.js`는 스캐폴드 안내 주석의 정규화된 본문을 제공한다. `package.json`은 `lint:context-comments`를 CI에 넣고, `test/context-comments.test.js`와 `test/distill.test.js`가 변경 파일 선택과 설정 부재 동작을 고정한다.

## Quiz
1. 새 검사기가 인자 없이 실행될 때 검사 대상으로 고르는 것은?
   - A) 저장소의 모든 Markdown 문서
   - B) 기준 ref 이후 변경·미추적된 컨텍스트 문서
   - C) `templates.ts`만

2. 일반 저자 HTML 주석의 처리로 맞는 것은?
   - A) 템플릿 안내 주석과 일치하지 않으면 허용한다
   - B) 모든 HTML 주석을 오류로 처리한다
   - C) Git-ignored 설정 파일에서만 허용 여부를 읽는다

3. `test/distill.test.js`에서 제거한 의존성은 무엇인가?
   - A) fixture가 만드는 설정 파일
   - B) 기본값 폴백 테스트
   - C) 저장소의 Git-ignored `.bouncer/config.json`

## 이해 상태
정답: 1-B, 2-A, 3-C. 응답: 1-B, 2-A, 3-C. 세 문항 모두 정답이며 변경된 문서 선택, 저자 주석 허용, Git-ignored 설정 의존성 제거를 이해함.
