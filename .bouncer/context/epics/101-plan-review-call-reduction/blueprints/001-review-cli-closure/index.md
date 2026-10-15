---
type: bouncer.blueprint
title: 컨텍스트 리뷰 기록과 plan 승인 명령화
description: Make review CLI help complete, write context-review.md on close, and add plan approve for status transitions.
resource: .bouncer/context/epics/101-plan-review-call-reduction/blueprints/001-review-cli-closure/index.md
tags:
  - bouncer
  - blueprint
  - context-review
  - cli
  - approval
timestamp: '2026-10-15T13:32:16.958+09:00'
bouncer:
  id: '001'
  epic_id: '101'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 001 리뷰 CLI 마감

Epic: [101](../../index.md)

## Intent
context review 기록 형식과 close 투영, plan 승인 상태 전환을 CLI가 직접 처리하게 함.
에이전트가 형식을 탐색하거나 문서를 손으로 편집하지 않고 도움말과 명령만으로 리뷰와 승인을 끝내게 함.

## Diagram
```mermaid
flowchart LR
  A[형식 확인] --> B[리뷰 기록]
  B --> D[close 기록]
  D --> E[승인 전환]
```

## Contract
- 인터페이스:
  - `bouncer review-dispatch --help`와 `bouncer context-review --help`는 `--round` 입력(`{ round, findings }`)과 `--dispositions` 입력(`[{ id, status, note }]`)의 필드·허용 값과, 복사해 쓸 수 있는 discovery round·delta round·dispositions 예시를 출력한다. 열거값은 검증기가 쓰는 상수에서 생성한다.
  - `bouncer context-review close`와 cycle을 닫는 `record --status accepted`는 성공 시 blueprint 루트 `context-review.md`를 기록하고, 응답에 기록한 경로를 더한다. 기존 응답 필드(`projection` 포함)는 유지한다.
  - 신규 `bouncer plan approve --blueprint <dir> [--repo <dir>]`: 성공 `{ ok: true, changed: string[], unchanged: string[] }` exit 0, 거절 `{ ok: false, reason, cause, next }` exit 1(쓰기 도중 I/O 실패인 `plan-approve-write`만 이미 쓴 `changed`를 더한다), 사용법 오류 exit 2.
- 데이터·상태:
  - `context-review.md` 기록 범위: frontmatter `bouncer.status`(→ `accepted`)와 `bouncer.context_review.{rounds, findings}`, 본문 `## Findings` 절. 다른 frontmatter 키는 값을 보존하고(YAML 표기는 `renderDoc` 정규화 허용), 다른 본문 절은 바이트 그대로 둔다. `## Findings`의 기존 `- inline context review:` 줄은 생성 목록 앞에 보존한다.
  - `plan approve` 기록 범위: epic·blueprint·task 문서 frontmatter의 `bouncer.status`만. 허용 전이는 epic `draft→approved`, blueprint `draft→approved`, task `draft→ready`이고, 이미 목표 상태인 문서는 `unchanged`다.
  - plan snapshot digest는 status와 `context-review.md`를 제외하므로 두 명령의 쓰기는 G18 신선도를 바꾸지 않는다.
- 수용 기준: epic 성공 기준 1–9를 충족한다. 기존 수동 흐름(투영 복사, 문서 직접 편집)도 계속 G18·plan 게이트를 통과한다.
- 검증 명령: 각 task의 `bouncer.verify`는 사용자가 확인한 명령이다. focused 테스트는 task Checklist에 둔다.
- 실패 모드·엣지 케이스:
  - close·record 거절, 이미 닫힌 cycle의 다른 입력, `context-review.md` 부재·frontmatter 파싱 실패는 파일을 바꾸지 않는다. 부재 시 next는 `bouncer scaffold context-review`를 가리킨다.
  - 같은 close 입력의 재실행(noop)은 같은 바이트를 쓰거나 쓰지 않는다. note가 YAML 예약 문자로 시작해도 renderer가 안전하게 인용한다.
  - `plan approve`의 판정은 전부 아니면 전무다. 모든 대상을 읽고 판정한 뒤에만 쓰며, 쓰기 도중 I/O 실패는 `plan-approve-write`로 이미 쓴 파일을 알리고 같은 명령의 재실행으로 이어서 끝낸다. 문서 하나라도 전이 불가(`done`, `cancelled` 등)이거나 full blueprint의 context-review가 `accepted`가 아니면 아무것도 쓰지 않는다. epic이 이미 `approved`이면 그대로 둔다.
  - 두 명령은 사용자 승인을 추론하지 않는다. 승인 시점은 plan 스킬의 ACQ가 정한다.

## Out of scope
- epic Out of scope 전부.
- G18·plan 게이트 판정 규칙과 `context-review.md` 기록 형식 변경.
- execute `review record`·`review.md` 경로.

## One-commit justification
- 리뷰 구간 호출을 줄이는 세 CLI 변경과 그 사용법을 담은 스킬 문구가 한 PR에서 함께 맞아야 스킬이 존재하지 않는 명령을 가리키지 않는다. task별 커밋은 각각 테스트로 닫힌다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - review 도움말 형식 완결
* [Tasks 002](tasks/002/tasks.md) - close의 context-review.md 기록
* [Tasks 003](tasks/003/tasks.md) - plan approve 명령
* [Tasks 004](tasks/004/tasks.md) - plan 스킬·CLI 규칙 문서
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
