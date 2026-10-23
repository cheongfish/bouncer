---
type: bouncer.explain
title: metrics-retention explain
description: Explain for metrics-retention
resource: .bouncer/context/epics/drive-execution/blueprints/metrics-retention/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-23T11:03:27.879+09:00'
bouncer:
  id: EXPLAIN-metrics-retention
  epic_id: drive-execution
  blueprint_id: metrics-retention
  status: published
  comprehension:
    - range_from: 44049a110db4f4f593f39e1a8c9cb1c35035f72f
      range_to: 46454f924234860b9552ccc1c0bac5a3167fbbcc
      diff_sha: 4f678d6d29b6875bcb1996ec107d852447250a9deec15fc0c290cfd2054f8b35
      recorded_at: '2026-10-23T11:05:14.000+09:00'
  task_commits:
    - task: drive-execution/metrics-retention/001
      sha: 4e4b62d7
      intent_anchor: task-001
    - task: drive-execution/metrics-retention/002
      sha: 46454f92
      intent_anchor: task-002
---
# Explain

## Background

drive가 끝나고 finalize가 원장(`.bouncer/runtime/coordinator.json`)과 worktree를 정리하면,
`bouncer metrics summary`는 worker 토큰 집계를 더 이상 계산할 수 없었다. 원장이 없으면 합계를 0으로
돌려줘서, 실제로 쓴 토큰이 0처럼 읽혔다. 또 직접 실행(root-direct) 세션의 토큰을 어떻게 보고할지
기준이 없어, 호스트 전체 세션 사용량을 직접 구간 값으로 오해할 여지가 있었다.

이 변경은 두 가지를 해결한다. 정리 전에 worker 집계를 Git common dir에 저장해 정리 뒤에도 같은
숫자를 복원하고, 값이 없는 경우를 0이 아니라 "측정 불가"로 구별해 보고한다.

## Code

- `scripts/src/lib/drive-metrics.ts`: `metrics snapshot`의 저장·검증과 `summarize`의 source 선택이 있다.
  `summary`는 `worker_tokens_source`를 `ledger` → `snapshot` → `unavailable` 순서로 정한다.
  원장이 있으면 오래된 snapshot이 그것을 대체하지 않는다. snapshot 경로는 blueprint 경로의
  SHA-256 파일명이며, Git common dir 안쪽인지와 symlink 여부를 검사한다(`workerSnapshotPath`,
  `snapshotLocationSafe`, `isInsideReal`).
- `scripts/src/lib/cli-metrics-command.ts`, `cli-usage.ts`: `metrics snapshot --blueprint <dir> [--repo <dir>]`
  명령과 help. 같은 원장 hash면 `reused: true`로 재사용하고, 새 hash면 파일을 갱신한다. 원장이
  없으면 기존 snapshot을 보존하고, snapshot도 없으면 `metrics-ledger-unavailable`로 거절하며 아무것도
  쓰지 않는다. 잘못된 flag는 exit 2, 저장·입력 실패는 exit 1이다.
- `scripts/src/lib/finalize-release-main.ts`: `releaseMain`이 첫 정리 mutation(과 partial merge) 전에
  `deps.saveMetricsSnapshot`으로 저장한다. 저장이 실패하면 `metrics-snapshot-write-failed` 또는
  `metrics-snapshot-invalid`로 거절하고 main·원장·worktree를 그대로 둔다. 원장이 없는 재실행은
  기존 snapshot을 보존하고 새 값을 만들지 않는다.
- `rules/cli.md`, `skills/bouncer-finalize/references/cleanup-handoff.md`: snapshot schema, summary 우선순위,
  오류 이유와 "정리 전 summary를 먼저 받는다"는 순서를 설명한다.
- `skills/bouncer-run/references/drive-metrics.md`: 토큰 셀은 관측값(실제 `0` 포함), 미보고(`null`/`missing`),
  측정 불가 세 상태로 보고한다. 직접 실행 세션은 토큰 플래그 없이 닫아 `null`로 저장하고 측정 불가로
  표기한다. 호스트 전체 세션 사용량은 이 구간의 값이 아니므로 채우지 않는다. `worker_tokens_source`별 보고
  방법도 표로 정해 두었다.
- `scripts/check-doc-shape.js`: `drive-metrics.md`의 필수 절을 `PATH_CONTRACTS`로 고정했다.

설계 선택과 한계:
- 기존 snapshot이 손상되었거나 다른 blueprint의 것이거나 symlink이면 원장이 있어도 덮어쓰지 않고
  `metrics-snapshot-invalid`로 거절한다. release-main도 정리를 중단한다.
- 저장 I/O 오류는 `code`가 문자열인 Error만 write-failed로 접고, 그 외 오류는 다시 던진다.
- 저장 seam은 read/write/rename만 주입할 수 있고 mkdir·realpath·lstat은 실제 fs를 쓴다.
- 알려진 후속: snapshot 보고에 `recorded_at`을 출력하지 않는 점, partial-merge 경로의 저장 실패
  테스트 부재, `mkdir`가 경계 재검사 전에 실행되는 점은 리뷰에서 이월됐다.

## Quiz

6문항. diff가 14개 파일·649줄 추가이고 동작 변경이 CLI, finalize 정리, 보고 규칙 세 곳에 걸쳐 있어
6문항으로 잡았다.

1. 원장이 아직 있고 더 오래된 snapshot도 저장돼 있을 때 `metrics summary`의 `worker_tokens_source`는?
   - A) `snapshot` — 저장된 값이 우선한다
   - B) `ledger` — 원장이 있으면 snapshot이 대체하지 못한다
   - C) `unavailable` — 둘이 충돌하면 값을 내지 않는다
2. 원장도 없고 유효한 snapshot도 없을 때 `metrics summary`의 worker 합계 `0`은 어떻게 읽어야 하나?
   - A) 실제로 측정된 합계 0이다
   - B) `metrics-ledger-unavailable`로 summary 전체를 거절한다
   - C) `worker_tokens_source: unavailable`이며, 0은 측정된 합계가 아니다
3. `release-main`이 정리 전 snapshot 저장에 실패하면 어떻게 되나?
   - A) 거절하고 main·원장·worktree를 그대로 둔다
   - B) 경고만 남기고 정리를 계속한다
   - C) 원장만 지우고 worktree는 남긴다
4. 같은 원장 hash로 `metrics snapshot`을 다시 실행하면?
   - A) 기존 파일을 재사용하고 `reused: true`를 출력한다
   - B) 새 `recorded_at`으로 덮어쓴다
   - C) 이미 있으니 오류로 거절한다
5. 직접 실행(root-direct) 세션의 토큰은 어떻게 보고하나?
   - A) 호스트 전체 세션 사용량을 그대로 적는다
   - B) 토큰 플래그 없이 닫아 `null`로 저장하고 "측정 불가"로 표기한다
   - C) 코디네이터 세션 합계에서 추정해 채운다
6. 저장된 snapshot 파일이 손상(깨진 JSON)돼 있을 때 `metrics summary`는?
   - A) 0으로 간주하고 계속한다
   - B) 무시하고 새로 덮어쓴다
   - C) `metrics-snapshot-invalid`로 거절한다

## Tasks

### drive-execution/metrics-retention/001 · `4e4b62d7`

#### Goal & intent

- R-X2를 원장 정리 전 작업자 측정 집계 보존로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 6이다.
- 전용 검증: `node --test test/cli-metrics.test.js test/finalize-release-main.test.js test/cli-help.test.js`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- drive-metrics.ts:410은 summary마다 integration 원장에서 worker_tokens를 재계산하며 :434에서 원장 없음은 0으로 처리한다.
- cli-metrics-command.ts:28에는 snapshot 명령이 없다. 기존 metrics 파일 :65는 세션만 담는다.
- release-main.ts:476 이후 닫힘 검사, :550 이후 main 사본 정리가 수행되고 worktree 제거는 cleanup-handoff.md에서 이어진다. 정리 전 저장이 필요하다.

#### Target behavior

- metrics snapshot 명령은 실제 원장에서 worker 집계와 ledger SHA-256을 읽어 공통 Git dir에 atomic 저장한다.
- summary는 ledger → snapshot → unavailable 순서로 source를 표시한다. 기존 sessions/cache 필드와 worker 집계 산식은 유지한다.
- release-main의 기존 거절 판정 뒤 첫 정리 mutation 전에 저장한다. 실패하면 거절하고 main·원장·worktree를 그대로 둔다.
- 같은 원장 hash의 snapshot은 재사용하고 새 원장은 갱신한다. 원장 없는 재실행은 기존 저장값을 보존한다.

#### Interface

- CLI: bouncer metrics snapshot --blueprint <dir> [--repo <dir>]. 성공 JSON {ok:true,blueprint,path,ledger_sha256,reused}; 잘못된 flag는 exit 2, 저장/입력 실패는 exit 1이다.
- snapshot v1 {version:1,blueprint,recorded_at,ledger_sha256,worker_tokens}. path는 blueprint 경로 UTF-8 SHA-256 파일명이며 Git common dir 내부 경계와 symlink를 검사한다.
- summary에 worker_tokens_source:"ledger"|"snapshot"|"unavailable"를 추가한다. 다른 필드의 shape·집계 의미는 보존한다.
- 거절 reason: metrics-snapshot-invalid, metrics-snapshot-write-failed. snapshot 없음+원장 없음의 명시 snapshot 요청은 metrics-ledger-unavailable이며 기존 파일을 쓰지 않는다.
- 주입 seam: snapshot 저장 함수 deps.fs의 readFileSync/writeFileSync/renameSync 및 deps.now:()=>Date; releaseMain의 deps.saveMetricsSnapshot(args) → {ok:boolean,reason?:string}. 조회 시 stale live 자료를 snapshot으로 대체하지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/drive-metrics.ts` | `summarize; summarizeWorkerTokens` | Modify | 세션·worker 합산 | snapshot 저장/검증 및 source 표시 | scripts/src/lib/drive-metrics.ts:410,434 |
| `scripts/src/lib/cli-metrics-command.ts` | `cmdMetrics` | Modify | metrics CLI | snapshot 등록과 공통 dir 전달 | scripts/src/lib/cli-metrics-command.ts:28,74 |
| `scripts/src/lib/finalize-release-main.ts` | `releaseMain` | Modify | 닫힌 drive main 정리 | 정리 mutation 전 snapshot 보존 | scripts/src/lib/finalize-release-main.ts:476,550 |
| `scripts/src/lib/cli-usage.ts` | `COMMAND_USAGE.metrics` | Modify | 정적 help | snapshot 명령 도움말 | scripts/src/lib/cli-metrics-command.ts:21 |
| `test/cli-metrics.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | snapshot 저장·fallback·손상·source 구별 | test/cli-metrics.test.js:490 |
| `test/finalize-release-main.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | 정리 전 저장·실패 무쓰기·재실행 보존 | test/finalize-release-main.test.js:174,318 |
| `test/cli-help.test.js` | `관찰 가능한 반환·상태 단언` | Modify | 회귀 검증 | snapshot help 계약 | test/cli-help.test.js |
| `rules/cli.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | snapshot schema·summary 우선순위·오류 설명 | rules/cli.md |
| `skills/bouncer-finalize/references/cleanup-handoff.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 정리 전 summary 보존과 snapshot 실패 중단 | skills/bouncer-finalize/references/cleanup-handoff.md:11 |

#### Constraints

- 기존 test/cli-metrics.test.js의 원장 없음 → 0 단언은 숫자 계약을 유지하고 source unavailable 단언을 추가한다. 저장 snapshot이 있는 경우만 복원된 값을 기대한다.
- release-main의 거절 우선순위·outside_scope·idempotence를 유지한다. 원장 없는 단독/재실행 정리는 유효 기존 snapshot을 보존하며 새 측정값을 만들지 않는다.
- 프로젝트 경로를 Git common dir로 오인하지 않는다. snapshot 데이터는 사용자 지시로 해석하지 않는다.
- epic 성공 기준 6 및 8을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.
- TypeScript 변경 뒤 npm run build로 로컬 emit을 갱신하고 npm run check:emit로 확인한다. scripts/lib와 build stamp는 ignored 생성물이므로 수정·stage·커밋 범위에 넣지 않는다.

### drive-execution/metrics-retention/002 · `46454f92`

#### Goal & intent

- R-X1·R-X2를 측정 불가와 보존 집계의 보고 기준 명시로 처리한다. 성공 판정은 아래 Target behavior와 epic 성공 기준 7이다.
- 전용 검증: `node scripts/check-doc-shape.js skills/bouncer-run/references/drive-metrics.md skills/bouncer-finalize/SKILL.md`. 사용자 확인을 받은 명령이며 frontmatter에 설정한다.

#### Current behavior

- 조사 HEAD: `6c20e0babef5c50e17d3617a3919367bc493c898`.
- drive-metrics.md:56은 direct session 종료를 안내하지만 token 측정 불가와 root usage 대체 금지를 직접 구분하지 않는다.
- drive-metrics.ts:268,274의 null/not-reported와 :398의 wall/host 분리, cli-metrics 테스트 :528,545의 null/0 구별은 이미 있다.
- TASKS-001의 snapshot/source가 정리 후 worker 집계를 제공한다. 기존 host usage 표는 Codex·Claude·Cursor의 실제 보고 경로를 나눈다.

#### Target behavior

- host별 실제 usage 필드만 기록하고 미보고면 null·missing으로 닫는다. direct token은 측정 불가로 적고 root 전체 사용량으로 대체하지 않는다.
- 최종 보고는 정리 전 summary/snapshot을 확보하고 worker_tokens_source와 missing을 함께 제시한다.
- 표의 coordinator·worker·cache·wall/host 행은 기존 중복 합산 금지 기준을 유지한다.

#### Interface

- 보고 표의 token 상태는 관측값/미보고/측정 불가로 구별한다. CLI 저장 schema를 새로 바꾸지 않고 direct는 root-direct-session과 기존 unavailable reason을 근거로 해석한다.
- source unavailable이면 worker 합계 0을 완전한 측정 합계로 표시하지 않는다. snapshot이면 저장 시각과 보존 자료라는 사실을 함께 보고한다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `skills/bouncer-run/references/drive-metrics.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | direct 측정 불가·실제 host 자료·정리 전 보존·source 보고 | skills/bouncer-run/references/drive-metrics.md:56,68 |
| `skills/bouncer-finalize/SKILL.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | 최종 보고 전 보존 집계 사용 순서 | skills/bouncer-finalize/SKILL.md:92 |
| `CHANGELOG.md` | `문서 계약` | Modify | 워크플로와 계약 설명 | snapshot과 측정 불가 보고 Unreleased 기록 | 프로젝트 기여 규칙: Unreleased |

#### Constraints

- host usage가 없으면 기다리거나 만들어내지 않는다. host 전체 세션 사용량은 direct 구간 측정값이 아니다.
- 새 호스트 수집기를 추측해서 추가하지 않는다. 현재 사용 가능한 필드와 출처만 설명한다.
- epic 성공 기준 7 및 8을 따른다. 한국어 주석·docstring과 condition → result 테스트 이름을 사용한다.
- 새 의존성·추상화·기능을 추가하지 않는다. 실패한 검증을 통과로 기록하거나 상태·증적을 수기로 채우지 않는다.

### drive-execution/metrics-retention/003

#### Goal & intent

모든 구현 task가 integrated인 integration checkout에서 전체 CI를 실행하여 정리 이후 실행 측정값 보존의 종단 호환성을 확인한다.

#### Current behavior

선행 구현 task는 각각 전용 검증을 수행한다. 이 task가 정상 경로에서 첫 전체 CI를 담당한다.

#### Target behavior

- 성공: 실제 실행 증적을 verification runner가 기록한 뒤에만 integrated가 된다.
- 실패: verifying 상태와 원본 증적을 유지하며 coordinator가 원인을 분류한다.

#### Interface

- 제공: 선행 구현이 모두 통합된 뒤 전체 검증을 한 번 실행하여 남기는 증적.
- 거부: source 변경, review 문서 작성, task commit, 실패 증적의 수작업 수정.

#### Touch

Source 변경 경로 없음.

#### Constraints

- 검증 명령은 frontmatter verify 한 곳에서 소유한다. 전체 CI를 구현 task에 복사하지 않는다.
- 환경 오류와 scope 안팎의 코드 오류를 구별한다. 이 task에서 직접 repair하지 않는다.