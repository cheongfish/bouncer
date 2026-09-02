---
type: bouncer.tasks
title: 현행 Distill 샤드 분배
description: Tasks for 006
resource: .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill/tasks/006/tasks.md
tags:
  - bouncer
  - tasks
timestamp: '2026-08-14T12:56:28.337+09:00'
bouncer:
  id: TASKS-006
  epic_id: '007'
  blueprint_id: '003'
  status: verified
  commit_intent:
    - 현행 규칙을 빠짐없이 새 정본 구조로 옮겨야 함
    - 선택 라우팅 전에도 전량 소비로 안전성을 관찰해야 함
  verify: npm test
  affected_paths:
    - .bouncer/Distill.md
    - .bouncer/distill/core.md
    - .bouncer/distill/validate-gates.md
    - .bouncer/distill/context-layout.md
    - .bouncer/distill/git-worktree.md
    - .bouncer/distill/graph.md
    - .bouncer/distill/plugin-skills.md
    - .bouncer/distill/build-ts.md
    - test/distill.test.js
  graph:
    generated_at: '2026-08-14T12:56:28.337+09:00'
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
현행 Distill 불릿을 사람의 내용 판단으로 7개 경로 샤드에 분배하고, 원본은 유효한 인덱스와 요약으로 축소한다.

## Interface
<!-- 계약이 리뷰에서 검증 가능하도록 제공하는 것과 거부하는 것을 함께 적습니다. -->
- 제공: `core`, `validate-gates`, `context-layout`, `git-worktree`, `graph`, `plugin-skills`, `build-ts` 샤드와 이를 열거하는 Distill 인덱스.
- 거부: 문장 자동 분류·임의 삭제, routing 활성화, 인덱스에 없는 shard 생성을 하지 않는다.

## Touch
<!-- frontmatter bouncer.affected_paths의 모든 경로가 여기서 정당화되어야 합니다 (G11).
     디렉터리가 아니라 파일 단위로, 동사(Create/Modify/Delete/Rename)를 붙입니다.
     디렉터리 하나로 뭉치면 그 안 모든 파일이 열려 G11이 사실상 통과만 합니다.
     경로는 백틱으로 감쌉니다. -->
- Modify `.bouncer/Distill.md` — 단일 파일 본문을 shard 선언과 한 줄 요약 인덱스로 바꾼다.
- Create `.bouncer/distill/core.md` — 항상 읽을 워크플로·문서·신뢰 경계 규칙을 담는다.
- Create `.bouncer/distill/validate-gates.md` — G/S와 validate 규칙을 담는다.
- Create `.bouncer/distill/context-layout.md` — context id·task layout·migration 규칙을 담는다.
- Create `.bouncer/distill/git-worktree.md` — worktree·commit hook·finalize 규칙을 담는다.
- Create `.bouncer/distill/graph.md` — graphify·digest·graph-scope 규칙을 담는다.
- Create `.bouncer/distill/plugin-skills.md` — manifest·skill·named agent 규칙을 담는다.
- Create `.bouncer/distill/build-ts.md` — TypeScript emit·CJS·vendor require 규칙을 담는다.
- Modify `test/distill.test.js` — 분배 전후 전량 렌더링과 인덱스 유효성을 감사한다.

## Do not touch
<!-- 여기 적은 경로가 affected_paths와 겹치면 G12가 막습니다.
     epic / blueprint의 Out of scope에서 이어받습니다. -->
- `.bouncer/config.json` — 선택 라우팅 활성화는 task 007에 한정한다.

## Constraints
<!-- 경로로 표현되지 않는, 작업 전체에 걸리는 규칙. 허용된 파일 안에서도 지켜야 합니다.
     예: 하위 호환 별칭을 남기지 않는다 / 기존 게이트 번호와 본문 계약을 유지한다 /
     공개 문자열은 한국어를 유지한다.
     막을 대상이 경로뿐이면 Do not touch에 적습니다. -->
- 각 기존 불릿은 의미를 읽고 분배하며, 한 규칙이 두 영역이면 중복 게재를 허용한다.
- 모든 shard는 `## Invariants`, `## Gotchas`, `## Decisions` 헤딩을 유지하고 routing은 `false`로 남긴다.

## Checklist
<!-- 각 항목은 구현자가 순서대로 실행 가능해야 합니다.
     행위를 바꾸는 항목은 실패 테스트 → 실패 확인 → 구현 순서로 적습니다.
     기대하는 assertion·상수·명령은 코드블록으로 그대로 적어 해석 여지를 없앱니다.
     blueprint Contract에서 이연된 테스트 본문·구현 시퀀스가 들어올 자리입니다.
     수용 기준·검증 명령을 체크 항목으로 포함하세요. -->
- [ ] 현재 Distill 전량을 기준으로 불릿 보존 감사 조건을 추가한다.
- [ ] 7개 shard와 인덱스를 사람이 분류해 작성한다.
- [ ] `bouncer distill --all`과 `npm test`로 전량 결과와 구조를 확인한다.
