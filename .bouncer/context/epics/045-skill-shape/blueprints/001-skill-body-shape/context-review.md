---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/045-skill-shape/blueprints/001-skill-body-shape/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-24T10:16:15.813+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '045'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: blocker
        status: resolved
      - id: CR-2
        severity: blocker
        status: resolved
      - id: CR-3
        severity: major
        status: resolved
      - id: CR-4
        severity: major
        status: resolved
      - id: CR-5
        severity: minor
        status: resolved
      - id: CR-6
        severity: minor
        status: resolved
      - id: CR-7
        severity: minor
        status: resolved
      - id: CR-8
        severity: minor
        status: resolved
      - id: CR-9
        severity: minor
        status: resolved
      - id: CR-10
        severity: minor
        status: resolved
      - id: CR-11
        severity: nit
        status: resolved
---
# Context review

## Findings

- **CR-1** · blocker · `resolved` — TASKS-002 Constraints가
  `skills/explain-diff/SKILL.md`의 `description`에 `/bouncer-commit`을 유지하라고
  적었다. 실제 `test/skill-explain-diff.test.js:18`은 그 문자열을 **금지**하고
  17행이 `/bouncer-finalize`를 요구한다. 029 시절 브리프 문구를 그대로 옮겨온
  오류이며, 그대로 따랐다면 구현자가 테스트를 깨는 문자열을 넣었을 것이다.
  금지로 뒤집고, 이 task는 `description`을 만지지 않는다는 점을 함께 적었다.
- **CR-2** · blocker · `resolved` — TASKS-003이 제안한 `agents.test.js` 단정이
  `heads[0] === '## Authority'`와 `heads[1] === guard`를 요구하는데, Touch는
  `agents/bouncer-implementer.md`의 `## Authority (task brief only)` 부기 제거도
  `## Scope`의 가드 절 아래 이동도 시키지 않았다. 두 단정 모두 실패한다. 그 파일의
  현재 절 일곱 개를 Goal에 그대로 적고, 목표 순서를 코드블록으로 못박고, Touch와
  Checklist에 두 이동을 추가했다.
- **CR-3** · major · `resolved` — TASKS-002 Touch가 자기 테스트가 요구하는 순서를
  만들지 못했다. `discovery`는 리네임만 하면 `## Return`(옛 Handoff, 43행)이
  `## Guardrails`(54행)보다 **앞**에 남고, `spec-authoring`은 `## Steps`(옛 How to
  author, 152행)가 `## Guardrails`(옛 Ownership boundary, 106행)보다 **뒤**에
  남는다. Touch 두 줄에 이동을 명시했다.
- **CR-4** · major · `resolved` — 에픽 성공 조건 4가 `## Authority` → 도메인 →
  `## Output contract`만 요구해서, blueprint와 테스트가 강제하는 `## Hard guards`
  위치를 에픽만 읽고는 판정할 수 없었다. 조건 4를 blueprint 골격과 같게 맞췄다.
- **CR-5** · minor · `resolved` — 에픽 Intent가 029/001을 「본문 절을 명시적으로
  제외했다」고 적었다. 그 blueprint의 Out of scope는 「스킬 내용의 의미 변경」을
  제외했을 뿐이다. 결론(본문 H2를 규정한 적 없음)은 같지만 근거를 과장했으므로
  「배치·서술 수준에서만 정렬했고 본문 H2의 이름과 순서는 규정하지 않았다」로 고쳤다.
- **CR-6** · minor · `resolved` — 실제 헤딩은 `## Decision ladder (in order)`인데
  괄호를 뺀 형태로 인용했다. 더 중요한 것은 그 정규식의 lookahead가 `\n## `를
  요구한다는 점이다 — 이 절이 마지막 H2가 되면 구간을 못 잡고 실패한다. 문서 어디에도
  없던 이 함의를 Constraints에 적었다.
- **CR-7** · minor · `resolved` — `하드룰 9`를 implementation의 보존 토큰으로 적었다.
  그 파일에 `하드룰`은 한 번도 나오지 않고(영어 `Hard rule 9`로만 있다),
  `하드룰 9`는 `agents/bouncer-implementer.md`의 토큰이다. 구현자가 없던 문자열을
  「복원」하지 않도록 영어 형태로 고치고 그 사실을 적었다.
- **CR-8** · minor · `resolved` — Return-last 확인 명령이 `skills/*`를 돌아 워크플로
  6개와 범위 밖 `agentic-code-benchmark`까지 섞였다. 합불을 읽을 수 없는 출력이다.
  서브스킬 12개 이름을 열거하고 불일치만 출력하도록 바꿨다.
- **CR-9** · minor · `resolved` — 성공 조건 5가 「스킬과 에이전트 본문」이라 범위가
  테스트보다 넓었고(테스트는 22개만 순회, benchmark 제외), 테스트는 H2와 H3를 함께
  보는데 조건은 H2만 말했다. 조건을 「워크플로 6개·서브스킬 12개·에이전트 4개의
  H2와 H3」로 좁혔다.
- **CR-10** · minor · `resolved` — 성공 조건 2와 blueprint 계약이 ACQ 절의 **위치**를
  요구하는데 제안된 단정은 존재만 봤다. 워크플로 스킬에서 그 절이 유일한 H2이므로
  `heads[heads.length - 1]` 비교로 한 줄에 위치까지 판정하도록 올렸다.
- **CR-11** · nit · `resolved` — `stop-slop`의 `## Return`이 이미 마지막이라 새
  `## Guardrails`를 그 앞에 넣어야 순서 단정을 통과한다. Touch에 「마지막 절
  `## Return` 바로 앞에」로 위치를 못박았다.
