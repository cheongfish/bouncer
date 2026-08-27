---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/054-skill-context-optimization/blueprints/002-agent-rubric-ssot/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T10:29:27.884+09:00'
bouncer:
  id: EXPLAIN-002
  epic_id: '054'
  blueprint_id: '002'
  status: published
  comprehension:
    - range_from: develop
      range_to: b30eb3e6844c79f268327716bdfb1cba076271eb
      diff_sha: 39b12a2d8522326a378ae8fe53c9cceb840f18ed20f6913ebbde94b5d391cbcd
      quiz_score: '4/4'
      disposition: 네 문항 모두 정답. 비용의 정의(총 바이트가 아니라 정상 경로 주입량), 주석 루브릭을 남긴 근거(Distill Decision과 기존 단언), R-1의 실패 유형(문장 소실 + 단언 무력화), 디스패치 소유 스킬이 review 하나뿐이라는 사실을 모두 짚음. 마지막 항목은 실행 중 계획 전제가 틀렸다고 판명된 지점이라 특히 중요하다.
      recorded_at: '2026-08-27T10:31:48+09:00'
---
# Explain

## Background
네 역할(구현·리뷰·디버깅·컨텍스트 리뷰)이 같은 절차와 guardrail을 보조 스킬과 named agent 문서에 두 벌로 들고 있었다. 문제는 분량이 아니라 순서였다. named agent가 실제로 일하는 정상 경로에서도 컨트롤러가 agent를 부르기 **직전에** agent가 쓸 상세 rubric을 먼저 읽었다. `review`가 가장 극단적이어서, 스킬 Step 3이 `agents/bouncer-reviewer.md`의 판정 절 네 개를 통째로 복제하고 있었다.

두 벌 보유는 주입량만 늘리는 게 아니라 규칙이 서로 달라질 자리를 상시로 열어 둔다. 이 blueprint는 상세 rubric의 정본을 `agents/*.md` 한 곳으로 모으고, 스킬에는 그 역할이 실제로 소유한 것만 남긴다.

## Intuition
지배인이 손님을 문지기에게 넘기기 전에 문지기의 매뉴얼을 통독하던 것을 그만둔 것이다. 매뉴얼은 문지기가 들고 있으면 된다. 지배인에게 필요한 건 누구를 부르고, 무엇을 넘기고, 어떤 답을 받고, 몇 번까지 다시 부를 수 있는가뿐이다.

다만 매뉴얼을 옮긴다고 전부 옮기는 것은 아니다. 스킬 쪽에만 자리가 있는 문서가 둘 남았다.

## Code
- `skills/{implementation,review,debugging,context-review}/SKILL.md` — 각 역할이 실제로 소유한 것만 남았다. 네 스킬 합계 3416 → 2263단어.
- `agents/bouncer-{implementer,reviewer,debugger,context-reviewer}.md` — 상세 rubric의 정본. 2152 → 2696단어.
- 스킬에 남긴 고유 정본 둘:
  - `skills/implementation/SKILL.md`의 `## Detailed comments` — hard rule 9 상세와 `scripts/lib/validate.js` Bad/Good 예시. `test/agents.test.js`가 agent 쪽에 이 문구가 **없어야** 한다고 이미 단정한다.
  - `skills/context-review/SKILL.md`의 `## When this applies` full-plan 게이트 — `scale: light`에는 이 루브릭도 G18도 없다는 규정이라 게이트 판정에 직결된다.
- `test/agents.test.js` — 네 커밋이 모두 이 파일을 건드린다. 스킬에서 빠지는 단언이 여기로 와야 각 커밋이 독립적으로 green이다. 이동 테스트는 「agent에 있다」 + 「스킬에 없다」 쌍으로 적었다.
- 네 서브스킬 중 디스패치 절차를 가진 것은 `skills/review/SKILL.md` 하나뿐이다. 나머지 셋의 디스패치와 fallback은 `skills/bouncer-{execute,plan}/SKILL.md`에 있고 blueprint 003 소관이다.

## Quiz

**Q1.** 이 blueprint가 줄이려던 비용은 무엇인가?
- (a) 저장소에 있는 지시문 문서의 총 바이트 수
- (b) named agent가 일하는 정상 경로에서 컨트롤러가 미리 읽는 양
- (c) 세션 시작 시 주입되는 스킬 목록의 description 합계

**Q2.** `skills/implementation/SKILL.md`의 주석 루브릭을 `agents/bouncer-implementer.md`로 옮기지 않은 이유는?
- (a) 분량이 커서 agent 문서의 크기 예산을 넘기 때문
- (b) `rules/skill-shape.md`가 스킬에 그 절을 두라고 요구하기 때문
- (c) Distill Decision이 그 위치를 정본으로 지정했고 `test/agents.test.js`가 agent 쪽 부재를 단정하기 때문

**Q3.** task 001 리뷰에서 잡힌 major finding(R-1)의 실패 유형은?
- (a) 옮긴 문장이 스킬과 agent 양쪽에 남아 중복이 됐다
- (b) 문장 하나가 이동 중 사라졌고, 그것을 지키던 단언이 대상 파일의 무관한 문구에 걸려 무력해졌다
- (c) agent 문서의 절 순서가 `rules/skill-shape.md`를 위반했다

**Q4.** 네 서브스킬 중 디스패치 절차를 본문에 가진 것은?
- (a) `review` 하나뿐이다
- (b) `implementation`과 `debugging` 둘이다
- (c) 넷 모두 가지고 있다

## 이해 상태
4문항 출제, 4문항 응답, 4문항 정답 (`4/4`).

- **Q1** 정답 (b) 정상 경로에서 컨트롤러가 미리 읽는 양 — 응답 (b), 정답. 이 epic의 판정 기준이 총 바이트가 아니라는 점이 요지다. 실제로 스킬 넷은 1153단어 줄었지만 agent 넷은 544단어 늘었다.
- **Q2** 정답 (c) Distill Decision이 정본으로 지정했고 `test/agents.test.js`가 agent 쪽 부재를 단정 — 응답 (c), 정답. 이 제약이 blueprint Contract의 「여섯 항목만 남긴다」를 그대로 쓸 수 없게 만든 충돌 둘 중 하나였다.
- **Q3** 정답 (b) 문장이 이동 중 사라지고 그것을 지키던 단언도 무력해짐 — 응답 (b), 정답. 「사다리가 승인된 checklist 항목을 버리라고 하면 계획으로 에스컬레이션한다」가 두 파일 어디에도 없었고, 옮겨간 `/escalat|plann?ing/i`가 agent의 무관한 `Needs planning`에 걸려 사다리를 통째로 지워도 통과하는 상태였다.
- **Q4** 정답 (a) `review` 하나뿐 — 응답 (a), 정답. 계획 단계에서는 네 스킬이 균일하게 여섯 항목 호출 계약을 갖는다고 전제했으나, 컨텍스트 리뷰 CR-2가 그 전제를 깼다. 나머지 셋은 컨트롤러가 아니라 진입 스킬이 쓰는 브리프다.

disposition: 마감을 막지 않는다. 기록 목적이다.
