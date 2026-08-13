---
type: bouncer.epic
title: 계획 품질과 신뢰 경계
description: plan 직후 문서 정합성을 게이트로 세우고 최소화 래더와 인젝션 신뢰 경계를 명문화한다
resource: .bouncer/context/epics/033-quality-security/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-13T09:30:48.331+09:00'
bouncer:
  id: '033'
  epic_id: '033'
  status: approved
---
# 033 quality-security

## Intent
- 문제: 게이트는 문서의 status와 형식만 보므로, 문서끼리 어긋나 있어도 plan을
  통과한다. epic이 말하는 목표와 tasks가 여는 파일이 다르거나 성공 기준이
  판정 불가능한 문장이어도 막히지 않고, `/bouncer-run`은 그 브리프를 그대로
  주행한다. 잘못된 계획의 비용은 execute 이후에 드러난다.
- 목표: 문서가 막 쓰인 자리에서 정합성을 한 번 판정해 기록으로 남기고, 그
  기록을 plan 게이트가 본다. 함께 최소화 래더의 판단 기준과 컨텍스트 데이터의
  신뢰 경계를 문서에 고정한다.

## Success criteria
1. `bouncer scaffold blueprint`가 `context-review.md`를 함께 만들고, 그 문서가
   `bouncer.context_review` 타입·`CTXREVIEW-<NNN>` id·status `pending`으로
   `bouncer validate --blueprint <dir>`의 구조 검사에서 S1–S5·S19를 내지 않는다.
   `validate`는 blueprint 단위 명령이므로 판정은 그 범위에서 이뤄진다.
2. `bouncer scaffold context-review --blueprint <dir>`가 기존 blueprint에 문서를
   추가하고, 이미 있으면 파일을 쓰지 않고 거절한다.
3. `/bouncer-plan`이 승인 직전에 `bouncer-context-reviewer`를 named 디스패치
   네 단계로 부르고, 스킬·에이전트 표면 테스트가 새 스킬과 새 에이전트를 함께
   본다.
4. `bouncer validate --gate plan`이 **G18**로 `context-review.md` 부재·status
   미수락·findings 형식 위반을 거절하고, 정상 문서에서는 통과한다. 게이트가 읽는
   것은 status와 형식뿐이며 판정 문장 자체는 읽지 않는다.
5. 이 저장소의 blueprint `033/001`이 자신의 `context-review.md`를 갖고 plan
   게이트를 통과한다.
6. `skills/minimality/SKILL.md` 래더가 네이티브 플랫폼 기능을 표준 라이브러리
   rung에서 분리하고, 강도 개념을 기존 `bouncer.scale`에 매핑한다. 새 설정 키를
   만들지 않는다.
7. `docs/security.md`에 신뢰 경계 절이 있고, 외부·생성 데이터를 읽는 스킬과
   에이전트 문서에 데이터/지시 구분 문구가 있음을 테스트가 확인한다.
   `skills/**`·`agents/**` 본문은 영어, `docs/security.md`는 한국어를 유지한다
   (하드룰 8의 한국어 범위는 `.bouncer/context/epics/**`와 BP `explain.md`다).
8. `npm test`가 통과한다.

## Out of scope
- 벤치마크 스킬. 워크플로 밖 분리 스킬이며 별도 에픽으로 남긴다.
- `ponytail-mcp` 도입. 정적 룰셋 텍스트만 반환하므로 워크플로 결합부를
  대체하지 못한다. 흡수 대상은 래더 문구뿐이다.
- context reviewer의 브리프-코드 정합성 판정. plan 시점에는 구현 코드가 없으므로
  기존 코드 대비 범위 검토까지만 한다.
- 프롬프트 인젝션의 코드 레벨 탐지·새니타이저. 우회 가능해 투자 대비 효과가 낮고,
  실질 방어선은 "게이트 판정은 코드만 한다"는 기존 설계다.
- `scale: light`의 G18 면제. 게이트 해석 경로를 둘로 늘리지 않는다.
- 새 `config.json` 키. 강도 개념은 기존 `bouncer.scale`을 재사용한다.
- `/bouncer-execute`·`/bouncer-commit`·`/bouncer-run` 절차 변경. 새 판정은 plan
  안에서 끝난다.

## Blueprints
* [001 context-review-guard](blueprints/001-context-review-guard/index.md) - context-review 문서·스킬·에이전트 신설과 G18 plan 게이트, minimality 래더 정렬, 인젝션 신뢰 경계 — `scripts/src/lib/{schema,paths,scaffold,validate,cli,init}.ts`·`skills/`·`agents/`·`docs/`
