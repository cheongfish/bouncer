---
type: bouncer.tasks
title: 샤드 경고 기준을 6KB로 조이고 distill --all에 크기 요약을 붙임
description: S26이 실제 샤드 크기에서 작동하게 하고 프리플라이트 총량을 stderr로 관측 가능하게 한다
resource: .bouncer/context/epics/047-context-injection/blueprints/002-distill-shard-discipline/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-24T13:32:35.034+09:00'
bouncer:
  id: TASKS-001
  epic_id: '047'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_type: feat
  commit_intent:
    - 기본 64KB 기준으로는 13KB짜리 샤드도 걸리지 않아 S26이 사실상 놀던 것을 고침
    - distill --all이 stderr로 샤드별·총합 바이트를 내어 증가를 관측 가능하게 함
  affected_paths:
    - scripts/src/lib/config.ts
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/config.js
    - scripts/lib/cli-project-commands.js
    - config.example.json
    - docs/configuration.md
    - test/init.test.js
    - test/cli-project-commands.test.js
    - test/validate-structural.test.js
    - test/distill.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-24T13:45:00.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: fail-skip
        query: distill shard max_bytes S26 structural warning render stderr
        result: 0 usable hits — every returned node resolves to a deleted path (commands/sdd-*.md, .superpowers/, skills/sdd-minimality, skills/okf-authoring); graphify skill 0.9.41 vs package 0.8.22 skew
      - graph: context
        status: fail-skip
        query: distill shard max_bytes S26 structural warning render stderr
        result: 0 usable hits — context graph returns the same stale source nodes; paths seeded by hand instead
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`DEFAULT_DISTILL_CONFIG.max_bytes`를 64KB에서 6KB(6144)로 낮추고, `bouncer distill --all`이 stderr에 샤드별 바이트와 총합을 한 줄로 낸다. 상한 검사 `S26`은 이미 `validate-structural.ts`에 있으나 기본 기준이 실제 샤드보다 5배 커서 아무것도 걸리지 않았다.

기준값 근거: 이 저장소의 영문 샤드는 대략 7.1 바이트/단어다. 6144 바이트는 ≈865 단어에 해당하고, 현재 샤드 분포에서 `plugin-skills`(13,445)·`validate-gates`(8,877)를 걸고 `core`(5,842)를 통과시킨다. 이 저장소 자신은 `.bouncer/config.json`에 `max_bytes: 65536`을 명시하고 있어 기본값 변경의 영향을 받지 않는다 — 테스트는 기본값 경로 픽스처로 판정한다.

stdout은 파이프 청결을 유지한다 — 크기 관측은 Distill route 진단과 같이 stderr로 간다.

## Interface
- 제공: `DEFAULT_DISTILL_CONFIG.max_bytes`가 `6 * 1024`다. `config.example.json`과 `docs/configuration.md`의 기본값 표기가 같이 바뀐다.
- 제공: `bouncer distill --all`이 stderr에 `distill: <id> <bytes>` 샤드별 줄과 `distill: total <bytes> bytes across <n> shards` 총합 줄을 낸다. 초과 샤드에는 같은 줄에 기준 초과 표시를 붙인다.
- 거부: stdout 본문은 한 바이트도 바뀌지 않는다. 요약은 stderr 전용이다.
- 거부: `--for` / `--route` / `--audit` 모드에서는 요약을 내지 않는다. 라우팅 출력에 붙이면 선택 결과를 총량으로 오해하게 되고, `--audit`은 `test/cli-project-commands.test.js:141`이 `audit.err === ''`를 고정하고 있다. 요약은 `--all` 전용이다.
- 거부: 초과를 이유로 본문을 자르거나 샤드를 빼지 않는다. `max_bytes`는 경고 기준이고 하드 상한이 아니다.
- 거부: 기존 소비자 `config.json`의 `max_bytes` 값을 다시 쓰지 않는다.

## Touch
- Modify `scripts/src/lib/config.ts` — `DEFAULT_DISTILL_CONFIG.max_bytes`를 `6 * 1024`로, 근거 주석을 갱신
- Modify `scripts/src/lib/cli-project-commands.ts` — `--all` 경로에서 `CliIo.err`로 샤드별·총합 요약을 낸다
- Modify `scripts/lib/config.js` — `npm run build` CJS emit
- Modify `scripts/lib/cli-project-commands.js` — 같은 emit
- Modify `config.example.json` — `distill.max_bytes`를 `6144`로
- Modify `docs/configuration.md` — 기본값 표기와 §설명을 갱신
- Modify `test/init.test.js` — `:49`·`:95`·`:118`이 `init`이 쓰는 `max_bytes: 65536`을 고정한다. 기본값을 낮추면 세 단언이 함께 걸린다 (`:488`은 스스로 쓴 픽스처라 그대로다)
- Modify `test/cli-project-commands.test.js` — `--all` stderr 요약과 stdout 불변을 단언
- Modify `test/validate-structural.test.js` — 기존 S26 픽스처는 `maxBytes: 1`을 명시해 기본값에 둔감하다. **기본값 경로** 픽스처를 새로 추가해 6144 기준의 걸림/통과를 판정한다
- Modify `test/distill.test.js` — 같은 이유로 S26 픽스처 확인

## Do not touch
- `.bouncer/distill/` — 샤드 본문을 이번 task에서 줄이지 않는다
- `.bouncer/Distill.md` — 샤드 인덱스와 등록 목록은 그대로다
- `.bouncer/config.json` — 이 저장소의 실제 설정은 사람이 정한다
- `scripts/src/lib/init.ts` — 기존 config를 다시 쓰지 않는 계약을 유지한다
- `skills/` — 노출 문구는 task 002가 다룬다

## Constraints
- stdout 계약은 불변이다. 기존 `--all` stdout을 바이트 단위로 비교하는 테스트가 있으면 그대로 통과해야 한다.
- `S26` 코드 번호와 메시지 형식을 바꾸지 않는다.
- 단일 파일 폴백(샤드 인덱스 부재·무효)에서는 샤드별 목록 없이 `distill: total <bytes> bytes (single-file)` 한 줄만 낸다 — `across 0 shards`처럼 샤드 수를 0으로 적지 않는다.
- 새 런타임 의존성이나 새 CLI 플래그를 넣지 않는다.
- 코드 주석은 한국어를 유지하고, 6144라는 숫자의 근거(바이트/단어 환산과 현재 샤드 분포)를 주석에 남긴다.

## Checklist
- [ ] `test/cli-project-commands.test.js`에 실패 테스트를 추가한다.
  ```js
  const r = runCli(['distill', '--all', '--repo', repo]);
  assert.match(r.stderr, /distill: total \d+ bytes across \d+ shards/);
  assert.doesNotMatch(r.stdout, /distill: total/);
  ```
- [ ] `node --test test/cli-project-commands.test.js`로 실패를 확인한다.
- [ ] `scripts/src/lib/config.ts`의 기본값과 주석을 고친다.
- [ ] `scripts/src/lib/cli-project-commands.ts`의 `--all` 경로에 stderr 요약을 넣는다.
- [ ] `config.example.json`·`docs/configuration.md`의 기본값 표기를 맞춘다.
- [ ] `npm run build`로 두 emit을 갱신한다.
- [ ] `test/validate-structural.test.js`에 기본값 경로 S26 픽스처를 추가한다 — `max_bytes`를 넘기지 않고 `DEFAULT_DISTILL_CONFIG`가 쓰이게 한다.
  ```js
  // 6144 위/아래 두 샤드. config에 distill.max_bytes 를 넣지 않는다.
  shard({ id: 'big', body: 'x'.repeat(8877) });  // S26 나야 함
  shard({ id: 'small', body: 'x'.repeat(5842) }); // S26 나면 안 됨
  ```
- [ ] `test/init.test.js`의 세 `65536` 단언을 새 기본값으로 맞춘다.
- [ ] `node --test test/validate-structural.test.js test/distill.test.js test/init.test.js`로 확인한다.
- [ ] `npm run ci`가 통과한다.
