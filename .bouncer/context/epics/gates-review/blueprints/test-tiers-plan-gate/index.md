---
type: bouncer.blueprint
title: 신규 테스트 tier 등록 plan gate와 task 검사 래퍼
description: Reject plans whose new test files skip test/tiers.json (G33) and add a single-argv task check script plus verify guidance
resource: .bouncer/context/epics/gates-review/blueprints/test-tiers-plan-gate/index.md
tags:
  - bouncer
  - blueprint
  - plan-gate
  - test-tiers
  - verify
  - affected-paths
timestamp: '2026-10-28T11:27:43.360+09:00'
bouncer:
  id: test-tiers-plan-gate
  epic_id: gates-review
  blueprint_id: test-tiers-plan-gate
  status: closed
  order: 21
  commit_type: feat
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: plan gate 판정(G33)과 task verify 검증 구성을 바꾸는 gate·검증 변경이다
  supersedes: []
---
# 신규 테스트 tier 등록 plan gate와 task 검사 래퍼

Epic: [gates-review](../../index.md)

## Intent
신규 테스트의 tier 미등록, 테스트 이름 형식, 문서 인용, unit tier 프로세스 생성 위반이 task 전용 verify 밖에 있어 종단 `npm run ci`에서야 드러나고 repair wave를 반복해서 소모했다. 이 변경은 tier 미등록을 plan gate `G33`으로 승인 전에 막고, 나머지 정적 검사를 task verify 한 줄로 돌리는 `scripts/check-task.js`와 제품 문서 지침을 더한다.

## Contract
- 인터페이스:
  - `bouncer validate --gate plan`과 plan draft 검사(`review-dispatch plan`)는 새 실패 코드 `G33`을 낸다. 복합 gate는 `scope-declaration`이고, 실패 항목에는 `next` hint가 붙는다.
  - 이 저장소에 `node scripts/check-task.js <test/<name>.test.js>...`를 추가한다. exit 코드는 0(통과), 1(검사 실패·없는 파일), 2(인자 없음)다.
  - 제품 문서 `skills/bouncer-plan/SKILL.md`·`references/spec-authoring/index.md`에 task verify 구성 원칙 한 줄을 넣는다.
- 데이터·상태: frontmatter 스키마는 바뀌지 않는다. `G33`은 저장소 파일의 존재 여부(`test/tiers.json`과 각 테스트 경로)만 읽는다.
- 수용 기준: epic Success criteria 26·27·28.
- 검증 명령: task 001 `node --test test/validate-gates.test.js test/composite-gates.test.js test/validate-hints.test.js`, task 002 `node --test test/check-task.test.js`, task 003 `node --test test/skill-bouncer-surface.test.js test/skill-spec-authoring.test.js test/plugin-doc-cites.test.js`, 종단 task 004 `npm run ci`.
- 실패 모드·엣지 케이스:
  - Touch 후보는 표의 경로 열에서만 읽는다. `Create` 행의 경로와 `Rename` 행의 새 경로가 대상이고, 백틱이 있든 없든 같다. `근거`·`계획한 변경` 열에 인용된 경로는 보지 않는다. `./test/x.test.js`는 `test/x.test.js`로 정규화한다.
  - 선행 task가 만들 테스트 파일을 이 task Touch에서 `Modify`로 선언했다면 신규 테스트로 보지 않는다. 이 경우 checkout에는 아직 파일이 없지만 이 task가 새로 만드는 파일이 아니다.
  - `test/helpers/*.js`, `test/fixtures/**`, 하위 디렉터리 `test/a/b.test.js`는 신규 테스트가 아니다. `test/tiers.json`은 `test/` 바로 아래 파일만 다룬다.
  - 이미 있는 테스트 파일을 수정하는 task, `test/tiers.json`이 없는 저장소, `repoRoot` 없는 단위 호출, verification task에서는 `G33`을 내지 않는다.
  - `plan approve`는 `G5`와 마찬가지로 `G33`을 검사하지 않는다. 승인 뒤 plan gate가 판정한다.
  - `check-task.js`가 중첩 `node --test`를 띄울 때는 자식 env에서 `NODE_TEST_CONTEXT`를 지운다. 지우지 않으면 자식이 파일을 건너뛰고 exit 0으로 끝나 거짓 통과가 된다.

## Out of scope
- 결번 G 코드 재사용과 문서 품질 판정의 복원.
- `.bouncer/config.json`에 일반 동반 경로 규칙 스키마를 추가하는 일.
- implementer의 변경 파일 eslint 단계. `agents/bouncer-implementer.md:139`에 이미 있다.
- `scripts/test-tier.js`의 tier 전체 실행을 task verify에 넣는 일.
- `plan approve`의 `G33` 검사, 이미 승인된 계획의 소급 수정, `CHANGELOG.md`·버전 파일 갱신.
- retro 문서의 작업 2·3(coordinator 결함, 설계 결정과 잔여 정리).

## One-commit justification
- 세 변경은 같은 실패 계열(종단 CI에서야 드러나는 기계 검출 실수)을 서로 다른 시점에 막는다. gate·래퍼·지침을 한 PR에서 함께 리뷰해야 역할 분담이 겹치거나 빠지는지 판단할 수 있다. 구현은 경로가 겹치지 않는 commit task 세 개로 나눈다.
