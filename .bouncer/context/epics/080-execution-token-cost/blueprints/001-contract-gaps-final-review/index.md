---
type: bouncer.blueprint
title: 실행 계약 보완과 리뷰 횟수 축소
description: Fill coordinator contract gaps with CLI commands and failure hints, and move review to one blueprint-level round
resource: .bouncer/context/epics/080-execution-token-cost/blueprints/001-contract-gaps-final-review/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - review
  - cli
  - gate
timestamp: '2026-09-30T17:23:06.202+09:00'
bouncer:
  id: '001'
  epic_id: '080'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 001 실행 계약 보완과 리뷰 횟수 축소

Epic: [080](../../index.md)

## Intent
coordinator가 플러그인 소스를 읽지 않고 지침과 CLI 출력만으로 drive를 진행하게 한다.
리뷰를 task마다 열지 않고 blueprint의 마지막 검증 시점에 한 번만 연다.

## Contract
- 인터페이스
  - `bouncer subagent-model --agent <name> [--provider <p>]`: stdout 한 줄에 model slug 또는 `inherit`.
  - `bouncer codex-agents check --agent <name>`: `{ ok, agent, in_sync, path }` JSON, 불일치면 exit 1이고 `reason`·`next`가 더해진다.
  - `bouncer coordinate …` 실패 JSON: `{ ok: false, reason, cause, next }`. `reason` 값은 바뀌지 않는다.
  - `bouncer review-dispatch execute --blueprint <dir> --base <sha> --head <sha>`: `--task`를 생략하면 blueprint 범위로 분류한다.
  - `bouncer coordinate repair … --review-finding <id>`: 최종 리뷰 must_fix를 repair task로 연다.
  - gate 코드 `G21`: finalize gate의 blueprint 리뷰 판정.
- 데이터·상태
  - blueprint 리뷰 모드: blueprint `index.md`의 `bouncer.review_scope`가 `blueprint`인 상태. 새 scaffold는 full·light 모두 이 필드와 루트 `review.md`(type `bouncer.review`, id `REVIEW-<blueprint id>`)를 쓰고 task 묶음에는 `tasks.md`·`verification.md`만 둔다.
  - `review_scope` 필드가 없는 blueprint는 기존 계약(task별 `review.md`, G8·G14·S17)을 그대로 따른다. 구형 레이아웃이 루트에 둔 `review.md`는 모드 판정에 쓰이지 않는다.
  - 루트 리뷰의 `rounds[].target`은 그 라운드를 시작할 때 고정한 base와 head다. 리뷰 수정 뒤의 delta 라운드는 수정이 반영된 head를 새로 고정한다. 라운드는 commit task id를 키로 `task_brief_hashes`(brief hash)와 `intent_bundles`(`{ id, revision }`)를 기록한다.
- 수용 기준: epic Success criteria 1~9.
- 검증 명령: 구현 task는 `npm test`, 종단 task 008은 `npm run ci`.
- 실패 모드·엣지 케이스
  - 종단 verification task가 없는 blueprint는 마지막 commit task 통합 뒤에 최종 리뷰를 연다.
  - 최종 리뷰의 must_fix는 repair task 하나로 묶어 수정하고 delta 인증만 한다. 발견 라운드를 다시 열지 않는다.
  - repair wave 상한 2회는 종단 CI 실패와 리뷰 수정이 함께 쓴다. 상한을 다 쓴 뒤 must_fix가 남으면 coordinator는 열린 finding과 함께 `blocked`로 끝낸다.
  - 단독 실행의 must_fix 수정은 포인터 task의 `affected_paths` 안에서만 한다. 그 밖의 파일이 필요하면 사용자에게 보고하고 `/bouncer-plan`으로 돌린다.
  - 단독 `/bouncer-execute`는 마지막 commit task의 verify 뒤에 최종 리뷰를 한다. stale 검사는 coordinator 원장이 있는 drive에서만 한다.
  - 이 blueprint 자체는 이전 scaffold로 만들어져 task별 리뷰 계약으로 실행된다.

## Out of scope
- epic Out of scope 전부.
- `scripts/src/lib/subagents.ts`의 model 해석 규칙과 `mdToCodexToml`의 변환 결과.
- G21 외 gate 코드의 번호와 메시지.

## One-commit justification
- task 7개가 각각 한 커밋이다. 리뷰 문서의 위치를 옮기는 변경은 gate 인식(003) → scaffold(004) → 분류·repair(005) → 지침(006) 순으로 이어져야 중간 커밋마다 `npm test`가 통과하므로 한 PR로 묶는다.
- 실행 계약 보완 세 task(001·002·007)는 같은 coordinator 지침과 `rules/cli.md`를 고쳐 003~006과 파일이 겹친다.

## Documents
* [001 CLI 명령 대체](tasks/001/tasks.md) - 내부 함수 지시를 CLI 명령으로 바꾼다
* [002 coordinate 실패 힌트](tasks/002/tasks.md) - 실패 JSON에 원인과 다음 행동을 싣는다
* [003 blueprint 리뷰 인식과 gate](tasks/003/tasks.md) - 루트 리뷰 문서를 인식하고 G21을 더한다
* [004 scaffold와 finalize 정리](tasks/004/tasks.md) - 새 문서 세트를 만들고 마감 때 정리한다
* [005 blueprint 범위 분류와 리뷰 repair](tasks/005/tasks.md) - 분류기와 repair를 blueprint 리뷰에 맞춘다
* [006 워크플로 지침](tasks/006/tasks.md) - 역할 문서·스킬·규칙을 최종 리뷰 1회로 바꾼다
* [007 rounds 예제](tasks/007/tasks.md) - 완결된 리뷰 기록 예제를 둔다
* [008 종단 검증](tasks/008/tasks.md) - 통합 뒤 전체 CI
* [Context review](context-review.md) - 계획 문서 정합성 판정
