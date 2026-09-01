---
type: bouncer.tasks
title: 문서 종류별 작성 예시 추가
description: Tasks for 004
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-12T15:12:13.241+09:00'
bouncer:
  id: TASKS-004
  epic_id: '014'
  blueprint_id: '006'
  status: verified
  commit_intent:
    - 스캐폴드 주석만으로는 완성된 문서가 어떤 밀도인지 알 수 없었음
    - 예시를 읽는 주체가 spec-authoring이므로 그 스킬의 references에 둠
  affected_paths:
    - skills/spec-authoring/references/epic.md
    - skills/spec-authoring/references/blueprint.md
    - skills/spec-authoring/references/tasks.md
    - skills/spec-authoring/references/review.md
    - skills/spec-authoring/SKILL.md
    - test/skill-spec-authoring.test.js
  graph:
    generated_at: '2026-08-12T15:41:00.000+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
      - skills
      - agents
    basis:
      - graph: source
        status: reused
        query: document schema frontmatter type validate scaffold blueprint init epic-index bundle root okf_version tasks-docs legacy task layout
        result: 39 nodes — 이 task의 대상인 skills/spec-authoring은 source_dirs 밖이라 히트 없음. 예시가 따라야 할 계약은 게이트 코드(G11·G12·G14)에서 직접 확인
      - graph: context
        status: updated
        query: 문서 스키마 필드 승격 scale commit_type bouncer_schema type 대조 레거시 레이아웃 컷오버 작성 예시
        result: 6 nodes — 024-light-path/001-scale-light-convention explain.md(경량 scale 도입 경위), 006-scripts-typescript index.md
---
# Tasks

Blueprint: [006](../../index.md)

## Goal & intent
`spec-authoring`이 필요할 때 읽을 완성 예시를
`skills/spec-authoring/references/`에 둔다. 지금 작성자가 가진 것은 스캐폴드
템플릿의 `<TODO>` 주석뿐이라, 각 섹션이 어느 정도 구체적이어야 하는지가 산문
규칙으로만 전달된다. 예시 하나가 규칙 열 줄을 대신한다.

skill anatomy의 `references/`는 필요할 때 로드하는 자리이므로 종류별 파일로
쪼갠다. `SKILL.md`는 경로만 가리키고 본문을 복사하지 않는다.

## Interface
- 제공:
  - `references/epic.md`, `references/blueprint.md`, `references/tasks.md`,
    `references/review.md` 네 파일. 각각 frontmatter 포함 완성 문서 한 벌.
  - `SKILL.md`의 「How to author」 2단계에서 종류별 예시 경로를 가리키는 줄.
- 거부:
  - `verification.md` 예시는 만들지 않는다. 그 문서는
    `recordVerificationResult`가 덮어쓰고, 하드룰 3이 손으로 쓴 성공 증적을
    금지한다. 예시를 두면 베껴 쓰라는 신호가 된다.
  - `explain.md` 예시도 만들지 않는다. 본문·퀴즈·이해 기록은 `explain-diff`
    소관이며 `spec-authoring`은 그 문서를 쓰지 않는다.
  - 예시는 실제 저장소 경로를 흉내 내되 `.bouncer/context/`에 들어가지
    않는다. 스킬 자산이지 컨텍스트 문서가 아니므로 validate 대상이 아니다.

## Touch
- Create `skills/spec-authoring/references/epic.md` — Intent·Success criteria·
  Out of scope·Blueprints가 채워진 epic 한 벌.
- Create `skills/spec-authoring/references/blueprint.md` — Contract 다섯 항목과
  One-commit justification이 채워진 blueprint 한 벌.
- Create `skills/spec-authoring/references/tasks.md` — 여섯 섹션과
  `commit_intent`·Touch 동사·Checklist 코드블록이 채워진 task 한 벌.
- Create `skills/spec-authoring/references/review.md` — `## Findings` 항목이
  severity/status/note를 갖춘 review 한 벌.
- Modify `skills/spec-authoring/SKILL.md` — 예시 경로 안내 추가.
- Modify `test/skill-spec-authoring.test.js` — 네 파일 존재와 SKILL.md의 경로
  언급 단언.

## Do not touch
- `scripts/` — 이 task는 문서만 만든다.
- `skills/explain-diff/`·`skills/review/` — 예시를 그쪽으로 늘리지 않는다.
- 스캐폴드 템플릿(`scripts/src/lib/templates.ts`) — 예시는 템플릿을 대체하지
  않는다.

## Constraints
- 예시 본문은 한국어다. 식별자·경로·코드 펜스는 그대로 둔다.
- 예시는 실재하는 게이트 계약과 어긋나면 안 된다. task 예시의 `affected_paths`
  는 Touch 항목으로 전부 정당화되고 Do not touch와 겹치지 않아야 한다(G11·G12).
  review 예시의 finding은 `id`·`severity`·`status`를 갖고 `accepted`에는
  `note`가 있어야 한다(G14).
- `<TODO>` 같은 자리표시자를 예시에 남기지 않는다. 예시가 곧 완성 기준이다.
- 예시 하나는 한 화면에서 읽히는 분량으로 둔다. 실제 문서를 통째로 복사해
  붙이지 않는다.
- `SKILL.md`에 예시 본문을 옮기지 않는다. `references/`는 필요할 때 로드하는
  자리다.

## Checklist
- [ ] `test/skill-spec-authoring.test.js`에 실패 테스트를 추가한다.
      ```js
      for (const k of ['epic', 'blueprint', 'tasks', 'review']) {
        assert.ok(fs.existsSync(refPath(`${k}.md`)), k);
      }
      assert.match(readSkill('spec-authoring'), /references\//);
      ```
- [ ] `node --test test/skill-spec-authoring.test.js`로 실패를 확인한다.
- [ ] `references/epic.md`를 쓴다. Success criteria는 번호가 붙고 각 줄이 참·
      거짓으로 판정 가능해야 한다.
- [ ] `references/blueprint.md`를 쓴다. Contract는 인터페이스·데이터/상태·수용
      기준·검증 명령·실패 모드 다섯 항목을 모두 채우고 구현 코드는 넣지 않는다.
- [ ] `references/tasks.md`를 쓴다. `commit_intent` 두 줄, 파일 단위 Touch 동사,
      실패 테스트 → 확인 → 구현 순서의 Checklist를 보인다.
- [ ] `references/review.md`를 쓴다. finding 두 개 — 하나는 `resolved`, 하나는
      `note`가 있는 `accepted`.
- [ ] `SKILL.md`의 「How to author」에 예시 경로 한 줄을 넣는다.
- [ ] `npm test`가 통과한다.
