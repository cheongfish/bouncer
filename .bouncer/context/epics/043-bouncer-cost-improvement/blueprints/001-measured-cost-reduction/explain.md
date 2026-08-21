---
type: bouncer.explain
title: 측정 기반 비용 절감
description: 강화 게이트 기준선, scaffold 힌트, worktree 인식, 공유 상태 문서, 2회차 재측정
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/001-measured-cost-reduction/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-21T22:38:32.164+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '043'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 09987256726d374cad214264662c13e52bf12ff2
      diff_sha: b1ac622be29d3f0a835b78d82406bd795826cc17059feb406d1ff4b07019c51b
      quiz_score: '2/4'
      disposition: >-
        Q3는 repo root .git 파일·디렉터리만(임의 하위·bare 아님).
        Q4는 포인터·원장 공유이지 서로 다른 blueprint 원장이 항상 충돌하는 것이 아님.
        기록만 하고 마감 진행
      recorded_at: '2026-08-21T22:42:15+09:00'
---
# Explain

## Background

1회차 측정은 PR #53 이전이었다. 강화된 게이트만 있는 비용과, scaffold가 게이트 입력 모양을 숨겨 생긴 왕복을 나눌 기준선이 없었다. 이 블루프린트는 `c7df084`에서 t1~t4 on-arm을 먼저 고정하고, task/review 주석에 유효한 `basis`·severity 모양을 넣으며, `collect_metrics.py`가 `.git` 파일(linked worktree)도 저장소로 받게 하고, 포인터·verify 원장이 git-common-dir을 공유한다는 제약을 문서에 남긴 뒤 같은 네 프롬프트로 다시 잰다. 2회차 n=4에서 G18/S9/G4와 on 실격은 0이었고, 시간 배수 2.80×와 test quality Δ +1.75는 목표(≤2.5, +3.00)에 못 미쳤다.

## Intuition

시험지를 고치기 전에 같은 문제로 한 번 보고, 힌트만 적은 다음 같은 문제로 다시 본다.

## Code

- `scripts/src/lib/scaffold.ts`, `scripts/src/lib/templates.ts` (CJS: `scripts/lib/scaffold.js`, `scripts/lib/templates.js`) — 빈 `basis: []` 옆에 YAML 주석, task/review 본문에 필드·severity 허용값 주석. 파싱 값은 그대로 빈 배열·`pending`.
- `test/scaffold.test.js` — 주석 힌트와 빈 파싱 값을 같이 단언. `basis: []` 직전 YAML 줄을 본문 HTML과 구분한다.
- `skills/agentic-code-benchmark/scripts/collect_metrics.py` — `.git` 판정을 `os.path.exists`로 바꿔 파일·디렉터리를 모두 통과. 없는 `.git`은 기존 argparse 오류.
- `docs/benchmark/protocol.md`, `docs/security.md`, `skills/agentic-code-benchmark/references/task-suite.md` — Bouncer on arm은 독립 clone. 포인터는 worktree가 하나 공유하고, verify 원장은 `verification.md` 경로 digest별로 공유한다.
- `docs/benchmark/round-2/baseline.md`, `improved.md`, `README.md` — 기준선·개선 런과 1회차 off 비교. 상위 `docs/benchmark/README.md`가 round 2를 링크한다.

## Quiz

1. 기준선 on-arm을 `c7df084`에서 먼저 잰 이유는?
   - A) 1회차 off arm과 같은 커밋이라서
   - B) PR #53 게이트만 있고 scaffold 힌트는 없는 상태를 개선 런과 나누기 위해
   - C) linked worktree에서 포인터를 공유하면 측정이 빨라져서

2. scaffold가 넣은 `basis`·severity 주석을 파서가 읽으면?
   - A) 주석은 파싱에 안 들어가고 `basis: []`, `findings: []`, context-review `pending`이 유지된다. 빈 계획은 S9/G4·G18에서 그대로 실패한다
   - B) 주석 예시가 `basis` 엔트리로 들어가 plan 게이트가 통과한다
   - C) severity 허용값만 채워지고 `affected_paths`도 채워진다

3. `collect_metrics.py --repo`가 저장소로 인정하는 `.git`은?
   - A) 디렉터리만. `.git` 파일인 linked worktree는 거절
   - B) 임의 하위 경로의 `.git`과 bare repo까지
   - C) repo root의 `.git`이 파일 또는 디렉터리로 있으면 통과. 없으면 기존 argparse 오류

4. 병렬 Bouncer on-arm 측정에서 linked worktree를 쓰지 않는 이유는?
   - A) `collect_metrics.py`가 worktree를 측정하지 못해서
   - B) 활성 포인터는 모든 linked worktree가 하나 공유하고, verify 원장은 같은 blueprint `verification.md` 경로 digest를 덮어쓴다. 독립 clone은 운영 완화이지 런타임 격리를 고친 것이 아니다
   - C) 서로 다른 blueprint의 verify 원장이 항상 충돌해서

## 이해 상태

- quiz_score: 2/4
- 응답: 1-B (정답 B) ✓, 2-A (정답 A) ✓, 3-B (정답 C) ✗, 4-C (정답 B) ✗
- disposition: Q3는 repo root `.git` 파일·디렉터리만(임의 하위·bare 아님). Q4는 포인터·원장 공유이지 서로 다른 blueprint 원장이 항상 충돌하는 것이 아님. 기록만 하고 마감 진행
- range: develop..09987256726d374cad214264662c13e52bf12ff2
- diff_sha: b1ac622be29d3f0a835b78d82406bd795826cc17059feb406d1ff4b07019c51b
- recorded_at: 2026-08-21T22:42:15+09:00
