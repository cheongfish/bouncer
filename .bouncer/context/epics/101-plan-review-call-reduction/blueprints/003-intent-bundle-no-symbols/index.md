---
type: bouncer.blueprint
title: 심볼 없는 intent bundle과 metrics 시점
description: Let intent bundle run with --no-symbols for doc/test-only tasks, tell controllers to pass only source functions as symbols, and state metrics end timing in the run skill.
resource: .bouncer/context/epics/101-plan-review-call-reduction/blueprints/003-intent-bundle-no-symbols/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-15T16:10:48.138+09:00'
bouncer:
  id: '003'
  epic_id: '101'
  blueprint_id: '003'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 003 심볼 없는 intent bundle과 metrics 시점

Epic: [101](../../index.md)

## Intent
문서·테스트만 바꾸는 task도 문서 제목이나 테스트 이름을 함수처럼 넣지 않고 intent bundle을 만들 수 있게 `--no-symbols`를 추가하고, `--symbol`에 넣을 값을 지침으로 정한다.
`/bouncer-run` 루트가 참조 문서를 열지 않아도 `metrics end`를 task-notification usage 도착 뒤에 부르게 SKILL.md 4단계에 직접 적는다.

## Contract
- 인터페이스:
  - `bouncer intent bundle --task <tasks.md> --no-symbols [--repo <dir>]`가 생긴다. 성공 JSON은 기존과 같은 형태(`status`·`bundle_id`·`revision`·`task`·`task_brief_hash`·`functions`)이고 `functions`는 `[]`다.
  - `resolveTaskIntentBundle` 입력에 선택 필드 `allowEmpty`가 생긴다. 값이 `true`일 때만 빈 `functions`를 받는다. 기본값은 지금처럼 빈 배열을 거절한다.
- 데이터·상태: 빈 bundle도 기존 intent cache 경로에 같은 record 형식으로 원자적으로 기록한다. `bundle_id`는 빈 함수 목록의 내용 해시라 task마다 같을 수 있고, task 구분은 record의 `task`가 맡는다.
- 수용 기준: epic 성공 기준 16~19.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - `--no-symbols`를 `--symbol`이나 `--candidate`와 같이 쓰거나 두 번 쓰면 exit 2, stdout은 비고 cache는 쓰지 않는다.
  - `--symbol`도 `--no-symbols`도 없으면 지금처럼 `--symbol <function-name> is required`(exit 2)다.
  - 같은 task에 `--no-symbols`를 다시 부르면 `reused`이고 revision이 같다. 함수가 있던 bundle 뒤에 부르면 새 revision으로 다시 쓴다.
  - 빈 bundle에는 함수 좌표가 없어 함수 변화로 stale이 되지 않는다. task brief가 바뀌면 `intent sections`는 기존처럼 `intent-bundle-stale`을 낸다.

## Out of scope
- `intent_bundle_id`·`intent_bundle_revision`·`intent_sections` payload 계약과 implement·review·final_review·verify 카드 변경.
- stale·missing 복구 `next` 힌트 문구 변경.
- `drive-metrics.md`·`rules/subagent-model.md` 재수정(BP 002에서 반영됨).
- cache hit 판정이 task brief hash를 비교하지 않는 기존 동작. brief만 바뀌고 함수가 같으면 `reused`가 옛 hash record를 남겨 `intent sections`가 stale을 내는 문제는 별도 후속으로 둔다.

## One-commit justification
- 세 변경 모두 같은 drive 회고 후속이고, 지침(002)이 새 CLI 플래그(001)를 가리키는 하나의 흐름이라 한 PR로 리뷰하는 편이 맞다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
