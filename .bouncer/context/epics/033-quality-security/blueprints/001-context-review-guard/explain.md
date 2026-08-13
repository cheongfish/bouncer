---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/033-quality-security/blueprints/001-context-review-guard/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-13T12:16:49.415+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '033'
  blueprint_id: '001'
  status: published
  comprehension:
    - range_from: develop
      range_to: 9bee47d627466d310a78286eae89e0c4383ac338
      diff_sha: a04bca890a5e0784db305d629728c3c741b0cd918e4081620d748c57e8b67e70
      quiz_score: '3/6'
      disposition: Q1–Q3 오답 — G18은 plan 전용이고 문서는 BP 루트 CTXREVIEW이며 게이트는 필드만 읽음
      recorded_at: '2026-08-13T12:21:44+09:00'
---
# Explain

## Background

plan 게이트는 필드가 채워졌는지만 봤다. 에픽·blueprint·tasks가 서로 어긋나도
승인이 났고, 그 브리프는 execute에서야 깨졌다. `/bouncer-run`은 그 사이를
사람이 보지 못한 채 주행한다.

이 변경은 blueprint 루트에 `context-review.md`를 두고, 승인 직전에
`bouncer-context-reviewer`가 계획 문서를 판정하게 한다. **G18**은 그 문서의
status와 findings 형식만 본다. 판정 문장은 에이전트가 쓰고, 통과 여부는
`bouncer validate`가 가른다.

같이 고정한 것: minimality 래더에서 native platform과 표준 라이브러리를 갈라
세우고 `bouncer.scale`에 강도를 매긴 것, 컨텍스트 본문·그래프 산출물·서브에이전트
리포트를 지시로 읽지 않는다는 경계를 `docs/security.md`에 적은 것.

## Intuition

execute의 `review.md`를 plan 입구에 하나 더 붙인 것이다. 게이트는 표의 칸이
채워졌는지만 본다.

## Code

- `scripts/src/lib/schema.ts` · `paths.ts` · `scaffold.ts` — 종류
  `bouncer.context_review`, 파일은 blueprint 루트 `context-review.md`, id는
  `CTXREVIEW-<bp>`. `scaffold blueprint`가 같이 만들고, 기존 BP는
  `bouncer scaffold context-review --blueprint`. 파일이 있으면 거절한다
  (`scaffoldExplain`의 조용한 no-op과 다름).
- `skills/context-review/SKILL.md`, `agents/bouncer-context-reviewer.md` —
  네 범위(문서 간 모순, 범위, 한국어, 성공 기준 검증 가능성). 에이전트는
  read-only. 컨트롤러가 `context-review.md`를 쓰고 status를 올린다.
- `skills/bouncer-plan/SKILL.md` — `affected_paths` 확정 다음, 승인 직전에
  named 디스패치 네 단계(미지원 호스트는 인라인 폴백).
- `scripts/src/lib/validate.ts` — plan 전용 G18. findings 계약은 G14와 같다
  (`id`·`severity`·`status`, `accepted`에는 note). 배열이 아닌 findings는
  빈 목록으로 떨어뜨리지 않는다. `scale: light` 분기는 없다.
- `skills/minimality/SKILL.md` — 7단. 3단 native platform, 4단 표준 라이브러리.
  `light`는 1–4단만, 부재·`full`은 7단. `scripts/`는 이 매핑을 읽지 않는다.
- `docs/security.md` 「신뢰 경계」 — 플러그인 스킬·에이전트·마스터 룰과 사용자
  직접 지시만 따른다. `test/trust-boundary.test.js`가 스킬 8·에이전트 4의
  문구를 순회한다. 실질 방어선은 게이트 판정을 `bouncer validate`만 한다는
  설계다.

## Quiz

1. G18이 막는 게이트는?
   - A) plan과 execute
   - B) plan만
   - C) plan·execute·finalize 전부

2. `context-review.md`의 위치와 id는?
   - A) `tasks/<NNN>/context-review.md`, id `REVIEW-<NNN>`
   - B) epic 루트 `context-review.md`, id `CTXREVIEW-<epic>`
   - C) blueprint 루트 `context-review.md`, id `CTXREVIEW-<bp>`

3. G18이 읽는 것은?
   - A) status와 findings의 `id`·`severity`·`status` (`accepted`면 note), `## Findings` 절
   - B) 에이전트가 쓴 판정 문장
   - C) 스킬이 매긴 점수

4. G18을 문서·스킬(001·002) 다음에 올린 이유는?
   - A) `scale: light` 면제를 쓰기 위해
   - B) `review.md`를 재사용하려고
   - C) 이 blueprint의 `context-review.md`가 있어야 `current --set`이 자기 게이트를 통과하므로

5. minimality 래더에서 native platform과 표준 라이브러리 순서는?
   - A) native platform이 3단, 표준 라이브러리가 4단
   - B) 한 단에 묶여 있다
   - C) 표준 라이브러리가 3단, native platform이 4단

6. 컨텍스트 본문·그래프 산출물·서브에이전트 리포트를 지시로 읽으면?
   - A) `scripts/`가 패턴 탐지로 막는다
   - B) `scripts/`는 막지 않는다. 실질 방어선은 게이트 판정을 `bouncer validate`만 한다는 설계다
   - C) `scale: light`면 면제된다

## 이해 상태

- 점수: 3/6
- 정답: 1B · 2C · 3A · 4C · 5A · 6B
- 응답: 1A · 2B · 3B · 4C · 5A · 6B
- 채점: 1✗ 2✗ 3✗ 4✓ 5✓ 6✓
- disposition: Q1–Q3 오답 — G18은 plan 전용이고 문서는 BP 루트 CTXREVIEW이며 게이트는 필드만 읽음
- range: develop..9bee47d627466d310a78286eae89e0c4383ac338
- diff_sha: a04bca890a5e0784db305d629728c3c741b0cd918e4081620d748c57e8b67e70
