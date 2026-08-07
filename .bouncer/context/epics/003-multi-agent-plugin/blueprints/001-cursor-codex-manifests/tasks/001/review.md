---
type: bouncer.review
title: 001 review
description: Review for 001
resource: .bouncer/context/epics/003-multi-agent-plugin/blueprints/001-cursor-codex-manifests/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '003'
  blueprint_id: '001'
  status: accepted
  review:
    required: true
    findings:
      - severity: blocker
        status: resolved
        summary: BOUNCER_ROOT was assigned once in a preamble but read from later shell blocks, which run in fresh shells — every later block resolved it to an empty prefix and would have run `node /scripts/bouncer`.
        note: Fixed earlier on this branch by inlining the assignment in every fenced block; regression test walks commands/*.md fenced blocks.
      - severity: minor
        status: accepted
        summary: Codex commit guard depends on the user trusting plugin-bundled hooks; until then hooks/hooks.json is skipped and commits are unguarded.
        note: Documented in README. Codex docs state plugin hooks stay unloaded until trust review. Cannot force trust from the plugin package.
      - severity: minor
        status: accepted
        summary: Codex does not expose commands/ as a plugin surface; workflow entry points remain Claude/Cursor-only until BP-002 moves them into skills/.
        note: Allowed by the brief (README must state the limit) and by epic intent that BP-002 owns the skills migration. Manifest validation still passes with skills + default hooks discovery.
      - severity: nit
        status: accepted
        summary: Live Cursor/Codex client install was not run in this environment.
        note: Protocol and validator checks are covered by unit tests and validate_plugin.py; remaining risk is integration-level.
---
# Review

## 판단 근거
- 진단 기준은 `tasks.md`의 Goal & intent / Interface / Touch / Do not touch /
  Checklist, 그리고 `git diff develop...HEAD` (+ 미커밋 구현).
- Do not touch 확인: `scripts/lib/`, `skills/`, `.claude-plugin/`,
  `.bouncer/config.json`, `.bouncer/templates/`, `hooks/session-graph.js` 모두
  구현 diff에 없다. 커밋 가드 판정은 `evaluateCommit` 재사용.
- Minimality: 새 의존성 없음. Cursor 어댑터는 프로토콜 번역만, Codex는 기존
  `hooks/hooks.json`+`commit-safety.js`를 기본 탐색으로 재사용하고 매니페스트에
  `hooks` 키를 넣지 않아 검증기를 통과한다.
- Claude Code 회귀: `hooks/hooks.json`의 `${CLAUDE_PLUGIN_ROOT}` 유지,
  `npm test` 218 pass.

## Findings

1. **[blocker · resolved] `BOUNCER_ROOT` 셸 블록 수명.**
   이전 커밋에서 수정·회귀 테스트로 고정됨.

2. **[minor · accepted] Codex 훅 trust 전제.**
   플러그인 훅은 trust 전까지 로드되지 않음. README에 명시. 패키지에서 강제 불가.

3. **[minor · accepted] Codex에 `commands/` 미노출.**
   002 범위. README에 한계와 우회(`BOUNCER_ROOT`+`scripts/bouncer`)를 적음.

4. **[nit · accepted] 실클라이언트 설치 미검증.**
   단위 테스트·`validate_plugin.py`로 계약은 고정. 통합 위험만 남음.
