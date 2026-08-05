---
type: bouncer.distill
title: 001 distill
description: Distill for 001
resource: .bouncer/context/epics/011-graphify-signal/blueprints/001-silent-skip-signal/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-04T16:03:05.120+09:00'
bouncer:
  id: DISTILL-BP-001
  epic_id: '011'
  blueprint_id: '001'
  status: published
---
# Distill

## Cycle notes
- `missing`과 `failed`는 다른 질문이다. 빌드가 던져도 이전 `graph.json`이 있으면
  missing이 아니고, dirs가 있어 빌드를 시도했다가 실패한 스코프에 "dirs 부재"
  문구를 붙이면 훅 stderr가 거짓 신호를 낸다.
- graphify-runner 스킵은 source 그래프만 본다. context만 살아 있어도 source가
  없으면 우아한 스킵이다.

## Promote (durable)
- Gotcha: `graphSyncWarnings`의 missing 문구는 `skip-no-dirs`/empty `dirs`에만
  "none of … exist"를 쓰고, `failed`에 이미 있는 스코프는 missing 줄을 내지 않는다.
- Decision: 그래프 부재는 오류가 아니라 상태다 — `missing`은 `ok:false`를 뒤집지
  않으며, 옵트인하지 않은 경로(`NO_GRAPH_WORK`)에서는 빈 배열이다.

## Next
- 002: `source_dirs` 기본값과 신선도/path 계약.
