---
type: bouncer.blueprint
title: DeepSWE 과제 어댑터와 공식 채점 연결
description: Blueprint 002
resource: .bouncer/context/epics/benchmark-cost/blueprints/deepswe-adapter/index.md
tags:
  - bouncer
  - blueprint
  - benchmark
  - deepswe
  - docker
timestamp: '2026-10-11T21:34:13.297+09:00'
bouncer:
  id: deepswe-adapter
  epic_id: benchmark-cost
  blueprint_id: deepswe-adapter
  status: closed
  order: 13
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 DeepSWE 과제 어댑터와 공식 채점 연결

Epic: [094](../../../deepswe-benchmark/index.md)

## Intent
하네스는 Node 이미지 하나와 우리 검증기만 지원해 언어마다 환경과 채점기가 다른 DeepSWE 과제를 돌릴 수 없었음.
DeepSWE 과제를 고정 커밋에서 내려받아 과제 이미지 위의 에이전트 이미지로 실행하고 공식 채점기의 보상과 f2p 비율을 기록하게 하며, 어려운 과제 4개를 카드로 더함.

## Contract
- 인터페이스:
  - `node benchmarks/prepare-deepswe-task.cjs <card-id>`는 고정 DeepSWE 커밋에서 과제를 받아 `benchmarks/fixtures/deepswe/<card-id>.bundle`(작업 공간 bundle)과 `benchmarks/fixtures/deepswe/<card-id>/`(과제 파일·미추적 파일 묶음·`prepared.json`)을 만든다. 네트워크와 Docker가 필요하다.
  - `node benchmarks/check-deepswe-solution.cjs <card-id>`는 손대지 않은 작업 공간과 `solution/solution.patch`를 공식 채점기로 채점해 `{ untouched, solution }`를 출력한다.
  - 과제 카드에 `workspace_setup` 종류 `restore_untracked: <card-id>`가 생긴다.
  - `external_verifiers[].runtime: host`가 생기며, 이 검증기는 호스트에서 실행돼 docker를 직접 부른다.
  - `run-cursor.cjs`·`run-bouncer-full.cjs`는 DeepSWE 카드(`fixtures/deepswe/<card-id>/prepared.json`이 있는 카드)를 과제별 에이전트 이미지로 실행한다.
- 데이터·상태:
  - `benchmarks/deepswe/manifest.json`이 `{ repo, commit, tasks: { <card-id>: <deepswe task name> } }`을 고정한다.
  - `run.json`에 `reward`, `f2p_passed`, `f2p_total`, `p2p_passed`, `p2p_total`, `apply_failed`, `deviations`가 더해진다.
  - verifier 결과 `verifier.json`은 `{ judge_status, score, max_score: 100, outcome_success, reward, f2p_passed, f2p_total, p2p_passed, p2p_total, apply_failed, error }`이다. `score = reward * 100`, `outcome_success = reward === 1`이다. `deviations`는 `verifier.json`이 아니라 실행기가 `run.json`에 쓴다.
- 전제: PR #191이 병합된 develop(`68bf487a` 이후)과 BP 001 finalize 뒤에 시작한다.
- 수용 기준: epic 성공 기준 4–10.
- 검증 명령: `npm run ci`. 정답 확인과 이미지 빌드는 Docker·네트워크가 필요해 TASKS-004 수동 단계로 확인하고, 그 출력은 추적되는 `benchmarks/deepswe/README.md`의 `## 정답 확인 기록` 절에 남긴다.
- 실패 모드·엣지 케이스:
  - 이미지 pull·빌드 실패, `/app` HEAD가 `base_commit_hash`와 다름, 받은 `instruction.md` sha256이 카드와 다름. 모두 유료 요청 전에 0이 아닌 코드로 끝난다.
  - patch 적용 실패는 `judge_status: graded`, `reward: 0`, `apply_failed: true`로 기록한다.
  - 채점 시간 초과는 `reward.json` 유무와 상관없이 `judge_status: unjudgeable`(`verifier timeout`)이다. 시간 안에 끝났는데 `reward.json`이 없으면 `reward.txt` 값과 상관없이 `unjudgeable`이다. bouncer-full은 이 판정을 기록하고 정상 종료하며, 검증기 프로세스가 `verifier.json` 없이 실패할 때만 멈춘다.
  - 제출 diff는 vanilla가 작업 트리 모드, bouncer-full·아카이브 재채점이 `base..integration` 커밋 모드이고, 세 경로 모두 `.bouncer/`·`.worktrees/`·`restore_untracked`로 복원한 경로를 뺀다.
  - bouncer-full `--timeout-minutes`는 실행 전체 wall-clock 예산(1..240, 기본 180)이다. 남은 시간이 1분 미만이면 다음 단계를 시작하지 않고 `budget_exhausted`로 기록한다. 이때 증거 수집·제출 diff·채점을 하지 않고, 판정 필드는 `judge_status: unjudgeable`, `error: "budget exhausted"`, 나머지 보상 필드는 `null`이다.
  - 에이전트는 컨테이너 안에서 root로 돈다. 실행이 끝나면 작업 공간 소유권을 호스트 uid·gid로 되돌린다.

## Out of scope
- 유료 측정 실행과 네 과제 평가자 정책의 승인. 정책은 `proposed`로 들어가고 측정 전에 사용자가 승인한다.
- Pier/Harbor, Modal, 에이전트 네트워크 제한.
- fastify-001 과제 카드·평가자 정책, 상류 커밋 과제 빌더(`build-upstream-task.cjs`)와 `upstream-tests.cjs` 동작 변경. 단 epic Out of scope가 허용한 실행기 공통 변경(bouncer-full 전체 시간 예산, 제출 diff 제외 경로)과 이 BP의 공통 변경(정책 기준 브랜치, `unjudgeable` 기록 후 정상 종료, 검증기 항목 키 검사, `run.json` 보상·`image_id`·`deviations` 필드)은 fastify-001 실행에도 적용되는 의도된 변경이다.
- `scripts/src/**` 제품 코드.

## One-commit justification
- 준비 명령·이미지·채점기·카드가 모두 있어야 DeepSWE 과제 한 번이 끝까지 돈다. task 커밋은 각자 CI를 통과하고, 리뷰는 "DeepSWE 과제를 하네스에 붙이기" 한 단위로 본다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - DeepSWE 과제 준비 명령과 카드 작업 공간 원본
* [Tasks 002](tasks/002/tasks.md) - 과제별 에이전트 이미지와 실행기 연결
* [Tasks 003](tasks/003/tasks.md) - 공식 채점기 실행과 보상·f2p 기록
* [Tasks 004](tasks/004/tasks.md) - 과제 4개 카드·정책·정답 확인 명령과 문서
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
