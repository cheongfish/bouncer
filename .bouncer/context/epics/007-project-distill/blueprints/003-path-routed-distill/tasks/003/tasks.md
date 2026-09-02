---
type: bouncer.tasks
title: Distill 샤드 구조 검사 추가
description: Tasks for 003
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/003/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.237+09:00'
bouncer:
  id: TASKS-003
  epic_id: '007'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 샤드 전환 전 누락된 규칙 경로를 드러내야 함
    - 기존 단일 파일 저장소의 동작을 바꾸지 않아야 함
  verify: npm test
  affected_paths:
    - scripts/src/lib/config.ts
    - scripts/lib/config.js
    - scripts/src/lib/init.ts
    - scripts/lib/init.js
    - scripts/src/lib/validate-structural.ts
    - scripts/lib/validate-structural.js
    - scripts/src/lib/validate.ts
    - scripts/lib/validate.js
    - scripts/src/lib/cli-project-commands.ts
    - scripts/lib/cli-project-commands.js
    - test/init.test.js
    - test/validate-structural.test.js
    - test/cli-project-commands.test.js
  graph:
    generated_at: '2026-08-14T12:56:28.237+09:00'
    command: mcp:graphify
    suggested_paths: []
    basis:
      - graph: source
        status: reused
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 68 nodes; source graph advisory result recorded for blueprint task
      - graph: context
        status: updated
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 8 nodes; context graph advisory result recorded for blueprint task
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
샤드 모드의 설정 기본값과 구조 경고를 추가하고, 선택 라우팅 활성화 시에는 남은 경고를 거부한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `routing_enabled: false`, byte 임계값 기본값과 고아·빈 샤드·누락 pulls·순환·source routing 구멍 진단.
- 거부: 인덱스 부재나 routing 비활성을 구조 오류로 만들지 않으며, 경고가 있는 활성화를 허용하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `scripts/src/lib/config.ts` — distill 설정 기본값과 읽기 계약을 추가한다.
- Modify `scripts/lib/config.js` — config TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/init.ts` — 기존 Distill을 옮기지 않고 비활성 설정만 seed한다.
- Modify `scripts/lib/init.js` — init TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/validate-structural.ts` — 샤드 구조와 활성화 조건을 검사한다.
- Modify `scripts/lib/validate-structural.js` — 구조 검사 TypeScript 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/validate.ts` — 구조 검사를 public validate 경로에 연결한다.
- Modify `scripts/lib/validate.js` — validate 연결 변경의 CJS emit을 동기화한다.
- Modify `scripts/src/lib/cli-project-commands.ts` — config의 routing_enabled를 CLI 라우팅에 반영한다.
- Modify `scripts/lib/cli-project-commands.js` — CLI 연결 변경의 CJS emit을 동기화한다.
- Modify `test/init.test.js` — 기존 단일 Distill 보존과 init 멱등성을 검증한다.
- Modify `test/validate-structural.test.js` — 모든 샤드 경고와 활성화 거부를 검증한다.
- Modify `test/cli-project-commands.test.js` — config 활성화와 fail-open CLI 결과를 검증한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/distill.ts` — 라우팅 계산은 task 001에서 확정한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 경고 도입은 샤드 모드에만 적용하고, routing 활성화 전에는 전량 소비가 유지된다.
- 새로운 S 코드는 기존 구조 코드와 충돌하지 않게 등록한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/validate-structural.test.js`에 고아·빈 비항상·누락 pulls·순환·라우팅 구멍의 실패 사례를 추가한다.
- [ ] config/init/구조 검사를 구현하고 기존 저장소 폴백을 유지한다.
- [ ] 구조 검사 호출과 config 기반 CLI routing을 연결하고 회귀 테스트를 추가한다.
- [ ] `npm run build`로 config/init/validate-structural CJS emit을 동기화한다.
- [ ] validate/CLI 변경의 CJS emit도 `npm run build`로 동기화한다.
- [ ] `npm test`를 실행한다.
