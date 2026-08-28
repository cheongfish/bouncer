---
type: bouncer.blueprint
title: 마스터 규칙과 Distill 압축
description: 런타임 안전 계약을 유지하며 마스터 규칙과 경로별 Distill 본문을 측정 예산 안으로 줄인다
resource: .bouncer/context/epics/058-context-runtime-compaction/blueprints/001-master-distill-compaction/index.md
tags:
  - bouncer
  - blueprint
  - distill
  - context
timestamp: '2026-08-28T13:44:23.892+09:00'
bouncer:
  id: '001'
  epic_id: '058'
  blueprint_id: '001'
  status: closed
  commit_type: refactor
  scale: full
  supersedes: []
---
# 001 마스터 규칙과 Distill 압축

Epic: [058](../../index.md)

## Intent
- 문제: `CLAUDE.md`와 Distill이 같은 절차를 반복하고, `plugin-skills`가 일반 플러그인 문서와 벤치마크 런북을 함께 라우팅해 경로 선택 뒤에도 불필요한 본문이 들어온다.
- 완료 조건: Epic 성공 기준 1–5를 만족하고 세 task가 각각 독립적으로 검증·커밋된다.

## Contract
- 인터페이스: 플러그인 마스터 규칙의 11개 hard rule과 Session conduct 의미는 유지한다. Project Distill은 기존 CLI와 인덱스 형식을 유지하고 `plugin-benchmark` 샤드 하나를 추가한다.
- 데이터·상태: 현재 8,765바이트 `CLAUDE.md`와 47,964바이트 Distill을 기준선으로 삼는다. 저장소 `distill.max_bytes`는 압축 완료 뒤 6,144로 바꾼다.
- 수용 기준: Epic 성공 기준 1–4의 바이트·라우팅·구조 조건을 자동 검사하고, 삭제한 문장이 현재 정본이나 테스트로 보존되는지 diff 리뷰에서 항목별로 판정한다.
- 검증 명령: `npm run ci`
- 실패 모드·엣지 케이스:
  - 하드룰을 링크만 남기고 지워 `test/master-rules.test.js`의 필수 계약이 사라지면 실패한다.
  - `skills/**`·`docs/**` 광역 패턴을 남긴 채 벤치마크 샤드를 추가해 두 샤드가 동시에 선택되면 실패한다.
  - `core`의 `always` 선택은 유지하되 미분류 경로를 `core`만 선택하는 매칭으로 위장하지 않는다.
  - `pulls`로 `always` 샤드를 중복 선택하거나 샤드 본문을 자동 절삭하지 않는다.
  - 설치 캐시와 과거 context 문서는 수정하지 않는다.

## Out of scope
- `scripts/src/lib/distill.ts`와 CLI 출력 형식, 스킬·agent 절차, 과거 benchmark 결과를 바꾸지 않는다.
- 압축 과정에서 제품 정책·게이트 번호·문서 상태 의미를 재설계하지 않는다.

## One-commit justification
- task 001은 항상 읽는 마스터 규칙, task 002는 기술 샤드 여섯 개, task 003은 플러그인 샤드 분리와 최종 예산 고정이다. 각 문서는 한 커밋으로 리뷰할 수 있고 앞 task의 압축 결과가 다음 task의 최종 예산 판정 입력이 된다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - 마스터 규칙 압축과 계약 테스트
* [Tasks 002](tasks/002/tasks.md) - core와 기술 샤드 압축
* [Tasks 003](tasks/003/tasks.md) - 플러그인·벤치마크 샤드 분리와 예산 고정
* [Verification 001](tasks/001/verification.md) · [002](tasks/002/verification.md) · [003](tasks/003/verification.md) - task별 검증 명령과 증적
* [Review 001](tasks/001/review.md) · [002](tasks/002/review.md) · [003](tasks/003/review.md) - task별 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
