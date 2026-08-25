---
type: bouncer.tasks
title: 옛 벤치마크 기록을 걷어내고 요약 한 장만 남김
description: docs/benchmark 전량을 지우기 전에 1~3회차 핵심 수치를 history.md 표 하나로 옮긴다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/003-plugin-arm-benchmark/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T11:09:18.849+09:00'
bouncer:
  id: TASKS-001
  epic_id: '050'
  blueprint_id: '003'
  status: verified
  verify: npm run ci
  commit_intent:
    - 1~3회차 기록이 on/off 2 arm 전제로 쌓여 있어 DeepSWE 3 arm 스위트의 출발점이 되지 못했음
    - 수치만 요약 한 장으로 옮기고 나머지 기록을 걷어냄
  affected_paths:
    - docs/benchmark
    - test/lightweight-cycle.test.js
    - README.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T14:10:00+09:00'
    suggested_paths:
      - docs/benchmark
      - test/skill-agentic-code-benchmark.test.js
    basis:
      - graph: source
        status: updated
        query: query 'benchmark metrics collect' (BFS depth=2)
        result: skill-agentic-code-benchmark.test.js만 벤치마크 관련 노드로 나옴 — docs/는 source_dirs(scripts/hooks/test) 밖이라 후보 없음
      - graph: context
        status: updated
        query: query '벤치마크 arm 프로토콜'
        result: 이번에 쓴 003 태스크 문서 자신만 매칭 — 기존 컨텍스트에 벤치마크 문서 노드 없음
---
# Tasks

Blueprint: [003](../../index.md)

## Goal & intent
`docs/benchmark/` 아래 기존 자산 전부(README·protocol·tasks·runs·diffs·
round-2·round-3)를 지운다. 지우기 **전에** 1·2·3회차의 핵심 수치를 뽑아
`docs/benchmark/history.md` 표 하나로 옮긴다. 이 한 장이 이후 회차가 옛
수치를 인용할 유일한 자리이고, Distill `core`의 「Round 3 measured four
documents at 97 lines…」 결정이 가리킬 착지점이다. 완료 판정은 옛 파일이
하나도 남지 않고 `history.md`가 세 회차를 담으며 `npm run ci`가 통과하는
것이다.

## Interface
- 제공:
  - `docs/benchmark/history.md` — 회차별 한 행씩, 열은 회차 · 측정일 ·
    베이스 커밋 · arm 구성 · 시간 배수 · test quality Δ · 계획 문서 줄 수 ·
    on 실격 수 · G18/S9/G4. 값이 그 회차에 없으면 `—`로 두고 지어내지
    않는다.
  - 표 아래에 세 회차가 무엇을 재려던 회차였는지 각 두 줄 이내로 적고,
    상세는 git 히스토리에 있다고 한 줄로 가리킨다.
- 거부:
  - 옛 문서의 서술을 통째로 옮겨 오는 것. 이 파일은 요약이지 아카이브가
    아니다.
  - 원본이 적지 않은 수치를 추정으로 채우는 것. 1회차에는 런별 벽시계가
    없으므로 그 칸은 `—`다.

## Touch
- Delete `docs/benchmark` — README·protocol·tasks·runs·diffs·round-2·
  round-3를 포함한 하위 전체. 새 스위트는 002·003이 같은 경로에 다시 세운다.
- Create `docs/benchmark/history.md` — 위 표와 회차별 두 줄 요약.
- Modify `test/lightweight-cycle.test.js` — `docs/benchmark/protocol.md`가
  「3회차 on arm: light 계약」을 담는지 보는 assert가 삭제로 깨진다. light
  계약 문서 계약을 보는 나머지 assert는 그대로 두고 이 한 줄만 걷어낸다.
- Modify `README.md` — 1회차 on/off 결과표와 「방법·한계·후속 회차는
  docs/benchmark/」 문단이 지워진 문서를 가리키게 된다. 표의 수치는
  `history.md`로 옮기고 본문은 그 한 장을 가리키게 고친다.

## Do not touch
- `.benchmarks/` — gitignore 대상 실행 산출물이고 정본이 아니다.
- `skills/agentic-code-benchmark/` — 하네스 변경은 태스크 003.
- `.bouncer/Distill.md`, `.bouncer/distill/` — 3회차 인용 문장은 이번에
  고치지 않는다. 승격은 finalize 소관이다.
- `CHANGELOG.md` — 발행 시점의 기록이다. 지난 릴리스 항목을 소급해서
  고치지 않는다.

## Constraints
- 수치 추출과 삭제가 한 커밋이다. 삭제를 먼저 하면 같은 커밋 안에서 원본을
  잃는다 — Checklist 순서를 지킨다.
- 표의 모든 숫자는 지워지는 문서에서 그대로 옮긴 값이어야 한다. 다시
  계산하거나 반올림을 바꾸지 않는다.
- 회차 간 수치를 빼서 새 판정을 만들지 않는다. 세 회차는 문서 세트와 계약이
  달라 직접 비교가 성립하지 않는다는 것이 3회차 기록의 결론이다.
- 한국어 본문. 경로·식별자·코드 펜스는 그대로.

## Checklist
- [ ] 삭제 전에 `docs/benchmark/README.md`, `round-2/README.md`,
      `round-3/README.md`, `round-3/runs.md`와 저장소 `README.md`의 1회차
      결과표에서 회차별 수치를 뽑는다. 1회차 토큰(off 202,268 / on 442,061,
      2.19×)과 벽시계(8.7분 / 28.8분, 3.32×)는 저장소 `README.md`에만 있다.
      최소한 다음이 필요하다: 1회차 측정일·베이스 커밋 `3f52018`,
      2회차 시간 배수 `2.80×` / test quality Δ `+1.75` / 실격 `0` /
      G18·S9·G4 `0`, 3회차 시간 배수 `2.13×` / Δ `+2.00` / 계획 문서
      `146~160줄` / 실격 `0` / G18·S9·G4 `0` / `wall_s` 합 `1110` /
      `tool_calls_est` 합 `86`.
- [ ] `docs/benchmark/history.md`를 Interface의 열 구성대로 작성한다.
- [ ] `rm -r`로 `docs/benchmark`의 나머지 전부를 지운다 (`history.md`는
      남긴다). `git rm`은 인덱스를 건드리는데 execute는 커밋하지 않는다 —
      스테이징은 `/bouncer-commit` 소관이다.
- [ ] `ls docs/benchmark`가 `history.md` 하나만 내는지 확인한다.
- [ ] `test/lightweight-cycle.test.js`에서 `docs/benchmark/protocol.md`
      assert 한 줄을 걷어낸다.
- [ ] `README.md`의 1회차 on/off 표를 지우고, 벤치마크 문단이
      `docs/benchmark/history.md`를 가리키며 새 스위트를 준비 중이라고
      한 줄로 적게 고친다.
- [ ] `grep -rn "docs/benchmark/round-\|docs/benchmark/runs\|docs/benchmark/diffs\|docs/benchmark/protocol" docs/ skills/ test/ README.md`
      가 아무것도 내지 않는지 확인한다. 걸리는 파일이 Touch 밖이면 계획으로
      되돌린다.
- [ ] `npm run ci` 통과를 확인한다.
