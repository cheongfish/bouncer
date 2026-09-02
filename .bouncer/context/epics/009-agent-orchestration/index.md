---
type: bouncer.epic
title: 서브에이전트 모델 설정
description: 프로바이더별 named 서브에이전트 모델을 config로 권고하고 디스패치 시점에 적용
resource: .bouncer/context/epics/009-agent-orchestration/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T07:48:44.174Z'
bouncer:
  id: '009'
  epic_id: '009'
  status: approved
---
# 009 agent-orchestration

## Intent
- 문제: 리뷰·구현 서브에이전트를 generic Task로 띄우기 때문에 소비 저장소가
  어떤 모델로 돌릴지 고를 수 없고, 호스트마다 모델 slug 네임스페이스가 달라
  한 값으로 통일할 수도 없다.
- 목표: `.bouncer/config.json`의 `subagents.<provider>.<agentName>`을 읽어
  named 서브에이전트를 디스패치할 때 그 모델을 적용하고, 미설정·거부·미지원
  호스트에서는 부모 상속(`inherit`)으로 조용히 떨어진다.

## Success criteria
1. `bouncer init`이 만드는 `.bouncer/config.json`에 `subagents` 블록이 포함되고,
   `test/init.test.js`의 config shape 단정이 그 값을 그대로 검증한다.
2. `resolveSubagentModel({ repoRoot, agentName, provider })`가 (a) provider 명시,
   (b) 환경변수 휴리스틱, (c) 판별 불가, (d) config 부재·손상, (e) `inherit`
   센티널 다섯 경우에 각각 모델 slug 또는 `{ model: null }`을 반환한다.
3. `docs/configuration.md` 설정 표에 `subagents` 행이 있고, provider별 블록이
   필요한 이유와 `inherit` 센티널 의미가 기술된다.
4. 플러그인 루트 `agents/`에 `bouncer-reviewer.md`와 `bouncer-implementer.md`가
   존재하고 frontmatter의 `model`은 `inherit`이며, `.cursor-plugin/plugin.json`이
   `agents` 경로를 명시한다.
5. `skills/review/SKILL.md`와 `skills/bouncer-execute/SKILL.md` step 3·5가
   generic Task 대신 named agent(`bouncer-reviewer` / `bouncer-implementer`)를
   호출하고, 호스트가 slug를 거부하면 `inherit` 폴백 후 사용자에게 알린다는
   절차를 본문에 담는다.
6. `npm test`가 통과하고, `test/skill-review.test.js`·
   `test/skill-bouncer-execute.test.js`가 "fresh generic" 대신 named agent
   라우팅을 단정한다.

## Out of scope
- 게이트 강제 — 모델 권고는 런타임 힌트이며 어떤 G/S 코드의 입력도 아니다.
- config가 에이전트 md frontmatter를 재작성하는 방식 (기각한 대안).
- `bouncer init`이 소비 저장소 `.claude/agents/`·`.cursor/agents/`·
  `.codex/agents/`에 에이전트 md를 설치하는 것.
- Codex의 named agent 라우팅. `.codex-plugin/plugin.json`이 인식하는 컴포넌트는
  `skills`·`mcpServers`·`apps`·`hooks` 뿐이라 플러그인 루트 `agents/`가 배포되지
  않는다. Codex는 현행 generic/인라인 디스패치와 `inherit`을 유지한다.
- 리뷰 루브릭·심각도 계산 등 `reviewer-prompt.md`의 판정 내용 변경.

## Blueprints
* [서브에이전트 모델 설정 계약 도입](blueprints/001-subagent-model-config-contract/index.md) - config subagents 기본값과 프로바이더별 모델 해석 헬퍼
* [Named 서브에이전트 라우팅으로 전환](blueprints/002-named-agent-routing/index.md) - 플러그인 agents/ 추가와 review·execute 디스패치 전환
* [diff 규모에 맞춘 3지선다 이해도 퀴즈](blueprints/003-adaptive-quiz/index.md) - explain-diff 문항 수 적응·보기 3개·정답 위치 분산·기록 위치 규정
* [graph.basis를 그래프별 질의 레코드로 바꿈](blueprints/004-graph-basis-record/index.md) - basis 엔트리 리스트 스키마·검증·스캐폴드·graphify-runner 기록 규칙
* [draft PR 승인 뒤 재확인 없이 바로 생성](blueprints/005-pr-single-confirm/index.md) - finalize step 4의 PR 본문 확인 ACQ 제거와 미리보기 출력 유지
* [read-only 디버거 서브에이전트 추가](blueprints/006-debugger-agent/index.md) - bouncer-debugger 에이전트·4단계 debugging 스킬·execute verify 실패 배선
* [쓰이지 않는 Ponytail 어드바이저 경로 제거](blueprints/007-ponytail-advisor-removal/index.md) - Blueprint 001
* [자동 주행 커맨드와 자율성 설정](blueprints/008-run-loop/index.md) - /bouncer-run이 execute→commit을 task 소진까지 반복하고 autonomy가 확인 지점을 정한다
* [리뷰 재검 왕복 상한과 소유권 정리](blueprints/009-execute-review-cap/index.md) - execute step 5에 리뷰 왕복 2회 상한을 넣고 run은 그 숫자를 참조만 하도록 바꾼다
* [finalize 인계에 같은 epic의 미완료 blueprint를 포함함](blueprints/010-finalize-pointer-scope/index.md) - nextBlueprint가 ready 후보 밖의 같은 epic 잔여 blueprint도 함께 보고한다
* [Distill 읽기 지점을 프리플라이트·라우팅 두 층으로 줄임](blueprints/011-distill-read-scope/index.md) - Distill을 읽는 7개 지점을 전수 조사해 plan·discovery·spec-authoring·finalize의 전량 읽기를 걷어낸다
* [벤치마크를 DeepSWE 스위트와 3 arm 프로토콜로 갈아엎음](blueprints/012-plugin-arm-benchmark/index.md) - 기존 docs/benchmark를 걷어내고 DeepSWE 기반 태스크 10개와 vanilla·superpowers·bouncer 3 arm 프로토콜, usage 기록 필드를 세운다
* [리뷰 흐름 중심 PR 본문 계약 개편](blueprints/013-structured-pr-body/index.md) - PR 본문 소스와 섹션 순서, 조건부 Mermaid, 검증 요약, 라벨 제거 규칙을 하나의 생성 계약으로 맞춘다
