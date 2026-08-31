---
type: bouncer.epic
title: 쓰이지 않는 Ponytail 어드바이저 제거
description: 설정·명령·모듈·테스트·문서에서 Ponytail 어드바이저 경로를 걷어내 읽히지 않는 표면을 없앤다
resource: .bouncer/context/epics/016-advisor-removal/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-06T10:35:22.918+09:00'
bouncer:
  id: '016'
  epic_id: '016'
  status: approved
---
# 016 advisor-removal

## Intent
- 문제: `plugin_advisors.ponytail`은 `bouncer init`이 기본 config에 자리를 만들어 두지만, plan/execute/finalize 스킬도 게이트도 이 값을 읽지 않는다. 유일한 소비자인 `bouncer advise`는 사용자가 직접 실행해야 하고, 출력한 `/ponytail …` 문자열을 사람이 다시 입력해야 모드가 바뀐다.
- 목표: 최소화 규율은 `minimality` 스킬이 이미 담당하므로, 설정·명령·모듈·테스트·문서에서 Ponytail 어드바이저 경로를 걷어내 읽히지 않는 표면을 없앤다.

## Success criteria
1. `.bouncer/config.json`, `config.example.json`, `bouncer init`이 쓰는 기본 config 세 곳 어디에도 `plugin_advisors` 키가 없다.
2. `bouncer advise`가 존재하지 않는다 — `bouncer --help` 목록에 나오지 않고, 호출하면 알 수 없는 명령으로 stderr에 쓰고 종료 코드 2로 끝난다.
3. `scripts/src/lib/advisor.ts`와 `scripts/lib/advisor.js`가 저장소에 없다.
4. `docs/` 안에 `bouncer advise`를 명령으로 안내하는 문장이 남지 않는다.
5. `npm test`가 통과한다.

## Out of scope
- `subagents` 설정 — `resolveSubagentModel`이 실제 디스패치에서 읽으므로 그대로 둔다.
- `minimality` 스킬 본문 — 이번 제거로 달라지는 것이 없다.
- `docs/ARCHITECTURE.md`의 "Ponytail 원칙만 `minimality`로 흡수한다" ADR 절 — 채택 근거 기록이라 유지한다.
- `verify` · `graphify` · `pr` · `base_branch` 등 나머지 config 키.
- 소비 프로젝트의 기존 config 마이그레이션 — 남아 있는 `plugin_advisors`는 읽히지 않고 무시된다.
- 버전 범프와 릴리스 태그 — 관례대로 에픽 밖 별도 `chore` 커밋이 맡는다.

## Blueprints
* [Ponytail 어드바이저 경로 제거](blueprints/001-ponytail-advisor-removal/index.md) - `plugin_advisors` 기본값·`bouncer advise` 서브커맨드·`advisor` 모듈을 `scripts/`에서 걷어내고 `test/`·`docs/`의 참조를 함께 정리한다
