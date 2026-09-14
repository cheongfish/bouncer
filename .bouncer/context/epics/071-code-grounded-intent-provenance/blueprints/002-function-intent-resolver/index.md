---
type: bouncer.blueprint
title: 함수 의도 provenance 해석기
description: Resolves current TypeScript and JavaScript function definitions to bounded task intent through Git provenance.
resource: .bouncer/context/epics/071-code-grounded-intent-provenance/blueprints/002-function-intent-resolver/index.md
tags:
  - bouncer
  - blueprint
  - symbol-resolution
  - git-provenance
  - intent
timestamp: '2026-09-14T13:16:29.576+09:00'
bouncer:
  id: '002'
  epic_id: '071'
  blueprint_id: '002'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 함수 의도 provenance 해석기

Epic: [071](../../index.md)

## Intent

현재 함수 정의에서 그 코드를 만든 Git commit과 승인된 Task·Explain 의도를 역추적할 수 있게 함. 모호하거나 연결되지 않은 입력도 추측하지 않고 제한된 JSON 상태로 반환함.

## Contract

- 인터페이스: `bouncer intent --symbol <function-name> [--candidate <qualified-ref>] [--limit <1..5>] [--repo <dir>]`를 제공한다. `qualified-ref`는 resolver가 발급한 opaque 값이고 기본 `limit`은 3이며, command는 저장소와 context 문서를 수정하지 않는다.
- 데이터·상태: 결과는 `resolved`, `ambiguous`, `unresolved`, `unlinked` 중 하나와 `symbol_ref`, provenance candidate, `truncated`를 JSON으로 반환한다. `symbol_ref`는 현재 checkout의 path, qualified name, kind, line range, blob SHA를 담는다.
- 선택 규칙: 고유한 source 정의를 선택한다. 같은 TypeScript source의 생성 CJS는 `generated`로 분류하고, 서로 다른 source 정의가 둘 이상이면 opaque candidate를 반환해 호출자가 다시 선택하게 한다.
- provenance 규칙: 현재 함수 범위의 `git blame`과 파일의 `git log --follow`에서 commit을 모은다. `Bouncer-Task` trailer를 우선 사용하고, 없으면 Explain `task_commits[].sha`를 역색인한다. stable Task ID를 주 식별자로 유지하고 현재 8자리 및 legacy SHA를 Git 객체로 해석한다.
- 입력 예산: 기본 candidate는 최대 3개, 명시한 `--limit`은 최대 5개다. candidate별로 `Background`와 해당 Task의 설계 절만 선택하고 verification, review, Quiz, Checklist는 제외한다. 선택 본문을 UTF-8로 직렬화했을 때 합계 2,000 byte를 넘기기 전에 자르고 `truncated: true`를 반환한다.
- 수용 기준: Epic success criteria 8–14를 만족하고 `npm run ci`가 통과한다.
- 검증 명령: 각 Task의 집중 테스트와 Blueprint 완료 전 `npm run ci`를 실행한다.
- 실패 모드·엣지 케이스: 동명 source 정의는 `ambiguous`, generated-only·삭제된 현재 정의·지원하지 않는 구문은 `unresolved`, commit과 Task·Explain 쌍을 연결하지 못하면 `unlinked`로 반환한다. 짧은 SHA 충돌과 현재 후보 집합에 없는 `qualified-ref`는 입력을 거절한다. rename은 `git log --follow`로 추적하고 Git 실행 실패는 runtime 오류로 구분한다. 문자열 출현을 함수 정의로 추측하지 않으며 `historical` 본문은 기본 payload에서 제외한다.

## Out of scope

- `/bouncer-plan`이 resolver를 호출하도록 바꾸는 BP003 작업
- context graph와 `context-search`를 제거하는 BP004 작업
- 기존 commit과 Explain의 일괄 변환 또는 8자리 SHA 계약 변경
- TypeScript·JavaScript 이외 언어와 익명 callback, 계산된 property, runtime 생성 함수
- Explain 내용과 현재 코드 의미의 자동 일치 판정

## One-commit justification

- Blueprint는 하나의 공개 resolver 계약을 PR 단위로 묶되, 구현은 함수 정의 색인, Git provenance 해석, CLI 통합의 세 reviewable commit으로 나눈다. 각 Task는 직전 Task의 내부 계약을 소비하므로 순차 DAG로 실행한다.

## Documents
* [Task 001](tasks/001/tasks.md) - TypeScript·JavaScript 함수 정의 색인
* [Task 002](tasks/002/tasks.md) - Git commit과 Explain provenance 해석
* [Task 003](tasks/003/tasks.md) - `bouncer intent` CLI와 공개 문서 통합
* [Context review](context-review.md) - 계획 문서 정합성 판정
