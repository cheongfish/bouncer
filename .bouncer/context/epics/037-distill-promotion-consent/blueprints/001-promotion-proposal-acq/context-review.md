---
type: bouncer.context_review
title: 001 context review
description: Context review for 001
resource: .bouncer/context/epics/037-distill-promotion-consent/blueprints/001-promotion-proposal-acq/context-review.md
tags:
  - bouncer
  - context_review
timestamp: '2026-08-14T16:25:12.612+09:00'
bouncer:
  id: CTXREVIEW-001
  epic_id: '037'
  blueprint_id: '001'
  status: accepted
  context_review:
    findings:
      - id: CR-001
        severity: major
        status: resolved
      - id: CR-002
        severity: major
        status: resolved
      - id: CR-003
        severity: major
        status: resolved
      - id: CR-004
        severity: minor
        status: resolved
      - id: CR-005
        severity: minor
        status: resolved
      - id: CR-006
        severity: minor
        status: resolved
      - id: CR-007
        severity: minor
        status: resolved
      - id: CR-008
        severity: minor
        status: accepted
        note: '`rules/governance.md:49`는 light 경로 문맥의 문장이라 light 예외를 두지 않는 한 계속 참이다. 그 조건을 task 002 Interface에 명시해 해결했고 파일 편집은 불필요하다. `docs/workflow.md`·`docs/ARCHITECTURE.md`·`README.md`의 서술은 승격 순서만 말하므로 이번 변경 뒤에도 거짓이 되지 않는다 — 동의 절차 명시는 별도 문서 패스로 미룬다.'
      - id: CR-009
        severity: minor
        status: accepted
        note: '리뷰어가 `scope.ts:62`에서 참임을 확인했다. 이미 있는 동작을 위해 새 어서션을 만드는 것은 자기 재검증에 해당하므로(세션 수칙 4) 판정 시점의 검사로 충분하다.'
---
# Context review

## Findings

- **CR-001** (major, resolved) — 비대화형 예외가 자기 자신을 근거로 삼는 순환 참조였고 finalize의 기존 ACQ 규칙과 반대였다.
- **CR-002** (major, resolved) — spec-authoring이 CLI를 직접 부르게 되어 master-rules 금지 어서션과 충돌했다.
- **CR-003** (major, resolved) — 성공 조건 3(replace 문장 쌍 제시)을 고정하는 계약 테스트가 체크리스트에 없었다.
- **CR-004** (minor, resolved) — epic SC1이 미선언 샤드에서 존재하지 않을 필드를 요구하고 pathsKnown을 빠뜨렸다.
- **CR-005** (minor, resolved) — 투영이 pathsKnown만 싣고 라우터가 함께 보는 pullsKnown을 버렸다.
- **CR-006** (minor, resolved) — blueprint의 후보 0건·drop 불일치 실패 모드가 task 002에 내려오지 않았다.
- **CR-007** (minor, resolved) — ACQ 불변 제약이 갱신이 필요한 `Gates in this skill:` 줄까지 막고 있었다.
- **CR-008** (minor, accepted) — `rules/governance.md`와 공개 문서 3곳이 Touch에도 Do not touch에도 없었다.
  - 근거: `rules/governance.md:49`는 light 경로 문맥의 문장이라 light 예외를 두지 않는 한 계속 참이다. 그 조건을 task 002 Interface에 명시해 해결했고 파일 편집은 불필요하다. `docs/workflow.md`·`docs/ARCHITECTURE.md`·`README.md`의 서술은 승격 순서만 말하므로 이번 변경 뒤에도 거짓이 되지 않는다 — 동의 절차 명시는 별도 문서 패스로 미룬다.
- **CR-009** (minor, accepted) — SC7이 기존 동작에 대한 진술이라 이를 실행하는 태스크가 없다.
  - 근거: 리뷰어가 `scope.ts:62`에서 참임을 확인했다. 이미 있는 동작을 위해 새 어서션을 만드는 것은 자기 재검증에 해당하므로(세션 수칙 4) 판정 시점의 검사로 충분하다.

판정: `bouncer-context-reviewer`가 코드 주장까지 저장소에서 대조했다. major 3건은
계획 문서를 고쳐 해소했고, minor 2건은 근거를 적어 수용했다. 실행 가능한 지적은
남아 있지 않다.
