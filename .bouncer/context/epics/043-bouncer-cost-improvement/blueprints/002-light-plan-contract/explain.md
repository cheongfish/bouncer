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
      quiz_score: '1/4'
      disposition: >-
        light 계약의 두 분기(G18 면제, 미선언 시 full fallback)와 중복 템플릿을
        지운 이유가 전달되지 않았다. 계획 문서가 왜 100줄을 넘겼는지는 정확히
        짚었다. 다음 사이클에서 scale 판독 지점과 fallback 방향을 다시 확인한다.
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
