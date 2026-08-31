---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/060-graphify-search-quality/blueprints/001-context-first-ranking/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T13:19:41.735+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '060'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2b21c444df595b41a02cbc1397937cfdca6db86f
      diff_sha: aeb5ef01c539c489d9084d1fee3f0b1b3c2665f93d01373f0d414fbfe450477c
      quiz_score: '5/5'
      disposition: 역할별 그래프·context-first suggest·evidence 계약·고정 평가 임계치를 모두 맞춤
      recorded_at: '2026-08-31T13:21:00+09:00'
---
# Explain

## Background
`graphify-runner`는 source와 context에 같은 자연어 질의를 던진 뒤 hit을 디렉터리로 합쳤다. 테스트 심볼이 seed를 잡고, `scripts/lib` 같은 생성물이 후보에 섞이며, 정작 고칠 구현 파일이 빠졌다. 이 blueprint는 그래프를 역할별로 나누고, context seed로 구현·연결 테스트만 확장한 뒤 점수와 저신뢰 판정을 남긴다. 계획 단계의 `affected_paths`는 여전히 사용자가 확정한다.

## Intuition
과거 결정에서 심볼을 집어 올린 다음, 그 심볼이 가리키는 구현과 붙어 있는 테스트만 고른다. 품질이 안 되면 빈 목록과 이유를 내고 수동 탐색을 요청한다.

## Code
- `scripts/src/lib/graph-scope.ts` / `session-graph.ts` / `graph-exec.ts` — `test_dirs`·`exclude_dirs`, `graphify-out/test`, source 병합 후 exclude 제거
- `scripts/src/lib/graph-search.ts` — `bouncer graph-suggest` (context seed → 관계 확장 → 역할 점수·신뢰도)
- `scripts/src/lib/validate-structural.ts` — `scope_evidence.quality`/`candidates`, basis `test`, 저신뢰 시 빈 `suggested_paths`
- `references/graphify-runner/index.md`, `skills/bouncer-plan/SKILL.md` — sync → suggest → 후보 표시 → 사용자 범위 승인
- `test/fixtures/graph-search-quality.json`, `test/graph-search-quality.test.js` — 고정 corpus 회귀

## Quiz
1. 새 config의 `graphify.test_dirs`는 어디에 그래프를 쓰는가?
   - A) `graphify-out/test/graph.json` 전용 입력이다
   - B) `graphify-out/source/graph.json`에 합친다
   - C) context digest에만 넣는다

2. `bouncer graph-suggest`가 구현 후보를 고르는 출발점은?
   - A) source에 자연어 질의를 먼저 던진다
   - B) `exclude_dirs` prefix만 순회한다
   - C) context hit의 경로·심볼과 명시 `--seed`로 source 관계를 확장한다

3. `status: low-confidence`일 때 `suggested_paths`는?
   - A) high 구현 후보만 남긴다
   - B) 반드시 빈 배열이다
   - C) context 후보 path만 담는다

4. `scope_evidence`에 `quality`만 있고 `candidates`가 없으면?
   - A) S9/G4가 거절한다
   - B) legacy로 통과한다
   - C) runner가 candidates를 채운다

5. 고정 평가의 무연결 test-only 비율 분모가 0이면?
   - A) 지표를 건너뛰고 통과한다
   - B) generated 수로 대체한다
   - C) 평가 실패로 남긴다

## 이해 상태
정답: 1A, 2C, 3B, 4A, 5C. 응답: 1A, 2C, 3B, 4A, 5C. 점수 5/5. disposition: 역할별 그래프·context-first suggest·evidence 계약·고정 평가 임계치를 모두 맞춤.
