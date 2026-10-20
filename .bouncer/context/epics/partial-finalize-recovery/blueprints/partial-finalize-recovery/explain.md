---
type: bouncer.explain
title: 실패 drive의 부분 마감과 재개 설계
description: Explains how failed drives are handed off without being marked successful and how approved owners resume.
resource: .bouncer/context/epics/partial-finalize-recovery/blueprints/partial-finalize-recovery/explain.md
tags:
  - bouncer
  - explain
  - partial-finalize
  - owner-recovery
timestamp: '2026-10-20T08:58:19.025+09:00'
bouncer:
  id: EXPLAIN-partial-finalize-recovery
  epic_id: partial-finalize-recovery
  blueprint_id: partial-finalize-recovery
  status: draft
  comprehension: []
---
# Explain

## Background

실패한 drive는 성공과 같은 방식으로 닫을 수 없다. 실패 원인과 검증 증거를 보존하면서도 사용자가 선택적으로 후속 조치를 할 수 있어야 한다. 이 설계는 일반 finalize와 부분 마감을 분리하고, 명시 동의가 없으면 main 병합·포인터 해제·worktree 정리를 수행하지 않는다. 실패를 `closed`나 통과한 verification으로 바꾸지 않는 것이 핵심 경계다.

복구가 승인된 task의 기존 코드에 속할 때는 그 owner를 새 generation으로 재개한다. 이전 결과가 최신인 것처럼 downstream을 계속 쓰지 않도록 의존 관계를 다시 연결하고, terminal verification은 새 upstream 결과가 통합된 뒤에만 실행한다.

## Code

- `scripts/src/lib/coordinator-commands.ts`는 partial-close 증거와 원장 전이를 확인하고, owner 재개 시 generation·salvage·downstream 상태를 조정한다. 잘못된 fence나 실패한 salvage는 상태 변경 없이 거절한다.
- `scripts/src/lib/runtime-state.ts`와 `scripts/src/lib/validate-gates.ts`는 부분 마감의 원장 불변식과 handoff 증거를 검사한다. 일반 성공 검증과 부분 종료 상태는 서로 대체할 수 없다.
- `scripts/src/lib/finalize.ts`, `scripts/src/lib/finalize-release-main.ts`, `scripts/src/lib/finalize-digest.ts`와 CLI handler는 partial-finalize 정보를 미리 보여주고, 명시적인 부분 병합 동의가 있을 때만 integration HEAD를 `[partial]` 표식과 함께 적용한다.
- `scripts/src/lib/execution-contracts.ts`와 `scripts/src/lib/coordinate-next.ts`는 복구 상태의 계약과 다음 행동을 정한다. terminal verification 실패에서는 원문 증거를 복사하지 않고 integration 안의 `verification.md` 경로와 SHA256 포인터를 제공해, 판정자가 동일한 증거 파일인지 확인할 수 있게 한다.

부분 마감은 해결 완료가 아니라 명시적인 미해결 인계다. 재개 가능한 코드 원인, 범위 밖 원인, 혼합 원인을 구분할 수 없으면 성공이나 범위 밖으로 임의 분류하지 않고 차단 상태를 보존한다.

## Quiz

1. 실패 drive를 partial-finalize할 때 유지해야 하는 상태는 무엇인가?
   - a) 실패 증거를 보존하고 `closed`나 성공 verification으로 바꾸지 않는다
   - b) 모든 task를 통과로 바꾼 뒤 일반 finalize와 같은 결과를 낸다
   - c) handoff를 지우고 pointer만 해제한다

2. main에 partial merge를 적용하려면 어떤 조건이 필요한가?
   - a) `--yes`만 있으면 충분하다
   - b) 별도 확인 없이 integration HEAD를 항상 병합한다
   - c) `--allow-partial-merge`와 별도의 명시적 확인이 모두 필요하다

3. 승인 범위 안 owner task를 재개한 뒤 오래된 downstream 결과는 어떻게 다루는가?
   - a) 기존 결과를 유지하고 terminal verification만 다시 실행한다
   - b) transitive downstream을 새 owner 결과 뒤로 재연결한다
   - c) 새 owner 실행을 기다리지 않고 partial-close한다

4. terminal verification 실패 증거 포인터가 가리키는 정보는 무엇인가?
   - a) 원장 전체의 복사본과 모든 로그 본문
   - b) verification 문서의 경로와 해당 파일의 SHA256
   - c) 실패를 통과로 바꾼 상태 기록
