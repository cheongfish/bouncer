---
type: bouncer.blueprint
title: 실행 조정 책임과 planning 공개 경계 분리
description: Separate coordinator responsibilities, establish planning boundaries, and compare source metrics under one measurement protocol.
resource: .bouncer/context/epics/runtime-architecture/blueprints/execution-planning-boundaries/index.md
tags:
  - bouncer
  - blueprint
  - source-boundary
  - coordinator
timestamp: '2026-10-19T13:23:09.746+09:00'
bouncer:
  id: execution-planning-boundaries
  epic_id: runtime-architecture
  blueprint_id: execution-planning-boundaries
  status: closed
  order: 33
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  supersedes: []
---
# 실행 조정 책임과 planning 공개 경계 분리

Epic: [106](../../../source-restructuring/index.md)

## Intent
coordinator의 원장 저장·Git 작업·검증 호출과 명령 처리를 분리하고 planning의 읽기 API와 snapshot 공통 계약을 확정함.
기존 CLI·상태·증적 계약을 유지하며 동일 조건의 전후 측정 결과를 inventory에 기록함.

## Contract
- execution 공개 경계는 기존 `coordinator` 모듈이다. 기존 export 22개와 인자·반환·예외 계약을 보존한다. 명령 처리와 I/O 모듈은 영역 내부이며 다른 기능은 직접 가져오지 않는다. `execution-dag`와 `execution-contracts`는 기존 공통 도메인 계약이다.
- planning 공개 경계는 `plan-inspect.planInspect`, `plan-approve.approvePlan`, `plan-snapshot.computePlanSnapshot`·`computePlanParts`와 기존 `scaffold` 문서 생성 API다. `plan-snapshot-contract`는 snapshot 버전·정규화·hash·digest의 공통 계약이다. snapshot 읽기 API가 승인·scaffold를 함께 적재하는 집계 모듈은 만들지 않는다.
- `scope`는 여러 영역이 쓰는 경로·실행 상태 기반이며 `dag-shape`는 공통 DAG 계산이다. 둘을 planning 내부로 옮기지 않는다. scaffold의 `explain` 생성도 기존 공통 문서 생성 API로 유지한다.
- 데이터·상태: ledger, checkpoint, lease, snapshot version 2, approval 및 review payload의 직렬화 형식은 그대로다. 기존 helper export는 호환 재export로 남기며 신규 production 소비자는 공개 경계·공통 계약을 사용한다.
- 수용 기준: 에픽 4는 TASKS-001·002, 7은 TASKS-002·003, 8·9는 기존 계약 테스트 유지와 경계 검사·inventory, 10은 TASKS-004·005가 맡는다. 에픽 1·2·3·5·6은 회귀 검사로 보존하고, 11·12는 종단 전체 CI와 배포·emit 검사로 확인한다.
- 검증 구성: 구현 task는 각 frontmatter의 전용 명령을 실행하고, TASKS-006은 모든 commit task 통합 후 `npm run ci`를 실행한다. `plan.verify_command`에서 사용자가 이 구성을 확인했다.
- 측정 계약: 기준선 `c94947e7`과 구현 완료 커밋을 같은 Node 24 실행 파일·npm·환경 및 동일 도구로 측정한다. 정적 집계·적재·export·동일 탐색 suite·coverage·시간을 원본 JSON으로 보존한 뒤 inventory에 반영한다. 기존 과거 측정값은 별도 열로 보존한다.
- 실패 모드·엣지 케이스:
  - 원장 fence는 읽은 원본 bytes를 검사한다. stale hash, detached, 잠금 소유권 상실은 기존 reason으로 거절한다.
  - prepare·supplement·verification integrate·commit fan-in의 잠금 범위를 넓히지 않는다. 검증 후 재잠금에서 중간 checkpoint와 canonical HEAD를 다시 확인한다.
  - 의존성 설치 출력은 stderr로 보내 CLI stdout JSON을 보존한다. 설치 실패·runner 예외·CAS 실패가 성공 증거 또는 integrated 상태를 만들지 않는다.
  - 새 모듈에서 공개 facade를 역참조하거나 planning 계약이 승인·검증 오케스트레이터에 의존하면 경계 검사에서 거절한다.
  - baseline과 현재의 npm test 스크립트가 다르므로 동일 탐색 suite 측정과 revision별 npm test 시간은 별도 지표다. 누락된 coverage·비정상 종료·환경 불일치는 결과로 채워 넣지 않고 실패로 기록한다.

## Out of scope
- BP-001·002에서 끝낸 정책·DAG 정본, verification·delivery 분리의 재설계.
- CLI 출력·상태 전이·ledger·snapshot 버전 변경, 기존 export 삭제.
- 범용 DI·planning 집계 barrel, 디렉터리 일괄 이동, 테스트 fixture 일괄 재작성.
- `scripts/bouncer` launcher 수정과 루트의 미추적 제안 문서 다섯 개.
- public-name-regression 허용 목록의 내용 표식 전환. 기존 유지 판단과 남은 범위를 inventory에 명시한다.

## One-commit justification
각 task는 한 책임의 이동 또는 한 산출물에 한정한다. 원장·Git·검증 추출 뒤 명령 처리를 옮기고, planning과 측정 도구는 독립적으로 작성한다. inventory는 세 구현 결과와 실제 측정에 의존하므로 뒤에 둔다. 이 blueprint가 하나의 PR에서 에픽의 남은 수용 기준을 연결한다.

## Documents
- [TASKS-001](tasks/001/tasks.md): 원장·Git·검증 호출 책임 추출
- [TASKS-002](tasks/002/tasks.md): 명령 처리와 execution 공개 경계
- [TASKS-003](tasks/003/tasks.md): planning·snapshot 공통 계약
- [TASKS-004](tasks/004/tasks.md): 재현 가능한 측정 도구
- [TASKS-005](tasks/005/tasks.md): 실측 결과와 inventory 반영
- [TASKS-006](tasks/006/tasks.md): 통합 결과의 전체 CI 검증
- [Review](review.md)
- [Context review](context-review.md)
- [Explain](explain.md)

## 실행 이력·예외 처리

- `2026-10-19`: Bouncer 드라이브에서 TASKS-001~004의 integration 결과를 finalize 없이 `develop`에 병합했다. 병합 커밋은 `fbd3ba00`이며, 이 Blueprint의 namespace pointer는 이후 해제했다.
- Node 24 측정 중 확인된 coverage 옵션 순서와 reporter 호환성 문제는 `develop`에서 `2c5d1f0a` (`fix: support Node 24 boundary measurements`)로 수정했다. 변경은 `scripts/measure-source-boundaries.js`와 `test/source-boundary-measurement.test.js`에 한정했다.
- 검증으로 `npm run build`, `node --test test/source-boundary-measurement.test.js`(8 pass), Node `v24.21.0` snapshot을 실행했다. snapshot의 coverage 결과는 lines `95.32%`, branches `85.8%`, functions `98.21%`이며 build·suite·coverage·`npm test`의 종료 코드는 모두 `0`이었다.
- 이 기록은 당시의 예외 처리와 검증 사실을 보존하기 위한 것이며, Bouncer ledger·TASKS-005·TASKS-006의 상태 또는 gate 증적을 완료로 변경하지 않는다. integration worktree와 `.bouncer/runtime` 원본은 별도로 보존한다.
