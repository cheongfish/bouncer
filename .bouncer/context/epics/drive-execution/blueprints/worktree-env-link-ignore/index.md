---
type: bouncer.blueprint
title: worktree 로컬 환경 링크의 슬래시 ignore 패턴 지원
description: Link the main checkout's ignored .venv/.env into worktrees even when .gitignore uses a trailing-slash pattern, hide the link via info/exclude, and report skips.
resource: .bouncer/context/epics/drive-execution/blueprints/worktree-env-link-ignore/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-22T17:07:56.145+09:00'
bouncer:
  id: worktree-env-link-ignore
  epic_id: drive-execution
  blueprint_id: worktree-env-link-ignore
  status: closed
  order: 60
  commit_type: fix
  scale: light
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: bouncer-run 단계의 worktree 준비 동작(로컬 환경 링크)이라 drive-execution에 귀속
  supersedes: []
---
# 060 worktree-env-link-ignore
Epic: [drive-execution](../../index.md) · Tasks: [001](tasks/001/tasks.md), [002](tasks/002/tasks.md)

## Intent
- `.gitignore`가 `.venv/`처럼 슬래시 패턴을 써도 main checkout의 `.venv`·`.env`가 worker·integration worktree에 연결되도록 고치고, 연결한 링크가 `git status`에 새지 않게 한다. 링크를 건너뛰면 그 이유를 출력해서 검증 실패의 원인이 조용히 묻히지 않게 한다.
