---
type: bouncer.tasks
title: 샤드 인벤토리를 distill JSON에 노출
description: distill --json audit에 등재 샤드의 id·경로·글롭·always·pulls를 실음
resource: .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T16:25:12.612+09:00'
bouncer:
  id: TASKS-001
  epic_id: '037'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 승격 배치 판단이 파일 직접 읽기 없이 CLI 출력만으로 되어야 함
    - 판단 근거가 되는 샤드 메타데이터를 한 곳에서 주어야 함
  verify: npm test
  affected_paths:
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - test/cli-project-commands.test.js
    - docs/cli.md
  graph:
    generated_at: '2026-08-14T16:25:12.612+09:00'
    command: graphify query source+context
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
      - docs
    basis:
      - graph: source
        status: reused
        query: Distill promotion finalize consent shard inventory CLI json audit
        result: 89 nodes; cli.ts, cli-project-commands.test.js, finalize.ts 중심 — distill 페이로드 소비 지점
      - graph: context
        status: reused
        query: Distill 승격 finalize 동의 샤드 배치 spec-authoring
        result: 6 nodes; .bouncer/distill/validate-gates.md, plugin-skills.md의 Decisions 절
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`bouncer distill --all --json`만 보고도 어느 샤드가 어떤 경로를 맡는지 알 수 있다. 지금 `audit`은 `ids`만 주기 때문에, 배치를 판단하려면 `.bouncer/Distill.md` 프론트매터와 샤드 파일을 직접 열어야 하고 이는 마스터 룰 7의 "CLI 계약을 소비하라"와 어긋난다. 이 태스크는 그 근거를 JSON에 싣는 일만 한다 — 판단도 정렬도 하지 않는다.

## Interface
- 제공: `audit.shards`는 등재된 샤드마다 `{ id, path, always, pathsKnown, pullsKnown }`와, 선언된 경우의 `paths`·`pulls`를 담은 배열이다. 순서는 인덱스 등재 순서를 따른다. `pathsKnown`과 `pullsKnown`을 함께 싣는 이유는 라우터가 두 신호 모두로 fail-open을 결정하기 때문이다 — 한쪽만 노출하면 소비자가 불확실성의 절반을 못 본다.
- 거부:
  - 본문을 싣지 않는다. `raw`·`body`·`content`는 투영에서 제외한다 — `content` 최상위 필드가 이미 전문을 준다.
  - 선택 결과로 좁히지 않는다. `--route`·`--for`에서도 `audit.shards`는 등재된 전체 샤드이고, 무엇이 선택됐는지는 기존 `ids`·`selectedCount`가 답한다.
  - 단일 파일 fallback(`sharded: false`)에서는 빈 배열이다. 가짜 샤드를 만들어 넣지 않는다.
  - `paths`·`pulls`가 선언되지 않은 샤드는 값을 지어내지 않는다. `undefined`를 빈 배열로 바꾸면 규칙 누락과 미선언을 구분할 수 없다.

## Touch
- Modify `scripts/src/lib/cli-project-commands.ts` — `distillPayload`의 `audit`에 샤드 투영을 추가한다.
- Modify `scripts/lib/cli-project-commands.js` — `npm run build` 산출물 갱신.
- Modify `test/cli-project-commands.test.js` — 샤드 모드·라우트 모드·fallback·미선언 필드 케이스.
- Modify `docs/cli.md` — `distill --json` 출력 설명에 `audit.shards` 항목 추가.

## Do not touch
- `scripts/src/lib/distill.ts` — 샤드 객체는 이미 필요한 필드를 모두 갖고 있다. 리더를 바꿀 이유가 없다.
- `scripts/src/lib/validate-structural.ts`, `scripts/src/lib/scope.ts` — 검증·스코프 계약은 이 태스크와 무관하다.
- `skills/`, `CLAUDE.md` — 프로즈는 002.

## Constraints
- 기존 `audit` 필드(`valid`·`sharded`·`shardCount`·`selectedCount`·`ids`)의 의미와 이름을 바꾸지 않는다. 추가만 한다.
- 출력 크기를 키우지 않는다. 투영은 메타데이터만이고, 본문이 새어 나가면 전문이 두 번 실린다.
- `pathsKnown`·`pullsKnown`은 리더가 계산한 값을 그대로 전달한다. CLI에서 다시 계산하지 않는다.

## Checklist
- [ ] 실패 테스트 먼저: `test/cli-project-commands.test.js`에 네 케이스를 추가하고 실패를 확인한다.
      ```
      샤드 모드: audit.shards 길이 == shardCount, 각 항목에 id/path/paths/always/pulls
      라우트 모드: ids는 좁혀져도 audit.shards는 전체
      fallback(sharded:false): audit.shards == []
      paths 미선언 샤드: 해당 필드가 빈 배열로 채워지지 않고 pathsKnown/pullsKnown은 실림
      ```
- [ ] `distillPayload`에 투영을 구현하고 본문 필드를 제외한다. `pathsKnown`·`pullsKnown`은 리더 값을 그대로 전달한다.
- [ ] `docs/cli.md`에 필드 설명을 한 문단 추가한다.
- [ ] `npm run build` 후 `npm test`가 통과한다.
