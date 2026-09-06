---
type: bouncer.blueprint
title: 워크플로 출력과 구현 프롬프트 경량화
description: Consolidates workflow output rendering and implementer prompt ownership without weakening gates or fallback safety.
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/010-workflow-output-and-implementer-payload/index.md
tags:
  - bouncer
  - blueprint
  - workflow-output
  - implementer-prompt
  - skill-contract
timestamp: '2026-09-05T22:05:25.528+09:00'
bouncer:
  id: '010'
  epic_id: '043'
  blueprint_id: '010'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 010 워크플로 출력과 구현 프롬프트 경량화

Epic: [043](../../index.md)

## Intent

여섯 워크플로의 사용자 출력과 구현 담당자 입력에서 중복 계약을 걷어내고, 실패 진단·승인·대체 경로의 안전성을 유지함.

## Contract

- 인터페이스:
  - `rules/output.md`가 `compact` 기본 모드와 요청 기반 `debug` 모드의 공통 표시 계약을 소유한다.
  - named implementer payload는 실행 cwd와 현재 task의 여섯 authority 절만 필수 입력으로 삼는다. generic subagent와 inline fallback은 역할 지시를 계속 받는다.
  - `/bouncer-commit`은 commit gate를 한 번만 판정하고, 통과할 수 없는 사후 status 보정 단계를 두지 않는다.
  - plan-time context 검색은 스캐폴드 전에 중복·과거 제약을 찾는다. 현재 알고리즘의 context 기여와 draft self-hit는 source·test 기준선과 분리해 측정한다.
- 데이터·상태: OKF frontmatter, gate 상태, CLI JSON 스키마, `affected_paths` 승인권은 바꾸지 않는다. 출력 모드는 세션 표시 정책이며 `.bouncer/config.json`에 새 키를 추가하지 않는다.
- 수용 기준:
  1. 여섯 워크플로가 공통 출력 계약을 읽고, 성공·실패·ACQ 표시 테스트가 통과한다.
  2. named payload에서 역할 TOML과 중복되는 authority·tests-first·comments·output contract 및 prior commit subjects가 빠진다.
  3. 생성 TOML이 역할 Markdown과 일치하지 않으면 payload 축소를 허용하지 않는 계약이 테스트된다.
  4. generic/inline fallback은 authority, hard guards, tests-first, comments, output contract를 유지한다.
  5. commit gate 중복 실행과 도달 불가능한 status 변경 지시가 사라진다.
  6. context 포함/제외 비교가 추가 발견 경로, top-k recall, 오추천, draft self-hit 비율을 분리해 기록하고 후속 알고리즘 변경 여부를 판단할 근거를 남긴다.
  7. 스킬 테스트는 문장·단계 수보다 명령 순서, 승인 선행, 안전 불변조건을 판정한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - named agent가 없거나 light inline 경로인데 축약 payload를 쓰면 구현자가 역할 가드를 받지 못한다. 이 경로는 full fallback payload로 고정한다.
  - `# bouncer-generated` 표식이 없는 사용자 소유 TOML은 자동 동기화 대상으로 취급하지 않는다.
  - compact 출력도 ACQ, 권한 요청, gate 실패, scope violation과 복구 행동은 숨기지 않는다.
  - 기존 draft가 남은 재진입 계획에서는 새 sync로 그 draft를 다시 색인하지 않고, 이미 색인된 self-hit가 있으면 측정 결과에 드러낸다.
  - 스킬 문장을 reference로 옮겨도 단계의 입력·출력·중단 조건과 CLI 호출 순서는 남긴다.

## Out of scope

- 완료된 Blueprint 005–008의 역할 rubric 정본화, 조건부 reference 분리, 공통 규칙화, description 예산 작업을 다시 하지 않는다.
- gate 의미, CLI 결과 스키마, `affected_paths` 승인 흐름, reviewer/debugger 책임을 바꾸지 않는다.
- Graphify 점수 알고리즘을 재설계하거나 새 런타임 의존성을 추가하지 않는다.
- 출력 모드를 영구 프로젝트 설정으로 만들거나 과거 컨텍스트 문서를 소급 수정하지 않는다.

## One-commit justification

- 공통 출력, implementer payload, commit 흐름, context 검색, 잔여 스킬 축약을 각각 한 task bundle로 나눈다. 각 커밋은 자신의 계약과 회귀 테스트를 함께 닫으며, Blueprint 전체는 워크플로 비용을 줄이는 하나의 PR 단위다.

## Documents

* [Tasks 001](tasks/001/tasks.md) - 공통 출력 계약과 여섯 워크플로 적용
* [Verification 001](tasks/001/verification.md) - 검증 명령과 증적
* [Review 001](tasks/001/review.md) - 리뷰 발견사항
* [Tasks 002](tasks/002/tasks.md) - named implementer payload와 fallback 분리
* [Verification 002](tasks/002/verification.md) - 검증 명령과 증적
* [Review 002](tasks/002/review.md) - 리뷰 발견사항
* [Tasks 003](tasks/003/tasks.md) - commit gate 단일화
* [Verification 003](tasks/003/verification.md) - 검증 명령과 증적
* [Review 003](tasks/003/review.md) - 리뷰 발견사항
* [Tasks 004](tasks/004/tasks.md) - plan-time context 검색과 기여 측정
* [Verification 004](tasks/004/verification.md) - 검증 명령과 증적
* [Review 004](tasks/004/review.md) - 리뷰 발견사항
* [Tasks 005](tasks/005/tasks.md) - 잔여 스킬 중복과 산문 테스트 정리
* [Verification 005](tasks/005/verification.md) - 검증 명령과 증적
* [Review 005](tasks/005/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
