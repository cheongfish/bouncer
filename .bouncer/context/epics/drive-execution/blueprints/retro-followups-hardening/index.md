---
type: bouncer.blueprint
title: 실행 회고 후속 보강과 인계 note 형식 검증
description: Close the retro candidates and reported risks left by retro-followups-coupled-paths, and validate the review-handoff note format in coordinate note.
resource: .bouncer/context/epics/drive-execution/blueprints/retro-followups-hardening/index.md
tags:
  - bouncer
  - blueprint
  - coordinate-note
  - review-handoff
  - coupled-paths
  - test-isolation
timestamp: '2026-10-29T14:26:10.155+09:00'
bouncer:
  id: retro-followups-hardening
  epic_id: drive-execution
  blueprint_id: retro-followups-hardening
  status: closed
  order: 74
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: bouncer-run 단계 동작(coordinate note·dispatch, direct-run 인계, 실행 문서)과 계획 점검 결합 경로 후속이라 drive-execution에 귀속
  supersedes: []
---
# 실행 회고 후속 보강과 인계 note 형식 검증

Epic: [drive-execution](../../index.md)

## Intent
- 직전 blueprint `retro-followups-coupled-paths`의 회고 후보와 보고된 위험을 테스트 격리, 역할 문서, 실행 문서, CLI 검증으로 닫는다.
- `bouncer coordinate note`가 `review-handoff:` 본문의 형식을 검사해 잘못된 인계 note를 원장에 남기지 않는다.

## Contract
- 인터페이스:
  - `bouncer coordinate note`: 앞뒤 공백을 뗀 본문이 `review-handoff:`로 시작하면 아래 두 형식 중 하나여야 한다. 아니면 `ok: false`, `reason: 'note-review-handoff-invalid'`로 거절하고 원장을 바꾸지 않는다. direct-run 인계에서 이 거절은 기존 Handoff 표 4단계의 "other `ok: false`: stop and report"대로 인계를 멈춘다(`direct-run.md`는 바꾸지 않는다). `review-handoff:`로 시작하지 않는 note는 지금과 같다.
  - `bouncer coordinate dispatch`: production 코드와 동작은 바뀌지 않는다. worker의 `.bouncer/runtime`이 쓰기 불가(`EACCES`)이거나 그 아래 `reports`가 대상 없는 symlink일 때도 `dispatch-report-dir-failed`로 거절하고 원장 bytes가 그대로임을 테스트가 고정한다.
  - `bouncer plan inspect --blueprint`: `coupledPaths.candidates`의 경로 문자열 일치는 경로 경계에서만 센다. `evidence.text`는 trim 뒤 앞 200 UTF-16 단위를 자르고, 마지막 단위가 상위 서로게이트면 그 한 단위만 더 뗀다. 출력 키와 타입은 그대로다.
  - 문서: `rules/cli.md`의 `plan inspect` 서술이 `coupledPaths`를, `coordinate note` 서술이 새 거절 reason을 담는다. `skills/bouncer-run/references/drive-metrics.md`의 인계 순서가 `direct-run.md` Handoff 표의 note 단계를 따른다. `agents/bouncer-implementer.md`가 brief 문장과 Checklist fixture·단언이 서로 다른 해석을 낳을 때 `Needs planning`으로 멈춘다는 문장을, `agents/bouncer-coordinator.md`가 제품 동작을 고치는 repair에서 회귀 테스트 파일을 `--paths`에 넣을지 판단하는 문장을 가진다. `coordinate note` usage 문자열의 거절 목록도 새 reason을 담는다.

```text
review-handoff: mode=<discovery|delta>; base=<sha>; head=<sha>; snapshot_id=<64 hex>; perspectives=<p1,p2,...>; files=<path>@<64 hex>,...
review-handoff: unavailable (<요약 1-200자, 줄바꿈 없음>); run discovery
  sha       = 40 또는 64 소문자 hex, base와 head는 같은 길이
  p         = REVIEW_PERSPECTIVE 값(combined|spec_scope|correctness_tests|minimality_maintainability|security), 중복 없음
  path      = .bouncer/runtime/print/review-handoff-<mode>-<p>.md (note의 mode와 같음)
  files     = perspective마다 정확히 하나
```

- 데이터·상태: 원장·task 문서 스키마는 바뀌지 않는다. 새 note 거절은 다른 note 거절과 같이 원장에 아무것도 쓰지 않는다. plan inspect는 계속 파일을 쓰지 않는다.
- 수용 기준: epic Success criteria 8·13이 참이다. 작업별 수용 기준은 각 task의 Goal & intent에 둔다.
  - 001: `test/`에 `'/tmp/unused'` 리터럴이 없고 두 테스트 파일이 통과한다.
  - 002: implementer 문서에 모호성 문장이, coordinator 문서 repair `--paths` 규칙에 회귀 테스트 판단 문장이 있고, 두 Codex TOML이 바이트 일치하며, 테스트가 두 문장을 고정한다. repair CLI 코드는 바꾸지 않는다.
  - 003: `drive-metrics.md` 인계 순서에 note 단계가 있고, `direct-run.md` Handoff의 실패 단계 문장과 표의 실패 열이 일치함을 테스트가 고정한다.
  - 004: 형식이 틀린 `review-handoff:` note는 `note-review-handoff-invalid`로 거절되고 힌트와 usage 거절 목록에 있으며, 맞는 note와 일반 note는 기록된다. `dispatch-report-dir-failed`의 `EACCES`·대상 없는 symlink 테스트가 있다.
  - 005: 경로 경계 밖 일치는 후보가 되지 않고, 근거 줄이 서로게이트 쌍을 자르지 않으며, `rules/cli.md`가 `coupledPaths`를 서술한다.
- 검증 명령: 작업별 래퍼(빌드 → task 테스트 → 정적 검사)는 001 `node scripts/verify-test-temp-dirs.js`, 002 `node scripts/verify-role-doc-rules.js`, 003 `node scripts/verify-handoff-order-docs.js`, 004 `node scripts/verify-coordinate-note-validation.js`, 005 `node scripts/verify-coupled-paths-noise.js`이고, 종단 검증 006은 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - `review-handoff:` 접두는 대소문자와 콜론까지 정확히 일치할 때만 검사 대상이다. `Review-Handoff:`나 `review-handoff` 뒤 콜론이 없는 본문은 일반 note다.
  - 길이 검사(`note-too-long`)가 형식 검사보다 앞선다. 2000자를 넘는 `review-handoff:` 본문은 `note-too-long`을 받는다. `direct-run.md` 4단계의 재시도 규칙이 그대로 동작한다.
  - CLI는 `files=` 파일의 존재나 sha256을 확인하지 않는다. 그 확인은 지금처럼 note를 읽는 coordinator 문서 규칙이 한다.
  - `mode=delta`에서 perspective를 `combined`로 강제하지 않는다. 형식 검사는 모양과 내부 일관성만 본다.
  - `EACCES` 테스트는 root 사용자와 Windows에서 건너뛴다(권한 비트가 거절을 만들지 못한다). 대상 없는 symlink 테스트는 Windows에서 건너뛴다.
  - 경로 경계: 일치 앞 글자가 경로·식별자 글자(`[A-Za-z0-9_$.\-/]`)이면 경계가 아니다. 단, 앞이 `./`이고 그 앞이 줄 시작이거나 경로 글자가 아니면 경계로 본다. 일치 뒤 글자가 `[A-Za-z0-9_$\-/]`이거나, `.` 뒤에 `[A-Za-z0-9_]`가 오면 경계가 아니다. 한 줄에 일치가 여럿이면 하나라도 경계를 만족할 때 그 줄을 근거로 쓴다. 그래서 `` `${root}/rules/cli.md` ``처럼 `/` 바로 뒤에 붙은 저장소 경로는 후보에서 빠진다. 후보는 advisory라 이 누락은 허용한다.

## Out of scope
- `affected_paths` 차단과 예상 경로 정책 완화, 탐지 결과의 범위 판정 사용
- `coordinate note`가 `files=` 파일을 읽거나 sha256을 검사하는 것
- `skills/bouncer-run/references/direct-run.md` Handoff 표와 `agents/bouncer-coordinator.md`의 `review-handoff:` note 소비 규칙 변경
- `coordinate repair`의 `--paths` 정규화 중복 제거(`packages/cli/src/coordinator-repair.ts:168`)와 repair CLI 코드 변경. 회고 후보 3은 coordinator 문서 규칙으로만 닫는다.
- CHANGELOG·버전 문서 수정
- 승인된 `worker-lint-check`·`model-dispatch-enforcement` blueprint의 범위

## One-commit justification
- 다섯 구현 task는 모두 한 회고(`retro-followups-coupled-paths` finalize)의 후속이라 한 PR 리뷰에서 같은 근거로 판정된다. 004와 005만 `rules/cli.md`를 함께 고쳐 직렬이고 나머지는 경로가 겹치지 않아 병렬로 돌며, 종단 검증 하나로 합쳐진다.
