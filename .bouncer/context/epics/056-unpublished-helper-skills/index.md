---
type: bouncer.epic
title: 보조 스킬 카탈로그 비공개
description: 워크플로가 경로로 읽는 보조 스킬을 호스 스킬 목록에서 빼 암묵 매칭을 끊는다
resource: .bouncer/context/epics/056-unpublished-helper-skills/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-28T11:43:50.420+09:00'
bouncer:
  id: '056'
  epic_id: '056'
  status: approved
  supersedes: []
---
# 056 unpublished-helper-skills

## Intent
- 문제: 워크플로가 단계에 도달했을 때만 읽을 보조 스킬이 `skills/*/SKILL.md`로 남아, 호스가 세션 시작 목록에 이름과 description을 넣고 암묵 매칭한다. epic 054는 이를 제품 인터페이스 변경이라 보류했다.
- 목표: 진입 스킬만 카탈로그에 두고, 보조 본문은 호스가 스캔하지 않는 `references/<name>/`에서 워크플로가 경로로 읽는다. 스킬이 지시하는 절차 내용은 바꾸지 않는다.

```mermaid
flowchart LR
  H[호스 스킬 목록] --> P[skills/*/SKILL.md]
  P --> W["/bouncer-* 진입"]
  W --> R["Read references/name/index.md"]
```

## Success criteria
1. `skills/` 아래 `SKILL.md`를 가진 디렉터리 이름 집합에 다음 11개가 0건이다: `discovery`, `spec-authoring`, `stop-slop`, `graphify-runner`, `minimality`, `context-review`, `implementation`, `verification`, `debugging`, `review`, `explain-diff`.
2. 그 11개의 본문은 `references/<name>/index.md`에 있고, 그 트리 안에 `SKILL.md` 파일명이 0건이다.
3. `/bouncer-plan`, `/bouncer-execute`, `/bouncer-finalize`의 호출 문구가 옛 `skills/<name>/SKILL.md` 경로를 0건 가리키고, 각각 `references/<name>/index.md`를 가리킨다.
4. `CLAUDE.md`의 「When to invoke」 표에 그 11개 이름이 행으로 없다. 비공개 11개 `references/<name>/index.md` 본문에 `when the user asks for this skill by name`이 0건이다. 공개로 남는 `skills/migrate-ids/SKILL.md`와 `/bouncer-*` description의 `explicitly asks`는 이 조건의 대상이 아니다.
5. `test/skill-bouncer-surface.test.js`의 카탈로그 정본 개수가 공개 스킬만 세며 `npm run ci`가 통과한다.

## Out of scope
- 보조 스킬이 하는 절차·게이트 판정 문구의 변경
- named agent rubric 정본화와 진입 스킬 조건부 `references/` 분리 (epic 054)
- `allow_implicit_invocation` 같은 호스 전용 설정
- `agentic-code-benchmark`, `migrate-ids`의 카탈로그 제외
- 과거 `.bouncer/context/epics/**` 본문의 경로 소급 수정
- Distill 샤드 승격 절차 자체 (본문 경로만 이 epic이 고친다)

## Blueprints
* [001 카탈로그에서 보조 스킬 숨김](blueprints/001-catalog-hide/index.md) - 11개 보조 트리를 `references/`로 옮기고 진입 스킬·테스트·문서 경로를 맞춘다
