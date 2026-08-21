# Bouncer on/off A/B 벤치마크

**측정일: 2026-08-21 (KST)**
**베이스 커밋: `3f5201866b368a55baaae845981ab77b9b869bec`** (`develop`, PR #52 머지 직후)
**도구: `skills/agentic-code-benchmark`** — 측정 40 + 심사 60 = 0–100 합성 점수

같은 태스크를 Bouncer 사이클을 **강제한 채**와 **끄고** 각각 구현시킨 뒤,
코드를 쓴 적 없는 독립 심사자가 arm 라벨을 가린 채 채점했다.

**2회차**는 이 파일을 덮어쓰지 않는다. PR #53 기준선과 Task 002~004 이후 on-arm 재측정은 [round-2/README.md](round-2/README.md)에 있다. 그 표본에서 시간 배수는 1회차 off 대비 **2.80×**(목표 ≤ 2.5, 미달), test quality Δ는 **+1.75**(목표 +3.00, 미달), on 실격 **0**, G18/S9/G4 **0**이다.

> **베이스 커밋 주의.** 이 측정은 `3f52018` 기준이고, 그 시점은
> **PR #53 (`c7df084`, 2026-08-21 머지) 이전**이다. `3f52018` 에서 G13 은
> `verification.md` 프론트매터만 읽었다 — 에이전트가 명령을 돌리지 않고
> `status: passed` 를 손으로 적어도 게이트를 통과했다. 즉 이 실험의 on arm 은
> **게이트가 강제해서가 아니라 프롬프트 지시를 자발적으로 따라서** 검증을
> 실행했다. 측정치 자체는 유효하다(각 런의 실제 테스트 수 697/702/705/696 이
> 실행 증거). 다만 **이 실험이 잰 것은 "게이트가 무엇을 강제하는가" 가 아니라
> "에이전트가 프로토콜을 따르면 무엇이 달라지는가" 다.** 아래 해석 2번을 같이 읽을 것.
> 커밋 스코프 가드도 같은 시점에 `git commit -a` 로 우회 가능했으나, on 런은
> 훅이 아니라 `bouncer commit` 을 거쳤으므로 이 결과에 영향이 없다.

## 결과

| task | 형태 | off | on | Δ |
| --- | --- | --- | --- | --- |
| t1 | 기존 코드에 작은 기능 | 83.19 (B) | 95.19 (A) | **+12.00** |
| t2 | 리포트 기반 버그 수정 | 85.59 (B) | 99.99 (A) | **+14.40** |
| t3 | 동작 불변 리팩터링 | 95.19 (A) | 95.19 (A) | **0.00** |
| t4 | 모호한 요구 | **35.0 (F, 실격)** | 92.79 (A) | +57.79 |

**정상 3개 평균: off 87.99 (83.2–95.2) → on 96.79 (95.2–100.0), +8.80점.**
**실격 런: off 1건, on 0건.**

실격 런은 스킬 지침대로 평균에 섞지 않는다 — 35.0 은 "35점어치의 품질" 이
아니라 실격이다. t4-off 의 실격 사유는 심사자가 `npm run test:coverage` 를 직접
실행해 확인한 **레포 자신의 CI 게이트 실패**다(function coverage 95.98% < 임계
96%).

## 어느 차원이 움직였나

| 차원 | off 평균 | on 평균 | Δ |
| --- | --- | --- | --- |
| Correctness & spec fidelity | 4.50 | 5.00 | +0.50 |
| **Scope discipline** | **4.75** | **4.75** | **±0.00** |
| **Test quality** | **1.50** | **4.50** | **+3.00** |
| Codebase fit | 4.00 | 4.50 | +0.50 |
| Maintainability & clarity | 4.25 | 4.50 | +0.25 |

**이득은 사실상 전부 test quality 한 차원에서 나온다.** 나머지 넷은 0.5점
이하로, 스킬 기준상 노이즈다.

off 4개 런이 추가한 테스트: **0줄, 0줄, 0줄, 0줄.** 심사자들이 revert 체크를
직접 실행해 확인했다 — t1/t2/t4 의 off 산출물은 변경을 되돌려도 696개 테스트가
전부 그대로 통과한다. 회귀를 잡아줄 것이 아무것도 없다.

## 비용

| | 토큰 | 툴콜 | 벽시계 |
| --- | --- | --- | --- |
| off 합계 | 202,268 | 65 | 8.7분 |
| on 합계 | 442,061 | 259 | 28.8분 |
| **배수** | **2.19×** | **3.98×** | **3.32×** |

태스크별 시간 배수: t1 2.10× / t2 **7.26×** / t3 5.51× / t4 3.29×.
**작은 작업일수록 배수가 폭발한다.** t2 는 최종 코드 변경이 7줄인데 시간이
7.26배 늘었다.

계획 문서 오버헤드는 태스크 크기와 **거의 무관하다**:

| | 계획 문서 | 실제 코드 변경 |
| --- | --- | --- |
| t1-on | 350줄 (7파일) | +232 / −19 |
| t2-on | 313줄 (7파일) | +29 / −5 |
| t3-on | 340줄 (7파일) | +21 / −10 |
| t4-on | 365줄 (7파일) | +309 / −63 |

t2 는 계획 문서가 코드의 **약 9배**다. `scale: light` 경로를 썼는데도 항상
313–365줄이 나온다. 경량 경로가 실제로는 경량이 아니라는 뜻이고, 채택 마찰의
정확한 원인이다.

## 읽는 법 — 불리한 결과부터

**1. README 가 내세우는 세 문제 중 개선이 확인된 것은 하나뿐이다.**
"검증이 말뿐이다" 는 개선됐다(test quality +3.0). **"범위가 번진다" 는 정확히
0.00 움직였다** — off 베이스라인이 이미 4.75/5 라 개선할 여지가 없었다. 커밋
스코프 가드가 실제로 발동한 것은 전체에서 1번뿐이고, 그것도 스코프 번짐이
아니라 빌드 산출물 미선언이었다. "커밋이 뒤섞인다" 는 이번 설계(태스크당 커밋
1개)로는 측정 자체를 하지 못했다.

**2. 이득의 원천은 G13 이 아니다.**
Bouncer 의 `verify` 는 `config.verify` = `npm test` 만 실행한다 — 커버리지
게이트는 돌지 않는다. 즉 **t4-off 를 실격시킨 커버리지 실패는 Bouncer 의
게이트도 잡지 못한다.** t4-on 이 통과한 것은 게이트가 잡아서가 아니라 계획
템플릿의 Checklist·Interface 섹션이 구현 전에 테스트를 쓰게 만들었기 때문이다.
효과의 원천은 "하네스가 검증을 실행한다" 가 아니라 **"계획 템플릿이 테스트를
강제한다"** 라는 부수 효과일 수 있다.

**측정 후 확인된 사실이 이 해석을 굳힌다.** 위 베이스 커밋 주의대로, `3f52018`
시점의 G13 은 문서 프론트매터만 읽어 강제력이 사실상 없었다. **강제력이 없던
메커니즘이 +3.00 을 만들어냈을 수는 없다.** 따라서 이득은 게이트가 아니라 계획
단계에서 나왔다고 보는 편이 자연스럽다.

이 사실은 다음 회차 설계도 바꾼다. 1회차의 on arm 은 사실상
**`plan-only`(계획 문서는 강제, verify 강제는 없음)** 에 가깝다. PR #53 이후
커밋(`c7df084` 이상)에서 같은 프로토콜로 재측정하면 그것이 `full` arm 이 되고,
1회차와의 차이가 **G13 강제의 한계 기여**가 된다 — 별도 arm 을 새로 돌리지 않고
얻을 수 있다.

**3. 측정 도중 도구 자신의 결함 2건이 드러났다.**
`collect_metrics.py` 는 git worktree 를 거부해 **자기 A/B 프로토콜대로 돌릴 수
없었고**, 활성 포인터가 저장소당 하나라 **병렬 worktree 사이클이 충돌**한다.
상세와 대응은 [protocol.md](protocol.md).

## 한계

n=4(스킬 권장 5–8), 셀당 반복 1회, 태스크 대부분 설계된 것, on arm 은 CLI
에뮬레이션이라 **PreToolUse 커밋 훅 경로 미검증**, 심사자도 LLM 이고 런당 1명,
단일 모델·단일 세션. 전체 목록은 [protocol.md](protocol.md#한계).

t3 이 동점이므로 "4개 중 3개에서 개선" 이 아니라 **"2개 개선, 1개 동점,
1개는 off 가 실격"** 으로 읽어야 한다.

## 디렉터리

```
docs/benchmark/
├── README.md          이 파일 — 1회차 결과 요약
├── protocol.md        측정 설계·통제·하네스 결함·한계
├── round-2/           2회차 기준선·개선 on-arm (1회차 runs/ 를 수정하지 않음)
├── tasks/             태스크 4개 정본 (JSON) + 선정 이유와 함정 설명
├── runs/              1회차 런 8개 × (metrics / judgment / card / 리포트)
└── diffs/             1회차 런 8개의 코드 diff (.bouncer/context 제외)
```

`.benchmarks/` 는 스킬이 정한 대로 gitignore 된 로컬 작업 공간으로 남는다.
이 디렉터리는 그중 **발행하기로 한 회차**의 사본이다.

## 재현

```bash
# 1. collect_metrics.py 의 worktree 거부를 먼저 우회하거나 고칠 것 (protocol.md 참조)
# 2. 런마다 독립 클론 — worktree 는 포인터를 공유하므로 쓰면 안 된다
python3 skills/agentic-code-benchmark/scripts/collect_metrics.py \
  --repo <run-dir> --base 3f52018 --head WORKTREE \
  --label t1-off --task-id t1 \
  --test-cmd "npm test" --lint-cmd "npm run lint" \
  --typecheck-cmd "npm run typecheck" --build-cmd "npm run build" \
  --out .benchmarks/runs/t1-off.metrics.json   # 작업은 .benchmarks/ 에서

python3 skills/agentic-code-benchmark/scripts/scorecard.py score \
  --metrics .benchmarks/runs/t1-off.metrics.json \
  --judgment .benchmarks/runs/t1-off.judgment.json \
  --out .benchmarks/runs/t1-off.card.json \
  --report .benchmarks/runs/t1-off.md

python3 skills/agentic-code-benchmark/scripts/scorecard.py compare \
  .benchmarks/runs/t1-off.card.json .benchmarks/runs/t1-on.card.json
```
