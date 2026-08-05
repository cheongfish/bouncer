---
type: bouncer.blueprint
title: 002 commands-to-skills
description: Blueprint 002
resource: .bouncer/context/epics/003-multi-agent-plugin/blueprints/002-commands-to-skills/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-07-28T01:53:11.404Z'
bouncer:
  id: '002'
  epic_id: '003'
  blueprint_id: '002'
  status: approved
---
# 002 commands-to-skills

Epic: [003](../../index.md)

## Intent
- 문제: Bouncer의 워크플로 진입점 네 개가 `commands/*.md`에만 존재한다. `commands/`는
  Claude Code와 Cursor가 공유하는 표면이고, Codex는 이 디렉터리를 워크플로 진입점으로
  읽지 않는다. 반면 `skills/*/SKILL.md`는 003이 전제하는 대로 세 에이전트가
  모두 그대로 읽는 유일한 공통 표면이다. 그래서 001이 매니페스트와 플러그인 루트
  토큰을 정리해도 Codex에서는 plan→execute→finalize 워크플로 자체가 성립하지 않는다.
- 완료 조건: `commands/`가 사라지고 `skills/bouncer-{init,plan,execute,finalize}/SKILL.md`
  네 개가 유일한 워크플로 표면이 된다. Claude Code에서 `/bouncer-*` 슬래시 호출과 게이트
  동작이 회귀 없이 유지되고, `npm test`가 통과한다.

## Contract
<!-- 계약만. 구현 코드 금지 — 시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다. -->
- 인터페이스 (신규 워크플로 스킬 4개, 파일 자체가 계약):
  - `skills/bouncer-init/SKILL.md`, `skills/bouncer-plan/SKILL.md`,
    `skills/bouncer-execute/SKILL.md`, `skills/bouncer-finalize/SKILL.md`.
    각 `name`은 디렉터리명과 일치하고, 본문은 대응하는 `commands/*.md`의 절차를
    그대로 승계한다. 슬래시 이름(`/bouncer-plan` 등)은 바뀌지 않는다.
  - `description`은 **명시 호출 조건**을 포함한다. 커맨드는 사용자가 부를 때만
    실행되지만 스킬은 모델이 설명을 보고 자동 선택하므로, 조건이 없으면 게이트
    순서를 건너뛴 진입이 가능해진다.
- 인터페이스 (하위 스킬 참조 표기): 워크플로 스킬이 하위 스킬을 가리킬 때
  이름과 파일 경로를 함께 적는다 (예: `discovery` 스킬 — `skills/discovery/SKILL.md`).
  Skill 호출 도구가 없는 에이전트에서도 파일을 읽어 폴백할 수 있어야 한다.
- 인터페이스 (진입 가드): `bouncer-execute`·`bouncer-finalize`는 `.bouncer/current`가
  없으면 중단하고 `/bouncer-plan`을 안내한다 — 기존 동작을 계약으로 명문화한다.
  런타임 강제력은 모델의 선택이 아니라 이 상태 파일에서 나온다.
- 데이터·상태: 저장소 상태 변화 없음. `.bouncer/` 문서 스키마, 게이트 판정
  (`scripts/lib/validate.js`), 커밋 가드(`scripts/lib/commit-guard.js`), 훅 배선은
  그대로다. `.claude-plugin/plugin.json`은 `commands`/`skills`를 선언하지 않고 관례
  탐색에 의존하므로 매니페스트 변경도 없다.

## Out of scope
- 하위 스킬 8개(`discovery`, `spec-authoring`, `implementation`, `verification`,
  `review`, `minimality`, `debugging`, `graphify-runner`)의 `bouncer-` 접두어 리네임.
  거버넌스 §4 표와 `test/public-name-regression.test.js`의 승인 목록까지 연쇄로
  건드리므로 후속 blueprint로 분리한다. 이 blueprint는 하위 스킬의 `name`을 바꾸지
  않는다.
- 매니페스트 추가와 `${CLAUDE_PLUGIN_ROOT}` 토큰 해석 — 001 소관. 002는
  001이 확정한 루트 토큰 표현을 그대로 옮기기만 한다.
- `scripts/lib/` 게이트·가드 판정 로직 변경. 이미 에이전트 중립이다.
- 하위 스킬 **본문** 재작성. 오발동을 막는 `description` 한정 문구 추가만 한다.
- Codex에서의 실제 설치 검증 — 001의 매니페스트가 선행되어야 하고, 그쪽에서
  다룬다.

## One-commit justification
<!-- .bouncer/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 변경의 실체는 표면 이동 하나다. 파일 4개를 옮기고, 그것을 가리키던 테스트와 문서
  참조를 따라 옮긴다.
- 쪼갤 수 없다. `commands/`와 `skills/`에 같은 워크플로가 동시에 존재하는 중간 커밋은
  어느 쪽이 정본인지 모호하고, 두 표면이 갈라진 채 배포될 수 있다. 이관과 삭제는
  같은 커밋이어야 한다.
- diff는 반복적이다: 본문 4개 이동 + 테스트 4개의 경로·어서션 치환 + 문서의 표면
  명칭 갱신. 판정 로직을 건드리지 않으므로 회귀는 `npm test`가 덮는다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
