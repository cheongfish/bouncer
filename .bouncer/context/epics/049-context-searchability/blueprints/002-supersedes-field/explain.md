---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/049-context-searchability/blueprints/002-supersedes-field/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T10:52:45.374+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '049'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: a863fb3bbf584fd7c426cbb3db96f84108078f3c
      diff_sha: b905e4cbae8ca0ac7fc59b11f25eee12153ff6f8f62c5652dfcad36911987190
      quiz_score: '3/3'
      disposition: S27 거절 조건·스캐폴드 대상·부재 허용을 모두 맞춤
      recorded_at: '2026-08-25T10:54:29+09:00'
---
# Explain

## Background
프론트매터에서 값만 읽어 뽑을 수 있는 관계는 포함(epic→bp→task), 문서→코드 경로,
문서→후보 경로까지다. 결정→결정 계보는 빠져 있다. blueprint status에 `superseded`는
있지만 무엇이 무엇을 대체했는지 적을 칸이 없어서, Distill 과거 결정과 충돌할 때
매번 전문 검색에만 의존한다.

이번 PR은 epic·blueprint에 `bouncer.supersedes` 자리와 형식 검사(S27)만 넣는다.
값을 채우는 판단과 읽는 소비자는 나중 일이다. 기존 문서에는 소급하지 않는다.

## Intuition
주소록에 「이전 주소」 칸을 만든 것과 같다. 비어 있어도 되고, 형식만 맞으면
통과한다. 그 주소가 실제로 존재하는지는 이번 검사가 보지 않는다.

## Code
- `scripts/src/lib/schema.ts` — `isValidSupersedes` (부재·빈 배열·비공백 문자열 배열만 통과)
- `scripts/src/lib/scaffold.ts` — epic·blueprint에 `supersedes: []` (task 등에는 없음)
- `scripts/src/lib/validate-structural.ts` — epic·blueprint만 S27
- 문서: `docs/compatibility.md`·`docs/gates.md`·`docs/troubleshooting.md`의 S27,
  `rules/okf.md` Plan fields

## Quiz
1. S27이 거절하는 경우는?
   - A) 존재하지 않는 문서를 가리키는 경로
   - B) `supersedes`가 문자열이거나 원소가 빈 문자열인 배열
   - C) epic에 `supersedes: []`가 있는 경우

2. 스캐폴드가 `supersedes: []`를 넣는 문서 종류는?
   - A) epic과 blueprint만
   - B) epic·blueprint·tasks
   - C) 모든 OKF 문서 종류

3. 기존 epic·blueprint에 `supersedes` 키가 없을 때 구조 검사는?
   - A) S27로 실패한다
   - B) 마이그레이션이 빈 배열을 채운 뒤에야 통과한다
   - C) 통과한다 (부재는 허용)

## 이해 상태
- quiz_score: 3/3
- 정답: 1-B, 2-A, 3-C
- 응답: 1-B, 2-A, 3-C (전부 맞음)
- disposition: S27 거절 조건·스캐폴드 대상·부재 허용을 모두 맞춤
- range: develop..a863fb3bbf584fd7c426cbb3db96f84108078f3c
- diff_sha: b905e4cbae8ca0ac7fc59b11f25eee12153ff6f8f62c5652dfcad36911987190
