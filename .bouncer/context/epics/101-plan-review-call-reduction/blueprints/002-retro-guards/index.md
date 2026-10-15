---
type: bouncer.blueprint
title: drive 회고 후속 가드
description: 'Close four drive retro gaps: metrics token timing, tier-registration test messages, cross-category finding merge warnings on record, and an optional worktree.setup command seeded by init.'
resource: .bouncer/context/epics/101-plan-review-call-reduction/blueprints/002-retro-guards/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-15T14:49:17.492+09:00'
bouncer:
  id: '002'
  epic_id: '101'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 drive 회고 후속 가드

Epic: [101](../../index.md)

## Intent
blueprint 101/001 drive 회고에서 나온 네 가지 누락(메트릭 토큰 기록 시점, tier 등록 안내, 관점이 다른 중복 finding, worktree 빌드 산출물 부재)을 문서·테스트·CLI로 막는다.
각 누락은 다음 drive에서 사람이 기억하지 않아도 문서·실패 메시지·record 응답·worktree 준비 단계가 알려 주거나 처리한다.

## Contract
- 인터페이스:
  - `bouncer review record`와 `bouncer context-review record`의 성공 JSON에 선택 필드 `warnings`가 생긴다. 항목 형태는 `{ code: 'finding-merge-candidate', file, symbol, ids }`이고 해당 항목이 없으면 키를 생략한다.
  - `.bouncer/config.json`에 선택 키 `worktree.setup`(단일 argv 문자열)이 생긴다. worktree 의존성 준비(`prepareDependencies`) 끝에서 main checkout config의 이 명령을 실행한다.
  - `bouncer init`이 새 config를 만들 때 `package.json#scripts.build`가 있으면 `worktree: { setup: 'npm run build' }`를 넣는다.
- 데이터·상태: record가 쓰는 review.md·state.json·report 바이트는 바뀌지 않는다. 기존 config는 init이 다시 쓰지 않는다.
- 수용 기준: epic 성공 기준 11~15.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 같은 fingerprint 중복은 지금처럼 거절하고, 새 경고는 거절을 추가하지 않는다. `symbol`이 비었거나 `file`이 다르면 경고하지 않는다.
  - `worktree.setup`이 없으면 현재 동작과 같다. 값이 문자열이 아니거나 verify 규칙(메타문자·`cd`·허용 목록)을 어기거나 실행이 실패하면 `dependency-install-failed`로 실패하고 message에 `worktree.setup`을 적는다.
  - lockfile이 없거나 설치를 건너뛴 경우에도 setup은 실행한다.
  - `package.json`이 없거나 깨졌거나 `build` 스크립트가 없으면 init은 `worktree` 키를 넣지 않는다.

## Out of scope
- 중복 finding의 자동 병합·거절, record 쪽 fingerprint 검증(CT-1).
- 이미 존재하는 config에 `worktree` 키를 채우는 init 경로나 새 플래그. 이 저장소는 로컬 config에 직접 추가한다.
- 계획 단계에서 `test/tiers.json`을 Touch에 자동 포함하는 규칙.
- 새 reason 코드 추가, verify 증적 해시 계산 방식 변경.

## One-commit justification
- 네 항목 모두 같은 drive 회고의 후속이고 서로 공개 계약을 공유하지 않아, 한 PR에서 리뷰해도 범위가 작다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
