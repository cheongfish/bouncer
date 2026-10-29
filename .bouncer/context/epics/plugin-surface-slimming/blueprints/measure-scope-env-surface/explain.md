---
type: bouncer.explain
title: measure-scope-env-surface explain
description: Explain for measure-scope-env-surface
resource: .bouncer/context/epics/plugin-surface-slimming/blueprints/measure-scope-env-surface/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-29T20:50:02.058+09:00'
bouncer:
  id: EXPLAIN-measure-scope-env-surface
  epic_id: plugin-surface-slimming
  blueprint_id: measure-scope-env-surface
  status: published
  comprehension:
    - range_from: f64a4966ace171d5cecd3d6cd13fc760f2ee0fa7
      range_to: 1b893388c21bf2da6ee1f9801f4838b26a9943dd
      diff_sha: 8ebe063a10cdda5e3aebb166d77f5442833460f4c097d36f7130e02e1a3135c9
      recorded_at: '2026-10-29T20:51:01.292+09:00'
  task_commits:
    - task: plugin-surface-slimming/measure-scope-env-surface/001
      sha: e63f764e
      intent_anchor: task-001
    - task: plugin-surface-slimming/measure-scope-env-surface/002
      sha: 1f3f7838
      intent_anchor: task-002
    - task: plugin-surface-slimming/measure-scope-env-surface/003
      sha: 9755cd7a
      intent_anchor: task-003
    - task: plugin-surface-slimming/measure-scope-env-surface/004
      sha: 75a3edd1
      intent_anchor: task-004
    - task: plugin-surface-slimming/measure-scope-env-surface/006
      sha: 1b893388
      intent_anchor: task-006
---
# Explain

## Background

full drive에서 worker가 승인된 `affected_paths` 밖의 파일을 하나만 고쳐도 커밋이 막혀 scope 수정 왕복이 생겼다. 생성본 짝이나 고정 테스트처럼 task가 어쩔 수 없이 손대는 파일이 대표적이다. 이 변경은 막는 선을 `Do not touch` 한 곳으로 좁히고, 그 밖의 이탈은 이유와 함께 기록해 통과시킨다.

실행 기록은 finalize 정리 때 사라져 문턱(direct 승격 task 수, 병렬 수, 경보 수)을 바꿨을 때의 효과를 과거 drive로 확인할 수 없었다. 정리 전에 기록을 보존하고, 문턱을 바꿔 같은 입력에서 같은 결과를 내는 집계 스크립트를 더했다. worker 보고 검증과 base CI 확인도 앞당겨, 깨진 base 위에서 worker를 만드는 낭비를 줄인다.

## Code

- `packages/cli/src/scope.ts`, `commit-guard.ts`, `rules/commit-scope.md`: 경로 판정 3층. 예상 scope 안은 허용, 밖이지만 금지선 밖이면 full drive에서 허용하고 `unexpected_paths`로 기록, 금지선과 겹치면 `scope-do-not-touch-violation`. light 원장과 단독 커밋은 예전처럼 scope 밖이면 `out-of-scope`다.
- 금지선은 integration checkout의 task 문서에서만 읽는다. worker가 자기 사본에서 지워도 효과가 없고, 읽지 못하면 비어 있다고 보지 않고 막는다(`scope-do-not-touch-unreadable`). 동적 repair task는 자기 문서에 `.git/`·`.bouncer/`만 있어, 모든 원장 task의 금지선 합집합으로 검사한다.
- `packages/cli/src/coordinator-commands.ts`: `coordinate report --outcome accepted`가 worker의 `## Unexpected paths` 이유를 받는다. 이유 없는 이탈은 `unexpected-path-reason-missing`이고, 금지선도 다시 검사한다. 같은 drive의 아직 통합되지 않은 task와 겹치는 경로는 `overlaps`로 남긴다. `scoped_terminal`에서는 worker가 자기 task 전용 verify만 돌리고 `## Tests`에 적어야 하며, 다르면 `worker-test-report-mismatch`다.
- `packages/cli/src/coordinator-baseline.ts`, `config.ts`: `worktree.baseline`을 설정하면 첫 `coordinate prepare`가 worker 생성 전에 integration base에서 한 번 돌린다. 실패하면 `baseline-ci-failed`로 멈추고 `--accept-broken-baseline`으로 사용자가 승인해야 진행한다. light 원장에는 적용하지 않는다.
- `packages/cli/src/drive-record.ts`, `scripts/measure-drive-records.js`: finalize 정리 전에 리뷰·범위·충돌·repair 기록을 `drive_record`로 보존하고, 스크립트가 문턱을 바꿔 집계한다. 빌드 산출물에 기대지 않고 과거 snapshot만으로 돈다.
- `test/distribution.test.js`, `test/cursor-plugin.test.js`, `scripts/verify-entry-surface.js`, `docs/install.md`: Cursor·Codex 진입 skill과 named agent 계약 테스트, 설치 문서의 진입점 안내 정정.

## Quiz

1. full drive에서 worker가 `affected_paths` 밖이지만 어떤 `Do not touch` 줄에도 걸리지 않는 파일을 고쳐 커밋하면?
   - A) `out-of-scope`로 거절된다.
   - B) 막지 않고, 이유와 함께 `unexpected_paths`로 기록한다.
   - C) scope 수정을 승인받은 뒤에만 커밋된다.
2. `Do not touch`에 슬래시 없는 토큰 `agents`가 있을 때 `agents-extra/x.md`를 고치면?
   - A) 형제 디렉터리라 금지선에 걸리지 않는다.
   - B) `agents`로 시작하는 이름이라 `scope-do-not-touch-violation`이다.
   - C) 금지선을 읽을 수 없다고 보고 `scope-do-not-touch-unreadable`로 막힌다.
3. `scoped_terminal` blueprint에서 worker가 보고 `## Tests`에 자기 task 전용 verify가 아닌 다른 명령을 적으면?
   - A) 경고만 남기고 통과한다.
   - B) 종단 verification node에서 비로소 걸린다.
   - C) fan-in이 `worker-test-report-mismatch`로 거절한다.
4. `worktree.baseline`을 설정했고 첫 `coordinate prepare`의 baseline 실행이 0이 아닌 exit으로 끝나면?
   - A) 경고만 출력하고 worker를 만든다.
   - B) `baseline-ci-failed`로 멈추고, 사용자가 깨진 base를 승인해야 `--accept-broken-baseline`으로 이어진다.
   - C) 자동으로 한 번 더 돌려 통과할 때까지 반복한다.

## Tasks

### plugin-surface-slimming/measure-scope-env-surface/001 · `e63f764e`

#### Goal & intent

finalize release-main이 원장을 지우기 전에 실행 기록(`drive_record`)을 metrics snapshot에 보존한다. 실행 기록은 원장과 blueprint 리뷰 요약으로 계산한다. finalize digest도 같은 입력과 같은 함수로 `drive_record`를 낸다. `scripts/measure-drive-records.js`는 snapshot과 metrics 세션 파일을 모아 범위·충돌·CI repair wave·비용을 집계하고, 같은 입력과 문턱이면 같은 바이트를 낸다. 정기 ablation과 진입 표면 전후 비교 절차는 `benchmarks/ablation/README.md`에 둔다.

수용 기준:
- 새 snapshot에 `drive_record`가 있다. `drive_record`가 없는 기존 snapshot은 유효하게 읽히고, 모양이 틀린 `drive_record`는 `metrics-snapshot-invalid`이다.
- 같은 원장과 같은 review 입력에서 digest의 `drive_record`가 snapshot의 `drive_record`와 deepStrictEqual이다.
- 같은 입력·문턱으로 스크립트를 두 번 돌리면 stdout 바이트가 같다.
- task 수가 1과 4인 snapshot 두 개에서 `--sweep direct_max_commit_tasks=1,5`의 `direct_eligible_drives`가 1과 2다.
- verify: `node scripts/verify-drive-records.js`

#### Current behavior

- 원장 삭제: `finalize.ts:463`의 `git worktree remove --force`가 integration worktree와 그 안의 원장을 지운다. 그 전에 `finalize-release-main.ts:583-588`이 `saveMetricsSnapshot`으로 worker 토큰만 보존한다. 기본 구현은 `saveMetricsSnapshotDefault`(`:77-91`)이고, partial merge 경로(`:475`)도 같은 저장을 부른다. 다른 호출자는 `bouncer metrics snapshot`(`cli-metrics-command.ts:105-115`)이다.
- snapshot 구조:
  - 타입은 `drive-metrics.ts:579-582` `WorkerSnapshotFile = { version: 1; blueprint; recorded_at; ledger_sha256; worker_tokens }`다.
  - 경로는 `workerSnapshotPath`(`:593-596`)가 정하는 `<common dir>/bouncer/metrics-snapshots/<sha256(blueprint)>.json`이다.
  - `isWorkerSnapshotFile`(`:666-674`)은 위 키만 검사한다.
  - 같은 원장 hash면 다시 쓰지 않는다(`saveWorkerSnapshot` `:741-799`).
- digest: `finalize-digest.ts:181-183`이 `drive`·`warnings`·`drive_issues`만 붙인다. `summarizeDriveIssues`(`finalize-digest-model.ts:684-709`)는 카운터 여섯 개뿐이다.
- blueprint 리뷰 판독: digest는 `readReview(<checkout>/<bp>/review.md)`(`finalize-digest-collect.ts:98-127`, 부재·파싱 실패면 `null`)를 쓰고, 그 findings가 `blueprint_review`(`finalize-digest.ts:123-135`)가 된다. finding status 어휘는 `resolved|accepted|deferred|open`이다(`cli-review-command.ts:85`).
- 원장 결정 모양:
  - repair: `execution-contracts.ts:84-96`. `failure.findings`가 있으면 리뷰 원인이다.
  - 범위 개정: `kind: 'scope'`(`scope.ts:1084`)
  - fan-in 충돌 revoke: `kind: 'revoke', reason: 'fanin-conflict'`(`lease.ts:17-25`)
  - reviewer 디스패치: `kind: 'worker-model', role: 'reviewer'`(`coordinator-commands.ts:101-104`)
  - `record`: `kind` 없이 `{ task, decision }`(`coordinator-commands.ts:1243`)
- 세션 비용·tier: `.bouncer/runtime/drive-metrics.json`(`metricsFilePath` `drive-metrics.ts:77`)은 정리 뒤에도 남는다. 세션마다 `kind`·`blueprint`·`tier`·`effort`·토큰·`cost`를 담는다(`:34-65`).
- 집계: `scripts/`에 실행 기록 집계 스크립트가 없다. `benchmarks/`에 ablation 문서가 없다.
- explain.md에는 실행 기록을 싣지 않는다(`skills/bouncer-finalize/references/explain-quiz.md:11`).
- 재현: `npm run build && node --test test/cli-metrics.test.js test/finalize-release-main.test.js test/finalize-digest.test.js`가 현재 통과한다.

#### Target behavior

- 성공:
  - snapshot 저장:
    - `saveWorkerSnapshot`이 새 snapshot을 쓸 때 `drive_record: summarizeDriveRecord(ledger, review ?? null)`를 싣는다.
    - release-main의 호출부(`finalize-release-main.ts:475`와 `:587`의 `d.saveMetricsSnapshot(...)`)가 저장 전에 `review = reviewRecordFrom(readReview(<root>/<bp>/review.md)?.findings ?? null, <bp>/index.md의 bouncer.review_contract)`를 계산한다. 그 값을 seam 인자 `{ repoRoot, blueprint, review }`로 넘긴다. 기본 구현 `saveMetricsSnapshotDefault`는 받은 `review`를 `saveWorkerSnapshot`에 그대로 넘긴다. 그래서 seam을 주입한 테스트가 `args.review`를 단언할 수 있다.
    - `bouncer metrics snapshot`은 review를 넘기지 않아 `review: null`로 저장한다.
  - digest: blueprint review 모드면 `blueprint_review.findings`와 index `review_contract`로 같은 `reviewRecordFrom`을 부른다. 아니면 `review`가 `null`이다. 그 결과로 `drive_record: summarizeDriveRecord(ledger, review)`를 싣고, 원장이 없으면 `drive_record: null`이다.
  - 스크립트: 아래 출력 모양을 stdout에 쓰고 exit 0이다.
- 실패와 경계:
  - snapshot 판독: `drive_record` 키가 있는데 `isDriveRecord`를 통과하지 못하면 `metrics-snapshot-invalid`이다. 모양은 Interface의 모든 키와 타입이다.
  - review 요약: review.md가 없거나 파싱되지 않으면(`readReview` → `null`) `review: null`이다. 저장은 계속한다.
  - 오래된 snapshot: 같은 원장 hash의 기존 snapshot은 `drive_record`가 없어도 다시 쓰지 않는다. 지금의 `reused: true` 규칙 그대로다. partial merge에서 저장된 snapshot도 같다.
  - 스크립트 입력(건너뛰고 계속):
    - 깨진 JSON → `skipped[]`의 `{ path, reason: 'invalid-json' }`
    - snapshot 모양이 아니거나 `drive_record` 모양이 틀림 → `'not-snapshot'`
    - `drive_record` 키가 없음 → `'no-drive-record'`
    - 건너뛴 파일은 `totals`에 들어가지 않는다.
  - 스크립트 즉시 실패:
    - 존재하지 않는 `--input` 경로 → stderr `input-not-found: <path>`와 exit 1
    - 명시한 `--sessions` 파일이 없거나 깨진 JSON → exit 1
    - 기본 세션 파일이 없음 → 빈 세션으로 계속
    - 기본 세션 파일이 깨진 JSON → exit 1
    - `--input`이 없는데 `git rev-parse --git-common-dir` 실패 → exit 1
    - 알 수 없는 문턱 키 → exit 2
    - 범위를 벗어난 값 → exit 2. `max_parallel`은 1 이상 정수, 나머지 키는 0 이상 정수다. 소수·음수·문자는 범위 밖이다. `--sweep` 값마다 같은 규칙을 쓴다.
    - `--sweep` 두 번 → exit 2
  - `--input` 해석:
    - 파일 경로는 확장자와 무관하게 그 파일 하나다.
    - 디렉터리 경로는 그 디렉터리 바로 아래(비재귀)의 이름이 `.json`으로 끝나고 `lstat`이 일반 파일인 항목만이다. 하위 디렉터리, symlink, `.json`이 아닌 파일은 목록에 넣지 않는다(`skipped`에도 넣지 않는다).
    - 같은 실제 경로가 여러 번 오면 한 번만 읽는다.
    - 출력의 `path`는 cwd 기준 POSIX 상대 경로다. `inputs`와 `skipped`는 `path` 사전순이다.
- 보존: `drive_issues`·`worker_tokens`·`ledger_sha256` 재사용 규칙과 거절 코드, snapshot `version: 1`, PR draft(`buildPrDraft` 입력)는 그대로다.

#### Interface

- 제공:

```ts
// drive-metrics.ts·finalize-release-main.ts의 바뀌는 seam
saveWorkerSnapshot(opts: { commonGitDir; ledgerFile; blueprint; fs?; now?; review?: DriveRecordReview | null });
ReleaseMainDeps.saveMetricsSnapshot: (args: { repoRoot: string; blueprint: string;
  review: DriveRecordReview | null }) => { ok: boolean; reason?: string };
// packages/cli/src/drive-record.ts — I/O 없는 순수 함수
type DriveRecordReview = { contract: string | null;
  must_fix: { total: number; resolved: number; accepted: number; deferred: number; open: number } };
type DriveRecord = {
  tasks: number; decision_kinds: Record<string, number>; scope_revisions: number;
  unexpected_paths: number; overlaps: number; conflicts: { fanin: number };
  repair_waves: { ci: number; review: number };
  reviewer: { dispatches: number; perspectives: string[]; models: string[] };
  baseline: { command: string; exit: number; accepted: boolean } | null;
  review: DriveRecordReview | null;
};
function summarizeDriveRecord(ledger: unknown, review: DriveRecordReview | null): DriveRecord;
function reviewRecordFrom(findings: Finding[] | null, contract: unknown): DriveRecordReview | null;
function isDriveRecord(value: unknown): value is DriveRecord;
```

  - `summarizeDriveRecord` 셈 규칙:
    - `tasks`: `execution_kind !== 'verification'`인 원장 task 수
    - `decision_kinds`: `ledger.decisions` 원소의 `kind`별 수. kind가 없으면 `unknown`
    - `scope_revisions`: `kind === 'scope'` 수
    - `unexpected_paths`: report 결정 `unexpected_paths` 길이와 repair 결정 `unexpected_paths` 길이의 합
    - `overlaps`: report 결정 `overlaps` 길이의 합
    - `conflicts.fanin`: `kind === 'revoke' && reason === 'fanin-conflict'` 수
    - `repair_waves`: repair 결정의 고유 `wave` 수. `failure.findings`가 비었거나 없으면 `ci`, 있으면 `review`
    - `reviewer`: `kind === 'worker-model' && role === 'reviewer'` 수와 고유 `perspective`·`model`의 사전순 배열
    - `baseline`: 순서상 마지막 `kind === 'baseline'` 결정. 없으면 `null`
  - 예: decisions `[{kind:'repair',wave:1,failure:{findings:[]}},{kind:'repair',wave:1,failure:{findings:[]}},{kind:'repair',wave:2,failure:{findings:['F1']}}]` → `repair_waves = { ci: 1, review: 1 }`.
  - `reviewRecordFrom` 셈 규칙:
    - `findings`가 `null`이면 `null`을 돌려준다.
    - `actionability === 'must_fix'`인 finding을 id 기준으로 처음 등장한 것만 센다.
    - `total`은 그 수이고, 각 status 키는 status가 같은 수다. 네 어휘 밖의 status는 `total`에만 들어간다.
    - `contract`는 인자가 문자열이면 그 값, 아니면(표식 없음) `null`이다.
    - 예: `[{id:'F1',actionability:'must_fix',status:'deferred'},{id:'F1',actionability:'must_fix',status:'open'},{id:'F2',actionability:'must_fix',status:'resolved'},{id:'F3',status:'open'}]`, contract `'brief'` → `{ contract: 'brief', must_fix: { total: 2, resolved: 1, accepted: 0, deferred: 1, open: 0 } }`.
  - CLI 형식: `node scripts/measure-drive-records.js [--input <file|dir>]... [--sessions <file>] [--threshold k=n]... [--sweep k=n,n...]`
    - 입력 기본값: `<git common dir>/bouncer/metrics-snapshots/`
    - 세션 기본값: `<repo>/.bouncer/runtime/drive-metrics.json`
    - 문턱 키와 기본값: `direct_max_commit_tasks=3`(`config.ts:43`), `max_parallel=2`(`config.ts:35`), `ci_repair_wave_alert=1`, `unexpected_path_alert=1`

```text
{ version: 1, inputs: [{ path, sha256 }], skipped: [{ path, reason }],
  thresholds: { <key>: n },
  totals: { drives, tasks, scope_revisions, unexpected_paths, overlaps, fanin_conflicts,
            ci_repair_waves, review_repair_waves, worker_tokens, session_tokens, cost },
  threshold_effects: { direct_eligible_drives, wave_estimate, ci_repair_alert_drives,
                       unexpected_path_alert_drives },
  sweep?: [{ key, value, threshold_effects }] }
```

  - `totals` 계산:
    - `worker_tokens`: snapshot `worker_tokens.total`의 합
    - `session_tokens`·`cost`: 세션 중 `blueprint`가 집계된 snapshot의 blueprint와 같은 것의 토큰(입력+출력+캐시 읽기+캐시 쓰기)과 `cost`의 합. 없는 값은 0
  - `threshold_effects` 계산:
    - `direct_eligible_drives`: `tasks <= direct_max_commit_tasks`인 drive 수
    - `wave_estimate`: drive마다 `ceil(tasks / max_parallel)`의 합
    - 두 alert: 해당 수가 문턱 이상인 drive 수
  - 결정성: `inputs`는 경로 사전순이고 출력에 현재 시각이 없다.
- 거부:
  - throw하지 않는 입력: 원장이 `null`이거나 `decisions`가 배열이 아니면 모든 수가 0이고 `baseline: null`이다.
  - 즉시 실패와 건너뜀은 Target behavior의 목록이다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/drive-record.ts` | `summarizeDriveRecord`, `reviewRecordFrom`, `isDriveRecord` | Create | 없음 | 원장·리뷰 → `DriveRecord` 순수 계산과 모양 검사 | snapshot·digest 공통 계산, cycle 회피용 하위 모듈 |
| `packages/cli/src/drive-metrics.ts` | `saveWorkerSnapshot`, `isWorkerSnapshotFile`, `WorkerSnapshotFile` | Modify | worker 토큰 snapshot(`:579-799`) | `drive_record` 저장·검사, 선택 `review` 인자 | 정리 전 보존 지점. `cli-metrics-command.ts:113` 호출은 인자 없이 그대로 |
| `packages/cli/src/finalize-release-main.ts` | `saveMetricsSnapshotDefault`, `ReleaseMainDeps.saveMetricsSnapshot` | Modify | 정리 전 snapshot 저장(`:77-91`, `:475`, `:587`) | review 요약 계산·전달 | 원장 삭제 직전 호출 지점 |
| `packages/cli/src/finalize-digest.ts` | `prepareFinalizeDigest` | Modify | `drive`·`drive_issues` 부착(`:181-183`) | `drive_record` 부착 | digest 보존 요구 |
| `packages/cli/src/finalize-digest-model.ts` | `FinalizeDigest`(`:99-`) | Modify | digest 타입 | `drive_record: DriveRecord \| null` | digest 타입 계약 |
| `scripts/measure-drive-records.js` | 신규 추출 지점: 집계 CLI와 `aggregate()` | Create | 없음 | 위 출력 모양 | 문턱 재현 집계 |
| `scripts/verify-drive-records.js` | 단계 실행기 | Create | 없음 | Checklist 단계 | task 전용 verify |
| `test/drive-record.test.js` | 신규 | Create | 없음 | 셈 규칙·모양 검사 단위 테스트 | Interface 고정 |
| `test/measure-drive-records.test.js` | 신규 | Create | 없음 | CLI 재현·sweep·skipped·exit 코드 | 스크립트 계약 |
| `test/cli-metrics.test.js` | snapshot 테스트(`:679-760`) | Modify | snapshot 저장·재사용 | `drive_record` 저장·호환·invalid 단언 | snapshot 모양 소비자 |
| `test/finalize-release-main.test.js` | `:780` 근처 | Modify | 정리 전 저장 | 저장 인자 review 단언 | seam 모양 소비자 |
| `test/finalize-digest.test.js` | `:400`, `:411` 근처 | Modify | digest 원장 통계 | `drive_record` 단언, snapshot과 같음 단언 | digest 모양 소비자 |
| `test/tiers.json` | `unit`·`integration` | Modify | 테스트 tier 등록 | 새 두 테스트 등록 | `test/test-tiers.test.js:30` |
| `benchmarks/ablation/README.md` | 신규 | Create | 없음 | 정기 ablation·진입 표면 전후 비교 절차 | 측정·평가 범위 |
| `benchmarks/README.md` | 디렉터리 목록(`:6-30`) | Modify | benchmark 구조 안내 | ablation 문서와 집계 스크립트 안내 | 문서 발견 경로 |

#### Constraints

- `drive-record.ts`는 파일·git을 읽지 않고 입력 객체를 바꾸지 않는다. `test/finalize-digest.test.js:348` 바이트 보존 단언을 유지한다.
- `drive-record.ts`는 `drive-metrics`·`finalize-*`·`coordinator*`를 import하지 않는다. `Finding`은 type import만 쓴다.
- 기존 단언은 바꾸지 않고 단언을 더한다. 계획 시점에 snapshot 파일 전체를 `deepStrictEqual`로 비교하는 기존 단언은 없다. `test/cli-metrics.test.js:943`은 `recorded_at` 필드 하나만 본다. 그래서 기존 기대값을 바꿀 일이 없다.
- 스크립트는 Node 표준 모듈만 쓰고 `packages/cli/dist`를 require하지 않는다. 출력은 `JSON.stringify(value, null, 2) + '\n'`이다.
- 002·003이 통합되지 않아도 이 task의 테스트는 직접 만든 원장 fixture로 새 필드(`unexpected_paths`·`overlaps`·`baseline`)를 덮는다.

### plugin-surface-slimming/measure-scope-env-surface/002 · `1f3f7838`

#### Goal & intent

coordinator 원장 mode가 `full`인 drive에서는 task의 ledger scope 밖 경로를 막지 않는다. 막는 것은 금지선과 겹칠 때뿐이다. 금지선은 integration checkout에 있는 task 문서의 `## Do not touch`이고, worker는 이 사본을 쓰지 않는다. 금지선을 읽지 못하면 막는다(fail closed). worker는 이탈한 경로마다 보고에 이유를 적고, `coordinate report`가 그 이유를 원장에 남긴다. final-review repair의 새 경로는 원장 모든 task의 금지선 합집합으로 거른다. 그래서 다른 task의 Do not touch도 repair를 막는다. light 원장과 coordinator 없는 commit은 지금과 같다. 병렬 충돌의 감지 시점과 회복 절차는 `rules/commit-scope.md`와 coordinator 역할 문서에 적는다.

수용 기준:
- full 원장 worker의 commit: scope 밖이고 금지선 밖이면 통과하고 결과에 `unexpected_paths`가 있다. 금지선과 겹치면 `scope-do-not-touch-violation`이다. 금지선을 못 읽으면 `scope-do-not-touch-unreadable`이다. light와 standalone은 `out-of-scope` 그대로다.
- 호스트 hook(`evaluateCommit`)과 CLI commit의 허용·거절이 같다. 새 두 code는 commit-scope composite gate에 속한다.
- accepted report:
  - scope 밖 커밋 경로의 이유가 없거나 비었거나 200자를 넘으면 `unexpected-path-reason-missing`이다.
  - 이유가 맞으면 `ReportDecision.unexpected_paths`에 저장된다.
  - 다른 미통합 task scope와 겹치면 `overlaps`가 남는다.
  - 이탈 경로가 없으면 새 키가 없다.
- brief 계약 final-review repair: `--new-path`가 금지선 합집합 밖이면 접수되고 repair 결정 `unexpected_paths`에 남는다. 안이면 `final-review-repair-do-not-touch`다. 문서 어디에도 `final-review-repair-scope`가 남지 않는다.
- verify: `node scripts/verify-expected-paths.js`

#### Current behavior

- `commit-guard.ts:35-88` `checkCommitSafety`는 verification task(`:53-55`), 경계 위반(`coordinator.reason`, `:59-61`), scope 밖(`:64-71`, `out-of-scope`), cross-drive(`:72-86`) 순서로 판정한다. cross-drive 후보는 scope를 통과한 후보 전체다. scope는 coordinator 활성이면 ledger scope, 아니면 승인 `affected_paths`다.
- 호출자는 둘이다. `commit.ts:456-470`은 거절을 `recoveryFor`(`:296-308`, coordinator면 `coordinator-revise`)로 감싼다. `commit-hook.ts:440`은 호스트 commit 가드다. 거절 문구 접두는 `gateLabelPrefix`(`commit-hook.ts:389-392`)가 `composite-gates.ts:62-69` commit-scope reason 목록으로 만든다. 그 목록은 `test/composite-gates.test.js:30-31`이 고정한다. `test/commit-hook.test.js:100`이 hook과 CLI 판정 일치를 고정한다.
- `scope.ts:561-` `coordinatorContext`는 `CoordinatorContext`(`:132-146`)를 돌려준다. 여기에는 `integrationPath`는 있지만 원장 mode와 Do not touch가 없다. revision 판독 `docScopeRevision`(`:428-445`)은 문서를 못 읽으면 `null`을 돌려 `stale-revision`으로 막는다(fail closed 선례).
- Do not touch는 task 본문에서 `doNotTouchLines`(`scope.ts:850-868`)로 읽고 `coordinate revise`에서만 쓴다(`planDoNotTouchRelease` `:905-932`).
- 해제(`--release-do-not-touch`)는 revise를 실행한 cwd의 task 문서를 고친다. `cli-git-commands.ts:741`의 `reviseRoot = process.cwd()`, `scope.ts:1010`의 `taskDocPath(repoRoot, ...)`, `scope.ts:1079`가 그 경로다. 원장 scope 결정에는 `releasedDoNotTouch`가 남는다(`scope.ts:1081-1083`). coordinator는 integration checkout에서 revise를 실행한다.
- 원장 mode는 `ledgerModeOf`(`coordinator-ledger.ts:412`)가 정한다.
- report:
  - `coordinateReport`(`coordinator-commands.ts:1108-1185`)는 full이면 `checkReportFile`(`:271-306`)로 보고 파일의 Brief revision·Open choices·Known weaknesses를 검사한다. accepted면 `workerCommitEvidence`를 본다.
  - worker 커밋의 scope 밖 경로는 보지 않는다. dispatch는 `base_head`를 남긴다(`:1056-1080`).
  - 타입은 `ReportDecision`이 `coordinator-commands.ts:127`에, `RepairDecision`이 `execution-contracts.ts:84-96`에 있다.
- final-review repair:
  - `finalReviewGate`(`coordinator-repair.ts:286-302`)는 brief 계약 첫 review repair가 `newPaths`를 가지면 `final-review-repair-scope`로 거절한다. 메시지는 `coordinator-commands.ts:1902-1907`에, 거절 표 필수 행은 `doc-shape-contracts.ts:137`에 있다.
  - 이 reason의 소비자: `rules/cli.md:668`, `references/coordinator-cards/final_review.md:75`, `skills/bouncer-run/references/review-round.md:93`, `test/coordinator.test.js:5162-5166`, `test/doc-shape-cli.test.js:273`·`:291`·`:300`.
- report 카드 `references/coordinator-cards/report.md:13-14`는 accepted 전 확인 항목을 "scope (Changed files inside the approved paths)"로 적는다.
- fan-in cherry-pick 충돌은 `coordinator-fanin.ts:830-853`에서 그 task만 `revokeLease(reason: 'fanin-conflict')`한다(`test/coordinator-e2e.test.js:406`). 이 계약을 정리한 규칙 문서는 없다.
- 고정 테스트: `test/commit-guard.test.js:19`(standalone 범위 밖 차단), `:69`(coordinator ledger scope 밖 차단), `:168`(경계·scope가 cross-drive보다 앞섬). `test/commit-task.test.js:353`·`:367`(standalone hard-abort).
- 재현: `npm run build && node --test test/commit-guard.test.js test/commit-hook.test.js test/commit-task.test.js test/composite-gates.test.js test/coordinator.test.js test/doc-shape-cli.test.js`가 현재 통과한다.

#### Target behavior

- 성공:
  - commit: `coordinator.active && !coordinator.reason && coordinator.mode === 'full'`이고 scope 밖 후보가 모두 금지선과 겹치지 않으면 `{ allow: true, violations: [], unexpected: <scope 밖 후보, 입력 순서> }`이다. cross-drive 비교는 허용된 후보 전체(scope 안 + unexpected)로 한다. `commitTask` 성공 결과에 `unexpected_paths`가 실린다. scope 밖 후보가 없으면 `unexpected` 키와 `unexpected_paths` 키가 없다.
  - report(accepted, full): 이탈 경로는 다음 명령 결과에서 고른다. worker 경로는 호출자 cwd가 아니라 원장 task의 `workerPath`이고, 명령은 `git -C <item.workerPath> diff --name-only --no-renames <item.dispatch.base_head>..HEAD`이다. rename은 옛 경로와 새 경로가 모두 후보다. 그 결과 중 runtime artifact를 빼고 ledger scope 밖인 경로다. 각 경로에 Unexpected paths 줄이 있으면 `ReportDecision.unexpected_paths = [{ path, reason }]`(경로 사전순)로 저장된다. 그 경로가 같은 drive에서 status가 `integrated`가 아닌 다른 task의 scope와 `pathsOverlap`으로 겹치면, 그 task id들이 사전순으로 `overlaps`에 저장된다. 이탈 경로가 없으면 두 키를 두지 않는다.
  - final-review repair: brief 계약 첫 repair의 `newPaths`가 원장 모든 task의 금지선 합집합과 겹치지 않으면 접수된다. repair 결정에 `unexpected_paths: newPaths`(입력 순서)가 남는다.
- 실패:
  - commit(full): scope 밖 후보가 금지선과 겹치면 `{ allow: false, code: 'scope-do-not-touch-violation', violations: <겹친 후보> }`이다. scope 밖 후보가 있는데 금지선을 못 읽으면 `{ allow: false, code: 'scope-do-not-touch-unreadable', violations: <scope 밖 후보> }`이다. 둘 다 `recoveryFor`에서 `coordinator-revise`다. detail은 "금지선은 사용자 승인 뒤 integration checkout에서 `coordinate revise --release-do-not-touch`로만 푼다"이다.
  - report(accepted, full): 이유 줄이 없거나 이유가 trim 뒤 비었거나 200자를 넘는 경로가 있으면 `{ ok: false, reason: 'unexpected-path-reason-missing', paths }`이다. 커밋 경로가 금지선과 겹치면(hook을 우회한 커밋) `scope-do-not-touch-violation`, 금지선을 못 읽으면 `scope-do-not-touch-unreadable`이다. 모두 원장 bytes를 바꾸지 않는다.
  - final-review repair: `newPaths`가 금지선 합집합과 겹치면 `final-review-repair-do-not-touch`, 어느 task 문서든 못 읽으면 `scope-do-not-touch-unreadable`이다.
- 보존:
  - light 원장, coordinator 없는 commit, verification task, 경계 위반, cross-drive 판정과 그 순서는 같다. 판정 순서는 verification → 경계 → 금지선(읽기 실패 포함) → scope 밖 기록 → cross-drive다.
  - 금지선 검사 대상은 commit과 report 모두 ledger scope 밖 후보뿐이다. scope 안 경로는 금지선 검사 대상이 아니다. 계획 규칙상 Do not touch는 `affected_paths`와 겹치지 않는다(`references/spec-authoring/index.md`의 Do not touch 규칙). 실행 중 scope를 넓힐 때는 revise가 겹치는 새 경로를 `scope-do-not-touch-conflict`로 거절한다(`scope.ts:905-932`). 그래서 scope 안 후보만 있는 commit·report는 금지선 읽기 실패의 영향을 받지 않는다. 구현은 금지선을 scope 밖 후보가 있을 때만 읽는다(지연 판독).
  - G17(`validate-gates-run.ts:429-469`)은 바뀌지 않는다. commit gate는 staging 전에 돈다(`commit.ts:406`).
  - `final-review-single-round`, `repair-scope-out-of-bounds`, supplement의 테스트 경로 제한은 그대로다.
  - rework·blocked report는 지금과 같다.

#### Interface

- 제공:

```ts
// scope.ts — 금지선의 단일 출처. worker 사본이 아니라 integration checkout 사본을 읽는다.
function doNotTouchFor(integrationPath: string, blueprint: string, taskId: string):
  { ok: true; paths: string[] } | { ok: false };   // 문서 부재·YAML 파손·읽기 오류 = ok:false
type CoordinatorContext = { /* 기존 필드 */ mode: 'full' | 'light' | null;
  doNotTouch: string[] | null };                    // null = 읽기 실패(full에서 fail closed)
// commit-guard.ts
checkCommitSafety(...): { allow: boolean; violations: unknown[]; code?: string;
  unexpected?: string[]; conflicts?: ...; ledgerFile?: string };
// coordinator-commands.ts / execution-contracts.ts
ReportDecision.unexpected_paths?: Array<{ path: string; reason: string }>; ReportDecision.overlaps?: string[];
RepairDecision.unexpected_paths?: string[];
```

  - `doNotTouchFor`는 `<integrationPath>/<blueprint>/tasks/<taskId>/tasks.md` 본문의 `doNotTouchLines` 토큰을 `normalizeScopeEntry`로 정규화하고, 중복을 빼고, 입력 순서로 돌려준다. 절이 없으면 `{ ok: true, paths: [] }`다. commit guard(`coordinatorContext`), report 판정, final-review 판정이 모두 이 함수만 쓴다. `coordinatorContext.doNotTouch`는 full mode에서 scope 밖 후보 판정이 필요할 때 채워지는 값이다(지연 판독).
  - 겹침 규칙(세 판정 공통): `pathsOverlap(normalizeScopeEntry(token), normalizeScopeEntry(path))`이다(`path-overlap.ts`, 같거나 한쪽이 세그먼트 단위 조상). 슬래시 없는 토큰도 디렉터리 접두로 맞는다. 예: 토큰 `agents`는 `agents/bouncer-x.md`·`agents`와 겹치고 `agents-extra/a.md`와 겹치지 않는다. 토큰 `.codex/agents`는 `.codex/agents/a.toml`과 겹친다. 정확 일치만 보거나 문자열 접두로 보지 않는다.
  - `mode`는 원장을 읽은 활성 context에서 `ledgerModeOf` 값이고, 비활성이면 `null`이다. `doNotTouch`는 mode가 `full`일 때만 채운다. light와 비활성은 `[]`다.
  - 해제는 `coordinate revise --release-do-not-touch`가 revise cwd의 문서를 고치는 지금 동작 그대로다. coordinator 절차상 cwd는 integration checkout이라 정본 사본이 고쳐진다. 다른 cwd에서 해제하면 정본은 그대로이고 차단이 남는다(fail closed). 역할 문서에 이 점을 적는다.
  - 도메인 용어 "Unexpected paths 줄": `## Unexpected paths` 절 안의 `^- \`(?<path>[^\`]+)\` — (?<reason>.+)$` 줄이다. 예: ``- `test/fixtures/a.json` — 바뀐 출력 문구를 고정하는 fixture``. 경로는 `toPosix`·앞 `./` 제거로 비교한다. reason은 worker가 쓴 데이터로 저장만 하고, 판정·명령에 쓰지 않는다.
  - 새 reason: `scope-do-not-touch-violation`, `scope-do-not-touch-unreadable`, `unexpected-path-reason-missing`, `final-review-repair-do-not-touch`. 각각 `coordinator-commands.ts` 실패 힌트 표에 cause·next를 둔다. 앞의 두 code는 `composite-gates.ts` commit-scope reason 목록에 넣는다. `final-review-repair-scope` 항목은 힌트 표와 문서에서 지운다.
- 거부:
  - 즉시 거절: 위 네 reason.
  - 무시: 커밋되지 않은 경로만 적힌 Unexpected paths 줄은 저장하지 않고 거절하지도 않는다.
  - fail closed: 금지선 읽기 실패는 허용으로 바꾸지 않는다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/commit-guard.ts` | `checkCommitSafety` | Modify | 범위·경계·cross-drive 판정(`:35-88`) | full mode 금지선·이탈 기록 분기 | 정책 단일 구현(hook·CLI 공통) |
| `packages/cli/src/scope.ts` | `coordinatorContext`, `CoordinatorContext`, 신규 `doNotTouchFor` | Modify | context 계산(`:132-146`, `:561-`), Do not touch 파싱(`:850`) | `mode`·`doNotTouch`와 integration 사본 판독 | 금지선 단일 출처 |
| `packages/cli/src/commit.ts` | `commitTask`, `recoveryFor` | Modify | commit 결과·복구(`:296-308`, `:456-470`) | 성공 `unexpected_paths`, 새 code 복구 | 공개 commit 출력 |
| `packages/cli/src/composite-gates.ts` | commit-scope `reasons`(`:65-68`) | Modify | 거절 code → composite gate | 새 code 두 개 추가 | hook 거절 접두(`commit-hook.ts:389`) |
| `packages/cli/src/execution-contracts.ts` | `RepairDecision`(`:84-96`) | Modify | repair 결정 타입 | `unexpected_paths?` | 공유 타입 |
| `packages/cli/src/coordinator-commands.ts` | `coordinateReport`, `parseReportFile`, `ReportDecision`(`:127`), 실패 힌트 표(`:1885-1925`) | Modify | report 수락·보고 파싱 | 이탈 이유 검사·저장, overlaps, 힌트 넷 추가·하나 삭제 | report 시점 기록 |
| `packages/cli/src/coordinator-repair.ts` | `finalReviewGate`, repair 결정 작성(`:1176-1227`) | Modify | 새 경로 거절(`:299`) | 금지선 합집합 판정, 결정 `unexpected_paths` | final-review repair 정책 |
| `packages/cli/src/doc-shape-contracts.ts` | `rules/cli.md` rejectionTable(`:137`) | Modify | 필수 행 `final-review-repair-scope` | `final-review-repair-do-not-touch`로 교체 | 거절 표 계약 |
| `rules/commit-scope.md` | `## Approved and ledger scope` | Modify | 승인·ledger scope(`:32-55`) | 세 층 정책, 금지선 출처와 fail closed, full/light/standalone 차이, 충돌 감지 세 시점과 회복 | 정책 정본 |
| `rules/cli.md` | commit 결과, `coordinate report`, repair 거절 표(`:668`) | Modify | CLI 계약 | `unexpected_paths`, 새 reason, 표 행 교체 | 공개 CLI 문서 |
| `agents/bouncer-implementer.md` | `## Hard guards`(`:57`), `## Scope`(`:71-85`), `## Output contract`(`:217`) | Modify | 범위 밖 편집 금지 | full drive에선 금지선 밖 이탈을 `## Unexpected paths`로 보고, 금지선이 필요하면 Scope impact로 멈춤 | worker 보고 계약 |
| `.codex/agents/bouncer-implementer.toml` | 생성본 | Modify | md 생성본 | 재생성 | `scripts/check-emit.js:91-129` |
| `agents/bouncer-coordinator.md` | `## Task round`(`:146-149`), `## Procedure`(`:307-309`, `:344`) | Modify | revoke·fan-in 충돌·해제 처리 | `overlaps` 처리와 회복 순서, 해제는 사용자 승인 뒤 integration cwd에서 | coordinator 계약 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | md 생성본 | 재생성 | `test/distribution.test.js:247` |
| `references/coordinator-cards/final_review.md` | `:75` | Modify | 새 경로 거절 안내 | 새 reason과 기록 동작 | reason 소비 문서 |
| `references/coordinator-cards/report.md` | `:13-14` | Modify | accepted 전 확인 | scope 항목을 "금지선 밖, 이탈 경로마다 이유" 기준으로 | report 판단 카드 |
| `skills/bouncer-run/references/review-round.md` | `:93` | Modify | 새 경로 거절 서술 | 새 reason | reason 소비 문서 |
| `scripts/verify-expected-paths.js` | 단계 실행기 | Create | 없음 | Checklist 마지막 전 항목의 단계 | task 전용 verify |
| `test/commit-guard.test.js` | `:69` 외 신규 | Modify | 판정 단위 테스트 | full·light·standalone 분기, 순서, fail closed | 정책 고정 |
| `test/commit-hook.test.js` | `:100` 외 신규 | Modify | hook·CLI 일치 | full 원장 이탈·금지선 일치 사례 | 두 호출자 일치 |
| `test/commit-task.test.js` | 신규 | Modify | commit CLI | 성공 `unexpected_paths`, 새 code 복구 | 공개 출력 |
| `test/composite-gates.test.js` | `:30-31` | Modify | commit-scope reason 목록 | 새 code 두 개 | 목록 고정 소비자 |
| `test/coordinator.test.js` | `:5162-5166`, `:2129` 외 신규 | Modify | report·repair 계약 | 새 reason, report·repair 사례 | reason 소비 테스트 |
| `test/doc-shape-cli.test.js` | `:273`, `:291`, `:300` | Modify | 거절 표 필수 행 | 새 reason 문자열 | 표 계약 소비자 |

#### Constraints

- 정책 분기는 `checkCommitSafety` 한 곳에만 둔다. `commit.ts`와 hook은 결과를 해석만 한다.
- 금지선은 `doNotTouchFor` 한 함수로만 읽는다. worker checkout의 task 문서를 금지선 출처로 쓰지 않는다.
- `docs/threat-model.md:10-11`의 commit guard 서술("`affected_paths`(coordinator면 원장 scope) 밖이면 거절")은 이 task에서 고치지 않는다. 이 blueprint의 affected_paths 밖이라 알려진 후속 작업으로 남긴다(blueprint Out of scope).
- 기존 단언 변경은 다음으로 한정한다.
  - `test/commit-guard.test.js:69`의 coordinator fixture는 원장 mode를 `light`로 명시해 기존 기대값(`out-of-scope`)을 유지한다.
  - `test/coordinator.test.js:5162` 테스트 이름을 "brief contract review-caused repair with newPaths inside Do not touch → final-review-repair-do-not-touch and bytes unchanged"로 바꾸고, fixture에 금지선 겹침을 더한다.
  - `test/doc-shape-cli.test.js:273`·`:291`·`:300`은 문자열 `final-review-repair-scope`를 `final-review-repair-do-not-touch`로만 바꾼다.
  - `test/composite-gates.test.js:30-31` 목록에 새 code 두 개만 더한다.
  - 그 밖의 기존 단언은 바꾸지 않는다.
- 이유 줄 검사와 overlaps 계산은 accepted outcome에만 적용한다. 거절은 원장 bytes를 바꾸지 않는다.
- `## Unexpected paths`는 implementer 보고 template의 선택 절이다. 비었으면 생략한다. template 기본 절 목록(`test/agents.test.js:306`)은 바뀌지 않는다.
- TOML 생성본은 손으로 고치지 않고 생성기로 만든다.

### plugin-surface-slimming/measure-scope-env-surface/003 · `9755cd7a`

#### Goal & intent

대상은 full drive의 commit task이고 blueprint가 `scoped_terminal`인 경우다. accepted 보고를 받을 때 `coordinate report`가 보고 `## Tests`에 task `bouncer.verify` 명령과 통과 결과가 있는지 확인한다. 지금은 fan-in에서야 확인한다.

main checkout config에 `worktree.baseline`이 있으면, 첫 `coordinate prepare`가 worker를 만들기 전에 다음을 한다.
- integration 의존성을 준비한다.
- baseline 명령을 돌린다.
- 결과를 원장에 남긴다.

baseline이 실패하면 멈춘다. 깨진 baseline은 `--accept-broken-baseline` 재실행으로만 받아들인다. build 스크립트가 있는데 `worktree.setup`이 없으면 prepare가 경고를 낸다. coverage는 worker에서 재지 않고 종단 `npm run ci`에만 둔다.

수용 기준:
- `## Tests` 판정:
  - 실패 문제 다섯 가지(`tests-section-missing`·`command-missing`·`result-missing`·`result-failed`·`task-command-missing`)가 각각 `report-tests-invalid`가 되고 원장 bytes가 그대로다.
  - 맞는 보고는 수락된다.
  - 건너뛰는 경우 네 가지는 지금처럼 수락된다.
- baseline:
  - 실패 명령이면 `baseline-ci-failed`이다. worker worktree가 없고 `accepted: false` 결정이 남는다.
  - 플래그 재실행은 `accepted: true`를 남기고 worker를 만든다.
  - 통과·수락 뒤 prepare는 다시 돌리지 않는다. 미설정이면 결정이 없다.
- 경고: `worktree-setup-unset`은 "integration `package.json`에 `scripts.build`가 있는가 = 예" 그리고 "`worktree.setup`이 설정됐는가 = 아니오"일 때만 나온다.
- verify: `node scripts/verify-early-checks.js`

#### Current behavior

- 보고 검사:
  - `testsReportProblem`(`coordinator-fanin.ts:86-135`)과 `scopedTestReportFailure`(`:137-178`)가 fan-in 직전에만 돈다.
  - `coordinateReport`(`coordinator-commands.ts:1108-1185`)는 full 모드에서 `checkReportFile`로 Brief revision·Open choices·Known weaknesses만 본다. TASKS-002 뒤에는 Unexpected paths도 본다.
  - 같은 계약이 `skills/bouncer-run/SKILL.md:81-84`("fan-in이 `worker-test-report-mismatch`로 거절")와 `references/coordinator-cards/report.md:13-15`(accepted 전 verify 확인)에 적혀 있다.
- worker 쪽: 변경 파일 eslint는 문서 규칙뿐이다(`agents/bouncer-implementer.md:143-144`). Tests 절에 지정 명령 결과를 적는 규칙은 Output contract에 있다.
- 보고 fixture helper가 `## Tests`를 넣지 않는다: `test/coordinator.test.js:87`, `test/cli-coordinate.test.js:215`, `test/coordinate-next.test.js:54`, `test/native-profile-e2e.test.js:188-192`. `test/coordinator-e2e.test.js:187-189`만 `tests` 인자를 받는다.
- 의존성:
  - worker·fan-in 후보는 `seedCoordinatorWorker`가 `npm ci`를 돌린다(`seed-worktree.ts:446-458`). 실패하면 prepare가 만든 worker를 지운다(`coordinator-prepare.ts:962-971`, `test/coordinator.test.js:1192`).
  - integration checkout은 verification integrate 직전에만 준비된다(`coordinator-commands.ts:485-491`, `prepareVerificationDependencies` `coordinator-verification.ts:22-24`).
  - `worktree.setup`은 `mainCheckoutOf(worktreePath)`의 config에서 읽는다(`seed-worktree.ts:330-345`, `docs/configuration.md:13`).
  - build는 `worktree.setup`으로만 돈다. `bouncer init`은 `scripts.build`가 있을 때 그 값을 넣는다(`init.ts:117`, `:147`).
- baseline: dispatch는 `base_head`와 porcelain만 기록한다(`coordinator-commands.ts:1056-1080`). base에서 테스트를 돌리는 명령도, 이미 깨진 base를 다루는 경로도 없다. config에는 `worktree.setup` 판독(`config.ts:197-220`)만 있다.
- prepare 구조:
  - `prepareCoordinator`(`coordinator-prepare.ts:745-`)는 잠금 안 판정(phase 1), 잠금 밖 worker 생성, 잠금 재획득 쓰기 순서다.
  - 실행기 타입은 `Exec`(`execution-contracts.ts:12`)이다. 테스트는 `coordinate({ ..., deps: { execFileSync } })`(`coordinator-command-contracts.ts:16`)로 주입하고, 그 값이 ctx `exec`(`:29`)로 `prepareCoordinator`에 간다.
  - CLI 인자는 `cli-git-commands.ts`의 `checkCommandFlags`(`:660`)·`coordinateCall`(`:826`)을 거쳐 `CoordinateArgs`(`coordinator-command-contracts.ts:6-`)가 된다. usage는 `cli-usage.ts:41`이다.
- 재현: TASKS-002 통합 뒤 `npm run build && node --test test/coordinator.test.js test/cli-coordinate.test.js test/coordinate-next.test.js test/coordinator-e2e.test.js test/native-profile-e2e.test.js`가 통과하는 상태가 기준이다.

#### Target behavior

- 성공:
  - 보고 판정: 원장 mode가 `full`이고, task `execution_kind`가 commit이고, blueprint `verification_policy`가 `scoped_terminal`이고, outcome이 `accepted`일 때 적용한다. `coordinateReport`가 그 task 하나에 `scopedTestReportFailure({ integrationPath, blueprint, items: [item], light: false })`를 적용하고, 통과하면 지금과 같이 기록한다.
  - baseline 대상 판정: config 출처는 `worktree.setup`과 같은 `mainCheckoutOf(integrationPath)`의 `.bouncer/config.json`이다. main checkout이나 config를 못 찾으면 미설정과 같다.
  - baseline 실행: 설정이 있고 `baselineNeeded(ledger)`가 참이면 worker를 만들기 전에 다음 순서로 한다.
    1. `prepareVerificationDependencies(integrationPath, exec)`
    2. 잠금 밖에서 baseline argv를 integration cwd에서 `runBaseline`으로 실행
    3. 잠금을 다시 잡아 `BaselineDecision`을 `ledger.decisions` 끝에 더함
  - baseline 결과 처리:
    - exit 0이면 `accepted: false, exit: 0`을 남기고 진행한다.
    - 실패했는데 `--accept-broken-baseline`이 있으면 `accepted: true`를 남기고 진행한다. 플래그 재실행도 baseline을 다시 돌리고, 그 실행의 exit·head를 기록한다. 이전 실패 결과를 그대로 수락하는 것이 아니다.
  - `baselineNeeded(ledger)`는 `kind === 'baseline'`이면서 `exit === 0` 또는 `accepted === true`인 결정이 하나도 없을 때만 참이다. 참이 아니면 baseline을 돌리지 않고 결정도 더하지 않는다.
  - 결정은 append-only다. TASKS-001이 요약하는 baseline은 `ledger.decisions` 순서상 마지막 `kind === 'baseline'` 결정이다.
  - 경고: `warnings`에 `{ kind: 'worktree-setup-unset' }`이 들어가는 조건은 둘 다 맞을 때뿐이다. "integration `package.json`에 `scripts.build`가 있는가 = 예", "`worktree.setup`이 설정됐는가 = 아니오". 그 밖에는 `warnings: []`다.
- 플래그 경계:
  - baseline 미설정 + `--accept-broken-baseline`: 플래그를 무시한다. 결정도 오류도 없다.
  - baseline 통과 + 플래그: `exit: 0, accepted: false`를 남긴다. 플래그는 효과가 없다.
  - 이미 통과·수락된 baseline + 플래그: 실행도 결정도 없다.
- 실패:
  - 보고 판정 실패는 `{ ok: false, reason: 'report-tests-invalid', problem, expected_command }`다. 원장 bytes는 그대로다.
  - baseline이 0이 아닌 exit이고 플래그가 없으면 `{ ok: false, reason: 'baseline-ci-failed', command, exit }`이다. `accepted: false` 결정은 남고 worker는 만들지 않는다. 같은 상태에서 다시 prepare하면 다시 실행하고 결정을 하나 더 남긴다.
  - `runBaseline`의 exit 값:
    - 정상 종료: 그 exit 코드
    - 시간 초과(30분, `timeout: 1_800_000`)나 신호 종료: `124`
    - 실행 파일을 못 띄움(`ENOENT` 등 spawn 오류): `127`
    - 어느 경우든 throw하지 않는다.
  - 의존성 준비 실패는 `dependency-install-failed`이다. baseline 결정을 남기지 않고 worker를 만들지 않는다.
  - `worktree.baseline`이 문자열이 아니거나 허용 목록 밖 단일 명령이 아니면 `{ ok: false, reason: 'baseline-config-invalid' }`이다. 아무것도 실행하지 않는다.
  - phase 2 재확인(`recheckLedgerCheckpoint`)이 실패하면 그 거절 reason을 그대로 돌려준다. baseline 결정은 쓰지 않는다.
- 조용히 건너뜀(지금 동작 유지):
  - 보고 판정: light 원장, verification task, `scoped_terminal`이 아닌 blueprint, outcome이 rework·blocked·scope_revision·task_change인 보고
  - baseline: 미설정, light 원장(baseline은 full 원장 prepare에만 적용)
- 보존: fan-in의 `scopedTestReportFailure`, `npm ci` 실패 시 worker 미생성, `worktree.setup` 출처, prepare 결과의 기존 키는 그대로다.

#### Interface

- 제공:

```ts
import type { Exec, Ledger } from './execution-contracts'; // Exec = execFileSync 모양 주입 실행기
// config.ts — readWorktreeSetup과 같은 형태 규칙
function readWorktreeBaseline(config: unknown):
  { ok: true; command: string | null } | { ok: false; reason: 'invalid' };
// coordinator-baseline.ts — BaselineDecision 타입도 여기서 export한다(execution-contracts.ts는 고치지 않음)
type BaselineDecision = { kind: 'baseline'; command: string; exit: number; head: string;
  accepted: boolean; written_at: string };
function baselineNeeded(ledger: Ledger): boolean;
function runBaseline(opts: { integrationPath: string; argv: string[]; exec: Exec }):
  { exit: number; head: string };             // throw하지 않음. head = integration rev-parse HEAD
function setupWarnings(opts: { integrationPath: string; config: unknown }):
  Array<{ kind: 'worktree-setup-unset' }>;
// coordinator-command-contracts.ts
CoordinateArgs.acceptBrokenBaseline?: boolean;
// coordinator-fanin.ts: scopedTestReportFailure export(동작 불변)
```

  - 테스트 seam: 단위 테스트는 `runBaseline`에 `exec`를 직접 넘긴다. 통합 테스트는 `coordinate({ command: 'prepare', ..., deps: { execFileSync } })`로 넘긴다. 주입 exec는 baseline argv 호출일 때 `Object.assign(new Error('x'), { status: 1 })`를 던지거나 `''`를 돌려준다. 시간 초과는 `{ code: 'ETIMEDOUT' }`나 `{ signal: 'SIGTERM' }` 오류로, spawn 실패는 `{ code: 'ENOENT' }` 오류로 흉내 낸다.
  - CLI: `bouncer coordinate prepare ... [--accept-broken-baseline]`(boolean, 값 없음). usage 문자열과 `rules/cli.md`에 플래그와 세 reason을 적는다.
  - 실패 힌트 표(`coordinator-commands.ts`)의 next:
    - `report-tests-invalid`: worker가 task verify를 다시 돌리고 Tests를 고쳐 report를 다시 낸다.
    - `baseline-ci-failed`: 사용자에게 보고한다. 사용자가 명시적으로 승인한 뒤에만 `--accept-broken-baseline`으로 prepare를 다시 돈다.
    - `baseline-config-invalid`: config를 고친다.
  - 문서:
    - implementer `## Guardrails`: report 전에 task `bouncer.verify`를 worker cwd에서 돌리고 그 명령·결과를 Tests에 적는다. accepted report는 이것이 없으면 `report-tests-invalid`로 거절된다.
    - coordinator 문서: `baseline-ci-failed` 처리. 깨진 baseline 수용은 사용자 결정이다.
    - `skills/bouncer-run/SKILL.md:81-84`: 거절 시점을 "report가 `report-tests-invalid`로, fan-in이 `worker-test-report-mismatch`로"로 고친다.
    - `references/coordinator-cards/report.md`: verify 항목에 CLI 거절 reason을 적는다.
- 거부:
  - 즉시 거절: `report-tests-invalid`, `baseline-ci-failed`, `baseline-config-invalid`, `dependency-install-failed`, phase 2 재확인 거절
  - 무시: 위 "조용히 건너뜀"과 플래그 경계의 무시 사례

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `packages/cli/src/coordinator-commands.ts` | `coordinateReport`, 실패 힌트 표 | Modify | report 수락(`:1108-1185`) | 보고 Tests 판정 호출, 힌트 세 개 | 보고 시점 검사 |
| `packages/cli/src/coordinator-command-contracts.ts` | `CoordinateArgs`(`:6-`) | Modify | coordinate 인자 타입 | `acceptBrokenBaseline?: boolean` | CLI → prepare 전달 |
| `packages/cli/src/coordinator-fanin.ts` | `scopedTestReportFailure` export | Modify | fan-in 보고 검사(`:137-178`) | export만 추가 | 판정 재사용 |
| `packages/cli/src/coordinator-prepare.ts` | `prepareCoordinator` | Modify | worker 준비(`:745-`, `:958-971`) | baseline 단계와 `warnings` | 첫 prepare 지점 |
| `packages/cli/src/coordinator-baseline.ts` | `baselineNeeded`, `runBaseline`, `setupWarnings` | Create | 없음 | baseline 판정·실행·경고 | 단위 테스트 seam |
| `packages/cli/src/config.ts` | 신규 `readWorktreeBaseline` | Modify | `readWorktreeSetup`(`:197-220`) | 같은 규칙의 baseline 판독 | config 키 |
| `packages/cli/src/cli-git-commands.ts` | `checkCommandFlags`, `coordinateCall` | Modify | coordinate 인자 검사·전달(`:660`, `:826`) | prepare 플래그 허용·전달 | CLI 플래그 |
| `packages/cli/src/cli-usage.ts` | `'prepare'` usage(`:41`) | Modify | usage 문자열 | 플래그 추가 | 공개 usage |
| `rules/cli.md` | `## Pointer, worktree, and coordinator commands` | Modify | coordinate 계약 | prepare 플래그·baseline·report 거절 | 공개 CLI 문서 |
| `docs/configuration.md` | 설정 표(`:13` 아래) | Modify | `worktree.setup` 행 | `worktree.baseline` 행(main checkout config 출처, 30분 시간 초과, 깨진 baseline 처리) | 설정 문서 |
| `agents/bouncer-implementer.md` | `## Guardrails`(`:143-144`) | Modify | 보고 전 eslint 규칙 | 보고 전 task verify 규칙 | worker 계약 |
| `.codex/agents/bouncer-implementer.toml` | 생성본 | Modify | md 생성본 | 재생성 | `scripts/check-emit.js` |
| `agents/bouncer-coordinator.md` | `## Procedure` | Modify | prepare·report 처리 | `baseline-ci-failed`·`report-tests-invalid` 처리 | coordinator 계약 |
| `.codex/agents/bouncer-coordinator.toml` | 생성본 | Modify | md 생성본 | 재생성 | `test/distribution.test.js:247` |
| `references/coordinator-cards/report.md` | `:13-15` | Modify | accepted 전 verify 확인 | CLI 거절 reason 명시 | 같은 계약 서술(TASKS-002 수정 뒤) |
| `skills/bouncer-run/SKILL.md` | `:81-84` | Modify | Tests 불일치 거절 시점 서술 | report 시점 거절 추가 | 같은 계약 서술 |
| `scripts/verify-early-checks.js` | 단계 실행기 | Create | 없음 | Checklist 단계 | task 전용 verify |
| `test/coordinator.test.js` | 보고 helper(`:87`), 신규 | Modify | report·prepare 계약 | helper 기본 Tests 절, report·baseline·경고 테스트 | 판정 고정·fixture 소비자 |
| `test/cli-coordinate.test.js` | 보고 helper(`:215`), 신규 | Modify | CLI coordinate | helper 기본 Tests 절, 플래그 파싱 테스트 | fixture 소비자 |
| `test/coordinate-next.test.js` | 보고 helper(`:54`) | Modify | next/advance | helper 기본 Tests 절 | fixture 소비자 |
| `test/coordinator-e2e.test.js` | 보고 helper(`:187-189`) | Modify | e2e drive | 기본값을 통과 Tests로, `tests: null` 사례 유지 | fixture 소비자 |
| `test/native-profile-e2e.test.js` | 보고 본문(`:188-192`) | Modify | native profile e2e | Tests 절 추가 | fixture 소비자 |

#### Constraints

- 보고 판정은 `testsReportProblem`·`scopedTestReportFailure`를 재사용한다. 휴리스틱을 복제하거나 완화하지 않는다.
- baseline 실행은 원장 잠금 밖에서 한다. 결과 쓰기는 phase 2 재확인을 통과할 때만 한다.
- baseline argv 검사는 `isValidVerifyCommand`·`getVerifyAllowlist`를 쓴다. 셸 문자열로 실행하지 않는다.
- 기존 단언 변경은 다음으로 한정한다.
  - 다섯 테스트 파일의 보고 fixture helper가 기본으로 `## Tests` 절을 넣는다. 내용은 그 fixture task의 `bouncer.verify` 명령과 `pass (exit 0)` 한 줄이다.
  - `test/coordinator-e2e.test.js:1166`(`makeScopedRepo('091')`, full, `scoped_terminal`)은 기대값이 바뀐다.
    - 지금은 잘못된 Tests로 accepted report가 `ok === true`이고 fan-in이 `worker-test-report-mismatch`이다.
    - 바뀐 뒤에는 그 report 단계가 `report-tests-invalid`이고 원장 bytes가 같다.
    - 이어서 맞는 Tests로 다시 report해 수락받는다. 그다음 보고 파일의 Tests를 잘못된 본문으로 덮어쓰고 integrate하면 fan-in이 `worker-test-report-mismatch`로 거절한다. fan-in 검사 경로는 이렇게 계속 시험된다.
    - 통과 뒤 runner가 종단에서만 1회라는 기존 단언은 유지한다.
    - 이 사례만 기대값을 바꾸고, 바뀐 기대값은 이 목록에 적은 것뿐이다.
  - 그 밖의 기대값은 바꾸지 않는다.
- prepare 결과의 기존 키는 바꾸지 않는다.
- TOML 생성본은 생성기로만 만든다.

### plugin-surface-slimming/measure-scope-env-surface/004 · `75a3edd1`

#### Goal & intent

Cursor·Codex 배포 표면이 네 진입 skill(`bouncer-init`·`bouncer-plan`·`bouncer-run`·`bouncer-finalize`)과 일곱 named agent 짝만 내보낸다는 사실을 단위 테스트로 고정한다. `docs/install.md` Cursor 절에서 세 문장을 고친다. 낡은 "워크플로 여섯"을 네 진입점으로 바꾸고, Codex 절처럼 회고 대체 경로(`bouncer retro sources`·`bouncer retro read`)를 더하고, commit 가드 문장을 TASKS-002의 범위 정책(`rules/commit-scope.md`)과 맞춘다. 매니페스트 파일은 계획 시점 조사에서 어긋남이 없었다. 새 테스트가 어긋남을 드러내면 매니페스트를 고치지 않고 보고에 적어 멈춘다. 진입 표면 전후 비교 절차(finalize 토큰과 자동 retro 출력 존재 여부, 품질 비교 없음)는 TASKS-001의 `benchmarks/ablation/README.md`가 소유한다.

수용 기준:
- 새 테스트가 다음 다섯 가지를 고정한다. (1) `agents/*.md` 이름 집합 = `NAMED_AGENTS` = `.codex/agents/*.toml` 이름 집합. (2) 일곱 TOML이 모두 `mdToCodexToml(md, efforts[name])`(fixture 설정 `{ roles: {} }`)과 바이트가 같다. (3) Cursor·Codex 매니페스트의 `skills`가 가리키는 디렉터리에 `SKILL.md`를 가진 하위 디렉터리가 정확히 네 진입 skill이다. (4) 다섯 매니페스트 어디에도 `bouncer-retro`가 없다. (5) `docs/install.md`의 Cursor·Codex 절이 각각 리터럴 `/bouncer-init`·`/bouncer-plan`·`/bouncer-run`·`/bouncer-finalize`와 `bouncer retro sources`를 담고, Cursor 절이 "여섯"을 담지 않고, 공백·줄바꿈을 한 칸으로 접은 본문에 "밖 파일이 staged면 셸 실행을"을 담지 않으며, `rules/commit-scope.md`·`원장 scope`·`Do not touch`·`scope-do-not-touch-unreadable`을 담는다.
- verify: `node scripts/verify-entry-surface.js`

#### Current behavior

- `skills/`에는 `bouncer-finalize`·`bouncer-init`·`bouncer-plan`·`bouncer-run`만 있다. `test/skill-bouncer-surface.test.js:23`이 `EXPECTED_SKILL_COUNT = 4`를 고정한다.
- 매니페스트: `.cursor-plugin/plugin.json:19`와 `.codex-plugin/plugin.json:16`이 `"skills": "./skills/"`이다. `plugin.json`, `.claude-plugin/plugin.json`, `.agents/plugins/marketplace.json`에는 skills 키가 없다. 다섯 파일 모두 `bouncer-retro`를 담지 않는다(`grep -rn bouncer-retro plugin.json .claude-plugin .cursor-plugin .codex-plugin .agents` 0건).
- named agent: `agents/*.md` 일곱 개와 `.codex/agents/*.toml` 일곱 개가 이름으로 짝을 이룬다. 단위 테스트의 생성본 일치는 coordinator 하나뿐이다(`test/distribution.test.js:247`). 전 역할 일치는 staged index를 보는 `scripts/check-emit.js:91-129`만 확인한다. `test/agents.test.js:24`는 md 이름·모델만 본다.
- 문서: `docs/install.md:165-167`의 "커밋 가드는"(`:165`)부터 "`deny`합니다."(`:167`)까지 한 문장이 "`affected_paths` 밖 파일이 staged면 셸 실행을 `deny`"라고 적는데, TASKS-002 뒤 full coordinator drive에서는 Do not touch 겹침만 deny한다. `docs/install.md:163` Cursor 절이 "공개 집합 `skills/*/SKILL.md`(워크플로 여섯)"이라고 적는다. Codex 절 `:197-201`은 네 진입점과 회고 대체 경로를 적는다. Cursor 절에는 회고 대체 경로가 없다. `README.md:73`에는 회고 대체 경로가 있다.
- 기존 매니페스트 테스트는 다음과 같다. `test/cursor-plugin.test.js:43`은 루트 manifest에 skills가 없음을, `:85`는 Codex skills 경로와 hooks 부재를, `:92`는 marketplace source를 확인한다.
- 재현: `npm run build && node --test test/distribution.test.js test/cursor-plugin.test.js`가 현재 통과한다.

#### Target behavior

- 성공: 새 단언이 모두 현재 저장소(문서 정정 뒤)에서 통과한다.
- 실패:
  - md를 고치고 TOML을 재생성하지 않으면 (2)가 그 역할 이름으로 실패한다.
  - `skills/`에 진입 skill이 아닌 `SKILL.md` 디렉터리가 생기면 (3)이 실패한다.
  - 매니페스트에 `bouncer-retro`가 들어오면 (4)가 실패한다.
- 보존: 기존 coordinator TOML 테스트(`:247`)의 checkpoint 단언과 기존 매니페스트 테스트는 그대로다. 매니페스트·TOML 바이트는 바꾸지 않는다.

#### Interface

- 제공: 테스트 이름은 다음과 같다(`lint:test-names` 형식).
  - `test/distribution.test.js`: `every named agent → has one Markdown source, one NAMED_AGENTS entry, and one Codex TOML`, `every checked-in Codex TOML → equals the fixture-generated TOML`
  - `test/cursor-plugin.test.js`: `Cursor and Codex skills directories → expose exactly the four entry skills`, `host manifests → never name the retired retro skill`, `install guide Cursor and Codex sections → name the four entry skills and the retro CLI path`
  - 도메인 용어 "진입 skill 디렉터리": `skills/<name>/SKILL.md`가 있는 `<name>`이다. 예: `skills/bouncer-run/SKILL.md` → `bouncer-run`.
  - 도메인 용어 "설치 문서 절": `docs/install.md`에서 `## Cursor`부터 다음 `## ` 앞까지와 `## Codex`부터 다음 `## ` 앞까지다.
- 거부: 테스트는 파일을 쓰지 않는다. 매니페스트 JSON 파싱 실패는 그대로 테스트 실패다.

#### Touch

| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `test/distribution.test.js` | `:247` coordinator TOML 테스트 옆 신규 두 개 | Modify | coordinator 생성본 일치 | 전 역할 집합·생성본 일치 | 단위 테스트 parity 공백 |
| `test/cursor-plugin.test.js` | `:85`, `:92` 옆 신규 세 개 | Modify | 매니페스트 계약 | 진입 skill 노출, retro 부재, 설치 문서 절 | 호스트 표면 계약 |
| `docs/install.md` | `## Cursor`(`:149-187`) | Modify | Cursor 설치 안내 | "워크플로 여섯" → 네 진입점 명시, 회고 대체 경로 한 줄, `:165-167`의 commit 가드 문장 전체를 바뀐 판정으로 교체(Constraints의 네 요소) | 낡은 수(`:163`), 안내 누락, 범위 정책 변경(`:165-167`) |
| `scripts/verify-entry-surface.js` | 단계 실행기 | Create | 없음 | build → 테스트 → eslint → test-name | task 전용 verify |

#### Constraints

- 생성본 비교는 `scripts/check-emit.js`의 fixture 설정(`{ roles: {} }`)과 `resolveCodexEfforts`를 같은 방식으로 쓴다. 저장소 `.bouncer/config.json`을 읽지 않는다.
- 기존 테스트 단언은 바꾸지 않고 테스트를 더한다.
- `docs/install.md`는 Cursor 절의 세 문장(진입 skill 수, 회고 대체 경로, commit 가드 판정)만 바꾼다. commit 가드 문장은 TASKS-002 Interface와 같은 판정을 담고 정책 정본으로 `rules/commit-scope.md`를 가리킨다. 담을 요소는 넷이다.
  1. coordinator가 활성인 drive(light 포함)는 승인 `affected_paths`가 아니라 원장 scope로 판정한다.
  2. full drive는 scope 밖이어도 Do not touch와 겹치지 않으면 허용한다.
  3. full drive는 Do not touch와 겹치는 staged 파일과, 금지선을 읽지 못한 경우(`scope-do-not-touch-unreadable`)를 `deny`한다.
  4. light drive와 coordinator 없는 실행은 지금처럼 scope 밖 staged 파일을 `deny`한다.
- 이 문장은 TASKS-002가 구현하는 판정을 서술한다. 두 task는 같은 PR에 들어가 종단 검증(TASKS-005) 전에 함께 통합되므로 경로 의존 없이 병렬로 둔다.
- (2)는 Windows 줄바꿈 차이를 무시하지 않는다. 체크인 바이트를 그대로 비교한다.

### plugin-surface-slimming/measure-scope-env-surface/005

#### Goal & intent

TASKS-001~004가 integration에 모두 통합된 상태에서 `npm run ci`가 exit 0으로 끝남을 증명한다. 이 명령은 GitHub CI(`test.yml`·`release.yml`)와 같은 묶음이다. emit 검사, 버전 일치, coverage 문턱, unit tier, lint, 문서 형식, context 주석, typecheck, 테스트 이름, `npm audit --audit-level=high`가 들어 있다. coverage는 worker가 아니라 이 노드에서만 판정한다.

#### Interface

- 제공: 구현 task가 모두 통합된 뒤 전체 검증 명령을 한 번 실행해 남기는 종단 검증 증적. 구현 task는 각자 task 전용 명령만 갖는다.
- 거부: source 변경, review 문서, commit.

#### Touch

Source 변경 경로 없음.

### plugin-surface-slimming/measure-scope-env-surface/006 · `1b893388`

#### Goal & intent

최종 리뷰 finding을 수정한다.

- SEC-002 (major, security, must_fix) — packages/cli/src/commit-guard.ts#checkCommitSafety — tasks/002 Goal & intent — note: dynamic repair tasks only carry .git/.bouncer Do not touch, so the guard and report check do not apply other tasks' Do not touch lines to undeclared paths
- CT-001 (major, correctness_tests, must_fix) — test/commit-task.test.js#coordinatorFixture — tasks/002 Constraints — note: merged with spec_scope F-SS-001: three existing out-of-scope assertions changed to scope-do-not-touch-violation; restore them with light-mode fixtures and add full-mode cases as new tests
- CT-002 (minor, correctness_tests, must_fix) — test/coordinator.test.js#scopedReportDrive — tasks/003 Checklist — note: merged with spec_scope F-SS-003: no test for verification task accepted report without Tests in full scoped_terminal ledger
- F-SS-002 (minor, spec_scope, must_fix) — packages/cli/src/scope.ts#coordinatorContext — tasks/002 Interface — note: brief requires lazy Do not touch read; coordinatorContext reads eagerly in full mode and rules/commit-scope.md states lazy

#### Interface

- 제공: 기록된 리뷰 finding을 해소하는 최소 수정
- 거부: Blueprint 밖 scope와 새 기능

#### Touch

- Modify `packages/cli/src/scope.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `packages/cli/src/commit-guard.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `packages/cli/src/coordinator-commands.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `packages/cli/src/coordinator-repair.ts` — 기록된 리뷰 finding을 수정한다.
- Modify `rules/commit-scope.md` — 기록된 리뷰 finding을 수정한다.
- Modify `test/commit-guard.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/commit-hook.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/commit-task.test.js` — 기록된 리뷰 finding을 수정한다.
- Modify `test/coordinator.test.js` — 기록된 리뷰 finding을 수정한다.

#### Constraints

- 원장의 실패 증적과 repair 결정 범위만 따른다.