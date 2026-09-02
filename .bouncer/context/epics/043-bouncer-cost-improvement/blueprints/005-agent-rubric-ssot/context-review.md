---
type: bouncer.context_review
title: 002 context review
description: Context review for 002
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/005-agent-rubric-ssot/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-26T14:53:09.139+09:00'
bouncer:
  id: CTXREVIEW-005
  epic_id: '043'
  blueprint_id: '005'
  status: accepted
  context_review:
    findings:
      - id: CR-1
        severity: major
        status: resolved
      - id: CR-2
        severity: major
        status: resolved
      - id: CR-3
        severity: major
        status: resolved
      - id: CR-4
        severity: major
        status: resolved
      - id: CR-5
        severity: major
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
        severity: nit
        status: accepted
        note: 행 범위가 느슨하지만 지시 대상이 모호하지 않다. Touch를 케이스 단위 지시로 바꾸면서 행 번호 의존이 사라져 실효가 없어졌다.
      - id: CR-11
        severity: nit
        status: resolved
---
# Context review

## Findings

- **CR-1** (major, resolved) — task 002가 `test/skill-review.test.js`의 `ship without tests` 케이스를 빠뜨렸다. 그 케이스는 `[md, reviewerPrompt, agent]`를 순회하며 「without a test」를 단정하고 아래에서 `md`에 「docs-only」를 따로 단정하는데, 두 문장 모두 이 task가 지우는 블록에만 있다. 직접 확인했다. 그대로면 `npm run ci`가 깨진다. 조치: Touch에 그 케이스를 명시하고, Checklist를 「`md` 대상 단언을 grep으로 전부 열거한 뒤 지운다」로 바꿨다.
- **CR-2** (major, resolved) — `skills/debugging`·`skills/context-review`·`skills/implementation`에는 디스패치 절차도 fallback 분기도 없다(grep으로 확인). 실제 디스패치는 `/bouncer-execute`와 `/bouncer-plan`에 있고, 네 서브스킬 중 디스패치를 가진 것은 `review` 하나다. 「여섯 항목 호출 계약을 남긴다」는 균일 요구가 성립하지 않았고, task 003·004는 없는 항목을 남긴다고 약속하면서 지시는 삭제만 했다. 조치: 사용자 판단으로 Contract를 역할별 실제 소유 항목 열거로 다시 썼고, task 003·004에 「없는 항목을 새로 쓰지 않는다」를 명시했다.
- **CR-3** (major, resolved) — task 004가 (d) 재호출 상한과 (e) fallback을 누락했다. CR-2의 재서술로 해소됐다 — 그 둘은 이 스킬이 소유하지 않는 항목이다.
- **CR-4** (major, resolved) — epic 성공 조건 2(네 역할 fallback 생존)는 `skills/bouncer-execute/SKILL.md`에 걸려 있는데 그 파일은 네 task 전부의 Do not touch이자 blueprint 003 소관이다. 지킬 수 없는 수용 기준이었다. 조치: SC2를 이 blueprint의 수용 기준에서 빼고 소유자가 blueprint 003임을 Contract에 명시했다.
- **CR-5** (major, resolved) — 「여섯 항목과 고유 정본 절 밖의 문장이 0건」은 참·거짓 판정이 불가능했다. `rules/skill-shape.md`가 요구하는 구조 절, 4단계 이름, scope 이름, Findings 필드 계약이 모두 남는데 예외 목록에 없었다. 조치: 수용 기준을 「`wc -w` 감소」와 「같은 rubric 문단이 두 파일에 동시 존재 0건」 두 개의 관측 가능한 조건으로 바꾸고, 남는 것을 잔여가 아니라 계약으로 열거했다.
- **CR-6** (minor, resolved) — epic 성공 조건 3은 `skills/bouncer-{plan,execute,finalize,run}`의 `references/` 분리에 관한 것이라 이 blueprint와 무관한데 blueprint와 task 004가 근거로 인용했다. 조치: 두 곳 모두 `test/skill-context-review.test.js` 인용으로 바꿨다.
- **CR-7** (minor, resolved) — `agents/bouncer-context-reviewer.md`의 `## Rubric — four scopes` 서두가 스킬을 가리키는데, 정본이 agent로 오면 순환이 된다. task 003은 debugger에 대해 같은 지시를 이미 하고 있었다. 조치: task 004에 같은 제거 지시를 넣었다.
- **CR-8** (minor, resolved) — task 001·003·004가 각각 어떤 테스트 케이스의 단언 **전부**를 지우게 되어 있어, 이름만 남은 빈 테스트가 통과하며 계약 소실을 감춘다. 조치: 세 task 모두 「케이스째로 삭제하고 같은 이름의 케이스를 `test/agents.test.js`에 만든다」로 바꿨다.
- **CR-9** (minor, resolved) — blueprint 실패 모드에 `rules/skill-shape.md` 절 순서가 두 번 적혔고 앞의 것이 `## Steps`를 빠뜨렸다. 조치: 틀린 항목을 지웠다.
- **CR-10** (nit, accepted) — 위 note 참조.
- **CR-11** (nit, resolved) — task 002의 「중복 회수량이 가장 큰 자리」에 근거가 없었고 기록된 baseline은 오히려 implementation이 크다. 조치: 그 문장을 지우고 「디스패치 절차를 가진 유일한 스킬」이라는 사실 진술로 바꿨다.

리뷰어가 통과로 확인한 항목: 네 `wc -w` baseline(1239 / 876 / 449 / 852)이 정확하고, 인용한 테스트 행 범위 대부분이 실제 단언과 일치한다.
