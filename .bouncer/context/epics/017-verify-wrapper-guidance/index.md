---
type: bouncer.epic
title: 프로젝트 검증 래퍼 안내
description: plan 단계에서 프로젝트의 검증 실행 환경을 확인하고 그 프로젝트에 맞는 단일 verify 명령을 안내한다
resource: .bouncer/context/epics/017-verify-wrapper-guidance/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-06T16:56:12.469+09:00'
bouncer:
  id: '017'
  epic_id: '017'
  status: approved
---
# 프로젝트 검증 래퍼 안내

## Intent
- 문제: 검증 명령은 셸 체이닝 없는 단일 실행 문자열만 받는다. 컨테이너를 띄워야
  테스트가 도는 프로젝트는 이 형식에 맞는 명령을 찾지 못해 기본 `npm test`를
  그대로 두고, execute 게이트가 실제로 아무것도 검증하지 못한 채 통과한다.
- 목표: plan 단계에서 프로젝트의 컨테이너·빌드 스크립트를 확인하고, 그 프로젝트가
  실제로 쓰는 테스트 진입점을 blueprint 검증 명령으로 지정할지 사용자에게 묻는다.

## Success criteria
1. `/bouncer-plan`이 저장소 루트에서 compose 파일, `Makefile`, `Taskfile`,
   `package.json`의 scripts를 확인하고, 하나라도 있으면 blueprint 검증 명령을
   지정할지 사용자에게 묻는다.
2. 제안된 값은 `isValidVerifyCommand`를 통과하는 단일 실행 문자열이다. 셸 체이닝이
   필요한 형태는 제안하지 않고, 래퍼 스크립트로 감싸라고 안내한다.
3. `docs/configuration.md`에서 래퍼 스크립트 패턴, worktree별 compose 프로젝트
   이름 분리, docker 없는 환경에서의 처리 세 가지를 모두 확인할 수 있다.
4. `test/skill-bouncer-plan.test.js`가 새 단계의 존재를 계약으로 잡는다.
5. `npm test`가 통과한다.

## Out of scope
- `verify.setup` / `verify.teardown` 같은 설정 필드 신설. 검증 명령의 단일 실행
  문자열 제약은 그대로 둔다.
- 사용자 확인 없이 `config.verify`를 자동으로 바꾸는 동작.
- Bouncer가 컨테이너를 직접 띄우거나 정리하는 것.
- `bouncer init` 시점의 탐지. 부트스트랩 이후에 생기는 파일을 놓치므로 plan에서만
  본다.
- monorepo 하위 디렉터리 탐색. 저장소 루트만 본다.

## Blueprints
* [001 plan-verify-detection](blueprints/001-plan-verify-detection/index.md) - plan에 빌드 스크립트 감지·검증 명령 제안 단계를 추가하고 래퍼 패턴을 문서화한다 (`skills/bouncer-plan`, `docs/configuration.md`, 계약 테스트)
