---
type: bouncer.blueprint
title: 승격 커밋 검증과 파생 불릿 감사
description: finalize가 스테이징 전에 검증 명령을 실행하고, Distill 불릿 감사가 손으로 고친 목록에 의존하지 않게 한다
resource: .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-22T14:16:25.821+09:00'
bouncer:
  id: '001'
  epic_id: '044'
  blueprint_id: '001'
  status: approved
  commit_type: fix
  scale: full
---
# 001 promotion-verify

Epic: [044](../../index.md)

## Intent
- 문제: 승격 커밋이 검증을 거치지 않는데, 정작 그 검증에 승격할 때마다 손으로 갱신해야
  하는 고정 해시 목록이 들어 있다. 검증을 붙이기만 하면 매 사이클 finalize가 자기
  승격분 때문에 멈춘다.
- 완료 조건: 감사가 샤드 파일에서 기대값을 유도하고, `finalize --yes`가 스테이징
  전에 검증 명령을 실행해 실패 시 커밋하지 않으며, 다음 회차 측정 프로토콜에
  plan 단계 스냅샷 수집과 표본 조항 순서가 적혀 있다.

## Contract
- 인터페이스:
  - `finalize({ repoRoot, blueprintDir, yes, git, verifyExec })` — `yes`가 참이고
    커밋할 것이 있을 때만 검증 명령을 실행한다. 실패 형태는 하나다:
    `{ ok: false, reason: 'verify', code, command, exitCode }`. 명령을 해석하지 못한
    실패는 `command`/`exitCode`가 `null`이고 `code`가 해석 오류 코드다.
  - 명령 해석과 실행은 `verification.ts`의 기존 수출
    (`readVerifyCommand`, `executeVerify`)을 재사용한다. 새 해석 규칙을 만들지 않는다.
- 데이터·상태: 문서 프론트매터와 게이트 판정 항목은 그대로다. finalize의 검증은
  `verification.md`와 verify 원장(`<git-common-dir>/bouncer/verify/*.json`)에
  기록하지 않는다 — 승격 직전 사전 점검이지 task 증적이 아니다(하드 규칙 3).
- 수용 기준: epic Success criteria 1–4.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - dry-run(`--yes` 없음)은 검증을 실행하지 않는다. 읽기 전용 보고가 몇 분짜리
    테스트를 끌고 오면 안 된다.
  - 스테이징 대상도 `closed` 잠금도 없어 커밋 자체를 건너뛰는 경로에서는 검증을
    실행하지 않는다.
  - `bouncer.verify`가 있으나 형식이 무효면 `VERIFY_COMMAND_INVALID`가 그대로
    전파된다. `config.verify`로 조용히 폴백하면 plan `S12` 누락을 숨긴다.
  - 명령 해석 실패(`VERIFY_CONFIG_MISSING`·`VERIFY_CONFIG_INVALID`·
    `VERIFY_COMMAND_INVALID`)는 예외로 새지 않고 같은 실패 형태의 `code`로 나온다.
    `cmdFinalize`는 try/catch가 없고 `runCli`에도 최상위 처리기가 없어, 던지면
    JSON 결과 대신 스택 트레이스가 나온다. 코드를 결과에 실어야 조용한 폴백도
    아니고 CLI 계약도 깨지지 않는다.
  - 검증 실패 시 `closed` 잠금을 쓰지 않고 아무 경로도 스테이징하지 않는다.
    잠금이 먼저 쓰이면 blueprint가 닫힌 채 커밋만 없는 상태가 남는다.
  - 감사 쪽: 샤드가 단일 파일 폴백이거나 렌더 결과가 비면 유도 집합도 비어
    무엇이든 통과한다. 비지 않았음을 별도로 단언한다.

## Out of scope
- pre-commit 훅과 CI 워크플로 변경.
- G16을 비롯한 게이트 판정 항목·번호 변경.
- Distill 샤드 본문·라우팅 설정 변경.
- `bouncer commit` / execute 게이트의 검증 경로 변경.

## One-commit justification
- 이 blueprint는 세 개의 task 커밋으로 나뉜다. 감사(001)를 먼저 닫아야 finalize에
  검증을 붙이는 002가 자기 커밋에서 오탐에 걸리지 않고, 003 문서 수정은 두
  코드 변경과 파일이 겹치지 않는다. 각 task가 독립적으로 리뷰 가능한 한 커밋이다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 파생 불릿 감사
* [Tasks 002](tasks/002/tasks.md) - finalize 검증 실행
* [Tasks 003](tasks/003/tasks.md) - 측정 프로토콜 보완
* [Verification 001](tasks/001/verification.md) · [Review 001](tasks/001/review.md)
* [Verification 002](tasks/002/verification.md) · [Review 002](tasks/002/review.md)
* [Verification 003](tasks/003/verification.md) · [Review 003](tasks/003/review.md)
* [Context review](context-review.md) - 계획 문서 정합성 판정
