---
type: bouncer.explain
title: drive-recovery-contracts explain
description: Explain for drive-recovery-contracts
resource: .bouncer/context/epics/drive-execution/blueprints/drive-recovery-contracts/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-11-01T21:32:06.253+09:00'
bouncer:
  id: EXPLAIN-drive-recovery-contracts
  epic_id: drive-execution
  blueprint_id: drive-recovery-contracts
  status: published
  comprehension:
    - range_from: c5560b02b26d2441b8b2f5145d6d59b735ba4e65
      range_to: 226402ff945a0edbc7d91365bcd3137fb13debfc
      diff_sha: 0a74cfa897d9d2c9e1f75adbe20dbc2f82cb0c8115f038698c707ca3b77d9e82
      recorded_at: '2026-11-01T21:32:42.740+09:00'
  task_commits:
    - task: drive-execution/drive-recovery-contracts/001
      sha: f73c8b3a
      intent_anchor: task-001
    - task: drive-execution/drive-recovery-contracts/002
      sha: 54bdcc6d
      intent_anchor: task-002
    - task: drive-execution/drive-recovery-contracts/003
      sha: 804f6ef5
      intent_anchor: task-003
    - task: drive-execution/drive-recovery-contracts/004
      sha: 8967f348
      intent_anchor: task-004
    - task: drive-execution/drive-recovery-contracts/006
      sha: 226402ff
      intent_anchor: task-006
---
# Explain

## Background

드라이브 실행 중 작업자가 파일을 하나도 바꾸지 않고 보고만 남기면, `coordinate next`가 같은 `commit`을 계속 고르고 `advance`가 최대 단계까지 빈 commit을 되풀이했다. 작업자 토큰 기록이 어느 호출 것인지 알 수 없을 때도 막다른 길이었다. 그 상태를 코디네이터가 명시적으로 "귀속 불명"으로 표시할 방법이 없었다. Codex 역할 파일(model·effort)이 생성본과 어긋났을 때 복구 절차도 없었다. `rules/cli.md`는 830줄짜리 한 문서라 사용 단계별로 필요한 계약만 찾기 어려웠다.

이 변경은 세 가지 막다른 길에 멈춤 조건과 복구 경로를 주고, CLI 계약 문서를 단계별로 나눈다.

## Code

- `packages/cli/src/coordinate-next.ts` — 현재 attempt 보고가 있고 verify·review가 통과했는데 worker HEAD와 porcelain이 dispatch 기준 그대로면 `commit` 대신 `blocked`, reason `unchanged-worker-report`를 돌려준다. `payload.report_path`에 보고 경로가 실린다. 상태가 조금이라도 바뀌면 조건이 풀려 기존 commit 경로로 돌아간다.
- `packages/cli/src/coordinate-advance.ts` — `classifyRun`이 성공 응답 본문을 같이 돌려준다. `commit`이 `committed:false`로 끝나면 `advance`가 `empty-commit`(`ok:false`)으로 멈춘다. 이미 실행한 단계는 `executed`에 남는다. 이 검사는 `action === 'commit'` 응답에만 걸린다.
- `packages/cli/src/coordinator-commands.ts` — `worker-tokens --tokens ambiguous` 표시를 새로 받는다. 표시는 `worker-tokens-ambiguous`라는 별도 kind로 기록되고, 그 키에 그때까지 쌓인 model·tokens 행(`model_rows`, `token_rows`)을 "덮인 호출"로 묶는다. 이 호출들은 `advance`·`record`의 토큰 미충족 판정에서 면제된다. 표시 뒤에 생긴 새 호출은 여전히 자기 model과 tokens를 기록해야 한다. `withoutAmbiguousRows`는 행을 호출 단위로 대응시키고, 표시 뒤의 토큰 행은 열린 새 호출을 먼저 채운다. 통계(`metrics summary`)에서는 표시된 호출이 "미측정"으로 남는다. 한계도 있다. 표시 뒤에 새 model이 먼저 기록되고 늦은 토큰이 오면, 원장만으로는 그 토큰이 덮인 호출 것인지 증명할 수 없어 새 model 몫으로 본다.
- `agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml` — Hard guards에 Codex 역할 복구 항목이 생겼다. `missing`·`mismatch`는 한 번만 재시드한다. `not-generated`(사용자 소유 파일)는 시드 없이 fallback으로 간다. effort를 풀 수 없는 `role-config-invalid`는 `key`·`message`·`next`를 보고하고 멈춘다. drive 밖에서는 `coordinate note`가 없으므로 사용자에게 같은 사유와 경로를 알린다.
- `rules/cli.md` — 830줄에서 9줄로 줄어 색인 역할만 한다. 본문은 `rules/cli-coordinate.md`, `rules/cli-workflow.md`, `rules/cli-discovery.md`, `rules/cli-migration.md`로 나뉘었다. `skills/bouncer-run/SKILL.md`와 `references/direct-run.md`의 인용도 새 파일로 바꿨다.
- 알려진 한계 — Codex 호스트에서 named 디스패치와 모델 거절은 실제로 실행하지 않았다. 문서 구조, 생성본, 설치 소비까지만 검증했다. rework 후 재배정 전 과정과 `coordinate report --outcome rework`가 blocked 상태에서 허용되는지는 테스트하지 않았다. `bouncer init --seed-codex-agents` 출력의 `skipped: already-initialized`와 실제 TOML 갱신이 어긋나는 문제는 범위 밖이라 고치지 않았다.

## Quiz

아래 퀴즈는 `/bouncer-finalize` 대화에서 진행한다. 정답과 응답은 이 파일에 적지 않는다.

## Tasks

### drive-execution/drive-recovery-contracts/001 · `f73c8b3a`

#### Goal & intent

현재 attempt 보고와 변경 없는 worker를 판정해 빈 commit 반복을 막는다. 전용 검증: `node --test test/coordinate-advance.test.js test/coordinate-next-recovery.test.js`.

#### Current behavior

`coordinate-next.ts:996-1008`은 보고 파일 유무와 HEAD·porcelain을 읽고 `:1054-1069`는 stamp가 없으면 commit을 고른다. `commit.ts:510-514`는 빈 변경에서 committed:false를 낸다. `coordinate-advance.ts:240-375`는 next와 명령 출력을 사용한다. `node --test test/coordinate-advance.test.js`로 기존 자동 진행 경계를 재실행한다.

#### Target behavior

성공: 보고와 동일 HEAD·동일 작업 상태에서 coordinator에게 상황을 알리고 판단 후 정상 commit을 진행할 경로를 제공한다. 실패: 빈 commit 결과는 반복하지 않고 원인과 다음 조치를 표시한다. 보존: 정상 변경과 무트레일러 commit의 기존 경로.

#### Interface

현재 attempt의 보고가 있고 dispatch 기준 HEAD와 porcelain이 모두 같으며 verify가 통과하고 review 조건이 충족됐으나 commit stamp가 없으면 `next`는 `action: blocked`, `reason: unchanged-worker-report`와 현재 보고 경로 및 coordinator 판단 안내를 반환한다. `advance`는 이를 `stop.reason: blocked`, `stop.next`의 같은 reason과 보고 경로로 전달하며 commit 명령을 실행하지 않는다. coordinator는 보고와 brief를 대조해 추가 구현이 필요하면 해당 worker를 재배정하고, 변경이 생기면 `next`를 다시 호출해 기존 verify·review·commit 경로를 따른다. 변경이 없으면 같은 blocked 상태를 유지하고 사유를 보고한다. 거부: 보고 문자열만으로 의미를 승인하거나 빈 commit을 진행으로 계산하지 않는다. 이미 `commit`이 실행되어 `committed: false`를 반환하는 경우 `advance`는 `reason: empty-commit`으로 중단하고 재실행하지 않는다.

외부 실행 주입 seam은 `deps.runArgv(argv: string[], cwd: string) → { stdout: string, status: number }`이다. 빈 commit 테스트에서는 commit 호출에 `{ stdout: '{"ok":true,"committed":false,"staged":[]}', status: 0 }`을 반환한다. `stdout`은 commit 결과 JSON 객체를 직렬화한 문자열이며 `ok: true`와 `committed: false`로 성공 응답이지만 commit은 생성되지 않았음을 나타낸다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinate-next.ts` | `taskNext` | Modify | 보고 존재 시 verify 이후 stamp가 없으면 commit 선택 | 보고 판정 경로 제공 | 현재 코드·계약 조사 |
| `packages/cli/src/coordinate-advance.ts` | `advance` | Modify | 성공 argv를 반복 실행 | committed:false 진행 중단 | 현재 코드·계약 조사 |
| `test/coordinate-advance.test.js` | `advance` | Modify | 자동 실행 경계 검증 | 빈 commit 반복 회귀 | 현재 코드·계약 조사 |
| `test/coordinate-next-recovery.test.js` | `coordinateNext` | Create | 신규 fixture | 실제 next 판정 회귀 | 현재 코드·계약 조사 |
| `test/tiers.json` | `integration` | Modify | 테스트 tier 등록 | 신규 `coordinate-next-recovery.test.js`를 integration에 등록 | 신규 회귀 테스트 실행 범위 유지 |
| `agents/bouncer-coordinator.md` | `next 판단` | Modify | coordinator의 next 카드 처리 | 보고 알림 이후 commit 판단과 재개 | `agents/bouncer-coordinator.md:223,247` |

| `.codex/agents/bouncer-coordinator.toml` | `생성 역할 본문` | Modify | coordinator Markdown의 Codex 배정용 생성본 | 변경된 역할 계약을 생성본에 반영 | `test/distribution.test.js:269-294`는 체크인 바이트와 생성 결과 및 역할 계약을 비교하고 `test/runtime-install-smoke.test.js:72-89`는 local·global 설치의 seed 결과를 소비한다 |
| `test/distribution.test.js` | `coordinator 생성본 parity` | Modify | Markdown과 체크인 TOML의 일치 및 생성 역할 계약 검사 | 변경된 coordinator 계약이 생성본에 전달되는지 검사 | `test/distribution.test.js:269-294` |
| `test/runtime-install-smoke.test.js` | `seededAgents` | Modify | local·global 설치에서 생성된 coordinator 역할 소비 검사 | 변경된 계약이 양쪽 설치의 생성 역할에 전달되는지 검사 | `test/runtime-install-smoke.test.js:72-89` |

#### Constraints

보고 내용과 실행 순서는 coordinator가 판단하며 CLI는 형식과 evidence 참조를 검사한다. 파일 I/O는 `coordinate-next.ts:869`의 report 읽기, git I/O는 `:993-995`에 있다.

### drive-execution/drive-recovery-contracts/002 · `54bdcc6d`

#### Goal & intent

모델과 토큰 기록 불일치를 재현하고 호출별 안전한 복구 경계를 확인한다. 전용 검증: `node --test test/coordinator-worker-recovery.test.js`.

#### Current behavior

`coordinator-commands.ts:876-956`은 model 기록별 자리를 열고 token duplicate를 검사한다. `:1672-1676`은 누락 model을 먼저 기록하라는 안내를 낸다. 기록은 원장 파일 I/O에 의존한다.

#### Target behavior

성공: 두 dispatch와 model 한 건·unreported 한 건을 재현하고 실제 시점이 입증된 누락 기록만 지원된 명령으로 복구한다. 모호한 대응은 기존 기록을 보존하고 coordinator에게 알리며 차단 없이 재개한다. 보존: 중복 토큰 거절.

#### Interface

귀속 입증은 host completion과 dispatch 식별자 및 순서가 같은 호출을 유일하게 가리키는 경우다. 예: 두 번째 dispatch 완료 통지의 식별자와 기록 시각이 두 번째 호출에 일치한다. 이때 기존 `coordinate worker-model --blueprint <dir> --role <role> --model <model> --task <ddd> --ledger-path <p> --ledger-hash <h>`로 누락 model을 추가하고 `coordinate worker-tokens --blueprint <dir> --role <role> --task <ddd> --tokens <count|unreported> --ledger-path <p> --ledger-hash <h>`로 그 호출의 토큰을 추가한다. 기존 기록은 보존하며 `--replace`는 쓰지 않는다.

귀속이 모호하면 CLI에 `coordinate worker-tokens --blueprint <dir> --role <role> --task <ddd> --tokens ambiguous --ledger-path <p> --ledger-hash <h>`를 제공한다. 이는 해당 키의 미귀속 기록 집합과 사유를 `ambiguous`로 별도 기록하고 coordinator에게 알려 재개한다. 기록은 key `(task, role, perspective)`와 기록 당시 원장의 미귀속 model·token 행 각각의 경계(행 순번 또는 안정된 식별자)를 담아 당시 집합을 고정하고 기존 model·tokens 행을 바꾸거나 어느 dispatch에도 할당하지 않는다. 이후 같은 키에 추가되는 행과 dispatch는 이 집합에 포함되지 않는다. fence는 각 명령 직전 status에서 받은 값을 쓴다. 재개 guard는 기록된 당시 집합에 대해서만 명시적 예외를 적용하고 토큰 집계는 미측정으로 표시한다. 이후 같은 키에 생긴 미기록 호출은 별도로 guard가 차단하며 새 증거에 따른 기록 또는 별도의 ambiguous 판정이 필요하다. 이후 실제 귀속이 입증되기 전까지 개별 호출의 토큰 완결을 주장하지 않는다. 존재하지 않는 키나 중복 ambiguous 기록은 원장 변경 없이 거절한다. 거부: 원장 수동 편집, 다른 호출 기록 덮어쓰기, 근거 없는 `--replace`와 임의 귀속.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateWorkerRecord` | Modify | worker-model과 worker-tokens 기록 및 중복 거절 | 필요한 안전 복구 및 안내 | 현재 코드·계약 조사 |
| `test/coordinator-worker-recovery.test.js` | `worker 기록` | Create | 신규 회귀 fixture | 순서와 중복 보존 확인 | 현재 코드·계약 조사 |
| `test/tiers.json` | `integration` | Modify | 테스트 tier 등록 | 신규 `coordinator-worker-recovery.test.js`를 integration에 등록 | 신규 회귀 테스트 실행 범위 유지 |
| `skills/bouncer-run/references/agent-dispatch.md` | `worker 기록` | Modify | model·tokens 기록 지침 | 모호한 기록 보존·통지·재개 | `agent-dispatch.md:310,357` |
| `rules/cli.md` | `worker 기록 계약` | Modify | 기록과 거절의 현재 정본 | 비차단 복구 계약 명시 | `rules/cli.md:314` |

#### Constraints

현재 안내가 어떤 순서에서 안전한지 먼저 실제 fixture로 입증한다. 호출 귀속을 추측하거나 기존 기록을 덮지 않고 비차단 재개 경로를 제공한다.

### drive-execution/drive-recovery-contracts/003 · `804f6ef5`

#### Goal & intent

현재 Codex 역할 검사와 실제 배정 지침의 재동기화 및 fallback 경로를 확인한다. 전용 검증: `node --test test/agents.test.js test/skill-bouncer-run.test.js`.

#### Current behavior

`skills/bouncer-run/references/agent-dispatch.md:42-50,84-104`는 check·재동기화와 전체 본문 fallback을 기술한다. `rules/subagent-model.md:32-37,62-85`는 effort와 모델 거절을 구분한다. 생성 TOML 및 check는 파일 I/O를 수행한다.

#### Target behavior

성공: 생성본 불일치를 coordinator에 알리고 전체 역할 본문 fallback의 실제 호출 입력을 확인한다. 실패: 사용자 소유 역할 파일을 덮지 않고 모델 거절 원인을 보고한다. 보존: effort spawn 전달과 역할 권한.

#### Interface

codex-agents check, init seed 및 host dispatch 입력. 거부: 모델 거절 뒤 자동 fallback, 축약 역할 본문, 권한 확장.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/agent-dispatch.md` | `dispatch` | Modify | Codex 재동기화와 전체 본문 fallback | 실행 가능한 분기 명확화 | 현재 코드·계약 조사 |
| `agents/bouncer-coordinator.md` | `coordinator 권한` | Modify | coordinator 판단과 복구 권한 | 비치명 결함 자체 수정과 재개 경계 | `agents/bouncer-coordinator.md:71-75,92,114-126,160-166,174-195`은 상태·write cwd·범위·repair 한도를 정하고 `:289,363`은 사용자 승인을 유지한다. `skills/bouncer-run/references/agent-dispatch.md:42-50,84-104`와 `rules/subagent-model.md:62-85`는 재동기화·전체 fallback·모델 거절과 권한 경계를 정한다 |
| `rules/subagent-model.md` | `host fallback` | Modify | 모델·effort·역할 fallback 계약 | 일관된 실행 지침 | 현재 코드·계약 조사 |
| `test/skill-bouncer-run.test.js` | `run 계약` | Modify | 배정 지침 테스트 | 불일치 및 전체 payload 검증 | 현재 코드·계약 조사 |
| `test/agents.test.js` | `Codex 역할 생성` | Modify | 생성 계약 테스트 | effort 및 불일치 확인 | 현재 코드·계약 조사 |

| `.codex/agents/bouncer-coordinator.toml` | `생성 역할 본문` | Modify | coordinator Markdown의 Codex 배정용 생성본 | 변경된 역할 계약을 생성본에 반영 | `test/distribution.test.js:269-294`는 체크인 바이트와 생성 결과 및 역할 계약을 비교하고 `test/runtime-install-smoke.test.js:72-89`는 local·global 설치의 seed 결과를 소비한다 |
| `test/distribution.test.js` | `coordinator 생성본 parity` | Modify | Markdown과 체크인 TOML의 일치 및 생성 역할 계약 검사 | 변경된 coordinator 계약이 생성본에 전달되는지 검사 | `test/distribution.test.js:269-294` |
| `test/runtime-install-smoke.test.js` | `seededAgents` | Modify | local·global 설치에서 생성된 coordinator 역할 소비 검사 | 변경된 계약이 양쪽 설치의 생성 역할에 전달되는지 검사 | `test/runtime-install-smoke.test.js:72-89` |

#### Constraints

`c5560b02` 이전의 effort mismatch를 현재 결함으로 전제하지 않는다. coordinator는 drive에 치명적이지 않은 결함을 자체 수정하고 재개한다. 사용자 전용 승인과 gate는 유지한다.

### drive-execution/drive-recovery-contracts/004 · `8967f348`

#### Goal & intent

CLI 계약의 정본과 호출 시점 참조를 분리하고 거절 표 검사를 유지한다. 전용 검증: `node --test test/doc-shape-cli.test.js test/skill-bouncer-run.test.js test/plugin-doc-cites.test.js`.

#### Current behavior

`rules/cli.md`의 workflow·coordinator·discovery·migration 섹션은 각각 9·274·555·815행부터다. `doc-shape-contracts.ts:136`과 `test/doc-shape-cli.test.js:260-297`은 기존 거절 표 위치를 검사한다. run SKILL은 36·101·153행에서 cli.md를 읽는다. 문서와 링크 파일 I/O가 판단 경계다.

#### Target behavior

성공: coordinator 표를 먼저 이동하고 검사·호출 참조를 맞춘 다음 나머지를 이관한다. 실패: 누락된 표 행·깨진 링크·필요한 세부 계약을 읽지 않는 호출을 검출한다. 보존: 명령·거절·복구 의미.

#### Interface

다섯 CLI 문서와 호출 시점별 링크, 문서 shape 검사. 거부: 중복 정본, 색인만 읽는 실행 경로, 검증되지 않은 계약 삭제.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `rules/cli.md` | `CLI 색인` | Modify | 전체 명령 계약 | 색인과 공통 결과 처리 | `skills/bouncer-run/SKILL.md:36,101,153`, `skills/bouncer-run/references/direct-run.md:10`은 실행 시 읽고 `README.md:106`, `docs/workflow.md:159`는 유지할 색인 링크다 |
| `rules/cli-coordinate.md` | `coordinator 계약` | Create | 신규 | pointer·worktree·coordinate 정본 | 현재 코드·계약 조사 |
| `rules/cli-workflow.md` | `workflow 계약` | Create | 신규 | plan·validate·verify·commit 등 정본 | 현재 코드·계약 조사 |
| `rules/cli-discovery.md` | `조회 계약` | Create | 신규 | intent·Graphify 등 정본 | 현재 코드·계약 조사 |
| `rules/cli-migration.md` | `migration 계약` | Create | 신규 | migration·import 정본 | 현재 코드·계약 조사 |
| `packages/cli/src/doc-shape-contracts.ts` | `rejectionTable` | Modify | 현재 cli.md 소유 | 새 위치 검사 | `packages/cli/src/doc-shape-contracts.ts:136`, `test/doc-shape-cli.test.js:260-297`의 거절 표 경로와 세 fixture |
| `test/doc-shape-cli.test.js` | `거절 표` | Modify | 기존 경로 fixture | 새 위치 및 누락 감지 | 현재 코드·계약 조사 |
| `skills/bouncer-run/SKILL.md` | `규칙 참조` | Modify | cli.md 참조 | 해당 단계 세부 계약 참조 | 현재 코드·계약 조사 |
| `skills/bouncer-run/references/direct-run.md` | `규칙 참조` | Modify | cli.md 참조 | 세부 계약 참조 | 현재 코드·계약 조사 |
| `test/skill-bouncer-run.test.js` | `run 참조` | Modify | 기존 참조 확인 | 단계별 참조 확인 | 현재 코드·계약 조사 |
| `packages/cli/src/coordinator-commands.ts` | `worker 기록 주석` | Modify | cli.md 참조 주석 | 이관 경로로 수정 | `coordinator-commands.ts:1671` |
| `packages/cli/src/coordinator-repair.ts` | `거절 표 주석` | Modify | cli.md 거절 표 참조 | 이관 경로로 수정 | `coordinator-repair.ts:1498` |
| `test/build-release.test.js` | `배포 자산` | Modify | cli.md 배포 확인 | 신규 계약 문서 배포 확인 | `test/build-release.test.js:202` |

#### Constraints

계약 소비 조사: `rg -n "rules/cli\.md" --glob "!dist/**" --glob "!.bouncer/**"`의 현재 결과에서 `skills/bouncer-run/SKILL.md:36,101,153`과 `skills/bouncer-run/references/direct-run.md:10`은 실행 시 세부 계약을 읽는 호출이므로 변경한다. `packages/cli/src/doc-shape-contracts.ts:136`, `test/doc-shape-cli.test.js:260-297`은 거절 표 소유 위치를 검사하고 `packages/cli/src/coordinator-commands.ts:1671`, `packages/cli/src/coordinator-repair.ts:1498`은 이관 대상 계약을 가리키며 `test/build-release.test.js:202`는 배포 자산을 열거한다. `README.md:106`, `docs/README.md:34`, `docs/configuration.md:238`, `docs/workflow.md:159`는 유지할 색인 링크이고 `docs/architecture/rule-ownership.md:80,84`는 startup에서 색인을 읽는 현행 소유권 설명이며 세부 계약 정본을 주장하지 않는다. `DRIVE-RECOVERY-INCIDENT.md:15,63`과 `RETRO-review-close-drive-efficiency.md:64`는 과거 기록이다. 구현 시 동일 검색으로 새 참조와 이동된 계약의 직접 소비자를 재조사하고, 범위 밖 경로 수정이 필요하면 coordinator에 추가 scope 확인을 요청한다. `test/doc-shape-cli.test.js`의 `rules/cli.md rejection table with an unsupported reason → exit 1 naming the file and code`, `rules/cli.md rejection table missing a required reason row → exit 1 naming the missing code`, `rules/cli.md with a correct rejection table and other backticked words → exit 0` 세 테스트의 fixture 경로 및 파일명 기대값을 `rules/cli-coordinate.md`로 바꾼다. 각각 종료 코드 1·1·0, 거절 사유 `final-review-unknown` 및 `final-review-repair-do-not-touch` 확인은 보존한다.

### drive-execution/drive-recovery-contracts/005

#### Goal & intent

모든 구현 task 통합 후 `npm run verify:strict`로 전체 계약을 확인하고 현재 G13의 재현 여부를 별도로 조사한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### drive-execution/drive-recovery-contracts/006 · `226402ff`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- CT-001 (major, correctness_tests, must_fix) — packages/cli/src/coordinator-commands.ts#withoutAmbiguousRows — tasks/002 interface
- CT-002 (minor, correctness_tests, must_fix) — test/coordinator-worker-recovery.test.js#ambiguous resume test — tasks/002 checklist

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `packages/cli/src/coordinator-commands.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `test/coordinator-worker-recovery.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.