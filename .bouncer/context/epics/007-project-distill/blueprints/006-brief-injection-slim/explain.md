---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/007-project-distill/blueprints/006-brief-injection-slim/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-24T14:32:10.096+09:00'
bouncer:
  id: EXPLAIN-006
  epic_id: '007'
  blueprint_id: '006'
  status: published
  comprehension:
    - range_from: develop
      range_to: bf0826243a806ee1e2405f0796ca6fbcb0fd2da8
      diff_sha: 3bea0560aed26a253560d9a1c1c53dd142b4f8845896e558a44fd83a36e29e93
      quiz_score: 3/4
      disposition: 문항 1만 오답(scale을 포인터 파일에 저장한다고 봄). 마감은 점수와 무관하게 진행함.
      recorded_at: '2026-08-24T14:40:00+09:00'
---
# Explain

## Background
`/bouncer-execute`가 경량 분기를 고르려고 blueprint `index.md`를 두 번 열었다. `bouncer.scale` 한 필드 때문에 본문 전체를 읽었고, task 브리프에는 구현자가 쓰지 않는 `scope_evidence`와 같은 변경의 다섯 겹 진술이 붙어 있었다. 이 사이클은 포인터 응답에 `scale`을 파생값으로 실어 execute가 `index.md`를 다시 열지 않게 하고, 브리프 주입에서 `scope_evidence`를 빼며, `spec-authoring`에 description·commit_intent·Checklist 역할 경계를 적어 진술을 세 겹으로 줄인다.

## Intuition
권한과 SSOT는 문서에 두고, 런타임은 호출 시점에 필요한 값만 나른다.

## Code
- `scripts/src/lib/current.ts` — `presentCurrent`가 `readBlueprintScale`으로 `index.md`의 `bouncer.scale`을 읽고, task 유무 두 분기 모두에 최상위 `scale`을 싣는다. 읽기·파싱 실패와 비문자열은 `null`. enum 검사는 하지 않는다. 포인터 파일 JSON은 `{ blueprint, task?, base }` 그대로다.
- `scripts/lib/current.js` — 같은 emit.
- `skills/bouncer-execute/SKILL.md` — step 3·5 경량 분기는 `bouncer current`의 `scale`만 본다. step 1은 `bouncer.scope_evidence`를 읽기·주입에서 제외하고, 문서는 G4용으로 남긴다.
- `skills/spec-authoring/SKILL.md`와 `skills/spec-authoring/references/tasks.md` — `description`은 Goal 첫 문장에서 유도, `commit_intent`는 커밋 메시지 전용, Checklist는 Touch 경로를 다시 적지 않는다.
- 계약: `test/cli-current.test.js`, `test/skill-bouncer-execute.test.js`, `test/lightweight-cycle.test.js`, `test/skill-spec-authoring.test.js`. CLI 한 줄은 `docs/cli.md`.

## Quiz
1. `bouncer current`의 `scale`은 어디에 저장되는가?
   - A) 포인터 파일 JSON에 `scale` 키로 저장한다
   - B) 저장하지 않는다. `presentCurrent`가 호출 때 `index.md`에서 파생한다
   - C) `config.json`의 `scale` 필드를 읽는다
2. execute 경량 분기는 무엇을 근거로 `light`를 판정하는가?
   - A) step 3·5에서 blueprint `index.md`를 다시 연다
   - B) Distill `core` shard의 `bouncer.scale` 문장
   - C) step 1에서 받은 `bouncer current`의 `scale`
3. `scope_evidence`는 execute 이후 문서에서 어떻게 다루는가?
   - A) task 문서에서 삭제한다
   - B) 문서는 남기고, step 1 읽기·주입에서만 제외한다
   - C) G4가 더 이상 읽지 않으므로 프론트매터에서 뺀다
4. `spec-authoring`이 `description`에 대해 정한 규율은?
   - A) OKF 필드이므로 비워도 된다
   - B) `## Goal & intent` 첫 문장에서 유도하고, 같은 내용을 두 번 쓰지 않는다
   - C) Checklist에 Touch 경로를 다시 적어 교차 검증한다

## 이해 상태
- 점수: 3/4. 문항 1 오답, 2–4 정답.
- 정답: 1-B, 2-C, 3-B, 4-B.
- 응답: 1-A, 2-C, 3-B, 4-B.
- 문항 1: `scale`은 포인터 파일에 넣지 않고 `presentCurrent`가 호출마다 `index.md`에서 파생한다. 파일에 넣으면 문서 수정 후 stale이 된다.
- disposition: 문항 1만 오답(scale을 포인터 파일에 저장한다고 봄). 마감은 점수와 무관하게 진행함.

## Tasks

### Task 001

#### Goal & intent

`bouncer current` 응답에 blueprint `bouncer.scale` 파생값을 실어, `/bouncer-execute`가 경량 분기를 판정할 때 blueprint `index.md`(평균 451 단어)를 열지 않게 한다. 판정 지점은 step 3·step 5 두 곳으로 남고, 없어지는 것은 그 두 곳의 blueprint 문서 읽기다.

SSOT는 blueprint `index.md`로 유지한다. 포인터 파일 JSON(`{ blueprint, task?, base }`)은 바꾸지 않는다 — `scale`은 `presentCurrent`가 호출 시점에 다시 계산하는 응답 전용 파생값이라, 포인터 파일에 저장하면 문서 수정 후 stale해진다.

#### Interface

- 제공: `presentCurrent`가 반환하는 객체에 최상위 `scale` 키가 생긴다. 값은 `current.blueprint`의 `index.md`에서 읽은 `bouncer.scale` 문자열이고, `bouncer current` / `--set` 두 출력 경로 모두에 실린다.
- 제공: `skills/bouncer-execute/SKILL.md`의 두 경량 분기가 「blueprint `index.md`의 `bouncer.scale`」 대신 「포인터(`bouncer current`)의 `scale`」을 근거로 적힌다.
- 거부: blueprint `index.md`가 없거나 파싱 불가하거나 `bouncer.scale`이 문자열이 아니면 `scale: null`이다. 예외를 던지지 않고 포인터도 지우지 않는다 — `task` id 해석 실패와 같은 처리다.
- 거부: `scale` 값의 enum 검사를 여기서 하지 않는다. `SCALE_ENUM` 판정은 S20의 몫이고, 알 수 없는 값도 읽은 그대로 노출한다.
- 거부: 포인터 파일 스키마에 `scale`을 저장하지 않는다.

#### Touch

- Modify `scripts/src/lib/current.ts` — `presentCurrent`가 blueprint `index.md`를 읽어 `scale`을 파생하고 두 반환 분기(task 있음/없음) 모두에 싣는다
- Modify `scripts/lib/current.js` — `npm run build`가 만드는 CJS emit. 소비자는 Node 전용이라 커밋 대상이다
- Modify `test/cli-current.test.js` — 페이로드 `deepStrictEqual` 단언 세 곳(`:148`·`:161`·`:288`)에 `scale`을 넣고, 문서 부재 시 `null`인 케이스를 추가한다
- Modify `skills/bouncer-execute/SKILL.md` — step 3·step 5의 경량 분기 근거를 포인터 `scale`로 바꾼다
- Modify `test/skill-bouncer-execute.test.js` — 두 분기가 포인터를 근거로 적혔다는 계약을 고정한다
- Modify `test/lightweight-cycle.test.js` — `:54`가 `skills/bouncer-execute/SKILL.md`에 `bouncer.scale` 또는 `scale: light` 리터럴을 요구한다. 분기 문장을 고치면 이 단언이 함께 걸린다
- Modify `docs/cli.md` — `bouncer current` 행의 출력 설명에 `scale`을 적는다

#### Constraints

- 포인터 파일 형식은 바뀌지 않는다. 기존 포인터 파일이 재작성 없이 그대로 읽혀야 한다.
- `presentCurrent`는 예외를 던지지 않는다. 문서 읽기 실패는 모두 `null`로 흡수한다.
- 하위 호환 별칭(`blueprintScale` 등)을 두지 않는다.
- 새 런타임 의존성을 넣지 않는다 — 문서 읽기는 이미 있는 `readDoc`을 쓴다.
- 공개 문자열과 코드 주석은 한국어를 유지한다.

### Task 002

#### Goal & intent

`/bouncer-execute` step 1이 task 브리프를 읽을 때 `bouncer.scope_evidence`를 주입 대상에서 제외한다고 `skills/bouncer-execute/SKILL.md`에 명시한다. 이 값의 용도는 계획 근거 감사이고 소비자는 `graphify-runner`(작성), G4(`validate-gates`), `context-review`(대조) 셋뿐이다 — execute 경로에는 소비자가 없다.

문서에서 지우지 않는다. `affected_paths`가 권한의 SSOT이고 `suggested_paths`는 그 근거일 뿐이므로, 브리프를 읽는 쪽에서만 뺀다. task당 ≈60 단어다.

step 3·4의 named 디스패치는 이미 「only these task-brief sections … Goal & intent, Interface, Touch, Do not touch, Constraints, Checklist」로 프론트매터를 제외하고 있다. 빠져 있는 것은 컨트롤러 자신의 step 1 읽기다.

#### Interface

- 제공: step 1의 **Task brief** 문단에 `bouncer.scope_evidence`를 읽기·주입 대상에서 제외한다는 문장이 생기고, 제외 이유(계획 근거 감사 전용, G4 입력으로 문서에는 남음)를 함께 적는다.
- 거부: `scope_evidence`를 문서에서 삭제하거나 G4 판정을 바꾸지 않는다.
- 거부: `affected_paths`·`verify`·`commit_intent` 등 다른 프론트매터 필드를 제외 목록에 넣지 않는다 — 이번 제외는 `scope_evidence` 하나다.

#### Touch

- Modify `skills/bouncer-execute/SKILL.md` — step 1 Task brief 문단에 `scope_evidence` 주입 제외 문장을 넣는다
- Modify `test/skill-bouncer-execute.test.js` — 그 제외 문구를 계약으로 고정한다

#### Constraints

- 문장 추가만 한다. step 1의 기존 브리프 해석 규칙(`current.task.path` 우선, `task`가 `null`이면 리졸버의 첫/단일 문서)은 바뀌지 않는다.
- 계약 테스트는 문구를 정규식으로 고정하되, 금지 문구 자체를 부재 단언으로 검사하지 않는다.
- 공개 문자열은 한국어를 유지한다.

### Task 003

#### Goal & intent

`spec-authoring`에 역할 경계 세 줄을 넣어, 같은 변경이 한 `tasks.md` 안에서 다섯 번(`title`·`description`·`commit_intent`·`Goal & intent`·`Interface` 제공) 진술되는 것을 세 번으로 줄인다. `## Goal & intent`가 브리프 서술의 SSOT다.

`tasks.md`는 사후 서술이 아니라 사전 계약이고 게이트가 집행하므로 일정 수준의 재진술에는 방어적 가치가 있다. 전부 없애는 것이 아니라 다섯 겹을 세 겹으로 줄인다. 게이트가 검사하는 것은 섹션 존재와 `affected_paths`이지 진술 횟수가 아니므로 G10·G11 계약은 그대로다. task당 ≈100–150 단어가 준다.

#### Interface

- 제공: `spec-authoring` tasks 절에 세 규칙이 생긴다 — (1) `description`은 `## Goal & intent` 첫 문장에서 유도하고 같은 내용을 두 번 작성하지 않는다, (2) `commit_intent`는 커밋 메시지 생성 전용이며 브리프 서술과 겹치면 `## Goal & intent`가 SSOT다, (3) `## Checklist`는 `## Touch`의 경로를 다시 열거하지 않고 절차만 담는다.
- 제공: `skills/spec-authoring/references/tasks.md` 예시가 그 규율대로 다시 쓰인다 — 특히 `description`이 Goal 첫 문장에서 유도되고 Checklist가 Touch 경로를 재열거하지 않는다.
- 거부: `description`을 비우거나 삭제하지 않는다. OKF 필수 필드이고 scaffold가 소유한다 — 규율은 "사람이 두 번 쓰지 않는다"이지 "값이 없어도 된다"가 아니다.
- 거부: `commit_intent`의 형식 계약(정확히 두 개의 한국어 `~함`/`~임` 줄, task 문서 전용)을 바꾸지 않는다.
- 거부: G10의 필수 섹션 목록(full 5개 / light 3개)을 바꾸지 않는다.

#### Touch

- Modify `skills/spec-authoring/SKILL.md` — tasks 절 Section-specific rules에 역할 경계 세 규칙을 넣는다
- Modify `skills/spec-authoring/references/tasks.md` — 예시 문서를 그 규율대로 다시 쓴다
- Modify `test/skill-spec-authoring.test.js` — 세 규칙의 문구를 계약으로 고정한다

#### Constraints

- 규칙은 `spec-authoring` 한 곳에만 둔다. 마스터 규칙이나 `bouncer-plan`에 본문을 복제하지 않는다.
- 예시 문서(`references/tasks.md`)는 계속 유효한 full task여야 한다 — 여섯 섹션이 모두 남는다.
- 계약 테스트는 금지 문구 자체를 부재 단언으로 검사하지 않고, 규칙 문장을 긍정 매치로 고정한다.
- 공개 문자열은 한국어를 유지한다.
