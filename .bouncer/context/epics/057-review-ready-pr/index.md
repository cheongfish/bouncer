---
type: bouncer.epic
title: 리뷰 흐름 중심 PR 본문
description: Explain과 검증 증적을 조합해 변경 의도부터 확인 방법까지 이어지는 PR 본문 계약을 정의한다
resource: .bouncer/context/epics/057-review-ready-pr/index.md
tags:
  - bouncer
  - epic
  - finalize
  - pull-request
timestamp: '2026-08-28T13:06:04.904+09:00'
bouncer:
  id: '057'
  epic_id: '057'
  status: approved
  supersedes: []
---
# 057 리뷰 흐름 중심 PR 본문

## Intent
- 문제: 현재 PR 본문은 Features/Fixes 구분과 Bouncer 메타를 앞세워 변경 이유,
  구현 흐름, 리뷰 지점, 검증 근거를 한 순서로 읽기 어렵다.
- 목표: `/bouncer-finalize`와 수동 PR/MR 템플릿이 Explain과 검증 증적을
  재사용해 변경 의도부터 확인 방법까지 이어지는 본문을 제공한다.

## Success criteria
1. finalize가 만드는 PR 제목은 `[YYMMDD] (→ MergeTarget) [Type/Type] 요약`
   형식을 유지한다.
2. 생성된 PR 본문은 `관련 이슈` → `배경 · 변경 의도` → `주요 변경 내용` →
   선택적 `로직 흐름` → `리뷰 포인트` → `확인 방법` 순서다.
3. `Background`·`Intuition`·`Code`, diff, blueprint/task/review 문서, 검증
   증적의 용도가 섹션별로 정해져 있으며 근거 없는 내용을 만들지 않는다.
4. 호출 순서·제어 흐름·상태 전이·데이터 단계·컴포넌트 책임이 달라질 때만
   Mermaid를 만들고, 해당하지 않으면 `로직 흐름` 제목도 없다.
5. PR 본문에 Epic/Blueprint ID, `## 🚦 Bouncer`, Features/Fixes 체크박스,
   Quiz, 이해 상태, comprehension 점수가 없다.
6. Explain은 실제로 열리는 링크로 남고, 관련 이슈가 없으면 이슈 항목을
   만들지 않는다. 수동 비-Bouncer PR/MR은 Explain 항목을 제거할 수 있다.
7. `gh pr create`는 라벨을 자동 부착하지 않으며 신규 config와 예제에
   `pr.labels`가 없다. 기존 config의 해당 키는 오류 없이 무시한다.
8. 모든 task의 execute 증적과 PR 직전 최종 검증 결과가 `확인 방법`에
   요약되고, 계약 테스트와 `npm test`가 통과한다.

## Out of scope
- PR 제목 생성 로직과 커밋 타입 계산.
- finalize 커밋·게이트·worktree 정리·다음 blueprint handoff.
- Explain 저술, Quiz 출제·채점, comprehension 판정.
- 기존 소비 프로젝트의 `.bouncer/config.json` 자동 마이그레이션.

## Blueprints
* [리뷰 흐름 중심 PR 본문 계약](blueprints/001-structured-pr-body/index.md) - PR 템플릿·finalize 지침·라벨 기본값·계약 테스트를 한 생성 규칙으로 맞춘다
