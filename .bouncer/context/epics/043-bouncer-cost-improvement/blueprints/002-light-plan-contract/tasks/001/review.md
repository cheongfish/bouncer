---
type: bouncer.review
title: light 계획 계약 리뷰
description: breaking change의 축약 범위와 유지 게이트가 문서·코드에서 일치하는지 판정한다
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/tasks/001/review.md
tags:
  - bouncer
  - review
timestamp: '2026-08-21T20:32:39.595+09:00'
bouncer:
  id: REVIEW-001
  epic_id: '043'
  blueprint_id: '002'
  status: accepted
  review:
    required: true
    findings:
      - id: F1
        severity: minor
        status: resolved
        summary: governance가 scale 판독 지점을 두 곳이라고 단정했으나 이 diff가 세 번째를 추가함
        note: >-
          rules/governance.md를 실제 판독자 넷(scaffoldBlueprint, scaffoldTask,
          plan gate, S20)으로 고쳐 선언 판독 원칙만 남김.
      - id: F2
        severity: minor
        status: resolved
        summary: verification-light.md가 verification.md와 바이트 동일한 중복 템플릿
        note: >-
          templateNameFor가 -light 키가 있을 때만 리네임하도록 fallback을 두고
          중복 본문을 삭제함. light 합계는 97줄 유지.
      - id: F3
        severity: minor
        status: resolved
        summary: basis 힌트 생략 주석이 필드 설명 소유자를 spec-authoring으로 잘못 지목함
        note: 'scaffold.ts 주석을 실제 소유자 skills/graphify-runner로 고침.'
      - id: F4
        severity: minor
        status: resolved
        summary: light에서 G12가 full과 동일 판정이라는 governance 문장이 과장임
        note: >-
          light 템플릿에 Do not touch 절이 없어 판정 대상이 없다는 사실을
          governance에 적고 동일 판정 주장은 G3~G5·G11로 한정함.
      - id: F5
        severity: minor
        status: accepted
        summary: scaffold한 light 트리를 plan gate에 통과시키는 end-to-end 테스트가 없음
        note: >-
          리뷰어가 수동으로 G18 미발생과 context-review 부재 S코드 없음을 확인함.
          단위 테스트 둘이 각 절반을 잠그고 있어 이 task 범위에서는 수용하고,
          구조 검사 추가 시 회귀 위험으로 남김.
      - id: F6
        severity: nit
        status: accepted
        summary: 100줄 상한의 실여유가 3줄인데 테스트가 그 사실을 적지 않음
        note: >-
          현재 97줄. bouncer 프론트매터 필드 하나가 task 문서 셋에 동시에
          들어가면 여유를 모두 쓴다는 점을 후속 측정 task에서 다룸.
      - id: F7
        severity: nit
        status: accepted
        summary: scaffold task --scale이 조용히 무시됨
        note: >-
          알 수 없는 플래그를 흘리는 parseFlags의 기존 동작이며 이 diff가 만든
          것이 아님. docs/cli.md 표가 blueprint 전용임을 이미 명시함.
      - id: F8
        severity: nit
        status: accepted
        summary: docs/gates.md의 알 수 없는 scale 문구가 도달 불가능한 상태를 설명함
        note: >-
          S20이 먼저 실패해 관측되지 않지만 게이트 분기의 fail-safe 서술로는
          정확함. 문구를 유지함.
      - id: F9
        severity: nit
        status: accepted
        summary: light blueprint index가 one-commit 프롬프트를 근거 없이 잃음
        note: >-
          축약 index는 브리프 Interface가 승인한 범위임. 하드룰 2의 판정 주체는
          여전히 사람과 commit 게이트이므로 프롬프트 소실을 수용함.
---
# Review

## Findings

- F1 (minor, resolved): `rules/governance.md`가 `scripts/`의 `scale` 판독을 두
  곳으로 단정했으나 이 diff가 `blueprintScale()`을 세 번째 판독자로 넣었다.
  실제 판독자 넷을 적고 "선언값만 읽고 크기를 추론하지 않는다"는 원칙만 남겼다.
- F2 (minor, resolved): `verification-light.md`가 `verification.md`와 바이트
  동일했다. `templateNameFor`가 `-light` 키 존재를 확인하고 없으면 공용
  템플릿으로 떨어지게 해 중복을 지웠다. light 합계는 97줄 그대로다.
- F3 (minor, resolved): `basis` 힌트를 생략한 이유 주석이 필드 설명 소유자를
  `spec-authoring`으로 지목했으나 그 파일은 답을 갖고 있지 않다. 실제 소유자인
  `skills/graphify-runner`를 가리키게 고쳤다.
- F4 (minor, resolved): governance가 G12도 light를 full과 똑같이 판정한다고
  적었지만 light 템플릿에 `## Do not touch` 절이 없어 판정 대상이 없다. G12는
  절이 있을 때만 같게 판정한다고 좁히고 동일 판정 주장은 G3~G5·G11에 두었다.
- F5 (minor, accepted): scaffold한 light 트리를 그대로 plan gate에 넣는 결합
  테스트가 없다. 리뷰어가 수동으로 G18 미발생과 `context-review.md` 부재에 대한
  S코드 없음을 확인했고, scaffold 테스트와 gate 테스트가 각 절반을 잠그고 있다.
  구조 검사가 `context-review.md`를 요구하게 바뀌면 light가 조용히 깨지는
  위험으로 남긴다.
- F6 (nit, accepted): 100줄 상한의 실여유가 3줄(현재 97)인데 테스트가 그 사실을
  적지 않는다. `bouncer:` 필드 하나가 task 문서 셋에 동시에 들어가면 여유를 모두
  쓴다.
- F7 (nit, accepted): `scaffold task --scale`이 조용히 무시된다. 알 수 없는
  플래그를 흘리는 `parseFlags`의 기존 동작이며 이 diff가 만든 것이 아니다.
  `docs/cli.md` 표가 `--scale`을 blueprint 전용으로 이미 적고 있다.
- F8 (nit, accepted): `docs/gates.md`의 "알 수 없는 값이면 full 계약" 문구는
  S20이 먼저 실패해 관측되지 않는 상태를 설명한다. 게이트 분기의 fail-safe
  서술로는 정확해 유지한다.
- F9 (nit, accepted): light blueprint index가 `## Out of scope`와
  one-commit 근거 절을 잃는다. 축약 index는 브리프 Interface가 승인한 범위이고
  하드룰 2는 여전히 사람과 commit 게이트가 판정한다.
