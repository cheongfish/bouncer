---
type: bouncer.epic
title: 오픈소스 1.0 공개
description: Epic 039
resource: .bouncer/context/epics/039-open-source-one-zero/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-15T15:37:26.670+09:00'
bouncer:
  id: '039'
  epic_id: '039'
  status: approved
---
# 039 open-source-one-zero

## Intent
- 문제: 0.8.4 코어는 테스트가 충분하지만 취약한 런타임 벤더, 라이선스 부재,
  느슨한 TypeScript 검사, 서로 다른 CI 계약 때문에 팀 표준이나 공개 1.0으로
  책임 있게 배포할 수 없다.
- 목표: 법적·보안·정적 품질 기준을 코드로 강제하고 공개 계약과 파일럿 증거를
  확정한 뒤, npm 패키지 없이 네 플랫폼용 플러그인 1.0을 배포한다.

## Success criteria
1. `npm audit --audit-level=high`가 통과하고, 런타임 `js-yaml` 벤더가 설치된
   개발 의존성과 바이트 단위로 일치하며 안전한 최소 버전보다 낮아지지 않는다.
2. 루트 `LICENSE`가 Apache-2.0 전문이고, `package.json` SPDX 식별자,
   `SECURITY.md`, `CODE_OF_CONDUCT.md`, 기여 라이선스 규칙이 서로 모순되지 않는다.
3. `tsconfig.json`이 `strict: true`이고 `scripts/src/lib/**/*.ts` 전체가
   TypeScript ESLint와 `npm run typecheck`를 통과한다.
4. GitHub Actions와 GitLab CI가 같은 저장소 소유 검증 명령을 실행하며, 그 명령이
   stale CJS emit, 테스트·lint·type 오류, high 이상 의존성 취약점, 제품 코드
   line 94%·branch 82%·function 96% 미만을 거부한다.
5. 공개 CLI·문서 스키마·게이트·워크플로 목록과 하위 호환 정책이 문서에 있고,
   파일럿에서 필요한 의미 변경과 마이그레이션이 그 계약을 만족한다.
6. 서로 다른 세 종류의 저장소와 두 개 이상의 지원 호스트에서 전체 Bouncer
   사이클을 실행한 결과가 성공·실패·사용자 개입 횟수와 함께 남고, 미검증 조합은
   지원 대상으로 표시되지 않는다.
7. 네 플랫폼 매니페스트와 `package.json` 버전이 `1.0.0`으로 일치하고,
   `bouncer--v1.0.0` 태그에서 문서화된 마켓플레이스 설치와 smoke cycle이
   재현된다.
8. 각 blueprint의 검증 명령과 최종 `npm test`가 통과한다.

## Out of scope
- npm 레지스트리 게시. Bouncer는 Git 저장소를 clone하는 플러그인으로만 배포한다.
- 1.0 공개·파일럿 기준과 관계없는 신규 기능과 UI.
- 파일럿에서 실행하지 않은 Node 버전·운영체제·에이전트 호스트 지원 선언.

## Delivery order
1. BP001은 취약점·라이선스·strict/lint·CI 차단선을 한 PR에서 세운다.
2. BP002는 공개 계약을 문서와 회귀 테스트로 동결하고, 파일럿 기록 틀과 지원 선언
   규칙을 만든다. 외부 저장소·호스트에서의 실제 파일럿 실행은 blueprint 밖 운영
   작업이며, 그 결과가 요구하는 의미 변경과 마이그레이션은 별도로 계획한다.
3. BP003은 남은 차단 항목이 없을 때 플러그인 매니페스트를 `1.0.0`으로 올리고
   태그·릴리스 노트·설치 smoke 결과를 남긴다.

## Blueprints
* [001 공개 기반 차단선](blueprints/001-security-legal-baseline/index.md) - 의존성·벤더·Apache-2.0·TypeScript·CI 품질 계약을 코드와 공개 문서에 고정한다
* [002 공개 계약 동결](blueprints/002-public-contract-freeze/index.md) - 공개 표면과 하위 호환 정책을 문서·테스트로 동결하고 파일럿 기록 틀과 지원 선언 규칙을 만든다
* [003 1.0 공개 릴리스](blueprints/003-one-zero-release/index.md) - 1.0.0 버전 정합성·릴리스 노트·세 저장소 유형과 두 호스트의 설치 smoke 증거를 확정한다
