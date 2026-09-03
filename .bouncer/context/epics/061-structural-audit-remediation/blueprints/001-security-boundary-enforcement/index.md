---
type: bouncer.blueprint
title: 검증 실행과 커밋 범위 경계 강화
description: Enforces shell-free verification and host-independent commit scope checks.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/001-security-boundary-enforcement/index.md
tags:
  - bouncer
  - blueprint
  - verification
  - commit-safety
  - security
timestamp: '2026-09-03T12:07:49.935+09:00'
bouncer:
  id: '001'
  epic_id: '061'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  supersedes: []
---
# 검증 실행과 커밋 범위 경계 강화

Epic: [061](../../index.md)

## Intent

- 문제: `tasks.bouncer.verify`가 셸 문자열로 실행되고, 호스트 훅과 CLI의 범위 검사 구현이 분리돼 있다.
- 완료 조건: 검증 명령은 허용된 실행 파일의 argv로 실행되고, CLI commit은 공통 범위 가드를 사용하며, 호스트별 집행 위치가 문서화된다.

## Contract
- 인터페이스: `verify`는 기존 단일 문자열 입력을 유지하되, 인용을 해석한 argv와 설정의 허용 실행 파일이 모두 유효할 때만 실행한다. 실행은 셸을 사용하지 않는다.
- 데이터·상태: 설정은 검증 실행 파일 허용 목록을 선언하며, 없거나 잘못된 값과 셸 문법·확장 문법은 `VERIFY_COMMAND_INVALID`로 거부한다. `node`·`npm` 같은 허용 실행 파일도 저장소 스크립트 자체를 격리하지는 않는다.
- 인터페이스: `bouncer commit`의 파일 범위 판정은 `checkCommitSafety`를 단일 구현으로 사용한다. 훅은 같은 함수를 계속 사용한다.
- 수용 기준: 허용 목록 밖 실행 파일, 셸 체이닝·확장, 파싱 실패 명령은 실행 전에 거부되고, 허용 argv는 기존 출력·종료 코드 증적 형식을 유지한다. CLI와 훅은 동일한 범위 위반을 거부한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 공백·인용 인자를 가진 합법 명령, 빈 명령, `cd` 접두, 메타문자, 허용되지 않은 argv0, 범위 밖 변경, 훅이 없는 Codex·Antigravity 호출을 다룬다.

## Out of scope

- 신뢰할 수 없는 `npm` 스크립트나 허용된 실행 파일의 샌드박싱
- 호스트 플러그인 매니페스트·훅 프로토콜의 추가 또는 제거
- 이후 단계의 스킬 적재·참조 경로·TypeScript 모듈 전환

## One-commit justification
- 검증 실행 경계와 commit 범위 경계는 서로 다른 변경·검증 단위다. blueprint는 두 task commit을 하나의 보안 PR로 검토한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 검증 명령의 셸 경계
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - CLI commit 범위 가드
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
