---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/006-platform-architecture/blueprints/006-catalog-hide/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T12:49:44.606+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '006'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2ef2ce1da61e1800b608317e2c0cf8bf16da542d
      diff_sha: c82ea02306b62a75371bb9c949ad518c86a27c1a2da8c646d6c4f36c317dc54b
      quiz_score: 3/3
      disposition: 카탈로그 스캔 범위·정본 개수 8·migrate-ids 공개 유지를 모두 맞춤.
      recorded_at: '2026-08-28T12:50:45+09:00'
---
# Explain

## Background
보조 스킬 11개가 `skills/*/SKILL.md`에 있어 호스가 세션 목록에 넣고 암묵 매칭했다.
진입 스킬(`/bouncer-*`)만 카탈로그에 남기고, 보조 본문은 호스가 스캔하지 않는
`references/<name>/index.md`로 옮겨 경로로만 읽게 했다. 절차 문장은 그대로 두고
경로·계약 테스트·문서만 맞췄다.

## Intuition
호스 목록은 매장 진열, `references/`는 창고. 손님이 집는 건 진열 여덟 개뿐이고,
점원(`/bouncer-*`)만 창고 열쇠로 보조 본문을 연다.

## Code
- 이동: `skills/<helper>/SKILL.md` → `references/<helper>/index.md` (하위
  `epic.md`·`phrases.md`·`assets/reviewer-prompt.md`·`LICENSE` 동반, `git mv`)
- 읽기: `test/helpers/read-skill.js`의 `UNPUBLISHED_HELPERS` →
  `references/<name>/index.md`; 카탈로그 정본 개수 8
  (`test/skill-bouncer-surface.test.js`)
- 호출: `skills/bouncer-{plan,execute,finalize}/SKILL.md`와 agents·`CLAUDE.md`
  When to invoke에서 보조 행 제거
- 문서: `docs/ARCHITECTURE.md` §4는 이름 여덟 개 유지, 위치만 `references/`로
  명시; Distill `plugin-skills` 샤드 `paths`에 `references/**`

## Quiz
1. 호스가 관례로 스캔하는 스킬 파일 집합은?
   - A) `skills/*/SKILL.md`와 `references/*/index.md` 둘 다
   - B) `skills/*/SKILL.md`만
   - C) `references/*/SKILL.md`만

2. 카탈로그 정본 개수(`EXPECTED_SKILL_COUNT`)는?
   - A) 11
   - B) 19
   - C) 8

3. `migrate-ids`는 이 BP에서 어떻게 되나?
   - A) `references/migrate-ids/index.md`로 이동
   - B) `skills/migrate-ids/SKILL.md`에 공개로 남음
   - C) 플러그인에서 삭제

## 이해 상태
- 응답: 1-B, 2-C, 3-B
- 정답: 1-B, 2-C, 3-B — 전부 맞음 (`3/3`)
- disposition: 카탈로그 스캔 범위·정본 개수 8·migrate-ids 공개 유지를 모두 맞춤.

## Tasks

### Task 001

#### Goal & intent

11개 보조 스킬 트리를 `skills/<name>/`에서 플러그인 루트 `references/<name>/`로 옮기고, 호스가 스캔하는 `skills/*/SKILL.md`에는 공개 8개만 남긴다. 진입 스킬과 `CLAUDE.md`는 `references/<name>/index.md`를 읽는다. 검증은 `npm run ci`.

#### Interface

- 제공: `references/<name>/index.md`가 옛 `SKILL.md` 본문이다. 하위 자료는 같은 디렉터리에 파일명을 유지한다 (`epic.md`, `phrases.md`, `assets/reviewer-prompt.md`, `LICENSE`). `test/helpers/read-skill.js`의 `readSkill`은 보조 이름을 이 경로에서 읽는다. `listCanonicalSkillNames`는 `skills/`의 `SKILL.md`만 세고 `EXPECTED_SKILL_COUNT`는 8이다. description 예산은 그 8개에만 적용한다. 역할 rubric 금지어 검사는 `references/{implementation,review,debugging,context-review}/index.md`를 읽는다.
- 거부: `references/` 아래 `SKILL.md` 파일명. 보조 본문을 `skills/bouncer-*/references/`에 복제. `migrate-ids`와 `agentic-code-benchmark` 이동. 비공개 11개 `index.md`에 `when the user asks for this skill by name`을 남기기. `migrate-ids`를 `UNPUBLISHED`나 references 이동 목록에 넣기. 절차 문장 재작성.

#### Touch

- Rename `skills/discovery/SKILL.md` → `references/discovery/index.md` — 카탈로그에서 제거
- Rename `skills/spec-authoring/SKILL.md` → `references/spec-authoring/index.md` — 카탈로그에서 제거
- Rename `skills/spec-authoring/references/epic.md` → `references/spec-authoring/epic.md` — 하위 자료 동반
- Rename `skills/spec-authoring/references/blueprint.md` → `references/spec-authoring/blueprint.md` — 하위 자료 동반
- Rename `skills/spec-authoring/references/tasks.md` → `references/spec-authoring/tasks.md` — 하위 자료 동반
- Rename `skills/spec-authoring/references/review.md` → `references/spec-authoring/review.md` — 하위 자료 동반
- Rename `skills/stop-slop/SKILL.md` → `references/stop-slop/index.md` — 카탈로그에서 제거
- Rename `skills/stop-slop/references/phrases.md` → `references/stop-slop/phrases.md` — 하위 자료 동반
- Rename `skills/stop-slop/references/structures.md` → `references/stop-slop/structures.md` — 하위 자료 동반
- Rename `skills/stop-slop/references/examples.md` → `references/stop-slop/examples.md` — 하위 자료 동반
- Rename `skills/stop-slop/LICENSE` → `references/stop-slop/LICENSE` — 제3자 고지 동반
- Rename `skills/graphify-runner/SKILL.md` → `references/graphify-runner/index.md` — 카탈로그에서 제거
- Rename `skills/minimality/SKILL.md` → `references/minimality/index.md` — 카탈로그에서 제거
- Rename `skills/context-review/SKILL.md` → `references/context-review/index.md` — 카탈로그에서 제거
- Rename `skills/implementation/SKILL.md` → `references/implementation/index.md` — 카탈로그에서 제거
- Rename `skills/verification/SKILL.md` → `references/verification/index.md` — 카탈로그에서 제거
- Rename `skills/debugging/SKILL.md` → `references/debugging/index.md` — 카탈로그에서 제거
- Rename `skills/review/SKILL.md` → `references/review/index.md` — 카탈로그에서 제거
- Rename `skills/review/assets/reviewer-prompt.md` → `references/review/assets/reviewer-prompt.md` — 콜 브리프 동반
- Rename `skills/explain-diff/SKILL.md` → `references/explain-diff/index.md` — 카탈로그에서 제거
- Modify `references/spec-authoring/index.md` — `references/epic.md` 등 상대 링크를 같은 디렉터리 파일명으로 고친다
- Modify `references/stop-slop/index.md` — `references/phrases.md` 링크를 같은 디렉터리 파일명으로 고친다
- Modify `skills/bouncer-plan/SKILL.md` — 보조 호출 경로를 `references/<name>/index.md`로 바꾼다
- Modify `skills/bouncer-plan/references/context-review.md` — context-review 경로
- Modify `skills/bouncer-plan/references/graphify-suggestions.md` — graphify-runner 경로
- Modify `skills/bouncer-execute/SKILL.md` — implementation·verification·review·debugging·minimality 경로
- Modify `skills/bouncer-finalize/SKILL.md` — spec-authoring·explain-diff 경로
- Modify `skills/bouncer-finalize/references/explain-quiz.md` — explain-diff 경로
- Modify `skills/bouncer-finalize/references/distill-promotion.md` — spec-authoring 경로
- Modify `CLAUDE.md` — When to invoke에서 보조 이름 행을 빼고 주석 정본 링크를 `references/implementation/index.md`로 바꾼다
- Modify `rules/skill-shape.md` — 서브스킬 정본 경로를 `references/<name>/index.md`로 적고 카탈로그와 구분한다
- Modify `rules/governance.md` — `skills/explain-diff/SKILL.md` 인용을 `references/explain-diff/index.md`로 바꾼다
- Modify `agents/bouncer-implementer.md` — 주석 정본 경로
- Modify `agents/bouncer-reviewer.md` — reviewer-prompt 경로
- Modify `agents/bouncer-context-reviewer.md` — 호출 계약 경로
- Modify `test/helpers/read-skill.js` — 보조는 `references/<name>/index.md`, 공개는 기존 `skills/`
- Modify `test/skill-bouncer-surface.test.js` — 정본 8개. 비공개 11개는 `references/<name>/index.md`로 읽고, `migrate-ids`만 `skills/migrate-ids/SKILL.md`에 남긴다. `SUB_PATHS`를 통째로 references로 옮기지 않는다.
- Modify `test/skill-discovery.test.js` — readSkill 경로 계약
- Modify `test/skill-spec-authoring.test.js` — 하위 파일 위치 단언
- Modify `test/skill-implementation.test.js` — readSkill 경로 계약
- Modify `test/skill-verification.test.js` — readSkill 경로 계약
- Modify `test/skill-review.test.js` — 스킬·assets 경로
- Modify `test/skill-minimality.test.js` — readSkill 경로 계약
- Modify `test/skill-debugging.test.js` — readSkill 경로 계약
- Modify `test/skill-graphify-runner.test.js` — readSkill 경로 계약
- Modify `test/skill-explain-diff.test.js` — 경로 계약
- Modify `test/skill-stop-slop.test.js` — 경로 계약
- Modify `test/skill-context-review.test.js` — 경로 계약
- Modify `test/master-rules.test.js` — discovery·spec-authoring·CLAUDE When to invoke
- Modify `test/lightweight-cycle.test.js` — spec-authoring 경로
- Modify `test/trust-boundary.test.js` — implementation 경로
- Modify `test/agents.test.js` — 스킬 경로
- Modify `test/open-source-readiness.test.js` — stop-slop LICENSE 경로 (해시 값은 바이트 그대로)
- Modify `test/skill-bouncer-plan.test.js` — 보조 경로 문자열이 있으면 갱신
- Modify `test/skill-bouncer-execute.test.js` — 보조 경로 문자열이 있으면 갱신
- Modify `test/skill-bouncer-finalize.test.js` — spec-authoring·explain-diff 경로
- Modify `test/cursor-plugin.test.js` — `LAUNCHER_SKILLS` 중 이동한 `explain-diff`·`graphify-runner`·`review`는 `references/<name>/index.md`를 읽고, `migrate-ids`와 워크플로 스킬은 `skills/<name>/SKILL.md`를 유지한다

#### Constraints

- 본문 절차·게이트 문장은 옮기기만 한다. 상대 링크와 경로 문자열만 새 트리에 맞춘다.
- `git mv`로 이력을 유지한다.
- 빈 `skills/<name>/` 디렉터리를 남기지 않는다.
- `references/` 아래 `SKILL.md`를 만들지 않는다.
- description 예산 상한 3,000·개별 100–180은 카탈로그 8개에만 적용한다. 보조 `index.md` description을 이 예산에 넣지 않는다.
- `docs/ARCHITECTURE.md` §4 표 이름 집합은 task 002가 위치를 설명한다. 이 task에서 표를 지우지 않는다.

### Task 002

#### Goal & intent

공개 문서와 Distill `plugin-skills` 샤드가 보조 11개를 호스 카탈로그가 아니라 `references/<name>/index.md`로 적는다. §4 일반 스킬 표의 이름 여덟 개는 유지한다. 검증은 `npm run ci`.

#### Interface

- 제공: `docs/ARCHITECTURE.md`가 표의 스킬이 `references/<name>/index.md`에 있고 `skills/*/SKILL.md` 목록이 아님을 한 절로 적는다. `docs/install.md`는 관례 스캔을 `skills/*/SKILL.md` 공개 집합으로 한정하고 보조는 `references/`라고 적는다. `docs/benchmark/context-cost.md`의 `wc`/`awk`/`ls`는 카탈로그 8개와 보조 `references/*/index.md`를 분리한다. `docs/contributing.md`의 stop-slop LICENSE 경로를 `references/stop-slop/LICENSE`로 바꾼다. `.bouncer/distill/plugin-skills.md` frontmatter `paths`에 `references/**`를 더하고 Gotcha의 `skills/review/assets/`·서브스킬 `SKILL.md` 경로를 새 위치로 고친다.
- 거부: §4 `APPROVED_GENERIC_SKILLS` 이름 집합 변경. 과거 epic 본문 소급. 보조를 다시 `skills/` 카탈로그 안내로 적기.

#### Touch

- Modify `docs/ARCHITECTURE.md` — §4 위치 설명, `explain-diff`·`graphify-runner`·`context-review` 경로
- Modify `docs/install.md` — 호스 스캔 범위와 보조 `references/`
- Modify `docs/contributing.md` — stop-slop LICENSE 경로
- Modify `docs/benchmark/context-cost.md` — 측정 명령을 카탈로그와 보조로 분리
- Modify `.bouncer/distill/plugin-skills.md` — reviewer-prompt·서브스킬 경로 Gotcha

#### Constraints

- Distill 본문은 영어를 유지한다.
- 측정 문서에 배수나 새 회차 숫자를 넣지 않는다. 명령만 고친다.
- `test/public-name-regression.test.js`가 기대하는 §4 백틱 이름 순서를 깨지 않는다.
