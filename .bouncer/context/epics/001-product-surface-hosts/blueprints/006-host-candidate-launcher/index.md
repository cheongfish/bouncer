---
type: bouncer.blueprint
title: 호스트 후보 플러그인 루트 launcher
description: 호스트별 설치 후보를 선택해 Bouncer 워크플로에 플러그인 루트를 제공한다
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/006-host-candidate-launcher/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-24T15:31:47.607+09:00'
bouncer:
  id: '006'
  epic_id: '001'
  blueprint_id: '006'
  status: closed
  commit_type: feat
  scale: full
---
# 006 host-candidate-launcher

Epic: [001](../../index.md)

## Intent
- 문제: 현재 `BOUNCER_ROOT` 해석식은 이미 주입된 환경변수만 읽는다. Cursor와
  Antigravity에서는 그 값이 없고, 플러그인 안의 스크립트도 자신을 실행할 절대 경로를
  최초에 알 수 없다.
- 완료 조건: 한 번 PATH에 설치한 launcher가 명시 override 또는 검증된 호스트 후보를
  선택하고, 모든 워크플로 스킬이 그 결과로만 `scripts/bouncer`를 실행한다.

## Contract
<!-- Contract-First: 계약만. 구현 코드 금지.
     시그니처·타입·의사코드는 블록당 20줄 이하.
     길어지면 구현 상세가 새는 신호이니 tasks.md로 넘기거나 blueprint를 쪼갭니다.
     금지: 계약 클래스·메서드 본문, As-Is/To-Be 코드 덤프, 단계별 구현 시퀀스,
     실행 가능한 테스트 본문 → tasks.md로 이연.
     본문 분량 예산 ~250줄. 초과는 구현 상세 누출 신호 — 쪼개거나 이연. -->
- 인터페이스:
  - PATH 명령 `bouncer-root` — 후보를 검사해 표준 출력으로 선택한 절대 플러그인
    루트 하나만 출력한다. 기본은 최고 semver 자동 선택이며, `--select`는 TTY에서
    번호 목록을 보여 선택을 받는다.
  - `--host codex|claude|antigravity`는 후보 호스트를 좁히고, `--auto`는 명시적으로
    자동 정책을 요청한다. `BOUNCER_HOME`은 플래그보다 먼저 유효성 검사를 거친 수동
    override다.
  - 워크플로 스킬은 `bouncer-root` 실패를 삼키거나 cwd·프로세스명으로 대체하지 않고,
    표준 오류를 그대로 사용자에게 알린다.
- 데이터·상태: 후보 목록은 실행 시 알려진 호스트별 캐시·설치 위치에서만 만들며
  영구 설정 파일을 쓰지 않는다. provider 선택은 기존 `.bouncer/config.json` pin과
  `CLAUDE_PLUGIN_ROOT` / `PLUGIN_ROOT` 규칙을 그대로 유지한다.
- 수용 기준: epic 성공 조건 1–5. `npm test`가 launcher의 우선순위·정렬·대화형
  거부·호스트 경계와 모든 스킬의 새 호출 표면을 검증한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 후보의 manifest 이름·버전 또는 `scripts/bouncer`가 없으면 후보에서 제외하고
    이유를 진단에 남긴다.
  - semver가 아닌 버전은 자동 정렬 대상에서 제외한다. 같은 유효 버전은 절대 경로
    사전순으로 고정해 재현성을 유지한다.
  - `--select`에 TTY가 없으면 입력을 기다리지 않고 `--auto` 또는 `BOUNCER_HOME`을
    쓰라는 오류로 종료한다.
  - `BOUNCER_HOME`이 가리키는 곳이 유효하지 않으면 다른 후보로 조용히 대체하지 않고
    그 override를 고치도록 실패한다.
  - 여러 호스트가 설치돼도 provider를 추정하지 않는다. 후보 선택과 provider pin은
    별개의 책임이다.

## Out of scope
- SessionStart 훅이 Agent Shell 환경을 바꾸게 하는 구현.
- `subagents.provider`의 자동 감지·기본값 변경.
- 알려진 호스트 위치 밖의 넓은 홈 디렉터리 탐색 또는 실행 프로세스 조상 이름 기반
  경로 추측.
- 설치된 플러그인 캐시를 수정하거나 사용자 셸 프로필에 `BOUNCER_HOME`을 기록하는 일.

## One-commit justification
- 후보 선택 라이브러리·실행 표면과 그 테스트는 하나의 동작 단위이고, 그 다음
  워크플로·문서 이관은 이미 검증된 launcher를 소비하는 별도 커밋이다. 두 task를
  나누면 각 커밋이 `npm test`를 통과하며, PR에서는 하나의 사용자 흐름으로 검토된다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 후보 탐색 launcher와 단위 테스트
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - 워크플로·규칙·설치 문서 이관
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
