---
type: bouncer.epic
title: EPIC-013 comprehension-gate
description: BP 설명 문서와 이해 기록을 마감 게이트로 세움
resource: .bouncer/context/epics/EPIC-013-comprehension-gate/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-05T09:09:32.867+09:00'
bouncer:
  id: EPIC-013
  epic_id: EPIC-013
  status: approved
---
# EPIC-013 comprehension-gate

## Intent
- 문제: 에이전트가 만든 diff는 통과했다는 증거는 남기지만 이해했다는 증거는 남기지
  않는다. `verify`는 "동작하는가"만 증명하고(G13), 리뷰는 에이전트가 에이전트를
  검사한다(G8·G14). 사람이 그 변경을 실제로 이해했는지는 어느 문서에도 기록되지 않아,
  이해하지 못한 채 머지된 커밋과 이해한 커밋이 저장소에서 구별되지 않는다. 그 사이 BP
  `distill.md`는 근거 없는 회고로 남고 `G9`는 본문을 보지 않고 상태만 검사한다.
- 목표: BP `distill.md`를 변경 설명 문서 `explain.md`로 대체하고, 마감 게이트가 그
  문서와 사람의 이해 기록을 함께 요구한다. 인지 부채를 없앨 수는 없으므로 보이지 않는
  상태로 두지 않는 것을 목표로 한다 — 낮은 점수도 통과하되 커밋과 PR에 남는다.

## Success criteria
1. `bouncer scaffold explain --blueprint <dir>`가 OKF 프론트매터와 다섯 섹션 골격을 가진
   `explain.md`를 블루프린트 디렉터리에 만든다.
2. 다섯 섹션 중 하나라도 헤딩만 있고 본문이 비면 `validate --gate finalize`가 실패한다.
3. `bouncer.comprehension.diff_sha`가 게이트가 재계산한 `base..HEAD` 해시와 다르면
   `validate --gate finalize`가 실패한다. 해시 계산은 `.bouncer/context/` 아래 경로를
   제외한다.
4. `explain.md` 자신을 커밋에 포함해도 3의 해시가 변하지 않는다.
5. `quiz_score`가 `1/5`이어도 기록과 `disposition`이 모두 있으면 게이트를 통과한다.
   점수 비교로 실패를 만드는 경로가 코드에 존재하지 않는다.
6. `comprehension` 기록이 없거나 `disposition`이 빈 문자열이면 실패한다.
7. `distill.md`와 `G9`가 사라지고, 갱신된 테스트로 `npm test`가 통과한다.
8. `/bouncer-finalize`가 `.bouncer/context/Distill.md`로 승격할 때 `## 이해 상태`
   섹션의 내용을 옮기지 않는다.
9. PR 본문이 `explain.md`에서 생성되며 별도의 본문 저술 단계가 없다.

## Out of scope
- 이해 게이트의 옵트아웃. `review.required === false` 같은 탈출구를 만들지 않는다. 큰
  변경일수록 그것을 쓰게 되고, 그것이 정확히 이 게이트가 막으려는 경우다.
- 점수 임계값에 의한 차단. 문항을 쓴 주체가 diff를 쓴 에이전트이므로 문항 품질을 신뢰할
  수 없다. 점수로 사람을 떨어뜨리는 판정은 만들지 않는다.
- `/bouncer-execute` 단계 배치. 리뷰 루프마다 diff가 바뀌어 설명 문서가 매번 낡는다.
- 프로젝트 `.bouncer/context/Distill.md`의 대체. 승격이 압축 지점이므로 구조를 유지하고
  소스만 `explain.md`로 바꾼다.
- HTML 산출물과 브라우저 인터랙티브 퀴즈. 마크다운 단일 산출물로 간다.
- 기존 에픽들에 남은 `distill.md`의 소급 마이그레이션. 남은 파일은 게이트가 참조하지
  않는다.
- diff 크기를 직접 재는 별도 게이트. 설명 가능성이 규모를 간접적으로 제한한다.

## Blueprints
* [BP 설명 문서 계약과 이해 게이트](blueprints/BP-001-explain-doc-contract/index.md) - `distill.md`를 `explain.md`로 교체하고 `scripts/src/lib`의 스키마·경로·템플릿·스캐폴드·검증에서 `G9`를 `G15`로 대체한다
* [explain-diff 스킬과 마감 배선](blueprints/BP-002-explain-diff-skill/index.md) - `skills/explain-diff/`를 신설하고 `/bouncer-finalize`가 설명 저술·퀴즈 채점·`comprehension` 기록을 그 스킬로 하게 한다
* BP-003 승격 규칙과 PR 본문 통합 (예정) - 승격 소스를 `explain.md`로 바꾸고 `## 이해 상태`를 승격에서 제외하며 PR 본문을 같은 문서에서 생성한다
