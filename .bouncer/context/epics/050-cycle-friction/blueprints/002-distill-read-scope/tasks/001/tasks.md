---
type: bouncer.tasks
title: distill에 always 샤드만 내는 preflight 모드를 더함
description: 경로 확정 전 계획 초반이 전량 대신 always 샤드 본문과 샤드 인벤토리만 받도록 CLI 선택 모드를 추가한다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T11:09:18.815+09:00'
bouncer:
  id: TASKS-001
  epic_id: '050'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - 계획 초반에는 경로가 없어 라우팅이 불가능하다는 이유로 7샤드 42.7KB를 통째로 실어 왔음
    - 그 구간이 실제로 쓰는 것은 always 샤드와 샤드 목록뿐이어서 선택 모드를 하나 더함
  affected_paths:
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - test/cli-project-commands.test.js
    - docs/cli.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T12:40:00+09:00'
    suggested_paths:
      - scripts/src/lib/cli-project-commands.ts
      - scripts/lib/cli-project-commands.js
      - scripts/src/lib/distill.ts
      - scripts/lib/distill.js
      - test/distill.test.js
      - scripts/src/lib/cli.ts
      - test/plugin-wiring.test.js
    basis:
      - graph: source
        status: updated
        query: query 'distill' / 'cli-project-commands' (BFS depth=2)
        result: distill·cli 계열 352노드에서 cli-project-commands·distill·cli와 그 emit·테스트가 상위로 나옴
      - graph: context
        status: updated
        query: query 'Distill 읽기 프리플라이트'
        result: 038 blueprint와 .bouncer/distill 샤드만 매칭 — 소스 경로 후보 없음
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`bouncer distill --preflight [--json]`이 생겨서, `always: true` 샤드 본문과
등록된 전체 샤드 인벤토리만 출력한다. `--all`과 달리 나머지 샤드 본문은
싣지 않는다. 이 모드가 있어야 002 태스크가 plan·discovery·spec-authoring의
읽기를 옮길 자리가 생긴다. 완료 판정은 `npm run ci`와, `--preflight` stdout이
`--all` stdout보다 작으면서 `audit.shards`에는 7개가 모두 들어 있음이다.

## Interface
- 제공:
  - `distill --preflight`: `DISTILL_MODES`에 `preflight` 추가. 선택은
    `state.shards` 중 `always === true`인 것만, `reason`은 `preflight-always`.
    payload는 기존 `distillPayload`를 그대로 쓰므로 `audit.shards`에는
    선택과 무관하게 등록 전체가 실린다.
  - `--json` 지원. `--json` 없이는 `content`만 stdout으로 나간다.
  - 인덱스가 무효하거나 샤드가 아닌 단일 파일 폴백(`state.sharded !== true`)
    이면 `allDistillSelection(state, 'not-sharded')`로 전량을 낸다.
  - `always` 샤드가 하나도 없으면 선택은 비고 인벤토리만 나가며,
    `distill: preflight selected no always shard\n`을 stderr로 낸다.
  - `docs/cli.md` 명령표와 설명 문단에 `--preflight`를 기재한다.
- 거부:
  - `--preflight`에 경로 인자를 붙이면 `distill: preflight does not accept a path`
    를 stderr로 내고 종료 코드 2. `--all` / `--audit`과 같은 취급이다.
  - 모드 없이 호출했을 때의 사용법 문구에 `--preflight`를 넣되, 기존
    `--for` / `--all` / `--route` / `--audit`의 동작·출력 스키마는 그대로 둔다.

## Touch
- Modify `scripts/src/lib/cli-project-commands.ts` — `DISTILL_MODES`에
  `preflight` 추가, 경로 인자 거부 분기 확장, `alwaysDistillSelection` 헬퍼와
  `cmdDistill`의 선택 분기, usage 문자열 갱신.
- Modify `scripts/lib/cli-project-commands.js` — 위 변경의 CJS emit
  (`npm run build`로 재생성; 소비자는 Node만 쓴다).
- Modify `test/cli-project-commands.test.js` — preflight 선택·인벤토리·경로
  거부·단일 파일 폴백·always 부재 stderr 케이스 추가.
- Modify `docs/cli.md` — 명령표 19행과 36~40행 설명에 `--preflight` 기재.

## Do not touch
- `scripts/src/lib/distill.ts` — 라우팅 규칙과 `readShards` / `renderShards`
  계약은 036 소관이고 이번 모드는 선택 단계만 다르다.
- `.bouncer/Distill.md`, `.bouncer/distill/` — 본문 정정은 태스크 004.
- `skills/`, `CLAUDE.md` — 읽는 쪽 지침 전환은 태스크 002·003.

## Constraints
- 기존 네 모드의 stdout 스키마와 종료 코드는 바뀌지 않는다. 새 키를 payload에
  더하지 않는다 — `mode` 값만 `preflight`로 달라진다.
- stdout은 pipe-clean을 유지한다. 진단은 전부 stderr다.
- `--all` 전용인 바이트 총량 요약(`writeDistillAllSizeSummary`)은
  `--preflight`에 붙이지 않는다. 선택 결과를 총량으로 오해하게 만든다.
- 새 모듈이나 새 config 키를 만들지 않는다. 선택 헬퍼는
  `allDistillSelection` 옆 같은 파일에 둔다.
- 주석은 한국어로, 왜 그렇게 갈랐는지만 남긴다.

## Checklist
- [ ] `test/cli-project-commands.test.js`에 실패 테스트를 먼저 추가한다:
      `--preflight`가 `core`만 선택하고 `audit.shards.length === 7`, 그리고
      `--preflight` content 길이 < `--all` content 길이.
- [ ] `node --test test/cli-project-commands.test.js`로 실패를 확인한다.
- [ ] `DISTILL_MODES`에 `'preflight'`를 넣고, 경로 거부 조건을
      `mode === 'all' || mode === 'audit' || mode === 'preflight'`로 넓힌다.
- [ ] 모드 필수 실패 문구를 `one of --for, --all, --preflight, --route, or --audit is required`
      로 바꾸고 같은 문구를 테스트로 고정한다.
- [ ] `alwaysDistillSelection(state)`를 `allDistillSelection` 아래에 추가한다.
      `state.sharded !== true`면 `allDistillSelection(state, 'not-sharded')`를
      반환한다.
- [ ] `cmdDistill`의 selection 분기에 preflight를 넣는다:
      ```
      const selection = parsed.mode === 'all' || parsed.mode === 'audit'
        ? allDistillSelection(state, 'forced-all')
        : parsed.mode === 'preflight'
          ? alwaysDistillSelection(state)
          : routeShards({ ... });
      ```
- [ ] preflight 선택이 비었고 `state.sharded === true`이면
      `distill: preflight selected no always shard`를 stderr로 낸다.
- [ ] `COMMANDS.distill.usage`에 `--preflight [--json]`을 넣는다.
- [ ] `docs/cli.md` 표와 설명 문단에 같은 내용을 적는다.
- [ ] `npm run build`로 `scripts/lib/cli-project-commands.js`를 재생성한다.
- [ ] `npm run ci` 통과를 확인한다.
