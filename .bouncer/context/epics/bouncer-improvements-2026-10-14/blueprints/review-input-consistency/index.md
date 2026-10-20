---
type: bouncer.blueprint
title: 작업 트리 스냅샷 기반 리뷰 입력 정합성
description: Binds execute review classification, reviewer input, and evidence to one frozen worktree snapshot.
resource: .bouncer/context/epics/bouncer-improvements-2026-10-14/blueprints/review-input-consistency/index.md
tags:
  - bouncer
  - blueprint
  - review
  - snapshot
  - worktree
timestamp: '2026-10-14T10:11:59.795+09:00'
bouncer:
  id: review-input-consistency
  epic_id: bouncer-improvements-2026-10-14
  blueprint_id: review-input-consistency
  status: closed
  order: 1
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 작업 트리 스냅샷 기반 리뷰 입력 정합성

Epic: [099](../../index.md)

## Intent
미커밋 변경이 리뷰 본문과 규모 분류에서 빠지는 경로를 작업 트리 스냅샷으로 교체함.
새 리뷰 라운드를 같은 식별자에 연결하고 리뷰 중 변경된 대상의 acceptance를 거절함.

## Diagram
```mermaid
flowchart LR
  A[작업 트리 수집] --> B[규모 분류 · 대상 동결]
  B --> C[독립 리뷰]
  C --> D[스냅샷 일치 검사 · 증거 기록]
```

## Contract
- 인터페이스:
  - execute dispatch target은 기존 base·head·task에 snapshot_id와 snapshot_path를 추가한다. snapshot_id는 canonical 내용의 SHA-256 64자리 소문자 hex이며 path는 저장소 상대 경로이다.
  - artifact는 .bouncer/runtime/review-snapshots/<snapshot_id>/snapshot.json에 보존한다. reviewer는 이 artifact의 동결 diff·untracked 내용·파일 메타데이터를 읽고, 분류 통계도 같은 artifact에서 가져온다.
  - 새 실행 리뷰 round.target.snapshot_id는 필수이다. perspectives는 라운드 target의 동일 스냅샷을 상속하며 별도 식별자를 복제하지 않는다. task·blueprint 모드 모두 같다.
- 데이터·상태:
  - 입력은 resolved base, 현재 HEAD와 일치하는 resolved head, blueprint·task 범위, 최종 파일 내용·모드와 필터링된 index 항목이다. 같은 입력은 같은 식별자를 반환한다.
  - base에서 최종 작업 트리까지의 변경을 한 번만 센다. staged를 unstaged가 되돌리면 줄 수는 0일 수 있지만 index 차이는 식별자에 반영한다.
  - .bouncer/runtime/**와 .bouncer/context 아래 review.md·context-review.md·verification.md 및 그 원자 쓰기 임시 파일만 자동 증거로 제외한다. 계획 문서·설정·일반 소스는 포함하며 untracked는 Git ignore 규칙을 따른다.
  - 기존 저장 round의 snapshot_id 부재는 기존 계약으로 읽는다. 새 입력만 필수이며 context-review의 target.digest에는 적용하지 않는다.
  - acceptance는 새 마지막 라운드의 snapshot과 현재 상태를 비교한다. 명시한 --status뿐 아니라 문서에서 상속한 accepted 상태도 검사한다. 이전 discovery snapshot을 delta 후 현재 상태와 비교하지 않는다.
- 수용 기준: epic 성공 기준 1–8을 충족한다. 수집은 Git index·브랜치·소스를 바꾸지 않으며 runtime artifact 저장만 수행한다.
- 검증 명령: 각 task의 bouncer.verify는 사용자가 확인한 npm run ci이다. focused 명령은 task Checklist에 둔다.
- 실패 모드·엣지 케이스:
  - head 불일치, Git·파일 읽기·저장 실패, 수집 중 내용·index 변경, 누락·손상·다른 범위의 artifact는 성공으로 대체하지 않는다.
  - 리뷰 중 변경은 accepted 기록 전에 거절하고 reason·cause·next로 새 dispatch·재리뷰를 안내한다. 기존 리뷰 파일 바이트와 rounds를 유지한다.
  - binary 내용, symlink target, 실행 모드, 삭제·이름 변경, 특수 파일명을 식별자에 반영한다. 표현할 수 없는 충돌 index·dirty submodule은 원인을 밝히고 거절한다.
  - 자동 증거 쓰기는 self-stale을 만들지 않는다. 새 untracked와 기존 untracked 내용 변경은 감지한다.
  - 저장소 밖 경로와 symlink 외부 내용 접근을 거절한다. symlink는 링크 target 자체만 수집하고 외부를 따라 읽지 않는다.

## Out of scope
- 리뷰 임계값, light·위험 flag, finding·fingerprint, delta 횟수와 사용자 위험 수용 권한 재설계.
- 과거 HEAD 전용 모드, staged·unstaged 별도 리뷰·중복 집계, 기존 라운드 강제 변환, context-review 변경.
- 다른 백로그 항목, 외부 의존성, 새 설정·캐시·정리 명령.

## One-commit justification
- A-01은 하나의 PR 단위이다. 수집·분류, 증거 바인딩, workflow 소비를 각 한 커밋으로 나눈다. 후속 task가 앞 task의 계약을 소비하므로 순차 통합한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 작업 트리 스냅샷과 규모 분류
* [Tasks 002](tasks/002/tasks.md) - 라운드 바인딩과 acceptance 변경 감지
* [Tasks 003](tasks/003/tasks.md) - reviewer·controller 호출 계약
* [Verification](tasks/001/verification.md) - task별 실행 검증 증적
* [Review](review.md) - blueprint 최종 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
