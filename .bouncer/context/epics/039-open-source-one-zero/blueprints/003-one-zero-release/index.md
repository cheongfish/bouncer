---
type: bouncer.blueprint
title: 1.0 공개 릴리스
description: Blueprint 003
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/003-one-zero-release/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-15T19:41:48.040+09:00'
bouncer:
  id: '003'
  epic_id: '039'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
---
# 003 one-zero-release

Epic: [039](../../index.md)

## Intent
- 문제: 배포 파일은 0.9.0을 가리키고, 1.0 공개 릴리스의 태그·릴리스 노트·설치
  smoke 결과가 아직 한 흐름으로 묶이지 않았다.
- 완료 조건: 다섯 매니페스트와 npm 메타데이터를 1.0.0으로 맞추고, 공개 문서와
  파일럿 기록을 확정한 뒤 모든 task 커밋이 병합된 HEAD에 릴리스 태그를 남긴다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스:
  - `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
    `.cursor-plugin/plugin.json`, `.codex-plugin/plugin.json`, 루트
    `plugin.json`, `package.json`, `package-lock.json`은 모두 `1.0.0`을
    공개한다.
  - `CHANGELOG.md`와 설치 문서는 1.0.0 출시 준비, 각 호스트의 설치 절차, 그리고
    태그 후 `bouncer--v1.0.0` GitHub Release에 남길 3×4 smoke 검증 상태를 설명한다.
- 데이터·상태: 공개 CLI, 문서 스키마, 게이트 코드, 설정 키는 바꾸지 않는다.
  파일럿 표의 호스트 상태는 실제 smoke 증거가 있을 때만 `검증됨`으로 바꾼다.
- 수용 기준: epic 성공 기준 7·8이 참이다. 모든 blueprint 커밋을 포함한 최종 HEAD에서
  `npm run ci`가 성공하고, 그 HEAD에 `bouncer--v1.0.0` 태그가 하나만 존재한다.
- 검증 명령: 각 코드·문서 task는 `npm test`, 최종 상태는 `npm run ci`로 확인한다.
- 실패 모드·엣지 케이스:
  - 매니페스트 또는 lockfile 중 하나라도 `1.0.0`과 다르면 태그를 만들지 않는다.
  - `bouncer--v1.0.0`이 다른 커밋을 가리키거나 원격에 이미 있으면 덮어쓰지 않고
    릴리스를 중단한다.
  - 호스트 인증·네트워크·마켓플레이스 접근이 없어 smoke를 실행할 수 없으면 해당
    표를 `미검증`으로 유지하고 성공 증거를 만들지 않는다.

## Out of scope
- npm 레지스트리 게시과 새 npm 패키지 배포.
- 새 기능, CLI·게이트·문서 스키마의 의미 변경.
- smoke를 수행하지 않은 운영체제·Node 버전·호스트의 지원 선언.

## One-commit justification
<!-- rules/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 버전·정합성 검사, 릴리스 노트, 태그 전 검증·GitHub Release 기반 태그 후 smoke 절차는 검토 근거와
  실패 원인이 달라 각각 한 task 커밋으로 분리한다. 태그는 세 커밋과 최종 검증 뒤
  최종 HEAD에서 생성하고, smoke 증거는 태그 기준 외부 릴리스 기록에 남긴다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 1.0.0 버전 정합성과 회귀 검사
* [Tasks 002](tasks/002/tasks.md) - 1.0 릴리스 노트와 공개 문서
* [Tasks 003](tasks/003/tasks.md) - 설치 smoke 기록과 릴리스 태그
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
