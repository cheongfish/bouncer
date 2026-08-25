---
type: bouncer.tasks
title: Distill 본문이 주장하는 라우팅 상태를 사실과 맞춤
description: Distill.md의 routing_enabled 플래그와 7개 샤드 본문의 비활성 안내 문장을 실제 설정에 맞게 정정한다
resource: .bouncer/context/epics/050-cycle-friction/blueprints/002-distill-read-scope/tasks/004/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-25T12:35:04.162+09:00'
bouncer:
  id: TASKS-004
  epic_id: '050'
  blueprint_id: '002'
  status: verified
  verify: npm run ci
  commit_intent:
    - config.json이 라우팅을 켰는데도 Distill.md는 false를 적고 샤드마다 비활성 안내를 실어 보냈음
    - 읽는 쪽에 매번 실려 가는 거짓 진술이라 플래그와 문장을 사실과 맞춤
  affected_paths:
    - .bouncer/Distill.md
    - .bouncer/distill/core.md
    - .bouncer/distill/validate-gates.md
    - .bouncer/distill/context-layout.md
    - .bouncer/distill/git-worktree.md
    - .bouncer/distill/graph.md
    - .bouncer/distill/plugin-skills.md
    - .bouncer/distill/build-ts.md
    - test/distill.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-25T12:35:04.162+09:00'
    suggested_paths:
      - .bouncer/distill/plugin-skills.md
      - .bouncer/distill/validate-gates.md
    basis:
      - graph: source
        status: reused
        query: query 'distill' (BFS depth=2)
        result: 소스 그래프에는 .bouncer/ 문서가 없어 후보 없음
      - graph: context
        status: updated
        query: query 'Distill 읽기 프리플라이트'
        result: plugin-skills·validate-gates 샤드 노드가 직접 매칭
---
# Tasks

Blueprint: [002](../../index.md)

## Goal & intent
`.bouncer/config.json`이 `distill.routing_enabled: true`이고 CLI가 config를
인덱스 메타데이터보다 우선하므로 라우팅은 켜져 있다. 그런데
`.bouncer/Distill.md` frontmatter는 `routing_enabled: false`이고, 7개 샤드
본문 첫 줄은 전부 「routing remains disabled until the project explicitly
opts in」이다. 읽는 쪽 컨텍스트에 매번 실려 가는 거짓 진술이라 둘 다
정정한다. 완료 판정은 저장소에서 두 문자열이 사라지고 `npm run ci`가
통과하는 것이다.

## Interface
- 제공:
  - `.bouncer/Distill.md` frontmatter `distill.routing_enabled`가 `true`.
  - 각 샤드 본문의 `# <id>` 다음 안내 문단을 그 샤드가 무엇을 담는지
    한 줄로 말하는 영어 문장으로 교체한다.
  - `test/distill.test.js`가 인덱스 `routing_enabled`를 `true`로 고정한다.
- 거부:
  - `## Invariants` / `## Gotchas` / `## Decisions` 아래 규칙 문장을
    더하거나 빼거나 고치는 것. 이번에 바뀌는 것은 헤딩 아래 안내 문단과
    frontmatter 플래그뿐이다.
  - `shards[]`의 `id` / `always` / `paths` / `pulls` 변경.

## Touch
- Modify `.bouncer/Distill.md` — frontmatter `routing_enabled`를 `true`로.
- Modify `.bouncer/distill/core.md` — 안내 문단 교체.
- Modify `.bouncer/distill/validate-gates.md` — 안내 문단 교체.
- Modify `.bouncer/distill/context-layout.md` — 안내 문단 교체.
- Modify `.bouncer/distill/git-worktree.md` — 안내 문단 교체.
- Modify `.bouncer/distill/graph.md` — 안내 문단 교체.
- Modify `.bouncer/distill/plugin-skills.md` — 안내 문단 교체.
- Modify `.bouncer/distill/build-ts.md` — 안내 문단 교체.
- Modify `test/distill.test.js` — 인덱스가 `routing_enabled: true`임을 고정하는
  assert를 맞춘다.

## Do not touch
- `.bouncer/config.json` — 이미 사실이 적힌 쪽이다.
- `scripts/`, `skills/`, `CLAUDE.md` — 001·002·003에서 끝났다.
- `.bouncer/context/` — 계획 문서는 이 태스크의 대상이 아니다.

## Constraints
- Distill은 영어 런타임이다. 교체 문장도 영어로 쓴다.
- 규칙 불릿의 개수와 문장은 보존한다. 승격/삭제는 finalize 소관이지
  이 태스크가 아니다.
- `git-worktree.md`처럼 `## Invariants`가 비어 있는 샤드의 빈 헤딩은
  그대로 둔다 — 렌더 형식이다.
- 안내 문장은 샤드마다 한 줄이며 규칙을 요약하지 않는다. 요약을 넣으면
  본문과 이중 진술이 된다.
- 샤드 파일은 원래 finalize 승격 경로에서만 열리도록 `makeAllowed`가 좁혀져
  있다(`scripts/src/lib/scope.ts`의 「일반 task가 샤드를 몰래 커밋하는 회귀를
  막는다」). 이번에는 규칙 승격이 아니라 사실과 어긋난 안내 문장·플래그 정정이라
  경로를 `affected_paths`에 명시해 통과시킨다. 이 예외를 근거로 규칙 불릿을
  건드리면 그 금지를 깨는 것이다.

## Checklist
- [ ] `grep -rn "routing remains disabled" .bouncer/`로 현재 7건을 확인한다.
- [ ] `.bouncer/Distill.md` frontmatter `distill.routing_enabled`를 `true`로
      바꾼다.
- [ ] 샤드 7개의 안내 문단을 각 샤드 범위를 말하는 한 줄 영어 문장으로
      교체한다 (예: `core`는 project-wide rules that apply to every path).
- [ ] `grep -rn "routing remains disabled\|routing_enabled: false" .bouncer/`가
      아무것도 내지 않음을 확인한다.
- [ ] `node scripts/bouncer distill --all --repo "$PWD" >/dev/null`이 종료 코드
      0이고 stderr 총량 줄이 여전히 7 shards임을 확인한다.
- [ ] `test/distill.test.js`에서 인덱스 `routing_enabled`를 `true`로 고정한다.
- [ ] `npm run ci` 통과를 확인한다.
