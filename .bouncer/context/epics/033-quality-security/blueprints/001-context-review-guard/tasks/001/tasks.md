---
type: bouncer.tasks
title: context_review 문서 종류와 scaffold 경로 신설
description: Tasks for 001
resource: .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-13T09:30:48.388+09:00'
bouncer:
  id: TASKS-001
  epic_id: '033'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - blueprint 문서 묶음에 계획 자체를 판정한 기록을 남길 자리가 없었음
    - blueprint 루트 context-review.md를 새 문서 종류로 등록하고 scaffold 경로를 냄
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/lib/schema.js
    - scripts/src/lib/paths.ts
    - scripts/lib/paths.js
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - scripts/src/lib/scaffold.ts
    - scripts/lib/scaffold.js
    - scripts/src/lib/cli.ts
    - scripts/lib/cli.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - test/schema.test.js
    - test/paths.test.js
    - test/scaffold.test.js
    - test/validate-structural.test.js
    - test/cli-help.test.js
    - docs/cli.md
    - docs/okf.md
  graph:
    generated_at: '2026-08-13T10:05:00+09:00'
    command: graphify query "context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 44 nodes; test/schema.test.js·test/skill-bouncer-surface.test.js·test/skill-review.test.js가 상위 히트. scripts/src/lib·scripts/lib·docs/는 히트가 없어 문서 종류 등록 지점을 보고 손으로 더함
      - graph: context
        status: updated
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 8 nodes; epic 031·009 index의 Success criteria와 031 explain 본문만 잡힘 — 신규 문서 종류를 가리키는 컨텍스트 히트는 없음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
blueprint 루트에 `context-review.md`가 정본 문서로 존재할 수 있게 된다.
`bouncer scaffold blueprint`가 이 문서를 함께 만들고, 기존 blueprint에는
`bouncer scaffold context-review --blueprint <dir>`로 붙일 수 있다. 전체
저장소 validate가 새 문서를 알려진 종류로 인식해 S1–S5·S19를 내지 않는다.
이 task는 문서 종류와 생성 경로까지만 만든다 — 게이트(G18)는 TASKS-003,
문서를 쓰는 주체(스킬·에이전트)는 TASKS-002다.

## Interface
- 제공:
  - `schema.ts`가 `bouncer.context_review`를 `TYPES`·`ID_PREFIX`
    (`CTXREVIEW-`)·`STATUS_ENUM`(`pending` | `requested` | `addressed` |
    `accepted`)·`KIND_TO_TYPE`(`context_review`)에 등록한다.
  - `paths.ts` `FILE_KIND`에 `'context-review.md': 'context_review'`.
  - `scaffold.ts` `scaffoldContextReview({ repoRoot, blueprintDir, timestamp })`
    가 `<bp>/context-review.md`를 만들고 생성 경로 배열을 돌려준다.
    `scaffoldBlueprint`가 `index.md` 다음, task 묶음보다 앞서 이를 호출한다.
  - `cli.ts`에 `scaffold context-review --blueprint <dir>` kind.
  - `validate.ts` `expectedTypeForPath`가 blueprint 아래 `context-review.md`에
    `bouncer.context_review`를 기대한다.
  - `validate.ts` `loadBlueprintDocs`가 blueprint 루트 `context-review.md`를
    `contextReview` 슬롯으로 읽는다(`explain`과 같은 BP 단위 슬롯, 부재는
    `null`). 이 task에서 슬롯까지 만드는 이유는 슬롯이 없으면 문서가 아예
    로드되지 않아 구조 검사가 돌지 않고, `expectedTypeForPath`는 export되지
    않아 `validateBlueprint` 경유로 S19를 볼 방법이 없기 때문이다. 슬롯은
    로드·구조 검사까지만 열고 게이트 판정은 넣지 않는다.
  - 문서 본문 템플릿은 `## Findings` 한 절이며, `review.md` 템플릿과 같은
    최소 형태를 쓴다.
- 거부:
  - `--blueprint` 누락 → `scaffold context-review: --blueprint is required`,
    종료 코드 2.
  - blueprint 디렉터리가 정본(`.bouncer/context/epics/**/blueprints/<NNN>-…`)이
    아니면 throw → `scaffold: <메시지>`, 종료 코드 2.
  - `context-review.md`가 이미 있으면 파일을 쓰지 않고 throw. `scaffoldExplain`의
    조용한 `[]` 반환과 다르다 — plan이 직접 부르는 명령이라 덮어쓰기가 사람 손에
    닿는다.
  - `closed` blueprint는 `scaffoldTask`와 같은 이유로 거절한다. 검사는 파일을
    쓰기 전에 끝낸다.

## Touch
- Modify `scripts/src/lib/schema.ts` — 새 type·id 접두·status enum·kind 매핑 등록
- Modify `scripts/lib/schema.js` — 위 emit
- Modify `scripts/src/lib/paths.ts` — `FILE_KIND`에 `context-review.md` 추가
- Modify `scripts/lib/paths.js` — 위 emit
- Modify `scripts/src/lib/templates.ts` — `context-review.md` 본문 템플릿과
  blueprint 템플릿 Documents 목록에 새 문서 링크 추가
- Modify `scripts/lib/templates.js` — 위 emit
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldContextReview` 추가와
  `scaffoldBlueprint` 호출, export
- Modify `scripts/lib/scaffold.js` — 위 emit
- Modify `scripts/src/lib/cli.ts` — `scaffold context-review` 분기
- Modify `scripts/lib/cli.js` — 위 emit
- Modify `scripts/src/lib/validate.ts` — `expectedTypeForPath`의 S19 매핑과
  `loadBlueprintDocs`의 `contextReview` 슬롯(로드만, 게이트 판정 없음)
- Modify `scripts/lib/validate.js` — 위 emit
- Modify `test/schema.test.js` — 새 type이 네 상수에 모두 등록됐는지
- Modify `test/paths.test.js` — `parsePathIds` kind 판정
- Modify `test/scaffold.test.js` — `created` 목록 변화와 중복·closed 거절
- Modify `test/validate-structural.test.js` — 정상 문서 통과와 type 불일치 S19
- Modify `test/cli-help.test.js` — 새 scaffold kind의 사용법 출력
- Modify `docs/cli.md` — `scaffold context-review` 행 추가
- Modify `docs/okf.md` — BP 루트 문서를 설명하는 문장 추가. 이 파일에는 문서
  종류 목록이 없고 task 묶음 세 문서를 설명하는 단락만 있으므로, 그 옆에
  `explain.md`·`context-review.md`가 BP 루트 문서라는 문장을 새로 쓴다

## Do not touch
- `scripts/src/lib/tasks-docs.ts` — task 묶음 basename SSOT다. `context-review.md`는
  BP 단위 문서이므로 `TASK_UNIT_BASENAMES`에 들어가면 안 된다.
- `scripts/src/lib/finalize.ts` — 마감 경로는 이 task 범위 밖이다.
- `skills/` · `agents/` — 문서를 쓰는 주체는 TASKS-002가 만든다.
- `.bouncer/context/epics/` 아래 032까지의 기존 문서 — 소급 생성하지 않는다.

## Constraints
- 새 어휘를 만들지 않는다. status enum과 findings 필드 이름(`id`·`severity`·
  `status`·`note`)은 `bouncer.review`의 것을 그대로 쓴다.
- 게이트 코드는 이 task에서 추가하지 않는다. `validate.ts` 수정은
  `expectedTypeForPath` 매핑과 `loadBlueprintDocs` 슬롯 두 곳이며,
  `checkGate`는 건드리지 않는다.
- 하위 호환 별칭·자동 마이그레이션을 두지 않는다. 032까지의 blueprint는
  문서가 없는 상태로 남는다.
- `scaffoldContextReview`는 모든 거절 검사를 통과한 뒤에만 파일을 쓴다.
- 비자명한 판단은 한국어 주석으로 남긴다 — 특히 `scaffoldExplain`과 중복 처리가
  갈리는 이유.

## Checklist
- [ ] `test/schema.test.js`에 `bouncer.context_review`가 `TYPES`·`ID_PREFIX`·
      `STATUS_ENUM`·`KIND_TO_TYPE` 네 곳에 모두 있고 접두가 `CTXREVIEW-`임을
      보는 실패 테스트를 먼저 추가하고 실패를 확인한다.
- [ ] `schema.ts`에 등록한다.
      ```ts
      'bouncer.context_review': 'CTXREVIEW-'
      'bouncer.context_review': ['pending', 'requested', 'addressed', 'accepted']
      context_review: 'bouncer.context_review'
      ```
- [ ] `paths.ts` `FILE_KIND`에 `'context-review.md': 'context_review'`를 넣고
      `test/paths.test.js`가 `parsePathIds('<bp>/context-review.md').kind ===
      'context_review'`를 보게 한다.
- [ ] `templates.ts`에 `context-review.md` 템플릿을 넣는다. 본문은
      `# Context review\n\n## Findings\n- <finding>\n` 형태로 `review.md`와
      같은 최소 형태를 유지한다. blueprint 템플릿 Documents 목록에
      `* [Context review](context-review.md) - 계획 문서 정합성 판정` 한 줄을
      더한다.
- [ ] `test/scaffold.test.js`에 실패 테스트를 추가한다 — `scaffoldBlueprint`의
      `created`가 `index.md`, `context-review.md`, task 묶음 3종 순서로 5개이고,
      frontmatter가 `id: CTXREVIEW-001` · `status: pending` ·
      `context_review: { findings: [] }`임을 본다.
- [ ] `scaffoldContextReview`를 구현하고 `scaffoldBlueprint`에서 호출한다.
      거절 순서는 정본 디렉터리 → `closed` → 이미 존재 → 쓰기다.
- [ ] `test/scaffold.test.js`에 중복 호출이 throw하고 파일 내용이 바뀌지 않음을,
      `closed` blueprint가 거절됨을 추가한다.
- [ ] `cli.ts`에 `context-review` kind를 넣고 `test/cli-help.test.js`가 새 사용법
      줄을 보게 한다. `--blueprint` 누락은 종료 코드 2와 전용 메시지다.
- [ ] `validate.ts` `loadBlueprintDocs`에 `contextReview` 슬롯을 넣는다. 기존
      고정 키 목록(`epicIndex`·`blueprintIndex`·`verification`·`review`·
      `explain`)에 한 항목을 더하는 것이며, 파일 부재는 슬롯 `null`이다.
      구조 검사 순회가 이 슬롯을 보게 해 새 문서가 `checkStructural`을 통과한다.
- [ ] `validate.ts` `expectedTypeForPath`에 blueprint 아래 `context-review.md`
      매핑을 넣고, `test/validate-structural.test.js`에 `validateBlueprint`
      경유로 정상 문서가 실패 없이 통과하는 1건과 type을 `bouncer.review`로
      바꾼 문서가 S19를 내는 1건을 추가한다. 슬롯이 없으면 문서가 로드되지
      않아 두 단언이 모두 공허하게 통과하므로, 위 슬롯 항목을 먼저 끝낸다.
- [ ] `docs/cli.md`에 `scaffold context-review` 행을, `docs/okf.md`에 BP 루트
      문서 문장을 넣는다.
- [ ] `npm test`가 통과한다.
