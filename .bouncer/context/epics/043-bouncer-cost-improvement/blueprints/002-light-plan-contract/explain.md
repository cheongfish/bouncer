---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/002-light-plan-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-22T13:55:57.528+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '043'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: 92e3801f4cfe1eee2384d574ee3d2d33ebe957a8
      diff_sha: 76d3497b130dd15acd30e6f7c299e5874dc09335f6ee1d869121f8efc139f491
      quiz_score: 1/4
      disposition: light 계약의 두 분기(G18 면제, 미선언 시 full fallback)와 중복 템플릿을 지운 이유가 전달되지 않았다. 계획 문서가 왜 100줄을 넘겼는지는 정확히 짚었다. 다음 사이클에서 scale 판독 지점과 fallback 방향을 다시 확인한다.
      recorded_at: '2026-08-22T13:58:48+09:00'
---
# Explain

## Background
`scale: light`는 이름과 달리 계획 문서를 줄이지 않았다. epic·agent·quiz 왕복만
빠지고 scaffold와 게이트는 full과 같아서, 작은 작업도 다섯 문서와 G10 다섯 절,
G18 판정을 그대로 받았다. 실제 계획 문서는 340줄이었다.

이 blueprint는 light를 선언에서 계약으로 바꾼다. `--scale light`가 축약 문서
세트를 만들고, plan gate가 그 축약을 판정한다. 승인 범위와 실행 증적은 건드리지
않는다 — `affected_paths`는 여전히 사람이 확정하고, execute·commit 게이트는
full과 같은 조건으로 받는다. 줄이는 대상은 계획 단계 고정비 하나다.

Task 002는 그 축소가 실제 비용을 낮추는지 같은 네 사례로 재측정한다. BP001의
2회차와 같은 프롬프트·검증 명령·블라인드 심사를 쓰되, on arm만 light 계약으로
돌린다.

## Intuition
계획 문서를 줄이는 손잡이는 둘이다 — scaffold가 처음 써 주는 분량과, 게이트가
끝까지 요구하는 분량. 지금까지 light는 어느 쪽도 잡지 않고 왕복 횟수만 줄였다.
이번에는 둘 다 잡는다.

측정이 말한 것은 그것으로도 부족하다는 사실이다. scaffold 시점 97줄이 사이클
끝에 146~160줄이 된다. harness가 verify 증적 25줄을 쓰고 작성자가 24~38줄을
더하기 때문이다. 템플릿을 깎는 것만으로 100줄에 들어갈 수 없다.

## Code
계약은 네 파일이 나눠 가진다.

- `scripts/src/lib/cli-doc-commands.ts` — `--scale`을 `SCALE_ENUM`으로 검증하고
  첫 파일 쓰기 전에 거부한다. blueprint 전용 플래그다.
- `scripts/src/lib/scaffold.ts` — `blueprintScale`가 선언값을 읽고
  `templateNameFor`가 scale별 템플릿을 고른다. `-light` 키가 없으면 공용
  템플릿으로 떨어진다(verification이 그 경우다). `scaffoldTask`는 blueprint의
  선언 scale을 물려받는다.
- `scripts/src/lib/templates.ts` — light blueprint/tasks/review 본문.
- `scripts/src/lib/validate-gates.ts` — plan gate가 `bouncer.scale`을 읽어
  light면 G18을 건너뛰고 G10 필수 절을 셋으로 줄인다. 없거나 알 수 없는 값은
  full 계약으로 떨어진다.

경계는 `rules/governance.md`가 정본으로 적는다 — 무엇이 줄고 무엇이 그대로인지,
그리고 `scripts/`가 scale을 읽는 네 지점.

측정 결과는 `docs/benchmark/round-3/`에 있다. `runs.md`가 런별 근거,
`README.md`가 성공 조건 판정이다.

## Quiz
1. `--scale light`로 scaffold한 blueprint의 plan gate는 G18을 어떻게 다루는가?
   - (a) light에서도 G18을 그대로 요구한다
   - (b) light에서는 G18을 건너뛴다 — `context-review.md`를 만들지 않기 때문
   - (c) G18을 경고로 낮춰 실패시키지 않는다

2. blueprint `index.md`의 `bouncer.scale`이 비어 있거나 알 수 없는 값일 때 plan
   gate는 어느 계약을 적용하는가?
   - (a) light 계약 — 축약이 기본값이므로
   - (b) 게이트를 건너뛰고 통과시킨다
   - (c) full 계약 — light는 명시적 선언에만 발동한다

3. 3회차 측정에서 계획 문서 100줄 상한이 미달로 판정된 이유는?
   - (a) scaffold 시점은 97줄이지만 harness 증적과 작성분이 붙어 146~160줄이 됐다
   - (b) scaffold가 처음부터 100줄을 넘겨 만들었다
   - (c) light 대신 full로 실행된 런이 섞였다

4. 이번 사이클에서 `verification-light.md` 템플릿을 지운 이유는?
   - (a) light는 verification 문서를 만들지 않기로 해서
   - (b) 100줄 상한을 맞추려고 문서 하나를 줄여야 해서
   - (c) 공용 `verification.md`와 바이트 동일한 중복이라 조용히 어긋날 위험만 있어서

## 이해 상태
4문항 중 1문항 정답(1/4).

- Q1 G18 처리 — 정답 (b) light에서는 건너뜀. 응답 (a) 그대로 요구. **오답**
- Q2 scale 미선언·미상 값 — 정답 (c) full 계약. 응답 (a) light 계약. **오답**
- Q3 100줄 미달 이유 — 정답 (a) 97줄이 harness 증적·작성분으로 146~160줄.
  응답 (a). **정답**
- Q4 `verification-light.md` 삭제 이유 — 정답 (c) 공용 템플릿과 바이트 동일한
  중복. 응답 (a) light는 verification을 안 만듦. **오답**

Q1·Q2는 같은 오해에 걸려 있다 — light를 "문서가 없으니 판정도 없다"로 읽으면
G18 면제는 맞히지만 미선언 시 fallback 방향을 뒤집는다. 실제 계약은 반대다:
light는 명시적 선언에만 발동하고, 없거나 알 수 없는 값은 전부 full로 떨어진다.
Q4는 light가 verification 문서를 여전히 만든다는 사실을 놓쳤다 — 지운 것은
문서가 아니라 공용 템플릿과 똑같았던 중복 템플릿 본문이다.

disposition: 다음 사이클 진입 전에 `rules/governance.md`의 scale 판독 네 지점과
`validate-gates.ts`의 fallback 분기를 다시 읽는다.

## Tasks

### Task 001

#### Goal & intent

`bouncer scaffold blueprint --scale light`가 100줄 이하의 plan 단계 문서 세트를 만들고, plan gate가 light의 축약 계약을 판정하게 한다. full scaffold와 execute·commit·finalize 게이트는 기존 계약을 유지한다.

#### Interface

- 제공: 선택 인자 `--scale light | full`; light는 blueprint index와 축약 tasks/verification/review를 만들고 context-review를 생략한다. G10은 light에서 Goal & intent·Touch·Checklist만 요구하고 G18은 적용하지 않는다.
- 거부: 알려지지 않은 scale은 첫 파일 쓰기 전에 exit 2다. `--scale` 생략/`full`은 기존 다섯 plan 문서와 Interface·Do not touch·G18을 그대로 요구한다. light도 비어 있는 `affected_paths`, scope evidence, Touch 근거는 통과하지 못한다.

#### Touch

- Modify `scripts/src/lib/cli-doc-commands.ts` — blueprint scaffold의 `--scale`을 검증·전달한다.
- Modify `scripts/src/lib/scaffold.ts` — scale별 문서 세트와 축약 task 생성을 선택한다.
- Modify `scripts/src/lib/templates.ts` — light blueprint/task/review/verification 본문을 추가한다.
- Modify `scripts/src/lib/validate-gates.ts` — light에만 G18 면제와 축약 G10 필수 절을 적용한다.
- Modify `scripts/lib/cli-doc-commands.js` — CLI TypeScript 변경을 emit한다.
- Modify `scripts/lib/scaffold.js` — scaffold TypeScript 변경을 emit한다.
- Modify `scripts/lib/templates.js` — template TypeScript 변경을 emit한다.
- Modify `scripts/lib/validate-gates.js` — gate TypeScript 변경을 emit한다.
- Modify `skills/bouncer-plan/SKILL.md` — light scaffold·작성·context review 분기와 gate 계약을 설명한다.
- Modify `skills/spec-authoring/SKILL.md` — light task의 세 필수 절과 축약 작성 규칙을 설명한다.
- Modify `skills/context-review/SKILL.md` — light에는 context-review 문서·판정이 없고 full rubric만 소유함을 적는다.
- Modify `rules/governance.md` — light에서 줄어드는 문서·G10·G18과 유지되는 실행 게이트를 정본화한다.
- Modify `docs/compatibility.md` — 호환성 파기 이유·영향·full 대체 경로를 기록한다.
- Modify `docs/cli.md` — `scaffold blueprint --scale` 표면을 기록한다.
- Modify `docs/gates.md` — light G10·G18 분기와 유지 게이트를 기록한다.
- Modify `docs/workflow.md` — plan light 흐름과 full 복귀 절차를 기록한다.
- Modify `docs/ARCHITECTURE.md` — context-reviewer가 full plan의 판정자라는 경계를 명시한다.
- Modify `docs/troubleshooting.md` — G10 누락 절 안내를 full 다섯 절과 light 세 절로 나눈다.
- Modify `docs/benchmark/protocol.md` — 3회차 light on arm이 축약 plan 계약을 따르도록 프로토콜을 갱신한다.
- Modify `test/scaffold.test.js` — full 불변, light 문서 목록·100줄 상한·잘못된 scale을 단언한다.
- Modify `test/validate-gates.test.js` — light/full G10·G18 분기와 G4·G5·G11·G12 불변을 단언한다.
- Modify `test/lightweight-cycle.test.js` — 경량 사이클의 새 문서·게이트 계약을 단언한다.
- Modify `test/skill-bouncer-plan.test.js` — plan 스킬의 light scaffold·review 분기를 단언한다.
- Modify `test/skill-context-review.test.js` — context-review가 full 전용임을 단언한다.
- Modify `test/cli-help.test.js` — scaffold blueprint help에 `--scale light|full`을 단언한다.

#### Constraints

- `scale: light`는 사용자 선언과 CLI flag로만 발동한다. 경로 수·diff 크기로 추론하지 않는다.
- full의 생성 파일, 템플릿 본문, G10, G18 테스트는 바이트·동작 수준에서 유지한다.
- light는 tasks·verification·review, G3~G5·G11·G12, G6~G8·G13·G14·G16·G17을 유지한다.
- 계획 단계 100줄은 고정 timestamp로 scaffold한 blueprint 디렉터리의 `index.md`와 `tasks/001/{tasks,verification,review}.md` 전체 줄 수 합계다.
- 기존 helper·`SCALE_ENUM`·template renderer를 재사용하고 새 의존성이나 별도 모드 설정을 만들지 않는다.

### Task 002

#### Goal & intent

Task 001의 light 계약을 적용해 t1~t4 on arm 3회차를 실행한다. plan 문서 100줄 상한, 시간 배수 2.5 이하, test quality 증가분 3.00, 실격 0건을 1·2회차와 나란히 판정한다.

#### Interface

- 제공: `docs/benchmark/round-3/README.md`와 `runs.md`에 네 런의 비용·품질·검증·문서 줄 수 및 이전 회차 비교를 기록하고 상위 benchmark README가 이를 링크한다.
- 거부: full로 실행된 런, 100줄을 넘긴 런, 이전 회차와 prompt hash·검증 argv·심사 규약이 다른 런은 성공 표본에서 제외한다.

#### Touch

- Create `docs/benchmark/round-3/runs.md` — light on-arm 네 런의 통합 측정·심사 근거를 기록한다.
- Create `docs/benchmark/round-3/README.md` — 1·2·3회차 비교와 성공 조건 판정을 기록한다.
- Modify `docs/benchmark/README.md` — 1·2회차를 보존한 채 round 3 링크와 결론을 추가한다.

#### Constraints

- BP001과 같은 독립 clone·prompt hash·네 검증 명령·블라인드 리뷰·revert check를 사용한다.
- 각 plan 단계에서 blueprint index와 task bundle 네 문서의 전체 줄 수를 기록한다.
- 비용 목표가 실패해도 결과를 누락하지 않고 적용 기준을 "코드 변경 200줄 이상"으로 제한할 근거를 보고서에 적는다.
- 원시 산출물은 임시 `.benchmarks/`에 두고 저장소에는 세 문서만 변경한다.
