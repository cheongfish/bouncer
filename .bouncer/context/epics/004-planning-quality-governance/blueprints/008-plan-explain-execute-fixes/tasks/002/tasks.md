---
type: bouncer.tasks
title: graphify 활성화 안내를 CLI 경로로 통일
description: plan이 안내하는 graphify 활성화 방법을 bouncer init --promote-graphify 하나로 모은다
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-26T13:09:35.756+09:00'
bouncer:
  id: TASKS-002
  epic_id: '004'
  blueprint_id: '008'
  status: verified
  commit_intent:
    - 'plan이 `graphify.enabled: true` 손편집을 안내해 init·graphify-runner가 못박은 config CLI 전용 원칙과 어긋남'
    - '활성화 경로를 `bouncer init --promote-graphify` 하나로 모아 사용자가 config를 직접 열지 않게 함'
  affected_paths:
    - skills/bouncer-plan/SKILL.md
    - test/skill-bouncer-plan.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-26T13:16:00+09:00'
    suggested_paths:
      - test
    basis:
      - graph: source
        status: updated
        query: 'plan skill task bundle authoring graphify enable explain scaffold light review dispatch'
        result: '83 nodes; hits only under test/ (scaffold.test.js, skill-bouncer-surface.test.js, lightweight-cycle.test.js, helpers/read-skill.js). config.source_dirs is scripts/hooks/test, so skills/, rules/ and docs/ are not indexed and cannot appear.'
      - graph: context
        status: updated
        query: 'plan skill task bundle authoring graphify enable explain scaffold light review dispatch'
        result: '9 nodes; hits are the newly authored task docs under tasks/003-005. No prior context doc matched, so no reuse candidate surfaced.'
---

# Tasks

Blueprint: [008](../../index.md)

## Goal & intent
`skills/bouncer-plan/SKILL.md:165`가 graphify 미가용 시 「`pip install graphifyy && graphify install`, then `graphify.enabled: true`」를 안내한다. 같은 저장소의 다른 두 문서는 정반대를 말한다 — `skills/bouncer-init/SKILL.md:36` "Do **not** edit `.bouncer/config.json` yourself — promotion is CLI-only", `skills/graphify-runner/SKILL.md:97` "(do not edit `config.json` by hand)". 사용자가 셋 중 아무 문서나 먼저 읽는지에 따라 상반된 행동을 한다.

plan의 안내를 CLI 경로로 바꿔 셋이 한 가지를 말하게 한다.

## Interface
- 제공: `/bouncer-plan` step 5의 graphify 미가용 안내가 `bouncer init --promote-graphify`(기존 프로젝트) / `bouncer init`(신규 부트스트랩)만 가리킨다. `graphify-runner`가 이미 사용자에게 출력하는 문구와 같은 경로다.
- 거부: `.bouncer/config.json` 손편집 안내와 `pip install` 직접 안내를 받지 않는다. `graphify.enabled` 키 이름 자체를 설명에서 없애지는 않되, 사용자가 쓸 행동으로 제시하지 않는다.

## Touch
- Modify `skills/bouncer-plan/SKILL.md` — step 5의 설치·활성화 안내를 CLI 경로로 교체한다
- Modify `test/skill-bouncer-plan.test.js` — 손편집 안내가 없음을 고정하는 회귀 테스트를 추가한다

## Do not touch
- `.bouncer/config.json` — 이 작업은 문서 수정이다. 설정값을 바꾸지 않는다
- `skills/graphify-runner/SKILL.md` — 이미 올바른 문구를 갖고 있다. 여기가 기준이다
- `skills/bouncer-init/SKILL.md` — `--promote-graphify` 계약의 소유 문서다
- `scripts/lib/graphify.js` — CLI 동작은 바뀌지 않는다
- `docs/install.md` — 184줄은 CLI가 무엇을 기록하는지 **서술**하고 206줄은 사용자가 직접 graphify를 설치하는 정당한 수동 경로다. 둘 다 config 손편집 지시가 아니므로 남긴다

## Constraints
- `graphify-runner`가 출력하는 사용자 안내 문구와 어긋나지 않게 맞춘다. 두 문서가 다른 명령을 제시하면 이 task는 실패다.
- graphify를 선택적 의존으로 두는 기존 graceful skip 계약(`suggested_paths` 빈 채로 두고 `basis` 엔트리는 남김)을 건드리지 않는다.
- `test/session-graph.test.js:304`가 `/graphifyy/`를 assert한다. 그 테스트가 보는 대상은 CLI 출력이지 plan 문서가 아니므로 함께 고치지 않는다 — 만약 그 assert가 plan 문서를 읽고 있다면 손대지 말고 계획으로 에스컬레이션한다.
- task 001이 같은 파일 step 4–6을 함께 고친다. 그쪽 금지 리터럴 `tasks/001/tasks.md`를 이 task의 새 산문에 들이지 않는다.
- `doesNotMatch`로 막는 리터럴(`graphify.enabled: true`, `pip install graphifyy`)을 새 산문이 설명용으로라도 다시 적으면 자기 테스트가 깨진다. 대체 문장에 그 두 리터럴을 넣지 않는다.
- 새 assert는 `skills/bouncer-plan/SKILL.md` 본문만 대상으로 한다. `docs/install.md`까지 훑는 전역 검사를 만들지 않는다 — 정당한 설치 안내를 깨뜨린다.

## Checklist
- [ ] `test/skill-bouncer-plan.test.js`에 실패 테스트를 먼저 추가한다:
  이 파일은 `read()` 헬퍼가 없다. 모듈 수준 `md` 상수와 `parseFrontmatter(md).body`를 쓰는 기존 관용구를 따른다:
  ```js
  test('bouncer-plan points graphify enablement at the CLI only', () => {
    const { body } = parseFrontmatter(md);
    assert.doesNotMatch(body, /graphify\.enabled:\s*true/);
    assert.doesNotMatch(body, /pip install graphifyy/);
    assert.match(body, /init --promote-graphify/);
  });
  ```
- [ ] `node --test test/skill-bouncer-plan.test.js`로 실패와 그 사유를 확인한다
- [ ] step 5의 해당 문장을 `bouncer init --promote-graphify` 안내로 교체한다
- [ ] `skills/graphify-runner/SKILL.md`의 안내 문구와 명령이 일치하는지 대조한다(읽기만 한다)
- [ ] `node --test test/skill-bouncer-plan.test.js` 통과 확인
- [ ] `npm test` 통과 확인
