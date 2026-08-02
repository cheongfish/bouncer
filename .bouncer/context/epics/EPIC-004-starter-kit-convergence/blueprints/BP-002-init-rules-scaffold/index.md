---
type: bouncer.blueprint
title: BP-002 init-rules-scaffold
description: Blueprint BP-002
resource: .bouncer/context/epics/EPIC-004-starter-kit-convergence/blueprints/BP-002-init-rules-scaffold/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-02T23:44:42.305Z'
bouncer:
  id: BP-002
  epic_id: EPIC-004
  blueprint_id: BP-002
  status: draft
---
# BP-002 init-rules-scaffold

Epic: [EPIC-004](../../index.md)

## Intent
- 문제: `bouncer init`은 `.bouncer/` 안쪽(config, governance, workflow, okf, 템플릿,
  컨텍스트 루트)만 만든다. 게이트가 판정하는 것은 문서의 상태와 섹션이고, 그 사이 구간 —
  출력 형식, 스코프 밖 편집, 지식 경계, 태스크 관리 습관 — 은 강제도 안내도 없다. 에이전트가
  세션마다 읽을 규칙 표면이 프로젝트에 아예 존재하지 않는다. starter-kit은 같은 공백을
  `.agents/rules/` 네 종(output-control, task_management, safety, knowledge-boundary)으로
  메워 왔다.
- 완료 조건: `init`이 규칙 파일을 함께 스캐폴딩하고, 그 목록이 `created`에 보고된다. 기존
  파일은 어떤 경우에도 덮어쓰지 않는다. `npm test` 통과.

## Contract
<!-- 계약만. 구현 코드 금지 — 시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다. -->
- 인터페이스 (`init` 산출물 확대): `scripts/lib/init.js`가 규칙 파일을 `.bouncer/` 하위에
  쓰고 반환값 `created`에 포함한다. 규칙 내용은 기존 `GOVERNANCE`·`WORKFLOW`·`OKF`와 같이
  모듈 내 문자열 상수로 둔다 — 런타임 의존성을 늘리지 않는다는 배포 제약 때문이다.
- 인터페이스 (safe bootstrap 불변식 유지): `init`은 자기가 만들지 않은 파일을 수정하지
  않는다. 이미 존재하는 규칙 파일은 건드리지 않고, 저장소 루트의 에이전트 규약 파일
  (`AGENTS.md` 등)이 이미 있으면 병합하지 않는다. 손댈 수 없는 것은
  `gitignoreSuggestions`와 같은 방식으로 **보고만** 한다.
- 인터페이스 (부트스트랩 판정 불변): `inspectBootstrap`의 `missing`/`partial`/`ready`
  판정 기준은 그대로 `config.json`이다. 규칙 파일의 존재 여부를 초기화 완료 조건에 넣지
  않는다 — 기존 프로젝트가 갑자기 `partial`로 떨어지면 안 된다.
- 데이터·상태: 게이트 판정과 `config.json` 스키마 불변. 규칙은 문서일 뿐 게이트 입력이
  아니다.

## Out of scope
- 규칙 위반의 런타임 강제. 훅 추가나 `hooks/` 배선 변경은 하지 않는다. 이 blueprint의
  산출물은 에이전트가 읽는 문서다.
- `.agents/` 디렉터리 체계 도입. starter-kit의 설치 경로를 그대로 따르지 않고 `.bouncer/`
  하위에 둔다.
- 저장소 루트 `AGENTS.md` 자동 생성·병합.
- `init`의 멱등성·안전성 정책 변경. `partial` 상태에서 계속 진행하게 만드는 등의 완화는
  하지 않는다.
- 규칙 본문을 starter-kit에서 그대로 복사하는 것. `.sdd/`·`govern` CLI·Bun 전제가 섞여
  있으므로 Bouncer 어휘로 다시 쓴다.

## One-commit justification
<!-- .bouncer/governance.md: blueprint는 한 번에 리뷰 가능한 커밋 하나에 맞춘다.
     이 칸을 못 채우겠으면 blueprint를 쪼갤 신호입니다. -->
- 변경의 실체는 `init.js`에 문자열 상수와 `writeFile` 호출을 더하는 것 하나다. 기존
  `GOVERNANCE`·`WORKFLOW`·`OKF`가 이미 같은 형태로 있어 패턴이 반복된다.
- 쪼갤 수 없다. 규칙 파일을 추가하면서 `init.test.js`의 산출물 목록 어서션을 같이
  갱신하지 않으면 테스트가 깨진 중간 커밋이 남는다.
- 게이트와 훅을 건드리지 않으므로 회귀 범위는 `init` 산출물로 한정된다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Distill](distill.md) - 배운 것
