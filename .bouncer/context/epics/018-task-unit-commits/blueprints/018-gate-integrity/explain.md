---
type: bouncer.explain
title: 커밋 스코프와 검증 증적 게이트 강제
description: '-a 커밋 검사 집합 확장과 하네스 소유 verify 증적 대조'
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/018-gate-integrity/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-21T17:03:31.903+09:00'
bouncer:
  id: EXPLAIN-018
  epic_id: '018'
  blueprint_id: '018'
  status: published
  comprehension:
    - range_from: develop
      range_to: 5cb223ca96c546b193f2e9c885b5d512e0b055ce
      diff_sha: bc6e0c69dead109ee857bb73ba9c8959258297aa11b3863585ea4bed30d885e8
      quiz_score: 2/3
      disposition: Q2는 comprehension이 아니라 Git common-dir verify 원장; 기록만 하고 마감 진행
      recorded_at: '2026-08-21T17:05:22+09:00'
---
# Explain

## Background

커밋 훅은 `git diff --cached`만 보면 `-a` / `-am`처럼 인덱스를 비운 채 커밋하는 경로에서 검사 대상이 비어, `affected_paths` 밖 파일이 그대로 통과했다. G13은 `verification.md` 프론트매터만 읽어 에이전트가 `status: passed`를 손으로 적으면 통과했다. 둘 다 탐지 로직은 살아 있고 판단 재료가 틀렸다. 이 블루프린트는 검사 집합을 커밋이 실제로 담을 파일로 맞추고, G13이 하네스가 Git common directory에 남긴 verify 원장과 문서 메타데이터를 대조하며, README·docs 보증 문구를 그 강제 수준에 맞춘다.

## Intuition

문지기에게 보여 주는 명부와, 실제로 통과한 사람 명단을 따로 두고 둘을 맞춰 본다.

## Code

- `scripts/src/lib/commit-hook.ts` — `evaluateCommit`이 `staged ∪ (all-flag ? trackedModified : [])`로 검사 집합을 잡고, `-a` / `--all` / 결합 단축 플래그를 all-flag로 읽는다. `deps.trackedModified` 기본은 `git diff HEAD --name-only`.
- `scripts/src/lib/verification.ts` + `scripts/src/lib/runtime-state.ts` — `recordVerificationResult`가 `verification.md`와 함께 `<git-common-dir>/bouncer/verify/<digest>.json` 원장(`command` / `ran_at` / `exit_code` / `output_sha`)을 쓴다.
- `scripts/src/lib/validate-gates.ts` — `checkG13`이 문서 메타데이터를 원장과 대조한다. execute·commit 게이트 모두 같은 판정. 원장 없는 기존 문서는 실패한다.
- 문서: `docs/security.md`, `docs/gates.md`, `README.md`, `CHANGELOG.md` — 보증 수준과 하위 호환 파기 안내.

## Quiz

1. `-a` / `-am` 커밋에서 훅이 스코프 검사에 쓰는 파일 집합은?
   - A) `git diff --cached`만 (스테이징된 파일)
   - B) 스테이징 ∪ all-flag일 때 `git diff HEAD --name-only`로 본 추적 중 수정 파일
   - C) `affected_paths`에 적힌 경로만, git 상태와 무관

2. G13이 위조된 `verification.md`를 막기 위해 대조하는 원장은 어디에 있는가?
   - A) 블루프린트 `explain.md`의 comprehension 엔트리
   - B) `.bouncer/context/` 아래 verification 문서 본문
   - C) `<git-common-dir>/bouncer/verify/` 아래 하네스가 쓴 JSON 레코드

3. 원장 없이 예전에 통과한 `verification.md`만 있는 저장소에서 execute/commit 게이트는?
   - A) G13 실패 — 재실행(`bouncer verify`)으로 원장을 남겨야 한다
   - B) 문서 `status: passed`면 통과 (하위 호환)
   - C) 경고만 하고 게이트는 통과

## 이해 상태

- quiz_score: 2/3
- 응답: 1-B (정답 B) ✓, 2-A (정답 C) ✗, 3-A (정답 A) ✓
- disposition: Q2는 comprehension이 아니라 Git common-dir verify 원장; 기록만 하고 마감 진행
- range: develop..5cb223ca96c546b193f2e9c885b5d512e0b055ce
- diff_sha: bc6e0c69dead109ee857bb73ba9c8959258297aa11b3863585ea4bed30d885e8
- recorded_at: 2026-08-21T17:05:22+09:00

## Tasks

### Task 001

#### Goal & intent

훅이 `git commit -a` / `-am` / `--all`을 만나면 이미 스테이징된 경로만이 아니라 그 커밋이 실제로 담게 될 추적 중 수정 파일까지 함께 `affected_paths`와 대조한다. 지금은 PreToolUse 시점에 인덱스가 비어 있어 범위 밖 파일이 그대로 커밋된다. 탐지는 이미 정상이므로 바꾸는 것은 검사 대상 파일 집합뿐이다.

#### Interface

- 제공:
  - 커밋 탐지가 불린 대신 `{ commit: boolean, all: boolean }` 판정을 낼 수 있는 내부 함수를 두고, `isGitCommit(command, opts)`은 지금의 불린 계약을 그대로 유지한다.
  - `evaluateCommit({ command, repoRoot, deps })`의 검사 대상은 `staged ∪ (all ? trackedModified : [])`다.
  - `deps.trackedModified({ repoRoot })` 주입점. 기본 구현은 `git diff HEAD --name-only`의 줄 목록이다.
- 거부:
  - all-flag가 없는 명령은 지금과 같이 스테이징 목록만 검사한다. 워킹 트리에만 있는 범위 밖 수정으로는 막지 않는다.
  - `git diff HEAD`가 실패하면 예외를 그대로 전파한다. `realStagedFiles`와 같은 방식이고, 훅 어댑터가 그 throw를 fail-closed로 받아 exit 2를 낸다. `evaluateCommit` 안에서 삼켜 `block: true`로 바꾸면 `hooks/commit-safety.js`의 내부 오류 처리와 이유가 어긋난다.
  - 중첩 셸·확장·alias로 명령을 판단할 수 없어 이미 커밋으로 간주하는 경로는 all-flag도 있는 것으로 간주한다.
  - 롱 옵션은 이름 전체가 정확히 `--all`일 때만 all-flag다. `--amend` · `--author=…` · `--allow-empty`는 `-`로 시작하고 `a`를 포함하지만 all-flag가 아니다.
  - 따옴표로 감싼 토큰과 `-m` / `--message`의 값은 플래그로 읽지 않는다. `git commit -m "-a"`는 all-flag가 아니다.

#### Touch

- Modify `scripts/src/lib/commit-hook.ts` — all-flag 탐지와 검사 집합 합집합, `trackedModified` 기본 구현과 주입점.
- Modify `scripts/lib/commit-hook.js` — 위 소스의 emit 산출물. `npm run build`로 재생성해 함께 커밋한다.
- Modify `test/commit-hook.test.js` — `-am` 우회 회귀 테스트와 플래그 파싱 경계 케이스.
- Modify `docs/security.md` — 탐지 표에 `-a` 계열 처리와 `git diff HEAD` 실패 시 차단을 적는다.

#### Constraints

- `isGitCommit`의 이름과 불린 반환을 유지한다. 공개 이름 회귀 테스트와 `docs/security.md`가 이 계약을 참조한다.
- fail-closed 방향을 뒤집지 않는다. 판단 불가는 항상 검사 쪽으로 기운다.
- 새 의존성을 넣지 않는다. git 호출은 기존과 같이 `execFileSync` argv 배열로 한다.
- `git diff HEAD --name-only`의 출력은 이름만 쓴다. 삭제된 경로가 섞이므로 파일을 읽지 않는다.
- 비자명한 의도는 한국어 주석으로 남긴다.
- 새로 만든 함수는 테스트로 덮는다. 커버리지 바닥(lines 94 / branches 82 / functions 96)은 `npm run ci`에만 있고 task `verify`인 `npm run verify:strict`에는 없다. 게이트가 통과해도 원격 CI가 떨어질 수 있다.
- 커밋 전 `npm run build`를 돌려 `scripts/lib/commit-hook.js`를 소스와 맞춘다. `check:emit`은 `.githooks/pre-commit`과 `npm run ci`에서 돌고 task `verify`에는 없다.

### Task 002

#### Goal & intent

G13이 문서가 자기 자신과 일관된지만 보지 않고, `bouncer verify`가 남긴 하네스 소유 실행 원장과 대조하게 만든다. 지금은 에이전트가 Write 툴로 `verification.md` 프론트매터에 `exit_code: 0`을 적으면 게이트가 통과한다. 원장은 커밋 대상이 아닌 런타임 상태로, `current` 포인터와 같은 Git common directory 아래에 둔다.

#### Interface

- 제공:
  - `verifyLedgerPathFor({ repoRoot, verificationRel, deps })` — `<git-common-dir>/bouncer/verify/<sha256(verificationRel) 앞 16자>.json` 절대 경로. Git을 쓸 수 없으면 `runtimePaths`와 같은 `{ unavailable, reason }` 모양을 낸다.
  - `recordVerificationResult(...)`가 문서를 쓴 뒤 같은 실행의 원장 레코드를 기록한다. 레코드는 `{ rel, command, ran_at, exit_code, output_sha }`이고 `output_sha`는 문서를 다시 읽었을 때의 `output_tail` 문자열에 대한 sha256이다. 기록 시점에도 `renderDoc` → `readDoc` 왕복을 거친 값을 해싱해, YAML 왕복이 개행이나 후행 공백을 정규화해도 양쪽이 같은 문자열을 본다.
  - `checkGate({ gate: 'execute' | 'commit', deps })`의 `deps.readVerifyLedger({ repoRoot, verificationRel })` 주입점. commit 게이트도 같은 대조를 돌린다.
- 거부:
  - 원장 레코드가 없으면 G13 실패다. 프론트매터가 아무리 잘 갖춰져 있어도 통과하지 않는다.
  - `command` / `ran_at` / `exit_code`가 문서와 원장에서 다르면 G13 실패다.
  - 문서 `output_tail`의 sha256이 원장 `output_sha`와 다르면 G13 실패다.
  - Git common directory를 찾을 수 없으면 통과가 아니라 G13 실패다.
  - 원장에 `exit_code`가 0이 아닌 레코드만 있으면 실패다. 실패 실행 기록을 성공으로 읽지 않는다.
  - commit 게이트에서 `verification.status: passed`만 손으로 적힌 문서는 통과하지 않는다. G7의 status 확인만으로는 `/bouncer-commit` 직접 호출 경로가 그대로 열린다.

#### Touch

- Modify `scripts/src/lib/runtime-state.ts` — 원장 경로 헬퍼 추가.
- Modify `scripts/lib/runtime-state.js` — emit 산출물.
- Modify `scripts/src/lib/verification.ts` — `recordVerificationResult`에서 원장 기록.
- Modify `scripts/lib/verification.js` — emit 산출물.
- Modify `scripts/src/lib/validate-gates.ts` — G13이 원장을 읽어 대조.
- Modify `scripts/lib/validate-gates.js` — emit 산출물.
- Modify `test/runtime-state.test.js` — `verifyLedgerPathFor`와 Git을 쓸 수 없는 `unavailable` 분기 커버리지.
- Modify `test/verification-runner.test.js` — 원장이 실제로 기록되는지, 실패 실행이 어떻게 남는지.
- Modify `test/validate-gates.test.js` — 원장 없음·불일치·정상 세 갈래의 G13 판정. 이 파일은 통과하는 `verification.md` 프론트매터를 직접 구성하므로 원장 fixture를 함께 넣어야 한다.
- Modify `test/cli-verify.test.js` — `bouncer verify` 경로가 만드는 원장 확인.
- Modify `test/cli-commit.test.js` — commit 게이트 G13이 원장을 요구하므로 `verification.status: passed`만 있는 fixture에 원장을 맞춘다.
- Modify `test/commit-task.test.js` — 위와 같다. dry-run / `--yes` / nextTask fixture가 새 대조를 통과해야 한다.
- Modify `test/native-profile-e2e.test.js` — e2e가 만드는 verify 증적이 새 대조를 통과하는지.
- Modify `test/validate-structural.test.js` — execute 게이트를 함께 도는 구조 테스트다. 새 G13 실패가 끼어들면 fixture를 맞춘다.
- Modify `docs/gates.md` — G13 설명을 원장 대조까지 포함하도록 고치고, commit 게이트 행에도 G13을 더한다.
- Modify `docs/ARCHITECTURE.md` — G13 계약 서술 갱신.
- Modify `docs/troubleshooting.md` — 원장 없음·불일치 실패 메시지와 복구 절차(`bouncer verify` 재실행) 추가.
- Modify `docs/compatibility.md` — G13 한 줄 요약 갱신.

#### Constraints

- 원장은 저장소에 커밋되지 않는다. `.git` 아래이므로 `affected_paths`나 커밋 스코프에 절대 들어가지 않는다.
- 게이트 번호 G13과 기존 실패 메시지의 앞부분(`verification.md missing successful harness verification metadata`)은 유지한다. 새 실패는 별도 메시지로 추가한다. `docs/compatibility.md`가 게이트 코드를 공개 계약으로 고정한다.
- 하위 호환을 깨는 변경이다. 원장은 `.git` 아래에 있어 복제되지 않으므로 새 클론·CI 러너·다른 개발자 머신에서는 과거 task의 게이트가 다시 통과하지 못한다. 복구 경로는 활성 task에 대한 `bouncer verify` 재실행 하나뿐이다. 일회성 마이그레이션으로 읽히지 않게 `docs/troubleshooting.md`에 이 범위를 그대로 적는다. CHANGELOG 기록은 task 003이 맡는다.
- 해시는 `node:crypto`로만 만든다. 새 의존성을 넣지 않는다.
- linked worktree에서 실행해도 같은 레코드를 봐야 한다. 경로 기준은 항상 common directory다.
- 비자명한 의도는 한국어 주석으로 남긴다.
- 새로 만든 함수는 테스트로 덮는다. 커버리지 바닥(lines 94 / branches 82 / functions 96)은 `npm run ci`에만 있고 task `verify`인 `npm run verify:strict`에는 없다. 게이트가 통과해도 원격 CI가 떨어질 수 있다.
- 커밋 전 `npm run build`로 `scripts/lib/*.js`를 소스와 맞춘다. `check:emit`은 `.githooks/pre-commit`과 `npm run ci`에서 돌고 task `verify`에는 없다.

### Task 003

#### Goal & intent

README가 보증한다고 적은 것과 코드가 실제로 강제하는 것을 일치시킨다. task 001·002로 두 게이트가 강해진 뒤에도 README는 여전히 가드가 막지 못하는 경로(스크립트 파일, `make commit`, plumbing 우회)를 언급하지 않는다. `docs/security.md`는 이미 그 수준으로 정직하므로 README를 거기에 맞추고, 두 수정과 하위 호환 파기를 CHANGELOG에 남긴다.

#### Interface

- 제공:
  - README의 G13 서술은 "하네스가 실행하고 그 기록과 대조한다"까지 적는다.
  - README는 두 표면을 구분해 적는다. PreToolUse 가드의 검사 대상은 스테이징 경로와 `-a` 계열 커밋의 추적 중 수정 파일이고, commit 게이트 G17의 검사 대상은 스테이징 경로다. 가드가 막지 못하는 경로는 `docs/security.md`로 연결한다.
  - CHANGELOG `## [Unreleased]`에 두 수정과 하위 호환 파기를 적는다.
- 거부:
  - 게이트 코드 번호나 CLI 명령 이름을 바꾸지 않는다. 문구만 고친다.
  - 아직 강제되지 않는 것을 새로 보증하지 않는다. 위협 모델을 넘어서는 문장은 넣지 않는다.
  - 버전 번호를 내리지 않는다. 1.0.0 표기는 유지한다.

#### Touch

- Modify `README.md` — G13·G17 서술과 "증적이 주장을 이긴다" 문단을 실제 보증 수준으로 고치고 위협 모델 링크를 붙인다.
- Modify `CHANGELOG.md` — `## [Unreleased]`에 Fixed 항목 둘과 하위 호환 파기 안내를 추가한다.

#### Constraints

- README와 `docs/security.md`가 같은 사실을 두 번 적지 않는다. README는 요약하고 세부는 링크한다.
- 한국어 본문을 유지한다. 게이트 코드·경로·명령은 그대로 둔다.
- CHANGELOG는 Keep a Changelog 형식을 따르고 `## [Unreleased]` 아래에 쌓는다. 새 버전 헤딩을 만들지 않는다.
- 문서만 바뀌는 커밋이므로 테스트를 새로 만들지 않는다. 기존 문서 테스트가 참조하는 식별자(게이트 코드, 명령 경로)를 지우지 않는다.
