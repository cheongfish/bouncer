---
type: bouncer.tasks
title: 측정 프로토콜에 plan 스냅샷과 표본 조항 순서를 넣음
description: 런별 plan-gate 시점 스냅샷 수집 절차와 표본 제외 대 실패 보고의 적용 순서를 확정한다
resource: .bouncer/context/epics/044-finalize-evidence/blueprints/001-promotion-verify/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-22T14:16:25.821+09:00'
bouncer:
  id: TASKS-003
  epic_id: '044'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 3회차가 plan-gate 시점 줄 수를 남기지 못해 100줄 목표를 직접 재지 못함
    - 런별 스냅샷 수집과 표본 조항 적용 순서를 프로토콜에 못박음
  affected_paths:
    - docs/benchmark/protocol.md
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-22T15:05:00+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/037-distill-promotion-consent
      - .bouncer/context/epics/044-finalize-evidence
    basis:
      - graph: source
        status: reused
        query: finalize verify command before staging distill promotion bullet audit test
        result: 3 hits — test/finalize.test.js, test/cli-project-commands.test.js, test/seed-worktree.test.js
      - graph: context
        status: updated
        query: finalize verify distill promotion benchmark protocol
        result: 3 hits under .bouncer/context/epics/037-distill-promotion-consent and 044-finalize-evidence
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
다음 회차를 도는 사람이 `docs/benchmark/protocol.md`만 읽고 두 가지를 할 수 있다.
첫째, 런마다 plan 게이트를 통과한 시점의 계획 문서 줄 수를 남긴다. 3회차는 이걸
남기지 못해(각 실행 clone이 커밋 하나로 squash되고 `.benchmarks/`에도 트리 사본이
없었다) 100줄 목표가 실제로 묻는 값을 재지 못했고, 보고된 값은 사이클 종료 시점
줄 수(146/146/151/160)에서 하네스 몫 25줄을 뺀 파생 대리값 121/121/126/135였다.
둘째, 어떤 런을 표본에서 빼고 어떤 런을 미달로 보고하는지 헷갈리지 않는다.

## Interface
- 제공: `protocol.md`에 절 두 개.
  - 「plan 단계 스냅샷」 — 무엇을 언제 어디에 남기는지. 명령까지 그대로 적는다.
  - 「표본 제외와 실패 보고」 — 두 의무의 적용 순서를 한 문장으로 못박는다.
- 거부: 두 절 모두 판단을 읽는 사람에게 넘기는 표현("적절히", "필요하면")을 쓰지
  않는다. 다음 회차가 같은 자리에서 다시 갈리면 이 task는 실패다.

## Touch
- Modify `docs/benchmark/protocol.md` — 위 두 절을 넣고, 「한계」 절에 3회차 줄 수가
  파생 대리값이라는 항목을 하나 더한다.

## Do not touch
- `docs/benchmark/round-3/`, `docs/benchmark/README.md` — 3회차 기록은 그때의 관측이다.
  소급해서 고치지 않는다.
- `skills/agentic-code-benchmark/` — 벤더링된 도구다. 이번 변경은 이 저장소의 측정
  프로토콜이지 도구 계약이 아니다.
- `.bouncer/context/epics/043-*` — 닫힌 사이클의 문서다.

## Constraints
- 문서만 바꾸는 커밋이다. 테스트를 새로 붙이지 않는다 — 이 절들은 사람이 읽는
  실행 지침이고, 문구를 계약 테스트로 고정하면 다음 회차가 절차를 다듬을 때마다
  무관한 테스트가 깨진다.
- 기존 절 순서와 제목을 유지한다. `test/lightweight-cycle.test.js`가
  「3회차 on arm: light 계약」 제목을 참조한다.
- 3회차가 실제로 겪은 사실(네 런이 146~160줄, 네 런 모두 100줄 초과)을 근거로 적되,
  그 판정을 다시 쓰지 않는다.

## Checklist
- [ ] 「plan 단계 스냅샷」 절을 추가한다. 최소한 이것들을 담는다:
      - 시점: 각 런에서 `validate --gate plan`이 통과한 직후, 구현 시작 전.
      - 대상: blueprint `index.md`와 `tasks/<NNN>/{tasks,verification,review}.md`,
        full 계약이면 `context-review.md`까지.
      - 남기는 곳: 실행 clone 밖 — `docs/benchmark/round-<N>/plan-snapshots/<run>/`.
        clone은 커밋 하나로 squash되므로 clone 안에만 두면 사라진다.
      - 명령 예시를 코드블록으로 적는다:
        ```bash
        BP=.bouncer/context/epics/<epic>/blueprints/<bp>
        DEST=docs/benchmark/round-<N>/plan-snapshots/<run>
        mkdir -p "$DEST"
        cp -R "$BP" "$DEST/"
        wc -l "$BP"/index.md "$BP"/context-review.md "$BP"/tasks/*/*.md > "$DEST/lines.txt"
        ```
- [ ] 「표본 제외와 실패 보고」 절을 **새로** 추가한다. `protocol.md`에는 지금 표본
      배제 조항이 없다 — 「심사 대상에서 제외한 것」은 심사 diff에서 계획 문서를 빼는
      얘기라 다른 사안이고, 3회차에서 충돌한 조항은 그 회차 task 브리프에만 있었다.
      따라서 이 절은 갱신이 아니라 최초 확정이다. 적용 순서를 한 문장으로 못박는다:
      실패 보고가 표본 제외보다 앞선다 — 목표 미달은 미달로 보고하고, 표본 제외는
      프로토콜 위반(사이클 미완, 사람 개입, 게이트 우회)에만 적용한다.
- [ ] 그 절에 3회차 사례를 두 문장으로 적는다: 네 런이 모두 100줄을 넘겨 제외 조항을
      그대로 적용하면 성공 표본이 0이 되므로, 네 런을 유지하고 미달로 판정했다.
- [ ] 「한계」 절에 항목을 하나 **추가**한다. 지금 그 절의 여섯 항목 중 plan-gate 시점
      줄 수를 다루는 것은 없다(그 관측은 `round-3/runs.md`에 있고 그 파일은 Do not
      touch다). 새 항목은 3회차 수치가 파생 대리값이며 다음 회차부터는 「plan 단계
      스냅샷」 절이 실측을 남긴다는 사실을 적는다. 기존 여섯 항목은 건드리지 않는다.
- [ ] `npm test`가 통과한다(`test/lightweight-cycle.test.js`의 제목 참조 포함).
