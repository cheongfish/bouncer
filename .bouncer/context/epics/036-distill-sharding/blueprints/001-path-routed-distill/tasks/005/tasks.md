---
type: bouncer.tasks
title: Distill 소비와 승격 계약 전환
description: Tasks for 005
resource: .bouncer/context/epics/036-distill-sharding/blueprints/001-path-routed-distill/tasks/005/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.304+09:00'
bouncer:
  id: TASKS-005
  epic_id: '036'
  blueprint_id: '001'
  status: ready
  commit_intent:
    - 워크플로가 단일 파일과 샤드 정본을 같은 CLI 계약으로 소비해야 함
    - 결정이 바뀔 때 이전 규칙을 전량 검색해 교체해야 함
  verify: npm test
  affected_paths:
    - CLAUDE.md
    - skills/bouncer-plan/SKILL.md
    - skills/bouncer-execute/SKILL.md
    - skills/bouncer-run/SKILL.md
    - skills/bouncer-finalize/SKILL.md
    - skills/discovery/SKILL.md
    - skills/spec-authoring/SKILL.md
    - test/master-rules.test.js
  graph:
    generated_at: '2026-08-14T12:56:28.304+09:00'
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
워크플로·discovery·spec-authoring·master rules를 호환 CLI 기반 Distill 소비와 전량 승격 검색 계약으로 바꾼다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: plan/discovery `distill --all`, 확정 후 plan re-ground와 execute/run `distill --for`, finalize `--all` 검색 및 `--route` 배치 계약.
- 거부: finalize가 선택 로드만 보고 기존 결정을 append하거나, workflow가 cwd 상대 Distill을 읽지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `CLAUDE.md` — Project Distill 읽기·승격 규칙을 CLI 계약으로 갱신한다.
- Modify `skills/bouncer-plan/SKILL.md` — 전량 preflight와 affected paths re-ground를 명시한다.
- Modify `skills/bouncer-execute/SKILL.md` — task affected paths로 선택 Distill을 읽게 한다.
- Modify `skills/bouncer-run/SKILL.md` — task별 선택 Distill re-ground를 명시한다.
- Modify `skills/bouncer-finalize/SKILL.md` — 전량 검색 후 route로 승격 대상을 정하게 한다.
- Modify `skills/discovery/SKILL.md` — 경로 확정 전 `distill --all` 소비를 명시한다.
- Modify `skills/spec-authoring/SKILL.md` — 바뀐 결정을 전량 검색·교체하는 승격 규약을 명시한다.
- Modify `test/master-rules.test.js` — 모든 workflow의 CLI 소비·승격 계약을 고정한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `scripts/src/lib/distill.ts` — 라우팅 동작 구현은 task 001의 계약을 유지한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- plan/discovery는 경로를 결정하기 전에 선택 라우팅하지 않는다.
- Distill과 과거 explain이 충돌하면 조용히 선택하지 않고 plan으로 에스컬레이트한다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] workflow별 단일 파일 폴백·CLI 모드 사용을 검증하는 테스트를 추가한다.
- [ ] 스킬과 master rule의 소비·승격 문구를 동기화한다.
- [ ] `npm test`를 실행한다.
