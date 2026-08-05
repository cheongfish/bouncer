---
type: bouncer.distill
title: 002 distill
description: Distill for 002
resource: .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-07-28T01:53:11.404Z'
bouncer:
  id: DISTILL-BP-002
  epic_id: '003'
  blueprint_id: '002'
  status: published
---
# Distill

002에서 배운 것. 워크플로 진입점을 `commands/`에서 `skills/`로 옮겨 Codex도
같은 표면을 읽게 한 커밋이다.

## 구현에서

- 이관과 삭제는 같은 커밋이어야 한다. `commands/`와 `skills/bouncer-*`가 공존하는
  중간 상태는 정본이 둘로 갈라진다.
- 스킬 `description`은 모델 자동 선택의 입구다. 명시 호출 조건(`Use only when the
  user explicitly asks…`)이 없으면 plan 없이 execute로 들어가는 순서 위반이
  가능하다. 최종 강제력은 그래도 `.bouncer/current` 상태 확인에 둔다.
- 하위 스킬 참조는 이름과 `skills/<name>/SKILL.md` 경로를 병기한다. Skill 호출
  도구가 없는 에이전트는 경로로 폴백한다.
- 하위 스킬 description에 Bouncer 컨텍스트 조건을 넣을 때 YAML 평문 `##`는
  주석으로 잘린다. `JSON.stringify`로 인용하거나 평문에 `##`를 두지 않는다.
- `minimality` 등 일부 스킬 테스트는 `/bouncer-plan` 문자열을 금지한다. 컨텍스트
  문구는 슬래시 커맨드 이름 없이 "active Bouncer blueprint"로 적는다.

## 사이클에서 관찰한 것

- `git ls-files`는 디스크에서 지운 `commands/*.md`를 인덱스에 남겨 두면 계속
  나열한다. `public-name-regression`이 그 경로를 읽어 ENOENT가 났다. `git rm`으로
  인덱스에서도 빼야 활성 표면 스캔이 맞는다.
- `cursor-plugin` 테스트가 `commands/`를 scandir하던 계약은 워크플로 스킬 경로로
  같이 옮겨야 한다. 표면 이동은 제품 문서뿐 아니라 그 표면을 고정하던 테스트도
  대상이다.

## 다음

- 하위 스킬 `bouncer-` 접두어 리네임은 Out of scope로 남겼다. 거버넌스 §4와
  `public-name-regression`의 승인 목록까지 연쇄하므로 별도 blueprint다.
- 004 002/003(init 규칙 스캐폴드, per-task verify)은 이 표면 위에서
  이어가면 된다.
