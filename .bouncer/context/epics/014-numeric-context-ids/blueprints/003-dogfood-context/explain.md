---
type: bouncer.explain
title: 003 explain
description: Explain for 003
resource: .bouncer/context/epics/014-numeric-context-ids/blueprints/003-dogfood-context/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-06T08:48:02.180+09:00'
bouncer:
  id: EXPLAIN-003
  epic_id: '014'
  blueprint_id: '003'
  status: published
  comprehension:
    diff_sha: bf76e6967ee32d5422d19e1139a828dc77b9647709101d4b4d4d669e31251fc0
    quiz_score: 2/5
    disposition: accepted — Q2/Q4 correct; Q1 missed (migrate first); Q3 missed (S4/S5 skip normalizeContextId); Q5 missed (worktree/branch names stay)
    recorded_at: '2026-08-06T08:51:18+09:00'
---
# Explain

## Background
001·002가 정본과 이관 CLI를 만들어도 이 레포 트리는 아직 `EPIC-`/`BP-`였고,
layout·`parsePathIds`·S5가 구형 접두를 받아 주면 하드 컷이 끝나지 않는다.
이 커밋은 `bouncer migrate ids`로 `.bouncer/context/`를 숫자 명명으로 옮긴 뒤
구형 경로·메타 허용을 제거하고 Distill·CHANGELOG·문서 예시를 맞춘다.
적용 중 이 BP 경로도 `…/014-…/003-dogfood-context`로 바뀌므로 이후 게이트는
새 경로만 쓴다.

## Intuition
먼저 트리를 옮기고, 그다음 읽는 쪽의 구형 허용을 끊는다. 순서가 바뀌면
이 커밋의 문서가 validate에 걸린다.

## Code
- Dogfood: `bouncer migrate ids` (dry-run 확인 → apply). 38 rename(epic 14 +
  blueprint 24), frontmatter·`resource`·본문 링크·번들 index·포인터 rewrite.
- 하드 컷: `scripts/src/lib/paths.ts`의 `EPIC_SEG_RE`/`BP_SEG_RE`에서 optional
  접두 삭제. `layout.ts`·`epic-index.ts`·`scaffold.ts` 동형. `validate.ts`
  S4/S5는 `normalizeContextId`를 거치지 않고 정본만 본다.
  `normalizeContextId`는 migrate가 쓰므로 함수는 남긴다.
- S13: `epic-index.ts`가 `EPIC-` 디렉터리·index 링크를 조용히 건너뛰지 않고
  거절한다. 구형만 남은 트리는 빈 dirs로 통과하지 못한다.
- 테스트: `test/` fixture를 신형으로 옮김. `test/migrate-ids.test.js`만 구형
  트리를 만든다. CJS는 `npm run build`로 `scripts/lib/*.js` 재생성.
- 문서: Distill worktree 문구, `CHANGELOG.md` `[Unreleased]` EPIC-014 항목,
  `docs/PILOT.md`·`docs/context-versioning.md`. worktree/브랜치 이름
  (`BP-003`)은 rename하지 않는다.

## Quiz
1. migrate와 하드 컷 중 어느 것을 먼저 해야 하는가? 순서가 바뀌면?
   - A) 하드 컷 먼저 — migrate가 구형 경로를 못 찾음
   - B) migrate 먼저 — 하드 컷이 앞서면 이 커밋 문서가 validate에 걸림
   - C) 동시에 — 순서는 상관없음
   - D) 하드 컷만 — migrate는 소비자 레포 전용
2. apply 후 이 BP의 validate `--blueprint` 인자는?
   - A) `…/EPIC-014-…/blueprints/BP-003-dogfood-context`
   - B) `…/014-numeric-context-ids/blueprints/003-dogfood-context`
   - C) `.worktrees/BP-003` (worktree 경로)
   - D) `bouncer/current` 파일 경로
3. S4/S5가 `normalizeContextId`를 여전히 거치는가?
   - A) 예 — 구형 frontmatter를 정규화한 뒤 비교
   - B) 아니오 — 정본만 보고, 구형 값은 그대로 실패
   - C) S5만 거치고 S4는 안 거침
   - D) plan 게이트에서만 거침
4. 구형 `EPIC-` epic 디렉터리만 남은 저장소에서 S13은?
   - A) 통과 — dirs가 비어 early return
   - B) 통과 — SessionStart가 대신 막음
   - C) 실패 — legacy dir/link를 S13으로 거절
   - D) S10만 나고 S13은 관련 없음
5. execute worktree 디렉터리 이름(`.worktrees/BP-003`)도 migrate가 바꾸는가?
   - A) 예 — epic과 같이 `003`으로 rename
   - B) 예 — finalize가 함께 rename
   - C) 아니오 — worktree/브랜치 이름은 그대로 두고 finalize까지 감
   - D) 아니오 — 단 `.worktrees` 루트만 숫자 id로 바꿈

## 이해 상태
퀴즈 2/5. Q2·Q4 맞음. Q1은 migrate 먼저(하드 컷이 앞서면 이 문서가
validate에 걸림). Q3은 S4/S5가 normalizeContextId를 거치지 않음. Q5는
worktree/브랜치 이름을 migrate가 바꾸지 않음. disposition accepted.
