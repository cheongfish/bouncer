---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/084-drive-plan-copy-hygiene/blueprints/002-template-guidance-migration/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-02T15:16:35.091+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '084'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: 84799a7e139c2d06178d84c6c193b0fe297f6b18
      range_to: baeb01cb140e8878adc6f339375498dbd27f045a
      diff_sha: a0c7edba258f211d7f820987e7afc0005a3363dac06e8298e412fdba9e5b65c7
      quiz_score: 1/3
      disposition: DAG·스캐너 문항 오답, TASKS-005 경로/r1만 정답. 점수 미달로 마감은 막지 않음.
      recorded_at: '2026-10-02T15:19:53+09:00'
  task_commits:
    - task: EPIC-084/BP-002/TASK-001
      sha: a95288a9
      intent_anchor: task-001
    - task: EPIC-084/BP-002/TASK-002
      sha: 3c7b5c24
      intent_anchor: task-002
    - task: EPIC-084/BP-002/TASK-003
      sha: d6ccb263
      intent_anchor: task-003
    - task: EPIC-084/BP-002/TASK-005
      sha: baeb01cb
      intent_anchor: task-005
  coordinator:
    integration_branch: refactor/084-002-template-guidance-migration
    tasks:
      - id: '001'
        branch: bouncer/084-002-001
        scope_revision: null
        actual_paths:
          - .codex/agents/bouncer-context-reviewer.toml
          - .codex/agents/bouncer-reviewer.toml
          - agents/bouncer-context-reviewer.md
          - agents/bouncer-reviewer.md
          - docs/architecture/rule-ownership.md
          - references/context-review/index.md
          - references/review/index.md
          - references/spec-authoring/index.md
          - test/template-guidance.test.js
      - id: '002'
        branch: bouncer/084-002-002
        scope_revision: null
        actual_paths:
          - scripts/check-context-comments.js
          - scripts/src/lib/templates.ts
          - test/context-comments.test.js
          - test/init.test.js
          - test/scaffold.test.js
          - test/validate-gates.test.js
      - id: '003'
        branch: bouncer/084-002-003
        scope_revision: null
        actual_paths:
          - CHANGELOG.md
          - rules/gates.md
          - scripts/src/lib/coordinator.ts
          - scripts/src/lib/validate-gates.ts
          - test/coordinator.test.js
          - test/validate-gates.test.js
          - scripts/src/lib/legacy-comments.ts
          - test/legacy-comments.test.js
      - id: '004'
        branch: null
        scope_revision: null
        actual_paths: []
      - id: '005'
        branch: bouncer/084-002-005
        scope_revision: r1
        actual_paths:
          - scripts/src/lib/templates.ts
---
# Explain

## Background
시드된 계획 문서에 템플릿 HTML 안내 주석이 남으면 `lint:context-comments`가 종단 CI에서 실패했다. 드라이브는 안내를 스킬 문서로 옮기고, 일곱 full 템플릿에서 주석을 지운 뒤 `LEGACY_SCAFFOLD_COMMENT_BODIES` 27개를 동결했다. plan G22와 `coordinate bootstrap`의 `scaffold-comment-remaining`은 `scanLegacyScaffoldComments`를 같이 쓴다.

계획 DAG는 001→002→003이고 004는 001·002·003에 의존했다. 004 `npm run ci`가 `templates.ts`의 `LEGACY_SCAFFOLD_COMMENT_BODIES`에서 eslint quotes/max-len으로 실패했다. repair wave 1이 TASKS-005를 넣었다. 005는 003에 의존하고 004는 005에만 의존한다. 005 범위는 `scripts/src/lib/templates.ts`(r1). 통합 HEAD는 `baeb01cb140e8878adc6f339375498dbd27f045a`. 005 이후 004 `npm run ci`는 exit 0이다.

워커 SHA·브랜치: 001 `72f69239` `bouncer/084-002-001`, 002 `93beb0cc` `bouncer/084-002-002`, 003 `a74f2925` `bouncer/084-002-003`, 005 `f09138c7` `bouncer/084-002-005`. 004는 검증 노드라 워커 브랜치가 없다.

## Intuition
안내 본문은 스킬에 두고, 템플릿에는 동결된 옛 주석 목록만 남겨 plan과 bootstrap이 같은 스캐너로 거른다.

## Code
- TASKS-001 실제 경로: `references/spec-authoring/index.md`, `references/review/index.md`, `references/context-review/index.md`, `agents/bouncer-reviewer.md`, `agents/bouncer-context-reviewer.md`, Codex TOML, `docs/architecture/rule-ownership.md`, `test/template-guidance.test.js`
- TASKS-002 실제 경로: `scripts/src/lib/templates.ts`(`findLegacyScaffoldComments`, 동결 배열), `scripts/check-context-comments.js`, `test/context-comments.test.js`, `test/scaffold.test.js`, `test/init.test.js`, `test/validate-gates.test.js`
- TASKS-003 실제 경로: `scripts/src/lib/legacy-comments.ts`(`scanLegacyScaffoldComments`), `scripts/src/lib/validate-gates.ts`, `scripts/src/lib/coordinator.ts`, `rules/gates.md`, `CHANGELOG.md`, 대응 테스트
- TASKS-005 r1: `scripts/src/lib/templates.ts`만. 동결 본문 값은 그대로 두고 eslint 형식만 맞춤
- 통합 커밋: `a95288a9` → `3c7b5c24` → `d6ccb263` → `baeb01cb`(005)

## Quiz
1. 004 `npm run ci`가 처음 실패한 뒤 DAG는 어떻게 바뀌었나?
- A) 004가 001·002·003에 계속 의존하고 005는 004 다음이다
- B) 005가 003에 의존하고 004는 005에만 의존한다
- C) 005가 001에 의존하고 004 의존은 비운다

2. TASKS-005가 고친 경로와 범위 개정은?
- A) `scripts/src/lib/templates.ts`, r1
- B) `scripts/src/lib/legacy-comments.ts`, 개정 없음
- C) `rules/gates.md`, r2

3. 옛 주석을 plan gate와 bootstrap이 같이 보는 함수는?
- A) `findLegacyScaffoldComments`만
- B) `normalizeCommentBody`만
- C) `scanLegacyScaffoldComments`

## 이해 상태
`quiz_score` 1/3. `diff_sha` `a0c7edba258f211d7f820987e7afc0005a3363dac06e8298e412fdba9e5b65c7`. range `84799a7e139c2d06178d84c6c193b0fe297f6b18`..`baeb01cb140e8878adc6f339375498dbd27f045a`.

1. 정답 B. 응답 A. 오답. repair 후 005는 003에 의존하고 004는 005에만 의존한다.
2. 정답 A. 응답 A. 정답. TASKS-005는 `scripts/src/lib/templates.ts` r1이다.
3. 정답 C. 응답 A. 오답. plan gate와 bootstrap은 `scanLegacyScaffoldComments`를 같이 본다.

disposition: DAG·스캐너 문항 오답, TASKS-005 경로/r1만 정답. 점수 미달로 마감은 막지 않음.

## Tasks

### EPIC-084/BP-002/TASK-001 · `a95288a9`

#### Goal & intent

템플릿 HTML 주석에만 있던 작성·리뷰 안내 여섯 가지(a–f)가 스킬·reference·agent 문서에 생긴다. 다음 task가 템플릿 주석을 지워도 작성 정보가 사라지지 않는다. 수용 기준은 epic 성공 기준 9다. task 검증은 `npm test`, 전체 CI는 TASKS-004가 맡는다.

#### Current behavior

- 템플릿 주석(`scripts/src/lib/templates.ts`)에만 있고 스킬 문서에는 없는 안내:
  - (a) blueprint Contract 규칙(80-85): 계약만 쓰고 구현 코드는 금지, 시그니처·타입·의사코드는 블록당 20줄 이하, 금지 목록(계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스, 실행 가능한 테스트 본문 → tasks.md로 이연), 본문 약 250줄 예산. `references/spec-authoring/index.md:37-43`의 blueprint 항목은 title·commit_type·Intent만 다룬다.
  - (b) One-commit justification을 못 채우면 blueprint를 쪼개라는 신호(96-97). `rules/planning.md:9-16`은 task bundle 크기만 말한다.
  - (c) epic Intent는 두 문장 이내(49). epic Blueprints 색인 줄에는 what과 where를 함께 쓰고, 기존 줄은 소급 수정하지 않는다(64-68). spec-authoring epic 항목(32-36)에 없다.
  - (d) epic·blueprint Out of scope가 tasks Do not touch로 이어진다(60, 153-154). spec-authoring Do not touch 항목(143)은 "paths only"만 말한다.
  - (e) tasks Goal & intent에 수용 기준·검증 명령을 적거나 Checklist에 명시한다(112-113). Touch 경로·심볼은 백틱으로 감싼다(143-147). spec-authoring에는 Goal & intent 절별 규칙이 없고, Touch 항목(122-130)에는 백틱 언급이 없다.
  - (f) fingerprint 정규화(216, 237): 템플릿은 앞뒤 공백 제거, category·brief_clause 소문자, file의 `./` 제거 세 가지만 적는다. 게이트(`scripts/src/lib/validate-sections.ts:206-218` `findingFingerprint`)는 여기에 더해 file 경로 구분자를 `/`로 바꾼다(`toPosix`). 그런데 `references/review/index.md` 2절(49-59)에는 fingerprint 형식 자체가 없다. `references/context-review/index.md:44`, `agents/bouncer-reviewer.md:171-172`, `agents/bouncer-context-reviewer.md:170-171`은 형식만 있고 정규화가 없다.
- `agents/*.md`는 `.codex/agents/*.toml`과 바이트 parity를 `test/agents.test.js:190`, `:226`, `:354`가 검사한다.
- `docs/architecture/rule-ownership.md:99-100`이 `references/spec-authoring/index.md:26`, `:174`를 줄 번호로 인용한다.

#### Target behavior

- 성공: a–f가 아래 위치에 있고, 각 문장을 새 테스트가 고정한다.
  - (a)(b): spec-authoring `- **blueprint**` 항목
  - (c): spec-authoring `- **epic**` 항목
  - (d): spec-authoring Do not touch 항목
  - (e): spec-authoring의 새 `- **Goal & intent**` 항목(첫 `- **Current behavior**` 앞), `- **Touch**: write a Markdown table` 항목, `- **Checklist**: order` 항목(실패 테스트 순서 규칙)
  - (f): `references/review/index.md` 2절, `references/context-review/index.md` 2절, 두 agent 출력 계약
- 실패: 해당 없음. 문서 추가뿐이다.
- 보존:
  - 기존 문장과 절 순서, `- **tasks**`·`- **verification / review**` 표식(`test/skill-spec-authoring.test.js:161` slice 기준), subskill H2 순서(`lint:docs`)는 그대로다.
  - 템플릿은 이 task에서 바꾸지 않는다.

#### Interface

- 제공: 문서 문장. (f) 정규화 문장은 게이트 동작과 같은 네 규칙을 적는다: 각 부분 앞뒤 공백 제거, category·brief_clause 소문자, file 경로 구분자 `/`, file 앞 `./` 제거. 예: `fingerprint: correctness_tests:tasks/001 interface:scripts/lib/example.js#runExample`.
- 거부: 새 게이트·CLI·필드는 없다. a–f 외 내용은 옮기지 않는다(이미 스킬에 있는 안내의 중복 추가 금지).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/spec-authoring/index.md` | `- **epic**`, `- **blueprint**`, Goal & intent·Touch·Do not touch·Checklist 항목 | Modify | 계획 문서 본문 작성 규칙 | a–e 문장 추가 | 템플릿 안내의 새 정본 |
| `references/review/index.md` | `2. **Contract**` | Modify | execute review 기록 계약 | fingerprint 형식과 정규화 (f) | 리뷰어가 게이트와 같은 값을 쓰게 함 |
| `references/context-review/index.md` | `2. **Contract**` | Modify | context review 기록 계약 | fingerprint 정규화 (f) | 같음 |
| `agents/bouncer-reviewer.md` | `## Output contract` fingerprint 항목 | Modify | reviewer 출력 필드 | 정규화 (f) | 같음 |
| `agents/bouncer-context-reviewer.md` | `## Output contract` fingerprint 항목 | Modify | context reviewer 출력 필드 | 정규화 (f) | 같음 |
| `.codex/agents/bouncer-reviewer.toml` | 생성 본문 | Modify | Codex용 reviewer 정의 | `mdToCodexToml`로 재생성 | parity 테스트 |
| `.codex/agents/bouncer-context-reviewer.toml` | 생성 본문 | Modify | Codex용 context reviewer 정의 | `mdToCodexToml`로 재생성 | parity 테스트 |
| `docs/architecture/rule-ownership.md` | `## 참조 대조` 표의 `references/spec-authoring/index.md:<line>` 행 | Modify | `rules/planning.md` 참조 위치를 줄 번호로 인용 | 삽입 뒤 실제 줄 번호로 갱신하고, 새 문장이 `rules/planning.md`를 가리키면 그 줄의 행을 추가 | 인용 정합 |
| `test/template-guidance.test.js` | 신규 추출 지점: a–f 문장 고정 | Create | 없음 | 각 문서의 a–f 문장 단언 | 수용 기준 9 |

#### Constraints

- 문서 언어는 각 파일의 기존 문체를 따른다(spec-authoring은 영어·한국어 혼용, agents는 영어).
- 기존 테스트가 고정한 문장을 바꾸거나 지우지 않는다.
- 새 문장은 한 규칙당 한두 문장으로 짧게 쓴다. stop-slop 기준을 따른다.

### EPIC-084/BP-002/TASK-002 · `3c7b5c24`

#### Goal & intent

새로 scaffold한 epic·blueprint·tasks·verification-tasks·review·context-review·explain 문서에 HTML 주석이 하나도 없다. 그래도 옛 템플릿으로 만든 초안의 주석은 `lint:context-comments`가 동결된 목록으로 계속 잡는다. 수용 기준은 epic 성공 기준 8과 10의 lint 부분이다. task 검증은 `npm test`, 전체 CI는 TASKS-004가 맡는다.

#### Current behavior

- `TEMPLATES`(`scripts/src/lib/templates.ts:45`)에서 주석이 있는 곳:
  - epic: 49, 54-56, 60, 64-68
  - blueprint: 80-85, 96-97, 105
  - tasks: 112-169의 열 곳
  - verification-tasks: 182-183, 191-192
  - review: 210-223
  - context-review: 229-243
  - explain: 251-272
- 39행 코드 주석은 "작성 가이드는 HTML 주석과 TODO 플레이스홀더에 있습니다"라고 적는다.
- `SCAFFOLD_COMMENT_BODIES`(325-327)는 `TEMPLATES` 전체에서 주석을 뽑아 만든다. 템플릿에서 주석을 지우면 빈 배열이 되어 lint가 옛 주석을 못 잡는다.
- 소비자는 `scripts/check-context-comments.js:6`, `:14`, `:163`과 `test/context-comments.test.js:9`, `:83-87`뿐이다.
- 템플릿 주석 문구를 고정한 테스트:
  - `test/context-comments.test.js:82` — epic 템플릿에 "왜 지금 이 에픽인가" 주석이 있어야 한다.
  - `test/scaffold.test.js:732` — review·context-review 템플릿에 rounds 허용값 문자열이 있어야 한다.
  - `test/scaffold.test.js:759` — tasks 템플릿 본문에 `depends_on`·`parallel_safe`·`dependency_gate`·`execution_kind`가 있어야 한다.
  - `test/init.test.js:303` — blueprint 템플릿에 `Contract-First`·`금지:`·`~250줄`이 있어야 한다.

#### Target behavior

- 성공:
  - 일곱 템플릿 본문에 HTML 주석 여는 표식이 없다. 제목, TODO 자리표시, verification-tasks의 `Source 변경 경로 없음.`, review의 `- <finding>`은 그대로다.
  - `LEGACY_SCAFFOLD_COMMENT_BODIES`는 지우기 전 `SCAFFOLD_COMMENT_BODIES` 값을 순서 그대로 담은 동결 리터럴 배열이다.
  - `findLegacyScaffoldComments(body)`는 body의 각 HTML 주석을 `normalizeCommentBody`로 정규화해, 이 배열과 일치하는 본문만 등장 순서대로 돌려준다.
- 실패: lint는 옛 주석이 남은 변경 context 문서에 대해 지금과 같은 메시지 `스캐폴드 안내 주석가 남아 있습니다`와 exit 1로 실패한다.
- 보존:
  - 저자 주석은 통과한다.
  - light 템플릿 본문은 바이트 그대로다.
  - G10은 TODO 자리표시로 계속 손대지 않은 tasks 템플릿을 거절한다(`test/validate-gates.test.js:326`).
  - 빈 explain 절은 G16이 계속 거절한다. 이 task의 `test/validate-gates.test.js` 케이스가 확인한다.

#### Interface

- 제공: `templates.ts` export
  - `LEGACY_SCAFFOLD_COMMENT_BODIES: readonly string[]` — `Object.freeze`한 배열
  - `findLegacyScaffoldComments(body: string): string[]`
  - `normalizeCommentBody`는 유지
  - `SCAFFOLD_COMMENT_BODIES` export는 없앤다.
- 거부: `findLegacyScaffoldComments`는 문자열이 아닌 입력에 `TypeError`를 throw한다. 빈 문자열은 `[]`다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/templates.ts` | `TEMPLATES`, `SCAFFOLD_COMMENT_BODIES`, `extractCommentBodies`, 39행 주석 | Modify | 템플릿 본문과 주석 집합 | 주석 삭제, 동결 상수와 판정 함수로 교체 | 본체 |
| `scripts/check-context-comments.js` | `violationsFor`, import | Modify | 템플릿 주석 집합으로 판정 | `findLegacyScaffoldComments`로 판정 | 옛 초안 계속 검출 |
| `test/context-comments.test.js` | `templates expose normalized scaffold comment bodies` | Modify | 템플릿에 주석이 있음을 단언 | 동결 상수에 옛 본문이 있고 템플릿에는 HTML 주석이 없음을 단언 | 수용 기준 8, 10 |
| `test/scaffold.test.js` | `review templates document rounds…`(:732), `scaffoldTask writes compatible DAG defaults…`(:759) | Modify | 주석 속 허용값·DAG 문자열 고정 | 템플릿 주석 단언을 제거하고 scaffold frontmatter 단언만 남김. 허용값 안내는 reference가 정본이다 | 주석 삭제 반영 |
| `test/validate-gates.test.js` | 신규 추출 지점: 주석 없는 explain G16 케이스 | Modify | gate 테스트 | `TEMPLATES['explain.md']` 본문 그대로인 explain이 finalize gate에서 G16으로 거절됨을 단언 | 주석 삭제 뒤 G16 보존 |
| `test/init.test.js` | `built-in blueprint template carries Contract-First authoring guardrails` | Modify | 템플릿 주석 속 Contract 규칙 고정 | Contract 본문 bullet(`수용 기준:` 등)과 HTML 주석 부재만 단언 | 규칙 정본은 TASKS-001의 spec-authoring |

#### Constraints

- `LEGACY_SCAFFOLD_COMMENT_BODIES`는 생성 코드가 아니라 리터럴이다. 이후 템플릿 변경이 이 목록을 바꾸지 않게 한다.
- lint의 CLI 인자·종료 코드·메시지는 바꾸지 않는다.
- `scripts/lib/`는 커밋하지 않는다.

### EPIC-084/BP-002/TASK-003 · `d6ccb263`

#### Goal & intent

옛 스캐폴드 주석이 epic `index.md`나 blueprint 디렉터리 아래 `.md`에 남아 있으면 `bouncer validate --gate plan`이 G22로 거절한다. `coordinate bootstrap`은 integration worktree를 만들기 전에 `scaffold-comment-remaining`으로 멈춘다. 수용 기준은 epic 성공 기준 10의 gate·bootstrap 부분이다. task 검증은 `npm test`, 전체 CI는 TASKS-004가 맡는다.

#### Current behavior

- plan gate(`scripts/src/lib/validate-gates.ts:737-838`)는 epic index(G1), blueprint index(G2), context-review(G18), tasks(G3·G5·G10–G12·G19·G20)를 읽는다. 주석은 `stripComments`(`scripts/src/lib/validate-sections.ts:122-124`)로 지운 뒤 판정하므로, 남은 스캐폴드 주석은 어떤 G 코드로도 걸리지 않는다. 사용 중인 최고 번호는 G21이다(G4·G9·G15는 폐기, `rules/gates.md:100`).
- `coordinate bootstrap`(`scripts/src/lib/coordinator.ts:1913-1964`)은 메인 checkout 판정 → `git worktree add` → `loadLedger(paths.ledgerFile)` → 원장이 없을 때만 `seedIntegration` 순서다. plan 검증을 하지 않고, seed 단계 검사는 `seed-conflict` 바이트 비교뿐이다. 줄 번호는 BP-001 병합 전 기준이다.
- 083-002에서는 `review.md` Findings와 `tasks/002/tasks.md` Touch에 남은 주석이 integration으로 시드됐다. 종단 `lint:context-comments`가 실패했고, `.bouncer/`는 `coordinate repair` 범위 밖이라(`repair-scope-out-of-bounds`) verification-retry로만 복구됐다.
- `test/coordinator.test.js:72`는 `coordinator.ts`의 `reason: '<x>'` 리터럴마다 `COORDINATE_FAILURE_HINTS` 항목이 있기를 요구한다.

#### Target behavior

- 성공:
  - 옛 주석이 없으면 plan gate 결과와 bootstrap 동작은 지금과 같다.
  - 저자가 쓴 다른 주석은 통과한다.
- 실패:
  - plan gate는 옛 주석이 있는 파일마다 저장소 상대 경로를 정렬해 모은 뒤 G22 실패 하나를 낸다. 메시지는 `scaffold guidance comments remain: <rel>[, <rel>]…`이다. 대상은 epic `index.md`와 blueprint 디렉터리 아래 재귀 `.md` 전부다.
  - bootstrap은 메인 checkout 판정과 `unassigned-integration-worktree` 판정 뒤, `resolveWorktreeBranch`·`git worktree add` 전에, `fs.existsSync(paths.ledgerFile)`가 거짓이면(신규 drive. integration worktree가 이미 등록돼 있어도 원장이 없으면 seed하므로 포함) 메인에서 스캐너를 돌린다. 옛 주석이 있으면 `git worktree add` 전에 `{ ok: false, reason: 'scaffold-comment-remaining', paths: [...] }`를 돌려준다. integration worktree·branch·원장은 만들지 않는다.
- 보존:
  - 원장이 있는 재개 bootstrap은 검사하지 않는다(seed하지 않는다).
  - review-dispatch의 `checkPlanDraft` 코드 집합은 바뀌지 않는다.
  - light blueprint도 같은 G22 판정을 받는다.

#### Interface

- 제공:
  - 새 모듈 함수 `scanLegacyScaffoldComments({ repoRoot, blueprintDir }): string[]`
    - `repoRoot`: 절대 경로. `blueprintDir`: 저장소 상대 POSIX 경로(예: `.bouncer/context/epics/084-x/blueprints/002-y`).
    - 대상: `<epicDirOf(blueprintDir)>/index.md`와 `<blueprintDir>/**/*.md`. 존재하지 않는 파일·디렉터리는 대상에서 빠진다.
    - 반환: 옛 주석이 있는 파일의 정렬된 저장소 상대 POSIX 경로. 판정은 `findLegacyScaffoldComments`(TASKS-002)에 맡긴다.
  - plan gate 실패 코드 `G22`. gate context에 `repoRoot`나 `blueprintDir`가 문자열로 없으면 G22 검사를 건너뛴다(`validate-gates.ts:308`의 `typeof repoRoot !== 'string'` 가드를 두 값으로 넓힌 형태).
  - coordinate 거절 `scaffold-comment-remaining`과 그 실패 힌트(`cause`: 계획 문서에 옛 스캐폴드 안내 주석이 남음, `next`: 주석을 지우고 plan gate를 다시 통과한 뒤 bootstrap).
  - `rules/gates.md` Plan rules에 G22 설명.
- 거부(즉시 throw): 존재하지만 읽기에 실패한 파일(권한 등)은 예외를 그대로 올린다. plan gate와 bootstrap도 잡지 않으므로 CLI는 기존 예외 경로(stderr, 비정상 종료)로 끝난다.
- 누락(조용히 제외): epic `index.md`나 blueprint 디렉터리가 없으면 그 경로는 스캔하지 않는다. 그 상태는 G1·G2·G3이 판정하며 G22를 만들지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/legacy-comments.ts` | `scanLegacyScaffoldComments` | Create | 없음 | epic index + blueprint 트리 `.md` 스캔 | gate와 bootstrap이 같은 파일 집합을 쓰게 함 |
| `scripts/src/lib/validate-gates.ts` | `runCheckGate`의 `gate === 'plan'` 분기 | Modify | plan 규칙 판정 | G22 추가 | 수용 기준 10 |
| `scripts/src/lib/coordinator.ts` | `coordinate`의 bootstrap 분기, `COORDINATE_FAILURE_HINTS` | Modify | 메인 판정 뒤 worktree 생성·seed | worktree 생성 전 스캔·거절, 힌트 항목 추가 | 수용 기준 10 |
| `rules/gates.md` | `## Plan rules` | Modify | plan G 코드 설명 | G22 항목 추가 | 게이트 문서 |
| `test/legacy-comments.test.js` | 신규 추출 지점: 스캔 단위 테스트 | Create | 없음 | 대상 집합·저자 주석 통과·정렬 단언 | 계약 고정 |
| `test/validate-gates.test.js` | 신규 추출 지점: G22 케이스 | Modify | plan gate 테스트 | 두 파일 옛 주석 → 정렬된 G22 메시지, 저자 주석만 → 통과, light blueprint → G22, ctx 없음 → 건너뜀 | 수용 기준 10 |
| `test/coordinator.test.js` | 신규 추출 지점: bootstrap 거절 케이스 | Modify | bootstrap 테스트 | 옛 주석 → `scaffold-comment-remaining`, integration 경로 부재 단언 | 수용 기준 10 |
| `CHANGELOG.md` | `## [Unreleased]` | Modify | 미출시 변경 목록 | 템플릿 주석 삭제·안내 이전·G22 항목 | 프로젝트 규칙 |

#### Constraints

- G22는 기존 G 코드 번호와 메시지를 바꾸지 않는다.
- bootstrap 거절은 `git worktree add`와 `main-source-mutated` 판정 이전에 둔다. 거절 시 메인 상태를 바꾸지 않는다.
- 파일 읽기는 동기 `fs`로 하고 경로는 POSIX로 정규화한다.

### EPIC-084/BP-002/TASK-004

#### Goal & intent

안내 이전, 템플릿 주석 삭제, legacy 주석 G22·bootstrap 거절이 모두 통합된 head에서 전체 CI가 통과함을 증명한다. 이 blueprint의 계획 문서 자체에 남은 스캐폴드 주석이 없어 `lint:context-comments`도 통과해야 한다. epic 성공 기준 11의 BP-002 몫이다.

#### Interface

- 제공: 선행 task가 모두 통합된 상태에서 verify 명령이 남기는 종단 검증 증적.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### EPIC-084/BP-002/TASK-005 · `baeb01cb`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/templates.ts` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
