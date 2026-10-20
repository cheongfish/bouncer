---
type: bouncer.epic
title: 워크플로 상태 전이 사전 거절
description: Reject invalid Bouncer workflow state transitions in the CLI before mutation and align skill contracts.
resource: .bouncer/context/epics/workflow-transition-guards/index.md
tags:
  - bouncer
  - epic
  - coordinator
  - repair
  - pointer
  - ledger
timestamp: '2026-10-18T14:00:19.445+09:00'
bouncer:
  id: workflow-transition-guards
  epic_id: workflow-transition-guards
  status: approved
  supersedes: []
---
# 워크플로 상태 전이 사전 거절

## Intent
- 문제: ontology CLI 실행(blueprint 111/002)에서 coordinator가 잘못된 복구 task 값으로 세 번 재배정했다. 커밋 전에 결과를 기록했고, 재준비 과정에서 미커밋 수정을 잃었다. 병합 뒤에는 포인터와 ledger가 남아 메인 커밋이 막혔다. 원인은 각 전이를 CLI가 받아들이고 순서를 문서 지시에만 맡긴 데 있다.
- 목표: 복구 task 생성, report·record, revoke·prepare, 포인터 설정, 병합 뒤 실행 분리에서 잘못된 전이를 CLI가 mutation 전에 거절하고 `next`로 올바른 행동을 안내한다. 스킬과 agent 문서도 같은 계약을 따른다.

```mermaid
flowchart LR
  A[포인터 설정] --> B[준비]
  B --> C[구현·커밋]
  C --> D[보고·기록]
  D --> E[통합]
  E --> F[종단 검증]
  F --> G[복구 task]
  G --> B
  E --> H[병합 뒤 분리]
```

## Success criteria
1. `scoped_terminal` blueprint에서 `bouncer coordinate repair`는 task 전용 `--verify`가 없거나, 단일 argv가 아니거나, 종단 명령과 같으면 ledger·문서를 바꾸지 않고 거절한다. legacy blueprint에서 `--verify`를 주지 않으면 repair verify 결정은 지금과 같고, `--verify`를 주면 단일 argv 검사만 적용한다.
2. repair와 `coordinate revise`의 경로는 integration HEAD에 추적된 파일(또는 추적 파일이 있는 디렉터리)이어야 하고, 새 파일은 `--new-path`로만 허용한다. 그 밖의 경로는 mutation 전에 거절된다.
3. 재검증 실패 증거의 `paths`는 복구 task의 현재 scope revision 경로다.
4. `coordinate report --outcome accepted`와 `coordinate record`는 worker 커밋이 없거나, `commit_sha` stamp가 HEAD와 다르거나, scope 안 파일이 dirty이면 ledger를 바꾸지 않고 거절하며 `next`를 낸다.
5. `worker-evidence-sha-mismatch`의 `cause`·`next`는 실제 원인(stamp와 기록 SHA 불일치)과 복구 경로를 말한다.
6. revoke 뒤 `prepare`는 dirty하거나 미통합 커밋이 있는 worker를 지우기 전에 patch와 salvage ref로 보존하고 출력에 그 위치를 싣는다. 보존에 실패하면 아무것도 지우지 않는다.
7. base checkout에서 `bouncer current --set`이 새 key를 더해 선택을 ambiguous로 만들면 아무것도 바꾸지 않고 `CURRENT_WOULD_BE_AMBIGUOUS`로 거절한다. `--replace`와 `--keep-others`는 명시적으로만 동작한다. `CURRENT_AMBIGUOUS` 출력에는 `next`가 있다.
8. 사용자가 승인한 `bouncer run detach --blueprint <dir> --yes`는 ledger와 worktree를 보존한 채 `detached`를 기록하고 해당 key 하나만 지운다. 그 뒤 메인 커밋은 `main-worktree-source-write`로 막히지 않고, detached ledger에 대한 coordinator mutation은 거절된다. detach는 검증 성공이나 finalize로 기록되지 않는다.
9. 각 문제는 실제 상태 전이를 거치는 회귀 테스트로 재현되고, 정상 복구·사용자 승인 경계·ledger 보존 테스트가 계속 통과한다.
10. 종단 `npm run ci`가 exit 0으로 끝난다. 여기에는 `test/commit-hook.test.js` 테스트 이름 형식 수정이 포함된다.
11. 새 거절 코드와 새 플래그가 각각 `rules/cli.md`에 문자열로 나타나고(`rg -F` 확인), 새 플래그는 해당 CLI usage 테스트(`test/cli-help.test.js`·`test/cli-current.test.js`·`test/cli-coordinate.test.js`)에서 단언되며, `npm run lint:docs`가 통과한다.
12. status가 `integrated`인 task에 `reported` dispatch만 남은 ledger에서 `bouncer run detach --yes`가 성공한다. `prepared`·`recorded` task나 integrated가 아닌 task의 `active`·`reported` dispatch가 있으면 계속 `detach-worker-in-flight`로 거절한다.
13. `run detach`의 모든 거절(`detach-confirmation-required`, `detach-awaiting-confirmation`, `detach-worker-in-flight`, `no-ledger`, `unreadable-ledger`, `ledger-locked`, `ledger-lock-lost`)은 `cause`·`next`를 갖는다. ledger 쓰기 전의 거절은 ledger와 포인터 바이트를 바꾸지 않고, 쓰기 직전에 잠금을 잃은 detach는 ledger를 쓰지 않는다. 쓰기 뒤 잠금 해제 실패로 나는 `ledger-lock-lost`는 재실행으로 `already: true`를 확인하라는 `next`를 갖는다.
14. `coordinate revise`의 모든 거절은 stdout JSON `{ ok: false, reason, cause, next }`(경로 거절은 `paths` 포함)와 exit 1로 끝난다. `CURRENT_WOULD_BE_AMBIGUOUS` 출력에는 `cause`가 있다.
15. worker scope 안에 커밋할 변경이 있으면 `coordinate next`는 `commit`을 고른다. stamp가 낡았지만 tree가 깨끗하면 `blocked`와 `worker-commit-stamp-mismatch`를 낸다.
16. ledger `status` 타입에 `detached`가 있고, `detached` 비교를 위한 문자열 cast가 없다. `npm run typecheck`가 통과한다.
17. `coordinate revise`와 `coordinate repair`에 pathspec magic 경로(`:!x`, `:(icase)…`, `:/`)를 넘기면 `scope-path-untracked`로 거절된다.
18. `salvageRevokedWorker`와 `cmdCurrent` 정리 뒤에도 기존 salvage·current 테스트가 수정 없이 통과한다.
19. `bouncer review accept-risk --blueprint <dir> --finding <id> --note <text> --yes`는 blueprint 최종 리뷰의 open finding 하나를 round 추가 없이 위험 수용으로 닫는다. 남은 open finding이 없을 때만 문서를 `accepted`로 바꾸고, `--yes`가 없으면 아무것도 바꾸지 않는다. 그 결과 문서는 G21을 통과한다.
20. 새 거절 코드와 `review accept-risk`가 `rules/cli.md`에 나타나고, CHANGELOG `[Unreleased]`에 항목이 있으며, 새 테스트 파일은 `test/tiers.json`에 등록된다. 종단 `npm run ci`가 exit 0으로 끝난다.

## Out of scope
- ontology 검색 동작 변경.
- `CT-001` 테스트 보강(`test/cli-ontology.test.js`).
- blueprint 111의 ledger·worktree·문서 수정이나 재사용.
- Git 병합을 finalize나 검증 성공으로 간주하는 동작.
- 안전 검사 우회, 포인터 일괄 삭제.
- detach를 되돌리는 re-attach 명령.
- drive metrics의 예외 집계 변경.
- repair 뒤 재dispatch의 `commit-evidence-mismatch` 수동 복구, `recent_failure.repairWave` 집계, worker 절대경로 `missing-blueprint`, task 단계 lint 시점 조정.
- task 리뷰(`tasks/<NNN>/review.md`)의 위험 수용 종료.
- `finalize-release-main.ts`·`intent-provenance.ts`의 `ls-files` pathspec 처리, revise와 repair의 glob 검사 차이.
- `scripts/lib/` 빌드 산출물 커밋.

## Blueprints
* [001 워크플로 상태 전이 가드](blueprints/transition-guards/index.md) - repair·report·record·prepare·current·run detach의 사전 거절 가드와 스킬 계약 (`scripts/src/lib/`, `rules/`, `skills/`, `agents/`)
* [002 전이 가드 후속 보완](blueprints/transition-guard-followups/index.md) - detach 판정·거절 shape, revise 거절 출력, next의 commit 선택, literal pathspec, 정리 리팩터, 최종 리뷰 위험 수용 명령 (`scripts/src/lib/`, `rules/`, `references/`, `skills/`)
