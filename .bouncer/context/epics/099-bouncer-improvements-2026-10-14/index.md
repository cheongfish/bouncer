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
이번 blueprint에서 리뷰 입력과 분류·증거 기록을 같은 작업 트리 스냅샷에 연결함.

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

## Out of scope
- 기존 075의 리뷰 전략 임계값, 081의 finding 병합·원자 기록 및 095의 코딩 표준을 재설계하지 않는다. A-01은 그 계약의 입력과 스냅샷 연결만 확장한다.
- 이번 blueprint에 A-02 및 백로그의 다른 항목, 모델 선택, 검증 증거 재사용, 효율 계측을 포함하지 않는다. 후속 blueprint에서 각각 범위를 확정한다.
- 과거 커밋 전용 리뷰 모드, 새 설정 키, 자동 위험 수용, 이미 저장한 리뷰 기록의 강제 마이그레이션.

## Blueprints
* [001 리뷰 입력 정합성](blueprints/001-review-input-consistency/index.md) - 실행 리뷰의 작업 트리 수집·규모 분류·라운드 기록·reviewer 입력을 같은 스냅샷에 연결한다.
