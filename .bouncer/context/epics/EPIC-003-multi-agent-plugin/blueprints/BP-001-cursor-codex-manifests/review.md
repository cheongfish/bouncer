---
type: bouncer.review
title: BP-001 review
description: Review for BP-001
resource: .bouncer/context/epics/EPIC-003-multi-agent-plugin/blueprints/BP-001-cursor-codex-manifests/review.md
tags:
  - bouncer
  - review
timestamp: '2026-07-27T16:58:12.166+09:00'
bouncer:
  id: REVIEW-BP-001
  epic_id: EPIC-003
  blueprint_id: BP-001
  status: accepted
  review:
    required: true
    findings:
      - severity: blocker
        status: resolved
        summary: >-
          BOUNCER_ROOT was assigned once in a preamble but read from later shell
          blocks, which run in fresh shells — every later block resolved it to an
          empty prefix and would have run `node /scripts/bouncer`. This broke
          Claude Code too, not just the new agents.
        note: >-
          Fixed by inlining the assignment at the top of every fenced block that
          reads the variable, and pinned by a regression test that walks the
          fenced blocks in commands/*.md.
      - severity: minor
        status: accepted
        summary: >-
          .cursor-plugin/marketplace.json carries `description` and `owner`
          alongside the documented `name`/`source` entry fields. Cursor's
          reference documents the required shape but not whether extra keys are
          rejected.
        note: >-
          Mirrors the shape of .claude-plugin/marketplace.json, which the Claude
          loader accepts, and the fields are descriptive rather than behavioural.
          Accepted until an install against a real Cursor client is run; a
          rejection would surface immediately at `/add-plugin` rather than
          silently misbehave.
      - severity: minor
        status: accepted
        summary: >-
          The Cursor path is verified by unit tests and by reading an installed
          Cursor plugin, not by installing Bouncer into a live Cursor client.
        note: >-
          No Cursor workspace is available in this environment. The protocol
          details the tests encode were taken from a shipped plugin and the
          published reference (recorded in verification.md), so the remaining
          risk is integration-level, not logic-level.
      - severity: nit
        status: resolved
        summary: >-
          The first draft of the adapter test asserted only that the response was
          one of allow/deny, which no implementation could fail.
        note: >-
          Replaced with a temp-repository fixture that stages one in-scope and one
          out-of-scope file and asserts deny plus the violating path, with an
          in-scope counterpart that must be allowed.
---
# Review

## 판단 근거
- 진단 기준은 `tasks.md`의 Goal & intent / Interface / Touch / Do not touch /
  Checklist, 그리고 `git diff develop...HEAD`.
- Do not touch 확인: `scripts/lib/`, `skills/`, `.claude-plugin/`,
  `.bouncer/config.json`, `.bouncer/templates/`, `hooks/session-graph.js` 모두
  diff에 없다. 커밋 가드 판정은 `scripts/lib/commit-hook.js`의 `evaluateCommit`을
  그대로 호출하며 재구현하지 않았다.
- Claude Code 회귀: `hooks/hooks.json`은 변경하지 않았고
  `test/plugin-wiring.test.js`·`test/distribution.test.js`가 그대로 통과한다
  (216 tests, 0 fail).
- 범위: Codex 관련 파일(`.codex-plugin/`, `.agents/`)은 만들지 않았고
  `affected_paths`에서도 제거했다. 사유는 `tasks.md` `## Deviations`.

## Findings
아래 4건. blocker 1건은 수정 완료, 나머지는 근거를 적고 accept.

1. **[blocker · resolved] `BOUNCER_ROOT`가 후속 셸 블록에서 빈 값.**
   preamble에서 한 번만 대입했는데 각 블록은 새 셸이라 값이 사라진다.
   `node "${BOUNCER_ROOT}/scripts/bouncer"`가 `node "/scripts/bouncer"`가 되어
   **Claude Code에서도 깨지는** 회귀였다. 변수를 읽는 모든 블록 첫 줄에 대입을
   인라인하고, `commands/*.md`의 fenced 블록을 순회해 "읽으면 반드시 대입한다"를
   검사하는 회귀 테스트를 추가했다.

2. **[minor · accepted] Cursor 마켓플레이스 매니페스트의 추가 필드.**
   `description`·`owner`가 문서화된 엔트리 필드 밖이다. Claude 쪽 매니페스트와
   같은 형태이고 동작이 아니라 설명 목적이라 유지한다. 실제 Cursor 클라이언트
   설치로 확인하기 전까지 accept — 거부된다면 `/add-plugin` 시점에 바로 드러난다.

3. **[minor · accepted] 실제 Cursor 클라이언트 설치 검증 없음.**
   이 환경에 Cursor 워크스페이스가 없다. 프로토콜은 설치된 실물 플러그인과 공개
   레퍼런스에서 확인해 테스트로 고정했으므로(`verification.md`) 남은 위험은
   로직이 아니라 통합 수준이다.

4. **[nit · resolved] 어댑터 테스트가 무의미하게 통과했다.**
   초안이 `permission`이 allow/deny 중 하나인지만 확인해 어떤 구현도 실패시킬 수
   없었다. 임시 저장소 픽스처로 교체해 범위 안/밖 파일을 각각 stage 하고 deny와
   위반 경로, 그리고 범위 안 커밋의 allow를 단언한다.
