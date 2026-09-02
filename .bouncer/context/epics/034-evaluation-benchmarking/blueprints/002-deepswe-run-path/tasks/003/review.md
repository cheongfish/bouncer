---
type: bouncer.review
title: 003 review
description: Review for 003
resource: .bouncer/context/epics/034-evaluation-benchmarking/blueprints/002-deepswe-run-path/tasks/003/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-25T16:24:47.670+09:00'
bouncer:
  id: REVIEW-003
  epic_id: '034'
  blueprint_id: '002'
  status: accepted
  review:
    required: true
    findings:
      - id: F001
        severity: major
        status: resolved
      - id: F002
        severity: minor
        status: resolved
      - id: F003
        severity: minor
        status: resolved
      - id: F004
        severity: minor
        status: resolved
      - id: F005
        severity: nit
        status: resolved
      - id: F006
        severity: nit
        status: accepted
        note: >-
          값은 재현 대조로 실제 출력과 일치했고 축약은 `...`로 표시돼 있다.
          지어낸 증적이 아니라 편집상 축약이다.
      - id: F007
        severity: nit
        status: resolved
---
# Review

## Findings
<!-- finding: id, severity, status. accepted이면 note 필수.
     severity: blocker | major | minor | nit
     status: resolved | accepted -->
- F001 (major, resolved): bouncer arm 절차의 CLI 다섯 줄 중 `bouncer init`만
  실제로 돌았다. `scaffold blueprint`에 필수 인자 셋이 빠졌고, `validate`
  두 줄에 `--blueprint`가 없었고, `current --set`이 blueprint 디렉터리가 아니라
  태스크 문서 경로를 받고 있었다. 브리프가 CLI 경로를 이 문서에만 적으라고
  했으므로 문서가 유일한 출처인데 따라 치면 네 줄이 exit 2로 떨어졌다.
  블록을 다시 쓰고, 버려도 되는 저장소에서 전 구간을 실제로 실행해 확인했다 —
  세 게이트 호출이 usage 오류(exit 2)가 아니라 실제 게이트 판정(exit 1, G/S
  코드)까지 도달하는 것이 플래그가 맞다는 증거다. 리뷰가 함께 제안한
  `scaffold task --id 001` 추가는 반영하지 않았다. light blueprint가 이미
  `tasks/001/`을 만들어 그 명령이 "task directory already exists"로 거부되므로,
  더했다면 이 finding이 고치려던 결함을 그대로 되살렸을 것이다.
- F002 (minor, resolved): 공통 통제는 세 arm 모두 같은 Pier verifier가 판정한다
  했는데 bouncer arm 절차만 `/bouncer-commit`에서 끝나 인계 단계가 없었다.
  superpowers와 같은 형태로 커밋 diff를 패치로 뽑아 verifier에 넣는 줄을 더했고,
  게이트 통과는 사이클을 지켰다는 뜻이지 태스크를 풀었다는 뜻이 아님을 적었다.
- F003 (minor, resolved): "사람 개입 0회" 통제와 "`affected_paths`는 사람이
  확정한다"가 충돌했다. 0회는 에이전트 구제 기준이고 arm 셋업과
  `affected_paths` 확정은 그 밖이며, 후자는 vanilla에 대응물이 없는 arm 조건임을
  통제 절에 적었다.
- F004 (minor, resolved): 기록 값 표가 전부 병합 JSON에서 읽으라 하는데 vanilla
  절차가 러너에서 끝나 `bridge_pier.py` 명령줄이 이 문서에 없었다. 그 한 줄과
  러너가 두 산출물을 따로 남긴다는 설명을 vanilla 절차에 더했다.
- F005 (nit, resolved): `task_id` 행이 거부 조건의 출처를 틀리게 적었다. 실제
  대조는 `metrics.json`의 `task_id`와 Pier `reward.json`의 태스크 id 사이이고,
  `verdict.task_id`는 metrics 값에서 복사되므로 출력의 두 값은 어긋날 수 없다.
- F006 (nit, accepted): 인용한 `command -v`·`ls` 출력이 실제보다 축약됐다.
  값 자체는 재현 대조에서 일치했고 축약은 표시돼 있다.
- F007 (nit, resolved): "둘을 같이 주면 거부한다"의 "둘"이 `--n-tasks`/
  `--sample-seed`로 읽혔다. 배타 조합은 `--task`와 `--n-tasks`임을 문장을 갈라
  분명히 했다.
