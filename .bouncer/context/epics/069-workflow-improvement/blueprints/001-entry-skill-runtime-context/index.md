---
type: bouncer.blueprint
title: 진입 스킬 런타임 컨텍스트 최소화
description: Entry skills keep only step order, ACQ placement, and stop conditions while CLI preflight payloads and conditional references carry the rest.
resource: .bouncer/context/epics/069-workflow-improvement/blueprints/001-entry-skill-runtime-context/index.md
tags:
  - bouncer
  - blueprint
  - skills
  - preflight
  - context-budget
timestamp: '2026-09-11T10:25:27.588+09:00'
bouncer:
  id: '001'
  epic_id: '069'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 entry-skill-runtime-context

Epic: [069](../../index.md)

## Intent
- 진입 스킬이 경로와 상태 판정을 본문에 다시 적어 매 호출마다 적재함.
- 본문에는 단계 순서와 중단 조건만 남기고 계산은 명령 결과가 맡게 함.

## Contract
- 스킬별 번호 단계(epic 성공 조건 1의 기준):
  ```text
  init      Init → 조건부 결과 처리 → bootstrap commit 안내 → Plan handoff                  (4)
  plan      Discover → Scaffold → Author → Scope confirm → Review → Approval → Activate → Gate (8)
  execute   Preflight → Prepare → Implement → Verify/recover → Review → Gate                (6)
  commit    Current → Dry-run → 결과 확인 → Commit → Handoff                                  (5)
  run       Preflight → 시작 ACQ → Integration bootstrap → Coordinator dispatch → Report      (5)
  finalize  Explain/Quiz → Remainder → PR → Cleanup → Handoff                                 (5)
  ```
- 인터페이스:
  - `bouncer execute prepare --blueprint <dir>` — standalone이면 worktree를 만들거나 재사용하고 seed까지 끝낸 뒤 `{ ok, drive: false, worktreePath, branch, created, base, task, scale, seed }`를 반환한다. Coordinator ledger가 있으면 worktree와 seed를 건드리지 않고 `{ ok, drive: true, worktreePath, created: false, task, scale }`를 반환한다.
  - `bouncer run preflight --blueprint <dir>` — pointer, blueprint 상태·scale, 열린 task의 `affected_paths`·DAG 필드, ready wave, `autonomy`와 fallback 여부를 반환한다.
  - `bouncer plan inspect [--epic-dir <dir>]` — 다음 epic id, 지정 epic의 다음 blueprint id, `maintenance` epic 위치, 저장소 루트 verify 신호, pointer 상태(`selected | empty | ambiguous | invalid`)를 반환한다.
  - `bouncer commit` payload에 `controller`, `nextAction`, `stampPath`, 실패 시 `recovery`를 추가한다. Pointer 후보는 기존 `nextTask`다.
  - `bouncer finalize`의 dry-run, `--yes`, `coordinator-ledger` 거절 payload에 `integration: { ledger, required, complete, openTasks, headVerified }`를 추가한다.
  - 새 top-level 명령 `execute`, `plan`, `run`은 `scripts/src/lib/cli.ts`의 `COMMANDS` 등록표에 오른다.
- 안전 경계(epic 성공 조건 3의 기준, 행마다 정본 한 곳):
  ```text
  1 ACQ 시점과 동의 범위          정본: 각 ACQ를 여는 스킬의 번호 단계
  2 affected_paths 사용자 확인    정본: skills/bouncer-plan/SKILL.md Scope confirm 단계
  3 pointer confirm-then-set      정본: rules/current-pointer.md
  4 실제 cwd·drive main 읽기 전용  정본: rules/governance.md ## Coordinator mode
  5 worker report 신뢰 경계        정본: CLAUDE.md hard rule 1
  6 light inline·drive named 예외  정본: rules/governance.md ## Lightweight cycle
  7 debugger 복구 상한             정본: skills/bouncer-execute/references/verification-recovery.md
  8 review round 상한              정본: skills/bouncer-execute/references/review-round.md
  9 quiz 미응답 중단·사용자 동의    정본: skills/bouncer-finalize/SKILL.md
  ```
- 데이터·상태: 문서 frontmatter, pointer, coordinator ledger 스키마는 바꾸지 않는다. 기존 payload 필드는 이름과 의미를 유지하고 새 필드만 더한다.
- 수용 기준: epic 성공 조건 1, 2, 3, 11.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 본문을 reference로 옮겨도 기본 경로가 그 reference를 번호 절차 앞에서 cite하면 매 호출 적재가 그대로다. 조건부 reference는 해당 번호 단계 안에서만 cite한다.
  - 여러 테스트가 스킬 본문 문구를 직접 검사한다. 각 task Constraints가 남길 문구를 나열하고, 그 문구를 지우려면 해당 테스트를 Touch에 넣는다.
  - `execute prepare`는 예상 경로에 등록된 worktree가 있으면 붙어 있는 branch 이름과 무관하게 재사용하고 rename하지 않는다. 등록되지 않은 디렉터리가 그 경로에 있으면 아무것도 쓰지 않고 거절한다.
  - Drive 중에는 main worktree가 읽기 전용이다. `execute prepare`는 ledger를 감지하면 worktree 생성과 seed를 하지 않는다.
  - `autonomy`가 없거나 `AUTONOMY_ENUM` 밖이면 `auto`로 fallback하고 payload가 그 사실을 알린다.
  - TASKS-006 정본 테스트가 선행 task 결과와 맞지 않으면 테스트를 결과에 맞추지 않고 계획으로 돌아간다.
  - 결정 6 원문의 Distill preflight와 finalize의 Distill 단계는 이미 제거된 기능이므로 만들지 않는다.

## Out of scope
- 승인 뒤 상태 전이, pointer 설정과 plan gate를 묶는 결정적 명령.
- 진입 스킬의 런타임 토큰·dispatch 수 계측.
- Review 판단 절차의 의미 변경. 이 blueprint는 현재 round 상한 절차를 reference로 옮기기만 하고, 수렴 모델은 BP002가 바꾼다.
- Branch 이름 규칙 변경. `execute prepare`는 현재 `<type>/<BP-id>-<slug>` 규칙을 그대로 옮기고, 새 규칙은 BP003이 적용한다.
- `rules/acq.md`, `rules/current-pointer.md`, `rules/plugin-root.md`, `rules/subagent-model.md` 정본 본문.

## One-commit justification
- TASKS-001부터 TASKS-005는 각각 한 진입 워크플로의 CLI payload, 본문 축약, 테스트를 함께 닫는 커밋이다. TASKS-006은 init 적재 범위를 줄이고 안전 경계와 단계 수·단어 수를 테스트로 고정하며, blueprint 전체가 진입 스킬 축약 한 PR이 된다.

## Documents
* [Task 001](tasks/001/tasks.md) - execute 준비 명령과 execute 스킬 축약
* [Task 002](tasks/002/tasks.md) - plan 점검 명령과 plan 스킬 축약
* [Task 003](tasks/003/tasks.md) - run 사전 점검 명령과 run 스킬 축약
* [Task 004](tasks/004/tasks.md) - commit 결과 안내 필드와 commit 스킬 축약
* [Task 005](tasks/005/tasks.md) - finalize 통합 완료 판정과 finalize 스킬 축약
* [Task 006](tasks/006/tasks.md) - init 규칙 적재 축소와 안전 경계 정본 테스트
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
