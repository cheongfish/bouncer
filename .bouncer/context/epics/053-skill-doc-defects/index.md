---
type: bouncer.epic
title: 053 스킬 문서 결함 정비
description: 스킬 문서가 게이트 동작·CLI 계약과 어긋난 지점을 찾아 문서 쪽을 맞춘다
resource: .bouncer/context/epics/053-skill-doc-defects/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-26T13:09:29.858+09:00'
bouncer:
  id: '053'
  epic_id: '053'
  status: approved
  supersedes: []
---

# 053 스킬 문서 결함 정비

## Intent
- 문제: 스킬 문서가 지시하는 절차와 게이트·CLI가 실제로 하는 일이 몇 군데서 갈린다. `/bouncer-plan`은 `tasks/001` 하나만 저작하라고 시키는데 plan 게이트는 task 묶음을 순회하고, graphify 활성화는 CLI 전용이라고 두 스킬이 못박아 둔 것을 plan이 손편집으로 안내한다.
- 목표: 절차 문서를 실제 동작에 맞추고, 자기 모순 문장과 판정 공백을 없앤다.

## Success criteria
1. `npm test`가 통과한다.
2. `skills/bouncer-plan/SKILL.md`의 저작·그래프·범위 단계에 `tasks/001/tasks.md` 리터럴이 남지 않고, 테스트가 `tasks/<NNN>` 순회 지시를 assert한다.
3. `skills/bouncer-plan/SKILL.md`에 `graphifyy` 설치나 `graphify.enabled: true` 손편집 안내가 없고, 활성화 경로는 `bouncer init --promote-graphify` 하나다.
4. `skills/explain-diff/SKILL.md`에서 `explain.md` 부재 시 행동이 한 가지다 — 만들라는 문장과 멈추라는 문장이 함께 있지 않다.
5. `skills/bouncer-execute/SKILL.md` step 5에 `scale: light` 인라인 리뷰 분기가 없고, `rules/governance.md` 규칙 4와 `test/lightweight-cycle.test.js`가 같은 리뷰 정책을 말한다.
6. 들여쓴 펜스 안에서 어긋난 런처 줄이 0이다. 판정 명령:
   ```bash
   awk 'prev ~ /^BOUNCER_ROOT=/ && /^[[:space:]]/ {c++} {prev=$0} END{print c+0}' skills/*/SKILL.md
   ```
   착수 시점 값은 32다. 펜스 자체가 들여쓰이지 않은 블록 5곳은 컬럼 0이 옳으므로 이 명령이 세지 않는다.

## Out of scope
- 스킬 절차문의 영어 재작성. BP-002로 분리한다 — BP-001이 `bouncer-execute` step 5 문장을 바꾸므로 순서 의존이 있고, 한국어를 리터럴로 고정한 assert 161개 검토는 별도 리뷰 단위다.
- `scripts/lib/**` 게이트·CLI 구현. 이번 epic은 문서와 그 문서를 고정하는 테스트만 만진다.
- `.bouncer/context/epics/`에 같은 id `024`를 쓰는 디렉터리 둘(`024-light-path`, `024-lightweight-cycle`)의 정리.
- 한국어 산문 품질(stop-slop) 개선.

## Blueprints
* [001 plan·explain·execute 문서 결함 수정](blueprints/001-plan-explain-execute-fixes/index.md) - plan의 다중 task 절차와 graphify 안내, explain-diff 모순, 경량 리뷰 정책, 코드펜스 정렬을 `skills/**`·`rules/governance.md`·`docs/**`·`test/**`에서 고침
