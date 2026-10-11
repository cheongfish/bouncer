---
type: bouncer.epic
title: DeepSWE 어려운 과제 기반 벤치마크 전환
description: 벤치마크를 ledger 합성 과제에서 DeepSWE의 어려운 상류 과제로 옮겨 vanilla와 bouncer-full의 차이가 드러나게 한다
resource: .bouncer/context/epics/094-deepswe-benchmark/index.md
tags:
  - bouncer
  - epic
  - benchmark
  - deepswe
  - harness
timestamp: '2026-10-11T21:34:13.042+09:00'
bouncer:
  id: '094'
  epic_id: '094'
  status: approved
  supersedes: []
---
# 094 DeepSWE 어려운 과제 기반 벤치마크 전환

## Intent
ledger 합성 과제와 fastify-001에서 vanilla가 매번 만점을 받아 Bouncer의 이득을 측정할 수 없었음.
이 epic은 ledger 자산을 모두 걷어내고, DeepSWE(Apache-2.0)의 어려운 과제 4개를 공식 환경 이미지와 공식 채점기로 vanilla·bouncer-full 두 조건에서 실행하게 함.

## Success criteria
1. `git grep -il -E 'ledger-00|ledger-cli|ledger-v2' -- benchmarks test ':!benchmarks/configs/fastify-001-evaluator-policy.json'`이 아무 파일도 출력하지 않는다. 추적 파일만 보므로 gitignore된 `benchmarks/runs/`·`benchmarks/fixtures/upstream/`의 유무와 상관없다. fastify-001 정책의 ledger 언급(승인 기록과 `plan.light_scope` 판단 문구)은 승인된 정책 본문이라 그대로 남는다.
2. `benchmarks/acp/responder.test.cjs`의 재생 fixture는 fastify-001 실행 녹취와 `rules/acq.md` 형식의 합성 원문만 쓰고, 판독 블록 응답·엄격 제목 응답·계약 위반 멈춤을 각각 하나 이상의 사례로 검사한다.
3. `run-cursor.cjs`·`run-bouncer-full.cjs`·`stage-args.cjs`는 `--task`가 없으면 에이전트 요청 전에 0이 아닌 코드로 끝난다.
4. DeepSWE 과제 파일은 저장소에 추적하지 않는다. 고정한 DeepSWE 커밋과 과제 목록만 추적하고, 준비 명령이 과제 파일·작업 공간 번들·의존성 파일을 gitignore된 `benchmarks/fixtures/deepswe/`에 만든다.
5. 네 과제 `deepswe-quill-001`(TypeScript), `deepswe-expr-001`(Go), `deepswe-statemachine-001`(Python), `deepswe-oxvg-001`(Rust) 각각에서 정답 확인 명령이 손대지 않은 작업 공간은 `reward` 0, `solution/` 적용은 `reward` 1로 채점한다.
6. DeepSWE 과제의 vanilla 에이전트는 과제 이미지에 cursor-agent를 얹은 이미지에서, bouncer-full 에이전트는 여기에 플러그인까지 얹은 이미지에서 실행된다. 두 실행기(`run-cursor.cjs`, `run-bouncer-full.cjs`)의 `run.json` `image_id`는 그 과제별 이미지를 가리킨다.
7. DeepSWE 채점은 과제 `tests/Dockerfile` 이미지를 네트워크 없이 실행한 공식 `tests/test.sh` 결과이고, `run.json`에 `reward`(주점수), `f2p_passed`·`f2p_total`·`p2p_passed`·`p2p_total`, `apply_failed`, `deviations: ["agent_network"]`가 남는다. `reward.json`이 없으면 `judge_status`는 `unjudgeable`이다.
8. 제출 patch는 기준 커밋 대비 작업 트리 diff이며 `.bouncer/`·`.worktrees/`·실행기가 복사한 파일을 포함하지 않는다.
9. bouncer-full 실행의 `--timeout-minutes`는 단계 합계 예산이고 기본값은 180분이며, 실행은 그 예산을 넘겨 다음 단계를 시작하지 않는다. bootstrap 검사는 정책 `task_facts.base_branch`를 기준 브랜치로 쓴다.
10. 새 `test/*.test.js`는 `test/tiers.json`에 배정되고, CHANGELOG `[Unreleased]`에 BP별 항목이 있으며, `npm run ci`가 통과한다.

## Out of scope
- 유료 측정 실행과 결과 보고서 작성. 측정은 BP 002 finalize 뒤 별도로 진행한다.
- Pier/Harbor 프레임워크 도입, Modal 실행, 에이전트 네트워크를 API 도메인으로 제한하는 방화벽.
- DeepSWE 나머지 109개 과제와 Epoch AI가 결함으로 꼽은 23개 과제.
- `scripts/src/**`의 coordinator 원장(이름만 같은 다른 개념)과 `.bouncer/context/**` 이력 문서.
- fastify-001 과제 카드·평가자 정책·상류 커밋 과제 빌더(`build-upstream-task.cjs`)의 변경. 실행기 공통 변경(bouncer-full 시간 예산, 제출 diff 제외 경로)은 fastify-001 실행에도 적용되는 의도된 변경이다.
- 로컬 `benchmarks/runs/` 실행 기록 삭제. gitignore된 로컬 데이터라 커밋 대상이 아니며 BP 001 finalize 뒤 main checkout에서 수동으로 지운다.

## Blueprints
* [001 ledger 벤치마크 제거](blueprints/001-ledger-removal/index.md) - 응답기 fixture를 fastify 녹취·합성 원문으로 바꾸고 `benchmarks/`·`test/`의 ledger 과제·정책·검증기·보고서와 참조를 지운다.
* [002 DeepSWE 어댑터](blueprints/002-deepswe-adapter/index.md) - DeepSWE 과제 준비 명령, 과제별 에이전트 이미지, 공식 채점기 연결, 과제 4개 카드와 정책을 `benchmarks/`에 더한다.

## Execution order
BP 001 → BP 002 순서로 실행한다. 두 BP가 같은 실행기와 `task-card` 테스트를 고치므로 BP 001 finalize 뒤에 BP 002를 시작한다. 두 BP 모두 fastify-001 실행 환경 수정 PR(#191)이 develop에 병합된 뒤 시작한다.
