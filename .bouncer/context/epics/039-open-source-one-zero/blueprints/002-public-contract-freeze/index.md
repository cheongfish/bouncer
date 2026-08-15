---
type: bouncer.blueprint
title: 공개 계약 동결
description: Blueprint 002
resource: .bouncer/context/epics/039-open-source-one-zero/blueprints/002-public-contract-freeze/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-15T18:45:30.065+09:00'
bouncer:
  id: '002'
  epic_id: '039'
  blueprint_id: '002'
  status: closed
  commit_type: docs
  scale: full
---
# 002 public-contract-freeze

Epic: [039](../../index.md)

## Intent
- 문제: 공개 표면이 `cli.md`, `gates.md`, `workflow.md`, `configuration.md`에
  흩어져 있고, 무엇을 바꾸면 소비자가 깨지는지 아무 데도 적혀 있지 않다. 문서와
  구현이 어긋나도 아무것도 실패하지 않는다 — 지금 `gates.md`는 코드가 `S0–S20`
  뿐이라고 적지만 실제로는 `S26`까지 나온다. 파일럿 결과를 남길 형식도 없어
  검증하지 않은 호스트와 검증한 호스트가 문서에서 같은 무게로 읽힌다.
- 완료 조건: 공개 표면 다섯 종과 하위 호환·폐기 정책이 문서 하나에서 확정되고,
  그 목록이 구현과 어긋나면 `npm test`가 실패하며, 파일럿 매트릭스와 지원 선언이
  같은 출처를 본다.

## Contract
- 인터페이스:
  - `docs/compatibility.md`가 공개 표면 인덱스(CLI 명령, 문서 스키마·상태 어휘,
    게이트 G/S 코드, 워크플로 스킬, `config.json` 키)와 하위 호환 정책의 정본이다.
  - `docs/PILOT.md`가 파일럿 매트릭스(저장소 유형 × 호스트)와 실행 기록 형식의
    정본이고, `docs/install.md`의 지원 현황은 그 매트릭스를 그대로 반영한다.
  - `test/public-contract.test.js`가 문서 목록과 구현·매트릭스 사이 drift를
    실패로 바꾼다.
- 데이터·상태: 새 CLI 명령·게이트 코드·설정 키·문서 status를 만들지 않는다.
  `BOUNCER_SCHEMA_VERSION`은 `0.1`에 둔다 — 승격은 BP003 소관이다.
- 수용 기준: epic 성공 기준 8이 참이다. 성공 기준 5는 앞 절(공개 목록과 하위 호환
  정책이 문서에 있다)까지, 성공 기준 6은 기록 틀과 지원 선언 규칙까지 참이다.
  두 기준의 나머지 절(파일럿이 요구하는 의미 변경·마이그레이션, 실제 실행 결과)은
  파일럿을 돌린 뒤에야 판정할 수 있어 이 blueprint 밖이다.
- 검증 명령: 문서 task는 `npm test`, 마지막 task는 `npm run ci`.
- 실패 모드·엣지 케이스:
  - 문서가 구현보다 뒤처지는 drift. 지금 `gates.md`의 `S0–S20` 표기가 그 예다.
  - 결번 코드(`G9`, `G15`, `S14`) 재사용. 같은 번호가 다른 의미로 부활하면 과거
    실패 기록과 troubleshooting 문서가 거짓이 된다.
  - 회귀 테스트가 문서 문장 자체를 고정해 정상적인 내부 리팩터링까지 막는 것.
    테스트는 이름 집합만 대조하고 설명 문장은 판정하지 않는다.
  - 파일럿을 돌리지 않은 조합이 문서에서 「지원」으로 읽히는 것.

## Out of scope
- 실제 파일럿 사이클 실행과 그 결과 채우기. 외부 저장소·호스트가 필요한 운영
  작업이라 이 blueprint는 기록 틀과 판정 규칙까지만 만든다.
- 버전 `1.0.0` 승격, 태그, 릴리스 노트, 마켓플레이스 설치 smoke — BP003.
- 새 CLI 명령, 게이트 코드, 설정 키, 문서 status 추가.
- 스킬·에이전트 행동 변경과 `rules/` 개정.

## One-commit justification
- blueprint는 한 PR이고 task 셋이 각각 한 커밋이다. 계약 문서화, 그 계약을
  강제하는 테스트, 파일럿 기록 틀은 실패 원인과 리뷰 기준이 다르다. 테스트를
  문서와 같은 커밋에 넣으면 「문서가 맞나」와 「테스트가 맞나」를 한 diff에서
  동시에 판단해야 한다.

## Minimality decisions
- 공개 표면 문서는 `docs/compatibility.md` 하나만 새로 만들고, 이미 있는
  `cli.md`·`gates.md`·`workflow.md`·`configuration.md`는 링크로 참조한다. 같은
  표를 두 곳에 두면 다음 drift가 거기서 난다.
- 회귀 테스트는 Node 내장 test runner와 기존 `require` 표면만 쓴다. 마크다운
  파서나 스키마 라이브러리를 추가하지 않는다.
- 파일럿 매트릭스는 `docs/PILOT.md` 안의 표 하나로 두고 별도 데이터 파일이나
  기록 CLI를 만들지 않는다. 표를 읽는 쪽은 테스트뿐이다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 공개 표면과 하위 호환 정책 문서
* [Tasks 002](tasks/002/tasks.md) - 공개 계약 drift 회귀 테스트
* [Tasks 003](tasks/003/tasks.md) - 파일럿 매트릭스와 지원 선언 정합
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
