---
type: bouncer.epic
title: 워크플로 상호작용 다듬기
description: 퀴즈 규모 적응·그래프 근거 구조화·PR 확인 1회·디버거 에이전트
resource: .bouncer/context/epics/015-workflow-ergonomics/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-06T09:12:46.456+09:00'
bouncer:
  id: '015'
  epic_id: '015'
  status: approved
---
# 015 workflow-ergonomics

## Intent
- 문제: 루프의 사람·에이전트 접점 네 곳이 각각 어긋나 있다. 이해도 퀴즈는 변경 크기와 무관하게 같은 무게로 돌고, `graph.basis`는 자유 문장이라 무엇이 갱신되고 무엇이 실패했는지 기계가 못 읽고, PR은 승인 뒤에도 한 번 더 묻고, verify 실패 조사는 전담 에이전트 없이 컨트롤러가 직접 한다.
- 목표: 퀴즈는 diff 규모를 따라가고, `basis`는 그래프별 상태·질의·결과를 담은 레코드가 되며, PR은 승인 1회로 열리고, 근본원인 조사는 read-only `bouncer-debugger`가 맡는다.

## Success criteria
1. `explain-diff`가 diff 규모에 따라 1~10개의 3지선다 문항을 만들고, 정답 슬롯이 한 위치에 몰리지 않으며, `quiz_score`가 가변 M을 담은 `N/M`으로 기록된다.
2. `tasks.md`의 `bouncer.graph.basis`가 그래프별 엔트리 리스트(`graph`·`status`·`query`·`result`)를 받고, `status`는 `updated`·`reused`·`fail-skip`·`skip-disabled`·`missing` 다섯 값만 허용된다.
3. 기존 문자열 `basis`를 가진 문서가 S9·G4를 그대로 통과한다.
4. `/bouncer-finalize`에서 PR 승인 ACQ 한 번 뒤에는 추가 확인 없이 push와 draft PR 생성까지 진행된다.
5. `agents/bouncer-debugger.md`가 read-only 계약(파일 수정·커밋·상태 전환 금지)으로 존재하고, `/bouncer-execute`가 verify 실패 시 이 에이전트를 디스패치하며, 네임드 에이전트가 없는 호스트에서는 `debugging` 스킬 인라인으로 폴백한다.
6. 각 blueprint마다 `npm test`가 통과한다.

## Out of scope
- 퀴즈 점수를 마감 차단 조건으로 만드는 것 — G15는 기록과 `diff_sha` 일치만 본다.
- 퀴즈용 신규 CLI·채점 엔진·HTML UI.
- 커밋 ACQ(step 3)와 다음 blueprint ACQ(step 6) 완화.
- `bouncer-debugger`에 커밋·문서 상태 전환·프로덕션 코드 수정 권한을 주는 것.
- Codex 네임드 에이전트 라우팅 — 플러그인이 `agents/`를 배포하지 못하므로 기존 generic/inline 폴백을 유지한다.
- superpowers `root-cause-tracing.md` 등 보조 문서 복제.
- 버전 범프·릴리스 태그 — 관례대로 에픽 밖 별도 `chore` 커밋이 맡는다.

## Blueprints
* [diff 규모를 따르는 이해도 퀴즈](blueprints/001-adaptive-quiz/index.md) - `skills/explain-diff`가 문항 수를 diff에서 정하고 3지선다·정답 위치 분산·기록 위치를 규정한다
* [graph.basis 레코드화](blueprints/002-graph-basis-record/index.md) - `validate`·`scaffold`가 `basis` 엔트리 리스트를 받고 `graphify-runner`가 그래프별 상태·질의·결과를 적는다
* [PR 확인 1회](blueprints/003-pr-single-confirm/index.md) - `skills/bouncer-finalize` step 4에서 본문 확인 ACQ를 없애고 승인 뒤 바로 push·draft PR로 간다
* [bouncer-debugger 에이전트](blueprints/004-debugger-agent/index.md) - read-only 디버거 에이전트를 `agents/`에 추가하고 `debugging` 스킬을 4단계로 갱신해 execute verify 실패에 물린다
