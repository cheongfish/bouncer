---
type: bouncer.explain
title: repair-verify-pr-contract explain
description: Explain for repair-verify-pr-contract
resource: .bouncer/context/epics/drive-execution/blueprints/repair-verify-pr-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-30T13:47:52.173+09:00'
bouncer:
  id: EXPLAIN-repair-verify-pr-contract
  epic_id: drive-execution
  blueprint_id: repair-verify-pr-contract
  status: published
  comprehension:
    - range_from: 0c5981951e35348f90e5f40e3c6e19cad944b1d5
      range_to: a123d8d0c6325829f387503cd69a045e91be17ec
      diff_sha: 024e2fad71775bbcfe871131ad3deb38b2c8d15e2545318bb00ff108ba3c8021
      recorded_at: '2026-10-30T13:48:48.728+09:00'
  task_commits:
    - task: drive-execution/repair-verify-pr-contract/001
      sha: f1780ab2
      intent_anchor: task-001
    - task: drive-execution/repair-verify-pr-contract/002
      sha: a123d8d0
      intent_anchor: task-002
---
# Explain

## Background

`coordinate repair --verify`는 기록 전에 명령 형태만 보았다. 저장소 `verify_allowlist` 밖 실행 파일도 원장에 남을 수 있었다.

PR 초안 `finalize pr-body`는 근거가 없으면 `로직 흐름`을 생략했다. 변경 그림·전후·되돌리기 자리가 없어서 작성자가 빠진 절을 알아채기 어려웠다. worker note는 원문을 한 줄씩 풀었고, 종류가 달라도 같은 문장이면 출처를 잃을 여지가 있었다.

이 변경은 repair 입력을 S12와 같은 basename allowlist로 거절하고, PR 초안에 필수 세 절과 note 종류·출처를 남긴다.

## Code

핵심은 `packages/cli/src/coordinator-repair.ts`의 `checkRepairIntake`다. 누락·체인·종단 중복 거절을 먼저 두고, 남은 단일 argv에 `readVerifyPolicy`와 `isValidVerifyCommand`를 적용한다. argv0 basename이 목록 밖이거나 `readVerifyPolicy`가 `ok: false`이면 기록 전에 `repair-verify-not-allowed`다. 깨진 config는 기본 목록으로 넓히지 않는다. 사용자 `verify_allowlist`는 기본 목록과 합치지 않고 그 배열만 쓴다. `/usr/bin/node`는 `node`가 목록에 있으면 허용한다. `npm run ci`처럼 종단과 같은 명령은 기존처럼 `repair-verify-is-terminal`이다.

공개 힌트는 `packages/cli/src/coordinator-commands.ts`의 `COORDINATE_FAILURE_HINTS`에 둔다. 표를 repair 모듈로 옮기면 commands↔repair 순환이 생긴다.

PR 쪽은 `packages/cli/src/finalize-pr.ts`의 `renderPrBody`다. `주요 변경 내용` 뒤에 `변경 그림`, `변경 전후`를 두고, 확인 방법 앞에 `되돌리기 · 영향 범위`를 둔다. `--flow`가 있으면 `변경 그림` 아래 Mermaid, 없으면 세 절 모두 `<TODO: 작성 필요>`다. `pushWorkerNotePoints`는 `open_choices`와 `known_weaknesses`를 종류+원문으로 묶는다. 종류가 다르면 원문이 같아도 두 줄을 남기고, 같은 종류·같은 원문만 task id를 모아 한 줄로 쓴다. id는 digest `task.id`다. 원장을 읽지 않고 자동 번역하지 않는다.

검증 증거: 001 `4b0db036efbdd18b6083f9b7bae0e9b664bedfabc5e05beda032ff34191ff11c`, 002 `f74cc8a23577205997199f4d1e2d6a9ed971601e6cb623a5ba0dbfd510691358`, 003 `e9584ddc473ef2b9a03b99535613e87083673ec3732d989b3246372807bc698f`. 리뷰는 `review.md` 1 round.

## Quiz

1. `scoped_terminal`에서 `coordinate repair --verify curl …`이고 `curl`이 `verify_allowlist`에 없을 때?
   - A) `repair-verify-not-single-argv`로 거절한다
   - B) 원장에 기록한 뒤 경고만 남긴다
   - C) 기록 전에 `repair-verify-not-allowed`로 거절한다

2. integration `readVerifyPolicy`가 `ok: false`인데 `--verify` argv0가 기본 목록의 `node`일 때?
   - A) 기본 allowlist로 폴백해 허용한다
   - B) 기록 전에 `repair-verify-not-allowed`로 거절한다
   - C) `repair-verify-required`로 거절한다

3. `--verify`가 종단 전체 검증과 같은 `npm run ci`일 때?
   - A) 기존처럼 `repair-verify-is-terminal`로 거절한다
   - B) `repair-verify-not-allowed`로 거절한다
   - C) allowlist에 `npm`이 있으면 허용한다

4. `finalize pr-body`에 `--flow`가 없을 때 `변경 그림` 절은?
   - A) 절 자체를 생략한다
   - B) 제목 `변경 그림`과 `<TODO: 작성 필요>`를 낸다
   - C) 제목 `로직 흐름`으로 빈 절을 낸다

## Tasks

### drive-execution/repair-verify-pr-contract/001 · `f1780ab2`

#### Goal & intent

repair 입력에 저장소 검증 명령 정책을 적용한다. 허용되지 않는 명령은 기록 전에 거절하고 허용된 명령은 유지한다.

#### Current behavior

`checkRepairIntake`는 `packages/cli/src/coordinator-repair.ts:176`에서 argv 파싱만 검사하며 review와 CI 양쪽 호출은 각각 1306, 1396행에 있다. 원장 변경은 그 뒤에 일어난다. `test/cli-coordinate.test.js:1902`는 체인 거절을 재현하고 `test/coordinator.test.js:4215`는 intake의 경계값을 검사한다. 정책 기준은 `packages/cli/src/verification.ts:196` 및 `coordinator-baseline.ts:133`이다. 검사는 integration worktree의 설정 파일과 task 문서를 읽는다.

#### Target behavior

성공: 기본 또는 저장소별 allowlist에 허용된 단일 argv는 기존대로 기록한다. 실패: allowlist에 없는 argv0는 기록 전에 거절한다. S12와 같이 basename으로 판정하므로 `/usr/bin/node`는 기본 allowlist에서 허용한다. 보존: scoped 누락, 빈 값, 체인, 종단 명령 중복 및 legacy 누락의 기존 처리와 오류를 유지한다.

#### Interface

제공: integration worktree 저장소 설정의 `verify_allowlist`를 S12와 같은 판정에 사용한다. 거부: argv0의 basename이 allowlist에 없는 실행 파일은 `repair-verify-not-allowed`로 거절한다. 단일 argv가 아닌 입력은 기존 `repair-verify-not-single-argv`를 유지한다. argv0는 명령 첫 토큰이며 예시는 `node --test a`의 `node`다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-repair.ts` | `checkRepairIntake` | Modify | repair 입력 검사 | 저장소 allowlist 적용 | 176, 1306, 1396행 |
| `test/coordinator.test.js` | `repair` | Modify | 직접 intake 회귀 검증 | 양 분기 정책과 불변성 검증 | 4215행 |
| `test/cli-coordinate.test.js` | `coordinateCli` | Modify | CLI repair 검증 | 정책 거절과 허용 확인 | 1902행 |
| `rules/cli.md` | `coordinate repair` | Modify | CLI 계약 설명 | 거절 사유 기술 | 487행 |
| `references/coordinator-cards/blocked.md` | `repair` | Modify | 거절 사유 안내 | 새 사유 추가 | 47행 |
| `scripts/verify-repair-contract.js` | `신규 추출 지점: scoped verification` | Create | 없음 | 관련 테스트와 정적 검사를 단일 명령으로 실행 | scoped_terminal 요구 |

#### Constraints

기존 오류 우선순위와 정상 repair의 동작을 유지한다. `test/cli-coordinate.test.js`의 chained verify 기대값 `repair-verify-not-single-argv`는 유지한다. 설정 해석은 기존 S12 공통 정책을 재사용한다.

### drive-execution/repair-verify-pr-contract/002 · `a123d8d0`

#### Goal & intent

PR 초안에 필수 절과 worker note 출처를 보존한다. 최종 작성자가 미작성 절과 note 근거를 확인할 수 있어야 한다.

#### Current behavior

`packages/cli/src/finalize-pr.ts:278`의 `buildReviewPoints`는 task별 worker note를 모두 출력한다. `renderPrBody` 462행은 순수 함수이며 482행에서 flow가 있을 때만 `로직 흐름`을 출력한다. CLI 파일 읽기는 `packages/cli/src/cli-git-commands.ts:142`에서 이 함수 호출 전에 일어난다. `test/finalize-pr.test.js:973,1057`은 현재 출력과 flow 부재를 단언한다. `test/finalize-digest.test.js:1331`은 보존 digest만으로 동일한 본문을 재생성하는 소비자 검증이며, `test/skill-bouncer-finalize.test.js:37,60`은 작성 절차와 필수 절 계약을 검증한다. `skills/bouncer-finalize/references/draft-pr.md:41,53`은 세 필수 절을 규정한다.

#### Target behavior

성공: flow가 있으면 `변경 그림` 아래 Mermaid로 출력하고 없으면 작성 필요 표시를 둔다. `변경 전후`와 `되돌리기 · 영향 범위`는 항상 작성 필요 표시로 출력한다. 같은 note 문구는 한 번 출력하되 모든 출처 task ID를 보존하며 서로 다른 문구는 보존한다. 실패: 잘못된 digest와 요약은 기존대로 거절한다. 보존: digest 및 원문 note 자체를 바꾸지 않고 기존 검증·미해결 항목을 유지한다.

#### Interface

제공: 기존 pr-body 입력과 결정적 Markdown 출력은 유지하며 필수 제목을 주요 변경 다음, 리뷰 포인트와 확인 방법 사이의 계약 순서로 둔다. note는 종류별로 정확히 같은 문자열을 묶고 task ID를 최초 등장 순서로 중복 없이 표시한다. 예: `구현 선택(001, 002): same`. 거부: 근거 없는 전후 결과, 영향 내용 또는 자동 번역을 생성하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/finalize-pr.ts` | `renderPrBody`, `buildReviewPoints` | Modify | 초안 생성과 note 출력 | 필수 절과 출처 보존 중복 제거 | 278, 462, 482행 |
| `test/finalize-pr.test.js` | `runPrBody` | Modify | 출력 계약 검증 | 필수 절 및 note 경계 검증 | 973, 1057행 |
| `test/finalize-digest.test.js` | `task documents deleted after finalize → pr-body renders the same body from the saved digest` | Modify | 보존 digest 소비자 회귀 검증 | task 문서 삭제 전후 동일 출력과 필수 절을 확인 | 1331행 |
| `test/skill-bouncer-finalize.test.js` | PR template 및 draft-pr reference 테스트 | Modify | finalize 절차와 템플릿 계약 검증 | 필수 절 순서와 placeholder 작성 및 note 요약 절차를 확인 | 37, 60행 |
| `skills/bouncer-finalize/references/draft-pr.md` | `변경 그림` | Modify | 최종 PR 작성 절차 | placeholder 채우기와 note 한국어 요약 | 41, 53행 |
| `rules/cli.md` | `finalize pr-body` | Modify | CLI 출력 계약 설명 | 필수 절과 flow 기술 | 34행 |
| `scripts/verify-pr-contract.js` | `신규 추출 지점: scoped verification` | Create | 없음 | 관련 테스트와 정적 검사를 단일 명령으로 실행 | scoped_terminal 요구 |

#### Constraints

`test/finalize-pr.test.js`의 전체 출력 비교 두 테스트 `minimal passed digest → pr-body prints only summary sections and the verification line`와 `failed outside_scope verification, deferred must_fix and drive issues → pr-body keeps each visible`의 기대값을 갱신한다. 두 출력 모두 주요 변경 뒤에 작성 필요 표시가 든 `변경 그림`, `변경 전후`를, 확인 방법 앞에 작성 필요 표시가 든 `되돌리기 · 영향 범위`를 포함한다. 후자의 리뷰 포인트 및 실패 검증 내용은 그대로 유지한다. `flow file given → pr-body adds a mermaid 로직 흐름 section before review points`는 flow가 있을 때 `변경 그림` 아래 Mermaid를, 없을 때 해당 절과 작성 필요 표시를 기대하도록 바꾼다. note 종류가 다르면 같은 원문이라도 각 종류를 보존한다. 기존 실패·미해결 경고와 입력 오류는 보존한다.

### drive-execution/repair-verify-pr-contract/003

#### Goal & intent

두 구현 task가 통합된 결과가 전체 CI를 통과한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.
