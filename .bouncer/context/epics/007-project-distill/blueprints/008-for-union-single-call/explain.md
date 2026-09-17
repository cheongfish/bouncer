---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/008-for-union-single-call/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T11:43:08.245+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '007'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: a752e5ff1350070a6dde664e6bf8b7192f95c613
      diff_sha: 60ad681c63f6deff857e0ddc199e7c2ec282d45d20c7779374f8872f8b390da4
      quiz_score: 2/2
      disposition: 반복 --for의 합집합과 중복 제거 계약을 이해함
      recorded_at: '2026-08-27T11:46:50+09:00'
---
# Explain

## Background
재접지 지시가 확정 경로마다 `bouncer distill --for`를 따로 실행하게 해 `always` 샤드와 공통 `pulls` 본문을 같은 회차에 여러 번 주입했다. CLI는 반복 `--for` 플래그를 받아 선택 결과를 합집합으로 만들고 중복 샤드를 한 번만 렌더링한다. 이 blueprint는 그 동작을 테스트로 고정한 뒤, 네 workflow 문서와 core Distill 결정을 한 번의 호출 방식으로 맞췄다.

## Intuition
여러 장의 규칙 묶음을 따로 배달하지 않고, 필요한 묶음의 합집합을 한 상자에 담아 한 번만 전달하는 변경이다.

## Code
- `test/cli-project-commands.test.js`는 반복 `--for`의 ids 순서, 공통 shard 중복 제거, 잘못된 bare path 거부를 고정한다.
- `CLAUDE.md`, `skills/bouncer-plan/SKILL.md`, `skills/bouncer-execute/SKILL.md`, `skills/bouncer-run/SKILL.md`는 재접지 호출을 한 번으로 지시한다.
- `.bouncer/distill/core.md`는 런타임 결정에 같은 호출 형태를 남기고, `test/master-rules.test.js`는 다섯 문서에서 경로별 반복 문구가 돌아오지 않게 막는다.

## Quiz
1. 여러 확정 경로를 재접지할 때 올바른 CLI 형태는 무엇인가?
   - A) `bouncer distill --for a b --repo "${PROJECT_ROOT}"`
   - B) `bouncer distill --for a --for b --repo "${PROJECT_ROOT}"`
   - C) 경로마다 `bouncer distill --for <path>`를 따로 실행함

2. 반복 `--for` 테스트가 공통 shard를 확인하는 이유는 무엇인가?
   - A) 모든 shard를 `--all`처럼 강제로 선택하려고
   - B) 경로 입력 순서를 정렬하려고
   - C) 두 경로가 같은 shard로 라우팅되어도 본문과 ids가 중복되지 않음을 보이려고

## 이해 상태
정답은 1-B, 2-C이며 응답도 1-B, 2-C였다. 반복 `--for`는 여러 경로의 선택 결과를 한 번에 합치고, 같은 shard가 겹쳐도 ids와 본문을 중복하지 않는다. 점수는 2/2로 기록했다.

## Tasks

### Task 001

#### Goal & intent

`bouncer distill`이 `--for`를 여러 번 받았을 때 선택 결과의 합집합을 내고 겹치는 샤드 본문을 한 번만 출력한다는 것을, 테스트가 단정한다. 지금은 `scripts/src/lib/cli-project-commands.ts`의 `targets.push(value)` 누적으로 동작만 있고 단언이 없어서, 이 동작이 깨져도 붉어지는 테스트가 없다. task 002는 이 단언을 근거로 재접지 지시를 단일 호출로 바꾼다.

#### Interface

- 제공: `--for`를 두 번 지정한 호출이 `payload.ids`를 두 경로 선택의 합집합으로 내고, 두 선택에 공통인 샤드를 `content`에 한 번만 담는다. 같은 샤드로 라우팅되는 경로 두 개를 넘기면 `ids`가 늘어나지 않는다.
- 거부: `--for` 값 뒤에 플래그 없이 경로를 이어 쓰면 종료 코드 2, stdout 빈 문자열, stderr `distill: unexpected argument: <path>\n`.

#### Touch

- Modify `test/cli-project-commands.test.js` — 다중 `--for` 합집합·중복 제거와 플래그 없는 경로 나열 거부를 단정하는 `test(...)` 블록 두 개를 더한다.

#### Constraints

- 기존 `seedDistill` 픽스처(`core`는 `always`, `source`는 `scripts/**`, `docs`는 `docs/**`, `source`는 `core`를 `pulls`)를 그대로 쓴다. 새 픽스처 헬퍼나 샤드를 만들지 않는다.
- `ids` 단언은 `assert.deepStrictEqual`로 배열 순서까지 고정한다. 순서를 무시하는 집합 비교로 완화하지 않는다.
- 파일 안 기존 `distill` 테스트의 이름과 순서는 건드리지 않고 새 블록으로만 더한다.
- 이 task는 이미 있는 동작을 기록하는 특성화 테스트다. 실패를 먼저 만들기 위해 구현을 되돌리거나 단언을 일부러 틀리게 두지 않는다.

### Task 002

#### Goal & intent

재접지를 지시하는 네 문서와 `.bouncer/distill/core.md`가 확정 경로 전부를 `--for` 반복 지정으로 한 번에 넘기라고 지시한다. 지금은 경로마다 따로 부르라고 쓰여 있어 `always` 샤드와 공통 `pulls`가 경로 수만큼 반복 주입된다. 바뀌는 것은 호출 횟수뿐이고, 선택 알고리즘·출력 포맷·`--all` baseline 계약은 그대로다. 마지막으로 `test/master-rules.test.js`가 다섯 문서에서 경로별 반복 문구가 되살아나지 못하게 잠근다.

#### Interface

- 제공: 다섯 문서가 모두 `bouncer distill --for` 를 확정 경로 수와 무관하게 한 번 부르라고 지시하고, 다섯 모두 본문에 `--for` 를 두 번 이상 쓴 형태를 담는다. `skills/bouncer-plan/SKILL.md`은 아래 셸 블록을 싣고, 나머지 넷은 `--for <path-1> --for <path-2>` 를 문장 안에 인라인으로 적는다 — 두 `--for` 사이가 160자를 넘지 않아야 잠금 테스트가 잡는다.
```bash
node "${BOUNCER_ROOT}/scripts/bouncer" distill \
  --for <path-1> \
  --for <path-2> \
  --repo "${PROJECT_ROOT}"
```
- 거부: 다섯 문서 어디에도 「once per … path」·「once for each … path」·「경로마다 한 번」 형태가 남지 않는다. 플래그 뒤에 경로를 나열하는 `--for a b` 형태를 예시로 쓰지 않는다 — CLI가 종료 코드 2로 거절한다.

#### Touch

- Modify `CLAUDE.md` — 하드룰 7의 재접지 문장을 단일 호출로 바꾼다.
- Modify `skills/bouncer-plan/SKILL.md` — step 6 「Distill re-ground」 문장을 단일 호출로 바꾸고 플래그 반복형 셸 예시를 싣는다.
- Modify `skills/bouncer-execute/SKILL.md` — 「Project Distill」 절의 재접지 문장을 단일 호출로 바꾼다.
- Modify `skills/bouncer-run/SKILL.md` — 「Project Distill」 절의 재접지 문장을 단일 호출로 바꾼다.
- Modify `.bouncer/distill/core.md` — Decisions의 `re-ground with bouncer distill --for <path>` 문장을 합집합 단일 호출로 바꾼다.
- Modify `test/master-rules.test.js` — 다섯 문서에 경로별 반복 문구가 없고 반복 플래그 형태가 있다는 `test(...)` 블록을 더한다.

#### Constraints

- `.bouncer/distill/core.md`는 등록 샤드라 `scope.makeAllowed`가 자동으로 열어 주지 않는다. `affected_paths`에 명시된 상태로만 커밋된다.
- `test/master-rules.test.js:126,131,135,141,149,151,184`의 기존 단언은 이 문구 변경 뒤에도 그대로 성립한다. 지우거나 완화하지 말고 새 블록만 더한다.
- 「경로 전부를 한 번에」가 「둘 이상일 때만」을 뜻하지 않는다. 확정 경로가 하나인 회차도 같은 문장으로 성립하게 쓴다.
- 합집합 단일 주입이 `--all` stdout 주입 허용을 뜻하지 않는다. 각 문서의 `--all` baseline 금지 문구와 단일 파일 폴백 문구는 유지한다.
- 다섯 문서 중 `CLAUDE.md`와 세 SKILL, `core.md`는 영어를 유지한다. 이 task에는 한국어 본문 대상이 없다.
- 새 규칙을 `rules/` 정본으로 추출하지 않는다. 그 통합은 epic 054 소관이며, 여기서는 네 곳을 같은 문장으로 맞추기만 한다.
