---
type: bouncer.distill
title: 마감 인계 distill
description: Distill for 001 next-blueprint-handoff
resource: .bouncer/context/epics/012-finalize-handoff/blueprints/001-next-blueprint-handoff/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-05T08:58:15.018+09:00'
bouncer:
  id: DISTILL-BP-001
  epic_id: '012'
  blueprint_id: '001'
  status: published
---
# Distill

## 승격 대상 (durable)

- Gotcha: `finalize`는 `nextBlueprint` 반환 객체 전체를 `next` 필드에 싣는다.
  후보는 `next.next`, 겹침은 `next.next.sharedPaths`, 남은 목록은
  `next.remaining`이다. 스킬·문서가 평탄한 `next.sharedPaths`를 읽으면
  경고를 건너뛴다.
- Decision: 다음 블루프린트는 상태 파일이 아니라 마감 시점의 계산이다.
  원천은 `listReadyBlueprints` + 에픽 `## Blueprints` 링크 순서이고, 포인터
  전진은 승낙 뒤 `bouncer current --set`만 한다(자동 전진·새 CLI 없음).

## 사이클 메모 (승격하지 않음)

- 리뷰 major: 인계 단계에서 `--set` 블록이 "명령만 보여주기" 분기에만 붙어
  있으면 승낙 후에도 실행하지 않을 수 있다. If yes / If no를 분리해야 한다.
- Cursor `Task` 도구의 subagent_type 목록에 `bouncer-implementer` /
  `bouncer-reviewer`가 없으면 `subagents.provider: "cursor"`만으로는 named
  호출이 안 되고 generic/inline fallback이 된다. provider pin과 호스트
  named-agent 지원은 별개다.
- 플러그인 캐시 스킬이 저장소 스킬보다 오래된 경우(`seed-worktree` 인자
  `--to` vs `--worktree`) 캐시 경로로 실행하면 시드가 실패한다. dogfood
  finalize/execute는 워크트리(또는 `BOUNCER_HOME`=repo)의 `scripts/bouncer`를
  쓰는 편이 안전하다.
