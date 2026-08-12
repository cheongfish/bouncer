---
type: bouncer.epic
title: 029 release-one-zero
description: 1.0 호환 약속을 지탱할 표면 정리
resource: .bouncer/context/epics/029-release-one-zero/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-12T09:53:08.216+09:00'
bouncer:
  id: '029'
  epic_id: '029'
  status: approved
---
# 029 release-one-zero

## Intent
- 문제: 0.7까지 기능은 늘었지만 무엇이 공개 계약이고 무엇이 내부 구현인지 선언된
  적이 없다. 이 상태로 1.0을 찍으면 사후에 "그건 내부였다"고 변명하게 된다.
- 목표: 공개 표면을 확정하고, 그 표면을 지탱하지 못하는 지점(빈 게이트, 이중
  레이아웃, 흩어진 스킬 구조)을 1.0 전에 닫는다.

## Success criteria
1. 게이트 코드가 재편되어 commit 게이트가 비어 있지 않고, 폐기 번호(G15)가 어떤
   경로에서도 재사용되지 않는다.
2. blueprint 하나가 사람 확인 없이 task 소진까지 주행하고, 실패 시 정의된 지점에서
   멈춘다.
3. legacy root task 레이아웃(`tasks.md` / `tasks-<NNN>.md`)이 코드·문서 어디에서도
   살아 있는 경로로 취급되지 않는다.
4. 16개 스킬 `SKILL.md`가 같은 anatomy를 따르고, 워크플로 스킬이 플러그인 루트
   해석 산문을 각자 복제하지 않는다.
5. 공개 표면 목록과 하위 호환 정책이 `docs/`에 문서로 존재한다.

## Out of scope
- 기능 추가 — 1.0은 호환 약속이지 기능 완비가 아니다. 새 워크플로 단계나 새 문서
  종류를 늘리지 않는다.
- 게이트 판정 철학 변경 — 점수화·등급제는 pass/fail 게이트와 축이 달라 도입하지
  않는다(벤치마크는 워크플로 밖 도구로 분리).
- 외부 MCP 의존 도입 — 설치 장벽과 런타임 실패 지점을 늘린다.

## Blueprints
* [001 skill-structure](blueprints/001-skill-structure/index.md) - 16개 `SKILL.md`를 공통 anatomy로 정렬하고 워크플로 스킬의 플러그인 루트 산문을 `docs/install.md` 참조로 대체, 코드 주석 규칙을 `CLAUDE.md` 하드룰로 승격, 커밋 의도 작성 위치를 task 문서로 일원화(`finalize` 해석 경로 포함)
