---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/029-gate-restructure/blueprints/001-comprehension-gate-move/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T13:20:37.604+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '029'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: d1c62aa67734ef2f7ec2b43169db1bb8be143aba
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: 마지막 엔트리 조회와 빈 quiz_score→incomplete를 맞춤
      recorded_at: '2026-08-12T13:21:44+09:00'
---
# Explain

## Background
task마다 이해 기록을 쌓고 commit G15가 그 엔트리를 찾아 해시를 보던 계약이
blueprint당 엔트리 하나로 줄어든다. 조회는 task 번호가 아니라 배열의
마지막 항목이고, `quiz_score`가 비면 기록으로 치지 않는다. finalize G16이
그 엔트리의 `diff_sha`를 `range_from..HEAD`와 직접 대조한다. commit 게이트
재정의(G17)는 다음 task다.

## Intuition
여러 장의 task 쪽지 대신 책상 위 마지막 한 장만 남기고, 마감 때 그 장의
해시가 실제 범위와 맞는지 본다.

## Code
- `scripts/src/lib/comprehension.ts` — `resolveComprehensionEntry`. 필수 필드
  `range_from`·`diff_sha`·`disposition`·`quiz_score`. `findComprehensionEntry` /
  `normalizeTaskKey` 삭제.
- `scripts/src/lib/validate.ts` — finalize 분기: 단일 엔트리 → `computeDiffSha`.
  계산 실패와 해시 불일치는 메시지 문자열이 다르다. commit G15는 조회만
  새 API로 맞추고 분기는 그대로 둔다.
- 회귀: `test/comprehension.test.js`, `test/validate-gates.test.js`.

## Quiz
1. `bouncer.comprehension`에 엔트리가 둘일 때 `resolveComprehensionEntry`는?
   - A) 첫 엔트리
   - B) task 번호가 포인터와 같은 엔트리
   - C) 마지막 엔트리

2. `quiz_score`가 빈 문자열이면?
   - A) 형식상 통과하고 G16이 해시만 본다
   - B) `incomplete` → 기록 없음으로 처리한다
   - C) `duplicate` 사유를 낸다

## 이해 상태
- 점수: 2/2
- Q1 정답 C / 응답 C — 맞음
- Q2 정답 B / 응답 B — 맞음
- disposition: 마지막 엔트리 조회와 빈 quiz_score→incomplete를 맞춤
