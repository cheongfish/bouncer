---
type: bouncer.tasks
title: Distill 샤드 라우터 추가
description: 샤드 인덱스 해석과 보수적 경로 라우팅
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.171+09:00'
bouncer:
  id: TASKS-001
  epic_id: '007'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - Distill 규칙을 버리지 않고 반복 소비량을 줄여야 함
    - 경로 불확실성이 규칙 누락으로 이어지지 않게 해야 함
  verify: npm test
  affected_paths:
    - scripts/src/lib/distill.ts
    - scripts/lib/distill.js
    - scripts/src/lib/layout.ts
    - scripts/lib/layout.js
    - test/distill.test.js
  graph:
    generated_at: '2026-08-14T12:56:28.171+09:00'
    command: graphify query source+context
    suggested_paths:
      - scripts/src/lib
      - test
      - .bouncer/context
    basis:
      - graph: source
        status: reused
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 68 nodes; test/init.test.js, test/skill-bouncer-surface.test.js, test/helpers/read-skill.js 중심
      - graph: context
        status: updated
        query: Project Distill sharding path routing router CLI validation context digest graph scope finalize workflow skills
        result: 8 nodes; .bouncer/context/epics/007-project-distill 및 026 context digest 설명 포함
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
<!-- 구현자가 다른 문서 없이 시작할 수 있게.
     수용 기준과 검증 명령도 여기에 적거나 Checklist에 명시한다. -->
유효한 샤드 인덱스를 읽고, 경로·`always`·`pulls`를 보수적으로 해석해 렌더할 라이브러리를 만든다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `readShards`, `routeShards`, `renderShards`가 단일 파일 폴백, 전량, 선택 결과를 결정적으로 만든다.
- 거부: 유효하지 않은 인덱스를 샤드 모드로 추측하지 않으며, 불확실한 경로는 제외하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Create `scripts/src/lib/distill.ts` — 인덱스·샤드 읽기, 경로 교집합, pulls 전이 폐쇄와 렌더링을 구현한다.
- Create `scripts/lib/distill.js` — Node-only 소비자를 위한 TypeScript CJS emit을 동기화한다.
- Modify `scripts/src/lib/layout.ts` — Project Distill 및 shard 경로 상수를 단일 출처로 둔다.
- Modify `scripts/lib/layout.js` — layout 상수 변경의 CJS emit을 동기화한다.
- Modify `test/distill.test.js` — 인덱스 판별, 파일·디렉터리·불확실 교집합, pulls, fail-open과 단일 파일 폴백을 고정한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/cli-project-commands.ts` — CLI 배선은 다음 task에서 다룬다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- POSIX 상대 경로를 사용하고, 단순 glob 한 번으로 디렉터리 범위를 누락하지 않는다.
- 라우팅 결과는 `always`와 매칭 샤드의 pulls 전이 폐쇄를 포함하며 매칭 0은 전량 로드다.
- 새 의존성이나 범용 라우팅 프레임워크는 추가하지 않고, 기존 `runtimePaths`·`layout`과 Node 표준 라이브러리를 재사용한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] `test/distill.test.js`에 유효 인덱스·단일 파일·경로 교집합·pulls·fail-open의 실패 사례를 추가한다.
- [ ] 실패를 확인한 뒤 라이브러리와 경로 상수를 구현한다.
- [ ] `always: true` shard에서 `paths` 생략과 malformed metadata의 fail-open을 회귀 검증한다.
- [ ] `npm run build`로 `scripts/lib/distill.js`와 `scripts/lib/layout.js` CJS emit을 동기화한다.
- [ ] `npm test`가 통과하는지 확인한다.
