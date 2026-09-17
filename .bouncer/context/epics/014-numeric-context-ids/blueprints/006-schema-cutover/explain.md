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
      quiz_score: 3/3
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

## Tasks

### Task 001

#### Goal & intent

`schema.ts`가 `bouncer.scale`·`bouncer.commit_type`·번들 루트
`bouncer_schema`를 아는 상수로 갖고, scaffold와 init이 그 값을 실제로 쓴다.
지금은 `scale`이 스킬 산문에만 있고 `commit_type`은 `finalize.ts`가 읽되
scaffold가 만들지 않아 항상 `'feat'` 폴백으로 떨어진다. 이 task는 쓰기만
한다 — 값 검사는 TASKS-002다.

`scale`을 정식 필드로 올리면 "선언이 없으면 키 자체를 넣지 않는다"는 현재 plan
규칙이 성립하지 않는다. scaffold가 `full`을 쓰고 경량 선언은 그 값을 `light`로
바꾸는 형태로 바뀌므로, 그 규칙을 담은 스킬·문서 산문도 같은 커밋에서 고친다.

#### Interface

- 제공:
  - `scripts/src/lib/schema.ts`가 네 이름을 추가로 export한다.
    ```js
    BOUNCER_SCHEMA_VERSION  // '0.1'
    SCALE_ENUM              // ['light', 'full']
    DEFAULT_SCALE           // 'full'
    DEFAULT_COMMIT_TYPE     // 'feat'
    ```
  - `scaffoldBlueprint`가 쓰는 `index.md` `bouncer:` 블록에
    `commit_type: feat`와 `scale: full`이 들어간다. 키 순서는 `status` 뒤.
  - `init`의 `CONTEXT_INDEX`와 `epic-index`의 `EMPTY_CONTEXT_INDEX`가 만드는
    번들 루트 frontmatter가 두 줄이 된다.
    ```yaml
    okf_version: "0.1"
    bouncer_schema: "0.1"
    ```
- 거부:
  - epic·tasks·verification·review·explain 문서에는 `scale`도 `commit_type`도
    쓰지 않는다. 두 필드는 blueprint 전용이다.
  - 이미 있는 번들 루트 `index.md`를 코드가 소급 수정하지 않는다.
    `ensureEpicIndexEntry`는 파일이 없을 때만 frontmatter를 만든다. 이
    저장소의 기존 파일은 사람이 한 줄 넣는다.
  - `scale`의 소비자에 `full` 분기를 만들지 않는다. 판정은 계속
    `scale === 'light'` 한 줄이다.

#### Touch

- Modify `scripts/src/lib/schema.ts` — 네 상수 추가와 export.
- Modify `scripts/lib/schema.js` — 산출물 동기화.
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldBlueprint`의 `bouncer:`에
  `commit_type`·`scale` 기본값을 넣는다.
- Modify `scripts/lib/scaffold.js` — 산출물 동기화.
- Modify `scripts/src/lib/init.ts` — `CONTEXT_INDEX`에 `bouncer_schema` 줄.
- Modify `scripts/lib/init.js` — 산출물 동기화.
- Modify `scripts/src/lib/epic-index.ts` — `EMPTY_CONTEXT_INDEX`에 같은 줄.
- Modify `scripts/lib/epic-index.js` — 산출물 동기화.
- Modify `.bouncer/context/index.md` — 이 저장소 번들 루트에 `bouncer_schema`
  한 줄을 넣는다(코드가 소급 수정하지 않으므로 손으로).
- Modify `test/schema.test.js` — 네 상수의 값을 고정하는 단언 추가.
- Modify `test/scaffold.test.js` — blueprint frontmatter에 두 필드가 있고
  task·epic 문서에는 없음을 단언.
- Modify `test/init.test.js` — 번들 루트 frontmatter 두 줄 단언.
- Modify `docs/okf.md` — `bouncer_schema`가 무엇이고 왜 문서마다 두지 않는지.
- Modify `skills/bouncer-plan/SKILL.md` — 경량 선언 문구를 "키를 넣지 않는다"
  에서 "scaffold가 쓴 `full`을 `light`로 바꾼다"로. `schema.ts`에 등록하지
  않는다는 서술도 지운다.
- Modify `docs/workflow.md` — 같은 문구(72·86행 부근).
- Modify `docs/governance.md` — 같은 문구(21–24·50행 부근).
- Modify `test/lightweight-cycle.test.js` — 위 문구 단언을 새 표현으로.

#### Constraints

- `bouncer_schema` 값은 문자열 `"0.1"`이다. `1.0` 승격은 epic 029 소관이며 이
  blueprint에서 값을 올리지 않는다.
- 세 필드 모두 **선택**이다. 부재를 실패로 만드는 코드를 이 task에 넣지 않는다.
- `scale` 기본값은 `full`이고, 필드가 없는 문서도 `full`로 읽힌다. 소비자
  코드·산문은 `light`인지만 본다.
- `scripts/lib/*.js`는 손으로 고치지 않는다. `npm run build` 산출물을 그대로
  커밋한다.
- 스킬·문서 산문을 고칠 때 경량 경로의 판단 기준(사용자에게 묻는다, 진단으로
  자동 판정하지 않는다)은 바꾸지 않는다. 바뀌는 것은 키를 어떻게 쓰는가뿐이다.

### Task 002

#### Goal & intent

`checkStructural`이 두 가지를 더 본다. `type`이 파일 위치가 요구하는 종류와
같은지(**S19**), blueprint의 `bouncer.scale`이 허용 값인지(**S20**).

지금 `type`은 `TYPES`에 있는 값인지만 보므로(S2), `tasks.md` 자리에
`bouncer.review` 문서가 놓여도 통과한다. `resource`(S3)와 id(S5)는 각각 경로와
번호만 보므로 종류 불일치를 잡지 못한다. `scale`은 TASKS-001이 정식 필드로
올렸지만 아직 아무도 값을 확인하지 않는다.

#### Interface

- 제공:
  - `validate.ts` 안의 지역 헬퍼 `expectedTypeForPath(rel)` — 경로에서 기대
    `type`을 돌려주거나, 종류를 판정할 수 없으면 `null`.
    ```
    <epic>/index.md                     → bouncer.epic
    <bp>/index.md                       → bouncer.blueprint
    <bp>/tasks/<NNN>/tasks.md           → bouncer.tasks
    <bp>/tasks/<NNN>/verification.md    → bouncer.verification
    <bp>/tasks/<NNN>/review.md          → bouncer.review
    <bp>/explain.md                     → bouncer.explain
    그 외                                → null
    ```
    task 묶음 basename은 `tasks-docs.ts`의 `TASK_UNIT_BASENAMES`에서, 종류→타입
    변환은 `schema.ts`의 `KIND_TO_TYPE`에서 가져온다.
  - **S19** — `expectedTypeForPath`가 값을 주고 `data.type`이 그것과 다르면
    실패. 메시지에 기대 타입과 실제 타입을 모두 담는다.
  - **S20** — `data.type`이 `bouncer.blueprint`이고 `bouncer.scale`이
    `undefined`가 아니면서 `SCALE_ENUM` 밖이면 실패.
- 거부:
  - `expectedTypeForPath`가 `null`이면 S19를 내지 않는다. 위치 규칙이 없는
    경로까지 강제하지 않는다.
  - `scale` 부재는 S20이 아니다. 0.7 blueprint가 그대로 통과해야 한다.
  - blueprint가 아닌 문서의 `scale`은 판정하지 않는다 — 어차피 소비자가 읽지
    않으며, 새 금지 규칙을 여기서 만들지 않는다.
  - S19는 `type`이 `TYPES` 안에 있을 때만 낸다. 알 수 없는 `type`은 S2가
    이미 조기 반환으로 처리한다.
  - 새 모듈을 만들지 않는다. `validate.ts`가 이미 `tasks-docs`·`schema`·
    `paths`를 모두 require하므로 헬퍼를 그 안에 둔다.

#### Touch

- Modify `scripts/src/lib/validate.ts` — `expectedTypeForPath` 헬퍼와
  `checkStructural`의 S19·S20 분기.
- Modify `scripts/lib/validate.js` — 산출물 동기화.
- Modify `test/validate-structural.test.js` — S19·S20 실패/통과 케이스.
- Modify `docs/gates.md` — S 코드 문단에 S19·S20 추가.
- Modify `docs/troubleshooting.md` — 두 코드의 증상별 대처 행 추가.

#### Constraints

- S14·S9·S15는 결번이거나 이미 쓰이는 번호다. 새 코드는 S19·S20이며 기존 번호를
  재사용하지 않는다.
- task 문서 basename과 `\d{3}` 규칙은 `tasks-docs.ts`에만 있다는 불변식을
  지킨다. `expectedTypeForPath`는 `TASK_UNIT_BASENAMES`를 순회해 만들고
  `'tasks.md'` 같은 문자열을 직접 쓰지 않는다.
- 두 코드 모두 게이트와 무관한 상시 구조 검사다. `checkGate` 분기에 넣지
  않는다.
- `imported` status 문서도 구조 검사를 거친다. 임포트가 만든 문서가 S19에
  걸리면 임포트 경로의 버그이므로 예외를 파지 말고 그대로 드러낸다.
- 실패 메시지는 영어 한 줄로, 기존 S 코드 메시지 형식을 따른다.

### Task 003

#### Goal & intent

루트 `tasks.md` / `tasks-<NNN>.md`는 이미 task 문서로 해석되지 않고 S15로
거절된다. 그런데 문서·스킬·에이전트 산문 열 곳 남짓이 아직 그것을 "또는 레거시
루트 task 문서"라는 살아있는 선택지로 서술하고, `loadBlueprintDocs`는 묶음이
하나도 없을 때 대표 task 경로를 레거시 basename으로 채운다. 읽는 쪽이 두 레이아웃을
다 지원한다고 믿게 만드는 마지막 자리를 닫는다.

남기는 것은 `bouncer migrate task-layout`의 **입력**이라는 서술 하나다. 명령과
`tasks-docs.ts`의 탐지는 그대로다 — S15 메시지가 그 위에 서 있다.

#### Interface

- 제공:
  - `loadBlueprintDocs`의 `rels.tasks`가 묶음이 없을 때 `<bp>/tasks/001/tasks.md`
    를 가리킨다. `LEGACY_TASKS_BASENAME` import는 사라진다.
  - 워크플로 스킬·에이전트 브리프가 task 브리프 경로를 `tasks/<NNN>/tasks.md`
    하나로만 지칭한다.
  - 문서에서 루트 레이아웃은 `bouncer migrate task-layout` 입력으로만 등장한다.
- 거부:
  - `bouncer migrate task-layout` 명령, `tasks-docs.ts`의 `LEGACY_TASKS_BASENAME`
    ·`NUMBERED_TASKS_RE`·`legacyFiles` 탐지, S15 자체는 건드리지 않는다.
  - `docs/gates.md`의 S15 설명은 이미 "하나뿐"이라고 쓰여 있으므로 손대지
    않는다.
  - 스킬 산문에서 문장을 지우기만 하고 브리프 섹션 목록·리뷰 루브릭·가드 문구를
    다시 쓰지 않는다.

#### Touch

- Modify `scripts/src/lib/validate.ts` — `LEGACY_TASKS_BASENAME` import 제거와
  `rels.tasks` 폴백 교체.
- Modify `scripts/lib/validate.js` — 산출물 동기화.
- Modify `test/validate-structural.test.js` — 묶음 없는 blueprint가 어떤 경로를
  보고하는지 고정하는 단언.
- Modify `CLAUDE.md` — 하드룰 1의 「legacy … remain migration targets until the
  layout cutover」 문장을 마이그레이션 입력 서술로 교체.
- Modify `docs/okf.md` — 「Root task layouts are retained only as migration
  targets during the transition」 교체.
- Modify `docs/governance.md` — 루트 문서 문장을 마이그레이션 입력으로 한정.
- Modify `docs/context-versioning.md` — 37행 괄호 안 레거시 언급 제거.
- Modify `docs/ARCHITECTURE.md` — 계획 행 괄호의 레거시 마이그레이션 대상
  서술을 제거하거나 migrate-input으로 한정.
- Modify `skills/review/SKILL.md` — 브리프 경로에서 레거시 대안 제거.
- Modify `skills/review/assets/reviewer-prompt.md` — 같은 문구.
- Modify `skills/implementation/SKILL.md` — 같은 문구.
- Modify `skills/graphify-runner/SKILL.md` — YAML `description`과 본문 두 곳.
- Modify `skills/bouncer-execute/SKILL.md` — 브리프 문서 지칭.
- Modify `skills/verification/SKILL.md` — 「remain migration targets until
  the layout cutover」 제거.
- Modify `skills/bouncer-commit/SKILL.md` — next-task 경로의 레거시 대안 제거.
- Modify `skills/bouncer-plan/SKILL.md` — scaffold 안내의 root-layout
  migration-targets 문장 교체.
- Modify `agents/bouncer-reviewer.md` — `description`과 브리프 섹션 안내.
- Modify `agents/bouncer-implementer.md` — `description`.
- Modify `agents/bouncer-debugger.md` — 브리프 섹션 안내 두 곳.

#### Constraints

- 스킬 `description`은 YAML 한 줄 문자열이다. 따옴표를 유지하고 `##`을 넣지
  않는다(주석으로 잘린다).
- 리뷰어 루브릭·`reviewer-prompt.md`·`agents/` 문서·execute 디스패치는 한
  커밋 단위라는 기존 규칙을 지킨다. 이 task가 그 넷을 함께 담는다.
- 문구 교체는 의미를 좁히기만 한다. 브리프 섹션 목록, 가드, 출력 계약은 그대로
  둔다.
- `scripts/lib/*.js`는 손으로 고치지 않는다.

### Task 004

#### Goal & intent

`spec-authoring`이 필요할 때 읽을 완성 예시를
`skills/spec-authoring/references/`에 둔다. 지금 작성자가 가진 것은 스캐폴드
템플릿의 `<TODO>` 주석뿐이라, 각 섹션이 어느 정도 구체적이어야 하는지가 산문
규칙으로만 전달된다. 예시 하나가 규칙 열 줄을 대신한다.

skill anatomy의 `references/`는 필요할 때 로드하는 자리이므로 종류별 파일로
쪼갠다. `SKILL.md`는 경로만 가리키고 본문을 복사하지 않는다.

#### Interface

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

#### Touch

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

#### Constraints

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
