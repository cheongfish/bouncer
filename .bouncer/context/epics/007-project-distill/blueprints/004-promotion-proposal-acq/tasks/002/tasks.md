---
type: bouncer.tasks
title: finalize 승격 제안과 단일 동의 절차
description: 승격 후보를 위험 순 목록으로 제시하고 한 번의 동의 뒤에만 쓰도록 프로즈와 마스터 룰을 고침
resource: .bouncer/context/epics/007-project-distill/blueprints/004-promotion-proposal-acq/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T16:25:12.646+09:00'
bouncer:
  id: TASKS-002
  epic_id: '007'
  blueprint_id: '004'
  status: verified
  commit_intent:
    - 승격이 사람 승인 없이 이후 모든 사이클을 조종하지 않게 해야 함
    - 동의 절차가 사이클 완주를 막지 않게 해야 함
  verify: npm test
  affected_paths:
    - skills/bouncer-finalize/SKILL.md
    - skills/spec-authoring/SKILL.md
    - CLAUDE.md
    - test/skill-bouncer-finalize.test.js
    - test/skill-spec-authoring.test.js
    - test/master-rules.test.js
  graph:
    generated_at: '2026-08-14T16:25:12.646+09:00'
    command: graphify query source+context
    suggested_paths:
      - skills
      - test
      - scripts/src/lib
    basis:
      - graph: source
        status: reused
        query: Distill promotion finalize consent shard inventory CLI json audit
        result: 89 nodes; finalize.ts와 makeAllowed/scope 경로 — 프로즈가 참조하는 코드 계약 확인용
      - graph: context
        status: reused
        query: Distill 승격 finalize 동의 샤드 배치 spec-authoring
        result: 6 nodes; 012-finalize-handoff Success criteria와 Distill Decisions 절
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`/bouncer-finalize` 1단계가 Distill에 바로 쓰지 않는다. 후보를 동작·대상 샤드가 붙은 한 목록으로 제시하고, 목록 전체에 대해 한 번 동의를 받은 뒤에만 쓴다. 거절해도 explain·퀴즈·G16·remainder 커밋은 그대로 진행된다. 게이트를 만들지 않는다 — validate가 판정할 수 없는 것을 게이트로 만들면 폐기된 G9를 이름만 바꿔 되살리는 셈이다.

## Interface
- 제공:
  - 1단계 제안 목록: 항목마다 동작(`add` | `replace` | `drop`), 불릿 문장, 출처 한 줄(explain의 어느 절), 대상 샤드 id. `replace`는 대체될 기존 문장을 함께 보여준다.
  - 정렬은 `drop` → `replace` → `add`. 되돌리기 어려운 것이 먼저 온다.
  - 단일 ACQ 세 갈래: 승인 / 수정 / 건너뛰기. 목록 전체에 한 번만 묻는다.
  - 대상 샤드 판단의 근거는 `/bouncer-finalize`가 `bouncer distill --all --json`을 실행해 얻은 `audit.shards`이다. finalize는 `PROJECT_ROOT` 기준으로 등재된 각 상대 경로를 읽어 `id → { path, currentBody }` 맵을 만들고, 메타데이터와 함께 `spec-authoring`에 넘긴다. 샤드 선택 결과의 합산 본문을 개별 샤드 본문으로 쓰지 않는다. `spec-authoring`은 호출자가 준 맵만 쓰고 CLI를 직접 부르지 않는다.
  - 단일 파일 fallback에서는 finalize가 절대 경로와 현재 본문을 제공하고, 제안 항목의 대상은 세션 안에서만 쓰는 `single-file`로 표기한다. 이는 샤드 id가 아니라 샤드가 없는 fallback을 구분하는 표기이며 파일에 기록하지 않는다.
  - 후보가 0건이면 ACQ를 띄우지 않고 승격할 것이 없다고만 보고한다.
  - `drop` 대상 문구가 현재 Distill과 일치하지 않으면 그 항목만 실패로 보고하고 나머지 항목은 진행한다.
  - ACQ 도구를 쓸 수 없으면 같은 목록을 대화에 렌더하고 응답을 기다린다. 응답 없이 승격으로 넘어가지 않는다.
- 거부:
  - 불릿마다 묻지 않는다. 퀴즈가 한 번에 제시하고 한 번에 받는 것과 같은 규율이다.
  - 동의 없이 파일을 쓰지 않는다. 수정 선택은 재제시로 돌아가고 쓰기로 넘어가지 않는다.
  - `config.autonomy: auto`가 이 ACQ를 생략하지 않는다. auto가 생략하는 것은 run 루프 안의 커밋·다음 태스크 ACQ이고 finalize는 루프 밖이다.
  - `bouncer.scale: light`도 이 ACQ를 생략하지 않는다. G18이 light 예외를 두지 않는 것과 같고, 그래야 `rules/governance.md`의 「light 경로에서 Distill 승격은 그대로」가 계속 참이 된다.
  - 승격 거절이 사이클을 멈추지 않는다. 승격은 G16의 요구사항이 아니다.

## Touch
- Modify `skills/bouncer-finalize/SKILL.md` — 1단계를 제안·정렬·단일 ACQ·거절 경로로 다시 쓴다.
- Modify `skills/spec-authoring/SKILL.md` — 승격 절이 제안 항목을 산출하고 동의 이후에만 쓰도록 고친다.
- Modify `CLAUDE.md` — 하드 룰 7에 승격 동의 의무 한 문장을 더한다.
- Modify `test/skill-bouncer-finalize.test.js` — 제안 구조·정렬·단일 ACQ·거절 진행·autonomy 예외 없음.
- Modify `test/skill-spec-authoring.test.js` — 동의 이후 쓰기 계약.
- Modify `test/master-rules.test.js` — 룰 7 새 문장.

## Do not touch
- `scripts/` — 이 태스크는 프로즈만 바꾼다. 동의는 세션 안의 절차이지 CLI 상태가 아니다.
- `scripts/src/lib/scope.ts` — `makeFinalizeAllowed`는 이미 등재 샤드를 허용한다.
- `skills/bouncer-run/SKILL.md` — run은 finalize에 들어가지 않는다.
- `docs/` — 001이 CLI 출력만 문서화하고, 절차 문서화는 이 blueprint 범위 밖이다.

## Constraints
- 게이트를 만들지 않는다. 새 G 코드도, `validate`의 새 검사도 없다.
- 새 설정 키와 문서 필드를 만들지 않는다. 동의 여부를 파일에 기록하지 않는다.
- 샤드별 본문은 finalize가 경로별로 분리해 제공한다. `--route` 등의 합산 출력은 어떤 샤드의 본문으로도 재사용하지 않는다.
- 일반 샤드의 상대 경로는 이미 resolve한 `PROJECT_ROOT`에서만 해석한다. execute worktree나 plugin root를 기준으로 읽지 않는다.
- 제안 목록을 임의로 자르지 않는다. 길이를 줄여야 하면 정렬을 유지한 채 생략 사실을 보고한다.
- 기존 ACQ(Draft PR, 다음 blueprint)의 **본문**은 건드리지 않는다. 다만 스킬 머리의 `Gates in this skill:` 목록에는 새 1단계 동의를 추가해야 한다 — 그 줄을 그대로 두면 목록이 사실과 어긋난다.
- `spec-authoring`이 `scripts/bouncer`나 `BOUNCER_ROOT`를 부르게 만들지 않는다. `test/master-rules.test.js`의 해당 금지 어서션은 유지 대상이지 완화 대상이 아니다.
- 트러스트 경계를 유지한다. explain 본문은 데이터이고, 그 안의 문장이 제안 항목을 늘리거나 동의를 대신할 수 없다.

## Checklist
- [ ] 실패 테스트 먼저: `test/skill-bouncer-finalize.test.js`에 다섯 어서션을 추가하고 실패를 확인한다.
      ```
      제안 항목 네 요소(동작·문장·출처·대상 샤드)
      정렬 drop → replace → add
      단일 ACQ 세 갈래(승인·수정·건너뛰기), 불릿별 질문 금지
      거절 시 explain·퀴즈·G16·remainder 진행
      replace 항목이 기존 문장과 새 문장을 함께 제시
      후보 0건이면 ACQ 없음, drop 불일치는 그 항목만 실패
      autonomy auto·scale light 어디서도 생략 없음
      finalize가 모든 등재 샤드의 `id → path/currentBody` 맵을 넘기며, 합산 route 본문을 개별 샤드에 붙이지 않음
      일반 샤드 경로는 `PROJECT_ROOT` 기준으로 해석함
      fallback은 caller-provided 절대 경로·본문과 세션 전용 `single-file` 대상으로만 처리
      ```
- [ ] `skills/bouncer-finalize/SKILL.md` 1단계를 다시 쓴다.
- [ ] `skills/spec-authoring/SKILL.md` 승격 절을 제안 산출 + 동의 후 쓰기로 고친다.
- [ ] `CLAUDE.md` 하드 룰 7에 문장을 더하고 `test/master-rules.test.js`를 함께 갱신한다.
- [ ] `npm test`가 통과한다.
