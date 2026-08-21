---
type: bouncer.tasks
title: 게이트 보증 문구 정정
description: README 보증 서술을 실제 강제 수준에 맞추고 CHANGELOG에 기록
resource: .bouncer/context/epics/042-gate-integrity/blueprints/001-gate-integrity/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T15:07:14.706+09:00'
bouncer:
  id: TASKS-003
  epic_id: '042'
  blueprint_id: '001'
  status: ready
  verify: npm run verify:strict
  commit_intent:
    - 'README가 코드로 강제되지 않는 수준을 보증한다고 적어 리뷰를 덜 하게 만듦'
    - '문구를 위협 모델 수준에 맞추고 하위 호환 파기를 기록함'
  affected_paths:
    - 'README.md'
    - 'CHANGELOG.md'
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T15:21:15.453+09:00'
    suggested_paths:
      - 'scripts/src/lib'
      - 'scripts/lib'
      - 'test'
      - 'hooks'
    basis:
      - graph: source
        status: reused
        query: 'evaluateCommit stagedFiles recordVerificationResult checkGate runtimePaths'
        result: '79 hits rolled up to scripts/src/lib (45), scripts/lib (34)'
      - graph: context
        status: updated
        query: 'commit scope gate verification evidence README security threat model'
        result: '8 hits, all under .bouncer/context/epics/040-scope-evidence and 009-subagent-model-config — no overlap with this blueprint'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
README가 보증한다고 적은 것과 코드가 실제로 강제하는 것을 일치시킨다. task 001·002로 두 게이트가 강해진 뒤에도 README는 여전히 가드가 막지 못하는 경로(스크립트 파일, `make commit`, plumbing 우회)를 언급하지 않는다. `docs/security.md`는 이미 그 수준으로 정직하므로 README를 거기에 맞추고, 두 수정과 하위 호환 파기를 CHANGELOG에 남긴다.

## Interface
- 제공:
  - README의 G13 서술은 "하네스가 실행하고 그 기록과 대조한다"까지 적는다.
  - README는 두 표면을 구분해 적는다. PreToolUse 가드의 검사 대상은 스테이징 경로와 `-a` 계열 커밋의 추적 중 수정 파일이고, commit 게이트 G17의 검사 대상은 스테이징 경로다. 가드가 막지 못하는 경로는 `docs/security.md`로 연결한다.
  - CHANGELOG `## [Unreleased]`에 두 수정과 하위 호환 파기를 적는다.
- 거부:
  - 게이트 코드 번호나 CLI 명령 이름을 바꾸지 않는다. 문구만 고친다.
  - 아직 강제되지 않는 것을 새로 보증하지 않는다. 위협 모델을 넘어서는 문장은 넣지 않는다.
  - 버전 번호를 내리지 않는다. 1.0.0 표기는 유지한다.

## Touch
- Modify `README.md` — G13·G17 서술과 "증적이 주장을 이긴다" 문단을 실제 보증 수준으로 고치고 위협 모델 링크를 붙인다.
- Modify `CHANGELOG.md` — `## [Unreleased]`에 Fixed 항목 둘과 하위 호환 파기 안내를 추가한다.

## Do not touch
- `docs/security.md` — task 001이 같은 릴리스에서 고친다.
- `docs/gates.md` · `docs/ARCHITECTURE.md` · `docs/troubleshooting.md` · `docs/compatibility.md` — task 002 소관이다.
- `package.json` · `plugin.json` · `.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json` — 버전 표기는 이번 epic 범위 밖이다.
- `scripts/` · `hooks/` · `test/` — 문서만 바꾸는 커밋이다.

## Constraints
- README와 `docs/security.md`가 같은 사실을 두 번 적지 않는다. README는 요약하고 세부는 링크한다.
- 한국어 본문을 유지한다. 게이트 코드·경로·명령은 그대로 둔다.
- CHANGELOG는 Keep a Changelog 형식을 따르고 `## [Unreleased]` 아래에 쌓는다. 새 버전 헤딩을 만들지 않는다.
- 문서만 바뀌는 커밋이므로 테스트를 새로 만들지 않는다. 기존 문서 테스트가 참조하는 식별자(게이트 코드, 명령 경로)를 지우지 않는다.

## Checklist
- [ ] README의 G13 줄을 고친다. 하네스가 명령을 실행하고, execute·commit 두 게이트가 그 실행 기록과 문서를 대조한다는 것까지 적는다.
- [ ] README의 G17 줄을 고친다. G17은 게이트 판정이라 스테이징 경로만 본다고 적고, `-a` 계열까지 보는 것은 PreToolUse 가드라는 것을 별도 문장으로 적는다. `docs/gates.md`·`docs/compatibility.md`의 G17 서술과 어긋나지 않아야 한다.
- [ ] README의 원칙 문단("증적이 주장을 이긴다")에 가드가 막지 못하는 경로가 있다는 한 문장과 `docs/security.md` 링크를 넣는다.
- [ ] `grep -n "G13\|G17" README.md`로 남은 문장이 모두 수정 후 동작과 맞는지 확인한다.
- [ ] `CHANGELOG.md`의 `## [Unreleased]`에 항목을 추가한다.
  ```markdown
  ### Fixed

  - **`git commit -a` 스코프 우회** — …
  - **G13 증적 대조** — …

  ### Changed

  - 기존 저장소의 원장 없는 `verification.md`는 G13으로 실패합니다. `bouncer verify`를 다시 실행하세요.
  ```
- [ ] `npm run verify:strict`가 통과하는지 확인한다.
