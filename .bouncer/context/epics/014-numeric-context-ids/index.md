---
type: bouncer.epic
title: 숫자만 쓰는 context id
description: epic/bp 경로·메타에서 EPIC-/BP- 접두를 제거하고 마이그레이션 경로를 둔다
resource: .bouncer/context/epics/014-numeric-context-ids/index.md
tags:
  - bouncer
  - epic
timestamp: '2026-08-05T16:54:53.684+09:00'
bouncer:
  id: '014'
  epic_id: '014'
  status: approved
---
# 014 numeric-context-ids

## Intent
- 문제: epic 부모가 이미 `epics/`인데 디렉터리·메타에 `EPIC-`/`BP-`를 중복하고, 하네스가 그 접두에 묶여 있다.
- 목표: 정본 id는 zero-pad 세 자리(`001`)만 쓰고, 구형 트리는 CLI·스킬·SessionStart 신호로 한 번에 옮긴다.

## Success criteria
1. `bouncer scaffold epic --id 014 --name <slug>`가 `.bouncer/context/epics/014-<slug>/`를 만들고 `bouncer.id`·`epic_id`가 `014`이다.
2. `bouncer scaffold blueprint --id 001 …`가 `…/blueprints/001-<slug>/`를 만들고 자식 문서 `id`가 `TASKS-001`·`VERIFY-001`·`REVIEW-001`·`EXPLAIN-001` 형태이다.
3. `bouncer migrate ids --dry-run`이 구형(`EPIC-`/`BP-`) 트리에 대해 rename·frontmatter·`resource`·본문·번들 index·포인터 변경 목록을 내고, 적용 후 구조 검사(S4/S5/S13)가 통과한다.
4. SessionStart가 구형 epic/bp 디렉터리를 보면 stderr로 마이그레이션 스킬 실행을 안내하고, 세션을 막지 않는다(`exit 0`).
5. 이 플러그인 `.bouncer/context/`가 숫자 명명으로 존재하며 `npm test`가 통과한다.
6. 레거시 경로·메타 허용이 제거된 뒤 `EPIC-\d+`/`BP-\d+` 디렉터리나 `014`·`TASKS-001` 형태의 frontmatter가 남은 트리는 layout/validate가 거절한다.

## Out of scope
- 레거시 SDD / 루트 `context/` 자동 이전
- `distill.md` → `explain.md` 소급(013과 동일)
- worktree·브랜치 정책 재설계(id 문자열만 따라감)
- 구·신 id를 릴리스 이후에도 무기한 dual-read로 유지
- 버전 범프·태그 — 기존 관례대로 에픽 밖 별도 `chore: <version> 릴리스 문서·버전
  갱신` 커밋이 맡는다. 이 에픽은 `CHANGELOG.md`의 `[Unreleased]`까지만 쓴다.
  구형 명명 레포를 거절하는 파괴적 변경이므로 다음 릴리스는 0.5.0이 맞다.

## Blueprints
* [숫자 id 하네스 계약](blueprints/001-id-contract/index.md) - path·schema·scaffold·validate·epic-index·템플릿이 `001` 정본을 쓰고, 구형 접두 경로는 파생만 임시 허용한다
* [migrate CLI·스킬·SessionStart](blueprints/002-migrate-ids-cli/index.md) - `bouncer migrate ids`와 `migrate-ids` 스킬을 두고 SessionStart가 구형 명명을 경고한다
* [플러그인 context dogfood](blueprints/003-dogfood-context/index.md) - 이 레포에 migrate를 적용하고 레거시 경로 허용을 제거하며 Distill·남은 하드코딩을 맞춘다
* [64개 epic을 11개 주제 계층으로 통합](blueprints/004-corpus-consolidation/index.md) - historical corpus를 11개 canonical epic 아래로 이동하고 ID·링크·검색 회귀를 검증한다
* [git 히스토리 임포트 명령](blueprints/005-history-import-cli/index.md) - `imported` status 어휘와 `bouncer import` 명령을 추가한다
* [문서 스키마 확정과 레거시 레이아웃 서술 컷오버](blueprints/006-schema-cutover/index.md) - 코드에 스키마 필드를 등록하고 구조 검사 두 개를 추가하며 루트 task-layout 서술을 닫는다
* [컨텍스트 다이제스트에 blueprint·task 층위 추가](blueprints/007-context-digest-grain/index.md) - digest whitelist를 다섯 kind로 넓혀 계약·브리프 어휘가 context graph에 들어오게 한다
* [결정 계보 필드 bouncer.supersedes 추가](blueprints/008-supersedes-field/index.md) - schema·scaffold·구조 validation에 `supersedes` frontmatter 슬롯을 추가한다
* [에픽 색인 파생 요약 재생성](blueprints/009-derived-summary-regeneration/index.md) - epic description에서 epic-index 요약을 재생성하고 한 번의 컷오버로 S13 lint를 강제한다
