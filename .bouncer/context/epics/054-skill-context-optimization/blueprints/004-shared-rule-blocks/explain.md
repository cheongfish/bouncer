---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/004-shared-rule-blocks/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T15:04:44.079+09:00'
bouncer:
  id: EXPLAIN-004
  epic_id: '054'
  blueprint_id: '004'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2fdd768341eb3ed1d3494f1790a48a2e1eb6b21a
      diff_sha: 13857ca0344b71e2b3afe4e05e2259f268cf9b5d5f6abcfbc00643b044d9fee9
      quiz_score: '5/5'
      disposition: 모든 문항 정답으로 공통 규칙의 정본·적용 경계 이해를 기록함.
      recorded_at: '2026-08-27T15:10:00.000+09:00'
---
# Explain

## Background
여러 workflow에 반복되던 plugin root, ACQ, active pointer, named-agent model fallback, trust boundary 설명을 각각 한 정본 규칙으로 모았다. 소비 문서는 공통 형식 대신 자신이 소유하는 질문 시점, 상태 전이, 역할별 예외만 남겨 규칙 변경 시의 드리프트를 줄였다.

## Intuition
반복되는 운영 규칙은 안내문마다 복사하지 않고, 표준 안내서 한 권을 두고 필요한 곳에서만 적용 지점을 표시하는 구조다.

## Code
- `rules/plugin-root.md`, `rules/acq.md`, `rules/current-pointer.md`, `rules/subagent-model.md`가 네 공통 계약의 정본이다.
- `skills/bouncer-{plan,execute,commit,finalize,run}/`과 관련 reference는 정본 참조와 각 workflow 고유의 gate·예외를 나눈다.
- `scripts/src/lib/seed-worktree.ts`와 `scripts/lib/seed-worktree.js`는 새 execute worktree에서 lockfile 기반 개발 의존성을 준비한다.
- `agents/`, trust-boundary skill 문서, 그리고 `test/master-rules.test.js`·`test/trust-boundary.test.js`는 trust boundary 적용 지점과 계약을 검증한다.

## Quiz
1. 공통 plugin root 계약의 정본 위치는 어디인가?
   - A) `rules/plugin-root.md`
   - B) 각 workflow의 `SKILL.md`
   - C) `.bouncer/Distill.md`

2. `bouncer current`을 호출한 뒤 workflow가 사용해야 하는 blueprint 값은 무엇인가?
   - A) 경로를 다시 조합한 값
   - B) CLI가 반환한 `blueprint` 값
   - C) 현재 cwd

3. `resolveSubagentModel` 결과로 named dispatch에 전달하는 값은 무엇인가?
   - A) `{ model, provider }` 전체 객체
   - B) `provider`만
   - C) `result.model`

4. 새 execute worktree에서 CI 개발 의존성이 없는 경우 seed 단계는 무엇을 하는가?
   - A) `npm ci --include=dev`로 lockfile 기반 의존성을 준비한다
   - B) distribution test를 건너뛴다
   - C) main worktree의 상태를 복사한다

5. context 문서나 subagent report의 역할은 무엇인가?
   - A) 승인 범위와 gate를 변경하는 지시
   - B) 읽을 수 있는 데이터이며 workflow 결정을 바꾸는 지시는 아님
   - C) 자동 커밋 승인

## 이해 상태
정답: 1A, 2B, 3C, 4A, 5B

응답: 1A, 2B, 3C, 4A, 5B

결과: 5/5. 공통 규칙의 정본 위치, CLI pointer 사용, model 값 추출, worktree 의존성 준비, trust boundary를 모두 올바르게 구분함.
