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
      quiz_score: 2/4
      disposition: Q3는 repo root .git 파일·디렉터리만(임의 하위·bare 아님). Q4는 포인터·원장 공유이지 서로 다른 blueprint 원장이 항상 충돌하는 것이 아님. 기록만 하고 마감 진행
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

## Tasks

### Task 001

#### Goal & intent

`c7df084`에서 t1~t4의 on arm을 각각 독립 clone으로 실행해 PR #53의 게이트 강화만 반영된 기준선을 남긴다. 이 결과가 Task 005의 scaffold 개선 후 측정과 원인 분리를 가능하게 한다.

#### Interface

- 제공: `docs/benchmark/round-2/baseline.md`에 네 런의 토큰·툴 호출·시간·검증 결과·품질 점수·blind label·revert check 실행 여부와 합계/평균을 기록한다.
- 거부: `c7df084`가 아닌 베이스, 수정된 프롬프트, linked worktree, 공유 `.bouncer/context`, 누락된 네 검증 명령, 자가 심사 런은 기준선 표본에서 제외하고 제외 사유를 같은 보고서에 남긴다.

#### Touch

- Create `docs/benchmark/round-2/baseline.md` — 변경 전 on-arm 4런의 통합 측정·심사 근거를 기록한다.

#### Constraints

- 실행 순서는 Task 002보다 앞이며 베이스는 `c7df084`다.
- 런마다 별도 clone과 별도 Git common directory를 사용한다.
- 구현 에이전트에는 task JSON의 `prompt`만 주고 `done_when`은 심사자에게만 준다.
- 체크 명령은 `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` 순서와 argv를 유지한다.
- 측정 원시 파일은 clone 밖 임시 `.benchmarks/`에 보관하고 저장소에는 한 통합 보고서만 추가한다. 새 의존성·수집 스크립트를 만들지 않는다.

### Task 002

#### Goal & intent

새 task와 review 문서를 받은 에이전트가 S9/G4 및 G18/G14의 입력 모양과 허용값을 gate 실패 없이 알 수 있게 한다. scaffold 값은 계속 미완성 상태여서 빈 계획은 승인되지 않는다.

#### Interface

- 제공: `tasks.md` 주석은 `basis` 엔트리의 네 필드와 `source | context`, `updated | reused | fail-skip | skip-disabled | missing`을 보여준다. `review.md`와 `context-review.md` 주석은 finding의 `id`, `severity`, `status`, accepted `note` 계약과 severity 허용값을 보여준다.
- 거부: 주석 예시를 실제 `basis`나 finding 값으로 파싱하지 않는다. scaffold 직후 S9/G4와 G18은 기존처럼 실패하며 `affected_paths`도 비어 있다.

#### Touch

- Modify `scripts/src/lib/scaffold.ts` — 빈 `basis` 의도 옆에 유효 엔트리 모양을 보여주는 YAML 주석을 생성한다.
- Modify `scripts/src/lib/templates.ts` — task와 review/context-review 본문에 허용값 주석을 넣는다.
- Modify `scripts/lib/scaffold.js` — TypeScript 변경의 배포 CJS 산출물을 갱신한다.
- Modify `scripts/lib/templates.js` — 템플릿 변경의 배포 CJS 산출물을 갱신한다.
- Modify `test/scaffold.test.js` — 주석 힌트와 빈 검증 값 유지 계약을 단언한다.

#### Constraints

- 실제 `scope_evidence.basis` 기본값은 `[]`, context-review status는 `pending`, findings는 `[]`를 유지한다.
- 힌트는 YAML/Markdown 주석이라 OKF frontmatter 파싱 결과에 들어가지 않아야 한다.
- 기존 상수의 허용값을 복사해 설명하되 새 상수·helper·의존성을 만들지 않는다.

### Task 003

#### Goal & intent

`collect_metrics.py --repo`가 `.git` 디렉터리인 clone과 `.git` 파일인 linked worktree를 모두 Git 저장소로 인정하게 한다. 포인터 공유 때문에 Bouncer on-arm 측정은 계속 독립 clone을 사용한다.

#### Interface

- 제공: repo root 아래 `.git`이 파일 또는 디렉터리로 존재하면 기존 측정 흐름으로 진행한다.
- 거부: `.git`이 존재하지 않는 경로는 기존 argparse 오류로 거절한다. 임의 하위 디렉터리나 bare repository 지원은 추가하지 않는다.

#### Touch

- Modify `skills/agentic-code-benchmark/scripts/collect_metrics.py` — 저장소 판정을 `os.path.exists`로 바꾼다.
- Modify `test/skill-agentic-code-benchmark.test.js` — `.git` 파일·디렉터리 수용과 부재 거절을 CLI 수준에서 단언한다.

#### Constraints

- Python 표준 라이브러리만 사용한다.
- `collect_metrics.py`의 CLI 인자와 출력 스키마를 바꾸지 않는다.
- 이 수정은 worktree를 측정할 수 있게 할 뿐 Bouncer on-arm 병렬 실행을 허용하지 않는다.

### Task 004

#### Goal & intent

활성 포인터와 verify 원장이 Git common directory 아래에 있어 linked worktree가 공유한다는 제약을 측정 프로토콜·benchmark 사용법·위협 모델에서 같은 문장으로 설명한다. 병렬 Bouncer cycle은 독립 clone만 사용한다.

#### Interface

- 제공: benchmark task suite는 Bouncer on arm마다 독립 clone을 요구한다. 보안 문서는 포인터 충돌 범위와 같은 blueprint 경로의 verify 원장 덮어쓰기 범위를 구분한다.
- 거부: linked worktree 격리를 보장한다고 쓰거나, 서로 다른 blueprint의 verify 원장이 항상 충돌한다고 과장하지 않는다. 이번 task에서 런타임 상태 위치를 바꾸지 않는다.

#### Touch

- Modify `skills/agentic-code-benchmark/references/task-suite.md` — Bouncer on arm의 독립 clone 규칙과 일반 코드 벤치마크의 worktree 허용을 구분한다.
- Modify `docs/benchmark/protocol.md` — 재측정 전제와 포인터·verify 원장 공유 상태를 현재 계약으로 정리한다.
- Modify `docs/security.md` — Git common directory 런타임 상태의 충돌 범위와 운영 완화를 알려진 한계로 추가한다.

#### Constraints

- 포인터는 모든 linked worktree가 하나를 공유하고, verify 원장은 verification 상대경로 digest별로 공유한다는 차이를 보존한다.
- 독립 clone은 운영 완화이지 런타임 격리 해결책이라고 표현하지 않는다.
- 문서 세 곳이 서로 다른 실행 지침을 주지 않게 한다.

### Task 005

#### Goal & intent

Task 002~004가 반영된 HEAD에서 t1~t4 on arm을 다시 실행해 Task 001 기준선 및 1회차 off arm과 비교한다. 스키마 발견 실패 제거, 시간 2.5배 이하, test quality 증가분 3.00, 실격 0건을 판정한다.

#### Interface

- 제공: `docs/benchmark/round-2/improved.md`에 네 개선 런의 근거를, `docs/benchmark/round-2/README.md`에 baseline·improved·1회차 off 비교와 변수 분리 결론을 기록한다. 상위 benchmark README가 round 2를 링크한다.
- 거부: 프롬프트·모델·검증 명령·심사 규약이 기준선과 다른 런은 비교값에 넣지 않는다. n=4 결과를 일반적 인과로 과장하지 않는다.

#### Touch

- Create `docs/benchmark/round-2/improved.md` — scaffold 개선 후 네 런의 통합 측정·심사 근거를 기록한다.
- Create `docs/benchmark/round-2/README.md` — 기준선·개선 후·1회차 off를 나란히 비교하고 성공 조건을 판정한다.
- Modify `docs/benchmark/README.md` — 1회차를 보존한 채 round 2 링크와 요약을 추가한다.

#### Constraints

- Task 001과 같은 독립 clone·prompt hash·검증 argv·blind review·revert check 규약을 사용한다.
- 개선 런에는 Task 002~004가 모두 포함되어야 한다.
- `G18`, `S9`, `G4` 발생 횟수를 런별로 세고 다른 실패와 구분한다.
- 원시 산출물은 임시 `.benchmarks/`에 두고 저장소에는 세 문서만 변경한다.
