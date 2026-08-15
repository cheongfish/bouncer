---
type: bouncer.blueprint
title: 공개 기반 차단선
description: Blueprint 001
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/001-security-legal-baseline/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-15T15:37:30.959+09:00'
bouncer:
  id: '001'
  epic_id: '039'
  blueprint_id: '001'
  status: closed
  commit_type: chore
  scale: full
---
# 001 security-legal-baseline

Epic: [039](../../index.md)

## Intent
- 문제: 런타임에 high 취약 버전을 벤더링하고 라이선스가 없으며, 핵심 TypeScript는
  strict와 ESLint 밖에 있다. GitHub와 GitLab도 같은 배포 계약을 검사하지 않는다.
- 완료 조건: 보안·법적·정적 품질·CI 기준이 한 저장소 명령으로 재현되고 두 CI가
  그 명령을 동일하게 강제한다.

## Contract
- 인터페이스:
  - 저장소 라이선스는 Apache-2.0이며 기여물도 같은 조건으로 받는다.
  - `npm run ci`가 emit 동기화, 제품 코드 coverage, test, lint, typecheck,
    dependency audit를 묶은 로컬·CI 공통 진입점이다.
  - 런타임 벤더는 `node_modules` 없이 계속 동작하되, 개발 의존성의 배포 파일과
    바이트 단위로 같아야 한다.
- 데이터·상태: `js-yaml`과 lockfile을 안전 버전으로 올리고, TypeScript 전 파일을
  strict 타입으로 바꾼다. Bouncer 문서 스키마와 런타임 상태 형식은 바꾸지 않는다.
- 수용 기준: epic 성공 기준 1~4와 8이 참이다.
- 검증 명령: task별 좁은 명령으로 중간 커밋을 검증하고 마지막 task는
  `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스:
  - npm audit는 벤더 파일을 보지 못하므로 lockfile만 안전한 상태를 통과시키지 않는다.
  - TypeScript 타입 보강이 CJS 공개 export·CLI 출력·게이트 의미를 바꾸면 실패다.
  - 테스트가 먼저 빌드해 stale emit을 덮는 순서로 CI를 구성하지 않는다.
  - registry나 외부 검증 호스트를 사용할 수 없으면 성공 증거를 만들지 않고 task를 멈춘다.

## Out of scope
- 공개 CLI·스키마·게이트·워크플로 의미 동결과 변경 — BP002.
- 외부 저장소·호스트 파일럿 — BP002.
- 버전 `1.0.0` 승격, 플러그인 태그와 공개 릴리스 — BP003.
- npm 패키지 게시.

## One-commit justification
- blueprint는 한 PR이고 task 여덟 개가 각각 한 커밋이다. 의존성, 법적 문서,
  네 타입 모듈군, lint 전환, CI 계약은 실패 원인과 리뷰 기준이 달라 독립 커밋으로
  둔다. 마지막 CI 커밋이 앞선 일곱 계약을 한 명령으로 묶는다.

## Minimality decisions
- coverage는 Node 24 내장 test runner를 사용하고 별도 coverage 패키지를 넣지 않는다.
- TypeScript lint는 parser와 plugin을 따로 배선하는 대신 공식 통합 패키지
  `typescript-eslint` 하나만 추가한다. 현재 ESLint·TypeScript 버전과 맞는 최소 표면이다.
- emit 검사는 별도 라이브러리나 셸별 구현 없이 Node 표준 라이브러리와 `git` 명령만
  쓰는 단일 script로 두 CI와 pre-commit에서 재사용한다.
- strict 전환용 `tsconfig.strict.json`은 여섯 모듈군 커밋을 각각 검증 가능하게 만드는
  임시 파일이며, 전역 전환 task에서 삭제해 이중 설정을 남기지 않는다.
- npm registry 게시와 소유자를 추정한 루트 `NOTICE`는 만들지 않는다. 플러그인 배포와
  Apache-2.0 준수에 필요한 파일만 추가한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 의존성과 런타임 벤더 보안
* [Tasks 002](tasks/002/tasks.md) - Apache-2.0과 공개 거버넌스
* [Tasks 003](tasks/003/tasks.md) - 기반 모듈 strict 타입
* [Tasks 004](tasks/004/tasks.md) - 문서·검증 모듈 strict 타입
* [Tasks 005](tasks/005/tasks.md) - Git 생명주기 모듈 strict 타입
* [Tasks 006](tasks/006/tasks.md) - 그래프·CLI 모듈 strict 타입
* [Tasks 007](tasks/007/tasks.md) - 전역 strict와 TypeScript lint
* [Tasks 008](tasks/008/tasks.md) - 공통 CI와 coverage 차단선
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
