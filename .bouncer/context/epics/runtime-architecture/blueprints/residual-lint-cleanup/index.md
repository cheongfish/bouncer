---
type: bouncer.blueprint
title: 분할 후 남은 lint 오류와 worktree lint 범위를 정리함
description: Remove the unused type imports and the structuredClone no-undef error left after the workflow split, and ignore .worktrees in ESLint so npm run ci passes from the main checkout.
resource: .bouncer/context/epics/runtime-architecture/blueprints/residual-lint-cleanup/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T10:56:09.277+09:00'
bouncer:
  id: residual-lint-cleanup
  epic_id: runtime-architecture
  blueprint_id: residual-lint-cleanup
  status: approved
  order: 41
  commit_type: fix
  scale: light
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: CLI·런타임 소스와 lint 설정의 정리로 workflow-responsibility-split 후속이라 runtime-architecture에 귀속
  supersedes: []
---
# 041 분할 후 남은 lint 오류와 worktree lint 범위를 정리함
Epic: [runtime-architecture](../../index.md) · Tasks: [001](tasks/001/tasks.md) · [002](tasks/002/tasks.md)
## Intent
PR #254로 병합된 workflow-responsibility-split 이후 `develop`에 lint 오류 3건이 남아 `npm run ci`가 실패하고, git-ignore 대상인 `.worktrees/` 아래 파일까지 ESLint가 검사해 main checkout의 lint가 887건을 더 보고한다.
미사용 type import를 지우고 `structuredClone`을 Node 전역으로 선언하며 `.worktrees/**`를 ESLint ignore에 넣어, 동작 변경 없이 `npm run ci`가 통과하면 끝난다.
