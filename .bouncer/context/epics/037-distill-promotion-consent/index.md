---
type: bouncer.epic
title: 037 Distill 승격 동의
description: finalize의 Distill 승격을 제안-동의 절차로 바꾸고 배치 판단 근거를 CLI로 노출
resource: .bouncer/context/epics/037-distill-promotion-consent/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-14T16:25:12.581+09:00'
bouncer:
  id: '037'
  epic_id: '037'
  status: approved
---
# 037 distill-promotion-consent

## Intent
- 문제: Distill 승격은 사이클 산출물 중 사람이 명시적으로 승인하지 않는 유일한 쓰기인데, 그 내용이 이후 모든 계획·실행을 조용히 조종하고 틀려도 게이트와 테스트가 잡지 못한다.
- 목표: 승격 후보를 동작·대상 샤드가 표시된 한 목록으로 제시하고, 목록 전체에 대한 한 번의 동의 뒤에만 쓴다.

## Success criteria
1. `bouncer distill --all --json`이 등재된 샤드마다 `id`·`path`·`always`·`pathsKnown`·`pullsKnown`을 싣고, `paths`·`pulls`는 선언된 경우에만 싣는다.
2. `/bouncer-finalize` 1단계가 승격 후보를 단일 목록으로 제시하고, drop과 replace가 add보다 앞에 온다.
3. replace 항목은 지워질 기존 문장과 새 문장을 함께 보여준다.
4. 동의는 목록 전체에 한 번(승인·수정·건너뛰기)이고 불릿별로 묻지 않는다.
5. 거절이나 건너뛰기에서 승격만 생략되고 explain·퀴즈·G16·remainder 커밋은 그대로 진행된다.
6. `config.autonomy: auto`에서도 이 동의 절차는 생략되지 않는다.
7. 승격 쓰기는 동의 이후에만 일어나고 기존 `makeFinalizeAllowed` 화이트리스트로 스코프 위반 없이 스테이징된다.
8. `npm test`가 통과하고 계약 테스트가 조건 2–6의 문구를 고정한다.

## Out of scope
- 새 G 코드 신설과 승격의 게이트화. 본문 품질은 validate가 판정할 수 없고, 같은 이유로 G9가 이미 폐기됐다.
- `routing_enabled` 기본 활성화, 샤드 자동 재분할, 라우팅 계측.
- 폐기·대체 자동 판단(승계 관계 추론)과 불릿 만료 정책.
- 새 CLI 명령 신설, 기존 ACQ와의 통합·재배치.

## Blueprints
* [001 promotion-proposal-acq](blueprints/001-promotion-proposal-acq/index.md) - 샤드 인벤토리를 CLI JSON에 싣고 finalize 승격을 제안-단일 동의 절차로 바꾼다 (`cli-project-commands`, `skills/bouncer-finalize`, `skills/spec-authoring`, `CLAUDE.md`)
