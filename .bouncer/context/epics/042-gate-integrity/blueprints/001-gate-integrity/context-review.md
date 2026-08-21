---
type: bouncer.context_review
title: 게이트 보증 복구 계획 정합성 판정
description: epic 042 / blueprint 001 계획 문서 판정 결과
resource: .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-21T15:07:14.638+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '042'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-01
        severity: major
        status: resolved
      - id: CR-02
        severity: major
        status: resolved
      - id: CR-03
        severity: major
        status: resolved
      - id: CR-04
        severity: major
        status: resolved
      - id: CR-05
        severity: major
        status: resolved
      - id: CR-06
        severity: major
        status: resolved
      - id: CR-07
        severity: minor
        status: resolved
      - id: CR-08
        severity: minor
        status: resolved
      - id: CR-09
        severity: minor
        status: resolved
      - id: CR-10
        severity: minor
        status: resolved
      - id: CR-11
        severity: minor
        status: resolved
      - id: CR-12
        severity: minor
        status: resolved
      - id: CR-13
        severity: minor
        status: resolved
      - id: CR-14
        severity: minor
        status: resolved
---
# Context review

## Findings
- CR-01 (major, resolved) — epic 성공 조건 1의 `deps` 주입이 `stagedFiles` 하나뿐이라, 포인터가 없어 `evaluateCommit`이 먼저 빠져나가면 조건이 참이 되지 않는다. 네 개를 모두 주입하도록 조건을 다시 썼다.
- CR-02 (major, resolved) — task 003이 README G17 줄에 `-a` 확장을 적으려 했으나 G17은 명령을 받지 않는 게이트 판정이라 스테이징만 본다. README를 PreToolUse 가드와 G17 게이트 두 문장으로 나누도록 Interface와 Checklist를 고쳤다.
- CR-03 (major, resolved) — commit 게이트는 G7의 status만 봐서 손으로 쓴 `verification.md`로 `/bouncer-commit`을 직접 열 수 있었다. 원장 대조를 execute와 commit 두 게이트에 넣도록 blueprint Contract와 task 002 Interface를 바꿨다.
- CR-04 (major, resolved) — `verifyLedgerPathFor`의 `unavailable` 분기를 덮을 `test/runtime-state.test.js`가 범위 밖이었다. Touch와 `affected_paths`에 추가했다.
- CR-05 (major, resolved) — "`-`로 시작하는 결합 단축 플래그의 `a`" 규칙은 `--amend` · `--author=` · `--allow-empty`를 all-flag로 읽는다. 롱 옵션은 `--all` 정확 일치로 제한하고 음성 테스트를 Checklist에 넣었다.
- CR-06 (major, resolved) — `git diff HEAD` 실패를 `evaluateCommit` 안에서 삼키면 `hooks/commit-safety.js`의 fail-closed 주석과 어긋난다. `stagedFiles`와 같이 예외를 전파하고 훅이 차단하도록 Interface와 테스트를 바꿨다.
- CR-07 (minor, resolved) — `output_sha`가 어느 문자열의 해시인지 모호해 YAML 왕복 정규화로 정상 verify가 실패할 수 있었다. 문서 재파싱 값 기준으로 못 박고 왕복 테스트를 Checklist에 넣었다.
- CR-08 (minor, resolved) — 성공 조건 5의 "`-am`이 목록에 없다"는 지금도 참이라 완료를 가릴 수 없다. 탐지 표에 무엇이 적히는지로 다시 썼다.
- CR-09 (minor, resolved) — `repro-g17.sh`는 저장소에 없고 인자 경로의 빌드 산출물을 읽는다. 판정 근거를 회귀 테스트로 옮기고 재현은 빌드·경로 전제를 적은 보조 단계로 내렸다.
- CR-10 (minor, resolved) — blueprint Documents가 001 묶음만 나열했다. 세 묶음을 모두 적었다.
- CR-11 (minor, resolved) — 커버리지와 `check:emit`을 게이트가 막는 것처럼 읽혔다. 실제 강제 지점(`npm run ci`, `.githooks/pre-commit`)을 Constraints에 명시했다.
- CR-12 (minor, resolved) — pathspec으로 좁힌 `-a` 커밋이 합집합 검사로 오탐 차단될 수 있다. blueprint 실패 모드와 `docs/security.md` 작업 항목에 더했다.
- CR-13 (minor, resolved) — 원장이 `.git` 아래라 새 클론·CI·다른 머신에서도 과거 task가 통과하지 못한다. 일회성 마이그레이션으로 읽히지 않게 task 002 Constraints를 넓혔다.
- CR-14 (minor, resolved) — 이 저장소가 자기 자신의 플러그인 루트라 이번 blueprint의 execute 게이트는 병합 전까지 옛 빌드를 돌린다. 성공 조건 3의 판정 주체를 단위 테스트로 명시했다.
