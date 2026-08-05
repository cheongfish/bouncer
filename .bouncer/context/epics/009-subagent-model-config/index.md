---
type: bouncer.epic
title: 서브에이전트 모델 설정
description: 프로바이더별 named 서브에이전트 모델을 config로 권고하고 디스패치 시점에 적용
resource: .bouncer/context/epics/009-subagent-model-config/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-03T07:48:44.174Z'
bouncer:
  id: '009'
  epic_id: '009'
  status: approved
---
# 009 subagent-model-config

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
* [서브에이전트 모델 설정 계약](blueprints/001-subagent-model-config-contract/index.md) - config `subagents` 기본값과 모델 해석 헬퍼를 도입한다
* [Named 서브에이전트 라우팅](blueprints/002-named-agent-routing/index.md) - 플러그인 루트 `agents/`를 추가하고 review·execute 디스패치를 named agent로 전환한다
