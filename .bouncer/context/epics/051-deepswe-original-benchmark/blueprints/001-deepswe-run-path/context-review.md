---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/051-deepswe-original-benchmark/blueprints/001-deepswe-run-path/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-25T16:24:29.361+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '051'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: blocker
        status: resolved
      - id: CR-002
        severity: blocker
        status: resolved
      - id: CR-003
        severity: blocker
        status: resolved
      - id: CR-004
        severity: major
        status: resolved
      - id: CR-005
        severity: major
        status: resolved
      - id: CR-006
        severity: major
        status: resolved
      - id: CR-007
        severity: major
        status: resolved
      - id: CR-008
        severity: major
        status: resolved
      - id: CR-009
        severity: minor
        status: resolved
      - id: CR-010
        severity: minor
        status: resolved
      - id: CR-011
        severity: minor
        status: resolved
      - id: CR-012
        severity: minor
        status: resolved
      - id: CR-013
        severity: nit
        status: resolved
      - id: CR-014
        severity: major
        status: resolved
      - id: CR-015
        severity: major
        status: resolved
      - id: CR-016
        severity: minor
        status: resolved
      - id: CR-017
        severity: minor
        status: resolved
      - id: CR-018
        severity: minor
        status: accepted
        note: >-
          러너는 002·003 모두에서 Do not touch라 열린 task가 고칠 수 없다.
          docstring이 가리키는 경로 정정은 다음 에픽이 진다.
      - id: CR-019
        severity: nit
        status: accepted
        note: >-
          한 task 한 커밋은 task당 커밋 수를 묶지 파일당 task 수를 묶지 않는다.
          두 편집은 같은 목록의 다른 줄이고 순차다.
      - id: CR-020
        severity: nit
        status: resolved
      - id: CR-021
        severity: minor
        status: accepted
        note: >-
          `sample.md`는 열린 task의 affected_paths 밖이다. 한계는 blueprint
          실패 모드에 적었고, 그 문서의 단서 추가는 다음 에픽이 진다.
---
# Context review

## Findings
- CR-001 (blocker, resolved) — metrics JSON을 아무도 만들지 않아 러너와 브리지가 이어지지 않음
- CR-002 (blocker, resolved) — 003이 results/에 쓰는데 affected_paths에 그 경로가 없음
- CR-003 (blocker, resolved) — Pier 샘플 목록을 실행 전에 얻을 방법이 없어 Checklist가 성립하지 않음
- CR-004 (major, resolved) — --arm이 필수인데 러너에서 아무 효과가 없고 bouncer arm은 pier run이 몰 수 없음
- CR-005 (major, resolved) — 수용 기준 1의 SIGINT 절반을 아무도 검증하지 않음
- CR-006 (major, resolved) — 003이 SKILL.md를 고치는데 그 단언을 든 테스트가 범위 밖
- CR-007 (major, resolved) — epic SC5와 003의 거부 조항이 서로 모순
- CR-008 (major, resolved) — blueprint 수용 기준 1이 존재하지 않는 run_deepswe.sh를 가리킴
- CR-009 (minor, resolved) — verdict 형태가 blueprint와 002에서 다름 (arm 유무)
- CR-010 (minor, resolved) — 러너 플래그의 필수/선택 구분과 --model이 blueprint에 없음
- CR-011 (minor, resolved) — pier run 예시에 -p가 두 번 나와 실행 불가능한 형태
- CR-012 (minor, resolved) — task_id가 null일 때의 동작이 정의되지 않아 대조가 무력화됨
- CR-013 (nit, resolved) — scorecard.py score 인용에 필수 --out이 빠짐

### 2차 (002 수정 판정)
- CR-014 (major, resolved) — 003 Checklist가 `git ls-files` 스캔이 낼 수 없는 관찰을 요구함
- CR-015 (major, resolved) — 표본 런이 metrics.json을 내지 않는데 계획 문서가 무조건 낸다고 읽힘
- CR-016 (minor, resolved) — 002의 commit_intent가 본문 수정을 따라오지 않음
- CR-017 (minor, resolved) — One-commit justification이 수정 전 002를 설명함
- CR-018 (minor, accepted) — 러너 docstring이 050의 protocol.md를 가리킴
- CR-019 (nit, accepted) — public-name-regression.test.js가 002·003 양쪽 affected_paths에 있음
- CR-020 (nit, resolved) — 002 Touch가 하드룰 9가 원할 이유 주석까지 막음
- CR-021 (minor, accepted) — sample.md의 `--n-tasks 10` 명령줄에 measured 한계 단서가 없음

## 반영 요지
- CR-001: 러너가 Pier 패치를 base 커밋 위에 얹은 사본에서 `collect_metrics.py`를
  돌려 `metrics.json`까지 내도록 001의 Interface·Touch·Checklist와 epic SC3에
  넣었다.
- CR-003: 샘플링은 `pier run` 안에서 일어나므로 이 blueprint는 10개를 돌리지
  않는다. `sample.md`는 seed 값과 명령줄, 그리고 id 목록이 어느 산출물에서
  언제 채워지는지를 담고 목록 칸은 비워 둔다. epic SC1을 그에 맞춰 고쳤다.
- CR-004: `--arm`은 라벨 전용이고 러너가 직접 모는 것은 vanilla arm뿐임을
  blueprint Contract·001 Goal·003 Arm 표에 명시했다.
- CR-007: epic SC5와 blueprint 수용 기준 7을 "시도의 명령줄과 결과가 남는다"로
  바꿔 003의 거부 조항과 일치시켰다. 위반은 합성한 결과 JSON을 두는 것뿐이다.
- CR-002·CR-006: `docs/benchmark/deepswe/results`와
  `test/skill-agentic-code-benchmark.test.js`를 003의 `affected_paths`와 Touch에
  더했다(사용자 확정).

### 2차 반영 요지
- CR-014: 003의 그 항목을 "문서를 만드는 커밋에 허용 목록 항목을 함께 넣고,
  확인은 목록에 경로가 들어갔는지로 한다"로 바꿨다. 002의 같은 항목은
  러너가 이미 tracked라 빨간 테스트를 실제로 볼 수 있어 그대로 둔다.
- CR-015: blueprint 실패 모드에 표본 런이 `metrics.json`을 내지 않는 이유와
  그 스키마를 다음 에픽이 정한다는 것을 적었다.
- CR-016·CR-017: 002의 `commit_intent` 둘째 줄과 One-commit justification에
  허용 목록 한 줄을 왜 002가 지는지를 넣었다.
- CR-020: 002 Touch를 "그 한 줄과 이유 주석"까지 허용하도록 고쳤다.
