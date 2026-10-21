---
type: bouncer.blueprint
title: ledger 벤치마크 제거
description: Blueprint 001
resource: .bouncer/context/epics/benchmark-cost/blueprints/ledger-removal/index.md
tags:
  - bouncer
  - blueprint
  - benchmark
  - ledger
  - responder
timestamp: '2026-10-11T21:34:13.167+09:00'
bouncer:
  id: ledger-removal
  epic_id: benchmark-cost
  blueprint_id: ledger-removal
  status: closed
  order: 12
  commit_type: refactor
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 ledger 벤치마크 제거

Epic: [094](../../../deepswe-benchmark/index.md)

## Intent
ledger 합성 과제는 vanilla도 만점을 받아 비교 가치가 없고, 응답기 회귀 fixture와 실행기 기본값이 ledger 자산에 묶여 있었음.
응답기 테스트를 fastify-001 녹취와 규칙 형식 합성 원문으로 옮긴 뒤 ledger 과제·정책·검증기·보고서와 그 참조를 지워 하네스가 fastify-001만으로 동작하게 함.

## Contract
- 인터페이스:
  - `run-cursor.cjs`·`run-bouncer-full.cjs`·`stage-args.cjs`의 `--task`는 필수다. 없으면 `--task is required`로 0이 아닌 코드로 끝나고 docker를 호출하지 않는다.
  - verifier 이미지 이름은 `bouncer-benchmark-verifier:local`이고 기본 ENTRYPOINT는 `verifiers/upstream-tests.cjs`다. 실행기는 지금처럼 `--entrypoint`를 명시한다.
- 데이터·상태:
  - `benchmarks/acp/fixtures/acq/cases.json` 항목 형식(`file`, `source`, `phase`, `workdir`, `reply`, `gates`, `expect`, 선택 `finalizeEvidence`)은 그대로다. `source`는 fastify-001 run id 또는 `synthetic:rules/acq.md`다.
  - `test/acq-gate-ids.test.js`·`responder.test.cjs`의 정책 목록은 `['fastify-001']`이다.
  - `benchmarks/verifiers/lib.cjs`는 `upstream-tests.cjs`가 쓰므로 남는다.
- 전제: fastify-001 실행 환경 수정 PR #191(develop `68bf487a`)이 병합된 develop에서 시작한다. fastify-001 정책은 `approved`이고 `init.pre_commit_hook` 답은 `install`이다.
- 수용 기준: epic 성공 기준 1·2·3·10.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - fixture 재생에서 판독 블록 `options`와 본문 선택지가 다르면 `violation`이어야 한다. 새 녹취가 모두 정상 형식이라도 위반 사례는 합성 원문으로 하나 이상 남긴다.
  - `task-card.test.cjs`는 gitignore된 `fixtures/upstream/` bundle에 기대지 않는다. bundle·workspace_setup 검사는 테스트가 만든 임시 git 저장소로 한다.
  - `lint:docs`가 지운 보고서·과제로 가는 링크를 끊어진 링크로 잡지 않게 문서 링크를 함께 고친다.

## Out of scope
- DeepSWE 과제·어댑터(BP 002).
- `fastify-001-evaluator-policy.json` 내용 변경. 승인 기록의 ledger 언급은 이력으로 남는다.
- `scripts/src/**`·`docs/`·`.bouncer/context/**`의 coordinator 원장 표현과 `CHANGELOG.md` 과거 항목.
- 로컬 `benchmarks/runs/` 삭제(커밋 대상 아님).

## One-commit justification
- 응답기 fixture 교체가 먼저 들어가야 ledger 정책을 지워도 `npm run ci`가 깨지지 않는다. 두 task는 한 리뷰 단위의 "ledger 의존 제거"이고, 각 task 커밋이 단독으로 CI를 통과한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 응답기 회귀 fixture와 테스트를 fastify-001 기준으로 교체
* [Tasks 002](tasks/002/tasks.md) - ledger 과제·정책·검증기·보고서와 참조 삭제
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
