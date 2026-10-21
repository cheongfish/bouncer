---
type: bouncer.blueprint
title: 서브명령 help 안전화와 소스·테스트 중복 정리
description: Make subcommand --help print static usage without running the command, unify duplicated test fixtures, task-unit types and path normalization, and close the prior source-boundary measurement.
resource: .bouncer/context/epics/runtime-architecture/blueprints/cli-help-and-hygiene/index.md
tags:
  - bouncer
  - blueprint
  - cli
  - help
  - hygiene
  - measurement
timestamp: '2026-10-21T11:27:30.055+09:00'
bouncer:
  id: cli-help-and-hygiene
  epic_id: runtime-architecture
  blueprint_id: cli-help-and-hygiene
  status: closed
  order: 37
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  attribution: CLI 서브명령 help 경계와 소스·테스트 위생은 runtime-architecture의 모듈 책임·위생 범위임
  supersedes: []
---
# 서브명령 help 안전화와 소스·테스트 중복 정리

Epic: [runtime-architecture](../../index.md)

## Intent
- 문제: 서브명령 `--help`가 일부 명령(`init`·`graph-sync`·`current`·`import`)을 실제로 실행하거나 exit 2 오류로 끝나고, 테스트 fence helper·help 판정·tasks 문서 타입·경로 정규화가 여러 벌로 갈라져 있고, 폐기한 이름 검사가 레거시 감지기를 고정 소스 경로로 허용하며, 이전 재구성 inventory의 "후" 열이 `미측정`이다.
- 완료 조건: 자체 help가 없는 모든 서브명령의 `--help`가 handler 없이 정적 usage로 exit 0이 되고, 네 중복이 정본 하나로 모이고, 레거시 감지기 허용이 파일 안 표식으로 바뀌고, inventory "후" 열이 `check-report`를 통과하는 실측값으로 채워진다.

## Contract
- 인터페이스: `bouncer <cmd> --help|-h`는 `coordinate`·`review-dispatch`·`review`·`context-review`·`dispatch`·`config`·`epic`을 뺀 모든 등록 명령에서 `COMMAND_USAGE[cmd]`를 stdout에 쓰고 exit 0이다. help 판정은 기존 handler 5곳의 raw-token 규칙(`--help`는 위치 무관, `-h`는 바로 앞 토큰이 `--`로 시작하면 값)을 `cli-flags`의 공용 함수 하나로 쓴다. 최상위 `help`·`--help`·`-h`와 unknown-command 출력은 그대로다.
- 데이터·상태: 경로 겹침·scope 비교용 정규화는 `path-overlap`의 함수 하나(역슬래시→`/`, 선행 `./` 반복 제거, 단독 `/`가 아닌 말미 `/` 제거)로 통일한다. tasks 문서 `TaskUnit` 타입 정본은 `validate-docs`에 두고 나머지는 type-only로 파생한다. 폐기한 이름 검사는 `// public-name: legacy-input-detector` 표식이 있는 추적 파일 `scripts/src/lib/*.ts`만 허용한다. 디스크 형식과 CLI JSON은 바뀌지 않는다.
- 수용 기준: epic 성공 기준 3, 4, 6, 7, 8, 9.
- 검증 명령: 각 commit task의 `bouncer.verify`와 terminal task의 `npm run ci`.
- 실패 모드·엣지 케이스:
  - `--summary -h`·`--message -h`처럼 `-h`가 플래그 값이면 help가 아니라 원래 명령으로 간다.
  - `migrate context-slugs --yes --help`처럼 쓰기 플래그와 help가 함께 오면 help가 이기고 아무것도 쓰지 않는다.
  - `config`는 정확히 토큰 하나(`--help`/`-h`)일 때만 help라는 기존 규칙을 유지한다.
  - 경로 정규화 통일로 `././a`, `a\b`, `./` 입력의 판정이 바뀔 수 있다. `./`는 계속 supplement 경로로 거절한다.
  - Node 24가 없거나 스냅샷 명령이 실패하면 inventory를 손으로 채우지 않고 task를 실패로 보고한다.

## Out of scope
- 자체 상세 help가 있는 7개 명령의 help 문구·판정 변경
- `coordinator` facade 축소와 `coordinate()` 분해 (`coordinator-command-split`)
- `validate-gates`·`context-review-state` 분해 (`gate-review-split`)
- `scripts/measure-source-boundaries.js` 소스 수정
- 사용자 명령 이름·JSON 출력·실패 코드 변경

## One-commit justification
- 다섯 commit task는 help 경로·중복 정본·레거시 이름 허용·실측이라는 서로 다른 결함을 하나씩 닫고 terminal 검증 하나로 함께 증명한다. 모두 동작 보존형 정리이거나 help 경로 하나의 안전화라 한 PR로 검토할 수 있다.
