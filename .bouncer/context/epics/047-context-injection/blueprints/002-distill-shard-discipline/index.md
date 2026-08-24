---
type: bouncer.blueprint
title: Distill 샤드 규율
description: 기존 S26 상한을 실효 있는 값으로 조이고 승격 ACQ와 plan 보고에 노출한다
resource: .bouncer/context/epics/047-context-injection/blueprints/002-distill-shard-discipline/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-24T13:32:35.034+09:00'
bouncer:
  id: '002'
  epic_id: '047'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
---
# 002 Distill 샤드 규율

Epic: [047](../../index.md)

## Intent
- 문제: plan 프리플라이트 실측이 샤드 7개 전량 5,992 단어이고 승격마다 단조 증가한다. 상한 검사(`S26`)는 이미 있지만 기본 기준이 64KB라 13,445 바이트짜리 `plugin-skills.md`조차 걸리지 않고, 걸려도 승격 ACQ나 plan 어디에도 보이지 않는다.
- 완료 조건: `S26`이 실제 샤드 크기에서 작동하는 값으로 조여지고, 초과 사실이 승격 ACQ와 plan 프리플라이트 보고에 사람이 보는 항목으로 나온다.

## Contract
- 인터페이스: `DEFAULT_DISTILL_CONFIG.max_bytes`가 6KB(6144)로 바뀐다. `bouncer distill --all`이 stdout 본문과 별개로 **stderr**에 샤드별 바이트와 총합 한 줄을 낸다. `/bouncer-finalize` 승격 ACQ가 초과 샤드를 목록에 표시하고, `/bouncer-plan`이 프리플라이트 총량을 한 줄로 보고한다.
- 데이터·상태: `max_bytes`는 경고 기준으로 남는다. 라우팅 시점(`--all` → `affected_paths` 확정 → `--for`)은 바뀌지 않고 route 결과를 잘라내지도 않는다.
- 수용 기준: `distill.max_bytes`를 설정하지 않은 저장소(기본값 경로)에서 `validate`가 이 저장소 크기의 샤드 픽스처 중 13,445·8,877 바이트짜리에 `S26`을 내고 5,842 바이트짜리에는 내지 않는다. 이 저장소 자신의 `.bouncer/config.json`은 `max_bytes: 65536`을 명시하고 있어 기본값 변경의 영향을 받지 않는다 — 그 값을 바꿀지는 별도 사람 판단이다. 승격 ACQ 목록과 plan 한 줄 보고가 계약 테스트로 고정된다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 기존 소비자 `config.json`에 `max_bytes: 65536`이 있으면 그 값이 이긴다 — `init`은 기존 config를 다시 쓰지 않으므로 이번 변경은 신규 프로젝트와 기본값 사용자만 바꾼다.
  - 샤드 인덱스가 없거나 무효 → CLI 단일 파일 폴백. 그때 stderr 요약은 단일 파일 한 줄이고 샤드별 목록은 없다.
  - `S26`은 경고이고 게이트가 아니다. 초과 샤드가 있어도 plan/finalize 게이트는 막히지 않는다.
  - 승격 ACQ에서 초과를 보여주는 것은 정보 제공이다. 자동 절삭·자동 분할을 하지 않는다 — 샤드를 줄이는 판단이 잘못되면 다음 사이클이 규칙을 재발견해야 하므로 사람이 본다.

## Out of scope
- 라우팅 시점을 앞당기는 것. 하드룰 7의 `--all` 프리플라이트 → 확정 → `--for` 순서는 route 결과가 규칙을 조용히 빠뜨리지 못하게 하는 안전장치다.
- 샤드 자동 분할·자동 절삭, 새 CLI 서브커맨드.
- 실제 샤드 본문을 지금 줄이는 것. 이번 blueprint는 규율과 노출만 만들고, 실제 `replace`/`drop` 판단은 각 사이클의 승격 ACQ에서 한다.
- `distill.routing_enabled` 활성화, 샤드 등록 목록 변경.
- 브리프 주입 축소 — blueprint 001이 다룬다.

## One-commit justification
- task 001은 런타임(`scripts/` 기본값 + stderr 요약 + 문서·테스트), task 002는 두 워크플로 스킬의 노출 문구다. 런타임 요약이 먼저 있어야 스킬이 그것을 인용할 수 있으므로 순서가 있고, 각각 독립적으로 되돌릴 수 있다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - `max_bytes` 기본값과 stderr 크기 요약
* [Tasks 002](tasks/002/tasks.md) - 승격 ACQ·plan 보고 노출
* [Verification 001](tasks/001/verification.md) · [002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) · [002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
