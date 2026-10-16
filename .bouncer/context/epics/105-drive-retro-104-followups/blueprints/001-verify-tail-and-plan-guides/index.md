---
type: bouncer.blueprint
title: verify 실패 출력 tail과 계획 안내 보강
description: Add verify output tail to finalize failures, reject non-ASCII new epic descriptions, and document discovery and review guides
resource: .bouncer/context/epics/105-drive-retro-104-followups/blueprints/001-verify-tail-and-plan-guides/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - scaffold
  - graphify
  - context-review
timestamp: '2026-10-16T12:58:51.276+09:00'
bouncer:
  id: '001'
  epic_id: '105'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  review_scope: blueprint
  supersedes: []
---
# verify 실패 출력 tail과 계획 안내 보강

Epic: [105](../../index.md)

## Intent
- 문제: `finalize --yes`의 verify 실패 payload에 원인 출력이 없고, 새 epic의 비-ASCII description은 scaffold 뒤에야 드러나며, 그래프 후보 확인 순서와 구조 변경의 restart 효과는 문서에 없다.
- 완료 조건: verify 실패 payload가 출력 tail을 싣고, scaffold가 새 epic의 비-ASCII description을 거부하며, 두 절차가 소유 문서에 적힌다.

## Contract
- 인터페이스:
  - `bouncer finalize --yes` verify 실패 응답: `{ ok: false, reason: 'verify', code: 'VERIFY_FAILED', command, exitCode, output_tail, integration, branch }`. `output_tail`은 `executeVerify`가 돌려준 출력(최대 100줄) 문자열이다.
  - `bouncer scaffold epic --description <text>`: 새 epic에서 `<text>`에 0x20–0x7E 밖의 문자가 있으면 exit 2와 stderr `scaffold: epic description must be printable ASCII ...`로 거부한다.
- 데이터·상태: 저장 형식 변경은 없다. verify 설정 오류(`command: null`)와 의존성 설치 실패 응답에는 `output_tail`을 넣지 않는다.
- 수용 기준: 에픽 성공 기준 1~6. TASKS-001이 1·2와 6의 finalize 부분, TASKS-002가 3·4와 6의 scaffold 테스트 부분, TASKS-003이 5를 맡는다. SKILL.md 2단계 문장은 TASKS-002가 맡는다. `rules/cli.md`는 TASKS-001만 고치며 finalize 문단과 `scaffold epic` 줄의 description 규칙을 함께 갱신한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - verify가 실행되지 못한 경우(허용 목록 밖 명령, 설정 파손)에도 `executeVerify`는 오류 문구를 `output`으로 주므로 `output_tail`은 그 문자열이다.
  - 출력이 비면 `output_tail`은 빈 문자열이다.
  - description 검사는 trim 전 원문을 본다. 탭·줄바꿈·NBSP·em dash·한글은 모두 거부한다.
  - 기존 epic 재실행은 넘긴 description을 검사하지 않는다.
  - 문서 문단은 `check-doc-shape`의 단계 번호·ACQ 위치 계약과 `skill-context-review.test.js`의 fingerprint 예시 줄을 바꾸지 않는다.

## Out of scope
- verify 자동 재시도, 일시적 실패 판정.
- 기존 epic description 소급 검사, blueprint·task description 검사.
- 그래프 질의의 필수화와 측정.

## One-commit justification
- 네 변경은 한 회고의 후보이고 각각 작은 검사·필드·문단이다. task 3개가 서로 다른 파일을 고쳐 한 PR에서 병렬로 검토할 수 있다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
