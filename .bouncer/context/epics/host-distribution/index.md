---
type: bouncer.epic
title: 115 host-distribution
description: 'Plugin distribution surface: host manifests, init and install, release and public contract'
resource: .bouncer/context/epics/host-distribution/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-10-20T16:05:56.169+09:00'
bouncer:
  id: host-distribution
  epic_id: host-distribution
  status: approved
  supersedes: []
---
# 115 host-distribution

## Intent
- 문제: 기능 영역이 같은 작업이 legacy epic 63개에 흩어져 있고, 등록부 도입 뒤 이 저장소에는 새 blueprint를 만들 활성 epic이 없다.
- 목표: 이 epic이 `host-distribution` 영역의 새 blueprint를 받는다. 포함: 플러그인 배포 표면: 호스트(Claude·Codex·Cursor·Antigravity) 매니페스트와 launcher, `bouncer init`과 설치, 릴리스·공개 계약·보안 기준선, 빌드 산출물 배포

## Success criteria
1. `host-distribution` 영역에 속하는 새 계획은 이 epic 아래 blueprint로 만든다.
2. 아래 legacy epic은 `legacy`로 그대로 두고 조회·이력에만 쓴다. 승인·검증 해시와 trailer 연결을 바꾸지 않는다.

## Out of scope
- 워크플로 단계별 동작 변경 → 해당 단계 영역
- legacy epic의 물리적 이관. 이 epic은 논리적 병합만 한다.
- legacy epic에 남은 미완료 blueprint는 모두 closed로 간주하고 상태를 바꾸지 않았다.

## Legacy epic 귀속
Epic 기능 분류의 매핑이다. △는 일부 blueprint가 다른 영역에 귀속된다는 뜻이다.

- [product-surface-hosts](../product-surface-hosts/index.md) △
- [release-security](../release-security/index.md)
- [roadmap-closeout](../roadmap-closeout/index.md)

### 다른 epic에서 이 영역으로 귀속되는 blueprint
| legacy epic | blueprint | 이유 |
| --- | --- | --- |
| 061 | 004 | 배포 유지보수 |

## Blueprints
없음. 첫 blueprint는 `/bouncer-plan`으로 추가한다.
