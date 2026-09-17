---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/010-finalize-pointer-scope/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-25T12:20:59.805+09:00'
bouncer:
  id: EXPLAIN-010
  epic_id: '009'
  blueprint_id: '010'
  status: published
  comprehension:
    - range_from: develop
      range_to: afcd7ff40ca3e55eccdbfa21c5e42596dc79bf4f
      diff_sha: 4f3174504dc64724085cb52b61ba2145362366ea0c8aeca054e080215a4e076b
      quiz_score: 3/3
      disposition: 세 문항 모두 정답. 필드 이름·draft 인계·후보 조건 유지를 구분함.
      recorded_at: '2026-08-25T12:22:59+09:00'
---
# Explain

## Background
`listReadyBlueprints`는 `approved`이고 열린 task가 있는 blueprint만 고른다. 같은 epic에 `draft`만 남으면 `nextBlueprint`의 `next`가 `null`이 되고, finalize step 6은 인계 확인을 건너뛴다. 사용자는 이 epic이 끝난 줄 알고 남은 계획을 스스로 기억해야 했다.

이 변경은 그 잔여를 `sameEpicPending`으로 페이로드에 싣는다. `--set` 후보 조건은 그대로 두고, 스킬이 그 배열로 `--set`과 `/bouncer-plan` 안내를 가른다.

## Intuition
인계 목록과 `--set` 버튼을 한 필터로 쓰지 않는다. 목록은 같은 epic의 미마감 형제, 버튼은 그 안의 ready 하나다.

## Code
- `scripts/src/lib/current.ts` — `listSameEpicPending`이 같은 epic 형제를 스캔한다. `ready`는 `listReadyBlueprints` 경로 집합으로만 붙인다. 필드 이름은 `blueprintStatus`다. 기존 entry `status`는 첫 열린 task 상태라서 겹치면 안 된다. 자신·`closed`·다른 epic·깨진 `index.md`는 빼고, 경로는 사전순이다.
- `scripts/src/lib/finalize.ts` — `next()` throw 폴백도 `{ next: null, remaining: [], sameEpicPending: [] }`다. 필드가 빠지면 스킬이 `undefined`를 순회한다.
- `skills/bouncer-finalize/SKILL.md` step 6 — `next.next`와 `next.sameEpicPending`을 같이 읽는다. 둘 다 비면 건너뛴다. `--set` 대상은 `next.next.blueprint` 하나다. `draft`와 `ready: false`에는 `--set`을 제안하지 않는다. `sharedPaths`와 leftover worktree 경고는 `next.next`가 있을 때만 읽는다.
- 테스트: `test/current.test.js`, `test/finalize.test.js`, `test/skill-bouncer-finalize.test.js`. emit은 `scripts/lib/current.js`, `scripts/lib/finalize.js`.

## Quiz
1. `sameEpicPending` 원소의 상태 필드 이름이 `status`가 아니라 `blueprintStatus`인 이유는?
   - A) `listReadyBlueprints` entry의 `status`가 첫 열린 task 상태라서 뜻이 다르다
   - B) YAML frontmatter 예약어라서 페이로드에 쓸 수 없다
   - C) G2가 `status` 키를 거부한다

2. 같은 epic에 `draft` 형제만 남고 ready 후보가 없으면 finalize 인계는?
   - A) `next`에 그 draft를 넣고 `--set`을 제안한다
   - B) 인계 확인을 통째로 건너뛴다
   - C) `next`는 `null`이고 `sameEpicPending`만 채운 뒤 `/bouncer-plan`으로 안내한다

3. 이 변경이 `listReadyBlueprints`의 후보 조건을 넓히지 않은 이유는?
   - A) 커버리지 바닥을 맞추려고
   - B) `bouncer current`의 `ready`와 `--set` 자동 선택에 승인 전 blueprint가 새면 안 되어서
   - C) `sharedPaths` 계산이 그 함수 안에 있어서

## 이해 상태
정답: 1A, 2C, 3B. 응답: 1A, 2C, 3B. 세 문항 정답. quiz_score 3/3. disposition: 필드 이름·draft 인계·후보 조건 유지를 구분함.

## Tasks

### Task 001

#### Goal & intent

`nextBlueprint`가 지금은 `--set` 가능한 후보만 돌려주기 때문에, 같은 epic에 아직
`draft`인 blueprint가 남아 있으면 `/bouncer-finalize` step 6의 인계 확인이 통째로
건너뛰어진다. 이 task 뒤에는 `nextBlueprint` 반환에 `sameEpicPending` 배열이 함께
실려, finalize 스킬이 그 값으로 「`--set`을 제안할 형제」와 「`/bouncer-plan`으로
안내할 형제」를 갈라낸다. `listReadyBlueprints`의 후보 조건은 그대로 두므로
`bouncer current`의 `ready` 목록과 `--set` 자동 선택은 달라지지 않는다.

#### Interface

- 제공: `nextBlueprint({ repoRoot, blueprintDir })`의 반환이
  `{ next, remaining, sameEpicPending }`가 된다. `sameEpicPending`은
  `{ blueprint: string, blueprintStatus: string, ready: boolean }`의 배열이며,
  finalize 대상과 같은 epic에 있고 blueprint `bouncer.status`가 `closed`가 아닌
  형제만 담는다. `blueprintStatus`는 그 blueprint `index.md`의 `bouncer.status`
  문자열이고, `ready`는 같은 호출에서 얻은 `listReadyBlueprints` 결과에 그
  blueprint 경로가 있는지로 정한다 — 후보 조건을 새로 구현하지 않는다.
  정렬은 `blueprint` 경로 사전순이다. `next`와 `remaining`의
  모양·정렬·`sharedPaths` 계산은 바뀌지 않는다.
  `finalize`의 `next()` throw 폴백도 `{ next: null, remaining: [], sameEpicPending: [] }`가 된다.
- 거부: finalize 대상 자신, `closed` blueprint, 다른 epic의 blueprint는
  `sameEpicPending`에 담지 않는다. 자기 제외는 기존 `nextBlueprint`와 같이
  정규화 전 문자열과 POSIX 정규화 경로 양쪽(`selfRaw` / `selfPosix`)으로 비교한다.
  `index.md`를 읽을 수 없거나 파싱에 실패한
  형제는 그 항목만 건너뛰고 예외를 던지지 않는다. `sameEpicPending`은 어떤 경우에도
  배열이며 `undefined`가 되지 않는다.

#### Touch

- Modify `scripts/src/lib/current.ts` — 같은 epic 형제를 스캔하는 순수 헬퍼를 더하고
  `nextBlueprint` 반환에 `sameEpicPending`을 싣는다. `listReadyBlueprints`는 건드리지 않고
  `ready` 판정에 그 결과를 재사용한다. 이 파일의 기존 entry `status`는 첫 열린 task의
  상태라서 뜻이 다르므로 새 필드 이름은 `blueprintStatus`다.
- Modify `scripts/src/lib/finalize.ts` — `next()`가 throw할 때의 빈 핸드오프 폴백에
  `sameEpicPending: []`를 더한다.
- Modify `scripts/lib/current.js` — 위 변경의 커밋된 CJS emit. 손으로 고치지 않고 빌드로 갱신한다.
- Modify `scripts/lib/finalize.js` — 같은 이유의 emit 갱신.
- Modify `test/current.test.js` — 반환 전체를 `deepStrictEqual`로 비교하는 두 곳의
  기대값을 새 모양으로 고치고, `sameEpicPending`의 포함·제외·정렬·깨진 형제 케이스를 더한다.
- Modify `test/finalize.test.js` — 폴백 페이로드의 `deepStrictEqual` 기대값을 새 모양으로 고친다.
- Modify `skills/bouncer-finalize/SKILL.md` — step 6이 `sameEpicPending`을 읽어
  `--set` 제안과 `/bouncer-plan` 안내로 갈라지게 쓴다.
- Modify `test/skill-bouncer-finalize.test.js` — 그 분기가 스킬 본문에 있는지 계약으로 잠근다.

#### Constraints

- `listReadyBlueprints`의 후보 조건(`approved` + 열린 task)은 그대로 둔다. 잔여 목록은
  별도 스캔으로 만든다.
- `nextBlueprint`는 순수 계산을 유지한다 — 파일 쓰기, git 호출, 프로세스 실행을 넣지 않는다.
- 새 게이트 번호를 만들지 않고 기존 G/S 코드의 판정을 바꾸지 않는다.
- 스킬 본문에서 `draft` 형제에 대해 `bouncer current --set`을 제안하지 않는다 —
  plan 게이트 G2가 거절하는 명령이다.
- `scripts/lib/*.js`는 손으로 편집하지 않는다. `npm run build`(또는 `pretest`) 산출물만 커밋한다.
- 공개 문자열과 스킬 본문의 한국어를 유지한다.
