---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-22T14:16:25.821+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '044'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: major
        status: resolved
      - id: CR-002
        severity: major
        status: resolved
      - id: CR-003
        severity: major
        status: resolved
      - id: CR-004
        severity: minor
        status: resolved
      - id: CR-005
        severity: minor
        status: resolved
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: minor
        status: resolved
      - id: CR-008
        severity: minor
        status: accepted
        note: >-
          조회는 blueprint 단위로 한 번 돌렸고 basis 세 문서가 같다. 003의 대상
          docs/ 는 config.source_dirs(scripts·hooks·test) 밖이라 source 그래프가
          구조적으로 낼 수 없는 경로다. 신호가 없다는 사실을 그대로 남기고,
          affected_paths 는 사람이 확정했다.
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
        severity: nit
        status: resolved
---
# Context review

## Findings

- **CR-001** (major, resolved) — 002 체크리스트의 `verifyExec` 스텁만으로는 기존
  `yes: true` 케이스가 살지 않는다. `fullBlueprint` 픽스처가 `.bouncer/config.json`을
  쓰지 않아 실행 전에 `readVerifyCommand`가 `VERIFY_CONFIG_MISSING`으로 끝난다.
  픽스처가 verify 명령을 선언하게 하는 항목을 앞에 추가했다.
- **CR-002** (major, resolved) — 003 체크리스트가 `protocol.md` 「한계」에 없는 항목을
  갱신하라고 지시했다. 그 관측은 `round-3/runs.md`에 있고 Do not touch다. 「한계」는
  항목 **추가**로, 표본 조항은 갱신이 아니라 **최초 확정**으로 바꿨다.
- **CR-003** (major, resolved) — 001의 비공허성 단언이 실제로 생기는 공허성(같은 샤드
  파일에서 기대값과 렌더가 함께 줄어드는 경우)을 막지 못한다. 주석을 그 단언이 실제로
  지키는 것(등록 샤드 누락)으로 고쳐 쓰고, 본문 손실은 테스트로 잡지 않는다는 사실을
  Interface 「남는 사각지대」로 명시했다.
- **CR-004** (minor, resolved) — 현재 코드는 `writeClosedLock`이 `staged` 계산보다
  앞선다. 브리프가 요구한 두 조건을 함께 지키려면 그 호출을 뒤로 옮겨야 한다는 점을
  Constraints와 체크리스트에 넣었다. 잠금만으로 커밋이 생기는 경우도 검증한다고
  명시했다 — 예외를 두면 「어떤 finalize 커밋은 검증되지 않는다」로 되돌아간다.
- **CR-005** (minor, resolved) — `cmdFinalize`에 try/catch가 없어 던지면 스택
  트레이스가 나온다. 세 해석 오류 모두 예외 대신 `code`를 실은 실패로 바꿨다.
  코드가 결과에 남으므로 `config.verify` 조용한 폴백과는 다르다.
- **CR-006** (minor, resolved) — 실패 형태를
  `{ ok: false, reason: 'verify', code, command, exitCode }` 하나로 통일하고 blueprint
  Contract와 task Interface를 같은 문장으로 맞췄다.
- **CR-007** (minor, resolved) — 3회차 파생값은 세 개가 아니라 121/121/126/135 넷이다.
  원 줄 수 146/146/151/160과 함께 고쳐 적었다.
- **CR-008** (minor, accepted) — 프론트매터 note 참고.
- **CR-009** (minor, resolved) — blueprint Documents가 002·003의 verification/review를
  빠뜨렸다. 세 묶음을 모두 나열했다.
- **CR-010** (minor, resolved) — epic 성공 조건 1을 샤드 **본문** 편집으로 한정했다.
  샤드를 추가·개명하면 `state.ids` 목록은 손으로 고치는 것이 맞다.
- **CR-011** (minor, resolved) — `docs/troubleshooting.md`를 002의 Touch와
  `affected_paths`에 넣었다. `reason: 'verify'` 중단이 사용자가 가장 자주 만날 새
  지점이다.
- **CR-012** (nit, resolved) — 001 체크리스트에서 `npm test` 항목을 마지막으로 옮기고,
  삭제 대상 주석이 배열 **안**에도 있다는 점을 적었다.
