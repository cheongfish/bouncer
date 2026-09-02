---
type: bouncer.blueprint
title: 리뷰 흐름 중심 PR 본문 계약 개편
description: PR 본문 소스와 섹션 순서, 조건부 Mermaid, 검증 요약, 라벨 제거 규칙을 하나의 생성 계약으로 맞춘다
resource: .bouncer/context/epics/009-agent-orchestration/blueprints/013-structured-pr-body/index.md
tags:
  - bouncer
  - blueprint
  - finalize
  - pull-request
timestamp: '2026-08-28T13:06:04.942+09:00'
bouncer:
  id: '013'
  epic_id: '009'
  blueprint_id: '013'
  status: closed
  commit_type: feat
  scale: full
  supersedes: []
---
# 013 리뷰 흐름 중심 PR 본문 계약 개편

Epic: [009](../../index.md)

## Intent
- 문제: 내장·수동 템플릿과 finalize 지침이 기능 분류, Bouncer ID, 자동 라벨을
  전제로 하고 있어 Explain의 변경 의도와 검증 증적이 리뷰 흐름으로 이어지지 않는다.
- 완료 조건: 자동·수동 PR/MR 본문이 같은 섹션 구조를 사용하고, finalize는 정해진
  문서와 diff에서만 내용을 조합하며 조건에 맞을 때만 Mermaid를 추가한다.

## Contract
- 인터페이스:
  - PR 제목은 현행 `[YYMMDD] (→ MergeTarget) [Type/Type] 요약` 생성 규칙을
    유지한다.
  - 본문은 `관련 이슈`, `배경 · 변경 의도`, `주요 변경 내용`, 선택적
    `로직 흐름`, `리뷰 포인트`, `확인 방법` 순서로 렌더링한다.
  - `배경 · 변경 의도`는 Explain `Background`·`Intuition`, `주요 변경 내용`은
    Explain `Code`를 기본 소스로 삼고 branch diff와 커밋으로 구체화한다.
  - `리뷰 포인트`는 Explain `Code`와 diff의 핵심 경로, blueprint의 실패 모드와
    Out of scope, task Constraints·Do not touch, accepted review finding에서만
    작성한다.
  - `확인 방법`은 PR 직전 성공한 `finalize --yes` 검증을 우선하고 모든 task의
    execute gate 증적을 번호순으로 집계한다. 긴 stdout은 복사하지 않고
    `명령 — 결과` 형태로 요약한다.
  - Explain 항목은 head branch 또는 commit에서 실제로 열리는 Markdown 링크다.
    관련 이슈의 근거가 없으면 이슈를 만들지 않고 Explain 링크만 둔다.
  - 호출 순서·제어 흐름·상태 전이·데이터 처리 단계·컴포넌트 책임 재배치가
    diff 또는 Explain에서 확인될 때만 Mermaid를 만든다. 핵심 노드는 약 8개
    이하이며 필요할 때만 As-Is/To-Be를 각각 하나씩 둔다.
- 데이터·상태:
  - 신규 config의 `pr` 기본값에서 `labels`를 제거한다. 기존 config에 남은
    `pr.labels`는 읽기 오류나 자동 라벨 부착을 일으키지 않는다.
  - `PR_TEMPLATE`, GitHub PR 템플릿, GitLab MR 템플릿은 같은 섹션 순서를
    유지한다. 수동 비-Bouncer 요청에서는 Explain 항목을 제거할 수 있다.
- 수용 기준: Epic 성공 조건 1–8을 모두 만족한다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스:
  - 관련 이슈가 없거나 흐름 변화가 없으면 빈 불릿·빈 선택 섹션을 남기지 않는다.
  - 여러 task가 같은 명령을 실행했으면 횟수나 task별 결과가 사라지지 않도록
    중복을 의미 있게 집계한다.
  - Explain이 base에는 없고 head에만 있으면 base 상대 경로가 아니라 head에서
    열리는 URL을 만든다. 링크를 만들 수 없으면 링크인 척하는 경로를 발명하지 않는다.
  - 문서·설정·테스트만 바뀌거나 단순 이름 변경·파일 이동인 경우 Mermaid를
    생략한다. 그림이 코드보다 복잡해져도 생략한다.
  - 검증 증적이나 리뷰 근거가 없으면 통과·위험·비범위를 추측하지 않는다.

## Out of scope
- PR 제목·commit type·merge target 계산 변경.
- `finalize()`의 검증 실행, 커밋, pointer, worktree, handoff 반환 계약 변경.
- Explain·Quiz·comprehension 스키마와 G16 판정 변경.
- 기존 프로젝트 config 파일의 `pr.labels` 삭제 마이그레이션.
- GitLab MR 자동 생성 경로 추가.

## One-commit justification
- PR 생성 지침, 자동·수동 템플릿, 라벨 기본값, 문서, 계약 테스트는 한 본문
  계약의 소비자다. 일부만 먼저 바꾸면 생성 지침과 실제 템플릿 또는 신규 config가
  어긋나므로 한 task 커밋으로 함께 검토한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
