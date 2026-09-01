---
type: bouncer.tasks
title: distill 문서 종류를 explain으로 교체하고 마감 게이트에 이해 기록 검사를 세움
description: schema/paths/templates/scaffold/cli/validate 계약 교체, comprehension 모듈 신설
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/005-explain-doc-contract/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-05T09:09:32.892+09:00'
bouncer:
  id: TASKS-001
  epic_id: '018'
  blueprint_id: '005'
  status: verified
  affected_paths:
    - scripts/src/lib/schema.ts
    - scripts/src/lib/paths.ts
    - scripts/src/lib/templates.ts
    - scripts/src/lib/scaffold.ts
    - scripts/src/lib/cli.ts
    - scripts/src/lib/validate.ts
    - scripts/src/lib/comprehension.ts
    - scripts/src/lib/advisor.ts
    - scripts/lib/schema.js
    - scripts/lib/paths.js
    - scripts/lib/templates.js
    - scripts/lib/scaffold.js
    - scripts/lib/cli.js
    - scripts/lib/validate.js
    - scripts/lib/comprehension.js
    - scripts/lib/advisor.js
    - skills/bouncer-finalize/SKILL.md
    - test/schema.test.js
    - test/paths.test.js
    - test/scaffold.test.js
    - test/validate-gates.test.js
    - test/validate-structural.test.js
    - test/advisor.test.js
    - test/cli-verify.test.js
    - test/finalize.test.js
    - test/finalize-pure.test.js
    - test/skill-bouncer-finalize.test.js
    - test/comprehension.test.js
    - docs/gates.md
    - docs/troubleshooting.md
  graph:
    generated_at: '2026-08-05T09:19:12+09:00'
    command: graphify query (source + context)
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - .bouncer/context
    basis: 'graph-sync가 source·context 두 그래프를 모두 재빌드했다(built: [source, context], failed·missing 없음). source 질의 "scaffoldDistill loadBlueprintDocs validateBlueprint finalize gate G9 distill status published"와 "FILE_KIND DOC_KIND bouncer.distill prefix status detectPhase statusOf"가 같은 묶음을 돌려줬다 — scaffold·validate·paths·schema· templates·advisor·cli가 `scaffoldDistill`과 `FILE_KIND`를 통해 한 사슬 위에 있고, 문서 종류를 한 곳만 바꾸면 나머지가 깨지는 구조가 그래프에도 그대로 보인다. 이것이 이 블루프린트를 한 커밋으로 묶는 근거다. `finalize`와 `layout`도 같은 이웃으로 나왔지만 승격·경로 상수는 BP-003 범위라 Do not touch로 내렸다. `verification`·`current`·`seed-worktree`·`runtime-state`는 호출 이웃일 뿐 문서 종류 계약을 건드리지 않아 제외했다. context 질의 "distill 문서 finalize 게이트 승격 explain 설명 이해"는 프로젝트 Distill.md와 EPIC-012·EPIC-004의 BP distill.md를 집었다 — 소급 마이그레이션은 에픽 Out of scope이므로 근거에서만 쓰고 경로로 올리지 않았다. 같은 질의가 다른 저장소 (sdd-plugin)의 절대 경로 노드를 돌려줬는데 이전 빌드가 남긴 오염 노드라 제외했다. `config.source_dirs`가 scripts/hooks/test라 `skills/`와 `docs/`는 질의가 돌려주지 않아 수동으로 보탰다(Distill의 기존 gotcha).'
---
# Tasks

Blueprint: [005](index.md)

## Goal & intent
블루프린트 문서 집합에서 `distill.md`가 사라지고 `explain.md`가 그 자리에 선다. 문서
종류는 `bouncer.explain`이고, 스캐폴드는 `bouncer scaffold explain --blueprint <dir>`로
만든다. `validate --gate finalize`는 `G9`(상태 검사) 대신 `G15`를 내며, 다섯 섹션의
본문 작성 여부, `bouncer.comprehension` 기록의 존재, 그리고 게이트가 직접 다시 계산한
`base..HEAD` 해시와 `diff_sha`의 일치를 판정한다. 해시 계산은 `.bouncer/context/` 아래
경로를 제외하므로 `explain.md` 자신이 커밋에 들어가도 값이 흔들리지 않는다.

이 커밋은 계약과 판정만 만든다. 본문을 누가 쓰는지(002), 승격과 PR 본문(003)은
건드리지 않는다. 검증은 `npm test`.

## Interface
- 제공: 문서 종류 `bouncer.explain` — id 접두 `EXPLAIN-`, 상태 `['draft', 'published']`,
  파일명 `explain.md`. `DOC_KIND` 맵의 키는 `explain`이다.
- 제공: `bouncer scaffold explain --blueprint <dir>`. 성공 시 생성 경로를 담은 `created`
  배열을 돌려준다. 파일이 이미 있으면 `created`는 빈 배열이고 기존 내용을 덮어쓰지
  않는다.
- 제공: `explain.md` 프론트매터의 `bouncer.comprehension` 블록. 스캐폴드 기본값은 네
  필드 모두 빈 문자열이다 — `diff_sha`, `quiz_score`, `disposition`, `recorded_at`.
- 제공: `computeDiffSha({ repoRoot, base, exec? })`가
  `{ ok: true, sha }` 또는 `{ ok: false, reason }`을 돌려준다. `reason`은
  `'no-base' | 'not-a-repo' | 'exec-failed'`.
- 제공: 마감 게이트 실패 코드 `G15`. 메시지는 세 갈래를 구분한다 — 섹션 미작성,
  기록 누락, 해시 불일치.
- 거부: `computeDiffSha`는 예외를 던지지 않는다. 모든 실패는 `ok: false` 값이다.
- 거부: `G15`는 `quiz_score` 값을 해석하지 않는다. `'1/5'`도 `'5/5'`도 판정에 영향을
  주지 않으며, 점수를 비교하는 코드가 존재하지 않아야 한다.
- 거부: `computeDiffSha`가 실패하면 `G15`는 통과하지 않는다. 계산 불가를 통과로 바꾸는
  경로를 만들지 않는다.
- 거부: `bouncer scaffold distill`은 더 이상 받지 않는다. 하위 호환 별칭을 남기지
  않는다.
- 거부: 다른 블루프린트에 남아 있는 `distill.md`를 읽거나 옮기거나 지우지 않는다.

## Touch
- Modify `scripts/src/lib/schema.ts` — `bouncer.distill`을 `bouncer.explain`으로 교체하고
  접두·상태·`DOC_KIND` 항목을 함께 옮긴다.
- Modify `scripts/src/lib/paths.ts` — `FILE_KIND`의 `'distill.md': 'distill'`을
  `'explain.md': 'explain'`으로 바꾼다.
- Modify `scripts/src/lib/templates.ts` — BP `distill.md` 템플릿을 다섯 섹션짜리
  `explain.md` 템플릿으로 교체하고, blueprint index 템플릿 말미의 주석 문장을 새 파일명에
  맞춘다. `PROJECT_DISTILL_BODY`는 건드리지 않는다.
- Modify `scripts/src/lib/scaffold.ts` — `scaffoldDistill`을 `scaffoldExplain`으로
  바꾸고 `comprehension` 기본 블록을 프론트매터에 싣는다.
- Modify `scripts/src/lib/cli.ts` — `scaffold` 하위 명령의 `distill` 분기와 도움말
  문자열을 `explain`으로 바꾼다.
- Modify `scripts/src/lib/validate.ts` — 문서 맵·존재 검사 목록·leaf 목록의 `distill`을
  `explain`으로 바꾸고, `G9`를 지우고 `G15` 세 갈래를 넣는다.
- Create `scripts/src/lib/comprehension.ts` — `computeDiffSha`와 섹션 정의를 담는다.
  게이트 판정 자체는 `validate.ts`에 남긴다.
- Modify `scripts/src/lib/advisor.ts` — `statusOf(docs, 'distill')`을 `'explain'`으로
  바꾼다. 단계 판정 규칙은 그대로다.
- Modify `scripts/lib/schema.js` — 위 소스의 빌드 산출물. `npm run build`(`pretest`)로
  재생성해 커밋한다. 손으로 편집하지 않는다.
- Modify `scripts/lib/paths.js` — 빌드 산출물. 재생성해 커밋한다.
- Modify `scripts/lib/templates.js` — 빌드 산출물. 재생성해 커밋한다.
- Modify `scripts/lib/scaffold.js` — 빌드 산출물. 재생성해 커밋한다.
- Modify `scripts/lib/cli.js` — 빌드 산출물. 재생성해 커밋한다.
- Modify `scripts/lib/validate.js` — 빌드 산출물. 재생성해 커밋한다.
- Create `scripts/lib/comprehension.js` — 빌드 산출물. 재생성해 커밋한다.
- Modify `scripts/lib/advisor.js` — 빌드 산출물. 재생성해 커밋한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 명령 이름(`scaffold explain`), 파일명,
  게이트 코드(`G15`) 표기만 고친다. 퀴즈·채점 절차는 002가 넣는다.
- Modify `test/schema.test.js` — 등록된 종류·접두·상태 목록을 새 계약으로 덮는다.
- Modify `test/paths.test.js` — `explain.md` 파일명 대응을 덮는다.
- Modify `test/scaffold.test.js` — `scaffoldExplain`의 생성·멱등·기본 프론트매터를 덮는다.
- Modify `test/validate-gates.test.js` — `G9` 케이스를 `G15` 세 갈래로 교체한다.
- Modify `test/validate-structural.test.js` — 존재하지 않는 블루프린트가 `S11`로
  보고되고 `G15`로 새지 않는지 확인하는 기존 회귀를 새 코드에 맞춘다.
- Modify `test/advisor.test.js` — `distill: 'published'` 픽스처를 `explain`으로 바꾼다.
- Modify `test/cli-verify.test.js` — 픽스처가 쓰는 `distill.md` 문서를 `explain.md`로
  바꾼다.
- Modify `test/finalize.test.js` — `fullBlueprint` 픽스처와 `G9` 단언을 새 계약으로
  바꾼다.
- Modify `test/finalize-pure.test.js` — 문서 맵 픽스처의 `distill` 키를 바꾼다.
- Modify `test/skill-bouncer-finalize.test.js` — `scaffold distill` 단언을
  `scaffold explain`으로 바꾼다.
- Create `test/comprehension.test.js` — `computeDiffSha`의 성공·실패 이유·경로 제외를
  덮는다.
- Modify `docs/gates.md` — finalize 행의 `G9`를 `G15`로 바꾸고 세 갈래를 적는다.
- Modify `docs/troubleshooting.md` — `G9` 증상 행을 `G15` 세 갈래로 바꾼다.

## Do not touch
- `scripts/src/lib/layout.ts` — `PROJECT_DISTILL`은 프로젝트 Distill의 경로 상수이며 BP
  문서와 무관하다. 이름이 비슷하다는 이유로 함께 고치면 다른 문서를 깨뜨린다.
- `.bouncer/context/Distill.md` — 이 커밋은 프로젝트 Distill의 내용도 형식도 바꾸지
  않는다. 결정 문장 교체는 마감이 승격으로 처리한다.
- `scripts/src/lib/finalize.ts` — 승격과 커밋 절차는 003의 범위다. 이 커밋은 게이트
  판정만 바꾼다.
- `scripts/src/lib/verification.ts` — 검증 증적 기록 경로는 그대로다.
- `scripts/src/lib/init.ts` — 부트스트랩이 만드는 파일 집합은 바뀌지 않는다.
- `skills/spec-authoring/SKILL.md` — 본문 저술 지침은 002가 새 문서 구조와 함께
  고친다.
- `CLAUDE.md`, `AGENTS.md` — 마스터룰 갱신은 003이 맡는다.
- `docs/workflow.md`, `docs/okf.md`, `docs/governance.md` — 워크플로 서술 갱신은
  003이 맡는다.
- 다른 에픽 아래의 `distill.md` 파일 전부 — 소급 마이그레이션은 에픽 Out of scope다.

## Constraints
- `scripts/lib/*.js`는 `npm run build` 산출물이다. 소스는 항상 `scripts/src/**`이며
  산출물을 손으로 편집하지 않는다.
- 새 런타임 의존성을 추가하지 않는다. Node 표준 라이브러리와 벤더링된 `js-yaml`만
  쓴다.
- 하위 호환 별칭을 남기지 않는다. `bouncer.distill` 종류, `scaffold distill` 명령,
  `G9` 코드는 코드에서 완전히 사라진다.
- 게이트 실패 코드 번호는 재사용하지 않는다. `G15`는 새 번호이며 `G9`는 결번으로 둔다.
- 섹션 미작성 판정은 `G10`이 쓰는 방식을 재사용한다. 같은 규칙을 두 번 구현하지
  않는다.
- 공개 문자열(도움말, 게이트 메시지, 템플릿 본문)의 언어는 현재 파일의 관례를
  따른다 — 게이트 메시지는 영문, 문서 템플릿 본문은 한국어.
- `computeDiffSha`는 실행 함수를 주입받을 수 있어야 한다. 테스트가 실제 `git`
  프로세스에 의존하지 않는다.
- 해시 입력은 재현 가능해야 한다. 같은 두 커밋 사이에서 몇 번을 계산해도 같은 값이
  나와야 하며, 타임스탬프나 경로 순서에 흔들리지 않는다.

## Checklist
- [ ] `test/comprehension.test.js`를 먼저 쓰고 `npm test`로 **예상된 이유로** 실패하는지
      확인한다.
      ```js
      // .bouncer/context/ 아래 변경은 해시에 영향을 주지 않는다
      const a = computeDiffSha({ repoRoot, base, exec: fakeExec(['src/a.ts', '.bouncer/context/x.md']) });
      const b = computeDiffSha({ repoRoot, base, exec: fakeExec(['src/a.ts']) });
      assert.strictEqual(a.sha, b.sha);
      // 실패는 던지지 않고 값으로 온다
      assert.deepStrictEqual(computeDiffSha({ repoRoot, base: 'nope', exec: failing }),
        { ok: false, reason: 'no-base' });
      ```
- [ ] `scripts/src/lib/comprehension.ts`에 `computeDiffSha`와 섹션 정의를 구현한다.
      제외 규칙은 이름 있는 상수로 둔다.
      ```ts
      const DIFF_EXCLUDED_PREFIXES = ['.bouncer/context/'];
      const EXPLAIN_SECTION_DEFS = ['background', 'intuition', 'code', 'quiz', 'understanding'];
      ```
- [ ] `scripts/src/lib/schema.ts`에서 `bouncer.distill`을 `bouncer.explain`으로 교체하고
      `test/schema.test.js`를 함께 고친다. 접두는 `EXPLAIN-`, 상태는
      `['draft', 'published']`.
- [ ] `scripts/src/lib/paths.ts`의 `FILE_KIND`를 고치고 `test/paths.test.js`를 덮는다.
- [ ] `scripts/src/lib/templates.ts`의 BP 템플릿을 다섯 섹션 골격으로 교체한다. 각 섹션은
      헤딩과 주석만 두고 본문을 비워, 갓 스캐폴드한 문서가 `G15`에 걸리는 상태를
      만든다 — `G10`과 같은 의도적 동작이다.
- [ ] `scripts/src/lib/scaffold.ts`의 `scaffoldDistill`을 `scaffoldExplain`으로 바꾸고
      `comprehension` 기본 블록을 싣는다. `test/scaffold.test.js`에 멱등성(두 번 호출 시
      두 번째 `created`가 빈 배열)과 기본 프론트매터 단언을 넣는다.
- [ ] `scripts/src/lib/cli.ts`의 분기와 도움말을 `explain`으로 바꾼다.
- [ ] `test/validate-gates.test.js`에 `G15` 세 갈래 실패 테스트를 먼저 넣고 실패를
      확인한다.
      ```js
      // 섹션 미작성
      assert.deepStrictEqual(failures.map((f) => f.code), ['G15']);
      // 기록 누락: comprehension 자체가 없거나 disposition이 빈 문자열
      // 해시 불일치: diff_sha에 다른 값이 들어 있음
      // 통과: quiz_score가 '1/5'이어도 나머지가 갖춰지면 실패가 없다
      assert.deepStrictEqual(failures, []);
      ```
- [ ] `scripts/src/lib/validate.ts`에서 `G9`를 지우고 `G15`를 넣는다. `base`는 포인터가
      이 블루프린트를 가리키면 포인터의 `base`, 아니면 `config.base_branch`, 그것도
      없으면 `develop`이다. `computeDiffSha`가 `ok: false`면 그 `reason`을 메시지에 담아
      실패로 보고한다.
- [ ] `diff_sha`가 빈 문자열인 경우를 불일치가 아니라 기록 누락으로 보고하는지 테스트로
      고정한다. 스캐폴드 직후 상태와 잘못된 해시가 같은 메시지로 뭉개지면 안 된다.
- [ ] `scripts/src/lib/advisor.ts`의 `statusOf(docs, 'distill')`을 `'explain'`으로 바꾸고
      `test/advisor.test.js` 픽스처를 맞춘다. 단계 판정 규칙 자체는 바꾸지 않는다.
- [ ] 남은 픽스처를 옮긴다 — `test/cli-verify.test.js`, `test/finalize.test.js`,
      `test/finalize-pure.test.js`, `test/validate-structural.test.js`.
      `test/validate-structural.test.js`의 P2 회귀(존재하지 않는 블루프린트가 `S11`로
      보고되고 마감 코드로 새지 않음)가 `G15`에서도 성립하는지 확인한다.
- [ ] `skills/bouncer-finalize/SKILL.md`의 명령·파일명·게이트 코드 표기를 고치고
      `test/skill-bouncer-finalize.test.js`의 단언을 맞춘다. 절차 자체는 늘리지 않는다.
- [ ] `docs/gates.md` finalize 행과 `docs/troubleshooting.md`의 `G9` 행을 `G15` 세
      갈래로 고친다.
- [ ] 통합 확인 — 임시 저장소에서 `bouncer scaffold explain --blueprint <dir>`를 두 번
      실행해 두 번째가 아무것도 만들지 않는지, 그 상태에서
      `validate --gate finalize`가 `G15` 섹션 미작성으로 실패하는지 확인한다.
- [ ] `npm test`가 통과할 때까지 마무리한다. `pretest`가 `scripts/lib/*.js`를 재생성하므로
      산출물 diff가 함께 남는지 확인한다.
