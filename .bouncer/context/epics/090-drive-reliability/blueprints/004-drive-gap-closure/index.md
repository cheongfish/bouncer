---
type: bouncer.blueprint
title: 드라이브 잔여 공백 해소
description: Accept empty task commit sentence lists, observe implementer report files after early handbacks, and reinstall dependencies when the lockfile changes.
resource: .bouncer/context/epics/090-drive-reliability/blueprints/004-drive-gap-closure/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - recovery
  - dependencies
  - commit
timestamp: '2026-10-10T15:58:18.389+09:00'
bouncer:
  id: '004'
  epic_id: '090'
  blueprint_id: '004'
  status: closed
  commit_type: fix
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 004 드라이브 잔여 공백 해소

Epic: [090](../../index.md)

## Intent
- task 커밋이 빈 커밋 문장 목록을 받아들이고, 루트가 implementer 보고 파일로 조기 반환을 재개하며, lockfile이 바뀌면 의존성을 재설치하게 함.

## Contract
- 커밋 문장 목록: `normalizeAuthoredLines(raw, field)`는 `undefined`와 `[]`를 모두 `[]`로 반환한다. 원소 3개 이상·스칼라 문자열·비문자열 원소·한국어 종결형이 아닌 문장은 지금처럼 throw한다. `parseIntentBody`는 빈 `## Intent` 섹션을 지금과 같은 `blueprint Intent must contain 1-2 Korean terminal sentences` 오류로 계속 거절한다.
- 보고 파일 경로: `coordinate dispatch` 성공 JSON에 top-level `report_path`(절대 경로, `<workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md`)를 추가한다. `coordinate next`의 `implement` payload도 같은 `report_path`를 싣는다. implementer는 최종 보고를 반환하기 직전에 같은 본문을 이 경로에 쓴다.
- 보고 관측: `projectCheckpoint`는 `dispatch.status === 'active'`인 active task에만 원장에 저장하지 않는 `report` 필드를 붙인다.

  ```ts
  type ReportObservation = {
    path: string;            // <workerPath>/.bouncer/runtime/reports/<task>-<attempt>.md
    attempt: number;         // 현재 active dispatch attempt
    state: 'present' | 'absent';
  };
  ```

  `present`는 현재 attempt 이름의 일반 파일이 있고 크기가 0보다 클 때만이다. 이전 attempt 파일, 빈 파일, 디렉터리, 읽기 오류는 `absent`다. `executor_observation`은 `unknown`으로 남는다.
- 루트 판정: `/bouncer-run` step 4에서 관측이 `unknown`이고 현재 active attempt의 `report.state`가 `present`이면, 그 파일 본문을 데이터로 넘겨 기존 1회 복구 재개를 한다. `absent`이고 실제 호스트 핸들이 없으면 지금처럼 `worker-state-unknown`으로 보존 중단한다.
- 의존성 stamp: `prepareDependencies`는 `npm ci` 성공 뒤 `node_modules/.bouncer-lock-sha256`에 `package-lock.json` 원본 바이트의 sha256 hex를 쓴다. lockfile이 없으면 지금처럼 설치를 건너뛴다. lockfile이 있으면 npm marker와 일치하는 stamp가 모두 있을 때만 건너뛴다. 반환 타입과 `dependency-install-failed` 실패 계약은 그대로다.
- 실패 모드·엣지 케이스: stamp가 없거나 읽을 수 없거나 다르면 재설치한다. 설치 실패 시 stamp를 쓰지 않는다. 설치 성공 뒤 stamp 쓰기만 실패하면 `{ ok: true }`를 반환하고 다음 호출이 재설치한다. 보고 파일이 없거나 이전 attempt 것이면 `absent`이며 status는 원장 bytes를 바꾸지 않는다.
- 수용 기준: 에픽 수용 기준 10·11·12·13·14·15·16.
- 검증: 각 task의 `npm run ci`가 최종 검증이며 execute gate만 성공 증거를 기록한다.

## Out of scope
- reviewer·debugger 보고 파일, 읽기 전용 guard·Codex sandbox 변경, 호스트 Agent API·PID·heartbeat.
- 코디네이터 Close 직전 설치, npm 설치 인자·stdio 변경, finalize 설치 시점 변경.
- 이미 push된 커밋 본문 수정, 제안서 7절의 CLI·digest 개선.

## One-commit justification
세 task는 서로 다른 모듈을 바꾸지만 모두 090 드라이브에서 관찰된 잔여 정지 원인이다. 공유하는 `CHANGELOG.md`·`rules/cli.md`·`test/coordinator.test.js`를 depends_on 사슬로 순서대로 반영하고(뒤 task의 줄 번호는 앞 task 통합 뒤 이동할 수 있으므로 심볼·테스트 이름으로 찾는다), 하나의 blueprint 리뷰와 PR로 검토한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 빈 커밋 문장 목록 허용
* [Tasks 002](tasks/002/tasks.md) - implementer 보고 파일 관측
* [Tasks 003](tasks/003/tasks.md) - lockfile stamp 재설치
* [Review](review.md) - 실행 결과 리뷰
* [Context review](context-review.md) - 계획 문서 정합성 판정
