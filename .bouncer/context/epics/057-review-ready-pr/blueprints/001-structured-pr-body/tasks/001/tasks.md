---
type: bouncer.tasks
title: 리뷰 흐름 중심 PR 본문 계약 개편
description: PR 생성 지침과 템플릿, 라벨 기본값, 문서, 계약 테스트를 리뷰 흐름 중심 구조로 맞춘다
resource: .bouncer/context/epics/057-review-ready-pr/blueprints/001-structured-pr-body/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - finalize
  - pull-request
timestamp: '2026-08-28T13:06:04.942+09:00'
bouncer:
  id: TASKS-001
  epic_id: '057'
  blueprint_id: '001'
  status: verified
  affected_paths:
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - skills/bouncer-finalize/references/draft-pr.md
    - .github/pull_request_template.md
    - .gitlab/merge_request_templates/기본.md
    - test/skill-bouncer-finalize.test.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - config.example.json
    - test/init.test.js
    - docs/contributing.md
    - docs/configuration.md
  verify: npm test
  commit_intent:
    - 기존 PR 본문은 변경 의도와 검증 근거를 한 흐름으로 읽기 어려운 구조임
    - Explain과 검증 증적을 조합한 리뷰 중심 본문을 생성하도록 개편함
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T13:10:26.234+09:00'
    suggested_paths:
      - test
      - scripts/src/lib
      - scripts/lib
      - .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify
      - .bouncer/context/epics/041-plan-mermaid-zoom/blueprints/001-mermaid-authoring-convention
    basis:
      - graph: source
        status: updated
        query: finalize PR body template Explain Background Intuition Code review points verification evidence Mermaid labels init config
        result: 3개 hit — test/cli-init.test.js, scripts/src/lib/init.ts, scripts/lib/init.js
      - graph: context
        status: updated
        query: finalize PR body template Explain Background Intuition Code review points verification evidence Mermaid labels init config
        result: 3개 hit — epic 044 finalize 증적 explain, epic 041 Mermaid 저술 explain
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
finalize가 Explain·diff·계획·검증 증적을 정해진 섹션에 조합하고, 자동·수동
PR/MR 템플릿과 신규 config가 같은 계약을 따르게 한다. 제목 생성과 finalize
코어는 유지하며 Epic 성공 조건 1–8과 `npm test` 통과를 완료 기준으로 삼는다.

## Interface
- 제공:
  - `PR_TEMPLATE`과 host 템플릿에 `관련 이슈` → `배경 · 변경 의도` →
    `주요 변경 내용` → 선택적 `로직 흐름` → `리뷰 포인트` → `확인 방법`
    순서를 제공한다.
  - `draft-pr.md`는 섹션별 허용 소스, 실제 Explain 링크, 다중 task 검증 집계,
    최종 검증 우선순위, Mermaid 생성·생략 기준을 제공한다.
  - 신규 config의 `pr` 기본값은 `draft`와 `base`만 제공한다.
- 거부:
  - 근거 없는 이슈·리뷰 위험·검증 성공·Mermaid 노드를 만들지 않는다.
  - Epic/Blueprint ID, Bouncer 전용 섹션, Quiz·이해 상태·점수,
    Features/Fixes 체크박스, `gh pr create --label`을 출력하지 않는다.
  - 기존 config의 `pr.labels`가 있어도 자동 라벨을 붙이거나 config 오류를
    내지 않는다.

## Touch
- Modify `scripts/src/lib/templates.ts` — 내장 `PR_TEMPLATE`을 새 섹션 구조로 바꾼다.
- Modify `scripts/lib/templates.js` — TypeScript 빌드 산출물을 소스와 동기화한다.
- Modify `skills/bouncer-finalize/references/draft-pr.md` — 섹션별 소스,
  Mermaid 조건, 검증 집계, Explain 링크, 라벨 미부착 규칙을 명시한다.
- Modify `.github/pull_request_template.md` — 수동 GitHub PR 구조를 맞춘다.
- Modify `.gitlab/merge_request_templates/기본.md` — 수동 GitLab MR 구조를 맞춘다.
- Modify `test/skill-bouncer-finalize.test.js` — 새 본문·제외·링크·검증·라벨 계약을 잠근다.
- Modify `scripts/src/lib/init.ts` — 신규 config의 `pr.labels` 기본값을 제거한다.
- Modify `scripts/lib/init.js` — init 빌드 산출물을 소스와 동기화한다.
- Modify `config.example.json` — 공개 config 예제에서 `pr.labels`를 제거한다.
- Modify `test/init.test.js` — 라벨 없는 신규 config shape를 잠근다.
- Modify `docs/contributing.md` — 자동·수동 PR 작성 구조와 Explain 링크를 설명한다.
- Modify `docs/configuration.md` — `pr.labels` 필드를 제거하고 기존 키가 무시됨을 설명한다.

## Do not touch
- `scripts/src/lib/finalize.ts` — PR 직전 검증·커밋·pointer 반환 계약은 유지한다.
- `skills/bouncer-finalize/SKILL.md` — draft PR 상세는 이미 조건부 reference가 소유한다.
- `skills/explain-diff/SKILL.md` — Explain·Quiz·comprehension 저술 계약은 범위 밖이다.
- `scripts/src/lib/validate.ts` — finalize 게이트와 comprehension 판정은 바꾸지 않는다.
- `.bouncer/Distill.md` — 계획 단계에서 프로젝트 런타임 규칙을 승격하지 않는다.

## Constraints
- PR 제목 생성 문구와 branch push·draft 생성·graceful skip 순서는 유지한다.
- PR 본문은 Explain을 다시 저술하지 않고 요약·구체화하며 Quiz·이해 상태·
  comprehension 필드를 계속 제외한다.
- `로직 흐름`은 조건부 절이다. 핵심 노드는 약 8개 이하로 제한하고,
  문서·설정·테스트만 변경되거나 단순 이름 변경·이동이면 제목까지 제거한다.
- 모든 task의 verification 증적을 번호순으로 읽고, 성공한 최종
  `finalize --yes` 검증을 가장 최근 결과로 표시한다. 원시 출력을 길게 복사하지 않는다.
- `pr.labels` 제거는 신규 기본값과 자동 부착만 대상으로 한다. 기존 config의
  알 수 없는 키 허용 동작을 깨거나 마이그레이션을 추가하지 않는다.
- 소스 TypeScript를 먼저 바꾸고 `npm run build`로 `scripts/lib`를 생성한다.

## Checklist
- [ ] finalize 계약 테스트에 새 섹션 순서, Markdown Explain 링크, 다중 task
  검증 집계, 최종 검증 우선, Mermaid 생성·생략, 기존 메타·이해 정보·`--label`
  제외 단언을 추가하고 init 테스트의 기대 config에서 `labels`를 제거한다.
- [ ] 변경한 테스트가 현행 템플릿과 지침에서 실패하는지 확인한다.

```bash
node --test test/skill-bouncer-finalize.test.js test/init.test.js
```

- [ ] `PR_TEMPLATE`과 두 host 템플릿을 새 순서로 바꾼다. 수동 템플릿에는
  비-Bouncer 작업의 Explain 제거와 조건 미충족 시 `로직 흐름` 제목 제거를
  HTML 주석으로 안내한다.
- [ ] `draft-pr.md`가 허용 소스만 조합하고 빈 섹션을 제거하도록 작성한다.
  Explain URL은 pushed head branch 또는 commit을 가리키며, 여러 task의
  검증 결과와 PR 직전 최종 검증을 짧게 구분한다.
- [ ] init 기본값과 `config.example.json`에서 `pr.labels`를 제거하고,
  기존 키는 읽더라도 `gh pr create` 인자로 전달하지 않게 한다.
- [ ] `npm run build`로 `scripts/lib/templates.js`와 `scripts/lib/init.js`를
  생성해 TypeScript 소스와 맞춘다.
- [ ] 기여·설정 문서를 실제 동작과 맞추고 기존 제목 규칙은 그대로 둔다.
- [ ] 전체 검증을 실행한다.

```bash
npm test
```
