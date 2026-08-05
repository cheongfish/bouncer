---
type: bouncer.blueprint
title: Named 서브에이전트 라우팅으로 전환
description: 플러그인 agents/ 추가와 review·execute 디스패치 전환
resource: .bouncer/context/epics/009-subagent-model-config/blueprints/002-named-agent-routing/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-03T08:21:43.832Z'
bouncer:
  id: '002'
  epic_id: '009'
  blueprint_id: '002'
  status: approved
---
# 002 named-agent-routing

Epic: [009](../../index.md)

## Intent
- 문제: 001이 만든 `resolveSubagentModel`에 소비자가 없다. review와 execute는
  여전히 generic 서브에이전트를 띄우므로 모델을 고를 대상 자체가 없고,
  페르소나·가드·출력 계약이 스킬 본문에 섞여 있다.
- 완료 조건: 플러그인 루트 `agents/`에 두 named agent가 존재하고, review와
  execute가 그 이름으로 디스패치하면서 config 모델을 적용하며, 이름 있는
  에이전트를 못 쓰는 호스트에서는 기존 generic/인라인 경로로 떨어진다.

## Contract
- 인터페이스: 플러그인 루트에 `agents/bouncer-reviewer.md`,
  `agents/bouncer-implementer.md`가 생긴다. frontmatter는 호스트 공통 필드만
  쓴다.

  ```yaml
  name: bouncer-reviewer      # 파일 basename과 동일
  description: <자동 위임 판단용 한 줄>
  model: inherit              # 모델은 config가 디스패치 시점에 주입한다
  readonly: true              # reviewer 전용. 미지원 호스트는 무시한다
  ```

- 인터페이스: 두 스킬의 디스패치 절차가 다음 순서로 바뀐다.
  1. `resolveSubagentModel`로 `{ model }`을 조회한다
  2. named agent를 그 모델로 호출한다 (brief는 호출 프롬프트에 붙인다)
  3. 호스트가 slug를 거부하면 `inherit`로 재시도하고 사용자에게 알린다
  4. named agent 자체를 못 쓰면 기존 generic/인라인 경로로 떨어진다
- 데이터·상태: 없음. 문서 상태 전이와 게이트는 그대로다. 컨트롤러만
  `review.md`의 `## Findings` / `bouncer.review.findings[]`를 쓰고 상태를
  뒤집는다 — 서브에이전트는 어느 쪽도 하지 않는다.
- 수용 기준: 009 Success criteria 4·5·6.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - Codex는 플러그인이 `agents/`를 배포할 수 없어 항상 폴백 경로를 탄다.
  - `bouncer-implementer`는 git 명령과 문서 상태를 다루지 않는다. 커밋과
    상태 전이는 컨트롤러가 유지해 `commit-safety`가 보던 자리를 그대로 둔다.
  - 매니페스트에 `agents` 경로를 재선언하지 않는다. Claude 로더는 관례 경로를
    매니페스트가 다시 가리키면 중복으로 보고 플러그인 전체를 거부한 전례가
    있고(`test/plugin-wiring.test.js`의 hooks 사례), Cursor는 경로 미지정 시
    `agents/`를 자동 탐색한다.

## Out of scope
- `.bouncer/config.json` 스키마와 `resolveSubagentModel` 구현 — 001.
- 리뷰 루브릭·심각도 계산 등 판정 내용 변경. 옮기는 것은 배치이지 기준이 아니다.
- Codex용 `.codex/agents/` TOML 정의 배포.
- `discovery`·`spec-authoring` 등 나머지 스킬의 named agent 전환.

## One-commit justification
- Distill이 이미 "리뷰어 루브릭과 `reviewer-prompt.md`는 execute 디스패치와 한
  쌍 — 같은 커밋에서 바꾼다"고 못박고 있다. 에이전트 문서를 나중 커밋으로
  미루면 그 사이 커밋에서 스킬이 존재하지 않는 이름을 가리킨다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
