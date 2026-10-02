---
type: bouncer.epic
title: finalize 기록과 런타임 지침 축소
description: Finalize quiz, explain, and PR stop carrying drive execution records, and coordinator and gate recovery stop loading runtime rules they do not need.
resource: .bouncer/context/epics/085-finalize-runtime-slimming/index.md
tags:
  - bouncer
  - epic
  - finalize
  - explain
  - quiz
  - coordinator
  - gates
timestamp: '2026-10-02T15:39:23.837+09:00'
bouncer:
  id: '085'
  epic_id: '085'
  status: approved
  supersedes: []
---
# 085 finalize 기록과 런타임 지침 축소

## Intent
- 문제: finalize 퀴즈가 바뀐 제품 동작 대신 이번 drive의 실행 과정(task 분할, repair wave, scope 확장)을 묻는다. explain과 PR은 실행 중에만 쓸모 있는 기록(DAG 변화, worker branch·sha)을 저장소 지식처럼 남기고, coordinator와 gate 규칙은 세션마다 필요 없는 지침을 읽게 만든다.
- 목표: 퀴즈와 explain·PR이 바뀐 제품 동작과 코드만 다룬다. coordinator와 gate 실패 복구는 이미 문맥에 있는 문서와 CLI 출력만으로 진행된다.

## Success criteria
1. 퀴즈 지침(`references/explain-diff/index.md`)이 바뀐 제품 동작만 묻게 하고, 이번 blueprint 실행 과정(task 분할·순서, repair wave, scope 확장, worker·branch·sha, integration head)에 대한 질문을 금지하는 목록과, 제품 동작 변화가 없을 때 쓰는 대체 질문 규칙을 담는다.
2. explain 지침과 `finalize --yes`가 drive 실행 기록(DAG 변화, scope revision, worker branch·sha, integration head)을 `explain.md` 본문이나 frontmatter에 쓰지 않는다.
3. `bouncer scaffold explain` 결과에 `## 이해 상태`가 없고, `quiz_score`·`disposition` 없이 `range_from`·`range_to`·`diff_sha`·`recorded_at`만 있는 comprehension 엔트리로 finalize gate(G16)가 통과한다.
4. 옛 형식 explain(`## 이해 상태`, `quiz_score`, `disposition`, `bouncer.coordinator`를 가진 문서)도 G16에서 실패하지 않는다.
5. PR 지침(`skills/bouncer-finalize/references/draft-pr.md`)이 어느 섹션에도 drive 기록을 쓰라고 지시하지 않고 `주요 변경 내용`에서 작업 과정을 금지한다. `bouncer finalize prepare` digest에 `coordinator`와 `tasks[].actual_paths`가 없고, branch 결정과 worktree cleanup은 그대로 동작한다.
6. review finding `disposition`(G14)과 G22·`LEGACY_SCAFFOLD_COMMENT_BODIES` 동작이 바뀌지 않는다.
7. coordinator 역할 문서(`agents/bouncer-coordinator.md`)가 `skills/bouncer-execute/SKILL.md` 읽기를 지시하지 않고, 한 task 회차 계약(intent bundle 고정, verification 준비, execute gate)을 자체 절에 담는다.
8. `bouncer validate` 실패 항목 중 hint 표에 있는 네 경우(G13 verify ledger 기록 없음·불일치, G18 `context review is stale`, G20 verification task Touch의 source 변경 선언, G22 옛 scaffold 안내 주석)가 `next` hint를 싣고, 그 밖의 실패 항목에는 `next`가 없으며, `rules/gates.md`와 `AGENTS.md`의 `## Runtime rule index`가 없다.
9. 각 blueprint의 종단 검증에서 `npm run ci`가 통과한다.
10. `/bouncer-plan` step 3이 full blueprint에서 근거 수집 reference를 읽으라고 가리키고, 그 reference가 `execution_kind: commit` task 전부에 대해 task당 generic read-only subagent 하나를 한 메시지에서 병렬로 dispatch하라고 지시한다. light blueprint와 `execution_kind: verification` task에는 dispatch하지 않는다.
11. 근거 수집 reference(`skills/bouncer-plan/references/evidence-dispatch.md`)가 입력 allowlist(task id, task 골격, discovery Goal·Scope, 후보 경로, read-only cwd)와 보고 필드(`observations`, `io_coupling`, `tests`, `unresolved`)를 정하고, subagent의 파일 쓰기와 frontmatter·status·`affected_paths` 변경을 금지하며, controller가 보고를 data로 받아 그대로 쓰게 한다.
12. generic subagent를 쓸 수 없거나 dispatch가 실패하거나 보고가 비면, 그 task의 같은 네 필드를 controller가 inline으로 모은다.

## Out of scope
- 이미 published된 과거 `explain.md`의 마이그레이션
- review finding `disposition`(G14)과 `LEGACY_SCAFFOLD_COMMENT_BODIES` 동결 목록
- PR 템플릿의 섹션 구조와 퀴즈 질문 수 규칙(1–10, light는 1문항)
- `finalize --yes` 결과 payload의 `coordinator`·`worktrees` 필드(cleanup이 읽음)
- 벤치마크 평가 정책(`benchmarks/configs/ledger-00*-evaluator-policy.json`의 `quiz_score_use`) — 벤치마크 정책 정리 때 함께 다룬다

## Blueprints
* [001 퀴즈·explain·PR drive 기록 제거](blueprints/001-quiz-explain-pr-drive-record/index.md) - 퀴즈 출처를 제품 동작으로 좁히고 `## 이해 상태`·`quiz_score`·`disposition`·explain `bouncer.coordinator`·digest drive 필드를 지운다 (explain-diff·finalize 지침, comprehension·finalize CLI)
* [002 coordinator 회차 계약 이전](blueprints/002-coordinator-task-round/index.md) - coordinator가 execute SKILL 대신 자기 역할 문서의 회차 계약 절을 따른다 (`agents/bouncer-coordinator.md`, `.codex/agents/bouncer-coordinator.toml`, execute SKILL)
* [003 gate 실패 hint와 gates.md 삭제](blueprints/003-gate-failure-hints/index.md) - validate 실패에 다음 행동 hint를 붙이고 `rules/gates.md`와 AGENTS.md rule 목록을 지운다 (validate CLI, AGENTS.md, rules·docs 링크)
* [004 plan task 근거 병렬 수집](blueprints/004-plan-evidence-dispatch/index.md) - full blueprint의 commit task마다 읽기 전용 subagent가 Current behavior 근거를 병렬로 모으고 controller가 문서를 쓴다 (plan SKILL step 3, plan reference, load graph)
