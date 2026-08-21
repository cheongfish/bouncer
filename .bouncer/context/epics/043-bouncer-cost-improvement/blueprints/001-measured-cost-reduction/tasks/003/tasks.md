---
type: bouncer.tasks
title: benchmark worktree 저장소 인식 수정
description: collect_metrics가 .git 파일을 가진 linked worktree도 Git 저장소로 받게 한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-21T20:32:39.490+09:00'
bouncer:
  id: TASKS-003
  epic_id: '043'
  blueprint_id: '001'
  status: verified
  commit_intent:
    - 측정기와 자체 프로토콜의 worktree 계약이 첫 저장소 검사에서 충돌했음
    - 파일과 디렉터리인 .git 표현을 모두 Git 저장소로 인식하게 함
  verify: npm run ci
  affected_paths:
    - skills/agentic-code-benchmark/scripts/collect_metrics.py
    - test/skill-agentic-code-benchmark.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-21T20:41:35.000+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/034-agentic-benchmark
      - .bouncer/context/epics/023-worktree-layout
      - .bouncer/context/epics/038-distill-worktree-base
    basis:
      - graph: source
        status: reused
        query: agentic code benchmark collect_metrics git worktree repository test
        result: '60 hits; query broadened to test CLI fixtures under test/'
      - graph: context
        status: updated
        query: agentic code benchmark collect_metrics git worktree repository test
        result: '12 hits; epics 034, 023, 038 explain documents'
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
`collect_metrics.py --repo`가 `.git` 디렉터리인 clone과 `.git` 파일인 linked worktree를 모두 Git 저장소로 인정하게 한다. 포인터 공유 때문에 Bouncer on-arm 측정은 계속 독립 clone을 사용한다.

## Interface
- 제공: repo root 아래 `.git`이 파일 또는 디렉터리로 존재하면 기존 측정 흐름으로 진행한다.
- 거부: `.git`이 존재하지 않는 경로는 기존 argparse 오류로 거절한다. 임의 하위 디렉터리나 bare repository 지원은 추가하지 않는다.

## Touch
- Modify `skills/agentic-code-benchmark/scripts/collect_metrics.py` — 저장소 판정을 `os.path.exists`로 바꾼다.
- Modify `test/skill-agentic-code-benchmark.test.js` — `.git` 파일·디렉터리 수용과 부재 거절을 CLI 수준에서 단언한다.

## Do not touch
- `skills/agentic-code-benchmark/scripts/scorecard.py` — 점수 계산은 관련 없다.
- `scripts/src/lib/runtime-state.ts` — 포인터 격리는 Task 004의 문서화 대상이다.

## Constraints
- Python 표준 라이브러리만 사용한다.
- `collect_metrics.py`의 CLI 인자와 출력 스키마를 바꾸지 않는다.
- 이 수정은 worktree를 측정할 수 있게 할 뿐 Bouncer on-arm 병렬 실행을 허용하지 않는다.

## Checklist
- [ ] `.git` 파일인 임시 repo가 저장소 판정을 통과하고 이후 Git 명령 단계까지 진행하는 실패 테스트를 추가한다.
- [ ] `.git` 디렉터리는 계속 통과하고 `.git` 부재는 같은 argparse 오류로 실패함을 단언한다.
- [ ] `os.path.isdir(os.path.join(repo, ".git"))`를 `os.path.exists(...)`로 교체한다.
- [ ] `python3 skills/agentic-code-benchmark/scripts/collect_metrics.py --help`가 통과한다.
- [ ] `npm run ci`가 통과한다.
