---
type: bouncer.epic
title: Bouncer 개선 백로그
description: Plans and verifies prioritized Bouncer backlog improvements in independent blueprints.
resource: .bouncer/context/epics/099-bouncer-improvements-2026-10-14/index.md
tags:
- bouncer
- epic
- workflow
- reliability
- review
timestamp: '2026-10-14T10:11:59.637+09:00'
bouncer:
  id: '099'
  epic_id: '099'
  status: approved
  supersedes: []
---
# Bouncer 개선 백로그

## Intent
2026-10-14 개선 백로그의 작업을 우선순위에 따라 독립 blueprint로 계획하고 검증함.
blueprint 001은 리뷰 입력을 작업 트리 스냅샷에 연결하고, 002는 run 시작 계약과 plan 단계 커밋 문장 검사를, 003은 repair task 통합 경로와 preflight 경로 비교를 맞춤.

## Diagram
```mermaid
flowchart LR
  P[작업별 계획] --> A[작업 트리 수집]
  A --> B[규모 분류 · 대상 동결]
  B --> C[독립 리뷰]
  C --> D[스냅샷 일치 검사 · 증거 기록]
  D --> F[후속 작업 계획]
```

## Success criteria
1. A-01의 리뷰 본문과 규모 분류가 base 이후 커밋 및 staged·unstaged·untracked 최종 상태를 포함하는 같은 스냅샷을 사용한다.
2. 추적 파일의 미커밋 500줄 변경이 changed_lines에 반영되어 full 리뷰 전략이 parallel이 된다.
3. 새 실행 리뷰 라운드는 스냅샷 식별자로 dispatch·리뷰 대상·기록을 연결하고, 기존 식별자 없는 저장 기록은 그대로 읽힌다.
4. 리뷰 중 대상 내용·index·HEAD가 바뀌면 acceptance가 거절되며 기존 리뷰 기록이 바뀌지 않는다.
5. staged·unstaged 혼합, 삭제·이름 변경·바이너리·untracked와 Git·파일 읽기 실패를 회귀 테스트가 검증한다.
6. 기존 리뷰 임계값·light 정책·보안 관점·독립 reviewer·delta·finding·상태 전이 계약을 유지한다.
7. TS 변경을 npm run build로 재생성하고 npm run check:emit로 일치를 확인한다. 동작 변경은 요구사항에 따른 Red run 근거를 남기고 npm run ci를 최종 통합 검증 기준으로 삼는다.
8. reviewer 역할 문서를 바꾸면 대응 Codex TOML을 생성기로 갱신하고 패리티 테스트를 통과한다.
9. 후속 백로그 작업은 별도 범위 확인과 승인을 거친 blueprint에서만 구현한다. 범용 epic 제목은 구현 권한을 넓히지 않는다.
10. `bouncer run preflight`는 `--blueprint`가 활성 포인터의 blueprint와 다르면 `ok: false`, reason `pointer-mismatch`로 거절한다(A-05).
11. `bouncer run preflight`는 blueprint status가 `approved`가 아니거나 integration 원장 status가 `awaiting_confirmation`·`partial_closed`이면 `delegable: false`와 상태별 reason을 반환한다(A-04).
12. `/bouncer-run`은 scale과 관계없이 preflight → 시작 ACQ → `coordinate bootstrap`을 먼저 거친 뒤 light·full로 분기한다. light에는 직접 실행 선택지 D가 없다(A-02).
13. `bouncer validate --gate plan`은 task `commit_intent`·`commit_summary` 항목이 `bouncer commit`과 같은 한국어 종결 문장 검사를 통과하지 못하면 S34와 `next`로 실패한다(B-06).
14. `coordinate repair`가 integration checkout에 쓴 repair task 문서가 있는 상태에서 `coordinate integrate`가 `integration-source-mutated` 없이 성공하고, integration의 해당 `tasks.md`가 `verified`가 된다(R1·R2).
15. repair task를 통합한 뒤 `bouncer finalize` dry-run은 `coordinator-evidence-mismatch`로 멈추지 않는다(R1·R2).
16. repair task 증적 밖 경로의 미커밋 변경은 계속 `integration-source-mutated`로 거절된다.
17. `bouncer run preflight`는 정규화한 경로가 포인터 blueprint와 다르거나(`<pointer bp>/../다른-bp` 포함) 실재 경로가 repo 밖으로 해석되면(symlink 포함) `pointer-mismatch`로 거절하고, 손상된 원장은 문서 status로 판정한다(R3·F2).

## Out of scope
- 기존 075의 리뷰 전략 임계값, 081의 finding 병합·원자 기록 및 095의 코딩 표준을 재설계하지 않는다. A-01은 그 계약의 입력과 스냅샷 연결만 확장한다.
- blueprint 001은 A-01만, 002는 A-02·A-04·A-05·B-06만, 003은 099/002 retro의 R1·R2·R3과 리뷰 F2만 다룬다. `verify --task`, seed manifest 변경, coordinator 보고 형식(R4), 손상 원장 fail-closed(F3)는 하지 않는다. 백로그의 다른 항목, 모델 선택, 검증 증거 재사용, 효율 계측은 후속 blueprint에서 각각 범위를 확정한다.
- run preflight의 명시적 대상 선택(포인터와 다른 blueprint 실행), 원장 상태 전이 변경, 커밋 검증기 허용 어미 목록 변경.
- 과거 커밋 전용 리뷰 모드, 새 설정 키, 자동 위험 수용, 이미 저장한 리뷰 기록의 강제 마이그레이션.

## Blueprints
* [001 리뷰 입력 정합성](blueprints/001-review-input-consistency/index.md) - 실행 리뷰의 작업 트리 수집·규모 분류·라운드 기록·reviewer 입력을 같은 스냅샷에 연결한다.
* [002 run 시작 계약](blueprints/002-run-start-contract/index.md) - run preflight의 포인터·상태 거절, run 시작 순서와 plan gate의 커밋 문장 검사를 맞춘다.
* [003 repair 통합 경로](blueprints/003-repair-integrate-path/index.md) - coordinator integrate가 repair task 문서를 받아들이게 하고 run preflight의 경로 비교를 정규화·realpath 기준으로 바꾼다.
