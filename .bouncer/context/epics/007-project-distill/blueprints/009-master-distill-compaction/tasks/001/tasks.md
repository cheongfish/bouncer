---
type: bouncer.tasks
title: 마스터 규칙 압축
description: 필수 hard rule과 신뢰 경계 계약을 보존하면서 항상 읽는 마스터 규칙의 바이트를 줄인다
resource: .bouncer/context/epics/007-project-distill/blueprints/009-master-distill-compaction/tasks/001/tasks.md
tags:
  - bouncer
  - tasks
  - context
timestamp: '2026-08-28T13:44:23.892+09:00'
bouncer:
  id: TASKS-001
  epic_id: '007'
  blueprint_id: '009'
  status: verified
  commit_intent:
    - 모든 Bouncer 세션이 중복된 마스터 규칙 전문을 읽어 고정 입력 비용이 커짐
    - 필수 계약은 테스트로 보존하고 절차 중복만 걷어내 입력 비용을 줄임
  verify: npm run ci
  affected_paths:
    - CLAUDE.md
    - test/master-rules.test.js
  scope_evidence:
    producer: graphify
    generated_at: '2026-08-28T13:49:08+09:00'
    suggested_paths:
      - test
      - .bouncer/context/epics/007-project-distill/blueprints/003-path-routed-distill
      - .bouncer/context/epics/007-project-distill/blueprints/007-distill-shard-discipline
      - .bouncer/context/epics/004-starter-kit-convergence/blueprints/002-init-rules-scaffold
    basis:
      - graph: source
        status: updated
        query: CLAUDE master rules Distill hard rule trust boundary single-file fallback audit shard contract tests byte budget
        result: 84 nodes; top paths are test/master-rules.test.js and test/cli-project-commands.test.js
      - graph: context
        status: updated
        query: CLAUDE master rules Distill hard rule trust boundary single-file fallback audit shard contract tests byte budget
        result: 9 nodes; epic 036, 047, and 004 Distill contract blueprints
---
# Tasks

Blueprint: [001](../../index.md)

## Goal & intent
모든 Bouncer 세션이 읽는 `CLAUDE.md`를 8,765바이트에서 6,135바이트 이하로 줄인다. 11개 hard rule, 워크플로 순서, Distill 전체 감사·선택 읽기·단일 파일 폴백, 신뢰 경계의 동작 의미는 유지한다.

## Interface
- 제공: `CLAUDE.md`가 현재 hard rule 번호와 `Session conduct`, `When to invoke`, plugin-root 계약을 더 짧은 문장으로 제공한다. 세부 절차의 정본이 이미 `rules/`나 entry skill에 있으면 포인터를 사용하되 `test/master-rules.test.js`가 요구하는 안전 키워드는 마스터 규칙에 남긴다.
- 거부: 설치 캐시 편집, hard rule 번호 변경, 보조 스킬을 공개 entry point로 되돌리는 `When to invoke` 확장, Distill 본문을 마스터 규칙에 복사하는 변경을 허용하지 않는다.

## Touch
- Modify `CLAUDE.md` — 중복 설명을 정본 포인터와 밀도 높은 계약 문장으로 바꾼다.
- Modify `test/master-rules.test.js` — 기존 의미 단언을 유지하고 6,135바이트 상한을 추가한다.

## Do not touch
- `skills/**` — 워크플로 절차 자체는 이번 task의 압축 대상이 아니다.
- `agents/**` — named agent 역할 계약은 바꾸지 않는다.
- `.bouncer/distill/**` — Distill 압축은 task 002·003이 맡는다.
- `scripts/**` — 런타임과 게이트 구현은 바꾸지 않는다.

## Constraints
- `test/master-rules.test.js`의 기존 긍정·부정 단언을 약화하거나 삭제해 바이트 목표를 통과시키지 않는다.
- hard rule 7은 `--all`, `--preflight`, 반복 `--for`, `audit.shards`, `# <id>` 분할, id 집합 불일치, 단일 파일 폴백, aggregate 결과의 비정본성을 계속 명시한다.
- hard rule 11은 data와 instruction 경계를 한 곳에서 유지한다.
- 줄 수가 아니라 UTF-8 바이트로 판정한다.

## Checklist
- [ ] `test/master-rules.test.js`에 `Buffer.byteLength(claude, 'utf8') <= 6135` 단언을 먼저 추가하고 다음 명령이 크기 조건으로 실패하는지 확인한다.
  ```bash
  node --test test/master-rules.test.js
  ```
- [ ] 기존 정규식이 보호하는 계약을 목록으로 유지한 채 `CLAUDE.md`의 배경 설명과 스킬에 중복된 절차만 합치거나 포인터로 바꾼다.
- [ ] 설치 캐시 파일이 diff에 없고 저장소 정본 두 파일만 바뀌었는지 확인한다.
- [ ] 다음 명령과 전체 검증을 통과한다.
  ```bash
  node --test test/master-rules.test.js
  npm run ci
  ```
