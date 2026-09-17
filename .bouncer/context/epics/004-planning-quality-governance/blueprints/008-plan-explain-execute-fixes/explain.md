---
type: bouncer.explain
title: 001 explain
description: Explain for 001
resource: .bouncer/context/epics/004-planning-quality-governance/blueprints/008-plan-explain-execute-fixes/explain.md
tags:
  - bouncer
  - explain
timestamp: '2026-08-26T14:04:45.698+09:00'
bouncer:
  id: EXPLAIN-008
  epic_id: '004'
  blueprint_id: '008'
  status: published
  comprehension:
    - range_from: develop
      range_to: a62266aef71db7520b214c14f2f28aaf6b74d46b
      diff_sha: 9ce149d77a1d401cf5141a6d23a3cf4c3c9fb2a3d808d6ceaa47c8aae731e472
      quiz_score: 4/4
      disposition: 문서-게이트 정합 다섯 결함을 질문으로 확인했고 전부 맞힘
      recorded_at: '2026-08-26T14:09:12+09:00'
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

## Tasks

### Task 001

#### Goal & intent

`/bouncer-plan`의 step 4(Author)·5(Graph suggestions)·6(affected_paths)이 `tasks/001/tasks.md` 한 문서만 지목한다. `scripts/lib/validate-gates.js`는 task 묶음을 순회하며 G4·G5·G10–G12를 각 문서에 적용하고, `docs/gates.md:12`도 "G3–G5·G10–G12는 **발견된 각 task 묶음**(`tasks/<NNN>/tasks.md`)에 각각 적용"이라고 이미 적어 두었다. 절차문만 뒤처져 있어, task 002 이상을 가진 blueprint는 절차대로 해도 plan 게이트에서 실패하고 복구 방법이 문서에 없다.

세 단계가 blueprint 아래 모든 task 묶음을 대상으로 읽히게 만들고, 그 일반화를 고정하는 회귀 테스트를 새로 둔다. task가 하나뿐인 경량 blueprint도 같은 문장으로 성립해야 한다.

#### Interface

- 제공: `/bouncer-plan` step 4·5·6이 blueprint 아래 존재하는 모든 `tasks/<NNN>/tasks.md`를 저작·주입·확정 대상으로 지시한다. step 3이 이미 안내하는 `bouncer scaffold task --blueprint <dir> --id <NNN>`과 이어진다.
- 거부: 특정 번호를 절차의 기본값으로 삼는 서술을 받지 않는다. `tasks/001`을 대표 예시로 남기더라도 "그 문서만" 저작하라는 지시로 읽히면 안 된다. 게이트 코드·번호·문서 스키마는 바꾸지 않는다.

#### Touch

- Modify `skills/bouncer-plan/SKILL.md` — step 4·5·6의 `tasks/001/tasks.md` 지목을 task 묶음 순회로 고친다
- Modify `test/skill-bouncer-plan.test.js` — 순회 지시를 고정하는 회귀 테스트를 추가한다

#### Constraints

- 게이트 코드(G4·G5·G10–G12·G18)의 번호와 의미를 바꾸지 않는다.
- 경량 경로 서술(`--scale light`, G10 세 절)을 건드리지 않는다. task가 하나인 blueprint에서도 새 문장이 그대로 성립해야 한다.
- 기존 assert는 느슨한 regex라 그대로 통과해야 한다. 통과하던 assert를 지우지 않는다.
- `## Documents` 목록이나 scaffold 템플릿은 이번 범위가 아니다. Distill `plugin-skills`가 "`scripts/src/lib/templates.ts` blueprint Documents link `tasks/001/…`, so keep `templates.ts` (and assertions like `test/init.test.js`) in Touch when changing scaffold task layout names"라고 적어 두었다 — 이 task는 scaffold 레이아웃 **이름**을 바꾸지 않으므로 그 두 파일을 열지 않는다. 열어야 할 이유가 생기면 범위를 넓히지 말고 계획으로 에스컬레이션한다.
- task 002가 같은 파일 step 5를 함께 고친다. 그쪽 금지 리터럴(`graphify.enabled: true`, `pip install graphifyy`)을 이 task의 새 산문에 들이지 않는다 — 순서와 무관하게 서로의 guard를 빨갛게 만들지 않기 위함이다.
- `doesNotMatch` assert를 쓰면 새로 쓰는 산문이 금지 리터럴을 다시 적는 순간 자기 테스트를 깨뜨린다(Distill `plugin-skills`의 같은 계열 경고). 절차문에 `tasks/001/tasks.md`를 예시로도 남기지 않거나, assert 범위를 step 4–6 구간으로 좁힌다.

### Task 002

#### Goal & intent

`skills/bouncer-plan/SKILL.md:165`가 graphify 미가용 시 「`pip install graphifyy && graphify install`, then `graphify.enabled: true`」를 안내한다. 같은 저장소의 다른 두 문서는 정반대를 말한다 — `skills/bouncer-init/SKILL.md:36` "Do **not** edit `.bouncer/config.json` yourself — promotion is CLI-only", `skills/graphify-runner/SKILL.md:97` "(do not edit `config.json` by hand)". 사용자가 셋 중 아무 문서나 먼저 읽는지에 따라 상반된 행동을 한다.

plan의 안내를 CLI 경로로 바꿔 셋이 한 가지를 말하게 한다.

#### Interface

- 제공: `/bouncer-plan` step 5의 graphify 미가용 안내가 `bouncer init --promote-graphify`(기존 프로젝트) / `bouncer init`(신규 부트스트랩)만 가리킨다. `graphify-runner`가 이미 사용자에게 출력하는 문구와 같은 경로다.
- 거부: `.bouncer/config.json` 손편집 안내와 `pip install` 직접 안내를 받지 않는다. `graphify.enabled` 키 이름 자체를 설명에서 없애지는 않되, 사용자가 쓸 행동으로 제시하지 않는다.

#### Touch

- Modify `skills/bouncer-plan/SKILL.md` — step 5의 설치·활성화 안내를 CLI 경로로 교체한다
- Modify `test/skill-bouncer-plan.test.js` — 손편집 안내가 없음을 고정하는 회귀 테스트를 추가한다

#### Constraints

- `graphify-runner`가 출력하는 사용자 안내 문구와 어긋나지 않게 맞춘다. 두 문서가 다른 명령을 제시하면 이 task는 실패다.
- graphify를 선택적 의존으로 두는 기존 graceful skip 계약(`suggested_paths` 빈 채로 두고 `basis` 엔트리는 남김)을 건드리지 않는다.
- `test/session-graph.test.js:304`가 `/graphifyy/`를 assert한다. 그 테스트가 보는 대상은 CLI 출력이지 plan 문서가 아니므로 함께 고치지 않는다 — 만약 그 assert가 plan 문서를 읽고 있다면 손대지 말고 계획으로 에스컬레이션한다.
- task 001이 같은 파일 step 4–6을 함께 고친다. 그쪽 금지 리터럴 `tasks/001/tasks.md`를 이 task의 새 산문에 들이지 않는다.
- `doesNotMatch`로 막는 리터럴(`graphify.enabled: true`, `pip install graphifyy`)을 새 산문이 설명용으로라도 다시 적으면 자기 테스트가 깨진다. 대체 문장에 그 두 리터럴을 넣지 않는다.
- 새 assert는 `skills/bouncer-plan/SKILL.md` 본문만 대상으로 한다. `docs/install.md`까지 훑는 전역 검사를 만들지 않는다 — 정당한 설치 안내를 깨뜨린다.

### Task 003

#### Goal & intent

`skills/explain-diff/SKILL.md` 8–10줄이 인접한 두 문장에서 서로 다른 행동을 지시한다. "Called only from `/bouncer-finalize` after `scaffold explain` **(create the file if missing)**" 다음 문장이 "This skill does **not** replace `scaffold explain` — if the file is missing, **stop** and tell the caller to scaffold first"다. `explain.md`가 없을 때 만들라는 것인지 멈추라는 것인지 한 문단에서 갈린다.

scaffold 책임은 `/bouncer-finalize` step 2가 `bouncer scaffold explain`으로 갖는다. 멈춤 경로만 남긴다.

#### Interface

- 제공: `explain.md` 부재 시 `explain-diff`의 행동이 하나다 — 멈추고 호출자에게 scaffold를 알린다.
- 거부: 이 스킬이 `explain.md`를 직접 만드는 경로를 받지 않는다. `scaffold explain`을 대체하지 않는다는 기존 계약을 유지한다.

#### Touch

- Modify `skills/explain-diff/SKILL.md` — 도입부의 "create the file if missing" 절을 제거한다
- Modify `test/skill-explain-diff.test.js` — 두 지시가 함께 있지 않음을 고정하는 회귀 테스트를 추가한다

#### Constraints

- 퀴즈·`quiz_score`·단일 comprehension 엔트리·`## 이해 상태` 단일 블록 계약을 건드리지 않는다.
- 경량 1문항 규칙(`test/lightweight-cycle.test.js:66-72`)을 건드리지 않는다.
- `test/skill-explain-diff.test.js:43`의 `/scaffold explain|대체하지/` assert가 계속 통과해야 한다 — "대체하지 않는다" 문장은 남긴다.

### Task 004

#### Goal & intent

`skills/bouncer-execute/SKILL.md` step 5는 포인터 `scale`이 `light`면 named 디스패치를 건너뛰고 `review` 스킬을 인라인으로 돌린다. step 3의 구현도 인라인이므로, 경량 경로에서는 한 세션이 diff를 쓰고 같은 세션이 그 diff를 판정한다. `rules/governance.md:79`가 이 한계를 이미 "Limit of inline review: the same session judges **its own diff**"로 적어 두었고, 같은 문서 규칙 4는 `/bouncer-run` 주행에 대해서만 "must not become the implementer or review its own diff"를 근거로 named를 유지시킨다. 그 근거는 단독 `/bouncer-execute` 경량 실행에도 똑같이 성립한다.

리뷰만 named 디스패치로 되돌린다. 구현(step 3) 인라인과 퀴즈 1문항 등 나머지 경량 계약은 그대로 둔다.

#### Interface

- 제공: `scale`과 무관하게 step 5는 `resolveSubagentModel` → named `bouncer-reviewer` 호출 → slug 거절 시 `inherit` 재시도 → named 미지원 호스트에서 fresh generic / 인라인 폴백의 네 단계를 탄다. `rules/governance.md` 규칙 4는 인라인 대상을 implementer로 한정한다.
- 거부: `scale: light`를 이유로 리뷰 디스패치를 건너뛰는 분기를 받지 않는다. 호스트가 named를 지원하지 않을 때의 폴백 문장은 별개로 남는다 — 경량 분기가 그 문장을 대체하면 안 된다(기존 계약).

#### Touch

- Modify `skills/bouncer-execute/SKILL.md` — step 5의 경량 인라인 리뷰 분기를 제거하고 named 순서를 단일 경로로 되돌린다
- Modify `rules/governance.md` — 규칙 4의 인라인 대상을 implementer로 좁히고, 인라인 리뷰 한계 문단을 새 정책에 맞춘다
- Modify `test/skill-bouncer-execute.test.js` — 인라인 리뷰를 요구하는 assert를 named 요구로 바꾼다
- Modify `test/lightweight-cycle.test.js` — 경량 사이클 계약에서 리뷰 인라인 진술을 갱신한다

#### Constraints

- step 3의 구현 인라인 분기와 `bouncer-debugger`의 named 유지는 건드리지 않는다. 이번에 바뀌는 것은 리뷰뿐이다.
- 호스트 `named agents are unavailable` 폴백 문장을 경량 분기와 합치지 않는다. `test/lightweight-cycle.test.js:59-64`가 그 분리를 assert한다.
- 경량 판정은 계속 step 1 포인터 응답의 `scale`만 읽는다. `test/skill-bouncer-execute.test.js:145`의 `doesNotMatch(/blueprint \`index.md\`의 \`bouncer.scale\`/)` 절만 그대로 지킨다 — 같은 테스트의 `matches.length` 값은 이번에 바뀌므로 보존 대상이 아니다.
- `rules/governance.md`를 다시 쓸 때 `test/lightweight-cycle.test.js:13-28`이 요구하는 세 문구 `inline`·`its own diff|self-review`·`named agents are unavailable`가 문서 어딘가에 남아야 한다. 인라인은 implementer에 대해, self-review 한계는 그 구현 인라인에 대해 다시 쓰면 세 문구 모두 자연스럽게 남는다.
- `docs/**`에서 리뷰 디스패치를 진술하는 문장이 leftover 검색에 걸리면, 범위를 넓히지 말고 계획으로 에스컬레이션한다.

### Task 005

#### Goal & intent

스킬 10개의 셸 블록에서 `BOUNCER_ROOT="$(bouncer-root --auto)" || exit $?`가 컬럼 0에 있다. 같은 펜스의 다음 줄은 번호 목록 아래라 3–6칸 들여쓰여 있어, 한 블록 안에서 정렬이 어긋난다. CommonMark 파싱은 깨지지 않지만 복사해 붙일 때 블록 경계를 오해하기 쉽다.

37곳 중 어긋난 32곳을 주변 들여쓰기에 맞춘다. 명령 내용은 한 글자도 바꾸지 않는다.

#### Interface

- 제공: 들여쓴 펜스 안의 런처 줄이 모두 같은 펜스의 다음 명령 줄과 같은 열에서 시작한다. epic 기준 6의 awk 명령이 32에서 0이 된다.
- 거부: 명령 문자열 변경을 받지 않는다. `bouncer-root --auto`, `|| exit $?`, 변수명은 그대로다. 펜스 언어 표기나 블록 구조도 바꾸지 않는다.

#### Touch

- Modify `skills/bouncer-commit/SKILL.md` — 어긋난 4곳 정렬 (히트 5, 이미 맞음 1)
- Modify `skills/bouncer-execute/SKILL.md` — 어긋난 6곳 정렬 (히트 7, 이미 맞음 1)
- Modify `skills/bouncer-finalize/SKILL.md` — 어긋난 7곳 정렬 (히트 8, 이미 맞음 1)
- Modify `skills/bouncer-init/SKILL.md` — 어긋난 3곳 정렬
- Modify `skills/bouncer-plan/SKILL.md` — 어긋난 4곳 정렬 (히트 5, 이미 맞음 1)
- Modify `skills/bouncer-run/SKILL.md` — 어긋난 2곳 정렬 (히트 3, 이미 맞음 1)
- Modify `skills/explain-diff/SKILL.md` — 어긋난 1곳 정렬
- Modify `skills/graphify-runner/SKILL.md` — 어긋난 2곳 정렬
- Modify `skills/migrate-ids/SKILL.md` — 어긋난 2곳 정렬
- Modify `skills/review/SKILL.md` — 어긋난 1곳 정렬

#### Constraints

- 줄의 내용은 바꾸지 않는다. 앞쪽 공백만 더한다.
- 셸 블록마다 자기 `BOUNCER_ROOT=` 대입이 있어야 한다(각 블록이 새 셸이다 — Distill `plugin-skills`). 정렬을 이유로 중복처럼 보이는 대입을 지우지 않는다.
- 이미 정렬이 맞는 **5곳**은 건드리지 않는다. 펜스 자체가 들여쓰이지 않은 최상위 블록이라 컬럼 0이 옳다 — `skills/bouncer-commit/SKILL.md:19`, `skills/bouncer-execute/SKILL.md:20`, `skills/bouncer-finalize/SKILL.md:27`, `skills/bouncer-plan/SKILL.md:24`, `skills/bouncer-run/SKILL.md:15`.
- 코드펜스 밖 산문은 한 글자도 손대지 않는다. 다른 스킬 테스트가 문장을 리터럴로 고정하고 있다.
- 이 task는 마지막에 수행한다. 001·002·004가 같은 파일의 문장을 먼저 바꾼다.
