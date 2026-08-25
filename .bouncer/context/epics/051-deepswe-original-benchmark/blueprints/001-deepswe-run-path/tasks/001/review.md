---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-25T16:24:29.361+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '051'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - id: F001
        severity: major
        status: resolved
      - id: F002
        severity: major
        status: accepted
        note: >-
          브리프 Interface가 `metrics.json`과 `--task-id`를 단수로 못박고,
          Constraints가 태스크 10개 실행을 이 태스크 밖에 둔다. 표본 런의
          태스크별 metrics 이름·스키마는 계획 단계 몫이다.
      - id: F003
        severity: minor
        status: resolved
      - id: F004
        severity: minor
        status: accepted
        note: >-
          실패 경로에서 결과 경로를 만들면 재실행 충돌 거부와 부딪힌다.
          결과 경로는 완주한 런의 다섯 산출물만 담는다.
      - id: F005
        severity: minor
        status: resolved
      - id: F006
        severity: minor
        status: resolved
      - id: F007
        severity: nit
        status: accepted
        note: 브리프 거부 목록 밖이지만 동시 실행을 싸게 막고 실패가 시끄럽다.
      - id: F008
        severity: nit
        status: accepted
        note: 이 저장소 CI 호스트에서 `python3`는 `/usr/bin`에 있다.
      - id: F009
        severity: nit
        status: accepted
        note: 무해한 방어. 지우는 편익이 diff 값을 넘지 않는다.
      - id: F010
        severity: nit
        status: accepted
        note: 첫 실제 런에서 패키지 이름을 확인한다.
      - id: F011
        severity: nit
        status: accepted
        note: Pier가 자기 인자를 검증한다. 이중 검증은 최소성 사다리에 걸린다.
      - id: F012
        severity: nit
        status: accepted
        note: '`SKILL.md`는 affected_paths 밖이다. TASKS-003이 덮는다.'
---
# Review

## Findings
<!-- finding: id, severity, status. accepted이면 note 필수.
     severity: blocker | major | minor | nit
     status: resolved | accepted -->
- F001 (major, resolved): 산출물·패치 탐색이 클론까지 훑어 스위트가 실어 온
  `reward.json`/`*.patch`를 이 런의 것으로 오인할 수 있었다. `walk_outputs(root,
  skip)`로 클론 서브트리를 가지치기하고, 클론 픽스처가 결과 경로로 새지 않는
  회귀 테스트를 붙였다.
- F002 (major, accepted): 표본 런(`--n-tasks 10`)에서는 `metrics.json`이 나오지
  않는다. 브리프 Interface가 `metrics.json`과 `--task-id`를 단수로 두고
  Constraints가 10개 실행을 이 태스크 밖에 둔 결과다. 태스크별 metrics의
  이름·스키마는 계획에서 정한다.
- F003 (minor, resolved): 인터럽트 테스트가 `try/finally`만 고정하고 시그널
  핸들러를 고정하지 못했다. 종료 코드를 `128+signal`로 단언하고 SIGTERM(143)
  케이스를 더해, `signal.signal` 두 줄을 지우면 둘 다 실패한다.
- F004 (minor, accepted): 실패 경로에서 `run.log`가 작업 경로와 함께 사라진다.
  실패 시 결과 경로를 만들면 재실행 충돌 거부와 부딪히므로 그대로 둔다.
- F005 (minor, resolved): 산출물 이동 중 인터럽트가 반쯤 찬 결과 경로를 남겨
  같은 `--run-id` 재실행을 막았다. `staged` 상태와 `cleanup_results()`를 두어
  핸들러와 `finally` 양쪽이 이 런이 만든 미완성 결과 경로를 되돌린다.
- F006 (minor, resolved): measured 사본의 출처가 기록되지 않아 잘못된 트리를
  잰 결과와 구분되지 않았다. 고른 워크스페이스 경로와 패치 경로를 `run.log`에
  남긴다.
- F007 (nit, accepted): 작업 경로가 이미 있으면 거부하는 것은 브리프 거부 목록
  밖이지만, 동시 실행을 싸게 막고 실패가 시끄럽다.
- F008 (nit, accepted): 테스트가 `PATH`에 `/usr/bin:/bin`을 박는다. 이 저장소
  CI 호스트에서 `python3`는 거기 있다.
- F009 (nit, accepted): `sys.executable or "python3"` 폴백은 닿지 않지만 무해하다.
- F010 (nit, accepted): `pipx install pier-cli` 힌트는 첫 실제 런에서 확인한다.
- F011 (nit, accepted): `--n-tasks`/`--sample-seed`는 Pier가 검증한다.
- F012 (nit, accepted): `SKILL.md`가 새 스크립트를 적지 않았다. 그 파일은
  `affected_paths` 밖이고 TASKS-003이 덮는다.
