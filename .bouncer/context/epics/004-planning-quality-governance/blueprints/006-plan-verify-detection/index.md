---
type: bouncer.blueprint
title: 빌드 스크립트 감지 시 검증 명령 래퍼 안내 추가
description: Blueprint 001
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/006-plan-verify-detection/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-06T16:56:18.524+09:00'
bouncer:
  id: '006'
  epic_id: '004'
  blueprint_id: '006'
  status: approved
  commit_type: feat
  commit_intent:
    - 컨테이너를 띄워야 테스트가 도는 프로젝트는 단일 실행 문자열 제약 때문에 실제 검증 경로를 지정하지 못하고 기본값을 방치하게 됨
    - 설정 파일은 부트스트랩 이후에도 생기므로 사이클마다 확인해야 놓치지 않음
---
# 006 plan-verify-detection

Epic: [004](../../index.md)

## Intent
- 문제: 컨테이너 기동이 필요한 프로젝트에서 검증 명령이 기본값에 머문다. 형식
  제약 때문에 `up` 과 테스트를 한 줄로 이을 수 없는데, 그 사실과 우회 방법을
  알려 주는 자리가 어디에도 없다.
- 완료 조건: plan이 저장소 루트의 빌드·컨테이너 스크립트를 확인해 사용자에게
  검증 명령 지정 여부를 묻고, 래퍼 패턴이 설정 문서에 남는다.

## Contract
- 인터페이스: `/bouncer-plan`에 단계 하나를 추가한다. 스캐폴드 이후, 문서 본문을
  작성하는 단계 안에서 아래를 수행한다.
  - 저장소 루트에서 `docker-compose.yml`, `docker-compose.yaml`, `compose.yml`,
    `compose.yaml`, `Makefile`, `Taskfile.yml`, `package.json`의 `scripts` 존재를 확인한다.
  - 하나라도 있으면 사용자에게 이 blueprint의 검증 명령을 지정할지 묻는다.
    묻지 않고 값을 쓰지 않는다.
  - 지정하기로 하면 `tasks.md` frontmatter `bouncer.verify`에 단일 실행 문자열을 쓴다.
  - 아무것도 없거나 사용자가 거절하면 그대로 두고 전역 설정값을 쓴다.
- 데이터·상태: 기존 `tasks.bouncer.verify` 필드를 그대로 쓴다. 새 설정 키도, 새
  frontmatter 필드도 만들지 않는다. `config.verify`는 건드리지 않는다.
- 수용 기준: 에픽 성공 기준 1~5.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 컨테이너 설정은 있으나 테스트 진입점이 없는 프로젝트 — 래퍼를 만들라고
    강요하지 않는다. 문서를 가리키고 전역 설정값을 그대로 둔다.
  - 사용자가 `&&`나 리디렉션이 섞인 명령을 원하는 경우 — 그대로 쓰면 plan 게이트가
    막는다. 제안하는 자리에서 미리 이유를 설명하고 래퍼로 감싸도록 안내한다.
  - 감지 대상이 둘 이상인 경우 — 후보를 나열하되 하나를 고르는 건 사용자다.
  - worktree에서 컨테이너를 띄우면 원본 체크아웃과 프로젝트 이름·포트가 겹친다.
    문서에 분리 방법을 남긴다.
  - docker가 없는 환경에서는 래퍼 자체가 건너뛰도록 권고한다. Bouncer는 docker
    설치 여부를 판정하지 않는다.

## Out of scope
- `verify.setup` / `verify.teardown` 필드 신설, 단일 실행 문자열 제약 완화.
- 사용자 확인 없는 `config.verify` 자동 변경.
- 감지 로직을 TypeScript로 구현하는 것. 스킬 본문에서 파일 존재만 확인한다.
- monorepo 하위 디렉터리 탐색.

## One-commit justification
- 감지 단계(스킬 본문), 그 단계가 가리킬 문서(설정 문서), 단계의 존재를 잡는 계약
  테스트가 서로를 참조한다. 하나만 넣으면 가리킬 곳이 없거나 계약이 비는 상태가
  되므로 한 커밋으로 묶는다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
