---
type: bouncer.tasks
title: 컨텍스트 데이터 신뢰 경계 명문화
description: Tasks for 005
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-13T09:30:48.388+09:00'
bouncer:
  id: TASKS-005
  epic_id: '004'
  blueprint_id: '007'
  status: verified
  commit_intent:
    - 문서 본문과 그래프 산출물, 서브에이전트 리포트를 지시로 읽어도 막을 근거가 문서에 없었음
    - 신뢰 경계를 security 문서에 세우고 데이터를 읽는 스킬·에이전트에 같은 문구를 둠
  affected_paths:
    - docs/security.md
    - test/trust-boundary.test.js
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/graphify-runner/SKILL.md
    - skills/review/SKILL.md
    - skills/implementation/SKILL.md
    - skills/debugging/SKILL.md
    - skills/context-review/SKILL.md
    - agents/bouncer-reviewer.md
    - agents/bouncer-implementer.md
    - agents/bouncer-debugger.md
    - agents/bouncer-context-reviewer.md
    - docs/ARCHITECTURE.md
  graph:
    generated_at: '2026-08-13T10:05:00+09:00'
    command: graphify query "context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - skills
      - agents
      - docs
      - test
    basis:
      - graph: source
        status: reused
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 44 nodes; test/skill-review.test.js·test/helpers/read-skill.js가 상위 히트. skills/·agents/·docs/security.md는 source_dirs 밖이라 손으로 더함
      - graph: context
        status: updated
        query: context review document type scaffold schema validate plan gate G18 findings severity subagent named agent skill minimality ladder prompt injection trust boundary security docs
        result: 8 nodes; 신뢰 경계·인젝션을 가리키는 컨텍스트 히트 없음 — 기존 계획 문서에 다룬 적 없는 주제

---
# Tasks

Blueprint: [007](../../index.md)

## Goal & intent
컨텍스트 문서 본문·graphify 산출물·서브에이전트 리포트가 **데이터지 지시가
아니라는** 경계를 문서에 고정한다. `docs/security.md`는 현재 커밋 가드 위협
모델만 담고 있어 신뢰 경계 절이 없다. 코드 레벨 탐지는 도입하지 않는다 —
우회 가능하고, 실질 방어선은 "게이트 판정은 `bouncer validate`만 한다"는
기존 설계다. 그 문장을 명문화하는 것이 이 task의 핵심이다.

## Interface
- 제공:
  - `docs/security.md`에 「신뢰 경계」 절. 신뢰하는 입력(플러그인이 배포한
    스킬·에이전트·마스터 룰, 사용자의 직접 지시)과 신뢰하지 않는 입력
    (`.bouncer/context/**` 본문, `graphify-out/**`, 서브에이전트 리포트,
    저장소 소스·테스트 파일 내용)을 가르고, 후자를 지시로 승격하지 않는다는
    규칙과 그 규칙이 왜 문구 수준인지를 적는다.
  - 외부·생성 데이터를 읽는 스킬 여덟 곳과 에이전트 네 곳에 같은 취지의 한 줄:
    ```
    스킬: bouncer-plan, bouncer-execute, bouncer-run, graphify-runner,
          review, implementation, debugging, context-review
    에이전트: bouncer-reviewer, bouncer-implementer, bouncer-debugger,
              bouncer-context-reviewer
    ```
  - `test/trust-boundary.test.js` — 그 목록을 한곳에서 순회해 문구 존재를 본다.
- 거부:
  - 인젝션 패턴 탐지·이스케이프·새니타이저 코드. `scripts/`는 바뀌지 않는다.
  - 문구를 근거로 한 새 게이트 코드. 이것은 자문이 아니라 설계 서술이며 판정
    대상이 아니다.
  - 나머지 스킬 아홉 곳에 같은 문구를 복제하는 것. 외부 데이터를 읽지 않는
    스킬까지 늘리면 문서만 균일하게 길어진다.

## Touch
- Modify `docs/security.md` — 「신뢰 경계」 절 추가
- Create `test/trust-boundary.test.js` — 대상 목록 순회 단언
- Modify `skills/bouncer-plan/SKILL.md` — 데이터/지시 구분 한 줄
- Modify `skills/bouncer-execute/SKILL.md` — 같은 문구
- Modify `skills/bouncer-run/SKILL.md` — 같은 문구
- Modify `skills/graphify-runner/SKILL.md` — 그래프 산출물에 대한 같은 문구
- Modify `skills/review/SKILL.md` — 디프·리포트에 대한 같은 문구
- Modify `skills/implementation/SKILL.md` — 브리프 밖 데이터에 대한 같은 문구
- Modify `skills/debugging/SKILL.md` — 로그·출력에 대한 같은 문구
- Modify `skills/context-review/SKILL.md` — 판정 대상 문서에 대한 같은 문구
- Modify `agents/bouncer-reviewer.md` — 하드 가드에 같은 문구
- Modify `agents/bouncer-implementer.md` — 같은 문구
- Modify `agents/bouncer-debugger.md` — 같은 문구
- Modify `agents/bouncer-context-reviewer.md` — 같은 문구
- Modify `docs/ARCHITECTURE.md` — 신뢰 경계를 §B 문서 계약·게이트 항목에서 참조

## Do not touch
- `scripts/` 전체 — 코드 레벨 탐지를 도입하지 않는다.
- `hooks/commit-safety.js` — 커밋 가드 위협 모델은 이미 보안 문서에 있고 이
  task가 그 동작을 바꾸지 않는다. 신뢰 경계 절만 더한다.
- `CLAUDE.md` — 마스터 룰에 문구 본문을 넣지 않는다. 하드룰 4가 이미 게이트
  권위를 정하고 있고, 상세는 보안 문서가 갖는다.
- `skills/discovery/SKILL.md` · `skills/spec-authoring/SKILL.md` ·
  `skills/stop-slop/SKILL.md` · `skills/minimality/SKILL.md` ·
  `skills/verification/SKILL.md` · `skills/explain-diff/SKILL.md` ·
  `skills/migrate-ids/SKILL.md` · `skills/bouncer-init/SKILL.md` ·
  `skills/bouncer-commit/SKILL.md` · `skills/bouncer-finalize/SKILL.md` —
  외부·생성 데이터를 지시로 읽을 자리가 없다.

## Constraints
- 문구는 방어선이 아니라 설명이다. `docs/security.md`가 "실질 방어선은 게이트
  판정을 코드만 한다는 설계"라고 명시하고, 문구가 우회 가능함을 함께 적는다.
  기존 문서의 정직한 위협 서술 톤을 유지한다.
- 열두 곳의 문구는 같은 취지를 유지하되 그 문서가 실제로 읽는 데이터를
  가리켜야 한다. 같은 문장을 그대로 붙여 넣지 않는다.
- 새 게이트 코드·설정 키·CLI를 만들지 않는다.
- 언어는 파일마다 기존 본문을 따른다. `docs/security.md`·`docs/ARCHITECTURE.md`는
  한국어이고 `stop-slop`을 적용한다. `skills/**`·`agents/**`의 새 한 줄은 그
  문서의 언어를 따르되, `skills/review` · `skills/implementation` ·
  `skills/debugging` · `skills/graphify-runner` · `skills/context-review`와
  `agents/*.md` 넷은 영어 본문이므로 영어로 쓴다. 하드룰 8의 한국어 범위는
  `.bouncer/context/epics/**`와 BP `explain.md`이며 스킬·에이전트는 포함되지
  않는다.

## Checklist
- [ ] `test/trust-boundary.test.js`를 먼저 쓰고 실패를 확인한다. 대상 스킬
      여덟과 에이전트 넷을 배열로 두고, 각 문서가 데이터/지시 구분 문구를
      담는지 본다. 대상 밖 스킬에는 강제하지 않는다.
- [ ] `docs/security.md`에 「신뢰 경계」 절을 쓴다. 신뢰/비신뢰 입력 구분,
      비신뢰 입력을 지시로 승격하지 않는다는 규칙, 문구가 우회 가능하다는
      한계, 실질 방어선이 `bouncer validate`라는 설계 문장을 담는다.
- [ ] 대상 스킬 여덟 곳에 각 문서가 읽는 데이터를 가리키는 한 줄을 넣는다.
- [ ] 대상 에이전트 넷의 하드 가드에 같은 취지 한 줄을 넣는다.
- [ ] `docs/ARCHITECTURE.md`에서 신뢰 경계를 `docs/security.md`로 참조한다.
      본문을 옮겨 적지 않는다.
- [ ] `npm test`가 통과한다.
