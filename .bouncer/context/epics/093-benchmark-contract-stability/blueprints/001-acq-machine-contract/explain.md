---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/093-benchmark-contract-stability/blueprints/001-acq-machine-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-11T17:58:51.562+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '093'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: f5b749df12f71a34d2167595ae4856bf98500d32
      range_to: 722e41ba590c60dfe58f2915b580aa5ff5e5b92f
      diff_sha: bcb03788992cf67f68cbc4bbb6c44ec9d24db660c7bfa3c0fecdaf952d253956
      recorded_at: '2026-10-11T17:59:17+09:00'
  task_commits:
    - task: EPIC-093/BP-001/TASK-001
      sha: b6632088
      intent_anchor: task-001
    - task: EPIC-093/BP-001/TASK-002
      sha: 722e41ba
      intent_anchor: task-002
---
# Explain

## Background

벤치마크 응답기는 ACQ 질문에 답하려고 채팅에 찍힌 문장을 추측해 읽었다. 게이트 ID 목록은 테스트 상수에만 있었고, drive 상태를 보려면 coordinator 원장 파일을 직접 열어야 했다. 문구가 조금만 바뀌어도 응답기가 깨지는 구조였다. 이번 변경은 외부 소비자가 읽을 수 있는 계약 세 가지를 만든다: 데이터 파일 게이트 카탈로그, 채팅 표시의 판독 블록, `finalize prepare`의 drive 요약.

## Intuition

식당 메뉴판에 가격표를 붙이는 일과 같다. 손님(응답기)이 종업원 말투를 해석하지 않고 가격표(JSON 한 줄)만 읽으면 된다.

## Code

- `rules/acq-gates.json` — workflow별 게이트 ID 카탈로그 (신규)
- `rules/acq.md` — 채팅 표시 바로 아래 `<!-- acq {...} -->` 판독 블록 규칙
- `skills/*/SKILL.md`, `references/discovery/index.md` — 판독 블록 예시 반영
- `test/acq-gate-ids.test.js` — 카탈로그 JSON과 블록 JSON 형식 단언
- `scripts/src/lib/finalize-digest.ts` — `summarizeDrive`, `prepareFinalizeDigest` 결과의 `drive` 필드

## Quiz

1. 자유 입력 게이트(`plan.request`)의 판독 블록에서 `options`와 `recommended`는 어떤 값인가?
   - A) `[]`와 `null`
   - B) `["A"]`와 `"A"`
   - C) 블록 자체를 생략한다
2. `summarizeDrive`에서 모든 task가 `integrated`지만 id가 문자열이 아닌 항목이 하나 섞여 있다. `ready`는?
   - A) `true` — 식별 가능한 task만 본다
   - B) `false` — 건너뛴 항목이 있으면 준비 완료로 보지 않는다
   - C) 예외를 던진다
3. coordinator 원장이 없는 blueprint에서 `finalize prepare` 결과의 `drive`는?
   - A) `{ ready: false, tasks: [] }`
   - B) 필드가 없다
   - C) `null`

## Tasks

### EPIC-093/BP-001/TASK-001 · `b6632088`

#### Goal & intent

게이트 ID 정본을 `rules/acq-gates.json` 하나로 옮기고, 채팅으로 렌더링하는 모든 ACQ display와 discovery open decisions 메시지에 한 줄 판독 블록을 요구한다.
수용 기준은 에픽 Success criteria 1·2이고, 완료 명령은 `npm run ci`다.

#### Current behavior

- 게이트 ID 목록은 `test/acq-gate-ids.test.js:13-21`의 `CATALOG` 상수(workflow 이름 → ID 배열)에만 있다. `:31-47`이 각 `skills/<skill>/SKILL.md`의 `## ACQ (AskUserQuestion) gates` 색인과 이 상수를 비교하고(정규식 `` /`([a-z]+\.[a-z_]+)`/ ``), `:51-60`이 다섯 평가자 정책의 gate가 이 상수나 legacy 집합(`plan.activate_pointer`, `finalize.quiz`)에 있는지 본다.
- `rules/acq.md:15-17`은 제목 `**AskUserQuestion — <gate-id>**`와 display당 게이트 하나를 요구하고, `:25-35`의 markdown 골격은 제목 → Re-ground → Recommend-why → `- X) label` 선택지 순서다. 기계 판독 블록은 없다.
- 채팅 표시 예시가 skill 본문에 직접 있다: `skills/bouncer-finalize/SKILL.md:65-72`(`finalize.remainder`, 선택지 A·C·D), `skills/bouncer-run/SKILL.md:92-100`(`run.start_drive`), `skills/bouncer-commit/SKILL.md:90-96`(`commit.next_task`, A·B·C).
- open decisions 질문은 `references/discovery/index.md:39-47`(step 9, "all open decisions in one message")가 정한다. 형식 표식은 없다.
- `rules/`의 비 `.md` 파일을 막는 검사는 없다: `package.json` `files`가 `rules/` 전체를 싣고 `scripts/build-release.js:82-98`은 `npm pack --dry-run` 목록을 따른다. `test/plugin-doc-cites.test.js:47-51`은 `rules/*.md`만, `scripts/check-doc-shape.js`는 `.md`와 `PATH_CONTRACTS` 키만 읽는다. `benchmarks/docker/Dockerfile.cursor:40`이 `rules/`를 통째로 복사한다.
- I/O: `test/acq-gate-ids.test.js:8-9`의 `read()`가 저장소 루트 기준 `fs.readFileSync`이고 `CATALOG`는 모듈 상태(`:13`)다.
- 재현: `node --test test/acq-gate-ids.test.js` 통과, `node scripts/check-doc-shape.js` 통과.

#### Target behavior

- 성공: `rules/acq-gates.json`이 `{ "version": 1, "workflows": { "<skill>": ["<gate-id>", ...] } }`로 지금 `CATALOG`와 같은 내용을 담는다. `test/acq-gate-ids.test.js`는 이 파일을 읽어 기존 세 검사를 그대로 수행한다.
- 성공: `rules/acq.md`가 채팅 표시 규칙에 "제목 바로 다음 줄에 `` 한 줄"을 추가하고, 골격 예시에도 그 줄을 넣는다. 블록 JSON은 `gate`(카탈로그 ID), `options`(본문 `- X)` 문자 배열, 표시 순서), `recommended`(`(Recommended)` 선택지 문자) 세 키를 가진다. host UI에는 블록을 두지 않는다고 적는다.
- 성공: 선택지가 없는 자유 입력 게이트(현재 `plan.request` 하나)는 `rules/acq.md`가 블록 `"options":[]`, `"recommended":null`로 표시하라고 적는다.
- 성공: 한 단계가 게이트 둘을 묻는 `(1/2)`·`(2/2)` 번호 표시도 display마다 블록 한 줄을 갖고, 블록 `gate`는 번호를 뺀 ID라고 `rules/acq.md`가 적는다.
- 성공: 세 skill의 채팅 표시 예시가 제목 다음 줄에 각자 블록을 가진다(`finalize.remainder`는 `["A","C","D"]`).
- 성공: `references/discovery/index.md` step 9가 open decisions 메시지 첫 질문 앞에 `` 한 줄을 두라고 요구한다.
- 실패: 카탈로그 JSON의 workflow 키나 ID 배열이 skill 색인과 다르면 `test/acq-gate-ids.test.js`가 실패한다. 카탈로그에 `<workflow>.` 접두가 맞지 않는 ID가 있어도 실패한다.
- 실패: `rules/acq.md` 골격 예시 블록이 JSON으로 파싱되지 않거나 세 키가 없거나 `options`가 같은 예시의 `- X)` 문자와 다르면 테스트가 실패한다.
- 보존: 게이트 ID 집합, display당 게이트 하나 규칙, 선택지 순서 규칙, 정책 gate 검사와 legacy 집합은 그대로다.

#### Interface

- 제공: `rules/acq-gates.json`(위 shape). 키 순서는 지금 `CATALOG`와 같다: `bouncer-init`, `bouncer-plan`, `bouncer-execute`(빈 배열), `bouncer-commit`, `bouncer-run`, `bouncer-finalize`.
- 제공: ACQ 판독 블록 한 줄. shape ``, 예 ``.
- 제공: 자유 입력 블록. 예 ``.
- 제공: open decisions 블록 한 줄. shape ``.
- 거부: 블록을 host UI 질문에 넣는 것, 한 블록에 게이트 둘을 담는 것, 카탈로그에 legacy ID(`plan.activate_pointer`, `finalize.quiz`)를 넣는 것.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/acq-gates.json` | `workflows` | Create | 없음 | 게이트 ID 정본 데이터 | 에픽 기준 1의 단일 정본 |
| `rules/acq.md` | 채팅 표시 규칙·골격 | Modify | ACQ 표시 계약 | 판독 블록 규칙과 골격 줄 추가, 카탈로그 파일 언급 | 에픽 기준 2 |
| `skills/bouncer-finalize/SKILL.md` | `finalize.remainder` 표시 | Modify | 채팅 표시 예시 | 제목 다음 줄에 블록 추가 | 에이전트가 복사하는 예시 |
| `skills/bouncer-run/SKILL.md` | `run.start_drive` 표시 | Modify | 채팅 표시 예시 | 제목 다음 줄에 블록 추가 | 같은 이유 |
| `skills/bouncer-commit/SKILL.md` | `commit.next_task` 표시 | Modify | 채팅 표시 예시 | 제목 다음 줄에 블록 추가 | 같은 이유 |
| `references/discovery/index.md` | step 9 Open decisions | Modify | open decisions 질문 규칙 | `kind` 블록 요구 추가 | 에픽 기준 2 |
| `test/acq-gate-ids.test.js` | `CATALOG` | Modify | 카탈로그 상수와 색인·정책 검사 | 상수 제거 후 JSON 읽기, 골격·skill 표시·discovery 블록 검사 추가 | 기준 1·2의 기계 판독 형식 단언 |

#### Constraints

- 게이트 ID와 각 skill 색인 내용은 바꾸지 않는다.
- 블록 줄은 HTML 주석 한 줄이며 JSON 안에 줄바꿈을 두지 않는다. 골격 예시는 기존 ` ```markdown ` 펜스 안에 둔다(`lint:docs`가 펜스 안을 코드로 본다).
- 테스트는 문서 문구가 아니라 기계가 읽는 형식만 단언한다(카탈로그 JSON, 블록 JSON). `test/acq-gate-ids.test.js`는 `test/tiers.json` unit 계층에 이미 있다.

### EPIC-093/BP-001/TASK-002 · `722e41ba`

#### Goal & intent

`bouncer finalize prepare` 성공 결과에 최상위 `drive` 요약을 싣는다. coordinator 원장이 있으면 `{ ready, tasks: [{ id, status, sha }] }`, 없으면 `null`이다. `pr` draft 입력 본문과 출력은 바뀌지 않는다.
CHANGELOG `[Unreleased]`에 BP 001 전체(카탈로그·판독 블록·drive 요약) 항목을 쓴다. 수용 기준은 에픽 Success criteria 3·10이고, 완료 명령은 `npm run ci`다.

#### Current behavior

- 정본은 `scripts/src/lib/finalize-digest.ts`이고 `scripts/lib/finalize-digest.js`는 `npm run build`(tsc)의 생성물이다. `npm run check:emit`이 둘의 일치를 검사한다.
- `FinalizeDigest` 타입(`finalize-digest.ts:76-100`)에 `drive`가 없다. `prepareFinalizeDigest`(`:517`)는 원장을 `readCoordinatorLedger`로 한 번 읽고(`:533`), `unreadable-ledger`는 `coordinator-ledger`/`UNREADABLE_LEDGER`로 거절한다(`:535-541`). `:556`의 `ledger`는 원장이 없을 때(`no-ledger` 등) `null`이다.
- 성공 본문은 `:834` 이후 `body`로 조립되고 `pr: buildPrDraft(body, …)`가 그 본문을 입력으로 쓴다. doc comment(`:502-504`)는 최상위 `coordinator`를 싣지 않는 이유(PR 입력이 아님)를 적는다.
- 원장 task status는 `pending`·`ready`·`prepared`·`recorded`·`verifying`·`integrated`(`scripts/lib/coordinator.js:245-246`)이고 task는 `{ id, status, sha, ... }`다.
- 테스트: `test/finalize-digest.test.js`(integration 계층, `test/tiers.json:70`)의 drive fixture(`:208-250`)가 task 두 개를 `integrated`로 쓰고 `'coordinator' in d === false`(`:258`)를 단언한다. `test/finalize-pure.test.js`는 unit 계층이다.
- I/O: 원장 읽기는 `scripts/src/lib/scope.ts:451-478` → `fs.readFileSync`이고 seam이 없다. git은 `exec` 인자(`:517`)로 주입된다.
- 재현: `node --test test/finalize-digest.test.js` 통과.

#### Target behavior

- 성공(drive): 원장이 읽히면 `drive.tasks`는 원장 task 순서대로 `{ id, status, sha }`이다. `status`가 문자열이 아니면 `null`, `sha`가 문자열이 아니면 `null`이다. `drive.ready`는 task가 하나 이상이고 모든 `status === 'integrated'`일 때만 `true`다.
- 성공(standalone): 원장이 없으면 `drive: null`.
- 보존: `unreadable-ledger` 거절, `'coordinator' in d === false`, `git.branch`, `range`, `pr` 출력은 같은 입력에 대해 이전과 같다. `buildPrDraft`는 `drive`를 입력으로 받지 않는다.
- 실패 판정: status가 빠진 task, `integrated`가 아닌 task, `id`가 문자열이 아닌 task(결과에서 빠짐), 빈 tasks 배열, 배열이 아닌 tasks가 있으면 `ready: false`다.

#### Interface

- 제공: `FinalizeDigest.drive: { ready: boolean; tasks: Array<{ id: string; status: string | null; sha: string | null }> } | null`.
- 제공: 순수 함수 `summarizeDrive(ledger: unknown) → FinalizeDigest['drive']`를 `finalize-digest` 모듈에서 내보낸다. 입력 예 `{ tasks: [{ id: '001', status: 'integrated', sha: 'aaa…' }] }` → `{ ready: true, tasks: [{ id: '001', status: 'integrated', sha: 'aaa…' }] }`.
- 거부(throw 없음, 값으로 표현): `ledger`가 `null`이면 `null`. `tasks`가 배열이 아니면 `{ ready: false, tasks: [] }`. `id`가 문자열이 아닌 task는 `tasks`에서 빠지고 `ready`를 `false`로 만든다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/finalize-digest.ts` | `FinalizeDigest`, `prepareFinalizeDigest`, 신규 추출 지점: `summarizeDrive` | Modify | finalize digest 조립 | `drive` 타입·순수 요약 함수 추가, `pr`과 나란히 결과에 부착, doc comment 갱신 | 기준 3 |
| `scripts/lib/finalize-digest.js` | 생성물 | Modify | tsc 출력 | `npm run build` 재생성 | `check:emit` |
| `test/finalize-pure.test.js` | `summarizeDrive` 테스트 | Modify | finalize 순수 함수 unit 테스트 | 요약 규칙 unit 테스트 추가 | spawn 없는 판정 |
| `test/finalize-digest.test.js` | drive fixture 테스트 | Modify | digest shape integration 테스트 | drive fixture의 `drive`와 standalone의 `drive: null` 단언 추가 | 결과 shape를 단언하는 기존 파일 |
| `CHANGELOG.md` | `[Unreleased]` | Modify | 릴리스 기록 | BP 001 항목(카탈로그 파일·판독 블록·drive 요약) | 프로젝트 규칙 |

#### Constraints

- `rules/`·`skills/`·`references/`와 `test/acq-gate-ids.test.js`는 TASKS-001 범위이므로 이 task에서 고치지 않는다.
- 결과에 `coordinator`, `integrationHead`, `integrationBranch`, `actualPaths`를 싣지 않는다.
- `drive`는 `buildPrDraft(body, …)` 호출 뒤 반환 객체에 붙인다. `body`에 넣지 않는다.
- `version`은 2로 둔다(필드 추가는 하위 호환).
- 새 테스트는 기존 파일에 넣으므로 `test/tiers.json`은 바뀌지 않는다. unit 테스트는 spawn·git을 쓰지 않는다.
