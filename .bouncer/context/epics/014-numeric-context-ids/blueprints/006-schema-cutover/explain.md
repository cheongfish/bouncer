---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/006-schema-cutover/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T17:10:48.359+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '014'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: develop
      range_to: d9e1706196d8d3606226e31f65f6e8ee033bf162
      diff_sha: 3a2368db0dad7cb93c43ba8b56af24684ea7873fc40f74fded2d798ee60a5905
      quiz_score: '3/3'
      disposition: bouncer_schema는 번들 루트만, 잘못된 scale은 S20, 경량은 scale 값을 light로
      recorded_at: '2026-08-12T17:12:25+09:00'
---
# Explain

## Background
문서 표면이 세 갈래로 어긋나 있었다. `scale`은 산문에만 있고 코드가 몰랐고,
`commit_type`은 코드가 읽어도 scaffold가 안 썼고, `type`과 파일 위치는 아무도
대조하지 않았다. 스키마 버전을 걸 자리도 없어 1.0에서 「이 표면을 깨지 않는다」고
가리킬 대상이 없었다. 이 브랜치는 네 필드를 코드·scaffold·검증기에 맞추고,
루트 `tasks.md` / `tasks-<NNN>.md`를 살아있는 레이아웃처럼 서술하던 문장을
`migrate task-layout` 입력으로만 남긴다. 완성된 문서 밀도는
`skills/spec-authoring/references/` 예시로 보여 준다.

## Intuition
번들 루트에 스키마 도장을 찍고, blueprint 기본값(`commit_type`·`scale`)은
scaffold가 심는다. 잘못된 `type`/`scale`은 구조 코드(S19/S20)가 잡는다.
옛 루트 task 파일은 이사 짐표만 남긴다.

## Code
- `scripts/src/lib/schema.ts` — `BOUNCER_SCHEMA_VERSION='0.1'`,
  `SCALE_ENUM`, `DEFAULT_SCALE`, `DEFAULT_COMMIT_TYPE` export.
- `scripts/src/lib/scaffold.ts` — blueprint `index.md`에 `commit_type`·`scale`
  기본값 기록.
- `scripts/src/lib/init.ts` / `epic-index.ts` — 번들 루트
  `.bouncer/context/index.md`에만 `bouncer_schema: "0.1"` (기존 저장소는
  사람이 추가; EMPTY 템플릿이 소급하지 않음).
- `scripts/src/lib/validate.ts` — **S19** 경로가 요구하는 `type`과 불일치,
  **S20** blueprint `scale`이 enum 밖(부재는 허용).
- 서술 컷오버: `CLAUDE.md`, `docs/okf.md`, 워크플로/스킬의 루트 task 경로
  표현. 예시: `skills/spec-authoring/references/{epic,blueprint,tasks,review}.md`.
- 회귀: `test/schema.test.js`, `test/validate-structural.test.js`,
  `test/scaffold.test.js`, `test/skill-spec-authoring.test.js`.

## Quiz
1. `bouncer_schema: "0.1"`을 두는 올바른 자리는?
   - A) 모든 epic/blueprint/task 문서 frontmatter
   - B) 번들 루트 `.bouncer/context/index.md`만 (`okf_version` 옆)
   - C) blueprint `index.md`의 `bouncer:` 블록

2. blueprint에 `bouncer.scale: "lite"`처럼 enum 밖 값이 있으면?
   - A) S20으로 거절한다
   - B) 무시하고 일반(`full`) 경로로 진행한다
   - C) S19로 거절한다

3. scaffold가 만든 blueprint에서 경량 경로로 바꾸려면?
   - A) `scale` 줄을 지운다
   - B) epic에 `scale: light`를 쓴다
   - C) `scale` 값을 `light`로 바꾼다

## 이해 상태
- 점수: 3/3
- Q1 정답 B / 응답 B — 맞음
- Q2 정답 A / 응답 A — 맞음
- Q3 정답 C / 응답 C — 맞음
- disposition: bouncer_schema는 번들 루트만, 잘못된 scale은 S20, 경량은 scale 값을 light로
