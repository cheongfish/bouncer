---
type: bouncer.epic
title: verify 명령 타임아웃
description: Epic 077
resource: .bouncer/context/epics/077-verify-timeout/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-12T12:00:00.000+09:00'
bouncer:
  id: '077'
  epic_id: '077'
  status: approved
---
# 077 verify-timeout

## Intent
- 문제: `config.verify` 명령이 응답하지 않으면 execute gate가 무한 대기한다. CI·로컬 모두 같은 함정이다.
- 목표: verify 실행에 상한을 두어, 초과 시 실패로 기록하고 게이트가 진행·재시도를 결정할 수 있게 한다.

## Success criteria
1. `.bouncer/config.json`과 `config.example.json`의 `verify` 객체에 `timeout_ms`(양의 정수)가 있다.
2. `timeout_ms`를 넘긴 verify 프로세스는 종료되고, 증적에 timeout 실패가 남는다.
3. `timeout_ms`가 없거나 `0`이면 기존처럼 대기 상한 없이 동작한다.
4. `npm test`가 통과한다.

## Out of scope
- verify 명령 문자열 자체의 재설계
- graphify·PR·subagents 등 다른 config 키
- OS 시그널 정책 변경(플랫폼별 kill 세부는 구현 선택)

## Blueprints
* [verify.timeout_ms 계약](blueprints/001-verify-timeout-ms/index.md) - config 기본값·검증 실행 경로·테스트에 `timeout_ms`를 넣는다
