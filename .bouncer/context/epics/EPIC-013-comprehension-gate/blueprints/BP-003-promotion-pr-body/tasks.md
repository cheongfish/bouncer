---
type: bouncer.tasks
title: 승격·PR 소스를 explain로 맞추고 이해 상태를 제외함
description: Distill 승격·PR 템플릿·finalize/spec-authoring·계약 테스트 갱신
resource: .bouncer/context/epics/EPIC-013-comprehension-gate/blueprints/BP-003-promotion-pr-body/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-05T10:28:55.939+09:00'
bouncer:
  id: TASKS-BP-003
  epic_id: EPIC-013
  blueprint_id: BP-003
  status: verified
  affected_paths:
    - skills/spec-authoring/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/bouncer-plan/SKILL.md
    - test/skill-spec-authoring.test.js
    - test/skill-bouncer-finalize.test.js
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - docs/workflow.md
    - docs/ARCHITECTURE.md
    - docs/context-versioning.md
    - docs/contributing.md
    - README.md
    - CLAUDE.md
    - .github/pull_request_template.md
    - .gitlab/merge_request_templates/기본.md
  graph:
    generated_at: '2026-08-05T10:30:10+09:00'
    command: graphify query (source)
    suggested_paths:
      - scripts/lib
      - scripts/src/lib
      - test
      - skills
      - docs
    basis: >-
      source 질의 "explain.md Distill promotion exclude 이해 상태 PR body
      finalize templates spec-authoring"과 "templates PR_TEMPLATE PROJECT_DISTILL
      promote Distill explain finalize"가 TEMPLATES·finalize() 이웃만 돌려
      scripts/lib를 집었다. 이 BP는 finalize.ts 커밋/makeAllowed 로직을 바꾸지
      않으므로 이웃은 근거로만 쓰고 경로로는 scripts/src/lib(templates)·
      scripts/lib(빌드 산출)·test(스킬 계약)만 올렸다. config.source_dirs가
      skills/docs를 포함하지 않아 Distill gotcha대로 skills·docs를 수동
      시드했다. CLAUDE.md·host PR 템플릿은 파일 단위라 suggested_paths 밖이며
      affected_paths에서 확인한다.
---
# Tasks

Blueprint: [BP-003](index.md)

## Goal & intent
마감 때 Distill 승격과 draft PR 본문이 BP `explain.md`를 단일 소스로 쓰게 한다.
`## 이해 상태`(및 Quiz·comprehension 필드)는 전역 Distill과 PR에 실리지 않는다.
스킬 지시·`pr.md`/Distill init 문구·host PR 템플릿·문서 표기·계약 테스트를
맞추고 `npm test`로 검증한다. 새 CLI·PR 렌더러는 추가하지 않는다.

## Interface
- 제공: Distill 승격이 `explain.md`의 durable 항목만 Invariants/Gotchas/Decisions로
  옮긴다. `## 이해 상태` 제외를 긍정 문구로 명시한다.
- 제공: draft PR 본문이 `explain.md`(Background / Intuition / Code)에서 채워지고,
  `## 🚦 Bouncer`에 explain 경로가 들어간다.
- 제공: `PROJECT_DISTILL_BODY`·`pr.md`·host PR 템플릿이 distill-era 후보/메타
  문구를 explain로 바꾼다.
- 거부: `## Quiz` / `## 이해 상태` / `quiz_score`·`disposition`을 Distill이나
  PR에 복사하는 지시.
- 거부: blueprint/tasks만으로 PR 본문을 새로 쓰는 별도 저술 단계.
- 거부: `finalize.ts`에 PR 본문 빌더·승격 파서를 새로 두는 것 — 스킬 + 템플릿
  문자열이 최단 표면이다.
- 거부: G15·`computeDiffSha`·`makeAllowed`·handoff 로직 변경.

## Touch
- Modify `skills/spec-authoring/SKILL.md` — Distill 승격 소스=`explain.md`,
  `## 이해 상태`·Quiz·comprehension 비승격을 긍정 문구로 명시.
- Modify `skills/bouncer-finalize/SKILL.md` — 승격 단계에서 이해 상태 제외를
  재확인하고, PR 본문을 `explain.md`에서 채우도록 바꾸며 blueprint/tasks 단독
  저술 지시를 제거. `## 🚦 Bouncer`에 explain 경로.
- Modify `skills/bouncer-plan/SKILL.md` — plan scaffold가 `distill`이 아니라
  finalize의 `scaffold explain`임을 맞게 고친다(남은 distill 표기 제거).
  대응 계약 테스트는 없다(`test/skill-bouncer-plan.test.js` 부재, surface
  테스트는 `name`/`description`만 본다). 이 커밋에서 새로 만들지 않는
  **문서 전용 수정**임을 알고 고친다.
- Modify `test/skill-spec-authoring.test.js` — 승격 소스·이해 상태 제외 단언.
- Modify `test/skill-bouncer-finalize.test.js` — PR=`explain.md` 채움,
  이해 상태 비승격·비PR, Distill 경로가 PR 메타에 없다는 단언.
- Modify `scripts/src/lib/templates.ts` — `PR_TEMPLATE` Bouncer 줄을 Explain
  경로로; `PROJECT_DISTILL_BODY`의 BP 후보를 `explain.md`로.
  explain 경로는 BP마다 달라 정적 상수가 없다. `${PROJECT_DISTILL}` 보간을
  같은 블록의 `<epic-id>`/`<bp-id>`와 같은 **플레이스홀더**로 바꾼다:
  ```
  - Explain: <explain path>
  ```
  그러면 파일 상단 `const { PROJECT_DISTILL } = require('./layout');`가 유일한
  사용처를 잃는다 — 같이 지운다(`layout.ts`의 export는 유지).
- Modify `scripts/lib/templates.js` — 위 소스 빌드 산출물(`npm run build`).
- Modify `docs/workflow.md` — finalize 승격·PR이 explain 소스임을 반영.
- Modify `docs/ARCHITECTURE.md` — Distill 승격 소스 표기를 explain로.
- Modify `docs/context-versioning.md` — 「BP distill에서 승격」→ explain.
- Modify `docs/contributing.md` — draft PR이 explain에서 채워짐을 명시.
- Modify `README.md` — finalize 한 줄/다이어그램에 explain→승격·PR 소스 통일.
  기존 Distill 언급 5곳은 모두 **전역** Distill 이야기라 그대로 맞다. 고칠 것은
  PR 본문 소스 표기뿐이며, 손댈 문장이 없으면 변경 없이 둔다.
- Modify `CLAUDE.md` — Project Distill 승격 소스를 explain notes로; When to
  invoke / Session conduct의 distill 본문 표기를 정리.
- Modify `.github/pull_request_template.md` — Bouncer 메타 `Distill:` →
  `Explain:`.
- Modify `.gitlab/merge_request_templates/기본.md` — 동일.

## Do not touch
- `scripts/src/lib/finalize.ts` / `scripts/lib/finalize.js` — 커밋·
  `makeAllowed`·handoff는 유지.
- `scripts/src/lib/validate.ts` / `scripts/lib/validate.js` — G15 유지.
- `scripts/src/lib/comprehension.ts` / `scripts/lib/comprehension.js` —
  해시 API 유지.
- `scripts/src/lib/scaffold.ts` / `scripts/lib/scaffold.js` — scaffold 계약
  유지.
- `skills/explain-diff/SKILL.md` — 저술·퀴즈·기록 절차는 BP-002; 승격/PR은
  finalize·spec-authoring이 담당.
- `test/comprehension.test.js` / `test/validate-gates.test.js` /
  `test/finalize.test.js` — 게이트·커밋 단위 테스트 재설계 없음.
- `.bouncer/context/Distill.md` — 런타임 승격 대상; 이 커밋에서 본문 편집
  없음.
- `AGENTS.md` — `@CLAUDE.md`만 import; CLAUDE 변경으로 충분.
- `CHANGELOG.md` — 「BP distill」 표기가 남아 있으나 지난 릴리스의 기록이다.
  이력은 고쳐 쓰지 않는다.
- `scripts/src/lib/layout.ts` — `PROJECT_DISTILL` 상수·export 유지. templates에서
  import만 끊는다.

## Constraints
- 새 런타임 의존성·CLI·PR 렌더 함수를 추가하지 않는다 (minimality: 스킬 지시 +
  템플릿 문자열이 요구를 충족).
- `scripts/lib/*.js`는 빌드 산출물 — 소스는 `scripts/src/**`만 편집 후
  `npm run build`.
- 스킬 YAML `description`에 이스케이프되지 않은 `##`를 넣지 않는다.
- 이해 상태 제외·PR explain 소스는 **긍정 문구**로 단언한다. 낱말 부재
  (`doesNotMatch(/이해 상태/)`)로 단언하면 금지 설명이 있는 순간 깨진다.
- `config.source_dirs`가 `skills/`를 포함하지 않으므로 graph에 스킬·docs를
  수동 시드한다.
- 공개 스킬·문서 언어 관례를 유지한다.

## Checklist
- [ ] 실패 테스트부터: finalize/spec-authoring 계약에 아래를 추가하고 구현 전
  실패를 확인한다.
  ```js
  // test/skill-spec-authoring.test.js
  assert.match(md, /explain\.md/);
  assert.match(md, /이해 상태/); // 제외 대상 언급
  assert.match(md, /승격하지 않|옮기지 않|제외/);

  // test/skill-bouncer-finalize.test.js
  assert.match(body, /explain\.md/);
  assert.match(body, /이해 상태/);
  assert.match(body, /승격하지 않|옮기지 않|제외/);
  // PR 본문 소스는 긍정 문구로 못 박는다. 지금 finalize:142의
  // "fill its sections from the blueprint and tasks" 문장을 doesNotMatch로
  // 노리면 그 문장이 한 글자만 바뀌어도 단언이 무의미해진다.
  assert.match(body, /PR body[\s\S]{0,200}explain\.md|explain\.md[\s\S]{0,200}PR body/);
  for (const s of ['Background', 'Intuition', 'Code']) {
    assert.ok(body.includes(s), `PR fill rule must name ${s}`);
  }
  ```
- [ ] `skills/spec-authoring/SKILL.md` — 승격 소스·섹션 화이트리스트·이해 상태
  제외.
- [ ] `skills/bouncer-finalize/SKILL.md` — 승격 재확인 + PR 채움 규칙을
  explain 기반으로 교체; Bouncer 메타에 explain 경로.
- [ ] `skills/bouncer-plan/SKILL.md` — `scaffold distill` → finalize
  `scaffold explain` 안내.
- [ ] `templates.ts` — `PR_TEMPLATE`의 `- Distill: ${PROJECT_DISTILL}`을
  `- Explain: <explain path>` 플레이스홀더로, `PROJECT_DISTILL_BODY`의
  `distill.md` cycle 문구 → `explain.md`, 미사용이 된 `PROJECT_DISTILL`
  import 제거; `npm run build`.
- [ ] host PR 템플릿(`.github` / `.gitlab`) `Distill:` → `Explain:`.
- [ ] `docs/workflow.md`, `ARCHITECTURE.md`, `context-versioning.md`,
  `contributing.md`, `README.md`, `CLAUDE.md` 표기 갱신.
- [ ] `npm test` 통과.
