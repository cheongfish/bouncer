---
type: bouncer.context_review
title: 설치 첫 5분 blueprint 계획 정합성 판정
description: bouncer-context-reviewer가 낸 13건에 대한 판정과 조치
resource: .bouncer/context/epics/059-audit-followup/blueprints/001-install-first-five-minutes/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-28T15:37:30.626+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '059'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-01
        severity: blocker
        status: resolved
      - id: CR-02
        severity: blocker
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
        status: accepted
        note: "성공조건 5~8은 blueprint 002~004가 가진다. 이번 회차는 첫 blueprint만 여는 것이 사용자가 확정한 범위이고, 에픽 `## Blueprints`에 그 소유 관계를 주석으로 남겼다."
      - id: CR-07
        severity: major
        status: resolved
      - id: CR-08
        severity: minor
        status: accepted
        note: "`RUNTIME_ARTIFACTS`의 `.bouncer/.venv/`는 그대로 둔다. 레거시 저장소와 CR-07의 비-git 폴백이 여전히 그 경로를 쓰므로 stale이 아니라 필요한 항목이다. task 002 Constraints에 명시했다."
      - id: CR-09
        severity: minor
        status: accepted
        note: "`test/agents.test.js`가 부르는 것은 `mdToCodexToml`과 `GENERATED_MARKER` 둘뿐이고, task 003은 신호 판정 함수를 더할 뿐 그 둘의 시그니처를 바꾸지 않는다. 그 금지를 task 003 Constraints에 적어 범위 밖 파일이 열리지 않게 했다."
      - id: CR-10
        severity: minor
        status: resolved
      - id: CR-11
        severity: minor
        status: resolved
      - id: CR-12
        severity: nit
        status: accepted
        note: "브랜치 ACQ를 더하면 스킬 하단 게이트 목록에 그 항목이 따라붙는 것은 같은 변경의 일부다. blueprint Out of scope의 ACQ 예외가 그 한 줄을 덮는 것으로 읽는다. 절차 개편은 여전히 blueprint 002 소관이다."
      - id: CR-13
        severity: nit
        status: resolved
---
# Context review

`bouncer-context-reviewer`가 에픽·blueprint·task 넷을 읽고 13건을 냈다. 근거는 모두 저장소에서 직접 확인했고, 여덟 건은 계획 문서를 고쳐 해소했으며 다섯 건은 근거를 적고 수용했다.

## Findings

- **CR-01 · blocker · resolved** — task 003이 opt-in 플래그를 `scripts/src/lib/cli-flags.ts`에 넣으라고 지시했지만 그 파일은 29줄짜리 범용 토크나이저이고, 명령별 플래그→`init()` 배선은 `scripts/src/lib/cli-project-commands.ts`의 `cmdInit`(`:340`~`:346`)에 있다. Touch와 `affected_paths`를 `cli-project-commands`로 옮기고 `cli-flags`는 손대지 않는다고 적었다.
- **CR-02 · blocker · resolved** — task 002가 `SUGGESTED_IGNORES`를 바꾸는데 그 목록을 이름으로 단언하는 `test/cli-init.test.js:52`가 범위에 없었다. 그 파일을 `affected_paths`와 Touch에 넣고 Checklist 항목을 더했다.
- **CR-03 · major · resolved** — `test/public-contract.test.js:113`이 `config.example.json`의 최상위 키 집합과 `docs/compatibility.md` 「설정 키」 표를 대조한다. task 001의 "예시를 바꾼다"가 키 삭제로 읽힐 여지를 없애고, 값만 바꾸며 키 집합은 유지한다는 거부 조항과 Constraints를 적었다.
- **CR-04 · major · resolved** — `scripts/src/lib/cli-current-command.ts:126`이 config에 `base_branch`가 없으면 `'develop'`으로 떨어진다. task 001이 탐지 실패 시 키를 비우기로 하면서 그 경로가 더 자주 밟히므로, 그 파일과 산출물·`test/cli-current.test.js`를 범위에 넣고 현재 브랜치 폴백으로 바꾸는 항목을 더했다.
- **CR-05 · major · resolved** — 감사 B4는 결함이 둘(설치 시도와 기록되는 `enabled`의 모순, 실패 잔해)인데 에픽 성공조건 4가 뒤의 하나만 담고 있었다. 조건 4를 둘 다 담도록 고치고 task 002 Interface에 일치 조항을 더했다.
- **CR-06 · major · accepted** — 에픽 Intent는 blueprint 넷을 약속하는데 `## Blueprints`에는 001만 있다. 이번 회차에서 첫 blueprint만 여는 것이 확정된 범위이므로, 성공조건 5~8의 소유 blueprint를 주석으로 남기고 각 회차에 줄을 더하기로 한다.
- **CR-07 · major · resolved** — venv를 git common directory 아래로 옮기면 `init`이 지원하는 비-git 디렉터리(`test/cli-init.test.js:44` 픽스처)에서 위치가 정의되지 않는다. 그 경우 기존 `.bouncer/.venv`로 폴백한다고 blueprint 실패 모드와 task 002 Interface·Checklist에 적었다.
- **CR-08 · minor · accepted** — 위 note 참조.
- **CR-09 · minor · accepted** — 위 note 참조.
- **CR-10 · minor · resolved** — 네 task가 `scripts/src/lib/init.ts`와 산출물을 공유하고 004가 003의 동작을 전제한다. blueprint One-commit justification에 커밋 순서 001→002→003→004와 재정렬 시 `npm run build` 재실행 필요를 명시했다.
- **CR-11 · minor · resolved** — blueprint `## Documents`에 task 002~004의 verification·review 링크를 더했다.
- **CR-12 · nit · accepted** — 위 note 참조.
- **CR-13 · nit · resolved** — 에픽 성공조건 2의 "묻는다"를 관측 가능한 산출물(`config.json` 키 부재, `init` 반환 JSON의 미해결 신호, `current --set`이 `develop`을 쓰지 않음)로 다시 적었다.
