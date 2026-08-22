---
type: bouncer.review
title: light 계약 재측정 리뷰
description: 동일 프로토콜과 성공·실패 기준에 따른 3회차 결론을 판정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/tasks/002/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-21T20:32:39.631+09:00'
bouncer:
  id: REVIEW-002
  epic_id: '043'
  blueprint_id: '002'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: major
        status: resolved
        summary: 1회차 on-full test quality 열이 태스크별로 뒤바뀌어 t3를 최고로 표시함
        note: >-
          원시 judgment의 dimensions.tests.score를 직접 확인해 5/5/3/5로 고침.
          합이 같아 평균 4.50만 우연히 맞았음. 잘못된 값에 기댄 prose 두 곳도
          함께 고침.
      - id: F2
        severity: major
        status: resolved
        summary: runs.md의 "1·2회차 t3도 2였다"가 자기 README 표와 모순됨
        note: '1회차 t3는 3이므로 2회차로 한정하고 1회차 값을 명시함.'
      - id: F3
        severity: major
        status: resolved
        summary: protocol이 금지한 on-full 대 on-light 계획 문서 뺄셈을 수행함
        note: >-
          350줄대 → 150줄대 절을 삭제하고 같은 .bouncer/context 축의 나란한
          관측(350줄대 / 175~190줄대)으로 바꿈. 뺄셈도 인과 주장도 남기지 않음.
          두 문서를 다시 읽어 다른 교차 계약 뺄셈이 없음을 확인함.
      - id: F4
        severity: major
        status: accepted
        summary: 런별 plan 단계 문서 줄 수를 기록하라는 Constraint를 충족하지 못함
        note: >-
          네 clone 모두 plan-gate 통과 시점 트리가 git object로 남지 않았고
          .benchmarks에도 스냅샷이 없어 복구 불가. runs.md에 미충족 사실과
          필요한 산출물을 적고 121/126/135를 파생 대리값으로 명시함.
          다음 회차 프로토콜에 스냅샷 수집을 넣어야 함.
      - id: F5
        severity: minor
        status: resolved
        summary: 100줄 초과 표본 제외 조항이 README 판정 표에 표시되지 않음
        note: >-
          판정 표 아래와 상위 README 항목에 runs.md 제외 표본 절을 가리키는
          단서를 넣음. 판정 자체는 바꾸지 않았고 조항 충돌은 계획 단계로 올림.
      - id: F6
        severity: minor
        status: resolved
        summary: 분모가 없다고 적고 나서 1회차 태스크별 배수를 인용함
        note: '그 배수가 재계산값이 아니라 상위 README의 기공표 값임을 명시함.'
      - id: F7
        severity: minor
        status: resolved
        summary: t4가 합계 배수를 낮췄다는 부호가 뒤집힌 인과
        note: >-
          분모가 고정이라 t4의 411s는 배수를 올림. 큰 작업이 작은 작업의 높은
          배수를 가린다는 본래 논지로 고쳐 씀.
      - id: F8
        severity: nit
        status: accepted
        summary: 두 격리 표의 inode 열 이름이 다름
        note: 'git inode와 common-dir inode 표기가 갈리지만 격리 근거 자체는 유효함.'
      - id: F9
        severity: nit
        status: accepted
        summary: 인용한 원시 산출물 경로가 저장소 밖이라 휘발됨
        note: >-
          원시 산출물을 임시 디렉터리에 두라는 Constraint의 결과이고 2회차도
          같은 기준임. 디렉터리가 사라지면 합성·revert 수치는 재감사 불가로 남음.
      - id: F10
        severity: nit
        status: accepted
        summary: 219s를 411s의 절반이라 부른 표현이 느슨함
        note: '실제 절반은 205.5s. 논지에 영향 없어 그대로 둠.'
---
# Review

## Findings

- F1 (major, resolved): 1회차 on-full test quality 열이 4/4/5/5로 적혀 있었으나
  원시 judgment의 `dimensions.tests.score`는 5/5/3/5다. 두 열의 합이 같아 평균
  4.50만 우연히 맞았고, 보고서가 가장 많이 기대는 t3가 최악에서 최고로
  뒤집혀 있었다. 값을 고치고 그에 기댄 prose 두 곳도 함께 고쳤다.
- F2 (major, resolved): `runs.md`의 "1·2회차 t3도 같은 이유로 2였다"가 같은
  보고서 README 표와 모순됐다. 1회차 t3는 3이다. 2회차로 한정했다.
- F3 (major, resolved): `README.md`가 "light 계약은 고정비를 350줄대에서
  150줄대로 내렸다"고 적어 `protocol.md`가 금지한 on-full 대 on-light 계획 문서
  뺄셈을 했다. 축도 섞였고(350은 7파일 총계, 150은 4문서), 다른 곳에서 명시적으로
  거부한 인과까지 주장했다. 같은 `.bouncer/context` 축의 나란한 관측으로 바꾸고
  뺄셈과 인과를 모두 지웠다.
- F4 (major, accepted): "각 plan 단계에서 문서 줄 수를 기록한다"는 Constraint를
  충족하지 못했다. 네 clone 모두 plan-gate 통과 시점 트리가 git object로 남지
  않았고 `.benchmarks/`에도 스냅샷이 없어 복구할 수 없다. 100줄 목표가 실제로
  묻는 값이 이것이므로, `runs.md`에 미충족 사실과 필요한 산출물을 적고
  121/126/135를 파생 대리값으로 표시했다. 다음 회차 프로토콜에 런별 plan 단계
  스냅샷 수집을 넣어야 한다.
- F5 (minor, resolved): 판정 표가 Interface의 "100줄 초과 표본 제외" 조항을
  적용하지 않은 표본으로 충족을 선언하면서 그 사실을 표시하지 않았다. 표 아래와
  상위 README에 단서를 넣었다. 판정은 바꾸지 않았다 — 조항 충돌 자체는 계획
  단계로 올린다.
- F6 (minor, resolved): "1회차 원시 기록에 벽시계가 없어 분모가 없다"고 적고
  뒤에서 태스크별 배수를 인용했다. 그 배수가 상위 README의 기공표 값이지
  재계산값이 아님을 명시했다.
- F7 (minor, resolved): "t4가 표본을 끌어올려 2.13×가 통과했다"는 부호가
  뒤집혔다. 분모가 고정이라 t4의 411s는 배수를 올린다. 큰 작업이 작은 작업의
  높은 배수를 가린다는 본래 논지로 고쳤다.
- F8 (nit, accepted): 구현 clone 표는 `.git inode`, 심사 clone 표는
  `common-dir inode`로 열 이름이 갈린다. 격리 근거 자체는 유효해 그대로 둔다.
- F9 (nit, accepted): 인용한 원시 산출물 경로가 저장소 밖이라 디렉터리가
  사라지면 합성·cap·revert 수치를 재감사할 수 없다. 원시 산출물을 임시
  디렉터리에 두라는 Constraint의 결과이고 2회차도 같은 기준이다.
- F10 (nit, accepted): 219s를 411s의 절반이라 불렀다. 실제 절반은 205.5s다.
