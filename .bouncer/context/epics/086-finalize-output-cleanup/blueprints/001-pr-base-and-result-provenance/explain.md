---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/086-finalize-output-cleanup/blueprints/001-pr-base-and-result-provenance/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-06T11:12:53.893+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '086'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: e3dab07dfa286cc9764afd8e167d6fa2a0a28a77
      range_to: fc973a5a204cb4acd8c59701eebaf822f9240d16
      diff_sha: bbf51ff60121ff2f99728d9423f0a477754f4c504b7f0655b49bf6becba2bc4d
      quiz_score: 4/5
      disposition: 4/5. Q3만 틀림(repair DAG는 001,002 → 004 → 003). 마감 계속.
      recorded_at: '2026-10-06T11:20:00+09:00'
  task_commits:
    - task: EPIC-086/BP-001/TASK-001
      sha: 1bff1628
      intent_anchor: task-001
    - task: EPIC-086/BP-001/TASK-002
      sha: dcdbbddc
      intent_anchor: task-002
    - task: EPIC-086/BP-001/TASK-004
      sha: fc973a5a
      intent_anchor: task-004
  coordinator:
    integration_branch: feat/086-001-pr-base-and-result-provenance
    tasks:
      - id: '001'
        branch: bouncer/086-001-001
        scope_revision: null
        actual_paths:
          - CHANGELOG.md
          - docs/configuration.md
          - scripts/src/lib/finalize-digest.ts
          - scripts/src/lib/finalize-pr.ts
          - skills/bouncer-finalize/references/draft-pr.md
          - test/finalize-digest.test.js
          - test/finalize-pr.test.js
          - test/skill-bouncer-finalize.test.js
      - id: '002'
        branch: bouncer/086-001-002
        scope_revision: null
        actual_paths:
          - CHANGELOG.md
          - scripts/src/lib/finalize.ts
          - test/finalize-pure.test.js
          - test/finalize.test.js
      - id: '003'
        branch: null
        scope_revision: null
        actual_paths: []
      - id: '004'
        branch: bouncer/086-001-004
        scope_revision: r1
        actual_paths:
          - scripts/src/lib/finalize.ts
---
# Explain

## Background

`/bouncer-finalize`가 PR base를 추측하거나, 결과 JSON에 drive 원장 요약을 `coordinator`로 실어 모델이 실행 기록으로 읽게 했다. 이 블루프린트는 digest가 config 다음 `origin/HEAD`만 보고, 둘 다 없으면 사용자에게 묻게 하며, 성공/실패 결과에서 `coordinator`를 뺀다.

드라이브는 계획 DAG `001 → 002 → 003`으로 시작했다. 003의 `npm run ci`가 `scripts/src/lib/finalize.ts` JSDoc `max-len`으로 한 번 실패한 뒤, repair 004가 그 파일만 고치고 003이 004에 의존하게 바뀌었다. 통합 HEAD는 `fc973a5a204cb4acd8c59701eebaf822f9240d16`이다.

## Intuition

finalize가 말해 주는 것은 저장소에서 확인한 값뿐이고, drive가 어떻게 돌았는지는 결과 JSON에 다시 싣지 않는다.

## Code

- `scripts/src/lib/finalize-digest.ts` — `resolvePrBase`: config 다음 `origin/HEAD`. git은 `run`으로만 호출한다.
- `scripts/src/lib/finalize-pr.ts`, `skills/bouncer-finalize/references/draft-pr.md` — 탐지 실패 시 base 질문. `finalize.pr` A/B/C는 그대로다.
- `scripts/src/lib/finalize.ts` — 결과에서 `coordinator` 제거. `collectCoordinatorProvenance`의 partial_closed 원장 읽기는 유지. 004는 `@returns` JSDoc 줄바꿈만.
- 테스트: `test/finalize-digest.test.js`, `test/finalize-pr.test.js`, `test/skill-bouncer-finalize.test.js`, `test/finalize.test.js`, `test/finalize-pure.test.js`
- `docs/configuration.md`, `CHANGELOG.md`

워커 브랜치: `bouncer/086-001-001` `249583a4651ec23fb2a0e947cb5a8033a6b9d9aa`, `bouncer/086-001-002` `b5ca20b2b195f3c0335e8fcee5d8e96f931bac34`, `bouncer/086-001-004` `993974b466715a340b576d1f7a8f9a64b6c9cd6c`. 통합 브랜치 `feat/086-001-pr-base-and-result-provenance`.

001 실제 경로: `CHANGELOG.md`, `docs/configuration.md`, `scripts/src/lib/finalize-digest.ts`, `scripts/src/lib/finalize-pr.ts`, `skills/bouncer-finalize/references/draft-pr.md`, `test/finalize-digest.test.js`, `test/finalize-pr.test.js`, `test/skill-bouncer-finalize.test.js`. scope 개정 없음.
002 실제 경로: `CHANGELOG.md`, `scripts/src/lib/finalize.ts`, `test/finalize-pure.test.js`, `test/finalize.test.js`.
004 실제 경로: `scripts/src/lib/finalize.ts`.

## Quiz

질문 5개. 범위 `e3dab07..fc973a5`에 PR base 탐지, 결과 provenance, repair DAG가 함께 들어 있어서 다섯이다.

1. PR base를 정할 때 digest가 쓰는 순서는?
   - A) 항상 `main`
   - B) config 다음 `origin/HEAD`. 둘 다 없으면 사용자에게 묻는다
   - C) `origin/HEAD`를 먼저 보고, 없으면 config

2. 성공한 finalize 결과 JSON에서 빠진 필드는?
   - A) `coordinator`
   - B) `integration`
   - C) `worktrees`

3. 003 `npm run ci`가 `finalize.ts` `max-len`으로 실패한 뒤 DAG는?
   - A) 001·002·003을 병렬로 다시 돌린다
   - B) 003을 검증 태스크 두 개로 나눈다
   - C) 001,002 → 004 → 003

4. repair 004가 고친 것은?
   - A) `finalize.pr` A/B/C 선택지
   - B) `buildCoordinatorProvenance` `@returns` JSDoc 줄바꿈 (`scripts/src/lib/finalize.ts`)
   - C) partial_closed가 원장을 읽는 `collectCoordinatorProvenance` 구조

5. 이 드라이브 통합 HEAD와 커밋 워커 브랜치는?
   - A) HEAD `fc973a5`, 워커 `bouncer/086-001-001` · `002` · `004`
   - B) HEAD `e3dab07`, 워커 없음
   - C) HEAD `1bff162`, 워커 `bouncer/086-001-003`만

## 이해 상태

`quiz_score` 4/5. `diff_sha` `bbf51ff60121ff2f99728d9423f0a477754f4c504b7f0655b49bf6becba2bc4d`. `range_from` `e3dab07` · `range_to` `fc973a5`.

정답 B / A / C / B / A. 응답 B / A / B / B / A. Q1·Q2·Q4·Q5 맞음, Q3 틀림(정답 C: 001,002 → 004 → 003). disposition: 점수 미달은 마감을 막지 않음.

## Tasks

### EPIC-086/BP-001/TASK-001 · `1bff1628`

#### Goal & intent

`bouncer finalize prepare` digest가 PR base를 config `pr.base` → `base_branch` → `origin/HEAD` → `null` 순서로 정한다. `null`이면 draft-pr 지침이 사용자에게 base를 묻는다(epic Success criteria 1–4). 완료 명령은 `npm test`다.

#### Current behavior

- digest 타입 `git: { branch: string | null; pr_base: string }`(`scripts/src/lib/finalize-digest.ts:81`), `pr: ReturnType<typeof buildPrDraft>`(:90).
- `resolvePrBase(repoRoot)`(:141-149)는 `readConfig`(:142)로 `pr.base` → `base_branch` → 리터럴 `'main'`(:149)을 고른다. 주석(:135-136)도 `main`이라고 적는다. 호출은 :739 `pr_base: resolvePrBase(checkoutRoot)` 하나이고, `checkoutRoot`는 원장이 있으면 integration worktree, 아니면 repoRoot다(:434-437).
- `buildPrDraft(digest, { now, config })`(`scripts/src/lib/finalize-pr.ts:290`)가 :297에서 다시 `'main'`을 기본값으로 쓰고, :309에서 `title_prefix`를 `[YYMMDD] (→ ${capitalizeFirst(prBase)}) [Types]`로, :310에서 `base`를 만든다. `PrDraft` 타입은 :16-29(`title_prefix: string; base: string`)다.
- git seam: `prepareFinalizeDigest({ repoRoot, blueprintDir, exec?, now? })`(finalize-digest.ts:406-413)의 `exec?: GitExec`(:36, `(args) => { status, stdout }`)가 `run`(:454-456)으로 감싸여 range·diff·log 호출에 쓰인다. 기본값은 `defaultExec` spawnSync(:111-122)다. `resolvePrBase`는 지금 `run`을 받지 않는다.
- `origin/HEAD`는 linked worktree에서도 읽힌다(`refs/remotes`는 worktree끼리 공유). 이 저장소는 `git symbolic-ref --short refs/remotes/origin/HEAD` → `origin/develop`이다.
- `init.ts:64-84`의 `gitSymbolicRefShort`·`detectDefaultBranch`는 export되지 않았고, 현재 HEAD로 fallback한다. finalize에서는 현재 HEAD가 feature 브랜치이므로 이 함수를 재사용하지 않는다.
- 지침: `skills/bouncer-finalize/references/draft-pr.md`
  - :6 `finalize.pr` ACQ(A 초안 PR / B 로컬만 / C 외부 단계 취소)
  - :8 config `pr.base`(와 `base_branch`)를 쓰라고 한다
  - :16-19 digest `pr.title_prefix`를 다시 계산하지 말라고 한다
  - :66 `gh pr create --draft --base <config.base_branch>` — digest `pr.base`와 출처가 다르다
- 문서: `docs/configuration.md:16, 22`는 `base_branch`·`pr.base`의 finalize PR 용도만 적고 fallback을 적지 않는다.
- I/O coupling:
  - finalize-digest.ts:142, :750 `readConfig`(`config.ts:100-129`, `.bouncer/config.json` 읽기)
  - :111-122 `defaultExec` spawnSync
  - `buildPrDraft`는 `now`를 주입하면 순수하다.
- 재현:
  - `npm run build && node --test test/finalize-digest.test.js`
  - 원격 없는 fixture(`buildStandaloneFixture`, `test/finalize-digest.test.js:62-`)에서 :189-190이 `(→ Main)`과 `'main'`을 단언한다.

#### Target behavior

- 성공 경로:
  - config `pr.base`가 비어 있지 않은 문자열이면 그 값, 아니면 `base_branch`, 아니면 `run(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])`가 status 0이고 stdout이 `origin/<name>`일 때 `<name>`을 쓴다.
  - 위 경우 digest `git.pr_base`·`pr.base`는 그 문자열이고, `pr.title_prefix`는 지금과 같은 형식이다.
- null 경로:
  - 모든 후보가 없거나, git이 실패하거나, stdout이 비었거나, `origin/` 접두사가 없으면 `git.pr_base`·`pr.base`·`pr.title_prefix`가 `null`이다.
  - 현재 checkout branch로 대신하지 않는다.
  - digest 전체는 `ok: true`로 유지한다.
- 항상: `pr.title_prefix_template`이 `[YYMMDD] (→ {base}) [Types]`이다. base가 있으면 `title_prefix`는 template의 `{base}`에 `capitalizeFirst(base)`를 넣은 값과 같다.
- 지침:
  - draft-pr.md는 `gh pr create --base <digest pr.base>`를 쓴다.
  - `pr.base`가 `null`이면 A를 고른 뒤 사용자에게 base 브랜치 이름을 묻는다. 받은 값의 첫 글자를 대문자로 바꿔 template의 `{base}`를 채우고, `--base`에는 받은 값을 그대로 쓴다.
  - 답이 없으면 B(로컬만)로 처리하고 cleanup을 계속한다.
- 보존: `init`의 `base_branch` 탐지, config 값이 있을 때의 출력, `pr.head`·`pr.draft`·`sections`.

#### Interface

- 제공:
  - digest `git.pr_base: string | null`
  - `PrDraft.base: string | null`, `PrDraft.title_prefix: string | null`, 신규 `PrDraft.title_prefix_template: string`
  - `buildPrDraft`는 `git.pr_base`가 비어 있지 않은 문자열이 아니면 `base`·`title_prefix`를 `null`로 둔다.
  - `origin/HEAD` 조회는 `prepareFinalizeDigest`의 `exec` seam(`exec(args: string[]) → { status: number; stdout: string }`)을 거친다.
- 거부(throw 없이 `null`로 접는 경우):
  - config 값이 빈 문자열·공백·비문자열
  - `symbolic-ref`가 0이 아닌 status
  - stdout이 비었거나 `origin/`로 시작하지 않음
- 거부(값으로 쓰지 않는 것): 현재 HEAD branch, 리터럴 `main`·`develop` 추측.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `resolvePrBase`, `prepareFinalizeDigest`, digest `git` 타입 | Modify | config → `'main'`으로 PR base를 정한다(:141-149, :739) | `run`을 받아 `origin/HEAD`를 조회하고 `null`을 허용한다 | 탐지 진입점 |
| `scripts/src/lib/finalize-pr.ts` | `buildPrDraft`, `PrDraft` | Modify | `'main'` 기본값과 `title_prefix`를 만든다(:16-29, :297-310) | `'main'` 기본값을 제거하고 `title_prefix_template`을 추가한다 | 제목·base 출력 |
| `skills/bouncer-finalize/references/draft-pr.md` | `finalize.pr` 절, `gh pr create` 명령 | Modify | config `base_branch`를 `--base`로 쓴다(:8, :66) | digest `pr.base` 사용, `null`일 때 묻기와 template 채우기 | 모델이 읽는 PR 지침 |
| `docs/configuration.md` | `base_branch`·`pr.base` 행 | Modify | finalize PR 용도만 적는다(:16, :22) | 없을 때 `origin/HEAD` → 묻기 순서를 적는다 | 사용자 문서 정합 |
| `test/finalize-digest.test.js` | PR 단언, `now` 테스트, 신규 origin 테스트 | Modify | 원격 없는 fixture에서 `(→ Main)`·`'main'`을 단언한다(:189-190, :370-379) | `null`과 template을 단언하고, `origin/HEAD` fixture와 exec stub 테스트를 추가한다 | digest shape을 단언하는 테스트 |
| `test/finalize-pr.test.js` | `buildPrDraft` 테스트 | Modify | `pr_base` 문자열 fixture만 있다(:63-144) | `pr_base: null`·누락 케이스와 template을 단언한다 | `PrDraft` shape을 단언하는 테스트 |
| `test/skill-bouncer-finalize.test.js` | draft-pr 문구 테스트 | Modify | `pr.title_prefix` 문구를 단언한다(:180) | `--base <config.base_branch>` 부재와 `title_prefix_template` 문구를 단언한다 | 지침 회귀 고정 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 085 변경까지 기록되어 있다(:8-33) | PR base 탐지 항목을 추가한다 | Project rule |

#### Constraints

- 탐지 git 호출은 반드시 `run`을 거쳐 기존 exec stub 테스트(`test/finalize-digest.test.js:535-565`)가 주입한 함수로만 실행되게 한다. stub이 알 수 없는 인자에 status 0과 빈 stdout을 주면 `null`로 접힌다.
- `finalize.pr` ACQ의 A/B/C 선택지 구성은 바꾸지 않는다. base 질문은 A 선택 뒤의 후속 질문이다.
- `scripts/lib/*.js`는 빌드 산출물이므로 커밋하지 않는다.

### EPIC-086/BP-001/TASK-002 · `dcdbbddc`

#### Goal & intent

`bouncer finalize`의 dry-run, `--yes`(빈 커밋 경로 포함), partial_closed, `coordinator-ledger` 거절 결과에 `coordinator` 키가 없다. top-level `worktrees`·`branch`·`integration`·`ledgerFile`·`integrationPath` 값은 지금과 같다. 내부 provenance는 실제로 읽히는 `status`, `ledgerFile`, `base`, `integrationBranch`, `integrationPath`, `worktrees`만 만든다(epic Success criteria 5·6). 완료 명령은 `npm test`다.

#### Current behavior

- `buildCoordinatorProvenance`(`scripts/src/lib/finalize.ts:705-755`)가 원장에서 task별 `id`·`status`·`sha`·`worktree`·`branch`·`scopeRevision`·`paths`·`actualPaths`·`decisions`(:716-726)와 top-level `integrationHead`·`revision`·`decisions`·`lifecycleStatus`·`repairWaves`·`terminalFailure`·`userConfirmed`(:727-745)를 만든다. `worktrees`(:746-749)는 `integrationPath`와 `tasks[].worktree`만으로 만든다.
- `finalize()`가 `coordinator`를 싣는 반환은 다섯 곳이다.
  - partial_closed 거절: :971-979
  - `coordinator-ledger` 거절: :1025-1034. `coordinator: collected`는 :1032에 있다.
  - dry-run: :1099
  - `--yes`에서 stage할 것이 없을 때: :1119
  - `--yes` 성공: :1254
- 다음 반환에는 `coordinator`가 없다: evidence-mismatch(:991), validate(:996), out-of-scope(:1007), verify(:1157, :1165-1173).
- scripts/src에서 provenance 필드를 읽는 곳은 다음뿐이다.
  - `status`: :1024
  - `ledgerFile`·`integrationPath`: :1029-1030
  - `integrationBranch`: :1037, `finalize-digest.ts:715-716`
  - `worktrees`: :975, :1039
  - `base`: :1179
  - `tasks[]`의 개별 필드와 나머지 top-level 필드를 읽는 코드는 없다. 결과의 `coordinator` 키와 테스트만 소비한다.
- `finalize-digest.ts:519-522`는 `integrationBranch`를 얻으려고만 이 함수를 부른다. digest 결과에는 `coordinator`가 없다(`test/finalize-digest.test.js:256`).
- 스킬·rule·docs 가운데 finalize payload의 `coordinator.*`를 읽으라는 문장은 없다. 스킬이 읽는 필드는 다음과 같다.
  - `integration`: `skills/bouncer-finalize/SKILL.md:53-58`
  - `worktrees`: `SKILL.md:87`, `references/cleanup-handoff.md:12`
  - `branch`: `references/draft-pr.md:58,64`
- 코드 주석 `finalize.ts:800-801, 938-941, 951, 1229-1230`과 `test/finalize.test.js:1609`가 "cleanup이 payload `coordinator`를 읽는다"고 적고 있다.
- CLI(`cli-git-commands.ts:125-131`)는 결과를 필드 걸러 내기 없이 `JSON.stringify`한다.
- I/O coupling:
  - `resolveCheckoutBranch`는 `finalize.ts:684`에서 `execFileSync('git', ['symbolic-ref', …])`을 실행한다. task별 호출은 :721에 있고, integration 호출 :736과 non-drive 호출 :1037은 남는다.
  - `readCoordinatorLedger`는 `scope.ts:451`이며 `finalize.ts:808, 984`에서 읽는다.
  - `finalize()`의 seam은 `git`·`clearPointer`·`next`·`verifyExec`(:954-965)뿐이다. 그래서 drive 테스트는 실제 worktree를 만든다(`test/finalize.test.js:1330-1372`).
- 재현: `npm run build && node --test test/finalize.test.js test/finalize-pure.test.js`.

#### Target behavior

- 성공 경로:
  - 위 다섯 반환에서 `coordinator` 키가 사라진다(`'coordinator' in res === false`).
  - `worktrees` 순서는 integration 다음 worker이고, 값은 지금과 같다.
  - `branch`는 drive에서는 `integrationBranch`, non-drive에서는 checkout branch로 지금과 같다.
  - `coordinator-ledger` 거절의 `reason`·`code`·`ledgerFile`·`integrationPath`·`integration`은 지금과 같다.
- provenance 반환:
  - 성공: `{ status: 'ok', ledgerFile, base, integrationBranch, integrationPath, worktrees }`
  - unreadable: `{ status: 'unreadable', ledgerFile, integrationPath, base: null, integrationBranch: null, worktrees: [] }`
  - 원장이 없으면 `null`로 지금과 같다.
  - task별 `git symbolic-ref` 호출이 없어진다.
- 보존: digest `git.branch`, trailer base(`ledgerBase`), partial_closed의 `nextPlan`·`preserved`·`message`, 거절 reason 집합.

#### Interface

- 제공:
  - `buildCoordinatorProvenance(ledger, { integrationPath, ledgerFile }) → { status: 'ok'; ledgerFile; base; integrationBranch; integrationPath; worktrees: string[] } | null`
  - `collectCoordinatorProvenance`는 위 성공형, unreadable형, `null` 가운데 하나를 반환한다.
  - `finalize()` 결과에 `coordinator` 키가 없다.
  - 두 함수의 export(`finalize.ts:1267`)는 유지한다.
  - `worktrees`는 반환에서 빠지는 `tasks` 대신 원장 `ledger.tasks[].workerPath`를 직접 읽어 만든다. 순서(integration 다음 worker, 원장 task 순서)와 빈 `workerPath` 제외 규칙은 지금과 같다.
- 거부: 반환 객체에 `tasks`, `decisions`, `repairWaves`, `terminalFailure`, `userConfirmed`, `lifecycleStatus`, `integrationHead`, `revision`, `scopeRevision`, `actualPaths` 키를 두지 않는다. 새 reason이나 새 top-level 필드를 추가하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize.ts` | `buildCoordinatorProvenance`, `provenanceFromLedgerRead`, `UnreadableProvenance`, `LedgerTaskLike`, `CoordinatorLedgerLike`, `finalize` | Modify | 원장 provenance 전체를 만들어 결과 `coordinator`에 싣는다 | provenance를 여섯 필드로 줄이고 다섯 반환에서 `coordinator`를 뺀다. 안 쓰게 되는 `stringList`(:668)와 낡은 주석을 정리한다 | 소비처는 :1024-1039, :1179, :975뿐이다 |
| `test/finalize.test.js` | drive dry-run·unreadable·partial 테스트 | Modify | `res.coordinator`의 필드를 단언한다(:1374-1421, :1569-1613) | `coordinator` 부재와 top-level `worktrees`·`branch`·`ledgerFile`·`integrationPath`를 단언한다 | 결과 shape을 단언하는 테스트 |
| `test/finalize-pure.test.js` | `buildCoordinatorProvenance` 테스트 | Modify | `tasks[]`·`decisions`·`integrationHead`·`revision`을 단언한다(:858-941, :1057-1069) | 여섯 필드와 금지 키 부재를 단언하고, :1057-1069는 `worktrees`로 다시 쓴다 | provenance shape을 단언하는 테스트 |
| `CHANGELOG.md` | `[Unreleased]` Removed | Modify | :30-33이 explain·digest의 `coordinator` 제거를 기록한다 | 같은 항목에 finalize 결과의 `coordinator` 제거를 더한다 | Project rule |

#### Constraints

- partial_closed 경로가 `collectCoordinatorProvenance`로 원장을 다시 읽는 구조(:971)는 바꾸지 않는다.
- 결과의 나머지 키 이름·순서 의미와 종료 코드(0/1)를 유지한다.
- `scripts/lib/*.js`는 빌드 산출물(gitignore)이므로 커밋하지 않는다.

### EPIC-086/BP-001/TASK-003

#### Goal & intent

TASKS-001과 TASKS-002가 통합된 integration HEAD에서 `npm run ci`(build emit 확인, coverage 테스트, lint, lint:docs, lint:context-comments, typecheck, audit)가 통과한다(epic Success criteria 7).

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-086/BP-001/TASK-004 · `fc973a5a`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/finalize.ts` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.