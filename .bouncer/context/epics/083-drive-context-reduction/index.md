---
type: bouncer.epic
title: drive 문맥 누적 축소
description: Cut coordinator drive context by compacting coordinate output, narrowing instruction reads, and splitting the drive into per-wave coordinator sessions
resource: .bouncer/context/epics/083-drive-context-reduction/index.md
tags:
- bouncer
- epic
- coordinator
- cli
- run
- token-cost
timestamp: '2026-10-01T16:50:54.759+09:00'
bouncer:
  id: '083'
  epic_id: '083'
  status: approved
  supersedes: []
---
# 083 drive 문맥 누적 축소

## Intent
- 문제: coordinator 세션 하나가 blueprint 전체를 끌고 가며 `coordinate` 응답마다 원장 전체를 다시 받고, 이미 받은 역할 문서와 실행 스킬을 다시 읽어 문맥이 13만 토큰 넘게 쌓인다.
- 목표: `coordinate` 응답은 다음 행동에 필요한 필드만 한 줄로 내고, coordinator는 필요한 참조만 읽으며, drive는 ready wave 하나마다 새 coordinator 세션으로 이어진다.

## Success criteria
1. `bouncer coordinate` 성공 stdout에 top-level `tasks`·`decisions` 키가 없고 `checkpoint`는 그대로 있다. `prepare`는 그 대신 `opened[]`를 낸다. 항목은 결과 `ready`에 든 task와, `integrated`가 아니면서 lease가 active인 task마다 하나이고, 모두 `id`·`status`를, commit task 항목은 `workerPath`·`branch`·`lease`도 담는다.
2. `bouncer coordinate`의 모든 stdout(성공·`ok: false` 모두)은 개행 하나로 끝나는 한 줄 JSON이고, `ok: false`의 `reason`·`cause`·`next`는 그대로다.
3. `agents/bouncer-coordinator.md`는 worker payload·리뷰 라운드·verify 실패 복구 절차로 `skills/bouncer-execute/references/agent-dispatch.md`·`review-round.md`·`verification-recovery.md`를 경로로 가리키고, `skills/bouncer-execute/SKILL.md`는 coordinator 세션당 한 번만 읽는다고 적는다.
4. coordinator·implementer·reviewer·debugger 역할 문서는 prompt나 dispatch payload에 이미 있는 문서(자기 역할 문서 포함)를 다시 Read하지 않는다고 적고, `skills/bouncer-run/SKILL.md`에는 coordinator 역할 문서를 읽으라는 지시가 없다.
5. coordinator는 이번 세션이 prepare로 연 task가 모두 `integrated`가 된 뒤 checkpoint의 `active_tasks`가 비어 있지 않으면 다음 wave를 열지 않고 outcome `continue`를 반환한다. 일부만 integrated이면 같은 세션이 그 wave를 마저 처리한다. `active_tasks`가 비면 Close(최종 리뷰·closing action)까지 진행한다.
6. `/bouncer-run`은 outcome이 `continue`이면 `coordinate status`를 다시 받아 새 coordinator를 같은 integration worktree에 디스패치하고, `completed`·`blocked`·`partial_closed`이면 멈춘다. `continue` 전후 checkpoint의 `completed_tasks` 수가 늘지 않았으면 새 coordinator를 띄우지 않고 멈춘다.
7. 바뀐 `agents/*.md`마다 `.codex/agents/*.toml`이 `mdToCodexToml` 결과와 바이트 단위로 같고, 진입 SKILL 단어 수 합계가 `test/skill-bouncer-surface.test.js` baseline 미만이다.
8. `CHANGELOG.md` `[Unreleased]`에 세 변경이 있고 `npm run ci`가 통과한다.

1~6은 각 blueprint의 CLI·문서 계약 테스트가 고정한다.

## Out of scope
- checkpoint 내부 필드(`unresolved_decisions`의 DAG 스냅샷, `active_tasks[].dispatch`, `completed_tasks[].changed_paths`) 축소. epic 076이 정한 checkpoint 계약을 유지한다.
- `bouncer coordinate` 밖 명령(`validate`, `plan inspect`, `run preflight`, `execute prepare`, `review-dispatch`, `current`)의 출력 형식과 필드.
- `scripts/src/lib/coordinator.ts`의 `coordinate()` 반환 객체. 축소는 CLI stdout 투영에서만 한다.
- 같은 역할 재디스패치에 변경분만 보내는 payload. 디스패치마다 새 subagent·print 프로세스라 이전 문맥이 없다.
- 미캐시 재과금 원인 측정, 벤치마크 하네스 변경과 재실행, 벤치마크 환경 PATH 정리.
- 저장소 루트의 미추적 로컬 문서 `token-cost-audit.md` 자체. 커밋하지 않는다.

## Blueprints
* [001 coordinate 출력 축소](blueprints/001-coordinate-output-compaction/index.md) - `coordinate` CLI stdout에서 원장 전체 사본을 빼고 한 줄 JSON으로 낸다 (`scripts/src/lib/cli-git-commands.ts`, coordinator 역할 문서)
* [002 지침 읽기 범위 축소](blueprints/002-instruction-read-scope/index.md) - coordinator를 execute 참조로 직접 안내하고 이미 받은 문서 재읽기를 막는다 (`agents/*.md`, run 스킬)
* [003 wave 단위 coordinator 세션](blueprints/003-wave-session-split/index.md) - coordinator가 wave마다 `continue`로 돌아오고 run이 새 세션을 띄운다 (coordinator 역할 문서, run 스킬)
