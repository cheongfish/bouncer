---
type: bouncer.tasks
title: 패키지 버전을 정본으로 대조
description: Uses the package version as the single source for release manifest consistency checks.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
  - release
  - versioning
timestamp: '2026-09-03T16:13:56.213+09:00'
bouncer:
  id: TASKS-002
  epic_id: '061'
  blueprint_id: '004'
  status: verified
  commit_intent: |-
    릴리스마다 분산된 버전 리터럴을 사람이 맞추는 비용을 제거함
    package.json 버전을 기준으로 배포 매니페스트의 드리프트를 검출함
  verify: npm test
  affected_paths:
    - test/distribution.test.js
    - test/cursor-plugin.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T16:17:10.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: release version manifest package consistency
        result: source graph was fresh; no implementation link was ranked
      - graph: test
        status: reused
        query: release version manifest package consistency
        result: test graph ranked test/distribution.test.js at low confidence
      - graph: context
        status: updated
        query: release version manifest package consistency
        result: context graph returned only ownership context matches
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - no source or context functional link was found
        - test-only candidate does not establish implementation scope
    candidates:
      implementation: []
      test:
        - path: test/distribution.test.js
          score: -5
          confidence: low
          basis:
            - path seed test/distribution.test.js
            - test-only without implementation link
      context: []
  commit_sha: 03c4bca5
---
# 패키지 버전을 정본으로 대조

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
`package.json`의 버전을 유일한 기대값으로 사용해 lockfile과 모든 호스트·마켓플레이스 매니페스트를 대조한다. 테스트 안의 별도 버전 리터럴은 제거하되, 이름·host별 델타 검사는 유지한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 패키지 정본에서 파생한 매니페스트 버전 일치 검사.
- 거부: 테스트 소스에 독립적으로 고정된 기대 버전과 버전이 서로 다른 배포 매니페스트.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `test/distribution.test.js` — `package.json` 버전을 읽어 Claude marketplace·plugin과 lockfile을 대조한다.
- Modify `test/cursor-plugin.test.js` — `package.json` 버전을 읽어 네 host 매니페스트를 대조한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `package.json` — 이번 task는 버전을 바꾸지 않고 정본을 소비만 한다.
- `.claude-plugin/plugin.json` — 이번 task는 매니페스트 값을 생성하거나 변경하지 않는다.
- `.cursor-plugin/plugin.json` — 이번 task는 매니페스트 값을 생성하거나 변경하지 않는다.
- `.codex-plugin/plugin.json` — 이번 task는 매니페스트 값을 생성하거나 변경하지 않는다.
- `plugin.json` — 이번 task는 매니페스트 값을 생성하거나 변경하지 않는다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 정본은 `package.json`이며, lockfile과 각 매니페스트의 버전 검사는 계속 유지한다.
- 새 릴리스 도구나 설정 파일을 추가하지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 현재 테스트의 고정 기대 버전을 실제 `package.json` 값과 다르게 만든 실패 사례를 확인한다.
- [ ] 테스트가 `package.json`에서 기대 버전을 읽도록 바꾸고 모든 기존 대조를 유지한다.
- [ ] 매니페스트 하나의 버전 드리프트가 실패하는 회귀 단언을 남긴다.
- [ ] `npm test`를 실행해 릴리스 정합성 검사를 확인한다.
