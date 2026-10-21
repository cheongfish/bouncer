---
type: bouncer.explain
title: 008 explain
description: Explain for 008
resource: .bouncer/context/epics/drive-execution/blueprints/delta-single-reviewer/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-12T10:28:31.901+09:00'
bouncer:
  id: EXPLAIN-delta-single-reviewer
  epic_id: drive-execution
  blueprint_id: delta-single-reviewer
  status: published
  comprehension:
    - range_from: 6fc766788596dc8b41730711b86367957ab39000
      range_to: 8c40c3f819aedd8ed1c8703918cd844bb1de4a83
      diff_sha: 1d622af6216e01476974949a6f500a32c16e60a5e6c814aaa6962dc0f33191e3
      recorded_at: '2026-10-12T10:29:30.000+09:00'
  task_commits:
    - task: drive-execution/delta-single-reviewer/001
      sha: 90d53e87
      intent_anchor: task-001
    - task: drive-execution/delta-single-reviewer/002
      sha: a9aed48a
      intent_anchor: task-002
    - task: drive-execution/delta-single-reviewer/003
      sha: 8c40c3f8
      intent_anchor: task-003
---
# Explain

## Background

blueprint 최종 리뷰에서 repair·supplement 뒤 delta 단계가 discovery와 같은 관점 목록을 다시 열어 reviewer를 여러 명 띄웠다. 남은 finding을 적을 relation 값도 없어 reviewer가 플러그인 문서를 뒤졌다. 이 변경은 delta를 `combined` reviewer 하나로 접고, 관점이 둘 이상인 delta round 기록을 거절하며, `unresolved` relation으로 미해결 finding을 `open`으로 남긴다.

## Intuition

discovery는 여러 관점으로 훑고, delta는 한 명이 이전 finding만 다시 본다.

## Code

- `scripts/src/lib/cli-review-dispatch-command.ts` / `review-dispatch.ts` — `review-dispatch execute --mode discovery|delta`. delta면 `strategy: single`, `perspectives: ["combined"]`.
- `scripts/src/lib/coordinate-next.ts` — root `review.md`에 discovery round가 있거나 verified supplement면 `final_review` argv 끝에 `--mode delta`.
- `scripts/src/lib/validate-sections.ts` — execute 계약(`contract.counters`)의 delta round에 perspective ≥ 2면 `delta perspectives invalid`.
- `agents/bouncer-reviewer.md`, `references/review/assets/reviewer-prompt.md`, `references/coordinator-cards/final_review.md` — relation에 `unresolved`, delta는 `next` argv의 `--mode delta`와 reviewer 하나.

검증: 각 task `npm run ci` 통과 (`evidence` d0ec90d9… / 290096f0… / 1b2b6073…). blueprint root `review.md` discovery 1 round, findings 없음.

## Quiz

1. `bouncer review-dispatch execute … --mode delta`가 성공하면 분류 JSON의 strategy·perspectives는?
   - A) discovery와 같은 parallel 관점 목록
   - B) `single` / `["combined"]`
   - C) `risk_flags`에 security가 있으면 `["combined","security"]`

2. `coordinate next`의 blueprint `final_review`가 argv 끝에 `--mode delta`를 붙이는 조건은?
   - A) root `review.md`에 `mode: discovery` round가 있거나 최신 supplement가 `verified`
   - B) commit task가 하나라도 `verified`이면 항상
   - C) `must_fix` repair task가 열려 있을 때만

3. execute 리뷰 ledger에서 `mode: delta`이고 perspectives가 2개 이상이면?
   - A) context review(G18)만 실패하고 execute 기록은 통과
   - B) `review record`가 거절하고 G14·G21이 같은 메시지로 실패
   - C) 이름만 틀리면 개수 검사는 생략

4. reviewer가 이전 finding을 같은 id로 남기고 회귀가 아닐 때 쓰는 relation과 controller 처리는?
   - A) `regressed` — status를 `blocker`로 올림
   - B) `unresolved` — finding을 `status: open`으로 유지
   - C) `new` — fingerprint를 다시 발급

## Tasks

### drive-execution/delta-single-reviewer/001 · `90d53e87`

#### Goal & intent

blueprint final review의 delta 단계에서 coordinator가 받는 CLI 지시가 reviewer 하나를 가리키게 한다. 완료 조건은 epic Success criteria 31·32이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `parseExecuteArgs`(`scripts/src/lib/cli-review-dispatch-command.ts:203-237`)는 `--blueprint`·`--task`·`--base`·`--head`·`--repo`만 읽는다. 반환 객체의 `mode` 필드는 하위 명령 구분(`plan`|`execute`|`usage`)에 이미 쓰인다. USAGE(43-44행), HELP, export `usage`(299-300행)는 `review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha>`를 적는다.
- `cmdReviewDispatch`(~282행)는 `classifyExecuteReview({ repoRoot, blueprintDir, taskId?, base, head })`를 부른다.
- `classifyExecuteReview`(`scripts/src/lib/review-dispatch.ts:338-347`)는 diff가 작거나 scale이 light면 `['combined']`, 아니면 `['spec_scope','correctness_tests','minimality_maintainability']`를 만들고 `risk.flags`가 있으면 `'security'`를 덧붙인다(443-451행). 반환은 467-477행이다. delta를 구분하는 입력이 없어 repair 뒤 다시 불러도 discovery와 같은 목록이 나온다.
- `coordinate-next.ts:576-602` blueprint 분기는 root `review.md`가 `accepted`가 아니면 `final_review`를 돌려준다. argv는 `['bouncer','review-dispatch','execute','--blueprint',blueprint,'--base',base,'--head',head]`(597-600행)이고, 최신 supplement 결정이 `verified`일 때만 `payload: { mode: 'delta' }`를 싣는다(596행). must_fix repair 뒤에는 표시가 없다.
- `coordinate-next.ts:7`은 `coordinator`를 import하고 11행에서 `readBouncerBlock`을 꺼낸다. `bouncerStatus`(388-391행)가 그 위의 wrapper다. `readBouncerBlock`(`coordinator.ts:1387-1409`)은 ENOENT와 깨진 YAML에서 null을 돌려준다.
- I/O 결합: `review-dispatch.ts`의 git 호출은 주입 가능한 `exec`(732, 756행)를 쓰고 테스트가 주입한다(`test/review-dispatch.test.js:915,948,995`). CLI execute 경로에는 seam이 없어 테스트가 실제 git 저장소로 `capture([...])`를 돈다. `coordinate-next.ts:455`는 `opts.deps.execFileSync`를 받고, 문서 읽기는 직접 fs다. 테스트는 임시 integration 경로에 실제 파일을 쓰고 `assertNoWrite`로 감싼다.
- 기존 테스트: `test/coordinate-next.test.js` 401행(final_review argv에 `review-dispatch` 포함), 438행(verified supplement → `payload.mode === 'delta'`), 449행(supplement 없음 → `payload === undefined`). final_review argv 전체를 deepStrictEqual 하는 테스트는 없다. root `review.md`에 `bouncer.review.rounds`를 쓰는 fixture도 없다. `test/cli-help.test.js:201-206`의 정규식은 `--head <sha>` 뒤에 붙는 문자열에는 영향을 받지 않는다.

#### Target behavior

- 성공
  - `review-dispatch execute ... --mode delta` → `ok: true`, `strategy: 'single'`, `perspectives: ['combined']`. `target`, `changed_files`, `changed_lines`, `risk_flags`는 discovery와 같은 값이고, `reasons`에 delta 한 reviewer임을 밝히는 줄이 하나 더 있다.
  - root `review.md` rounds에 `mode: discovery`가 있거나 최신 supplement가 `verified` → `final_review`의 argv가 기존 8칸 뒤에 `'--mode','delta'`로 끝나고 `payload.mode === 'delta'`.
- 실패
  - `--mode`만 있고 값이 없거나, 값이 `discovery`·`delta` 밖 → stderr에 사용법, exit 2, stdout 빈 문자열.
- 보존
  - `--mode` 생략과 `--mode discovery`의 JSON은 지금 출력과 같다.
  - discovery round도 verified supplement도 없으면 `final_review` argv는 지금 8칸 그대로이고 `payload` 키가 없다.
  - per-task 행동의 argv, `coordinate next`의 무쓰기 계약.

#### Interface

- 제공
  - CLI 플래그 `--mode <discovery|delta>`(execute 하위 명령만). 파싱 결과 필드 이름은 `reviewMode: 'discovery' | 'delta'`다.
  - `classifyExecuteReview` 입력에 선택적 `reviewMode?: 'discovery' | 'delta'`(기본 `'discovery'`).
  - `coordinate next` `final_review` 응답의 argv 끝 `'--mode','delta'`와 `payload: { mode: 'delta' }`.
  - 용어 "discovery round": root `review.md` frontmatter `bouncer.review.rounds[]` 중 `mode`가 문자열 `discovery`인 항목. 예: `rounds: [{ round: 1, mode: discovery, ... }]`.
- 거부(즉시 exit 2)
  - `--mode`에 값 없음(`parseFlags`가 `true`로 돌려주는 경우), `--mode` 값이 `discovery`·`delta` 밖.
- 실패가 아닌 판정
  - root `review.md` 부재, frontmatter 없음, 깨진 YAML, `rounds`가 배열이 아님 → discovery round 없음으로 본다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `parseExecuteArgs`, `cmdReviewDispatch`, `USAGE`, export `usage` | Modify | execute 인자 파싱과 분류기 호출, 사용법 문자열 두 벌 | `--mode` 파싱·거절, `reviewMode` 전달, `USAGE`와 export `usage` 두 곳의 execute 줄 끝에 `[--mode discovery\|delta]` | CLI 진입점. export `usage`(297-300행)는 `USAGE`와 따로 쓴 문자열이다 |
| `scripts/src/lib/review-dispatch.ts` | `classifyExecuteReview` | Modify | execute strategy·perspectives 분류 | `reviewMode: 'delta'`면 `single`/`['combined']`와 reason 한 줄 | 관점 목록 계산 지점 |
| `scripts/src/lib/coordinate-next.ts` | 신규 추출 지점: root review discovery round 판정 함수(이름 미정), blueprint `final_review` 분기 | Modify | final_review argv·payload 생성 | discovery round 또는 verified supplement면 argv 끝 `--mode delta`와 `payload.mode` | `next`가 delta 표시를 붙이는 지점 |
| `test/review-dispatch.test.js` | execute CLI 테스트 | Modify | execute 분류·CLI exit 계약 | delta·discovery·잘못된 값 테스트 추가 | 수용 기준 31 |
| `test/coordinate-next.test.js` | blueprint final_review 테스트 | Modify | next 행동 판정 | discovery round fixture와 argv·payload 단언 추가 | 수용 기준 32 |

#### Constraints

- 사용법 문자열은 기존 execute 형식 뒤에 `[--mode discovery|delta]`를 덧붙인다. 앞쪽 순서를 바꾸면 `test/cli-help.test.js:201-206`이 깨진다.
- `--mode` 검증은 분류기 lazy require 전에 끝낸다(사용법 거절이 `require.cache`에 분류기를 남기지 않는 기존 계약).
- `coordinate next`는 파일을 쓰지 않는다. 새 판정도 읽기만 한다.
- 새 함수에는 기존 파일과 같은 한국어 JSDoc을 단다.

### drive-execution/delta-single-reviewer/002 · `a9aed48a`

#### Goal & intent

execute 리뷰의 delta round가 reviewer 하나라는 규칙을 기록 단계에서 강제한다. 완료 조건은 epic Success criteria 33이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `scripts/src/lib/validate-sections.ts:79-107`의 `RoundContract` 중 `EXECUTE_ROUND_CONTRACT`(89-97행)는 `counters: true`, `CONTEXT_ROUND_CONTRACT`(99-107행)는 `counters: false`다. 두 계약 모두 `delta` mode를 허용한다. 계약 선택은 `collectFindingFailures`(248행~, 334-337행)에서 namespace로 한다.
- `collectRoundFailures`(351-432행)의 `if (modeContract)` 블록(~378-401행)은 mode 값, target, perspective 이름(`round N perspective invalid X`)과 target 일치(`round N target mismatch X`)만 본다. perspective 개수는 보지 않는다. 비배열 perspectives는 한 항목 배열로 바뀐다.
- `review record`(`scripts/src/lib/review-record.ts:245-271`)는 새 round를 기존 rounds에 합쳐 namespace 없이 `collectFindingFailures`를 부른다(EXECUTE 계약, `--task`와 blueprint root 공통). 메시지가 있으면 `{ ok: false, reason: 'review-ledger-invalid', cause: string[], next }`를 돌려준다. 진행 중 예외(261-264행)는 메시지가 `review rounds sequence invalid` 하나일 때만이라 새 메시지는 그대로 막힌다.
- 게이트: per-task execute 리뷰는 G14(`validate-gates.ts:1026-1036`), blueprint root는 G21(283-331행, 320행 루프)로 같은 메시지를 낸다. context review는 G18(931-944행).
- I/O 결합: `collectRoundFailures`·`collectFindingFailures`는 순수 함수다. `review-record.ts:64,227`(review.md 읽기), 134행(round 파일 읽기), 276-279행(임시 파일 쓰기와 rename)이 파일 I/O다. 게이트 테스트는 파싱된 문서를 `checkGate`에 주입한다.
- 기존 테스트: `test/validate-gates.test.js`의 `convergenceRound(overrides)`(1179-1186행, 기본 perspective `correctness_tests` 1개), `executeReviewFailures`(1147-1156행, G14 필터), round 검증 단언(~1225-1258행). `test/review-record.test.js`의 `EXAMPLE_ROUND`(32-41행, `combined` 1개), `roundPayload`(80-82행), `recordCli`(84-89행). 관점이 2개 이상인 execute delta round fixture는 없다. context delta fixture는 `perspectives: []`다.

#### Target behavior

- 실패
  - execute 계약 round가 `mode: delta`이고 perspectives(정규화한 배열)의 길이가 2 이상 → 메시지 `${findingLabel} round ${round} delta perspectives invalid: ${count}`. `review record`는 `review-ledger-invalid`이고 `cause`에 그 메시지가 있다. G14·G21은 같은 메시지로 실패한다.
- 성공·보존
  - perspectives 키가 없거나 0~1개인 delta round, discovery round, critical_recovery round는 지금처럼 판정한다.
  - context 계약(G18)의 delta round는 개수와 상관없이 지금처럼 판정한다.
  - 기존 메시지 문구와 순서는 바뀌지 않는다.

#### Interface

- 제공: execute 리뷰 round 검증 규칙 하나와 메시지 `${findingLabel} round ${round} delta perspectives invalid: ${count}`. execute 계약을 쓰는 호출자(`review-record.ts:257`, `validate-gates.ts:325,1032`)는 모두 `findingLabel: 'review'`를 넘기므로 실제 문자열은 `review round <N> delta perspectives invalid: <count>`다. 예: 관점 `spec_scope`, `security` 두 개인 round 2 → `review round 2 delta perspectives invalid: 2`.
- 거부: execute 계약의 `mode: delta` round 중 perspectives 길이 ≥ 2.
- 용어 "execute 계약": `collectRoundFailures`에 전달된 contract의 `counters`가 true인 경우(`EXECUTE_ROUND_CONTRACT`).

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `collectRoundFailures` | Modify | round mode·target·perspective 이름 검증 | execute 계약 delta round의 perspective 수 검증 추가 | review record와 G14·G21이 공유하는 검증 지점 |
| `test/review-record.test.js` | round 기록 테스트 | Modify | review record 성공·거절 계약 | 관점 2개 delta round 거절과 1개 성공 테스트 | 수용 기준 33(record) |
| `test/validate-gates.test.js` | G14·G21·G18 round 테스트, `g21ReviewDoc`, `finalizeG21` | Modify | 게이트 round 검증 | G14·G21 실패와 context delta 보존 테스트 | 수용 기준 33(gate). G21 helper는 2694-2725행 |

#### Constraints

- 계약 구분은 `contract.counters`로 한다. mode 값만으로 판정하면 context delta round도 걸린다.
- 개수 검사는 perspective 이름 검사와 독립이다. 이름이 틀린 항목도 개수에 넣는다.
- `references/coordinator-cards/final_review.md`·`review.md`의 delta 예시 JSON(perspectives 키 없음)이 계속 `review record`를 통과해야 한다(`test/review-record.test.js:358-381`).

### drive-execution/delta-single-reviewer/003 · `8c40c3f8`

#### Goal & intent

coordinator와 execute reviewer가 delta 단계에서 읽는 문서만으로 reviewer 수와 남은 finding 표기를 알 수 있게 한다. 완료 조건은 epic Success criteria 6(CHANGELOG)과 34이고, 검증 명령은 frontmatter `bouncer.verify`다.

#### Current behavior

- `references/coordinator-cards/final_review.md`
  - 16-17행: discovery 명령 `bouncer review-dispatch execute --blueprint <dir> --base <sha> --head <sha>`.
  - 24-28행: "Walk the CLI `perspectives` array in order as the only discovery fan-out ..."
  - 45-49행(must_fix repair): "... call `review-dispatch` once for delta — do not reopen discovery. Fail-closed compares against that round's frozen target." reviewer 수와 `--mode delta`는 적혀 있지 않다.
  - 50-57행(supplement): "`final_review` with `payload.mode: delta`; run that one delta round."
  - 58-63행: "Delta certification still runs once without a discovery perspective; ..."
  - 72-74행(print 입력): "... then delta inputs when mode is delta."
  - `json` fence 2개(round 1 discovery, round 2 delta, 159행).
- execute reviewer relation 어휘: `agents/bouncer-reviewer.md:174` "- relation to previous findings: `new | resolved | regressed`", `references/review/assets/reviewer-prompt.md:142` "- stable `id` and relation: `new | resolved | regressed`". 남은 이전 finding을 적을 값이 없다.
- `agents/bouncer-context-reviewer.md:162`도 같은 어휘를 쓰지만 context review(G18)는 finding `status: open`을 거절한다(`validate-sections.ts:288`, epic Success criteria 19). 그래서 이 task는 context reviewer 문서를 바꾸지 않는다.
- `reviewer-prompt.md:149`: "- actionability hint: `must_fix | advisory` (`advisory` only)" — 문장이 잘렸다. `agents/bouncer-reviewer.md:189-190`은 "(`advisory` only for a finding the\n  controller may accept with a note)".
- 생성본 결합: `.codex/agents/bouncer-reviewer.toml:174`는 `mdToCodexToml`(`scripts/src/lib/codex-agents.ts:41`)이 만든 복사본이다. `test/agents.test.js:71-78,129-138`이 md 변환 결과와 TOML의 byte 일치를 요구한다. 재생성은 `ensureCodexAgents`(`codex-agents.ts:161-189`)가 한다.
- print 결합: `print-dispatch.ts:95-110`이 `agents/*.md` 본문을 prompt 앞에 붙인다. `reviewer-prompt.md`는 붙이지 않는다.
- 문서 테스트: `test/review-record.test.js:358-381`은 `final_review.md`·`review.md`에 `json` fence가 정확히 2개이고 둘 다 `review record`를 통과하며 `## Finding status` 절에 status 값이 있기를 요구한다. `test/coordinator.test.js:1339-1360`은 두 카드에 `review-dispatch execute`, `ok: false`, frozen target, `perspectives` 권위 문장이 있기를 요구한다. `test/agents.test.js:60-66`은 역할 문서 제목에 한글을 금지한다. `scripts/check-doc-shape.js:778-789`는 reviewer 역할 문서의 제목 순서만 본다. relation 어휘나 actionability 문장을 단언하는 테스트는 없다.
- `rules/cli.md:148`: `bouncer review-dispatch execute --blueprint <dir> [--task <ddd>] --base <sha> --head <sha>`.
- CHANGELOG: `## [Unreleased]` 아래 `### Removed`(10행), `### Added`(18행). 항목 형식은 `- **<제목> (EPIC 093 BP 001)** — <설명>`이고 약 90열에서 줄을 바꾼다.

#### Target behavior

- `final_review.md`
  - repair 문단: 재검증 뒤 `coordinate next`가 준 `final_review` argv를 그대로 실행한다(끝에 `--mode delta`). 결과 `perspectives`는 `combined` 하나이고, reviewer 하나에게 이전 finding 전부와 revision diff를 준다. round는 `mode: delta`로 기록하고 perspective를 적는다면 `combined` 하나만 적는다(2개 이상이면 `review record`가 거부한다). discovery 관점을 다시 걷지 않는다.
  - supplement 문단의 delta도 같은 규칙을 가리킨다.
  - 24-28행 문단은 discovery 단계에 한정됨을 밝힌다.
  - 58-63행 "Delta certification still runs once without a discovery perspective" 문장은 "discovery 관점 목록 대신 `combined` reviewer 하나로 한 번 돈다"는 뜻으로 고쳐, 위 repair 문단의 `combined` 기록 규칙과 어긋나지 않게 한다.
  - `json` fence는 2개 그대로이고, delta 예시는 계속 `review record`를 통과한다.
- relation 어휘: `agents/bouncer-reviewer.md`와 `reviewer-prompt.md`의 relation 줄 값 목록이 `new | resolved | regressed | unresolved`이고, 그 줄 바로 아래 들여쓴 줄에 다음 영문 문장을 글자 그대로 둔다.
  ```text
  `unresolved` is a previous finding still present under the same id and not a regression; the controller keeps it `status: open`.
  ```
- `reviewer-prompt.md` actionability 줄은 `agents/bouncer-reviewer.md:189-190`과 글자가 같다(두 줄: `(`advisory` only for a finding the` / `controller may accept with a note)`).
- `.codex/agents/bouncer-reviewer.toml`은 고친 md를 `mdToCodexToml`로 다시 만든 결과와 byte가 같다.
- `rules/cli.md` execute 줄 끝에 `[--mode discovery|delta]`가 있다.
- CHANGELOG `[Unreleased]`에 `### Changed` 절을 새로 두고 EPIC 088 BP 008 항목 하나를 둔다.
- 보존: 카드의 Finding status 표, print 입력 순서, `test/coordinator.test.js` 패턴 문장, 역할 문서 제목, `agents/bouncer-context-reviewer.md`와 그 TOML.

#### Interface

- 제공: 문서 계약 두 가지 — final review delta 절차(argv `--mode delta` 실행, reviewer 하나, perspective는 없거나 `combined` 하나로 기록)와 execute reviewer relation 값 `unresolved`. `rules/cli.md`의 execute 줄은 TASKS-001 사용법과 같다.
- 거부: 이 task는 런타임 입력을 받지 않는다. 판정 근거는 Checklist의 문서 내용 확인 명령, `test/review-record.test.js`(카드 예시), `test/agents.test.js`(TOML 일치), `test/coordinator.test.js`(카드 문장)와 리뷰다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `references/coordinator-cards/final_review.md` | repair·supplement·discovery fan-out 문단 | Modify | blueprint final review drive 계약 | delta는 `next` argv(`--mode delta`) 실행, reviewer 하나, perspective는 없거나 `combined` 하나로 기록 | 수용 기준 34(카드) |
| `agents/bouncer-reviewer.md` | Output contract relation 줄 | Modify | execute reviewer 출력 계약 | `unresolved` 추가와 정의 문장 | 수용 기준 34(어휘) |
| `references/review/assets/reviewer-prompt.md` | relation 줄, actionability 줄 | Modify | inline·fallback reviewer prompt | 같은 어휘와 정의 문장, 잘린 문장 복원 | 수용 기준 34 |
| `.codex/agents/bouncer-reviewer.toml` | 생성본 | Modify | Codex named agent 정의 | md 재생성 | `test/agents.test.js` byte 일치 |
| `rules/cli.md` | `review-dispatch execute` 줄(148행) | Modify | 플러그인 CLI 명령 목록 | 줄 끝에 `[--mode discovery\|delta]`와 delta 주석 한 줄 | TASKS-001 사용법과 맞춤 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 변경 기록 | `### Changed` 절과 BP 008 항목 | epic Success criteria 6 |

#### Constraints

- `final_review.md`에 `json` fence를 더하지 않는다(정확히 2개).
- 역할 문서의 `##`·`###` 제목은 영문 그대로 두고 제목을 더하지 않는다.
- TOML은 손으로 고치지 않고 생성 함수로 만든다.
- 문서 본문 언어는 각 파일의 기존 언어(영문)를 따른다. CHANGELOG는 한국어다.