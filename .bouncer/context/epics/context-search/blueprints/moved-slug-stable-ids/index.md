---
type: bouncer.blueprint
title: 병합 이관이 옮긴 문서의 slug stable ID를 도메인 epic으로 다시 씀
description: Rewrite slug-form stable IDs of merged legacy blueprints to their domain epic
resource: .bouncer/context/epics/context-search/blueprints/moved-slug-stable-ids/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-21T10:12:05.537+09:00'
bouncer:
  id: moved-slug-stable-ids
  epic_id: context-search
  blueprint_id: moved-slug-stable-ids
  status: closed
  order: 3
  commit_type: fix
  scale: light
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: 병합 이관의 stable ID 재작성 누락은 식별자·컨텍스트 이관 재작성 영역이라 context-search에 귀속
  supersedes: []
---
# 병합 이관 slug stable ID 재작성
Epic: [context-search](../../index.md) · Tasks: [001](tasks/001/tasks.md)
## Intent
- legacy epic 병합 이관이 옮긴 blueprint 문서 안의 slug 형식 stable ID(`<legacy>/<bp>[/<ddd>]`)를 도메인 epic 위치(`<domain>/<bp>[/<ddd>]`)로 다시 쓴다. 옮긴 Explain의 `task_commits`와 `### ` 제목이 `epic_id`와 일치해 ontology identity 검사를 통과하고 intent-provenance 행을 잃지 않으면 끝이다.
