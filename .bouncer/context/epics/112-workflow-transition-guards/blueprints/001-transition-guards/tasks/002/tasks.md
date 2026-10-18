---
type: bouncer.tasks
title: 커밋 확정 전 보고·기록 거절 추가
description: Make accepted coordinate report and record refuse a worker without a stamped commit before any ledger write.
resource: .bouncer/context/epics/112-workflow-transition-guards/blueprints/001-transition-guards/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - coordinator
  - record
  - worker-evidence
timestamp: '2026-10-18T14:00:19.642+09:00'
bouncer:
  id: TASKS-002
  epic_id: '112'
  blueprint_id: '001'
  status: verified
  execution_kind: commit
  depends_on:
    - TASKS-001
  parallel_safe: false
  dependency_gate: integrated
  verify: node --test test/coordinator.test.js test/coordinator-e2e.test.js test/coordinate-next.test.js
  review_risk:
    - public_interface
  affected_paths:
    - scripts/src/lib/coordinator.ts
    - scripts/src/lib/coordinate-next.ts
    - scripts/src/lib/cli-git-commands.ts
    - test/coordinator.test.js
    - test/coordinator-e2e.test.js
    - test/coordinate-next.test.js
    - skills/bouncer-run/references/agent-dispatch.md
    - agents/bouncer-coordinator.md
    - references/coordinator-cards/report.md
    - references/coordinator-cards/record.md
    - rules/cli.md
    - test/cli-coordinate.test.js
    - test/current.test.js
    - .codex/agents/bouncer-coordinator.toml
  commit_intent:
    - coordinator가 복구 커밋 전에 결과를 수락하고 기록해 기준 HEAD가 worker 결과로 남던 순서 오류를 CLI가 먼저 거절하게 함.
  commit_summary:
    - accepted report와 record가 worker 커밋, commit_sha stamp, scope 안 dirty 여부를 확인하고 실패 시 ledger를 바꾸지 않은 채 next를 안내함.
  commit_sha: 7fe51c3f
  scope_revision: r1
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`coordinate report --outcome accepted`와 `coordinate record`는 worker 커밋이 확정된 뒤에만 ledger를 바꾼다. 확정되지 않았으면 mutation 전에 거절하고 `next`로 커밋 경로를 안내한다. `worker-evidence-sha-mismatch` 안내도 실제 원인에 맞춘다. 수용 기준은 epic Success criteria 4–5이고, 완료 명령은 frontmatter `verify`다.

## Current behavior
- `report`(`scripts/src/lib/coordinator.ts:4456-4521`)의 검사 순서:
  1. dispatch 활성
  2. attempt·hash·outcome·summary 형식
  3. light 모드: `lightReviewAccepted`
  4. full 모드: `checkReportFile`(`:258-289`)
  5. stale 비교(`:4495-4503`, `stale-report` decision 기록)
  6. report decision 기록(`:4504-4516`)

  git 상태는 전혀 읽지 않는다.
- `record`(`:4522-4568`)는 worker 배정, `illegal-transition`, `accepted-report-required`, `stale-worker-report`를 확인한다. 그다음 `workerHead = rev-parse HEAD`(`:4556`)를 `item.sha`에 쓴다(`:4560`). HEAD가 `dispatch.base_head`와 같은지, `commit_sha` stamp, dirty 상태는 확인하지 않는다.
- dispatch 기준선:
  - HEAD와 porcelain은 `:4419-4420`에서 읽어 `item.dispatch`(`:4430-4433`)에 저장한다.
  - 재dispatch 때 앞 attempt의 미커밋 source 수정이 `initial_worktree_state`에 흡수된다. blueprint 111/002 dispatch #11·#13이 이 경우다.
- 커밋 순서를 판단하는 곳은 advisory뿐이다. `coordinate-next.ts:896-934`가 stamp와 short HEAD 일치, `onlyTaskBriefDirty`(`:399-402`)를 보고 `commit`/`report`/`commit-evidence-mismatch`를 고른다. `coordinate advance`는 report·record를 직접 부르지 않는다. `AUTO_ACTIONS`(`coordinate-advance.ts:54-56`)에 없기 때문이다. 따라서 정상 경로의 순서는 `commit`(auto) → `report` → `record`다.
- `rerecord`(`:4569-4598`)는 `ledger.integrationHead`와 live HEAD가 같은지, `directParent`(`:645-653`)를 확인한다. full 모드 전용이고 `recorded` 상태만 받는다.
- 통합의 `checkWorkerEvidence`(`:2045-2065`)는 stamp와 기록 SHA의 앞 8자를 비교한다. 다르면 `worker-evidence-sha-mismatch`다. 그런데 hint(`:5036-5039`)는 "brief bytes 불일치, brief 복원 후 integrate 재시도"라고 말해 실제 원인과 다르다.
- 실패 hint 구조: `COORDINATE_FAILURE_HINTS`(`:4609`) + `withCoordinateFailureHints`(`:5049-5060`). 모든 `ok:false`에 `cause`·`next`가 붙는다.
- 관찰된 사례(blueprint 111/002 ledger, 읽기 전용): report #14 `accepted` → record #15에서 sha가 기준 HEAD `1c69027b`로 기록됐다 → 통합에서 mismatch → revoke #16.
- 테스트:
  - `test/coordinator.test.js:2064`는 가짜 stamp `abcd1234`로 record가 성공한다고 단언한다.
  - `recordedDrive`(`:1271`)·`integrableDrive`(`:1327`)·`twoRecordedWave`(`:2815`)는 dispatch 전에 커밋하고 stamp를 쓰지 않는다.
  - e2e `commitInWorker`·`acceptDispatchAndRecord`(`test/coordinator-e2e.test.js:151`, `:207`)는 일부가 두 번 커밋한다(`:392-397`, `:422-423`).
  - 거절 무변경 단언 helper는 `assertRefusedWithoutWrite`(`test/coordinator.test.js:1920`)다.

## Target behavior
- 성공: worker가 integration에 없는 커밋을 가지고, `commit_sha` stamp가 HEAD 앞 8자와 같고, scope 안 dirty 파일이 없으면 지금처럼 report decision을 쓰거나 `recorded`로 전이한다.
- 실패(ledger 바이트 불변, exit 1):
  - worker HEAD가 `ledger.integrationHead`와 같거나 그 조상(`merge-base --is-ancestor HEAD integrationHead` 성공) → `worker-commit-missing`.
  - tasks.md `bouncer.commit_sha`가 없거나 HEAD 앞 8자와 다름 → `worker-commit-stamp-mismatch`.
  - porcelain에서 task brief(`tasks.md`)를 뺀 경로 중 현재 scope(`currentScopePaths`) 안의 경로가 하나라도 있음 → `worker-scope-dirty`. dispatch 기준선에 있어도 거절한다. scope 밖 경로는 기존 `onlyTaskBriefDirty` 기준선 규칙을 따른다.
  - 위 세 코드의 next:
    - full 모드: "`bouncer coordinate advance`로 task commit을 만든 뒤 report/record를 다시 실행한다".
    - light 모드: 같은 문장. integration cwd 기준이다.
- 적용 범위·순서:
  - report는 `--outcome accepted`일 때만 검사한다(rework·blocked·scope_revision·task_change는 그대로). 검사는 stale 판정 뒤, report decision 쓰기 전에 둔다. 따라서 stale report는 지금처럼 `stale-report`로 기록된다.
  - record는 기존 `accepted-report-required`·`stale-worker-report` 검사 뒤, `rev-parse HEAD` 결과를 `item.sha`에 쓰기 전에 검사한다. accepted report 뒤 worker HEAD·stamp·작업 트리가 바뀐 경우를 잡는다.
- `worker-evidence-sha-mismatch` hint:
  - cause: "worker tasks.md의 commit_sha stamp가 ledger에 기록된 SHA와 다르다(커밋 전 기록 또는 기록 뒤 재커밋)".
  - next(full): "worker에서 커밋·stamp를 확인한 뒤 `coordinate rerecord`, 커밋이 없으면 `coordinate revoke` 후 `prepare`".
  - next(light): "보고하고 멈춘다".
- 보존: 다중 worker wave에서 먼저 통합된 worker 때문에 `integrationHead`가 움직여도 남은 worker의 record는 성공한다. `rerecord`, stale-report, lease fence 동작은 바뀌지 않는다.

## Interface
- 제공: 새 reason `worker-commit-missing`, `worker-commit-stamp-mismatch`, `worker-scope-dirty`. 각 reason의 `cause`·`next`를 hint 표에 둔다. 거절 출력에 `head`, `integration_head`, `stamp`, `dirty_paths`를 싣는다.
- 공유 판정 `신규 추출 지점: workerCommitEvidence(exec, workerPath, task, ledger) → { ok: true } | { ok: false, reason, head, stamp, dirty_paths }`. report·record가 함께 쓰고, `coordinate-next.ts`의 report 선택과 같은 stamp 규칙을 쓴다.
- 거부: 위 세 코드. 추가 사용법 오류는 없다.
- 용어:
  - "scope 안 dirty"는 `git status --porcelain` 경로가 현재 scope 항목과 같거나 그 하위인 경우다. 예: scope `scripts/src/lib/`, dirty ` M scripts/src/lib/scope.ts`.

## Touch
| 경로 | 심볼 | 변경 | 현재 책임 | 계획한 변경 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `scripts/src/lib/coordinator.ts` | `coordinate` report·record 분기, `COORDINATE_FAILURE_HINTS` | Modify | 보고·기록 mutation과 hint | 커밋 증거 검사 삽입, mismatch hint 수정, 새 hint 등록 | `:4456-4568`, `:5036-5039`, `:4609` |
| `scripts/src/lib/coordinate-next.ts` | `onlyTaskBriefDirty`, report 선택 | Modify | advisory 커밋 판정 | 공유 판정 사용(선택 결과 불변) | `:399-402`, `:896-934` |
| `scripts/src/lib/cli-git-commands.ts` | report·record help | Modify | usage 문구 | "커밋·stamp 뒤에만 accepted/record" 명시 | `:375-393` |
| `test/coordinator.test.js` | report·record 테스트와 fixture | Modify | 기록 동작 고정 | 거절 케이스 추가, `:2064` 기대 반전, fixture에 dispatch 뒤 커밋·stamp 추가 | `:1271`, `:1327`, `:1642`, `:2033-2108`, `:2815`, `:1920` |
| `test/coordinator-e2e.test.js` | `commitInWorker`, `acceptDispatchAndRecord` | Modify | e2e 기록 경로 | stamp 단계 추가, 커밋 전 기록 → 거절 → 커밋 → 기록 → 통합 e2e | `:151`, `:207`, `:392-425` |
| `test/coordinate-next.test.js` | report 선택 테스트 | Modify | next 판정 고정 | 공유 판정 뒤에도 같은 action을 내는지 확인 | `:621-834` |
| `skills/bouncer-run/references/agent-dispatch.md` | stale report 단락 | Modify | 보고 판정 지시 | accepted·record는 CLI가 커밋을 확인하며, 거절 시 next를 따른다는 문장 | `:13-21`, `:205-212` |
| `agents/bouncer-coordinator.md` | 커밋·보고 순서 | Modify | coordinator 순서 지시 | 거절 코드와 대응 행동 | `:186-187`, `:240-242` |
| `references/coordinator-cards/report.md` | report 카드 | Modify | report 안내 | 커밋 전제와 거절 코드 | 카드 본문 |
| `references/coordinator-cards/record.md` | record 카드 | Modify | record 안내 | 같은 내용 | 카드 본문 |
| `rules/cli.md` | coordinate report·record 항목 | Modify | CLI 계약 표 | 새 거절 코드 | report·record 행 |

## Do not touch
- `.worktrees/` — blueprint 111 실행 증적.
- `scripts/src/lib/coordinate-advance.ts` — auto action 목록과 순서는 바꾸지 않는다.
- `scripts/src/lib/commit.ts` — task commit과 stamp 생성은 그대로다.
- `scripts/src/lib/current.ts` — TASKS-004 범위.
- `test/cli-ontology.test.js` — CT-001 범위 밖.

## Constraints
- 검사는 ledger 쓰기(`stale-report` 제외)보다 먼저 실행하고, 실패 시 ledger·task 문서·worker 파일을 바꾸지 않는다.
- `coordinate advance`가 만드는 정상 순서(commit → report → record)는 수정 없이 통과해야 한다.
- 비교 기준은 `ledger.integrationHead`다. 그래야 wave 안에서 다른 worker가 먼저 통합돼도 오판하지 않는다.
- report의 rework·blocked 등 비수락 outcome은 커밋을 요구하지 않는다(사용자 승인 경계와 rework 흐름 유지).
- 새 reason은 hint 표에 등록한다(reason 완전성 테스트).

## Checklist
- [ ] `npm run build`.
- [ ] 실패 테스트 작성:
  - dispatch 뒤 소스만 수정하고 커밋하지 않은 worker에서 `report --outcome accepted`를 실행하면 `worker-commit-missing`을 반환하고 ledger 바이트가 같다(`assertRefusedWithoutWrite`).
  - 커밋은 했으나 stamp가 없는 worker의 `report --outcome accepted` → `worker-commit-stamp-mismatch`.
  - 커밋·stamp 뒤 accepted report를 기록한다. 그다음 worker에 커밋을 하나 더 만들어 stamp가 HEAD와 달라지게 한다. 이 상태의 `record` → `worker-commit-stamp-mismatch`(record 순서 검증).
  - 커밋·stamp·accepted report 뒤 scope 안 파일을 다시 수정한 worker의 `record` → `worker-scope-dirty`.
  - 기준선에 이미 dirty였던 scope 파일(재dispatch)도 `worker-scope-dirty`.
- [ ] 위 테스트가 `ok: true`가 나와 실패하는지 확인한다.
- [ ] `workerCommitEvidence`를 구현하고 report(accepted)·record에 연결한다. `coordinate-next.ts`가 같은 stamp 규칙을 쓰게 한다.
- [ ] `:2064` 기대를 거절로 바꾸고, 기록 fixture에 dispatch 뒤 커밋과 `head.slice(0,8)` stamp 단계를 추가한다.
- [ ] 회귀 e2e: 커밋 전 record 거절(ledger 불변) → `coordinate advance`로 commit → record 성공 → integrate 성공. 실제 상태 전이를 거쳐야 한다.
- [ ] wave 테스트: 두 worker 중 하나를 통합한 뒤 남은 worker의 record가 성공한다.
- [ ] mismatch hint 테스트: `worker-evidence-sha-mismatch` 출력의 `next`에 `rerecord`가 포함되고 "brief"가 없다.
- [ ] help와 문서 5개를 반영한 뒤 `npm run lint:docs`.
- [ ] 완료 명령: `node --test test/coordinator.test.js test/coordinator-e2e.test.js test/coordinate-next.test.js`.
