---
type: bouncer.tasks
title: minimality 래더 정렬과 강도 매핑
description: Tasks for 004
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-13T09:30:48.388+09:00'
bouncer:
  id: TASKS-004
  epic_id: '004'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - 래더가 표준 라이브러리와 네이티브 플랫폼 기능을 한 단에 묶어 판단 순서가 흐릿했음
    - 두 단을 갈라 세우고 판단 강도를 기존 blueprint scale에 매핑함
  affected_paths:
    - skills/minimality/SKILL.md
    - test/skill-minimality.test.js
    - docs/ARCHITECTURE.md
  graph:
    generated_at: '2026-08-13T10:05:00+09:00'
    command: graphify query "context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - skills
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 44 nodes; test/helpers/read-skill.js와 스킬 본문 테스트가 상위 히트. skills/·docs/는 source_dirs 밖이라 손으로 더함
      - graph: context
        status: updated
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 8 nodes; 최소화 래더를 가리키는 컨텍스트 히트 없음(016 advisor-removal은 이 질의로 잡히지 않음)
---
# Tasks

Blueprint: [007](../../index.md)

## Goal & intent
`minimality` 래더가 "표준 라이브러리"와 "네이티브 플랫폼 기능"을 별도 단으로
가르고, 판단 강도를 blueprint frontmatter의 기존 `bouncer.scale`(`light` |
`full`)에 매핑한다. 새 설정 키나 새 모드 어휘를 만들지 않고, `ponytail-mcp`도
도입하지 않는다 — 흡수 대상은 래더 문구뿐이다.

## Interface
- 제공:
  - `skills/minimality/SKILL.md` 래더가 7단이 된다. 이 문서는 영어 본문이므로
    단 제목도 영어이며, 아래는 기존 문구를 그대로 이어받은 형태다.
    ```
    1 Does this need to exist in the plan? (YAGNI)
    2 Already in this codebase? (reuse)
    3 Prefer a native platform feature
    4 Prefer the standard library
    5 Prefer an already installed dependency
    6 Prefer the shortest working surface
    7 Only then propose minimal new code
    ```
    기존 3단 `Prefer the **standard library** or **native platform feature**`을
    가르는 것이므로 `standard library`와 `native platform` 두 표현이 본문에
    그대로 남아야 한다 — `test/skill-minimality.test.js`가 그 문자열을 단언한다.
  - 같은 문서에 강도 매핑 절. `bouncer.scale`이 `light`면 래더 1–4단까지만
    적용하고 근거 기록을 한 줄로 줄인다. 부재·`full`은 7단 전부다.
  - `docs/ARCHITECTURE.md` §E가 래더 단 수와 강도 매핑의 근거를 담는다.
- 거부:
  - 새 `config.json` 키나 새 enum. 강도는 기존 `SCALE_ENUM`만 읽는다.
  - `scripts/`가 이 매핑을 읽는 코드 경로. 강도는 스킬 문서의 판단 기준이며
    게이트도 CLI도 아니다.
  - `plugin_advisors` / `bouncer advise` 재도입.

## Touch
- Modify `skills/minimality/SKILL.md` — 래더 7단 분리와 강도 매핑 절
- Modify `test/skill-minimality.test.js` — 새 단 구성과 강도 매핑 단언
- Modify `docs/ARCHITECTURE.md` — §E에 래더 단 수·강도 매핑 항목

## Do not touch
- `scripts/` 전체 — 이 task는 문서·스킬 문구만 바꾼다. `SCALE_ENUM`은 이미
  있고 새로 읽는 코드도 만들지 않는다.
- `skills/implementation/SKILL.md` — 같은 래더를 구현 시점에 적용한다는 서술은
  그대로 두고 중복 서술하지 않는다.
- `test/public-name-regression.test.js` — §4 일반 스킬 표와 Ponytail 정책 단언은
  그대로 만족해야 한다.

## Constraints
- 「최소화하지 않을 것」 목록(승인된 요구사항, 테스트, 검증, 보안, 접근성,
  오류 처리, 설명 주석)은 강도와 무관하게 항상 적용된다. `light`가 이 목록을
  줄이지 않는다.
- `minimality`는 여전히 자문이며 게이트가 아니다. §E 1번 문장을 유지한다.
- ponytail에서 가져오는 것은 래더 문구뿐이다. MCP 서버·도구·프롬프트를 참조
  대상으로 문서에 넣지 않는다.
- `docs/ARCHITECTURE.md` §4 표는 건드리지 않는다.
- `skills/minimality/SKILL.md`는 한국어 0자인 영어 문서다. 래더·강도 매핑 절 모두
  영어로 쓴다. `docs/ARCHITECTURE.md` §E는 기존대로 한국어다.

## Checklist
- [ ] `test/skill-minimality.test.js`에 실패 테스트를 먼저 추가하고 실패를
      확인한다. 래더에 네이티브 플랫폼 단과 표준 라이브러리 단이 각각 별도
      번호로 있고, 본문이 `bouncer.scale`을 강도 기준으로 언급하며,
      「최소화하지 않을 것」 목록이 강도와 무관하다는 문장을 담는지 본다.
- [ ] `skills/minimality/SKILL.md` 래더를 7단으로 다시 쓴다. 기존 3단
      (`standard library` 또는 `native platform feature`)을 두 단으로 가르되,
      나머지 단의 의미와 순서는 그대로 둔다. 본문은 영어를 유지하고 두 표현을
      각 단에 그대로 남긴다.
- [ ] 같은 문서에 강도 매핑 절을 넣는다. `light`는 1–4단과 한 줄 근거,
      부재·`full`은 7단 전부다. 새 어휘(lite/ultra)를 도입하지 않는다.
- [ ] `docs/ARCHITECTURE.md` §E에 래더 단 수와 강도 매핑 항목을 더한다.
      1번(자문이며 게이트 아님)과 4번(충돌 시 plan 에스컬레이션)은 유지한다.
- [ ] `npm test`가 통과한다.
