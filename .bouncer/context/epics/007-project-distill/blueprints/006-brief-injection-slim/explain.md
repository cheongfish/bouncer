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
      quiz_score: '3/4'
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
