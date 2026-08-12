---
type: bouncer.blueprint
title: 이해 기록 finalize 이관과 commit 스코프 게이트
description: comprehension을 BP 단일 엔트리로 축소하고 commit 게이트를 G17 스코프 검사로 재정의한다
resource: .bouncer/context/epics/029-gate-restructure/blueprints/001-comprehension-gate-move/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-12T11:14:29.559+09:00'
bouncer:
  id: '001'
  epic_id: '029'
  blueprint_id: '001'
  status: closed
  commit_type: refactor
  commit_intent:
    - task마다 반복되던 이해 기록과 퀴즈가 blueprint 단위 확인 한 번으로 줄어듦
    - 커밋 직전 스테이징 범위를 게이트가 직접 보게 되어 훅 우회 경로가 막힘
---
# 001 comprehension-gate-move

Epic: [029](../../index.md)

## Intent
- 문제: `explain.md` 이해 기록이 task 커밋마다 걸려 있고, commit 게이트(G15)는
  그 기록만 본다. 정작 스테이징 범위 검사는 게이트 밖 훅에만 있다.
- 완료 조건: commit 게이트가 포인터 task 상태와 스테이징 스코프를 보고,
  이해 기록 판정은 finalize G16 하나로 모인다.

## Contract
- 인터페이스:
  - `comprehension.findComprehensionEntry(comprehension, taskNumber)` →
    `resolveComprehensionEntry(comprehension)`. task 번호 인자를 받지 않고
    배열의 **마지막** 엔트리 하나를 blueprint 엔트리로 돌려준다.
    반환 `{ ok: true, entry }` 또는
    `{ ok: false, reason: 'not-a-list' | 'missing' | 'incomplete' }`.
    `duplicate`는 사라진다 — 엔트리가 여럿인 0.7 문서가 정상 입력이 된다.
    필수 필드는 `range_from`·`diff_sha`·`disposition`·`quiz_score`이고, 하나라도
    비면 `incomplete`이다.
  - 신규 `scripts/src/lib/scope.ts` — `isUnder`, `RUNTIME_ARTIFACTS`,
    `isRuntimeArtifact`, `makeAllowed`를 `finalize.ts`에서 옮겨 담는다.
    `validate.ts`가 `finalize.ts`를 require하면 순환이 되므로 필요한 이동이다.
  - `checkGate(..., { gate: 'commit' })`가 `deps.stagedFiles`(주입 가능)로
    스테이징 목록을 읽는다. 기본 구현은 `git diff --cached --name-only`이며
    실패는 예외가 아니라 G17 failure로 보고한다.
- 데이터·상태: `explain.md` `bouncer.comprehension`은 여전히 배열이다. 새로
  쓰는 문서는 엔트리 하나이고 `task` 필드를 쓰지 않는다. `quiz_score`가 필수
  필드로 올라간다. `## 이해 상태` 본문은 task별 소제목 없는 단일 블록이다.
- 수용 기준: 에픽 성공 기준 1–8.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 퀴즈 이후 finalize 중 커밋이 더 쌓여 `diff_sha`가 어긋나는 경우 — G16
    hard fail이고, 요구하는 것은 explain 본문과 해시 갱신뿐이다. 퀴즈를 다시
    보게 만들지 않는다.
  - `range_from`이 가리키는 커밋이 없거나 저장소가 아닌 경우 — 해시 불일치와
    구분되는 계산 실패 메시지로 G16을 낸다.
  - 스테이징이 비어 있는 커밋 — G17은 통과다. 빈 커밋 방지는 `bouncer commit`
    의 몫이지 게이트가 아니다.
  - 스테이징에 `.bouncer/context/` 문서와 blueprint 디렉터리가 섞이는 정상
    경로 — `makeAllowed`가 이미 허용하므로 G17이 걸리면 안 된다.
  - `graphify-out/`·`node_modules/` 같은 런타임 산출물이 스테이징에 잡힌
    경우 — `isRuntimeArtifact`로 걸러 G17 위반으로 보고하지 않는다.
  - 엔트리가 0개인 갓 scaffold한 `explain.md` — 해시 불일치가 아니라 기록
    없음으로 판정한다.

## Out of scope
- `/bouncer-run`·`autonomy`·context reviewer(G18)·`bouncer_schema` — 에픽
  Out of scope 그대로.
- `bouncer commit` / `bouncer finalize` 명령의 스테이징·커밋 동작 변경. G17은
  같은 판정을 게이트에서 한 번 더 하는 것이지, 커밋 경로를 바꾸지 않는다.
- `hooks/commit-safety.js` 제거. 훅은 게이트 밖 조기 경고로 남긴다.
- 퀴즈 문항 수 규칙(`bouncer.scale: light` → 1문항) 변경.

## One-commit justification
- 한 커밋이 아니라 세 개다. 게이트 계약(comprehension·G16), commit 게이트
  재정의(G17), 워크플로 문서·스킬 이동은 각각 되돌릴 수 있는 단위이고, 앞의
  둘은 코드 계약이라 스킬 산문과 섞으면 리뷰가 흐려진다. blueprint는 그대로
  PR 하나다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - comprehension 단일 엔트리 계약과 G16 diff_sha 흡수
* [Tasks 002](tasks/002/tasks.md) - commit 게이트 재정의와 G17 스코프 검사
* [Tasks 003](tasks/003/tasks.md) - explain·퀴즈 단계의 finalize 이관과 문서 갱신
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
