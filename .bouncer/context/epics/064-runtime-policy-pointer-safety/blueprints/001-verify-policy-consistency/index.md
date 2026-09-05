---
type: bouncer.blueprint
title: 검증 정책 일관성
description: Aligns plan and runtime verification policy and preserves project config in execute worktrees.
resource: .bouncer/context/epics/064-runtime-policy-pointer-safety/blueprints/001-verify-policy-consistency/index.md
tags:
  - bouncer
  - blueprint
  - verification
  - allowlist
  - config
  - worktree
timestamp: '2026-09-05T21:02:51.462+09:00'
bouncer:
  id: '001'
  epic_id: '064'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  supersedes: []
---
# 검증 정책 일관성

Epic: [064](../../index.md)

## Intent

계획 단계와 실행 단계가 서로 다른 허용 목록과 설정 오류 정책을 적용해 같은 검증 명령에 다른 결론을 내리는 문제를 해결한다. 실행 작업 트리에도 프로젝트 설정을 비파괴적으로 전달해 두 단계가 같은 정책 입력을 사용하게 한다.

## Contract

- 인터페이스: config 판정 결과와 `verify_allowlist` 해석을 공용 정책으로 제공하고, S12·task verify 선택·실제 프로세스 실행이 그 결과를 사용한다.
- 데이터·상태: 명시한 `verify_allowlist`는 기본 목록을 대체하며 `[]`는 전면 차단을 뜻한다. config 부재는 기본 목록, 깨진 JSON과 읽기 오류는 오류다.
- 인터페이스: `seed-worktree` 결과는 plan 문서의 `moved`와 별도로 config 상태를 `copied`·`preserved`·`missing` 중 하나로 보고한다.
- 데이터·상태: 대상 worktree에 config가 있으면 보존한다. 대상에 없고 base config가 추적 파일이면 HEAD 내용을, 추적되지 않았으면 base 내용을 복사하되 base 파일은 유지한다.
- 수용 기준: epic 성공 기준 1~4와 8을 만족한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스: 기본 목록 밖의 프로젝트 명령, 빈 allowlist, 셸 연산자, 미종료 인용, config 부재·파손·읽기 오류, 재사용 worktree의 기존 config, 추적 config의 dirty base 사본을 다룬다.

## Out of scope

- 활성 포인터 충돌 차단과 namespace 전환
- `verify` 문자열 형식과 argv 파서 변경
- verify 원장과 G13 증적 형식 변경
- `.bouncer/config.json` 이외 파일의 seed 대상 확대
- `.bouncer/Distill.md` 복사

## One-commit justification

- Task 001은 정책 판정과 그 소비자를 한 커밋으로 묶어 plan·execute가 어긋나는 중간 상태를 만들지 않는다.
- Task 002는 config 복사와 execute 안내를 한 커밋으로 묶어 결과 필드만 생기거나 소비자 안내만 앞서는 중간 상태를 피한다.
- 두 task는 동일한 P1 정책을 완성하므로 한 blueprint의 리뷰·PR 단위로 묶는다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - plan·execute 검증 정책 통일
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - worktree config 보존 복사
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
