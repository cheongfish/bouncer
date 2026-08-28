---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/056-unpublished-helper-skills/blueprints/001-catalog-hide/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T12:49:44.606+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '056'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2ef2ce1da61e1800b608317e2c0cf8bf16da542d
      diff_sha: c82ea02306b62a75371bb9c949ad518c86a27c1a2da8c646d6c4f36c317dc54b
      quiz_score: '3/3'
      disposition: 카탈로그 스캔 범위·정본 개수 8·migrate-ids 공개 유지를 모두 맞춤.
      recorded_at: '2026-08-28T12:50:45+09:00'
---
# Explain

## Background
보조 스킬 11개가 `skills/*/SKILL.md`에 있어 호스가 세션 목록에 넣고 암묵 매칭했다.
진입 스킬(`/bouncer-*`)만 카탈로그에 남기고, 보조 본문은 호스가 스캔하지 않는
`references/<name>/index.md`로 옮겨 경로로만 읽게 했다. 절차 문장은 그대로 두고
경로·계약 테스트·문서만 맞췄다.

## Intuition
호스 목록은 매장 진열, `references/`는 창고. 손님이 집는 건 진열 여덟 개뿐이고,
점원(`/bouncer-*`)만 창고 열쇠로 보조 본문을 연다.

## Code
- 이동: `skills/<helper>/SKILL.md` → `references/<helper>/index.md` (하위
  `epic.md`·`phrases.md`·`assets/reviewer-prompt.md`·`LICENSE` 동반, `git mv`)
- 읽기: `test/helpers/read-skill.js`의 `UNPUBLISHED_HELPERS` →
  `references/<name>/index.md`; 카탈로그 정본 개수 8
  (`test/skill-bouncer-surface.test.js`)
- 호출: `skills/bouncer-{plan,execute,finalize}/SKILL.md`와 agents·`CLAUDE.md`
  When to invoke에서 보조 행 제거
- 문서: `docs/ARCHITECTURE.md` §4는 이름 여덟 개 유지, 위치만 `references/`로
  명시; Distill `plugin-skills` 샤드 `paths`에 `references/**`

## Quiz
1. 호스가 관례로 스캔하는 스킬 파일 집합은?
   - A) `skills/*/SKILL.md`와 `references/*/index.md` 둘 다
   - B) `skills/*/SKILL.md`만
   - C) `references/*/SKILL.md`만

2. 카탈로그 정본 개수(`EXPECTED_SKILL_COUNT`)는?
   - A) 11
   - B) 19
   - C) 8

3. `migrate-ids`는 이 BP에서 어떻게 되나?
   - A) `references/migrate-ids/index.md`로 이동
   - B) `skills/migrate-ids/SKILL.md`에 공개로 남음
   - C) 플러그인에서 삭제

## 이해 상태
- 응답: 1-B, 2-C, 3-B
- 정답: 1-B, 2-C, 3-B — 전부 맞음 (`3/3`)
- disposition: 카탈로그 스캔 범위·정본 개수 8·migrate-ids 공개 유지를 모두 맞춤.
