---
type: bouncer.epic
title: explain 인덱스 축소와 intent 거부 계약 정합
description: Shrink the coordinator block finalize writes into explain frontmatter to a task index, and make intent sections reject a non-canonical --task with exit 1 intent-task-invalid per contract
resource: .bouncer/context/epics/082-explain-index-intent-exit/index.md
tags:
  - bouncer
  - epic
  - explain
  - finalize
  - coordinator
  - intent
timestamp: '2026-10-01T15:11:05.362+09:00'
bouncer:
  id: '082'
  epic_id: '082'
  status: approved
  supersedes: []
---
# 082 explain 인덱스 축소와 intent 거부 계약 정합

## Intent
- 문제: finalize가 explain.md frontmatter에 coordinator 원장 전체(worktree 절대경로, 예상 scope, decisions 로그)를 복사해 081 explain 820줄 중 494줄이 frontmatter다. 081 계약은 `intent sections`의 비정규 `--task`를 exit 1 `intent-task-invalid`로 정했지만 CLI는 usage exit 2로 거절한다.
- 목표: explain frontmatter의 coordinator는 task별 브랜치·scope 개정·실제 변경 경로만 담고, `intent sections`는 계약대로 비정규 task 경로를 exit 1로 거절한다.

## Success criteria
1. `finalize --yes` 뒤 explain.md `bouncer.coordinator`의 키는 `integration_branch`, `tasks` 둘뿐이고, `tasks[]` 각 항목의 키는 `id`, `branch`, `scope_revision`, `actual_paths` 넷뿐이다.
2. 원장이 없는 finalize(provenance `null`)는 explain에 `bouncer.coordinator`를 쓰지 않고, `bouncer.task_commits` 기록은 이전과 같다.
3. `bouncer intent sections --task <비정규 경로> --role implementer`는 exit 1과 stdout `{ ok: false, reason: "intent-task-invalid" }`를 낸다. `--task` 누락·중복, 허용 밖 `--role`은 여전히 exit 2다.
4. `bouncer intent bundle --task <비정규 경로>`는 여전히 exit 2다.
5. `rules/cli.md`의 sections 실패 reason 목록에 `intent-task-invalid`가 있고, `rules/document-schema.md`가 explain `bouncer.coordinator` 형태를 적는다.
6. `CHANGELOG.md` `[Unreleased]`에 두 변경이 기록된다.
7. `npm run ci`가 통과한다.

## Out of scope
- 이미 닫힌 explain.md(068–081)의 coordinator 블록 재작성이나 migrate 명령.
- finalize digest의 `coordinator` 객체. PR·explain 작성이 DAG 변화와 decisions를 여기서 읽는다.
- `intent bundle`의 exit 2 경계.
- `prepareDependencies` marker 판정 강화, explain scaffold title·description 교체, `.bouncer/` repair 경로.

## Blueprints
* [001 explain coordinator 인덱스 축소와 intent sections 거부 정합](blueprints/001-coordinator-index-sections-exit/index.md) - `writeExplainCoordinator`가 쓰는 explain frontmatter와 `intent sections` 인자 파서를 `scripts/src/lib`에서 바꾸고 `rules/`에 반영한다
