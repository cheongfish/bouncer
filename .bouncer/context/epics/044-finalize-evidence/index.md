---
type: bouncer.epic
title: 044 승격 증적과 측정 프로토콜
description: Distill 승격 커밋을 검증 아래 두고 다음 회차 측정 프로토콜의 빈틈을 닫는다
resource: .bouncer/context/epics/044-finalize-evidence/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-22T14:16:25.788+09:00'
bouncer:
  id: '044'
  epic_id: '044'
  status: approved
---
# 044 승격 증적과 측정 프로토콜

## Intent
- 문제: `/bouncer-finalize`가 Distill shard를 고쳐 커밋하면서 `config.verify`를 한 번도
  돌리지 않는다. execute 게이트만 verify를 실행하고 G16은 문서 상태와 `diff_sha`만 보므로
  승격 커밋은 구조적으로 항상 미검증이다. 더구나 `test/distill.test.js`가 Distill 불릿
  전체를 손으로 고정한 sha256 목록과 대조해, 승격할 때마다 그 테스트가 깨진다. 043/002
  사이클에서 PR #55의 CI가 이 이유로 실패했고 `1937355`에서 손으로 복구했다.
- 목표: 승격이 검증을 거치고, 그 검증이 손으로 고쳐야 하는 목록 때문에 오탐으로 깨지지
  않는다. 같은 사이클이 남긴 측정 프로토콜의 두 결함도 다음 회차 전에 닫는다.

## Success criteria
1. Distill shard **본문**을 고쳐 승격한 뒤 `npm test`가 사람이 해시 목록을 갱신하지
   않아도 통과한다. 샤드를 새로 추가하거나 이름을 바꾸는 경우는 이 조건에서 제외한다 —
   그때는 `state.ids` 목록을 손으로 갱신하는 것이 맞다.
2. `bouncer finalize --yes`가 검증 명령 실패 시 아무것도 스테이징·커밋하지 않고
   `ok: false`를 반환한다.
3. `docs/benchmark/protocol.md`만 읽고 런별 plan-gate 통과 시점의 계획 문서 줄 수를
   수집할 수 있다.
4. 표본 제외 기준과 실패 보고 의무 중 어느 쪽이 먼저 적용되는지 `protocol.md`에 한
   문장으로 확정돼 있다.

## Out of scope
- pre-commit 훅(`.githooks/pre-commit`) 확장 — 훅을 설치하지 않은 사용자에게는 무효라
  승격 경로의 구멍을 닫지 못한다.
- G16 판정 항목 변경과 새 게이트 번호 도입.
- `.bouncer/config.json`의 `verify` 값 변경.
- 이미 닫힌 043 blueprint 문서의 소급 수정.
- Distill 라우팅 계약(`routing_enabled`, `pulls`, 샤드 분할 기준) 변경.

## Blueprints
* [001 promotion-verify](blueprints/001-promotion-verify/index.md) - Distill 불릿 감사를 샤드 파일에서 유도하도록 바꾸고, `scripts/src/lib/finalize.ts`가 스테이징 전에 검증 명령을 실행하게 하며, `docs/benchmark/protocol.md`에 plan 단계 스냅샷과 표본 조항 순서를 넣는다
