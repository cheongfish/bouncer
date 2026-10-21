---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/benchmark-cost/blueprints/responder-contract-rewrite/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-11T18:45:01.410+09:00'
bouncer:
  id: EXPLAIN-responder-contract-rewrite
  epic_id: benchmark-cost
  blueprint_id: responder-contract-rewrite
  status: published
  comprehension:
    - range_from: d026bc5a24fab03da14caff818ffeecc6080e7c1
      range_to: b6ed0d96bc7a7ed530cb45400d144f3a6e208377
      diff_sha: 74059d3cadd4bf24bd7b46e31fc3717de39b37acc2a4adea22e2c21f7462bf36
      recorded_at: '2026-10-11T18:50:00+09:00'
  task_commits:
    - task: benchmark-cost/responder-contract-rewrite/001
      sha: 13c5b32f
      intent_anchor: task-001
    - task: benchmark-cost/responder-contract-rewrite/002
      sha: 2dc22633
      intent_anchor: task-002
    - task: benchmark-cost/responder-contract-rewrite/003
      sha: b6ed0d96
      intent_anchor: task-003
---
# Explain

## Background

벤치마크 응답기는 에이전트가 채팅으로 던진 질문을 게이트별 정규식(cue)으로 추측해 답했고, coordinator 원장을 직접 읽어 진행 상태를 판단했다. 제품 버전이나 모델 문구가 바뀌면 정규식이 어긋나 응답기를 매번 고쳐야 했다. 이번 변경은 응답기가 BP 001에서 만든 게이트 카탈로그, 판독 블록, drive 요약만 읽게 한다. 계약 밖 질문은 추측하지 않고 멈추고, 멈춘 질문은 실행 기록에 남긴다. 이미지의 플러그인 버전이 checkout과 다르면 유료 요청 전에 중단한다.

## Intuition

문장을 읽고 짐작하던 안내원이 번호표(카탈로그 ID)가 붙은 질문에만 답하는 안내원으로 바뀌었다. 번호표가 없으면 답하지 않고 질문을 서랍에 보관한다.

## Code

- `benchmarks/acp/responder.cjs` — 질문은 판독 블록이나 카탈로그 ID가 든 엄격 제목에서만 읽는다. 게이트별 판단은 정책 데이터를 따른다.
- `benchmarks/configs/*-evaluator-policy.json` — 평가자 정책. `test/acq-gate-ids.test.js`가 카탈로그 커버리지를 검사한다.
- `benchmarks/plugin-version.cjs` — 이미지 `package.json` 버전과 checkout 버전 대조.
- `benchmarks/unanswered-fixtures.cjs` — 답하지 못한 텍스트 질문을 `unanswered/` fixture 스텁으로 저장.
- `benchmarks/run-bouncer-full.cjs`, `run-print-stage.cjs`, `run-acp-stage.cjs`, `run-cursor.cjs` — 위 모듈을 실행기에 연결.
- `benchmarks/acp/fixtures/acq/cases.json` — 재생 fixture. `expect`는 `answer` 또는 `violation`.

## Quiz

1. 카탈로그 ID가 든 엄격 제목은 있지만 `- X)` 선택지 줄이 하나뿐인 질문을 응답기는 어떻게 분류하는가?
   - A) `answer`로 답한다
   - B) `violation`으로 멈춘다
   - C) 정규식 cue로 폴백해 답한다
2. 이미지 안 플러그인 버전이 checkout과 다르거나 이미지를 읽지 못하면 실행기는 어떻게 하는가?
   - A) 경고만 남기고 벤치마크를 계속한다
   - B) 에이전트 요청 전에 오류로 중단한다
   - C) checkout 버전으로 `plugin_version`을 덮어쓴다
3. 응답기가 답하지 못한 텍스트 질문은 어떻게 되는가?
   - A) 버려진다
   - B) 임의의 추천 선택지로 답한다
   - C) run 디렉터리 `unanswered/`에 `NN.md`와 `cases.json` 스텁으로 보관된다

## Tasks

### benchmark-cost/responder-contract-rewrite/001 · `13c5b32f`

#### Goal & intent

응답기가 텍스트 질문을 `` 블록이나 `rules/acq.md` 엄격 형식에서만 읽고, 게이트는 `rules/acq-gates.json` 카탈로그 ID로만 식별하게 한다. 둘 다 아닌 질문 턴은 `text/contract-violation`으로 멈춘다. open decisions 위임은 `kind` 블록이 있을 때만 한다.
수용 기준은 에픽 Success criteria 4·5이고, 완료 명령은 `npm run ci`다.

#### Current behavior

- 응답기 export(`benchmarks/acp/responder.cjs:697-698`) 가운데 질문 판독은 cue·문장 휴리스틱이다.
  - `acqMarkers:521`: 굵은 제목·markdown 제목 정규식 + 미리보기 제외 + `trailingQuestion:501` fallback.
  - `optionsOf:471`·`optionGroups:477`: 굵은 제목 묶음.
  - `unreadQuestion:534`, `optionLineCount:549`, `sectionBounds:559`, `lastMultiOptionSectionStart:570`, `unrecognizedQuestion:585`, `unhandledQuestionMethod:599`, `delegateOpenDecisions:615`.
  - `answerTextQuestion:650-686`: Re-ground·section cue로 `decideQuestion`에 `cue`를 넘긴다.
  - `classifyGate:327`이 게이트 `cue.test`로 고르고, `chooseProceed:137`이 `legacy`·`legacyDeny`를 받는다. `lastSection:164`도 cue 경로다.
  - 게이트 ID 판독은 `GATE_ID:321`·`gateIdOf:323`이다.
- 호출자:
  - `run-print-stage.cjs:13`(`delegateOpenDecisions:133`, `acqMarkers:140`, `looksLikeQuizRequest:141`, `unhandledQuestionMethod:145`, `answerTextQuestion`/`answerQuizText:149-150`).
  - `run-acp-stage.cjs:10-11`(`answerAskQuestion:70`, `acqMarkers:130`, `unreadQuestion:132-133`, `answerTextQuestion:137`).
  - `run-bouncer-full.cjs:8`은 `driveState`·`loadPolicy`만 쓴다(TASKS-003 범위).
- 미답 기록: `run-print-stage.cjs`는 `text/unread-question`·`text/unrecognized-question`(`:145-146`), `text/AskUserQuestion`·`text/Quiz`(`:151-153`), `turn-limit`을 `unanswered`에 넣는다. `run-acp-stage.cjs`는 `text/unread-question`(`:133`)이다. 결정 기록 `text/OpenDecisions`(`run-print-stage.cjs:135`)도 있다.
- 테스트(`benchmarks/acp/responder.test.cjs`, 49개 + `fixtures/acq/cases.json` 21건):
  - `:233-247` 재생 루프가 `answerTextQuestion` 결과의 `reply`와 `choices[].gate`를 단언한다. 각 항목은 `{file, source, phase, workdir, reply, gates[], finalizeEvidence?}`다.
  - `:703`·`:713`은 `v088006-plan-open-decisions-trailing-framing.txt`이 `text/unrecognized-question`임을 단언한다.
  - `:716-721`은 `stage-final/*.txt`가 질문 아님(`null`)임을 단언한다.
  - `:731-737`은 `v088-plan-open-decision.txt`의 위임을 단언한다.
- I/O: `bouncerJson:26-32`이 `spawnSync`로 CLI를 부른다. 주입점은 `deps.finalizeEvidence`(`:306`)뿐이다. `score-archived-run.cjs`는 응답기를 import하지 않고 `run.json`·`verifier.json`만 읽는다(`:16`, `:28`, `:68`).
- 재현: `node --test benchmarks/acp/responder.test.cjs` 통과.

#### Target behavior

- 판독 순서: 한 턴은 quiz → 블록 → 엄격 형식 → violation 순서로 판정한다. `bouncer-finalize` stage에서 `looksLikeQuizRequest`가 참이면 블록 유무와 관계없이 기존 `answerQuizText` 경로(`quiz`)로 간다.
- 성공(블록):
  - 턴 텍스트에서 `` 줄마다 블록 하나를 만든다. 질문 본문은 그 블록부터 다음 블록 또는 텍스트 끝까지다.
  - `gate`가 현재 stage workflow의 카탈로그 ID이고, 본문 `- X)` 선택지 문자 배열이 블록 `options`와 순서까지 같으면 그 게이트 `decide`로 답한다.
  - `recommended`는 `(Recommended)` 표시 대신 권장 선택지 판정에 쓴다.
- 성공(자유 입력 인식): 블록 `options`가 `[]`이고 본문에 `- X)` 줄이 없으면 선택지 없는 질문으로 만든다. 게이트 결정이 `replyText`를 돌려주면 `answerTextQuestion`의 `reply`가 그 문자열이고, 결정이 `null`이면 멈춘다. 이 task에서 `replyText`를 돌려주는 게이트는 없으므로 자유 입력 질문은 `unanswerable`로 멈춘다(`plan.request` 응답은 TASKS-002).
- 성공(엄격 형식): 블록이 하나도 없는 턴에서는 줄 시작 `**AskUserQuestion — <id>**`(뒤에 `(n/m)` 허용) 제목마다 질문 하나를 만든다. `<id>`가 카탈로그 ID이고 본문에 `- X)` 줄이 둘 이상이면 답한다. 제목 뒤에 같은 줄 문장이 이어지는 미리보기는 질문이 아니다.
- 성공(open decisions): `bouncer-plan` stage에서 `{"kind":"open_decisions"}` 블록이 있고 정책 `benchmark_choices.open_decisions === 'delegate_to_agent_recommendation'`이면 기존 `OPEN_DECISIONS_REPLY`로 답한다. 결정 기록 method는 `text/OpenDecisions`로 유지한다.
- 실패(violation, 실행기 기록 `{ method: 'text/contract-violation', reason, text }`):
  - `block-json`: 블록 JSON 파싱 실패, 또는 `gate`도 `kind`도 없는 블록.
  - `unknown-gate`: 블록 `gate`나 엄격 제목 ID가 카탈로그 밖.
  - `options-mismatch`: 블록 `options` 배열과 본문 `- X)` 문자 배열이 순서까지 같지 않음.
  - `too-few-options`: 블록 `options`가 비지 않았는데 `- X)` 줄 1개 이하, 또는 블록 없는 엄격 제목에 `- X)` 줄 1개 이하.
  - `unmarked-question`: quiz가 아니고 블록·엄격 제목이 없는데 `AskUserQuestion` 문구가 있거나 선택지 줄(`X)`, `1)`, `1A)` 형태, 앞의 `-`·`**` 허용)이 둘 이상인 턴. 블록 없는 open decisions 메시지(`v088-plan-open-decision.txt`)가 여기에 해당한다.
- 실패(정책, `unanswerable`): 형식은 맞지만 게이트 `decide`가 `null`이거나 open decisions 위임 정책이 없으면 응답하지 않고, 실행기는 지금처럼 `text/AskUserQuestion`으로 기록하고 멈춘다.
- 보존:
  - host `answerAskQuestion`, `answerPermission`, `answerQuizText`·`looksLikeQuizRequest`는 그대로다.
  - 블록·엄격 형식 질문 아래의 게이트별 `decide` 판단(증거·정책 조건)도 그대로다. 단 `cue`·`legacy` 인자는 지운다.
  - `stage-final/*.txt` 같은 완료 보고는 `none`이다.

#### Interface

- 제공:
  - `readTextQuestions(text: string, catalog: string[]) → { questions: Question[], openDecisions: boolean } | { violation: { reason: string } }`. `Question = { gate: string, options: Array<{ id: string, label: string }>, recommended: string | null, body: string, context: string }`. 질문이 없으면 `questions`가 빈 배열이고, `kind` 블록이 있으면 `openDecisions`가 `true`다.
  - 예: 블록 `{"gate":"init.gitignore","options":["A","B"],"recommended":"A"}`와 `- A) Write (Recommended)`·`- B) Skip` → `questions[0].gate === 'init.gitignore'`, `openDecisions === false`.
- 제공: `loadCatalog() → Record<string, string[]>`. `rules/acq-gates.json`의 `workflows` 전체를 읽는다. 응답기는 게이트 ID 집합을 이 함수로만 얻는다(에픽 기준 1의 응답기 쪽). stage별 목록은 `loadCatalog()[phase] ?? []`다.
- 제공: `turnQuestionState(policy, phase, text, workDir, deps) → { kind: 'quiz' | 'open_decisions' | 'answer' | 'unanswerable' | 'violation' | 'none', reason?: string, decision?: object }`. 실행기 두 곳이 이 함수 하나로 분기한다. `answer`면 `decision`이 `answerTextQuestion` 결과다.
- 제공: `answerTextQuestion(policy, phase, text, workDir, deps)`는 기존 반환 shape(`{ gate, choices, question, reply } | null`)를 유지한다. 게이트 결정이 `replyText`를 가지면 `reply`는 그 문자열이다.
- 제공(주입): 두 함수의 `deps`는 `{ catalog?: Record<string, string[]>, finalizeEvidence?: (workDir) => boolean, gates?: Array<{ gate, phase, decide }> }`다. `catalog` 기본값은 `loadCatalog()`, `gates` 기본값은 응답기 게이트 표다. 테스트는 `deps.gates`로 `replyText`를 돌려주는 결정을 넣을 수 있다.
- 거부(violation reason 값): `block-json`, `unknown-gate`, `options-mismatch`, `too-few-options`, `unmarked-question`.
- 삭제 export: `acqMarkers`, `unreadQuestion`, `unrecognizedQuestion`, `unhandledQuestionMethod`, `delegateOpenDecisions`, `classifyGate`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/acp/responder.cjs` | `answerTextQuestion`, `decideGateQuestion`, `chooseProceed`, `gates[].cue`, 신규 추출 지점: `readTextQuestions`·`loadCatalog`·`turnQuestionState`, `deps.gates` 주입 | Modify | 문장 휴리스틱 질문 판독과 게이트 결정 | 블록·엄격 형식 판독, 카탈로그 식별, 휴리스틱 export 삭제 | 기준 4·5 |
| `benchmarks/acp/responder.test.cjs` | 재생 루프, open decisions·unhandled 테스트 | Modify | 응답기 단위 테스트 | 블록·엄격·violation 테스트로 교체, 재생 기대값 분류 | 기준 1·4·5를 반환값으로 단언 |
| `benchmarks/acp/fixtures/acq/cases.json` | 항목 | Modify | 재생 기대값 | `expect: "answer" \| "violation"` 필드 추가 | 옛 fixture는 멈춤 기대로 전환한다는 discovery 결정 |
| `benchmarks/run-print-stage.cjs` | 턴 루프 질문 분기 | Modify | stage 턴 진행·미답 기록 | `turnQuestionState`로 분기, `text/contract-violation` 기록 | 호출자 |
| `benchmarks/run-acp-stage.cjs` | 턴 루프 질문 분기 | Modify | ACP stage 턴 진행 | 같은 분기·기록 | 호출자 |

#### Constraints

- `driveState`, `finalizeReady`, `finalizeEvidence`, `loadPolicy`, `LEDGER_001_FACTS`는 이 task에서 바꾸지 않는다(TASKS-002·003).
- 카탈로그 경로는 `path.join(pluginRoot, 'rules', 'acq-gates.json')`이며 기존 `pluginRoot`(`responder.cjs:8`)를 쓴다.
- 테스트 이름은 "<조건> → <결과>"이고 반환값·기록값만 단언한다. 실제 docker·Cursor를 띄우지 않는다.
- 재생 fixture의 `expect` 분류 규칙:
  - 원문에 카탈로그 ID 엄격 제목과 `- X)` 줄 둘 이상이 있는 항목은 `answer`이고 기존 `reply`·`gates`를 유지한다.
  - 나머지는 `violation`이다.
  - 분류 결과를 바꾸려고 원문을 고치지 않는다.

### benchmark-cost/responder-contract-rewrite/002 · `2dc22633`

#### Goal & intent

평가자 정책이 응답기 동작의 정본이 되게 한다. 다섯 정책은 카탈로그 게이트마다 `bouncer_decisions` 항목을 갖고, 그 `answer`는 `stop`이거나 응답기가 구현한 답이다. `LEDGER_001_FACTS` 하드코딩을 지우고, 정책에 선언만 있던 `init.graphify_promotion`·`init.base_branch`·`plan.request`·`commit.next_task`를 정책 답대로 응답한다.
수용 기준은 에픽 Success criteria 6이고, 완료 명령은 `npm run ci`다. 정책 수정은 2026-10-11 사용자 승인 범위(ledger-001 `task_facts` 명시, 미선언 `init.pre_commit_hook`의 `stop` 명시)에 한한다.

#### Current behavior

- 정책 다섯 개(`benchmarks/configs/{ledger-001..004,fastify-001}-evaluator-policy.json`)는 같은 게이트 목록을 선언한다. `init.pre_commit_hook`은 ledger-004에만 있다.
- 선언된 답의 차이: `plan.id_allocation`은 ledger-001이 `accept_suggested_ids_or_reuse_sole_draft`, 나머지가 `accept_suggested_ids`다. `plan.verify_command`는 fastify-001이 `recommended_package_script`, 나머지가 `npm test`다.
- legacy 항목 `plan.activate_pointer`, `finalize.quiz`가 모든 정책에 있다.
- 응답기 `gates`(`responder.cjs:180-317`)에 `decide`가 있는 게이트: `init.gitignore`, `init.pre_commit_hook`(정책 답이 `install`일 때만, `:204-206`), `plan.discovery`, `plan.id_allocation`, `plan.light_scope`, `plan.verify_command`, `plan.affected_paths`, `plan.activate_pointer`, `plan.approval`, `run.start_drive`, `finalize.remainder`, `finalize.pr`.
- 정책에 선언됐지만 `decide`가 없는 게이트: `init.graphify_promotion`(`enable_and_install`), `init.base_branch`(`main`), `plan.request`(`repeat_request_file`), `commit.next_task`(`advance_to_next_task`). 이 질문이 오면 멈춘다.
- `LEDGER_001_FACTS`(`responder.cjs:87-92`)와 `taskFact`(`:94-96`)가 ledger-001의 `discovery_terms`·`reusable_draft`를 코드로 채운다. `loadPolicy`(`:98-116`)는 ledger-001만 두 필드를 면제하고 `bouncer_decisions`는 검사하지 않는다. ledger-001 정책 `task_facts`에는 두 필드가 없다.
- `benchmarks/configs/README.md:15-19`가 "ledger-001 값은 응답기가 코드에 보존한다"고 적는다.
- 정책 검사 테스트는 `test/acq-gate-ids.test.js:51-74`에 있다.
  - 정책 gate가 카탈로그나 legacy 집합에 있는지 본다.
  - v3·`finalize.remainder` `--yes`를 본다.
  - `approval_record`가 `/2026-10-08 conversation: 사용자 승인/`과 맞는지 본다.
  - fastify-001이 `proposed`인지 본다.
- 정책 sha256은 원본 바이트 해시로 `run-bouncer-full.cjs:294`, `run-print-stage.cjs:78`·`:192`, `run-acp-stage.cjs:23`·`:165`에 기록된다.
- 재현: `node --test test/acq-gate-ids.test.js benchmarks/acp/responder.test.cjs` 통과.

#### Target behavior

- 성공(정책 파일):
  - ledger-001 `task_facts`에 `discovery_terms`(`["summary","--file","--month","YYYY-MM","TOTAL","stderr","exit 1","list","total","cli.js"]`)와 `reusable_draft`(`{"epic":"001-monthly-summary","blueprint":"001-summary-command"}`)가 있다.
  - ledger-001·002·003·fastify-001에 `{"gate":"init.pre_commit_hook","answer":"stop","when":"Policy approved before this gate existed; stop for a human."}`가 있다.
  - 다섯 정책 `approval_record` 끝에 `; 2026-10-11 conversation: 사용자 승인 — ...` 항목이 붙는다. 기존 내용은 바꾸지 않는다.
- 성공(응답기):
  - `LEDGER_001_FACTS`·`taskFact` 없이 `policy.task_facts`만 읽는다. `loadPolicy`는 모든 정책에 `discovery_terms`·`reusable_draft` 키를 요구한다.
  - `loadPolicy`는 `approval_state` 검사보다 먼저 카탈로그의 모든 게이트(모든 workflow)마다 정책 항목이 있고, 각 `answer`가 `stop`이거나 그 게이트의 구현 답 집합에 있는지 검사한다. 어긋나면 throw한다.
- 성공(네 게이트):
  - `init.graphify_promotion`: 권장 선택지가 활성화·설치(`enable|install|활성|설치`)이고 건너뛰기(`skip|건너|않`)가 아니면 고른다.
  - `init.base_branch`: `deps.currentBranch(workDir)`가 `main`이고 라벨에 `main`을 담은 선택지가 정확히 하나면 고른다.
  - `plan.request`: TASKS-001의 자유 입력 질문(블록 `options: []`)이 턴의 유일한 질문일 때 `policy.request_file` 원문을 `replyText`로 보낸다.
  - `commit.next_task`: 권장 선택지가 `current --set`을 담고 finalize·보고만(`finalize|report only|보고만`)이 아니면 고른다.
- 실패: 정책 답이 `stop`인 게이트, 조건이 맞지 않는 게이트, 정책 항목이 없는 게이트는 응답하지 않고 멈춘다.
- 보존: 기존 게이트의 결정 결과, legacy 항목 허용, fastify-001 `approval_state: proposed`, `policy_version: 3`.

#### Interface

- 제공: 응답기 상수 `IMPLEMENTED_ANSWERS: Record<gateId, string[]>`. 게이트 ID 집합이 아니라 게이트별 결정 구현 표이며(에픽 기준 1), 키는 카탈로그 ID와 legacy ID 안에 있어야 한다. `loadPolicy` 커버리지 검사와 테스트가 함께 쓴다. 예 `{ 'init.base_branch': ['main'], 'plan.verify_command': ['npm test', 'recommended_package_script'], ... }`.
- 제공: `plan.request` 결정은 TASKS-001이 정한 `replyText` 전달을 쓴다. 이 task에서 `replyText`를 돌려주는 게이트는 `plan.request` 하나다.
- 제공: `deps.currentBranch(workDir: string) → string | null`, `deps.readRequest(file: string) → string`. 기본은 `git rev-parse --abbrev-ref HEAD`(`gitEnv` 적용)와 저장소 루트(`pluginRoot`) 기준 파일 읽기다. 정책 `request_file`은 `benchmarks/tasks/ledger-001.prd.md`처럼 저장소 루트 기준이다.
- 제공: `loadPolicy(file: string, deps?: { catalog?: Record<string, string[]> })`. 커버리지 검사는 `deps.catalog`(기본 TASKS-001의 `loadCatalog()`)의 모든 workflow 배열을 합친 ID 집합을 쓴다.
- 거부(throw): `loadPolicy`는 다음 정책을 throw로 거부한다.
  - 카탈로그 게이트 항목 누락. 메시지 `evaluator policy missing gate <id>`.
  - 구현되지 않은 `answer`. 메시지 `evaluator policy answer <answer> for <id> is not implemented`.
  - `discovery_terms`·`reusable_draft` 키 누락.
- 거부(멈춤, throw 없음): `plan.request`가 다른 질문과 한 턴에 오면 응답하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/acp/responder.cjs` | `LEDGER_001_FACTS`, `taskFact`, `loadPolicy`, `gates`, 신규 추출 지점: `IMPLEMENTED_ANSWERS` | Modify | 정책 검증과 게이트 결정 | 하드코딩 제거, 커버리지 검증, 네 게이트 `decide` 추가 | 기준 6 |
| `benchmarks/acp/responder.test.cjs` | 정책·게이트 테스트 | Modify | 응답기 테스트 | 커버리지 거부, 네 게이트 응답 테스트 | 판정 지점 |
| `benchmarks/configs/ledger-001-evaluator-policy.json` | `task_facts`, `bouncer_decisions`, `approval_record` | Modify | 승인 정책 | 두 사실, `init.pre_commit_hook` stop, 승인 기록 | 사용자 승인 2026-10-11 |
| `benchmarks/configs/ledger-002-evaluator-policy.json` | `bouncer_decisions`, `approval_record` | Modify | 승인 정책 | `init.pre_commit_hook` stop, 승인 기록 | 같은 승인 |
| `benchmarks/configs/ledger-003-evaluator-policy.json` | `bouncer_decisions`, `approval_record` | Modify | 승인 정책 | 같은 변경 | 같은 승인 |
| `benchmarks/configs/ledger-004-evaluator-policy.json` | `approval_record` | Modify | 승인 정책 | 승인 기록만 | 같은 승인 |
| `benchmarks/configs/fastify-001-evaluator-policy.json` | `bouncer_decisions`, `approval_record` | Modify | 초안 정책 | `init.pre_commit_hook` stop, 승인 기록 | 같은 승인 |
| `benchmarks/configs/README.md` | ledger-001 설명 | Modify | 정책 규칙 설명 | 코드 보존 문장을 정책 명시로 바꿈 | 문서·코드 일치 |
| `test/acq-gate-ids.test.js` | 정책 테스트 | Modify | 정책 gate·버전 검사 | 카탈로그 게이트별 항목 존재 테스트 추가 | 기준 6 판정 지점 |

#### Constraints

- 정책 JSON은 위에 적은 항목만 더한다. 기존 키·값·`approval_state`·`policy_version`은 바꾸지 않는다. 예외로 `approval_record` 문자열 끝에 2026-10-11 항목을 덧붙이는 것은 승인 기록 관례이며, 2026-10-11 사용자가 승인한 정책 수정(ledger-001 `task_facts` 명시, 미선언 `init.pre_commit_hook`의 `stop` 명시, 다섯 정책 `approval_record` 기록)에 포함된다.
- `test/acq-gate-ids.test.js`의 `2026-10-08` 승인 기록 단언은 유지된다(기존 문자열을 지우지 않음).
- `init.base_branch`의 git 호출은 `deps.currentBranch` 뒤에 두어 unit 테스트가 spawn 없이 돈다.
- `deps.currentBranch`·`deps.readRequest`는 TASKS-001이 정한 `answerTextQuestion`·`turnQuestionState`의 `deps` 객체에 더하는 키이며, 게이트 `decide`가 그 `deps`를 그대로 받는다.
- 정책 sha256이 바뀌는 것은 의도된 변화이며 과거 run 기록은 고치지 않는다.

### benchmark-cost/responder-contract-rewrite/003 · `b6ed0d96`

#### Goal & intent

응답기와 `run-bouncer-full.cjs`는 drive 준비 여부를 `finalize prepare` 결과의 `drive`로만 판정하고, 통합 기록의 head·branch는 같은 결과의 `range.head`·`git.branch`에서 읽는다. 실행기는 bouncer 이미지 안 플러그인 `package.json` 버전이 checkout 버전과 다르면 유료 요청 전에 멈추고, 답하지 못한 텍스트 질문은 run 디렉터리에 fixture 스텁으로 남긴다.
수용 기준은 에픽 Success criteria 7·8·9이고, 완료 명령은 `npm run ci`다.

#### Current behavior

- drive 상태:
  - `driveState`(`benchmarks/acp/responder.cjs:51-63`)는 `prepare.coordinator`가 없으면 `<checkout>/.bouncer/runtime/coordinator.json`을 직접 읽는다(`:57`).
  - `finalizeReady`(`:66-70`)는 `drive.status === 'ok'`, 비지 않은 tasks, 모두 `integrated`, dry-run 성공을 요구한다.
  - `finalizeEvidence`(`:72-78`)는 `finalize prepare`와 `finalize --blueprint`(dry-run)를 `bouncerJson`(`:26-32`, `spawnSync`)으로 부른다.
- 통합 확인: `run-bouncer-full.cjs` `checkIntegration`(`:196-210`)이 `finalize prepare` 뒤 `driveState`로 원장 `integrationHead`·`integrationBranch`·`tasks[].sha`를 읽어 `record.integration`(`:317`)에 남긴다. 파일이 export하는 것은 `collectFinalEvidence`(`:353`)뿐이다.
- 버전 기록:
  - `run-cursor.cjs:162-164`는 `plugin_version`을 checkout `package.json`에서 읽는다.
  - 이미지 빌드(`:185`) 뒤 `cursor-agent --version`을 `--entrypoint`로 읽는다(`:186-188`). 유료 실행은 그 뒤다.
  - `run-print-stage.cjs`는 빌드(`:96-99`) 뒤 `sleep infinity` 컨테이너(`:112-113`)를 띄우고, `run-acp-stage.cjs`는 빌드(`:41-45`) 뒤 `AcpClient`(`:53-56`)를 띄운다. 두 stage `run.json`에는 `plugin_version`이 없다.
  - `run-bouncer-full.cjs`는 bouncer 이미지를 직접 빌드하지 않고 stage 실행기를 `spawnSync`(`:92-108`)로 부른다. 최상위 `run.json`(`:288-296`)에도 `plugin_version`이 없다.
  - 이미지의 플러그인 `package.json` 위치는 `/home/node/.cursor/plugins/local/bouncer/package.json`(`benchmarks/docker/Dockerfile.cursor:34`)이다.
- 미답 기록: `unanswered`는 두 stage 실행기의 `decisions.json`(`run-print-stage.cjs:187-189`, `run-acp-stage.cjs:162`) 안에만 있다. 텍스트 항목은 `{ at, method, text }`, host 항목은 `{ at, method, params }`다. 재생 fixture 형식은 `benchmarks/acp/fixtures/acq/cases.json`의 `{ file, source, phase, workdir, reply, gates }`다.
- 테스트: `benchmarks/acp/responder.test.cjs`의 `finalizeReady`(`:436-441`)와 `driveState` 원장 fallback(`:650-662`), `benchmarks/run-bouncer-full.test.cjs`(`collectFinalEvidence`). docker를 대신할 seam은 없다.
- 재현: `node --test benchmarks/acp/responder.test.cjs benchmarks/run-bouncer-full.test.cjs` 통과.

#### Target behavior

- 성공(drive):
  - `finalizeReady(prepare, dryRun)`는 `prepare.ok === true`, `prepare.drive?.ready === true`, dry-run 성공일 때만 `true`다.
  - `run-bouncer-full.cjs`의 통합 확인은 `{ head: prepare.range.head, branch: prepare.git.branch, tasks: prepare.drive.tasks }`를 남긴다. `prepare.drive`가 `null`이거나 `ready`가 아니면 `integration incomplete`로 throw한다.
  - `driveState`와 원장 읽기는 지운다.
- 성공(버전):
  - `run-print-stage.cjs`·`run-acp-stage.cjs`·`run-cursor.cjs`(bouncer-full 조건)는 이미지 빌드 직후 `docker compose run --rm --no-deps --entrypoint cat bouncer /home/node/.cursor/plugins/local/bouncer/package.json`으로 버전을 읽는다.
  - 그 값이 checkout `package.json` `version`과 같으면 `run.json` `plugin_version`에 기록한다.
  - `run-bouncer-full.cjs`는 첫 stage `run.json`의 `plugin_version`을 최상위 `run.json`에 옮긴다.
- 실패(버전): 버전이 다르거나 읽지 못하면 `plugin version mismatch: image <a> != checkout <b>`(읽기 실패는 `image unreadable`)로 에이전트 요청 전에 0이 아닌 코드로 끝난다.
- 성공(보관):
  - stage 종료 시 `unanswered`의 텍스트 항목(`text`가 있는 것)마다 `<runDir>/unanswered/NN.md`(01부터)에 원문을 쓴다.
  - `<runDir>/unanswered/cases.json`에 `{ file: "NN.md", source: <runDir 기준 상대 run 경로>, phase, workdir: {}, reply: null, gates: [], expect: null, method, reason? }` 배열을 쓴다. `method`·`reason`은 재생 루프가 읽지 않는 참고 필드다. `expect: null`은 TASKS-001 재생 루프가 실패로 처리하므로, 사람이 저장소 fixture로 옮길 때 `answer`나 `violation`을 정해야 한다.
  - 텍스트 항목이 없으면 디렉터리를 만들지 않는다.
- 보존: vanilla 조건 `plugin_version: null`, host `params` 항목은 `decisions.json`에만 남는다. stage 상태값(`awaiting_user_decision` 등)은 그대로다.

#### Interface

- 제공: `benchmarks/plugin-version.cjs`.
  - `checkPluginVersion({ imageJson: string | null, checkoutVersion: string }) → { ok: true, version } | { ok: false, error }`. 순수 함수다.
  - `readImagePackageJson(runCompose: (args: string[]) => string) → string | null`. 이미지 안 `package.json` 원문을 돌려주고 `runCompose`가 throw하면 `null`이다. 파싱은 `checkPluginVersion`이 한다. docker 호출은 주입된 `runCompose` 뒤에 둔다.
- 제공: `benchmarks/unanswered-fixtures.cjs` `writeUnansweredFixtures(runDir: string, { source: string, phase: string, unanswered: object[] }) → string[]`. 쓴 파일 경로 목록을 돌려준다.
- 제공: `run-bouncer-full.cjs`가 `integrationFromPrepare(prepare) → { head, branch, tasks }`를 export한다(throw 조건은 위 실패).
- 거부(throw): `integrationFromPrepare`는 `prepare.ok !== true`, `drive` 없음, `ready` 아님을 거부한다. `checkPluginVersion`은 throw하지 않고 `{ ok: false }`로 알린다. 실행기는 이를 `Error`로 바꿔 끝난다.
- 삭제 export: `driveState`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/acp/responder.cjs` | `driveState`, `finalizeReady`, `finalizeEvidence` | Modify | drive 판정과 원장 읽기 | `drive.ready` 판정, 원장 읽기 삭제 | 기준 7 |
| `benchmarks/acp/responder.test.cjs` | `finalizeReady`·`driveState` 테스트 | Modify | drive 판정 테스트 | `drive` 기반 테스트로 교체 | 판정 지점 |
| `benchmarks/run-bouncer-full.cjs` | `checkIntegration`, 신규 추출 지점: `integrationFromPrepare`, run record | Modify | 통합 확인·run 기록 | prepare 필드 사용, `plugin_version` 전달 | 기준 7·8 |
| `benchmarks/run-bouncer-full.test.cjs` | `integrationFromPrepare` 테스트 | Modify | full 실행기 테스트 | 성공·거부 테스트 추가 | 판정 지점 |
| `benchmarks/plugin-version.cjs` | 신규 추출 지점: 버전 대조·조회 | Create | 없음 | 버전 대조 순수 함수와 조회 | 기준 8 |
| `benchmarks/plugin-version.test.cjs` | 버전 테스트 | Create | 없음 | 일치·불일치·읽기 실패 테스트 | 판정 지점 |
| `benchmarks/unanswered-fixtures.cjs` | 신규 추출 지점: 미답 fixture 쓰기 | Create | 없음 | `unanswered/` 스텁 쓰기 | 기준 9 |
| `benchmarks/unanswered-fixtures.test.cjs` | 보관 테스트 | Create | 없음 | 텍스트 항목·host 항목·빈 목록 테스트 | 판정 지점 |
| `benchmarks/run-print-stage.cjs` | 빌드 뒤·종료 기록 | Modify | print stage 실행 | 버전 검사, `plugin_version` 기록, 미답 보관 호출 | 기준 8·9 |
| `benchmarks/run-acp-stage.cjs` | 빌드 뒤·종료 기록 | Modify | ACP stage 실행 | 같은 변경 | 기준 8·9 |
| `benchmarks/run-cursor.cjs` | `record.plugin_version` | Modify | 단일 실행기 기록 | 이미지 값 검사·기록 | 기준 8 |
| `benchmarks/runs/README.md` | run 디렉터리 계약 | Modify | 원본 증거 구조 설명 | `unanswered/`와 `plugin_version` 출처 설명 | 결과 구조 문서 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 릴리스 기록 | BP 002 항목(응답기 계약 기반 판독, 정책 커버리지, 버전 검사, 미답 보관) | 에픽 기준 10 |

#### Constraints

- 버전 검사는 유료 요청(에이전트 컨테이너 실행) 전에 끝난다. vanilla 조건은 검사하지 않는다.
- docker·git 호출은 주입 함수 뒤에 두고, 새 테스트는 docker를 띄우지 않는다.
- `run.json`의 기존 필드 이름과 의미는 바꾸지 않는다. `plugin_version`만 출처가 이미지로 바뀐다.
- `unanswered/` 파일 번호는 `unanswered` 배열 순서이며 두 자리(`01`)다.
