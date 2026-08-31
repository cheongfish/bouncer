---
type: bouncer.epic
title: 에픽 색인 파생 요약 정합성
description: 에픽 description을 정본으로 삼아 번들 색인 요약을 재생성하고 불일치를 S13으로 차단한다
resource: .bouncer/context/epics/061-epic-index-consistency/index.md
tags:
  - bouncer
  - epic
  - validation
timestamp: '2026-08-31T13:35:31.372+09:00'
bouncer:
  id: '061'
  epic_id: '061'
  status: approved
  supersedes: []
---
# 061 에픽 색인 파생 요약 정합성

## Intent
- 문제: `.bouncer/context/index.md`의 에픽 요약은 scaffold 시점의 `Epic NNN` 값을 복사한 뒤 다시 생성되지 않고, S13도 경로의 양방향 존재만 검사한다. 기존 디렉터리 61개(고유 id 60개) 중 42개 행과 24개 frontmatter description에 플레이스홀더가 남았고, 실제 요약끼리 다른 3개도 검출되지 않는다.
- 목표: 에픽 frontmatter `description` 한 곳에만 저술 권한을 두고 번들 색인 행은 그 값에서 재생성한다. S13은 경로와 요약을 함께 검사해 파생값 drift의 재발을 막는다.

## Success criteria
1. 에픽 frontmatter `description`과 번들 색인 요약이 다를 때 재생성 경로가 기존 행을 제자리에서 갱신하고 중복 행을 만들지 않는다.
2. S13이 에픽 디렉터리의 누락·초과뿐 아니라 description과 색인 요약의 불일치, 읽을 수 없는 정본을 실패로 보고한다.
3. `bouncer scaffold epic` 최초 호출은 저술된 description으로 에픽과 색인 행을 만들고, 같은 에픽에 대한 재호출은 에픽 문서를 덮어쓰지 않은 채 색인 행만 현재 frontmatter에 맞춘다.
4. 기존 에픽 디렉터리 61개와 이 에픽의 description·색인 행에 `Epic NNN` 플레이스홀더가 0개이고, 플레이스홀더가 아닌 기존 불일치 3개도 frontmatter 정본으로 수렴한다.
5. 역방향 backfill 12개와 본문 근거 저술 12개의 provenance가 task에 고정되고, 자동 재생성 대상 31개가 같은 하네스 경로로 갱신된다.
6. 관련 단위·CLI·구조 검증 테스트와 `npm run ci`가 통과한다.

## Out of scope
- A1~A6의 리뷰 인력·파일럿·도메인·커버리지·중앙 저장소·소비 표면 결정
- P1 이후의 raw 추출, 식별자 lint·레지스트리, PR 변경 추적, knowledge ingest, 다중 저장소 취합, 기획자 표면 구현
- 중복 id `024`의 디렉터리 통합이나 기존 epic·blueprint의 lifecycle 변경
- 새로운 문서 계층 또는 별도 위키 ingest 계층 도입

## Blueprints
* [에픽 색인 파생 요약 재생성](blueprints/001-derived-summary-regeneration/index.md) - scaffold·S13·테스트를 frontmatter 정본에 맞추고 기존 에픽 description과 번들 색인을 한 번에 보정한다
