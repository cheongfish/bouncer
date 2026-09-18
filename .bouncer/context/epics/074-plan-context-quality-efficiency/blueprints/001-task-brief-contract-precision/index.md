---
type: bouncer.blueprint
title: Task brief 계약 정밀화
description: Requires task briefs to name test seams, split throw from cache-miss handling, and state the expected red within the existing eight sections.
resource: .bouncer/context/epics/074-plan-context-quality-efficiency/blueprints/001-task-brief-contract-precision/index.md
tags:
  - bouncer
  - blueprint
  - spec-authoring
  - context-review
timestamp: '2026-09-18T10:49:10.893+09:00'
bouncer:
  id: '001'
  epic_id: '074'
  blueprint_id: '001'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# Task brief 계약 정밀화

Epic: [074](../../index.md)

## Intent
계획자가 테스트 seam, 입력 형태, 실패 분류, 기대 red를 기존 8개 brief 절 안에서 확정하도록 작성 규칙을 강화함.
context reviewer가 Checklist와 Interface의 불일치를 finding으로 보고하게 해 구현자가 설계를 대신 결정하지 않게 함.

## Contract
- 인터페이스:
  - `references/spec-authoring/index.md` tasks 항목의 Section-specific rules에 일곱 규칙을 추가한다: Interface 2개(test seam, throw/miss 분리), Current behavior 1개(I/O coupling `file:line`), Domain terms 1개(형태·예시), Checklist 3개(기대 red, staging 순서, focused 명령과 `bouncer.verify` 구분).
  - `references/spec-authoring/tasks.md` 예시는 새 규칙을 모두 만족하는 완성 예시가 된다.
  - `agents/bouncer-context-reviewer.md` `cross_document`는 범위를 한 task 안 Checklist–Interface 사이로 넓히고 seam 미정의와 throw/miss 혼합을, `success_criteria`는 범위를 task Checklist red 단계로 넓히고 기대 실패 누락을 finding 조건으로 둔다.
- 데이터·상태: frontmatter·gate·CLI 변경 없음. TASKS-002가 worktree agent 문서를 `mdToCodexToml()`로 변환해 `.codex/agents/bouncer-context-reviewer.toml`을 다시 쓴다.
- 수용 기준: epic 성공 기준 1~4, 9.
- 검증 명령: `npm test` (전역 `config.verify`).
- 실패 모드·엣지 케이스:
  - 새 규칙은 8개 절 이름과 light 3개 절(Goal & intent, Touch, Checklist)을 바꾸지 않는다. light task에는 Interface가 없으므로 seam·throw/miss 규칙은 full 전환 신호(public interface, error contract)로 처리한다.
  - 호출 횟수·I/O를 검사하지 않는 task에는 seam 규칙을 적용하지 않는다. 규칙은 조건부이며 모든 Interface에 injection을 요구하지 않는다.
  - agent 문서만 바뀌고 TOML이 갱신되지 않으면 `test/agents.test.js`의 byte 비교가 실패한다.
  - 키워드 탐지 gate를 추가하지 않는다. 판정은 context review가 한다.

## Out of scope
- plan gate(G/S 코드)와 `scripts/**` 변경
- `skills/bouncer-plan/**`, `references/context-review/index.md`의 dispatch 절차 변경(후속 BP 003)
- implementer·coordinator·execute dispatch 변경(후속 BP 002)

## One-commit justification
- 작성 규칙과 그 규칙을 판정하는 reviewer rubric은 같은 계약의 두 면이라 한 리뷰에서 대조해야 한다. 변경은 문서 세 개와 계약 테스트 두 개, 생성 TOML 하나에 그친다.

## Documents
* [Tasks 001](tasks/001/tasks.md) - spec-authoring 규칙과 예시
* [Tasks 002](tasks/002/tasks.md) - context reviewer rubric과 Codex TOML
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
