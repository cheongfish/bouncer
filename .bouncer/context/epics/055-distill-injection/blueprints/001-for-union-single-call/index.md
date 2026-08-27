---
type: bouncer.blueprint
title: Distill 재접지를 다중 --for 단일 호출로 전환
description: 재접지 지시 네 곳과 core 샤드를 단일 호출 형태로 바꾸고 다중 --for 합집합 계약을 테스트로 고정
resource: .bouncer/context/epics/055-distill-injection/blueprints/001-for-union-single-call/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-27T10:49:42.247+09:00'
bouncer:
  id: '001'
  epic_id: '055'
  blueprint_id: '001'
  status: approved
  commit_type: refactor
  scale: full
  supersedes: []
---
# 001 for-union-single-call

Epic: [055](../../index.md)

## Intent
- 문제: `bouncer distill --for`는 플래그를 반복 지정하면 합집합을 중복 없이 한 번만 내는데, 지시문 네 곳이 경로마다 따로 부르라고 쓰여 있다. 그래서 `always` 샤드와 공통 `pulls`가 경로 수만큼 반복 주입된다.
- 완료 조건: 지시문 네 곳과 `.bouncer/distill/core.md`가 단일 호출을 지시하고, 그 호출이 합집합을 중복 없이 낸다는 단언과 플래그 없는 경로 나열을 거부한다는 단언이 테스트에 있으며, `npm run ci`가 통과한다.

## Contract
- 인터페이스: 재접지는 확정 경로 수와 무관하게 `bouncer distill --for <path> [--for <path> …] --repo "${PROJECT_ROOT}"` 를 **한 번** 호출한다. 유효한 다중 경로 표현은 플래그 반복형 하나뿐이다.
- 데이터·상태: 문서와 테스트만 바뀐다. 샤드 인덱스, `distill.routing_enabled`, 선택 알고리즘, 출력 포맷은 그대로다.
- 수용 기준: epic Success criteria 1–5.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `--for a b`처럼 플래그 뒤에 경로를 나열하면 stdout이 비고 stderr `distill: unexpected argument: b`, 종료 코드 2다. 새 예시가 이 형태로 새면 지시문이 실행 불가능해진다.
  - 확정 경로가 하나뿐인 회차도 같은 문구로 성립한다. 「전부를 한 번에」가 「둘 이상일 때만」을 뜻하지 않는다.
  - 경로 집합이 넓으면 합집합이 등록 샤드 전체와 같아질 수 있다. 그렇더라도 `--all` stdout을 컨텍스트에 넣지 말라는 금지는 유지된다.
  - `test/master-rules.test.js:149,151`은 `/bouncer-run`의 재접지 문장이 아니라 105–106줄 구현자 인계 문장을 단정한다. 22줄을 바꿔도 그대로 통과하므로 손대지 않는다. 대신 반복 문구가 되살아나지 못하게 잠그는 블록이 없으면 다음 변경에서 그대로 되돌아간다.
  - `.bouncer/distill/core.md`는 등록 샤드라 `scope.makeAllowed`가 자동으로 열어 주지 않는다. `affected_paths`에 명시하지 않으면 commit-safety가 막는다.

## Out of scope
- `scripts/src/lib/cli-project-commands.ts` 인자 파서·라우팅 구현.
- `--route` 선택 ids 사전 확인 절차.
- `--all` baseline 파일 계약.
- `skills/spec-authoring/SKILL.md`의 `--for` 소비 문구.
- 재접지 블록의 `rules/` 정본화 — epic 054 소관.

## One-commit justification
- task 001은 이미 있는 동작을 계약으로 고정하고, task 002는 그 계약에 기대어 지시문을 바꾼다. 두 의도를 한 커밋에 담으면 `.gitmessage`의 「한 커밋에는 하나의 의도만」을 어기고, 순서를 뒤집으면 002가 근거 없이 문구만 바꾸는 커밋이 된다. 리뷰·PR 단위는 이 blueprint 하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 다중 `--for` 합집합·중복 제거 계약 고정
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 재접지 지시 단일 호출 전환
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
