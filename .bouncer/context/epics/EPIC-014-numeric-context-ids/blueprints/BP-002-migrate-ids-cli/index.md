---
type: bouncer.blueprint
title: context id 마이그레이션 CLI와 SessionStart 안내
description: migrate ids 명령·스킬·SessionStart 구형 명명 경고
resource: .bouncer/context/epics/EPIC-014-numeric-context-ids/blueprints/BP-002-migrate-ids-cli/index.md
tags:
  - bouncer
  - blueprint
timestamp: '2026-08-05T16:54:53.780+09:00'
bouncer:
  id: BP-002
  epic_id: EPIC-014
  blueprint_id: BP-002
  status: approved
  commit_type: feat
  commit_intent:
    - 구형 EPIC-/BP- 트리를 숫자 id로 옮기는 명령을 둠
    - 세션 시작 때 잔존 구형을 스킬 실행으로 안내함
---
# BP-002 migrate-ids-cli

Epic: [EPIC-014](../../index.md)

## Intent
- 문제: 하네스만 바꾸면 소비자·이 레포의 구형 context가 한꺼번에 깨지고, 수동 rename은 `resource`·본문·포인터까지 놓친다.
- 완료 조건: `bouncer migrate ids [--dry-run]`과 `skills/migrate-ids/`가 구형 트리를 숫자 명명으로 옮기고(본문 `EPIC-`/`BP-` 참조 포함), SessionStart가 구형 디렉터리를 보면 스킬 실행을 안내한다. EPIC-014 성공 조건 3·4.

## Contract
- 인터페이스: `bouncer migrate ids [--dry-run]` — Discover(구형 dir) → Plan → Validate(충돌·혼재·dirty) → Apply(또는 dry-run 목록만). Apply는 bp 디렉터리부터 rename, md frontmatter/`resource`/본문, `context/index.md`, Git common dir `bouncer/current` 포인터를 갱신한다.
- 인터페이스: 본문 rewrite는 `EPIC-\d+` / `BP-\d+` 및 `TASKS-BP-` 등 구형 자식 id 패턴을 숫자 정본으로 치환한다(사용자 확인: 전부 rewrite).
- 인터페이스: `skills/migrate-ids/SKILL.md` — 에이전트가 dry-run 결과를 보여 확인받은 뒤 `bouncer migrate ids`를 실행하는 절차.
- 인터페이스: SessionStart 훅 `hooks/session-legacy-ids.js`(graph 훅과 별개 항목)가 `.bouncer/context/epics/`에 `EPIC-\d+` 또는 `blueprints/BP-\d+`가 있으면 stderr 한두 줄로 스킬/`bouncer migrate ids --dry-run`을 안내하고 `exit 0`을 유지한다. 탐지·문구는 `migrate-ids`의 discover와 `legacyIdsWarnings`를 재사용해 `graphSyncWarnings`처럼 테스트가 문자열을 덮는다. 스킬 파일을 런타임에 생성하지 않는다(스킬은 이 BP가 추가).
- 거부: 신·구 혼재, 대상 경로 충돌, dirty worktree(기본)에서는 apply를 하지 않고 non-zero와 사유를 낸다. dry-run은 계획만 내고 0일 수 있다(실패는 validate 단계).
- 수용 기준: EPIC-014 성공 조건 3, 4. fixture 레포에서 dry-run/apply/거절 케이스가 테스트로 고정된다.
- 검증 명령: `npm test`
- 실패 모드·엣지 케이스: 포인터가 구 경로면 rewrite, 대상 없음이면 메시지. 부분 적용 없음.

## Out of scope
- 이 플러그인 실트리 일괄 적용(BP-003)
- 레거시 경로 허용 제거(BP-003)
- 하네스 정본 id 계약 자체(BP-001)

## One-commit justification
이관 실행기(CLI)·에이전트 절차(스킬)·발견 신호(SessionStart)가 한 사용자 여정이다.

## Documents
* [Tasks](tasks.md) - 구현 브리프
* [Verification](verification.md) - 검증 명령과 증적
* [Review](review.md) - 리뷰 발견사항
<!-- explain.md는 plan scaffold에 포함되지 않습니다. /bouncer-finalize가 작성합니다. -->
