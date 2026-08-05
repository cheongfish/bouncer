---
type: bouncer.tasks
title: 001 tasks
description: Tasks for 001
resource: .bouncer/context/epics/005-review-depth/blueprints/001-reviewer-prompt/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-03T00:37:28.416Z'
bouncer:
  id: TASKS-001
  epic_id: '005'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - skills/review/
    - skills/bouncer-execute/
    - test/
  graph:
    generated_at: '2026-08-03T00:38:00.000Z'
    command: skipped
    suggested_paths: []
    basis: 'graphify.enabled=false in .bouncer/config.json; graceful fallback. Manual seed from blueprint touch set: skills/review, skills/bouncer-execute, test.'
---
# Tasks

Blueprint: [001](index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
Bouncer review가 Findings 계약에 Spec/Quality 루브릭을 더하고, sibling
`reviewer-prompt.md`로 fresh generic 서브에이전트 리뷰를 받은 뒤 컨트롤러가
기존 `review.md`에 기록하도록 한다. 게이트·스키마는 그대로 두고 스킬 표면과
계약 테스트만 바꾼다. 검증: `npm test`.

## Interface
- `skills/review/SKILL.md` — Review 단계에 Spec compliance / Code quality /
  Calibration과 severity 매핑(`blocker|major|minor|nit`)을 추가. dispatch →
  컨트롤러 기록 → disposition → accepted 순서 명시. 기존 Findings 계약 유지.
- `skills/review/reviewer-prompt.md` (신규) — 읽기 전용 리뷰어 디스패치 템플릿
  (placeholders: brief, base/HEAD, constraints). 출력은 Findings만; tree/status
  변경 금지.
- `skills/bouncer-execute/SKILL.md` — step 5가 위 prompt로 fresh generic
  서브에이전트를 보내고, 컨트롤러가 `review.md`를 갱신한다고 명시.
- `test/skill-review.test.js` — 루브릭·`reviewer-prompt` 참조·`superpowers`/
  `profile` 금지를 어서트.
- `test/skill-bouncer-execute.test.js` — step 5의 서브에이전트/prompt/
  컨트롤러 기록 계약을 어서트(기존 어서션 유지).

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     경로는 백틱으로 감쌉니다. -->
- `skills/review/` — `SKILL.md` 루브릭·dispatch 절차 확장, `reviewer-prompt.md` 추가
- `skills/bouncer-execute/` — step 5를 prompt dispatch + 컨트롤러 기록으로 갱신
- `test/` — `skill-review`·`skill-bouncer-execute` 계약 테스트 갱신

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/` — 게이트·스키마·검증 실행 로직 불변
- `agents/` — named agent 도입 금지(디렉터리 신설 포함)
- `.bouncer/templates/` — review 템플릿/스키마 골격 변경 없음
- `skills/minimality/` · `skills/verification/` · `skills/implementation/` —
  이번 BP 범위 밖
- `docs/superpowers/` — 역사 문서; 런타임 표면에 출처 문자열을 옮기지 않음

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `skills/review/reviewer-prompt.md` 작성: 읽기 전용, placeholders, Spec+Quality
      루브릭, Findings 출력(severity 매핑·file:line), tree/status 변경 금지
- [ ] `skills/review/SKILL.md` 갱신: 루브릭·Calibration·dispatch→기록→disposition;
      Findings 계약·required=false skip 유지; prompt 파일 링크
- [ ] `skills/bouncer-execute/SKILL.md` step 5 갱신: prompt 채움 → fresh generic
      서브에이전트 → 컨트롤러가 `## Findings`와 `bouncer.review.findings[]` 갱신 →
      미해결이면 fix 후 재검토 → 그다음 accepted; 서브에이전트 부재 시 인라인
      읽기 전용 폴백 한 줄
- [ ] `test/skill-review.test.js`에 루브릭 키워드·`reviewer-prompt`·
      `superpowers`/`profile` 금지 어서션 추가/유지
- [ ] `test/skill-bouncer-execute.test.js`에 dispatch/prompt/컨트롤러 기록 계약
      어서션 추가; 기존 worktree·gate 어서션 유지
- [ ] 수용: 세 마크다운 표면이 위 Interface를 충족하고 테스트가 계약을 고정한다
- [ ] 검증: `npm test` 통과
