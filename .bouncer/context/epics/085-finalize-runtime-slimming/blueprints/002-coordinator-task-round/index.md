---
type: bouncer.blueprint
title: coordinator 회차 계약 이전
description: The coordinator role document carries its own task-round contract so a drive session never loads skills/bouncer-execute/SKILL.md.
resource: .bouncer/context/epics/085-finalize-runtime-slimming/blueprints/002-coordinator-task-round/index.md
tags:
  - bouncer
  - blueprint
  - coordinator
  - drive
  - token-cost
timestamp: '2026-10-02T15:50:38.415+09:00'
bouncer:
  id: '002'
  epic_id: '085'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# 002 coordinator 회차 계약 이전

Epic: [085](../../index.md)

## Intent
coordinator가 세션마다 `skills/bouncer-execute/SKILL.md`를 읽지 않고, 자기 역할 문서의 회차 계약 절만으로 한 task 회차를 진행한다. drive 세션 첫 task의 지침 고정 비용을 줄인다.

## Contract
- 인터페이스
  - `agents/bouncer-coordinator.md`에 `## Task round` 절이 생긴다. 이 절이 drive 한 task 회차의 계약을 소유한다: intent bundle 고정(`bouncer intent bundle` 1회, `task_brief_hash`·`intent_bundle_id`·`intent_bundle_revision` 고정, 역할별 `bouncer intent sections`), scope revision 뒤 bundle 재검증, verification 준비(scaffold된 `verification.md`를 쓰고 증적을 직접 쓰지 않음, 구현 완료 뒤 `tasks → verified`), worker cwd에서 `bouncer validate --blueprint <dir> --gate execute` 통과.
  - Procedure 3단계의 "Read `skills/bouncer-execute/SKILL.md` once per session" 지시가 없어지고 `## Task round`를 가리킨다.
  - `skills/bouncer-execute/SKILL.md` 첫 Controller 문단이 "drive에서는 coordinator가 이 스킬을 읽지 않고 역할 문서의 `## Task round`를 따른다"고 적는다.
  - `.codex/agents/bouncer-coordinator.toml`은 `mdToCodexToml(agents/bouncer-coordinator.md)` 결과와 바이트 단위로 같다.
- 데이터·상태: 원장, CLI, gate는 바뀌지 않는다.
- 수용 기준: epic 085 성공 조건 7과 9.
- 검증 명령: TASKS-001은 `npm test`, 종단 TASKS-002는 `npm run ci`.
- 실패 모드·엣지 케이스
  - execute SKILL은 단독 `/bouncer-execute`용 절차(intent bundle, scope revision 재검증, verification)를 그대로 갖는다. drive 회차의 정본은 `## Task round` 하나이며, execute SKILL의 Controller 문단은 drive에서 그 절을 따른다고 가리키기만 하고 drive 절차를 새로 쓰지 않는다.
  - TOML을 손으로 고치면 패리티 테스트가 실패한다. 생성 함수로만 만든다.
  - `agent-dispatch.md`·`review-round.md`·`verification-recovery.md`를 필요할 때 읽는 기존 규칙과 "역할 문서를 다시 Read하지 않는다" 규칙은 그대로다.

## Out of scope
- coordinator CLI(`scripts/src/lib/coordinator.ts`)와 원장 형식
- 단독 `/bouncer-execute`의 절차
- `skills/bouncer-run/SKILL.md`의 dispatch payload
- 토큰 사용량 재측정(후속 확인이며 수용 기준이 아니다)

## One-commit justification
- 역할 문서, 그 생성본 TOML, execute SKILL의 가리킴 문장, 그것을 단언하는 테스트가 한 계약의 네 면이라 따로 커밋하면 패리티나 정본 단언이 중간 커밋에서 깨진다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - coordinator 회차 계약 절 추가와 execute SKILL 읽기 제거
* [Tasks 002](tasks/002/tasks.md) - 종단 CI 검증
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
