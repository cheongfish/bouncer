---
type: bouncer.blueprint
title: 실행 기록 보존과 예상 경로 정책, 조기 검증과 호스트 표면 정비
description: Preserve drive evidence for reproducible measurement, record instead of block out-of-expected paths in full drives, move test checks and baseline CI earlier, and pin host entry surfaces.
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/measure-scope-env-surface/index.md
tags:
  - bouncer
  - blueprint
  - drive-metrics
  - affected-paths
  - baseline-ci
  - host-distribution
timestamp: '2026-10-29T18:12:58.673+09:00'
bouncer:
  id: measure-scope-env-surface
  epic_id: plugin-surface-slimming
  blueprint_id: measure-scope-env-surface
  status: closed
  order: 2
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  supersedes: []
---
# 실행 기록 보존과 예상 경로 정책, 조기 검증과 호스트 표면 정비

Epic: [플러그인 표면 간소화](../../index.md)

## Intent
- full drive에서 예상 경로 밖이지만 금지선 안인 수정은 막지 않고 이유와 함께 원장에 기록하며, worker 보고 검사와 base CI 확인을 앞당긴다.
- finalize 정리 전에 리뷰·범위·충돌·repair 기록을 보존하고 문턱을 바꿔 재현하는 집계 스크립트와 호스트 진입 표면 계약 테스트를 더한다.

## Contract
- 공통 원장 데이터(작업 사이 계약). 001은 아래 모양을 데이터로만 읽고, 002·003이 쓴다.

```text
ReportDecision += unexpected_paths?: Array<{ path: string; reason: string }>   # 002
               += overlaps?: string[]            # 같은 drive의 다른 미통합 task id, 002
RepairDecision += unexpected_paths?: string[]    # final-review repair의 승인 범위 밖 새 경로, 002
BaselineDecision = { kind: 'baseline'; command: string; exit: number;
                     head: string; accepted: boolean; written_at: string }       # 003
```

- 인터페이스:
  - 001 `bouncer finalize` release-main의 metrics snapshot(`<git common dir>/bouncer/metrics-snapshots/<sha256>.json`)이 선택 키 `drive_record`를 싣는다. finalize digest도 같은 계산으로 최상위 `drive_record`를 낸다. 기존 `drive_issues`·`worker_tokens` 값은 바뀌지 않는다.
  - 001 `node scripts/measure-drive-records.js [--input <file|dir>]... [--sessions <file>] [--threshold <key>=<n>]... [--sweep <key>=<n>,<n>...]`: snapshot의 `drive_record`와 metrics 세션을 모아 범위·충돌·CI repair wave·비용 집계를 stdout JSON으로 낸다. 같은 입력과 문턱이면 바이트가 같은 출력을 낸다. 읽을 수 없거나 모양이 틀리거나 `drive_record`가 없는 snapshot은 `skipped[]`에 `invalid-json`·`not-snapshot`·`no-drive-record`로 남는다. `drive_record.review`는 blueprint 리뷰의 must_fix를 `resolved|accepted|deferred|open`별로 센다.
  - 002 commit 범위 판정(`checkCommitSafety`, CLI commit과 호스트 hook 공통): coordinator 원장 mode가 `full`일 때 ledger scope 밖 경로는 금지선과 겹치지 않으면 허용하고 `unexpected_paths`로 돌려준다. 겹치면 `scope-do-not-touch-violation`으로 막는다. 금지선은 integration checkout task 문서의 `## Do not touch`다. worker 사본은 쓰지 않는다. commit, report, final-review 판정이 같은 출처를 쓰고, 읽지 못하면 `scope-do-not-touch-unreadable`로 막는다(fail closed). 해제는 지금처럼 integration cwd의 `coordinate revise --release-do-not-touch`가 그 사본을 고친다. light 원장과 coordinator 없는 commit은 지금처럼 `out-of-scope`로 막는다.
  - 002 `coordinate report --outcome accepted`(full): worker 커밋의 scope 밖 경로마다 보고 `## Unexpected paths`의 `` - `<path>` — <reason> `` 줄을 요구하고, 빠지면 `unexpected-path-reason-missing`으로 거절한다. 같은 drive의 다른 미통합 task scope와 겹치면 `overlaps`에 기록하고 거절하지 않는다.
  - 002 final-review repair의 `--new-path`는 어느 task의 Do not touch와도 겹치지 않으면 접수되고 repair 결정에 기록된다. 겹치면 `final-review-repair-do-not-touch`다. `final-review-repair-scope` reason은 없어진다.
  - 003 `coordinate report --outcome accepted`(full, commit task, `scoped_terminal`): 보고 `## Tests`가 task `bouncer.verify` 명령과 통과 결과를 담지 않으면 `report-tests-invalid`(`problem`, `expected_command` 포함)로 거절한다. fan-in 검사는 그대로 남는다.
  - 003 config `worktree.baseline`: 선택 키이고 단일 허용 명령이며, `worktree.setup`과 같이 main checkout config에서 읽는다.
    - 통과하거나 수락된 baseline 결정이 아직 없으면 `coordinate prepare`가 worker 생성 전에 integration 의존성을 준비하고 이 명령을 30분 시간 초과로 실행해 `BaselineDecision`을 덧붙인다.
    - 실패하면 `baseline-ci-failed`로 멈추고 worker를 만들지 않는다. `--accept-broken-baseline`을 붙인 재실행만 `accepted: true`로 기록하고 진행한다.
    - 미설정이면 실행하지 않고 플래그는 무시한다.
    - 요약은 마지막 baseline 결정을 쓴다.
  - 003 `coordinate prepare`: `package.json`에 `scripts.build`가 있는데 `worktree.setup`이 없으면 결과 `warnings`에 `worktree-setup-unset`을 싣는다.
  - 002 내부 필드 이름: `checkCommitSafety` 결과의 이탈 목록 키는 `unexpected`이고, 공개 `bouncer commit` 출력 키는 `unexpected_paths`다.
  - 004 `docs/install.md` Cursor commit 가드 문장은 002의 판정(원장 scope 기준, full은 금지선만 deny, 읽기 실패 fail closed, light·standalone 불변)을 서술한다. 경로가 겹치지 않아 병렬로 돌지만, 내용은 002에 묶여 있고 종단 검증 전에 함께 통합된다.
  - 004 테스트가 `agents/*.md`·`NAMED_AGENTS`·`.codex/agents/*.toml`의 집합 일치와 전 역할 생성본 일치, Cursor·Codex 매니페스트가 4개 진입 skill만 노출함을 고정한다. `docs/install.md`의 낡은 진입 skill 수와 Cursor 회고 대체 경로 안내를 고친다.
- 데이터·상태: 원장 결정은 위 선택 필드만 늘고 기존 필드는 그대로다. snapshot `version`은 1로 두고 `drive_record` 부재를 유효하게 읽는다. explain.md에는 실행 기록을 싣지 않는다(`skills/bouncer-finalize/references/explain-quiz.md:11` 유지).
- 수용 기준: task별 기준은 각 Goal & intent에 두고, epic 기준과는 아래처럼 대응한다.
  - epic 기준 2 "측정과 평가" → 001
  - "범위와 충돌" → 002
  - "조기 검증과 환경" → 003
  - epic 기준 1의 호스트별 배포·대체 경로 확인 → 004
  - epic 기준 2의 순서 제약("리뷰 증거 보존은 리뷰 효과 측정보다 먼저")은 001이 보존을 만들고 측정은 이 PR 뒤 ablation 절차로 하므로 지켜진다.
- 검증 명령: 001 `node scripts/verify-drive-records.js`, 002 `node scripts/verify-expected-paths.js`, 003 `node scripts/verify-early-checks.js`, 004 `node scripts/verify-entry-surface.js`. 종단 005는 `npm run ci`다.
- 실패 모드·엣지 케이스:
  - Do not touch 위반, worktree·revision 경계(`coordinator.reason`), verification task commit, cross-drive 충돌은 계속 commit을 막는다. 판정 순서는 경계 → Do not touch → scope 밖 기록 → cross-drive다.
  - 병렬 충돌 회복: 감지는 세 시점이다. commit 때 다른 drive와 겹치면 막는다(기존). report 때 같은 drive 안에서 겹치면 `overlaps`에 기록한다. fan-in cherry-pick이 충돌하면 기존 `revokeLease('fanin-conflict')`를 따른다. 이미 integration에 들어간 커밋은 되돌리거나 다시 쓰지 않는다. 충돌한 뒤 task는 revoke·salvage 뒤 새 integration HEAD에서 다시 dispatch하고, lease generation이 올라간다.
  - base가 이미 깨져 있으면 `baseline-ci-failed`가 원인 명령·exit를 남긴다. 그것을 받아들이는 결정은 사용자 몫이다(AGENTS.md hard rule 3).
    - CLI는 승인 증거를 검사하지 않고 플래그만 본다. 이 위험은 수용한다.
    - 근거 1: 수용은 원장에 `accepted: true` 결정과 실패 exit로 남아 리뷰와 `drive_record.baseline`에서 드러난다.
    - 근거 2: coordinator 역할 문서와 실패 힌트가 사용자 승인 뒤에만 플래그를 붙이게 한다.
  - `npm ci` 실패 시 worker를 만들지 않는 기존 동작(`seed-worktree.ts:457`, `coordinator-prepare.ts:962-971`)과 `worktree.setup`을 main checkout config에서 읽는 계약(`docs/configuration.md:13`)은 유지한다.
  - 집계 입력 중 깨진 JSON이나 다른 모양의 snapshot 파일은 조용히 버리지 않고 `skipped[]`에 경로와 이유로 남긴다. 없는 `--input`이나 깨진 세션 파일은 exit 1, 알려진 목록 밖의 문턱 키는 exit 2다.

## Out of scope
- light·direct-run 실행 통합, 복잡도 판정 개정, workflow 도구화, init 개선. 이들은 epic 기준 2 가운데 이 blueprint가 열지 않는 조각이고, 아직 계획되지 않았다.
- `docs/threat-model.md:10-11`의 commit guard 서술 갱신. 이 blueprint의 affected_paths 밖이라 알려진 후속 작업으로 남긴다.
- #295~#298에서 끝난 retro 이관, revise 합집합 기본값, 결합 경로 탐지의 재작업
- light 원장과 coordinator 없는 commit의 범위 정책 변경, G17(`validate-gates-run.ts`) 판정 변경
- worker별 coverage 측정. coverage는 종단 `npm run ci`에만 둔다.
- CHANGELOG·버전 필드 수정, 매니페스트 버전 변경
- 제안서 문서(`PLUGIN-SURFACE-SLIMMING-PROPOSAL.md`) 커밋, 과거 `.bouncer/context` 기록 수정
- `packages/cli/dist`, `scripts/lib` 생성물 편집

## One-commit justification
- 네 commit task는 제안서의 한 결론(범위는 예상 경로와 금지선으로 나누고, CI 실패는 앞당기고, 변경 효과는 보존한 기록으로 잰다)을 구현한다. 한 PR에서 같은 근거로 리뷰한다.
- 002·003은 `coordinateReport`와 보고 fixture를 함께 고쳐 직렬이다. 001·004는 경로가 겹치지 않아 병렬로 돈다. 종단 검증 하나가 전부를 묶는다.
