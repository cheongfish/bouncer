---
type: bouncer.blueprint
title: context 리뷰 게이트와 신뢰 경계
description: context-review 문서·스킬·에이전트를 세우고 G18로 plan을 막으며 최소화 래더와 인젝션 경계를 문서에 고정한다
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/007-context-review-guard/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-13T09:30:48.388+09:00'
bouncer:
  id: '007'
  epic_id: '004'
  blueprint_id: '007'
  status: closed
  commit_type: feat
  scale: full
---
# 007 context-review-guard

Epic: [004](../../index.md)

## Intent
- 문제: plan이 만드는 문서 묶음에는 판정자가 없다. 게이트는 필드가 채워졌는지만
  보고, 그 내용이 서로 맞는지는 아무도 보지 않는다. 어긋난 브리프는 execute에서야
  드러나고, 자동 주행에서는 사람이 그 사이를 보지 못한 채 비용을 치른다.
- 완료 조건: blueprint마다 `context-review.md`가 있고, plan 게이트가 그 문서의
  status와 findings 형식으로 승인 여부를 가른다. 판정 문장은 에이전트가 쓰고
  게이트는 형식만 보므로, 판정 주체와 게이트 주체가 갈라진 채로 남는다.

## Contract
- 인터페이스:
  - 신규 문서 종류 `bouncer.context_review`. 위치는 blueprint 루트
    `context-review.md`, id는 `CTXREVIEW-<blueprint id>`. `explain.md`와 같은
    BP 단위 문서이며 task 묶음 안에 들어가지 않는다.
    ```yaml
    bouncer:
      id: CTXREVIEW-001
      status: pending            # pending | requested | addressed | accepted
      context_review:
        findings:
          - id: CR-1
            severity: major      # blocker | major | minor | nit
            status: resolved     # resolved | accepted
            note: …              # accepted일 때 필수
    ```
    본문은 `## Findings` 한 절. `review.md`의 어휘와 형식을 그대로 쓴다 —
    새 어휘를 만들면 두 리뷰 문서가 다른 규칙을 갖게 된다.
  - `bouncer scaffold blueprint`가 `context-review.md`를 함께 만든다. 기존
    blueprint에는 `bouncer scaffold context-review --blueprint <dir>`로 붙인다.
  - 신규 스킬 `context-review`와 신규 named agent `bouncer-context-reviewer`
    (read-only). `/bouncer-plan`이 승인(7단계) 직전에 부른다. 디스패치 프롬프트는
    `review`처럼 `assets/` 템플릿을 두지 않고 `bouncer-implementer` ·
    `bouncer-debugger`와 같이 plan 단계 본문에서 인라인으로 채운다 — 판정 대상이
    이미 문서 경로로 지정되므로 채울 자리가 없는 템플릿 파일이 된다.
    본문 언어는 기존 `skills/**`·`agents/**`와 같이 영어다.
  - 신규 plan 게이트 코드 **G18**.
- 데이터·상태:
  - `context_review.findings`는 `review.findings`와 같은 판정 규칙을 받는다 —
    `id`·`severity`·`status`가 있어야 하고 `accepted`에는 비지 않은 `note`가
    붙는다. 게이트는 그 세 필드와 status만 본다.
  - 새 설정 키는 없다. 강도 개념은 blueprint frontmatter의 기존
    `bouncer.scale`(`light` | `full`)에 매핑되며 `scripts/`는 이 값을 읽지 않는다.
  - `init.ts` 기본 `subagents` 블록 네 곳(claude / cursor / codex / antigravity)에
    `bouncer-context-reviewer: inherit`이 추가된다. `config.example.json`은
    현재 세 블록뿐이고 antigravity가 없다 — 기존 드리프트이며 이 blueprint는
    새 에이전트 키만 세 블록에 넣고 antigravity 블록은 추가하지 않는다. 이미
    있는 소비자 `config.json`은 `init`이 바꾸지 않으므로 그 저장소는 모델
    미지정으로 읽힌다(부모 세션 상속 = 같은 동작).
- 수용 기준: 에픽 성공 기준 1–8.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - **자기 자신에 대한 게이트.** G18이 켜지는 순간 이 blueprint도 판정 대상이
    된다. 그래서 task 순서를 문서·CLI(001) → 스킬·에이전트·자기 문서 작성(002)
    → 게이트(003)로 잡는다. G18을 먼저 올리면 그 커밋 직후
    `bouncer current --set`이 이 blueprint에서 막힌다.
  - 032까지의 기존 blueprint에는 `context-review.md`가 없다. G18은 plan 게이트
    전용이고 그 blueprint들은 `closed`이므로 판정 대상이 아니다. 다시 열지 않는다.
  - finding status enum은 `resolved` | `accepted`뿐이라 '미해결'을 기록할 값이
    없다 — `review.md`와 같은 계약이다. 그래서 G18이 막는 것은 status 미수락과
    형식 위반(잘못된 severity·status, `note` 없는 `accepted`)이며, 판정자가
    지적을 남긴 채 통과시키려면 `accepted` + `note`로 근거를 적어야 한다.
  - named agent 미지원 호스트(Codex는 `agents/`를 배포할 수 없다) — review와
    같은 인라인 폴백 문장을 유지한다. 폴백이 없으면 그 호스트에서 G18이 영구히
    막힌다.
  - graphify 비활성이거나 `suggested_paths`가 비어 범위 대조를 못 한다 — 상태지
    실패가 아니다. finding 없이 통과할 수 있고, 판정 근거가 없었다는 사실만
    본문에 적는다.
  - `context-review.md`가 이미 있는 blueprint에 scaffold 재실행 — 파일을 쓰지
    않고 거절한다. `scaffoldExplain`의 조용한 no-op과 달리 명시적 거절인 이유는,
    plan이 부르는 명령이라 덮어쓰기 위험이 사람 손에 닿기 때문이다.
  - 인젝션 문구를 담은 문서 자체를 데이터로 읽는 재귀 — 문구는 방어선이 아니다.
    실질 방어선은 게이트 판정을 `bouncer validate`만 한다는 기존 설계이며,
    `docs/security.md`가 그 문장을 명시한다.

## Out of scope
- 에픽 Out of scope 전부(벤치마크, `ponytail-mcp` 도입, 브리프-코드 정합성 판정,
  코드 레벨 인젝션 탐지, `light` 면제, 새 config 키, execute·commit·run 절차 변경).
- `review.md`·G8·G14의 계약 변경. 새 문서는 그 어휘를 **읽어 쓰기만** 하고
  기존 판정 경로에 손대지 않는다.
- context reviewer 판정 결과를 근거로 문서를 자동 수정하는 경로. 고치는 주체는
  사람과 `/bouncer-plan`이며, 게이트는 고쳐진 결과만 본다.
- `graphify-runner`의 질의 방식·`suggested_paths` 생성 규칙. 범위 검토는 이미
  기록된 값을 대조할 뿐이다.
- 032까지의 기존 blueprint에 `context-review.md`를 소급 생성하는 마이그레이션.
  마감된 문서를 다시 여는 일이며 판정할 계획도 남아 있지 않다.

## One-commit justification
- 한 커밋이 아니라 task 다섯 개다. 하드룰 2에 따라 각 task가 한 커밋이고,
  blueprint 전체가 리뷰·PR 단위다. 나눈 경계는 "그 커밋만으로 저장소가 자기
  게이트를 통과하는가"이며, 특히 003(G18)은 002가 이 blueprint의 문서를
  만들어 둔 뒤에만 성립한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - context_review 문서 종류와 scaffold·CLI
* [Tasks 002](tasks/002/tasks.md) - context-review 스킬·에이전트와 plan 배선
* [Tasks 003](tasks/003/tasks.md) - G18 plan 게이트
* [Tasks 004](tasks/004/tasks.md) - minimality 래더 정렬
* [Tasks 005](tasks/005/tasks.md) - 인젝션 신뢰 경계 문서화
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
