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
    - task: '004'
      range_from: 9dcac360068e3b584626b122757e208676d67d20
      range_to: 1bef4e0e7ba11d063b45a392eff5202616eb7c39
      diff_sha: 7c21c8b2d79634d53100f0431f87fb3db3aa0f1ffabd528858f67e9c24028ceb
      quiz_score: '0/2'
      disposition: '퀴즈 2문항 0점. remainder는 최고 번호 task intent, task 커밋은 폴백 없이 생략임을 다시 확인함.'
      recorded_at: 2026-08-12T11:04:32+09:00

---
# Explain

## Background
워크플로 스킬 다섯 개는 플러그인 루트 산문을 `docs/install.md` 참조로 줄였고,
나머지 열한 개는 description을 3인칭으로 맞추며 `reviewer-prompt.md`를
`skills/review/assets/`로 옮겼다. 코드 주석 규칙은 `CLAUDE.md` 하드룰 9로
올렸고, 좋은/나쁜 주석 대비는 `skills/implementation/SKILL.md`에 둔다.
커밋 단위는 task 문서인데 커밋 의도(`commit_intent`)는 blueprint에 쓰라는
지침이 남아 있어 작성 위치가 어긋나 있었다. 이번 task는 의도를 task 문서에만
두고, finalize remainder도 번호가 가장 큰 유효 task intent를 읽게 바꿨다.

## Intuition
커밋 한 장의 배경·의도는 그 장을 만든 task 문서에만 적는다. 마감 remainder는
마지막 task의 의도 두 줄을 빌려 쓴다.

## Code
- `skills/bouncer-{init,plan,execute,commit,finalize}/SKILL.md` — 플러그인 루트
  산문 → `docs/install.md` 참조 (task 001)
- 워크플로 밖 스킬 11개 `SKILL.md` — description 3인칭; `reviewer-prompt.md` →
  `skills/review/assets/` (task 002)
- `CLAUDE.md` — 하드룰 9 Code comments; `skills/implementation/SKILL.md` —
  Bad/Good 주석 대비 (task 003)
- `scripts/src/lib/finalize.ts` (+ `scripts/lib/finalize.js`) — task 커밋은
  task `commit_intent`만; remainder는 taskUnits 스캔 후 최고 번호 유효 2줄
  (task 004)
- `skills/bouncer-{plan,commit,finalize}/SKILL.md`, `skills/spec-authoring`,
  `docs/PILOT.md`, `docs/contributing.md`, `.gitmessage` — blueprint
  `commit_intent` 출처 서술 제거 (task 004)
- `test/finalize-pure.test.js`, `test/finalize.test.js` — remainder·fixture
  계약 (task 004)

## Quiz
1. finalize remainder 커밋 본문의 배경·의도는 어디서 고르나?
   - A) blueprint `index.md`의 `bouncer.commit_intent` 2줄
   - B) 모든 task 문서의 유효 `commit_intent` 중 번호가 가장 큰 항목 2줄
   - C) 모든 task `commit_intent`를 이어 붙인 목록

2. task 커밋(`bouncer commit`)에서 task `commit_intent`가 없거나 무효일 때
   동작은?
   - A) 배경·의도 줄을 생략하고 제목·수정 내용만 남긴다
   - B) blueprint `commit_intent`로 폴백한다
   - C) 커밋을 거부하고 게이트를 실패시킨다

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
- (task 004) 문항 1 정답: B — 모든 task 문서의 유효 commit_intent 중 번호가 가장 큰 항목 2줄
  - 응답: C / 오답
- (task 004) 문항 2 정답: A — 배경·의도 줄을 생략하고 제목·수정 내용만 남긴다
  - 응답: B / 오답
- (task 004) quiz_score: 0/2
- (task 004) disposition: 퀴즈 2문항 0점. remainder는 최고 번호 task intent, task 커밋은 폴백 없이 생략임을 다시 확인함.
