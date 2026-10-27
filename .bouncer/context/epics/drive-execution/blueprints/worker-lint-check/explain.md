---
type: bouncer.explain
title: worker-lint-check explain
description: Explain for worker-lint-check
resource: .bouncer/context/epics/drive-execution/blueprints/worker-lint-check/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-10-27T15:53:32.821+09:00'
bouncer:
  id: EXPLAIN-worker-lint-check
  epic_id: drive-execution
  blueprint_id: worker-lint-check
  status: published
  comprehension:
    - range_from: 7c6130600059eeddee877c7f62317444746c65a2
      range_to: b5ae9bcc353949f3ab47a1f9caa7a5690a33e007
      diff_sha: 3a96a1aa30764a14d7c8984d8dc549f082a4fd52932d80569fa55e8be305d98b
      recorded_at: '2026-10-27T15:54:22.200+09:00'
---
# Explain

## Background

`bouncer-implementer` 문서에는 "ts·js 줄은 120자 이내" 규칙이 이미 있었다.
그래도 구현 worker는 자기 task 전용 테스트만 돌리고 보고했고, lint 위반은 모든 구현이 통합된 뒤의 종단 `npm run ci`에서야 드러났다.
그 결과 repair wave가 한 번 생겼다(약 7분, 토큰 약 12만).
규칙은 있었지만 적용을 확인하는 절차가 없었던 것이다.

이 변경은 implementer가 report 하기 전에 자기가 바꾼 ts·js 파일에 eslint를 돌리고 모든 finding을 직접 고치게 한다.
`bouncer.verify`, report 증거 형식, gate는 바뀌지 않는다.

## Code

- `agents/bouncer-implementer.md`: `## Guardrails`의 120자 규칙 바로 뒤에 항목을 추가했다.
  report 전에 변경한 ts·js 파일에만 `npx eslint <changed ts/js files>`를 실행하고, 모든 finding을 고치며, `eslint-disable`로 우회하지 않는다.
  이 단계는 task의 `verify` 명령을 대체하지 않는다.
- `.codex/agents/bouncer-implementer.toml`: 위 Markdown의 생성 사본이다. 직접 고치지 않고 `mdToCodexToml`로 재생성한다. `test/agents.test.js`가 두 파일의 동기화를 검사한다.
- `test/implementer-lint-step.test.js`: `## Guardrails` 절 본문에 `npx eslint <changed`, `eslint-disable`, `verify`가 있고 TOML에도 같은 항목이 있는지 확인한다.
  문서 문구를 부분 문자열로 단언하는 것은 코딩 표준이 권장하지 않는 형태이지만 task 브리프가 명시해 따랐다.
- `test/tiers.json`: 새 테스트를 `unit` 목록에 등록한다. 종단 CI의 tier 검사가 처음에 이 누락으로 실패했다.

한계: 이 절차는 문서 지침이라 worker가 따르는지를 기계가 강제하지는 않는다.
종단 CI가 마지막 안전망으로 남는다.

## Quiz

1. implementer가 report 하기 전에 eslint를 실행하라는 새 지침의 내용은?
   - a) 저장소 전체에 `npx eslint .`를 실행하고, 실패하면 task `verify`로 대체한다
   - b) 변경한 파일에서 위반이 나오면 해당 줄에 `eslint-disable`을 붙여 넘어간다
   - c) 변경한 ts·js 파일에만 `npx eslint`를 실행하고 모든 finding을 고치며, task `verify`는 그대로 실행한다

## Tasks
