---
type: bouncer.tasks
title: Distill 선택 라우팅 활성화
description: Tasks for 007
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/007/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.372+09:00'
bouncer:
  id: TASKS-007
  epic_id: '007'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 전량 모드 관찰 뒤에만 선택 라우팅을 켜야 함
    - 활성화가 규칙 누락을 조용히 만들지 않게 검증해야 함
  verify: npm test
  affected_paths:
    - .bouncer/config.json
    - test/distill.test.js
    - docs/configuration.md
  graph:
    generated_at: '2026-08-14T12:56:28.372+09:00'
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
이 저장소의 routing을 명시적으로 활성화하고, 대표 경로와 fail-open 결과를 기록해 dogfood 전환을 완료한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `distill.routing_enabled: true`인 dogfood config와 대표 파일·디렉터리·복수 경로 route 검증 기록.
- 거부: 구조 경고가 남은 상태, 경로 미매칭, 임계값 초과에서 규칙을 잘라내거나 활성화를 성공으로 기록하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `.bouncer/config.json` — 이 저장소에서만 선택 라우팅을 명시 활성화한다.
- Modify `test/distill.test.js` — 파일·디렉터리·복수 경로·fail-open과 byte 경고 계약을 검증한다.
- Modify `docs/configuration.md` — routing 활성화·임계값·경고의 운영 의미를 설명한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `.bouncer/distill/` — shard 내용과 분배는 task 006에서 확정한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 활성화 전에 validator 구조 경고가 없어야 하며, `routing_enabled`만 선택 소비를 시작하게 한다.
- 결과 크기는 상한이 아니고 경고만 stderr로 내며, 대표 결과의 bytes를 커밋에서 확인 가능하게 남긴다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 활성화 전 구조 검사와 대표 route 결과의 실패 테스트를 추가한다.
- [ ] config와 문서를 갱신하고 파일·디렉터리·복수 경로·미매칭을 실행한다.
- [ ] `npm test`를 실행한다.
