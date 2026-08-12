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

---
# Explain

## Background
워크플로 스킬 다섯 개는 플러그인 루트 산문을 `docs/install.md` 한 줄 참조로
줄였고, description을 3인칭으로 맞췄다. 나머지 스킬 열한 개는 설명 어조만
제각각이었고, 리뷰어 호출 템플릿이 `skills/review/` 루트에 있어 anatomy
(`SKILL.md`만 루트, 채울 템플릿은 `assets/`)와 어긋났다. 이번 task는 그
열한 개 description을 3인칭으로 맞추고 `reviewer-prompt.md`를 `assets/`로
옮긴다.

## Intuition
스킬 루트에는 `SKILL.md`만 두고, 채워서 넘기는 템플릿은 `assets/`에 둔다.
설명 문장은 `This skill should be used…` 형태로 통일한다.

## Code
- `skills/bouncer-{init,plan,execute,commit,finalize}/SKILL.md` — 플러그인 루트
  산문 → `docs/install.md` 참조, description 3인칭 (task 001)
- 워크플로 밖 스킬 11개 `SKILL.md` — description만 3인칭으로 변경
- `skills/review/reviewer-prompt.md` → `skills/review/assets/reviewer-prompt.md`
  (`git mv`), 링크는 `skills/review/SKILL.md`, `skills/bouncer-execute/SKILL.md`,
  `agents/bouncer-reviewer.md`, 관련 테스트에서 갱신

## Quiz
1. `reviewer-prompt.md`는 어디로 옮겼나?
   - A) `skills/review/templates/reviewer-prompt.md`
   - B) `skills/review/assets/reviewer-prompt.md`
   - C) `skills/review/references/reviewer-prompt.md`

2. 이번 task가 맞춘 description 어조는?
   - A) `This skill should be used when/during/from…` (3인칭)
   - B) `Use when…` 명령형을 유지하고 발동 조건만 늘린다
   - C) YAML `description`에 따옴표 없이 `##`를 넣어 섹션을 표시한다

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
