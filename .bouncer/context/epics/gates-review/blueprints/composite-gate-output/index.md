---
type: bouncer.blueprint
title: gate 실패 출력의 복합 gate 요약
description: Summarize validate failures into seven composite gates and tag boundary rejection reasons with the same gate names
resource: .bouncer/context/epics/gates-review/blueprints/composite-gate-output/index.md
tags:
  - bouncer
  - blueprint
  - validate
  - gate-output
  - composite-gate
  - commit-hook
timestamp: '2026-10-22T16:12:42.715+09:00'
bouncer:
  id: composite-gate-output
  epic_id: gates-review
  blueprint_id: composite-gate-output
  status: closed
  order: 15
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: validate 실패 출력의 gate 판정 표시를 바꾸는 작업이라 gate·검증·리뷰 판정 epic에 귀속
  supersedes: []
---
# gate 실패 출력의 복합 gate 요약

Epic: [gates-review](../../index.md)

## Intent
`bouncer validate` 실패를 G-code 16개 대신 복합 gate 7개의 이름·대상·복구 행동 하나로 먼저 보여 주도록 결과에 `gates[]` 요약을 추가했다. commit·coordinator·commit hook의 경계 거절 reason에도 같은 복합 gate 이름을 붙여 사용자가 실패 원인을 한 체계로 읽게 했다.

## Contract
- 인터페이스:
  - `validateBlueprint` 결과는 G-code 실패가 있을 때만 `gates: CompositeGateSummary[]`를 싣는다(`warnings`와 같은 방식). 기존 `ok`·`failures[]`·`warnings`는 그대로다.
  - `current --set`·`bouncer commit`·`finalize`의 validate 실패 payload는 `failures` 옆에 같은 `gates`를 싣는다.
  - `bouncer commit` 실패 JSON과 `coordinate` 실패 payload는 매핑된 reason에만 `gate: CompositeGateId`를 갖는다. `finalize`의 경계 거절은 `gate`를 갖지 않는다(Out of scope).
  - commit hook 거절 줄은 매핑된 reason일 때 맨 앞에 `[<label>] `를 붙인다(예: `[커밋 범위] commit blocked: main-worktree-source-write: …`). 그 뒤 문자열은 지금과 같다.

```ts
type CompositeGateId = 'plan-activation' | 'scope-declaration' | 'execution-topology'
  | 'verification-evidence' | 'commit-scope' | 'freshness-approval' | 'closeout-completeness';
type CompositeGateSummary = {
  gate: CompositeGateId; label: string;  // label: 한국어 이름(예: '검증 증적')
  codes: string[];    // 이 gate에 속한 실패 G-code, 첫 등장 순서, 중복 없음
  targets: string[];  // 해당 failures의 file, 빈 문자열 제외, 첫 등장 순서, 중복 없음
  next: string;       // 첫 실패 항목의 hint next, 없으면 gate 기본 복구 문장
};
```

- 데이터·상태: 매핑 표 하나가 G-code 16개와 경계 거절 reason 7종을 복합 gate 7개에 대응시킨다.

| gate | label | G-code | reason |
| --- | --- | --- | --- |
| `plan-activation` | 계획 활성화 | G1·G2·G3 | — |
| `scope-declaration` | 범위 선언 | G5 | — |
| `execution-topology` | 실행 토폴로지 | G19·G20 | — |
| `verification-evidence` | 검증 증적 | G7·G8·G13·G14 | — |
| `commit-scope` | 커밋 범위 | G17 | `out-of-scope`·`main-worktree-source-write`·`unassigned-worktree`·`verification-task-no-commit`·`cross-drive-conflict`·`cross-drive-ledger-unreadable` |
| `freshness-approval` | 신선도·승인 | G23·G24 | `stale-revision` |
| `closeout-completeness` | 마감 완결성 | G6·G16·G21 | — |

- 수용 기준: epic Success criteria 9–13.
- 검증 명령: terminal task의 `npm run ci`. commit task는 각자 task 전용 `node --test …`를 쓴다.
- 실패 모드·엣지 케이스:
  - 같은 gate의 코드가 여럿 실패하면 항목 하나로 묶는다(예: G7+G13 → `verification-evidence` 1개).
  - S 코드는 `gates`에 들어가지 않는다. S 실패뿐이거나 통과하면 `gates` 키가 없다. 성공 결과 전체를 `deepStrictEqual`로 고정한 기존 테스트를 지키기 위해서다.
  - 표에 없는 G-code가 실패하면 `gates`에서 빠지고 `failures[]`에는 남는다. 표가 현행 G-code를 모두 덮는지는 테스트로 고정한다.
  - `file`이 빈 문자열인 실패(G19 cycle 등)는 `targets`에 넣지 않는다.
  - 매핑되지 않은 reason(`ledger-locked`·`no-git`·`repair-*` 등)에는 `gate` 키를 두지 않는다. hook 줄도 지금 형식 그대로 둔다.

## Out of scope
- G-code 판정·메시지·`failures[]` 항목의 변경이나 삭제
- S 코드를 복합 gate에 넣는 일
- 운영·사용법 reason(`ledger-locked`·`ledger-lock-lost`·`unreadable-ledger`·`lease-invalid`·`no-git`·`repair-*` 등)의 매핑
- 일반 worktree의 비중첩 커밋 허용(§9-2 결정)
- (c) `cross-drive-overlap`의 판정 로직과 hint 문구
- `finalize`의 경계 거절(`finalize.ts:516`의 `out-of-scope`)에 `gate`를 붙이는 일. `gate` 표시 표면은 사용자가 확정한 commit hook·`bouncer commit`·coordinate로 한정한다. finalize는 validate 실패의 `gates`만 싣는다.

## One-commit justification
- 복합 gate 표 하나를 validate 결과·소비자 payload·경계 reason·출력 계약 문서가 함께 쓴다. 따라서 한 PR에서 같은 이름 체계로 바뀌어야 사용자 출력이 섞이지 않는다. 다만 커밋은 모듈·소비자·문서 세 task로 나눈다.
