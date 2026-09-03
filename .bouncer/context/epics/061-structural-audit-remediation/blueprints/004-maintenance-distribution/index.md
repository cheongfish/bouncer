---
type: bouncer.blueprint
title: 유지보수와 배포 표면 정비
description: Replaces prose-coupled checks and repeated release wiring with structural maintenance and distribution contracts.
resource: .bouncer/context/epics/061-structural-audit-remediation/blueprints/004-maintenance-distribution/index.md
tags:
  - bouncer
  - blueprint
  - documentation
  - release
  - distribution
  - launcher
timestamp: '2026-09-03T16:13:46.051+09:00'
bouncer:
  id: '004'
  epic_id: '061'
  blueprint_id: '004'
  status: closed
  commit_type: chore
  scale: full
  supersedes: []
---
# 유지보수와 배포 표면 정비

Epic: [061](../../index.md)

## Intent

- 문제: 감사 항목 3·5·6·13은 산문 표현에 결합된 테스트, 여러 파일의 버전 리터럴, 개발 코퍼스까지 포함하는 배포물, 반복되는 `BOUNCER_ROOT` 부트스트랩을 남긴다.
- 완료 조건: 문서 계약은 구조로 검증되고, 패키지 버전과 배포 포함 목록은 정본에서 판정되며, `bouncer` 런처가 설치된 최고 버전을 스스로 해석해 모든 workflow 예시가 같은 호출 표면을 사용한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스: 문서·스킬 검사는 필요한 섹션, 순서, 링크, frontmatter와 명시된 계약을 판정한다. 릴리스 검사는 `package.json`의 버전을 기준으로 모든 배포 매니페스트와 lockfile을 대조하며, 패키지 `files` 목록은 배포할 런타임 표면만 포함한다. `bouncer <args>`는 인자와 종료 코드를 보존한 채 최고 우선순위 설치본으로 재실행한다.
- 데이터·상태: 개발용 `.bouncer/context/` 코퍼스는 저장소에 남지만 패키지 배포 포함 목록에서는 제외한다. host별 매니페스트의 이름·버전·필수 경로 계약은 유지한다.
- 수용 기준: 산문을 동등한 표현으로 고쳐도 구조 계약 테스트가 불필요하게 실패하지 않고, 버전 문자열의 정본은 `package.json` 하나이며, 패키지 포함 파일 검사가 코퍼스 누출을 거부하고, 모든 skill의 CLI 블록이 직접 `bouncer`를 호출한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 누락된 필수 섹션·깨진 링크·매니페스트 버전 드리프트·의도치 않은 배포 파일·자기 재실행 루프·`bouncer-root` 자체 호출은 명시적으로 거부하거나 기존 동작을 유지한다.

## Out of scope
- 감사 항목 1·2·4·7~12의 보안·정확성·토큰 효율 변경
- 도그푸딩 `.bouncer/context/` 코퍼스의 삭제 또는 기록 축소
- 새 패키지 관리자, 빌드 도구, 문서 파서 의존성의 도입
- 플러그인 호스트별 설치 프로토콜의 변경

## One-commit justification

- 네 변경은 서로 다른 실패 표면과 검증 근거를 가진다. 문서 구조 검사, 버전 정본, 배포 목록, 런처 전환을 각 task commit으로 분리하되 하나의 유지보수·배포 PR로 검토한다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 산문 테스트를 구조 검사로 전환
* [Verification 001](tasks/001/verification.md) - 문서 구조 계약 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 버전 정본과 매니페스트 대조
* [Verification 002](tasks/002/verification.md) - 버전 동기화 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - 배포 포함 목록 제한
* [Verification 003](tasks/003/verification.md) - 패키지 내용물 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Tasks 004](tasks/004/tasks.md) - 자가 해석 CLI 런처
* [Verification 004](tasks/004/verification.md) - 런처 호환성 증적
* [Review 004](tasks/004/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
