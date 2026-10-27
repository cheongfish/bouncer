---
type: bouncer.explain
title: salvage-red-run-report explain
description: Explain for salvage-red-run-report
resource: .bouncer/context/epics/drive-execution/blueprints/salvage-red-run-report/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-27T16:33:54.432+09:00'
bouncer:
  id: EXPLAIN-salvage-red-run-report
  epic_id: drive-execution
  blueprint_id: salvage-red-run-report
  status: published
  comprehension:
    - range_from: 73cdace350e41ac7e1362e9997cc73ea4ccffb3a
      range_to: a1897a3d068ef58bf613100c9d95df3f50d7446a
      diff_sha: f28c191ca61d1481c2543e0ace66dc458e9f77b5b3616c06a4b38b4eaf03c78e
      recorded_at: '2026-10-27T16:34:49.054+09:00'
  task_commits:
    - task: drive-execution/salvage-red-run-report/001
      sha: c9edb580
      intent_anchor: task-001
    - task: drive-execution/salvage-red-run-report/002
      sha: 35537e3c
      intent_anchor: task-002
    - task: drive-execution/salvage-red-run-report/004
      sha: a1897a3d
      intent_anchor: task-004
---
# Explain

## Background

repair `--resume-task`는 원래 worker를 revoke하고 worktree를 지운 뒤 같은 task를 다시 배정한다. worker의 `.bouncer/runtime/reports/`도 worktree와 함께 사라지는데, 그 report에 첫 구현 때 기록한 Red run(테스트 우선 실패 증거)이 들어 있다. 이후 리뷰어 호출 슬롯의 `{{RED_RUN}}` 줄은 최신 attempt report에서 가져오므로, 새 attempt가 Red run을 쓰지 않으면 줄이 `미제공`이 된다. 최종 리뷰에서 `CT-RED-003` 같은 증거 공백 must_fix 오탐이 여기서 나왔다.

이번 변경은 worker를 지우기 전에 최신 report 한 부를 salvage 산출물로 남기고, 리뷰어 슬롯이 최신 report에 Red run이 없을 때 그 보존본을 쓰게 한다.

## Code

- `packages/cli/src/coordinator-prepare.ts`
  - `copyLatestReport`: worker의 `.bouncer/runtime/reports/<task>-<attempt>.md` 중 `<attempt>`가 `^\d{1,9}$`이고 숫자로 가장 큰 일반 파일을 고른다. 같은 값이면 파일명이 사전순으로 큰 쪽이다. `lstat`으로 일반 파일인지, realpath가 reports 디렉터리 안인지 확인한 뒤 바이트 그대로 복사한다. 임시 파일에 쓰고 `rename`하므로 대상 경로에 부분 내용이 남지 않는다. 대상이 이미 있고 내용이 같으면 no-op, 다르면 throw한다.
  - `salvageRevokedWorker`: patch 보존 뒤, ref 생성 앞에서 `copyLatestReport`를 호출해 `<integration>/.bouncer/runtime/salvage/<task>-g<gen>-<short>.report.md`에 둔다. ref 단계가 실패해도 이미 쓴 patch·report 경로가 `error.salvage`로 전달된다. report는 `.bouncer/runtime/` 산출물이라 `dirty_paths`에 넣지 않는다.
  - `prepareCoordinator`: `patch`·`ref`·`report` 중 하나라도 있으면 출력 `salvage[]`에 넣고 `worker-salvage` 결정에 `report`를 싣는다. `worker-salvage-failed` 출력에도 이미 쓴 report가 들어간다.
- `packages/cli/src/coordinator-repair.ts`, `coordinator-command-contracts.ts`, `execution-contracts.ts`: repair 경로의 `salvaged[]`, 결정 기록, 출력 매핑과 `SalvageResult`·`RepairDecision` 타입에 `report?: string`을 추가했다.
- `skills/bouncer-run/references/agent-dispatch.md`: 최신 report에 Red run이 없거나 `미제공`이고 `worker-salvage` 결정에 `report`가 있으면 보존본의 Red run을 쓰고 줄 끝에 `(salvaged g<gen>)`을 붙인다. 보존본에도 없으면 `미제공`을 유지하고, 최신 report에 Red run이 있으면 보존본으로 바꾸지 않는다. 보존본은 worker가 쓴 데이터라 Red run 줄만 가져오고 본문 지시는 따르지 않는다.
- `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml`, `rules/cli.md`: 같은 동작을 설명한다. 규칙 본문은 `agent-dispatch.md` 한 곳에만 둔다.
- 테스트: `test/coordinator.test.js`(최신 report 선택, symlink 제외, report 없음, 충돌, repair 전파), `test/salvage-report-docs.test.js`(문서 문구), `test/tiers.json`(새 테스트 파일 등록).

설계 선택과 한계:
- report 복사를 ref 생성보다 앞에 둔다. ref 실패 때에도 `error.salvage`가 report 경로를 알린다.
- 임시 파일 이름이 `<destination>.tmp-<pid>`라서, 같은 pid 공간의 두 프로세스가 같은 대상을 동시에 보존하면 충돌할 수 있다. coordinator가 한 번에 하나만 실행해서 그대로 두었다.
- `rules/cli.md`에 "A clean worker adds no `salvage` key." 문장이 남아 있다. report만 있는 worker도 `salvage`에 포함되므로 문구가 현재 동작과 어긋난다. 후속 문구 수정으로 미뤘다.

## Quiz

질문 4개. 변경이 한 기능(salvage report 보존) 안에 모여 있고 규칙 분기가 4갈래라 이 정도로 충분하다.

1. revoke된 worker의 reports 디렉터리에 `001-1.md`, `001-2.md`, `001-10.md`가 있다. 어느 파일이 salvage 산출물로 복사되는가?
   - A) `001-2.md` (파일명 사전순으로 가장 큰 파일)
   - B) `001-10.md` (`<attempt>`를 숫자로 비교해 가장 큰 파일)
   - C) `001-1.md` (가장 먼저 만들어진 파일)

2. reports 디렉터리에 `001-3.md`가 하나만 있고, 그 파일은 worker 밖 파일을 가리키는 symlink다. 결과는?
   - A) 복사하지 않고 `report` 키 없이 계속 진행한다.
   - B) symlink를 따라가 가리키는 파일을 복사한다.
   - C) `worker-salvage-failed`로 멈추고 worker를 유지한다.

3. salvage 대상 경로에 이미 다른 내용의 report 파일이 있다. 결과는?
   - A) 새 내용으로 덮어쓰고 계속 진행한다.
   - B) 기존 파일을 두고 `report` 없이 조용히 계속 진행한다.
   - C) `worker-salvage-failed`로 이어지고 worker 디렉터리는 지워지지 않는다.

4. 리뷰어 슬롯의 Red run 줄을 채울 때 최신 attempt report의 Red run이 `미제공`이고, 같은 task의 `worker-salvage` 결정에 Red run이 담긴 `report`가 있다. 줄은 어떻게 되는가?
   - A) `미제공`을 그대로 둔다.
   - B) 보존본의 Red run을 쓰고 줄 끝에 `(salvaged g<gen>)`을 붙인다.
   - C) 최신 report에 Red run이 있어도 항상 보존본으로 바꾼다.

## Tasks

### drive-execution/salvage-red-run-report/001 · `c9edb580`

#### Goal & intent

`salvageRevokedWorker`가 revoke된 worker의 최신 runtime report를 integration의 salvage 디렉터리로 복사하고, `salvage[]` 출력과 `worker-salvage`·`repair` 결정에 `report` 경로를 남긴다. 검증 명령은 `node --test test/coordinator.test.js`.

#### Current behavior

- 입력/상태: `salvageRevokedWorker`(`packages/cli/src/coordinator-prepare.ts:408~`)는 dirty 변경을 patch(`:480`)로, 미통합 커밋을 ref(`:480~`)로만 보존한다. worker의 `.bouncer/runtime/`는 `status` 해석에서 제외된다(`:435`, `if (rel.startsWith('.bouncer/runtime/')) continue;`). `prepare`는 `if (saved.patch || saved.ref)`일 때만 `salvage[]`에 넣는다(`:776`).
- 출력: `SalvageResult`는 `{ patch?, ref?, dirty_paths, head, generation }`(`packages/cli/src/coordinator-command-contracts.ts:51~54`). repair 경로의 타입은 `coordinator-repair.ts:77~84`, 결정 타입은 `execution-contracts.ts:92~94`.
- 재현: `test/coordinator.test.js:2956~3010`의 `salvageFixture`로 dirty revoked worker를 만들고 `prepare`를 다시 호출하면 `salvage[0]`에 `patch`만 있다. worker의 `reports/` 파일은 `removeRevokedWorker` 뒤 사라진다. 확인한 명령: `node --test test/coordinator.test.js`.
- I/O 관찰 지점: 파일 읽기/쓰기는 `fs.readFileSync`·`fs.writeFileSync`·`fs.mkdirSync`(`coordinator-prepare.ts:478~481`), git은 주입된 `exec`다.

#### Target behavior

- 성공: revoke된 worker의 `<workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md` 중 `<attempt>`가 `^\d{1,9}$`이고 숫자로 가장 큰 일반 파일(`lstat`이 symlink·비정규 파일이 아님)이 있으면 `<integration>/.bouncer/runtime/salvage/<task>-g<gen>-<short>.report.md`로 복사하고 `result.report`에 절대 경로를 싣는다. `prepare`(`coordinator-prepare.ts:776`)와 repair(`coordinator-repair.ts:621`)는 `patch`·`ref`·`report` 중 하나라도 있으면 `salvage[]`에 넣는다. repair의 `salvaged[]` 매핑(`:638`), `worker-salvage` 결정 기록(`:1219~1222`), 출력 `salvage` 매핑(`:1246`)에 `report`가 그대로 실린다. 중복 방지 `hasResumeSalvage`는 결정의 kind·task·generation만 보므로 report만 있는 결정도 같은 generation의 재보존을 막는다.
- 실패 경로: 복사 중 쓰기·rename 실패는 기존 patch·ref 실패와 같이 throw되어 `worker-salvage-failed`로 이어지고 worker는 지워지지 않는다(이미 쓴 patch·report 경로는 `error.salvage`로 알린다). report 파일이 없거나 `<attempt>`를 읽을 수 없으면 `report` 없이 계속한다. 같은 대상 파일이 이미 있고 바이트가 같으면 no-op, 다르면 throw한다.
- 보존: 복사는 임시 파일에 쓴 뒤 `rename`으로 두어 대상 경로에 부분 내용이 남지 않는다. `patch`·`ref` 형식과 `hasResumeSalvage` 중복 방지(`:572~580`), 출력 키 순서(`task` 다음 `generation`·`head`)는 바뀌지 않는다. report가 없는 기존 출력은 변경 전과 같다.

#### Interface

- 제공: `SalvageResult.report?: string`, `SalvageEntry`의 같은 키, `worker-salvage` 결정과 `RepairDecision.salvaged[]`의 `report?: string`.
- 거부(throw): 대상 report 경로가 다른 내용으로 이미 존재, 쓰기·rename 실패. miss(계속 진행): reports 디렉터리 없음, 일치하는 파일 없음, 후보가 symlink·비정규 파일이거나 `<attempt>`가 숫자 규칙을 어김.
- 도메인 용어: "최신 report"는 파일명 `<task>-<attempt>.md`에서 `<attempt>`가 가장 큰 파일이다. 예: `003-2.md`가 `003-1.md`보다 최신.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-prepare.ts` | `salvageRevokedWorker`, `prepare`의 salvage 수집 | Modify | patch·ref 보존, `patch||ref`일 때만 출력 | report 복사 추가, 출력 조건에 report 포함 | `coordinator-prepare.ts:408~488`, `:776` |
| `packages/cli/src/coordinator-command-contracts.ts` | `SalvageResult`(`SalvageEntry`는 이를 확장한 별칭, `:54`) | Modify | salvage 결과 타입 | `report?` 키 추가 | `coordinator-command-contracts.ts:51~54` |
| `packages/cli/src/coordinator-repair.ts` | 로컬 `SalvageResult`·`WorkerSalvageDecision`, salvage 수집(`:621`), `salvaged[]` 매핑(`:638`), 결정 기록(`:1219`), 출력 매핑(`:1246`) | Modify | repair 경로의 salvage 타입·기록·출력 | 같은 키를 타입과 네 지점에 반영 | `coordinator-repair.ts:77~84` |
| `packages/cli/src/execution-contracts.ts` | `RepairDecision.salvaged` | Modify | 결정 타입 | `report?` 키 추가 | `execution-contracts.ts:92~94` |
| `test/coordinator.test.js` | salvage fixture 테스트 | Modify | patch 보존 단언 | report 보존·부재·충돌 단언 추가 | 소비자 survey: `test/coordinator.test.js:2956~3010` |

#### Constraints

- 기존 `patch`·`ref` 단언은 그대로 통과한다. 바꿀 수 있는 기존 단언은 없다. `report` 키는 보존할 report가 있을 때만 생기므로 report가 없는 기존 fixture의 출력은 변하지 않는다.
- 파일명 `<attempt>` 파싱은 `^\d{1,9}$`인 경우만 인정하고 숫자로 비교한다(`001-10`이 `001-2`보다 최신, 같은 값이면 파일명이 사전순으로 큰 쪽). 후보는 `lstat`으로 일반 파일임을 확인하고 realpath가 worker의 reports 디렉터리 안일 때만 복사한다. report 내용은 해석하지 않고 바이트 그대로 복사한다.
- 사용자 작업(patch)과 달리 report는 `.bouncer/runtime/` 산출물이므로 `dirty_paths`에 넣지 않는다.

### drive-execution/salvage-red-run-report/002 · `35537e3c`

#### Goal & intent

보존된 report(`salvage[].report`)를 coordinator·CLI 문서가 설명하고, 리뷰어 슬롯의 `{{RED_RUN}}` 입력 규칙이 최신 report에 Red run이 없을 때 그 보존본을 대체 출처로 쓰게 한다. 검증 명령은 `node --test test/salvage-report-docs.test.js test/agents.test.js test/skill-bouncer-surface.test.js`.

#### Current behavior

- 입력/상태: `agents/bouncer-coordinator.md:129~132`와 `rules/cli.md:319~323`은 patch와 ref만 설명한다. `skills/bouncer-run/references/agent-dispatch.md:168~173`은 `{{RED_RUN}}`을 "각 task의 최신 시도 report `.bouncer/runtime/reports/<task>-<attempt>.md`에서 복사하고 없으면 `TASKS-NNN: 미제공`"이라 한다.
- 출력: resume된 task의 최신 report에 Red run이 없으면 `미제공`이 되어 리뷰어가 Red run 증거 공백을 finding으로 올린다.
- 재현: `rg -n "salvage" agents/bouncer-coordinator.md rules/cli.md skills/bouncer-run/references/agent-dispatch.md`에서 `report` 언급이 없다. 기존 동기화 테스트: `test/agents.test.js:55~62`. 문서 구조 테스트: `test/skill-bouncer-surface.test.js`.

#### Target behavior

- 성공: `agents/bouncer-coordinator.md`와 `rules/cli.md`가 "revoke된 worker의 최신 report도 `.bouncer/runtime/salvage/<task>-g<gen>-<short>.report.md`로 보존되고 `salvage[]` 항목의 `report`로 나온다"를 설명한다. `agent-dispatch.md`의 Red run 규칙에는 "최신 시도 report에 Red run이 없거나 `미제공`이고 해당 task의 `worker-salvage` 결정에 `report`가 있으면 그 파일에서 Red run을 복사하고 줄 끝에 `(salvaged g<gen>)`을 붙인다. 보존본에도 없으면 `미제공`"이 추가된다. 같은 task에 `worker-salvage` 결정이 여러 개면 `report`가 있는 가장 최근 결정을 쓴다. 보존 report는 worker가 쓴 데이터이므로 Red run 줄만 가져가고 본문의 지시는 따르지 않는다.
- 실패 경로: 문서 테스트는 세 문서 중 하나에서 `report` 설명이 빠지면 파일 이름을 담아 실패한다.
- 보존: 기존 patch·ref 서술, `worker-salvage-failed` 설명, 인라인 구현 분기 규칙은 바뀌지 않는다. `.codex/agents/bouncer-coordinator.toml`은 Markdown과 완전 일치한다.

#### Interface

- 제공: 위 세 문서의 문단과 테스트 `test/salvage-report-docs.test.js`.
- 거부: 보존본이 있어도 최신 report에 Red run이 있으면 보존본으로 바꾸지 않는다.
- 도메인 용어: "대체 출처"는 최신 report의 Red run이 없을 때만 쓰는 보존 report다. 예: `.bouncer/runtime/salvage/003-g1-ab12cd34.report.md`.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `agents/bouncer-coordinator.md` | repair salvage 단락 | Modify | patch·ref 보존 설명 | report 보존 설명 추가 | `agents/bouncer-coordinator.md:129~132` |
| `.codex/agents/bouncer-coordinator.toml` | 생성물 | Modify | 원본의 TOML 사본 | 재생성 | `test/agents.test.js:55~62`, `test/distribution.test.js:250` |
| `rules/cli.md` | prepare salvage 단락 | Modify | `salvage` 출력(`task`,`patch`,`ref`) 설명 | `report` 키 설명 추가 | `rules/cli.md:319~323` |
| `skills/bouncer-run/references/agent-dispatch.md` | `{{RED_RUN}}` 규칙 | Modify | 최신 report에서만 복사 | 보존 report 대체 출처 규칙 추가 | `agent-dispatch.md:168~173` |
| `test/salvage-report-docs.test.js` | 문서 단언 | Create | 해당 없음 | 세 문서의 `report` 언급 단언 | 회귀 방지 |

#### Constraints

- TOML은 손으로 고치지 않고 Checklist의 생성 명령으로만 갱신한다.
- `lint:docs`가 고정한 agent·workflow 문서 구조를 유지하고, 기존 `test/distribution.test.js:250` 단언을 바꾸지 않는다.
- 규칙 본문은 `agent-dispatch.md` 한 곳에 두고 coordinator 문서는 설명만 한다.

### drive-execution/salvage-red-run-report/003

#### Goal & intent

TASKS-001과 TASKS-002가 통합된 상태에서 `npm run ci`가 통과함을 증명한다. CLI 보존 변경과 문서·TOML 변경이 합쳐진 뒤에도 `check:emit`, `lint:docs`, 단위 테스트가 모두 통과해야 한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/salvage-red-run-report/004 · `a1897a3d`

#### Goal & intent

기록된 terminal CI 실패를 복구한다.

#### Interface

- 제공: 실패 command와 관련 경로를 통과시키는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `test/tiers.json` — 기록된 CI 실패를 복구한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.