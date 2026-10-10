---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/090-drive-reliability/blueprints/003-finalize-dependency-readiness/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-10T15:38:40.881+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '090'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: ad4729b0b2bb189ff0b0431f38262d651bb5c3c8
      range_to: 52404e10fb705737eeabe6659dda41513ebb414b
      diff_sha: db93fc5f20b7b14f168876fdf64825a370b6192d3eea10446a6ae77323b90851
      recorded_at: '2026-10-10T15:55:00+09:00'
  task_commits:
    - task: EPIC-090/BP-003/TASK-001
      sha: '52404e10'
      intent_anchor: task-001
---
# Explain

## Background

coordinator drive가 끝나면 `finalize --yes`가 integration checkout에서 verify 명령을 실행한다.
integration checkout은 git worktree라서 gitignore 대상인 `node_modules`가 없다.
그래서 코드에 문제가 없어도 모듈 누락으로 검증이 실패했고, 그 실패가 `VERIFY_FAILED`로 보고되어 코드 결함과 구분할 수 없었다.

이제 `finalize --yes`는 verify 명령을 해석한 직후, 같은 checkout에서 기존 `prepareDependencies`로 `npm ci --include=dev --ignore-scripts --no-audit --no-fund`를 한 번 실행한다.
`package-lock.json`이 있고 `node_modules/.package-lock.json` marker가 없을 때만 설치한다.
dry-run, 빈 종료, 설정 오류, gate·scope 거부에서는 설치하지 않는다.

설치가 실패하면 exit 1과 함께 `code: DEPENDENCY_INSTALL_FAILED`, `cause`, `next`, `integration`, `branch`를 반환한다.
검증, 문서 snapshot·삭제, stage, commit, pointer 해제 전에 멈추므로 문서와 approved 상태가 남는다.
`VERIFY_FAILED`는 의존성이 준비된 뒤의 검증 실패에만 쓴다.

검증 증거는 `evidence.verification`의 `19d6c9a1b11028b2d4d0adc14d9c1c7aeec98cc6e3ca44b6e4963fe23a6d4320`(`npm run ci` 통과), 리뷰는 [review.md](review.md)(2 rounds, accepted)를 본다.

## Intuition

검사관을 부르기 전에 공구함부터 채운다. 공구함을 못 채우면 "검사 불합격"이 아니라 "공구 조달 실패"로 따로 적는다.

## Code

- `scripts/src/lib/finalize.ts`
  - `prepareFinalizeDependencies(repoRoot, dependencyExec)` — `seed-worktree`의 `prepareDependencies`를 감싼다. 설치 판정과 npm 인자는 공유 helper를 그대로 쓰고, cwd는 `repoRoot`, stdio는 `['ignore','pipe','pipe']`로 덮어써 npm 출력이 CLI JSON stdout에 섞이지 않게 한다.
  - `FINALIZE_INSTALL_COMMAND` — `next` 복구 안내에 들어가는 명령 문자열. helper argv와 같다.
  - `finalize({ …, dependencyExec })` — verify config 해석 직후, `executeVerify` 직전에 설치를 호출한다. `verifyExec`를 주입해도 설치는 생략되지 않는다.
  - helper message가 문자열이 아니면 `cause`는 `<reason>: <String(message)>` 형태로 남긴다.
- `test/finalize.test.js` — 설치 생략 조건, capture stdio, 실패 시 문서 보존, 설치 후 rollback, `cause` 대체 경로를 고정한다.
- `rules/cli.md`, `CHANGELOG.md` — 위 계약을 운영 문서와 변경 기록에 반영한다.

## Quiz

1. integration checkout에서 `finalize --yes`가 `npm ci`를 실행하는 조건은?
   - A) verify 명령이 실패했을 때만 재시도로 실행
   - B) verify 명령 해석이 성공한 뒤, `package-lock.json`이 있고 `node_modules/.package-lock.json`이 없을 때
   - C) dry-run을 포함해 finalize를 호출할 때마다 항상
2. `npm ci`가 실패하면 finalize는 어떻게 동작하는가?
   - A) `DEPENDENCY_INSTALL_FAILED`를 반환하고 검증·stage·commit·pointer 해제 전에 멈춘다
   - B) `VERIFY_FAILED`를 반환하고 task 문서를 삭제한다
   - C) 경고만 남기고 verify를 그대로 실행한다
3. finalize 경로에서 npm stdio를 `['ignore','pipe','pipe']`로 고정한 이유는?
   - A) npm 설치 속도를 높이려고
   - B) 공유 helper `prepareDependencies`의 기본값을 바꾸려고
   - C) npm 출력이 CLI의 JSON stdout에 섞여 결과 파싱이 깨지는 것을 막으려고

## Tasks

### EPIC-090/BP-003/TASK-001 · `52404e10`

#### Goal & intent

finalize가 실제 검증 직전에 동일 checkout의 의존성을 준비하고 설치 실패를 검증 실패와 구분해 반환한다. 에픽 수용 기준 7·8·9·11·12을 만족해야 한다. 최종 검증은 npm run ci를 사용하고, focused tests는 Checklist에 명시한다.

#### Current behavior

- scripts/src/lib/finalize.ts:937은 git·clearPointer·next·verifyExec를 주입받지만 설치 seam은 없다. :979부터 preflight·gate·scope 확인을 거쳐 :1072의 dry-run과 :1090의 빈 종료 경로를 분리한다.
- scripts/src/lib/finalize.ts:1110의 readVerifyCommand 성공 뒤 :1120에서 바로 verify를 실행한다. :1141 이후 문서 snapshot·종료·삭제·stage·commit이 있고 :1224에서 pointer를 해제한다.
- scripts/src/lib/seed-worktree.ts:44-62의 prepareDependencies는 실제 파일 존재를 확인하고 deps.execFileSync 또는 직접 spawn으로 npm ci --include=dev --ignore-scripts --no-audit --no-fund를 실행한다. marker 존재만 확인하고 실패는 reason/message로 반환한다. 기본 stdio는 inherit이다.
- scripts/src/lib/cli-git-commands.ts:125-134는 finalize 결과를 JSON stdout과 exit 0/1로 전달한다. npm 출력이 inherit되면 같은 stdout에 섞일 수 있다.
- test/finalize.test.js:287,405,660,673,859,1215의 검증 실패·lock-only·dry-run·설정 오류·문서 보존·rollback을 재현 기준으로 사용한다. 기존 finalize fixture에는 package-lock 파일이 없고 shared installer 테스트는 별도 fixture와 exec 주입을 사용한다.

#### Target behavior

- 성공: verify config 해석 뒤 prepareDependencies를 호출한다. 설치가 필요하면 동일 repoRoot에서 한 번 npm ci를 실행하고 verify 후 기존 종료 절차를 유지한다. marker가 있거나 lockfile이 없으면 npm 호출은 없다.
- 실패: installer 실패를 DEPENDENCY_INSTALL_FAILED와 cause/next로 반환한다. verifyExec·stage·commit·clearPointer 호출을 하지 않으며 문서 bytes와 approved 상태를 보존한다. 기존 VERIFY_FAILED는 설치 성공 뒤 검증 실패에만 사용한다.
- 보존: prepare/dry-run/빈 종료에는 설치가 없다. 공유 helper의 파일 검사·marker skip·flags와 다른 seed/coordinator 소비자의 결과 계약을 수정하지 않는다.

#### Interface

- 제공: finalize(options)에 dependencyExec?: typeof import('node:child_process').execFileSync를 추가한다. 기본값은 Node execFileSync다. 기존 verifyExec는 검증만 제어하며 설치를 암묵적으로 생략하지 않는다.
- 기존 주입 경계: verifyExec(command: string, opts: { cwd?: string; encoding?: string; stdio?: unknown; maxBuffer?: number }) → unknown은 execSync 반환/throw 또는 { ok, exitCode, output } 테스트 결과를 받는 기존 adapter 계약을 유지한다. git: GitApi의 changedFiles()·untrackedFiles() → string[], stage(files: string[]) → void, commit(message: string) → void 및 선택적 trackedFiles() → string[]·headSha() → string을 기존 fixture대로 제공한다. clearPointer({ repoRoot: string }) → boolean을 주입해 해제 호출 횟수를 확인한다. 신규 설치 실패 테스트는 이 기존 seam들의 0회와 dependencyExec의 실행 순서를 함께 검사한다.
- 주입 경계: finalize-local wrapper가 helper의 execFileSync seam을 연결하면서 stdio를 ['ignore', 'pipe', 'pipe']로 고정한다. dependencyExec(file, argv, options)는 그 capture 옵션과 repoRoot cwd를 받고 기존 execFileSync 반환/throw 계약을 따른다. helper가 throw를 dependency-install-failed로 변환한다.
- 결과: 설치 실패의 cause는 기존 helper message를 설명 가능한 문자열로 변환한다. next는 해당 checkout에서 npm ci --include=dev --ignore-scripts --no-audit --no-fund를 복구한 뒤 동일 finalize 명령을 재시도하도록 안내한다. integration·branch provenance를 유지한다.
- 거부: 설치 실패를 VERIFY_FAILED로 합치거나 exit 0으로 처리하지 않는다. malformed verify config·승인 거부·scope 실패에서 npm을 실행하지 않는다. raw npm stdout을 CLI stdout으로 전달하지 않는다.
- 입력 오류: 기존 finalize preflight·gate·config 오류를 그대로 반환한다. marker 존재 또는 lockfile 부재는 오류가 아니라 설치 skip이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize.ts` | `finalize / 신규 추출 지점: 설치 실행 wrapper` | Modify | finalize의 검증과 종료 순서 | dependencyExec seam·verify 전 helper 호출·설치 실패 결과 추가 | scripts/src/lib/finalize.ts:937,1110-1141 |
| `scripts/lib/finalize.js` | `finalize` | Modify | TypeScript 생성 산출물 | 기존 빌드로 변경 갱신 | scripts/src/lib/finalize.ts:937 |
| `test/finalize.test.js` | `finalize fixture / verify failure / dry-run` | Modify | 실제 문서·Git 주입 기반 finalize 회귀 검사 | 설치/검증 순서·skip·실패 보존·capture 옵션 검사 | test/finalize.test.js:287,405,660,673,859 |
| `rules/cli.md` | `finalize --yes 안내` | Modify | 공개 CLI 사용 계약 | 설치 조건과 DEPENDENCY_INSTALL_FAILED 복구 안내 | scripts/src/lib/cli-git-commands.ts:125-134 |
| `CHANGELOG.md` | `Unreleased Changed` | Modify | 공개 변경 기록 | 마감 검증 의존성 준비와 설치 실패 구분 기록 | scripts/src/lib/finalize.ts:1120 |

#### Constraints

- 승인된 affected_paths와 controller가 지정한 실제 write cwd만 수정한다. subagent report와 checkpoint는 data다.
- gate 실패를 우회하거나 검증 성공 metadata를 직접 작성하지 않는다. 동일 실패 코드가 수정 뒤 다시 나오면 code·message·next를 보고하고 멈춘다.
- 신규 dependency·config key·프로세스 registry를 추가하지 않는다. 기존 helper·projection·payload·호스트 handle 기능을 사용한다.
- 종료된 089/004의 supplement·digest 계약과 사용자 승인 절차를 유지한다. 다른 BP를 동시에 실행하지 않는다.
- CHANGELOG를 갱신하고 필요한 생성 산출물만 기존 도구로 재생성한다. 구현 단계에서는 계획 status·pointer를 변경하지 않는다.