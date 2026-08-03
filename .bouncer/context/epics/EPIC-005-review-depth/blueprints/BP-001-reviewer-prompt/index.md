---
type: bouncer.blueprint
title: BP-001 reviewer-prompt
description: Blueprint BP-001
resource: .bouncer/context/epics/EPIC-005-review-depth/blueprints/BP-001-reviewer-prompt/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-03T00:37:28.416Z'
bouncer:
  id: BP-001
  epic_id: EPIC-005
  blueprint_id: BP-001
  status: approved
---
# BP-001 reviewer-prompt

Epic: [EPIC-005](../../index.md)

## Intent
- 문제: `skills/review/SKILL.md`는 Findings·disposition 계약만 정의하고, 무엇을
  어떤 심각도로 볼지와 fresh 서브에이전트 분리가 없다. `bouncer-execute` step 5는
  같은 세션이 `review` 스킬을 직접 쓰라고만 한다.
- 완료 조건: review 스킬에 Spec compliance / Code quality / Calibration 루브릭과
  severity 매핑이 있고, `skills/review/reviewer-prompt.md`가 읽기 전용 리뷰어
  페르소나·출력 형식을 제공하며, `bouncer-execute`가 generic 서브에이전트
  dispatch → 컨트롤러가 `review.md`를 갱신하는 순서를 명시한다. 관련 테스트가
  계약을 고정하고 `npm test`가 통과한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스 (`skills/review/SKILL.md`): 기존 Findings 계약
  (`severity: blocker|major|minor|nit`, `status: resolved|accepted`, accepted는
  note 필수)을 유지한다. Review 단계에 Spec compliance(Missing/Extra/Misunderstood),
  Code quality, Calibration을 두고 severity 매핑을 명시한다. 컨트롤러는 sibling
  `reviewer-prompt.md`를 채워 generic 서브에이전트에 넘기고, 서브에이전트
  Findings를 기존 `review.md`에 기록한 뒤에만 `review → accepted`를 고려한다.
- 인터페이스 (`skills/review/reviewer-prompt.md`): 읽기 전용 리뷰어용 디스패치
  템플릿. placeholders로 tasks brief·diff basis(`base`/`HEAD`)·전역 제약을 받는다.
  출력은 severity가 매핑된 Findings(file:line 근거)이며 working tree를 변경하지
  않는다. `review.md` status 갱신은 하지 않는다.
- 인터페이스 (`skills/bouncer-execute/SKILL.md` step 5): verify 이후 review는
  (1) prompt 채우기 (2) fresh generic 서브에이전트 dispatch (3) 컨트롤러가
  `review.md` body `## Findings`와 `bouncer.review.findings[]`를 갱신
  (4) actionable 미해결이면 fix 후 재검토 (5) 모두 `resolved` 또는 note 있는
  `accepted`일 때만 `review → accepted`. `required === false`면 기존처럼 skip.
- 데이터·상태: review 문서 스키마·게이트 G8 불변. 마크다운 스킬·테스트만 변경.
- 수용 기준: 루브릭·prompt·execute dispatch 문구가 테스트로 고정되고,
  `superpowers`/`profile` 문자열이 review·execute 스킬 표면에 없으며 `npm test`
  통과.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: `review.required === false`면 dispatch 생략.
  서브에이전트 도구가 없는 하네스에서는 컨트롤러가 동일 prompt로 인라인
  리뷰하되, 구현 근거와 분리된 읽기 전용 패스로 수행한다고 스킬에 적는다.
  actionable finding이 남은 채 accepted 금지(기존 계약).

## Out of scope
- `agents/` named agent 또는 Cursor/Claude/Codex 전용 서브에이전트 타입 등록.
- scoped re-review 전용 두 번째 prompt 파일·N회 fix 루프 오케스트레이션.
- `scripts/lib/validate.js`, review frontmatter 스키마, 게이트 번호 변경.
- 외부 플러그인 참조 문자열·어댑터.
- `minimality` 스킬 본문 변경(execute가 이미 advisory로 호출 가능).

## One-commit justification
<!-- .bouncer/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 변경의 실체는 review 계약 확장 + sibling prompt + execute가 그 둘을 쓰도록
  연결하는 한 줄기의. prompt만 추가하면 execute가 호출하지 않고, execute만
  바꾸면 루브릭/페르소나가 없다.
- 런타임·게이트 코드가 없어 회귀 범위는 스킬 마크다운과 계약 테스트로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
