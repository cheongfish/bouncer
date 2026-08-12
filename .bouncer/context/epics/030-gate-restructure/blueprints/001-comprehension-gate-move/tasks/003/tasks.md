---
type: bouncer.tasks
title: explain·퀴즈 단계의 finalize 이관과 문서 갱신
description: Tasks for 003
resource: .bouncer/context/epics/030-gate-restructure/blueprints/001-comprehension-gate-move/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T11:14:29.559+09:00'
bouncer:
  id: TASKS-003
  epic_id: '030'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 퀴즈가 PR 단위로 한 번만 오도록 워크플로 순서가 정리됨
    - 문서와 스킬이 실제 게이트 판정과 같은 것을 가리키게 됨
  affected_paths:
    - skills/bouncer-commit/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/explain-diff/SKILL.md
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - docs/gates.md
    - docs/workflow.md
    - docs/troubleshooting.md
    - docs/ARCHITECTURE.md
    - docs/governance.md
    - docs/cli.md
    - README.md
    - CLAUDE.md
    - test/skill-bouncer-commit.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-explain-diff.test.js
    - test/skill-bouncer-surface.test.js
    - test/lightweight-cycle.test.js
  graph:
    generated_at: '2026-08-12T12:45:49.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - test/helpers
      - skills/bouncer-commit
      - skills/bouncer-finalize
      - skills/explain-diff
      - docs
    basis:
      - graph: source
        status: reused
        query: commit gate comprehension explain diff_sha staged affected_paths scope validate finalize
        result: 90 nodes — skill-bouncer-surface.test.js·test/helpers/read-skill.js가 스킬 산문을 읽는 계약 테스트임을 확인. source_dirs가 scripts/hooks/test라 skills/·docs/는 그래프에 없어 수동 추가
      - graph: context
        status: updated
        query: commit gate comprehension explain diff_sha staged affected_paths scope validate finalize
        result: 14 nodes — epic 013-comprehension-gate blueprints 001/002/003 explain.md 섹션
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`explain-diff` 호출이 `/bouncer-commit`에서 사라지고 `/bouncer-finalize`의
Distill 승격 다음 단계로 들어간다. `explain-diff` 자신은 task별 append가
아니라 blueprint 엔트리 하나를 쓰고, `range_from`은 포인터 `base`이며
`quiz_score`가 필수다. explain 템플릿의 `## 이해 상태`는 task별 소제목 없는
단일 블록이 된다. 게이트 문서·워크플로 문서·README 다이어그램이 새 판정
(commit = G6/G7/G8 + G17, finalize = G16)을 가리킨다.

## Interface
- 제공:
  - `/bouncer-finalize` 순서: Distill 승격 → explain 작성 + 퀴즈 →
    `validate --gate finalize` → `finalize --yes` → PR.
  - `/bouncer-commit` 순서: scope dry-run → `validate --gate commit` →
    상태 확인 → 커밋 ACQ → 다음 task ACQ. explain 단계가 없다.
  - `explain-diff`는 `bouncer.comprehension`에 엔트리 하나를 쓴다.
    `task` 필드를 쓰지 않고, `range_from`은 포인터 `base`이며,
    `quiz_score`는 비울 수 없다.
- 거부:
  - 퀴즈를 건너뛰고 `disposition`에 사유만 남기는 경로를 없앤다.
    퀴즈 미응답이면 finalize를 중단한다.
  - 퀴즈 이후 커밋이 더 쌓여 해시가 어긋나면 본문과 `diff_sha`만 갱신한다.
    퀴즈를 다시 내지 않는다.
  - 스킬 문구에 G15를 남기지 않는다.

## Touch
- Modify `skills/bouncer-commit/SKILL.md` — explain 단계(step 2)를 지우고
  이후 단계 번호와 게이트 설명, frontmatter `description`을 고친다.
- Modify `skills/bouncer-finalize/SKILL.md` — Distill 승격 다음에 explain +
  퀴즈 단계를 넣고, "퀴즈를 여기서 돌리지 않는다"는 금지 문구와
  `description`을 고친다.
- Modify `skills/explain-diff/SKILL.md` — task별 append를 blueprint 단일
  엔트리로 바꾸고, `range_from`을 포인터 `base`로 고정하며, 퀴즈 스킵 예외를
  없애고 `## 이해 상태` 단일 블록 규칙을 적는다.
- Modify `scripts/src/lib/templates.ts` — explain 템플릿의 `## 이해 상태`
  주석을 단일 블록 안내로 바꾼다.
- Modify `scripts/lib/templates.js` — 산출물 동기화.
- Modify `docs/gates.md` — commit·finalize 행을 새 판정으로 바꾸고 G17을
  추가, G15를 결번으로 적는다.
- Modify `docs/workflow.md` — 단계 목록·다이어그램·스킬 표의 explain 위치를
  옮긴다.
- Modify `docs/troubleshooting.md` — G15 증상 행을 G16·G17 행으로 바꾼다.
- Modify `docs/ARCHITECTURE.md` — `explain-diff`를 finalize 하위 스킬로
  적는다.
- Modify `docs/governance.md` — `/bouncer-commit` 한 줄 설명에서 comprehension
  단계를 뺀다.
- Modify `docs/cli.md` — `scaffold explain` 호출 주체를 `/bouncer-finalize`로
  고친다.
- Modify `README.md` — 워크플로 다이어그램의 `explain-diff` 노드와 게이트
  라벨을 옮긴다.
- Modify `CLAUDE.md` — "When to invoke" 표에서 explain 기록 주체를 옮긴다.
- Modify `test/skill-bouncer-commit.test.js` — explain-diff 참조 단언을
  부재 단언으로 바꾼다.
- Modify `test/skill-bouncer-finalize.test.js` — 부재 단언을 존재 단언으로
  바꾸고 순서를 못 박는다.
- Modify `test/skill-explain-diff.test.js` — 단일 엔트리·`quiz_score` 필수·
  단일 블록 계약을 단언한다.
- Modify `test/skill-bouncer-surface.test.js` — 스킬 참조 그래프 단언을
  새 호출 관계로 고친다.
- Modify `test/lightweight-cycle.test.js` — `scale: light` 1문항 규칙이
  새 문구에서도 성립하도록 단언을 맞춘다.

## Do not touch
- `scripts/src/lib/validate.ts` — 게이트 코드는 TASKS-001·002에서 끝났다.
- `scripts/src/lib/comprehension.ts` — 같은 이유.
- `scripts/src/lib/scaffold.ts` — `comprehension: []` 기본값은 그대로다.
- `hooks/commit-safety.js` — 훅은 이 blueprint에서 바꾸지 않는다.

## Constraints
- 게이트 코드를 바꾸지 않는다. 이 task는 문서와 스킬 산문, 그리고 explain
  템플릿 문자열만 만진다.
- 한국어 본문에는 `stop-slop`을 적용한다. 스킬 산문은 기존 영어/한국어 혼용
  관례를 그대로 따른다(단계 설명은 영어, ACQ 문구는 한국어).
- 스킬 계약 테스트는 부재 단언(`doesNotMatch`)만으로 규칙을 표현하지 않는다.
  금지 문구 자체가 매칭을 깨뜨리므로 존재 단언을 함께 둔다.
- 퀴즈 문항 수 규칙(1–10 판단, `scale: light`면 1)은 그대로 둔다.
- 커밋 메시지·PR 본문 규칙은 건드리지 않는다.

## Checklist
- [ ] `test/skill-bouncer-finalize.test.js`에 실패 테스트를 먼저 추가한다:
      finalize 본문이 `explain-diff`를 참조하고, 그 참조가 Distill 승격
      단계보다 뒤에 온다.
      ```js
      const i = body.indexOf('skills/spec-authoring/SKILL.md');
      const j = body.indexOf('skills/explain-diff/SKILL.md');
      assert.ok(i > -1 && j > i);
      ```
- [ ] `test/skill-bouncer-commit.test.js`를 부재 단언으로 바꾼다:
      `assert.doesNotMatch(body, /skills\/explain-diff\/SKILL\.md/)`.
- [ ] `node --test test/skill-bouncer-commit.test.js test/skill-bouncer-finalize.test.js`
      로 실패를 확인한다.
- [ ] `skills/bouncer-commit/SKILL.md`에서 step 2를 지우고 step 3의 게이트
      설명을 "G6/G7/G8 재확인 + G17 스테이징 스코프"로 바꾼다. 이후 단계
      번호와 "Gates in this skill" 줄을 맞춘다.
- [ ] `skills/bouncer-finalize/SKILL.md`에 explain + 퀴즈 단계를 넣는다.
      `scaffold explain` 호출도 여기로 옮긴다.
- [ ] `skills/explain-diff/SKILL.md`를 단일 엔트리 계약으로 다시 쓴다.
- [ ] `test/skill-explain-diff.test.js`에 `quiz_score` 필수와 단일 블록
      계약 단언을 추가한다.
- [ ] `scripts/src/lib/templates.ts`의 explain 템플릿 주석을 고치고
      `npm run build`로 산출물을 재생성한다.
- [ ] `docs/gates.md`·`docs/workflow.md`·`docs/troubleshooting.md`·
      `docs/ARCHITECTURE.md`·`docs/governance.md`·`docs/cli.md`·`README.md`·
      `CLAUDE.md`를 새 순서와 게이트 코드로 갱신한다.
- [ ] `npm test`가 통과한다.
