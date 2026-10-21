---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/plan-workflow/blueprints/review-cli-closure/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-15T14:38:18.841+09:00'
bouncer:
  id: EXPLAIN-review-cli-closure
  epic_id: plan-workflow
  blueprint_id: review-cli-closure
  status: published
  comprehension:
    - range_from: 3180110f915fda96bb5090c815a58d022aadeb16
      range_to: 2cbbd631a52f9de207a01f417d54258f9e191198
      diff_sha: db49e2c2542865437422bfee6caa9328ec279cf3bfc35a42c8b1c91b5d2a2d85
      recorded_at: '2026-10-15T14:45:00+09:00'
  task_commits:
    - task: plan-workflow/review-cli-closure/001
      sha: da4df8f3
      intent_anchor: task-001
    - task: plan-workflow/review-cli-closure/002
      sha: a871373f
      intent_anchor: task-002
    - task: plan-workflow/review-cli-closure/003
      sha: 072cd45a
      intent_anchor: task-003
    - task: plan-workflow/review-cli-closure/004
      sha: a1d881ac
      intent_anchor: task-004
    - task: plan-workflow/review-cli-closure/005
      sha: 2cbbd631
      intent_anchor: task-005
---
# Explain

## Background

plan 단계에서 context review를 돌릴 때 에이전트가 기록 형식을 몰라 도움말과 소스를 뒤지고, 마감 뒤 `context-review.md`와 승인 상태(`approved`/`ready`)를 손으로 고쳤다. 손편집은 호출 수를 늘리고 형식 실수를 부른다. 이 변경은 형식 안내, 문서 기록, 승인 전이를 모두 CLI가 맡게 해서, 에이전트가 도움말과 명령만으로 리뷰와 승인을 끝내게 한다.

## Intuition

예전에는 계약서를 직접 타이핑해 서명란까지 채웠다. 이제는 양식(도움말)이 예시까지 채워 나오고, 마감 버튼(`close`)이 문서를 알아서 쓰고, 승인 버튼(`plan approve`)이 모든 문서를 한 번에 바꾼다.

## Code

- `scripts/src/lib/validate-sections.ts`, `cli-review-dispatch-command.ts`, `cli-context-review-command.ts`: 도움말이 상태·모드 상수를 소스에서 가져와 start → record → record → close 예시를 끝까지 보여 준다. 예시 fingerprint는 `findingFingerprint`로 계산한다.
- `scripts/src/lib/context-review-state.ts`: `close`와 `record --status accepted`가 락 안에서 `context-review.md`를 쓰고 `written`을 돌려준다. 판정·렌더 검증이 끝난 뒤에만 쓰므로 거절 경로는 파일을 건드리지 않는다. 목록 줄 값의 CR/LF는 공백으로 접는다.
- `scripts/src/lib/plan-approve.ts`, `cli-doc-commands.ts`: `bouncer plan approve --blueprint <dir>`가 epic·blueprint를 `approved`, task를 `ready`로 전부 성공하거나 아무것도 안 바꾸는 방식으로 옮긴다. 쓰기는 무작위 접미사 임시 파일을 `wx`로 만들고 원본 mode를 유지한다. 쓰는 도중 I/O가 실패하면 `plan-approve-write` 거절이 이미 쓴 `changed`를 알려 주고, 재실행하면 나머지를 마친다.
- 설계상 한계: `record`는 finding fingerprint를 검증하지 않아서 `close`가 나중에 `context-review-input-invalid`로 거절할 수 있다. 후속 blueprint에서 다룬다. 본문 코드 펜스 안의 `## ` 줄도 `## Findings` 절 경계로 본다.
- 문서: `skills/bouncer-plan/SKILL.md`, `references/context-review/index.md`, `rules/cli.md`가 새 명령과 자동 기록을 설명한다.

## Quiz

1. `bouncer plan approve`가 문서를 바꾸는 도중 한 파일에서 쓰기에 실패하면 무엇이 나오는가?
   - A) 아무 설명 없이 exit 0
   - B) `plan-approve-write` 거절과 이미 쓴 파일 목록 `changed`
   - C) 모든 파일을 원래대로 되돌린 뒤 `changed` 없는 거절
2. context review를 `close`하면 `context-review.md`는 어떻게 되는가?
   - A) 명령이 락 안에서 문서를 쓰고 `written`을 돌려준다
   - B) 에이전트가 직접 써야 하고 CLI는 state만 갱신한다
   - C) 거절 경로에서도 빈 문서를 미리 만든다
3. `plan approve --repo`를 값 없이 주거나 두 번 주면?
   - A) 현재 디렉터리로 조용히 대체한다
   - B) 마지막 값만 쓴다
   - C) exit 2로 거절한다

## Tasks

### plan-workflow/review-cli-closure/001 · `da4df8f3`

#### Goal & intent

`review-dispatch --help`와 `context-review --help`만 보고 `record`·`close` 입력을 처음부터 맞게 쓸 수 있게 한다. 도움말의 열거값은 검증기가 쓰는 상수에서 생성하고, 도움말 예시를 그대로 넣은 입력이 받아들여지는지 테스트로 묶는다.
수용 기준은 epic 성공 기준 1·2·9이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- `scripts/src/lib/cli-review-dispatch-command.ts:68-91` `HELP_CONTEXT_REVIEW_EXAMPLE`는 `context-review.md`에 들어갈 YAML 투영 예시다. finding `status: accepted` 하나뿐이고 `--round` JSON 형식은 없다.
- 같은 파일 `:104-110` Enums 블록: severity·finding status·perspective는 `validate-sections.ts` 상수에서 오지만 finding status는 `CONTEXT_REVIEW_STATUS`(`resolved|accepted`, `validate-sections.ts:41`)라 `open`이 빠진다. actionability(`:107`)·origin(`:108`)·round mode(`:109`)는 문자열 리터럴이다.
- `scripts/src/lib/context-review-state.ts:31-36`에 비공개 상수 `REPORT_STATUS`·`ROUND_MODES`·`FINDING_STATUS`(`open|resolved|accepted`)·`FINDING_ACTIONABILITY`가 있고, `validate-sections.ts:45-46`에도 `FINDING_ACTIONABILITY`·`FINDING_ORIGIN`가 비공개로 따로 있다.
- `readReportInput`(`context-review-state.ts:690-716`)는 `{ round: object, findings: array }`와 finding의 `id`·`severity`·`status`·`actionability`만 검사하고, 어긋나면 `malformed finding`(`:713`)으로 거절한다. `recordReport`(`:805-841`)는 `round.round`가 n+1, `round.mode`가 `ROUND_MODES[n]`인지, `round.target.digest`가 있으면 dispatch digest와 같은지 본다.
- `closeCycle`의 disposition status 검사는 리터럴 `'resolved'`·`'accepted'`다(`:994`).
- `scripts/src/lib/cli-context-review-command.ts:11` `ALLOWED_STATUS`와 `:16-35` `USAGE`·`HELP`는 `--round`·`--dispositions`를 산문으로만 설명하고 예시·열거값이 없다.
- I/O: 도움말은 순수 문자열이다. `readReportInput`은 `fs.readFileSync(roundFile)`(`:695`), close는 `fs.readFileSync(dispositionsFile)`(`:915`)를 쓴다. record 테스트는 임시 repo·blueprint와 `review-dispatch plan` JSON이 필요하다.
- 재현: `scripts/bouncer review-dispatch --help`, `scripts/bouncer context-review --help` (빌드 후). 기존 선례 테스트 `test/review-dispatch.test.js:1436`이 도움말 YAML의 `<target.digest>`를 바꿔 G18 통과를 확인한다. 테스트는 `runCli`(`../scripts/lib/cli`)로 프로세스 안에서 호출한다.

#### Target behavior

- 성공: `context-review --help`가 `--round` JSON 예시 두 개(discovery round 1, delta round 2)와 `--dispositions` 예시 하나를 출력한다. 각 예시 아래에 필드별 허용 값을 적고, finding status는 `open|resolved|accepted`, disposition status는 `resolved|accepted`, report `--status`는 `requested|addressed|accepted`로 나온다.
- 성공: `review-dispatch --help`의 Enums 블록이 두 줄 `finding status (context-review.md): resolved|accepted`와 `finding status (record input): open|resolved|accepted`로 기록용·보고용을 구분해 적고, actionability·origin·round mode도 상수에서 생성한다. 기존 YAML 투영 예시와 G18 통과 테스트는 유지한다.
- 성공: 도움말 예시 JSON을 그대로(`<target.digest>`만 바꿔) 파일로 저장해 `context-review start`→`record`(discovery)→`record`(delta)→`close`에 넣으면 각각 `ok: true`다.
- 실패: 검증기 상수를 바꾸면 도움말 문자열도 바뀌므로, 도움말과 검증기가 어긋나는 경로가 없다. 예시가 검증기와 어긋나면 위 테스트가 실패한다.
- 보존: `record`·`close`의 판정 규칙, 거절 reason, exit code, `review-dispatch --help`의 YAML 투영 예시 형식은 그대로다.

#### Interface

- 제공: `validate-sections.ts` export에 `FINDING_ACTIONABILITY`, `FINDING_ORIGIN`, 보고 입력용 finding status 목록(`open` + `CONTEXT_REVIEW_STATUS`), context round mode 목록(`discovery`, `delta`), report status 목록(`requested`, `addressed`, `accepted`)을 더한다. `context-review-state.ts`와 두 CLI 모듈은 이 export를 쓰고 같은 값을 다시 선언하지 않는다.
- 제공: `context-review --help` 본문의 ```` ```json ```` 예시 블록 세 개(순서: discovery round, delta round, dispositions). 각 블록은 파일 하나로 복사할 수 있는 완결 JSON이고, 바꿀 자리는 `<target.digest>` 하나뿐이다. `review-dispatch --help`에는 JSON 블록을 더하지 않고 기존 YAML 투영 예시와 Enums 블록만 둔다.
- 거부: 이 task는 새 입력을 받아들이거나 거절 규칙을 바꾸지 않는다. 기존 거절(`malformed finding`, `context-review-round-order`, disposition status 오류)은 같은 reason으로 남는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/validate-sections.ts` | `FINDING_ACTIONABILITY`, `FINDING_ORIGIN`, `export =` | Modify | context review 열거값 정본(일부 비공개) | 보고 입력용 status·round mode·report status 상수를 정의하고 export | 단일 정의 출처(열린 결정 4) |
| `scripts/src/lib/context-review-state.ts` | `REPORT_STATUS`, `ROUND_MODES`, `FINDING_STATUS`, `FINDING_ACTIONABILITY`, `closeCycle` | Modify | 비공개 중복 상수와 disposition 리터럴 검사 | 중복 상수를 import로 바꾸고 `:994` 리터럴을 `CONTEXT_REVIEW_STATUS`로 바꿈 | 검증기와 도움말이 같은 값을 보게 함 |
| `scripts/src/lib/cli-review-dispatch-command.ts` | `HELP` | Modify | Enums 블록 일부 리터럴, 보고용 status 누락 | 상수에서 Enums 생성, 보고용·기록용 status 구분 | 관찰 1 (`open` 미표기) |
| `scripts/src/lib/cli-context-review-command.ts` | `ALLOWED_STATUS`, `HELP` | Modify | 산문 설명만 있는 도움말 | round·dispositions 예시와 필드·허용 값 출력, `ALLOWED_STATUS`를 공유 상수로 교체 | REQ-1 |
| `test/context-review-state.test.js` | 신규 추출 지점: 도움말 예시 기록 테스트 | Modify | record·close 동작 테스트 | 도움말 예시를 그대로 기록하는 테스트 추가 | 수용 기준 2 |
| `test/review-dispatch.test.js` | `review-dispatch --help` 테스트 | Modify | 도움말 YAML의 G18 통과 확인 | Enums에 `open`·상수 값이 나오는지 단언 추가 | 수용 기준 1 |
| `test/cli-help.test.js` | `context-review --help` 테스트(`:463`) | Modify | 도움말에 `close`가 있는지 확인 | 예시 블록과 열거값 단언 추가 | 수용 기준 1 |

#### Constraints

- `validate-sections.ts`의 기존 export 이름과 값(`CONTEXT_REVIEW_STATUS = ['resolved','accepted']` 등)은 바꾸지 않는다. 새 상수만 더한다.
- `cli-context-review-command.ts`는 argv 검증 전에 `context-review-state`를 적재하지 않는 현재 순서를 지킨다. 상수는 `validate-sections`에서 가져온다.
- 도움말 예시 fingerprint는 `findingFingerprint`로 계산한다(`cli-review-dispatch-command.ts:54` 방식). 손으로 쓴 fingerprint를 두지 않는다.
- 새 테스트 이름은 `<조건> → <결과>` 형식이다.
- `scripts/lib`는 Git 무시 산출물이다. 소스는 `scripts/src/lib`만 고친다.

### plan-workflow/review-cli-closure/002 · `a871373f`

#### Goal & intent

context review cycle을 닫는 두 명령(`context-review close`, `context-review record --status accepted`)이 성공하면 blueprint 루트 `context-review.md`를 직접 기록하게 한다. 에이전트가 투영을 손으로 복사하거나 상태를 따로 바꾸지 않아도 plan 게이트 G18을 통과한다.
수용 기준은 epic 성공 기준 3·4·5·9이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- `closeCycle`(`scripts/src/lib/context-review-state.ts:903`): dispositions 검증(`:976-1003`)과 `projectClosure`(`:1006`)를 통과하면 dispositions를 immutable로 저장하고 `saveState`(`:1025`)한 뒤 `{ ok, noop:false, cycle, status:'accepted', closed, projection }`을 돌려준다(`:1029-1031`). 같은 입력의 재실행은 `:950-959` noop 경로로 `state.projection`을 그대로 돌려준다.
- `recordReport`(`:769`): `--status accepted`일 때만 `:851-856`에서 `projection = { findings, rounds: [...folded.rounds, report.round] }`를 만들고, 보고 저장(`:865`) → `saveState`(`:881`) → 반환(`:883-886`) 순서다. noop 경로는 `:810-814`다.
- 투영 모양은 `:65` `projection: { findings: Finding[]; rounds: unknown[] } | null`이다. 두 명령 모두 `context-review.md`는 쓰지 않는다.
- `withLock`(`:324-340`)이 전이 전체를 runtime namespace 잠금으로 감싸고, 그 안에서 `readLegacy`(`:511`)·`reconcileMarker`(`:603`)가 `context-review.md`를 읽는다. 파일이 없으면 `readLegacy`는 `present:false`이고, frontmatter가 깨지면 `context-review-legacy-evidence`로 거절한다.
- `context-review.md` frontmatter `bouncer.context_review.restart_count`는 restart 표식이다. `prepareMarker`(`:550-601`)가 이 키만 최소 패치하고, `readLegacy`가 0·1 밖 값을 거절한다.
- 원자 쓰기는 `writeAtomic`(`:142-165`, 같은 디렉터리 임시 파일 + rename)이고 `guardWrites`(`:192-200`)가 경로 오류를 Fail로 바꾼다.
- 선례: `scripts/src/lib/review-record.ts:306-386`이 `parseFrontmatter` → 복제 → `bouncer.review.{rounds,findings}`·`bouncer.status` 변경 → `collectFindingFailures` 검사 → `renderDoc(nextData, body)` → 임시 파일 rename으로 `review.md`를 쓴다. `renderDoc`(`scripts/src/lib/render.ts:8-11`)은 `yaml.dump(data, { lineWidth:-1, sortKeys:false })`라 키 삽입 순서를 따르고 본문 바이트는 그대로 둔다.
- G18(`scripts/src/lib/validate-gates.ts:1003-1056`)은 `status: accepted`, `bouncer.context_review.{rounds,findings}`의 `collectFindingFailures`(namespace `context`, `CONTEXT_REVIEW_STATUS`), 본문 `## Findings` 제목 존재(`validate-sections.ts:34`), 마지막 round `target.digest` 신선도를 본다. 본문 목록 내용은 검사하지 않는다.
- I/O는 모두 실제 파일시스템이다. 테스트는 `test/context-review-state.test.js:50-60` `makeRepo`(scaffoldEpic + scaffoldBlueprint, full이라 `context-review.md` 생성)와 `dispatchFile`·`roundFile`·`close` 도우미(`:69-115`)를 쓴다. close 테스트는 `:242-395`, `record --status accepted`는 `:209-234`, `:403-410`에 있다. G18 실제 파일 판정 선례는 `test/cli-validate.test.js:521-620`이다.

#### Target behavior

- 성공: close와 `record --status accepted`가 cycle을 닫으면 같은 잠금 안에서 `context-review.md`를 다음처럼 쓴다. frontmatter `bouncer.status: accepted`, `bouncer.context_review.rounds`·`findings`를 투영 값으로 바꾸고(`restart_count` 등 다른 키는 유지), 본문 `## Findings` 절 내용을 생성 목록으로 바꾼다. 응답은 기존 필드에 `written: "<bp>/context-review.md"`를 더한다.
- 성공: 생성 목록은 finding 하나당 한 줄 `- <id> (<severity>, <actionability>, <status>): <brief_clause> — <note>`이고 note가 없으면 ` — <note>`를 뺀다. finding이 없으면 `- none`이다. `## Findings` 절의 기존 `- inline context review:`로 시작하는 줄(plan 스킬의 print dispatch 실패 증거)은 생성 목록 앞에 원래 순서로 보존한다. 다른 절과 `## Findings` 앞뒤 본문은 바이트 그대로다.
- 성공: 같은 입력의 재실행(noop)은 `state.projection`으로 같은 문서를 다시 만들어 쓰며, 결과 파일 바이트가 첫 성공과 같다. 첫 성공 뒤 문서가 바뀌었거나 문서 쓰기가 실패했다면 noop 재실행이 문서를 투영 상태로 되돌린다.
- 성공: 기록된 파일은 `bouncer validate --gate plan`에서 G18을 통과한다(다른 plan 문서가 승인 상태일 때).
- 실패: `projectClosure` 거절(열린 finding, note 없는 accepted, `--accept-risk` 없는 must_fix accepted), 닫힌 cycle에 다른 입력, dispositions 형식 오류는 지금과 같은 reason으로 거절하고 `context-review.md`를 바꾸지 않는다.
- 실패: 닫는 경로(close와 `record --status accepted` 모두)에서 `context-review.md`가 없으면 state를 바꾸기 전에 `context-review-target-invalid`로 거절하고 next는 `bouncer scaffold context-review --blueprint <dir>`다. frontmatter가 깨졌으면 기존 `context-review-legacy-evidence` 거절을 유지한다.
- 실패: 렌더링 결과가 `collectFindingFailures`에서 실패하면 state를 바꾸기 전에 `context-review-input-invalid`로 거절하고 실패 메시지를 cause에 싣는다.
- 보존: `record`의 비닫힘 경로(`--status` 생략·`requested`·`addressed`)는 `context-review.md`를 쓰지 않는다. restart·route·start 동작, 전이 키, 기존 거절 reason과 exit code는 그대로다. 투영을 손으로 복사하는 기존 흐름도 G18을 통과한다(INV-3).

#### Interface

- 제공: close·record 성공 응답 필드 `written: string`(저장소 상대 POSIX 경로). cycle을 닫지 않는 응답에는 없다.
- 제공: `context-review.md` 기록 내용(위 Target behavior). frontmatter 키 순서는 기존 키 순서를 유지하고, `context_review` 아래는 기존 키 다음에 `rounds`, `findings` 순서다.
- 거부(즉시 throw 아님, Fail 반환): 문서 부재 → `context-review-target-invalid`, 렌더링 검증 실패 → `context-review-input-invalid`, frontmatter 파싱 실패 → `context-review-legacy-evidence`. 모두 exit 1이고 `context-review.md`와 state.json을 바꾸지 않는다.
- 쓰기 실패: state 저장 뒤 문서 쓰기가 실패하면 `guardWrites`의 Fail을 돌려준다. 같은 입력의 재실행은 noop 경로에서 문서를 다시 써서 복구한다. 이 복구는 쓰기 실패 주입 없이, 첫 close 뒤 문서를 scaffold 상태로 되돌리고 재실행하는 테스트로 확인한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/context-review-state.ts` | `closeCycle`, `recordReport`, 신규 추출 지점: context-review.md 투영 렌더·쓰기 | Modify | cycle 전이와 state 기록, 투영 반환 | 닫는 경로에서 문서 사전 검사·렌더·검증 후 `saveState` 다음에 원자 쓰기, noop 경로 재쓰기 | REQ-2 |
| `scripts/src/lib/cli-context-review-command.ts` | `HELP` | Modify | close·record 도움말 | 닫는 경로가 `context-review.md`를 쓴다는 문장과 `written` 필드 안내 추가 | 도움말과 동작 일치 |
| `test/context-review-state.test.js` | close·record accepted 테스트 | Modify | 전이·거절 테스트 | 기록 내용, 멱등, 거절 시 무변경, 부재 거절, `## Findings` 밖 보존 테스트 추가 | 수용 기준 3–5 |
| `test/cli-validate.test.js` | G18 실제 파일 판정 | Modify | stale·G18 파일 판정 | close가 쓴 문서로 G18 통과를 확인하는 테스트 추가 | 수용 기준 3 |

#### Constraints

- 문서 쓰기는 `withLock` 안에서 하고, state 판정과 렌더링 검증이 모두 통과한 뒤에만 한다. 거절 경로에서 `context-review.md`·state.json 바이트가 바뀌면 안 된다.
- `context_review.restart_count` 표식과 `bouncer` 밖 frontmatter 키를 보존한다. `readLegacy`·`reconcileMarker`가 쓴 뒤의 문서를 다시 읽어도 같은 marker를 본다.
- 기록한 문서는 `prepareMarker`(`context-review-state.ts:550-601`)가 요구하는 두 칸 들여쓰기 block 형식(`  context_review:` 아래 네 칸 키)이어야 한다. close 뒤 계획을 고쳐 `restart`하는 stale 복구 경로가 표식을 쓸 수 있어야 한다.
- 렌더링은 `renderDoc`을 쓴다. `bouncer.status`·`bouncer.context_review.{rounds,findings}` 밖 frontmatter 키는 값(파싱 결과)을 보존해야 하고, 첫 기록 때 YAML 표기 정규화는 blueprint Contract가 허용한다. 그 뒤 재실행은 바이트가 같아야 한다.
- note가 YAML 예약 문자(백틱 등)로 시작해도 `renderDoc`(js-yaml dump)이 인용한다. 직접 문자열을 이어 붙여 frontmatter를 만들지 않는다.
- 사용자 승인은 추론하지 않는다. 이 명령의 호출 시점은 plan 스킬이 정한다(INV-1).
- 새 테스트 이름은 `<조건> → <결과>` 형식이다.

### plan-workflow/review-cli-closure/003 · `072cd45a`

#### Goal & intent

plan 승인 상태 전환을 `bouncer plan approve --blueprint <dir>` 한 명령으로 하게 한다. 에이전트가 epic·blueprint·task 문서를 하나씩 편집하지 않고, 전이할 수 없는 상태는 명령이 거절한다.
수용 기준은 epic 성공 기준 6·7·9이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- `plan` 명령은 `scripts/src/lib/cli-doc-commands.ts:216-241` `cmdPlan`이고 `inspect`만 받는다. 다른 하위 명령은 `plan: command must be inspect`와 exit 2다(`:221-224`). `--blueprint` 값 누락은 exit 2(`:227-230`), 결과는 JSON stdout에 ok면 exit 0, 아니면 1이다(`:236-240`). `repoRoot`는 `f.repo || process.cwd()`(`:233`)다.
- 사용법 문자열은 `:277-281` `  plan       inspect [--epic-dir <dir>] [--blueprint <dir>]`이고, `scripts/src/lib/cli.ts:85-88`이 모든 명령 `usage`를 이어 붙여 전체 도움말을 만든다.
- 상태 enum(`scripts/src/lib/schema.ts:27-40`): epic `draft|approved|closed|imported`, blueprint `draft|approved|superseded|closed|partial_closed|imported`, tasks `draft|ready|in_progress|verified|verifying|integrated`, context_review `pending|requested|addressed|accepted`. scale은 `schema.ts:60-65`(`light|full`, 부재는 full)이고 소비자는 `scale === 'light'`만 본다.
- plan 게이트는 epic `approved`(G1), blueprint `approved`(G2), task `ready|in_progress|verified`(G3)를 요구한다(`scripts/src/lib/validate-gates.ts:967`, `:984-985`, `:1070`).
- task 열거는 `listTasksDocs({ repoRoot, blueprintDir })`(`scripts/src/lib/tasks-docs.ts:146-220`)가 `{ entries, legacy, legacyFiles, invalidDirs }`를 돌려준다. entry는 `tasks.rel`과 `executionKind`(`commit|verification|null`, null은 파싱 실패)를 가진다. `scripts/src/lib/plan-inspect.ts:394`가 같은 함수를 쓰고, `:147` `readStatus`, `:220` `normalizeRelDir`가 있다.
- epic 경로는 `scripts/src/lib/paths.ts:51` `epicDirOf(blueprintDir)`(`/blueprints/` 앞부분)로 구한다.
- frontmatter status를 다시 쓰는 기존 선례: `scripts/src/lib/coordinator.ts` `writeVerificationTaskStatus`(graphify `explain(renderDoc)` 호출자).
- 지금은 상태 전환 명령이 없고, plan `SKILL.md` 6단계는 문서 편집으로 전환하라고만 한다.
- I/O: 읽기는 `frontmatter.ts:33` `readFileSync`, `tasks-docs.ts:155-193`. 단일 파일 원자 쓰기 선례는 `review-record.ts:366-380`(같은 디렉터리 임시 파일 → `renameSync`, 실패 시 임시 파일 삭제)이다. 모듈 수준 가변 상태는 없다.
- 테스트 도우미: `test/plan-inspect.test.js` `writeDoc`(~`:30`), `makeRepo`(`:37-47`, 임시 git repo), `capture(argv)`(`:49-56`, `runCli`). `:227-231` 테스트가 하위 명령 없는 `plan`의 stderr를 `/inspect/`로 단언한다.

#### Target behavior

- 성공: 대상 blueprint의 epic(`epicDirOf(blueprintDir)/index.md`), blueprint `index.md`, `listTasksDocs`가 돌려준 모든 `tasks/<NNN>/tasks.md`의 `bouncer.status`를 epic `draft→approved`, blueprint `draft→approved`, task `draft→ready`로 바꾼다. 출력은 `{ ok: true, changed: [...], unchanged: [...] }`(저장소 상대 POSIX 경로, 정렬)이고 exit 0이다.
- 성공(멱등): 이미 목표 상태(epic·blueprint `approved`, task `ready`)인 문서는 `unchanged`에 들어가고 바이트가 바뀌지 않는다. 모두 목표 상태면 `changed: []`다.
- 성공(light): blueprint `bouncer.scale`이 `light`이면 context-review 검사를 건너뛴다.
- 실패: full blueprint에서 `context-review.md`가 없거나 `bouncer.status`가 `accepted`가 아니면 `{ ok:false, reason:'plan-approve-context-review', cause, next }`이고 exit 1이다. next는 context review 마감(`bouncer context-review close`)을 가리킨다.
- 실패: 대상 문서 하나라도 `draft`도 목표 상태도 아니면(예: task `in_progress`, blueprint `closed`, epic `closed`) `reason:'plan-approve-status'`, cause에 경로와 현재 상태를 싣고 exit 1이다.
- 실패: blueprint 경로가 저장소 밖이거나 blueprint `index.md`·epic `index.md`가 없거나, task 문서가 하나도 없거나, `listTasksDocs`가 `legacy`·`invalidDirs`·`executionKind: null`을 보고하면 `reason:'plan-approve-target'`, exit 1이다.
- 실패 공통: 판정 거절(`plan-approve-target`·`plan-approve-context-review`·`plan-approve-status`)에서는 파일을 쓰지 않는다. 모든 대상을 먼저 읽고 판정한 뒤에 쓴다. 판정 뒤 쓰기 도중 I/O 실패만 일부 파일이 바뀐 채 `plan-approve-write`로 끝나고, 재실행으로 이어서 끝낸다.
- 사용법: `--blueprint` 누락·빈 값, 중복 플래그, 모르는 하위 명령은 exit 2다. 하위 명령 오류 메시지는 `plan: command must be inspect or approve`다.
- 보존: `plan inspect` 동작과 출력은 그대로다. `current` pointer, 문서 본문, `bouncer.status` 밖 frontmatter 값은 바꾸지 않는다.

#### Interface

- 제공: `bouncer plan approve --blueprint <dir> [--repo <dir>]`, 사용법 줄 `  plan       approve --blueprint <dir> [--repo <dir>]`.
- 제공: 라이브러리 함수 `approvePlan({ repoRoot: string, blueprintDir: string, deps?: { writeFile?: (abs: string, text: string) => void } }) → { ok: true, changed: string[], unchanged: string[] } | { ok: false, reason: string, cause: string | string[], next: string, changed?: string[] }`. `changed`는 `plan-approve-write`일 때만 있다.
- 제공(테스트 seam): `deps.writeFile(abs, text)`는 한 파일의 원자 쓰기(같은 디렉터리 임시 파일 → rename)를 대신한다. 생략하면 기본 원자 쓰기를 쓴다. 테스트는 두 번째 호출에서 throw하는 함수를 넣어 `plan-approve-write`를 만든다.
- 제공 용어 — 전이 가능 상태: 문서 종류별 `draft` 하나. 예: task `status: draft` → `ready`. 목표 상태: epic·blueprint `approved`, task `ready`.
- 거부(Fail 반환, exit 1): `plan-approve-target`, `plan-approve-context-review`, `plan-approve-status`. 각 reason의 조건은 Target behavior를 따른다.
- 거부(사용법, exit 2): 하위 명령 오류, `--blueprint` 누락, 같은 플래그 중복.
- 쓰기 실패: 판정 통과 뒤 파일 하나의 쓰기가 실패하면 `reason:'plan-approve-write'`, cause에 실패 경로, 응답에 이미 쓴 `changed`를 싣는다. 같은 명령을 다시 실행하면 이미 쓴 문서는 `unchanged`가 되어 이어서 끝난다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/plan-approve.ts` | `approvePlan` | Create | 없음 | 대상 수집·판정·status 전이·원자 쓰기 | REQ-3, 열린 결정 1·5 |
| `scripts/src/lib/cli-doc-commands.ts` | `cmdPlan`, plan `usage` | Modify | `plan inspect`만 처리 | `approve` 하위 명령 파싱과 사용법 줄 추가 | `:216-241`, `:277-281` |
| `test/plan-approve.test.js` | 신규 추출 지점: plan approve 테스트 | Create | 없음 | 성공·멱등·light·거절·무변경 테스트 | 수용 기준 6·7 |
| `test/plan-inspect.test.js` | 하위 명령 없는 `plan` 테스트(`:227-231`) | Modify | stderr `/inspect/` 단언 | 새 오류 메시지 `inspect or approve`에 맞춘 단언 | 사용법 메시지 변경 |

#### Constraints

- frontmatter는 `readDoc`로 읽고 `renderDoc(data, body)`로 쓴다. `bouncer.status` 값만 바꾸고 키 순서와 본문 바이트를 유지한다.
- 쓰기는 파일마다 같은 디렉터리 임시 파일 → rename으로 한다. 판정을 모두 끝낸 뒤에만 쓰기를 시작한다.
- 사용자 승인을 추론하지 않는다. 이 명령은 plan 스킬의 `plan.approval` ACQ 뒤에만 불린다(INV-1). 명령은 대화형 확인을 하지 않는다.
- `--blueprint`는 `normalizeRelDir` 규칙으로 저장소 안 상대 경로만 받는다.
- 새 테스트 이름은 `<조건> → <결과>` 형식이다.

### plan-workflow/review-cli-closure/004 · `a1d881ac`

#### Goal & intent

plan 스킬과 CLI 규칙 문서가 TASKS-001–003의 새 동작을 쓰도록 바꾼다. 승인 때는 `bouncer plan approve`를 쓰고, `must_fix`는 문서별로 묶어 문서당 편집 1회로 반영하며, close가 `context-review.md`를 직접 기록한다는 사실을 문서에 적는다.
수용 기준은 epic 성공 기준 8·9이고, 완료 명령은 `bouncer.verify`다.

#### Current behavior

- `skills/bouncer-plan/SKILL.md:234-242` 6단계 Approval. `:239`에 `plan.approval` ACQ가 있고 `:240-242`가 "On approval, transition `bouncer.status`: epic `draft → approved`, blueprint `draft → approved`, tasks `draft → ready`. Never approve silently."다.
- `skills/bouncer-plan/references/context-review.md:62-66` 4단계 "Revise once"는 모든 `must_fix`를 한 번의 수정 단계로 반영하라고만 한다. `:174-177`은 "The returned `projection` ... copy it into the existing blueprint-root `context-review.md` (body `## Findings` included) and only then set `context-review → accepted`."다. `:165-173`이 record·close 사용법이다.
- `rules/cli.md:13`·`:44`에 `plan inspect`만 있고 `plan approve`는 없다. `:252-256`이 `context-review start|record|close|restart|route` 문단이다.
- 단어 수 상한: `test/skill-bouncer-surface.test.js:108-129`는 진입 스킬 7개 `skills/<name>/SKILL.md`의 단어 수 합(`trim().split(/\s+/).length`)이 `ENTRY_WORD_BASELINE` 합(8665)보다 작아야 한다(`after < before`). 현재 합은 8662라 순증가 여유는 2단어다. 참조 문서는 세지 않는다.
- 같은 파일 `:151-160`은 plan 스킬 번호 단계를 8개로 고정하고, `scripts/check-doc-shape.js:863-880`은 1–8단계 순서, 단계 1·2·3·4·6의 ACQ 블록, 단계 3·4·5의 참조 링크를 요구한다.
- `references/context-review/index.md:99-101`(리뷰 행동 지침 4단계 Return)도 "controller가 accepted record의 `projection`을 `context-review.md`로 복사한다"고 적는다.
- `test/*.js`에 'copy it into', 'Revise once', 'draft → approved', 'plan approve' 문구를 단언하는 테스트는 없다. `test/skill-context-review.test.js:14-23`은 plan 참조 문서의 fingerprint 예시 줄을 단언한다.

#### Target behavior

- 성공: `SKILL.md` 6단계의 전이 문장이 "On approval, run `bouncer plan approve --blueprint <dir>`."로 바뀐다. `plan.approval` ACQ, "Never approve silently", DAG 표시 문단은 유지한다. 진입 스킬 단어 수 합은 8665 미만이다.
- 성공: `references/context-review.md` 4단계가 `must_fix`를 대상 문서별로 모아 문서당 편집 1회(다중 편집 포함)로 반영하라고 적는다.
- 성공: `references/context-review.md` close 문단이 "cycle을 닫는 `close`·`record --status accepted`가 `context-review.md`의 `bouncer.context_review`·`## Findings`·`status: accepted`를 기록한다"고 적는다. `## Findings`의 기존 `- inline context review: dispatch print failed (<reason>)` 줄은 close 뒤에도 생성 목록 앞에 남는다고 적는다(그 줄을 쓰라는 print fallback 지시는 유지). 손으로 투영을 복사하는 지시는 지운다. close는 사용자 명시 승인 뒤에만 실행한다는 문장은 유지한다.
- 성공: `references/context-review/index.md` 4단계 Return의 투영 복사 문장이 "cycle을 닫는 record·close가 `context-review.md`를 기록한다"로 바뀐다. 리뷰어가 Findings만 돌려준다는 계약은 그대로다.
- 성공: `rules/cli.md`에 `bouncer plan approve --blueprint <dir> [--repo <dir>]` 줄과 성공·거절 형식 한 문단, context-review 문단에 "닫는 경로가 `context-review.md`를 쓰고 `written`을 돌려준다"는 문장이 들어간다.
- 실패 판정: `npm run lint:docs`, `node --test test/skill-bouncer-surface.test.js test/skill-bouncer-plan.test.js test/skill-context-review.test.js` 중 하나라도 실패하거나, Checklist의 남은 문구 검색이 기대와 다르면 미완료다.
- 보존: 단계 번호·ACQ 위치·참조 링크, `references/context-review.md`의 fingerprint 예시 줄, 다른 단계 문구는 그대로다.

#### Interface

- 제공: 문서 문구 변경만. 런타임 동작 변경은 없다.
- 거부: 6단계에 `current --set`을 합치는 문구, ACQ를 생략·추론하게 하는 문구, 단어 수 상한을 올리는 변경은 넣지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-plan/SKILL.md` | 6단계 Approval | Modify | 승인 뒤 문서 편집으로 상태 전환 지시 | `bouncer plan approve` 사용 지시로 교체 | REQ-3 수용 기준 |
| `skills/bouncer-plan/references/context-review.md` | 4단계 Revise once, close 문단 | Modify | 수정 1회 지시, 투영 수동 복사 지시 | 문서당 편집 1회 지침, close 자동 기록 서술 | REQ-2·REQ-4 |
| `references/context-review/index.md` | 4단계 Return | Modify | controller가 투영을 수동 복사한다고 서술 | close·record 자동 기록 서술로 교체(리뷰어 계약 문장은 유지) | `grep -l projection` 결과, 지시 충돌 방지 |
| `rules/cli.md` | `plan`·`context-review` 항목 | Modify | `plan inspect`와 context-review 사용법 | `plan approve` 항목과 close 기록 문장 추가 | 프로젝트 규칙(명령·도움말 함께 갱신) |

#### Constraints

- `SKILL.md` 변경은 순증가 2단어 이하다. 늘어야 하면 문장을 `references/` 문서로 옮긴다.
- 영어 문서인 `SKILL.md`·두 `context-review` 참조 문서·`rules/cli.md`는 기존 언어(영어)로 쓴다.
- `plan approve`와 close는 사용자 명시 승인 뒤에만 실행한다는 경계를 문장에서 약하게 만들지 않는다(INV-1).
- 명령 이름·플래그는 TASKS-002·003이 구현한 도움말과 같은 철자를 쓴다.

### plan-workflow/review-cli-closure/005 · `2cbbd631`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `scripts/src/lib/cli-doc-commands.ts` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/plan-approve.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/plan-approve.test.js` — 기록된 CI 실패를 복구한다.
- Modify `rules/cli.md` — 기록된 CI 실패를 복구한다.
- Modify `scripts/src/lib/context-review-state.ts` — 기록된 CI 실패를 복구한다.
- Modify `test/context-review-state.test.js` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.
