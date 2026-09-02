---
type: bouncer.blueprint
title: Project Distill 경로 샤딩
description: Project Distill의 보수적 경로 라우팅과 점진적 전환
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-14T12:56:28.171+09:00'
bouncer:
  id: '003'
  epic_id: '007'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
---
# 003 path-routed-distill

Epic: [007](../../index.md)

## Intent
- 문제: 단일 Distill 전문을 반복 소비하면 관련 규칙의 신호가 약해지고, 기존 규칙을 버리면 회귀 위험이 생긴다.
- 완료 조건: 샤드 라우팅·구조 검사·정본 통합·워크플로 소비·수동 분배·dogfood 활성화가 7개 task commit으로 연결되고 `npm test`가 통과한다.

## Contract
- 인터페이스: `bouncer distill --for`, `--all`, `--route`, `--audit`와 선택적 `--json`을 제공한다. 유효한 `distill.version: 1`·비어 있지 않은 `distill.shards` 선언이 없으면 기존 단일 파일 본문을 출력한다.
- 데이터·상태: 인덱스는 샤드 식별자 목록, 각 샤드는 `paths`·`pulls`·`always` 메타데이터를 가진다. `distill.routing_enabled` 기본값은 `false`이고, 임계값 이하 또는 비활성 상태는 전량 로드한다.
- 수용 기준: Epic 성공 기준 1–7을 만족하고 `npm test`가 통과한다. stdout은 본문/JSON만 내보내며 경고·미매칭은 stderr로 보낸다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 미매칭·파일/디렉터리 판별 불가·경로 교집합 불명확은 전량 또는 포함으로 안전하게 처리한다. 고아, 빈 비항상 샤드, 누락 `pulls`, `pulls` 순환, source routing 구멍은 활성화를 거부한다.

## Out of scope
- 자동 불릿 분류, 기존 소비 저장소의 자동 마이그레이션, 선택 결과 바이트 상한 강제, explain 역사 백필.

## One-commit justification
- 7개 task document가 각각 하나의 구현 커밋이며, 이 Blueprint는 라우터 도입부터 dogfood 활성화까지의 단일 PR·리뷰 단위다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
