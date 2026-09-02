---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/explain.md
tags:
  - bouncer
  - explain
timestamp: "2026-08-26T14:04:45.698+09:00"
bouncer:
  id: EXPLAIN-008
  epic_id: '004'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: a62266aef71db7520b214c14f2f28aaf6b74d46b
      diff_sha: "9ce149d77a1d401cf5141a6d23a3cf4c3c9fb2a3d808d6ceaa47c8aae731e472"
      quiz_score: "4/4"
      disposition: "문서-게이트 정합 다섯 결함을 질문으로 확인했고 전부 맞힘"
      recorded_at: "2026-08-26T14:09:12+09:00"
---

# Explain

## Background
plan 게이트는 `tasks/<NNN>/tasks.md`를 순회하는데 `/bouncer-plan` 절차는 `tasks/001`만 채우라고 했다. graphify는 init·graphify-runner가 CLI 전용이라 했는데 plan step 5는 config 손편집과 `pip install`을 안내했다. explain-diff는 `explain.md`가 없을 때 만들라는 문장과 멈추라는 문장을 나란히 뒀다. 경량 경로는 구현과 리뷰를 같은 세션 인라인으로 돌려 자기 diff를 자기 판정했다. 들여쓴 셸 펜스에서는 `BOUNCER_ROOT=` 줄만 컬럼 0에 남아 복사 경계를 헷갈리게 했다.

이 blueprint는 게이트·CLI 코드를 건드리지 않고 스킬·규칙 문서와 그걸 고정하는 테스트만 맞춰 다섯 결함을 닫았다.

## Intuition
문서가 말하는 절차를 게이트가 이미 하는 일과 같은 문장으로 맞춘다.

## Code
- `skills/bouncer-plan/SKILL.md` — step 4–6을 모든 `tasks/<NNN>/tasks.md` 순회로 바꾸고, graphify 활성화를 `bouncer init` / `bouncer init --promote-graphify`만 가리키게 함
- `test/skill-bouncer-plan.test.js` — 위 두 정책을 회귀 assert
- `skills/explain-diff/SKILL.md` — `(create the file if missing)` 제거, 부재 시 멈춤만 남김
- `test/skill-explain-diff.test.js` — 단일 부재 행동 회귀
- `skills/bouncer-execute/SKILL.md` step 5 — 경량 인라인 리뷰 분기 제거, named `bouncer-reviewer` 단일 경로
- `rules/governance.md` 규칙 4 — 인라인을 implementer로 한정, 구현 인라인의 self-review 한계로 다시 씀
- `test/skill-bouncer-execute.test.js`, `test/lightweight-cycle.test.js` — 경량 리뷰 정책·폴백 분리 assert
- 스킬 10개 셸 펜스 — 어긋난 `BOUNCER_ROOT=` 32줄을 다음 명령 들여쓰기에 맞춤 (명령 문자열은 불변)

## Quiz
1. `/bouncer-plan` step 4–6이 저작·주입·확정 대상으로 삼는 문서는?
   - A) blueprint 아래 모든 `tasks/<NNN>/tasks.md`
   - B) `tasks/001/tasks.md`만
   - C) epic `index.md`와 blueprint `index.md`만

2. graphify가 없을 때 plan이 사용자에게 안내하는 활성화 경로는?
   - A) `.bouncer/config.json`에 `graphify.enabled: true`를 직접 쓰기
   - B) `pip install graphifyy && graphify install` 후 config 손편집
   - C) `bouncer init` / `bouncer init --promote-graphify`

3. `explain.md`가 없을 때 `explain-diff`가 해야 할 일은?
   - A) 파일을 직접 만든 뒤 본문을 채운다
   - B) 멈추고 호출자에게 `scaffold explain`을 알린다
   - C) 퀴즈만 건너뛰고 comprehension을 빈 값으로 남긴다

4. `scale: light`일 때 execute step 5(리뷰)의 정책은?
   - A) review 스킬을 같은 세션에서 인라인으로 돌린다
   - B) 리뷰를 생략하고 `review.required: false`로 둔다
   - C) scale과 무관하게 named `bouncer-reviewer` 디스패치를 탄다 (호스트 미지원 폴백만 별도)

## 이해 상태
퀴즈 4/4. 응답 A C B C.
정답: (1) A 모든 tasks/<NNN>/tasks.md 순회 (2) C bouncer init / --promote-graphify (3) B 멈추고 scaffold 안내 (4) C named bouncer-reviewer 단일 경로.
disposition: 문서-게이트 정합 다섯 결함을 질문으로 확인했고 전부 맞힘.
