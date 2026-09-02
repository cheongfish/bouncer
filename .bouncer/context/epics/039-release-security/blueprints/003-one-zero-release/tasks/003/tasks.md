---
type: bouncer.tasks
title: 설치 smoke와 태그 기록
description: Task specification for the 039 release security work
resource: .bouncer/context/epics/039-release-security/blueprints/003-one-zero-release/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-15T19:42:01.895+09:00'
bouncer:
  id: TASKS-003
  epic_id: '039'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 실제 설치 결과로 지원 상태를 갱신함
    - 검증한 최종 HEAD만 릴리스 태그로 남김
  affected_paths:
    - docs/install.md
    - docs/PILOT.md
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
태그 전 최종 검증과 태그 후 Bouncer smoke cycle의 기록 절차가 설치·파일럿 문서에
남는다. 태그 기준 smoke는 애플리케이션·모노레포·문서·설정 중심 저장소와 Claude
Code·Cursor·Codex·Antigravity의 3×4 매트릭스에서 실행하고, 그 결과는 태그에
연결된 GitHub Release에 남긴다. 이 task는 절차와 인계만 완료한다.

## 인터페이스
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: 태그 후 GitHub Release로 연결되는 `docs/install.md` 설치 절차와
  `docs/PILOT.md` 기록 형식. 릴리스 운영자는 최종 HEAD에 annotated
  `bouncer--v1.0.0` 태그를 만들고, 동일 태그의 GitHub Release에 commit SHA와
  3×4 매트릭스별 결과를 남긴다.
- 거부: 태그 전 smoke 결과를 확정하거나, 증거 없는 조합을 `검증됨`으로 바꾸거나,
  기존 태그를 삭제·강제 이동하지 않는다.

## 변경 범위
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `docs/install.md` — 태그 기준 smoke 실행 절차와 GitHub Release 증거 위치를 안내한다.
- Modify `docs/PILOT.md` — 3×4 저장소 유형·호스트별 결과를 동일 태그 GitHub Release에
  commit SHA와 함께 남기는 형식과 미검증 상태를 기록한다.

## 변경 금지
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `package.json` — 버전은 task 001에서 고정한다.
- `CHANGELOG.md` — 릴리스 노트는 task 002에서 고정한다.
- `.bouncer/context/epics/039-release-security/blueprints/001-security-legal-baseline/` —
  완료된 공개 기반 계획은 변경하지 않는다.

## 제약 조건
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 이 task에서는 태그를 만들지 않는다. 세 task 커밋이 병합된 최종 HEAD에서
  `npm run ci`가 성공한 뒤에만 릴리스 운영자가 태그를 만든다.
- 릴리스 운영자는 `git tag -a bouncer--v1.0.0 <merged-head>`를 사용하고, 태그가
  이미 존재하거나 다른 커밋을 가리키면 중단해 사용자에게 보고한다.
- 태그 push와 원격 marketplace 설치에는 사용자 인증·외부 권한이 필요하므로 릴리스
  운영 시점에 별도 동의를 받는다.
- GitHub Release 작성과 태그 후 smoke는 blueprint 완료 뒤 릴리스 운영자가 수행하는
  외부 작업이며, 그 완료 여부는 이 task의 `npm test` 게이트가 대신 판단하지 않는다.

## 체크리스트
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 태그 기준 smoke의 3개 저장소 유형 × 4개 호스트 조합, 태그 commit SHA,
  성공·실패·사용자 개입 횟수, 동일 태그 GitHub Release 위치를 `docs/PILOT.md`에 정의한다.
- [ ] `docs/install.md`에서 태그 후 GitHub Release로 smoke 결과를 확인하도록 안내하고,
  smoke 전 조합은 `미검증`으로 둔다.
- [ ] task 003 커밋을 포함한 blueprint 종료 뒤, 릴리스 운영자에게 최종 HEAD의
  `npm run ci`, `bouncer--v1.0.0` 부재·대상 commit 확인, annotated 태그 생성,
  원격 push 권한 동의와 태그 push, 태그 기준 smoke, 동일 태그 GitHub Release의
  commit SHA·12개 결과·성공/실패/사용자 개입 횟수 기록 순서를 인계한다.
- [ ] `npm test`를 실행해 설치·공개 계약 문서의 회귀 검사를 통과시킨다.
