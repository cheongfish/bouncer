---
type: bouncer.epic
title: Distill 재접지 주입 중복 제거
description: 재접지 지시를 경로별 반복 호출에서 다중 --for 단일 호출로 바꿔 샤드 본문 중복 주입을 없앤다
resource: .bouncer/context/epics/055-distill-injection/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-27T10:49:42.213+09:00'
bouncer:
  id: '055'
  epic_id: '055'
  status: approved
  supersedes: []
---
# 055 distill-injection

## Intent
- 문제: 재접지 지시가 「경로마다 한 번」 부르라고 쓰여 있어, 확정 경로가 여러 개면 같은 샤드 본문이 경로 수만큼 반복 주입된다. epic 054 blueprint 001의 확정 경로 세 개로 재면 104,737바이트 중 59,131바이트(56%)가 중복이었다.
- 목표: 확정 경로 전부를 한 번의 호출로 넘겨 선택 결과의 합집합만 주입한다. CLI는 이미 그렇게 동작한다. 바꿀 것은 지시문 문구와, 그 동작을 고정할 테스트다.

## Success criteria
1. 재접지를 지시하는 네 문서(`CLAUDE.md`, `skills/bouncer-plan/SKILL.md`, `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md`)에 「once per path」·「once for each … path」·「경로마다 한 번」 형태의 문구가 0건이다. `.bouncer/distill/core.md`는 애초에 그 문구를 담고 있지 않아 이 기준의 대상이 아니고, 기준 2만 적용된다.
2. 그 네 문서와 `.bouncer/distill/core.md`가 모두 `--for`를 반복 지정한 단일 호출 형태를 지시한다.
3. `test/cli-project-commands.test.js`가 다중 `--for` 호출의 선택 결과를 합집합으로, 겹치는 샤드 본문을 한 번만 낸다고 단정하고 통과한다.
4. `test/cli-project-commands.test.js`가 `--for` 뒤 플래그 없는 경로 나열을 종료 코드 2로 거부한다고 단정하고 통과한다.
5. `npm run ci`가 통과한다.

## Out of scope
- `scripts/src/lib/cli-project-commands.ts`의 인자 파서와 라우팅 구현. 합집합·중복 제거는 이미 계약대로 동작하며, 이 에픽은 그 동작을 바꾸지 않는다.
- `--route`로 선택 ids를 먼저 확인해 라우팅이 무엇을 걸러냈는지 보고하는 절차. 관찰 항목이지 이번 호출 횟수 문제와 별개다.
- `--all` baseline 파일 계약. 라우팅 결과가 baseline을 대체하지 않는다는 규칙은 그대로 둔다.
- `skills/spec-authoring/SKILL.md`의 `--for` 언급. 결과를 소비하는 쪽이라 호출 횟수 계약이 아니다.
- 네 곳에 복제된 재접지 블록을 `rules/` 정본으로 합치는 일. epic 054가 가진다.

## Blueprints
* [001 for-union-single-call](blueprints/001-for-union-single-call/index.md) - 재접지 지시를 다중 `--for` 단일 호출로 바꾸고 그 계약을 테스트로 고정 — 지시문 4곳과 `.bouncer/distill/core.md`, 테스트 2곳
