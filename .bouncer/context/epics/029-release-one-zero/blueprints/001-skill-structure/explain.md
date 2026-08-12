---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/029-release-one-zero/blueprints/001-skill-structure/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-12T10:21:42.483+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '029'
  blueprint_id: '001'
  status: published
  comprehension:
    - task: '001'
      range_from: develop
      range_to: d1c62aa67734ef2f7ec2b43169db1bb8be143aba
      diff_sha: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      quiz_score: '2/2'
      disposition: '퀴즈 2문항 만점. 셸 BOUNCER_ROOT 대입 유지와 3인칭 description을 확인함.'
      recorded_at: 2026-08-12T10:22:52+09:00
    - task: '002'
      range_from: d1c62aa67734ef2f7ec2b43169db1bb8be143aba
      range_to: 12347fccc9edc20f2277aea20a8ceffbdf27ab88
      diff_sha: 46cc386cc9c3596ca88f2291a17a4b93e62c3f0c30ad7ce9f0ccf6a8e4a6558e
      quiz_score: '2/2'
      disposition: '퀴즈 2문항 만점. reviewer-prompt assets 이동과 3인칭 description을 확인함.'
      recorded_at: 2026-08-12T10:30:24+09:00
    - task: '003'
      range_from: 12347fccc9edc20f2277aea20a8ceffbdf27ab88
      range_to: 9dcac360068e3b584626b122757e208676d67d20
      diff_sha: a167a2bb9526cc5fd7a48c6180d1c8f7fae347e290c17837f628dc6dc184922e
      quiz_score: '2/2'
      disposition: '퀴즈 2문항 만점. 하드룰 9 위치와 validate.js 대비 예시를 확인함.'
      recorded_at: 2026-08-12T10:43:00+09:00

---
# Explain

## Background
워크플로 스킬 다섯 개는 플러그인 루트 산문을 `docs/install.md` 참조로 줄였고,
나머지 열한 개는 description을 3인칭으로 맞추며 `reviewer-prompt.md`를
`skills/review/assets/`로 옮겼다. 코드 주석 규칙은 구현 스킬과 implementer
문서에만 있어, 그 경로를 타지 않는 에이전트는 규칙을 보지 못했다. 이번
task는 그 규칙을 `CLAUDE.md` 하드룰 9로 올리고, 좋은/나쁜 주석 대비 예시는
`skills/implementation/SKILL.md`에 둔다.

## Intuition
마스터 규칙에는 의무와 포인터만 두고, 예시와 상세 지침은 implementation
스킬에 둔다. Distill 하드룰 7과 같은 모양이다.

## Code
- `skills/bouncer-{init,plan,execute,commit,finalize}/SKILL.md` — 플러그인 루트
  산문 → `docs/install.md` 참조 (task 001)
- 워크플로 밖 스킬 11개 `SKILL.md` — description 3인칭; `reviewer-prompt.md` →
  `skills/review/assets/` (task 002)
- `CLAUDE.md` — 하드룰 9 Code comments (의무 + `skills/implementation/SKILL.md`
  포인터)
- `skills/implementation/SKILL.md` — 하드룰 9 참조 + `validate.js`에서 가져온
  Bad/Good 주석 대비 3쌍
- `agents/bouncer-implementer.md` — 하드룰 9를 가리키기만 함 (규칙 본문 없음)
- `test/master-rules.test.js`, `test/skill-implementation.test.js`,
  `test/agents.test.js` — 계약 단정

## Quiz
1. 코드 주석 규칙은 어디에 의무로 올렸나?
   - A) `skills/minimality/SKILL.md`에만 추가한다
   - B) `docs/governance.md`에 새 섹션을 만든다
   - C) `CLAUDE.md` 하드룰 9로 올리고 예시는 implementation 스킬에 둔다

2. implementation 스킬의 Bad/Good 주석 예시는 어디서 가져왔나?
   - A) `scripts/lib/validate.js`의 실제 게이트 주석
   - B) 새로 만든 가짜 샘플 함수
   - C) `docs/ARCHITECTURE.md`의 의사코드

## 이해 상태
- (task 001) 문항 1 정답: B — 대입은 각 셸 블록에 그대로 남긴다
  - 응답: B / 정답
- (task 001) 문항 2 정답: C — `This skill should be used only when…` (3인칭)
  - 응답: C / 정답
- (task 001) quiz_score: 2/2
- (task 001) disposition: 퀴즈 2문항 만점. 셸 BOUNCER_ROOT 대입 유지와 3인칭 description을 확인함.
- (task 002) 문항 1 정답: B — `skills/review/assets/reviewer-prompt.md`
  - 응답: B / 정답
- (task 002) 문항 2 정답: A — `This skill should be used when/during/from…` (3인칭)
  - 응답: A / 정답
- (task 002) quiz_score: 2/2
- (task 002) disposition: 퀴즈 2문항 만점. reviewer-prompt assets 이동과 3인칭 description을 확인함.
- (task 003) 문항 1 정답: C — `CLAUDE.md` 하드룰 9 + implementation 스킬 예시
  - 응답: C / 정답
- (task 003) 문항 2 정답: A — `scripts/lib/validate.js`의 실제 게이트 주석
  - 응답: A / 정답
- (task 003) quiz_score: 2/2
- (task 003) disposition: 퀴즈 2문항 만점. 하드룰 9 위치와 validate.js 대비 예시를 확인함.
