---
type: bouncer.explain
title: 004 explain
description: Explain for 004
resource: .bouncer/context/epics/001-product-surface-hosts/blueprints/009-debt-items/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-31T11:43:13.143+09:00'
bouncer:
  id: EXPLAIN-009
  epic_id: '001'
  blueprint_id: '009'
  status: published
  comprehension:
    - range_from: develop
      range_to: b086b2e0cc4c252b5c6386b4278875533a68e905
      diff_sha: 1060e30ee7e2e100c0d0300e06de8e4ebb41623a1320f611d88cbdef7d2ec6ba
      quiz_score: 4/4
      disposition: 명령어 자리 vs 인자 자리, YAML 선두 인용, G18 파싱/부재 분기, B11 clone 완화를 diff와 맞게 이해함
      recorded_at: '2026-08-31T11:46:00+09:00'
---
# Explain

## Background

감사에서 B7–B11·B16이 남았다. B8(따옴표 git 명령 탐지)과 B16(YAML frontmatter 작성·진단)은
재현 가능한 결함이었고, 나머지는 기존 설계와 맞닿는 유지 항목이었다. 이 blueprint는 B8·B16을
고치고 B7–B11의 처분을 `docs/audit-debt-decisions.md` 한곳에 고정한다. 게이트 코드·포인터
저장 위치·G16 comprehension 계약은 바꾸지 않는다.

## Intuition

명령어 자리와 인자 자리를 구분하는 얇은 가드, YAML 선두 문자만 인용하는 작성 규칙, 파싱 실패와
파일 부재를 다른 복구 안내로 나누는 진단, 그리고 “고침 vs 유지”를 표로 남기는 결정 기록 — 네
task가 각각 다른 층을 맡는다.

## Code

- **B8 탐지:** `scripts/src/lib/commit-hook.ts` — `isCommandPositionGit()`로 세그먼트 첫 토큰의
  인용 git만 허용. `test/commit-hook.test.js`, `docs/security.md`.
- **B16 작성:** `references/spec-authoring/index.md` — author-written scalar 선두 예약 지시자
  인용. `skills/bouncer-plan/references/context-review.md` — finding `note`에 동일 규칙 연결.
- **B16 진단:** `scripts/src/lib/validate.ts`(parseErrors 전달),
  `scripts/src/lib/validate-gates.ts`(G18 분기). `test/validate-structural.test.js`,
  `test/validate-gates.test.js`, `docs/troubleshooting.md`.
- **결정 기록:** `docs/audit-debt-decisions.md` — B7–B11 표. `docs/README.md` 목차 연결.

## Quiz

**Q1.** `"git" commit -m x`를 커밋으로 탐지할 때, `echo "git" commit`을 커밋으로 보지 않는
핵심 이유는?

- A) `echo`는 git alias라서
- B) 인용 git은 세그먼트 **첫 토큰(명령어 자리)**일 때만 git argv로 본다
- C) echo 뒤 문자열은 항상 주석 처리된다

**Q2.** task frontmatter의 `commit_intent`에 `` `git add` ``처럼 백틱으로 시작하는 값을
평문 `- ` 뒤에 쓰면 어떤 일이 생기기 쉬운가?

- A) YAML 파서가 태그/alias로 읽어 frontmatter 전체가 깨진다
- B) `commit_intent`만 무시되고 본문은 그대로다
- C) plan gate가 자동으로 작은따옴표로 감싼다

**Q3.** `context-review.md`가 디스크에 있는데 frontmatter 파싱이 실패하면, plan gate G18은
어떤 메시지 쪽으로 분기하는가?

- A) `context-review.md missing ... scaffold context-review`
- B) `context-review.md has invalid frontmatter; fix the S0 parse error`
- C) G18을 건너뛰고 plan gate를 통과시킨다

**Q4.** B11(저장소당 활성 blueprint 하나)의 운영 완화로 문서에 적힌 방법은?

- A) linked worktree를 두 개 더 만든다
- B) namespaced 포인터를 즉시 켠다
- C) 병렬 사이클은 **독립 clone**에서 돌린다

## 이해 상태

퀴즈 4/4. Q1 B(명령어 자리 인용 git), Q2 A(YAML 선두 백틱 → 파서 깨짐), Q3 B(parse 실패
G18), Q4 C(병렬은 독립 clone). disposition: diff의 네 축(가드·작성·진단·결정 기록)을 구분해
답함.
