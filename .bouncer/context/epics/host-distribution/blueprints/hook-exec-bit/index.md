---
type: bouncer.blueprint
title: 훅 실행 비트 의존 제거와 plan 버전 문서 보호
description: 훅 명령을 node 호출로 바꿔 설치 경로의 실행 비트 소실을 무해하게 하고, plan 단계가 버전 문서를 계획에 넣지 못하게 한다.
resource: .bouncer/context/epics/host-distribution/blueprints/hook-exec-bit/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-10-27T11:04:47.400+09:00'
bouncer:
  id: hook-exec-bit
  epic_id: host-distribution
  blueprint_id: hook-exec-bit
  status: closed
  order: 17
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: '훅 실행 비트 손실 수정과 plan 버전 문서 금지 지침: 호스트 배포 표면 소유'
  supersedes: []
---
# hook-exec-bit

Epic: [host-distribution](../../index.md)

## Intent
- 문제: 설치(복사) 경로가 훅 파일의 실행 비트를 잃으면 `hooks.json`이 셸로 직접 실행하는 훅이 `Permission denied`로 실패한다. `hooks/subagent-model.js`는 저장소에서부터 644라 실행 비트가 보존돼도 실패한다. 한편 plan 단계가 버전·CHANGELOG 문서를 계획에 넣는 것을 막는 지침이 없다.
- 완료 조건: 모든 훅 명령이 실행 비트 없이 동작하고, 이를 어기는 변경을 테스트가 막는다. plan 단계 규칙이 버전 관련 문서를 `affected_paths`·Touch·Checklist에서 금지한다.

## Contract
- 인터페이스: `hooks/hooks.json`의 세 명령이 `node "${CLAUDE_PLUGIN_ROOT}/hooks/<name>.js"` 형태가 된다. 경로를 따옴표로 감싸 공백이 있는 설치 경로에서도 한 인자로 전달된다. `hooks/cursor-hooks.json`의 한 명령은 cwd 상대 경로라 따옴표 없이 `node ./hooks/cursor-commit-safety.js`이며 `CLAUDE_PLUGIN_ROOT`를 이름으로 쓰지 않는다.
- 데이터·상태: `hooks/subagent-model.js`의 파일 모드가 755가 된다. `rules/planning.md`에 `## Release-time documents` 절이 생기고, 금지 대상 파일 목록은 `scripts/sync-versions.js`가 관리하는 버전 파일, 그 정본인 루트 `package.json`, `CHANGELOG.md`다.
- 수용 기준: epic Success criteria 14(훅 명령 형태와 회귀 테스트)와 15(plan 금지 지침)가 참이다. 이 blueprint는 `CHANGELOG.md`와 버전 파일을 바꾸지 않는다.
- 검증 명령: 각 task는 자기 테스트만, 종단 task는 `npm run ci`.
- 실패 모드·엣지 케이스: 명령이 `node`로 시작하지 않으면 해당 파일이 실행 비트를 가져야 한다는 규칙을 테스트가 검사한다. Windows는 파일 모드가 의미 없어 이 검사를 건너뛴다. 설치 경로에 공백이 있어도 따옴표 덕에 명령이 깨지지 않는다.

## Out of scope
- 플러그인·runtime 버전 올림, `CHANGELOG.md` 갱신(나머지 작업이 끝난 뒤 한꺼번에 작성한다).
- 어느 설치 단계(마켓플레이스 클론, release 브랜치 생성, 캐시 복사)가 모드를 잃는지에 대한 조사.
- `hooks/commit-safety.js`·`session-graph.js`·`cursor-commit-safety.js`의 로직 변경.
- plan gate에 새 검사 코드를 추가하는 일(이 blueprint는 규칙 문서만 쓴다).

## One-commit justification
- 두 구현 task 모두 "release 시점이 아닌 곳에서 배포 메타데이터를 실행 환경에 맡기지 않는다"는 한 계약을 지키며, 하나는 훅 명령이고 하나는 plan 규칙 문서라 서로 다른 경로를 만진다. 한 PR로 리뷰할 수 있는 크기다.
