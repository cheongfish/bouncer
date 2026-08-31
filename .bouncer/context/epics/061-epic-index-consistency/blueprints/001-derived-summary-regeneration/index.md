---
type: bouncer.blueprint
title: 에픽 색인 파생 요약 재생성
description: 에픽 description 기반 재생성과 S13 lint를 한 atomic cutover로 적용한다
resource: .bouncer/context/epics/061-epic-index-consistency/blueprints/001-derived-summary-regeneration/index.md
tags:
  - bouncer
  - blueprint
  - validation
timestamp: '2026-08-31T13:35:31.411+09:00'
bouncer:
  id: '001'
  epic_id: '061'
  blueprint_id: '001'
  status: closed
  commit_type: fix
  scale: full
  supersedes: []
---
# 001 에픽 색인 파생 요약 재생성

Epic: [061](../../index.md)

## Intent
- 문제: scaffold가 같은 `Epic NNN` 값을 에픽과 번들 색인에 복사하고, 이후 저술된 description과 색인 행을 다시 맞추는 경로가 없다. S13도 요약을 읽지 않아 61개 디렉터리의 drift가 누적됐다.
- 완료 조건: scaffold 재진입이 현재 frontmatter에서 색인 행을 재생성하고 S13이 같은 정본을 lint한다. 기존 데이터와 모든 fixture가 새 계약으로 함께 전환되어 검증이 통과한다.

## Contract
- 인터페이스: `bouncer scaffold epic --id <ddd> --name <slug> --description <text>`는 신규 에픽을 저술된 description으로 만든다. 같은 경로가 이미 있으면 에픽 문서를 덮어쓰지 않고 현재 frontmatter description으로 번들 색인 행의 설명 부분을 재생성한다. `ensureEpicIndexEntry`는 경로 존재와 요약 동일성을 기준으로 append·description replace·no-op을 구분한다.
- 데이터·상태: 에픽 frontmatter `description`이 정본이고 `.bouncer/context/index.md`의 행 설명은 파생값이다. 기존 디렉터리 61개는 `31 row-placeholder/description-real`, `12 row-real/description-placeholder`, `12 both-placeholder`, `3 both-real-equal`, `3 both-real-mismatch`로 분류하며, 신규 061 행까지 현재 description으로 재생성한다.
- 수용 기준: Epic success criteria 1–6을 모두 만족한다. 강화된 S13과 데이터 정합화는 어느 한쪽만 먼저 적용해 저장소를 실패 상태로 두지 않는다.
- 검증 명령: task frontmatter의 `npm run ci`가 관련 test·coverage·lint·typecheck·audit를 한 진입점에서 실행한다.
- 실패 모드·엣지 케이스: description이 없거나 공백·`Epic NNN`이면 신규 scaffold와 재생성을 거부하고, S13은 읽기·파싱 실패와 기대 요약 불일치를 보고한다. 중복 id `024` 두 디렉터리는 각각의 경로와 description으로 독립 처리하며 이번 작업에서 병합하지 않는다. 색인 frontmatter·헤딩·행 순서는 보존하고 대상 한 줄만 교체한다.

## Out of scope
- `llm-wiki-prework.md`의 A1~A6 결정과 P1~P7 구현
- 기존 epic 본문·title·status·timestamp·id 수정
- 중복 id `024` 정리와 신규 게이트 코드 할당
- 별도 migration 파일이나 새 top-level CLI 명령 추가

## One-commit justification
- S13을 강화한 커밋에서 기존 데이터와 fixture를 함께 정합화하지 않으면 저장소 구조 검증이 즉시 실패한다. scaffold 입력·재생성·lint·backfill은 하나의 파생값 계약이므로 한 task와 한 커밋으로 전환한다.

## Documents
* [Tasks](tasks/001/tasks.md) - 구현 브리프
* [Verification](tasks/001/verification.md) - 검증 명령과 증적
* [Review](tasks/001/review.md) - 리뷰 발견사항
* [Context review](context-review.md) - 계획 문서 정합성 판정
