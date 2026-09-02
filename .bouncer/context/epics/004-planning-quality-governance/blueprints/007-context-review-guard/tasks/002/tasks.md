---
type: bouncer.tasks
title: context-review 스킬·에이전트와 plan 배선
description: Tasks for 002
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-13T09:30:48.388+09:00'
bouncer:
  id: TASKS-002
  epic_id: '004'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - 계획 문서의 정합성을 판정할 주체가 없어 어긋난 브리프가 그대로 execute로 넘어갔음
    - 승인 직전에 read-only 리뷰어를 불러 판정을 context-review.md에 남기게 함
  affected_paths:
    - skills/context-review/SKILL.md
    - agents/bouncer-context-reviewer.md
    - test/skill-context-review.test.js
    - skills/bouncer-plan/SKILL.md
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - config.example.json
    - test/agents.test.js
    - test/skill-bouncer-plan.test.js
    - test/skill-bouncer-surface.test.js
    - test/init.test.js
    - test/subagents.test.js
    - docs/workflow.md
    - docs/ARCHITECTURE.md
    - docs/configuration.md
  graph:
    generated_at: '2026-08-13T10:05:00+09:00'
    command: graphify query "context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - skills
      - agents
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
      - .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard
    basis:
      - graph: source
        status: reused
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 44 nodes; test/skill-bouncer-surface.test.js·test/skill-review.test.js·test/helpers/read-skill.js가 상위 히트. skills/·agents/·docs/는 source_dirs 밖이라 손으로 더함
      - graph: context
        status: updated
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 8 nodes; epic 009 subagent-model-config의 Success criteria가 named 에이전트 배선 선례로 잡힘. 신규 스킬을 가리키는 히트는 없음
---
# Tasks

Blueprint: [007](../../index.md)

## Goal & intent
`/bouncer-plan`이 승인 직전에 계획 문서를 판정하는 단계를 갖는다. 판정은
새 스킬 `context-review`가 정의하고, 실행은 read-only named agent
`bouncer-context-reviewer`가 맡으며, 결과는 TASKS-001이 만든
`context-review.md`에 남는다. 이 저장소의 blueprint `033/001`도 자기
`context-review.md`를 갖게 되어, TASKS-003이 G18을 켜는 순간 자기 게이트에
막히지 않는다. 게이트 코드는 이 task에서 추가하지 않는다.

## Interface
- 제공:
  - `skills/context-review/SKILL.md` — 판정 범위 네 가지(문서 간 모순, 범위
    검토, 한국어 품질, 성공 기준의 검증 가능성)와 findings 기록 형식.
  - `agents/bouncer-context-reviewer.md` — `name`이 basename과 같고
    `model: inherit`, `readonly: true`. 페르소나·하드 가드·출력 계약은
    `bouncer-reviewer.md`와 같은 자리 배분을 따른다. 판정 대상은 계획 문서
    (epic·blueprint·`tasks/<NNN>/tasks.md`)이고 산출 문서는 BP 루트
    `context-review.md`다 — task 디렉터리 `review.md`를 쓰지 않는다.
  - `/bouncer-plan` 신규 단계 — affected_paths 확정(6단계) 다음, 승인(7단계)
    직전. named 디스패치 네 단계(모델 해석 → named 호출 → slug 거절 시
    `inherit` 재시도 → named 미지원 시 인라인 폴백)를 그대로 쓴다.
  - `init.ts` 기본 `subagents` 블록 네 곳(claude / cursor / codex / antigravity)에
    `'bouncer-context-reviewer': 'inherit'`. `config.example.json`은 세 블록
    (claude / cursor / codex)뿐이므로 그 세 곳에만 넣는다 — antigravity 블록
    누락은 기존 드리프트이고 이 task가 고치지 않는다.
  - `docs/configuration.md`의 "네 프로바이더 × 세 에이전트" 문장과 에이전트
    이름 열거를 새 에이전트를 포함하도록 고친다.
  - 이 blueprint의 `context-review.md` 실물 — findings와 status가 채워진 상태.
    `scope.makeAllowed`가 blueprint 디렉터리 하위를 무조건 허용하므로
    `affected_paths`에 넣지 않는다.
- 거부:
  - 에이전트가 문서를 편집하거나 status를 뒤집는 것. 판정문만 돌려주고
    `context-review.md`에 기록하는 주체는 컨트롤러다.
  - `accepted` finding에 `note` 없이 승인하는 것.
  - Codex처럼 `agents/`를 배포할 수 없는 호스트에서 단계를 건너뛰는 것.
    인라인 폴백으로 같은 판정을 수행한다.

## Touch
- Create `skills/context-review/SKILL.md` — 판정 범위와 기록 형식
- Create `agents/bouncer-context-reviewer.md` — read-only 리뷰어 에이전트
- Create `test/skill-context-review.test.js` — 스킬 본문 계약
- Create `.bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/context-review.md` — 이 blueprint 자신의 판정 기록
- Modify `skills/bouncer-plan/SKILL.md` — 승인 직전 단계 추가
- Modify `scripts/src/lib/init.ts` — 기본 subagents 블록에 새 에이전트
- Modify `scripts/lib/init.js` — 위 emit
- Modify `config.example.json` — 예시 subagents 블록 세 곳에 새 키
- Modify `test/agents.test.js` — frontmatter·readonly 순회에만 새 에이전트 추가
- Modify `test/skill-bouncer-plan.test.js` — 새 단계와 폴백 문구
- Modify `test/skill-bouncer-surface.test.js` — plan이 새 스킬을 경로로 인용
- Modify `test/init.test.js` — 기본 config의 새 키
- Modify `test/subagents.test.js` — 모델 해석이 새 이름을 다룸
- Modify `docs/workflow.md` — plan 단계 서술
- Modify `docs/ARCHITECTURE.md` — 전문 스킬로서의 위치(§4 일반 스킬 표 아님)
- Modify `docs/configuration.md` — subagents 절의 에이전트 개수·이름 열거 갱신

## Do not touch
- `scripts/src/lib/validate.ts` — G18은 TASKS-003이다.
- `scripts/src/lib/scaffold.ts` — 문서 생성 경로는 TASKS-001이 끝냈다.
- `skills/review/SKILL.md` · `agents/bouncer-reviewer.md` — diff 리뷰 계약은
  그대로 둔다. 새 스킬은 그 어휘를 참조만 한다.
- `test/public-name-regression.test.js` — §4 일반 스킬 표는 바뀌지 않는다.

## Constraints
- `context-review`는 `graphify-runner`·`migrate-ids`와 같은 전문 스킬이다.
  `docs/ARCHITECTURE.md` §4 일반 워크플로 스킬 표와 `APPROVED_GENERIC_SKILLS`에
  넣지 않는다.
- named 디스패치 네 단계 문구는 `/bouncer-execute`의 것을 재서술하지 말고 같은
  형태를 유지한다. 인라인 폴백 문장이 빠지면 Codex에서 이 단계가 영구히 막힌다.
- 에이전트에는 하드룰 9(주석)를 재서술하지 않는다 — 포인터만.
- 스킬 `description`은 3인칭 트리거 문장(`This skill should be used …`)이며 YAML
  안에서 `##`를 그대로 쓰지 않는다.
- `skills/context-review/SKILL.md`와 `agents/bouncer-context-reviewer.md` 본문은
  **영어**다. 기존 `skills/review` · `skills/debugging` · `agents/*.md`가 모두
  영어 본문이고, 하드룰 8의 한국어 범위는 `.bouncer/context/epics/**`와 BP
  `explain.md`다. 아래 Checklist의 판정 범위 네 가지는 이 브리프에서 한국어로
  적었을 뿐이며 스킬 본문에는 영어로 옮긴다.
- `assets/` 디스패치 템플릿을 만들지 않는다. `review`만 템플릿을 갖는 이유는
  base/HEAD·제약을 채워 넘겨야 하기 때문이고, context 판정은 대상이 문서 경로로
  이미 정해져 채울 자리가 없다. `bouncer-implementer` · `bouncer-debugger`처럼
  plan 단계 본문에서 인라인으로 프롬프트를 구성한다.
- 이 blueprint의 `context-review.md`는 `bouncer scaffold context-review`로 만들고
  손으로 파일을 새로 쓰지 않는다.
- 판정을 근거로 기존 계획 문서를 고쳐야 한다면 이 task에서 고치지 말고 finding으로
  남긴다. 계획 수정은 `/bouncer-plan`의 일이다.

## Checklist
- [ ] `test/skill-context-review.test.js`를 먼저 쓰고 실패를 확인한다. 본문이
      판정 범위 네 가지를 모두 담고, 문서 편집·status 변경 금지 문장을 담고,
      findings 형식(`id` / `severity` / `status` / `accepted`엔 `note`)을 담는지
      본다.
- [ ] `skills/context-review/SKILL.md`를 쓴다. 판정 범위는 다음 네 가지다.
      ```
      문서 간 모순 — epic → blueprint → tasks의 목표·범위 불일치
      범위 검토 — affected_paths 실재 여부, Checklist가 빠뜨린 파일,
                 graph.suggested_paths와의 대조
      한국어 품질 — stop-slop 기준
      성공 기준의 검증 가능성 — 참·거짓을 가릴 수 없는 문장 적발
      ```
      게이트가 이미 보는 OKF 필드·status는 판정 범위에서 제외한다.
- [ ] `agents/bouncer-context-reviewer.md`를 쓴다. `test/agents.test.js`에는
      순회가 셋이므로 넣을 곳을 가린다 — `name`·`model: inherit` 순회와
      `readonly: true` 대상에는 **넣고**, `tasks/<NNN>/tasks.md` 언급을 강제하는
      순회와 "task directory … `review.md`" 언급을 강제하는 순회에는 **넣지
      않는다**. 이 에이전트의 산출 문서는 BP 루트 `context-review.md`이고 판정
      대상은 계획 문서 전체이므로, 그 두 단언은 틀린 계약을 강제한다. 대신 새
      단언 하나로 이 에이전트가 `context-review.md`를 가리키는지 본다.
- [ ] `init.ts` 기본 블록 네 곳에 `'bouncer-context-reviewer': 'inherit'`을 넣고,
      `config.example.json`의 세 블록에도 같은 키를 넣는다(antigravity 블록은
      원래 없으므로 만들지 않는다). `test/init.test.js`와
      `test/subagents.test.js`를 갱신한다. 이미 있는 소비자 `config.json`은
      바꾸지 않는다.
- [ ] `docs/configuration.md`의 "네 프로바이더 × 세 에이전트(…)" 문장을 새
      에이전트를 포함한 개수·이름으로 고친다.
- [ ] `skills/bouncer-plan/SKILL.md`에 승인 직전 단계를 넣고, 뒤 단계 번호를
      맞춘다. 본문은 `skills/context-review/SKILL.md`를 경로로 인용한다.
- [ ] `test/skill-bouncer-plan.test.js`·`test/skill-bouncer-surface.test.js`가
      새 단계와 경로 인용, 인라인 폴백 문구를 보게 한다.
- [ ] `docs/workflow.md`·`docs/ARCHITECTURE.md`를 갱신한다.
- [ ] `bouncer scaffold context-review --blueprint
      .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard`
      를 실행한 뒤, 새 스킬대로 이 blueprint 문서를 판정해 findings와 status를
      채운다. 미해결 finding이 없으면 `status: accepted`다.
- [ ] `npm test`가 통과한다.
