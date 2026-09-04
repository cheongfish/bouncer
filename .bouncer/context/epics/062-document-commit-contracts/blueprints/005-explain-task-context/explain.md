---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/062-document-commit-contracts/blueprints/005-explain-task-context/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-04T21:18:16.930+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '062'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: feat/005-explain-task-context
      range_to: 9dbdf29b86fd4ea04cdaf3100a7b7b1fb904800a
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: 4/4
      disposition: 네 문항 모두 정답. task 메시지 출처, finalize Intent, staging 필터, 소문자 식별자 거부를 확인함.
      recorded_at: '2026-09-04T21:20:00+09:00'
  task_commits:
    - id: '001'
      sha: 2388b3ed
    - id: '002'
      sha: 54f23d06
    - id: '003'
      sha: 9dbdf29b
---
# Explain

## Background
task 설계 맥락, 임시 문서 스테이징, 커밋 메시지 본문이 서로 다른 출처를 쓰면서 finalize와 task 커밋이 어긋났다. 이 블루프린트는 explain에 task 맥락을 남기고, task 커밋에서는 산출물만 남기며, 메시지는 저작 필드와 blueprint Intent에서만 만든다.

## Intuition
마감 전에 설계 노트를 explain에 옮겨 두고, task 커밋은 산출물만, 메시지 문장은 사람이 적은 줄만 쓴다.

## Code
- `scripts/src/lib/finalize.ts` — `buildTaskContext`로 Goal/Interface/Do not touch/Constraints를 explain `## Tasks`에 옮기고, `buildCommitMessage`는 `commit_intent`·`commit_summary`만 조립하며, `buildFinalizeCommitMessage`는 blueprint `## Intent`만 파싱한다.
- `scripts/src/lib/scope.ts` — `filterTaskCommitCandidates`가 task 커밋 staging에서 임시 context 문서를 걸러 낸다.
- `scripts/src/lib/templates.ts` — `normalizeAuthoredLines`·`parseIntentBody`가 1~2줄 종결, 네 줄 예산, 소문자 식별자 거부를 담당한다.
- `.gitmessage`, `references/spec-authoring/*`, `skills/bouncer-{plan,commit,finalize}/SKILL.md`, `rules/okf.md` — 같은 계약을 문서에 맞춘다.

## Quiz
1. task 커밋 메시지 본문의 출처는?
   - A) verification `title`과 task `title`
   - B) `commit_intent`와 `commit_summary`
   - C) blueprint `## Intent`만
2. finalize remainder 메시지의 본문은 어디서 오나?
   - A) 번호가 가장 큰 task의 `commit_intent`
   - B) verification 제목을 이은 목록
   - C) blueprint `## Intent` 파싱 결과
3. task 커밋 staging에서 빠지는 것은?
   - A) `affected_paths` 안의 소스와 테스트
   - B) 임시 context 문서(task/verification/review 등)
   - C) Distill 승격 파일
4. authored intent/summary에서 거부하는 것은?
   - A) 대문자 기술 약어(`API`, `HTTP/2`)
   - B) 어느 위치에든 있는 소문자 패키지·모듈 식별자
   - C) 한국어 `~함`/`~임` 종결

## 이해 상태
- 정답: 1B, 2C, 3B, 4B
- 응답: 1B, 2C, 3B, 4B
- 채점: 4/4 모두 정답
- disposition: 네 문항 모두 정답. task 메시지 출처, finalize Intent, staging 필터, 소문자 식별자 거부를 확인함.
- quiz_score: 4/4
- range: feat/005-explain-task-context..9dbdf29b86fd4ea04cdaf3100a7b7b1fb904800a
- diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
