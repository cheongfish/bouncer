---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/001-security-boundary-enforcement/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-09-03T13:23:41.491+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '061'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 74f24825b32ef9537be4dc483611fb1eee45e78c
      diff_sha: d772e9dd59df112f7ed279e4b6d35dbf84ad34c99390c48cb14615e46ea37b54
      quiz_score: 3/3
      disposition: 검증 argv 경계와 공통 commit 가드 계약을 퀴즈로 확인함
      recorded_at: '2026-09-03T13:24:40+09:00'
  task_commits:
    - id: '001'
      sha: 8b1493ef
    - id: '002'
      sha: 74f24825
---
# Explain

## Background

검증 명령이 셸 문자열로 돌아가고, CLI commit과 호스트 훅의 범위 판정이 갈라져 있었다. 이 blueprint는 두 경계를 각각 한 커밋으로 닫는다. 검증은 허용된 argv0만 `shell: false`로 실행하고, commit은 `checkCommitSafety` 하나로 staging 전에 거절한다.

## Intuition

문은 하나다. 검증은 셸을 거치지 않고, 커밋 범위는 훅 유무와 관계없이 같은 가드가 본다.

## Code

- `scripts/src/lib/verification.ts` — `parseVerifyArgv`, allowlist, `spawnSync`+`shell: false`
- `scripts/src/lib/config.ts` — `verify_allowlist` / `getVerifyAllowlist`
- `scripts/src/lib/commit.ts` · `commit-guard.ts` — `commitTask`가 `checkCommitSafety`만 호출
- `docs/configuration.md` · `docs/compatibility.md` — 설정 키와 호스트 집행 매트릭스
- 회귀: `test/verification-runner.test.js`, `test/cli-commit.test.js`, `test/commit-hook.test.js`, `test/commit-task.test.js`

## Quiz

1. 검증 명령이 프로세스를 시작하기 전에 거절되는 경우는?
   - A) 종료 코드가 0이 아닐 때
   - B) 셸 메타문자·파싱 실패·허용 목록 밖 argv0일 때
   - C) 출력이 1MB를 넘을 때

2. `tasks.bouncer.verify`의 plan/S12 검사와 런타임 `config.verify` allowlist의 관계는?
   - A) 둘 다 저장소 `verify_allowlist`만 본다
   - B) plan/S12는 기본 목록, 런타임 `config.verify`는 저장소 `verify_allowlist`를 본다
   - C) plan/S12만 저장소 목록을 보고 런타임은 검사를 건너뛴다

3. CLI `bouncer commit`과 호스트 commit 훅의 범위 판정은?
   - A) 각각 다른 허용 목록을 복제해 쓴다
   - B) 훅이 없으면 CLI는 범위 검사를 생략한다
   - C) 둘 다 `checkCommitSafety`의 `allow`·`violations`를 쓴다

## 이해 상태

- 점수: 3/3
- 응답: 1B, 2B, 3C (모두 정답)
- 정답: 1B (실행 전 거절), 2B (plan 기본 목록 / runtime 저장소 allowlist), 3C (공통 `checkCommitSafety`)
- disposition: 검증 argv 경계와 공통 commit 가드 계약을 퀴즈로 확인함
- range: `develop`..`74f24825` / diff_sha `d772e9dd…`
