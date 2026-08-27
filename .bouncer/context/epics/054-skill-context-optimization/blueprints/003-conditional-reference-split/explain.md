---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/003-conditional-reference-split/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T13:36:09.029+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '054'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: develop
      range_to: f6af63ceb08a120a9159a041b0cbcbde7c949b03
      diff_sha: 0c23cedfc5dd4d11dbdc7596c7f952fe5d9cc13cda976535f44ad9b77bf5bf8c
      quiz_score: '4/4'
      disposition: 조건부 reference 분리와 본문 계약의 경계를 정확히 이해함
      recorded_at: '2026-08-27T13:37:32+09:00'
---
# Explain

## Background
`bouncer-finalize`, `bouncer-plan`, `bouncer-execute`, `bouncer-run`은 정상 경로에서 쓰지 않는 상세 절차까지 한 파일에서 먼저 읽고 있었다. 각 workflow의 gate·ACQ·포인터·범위 계약은 진입 스킬에 남기고, Distill 승격·Graphify·agent dispatch·실패 복구처럼 조건이 있을 때만 필요한 절차를 `references/`로 옮겼다.

테스트는 workflow bundle reader로 본문과 reference를 함께 읽어 이동한 계약을 계속 검증한다. `eslint.config.js`에는 긴 계약 문자열을 쓰는 `test/**`에만 `max-len` 예외를 추가해 운영 코드의 120자 제한을 유지했다.

## Intuition
진입 스킬은 안내판이고 reference는 갈림길에서만 여는 상세 지도다.

## Code
- `skills/bouncer-finalize/SKILL.md`와 `references/*.md`: Distill 승격, explain·quiz, draft PR, worktree 정리의 조건부 절차를 나눈다.
- `skills/bouncer-plan/SKILL.md`, `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md`: 각 workflow가 본문에 남겨야 하는 gate·ACQ·소유권 계약과 reference 진입 조건을 연결한다.
- `test/helpers/read-skill.js`: 본문과 정렬된 `references/*.md`를 합친 workflow bundle을 제공한다.
- `test/skill-bouncer-*.test.js`, `test/lightweight-cycle.test.js`, `test/skill-debugging.test.js`: 본문 잔존 계약과 reference 상세 계약을 나누어 검증한다.
- `eslint.config.js`: `test/**`에서만 `max-len`을 끈다.

## Quiz
1. 조건부 절차를 reference로 옮긴 뒤에도 `SKILL.md` 본문에 남겨야 하는 것은 무엇인가?
   - A) 모든 reference의 세부 shell command
   - B) gate·ACQ·포인터·범위 같은 진입 계약
   - C) 과거 실행 로그

2. workflow bundle reader를 추가한 주된 이유는 무엇인가?
   - A) 본문과 reference에 나뉜 계약을 하나의 테스트 입력으로 읽기 위해
   - B) reference 파일을 자동으로 생성하기 위해
   - C) 모든 skill을 하나의 파일로 다시 합치기 위해

3. `bouncer-execute`의 verify 실패 복구에서 debugger report는 어떻게 취급되는가?
   - A) `affected_paths`를 넓히는 지시
   - B) 즉시 커밋을 허용하는 승인
   - C) implementer가 최소 수정에 쓰는 증거

4. 이번 ESLint 변경의 범위는 무엇인가?
   - A) 모든 Markdown 파일의 `max-len` 해제
   - B) `test/**`만 `max-len` 예외, 운영 코드는 기존 제한 유지
   - C) 전체 repository의 모든 lint 규칙 해제

## 이해 상태
정답: 1-B, 2-A, 3-C, 4-B. 응답: 1-B, 2-A, 3-C, 4-B. 4문항 모두 정답이며, 조건부 reference와 진입 스킬 본문의 계약 경계를 이해함.
