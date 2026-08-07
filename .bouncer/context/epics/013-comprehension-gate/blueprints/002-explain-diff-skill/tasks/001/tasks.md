---
type: bouncer.tasks
title: explain-diff 스킬과 마감 배선을 추가하고 계약 테스트를 맞춤
description: skills/explain-diff 신설, finalize·spec-authoring·surface/finalize 테스트 갱신
resource: .bouncer/context/epics/013-comprehension-gate/blueprints/002-explain-diff-skill/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-05T09:50:11.577+09:00'
bouncer:
  id: TASKS-001
  epic_id: '013'
  blueprint_id: '002'
  status: verified
  affected_paths:
    - skills/explain-diff/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/spec-authoring/SKILL.md
    - test/skill-explain-diff.test.js
    - test/skill-bouncer-finalize.test.js
    - test/skill-bouncer-surface.test.js
    - test/skill-spec-authoring.test.js
    - scripts/src/lib/templates.ts
    - scripts/lib/templates.js
    - docs/workflow.md
    - docs/ARCHITECTURE.md
    - README.md
  graph:
    generated_at: '2026-08-05T09:51:10+09:00'
    command: graphify query (source)
    suggested_paths:
      - scripts/lib
      - scripts/src/lib
      - test
      - skills
      - docs
    basis: source 질의 "explain-diff skill finalize scaffold explain comprehension quiz spec-authoring Distill promotion"이 finalize()/validate/scaffold/cli 이웃(scripts/lib, test)을 넓게 집었고, "bouncer-finalize SKILL.md … templates explain"은 finalize()·TEMPLATES만 좁게 돌려줬다. 이 BP는 게이트·finalize.ts를 건드리지 않으므로 이웃 모듈은 근거로만 쓰고 경로로는 scripts/src/lib(templates 주석)·scripts/lib(빌드 산출)·test(스킬 계약)만 올렸다. config.source_dirs가 skills/docs를 포함하지 않아 질의가 skills·docs·README를 못 주므로 Distill gotcha대로 skills·docs를 수동 시드했다. README.md는 파일 단위라 suggested_paths 디렉터리 목록 밖이며 affected_paths에서 확인한다.
---
# Tasks

Blueprint: [002](index.md)

## Goal & intent
마감 때 사람이 diff를 이해했는지 남기려면, 설명·퀴즈·`comprehension` 기록을 전담하는
스킬이 필요하다. `skills/explain-diff/`를 신설하고 `/bouncer-finalize` 1단계가
`scaffold explain` 다음 그 스킬을 호출하게 한다. Distill 승격은 003 전까지
`spec-authoring`에 남겨 둔다. `spec-authoring`에서 explain 본문·퀴즈 지시를 제거하고,
템플릿 Quiz 주석·워크플로/아키텍처 표기를 새 배선에 맞춘다. 검증은 `npm test`.

## Interface
- 제공: `skills/explain-diff/SKILL.md` — YAML `name: explain-diff`, description은
  finalize 맥락에서 쓰는 하위 스킬임을 밝힌다.
- 제공 (스킬 절차): (1) 다섯 섹션 본문 저술 (2) Quiz를 사용자에게 제시·채점해
  `quiz_score`를 `N/M` 형으로 산출 (3) `computeDiffSha`로 `diff_sha` 기록
  (4) `disposition`·`recorded_at`·`## 이해 상태` 본문 기록 (5) `status → published`.
- 제공: finalize 1단계가 `skills/explain-diff/SKILL.md`를 경로와 함께 인용한다.
- 거부: 점수 임계로 마감을 막거나 재시험을 강제하는 절차. 낮은 점수도 기록만
  있으면 진행한다.
- 거부: 새 CLI 하위 명령, HTML 퀴즈, execute 단계 배치.
- 거부: `spec-authoring`이 BP `explain.md` 본문이나 퀴즈를 쓰라는 지시.
- 거부: Distill 승격 규칙을 이 커밋에서 바꾸거나 `## 이해 상태`를 전역 Distill로
  옮기라는 새 규칙(003).

## Touch
- Create `skills/explain-diff/SKILL.md` — 저술·퀴즈·comprehension 기록·published
  전환 절차. base 해석(`bouncer current` → `config.base_branch`)과 아래
  `computeDiffSha` 호출을 **그대로 실행 가능한 코드블록**으로 적는다:
  ```bash
  BOUNCER_ROOT="${BOUNCER_HOME:-${CLAUDE_PLUGIN_ROOT:-${PLUGIN_ROOT:-}}}"
  node -e 'const { computeDiffSha } = require(process.argv[1] + "/scripts/lib/comprehension");
  console.log(JSON.stringify(computeDiffSha({ repoRoot: process.cwd(), base: process.argv[2] })));' \
    "${BOUNCER_ROOT}" <base>
  ```
  `cwd`는 실행 중인 워크트리 루트여야 한다. 출력이 `ok: false`면 중단한다.
- Create `test/skill-explain-diff.test.js` — 신원, 다섯 섹션(개별), comprehension
  네 필드(개별), `scripts/lib/comprehension` 호출, 점수 비차단, scaffold를
  대체하지 않음을 단언한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 1단계를 `scaffold explain` →
  `explain-diff` → Distill 승격(`spec-authoring`) 순으로 고친다.
- Modify `skills/spec-authoring/SKILL.md` — BP `distill.md`/`explain.md` 저술
  안내를 제거하고 Distill 승격·plan 문서만 남긴다. explain은 `explain-diff`로
  넘긴다고 한 줄로 명시한다. 001에서 사라진 `bouncer scaffold distill` 참조
  (도입부·문서별 안내)도 같이 걷어낸다.
- Modify `test/skill-bouncer-finalize.test.js` — explain 배선이 `explain-diff`를
  가리키는지 단언한다. Distill 승격의 `spec-authoring` 인용은 유지한다.
- Modify `test/skill-bouncer-surface.test.js` — `SUB_PATHS`와 finalize 인용에
  `explain-diff`를 넣는다.
- Modify `test/skill-spec-authoring.test.js` — distill/explain 본문 저술 단언이
  남아 있으면 Distill 승격·plan 전용으로 맞춘다.
- Modify `scripts/src/lib/templates.ts` — `explain.md` Quiz 주석의 안내 주체를
  finalize가 아니라 `explain-diff`로 바꾼다.
- Modify `scripts/lib/templates.js` — 위 소스의 빌드 산출물. `npm run build`로
  재생성해 커밋한다.
- Modify `docs/workflow.md` — `/bouncer-finalize` 행을 `explain-diff` + Distill
  승격으로 고친다.
- Modify `docs/ARCHITECTURE.md` — 스킬 표에 `explain-diff`를 넣고
  `spec-authoring` 설명을 plan/Distill로 좁힌다.
- Modify `README.md` — finalize 다이어그램·한 줄 설명을 distill 대신 explain-diff
  배선으로 고친다.

## Do not touch
- `scripts/src/lib/validate.ts` / `scripts/lib/validate.js` — G15 판정은 001
  계약이다.
- `scripts/src/lib/comprehension.ts` / `scripts/lib/comprehension.js` — 해시 API는
  호출만 하고 시그니처를 바꾸지 않는다.
- `scripts/src/lib/scaffold.ts` / `scripts/lib/scaffold.js` — scaffold 계약 유지.
- `scripts/src/lib/finalize.ts` / `scripts/lib/finalize.js` — 승격·PR·커밋 절차는
  003.
- `scripts/src/lib/layout.ts` — `PROJECT_DISTILL` 경로 상수.
- `.bouncer/context/Distill.md` — 승격 내용·형식은 마감 런타임이 다룬다.
- `CLAUDE.md` / `AGENTS.md` — 마스터룰 표 갱신은 003에 맡긴다.
- `docs/gates.md` / `docs/troubleshooting.md` / `docs/okf.md` / `docs/governance.md`
  — 게이트·OKF 서술은 001 완료분 또는 003.
- `test/comprehension.test.js` / `test/validate-gates.test.js` — 게이트 단위
  테스트는 재설계하지 않는다.

## Constraints
- 새 런타임 의존성·퀴즈 CLI를 추가하지 않는다. Node stdlib + 기존
  `computeDiffSha`만 쓴다. 해시용 하위 명령도 만들지 않는다 — 스킬이
  `scripts/lib/comprehension`을 `node -e`로 부르고, 그 호출 형태를 계약
  테스트가 붙든다.
- `scripts/lib/*.js`는 빌드 산출물이다. 소스는 `scripts/src/**`만 편집한다.
- 스킬 YAML `description`에 이스케이프되지 않은 `##`를 넣지 않는다 (Distill
  gotcha).
- `config.source_dirs`가 `skills/`를 포함하지 않으므로 graph `suggested_paths`에
  스킬 경로를 수동으로 넣는다.
- 공개 스킬 본문·문서 표기는 기존 파일 언어 관례를 따른다.
- Distill 승격 단계에서 `## 이해 상태`를 전역으로 옮기지 말라는 문장을 finalize에
  이미 있다면 유지하고, 없으면 003에서 다룬다 — 이 커밋은 승격 규칙을
  새로 쓰지 않는다.

## Checklist
- [ ] 실패 테스트 추가: `test/skill-explain-diff.test.js`가 스킬 파일 부재로
  실패하는지 확인한 뒤 스킬을 작성한다.
  ```js
  const md = fs.readFileSync(path.join(root, 'skills/explain-diff/SKILL.md'), 'utf8');
  assert.match(md, /name:\s*explain-diff/);
  // 다섯 섹션 — 교대(|)가 아니라 개별 단언. EXPLAIN_SECTION_DEFS와 1:1.
  for (const h of ['Background', 'Intuition', 'Code', 'Quiz', '이해 상태']) {
    assert.ok(md.includes(h), `missing section: ${h}`);
  }
  // comprehension 네 필드 — 개별 단언.
  for (const f of ['diff_sha', 'quiz_score', 'disposition', 'recorded_at']) {
    assert.ok(md.includes(f), `missing field: ${f}`);
  }
  // 해시는 스킬이 직접 부른다 — 모듈 경로와 함수명을 함께 고정.
  assert.match(md, /scripts\/lib\/comprehension/);
  assert.match(md, /computeDiffSha/);
  // 점수 비차단은 긍정 문구로 단언한다. 낱말 부재(doesNotMatch)로 단언하면
  // 스킬이 "임계값을 두지 않는다"를 설명하는 순간 자기모순으로 깨진다.
  assert.match(md, /기록만 하고 (마감을 )?막지 않는다/);
  assert.match(md, /scaffold explain|대체하지/);
  ```
- [ ] `skills/explain-diff/SKILL.md` 작성: 절차 순서, base 해석, Touch에 적은
  `node -e` 호출 코드블록 그대로, `quiz_score`는 기록만·차단 없음,
  `ok: false` 시 중단.
- [ ] `skills/bouncer-finalize/SKILL.md` 1단계 교체 후 테스트가
  `skills/explain-diff/SKILL.md`를 요구하게 갱신:
  ```js
  assert.match(body, /skills\/explain-diff\/SKILL\.md/);
  assert.match(body, /spec-authoring/); // Distill 승격 유지
  ```
- [ ] `test/skill-bouncer-surface.test.js`의 `SUB_PATHS`와 finalize 인용에
  `explain-diff` 추가.
- [ ] `skills/spec-authoring/SKILL.md`에서 BP distill/explain 본문 저술 제거,
  Distill 승격·plan만 유지. `test/skill-spec-authoring.test.js` 맞춤.
- [ ] `templates.ts` Quiz 주석 → explain-diff; `npm run build`로
  `scripts/lib/templates.js` 재생성.
- [ ] `docs/workflow.md`, `docs/ARCHITECTURE.md`, `README.md` finalize/스킬 표기
  갱신.
- [ ] `npm test` 통과.
