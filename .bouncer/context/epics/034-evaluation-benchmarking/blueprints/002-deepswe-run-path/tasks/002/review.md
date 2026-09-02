---
type: bouncer.review
title: 002 review
description: Review for 002
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/002/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-25T16:24:47.632+09:00'
bouncer:
  id: REVIEW-002
  epic_id: '034'
  blueprint_id: '002'
  status: accepted
  review:
    required: true
    findings:
      - id: F001
        severity: minor
        status: resolved
      - id: F002
        severity: minor
        status: resolved
      - id: F003
        severity: minor
        status: resolved
      - id: F004
        severity: nit
        status: accepted
        note: >-
          `--out` 파일 선점은 이미 거부한다. 같은 metrics 문서를 두 번 브리지하는
          경로는 러너가 만들지 않으므로 키 단위 방어는 값보다 표면이 크다.
      - id: F005
        severity: nit
        status: accepted
        note: >-
          CTRF의 skipped·pending 취급은 실제 산출물을 본 뒤 정한다. 지금 고르면
          보지 않은 모양에 맞추는 것이다.
      - id: F006
        severity: nit
        status: accepted
        note: '`SKILL.md`는 affected_paths 밖이다. TASKS-003이 덮는다.'
---
# Review

## Findings
<!-- finding: id, severity, status. accepted이면 note 필수.
     severity: blocker | major | minor | nit
     status: resolved | accepted -->
- F001 (minor, resolved): 브리프에 없던 동작 셋(`--metrics` 부재·파싱 실패
  거부, 보상 값 없는 reward 거부, 통과 플래그가 없을 때 `reward > 0`으로 판정)이
  테스트 없이 실렸다. 앞의 둘은 거부 표에 넣고, 값을 **베끼지 않고 유도**하는
  마지막 하나는 `1 → true`, `0 → false`, `-0.5 → false` 세 갈래로 따로 고정했다.
- F002 (minor, resolved): `pick()`이 한 단계 아래까지 훑어
  `{"metadata": {"score": 3}}`가 이 런의 보상으로, `{"tests": {"success": true}}`가
  통과 플래그로 잡힐 수 있었다. 태스크 id는 불일치 거부가 받아 주지만 보상과
  통과는 그대로 지어낸 verdict가 된다. 중첩 탐색을 `nested=True`로 옵트인하게
  바꿔 태스크 id에만 남겼고, 그 비대칭의 이유를 한국어 주석으로 적었다.
- F003 (minor, resolved): "verdict는 채점 입력이 아니다" 테스트가
  `build_scorecard`가 고정 키 dict를 내는 덕에 무엇을 넣든 통과해 동어반복이었다.
  병합 전 `metrics.json`도 같은 judgment로 채점해 `composite`·`objective`가
  똑같은 것을 단언하게 바꿨다.
- F004 (nit, accepted): 이미 `verdict`가 있는 metrics를 다시 브리지하면 조용히
  덮어쓴다. `--out` 파일 선점은 거부하지만 키는 보지 않는다.
- F005 (nit, accepted): `pass_fraction`이 CTRF의 `skipped`·`pending`을 실패처럼
  센다. 실제 산출물을 본 뒤 정한다.
- F006 (nit, accepted): `SKILL.md`가 `bridge_pier.py`를 적지 않았다. 그 파일은
  `affected_paths` 밖이고 TASKS-003이 덮는다.
