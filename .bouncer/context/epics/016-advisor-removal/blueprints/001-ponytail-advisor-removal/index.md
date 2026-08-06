---
type: bouncer.blueprint
title: 쓰이지 않는 Ponytail 어드바이저 경로 제거
description: Blueprint 001
resource: .bouncer/context/epics/016-advisor-removal/blueprints/001-ponytail-advisor-removal/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T10:35:22.949+09:00'
bouncer:
  id: '001'
  epic_id: '016'
  blueprint_id: '001'
  status: approved
  commit_type: refactor
  commit_intent:
    - 설정을 읽는 워크플로가 없어 권고 경로가 사람 손을 두 번 거쳐야만 동작함
    - 최소화 규율은 minimality 스킬이 맡으므로 읽히지 않는 표면을 걷어냄
---
# 001 ponytail-advisor-removal

Epic: [016](../../index.md)

## Intent
- 문제: `plugin_advisors.ponytail` → `advisor.recommendMode` → `bouncer advise` 한 갈래가 저장소에 남아 있지만 스킬·게이트·훅 어디도 이 갈래를 부르지 않는다. `init`은 새 프로젝트마다 이 설정 블록을 심고, `--help`는 명령을 광고한다.
- 완료 조건: 설정 기본값, CLI 서브커맨드, `advisor` 모듈, 이를 겨냥한 테스트, 이를 안내하는 문서가 모두 사라지고 `npm test`가 통과한다.

## Contract
- 인터페이스: `bouncer` CLI에서 `advise` 서브커맨드를 제거한다. `bouncer advise`는 다른 미지원 명령과 같은 경로를 타서 stderr에 usage를 쓰고 종료 코드 2로 끝난다. `bouncer --help`의 명령 목록에서 해당 행이 빠진다. `scripts/lib/advisor` 모듈(`readConfig` · `detectPhase` · `recommendMode`)은 공개 표면에서 사라진다 — 세 함수 모두 `advise` 전용이며 다른 소비자가 없다.
- 데이터·상태: `bouncer init`이 생성하는 기본 `config.json`에서 `plugin_advisors` 키가 빠진다. 나머지 키(`source_dirs` · `context_dirs` · `graphify` · `verify` · `base_branch` · `pr` · `subagents`)와 그 순서는 그대로다. config는 OKF 스키마 검증 대상이 아니므로 남아 있는 `plugin_advisors`는 거부되지 않고 무시된다.
- 수용 기준: 에픽 Success criteria 1–5를 모두 만족한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - `test/init.test.js`가 `docs/workflow.md`에 `bouncer advise`와 `Ponytail`이 **있을 것**을 단언한다. 문서만 고치고 이 단언을 두면 곧바로 실패한다 — 같은 커밋에서 함께 지운다.
  - `test/cli-help.test.js`의 기대 명령 목록에 `'advise'` 문자열이 박혀 있다.
  - `test/public-name-regression.test.js`는 `docs/ARCHITECTURE.md`에 `Ponytail`이 남아 있을 것을 단언한다. ADR 절을 유지하므로 통과하지만, 절 전체를 지우면 깨진다.
  - `scripts/lib`의 CJS 산출이 커밋 대상이라 `scripts/lib/advisor.js` 삭제를 빠뜨리면 소스 없는 산출물이 남는다.

## Out of scope
- `subagents` 설정과 `resolveSubagentModel`.
- `docs/ARCHITECTURE.md`의 Ponytail ADR 절 — `bouncer advise`를 안내하는 한 문장만 걷어낸다.
- 남아 있는 소비 프로젝트 config의 `plugin_advisors` 자동 제거·경고.
- 버전 범프.

## One-commit justification
- 제거 대상이 설정 → 모듈 → CLI → 테스트 → 문서로 한 갈래에 묶여 있어, 어느 하나만 떼면 나머지가 소스 없는 산출물이거나 즉시 실패하는 단언으로 남는다. 쪼갤 수 있는 지점이 없다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
