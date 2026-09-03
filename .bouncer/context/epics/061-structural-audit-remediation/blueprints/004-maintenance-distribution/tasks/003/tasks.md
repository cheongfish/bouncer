---
type: bouncer.tasks
title: 배포 포함 목록을 런타임 표면으로 제한
description: Limits package distribution to required plugin runtime files while retaining the development corpus.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
  - distribution
  - packaging
timestamp: '2026-09-03T16:13:56.248+09:00'
bouncer:
  id: TASKS-003
  epic_id: '061'
  blueprint_id: '004'
  status: verified
  commit_intent: |-
    개발 코퍼스가 설치 배포물에 섞이는 표면을 제거함
    플러그인 런타임에 필요한 파일만 패키지 포함 목록으로 고정함
  verify: npm test
  affected_paths:
    - package.json
    - test/distribution.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-09-03T16:17:10.000+09:00'
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: package distribution manifest runtime files
        result: source graph was fresh; no implementation link was ranked
      - graph: test
        status: reused
        query: package distribution manifest runtime files
        result: test graph ranked distribution-only candidates at low confidence
      - graph: context
        status: updated
        query: package distribution manifest runtime files
        result: context graph returned only ownership context matches
    quality:
      status: low-confidence
      confidence: low
      reasons:
        - no source or context functional link was found
        - package manifest is outside the configured source graph
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
  commit_sha: 9f7b4294
---
# 배포 포함 목록을 런타임 표면으로 제한

Blueprint: [004](../../index.md)

<!-- scope_evidence.basis 엔트리 필드: graph, status, query, result.
     graph: source | test | context
     status: updated | reused | fail-skip | skip-disabled | missing
     quality/candidates는 graph-suggest 결과로만 채운다(scaffold는 비워 둔다).
     프론트매터 값은 []로 둔다. 이 주석을 실제 엔트리로 옮기면 빈 계획이 승인된다. -->

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
패키지 배포 목록을 플러그인 런타임에 필요한 `skills/`, `references/`, `rules/`, `agents/`, `hooks/`, `scripts/`와 host 매니페스트로 제한한다. 개발 저장소의 `.bouncer/context/`는 보존하지만 배포 후보에는 나타나지 않아야 한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 명시적인 package `files` 허용 목록과 그 내용물을 확인하는 배포 계약 테스트.
- 거부: `.bouncer/context/`, `test/`, 개발 문서, TypeScript 원본·설정이 패키지 배포물에 포함되는 경우.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `package.json` — 패키지 배포 허용 목록을 런타임·호스트 매니페스트 표면으로 선언한다.
- Modify `test/distribution.test.js` — `npm pack --dry-run --json` 결과에서 필수 파일 포함과 개발 코퍼스 제외를 판정한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `.bouncer/context/**` — 개발용 도그푸딩 코퍼스는 삭제하거나 이동하지 않는다.
- `skills/**` — task는 skill 본문을 바꾸지 않고 배포 포함 여부만 검증한다.
- `references/**` — task는 reference 본문을 바꾸지 않고 배포 포함 여부만 검증한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- `npm install` 없이도 CLI·hooks가 동작해야 하는 현재 배포 계약과 vendor 의존성 제약을 보존한다.
- 패키지 검사에는 npm이 제공하는 dry-run 메타데이터를 사용하며 새 배포 도구를 추가하지 않는다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 현재 배포 후보에 `.bouncer/context/`가 포함되는 실패 사례를 먼저 작성하고 확인한다.
- [ ] 최소 `files` 허용 목록을 선언해 런타임 경로와 host 매니페스트를 포함한다.
- [ ] dry-run 패키지 목록에서 필수 경로는 존재하고 개발 전용 경로는 없음을 단언한다.
- [ ] `npm test`를 실행해 설치 독립성 및 배포 계약을 확인한다.
