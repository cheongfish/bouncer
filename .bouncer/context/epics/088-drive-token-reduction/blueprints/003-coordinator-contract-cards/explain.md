---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/088-drive-token-reduction/blueprints/003-coordinator-contract-cards/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-07T12:48:00.201+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '088'
  blueprint_id: '003'
  status: published
  comprehension:
    - range_from: 284a9491ce4179adc4c958edc536038cbf25cd6e
      range_to: 9063b04fac2d24443d71b45cf352348f6d2b702c
      diff_sha: 0744c36ebd75a82ba1d5617f140abb84116c85ba459090394e9176da0f8e9372
      recorded_at: '2026-10-07T12:55:00+09:00'
  task_commits:
    - task: EPIC-088/BP-003/TASK-001
      sha: f8f88df5
      intent_anchor: task-001
    - task: EPIC-088/BP-003/TASK-002
      sha: 9063b04f
      intent_anchor: task-002
---
# Explain

## Background

`coordinate next`는 coordinator에게 다음 행동을 알려 준다. 그 행동의 세부 규칙(worker 기동, verify·review·report 마감)은 coordinator 역할 문서와 execute reference 세 곳에 흩어져 있었고, 세션마다 긴 지침을 통째로 읽어야 했다.

같은 규칙을 `references/coordinator-cards/` 카드 아홉 개가 나눠 들고, `coordinate next`는 해당 카드 본문을 응답 `card`에 그대로 실는다. 카드가 없거나 읽을 수 없으면 `ok: false`, reason `coordinator-card-missing`으로 실패한다. `prepare`·`integrate` 같은 기계적 행동과 `ok: false`에는 `card` 키가 없다. coordinator 역할 문서에는 Authority, Hard guards, `next` 루프, Output contract와 Worker dispatch·Task round의 짧은 안내만 남긴다.

## Intuition

다음 행동이 정해지면, 그 행동의 설명서가 응답에 붙어 온다.

## Code

- `references/coordinator-cards/{dispatch,implement,verify,review,report,revise,record,final_review,blocked}.md` — 행동별 계약
- `scripts/src/lib/coordinate-next.ts` — `CARD_IDS`, `readPluginCard`, `attachCard`; 플러그인 루트 기준 경로만 사용
- `agents/bouncer-coordinator.md`와 `.codex/agents/bouncer-coordinator.toml` — 줄어든 루프 지침
- `coordinate next --help` — `card` 필드와 첨부 규칙

## Quiz

1. `coordinate next`가 `card` 본문을 붙이는 때는?
   - A) `ok: true`이고 action이 dispatch·implement·verify·review·report·revise·record·final_review·blocked 중 하나일 때
   - B) `prepare`와 `integrate`를 포함해 모든 성공 action일 때
   - C) `ok: false`일 때도 reason 카드로 붙일 때

2. 첨부 대상 카드 파일이 없거나 읽을 수 없으면?
   - A) `card: null`을 넣고 계속 진행한다
   - B) cwd의 `references/`에서 같은 이름을 찾아 대신 붙인다
   - C) `ok: false`, reason `coordinator-card-missing`, exit 1이다

3. coordinator 역할 문서에서 걷어 낸 것은?
   - A) Authority와 Hard guards 본문
   - B) Worker dispatch·Task round의 drive 세부 규칙과 execute reference를 읽으라는 지시
   - C) Output contract와 `next` 루프 단계 표지

## Tasks

### EPIC-088/BP-003/TASK-001 · `f8f88df5`

#### Goal & intent

`references/coordinator-cards/`에 계약 카드 9개를 만든다. `coordinate next`가 blueprint Contract의 첨부 규칙대로 `card: { id, body }`를 싣게 한다. 완료 조건은 epic Success criteria 6·10·12와 아래 Checklist이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `scripts/src/lib/coordinate-next.ts`:
  - `Judge`(`:35`), `NextOk`(`:36-41`), `NextErr`(`:42`). `NextOk`에는 `card` 키가 없다.
  - 성공 응답은 모두 `succeed(body, cwd, ledgerRef)`(`:224-232`)를 거친다. `blocked`일 때만 `hintFor`(`:83`)로 `cause`·`next`를 붙인다. `fail(reason)`은 `:96`이다.
  - 진입점은 `coordinateNext`(`:247`) → `blueprintNext`(`:293`) / `taskNext`(`:407`)다. export는 `{ coordinateNext, NEXT_FAILURE_HINTS }`(`:588`)다.
  - action별 생성 위치:
    - blueprint 범위: blocked(`:302`, `:307`, `:314`, `:386`), integrate(`:322`, `:338`), drive_tasks(`:330`), verification_node(`:351`), prepare(`:359`), final_review(`:373`), done(`:383`).
    - task 범위: none(`:424`), blocked(`:429`, `:435`, `:473`, `:485`, `:527`, `:565`), dispatch(`:440`, `:478`), record(`:447`), revise(`:462`), implement(`:501`), verify(`:512`), review(`:531`), commit(`:543`), report(`:552`).
  - `NEXT_FAILURE_HINTS`(`:44-73`)에는 7개 키가 있다.
- 파일 읽기는 coordinator helper(`loadLedgerBytes` `:261`, `readBouncerBlock`, `taskBriefHashOf` `:455`)뿐이다. 주입 seam은 `opts.deps.execFileSync`(`:247-252`)만 있다.
- 플러그인 루트를 찾는 공용 helper는 없다. `graphify.ts:190` `pluginRootFromLib()`와 `codex-agents.ts:31-33`이 각자 `path.join(__dirname, '..', '..')`을 쓴다. 빌드 출력은 `scripts/lib`다(`tsconfig.json:7-8`).
- `compactCoordinateOutput`(`coordinate-output.ts:29-42`)은 `tasks`·`decisions`만 지우므로 `card`는 그대로 나간다. CLI exit는 `result.ok ? 0 : 1`(`cli-git-commands.ts:700`)이다. `coordinate next --help` 본문은 `cli-git-commands.ts:477-487`, 응답 필드 줄은 `:485`다.
- 배포와 검사:
  - `package.json:9`의 `files`에 `references/`가 통째로 들어가 새 디렉터리도 배포된다. `scripts/build-release.js:138-161`은 `npm pack` 목록을 복사한다.
  - `scripts/check-doc-shape.js` `classifyDocPath`(`:698-704`)는 `references/<dir>/index.md`만 subskill로 검사한다. `index.md`가 없는 카드 디렉터리는 lint 대상이 아니다.
- drive 규칙의 현재 출처:
  - `agents/bouncer-coordinator.md` Worker dispatch, Task round, Procedure 3·5·6.
  - `skills/bouncer-execute/references/agent-dispatch.md`, `review-round.md`, `verification-recovery.md`. `test/skill-bouncer-execute.test.js:166-293`이 이 세 파일을 직접 읽는다.
- 테스트:
  - `test/coordinate-next.test.js`는 응답 전체를 deep-equal하지 않는다(`:285`, `:518` 필드 단언).
  - hint 키 목록 단언은 `:195-207`이다.
  - fixture 주행(`:638-767`)은 deps 없이 실제 `coordinateNext`를 부른다.
  - `test/cli-help.test.js:297-317`이 `coordinate next --help` 단언이다.

#### Target behavior

- 성공:
  - 카드 파일 9개가 있고, 각 파일은 그 행동의 drive 규칙을 담는다.

    | 카드 | 담을 규칙(출처) |
    | --- | --- |
    | `dispatch` | intent bundle 1회 확정과 `intent_bundle_id`·`intent_bundle_revision` 고정, revise 뒤 재확정, 실패 시 role dispatch 금지(Task round 1·2), `judge` `intent-symbols` 채우는 법 |
    | `implement` | implementer payload 여덟 절과 bundle 식별자·`intent_sections`, dispatch metadata 다섯 개, Brief revision 요구, attempt 동안 brief 동결, `references/implementation/index.md` 필수 읽기, named·fallback 동일 payload(Worker dispatch, `agent-dispatch.md`) |
    | `verify` | `verification.md` 손기록 금지, `tasks → verified` 뒤 execute gate, 실패 시 debugger → implementer 1회와 그 다음 판정(Task round 3, `verification-recovery.md`) |
    | `review` | frozen target, CLI `perspectives` 순서만 순회, `ok: false`·target·`risk_flags` 불일치 시 중단, `review record` round, discovery·fix·delta 각 1회(`review-round.md`, Worker dispatch per-task 절) |
    | `report` | Brief revision 대조, stale이면 받은 attempt·hash로 report하고 record 금지, outcome 다섯 가지와 그 뒤 행동(Procedure 3) |
    | `revise` | `coordinate revise`만 범위를 바꿈, 경로 제한, 사유 필수, 다른 task 몫이면 rework(Hard guards drift 항목의 drive 절차) |
    | `record` | decision에 실제 변경 경로를 적고 provenance를 decision 안에 둠(Procedure 3) |
    | `final_review` | blueprint 최종 리뷰 target·`review-dispatch`·perspectives·`repair --review-finding`·delta 1회·`repair-wave-limit` 처리(Worker dispatch 최종 리뷰 절) |
    | `blocked` | 판정 다섯 가지, critical recovery 1회, repair 2 wave와 `NEXT_PLAN.md`·`partial-close --user-confirmed`(Procedure 5, Hard guards) |

  - 카드 본문은 출처 문단의 영어 문장을 그대로 옮긴다. 출처는 `agents/bouncer-coordinator.md`의 Worker dispatch 120-194, Task round 201-224, Procedure 3 Drive 279-294, 5 Judge 307-313, 6 Close 314-323이다. 그래서 그 문단을 고정하던 기존 규칙 정규식이 카드 파일 합본에서도 그대로 맞는다. 대상 정규식은 `test/agents.test.js:231-258`, `:490-494`, `:771-813`, `:842-855`(제목 단언 제외)와 `test/coordinator.test.js:1395-1412`다. 표의 각 카드는 이 문단 중 자기 행동에 해당하는 문장을 받는다.
  - `next` 응답 첨부: action이 9개 id 중 하나이면 `card: { id, body }`를 싣는다. `body`는 파일 bytes를 UTF-8로 읽은 그대로다. 그 밖의 action과 `ok: false`에는 `card` 키가 없다.
- 실패: 첨부 대상 카드가 없거나 읽기에 실패하면 `fail('coordinator-card-missing')`로 끝난다. 이때 `checkpoint`·`action`은 싣지 않고 exit 1이다.
- 보존:
  - 기존 action 판정, `argv`, `judge`, `payload`, `checkpoint`, 원장 무변경 성질은 그대로다.
  - 세 execute reference와 `agents/bouncer-coordinator.md`는 이 task에서 바꾸지 않는다.

#### Interface

- 제공:
  - `references/coordinator-cards/{dispatch,implement,verify,review,report,revise,record,final_review,blocked}.md`.
  - `NextOk.card?: { id: CardId; body: string }`.
  - `NEXT_FAILURE_HINTS['coordinator-card-missing']`의 `cause`·`next`.
  - `coordinateNext(opts)`의 `opts.deps.readCard?: (id: CardId) => string`. 기본값은 `path.join(__dirname, '..', '..', 'references', 'coordinator-cards', `${id}.md`)`를 읽는다. 테스트 seam이다.
  - `coordinate next --help`의 한 줄: `card` 필드와 첨부 대상 action 9개 이름.
- 거부:
  - 카드 대상 action인데 카드를 못 읽으면 `card` 없는 성공 응답을 내지 않는다.
  - cwd·`--repo`·소비 저장소 경로에서 카드를 찾지 않는다.
  - 카드 id 목록 밖의 이름을 `readCard`로 넘기지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/coordinator-cards/` | 카드 9개 | Create | 없음 | Target behavior 표의 규칙을 담은 Markdown | Interface |
| `scripts/src/lib/coordinate-next.ts` | `NextOk`, `succeed`, `NEXT_FAILURE_HINTS`, `coordinateNext` | Modify | 행동 판정 | `card` 첨부, `readCard` seam, 새 hint | 단일 응답 경로 `succeed` |
| `scripts/src/lib/cli-git-commands.ts` | `COORDINATE_USAGE_BLOCKS.next` | Modify | `next` 도움말 | 응답 필드 줄에 `card` 추가 | `--help` 계약 |
| `test/coordinate-next.test.js` | 첨부·누락·hint 키 테스트 | Modify | `next` 단언 | 첨부 대상·비대상 action 단언, 누락 시 `ok: false`, hint 키 목록 갱신, 공통 규칙 일치 단언 | Success criteria 10·12 |
| `test/cli-help.test.js` | `coordinate next --help` 단언 | Modify | 도움말 단언 | `card` 필드와 첨부 대상 action 9개 이름 단언 추가 | `--help` 계약 |
| `CHANGELOG.md` | `[Unreleased]` `### Added` | Modify | 미출시 변경 목록 | 계약 카드 항목 | epic Success criteria 6 |

#### Constraints

- 카드 디렉터리에 `index.md`를 만들지 않는다. 만들면 doc-shape lint가 subskill로 검사한다.
- 카드 본문은 영어로 쓴다. 다른 역할 문서·reference와 같은 언어여야 공통 규칙 문구를 테스트로 대조할 수 있다.
- 카드는 이미 coordinator 지침이나 세 reference에 있는 규칙만 옮긴다. 새 규칙을 만들지 않는다.
- 공통 규칙 일치 테스트는 카드와 reference 양쪽에서 같은 정규식을 쓴다. 대상은 리뷰 상한(discovery·fix·delta 각 1회), debugger 1회, stale Brief revision의 report·record 금지, CLI `perspectives` 순서 권위다.
- 새 함수에는 한국어 docstring(Summary, Args, Returns)을 단다(`references/implementation/index.md`).
- `scripts/lib`는 커밋하지 않는다(`npm run check:emit`).

### EPIC-088/BP-003/TASK-002 · `9063b04f`

#### Goal & intent

`agents/bouncer-coordinator.md`에서 Worker dispatch·Task round·Procedure 3·5·6의 drive 세부 규칙을 걷어낸다. 그 규칙은 TASKS-001의 계약 카드가 맡는다. 세 execute reference를 가리키는 문장은 없앤다. 완료 조건은 epic Success criteria 6·11과 아래 Checklist이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `agents/bouncer-coordinator.md`는 344줄이다. 절 구성은 preamble(7-14), Authority(16-42), Hard guards(44-116), Worker dispatch(118-194), Task round(196-227), Procedure(229-323), Output contract(325-343)다.
- Worker dispatch 절의 내용과 옮길 카드:
  - 120-125: named 역할 dispatch와 Cursor print opt-in.
  - 126-128: "workers report…", 소유권 표지.
  - 129-133: `references/implementation/index.md` 필수 읽기.
  - 134-141: dispatch metadata 다섯 개 → `dispatch`/`implement`.
  - 142-145: brief 동결 → `revise`/`dispatch`.
  - 146-149: worker cwd와 brief → `implement`/`review`.
  - 150-185: blueprint 최종 리뷰 → `final_review`, 그중 repair 한도 부분은 `blocked`.
  - 186-191: per-task 리뷰 → `review`.
  - 192-194: 상한과 worker 기록.
- Task round 절:
  - 198-199: 도입부.
  - 201-213: intent bundle → `dispatch`.
  - 215-220: revise 뒤 재검증 → `revise`.
  - 222-224: verify·execute gate → `verify`.
  - 226-227: commit.
- Procedure 절:
  - 3 Drive 275-279: 세 reference와 `## Task round`를 가리키는 문장. 이번에 제거할 대상이다.
  - 3 Drive 279-289: report·record·provenance → `report`/`record`.
  - 3 Drive 290-294: 재dispatch → `revise`/`dispatch`.
  - 5 Judge 307-313, 6 Close 314-323(`final_review` 세부).
- 다른 문서가 이 절을 참조하는 곳:
  - `skills/bouncer-execute/SKILL.md:16-17`: "coordinator does not load this skill; it follows … `## Task round`". `test/skill-bouncer-execute.test.js:590-592`가 이 문장을 고정한다.
  - `docs/architecture/rule-ownership.md:58`: GOV-COORD-AUTHORITY 위치가 `## Worker dispatch`/`workers report`다.
  - `docs/architecture/rule-ownership.md:76`: load graph에 `rules/subagent-model.md`와 `references/implementation/index.md`가 있다.
  - `test/rule-ownership.test.js:298-333`, `:379-395`가 위 두 줄을 coordinator 문서에서 찾는다.
- coordinator 문서를 고정하는 테스트(R은 어딘가에 남아야 하는 규칙, W는 문구·위치):
  - `test/agents.test.js`:
    - `:231-258` 리뷰 dispatch 문구 전체(R, Worker dispatch 150-191).
    - `:359-372` Cursor print 문장 정확 일치(R).
    - `:460-474` `--lease-id`·`--generation`·`coordinate revoke`(R).
    - `:478-486` Close의 `completed`·finalize 미실행(R).
    - `:490-494` provenance inside the decision(R).
    - `:771-813` dispatch metadata·stale Brief revision(R, Worker dispatch 섹션을 잘라 읽음).
    - `:842-855` Task round 제목과 intent bundle·`--gate execute`·hand-write 금지·revise 뒤 재번들(제목은 W, 나머지는 R).
    - `:858-865` `next` 루프와 commit 단계(R).
    - `:868-876` Drive가 세 reference와 Task round를 가리킴(W, 목표와 반대).
    - `:597-610`·`:638` TOML 동일성과 제목 순서(`ROLE_PROCEDURE`에 Procedure 또는 Worker dispatch).
  - `test/coordinator.test.js:1395-1412`: 문서 전체에서 `review-dispatch execute`·`ok: false`·target 불일치·중단·override 금지를 찾는다(R).
  - 그대로 통과해야 하는 범위 밖 단언:
    - `test/cli-help.test.js:385-388`: `--help\`; do not read plugin sources for them`.
    - `test/skill-bouncer-run.test.js:89-99`, `:180-194`: `coordinate dispatch`·`attempt`·`previous_outcome`.
    - `test/distribution.test.js:233-240`: fence 문자열·`coordinate status`·TOML 동일성.
    - `test/trust-boundary.test.js`, `test/master-rules.test.js:829-845`, `test/workflow-safety-canon.test.js:157`: Hard guards만 본다.
- TOML은 `mdToCodexToml`(`scripts/src/lib/codex-agents.ts:43-72`) 출력과 bytes가 같아야 한다. 저장소에 TOML을 쓰는 CLI는 없다.

#### Target behavior

- 성공:
  - Authority, Hard guards, Output contract 본문은 그대로다.
  - `## Worker dispatch`는 짧은 안내로 남긴다. 담는 내용:
    - `rules/subagent-model.md`를 따른 named 역할 dispatch와 Cursor print 문장(`:359-372`가 고정한 문장 그대로).
    - "workers report…" 소유권 문장.
    - `references/implementation/index.md` 필수 읽기 한 줄.
    - 행동별 drive 규칙은 `coordinate next` 응답의 `card`가 준다는 한 줄.
  - `## Task round`는 짧은 안내로 남긴다. 담는 내용:
    - 라운드의 행동별 규칙은 `dispatch`·`implement`·`verify`·`review`·`report`·`record` 카드가 준다.
    - commit 단계는 worker cwd에서 `bouncer commit --blueprint <dir> --yes`다.
  - Procedure는 088-002의 `next` 루프, 단계 표지 1~6, 범위 밖 테스트가 고정한 문자열을 유지한다. 행동별 세부는 "`card`를 따른다"로 줄인다.
  - 세 execute reference 경로 문자열과 그것을 읽으라는 지시가 문서와 TOML 어디에도 없다.
- 실패: 없음. 문서·테스트 변경이다. 판단 근거는 아래 테스트와 `npm run lint:docs`다.
- 보존:
  - 범위 밖 테스트(`cli-help`, `skill-bouncer-run`, `distribution`, `trust-boundary`, `master-rules`, `workflow-safety-canon`, `rule-ownership`, `skill-bouncer-execute`)는 고치지 않고 통과한다.
  - R 규칙은 카드 파일이나 이 문서 중 한 곳에서 계속 단언된다.

#### Interface

- 제공: 줄어든 `agents/bouncer-coordinator.md`, 같은 본문의 `.codex/agents/bouncer-coordinator.toml`, 카드 파일을 대상으로 옮긴 테스트 단언.
- 거부:
  - 문서에서 R 규칙을 지우면서 어느 카드에도 그 규칙이 없는 상태.
  - `## Worker dispatch`·`## Task round` 제목 삭제. 지우면 범위 밖 SKILL·rule-ownership 단언이 깨진다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | `## Worker dispatch`, `## Task round`, `## Procedure` | Modify | drive 세부 규칙과 reference 안내 | 짧은 안내와 `next` 루프만 남김 | Goal |
| `.codex/agents/bouncer-coordinator.toml` | `developer_instructions` | Modify | md 생성 사본 | `mdToCodexToml` 출력으로 재생성 | `test/agents.test.js:257` |
| `test/agents.test.js` | `:231-258`, `:771-813`, `:842-855`, `:490-494`, `:868-876` 등 | Modify | 문서 문구 고정 | R 단언을 해당 카드 파일로 옮기고, `:868-876`은 세 reference 부재 단언으로 뒤집음 | 규칙 이전 |
| `test/coordinator.test.js` | `:1395-1412` | Modify | 문서 전체 리뷰 규칙 단언 | `review`·`final_review` 카드 대상으로 옮김 | 규칙 이전 |
| `CHANGELOG.md` | `[Unreleased]` `### Changed` | Modify | 미출시 변경 목록 | coordinator 지침 축소 항목 | epic Success criteria 6 |

#### Constraints

- H2 순서는 Authority, Hard guards, Worker dispatch, Task round, Procedure, Output contract로 유지한다(`npm run lint:docs`, `test/agents.test.js:638`).
- 단계 표지 `1. **Ground**`, `3. **Drive**`, `4. **Integrate**`, `5. **Judge**`, `6. **Close**`를 유지한다.
- 범위 밖 테스트가 고정한 문자열을 문서에 남긴다:
  - fence: `coordinate status`, `checkpoint`, `--ledger-path <checkpoint.ledger.path>`, `--ledger-hash <checkpoint.ledger.sha256>`.
  - ``--help`; do not read plugin sources for them``.
  - `coordinate dispatch`, `attempt`, `previous_outcome`, `bouncer-implementer`.
  - `rules/subagent-model.md`, `references/implementation/index.md`, `rules/commit-scope.md`, `workers report`.
  - Cursor print 문장.
- 카드 파일이 없는 규칙을 문서에서 지우지 않는다. 이전 대상 규칙이 TASKS-001 카드에 없으면 문서에 남긴다.
- TOML은 손으로 고치지 않는다.
