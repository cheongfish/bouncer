---
type: bouncer.explain
title: 005 explain
description: Explain for 005
resource: .bouncer/context/epics/043-bouncer-cost-improvement/blueprints/008-description-budget-lock/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-28T11:00:00.711+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '043'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: 2c3589b3c053c2e9806ca6823a0e2bea1cb0dfea
      diff_sha: 078549c2d6016e3baaaa29949e62f60814e1f973d1ef7518c1d555be4a1b72bb
      quiz_score: 2/4
      disposition: 길이 측정과 품질 방향은 맞혔고, 총합 상한의 사람 결정과 최종 출처 `.final.metrics.json`은 틀렸다.
      recorded_at: '2026-08-28T11:03:10+09:00'
---
# Explain

## Background
스킬 목록 `description`에 같은 상투 문장이 반복되어 합계가 6,090자까지 커졌다. 앞 단계에서 역할 rubric과 조건부 절차를 옮긴 뒤에도, 정본 19개와 3,000자 예산이 테스트 없이 문서에만 있으면 다음 변경이 조용히 되돌릴 수 있다. 이 브랜치는 19개 description을 핵심 트리거가 앞에 오는 100~180자 한 문장으로 줄이고, 개수·길이·총합·역할 rubric 역류를 `test/skill-bouncer-surface.test.js`에 잠근 다음, 006과 같은 일곱 시나리오의 `.final.*` 산출물을 `docs/benchmark/history.md` 지시문 비용 표의 baseline 다음에 붙였다.

## Intuition
목록 문구는 짧게 고치고, 그 한도와 최종 측정값은 사람이 기억하지 않고 테스트와 표가 막는다.

## Code
- `skills/*/SKILL.md` frontmatter `description`만 바꿨다. 길이는 `description:` 접두어를 뺀 YAML 원문 scalar다.
- `test/skill-bouncer-surface.test.js`가 정본 19개, 개별 100~180자, 총합 3,000, 네 역할의 rubric 문구 금지를 단정한다. 상한을 올리려면 사람이 상수를 바꿔야 한다.
- `docs/benchmark/history.md` `## 지시문 비용 회차`는 baseline 7행 다음이 최종 7행이다. 출처는 `.benchmarks/<id>.final.metrics.json`이고, 품질 숫자는 짝 `.final.manifest.json`의 `gates`·`review_findings`·`scope_violations`다.
- `test/benchmark-context-cost.test.js`는 표에서 두 회차를 읽어 열과 품질 방향(통과율 ≥, finding ≤, scope ≤)을 비교한다. 측정값을 코드 상수로 복제하지 않는다.

## Quiz
1. 개별 description 길이와 총합은 무엇으로 재는가?
   - A) `parseFrontmatter(...).data.description.length`
   - B) `description:` 접두어만 제거한 YAML 원문 scalar(인용부호 포함)
   - C) 렌더된 본문 첫 문단의 글자 수

2. 스킬이 하나 늘면 description 총합 상한 3,000은 어떻게 되는가?
   - A) 테스트가 스킬 수에 비례해 상한을 올린다
   - B) CI가 자동으로 예산을 재계산한다
   - C) 고정값이라 올릴지는 사람이 계약을 보고 정한다

3. 지시문 비용 최종 행의 산출물 경로는 무엇인가?
   - A) `.benchmarks/<id>.final.metrics.json`
   - B) `.benchmarks/<id>.recovery.metrics.json`
   - C) s5–s7의 접미사 없는 `.metrics.json`

4. history 표에서 최종 회차 품질이 통과하려면 scenario별로 무엇이 성립해야 하는가?
   - A) tokens_in과 wall_s가 baseline보다 작다
   - B) gate 통과율 ≥, review finding 수 ≤, scope 위반 수 ≤
   - C) 일곱 시나리오 합산 tokens가 줄면 품질 세 값은 무시한다

## 이해 상태
정답: 1B, 2C, 3A, 4B

응답: 1B, 2B, 3B, 4B

결과: 2/4. description 길이의 YAML 원문 scalar 기준과 품질 세 값의 방향은 맞혔다. 총합 3,000은 스킬 수 함수가 아니라 사람이 올리는 고정값이고, 최종 행 출처는 `.recovery.*`가 아니라 `.final.metrics.json`이다.

## Tasks

### Task 001

#### Goal & intent

19개 `skills/*/SKILL.md`의 `description`이 핵심 트리거를 첫 절에 둔 100~180자 한 문장이 된다. 길이는 baseline `awk`와 같은 YAML 원문 scalar 기준이다. workflow의 명시 호출 전용 계약, 내부 스킬의 Bouncer 흐름·직접 요청 계약, `agentic-code-benchmark`의 일반 암묵 호출 가능성은 유지하며 `npm run ci`가 통과해야 한다.

#### Interface

- 제공:
  - workflow 여섯 개는 `/<skill-name>` 직접 요청에서만 선택된다는 조건과 핵심 산출물을 한 문장에 둔다.
  - 내부 스킬 열두 개는 어떤 Bouncer 단계에서 쓰는지 또는 어떤 사용자 요청에 직접 반응하는지를 첫 절에 둔다.
  - `agentic-code-benchmark`는 Bouncer 내부 전용이나 명시 호출 전용으로 바꾸지 않고 비교·채점 요청의 암묵 매칭 단서를 유지한다.
- 거부:
  - `name`이나 `description`을 비우거나 스킬 디렉터리를 비공개 reference로 전환하지 않는다.
  - description에 세부 절차, gate 번호, rubric 전문을 다시 싣지 않는다.
  - 본문 절차와 `CLAUDE.md`의 호출 표를 description 축약에 맞춘다는 이유로 바꾸지 않는다.

#### Touch

- Modify `skills/agentic-code-benchmark/SKILL.md` — 비교·채점 트리거를 앞에 둔 일반 호출 description으로 축약한다.
- Modify `skills/bouncer-init/SKILL.md` — `/bouncer-init` 명시 호출 조건과 bootstrap 결과만 남긴다.
- Modify `skills/bouncer-plan/SKILL.md` — `/bouncer-plan` 명시 호출 조건과 계획 산출물만 남긴다.
- Modify `skills/bouncer-execute/SKILL.md` — `/bouncer-execute` 명시 호출 조건과 단일 task 실행 범위만 남긴다.
- Modify `skills/bouncer-commit/SKILL.md` — `/bouncer-commit` 명시 호출 조건과 active task commit 범위만 남긴다.
- Modify `skills/bouncer-finalize/SKILL.md` — `/bouncer-finalize` 명시 호출 조건과 blueprint 마감 범위만 남긴다.
- Modify `skills/bouncer-run/SKILL.md` — `/bouncer-run` 명시 호출 조건과 남은 task 반복 범위만 남긴다.
- Modify `skills/discovery/SKILL.md` — 변경 요청 framing 트리거와 plan 내부·직접 요청 경계를 축약한다.
- Modify `skills/spec-authoring/SKILL.md` — 계획 본문·Distill 저술 트리거와 body-only 권한을 축약한다.
- Modify `skills/implementation/SKILL.md` — 승인 task 구현 트리거와 affected scope 경계를 축약한다.
- Modify `skills/verification/SKILL.md` — verify 결과 조사 트리거와 evidence 비소유권을 축약한다.
- Modify `skills/review/SKILL.md` — task brief 대비 diff 판정 트리거와 Findings-only 결과를 축약한다.
- Modify `skills/minimality/SKILL.md` — plan·review 최소성 점검 트리거와 advisory 경계를 축약한다.
- Modify `skills/debugging/SKILL.md` — verify 실패·예상 밖 동작 트리거와 root-cause 우선 경계를 축약한다.
- Modify `skills/graphify-runner/SKILL.md` — plan 경로 후보 생성 트리거와 advisory 범위를 축약한다.
- Modify `skills/context-review/SKILL.md` — full plan 판정 트리거와 Findings-only 권한을 축약한다.
- Modify `skills/explain-diff/SKILL.md` — finalize 내부 explain·quiz 트리거와 비진입점 경계를 축약한다.
- Modify `skills/stop-slop/SKILL.md` — 한국어 Bouncer 문서 교정 트리거와 advisory 경계를 축약한다.
- Modify `skills/migrate-ids/SKILL.md` — legacy id migration 트리거와 확인 후 적용 경계를 축약한다.
- Modify `test/skill-bouncer-surface.test.js` — workflow 여섯 개의 새 짧은 명시 호출 계약을 단정한다.
- Modify `test/skill-bouncer-commit.test.js` — commit description 단언을 새 호출 문구에 맞춘다.
- Modify `test/skill-bouncer-run.test.js` — run description 단언을 새 호출 문구에 맞춘다.
- Modify `test/skill-context-review.test.js` — context-review의 plan 내부·직접 요청 계약을 새 문구로 단정한다.

#### Constraints

- 각 description은 영어 한 문장, YAML 인용부호를 포함한 원문 scalar 기준 100~180자이며 핵심 트리거를 첫 절에 둔다.
- `skills/*/SKILL.md`에서는 frontmatter의 `description` 한 줄만 바꾸고 아래 본문은 수정하지 않는다.
- workflow 여섯 개는 명시 호출 전용이다. 내부 스킬의 사용자 직접 요청 예외와 `agentic-code-benchmark`의 암묵 호출 가능성을 보존한다.
- 스킬 이름, 공개 경로, 본문 절차, gate 계약을 바꾸지 않는다.
- 새 dependency·helper·설정 키를 만들지 않는다.

### Task 002

#### Goal & intent

새 계약 테스트가 `skills/*/SKILL.md` 정본 19개와 YAML 원문 scalar 기준 개별 description 100~180자·총합 3,000자 이하를 고정한다. implementation·review·debugging·context-review description에는 blueprint 002가 agent 정본으로 옮긴 rubric 문구가 없어야 하며 `npm run ci`가 통과해야 한다.

#### Interface

- 제공: 기존 `test/skill-bouncer-surface.test.js`가 스킬 디렉터리 정렬 목록을 읽고 각 파일의 `description:` 접두어만 제거한 YAML 원문 scalar로 정본 개수 `19`, 개별 길이 범위 `100..180`, 합계 상한 `3000`을 단정한다. 네 역할 description의 rubric 금지 문구도 같은 원문 scalar에서 검사한다.
- 거부: 새 스킬이 추가되거나 description 예산을 늘릴 때 테스트 상수를 자동으로 따라 올리지 않는다. 예산 변경은 별도 계획과 사람 판단 없이는 실패해야 한다.

#### Touch

- Modify `test/skill-bouncer-surface.test.js` — 기존 전체 스킬 표면 테스트에 description 정본 개수, 길이 예산, 역할별 rubric 역류 방지 계약을 더한다.

#### Constraints

- Node 표준 라이브러리만 사용한다.
- 전체 스킬 표면을 이미 읽는 `test/skill-bouncer-surface.test.js`를 재사용하고 전용 test 파일이나 helper를 만들지 않는다.
- 개별 길이와 총합은 baseline 명령과 똑같이 `description:` 접두어만 제거한 한 줄의 나머지를 사용하며 YAML 인용부호를 포함한다. `parseFrontmatter(...).data.description.length`를 예산 계산에 쓰지 않는다.
- 실패 메시지에 실제 개수·길이·총합을 넣고, 상한을 올리려면 사람이 계약을 검토해야 함을 적는다.

### Task 003

#### Goal & intent

blueprint 006 baseline과 같은 일곱 시나리오의 최종 산출물이 `docs/benchmark/history.md`의 `## 지시문 비용 회차` 표에서 baseline 7행 바로 다음 7행으로 남는다. gate 통과율은 baseline 이상, review finding 수와 scope 위반 수는 baseline 이하다. 워크트리에 baseline 절이 없거나 `.final.*` 산출물이 빠졌거나 품질이 나빠지면 추정하지 않고 중단한다.

#### Interface

- 제공:
  - 같은 절의 서두를 baseline 7행과 최종 7행이 함께 있음을 가리키게 고치고, 같은 열에 `s1-light-cycle`부터 `s7-run-multitask` 순서의 최종 7행을 더한다. 각 행의 산출물 경로는 해당 `.benchmarks/<id>.final.metrics.json`이다.
  - `test/benchmark-context-cost.test.js`가 history에서 baseline 7행과 최종 7행, 열 일치, scenario별 품질 방향(gate 통과율 ≥, finding 수 ≤, scope 위반 수 ≤)을 표 숫자로 단정한다.
- 거부:
  - 006이 `closed`가 아니거나, 실행 워크트리 history에 baseline 7행이 없거나, 아래 최종 파일이 하나라도 없으면 두 파일을 수정하지 않는다.
  - `.benchmarks/<id>.recovery.*` 또는 s5–s7의 무접미사 `.metrics.json`·`.manifest.json`을 최종 출처로 쓰지 않는다.
  - 측정하지 않은 `usage` 값을 0으로 채우거나, 1–3회차·DeepSWE 수치를 대리값으로 쓰지 않는다.
  - 품질 세 값 중 하나라도 나빠지면 최종 행을 쓰지 않고 `/bouncer-plan`으로 돌려보낸다.

#### Touch

- Modify `docs/benchmark/history.md` — 지시문 비용 절의 baseline 다음에 같은 일곱 시나리오의 최종 회차 수치와 출처를 기록한다.
- Modify `test/benchmark-context-cost.test.js` — history의 두 회차 완결성, 열 일치, 품질 비회귀를 구조적으로 단정한다.

#### Constraints

- `docs/benchmark/context-cost.md`의 `## 고정 실행 입력` 표(일곱 id, base `1c73980`, 모델 `gpt-5.6-terra`, reasoning effort `medium`, 사람 개입 0회, fixture·실행 프롬프트·완료 조건)를 그대로 쓴다.
- `docs/benchmark/history.md`에서는 `## 지시문 비용 회차` 절만 수정하고 1–3회차·DeepSWE 절은 유지한다.
- 최종 입력은 시나리오마다 `.benchmarks/<id>.final.metrics.json`과 `.benchmarks/<id>.final.manifest.json`이다. `s5-finalize-distill`과 `s6-finalize-bare`는 `.benchmarks/<id>.final.finalize.json`도 있어야 한다. manifest의 `gates`·`review_findings`·`scope_violations`가 품질 세 값의 출처다.
- 실행 워크트리 history에 baseline 7행이 없으면 implementer는 merge/rebase를 하지 않고 중단한다. 컨트롤러가 `develop`을 `.worktrees/054/005`에 반영한 뒤에 다시 시작한다.
- `tokens_in`, `tokens_out`, `wall_s`, `tool_calls`는 metrics `usage`에 있는 키만 옮기고 없으면 빈칸으로 둔다.
- gate 통과율은 높을수록, review finding 수와 scope 위반 수는 낮을수록 좋다는 방향으로 scenario별로 비교한다.
- 테스트는 표 행을 읽어 비교하며 측정값을 코드 상수로 한 벌 더 두지 않는다. 기존 「baseline 표 7행」단정은 최종 7행을 더한 뒤에도 baseline 구간이 7행임을 유지해야 한다.
