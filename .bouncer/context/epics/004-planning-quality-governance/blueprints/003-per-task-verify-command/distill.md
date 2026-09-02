---
type: bouncer.distill
title: 003 distill
description: Distill for 003
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/003-per-task-verify-command/distill.md
tags:
  - bouncer
  - distill
timestamp: '2026-08-02T23:44:42.331Z'
bouncer:
  id: DISTILL-BP-003
  epic_id: '004'
  blueprint_id: '003'
  status: published
---
# Distill

## 승격 대상 (durable)

- 검증 명령 해석 순서는 `tasks.bouncer.verify`(있으면) → `config.verify`다.
  필드·`tasks.md`가 없으면 전역으로 내려가고, 둘 다 없으면 기존
  `VERIFY_CONFIG_INVALID`를 유지한다.
- 형식 판정은 `isValidVerifyCommand` 한 곳만 소유한다. plan `S12`와 runtime
  `VERIFY_COMMAND_INVALID`가 같은 술어를 쓰므로 정규식을 validate 쪽에
  복제하지 않는다.
- 선언은 단일 실행 가능 argv 문자열만 허용한다 — 셸 체이닝·리다이렉션·`cd`
  접두를 거절해 증적 문자열이 저장소 루트에서 그대로 재현되게 한다.
- `verification.md`는 `recordVerificationResult`가 통째로 다시 쓰므로 작성자
  선언을 담을 수 없다. 검증 범위 선언은 `tasks.md`의 `bouncer.verify`에 둔다.
- 필드가 **있는데** 형식이 틀리면 전역으로 조용히 폴백하지 않는다 — plan
  `S12` 누락을 숨기게 된다.

## 사이클 회고 (승격하지 않음)

- 선언 우선·형식 거절 실패 테스트를 먼저 넣고 구현하니 Checklist 회귀가
  바로 잡혔다. 한 인자 `readVerifyCommand(repo)` 호환 테스트가 하위 호환을
  고정했다.
- execute 게이트는 돌릴 때마다 `verification.md` 증적(시각·tail)을 갱신한다.
  게이트 통과 확인 후 다시 validate하면 트리가 다시 dirty해지므로, 최종
  증적 커밋 뒤에는 확인용 재실행을 하지 않는 편이 낫다.

## 다음 후보

- 검증 명령이 `affected_paths`를 실제로 덮는지 검사하는 게이트는 이번
  범위 밖이다 — 판정 근거가 없어서 별도 BP가 필요하다.
- 여러 명령의 선언·병렬 실행은 단일 명령 형식 제약과 충돌하므로 받지 않는다.
