---
type: bouncer.blueprint
title: verify.timeout_ms 계약
description: Blueprint 001
resource: .bouncer/context/epics/077-verify-timeout/blueprints/001-verify-timeout-ms/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-12T12:00:00.000+09:00'
bouncer:
  id: '001'
  epic_id: '077'
  blueprint_id: '001'
  status: approved
  commit_type: feat
  scale: full
---
# 001 verify-timeout-ms

Epic: [077](../../index.md)

## Intent
- 문제: verify가 멈추면 execute가 끝없이 기다린다.
- 완료 조건: `verify.timeout_ms`가 config·실행·테스트에 반영되고, 초과 시 실패 증적이 남는다.

이 예시는 설정 키 계약이라 흐름 변경이 아니며, Mermaid 차트를 넣지 않는다.

## Contract
- 인터페이스: `config.verify`에 선택 키 `timeout_ms: number`를 추가한다. 검증 실행기는 이 값이 양의 정수일 때만 해당 ms 후 프로세스를 끊는다.
- 데이터·상태: 기본 config(`init`·`config.example.json`)에 `timeout_ms: 600000`을 둔다. 키 부재·`0`은 “상한 없음”이다.
- 수용 기준: Success criteria 1–4가 참이다. timeout 실패 시 verification 증적에 타임아웃임이 드러난다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 음수·비숫자 `timeout_ms`는 설정 로드 단계에서 거부한다. 상한 직전 정상 종료는 timeout으로 기록하지 않는다.

## Out of scope
- verify 명령 파서·셸 해석 변경
- 다른 config 키 기본값 손질

## One-commit justification
- config 기본값·실행기·테스트가 한 계약(`timeout_ms`)을 가리키므로 한 리뷰 단위로 묶인다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
