---
type: bouncer.tasks
title: Distill 재접지 지시를 단일 호출로 전환
description: 재접지를 지시하는 네 문서와 core 샤드를 --for 반복 지정 단일 호출로 바꾸고 그 형태를 테스트로 잠근다
resource: .bouncer/context/epics/007-project-distill/blueprints/008-for-union-single-call/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T10:50:00.378+09:00'
bouncer:
  id: TASKS-002
  epic_id: '007'
  blueprint_id: '008'
  status: verified
  commit_intent:
    - 재접지를 경로마다 부르게 한 지시 때문에 공통 샤드 본문이 경로 수만큼 반복 주입되어 왔음
    - 확정 경로 전부를 한 번에 넘겨 합집합만 주입하도록 지시를 바꿔 중복분을 걷어냄
  verify: npm run ci
  affected_paths:
    - CLAUDE.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-run/SKILL.md
    - .bouncer/distill/core.md
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-27T10:55:29.544+09:00'
    suggested_paths:
      - scripts/src/lib
      - scripts/lib
      - test
    basis:
      - graph: source
        status: reused
        query: distill --for re-ground injection per path union CLI project commands master rules
        result: 32 nodes; top hits scripts/src/lib/cli.ts, scripts/lib/cli.js, test/commit-hook.test.js. source_dirs가 scripts/hooks/test뿐이라 CLAUDE.md와 skills/**는 색인 대상이 아니다
      - graph: context
        status: updated
        query: distill --for re-ground injection per path union CLI project commands master rules
        result: 10 nodes, 전부 이 blueprint가 방금 만든 문서(index.md, tasks/001, tasks/002). 기존 epic과의 겹침 없음
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
재접지를 지시하는 네 문서와 `.bouncer/distill/core.md`가 확정 경로 전부를 `--for` 반복 지정으로 한 번에 넘기라고 지시한다. 지금은 경로마다 따로 부르라고 쓰여 있어 `always` 샤드와 공통 `pulls`가 경로 수만큼 반복 주입된다. 바뀌는 것은 호출 횟수뿐이고, 선택 알고리즘·출력 포맷·`--all` baseline 계약은 그대로다. 마지막으로 `test/master-rules.test.js`가 다섯 문서에서 경로별 반복 문구가 되살아나지 못하게 잠근다.

## Interface
- 제공: 다섯 문서가 모두 `bouncer distill --for` 를 확정 경로 수와 무관하게 한 번 부르라고 지시하고, 다섯 모두 본문에 `--for` 를 두 번 이상 쓴 형태를 담는다. `skills/bouncer-plan/SKILL.md`은 아래 셸 블록을 싣고, 나머지 넷은 `--for <path-1> --for <path-2>` 를 문장 안에 인라인으로 적는다 — 두 `--for` 사이가 160자를 넘지 않아야 잠금 테스트가 잡는다.
```bash
node "${BOUNCER_ROOT}/scripts/bouncer" distill \
  --for <path-1> \
  --for <path-2> \
  --repo "${PROJECT_ROOT}"
```
- 거부: 다섯 문서 어디에도 「once per … path」·「once for each … path」·「경로마다 한 번」 형태가 남지 않는다. 플래그 뒤에 경로를 나열하는 `--for a b` 형태를 예시로 쓰지 않는다 — CLI가 종료 코드 2로 거절한다.

## Touch
- Modify `CLAUDE.md` — 하드룰 7의 재접지 문장을 단일 호출로 바꾼다.
- Modify `skills/bouncer-plan/SKILL.md` — step 6 「Distill re-ground」 문장을 단일 호출로 바꾸고 플래그 반복형 셸 예시를 싣는다.
- Modify `skills/bouncer-execute/SKILL.md` — 「Project Distill」 절의 재접지 문장을 단일 호출로 바꾼다.
- Modify `skills/bouncer-run/SKILL.md` — 「Project Distill」 절의 재접지 문장을 단일 호출로 바꾼다.
- Modify `.bouncer/distill/core.md` — Decisions의 `re-ground with bouncer distill --for <path>` 문장을 합집합 단일 호출로 바꾼다.
- Modify `test/master-rules.test.js` — 다섯 문서에 경로별 반복 문구가 없고 반복 플래그 형태가 있다는 `test(...)` 블록을 더한다.

## Do not touch
- `scripts/src/lib/cli-project-commands.ts` — 인자 파서와 라우팅은 이미 이 계약대로 동작한다.
- `test/cli-project-commands.test.js` — CLI 계약 단언은 task 001이 가진다.
- `skills/spec-authoring/SKILL.md` — `--for` 결과를 소비하는 쪽이라 호출 횟수 계약이 아니다.
- `.bouncer/Distill.md` — 샤드 인덱스다. 바뀌는 것은 `core` 샤드 본문뿐이다.
- `docs/configuration.md`, `docs/cli.md`, `scripts/src/lib/cli-project-commands.ts`의 usage 문자열 — `--for` 구문을 설명하지만 재접지 호출 횟수 계약이 아니고 `npm run ci`에 영향이 없다.
- `.bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/explain.md` — 지나간 회차의 기록이라 소급 수정하지 않는다.

## Constraints
- `.bouncer/distill/core.md`는 등록 샤드라 `scope.makeAllowed`가 자동으로 열어 주지 않는다. `affected_paths`에 명시된 상태로만 커밋된다.
- `test/master-rules.test.js:126,131,135,141,149,151,184`의 기존 단언은 이 문구 변경 뒤에도 그대로 성립한다. 지우거나 완화하지 말고 새 블록만 더한다.
- 「경로 전부를 한 번에」가 「둘 이상일 때만」을 뜻하지 않는다. 확정 경로가 하나인 회차도 같은 문장으로 성립하게 쓴다.
- 합집합 단일 주입이 `--all` stdout 주입 허용을 뜻하지 않는다. 각 문서의 `--all` baseline 금지 문구와 단일 파일 폴백 문구는 유지한다.
- 다섯 문서 중 `CLAUDE.md`와 세 SKILL, `core.md`는 영어를 유지한다. 이 task에는 한국어 본문 대상이 없다.
- 새 규칙을 `rules/` 정본으로 추출하지 않는다. 그 통합은 epic 054 소관이며, 여기서는 네 곳을 같은 문장으로 맞추기만 한다.

## Checklist
- [ ] 남은 반복 문구를 먼저 훑어 지시 대상이 넷뿐인지 확인한다. 지시문 표면만 훑는다 — `.bouncer/context/**`의 지난 회차 기록과 루트 스크래치 문서는 소급 수정 대상이 아니다. 아래 명령은 지금 정확히 네 줄을 낸다.
```bash
grep -rn "once per\|once for each\|경로마다" --include=*.md CLAUDE.md skills/
```
- [ ] 다섯 번째 대상인 `.bouncer/distill/core.md`는 위 문구를 담고 있지 않으므로 따로 확인한다.
```bash
grep -n "distill --for" .bouncer/distill/core.md
```
- [ ] `test/master-rules.test.js`에 잠금 블록을 더하고, 문구를 바꾸기 **전에** 이 테스트가 실패하는 것을 확인한다.
```js
test('Distill re-ground is one call with repeated --for, not one call per path', () => {
  for (const rel of [
    'CLAUDE.md',
    'skills/bouncer-plan/SKILL.md',
    'skills/bouncer-execute/SKILL.md',
    'skills/bouncer-run/SKILL.md',
    '.bouncer/distill/core.md',
  ]) {
    const md = read(rel);
    assert.doesNotMatch(md, /once (?:per|for each)[\s\S]{0,40}path/i, `${rel} must not ask for one call per path`);
    assert.doesNotMatch(md, /경로마다[\s\S]{0,20}한 번/, `${rel} must not ask for one call per path`);
    assert.match(md, /--for[\s\S]{0,160}--for/, `${rel} must show the repeated-flag single call`);
  }
});
```
- [ ] `CLAUDE.md` 하드룰 7, 세 SKILL의 재접지 절, `.bouncer/distill/core.md` Decisions 문장을 단일 호출로 고쳐 위 테스트를 통과시킨다.
- [ ] `skills/bouncer-plan/SKILL.md`의 「Distill re-ground」에 Interface의 셸 블록을 싣는다.
- [ ] 나머지 네 문서(`CLAUDE.md`, `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md`, `.bouncer/distill/core.md`)에도 `--for <path-1> --for <path-2>` 인라인 형태를 넣어 잠금 테스트의 `--for[\s\S]{0,160}--for` 를 만족시킨다. 다섯 문서 모두 현재는 이 매치가 없다.
- [ ] `npm run ci`가 통과하는지 확인한다.
