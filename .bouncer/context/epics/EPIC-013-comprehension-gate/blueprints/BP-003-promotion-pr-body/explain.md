---
type: bouncer.explain
title: 승격·PR를 explain 단일 소스로 맞추고 이해 상태를 제외함
description: Distill 승격과 draft PR 본문 소스를 explain.md로 통일한 변경 설명
resource: .bouncer/context/epics/EPIC-013-comprehension-gate/blueprints/BP-003-promotion-pr-body/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-05T10:50:15.279+09:00'
bouncer:
  id: EXPLAIN-BP-003
  epic_id: EPIC-013
  blueprint_id: BP-003
  status: published
  comprehension:
    diff_sha: 21bc11560a2689377014a9fe982939c114542811996de6d2b275bc8efbe80c86
    quiz_score: 1/5
    disposition: 'partial — Explain meta ok; 승격 여부·PR 섹션 소스·테스트/표면 규칙 불명확'
    recorded_at: '2026-08-05T10:56:13+09:00'
---
# Explain

## Background

BP-001·002가 `explain.md`와 퀴즈 배선을 세웠지만, Distill 승격과 draft PR
본문은 여전히 distill 시대 안내·템플릿에 기대 있었다. 승격이 `## 이해 상태`를
옮길 수 있었고, PR은 blueprint/tasks에서 따로 채우라고 해 설명 문서와 이중
저술이 생겼다. 이 BP는 스킬 지시·내장 `PR_TEMPLATE`·host PR 템플릿·문서를
`explain.md` 단일 소스로 맞추고, 이해 상태·Quiz·comprehension은 Distill과
PR에 실리지 않게 한다. 새 CLI나 PR 렌더러는 두지 않았다.

## Intuition

마감 산출물(승격·PR)은 모두 `explain.md`의 Background / Intuition / Code에서
오고, 퀴즈·이해 기록은 BP 문서에만 남는다.

## Code

- `skills/spec-authoring/SKILL.md` — Distill 승격 소스=`explain.md`;
  `## 이해 상태` / Quiz / comprehension 비승격을 긍정 문구로 명시
- `skills/bouncer-finalize/SKILL.md` — 승격 제외 재확인; PR 본문을
  Background / Intuition / Code에서 채움; Bouncer 메타에 Explain path
- `skills/bouncer-plan/SKILL.md` — plan은 `scaffold explain`을 finalize에 맡김
  (`scaffold distill` 제거)
- `scripts/src/lib/templates.ts` (+ build) — `PR_TEMPLATE`의
  `- Explain: <explain path>`; `PROJECT_DISTILL_BODY` cycle 문구 →
  `explain.md`; 미사용 `PROJECT_DISTILL` import 제거
- host: `.github/pull_request_template.md`,
  `.gitlab/merge_request_templates/기본.md` — `Distill:` → `Explain:`
- 계약: `test/skill-spec-authoring.test.js`,
  `test/skill-bouncer-finalize.test.js` (Distill/PR 제외·Explain 메타 각각 잠금)
- 문서: `docs/workflow.md`, `ARCHITECTURE.md`, `context-versioning.md`,
  `contributing.md`, `CLAUDE.md` (README는 PR 본문 소스 문장이 없어 유지)

### Cycle / next-BP

- EPIC-013 성공 조건 8·9가 이 BP로 채워짐. 에픽 추가 블루프린트는 없음.

## Quiz

1. Distill 승격의 소스는 어느 문서이며, `## 이해 상태`는 승격하는가?
2. draft PR 본문의 세 섹션 소스는 무엇인가? blueprint/tasks만으로 새로 써도
   되는가?
3. `PR_TEMPLATE` Bouncer 줄에 들어가는 플레이스홀더는?
4. 이해 상태 제외를 계약 테스트에서 `doesNotMatch(/이해 상태/)`로 잠그면 안
   되는 이유는?
5. `finalize.ts`에 PR 본문 빌더를 새로 두었는가? 최단 표면은 무엇인가?

## 이해 상태

- 점수: **1/5**
- 정답: (3) `Explain` / `- Explain: <explain path>` — OK
- 오답·공백:
  - (1) 소스는 `explain.md`이지만 **`## 이해 상태`는 승격하지 않는다**
  - (2) PR 섹션 소스는 Background / Intuition / Code (`explain.md`);
    blueprint/tasks만으로 새로 쓰면 안 됨 (이해 상태가 아님)
  - (4) 금지 설명이 본문에 남는 순간 부재 단언이 깨지므로 **긍정 제외 문구**로
    잠근다
  - (5) `finalize.ts`에 빌더를 두지 않음 — 스킬 지시 + 템플릿 문자열이 최단 표면
- disposition: partial — Explain meta ok; 승격 여부·PR 섹션 소스·테스트/표면 규칙 불명확
