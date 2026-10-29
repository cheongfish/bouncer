---
type: bouncer.blueprint
title: 디스패치 모델 전달과 delta 이연 기록, 체크리스트 도달 판정, 작업자 토큰 기록 강제
description: Pass the resolved worker model, allow deferring a minor finding in the brief delta round, judge Checklist test reachability, and require worker token records.
resource: .bouncer/context/epics/drive-execution/blueprints/retro-dispatch-model-tokens-deferred/index.md
tags:
  - bouncer
  - blueprint
  - dispatch
  - final-review
  - worker-tokens
  - context-review
timestamp: '2026-10-29T21:02:06.988+09:00'
bouncer:
  id: retro-dispatch-model-tokens-deferred
  epic_id: drive-execution
  blueprint_id: retro-dispatch-model-tokens-deferred
  status: closed
  order: 75
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 'retro 후보 1~4 (measure-scope-env-surface): dispatch 모델 해석값 전달, delta 라운드 deferred 기록, 체크리스트 도달 가능성, worker-tokens 가드'
  supersedes: []
---
# 디스패치 모델 전달과 delta 이연 기록, 체크리스트 도달 판정, 작업자 토큰 기록 강제

Epic: [drive-execution](../../index.md)

## Intent
직전 drive retro에서 나온 구현자 모델 상속, delta 라운드 이연 경로 부재, 도달 불가 체크리스트, 작업자 토큰 누락 네 가지 마찰을 문서와 CLI 거절로 막음.
구현자 모델은 해석값 그대로 전달하고, delta 라운드의 남은 경미 지적은 이연 기록하며, 계획 리뷰가 테스트 단계의 도달 가능성을 보고, 토큰 기록이 빠지면 다음 기록과 진행을 거절함.

## Contract
- 인터페이스:
  - 작업 001: run SKILL step 4는 `bouncer subagent-model --agent bouncer-coordinator` 출력이 coordinator 자신의 모델일 뿐이고, 구현자 모델은 `bouncer subagent-model --agent bouncer-implementer` 출력 한 줄이라고 적는다. agent-dispatch `## Worker model and token records`의 Implementer 항목과 dispatch 카드는 `coordinate dispatch --model` 값이 그 dispatch 직전에 `bouncer subagent-model --agent bouncer-implementer`가 출력한 한 줄이라고 적는다. 그 줄이 `inherit`일 때만 `inherit`를 넘긴다.
  - 작업 002: `review_contract: brief` blueprint 최종 리뷰의 delta 라운드 기록은 `severity`가 `minor`·`nit`이고 `status: deferred`·비어 있지 않은 `note`이며 `first_seen_round`와 `last_seen_round`가 모두 그 delta 라운드 번호인 `must_fix`(delta에서 처음 나온 finding)를 `--status accepted`와 함께 받는다. G21도 같은 판정을 쓴다. id가 그 delta 라운드 `previous_finding_ids`에 있는 deferred는 이연으로 보지 않는다. brief blueprint 최종 리뷰에서 저장된 finding의 `first_seen_round`를 다른 값으로 다시 기록하는 입력은 `review-input-invalid`로 거절한다(병합 불변, legacy·task scope는 지금과 같음). 이연은 delta 라운드를 처음 기록할 때만 가능하고, delta가 저장된 뒤 남은 finding은 `review accept-risk` 또는 `final-review-blocked`로 닫는다. `major`·`blocker` deferred, discovery에서 처음 나와 delta까지 이어진 finding의 deferred(심각도를 낮춰도 마찬가지), discovery 라운드만 있는 문서의 deferred `must_fix`는 지금처럼 `accepted with open must_fix`로 거절한다. `final-review-single-round`의 `next`는 brief blueprint에서 이 기록 시점과 저장 뒤 경로를 함께 적는다.
  - 작업 003: context reviewer `### verifiability`와 `### Verifiability of success criteria` 절은 Checklist 테스트 단계마다 입력이 같은 명령의 앞선 guard를 통과해 목표 분기에 닿는지 판정하라고 적는다. 앞선 guard가 막는 단계는 그 guard의 `file:line`과 함께 finding으로 낸다.
  - 작업 004: `coordinate worker-tokens --tokens unreported`는 `{kind: worker-tokens, role, unreported: true, task?, perspective?}`를 원장에 덧붙인다. `metrics summary`는 이 기록을 계속 `missing`으로 센다. `worker-model --tokens unreported`는 `tokens-invalid`다.
  - 작업 005: `coordinate record --task <T>`는 task `T`의 미충족 worker 키가 있으면, `coordinate advance --task <T>`는 task `T` 키와 task 없는 키, `coordinate advance`(`--task` 없음)는 task 없는 키만 보아 미충족이 있으면 `worker-tokens-missing`(exit 1)으로 거절하고 원장을 바꾸지 않는다.
  - 작업 006: agent-dispatch 토큰 문단, `rules/cli.md`(worker-tokens 문단·advance 실패 목록)가 `--tokens unreported`와 `worker-tokens-missing` 거절을 같은 계약으로 적는다.
- 데이터·상태:
  - 미충족 worker 키: 원장 decisions에서 `(task, role, perspective)` 키별 `worker-model` 수가, 숫자 `tokens`를 단 `worker-model` 수와 `worker-tokens`(숫자 또는 `unreported: true`) 수의 합보다 큰 키. 예: `worker-model {role: reviewer, perspective: combined}` 하나에 `worker-tokens`가 없으면 키 `{task: null, role: reviewer, perspective: combined}`가 미충족이다. 대응하는 `worker-model`이 없는 `worker-tokens`(고아·초과 기록)는 미충족을 만들지 않고 summary 합산도 지금과 같다.
  - 끝난 worker와 검사 시점: reviewer·debugger의 `worker-model`은 dispatch 직전에, implementer의 기록은 완료 뒤에 남는다. coordinator는 한 범위에서 dispatch한 worker를 모두 기다린 뒤에야 그 범위의 `record`·`advance`를 부른다(`agents/bouncer-coordinator.md` `## Worker dispatch`). 그래서 검사 범위 안의 키는 끝난 worker의 것이며, 실행 중인 worker 때문에 거절되면 coordinator가 기다리지 않고 진행했다는 뜻이다. 이는 의도한 동작이다.
  - `unreported: true` 기록은 미충족을 메우지만 토큰 합계에는 더하지 않고 `missing`에 남는다. 값을 추정하지 않는다.
  - delta 이연 판정은 `review.md` frontmatter `bouncer.review.findings[]`·`rounds[]`만 읽는다. 새 필드는 없다.
  - 역할 문서 변경은 `.codex/agents/bouncer-context-reviewer.toml` 생성본과 바이트 일치해야 한다.
- 수용 기준:
  1. Epic 성공 기준 20의 모델 전달 문장이 run SKILL·agent-dispatch·dispatch 카드에 있고 `test/skill-bouncer-run.test.js`가 고정한다.
  2. Epic 성공 기준 20의 delta 이연 기록이 `review record`와 G21에서 같은 판정을 내고 `test/review-record.test.js`·`test/validate-gates.test.js`가 성공·거절을 단언한다.
  3. Epic 성공 기준 20의 도달 가능성 판정 문장이 context reviewer 두 절에 있고 TOML이 동기화되며 `test/skill-context-review.test.js`가 고정한다.
  4. Epic 성공 기준 20의 `unreported` 기록과 `worker-tokens-missing` 거절이 `test/coordinator.test.js`·`test/cli-coordinate.test.js`·`test/cli-metrics.test.js`에서 단언된다.
  5. Epic 성공 기준 8·20: 각 commit task는 전용 검증을, TASKS-007은 `npm run ci`를 실행한다.
  6. Epic 성공 기준 20의 작업 006 문서 문장(agent-dispatch 토큰 문단, `rules/cli.md` worker-tokens 문단·명령 목록·advance 실패 문장)을 `test/coordinate-next.test.js`가 고정한다.
- 검증 명령: 각 commit task frontmatter `verify`의 `node --test` 명령. 종단은 TASKS-007의 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 원장이 없거나 읽을 수 없으면 advance guard는 판정하지 않고 기존 advance 실패 경로를 따른다.
  - 이 변경 전에 시작된 drive의 토큰 없는 기록도 다음 `record`·`advance`에서 거절된다. 의도한 동작이며 `--tokens unreported`(또는 알면 숫자)로 기록해 복구한다.
  - 병렬 wave에서 다른 task의 reviewer가 아직 실행 중이면 그 task 키는 `record --task <T>`·`advance --task <T>` 판정 대상이 아니다. `advance`(`--task` 없음)는 task 범위 키를 보지 않는다.
  - 이미 delta 라운드에 남은 finding을 `open`으로 저장한 문서는 다시 기록할 수 없다(`final-review-single-round` 유지). 그 경우는 기존 `review accept-risk`와 사용자 승인으로 닫는다.
  - legacy(표식 없는) blueprint의 discovery deferred 예외와 `blocked` 처리는 바꾸지 않는다.

## Out of scope
- 복잡도 판정, light 통합, retro 이관 등 다른 retro 후보 BP.
- 과거 `.bouncer/context` 문서와 이미 끝난 drive 원장의 수정·backfill.
- `CHANGELOG.md`와 버전 파일(`package.json` version, plugin manifest, `scripts/sync-versions.js` 대상) 변경.
- `coordinate next`의 action 판정 변경, 새 review 라운드 종류, `REPAIR_WAVE_LIMIT` 변경.
- `agents/bouncer-coordinator.md`와 그 Codex TOML 변경.

## One-commit justification
네 마찰은 모두 같은 drive retro에서 나왔고 coordinator 실행 기록의 정확성이라는 한 검토 단위로 묶인다. 후보별 문서·CLI 변경은 각각 독립 task 커밋이며 TASKS-007은 source를 바꾸지 않는 종단 검증이다.

## Task DAG
TASKS-001, TASKS-002, TASKS-003은 의존이 없고 경로가 겹치지 않아 한 wave다(`parallel_safe: true`).
TASKS-004는 `packages/cli/src/coordinator-commands.ts`·`test/cli-coordinate.test.js`를 공유해 TASKS-002 뒤, TASKS-005는 TASKS-004의 미충족 키 함수를 써서 그 뒤다.
TASKS-006은 `agent-dispatch.md`·`rules/cli.md`를 공유하고 TASKS-005의 거절 reason을 문서화하므로 TASKS-001·TASKS-002·TASKS-005 뒤다. TASKS-007은 여섯 commit task 모두에 의존한다.

## Documents
- [작업 001](tasks/001/tasks.md): 구현자 dispatch 모델 해석값 전달 문서.
- [작업 002](tasks/002/tasks.md): brief delta 라운드의 경미 지적 이연 기록.
- [작업 003](tasks/003/tasks.md): 계획 리뷰의 Checklist 테스트 도달 가능성 판정.
- [작업 004](tasks/004/tasks.md): `worker-tokens --tokens unreported` 기록과 미충족 키 계산.
- [작업 005](tasks/005/tasks.md): `record`·`advance`의 `worker-tokens-missing` 거절.
- [작업 006](tasks/006/tasks.md): 토큰 기록 강제 문서.
- [작업 007](tasks/007/tasks.md): 종단 검증.
- [계획 리뷰](context-review.md), [최종 리뷰](review.md).
