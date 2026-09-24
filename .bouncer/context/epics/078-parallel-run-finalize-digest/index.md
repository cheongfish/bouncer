---
type: bouncer.epic
title: 병렬 Task 실행과 마감 입력 압축
description: Runs independent Bouncer tasks in parallel under coordinator leases and compresses finalize input into one CLI digest.
resource: .bouncer/context/epics/078-parallel-run-finalize-digest/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - parallel
  - finalize
  - explain
timestamp: '2026-09-24T11:23:58.468+09:00'
bouncer:
  id: '078'
  epic_id: '078'
  status: approved
  supersedes: []
---
# 078 병렬 Task 실행과 마감 입력 압축

## Intent
- 문제: 공유 pointer 하나가 blueprint의 모든 worktree에 적용돼 coordinator가 `parallel_safe` task도 하나씩 몰아야 하고, fan-in은 검증 없이 canonical integration branch에 바로 cherry-pick한다. finalize agent는 Explain·Quiz·PR 입력을 diff·task 문서·원장·검증 로그에서 매번 다시 모은다.
- 목표: coordinator가 lease로 독립 task를 동시에 실행하되 stale event와 fan-in 실패가 canonical branch를 바꾸지 못하게 하고, `bouncer finalize prepare` 한 번으로 마감 입력을 받게 한다.

```mermaid
flowchart LR
  A[DAG ready wave] --> B[충돌 없는 lease 배정]
  B --> C[task runner 병렬 실행]
  C --> D[wave candidate 검증]
  D --> E[canonical fast-forward]
  E --> F[finalize digest]
  F --> G[Explain · Quiz · draft PR]
```

## Success criteria
1. `parallel_safe: true`이고 경로·`exclusive_resources`가 서로 겹치지 않는 ready task가 세 개일 때, `coordinator.max_parallel`이 없으면 `coordinate prepare`가 두 task만 준비하고 `max_parallel: 1`이면 한 task만 준비한다.
2. `affected_paths`가 `src/`와 `src/a.ts`인 두 task, 또는 같은 `exclusive_resources` 항목을 가진 두 task는 같은 시점에 in-flight 상태가 되지 않는다.
3. revoke 뒤 이전 `generation`이나 `lease_id`로 들어온 `report`·`record`·`integrate` 요청은 `stale-lease`로 거절되고 원장 task 상태를 바꾸지 않는다.
4. scope revision이 다른 active lease와 충돌하면 늦게 발급된 lease의 task만 revoke되어 `pending`으로 돌아가고, 먼저 발급된 lease는 유지된다.
5. worker worktree에서 실행한 `bouncer current`·verify·validate·commit·commit hook이 공유 pointer의 task가 아니라 그 worktree에 lease된 task를 대상으로 판정한다. 원장이 없는 standalone checkout은 기존 pointer task를 쓴다.
6. wave fan-in은 임시 candidate에서 cherry-pick과 검증을 마친 뒤에만 canonical integration branch를 fast-forward한다. cherry-pick 충돌이나 검증 실패가 나면 canonical HEAD와 원장의 `integrationHead`가 그대로이고, 그 wave의 어떤 task도 `integrated`가 되지 않는다.
7. fast-forward 뒤 원장 기록 전에 coordinator가 중단되어도, 재실행한 `integrate`가 같은 commit을 다시 cherry-pick하지 않고 원장을 완결한다.
8. `bouncer finalize prepare --blueprint <dir>`는 문서·Git을 쓰지 않는다. task별 stable ID, task commit, 실제 changed paths, verification 결과, 결정적 unverified 목록, review disposition, 남은 제약, 실제 branch, PR base, PR 제목 접두와 결정적 본문 절(`확인 방법`·`리뷰 포인트`)을 JSON 하나로 반환한다.
9. `bouncer finalize links --blueprint <dir>`는 task 문서가 지워진 뒤에도 동작하고, remote 없음·GitHub가 아닌 host·push되지 않은 head에서는 URL 없이 이유 코드만 반환한다. URL을 반환할 때는 push된 branch URL과 commit permalink만 반환한다.
10. 새 finalize가 쓰는 Explain task 제목은 `` ### EPIC-xxx/BP-xxx/TASK-xxx · `sha8` `` 형식이고, `bouncer intent`는 새 제목과 기존 `### Task NNN` 제목을 모두 해석한다.
11. finalize skill은 Explain·Quiz·PR 입력을 `finalize prepare` payload에서 읽고 원장·task 원문·verification 로그를 다시 읽으라고 지시하지 않는다. Quiz, `## 이해 상태`, `bouncer.comprehension`, G16 계약은 유지된다.
12. 두 blueprint 각각의 종단 verification task에서 `npm run ci`가 통과한다.

## Out of scope
- 생성 CommonJS의 Git 추적 제거와 marketplace release artifact 전환(로드맵 #17).
- Epic 077 BP 4의 공개 문서 정리와 `rules/governance.md` 삭제.
- 새 `bouncer drive` 명령. 기존 `bouncer coordinate` 하위 명령을 확장한다.
- 외부 시스템까지 잠그는 distributed lock, 3개 이상 기본 동시 실행.
- 기존 Explain·commit의 일괄 migration과 `task_commits` 행 형식 변경.
- 토큰 계측, usage event, 벤치마크.

## Blueprints
* [001 Pointer 독립 병렬 Task 실행](blueprints/001-pointer-independent-parallel-run/index.md) - lease·scheduler·effective task·safe fan-in을 coordinator와 실행 CLI(`scripts/src/lib`)에 넣고 coordinator·run 문서를 병렬 dispatch로 전환한다.
* [002 Finalize digest](blueprints/002-finalize-digest/index.md) - `bouncer finalize prepare` digest와 PR 초안, stable ID Explain 제목을 추가하고 finalize skill 입력을 digest로 전환한다.
