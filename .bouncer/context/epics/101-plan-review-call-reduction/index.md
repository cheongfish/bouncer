---
type: bouncer.epic
title: plan 컨텍스트 리뷰 호출 축소
description: Cut plan context-review model calls by making review CLI help complete, writing context-review.md on close, and approving plan status in one command.
resource: .bouncer/context/epics/101-plan-review-call-reduction/index.md
tags:
  - bouncer
  - epic
  - plan
  - context-review
  - cli
  - approval
timestamp: '2026-10-15T13:32:16.829+09:00'
bouncer:
  id: '101'
  epic_id: '101'
  status: approved
  supersedes: []
---
# 101 plan 컨텍스트 리뷰 호출 축소

## Intent
plan context review와 승인 구간에서 에이전트가 형식 탐색, 투영 수작업, 문서별 상태 편집, 나뉜 수정 편집으로 모델 호출을 쓰는 원인을 CLI와 지침으로 없앤다.
도움말이 기록 형식을 완결하게 알려주고, close가 `context-review.md`를 직접 기록하며, plan 승인 상태 전환을 한 명령으로 한다.

## Diagram
```mermaid
flowchart LR
  A[형식 확인] --> B[리뷰 기록]
  B --> C[수정 반영]
  C --> D[close 기록]
  D --> E[승인 전환]
  E --> F[plan 게이트]
```

## Success criteria
1. `bouncer review-dispatch --help`와 `bouncer context-review --help`가 `record`의 `--round`와 `close`의 `--dispositions`가 받는 모든 필드와 허용 값을 보여주고, 열거값은 검증기 상수에서 생성된다.
2. 도움말의 discovery round·delta round·dispositions 예시를 그대로 쓴 입력을 `context-review record`·`close`가 받아들이며, 이를 확인하는 테스트가 있다.
3. `context-review close`와 cycle을 닫는 `record --status accepted`가 성공하면 blueprint 루트 `context-review.md`의 `bouncer.context_review`·`bouncer.status: accepted`·`## Findings` 절이 기록되고 그 문서가 plan 게이트 G18을 통과한다. 응답의 `projection`은 유지된다.
4. 같은 입력으로 close를 다시 실행하면 `context-review.md` 바이트가 같고, `## Findings` 밖의 본문은 바뀌지 않는다.
5. close·record가 거절되거나(열린 `must_fix`, note 없는 accepted 등) `context-review.md`가 없거나 frontmatter가 깨졌으면 `context-review.md`를 바꾸지 않고 reason·cause·next와 exit 1을 낸다.
6. `bouncer plan approve --blueprint <dir>`가 epic `draft→approved`, blueprint `draft→approved`, task `draft→ready`를 한 번에 전이하고 바꾼 파일 목록을 출력한다. 이미 전이된 문서는 바꾸지 않고 본문 바이트는 그대로다.
7. full blueprint의 context-review가 `accepted`가 아니거나 대상 문서 하나라도 전이 불가 상태이면 `plan approve`는 어떤 파일도 바꾸지 않고 reason·cause·next와 exit 1을 낸다. light blueprint는 context-review 검사를 건너뛴다. `current` pointer는 바꾸지 않는다.
8. plan `SKILL.md` 6단계가 사용자 승인 뒤 `bouncer plan approve`를 쓰라고 안내하고, `references/context-review.md`가 `must_fix`를 문서별로 묶어 문서당 편집 1회로 반영하라고 하며 close가 문서를 직접 기록한다고 적는다. `npm run lint:docs`와 `test/skill-bouncer-*.test.js`가 통과한다.
9. 새·변경 명령은 `rules/cli.md`와 도움말에 함께 반영되고, 새 테스트 이름은 `<조건> → <결과>` 형식이며(`npm run lint:test-names`), `npm run build` 후 `npm run check:emit`와 `npm run ci`가 통과한다.
10. 병합 뒤 `node benchmarks/run-bouncer-full.cjs --task fastify-001 --stop-after 02-plan`을 설정당 3회 이상 실행해 리뷰 구간의 형식 탐색 0회, 손작업 0회, 상태 편집 1회 이하, 수정 편집 수 ≤ 수정 대상 문서 수인지 기록한다. 이 항목은 재측정 보고 대상이며 게이트 조건이 아니다.

## Out of scope
- plan 스킬 분할, 리뷰 컨트롤러를 새 세션으로 분리하는 일.
- `restart` 빈도를 줄이는 규칙과 `follow_up: full` 원인 조사.
- 리뷰어 계약, 승인 의미, ACQ 게이트 목록 변경, `context-review close` 질문의 ACQ화.
- `must_fix` 묶음 반영의 도구화, Graphify 관련 변경.
- `plan approve`에 `current --set`을 합치는 일.
- 기존 epic 096(cycle·restart·delta 인증)과 098/003(리뷰 초점) 계약 변경.

## Blueprints
* [001 리뷰 CLI 마감](blueprints/001-review-cli-closure/index.md) - review 도움말·close 문서 기록·plan approve 명령과 plan 스킬 지침을 `scripts/src/lib`와 `skills/bouncer-plan`에서 바꾼다.
