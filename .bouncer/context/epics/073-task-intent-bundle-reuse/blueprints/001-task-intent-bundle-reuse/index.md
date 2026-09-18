---
type: bouncer.blueprint
title: Task intent bundle 재사용 경계
description: Reuses validated task intent bundles across execute roles and revises them only when relevant function or Explain inputs change.
resource: .bouncer/context/epics/073-task-intent-bundle-reuse/blueprints/001-task-intent-bundle-reuse/index.md
tags:
  - bouncer
  - blueprint
  - intent
  - execute
  - cache
timestamp: '2026-09-17T22:11:49.984+09:00'
bouncer:
  id: '001'
  epic_id: '073'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Task intent bundle 재사용 경계

Epic: [073](../../index.md)

## Intent

같은 함수 의도를 구현·복구·리뷰 단계마다 다시 해석하고 Explain 본문을 복제하는 비용을 없앰. 검증된 bundle을 재사용하되 관련 함수나 선택 절이 달라지면 새 revision으로 분리함.

## Contract

- 인터페이스: 기존 `bouncer intent --symbol`을 유지하고 `bouncer intent bundle --task <tasks.md> --symbol <name>... [--candidate <qualified-ref>]... [--repo <dir>]`를 추가한다. bundle 명령은 `created` 또는 `reused`, bundle ID, revision, task brief hash와 결정적 function entry 목록을 JSON 하나로 반환한다.
- 데이터·상태: bundle은 Git common directory 아래 Bouncer runtime에 저장한다. 실행 Task stable ID를 cache 소유자로 쓰고, 모든 entry는 status, function ref와 blob SHA를 가진다. 연결된 provenance entry는 stable Task ID, 40자리 commit SHA, Explain 경로와 freshness를 추가로 가지며, non-historical entry만 선택 절 이름과 SHA-256 hash를 가진다. `unresolved`·`unlinked` entry에는 존재하지 않는 provenance 필드를 합성하지 않는다. bundle ID는 순서를 정규화한 내용의 SHA-256이며 revision은 같은 실행 Task의 유효 내용이 달라질 때만 증가한다.
- 재사용 판정: 저장된 function ref가 현재 source 정의와 같은 blob을 가리키고 저장된 Explain 절의 현재 hash가 모두 같으며 요청 함수 집합도 같을 때만 `reused`다. 이 fast path는 `git blame`과 `git log --follow`를 실행하지 않는다. 어느 값이든 달라지거나 cache가 없거나 손상되면 resolver 결과로 전체 bundle을 원자적으로 다시 쓰고 `created`를 반환한다.
- 역할별 입력: implementer는 현재 task brief authority와 bundle ID를 받는다. debugger는 task brief hash, bundle ID, 실패 evidence와 Goal & intent·Interface·Touch·Do not touch·Constraints·Checklist만 받는다. reviewer는 task brief hash, bundle ID, frozen diff·최신 verify와 같은 브리프 절만 받는다. 어느 역할에도 Explain 전체 본문을 반복 전달하지 않는다.
- 수용 기준: Epic 성공 기준 1–7을 집중 테스트, workflow 구조 테스트와 전체 CI로 판정한다.
- 검증 명령: 각 Task의 집중 `node --test`를 실행한 뒤 Blueprint 통합 상태에서 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: 동명 함수 선택이 없으면 `ambiguous`를 그대로 반환하고 bundle을 쓰지 않는다. `unresolved`와 `unlinked`는 상태 entry로 보존하되 의도를 합성하지 않는다. `historical` candidate의 본문과 section hash는 저장하지 않는다. 요청 함수 중 하나라도 조회 오류면 부분 bundle을 쓰지 않는다. cache JSON, stable Task ID, hash, repo 경계 또는 Explain realpath가 유효하지 않으면 재사용하지 않는다. scope revision 뒤 함수 집합·blob·절 hash가 같으면 기존 revision을 유지하고, 관련 값이 달라진 경우에만 다음 revision을 쓴다.

## Out of scope

- reviewer 수와 security 관점 선택 정책 변경
- verification evidence cache와 coordinator ledger checkpoint 형식 변경
- task brief 본문이나 Explain을 bundle 저장소의 권한으로 승격
- intent candidate limit, 2,000-byte 본문 예산, freshness 분류와 SHA 저장 형식 변경
- 새 dependency, tokenizer telemetry와 기존 완료 context의 소급 변환

## One-commit justification

- 하나의 PR에서 bundle core, lazy CLI, execute dispatch 계약을 순차 커밋으로 결합해야 cache hit 판정과 실제 소비 payload를 함께 검토할 수 있다.

## Documents

* [Task 001](tasks/001/tasks.md) - intent bundle 내용 주소화와 재사용 판정
* [Task 002](tasks/002/tasks.md) - lazy CLI bundle 명령과 공개 회귀
* [Task 003](tasks/003/tasks.md) - execute 역할별 bundle 전달 계약
* [Context review](context-review.md) - 계획 문서 정합성 판정
