---
type: bouncer.explain
title: retro-followups-hardening explain
description: Explain for retro-followups-hardening
resource: .bouncer/context/epics/drive-execution/blueprints/retro-followups-hardening/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T17:56:25.721+09:00'
bouncer:
  id: EXPLAIN-retro-followups-hardening
  epic_id: drive-execution
  blueprint_id: retro-followups-hardening
  status: published
  comprehension:
    - range_from: 8684ce96ff23c6b5a32deba5ee94c07156ee99f5
      range_to: 237c2d11216cf3479f18f274ed83c85255eb82a8
      diff_sha: 3065f1031c68bf806ad4a96ef140a3312a5ac005a3c4f44426c08e0018744783
      recorded_at: '2026-10-29T17:57:06.764+09:00'
  task_commits:
    - task: drive-execution/retro-followups-hardening/001
      sha: 42ebe289
      intent_anchor: task-001
    - task: drive-execution/retro-followups-hardening/002
      sha: 53359b57
      intent_anchor: task-002
    - task: drive-execution/retro-followups-hardening/003
      sha: 0b0fea5b
      intent_anchor: task-003
    - task: drive-execution/retro-followups-hardening/004
      sha: '34630946'
      intent_anchor: task-004
    - task: drive-execution/retro-followups-hardening/005
      sha: 237c2d11
      intent_anchor: task-005
---
# Explain

## Background

직전 blueprint `retro-followups-coupled-paths`의 회고에서 나온 후보와 위험을 닫는다.
틀린 `review-handoff:` note가 원장에 남으면 다음 coordinator가 그것을 증거로 읽는다.
그래서 `bouncer coordinate note`가 기록 전에 형식을 검사한다.
`plan inspect`의 결합 경로 후보는 경로의 일부나 식별자 안의 일치까지 후보로 잡아 잡음이 컸다.
이 변경은 일치를 경로 경계로 좁힌다. 테스트 격리와 역할 문서 규칙도 함께 보강한다.

## Code

- `packages/cli/src/coordinator-commands.ts`: `isReviewHandoffShape`가 `review-handoff:`로 시작하는 note만 검사한다.
  통과 형식은 handoff 형식과 `unavailable` 형식 둘뿐이다. 거절 코드는 `note-review-handoff-invalid`이고 원장은 바뀌지 않는다.
  파일 시스템은 읽지 않으므로 `files=`의 존재와 sha256 확인은 coordinator 문서 규칙에 남는다.
- `packages/cli/src/plan-inspect.ts`: `hasPathBoundaryMatch`가 `needle` 일치의 양쪽이 경로 경계일 때만 근거 줄로 인정한다.
  `sliceEvidenceText`는 200 UTF-16 단위로 자르되 끝의 상위 서로게이트를 떼어 깨진 글자를 막는다.
- `agents/bouncer-implementer.md`, `agents/bouncer-coordinator.md`와 `.codex/agents/*.toml`: 구현자는 brief 문장과 Checklist가 어긋나면
  **Needs planning**으로 멈춘다. coordinator는 repair에서 회귀 테스트 경로를 조건부로만 `--paths`에 넣는다.
- `skills/bouncer-run/references/drive-metrics.md`: 직접 실행 인계 순서에 리뷰 라운드의 `coordinate note` 단계를 추가했다.
- `test/*.test.js`와 `scripts/verify-*.js`: 회귀 테스트와 task별 검증 래퍼다.
  고정 가짜 저장소 경로를 쓰던 테스트는 임시 디렉터리를 쓴다. 이 디렉터리는 종료 때 지우지 않는다.
- 알려진 한계: 역할 문서 테스트는 문서 문장을 부분 문자열로 고정한다.
  CLI 테스트는 거절 이유가 stderr에 나오는지 검증하지 않는다. `coordinate`의 거절 이유는 stdout JSON으로만 나오고, `revise`만 stderr에도 쓴다(위험 수용됨).

## Quiz

1. `bouncer coordinate note --text "review-handoff: mode=delta; base=abc"`를 실행하면?
   - A) 일반 메모로 기록된다.
   - B) `note-review-handoff-invalid`로 거절되고 원장은 그대로다.
   - C) `files=` 파일이 없다는 이유로 거절되고 실패 기록이 남는다.
2. note 본문이 `review-handoff:`로 시작하지 않는 `"다음 wave 메모"`라면?
   - A) 두 형식 중 하나가 아니므로 거절된다.
   - B) 형식 검사 없이 그대로 기록된다.
   - C) 2000자 제한만 검사하고 handoff 형식으로 보정한다.
3. 결합 경로 후보에서 task 경로가 `docs/guide.md`일 때 테스트 파일의 `see old/docs/guide.md.bak` 줄은?
   - A) 문자열이 포함되므로 근거 줄로 인정된다.
   - B) 확장자를 무시하고 인정된다.
   - C) 경로 경계 밖 일치라서 인정되지 않는다.
4. 근거 줄을 200 UTF-16 단위로 자를 때 200번째 단위가 상위 서로게이트라면?
   - A) 그 한 단위를 떼어 199단위로 끝낸다.
   - B) 하위 서로게이트까지 포함해 201단위로 늘린다.
   - C) 그대로 200단위에서 자른다.

## Tasks

### drive-execution/retro-followups-hardening/001 · `42ebe289`

#### Goal & intent

공용 경로 `/tmp/unused`를 가짜 저장소 루트로 쓰는 테스트를 `fs.mkdtempSync`로 만든 전용 빈 디렉터리로 바꿔, 다른 실행이 그 경로에 남긴 파일이 gate 결과를 바꾸지 못하게 한다.

수용 기준:
1. `rg -n "/tmp/unused" test/`가 아무것도 찾지 않는다.
2. `test/comprehension.test.js`와 `test/validate-gates.test.js`가 통과한다.
3. task 검증 명령은 frontmatter `verify`의 `node scripts/verify-test-temp-dirs.js`다.

#### Current behavior

- `test/comprehension.test.js:65`는 `const repoRoot = '/tmp/unused';`로 `computeDiffSha`를 부른다. 이 테스트는 `exec`를 주입하므로(`packages/cli/src/comprehension.ts:58-61`) 지금은 그 경로를 읽지 않지만, 기본 `defaultExec`(`comprehension.ts:24-26`)로 바뀌면 그 경로가 `cwd`가 된다.
- `test/validate-gates.test.js:888-894`의 모듈 상수 `G16_CTX`와 `:907-911`의 `commitCtx`가 `repoRoot: '/tmp/unused'`를 쓴다. `G16_CTX`는 `:927`, `:954`, `:967`, `:977`, `:994`, `:1005`, `:1015`, `:1027`의 gate 호출에 쓰인다.
- I/O 관찰 지점: finalize gate의 기본 원장 읽기 `packages/cli/src/validate-gates-finalize.ts:59-60`이 `<repoRoot>/.bouncer/runtime/coordinator.json`을 읽는다. 공용 `/tmp/unused` 아래에 이 파일이 있으면 결과가 바뀐다. 직전 drive TASKS-003에서 G21 관련 18건이 이 경로 때문에 실패했다(회고 근거).
- 두 파일의 import: `test/validate-gates.test.js:4-6`이 `fs`·`os`·`path`를 이미 가진다. `test/comprehension.test.js`는 `:166-168`에서 `nodeFs`·`nodeOs`·`nodePath`를 require한다. 이 선언은 `:65`보다 아래지만 테스트 콜백 안에서 쓰면 실행 시점에 초기화되어 있다.
- 같은 파일의 기존 mkdtemp 관례: `test/comprehension.test.js:182`(`bouncer-comp-`), `test/validate-gates.test.js:1151`(`bouncer-gates-`).
- 재현: `npm run build && node --test test/comprehension.test.js test/validate-gates.test.js`가 `/tmp/unused`가 없을 때 통과한다.

#### Target behavior

- 성공: 세 자리가 각자 `fs.mkdtempSync(path.join(os.tmpdir(), 'bouncer-…-'))`로 만든 빈 디렉터리를 쓴다. `G16_CTX`는 모듈 로드 때 한 번 만든 디렉터리를 쓰고, `commitCtx`는 호출마다 새로 만든다(같은 모듈 디렉터리를 써도 된다. 둘 다 이 테스트 프로세스만 쓰는 빈 디렉터리면 된다).
- 실패: `/tmp/unused`에 `.bouncer/runtime/coordinator.json`이 있어도 두 테스트 파일의 결과가 같다.
- 보존: 각 테스트의 단언, 테스트 이름, 주입한 `deps`는 바꾸지 않는다.

#### Interface

- 제공: 테스트 fixture 값만 바뀐다. 공개 인터페이스 변경은 없다.
- 제공: `scripts/verify-test-temp-dirs.js` — 인자 없이 실행한다. 단계: `npm run build` → `node --test test/comprehension.test.js test/validate-gates.test.js` → `npx eslint <두 테스트> scripts/verify-test-temp-dirs.js` → `node scripts/check-test-names.js <두 테스트>` → `node scripts/check-emit.js`. 한 단계라도 0이 아니면 그 단계 이름을 stderr에 남기고 같은 exit code(없으면 1)로 끝난다.
- 거부: 인자를 받으면 usage를 stderr에 쓰고 exit 2로 끝난다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/comprehension.test.js` | `paths under .bouncer/context/ are in the diff` 테스트 | Modify | 고정 경로 `/tmp/unused`를 repoRoot로 씀 | mkdtemp 디렉터리로 교체 | `test/comprehension.test.js:65`, `:166-168` |
| `test/validate-gates.test.js` | `G16_CTX`, `commitCtx` | Modify | 고정 경로를 gate 문맥 repoRoot로 씀 | mkdtemp 디렉터리로 교체 | `test/validate-gates.test.js:888-894`, `:907-911`; 읽기 지점 `packages/cli/src/validate-gates-finalize.ts:59-60` |
| `scripts/verify-test-temp-dirs.js` | 신규 추출 지점: task 검증 래퍼 | Create | 없음 | 빌드·테스트·정적 검사를 순서대로 돌리는 래퍼 | 기존 래퍼 형태 `scripts/verify-model-tiers-followups.js:63-104`(`resolveSpawn` 사용, 셸 문자열 금지) |

#### Constraints

- 단언 값과 테스트 이름은 바꾸지 않는다. 바뀌는 것은 `repoRoot` 값뿐이다.
- 래퍼는 `scripts/verify-model-tiers-followups.js`처럼 CommonJS(`'use strict'`)로 쓰고 `require('./spawn-win').resolveSpawn`과 `spawnSync`의 argv 배열을 쓴다. 셸 문자열 보간을 쓰지 않는다.
- `.js` 줄 길이는 120자 이내다(`eslint.config.js:57`).
- 테스트 프로세스가 만든 임시 디렉터리를 지우는 것은 선택이다. 지운다면 `fs.rmSync(dir, { recursive: true, force: true })`로 지운다.

### drive-execution/retro-followups-hardening/002 · `53359b57`

#### Goal & intent

두 역할 문서에 회고 후보 규칙을 한 문장씩 더한다.
- implementer: brief의 문장과 Checklist의 fixture·단언이 서로 다른 해석을 낳으면 한쪽을 고르지 않고 `Needs planning`으로 멈춘다. 직전 drive TASKS-002가 `.gitignore` 조건 1을 임의로 해석해 리뷰 must_fix(F2)가 난 것이 근거다.
- coordinator: `coordinate repair` 단계에서 수리가 제품 동작을 고치면, 그 수정을 고정하는 회귀 테스트 파일을 `--paths`(없는 파일이면 `--new-path`)에 넣을지 판단한다. 직전 drive TASKS-004의 F3 회귀 테스트가 repair 범위 밖이라 병합되지 못한 것이 근거다.

CLI 코드는 바꾸지 않는다.

수용 기준:
1. `agents/bouncer-implementer.md` `## Scope`와 `agents/bouncer-coordinator.md` `## Hard guards`에 Checklist의 영어 문장이 그대로 있다.
2. 두 `.codex/agents/*.toml`이 새 md의 `mdToCodexToml(md, 'medium')`과 바이트 일치한다.
3. `test/agents.test.js`의 새 테스트 두 개가 각 문장을 해당 절 안에서 고정한다.
4. task 검증 명령은 `node scripts/verify-role-doc-rules.js`다.

#### Current behavior

- implementer:
  - `agents/bouncer-implementer.md:76-80`(`## Scope`)은 "If blocked by ambiguity or contradiction, **stop** and report the deviation"이라고만 하고, 무엇이 모호성인지 예시가 없다.
  - `:237-238`의 `Needs planning` 항목과 `:250` "`Needs planning` is how you stop"이 멈춤 방법이다.
- coordinator:
  - `agents/bouncer-coordinator.md:127-135`(`## Hard guards`, `:67`)는 "Take every repair `--paths` entry from tracked files named in the failure evidence or the debugger report; never guess a path."와 `--new-path`·`--verify` 규칙을 둔다.
  - 수리를 고정하는 회귀 테스트 파일을 범위에 넣을지는 말하지 않는다. 새 문장은 근거가 지목하고, `test/` 아래에 있으며, brief의 Do not touch·Out of scope에 없는 파일만 넣게 한다.
  - repair 흐름: `:119-126`. test-evidence 보완(`--kind supplement`): `:173-180`.
  - CLI 쪽: `coordinate repair` usage는 `--paths <p> --decision <reason>`을 받는다(`packages/cli/src/cli-usage.ts`의 `'repair'` 항목). 정규화 없는 중복 제거(`packages/cli/src/coordinator-repair.ts:168`)는 이번 범위가 아니다.
- parity와 고정:
  - 두 TOML은 `mdToCodexToml(markdown, 'medium')`과 바이트 일치해야 한다(`test/agents.test.js:57-65`). `scripts/check-emit.js:111-124`는 index에 staged된 TOML이 md 변환과 같은지 본다.
  - 같은 문서를 읽는 다른 테스트: `test/implementer-lint-step.test.js:28`, `test/coordinator.test.js:2103`, `test/doc-shape-cli.test.js:69`, `:120`(implementer), `test/agents.test.js:240-253`(coordinator `## Worker dispatch` 20줄 상한과 링크), `:514`, `:532`, `:548`(coordinator 다른 절), `test/skill-bouncer-run.test.js:220-222`(coordinator `review-handoff:` 문단).
  - 이 task는 각 문서의 한 bullet에만 문장을 더하므로 위 단언들은 바뀌지 않는다.
- 절 추출 helper는 `test/agents.test.js:269` `roleSection(md, heading)`이다.
- 재현: `npm run build && node --test test/agents.test.js`가 현재 통과한다.

#### Target behavior

- 성공:
  - 아래 두 문장이 각 bullet 끝에 붙는다.
  - 두 TOML이 재생성되어 parity 테스트가 통과한다.
- 실패:
  - 문장이 다른 절로 옮겨지거나 지워지면 새 테스트가 실패한다.
  - TOML을 다시 만들지 않으면 `all seven role briefs → keep TOML parity` 테스트가 실패한다.
- 보존:
  - implementer: `## Scope`의 다른 bullet, Output contract는 그대로다.
  - coordinator: `## Worker dispatch` 절(20줄 상한), repair CLI 거절 목록 문장, `review-handoff:` 문단은 그대로다.

#### Interface

- 제공: 역할 문서 규칙 문장 두 개와 그 Codex 생성본.
- 제공: `scripts/verify-role-doc-rules.js`. 인자 없이 실행하고 단계는 다음 순서다.
  1. `npm run build`
  2. `node --test test/agents.test.js test/skill-bouncer-run.test.js`
  3. `npx eslint test/agents.test.js scripts/verify-role-doc-rules.js`
  4. `node scripts/check-doc-shape.js agents/bouncer-implementer.md agents/bouncer-coordinator.md`
  5. `node scripts/check-test-names.js test/agents.test.js`
  6. `node scripts/check-emit.js`

  실패한 단계 이름을 stderr에 남기고 그 exit code(없으면 1)로 끝난다.
- 거부: 래퍼는 인자를 받으면 usage를 stderr에 쓰고 exit 2로 끝난다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-implementer.md` | `## Scope` 모호성 bullet | Modify | 모호성·모순 시 멈춤만 규정 | brief·Checklist 해석 충돌 문장 추가 | `agents/bouncer-implementer.md:76-80`, `:237-238`, `:250`; 회고 후보 2 |
| `.codex/agents/bouncer-implementer.toml` | 생성본 본문 | Modify | implementer md의 Codex 생성본 | 새 md에서 재생성 | parity `test/agents.test.js:57-65`, `scripts/check-emit.js:111-124` |
| `agents/bouncer-coordinator.md` | `## Hard guards` repair `--paths` bullet | Modify | 경로 출처와 `--new-path`·`--verify` 규칙만 규정 | 회귀 테스트 파일 판단 문장 추가 | `agents/bouncer-coordinator.md:127-135`, `:119-126`; 회고 후보 3; 소비자 조사 `test/agents.test.js:240-253`, `:514`, `:532`, `:548`, `test/skill-bouncer-run.test.js:220-222` |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 본문 | Modify | coordinator md의 Codex 생성본 | 새 md에서 재생성 | parity `test/agents.test.js:57-65` |
| `test/agents.test.js` | 신규 추출 지점: 문장 고정 테스트 두 개 | Modify | parity와 다른 절만 고정 | `roleSection`으로 두 문장 단언 | helper `test/agents.test.js:269` |
| `scripts/verify-role-doc-rules.js` | 신규 추출 지점: task 검증 래퍼 | Create | 없음 | Interface 단계를 순서대로 실행 | 래퍼 형태 `scripts/verify-model-tiers-followups.js:63-104` |

#### Constraints

- 문서 본문은 영어로 쓴다. 문장은 아래 Checklist 문장을 그대로 쓴다.
- coordinator 문서에서는 `## Worker dispatch` 절과 `review-handoff:` 문단, `## ` 제목 골격을 바꾸지 않는다. `task-notification`도 쓰지 않는다(`test/skill-bouncer-run.test.js:132`).
- TOML은 손으로 고치지 않는다. 아래 재생성 명령의 출력으로만 쓴다.
- `check:emit`이 staged 생성본을 보므로 두 TOML의 `git add`는 허용한다. commit·push·branch는 하지 않는다.
- 기존 `test/agents.test.js` 단언은 바꾸지 않는다. 새 테스트 두 개만 더한다.
- `.js` 줄 길이는 120자 이내다.

### drive-execution/retro-followups-hardening/003 · `0b0fea5b`

#### Goal & intent

`skills/bouncer-run/references/drive-metrics.md`의 root-direct 인계 순서에 리뷰 라운드 전용 `coordinate note` 단계를 넣어 정본인 `direct-run.md` Handoff 표와 맞추고, Handoff 첫 문단의 실패 단계 문장(직전 리뷰 F3)이 표의 실패 열과 같은 단계 번호를 말하는지 회귀 테스트로 고정한다.

수용 기준:
1. drive-metrics 인계 문장이 `metrics end` → `coordinate session-open` → `metrics start --kind coordinator-session` → (리뷰 라운드만) `coordinate note`(`review-handoff:`) → `coordinate status --write-input` → dispatch 순서이고 `./direct-run.md` Handoff를 가리킨다.
2. 새 테스트가 Handoff 표에서 실패 열이 `stop and report`인 단계가 `[2, 4, 5, 6]`, `never blocks`인 단계가 `[1, 3]`이고 첫 문단 문장이 같은 번호를 말함을 단언한다.
3. task 검증 명령은 `node scripts/verify-handoff-order-docs.js`다.

#### Current behavior

- `skills/bouncer-run/references/drive-metrics.md:74-78`(`## Per root-direct session`, `:69`)의 인계 순서는 "`metrics end` …, `coordinate session-open`, `metrics start --kind coordinator-session`, then a fresh `coordinate status --write-input` (the earlier input is stale once `session-open` changes the ledger hash), then dispatch"이다. note 단계와 note가 원장 hash를 바꾼다는 말이 없다.
- 정본 `skills/bouncer-run/references/direct-run.md:61-78`: Handoff 첫 문단(`:63-69`)은 "A failure (`ok: false`) of step 2, 4, 5, or 6 stops the handoff …; a metrics failure of step 1 or 3 is reported and the handoff continues. Step 4 is skipped unless the handed-off round is a review round."이고, 표(`:71-78`)의 실패 열은 1 `report; never blocks the handoff`, 2 `stop and report`, 3 `report; never blocks`, 4 `note-too-long: retry …; other ok: false: stop and report`, 5·6 `stop and report`다. 지금 문장과 표는 일치한다.
- 기존 고정: `test/skill-bouncer-run.test.js:195-223`가 리뷰 라운드 행, note 단계 위치(`:207-208`), note 행 실패 열의 `stop and report`(`:216`)를 고정한다. 실패 단계 번호 문장은 고정하지 않는다. `:156-169`가 drive-metrics의 tier·effort 문구를 `sectionBetween`(`:145`)으로 고정하고, `:121-134`가 drive-metrics 링크와 `task-notification` 부재를 고정한다.
- drive-metrics 경로 계약: `test/doc-shape-cli.test.js:327-329`가 `node scripts/check-doc-shape.js skills/bouncer-run/references/drive-metrics.md` 통과를 고정한다. 제목 골격을 바꾸지 않으면 영향이 없다.
- 재현: `npm run build && node --test test/skill-bouncer-run.test.js`가 현재 통과한다.

#### Target behavior

- 성공: drive-metrics 인계 문장이 수용 기준 1의 순서를 말하고, `status --write-input`이 `session-open` 또는 note 뒤 hash가 바뀌어 다시 써야 한다고 말하며, 단계별 입력과 실패 처리는 `[direct-run.md](./direct-run.md)` Handoff 표를 따른다고 적는다.
- 실패: drive-metrics에서 note 단계가 빠지거나 순서가 바뀌면 새 순서 테스트가 실패한다. Handoff 문장이나 표의 실패 열 중 한쪽만 바뀌면 새 실패 단계 테스트가 실패한다.
- 보존: drive-metrics의 `metrics end` 한 번 규칙, 측정 불가 규칙, 기존 tier·effort 문구, 제목 골격은 그대로다. `direct-run.md`는 바꾸지 않는다.

#### Interface

- 제공: drive-metrics 문서 문장, `test/skill-bouncer-run.test.js`의 새 테스트 두 개.
- 제공: `scripts/verify-handoff-order-docs.js` — 인자 없이 실행한다. 단계: `npm run build` → `node --test test/skill-bouncer-run.test.js test/doc-shape-cli.test.js` → `npx eslint test/skill-bouncer-run.test.js scripts/verify-handoff-order-docs.js` → `node scripts/check-doc-shape.js skills/bouncer-run/references/drive-metrics.md` → `node scripts/check-test-names.js test/skill-bouncer-run.test.js`. 실패한 단계 이름을 stderr에 남기고 그 exit code(없으면 1)로 끝난다.
- 거부: 래퍼는 인자를 받으면 usage를 stderr에 쓰고 exit 2로 끝난다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/drive-metrics.md` | `## Per root-direct session` 인계 문장 | Modify | note 단계 없는 인계 순서 서술 | note 단계, hash 갱신 이유, Handoff 표 링크 추가 | `drive-metrics.md:74-78`; 정본 `direct-run.md:71-78`; 소비자 조사 `test/skill-bouncer-run.test.js:121-169`, `test/doc-shape-cli.test.js:327-329` |
| `test/skill-bouncer-run.test.js` | 신규 추출 지점: 인계 순서·실패 단계 고정 테스트 | Modify | note 위치와 행 문구만 고정 | drive-metrics 순서 테스트와 Handoff 실패 단계 테스트 추가 | helper `paragraphContaining`(`:38`), `sectionBetween`(`:145`), `readDriveMetrics`(`:152`) |
| `scripts/verify-handoff-order-docs.js` | 신규 추출 지점: task 검증 래퍼 | Create | 없음 | Interface 단계를 순서대로 실행 | 래퍼 형태 `scripts/verify-model-tiers-followups.js:63-104` |

#### Constraints

- drive-metrics 본문은 영어로 쓰고 `task-notification`을 쓰지 않는다(`test/skill-bouncer-run.test.js:132`).
- drive-metrics의 `## ` 제목을 추가·삭제·이름 변경하지 않는다.
- 기존 테스트 단언은 바꾸지 않는다. 새 테스트 두 개만 더한다.
- 실패 단계 테스트는 변경 전부터 통과하는 회귀 고정이다. 이 task에서 `direct-run.md`를 바꿔 red를 만들지 않는다.
- `.js` 줄 길이는 120자 이내다.

### drive-execution/retro-followups-hardening/004 · `34630946`

#### Goal & intent

`bouncer coordinate note`가 `review-handoff:`로 시작하는 본문을 `direct-run.md` Handoff의 두 형식으로 검사해, 틀리면 `note-review-handoff-invalid`로 거절하고 원장을 바꾸지 않게 한다. 같은 모듈의 `dispatch-report-dir-failed` 거절은 쓰기 권한 없음(`EACCES`)과 대상 없는 symlink에서도 성립함을 테스트로 고정한다.

수용 기준:
1. Interface의 거절 목록 각 입력이 `note-review-handoff-invalid`로 거절되고 원장 bytes가 그대로이며, 응답에 `cause`·`next`가 있다.
2. Interface의 허용 목록 각 입력은 기록되고, `review-handoff:`로 시작하지 않는 note는 지금과 같이 기록된다.
3. 2000자를 넘는 `review-handoff:` 본문은 `note-too-long`을 받는다.
4. worker의 `path.join(drive.worker, '.bouncer', 'runtime')`이 쓰기 불가(`chmod 0o555`)이거나 그 아래 `reports`가 대상 없는 symlink이면 production dispatch 코드 변경 없이 dispatch가 `dispatch-report-dir-failed`로 거절하고 원장 bytes가 그대로다.
5. `rules/cli.md`의 `coordinate note` 서술이 새 reason과 검사 범위를 말하고, `coordinate note` usage 문자열의 거절 목록에 `note-review-handoff-invalid`가 있다.
6. task 검증 명령은 `node scripts/verify-coordinate-note-validation.js`다.

#### Current behavior

- `coordinateNote`(`packages/cli/src/coordinator-commands.ts:788-812`)는 원장 mode·status 검사(`:792-796`), trim(`:798`), 빈 본문 `note-text-required`(`:799`), 길이 `note-too-long`(`:800`, 상한 `NOTE_TEXT_MAX = 2000` `:155`), task 소속 `task-outside-blueprint`(`:801-803`) 순서로 거절한 뒤 note를 원장에 덧붙인다(`:804-808`). 본문 형식은 보지 않는다.
- 형식 정본은 `skills/bouncer-run/references/direct-run.md:91-103`이다: `review-handoff: mode=<mode>; base=<sha>; head=<sha>; snapshot_id=<id>; perspectives=<p1,p2,…>; files=<path>@<sha256>,…`, 경로는 `.bouncer/runtime/print/review-handoff-(discovery|delta)-<perspective>.md`, 대체 본문은 `review-handoff: unavailable (<error summary, first 200 characters>); run discovery`. 4단계 실패 열(`direct-run.md:76`)은 `note-too-long` 외의 `ok: false`를 "stop and report"로 다룬다.
- 값의 근거: perspective 이름은 `REVIEW_PERSPECTIVE`(`packages/cli/src/review-policy.ts:21-27`)이고 이 모듈은 이미 `reviewPolicy`를 import한다(`coordinator-commands.ts:23`). `snapshot_id`는 64 소문자 hex(`packages/cli/src/review-snapshot.ts:20`). base·head는 `review-dispatch`가 `gitRevParse`로 푼 전체 SHA다(`packages/cli/src/review-dispatch.ts:930-931`).
- 힌트 표 `COORDINATE_FAILURE_HINTS`의 note 항목은 `coordinator-commands.ts:1960-1967`, dispatch 디렉터리 항목은 `:1503-1508`이다. `test/coordinator.test.js:222-226`이 coordinator 모듈의 모든 `reason: '...'` 리터럴(`reasonLiteralsOf` `:175-181`)에 힌트가 있는지 검사한다.
- 기존 note 테스트: `test/coordinator.test.js:5552`(`noteCall`), `:5600-5622`(거절 표와 원장 bytes 불변), `test/cli-coordinate.test.js:1305-1334`(usage·기록). CLI 거절 응답 모양은 `test/cli-coordinate.test.js:481-490`(exit 1, stdout JSON `reason`·`cause`·`next`, stderr에 reason).
- dispatch 디렉터리 생성: `coordinator-commands.ts:1005-1014`가 `fs.mkdirSync(path.dirname(report_path), { recursive: true })`의 모든 throw를 `dispatch-report-dir-failed`로 바꾸고, 원장 쓰기(`:1015` 이후)보다 앞선다. 테스트는 생성 성공(`test/coordinator.test.js:5298`)과 보고 경로가 일반 파일인 경우(`:5310-5323`)만 있다. 기존 symlink fixture 관례는 `:1782`, `:6360`이다.
- 문서: `rules/cli.md:324-331`이 note 거절을 `note-text-required`, `note-too-long`, `task-outside-blueprint`로 나열한다. 같은 목록이 usage 문자열 `packages/cli/src/cli-usage.ts:61`(`COORDINATE_USAGE.note`, `:39`에서 정의, `coordinateUsage`로 export `:78`)에도 "Refused with note-text-required, note-too-long, or task-outside-blueprint"로 있다. 이 문장을 고정하는 테스트는 없다(`rg "Refused with note-text-required" test/` 빈 결과).
- 재현: `npm run build && node --test test/coordinator.test.js test/cli-coordinate.test.js`가 현재 통과한다.

#### Target behavior

- 성공:
  - `review-handoff:`로 시작하지 않는 본문은 지금처럼 기록된다.
  - `review-handoff:`로 시작하고 Interface의 두 형식 중 하나면 기록된다. 저장되는 `text`는 trim한 본문 그대로다.
- 실패:
  - `review-handoff:`로 시작하지만 두 형식 어느 것도 아니면 `{ ok: false, reason: 'note-review-handoff-invalid' }`를 내고 원장을 쓰지 않는다. CLI는 exit 1, stdout JSON에 `cause`·`next`, stderr에 reason을 낸다.
  - direct-run 인계에서 이 거절은 `note-too-long`이 아닌 `ok: false`이므로 기존 Handoff 표 4단계 실패 열(`direct-run.md:76`, "other `ok: false`: stop and report")대로 인계를 멈추고 보고한다. `direct-run.md`는 바꾸지 않는다.
  - 검사 순서: mode·status → `note-text-required` → `note-too-long` → `note-review-handoff-invalid` → `task-outside-blueprint`.
  - dispatch: `EACCES`와 대상 없는 symlink에서 `dispatch-report-dir-failed`, 원장 bytes 불변, 힌트 있음.
- 보존: note decision 모양(`{kind, text, written_at, task?}`), checkpoint `notes` 동작, 다른 거절 reason과 힌트 문구, dispatch 성공 응답과 `report_path`는 그대로다.

#### Interface

- 제공: 거절 reason `note-review-handoff-invalid`와 힌트.
  - `cause`: `The note text starts with \`review-handoff:\` but matches neither the handoff shape nor the unavailable shape.`
  - `next`: `Stop the handoff and report this refusal, as the direct-run.md Handoff table says for any other ok: false at the note step; do not retry with a different text.`
- 제공: 신규 추출 지점: 순수 함수 `(body: string) => boolean`(이름 자유, 모듈 내부). trim한 본문을 받아 `review-handoff:`로 시작하지 않으면 true, 시작하면 아래 형식 중 하나일 때만 true다. 파일을 읽지 않는다.
- 도메인 용어 "handoff 형식": `review-handoff: mode=M; base=B; head=H; snapshot_id=S; perspectives=P; files=F`. 필드 순서와 구분자 `; `는 고정이고 뒤에 다른 글자가 없다.
  - `M`은 `discovery` 또는 `delta`. `B`·`H`는 `^[0-9a-f]{40}$` 또는 `^[0-9a-f]{64}$`이고 둘의 길이가 같다(한 저장소의 해시 형식은 하나다). `S`는 `^[0-9a-f]{64}$`.
  - `P`는 `,`로 이은 하나 이상의 `REVIEW_PERSPECTIVE` 값이고 중복이 없다.
  - `F`는 `,`로 이은 항목이고 각 항목은 `.bouncer/runtime/print/review-handoff-<M>-<p>.md@<64 소문자 hex>`다. `<M>`은 note의 `M`과 같고 `<p>`는 `P`에 있다. 파일 항목의 `<p>` 집합이 `P`와 같고 같은 `<p>`가 두 번 나오지 않는다.
  - 예: `review-handoff: mode=discovery; base=<40 hex>; head=<40 hex>; snapshot_id=<64 hex>; perspectives=spec_scope,correctness_tests; files=.bouncer/runtime/print/review-handoff-discovery-spec_scope.md@<64 hex>,.bouncer/runtime/print/review-handoff-discovery-correctness_tests.md@<64 hex>`
- 도메인 용어 "unavailable 형식": `^review-handoff: unavailable \((.{1,200})\); run discovery$`(요약 1~200 UTF-16 단위, 줄바꿈 없음). 예: `review-handoff: unavailable (note-too-long); run discovery`.
  - 이 판정은 `direct-run.md:102`의 생산자 문구("error summary, first 200 characters")보다 엄격하다: 빈 요약과 줄바꿈이 든 요약도 거절한다. 이 차이는 수용한다. 그런 본문이 거절되면 위 표대로 인계가 멈추고 보고된다.
- 거부 (즉시 거절, `note-review-handoff-invalid`): 필드 누락·순서 바뀜·뒤에 남는 글자, `mode=full`, 짧거나 대문자인 hex, base·head 길이 불일치(40과 64), 알 수 없는 perspective(예: `style`), 중복 perspective, 파일 mode 불일치, `P`에 없는 파일 perspective, perspective에 파일 없음, print 디렉터리 밖 경로(예: `../x.md@…`), 64자가 아닌 파일 sha, 빈 요약 `unavailable ()`, 201자 요약, 줄바꿈이 든 요약, 본문이 `review-handoff:` 뿐인 경우.
- 거부 아님 (일반 note로 기록): `Review-Handoff: x`, `review-handoff 메모`, `다음 세션 메모`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateNote`, `COORDINATE_FAILURE_HINTS`, 신규 추출 지점: review-handoff 형식 판정 | Modify | 빈 본문·길이·task만 검사 | 길이 검사 뒤 형식 판정과 새 reason, 힌트 추가 | `coordinator-commands.ts:788-812`, `:155`, `:23`, `:1960-1967`; 형식 정본 `direct-run.md:91-103`; 값 근거 `review-policy.ts:21-27`, `review-snapshot.ts:20` |
| `test/coordinator.test.js` | note 형식 테스트, dispatch 실패 경로 테스트 | Modify | note 거절 표와 일반 파일 dispatch 실패만 고정 | 허용·거절 표 테스트, `EACCES`·symlink dispatch 테스트 추가 | `test/coordinator.test.js:5552`, `:5600-5622`, `:5310-5323`, 힌트 전수 검사 `:222-226` |
| `test/cli-coordinate.test.js` | CLI note 거절 테스트 | Modify | note usage·기록만 고정 | 잘못된 `review-handoff:` 본문의 exit 1·JSON·stderr 단언 추가 | `test/cli-coordinate.test.js:1305-1334`, 응답 모양 `:481-490` |
| `rules/cli.md` | `coordinate note` 문단 | Modify | 거절 세 개만 나열 | 새 reason, 검사 대상(`review-handoff:` 접두), 파일을 읽지 않음 추가 | `rules/cli.md:324-331`; 소비자 조사 `agents/bouncer-coordinator.md:354`(note 사용법, 변경 불필요), `direct-run.md:76`(실패 열이 이미 포괄) |
| `packages/cli/src/cli-usage.ts` | `COORDINATE_USAGE.note` | Modify | note 거절 세 개를 나열 | 거절 목록에 `note-review-handoff-invalid` 추가 | `packages/cli/src/cli-usage.ts:61`, `:39`, `:78` |
| `scripts/verify-coordinate-note-validation.js` | 신규 추출 지점: task 검증 래퍼 | Create | 없음 | Checklist 마지막 항목의 단계를 순서대로 실행 | 래퍼 형태 `scripts/verify-model-tiers-followups.js:63-104` |

#### Constraints

- 형식 판정은 파일 시스템을 읽지 않는 순수 함수다. `files=` 존재·sha256 확인은 coordinator 문서 규칙에 남긴다.
- perspective 목록은 `reviewPolicy.REVIEW_PERSPECTIVE`를 그대로 쓰고 사본을 만들지 않는다.
- 거절은 `commitWrite()` 호출 전에 반환해 원장 bytes가 바뀌지 않는다.
- 기존 테스트 단언은 바꾸지 않는다. `test/coordinator.test.js:5600-5622`의 거절 표에 행을 더하는 대신 새 테스트를 만든다.
- `EACCES` 테스트는 `node:test` 옵션 `{ skip: process.platform === 'win32' || process.getuid?.() === 0 }`으로 건너뛰고, `finally`에서 권한을 `0o755`로 되돌린다. symlink 테스트는 `{ skip: process.platform === 'win32' }`이다.
- dispatch 실패 경로 테스트는 production dispatch 코드(`coordinator-commands.ts:1005-1014`)를 바꾸지 않고 통과해야 한다(blueprint Contract: dispatch 동작 불변). red가 나면 dispatch 코드를 고치지 말고 실패 단언과 오류 코드를 적어 **Needs planning**으로 멈춘다.
- 두 dispatch fixture의 기준 경로는 모두 `path.join(drive.worker, '.bouncer', 'runtime')`이다. `chmod`와 `symlinkSync`는 이 디렉터리와 그 아래 `reports`에만 건다.
- `.ts`·`.js` 줄 길이는 120자 이내다(`eslint.config.js:57`). `npm run typecheck`가 통과해야 한다.

### drive-execution/retro-followups-hardening/005 · `237c2d11`

#### Goal & intent

`bouncer plan inspect --blueprint`의 `coupledPaths.candidates`가 경로 경계에서 일치한 줄만 근거로 삼게 해 다른 파일 경로·식별자 일부로 생기는 후보를 없애고, 근거 줄을 자를 때 UTF-16 서로게이트 쌍을 끊지 않게 한다. `rules/cli.md`의 `plan inspect` 서술에 `coupledPaths`를 더한다.

수용 기준:
1. Checklist의 소음 fixture에서 경계 밖 일치 파일은 후보가 아니고 경계 안 일치 파일은 후보다.
2. 서로게이트 fixture에서 `evidence.text`가 상위 서로게이트(`\uD800-\uDBFF`)로 끝나지 않고 길이가 199다. 서로게이트 쌍이 200 안에 다 들면 길이 200이다.
3. 기존 `coupledPaths` 테스트(`test/plan-inspect.test.js:684-841`)가 단언 변경 없이 통과한다.
4. `rules/cli.md`의 `plan inspect` 문단이 `coupledPaths`(`--blueprint` 없으면 `null`, `advisory`, `pairs`, `candidates`, 경로 경계 일치, 근거 줄 200 UTF-16 단위)를 말한다.
5. task 검증 명령은 `node scripts/verify-coupled-paths-noise.js`다.

#### Current behavior

- `firstMatchingLine`(`packages/cli/src/plan-inspect.ts:662-682`)은 파일을 읽어 줄마다 `lines[i].includes(needle)`로 첫 일치 줄을 찾고(`:677`), `lines[i].trim().slice(0, COUPLED_EVIDENCE_MAX_CHARS)`(`:678`, 상수 `:540` = 200)로 자른다. 경로 경계를 보지 않고, `slice`는 UTF-16 단위라 서로게이트 쌍 가운데서 끊을 수 있다.
- 호출: `detectCoupledPaths`(`:734`)가 파일 항목(`isFileItem` `:595`)마다 `listTestFiles`(`:625`)의 각 테스트 파일에 `firstMatchingLine`을 부르고, 결과가 있으면 `kind: 'path-literal'` 후보를 낸다(`:787`).
- I/O 관찰 지점: 파일 읽기 `plan-inspect.ts:669`(`fs.readFileSync`), 디렉터리 탐색 `:630`(`fs.readdirSync`). 쓰기는 없다.
- 소음 근거(2026-10-29 이 저장소 `test/*.js` 측정): 항목 `package.json`은 19개 파일과 일치하는데 그중 일치 25곳이 `packages/cli/package.json`·`../packages/cli/package.json`·`node_modules/left-pad/package.json`·`packages/cli/package.json.bak` 같은 다른 경로다. `.gitignore`는 `res.gitignoreSuggestions`·`withGi.gitignoreWritten` 같은 식별자 일부로 9곳이 일치한다. `AGENTS.md`는 `rules/references/agents/AGENTS.md`·`/AGENTS.md`와 일치하고, 같은 파일을 가리키는 `./AGENTS.md`는 24곳이다.
- 문서: `rules/cli.md:103`은 "`plan inspect` prints next ids, verify signals, and pointer state as JSON."뿐이다. usage 문자열(`packages/cli/src/cli-usage.ts:15`)은 이미 `coupledPaths`를 말하고 `test/plan-inspect.test.js:856-860`이 고정한다. 계획 흐름 문서(`skills/bouncer-plan/SKILL.md:307`, `skills/bouncer-plan/references/scope-confirm.md:15`, `agents/bouncer-plan-coordinator.md:67`)는 일치 방식을 서술하지 않아 바뀌지 않는다.
- 기존 fixture(`test/plan-inspect.test.js:648-675`, `:775`, `:816`, `:836`)의 일치는 모두 `'`·`(` 뒤, `'` 앞이라 새 경계 규칙에서도 후보로 남는다. 긴 줄 단언 `:729-731`은 ASCII라 길이 200이 그대로다.
- 재현: `npm run build && node --test test/plan-inspect.test.js`가 현재 통과한다.

#### Target behavior

- 성공: 한 줄 안 일치 위치마다 경계를 보고, 하나라도 경계를 만족하면 그 줄을 근거로 쓴다. 근거 줄은 trim 뒤 앞 200 UTF-16 단위를 자르고, 마지막 단위가 상위 서로게이트면 그 한 단위를 더 뗀다.
- 실패(후보 아님): 경계를 만족하는 일치가 파일 어디에도 없으면 그 파일은 후보가 아니다.
- 보존: 출력 키·타입, `pairs` 계산, 파일당 첫 일치 줄 하나, 테스트 디렉터리·확장자·1 MiB 상한·symlink 미추적, 읽기 전용 동작은 그대로다.

#### Interface

- 제공: 신규 추출 지점: 경로 경계 판정 `(line: string, index: number, needle: string) => boolean`(이름 자유, 모듈 내부).
- 도메인 용어 "경로 글자": `[A-Za-z0-9_$.\-/]`. "뒤 경로 글자": `[A-Za-z0-9_$\-/]`.
- 도메인 용어 "왼쪽 경계": `index === 0`, 또는 `line[index-1]`이 경로 글자가 아님, 또는 `line.slice(index-2, index) === './'`이고 `index === 2`이거나 `line[index-3]`이 경로 글자가 아님. 예: `read('./AGENTS.md')`의 `AGENTS.md`는 경계, `rules/references/agents/AGENTS.md`의 `AGENTS.md`는 경계가 아님.
- 도메인 용어 "오른쪽 경계": 일치 끝이 줄 끝, 또는 다음 글자가 뒤 경로 글자가 아니고, 다음 글자가 `.`이면 그 다음 글자가 `[A-Za-z0-9_]`가 아님. 예: `see CHANGELOG.md.`는 경계, `package.json.bak`·`.gitignoreWritten`은 경계가 아님.
- 제공: 신규 추출 지점: 서로게이트 안전 절단 `(text: string, max: number) => string`. `text.slice(0, max)`를 만들고, 마지막 단위가 상위 서로게이트(`0xD800-0xDBFF`)면 그 한 단위만 뗀다. 그 밖에는 바꾸지 않는다.
- 거부: 경계 밖 일치만 있는 파일은 후보에서 빠진다. 이것은 오류가 아니고 출력에서 그 항목이 없는 것이다.
- `scripts/verify-coupled-paths-noise.js`: 인자 없이 실행하고, 인자가 있으면 usage를 stderr에 쓰고 exit 2다. 단계는 Checklist 마지막 항목에 둔다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/plan-inspect.ts` | `firstMatchingLine`, `COUPLED_EVIDENCE_MAX_CHARS`, 신규 추출 지점: 경계 판정·안전 절단 | Modify | 부분 문자열 일치와 UTF-16 `slice` | 경계 일치와 서로게이트 안전 절단 | `plan-inspect.ts:540`, `:662-682`, 호출 `:734`, `:787` |
| `test/plan-inspect.test.js` | 신규 추출 지점: 소음·서로게이트 테스트 | Modify | 일치·절단 길이만 고정 | 경계 밖·안 fixture와 서로게이트 fixture 테스트 추가 | 기존 helper `writeRoutingBlueprint`(`:412`)·`writeFile`(`:678`)·`inspect`(`:59`)·`parsePayload`(`:63`); 기존 단언 `:684-841` |
| `rules/cli.md` | `plan inspect` 문단 | Modify | `coupledPaths` 서술 없음 | `coupledPaths` 모양·`null` 조건·경계 일치·근거 길이 문장 추가 | `rules/cli.md:103`; usage `cli-usage.ts:15`, 고정 `test/plan-inspect.test.js:856-860` |
| `scripts/verify-coupled-paths-noise.js` | 신규 추출 지점: task 검증 래퍼 | Create | 없음 | Checklist 마지막 항목 단계를 순서대로 실행 | 래퍼 형태 `scripts/verify-model-tiers-followups.js:63-104` |

#### Constraints

- 기존 `test/plan-inspect.test.js` 단언은 바꾸지 않는다.
- `rules/cli.md`는 TASKS-004가 `coordinate note` 문단을 고친 뒤의 내용 위에서 `plan inspect` 문단만 고친다.
- 근거 줄 상한은 UTF-16 단위 200 그대로다. code point로 세지 않는다.
- 경계 판정은 정규식 생성 없이 글자 비교로 한다. needle은 정규식이 아닌 부분 문자열이다(`plan-inspect.ts:659`).
- `.ts`·`.js` 줄 길이는 120자 이내다. `npm run typecheck`가 통과해야 한다.

### drive-execution/retro-followups-hardening/006

#### Goal & intent

구현 task 001~005가 모두 통합된 integration 작업 트리에서 `npm run ci`를 한 번 실행해 epic Success criteria 8·13의 종단 조건(전체 테스트·커버리지·lint·문서 모양·typecheck·생성본 parity·audit)을 증명한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.