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

---
# Explain

## Background
워크플로 스킬 다섯 개가 플러그인 루트 해석 문단을 각자 복제해 두고 있었고,
그 내용은 `docs/install.md` 「플러그인 루트」와 겹쳤다. description도
스킬마다 2인칭·3인칭이 섞여 있어 anatomy 기준과 어긋났다. 이번 task는
산문을 설치 문서 한 줄 참조로 바꾸고 description을 3인칭으로 맞춘다.
셸 블록의 `BOUNCER_ROOT=` 대입은 블록마다 새 셸이 뜨므로 실행 조건이라
그대로 둔다.

## Intuition
설명은 `docs/install.md`로 보내고, 매 셸에 필요한 대입 줄만 스킬에 남긴다.

## Code
- `skills/bouncer-{init,plan,execute,commit,finalize}/SKILL.md` — 플러그인 루트
  산문 → `docs/install.md` 「플러그인 루트」 한 줄, description 3인칭화
- `test/skill-bouncer-surface.test.js`, `test/skill-bouncer-commit.test.js` —
  description 단정을 `This skill should be used only when…` 형태로 맞춤
- 셸 블록의 `BOUNCER_ROOT=` 대입과 `Master rules` / `CLAUDE.md` 토큰은 유지

## Quiz
1. 워크플로 스킬에서 플러그인 루트 해석 산문을 줄인 뒤, 셸 블록의
   `BOUNCER_ROOT=` 대입은 어떻게 되나?
   - A) 대입도 지우고 `docs/install.md`만 본다
   - B) 대입은 각 셸 블록에 그대로 남긴다
   - C) 대입은 스킬 맨 위에서 한 번만 export한다

2. 이번 task가 맞춘 description 형태는?
   - A) `Use only when the user explicitly asks…` (2인칭 명령형)
   - B) YAML `description`에 `##` 제목을 넣어 섹션을 표시한다
   - C) `This skill should be used only when the user explicitly asks…` (3인칭)

## 이해 상태
- 문항 1 정답: B — 대입은 각 셸 블록에 그대로 남긴다
  - 응답: B / 정답
- 문항 2 정답: C —  (3인칭)
  - 응답: C / 정답
- quiz_score: 2/2
- disposition: 퀴즈 2문항 만점. 셸 BOUNCER_ROOT 대입 유지와 3인칭 description을 확인함.
