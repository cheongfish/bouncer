---
type: bouncer.blueprint
title: plan coordinator와 planner 위임 구조
description: Delegate bouncer-plan work to a standard-tier plan coordinator that dispatches discovery evidence, a strong-tier planner, and adversarial reviewers while the root keeps every user approval.
resource: .bouncer/context/epics/plan-workflow/blueprints/plan-coordinator/index.md
tags:
  - bouncer
  - blueprint
  - plan-coordinator
  - planner
  - plan-ledger
timestamp: '2026-10-28T08:25:25.207+09:00'
bouncer:
  id: plan-coordinator
  epic_id: plan-workflow
  blueprint_id: plan-coordinator
  status: closed
  order: 37
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: bouncer-plan 단계를 plan coordinator·planner 위임 구조로 바꾸는 계획 단계 동작이라 귀속
  supersedes: []
---
# plan-coordinator

Epic: [plan-workflow](../../index.md)

## Intent
- `/bouncer-plan` root가 discovery·작성·리뷰 판정을 모두 직접 하느라 문맥이 1.3~1.8M 캐시 읽기까지 쌓이고 작성자와 판정자가 같은 세션이라, 여러 BP를 이어 계획하기 어렵고 리뷰 판정이 작성 의도에 끌린다.
- standard 등급 plan coordinator가 evidence·strong 등급 planner·적대적 리뷰를 맡고 root는 사용자 확인과 승인만 하도록 역할·ledger·워크플로 문서를 바꾼다.

## Contract
- 인터페이스:
  - CLI `bouncer plan-ledger <open|status|record|ask|answer|close>`(TASKS-001 Interface가 정본).
  - 새 named agent `bouncer-planner`, `bouncer-plan-coordinator`. `subagent-model --agent`, `dispatch print --role planner|plan-coordinator`, Claude 훅, Codex TOML, init 템플릿이 기존 다섯 역할과 같은 계약으로 받는다.
  - `/bouncer-plan` 흐름: root → plan-coordinator(evidence → 범위 체크포인트 반환) → root ACQ·답변 기록 → 새 plan-coordinator 세션(planner 작성 → 리뷰 → planner 이어 쓰기 1회 → delta) → root 승인·gate.
- 데이터·상태: plan ledger `.bouncer/runtime/plan-ledgers/pl-<16hex>.json`(main worktree). 요청, phase(앞으로만 진행), blueprint(scaffold 뒤 한 번만 묶임), 질문·답변, planner 세션 핸들과 이어 쓰기·수정 횟수, note. 리뷰 라운드는 context-review cycle 상태가 소유한다. 모든 mutation은 ledger 경로·sha256 fence와 lock을 거친다. 기록 주체: coordinator가 `ask`·phase·blueprint·planner·note를, root만 `open`·`answer`·`close`와 `context-review close`를 실행한다. context review close용 dispositions는 coordinator가 `.bouncer/runtime/plan-ledgers/<id>.dispositions.json`에 쓰고 root가 `--dispositions`로 넘긴다(CLI는 호출자를 구분하지 않아 역할 문서 금지로 지킨다). planner는 ledger에 쓰지 않는다.
- 수용 기준: epic Success criteria 20~23이 참이다.
- 검증 명령: 각 task는 자기 테스트만, 종단 task는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 사용자 질문으로 멈춘 뒤에는 새 coordinator 세션이 `plan-ledger status`의 phase에서 이어 가며, 이전 세션 대화에 기대지 않는다.
  - planner 이어 쓰기가 host에서 안 되면 새 planner를 띄우고 ledger에 `fresh`를 남긴다. 같은 세션 이어 쓰기(`continued`)는 1회, 작성 중 재개(`resume`)는 세지 않고, planner 수정 기록(`continued`+`fresh`)은 context review 최초 cycle과 restart 1회에 맞춰 최대 2회이며 넘으면 CLI가 `plan-ledger-revision-limit`으로 거절한다. 리뷰 라운드 상한은 `context-review` CLI가 판정한다.
  - fallback으로 넘어가면 root는 ledger phase를 따른다. 이미 scaffold된 문서는 draft로 이어 쓰고, review 중이면 `context-review route`의 `next_action`을 따른다. fallback도 `plan.approval` 없이 승인하지 않는다.
  - planner가 체크포인트에서 확인된 후보 경로 밖을 필요로 하면 작성을 멈추고 `needs_user`로 돌아가 root가 `plan.affected_paths`를 다시 묻는다.
  - coordinator가 서브에이전트를 띄우지 못하면 `blocked: nesting-unavailable`을 반환하고 root가 같은 phase부터 기존 직접 계획 절차로 잇는다.
  - 빈 등급 매핑은 `tier-unmapped`로 멈추고 다른 모델로 대체하지 않는다.
  - coordinator·planner는 승인·accepted-risk·범위 확정을 하지 않는다. ACQ와 `plan approve`·`current --set`·`validate --gate plan`은 root만 실행한다.

## Out of scope
- run 단계 `bouncer-coordinator` 동작·문서와 run coordinator ledger.
- 새 ACQ gate id와 `benchmarks/configs/*-evaluator-policy.json`.
- 실측 실행과 결과 기록, planner 등급 자동 상향.
- `context-migration-rewrite.ts`의 `.bouncer/runtime/plan-*` 캐시 주석 정리.
- `CHANGELOG.md`·버전 파일.
- 실행 순서: 이 blueprint는 `plan-session-metrics`(세션 kind `plan-coordinator-session`·`planner-session`)가 병합된 뒤 실행한다. 병합 SHA가 아직 없어 `prerequisites`로 걸지 않았다.

## One-commit justification
- ledger CLI·역할 등록·워크플로 문서는 "plan 단계를 coordinator에게 위임한다"는 한 계약의 세 면이라 하나만 들어가면 흐름이 동작하지 않는다. 001(ledger CLI) → 002(역할 등록, `cli-usage.ts`·`rules/cli.md`를 001과 공유) → 003(문서, 001·002의 명령·역할 이름 사용) → 004 종단 CI 순서다.
