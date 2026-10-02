---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/001-quiz-explain-pr-drive-record/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T17:18:23.134+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '085'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: 9051e13b1feeecda953766fce049de771657c7b3
      range_to: e8e5c3f0e5ccac783814bc210eec543135ce1765
      diff_sha: aa18366ec7460bed9e10249b5f833fe788e117abf9a51fe2bd3f4986ffe055db
      recorded_at: '2026-10-02T17:25:00+09:00'
  task_commits:
    - task: EPIC-085/BP-001/TASK-001
      sha: '163147e4'
      intent_anchor: task-001
    - task: EPIC-085/BP-001/TASK-002
      sha: a991bdec
      intent_anchor: task-002
    - task: EPIC-085/BP-001/TASK-003
      sha: 974f9877
      intent_anchor: task-003
    - task: EPIC-085/BP-001/TASK-005
      sha: e8e5c3f0
      intent_anchor: task-005
---
# Explain

## Background
finalize 퀴즈가 제품 동작 대신 이번 실행의 분할·순서·복구를 묻고, explain과 PR이 그 실행 기록을 저장소 지식처럼 남겼다. G16 필수 절에 `## 이해 상태`가 있고 comprehension에 `quiz_score`·`disposition`이 있어 점수와 처분이 문서에 고정됐다. `finalize --yes`는 explain frontmatter에 `bouncer.coordinator`를 썼고, `finalize prepare` digest는 최상위 `coordinator`와 `tasks[].actual_paths`를 모델에 넘겼다.

이 변경은 퀴즈를 바뀐 제품 동작만 묻게 하고, 새 explain은 Background·Intuition·Code·Quiz 네 절만 필수로 둔다. 새 comprehension 엔트리는 `range_from`·`range_to`·`diff_sha`·`recorded_at`만 남긴다. 퀴즈 점수·정답·응답은 파일에 쓰지 않는다. 옛 `## 이해 상태`와 옛 필드는 읽기만 하고 필수로 보지 않는다.

## Intuition
마감 문서는 제품이 어떻게 바뀌었는지만 남기고, 이번 실행이 어떻게 흘렀는지는 원장에 둔다.

## Code
- `scripts/src/lib/comprehension.ts` — `EXPLAIN_SECTION_DEFS` 네 키, `resolveComprehensionEntry`는 `range_from`·`diff_sha`만 필수
- `scripts/src/lib/validate-sections.ts` — 옛 `## 이해 상태`를 Quiz와 분리
- `scripts/src/lib/validate-gates.ts` — G16가 네 절과 comprehension 해시만 검사
- `scripts/src/lib/templates.ts` — scaffold explain에 `## 이해 상태` 없음
- `scripts/src/lib/finalize.ts` — `writeExplainCoordinator` 삭제
- `scripts/src/lib/finalize-digest.ts` — digest에서 `coordinator`·`actual_paths` 제거, drive면 `git.branch`는 integration branch
- `references/explain-diff/index.md`, `skills/bouncer-finalize/references/explain-quiz.md`, `skills/bouncer-finalize/references/draft-pr.md`

## Quiz
1. G16가 필수로 보는 explain 본문 절은 어느 집합인가?
   - A) Background, Intuition, Code, Quiz, 이해 상태
   - B) Background, Intuition, Code, Quiz
   - C) Background, Code, Quiz

2. 새 comprehension 엔트리에서 G16가 필수로 보는 필드는?
   - A) `range_from`과 `diff_sha`
   - B) `quiz_score`와 `disposition`
   - C) `range_to`와 `recorded_at`만

3. `bouncer finalize prepare` digest에서 빠진 것은?
   - A) `git.branch`
   - B) `range.diff_sha`
   - C) 최상위 `coordinator`와 `tasks[].actual_paths`

4. 초안 PR `주요 변경 내용`에 넣으면 안 되는 것은?
   - A) 바뀐 파일·동작·인터페이스
   - B) 작업 과정(복구 회차, worker, integration head)
   - C) Explain `## Code`에서 가리키는 경로

## Tasks

### EPIC-085/BP-001/TASK-001 · `163147e4`

#### Goal & intent

finalize gate G16이 explain의 `## Background`·`## Intuition`·`## Code`·`## Quiz` 네 절과, comprehension 엔트리의 `range_from`·`diff_sha`만 필수로 보게 한다. `bouncer scaffold explain`은 `## 이해 상태` 없이 explain을 만든다. 옛 explain(`## 이해 상태` 절, `quiz_score`·`disposition` 필드)은 계속 통과한다. 수용 기준은 epic 085 성공 조건 3·4·6이고 검증 명령은 `npm test`다.

#### Current behavior

- `EXPLAIN_SECTION_DEFS`(`scripts/src/lib/comprehension.ts:14-20`)가 `'understanding'`을 포함한다. G16(`scripts/src/lib/validate-gates.ts`의 finalize 분기, `parseExplainSections` 결과에 `EXPLAIN_SECTION_DEFS.filter`)은 `## 이해 상태` 본문이 비면 `explain missing written sections: understanding`으로 실패한다.
- `resolveComprehensionEntry`(`scripts/src/lib/comprehension.ts:108-160`)는 마지막 엔트리의 `range_from`·`diff_sha`·`disposition`·`quiz_score` 중 하나라도 비면 `{ ok: false, reason: 'incomplete' }`를 돌려주고, G16은 `explain comprehension record missing`으로 실패한다.
- `EXPLAIN_SECTION_HEADINGS`(`scripts/src/lib/validate-sections.ts:108-116`)는 `## 이해 상태`를 `understanding` 키로 파싱한다. `## Tasks`는 필수 목록 밖의 `tasks` 키다. 알 수 없는 제목은 바로 앞 절에 흡수된다.
- explain 템플릿(`scripts/src/lib/templates.ts:159-174`)은 `## Quiz` 다음에 `## 이해 상태`, `## Tasks`를 둔다. 바로 위 주석은 "필수 다섯 절"이라고 적는다. `LEGACY_SCAFFOLD_COMMENT_BODIES`(`:237-`)의 `:295`에는 옛 "퀴즈 결과와 disposition을…" 주석 문자열이 있다.
- 재현: `node --test test/comprehension.test.js test/validate-gates.test.js test/scaffold.test.js`가 지금 통과하며, 다섯 키(`test/comprehension.test.js:63`), 빈 `disposition`·`quiz_score`의 incomplete(`:120-131`, `:148-151`), 빈 `quiz_score`의 G16 실패(`test/validate-gates.test.js:2104-2124`), 템플릿의 `## 이해 상태`(`test/scaffold.test.js:418`)를 단언한다.

#### Target behavior

- 성공
  - `EXPLAIN_SECTION_DEFS`는 `['background', 'intuition', 'code', 'quiz']`다.
  - `{ range_from, range_to, diff_sha, recorded_at }`만 있는 엔트리가 `resolveComprehensionEntry`에서 `{ ok: true, entry }`이고, 네 절이 채워진 explain과 함께 G16을 통과한다.
  - `scaffold explain` 본문에 `## Background`, `## Intuition`, `## Code`, `## Quiz`, `## Tasks`가 이 순서로 있고 `## 이해 상태`는 없다.
- 실패
  - `range_from` 또는 `diff_sha`가 비거나 공백뿐이면 계속 `{ ok: false, reason: 'incomplete' }`이고 G16 `explain comprehension record missing`이다.
  - 네 절 중 하나라도 비면 계속 `explain missing written sections: <key>`이다.
- 보존
  - `quiz_score`·`disposition`이 빈 문자열이거나 값이 있는 옛 엔트리도 `range_from`·`diff_sha`가 있으면 `ok: true`이고, 반환 `entry`는 원본 객체 그대로다.
  - 옛 explain의 `## 이해 상태` 절은 `understanding` 키로 계속 따로 파싱되어 `quiz` 본문에 섞이지 않는다. 그 절이 비어 있어도 G16은 실패하지 않는다.
  - `LEGACY_SCAFFOLD_COMMENT_BODIES` 내용과 G22, `computeDiffSha`, diff_sha 대조는 바뀌지 않는다.

#### Interface

- 제공
  - `EXPLAIN_SECTION_DEFS: readonly ['background', 'intuition', 'code', 'quiz']` — G16 필수 절 키.
  - `resolveComprehensionEntry(comprehension: unknown)` → `{ ok: true, entry: { range_from: string; diff_sha: string } & Record<string, unknown> }` 또는 `{ ok: false, reason: 'not-a-list' | 'missing' | 'incomplete' }`.
  - explain 템플릿 본문 제목 순서: `## Background`, `## Intuition`, `## Code`, `## Quiz`, `## Tasks`.
- 거부
  - 배열이 아닌 `comprehension`(옛 단일 객체 포함) → `not-a-list`, 빈 배열 → `missing`, 마지막 엔트리가 객체가 아니거나 `range_from`·`diff_sha`가 비면 → `incomplete`. 지금과 같다.
- 용어: "옛 형식 엔트리"는 `quiz_score`·`disposition`을 가진 comprehension 항목이다. 예: `{ range_from: 'develop', range_to: 'deadbeef', diff_sha: 'abc123', quiz_score: '5/5', disposition: 'ok', recorded_at: 't' }`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/comprehension.ts` | `EXPLAIN_SECTION_DEFS`, `resolveComprehensionEntry` | Modify | 다섯 절 키, 네 필수 필드 판정 | 네 절 키, `range_from`·`diff_sha`만 필수, 반환 타입 축소 | G16 필수 목록과 엔트리 판정의 정본 |
| `scripts/src/lib/validate-sections.ts` | `EXPLAIN_SECTION_HEADINGS` | Modify | `understanding`을 필수 키처럼 설명 | 정규식은 남기고, 옛 절을 따로 떼어 두기 위한 비필수 키라는 주석으로 바꿈 | 옛 explain의 `## 이해 상태`가 `quiz`에 흡수되지 않게 하는 지점 |
| `scripts/src/lib/templates.ts` | explain 템플릿 | Modify | `## 이해 상태` 제목과 "필수 다섯 절" 주석 | 제목 삭제, 주석을 네 절로 | `scaffold explain` 출력의 정본 |
| `test/comprehension.test.js` | `EXPLAIN_SECTION_DEFS`·`resolveComprehensionEntry` 단언 | Modify | 다섯 키, 빈 점수·처분 incomplete 단언 | 네 키, 새 엔트리 ok, 옛 엔트리 ok, 빈 `range_from`·`diff_sha`만 incomplete | 계약 변경을 구성·단언하는 테스트 |
| `test/validate-gates.test.js` | finalize G16 테스트 | Modify | 빈 `quiz_score`가 G16 실패라고 단언 | 점수·처분 없는 엔트리 통과, 빈 이해 상태 절이 있는 옛 explain 통과 단언 | G16 판정 검증 지점 |
| `test/scaffold.test.js` | `scaffoldExplain` 제목 단언 | Modify | `## 이해 상태` 포함 단언 | 네 절과 `## Tasks` 포함, `## 이해 상태` 부재 단언 | 템플릿 검증 지점 |

#### Constraints

- `LEGACY_SCAFFOLD_COMMENT_BODIES`의 문자열(특히 "퀴즈 결과와 disposition을…")을 지우거나 바꾸지 않는다. 템플릿 본문만 바꾼다.
- review finding `disposition`(G14)과 관련된 코드·테스트는 건드리지 않는다. `disposition` 문자열 일괄 치환을 쓰지 않는다.
- G16 실패 메시지 문자열(`explain missing written sections`, `explain comprehension record missing`, `explain diff_sha does not match range_from..HEAD`)은 바꾸지 않는다.
- 옛 엔트리를 변환하거나 다시 쓰지 않는다. 읽기 호환만 둔다.
- `test/cli-commit.test.js`, `test/commit-task.test.js`, `test/retention-migration.test.js`, `test/finalize.test.js`의 옛 형식 fixture는 계속 통과해야 하며 이 task에서 고치지 않는다.

### EPIC-085/BP-001/TASK-002 · `a991bdec`

#### Goal & intent

`finalize --yes`가 coordinator drive를 닫을 때 `explain.md` frontmatter에 `bouncer.coordinator`를 쓰지 않게 하고, `bouncer finalize prepare` digest에서 최상위 `coordinator`와 `tasks[].actual_paths`를 뺀다. digest의 `git.branch` 결정과 `finalize --yes` 결과 payload(`coordinator`, `worktrees`)는 그대로 둔다. 수용 기준은 epic 085 성공 조건 2·5이고 검증 명령은 `npm test`다.

#### Current behavior

- `writeExplainCoordinator`(`scripts/src/lib/finalize.ts:936-973`)가 provenance가 있으면 explain frontmatter에 `bouncer.coordinator = { integration_branch, tasks: [{ id, branch, scope_revision, actual_paths }] }`를 쓴다. 호출은 `finalize()`의 쓰기 단계(`:1251`, `writeExplainTaskCommits`·`writeExplainTaskContext` 다음)이고, `:1288`에서 export된다.
- `prepareFinalizeDigest`(`scripts/src/lib/finalize-digest.ts`)
  - `buildCoordinatorProvenance`로 `coordinator`를 만들고(`:516`), `git.branch`를 `coordinator.integrationBranch` 또는 `resolveCheckoutBranch`로 정한다(`:732-734`).
  - 원장 `tasks[].actualPaths`로 `actualPathsById`를 만들고(`:520-533`) 각 task digest에 `actual_paths`를 싣는다(`:583-586`, `:613`, 타입 `:56`).
  - 결과 객체에 `coordinator`를 그대로 싣는다(타입 `:89`, 값 `:764`).
- 소비처: `finalize-pr.ts`의 `buildPrDraft`는 `coordinator`·`actual_paths`를 읽지 않는다. `cli-git-commands.ts:77`은 digest를 JSON으로 출력한다. 지침 소비처는 `explain-quiz.md`·`draft-pr.md`이며 TASKS-003이 지운다.
- 재현: `node --test test/finalize.test.js test/finalize-digest.test.js`가 통과하며, explain에 coordinator 색인이 남는다는 단언(`test/finalize.test.js:1599-1617`), drive digest의 `d.coordinator.integrationBranch`·`d.tasks[0].actual_paths` 단언(`test/finalize-digest.test.js:254-259`)이 있다.

#### Target behavior

- 성공
  - coordinator 원장이 있는 drive에서 `finalize --yes` 뒤 `explain.md` frontmatter에 `bouncer.coordinator`가 없고, `bouncer.task_commits`는 계속 배열로 남는다.
  - drive digest에 최상위 `coordinator` 키가 없고, `tasks[]` 항목에 `actual_paths` 키가 없다. `git.branch`는 원장의 `integrationBranch`(fixture의 `feat/integ`)다.
- 실패
  - 원장이 깨졌으면 digest는 계속 `{ ok: false, reason: 'coordinator-ledger' }`다.
- 보존
  - drive가 아닌 digest의 `git.branch`는 checkout branch다.
  - `finalize --yes` 결과 payload의 `coordinator`(`integrationBranch`, `tasks`, `ledgerFile`, `status`)와 top-level `worktrees`, `branch`는 바뀌지 않는다.
  - 옛 explain에 이미 있는 `bouncer.coordinator`는 지우거나 다시 쓰지 않는다. 다시 finalize되는 일도 없다.
  - digest의 다른 필드(`range`, `tasks[].commit`, `tasks[].affected_paths`, `changed_paths`, `unverified`, `pr`)는 그대로다.

#### Interface

- 제공
  - `prepareFinalizeDigest` 성공 결과 키: `ok`, `version`, `blueprint`, `range`, `git`, `tasks`, `changed_paths`, `symbols`, `commits`, `unverified`, `out_of_scope`, `blueprint_review`, `pr`. `coordinator`는 없다.
  - `TaskDigest`에서 `actual_paths`가 빠진다.
  - `finalize.ts` export에서 `writeExplainCoordinator`가 빠진다. `buildCoordinatorProvenance`, `collectCoordinatorProvenance`는 남는다.
- 거부
  - digest가 원장 결정 로그, repair wave, scope revision, worker branch·sha를 싣는 것. `version`은 `1` 그대로다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize.ts` | `writeExplainCoordinator`, `finalize` 쓰기 단계, export 목록 | Modify | explain에 coordinator 색인을 씀 | 함수·호출·export 삭제 | explain에 drive 기록을 쓰는 유일한 지점 |
| `scripts/src/lib/finalize-digest.ts` | `prepareFinalizeDigest`, `FinalizeDigest`, `TaskDigest` | Modify | digest에 `coordinator`·`actual_paths`를 실음 | 두 필드와 `actualPathsById` 삭제, branch 결정은 내부 값으로 유지 | digest 모양의 정본 |
| `test/finalize.test.js` | explain coordinator 색인 테스트 | Modify | drive finalize가 색인을 쓴다고 단언 | drive finalize 뒤 `bouncer.coordinator` 부재 단언으로 바꿈 | 계약 변경을 단언하는 테스트 |
| `test/finalize-digest.test.js` | drive digest 테스트 | Modify | `d.coordinator`·`actual_paths` 단언 | 두 키 부재와 `d.git.branch === 'feat/integ'` 단언 | digest 모양 검증 지점 |

#### Constraints

- `buildCoordinatorProvenance`·`collectCoordinatorProvenance`의 반환 모양과 `finalize --yes` payload는 바꾸지 않는다. cleanup이 `worktrees`를, branch 결정이 `integrationBranch`를 읽는다.
- digest는 읽기 전용이다. 원장·porcelain을 바꾸지 않는다는 기존 단언(`test/finalize-digest.test.js:248-263`)을 유지한다.
- 이미 published된 explain을 다시 쓰는 마이그레이션 코드를 넣지 않는다.

### EPIC-085/BP-001/TASK-003 · `974f9877`

#### Goal & intent

finalize 퀴즈 지침이 바뀐 제품 동작만 묻게 하고, 퀴즈 결과를 어디에도 기록하지 않게 한다. explain과 PR 지침에서 drive 실행 기록을 쓰라는 지시를 지우고, `주요 변경 내용`에서 작업 과정을 금지한다. 스키마 문서와 CHANGELOG를 새 계약에 맞춘다. 수용 기준은 epic 085 성공 조건 1·2·5이고 검증 명령은 `npm test`다.

#### Current behavior

- `references/explain-diff/index.md`
  - 퀴즈 출처는 "`range.base..range.head` diff에서 agent 판단"(step 3)뿐이고 주제 제한이 없다.
  - step 1이 다섯 절(`## 이해 상태` 포함)을 쓰게 하고, step 3-4·3-5가 `quiz_score` 채점과 정답·응답 기록을, step 5 YAML이 `quiz_score`·`disposition`을, "Mirror the outcome under `## 이해 상태`"와 Return이 점수 보고를 요구한다. "기록만 하고 마감을 막지 않는다"는 점수 비차단 문장이다.
- `skills/bouncer-finalize/references/explain-quiz.md`: "Drive sources" 문단이 digest `coordinator`의 DAG 변화·`actualPaths`·`scopeRevision`·`integrationHead`·worker `branch`/`sha`를 explain에 쓰게 한다. 같은 문단에 "Do not re-read the coordinator ledger, task documents, or verification logs."가 있다. 첫 문단은 `quiz_score` 엔트리를 쓰라고 한다.
- `skills/bouncer-finalize/references/draft-pr.md`
  - `:27-28`이 `## 이해 상태`·`quiz_score` 복사를 금지한다.
  - `:36` 표의 `주요 변경 내용` 출처는 Explain `## Code`, diff, commits다.
  - `:41-52` "Plan versus execution (drive only)" 절이 digest `coordinator`의 drive 기록을 `주요 변경 내용`과 `리뷰 포인트`에 넣게 한다.
- `rules/document-schema.md:137-144`가 finalize가 explain에 `bouncer.coordinator`를 쓴다고 설명한다.
- 테스트
  - `test/skill-explain-diff.test.js:21-70`이 다섯 절, `quiz_score`·`disposition` 필드, `quiz_score` 필수, `## 이해 상태` 단일 블록, "기록만 하고 마감을 막지 않는다"를 단언한다.
  - `test/skill-bouncer-finalize.test.js:76-77`이 `do not move \`## 이해 상태\` into the PR`를, `:154-174`가 두 문서 모두에 `DAG`·`actualPaths`·`scopeRevision`·`integrationHead`가 있음을, `:191`이 위 재읽기 금지 문장을 단언한다.
  - `test/lightweight-cycle.test.js:36-40, 90-97`이 `1문항`, `1–10`, `Canonical context remains`를 단언한다.
- 재현: `node --test test/skill-explain-diff.test.js test/skill-bouncer-finalize.test.js test/lightweight-cycle.test.js`가 지금 통과한다.

#### Target behavior

- 성공
  - `explain-diff/index.md` step 3에 퀴즈 출처 규칙이 있다.
    - 질문은 이번 변경으로 바뀐 제품 동작만 다룬다. 도메인 규칙, 입력과 출력, 경계 조건, 오류 처리가 해당한다. 바뀐 기능이 DAG·gate·coordinator 같은 제품 기능이어도 그 동작은 물을 수 있다.
    - 금지 주제 목록: 이번 blueprint의 task 분할·순서·의존, `affected_paths`와 scope revision, repair wave와 critical recovery, worker·agent·branch·sha·integration head, 커밋·리뷰·검증을 어떤 과정으로 진행했는지.
    - 제품 동작 변화가 없으면 사용자가 볼 수 있는 동작이나 출력의 변화를 묻는 질문 1개로 대신하고, 그것도 없으면 바뀐 규칙이 가져오는 효과를 묻는다.
    - 응답을 받은 뒤 채팅에서 문항별 정답과 한 줄 설명을 보여주고, 정답·응답·점수를 파일에 쓰지 않는다.
  - step 1은 네 절(Background, Intuition, Code, Quiz)을 쓰게 하고, stop-slop 문장(`references/explain-diff/index.md:40`의 "the five sections")도 네 절로 맞춘다. step 5 YAML은 `range_from`, `range_to`, `diff_sha`, `recorded_at`만 둔다. Background는 제품·도메인 관점의 변경 이유를 쓰고 drive 실행 기록을 쓰지 않는다.
  - `explain-quiz.md` 첫 문단(`:9`)의 "five Korean sections"가 네 절을 가리키고 `quiz_score` 언급이 없다. "Drive sources" 문단이 없고, explain은 저장소 지식만 담으며 drive 실행 기록(DAG 변화, scope revision, worker branch·sha, integration head)을 쓰지 않는다는 문장이 있다. 재읽기 금지 문장은 남는다.
  - `draft-pr.md`의 `주요 변경 내용` 행이 바뀐 파일·동작·인터페이스만 쓰고 task DAG, task 분할·순서, repair wave, scope revision, worker·agent, branch·sha, integration head를 쓰지 않는다고 적는다. "Plan versus execution" 절이 없다. Quiz와 퀴즈 결과를 PR에 넣지 않는다는 금지는 남는다.
  - `rules/document-schema.md`에서 explain `bouncer.coordinator` 문단이 빠지고, 옛 explain에 남은 `bouncer.coordinator`·`## 이해 상태`·`quiz_score`·`disposition`은 읽을 때 무시된다는 한 문장이 있다.
  - `CHANGELOG.md` `[Unreleased]`에 이 변경 항목이 있다.
- 실패
  - 미응답 퀴즈는 계속 finalize를 멈춘다는 문장과 스킵 경로를 만들지 말라는 문장이 남는다.
- 보존
  - 질문 수 규칙(1–10, `scale: light`면 1문항), 3지선다, 정답 위치 분산, 한 번에 제시·응답, 퀴즈를 다시 하지 않는 re-hash 경로, `Canonical context remains` 문장은 그대로다.
  - 오답은 마감을 막지 않는다는 비차단 규칙은 문장을 바꿔 남긴다.

#### Interface

- 제공: 위 Target behavior의 지침 문장. 아래 테스트가 단언하는 문구가 계약이다.
  ```js
  // test/skill-explain-diff.test.js
  assert.match(md, /바뀐 제품 동작|changed product behavior/);
  assert.match(md, /repair wave/);
  assert.match(md, /scope revision/);
  assert.match(md, /integration head/);
  assert.match(md, /정답[\s\S]{0,80}(채팅|chat)/);
  assert.doesNotMatch(md, /quiz_score|disposition|## 이해 상태/);
  assert.doesNotMatch(md, /five (Korean )?sections/i);
  // test/skill-bouncer-finalize.test.js
  assert.doesNotMatch(explainQuiz, /actualPaths|scopeRevision|integrationHead|previousDag/);
  assert.doesNotMatch(explainQuiz, /five Korean sections|quiz_score/);
  assert.doesNotMatch(draftPr, /Plan versus execution|actualPaths|scopeRevision|previousDag/);
  assert.match(draftPr, /`주요 변경 내용`[^\n]*(DAG|작업 과정)/);
  ```
- 거부: 퀴즈 점수·정답·응답·처분을 explain·frontmatter·PR에 쓰라는 지시, drive 실행 기록을 explain이나 PR 어느 섹션에 쓰라는 지시.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/explain-diff/index.md` | step 1·3·5, Guardrails, Return | Modify | 다섯 절, 점수 기록, 출처 무제한 퀴즈 | 네 절, 출처 규칙·금지 목록·대체 질문·정답 공개, 기록 지시 삭제 | 퀴즈와 explain 작성 절차의 정본 |
| `skills/bouncer-finalize/references/explain-quiz.md` | Drive sources 문단, 첫 문단 | Modify | drive 기록을 explain에 쓰게 함 | 문단 삭제, 저장소 지식만 쓴다는 문장, 첫 문단의 "five"를 네 절로 고치고 `quiz_score` 언급 삭제 | finalize가 explain 작성에 넘기는 지시 |
| `skills/bouncer-finalize/references/draft-pr.md` | Body sections 표, Plan versus execution 절 | Modify | drive 기록을 PR에 넣게 함 | `주요 변경 내용` 금지 문구, 절 삭제, 옛 `## 이해 상태`·`quiz_score` 언급 정리 | PR 본문 작성의 정본 |
| `rules/document-schema.md` | Task bundle and commit records 절 | Modify | explain `bouncer.coordinator` 기록을 설명 | 문단 삭제, 옛 필드 무시 문장 추가 | 스키마 설명이 CLI와 어긋나지 않게 함 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 이번 변경 항목 없음 | Changed·Removed 항목 추가 | 프로젝트 변경 이력 규칙 |
| `test/skill-explain-diff.test.js` | explain-diff 문구 단언 | Modify | 다섯 절·점수 필수·이해 상태 블록 단언 | Interface의 새 단언으로 교체 | 지침 계약 검증 지점 |
| `test/skill-bouncer-finalize.test.js` | 이해 상태 PR 금지, drive provenance 단언 | Modify | `:76-77`, `:154-174` 옛 계약 단언 | drive 기록 부재와 `주요 변경 내용` 금지 단언으로 교체, `:191` 유지 | 지침 계약 검증 지점 |

#### Constraints

- 지침 본문은 기존 문서의 언어를 따른다(explain-diff는 영어 본문에 한국어 규칙 문장이 섞여 있다). 새 금지 목록은 테스트가 단언하는 용어(`repair wave`, `scope revision`, `integration head`)를 그대로 쓴다.
- review finding `disposition`(G14)을 다루는 `references/review/index.md`, `skills/bouncer-execute/references/review-round.md`는 건드리지 않는다.
- `test/lightweight-cycle.test.js`가 단언하는 `1문항`, `1–10`, `Canonical context remains` 문구를 지우지 않는다.
- `explain-quiz.md`의 "Do not re-read the coordinator ledger, task documents, or verification logs." 문장은 그대로 남긴다.
- CHANGELOG는 Keep a Changelog 형식과 기존 항목 문체(굵은 제목 — 한 문장 설명)를 따른다.

### EPIC-085/BP-001/TASK-004

#### Goal & intent

TASKS-001·002·003이 모두 통합된 integration head에서 CI 전체(`check:emit`, coverage, eslint, `lint:docs`, `lint:context-comments`, typecheck, audit)가 통과함을 증명한다. 수용 기준은 epic 085 성공 조건 9다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-085/BP-001/TASK-005 · `e8e5c3f0`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/skill-bouncer-finalize.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
