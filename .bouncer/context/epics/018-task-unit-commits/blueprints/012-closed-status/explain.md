---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/018-task-unit-commits/blueprints/012-closed-status/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-08T14:06:31.362+09:00'
bouncer:
  id: EXPLAIN-012
  epic_id: '018'
  blueprint_id: '012'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: 2cb1f7e4643b6f4e924225e4a86fb7dd69c21924
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/3'
      disposition: 잠금 판정이 out-of-scope 검사보다 먼저인지 헷갈림. 점수가
        낮아도 기록만 하고 마감을 막지 않음(explain-diff 스킬 지침).
      recorded_at: '2026-08-08T14:10:02+09:00'
    - task: '002'
      range_from: 2cb1f7e4643b6f4e924225e4a86fb7dd69c21924
      range_to: fe1b8025e089e7e65c7f1b279082b4f1b86f1e68
      diff_sha: cf0d0d6ed2fc11f8526c03a32969d17b989513a4cf6581bfbf81add96ddc674f
      quiz_score: '2/3'
      disposition: '`index.md` 부재·파싱 실패를 차단으로 오해함. 잠금 판정은
        확신할 때만 막고 나머지는 기존 경로로 흘린다는 점을 기록해 둠.'
      recorded_at: '2026-08-08T14:22:00+09:00'
---
# Explain

## Background
`finalize`는 커밋과 포인터 정리만 하고 blueprint `index.md`의 status는 건드리지
않았다. 그래서 마감된 blueprint와 아직 작업 중인 blueprint를 문서만 보고 구분할
수 없고, 마감된 단위에 새 task를 계속 붙이는 일도 막히지 않았다. 이 blueprint는
수명주기에 `closed` 상태를 더해(001) 마감 시점에 그 도장을 찍고, 그 도장을 읽어
새 task 스캐폴드를 거절한다(002). 잠금을 만드는 쪽과 읽는 쪽을 나눠 커밋한다.

## Intuition
blueprint 문서에 "마감" 도장을 하나 만들고(001), 그 도장이 찍힌 문서에는 새 task
서류를 아예 접수하지 않는다(002). 접수 창구가 거절할 때는 "새 blueprint를 여세요"
라고 알려 준다.

## Code
- `scripts/src/lib/schema.ts` — `STATUS_ENUM['bouncer.blueprint']`에 `closed`
  추가.
- `scripts/src/lib/finalize.ts` — `resolveLockTarget` / `closedLockPath` /
  `writeClosedLock` / `mergeLocked` 헬퍼. out-of-scope 검사 다음에 잠금을
  판정하고 stage 목록에 합류시키는 순서가 핵심.
- `scripts/src/lib/validate.ts` — G2 판정이 status별로 문구를 분기하는 지점.
- `scripts/src/lib/scaffold.ts` — `isClosedBlueprint`와 `scaffoldTask` 진입부
  가드. 파일을 쓰기 전에 throw해야 `tasks/<NNN>/` 잔해가 남지 않는다. `cli.ts`는
  손대지 않고 기존 catch가 `scaffold: <메시지>` + exit 2를 낸다.
- `test/finalize.test.js`, `test/schema.test.js`, `test/validate-gates.test.js`,
  `test/current.test.js` — 잠금 전이·dry-run·재실행 멱등·G2 문구 분기·
  `listReadyBlueprints` 제외 회귀.
- `test/scaffold.test.js` — 잠긴 blueprint 거절·CLI exit 2·비잠금 상태 통과·
  `index.md` 부재/파싱 실패 통과 회귀.

## Quiz
1. `finalize({ yes: false })`를 blueprint가 아직 `approved`일 때 부르면
   `closed` 필드와 실제 파일에는 각각 무슨 일이 생기나?
   - A) `closed`에 잠글 경로가 담기고, 파일은 그대로다
   - B) `closed`가 `null`이고, 파일은 이미 잠긴다
   - C) `closed`에 잠글 경로가 담기고, 파일도 즉시 `closed`로 바뀐다
2. 이미 `bouncer.status`가 `closed`인 blueprint에 `--yes`로 다시 finalize를
   부르면 `res.closed`는 무엇이 되나?
   - A) 다시 잠긴 경로 문자열
   - B) `null`
   - C) 에러를 던진다
3. out-of-scope 위반이 있는 실행에서 잠금 판정은 언제 일어나나?
   - A) out-of-scope 검사보다 먼저 잠금부터 판정한다
   - B) out-of-scope 검사를 통과한 뒤에만 잠금을 판정한다
   - C) 위반이 있어도 잠금은 그대로 기록하고 반환에는 반영하지 않는다

### task 002 (`2cb1f7e..fe1b802`)
1. 잠긴 blueprint에 `bouncer scaffold task`를 걸었을 때 거절은 어디서 일어나나?
   - A) `cli.ts`에 잠금 전용 분기를 넣어 stderr 출력과 exit 2를 직접 낸다
   - B) `scaffoldTask`가 파일을 쓰기 전에 throw하고 `cli.ts`의 기존 catch가
     `scaffold: <메시지>` + exit 2로 옮긴다
   - C) 문서는 만들어지고 이후 plan 게이트 G2가 잡아 낸다
2. 대상 blueprint의 `index.md`가 없거나 프론트매터 파싱에 실패하면
   `scaffoldTask`는 어떻게 하나?
   - A) 상태를 모르니 throw해서 막는다
   - B) `tasks/<NNN>/`만 만들고 멈춘다
   - C) 잠금 판정을 하지 않고 기존대로 scaffold를 진행한다
3. `scripts/lib/scaffold.js`는 이번 변경에서 어떻게 갱신됐나?
   - A) `scripts/src/**`만 고치고 `npm run build`(pretest)로 CJS emit을 다시 구웠다
   - B) `.ts`와 `.js`를 각각 손으로 같은 내용으로 고쳤다
   - C) commit-safety 훅이 커밋 시점에 emit을 만들어 준다

## 이해 상태

### task 001
- 문항 1 정답: A — 사용자 응답: A — 정오: 정답
- 문항 2 정답: B — 사용자 응답: B — 정오: 정답
- 문항 3 정답: B — 사용자 응답: A — 정오: 오답
- `quiz_score`: 2/3
- disposition: 잠금 판정이 out-of-scope 검사보다 먼저인지 헷갈림. 점수가
  낮아도 기록만 하고 마감을 막지 않음(explain-diff 스킬 지침).

### task 002
- 문항 1 정답: B — 사용자 응답: B — 정오: 정답
- 문항 2 정답: C — 사용자 응답: A — 정오: 오답
- 문항 3 정답: A — 사용자 응답: A — 정오: 정답
- `quiz_score`: 2/3
- disposition: `index.md` 부재·파싱 실패를 차단으로 오해함. 잠금 판정은 확신할
  때만 막고 나머지는 기존 경로로 흘린다는 점을 기록해 둠.
