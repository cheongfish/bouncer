---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/013-comprehension-gate/blueprints/001-explain-doc-contract/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-05T09:30:16.196+09:00'
bouncer:
  id: EXPLAIN-001
  epic_id: '013'
  blueprint_id: '001'
  status: published
  comprehension:
    diff_sha: 6a0eadaaacf4f262a746270ff880a3e6db9d0a0e6225d4ae3b877aa5cc7af4bc
    quiz_score: n/a
    disposition: accepted — contract and G15 gate match the brief; quiz flow deferred to BP-002
    recorded_at: '2026-08-05T09:30:22.033+09:00'
---
# Explain

## Background
마감 게이트가 검사하던 것은 BP `distill.md`의 `status == published` 하나였다.
본문이 비어 있어도, 회고가 실제 diff와 무관해도 통과했다. 사람이 변경을
이해했다는 기록이 저장소 어디에도 남지 않았고, 그 자리를 `bouncer.distill`과
`G9`가 이미 차지하고 있어 설명·이해 계약을 얹으려면 종류와 게이트를 함께
교체해야 했다. 이 커밋은 그 계약만 세운다 — 퀴즈 채점(002)·승격/PR
통합(003)은 다음이다.

## Intuition
회고 상태 토큰 하나 대신, 「다섯 섹션을 썼는가 + comprehension을 남겼는가 +
그 해시가 지금 base..HEAD와 같은가」를 게이트가 다시 계산해 판정한다.
`explain.md` 자신은 `.bouncer/context/`라 해시에 안 들어가서, 기록 문서를
커밋해도 값이 흔들리지 않는다.

## Code
- 종류·파일명: `schema.ts` (`bouncer.explain` / `EXPLAIN-`), `paths.ts`
  (`explain.md`), `templates.ts` 다섯 섹션 골격, `scaffoldExplain` +
  `cli` `scaffold explain`.
- 해시: `comprehension.ts`의 `computeDiffSha` — `DIFF_EXCLUDED_PREFIXES =
  ['.bouncer/context/']`, 실패는 던지지 않고 `no-base | not-a-repo |
  exec-failed`.
- 게이트: `validate.ts` finalize의 `G15` (G9 결번). 판정 순서 —
  문서 부재 → 섹션 미작성(G10과 같은 comment-strip 공란 규칙) → 기록 누락
  (`comprehension` 없음 / `disposition`·`diff_sha` 빈 문자열) → 계산 실패 →
  해시 불일치. `quiz_score`는 읽기만 하고 비교하지 않는다.
- base 해석: 포인터가 이 BP를 가리키면 포인터 `base`, 아니면
  `config.base_branch`, 그것도 없으면 `develop`.

## Quiz
1. 갓 scaffold한 `explain.md`가 finalize에서 어떤 G15 메시지로 실패하는가?
2. `diff_sha: ''` 이고 `disposition`만 채워진 경우, 불일치와 기록 누락 중
   어느 갈래인가?
3. `quiz_score: '1/5'`이어도 나머지가 갖춰지면 G15는 통과하는가?
4. `computeDiffSha`가 `ok: false`일 때 게이트는 통과로 바꿀 수 있는가?
5. `explain.md`를 커밋에 넣으면 `diff_sha`가 바뀌는가?

## 이해 상태
퀴즈는 002 채점 흐름 전이므로 `quiz_score: n/a`로 둔다. 계약·게이트·
제외 접두·실패 값 경로를 코드와 테스트로 확인했고 disposition은 accepted.
다음 BP 아이디어(사이클 한정, 승격하지 않음): finalize 스킬의 퀴즈 절차
본문, 프로젝트 Distill 승격 규칙과 PR 본문의 explain 연동은 002/003.
