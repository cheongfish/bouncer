---
type: bouncer.blueprint
title: 리뷰 이월 항목의 테스트와 계획 인계 보강
description: This blueprint closes confirmed retro review gaps in tests, salvage guidance and plan handoff.
resource: .bouncer/context/epics/plan-workflow/blueprints/retro-review-followups/index.md
tags:
  - bouncer
  - blueprint
  - review
  - regression
  - plan-workflow
timestamp: '2026-10-28T16:54:08.667+09:00'
bouncer:
  id: retro-review-followups
  epic_id: plan-workflow
  blueprint_id: retro-review-followups
  status: closed
  order: 38
  commit_type: fix
  scale: full
  review_scope: blueprint
  verification_policy: scoped_terminal
  review_contract: brief
  attribution: 'RETRO의 #287 계획 승인·리뷰 인계 절차 보강을 중심으로 테스트와 salvage 잔여 검증을 함께 정리한다.'
  supersedes: []
---
# 리뷰 이월 항목의 테스트와 계획 인계 보강

Epic: [plan-workflow](../../index.md)

## Intent
이월된 리뷰 항목의 오류 단언·실패 경로 검증과 사용자에게 보여 줄 계획 판정 근거를 보강함.
RETRO의 확인 가능한 잔여 항목을 한 BP에서 정리하고 task별 검증과 종단 CI로 회귀를 확인함.

## Contract
- 인터페이스: 공개 CLI·JSON·모델 해석·운영 timeout은 변경하지 않는다. 테스트는 기존 오류·fallback·보존 계약을 검증하고 계획 문서는 사용자 확인 전에 보여 줄 판정 근거와 읽기 출처를 명시한다.
- 데이터·상태: 사용자가 확인한 task별 변경 경로를 `affected_paths`에 기록한다. 기존 closed BP와 runtime 원장 형식은 변경하지 않는다.
- 수용 기준: epic Success criteria 24–29를 충족한다. S30 단언, 두 timeout 분기, 예시 경로 예외의 범위, salvage write·rename 실패와 plan 인계·status 거절을 각각 task 브리프로 검증한다.
- 검증 명령: 구현 task는 각자 변경하는 테스트에 정적 검사 래퍼를 적용한다. 모든 구현 task가 integrated된 뒤 마지막 verification task에서 `npm run ci`를 한 번 실행한다. 명령은 `plan.verify_command`에서 사용자 확인을 받았으며 task frontmatter에 기록한다.
- 실패 모드·엣지 케이스: 기본 모델 조회 timeout은 exit 2와 복구 안내를 내고 strong 조회 timeout은 slot 모델로 돌아가 exit 0을 유지한다. 두 호출 모두 20000ms를 사용한다. report 보존 실패는 이미 생성한 patch만 partial salvage로 돌려주고 원본 report·worker·branch·원장과 임시 파일 정리 규칙을 보존한다. 보존본 Red run의 `미제공`은 Red 증거 부재로 취급한다. 잘못된 ID·없는 ID는 각각 기존 reason과 반환값 1을 유지한다.
- 승인 경계: root는 close 동의 전에 finding ID·처분·note와 accepted-risk 대상·위험·수용 근거를 표시한다. 최종 경로 표시는 각 task frontmatter를 직접 읽는다. 사용자의 명시적 동의와 plan 승인·gate의 소유권은 유지한다.
- fixture 경계: fixture 생성에서 `git init` spawn만 제거한다. 실제 CLI 실행과 `runtimePaths`의 Git 조회는 integration 테스트에 남긴다.

## Task DAG
| task | 변경 단위 | depends_on | parallel_safe | execution_kind |
| --- | --- | --- | --- | --- |
| TASKS-001 | 리뷰 오류·timeout·예시 경로 검사 | `[]` | `true` | `commit` |
| TASKS-002 | salvage 문서·실패 테스트 | `[]` | `true` | `commit` |
| TASKS-003 | 계획 리뷰 판정 표시·인계 규칙 | `[]` | `true` | `commit` |
| TASKS-004 | ledger fixture·status 단언 | `[]` | `true` | `commit` |
| TASKS-005 | 전체 CI | `001,002,003,004` | `false` | `verification` |

모든 edge의 `dependency_gate`는 `integrated`다. 구현 task의 후보 경로는 서로 겹치지 않으며 전역 테스트 tier와 runtime 구현을 바꾸지 않는다.

## Out of scope
- HANDOFF·HOOK 출처의 측정·릴리스·설치 검증과 훅 실행 비트 작업.
- RETRO의 이미 해결된 작업 1·2·3-1·3-4 및 조치하지 않는 관찰·범위 밖·제외 항목.
- report 임시 파일 이름이나 동시성 정책 변경. 사용자는 1A로 기존 `<destination>.tmp-<pid>`를 유지했다.
- #287의 상세 원문이 없는 문서 완결성·문장 순서 advisory. 사용자는 2A로 보류했다.
- 공개 runtime API·원장/오류 shape·gate·모델 설정·운영 timeout 변경, 테스트 전체의 unit 전환.
- 버전 파일·CHANGELOG, 루트 RETRO 및 다른 로컬 제안 문서의 변경·stage·commit.

## Overlap
- #285·#287 후속으로 현재 동작과 문서의 빈틈만 닫는다. 기존 closed BP는 다시 열지 않는다.
- #288·#289·#290·#291에서 처리한 gate·inherit·worker 커밋·진행 판별을 다시 구현하지 않는다.
- `codex-agents check`의 설치 캐시 차이는 저장소 기준 `in_sync: true`로 확인했으므로 별도 task를 만들지 않는다.

## One-commit justification
한 PR의 완료 조건은 이월 리뷰 항목의 검증과 인계 계약 정리다. 각 구현 task는 독립적으로 검토할 수 있는 커밋 한 개이며, task 간 경로 공유 없이 병렬로 진행한 뒤 전체 CI로 합친다.
