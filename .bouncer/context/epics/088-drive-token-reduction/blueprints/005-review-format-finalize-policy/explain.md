---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/005-review-format-finalize-policy/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-08T09:50:31.521+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '088'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: a904712d564d75e3f2a1de3906da6abd34ccb355
      range_to: ab54c3109145ebafd19544c7e12c92d49073c0db
      diff_sha: 11b5988c252ab9372f1d681f73087322d449d6cf31ec726578be5429fb16a910
      recorded_at: '2026-10-08T09:52:14.000+09:00'
  task_commits:
    - task: EPIC-088/BP-005/TASK-001
      sha: 618292ba
      intent_anchor: task-001
    - task: EPIC-088/BP-005/TASK-002
      sha: '11722031'
      intent_anchor: task-002
    - task: EPIC-088/BP-005/TASK-003
      sha: ab54c310
      intent_anchor: task-003
---
# Explain

## Background
plan 에이전트는 context review 기록을 쓰려고 검증기 소스를 읽었다. G18이 요구하는 round 필드, finding 필드, 현재 계획 snapshot digest를 어디서도 볼 수 없었고, 문서의 fingerprint 예시는 G18이 거절하는 형식이었다. coordinator도 repair wave에서 아직 고치지 않은 must_fix를 기록할 status 값이 없어 리뷰 기록 소스를 읽었다. 벤치마크는 정책이 이미 사라진 finalize 선택지("worktree 유지")에 답해서, ledger 두 run이 finalize에서 멈추고 따로 채점해야 했다.

## Intuition
검증기가 요구하는 형식을 에이전트가 쓰는 자리(`--help`와 계약 카드)에 미리 적어 두고, 벤치마크 응답기와 하네스는 지금 finalize가 실제로 묻는 질문과 지우는 대상에 맞춘다.

## Code
- `scripts/src/lib/cli-review-dispatch-command.ts` — `review-dispatch --help`가 G18 통과 round 예시와 enum을 출력한다.
- `scripts/src/lib/validate-sections.ts` — `CONTEXT_REVIEW_PERSPECTIVE` export, execute 리뷰 finding status `open`.
- `references/coordinator-cards/review.md`, `final_review.md` — finding status 표와 discovery→delta 예시 JSON.
- `benchmarks/acp/responder.cjs` — 정책 v3, `finalize.remainder`에 A로 응답.
- `benchmarks/run-bouncer-full.cjs` — `collectFinalEvidence`가 worktree 없이 integration 브랜치 ref에서 증거를 모은다.
- `benchmarks/configs/*-evaluator-policy.json` — `policy_version` 3.

## Quiz
1. `bouncer review-dispatch plan --help`가 보여 주는 context review 예시에서 snapshot digest는 어디서 얻는가?
   - A) 에이전트가 epic·blueprint·task 본문의 sha256을 직접 계산한다.
   - B) `review-dispatch plan --blueprint <dir>` 출력 JSON의 `target.digest`를 옮긴다.
   - C) `context-review.md`의 마지막 round 값을 그대로 쓴다.
2. 리뷰 문서 status가 `accepted`인데 finding 하나가 `open`이면 `review record`는 어떻게 하는가?
   - A) 경고만 남기고 기록한다.
   - B) `open`을 `resolved`로 바꿔 기록한다.
   - C) 원장을 바꾸지 않고 거절한다.
3. context review(G18)가 finding status `open`을 받으면 어떻게 되는가?
   - A) `status invalid: open`으로 거절한다.
   - B) execute 리뷰와 같이 받아들인다.
   - C) `deferred`로 간주한다.
4. ledger 평가자 정책 v3는 finalize remainder 질문에 어느 선택지로 응답하는가?
   - A) worktree를 유지하는 선택지.
   - B) `finalize --yes` 커밋과 worktree 제거(A).
   - C) 취소(D).
5. 응답기가 `policy_version: 2` 정책 파일을 읽으면 어떻게 되는가?
   - A) 이전 정책으로 보고 그대로 응답한다.
   - B) 3으로 올려서 응답한다.
   - C) `unsupported evaluator policy`로 거절한다.
6. finalize가 integration worktree를 지운 뒤 하네스는 채점용 patch를 어디서 얻는가?
   - A) integration 브랜치 ref의 `base..<branch>` diff.
   - B) 지워지기 전에 복사해 둔 worktree 디렉터리.
   - C) 메인 체크아웃의 작업 트리 diff.

## Tasks

### EPIC-088/BP-005/TASK-001 · `618292ba`

#### Goal & intent

plan 에이전트가 플러그인 소스를 열지 않고 `bouncer review-dispatch --help` 출력과 `review-dispatch plan`의 `target.digest`만으로 G18을 통과하는 `bouncer.context_review` 기록을 쓰게 한다. 수용 기준은 epic Success criteria 17·18, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 도움말 없음: `cli-review-dispatch-command.ts:30-36` `USAGE`와 `:163-167` registry `usage`가 plan·execute 형식만 적는다. `cmdReviewDispatch`(:132) → `parseReviewDispatchArgs`(:45) 흐름에 help 감지가 없다.
  - `review-dispatch --help`: :48 "command must be plan or execute" + USAGE를 stderr, exit 2.
  - `review-dispatch plan --help`: `parseFlags`(`cli-flags.ts:7-27`)가 `{help:true}`로 삼키고 "--blueprint is required", exit 2. `plan -h`는 무시돼 같은 에러.
  - `plan --blueprint X --help`: help를 무시하고 분류기를 돌린다.
- digest 출처: `review-dispatch.ts`의 `classifyPlanReview`는 ok 결과(:143 skip, :169 single, :184 clustered)에 `target: { digest, documents }`를 싣는다(`plan-snapshot.ts:29,43`). 그런데 `skills/bouncer-plan/references/context-review.md:8-12`(step 1)는 digest를 sha256으로 손수 계산하라고 하고, :49(step 5)는 "Recompute the digest"라고만 쓴다.
- 틀린 fingerprint 예시: `references/context-review/index.md:46-47`과 `agents/bouncer-context-reviewer.md:174`의 `correctness_tests:tasks/001 interface:scripts/lib/example.js#runExample`은 `context:` 접두사가 없고 category가 context 관점이 아니어서 G18이 `fingerprint namespace invalid`·`category invalid`로 거절한다(`validate-sections.ts:297-308`). 같은 줄의 공식 `context:<category>:<brief_clause>:<file>#<symbol>`은 맞다.
- enum: `validate-sections.ts:33` severity, :37 `CONTEXT_REVIEW_STATUS`, :55-63 `CONTEXT_REVIEW_PERSPECTIVE`(combined, local, global, cross_document, scope, korean_quality, success_criteria). export 목록(:428-448)에 `CONTEXT_REVIEW_PERSPECTIVE`가 없다. `severity_changes`는 검사하지 않는다.
- 따라 할 패턴: `cli-review-command.ts`의 `HELP_ROUND_EXAMPLE`(:29-58)·`HELP`(:65-85)·`argvRequestsHelp`(:94-104), 처리는 `cmdReview`(:193-197)에서 lazy require 전에 `io.out(HELP); return 0`. 테스트는 `test/review-record.test.js:308-338`(fence 추출 후 실제 기록)과 `test/cli-help.test.js:375-388`(argv 변형별 exit 0·빈 stderr).
- I/O 관찰 지점: `cli-review-dispatch-command.ts:140` lazy `require('./review-dispatch')`(파일·git 읽기), :141 `process.cwd()`. 출력은 주입된 `io.out`/`io.err`라 `test/cli-help.test.js:30-37` `capture`로 잰다. G18 freshness는 `validate-gates.ts:1352-1355`에서 `deps.planSnapshot`이 있으면 그것을, 없으면 `computePlanSnapshot`을 부른다.
- 재현: `node scripts/bouncer review-dispatch plan --help` → exit 2.

#### Target behavior

- 성공
  - argv 어디에든 `--help`가 있거나 플래그 값 자리가 아닌 `-h`가 있으면 `review-dispatch`는 `HELP`를 stdout에 쓰고 exit 0, stderr는 비어 있다. `review-dispatch --help`, `review-dispatch plan --help`, `review-dispatch plan -h`, `review-dispatch plan --blueprint X --help`, `review-dispatch execute --help` 모두 같다. 이때 `./review-dispatch`를 require하지 않는다.
  - `HELP`는 기존 USAGE, 한 줄 형식 안내, ```` ```yaml ```` fence 하나(`bouncer.context_review` 블록: `rounds:`에 round 1 — `round: 1`, `mode: discovery`, `target: { digest: <target.digest> }`, `perspectives: [{ name: combined, target_digest: <target.digest> }]`, `severity_changes: []` — 와 `findings:`에 finding 하나), Enums 블록, fingerprint 공식, "digest는 계산하지 말고 `review-dispatch plan --blueprint <dir>` 출력 JSON의 `target.digest`를 옮긴다. `ok: false`면 digest가 없으니 리뷰를 부르지 않는다"는 안내를 싣는다.
  - 예시 finding은 `id`, `severity`, `status: accepted`, `note`, `category`(context 관점 값), `brief_clause`, `file`, `symbol`, 공식대로 계산한 `fingerprint`(`context:` 접두), `actionability: advisory`, `origin: discovery`, `first_seen_round: 1`, `last_seen_round: 1`을 모두 갖는다.
  - Enums 블록의 관점 목록은 export한 `CONTEXT_REVIEW_PERSPECTIVE`를, status는 `CONTEXT_REVIEW_STATUS`를, severity는 `REVIEW_SEVERITY`를 join해서 만든다. 손으로 쓴 목록을 두지 않는다.
  - 예시의 `<target.digest>` 두 곳을 실제 `review-dispatch plan` 출력 digest로 바꿔 `context-review.md` frontmatter `bouncer.context_review`에 넣고 status를 `accepted`로 두면 plan 게이트에 G18 실패가 없다.
  - `skills/bouncer-plan/references/context-review.md` step 1은 손 계산 대신 `review-dispatch plan` 출력의 `target.digest`를 고정 snapshot digest로 기록하라고 하고, step 5는 수정 뒤 `review-dispatch plan`을 다시 실행해 새 `target.digest`를 옮기라고 한다. 두 reference 모두 형식 예시는 `bouncer review-dispatch --help`에 있다고 적는다.
  - 두 reference와 `agents/bouncer-context-reviewer.md`의 fingerprint 예시는 `context:` 접두와 context 관점 category를 쓰는 값으로 바뀐다(예: `context:scope:tasks/001 touch:.bouncer/context/epics/014-auth/blueprints/001-signup/tasks/001/tasks.md#touch`). `.codex/agents/bouncer-context-reviewer.toml`은 `mdToCodexToml(md)` 결과와 같다.
- 실패: `--help`가 없는 잘못된 호출(빈 argv, 알 수 없는 서브커맨드, 필수 플래그 누락)은 지금처럼 stderr + exit 2, stdout은 비어 있다.
- 보존: `--help` 없는 `plan`·`execute` JSON 출력과 exit code, global `bouncer --help`의 review-dispatch usage 줄, G18 검사 규칙.

#### Interface

- 제공
  - `bouncer review-dispatch [plan|execute] [...] --help|-h` → stdout `HELP`, exit 0.
  - `validate-sections` export에 `CONTEXT_REVIEW_PERSPECTIVE: readonly string[]` 추가.
- 거부(exit 2, 기존과 같음): `--help`·`-h` 없는 빈 argv, plan/execute가 아닌 첫 토큰, `plan`의 `--blueprint` 누락, `execute`의 필수 플래그 누락.
- 도움말로 보지 않는 입력: `--` 플래그 바로 뒤의 `-h`(그 플래그의 값).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `USAGE`, `cmdReviewDispatch`, 신규 추출 지점: help 판정·HELP 상수 | Modify | plan·execute 인자 해석과 분류기 호출 | lazy require 전에 help 판정, HELP 출력 | 진입점 |
| `scripts/src/lib/validate-sections.ts` | `CONTEXT_REVIEW_PERSPECTIVE` export | Modify | G18 enum 정의, 관점 목록 비공개 | export에 추가 | 도움말 enum을 검증기 상수에서 만듦 |
| `references/context-review/index.md` | 2. **Contract** fingerprint 예시, digest 출처 문장 | Modify | 계약 서술, 틀린 예시 | 예시 교체, `--help`·`target.digest` 안내 | 탐색을 부르던 문서 |
| `skills/bouncer-plan/references/context-review.md` | step 1 **Freeze the snapshot**, step 5 **Certify the delta** | Modify | 손 계산 절차 | CLI `target.digest` 기록으로 교체 | REQ-1.5 |
| `agents/bouncer-context-reviewer.md` | fingerprint `Example:` 줄 | Modify | 틀린 예시 | 예시 교체 | 리뷰어가 같은 예시를 복사함 |
| `.codex/agents/bouncer-context-reviewer.toml` | 생성본 | Modify | md의 Codex 생성본 | md 변경 반영 | `test/agents.test.js:355-356` 일치 검사 |
| `test/review-dispatch.test.js` | 신규: 도움말 예시 G18 통과 | Modify | review-dispatch CLI 테스트 | 예시+실제 digest로 G18 통과 단언 | 수용 기준 17 |
| `test/cli-help.test.js` | 신규: review-dispatch help argv 변형 | Modify | 서브커맨드 help 단언 | exit 0·빈 stderr·형식 문구 단언 | 진입점 검증 |
| `test/skill-context-review.test.js` | :83-90 손 계산 단언 | Modify | sha256·순서 문구 요구 | CLI `target.digest`·`--help` 문구 요구, `correctness_tests:` 부재 단언 | 문서 계약 변경 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | 항목 추가 | 프로젝트 규칙 |

#### Constraints

- help 판정은 `./review-dispatch` lazy require보다 앞에 둔다(:138-139 주석의 의도 유지). `validate-sections`의 정적 import는 `./paths`(→ `tasks-docs`, `schema`, `frontmatter`)만 끌어오고 intent 모듈을 끌어오지 않으므로(`test/cli-project-commands.test.js:329`) 허용한다.
- `test/skill-context-review.test.js:91-158`과 `test/skill-bouncer-plan.test.js:232-252,254-,356-364`가 요구하는 단계 제목(`2. **Discovery**`, `3. **Merge**`, `5. **Certify the delta**`, `6. **Close**`)과 문구(`review-dispatch plan`, `target_digest`, `digest` 등)를 유지한다. `test/template-guidance.test.js:87-106`이 요구하는 Contract 절의 `trim`·`lowercase`·`` `/` ``·`` `./` ``도 유지한다.
- 도움말 예시는 fence 하나만 둔다. YAML 들여쓰기는 `bouncer:` 아래 `context_review:` 블록으로 바로 붙여 넣을 수 있게 쓴다.
- 공개 에러 메시지는 바꾸지 않는다.

### EPIC-088/BP-005/TASK-002 · `11722031`

#### Goal & intent

repair wave에서 coordinator가 소스를 읽지 않고 해결 전 must_fix를 기록하고, fix 뒤 delta round에서 해결로 바꾸게 한다. execute 리뷰 finding status에 `open`을 더하고, review·final_review 카드에 status 의미와 기록 예시를 싣는다. 수용 기준은 epic Success criteria 19·20, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- enum: `scripts/src/lib/validate-sections.ts:37` `CONTEXT_REVIEW_STATUS = ['resolved','accepted']`, :38 `EXECUTE_REVIEW_STATUS = ['resolved','accepted','deferred']`, :40 `NOTE_REQUIRED_STATUS = ['accepted','deferred']`. status가 목록에 없으면 :278 `finding X status invalid: <status>`. 해결 전 상태를 뜻하는 값이 없다.
- accepted 검사: :323 `reviewStatus === 'accepted' && rec.actionability === 'must_fix' && rec.status !== 'resolved'` → `accepted with open must_fix`. 이 검사는 `if (modeContract && rec)`(:286) 안이라 mode 있는 round가 없으면 돌지 않고, advisory는 보지 않는다.
- 호출부: `reviewStatus`는 G21(`validate-gates.ts:323`), G14(:1067), `review-record.ts:261`이 넘기고, G18(:971)은 넘기지 않는다. `EXECUTE_REVIEW_STATUS`는 G21(:322)·G14(:1066)·`review-record.ts:260`이 쓴다.
- 기록: `review-record.ts`의 `mergeFindings`(113-131)는 같은 id면 객체를 통째로 바꾸므로 delta round는 finding의 모든 필드를 다시 보낸다. `round.round`는 기존 개수+1이어야 한다(236-244). `--status` 없으면 문서 status를 유지한다(252). 검증 실패면 파일 bytes를 바꾸지 않는다(277-290).
- delta 요건(`validate-sections.ts`): `mode: delta`(376), `target.base`·`target.head`(382-385), perspective가 있으면 `target_head === target.head`(393), delta에서 처음 본 finding은 origin `introduced_by_revision` 또는 blocker·major의 `missed_critical`(414-422).
- 카드: `references/coordinator-cards/review.md:74-82`와 `final_review.md:31-49`는 `review record`와 `--status <requested|addressed|accepted>`(문서 status), repair 흐름만 적고 finding status 값과 예시 JSON이 없다.
- 도움말: `scripts/src/lib/cli-review-command.ts:75` Enums `finding status: resolved|accepted|deferred (accepted and deferred require note)`, `HELP_ROUND_EXAMPLE`(:24-58)의 F1은 discovery round인데 `must_fix`·`resolved`다.
- 다른 enum 서술: `scripts/src/lib/templates.ts:278` execute review guidance `status: resolved | accepted | deferred`, `references/review/index.md:52,64`, `skills/bouncer-execute/references/review-round.md:127-130`("an unresolved finding is never recorded as done").
- 흐름 판정: `coordinate-next.ts:443-444`(final_review)와 :594(task review)는 `review.md` status가 `accepted`가 아니면 같은 리뷰 행동을 다시 돌려준다. 문서 status `requested`·`addressed`를 구분하지 않는다.
- 카드 테스트: `test/coordinate-next.test.js:187-199` `assertCardFor`는 카드 파일을 시험 시점에 읽어 byte 비교한다. :982-1015, `test/agents.test.js:233-259`, `test/coordinator.test.js:1394-1418`은 카드 정규식을 단언한다.
- I/O 관찰 지점: `review-record.ts:62-74`(blueprint `index.md`), :133-177(round JSON), :229(`review.md` 읽기), :277-290(임시 파일 후 rename). 테스트는 `test/review-record.test.js:57` `makeBlueprintRepo`, :73 `writeJson`, :84 `recordCli`로 임시 repo에 기록한다.
- 재현: `test/review-record.test.js:158-180`은 `open` 대신 `deferred` + note로 열린 must_fix를 흉내 낸다.

#### Target behavior

- 성공
  - `EXECUTE_REVIEW_STATUS`는 `resolved, accepted, deferred, open`이다. `open`은 note가 필요 없다.
  - discovery round에서 `open` must_fix finding을 `--status requested`로 기록하면 성공하고 문서 status는 `requested`다.
  - 같은 finding id를 delta round(round 2)에서 `status: resolved`, `last_seen_round: 2`로 다시 보내고 `--status accepted`를 주면 성공한다.
  - review·final_review 카드는 `## Finding status` 절에 표를 둔다. `open`은 아직 고치지 않음(문서 `accepted` 불가), `resolved`는 고침, `accepted`는 note로 위험 수용, `deferred`는 note로 현재 task와 독립인 후속 계획. 같은 절에서 문서 `--status`(`requested`: 리뷰가 열려 있음, `addressed`: 수정 반영 후 재확인 대기, `accepted`: 해결 끝)와 구분한다.
  - 같은 절에 repair wave 순서를 적는다. ① discovery round: 해결 전 must_fix는 `open`, 문서 `--status requested`. ② fix(task 경로는 fix implementer, blueprint 경로는 `coordinate repair --review-finding <id>`). ③ delta round: 그 finding을 모든 필드와 함께 `resolved`로 다시 보내고 `--status accepted`.
  - review 카드에는 task 리뷰 모드, final_review 카드에는 blueprint 리뷰 모드(`task_brief_hashes`, `intent_bundles`) 예시를 ```` ```json ```` fence 두 개(discovery, delta 순서)로 싣는다. 각 fence는 `review record --round`가 받는 `{ "round": {...}, "findings": [...] }` 그대로다.
  - `review record --help`의 Enums 줄은 `finding status: resolved|accepted|deferred|open (accepted and deferred require note; open is rejected when --status accepted)`이다. 예시 F1의 status는 `open`이다. 도움말은 repair wave 예시가 review·final_review 카드에 있다고 적는다.
  - `templates.ts` execute guidance, `references/review/index.md`, `review-round.md`의 status 서술에 `open`과 "accepted 리뷰에는 남을 수 없음"을 더한다.
- 실패
  - 리뷰 문서 status가 `accepted`일 때 `open` finding이 하나라도 있으면 `finding <id> open in accepted review`로 실패한다. actionability와 round mode 유무와 관계없다. `review record`는 `review-ledger-invalid`로 거절하고 bytes를 바꾸지 않는다. G14·G21도 같은 메시지로 실패한다.
  - context review(G18)의 `open`은 지금처럼 `finding X status invalid: open`이다.
- 보존: `deferred`·`accepted` note 규칙, must_fix 검사(:323), round 순서·delta origin 규칙, `--status` 허용값, `coordinate next` 판정.

#### Interface

- 제공: finding status `open`(execute 리뷰 전용). `EXECUTE_REVIEW_STATUS` export 값에 `open` 추가.
- 거부: 문서 status `accepted` + `open` finding(`finding <id> open in accepted review`), context review의 `open`(`status invalid`).
- 도메인 용어: "해결 전 finding" — 이번 round에서 확인했지만 아직 diff에 반영되지 않은 finding. 모양 `{ "status": "open", "actionability": "must_fix", ... }`, 예 `F1`이 discovery에서 `open`이고 delta에서 `resolved`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `EXECUTE_REVIEW_STATUS`, `collectFindingFailures` | Modify | status enum과 finding 검사 | `open` 추가, accepted 문서의 `open` 실패 | 상태 계약 |
| `scripts/src/lib/cli-review-command.ts` | `HELP_ROUND_EXAMPLE`, `HELP` | Modify | `review record` 도움말 | Enums·예시 status·카드 안내 | 도움말 진입점 |
| `scripts/src/lib/templates.ts` | execute review guidance 문자열 | Modify | 리뷰 문서 안내 enum | `open` 서술 | enum 서술 일치 |
| `references/coordinator-cards/review.md` | 신규 `## Finding status` 절 | Modify | task 리뷰 drive 계약 | status 표·순서·예시 2개 | REQ-2.1~2.3 |
| `references/coordinator-cards/final_review.md` | 신규 `## Finding status` 절 | Modify | blueprint 리뷰 drive 계약 | status 표·순서·예시 2개 | REQ-2.1~2.3 |
| `references/review/index.md` | finding `status` 항목, accepted 조건 | Modify | 리뷰어 status 안내 | `open` 서술 | enum 서술 일치 |
| `skills/bouncer-execute/references/review-round.md` | advisory·unresolved 문단(:127-130) | Modify | 해결 전 finding 금지 문구 | `open`으로 기록하고 accepted 전 `resolved`로 바꾼다고 적음 | 문서 간 모순 제거 |
| `test/review-record.test.js` | 신규: 카드 예시 기록, open 거절 | Modify | 기록 단위·CLI 테스트 | 카드 fence 두 개 연속 기록, accepted+open 거절 | 수용 기준 20 |
| `test/skill-bouncer-execute.test.js` | :627 `unresolved finding is never recorded as done` 단언 | Modify | `review-round.md` 문구 고정 | 바뀐 문구(`open`으로 기록, accepted 전 `resolved`) 단언으로 교체 | 문서 문구를 고정하는 테스트 |
| `test/validate-gates.test.js` | G14·G18 open 단언 | Modify | 게이트 enum 단언 | G14 accepted+open 실패, G18 open 거절 | 수용 기준 19 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | 항목 추가 | 프로젝트 규칙 |

#### Constraints

- 카드 기존 문장과 `test/coordinate-next.test.js:982-1015`, `test/agents.test.js:233-259`, `test/coordinator.test.js:1394-1418`이 요구하는 문구를 유지한다. `review-round.md`는 `test/skill-bouncer-execute.test.js:347-352`의 `deferred` 분류 금지 문구를 유지하고, :627 단언만 새 문구에 맞춘다.
- 카드 예시는 각 카드에 json fence 정확히 두 개이고, 그 밖의 json fence를 두지 않는다. `review record --help`는 json fence 하나를 유지한다(`test/review-record.test.js:311`).
- delta 예시의 finding은 discovery 예시 finding과 id·fingerprint·`first_seen_round: 1`·`origin: discovery`가 같다.
- `NOTE_REQUIRED_STATUS`에 `open`을 넣지 않는다.

### EPIC-088/BP-005/TASK-003 · `ab54c310`

#### Goal & intent

ledger bouncer-full run이 응답기 개입 없이 finalize를 끝내고, 하네스가 integration worktree 제거 뒤에도 closed blueprint·HEAD·`diff.patch`를 모아 `verifier.json`까지 만들게 한다. 수용 기준은 epic Success criteria 21·22, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- 정책: `benchmarks/configs/{ledger-001,ledger-002,ledger-003,ledger-004,fastify-001}-evaluator-policy.json` 모두 2행 `"policy_version": 2`, 6행 `approval_record`(한 문자열, `; `로 이은 날짜별 기록). `finalize.remainder`(ledger-001:143, 002:163, 003:162, 004:162, fastify-001:152)는 `"answer": "commit_and_keep_worktree"`, `when`은 "Only after a successful finalize prepare, clean dry-run, and complete verified integration; keep worktrees for benchmark evidence." `finalize.next_blueprint`(각 +10행)는 `"leave_pointer_cleared"`. fastify-001은 `approval_state: "proposed"`.
- 실제 질문(v088004-1 `04-finalize/decisions.json` `unanswered[0]`): 선택지 A) `` `finalize --yes` commit + remove execute worktree (Recommended) ``, C) Fix message/staging and re-check, D) Cancel — do not run `--yes`. `benchmarks/runs/`는 gitignore라 원문을 복사해야 한다.
- 응답기 `benchmarks/acp/responder.cjs`
  - `loadPolicy`(:96-113) :99 `policy.policy_version !== 2`면 `unsupported evaluator policy`. 호출부 `run-acp-stage.cjs:20`, `run-print-stage.cjs:75`, `run-bouncer-full.cjs:256`은 값을 기록만 한다.
  - `finalize.remainder` gate(:301-307): `finalizeEvidence(workDir)`가 거짓이면 null, 참이면 `labelMatch(options, /commit only|keep worktree|.../)` — 현재 선택지에 맞는 라벨이 없어 null → `awaiting_user_decision`.
  - `finalize.next_blueprint` gate(:314-320), 퀴즈 제외 정규식(:360)의 `next blueprint|다음 블루프린트`.
  - `finalizeEvidence(workDir)`(:70-76)는 `bouncerJson`(:24-31, `spawnSync` 모듈 로드 시 구조 분해 :5)으로 `finalize prepare`와 dry-run을 띄운다. 주입 지점이 없다. 정책 값을 읽는 gate는 `init.pre_commit_hook`(:203)뿐이다.
  - 호출 경로: `answerTextQuestion(policy, phase, text, workDir)`(:552) → `decideQuestion`(:350) → `decideGateQuestion`(:356) → `chosen.decide({ policy, prompt, context, options, workDir })`(:378). `chooseProceed`(:135-141)·`recommendedProceed`(:122-128)는 첫 번째·유일한 `(Recommended)` 선택지가 REVISE·CANCEL이 아니면 고른다.
- 테스트: `benchmarks/acp/responder.test.cjs:44-56`(:48 `policy_version` 2 단언, :51 1은 거절), :232-242 fixture 재생(`fixtures/acq/cases.json`의 `{file, source, phase, workdir, reply, gates}`, `workdirWith`(:209-228)는 git·drive 없는 디렉터리), :452-455·:530-573 옛 B 선택지 문구로 분류만 단언. `test/acq-gate-ids.test.js:65` `legacy`에 `finalize.next_blueprint`.
- 하네스 `benchmarks/run-bouncer-full.cjs`
  - :283 04-finalize cwd는 `integrationWorktree(workspace)`(:155-162, 정확히 하나 아니면 throw). :295 03-run 뒤 `record.integration = checkIntegration(...)` → `{ head, branch, tasks }`(branch 예 `feat/001-001-add-f-short-option`). :294 02-plan 뒤 `record.blueprint`는 상대 디렉터리.
  - finalize 뒤 :298-307: `integrationWorktree` → `integrationGitEnv`(:166-170, `.git` 링크) → `closedBlueprint(integration)`(:212-217, 파일 시스템 읽기, 절대 경로 기록) → `git status --porcelain` dirty 검사 → `rev-parse HEAD` → `git diff --binary --no-ext-diff base HEAD --` → `diff.patch` → `verifyPatch`(:308). 실패는 :310-317 catch에서 `status: 'stopped'`.
  - finalize 스킬 cleanup(`skills/bouncer-finalize/references/cleanup-handoff.md:12,21`)은 integration·worker worktree를 지우고 브랜치는 지우지 않는다. 그래서 A를 고르면 :298이 `found 0`으로 throw한다.
  - :334 `main()`을 무조건 호출하고 export가 없어 테스트가 없다.
- 문서: `benchmarks/docker/README.md:146-148`은 integration worktree에서 닫힌 blueprint와 통합 HEAD를 확인한다고 쓴다. `benchmarks/score-archived-run.cjs:3-9` 머리 주석은 정책이 `commit_and_keep_worktree`라 응답기가 멈춘다고 쓴다.

#### Target behavior

- 성공
  - 다섯 정책 파일: `policy_version: 3`. `finalize.remainder`는 `"answer": "finalize_yes_and_remove_worktrees"`, `when`은 "Only after a successful finalize prepare, clean dry-run, and complete verified integration; the harness collects evidence from the integration branch ref."(조건 세 개 유지). `finalize.next_blueprint` 항목 없음. `approval_record` 끝에 `; 2026-10-08 conversation: 사용자 승인 — finalize.remainder는 A(finalize --yes 커밋과 worktree 제거)로 응답하고 finalize.next_blueprint 항목을 지움, policy_version 3`. 그 밖의 키와 값은 그대로다. 이 승인은 finalize 항목 변경에 대한 것이라 fastify-001의 `approval_state: "proposed"`는 그대로이고, `loadPolicy`는 지금처럼 fastify-001을 거절한다.
  - `loadPolicy`는 `policy_version === 3`만 받는다.
  - `finalize.remainder` gate는 finalize 증거가 있으면 `chooseProceed(options, { require: /finalize --yes/i })`로 A를 고른다. 증거가 없으면 null.
  - finalize 증거 판정은 주입할 수 있다: `answerTextQuestion(policy, phase, text, workDir, deps = {})` → `decideQuestion`·`decideGateQuestion`이 `deps`를 넘기고, gate는 `(deps.finalizeEvidence ?? finalizeEvidence)(workDir)`를 부른다.
  - fixture `benchmarks/acp/fixtures/acq/finalize-remainder-en.md`에 v088004-1 `unanswered[0]`의 finalize.remainder 블록(제목부터 "Reply with **A**, **C**, or **D**."까지)을 그대로 둔다. `cases.json` 항목 `{ "file": "finalize-remainder-en.md", "source": "v088004-ledger-004-bouncer-full-1 04-finalize", "phase": "bouncer-finalize", "workdir": {}, "finalizeEvidence": true, "reply": "A", "gates": ["finalize.remainder"] }`. 재생 루프는 `finalizeEvidence`가 참인 case에 `deps.finalizeEvidence = () => true`를 넘긴다.
  - 하네스: 04-finalize 뒤 `collectFinalEvidence({ workspace, baseCommit, branch: record.integration.branch, blueprint: record.blueprint })`가 workspace 메인 저장소에서 `git rev-parse --verify refs/heads/<branch>`로 HEAD를, `git show <branch>:<blueprint>/index.md`로 `status: closed`를, `git diff --binary --no-ext-diff <base> <branch> --`로 patch를 얻는다. 반환값 `{ blueprint, integration_head, patch }`로 `record.blueprint`(상대 경로), `record.integration_head`, `diff.patch`를 채운 뒤 지금처럼 `verifyPatch`를 부른다. integration worktree 존재·dirty 검사는 하지 않는다.
  - `run-bouncer-full.cjs`는 `require.main === module`일 때만 `main()`을 부르고 `collectFinalEvidence`를 export한다.
  - `test/acq-gate-ids.test.js`의 `legacy`에서 `finalize.next_blueprint`를 빼고, 다섯 정책 파일 모두 카탈로그 밖 gate가 없는지 본다.
  - 퀴즈 제외 정규식(:360)의 `next blueprint|다음 블루프린트`는 남긴다. finalize 본문에 그 문구가 나와도 퀴즈로 오인하지 않게 하는 보호이고 gate 삭제와 무관하다.
  - `benchmarks/docker/README.md`는 integration 브랜치 ref에서 증거를 모은다고, `score-archived-run.cjs` 머리 주석은 policy v3 이전 run 채점용이라고 고친다.
- 실패
  - `policy_version`이 3이 아니면(2 포함) `loadPolicy`가 `unsupported evaluator policy`로 throw한다.
  - finalize 증거가 없으면 `finalize.remainder`에 답하지 않는다(`reply` 없음, unanswered).
  - integration 브랜치 ref가 없으면 `collectFinalEvidence`가 `integration branch missing: <branch>`로, ref의 blueprint가 `closed`가 아니면 `blueprint not closed on <branch>`로 throw하고 run은 `stopped`다.
- 보존: 다른 gate 판정과 cue, finalize 증거 판정 기준(`finalizeReady`), 01~03 단계 흐름, 04-finalize cwd, `verifyPatch`·`verifier.json` 경로, run 기록 필드 이름.

#### Interface

- 제공
  - `answerTextQuestion(policy, phase, text, workDir, deps?: { finalizeEvidence?: (workDir: string) => boolean })`. `decideQuestion`도 같은 5번째 인자를 받는다.
  - `collectFinalEvidence({ workspace: string, baseCommit: string, branch: string, blueprint: string, deps?: { git?: (args: string[], cwd: string) => { status: number, stdout: Buffer|string } } }) → { blueprint: string, integration_head: string, patch: Buffer }`. `deps.git`가 없으면 `spawnSync('git', ...)`.
- 거부(throw): `policy_version !== 3`, 브랜치 ref 없음, ref의 blueprint `status`가 `closed`가 아님.
- miss: finalize 증거 없음 → gate 결과 null(throw 아님).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `benchmarks/configs/ledger-001-evaluator-policy.json` | `policy_version`, `approval_record`, `bouncer_decisions` | Modify | 승인 답 | v3, A, next_blueprint 삭제 | REQ-3.1·3.2·3.4 |
| `benchmarks/configs/ledger-002-evaluator-policy.json` | 같음 | Modify | 같음 | 같음 | 같음 |
| `benchmarks/configs/ledger-003-evaluator-policy.json` | 같음 | Modify | 같음 | 같음 | 같음 |
| `benchmarks/configs/ledger-004-evaluator-policy.json` | 같음 | Modify | 같음 | 같음 | 같음 |
| `benchmarks/configs/fastify-001-evaluator-policy.json` | 같음 | Modify | 초안 답 | 같음 | 사용자 결정 |
| `benchmarks/acp/responder.cjs` | `loadPolicy`, `finalize.remainder`·`finalize.next_blueprint` gate, `answerTextQuestion`, `decideQuestion`, `decideGateQuestion` | Modify | 정책 로드와 gate 답 | v3, A 선택, deps 주입, next_blueprint 삭제 | 멈춤 원인 |
| `benchmarks/acp/responder.test.cjs` | :44-56 정책 버전, :232-242 재생 루프 | Modify | 응답기 단언 | v3 단언, deps 주입, 증거 없음 단언 | 수용 기준 21 |
| `benchmarks/acp/fixtures/acq/finalize-remainder-en.md` | fixture | Create | 없음 | v088004-1 질문 원문 | 수용 기준 21 |
| `benchmarks/acp/fixtures/acq/cases.json` | case 목록 | Modify | 재생 case | finalize case 추가 | 같음 |
| `test/acq-gate-ids.test.js` | `legacy`, 정책 파일 목록 | Modify | ledger-001만 검사 | next_blueprint 제거, 다섯 파일 검사 | REQ-3.2 |
| `benchmarks/run-bouncer-full.cjs` | `main` 마지막 수집 블록, 신규 `collectFinalEvidence`, 실행 진입부 | Modify | worktree에서 증거 수집 | 브랜치 ref 수집, export, main 가드 | REQ-3.3 |
| `benchmarks/run-bouncer-full.test.cjs` | 신규 | Create | 없음 | worktree 없는 임시 저장소에서 수집 단언 | 수용 기준 22 |
| `benchmarks/docker/README.md` | :146-148 | Modify | worktree 기준 서술 | 브랜치 ref 서술 | 문서 일치 |
| `benchmarks/score-archived-run.cjs` | 머리 주석 :3-9 | Modify | 멈춤 원인 서술 | v3 이전 run용이라고 적음 | 문서 일치 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | 항목 추가 | 프로젝트 규칙 |

#### Constraints

- 정책 JSON의 키 순서와 다른 항목 bytes를 바꾸지 않는다. 바뀐 정책은 `evaluator_policy_sha256`으로 이전 run과 구분된다.
- fixture는 원문 bytes를 그대로 옮기고 요약하지 않는다.
- `deps`가 없을 때 응답기와 하네스의 동작은 실제 spawn 경로 그대로다.
- `run-bouncer-full.test.cjs`는 docker·bouncer를 띄우지 않는다. 임시 git 저장소와 브랜치만 쓴다.
