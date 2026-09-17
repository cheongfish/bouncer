---
type: bouncer.explain
title: 002 explain
description: Explain for 002
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/005-agent-rubric-ssot/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-27T10:29:27.884+09:00'
bouncer:
  id: EXPLAIN-005
  epic_id: '043'
  blueprint_id: '005'
  status: published
  comprehension:
    - range_from: develop
      range_to: b30eb3e6844c79f268327716bdfb1cba076271eb
      diff_sha: 39b12a2d8522326a378ae8fe53c9cceb840f18ed20f6913ebbde94b5d391cbcd
      quiz_score: 4/4
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

## Tasks

### Task 001

#### Goal & intent

`skills/implementation/SKILL.md`를 읽어도 최소성 사다리·focused change·tests first·guardrail 전문이 더는 나오지 않고, 그 문장들은 `agents/bouncer-implementer.md` 한 곳에만 있다. 스킬에는 호출 계약 여섯 항목과, 이 스킬이 유일하게 소유한 주석 루브릭만 남는다. 주석 루브릭이 남는 것은 예외가 아니라 계약이다 — Distill Decision이 그 위치를 정본으로 지정했고, `test/agents.test.js`가 agent 쪽에 그 문장이 **없어야** 한다고 이미 단정한다.

#### Interface

- 제공:
  - `skills/implementation/SKILL.md` — `## When this applies`, `## Steps`(브리프 권위와 반환 계약), `## Detailed comments`(기존 Step 4 본문을 그대로 승격), `## Guardrails`(호출 측 규율만), `## Return`. 이 스킬에는 디스패치 절차가 없다 — `/bouncer-execute`가 가진다.
  - `agents/bouncer-implementer.md` — `## Procedure`가 사다리 여섯 단, focused change, tests first를 스킬에서 옮겨받아 완전한 문장으로 보유. `## Guardrails`가 「불필요한 추상화 금지」·「never simplify away」 목록을 보유.
  - `test/agents.test.js` — 옮겨간 단언(사다리 각 단, tests-first 근거)을 agent 문서 대상으로 추가.
- 거부:
  - 주석 루브릭·docstring 4부 계약·`scripts/lib/validate.js` Bad/Good 예시를 `agents/`로 옮기는 것. `test/agents.test.js`의 `known ceilings`·`Prefer thoroughness` 부재 단언이 그것을 금지한다.
  - 각 규율의 의미 변경. 문장이 어디 있는지만 바꾼다.
  - 사다리 테스트 케이스를 이름만 남기고 비우는 것. 빈 테스트는 통과하므로 계약 소실을 감춘다.
  - `rules/skill-shape.md`가 요구하는 절 이름과 순서의 변경.

#### Touch

- Modify `skills/implementation/SKILL.md` — `## Steps`를 호출 계약 여섯 항목으로 다시 쓰고, 현재 Step 4(Detailed comments) 본문을 `## Steps` 뒤의 도메인 H2 `## Detailed comments`로 승격한다. Steps 1·2·3·5·6과 중복 guardrail을 삭제한다.
- Modify `agents/bouncer-implementer.md` — `## Procedure`의 축약된 사다리를 스킬에서 옮겨온 여섯 단 전문으로 바꾸고, `## Guardrails`에 옮겨온 항목을 더한다. Procedure 3단계의 주석 규칙 포인터는 그대로 둔다.
- Modify `test/skill-implementation.test.js` — `test('implementation climbs a minimality ladder before writing code')` 케이스를 **케이스째로** 삭제한다(단언만 지우면 이름이 남은 빈 테스트가 통과해 계약이 사라진 것을 감춘다). 주석 루브릭을 다루는 두 케이스는 `const step = md.match(...)` 줄까지 포함해 통째로 남긴다. 스킬이 브리프 권위와 반환 계약만 남았음을 단정하는 케이스를 더한다.
- Modify `test/agents.test.js` — 삭제한 사다리 단언을 `agents/bouncer-implementer.md` 대상으로 옮겨 넣는다.

#### Constraints

- 옮기는 문장은 **복사가 아니라 이동**이다. 옮긴 뒤 원본에 같은 문장이 남아 있으면 이 task는 실패다.
- 규율의 의미를 다듬지 않는다. 표현을 고쳐야 할 이유가 보이면 그것은 `/bouncer-plan` 에스컬레이션 신호다.
- `## Steps`라는 절 이름을 유지한다. 내용이 호출 계약이 되는 것이지 절이 사라지는 것이 아니다.
- agent 문서 본문 제목은 영어다. `test/agents.test.js`가 한글 제목을 거부한다.
- 스킬 본문 산문은 영어를 유지한다. 이 문서군은 한국어 대상(`.bouncer/context/epics/**`)이 아니다.

### Task 002

#### Goal & intent

`skills/review/SKILL.md` Step 3에 통째로 들어 있던 판정 루브릭 네 절(Spec compliance, Code quality, Over-engineering, Calibration)이 `agents/bouncer-reviewer.md`에만 남는다. 컨트롤러는 agent를 부르기만 하는데 agent가 쓸 기준 전문을 먼저 읽고 있었다. 네 서브스킬 중 디스패치 절차를 가진 것은 이 스킬 하나뿐이라, 호출 계약이 온전히 남는 유일한 자리이기도 하다. 스킬에는 `## Findings` 필드 계약, 디스패치 네 단계, 컨트롤러 소유권만 남는다. 셋 다 호출 계약 (b)·(c)·(f) 항목이다.

#### Interface

- 제공:
  - `skills/review/SKILL.md` — `## Steps`가 Load(브리프와 diff 기준), Findings 필드 계약, `bouncer-reviewer` 디스패치 네 단계, Assert 넷으로만 구성된다. 루브릭 본문은 없고 `agents/bouncer-reviewer.md`를 가리킨다.
  - `agents/bouncer-reviewer.md` — 기존 `## Rubric —` 세 절과 `## Calibration`이 스킬에서 옮겨온 문장(Constraint breach의 Do not touch 대비 설명, 「rejects」 규정, 「Severity is a label, not a filter」)을 흡수해 완전한 정본이 된다.
  - `test/agents.test.js` — 옮겨간 루브릭 단언을 agent 문서 대상으로 추가.
- 거부:
  - `skills/review/assets/reviewer-prompt.md`의 이동·삭제. Distill이 그 경로를 못박았고, 호출 브리프 슬롯으로서 루브릭 요약을 계속 보유한다.
  - 디스패치 네 단계와 `resolveSubagentModel`·`inherit` fallback 문구의 삭제. 호출 계약 (a)·(e)이며 model 해석 자체의 재배치는 blueprint 004 소관이다.
  - `## Findings` 필드 계약(severity·status·accepted note)의 이동. G14 판정 계약이라 호출 측에 남는다.

#### Touch

- Modify `skills/review/SKILL.md` — Step 3에서 `### Spec compliance`·`### Code quality`·`### Over-engineering`·`### Calibration` 네 소절을 삭제하고, 그 자리에 판정 기준이 `agents/bouncer-reviewer.md`에 있다는 한 줄을 넣는다. Load·Contract·디스패치 네 단계·Assert는 남긴다.
- Modify `agents/bouncer-reviewer.md` — 스킬에만 있던 문장을 대응 `## Rubric —` 절과 `## Calibration`에 흡수한다. 특히 Calibration 첫 문단(「label, not a filter」와 보고 누락 금지)을 옮긴다.
- Modify `test/skill-review.test.js` — 루브릭 단언 중 스킬 `md`를 대상으로 하는 것만 삭제한다. `reviewerPrompt` 대상 단언과 디스패치 단언은 그대로 둔다. **`test('review rubric flags behavior changes that ship without tests')`를 빠뜨리지 않는다** — 그 케이스는 `[md, reviewerPrompt, agent]`를 순회하며 「without a test」를 단정하고, 그 아래 `assert.match(md, /docs-only|…/)`를 따로 단정한다. 두 문장 모두 이 task가 지우는 블록에만 있으므로, 순회 목록에서 `md`를 빼고 `docs-only` 단언은 `agent` 대상으로 옮긴다.
- Modify `test/agents.test.js` — 삭제한 루브릭 단언을 `agents/bouncer-reviewer.md` 대상으로 옮겨 넣는다.

#### Constraints

- 복사가 아니라 이동이다. 스킬에서 지운 문장이 agent에 그대로 있어야 하고, 양쪽에 동시에 있으면 안 된다.
- `test/skill-review.test.js`의 `reviewerPrompt` 대상 단언은 건드리지 않는다. 그 파일을 안 만지므로 단언도 그대로 통과해야 한다.
- 심각도 어휘(`blocker`/`major`/`minor`/`nit`)와 각 정의 문장을 다듬지 않는다.
- agent 문서 본문 제목은 영어다.
- 스킬 본문 산문은 영어를 유지한다.

### Task 003

#### Goal & intent

Root cause → Pattern → Hypothesis → Implementation 네 단계의 Output과 Gate 본문이 `agents/bouncer-debugger.md`에만 남는다. `skills/debugging/SKILL.md`에는 호출 계약과 재호출 상한만 남는다. 상한 문장은 옮기지 않는다 — 호출 계약 (d)항목이고, `test/skill-debugging.test.js`의 동기화 테스트가 `skills/bouncer-execute`·`skills/debugging`·`agents/bouncer-debugger`·`skills/bouncer-run` 네 문서 모두에 `**1**` 표기를 요구한다.

#### Interface

- 제공:
  - `skills/debugging/SKILL.md` — `## Steps`가 4단계 이름, 읽을 필드(debugger Output contract 다섯 항목의 이름), 컨트롤러가 implementer를 재호출한다는 규칙으로만 구성되고, `## Guardrails`에 재호출 상한 `**1**`이 남는다. 각 단계의 Output·Gate 본문은 없다. 이 스킬에는 디스패치 절차도 fallback 분기도 없다 — 둘 다 `/bouncer-execute`가 가지며 blueprint 003 소관이다. 없는 항목을 이 task에서 새로 쓰지 않는다.
  - `agents/bouncer-debugger.md` — `## Procedure`가 스킬에서 옮겨온 각 단계의 Output과 Gate 문장(특히 「Do not propose fixes before root-cause investigation」과 단일 가설 강제)을 흡수한다.
  - `test/agents.test.js` — 옮겨간 Gate 단언을 agent 문서 대상으로 추가.
- 거부:
  - 재호출 상한 `**1**` 표기의 삭제. 네 문서 동기화 테스트가 깨진다.
  - `agents/bouncer-debugger.md`의 `## Procedure` 서두에 있는 `skills/debugging/SKILL.md` 참조를 남겨 두는 것. 정본이 agent로 오면 그 포인터는 순환이 되므로 지운다.
  - 상한 숫자의 변경. epic 046이 정한 값이다.

#### Touch

- Modify `skills/debugging/SKILL.md` — `## Steps`의 네 소절에서 `**Output:**`·`**Gate:**` 본문을 삭제하고 단계 이름과 agent 정본 포인터만 남긴다. `## Guardrails`에서 agent로 옮긴 항목을 지우고 재호출 상한 항목은 남긴다.
- Modify `agents/bouncer-debugger.md` — `## Procedure` 네 단계에 스킬의 Output·Gate 문장을 흡수하고, 서두의 `skills/debugging/SKILL.md` 참조 문장을 지운다.
- Modify `test/skill-debugging.test.js` — `test('debugging forbids proposing fixes before root-cause investigation')` 케이스를 **케이스째로** 삭제한다(그 단언 하나가 케이스의 전부라, 단언만 지우면 빈 테스트가 남는다). 4단계 이름 단언과 상한 동기화 테스트는 그대로 둔다.
- Modify `test/agents.test.js` — 삭제한 Gate 단언을 `agents/bouncer-debugger.md` 대상으로 옮겨 넣는다.

#### Constraints

- 복사가 아니라 이동이다.
- 재호출 상한 문장은 `skills/debugging/SKILL.md`에 남긴다. 이 task가 그 문장을 지우면 `test/skill-debugging.test.js`의 네 문서 동기화 테스트가 즉시 실패한다.
- 4단계의 이름과 순서를 바꾸지 않는다. 다른 문서들이 그 이름으로 이 절차를 가리킨다.
- agent 문서 본문 제목은 영어다.
- 스킬 본문 산문은 영어를 유지한다.

### Task 004

#### Goal & intent

Cross-document contradiction·Scope review·Korean quality·Verifiability 네 판정 scope의 본문과 심각도 기준이 `agents/bouncer-context-reviewer.md`에만 남는다. `skills/context-review/SKILL.md`에는 호출 계약과, 이 스킬이 유일하게 소유한 `## When this applies` full-plan 게이트, 그리고 `## Findings` 필드 계약이 남는다. 게이트 문구를 남기는 근거는 `test/skill-context-review.test.js`가 `Full plans only`·`bouncer.scale`·`light`·`G18`·`no light variant`를 이 스킬 대상으로 단정한다는 것이다. `scale: light`에는 이 루브릭도 G18도 없다는 규정이라 G18 판정에 직결된다.

#### Interface

- 제공:
  - `skills/context-review/SKILL.md` — `## When this applies`의 full-plan 게이트 전문이 그대로 남고, `## Steps`는 Load, `## Findings` 필드 계약, 네 scope 이름, 컨트롤러 소유권으로만 구성된다. 판정 본문은 agent를 가리킨다. 이 스킬에는 디스패치 절차도 fallback 분기도 없다 — 둘 다 `/bouncer-plan`이 가지며 blueprint 003 소관이다. 없는 항목을 이 task에서 새로 쓰지 않는다.
  - `agents/bouncer-context-reviewer.md` — `## Rubric — four scopes`가 스킬에서 옮겨온 각 scope의 판정 문장(Mermaid zoom 규정, `scope_evidence` 부재는 상태이지 실패가 아니라는 규정, 판정 제외 OKF 목록)을 흡수한다.
  - `test/agents.test.js` — 옮겨간 scope 단언을 agent 문서 대상으로 추가.
- 거부:
  - `## When this applies`의 full-plan 게이트 문구 이동. `test/skill-context-review.test.js`가 `Full plans only`·`bouncer.scale`·`light`·`G18`·`no light variant`를 스킬 대상으로 단정한다.
  - `## Findings` 필드 계약(id·severity·status·accepted note)의 이동. G18 판정 계약이라 호출 측에 남는다.
  - 「light에 대체 판정을 두지 않는다」 규정의 완화.

#### Touch

- Modify `skills/context-review/SKILL.md` — Step 3의 `### Cross-document contradiction`·`### Scope review`·`### Korean quality`·`### Verifiability of success criteria` 본문과 심각도 매핑을 삭제하고 agent 정본 포인터로 바꾼다. `## When this applies`와 Step 2의 Findings 계약은 그대로 둔다.
- Modify `agents/bouncer-context-reviewer.md` — `## Rubric — four scopes`에 옮겨온 판정 문장을 흡수하고, 그 절 서두의 `Follow` + `skills/context-review/SKILL.md` 참조 문장을 지운다(정본이 이쪽으로 오면 순환 포인터가 된다 — task 003이 debugger에 하는 것과 같다). `## Calibration`은 이미 있는 정의를 유지한다.
- Modify `test/skill-context-review.test.js` — `test('context-review covers the four judgment scopes')` 케이스를 **케이스째로** 삭제하고(그 단언들이 케이스의 전부다), OKF 판정 제외와 Mermaid 단언도 함께 옮긴다. full-plan 게이트 케이스와 Findings 계약 케이스는 그대로 둔다.
- Modify `test/agents.test.js` — 삭제한 scope 단언을 `agents/bouncer-context-reviewer.md` 대상으로 옮겨 넣는다.

#### Constraints

- 복사가 아니라 이동이다.
- `## When this applies`의 full-plan 게이트는 한 문장도 줄이지 않는다. 이 절이 이 스킬의 고유 정본이다.
- 네 scope의 이름과 순서를 바꾸지 않는다. 다른 문서와 테스트가 그 이름으로 가리킨다.
- Mermaid 판정이 다섯 번째 scope가 아니라 Cross-document의 하위 항목이라는 규정을 유지한다.
- agent 문서 본문 제목은 영어다.
- 스킬 본문 산문은 영어를 유지한다.
