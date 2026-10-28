---
type: bouncer.blueprint
title: run 진행 판별을 task id 집합으로 바꾸고 coordinator 판정 규칙을 보강함
description: bouncer-run step 4가 task id 집합으로 진행을 판별하고, coordinator·implementer 문서가 식별자 복사·금지 위반 편차·fixture 고정 규칙을 갖게 한다.
resource: .bouncer/context/epics/drive-execution/blueprints/progress-id-set-judge-rules/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-28T15:09:30.345+09:00'
bouncer:
  id: progress-id-set-judge-rules
  epic_id: drive-execution
  blueprint_id: progress-id-set-judge-rules
  status: closed
  order: 71
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: bouncer-run step 4 진행 판별과 coordinator·implementer 판정 규칙은 bouncer-run 단계 동작이다
  supersedes: []
---
# run 진행 판별을 task id 집합으로 바꾸고 coordinator 판정 규칙을 보강함

Epic: [drive-execution](../../index.md)

## Intent
run step 4가 `completed_tasks` 개수 대신 디스패치 직전 id 집합과 비교해 새 id가 있으면 진행으로 판별하게 하여, task 재개방 뒤 개수가 같을 때 정상 진행을 `no-progress`로 읽던 문제(#287)를 막는다. coordinator·implementer 역할 문서와 Codex TOML에 rework 식별자 원문 복사, 금지 위반 편차 거부, provider·env 고정 fixture 규칙을 넣어 #283의 연쇄 rework를 줄인다.

## Contract
- 인터페이스: 공개 CLI·스키마 변경 없음. 바뀌는 것은 `skills/bouncer-run/SKILL.md` step 4 판별 문장과 두 역할 문서(`agents/bouncer-coordinator.md`, `agents/bouncer-implementer.md`) 본문, 그 생성본 `.codex/agents/*.toml`이다.
- 데이터·상태: 원장·checkpoint 형식은 그대로다. `checkpoint.completed_tasks`를 개수가 아니라 id 집합으로 읽는다.
- 수용 기준: epic Success criteria 17을 만족한다.
- 검증 명령: commit task별 `node --test test/skill-bouncer-run.test.js`, `node --test test/agents.test.js`. terminal은 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `--resume-task`로 재개방된 task가 빠지고 다른 task가 통합되어 개수가 같다 → 새 id가 있으므로 진행.
  - id 집합이 같고 ledger hash만 바뀐다 → 기존대로 `no-progress`.
  - recovery re-dispatch 1회 예외와 "두 번째 `continue`도 새 id가 없으면 `no-progress`" 규칙은 그대로 유지한다.
  - 금지 위반 편차를 rework로 되돌릴 수 없으면 Open choice 수락이 아니라 `blocked`로 올린다.
  - worker가 이미 어긴 Do not touch 항목·Constraint는 사용자가 명시적으로 승인한 경우에만 `coordinate revise --release-do-not-touch`로 푼다. 이 경우에 한해 coordinator 규칙이 `revise` 카드보다 우선한다.

## Out of scope
- CLI 코드(`packages/cli/src/**`) 변경. 무트레일러 커밋 판별(2-1)은 `untrailered-worker-commit`이 맡았다.
- no-progress·worker 상태 표의 행 구조 변경.
- coordinator 카드(`references/coordinator-cards/**`)와 `rules/cli.md` 개정.
- CHANGELOG·버전 변경.

## One-commit justification
- 문서 규칙 세 곳과 그 단언 테스트, 생성 TOML만 바뀌는 한 PR이다. 두 commit task는 경로가 겹치지 않아 병렬로 돌고, terminal 검증 하나로 함께 닫힌다.
