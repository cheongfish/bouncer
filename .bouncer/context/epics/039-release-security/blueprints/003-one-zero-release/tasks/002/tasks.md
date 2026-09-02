---
type: bouncer.tasks
title: 1.0 릴리스 문서
description: Task specification for the 039 release security work
resource: .bouncer/context/epics/039-release-security/blueprints/003-one-zero-release/tasks/002/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T19:42:01.861+09:00'
bouncer:
  id: TASKS-002
  epic_id: '039'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 공개 릴리스 범위와 변경 내역을 남김
    - 설치 독자가 현재 배포 상태를 알게 함
  affected_paths:
    - CHANGELOG.md
    - README.md
    - docs/README.md
    - docs/compatibility.md
  graph:
    generated_at: '2026-08-15T19:44:00+09:00'
    command: graphify query "1.0.0 release plugin manifests marketplace package lockfile changelog installation smoke pilot tag" --graph graphify-out/{source,context}/graph.json
    suggested_paths:
      - test
      - .bouncer/context
    basis:
      - graph: source
        status: reused
        query: 1.0.0 release plugin manifests marketplace package lockfile changelog installation smoke pilot tag
        result: 75 nodes; test/distribution.test.js, test/plugin-wiring.test.js, test/public-contract.test.js
      - graph: context
        status: updated
        query: 1.0.0 release plugin manifests marketplace package lockfile changelog installation smoke pilot tag
        result: 10 nodes; prior 1.0 release and plugin-surface context records
---
# 작업

Blueprint: [003](../../index.md)

## 목표와 의도
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
1.0.0 출시 준비의 변경 내역·설치 경로·문서 목차가 같은 버전과 출시 예정 상태를
설명한다. 실제 태그·smoke 결과와 지원 상태는 다음 task 전까지 확정 사실로 적지 않는다.

## 인터페이스
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `CHANGELOG.md`의 `1.0.0` 출시 준비 노트와 README·문서 목차의 `1.0.0`
  출시 예정 상태 표기.
- 거부: 태그 전 공개 완료, 실행하지 않은 호스트의 설치 성공, 또는 지원 상태를
  문서가 주장하지 않는다.

## 변경 범위
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `CHANGELOG.md` — `1.0.0` 출시 준비·공개 계약·배포 변경을 Unreleased 아래에 기록한다.
- Modify `README.md` — 파일럿 표기와 현재 배포 목표를 1.0.0 출시 예정 상태로 갱신한다.
- Modify `docs/README.md` — Changelog 링크의 표시 버전과 anchor를 1.0.0 출시 준비 항목으로 갱신한다.
- Modify `docs/compatibility.md` — 아직 릴리스되지 않았다는 문구를 1.0.0 출시 준비와
  호환 정책으로 바꾼다.

## 변경 금지
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `.claude-plugin/` — 배포 버전은 task 001에서 확정한다.
- `docs/install.md` — 실제 smoke 결과와 지원 상태는 task 003에서 기록한다.
- `docs/PILOT.md` — 실행 증거가 생기기 전에는 파일럿 표를 바꾸지 않는다.

## 제약 조건
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- Keep a Changelog와 Semantic Versioning 표기를 유지한다.
- 릴리스 문서는 이 blueprint의 목표 릴리스일인 `2026-08-15`를 사용한다. 실제
  `bouncer--v1.0.0` 태그는 모든 task 커밋이 병합된 최종 HEAD에서 task 003 이후
  별도 릴리스 운영 절차로 만든다.
- 태그 생성 전에는 `1.0.0`의 공개 완료·설치 성공·지원 확정을 문서에 단정하지 않는다.
- 공개 CLI·게이트·스키마·호환 정책의 의미는 BP002에서 동결한 범위를 벗어나지 않는다.

## 체크리스트
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 현재 `0.9.0` 링크·파일럿 문구가 남은 위치를 검색해 위 Touch 밖 변경이 필요한지
  확인하고, 필요하면 계획으로 되돌린다.
- [ ] `CHANGELOG.md`에 1.0.0 출시 준비 항목과 목표 릴리스일 `2026-08-15`를 작성한다.
- [ ] README·문서 목차·호환 정책을 1.0.0 출시 예정 상태와 맞춘다.
- [ ] `npm test`를 실행해 문서 계약 회귀 검사를 통과시킨다.
