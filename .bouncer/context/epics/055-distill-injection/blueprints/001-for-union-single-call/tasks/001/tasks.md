---
type: bouncer.tasks
title: 다중 --for 합집합·중복 제거 계약 테스트 추가
description: bouncer distill이 --for를 반복 지정받았을 때 합집합을 중복 없이 한 번만 낸다는 것을 테스트가 단정하게 한다
resource: .bouncer/context/epics/055-distill-injection/blueprints/001-for-union-single-call/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-27T10:49:42.247+09:00'
bouncer:
  id: TASKS-001
  epic_id: '055'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 여러 경로를 한 번에 넘겼을 때 합집합을 중복 없이 낸다는 동작이 구현에만 있고 계약으로 고정되어 있지 않았음
    - 호출 방식을 바꾸기 전에 그 방식이 기대대로 동작한다는 근거를 먼저 세워 둠
  verify: npm run ci
  affected_paths:
    - test/cli-project-commands.test.js
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
`bouncer distill`이 `--for`를 여러 번 받았을 때 선택 결과의 합집합을 내고 겹치는 샤드 본문을 한 번만 출력한다는 것을, 테스트가 단정한다. 지금은 `scripts/src/lib/cli-project-commands.ts`의 `targets.push(value)` 누적으로 동작만 있고 단언이 없어서, 이 동작이 깨져도 붉어지는 테스트가 없다. task 002는 이 단언을 근거로 재접지 지시를 단일 호출로 바꾼다.

## Interface
- 제공: `--for`를 두 번 지정한 호출이 `payload.ids`를 두 경로 선택의 합집합으로 내고, 두 선택에 공통인 샤드를 `content`에 한 번만 담는다. 같은 샤드로 라우팅되는 경로 두 개를 넘기면 `ids`가 늘어나지 않는다.
- 거부: `--for` 값 뒤에 플래그 없이 경로를 이어 쓰면 종료 코드 2, stdout 빈 문자열, stderr `distill: unexpected argument: <path>\n`.

## Touch
- Modify `test/cli-project-commands.test.js` — 다중 `--for` 합집합·중복 제거와 플래그 없는 경로 나열 거부를 단정하는 `test(...)` 블록 두 개를 더한다.

## Do not touch
- `scripts/src/lib/cli-project-commands.ts` — 합집합·중복 제거는 이미 계약대로 동작한다. 이 task는 동작을 고정할 뿐 바꾸지 않는다.
- `.bouncer/distill/core.md` — 샤드 본문 문구는 task 002 소관이다.
- `test/master-rules.test.js` — 지시문 리터럴 단언은 task 002가 문구와 함께 옮긴다.

## Constraints
- 기존 `seedDistill` 픽스처(`core`는 `always`, `source`는 `scripts/**`, `docs`는 `docs/**`, `source`는 `core`를 `pulls`)를 그대로 쓴다. 새 픽스처 헬퍼나 샤드를 만들지 않는다.
- `ids` 단언은 `assert.deepStrictEqual`로 배열 순서까지 고정한다. 순서를 무시하는 집합 비교로 완화하지 않는다.
- 파일 안 기존 `distill` 테스트의 이름과 순서는 건드리지 않고 새 블록으로만 더한다.
- 이 task는 이미 있는 동작을 기록하는 특성화 테스트다. 실패를 먼저 만들기 위해 구현을 되돌리거나 단언을 일부러 틀리게 두지 않는다.

## Checklist
- [ ] 합집합·중복 제거 케이스를 더한다. `docs/index.md` 단독 선택이 `['core','docs']`이고, `scripts/src/lib/cli.ts`와 함께 넘기면 `['core','source','docs']`이며 `content`가 세 샤드를 한 번씩만 담은 리터럴과 같다는 것까지 단정한다.
```js
test('distill --for accepts repeated flags and renders the deduplicated union once', () => {
  const repo = fixture();
  const single = capture(['distill', '--repo', repo, '--for', 'docs/index.md', '--json']);
  const union = capture([
    'distill', '--repo', repo,
    '--for', 'scripts/src/lib/cli.ts',
    '--for', 'docs/index.md',
    '--json',
  ]);
  const payload = JSON.parse(union.out);

  assert.deepStrictEqual(JSON.parse(single.out).ids, ['core', 'docs']);
  assert.strictEqual(union.code, 0);
  assert.deepStrictEqual(payload.targetPaths, ['scripts/src/lib/cli.ts', 'docs/index.md']);
  assert.deepStrictEqual(payload.ids, ['core', 'source', 'docs']);
  assert.strictEqual(payload.content, '# core\n\n\n# source\n\n\n# docs\n');
  assert.strictEqual(union.err, '');
});
```
- [ ] 같은 샤드로 가는 경로 두 개가 `ids`를 부풀리지 않는다는 것을 위 블록 **안에서** 이어 단정한다. 아래는 그 블록의 `repo`를 그대로 쓰는 조각이라, 별도 `test(...)`로 떼면 `fixture()`를 새로 잡아야 한다.
```js
  const same = capture([
    'distill', '--repo', repo,
    '--for', 'scripts/src/lib/cli.ts',
    '--for', 'scripts/src/lib/other.ts',
    '--json',
  ]);
  assert.deepStrictEqual(JSON.parse(same.out).ids, ['core', 'source']);
```
- [ ] 플래그 없는 경로 나열 거부 케이스를 더한다.
```js
test('distill --for rejects a bare path after the flag value', () => {
  const repo = fixture();
  const result = capture([
    'distill', '--repo', repo,
    '--for', 'scripts/src/lib/cli.ts', 'docs/index.md',
  ]);

  assert.strictEqual(result.code, 2);
  assert.strictEqual(result.out, '');
  assert.strictEqual(result.err, 'distill: unexpected argument: docs/index.md\n');
});
```
- [ ] `npm run ci`가 통과하는지 확인한다.
