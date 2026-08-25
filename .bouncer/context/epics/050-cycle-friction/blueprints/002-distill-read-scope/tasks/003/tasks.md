---
type: bouncer.tasks
title: finalize 승격에서 샤드 전량 재읽기를 없앰
description: finalize가 --all --json payload의 content를 갈라 shard map을 만들고 샤드 파일을 다시 읽지 않게 한다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T12:35:04.126+09:00'
bouncer:
  id: TASKS-003
  epic_id: '050'
  blueprint_id: '002'
  status: ready
  verify: npm run ci
  commit_intent:
    - finalize가 --all --json 감사 뒤 등록 샤드를 파일에서 다시 전량 읽어 같은 본문이 두 번 실렸음
    - 감사 payload의 content로 shard map을 만들어 두 번째 패스를 없앰
  affected_paths:
    - skills/bouncer-finalize/SKILL.md
    - skills/spec-authoring/SKILL.md
    - CLAUDE.md
    - test/skill-bouncer-finalize.test.js
    - test/skill-spec-authoring.test.js
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T12:35:04.126+09:00'
    suggested_paths:
      - scripts/src/lib/finalize.ts
      - scripts/lib/finalize.js
      - test/skill-bouncer-surface.test.js
    basis:
      - graph: source
        status: reused
        query: query 'finalize' (BFS depth=2)
        result: finalize 85노드에서 finalize·validate·scope가 상위 — 다만 이번 변경은 스킬 본문이라 코드 후보는 참고용
      - graph: context
        status: reused
        query: query 'Distill 읽기 프리플라이트'
        result: plugin-skills·validate-gates 샤드의 승격 Decision이 인접
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`/bouncer-finalize` step 1이 `distill --all --json`을 한 번 부르고, 그
payload의 `content`와 `audit.shards`로 `id → {path, currentBody}` 맵을 만든다.
등록 샤드를 파일에서 다시 읽는 두 번째 패스를 없앤다. add/replace/drop 판단이
쓰는 정보는 그대로다 — 같은 본문을 두 번 싣던 것을 한 번으로 만드는 것뿐이다.
완료 판정은 finalize 본문에 샤드 파일 재읽기 지시가 남지 않고 `npm run ci`가
통과하는 것이다.

## Interface
- 제공:
  - `/bouncer-finalize` step 1: `distill --all --json` 한 번 → payload의
    `repoRoot`로 각 `audit.shards[].path`를 해석하고, `content`를 갈라
    `currentBody`를 채운다. 경계는 `audit.shards[].id`로 만든 알려진 id
    집합에 속하는 `# <id>` 줄만 인정한다 — 임의의 `# ` 줄을 경계로 잡으면
    본문 안의 헤딩이 샤드를 쪼갠다. 그 맵을 `spec-authoring`에 넘긴다.
  - 분해 결과의 id 집합이 `audit.shards`의 id 집합과 다르면 승격을 진행하지
    않고 실패로 보고한다. 나머지 finalize 단계는 계속 진행한다.
  - `CLAUDE.md` 하드룰 7의 finalize 문장을 같은 계약으로 맞춘다.
- 거부:
  - 라우트/선택 출력(`--route`, `--for`)을 shard body나 write target으로
    쓰는 것 — 기존 금지를 유지한다.
  - 분해가 어긋났을 때 부분 맵으로 승격을 밀어붙이는 것. 완전성이 비용보다
    우선이다.

## Touch
- Modify `skills/bouncer-finalize/SKILL.md` — step 1의 샤드 읽기 절차를
  payload 분해로 바꾸고 불일치 시 실패 보고 규칙을 적는다.
- Modify `skills/spec-authoring/SKILL.md` — Distill promotion proposal 절의
  "finalize가 각 샤드를 따로 읽어 넘긴다" 서술을 payload 유래로 고친다.
- Modify `CLAUDE.md` — 하드룰 7 finalize 문장을 같은 계약으로 맞춘다.
- Modify `test/skill-bouncer-finalize.test.js` — payload 분해·불일치 실패
  문구 계약 assert.
- Modify `test/skill-spec-authoring.test.js` — 승격 입력 출처 문구 assert.
- Modify `test/master-rules.test.js` — 하드룰 7 finalize 문구 계약 갱신.

## Do not touch
- `scripts/` — CLI와 finalize 라이브러리 동작은 바뀌지 않는다. 이 태스크는
  스킬 지침만 바꾼다.
- `skills/bouncer-plan/SKILL.md`, `skills/discovery/SKILL.md` — 002에서 끝났다.
- `.bouncer/Distill.md`, `.bouncer/distill/` — 004 소관.

## Constraints
- 승격 동의는 지금처럼 목록 전체에 대한 한 번의 ACQ다(037 계약). 샤드별로
  묻는 형태로 바꾸지 않는다.
- 거부는 게이트가 아니며 나머지 finalize를 계속 진행한다는 기존 규칙을
  유지한다.
- `## 이해 상태` / `## Quiz` / comprehension 필드를 Distill로 승격하지 않는
  금지는 그대로다.
- 분해 규칙은 스킬 본문의 절차로만 적는다 — `scripts/`에 파서를 만들지
  않는다.
- 태스크 002가 고친 `CLAUDE.md` 하드룰 7의 plan 두 층 문장과
  `test/master-rules.test.js`의 그 assert는 되돌리지 않는다. 이 태스크가
  같은 파일에서 손대는 것은 finalize 문장뿐이다.

## Checklist
- [ ] `test/skill-bouncer-finalize.test.js`에 실패 assert를 먼저 넣는다:
      본문이 payload `content` 분해를 지시하고, 샤드 파일을 각각 다시 읽으라는
      문장은 포함하지 않는다.
- [ ] `test/skill-spec-authoring.test.js`와 `test/master-rules.test.js`에
      같은 방향의 실패 assert를 넣는다.
- [ ] `node --test test/skill-bouncer-finalize.test.js test/skill-spec-authoring.test.js test/master-rules.test.js`로 실패를 확인한다.
- [ ] `skills/bouncer-finalize/SKILL.md` step 1을 고친다: 호출은 한 번,
      `content`를 `# <id>` 경계로 갈라 `currentBody`를 채우고, 경로는
      payload `repoRoot` + `audit.shards[].path`로 해석한다.
- [ ] 같은 절에 id 집합 불일치 시 승격 미진행·실패 보고 규칙을 적는다.
- [ ] `skills/spec-authoring/SKILL.md` 승격 입력 서술을 payload 유래로 고친다.
- [ ] `CLAUDE.md` 하드룰 7 finalize 문장을 맞춘다.
- [ ] `npm run ci` 통과를 확인한다.
